// Página de reservas: maneja los pasos y el DOM. Los formatos, el calendario y la red
// viven en reservas-comun.js (con pruebas); aquí solo se arma el recorrido del cliente.

(function () {
    'use strict';

    var PERSONAS_TOPE_UI = 60; // arriba del máximo de la sede se atiende por WhatsApp
    var MESES_ADELANTE = 3;
    var PASOS = 5;
    var CONSULTA_CADA_MS = 4000;
    var CONSULTA_HASTA_MS = 120000;
    var BORRADOR = 'uf_reserva_borrador';
    var APARTADO = 'uf_reserva_apartado';

    var $ = function (id) { return document.getElementById(id); };
    var hoy = hoyBogota();
    var mesActual = hoy.slice(0, 7);
    var mesTope = sumarMeses(mesActual, MESES_ADELANTE);

    var estado = {
        sede: 'ELCARMEN', personas: REGLAS_POR_DEFECTO.grupo_min, mes: mesActual, fecha: '', hora: '', espacio: '',
        datos: {}, paso: 1
    };
    // Cada carga de red guarda su número; si el cliente ya cambió de opción, la respuesta vieja se descarta.
    var carga = { dias: 0, horas: 0 };
    // Meses ya pedidos (sede|personas|mes -> promesa). El Apps Script tarda unos segundos en responder,
    // así que se piden por adelantado mientras el cliente elige sede y personas, y traen las horas de
    // cada día. Duran poco: los cupos cambian, y al crear la reserva el servidor vuelve a revisar todo.
    var MESES_VIGENCIA_MS = 90000;
    var meses = {};
    var temporizadorPrecarga = 0;

    function pedirMes(sede, personas, mes) {
        var clave = sede + '|' + personas + '|' + mes;
        var guardado = meses[clave];
        if (guardado && Date.now() - guardado.en < MESES_VIGENCIA_MS) return guardado.promesa;
        var promesa = apiGet({ accion: 'dias', sede: sede, mes: mes, personas: personas }).then(function (r) {
            if (!r.ok) delete meses[clave]; // un error no se guarda: el próximo intento vuelve a preguntar
            return r;
        });
        meses[clave] = { en: Date.now(), promesa: promesa };
        return promesa;
    }

    function olvidarMeses() { meses = {}; }

    // Pide el mes actual y el siguiente sin bloquear nada; se espera un momento por si sigue cambiando personas.
    function precargarMeses() {
        clearTimeout(temporizadorPrecarga);
        if (estado.personas > maxPersonasReserva(estado.sede, reglas)) return;
        temporizadorPrecarga = setTimeout(function () {
            pedirMes(estado.sede, estado.personas, estado.mes).then(function () {
                if (estado.mes < mesTope) pedirMes(estado.sede, estado.personas, sumarMeses(estado.mes, 1));
            });
        }, 400);
    }
    // Adelanto, cancelación, duración y límites de grupo: los de Config llegan con los días; antes, los de respaldo.
    var reglas = combinarReglas();

    function mayuscula(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

    function enlaceWhatsApp(sede, texto) {
        return 'https://wa.me/' + SEDES_RESERVA[sede].whatsapp + '?text=' + encodeURIComponent(texto);
    }

    function botonWhatsApp(sede, texto, etiqueta) {
        return '<a class="boton wa" target="_blank" rel="noopener" href="' + escapeHtml(enlaceWhatsApp(sede, texto)) + '">' +
            escapeHtml(etiqueta) + '</a>';
    }

    // ---------- Errores ----------

    function mostrarError(codigo) {
        var caja = $('error');
        caja.textContent = MENSAJES_ERROR[codigo] || MENSAJES_ERROR.INTERNO;
        caja.hidden = false;
    }

    function limpiarError() { $('error').hidden = true; }

    // ---------- Pasos ----------

    function irAPaso(n) {
        estado.paso = n;
        limpiarError();
        document.querySelectorAll('[data-paso]').forEach(function (s) {
            s.hidden = Number(s.getAttribute('data-paso')) !== n;
        });
        $('atras').hidden = n === 1;
        $('progreso').textContent = 'Paso ' + n + ' de ' + PASOS;
        var titulo = document.querySelector('[data-paso="' + n + '"] h1, [data-paso="' + n + '"] h2');
        if (titulo) { titulo.setAttribute('tabindex', '-1'); titulo.focus({ preventScroll: true }); }
        window.scrollTo(0, 0);
        if (n === 2) cargarDias();
        if (n === 3) cargarHoras();
        if (n === 5) pintarResumen();
    }

    // ---------- Paso 1: sede y personas ----------

    function etiquetaEspacio() {
        return NOMBRE_ESPACIO[espacioReserva(estado.sede, estado.personas, reglas)] || '';
    }

    function aplicarReglas(r) {
        reglas = combinarReglas(r);
        $('textoAceptaPolitica').textContent = 'Acepto la política de la reserva: el adelanto se descuenta de mi cuenta y no se devuelve si cancelo con menos de ' +
            reglas.cancelacion_horas + ' horas o no llego.';
        $('aviso24').textContent = 'Faltan menos de ' + reglas.cancelacion_horas + ' horas para tu reserva: si cancelas, este adelanto no se devuelve.';
    }

    function pintarSedes() {
        $('sedes').innerHTML = Object.keys(SEDES_RESERVA).map(function (k) {
            return '<button type="button" class="opcion" data-sede="' + k + '" aria-pressed="' + (k === estado.sede) + '">' +
                escapeHtml(SEDES_RESERVA[k].nombre) + '</button>';
        }).join('');
    }

    function pintarPersonas() {
        var max = maxPersonasReserva(estado.sede, reglas);
        var grande = estado.personas > max;
        $('personas').textContent = estado.personas;
        $('menos').disabled = estado.personas <= reglas.grupo_min;
        $('mas').disabled = estado.personas >= PERSONAS_TOPE_UI;
        $('espacio').textContent = grande ? '' : 'Lugar: ' + etiquetaEspacio() + ' · la reserva es por ' + textoDuracion(reglas.duracion_min);
        $('a2').hidden = grande;
        var tarjeta = $('grupo');
        tarjeta.hidden = !grande;
        if (grande) {
            tarjeta.innerHTML = '<b>Grupos de más de ' + max + ' personas</b><br>' +
                'Los atendemos directamente por WhatsApp para preparar todo a tu medida.' +
                botonWhatsApp(estado.sede, 'Hola Urban Food, quiero reservar para ' + estado.personas + ' personas',
                    'Escribir a ' + SEDES_RESERVA[estado.sede].nombre + ' por WhatsApp');
        }
    }

    $('sedes').addEventListener('click', function (e) {
        var b = e.target.closest('[data-sede]');
        if (!b) return;
        estado.sede = b.getAttribute('data-sede');
        estado.fecha = ''; estado.hora = '';
        pintarSedes(); pintarPersonas();
        precargarMeses();
    });
    $('menos').addEventListener('click', function () { cambiarPersonas(-1); });
    $('mas').addEventListener('click', function () { cambiarPersonas(1); });
    function cambiarPersonas(delta) {
        estado.personas = Math.min(PERSONAS_TOPE_UI, Math.max(reglas.grupo_min, estado.personas + delta));
        estado.fecha = ''; estado.hora = '';
        pintarPersonas();
        precargarMeses();
    }
    $('a2').addEventListener('click', function () { irAPaso(2); });

    // ---------- Paso 2: calendario ----------

    var diasDelMes = {}; // fecha -> disponible
    var horasDelMes = {}; // fecha -> [{ hora, libre }], llegan con los días

    function pintarCalendario(cargando) {
        $('mesNombre').textContent = nombreMes(estado.mes);
        $('mesAnt').disabled = estado.mes <= mesActual;
        $('mesSig').disabled = estado.mes >= mesTope;
        var html = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(function (d) { return '<span class="cab">' + d + '</span>'; }).join('');
        cuadriculaMes(estado.mes).forEach(function (f) {
            if (!f) { html += '<span></span>'; return; }
            var libre = !cargando && f >= hoy && diasDelMes[f] === true;
            html += '<button type="button" data-fecha="' + f + '"' + (libre ? '' : ' disabled') +
                ' aria-pressed="' + (f === estado.fecha) + '" aria-label="' + escapeHtml(formatoFechaLarga(f)) + '">' +
                Number(f.slice(8)) + '</button>';
        });
        $('cal').innerHTML = html;
        $('cal').setAttribute('aria-busy', cargando ? 'true' : 'false');
        // Mientras llegan los cupos todos los días salen apagados: sin este aviso parecía que no había ninguno.
        $('calCargando').hidden = !cargando;
    }

    function cargarDias() {
        var mia = ++carga.dias;
        diasDelMes = {}; horasDelMes = {};
        pintarCalendario(true);
        pedirMes(estado.sede, estado.personas, estado.mes).then(function (r) {
            if (mia !== carga.dias || estado.paso !== 2) return;
            if (!r.ok) {
                $('calCargando').hidden = true;
                if (r.error === 'GRUPO_GRANDE' || r.error === 'PERSONAS') { irAPaso(1); }
                mostrarError(r.error);
                return;
            }
            r.dias.forEach(function (d) {
                diasDelMes[d.fecha] = d.disponible;
                if (d.horas) horasDelMes[d.fecha] = d.horas;
            });
            if (r.espacio) estado.espacio = r.espacio;
            if (r.reglas) aplicarReglas(r.reglas);
            pintarCalendario(false);
            // Deja listo el mes siguiente por si el cliente avanza con la flecha.
            if (estado.mes < mesTope) pedirMes(estado.sede, estado.personas, sumarMeses(estado.mes, 1));
        });
    }

    $('mesAnt').addEventListener('click', function () { cambiarMes(-1); });
    $('mesSig').addEventListener('click', function () { cambiarMes(1); });
    function cambiarMes(n) {
        var nuevo = sumarMeses(estado.mes, n);
        if (nuevo < mesActual || nuevo > mesTope) return;
        estado.mes = nuevo;
        cargarDias();
    }

    $('cal').addEventListener('click', function (e) {
        var b = e.target.closest('[data-fecha]');
        if (!b || b.disabled) return;
        if (estado.fecha !== b.getAttribute('data-fecha')) estado.hora = '';
        estado.fecha = b.getAttribute('data-fecha');
        irAPaso(3);
    });

    // ---------- Paso 3: hora ----------

    function pintarHoras(horas) {
        var libres = horas.filter(function (h) { return h.libre; }).map(function (h) { return h.hora; });
        if (libres.indexOf(estado.hora) === -1) estado.hora = '';
        $('horas').innerHTML = horas.map(function (h) {
            return '<button type="button" data-hora="' + h.hora + '"' + (h.libre ? '' : ' disabled') +
                ' aria-pressed="' + (h.hora === estado.hora) + '">' + formatoHora(h.hora) +
                (notaMadrugada(h.hora) ? '<small class="block text-xs text-white/60">(' + notaMadrugada(h.hora) + ')</small>' : '') + '</button>';
        }).join('');
        $('a4').disabled = !estado.hora;
    }

    function cargarHoras() {
        var mia = ++carga.horas;
        $('tituloHoras').textContent = mayuscula(formatoFechaLarga(estado.fecha)) + ' · ' + estado.personas + ' personas';
        // Lo normal: las horas llegaron con los días y se muestran sin esperar.
        if (horasDelMes[estado.fecha]) { pintarPersonas(); pintarHoras(horasDelMes[estado.fecha]); return; }
        $('horas').innerHTML = '<p class="cargando">Buscando horas…</p>';
        $('a4').disabled = true;
        apiGet({ accion: 'horas', sede: estado.sede, fecha: estado.fecha, personas: estado.personas }).then(function (r) {
            if (mia !== carga.horas || estado.paso !== 3) return;
            if (!r.ok) { $('horas').innerHTML = ''; mostrarError(r.error); return; }
            estado.espacio = r.espacio;
            aplicarReglas(r.reglas);
            pintarPersonas();
            pintarHoras(r.horas);
        });
    }

    $('horas').addEventListener('click', function (e) {
        var b = e.target.closest('[data-hora]');
        if (!b || b.disabled) return;
        estado.hora = b.getAttribute('data-hora');
        $('horas').querySelectorAll('[data-hora]').forEach(function (x) {
            x.setAttribute('aria-pressed', String(x === b));
        });
        $('a4').disabled = false;
    });
    $('a4').addEventListener('click', function () { if (estado.hora) irAPaso(4); });

    // ---------- Paso 4: datos ----------

    var CAMPOS = ['nombre', 'tipo_doc', 'documento', 'correo', 'celular', 'comentario'];

    function leerDatos() {
        var d = {};
        CAMPOS.forEach(function (k) { d[k] = $(k).value.trim(); });
        return d;
    }

    function llenarDatos(d) {
        CAMPOS.forEach(function (k) { if (d && d[k] !== undefined) $(k).value = d[k]; });
    }

    // Revisión rápida para no gastar un viaje al servidor; el servidor vuelve a validar todo.
    function errorDeDatos(d) {
        if (d.nombre.length < 3) return 'NOMBRE';
        if (d.documento.replace(/[.\s\-]/g, '').length < 5) return 'DOCUMENTO';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.correo)) return 'CORREO';
        if (!/^\d{10}$/.test(d.celular.replace(/[\s\-().]/g, '').replace(/^\+57/, ''))) return 'CELULAR';
        if (!$('acepta_datos').checked || !$('acepta_politica').checked) return 'AUTORIZACION';
        return '';
    }

    $('datos').addEventListener('submit', function (e) {
        e.preventDefault();
        var d = leerDatos();
        var falla = errorDeDatos(d);
        if (falla) { mostrarError(falla); return; }
        estado.datos = d;
        irAPaso(5);
    });

    // ---------- Paso 5: resumen y pago ----------

    function pintarResumen() {
        var sede = SEDES_RESERVA[estado.sede];
        $('resumen').innerHTML =
            escapeHtml(sede.nombre) + ' · ' + escapeHtml(etiquetaEspacio()) + ' · por ' + escapeHtml(textoDuracion(reglas.duracion_min)) + '<br>' +
            '<b>' + escapeHtml(mayuscula(formatoFechaLarga(estado.fecha))) + ', ' + escapeHtml(etiquetaHoraServicio(estado.fecha, estado.hora)) + '</b><br>' +
            estado.personas + ' personas · ' + escapeHtml(estado.datos.nombre) + '<br>' +
            'Adelanto: <b>' + formatoPesos(reglas.adelanto) + '</b> <span style="color:#9a9a9a">(se descuenta de tu cuenta)</span>';
        $('politica').textContent = textoPolitica(reglas);
        $('aviso24').hidden = instanteReserva(estado.fecha, estado.hora) - Date.now() >= reglas.cancelacion_horas * 3600000;
        $('pagar').textContent = 'Pagar ' + formatoPesos(reglas.adelanto);
        $('pagar').disabled = false;
    }

    function guardarBorrador() {
        try {
            sessionStorage.setItem(BORRADOR, JSON.stringify({
                sede: estado.sede, personas: estado.personas, fecha: estado.fecha, hora: estado.hora, datos: estado.datos
            }));
        } catch (e) { /* sin almacenamiento: "Intentar de nuevo" empezará con campos vacíos */ }
    }

    function leerBorrador() {
        try { return JSON.parse(sessionStorage.getItem(BORRADOR)) || null; } catch (e) { return null; }
    }

    // Último apartado creado en esta pestaña: { codigo, url_pago, firma }.
    function guardarApartado(a) {
        try { sessionStorage.setItem(APARTADO, JSON.stringify(a)); } catch (e) { /* sin almacenamiento: el servidor crea otro */ }
    }

    function leerApartado() {
        try { return JSON.parse(sessionStorage.getItem(APARTADO)) || null; } catch (e) { return null; }
    }

    $('pagar').addEventListener('click', function () {
        var boton = $('pagar');
        if (boton.disabled) return;
        boton.disabled = true; // un segundo clic no crea otra reserva
        limpiarError();
        var d = estado.datos;
        guardarBorrador();
        var firma = firmaApartado({ sede: estado.sede, fecha: estado.fecha, hora: estado.hora, personas: estado.personas, correo: d.correo });
        var previo = leerApartado();
        var cuerpo = {
            accion: 'crear', sede: estado.sede, personas: estado.personas, fecha: estado.fecha, hora: estado.hora,
            nombre: d.nombre, tipo_doc: d.tipo_doc, documento: d.documento, correo: d.correo, celular: d.celular,
            comentario: d.comentario, acepta_datos: true, acepta_politica: true,
            website: $('website').value
        };
        // Volvió de Bold con Atrás y paga lo mismo: el servidor devuelve ese apartado si sigue vigente.
        if (previo && previo.firma === firma && previo.codigo) cuerpo.codigo_previo = previo.codigo;
        apiPost(cuerpo).then(function (r) {
            if (r.ok && r.url_pago) {
                guardarApartado({ codigo: r.codigo, url_pago: r.url_pago, firma: firma });
                window.location.href = r.url_pago;
                return;
            }
            boton.disabled = false;
            if (r.ok) { mostrarError('INTERNO'); return; }
            if (r.error === 'SIN_CUPO') { olvidarMeses(); delete horasDelMes[estado.fecha]; irAPaso(3); mostrarError('SIN_CUPO'); return; }
            if (r.error === 'GRUPO_GRANDE' || r.error === 'PERSONAS') { irAPaso(1); }
            mostrarError(r.error);
        });
    });

    // Al volver con Atrás desde Bold el navegador restaura la página tal cual (bfcache): el botón seguía apagado.
    window.addEventListener('pageshow', function (e) {
        if (e.persisted && estado.paso === 5) $('pagar').disabled = false;
    });

    $('atras').addEventListener('click', function () { if (estado.paso > 1) irAPaso(estado.paso - 1); });

    // ---------- Paso 6: confirmación ----------

    function resumenReserva(r) {
        var sede = SEDES_RESERVA[r.sede] || { nombre: r.sede, direccion: '' };
        return '<div class="tarjeta mt-3">' + escapeHtml(sede.nombre) + ' · ' + escapeHtml(sede.direccion) + '<br>' +
            '<b>' + escapeHtml(mayuscula(formatoFechaLarga(r.fecha))) + ' · ' + escapeHtml(etiquetaHoraServicio(r.fecha, r.hora)) + ' · ' +
            escapeHtml(r.personas) + ' personas</b><br>' +
            escapeHtml(NOMBRE_ESPACIO[r.espacio] || '') + ' · por ' + escapeHtml(textoDuracion(reglas.duracion_min)) + '<br>' +
            'A nombre de ' + escapeHtml(r.nombre_corto) + '</div>';
    }

    function vistaConfirmacion(html) {
        var c = $('confirmacion');
        c.innerHTML = html;
        c.hidden = false;
        var h = c.querySelector('h1');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }

    function volverAIntentar(r) {
        var b = leerBorrador();
        if (b) {
            estado.sede = b.sede; estado.personas = b.personas; estado.fecha = b.fecha; estado.hora = b.hora; estado.datos = b.datos || {};
        } else if (r) {
            estado.sede = r.sede; estado.personas = r.personas; estado.fecha = r.fecha; estado.hora = r.hora;
        }
        estado.mes = estado.fecha ? estado.fecha.slice(0, 7) : mesActual;
        if (estado.mes < mesActual || estado.mes > mesTope) estado.mes = mesActual;
        llenarDatos(estado.datos);
        // Quita ?codigo= pero conserva ?api=local.
        history.replaceState(null, '', location.pathname + (modoLocal() ? '?api=local' : ''));
        $('confirmacion').hidden = true;
        $('confirmacion').innerHTML = '';
        mostrarApp();
        pintarSedes(); pintarPersonas();
        irAPaso(1);
    }

    function mostrarConfirmacion(codigo) {
        var inicio = Date.now();

        function pintar(r) {
            if (r.estado === 'CONFIRMADA' || r.estado === 'LLEGO') {
                var sede = SEDES_RESERVA[r.sede];
                vistaConfirmacion(
                    '<div class="icono bg-fresh-teal" aria-hidden="true">✓</div>' +
                    '<h1 class="titulo text-3xl text-center">¡Reserva confirmada!</h1>' +
                    '<div class="codigo">' + escapeHtml(r.codigo) + '</div>' +
                    resumenReserva(r) +
                    '<p class="nota">Te enviamos este resumen a tu correo. Muestra el código al llegar.</p>' +
                    '<a class="boton boton-sec" target="_blank" rel="noopener" href="' + escapeHtml(enlaceCalendario(r, reglas.duracion_min)) + '">Agregar a mi calendario</a>' +
                    '<a class="boton boton-sec" target="_blank" rel="noopener" href="' + escapeHtml(sede.mapa) + '">Cómo llegar</a>');
            } else if (r.estado === 'RECHAZADA' || r.estado === 'EXPIRADA') {
                var texto = r.estado === 'RECHAZADA' ? 'No se pudo completar tu pago.' : 'El tiempo para pagar se agotó y liberamos el horario.';
                vistaConfirmacion(
                    '<h1 class="titulo text-3xl mt-4">' + escapeHtml(texto) + '</h1>' +
                    '<p class="nota">No se hizo ningún cobro por esta reserva. Puedes intentarlo de nuevo con tus datos ya llenos.</p>' +
                    '<button type="button" class="boton" id="reintentar">Intentar de nuevo</button>');
                $('reintentar').addEventListener('click', function () { volverAIntentar(r); });
            } else if (r.estado === 'PAGO_SIN_CUPO') {
                vistaConfirmacion(
                    '<h1 class="titulo text-3xl mt-4">Recibimos tu pago, pero el horario se ocupó</h1>' +
                    '<p class="tarjeta mt-3">Te escribiremos para devolverte el dinero. Si quieres, reserva otro horario.</p>' +
                    botonWhatsApp(r.sede, 'Hola Urban Food, mi reserva ' + r.codigo + ' quedó sin cupo', 'Escribirnos por WhatsApp') +
                    '<button type="button" class="boton boton-sec" id="reintentar">Reservar otro horario</button>');
                $('reintentar').addEventListener('click', function () { volverAIntentar(r); });
            } else if (r.estado === 'PENDIENTE_PAGO') {
                esperar(r);
            } else {
                vistaConfirmacion('<h1 class="titulo text-3xl mt-4">Esta reserva ya no está activa</h1>' + resumenReserva(r) +
                    '<a class="boton boton-sec" href="./">Hacer una nueva reserva</a>');
            }
        }

        function esperar(r) {
            if (Date.now() - inicio > CONSULTA_HASTA_MS) {
                vistaConfirmacion(
                    '<h1 class="titulo text-3xl mt-4">Aún no vemos tu pago</h1>' +
                    '<p class="tarjeta mt-3">Si ya pagaste, en unos minutos recibirás la confirmación en tu correo. Tu código es <b>' +
                    escapeHtml(codigo) + '</b>.</p>' +
                    '<button type="button" class="boton" id="revisar">Revisar de nuevo</button>' +
                    botonWhatsApp(r.sede, 'Hola Urban Food, pagué mi reserva ' + codigo + ' y no me ha llegado la confirmación', 'Escribirnos por WhatsApp'));
                $('revisar').addEventListener('click', function () { mostrarConfirmacion(codigo); });
                return;
            }
            vistaConfirmacion('<h1 class="titulo text-3xl mt-4">Estamos confirmando tu pago…</h1>' +
                '<p class="cargando">No cierres esta página. Puede tardar unos segundos.</p>');
            setTimeout(consultar, CONSULTA_CADA_MS);
        }

        function consultar() {
            apiGet({ accion: 'estado', codigo: codigo }).then(function (r) {
                if (r.ok) { reglas = combinarReglas(r.reglas); pintar(r.reserva); return; }
                if (r.error === 'NO_ENCONTRADA') {
                    vistaConfirmacion('<h1 class="titulo text-3xl mt-4">No encontramos esa reserva</h1>' +
                        '<a class="boton boton-sec" href="./">Hacer una reserva</a>');
                    return;
                }
                // Error de red o del servidor: se sigue intentando hasta agotar el tiempo.
                if (Date.now() - inicio > CONSULTA_HASTA_MS) {
                    vistaConfirmacion('<h1 class="titulo text-3xl mt-4">No pudimos revisar tu pago</h1>' +
                        '<p class="tarjeta mt-3">' + escapeHtml(MENSAJES_ERROR[r.error] || MENSAJES_ERROR.INTERNO) + ' Tu código es <b>' + escapeHtml(codigo) + '</b>.</p>' +
                        '<button type="button" class="boton" id="revisar">Revisar de nuevo</button>');
                    $('revisar').addEventListener('click', function () { mostrarConfirmacion(codigo); });
                    return;
                }
                setTimeout(consultar, CONSULTA_CADA_MS);
            });
        }

        $('app').hidden = true;
        vistaConfirmacion('<h1 class="titulo text-3xl mt-4">Estamos confirmando tu pago…</h1>' +
            '<p class="cargando">No cierres esta página. Puede tardar unos segundos.</p>');
        consultar();
    }

    // ---------- Arranque ----------

    function mostrarApp() { $('app').hidden = false; }

    function mostrarProximamente() {
        $('pronto').hidden = false;
        $('prontoWa').innerHTML = Object.keys(SEDES_RESERVA).map(function (k) {
            return botonWhatsApp(k, 'Hola Urban Food, quiero hacer una reserva', 'Reservar en ' + SEDES_RESERVA[k].nombre + ' por WhatsApp');
        }).join('');
    }

    function iniciar() {
        if (!apiDisponible()) { mostrarProximamente(); return; }
        var codigo = codigoDeUrl(location.search);
        pintarSedes(); pintarPersonas();
        if (codigo) { mostrarConfirmacion(codigo); return; }
        mostrarApp();
        irAPaso(1);
        precargarMeses();
    }

    iniciar();
})();
