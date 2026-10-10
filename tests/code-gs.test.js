const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');

const TZ = 'America/Bogota';
const isoEn = (date, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const diasDesdeHoy = n => isoEn(new Date(Date.now() + n * 86400000), TZ);

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

const reserva = extra => ({
  tipo: 'reserva', sede: 'carmen', fecha: diasDesdeHoy(3), hora: '19:00',
  personas: 12, nombre: 'Ana', telefono: '300 123 4567', nota: '', ...extra
});

test('una opinion que empieza por = se guarda como texto, no como formula', () => {
  const { post, hojas } = cargar({ Comentarios: hoja([['timestamp', 'name', 'rating', 'comment', 'approved']]) });
  const res = post({ name: '=Ana', comment: '=HYPERLINK("https://x.co";"ver")', rating: 4 });
  assert.equal(res.ok, true);
  const fila = hojas.Comentarios.filas[1];
  assert.equal(fila[1], "'=Ana");
  assert.equal(fila[3], `'=HYPERLINK("https://x.co";"ver")`);
  assert.equal(fila[4], false);
});

test('reserva valida se guarda pendiente y avisa por correo; el mismo dia queda ocupado', () => {
  const { post, hojas, correos } = cargar({});
  assert.deepEqual(post(reserva()), { ok: true });
  assert.equal(hojas.Reservas.filas[1][8], 'pendiente');
  assert.equal(hojas.Reservas.filas[1][6], '+57 300 123 4567');
  assert.equal(correos.length, 1);
  assert.equal(post(reserva({ nombre: 'Otro' })).code, 'ocupado');
  assert.equal(post(reserva({ sede: 'hipodromo' })).ok, true);
});

test('rechaza menos de 24 horas, personas fuera de rango y celular invalido', () => {
  const { post } = cargar({});
  assert.equal(post(reserva({ fecha: diasDesdeHoy(0) })).code, 'anticipacion');
  assert.equal(post(reserva({ personas: 21 })).code, 'invalido');
  assert.equal(post(reserva({ sede: 'hipodromo', personas: 30 })).ok, true);
  assert.equal(post(reserva({ telefono: '12345' })).code, 'invalido');
  assert.equal(post(reserva({ fecha: '2026-02-31' })).code, 'invalido');
});

test('con el tope de pendientes alcanzado no entra otra reserva', () => {
  const { post, ctx, correos } = cargar({});
  const tope = vm.runInContext('RES_MAX_PENDIENTES', ctx);
  for (let i = 0; i < tope; i++) assert.equal(post(reserva({ fecha: diasDesdeHoy(3 + i) })).ok, true, `reserva ${i}`);
  assert.equal(post(reserva({ fecha: diasDesdeHoy(3 + tope) })).code, 'lleno');
  assert.equal(correos.length, tope);
});

test('rechazar o cancelar una reserva libera el dia y el cupo', () => {
  const { post, hojas, ctx } = cargar({});
  post(reserva());
  hojas.Reservas.filas[1][8] = 'rechazada';
  assert.deepEqual(ctx.readOcupadas().carmen, []);
  assert.equal(post(reserva()).ok, true);
});

test('lee fechas escritas a mano en la hoja', () => {
  const { ctx } = cargar({});
  assert.equal(ctx.fechaDeCelda('4/10/2026', TZ), '2026-10-04');
  assert.equal(ctx.fechaDeCelda('31/02/2026', TZ), '');
  assert.equal(ctx.normalizarTelefono('+57 312-755-7694'), '573127557694');
});
