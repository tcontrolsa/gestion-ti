/* Tareas pendientes del personal de TI y del administrador, reunidas de todos los procedimientos */
'use strict';

const NIVELES = {
  alta: { nombre: 'Urgente', ayuda: 'Atender hoy' },
  media: { nombre: 'Importante', ayuda: 'Durante la semana' },
  baja: { nombre: 'Cuando puedas', ayuda: 'Planificar' }
};

const esPeriodo = v => /^\d{4}(-\d{2})?$/.test(String(v));
const refBuscable = t => (t.ref && !esPeriodo(t.ref) && !/^[A-Z_]+$/.test(t.ref)) ? t.ref : '';

/** Dónde se resuelve cada tarea: ruta, pestaña y texto para filtrar la tabla */
const AREAS = {
  tickets: { nombre: 'Tickets', proc: '2.6.9', destino: t => ({ ruta: t.ref ? '/tickets/' + t.ref : '/tickets' }) },
  mantenimiento: { nombre: 'Mantenimiento', proc: '2.6.1', destino: t => ({ ruta: '/cronograma', buscar: refBuscable(t) }) },
  activos: { nombre: 'Activos', proc: '2.6.1', destino: t => ({ ruta: '/activos', buscar: refBuscable(t) }) },
  software: { nombre: 'Software', proc: '2.6.5', destino: t => ({ ruta: '/software', buscar: refBuscable(t) }) },
  accesos: { nombre: 'Accesos', proc: '2.6.2', destino: t => /^Revisión/.test(t.titulo) ? { ruta: '/accesos', pestana: 2 } : { ruta: '/accesos', buscar: refBuscable(t) } },
  respaldos: { nombre: 'Respaldos', proc: '2.6.8', destino: () => ({ ruta: '/respaldos' }) },
  indicadores: { nombre: 'Indicadores', proc: '2.6.8', destino: t => /^Seguimiento/.test(t.titulo) ? { ruta: '/indicadores', pestana: 1, buscar: refBuscable(t) } : { ruta: '/indicadores' } },
  disponibilidad: { nombre: 'Disponibilidad', proc: '2.6.8', destino: () => ({ ruta: '/disponibilidad' }) },
  capacitacion: { nombre: 'Capacitación', proc: '2.6.7', destino: t => ({ ruta: '/capacitaciones', buscar: refBuscable(t) }) },
  seguridad: { nombre: 'Seguridad', proc: '2.6.4', destino: t => ({ ruta: '/seguridad', pestana: /No conformidad/.test(t.titulo) ? 2 : /Auditoría/.test(t.titulo) ? 1 : 0, buscar: refBuscable(t) }) },
  riesgos: { nombre: 'Riesgos', proc: '2.6.4', destino: t => ({ ruta: '/seguridad', pestana: 3, buscar: refBuscable(t) }) },
  infraestructura: { nombre: 'Infraestructura', proc: '2.6.3', destino: t => ({ ruta: '/infraestructura', buscar: refBuscable(t) }) },
  proyectos: { nombre: 'Proyectos', proc: '2.6.6', destino: t => { const id = (String(t.ref).match(/^PRY-[\w-]+$/) || String(t.titulo).match(/PRY-[\w-]+/) || [])[0]; return { ruta: id ? '/proyectos/' + id : '/proyectos' }; } },
  administracion: { nombre: 'Administración', proc: 'App', destino: t => ({ ruta: /^[A-Z_]+$/.test(t.ref) ? '/configuracion' : '/usuarios' }) }
};
const areaDe = t => AREAS[t.modulo] || { nombre: t.modulo, proc: '', destino: () => ({ ruta: '/' }) };

/** Abre la pantalla donde se resuelve la tarea (usado también desde las alertas del tablero) */
function abrirPendiente(t) {
  const d = areaDe(t).destino(t);
  App.pestanaInicial = d.pestana || 0;
  App.buscarInicial = d.buscar || '';
  ir(d.ruta);
}

function saludo() {
  const hora = new Date().getHours();
  const primero = String(App.meta.usuario.nombre || '').trim().split(/\s+/)[0] || '';
  const nombre = primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase();
  return (hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches') + (nombre ? ', ' + nombre : '');
}

function pintarConteoPendientes(c) {
  const el = document.querySelector('[data-conteo="/pendientes"]');
  if (!el || !c) return;
  el.textContent = c.total;
  el.classList.toggle('oculto', !c.total);
  el.classList.toggle('urgente', c.alta > 0);
  el.title = c.alta ? c.alta + ' urgentes' : '';
}

ruta('/pendientes', async cont => {
  let datos = await srv('pendientes');
  const filtro = { nivel: '', area: '', texto: '' };

  const actualizar = h('button.btn', { onclick: async () => {
    datos = await srv('pendientes', { recalcular: true });
    sembrarLectura('pendientes', {}, datos);
    pintar();
    aviso('Lista actualizada', 'ok');
  } }, '↻ Actualizar');
  const sub = h('div.codigo');
  cont.append(h('div.encabezado', h('div', h('h1', saludo()), sub), h('div.acciones', actualizar)));

  const resumen = h('p.pend-resumen');
  const tarjetas = h('div.pend-niveles');
  const chips = h('div.pend-areas', { role: 'group', 'aria-label': 'Filtrar por área' });
  const buscar = h('input', { type: 'search', placeholder: 'Buscar una tarea…', 'aria-label': 'Buscar una tarea', oninput: e => { filtro.texto = e.target.value; pintarLista(); } });
  const lista = h('div.pend-lista', { 'aria-live': 'polite' });
  cont.append(resumen, tarjetas, h('div.filtros', buscar), chips, lista);

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const visibles = () => datos.tareas.filter(t =>
    (!filtro.nivel || t.nivel === filtro.nivel) && (!filtro.area || t.modulo === filtro.area) &&
    (!filtro.texto || norm(t.titulo + ' ' + t.detalle + ' ' + areaDe(t).nombre).includes(norm(filtro.texto))));

  function pintar() {
    const c = { alta: 0, media: 0, baja: 0 };
    datos.tareas.forEach(t => { c[t.nivel]++; });
    pintarConteoPendientes(Object.assign({ total: datos.tareas.length }, c));
    sub.textContent = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }) +
      ' · actualizado a las ' + String(datos.generado).slice(11, 16);

    resumen.textContent = !datos.tareas.length ? 'No tienes tareas pendientes. ¡Todo está al día!'
      : 'Tienes ' + datos.tareas.length + (datos.tareas.length === 1 ? ' tarea pendiente' : ' tareas pendientes') +
        (c.alta ? ', ' + c.alta + (c.alta === 1 ? ' es urgente' : ' son urgentes') : '') + '. Pulsa una tarea para ir directo a resolverla.';

    vaciar(tarjetas).append(...Object.keys(NIVELES).map(n => h('button.pend-nivel.n-' + n + (filtro.nivel === n ? '.activo' : ''), {
      type: 'button', 'aria-pressed': String(filtro.nivel === n),
      onclick: () => { filtro.nivel = filtro.nivel === n ? '' : n; pintar(); }
    }, h('span.pend-num', String(c[n])), h('span', h('b', NIVELES[n].nombre), h('span.peq', NIVELES[n].ayuda)))));

    const porArea = {};
    datos.tareas.forEach(t => { porArea[t.modulo] = (porArea[t.modulo] || 0) + 1; });
    const chip = (clave, texto, n) => h('button.chip' + (filtro.area === clave ? '.activo' : ''), {
      type: 'button', 'aria-pressed': String(filtro.area === clave),
      onclick: () => { filtro.area = clave; pintar(); }
    }, texto, h('span.chip-n', String(n)));
    vaciar(chips).append(...(datos.tareas.length ? [chip('', 'Todas', datos.tareas.length)].concat(
      Object.keys(porArea).sort((a, b) => porArea[b] - porArea[a]).map(k => chip(k, areaDe({ modulo: k }).nombre, porArea[k]))) : []));
    pintarLista();
  }

  function pintarLista() {
    vaciar(lista);
    if (!datos.tareas.length) {
      lista.append(h('div.tarjeta.pend-vacio', h('div.pend-check', { 'aria-hidden': 'true' }), h('h2', '¡Todo al día!'),
        h('p.tenue', 'No hay tareas pendientes en ningún procedimiento. Buen trabajo.')));
      return;
    }
    const vs = visibles();
    if (!vs.length) {
      lista.append(h('div.tarjeta.vacio', 'No hay tareas con estos filtros. ',
        h('button.btn.chico', { type: 'button', onclick: () => { filtro.nivel = ''; filtro.area = ''; filtro.texto = ''; buscar.value = ''; pintar(); } }, 'Quitar filtros')));
      return;
    }
    Object.keys(NIVELES).forEach(n => {
      const grupo = vs.filter(t => t.nivel === n);
      if (!grupo.length) return;
      lista.append(h('h2.pend-grupo', h('span.punto.p-' + n), NIVELES[n].nombre + ' · ' + grupo.length));
      lista.append(h('div.pend-tareas', grupo.map(t => {
        const a = areaDe(t);
        return h('button.pend-tarea.n-' + t.nivel, { type: 'button', onclick: () => abrirPendiente(t), title: 'Ir a ' + a.nombre },
          h('span.pend-area', a.nombre, a.proc ? h('span.pend-proc', a.proc) : null),
          h('span.pend-texto', h('b', t.titulo), h('span.tenue.peq', t.detalle)),
          h('span.pend-ir', { 'aria-hidden': 'true' }, 'Resolver →'));
      })));
    });
  }

  pintar();
});
