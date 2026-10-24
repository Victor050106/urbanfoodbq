const test = require('node:test');
const a = require('node:assert/strict');
const { cargar } = require('./cargar');

const c = cargar('assets/js/reservas-comun.js');

test('formatos', () => {
  a.equal(c.formatoPesos(50000), '$50.000');
  a.equal(c.formatoHora('20:00'), '8:00 PM'); a.equal(c.formatoHora('00:00'), '12:00 AM');
  a.equal(c.formatoFechaLarga('2026-10-22'), 'jueves 22 de octubre');
});
test('formatoHora cubre mediodía y madrugada', () => {
  a.equal(c.formatoHora('12:30'), '12:30 PM'); a.equal(c.formatoHora('16:00'), '4:00 PM'); a.equal(c.formatoHora('01:00'), '1:00 AM');
});
test('cuadrícula de octubre 2026 empieza en jueves', () => {
  const g = c.cuadriculaMes('2026-10');
  a.deepEqual(JSON.parse(JSON.stringify(g.slice(0, 4))), [null, null, null, '2026-10-01']); a.equal(g.at(-1), '2026-10-31');
});
test('cuadrícula que empieza en lunes no lleva relleno', () => {
  const g = c.cuadriculaMes('2026-06'); // 1-jun-2026 es lunes
  a.equal(g[0], '2026-06-01'); a.equal(g.length, 30);
});
test('enlace de calendario dura lo que diga Config y la madrugada pasa al día siguiente', () => {
  const u = new URL(c.enlaceCalendario({ codigo: 'UF-A', sede: 'ELCARMEN', espacio: 'MESA', fecha: '2026-10-23', hora: '22:00' }, 180));
  a.equal(u.searchParams.get('dates'), '20261023T220000/20261024T010000');
  a.equal(u.searchParams.get('ctz'), 'America/Bogota');
});
test('enlace de calendario: 2 h por defecto y una hora de madrugada cae en el día siguiente', () => {
  const u = new URL(c.enlaceCalendario({ codigo: 'UF-B', sede: 'HIPODROMO', espacio: 'PISO1', fecha: '2026-10-23', hora: '00:30' }));
  a.equal(u.searchParams.get('dates'), '20261024T003000/20261024T023000');
});
test('escapeHtml neutraliza etiquetas y comillas', () => {
  a.equal(c.escapeHtml('<b a="1">&\'</b>'), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;&lt;/b&gt;');
});
test('sedes y mensajes de error', () => {
  a.equal(c.SEDES_RESERVA.ELCARMEN.whatsapp, '573127557694');
  a.equal(c.SEDES_RESERVA.HIPODROMO.nombre, 'Hipódromo');
  ['SIN_CUPO', 'BOLD', 'CORREO', 'CELULAR', 'DOCUMENTO', 'AUTORIZACION', 'RED', 'INTERNO', 'GRUPO_GRANDE'].forEach((k) => a.ok(c.MENSAJES_ERROR[k], k));
});

test('instanteReserva usa Bogotá (UTC-5) y manda la madrugada al día siguiente', () => {
  a.equal(c.instanteReserva('2026-10-23', '20:00'), Date.parse('2026-10-24T01:00:00Z'));
  a.equal(c.instanteReserva('2026-10-23', '00:00'), Date.parse('2026-10-24T05:00:00Z'));
});
test('política fija con el adelanto', () => {
  a.equal(c.textoPolitica(), 'El adelanto de $50.000 se descuenta de tu cuenta. Si cancelas con 24 horas o más de anticipación te lo devolvemos en máximo 5 días hábiles. Si cancelas después o no llegas, no se devuelve.');
});

test('todo código de error del API tiene mensaje', () => {
  // CODIGO es interno: manejar() lo devuelve como INTERNO.
  const codigos = ['ACCION', 'AUTORIZACION', 'BOLD', 'CELULAR', 'CLAVE', 'CONFIGURACION', 'CORREO', 'DOCUMENTO', 'FECHA',
    'GRUPO_GRANDE', 'HORA', 'INTERNO', 'MARCA', 'NOMBRE', 'NO_CANCELABLE', 'NO_ENCONTRADA', 'NO_MARCABLE', 'PARAMETROS',
    'PERMISO', 'PERSONAS', 'RED', 'SEDE', 'SIN_CUPO', 'TOKEN', 'BLOQUEADO'];
  const faltan = codigos.filter((k) => !c.MENSAJES_ERROR[k]);
  a.deepEqual(JSON.parse(JSON.stringify(faltan)), []);
});

test('panel: ordena por fecha y hora real, canceladas al final de su día', () => {
  const r = (fecha, hora, estado) => ({ codigo: fecha + hora + estado, fecha, hora, estado: estado || 'CONFIRMADA' });
  const lista = [r('2026-10-23', '00:30'), r('2026-10-23', '20:00', 'CANCELADA_CON_DEVOLUCION'), r('2026-10-22', '19:00'),
    r('2026-10-23', '18:00'), r('2026-10-23', '23:30'), r('2026-10-23', '16:00', 'LLEGO')];
  const o = c.ordenarReservasPanel(lista).map((x) => x.hora + (x.estado.startsWith('CANC') ? 'c' : ''));
  a.deepEqual(JSON.parse(JSON.stringify(o)), ['19:00', '16:00', '18:00', '23:30', '00:30', '20:00c']);
});
test('panel: agrupa por fecha en orden', () => {
  const g = JSON.parse(JSON.stringify(c.agruparPorFecha([{ fecha: '2026-10-22', hora: '19:00' }, { fecha: '2026-10-22', hora: '20:00' }, { fecha: '2026-10-23', hora: '19:00' }])));
  a.equal(g.length, 2); a.equal(g[0].fecha, '2026-10-22'); a.equal(g[0].reservas.length, 2); a.equal(g[1].fecha, '2026-10-23');
});
test('panel: sumar días a una fecha', () => {
  a.equal(c.sumarDiasFecha('2026-10-31', 1), '2026-11-01');
});

test('fecha de servicio en Bogotá: antes de las 06:00 sigue siendo la noche anterior', () => {
  a.equal(c.fechaServicioBogota(Date.parse('2026-10-24T04:30:00Z')), '2026-10-23');
  a.equal(c.fechaServicioBogota(Date.parse('2026-10-24T06:00:00Z')), '2026-10-23');
  a.equal(c.fechaServicioBogota(Date.parse('2026-10-24T11:00:00Z')), '2026-10-24');
});

// ---- Revisión final ----

test('etiqueta de hora de servicio: 00:00 del viernes es la noche del viernes al sábado', () => {
  a.equal(c.etiquetaHoraServicio('2026-10-23', '00:00'), '12:00 AM (noche del viernes al sábado)');
  a.equal(c.etiquetaHoraServicio('2026-10-25', '00:30'), '12:30 AM (noche del domingo al lunes)');
  a.equal(c.etiquetaHoraServicio('2026-10-23', '20:00'), '8:00 PM');
  a.equal(c.notaMadrugada('00:00'), 'madrugada');
  a.equal(c.notaMadrugada('16:00'), '');
});
test('reglas del servidor con respaldo y política construida con ellas', () => {
  const def = { adelanto: 50000, cancelacion_horas: 24, duracion_min: 120, grupo_min: 6, max_elcarmen: 20, piso1_max_hipodromo: 16, piso2_max_hipodromo: 30 };
  a.deepEqual(JSON.parse(JSON.stringify(c.combinarReglas())), def);
  a.deepEqual(JSON.parse(JSON.stringify(c.combinarReglas({ adelanto: 60000, grupo_min: 'x' }))), { ...def, adelanto: 60000 });
  a.equal(c.textoPolitica(c.combinarReglas({ adelanto: 60000, cancelacion_horas: 48 })),
    'El adelanto de $60.000 se descuenta de tu cuenta. Si cancelas con 48 horas o más de anticipación te lo devolvemos en máximo 5 días hábiles. Si cancelas después o no llegas, no se devuelve.');
});
test('código de reserva en la URL aunque Bold agregue parámetros', () => {
  a.equal(c.codigoDeUrl('?codigo=UF-ABC234'), 'UF-ABC234');
  a.equal(c.codigoDeUrl('?codigo=UF-ABC234&bold-order-id=LNK_1&bold-tx-status=approved'), 'UF-ABC234');
  a.equal(c.codigoDeUrl('?codigo=UF-ABC234?bold-order-id=LNK_1'), 'UF-ABC234');
  a.equal(c.codigoDeUrl('?api=local&codigo=UF-ABC234'), 'UF-ABC234');
  a.equal(c.codigoDeUrl('?codigo=nada'), '');
  a.equal(c.codigoDeUrl(''), '');
});
test('bloqueo del panel tiene mensaje', () => {
  a.equal(c.MENSAJES_ERROR.BLOQUEADO, 'Demasiados intentos. Espera unos minutos.');
});
test('la página anticipa el mismo lugar que el servidor y dice la duración', () => {
  const r = c.combinarReglas();
  a.equal(c.espacioReserva('ELCARMEN', 6, r), 'MESA');
  a.equal(c.espacioReserva('ELCARMEN', 21, r), '');
  a.equal(c.espacioReserva('HIPODROMO', 16, r), 'PISO1');
  a.equal(c.espacioReserva('HIPODROMO', 17, r), 'PISO2');
  a.equal(c.espacioReserva('HIPODROMO', 5, r), '');
  a.equal(c.maxPersonasReserva('HIPODROMO', r), 30);
  a.equal(c.textoDuracion(120), '2 horas'); a.equal(c.textoDuracion(60), '1 hora'); a.equal(c.textoDuracion(90), '90 minutos');
});
test('los mensajes de tamaño de grupo no traen números fijos', () => {
  a.doesNotMatch(c.MENSAJES_ERROR.PERSONAS, /\d/);
  a.doesNotMatch(c.MENSAJES_ERROR.GRUPO_GRANDE, /\d/);
});
