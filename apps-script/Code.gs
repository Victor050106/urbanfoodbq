/**
 * Urban Food BQ – Comentarios (Google Apps Script)
 *
 * SETUP (una sola vez):
 *  1. Crea una hoja de cálculo nueva en Google Drive llamada "Urban Food BQ - Comentarios".
 *  2. Renombra la primera hoja (pestaña) a "Comentarios".
 *  3. En la fila 1, escribe las columnas en este orden: timestamp | name | rating | comment | approved
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
 *
 * MODERACIÓN:
 *  Los comentarios nuevos NO se publican automáticamente. Llegan a la hoja con la
 *  columna "approved" vacía. Para que un comentario se vea en la página, marca
 *  la casilla "approved" de esa fila (o escribe TRUE) en la hoja de cálculo.
 *  Así ningún comentario ofensivo o de spam queda visible sin que alguien del
 *  restaurante lo revise primero.
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

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
