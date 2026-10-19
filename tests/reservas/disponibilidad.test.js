const { test } = require('node:test'); const a = require('node:assert/strict');
const { cargar, ms } = require('./cargar');
const c = cargar('apps-script/reservas/Config.gs', 'apps-script/reservas/Calendario.gs',
  'apps-script/reservas/Disponibilidad.gs');
const cfg = c.combinarConfig([]);
const ahora = ms('2026-10-17T17:00:00Z');
const r = (o) => ({ sede: 'ELCARMEN', espacio: 'MESA', fecha: '2026-10-22', hora: '20:00',
                    personas: 4, estado: 'CONFIRMADA', vence: '', ...o });

test('espacio según sede y grupo', () => {
  a.equal(c.espacioPara('ELCARMEN', 9, cfg), 'MESA');
  a.equal(c.espacioPara('ELCARMEN', 10, cfg), 'VIP');
  a.equal(c.espacioPara('ELCARMEN', 20, cfg), 'VIP');
  a.equal(c.espacioPara('HIPODROMO', 15, cfg), 'MESA');
  a.equal(c.espacioPara('ELCARMEN', 21, cfg), null);
  a.equal(c.espacioPara('HIPODROMO', 1, cfg), null);
});
test('qué estados ocupan cupo', () => {
  a.equal(c.ocupaCupo(r({ estado: 'CONFIRMADA' }), ahora), true);
  a.equal(c.ocupaCupo(r({ estado: 'LLEGO' }), ahora), true);
  a.equal(c.ocupaCupo(r({ estado: 'NO_LLEGO' }), ahora), true);
  a.equal(c.ocupaCupo(r({ estado: 'PENDIENTE_PAGO', vence: '2026-10-17T17:10:00Z' }), ahora), true);
  a.equal(c.ocupaCupo(r({ estado: 'PENDIENTE_PAGO', vence: '2026-10-17T16:50:00Z' }), ahora), false);
  a.equal(c.ocupaCupo(r({ estado: 'PENDIENTE_PAGO', vence: '' }), ahora), false);
  a.equal(c.ocupaCupo(r({ estado: 'EXPIRADA' }), ahora), false);
  a.equal(c.ocupaCupo(r({ estado: 'PAGO_SIN_CUPO' }), ahora), false);
});
test('tope de mesas por noche cuenta confirmadas y pendientes vigentes, no vencidas', () => {
  const res = [r({ personas: 12 }), r({ personas: 4, estado: 'PENDIENTE_PAGO', vence: '2026-10-17T17:10:00Z' }),
               r({ personas: 10, estado: 'PENDIENTE_PAGO', vence: '2026-10-17T16:50:00Z' }),
               r({ personas: 10, estado: 'CANCELADA_CON_DEVOLUCION' })];
  const h = c.horasDisponibles('ELCARMEN', '2026-10-22', 4, res, ahora, cfg, []);
  a.ok(h.length > 0 && h.every(x => x.libre));       // 16 + 4 = 20 ≤ 20
  const h5 = c.horasDisponibles('ELCARMEN', '2026-10-22', 5, res, ahora, cfg, []);
  a.ok(h5.length > 0 && h5.every(x => !x.libre));    // 21 > 20
});
test('el tope es por sede y por fecha', () => {
  const res = [r({ personas: 20 })];
  a.ok(c.horasDisponibles('HIPODROMO', '2026-10-22', 4, res, ahora, cfg, []).every(x => x.libre));
  a.ok(c.horasDisponibles('ELCARMEN', '2026-10-21', 4, res, ahora, cfg, []).every(x => x.libre));
});
test('VIP: bloque de 3 h + 30 min de limpieza antes y después de una reserva', () => {
  const libres = (hora) => Object.fromEntries(c.horasDisponibles('ELCARMEN', '2026-10-22', 12,
    [r({ espacio: 'VIP', personas: 12, hora })], ahora, cfg, []).map(x => [x.hora, x.libre]));
  const tarde = libres('20:00');
  a.equal(tarde['16:30'], true); a.equal(tarde['17:00'], false); a.equal(tarde['21:30'], false);
  const temprano = libres('16:00');
  a.equal(temprano['19:00'], false); a.equal(temprano['19:30'], true);
});
test('el VIP no consume cupo de mesas y viceversa', () => {
  const res = [r({ personas: 20 })];
  a.ok(c.horasDisponibles('ELCARMEN', '2026-10-22', 12, res, ahora, cfg, []).every(x => x.libre));
  const vip = [r({ espacio: 'VIP', personas: 20 })];
  a.ok(c.horasDisponibles('ELCARMEN', '2026-10-22', 4, vip, ahora, cfg, []).every(x => x.libre));
});
test('VIP en viernes: conflicto con el límite exacto de 210 min', () => {
  // Reserva a 18:30: 22:00 queda justo libre
  const h = c.horasDisponibles('ELCARMEN', '2026-10-23', 12,
    [r({ espacio: 'VIP', personas: 12, fecha: '2026-10-23', hora: '18:30' })], ahora, cfg, []);
  const m = Object.fromEntries(h.map(x => [x.hora, x.libre]));
  a.equal(m['22:00'], true); a.equal(m['21:30'], false);
});
test('mismo día: solo horas con 2 h de anticipación', () => {
  const lunes = ms('2026-10-19T23:10:00Z'); // 18:10 Bogotá
  const h = c.horasDisponibles('HIPODROMO', '2026-10-19', 4, [], lunes, cfg, []);
  a.equal(h.find(x => x.hora === '20:00').libre, false);
  a.equal(h.find(x => x.hora === '20:30').libre, true);
});
test('sábado sin horas; días del mes marcan sábados como no disponibles', () => {
  a.equal(c.horasDisponibles('ELCARMEN', '2026-10-24', 4, [], ahora, cfg, []).length, 0);
  a.equal(c.horasDisponibles('ELCARMEN', '2026-10-22', 25, [], ahora, cfg, []).length, 0);
  const d = c.diasDelMes('ELCARMEN', '2026-10', 4, [], ahora, cfg, []);
  a.equal(d.length, 31);
  a.equal(d.find(x => x.fecha === '2026-10-24').disponible, false);
  a.equal(d.find(x => x.fecha === '2026-10-23').disponible, true);
  a.equal(d.find(x => x.fecha === '2026-10-16').disponible, false);
});
test('validación', () => {
  const ok = { sede: 'ELCARMEN', personas: 4, fecha: '2026-10-22', hora: '20:00', nombre: 'Laura Gómez',
    tipo_doc: 'CC', documento: '1.143.000.000', correo: 'laura@correo.com', celular: '300 000 0000',
    comentario: '', acepta_datos: true, acepta_politica: true };
  const v = c.validarSolicitud(ok, cfg);
  a.equal(v.ok, true); a.equal(v.limpio.documento, '1143000000'); a.equal(v.limpio.celular, '3000000000');
  a.equal(c.validarSolicitud({ ...ok, personas: 25 }, cfg).error, 'GRUPO_GRANDE');
  a.equal(c.validarSolicitud({ ...ok, tipo_doc: 'PA', documento: 'AB12345' }, cfg).ok, true);
  a.equal(c.validarSolicitud({ ...ok, documento: '12' }, cfg).error, 'DOCUMENTO');
  a.equal(c.validarSolicitud({ ...ok, correo: 'laura@' }, cfg).error, 'CORREO');
  a.equal(c.validarSolicitud({ ...ok, acepta_datos: false }, cfg).error, 'AUTORIZACION');
  a.equal(c.validarSolicitud({ ...ok, acepta_politica: false }, cfg).error, 'AUTORIZACION');
  a.equal(c.validarSolicitud({ ...ok, sede: 'OTRA' }, cfg).error, 'SEDE');
  a.equal(c.validarSolicitud({ ...ok, personas: 1 }, cfg).error, 'PERSONAS');
  a.equal(c.validarSolicitud({ ...ok, personas: 2.5 }, cfg).error, 'PERSONAS');
  a.equal(c.validarSolicitud({ ...ok, fecha: '2026-13-40' }, cfg).error, 'FECHA');
  a.equal(c.validarSolicitud({ ...ok, hora: '3:17' }, cfg).error, 'HORA');
  a.equal(c.validarSolicitud({ ...ok, nombre: 'Al' }, cfg).error, 'NOMBRE');
  a.equal(c.validarSolicitud({ ...ok, celular: '123' }, cfg).error, 'CELULAR');
  a.equal(c.validarSolicitud({ ...ok, celular: '+57 300 000 0000' }, cfg).limpio.celular, '3000000000');
  a.equal(c.validarSolicitud({ ...ok, tipo_doc: 'XX' }, cfg).error, 'DOCUMENTO');
  const g = c.validarSolicitud({ ...ok, personas: '12', nombre: '  Laura  ' }, cfg);
  a.equal(g.limpio.personas, 12); a.equal(g.limpio.nombre, 'Laura');
});
