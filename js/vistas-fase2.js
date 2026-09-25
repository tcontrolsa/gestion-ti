/* Fase 2: 2.6.7 Capacitación y 2.6.4 Seguridad de la información */
'use strict';

/** Pestañas estándar: [[nombre, async fn(zona)]] */
async function pestanas(cont, titulo, codigo, lista) {
  let actual = Math.min(tomarPestana(), lista.length - 1);
  const barra = h('div.pestanas', { role: 'tablist' });
  const zona = h('div');
  const pintar = async () => {
    vaciar(barra);
    lista.forEach(([n], i) => barra.append(h('button', { role: 'tab', 'aria-selected': String(i === actual), class: i === actual ? 'activo' : '', onclick: () => { actual = i; pintar(); } }, n)));
    vaciar(zona);
    await lista[actual][1](zona);
  };
  cont.append(encabezado(titulo, codigo), barra, zona);
  await pintar();
}

// ======================= 2.6.7 CAPACITACIÓN =======================
ruta('/capacitaciones', cont => pestanas(cont, 'Capacitación y soporte a usuarios', 'TC-GI-PD-2.6.7 — cronograma, registro y encuesta de satisfacción', [
  ['Cronograma y registro', zona => vistaEntidad(zona, 'capacitaciones', {
    sub: true, orden: 'Fecha_Programada',
    filtros: [{ key: 'Estado', label: 'Estado' }, { key: 'Categoria', label: 'Categoría' }, { key: 'Modalidad', label: 'Modalidad' }],
    antes: h('p.tenue', 'La capacitación debe responder a una necesidad real (encuestas, incidentes frecuentes, nuevas herramientas). Al realizarla registre la asistencia y la evidencia; luego las encuestas y las recomendaciones.'),
    campos: ['Tema', 'Objetivo', 'Categoria', 'Origen_Necesidad', 'Solicitado_Por', 'ID_Ticket', 'Fecha_Programada', 'Duracion_Horas', 'Modalidad', 'Dirigido_A', 'Facilitador', 'Lugar_Plataforma', 'Convocados', 'Estado'],
    valoresNuevo: () => ({ Estado: 'Planificada', Modalidad: 'Virtual', Origen_Necesidad: 'Plan anual', Facilitador: App.meta.responsableTI }),
    acciones: (c, recargar) => {
      const b = [];
      if (Ent('capacitaciones').escribir && ['Planificada', 'Confirmada', 'Reprogramada'].includes(c.Estado)) b.push({ texto: 'Registrar ejecución', accion: () => { registrarEjecucionCapacitacion(c, recargar); } });
      if (c.Estado === 'Realizada' && Ent('encuestas') && Ent('encuestas').escribir) b.push({ texto: 'Registrar encuesta', accion: () => { editarRegistro('encuestas', null, { valoresNuevo: () => ({ ID_Capacitacion: c.ID_Capacitacion, Fecha: Fmt.hoy() }) }, recargar); } });
      if (Number(c.Encuestas) > 0) b.push({ texto: 'Resultados de la encuesta', accion: () => { resultadosEncuesta(c); } });
      return b;
    }
  })],
  ['Encuestas de satisfacción (RE-2.6.7-02)', zona => vistaEntidad(zona, 'encuestas', {
    sub: true, orden: 'Fecha', sinNuevo: true, filtros: [{ key: 'ID_Capacitacion', label: 'Capacitación' }],
    antes: h('p.tenue', 'Las encuestas se registran desde la capacitación realizada (botón "Registrar encuesta").')
  })]
]));

function registrarEjecucionCapacitacion(c, recargar) {
  const F = Ent('capacitaciones').fields;
  const f = formulario(F, Object.assign({}, c, { Fecha_Ejecucion: Fmt.hoy() }), {
    campos: ['Fecha_Ejecucion', 'Convocados', 'Asistentes', 'Evidencia', 'Recomendaciones', 'Acciones_Tomadas'],
    requeridos: ['Fecha_Ejecucion', 'Asistentes', 'Evidencia']
  });
  modal({ titulo: 'Ejecución — ' + c.Tema, cuerpo: h('div', h('p.tenue.peq', 'Adjunte o indique la lista de asistencia como evidencia. Luego registre las encuestas de satisfacción.'), f.el),
    botones: [{ texto: 'Cancelar' }, { texto: 'Marcar como realizada', primario: true, accion: async () => {
      await srv('guardar', { entidad: 'capacitaciones', id: c.ID_Capacitacion, registro: Object.assign(f.leer(), { Estado: 'Realizada' }) });
      aviso('Capacitación registrada', 'ok');
      await recargar();
    } }] });
}

async function resultadosEncuesta(c) {
  const r = await srv('capacitaciones.encuestas', { id: c.ID_Capacitacion });
  const colores = { 'Muy satisfecho': '#15803D', 'Satisfecho': '#4ADE80', 'Neutral': '#CBD5E1', 'Insatisfecho': '#DC2626' };
  modal({ titulo: 'Encuesta — ' + c.Tema, cuerpo: h('div',
    h('p', r.total + ' encuesta(s) · satisfacción ', h('b', Fmt.pct(c.Satisfaccion))),
    r.preguntas.map(p => {
      const total = Object.values(p.distribucion).reduce((a, b) => a + b, 0) || 1;
      return h('div', { style: 'margin:10px 0' }, h('div.peq', p.pregunta),
        h('div', { style: 'display:flex;height:14px;border-radius:4px;overflow:hidden;background:#F1F5F9;margin-top:4px', role: 'img',
          'aria-label': Object.entries(p.distribucion).map(([k, v]) => k + ': ' + v).join(', ') },
          Object.entries(p.distribucion).filter(([, v]) => v).map(([k, v]) => h('div', { title: k + ': ' + v, style: 'width:' + (v / total * 100) + '%;background:' + colores[k] }))),
        h('div.tenue.peq', Object.entries(p.distribucion).map(([k, v]) => k + ' ' + v).join(' · ')));
    }),
    r.comentarios.length ? [h('h3', 'Comentarios'), h('ul', r.comentarios.map(x => h('li', x.texto + (x.participante ? ' — ' + x.participante : ''))))] : null) });
}

// ======================= 2.6.4 SEGURIDAD =======================
ruta('/seguridad', cont => pestanas(cont, 'Seguridad de la información', 'TC-GI-PD-2.6.4 — incidentes, auditorías y riesgos (ISO 27001 / LOPDP)', [
  ['Incidentes y lecciones (RE-2.6.4-04)', zona => vistaEntidad(zona, 'incidentesSeguridad', {
    sub: true, orden: 'Fecha_Deteccion',
    filtros: [{ key: 'Estado', label: 'Estado' }, { key: 'Impacto', label: 'Impacto' }, { key: 'Tipo_Incidente', label: 'Tipo' }],
    antes: h('p.tenue', 'Documente la detección, el análisis, la respuesta y el aprendizaje. Si se afectan datos personales, gestione la notificación a la Autoridad de Protección de Datos (LOPDP).'),
    valoresNuevo: () => ({ Fecha_Deteccion: Fmt.ahora(), Estado: 'Detectado', Datos_Personales: 'NO', Impacto: 'Medio' })
  })],
  ['Auditorías a usuarios', zona => vistaEntidad(zona, 'auditorias', {
    sub: true, orden: 'Fecha',
    filtros: [{ key: 'Estado', label: 'Estado' }, { key: 'Nivel_Riesgo', label: 'Riesgo' }, { key: 'Area', label: 'Área' }],
    antes: h('p.tenue', 'Checklist de 10 criterios del Plan de auditorías. Cada "No cumple" genera una no conformidad con seguimiento. Nivel de riesgo: Bajo ≥ 90 % de cumplimiento sin fallas en antivirus, MFA o software no autorizado; Medio ≥ 70 %; Alto < 70 %.'),
    valoresNuevo: () => ({ Fecha: Fmt.hoy(), Tipo: 'Programada (anunciada)', Auditor: App.meta.usuario.nombre }),
    acciones: a => [{ texto: 'Informe', accion: () => { informeAuditoria(a.ID_Auditoria); } }]
  })],
  ['No conformidades', zona => vistaEntidad(zona, 'hallazgos', {
    sub: true, orden: 'Fecha_Compromiso', desc: false, sinNuevo: true,
    filtros: [{ key: 'Resultado', label: 'Resultado', valor: 'Pendiente' }, { key: 'Nivel_Riesgo', label: 'Riesgo' }],
    antes: h('p.tenue', 'Defina la acción correctiva, el responsable y la fecha compromiso; ciérrela tras verificarla.')
  })],
  ['Matriz de riesgos (RE-2.6.4-01)', zona => matrizRiesgos(zona)]
]));

async function informeAuditoria(id) {
  const inf = await srv('auditorias.informe', { id });
  const a = inf.auditoria;
  modal({ titulo: 'Informe de auditoría ' + a.ID_Auditoria, cuerpo: h('div.informe',
    h('p.tenue.peq', 'Informe de resultado de auditoría tecnológica — Plan de auditorías de seguridad TC-GI-AN-2.6.4-03'),
    h('div.ficha',
      h('div.dato', h('div.et', 'Fecha'), h('div.vl', a.Fecha)), h('div.dato', h('div.et', 'Tipo'), h('div.vl', a.Tipo)),
      h('div.dato', h('div.et', 'Área / usuario'), h('div.vl', (a.Area || '—') + ' / ' + (a.Usuario_Auditado || '—'))),
      h('div.dato', h('div.et', 'Equipo'), h('div.vl', a.Codigo_Activo || '—')), h('div.dato', h('div.et', 'Auditor'), h('div.vl', a.Auditor))),
    h('h3', { style: 'margin-top:14px' }, '1. Resumen ejecutivo'),
    h('p', 'Criterios evaluados: ', h('b', String(inf.resumen.evaluados)), ' · Cumplimiento: ', h('b', Fmt.pct(a.Cumplimiento)),
      ' · No conformidades: ', h('b', String(a.No_Conformidades)), ' · Nivel de riesgo: ', insignia(a.Nivel_Riesgo)),
    h('h3', '2. Resultados detallados'),
    h('table.tabla', h('tbody', inf.criterios.map(c => h('tr', h('td', c.criterio), h('td', insignia(c.resultado)))))),
    h('h3', { style: 'margin-top:14px' }, '3. No conformidades'),
    inf.hallazgos.length ? h('table.tabla', h('thead', h('tr', ['Hallazgo', 'Riesgo', 'Acción correctiva', 'Responsable', 'Compromiso', 'Seguimiento'].map(t => h('th', t)))),
      h('tbody', inf.hallazgos.map(x => h('tr', h('td', x.Hallazgo), h('td', insignia(x.Nivel_Riesgo)), h('td', x.Accion_Correctiva || '—'), h('td', x.Responsable || '—'), h('td', x.Fecha_Compromiso || '—'), h('td', insignia(x.Resultado))))))
      : h('p.tenue', 'Sin no conformidades.'),
    h('h3', { style: 'margin-top:14px' }, '4. Oportunidades de mejora'), h('p.texto-largo', a.Oportunidades_Mejora || '—'),
    h('h3', '5. Conclusión del auditor'), h('p', a.Conclusion + (a.Dias_Reauditoria ? '. Re-auditoría en ' + a.Dias_Reauditoria + ' días.' : '')),
    h('h3', '6. Seguimiento'), h('p', 'Estado: ', insignia(a.Estado))),
    botones: [{ texto: 'Imprimir', accion: () => { window.print(); return false; } }, { texto: 'Cerrar' }] });
}

async function matrizRiesgos(zona) {
  const riesgos = await srv('listar', { entidad: 'riesgos' });
  // Mapa de calor: probabilidad (filas) × impacto (columnas), riesgo inherente
  const conteo = {};
  riesgos.filter(r => r.Probabilidad && r.Impacto).forEach(r => { const k = r.Probabilidad + '-' + r.Impacto; conteo[k] = (conteo[k] || 0) + 1; });
  const color = (p, i) => { const s = p * i; return s >= 16 ? '#FCA5A5' : s >= 10 ? '#FDBA74' : s >= 5 ? '#FDE68A' : '#BBF7D0'; };
  const porEstado = {};
  riesgos.forEach(r => { porEstado[r.Estado] = (porEstado[r.Estado] || 0) + 1; });
  const mapa = h('table.tabla', { style: 'width:auto', 'aria-label': 'Mapa de calor de riesgos evaluados: probabilidad por impacto' },
    h('thead', h('tr', h('th', 'P \\ I'), [1, 2, 3, 4, 5].map(i => h('th', { style: 'text-align:center' }, String(i))))),
    h('tbody', [5, 4, 3, 2, 1].map(p => h('tr', h('th', String(p)), [1, 2, 3, 4, 5].map(i =>
      h('td', { style: 'text-align:center;min-width:44px;background:' + color(p, i) }, conteo[p + '-' + i] ? String(conteo[p + '-' + i]) : ''))))));
  zona.append(h('div.rejilla.r2', { style: 'margin-bottom:16px' },
    h('div.tarjeta', h('h2', 'Riesgo inherente evaluado'), mapa, h('p.tenue.peq', 'Filas: probabilidad; columnas: impacto. La calificación del registro multiplica además por la valoración del activo.')),
    h('div.tarjeta', h('h2', 'Estado de la matriz'), barrasSimples(porEstado),
      h('p.tenue.peq', { style: 'margin-top:10px' }, 'Calificación = probabilidad × impacto × valoración del activo (1-125). Umbrales en Configuracion: Bajo ≤ 20, Medio ≤ 45, Alto ≤ 80, Extremo > 80.'))));
  await vistaEntidad(zona, 'riesgos', {
    sub: true, orden: 'Calificacion', desc: true,
    cargar: (() => { let primera = true; return () => { if (primera) { primera = false; return Promise.resolve(riesgos); } return srv('listar', { entidad: 'riesgos' }); }; })(),
    columnas: [
      { key: 'ID_Riesgo', label: 'ID' }, { key: 'Activo', label: 'Activo' }, { key: 'Amenaza', label: 'Amenaza' },
      { key: 'Calificacion', label: 'Calificación', num: true }, { key: 'Nivel', label: 'Nivel', fmt: insignia },
      { key: 'Tratamiento', label: 'Tratamiento' }, { key: 'Nivel_Residual', label: 'Residual', fmt: insignia }, { key: 'Estado', label: 'Estado', fmt: insignia }],
    filtros: [{ key: 'Nivel', label: 'Nivel' }, { key: 'Estado', label: 'Estado' }, { key: 'Tipo_Activo', label: 'Tipo de activo' }],
    valoresNuevo: () => ({ Tipo_Activo: 'Hardware', Valoracion: 3, Tratamiento: 'Mitigar' })
  });
}
