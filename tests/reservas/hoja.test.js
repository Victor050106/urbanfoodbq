const test = require('node:test');
const a = require('node:assert/strict');
const { cargar, base } = require('./cargar');

const c = cargar('apps-script/reservas/Config.gs', 'apps-script/reservas/Calendario.gs', 'apps-script/reservas/Hoja.gs');
const plano = (x) => JSON.parse(JSON.stringify(x));

test('ida y vuelta de una reserva y celdas transformadas por Sheets', () => {
  const r = c.filaAReserva(c.reservaAFila(base()));
  a.deepEqual(plano(r), base());
  const fila = c.reservaAFila(base());
  fila[c.COLUMNAS_RESERVA.indexOf('fecha')] = new Date('2026-10-22T05:00:00Z');
  fila[c.COLUMNAS_RESERVA.indexOf('hora')] = new Date('1899-12-31T01:00:00Z');
  fila[c.COLUMNAS_RESERVA.indexOf('documento')] = 1143000000;
  const t = c.filaAReserva(fila);
  a.equal(t.fecha, '2026-10-22'); a.equal(t.hora, '20:00'); a.equal(t.documento, '1143000000');
});

test('orden de columnas y campos faltantes', () => {
  a.deepEqual(plano(c.COLUMNAS_RESERVA), ['codigo', 'creada', 'sede', 'espacio', 'fecha', 'hora', 'personas', 'nombre', 'tipo_doc', 'documento', 'correo', 'celular', 'comentario', 'estado', 'bold_link', 'bold_url', 'vence', 'pagada_en', 'token_cancelar', 'devolucion', 'descuento_aplicado', 'marcada_en', 'notas']);
  const fila = c.reservaAFila({ codigo: 'UF-X' });
  a.equal(fila.length, 23);
  a.equal(fila[0], 'UF-X');
  a.equal(fila[1], '');
});

test('tipos: personas número, descuento_aplicado de TRUE o true, textos a String', () => {
  const fila = c.reservaAFila(base());
  fila[c.COLUMNAS_RESERVA.indexOf('personas')] = '6';
  fila[c.COLUMNAS_RESERVA.indexOf('descuento_aplicado')] = 'TRUE';
  fila[c.COLUMNAS_RESERVA.indexOf('celular')] = 3001234567;
  const r = c.filaAReserva(fila);
  a.strictEqual(r.personas, 6); a.strictEqual(r.descuento_aplicado, true); a.strictEqual(r.celular, '3001234567');
  fila[c.COLUMNAS_RESERVA.indexOf('descuento_aplicado')] = true;
  a.strictEqual(c.filaAReserva(fila).descuento_aplicado, true);
  fila[c.COLUMNAS_RESERVA.indexOf('descuento_aplicado')] = '';
  a.strictEqual(c.filaAReserva(fila).descuento_aplicado, false);
});

test('columnas de texto existen en la tabla', () => {
  c.COLUMNAS_TEXTO.forEach((k) => a.ok(c.COLUMNAS_RESERVA.indexOf(k) !== -1, k));
});

test('filtro de reservas por sede y rango de fechas inclusivo', () => {
  const rs = [base({ codigo: 'A', fecha: '2026-10-20' }), base({ codigo: 'B', fecha: '2026-10-22' }), base({ codigo: 'C', fecha: '2026-10-22', sede: 'HIPODROMO' })];
  const f = (x) => c.filtrarReservas(rs, x).map((r) => r.codigo);
  a.deepEqual(plano(f({})), ['A', 'B', 'C']);
  a.deepEqual(plano(f({ sede: 'ELCARMEN' })), ['A', 'B']);
  a.deepEqual(plano(f({ desde: '2026-10-22', hasta: '2026-10-22' })), ['B', 'C']);
  a.deepEqual(plano(f({ desde: '2026-10-21' })), ['B', 'C']);
});

test('fila de bloqueo a objeto', () => {
  const b = c.filaABloqueo([new Date('2026-12-25T05:00:00Z'), ' TODAS ', 'bloquear', 'Navidad']);
  a.deepEqual(plano(b), { fecha: '2026-12-25', sede: 'TODAS', tipo: 'BLOQUEAR', motivo: 'Navidad' });
});

test('texto libre que parece fórmula se escribe con apóstrofo y vuelve igual', () => {
  const fila = c.reservaAFila(base({ nombre: '=HYPERLINK("x")', comentario: '+1' }));
  a.equal(fila[c.COLUMNAS_RESERVA.indexOf('nombre')], "'=HYPERLINK(\"x\")");
  a.equal(fila[c.COLUMNAS_RESERVA.indexOf('comentario')], "'+1");
  a.equal(c.filaAReserva(c.reservaAFila(base({ nombre: '=SUMA(1)' }))).nombre, '=SUMA(1)');
  a.equal(c.filaAReserva(c.reservaAFila(base({ notas: '-5', correo: '@x' }))).notas, '-5');
  const normal = c.reservaAFila(base({ nombre: 'Laura' }));
  a.equal(normal[c.COLUMNAS_RESERVA.indexOf('nombre')], 'Laura');
  a.equal(c.filaAReserva(normal).nombre, 'Laura');
});

test('filas a agregar cuando la hoja se llena', () => {
  a.equal(c.filasAAgregar(500, 1000), 0);
  a.equal(c.filasAAgregar(1000, 1000), 0);
  a.equal(c.filasAAgregar(1001, 1000), 200);
  a.equal(c.filasAAgregar(2, 1), 200);
});

test('caché de Config y Bloqueos: lee la hoja una vez y sin CacheService lee directo', () => {
  let lecturas = 0;
  const leer = () => { lecturas++; return { adelanto: 50000, dias_reserva: [1, 2] }; };
  a.equal(JSON.stringify(c.conCache('config', leer)), '{"adelanto":50000,"dias_reserva":[1,2]}');
  a.equal(lecturas, 1);
  const guardados = {};
  c.CacheService = { getScriptCache: () => ({ get: (k) => guardados[k] || null, put: (k, v) => { guardados[k] = v; } }) };
  c.conCache('config', leer); c.conCache('config', leer);
  a.equal(lecturas, 2);
  a.equal(JSON.stringify(c.conCache('config', leer)), '{"adelanto":50000,"dias_reserva":[1,2]}');
  delete c.CacheService;
});
