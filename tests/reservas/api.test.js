const { test } = require('node:test'); const a = require('node:assert/strict');
const { cargar, ahora } = require('./cargar');
const { falsos, CORREOS } = require('./falsos');
const c = cargar('apps-script/reservas/Config.gs', 'apps-script/reservas/Calendario.gs',
  'apps-script/reservas/Disponibilidad.gs', 'apps-script/reservas/Ciclo.gs', 'apps-script/reservas/Hoja.gs',
  'apps-script/reservas/Bold.gs', 'apps-script/reservas/Correos.gs', 'apps-script/reservas/Api.gs',
  'apps-script/reservas/Disparador.gs');
const plano = (x) => JSON.parse(JSON.stringify(x));
const MIN = 60000;

// Los errores internos se registran con console.error: se capturan para no ensuciar la salida y poder afirmarlos.
const registrados = [];
c.console = { log() {}, warn() {}, error: (...x) => registrados.push(x.join(' ')) };

function solicitud(sobre) {
  return Object.assign({
    sede: 'ELCARMEN', personas: 8, fecha: '2026-10-22', hora: '20:00', nombre: 'Laura Gómez',
    tipo_doc: 'CC', documento: '1.234.567.890', correo: 'laura@example.com', celular: '300 123 4567',
    comentario: '', acepta_datos: true, acepta_politica: true, website: ''
  }, sobre);
}
const solicitudGrande = (sobre) => solicitud(Object.assign({ personas: 12 }, sobre));
const fila = (d, codigo) => d.hoja.reservas.find((r) => r.codigo === codigo);

function confirmada(d, sobre) {
  const { codigo } = c.manejar('crear', solicitud(sobre), d);
  d.bold.estados[fila(d, codigo).bold_link] = 'PAID';
  a.equal(c.manejar('estado', { codigo }, d).reserva.estado, 'CONFIRMADA');
  return codigo;
}

test('crear aparta cupo y devuelve el link de Bold', () => {
  const d = falsos();
  const x = c.manejar('crear', solicitudGrande(), d);
  a.equal(x.ok, true); a.match(x.codigo, /^UF-/); a.equal(x.url_pago, 'https://checkout.bold.co/falso');
  a.equal(d.hoja.reservas[0].estado, 'PENDIENTE_PAGO');
  const r = d.hoja.reservas[0];
  a.equal(r.espacio, 'MESA'); a.equal(r.documento, '1234567890'); a.equal(r.celular, '3001234567');
  a.equal(r.bold_link, 'LNK_FALSO_1'); a.equal(r.bold_url, 'https://checkout.bold.co/falso');
  a.equal(r.token_cancelar, 'token-1');
  a.equal(d.bold.creados[0].reference, x.codigo);
  a.equal(d.buzon.length, 0);
});
test('el segundo cliente no puede tomar el mismo bloque VIP', () => {
  const d = falsos();
  c.manejar('crear', solicitudGrande(), d);
  a.equal(c.manejar('crear', solicitudGrande({ hora: '20:30' }), d).error, 'SIN_CUPO');
  a.equal(d.hoja.reservas.length, 1);
});
test('crear valida la solicitud y el cupo de mesas', () => {
  const d = falsos();
  a.equal(c.manejar('crear', solicitud({ correo: 'no-es-correo' }), d).error, 'CORREO');
  a.equal(c.manejar('crear', solicitud({ personas: 25 }), d).error, 'GRUPO_GRANDE');
  a.equal(c.manejar('crear', solicitud({ fecha: '2026-10-24' }), d).error, 'SIN_CUPO'); // sábado: no se reserva
  a.equal(c.manejar('crear', solicitud({ personas: 5 }), d).error, 'PERSONAS');
  // El Carmen: 2 reservas al día, separadas al menos 3 h; una tercera no entra.
  a.equal(c.manejar('crear', solicitud({ hora: '17:00' }), d).ok, true);
  a.equal(c.manejar('crear', solicitud({ hora: '19:30' }), d).error, 'SIN_CUPO');
  a.equal(c.manejar('crear', solicitud({ hora: '20:00' }), d).ok, true);
  a.equal(c.manejar('crear', solicitud({ hora: '23:30' }), d).error, 'SIN_CUPO');
  a.equal(d.hoja.reservas.length, 2);
});
test('trampa anti-bots no escribe nada', () => {
  const d = falsos();
  a.equal(c.manejar('crear', solicitudGrande({ website: 'x' }), d).ok, true);
  a.equal(d.hoja.reservas.length, 0);
  a.equal(d.bold.creados.length, 0);
});
test('Bold caído libera el cupo', () => {
  const d = falsos({ boldFalla: true });
  a.equal(c.manejar('crear', solicitudGrande(), d).error, 'BOLD');
  a.equal(d.hoja.reservas[0].estado, 'RECHAZADA');
  // Sin link de Bold nunca se consulta.
  c.manejar('estado', { codigo: d.hoja.reservas[0].codigo }, d);
  a.equal(d.bold.consultas.length, 0);
  // El bloque quedó libre para otro cliente.
  d.bold.crearLink = () => ({ id: 'LNK_OTRO', url: 'https://checkout.bold.co/otro' });
  a.equal(c.manejar('crear', solicitudGrande(), d).ok, true);
});
test('estado PAID confirma y envía la confirmación una sola vez', () => {
  const d = falsos(); const { codigo } = c.manejar('crear', solicitudGrande(), d);
  d.bold.estado = 'PAID';
  a.equal(c.manejar('estado', { codigo }, d).reserva.estado, 'CONFIRMADA');
  c.manejar('estado', { codigo }, d);
  a.equal(d.buzon.length, 1);
  a.equal(c.manejar('estado', { codigo }, d).reserva.documento, undefined);
  a.deepEqual(d.buzon.map((m) => m.para), ['laura@example.com']); // la sede lo ve en el panel, sin correo
  a.equal(d.bold.consultas.length, 1); // ya confirmada, no se vuelve a preguntar a Bold
  const pub = plano(c.manejar('estado', { codigo }, d).reserva);
  a.deepEqual(Object.keys(pub).sort(), ['adelanto', 'codigo', 'espacio', 'estado', 'fecha', 'hora', 'nombre_corto', 'personas', 'sede']);
});
test('estado: código inexistente o vacío', () => {
  const d = falsos();
  a.equal(c.manejar('estado', { codigo: 'UF-NOEXIS' }, d).error, 'NO_ENCONTRADA');
  a.equal(c.manejar('estado', {}, d).error, 'PARAMETROS');
});
test('pago tardío sin cupo queda PAGO_SIN_CUPO y avisa al admin', () => {
  const d = falsos();
  const A = c.manejar('crear', solicitudGrande(), d).codigo;
  d.ahoraMs += 16 * MIN; // A vence sin pagar
  const B = c.manejar('crear', solicitudGrande(), d).codigo; // B toma el mismo bloque
  a.ok(B);
  d.bold.estados[fila(d, A).bold_link] = 'PAID'; // A paga tarde
  a.equal(c.manejar('estado', { codigo: A }, d).reserva.estado, 'PAGO_SIN_CUPO');
  a.equal(fila(d, A).devolucion, 'PENDIENTE');
  a.equal(fila(d, B).estado, 'PENDIENTE_PAGO');
  a.equal(d.buzon.length, 1);
  a.equal(d.buzon[0].para, CORREOS.correo_admin); a.match(d.buzon[0].asunto, /Pago sin cupo/);
  c.manejar('estado', { codigo: A }, d);
  a.equal(d.buzon.length, 1);
});
test('pago tardío con cupo libre confirma, incluso ya EXPIRADA (últimas 24 h)', () => {
  const d = falsos();
  const A = c.manejar('crear', solicitudGrande(), d).codigo;
  d.ahoraMs += 16 * MIN;
  c.revisarPendientesCon(d);
  a.equal(fila(d, A).estado, 'EXPIRADA');
  d.bold.estado = 'PAID';
  a.equal(c.manejar('estado', { codigo: A }, d).reserva.estado, 'CONFIRMADA');
  a.equal(d.buzon.length, 1);
});
test('pago tardío a menos de 2 h de la hora, con el espacio libre, confirma', () => {
  // Jueves 22-oct 17:50 en Bogotá: reserva a las 20:00 (2 h 10 min antes), paga a las 18:06 ya vencida.
  const d = falsos({ ahora: Date.parse('2026-10-22T22:50:00Z') });
  const A = c.manejar('crear', solicitud(), d).codigo;
  a.ok(A);
  d.ahoraMs += 16 * MIN;
  c.revisarPendientesCon(d);
  a.equal(fila(d, A).estado, 'EXPIRADA');
  d.bold.estado = 'PAID';
  a.equal(c.manejar('estado', { codigo: A }, d).reserva.estado, 'CONFIRMADA');
  a.equal(fila(d, A).devolucion, 'NO');
  a.equal(d.buzon.length, 1);
});
test('pago tardío de una hora que ya pasó queda PAGO_SIN_CUPO', () => {
  const d = falsos({ ahora: Date.parse('2026-10-22T22:50:00Z') });
  const A = c.manejar('crear', solicitud(), d).codigo;
  d.ahoraMs += 16 * MIN;
  c.revisarPendientesCon(d);
  d.ahoraMs = Date.parse('2026-10-23T01:30:00Z'); // 20:30, la reserva era a las 20:00
  d.bold.estado = 'PAID';
  a.equal(c.manejar('estado', { codigo: A }, d).reserva.estado, 'PAGO_SIN_CUPO');
});
test('EXPIRADA de hace más de 24 h no se consulta en Bold', () => {
  const d = falsos();
  const A = c.manejar('crear', solicitudGrande(), d).codigo;
  d.ahoraMs += 16 * MIN;
  c.revisarPendientesCon(d);
  const antes = d.bold.consultas.length;
  d.ahoraMs = ahora + 25 * 3600000;
  d.bold.estado = 'PAID';
  a.equal(c.manejar('estado', { codigo: A }, d).reserva.estado, 'EXPIRADA');
  c.revisarPendientesCon(d);
  a.equal(d.bold.consultas.length, antes);
});
test('cancelación con token', () => {
  const d = falsos();
  const codigo = confirmada(d);
  const t = fila(d, codigo).token_cancelar;
  a.equal(d.buzon.length, 1);
  const v = c.manejar('cancelacion', { t }, d);
  a.equal(v.ok, true); a.equal(v.puede, true); a.equal(v.conDevolucion, true);
  a.equal(v.reserva.codigo, codigo); a.equal(v.reserva.documento, undefined); a.equal(v.reserva.token_cancelar, undefined);
  const x = c.manejar('cancelar', { t }, d);
  a.equal(x.ok, true); a.equal(x.conDevolucion, true);
  a.equal(fila(d, codigo).estado, 'CANCELADA_CON_DEVOLUCION');
  a.equal(fila(d, codigo).devolucion, 'PENDIENTE');
  const nuevos = d.buzon.slice(1);
  a.deepEqual(nuevos.map((m) => m.para), ['laura@example.com', CORREOS.correo_admin]);
  a.match(nuevos[1].asunto, /Devolución pendiente/);
  // Ya cancelada: no se puede de nuevo y no hay más correos.
  a.equal(c.manejar('cancelar', { t }, d).error, 'NO_CANCELABLE');
  a.equal(c.manejar('cancelacion', { t }, d).puede, false);
  a.equal(d.buzon.length, 3);
  a.equal(c.manejar('cancelar', { t: 'otro' }, d).error, 'NO_ENCONTRADA');
  a.equal(c.manejar('cancelar', {}, d).error, 'PARAMETROS');
});
test('cancelación con menos de 24 h: sin devolución ni correo al admin', () => {
  const d = falsos();
  const codigo = confirmada(d);
  d.ahoraMs = Date.parse('2026-10-22T12:00:00Z');
  const x = c.manejar('cancelar', { t: fila(d, codigo).token_cancelar }, d);
  a.equal(x.conDevolucion, false);
  a.equal(fila(d, codigo).estado, 'CANCELADA_SIN_DEVOLUCION');
  a.deepEqual(d.buzon.slice(1).map((m) => m.para), ['laura@example.com']);
});
test('panel: clave, aislamiento por sede y marcas', () => {
  const d = falsos(); // props: CLAVE_ELCARMEN='c1', CLAVE_HIPODROMO='h1'
  a.equal(c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'mal' }, d).error, 'CLAVE');
  const { token } = c.manejar('panel_entrar', { sede: 'HIPODROMO', clave: 'h1' }, d);
  const codigoElCarmen = confirmada(d);
  a.equal(c.manejar('panel_listar', { token, desde: '2026-10-22', dias: 1 }, d).reservas.length, 0);
  a.equal(c.manejar('panel_marcar', { token, codigo: codigoElCarmen, marca: 'LLEGO' }, d).error, 'PERMISO');

  const tc = c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'c1' }, d).token;
  c.manejar('crear', solicitud({ hora: '23:00' }), d); // pendiente: no sale en el panel
  const l = c.manejar('panel_listar', { token: tc, desde: '2026-10-22', dias: '1' }, d);
  a.equal(l.ok, true); a.equal(l.sede, 'ELCARMEN'); a.equal(l.reservas.length, 1);
  const r = l.reservas[0];
  a.equal(r.codigo, codigoElCarmen); a.equal(r.documento, '1234567890'); a.equal(r.celular, '3001234567');
  a.equal(r.token_cancelar, undefined); a.equal(r.bold_link, undefined); a.equal(r.bold_url, undefined);
  a.equal(c.manejar('panel_listar', { token: tc, desde: '2026-10-21', dias: 1 }, d).reservas.length, 0);
  a.equal(c.manejar('panel_listar', { token: tc, desde: '2026-10-21', dias: 2 }, d).reservas.length, 1);

  const m = c.manejar('panel_marcar', { token: tc, codigo: codigoElCarmen, marca: 'LLEGO' }, d);
  a.equal(m.ok, true); a.equal(m.reserva.estado, 'LLEGO'); a.equal(m.reserva.token_cancelar, undefined);
  a.equal(fila(d, codigoElCarmen).estado, 'LLEGO');
  a.equal(c.manejar('panel_marcar', { token: tc, codigo: codigoElCarmen, marca: 'BAILAR' }, d).error, 'MARCA');
  const pendiente = d.hoja.reservas.find((x) => x.estado === 'PENDIENTE_PAGO').codigo;
  a.equal(c.manejar('panel_marcar', { token: tc, codigo: pendiente, marca: 'LLEGO' }, d).error, 'NO_MARCABLE');
  a.equal(c.manejar('panel_marcar', { token: tc, codigo: 'UF-NOEXIS', marca: 'LLEGO' }, d).error, 'NO_ENCONTRADA');
});
test('panel: token inválido o vencido, parámetros y configuración vacía', () => {
  const d = falsos();
  const { token } = c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'c1' }, d);
  a.equal(c.manejar('panel_listar', { token: 'basura', desde: '2026-10-22' }, d).error, 'TOKEN');
  a.equal(c.manejar('panel_listar', { token: token.replace('ELCARMEN', 'HIPODROMO'), desde: '2026-10-22' }, d).error, 'TOKEN');
  a.equal(c.manejar('panel_listar', { token, desde: '2026-10-22', dias: 15 }, d).error, 'PARAMETROS');
  a.equal(c.manejar('panel_listar', { token, desde: '2026-10-22', dias: 0 }, d).error, 'PARAMETROS');
  a.equal(c.manejar('panel_listar', { token, desde: '22-10-2026' }, d).error, 'PARAMETROS');
  a.equal(c.manejar('panel_listar', { token, desde: '2026-10-22' }, d).ok, true); // dias por defecto 1
  a.equal(c.manejar('panel_entrar', { sede: 'OTRA', clave: 'c1' }, d).error, 'PARAMETROS');
  d.ahoraMs += 15 * 3600000;
  a.equal(c.manejar('panel_listar', { token, desde: '2026-10-22' }, d).error, 'TOKEN');

  // Secreto vacío: cualquiera podría firmar tokens; clave vacía: entraría quien mande clave vacía.
  const s = falsos({ props: { SECRETO_PANEL: '' } });
  a.equal(c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'c1' }, s).error, 'CONFIGURACION');
  a.equal(c.manejar('panel_listar', { token: 'x', desde: '2026-10-22' }, s).error, 'CONFIGURACION');
  const k = falsos({ props: { CLAVE_HIPODROMO: '' } });
  a.equal(c.manejar('panel_entrar', { sede: 'HIPODROMO', clave: '' }, k).error, 'CONFIGURACION');
  const th = c.crearTokenPanel('HIPODROMO', k.ahoraMs, k.hmacHex);
  a.equal(c.manejar('panel_listar', { token: th, desde: '2026-10-22' }, k).error, 'CONFIGURACION');
});
test('días y horas públicas con validación de parámetros', () => {
  const d = falsos();
  const x = c.manejar('dias', { sede: 'ELCARMEN', personas: '12', mes: '2026-10' }, d);
  a.equal(x.ok, true); a.equal(x.dias.length, 31);
  a.equal(x.dias.find((z) => z.fecha === '2026-10-22').disponible, true);
  a.equal(x.dias.find((z) => z.fecha === '2026-10-24').disponible, false);
  a.equal(x.espacio, 'MESA'); a.equal(x.reglas.adelanto, 50000);
  const h = c.manejar('horas', { sede: 'ELCARMEN', personas: '12', fecha: '2026-10-22' }, d);
  // Los días disponibles traen las mismas horas que la consulta de horas; los demás, ninguna.
  a.equal(JSON.stringify(x.dias.find((z) => z.fecha === '2026-10-22').horas), JSON.stringify(h.horas));
  a.equal(JSON.stringify(x.dias.find((z) => z.fecha === '2026-10-24').horas), '[]');
  a.equal(h.ok, true); a.equal(h.espacio, 'MESA');
  a.equal(h.horas.find((z) => z.hora === '20:00').libre, true);
  c.manejar('crear', solicitudGrande(), d);
  const h2 = c.manejar('horas', { sede: 'ELCARMEN', personas: '12', fecha: '2026-10-22' }, d);
  a.equal(h2.horas.find((z) => z.hora === '20:00').libre, false);
  a.equal(c.manejar('horas', { sede: 'HIPODROMO', personas: '8', fecha: '2026-10-22' }, d).espacio, 'PISO1');
  a.equal(c.manejar('horas', { sede: 'HIPODROMO', personas: '25', fecha: '2026-10-22' }, d).espacio, 'PISO2');

  const g = c.manejar('horas', { sede: 'ELCARMEN', personas: '25', fecha: '2026-10-22' }, d);
  a.equal(g.ok, false); a.equal(g.error, 'GRUPO_GRANDE'); a.equal(g.espacio, null);
  a.equal(c.manejar('horas', { sede: 'ELCARMEN', personas: '1', fecha: '2026-10-22' }, d).error, 'PERSONAS');
  a.equal(c.manejar('dias', { sede: 'ELCARMEN', personas: '25', mes: '2026-10' }, d).error, 'GRUPO_GRANDE');

  a.equal(c.manejar('dias', { sede: 'ELCARMEN', personas: '8', mes: '2026-1' }, d).error, 'PARAMETROS');
  a.equal(c.manejar('dias', { sede: 'OTRA', personas: '8', mes: '2026-10' }, d).error, 'PARAMETROS');
  a.equal(c.manejar('horas', { sede: 'ELCARMEN', personas: '8', fecha: '2026-10-2' }, d).error, 'PARAMETROS');
  a.equal(c.manejar('horas', { sede: 'ELCARMEN', personas: 'cuatro', fecha: '2026-10-22' }, d).error, 'PARAMETROS');
  a.equal(c.manejar('horas', { sede: 'ELCARMEN', personas: '4.5', fecha: '2026-10-22' }, d).error, 'PARAMETROS');
});
test('acción desconocida y errores internos', () => {
  const d = falsos();
  a.equal(c.manejar('borrar_todo', {}, d).error, 'ACCION');
  a.equal(c.manejar('__proto__', {}, d).error, 'ACCION');
  a.equal(c.manejar('constructor', {}, d).error, 'ACCION');
  d.hoja.leerConfig = () => { throw new Error('Sheets no responde'); };
  const n = registrados.length;
  a.deepEqual(plano(c.manejar('horas', { sede: 'ELCARMEN', personas: '8', fecha: '2026-10-22' }, d)), { ok: false, error: 'INTERNO' });
  a.ok(registrados.length > n);
});
test('Bold sin respuesta al consultar: la reserva sigue igual', () => {
  const d = falsos();
  const { codigo } = c.manejar('crear', solicitudGrande(), d);
  d.bold.consultarLink = () => { throw new Error('BOLD'); };
  const x = c.manejar('estado', { codigo }, d);
  a.equal(x.ok, true); a.equal(x.reserva.estado, 'PENDIENTE_PAGO');
});
test('revisarPendientes vence lo no pagado y confirma lo pagado', () => {
  const d = falsos();
  const B = c.manejar('crear', solicitud({ hora: '20:30' }), d).codigo; // nadie la paga
  d.ahoraMs += 16 * MIN;
  const A = c.manejar('crear', solicitud(), d).codigo; // vigente y pagada
  const linkA = fila(d, A).bold_link; const linkB = fila(d, B).bold_link;
  d.bold.estados[linkA] = 'PAID';
  c.revisarPendientesCon(d);
  a.equal(fila(d, A).estado, 'CONFIRMADA');
  a.equal(fila(d, B).estado, 'EXPIRADA');
  // La vencida se consulta dos veces antes de liberar el cupo.
  a.equal(d.bold.consultas.filter((x) => x === linkB).length, 2);
  a.equal(d.buzon.length, 1);
  a.ok(d.buzon.some((m) => m.para === 'laura@example.com' && /confirmada/.test(m.asunto)));
  // Segunda pasada: nada nuevo, y la confirmada no se vuelve a consultar.
  const consultasA = d.bold.consultas.filter((x) => x === linkA).length;
  c.revisarPendientesCon(d);
  a.equal(d.buzon.length, 1);
  a.equal(d.bold.consultas.filter((x) => x === linkA).length, consultasA);
});
test('revisarPendientes: una reserva que falla no detiene las demás', () => {
  const d = falsos();
  const A = c.manejar('crear', solicitud(), d).codigo;
  const B = c.manejar('crear', solicitud({ hora: '23:00' }), d).codigo;
  const linkA = fila(d, A).bold_link;
  d.bold.estados[fila(d, B).bold_link] = 'PAID';
  const original = d.bold.consultarLink;
  d.bold.consultarLink = (id) => { if (id === linkA) throw new Error('BOLD'); return original(id); };
  c.revisarPendientesCon(d);
  a.equal(fila(d, A).estado, 'PENDIENTE_PAGO');
  a.equal(fila(d, B).estado, 'CONFIRMADA');
});
test('doGet/doPost: JSON, método correcto y fallos', () => {
  c.ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (texto) => ({ texto, setMimeType(m) { this.mime = m; return this; } })
  };
  const leer = (s) => { a.equal(s.mime, 'application/json'); return JSON.parse(s.texto); };
  a.deepEqual(leer(c.doGet({ parameter: { accion: 'crear' } })), { ok: false, error: 'ACCION' });
  a.deepEqual(leer(c.doPost({ postData: { contents: JSON.stringify({ accion: 'dias' }) } })), { ok: false, error: 'ACCION' });
  a.deepEqual(leer(c.doPost({ postData: { contents: '{roto' } })), { ok: false, error: 'PARAMETROS' });
  a.deepEqual(leer(c.doPost({ postData: { contents: 'null' } })), { ok: false, error: 'PARAMETROS' });
  // Sin servicios de Google (PropertiesService no existe en Node) armar deps falla: INTERNO.
  a.deepEqual(leer(c.doGet({ parameter: { accion: 'dias', sede: 'ELCARMEN', personas: '8', mes: '2026-10' } })), { ok: false, error: 'INTERNO' });
});
test('hmac en hex minúsculas y disparador instalado una sola vez', () => {
  a.equal(c.bytesAHex([0, 15, -1, 127, -128, 10]), '000fff7f800a');
  const creados = [];
  const disparadores = [];
  c.ScriptApp = {
    getProjectTriggers: () => disparadores,
    newTrigger: (fn) => ({ timeBased: () => ({ everyMinutes: (n) => ({ create: () => {
      creados.push([fn, n]); disparadores.push({ getHandlerFunction: () => fn });
    } }) }) })
  };
  c.instalarDisparador(); c.instalarDisparador();
  a.deepEqual(creados, [['revisarPendientes', 5]]);
});

// ---- Revisión final ----

test('crear con codigo_previo devuelve el mismo apartado vigente sin crear otro', () => {
  const d = falsos();
  const x = c.manejar('crear', solicitudGrande(), d);
  const y = c.manejar('crear', solicitudGrande({ codigo_previo: x.codigo, correo: ' LAURA@example.com ' }), d);
  a.deepEqual(plano(y), { ok: true, codigo: x.codigo, url_pago: x.url_pago });
  a.equal(d.hoja.reservas.length, 1);
  a.equal(d.bold.creados.length, 1);
});
test('codigo_previo que no coincide sigue el flujo normal', () => {
  const d = falsos();
  const x = c.manejar('crear', solicitudGrande(), d);
  // Otro correo: no es su apartado, la hora sigue ocupada.
  a.equal(c.manejar('crear', solicitudGrande({ codigo_previo: x.codigo, correo: 'otra@example.com' }), d).error, 'SIN_CUPO');
  // Otra hora (3 h después): se crea una reserva nueva.
  const m = c.manejar('crear', solicitud({ codigo_previo: x.codigo, hora: '23:00' }), d);
  a.equal(m.ok, true); a.notEqual(m.codigo, x.codigo);
  a.equal(d.hoja.reservas.length, 2);
  // Apartado vencido: no se reutiliza; el bloque quedó libre y se crea otro.
  d.ahoraMs += 16 * MIN;
  const v = c.manejar('crear', solicitudGrande({ codigo_previo: x.codigo }), d);
  a.equal(v.ok, true); a.notEqual(v.codigo, x.codigo);
  // Código inexistente: flujo normal.
  a.equal(c.manejar('crear', solicitud({ codigo_previo: 'UF-NOEXIS', hora: '17:00' }), d).ok, true);
});
test('codigo_previo sin link de Bold guardado no se reutiliza', () => {
  const d = falsos();
  const x = c.manejar('crear', solicitud(), d);
  fila(d, x.codigo).bold_url = '';
  // No se le devuelve el mismo apartado: se intenta crear otro, que choca con el primero.
  const y = c.manejar('crear', solicitud({ codigo_previo: x.codigo }), d);
  a.notEqual(y.codigo, x.codigo); a.equal(y.error, 'SIN_CUPO');
});
test('panel: 5 claves malas en 10 minutos bloquean la sede; un acierto reinicia', () => {
  const d = falsos();
  for (let i = 0; i < 4; i++) a.equal(c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'mal' }, d).error, 'CLAVE');
  // Un acierto antes del quinto fallo reinicia el contador.
  a.equal(c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'c1' }, d).ok, true);
  for (let i = 0; i < 5; i++) a.equal(c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'mal' }, d).error, 'CLAVE');
  // Bloqueada: ni la clave buena entra, y no se compara.
  a.equal(c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'c1' }, d).error, 'BLOQUEADO');
  // La otra sede no se afecta.
  a.equal(c.manejar('panel_entrar', { sede: 'HIPODROMO', clave: 'h1' }, d).ok, true);
  // Pasados 10 minutos vuelve a dejar intentar.
  d.ahoraMs += 10 * MIN + 1000;
  a.equal(c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'c1' }, d).ok, true);
});
test('panel: fallos espaciados más de 10 minutos no bloquean', () => {
  const d = falsos();
  for (let i = 0; i < 4; i++) c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'mal' }, d);
  d.ahoraMs += 11 * MIN;
  for (let i = 0; i < 4; i++) a.equal(c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'mal' }, d).error, 'CLAVE');
  a.equal(c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'c1' }, d).ok, true);
});
test('horas, estado, cancelacion y panel_listar incluyen las reglas de Config', () => {
  const d = falsos({ config: [['adelanto', '60000'], ['cancelacion_horas', '48'], ['duracion_min', '90']] });
  const reglas = { adelanto: 60000, cancelacion_horas: 48, duracion_min: 90, grupo_min: 6, max_elcarmen: 20,
    piso1_max_hipodromo: 16, piso2_max_hipodromo: 30 };
  a.deepEqual(plano(c.manejar('horas', { sede: 'ELCARMEN', personas: '8', fecha: '2026-10-22' }, d).reglas), reglas);
  const codigo = confirmada(d);
  a.deepEqual(plano(c.manejar('estado', { codigo }, d).reglas), reglas);
  a.deepEqual(plano(c.manejar('cancelacion', { t: fila(d, codigo).token_cancelar }, d).reglas), reglas);
  const tc = c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'c1' }, d).token;
  a.deepEqual(plano(c.manejar('panel_listar', { token: tc, desde: '2026-10-22' }, d).reglas), reglas);
});
test('los correos usan el adelanto y las horas de Config', () => {
  const d = falsos({ config: [['adelanto', '60000'], ['cancelacion_horas', '48']] });
  const codigo = confirmada(d);
  const conf = d.buzon.find((m) => m.para === 'laura@example.com');
  a.ok(conf.html.includes('El adelanto de $60.000 se descuenta de tu cuenta. Si cancelas con 48 horas o más'));
  c.manejar('cancelar', { t: fila(d, codigo).token_cancelar }, d);
  const admin = d.buzon.find((m) => m.para === CORREOS.correo_admin);
  a.ok(admin.html.includes('$60.000')); a.ok(!admin.html.includes('$50.000'));
});
// Caso real del 22/10/2026: la prueba pagó $1.000 y después el adelanto volvió a $50.000.
// La cajera descuenta en fu.do lo que dice el panel: tiene que ser lo pagado.
test('si el adelanto cambia en Config, la reserva ya pagada conserva el suyo', () => {
  const d = falsos({ config: [['adelanto', '1000']] });
  const codigo = confirmada(d);
  a.equal(d.bold.creados[0].amount.total_amount, 1000);
  a.equal(fila(d, codigo).adelanto, 1000);
  const leerConfig = d.hoja.leerConfig;
  d.hoja.leerConfig = () => Object.assign(leerConfig(), { adelanto: 50000 });

  const tc = c.manejar('panel_entrar', { sede: 'ELCARMEN', clave: 'c1' }, d).token;
  a.equal(c.manejar('panel_listar', { token: tc, desde: '2026-10-22' }, d).reservas[0].adelanto, 1000);
  a.equal(c.manejar('panel_marcar', { token: tc, codigo, marca: 'DESCUENTO' }, d).reserva.adelanto, 1000);
  const t = fila(d, codigo).token_cancelar;
  a.equal(c.manejar('cancelacion', { t }, d).reserva.adelanto, 1000);
  c.manejar('cancelar', { t }, d);
  const admin = d.buzon.find((m) => m.para === CORREOS.correo_admin);
  a.ok(admin.html.includes('$1.000')); a.ok(!admin.html.includes('$50.000'));
  // Una reserva nueva sí cobra el valor nuevo.
  c.manejar('crear', solicitud({ hora: '21:00' }), d);
  a.equal(d.bold.creados[1].amount.total_amount, 50000);
});
test('Bold EXPIRED o CANCELLED deja la reserva cerrada y no se vuelve a consultar', () => {
  const d = falsos();
  const A = c.manejar('crear', solicitud(), d).codigo;
  d.bold.estados[fila(d, A).bold_link] = 'EXPIRED';
  a.equal(c.manejar('estado', { codigo: A }, d).reserva.estado, 'EXPIRADA');
  a.ok(c.boldCerrado(fila(d, A)));
  const n = d.bold.consultas.length;
  c.manejar('estado', { codigo: A }, d);
  c.revisarPendientesCon(d);
  a.equal(d.bold.consultas.length, n);

  // Vencida por el reloj (Bold aún ACTIVE): se sigue preguntando hasta que Bold diga CANCELLED.
  const B = c.manejar('crear', solicitud({ hora: '21:00' }), d).codigo;
  d.ahoraMs += 16 * MIN;
  c.revisarPendientesCon(d);
  a.equal(fila(d, B).estado, 'EXPIRADA'); a.equal(c.boldCerrado(fila(d, B)), false);
  d.bold.estados[fila(d, B).bold_link] = 'CANCELLED';
  c.manejar('estado', { codigo: B }, d);
  a.ok(c.boldCerrado(fila(d, B)));
  const m = d.bold.consultas.length;
  c.revisarPendientesCon(d);
  a.equal(d.bold.consultas.length, m);
  a.equal(d.buzon.length, 0);
});
test('Hipódromo: una reserva por piso al día, el piso sale del tamaño y el correo lo dice', () => {
  const d = falsos();
  const hip = (sobre) => solicitud(Object.assign({ sede: 'HIPODROMO' }, sobre));
  const p1 = c.manejar('crear', hip({ personas: 10, hora: '18:00' }), d);
  a.equal(p1.ok, true); a.equal(fila(d, p1.codigo).espacio, 'PISO1');
  a.equal(c.manejar('crear', hip({ personas: 16, hora: '22:00' }), d).error, 'SIN_CUPO'); // piso 1 ya tomado
  const p2 = c.manejar('crear', hip({ personas: 25, hora: '18:00' }), d);
  a.equal(p2.ok, true); a.equal(fila(d, p2.codigo).espacio, 'PISO2');
  a.equal(c.manejar('crear', hip({ personas: 31 }), d).error, 'GRUPO_GRANDE');
  d.bold.estados[fila(d, p1.codigo).bold_link] = 'PAID';
  c.manejar('estado', { codigo: p1.codigo }, d);
  const conf = d.buzon.find((m) => /confirmada/.test(m.asunto));
  a.ok(conf.html.includes('Primer piso')); a.ok(conf.html.includes('por 2 horas'));
});
