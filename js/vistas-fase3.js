/* Fase 3: 2.6.3 Infraestructura tecnológica y 2.6.6 Proyectos de tecnología e innovación */
'use strict';

const CRITERIOS_MATRIZ = ['K1_Normativo', 'K2_Seguridad', 'K3_Disponibilidad', 'K4_Rendimiento', 'K5_Soporte', 'K6_Costo', 'K7_Innovacion'];
const CRITERIOS_PROYECTO = ['E01_Alineacion', 'E02_Tecnica', 'E03_Economica', 'E04_Operativo', 'E05_Seguridad', 'E06_Innovacion', 'E07_Sostenibilidad', 'E08_Riesgos', 'E09_Cronograma', 'E10_Equipo'];

// ======================= 2.6.3 INFRAESTRUCTURA =======================
ruta('/infraestructura', cont => pestanas(cont, 'Infraestructura tecnológica', 'TC-GI-PD-2.6.3 — necesidades, evaluación de opciones, adquisición e implementación', [
  ['Necesidades (FO-2.6.3-01)', zona => vistaEntidad(zona, 'necesidades', {
    sub: true, orden: 'Fecha_Identificacion',
    filtros: [{ key: 'Estado', label: 'Estado' }, { key: 'Tipo', label: 'Tipo' }, { key: 'Prioridad', label: 'Prioridad' }],
    antes: h('p.tenue', 'Flujo: identificar la necesidad → evaluar al menos dos opciones en la matriz → aprobación gerencial → orden de compra → instalación y pruebas → registro en el inventario.'),
    valoresNuevo: () => ({ Estado: 'Identificada', Prioridad: 'Media', Fecha_Identificacion: Fmt.hoy() }),
    acciones: (n, recargar) => {
      const b = [];
      const puede = Ent('evaluaciones') && Ent('evaluaciones').escribir;
      if (puede && !['Implementada', 'Rechazada'].includes(n.Estado)) b.push({ texto: 'Evaluar una opción', accion: () => { editarRegistro('evaluaciones', null, { valoresNuevo: () => ({ ID_Necesidad: n.ID_Necesidad, Fecha: Fmt.hoy() }) }, recargar); } });
      if (Number(n.Opciones_Evaluadas) > 0) b.push({ texto: 'Comparar opciones', accion: () => { compararOpciones(n, recargar); } });
      if (puede && ['Aprobada', 'En adquisición', 'En implementación'].includes(n.Estado)) b.push({ texto: 'Registrar instalación', accion: () => { editarRegistro('mantenimientos', null, { valoresNuevo: () => ({ Tipo_Mantenimiento: 'Evolutivo', Descripcion: 'Instalación: ' + n.Titulo, Fecha_Ejecucion: Fmt.hoy(), Estado: 'Ejecutado', Verificacion: 'Operativo', Prioridad: n.Prioridad }) }, recargar); } });
      if (Ent('proyectos') && Ent('proyectos').escribir && !n.ID_Proyecto) b.push({ texto: 'Crear proyecto', accion: () => { editarRegistro('proyectos', null, { valoresNuevo: () => ({ Nombre: n.Titulo, Objetivo: n.Justificacion, Objetivo_Estrategico: n.Objetivo_Estrategico, ID_Necesidad: n.ID_Necesidad, Presupuesto: n.Presupuesto_Estimado, Estado: 'Idea' }) }, recargar); } });
      return b;
    }
  })],
  ['Matriz de evaluación (RE-2.6.3-01)', zona => vistaEntidad(zona, 'evaluaciones', {
    sub: true, orden: 'ID_Necesidad', sinNuevo: true, filtros: [{ key: 'ID_Necesidad', label: 'Necesidad' }],
    antes: h('p.tenue', 'Cada opción se califica de 1 a 3 en 7 criterios ponderados (normativo 20 %, seguridad 20 %, disponibilidad 15 %, rendimiento 15 %, soporte 15 %, costo 10 %, innovación 5 %). Las opciones se evalúan desde la necesidad.')
  })]
]));

async function compararOpciones(n, recargar) {
  const todas = await srv('listar', { entidad: 'evaluaciones' });
  const ops = todas.filter(e => e.ID_Necesidad === n.ID_Necesidad).sort((a, b) => b.Puntaje_Ponderado - a.Puntaje_Ponderado);
  const F = Ent('evaluaciones').fields;
  const lbl = k => F.find(f => f.key === k).label.replace(/\s*\(\d+ %\)/, '');
  const puede = Ent('evaluaciones').escribir;
  const m = modal({ titulo: 'Opciones — ' + n.Titulo, cuerpo: h('div',
    h('div.tabla-caja', h('table.tabla',
      h('thead', h('tr', h('th', 'Criterio'), ops.map(o => h('th', o.Opcion + (o.Seleccionada === 'SI' ? ' ✓' : ''))))),
      h('tbody',
        h('tr', h('td', 'Proveedor'), ops.map(o => h('td', o.Proveedor || '—'))),
        h('tr', h('td', 'Costo cotizado'), ops.map(o => h('td.num', o.Costo === '' ? '—' : '$ ' + Fmt.num(o.Costo)))),
        CRITERIOS_MATRIZ.map(k => h('tr', h('td', lbl(k)), ops.map(o => h('td.num', String(o[k]))))),
        h('tr', h('td', h('b', 'Resultado ponderado (1-3)')), ops.map((o, i) => h('td.num', h('b', String(o.Puntaje_Ponderado)), i === 0 ? ' ★' : ''))),
        puede ? h('tr', h('td', ''), ops.map(o => h('td', o.Seleccionada === 'SI' ? insignia('SI') : h('button.btn.chico', { onclick: async () => {
          try { await srv('infraestructura.seleccionar', { id: o.ID_Evaluacion }); aviso('Opción seleccionada: ' + o.Opcion, 'ok'); m.cerrar(); await recargar(); } catch (e) { fallo(e); }
        } }, 'Seleccionar')))) : null))),
    h('p.tenue.peq', { style: 'margin-top:8px' }, '★ mayor resultado ponderado. La selección final puede considerar otros factores; déjelos en Observaciones.')) });
}

// ======================= 2.6.6 PROYECTOS =======================
ruta('/proyectos', cont => vistaEntidad(cont, 'proyectos', {
  orden: 'ID_Proyecto',
  filtros: [{ key: 'Estado', label: 'Estado' }, { key: 'Objetivo_Estrategico', label: 'Objetivo' }, { key: 'Resultado_Evaluacion', label: 'Viabilidad' }],
  antes: h('p.tenue', 'Idea → evaluación de viabilidad (100 puntos) → plan de proyecto → ejecución y seguimiento → cierre con lecciones aprendidas. Clic en un proyecto para abrir su ficha.'),
  campos: ['Nombre', 'Objetivo', 'Alcance', 'Objetivo_Estrategico', 'ID_Necesidad', 'Patrocinador', 'Lider', 'Equipo', 'Presupuesto', 'Fecha_Inicio_Plan', 'Fecha_Fin_Plan', 'Riesgos'],
  valoresNuevo: () => ({ Estado: 'Idea' }),
  alClic: p => ir('/proyectos/' + encodeURIComponent(p.ID_Proyecto))
}));

ruta('/proyectos/:id', async (cont, id) => {
  const pintar = async () => {
    const [proyectos, tareasTodas, segTodos] = await Promise.all([
      srv('listar', { entidad: 'proyectos' }), srv('listar', { entidad: 'tareasProyecto' }), srv('listar', { entidad: 'seguimientoProyectos' })]);
    const p = proyectos.find(x => x.ID_Proyecto === id);
    if (!p) throw new Error('No existe el proyecto ' + id);
    const tareas = tareasTodas.filter(t => t.ID_Proyecto === id).sort((a, b) => a.Orden - b.Orden);
    const segs = segTodos.filter(s => s.ID_Proyecto === id).sort((a, b) => b.Fecha.localeCompare(a.Fecha));
    const E = Ent('proyectos');
    const puede = E.escribir;
    const puedeTareas = Ent('tareasProyecto').escribir;
    const guardarP = async registro => { await srv('guardar', { entidad: 'proyectos', id, registro }); aviso('Proyecto actualizado', 'ok'); await pintar(); };
    vaciar(cont);

    const estados = Cat('Estados_Proyecto');
    cont.append(encabezado(p.ID_Proyecto + ' — ' + p.Nombre, p.Objetivo_Estrategico,
      puede ? h('select.btn', { 'aria-label': 'Cambiar estado', onchange: async e => { const v = e.target.value; e.target.value = ''; if (!v) return;
        if (v === 'Cerrado') return cerrarProyecto(p, guardarP);
        try { await guardarP({ Estado: v }); } catch (err) { fallo(err); } } },
        h('option', { value: '' }, 'Cambiar estado…'), estados.filter(s => s !== p.Estado).map(s => h('option', { value: s }, s))) : null,
      puede ? h('button.btn', { onclick: () => editarRegistro('proyectos', p, { campos: ['Nombre', 'Objetivo', 'Alcance', 'Objetivo_Estrategico', 'ID_Necesidad', 'Patrocinador', 'Lider', 'Equipo', 'Presupuesto', 'Fecha_Inicio_Plan', 'Fecha_Fin_Plan', 'Riesgos'] }, pintar) }, 'Editar datos') : null,
      h('button.btn', { onclick: () => ir('/proyectos') }, '← Volver')));

    const vencido = p.Fecha_Fin_Plan && p.Estado !== 'Cerrado' && p.Fecha_Fin_Plan < Fmt.hoy();
    cont.append(h('div.kpis',
      h('div.kpi', h('div.nombre', 'Estado'), h('div.valor', { style: 'font-size:18px' }, insignia(p.Estado)), h('div.meta', 'Líder: ' + (p.Lider || '—'))),
      h('div.kpi' + (p.Resultado_Evaluacion === 'Viable' ? '.cumple' : p.Resultado_Evaluacion === 'No viable' ? '.nocumple' : ''), h('div.nombre', 'Viabilidad (FO-2.6.6-01)'),
        h('div.valor', p.Puntaje_Evaluacion === '' ? '—' : p.Puntaje_Evaluacion + '/100'), h('div.meta', p.Resultado_Evaluacion || 'Sin evaluar')),
      h('div.kpi', h('div.nombre', 'Avance'), h('div.valor', Fmt.pct(p.Avance)), h('div.meta', tareas.filter(t => t.Estado === 'Completado').length + ' de ' + tareas.filter(t => t.Estado !== 'Cancelado').length + ' actividades')),
      h('div.kpi' + (vencido ? '.nocumple' : ''), h('div.nombre', 'Plazo'), h('div.valor', { style: 'font-size:18px' }, (p.Fecha_Inicio_Plan || '—') + ' → ' + (p.Fecha_Fin_Plan || '—')),
        h('div.meta', p.Fecha_Fin_Real ? 'Fin real ' + p.Fecha_Fin_Real : (vencido ? 'Fuera de plazo' : 'En plazo')))));

    // Evaluación de viabilidad
    const maxDe = k => +(E.fields.find(f => f.key === k).label.match(/máx\. (\d+)/) || [0, 0])[1];
    cont.append(h('div.rejilla.r2',
      h('div.tarjeta', h('h2', 'Datos del proyecto'), ficha('proyectos', p, ['Objetivo', 'Alcance', 'ID_Necesidad', 'Patrocinador', 'Equipo', 'Presupuesto', 'Riesgos'])),
      h('div.tarjeta', h('div.encabezado', { style: 'margin-bottom:8px' }, h('h2', { style: 'margin:0' }, 'Evaluación de viabilidad'),
        puede ? h('button.btn.chico', { onclick: () => evaluarProyecto(p, guardarP) }, p.Puntaje_Evaluacion === '' ? 'Evaluar' : 'Reevaluar') : null),
        p.Puntaje_Evaluacion === '' ? h('p.tenue', 'Sin evaluar. La Unidad de Gestión Integral califica 10 criterios (100 puntos) antes de aprobar.')
          : h('div', CRITERIOS_PROYECTO.map(k => {
            const v = Number(p[k]) || 0, mx = maxDe(k);
            return h('div', { style: 'display:grid;grid-template-columns:1fr 90px 48px;gap:8px;align-items:center;margin:3px 0' },
              h('span.peq', E.fields.find(f => f.key === k).label.replace(/\s*\(máx\. \d+\)/, '')),
              h('div', { style: 'background:#F1F5F9;border-radius:4px;height:8px' }, h('div', { style: 'height:8px;border-radius:4px;background:#C5221F;width:' + (mx ? v / mx * 100 : 0) + '%' })),
              h('span.peq.derecha', v + '/' + mx));
          }), h('p.tenue.peq', 'Evaluado por ' + (p.Evaluado_Por || '—') + ' el ' + (p.Fecha_Evaluacion || '—'))))));

    // Plan de proyecto
    const tablaTareas = tareas.length ? tabla({ buscar: false, filas: tareas, orden: 'Orden', desc: false, porPagina: 50,
      columnas: [{ key: 'Orden', label: 'N.º', num: true }, { key: 'Actividad', label: 'Actividad / hito', fmt: (v, t) => [v, t.Es_Hito === 'SI' ? ' ◆' : ''] },
        { key: 'Responsable', label: 'Responsable' }, { key: 'Fecha_Inicio', label: 'Inicio' }, { key: 'Fecha_Fin', label: 'Fin' },
        { key: 'Duracion_Dias', label: 'Días', num: true }, { key: 'Estado', label: 'Estado', fmt: insignia }],
      alClic: t => puedeTareas ? editarRegistro('tareasProyecto', t, { campos: ['Orden', 'Actividad', 'Es_Hito', 'Responsable', 'Fecha_Inicio', 'Fecha_Fin', 'Estado', 'Comentarios', 'Resultado'] }, pintar) : verRegistro('tareasProyecto', t, {}, pintar) })
      : h('p.tenue', 'Aún no hay plan de proyecto.');
    cont.append(h('div.tarjeta', { style: 'margin-top:16px' },
      h('div.encabezado', { style: 'margin-bottom:8px' }, h('div', h('h2', { style: 'margin:0' }, 'Plan de proyecto'), h('div.codigo', 'TC-GI-RE-2.6.6-01 · ◆ = hito o entregable')),
        h('div.acciones',
          puedeTareas && !tareas.length ? h('button.btn', { onclick: async () => { try { const r = await srv('proyectos.plantilla', { id }); aviso(r.creadas + ' actividades creadas desde la plantilla FO-2.6.6-02', 'ok'); await pintar(); } catch (e) { fallo(e); } } }, 'Usar plantilla estándar') : null,
          puedeTareas ? h('button.btn.primario', { onclick: () => editarRegistro('tareasProyecto', null, { valoresNuevo: () => ({ ID_Proyecto: id, Estado: 'No iniciado', Responsable: p.Lider }), campos: ['Actividad', 'Es_Hito', 'Responsable', 'Fecha_Inicio', 'Fecha_Fin', 'Estado', 'Comentarios'] }, pintar) }, '+ Actividad') : null)),
      tablaTareas));

    // Seguimiento y cambios
    const puedeSeg = Ent('seguimientoProyectos').escribir;
    cont.append(h('div.tarjeta', { style: 'margin-top:16px' },
      h('div.encabezado', { style: 'margin-bottom:8px' }, h('div', h('h2', { style: 'margin:0' }, 'Seguimiento y control de cambios'), h('div.codigo', 'Reuniones, informes de avance y solicitudes de cambio (alcance, cronograma o presupuesto)')),
        puedeSeg ? h('button.btn.primario', { onclick: () => editarRegistro('seguimientoProyectos', null, { valoresNuevo: () => ({ ID_Proyecto: id, Fecha: Fmt.hoy(), Tipo: 'Reunión de seguimiento' }) }, pintar) }, '+ Registro') : null),
      segs.length ? h('ol.linea-tiempo', segs.map(s => h('li', { style: 'cursor:pointer', onclick: () => verRegistro('seguimientoProyectos', s, {}, pintar) },
        h('div.cuando', s.Fecha + ' · ' + s.Tipo + (s.Avance !== '' ? ' · avance ' + Fmt.pct(s.Avance) : '') + (s.Decision ? ' · ' : ''), s.Decision ? insignia(s.Decision === 'Aprobado' ? 'Aprobado' : s.Decision) : ''),
        h('div', s.Resumen), s.Acuerdos ? h('div.tenue.peq', 'Acuerdos: ' + s.Acuerdos) : null)))
        : h('p.tenue', 'Sin registros de seguimiento.')));

    if (p.Estado === 'Cerrado') cont.append(h('div.tarjeta', { style: 'margin-top:16px' }, h('h2', 'Cierre del proyecto'), ficha('proyectos', p, ['Fecha_Fin_Real', 'Resultado', 'Conclusiones', 'Lecciones_Aprendidas'])));
  };
  await pintar();
});

function evaluarProyecto(p, guardarP) {
  const f = formulario(Ent('proyectos').fields, Object.assign({}, p, { Evaluado_Por: p.Evaluado_Por || App.meta.usuario.nombre, Fecha_Evaluacion: p.Fecha_Evaluacion || Fmt.hoy() }),
    { campos: CRITERIOS_PROYECTO.concat(['Evaluado_Por', 'Fecha_Evaluacion']), requeridos: CRITERIOS_PROYECTO.concat(['Evaluado_Por']) });
  const total = h('b', '—');
  const recalcular = () => { total.textContent = CRITERIOS_PROYECTO.reduce((s, k) => s + (Number(f.controles[k].value) || 0), 0) + '/100'; };
  CRITERIOS_PROYECTO.forEach(k => f.controles[k].addEventListener('input', recalcular));
  recalcular();
  modal({ titulo: 'Evaluación de viabilidad — ' + p.Nombre, cuerpo: h('div',
    h('p.tenue.peq', 'Formato TC-GI-FO-2.6.6-01. Viable ≥ 70 puntos, viable con condiciones ≥ 50, no viable < 50 (umbrales en Configuracion).'),
    f.el, h('p', { style: 'margin-top:10px' }, 'Total: ', total)),
    botones: [{ texto: 'Cancelar' }, { texto: 'Guardar evaluación', primario: true, accion: async () => { await guardarP(f.leer()); } }] });
}

function cerrarProyecto(p, guardarP) {
  const f = formulario(Ent('proyectos').fields, Object.assign({}, p, { Fecha_Fin_Real: p.Fecha_Fin_Real || Fmt.hoy() }),
    { campos: ['Fecha_Fin_Real', 'Resultado', 'Conclusiones', 'Lecciones_Aprendidas'], requeridos: ['Fecha_Fin_Real', 'Resultado', 'Conclusiones', 'Lecciones_Aprendidas'] });
  modal({ titulo: 'Cerrar proyecto — ' + p.Nombre, cuerpo: h('div', h('p.tenue.peq', 'Evaluación final: todas las actividades deben estar completadas o canceladas y los entregables validados.'), f.el),
    botones: [{ texto: 'Cancelar' }, { texto: 'Cerrar proyecto', primario: true, accion: async () => { await guardarP(Object.assign(f.leer(), { Estado: 'Cerrado' })); } }] });
}
