/* Arranque: login, menú según rol y navegación */
'use strict';

const CLAVE_SESION = 'gti_token';

function menuSegunRol() {
  const rol = App.meta.usuario.rol;
  const propios = ['Mis tickets', [['Mis solicitudes', '/mis-tickets'], ['Nueva solicitud', '/tickets-nuevo'], ['Base de conocimiento', '/conocimiento']]];
  if (rol === 'Solicitante') return [propios];
  if (rol === 'Talento Humano') return [propios, ['2.6.7 Capacitación', [['Capacitaciones', '/capacitaciones']]]];
  const grupos = [
    ['General', [['Tablero', '/']]],
    ['2.6.9 Incidentes y requerimientos', [['Tickets', '/tickets'], ['Base de conocimiento', '/conocimiento']]],
    ['2.6.1 Mantenimiento', [['Inventario de activos', '/activos'], ['Cronograma', '/cronograma'], ['Registro de mantenimiento', '/mantenimientos']]],
    ['2.6.5 Software', [['Software y licencias', '/software']]],
    ['2.6.2 Accesos', [['Usuarios y accesos', '/accesos']]],
    ['2.6.8 Monitoreo', [['Indicadores', '/indicadores'], ['Disponibilidad', '/disponibilidad'], ['Respaldos', '/respaldos']]],
    ['2.6.7 Capacitación', [['Capacitaciones', '/capacitaciones']]],
    ['2.6.4 Seguridad', [['Seguridad de la información', '/seguridad']]],
    ['2.6.3 Infraestructura', [['Necesidades y adquisiciones', '/infraestructura']]],
    ['2.6.6 Proyectos', [['Proyectos', '/proyectos']]]
  ];
  if (rol === 'Administrador') grupos.push(['Administración', [['Usuarios de la app', '/usuarios'], ['Configuración', '/configuracion']]]);
  return grupos;
}

function pintarLayout() {
  const u = App.meta.usuario;
  const nav = h('nav.nav', { 'aria-label': 'Menú principal' });
  menuSegunRol().forEach(([grupo, items]) => {
    nav.append(h('div.nav-grupo', grupo));
    items.forEach(([texto, r]) => nav.append(h('a', { href: '#' + r, 'data-ruta': r, onclick: e => { e.preventDefault(); ir(r); } }, h('span', texto), h('span.conteo.oculto', { 'data-conteo': r }))));
  });
  const lateral = h('aside.lateral', h('div.marca', h('div.logo', 'TC'), h('div', 'Gestión TI', h('div.peq', { style: 'color:#94A3B8;font-weight:400' }, 'Soporte tecnológico'))), nav);
  const barra = h('header.barra',
    h('button.btn.menu-movil', { 'aria-label': 'Abrir menú', onclick: () => lateral.classList.toggle('abierto') }, '☰'),
    h('div.tenue.peq', 'Proceso de Soporte Tecnológico TC-GI-PC-2.6'),
    h('div.usuario', h('div.derecha', h('div', u.nombre), h('div.tenue.peq', u.rol)),
      h('button.btn.chico', { onclick: salir }, 'Salir')));
  vaciar(document.body).append(h('div.app', lateral, h('div.principal', barra, h('main.contenido#contenido', { tabindex: '-1' }))));
  actualizarConteos();
}

/** Número de tickets activos en el menú */
function actualizarConteos() {
  if (!veTodo()) return;
  srv('tickets.listar').then(ts => {
    const n = ts.filter(t => ESTADOS_ACTIVOS.includes(t.Estado)).length;
    const el = document.querySelector('[data-conteo="/tickets"]');
    if (el) { el.textContent = n; el.classList.toggle('oculto', !n); }
  }).catch(() => {});
}

// ---------- Login ----------
function pintarLogin(mensaje) {
  let email = '';
  const caja = h('div.login-caja');
  const paso1 = () => {
    const inp = h('input', { type: 'email', id: 'lg-email', autocomplete: 'email', placeholder: 'nombre@tcontrolsa.com', required: true, value: email });
    const enviar = async e => {
      e.preventDefault();
      email = inp.value.trim();
      const b = form.querySelector('button'); b.disabled = true;
      try { const r = await srv('auth.solicitarCodigo', { email }); aviso(r.mensaje); paso2(); }
      catch (err) { fallo(err); b.disabled = false; }
    };
    const form = h('form', { onsubmit: enviar },
      h('div.campo', h('label', { for: 'lg-email' }, 'Correo corporativo'), inp),
      h('button.btn.primario', { type: 'submit', style: 'width:100%;justify-content:center;margin-top:14px' }, 'Enviarme un código'));
    vaciar(caja).append(marcaLogin(), h('p', mensaje || 'Ingrese su correo. Le enviaremos un código de acceso de un solo uso; no necesita contraseña.'), form);
    setTimeout(() => inp.focus(), 20);
  };
  const paso2 = () => {
    const inp = h('input', { id: 'lg-codigo', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, pattern: '\\d{6}', placeholder: '000000', style: 'letter-spacing:6px;font-size:20px;text-align:center' });
    const form = h('form', { onsubmit: async e => {
      e.preventDefault();
      const b = form.querySelector('button[type=submit]'); b.disabled = true;
      try {
        const r = await srv('auth.verificarCodigo', { email, codigo: inp.value });
        App.token = r.token;
        try { sessionStorage.setItem(CLAVE_SESION, r.token); } catch (x) { /* sin almacenamiento: la sesión dura lo que la pestaña */ }
        await iniciarApp();
      } catch (err) { fallo(err); b.disabled = false; inp.select(); }
    } },
      h('div.campo', h('label', { for: 'lg-codigo' }, 'Código enviado a ' + email), inp),
      h('button.btn.primario', { type: 'submit', style: 'width:100%;justify-content:center;margin-top:14px' }, 'Ingresar'),
      h('button.btn', { type: 'button', style: 'width:100%;justify-content:center;margin-top:8px', onclick: paso1 }, 'Usar otro correo'));
    vaciar(caja).append(marcaLogin(), h('p', 'Revise su bandeja de entrada (y el correo no deseado). El código vence en 10 minutos.'), form);
    setTimeout(() => inp.focus(), 20);
  };
  vaciar(document.body).append(h('main.login', caja));
  paso1();
}
const marcaLogin = () => h('div.login-marca', h('div.logo', 'TC'), h('div', h('h1', 'Gestión TI'), h('div.tenue.peq', 'Tcontrol · Soporte tecnológico')));

async function salir() {
  try { await srv('auth.cerrarSesion', { token: App.token }); } catch (e) { /* ya expirada */ }
  cerrarSesionLocal();
}

function cerrarSesionLocal() {
  App.token = null; App.meta = null; App.refs = {};
  try { sessionStorage.removeItem(CLAVE_SESION); } catch (e) { /* nada */ }
  pintarLogin('Sesión cerrada. Ingrese su correo para volver a entrar.');
}

// ---------- Arranque ----------
async function iniciarApp() {
  App.meta = await srv('meta');
  App.refs = {};
  pintarLayout();
  mostrarRuta(rutaInicial());
}

function rutaInicial() { return rutaActual() === '/' ? inicioSegunRol() : rutaActual(); }

document.addEventListener('DOMContentLoaded', async () => {
  window.addEventListener('hashchange', () => mostrarRuta(rutaActual()));
  try { App.token = sessionStorage.getItem(CLAVE_SESION); } catch (e) { App.token = null; }
  if (!App.token) return pintarLogin();
  try { await iniciarApp(); } catch (e) { cerrarSesionLocal(); }
});
