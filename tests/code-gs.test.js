const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');

const TZ = 'America/Bogota';
const isoEn = (date, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

function hoja(filas) {
  const celda = (r, c) => (filas[r] || [])[c] ?? '';
  const sheet = {
    filas,
    getDataRange: () => ({ getValues: () => filas.map(f => f.slice()) }),
    getMaxRows: () => Math.max(filas.length, 100),
    getSheetId: () => 1,
    getRange(r, c, nr = 1, nc = 1) {
      const rango = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => celda(r - 1 + i, c - 1 + j))),
        setValues(v) {
          v.forEach((fila, i) => fila.forEach((x, j) => { (filas[r - 1 + i] ||= [])[c - 1 + j] = x; }));
          return rango;
        },
        setValue(x) { return rango.setValues([[x]]); },
        setFormula(x) { return rango.setValues([[x]]); },
        insertCheckboxes: () => rango,
        setNumberFormat: () => rango,
        setDataValidation: () => rango,
        setFontWeight: () => rango,
        setNote: () => rango
      };
      return rango;
    },
    setFrozenRows() {}
  };
  return sheet;
}

function cargar(hojas) {
  const correos = [];
  const ss = {
    getSheetByName: n => hojas[n] || null,
    insertSheet: n => (hojas[n] = Object.assign(hoja([]), { getParent: () => ss })),
    getSpreadsheetTimeZone: () => TZ,
    getUrl: () => 'https://hoja'
  };
  Object.values(hojas).forEach(h => { h.getParent = () => ss; });
  const ctx = vm.createContext({
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      flush() {},
      newDataValidation: () => ({ requireValueInList() { return this; }, build() {} })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: m => correos.push(m) },
    Utilities: { formatDate: (d, tz) => isoEn(d, tz) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: s => ({ s, setMimeType() { return this; } })
    }
  });
  vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/Code.gs', 'utf8'), ctx);
  const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).s);
  return { ctx, post, correos, hojas };
}

test('una opinion que empieza por = se guarda como texto, no como formula', () => {
  const { post, hojas } = cargar({ Comentarios: hoja([['timestamp', 'name', 'rating', 'comment', 'approved']]) });
  const res = post({ name: '=Ana', comment: '=HYPERLINK("https://x.co";"ver")', rating: 4 });
  assert.equal(res.ok, true);
  const fila = hojas.Comentarios.filas[1];
  assert.equal(fila[1], "'=Ana");
  assert.equal(fila[3], `'=HYPERLINK("https://x.co";"ver")`);
  assert.equal(fila[4], false);
});

// Las reservas para grupos de este script se retiraron: la URL es pública y un bot podía crear
// reservas falsas y mandar correos al negocio. Ahora un envío así es solo una opinión incompleta.
test('un envio de reserva ya no crea reservas ni manda correos', () => {
  const { post, hojas, correos } = cargar({});
  const res = post({ tipo: 'reserva', sede: 'carmen', fecha: '2026-12-01', hora: '19:00', personas: 12, nombre: 'Ana', telefono: '3001234567' });
  assert.equal(res.ok, false);
  assert.equal(hojas.Reservas, undefined);
  assert.equal(correos.length, 0);
});
