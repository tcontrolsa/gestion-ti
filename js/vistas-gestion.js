/* Tablero y módulos de gestión (2.6.1, 2.6.2, 2.6.5, 2.6.8) */
'use strict';

// ======================= TABLERO =======================
const graficos = [];
function destruirGraficos() { while (graficos.length) graficos.pop().destroy(); }

function formatoIndicador(i) {
  if (i.Valor === null || i.Valor === undefined) return '—';
  if (i.Unidad === 'número') return String(i.Valor);
  return i.Unidad === '%' ? Fmt.pct(i.Valor) : Number(i.Valor).toFixed(2) + ' h';
}

ruta('/', async cont => {
  destruirGraficos();
  const anio = Fmt.hoy().slice(0, 4);
  let periodo = anio;
  const selector = h('select.btn', { 'aria-label': 'Periodo', onchange: e => { periodo = e.target.value; cargar(); } },
    h('option', { value: anio }, 'Año ' + anio),
    Array.from({ length: +Fmt.hoy().slice(5, 7) }, (_, i) => {
      const p = anio + '-' + String(i + 1).padStart(2, '0');
      return h('option', { value: p }, new Date(+anio, i, 1).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' }));
    }).reverse());
  cont.append(encabezado('Tablero de soporte tecnológico', 'Indicadores y alertas del proceso TC-GI-PC-2.6', selector));
  const zona = h('div');
  cont.append(zona);

  async function cargar() {
    destruirGraficos();
    vaciar(zona).append(h('div.vacio', 'Calculando…'));
    const d = await srv('tablero', { periodo });
    vaciar(zona);
    zona.append(h('div.kpis', d.indicadores.map(i => h('div.kpi' + (i.Cumple === true ? '.cumple' : i.Cumple === false ? '.nocumple' : ''), { title: i.Formula },
      h('div.nombre', i.Codigo + ' · ' + i.Nombre),
      h('div.valor', formatoIndicador(i)),
      h('div.meta', (i.Meta !== null ? 'Meta ' + i.Operador + ' ' + metaTexto(i) + ' · ' : '') + i.Base)))));
    const tk = d.tickets;
    zona.append(h('div.rejilla.r2',
      h('div.tarjeta', h('h2', 'Tickets por mes ' + periodo.slice(0, 4)), h('div.grafico', h('canvas#g-tickets', { 'aria-label': 'Tickets abiertos y resueltos por mes', role: 'img' }))),
      h('div.tarjeta', h('h2', 'Evolución de indicadores ' + periodo.slice(0, 4)), h('div.grafico', h('canvas#g-ind', { 'aria-label': 'Indicadores porcentuales por mes', role: 'img' })))));
    const alertas = d.alertas;
    zona.append(h('div.rejilla.r2', { style: 'margin-top:16px' },
      h('div.tarjeta', h('h2', 'Requiere atención (' + alertas.length + ')'),
        alertas.length ? h('ul.alertas', alertas.slice(0, 40).map(a => h('li', h('span.punto.p-' + a.nivel, { title: 'Prioridad ' + a.nivel }),
          h('div', h('div', h('b', a.titulo)), h('div.tenue.peq', a.modulo + ' · ' + a.detalle))))) : h('p.tenue', 'Sin alertas.'),
        alertas.length > 40 ? h('p.tenue.peq', '… y ' + (alertas.length - 40) + ' más') : null),
      h('div.tarjeta', h('h2', 'Tickets del periodo'),
        h('div.ficha',
          h('div.dato', h('div.et', 'Registrados'), h('div.vl', String(tk.delPeriodo))),
          h('div.dato', h('div.et', 'Activos hoy'), h('div.vl', String(tk.activos))),
          h('div.dato', h('div.et', 'Esperando conformidad'), h('div.vl', String(tk.porResolverConformidad)))),
        h('h3', { style: 'margin-top:14px' }, 'Por tipo'), barrasSimples(tk.porTipo),
        h('h3', { style: 'margin-top:14px' }, 'Por categoría'), barrasSimples(tk.porCategoria))));
    if (window.Chart) {
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      graficos.push(new Chart($('#g-tickets'), { type: 'bar', data: { labels: meses, datasets: [
        { label: 'Registrados', data: tk.mensual.map(m => m.abiertos), backgroundColor: '#94A3B8' },
        { label: 'Resueltos', data: tk.mensual.map(m => m.resueltos), backgroundColor: '#C5221F' }] },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } }));
      const pct = d.indicadores.filter(i => i.Unidad === '%');
      const colores = ['#C5221F', '#1D4ED8', '#15803D', '#B45309', '#7C3AED'];
      graficos.push(new Chart($('#g-ind'), { type: 'line', data: { labels: d.serie.map(s => meses[+s.periodo.slice(5) - 1]), datasets: pct.map((i, k) => ({
        label: i.Codigo + ' ' + i.Nombre, data: d.serie.map(s => s.valores[i.Codigo] === null || s.valores[i.Codigo] === undefined ? null : +(s.valores[i.Codigo] * 100).toFixed(1)),
        borderColor: colores[k % colores.length], backgroundColor: colores[k % colores.length], spanGaps: true, tension: .2 })) },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + ' %' } } } } }));
    }
  }
  await cargar();
});

function metaTexto(i) { return i.Unidad === '%' ? Fmt.pct(i.Meta) : i.Unidad === 'número' ? String(i.Meta) : i.Meta + ' h'; }

function barrasSimples(obj) {
  const items = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...items.map(i => i[1]));
  if (!items.length) return h('p.tenue', 'Sin datos');
  return h('div', items.map(([k, v]) => h('div', { style: 'display:grid;grid-template-columns:170px 1fr 34px;gap:8px;align-items:center;margin:4px 0' },
    h('span.peq', { title: k, style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, k),
    h('div', { style: 'background:#F1F5F9;border-radius:4px;height:10px' }, h('div', { style: 'height:10px;border-radius:4px;background:#C5221F;width:' + (v / max * 100) + '%' })),
    h('span.peq.derecha', String(v)))));
}

// ======================= 2.6.1 ACTIVOS Y MANTENIMIENTO =======================
ruta('/activos', cont => vistaEntidad(cont, 'activos', {
  filtros: [{ key: 'Categoria', label: 'Categoría' }, { key: 'Estado', label: 'Estado' }, { key: 'Departamento', label: 'Departamento' }],
  orden: 'Codigo_Activo', desc: false,
  acciones: a => [{ texto: 'Historial', accion: () => { historialActivo(a); } }]
}));

async function historialActivo(a) {
  const [mants, inst] = await Promise.all([srv('listar', { entidad: 'mantenimientos' }), srv('listar', { entidad: 'instalaciones' })]);
  await cargarRefs(['software']);
  const sw = Object.fromEntries((App.refs.software || []).map(s => [s.ID_Software, s.Nombre]));
  const m = mants.filter(x => x.Codigo_Activo === a.Codigo_Activo).sort((x, y) => (y.Fecha_Ejecucion || '').localeCompare(x.Fecha_Ejecucion || ''));
  const i = inst.filter(x => x.Codigo_Activo === a.Codigo_Activo);
  modal({ titulo: 'Historial ' + a.Codigo_Activo, cuerpo: h('div',
    h('h3', 'Mantenimientos (' + m.length + ')'),
    m.length ? h('ol.linea-tiempo', m.map(x => h('li', h('div.cuando', Fmt.fecha(x.Fecha_Ejecucion || x.Fecha_Programada) + ' · ' + x.Tipo_Mantenimiento + ' · ' + x.Estado), h('div', x.Actividades_Realizadas)))) : h('p.tenue', 'Sin mantenimientos registrados.'),
    h('h3', 'Software instalado (' + i.length + ')'),
    i.length ? h('ul', i.map(x => h('li', (sw[x.ID_Software] || x.ID_Software) + (x.Version_Instalada ? ' ' + x.Version_Instalada : '')))) : h('p.tenue', 'Sin software registrado.')) });
}

ruta('/cronograma', cont => {
  const anio = +Fmt.hoy().slice(0, 4);
  return vistaEntidad(cont, 'cronograma', {
    filtros: [{ key: 'Estado', label: 'Estado' }, { key: 'Tipo_Mantenimiento', label: 'Tipo' }],
    orden: 'Fecha_Programada', desc: false,
    antes: h('p.tenue', 'Programe, notifique a los usuarios y registre la ejecución. La ejecución crea el registro TC-GI-RE-2.6.1-01 y actualiza el inventario.'),
    sinEditar: p => p.Estado === 'Ejecutado',
    barra: recargar => esTI() ? [
      h('button.btn', { onclick: async () => {
        if (!(await confirmar('Generar cronograma ' + anio, 'Se programará el mantenimiento preventivo de los activos con periodicidad para las ventanas que aún no terminan. No se duplican programaciones existentes.'))) return;
        try { const r = await srv('mantenimiento.generar', { anio }); aviso(r.creados + ' programaciones creadas (' + r.omitidos + ' ya existían)', 'ok'); await recargar(); } catch (e) { fallo(e); }
      } }, 'Generar cronograma ' + anio),
      h('button.btn', { onclick: async () => {
        try { const r = await srv('mantenimiento.notificar'); aviso(r.enviados + ' usuarios notificados' + (r.sinCorreo.length ? '. Sin correo: ' + r.sinCorreo.join(', ') : ''), 'ok'); await recargar(); } catch (e) { fallo(e); }
      } }, 'Notificar próximos')] : [],
    acciones: (p, recargar) => (esTI() && (p.Estado === 'Programado' || p.Estado === 'Reprogramado')) ? [{ texto: 'Registrar ejecución', primario: false, accion: () => { ejecutarProgramacion(p, recargar); } }] : []
  });
});

function ejecutarProgramacion(p, recargar) {
  const F = Ent('mantenimientos').fields;
  const f = formulario(F, { Fecha_Ejecucion: Fmt.hoy(), Actividades_Realizadas: p.Actividad, Verificacion: 'Operativo' },
    { campos: ['Fecha_Ejecucion', 'Verificacion', 'Duracion_Horas', 'Impacto_Potencial', 'Autorizacion', 'Actividades_Realizadas', 'Observaciones'], requeridos: ['Fecha_Ejecucion', 'Verificacion'] });
  modal({ titulo: 'Ejecución ' + p.ID_Programacion + ' — ' + p.Codigo_Activo, cuerpo: h('div',
    h('p.tenue.peq', 'Antes de intervenciones mayores (reemplazo de partes, reinstalación, corte de servicio) respalde la información y registre quién autorizó.'), f.el),
    botones: [{ texto: 'Cancelar' }, { texto: 'Registrar', primario: true, accion: async () => {
      const m = await srv('mantenimiento.ejecutar', { id: p.ID_Programacion, datos: f.leer() });
      aviso('Registrado ' + m.ID_Mantenimiento, 'ok');
      await recargar();
    } }] });
}

ruta('/mantenimientos', cont => vistaEntidad(cont, 'mantenimientos', {
  filtros: [{ key: 'Tipo_Mantenimiento', label: 'Tipo' }, { key: 'Estado', label: 'Estado' }],
  orden: 'Fecha_Ejecucion', desc: true,
  antes: h('p.tenue', 'Los preventivos se registran desde el cronograma. Los correctivos deben tener un ticket (Código del incidente).'),
  valoresNuevo: () => ({ Tipo_Mantenimiento: 'Correctivo', Fecha_Ejecucion: Fmt.hoy(), Estado: 'Ejecutado', Verificacion: 'Operativo', Prioridad: 'Media' })
}));

// ======================= 2.6.5 SOFTWARE =======================
ruta('/software', async cont => {
  let pest = 0;
  const zona = h('div');
  const nombres = ['Inventario y licencias', 'Software por equipo', 'Actualizaciones y licenciamiento (RE-2.6.5-02)'];
  const barra = h('div.pestanas');
  const pintar = async () => {
    vaciar(barra); nombres.forEach((n, i) => barra.append(h('button', { class: i === pest ? 'activo' : '', onclick: () => { pest = i; pintar(); } }, n)));
    vaciar(zona);
    if (pest === 0) await vistaEntidad(zona, 'software', { sub: true,
      cargar: () => srv('software.resumen'),
      columnas: columnasDe('software', [
        { key: 'Instalaciones', label: 'Instalado en', num: true },
        { key: 'Disponibles', label: 'Disponibles', num: true, fmt: v => v === '' ? '' : (v < 0 ? h('span.insignia.i-mal', String(v)) : String(v)) },
        { key: 'Estado_Licencia', label: 'Licencia', fmt: insignia }]),
      filtros: [{ key: 'Estado_Licencia', label: 'Licencia' }, { key: 'Tipo_Licencia', label: 'Tipo' }, { key: 'Autorizado', label: 'Autorizado' }], orden: 'Nombre', desc: false
    });
    if (pest === 1) await vistaEntidad(zona, 'instalaciones', { sub: true, orden: 'Codigo_Activo', desc: false });
    if (pest === 2) await vistaEntidad(zona, 'registroSoftware', { sub: true,
      filtros: [{ key: 'Estado', label: 'Estado' }, { key: 'Accion', label: 'Acción' }],
      antes: h('p.tenue', 'Actualizaciones críticas de seguridad: de inmediato. Funcionales: en ventanas programadas y con respaldo previo.'),
      valoresNuevo: () => ({ Fecha_Registro: Fmt.hoy(), Estado: 'Pendiente', Prioridad: 'Media' })
    });
  };
  cont.append(encabezado('Software y licencias', 'TC-GI-PD-2.6.5 Actualización, licenciamiento y control de software'), barra, zona);
  await pintar();
});

// ======================= 2.6.2 ACCESOS =======================
ruta('/accesos', async cont => {
  let pest = 0;
  const zona = h('div');
  const nombres = ['Solicitudes (RE-2.6.2-01)', 'Cuentas vigentes', 'Revisiones periódicas'];
  const barra = h('div.pestanas');
  const pintar = async () => {
    vaciar(barra); nombres.forEach((n, i) => barra.append(h('button', { class: i === pest ? 'activo' : '', onclick: () => { pest = i; pintar(); } }, n)));
    vaciar(zona);
    if (pest === 0) await vistaEntidad(zona, 'accesos', { sub: true,
      filtros: [{ key: 'Estado', label: 'Estado' }, { key: 'Sistema', label: 'Sistema' }, { key: 'Accion', label: 'Acción' }],
      orden: 'Fecha_Solicitud',
      antes: h('p.tenue', 'Alta: con autorización formal. Modificación: ante cambio de cargo o funciones. Baja: revocar de inmediato en todos los sistemas.'),
      campos: ['Usuario', 'Email', 'Sistema', 'Codigo_Activo', 'Accion', 'Rol_Permisos', 'Motivo', 'Autorizado_Por', 'Fecha_Solicitud', 'ID_Ticket', 'Observaciones'],
      valoresNuevo: () => ({ Fecha_Solicitud: Fmt.hoy(), Accion: 'Alta' }),
      sinEditar: a => a.Estado !== 'Pendiente',
      acciones: (a, recargar) => (esTI() && a.Estado === 'Pendiente') ? [
        { texto: 'Rechazar', peligro: true, accion: () => { ejecutarAcceso(a, true, recargar); } },
        { texto: 'Ejecutar ' + a.Accion.toLowerCase(), accion: () => { ejecutarAcceso(a, false, recargar); } }] : []
    });
    if (pest === 1) {
      const cuentas = await srv('accesos.cuentas');
      zona.append(h('p.tenue', 'Cuentas cuya última acción ejecutada es un alta o una modificación. Revíselas al menos cada 6 meses.'),
        tabla({ columnas: [{ key: 'Sistema', label: 'Sistema' }, { key: 'Usuario', label: 'Usuario' }, { key: 'Email', label: 'Correo' }, { key: 'Rol_Permisos', label: 'Rol / permisos' }, { key: 'Desde', label: 'Desde', fmt: Fmt.fecha }, { key: 'Codigo', label: 'Registro' }],
          filas: cuentas, filtros: [{ key: 'Sistema', label: 'Sistema' }], orden: 'Sistema', desc: false, vacio: 'Aún no hay altas ejecutadas registradas.' }));
    }
    if (pest === 2) await vistaEntidad(zona, 'revisionesAccesos', { sub: true, valoresNuevo: () => ({ Fecha: Fmt.hoy(), Resultado: 'Conforme' }), orden: 'Fecha' });
  };
  cont.append(encabezado('Usuarios y accesos', 'TC-GI-PD-2.6.2 Control de usuarios y accesos (Odoo, Office 365, ERP)'), barra, zona);
  await pintar();
});

function ejecutarAcceso(a, rechazar, recargar) {
  const F = Ent('accesos').fields;
  const f = formulario(F, Object.assign({}, a, { Fecha_Asignacion: Fmt.hoy() }), {
    campos: rechazar ? ['Observaciones'] : (a.Accion === 'Baja' ? ['Fecha_Asignacion', 'Observaciones'] : ['Fecha_Asignacion', 'Rol_Permisos', 'Notificado_Usuario', 'Observaciones']),
    requeridos: rechazar ? ['Observaciones'] : (a.Accion === 'Baja' ? ['Fecha_Asignacion'] : ['Fecha_Asignacion', 'Rol_Permisos'])
  });
  modal({ titulo: (rechazar ? 'Rechazar ' : 'Ejecutar ') + a.Codigo, cuerpo: h('div',
    h('p', h('b', a.Accion), ' de ', h('b', a.Usuario), ' en ', h('b', a.Sistema)),
    !rechazar && a.Accion === 'Baja' ? h('p.tenue.peq', 'Confirme la desactivación en todos los sistemas del usuario.') : null,
    !rechazar && a.Accion !== 'Baja' ? h('p.tenue.peq', 'Asigne solo los permisos necesarios y notifique al usuario sus credenciales y las políticas de uso.') : null, f.el),
    botones: [{ texto: 'Cancelar' }, { texto: rechazar ? 'Rechazar' : 'Ejecutar', primario: !rechazar, peligro: rechazar, accion: async () => {
      const d = f.leer();
      await srv('accesos.ejecutar', { id: a.Codigo, datos: Object.assign(d, { rechazar, Notificado_Usuario: d.Notificado_Usuario === 'SI' }) });
      aviso('Solicitud ' + (rechazar ? 'rechazada' : 'ejecutada'), 'ok');
      await recargar();
    } }] });
}

// ======================= 2.6.8 DISPONIBILIDAD Y RESPALDOS =======================
ruta('/disponibilidad', async cont => {
  let pest = 0;
  const zona = h('div');
  const nombres = ['Disponibilidad mensual', 'Eventos de falla', 'Servicios medidos'];
  const barra = h('div.pestanas');
  const pintar = async () => {
    vaciar(barra); nombres.forEach((n, i) => barra.append(h('button', { class: i === pest ? 'activo' : '', onclick: () => { pest = i; pintar(); } }, n)));
    vaciar(zona);
    if (pest === 0) await vistaEntidad(zona, 'disponibilidadMensual', { sub: true,
      filtros: [{ key: 'Periodo', label: 'Periodo' }, { key: 'Servicio', label: 'Servicio' }], orden: 'Periodo',
      antes: h('p.tenue', 'Consolidado por servicio y mes. Los meses nuevos se calculan desde los eventos de falla (menú "Consolidar mes" o la tarea automática del día 1).'),
      barra: recargar => esTI() ? [h('button.btn', { onclick: () => consolidarMes(recargar) }, 'Consolidar mes')] : []
    });
    if (pest === 1) await vistaEntidad(zona, 'eventos', { sub: true,
      filtros: [{ key: 'Servicio', label: 'Servicio' }, { key: 'Tipo_Evento', label: 'Tipo' }], orden: 'Fecha_Inicio',
      valoresNuevo: () => ({ Fecha_Inicio: Fmt.ahora(), Tipo_Evento: 'No planificado' })
    });
    if (pest === 2) await vistaEntidad(zona, 'servicios', { sub: true, orden: 'Servicio', desc: false });
  };
  cont.append(encabezado('Disponibilidad de servicios', 'TC-GI-PD-2.6.8 — meta configurable en la hoja Configuracion'), barra, zona);
  await pintar();
});

function consolidarMes(recargar) {
  const hoy = new Date();
  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const inp = h('input', { type: 'month', id: 'pm', value: anterior.getFullYear() + '-' + String(anterior.getMonth() + 1).padStart(2, '0') });
  modal({ titulo: 'Consolidar disponibilidad', chico: true, cuerpo: h('div.form', { style: 'grid-template-columns:1fr' },
    h('div.campo', h('label', { for: 'pm' }, 'Mes'), inp), h('p.tenue.peq', 'Calcula las horas planificadas y fuera de servicio de cada servicio desde los eventos registrados. No reemplaza los registros importados o manuales.')),
    botones: [{ texto: 'Cancelar' }, { texto: 'Consolidar', primario: true, accion: async () => {
      const r = await srv('disponibilidad.consolidar', { periodo: inp.value });
      aviso(r.creados + ' creados, ' + r.actualizados + ' actualizados, ' + r.respetados + ' conservados', 'ok');
      await recargar();
    } }] });
}

ruta('/respaldos', cont => vistaEntidad(cont, 'respaldos', {
  filtros: [{ key: 'Tipo_Informacion', label: 'Información' }, { key: 'Resultado', label: 'Resultado' }, { key: 'Es_Prueba_Restauracion', label: 'Prueba de restauración' }],
  orden: 'Fecha',
  antes: h('p.tenue', 'Política: base de datos incremental cada 4 h, servidor completo y documentos a diario, prueba de restauración al menos semestral.'),
  valoresNuevo: () => ({ Fecha: Fmt.ahora(), Es_Prueba_Restauracion: 'NO', Resultado: 'Exitoso' })
}));

// ======================= 2.6.8 INDICADORES =======================
ruta('/indicadores', async cont => {
  let pest = 0;
  const zona = h('div');
  const nombres = ['Medición del periodo', 'Seguimiento (RE-2.6.8-01)', 'Mediciones registradas', 'Definición de indicadores'];
  const barra = h('div.pestanas');
  const pintar = async () => {
    vaciar(barra); nombres.forEach((n, i) => barra.append(h('button', { class: i === pest ? 'activo' : '', onclick: () => { pest = i; pintar(); } }, n)));
    vaciar(zona);
    if (pest === 0) await medicionPeriodo(zona, () => { pest = 1; pintar(); });
    if (pest === 1) await vistaEntidad(zona, 'seguimiento', { sub: true,
      filtros: [{ key: 'Estado', label: 'Estado' }, { key: 'Codigo_Indicador', label: 'Indicador' }], orden: 'Fecha_Registro',
      antes: h('p.tenue', 'Cuando un indicador no cumple, se abre un seguimiento: analice la causa, defina la acción correctiva y valide su eficacia para cerrarlo.'),
      valoresNuevo: () => ({ Fecha_Registro: Fmt.hoy(), Estado: 'Abierta', Periodo: Fmt.periodoActual() })
    });
    if (pest === 2) await vistaEntidad(zona, 'mediciones', { sub: true, filtros: [{ key: 'Periodo', label: 'Periodo' }, { key: 'Codigo_Indicador', label: 'Indicador' }, { key: 'Cumple', label: 'Cumple' }], orden: 'Periodo', sinNuevo: true });
    if (pest === 3) await vistaEntidad(zona, 'indicadores', { sub: true, orden: 'Codigo', desc: false, sinNuevo: true });
  };
  cont.append(encabezado('Indicadores de desempeño', 'TC-GI-PD-2.6.8 Monitoreo de indicadores'), barra, zona);
  await pintar();
});

async function medicionPeriodo(zona, verSeguimiento) {
  const hoy = new Date();
  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const inp = h('input', { type: 'month', 'aria-label': 'Periodo', value: anterior.getFullYear() + '-' + String(anterior.getMonth() + 1).padStart(2, '0'), onchange: () => calcular() });
  const res = h('div');
  const registrar = esTI() ? h('button.btn.primario', { onclick: async () => {
    if (!(await confirmar('Registrar medición ' + inp.value, 'Se guardarán los valores del periodo y se abrirá un seguimiento por cada indicador que no cumpla su meta.'))) return;
    try { const r = await srv('indicadores.registrar', { periodo: inp.value }); aviso('Medición registrada. Seguimientos abiertos: ' + r.seguimientosAbiertos, 'ok'); if (r.seguimientosAbiertos) verSeguimiento(); } catch (e) { fallo(e); }
  } }, 'Registrar medición del periodo') : null;
  zona.append(h('div.filtros', h('label.peq', 'Periodo '), inp, registrar), res);
  async function calcular() {
    vaciar(res).append(h('div.vacio', 'Calculando…'));
    const ind = await srv('indicadores.calcular', { periodo: inp.value });
    vaciar(res).append(tabla({ buscar: false, filas: ind, orden: 'Codigo', desc: false, columnas: [
      { key: 'Codigo', label: 'Código' }, { key: 'Nombre', label: 'Indicador' }, { key: 'Procedimiento', label: 'Proc.' },
      { key: 'Valor', label: 'Valor', num: true, fmt: (v, i) => formatoIndicador(i) },
      { key: 'Meta', label: 'Meta', num: true, fmt: (v, i) => v === null ? '—' : i.Operador + ' ' + metaTexto(i) },
      { key: 'Cumple', label: 'Cumple', fmt: v => v === null ? h('span.tenue', 'Sin datos') : insignia(v ? 'SI' : 'NO') },
      { key: 'Base', label: 'Base de cálculo' }],
      alClic: i => modal({ titulo: i.Codigo + ' — ' + i.Nombre, chico: true, cuerpo: h('div', h('h3', 'Metodología'), h('p', i.Formula), h('h3', 'Base'), h('p', i.Base)) }) }));
  }
  await calcular();
}

// ======================= ADMINISTRACIÓN =======================
ruta('/usuarios', cont => vistaEntidad(cont, 'usuarios', {
  filtros: [{ key: 'Rol_App', label: 'Rol' }, { key: 'Estado', label: 'Estado' }, { key: 'Departamento', label: 'Departamento' }],
  orden: 'Nombre', desc: false,
  antes: h('p.tenue', 'Solo los usuarios activos con correo pueden ingresar (reciben un código en su correo). Roles: Solicitante registra y sigue sus tickets; Especialista TI gestiona todo; Auditor SGI consulta y registra seguimientos; Administrador además gestiona usuarios y configuración.'),
  valoresNuevo: () => ({ Rol_App: 'Solicitante', Estado: 'Activo' })
}));

ruta('/configuracion', async cont => {
  cont.append(encabezado('Configuración', 'Jornada laboral, feriados, metas de los indicadores y notificaciones'));
  const params = App.meta.config || [];
  const inputs = {};
  cont.append(h('div.tarjeta', h('div.form', params.map(p => {
    const id = 'cfg-' + p.clave;
    inputs[p.clave] = h('input', { id, value: p.valor });
    return h('div.campo' + (p.clave === 'FERIADOS' ? '.ancho' : ''), h('label', { for: id }, p.clave), inputs[p.clave], h('div.ayuda', p.descripcion));
  })), h('div.acciones', { style: 'margin-top:16px;justify-content:flex-end' }, h('button.btn.primario', { onclick: async () => {
    const cambios = {};
    params.forEach(p => { if (inputs[p.clave].value !== String(p.valor)) cambios[p.clave] = inputs[p.clave].value.trim(); });
    if (!Object.keys(cambios).length) return aviso('No hay cambios');
    try { await srv('config.guardar', { parametros: cambios }); App.meta = await srv('meta'); aviso('Configuración guardada', 'ok'); } catch (e) { fallo(e); }
  } }, 'Guardar cambios'))));
  cont.append(h('p.tenue.peq', { style: 'margin-top:12px' }, 'Los catálogos (listas desplegables) se editan directamente en la hoja Catalogos; luego use el menú Gestión TI → Reaplicar validaciones.'));
});
