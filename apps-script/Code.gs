/**
 * Urban Food – Novedades (Google Apps Script)
 *
 * SETUP (una sola vez):
 *  1. Crea una hoja de cálculo en Google Drive llamada "Urban Food - Comentarios".
 *     (El nombre es histórico: el script queda ligado al archivo, no a su nombre.)
 *  2. Crea una pestaña llamada "Novedades" con estas columnas en la fila 1:
 *      etiqueta | titulo | texto | video | poster | mostrar_hasta | publicado
 *      (ver docs/PASOS-NOVEDADES.md para el paso a paso con ejemplos)
 *  3. Menú: Extensiones > Apps Script. Pega TODO este archivo en el editor (reemplaza Code.gs).
 *  4. Guarda (Ctrl+S). Ponle nombre al proyecto, p.ej. "Urban Food Comentarios".
 *  5. Menú: Implementar > Nueva implementación.
 *      - Tipo: Aplicación web
 *      - Ejecutar como: Yo (tu correo)
 *      - Quién tiene acceso: Cualquier usuario
 *      - Implementar > Autoriza permisos (review > advanced > go to project > allow)
 *  6. Copia la URL del web app (termina en /exec) y pásamela.
 *
 * Para actualizar el código después: Implementar > Administrar implementaciones > lápiz > Nueva versión.
 * Si Google vuelve a pedir permisos, hay que aceptarlos.
 *
 * Las opiniones ya no pasan por aquí: la página muestra la calificación de Google de cada sede
 * y enlaza a su ficha. La pestaña "Comentarios" de la hoja quedó como archivo; nada la lee.
 */

const NEWS_SHEET_NAME = 'Novedades';
const MAX_NEWS = 3;

function doGet(e) {
  return jsonResponse({ novedades: readNews() });
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

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
