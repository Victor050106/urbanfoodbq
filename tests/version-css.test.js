const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// GitHub Pages deja el CSS 10 minutos en la caché del navegador: tras publicar, el HTML nuevo
// llegaba con los estilos viejos. Por eso cada <link> al CSS propio lleva ?v=; al cambiar un CSS
// se sube ese número en todas las páginas a la vez.
const raiz = path.join(__dirname, '..');
const paginas = ['index.html', 'privacidad/index.html', 'reservas/index.html', 'reservas/panel/index.html',
  'reservas/cancelar/index.html', 'reservas/condiciones/index.html'];

test('todas las páginas piden el CSS propio con la misma ?v=', () => {
  const versiones = new Set();
  for (const p of paginas) {
    const html = fs.readFileSync(path.join(raiz, p), 'utf8');
    for (const m of html.matchAll(/href="[^"]*assets\/css\/[a-z-]+\.css([^"]*)"/g)) {
      assert.match(m[1], /^\?v=\d+$/, `${p}: ${m[0]} sin ?v=`);
      versiones.add(m[1]);
    }
  }
  assert.strictEqual(versiones.size, 1, 'versiones distintas: ' + [...versiones].join(', '));
});
