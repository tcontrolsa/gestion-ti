/* Componentes: formulario desde el esquema, tabla, vista CRUD genérica y ficha de detalle */
'use strict';

// ---------- Referencias entre entidades (listas para los campos "ref") ----------
App.refs = {};
const ETIQUETA_REF = {
  activos: r => r.Codigo_Activo + ' — ' + (r.Nombre_Equipo || r.Categoria) + (r.Custodio ? ' (' + r.Custodio + ')' : ''),
  tickets: r => r.ID_Ticket + ' — ' + r.Titulo,
  software: r => r.ID_Software + ' — ' + r.Nombre,
  servicios: r => r.Servicio,
  indicadores: r => r.Codigo + ' — ' + r.Nombre,
  cronograma: r => r.ID_Programacion + ' — ' + r.Codigo_Activo + ' ' + r.Fecha_Programada,
  mantenimientos: r => r.ID_Mantenimiento + ' — ' + r.Codigo_Activo,
  conocimiento: r => r.ID_Articulo + ' — ' + r.Titulo
};

async function cargarRefs(entidades) {
  await Promise.all(entidades.filter(e => Ent(e) && !App.refs[e]).map(e =>
    srv(e === 'tickets' ? 'tickets.listar' : 'listar', { entidad: e }).then(l => { App.refs[e] = l; }).catch(() => { App.refs[e] = []; })));
}
function invalidarRef(entidad) { delete App.refs[entidad]; }

// ---------- Formulario ----------
/**
 * formulario(fields, valores, {campos: [keys] (orden), requeridos: [keys], ancho: [keys]})
 * Devuelve {el, leer()} — leer() valida obligatorios y devuelve el objeto o lanza error.
 */
function formulario(fields, valores, op) {
  op = op || {};
  valores = valores || {};
  const porKey = Object.fromEntries(fields.map(f => [f.key, f]));
  const lista = (op.campos || fields.filter(f => !f.ro).map(f => f.key)).map(k => porKey[k]).filter(Boolean);
  const controles = {};
  const el = h('div.form');
  lista.forEach(f => {
    const id = 'f-' + f.key + '-' + Math.random().toString(36).slice(2, 7);
    const req = f.req || (op.requeridos || []).includes(f.key);
    const v = valores[f.key] === undefined || valores[f.key] === null ? '' : valores[f.key];
    let ctrl;
    if (f.type === 'textarea') ctrl = h('textarea', { id, value: v });
    else if (f.type === 'select' || f.type === 'bool') {
      const opciones = f.type === 'bool' ? ['SI', 'NO'] : Cat(f.catalog);
      ctrl = h('select', { id, value: v }, h('option', { value: '' }, '— Seleccione —'), opciones.map(o => h('option', { value: o }, o)));
      if (v && !opciones.includes(v)) ctrl.append(h('option', { value: v }, v + ' (fuera de catálogo)')), ctrl.value = v;
    } else if (f.type === 'ref') {
      const dl = 'dl-' + id;
      ctrl = h('input', { id, value: v, list: dl, autocomplete: 'off', placeholder: 'Escriba para buscar…' });
      const datos = App.refs[f.ref] || [];
      controles['__dl_' + f.key] = h('datalist', { id: dl }, datos.map(r => h('option', { value: r[Ent(f.ref).id] }, ETIQUETA_REF[f.ref] ? ETIQUETA_REF[f.ref](r) : r[Ent(f.ref).id])));
    } else {
      const tipo = { number: 'number', date: 'date', datetime: 'datetime-local', email: 'email' }[f.type] || 'text';
      ctrl = h('input', { id, type: tipo, step: f.type === 'number' ? 'any' : null, value: f.type === 'datetime' ? String(v).slice(0, 16) : v });
    }
    if (op.soloLectura && op.soloLectura.includes(f.key)) ctrl.disabled = true;
    controles[f.key] = ctrl;
    const ancho = f.type === 'textarea' || (op.ancho || []).includes(f.key);
    el.append(h('div.campo' + (ancho ? '.ancho' : ''),
      h('label', { for: id }, f.label, req ? h('span.req', ' *') : ''),
      ctrl, controles['__dl_' + f.key] || null,
      f.help ? h('div.ayuda', f.help) : null));
    ctrl.dataset.req = req ? '1' : '';
  });
  return {
    el,
    controles,
    leer() {
      const out = {}, faltan = [];
      lista.forEach(f => {
        const c = controles[f.key];
        c.closest('.campo').classList.remove('error');
        let v = c.value.trim();
        if (f.type === 'datetime' && v) v = v.length === 16 ? v + ':00' : v;
        if (c.dataset.req && !v) { faltan.push(f.label); c.closest('.campo').classList.add('error'); }
        out[f.key] = v;
      });
      if (faltan.length) throw new Error('Complete: ' + faltan.join(', '));
      return out;
    }
  };
}

// ---------- Tabla ----------
/**
 * tabla({columnas: [{key, label, fmt(v,fila), num}], filas, alClic(fila), filtros: [{key, label}], porPagina, buscar})
 */
function tabla(op) {
  const estado = { texto: '', filtros: {}, orden: op.orden || null, desc: op.desc !== undefined ? op.desc : true, pagina: 0 };
  const porPagina = op.porPagina || 25;
  const caja = h('div');
  const cuerpo = h('div');
  const filtros = h('div.filtros');
  if (op.buscar !== false) {
    const b = h('input', { type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar en la tabla', oninput: e => { estado.texto = e.target.value; estado.pagina = 0; pintar(); } });
    if (App.buscarInicial) { estado.texto = b.value = App.buscarInicial; App.buscarInicial = ''; b.classList.add('resaltado'); }
    filtros.append(b);
  }
  (op.filtros || []).forEach(fl => {
    const valores = [...new Set(op.filas.map(r => r[fl.key]).filter(v => v !== '' && v !== undefined))].sort();
    if (!valores.length) return;
    filtros.append(h('select', { 'aria-label': fl.label, value: fl.valor || '', onchange: e => { estado.filtros[fl.key] = e.target.value; estado.pagina = 0; pintar(); } },
      h('option', { value: '' }, fl.label + ': todos'), valores.map(v => h('option', { value: v }, v))));
    if (fl.valor) estado.filtros[fl.key] = fl.valor;
  });
  caja.append(filtros, cuerpo);

  function filasVisibles() {
    const t = estado.texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let rs = op.filas.filter(r => Object.entries(estado.filtros).every(([k, v]) => !v || String(r[k]) === v));
    if (t) rs = rs.filter(r => Object.values(r).some(v => String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t)));
    if (estado.orden) {
      const k = estado.orden;
      rs = rs.slice().sort((a, b) => {
        const x = a[k], y = b[k];
        const nx = typeof x === 'number' || (x !== '' && !isNaN(x) && !/^\d{4}-/.test(x)), ny = typeof y === 'number' || (y !== '' && !isNaN(y) && !/^\d{4}-/.test(y));
        const c = nx && ny ? Number(x) - Number(y) : String(x).localeCompare(String(y), 'es', { numeric: true });
        return estado.desc ? -c : c;
      });
    }
    return rs;
  }

  function pintar() {
    vaciar(cuerpo);
    const rs = filasVisibles();
    if (!rs.length) { cuerpo.append(h('div.tabla-caja', h('div.vacio', op.vacio || 'No hay registros.'))); return; }
    const paginas = Math.ceil(rs.length / porPagina);
    estado.pagina = Math.min(estado.pagina, paginas - 1);
    const pag = rs.slice(estado.pagina * porPagina, (estado.pagina + 1) * porPagina);
    const thead = h('tr', op.columnas.map(c => h('th', {
      scope: 'col', 'aria-sort': estado.orden === c.key ? (estado.desc ? 'descending' : 'ascending') : null,
      onclick: () => { estado.desc = estado.orden === c.key ? !estado.desc : false; estado.orden = c.key; pintar(); }
    }, c.label, estado.orden === c.key ? (estado.desc ? ' ▾' : ' ▴') : '')));
    const tbody = h('tbody', pag.map(r => h('tr', {
      tabindex: op.alClic ? 0 : null,
      onclick: () => op.alClic && op.alClic(r),
      onkeydown: e => { if (e.key === 'Enter' && op.alClic) op.alClic(r); }
    }, op.columnas.map(c => {
      const v = c.fmt ? c.fmt(r[c.key], r) : r[c.key];
      return h('td' + (c.num ? '.num' : ''), v === '' || v === undefined || v === null ? h('span.tenue', '—') : v);
    }))));
    cuerpo.append(h('div.tabla-caja', h('table.tabla', h('thead', thead), tbody)));
    cuerpo.append(h('div.paginas', h('span', rs.length + ' registro' + (rs.length === 1 ? '' : 's')),
      paginas > 1 ? h('span.acciones',
        h('button.btn.chico', { disabled: estado.pagina === 0, onclick: () => { estado.pagina--; pintar(); } }, '‹ Anterior'),
        h('span', (estado.pagina + 1) + ' / ' + paginas),
        h('button.btn.chico', { disabled: estado.pagina >= paginas - 1, onclick: () => { estado.pagina++; pintar(); } }, 'Siguiente ›')) : ''));
  }
  pintar();
  caja.refrescar = filas => { op.filas = filas; pintar(); };
  return caja;
}

/** Columnas estándar desde el esquema (campos con list: true) */
function columnasDe(entidad, extra) {
  const e = Ent(entidad);
  const cols = e.fields.filter(f => f.list).map(f => ({
    key: f.key, label: f.label, num: f.type === 'number',
    fmt: f.type === 'select' || f.type === 'bool' ? v => insignia(v) : (v => Fmt.valor(f, v))
  }));
  return cols.concat(extra || []);
}

// ---------- Ficha de detalle ----------
function ficha(entidad, r, soloCampos) {
  const e = Ent(entidad);
  return h('div.ficha', e.fields.filter(f => !soloCampos || soloCampos.includes(f.key)).map(f => {
    const v = r[f.key];
    const vacio = v === '' || v === null || v === undefined;
    const contenido = vacio ? h('span.tenue', '—') : (f.type === 'select' || f.type === 'bool' ? insignia(v) : (f.type === 'textarea' ? h('div.texto-largo', v) : Fmt.valor(f, v)));
    return h('div.dato' + (f.type === 'textarea' ? '.ancho' : ''), h('div.et', f.label), h('div.vl', contenido));
  }));
}

// ---------- Vista CRUD genérica ----------
/**
 * vistaEntidad(cont, entidad, {titulo, cargar(), columnas, filtros, acciones(fila, recargar) -> [botones],
 *   barra(recargar) -> [botones], campos (formulario), valoresNuevo, sinNuevo, pestanas})
 */
async function vistaEntidad(cont, entidad, op) {
  op = op || {};
  const e = Ent(entidad);
  const refs = [...new Set(e.fields.filter(f => f.type === 'ref').map(f => f.ref))];
  // Listas de referencia y registros en paralelo
  let [, filas] = await Promise.all([cargarRefs(refs), op.cargar ? op.cargar() : srv('listar', { entidad })]);
  const recargar = async () => {
    filas = await (op.cargar ? op.cargar() : srv('listar', { entidad }));
    invalidarRef(entidad);
    t.refrescar(filas);
  };
  const nuevo = e.escribir && !op.sinNuevo
    ? h('button.btn.primario', { onclick: () => editarRegistro(entidad, null, op, recargar) }, '+ Nuevo')
    : null;
  if (op.sub) cont.append(h('div.encabezado', h('div', h('h2', { style: 'margin:0' }, op.titulo || e.titulo), h('div.codigo', e.codigo)), h('div.acciones', (op.barra ? op.barra(recargar) : []), nuevo)));
  else cont.append(encabezado(op.titulo || e.titulo, e.codigo, (op.barra ? op.barra(recargar) : []), nuevo));
  if (op.antes) cont.append(op.antes);
  const t = tabla({
    columnas: op.columnas || columnasDe(entidad), filas, filtros: op.filtros, orden: op.orden || e.id, desc: op.desc,
    alClic: r => op.alClic ? op.alClic(r) : verRegistro(entidad, r, op, recargar), vacio: op.vacio
  });
  cont.append(t);
  return { recargar };
}

function verRegistro(entidad, r, op, recargar) {
  const e = Ent(entidad);
  const botones = [{ texto: 'Cerrar' }];
  const extra = op && op.acciones ? op.acciones(r, recargar) : [];
  extra.forEach(b => botones.unshift(b));
  if (e.escribir && !(op && op.sinEditar && op.sinEditar(r))) {
    botones.unshift({ texto: 'Editar', primario: true, accion: () => { editarRegistro(entidad, r, op, recargar); } });
  }
  modal({ titulo: (e.titulo.replace(/s$/, '') + ' ' + r[e.id]).trim(), cuerpo: ficha(entidad, r), botones });
}

function editarRegistro(entidad, r, op, recargar) {
  const e = Ent(entidad);
  const campos = (op && op.campos) || e.fields.filter(f => !f.ro && !(f.key === e.id && e.autoId)).map(f => f.key);
  const soloLectura = r && !e.autoId ? [e.id] : [];
  const form = formulario(e.fields, r || (op && op.valoresNuevo ? op.valoresNuevo() : {}), { campos, soloLectura });
  modal({
    titulo: r ? 'Editar ' + r[e.id] : 'Nuevo registro — ' + e.titulo,
    cuerpo: h('div', e.codigo ? h('p.tenue.peq', e.codigo) : null, form.el),
    botones: [{ texto: 'Cancelar' }, {
      texto: 'Guardar', primario: true, accion: async () => {
        const datos = form.leer();
        const g = await srv('guardar', { entidad, id: r ? r[e.id] : '', registro: datos });
        aviso('Guardado ' + g[e.id], 'ok');
        if (recargar) await recargar();
      }
    }]
  });
}
