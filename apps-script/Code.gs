/**
 * Urban Food BQ – Comentarios (Google Apps Script)
 *
 * MODERACIÓN:
 *  Los comentarios nuevos NO se publican automáticamente. Llegan a la hoja con la
 *  columna "approved" vacía. Para que un comentario se vea en la página, marca
 *  la casilla "approved" de esa fila (o escribe TRUE) en la hoja de cálculo.
 *
 * Para actualizar este código después:
 *  Implementar > Administrar implementaciones > lápiz > Nueva versión.
 */

const SHEET_NAME = 'Comentarios';
const MAX_REVIEWS = 20;
const MAX_NAME = 60;
const MAX_COMMENT = 500;

function doGet(e) {
  return jsonResponse(readReviews());
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

    const name = String(data.name || '').trim().slice(0, MAX_NAME);
    const comment = String(data.comment || '').trim().slice(0, MAX_COMMENT);
    const rating = clamp(parseInt(data.rating, 10) || 5, 1, 5);

    if (!name || !comment) {
      return jsonResponse({ ok: false, error: 'Faltan datos' });
    }

    // Se guarda sin aprobar. No se publica hasta que alguien del restaurante
    // marque la casilla "approved" en la hoja.
    const sheet = getSheet();
    sheet.appendRow([new Date(), name, rating, comment, false]);

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
        timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || ''),
        name: String(row[1] || ''),
        rating: clamp(parseInt(row[2], 10) || 5, 1, 5),
        comment: String(row[3] || '')
      };
    }).filter(function (r) { return r.name && r.comment; })
    .reverse()
    .slice(0, MAX_REVIEWS);

  return { reviews: reviews };
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['timestamp', 'name', 'rating', 'comment', 'approved']);
    sheet.getRange(2, 5, sheet.getMaxRows() - 1, 1).insertCheckboxes();
  }
  return sheet;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}