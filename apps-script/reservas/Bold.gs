// Cliente de Bold (links de pago). armarLink y leerEstadoLink son puros; clienteBold usa la red.

var BOLD_URL_BASE = 'https://integrations.api.bold.co';
var ESTADOS_BOLD = ['ACTIVE', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED', 'EXPIRED'];

function armarLink(reserva, cfg, ahoraMs) {
  var descripcion = 'Reserva ' + reserva.codigo + ' · ' + (NOMBRE_SEDE[reserva.sede] || reserva.sede) +
    ' · ' + reserva.fecha + ' ' + reserva.hora;
  return {
    amount_type: 'CLOSE',
    amount: { currency: 'COP', total_amount: cfg.adelanto, tip_amount: 0 },
    reference: reserva.codigo,
    description: descripcion.slice(0, 100),
    payer_email: reserva.correo,
    callback_url: cfg.url_sitio + '/reservas/?codigo=' + reserva.codigo,
    // Unidad por confirmar en el sandbox (Task 6): aquí milisegundos desde epoch.
    // TODO sandbox: confirmar en Task 6 si Bold espera ms, segundos o nanosegundos y ajustar aquí y en bold.test.js.
    expiration_date: ahoraMs + cfg.apartado_min * 60000
  };
}

// El estado puede venir en la raíz o dentro de payload; lo desconocido se trata como ACTIVE.
function leerEstadoLink(respuesta) {
  var estado = '';
  if (respuesta) {
    var s = respuesta.status || (respuesta.payload && respuesta.payload.status);
    estado = String(s || '').toUpperCase();
  }
  if (ESTADOS_BOLD.indexOf(estado) !== -1) return estado;
  // Solo nombres de campos y el estado leído: la respuesta trae el correo del pagador.
  console.error('Bold devolvió un estado desconocido: ' + formaRespuesta(respuesta, estado));
  return 'ACTIVE';
}

function formaRespuesta(respuesta, estado) {
  var esObjeto = function (x) { return !!x && typeof x === 'object'; };
  return JSON.stringify({
    estado: estado,
    campos: esObjeto(respuesta) ? Object.keys(respuesta) : typeof respuesta,
    payload: esObjeto(respuesta) && esObjeto(respuesta.payload) ? Object.keys(respuesta.payload) : null
  });
}

function clienteBold(llaveIdentidad) {
  function llamar(metodo, ruta, cuerpo) {
    var opciones = {
      method: metodo,
      muteHttpExceptions: true,
      headers: { Authorization: 'x-api-key ' + llaveIdentidad }
    };
    if (cuerpo) { opciones.contentType = 'application/json'; opciones.payload = JSON.stringify(cuerpo); }
    var resp;
    try { resp = UrlFetchApp.fetch(BOLD_URL_BASE + ruta, opciones); } catch (e) { throw new Error('BOLD'); }
    var codigo = resp.getResponseCode();
    if (codigo < 200 || codigo >= 300) throw new Error('BOLD');
    try { return JSON.parse(resp.getContentText()); } catch (e2) { throw new Error('BOLD'); }
  }
  return {
    crearLink: function (payload) {
      var r = llamar('post', '/online/link/v1', payload);
      var cuerpo = r && r.payload;
      if (!cuerpo || !cuerpo.payment_link || !cuerpo.url) throw new Error('BOLD');
      return { id: cuerpo.payment_link, url: cuerpo.url };
    },
    consultarLink: function (id) {
      return leerEstadoLink(llamar('get', '/online/link/v1/' + encodeURIComponent(id)));
    }
  };
}
