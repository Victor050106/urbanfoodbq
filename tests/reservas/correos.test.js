const test = require('node:test');
const a = require('node:assert/strict');
const { cargar, base } = require('./cargar');

const c = cargar('apps-script/reservas/Config.gs', 'apps-script/reservas/Calendario.gs', 'apps-script/reservas/Ciclo.gs', 'apps-script/reservas/Correos.gs');
const cfg = c.combinarConfig([]);
const POLITICA = 'El adelanto de $50.000 se descuenta de tu cuenta. Si cancelas con 24 horas o más de anticipación te lo devolvemos. Si cancelas después o no llegas, no se devuelve.';

test('confirmación al cliente', () => {
  const m = c.correoConfirmacion(base({ codigo: 'UF-ABC234', token_cancelar: 'tok', nombre: '<b>Ana</b>' }), cfg);
  a.match(m.asunto, /UF-ABC234/);
  a.ok(m.html.includes('/reservas/cancelar/?t=tok'));
  a.ok(m.html.includes('Si cancelas con 24 horas o más de anticipación te lo devolvemos'));
  a.ok(m.html.includes(POLITICA));
  a.ok(m.html.includes('Calle 53D # 19-06'));
  a.ok(m.html.includes('8:00 PM'));
  a.ok(!m.html.includes('<b>Ana</b>'));
  a.ok(m.html.includes('&lt;b&gt;Ana&lt;/b&gt;'));
});

test('confirmación del Hipódromo usa su dirección', () => {
  const m = c.correoConfirmacion(base({ sede: 'HIPODROMO' }), cfg);
  a.ok(m.html.includes('Cra. 29 # 26-04, Soledad'));
  a.ok(!m.html.includes('Calle 53D'));
});

test('cancelación al cliente: con y sin devolución, escapado', () => {
  const con = c.correoCancelacion(base({ estado: 'CANCELADA_CON_DEVOLUCION', devolucion: 'PENDIENTE', nombre: '<i>x</i>' }), cfg);
  a.match(con.asunto, /UF-ABC234/);
  a.ok(con.html.includes('devol'));
  a.ok(con.html.includes('$50.000'));
  a.ok(!con.html.includes('<i>x</i>'));
  // Bold no reembolsa Nequi ni PSE: el correo no puede prometer una devolución automática.
  a.ok(!/medio de pago que usaste|tarjeta/.test(con.html));
  a.ok(con.html.includes('Te escribiremos para coordinar la devolución'));
  const sin = c.correoCancelacion(base({ estado: 'CANCELADA_SIN_DEVOLUCION', devolucion: 'NO' }), cfg);
  a.ok(sin.html.includes('no se devuelve'));
});

// La reserva pagó $1.000 y después el dueño subió el adelanto a $50.000 (pasó el 22/10/2026):
// los correos hablan de lo que pagó, no del valor actual de Config.
test('los correos usan el adelanto que pagó la reserva, no el de Config', () => {
  const pagada = base({ estado: 'CANCELADA_CON_DEVOLUCION', adelanto: 1000 });
  for (const m of [c.correoConfirmacion(pagada, cfg), c.correoCancelacion(pagada, cfg), c.correoAdminDevolucion(pagada, cfg)]) {
    a.ok(m.html.includes('$1.000'), m.asunto);
    a.ok(!m.html.includes('$50.000'), m.asunto);
  }
  // Reservas de antes de la columna "adelanto": se usa el de Config.
  a.ok(c.correoConfirmacion(base({ adelanto: '' }), cfg).html.includes('$50.000'));
});

test('avisos al administrador', () => {
  const d = c.correoAdminDevolucion(base({ estado: 'CANCELADA_CON_DEVOLUCION', devolucion: 'PENDIENTE', nombre: '<u>Z</u>' }), cfg);
  a.match(d.asunto, /UF-ABC234/);
  a.ok(d.html.includes('LNK_TEST123'));
  a.ok(d.html.includes('$50.000'));
  a.ok(!d.html.includes('<u>Z</u>'));
  a.ok(d.html.includes('Nequi, PSE o transferencia'));
  const p = c.correoAdminPagoSinCupo(base({ estado: 'PAGO_SIN_CUPO', devolucion: 'PENDIENTE' }));
  a.match(p.asunto, /UF-ABC234/);
  a.ok(p.html.includes('laura@example.com'));
});

test('enviarCorreo no hace nada sin destinatario', () => {
  let llamadas = 0;
  c.MailApp = { sendEmail() { llamadas++; } };
  c.enviarCorreo('', { asunto: 'a', html: 'b' });
  a.equal(llamadas, 0);
  c.enviarCorreo('x@y.co', { asunto: 'a', html: 'b' });
  a.equal(llamadas, 1);
});

test('política construida desde Config: con los valores por defecto es el texto fijo', () => {
  a.equal(c.textoPolitica(cfg), POLITICA);
  const otra = c.combinarConfig([['adelanto', '60000'], ['cancelacion_horas', '48']]);
  a.equal(c.textoPolitica(otra), 'El adelanto de $60.000 se descuenta de tu cuenta. Si cancelas con 48 horas o más de anticipación te lo devolvemos. Si cancelas después o no llegas, no se devuelve.');
  // Sin adelanto guardado (reservas de antes de la columna) se usa el de Config.
  const m = c.correoConfirmacion(base({ adelanto: '' }), otra);
  a.ok(m.html.includes('$60.000')); a.ok(!m.html.includes('$50.000'));
  const k = c.correoCancelacion(base({ estado: 'CANCELADA_SIN_DEVOLUCION' }), otra);
  a.ok(k.html.includes('48 horas'));
  a.ok(c.correoAdminDevolucion(base({ adelanto: '' }), otra).html.includes('$60.000'));
});

test('correos: fecha larga y la hora 00:00 del viernes como madrugada', () => {
  const m = c.correoConfirmacion(base({ fecha: '2026-10-23', hora: '00:00' }), cfg);
  a.ok(m.html.includes('viernes 23 de octubre de 2026'));
  a.ok(m.html.includes('12:00 AM (noche del viernes al sábado)'));
  a.ok(!m.html.includes('2026-10-23'));
  const n = c.correoConfirmacion(base({ fecha: '2026-10-22', hora: '20:00' }), cfg);
  a.ok(n.html.includes('jueves 22 de octubre de 2026')); a.ok(n.html.includes('8:00 PM'));
});
