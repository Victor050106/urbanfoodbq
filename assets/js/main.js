import { getJson } from './api.js';
import { iniciarHorario } from './horario.js';
import { iniciarNav } from './nav.js';
import { renderNovedades } from './novedades.js';
import { iniciarSedes } from './sedes.js';

iniciarHorario();
iniciarNav();
iniciarSedes();

document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
});

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// En celular la burbuja de WhatsApp tapaba los botones del inicio: se esconde mientras se ven.
const waFlotante = document.querySelector('[data-wa-flotante]');
new IntersectionObserver(([entry]) => {
    waFlotante.classList.toggle('wa-oculto', entry.isIntersecting);
}).observe(document.querySelector('[data-hero-ctas]'));

getJson().then(data => renderNovedades(data?.novedades));
