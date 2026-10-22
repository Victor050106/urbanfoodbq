// Pantalla de la cajera: ingreso por sede + clave y lista de reservas. Los helpers de orden y fechas
// están en reservas-comun.js. Todo valor que viene del API se escapa antes de pintarse.
(function () {
    'use strict';

    var CLAVE_TOKEN = 'uf_panel_token';
    var CLAVE_SEDE = 'uf_panel_sede';
    var REFRESCO_MS = 3 * 60000;

    var $ = function (id) { return document.getElementById(id); };
    var estado = { token: '', sede: 'ELCARMEN', vista: 'hoy', reservas: [], enVuelo: 0, carga: 0, temporizador: null, reglas: combinarReglas() };

    function leer(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
    function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento: se pide la clave cada vez */ } }
    function borrar(k) { try { localStorage.removeItem(k); } catch (e) { /* nada que borrar */ } }

    function show(id, v) { $(id).hidden = !v; }

    // ---------- Ingreso ----------

    function pintarSedes() {
        $('sedes').innerHTML = Object.keys(SEDES_RESERVA).map(function (k) {
            return '<button type="button" class="opcion" data-sede="' + escapeHtml(k) + '" aria-pressed="' + (k === estado.sede) + '">' + escapeHtml(SEDES_RESERVA[k].nombre) + '</button>';
        }).join('');
        Array.prototype.forEach.call($('sedes').querySelectorAll('button'), function (b) {
            b.addEventListener('click', function () { estado.sede = b.getAttribute('data-sede'); pintarSedes(); });
        });
    }

    function mostrarLogin(codigo) {
        detener();
        estado.token = '';
        show('vista', false); show('login', true); show('salir', false);
        var e = $('errorLogin');
        if (codigo) { e.textContent = MENSAJES_ERROR[codigo] || MENSAJES_ERROR.INTERNO; e.hidden = false; } else { e.hidden = true; }
        pintarSedes();
    }

    function cerrarSesion(codigo) {
        borrar(CLAVE_TOKEN);
        mostrarLogin(codigo);
    }

    function entrar(ev) {
        ev.preventDefault();
        var b = $('entrar');
        b.disabled = true;
        apiPost({ accion: 'panel_entrar', sede: estado.sede, clave: $('clave').value }).then(function (r) {
            b.disabled = false;
            if (!r.ok) { mostrarLogin(r.error); return; }
            $('clave').value = '';
            estado.token = r.token;
            guardar(CLAVE_TOKEN, r.token);
            guardar(CLAVE_SEDE, estado.sede);
            abrirVista();
        });
    }

    // ---------- Lista ----------

    function abrirVista() {
        // La sede del token manda sobre lo que haya en pantalla: se toma de la última sede usada al entrar.
        var s = leer(CLAVE_SEDE);
        if (SEDES_RESERVA[s]) estado.sede = s;
        show('login', false); show('vista', true); show('salir', true);
        $('tituloSede').textContent = SEDES_RESERVA[estado.sede].nombre;
        $('tituloFecha').textContent = formatoFechaLarga(fechaServicioBogota(Date.now()));
        $('lista').innerHTML = '<p class="cargando">Cargando…</p>';
        refrescar();
        detener();
        estado.temporizador = setInterval(refrescar, REFRESCO_MS);
    }

    function detener() { if (estado.temporizador) { clearInterval(estado.temporizador); estado.temporizador = null; } }

    function parametrosVista() {
        var hoy = fechaServicioBogota(Date.now());
        return estado.vista === 'hoy' ? { desde: hoy, dias: 1 } : { desde: sumarDiasFecha(hoy, 1), dias: 7 };
    }

    function refrescar() {
        // No se refresca con una marca en curso: la respuesta vieja podría pisar la tarjeta recién marcada.
        if (!estado.token || estado.enVuelo > 0) return;
        var n = ++estado.carga;
        var p = parametrosVista();
        apiPost({ accion: 'panel_listar', token: estado.token, desde: p.desde, dias: p.dias }).then(function (r) {
            if (n !== estado.carga || !estado.token || estado.enVuelo > 0) return;
            if (!r.ok) {
                if (r.error === 'TOKEN' || r.error === 'CONFIGURACION') { cerrarSesion(r.error); return; }
                var e = $('errorVista'); e.textContent = MENSAJES_ERROR[r.error] || MENSAJES_ERROR.INTERNO; e.hidden = false;
                return;
            }
            $('errorVista').hidden = true;
            $('tituloFecha').textContent = formatoFechaLarga(fechaServicioBogota(Date.now()));
            estado.reservas = r.reservas;
            estado.reglas = combinarReglas(r.reglas);
            if (SEDES_RESERVA[r.sede]) { estado.sede = r.sede; $('tituloSede').textContent = SEDES_RESERVA[r.sede].nombre; }
            pintar();
            var ahora = new Intl.DateTimeFormat('es-CO', { timeZone: TZ_RESERVAS, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
            $('actualizado').textContent = 'Actualizado ' + ahora;
        });
    }

    function tarjeta(r) {
        var cancelada = esCanceladaPanel(r);
        var clase = cancelada ? 'cancelada' : r.estado === 'LLEGO' ? 'llego' : r.estado === 'NO_LLEGO' ? 'no-llego' : '';
        var h = '<article class="res ' + clase + '" data-codigo="' + escapeHtml(r.codigo) + '">' +
            '<div class="flex items-center justify-between gap-3"><span class="hora">' + escapeHtml(formatoHora(r.hora)) +
            (notaMadrugada(r.hora) ? ' <small class="text-lg font-body text-white/70">(' + notaMadrugada(r.hora) + ')</small>' : '') + '</span>' +
            '<span class="etq ' + (r.espacio === 'VIP' ? 'vip' : '') + '">' + (r.espacio === 'VIP' ? 'VIP' : 'Mesa') + '</span></div>' +
            '<div class="nombre mt-1">' + escapeHtml(r.nombre) + ' · ' + escapeHtml(r.personas) + ' personas</div>' +
            '<div class="dato text-white/80">' + escapeHtml(r.tipo_doc) + ' ' + escapeHtml(r.documento) + ' · Cel. ' + escapeHtml(r.celular) + '</div>' +
            '<div class="dato text-white/60">Código ' + escapeHtml(r.codigo) + '</div>';
        if (r.comentario) h += '<div class="dato mt-1">&ldquo;' + escapeHtml(r.comentario) + '&rdquo;</div>';
        if (cancelada) {
            h += '<div class="dato mt-2 font-semibold">Cancelada' + (r.estado === 'CANCELADA_CON_DEVOLUCION' ? ' (con devolución)' : ' (sin devolución)') + '</div></article>';
            return h;
        }
        h += '<div class="dato mt-2 text-fresh-teal font-semibold">Adelanto pagado ' + escapeHtml(formatoPesos(r.adelanto || estado.reglas.adelanto)) + '</div>' +
            '<div class="acciones">' +
            '<button type="button" class="llego" data-marca="LLEGO" aria-pressed="' + (r.estado === 'LLEGO') + '">Llegó</button>' +
            '<button type="button" class="no" data-marca="NO_LLEGO" aria-pressed="' + (r.estado === 'NO_LLEGO') + '">No llegó</button>' +
            (r.descuento_aplicado === true ? '<div class="desc-ok">&#10003; Descuento aplicado en fu.do</div>'
                : '<button type="button" class="desc" data-marca="DESCUENTO">Descuento aplicado en fu.do</button>') +
            '</div><div class="error" role="alert" hidden></div></article>';
        return h;
    }

    function pintar() {
        var cont = $('lista');
        if (!estado.reservas.length) {
            cont.innerHTML = '<p class="tarjeta mt-4 text-lg">' + (estado.vista === 'hoy' ? 'No hay reservas para hoy.' : 'No hay reservas en los próximos 7 días.') + '</p>';
            return;
        }
        cont.innerHTML = agruparPorFecha(estado.reservas).map(function (g) {
            return (estado.vista === 'hoy' ? '' : '<h2 class="fecha-h">' + escapeHtml(formatoFechaLarga(g.fecha)) + '</h2>') +
                g.reservas.map(tarjeta).join('');
        }).join('');
    }

    // ---------- Marcas ----------

    function marcar(codigo, marca, art) {
        var botones = art.querySelectorAll('button');
        Array.prototype.forEach.call(botones, function (b) { b.disabled = true; });
        art.querySelector('.error').hidden = true;
        estado.enVuelo++;
        estado.carga++; // descarta cualquier lista pedida antes de esta marca
        apiPost({ accion: 'panel_marcar', token: estado.token, codigo: codigo, marca: marca }).then(function (r) {
            estado.enVuelo--;
            if (!r.ok) {
                if (r.error === 'TOKEN' || r.error === 'CONFIGURACION') { cerrarSesion(r.error); return; }
                if (!art.parentNode) { refrescar(); return; }
                Array.prototype.forEach.call(botones, function (b) { b.disabled = false; });
                var e = art.querySelector('.error'); e.textContent = MENSAJES_ERROR[r.error] || MENSAJES_ERROR.INTERNO; e.hidden = false;
                return;
            }
            // Solo se rehace esa tarjeta con la reserva que devolvió el servidor.
            estado.reservas = estado.reservas.map(function (x) { return x.codigo === codigo ? r.reserva : x; });
            // Si cambió de pestaña mientras se marcaba, la tarjeta ya no está; el refresco repinta la lista.
            if (art.parentNode) {
                var tmp = document.createElement('div');
                tmp.innerHTML = tarjeta(r.reserva);
                art.parentNode.replaceChild(tmp.firstChild, art);
            }
            if (estado.enVuelo === 0) refrescar();
        });
    }

    function alPulsar(ev) {
        var b = ev.target.closest ? ev.target.closest('button[data-marca]') : null;
        if (!b) return;
        var art = b.closest('article');
        marcar(art.getAttribute('data-codigo'), b.getAttribute('data-marca'), art);
    }

    function cambiarVista(v) {
        estado.vista = v;
        $('tabHoy').setAttribute('aria-pressed', String(v === 'hoy'));
        $('tabProx').setAttribute('aria-pressed', String(v === 'prox'));
        estado.reservas = [];
        $('lista').innerHTML = '<p class="cargando">Cargando…</p>';
        refrescar();
    }

    // ---------- Inicio ----------

    function iniciar() {
        if (!apiDisponible()) {
            $('pronto').hidden = false;
            $('prontoTxt').textContent = 'El panel de reservas estará disponible muy pronto, junto con las reservas en línea.';
            return;
        }
        var s = leer(CLAVE_SEDE);
        if (SEDES_RESERVA[s]) estado.sede = s;
        $('formLogin').addEventListener('submit', entrar);
        $('salir').addEventListener('click', function () { cerrarSesion(''); });
        $('lista').addEventListener('click', alPulsar);
        $('tabHoy').addEventListener('click', function () { cambiarVista('hoy'); });
        $('tabProx').addEventListener('click', function () { cambiarVista('prox'); });
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refrescar(); });
        estado.token = leer(CLAVE_TOKEN);
        if (estado.token) { abrirVista(); } else { mostrarLogin(''); }
    }

    iniciar();
})();
