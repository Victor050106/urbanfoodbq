// Configuración de reservas. La hoja "Config" puede sobrescribir estos valores
// sin tocar el código; lo que no esté en la hoja usa el valor por defecto.

var CONFIG_POR_DEFECTO = {
  adelanto: 50000,
  dias_reserva: [1, 2, 3, 4],           // lunes a jueves (0 = domingo): viernes y fin de semana no se reserva
  grupo_min: 6,                          // personas mínimas en las dos sedes
  // El Carmen: hasta 2 reservas por día, con al menos 3 h entre una y otra.
  max_elcarmen: 20,
  reservas_dia_elcarmen: 2,
  separacion_elcarmen_min: 180,
  // Hipódromo: una reserva por piso al día; el piso sale del tamaño del grupo.
  piso1_max_hipodromo: 16,
  piso2_max_hipodromo: 30,
  // Lo que se le dice al cliente que dura su reserva (la separación real de El Carmen es mayor).
  duracion_min: 120,
  intervalo_min: 30,
  mesa_ultima_antes_cierre_min: 60,     // última hora de reserva, minutos antes del cierre
  max_meses: 3,
  min_horas: 2,
  apartado_min: 15,
  cancelacion_horas: 24,
  // Recibe los avisos de devoluciones y pagos sin cupo: nunca vacío, o nadie se entera.
  correo_admin: 'urbanfoodbq@gmail.com',
  // GitHub Pages mientras no se compre urbanfoodbq.com: un dominio ajeno recibiría los tokens de cancelar.
  url_sitio: 'https://victor050106.github.io/urbanfoodbq'
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
      // Celda vacía: se queda el valor por defecto, igual que con los números.
      var texto = String(valor === undefined || valor === null ? '' : valor).trim();
      if (texto) cfg[clave] = texto.replace(/\/+$/, '');
    }
  });
  return cfg;
}
