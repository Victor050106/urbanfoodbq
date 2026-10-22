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
// botones de pedido, el selector de sede y la etiqueta del mapa. La página de
// reservas tiene su copia en SEDES_RESERVA de assets/js/reservas-comun.js.
export const SEDES = {
    carmen: {
        nombre: 'El Carmen',
        order: 'https://menu.fu.do/urbanfoodbq',
        phone: '573127557694'
    },
    hipodromo: {
        nombre: 'Hipódromo',
        order: 'https://menu.fu.do/urbanfoodsl',
        phone: '573226070697'
    }
};

// Web app de Google Apps Script (ver apps-script/Code.gs). De aquí salen las
// novedades vigentes. Las reservas usan otro Apps Script
// (apps-script/reservas/), con su URL en assets/js/reservas-comun.js.
export const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxbmTJiBV-pWqsm_qhVen_fDoe3rDWV-iuq2ccQZrf7zDI3E5XtT0rFDhOVpEd9BcKlTw/exec';
