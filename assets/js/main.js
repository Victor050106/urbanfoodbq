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

getJson().then(data => renderNovedades(data?.novedades));
