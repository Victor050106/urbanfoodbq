import { getJson } from './api.js';
import { iniciarHorario } from './horario.js';
import { iniciarNav } from './nav.js';
import { renderNovedades } from './novedades.js';
import { iniciarOpiniones, cargarOpiniones } from './opiniones.js';
import { iniciarReservas, mostrarReservas } from './reservas.js';
import { iniciarSedes } from './sedes.js';

iniciarHorario();
iniciarNav();
iniciarSedes();
iniciarOpiniones();
iniciarReservas();

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

// Una sola petición trae opiniones, novedades y días reservados: el Apps Script
// arranca en frío y tarda unos segundos, así que no conviene despertarlo tres veces.
getJson().then(data => {
    cargarOpiniones(data);
    renderNovedades(data?.novedades);
    mostrarReservas(data?.reservas);
});
