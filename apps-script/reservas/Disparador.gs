// Revisión periódica de pagos: cubre al cliente que pagó y cerró la página sin volver al sitio,
// y libera los apartados vencidos.

function revisarPendientes() {
  return revisarPendientesCon(depsReales());
}

function revisarPendientesCon(deps) {
  var cfg = deps.hoja.leerConfig();
  var resumen = { revisadas: 0, errores: 0 };
  deps.hoja.leerReservas().forEach(function (r) {
    if (r.estado !== 'PENDIENTE_PAGO' && !debeConsultarBold(r, deps.ahora())) return;
    resumen.revisadas++;
    try {
      // Si Bold dice que no está pagada y ya venció, se libera el cupo. Un pago que entre después
      // se sigue consultando 24 h (pago tardío).
      var x = refrescarConBold(r, deps, cfg);
      if (x.estado === 'PENDIENTE_PAGO' && Date.parse(x.vence) <= deps.ahora()) vencerEnHoja(x.codigo, deps);
    } catch (e) {
      resumen.errores++;
      console.error('Revisión de ' + r.codigo + ' falló: ' + (e && e.stack || e));
    }
  });
  return resumen;
}

function vencerEnHoja(codigo, deps) {
  deps.bloqueo(function () {
    var actual = deps.hoja.buscarPorCodigo(codigo);
    if (!actual) return;
    var v = vencerSiCorresponde(actual, deps.ahora());
    if (v.cambio) deps.hoja.actualizar(v.reserva);
  });
}

function instalarDisparador() {
  var ya = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'revisarPendientes';
  });
  if (ya) return;
  ScriptApp.newTrigger('revisarPendientes').timeBased().everyMinutes(5).create();
}
