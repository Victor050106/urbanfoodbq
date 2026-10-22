const { test } = require('node:test'); const a = require('node:assert/strict');
const { cargar, ms, ahora, base } = require('./cargar');
const c = cargar('apps-script/reservas/Config.gs', 'apps-script/reservas/Calendario.gs',
  'apps-script/reservas/Disponibilidad.gs', 'apps-script/reservas/Ciclo.gs');
const cfg = c.combinarConfig([]);
const plano = (x) => JSON.parse(JSON.stringify(x));

test('pago aprobado confirma una sola vez', () => {
  const p = base({ estado: 'PENDIENTE_PAGO', vence: '2026-10-17T17:15:00Z' });
  const x = c.aplicarEstadoBold(p, 'PAID', ahora, true);
  a.equal(x.reserva.estado, 'CONFIRMADA'); a.equal(x.evento, 'CONFIRMADA'); a.ok(x.reserva.pagada_en);
  const y = c.aplicarEstadoBold(x.reserva, 'PAID', ahora, true);
  a.equal(y.cambio, false); a.equal(y.evento, null);
});
test('pago tardío: confirma si hay cupo, si no PAGO_SIN_CUPO con devolución', () => {
  const e = base({ estado: 'EXPIRADA' });
  a.equal(c.aplicarEstadoBold(e, 'PAID', ahora, true).reserva.estado, 'CONFIRMADA');
  const z = c.aplicarEstadoBold(e, 'PAID', ahora, false);
  a.equal(z.reserva.estado, 'PAGO_SIN_CUPO'); a.equal(z.reserva.devolucion, 'PENDIENTE');
  a.equal(z.evento, 'PAGO_SIN_CUPO');
});
test('pago después de RECHAZADA no se pierde', () => {
  const e = base({ estado: 'RECHAZADA' });
  a.equal(c.aplicarEstadoBold(e, 'PAID', ahora, true).reserva.estado, 'CONFIRMADA');
  const z = c.aplicarEstadoBold(e, 'PAID', ahora, false);
  a.equal(z.reserva.estado, 'PAGO_SIN_CUPO'); a.equal(z.reserva.devolucion, 'PENDIENTE'); a.equal(z.evento, 'PAGO_SIN_CUPO');
});
test('rechazado y vencido', () => {
  const p = base({ estado: 'PENDIENTE_PAGO', vence: '2026-10-17T17:15:00Z' });
  a.equal(c.aplicarEstadoBold(p, 'REJECTED', ahora, true).reserva.estado, 'RECHAZADA');
  a.equal(c.aplicarEstadoBold(p, 'CANCELLED', ahora, true).reserva.estado, 'RECHAZADA');
  a.equal(c.aplicarEstadoBold(p, 'ACTIVE', ahora, true).cambio, false);
  a.equal(c.aplicarEstadoBold(p, 'PROCESSING', ahora, true).cambio, false);
  a.equal(c.aplicarEstadoBold(p, 'EXPIRED', ahora, true).reserva.estado, 'EXPIRADA');
  a.equal(c.vencerSiCorresponde(p, ms('2026-10-17T17:16:00Z')).reserva.estado, 'EXPIRADA');
  a.equal(c.vencerSiCorresponde(p, ahora).cambio, false);
  a.equal(p.estado, 'PENDIENTE_PAGO');
});
test('cancelación: 24 h exactas devuelve, menos no; madrugada de viernes cuenta como sábado', () => {
  const r = base({ estado: 'CONFIRMADA', fecha: '2026-10-22', hora: '20:00' }); // 23-oct 01:00Z
  a.deepEqual(plano(c.evaluarCancelacion(r, ms('2026-10-22T01:00:00Z'), cfg)), { puede: true, conDevolucion: true });
  a.equal(c.evaluarCancelacion(r, ms('2026-10-22T01:00:01Z'), cfg).conDevolucion, false);
  const v = base({ estado: 'CONFIRMADA', fecha: '2026-10-23', hora: '00:00' }); // sáb 24 05:00Z
  a.equal(c.evaluarCancelacion(v, ms('2026-10-23T04:00:00Z'), cfg).conDevolucion, true);
  a.equal(c.evaluarCancelacion(r, ms('2026-10-23T02:00:00Z'), cfg).motivo, 'PASADA');
  a.equal(c.evaluarCancelacion(base({ estado: 'PENDIENTE_PAGO' }), ahora, cfg).motivo, 'ESTADO');
  const k = c.cancelar(r, ms('2026-10-20T00:00:00Z'), cfg);
  a.equal(k.estado, 'CANCELADA_CON_DEVOLUCION'); a.equal(k.devolucion, 'PENDIENTE');
  const s = c.cancelar(r, ms('2026-10-22T12:00:00Z'), cfg);
  a.equal(s.estado, 'CANCELADA_SIN_DEVOLUCION'); a.equal(s.devolucion, 'NO');
  a.throws(() => c.cancelar(r, ms('2026-10-23T02:00:00Z'), cfg), /NO_CANCELABLE/);
});
test('marcas del panel; descuento no se aplica dos veces', () => {
  const r = base({ estado: 'CONFIRMADA' });
  a.equal(c.marcarPanel(r, 'LLEGO', ahora).reserva.estado, 'LLEGO');
  const d = c.marcarPanel(r, 'DESCUENTO', ahora);
  a.equal(d.reserva.descuento_aplicado, true);
  a.equal(c.marcarPanel(d.reserva, 'DESCUENTO', ahora).cambio, false);
  a.throws(() => c.marcarPanel(base({ estado: 'CANCELADA_SIN_DEVOLUCION' }), 'LLEGO', ahora), /NO_MARCABLE/);
});
test('token de panel', () => {
  const h = (t) => require('crypto').createHmac('sha256', 's').update(t).digest('hex');
  const t = c.crearTokenPanel('HIPODROMO', ahora, h);
  a.equal(c.verificarTokenPanel(t, ahora + 3600e3, h), 'HIPODROMO');
  a.equal(c.verificarTokenPanel(t, ahora + 15 * 3600e3, h), null);
  a.equal(c.verificarTokenPanel(t.replace('HIPODROMO', 'ELCARMEN'), ahora, h), null);
  a.equal(c.verificarTokenPanel('basura', ahora, h), null);
});
test('código y resumen público', () => {
  a.match(c.generarCodigo(Math.random), /^UF-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
  const s = c.resumenPublico(base({ nombre: 'Laura Gómez', documento: '1', correo: 'x@y.co' }));
  a.equal(s.nombre_corto, 'Laura'); a.equal(s.documento, undefined); a.equal(s.correo, undefined);
});
test('nueva reserva pendiente', () => {
  const lim = { sede: 'ELCARMEN', espacio: 'MESA', personas: 4, fecha: '2026-10-22', hora: '20:00',
    nombre: 'Laura Gómez', tipo_doc: 'CC', documento: '123', correo: 'a@b.co', celular: '3001234567', comentario: '' };
  const n = c.nuevaReserva(lim, 'MESA', ahora, cfg, { codigo: 'UF-AAAAAA', token: 'tk' });
  a.equal(n.estado, 'PENDIENTE_PAGO'); a.equal(n.vence, new Date(ahora + 15 * 60000).toISOString());
  a.equal(n.devolucion, 'NO'); a.equal(n.descuento_aplicado, false); a.equal(n.codigo, 'UF-AAAAAA');
  a.equal(n.adelanto, cfg.adelanto); // queda guardado lo que se le cobra
});
test('cancelar deja sello de tiempo en marcada_en', () => {
  const r = base({ estado: 'CONFIRMADA', fecha: '2026-10-22', hora: '20:00' });
  a.equal(c.cancelar(r, ms('2026-10-20T00:00:00Z'), cfg).marcada_en, '2026-10-20T00:00:00.000Z');
});
test('nota de link de Bold cerrado: se agrega una vez y conserva las notas', () => {
  const r = c.marcarBoldCerrado(base({ estado: 'EXPIRADA', notas: 'Cliente llamó' }));
  a.ok(c.boldCerrado(r)); a.ok(r.notas.startsWith('Cliente llamó'));
  a.equal(c.boldCerrado(base({ notas: '' })), false);
  a.equal(c.marcarBoldCerrado(base({ notas: '' })).notas, c.NOTA_BOLD_CERRADO);
});
