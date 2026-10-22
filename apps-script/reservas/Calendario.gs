// Fechas y horas de reservas. Bogotá es UTC-5 fijo (sin horario de verano), así que
// se resta 5 h al epoch y se lee con getUTC*: funciona igual en Node y en Apps Script,
// sin depender de la zona horaria de quien ejecute.

var DESFASE_BOGOTA_MS = 5 * 3600000;
var INICIO_SERVICIO_MIN = 960; // 16:00
var DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var MESES_ANIO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// instanceof falla entre contextos (vm de pruebas, servicios de Google): se compara por etiqueta.
function esFecha(v) { return Object.prototype.toString.call(v) === "[object Date]"; }

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function aFechaTexto(d) {
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

function hoyBogota(ms) {
  return aFechaTexto(new Date(ms - DESFASE_BOGOTA_MS));
}

function diaSemana(fecha) {
  return new Date(fecha + 'T00:00:00Z').getUTCDay();
}

// Una hora antes de las 16:00 es madrugada de la misma fecha de servicio: 00:00 -> 1440.
function horaAMinutos(hora) {
  var p = String(hora).split(':');
  var m = Number(p[0]) * 60 + Number(p[1]);
  return m < INICIO_SERVICIO_MIN ? m + 1440 : m;
}

function minutosAHora(n) {
  var m = n % 1440;
  return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
}

// "20:00" -> "8:00 PM"; "00:00" -> "12:00 AM"
function hora12(hora) {
  var m = /^(\d{1,2}):(\d{2})/.exec(String(hora || ''));
  if (!m) return String(hora === undefined || hora === null ? '' : hora);
  var h = Number(m[1]);
  return ((h % 12) || 12) + ':' + m[2] + (h < 12 ? ' AM' : ' PM');
}

// "2026-10-23" -> "viernes 23 de octubre de 2026"
function fechaLarga(fecha) {
  var d = new Date(fecha + 'T00:00:00Z');
  if (isNaN(d.getTime())) return String(fecha || '');
  return DIAS_SEMANA[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MESES_ANIO[d.getUTCMonth()] + ' de ' + d.getUTCFullYear();
}

// "12:00 AM" solo es ambiguo: una hora de madrugada se nombra con la noche a la que pertenece
// (00:00 del viernes -> "12:00 AM (noche del viernes al sábado)").
function etiquetaHoraServicio(fecha, hora) {
  var texto = hora12(hora);
  if (!/^\d{1,2}:\d{2}/.test(String(hora || '')) || horaAMinutos(hora) < 1440) return texto;
  var d = diaSemana(fecha);
  if (isNaN(d)) return texto;
  return texto + ' (noche del ' + DIAS_SEMANA[d] + ' al ' + DIAS_SEMANA[(d + 1) % 7] + ')';
}

// Instante real: 00:00 del viernes es sábado 00:00 en el reloj.
function instanteMs(fecha, hora) {
  return Date.parse(fecha + 'T00:00:00Z') + DESFASE_BOGOTA_MS + horaAMinutos(hora) * 60000;
}

function normalizarFecha(valor) {
  if (esFecha(valor)) {
    if (isNaN(valor.getTime())) return '';
    return aFechaTexto(new Date(valor.getTime() - DESFASE_BOGOTA_MS));
  }
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor === undefined || valor === null ? '' : valor).trim());
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

function normalizarHora(valor) {
  if (esFecha(valor)) {
    if (isNaN(valor.getTime())) return '';
    // Sheets guarda las horas como Date de 1899 con el desfase histórico de Bogotá (-4:56):
    // se redondea a la media hora más cercana para absorber esos minutos.
    var d = new Date(valor.getTime() - DESFASE_BOGOTA_MS);
    var total = Math.round((d.getUTCHours() * 60 + d.getUTCMinutes()) / 30) * 30;
    return minutosAHora(total % 1440);
  }
  var m = /^(\d{1,2}):(\d{2})/.exec(String(valor === undefined || valor === null ? '' : valor).trim());
  return m ? pad2(Number(m[1])) + ':' + m[2] : '';
}

// Horas de inicio posibles: desde la apertura hasta (cierre - margen), en pasos de intervalo_min.
function horasDelDia(fecha, espacio, cfg) {
  var h = HORARIO[diaSemana(fecha)];
  var margen = espacio === 'VIP' ? cfg.vip_ultima_antes_cierre_min : cfg.mesa_ultima_antes_cierre_min;
  var paso = cfg.intervalo_min;
  var ultima = Math.floor((h.cierra - margen - h.abre) / paso) * paso + h.abre;
  var horas = [];
  for (var m = h.abre; m <= ultima; m += paso) horas.push(minutosAHora(m));
  return horas;
}

// Suma meses calendario a una fecha 'yyyy-MM-dd' (31-ene + 1 mes -> 28/29-feb).
function sumarMeses(fecha, meses) {
  var p = fecha.split('-').map(Number);
  var total = p[0] * 12 + (p[1] - 1) + meses;
  var anio = Math.floor(total / 12);
  var mes = total % 12;
  var ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return anio + '-' + pad2(mes + 1) + '-' + pad2(Math.min(p[2], ultimoDia));
}

function fechaHabilitada(fecha, sede, ahoraMs, cfg, bloqueos) {
  var aplica = (bloqueos || []).filter(function (b) {
    return b.fecha === fecha && (b.sede === 'TODAS' || b.sede === sede);
  });
  if (aplica.some(function (b) { return b.tipo === 'BLOQUEAR'; })) return false;
  var hoy = hoyBogota(ahoraMs);
  if (fecha < hoy || fecha > sumarMeses(hoy, cfg.max_meses)) return false;
  if (aplica.some(function (b) { return b.tipo === 'ABRIR'; })) return true;
  return cfg.dias_reserva.indexOf(diaSemana(fecha)) !== -1;
}
