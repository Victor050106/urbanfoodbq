const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');

function iniciarMenuMovil() {
    if (!menuToggle || !mobileMenu) return;
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

function iniciarSombra() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
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

export function iniciarNav() {
    iniciarMenuMovil();
    iniciarSombra();
}

// El enlace del menu se agrega solo cuando la seccion se muestra: un enlace a
// una seccion oculta deja al visitante mirando una pagina que no se movio.
// antesDe: selector del enlace delante del cual va; si no, queda de primero.
export function agregarEnlaceNav(href, texto, antesDe) {
    document.querySelectorAll('[data-nav-links]').forEach(nav => {
        if (nav.querySelector(`a[href="${href}"]`)) return;
        const a = document.createElement('a');
        a.href = href;
        a.textContent = texto;
        a.className = nav.dataset.navLinks === 'mobile'
            ? 'font-body text-label-bold uppercase tracking-wider text-white py-3'
            : 'font-body text-label-bold uppercase tracking-wider text-white/80 hover:text-vibrant-orange transition-colors';
        if (nav.dataset.navLinks === 'mobile') {
            // Se reusa el boton hamburguesa en vez de esconder el menu a mano:
            // asi el icono y el aria-expanded quedan coherentes.
            a.addEventListener('click', () => {
                if (mobileMenu && !mobileMenu.classList.contains('hidden')) menuToggle?.click();
            });
        }
        nav.insertBefore(a, (antesDe && nav.querySelector(antesDe)) || nav.firstElementChild);
    });
}
