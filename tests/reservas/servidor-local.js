// Solo desarrollo (no se publica): sirve el sitio y simula el API de reservas en /api.
//   node tests/reservas/servidor-local.js   ->   http://localhost:3000/reservas/?api=local
// Usa manejar() de apps-script/reservas con la hoja en memoria de falsos.js, el reloj real y un Bold falso
// cuyo enlace de pago vuelve a la página y cuenta como PAGADO en la primera consulta de estado.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { cargar } = require('./cargar');
const { falsos } = require('./falsos');

const raiz = path.join(__dirname, '..', '..');
const PUERTO = Number(process.env.PORT) || 3000;
const SITIO = 'http://localhost:' + PUERTO;

const gs = cargar('apps-script/reservas/Config.gs', 'apps-script/reservas/Calendario.gs',
  'apps-script/reservas/Disponibilidad.gs', 'apps-script/reservas/Ciclo.gs', 'apps-script/reservas/Hoja.gs',
  'apps-script/reservas/Bold.gs', 'apps-script/reservas/Correos.gs', 'apps-script/reservas/Api.gs');

const deps = falsos({
  config: [['url_sitio', SITIO]],
  props: { CLAVE_ELCARMEN: 'carmen', CLAVE_HIPODROMO: 'hipodromo', SECRETO_PANEL: 'secreto-solo-desarrollo' }
});
deps.ahora = () => Date.now();
deps.enviar = (para, m) => {
  console.log('[correo] para ' + para + ' | ' + m.asunto);
  // Solo desarrollo: muestra el enlace de cancelación para probar esa página.
  const c = /href="([^"]*\/reservas\/cancelar\/[^"]*)"/.exec(m.html || '');
  if (c) console.log('[cancelar] ' + c[1].replace(/&amp;/g, '&'));
};
deps.bold = {
  n: 0,
  crearLink: (payload) => {
    deps.bold.n++;
    // El cliente "paga" al volver: la URL de pago es el propio callback.
    return { id: 'LNK_LOCAL_' + deps.bold.n, url: payload.callback_url + '&api=local' };
  },
  consultarLink: () => 'PAID'
};

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml'
};

function json(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function api(req, res, url) {
  if (req.method === 'POST') {
    let cuerpo = '';
    req.on('data', (d) => { cuerpo += d; });
    req.on('end', () => {
      let p;
      try { p = JSON.parse(cuerpo); } catch (e) { return json(res, { ok: false, error: 'PARAMETROS' }); }
      json(res, resultado(p.accion, p, ['crear', 'cancelar', 'panel_entrar', 'panel_listar', 'panel_marcar']));
    });
    return;
  }
  const p = Object.fromEntries(url.searchParams);
  json(res, resultado(p.accion, p, ['dias', 'horas', 'estado', 'cancelacion']));
}

function resultado(accion, params, permitidas) {
  if (!permitidas.includes(accion)) return { ok: false, error: 'ACCION' };
  return JSON.parse(JSON.stringify(gs.manejar(accion, params, deps)));
}

// Solo se sirve el sitio público: nada de carpetas internas ni archivos que empiecen por punto.
const PRIVADAS = ['docs', 'tests', 'apps-script', '_source', 'node_modules'];

function estatico(res, url) {
  let pedido;
  try { pedido = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400); return res.end(); }
  // En Windows la barra invertida separa carpetas: se rechaza antes de mirar segmentos.
  if (pedido.split('').some((c) => c.charCodeAt(0) === 92 || c.charCodeAt(0) === 0)) { res.writeHead(400); return res.end(); } // barra invertida o NUL
  const segmentos = pedido.split('/').filter(Boolean);
  // En Windows el disco no distingue mayúsculas: /Docs/ abriría docs/.
  if (segmentos.some((s) => s.startsWith('.') || PRIVADAS.includes(s.toLowerCase()))) { res.writeHead(404); return res.end('No encontrado'); }
  let ruta = path.resolve(raiz, '.' + path.sep + segmentos.join(path.sep));
  const rel = path.relative(raiz, ruta);
  if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(ruta) && fs.statSync(ruta).isDirectory()) {
    if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }); return res.end(); }
    ruta = path.join(ruta, 'index.html');
  }
  fs.readFile(ruta, (err, datos) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(datos);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, SITIO);
  if (url.pathname === '/api') return api(req, res, url);
  estatico(res, url);
}).listen(PUERTO, '127.0.0.1', () => {
  console.log('Sitio y API de prueba en ' + SITIO + '/reservas/?api=local');
  console.log('Panel (claves): carmen / hipodromo');
});
