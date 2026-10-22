const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// La portada pide a Google Fonts solo los íconos de icon_names. Uno que falte se vería como su nombre
// en texto ("shopping_bag"), así que todo ícono usado en la portada o en sus scripts debe estar en la lista.
const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const scripts = ['main', 'nav', 'horario', 'sedes', 'novedades', 'modal', 'util', 'api', 'config', 'fechas']
  .map((f) => fs.readFileSync(path.join(raiz, 'assets/js', f + '.js'), 'utf8')).join('\n');

test('cada ícono de la portada está en icon_names, en orden alfabético', () => {
  const lista = /Material\+Symbols\+Outlined[^"]*icon_names=([a-z_0-9,]+)/.exec(html)[1].split(',');
  assert.deepStrictEqual(lista, [...lista].sort(), 'Google Fonts exige icon_names en orden alfabético');
  const usados = new Set(['menu', 'close']); // nav.js los cambia con textContent
  for (const m of (html + scripts).matchAll(/material-symbols-outlined[^>]*>\s*([a-z_0-9]+)\s*</g)) usados.add(m[1]);
  const faltan = [...usados].filter((i) => !lista.includes(i));
  assert.deepStrictEqual(faltan, [], 'agrégalos a icon_names en index.html');
});
