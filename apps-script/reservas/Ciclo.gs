// Ciclo de vida de la reserva: estados, pagos de Bold, cancelación, marcas de la cajera
// y token del panel. Todo es puro: recibe una reserva y devuelve una copia nueva.

var ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I/L para dictarlo por teléfono
var SEDES_PANEL = ['ELCARMEN', 'HIPODROMO'];
var VIGENCIA_PANEL_MS = 14 * 3600000;
// Bold respondió EXPIRED/CANCELLED: el link ya no se puede pagar y no hace falta seguir preguntando.
var NOTA_BOLD_CERRADO = '[link Bold cerrado]';

function copiarReserva(r) {
  var c = {};
  Object.keys(r).forEach(function (k) { c[k] = r[k]; });
  return c;
}

function iso(ms) { return new Date(ms).toISOString(); }

function generarCodigo(aleatorio) {
  var s = '';
  for (var i = 0; i < 6; i++) s += ALFABETO_CODIGO.charAt(Math.floor(aleatorio() * ALFABETO_CODIGO.length));
  return 'UF-' + s;
}

function nuevaReserva(limpio, espacio, ahoraMs, cfg, ids) {
  return {
    codigo: ids.codigo,
    creada: iso(ahoraMs),
    sede: limpio.sede,
    espacio: espacio,
    fecha: limpio.fecha,
    hora: limpio.hora,
    personas: limpio.personas,
    nombre: limpio.nombre,
    tipo_doc: limpio.tipo_doc,
    documento: limpio.documento,
    correo: limpio.correo,
    celular: limpio.celular,
    comentario: limpio.comentario || '',
    estado: 'PENDIENTE_PAGO',
    bold_link: '',
    bold_url: '',
    vence: iso(ahoraMs + cfg.apartado_min * 60000),
    pagada_en: '',
    token_cancelar: ids.token,
    devolucion: 'NO',
    descuento_aplicado: false,
    marcada_en: '',
    notas: ''
  };
}

function sinCambio(reserva) { return { reserva: reserva, cambio: false, evento: null }; }

function aplicarEstadoBold(reserva, estadoBold, ahoraMs, cupoLibre) {
  var r = copiarReserva(reserva);
  var pendiente = r.estado === 'PENDIENTE_PAGO';

  if (estadoBold === 'PAID') {
    var vence = Date.parse(r.vence);
    var tardio = pendiente || r.estado === 'EXPIRADA' || r.estado === 'RECHAZADA';
    var vigente = pendiente && !isNaN(vence) && vence > ahoraMs;
    // Un apartado vigente ya tiene su cupo; uno vencido o expirado debe volver a ganarlo.
    if (vigente || ((tardio) && cupoLibre)) {
      r.estado = 'CONFIRMADA'; r.pagada_en = iso(ahoraMs); r.vence = '';
      return { reserva: r, cambio: true, evento: 'CONFIRMADA' };
    }
    if (tardio) {
      r.estado = 'PAGO_SIN_CUPO'; r.pagada_en = iso(ahoraMs); r.vence = ''; r.devolucion = 'PENDIENTE';
      return { reserva: r, cambio: true, evento: 'PAGO_SIN_CUPO' };
    }
    return sinCambio(reserva);
  }
  if (pendiente && (estadoBold === 'REJECTED' || estadoBold === 'CANCELLED')) {
    r.estado = 'RECHAZADA';
    return { reserva: r, cambio: true, evento: 'RECHAZADA' };
  }
  if (pendiente && estadoBold === 'EXPIRED') {
    r.estado = 'EXPIRADA';
    return { reserva: r, cambio: true, evento: 'EXPIRADA' };
  }
  return sinCambio(reserva); // ACTIVE, PROCESSING y cualquier otro: seguimos esperando
}

function boldCerrado(reserva) {
  return String(reserva.notas || '').indexOf(NOTA_BOLD_CERRADO) !== -1;
}

function marcarBoldCerrado(reserva) {
  var r = copiarReserva(reserva);
  if (!boldCerrado(r)) r.notas = r.notas ? r.notas + ' ' + NOTA_BOLD_CERRADO : NOTA_BOLD_CERRADO;
  return r;
}

function vencerSiCorresponde(reserva, ahoraMs) {
  var vence = Date.parse(reserva.vence);
  if (reserva.estado !== 'PENDIENTE_PAGO' || isNaN(vence) || vence > ahoraMs) {
    return { reserva: reserva, cambio: false };
  }
  var r = copiarReserva(reserva);
  r.estado = 'EXPIRADA';
  return { reserva: r, cambio: true };
}

function evaluarCancelacion(reserva, ahoraMs, cfg) {
  if (reserva.estado !== 'CONFIRMADA') return { puede: false, conDevolucion: false, motivo: 'ESTADO' };
  // Instante real de la reserva: 00:00 de un viernes es sábado en el reloj.
  var faltan = instanteMs(reserva.fecha, reserva.hora) - ahoraMs;
  if (faltan <= 0) return { puede: false, conDevolucion: false, motivo: 'PASADA' };
  return { puede: true, conDevolucion: faltan >= cfg.cancelacion_horas * 3600000 };
}

function cancelar(reserva, ahoraMs, cfg) {
  var ev = evaluarCancelacion(reserva, ahoraMs, cfg);
  if (!ev.puede) throw new Error('NO_CANCELABLE');
  var r = copiarReserva(reserva);
  r.estado = ev.conDevolucion ? 'CANCELADA_CON_DEVOLUCION' : 'CANCELADA_SIN_DEVOLUCION';
  r.devolucion = ev.conDevolucion ? 'PENDIENTE' : 'NO';
  r.marcada_en = iso(ahoraMs);
  return r;
}

function marcarPanel(reserva, marca, ahoraMs) {
  if (['CONFIRMADA', 'LLEGO', 'NO_LLEGO'].indexOf(reserva.estado) === -1) throw new Error('NO_MARCABLE');
  var r = copiarReserva(reserva);
  if (marca === 'DESCUENTO') {
    if (r.descuento_aplicado === true) return { reserva: reserva, cambio: false };
    r.descuento_aplicado = true;
  } else if (marca === 'LLEGO' || marca === 'NO_LLEGO') {
    if (r.estado === marca) return { reserva: reserva, cambio: false };
    r.estado = marca;
  } else {
    throw new Error('MARCA');
  }
  r.marcada_en = iso(ahoraMs);
  return { reserva: r, cambio: true };
}

// Comparación sin salida temprana: no filtra por tiempo cuántos caracteres coinciden.
function igualesConstante(x, y) {
  var d = x.length ^ y.length;
  var n = Math.max(x.length, y.length);
  for (var i = 0; i < n; i++) d |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return d === 0;
}

function crearTokenPanel(sede, ahoraMs, hmacHex) {
  var expira = ahoraMs + VIGENCIA_PANEL_MS;
  return sede + '.' + expira + '.' + hmacHex(sede + '.' + expira);
}

function verificarTokenPanel(token, ahoraMs, hmacHex) {
  var p = String(token === undefined || token === null ? '' : token).split('.');
  if (p.length !== 3 || SEDES_PANEL.indexOf(p[0]) === -1 || !/^\d+$/.test(p[1])) return null;
  var buena = igualesConstante(hmacHex(p[0] + '.' + p[1]), p[2]);
  if (!buena || Number(p[1]) < ahoraMs) return null;
  return p[0];
}

function resumenPublico(reserva) {
  return {
    codigo: reserva.codigo, sede: reserva.sede, espacio: reserva.espacio,
    fecha: reserva.fecha, hora: reserva.hora, personas: reserva.personas,
    nombre_corto: String(reserva.nombre || '').trim().split(/\s+/)[0],
    estado: reserva.estado
  };
}
