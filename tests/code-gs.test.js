const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');

function cargar(hojas) {
  const ss = { getSheetByName: n => hojas[n] || null };
  const ctx = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: s => ({ s, setMimeType() { return this; } })
    }
  });
  vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/Code.gs', 'utf8'), ctx);
  return { get: () => JSON.parse(ctx.doGet({ parameter: {} }).s), ctx };
}

const pestana = filas => ({ getDataRange: () => ({ getValues: () => filas }) });
const ENCABEZADOS = ['etiqueta', 'titulo', 'texto', 'video', 'poster', 'mostrar_hasta', 'publicado'];

test('solo salen las novedades publicadas y vigentes', () => {
  const ayer = new Date(Date.now() - 2 * 86400000);
  const { get } = cargar({
    Novedades: pestana([
      ENCABEZADOS,
      ['Nuevo', 'Abrimos Hipódromo', 'Te esperamos', '', '', '', true],
      ['', 'Sin publicar', '', '', '', '', false],
      ['', 'Ya vencida', '', '', '', ayer, 'TRUE'],
      ['', '', 'sin título', '', '', '', true]
    ])
  });
  assert.deepEqual(get().novedades.map(n => n.titulo), ['Abrimos Hipódromo']);
});

// Las opiniones y las reservas para grupos se retiraron: la URL es pública y aceptaba escrituras
// de cualquiera. Ahora el script solo lee novedades y no tiene doPost.
test('el script ya no recibe escrituras ni devuelve opiniones', () => {
  const { get, ctx } = cargar({});
  assert.equal(typeof ctx.doPost, 'undefined');
  assert.deepEqual(get(), { novedades: [] });
});
