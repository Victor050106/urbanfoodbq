// Cancelación por el enlace del correo: ?t=<token>. Dos pasos en la misma página, sin confirm() del navegador.
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var token = new URLSearchParams(location.search).get('t') || '';
    // Adelanto y horas de cancelación de Config; llegan con la reserva, mientras tanto los de respaldo.
    var reglas = combinarReglas();

    function mostrar(html) {
        $('cargando').hidden = true;
        $('vista').innerHTML = html;
        $('vista').hidden = false;
    }

    function enlaceWa(sede) {
        var s = SEDES_RESERVA[sede];
        return s ? '<a class="boton wa" target="_blank" rel="noopener" href="https://wa.me/' + escapeHtml(s.whatsapp) + '">Escribir a ' + escapeHtml(s.nombre) + ' por WhatsApp</a>' : '';
    }

    function aviso(titulo, texto, sede) {
        mostrar('<h1 class="titulo text-3xl mt-4">' + escapeHtml(titulo) + '</h1><div class="tarjeta mt-3">' + escapeHtml(texto) + '</div>' + (sede ? enlaceWa(sede) : '') +
            '<a class="boton boton-sec" href="../">Ir a reservas</a>');
    }

    function resumen(r) {
        var sede = SEDES_RESERVA[r.sede] || { nombre: r.sede };
        return '<div class="tarjeta mt-3">' +
            '<b>' + escapeHtml(sede.nombre) + '</b> · ' + (r.espacio === 'VIP' ? 'Salón VIP' : 'Mesa') + '<br>' +
            escapeHtml(formatoFechaLarga(r.fecha)) + ' · ' + escapeHtml(etiquetaHoraServicio(r.fecha, r.hora)) + '<br>' +
            escapeHtml(r.personas) + ' personas · a nombre de ' + escapeHtml(r.nombre_corto) + '<br>' +
            'Código <b>' + escapeHtml(r.codigo) + '</b></div>';
    }

    function textoDevolucion(con) {
        return con ? 'Te devolveremos los ' + formatoPesos(reglas.adelanto) + '.'
            : 'Como faltan menos de ' + reglas.cancelacion_horas + ' horas, el adelanto no se devuelve.';
    }

    function paso1(d) {
        mostrar('<h1 class="titulo text-3xl mt-4">Cancelar reserva</h1>' + resumen(d.reserva) +
            '<p class="tarjeta mt-3">' + escapeHtml(textoDevolucion(d.conDevolucion)) + '</p>' +
            '<button type="button" class="boton" id="cancelar">Cancelar reserva</button>' +
            '<a class="boton boton-sec" href="../">Mantener mi reserva</a>');
        $('cancelar').addEventListener('click', function () { paso2(d); });
    }

    function paso2(d) {
        mostrar('<h1 class="titulo text-3xl mt-4">¿Seguro que quieres cancelar?</h1>' + resumen(d.reserva) +
            '<p class="tarjeta mt-3">' + escapeHtml(textoDevolucion(d.conDevolucion)) + '</p>' +
            '<div id="error" class="error" role="alert" hidden></div>' +
            '<button type="button" class="boton" id="confirmar">Sí, cancelar mi reserva</button>' +
            '<button type="button" class="boton boton-sec" id="volver">No, volver</button>');
        $('volver').addEventListener('click', function () { paso1(d); });
        $('confirmar').addEventListener('click', function () { enviar(); });
    }

    function enviar() {
        var b = $('confirmar');
        b.disabled = true; $('volver').disabled = true;
        b.textContent = 'Cancelando…';
        apiPost({ accion: 'cancelar', t: token }).then(function (r) {
            // El estado final sale de la respuesta, no de lo que se mostró antes.
            if (r.ok) { cancelada(r.conDevolucion); return; }
            // La respuesta se puede perder aunque la cancelación sí se hizo (pasó el 22/10/2026):
            // antes de mostrar un error se vuelve a leer la reserva.
            apiGet({ accion: 'cancelacion', t: token }).then(function (d) {
                if (d.ok && esCancelada(d.reserva)) { reglas = combinarReglas(d.reglas); cancelada(d.reserva.estado === 'CANCELADA_CON_DEVOLUCION'); return; }
                // Cambió mientras decidía (ya pasó, ya no existe): se muestra el estado real.
                if ((d.ok && !d.puede) || d.error === 'NO_ENCONTRADA') { pintar(d); return; }
                b.disabled = false; $('volver').disabled = false;
                b.textContent = 'Sí, cancelar mi reserva';
                var e = $('error');
                e.textContent = MENSAJES_ERROR[r.error] || MENSAJES_ERROR.INTERNO;
                e.hidden = false;
            });
        });
    }

    function esCancelada(r) { return String(r.estado).indexOf('CANCELADA') === 0; }

    function cancelada(conDevolucion) {
        mostrar('<div class="icono" style="background:#1ABC9C">&#10003;</div><h1 class="titulo text-3xl text-center">Reserva cancelada</h1>' +
            '<div class="tarjeta mt-3">' + escapeHtml(textoDevolucion(conDevolucion)) + ' Te enviamos un correo con el detalle.</div>' +
            '<a class="boton boton-sec" href="../">Hacer otra reserva</a>');
    }

    function cargar() {
        if (!token) { aviso('Enlace no válido', 'Este enlace no es válido. Usa el botón del correo de tu reserva.'); return; }
        apiGet({ accion: 'cancelacion', t: token }).then(pintar);
    }

    function pintar(d) {
        if (!d.ok) {
            if (d.error === 'NO_ENCONTRADA' || d.error === 'PARAMETROS') aviso('Enlace no válido', 'No encontramos esa reserva. Revisa que abriste el enlace completo del correo.');
            else aviso('No pudimos cargar tu reserva', MENSAJES_ERROR[d.error] || MENSAJES_ERROR.INTERNO);
            return;
        }
        reglas = combinarReglas(d.reglas);
        var r = d.reserva;
        if (d.puede) { paso1(d); return; }
        if (esCancelada(r)) { aviso('Esta reserva ya estaba cancelada', 'Ya cancelaste la reserva ' + r.codigo + '. No tienes que hacer nada más.'); return; }
        if (r.estado === 'CONFIRMADA' || r.estado === 'LLEGO' || r.estado === 'NO_LLEGO') { aviso('Esta reserva ya pasó', 'La hora de la reserva ' + r.codigo + ' ya pasó, por eso no se puede cancelar aquí.', r.sede); return; }
        aviso('Esta reserva no se puede cancelar', 'La reserva ' + r.codigo + ' no está activa. Si tienes dudas, escríbenos por WhatsApp.', r.sede);
    }

    if (!apiDisponible()) {
        $('cargando').hidden = true;
        $('pronto').hidden = false;
        $('prontoTxt').textContent = 'La gestión de reservas en línea estará disponible muy pronto. Mientras tanto, escríbenos por WhatsApp.';
        $('prontoWa').innerHTML = Object.keys(SEDES_RESERVA).map(function (k) { return enlaceWa(k); }).join('');
    } else {
        cargar();
    }
})();
