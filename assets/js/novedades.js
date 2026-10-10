import { agregarEnlaceNav } from './nav.js';
import { escapeHtml } from './util.js';

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

// La seccion nace oculta y solo se muestra si el Apps Script devuelve algo
// vigente, para que nunca quede un titular viejo colgado en la pagina.
export function renderNovedades(items) {
    const section = document.getElementById('novedades');
    const lista = document.getElementById('novedadesLista');
    if (!section || !lista) return;
    const vigentes = Array.isArray(items) ? items.filter(n => n && n.titulo) : [];
    if (!vigentes.length) return;

    lista.innerHTML = vigentes.map(n => {
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

    section.classList.remove('hidden');
    agregarEnlaceNav('#novedades', 'Novedades');
}
