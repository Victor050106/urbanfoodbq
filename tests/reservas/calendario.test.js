const { test } = require('node:test'); const a = require('node:assert/strict');
const { cargar } = require('./cargar');
const c = cargar('apps-script/reservas/Config.gs', 'apps-script/reservas/Calendario.gs');
const cfg = c.combinarConfig([]);
const ms = (iso) => Date.parse(iso);

test('hoy en Bogotá aunque en UTC ya sea mañana', () => {
  a.equal(c.hoyBogota(ms('2026-10-18T04:30:00Z')), '2026-10-17');
});
test('00:00 es madrugada de la misma fecha de servicio', () => {
  a.equal(c.horaAMinutos('00:00'), 1440);
  a.equal(c.horaAMinutos('20:30'), 1230);
  a.equal(c.minutosAHora(1440), '00:00');
  a.equal(c.instanteMs('2026-10-23', '00:00'), ms('2026-10-24T05:00:00Z'));
});
test('horas lun-jue: 16:00 a 23:30', () => {
  const h = c.horasDelDia('2026-10-22', cfg);
  a.equal(h[0], '16:00'); a.equal(h.at(-1), '23:30'); a.equal(h.length, 16);
});
test('la última hora es 1 h antes del cierre: viernes 00:00, sábado 01:00', () => {
  a.equal(c.horasDelDia('2026-10-23', cfg).at(-1), '00:00');
  a.equal(c.horasDelDia('2026-10-24', cfg).at(-1), '01:00');
});
test('fechas habilitadas', () => {
  const ahora = ms('2026-10-17T17:00:00Z');
  a.equal(c.fechaHabilitada('2026-10-22', 'ELCARMEN', ahora, cfg, []), true);   // jueves
  a.equal(c.fechaHabilitada('2026-10-23', 'ELCARMEN', ahora, cfg, []), false);  // viernes
  a.equal(c.fechaHabilitada('2026-10-24', 'ELCARMEN', ahora, cfg, []), false);  // sábado
  a.equal(c.fechaHabilitada('2026-10-16', 'ELCARMEN', ahora, cfg, []), false);  // pasado
  a.equal(c.fechaHabilitada('2027-01-14', 'ELCARMEN', ahora, cfg, []), true);   // < 3 meses (jueves)
  a.equal(c.fechaHabilitada('2027-01-18', 'ELCARMEN', ahora, cfg, []), false);  // > 3 meses
  a.equal(c.fechaHabilitada('2026-10-24', 'HIPODROMO', ahora, cfg,
    [{ fecha: '2026-10-24', sede: 'HIPODROMO', tipo: 'ABRIR' }]), true);
  a.equal(c.fechaHabilitada('2026-10-22', 'ELCARMEN', ahora, cfg,
    [{ fecha: '2026-10-22', sede: 'TODAS', tipo: 'BLOQUEAR' }]), false);
});
test('normaliza lo que devuelve Sheets', () => {
  a.equal(c.normalizarFecha(new Date('2026-10-24T05:00:00Z')), '2026-10-24');
  a.equal(c.normalizarFecha('2026-10-24'), '2026-10-24');
  a.equal(c.normalizarHora(new Date('1899-12-31T01:00:00Z')), '20:00'); // hora de Sheets en Bogotá
  a.equal(c.normalizarHora('8:00'), '08:00');
});
test('etiqueta de hora de servicio: la madrugada nombra la noche real', () => {
  a.equal(c.etiquetaHoraServicio('2026-10-23', '00:00'), '12:00 AM (noche del viernes al sábado)');
  a.equal(c.etiquetaHoraServicio('2026-10-22', '00:30'), '12:30 AM (noche del jueves al viernes)');
  a.equal(c.etiquetaHoraServicio('2026-10-25', '01:00'), '1:00 AM (noche del domingo al lunes)');
  a.equal(c.etiquetaHoraServicio('2026-10-23', '20:00'), '8:00 PM');
  a.equal(c.etiquetaHoraServicio('2026-10-23', '16:00'), '4:00 PM');
  a.equal(c.hora12('12:30'), '12:30 PM');
});
test('fecha larga en español', () => {
  a.equal(c.fechaLarga('2026-10-23'), 'viernes 23 de octubre de 2026');
  a.equal(c.fechaLarga('2027-01-03'), 'domingo 3 de enero de 2027');
});
