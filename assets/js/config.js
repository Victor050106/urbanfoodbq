// openMin / closeMin en minutos desde medianoche. closeMin > 1440 = cierra de madrugada.
export const SCHEDULE = [
    { day: 0, label: 'Domingo',   time: '4:00 PM – 12:30 AM', openMin: 960, closeMin: 1470 },
    { day: 1, label: 'Lunes',     time: '4:00 PM – 12:45 AM', openMin: 960, closeMin: 1485 },
    { day: 2, label: 'Martes',    time: '4:00 PM – 12:45 AM', openMin: 960, closeMin: 1485 },
    { day: 3, label: 'Miércoles', time: '4:00 PM – 12:45 AM', openMin: 960, closeMin: 1485 },
    { day: 4, label: 'Jueves',    time: '4:00 PM – 12:45 AM', openMin: 960, closeMin: 1485 },
    { day: 5, label: 'Viernes',   time: '4:00 PM – 1:00 AM',  openMin: 960, closeMin: 1500 },
    { day: 6, label: 'Sábado',    time: '4:00 PM – 2:00 AM',  openMin: 960, closeMin: 1560 }
];

// Cada sede tiene su propio menú en fu.do y su propio WhatsApp. De aquí salen los
// botones de pedido, el selector de sede, la etiqueta del mapa y las reservas.
// min / max: personas por reserva. Están repetidos en RES_SEDES de apps-script/Code.gs.
export const SEDES = {
    carmen: {
        nombre: 'El Carmen',
        order: 'https://menu.fu.do/urbanfoodbq',
        phone: '573127557694',
        min: 10,
        max: 20
    },
    hipodromo: {
        nombre: 'Hipódromo',
        order: 'https://menu.fu.do/urbanfoodsl',
        // TODO: numero provisional. Reemplazar por el real de Hipodromo aqui y
        // en index.html (ficha de la sede, pie de pagina y JSON-LD).
        phone: '573000000000',
        min: 10,
        max: 30
    }
};

// Web app de Google Apps Script (ver apps-script/Code.gs). De aquí salen las
// opiniones aprobadas, las novedades vigentes y los días ya reservados.
export const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxbmTJiBV-pWqsm_qhVen_fDoe3rDWV-iuq2ccQZrf7zDI3E5XtT0rFDhOVpEd9BcKlTw/exec';

// Repetidos en RES_* de apps-script/Code.gs: el servidor vuelve a revisar todo,
// aquí solo sirven para no dejar escoger lo que el servidor igual rechazaría.
export const RESERVA_HORAS = (() => {
    const out = [];
    for (let m = 16 * 60; m <= 22 * 60; m += 30) {
        out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
    return out;
})();
export const RESERVA_ANTICIPACION_MS = 24 * 3600 * 1000;
export const RESERVA_MAX_DIAS = 60;
