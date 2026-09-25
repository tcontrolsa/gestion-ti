/* Núcleo: DOM, API, estado, navegación, avisos y modales */
'use strict';

const App = { meta: null, token: null, rutas: {}, vistaActual: null };

// ---------- DOM ----------
/** h('div.clase#id', {atributos}, hijos...) */
function h(sel, attrs, ...hijos) {
  const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m[1] || 'div');
  (m[2].match(/[.#][\w-]+/g) || []).forEach(p => { if (p[0] === '.') el.classList.add(p.slice(1)); else el.id = p.slice(1); });
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { hijos.unshift(attrs); attrs = null; }
  let valor;
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === false) return;
    if (k === 'value') valor = v;
    else if (k === 'onclick' && el.tagName === 'BUTTON') el.addEventListener('click', ev => pendiente(el, v(ev)));
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  });
  hijos.flat(Infinity).forEach(c => { if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c)); });
  if (valor !== undefined) el.value = valor;
  return el;
}
const $ = (s, r) => (r || document).querySelector(s);
const vaciar = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

// ---------- Formatos ----------
const CAMPOS_PORCENTAJE = ['Disponibilidad', 'Porcentaje_Asistencia', 'Satisfaccion', 'Cumplimiento', 'Avance'];
const Fmt = {
  fecha: v => v ? String(v).slice(0, 10) : '',
  fechaHora: v => v ? String(v).slice(0, 16).replace('T', ' ') : '',
  horas: v => v === '' || v === null || v === undefined ? '' : Number(v).toFixed(2).replace(/\.00$/, '') + ' h',
  pct: v => v === '' || v === null || v === undefined ? '—' : (Number(v) * 100).toFixed(1) + ' %',
  num: v => v === '' || v === null || v === undefined ? '' : Number(v).toLocaleString('es-EC'),
  hoy: () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  ahora: () => { const d = new Date(); return Fmt.hoy() + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); },
  periodoActual: () => Fmt.hoy().slice(0, 7),
  valor(f, v) {
    if (v === '' || v === null || v === undefined) return '';
    if (f.type === 'date') return Fmt.fecha(v);
    if (f.type === 'datetime') return Fmt.fechaHora(v);
    if (f.type === 'number') return /Horas/.test(f.key) ? Fmt.horas(v) : (CAMPOS_PORCENTAJE.includes(f.key) ? Fmt.pct(v) : Fmt.num(v));
    return String(v);
  }
};

/** Insignia de color según el valor */
function insignia(v) {
  const t = String(v || '');
  const clase = {
    'Cerrado': 'i-ok', 'Ejecutado': 'i-ok', 'Ejecutada': 'i-ok', 'SI': 'i-ok', 'Conforme': 'i-ok', 'Vigente': 'i-ok', 'Operativo': 'i-ok', 'Exitoso': 'i-ok', 'Cerrada eficaz': 'i-ok', 'Publicado': 'i-ok', 'Activo': 'i-ok',
    'NO': 'i-mal', 'Vencida': 'i-mal', 'No Conforme': 'i-mal', 'Fallido': 'i-mal', 'Rechazada': 'i-mal', 'Alta': 'i-mal', 'Reabierto': 'i-mal', 'Cerrada no eficaz': 'i-mal', 'No operativo': 'i-mal', 'De Baja': 'i-mal', 'Alto': 'i-mal',
    'Abierto': 'i-alerta', 'Pendiente': 'i-alerta', 'PENDIENTE': 'i-alerta', 'Por vencer': 'i-alerta', 'Media': 'i-alerta', 'Programado': 'i-alerta', 'Reprogramado': 'i-alerta', 'Abierta': 'i-alerta', 'Parcial': 'i-alerta', 'En Espera de Tercero': 'i-alerta', 'En Mantenimiento': 'i-alerta', 'Medio': 'i-alerta',
    'En Proceso': 'i-info', 'Resuelto': 'i-info', 'En curso': 'i-info', 'Baja': 'i-info', 'Cerrado por TI': 'i-info',
    'Realizada': 'i-ok', 'Cumple': 'i-ok', 'Notificada': 'i-ok', 'Cerrada': 'i-ok', 'Bajo': 'i-ok', 'Aceptado': 'i-ok',
    'Extremo': 'i-mal', 'Detectado': 'i-mal', 'No cumple': 'i-mal',
    'Planificada': 'i-alerta', 'Reprogramada': 'i-alerta', 'En análisis': 'i-alerta', 'Por evaluar': 'i-alerta', 'Con acciones abiertas': 'i-alerta',
    'Confirmada': 'i-info', 'Contenido': 'i-info', 'Evaluado': 'i-info', 'En tratamiento': 'i-info',
    'Viable': 'i-ok', 'Implementada': 'i-ok', 'Aprobado': 'i-ok', 'Completado': 'i-ok',
    'No viable': 'i-mal', 'Rechazado': 'i-mal',
    'Viable con condiciones': 'i-alerta', 'Identificada': 'i-alerta', 'Idea': 'i-alerta', 'No iniciado': 'i-alerta', 'En pausa': 'i-alerta',
    'En evaluación': 'i-info', 'En adquisición': 'i-info', 'En implementación': 'i-info', 'En ejecución': 'i-info', 'En progreso': 'i-info', 'En revisión': 'i-info'
  }[t] || '';
  return t ? h('span.insignia' + (clase ? '.' + clase : ''), t) : '';
}

// ---------- Indicadores de carga ----------
let cargas = 0;
const botonesPendientes = new Set();
function indicadorCarga(delta) {
  cargas += delta;
  let el = $('#barra-carga');
  if (cargas > 0 && !el) document.body.append(h('div.cargando#barra-carga', { role: 'progressbar', 'aria-label': 'Cargando' }));
  if (cargas <= 0 && el) el.remove();
  botonesPendientes.forEach(b => marcarOcupado(b));
}
/** El botón muestra un giro mientras su acción espera al servidor (no mientras espera una confirmación del usuario) */
function marcarOcupado(b) {
  const ocupado = cargas > 0 && botonesPendientes.has(b);
  b.classList.toggle('ocupado', ocupado);
  if (ocupado) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
}
function pendiente(boton, resultado) {
  if (!resultado || typeof resultado.then !== 'function') return resultado;
  botonesPendientes.add(boton);
  marcarOcupado(boton);
  const fin = () => { botonesPendientes.delete(boton); marcarOcupado(boton); };
  resultado.then(fin, fin);
  return resultado;
}

/** Siluetas grises animadas mientras llega el contenido: 'vista' (encabezado + tabla), 'kpis' o 'tabla' */
function esqueleto(tipo) {
  const barra = (ancho, alto) => h('div.esq', { style: 'width:' + ancho + ';height:' + (alto || 12) + 'px' });
  const filas = n => h('div.tarjeta.esq-tabla', Array.from({ length: n }, (_, i) => h('div.esq-fila', barra('14%'), barra((40 + (i * 13) % 35) + '%'), barra('18%'))));
  const kpis = () => h('div.kpis', Array.from({ length: 8 }, () => h('div.kpi', barra('70%', 10), barra('45%', 22), barra('60%', 10))));
  const el = h('div.esqueleto', { 'aria-hidden': 'true' });
  if (tipo === 'kpis') el.append(kpis(), h('div.rejilla.r2', h('div.tarjeta', barra('100%', 180)), h('div.tarjeta', barra('100%', 180))));
  else if (tipo === 'tabla') el.append(filas(5));
  else el.append(h('div.encabezado', h('div', barra('220px', 22), barra('140px', 10))), filas(8));
  return el;
}

// ---------- API ----------

// Acciones de solo lectura (igual que LECTURAS_ en Api.gs): se reutilizan unos minutos al navegar
const LECTURAS = ['meta', 'arranque', 'listar', 'tickets.listar', 'tickets.detalle', 'accesos.cuentas', 'software.resumen', 'disponibilidad.calcularMes',
  'indicadores.calcular', 'tablero', 'alertas', 'capacitaciones.encuestas', 'auditorias.informe'];
const TTL_LECTURAS = 2 * 60 * 1000;
const cacheLecturas = new Map();
const vaciarCacheLecturas = () => cacheLecturas.clear();
const clonar = d => (typeof structuredClone === 'function' ? structuredClone(d) : JSON.parse(JSON.stringify(d)));
const idSolicitud = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/**
 * Llama a la API de Apps Script. En desarrollo (dev/index.html) usa el simulador local.
 * Las lecturas se guardan 2 minutos en memoria; cualquier escritura vacía esa memoria.
 * Las escrituras llevan idSolicitud para poder reintentarlas sin duplicar (ver api() en Api.gs).
 */
function srv(accion, datos) {
  const lectura = LECTURAS.includes(accion);
  const cuerpo = { accion, datos: datos || {}, token: App.token };
  const clave = accion + '|' + JSON.stringify(cuerpo.datos);
  if (lectura) {
    const c = cacheLecturas.get(clave);
    if (c && c.token === App.token && Date.now() - c.t < TTL_LECTURAS) return c.p.then(clonar);
  } else {
    cuerpo.idSolicitud = idSolicitud();
    vaciarCacheLecturas();
  }
  indicadorCarga(1);
  const llamada = window.__DEV__ ? viaSimulador(cuerpo) : viaFetch(cuerpo);
  const p = llamada.then(r => {
    if (r && r.ok) return r.data;
    if (r && r.sesionExpirada && App.token) { cerrarSesionLocal(); aviso(r.error, 'error'); }
    throw new Error(r ? r.error : 'Sin respuesta del servidor');
  }).finally(() => {
    indicadorCarga(-1);
    if (!lectura) vaciarCacheLecturas(); // también si falló: la escritura pudo aplicarse
  });
  if (!lectura) return p;
  cacheLecturas.set(clave, { t: Date.now(), token: App.token, p });
  p.catch(() => { if (cacheLecturas.get(clave) && cacheLecturas.get(clave).p === p) cacheLecturas.delete(clave); });
  return p.then(clonar);
}

/**
 * Google responde con una redirección a una URL de eco de un solo uso que a veces devuelve 404
 * (sin cabecera CORS, por eso el navegador lo reporta como error de red). Se reintenta: las lecturas
 * no cambian nada y las escrituras se reconocen por idSolicitud, así que no se duplican.
 */
async function viaFetch(cuerpo) {
  const url = (window.GTI_CONFIG || {}).API_URL;
  if (!url) throw new Error('Falta configurar la URL de la API en config.js.');
  const INTENTOS = 3;
  let ultimo = null;
  for (let i = 1; i <= INTENTOS; i++) {
    try {
      // text/plain evita la consulta previa (preflight) de CORS, que Apps Script no responde
      const res = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) });
      if (!res.ok) throw new Error('El servidor respondió con error ' + res.status + '.');
      const texto = await res.text();
      try { return JSON.parse(texto); } catch (e) { throw new Error('Respuesta inválida del servidor (¿la implementación permite acceso a "Cualquier usuario"?).'); }
    } catch (e) {
      ultimo = e instanceof TypeError ? new Error('No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.') : e;
      if (i < INTENTOS) await new Promise(r => setTimeout(r, 700 * i));
    }
  }
  throw ultimo;
}

/** Guarda en la memoria de lecturas un resultado que ya llegó (p. ej. el tablero dentro del arranque) */
function sembrarLectura(accion, datos, resultado) {
  cacheLecturas.set(accion + '|' + JSON.stringify(datos || {}), { t: Date.now(), token: App.token, p: Promise.resolve(resultado) });
}

function viaSimulador(cuerpo) {
  return new Promise((resolve, reject) => google.script.run.withSuccessHandler(resolve)
    .withFailureHandler(e => reject(new Error(e && e.message ? e.message : String(e)))).api(cuerpo));
}

// ---------- Avisos y modales ----------
function aviso(texto, tipo) {
  let caja = $('.avisos');
  if (!caja) { caja = h('div.avisos', { role: 'status', 'aria-live': 'polite' }); document.body.append(caja); }
  const el = h('div.aviso' + (tipo ? '.' + tipo : ''), texto);
  caja.append(el);
  setTimeout(() => el.remove(), tipo === 'error' ? 7000 : 3500);
}

/** Muestra un error de la API sin romper la vista */
const fallo = e => aviso(e.message || String(e), 'error');

function modal({ titulo, cuerpo, botones, chico }) {
  const anterior = document.activeElement;
  const velo = h('div.velo');
  const cerrar = () => { velo.remove(); document.removeEventListener('keydown', esc); if (anterior && anterior.focus) anterior.focus(); };
  const esc = e => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', esc);
  const pie = h('footer');
  (botones || [{ texto: 'Cerrar' }]).forEach(b => pie.append(h('button.btn' + (b.primario ? '.primario' : '') + (b.peligro ? '.peligro' : ''), {
    type: 'button',
    onclick: async ev => {
      if (!b.accion) return cerrar();
      const boton = ev.currentTarget;
      boton.disabled = true;
      const r = (async () => b.accion())();
      pendiente(boton, r);
      try { if ((await r) !== false) cerrar(); } catch (e) { fallo(e); } finally { boton.disabled = false; }
    }
  }, b.texto)));
  const caja = h('div.modal' + (chico ? '.chico' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
    h('header', h('h2', { style: 'margin:0' }, titulo), h('button.cerrar', { type: 'button', 'aria-label': 'Cerrar', onclick: cerrar }, '×')),
    h('div.cuerpo', cuerpo), pie);
  velo.append(caja);
  velo.addEventListener('mousedown', e => { if (e.target === velo) cerrar(); });
  document.body.append(velo);
  const foco = caja.querySelector('input, select, textarea') || caja.querySelector('footer .btn.primario');
  if (foco) setTimeout(() => foco.focus(), 30);
  return { cerrar };
}

function confirmar(titulo, texto) {
  return new Promise(res => modal({ titulo, chico: true, cuerpo: h('p', texto), botones: [
    { texto: 'Cancelar', accion: () => { res(false); } },
    { texto: 'Confirmar', primario: true, accion: () => { res(true); } }] }));
}

// ---------- Navegación por hash (#/ruta): permite enlaces directos desde los correos ----------
function ir(ruta) {
  if (location.hash.slice(1) !== ruta) location.hash = ruta;
  else mostrarRuta(ruta);
}

function rutaActual() { return (location.hash || '').replace(/^#/, '') || '/'; }

function ruta(patron, fn) { App.rutas[patron] = fn; }

async function mostrarRuta(r) {
  r = r || '/';
  if (!App.meta) return;
  const partes = r.split('/').filter(Boolean);
  let fn = null, params = [];
  Object.keys(App.rutas).forEach(p => {
    const pp = p.split('/').filter(Boolean);
    if (pp.length !== partes.length) return;
    const ps = [];
    if (pp.every((x, i) => x.startsWith(':') ? (ps.push(decodeURIComponent(partes[i])), true) : x === partes[i])) { fn = App.rutas[p]; params = ps; }
  });
  if (!fn) fn = App.rutas[inicioSegunRol()];
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('activo', r === a.dataset.ruta || (a.dataset.ruta !== '/' && r.startsWith(a.dataset.ruta + '/'))));
  $('.lateral') && $('.lateral').classList.remove('abierto');
  // Cada navegación dibuja en su propio contenedor: si una vista anterior responde tarde, queda fuera de la pantalla
  // Silueta de carga hasta que la vista agregue su propio contenido
  const cont = h('div');
  const esq = esqueleto();
  cont.append(esq);
  // (una vista puede agregar primero contenedores vacíos: se espera a que haya texto visible)
  const obs = new MutationObserver(() => { if ([...cont.children].some(c => c !== esq && c.textContent.trim())) quitarEsq(); });
  const quitarEsq = () => { if (esq.isConnected) { esq.remove(); cont.classList.add('aparecer'); } obs.disconnect(); };
  obs.observe(cont, { childList: true, subtree: true, characterData: true });
  vaciar($('#contenido')).append(cont);
  App.vistaActual = r;
  window.scrollTo(0, 0);
  try { await fn(cont, ...params); } catch (e) { if (cont.isConnected) { fallo(e); cont.append(h('div.tarjeta.vacio', 'No se pudo cargar: ' + e.message)); } }
  quitarEsq();
  if (cont.isConnected) $('#contenido').focus({ preventScroll: true });
}

function inicioSegunRol() { return App.meta && !veTodo() ? '/mis-tickets' : '/'; }

// ---------- Utilidades de datos ----------
const Ent = nombre => App.meta.entidades[nombre];
const Cat = nombre => (App.meta.catalogos[nombre] || []);
const esTI = () => ['Especialista TI', 'Administrador'].includes(App.meta.usuario.rol);
const esAdmin = () => App.meta.usuario.rol === 'Administrador';
/** TI y auditoría ven todos los tickets y el tablero */
const veTodo = () => esTI() || App.meta.usuario.rol === 'Auditor SGI';

/** Encabezado estándar de una vista */
function encabezado(titulo, codigo, ...acciones) {
  return h('div.encabezado', h('div', h('h1', titulo), codigo ? h('div.codigo', codigo) : null), h('div.acciones', acciones));
}
