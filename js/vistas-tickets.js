/* TC-GI-PD-2.6.9 — Incidentes y requerimientos */
'use strict';

const ESTADOS_ACTIVOS = ['Abierto', 'En Proceso', 'En Espera de Tercero', 'Reabierto'];
const AYUDA_PRIORIDAD = 'Alta: servicio esencial interrumpido. Media: afecta a un grupo o una funcionalidad parcial. Baja: un solo usuario o no interrumpe el servicio.';
const AYUDA_TIPO = 'Incidente: algo dejó de funcionar o funciona mal. Requerimiento: solicitud de instalación, acceso, configuración o mejora. Compra: adquisición de equipos o accesorios (sin SLA).';

function columnasTickets() {
  return [
    { key: 'ID_Ticket', label: 'Ticket' },
    { key: 'Fecha_Apertura', label: 'Apertura', fmt: v => Fmt.fechaHora(v) },
    { key: 'Solicitante', label: 'Solicitante' },
    { key: 'Tipo', label: 'Tipo' },
    { key: 'Titulo', label: 'Título' },
    { key: 'Prioridad', label: 'Prioridad', fmt: insignia },
    { key: 'Estado', label: 'Estado', fmt: insignia },
    { key: 'Horas_Resolucion', label: 'Resolución', num: true, fmt: Fmt.horas },
    { key: 'Cumple_SLA', label: 'SLA', fmt: insignia }
  ];
}

ruta('/tickets', async cont => {
  let todos = [];
  let tabla_ = null;
  const grupos = [
    ['Activos', t => ESTADOS_ACTIVOS.includes(t.Estado)],
    ['Por confirmar', t => t.Estado === 'Resuelto'],
    ['Cerrados', t => t.Estado === 'Cerrado'],
    ['Todos', () => true]
  ];
  let actual = 0;
  cont.append(encabezado('Incidentes y requerimientos', 'Registro de ticket — TC-GI-PD-2.6.9',
    esTI() ? h('button.btn.primario', { onclick: () => ir('/tickets-nuevo') }, '+ Registrar ticket') : null));
  const pest = h('div.pestanas', { role: 'tablist' });
  const zona = h('div');
  const nota = h('p.tenue.peq');
  const contar = () => {
    vaciar(pest);
    grupos.forEach(([n, f], i) => pest.append(h('button', { role: 'tab', 'aria-selected': String(i === actual), class: i === actual ? 'activo' : '', onclick: () => { actual = i; pintar(); } },
      n + ' (' + todos.filter(f).length + ')')));
  };
  const pintar = () => {
    contar();
    tabla_ = tabla({
      columnas: columnasTickets(), filas: todos.filter(grupos[actual][1]), orden: 'Fecha_Apertura', desc: true,
      filtros: [{ key: 'Tipo', label: 'Tipo' }, { key: 'Prioridad', label: 'Prioridad' }, { key: 'Categoria', label: 'Categoría' }, { key: 'Estado', label: 'Estado' }],
      alClic: t => ir('/tickets/' + encodeURIComponent(t.ID_Ticket))
    });
    vaciar(zona).append(tabla_);
  };
  cont.append(pest, nota, zona);
  // Llegan primero los activos (en vivo) y después el archivo; un cambio en vivo no borra lo que el usuario filtró
  await new Promise(listo => {
    alSalirDeVista(fuenteTickets((ts, completo) => {
      todos = ts;
      nota.textContent = completo ? '' : 'Cargando tickets archivados…';
      if (!tabla_) { pintar(); listo(); } else { contar(); tabla_.refrescar(todos.filter(grupos[actual][1])); }
    }));
  });
});

ruta('/mis-tickets', async cont => {
  cont.append(encabezado('Mis solicitudes', 'Incidentes y requerimientos que usted reportó',
    h('button.btn.primario', { onclick: () => ir('/tickets-nuevo') }, '+ Nueva solicitud')));
  const avisoConfirmar = h('div');
  let tabla_ = null;
  cont.append(avisoConfirmar);
  const pintarConfirmar = mios => {
    const porConfirmar = mios.filter(t => t.Estado === 'Resuelto');
    vaciar(avisoConfirmar).append(porConfirmar.length ? h('div.tarjeta', { style: 'margin-bottom:16px;border-left:4px solid var(--alerta)' },
      h('h2', 'Pendientes de su confirmación'),
      h('p.tenue', 'TI resolvió estas solicitudes. Confirme si quedaron solucionadas o indique qué falta.'),
      h('ul', porConfirmar.map(t => h('li', h('a', { href: '#', onclick: e => { e.preventDefault(); ir('/tickets/' + t.ID_Ticket); } }, t.ID_Ticket + ' — ' + t.Titulo))))) : '');
  };
  await new Promise(listo => {
    alSalirDeVista(fuenteTickets(mios => {
      pintarConfirmar(mios);
      if (tabla_) return tabla_.refrescar(mios);
      tabla_ = tabla({ columnas: columnasTickets().filter(c => c.key !== 'Solicitante'), filas: mios, orden: 'Fecha_Apertura', desc: true,
        vacio: 'Aún no ha registrado solicitudes.', alClic: t => ir('/tickets/' + encodeURIComponent(t.ID_Ticket)) });
      cont.append(tabla_);
      listo();
    }));
  });
});

ruta('/tickets-nuevo', async cont => {
  const ti = esTI();
  const fields = Ent('tickets').fields;
  if (ti) await cargarRefs(['activos', 'usuarios']);
  const campos = ti
    ? ['Solicitante', 'Solicitante_Email', 'Departamento', 'Canal', 'Fecha_Apertura', 'Tipo', 'Categoria', 'Prioridad', 'Codigo_Activo', 'Titulo', 'Descripcion', 'Especialista']
    : ['Tipo', 'Categoria', 'Titulo', 'Descripcion'];
  const valores = { Tipo: 'Incidente', Canal: 'Teams', Fecha_Apertura: Fmt.ahora(), Prioridad: 'Media' };
  const form = formulario(fields, valores, { campos, requeridos: ti ? ['Solicitante', 'Canal', 'Prioridad'] : [] });
  if (!ti) {
    const tipo = form.controles.Tipo;
    [...tipo.options].forEach(o => { if (o.value === 'Compra') o.textContent = 'Compra (equipos o accesorios)'; });
  }
  if (ti) {
    // Autocompletar datos del solicitante y su equipo desde el directorio
    const personas = App.refs.usuarios || [];
    const dl = h('datalist#dl-personas', personas.map(u => h('option', { value: u.Nombre }, u.Departamento || '')));
    form.controles.Solicitante.setAttribute('list', 'dl-personas');
    form.controles.Solicitante.after(dl);
    form.controles.Solicitante.addEventListener('change', e => {
      const u = personas.find(p => p.Nombre === e.target.value);
      if (!u) return;
      if (u.Email) form.controles.Solicitante_Email.value = u.Email;
      if (u.Departamento) form.controles.Departamento.value = u.Departamento;
      const equipo = (App.refs.activos || []).find(a => a.Custodio === u.Nombre && /^PC-/.test(a.Codigo_Activo));
      if (equipo && !form.controles.Codigo_Activo.value) form.controles.Codigo_Activo.value = equipo.Codigo_Activo;
    });
  }
  cont.append(encabezado(ti ? 'Registrar ticket' : 'Nueva solicitud', ti ? 'Recepción del incidente o requerimiento (paso 1 de TC-GI-PD-2.6.9)' : 'TI clasificará su solicitud y le avisará por correo cuando esté resuelta'),
    h('div.tarjeta', h('p.tenue.peq', AYUDA_TIPO), form.el,
      h('div.acciones', { style: 'margin-top:16px;justify-content:flex-end' },
        h('button.btn', { onclick: () => ir(ti ? '/tickets' : '/mis-tickets') }, 'Cancelar'),
        h('button.btn.primario', {
          onclick: async ev => {
            const boton = ev.currentTarget;
            boton.disabled = true;
            try {
              const t = await srv('tickets.crear', { registro: form.leer() });
              aviso('Ticket ' + t.ID_Ticket + ' registrado', 'ok');
              invalidarRef('tickets');
              ir('/tickets/' + t.ID_Ticket);
            } catch (e) { fallo(e); boton.disabled = false; }
          }
        }, 'Registrar'))));
  // Base de conocimiento sugerida (Nivel 1 — autogestión)
  const sugerencias = h('div');
  cont.append(h('div.tarjeta', { style: 'margin-top:16px' }, h('h2', '¿Ya probó la base de conocimiento?'),
    h('p.tenue.peq', 'Nivel 1 de atención: muchas fallas comunes tienen una solución documentada.'), sugerencias));
  const kb = await srv('listar', { entidad: 'conocimiento' }).catch(() => []);
  const buscar = () => {
    const t = (form.controles.Titulo.value + ' ' + form.controles.Descripcion.value).toLowerCase();
    const palabras = t.split(/\W+/).filter(p => p.length > 3);
    const hits = kb.filter(k => k.Estado === 'Publicado' && palabras.some(p => (k.Titulo + ' ' + k.Palabras_Clave + ' ' + k.Problema_Sintoma).toLowerCase().includes(p))).slice(0, 5);
    vaciar(sugerencias).append(hits.length ? h('ul', hits.map(k => h('li', h('a', { href: '#', onclick: e => { e.preventDefault(); verArticulo(k); } }, k.ID_Articulo + ' — ' + k.Titulo))))
      : h('p.tenue', kb.length ? 'Escriba el título para ver artículos relacionados.' : 'No hay artículos publicados.'));
  };
  form.controles.Titulo.addEventListener('input', buscar);
  buscar();
});

ruta('/tickets/:id', async (cont, id) => {
  let vivo = false;
  const pintar = async () => {
    const d = await srv('tickets.detalle', { id });
    const { ticket: t, historial, mantenimientos } = d;
    vivo = !!d.vivo;
    vaciar(cont);
    if (t._errorArchivo && esTI()) cont.append(h('div.tarjeta', { style: 'margin-bottom:12px;border-left:4px solid var(--mal)' },
      h('b', 'No se pudo archivar este ticket: '), t._errorArchivo, h('div.tenue.peq', 'Corrija el dato indicado; se reintenta cada 10 minutos.')));
    const ti = esTI();
    const propio = t.Solicitante_Email && t.Solicitante_Email.toLowerCase() === App.meta.usuario.email.toLowerCase();
    const accion = (tipo, titulo, campos, extra) => ({ tipo, titulo, campos, extra });
    const acciones = [];
    if (ti) {
      if (['Abierto', 'Reabierto', 'En Espera de Tercero'].includes(t.Estado)) acciones.push(accion('iniciar', 'Iniciar atención'));
      if (ESTADOS_ACTIVOS.includes(t.Estado) || t.Estado === 'Resuelto') acciones.push(accion('clasificar', 'Clasificar / asignar / escalar'));
      if (ESTADOS_ACTIVOS.includes(t.Estado)) acciones.push(accion('resolver', 'Registrar solución'));
      if (t.Estado === 'Resuelto') acciones.push(accion('cerrarTI', 'Cerrar (confirmado por TI)'));
      if (['Resuelto', 'Cerrado'].includes(t.Estado)) acciones.push(accion('lecciones', 'Lecciones aprendidas'));
      acciones.push(accion('reincidencia', 'Reincidencia'));
      if (Ent('incidentesSeguridad')) acciones.push(accion('seguridad', 'Registrar incidente de seguridad'));
      if (Ent('capacitaciones')) acciones.push(accion('capacitacion', 'Programar capacitación'));
      acciones.push(accion('editar', 'Corregir datos'));
      if (ESTADOS_ACTIVOS.includes(t.Estado)) acciones.push(accion('anular', 'Anular'));
    }
    const botonesConformidad = (t.Estado === 'Resuelto' && (propio || ti)) ? [
      h('button.btn.primario', { onclick: () => conformidad(t, true, pintar) }, '✓ Quedó solucionado'),
      h('button.btn.peligro', { onclick: () => conformidad(t, false, pintar) }, 'No está solucionado')
    ] : [];
    cont.append(encabezado(t.ID_Ticket + ' — ' + t.Titulo, t.Tipo + ' · ' + t.Categoria + ' · registrado por ' + t.Canal,
      botonesConformidad,
      acciones.length ? h('select.btn', { 'aria-label': 'Acciones del ticket', onchange: e => { const a = acciones.find(x => x.tipo === e.target.value); e.target.value = ''; if (a) (DERIVADOS[a.tipo] ? DERIVADOS[a.tipo](t) : accionTicket(t, a.tipo, a.titulo, pintar)); } },
        h('option', { value: '' }, 'Acciones…'), acciones.map(a => h('option', { value: a.tipo }, a.titulo))) : null,
      ti && t.Codigo_Activo && Ent('mantenimientos') ? h('button.btn', { onclick: () => correctivoDesdeTicket(t) }, 'Registrar mantenimiento correctivo') : null,
      h('button.btn', { onclick: () => ir(ti || App.meta.usuario.rol === 'Auditor SGI' ? '/tickets' : '/mis-tickets') }, '← Volver')));

    const estado = h('div.kpis',
      h('div.kpi', h('div.nombre', 'Estado'), h('div.valor', { style: 'font-size:18px' }, insignia(t.Estado)), h('div.meta', 'Conformidad: ' + (t.Conformidad || '—'))),
      h('div.kpi', h('div.nombre', 'Prioridad'), h('div.valor', { style: 'font-size:18px' }, insignia(t.Prioridad)), h('div.meta', t.Nivel_Escalamiento || '')),
      h('div.kpi', h('div.nombre', 'Tiempo de respuesta'), h('div.valor', Fmt.horas(t.Horas_Respuesta) || '—'), h('div.meta', 'Hasta el inicio de la atención')),
      h('div.kpi' + (t.Cumple_SLA === 'SI' ? '.cumple' : t.Cumple_SLA === 'NO' ? '.nocumple' : ''), h('div.nombre', 'Tiempo de resolución'),
        h('div.valor', Fmt.horas(t.Horas_Resolucion) || '—'), h('div.meta', t.Meta_Horas ? 'Meta ' + t.Meta_Horas + ' h hábiles · SLA ' + t.Cumple_SLA : 'Sin SLA (' + t.Tipo + ')')));
    cont.append(estado);
    cont.append(h('div.rejilla.r2',
      h('div.tarjeta', h('h2', 'Datos del ticket'), ficha('tickets', t, ['Fecha_Apertura', 'Solicitante', 'Solicitante_Email', 'Departamento', 'Codigo_Activo', 'Especialista', 'Proveedor_Externo', 'Fecha_Inicio_Atencion', 'Fecha_Solucion', 'Fecha_Cierre', 'Descripcion'])),
      h('div.rejilla',
        h('div.tarjeta', h('h2', 'Solución'), ficha('tickets', t, ['Diagnostico_Solucion', 'Lecciones_Aprendidas', 'ID_Articulo_KB', 'Es_Reincidente', 'Ticket_Origen'])),
        (t.Calificacion || t.Comentario_Usuario) ? h('div.tarjeta', h('h2', 'Opinión del usuario'), ficha('tickets', t, ['Calificacion', 'Comentario_Usuario'])) : null,
        mantenimientos.length ? h('div.tarjeta', h('h2', 'Mantenimientos relacionados'), h('ul', mantenimientos.map(m => h('li', m.ID_Mantenimiento + ' — ' + m.Tipo_Mantenimiento + ' ' + Fmt.fecha(m.Fecha_Ejecucion) + ' (' + m.Codigo_Activo + ')')))) : null,
        h('div.tarjeta', h('h2', 'Bitácora'), h('ol.linea-tiempo', historial.slice().sort((a, b) => a.Fecha < b.Fecha ? -1 : 1).map(x =>
          h('li', h('div.cuando', Fmt.fechaHora(x.Fecha) + ' · ' + x.Usuario), h('div', h('b', x.Accion), x.Detalle ? ' — ' + x.Detalle : '')))))
      )));
  };
  await pintar();
  // En vivo: si otra persona cambia el ticket, la pantalla se actualiza sola
  if (vivo && modoFirebase()) {
    let primera = true;
    alSalirDeVista(Fb.db.collection('tickets').doc(id).onSnapshot(() => {
      if (primera) { primera = false; return; }
      if (!document.querySelector('.velo')) pintar().catch(fallo); // no interrumpe un formulario abierto
    }, () => {}));
  }
});

function conformidad(t, conforme, despues) {
  const cal = h('select', { id: 'cal' }, h('option', { value: '' }, '— Opcional —'), [5, 4, 3, 2, 1].map(n => h('option', { value: n }, n + ' ' + '★'.repeat(n))));
  const com = h('textarea', { id: 'com', placeholder: conforme ? 'Comentario (opcional)' : '¿Qué sigue fallando?' });
  modal({
    titulo: conforme ? 'Confirmar solución' : 'Reabrir ticket', chico: true,
    cuerpo: h('div.form', { style: 'grid-template-columns:1fr' },
      conforme ? h('div.campo', h('label', { for: 'cal' }, 'Califique la atención'), cal) : h('p.tenue', 'El ticket volverá a TI como reabierto.'),
      h('div.campo', h('label', { for: 'com' }, conforme ? 'Comentario' : 'Motivo', conforme ? '' : h('span.req', ' *')), com)),
    botones: [{ texto: 'Cancelar' }, { texto: conforme ? 'Confirmar' : 'Reabrir', primario: true, accion: async () => {
      await srv('tickets.accion', { id: t.ID_Ticket, tipo: 'conformidad', datos: { conforme, Calificacion: cal.value, Comentario_Usuario: com.value } });
      aviso(conforme ? 'Gracias, el ticket quedó cerrado' : 'Ticket reabierto', 'ok');
      await despues();
    } }]
  });
}

async function accionTicket(t, tipo, titulo, despues) {
  const F = Ent('tickets').fields;
  let cuerpo, leer;
  const ahora = Fmt.ahora();
  if (tipo === 'clasificar') {
    await cargarRefs(['activos']);
    const f = formulario(F, t, { campos: ['Tipo', 'Categoria', 'Prioridad', 'Nivel_Escalamiento', 'Proveedor_Externo', 'Especialista', 'Codigo_Activo'] });
    cuerpo = h('div', h('p.tenue.peq', AYUDA_PRIORIDAD + ' Nivel 3 deja el ticket en espera del proveedor.'), f.el); leer = f.leer;
  } else if (tipo === 'iniciar' || tipo === 'resolver') {
    const fecha = h('input', { type: 'datetime-local', id: 'fx', value: ahora });
    const diag = tipo === 'resolver' ? h('textarea', { id: 'dx', value: t.Diagnostico_Solucion || '' }) : null;
    cuerpo = h('div.form', { style: 'grid-template-columns:1fr' },
      diag ? h('div.campo', h('label', { for: 'dx' }, 'Diagnóstico y solución', h('span.req', ' *')), diag) : null,
      h('div.campo', h('label', { for: 'fx' }, tipo === 'resolver' ? 'Fecha y hora de la solución' : 'Fecha y hora de inicio de la atención'), fecha,
        h('div.ayuda', 'Por defecto es ahora; cámbiela si registra algo que ya ocurrió.')));
    // Si no se cambió la fecha propuesta, el servidor usa la hora exacta (con segundos)
    leer = () => ({ fecha: fecha.value && fecha.value !== ahora ? fecha.value + ':00' : '', Diagnostico_Solucion: diag ? diag.value : undefined });
  } else if (tipo === 'cerrarTI' || tipo === 'anular') {
    const txt = h('textarea', { id: 'jx' });
    cuerpo = h('div.form', { style: 'grid-template-columns:1fr' }, h('div.campo', h('label', { for: 'jx' },
      tipo === 'cerrarTI' ? '¿Cómo se confirmó que el servicio quedó restablecido?' : 'Motivo de la anulación (p. ej. duplicado de TCK-…)', h('span.req', ' *')), txt),
      tipo === 'cerrarTI' ? h('p.tenue.peq', 'La política exige la validación del usuario o la confirmación del restablecimiento del servicio.') : null);
    leer = () => (tipo === 'cerrarTI' ? { justificacion: txt.value } : { motivo: txt.value });
  } else if (tipo === 'reincidencia') {
    await cargarRefs(['tickets']);
    const f = formulario(F, t, { campos: ['Es_Reincidente', 'Ticket_Origen'] });
    f.controles.Es_Reincidente.disabled = false; f.controles.Ticket_Origen.disabled = false;
    cuerpo = h('div', h('p.tenue.peq', 'Un incidente es reincidente si repite una falla ya atendida del mismo usuario o equipo.'), f.el);
    leer = () => { const v = { Es_Reincidente: f.controles.Es_Reincidente.value, Ticket_Origen: f.controles.Ticket_Origen.value }; return v; };
  } else if (tipo === 'lecciones') {
    const txt = h('textarea', { id: 'lx', value: t.Lecciones_Aprendidas || '' });
    const kb = h('input', { type: 'checkbox', id: 'kbx', checked: !t.ID_Articulo_KB });
    cuerpo = h('div.form', { style: 'grid-template-columns:1fr' }, h('div.campo', h('label', { for: 'lx' }, 'Lección aprendida', h('span.req', ' *')), txt),
      t.ID_Articulo_KB ? h('p.tenue', 'Ya publicado en ' + t.ID_Articulo_KB) : h('label.check', kb, 'Publicar en la base de conocimiento'));
    leer = () => ({ Lecciones_Aprendidas: txt.value, publicarKB: kb.checked });
  } else if (tipo === 'editar') {
    const f = formulario(F, t, { campos: ['Fecha_Apertura', 'Canal', 'Solicitante', 'Solicitante_Email', 'Departamento', 'Titulo', 'Descripcion', 'Fecha_Inicio_Atencion', 'Fecha_Solucion', 'Diagnostico_Solucion'] });
    cuerpo = h('div', h('p.tenue.peq', 'Use esta opción solo para corregir errores de registro. Queda en la bitácora.'), f.el); leer = f.leer;
  }
  modal({ titulo: titulo + ' — ' + t.ID_Ticket, cuerpo, botones: [{ texto: 'Cancelar' }, { texto: 'Guardar', primario: true, accion: async () => {
    await srv('tickets.accion', { id: t.ID_Ticket, tipo, datos: leer() });
    aviso('Ticket actualizado', 'ok');
    invalidarRef('tickets');
    await despues();
  } }] });
}

/** Registros de otros procedimientos que nacen de un ticket */
const DERIVADOS = {
  seguridad: t => editarRegistro('incidentesSeguridad', null, { valoresNuevo: () => ({
    Fecha_Deteccion: String(t.Fecha_Apertura).slice(0, 16), ID_Ticket: t.ID_Ticket, Codigo_Activo: t.Codigo_Activo, Area_Afectada: t.Departamento,
    Descripcion: t.Titulo + (t.Descripcion ? '\n' + t.Descripcion : ''), Estado: 'Detectado', Datos_Personales: 'NO', Impacto: t.Prioridad === 'Alta' ? 'Alto' : 'Medio' }) },
    () => aviso('Incidente de seguridad registrado; siga su gestión en Seguridad de la información', 'ok')),
  capacitacion: t => editarRegistro('capacitaciones', null, { valoresNuevo: () => ({
    Tema: t.Titulo, Objetivo: t.Descripcion, ID_Ticket: t.ID_Ticket, Solicitado_Por: t.Solicitante, Dirigido_A: t.Departamento || t.Solicitante,
    Origen_Necesidad: 'Solicitud de área', Estado: 'Planificada', Modalidad: 'Virtual', Facilitador: App.meta.responsableTI }) },
    () => aviso('Capacitación programada; siga su gestión en Capacitaciones', 'ok'))
};

function correctivoDesdeTicket(t) {
  editarRegistro('mantenimientos', null, {
    valoresNuevo: () => ({ Tipo_Mantenimiento: 'Correctivo', ID_Ticket: t.ID_Ticket, Codigo_Activo: t.Codigo_Activo, Descripcion: t.Titulo, Prioridad: t.Prioridad, Fecha_Ejecucion: Fmt.hoy(), Estado: 'Ejecutado' })
  }, () => ir('/tickets/' + t.ID_Ticket));
}

function verArticulo(k) {
  modal({ titulo: k.ID_Articulo + ' — ' + k.Titulo, cuerpo: h('div', h('h3', 'Problema'), h('p.texto-largo', k.Problema_Sintoma), h('h3', 'Solución'), h('div.texto-largo', k.Solucion)) });
}

ruta('/conocimiento', async cont => {
  const lista = await srv('listar', { entidad: 'conocimiento' });
  const visibles = esTI() ? lista : lista.filter(k => k.Estado === 'Publicado');
  const e = Ent('conocimiento');
  const recargar = async () => { const n = await srv('listar', { entidad: 'conocimiento' }); t.refrescar(n); };
  cont.append(encabezado('Base de conocimiento', 'Soluciones documentadas — Nivel 1 de atención (autogestión)',
    e.escribir ? h('button.btn.primario', { onclick: () => editarRegistro('conocimiento', null, {}, recargar) }, '+ Nuevo artículo') : null));
  const t = tabla({ columnas: columnasDe('conocimiento'), filas: visibles, filtros: [{ key: 'Categoria', label: 'Categoría' }], orden: 'ID_Articulo',
    alClic: k => e.escribir ? verRegistro('conocimiento', k, {}, recargar) : verArticulo(k) });
  cont.append(t);
});
