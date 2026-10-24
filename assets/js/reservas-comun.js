// Utilidades compartidas por la página de reservas y el panel de la cajera.
// Lo puro (formatos, calendario, enlaces) se prueba en tests/reservas/comun.test.js.

// URL del despliegue "/exec" del Apps Script de reservas (proyecto "Urban Food Reservas" de la hoja
// "Urban Food - Reservas"). Si se deja vacía, la página avisa que las reservas llegan pronto y ofrece WhatsApp.
var RESERVAS_API_URL = 'https://script.google.com/macros/s/AKfycbxivUUZIYuM9FJ0TvJWLc8hcAOmspxMkb_KSXWw1WKFRh3OG_BNxAKMeKFvqDnPg1Co/exec';

var TZ_RESERVAS = 'America/Bogota';

// Mismos datos que SEDES en assets/js/config.js.
var SEDES_RESERVA = {
  ELCARMEN: {
    nombre: 'El Carmen',
    direccion: 'Calle 53D # 19-06, Barranquilla',
    mapa: 'https://www.google.com/maps?q=Calle+53D+%23+19-06,+Barranquilla',
    whatsapp: '573127557694'
  },
  HIPODROMO: {
    nombre: 'Hipódromo',
    direccion: 'Cra. 29 # 26-04, Soledad, Atlántico',
    mapa: 'https://www.google.com/maps?q=Cra.+29+%23+26-04,+Soledad,+Atl%C3%A1ntico',
    whatsapp: '573226070697'
  }
};

var MENSAJES_ERROR = {
  RED: 'No pudimos conectarnos. Revisa tu internet e intenta de nuevo.',
  INTERNO: 'Algo salió mal de nuestro lado. Intenta de nuevo en un momento.',
  PARAMETROS: 'Faltan datos para continuar. Revisa el formulario.',
  ACCION: 'Algo salió mal de nuestro lado. Intenta de nuevo en un momento.',
  SEDE: 'Elige una sede.',
  // Sin números: los límites salen de la hoja Config y cambian sin tocar el código.
  PERSONAS: 'Ese grupo es muy pequeño para reservar en línea. Revisa el número de personas.',
  GRUPO_GRANDE: 'Para un grupo de ese tamaño escríbenos por WhatsApp.',
  FECHA: 'Esa fecha no es válida. Elige otro día.',
  HORA: 'Esa hora no está disponible. Elige otra.',
  NOMBRE: 'Escribe tu nombre completo (entre 3 y 60 letras).',
  DOCUMENTO: 'Revisa tu documento: entre 5 y 15 letras o números, sin símbolos.',
  CORREO: 'Revisa tu correo, parece incompleto.',
  CELULAR: 'Escribe tu celular de 10 dígitos, por ejemplo 300 123 4567.',
  AUTORIZACION: 'Para continuar acepta la autorización de datos y la política de reserva.',
  SIN_CUPO: 'Ese horario se acaba de ocupar. Elige otra hora.',
  BOLD: 'No pudimos abrir el pago. Intenta de nuevo en un momento.',
  NO_ENCONTRADA: 'No encontramos esa reserva.',
  CONFIGURACION: 'El servicio aún no está configurado. Avísale al administrador.',
  CLAVE: 'Clave incorrecta.',
  TOKEN: 'Tu sesión expiró, vuelve a entrar.',
  PERMISO: 'Esa reserva es de otra sede.',
  NO_MARCABLE: 'Esta reserva no se puede marcar en su estado actual.',
  MARCA: 'Esa marca no es válida.',
  NO_CANCELABLE: 'Esta reserva ya no se puede cancelar.',
  BLOQUEADO: 'Demasiados intentos. Espera unos minutos.'
};

var MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function escapeHtml(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatoPesos(n) {
  return '$' + String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatoHora(hhmm) {
  var p = String(hhmm).split(':');
  var h = Number(p[0]);
  var sufijo = h >= 12 ? 'PM' : 'AM';
  return ((h % 12) || 12) + ':' + p[1] + ' ' + sufijo;
}

// Las fechas son texto yyyy-MM-dd; se calculan en UTC para que la zona del visitante no las corra.
function fechaUtc(fecha) {
  var p = fecha.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
}

// Una hora antes de las 16:00 es madrugada de la noche de servicio (misma regla que el servidor).
function esMadrugada(hhmm) { return Number(String(hhmm).split(':')[0]) < 16; }

// Nota corta para los botones de hora y el panel, donde la fecha ya se ve en pantalla.
function notaMadrugada(hhmm) { return esMadrugada(hhmm) ? 'madrugada' : ''; }

// Igual que etiquetaHoraServicio de Calendario.gs: "12:00 AM" solo es ambiguo, así que la madrugada
// nombra su noche ("12:00 AM (noche del viernes al sábado)").
function etiquetaHoraServicio(fecha, hhmm) {
  var texto = formatoHora(hhmm);
  if (!esMadrugada(hhmm)) return texto;
  var d = fechaUtc(fecha).getUTCDay();
  return texto + ' (noche del ' + DIAS_ES[d] + ' al ' + DIAS_ES[(d + 1) % 7] + ')';
}

function formatoFechaLarga(fecha) {
  var d = fechaUtc(fecha);
  return DIAS_ES[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MESES_ES[d.getUTCMonth()];
}

function nombreMes(mes) {
  var p = mes.split('-').map(Number);
  var n = MESES_ES[p[1] - 1];
  return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + p[0];
}

// Hoy en Bogotá como yyyy-MM-dd (en-CA da ese formato), sin depender de la zona del visitante.
function hoyBogota() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_RESERVAS, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// 'yyyy-MM' sumando n meses.
function sumarMeses(mes, n) {
  var p = mes.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1 + n, 1));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2);
}

// Casillas del mes empezando en lunes: null para el relleno inicial.
function cuadriculaMes(mes) {
  var p = mes.split('-').map(Number);
  var primero = new Date(Date.UTC(p[0], p[1] - 1, 1));
  var ultimo = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
  var celdas = [];
  for (var i = 0; i < (primero.getUTCDay() + 6) % 7; i++) celdas.push(null);
  for (var d = 1; d <= ultimo; d++) celdas.push(mes + '-' + ('0' + d).slice(-2));
  return celdas;
}

function aBasicoCalendario(fecha, minutos) {
  // minutos desde la medianoche de `fecha`; puede pasar de 1440.
  var d = new Date(fechaUtc(fecha).getTime() + minutos * 60000);
  var dos = function (n) { return ('0' + n).slice(-2); };
  return d.getUTCFullYear() + dos(d.getUTCMonth() + 1) + dos(d.getUTCDate()) + 'T' + dos(d.getUTCHours()) + dos(d.getUTCMinutes()) + '00';
}

// Evento de Google Calendar por lo que dura la reserva (duracion_min de Config). Una hora antes de las 16:00
// es madrugada de la noche siguiente (misma regla que el servidor).
function enlaceCalendario(r, duracionMin) {
  var p = r.hora.split(':').map(Number);
  var inicio = p[0] * 60 + p[1] + (p[0] < 16 ? 1440 : 0);
  var fin = inicio + (duracionMin || REGLAS_POR_DEFECTO.duracion_min);
  var sede = SEDES_RESERVA[r.sede] || { nombre: r.sede, direccion: '' };
  var q = [
    ['action', 'TEMPLATE'],
    ['text', 'Reserva en Urban Food ' + sede.nombre],
    ['dates', aBasicoCalendario(r.fecha, inicio) + '/' + aBasicoCalendario(r.fecha, fin)],
    ['ctz', TZ_RESERVAS],
    ['location', 'Urban Food ' + sede.nombre + ', ' + sede.direccion],
    ['details', 'Código de reserva: ' + r.codigo]
  ];
  return 'https://calendar.google.com/calendar/render?' + q.map(function (kv) {
    return kv[0] + '=' + encodeURIComponent(kv[1]);
  }).join('&');
}

// ---- Red ----

// Solo en desarrollo: localhost con ?api=local usa el servidor de tests/reservas/servidor-local.js.
function modoLocal() {
  return typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) &&
    new URLSearchParams(location.search).get('api') === 'local';
}

function apiBase() { return modoLocal() ? '/api' : RESERVAS_API_URL; }

function apiDisponible() { return apiBase() !== ''; }

// Apps Script a veces tarda medio minuto en entregar una respuesta que el script resolvió en 2 s
// (medido el 22/10/2026). Sin límite la página se quedaba cargando para siempre.
// Las escrituras esperan más: una respuesta tardía es mejor que un error cuando el cambio sí se hizo.
var API_ESPERA_LECTURA_MS = 20000;
var API_ESPERA_ESCRITURA_MS = 45000;

function pedirApi(url, opciones, esperaMs) {
  var control = typeof AbortController === 'function' ? new AbortController() : null;
  var reloj = control ? setTimeout(function () { control.abort(); }, esperaMs) : null;
  if (control) opciones.signal = control.signal;
  return fetch(url, opciones).then(function (r) { return r.json(); })
    .catch(function () { return { ok: false, error: 'RED' }; })
    .then(function (x) { clearTimeout(reloj); return x; });
}

// Las lecturas no cambian nada: si la primera se pierde, se repite una vez.
function apiGet(params) {
  var q = Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  var url = apiBase() + '?' + q;
  return pedirApi(url, {}, API_ESPERA_LECTURA_MS).then(function (r) {
    return r.error === 'RED' ? pedirApi(url, {}, API_ESPERA_LECTURA_MS) : r;
  });
}

// text/plain evita el preflight CORS que Apps Script no contesta.
// Sin reintento: una escritura repetida podría hacerse dos veces. Quien llama decide si vuelve a leer.
function apiPost(cuerpo) {
  return pedirApi(apiBase(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(cuerpo)
  }, API_ESPERA_ESCRITURA_MS);
}

// ---- Política y tiempos ----

// Valores de respaldo mientras llega la respuesta del API, que trae las reglas reales de la hoja Config.
var REGLAS_POR_DEFECTO = {
  adelanto: 50000, cancelacion_horas: 24, duracion_min: 120,
  grupo_min: 6, max_elcarmen: 20, piso1_max_hipodromo: 16, piso2_max_hipodromo: 30
};

var NOMBRE_ESPACIO = { MESA: 'Mesa', PISO1: 'Primer piso', PISO2: 'Segundo piso' };

// Misma regla que espacioPara de Disponibilidad.gs: el servidor decide, aquí solo se anticipa para mostrarlo.
function maxPersonasReserva(sede, reglas) {
  return sede === 'ELCARMEN' ? reglas.max_elcarmen : reglas.piso2_max_hipodromo;
}

function espacioReserva(sede, personas, reglas) {
  if (personas < reglas.grupo_min || personas > maxPersonasReserva(sede, reglas)) return '';
  if (sede === 'ELCARMEN') return 'MESA';
  return personas <= reglas.piso1_max_hipodromo ? 'PISO1' : 'PISO2';
}

// 120 -> "2 horas" (igual que textoDuracion de Correos.gs)
function textoDuracion(min) {
  return min % 60 === 0 ? (min / 60) + (min === 60 ? ' hora' : ' horas') : min + ' minutos';
}

function combinarReglas(r) {
  var out = {};
  Object.keys(REGLAS_POR_DEFECTO).forEach(function (k) {
    var n = r ? Number(r[k]) : NaN;
    out[k] = r && r[k] !== '' && r[k] !== null && isFinite(n) ? n : REGLAS_POR_DEFECTO[k];
  });
  return out;
}

// Mismo plazo que PLAZO_DEVOLUCION en apps-script/reservas/Correos.gs y que /reservas/condiciones/.
var PLAZO_DEVOLUCION = '5 días hábiles';

function textoPolitica(reglas) {
  var r = combinarReglas(reglas);
  return 'El adelanto de ' + formatoPesos(r.adelanto) + ' se descuenta de tu cuenta. ' +
    'Si cancelas con ' + r.cancelacion_horas + ' horas o más de anticipación te lo devolvemos en máximo ' + PLAZO_DEVOLUCION +
    '. Si cancelas después o no llegas, no se devuelve.';
}

// Bold vuelve a la callback_url y puede agregarle sus propios parámetros (incluso con un segundo "?").
function codigoDeUrl(search) {
  var m = /UF-[A-Z0-9]{6}/.exec(String(search || ''));
  return m ? m[0] : '';
}

// Instante real (ms) de una reserva. Bogotá es UTC-5 todo el año; una hora antes de las 16:00
// es la madrugada del día siguiente a la fecha de servicio.
function instanteReserva(fecha, hora) {
  var madrugada = Number(hora.split(':')[0]) < 16;
  return Date.parse(fecha + 'T' + hora + ':00-05:00') + (madrugada ? 86400000 : 0);
}

// ---- Panel de la cajera ----

function sumarDiasFecha(fecha, n) {
  var d = new Date(fechaUtc(fecha).getTime() + n * 86400000);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

function esCanceladaPanel(r) { return String(r.estado).indexOf('CANCELADA') === 0; }

// Por fecha; dentro del día, vigentes por instante real (00:30 va después de 23:30) y canceladas al final.
function ordenarReservasPanel(lista) {
  return lista.slice().sort(function (x, y) {
    if (x.fecha !== y.fecha) return x.fecha < y.fecha ? -1 : 1;
    var cx = esCanceladaPanel(x), cy = esCanceladaPanel(y);
    if (cx !== cy) return cx ? 1 : -1;
    return instanteReserva(x.fecha, x.hora) - instanteReserva(y.fecha, y.hora);
  });
}

function agruparPorFecha(lista) {
  var grupos = [];
  ordenarReservasPanel(lista).forEach(function (r) {
    var g = grupos[grupos.length - 1];
    if (!g || g.fecha !== r.fecha) { g = { fecha: r.fecha, reservas: [] }; grupos.push(g); }
    g.reservas.push(r);
  });
  return grupos;
}

// Fecha de la jornada: la noche sigue hasta la madrugada, así que antes de las 06:00 en Bogotá
// (UTC-5) todavía es la fecha anterior. Restar 11 h al instante da esa fecha en UTC.
function fechaServicioBogota(ms) {
  var d = new Date(ms - 11 * 3600000);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
