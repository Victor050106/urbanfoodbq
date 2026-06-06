// ============ Horarios ============
const SCHEDULE = [
    { day: 0, label: 'Domingo',   short: 'Dom', time: '4:00 PM – 12:30 AM' },
    { day: 1, label: 'Lunes',     short: 'Lun', time: '4:00 PM – 12:45 AM' },
    { day: 2, label: 'Martes',    short: 'Mar', time: '4:00 PM – 12:45 AM' },
    { day: 3, label: 'Miércoles', short: 'Mié', time: '4:00 PM – 12:45 AM' },
    { day: 4, label: 'Jueves',    short: 'Jue', time: '4:00 PM – 12:45 AM' },
    { day: 5, label: 'Viernes',   short: 'Vie', time: '4:00 PM – 1:00 AM'  },
    { day: 6, label: 'Sábado',    short: 'Sáb', time: '4:00 PM – 2:00 AM'  }
];

const todayIdx = new Date().getDay();
const scheduleList = document.getElementById('scheduleList');
if (scheduleList) {
    scheduleList.innerHTML = SCHEDULE
        .slice(1).concat(SCHEDULE[0])
        .map(s => `
            <div class="schedule-row flex justify-between items-center border-b border-white/10 pb-2 ${s.day === todayIdx ? 'today' : ''}">
                <span>${s.label}</span>
                <span class="schedule-time font-bold text-white">${s.time}</span>
            </div>
        `).join('');
}

const todaySchedule = SCHEDULE.find(s => s.day === todayIdx)?.time || '';
document.querySelectorAll('[data-today-schedule]').forEach(el => el.textContent = todaySchedule);

// ============ Mobile nav ============
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => mobileMenu.classList.add('hidden'));
    });
}

// ============ Navbar scroll shadow ============
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (!navbar) return;
    navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// ============ Location switcher ============
const LOC_LABELS = {
    principal: 'Sede Principal',
    hipodromo: 'Sede Hipódromo'
};
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
        });
        // Content
        document.querySelectorAll('.loc-content').forEach(c => {
            c.classList.toggle('active', c.dataset.locContent === loc);
        });
        // Map
        document.querySelectorAll('.map-frame').forEach(f => {
            f.classList.toggle('active', f.dataset.locMap === loc);
            f.classList.toggle('hidden', f.dataset.locMap !== loc);
        });
        // Label
        if (activeLocLabel) activeLocLabel.textContent = LOC_LABELS[loc] || '';
    });
});

// ============ Reviews ============
const DEFAULT_REVIEWS = [
    { name: 'Ricardo Méndez',  rating: 5, comment: 'La mejor hamburguesa urbana que he probado en Barranquilla. El sabor a parrilla es auténtico y las porciones son gigantes.', when: 'Hace 2 días' },
    { name: 'Laura Ortiz',     rating: 5, comment: 'Las salchipapas son otro nivel. La mezcla de salsas y la calidad de la carne marcan la diferencia. Súper recomendado.', when: 'Hace 1 semana' },
    { name: 'Juan Camilo',     rating: 5, comment: 'Excelente servicio al cliente y la comida llegó caliente a pesar de ser domicilio. Urban Food nunca falla.', when: 'Hace 3 días' }
];

const REVIEWS_KEY = 'urbanfood_reviews_v1';

function loadReviews() {
    try {
        const stored = JSON.parse(localStorage.getItem(REVIEWS_KEY) || '[]');
        return [...stored, ...DEFAULT_REVIEWS];
    } catch {
        return DEFAULT_REVIEWS;
    }
}

function saveReview(review) {
    try {
        const stored = JSON.parse(localStorage.getItem(REVIEWS_KEY) || '[]');
        stored.unshift(review);
        localStorage.setItem(REVIEWS_KEY, JSON.stringify(stored.slice(0, 20)));
    } catch (e) {}
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function renderReviews() {
    const grid = document.getElementById('reviewsGrid');
    if (!grid) return;
    const reviews = loadReviews().slice(0, 6);
    grid.innerHTML = reviews.map(r => {
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
                        <span class="text-xs text-secondary/60">${escapeHtml(r.when || 'Recién')}</span>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

renderReviews();

// ============ Review modal ============
const reviewModal = document.getElementById('reviewModal');
const openModalBtn = document.getElementById('openReviewModal');
const closeModalBtn = document.getElementById('closeReviewModal');
const reviewForm = document.getElementById('reviewForm');
const ratingStars = document.getElementById('ratingStars');

function openModal() {
    reviewModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}
function closeModal() {
    reviewModal?.classList.add('hidden');
    document.body.style.overflow = '';
}

openModalBtn?.addEventListener('click', openModal);
closeModalBtn?.addEventListener('click', closeModal);
reviewModal?.addEventListener('click', (e) => {
    if (e.target === reviewModal) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

function paintStars(rating) {
    if (!ratingStars) return;
    ratingStars.dataset.rating = rating;
    ratingStars.querySelectorAll('[data-star]').forEach(s => {
        const v = parseInt(s.dataset.star, 10);
        s.style.fontVariationSettings = v <= rating ? "'FILL' 1" : "'FILL' 0";
    });
}

ratingStars?.querySelectorAll('[data-star]').forEach(s => {
    s.addEventListener('click', () => paintStars(parseInt(s.dataset.star, 10)));
});

reviewForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(reviewForm);
    const review = {
        name: (data.get('name') || '').toString().trim(),
        comment: (data.get('comment') || '').toString().trim(),
        rating: parseInt(ratingStars?.dataset.rating || '5', 10),
        when: 'Recién'
    };
    if (!review.name || !review.comment) return;
    saveReview(review);
    renderReviews();
    reviewForm.reset();
    paintStars(5);
    closeModal();
});

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
