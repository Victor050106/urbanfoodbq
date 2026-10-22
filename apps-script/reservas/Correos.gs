// Plantillas de correo (puras) y envío. Todo valor interpolado pasa por escaparHtml.

var DIRECCION_SEDE = {
  ELCARMEN: 'Calle 53D # 19-06, Barranquilla',
  HIPODROMO: 'Cra. 29 # 26-04, Soledad'
};

function escaparHtml(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 50000 -> "$50.000"
function formatoPesos(n) {
  return '$' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Con los valores por defecto da el texto fijo de la política; Bold cobra cfg.adelanto, así que el texto sale de ahí.
function textoPolitica(cfg) {
  return 'El adelanto de ' + formatoPesos(cfg.adelanto) + ' se descuenta de tu cuenta. Si cancelas con ' +
    cfg.cancelacion_horas + ' horas o más de anticipación te lo devolvemos. Si cancelas después o no llegas, no se devuelve.';
}

function nombreSede(sede) { return NOMBRE_SEDE[sede] || sede; }

function envolver(titulo, cuerpo) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#111;color:#f2f2f2">' +
    '<h2 style="margin:0 0 16px;color:#FF6B00">' + escaparHtml(titulo) + '</h2>' + cuerpo +
    '<p style="margin:24px 0 0;font-size:12px;color:#999">Urban Food</p></div>';
}

function parrafo(texto) { return '<p style="margin:0 0 12px;line-height:1.5">' + texto + '</p>'; }

function detalleReserva(r) {
  var filas = [
    ['Código', r.codigo],
    ['Sede', nombreSede(r.sede)],
    ['Fecha', fechaLarga(r.fecha)],
    ['Hora', etiquetaHoraServicio(r.fecha, r.hora)],
    ['Personas', r.personas]
  ];
  return '<table style="border-collapse:collapse;margin:0 0 16px">' + filas.map(function (f) {
    return '<tr><td style="padding:4px 12px 4px 0;color:#999">' + f[0] + '</td><td style="padding:4px 0"><strong>' +
      escaparHtml(f[1]) + '</strong></td></tr>';
  }).join('') + '</table>';
}

function enlaceCancelar(r, cfg) {
  return cfg.url_sitio + '/reservas/cancelar/?t=' + encodeURIComponent(r.token_cancelar);
}

function correoConfirmacion(reserva, cfg) {
  var url = enlaceCancelar(reserva, cfg);
  var cuerpo = parrafo('Hola ' + escaparHtml(reserva.nombre) + ', tu reserva está confirmada.') +
    detalleReserva(reserva) +
    parrafo('Te esperamos en ' + escaparHtml(DIRECCION_SEDE[reserva.sede] || '') + '.') +
    parrafo(escaparHtml(textoPolitica(cfg))) +
    parrafo('Si necesitas cancelar: <a style="color:#1ABC9C" href="' + escaparHtml(url) + '">cancelar mi reserva</a>');
  return { asunto: 'Reserva confirmada ' + reserva.codigo + ' - Urban Food', html: envolver('Reserva confirmada', cuerpo) };
}

function correoCancelacion(reserva, cfg) {
  var conDevolucion = reserva.estado === 'CANCELADA_CON_DEVOLUCION';
  var aviso = conDevolucion
    ? 'Cancelaste con tiempo, así que te devolvemos el adelanto de ' + formatoPesos(cfg.adelanto) + '. Te escribiremos para coordinar la devolución.'
    : 'Por la anticipación con que cancelaste, el adelanto de ' + formatoPesos(cfg.adelanto) + ' no se devuelve.';
  var cuerpo = parrafo('Hola ' + escaparHtml(reserva.nombre) + ', tu reserva fue cancelada.') +
    detalleReserva(reserva) + parrafo(escaparHtml(aviso)) + parrafo(escaparHtml(textoPolitica(cfg)));
  return { asunto: 'Reserva cancelada ' + reserva.codigo + ' - Urban Food', html: envolver('Reserva cancelada', cuerpo) };
}

function datosCliente(r) {
  return '<p style="margin:0 0 12px;line-height:1.5">' + escaparHtml(r.nombre) + ' (' + escaparHtml(r.tipo_doc) + ' ' +
    escaparHtml(r.documento) + ')<br>' + escaparHtml(r.celular) + ' · ' + escaparHtml(r.correo) + '</p>';
}

function correoSedeNueva(reserva) {
  var cuerpo = detalleReserva(reserva) + datosCliente(reserva) +
    parrafo('Espacio: ' + escaparHtml(reserva.espacio)) +
    (reserva.comentario ? parrafo('Comentario: ' + escaparHtml(reserva.comentario)) : '');
  return { asunto: 'Nueva reserva ' + reserva.codigo + ' - ' + nombreSede(reserva.sede), html: envolver('Nueva reserva', cuerpo) };
}

function correoSedeCancelada(reserva) {
  var cuerpo = detalleReserva(reserva) + datosCliente(reserva) +
    parrafo('Estado: ' + escaparHtml(reserva.estado));
  return { asunto: 'Reserva cancelada ' + reserva.codigo + ' - ' + nombreSede(reserva.sede), html: envolver('Reserva cancelada', cuerpo) };
}

function correoAdminDevolucion(reserva, cfg) {
  // Bold solo anula o reembolsa pagos con tarjeta; Nequi, PSE y transferencias se devuelven a mano.
  var cuerpo = parrafo('Hay que devolver el adelanto de ' + formatoPesos(cfg.adelanto) + '. Si pagó con tarjeta, desde el panel de Bold; ' +
    'si pagó con Nequi, PSE o transferencia, Bold no lo devuelve: hay que transferirle y avisarle.') +
    detalleReserva(reserva) + datosCliente(reserva) +
    parrafo('Link de pago Bold: ' + escaparHtml(reserva.bold_link));
  return { asunto: 'Devolución pendiente ' + reserva.codigo, html: envolver('Devolución pendiente', cuerpo) };
}

function correoAdminPagoSinCupo(reserva) {
  var cuerpo = parrafo('El cliente pagó después de vencer el apartado y el cupo ya lo ocupó otra reserva. Hay que devolver el adelanto y avisarle.') +
    detalleReserva(reserva) + datosCliente(reserva) +
    parrafo('Link de pago Bold: ' + escaparHtml(reserva.bold_link));
  return { asunto: 'Pago sin cupo ' + reserva.codigo, html: envolver('Pago sin cupo', cuerpo) };
}

// Sin destinatario (Config sin llenar) no se envía y nada falla.
function enviarCorreo(para, msg) {
  if (!para) return;
  MailApp.sendEmail({ to: para, subject: msg.asunto, htmlBody: msg.html, name: 'Urban Food' });
}
