import { getJson, postJson } from './api.js';
import { SEDES, RESERVA_HORAS, RESERVA_ANTICIPACION_MS, RESERVA_MAX_DIAS } from './config.js';
import { MESES_ES, hoyIsoBogota, isoAddDays, slotMs, fechaLarga, horaLegible } from './fechas.js';
import { crearModal } from './modal.js';
import { agregarEnlaceNav } from './nav.js';
import { pad2 } from './util.js';

// Una reserva por sede y por dia, con minimo 24 horas de anticipacion. El dia
// queda bloqueado apenas llega la solicitud, aunque siga pendiente.

// Dias ocupados por sede: { carmen: ['2026-10-04'], hipodromo: [] }. Mientras
// sea null el backend no ha respondido y la seccion sigue oculta.
let reservasOcupadas = null;

const reservasSection = document.getElementById('reservas');
const reservaModal = document.getElementById('reservaModal');
const reservaForm = document.getElementById('reservaForm');
const reservaCal = document.getElementById('reservaCalendario');
const reservaFechaTexto = document.getElementById('reservaFechaTexto');
const reservaHora = document.getElementById('reservaHora');
const reservaPersonas = document.getElementById('reservaPersonas');
const reservaError = document.getElementById('reservaError');
const reservaExito = document.getElementById('reservaExito');
let modal = null;

// Lo que lleva escogido el cliente. mes = 'YYYY-MM' que muestra el calendario.
let reserva = { sede: '', fecha: '', mes: '' };

// Las 24 horas se cuentan hasta la hora de llegada, no hasta el dia: el martes
// a las 8 PM ya no se puede reservar para el miercoles a las 5 PM.
function horasLibres(iso) {
    const limite = Date.now() + RESERVA_ANTICIPACION_MS;
    return RESERVA_HORAS.filter(h => slotMs(iso, h) >= limite);
}

// 'ok' | 'ocupado' | 'fuera' (pasado, muy lejos o sin horas con 24 h de margen)
function estadoDia(iso, sedeKey) {
    const hoy = hoyIsoBogota();
    if (iso <= hoy || iso > isoAddDays(hoy, RESERVA_MAX_DIAS)) return 'fuera';
    if (!horasLibres(iso).length) return 'fuera';
    if (reservasOcupadas?.[sedeKey]?.includes(iso)) return 'ocupado';
    return 'ok';
}

// Celular colombiano: acepta "312 755 7694", "+57 312-755-7694", etc.
function normalizarCelular(v) {
    let d = String(v || '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
    return /^3\d{9}$/.test(d) ? d : '';
}

function renderCalendario(focusIso) {
    if (!reservaCal) return;

    // Si el foco estaba dentro del calendario, se devuelve al mismo sitio
    // despues de repintar (si no, se perderia en el <body>).
    const activo = reservaCal.contains(document.activeElement) ? document.activeElement : null;
    const focoDia = focusIso || activo?.dataset.dia;
    const focoNav = !focusIso && activo?.dataset.mes;

    const hoy = hoyIsoBogota();
    const primero = isoAddDays(hoy, 1);
    const ultimo = isoAddDays(hoy, RESERVA_MAX_DIAS);
    if (!reserva.mes) reserva.mes = (reserva.fecha || primero).slice(0, 7);

    const [y, m] = reserva.mes.split('-').map(Number);
    const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
    // Semana de lunes a domingo, como el calendario de pared en Colombia.
    const hueco = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;

    const dias = Array.from({ length: diasMes }, (_, i) => {
        const iso = `${y}-${pad2(m)}-${pad2(i + 1)}`;
        return { iso, d: i + 1, estado: reserva.sede ? estadoDia(iso, reserva.sede) : 'fuera' };
    });
    // Solo un dia entra en el orden de Tab; entre dias se mueve con las flechas.
    const libres = dias.filter(x => x.estado === 'ok');
    const tabIso = (libres.find(x => x.iso === reserva.fecha) || libres[0])?.iso;

    const celdas = dias.map(({ iso, d, estado }) => {
        const cls = ['reserva-cal-day'];
        if (estado === 'ocupado') cls.push('is-taken');
        if (iso === reserva.fecha) cls.push('is-selected');
        const nota = estado === 'ocupado' ? ', ya reservado' : estado === 'fuera' ? ', no disponible' : '';
        return `<button type="button" class="${cls.join(' ')}" data-dia="${iso}"
                    aria-label="${fechaLarga(iso)}${nota}" aria-pressed="${iso === reserva.fecha}"
                    tabindex="${iso === tabIso ? 0 : -1}"${estado === 'ok' ? '' : ' disabled'}>${d}</button>`;
    }).join('');

    reservaCal.innerHTML = `
        <div class="reserva-cal-head">
            <button type="button" class="reserva-cal-nav" data-mes="-1" aria-label="Mes anterior"${reserva.mes > primero.slice(0, 7) ? '' : ' disabled'}>
                <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
            </button>
            <span class="reserva-cal-mes">${MESES_ES[m - 1]} ${y}</span>
            <button type="button" class="reserva-cal-nav" data-mes="1" aria-label="Mes siguiente"${reserva.mes < ultimo.slice(0, 7) ? '' : ' disabled'}>
                <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </button>
        </div>
        <div class="reserva-cal-grid">
            ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span class="reserva-cal-dow" aria-hidden="true">${x}</span>`).join('')}
            ${'<span></span>'.repeat(hueco)}
            ${celdas}
        </div>
        <p class="reserva-cal-leyenda"><i aria-hidden="true"></i>Tachado: d&iacute;a ya reservado en esta sede</p>`;

    if (focoDia) reservaCal.querySelector(`[data-dia="${focoDia}"]`)?.focus();
    else if (focoNav) {
        const nav = reservaCal.querySelector(`[data-mes="${focoNav}"]`);
        (nav && !nav.disabled ? nav : reservaCal.querySelector('[data-mes]:not(:disabled)'))?.focus();
    }
}

function pintarTextoFecha(aviso) {
    if (!reservaFechaTexto) return;
    reservaFechaTexto.textContent = aviso
        || (!reserva.sede ? 'Elige primero la sede para ver los días libres.'
        : !reserva.fecha ? 'Toca un día libre en el calendario.'
        : `Elegiste el ${fechaLarga(reserva.fecha)}.`);
}

function actualizarHoras() {
    if (!reservaHora) return;
    const previa = reservaHora.value;
    if (!reserva.fecha) {
        reservaHora.innerHTML = '<option value="">Elige la fecha</option>';
        reservaHora.disabled = true;
        return;
    }
    const horas = horasLibres(reserva.fecha);
    reservaHora.innerHTML = '<option value="">Elige la hora</option>' +
        horas.map(h => `<option value="${h}">${horaLegible(h)}</option>`).join('');
    reservaHora.disabled = false;
    if (horas.includes(previa)) reservaHora.value = previa;
}

// Si el dia escogido deja de estar libre (otra persona lo tomo, o cambio la
// sede), se suelta y se explica por que.
function soltarFechaSiNoSirve(aviso) {
    if (!reserva.fecha || estadoDia(reserva.fecha, reserva.sede) === 'ok') return false;
    reserva.fecha = '';
    actualizarHoras();
    pintarTextoFecha(aviso);
    return true;
}

async function fetchOcupadas() {
    const data = await getJson('?q=reservas');
    return data && typeof data.reservas === 'object' ? data.reservas : null;
}

export function mostrarReservas(ocupadas) {
    if (!reservasSection || !ocupadas || typeof ocupadas !== 'object') return;
    reservasOcupadas = ocupadas;
    reservasSection.classList.remove('hidden');
    agregarEnlaceNav('#reservas', 'Reservas', 'a[href="#ubicacion"]');
}

function marcarOcupada(sedeKey, iso) {
    if (!reservasOcupadas) reservasOcupadas = {};
    const lista = reservasOcupadas[sedeKey] || (reservasOcupadas[sedeKey] = []);
    if (!lista.includes(iso)) lista.push(iso);
}

function showReservaError(msg) {
    if (!reservaError) return;
    reservaError.textContent = msg;
    reservaError.classList.toggle('hidden', !msg);
}

function resetReserva() {
    reservaForm?.reset();
    reserva = { sede: '', fecha: '', mes: '' };
    if (reservaPersonas) {
        const sedes = Object.values(SEDES);
        reservaPersonas.min = Math.min(...sedes.map(s => s.min));
        reservaPersonas.max = Math.max(...sedes.map(s => s.max));
        reservaPersonas.placeholder = `${reservaPersonas.min} a ${reservaPersonas.max}`;
    }
    reservaForm?.classList.remove('hidden');
    reservaExito?.classList.add('hidden');
    showReservaError('');
}

function openReserva() {
    // Despues de una reserva exitosa, volver a abrir empieza de cero.
    if (reservaExito && !reservaExito.classList.contains('hidden')) resetReserva();
    showReservaError('');
    renderCalendario();
    actualizarHoras();
    pintarTextoFecha();
    modal.abrir(reservaForm?.querySelector('input[name="sede"]:checked') || reservaForm?.querySelector('input[name="sede"]'));

    // La lista de dias ocupados puede tener rato (se cargo con la pagina): se
    // pide de nuevo para no ofrecer un dia que alguien tomo mientras tanto.
    fetchOcupadas().then(ocupadas => {
        if (!ocupadas) return;
        reservasOcupadas = ocupadas;
        if (!modal.abierto()) return;
        soltarFechaSiNoSirve('El día que habías elegido acaba de ser reservado. Elige otro.');
        renderCalendario();
    });
}

function mostrarExito(p) {
    const sede = SEDES[p.sede];
    const cuando = `${fechaLarga(p.fecha)} a las ${horaLegible(p.hora)}`;
    const texto = document.getElementById('reservaExitoTexto');
    if (texto) {
        texto.textContent = `Apartamos el ${cuando} en la sede ${sede.nombre}, para ${p.personas} personas. ` +
            'La sede te escribirá por WhatsApp para confirmarla.';
    }
    // El cliente le envia el resumen a la sede: asi el negocio lo ve en el
    // mismo WhatsApp donde atiende, ademas del correo que manda el Apps Script.
    const msg = '¡Hola Urban Food! Acabo de solicitar una reserva desde la página web:\n\n' +
        `• Sede: ${sede.nombre}\n• Fecha: ${cuando}\n• Personas: ${p.personas}\n• A nombre de: ${p.nombre}` +
        (p.nota ? `\n• Nota: ${p.nota}` : '') +
        '\n\n¿Me la confirman, por favor?';
    const wa = document.getElementById('reservaWhatsApp');
    if (wa) wa.href = `https://wa.me/${sede.phone}?text=${encodeURIComponent(msg)}`;

    reservaForm?.classList.add('hidden');
    reservaExito?.classList.remove('hidden');
    reservaExito?.focus();
}

async function enviarReserva(e) {
    e.preventDefault();
    const data = new FormData(reservaForm);

    // Campo trampa: si viene lleno, es un bot. Fingimos éxito y no enviamos nada.
    if ((data.get('website') || '').toString().trim()) {
        modal.cerrar();
        resetReserva();
        return;
    }

    const sede = SEDES[reserva.sede];
    const payload = {
        tipo: 'reserva',
        sede: reserva.sede,
        fecha: reserva.fecha,
        hora: (data.get('hora') || '').toString(),
        personas: parseInt(data.get('personas'), 10),
        nombre: (data.get('nombre') || '').toString().trim(),
        telefono: normalizarCelular(data.get('telefono')),
        nota: (data.get('nota') || '').toString().trim(),
        website: ''
    };

    const falta =
        !sede ? ['Elige la sede.', reservaForm.querySelector('input[name="sede"]')]
        : !payload.fecha ? ['Elige la fecha en el calendario.', reservaCal?.querySelector('[data-dia][tabindex="0"]')]
        : !payload.hora ? ['Elige la hora de llegada.', reservaHora]
        : !(payload.personas >= sede.min && payload.personas <= sede.max)
            ? [`En ${sede.nombre} se reserva para ${sede.min} a ${sede.max} personas.`, reservaPersonas]
        : !payload.nombre ? ['Escribe el nombre de quien reserva.', document.getElementById('reservaNombre')]
        : !payload.telefono ? ['Escribe un celular de 10 dígitos, por ejemplo 300 123 4567.', document.getElementById('reservaTelefono')]
        : null;
    if (falta) {
        showReservaError(falta[0]);
        falta[1]?.focus();
        return;
    }

    // Con el formulario abierto un buen rato, la hora escogida puede haber
    // quedado a menos de 24 horas.
    if (!horasLibres(payload.fecha).includes(payload.hora)) {
        actualizarHoras();
        soltarFechaSiNoSirve();
        renderCalendario();
        showReservaError('Esa hora ya quedó a menos de 24 horas. Elige otra.');
        return;
    }

    const submitBtn = reservaForm.querySelector('button[type=submit]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }
    showReservaError('');

    const res = await postJson(payload);

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }

    if (!res) {
        showReservaError('No pudimos enviar tu reserva. Revisa tu conexión e inténtalo de nuevo.');
        return;
    }
    if (!res.ok) {
        if (res.code === 'ocupado') {
            marcarOcupada(payload.sede, payload.fecha);
            soltarFechaSiNoSirve();
            renderCalendario();
        }
        showReservaError(res.error || 'No pudimos guardar tu reserva. Inténtalo de nuevo.');
        return;
    }

    marcarOcupada(payload.sede, payload.fecha);
    mostrarExito(payload);
}

export function iniciarReservas() {
    if (!reservaModal || !reservaForm) return;
    modal = crearModal(reservaModal);

    document.querySelectorAll('[data-open-reserva]').forEach(btn => btn.addEventListener('click', openReserva));

    reservaCal?.addEventListener('click', (e) => {
        const nav = e.target.closest('[data-mes]');
        if (nav) {
            const [y, m] = reserva.mes.split('-').map(Number);
            reserva.mes = new Date(Date.UTC(y, m - 1 + Number(nav.dataset.mes), 1)).toISOString().slice(0, 7);
            renderCalendario();
            return;
        }
        const dia = e.target.closest('[data-dia]');
        if (!dia || dia.disabled) return;
        reserva.fecha = dia.dataset.dia;
        renderCalendario(reserva.fecha);
        actualizarHoras();
        pintarTextoFecha();
    });

    reservaCal?.addEventListener('keydown', (e) => {
        const dia = e.target.closest('[data-dia]');
        const paso = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
        if (!dia || !paso) return;
        e.preventDefault();
        // Salta los dias no disponibles en la direccion de la flecha, cruzando de
        // mes si hace falta.
        const hoy = hoyIsoBogota();
        const ultimo = isoAddDays(hoy, RESERVA_MAX_DIAS);
        let iso = dia.dataset.dia;
        while (true) {
            iso = isoAddDays(iso, paso);
            if (iso <= hoy || iso > ultimo) return;
            if (estadoDia(iso, reserva.sede) === 'ok') break;
        }
        reserva.mes = iso.slice(0, 7);
        renderCalendario(iso);
    });

    reservaForm.querySelectorAll('input[name="sede"]').forEach(radio => {
        radio.addEventListener('change', () => {
            reserva.sede = radio.value;
            const lim = SEDES[radio.value];
            if (reservaPersonas && lim) {
                reservaPersonas.min = lim.min;
                reservaPersonas.max = lim.max;
                reservaPersonas.placeholder = `${lim.min} a ${lim.max}`;
            }
            const soltada = soltarFechaSiNoSirve(`Ese día ya está reservado en ${lim?.nombre}. Elige otro.`);
            renderCalendario();
            if (!soltada) pintarTextoFecha();
        });
    });

    reservaForm.addEventListener('submit', enviarReserva);
}
