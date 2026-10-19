const TZ = 'America/Bogota';

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
