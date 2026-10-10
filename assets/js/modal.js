const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let abierto = null;

function trapFocus(el, e) {
    // tabIndex >= 0 deja fuera el campo trampa anti-bots y los dias del
    // calendario que no son el activo: el Tab nunca cae en ellos.
    const items = [...el.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null && x.tabIndex >= 0);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    // Al hacer clic en el título o en el relleno del panel el foco se va al
    // <body>: sin esto, el siguiente Tab seguía el orden del documento y se
    // escapaba a la navbar que está detrás del modal.
    if (!el.contains(document.activeElement)) {
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

document.addEventListener('keydown', (e) => {
    if (!abierto) return;
    if (e.key === 'Escape') abierto.cerrar();
    else if (e.key === 'Tab') trapFocus(abierto.el, e);
});

export function crearModal(el, { alCerrar } = {}) {
    let previo = null;
    const modal = {
        el,
        abierto: () => !el.classList.contains('hidden'),
        abrir(foco) {
            previo = document.activeElement;
            el.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            abierto = modal;
            foco?.focus();
        },
        cerrar() {
            if (!modal.abierto()) return;
            el.classList.add('hidden');
            document.body.style.overflow = '';
            abierto = null;
            alCerrar?.();
            if (previo instanceof HTMLElement) previo.focus();
        }
    };
    el.addEventListener('click', (e) => {
        if (e.target === el) modal.cerrar();
    });
    el.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', modal.cerrar));
    return modal;
}
