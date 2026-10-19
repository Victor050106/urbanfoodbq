// Cupos, espacio asignado y validación de solicitudes de reserva.

var ESTADOS_QUE_OCUPAN = ['PENDIENTE_PAGO', 'CONFIRMADA', 'LLEGO', 'NO_LLEGO'];

// Un apartado sin pagar solo ocupa cupo mientras no haya vencido.
function ocupaCupo(reserva, ahoraMs) {
  if (ESTADOS_QUE_OCUPAN.indexOf(reserva.estado) === -1) return false;
  if (reserva.estado === 'PENDIENTE_PAGO') {
    var vence = Date.parse(reserva.vence);
    return !isNaN(vence) && vence > ahoraMs;
  }
  return true;
}

// 'VIP' | 'MESA' | null (grupo fuera de rango). El VIP solo existe en El Carmen.
function espacioPara(sede, personas, cfg) {
  if (personas < cfg.grupo_min || personas > cfg.grupo_max) return null;
  if (sede === 'ELCARMEN' && personas >= cfg.vip_min && personas <= cfg.vip_max) return 'VIP';
  return 'MESA';
}

function topeMesas(sede, cfg) {
  return sede === 'ELCARMEN' ? cfg.tope_mesas_elcarmen : cfg.tope_hipodromo;
}

function horasDisponibles(sede, fecha, personas, reservas, ahoraMs, cfg, bloqueos) {
  var espacio = espacioPara(sede, personas, cfg);
  if (!espacio) return [];
  if (!fechaHabilitada(fecha, sede, ahoraMs, cfg, bloqueos)) return [];
  var activas = (reservas || []).filter(function (r) {
    return r.sede === sede && r.espacio === espacio && r.fecha === fecha && ocupaCupo(r, ahoraMs);
  });
  var ocupadas = 0;
  if (espacio === 'MESA') {
    activas.forEach(function (r) { ocupadas += Number(r.personas) || 0; });
  }
  var cabeMesa = espacio !== 'MESA' || ocupadas + personas <= topeMesas(sede, cfg);
  var choque = cfg.vip_bloque_min + cfg.vip_limpieza_min;
  var minimo = ahoraMs + cfg.min_horas * 3600000;
  return horasDelDia(fecha, espacio, cfg).map(function (hora) {
    var libre = cabeMesa && instanteMs(fecha, hora) >= minimo;
    if (libre && espacio === 'VIP') {
      var s = horaAMinutos(hora);
      libre = !activas.some(function (r) { return Math.abs(s - horaAMinutos(r.hora)) < choque; });
    }
    return { hora: hora, libre: libre };
  });
}

function diasDelMes(sede, mes, personas, reservas, ahoraMs, cfg, bloqueos) {
  var p = mes.split('-').map(Number);
  var ultimo = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
  var dias = [];
  for (var d = 1; d <= ultimo; d++) {
    var fecha = p[0] + '-' + pad2(p[1]) + '-' + pad2(d);
    var horas = horasDisponibles(sede, fecha, personas, reservas, ahoraMs, cfg, bloqueos);
    dias.push({ fecha: fecha, disponible: horas.some(function (h) { return h.libre; }) });
  }
  return dias;
}

function textoLimpio(v) { return String(v === undefined || v === null ? '' : v).trim(); }

function validarSolicitud(datos, cfg) {
  var d = datos || {};
  var falla = function (e) { return { ok: false, error: e }; };

  var sede = textoLimpio(d.sede);
  if (sede !== 'ELCARMEN' && sede !== 'HIPODROMO') return falla('SEDE');

  var personas = typeof d.personas === 'number' ? d.personas : Number(textoLimpio(d.personas));
  if (!isFinite(personas) || personas !== Math.floor(personas) || personas < cfg.grupo_min) return falla('PERSONAS');
  if (personas > cfg.grupo_max) return falla('GRUPO_GRANDE');
  var espacio = espacioPara(sede, personas, cfg);

  var fecha = textoLimpio(d.fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || normalizarFecha(new Date(fecha + 'T12:00:00Z')) !== fecha) return falla('FECHA');

  var hora = textoLimpio(d.hora);
  if (!/^\d{2}:\d{2}$/.test(hora) || horasDelDia(fecha, espacio, cfg).indexOf(hora) === -1) return falla('HORA');

  var nombre = textoLimpio(d.nombre).replace(/\s+/g, ' ');
  if (nombre.length < 3 || nombre.length > 60) return falla('NOMBRE');

  var tipo = textoLimpio(d.tipo_doc).toUpperCase();
  var documento = textoLimpio(d.documento).replace(/[.\s\-]/g, '').toUpperCase();
  if (['CC', 'CE', 'PA'].indexOf(tipo) === -1 || !/^[A-Z0-9]{5,15}$/.test(documento)) return falla('DOCUMENTO');

  var correo = textoLimpio(d.correo).toLowerCase();
  if (correo.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) return falla('CORREO');

  var celular = textoLimpio(d.celular).replace(/[\s\-().]/g, '').replace(/^\+57/, '');
  if (!/^\d{10}$/.test(celular)) return falla('CELULAR');

  var si = function (v) { return v === true || v === 'true'; };
  if (!si(d.acepta_datos) || !si(d.acepta_politica)) return falla('AUTORIZACION');

  return {
    ok: true,
    limpio: {
      sede: sede, espacio: espacio, personas: personas, fecha: fecha, hora: hora,
      nombre: nombre, tipo_doc: tipo, documento: documento, correo: correo, celular: celular,
      comentario: textoLimpio(d.comentario).slice(0, 200)
    }
  };
}
