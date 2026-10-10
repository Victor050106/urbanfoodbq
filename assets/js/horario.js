import { SCHEDULE } from './config.js';
import { nowInBogota } from './fechas.js';

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

export function iniciarHorario() {
    tick();
    setInterval(tick, 60000);
}
