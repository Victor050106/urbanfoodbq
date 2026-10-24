# Urban Food

Sitio web oficial de **Urban Food**, restaurante con dos sedes en Barranquilla y Soledad,
Colombia. Plataforma informativa y de marketing que dirige a los clientes a realizar pedidos
a través del sistema externo [fu.do](https://fu.do), que maneja **una carta por sede**:

| Sede | Dirección | Carta / pedidos |
|------|-----------|-----------------|
| El Carmen | Calle 53D # 19-06, Barranquilla | [menu.fu.do/urbanfoodbq](https://menu.fu.do/urbanfoodbq) |
| Hipódromo | Cra. 29 # 26-04, Soledad | [menu.fu.do/urbanfoodsl](https://menu.fu.do/urbanfoodsl) |

## Vista previa
<img width="1335" height="595" alt="image" src="https://github.com/user-attachments/assets/2cf29158-31e1-4996-bf35-669d31a662b7" />

Diseño oscuro con acentos en naranja (`#FF6B00`) y teal (`#1ABC9C`), pensado para un público
joven y urbano.

## Tecnologías

- HTML5 + Tailwind CSS 3, compilado a `assets/css/tailwind.css` (configuración en `tailwind.config.js`)
- `styles.css` para lo que Tailwind no cubre (sombra dura, fundidos, estados del mapa)
- JavaScript vanilla (sin frameworks ni build)
- Google Fonts — `Bebas Neue`, `Inter` y `Material Symbols`
- Google Maps (mapas embebidos, uno por sede)
- Datos estructurados JSON-LD (`Restaurant`) para resultados enriquecidos en Google
- WhatsApp, Facebook e Instagram (integración de redes sociales)
- [fu.do](https://fu.do) — plataforma de pedidos en línea (un menú por sede)

## Estructura del proyecto

```
Urban Food/
├── index.html            # Documento principal con todas las secciones + JSON-LD
├── robots.txt            # Indexación
├── sitemap.xml           # Mapa del sitio
├── assets/               # Todo lo que el sitio carga en el navegador
│   ├── css/tailwind.css  # Generado con `npm run css`: no se edita a mano
│   ├── css/styles.css    # Estilos que complementan a Tailwind
│   ├── js/               # Módulos ES nativos, uno por sección (sin build)
│   │   ├── main.js       # Arranque: inicia cada sección y hace la única petición a la hoja
│   │   ├── config.js     # Lo que se cambia a mano: horario, SEDES, URL del Apps Script
│   │   ├── api.js        # getJson contra el Apps Script de novedades
│   │   ├── modal.js      # Abrir, cerrar, Escape y foco atrapado, compartido por los modales
│   │   ├── fechas.js · util.js
│   │   ├── horario.js · nav.js · sedes.js · novedades.js
│   │   └── reservas.js · reservas-comun.js · panel.js · cancelar.js  # Páginas de /reservas/ (scripts clásicos)
│   ├── img/
│   │   ├── hero-pattern.webp # Textura de doodles del hero (~128 KB)
│   │   ├── mascota.webp      # Mascota de marca con transparencia (~113 KB)
│   │   ├── og-cover.jpg      # Imagen 1200x630 para WhatsApp / Facebook / X
│   │   ├── menu/             # 7 fotos de categorías, 800x800
│   │   └── novedades/        # Carátulas de las novedades
│   ├── video/                # Videos de las novedades (H.264, no se precargan)
│   └── brand/            # logo.png, logor.png, favicon.png, faviconr.png
├── reservas/             # Reservas en línea
│   ├── index.html        # Página para reservar (sede, día, hora, adelanto con Bold)
│   ├── cancelar/         # Cancelación con el enlace del correo (token), no con el código
│   └── panel/            # Panel de la cajera (no se indexa)
├── privacidad/           # Política de tratamiento de datos personales
├── apps-script/
│   ├── Code.gs           # Backend de novedades (Google Apps Script)
│   └── reservas/         # Backend de reservas (otro proyecto, hoja "Urban Food - Reservas")
├── tests/
│   ├── code-gs.test.js · e2e.js
│   └── reservas/         # Pruebas del backend de reservas + servidor local con Bold simulado
├── docs/                 # Documentos internos, NO se suben al repo
│   ├── PASOS-PARA-VICTOR.md
│   ├── PASOS-NOVEDADES.md
│   ├── PASOS-RESERVAS.md
│   └── Propuesta_Comercial_Urban_Food_BQ.docx
└── _source/              # Fuentes de diseño: el sitio NO las carga
    ├── banner.svg        # Arte original del banner (3,7 MB)
    ├── PersonajeUrbanFood.ai
    └── menuurban/        # Fotos originales de cámara (8-12 MB c/u)
```

> Regla simple: lo que el navegador descarga vive en `assets/`; lo que solo usamos nosotros
> vive en `docs/` o `_source/` y está en el `.gitignore` (salvo `banner.svg`, que sí se
> versiona por ser la fuente del arte del sitio).

> **Sobre las imágenes del hero:** el `banner.svg` original pesaba 3,7 MB (18 PNG incrustados)
> y se cargaba entero antes de que se viera nada. Se descompuso en `assets/img/hero-pattern.webp` +
> `assets/img/mascota.webp` (~240 KB entre las dos). Si algún día se rehace el arte, hay que
> volver a exportar esas dos piezas: el sitio ya no lee `banner.svg`.
>
> La mascota va como fondo CSS (`.mascota-art`) y no como `<img>`, y su `preload` lleva
> `media="(min-width: 1024px)"`: así los celulares, donde no se muestra, no la descargan.

## Funcionalidades

- **Navbar responsivo** con menú hamburguesa accesible (`aria-expanded`) y sombra al hacer scroll
- **Hero section** con la mascota de marca como protagonista y textura de doodles de fondo
- **Indicador "Abierto ahora / Cerrado"** en vivo, calculado en hora de Barranquilla
  (`America/Bogota`) y no en la del visitante. Contempla los cierres de madrugada
  (el sábado cierra a las 2 AM del domingo)
- **Sección de menú** con 12 categorías (Grill, Perros, Hamburguesas, Pizzas, Salchipapas, Sandwiches, Mazorcas, Salvajadas, Taco Pizza & Pinchos, Menú Infantil, Bebidas & Frappés, Adicionales)
- **Horario dinámico**: detecta el día actual y resalta sus horas automáticamente
- **Selector de sedes** (El Carmen / Hipódromo) con datos de contacto y mapa por sede
- **Selector de sede**: los botones de pedido, de carta y de WhatsApp abren un modal que
  pregunta a qué sede va la acción, porque cada una tiene su propio menú en fu.do y su propio
  número. Los links salen del objeto `SEDES` de `assets/js/config.js`: ahí se
  cambian, no en el HTML. Los botones siguen siendo `<a>` con el destino de El Carmen dentro,
  así que sin JavaScript llevan igual a un sitio válido
- **Contacto por sede**: cada sede tiene sus propios datos. En la sección **Sedes** van
  dirección, teléfono, enlace de pedidos y horario; el correo va solo en el pie de página,
  para no repetirlo dos veces en la misma página
- **Animaciones de scroll** (Intersection Observer), desactivadas si el sistema pide
  `prefers-reduced-motion`
- **Botón flotante de WhatsApp** con mensaje de pedido preescrito
- **Sección de novedades** alimentada desde la hoja de cálculo: el restaurante publica y
  retira anuncios (apertura de sede, promociones) sin tocar el código. Si no hay ninguna
  novedad vigente la sección no aparece, y cada una puede llevar fecha de vencimiento para
  retirarse sola. Admite video con carátula: el archivo solo se descarga al pulsar play
  (ver `docs/PASOS-NOVEDADES.md`)
- **Reservas en línea** con adelanto pagado en Bold (ver la sección [Reservas](#reservas))
- **Opiniones de Google**: una tarjeta por sede con su calificación y número de reseñas, y un
  botón a su ficha de Google Maps para leerlas o dejar una nueva (ver más abajo)
- **Accesibilidad**: etiquetas asociadas a sus campos, modal con foco atrapado y devuelto, y
  objetivos táctiles de 44 px

## Opiniones

La sección `#opiniones` de `index.html` es HTML fijo: no consulta ninguna API, así que carga
al instante y no tiene costo ni llaves. Las estrellas y el número de reseñas de cada sede
se copian a mano desde Google Maps (fecha de la última copia en el comentario de la sección);
conviene actualizarlos de vez en cuando. "Dejar una reseña" usa el enlace de "Pedir reseñas" del
Perfil de Negocio de cada sede (`g.page/r/.../review`); "Ver reseñas" abre su ficha por el `cid`
de Google Maps.

> Se descartó traer las reseñas con la API de Places: cuesta US$25 por cada 1.000 consultas
> (1.000 gratis al mes) y Google no permite guardar las reseñas en caché, así que cada visita
> pagaría una consulta.

## Novedades

`apps-script/Code.gs` lee la pestaña "Novedades" de la hoja y la página la consulta al
cargar. Después de modificar `Code.gs` hay que volver a desplegar el script:
Implementar > Administrar implementaciones > (lápiz) > Versión: Nueva versión > Implementar.

## Reservas

Los grupos de 6 personas o más reservan desde `/reservas/`, de lunes a jueves. El Carmen recibe hasta 2 reservas por día con 3 h o más entre una y otra; el Hipódromo, una por piso (primer piso hasta 16 personas, segundo hasta 30). Al cliente se le dice que la reserva es por 2 horas. El camino es: enlace
"Reservar" del sitio, página de reservas (sede, día, hora, datos), pago del adelanto en
Bold y confirmación con un código de reserva. Si cancelan con 24 horas o más de anticipación
se devuelve el adelanto.

- **Cajera:** revisa y marca las reservas del día (llegó / no llegó) en `/reservas/panel/`.
- **Administración:** todo queda en la hoja de Google **"Urban Food - Reservas"** (reservas
  y configuración: adelanto, días, cupos).
- **Datos personales:** la política está en `/privacidad/`; el formulario la enlaza.
- **Puesta en marcha:** los pasos de despliegue (Apps Script, llaves de Bold, claves de la
  cajera) están en `docs/PASOS-RESERVAS.md`. Es un documento interno y no se sube al repo.
  Las llaves y claves van en las Propiedades del script, nunca en el código. Mientras
  `RESERVAS_API_URL` (en `assets/js/reservas-comun.js`) esté vacía, la página muestra
  "disponibles muy pronto" con botones a WhatsApp.
- La franja de reservas con Urbi de la portada (`.franja-reserva` en `index.html`, solo en
  celular) repite el grupo mínimo y que el adelanto se descuenta: si cambian en la hoja Config,
  cambiarlos ahí también.

Para probar sin desplegar nada hay un servidor de desarrollo con Bold simulado:

```bash
node tests/reservas/servidor-local.js
```

y abrir [http://localhost:3000/reservas/?api=local](http://localhost:3000/reservas/?api=local)
(el puerto se cambia con la variable `PORT`). Ese mismo servidor sirve el resto del sitio, así
que también sirve para `npm run test:e2e`.

## Dirección del sitio (mientras no haya dominio)

El sitio se publica en GitHub Pages: **https://victor050106.github.io/urbanfoodbq/**. El dominio
`urbanfoodbq.com` todavía no está comprado, así que nada apunta a él: la celda `url_sitio` de la
hoja Config (vuelta desde Bold y enlace de cancelar de los correos), las etiquetas `canonical` /
`og:` / JSON-LD de `index.html`, `reservas/` y `privacidad/`, `robots.txt` y `sitemap.xml` usan la
dirección de GitHub Pages. El día que se compre el dominio hay que cambiarla en todos esos sitios
(un buscar y reemplazar) y en la celda `url_sitio`.

## Estilos (Tailwind)

Las clases de Tailwind no se generan en el navegador: `assets/css/tailwind.css` se compila una vez y se sube
al repo. **Después de usar una clase nueva** en el HTML o en `assets/js/` hay que regenerarlo, o esa clase
no tendrá estilo:

```bash
npm install   # la primera vez
npm run css
```

Los colores, fuentes y tamaños propios (`vibrant-orange`, `font-display`, `text-headline-lg`...) están en
`tailwind.config.js`, compartidos por todas las páginas.

## Correr localmente

Requiere [Node.js](https://nodejs.org) instalado.

```bash
npx serve . -l 3000
```

Luego abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### Pruebas

```bash
npm install
npm test           # reglas de los dos Apps Script, sin red ni navegador
npm run test:e2e   # la página completa; necesita el servidor corriendo en otra terminal
```

`tests/code-gs.test.js` ejecuta `apps-script/Code.gs` contra una hoja falsa en memoria:
qué novedades salen y que el script ya no acepte escrituras. `tests/reservas/` prueba el backend de las
reservas en línea (cupos, estados, Bold, correos, hoja) con servicios de Google falsos.
`tests/e2e.js` abre la página en Microsoft Edge (escritorio y celular) y revisa horario,
selector de sede, modales, tarjetas de Google, enlaces a reservas y áreas táctiles. Las capturas
quedan en `tests/shots/`.

## Información de contacto del restaurante

Cada sede atiende su propio teléfono, su propio correo y su propia carta.

| Dato | Sede El Carmen | Sede Hipódromo |
|------|----------------|----------------|
| Dirección | Calle 53D # 19-06, Barranquilla | Cra. 29 # 26-04, Soledad, Atlántico |
| Teléfono / WhatsApp | +57 312 755 7694 | +57 322 607 0697 |
| Correo | urbanfoodbq@gmail.com | admihipsol@gmail.com |
| Pedidos | [menu.fu.do/urbanfoodbq](https://menu.fu.do/urbanfoodbq) | [menu.fu.do/urbanfoodsl](https://menu.fu.do/urbanfoodsl) |

> Si cambia el teléfono o el correo de una sede, hay que cambiarlo en cinco sitios:
>
> 1. `index.html` — ficha de la sede en la sección **Sedes** (ahí solo va el teléfono)
> 2. `index.html` — ficha de la sede en el **pie de página**
> 3. `index.html` — bloque **JSON-LD** de la cabecera
> 4. `assets/js/config.js` — objeto `SEDES` (de ahí sale el enlace de WhatsApp del selector)
> 5. `assets/js/reservas-comun.js` — objeto `SEDES_RESERVA` (WhatsApp de las páginas de reservas)

## Licencia

© Urban Food. Todos los derechos reservados.
