/**
 * Urban Food – Comentarios y Novedades (Google Apps Script)
 *
 * SETUP (una sola vez):
 *  1. Crea una hoja de cálculo nueva en Google Drive llamada "Urban Food - Comentarios".
 *     (Si ya existe con el nombre viejo, déjala como está: el script queda ligado
 *     al archivo, no a su nombre.)
 *  2. Renombra la primera hoja (pestaña) a "Comentarios".
 *  3. En la fila 1, escribe las columnas en este orden: timestamp | name | rating | comment | approved
 *  3b. Crea una segunda pestaña llamada "Novedades" con estas columnas en la fila 1:
 *      etiqueta | titulo | texto | video | poster | mostrar_hasta | publicado
 *      (ver docs/PASOS-NOVEDADES.md para el paso a paso con ejemplos)
 *  3c. La pestaña "Reservas" NO hay que crearla: el script la crea sola con la
 *      primera reserva (ver docs/PASOS-RESERVAS.md).
 *  4. Menú: Extensiones > Apps Script. Pega TODO este archivo en el editor (reemplaza Code.gs).
 *  5. Guarda (Ctrl+S). Ponle nombre al proyecto, p.ej. "Urban Food Comentarios".
 *  6. Menú: Implementar > Nueva implementación.
 *      - Tipo: Aplicación web
 *      - Descripción: "API comentarios v1"
 *      - Ejecutar como: Yo (tu correo)
 *      - Quién tiene acceso: Cualquier usuario
 *      - Implementar > Autoriza permisos (review > advanced > go to project > allow)
 *  7. Copia la URL del web app (termina en /exec) y pásamela.
 *
 * Para actualizar el código después: Implementar > Administrar implementaciones > lápiz > Nueva versión.
 * Si Google vuelve a pedir permisos (p.ej. para enviar correos), hay que aceptarlos.
 *
 * MODERACIÓN:
 *  Los comentarios nuevos NO se publican automáticamente. Llegan a la hoja con la
 *  columna "approved" vacía. Para que un comentario se vea en la página, marca
 *  la casilla "approved" de esa fila (o escribe TRUE) en la hoja de cálculo.
 *  Así ningún comentario ofensivo o de spam queda visible sin que alguien del
 *  restaurante lo revise primero.
 */

const SHEET_NAME = 'Comentarios';
const NEWS_SHEET_NAME = 'Novedades';
const MAX_REVIEWS = 20;
const MAX_NEWS = 3;
const MAX_NAME = 60;
const MAX_COMMENT = 500;

function doGet(e) {
  // ?q=reservas: solo los dias ocupados. La pagina lo pide al abrir el
  // formulario de reserva, para no mostrar libre un dia que se tomo hace un rato.
  if (e && e.parameter && e.parameter.q === 'reservas') {
    return jsonResponse({ reservas: readOcupadas() });
  }
  // Una sola respuesta para todas las secciones: la pagina hace un unico pedido.
  const data = readReviews();
  data.novedades = readNews();
  data.reservas = readOcupadas();
  return jsonResponse(data);
}

function doPost(e) {
  try {
    const raw = e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    // Campo trampa anti-bots: si viene lleno, es un envío automatizado. Se ignora
    // en silencio (respondemos "ok" para no darle pistas al bot de que fue detectado).
    const honeypot = String(data.website || '').trim();
    if (honeypot) {
      return jsonResponse({ ok: true });
    }

    if (data.tipo === 'reserva') {
      return jsonResponse(createReservation(data));
    }

    const name = String(data.name || '').trim().slice(0, MAX_NAME);
    const comment = String(data.comment || '').trim().slice(0, MAX_COMMENT);
    const rating = clamp(parseInt(data.rating, 10) || 5, 1, 5);

    if (!name || !comment) {
      return jsonResponse({ ok: false, error: 'Faltan datos' });
    }

    // Se guarda sin aprobar. No se publica hasta que alguien del restaurante
    // marque la casilla "approved" en la hoja.
    //
    // OJO: no se usa appendRow() a propósito. Las casillas de verificación
    // vacías cuentan como "dato" para Google Sheets, así que appendRow()
    // escribiría muy por debajo de la última fila real (ej. fila 201).
    // En su lugar se calcula la primera fila libre mirando SOLO la columna A.
    const sheet = getSheet();
    const row = nextFreeRow(sheet);
    sheet.getRange(row, 1, 1, 4).setValues([[new Date(), name, rating, comment]]);
    sheet.getRange(row, 5).insertCheckboxes().setValue(false);

    return jsonResponse({ ok: true, review: { timestamp: new Date().toISOString(), name, rating, comment } });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function readReviews() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { reviews: [] };

  const reviews = values.slice(1)
    .filter(function (row) { return row[4] === true || String(row[4]).toUpperCase() === 'TRUE'; })
    .map(function (row) {
      return {
        // Siempre ISO-8601. Antes, si la celda no llegaba como Date, se enviaba
        // algo como "Sat Aug 15 2026 22:42:17 GMT-0500 (hora estándar de Colombia)":
        // Chrome lo perdona, pero Safari no lo parsea y la fecha salía como "Recién".
        timestamp: toIso(row[0]),
        name: String(row[1] || ''),
        rating: clamp(parseInt(row[2], 10) || 5, 1, 5),
        comment: String(row[3] || '')
      };
    }).filter(function (r) { return r.name && r.comment; })
    .reverse()
    .slice(0, MAX_REVIEWS);

  return { reviews: reviews };
}

/**
 * Lee la pestaña "Novedades".
 *
 * Columnas: etiqueta | titulo | texto | video | poster | mostrar_hasta | publicado
 *
 * Solo salen las filas con "publicado" marcado y cuya fecha "mostrar_hasta" no
 * haya pasado todavia. Esa fecha es la que evita que la seccion se quede con
 * una novedad vieja: cuando vence, la novedad desaparece sola de la pagina y
 * nadie tiene que acordarse de bajarla. Si la celda va vacia, no caduca.
 *
 * Si la pestaña no existe, se devuelve una lista vacia y la pagina simplemente
 * no muestra la seccion: el sitio sigue funcionando igual.
 */
function readNews() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NEWS_SHEET_NAME);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  // Comparamos contra el final del dia, no contra este instante: si alguien
  // escribe "5 de septiembre" espera verlo durante todo el 5, no hasta las 00:00.
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return values.slice(1)
    .filter(function (row) {
      const publicado = row[6] === true || String(row[6]).toUpperCase() === 'TRUE';
      if (!publicado) return false;
      const hasta = row[5];
      if (!hasta) return true;
      const d = hasta instanceof Date ? hasta : new Date(hasta);
      if (isNaN(d.getTime())) return true; // fecha ilegible: se muestra igual
      d.setHours(23, 59, 59, 999);
      return d >= hoy;
    })
    .map(function (row) {
      return {
        etiqueta: String(row[0] || '').trim().slice(0, 40),
        titulo: String(row[1] || '').trim().slice(0, 120),
        texto: String(row[2] || '').trim().slice(0, 600),
        video: String(row[3] || '').trim().slice(0, 300),
        poster: String(row[4] || '').trim().slice(0, 300)
      };
    })
    .filter(function (n) { return n.titulo; })
    .slice(0, MAX_NEWS);
}

/**
 * Devuelve la primera fila libre mirando únicamente la columna A (timestamp).
 * Ignora las casillas de verificación sueltas de la columna E, que de otro modo
 * harían que los comentarios nuevos se escribieran cientos de filas más abajo.
 */
function nextFreeRow(sheet) {
  const colA = sheet.getRange(1, 1, sheet.getMaxRows(), 1).getValues();
  for (let i = colA.length - 1; i >= 1; i--) {
    if (String(colA[i][0]).trim() !== '') {
      return i + 2; // i es índice 0 -> fila i+1; la siguiente libre es i+2
    }
  }
  return 2; // solo está el encabezado
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['timestamp', 'name', 'rating', 'comment', 'approved']);
    // No se insertan casillas por adelantado: cada comentario nuevo crea la suya.
  }
  return sheet;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/** Normaliza cualquier valor de celda a una cadena ISO-8601 (o '' si no hay fecha). */
function toIso(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  if (!v) return '';
  // Si la columna quedó formateada como número, la celda llega como number.
  // new Date(46000) es una fecha VÁLIDA (1970) y el comentario saldría como
  // "Hace 56 años", así que se descarta en vez de inventar una fecha.
  if (typeof v === 'number') return '';
  var d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// RESERVAS
// ============================================================================
//
// Pestaña "Reservas" (se crea sola con la primera reserva):
//   creada | sede | fecha | hora | personas | nombre | telefono | nota | estado | avisar_cliente
//
// Reglas:
//  - Una reserva por sede y por dia. El dia queda bloqueado mientras la reserva
//    este "pendiente" o "confirmada"; si se pasa a "rechazada" o "cancelada",
//    el dia vuelve a quedar libre en la pagina.
//  - Minimo 24 horas de anticipacion (nunca el mismo dia).
//  - Personas: de 10 a 20 en El Carmen y de 10 a 30 en Hipodromo.
//
// OJO: los limites, las horas y los dias de anticipacion estan repetidos en
// RESERVA_* de assets/js/script.js. Si cambias uno aqui, cambialo alla tambien:
// la pagina los usa para no dejar escoger lo que el servidor igual rechazaria.

const RES_SHEET_NAME = 'Reservas';
const RES_HEADERS = ['creada', 'sede', 'fecha', 'hora', 'personas', 'nombre', 'telefono', 'nota', 'estado', 'avisar_cliente'];
const RES_ESTADOS = ['pendiente', 'confirmada', 'rechazada', 'cancelada'];
const RES_ESTADOS_LIBRES = ['rechazada', 'cancelada'];
const RES_TZ = 'America/Bogota';
const RES_ANTICIPACION_HORAS = 24;
const RES_MAX_DIAS = 60;
const RES_MAX_NOMBRE = 60;
const RES_MAX_NOTA = 300;

// email: a donde llega el aviso de cada reserva nueva. Puede ser una lista
// separada por comas, p.ej. 'dueno@gmail.com, encargado@gmail.com'.
const RES_SEDES = {
  carmen:    { nombre: 'El Carmen', min: 10, max: 20, email: 'urbanfoodbq@gmail.com' },
  hipodromo: { nombre: 'Hipódromo', min: 10, max: 30, email: 'urbanfoodbq@gmail.com' }
};

// Horas de llegada que se pueden escoger: de 4:00 PM a 10:00 PM cada media hora.
const RES_HORAS = (function () {
  const out = [];
  for (let m = 16 * 60; m <= 22 * 60; m += 30) {
    out.push(pad2(Math.floor(m / 60)) + ':' + pad2(m % 60));
  }
  return out;
})();

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function createReservation(data) {
  const sedeKey = String(data.sede || '');
  const sede = RES_SEDES.hasOwnProperty(sedeKey) ? RES_SEDES[sedeKey] : null;
  if (!sede) return resError('invalido', 'Elige una sede.');

  const fecha = String(data.fecha || '');
  if (!isIsoDate(fecha)) return resError('invalido', 'Elige una fecha válida.');

  const hora = String(data.hora || '');
  if (RES_HORAS.indexOf(hora) === -1) return resError('invalido', 'Elige una hora válida.');

  const personas = parseInt(data.personas, 10);
  if (!(personas >= sede.min && personas <= sede.max)) {
    return resError('invalido', 'En ' + sede.nombre + ' se reserva para ' + sede.min + ' a ' + sede.max + ' personas.');
  }

  const nombre = String(data.nombre || '').trim().slice(0, RES_MAX_NOMBRE);
  if (!nombre) return resError('invalido', 'Escribe tu nombre.');

  const telefono = normalizarTelefono(data.telefono);
  if (!telefono) return resError('invalido', 'Escribe un celular válido de 10 dígitos.');

  const nota = String(data.nota || '').trim().slice(0, RES_MAX_NOTA);

  // La hora se compara contra este instante y no contra "mañana": reservar el
  // martes a las 8 PM para el miercoles a las 5 PM son menos de 24 horas.
  if (slotMs(fecha, hora) - Date.now() < RES_ANTICIPACION_HORAS * 3600 * 1000) {
    return resError('anticipacion', 'Las reservas se hacen con mínimo 24 horas de anticipación.');
  }
  if (fecha > addDaysIso(hoyIso(), RES_MAX_DIAS)) {
    return resError('invalido', 'Solo recibimos reservas hasta con ' + RES_MAX_DIAS + ' días de anticipación.');
  }

  // El candado evita que dos personas que envian a la vez el mismo dia queden
  // las dos guardadas: la segunda espera, lee la hoja ya actualizada y se rechaza.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return resError('ocupado_servidor', 'Hay mucha gente reservando en este momento. Inténtalo de nuevo en unos segundos.');
  }

  let fila;
  try {
    const sheet = getResSheet();
    const ocupadas = fechasOcupadas(sheet);
    if (ocupadas[sedeKey].indexOf(fecha) !== -1) {
      return resError('ocupado', 'Ese día ya tiene una reserva en ' + sede.nombre + '. Elige otro día.');
    }

    fila = nextFreeRow(sheet);
    const avisar = '=HYPERLINK("' + waUrl(telefono, mensajeConfirmacion(sede, fecha, hora, personas, nombre)) +
      '", "Confirmar por WhatsApp")';

    // fecha, hora y telefono como texto: si no, Sheets los convierte en fecha,
    // hora y numero (y al telefono le quita el "+").
    sheet.getRange(fila, 3, 1, 2).setNumberFormat('@');
    sheet.getRange(fila, 7).setNumberFormat('@');
    sheet.getRange(fila, 1, 1, 9).setValues([[
      new Date(), sede.nombre, fecha, horaLegible(hora), personas,
      textoSeguro(nombre), telefonoLegible(telefono), textoSeguro(nota), 'pendiente'
    ]]);
    sheet.getRange(fila, 9).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(RES_ESTADOS, true).build()
    );
    sheet.getRange(fila, 10).setFormula(avisar);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // Fuera del candado: si el correo tarda o falla, la reserva ya quedo guardada.
  avisarReserva(sede, { fecha: fecha, hora: hora, personas: personas, nombre: nombre, telefono: telefono, nota: nota, fila: fila });

  return { ok: true };
}

/** Dias ocupados por sede, de hoy en adelante. Solo fechas: nunca datos del cliente. */
function readOcupadas() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RES_SHEET_NAME);
  return sheet ? fechasOcupadas(sheet) : ocupadasVacias();
}

function fechasOcupadas(sheet) {
  const out = ocupadasVacias();
  const values = sheet.getDataRange().getValues();
  const tz = sheet.getParent().getSpreadsheetTimeZone();
  const hoy = hoyIso();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const key = sedeKeyDe(row[1]);
    const fecha = fechaDeCelda(row[2], tz);
    const estado = String(row[8] || '').trim().toLowerCase();
    if (!key || !fecha || fecha < hoy) continue;
    if (RES_ESTADOS_LIBRES.indexOf(estado) !== -1) continue;
    if (out[key].indexOf(fecha) === -1) out[key].push(fecha);
  }
  Object.keys(out).forEach(function (k) { out[k].sort(); });
  return out;
}

function ocupadasVacias() {
  const out = {};
  Object.keys(RES_SEDES).forEach(function (k) { out[k] = []; });
  return out;
}

function getResSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(RES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(RES_SHEET_NAME);
    sheet.getRange(1, 1, 1, RES_HEADERS.length).setValues([RES_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Correo al negocio. Nunca rompe la reserva: si falla, solo queda en el registro. */
function avisarReserva(sede, r) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cuando = fechaLarga(r.fecha) + ' a las ' + horaLegible(r.hora);
    const wa = waUrl(r.telefono, mensajeConfirmacion(sede, r.fecha, r.hora, r.personas, r.nombre));
    const hoja = ss.getUrl() + '#gid=' + getResSheet().getSheetId() + '&range=A' + r.fila;

    const filas = [
      ['Sede', sede.nombre],
      ['Fecha', cuando],
      ['Personas', String(r.personas)],
      ['Nombre', r.nombre],
      ['Celular', telefonoLegible(r.telefono)],
      ['Nota', r.nota || '—']
    ];

    const html =
      '<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">' +
      '<h2 style="margin:0 0 12px">Nueva reserva · ' + escHtml(sede.nombre) + '</h2>' +
      '<table cellpadding="6" style="border-collapse:collapse">' +
      filas.map(function (f) {
        return '<tr><td style="color:#666">' + f[0] + '</td><td><b>' + escHtml(f[1]) + '</b></td></tr>';
      }).join('') +
      '</table>' +
      '<p style="margin:16px 0 8px">Queda <b>pendiente</b> y el día ya aparece bloqueado en la página.</p>' +
      '<ol style="margin:0 0 16px;padding-left:20px">' +
      '<li>Habla con el cliente y confirma.</li>' +
      '<li>En la hoja, cambia el estado a <b>confirmada</b> (o a <b>rechazada</b> para liberar el día).</li>' +
      '</ol>' +
      '<p><a href="' + escHtml(wa) + '" style="background:#25D366;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none">Confirmar por WhatsApp</a>' +
      '&nbsp;&nbsp;<a href="' + escHtml(hoja) + '">Abrir la hoja de reservas</a></p>' +
      '</div>';

    const texto = 'Nueva reserva en ' + sede.nombre + '\n\n' +
      filas.map(function (f) { return f[0] + ': ' + f[1]; }).join('\n') +
      '\n\nConfirmar por WhatsApp: ' + wa + '\nHoja de reservas: ' + hoja;

    MailApp.sendEmail({
      to: sede.email,
      subject: 'Nueva reserva ' + sede.nombre + ' · ' + cuando + ' · ' + r.personas + ' personas',
      body: texto,
      htmlBody: html,
      name: 'Reservas Urban Food'
    });
  } catch (err) {
    console.error('No se pudo enviar el correo de la reserva: ' + err);
  }
}

function mensajeConfirmacion(sede, fecha, hora, personas, nombre) {
  return '¡Hola ' + nombre + '! Te confirmamos tu reserva en Urban Food, sede ' + sede.nombre +
    ', para el ' + fechaLarga(fecha) + ' a las ' + horaLegible(hora) + ', ' + personas +
    ' personas. ¡Te esperamos!';
}

function resError(code, msg) {
  return { ok: false, code: code, error: msg };
}

// ---------- Fechas y horas (Colombia no tiene horario de verano: siempre UTC-5) ----------

function hoyIso() {
  return Utilities.formatDate(new Date(), RES_TZ, 'yyyy-MM-dd');
}

function isIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const p = s.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  // Descarta cosas como 2026-02-31, que Date "corrige" a otro dia.
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}

function addDaysIso(iso, n) {
  const p = iso.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

/** Instante (ms) en que empieza la reserva, en hora de Colombia. */
function slotMs(fecha, hora) {
  const p = fecha.split('-').map(Number);
  const h = hora.split(':').map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2], h[0] + 5, h[1]);
}

function fechaLarga(iso) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return DIAS_ES[d.getUTCDay()] + ' ' + p[2] + ' de ' + MESES_ES[p[1] - 1];
}

function horaLegible(hhmm) {
  const h = hhmm.split(':').map(Number);
  const h12 = h[0] % 12 === 0 ? 12 : h[0] % 12;
  return h12 + ':' + pad2(h[1]) + (h[0] < 12 ? ' AM' : ' PM');
}

/** La fecha llega como texto (lo normal) o como Date si alguien la reescribio a mano en la hoja. */
function fechaDeCelda(v, tz) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  if (isIsoDate(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // 4/10/2026 escrito a mano
  if (m) {
    const iso = m[3] + '-' + pad2(Number(m[2])) + '-' + pad2(Number(m[1]));
    if (isIsoDate(iso)) return iso;
  }
  return '';
}

// ---------- Utilidades de reservas ----------

function sedeKeyDe(v) {
  const s = sinAcentos(String(v || '')).trim().toLowerCase();
  const keys = Object.keys(RES_SEDES);
  for (let i = 0; i < keys.length; i++) {
    if (s === keys[i] || s === sinAcentos(RES_SEDES[keys[i]].nombre).toLowerCase()) return keys[i];
  }
  return '';
}

/** Celular colombiano: acepta "312 755 7694", "+57 312-755-7694", etc. Devuelve "573127557694" o ''. */
function normalizarTelefono(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 12 && d.indexOf('57') === 0) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? '57' + d : '';
}

function telefonoLegible(t) {
  return '+57 ' + t.slice(2, 5) + ' ' + t.slice(5, 8) + ' ' + t.slice(8);
}

function waUrl(telefono, texto) {
  return 'https://wa.me/' + telefono + '?text=' + encodeURIComponent(texto);
}

/**
 * Lo que escribe el cliente va a una celda: si empieza por = + - @, Sheets lo
 * tomaria como formula. El apostrofo inicial lo deja como texto (y no se ve).
 */
function textoSeguro(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function sinAcentos(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}
