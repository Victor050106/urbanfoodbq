import { postJson } from './api.js';
import { crearModal } from './modal.js';
import { escapeHtml } from './util.js';

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

function mapReviews(data) {
    if (!data || !Array.isArray(data.reviews)) return null;
    return data.reviews.map(r => ({
        name: r.name,
        rating: r.rating,
        comment: r.comment,
        when: r.timestamp ? relativeTime(r.timestamp) : 'Recién'
    }));
}

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
            <span class="material-symbols-outlined${i < r.rating ? ' icon-fill' : ''}">star</span>
        `).join('');
        return `
            <article class="bg-white p-8 border border-deep-black/5 shadow-sm rounded-lg hover:shadow-md transition-shadow fade-in visible">
                <div class="flex text-vibrant-orange mb-4">${stars}</div>
                <p class="font-body text-body-md text-secondary italic mb-6">"${escapeHtml(r.comment)}"</p>
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-deep-black rounded-full flex items-center justify-center text-white font-bold">${escapeHtml(initial)}</div>
                    <div>
                        <h3 class="font-body text-label-bold text-deep-black">${escapeHtml(r.name)}</h3>
                        <span class="text-xs text-secondary">${escapeHtml(r.when || 'Recién')}</span>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

// Solo se muestran opiniones reales aprobadas en la hoja: no hay testimonios
// de ejemplo. Si no hay ninguna aprobada, se invita a opinar.
let cachedReviews = [];

export function cargarOpiniones(data) {
    cachedReviews = mapReviews(data) || [];
    renderReviews(cachedReviews, 'ready');
}

export function iniciarOpiniones() {
    renderReviews(cachedReviews, 'loading');

    const el = document.getElementById('reviewModal');
    const form = document.getElementById('reviewForm');
    const ratingStars = document.getElementById('ratingStars');
    const errorBox = document.getElementById('reviewError');
    if (!el || !form) return;

    const showError = (msg) => {
        if (!errorBox) return;
        errorBox.textContent = msg;
        errorBox.classList.toggle('hidden', !msg);
    };
    const modal = crearModal(el, { alCerrar: () => showError('') });

    document.getElementById('openReviewModal')?.addEventListener('click', () => {
        showError('');
        modal.abrir(document.getElementById('reviewName'));
    });

    const starBtns = [...(ratingStars?.querySelectorAll('[data-star]') || [])];
    const paintStars = (rating) => {
        if (!ratingStars) return;
        ratingStars.dataset.rating = rating;
        starBtns.forEach(s => {
            const v = parseInt(s.dataset.star, 10);
            (s.querySelector('.material-symbols-outlined') || s).classList.toggle('icon-fill', v <= rating);
            s.setAttribute('aria-checked', String(v === rating));
            // Solo la estrella seleccionada queda en el orden de tabulación (patrón radiogroup)
            s.tabIndex = v === rating ? 0 : -1;
        });
    };

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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(form);

        // Campo trampa: si viene lleno, es un bot. Fingimos éxito y no enviamos nada.
        const honeypot = (data.get('website') || '').toString().trim();
        if (honeypot) {
            form.reset();
            paintStars(5);
            modal.cerrar();
            return;
        }

        const review = {
            name: (data.get('name') || '').toString().trim(),
            comment: (data.get('comment') || '').toString().trim(),
            rating: parseInt(ratingStars?.dataset.rating || '5', 10),
            website: honeypot,
            when: 'Recién'
        };
        if (!review.name || !review.comment) {
            showError('Escribe tu nombre y tu comentario antes de enviar.');
            return;
        }

        const submitBtn = form.querySelector('button[type=submit]');
        const originalText = submitBtn?.textContent;
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }
        showError('');

        // Se envía primero y solo se pinta si el backend confirma. Antes se pintaba
        // de forma optimista y al revertir con slice(1) se podía borrar una opinión
        // real si la carga inicial terminaba en medio del envío.
        const res = await postJson(review);

        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }

        if (!res?.ok) {
            showError('No pudimos guardar tu comentario. Inténtalo de nuevo en un momento.');
            return;
        }

        // Queda "pendiente de aprobación": solo lo ve quien lo escribió, en su
        // propia sesión, hasta que alguien lo apruebe en la hoja de cálculo.
        cachedReviews = [{ ...review, when: 'Pendiente de aprobación' }, ...cachedReviews];
        renderReviews(cachedReviews, 'ready');

        form.reset();
        paintStars(5);
        modal.cerrar();
    });
}
