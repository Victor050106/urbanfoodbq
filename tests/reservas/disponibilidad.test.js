const { test } = require('node:test'); const a = require('node:assert/strict');
const { cargar, ms } = require('./cargar');
const c = cargar('apps-script/reservas/Config.gs', 'apps-script/reservas/Calendario.gs',
  'apps-script/reservas/Disponibilidad.gs');
const cfg = c.combinarConfig([]);
const ahora = ms('2026-10-17T17:00:00Z');
const r = (o) => ({ sede: 'ELCARMEN', espacio: 'MESA', fecha: '2026-10-22', hora: '20:00',
                    personas: 8, estado: 'CONFIRMADA', vence: '', ...o });
const libres = (sede, personas, reservas, fecha = '2026-10-22') => Object.fromEntries(
  c.horasDisponibles(sede, fecha, personas, reservas, ahora, cfg, []).map(x => [x.hora, x.libre]));

test('espacio según sede y grupo: mínimo 6, El Carmen hasta 20, Hipódromo piso 1 hasta 16 y piso 2 hasta 30', () => {
  a.equal(c.espacioPara('ELCARMEN', 5, cfg), null);
  a.equal(c.espacioPara('ELCARMEN', 6, cfg), 'MESA');
  a.equal(c.espacioPara('ELCARMEN', 20, cfg), 'MESA');
  a.equal(c.espacioPara('ELCARMEN', 21, cfg), null);
  a.equal(c.espacioPara('HIPODROMO', 5, cfg), null);
  a.equal(c.espacioPara('HIPODROMO', 16, cfg), 'PISO1');
  a.equal(c.espacioPara('HIPODROMO', 17, cfg), 'PISO2');
  a.equal(c.espacioPara('HIPODROMO', 30, cfg), 'PISO2');
  a.equal(c.espacioPara('HIPODROMO', 31, cfg), null);
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
test('El Carmen: la segunda reserva del día va a 3 h o más de la primera', () => {
  const h = libres('ELCARMEN', 8, [r({ hora: '20:00' })]);
  a.equal(h['17:00'], true);   // 3 h antes
  a.equal(h['17:30'], false);
  a.equal(h['22:30'], false);
  a.equal(h['23:00'], true);   // 3 h después
});
test('El Carmen: con 2 reservas el día queda lleno; las vencidas o canceladas no cuentan', () => {
  const llenas = [r({ hora: '16:00' }), r({ hora: '20:00' })];
  a.ok(Object.values(libres('ELCARMEN', 8, llenas)).every(x => !x));
  const noCuentan = [r({ hora: '16:00' }), r({ hora: '20:00', estado: 'CANCELADA_CON_DEVOLUCION' }),
                     r({ hora: '23:00', estado: 'PENDIENTE_PAGO', vence: '2026-10-17T16:50:00Z' })];
  a.equal(libres('ELCARMEN', 8, noCuentan)['19:00'], true);
});
test('Hipódromo: una reserva por piso al día, a cualquier hora', () => {
  const piso1 = [r({ sede: 'HIPODROMO', espacio: 'PISO1', hora: '18:00' })];
  a.ok(Object.values(libres('HIPODROMO', 10, piso1)).every(x => !x));   // piso 1 ocupado
  a.ok(Object.values(libres('HIPODROMO', 20, piso1)).every(x => x));    // piso 2 sigue libre
});
test('el cupo es por sede y por fecha', () => {
  const res = [r({ hora: '16:00' }), r({ hora: '20:00' })];
  a.ok(Object.values(libres('HIPODROMO', 8, res)).every(x => x));
  a.ok(Object.values(libres('ELCARMEN', 8, res, '2026-10-21')).every(x => x));
});
test('mismo día: solo horas con 2 h de anticipación', () => {
  const lunes = ms('2026-10-19T23:10:00Z'); // 18:10 Bogotá
  const h = c.horasDisponibles('HIPODROMO', '2026-10-19', 8, [], lunes, cfg, []);
  a.equal(h.find(x => x.hora === '20:00').libre, false);
  a.equal(h.find(x => x.hora === '20:30').libre, true);
});
test('viernes, sábado y domingo no se reserva; grupos fuera de rango tampoco', () => {
  a.equal(c.horasDisponibles('ELCARMEN', '2026-10-23', 8, [], ahora, cfg, []).length, 0); // viernes
  a.equal(c.horasDisponibles('HIPODROMO', '2026-10-24', 8, [], ahora, cfg, []).length, 0); // sábado
  a.equal(c.horasDisponibles('ELCARMEN', '2026-10-22', 25, [], ahora, cfg, []).length, 0);
  a.equal(c.horasDisponibles('ELCARMEN', '2026-10-22', 4, [], ahora, cfg, []).length, 0);
  const d = c.diasDelMes('ELCARMEN', '2026-10', 8, [], ahora, cfg, []);
  a.equal(d.length, 31);
  a.equal(d.find(x => x.fecha === '2026-10-22').disponible, true);  // jueves
  a.equal(d.find(x => x.fecha === '2026-10-23').disponible, false); // viernes
  a.equal(d.find(x => x.fecha === '2026-10-16').disponible, false); // ya pasó
});
test('validación', () => {
  const ok = { sede: 'ELCARMEN', personas: 8, fecha: '2026-10-22', hora: '20:00', nombre: 'Laura Gómez',
    tipo_doc: 'CC', documento: '1.143.000.000', correo: 'laura@correo.com', celular: '300 000 0000',
    comentario: '', acepta_datos: true, acepta_politica: true };
  const v = c.validarSolicitud(ok, cfg);
  a.equal(v.ok, true); a.equal(v.limpio.documento, '1143000000'); a.equal(v.limpio.celular, '3000000000');
  a.equal(v.limpio.espacio, 'MESA');
  a.equal(c.validarSolicitud({ ...ok, personas: 25 }, cfg).error, 'GRUPO_GRANDE');
  a.equal(c.validarSolicitud({ ...ok, sede: 'HIPODROMO', personas: 25 }, cfg).limpio.espacio, 'PISO2');
  a.equal(c.validarSolicitud({ ...ok, sede: 'HIPODROMO', personas: 31 }, cfg).error, 'GRUPO_GRANDE');
  a.equal(c.validarSolicitud({ ...ok, tipo_doc: 'PA', documento: 'AB12345' }, cfg).ok, true);
  a.equal(c.validarSolicitud({ ...ok, documento: '12' }, cfg).error, 'DOCUMENTO');
  a.equal(c.validarSolicitud({ ...ok, correo: 'laura@' }, cfg).error, 'CORREO');
  a.equal(c.validarSolicitud({ ...ok, acepta_datos: false }, cfg).error, 'AUTORIZACION');
  a.equal(c.validarSolicitud({ ...ok, acepta_politica: false }, cfg).error, 'AUTORIZACION');
  a.equal(c.validarSolicitud({ ...ok, sede: 'OTRA' }, cfg).error, 'SEDE');
  a.equal(c.validarSolicitud({ ...ok, personas: 5 }, cfg).error, 'PERSONAS');
  a.equal(c.validarSolicitud({ ...ok, personas: 8.5 }, cfg).error, 'PERSONAS');
  a.equal(c.validarSolicitud({ ...ok, fecha: '2026-13-40' }, cfg).error, 'FECHA');
  a.equal(c.validarSolicitud({ ...ok, hora: '3:17' }, cfg).error, 'HORA');
  a.equal(c.validarSolicitud({ ...ok, nombre: 'Al' }, cfg).error, 'NOMBRE');
  a.equal(c.validarSolicitud({ ...ok, celular: '123' }, cfg).error, 'CELULAR');
  a.equal(c.validarSolicitud({ ...ok, celular: '+57 300 000 0000' }, cfg).limpio.celular, '3000000000');
  a.equal(c.validarSolicitud({ ...ok, tipo_doc: 'XX' }, cfg).error, 'DOCUMENTO');
  const g = c.validarSolicitud({ ...ok, personas: '12', nombre: '  Laura  ' }, cfg);
  a.equal(g.limpio.personas, 12); a.equal(g.limpio.nombre, 'Laura');
});
