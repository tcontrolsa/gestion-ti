/*
 * Operaciones de tickets sobre Firestore (SDK compat v10), las mismas que ticketCrear_/ticketAccion_ de Apps Script.
 * Las reglas de Firestore (firebase/firestore.rules) validan todo de nuevo: esto solo arma el cambio y da mensajes claros.
 * Horas hábiles y SLA oficiales los calcula Apps Script al archivar.
 * Se usa en el navegador (window.TicketsFS) y en las pruebas de reglas (require).
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.TicketsFS = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ESTADOS_ACTIVOS = ['Abierto', 'En Proceso', 'En Espera de Tercero', 'Reabierto'];
  const NIVEL_3 = 'Nivel 3 - Escalamiento Externo';
  const NIVEL_2 = 'Nivel 2 - Especialista de Soporte';
  const ETIQUETAS = { clasificar: 'Clasificación / asignación', iniciar: 'Inicio de atención', resolver: 'Solución', conformidad: 'Conformidad del usuario',
    cerrarTI: 'Cierre por TI', reincidencia: 'Reincidencia', lecciones: 'Lecciones aprendidas', editar: 'Corrección', anular: 'Anulación' };

  const vacio = v => v === undefined || v === null || String(v).trim() === '';
  const pad4 = n => String(n).padStart(4, '0');

  /** 'AAAA-MM-DDTHH:mm' (hora local) o Date → Date; vacío → null */
  function aFecha(v) {
    if (vacio(v)) return null;
    if (v instanceof Date) return v;
    if (typeof v.toDate === 'function') return v.toDate();
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) throw new Error('Fecha inválida: ' + v);
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }

  /**
   * Crea el ticket reservando el siguiente número del año en la misma transacción.
   * ctx = {db, FieldValue, correo, usuario: {nombre, depto, rol}, esTI}
   */
  async function crear(ctx, d, anio) {
    const { db, FieldValue } = ctx;
    anio = anio || new Date().getFullYear();
    if (vacio(d.Titulo)) throw new Error('Escriba un título.');
    if (vacio(d.Categoria)) throw new Error('Elija la categoría.');
    const refContador = db.collection('contadores').doc('tickets-' + anio);
    return db.runTransaction(async tx => {
      const c = await tx.get(refContador);
      if (!c.exists) throw new Error('La numeración de ' + anio + ' aún no está lista. Avise a TI.');
      const n = c.data().siguiente;
      const id = 'TCK-' + anio + '-' + pad4(n);
      const ahora = FieldValue.serverTimestamp();
      const ti = ctx.esTI;
      const t = {
        ID_Ticket: id,
        Fecha_Apertura: ti && !vacio(d.Fecha_Apertura) ? aFecha(d.Fecha_Apertura) : ahora,
        Canal: ti ? (d.Canal || 'Teams') : 'Aplicación',
        Solicitante: ti ? String(d.Solicitante || '').trim() : ctx.usuario.nombre,
        Solicitante_Email: ti ? String(d.Solicitante_Email || '').trim().toLowerCase() : ctx.correo,
        Departamento: ti ? (d.Departamento || '') : (ctx.usuario.depto || ''),
        Tipo: d.Tipo || 'Incidente',
        Categoria: d.Categoria,
        Codigo_Activo: d.Codigo_Activo || '',
        Titulo: String(d.Titulo).trim(),
        Descripcion: d.Descripcion || '',
        Prioridad: ti ? (d.Prioridad || 'Media') : 'Media',
        Nivel_Escalamiento: ti ? (d.Nivel_Escalamiento || NIVEL_2) : NIVEL_2,
        Proveedor_Externo: ti ? (d.Proveedor_Externo || '') : '',
        Especialista: ti ? (d.Especialista || '') : '',
        Estado: 'Abierto',
        Conformidad: 'Pendiente',
        Es_Reincidente: 'NO',
        _actualizado: ahora,
        _actualizadoPor: ctx.correo
      };
      if (ti && vacio(t.Solicitante)) throw new Error('Indique el solicitante.');
      const refTicket = db.collection('tickets').doc(id);
      tx.update(refContador, { siguiente: n + 1 });
      tx.set(refTicket, t);
      tx.set(refTicket.collection('historial').doc(), historial(ctx, 'Registro', 'Canal: ' + t.Canal + '. Tipo: ' + t.Tipo + '. Prioridad: ' + t.Prioridad + '.'));
      tx.set(db.collection('correos').doc(id + '_creado'), { ticket: id, tipo: 'creado', creado: ahora });
      return id;
    });
  }

  function historial(ctx, accion, detalle) {
    return { Fecha: ctx.FieldValue.serverTimestamp(), Usuario: ctx.usuario.nombre, Correo: ctx.correo, Accion: accion, Detalle: detalle || '' };
  }

  /** Fecha elegida en el formulario, o la hora del servidor si no se indicó. Del mismo minuto que la apertura → la apertura. */
  function fechaAccion(ctx, v, t) {
    if (vacio(v)) return ctx.FieldValue.serverTimestamp();
    const f = aFecha(v), a = aFecha(t.Fecha_Apertura);
    if (a && f < a && a - f < 60000) return a;
    if (a && f < a) throw new Error('La fecha no puede ser anterior a la apertura.');
    if (f > new Date()) throw new Error('La fecha no puede estar en el futuro.');
    return f;
  }

  /** Arma los cambios de una acción del flujo (mismas validaciones que ticketAccion_) */
  function cambiosDe(ctx, t, accion, d) {
    const cambios = {};
    let detalle = '';
    let aviso = null;
    const exigirTI = () => { if (!ctx.esTI) throw new Error('Solo el personal de TI puede realizar esta acción.'); };
    const exigirEstado = (lista, texto) => { if (lista.indexOf(t.Estado) === -1) throw new Error('No se puede ' + texto + ' un ticket en estado "' + t.Estado + '".'); };

    switch (accion) {
      case 'clasificar':
        exigirTI(); exigirEstado(ESTADOS_ACTIVOS.concat(['Resuelto']), 'clasificar');
        ['Tipo', 'Categoria', 'Prioridad', 'Nivel_Escalamiento', 'Proveedor_Externo', 'Especialista', 'Codigo_Activo'].forEach(k => { if (d[k] !== undefined) cambios[k] = d[k]; });
        if (cambios.Nivel_Escalamiento === NIVEL_3) {
          if (vacio(cambios.Proveedor_Externo !== undefined ? cambios.Proveedor_Externo : t.Proveedor_Externo)) throw new Error('Indique el proveedor externo para escalar a nivel 3.');
          if (t.Estado !== 'Resuelto') cambios.Estado = 'En Espera de Tercero';
        } else if (t.Estado === 'En Espera de Tercero' && cambios.Nivel_Escalamiento) {
          cambios.Estado = 'En Proceso';
        }
        detalle = Object.keys(cambios).map(k => k + ': ' + (cambios[k] || '—')).join('. ');
        break;
      case 'iniciar':
        exigirTI(); exigirEstado(['Abierto', 'Reabierto', 'En Espera de Tercero'], 'iniciar la atención de');
        if (!t.Fecha_Inicio_Atencion) cambios.Fecha_Inicio_Atencion = fechaAccion(ctx, d.fecha, t);
        cambios.Estado = 'En Proceso';
        if (vacio(t.Especialista)) cambios.Especialista = ctx.usuario.nombre;
        detalle = 'Inicio de atención';
        break;
      case 'resolver': {
        exigirTI(); exigirEstado(ESTADOS_ACTIVOS, 'resolver');
        if (vacio(d.Diagnostico_Solucion)) throw new Error('Describa el diagnóstico y la solución.');
        const f = fechaAccion(ctx, d.fecha, t);
        cambios.Diagnostico_Solucion = d.Diagnostico_Solucion;
        cambios.Fecha_Solucion = f;
        if (!t.Fecha_Inicio_Atencion) cambios.Fecha_Inicio_Atencion = f;
        if (vacio(t.Especialista)) cambios.Especialista = ctx.usuario.nombre;
        cambios.Estado = 'Resuelto';
        cambios.Conformidad = 'Pendiente';
        detalle = 'Solución registrada: ' + d.Diagnostico_Solucion;
        aviso = 'resuelto';
        break;
      }
      case 'conformidad': {
        if (!ctx.esTI && String(t.Solicitante_Email).toLowerCase() !== ctx.correo) throw new Error('Solo el solicitante puede dar la conformidad.');
        exigirEstado(['Resuelto'], 'dar conformidad a');
        const cal = vacio(d.Calificacion) ? null : Number(d.Calificacion);
        if (cal !== null && !(Number.isInteger(cal) && cal >= 1 && cal <= 5)) throw new Error('La calificación va de 1 a 5.');
        if (d.conforme === true || d.conforme === 'SI') {
          cambios.Estado = 'Cerrado';
          cambios.Fecha_Cierre = ctx.FieldValue.serverTimestamp();
          cambios.Conformidad = 'Conforme';
          detalle = 'Usuario conforme' + (cal ? ' (calificación ' + cal + ')' : '');
        } else {
          if (vacio(d.Comentario_Usuario)) throw new Error('Indique por qué no está conforme.');
          cambios.Estado = 'Reabierto';
          cambios.Conformidad = 'No Conforme';
          cambios.Fecha_Solucion = null;
          detalle = 'Reapertura por no conformidad: ' + d.Comentario_Usuario;
          aviso = 'reabierto';
        }
        cambios.Calificacion = cal;
        cambios.Comentario_Usuario = d.Comentario_Usuario || '';
        break;
      }
      case 'cerrarTI':
        exigirTI(); exigirEstado(['Resuelto'], 'cerrar');
        if (vacio(d.justificacion)) throw new Error('Indique cómo se confirmó el restablecimiento del servicio.');
        cambios.Estado = 'Cerrado';
        cambios.Fecha_Cierre = ctx.FieldValue.serverTimestamp();
        cambios.Conformidad = 'Cerrado por TI';
        detalle = 'Cierre por TI: ' + d.justificacion;
        break;
      case 'reincidencia': {
        exigirTI();
        const es = d.Es_Reincidente === true || d.Es_Reincidente === 'SI';
        if (es && vacio(d.Ticket_Origen)) throw new Error('Indique el ticket de origen.');
        if (es && d.Ticket_Origen === t.ID_Ticket) throw new Error('El ticket de origen no puede ser el mismo.');
        cambios.Es_Reincidente = es ? 'SI' : 'NO';
        cambios.Ticket_Origen = es ? d.Ticket_Origen : '';
        detalle = es ? 'Marcado como reincidente de ' + d.Ticket_Origen : 'Desmarcado como reincidente';
        break;
      }
      case 'lecciones':
        exigirTI();
        if (vacio(d.Lecciones_Aprendidas)) throw new Error('Escriba la lección aprendida.');
        cambios.Lecciones_Aprendidas = d.Lecciones_Aprendidas;
        // El artículo de la base de conocimiento lo crea Apps Script (vive en la hoja)
        if (d.publicarKB && vacio(t.ID_Articulo_KB)) cambios._publicarKB = true;
        detalle = 'Lección aprendida documentada' + (cambios._publicarKB ? ' (se publicará en la base de conocimiento)' : '');
        break;
      case 'editar':
        exigirTI();
        if (t.Estado === 'Cerrado' || t.Estado === 'Anulado') throw new Error('Un ticket cerrado o anulado ya no se corrige.');
        ['Canal', 'Solicitante', 'Solicitante_Email', 'Departamento', 'Titulo', 'Descripcion', 'Diagnostico_Solucion'].forEach(k => { if (d[k] !== undefined) cambios[k] = d[k]; });
        ['Fecha_Apertura', 'Fecha_Inicio_Atencion', 'Fecha_Solucion'].forEach(k => { if (d[k] !== undefined) cambios[k] = vacio(d[k]) ? null : aFecha(d[k]); });
        detalle = 'Corrección de datos: ' + Object.keys(cambios).join(', ');
        break;
      case 'anular':
        exigirTI(); exigirEstado(ESTADOS_ACTIVOS, 'anular');
        if (vacio(d.motivo)) throw new Error('Indique el motivo (p. ej. duplicado de otro ticket).');
        cambios.Estado = 'Anulado';
        detalle = 'Anulado: ' + d.motivo;
        break;
      default:
        throw new Error('Acción no válida: ' + accion);
    }
    return { cambios, detalle, aviso };
  }

  /** Aplica una acción: actualiza el ticket, agrega la bitácora y, si corresponde, el aviso por correo, todo junto */
  async function accion(ctx, t, tipo, d) {
    const { db, FieldValue } = ctx;
    const { cambios, detalle, aviso } = cambiosDe(ctx, t, tipo, d || {});
    cambios._actualizado = FieldValue.serverTimestamp();
    cambios._actualizadoPor = ctx.correo;
    const ref = db.collection('tickets').doc(t.ID_Ticket);
    const lote = db.batch();
    lote.update(ref, cambios);
    lote.set(ref.collection('historial').doc(), historial(ctx, ETIQUETAS[tipo] || tipo, detalle));
    if (aviso) lote.set(db.collection('correos').doc(t.ID_Ticket + '_' + aviso), { ticket: t.ID_Ticket, tipo: aviso, creado: FieldValue.serverTimestamp() });
    await lote.commit();
    return cambios;
  }

  return { crear, accion, cambiosDe, aFecha, ESTADOS_ACTIVOS };
});
