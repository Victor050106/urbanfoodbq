// Acceso a la hoja de cálculo. Solo abrirHoja() toca SpreadsheetApp; el resto es puro y se prueba en Node.

var COLUMNAS_RESERVA = ['codigo', 'creada', 'sede', 'espacio', 'fecha', 'hora', 'personas', 'nombre',
  'tipo_doc', 'documento', 'correo', 'celular', 'comentario', 'estado', 'bold_link', 'bold_url', 'vence',
  'pagada_en', 'token_cancelar', 'devolucion', 'descuento_aplicado', 'marcada_en', 'notas', 'adelanto'];

// Sheets convierte "2026-10-24" en fecha, "20:00" en hora y quita ceros a las cédulas:
// estas columnas se guardan como texto "@" para que lo escrito sea lo leído.
var COLUMNAS_TEXTO = ['codigo', 'fecha', 'hora', 'documento', 'celular', 'token_cancelar', 'vence', 'creada', 'pagada_en', 'marcada_en'];

var COLUMNAS_BLOQUEO = ['fecha', 'sede', 'tipo', 'motivo'];

function textoCelda(v) {
  if (v === undefined || v === null) return '';
  if (esFecha(v)) return isNaN(v.getTime()) ? '' : v.toISOString();
  return String(v);
}

function filaAReserva(fila) {
  var r = {};
  COLUMNAS_RESERVA.forEach(function (k, i) {
    var v = fila[i];
    if (k === 'fecha') r[k] = normalizarFecha(v);
    else if (k === 'hora') r[k] = normalizarHora(v);
    else if (k === 'personas' || k === 'adelanto') r[k] = Number(v) || 0;
    else if (k === 'descuento_aplicado') r[k] = v === true || String(v).toUpperCase() === 'TRUE';
    else r[k] = desprotegerFormula(textoCelda(v));
  });
  return r;
}

function reservaAFila(reserva) {
  return COLUMNAS_RESERVA.map(function (k) {
    var v = reserva[k];
    return v === undefined || v === null ? '' : protegerFormula(v);
  });
}

// Un texto que empiece por = + - @ se evaluaría como fórmula (p. ej. IMPORTRANGE en el nombre del cliente):
// se antepone ' para que quede como texto.
function protegerFormula(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

// Inverso: solo quita el ' que protegerFormula pudo añadir (seguido de = + - @).
function desprotegerFormula(s) {
  return /^'[=+\-@]/.test(s) ? s.slice(1) : s;
}

function filaABloqueo(fila) {
  return {
    fecha: normalizarFecha(fila[0]),
    sede: textoCelda(fila[1]).trim().toUpperCase(),
    tipo: textoCelda(fila[2]).trim().toUpperCase(),
    motivo: textoCelda(fila[3])
  };
}

// filtro: { sede?, desde?, hasta? } con fechas 'yyyy-MM-dd', extremos incluidos.
function filtrarReservas(reservas, filtro) {
  var f = filtro || {};
  return reservas.filter(function (r) {
    if (f.sede && r.sede !== f.sede) return false;
    if (f.desde && r.fecha < f.desde) return false;
    if (f.hasta && r.fecha > f.hasta) return false;
    return true;
  });
}

// Misma lógica que nextFreeRow en apps-script/Code.gs: manda la columna A.
function filaLibre(hoja) {
  var colA = hoja.getRange(1, 1, hoja.getMaxRows(), 1).getValues();
  for (var i = colA.length - 1; i >= 1; i--) {
    if (String(colA[i][0]).trim() !== '') return i + 2;
  }
  return 2;
}

// Cuando la siguiente fila libre pasa del final de la hoja hay que agregar filas antes de escribir.
var FILAS_POR_AMPLIACION = 200;
function filasAAgregar(fila, maxFilas) {
  return fila > maxFilas ? Math.max(FILAS_POR_AMPLIACION, fila - maxFilas) : 0;
}

function obtenerPestana(ss, nombre, encabezados, sembrar) {
  var hoja = ss.getSheetByName(nombre);
  if (hoja) return hoja;
  hoja = ss.insertSheet(nombre);
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
  hoja.setFrozenRows(1);
  if (sembrar && sembrar.length) hoja.getRange(2, 1, sembrar.length, encabezados.length).setValues(sembrar);
  return hoja;
}

function filasConfigPorDefecto() {
  return Object.keys(CONFIG_POR_DEFECTO).map(function (k) {
    var v = CONFIG_POR_DEFECTO[k];
    return [k, Array.isArray(v) ? v.join(',') : v];
  });
}

// Config y Bloqueos se leen en cada consulta pero casi nunca cambian: se guardan un minuto en la
// caché del script para no leer la hoja cada vez. Un cambio en esas pestañas tarda hasta un minuto en verse.
var SEGUNDOS_CACHE_HOJA = 60;

function conCache(clave, leer) {
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) { /* sin caché (pruebas): se lee directo */ }
  if (cache) {
    var guardado = cache.get(clave);
    if (guardado) { try { return JSON.parse(guardado); } catch (e2) { /* dañado: se vuelve a leer */ } }
  }
  var valor = leer();
  if (cache) { try { cache.put(clave, JSON.stringify(valor), SEGUNDOS_CACHE_HOJA); } catch (e3) { /* muy grande: no pasa nada */ } }
  return valor;
}

function abrirHoja() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaReservas = obtenerPestana(ss, 'Reservas', COLUMNAS_RESERVA);
  var hojaConfig = obtenerPestana(ss, 'Config', ['clave', 'valor'], filasConfigPorDefecto());
  var hojaBloqueos = obtenerPestana(ss, 'Bloqueos', COLUMNAS_BLOQUEO);
  // Las columnas nuevas van al final (p. ej. "adelanto"): en una pestaña creada antes les falta el encabezado.
  var ultimaColumna = hojaReservas.getRange(1, COLUMNAS_RESERVA.length);
  if (ultimaColumna.getValue() !== COLUMNAS_RESERVA[COLUMNAS_RESERVA.length - 1]) {
    hojaReservas.getRange(1, 1, 1, COLUMNAS_RESERVA.length).setValues([COLUMNAS_RESERVA]);
  }

  function datos(hoja, columnas) {
    var ultima = hoja.getLastRow();
    if (ultima < 2) return [];
    return hoja.getRange(2, 1, ultima - 1, columnas).getValues();
  }

  function aplicarFormatoTexto() {
    var filas = hojaReservas.getMaxRows();
    COLUMNAS_TEXTO.forEach(function (k) {
      hojaReservas.getRange(1, COLUMNAS_RESERVA.indexOf(k) + 1, filas, 1).setNumberFormat('@');
    });
  }

  function todas() {
    return datos(hojaReservas, COLUMNAS_RESERVA.length)
      .filter(function (f) { return String(f[0]).trim() !== ''; })
      .map(filaAReserva);
  }

  function buscarPor(campo, valor) {
    if (!valor) return null;
    var lista = todas();
    for (var i = 0; i < lista.length; i++) if (lista[i][campo] === String(valor)) return lista[i];
    return null;
  }

  return {
    leerConfig: function () { return conCache('config', function () { return combinarConfig(datos(hojaConfig, 2)); }); },
    leerBloqueos: function () { return conCache('bloqueos', function () { return datos(hojaBloqueos, COLUMNAS_BLOQUEO.length).map(filaABloqueo); }); },
    leerReservas: function (filtro) { return filtrarReservas(todas(), filtro); },
    buscarPorCodigo: function (c) { return buscarPor('codigo', c); },
    buscarPorToken: function (t) { return buscarPor('token_cancelar', t); },
    insertar: function (reserva) {
      var fila = filaLibre(hojaReservas);
      var faltan = filasAAgregar(fila, hojaReservas.getMaxRows());
      if (faltan) hojaReservas.insertRowsAfter(hojaReservas.getMaxRows(), faltan);
      aplicarFormatoTexto(); // después de ampliar, para que las filas nuevas también queden como texto
      hojaReservas.getRange(fila, 1, 1, COLUMNAS_RESERVA.length).setValues([reservaAFila(reserva)]);
    },
    actualizar: function (reserva) {
      var colA = hojaReservas.getRange(1, 1, hojaReservas.getMaxRows(), 1).getValues();
      for (var i = 1; i < colA.length; i++) {
        if (String(colA[i][0]).trim() === reserva.codigo) {
          aplicarFormatoTexto();
          hojaReservas.getRange(i + 1, 1, 1, COLUMNAS_RESERVA.length).setValues([reservaAFila(reserva)]);
          return;
        }
      }
      throw new Error('NO_ENCONTRADA');
    }
  };
}
