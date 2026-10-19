const test = require('node:test');
const a = require('node:assert/strict');
const { cargar, ahora, base } = require('./cargar');

const c = cargar('apps-script/reservas/Config.gs', 'apps-script/reservas/Calendario.gs', 'apps-script/reservas/Bold.gs');
const cfg = c.combinarConfig([]);
const registrados = [];
c.console = { log() {}, warn() {}, error: (...x) => registrados.push(x.join(' ')) };

test('payload del link', () => {
  const p = c.armarLink(base({ codigo: 'UF-ABC234', sede: 'ELCARMEN', fecha: '2026-10-22', hora: '20:00' }), cfg, ahora);
  a.equal(p.amount_type, 'CLOSE'); a.equal(p.amount.currency, 'COP'); a.equal(p.amount.total_amount, 50000);
  a.equal(p.amount.tip_amount, 0);
  a.equal(p.reference, 'UF-ABC234');
  a.match(p.description, /El Carmen/); a.ok(p.description.length <= 100);
  a.equal(p.description, 'Reserva UF-ABC234 · El Carmen · 2026-10-22 20:00');
  a.equal(p.payer_email, 'laura@example.com');
  a.equal(p.callback_url, cfg.url_sitio + '/reservas/?codigo=UF-ABC234');
  a.equal(p.expiration_date, (ahora + 15 * 60e3) * 1e6); // nanosegundos, confirmado en el sandbox
});

test('descripción del Hipódromo y truncado a 100', () => {
  const p = c.armarLink(base({ sede: 'HIPODROMO' }), cfg, ahora);
  a.match(p.description, /Hipódromo/);
  const largo = c.armarLink(base({ codigo: 'X'.repeat(200) }), cfg, ahora);
  a.equal(largo.description.length, 100);
});

test('estado del link', () => {
  a.equal(c.leerEstadoLink({ status: 'PAID' }), 'PAID');
  a.equal(c.leerEstadoLink({ payload: { status: 'EXPIRED' } }), 'EXPIRED');
  a.equal(c.leerEstadoLink({ status: 'paid' }), 'PAID');
  a.equal(c.leerEstadoLink({}), 'ACTIVE');
  a.equal(c.leerEstadoLink(null), 'ACTIVE');
  a.equal(c.leerEstadoLink({ status: 'RARO' }), 'ACTIVE');
});

test('estado desconocido o ausente: se registra la forma (sin datos) y se trata como ACTIVE', () => {
  registrados.length = 0;
  a.equal(c.leerEstadoLink({ status: 'PAID' }), 'PAID');
  a.equal(registrados.length, 0);
  a.equal(c.leerEstadoLink({ payload: { estado: 'X', payer_email: 'laura@example.com' } }), 'ACTIVE');
  a.equal(registrados.length, 1);
  a.match(registrados[0], /payload/); a.match(registrados[0], /payer_email/);
  a.ok(!registrados[0].includes('laura@example.com'));
  a.equal(c.leerEstadoLink({ status: 'NUEVO' }), 'ACTIVE');
  a.match(registrados[1], /NUEVO/);
  a.equal(c.leerEstadoLink(null), 'ACTIVE');
  a.equal(registrados.length, 3);
});
