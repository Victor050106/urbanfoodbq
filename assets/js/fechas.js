import { pad2 } from './util.js';

const TZ = 'America/Bogota';

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Hora del restaurante, no la del visitante: si alguien abre la página desde
// otro país el estado "abierto/cerrado" tiene que seguir siendo el de Barranquilla.
export function nowInBogota() {
    try {
        const p = new Intl.DateTimeFormat('en-US', {
            timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
        }).formatToParts(new Date());
        const get = t => p.find(x => x.type === t)?.value;
        const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const day = days[get('weekday')];
        const hour = parseInt(get('hour'), 10) % 24;
        const min = parseInt(get('minute'), 10);
        if (day === undefined || isNaN(hour) || isNaN(min)) throw new Error('tz');
        return { day, minutes: hour * 60 + min };
    } catch {
        const d = new Date();
        return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
    }
}

export function hoyIsoBogota() {
    try {
        // en-CA formatea como AAAA-MM-DD
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date());
    } catch {
        const d = new Date();
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
}

function isoParts(iso) {
    return iso.split('-').map(Number);
}

export function isoAddDays(iso, n) {
    const [y, m, d] = isoParts(iso);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Instante en que empieza la reserva. Colombia no tiene horario de verano:
// la hora local es siempre UTC-5.
export function slotMs(iso, hhmm) {
    const [y, m, d] = isoParts(iso);
    const [h, mi] = hhmm.split(':').map(Number);
    return Date.UTC(y, m - 1, d, h + 5, mi);
}

export function fechaLarga(iso) {
    const [y, m, d] = isoParts(iso);
    return `${DIAS_ES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} de ${MESES_ES[m - 1]}`;
}

export function horaLegible(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}:${pad2(m)} ${h < 12 ? 'AM' : 'PM'}`;
}
