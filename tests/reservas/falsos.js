// Dependencias falsas para manejar(): hoja en memoria con la misma interfaz que abrirHoja(),
// Bold con estados configurables, buzón que acumula correos y reloj fijo (movible con d.ahoraMs).
const crypto = require('node:crypto');
const { cargar, ahora } = require('./cargar');

const { combinarConfig } = cargar('apps-script/reservas/Config.gs');

const copia = (x) => JSON.parse(JSON.stringify(x));

const CORREOS = {
  correo_admin: 'admin@urbanfood.test'
};

function hojaFalsa(d, op) {
  const filasConfig = Object.entries(CORREOS).concat(op.config || []);
  const hoja = {
    reservas: [],
    bloqueos: op.bloqueos || [],
    leerConfig: () => combinarConfig(filasConfig),
    leerBloqueos: () => copia(hoja.bloqueos),
    leerReservas: (filtro) => {
      const f = filtro || {};
      return copia(hoja.reservas.filter((r) =>
        (!f.sede || r.sede === f.sede) && (!f.desde || r.fecha >= f.desde) && (!f.hasta || r.fecha <= f.hasta)));
    },
    buscarPorCodigo: (c) => copia(hoja.reservas.find((r) => c && r.codigo === String(c)) || null),
    buscarPorToken: (t) => copia(hoja.reservas.find((r) => t && r.token_cancelar === String(t)) || null),
    insertar: (r) => {
      // El cupo solo es seguro si se inserta con el bloqueo tomado.
      if (!d.enBloqueo) throw new Error('insertar fuera del bloqueo');
      hoja.reservas.push(copia(r));
    },
    actualizar: (r) => {
      const i = hoja.reservas.findIndex((x) => x.codigo === r.codigo);
      if (i === -1) throw new Error('NO_ENCONTRADA');
      hoja.reservas[i] = copia(r);
    }
  };
  return hoja;
}

function boldFalso(op) {
  const bold = {
    estado: 'ACTIVE',     // estado por defecto de cualquier link
    estados: {},          // estado por id de link
    creados: [],
    consultas: [],
    crearLink: (payload) => {
      if (op.boldFalla) throw new Error('BOLD');
      bold.creados.push(copia(payload));
      return { id: 'LNK_FALSO_' + bold.creados.length, url: 'https://checkout.bold.co/falso' };
    },
    consultarLink: (id) => {
      bold.consultas.push(id);
      return bold.estados[id] || bold.estado;
    }
  };
  return bold;
}

function falsos(op = {}) {
  const d = {
    ahoraMs: op.ahora || ahora,
    buzon: [],
    enBloqueo: false,
    propiedades: Object.assign({ CLAVE_ELCARMEN: 'c1', CLAVE_HIPODROMO: 'h1', SECRETO_PANEL: 'secreto-de-prueba' }, op.props)
  };
  d.hoja = hojaFalsa(d, op);
  d.bold = boldFalso(op);
  d.enviar = (para, mensaje) => d.buzon.push({ para, asunto: mensaje.asunto, html: mensaje.html });
  d.ahora = () => d.ahoraMs;
  d.bloqueo = (fn) => {
    // LockService no se anida en una misma ejecución sin necesidad: si pasa, es un error de diseño.
    if (d.enBloqueo) throw new Error('bloqueo anidado');
    d.enBloqueo = true;
    try { return fn(); } finally { d.enBloqueo = false; }
  };
  d.props = { get: (k) => d.propiedades[k] || '' };
  // Como CacheService.getScriptCache(): get -> texto o null, put con vencimiento en segundos (según el reloj falso).
  const guardado = {};
  d.cache = {
    get: (k) => (guardado[k] && guardado[k].hasta > d.ahora() ? guardado[k].valor : null),
    put: (k, valor, segundos) => { guardado[k] = { valor: String(valor), hasta: d.ahora() + (segundos || 600) * 1000 }; },
    remove: (k) => { delete guardado[k]; }
  };
  let semilla = 7;
  d.aleatorio = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
  let n = 0;
  d.uuid = () => 'token-' + (++n);
  d.hmacHex = (t) => crypto.createHmac('sha256', d.propiedades.SECRETO_PANEL || '').update(t).digest('hex');
  return d;
}

module.exports = { falsos, CORREOS };
