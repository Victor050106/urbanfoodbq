// Configuración de reservas. La hoja "Config" puede sobrescribir estos valores
// sin tocar el código; lo que no esté en la hoja usa el valor por defecto.

var CONFIG_POR_DEFECTO = {
  adelanto: 50000,
  dias_reserva: [1, 2, 3, 4, 5],        // lunes a viernes (0 = domingo)
  vip_min: 10,
  vip_max: 20,
  vip_bloque_min: 180,
  vip_limpieza_min: 30,
  tope_mesas_elcarmen: 20,              // personas por noche
  tope_hipodromo: 30,
  intervalo_min: 30,
  mesa_ultima_antes_cierre_min: 60,
  vip_ultima_antes_cierre_min: 180,
  max_meses: 3,
  min_horas: 2,
  grupo_min: 2,
  grupo_max: 20,
  apartado_min: 15,
  cancelacion_horas: 24,
  // Vacíos a propósito: el dueño los llena en la hoja Config. Sin correo no se envía, pero nada falla.
  correo_elcarmen: '',
  correo_hipodromo: '',
  correo_admin: '',
  url_sitio: 'https://urbanfoodbq.com'
};

var NOMBRE_SEDE = { ELCARMEN: 'El Carmen', HIPODROMO: 'Hipódromo' };

// Índice 0 = domingo. Mismos cierres que SCHEDULE en assets/js/config.js;
// cierra > 1440 significa que cierra de madrugada del día siguiente.
var HORARIO = [
  { abre: 960, cierra: 1470 },
  { abre: 960, cierra: 1485 },
  { abre: 960, cierra: 1485 },
  { abre: 960, cierra: 1485 },
  { abre: 960, cierra: 1485 },
  { abre: 960, cierra: 1500 },
  { abre: 960, cierra: 1560 }
];

// filas: [[clave, valor], ...] tal como salen de la hoja Config.
function combinarConfig(filas) {
  var cfg = {};
  Object.keys(CONFIG_POR_DEFECTO).forEach(function (k) {
    var v = CONFIG_POR_DEFECTO[k];
    cfg[k] = Array.isArray(v) ? v.slice() : v;
  });
  (filas || []).forEach(function (fila) {
    var clave = String(fila[0] === undefined || fila[0] === null ? '' : fila[0]).trim();
    var valor = fila[1];
    if (!Object.prototype.hasOwnProperty.call(CONFIG_POR_DEFECTO, clave)) return;
    var defecto = CONFIG_POR_DEFECTO[clave];
    if (Array.isArray(defecto)) {
      var dias = String(valor === undefined || valor === null ? '' : valor)
        .split(/[,\s;]+/)
        .filter(function (s) { return s !== ''; })
        .map(Number)
        .filter(function (n) { return isFinite(n) && n >= 0 && n <= 6 && n === Math.floor(n); });
      if (dias.length) cfg[clave] = dias;
    } else if (typeof defecto === 'number') {
      // Celda vacía o texto no numérico: se queda el valor por defecto.
      if (valor === '' || valor === null || valor === undefined) return;
      var n = Number(valor);
      if (isFinite(n)) cfg[clave] = n;
    } else {
      cfg[clave] = String(valor === undefined || valor === null ? '' : valor).trim();
    }
  });
  return cfg;
}
