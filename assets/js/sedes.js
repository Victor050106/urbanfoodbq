import { SEDES } from './config.js';
import { crearModal } from './modal.js';

const WA_TEXT = encodeURIComponent('¡Hola Urban Food! Quiero hacer un pedido.');

function waLink(sede) {
    return `https://wa.me/${sede.phone}?text=${WA_TEXT}`;
}

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

function iniciarFichas() {
    const activeLocLabel = document.getElementById('activeLocationLabel');
    document.querySelectorAll('.loc-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const loc = btn.dataset.loc;
            document.querySelectorAll('.loc-btn').forEach(b => {
                const isActive = b.dataset.loc === loc;
                b.classList.toggle('bg-deep-black', isActive);
                b.classList.toggle('text-white', isActive);
                b.classList.toggle('bg-transparent', !isActive);
                b.classList.toggle('text-deep-black', !isActive);
                b.setAttribute('aria-pressed', String(isActive));
            });
            document.querySelectorAll('.loc-content').forEach(c => {
                c.classList.toggle('active', c.dataset.locContent === loc);
            });
            document.querySelectorAll('.map-frame').forEach(f => {
                f.classList.toggle('active', f.dataset.locMap === loc);
            });
            if (activeLocLabel) activeLocLabel.textContent = SEDES[loc] ? `Sede ${SEDES[loc].nombre}` : '';
        });
    });
}

function iniciarSelector() {
    const el = document.getElementById('sedeModal');
    if (!el) return;
    const modal = crearModal(el);
    const title = document.getElementById('sedeModalTitle');
    const hint = document.getElementById('sedeModalHint');
    const foot = document.getElementById('sedeModalFoot');

    document.querySelectorAll('[data-sede-picker]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const copy = SEDE_PICKER_COPY[btn.dataset.sedePicker] || SEDE_PICKER_COPY.pedido;
            if (title) title.textContent = copy.title;
            if (hint) hint.textContent = copy.hint;
            if (foot) foot.textContent = copy.foot;
            // El destino depende de para qué se abrió: la carta de la sede o su WhatsApp.
            Object.entries(SEDES).forEach(([key, sede]) => {
                const link = el.querySelector(`[data-sede-link="${key}"]`);
                if (link) link.href = copy.href(sede);
            });
            modal.abrir(el.querySelector('[data-sede-link]'));
        });
    });

    // La carta se abre en otra pestaña: al volver, el modal no debe seguir encima.
    el.querySelectorAll('[data-sede-link]').forEach(a => a.addEventListener('click', modal.cerrar));
}

export function iniciarSedes() {
    iniciarFichas();
    iniciarSelector();
}
