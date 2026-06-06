/**
 * Urban Food BQ – Comentarios (Google Apps Script)
 *
 * SETUP (una sola vez):
 *  1. Crea una hoja de cálculo nueva en Google Drive llamada "Urban Food BQ - Comentarios".
 *  2. Renombra la primera hoja (pestaña) a "Comentarios".
 *  3. En la fila 1, escribe las columnas en este orden: timestamp | name | rating | comment
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

    const name = String(data.name || '').trim().slice(0, MAX_NAME);
    const comment = String(data.comment || '').trim().slice(0, MAX_COMMENT);
    const rating = clamp(parseInt(data.rating, 10) || 5, 1, 5);

    if (!name || !comment) {
      return jsonResponse({ ok: false, error: 'Faltan datos' });
    }

    const sheet = getSheet();
    sheet.appendRow([new Date(), name, rating, comment]);

    return jsonResponse({ ok: true, review: { timestamp: new Date().toISOString(), name, rating, comment } });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function readReviews() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { reviews: [] };

  const reviews = values.slice(1).map(function (row) {
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
    sheet.appendRow(['timestamp', 'name', 'rating', 'comment']);
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
