const { chromium } = require('playwright-core');
const out = __dirname + '/shots/';
require('fs').mkdirSync(out, { recursive: true });

const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);

async function setup(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [], failed = [], posts = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => failed.push(r.url() + ' ' + r.failure()?.errorText));
  // Nada de escribir en la hoja real: los POST se responden con un mock.
  await page.route('**/script.google.com/**', async route => {
    const req = route.request();
    if (req.method() === 'POST') {
      posts.push(req.postData());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return route.continue();
  });
  return { ctx, page, errors, failed, posts };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // ---------- Escritorio ----------
  const d = await setup(browser, { width: 1366, height: 800 });
  const p = d.page;
  const t0 = Date.now();
  const sheetResp = p.waitForResponse(r => r.url().includes('googleusercontent') && r.request().method() === 'GET', { timeout: 30000 }).catch(() => null);
  await p.goto('http://localhost:3000', { waitUntil: 'load' });
  check('carga (load)', true, `${Date.now() - t0} ms`);
  await p.screenshot({ path: out + 'desktop-hero.png' });

  const badge = await p.locator('#openBadge').innerText().catch(() => '');
  check('badge abierto/cerrado visible', await p.locator('#openBadge').isVisible(), badge.trim());
  check('horario: un dia resaltado', (await p.locator('.schedule-row.today').count()) === 1);
  check('año en footer', (await p.locator('[data-year]').first().innerText()) === String(new Date().getFullYear()));

  const r = await sheetResp;
  const t1 = Date.now();
  let data = null;
  try { data = r && await r.json(); } catch {}
  check('API hoja responde', !!data, r ? `status ${r.status()}, ${t1 - t0} ms desde inicio` : 'sin respuesta');
  if (data) check('API trae reviews/novedades', Array.isArray(data.reviews) && Array.isArray(data.novedades),
    `reviews=${data.reviews?.length} novedades=${data.novedades?.length}`);
  await p.waitForTimeout(500);
  const reviewCards = await p.locator('#reviewsGrid article').count();
  check('opiniones pintadas', data ? reviewCards === Math.min(6, data.reviews.length) : true, `${reviewCards} tarjetas`);
  check('novedades visible si hay', data ? (await p.locator('#novedades').isVisible()) === (data.novedades.length > 0) : true);
  check('reservas visible', await p.locator('#reservas').isVisible());
  check('nav con enlace Reservar', (await p.locator('[data-nav-links] a[href="reservas/"]').count()) === 2);
  check('enlaces a /reservas/ (nav x2, hero, seccion, sedes x2)', (await p.locator('a[href="reservas/"]').count()) === 6);
  check('pie con politica de datos', (await p.locator('footer a[href="privacidad/"]').count()) === 1);

  // Sedes
  await p.locator('.loc-btn[data-loc="hipodromo"]').click();
  check('switch sede -> Hipodromo', (await p.locator('#activeLocationLabel').textContent()).includes('Hipódromo')
    && await p.locator('.map-frame[data-loc-map="hipodromo"]').evaluate(e => e.classList.contains('active')));
  await p.locator('.loc-btn[data-loc="carmen"]').click();

  // Selector de sede (pedido / carta / whatsapp)
  for (const mode of ['pedido', 'carta', 'whatsapp']) {
    const btn = p.locator(`[data-sede-picker="${mode}"]:visible`).first();
    if (!(await btn.count())) { check(`picker ${mode}`, false, 'sin boton visible'); continue; }
    await btn.click();
    const open = await p.locator('#sedeModal').isVisible();
    const hrefs = await p.locator('[data-sede-link]').evaluateAll(a => a.map(x => x.href));
    const expect = mode === 'whatsapp' ? hrefs.every(h => h.startsWith('https://wa.me/')) : hrefs.every(h => h.includes('menu.fu.do'));
    await p.keyboard.press('Escape');
    const closed = !(await p.locator('#sedeModal').isVisible());
    check(`picker ${mode}: abre, links correctos, Escape cierra`, open && expect && closed, hrefs.join(' | '));
  }
  // Foco atrapado en el selector
  await p.locator('[data-sede-picker="pedido"]:visible').first().click();
  for (let i = 0; i < 6; i++) await p.keyboard.press('Tab');
  check('foco atrapado en selector', await p.evaluate(() => document.getElementById('sedeModal').contains(document.activeElement)));
  await p.locator('#sedeModal').click({ position: { x: 5, y: 5 } });
  check('clic en fondo cierra selector', !(await p.locator('#sedeModal').isVisible()));

  // Opiniones
  await p.locator('#openReviewModal').click();
  check('modal opiniones abre con foco en nombre', await p.evaluate(() => document.activeElement.id === 'reviewName'));
  await p.locator('#reviewForm button[type=submit]').click();
  const reviewErr = await p.locator('#reviewName').evaluate(e => e.validationMessage);
  check('opiniones: valida vacio (required nativo)', reviewErr.length > 0, reviewErr);
  await p.locator('[data-star="5"]').focus();
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
  check('estrellas con teclado', (await p.locator('#ratingStars').getAttribute('data-rating')) === '3');
  await p.fill('#reviewName', 'Prueba E2E');
  await p.fill('#reviewComment', 'Comentario de prueba (mock, no llega a la hoja)');
  await p.locator('#reviewForm button[type=submit]').click();
  await p.waitForTimeout(500);
  check('opiniones: envio mock -> pendiente visible y modal cerrado',
    !(await p.locator('#reviewModal').isVisible()) && (await p.locator('#reviewsGrid').innerText()).includes('Pendiente de aprobación'));

  check('POSTs interceptados (no tocaron la hoja)', d.posts.length === 1, d.posts.map(x => x.slice(0, 80)).join(' || '));

  await p.screenshot({ path: out + 'desktop-full.png', fullPage: true });

  // Reservas: la pagina vive en /reservas/ (el flujo completo con Bold simulado se prueba
  // con tests/reservas/servidor-local.js). Sin RESERVAS_API_URL muestra el aviso "pronto".
  const rv = await setup(browser, { width: 1366, height: 800 });
  await rv.page.goto('http://localhost:3000/reservas/', { waitUntil: 'load' });
  await rv.page.waitForTimeout(500);
  const pronto = await rv.page.locator('#pronto').isVisible();
  const app = await rv.page.locator('#app').isVisible();
  const waPronto = await rv.page.locator('#prontoWa a[href^="https://wa.me/"]').count();
  check('pagina de reservas carga (pronto con WhatsApp o formulario)', (pronto && waPronto === 2) || app, pronto ? `pronto, ${waPronto} WhatsApp` : 'formulario');
  check('pagina de reservas sin errores', rv.errors.length === 0, rv.errors.join(' | '));
  await rv.page.screenshot({ path: out + 'desktop-reservas.png' });
  await rv.ctx.close();

  // Recursos pesados
  const perf = await p.evaluate(() => performance.getEntriesByType('resource')
    .map(e => ({ n: e.name.split('?')[0].slice(-70), kb: Math.round(e.transferSize / 1024), ms: Math.round(e.duration) }))
    .sort((a, b) => b.kb - a.kb).slice(0, 8));
  const nav = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp && Math.round(fcp.startTime) }; });

  // ---------- Movil ----------
  const m = await setup(browser, { width: 390, height: 844 });
  const mp = m.page;
  await mp.goto('http://localhost:3000', { waitUntil: 'load' });
  await mp.waitForTimeout(1500);
  await mp.screenshot({ path: out + 'mobile-hero.png' });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('movil: sin scroll horizontal', overflow <= 0, `exceso ${overflow}px`);
  await mp.locator('#menuToggle').click();
  const menuOpen = await mp.locator('#mobileMenu').isVisible();
  const aria = await mp.locator('#menuToggle').getAttribute('aria-expanded');
  await mp.locator('#mobileMenu a').first().click();
  await mp.waitForTimeout(300);
  check('movil: hamburguesa abre/cierra', menuOpen && aria === 'true' && !(await mp.locator('#mobileMenu').isVisible()));
  const small = await mp.evaluate(() => [...document.querySelectorAll('a,button')].filter(e => e.offsetParent && !e.closest('.hidden'))
    .map(e => { const r = e.getBoundingClientRect(); const a = e.classList.contains('tap') ? parseFloat(getComputedStyle(e, '::after').height) : 0; return { t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 25), w: Math.round(r.width), h: Math.max(Math.round(r.height), a) }; })
    .filter(x => x.w && (x.h < 44 || x.w < 44)).slice(0, 12));
  check('movil: objetivos tactiles < 44px', small.length === 0, JSON.stringify(small));
  await mp.screenshot({ path: out + 'mobile-full.png', fullPage: true });

  console.log(results.join('\n'));
  console.log('\nNAV:', JSON.stringify(nav));
  console.log('TOP RECURSOS:', JSON.stringify(perf, null, 1));
  console.log('\nERRORES escritorio:', JSON.stringify(d.errors, null, 1));
  console.log('ERRORES movil:', JSON.stringify(m.errors, null, 1));
  console.log('REQ FALLIDAS:', JSON.stringify([...d.failed, ...m.failed], null, 1));
  await browser.close();
  process.exitCode = results.some(r => r.startsWith('FAIL')) ? 1 : 0;
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e); process.exit(1); });
