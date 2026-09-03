// ============ Horarios ============
// openMin / closeMin en minutos desde medianoche. closeMin > 1440 = cierra de madrugada.
const SCHEDULE = [
    { day: 0, label: 'Domingo',   short: 'Dom', time: '4:00 PM – 12:30 AM', openMin: 960, closeMin: 1470 },
    { day: 1, label: 'Lunes',     short: 'Lun', time: '4:00 PM – 12:45 AM', openMin: 960, closeMin: 1485 },
    { day: 2, label: 'Martes',    short: 'Mar', time: '4:00 PM – 12:45 AM', openMin: 960, closeMin: 1485 },
    { day: 3, label: 'Miércoles', short: 'Mié', time: '4:00 PM – 12:45 AM', openMin: 960, closeMin: 1485 },
    { day: 4, label: 'Jueves',    short: 'Jue', time: '4:00 PM – 12:45 AM', openMin: 960, closeMin: 1485 },
    { day: 5, label: 'Viernes',   short: 'Vie', time: '4:00 PM – 1:00 AM',  openMin: 960, closeMin: 1500 },
    { day: 6, label: 'Sábado',    short: 'Sáb', time: '4:00 PM – 2:00 AM',  openMin: 960, closeMin: 1560 }
];

const TZ = 'America/Bogota';

// Hora del restaurante, no la del visitante: si alguien abre la página desde
// otro país el estado "abierto/cerrado" tiene que seguir siendo el de Barranquilla.
function nowInBogota() {
    try {
        const p = new Intl.DateTimeFormat('en-US', {
            timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
        }).formatToParts(new Date());
        const get = t => p.find(x => x.type === t)?.value;
        const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const day = days[get('weekday')];
        const hour = parseInt(get('hour'), 10) % 24;
        const min = parseInt(get('minute'), 10);
        if (day === undefined || isNaN(hour) || isNaN(min)) throw new Error('tz');
        return { day, minutes: hour * 60 + min };
    } catch {
        const d = new Date();
        return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
    }
}

function isOpenNow({ day, minutes }) {
    const today = SCHEDULE[day];
    if (today && minutes >= today.openMin && minutes < Math.min(today.closeMin, 1440)) return true;
    // Turno de ayer que se extiende pasada la medianoche (ej. sábado hasta las 2 AM)
    const yest = SCHEDULE[(day + 6) % 7];
    if (yest && yest.closeMin > 1440 && minutes < yest.closeMin - 1440) return true;
    return false;
}

const scheduleList = document.getElementById('scheduleList');
let paintedDay = null;

// Se repinta cuando cambia el día, no solo al cargar: la cocina cierra a las
// 12:45 / 2:00 AM, así que es normal tener la página abierta cruzando la
// medianoche. Si esto no se recalculara, el badge diría "Abierto" mientras la
// lista seguiría resaltando el día anterior.
function paintSchedule(day) {
    if (day === paintedDay) return;
    paintedDay = day;

    if (scheduleList) {
        scheduleList.innerHTML = SCHEDULE
            .slice(1).concat(SCHEDULE[0])
            .map(s => `
                <div class="schedule-row flex justify-between items-center border-b border-white/10 pb-2 ${s.day === day ? 'today' : ''}">
                    <span>${s.label}</span>
                    <span class="schedule-time font-bold text-white">${s.time}</span>
                </div>
            `).join('');
    }

    const todaySchedule = SCHEDULE.find(s => s.day === day)?.time || '';
    document.querySelectorAll('[data-today-schedule]').forEach(el => el.textContent = todaySchedule);
}

// ============ Badge "Abierto ahora / Cerrado" ============
function paintOpenBadge() {
    const badge = document.getElementById('openBadge');
    if (!badge) return;
    const open = isOpenNow(nowInBogota());
    const dot = badge.querySelector('[data-dot]');
    const txt = badge.querySelector('[data-openText]');

    badge.classList.remove('hidden');
    badge.classList.add('inline-flex');
    badge.classList.toggle('is-open', open);
    badge.classList.toggle('is-closed', !open);
    if (dot) dot.hidden = false;
    if (txt) txt.textContent = open ? 'Abierto ahora' : 'Cerrado · Abrimos 4:00 PM';
}

function tick() {
    paintSchedule(nowInBogota().day);
    paintOpenBadge();
}
tick();
setInterval(tick, 60000);

// ============ Año del footer ============
document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
});

// ============ Mobile nav ============
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
if (menuToggle && mobileMenu) {
    const icon = menuToggle.querySelector('[data-menu-icon]');
    const setMenu = (open) => {
        mobileMenu.classList.toggle('hidden', !open);
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
        if (icon) icon.textContent = open ? 'close' : 'menu';
    };
    menuToggle.addEventListener('click', () => {
        setMenu(mobileMenu.classList.contains('hidden'));
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => setMenu(false));
    });
}

// ============ Navbar scroll shadow ============
const navbar = document.getElementById('navbar');
if (navbar) {
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            navbar.classList.toggle('scrolled', window.scrollY > 40);
            ticking = false;
        });
    }, { passive: true });
}

// ============ Sedes ============
// Cada sede tiene su propio menú en fu.do. Si algún día cambia un link o se
// abre otra sede, se toca solo este objeto: de aquí salen los botones de pedido,
// el selector de sede y la etiqueta del mapa.
const SEDES = {
    carmen: {
        label: 'Sede El Carmen',
        order: 'https://menu.fu.do/urbanfoodbq',
        phone: '573127557694'
    },
    hipodromo: {
        label: 'Sede Hipódromo',
        order: 'https://menu.fu.do/urbanfoodsl',
        // TODO: numero provisional. Reemplazar por el real de Hipodromo aqui y
        // en index.html (ficha de la sede, pie de pagina y JSON-LD).
        phone: '573000000000'
    }
};

const WA_TEXT = encodeURIComponent('¡Hola Urban Food! Quiero hacer un pedido.');

// Enlace de WhatsApp de una sede, con el mensaje de pedido ya escrito.
function waLink(sede) {
    return `https://wa.me/${sede.phone}?text=${WA_TEXT}`;
}

// ============ Location switcher ============
const activeLocLabel = document.getElementById('activeLocationLabel');

document.querySelectorAll('.loc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const loc = btn.dataset.loc;
        // Buttons
        document.querySelectorAll('.loc-btn').forEach(b => {
            const isActive = b.dataset.loc === loc;
            b.classList.toggle('bg-deep-black', isActive);
            b.classList.toggle('text-white', isActive);
            b.classList.toggle('bg-transparent', !isActive);
            b.classList.toggle('text-deep-black', !isActive);
            b.setAttribute('aria-pressed', String(isActive));
        });
        // Content
        document.querySelectorAll('.loc-content').forEach(c => {
            c.classList.toggle('active', c.dataset.locContent === loc);
        });
        // Map (la visibilidad la maneja .map-frame/.active en styles.css)
        document.querySelectorAll('.map-frame').forEach(f => {
            f.classList.toggle('active', f.dataset.locMap === loc);
        });
        // Label
        if (activeLocLabel) activeLocLabel.textContent = SEDES[loc]?.label || '';
    });
});

// ============ Modales ============
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Mantiene el foco dentro del modal abierto. Lo usan el selector de sede y el
// formulario de opiniones.
function trapFocus(modal, e) {
    const items = [...modal.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    // Al hacer clic en el título o en el relleno del panel el foco se va al
    // <body>: sin esto, el siguiente Tab seguía el orden del documento y se
    // escapaba a la navbar que está detrás del modal.
    if (!modal.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
        return;
    }
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
    }
}

// ============ Selector de sede ============
// Los botones de "pedir" y "ver carta" son <a> con el link de El Carmen dentro:
// si el JS no carga siguen llevando a una carta real. Cuando sí carga, el clic
// se intercepta y se pregunta primero por la sede.
const SEDE_PICKER_COPY = {
    pedido: {
        title: '¿En qué sede quieres pedir?',
        hint: 'Cada sede tiene su propia carta y su propio domicilio.',
        href: sede => sede.order,
        foot: 'Se abre la carta de fu.do en una pestaña nueva.'
    },
    carta: {
        title: '¿Qué carta quieres ver?',
        hint: 'Cada sede maneja su propia carta en fu.do.',
        href: sede => sede.order,
        foot: 'Se abre la carta de fu.do en una pestaña nueva.'
    },
    whatsapp: {
        title: '¿A qué sede le escribes?',
        hint: 'Cada sede atiende su propio WhatsApp.',
        href: waLink,
        foot: 'Se abre WhatsApp con el mensaje ya escrito.'
    }
};

const sedeModal = document.getElementById('sedeModal');
const sedeModalTitle = document.getElementById('sedeModalTitle');
const sedeModalHint = document.getElementById('sedeModalHint');
const sedeModalFoot = document.getElementById('sedeModalFoot');
let lastFocusedBeforeSede = null;

function isSedeModalOpen() {
    return !!sedeModal && !sedeModal.classList.contains('hidden');
}

function openSedeModal(mode) {
    if (!sedeModal) return;
    const copy = SEDE_PICKER_COPY[mode] || SEDE_PICKER_COPY.pedido;
    if (sedeModalTitle) sedeModalTitle.textContent = copy.title;
    if (sedeModalHint) sedeModalHint.textContent = copy.hint;
    if (sedeModalFoot) sedeModalFoot.textContent = copy.foot;
    // El destino depende de para qué se abrió: la carta de la sede o su WhatsApp.
    Object.entries(SEDES).forEach(([key, sede]) => {
        const link = sedeModal.querySelector(`[data-sede-link="${key}"]`);
        if (link) link.href = copy.href(sede);
    });
    lastFocusedBeforeSede = document.activeElement;
    sedeModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    sedeModal.querySelector('[data-sede-link]')?.focus();
}

function closeSedeModal() {
    if (!isSedeModalOpen()) return;
    sedeModal.classList.add('hidden');
    document.body.style.overflow = '';
    if (lastFocusedBeforeSede instanceof HTMLElement) lastFocusedBeforeSede.focus();
}

document.querySelectorAll('[data-sede-picker]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        openSedeModal(btn.dataset.sedePicker);
    });
});

document.getElementById('closeSedeModal')?.addEventListener('click', closeSedeModal);
sedeModal?.addEventListener('click', (e) => {
    if (e.target === sedeModal) closeSedeModal();
});
// La carta se abre en otra pestaña: al volver, el modal no debe seguir encima.
sedeModal?.querySelectorAll('[data-sede-link]').forEach(a => {
    a.addEventListener('click', closeSedeModal);
});

document.addEventListener('keydown', (e) => {
    if (!isSedeModalOpen()) return;
    if (e.key === 'Escape') { closeSedeModal(); return; }
    if (e.key === 'Tab') trapFocus(sedeModal, e);
});

// ============ Datos de la hoja de cálculo ============
// URL del web app de Google Apps Script (ver apps-script/Code.gs para setup).
// De aquí salen las opiniones aprobadas y las novedades vigentes, en una sola
// llamada. Si está vacía, las dos secciones se quedan sin contenido: las
// opiniones muestran la invitación a opinar y las novedades no aparecen.
const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxbmTJiBV-pWqsm_qhVen_fDoe3rDWV-iuq2ccQZrf7zDI3E5XtT0rFDhOVpEd9BcKlTw/exec';

// Solo se muestran opiniones reales aprobadas desde la hoja de cálculo.
// No hay testimonios de ejemplo: si no hay ninguno aprobado, se invita a opinar.

function plural(n, singular, plural_) {
    return `Hace ${n} ${n === 1 ? singular : plural_}`;
}

function relativeTime(ts) {
    if (!ts) return 'Recién';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return 'Recién';
    const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'Recién';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    if (diff < 86400 * 7) return plural(Math.floor(diff / 86400), 'día', 'días');
    if (diff < 86400 * 30) return `Hace ${Math.floor(diff / 86400 / 7)} sem`;
    if (diff < 86400 * 365) return plural(Math.floor(diff / 86400 / 30), 'mes', 'meses');
    return plural(Math.floor(diff / 86400 / 365), 'año', 'años');
}

// Una sola petición trae opiniones y novedades: son la misma hoja y el mismo
// script, así que pedirlas por separado seria despertar dos veces el Apps
// Script (que arranca en frio y tarda unos segundos).
async function fetchSheetData() {
    if (!SHEET_API_URL) return null;
    try {
        const res = await fetch(SHEET_API_URL, { method: 'GET', cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

function mapReviews(data) {
    if (!data || !Array.isArray(data.reviews)) return null;
    return data.reviews.map(r => ({
        name: r.name,
        rating: r.rating,
        comment: r.comment,
        when: r.timestamp ? relativeTime(r.timestamp) : 'Recién'
    }));
}

async function postRemoteReview(review) {
    if (!SHEET_API_URL) return false;
    try {
        const res = await fetch(SHEET_API_URL, {
            method: 'POST',
            // text/plain evita preflight CORS con Apps Script
            body: JSON.stringify(review)
        });
        if (!res.ok) return false;
        const data = await res.json();
        return !!data.ok;
    } catch {
        return false;
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// Mensaje que ocupa el ancho completo de la grilla (cargando / sin opiniones aún)
function gridMessage(text) {
    return `
        <div class="md:col-span-3 text-center py-12">
            <span class="material-symbols-outlined text-secondary/50 text-5xl mb-3 block">rate_review</span>
            <p class="font-body text-body-md text-secondary">${escapeHtml(text)}</p>
        </div>
    `;
}

function renderReviews(reviews, state) {
    const grid = document.getElementById('reviewsGrid');
    if (!grid) return;

    const items = (reviews || []).slice(0, 6);

    if (!items.length) {
        grid.innerHTML = gridMessage(
            state === 'loading'
                ? 'Cargando opiniones...'
                : 'Aún no hay opiniones publicadas. ¡Sé el primero en contarnos tu experiencia!'
        );
        return;
    }

    grid.innerHTML = items.map(r => {
        const initial = (r.name || '?').trim().charAt(0).toUpperCase();
        const stars = Array.from({ length: 5 }, (_, i) => `
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${i < r.rating ? 1 : 0};">star</span>
        `).join('');
        return `
            <article class="bg-white p-8 border border-deep-black/5 shadow-sm rounded-lg hover:shadow-md transition-shadow fade-in visible">
                <div class="flex text-vibrant-orange mb-4">${stars}</div>
                <p class="font-body text-body-md text-secondary italic mb-6">"${escapeHtml(r.comment)}"</p>
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-deep-black rounded-full flex items-center justify-center text-white font-bold">${escapeHtml(initial)}</div>
                    <div>
                        <h4 class="font-body text-label-bold text-deep-black">${escapeHtml(r.name)}</h4>
                        <span class="text-xs text-secondary">${escapeHtml(r.when || 'Recién')}</span>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

// Estado inicial vacío: solo se muestran opiniones reales aprobadas.
let cachedReviews = [];
renderReviews(cachedReviews, 'loading');

(async () => {
    const data = await fetchSheetData();
    cachedReviews = mapReviews(data) || [];
    renderReviews(cachedReviews, 'ready');
    renderNovedades(data && data.novedades);
})();

// ============ Review modal ============
const reviewModal = document.getElementById('reviewModal');
const openModalBtn = document.getElementById('openReviewModal');
const closeModalBtn = document.getElementById('closeReviewModal');
const reviewForm = document.getElementById('reviewForm');
const ratingStars = document.getElementById('ratingStars');

const reviewError = document.getElementById('reviewError');
let lastFocused = null;

function isModalOpen() {
    return reviewModal && !reviewModal.classList.contains('hidden');
}

function showError(msg) {
    if (!reviewError) return;
    reviewError.textContent = msg;
    reviewError.classList.toggle('hidden', !msg);
}

function openModal() {
    if (!reviewModal) return;
    lastFocused = document.activeElement;
    reviewModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    showError('');
    document.getElementById('reviewName')?.focus();
}
function closeModal() {
    if (!isModalOpen()) return;
    reviewModal.classList.add('hidden');
    document.body.style.overflow = '';
    showError('');
    // Devolver el foco a donde estaba antes de abrir
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
}

openModalBtn?.addEventListener('click', openModal);
closeModalBtn?.addEventListener('click', closeModal);
reviewModal?.addEventListener('click', (e) => {
    if (e.target === reviewModal) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (!isModalOpen()) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') trapFocus(reviewModal, e);
});

function paintStars(rating) {
    if (!ratingStars) return;
    ratingStars.dataset.rating = rating;
    ratingStars.querySelectorAll('[data-star]').forEach(s => {
        const v = parseInt(s.dataset.star, 10);
        const on = v <= rating;
        const icon = s.querySelector('.material-symbols-outlined') || s;
        icon.style.fontVariationSettings = on ? "'FILL' 1" : "'FILL' 0";
        s.setAttribute('aria-checked', String(v === rating));
        // Solo la estrella seleccionada queda en el orden de tabulación (patrón radiogroup)
        s.tabIndex = v === rating ? 0 : -1;
    });
}

const starBtns = [...(ratingStars?.querySelectorAll('[data-star]') || [])];
starBtns.forEach(s => {
    s.addEventListener('click', () => paintStars(parseInt(s.dataset.star, 10)));
    s.addEventListener('keydown', (e) => {
        const cur = parseInt(ratingStars.dataset.rating || '5', 10);
        let next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, cur + 1);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, cur - 1);
        if (e.key === 'Home') next = 1;
        if (e.key === 'End') next = 5;
        if (next === null) return;
        e.preventDefault();
        paintStars(next);
        starBtns.find(b => parseInt(b.dataset.star, 10) === next)?.focus();
    });
});
paintStars(5);

reviewForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(reviewForm);

    // Campo trampa: si viene lleno, es un bot. Fingimos éxito y no enviamos nada.
    const honeypot = (data.get('website') || '').toString().trim();
    if (honeypot) {
        reviewForm.reset();
        paintStars(5);
        closeModal();
        return;
    }

    const review = {
        name: (data.get('name') || '').toString().trim(),
        comment: (data.get('comment') || '').toString().trim(),
        rating: parseInt(ratingStars?.dataset.rating || '5', 10),
        website: honeypot, // se reenvía vacío; el backend también lo valida
        when: 'Recién'
    };
    if (!review.name || !review.comment) {
        showError('Escribe tu nombre y tu comentario antes de enviar.');
        return;
    }

    const submitBtn = reviewForm.querySelector('button[type=submit]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }
    showError('');

    // Se envía primero y solo se pinta si el backend confirma. Antes se pintaba
    // de forma optimista y al revertir con slice(1) se podía borrar una opinión
    // real si la carga inicial terminaba en medio del envío.
    const ok = await postRemoteReview(review);

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }

    if (!ok) {
        showError('No pudimos guardar tu comentario. Inténtalo de nuevo en un momento.');
        return;
    }

    // Queda "pendiente de aprobación": solo lo ve quien lo escribió, en su
    // propia sesión, hasta que alguien lo apruebe en la hoja de cálculo.
    cachedReviews = [{ ...review, when: 'Pendiente de aprobación' }, ...cachedReviews];
    renderReviews(cachedReviews, 'ready');

    reviewForm.reset();
    paintStars(5);
    closeModal();
});

// ============ Novedades ============
// Lo que se ve aqui sale de la pestana "Novedades" de la hoja de calculo: el
// restaurante publica y retira novedades desde ahi, sin tocar el sitio. La
// seccion nace oculta y solo se muestra si el Apps Script devuelve algo
// vigente, para que nunca quede un titular viejo colgado en la pagina.

const novedadesSection = document.getElementById('novedades');
const novedadesLista = document.getElementById('novedadesLista');

// El video no se descarga al abrir la pagina: primero se ve la caratula y el
// archivo (varios MB) solo empieza a bajar cuando alguien pulsa el play.
function novedadMedia(n) {
    if (!n.video) {
        return n.poster
            ? `<img src="${escapeHtml(n.poster)}" alt="" loading="lazy" decoding="async" class="w-full rounded-2xl">`
            : '';
    }
    const poster = n.poster ? ` poster="${escapeHtml(n.poster)}"` : '';
    return `
        <div class="novedad-video relative rounded-2xl overflow-hidden bg-white/5">
            <video class="w-full block" controls preload="none" playsinline${poster}>
                <source src="${escapeHtml(n.video)}" type="video/mp4">
                Tu navegador no puede reproducir este video.
            </video>
        </div>`;
}

function renderNovedades(items) {
    if (!novedadesSection || !novedadesLista) return;
    const lista = Array.isArray(items) ? items.filter(n => n && n.titulo) : [];
    if (!lista.length) return; // la seccion se queda oculta

    novedadesLista.innerHTML = lista.map(n => {
        const media = novedadMedia(n);
        const etiqueta = n.etiqueta
            ? `<span class="inline-block bg-fresh-teal text-deep-black font-body text-label-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4">${escapeHtml(n.etiqueta)}</span>`
            : '';
        const texto = n.texto
            ? `<p class="font-body text-body-lg text-white/70 leading-relaxed">${escapeHtml(n.texto)}</p>`
            : '';
        // Sin video ni foto el texto ocupa todo el ancho, en vez de dejar un hueco.
        return `
            <article class="grid ${media ? 'lg:grid-cols-[minmax(0,340px)_1fr]' : 'grid-cols-1'} gap-8 lg:gap-12 items-center">
                ${media ? `<div class="max-w-[340px] w-full mx-auto lg:mx-0">${media}</div>` : ''}
                <div>
                    ${etiqueta}
                    <h3 class="font-display text-headline-lg uppercase leading-none mb-4">${escapeHtml(n.titulo)}</h3>
                    ${texto}
                </div>
            </article>`;
    }).join('');

    novedadesSection.classList.remove('hidden');

    // El enlace del menu se agrega solo cuando hay algo que ver: un enlace a una
    // seccion oculta deja al visitante mirando una pagina que no se movio.
    document.querySelectorAll('[data-nav-links]').forEach(nav => {
        if (nav.querySelector('a[href="#novedades"]')) return;
        const a = document.createElement('a');
        a.href = '#novedades';
        a.textContent = 'Novedades';
        a.className = nav.dataset.navLinks === 'mobile'
            ? 'font-body text-label-bold uppercase tracking-wider text-white py-2'
            : 'font-body text-label-bold uppercase tracking-wider text-white/80 hover:text-vibrant-orange transition-colors';
        if (nav.dataset.navLinks === 'mobile') {
            // Se reusa el boton hamburguesa en vez de esconder el menu a mano:
            // asi el icono y el aria-expanded quedan coherentes.
            a.addEventListener('click', () => {
                if (mobileMenu && !mobileMenu.classList.contains('hidden')) menuToggle?.click();
            });
        }
        nav.insertBefore(a, nav.firstElementChild);
    });
}

// ============ Fade-in observer ============
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
