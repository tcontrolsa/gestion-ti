/* Fase 1 Firebase (docs/firebase-fase1.md): ingreso por enlace, tickets activos en vivo desde Firestore.
 * Se activa con GTI_CONFIG.MODO = 'firebase'; en otro caso nada de esto se usa y todo sigue por Apps Script. */
'use strict';

const Fb = { activo: false, auth: null, db: null, correo: null, usuario: null, general: {}, escuchas: [], sesionAS: null };
const CLAVE_CORREO_INGRESO = 'gti_correo_ingreso';

function fbIniciar() {
  const cfg = window.GTI_CONFIG || {};
  if (cfg.MODO !== 'firebase' || !cfg.FIREBASE || typeof firebase === 'undefined') return false;
  firebase.initializeApp(cfg.FIREBASE);
  Fb.auth = firebase.auth();
  Fb.db = firebase.firestore();
  if (cfg.EMULADORES) {
    Fb.auth.useEmulator(cfg.EMULADORES.auth);
    Fb.db.useEmulator(cfg.EMULADORES.firestore[0], cfg.EMULADORES.firestore[1]);
  }
  Fb.activo = true;
  return true;
}

/** Mensajes de Firebase en lenguaje de usuario */
function fbError(e) {
  const c = (e && e.code) || '';
  if (/permission-denied/.test(c)) return new Error('No tiene permiso para esta acción, o el dato cambió mientras tanto. Actualice la pantalla.');
  if (/unavailable|network/.test(c)) return new Error('Sin conexión con el servidor. Revise su red; los cambios se reintentarán.');
  if (/invalid-action-code|expired-action-code/.test(c)) return new Error('El enlace ya se usó o venció. Pida uno nuevo.');
  if (/invalid-email/.test(c)) return new Error('Correo inválido.');
  if (/too-many-requests|quota/.test(c)) return new Error('Demasiados intentos. Espere unos minutos.');
  return e instanceof Error ? e : new Error(String(e));
}

// ---------- Ingreso por enlace ----------

async function fbEnviarEnlace(correo) {
  correo = String(correo || '').trim().toLowerCase();
  const url = location.href.split('#')[0].split('?')[0];
  try { await Fb.auth.sendSignInLinkToEmail(correo, { url, handleCodeInApp: true }); } catch (e) { throw fbError(e); }
  try { localStorage.setItem(CLAVE_CORREO_INGRESO, correo); } catch (e) { /* se pedirá al abrir el enlace */ }
}

/** Si la página se abrió desde el enlace del correo, completa el ingreso. Devuelve true si lo hizo. */
async function fbCompletarEnlace(pedirCorreo) {
  if (!Fb.auth.isSignInWithEmailLink(location.href)) return false;
  let correo = null;
  try { correo = localStorage.getItem(CLAVE_CORREO_INGRESO); } catch (e) { /* nada */ }
  if (!correo) correo = await pedirCorreo(); // abierto en otro navegador: se confirma el correo
  try { await Fb.auth.signInWithEmailLink(correo, location.href); } catch (e) { throw fbError(e); }
  try { localStorage.removeItem(CLAVE_CORREO_INGRESO); } catch (e) { /* nada */ }
  history.replaceState(null, '', location.pathname + location.hash);
  return true;
}

function fbUsuarioActual() {
  return new Promise(res => { const quitar = Fb.auth.onAuthStateChanged(u => { quitar(); res(u); }); });
}

// ---------- Arranque: todo desde Firestore (sin Apps Script) ----------

async function fbArranque() {
  const u = Fb.auth.currentUser;
  Fb.correo = u.email.toLowerCase();
  let doc;
  try { doc = await Fb.db.collection('usuarios').doc(Fb.correo).get(); } catch (e) { doc = null; }
  if (!doc || !doc.exists || !doc.data().activo) {
    await Fb.auth.signOut();
    throw new Error('El correo ' + Fb.correo + ' no está registrado como usuario activo. Pida a TI que lo registre.');
  }
  const us = doc.data();
  Fb.usuario = { id: us.id || '', email: Fb.correo, nombre: us.nombre, rol: us.rol, depto: us.depto || '' };
  const anio = String(new Date().getFullYear());
  const esTIrol = ['Especialista TI', 'Administrador'].includes(us.rol);
  const veTodoRol = esTIrol || us.rol === 'Auditor SGI';
  const leerJson = ruta => Fb.db.doc(ruta).get().then(d => (d.exists ? JSON.parse(d.data().json) : null)).catch(() => null);
  const [meta, general, pendientes, tablero] = await Promise.all([
    leerJson('meta/' + us.rol),
    Fb.db.doc('config/general').get().then(d => d.data() || {}),
    esTIrol ? leerJson('resumen/pendientes-' + (us.rol === 'Administrador' ? 'admin' : 'ti')) : null,
    veTodoRol && !esTIrol ? leerJson('resumen/tablero-' + anio) : null
  ]);
  if (!meta) throw new Error('La aplicación aún no está sincronizada. Avise a TI (menú Gestión TI → Sincronizar Firebase ahora).');
  Fb.general = general;
  meta.usuario = Fb.usuario;
  if (pendientes) {
    const c = { alta: 0, media: 0, baja: 0, total: pendientes.tareas.length };
    pendientes.tareas.forEach(t => { c[t.nivel]++; });
    meta.pendientes = c;
  }
  return { meta, pendientes, tablero: tablero ? { periodo: anio, datos: tablero } : null };
}

/** Número de tickets activos en el menú, en vivo */
function fbEscucharConteo() {
  if (!veTodo()) return;
  const quitar = Fb.db.collection('tickets').where('Estado', 'in', ESTADOS_ACTIVOS).onSnapshot(s => {
    App.meta.ticketsActivos = s.size;
    const el = document.querySelector('[data-conteo="/tickets"]');
    if (el) { el.textContent = s.size; el.classList.toggle('oculto', !s.size); }
  }, () => {});
  Fb.escuchas.push(quitar);
}

async function fbSalir() {
  Fb.escuchas.splice(0).forEach(q => { try { q(); } catch (e) { /* nada */ } });
  if (Fb.auth) await Fb.auth.signOut().catch(() => {});
}

// ---------- Sesión de Apps Script para los módulos que no son tickets ----------

/** Cambia el token de Firebase por una sesión de Apps Script (una vez; se reutiliza) */
function fbSesionAppsScript(renovar) {
  if (renovar) { App.token = null; Fb.sesionAS = null; }
  if (App.token) return Promise.resolve(App.token);
  if (!Fb.sesionAS) {
    Fb.sesionAS = (async () => {
      const idToken = await Fb.auth.currentUser.getIdToken();
      const r = await viaFetch({ accion: 'auth.firebase', datos: { idToken } });
      if (!r || !r.ok) throw new Error((r && r.error) || 'No se pudo abrir la sesión.');
      App.token = r.data.token;
      try { localStorage.setItem(CLAVE_SESION, App.token); } catch (e) { /* nada */ }
      return App.token;
    })().finally(() => { Fb.sesionAS = null; });
  }
  return Fb.sesionAS;
}

// ---------- Horas hábiles (mismo algoritmo que horasHabiles_ en Util.gs) ----------

function fbHorasHabiles(desde, hasta) {
  if (!desde || !hasta || hasta <= desde) return 0;
  const c = Fb.general;
  const mm = s => { const p = String(s || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
  const j = { inicio: mm(c.HORA_INICIO_JORNADA), fin: mm(c.HORA_FIN_JORNADA), almIni: mm(c.HORA_INICIO_ALMUERZO), almFin: mm(c.HORA_FIN_ALMUERZO),
    feriados: String(c.FERIADOS || '').split(',').map(s => s.trim()).filter(Boolean) };
  const tramos = [[j.inicio, j.almIni], [j.almFin, j.fin]];
  const soloDia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const clave = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  let minutos = 0;
  const primero = soloDia(desde), ultimo = soloDia(hasta);
  for (let dia = new Date(primero); dia <= ultimo; dia.setDate(dia.getDate() + 1)) {
    if (dia.getDay() === 0 || dia.getDay() === 6 || j.feriados.includes(clave(dia))) continue;
    const mDesde = dia.getTime() === primero.getTime() ? desde.getHours() * 60 + desde.getMinutes() : 0;
    const mHasta = dia.getTime() === ultimo.getTime() ? hasta.getHours() * 60 + hasta.getMinutes() : 24 * 60;
    tramos.forEach(t => { minutos += Math.max(0, Math.min(mHasta, t[1]) - Math.max(mDesde, t[0])); });
  }
  return Math.round(minutos / 60 * 100) / 100;
}

/** Ticket de Firestore → mismo formato que entrega Apps Script (fechas en texto local, horas y SLA calculados en vivo) */
function fbTicket(d) {
  const t = {};
  const fechas = {};
  Object.keys(d).forEach(k => {
    if (k.charAt(0) === '_') return;
    const v = d[k];
    if (v && typeof v.toDate === 'function') { fechas[k] = v.toDate(); t[k] = fmtLocal(fechas[k]); }
    else t[k] = v === null || v === undefined ? '' : v;
  });
  const meta = t.Tipo === 'Incidente' ? +Fb.general.META_INCIDENTES_H : t.Tipo === 'Requerimiento' ? +Fb.general.META_REQUERIMIENTOS_H : '';
  t.Horas_Respuesta = fechas.Fecha_Inicio_Atencion ? fbHorasHabiles(fechas.Fecha_Apertura, fechas.Fecha_Inicio_Atencion) : '';
  t.Horas_Resolucion = fechas.Fecha_Solucion ? fbHorasHabiles(fechas.Fecha_Apertura, fechas.Fecha_Solucion) : '';
  t.Meta_Horas = meta;
  t.Cumple_SLA = t.Tipo === 'Compra' || t.Estado === 'Anulado' ? 'N/A' : fechas.Fecha_Solucion ? (t.Horas_Resolucion <= meta ? 'SI' : 'NO') : 'PENDIENTE';
  t._vivo = true;
  if (d._errorArchivo) t._errorArchivo = d._errorArchivo;
  return t;
}
function fmtLocal(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function fbCtx() {
  return { db: Fb.db, FieldValue: firebase.firestore.FieldValue, correo: Fb.correo, usuario: Fb.usuario, esTI: esTI() };
}

function consultaTickets() {
  const c = Fb.db.collection('tickets');
  return veTodo() ? c : c.where('Solicitante_Email', '==', Fb.correo);
}

/**
 * Lista de tickets: los activos llegan al instante y se actualizan solos; los archivados (hoja) llegan después por Apps Script.
 * alCambiar(tickets, completo). Devuelve la función para dejar de escuchar.
 */
function fuenteTickets(alCambiar) {
  if (!Fb.activo) {
    srv('tickets.listar').then(ts => alCambiar(ts, true)).catch(fallo);
    return () => {};
  }
  let vivos = null, archivo = null;
  const emitir = () => {
    if (!vivos) return;
    const ids = new Set(vivos.map(t => t.ID_Ticket));
    alCambiar(vivos.concat((archivo || []).filter(t => !ids.has(t.ID_Ticket))), archivo !== null);
  };
  const quitar = consultaTickets().onSnapshot(s => { vivos = s.docs.map(x => fbTicket(x.data())); emitir(); }, e => fallo(fbError(e)));
  srv('tickets.historico').then(a => { archivo = a; emitir(); }).catch(e => { archivo = []; emitir(); fallo(e); });
  return quitar;
}

// ---------- Acciones de tickets que srv() atiende desde Firestore ----------

const RUTAS_FIREBASE = {
  async meta() {
    const a = await fbArranque();
    return a.meta;
  },
  async 'tickets.detalle'(d) {
    const ref = Fb.db.collection('tickets').doc(d.id);
    let doc;
    try { doc = await ref.get(); } catch (e) { doc = null; } // sin permiso o archivado
    if (!doc || !doc.exists) return viaAppsScript('tickets.detalle', d);
    const hs = await ref.collection('historial').get();
    const historial = hs.docs.map(x => { const h = x.data(); return { Fecha: h.Fecha ? fmtLocal(h.Fecha.toDate()) : '', Usuario: h.Usuario, Accion: h.Accion, Detalle: h.Detalle || '' }; });
    return { ticket: fbTicket(doc.data()), historial, mantenimientos: [], vivo: true };
  },
  async 'tickets.crear'(d) {
    const id = await TicketsFS.crear(fbCtx(), d.registro || {});
    return { ID_Ticket: id };
  },
  async 'tickets.accion'(d) {
    const doc = await Fb.db.collection('tickets').doc(d.id).get().catch(() => null);
    if (!doc || !doc.exists) return viaAppsScript('tickets.accion', d); // archivado: lecciones y reincidencia siguen por Apps Script
    const actual = doc.data();
    const datos = Object.assign({}, d.datos || {});
    if (d.tipo === 'editar') {
      // El formulario envía todo; solo se guardan los campos que el usuario cambió (las fechas del formulario no traen segundos)
      const fila = fbTicket(actual);
      Object.keys(datos).forEach(k => { if (String(datos[k] || '').slice(0, 16) === String(fila[k] || '').slice(0, 16)) delete datos[k]; });
      if (!Object.keys(datos).length) throw new Error('No cambió ningún dato.');
    }
    await TicketsFS.accion(fbCtx(), actual, d.tipo, datos);
    return { ok: true };
  },
  async pendientes(d) {
    if (d.recalcular) return viaAppsScript('pendientes', d);
    const r = await Fb.db.doc('resumen/pendientes-' + (App.meta.usuario.rol === 'Administrador' ? 'admin' : 'ti')).get().catch(() => null);
    return r && r.exists ? JSON.parse(r.data().json) : viaAppsScript('pendientes', d);
  },
  async tablero(d) {
    if (String(d.periodo) === String(new Date().getFullYear())) {
      const r = await Fb.db.doc('resumen/tablero-' + d.periodo).get().catch(() => null);
      if (r && r.exists) return JSON.parse(r.data().json);
    }
    return viaAppsScript('tablero', d);
  }
};
