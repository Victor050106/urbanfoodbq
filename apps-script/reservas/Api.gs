// API web de reservas. manejar() solo usa lo que recibe en deps (hoja, Bold, correo, reloj, bloqueo...),
// así se prueba en Node; doGet/doPost únicamente arman las dependencias reales de Apps Script.

var ACCIONES_GET = ['dias', 'horas', 'estado', 'cancelacion'];
var ACCIONES_POST = ['crear', 'cancelar', 'panel_entrar', 'panel_listar', 'panel_marcar'];
var ERRORES_CICLO = ['NO_MARCABLE', 'MARCA', 'NO_CANCELABLE'];
var ESTADOS_PANEL = ['CONFIRMADA', 'LLEGO', 'NO_LLEGO', 'CANCELADA_CON_DEVOLUCION', 'CANCELADA_SIN_DEVOLUCION'];
var CAMPOS_SECRETOS = ['token_cancelar', 'bold_link', 'bold_url'];
// Un pago puede llegar a Bold después de que marcamos EXPIRADA/RECHAZADA: se sigue preguntando un día.
var VENTANA_PAGO_TARDIO_MS = 24 * 3600000;
var MAX_DIAS_PANEL = 14;
// Clave del panel: tras 5 fallos en 10 minutos la sede queda bloqueada hasta que pase la ventana.
var MAX_FALLOS_PANEL = 5;
var VENTANA_FALLOS_MS = 10 * 60000;

function fallo(error) { return { ok: false, error: error }; }

// Lo que las páginas muestran al cliente y a la cajera; sale de Config, igual que lo que cobra Bold.
function reglasPublicas(cfg) {
  return { adelanto: cfg.adelanto, cancelacion_horas: cfg.cancelacion_horas, vip_min: cfg.vip_min };
}

function esSede(s) { return s === 'ELCARMEN' || s === 'HIPODROMO'; }

function esFechaTexto(f) {
  return /^\d{4}-\d{2}-\d{2}$/.test(f) && normalizarFecha(new Date(f + 'T12:00:00Z')) === f;
}

// Entero desde número o texto ("12"); NaN si no lo es.
function leerEntero(v) {
  var t = textoLimpio(v);
  var n = typeof v === 'number' ? v : (t === '' ? NaN : Number(t));
  return isFinite(n) && n === Math.floor(n) ? n : NaN;
}

function errorDeGrupo(personas, cfg) {
  if (personas < cfg.grupo_min) return 'PERSONAS';
  if (personas > cfg.grupo_max) return 'GRUPO_GRANDE';
  return '';
}

function sumarDias(fecha, n) {
  return aFechaTexto(new Date(Date.parse(fecha + 'T00:00:00Z') + n * 86400000));
}

// Lo que ve la cajera: sin enlaces ni token, y con el adelanto que pagó el cliente (el que descuenta en fu.do).
function paraPanel(reserva, cfg) {
  var r = copiarReserva(reserva);
  CAMPOS_SECRETOS.forEach(function (k) { delete r[k]; });
  r.adelanto = adelantoDe(reserva, cfg);
  return r;
}

// Un correo que falla (cuota de MailApp) no debe deshacer ni ocultar un cambio de estado ya guardado.
// La sede no recibe correos: ve sus reservas en el panel. Una cuenta de Gmail gratis envía a unos
// 100 destinatarios al día, y avisar también a la sede gastaba la mitad de ese cupo.
function avisar(deps, para, mensaje) {
  if (!para) return;
  try { deps.enviar(para, mensaje); } catch (e) { console.error('Correo no enviado a ' + para + ': ' + e); }
}

function avisarEventoPago(evento, r, deps, cfg) {
  if (evento === 'CONFIRMADA') {
    avisar(deps, r.correo, correoConfirmacion(r, cfg));
  } else if (evento === 'PAGO_SIN_CUPO') {
    avisar(deps, cfg.correo_admin, correoAdminPagoSinCupo(r));
  }
}

function debeConsultarBold(r, ahoraMs) {
  if (!r.bold_link) return false;
  if (r.estado === 'PENDIENTE_PAGO') return true;
  if (r.estado !== 'EXPIRADA' && r.estado !== 'RECHAZADA') return false;
  if (boldCerrado(r)) return false;
  var creada = Date.parse(r.creada);
  return !isNaN(creada) && ahoraMs - creada <= VENTANA_PAGO_TARDIO_MS;
}

// ¿Su propia hora seguiría libre si ella no existiera? Es el cupo que debe "volver a ganar" un pago tardío.
// Sin anticipación mínima: esa regla es para reservar, no es cupo; solo se devuelve si otro tomó el espacio.
// Una hora ya pasada sigue sin estar libre.
function cupoPropioLibre(r, deps, cfg) {
  var otras = deps.hoja.leerReservas({ sede: r.sede, desde: r.fecha, hasta: r.fecha })
    .filter(function (x) { return x.codigo !== r.codigo; });
  var sinAnticipacion = Object.assign({}, cfg, { min_horas: 0 });
  return horasDisponibles(r.sede, r.fecha, r.personas, otras, deps.ahora(), sinAnticipacion, deps.hoja.leerBloqueos())
    .some(function (h) { return h.hora === r.hora && h.libre; });
}

// Pregunta a Bold y aplica el estado. La llamada de red va fuera del bloqueo; dentro se relee la fila,
// así dos peticiones simultáneas no confirman ni envían correos dos veces.
function refrescarConBold(reserva, deps, cfg) {
  if (!debeConsultarBold(reserva, deps.ahora())) return reserva;
  var estadoBold;
  try {
    estadoBold = deps.bold.consultarLink(reserva.bold_link);
  } catch (e) {
    console.error('Bold no respondió para ' + reserva.codigo + ': ' + e);
    return reserva;
  }
  var x = deps.bloqueo(function () {
    var actual = deps.hoja.buscarPorCodigo(reserva.codigo);
    if (!actual || !debeConsultarBold(actual, deps.ahora())) return { reserva: actual || reserva, evento: null };
    var cupo = estadoBold === 'PAID' && cupoPropioLibre(actual, deps, cfg);
    var res = aplicarEstadoBold(actual, estadoBold, deps.ahora(), cupo);
    var cerrada = res.reserva.estado === 'EXPIRADA' || res.reserva.estado === 'RECHAZADA';
    if (cerrada && (estadoBold === 'EXPIRED' || estadoBold === 'CANCELLED') && !boldCerrado(res.reserva)) {
      res = { reserva: marcarBoldCerrado(res.reserva), cambio: true, evento: res.evento };
    }
    if (res.cambio) deps.hoja.actualizar(res.reserva);
    return res;
  });
  if (x.evento) avisarEventoPago(x.evento, x.reserva, deps, cfg);
  return x.reserva;
}

function codigoNuevo(deps) {
  for (var i = 0; i < 10; i++) {
    var codigo = generarCodigo(deps.aleatorio);
    if (!deps.hoja.buscarPorCodigo(codigo)) return codigo;
  }
  throw new Error('CODIGO');
}

function accionDias(p, deps) {
  var sede = textoLimpio(p.sede), mes = textoLimpio(p.mes), personas = leerEntero(p.personas);
  if (!esSede(sede) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || isNaN(personas)) return fallo('PARAMETROS');
  var cfg = deps.hoja.leerConfig();
  var grupo = errorDeGrupo(personas, cfg);
  if (grupo) return { ok: false, error: grupo, dias: [] };
  var reservas = deps.hoja.leerReservas({ sede: sede, desde: mes + '-01', hasta: mes + '-31' });
  return {
    ok: true,
    espacio: espacioPara(sede, personas, cfg),
    dias: diasDelMes(sede, mes, personas, reservas, deps.ahora(), cfg, deps.hoja.leerBloqueos()),
    reglas: reglasPublicas(cfg)
  };
}

function accionHoras(p, deps) {
  var sede = textoLimpio(p.sede), fecha = textoLimpio(p.fecha), personas = leerEntero(p.personas);
  if (!esSede(sede) || !esFechaTexto(fecha) || isNaN(personas)) return fallo('PARAMETROS');
  var cfg = deps.hoja.leerConfig();
  // Fuera de rango la página muestra la tarjeta de WhatsApp.
  var grupo = errorDeGrupo(personas, cfg);
  if (grupo) return { ok: false, error: grupo, espacio: null, horas: [] };
  var reservas = deps.hoja.leerReservas({ sede: sede, desde: fecha, hasta: fecha });
  return {
    ok: true,
    espacio: espacioPara(sede, personas, cfg),
    horas: horasDisponibles(sede, fecha, personas, reservas, deps.ahora(), cfg, deps.hoja.leerBloqueos()),
    reglas: reglasPublicas(cfg)
  };
}

function accionEstado(p, deps) {
  var codigo = textoLimpio(p.codigo);
  if (!codigo) return fallo('PARAMETROS');
  var r = deps.hoja.buscarPorCodigo(codigo);
  if (!r) return fallo('NO_ENCONTRADA');
  var cfg = deps.hoja.leerConfig();
  r = refrescarConBold(r, deps, cfg);
  return { ok: true, reserva: resumenPublico(r, cfg), reglas: reglasPublicas(cfg) };
}

function accionCancelacion(p, deps) {
  var t = textoLimpio(p.t);
  if (!t) return fallo('PARAMETROS');
  var r = deps.hoja.buscarPorToken(t);
  if (!r) return fallo('NO_ENCONTRADA');
  var cfg = deps.hoja.leerConfig();
  var ev = evaluarCancelacion(r, deps.ahora(), cfg);
  return { ok: true, reserva: resumenPublico(r, cfg), puede: ev.puede, conDevolucion: ev.conDevolucion, reglas: reglasPublicas(cfg) };
}

// Segundo "Pagar" (volvió de Bold con Atrás, o se perdió la respuesta): si su propio apartado sigue vigente
// con los mismos datos, se le devuelve el mismo link en vez de crear otro que chocaría con él.
function apartadoReutilizable(r, l, ahoraMs) {
  if (!r || r.estado !== 'PENDIENTE_PAGO' || !r.bold_url) return false;
  var vence = Date.parse(r.vence);
  if (isNaN(vence) || vence <= ahoraMs) return false;
  return r.correo === l.correo && r.sede === l.sede && r.fecha === l.fecha && r.hora === l.hora &&
    Number(r.personas) === l.personas;
}

function accionCrear(p, deps) {
  // Campo trampa: un bot lo llena; se le responde como si todo saliera bien para que no insista.
  if (textoLimpio(p.website) !== '') return { ok: true, codigo: '', url_pago: '' };
  var cfg = deps.hoja.leerConfig();
  var v = validarSolicitud(p, cfg);
  if (!v.ok) return v;
  var l = v.limpio;
  var previo = textoLimpio(p.codigo_previo);
  if (previo) {
    var anterior = deps.hoja.buscarPorCodigo(previo);
    if (apartadoReutilizable(anterior, l, deps.ahora())) return { ok: true, codigo: anterior.codigo, url_pago: anterior.bold_url };
  }
  var creada = deps.bloqueo(function () {
    // El cupo se recalcula con el bloqueo tomado: dos clientes por el mismo bloque no pasan ambos.
    var reservas = deps.hoja.leerReservas({ sede: l.sede, desde: l.fecha, hasta: l.fecha });
    var libre = horasDisponibles(l.sede, l.fecha, l.personas, reservas, deps.ahora(), cfg, deps.hoja.leerBloqueos())
      .some(function (h) { return h.hora === l.hora && h.libre; });
    if (!libre) return null;
    var r = nuevaReserva(l, l.espacio, deps.ahora(), cfg, { codigo: codigoNuevo(deps), token: deps.uuid() });
    deps.hoja.insertar(r);
    return r;
  });
  if (!creada) return fallo('SIN_CUPO');
  var r = copiarReserva(creada);
  var link;
  try {
    link = deps.bold.crearLink(armarLink(r, cfg, deps.ahora()));
  } catch (e) {
    console.error('Bold no creó el link de ' + r.codigo + ': ' + e);
    r.estado = 'RECHAZADA'; // libera el cupo de inmediato
    deps.hoja.actualizar(r);
    return fallo('BOLD');
  }
  r.bold_link = link.id;
  r.bold_url = link.url;
  deps.hoja.actualizar(r);
  return { ok: true, codigo: r.codigo, url_pago: link.url };
}

function accionCancelar(p, deps) {
  var t = textoLimpio(p.t);
  if (!t) return fallo('PARAMETROS');
  var cfg = deps.hoja.leerConfig();
  var r = deps.bloqueo(function () {
    var actual = deps.hoja.buscarPorToken(t);
    if (!actual) return null;
    var nueva = cancelar(actual, deps.ahora(), cfg); // lanza NO_CANCELABLE si ya no se puede
    deps.hoja.actualizar(nueva);
    return nueva;
  });
  if (!r) return fallo('NO_ENCONTRADA');
  var conDevolucion = r.estado === 'CANCELADA_CON_DEVOLUCION';
  avisar(deps, r.correo, correoCancelacion(r, cfg));
  if (conDevolucion) avisar(deps, cfg.correo_admin, correoAdminDevolucion(r, cfg));
  return { ok: true, conDevolucion: conDevolucion };
}

// Con el secreto vacío cualquiera firmaría tokens; con la clave vacía entraría quien mande una clave vacía.
function panelConfigurado(deps, sede) {
  return !!deps.props.get('SECRETO_PANEL') && !!deps.props.get('CLAVE_' + sede);
}

// Fallos de clave por sede en la caché: { n, desde }. Una ventana vencida cuenta como cero.
function leerFallosPanel(deps, sede) {
  var x = null;
  try { x = JSON.parse(deps.cache.get('panel_fallos_' + sede) || 'null'); } catch (e) { x = null; }
  if (!x || typeof x.n !== 'number' || typeof x.desde !== 'number' || deps.ahora() - x.desde >= VENTANA_FALLOS_MS) {
    return { n: 0, desde: deps.ahora() };
  }
  return x;
}

function accionPanelEntrar(p, deps) {
  var sede = textoLimpio(p.sede);
  if (!esSede(sede)) return fallo('PARAMETROS');
  if (!panelConfigurado(deps, sede)) return fallo('CONFIGURACION');
  var clave = String(p.clave === undefined || p.clave === null ? '' : p.clave);
  var fallos = leerFallosPanel(deps, sede);
  // Bloqueada: ni se compara la clave, así adivinar no avanza.
  if (fallos.n >= MAX_FALLOS_PANEL) return fallo('BLOQUEADO');
  if (!igualesConstante(clave, String(deps.props.get('CLAVE_' + sede)))) {
    fallos.n++;
    deps.cache.put('panel_fallos_' + sede, JSON.stringify(fallos), Math.ceil(VENTANA_FALLOS_MS / 1000));
    return fallo('CLAVE');
  }
  deps.cache.remove('panel_fallos_' + sede);
  return { ok: true, token: crearTokenPanel(sede, deps.ahora(), deps.hmacHex) };
}

// Devuelve la sede del token o un objeto de error.
function sedeDelPanel(p, deps) {
  if (!deps.props.get('SECRETO_PANEL')) return fallo('CONFIGURACION');
  var sede = verificarTokenPanel(p.token, deps.ahora(), deps.hmacHex);
  if (!sede) return fallo('TOKEN');
  if (!panelConfigurado(deps, sede)) return fallo('CONFIGURACION');
  return sede;
}

function accionPanelListar(p, deps) {
  var sede = sedeDelPanel(p, deps);
  if (typeof sede !== 'string') return sede;
  var desde = textoLimpio(p.desde);
  var dias = textoLimpio(p.dias) === '' ? 1 : leerEntero(p.dias);
  if (!esFechaTexto(desde) || isNaN(dias) || dias < 1 || dias > MAX_DIAS_PANEL) return fallo('PARAMETROS');
  var cfg = deps.hoja.leerConfig();
  var reservas = deps.hoja.leerReservas({ sede: sede, desde: desde, hasta: sumarDias(desde, dias - 1) })
    .filter(function (r) { return r.sede === sede && ESTADOS_PANEL.indexOf(r.estado) !== -1; })
    .sort(function (x, y) {
      return x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : horaAMinutos(x.hora) - horaAMinutos(y.hora);
    })
    .map(function (r) { return paraPanel(r, cfg); });
  return { ok: true, sede: sede, reservas: reservas, reglas: reglasPublicas(cfg) };
}

function accionPanelMarcar(p, deps) {
  var sede = sedeDelPanel(p, deps);
  if (typeof sede !== 'string') return sede;
  var codigo = textoLimpio(p.codigo);
  var marca = textoLimpio(p.marca);
  if (!codigo) return fallo('PARAMETROS');
  var cfg = deps.hoja.leerConfig();
  return deps.bloqueo(function () {
    var r = deps.hoja.buscarPorCodigo(codigo);
    if (!r) return fallo('NO_ENCONTRADA');
    if (r.sede !== sede) return fallo('PERMISO');
    var x = marcarPanel(r, marca, deps.ahora()); // lanza NO_MARCABLE / MARCA
    if (x.cambio) deps.hoja.actualizar(x.reserva);
    return { ok: true, reserva: paraPanel(x.reserva, cfg) };
  });
}

var MANEJADORES = {
  dias: accionDias,
  horas: accionHoras,
  estado: accionEstado,
  cancelacion: accionCancelacion,
  crear: accionCrear,
  cancelar: accionCancelar,
  panel_entrar: accionPanelEntrar,
  panel_listar: accionPanelListar,
  panel_marcar: accionPanelMarcar
};

function manejar(accion, params, deps) {
  if (!Object.prototype.hasOwnProperty.call(MANEJADORES, accion)) return fallo('ACCION');
  try {
    return MANEJADORES[accion](params || {}, deps);
  } catch (e) {
    var msg = e && e.message;
    if (ERRORES_CICLO.indexOf(msg) !== -1) return fallo(msg);
    console.error('Error en ' + accion + ': ' + (e && e.stack || e));
    return fallo('INTERNO');
  }
}

// computeHmacSha256Signature devuelve bytes con signo (-128..127).
function bytesAHex(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += ('0' + (bytes[i] & 0xff).toString(16)).slice(-2);
  return s;
}

function depsReales() {
  var props = PropertiesService.getScriptProperties();
  var leer = function (k) { return props.getProperty(k) || ''; };
  return {
    hoja: abrirHoja(),
    bold: clienteBold(leer('BOLD_LLAVE_IDENTIDAD')),
    enviar: enviarCorreo,
    ahora: function () { return Date.now(); },
    bloqueo: function (fn) {
      var lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try { return fn(); } finally { lock.releaseLock(); }
    },
    props: { get: leer },
    cache: CacheService.getScriptCache(),
    aleatorio: Math.random,
    hmacHex: function (texto) { return bytesAHex(Utilities.computeHmacSha256Signature(texto, leer('SECRETO_PANEL'))); },
    uuid: function () { return Utilities.getUuid(); }
  };
}

function responderJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Cada acción solo por su método: las que escriben nunca entran por GET.
function atender(permitidas, accion, params) {
  if (permitidas.indexOf(accion) === -1) return fallo('ACCION');
  try {
    return manejar(accion, params, depsReales());
  } catch (e) {
    console.error('Error armando dependencias para ' + accion + ': ' + (e && e.stack || e));
    return fallo('INTERNO');
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  return responderJson(atender(ACCIONES_GET, p.accion, p));
}

function doPost(e) {
  var p;
  try { p = JSON.parse(e.postData.contents); } catch (err) { return responderJson(fallo('PARAMETROS')); }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return responderJson(fallo('PARAMETROS'));
  return responderJson(atender(ACCIONES_POST, p.accion, p));
}
