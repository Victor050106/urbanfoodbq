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

- HTML5 + Tailwind CSS (vía CDN, configurado en línea dentro de `index.html`)
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
│   ├── css/styles.css    # Estilos que complementan a Tailwind
│   ├── js/               # Módulos ES nativos, uno por sección (sin build)
│   │   ├── main.js       # Arranque: inicia cada sección y hace la única petición a la hoja
│   │   ├── config.js     # Lo que se cambia a mano: horario, SEDES, URL del Apps Script
│   │   ├── api.js        # getJson / postJson contra el Apps Script
│   │   ├── modal.js      # Abrir, cerrar, Escape y foco atrapado, compartido por los modales
│   │   ├── fechas.js · util.js
│   │   ├── horario.js · nav.js · sedes.js · opiniones.js · novedades.js
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
│   ├── Code.gs           # Backend de comentarios y novedades (Google Apps Script)
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
- **Sección de opiniones** con formulario de comentarios y moderación previa (ver más abajo)
- **Accesibilidad**: etiquetas asociadas a sus campos, calificación por estrellas manejable
  con teclado (patrón `radiogroup` con flechas), modal con foco atrapado y devuelto, y
  objetivos táctiles de 44 px

## Comentarios y moderación

Los comentarios que dejan los clientes se guardan en una hoja de Google Sheets a través de
un Google Apps Script (ver `apps-script/Code.gs`). El mismo script sirve las novedades desde
una segunda pestaña de esa hoja, y la página lo consulta una sola vez para las dos cosas.

**Ningún comentario se publica automáticamente.** Cada comentario nuevo llega a la hoja con
la columna `approved` sin marcar. Para que aparezca en la página:

1. Abre la hoja de cálculo de comentarios en Google Drive.
2. Busca la fila del comentario nuevo (los más recientes quedan al final).
3. Marca la casilla de la columna **approved** de esa fila.

El comentario aparecerá en la web la próxima vez que alguien cargue la página. Si un
comentario es spam u ofensivo, simplemente déjalo sin marcar (o borra la fila).

### Protecciones incluidas

- **Moderación previa obligatoria** — nada se publica sin aprobación manual.
- **Campo trampa anti-bots (honeypot)** — un campo oculto en el formulario que las personas
  no ven pero los bots suelen rellenar. Si llega lleno, el envío se descarta en silencio,
  tanto en el navegador como en el servidor.
- **Escapado de HTML** — el nombre y el comentario se escapan antes de mostrarse, para que
  nadie pueda inyectar código en la página.
- **Límites de longitud** — nombre máx. 60 caracteres, comentario máx. 500.
- **Sin fórmulas en la hoja** — si un texto empieza por `=`, `+`, `-` o `@`, se guarda como
  texto y no como fórmula de Sheets.

> Después de modificar `apps-script/Code.gs` hay que volver a desplegar el script:
> Implementar > Administrar implementaciones > (lápiz) > Versión: Nueva versión > Implementar.

> `Code.gs` todavía tiene el backend de las reservas para grupos (pestaña `Reservas` de la hoja
> de comentarios). La página ya no lo usa; se puede quitar cuando las reservas en línea estén
> funcionando y no queden reservas de grupo pendientes.

## Reservas

Los clientes reservan mesa o el salón VIP desde `/reservas/`. El camino es: enlace
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
- Los textos de la sección naranja de la portada (`#reservas` en `index.html`) repiten el
  adelanto y la regla de las 24 horas: si cambian en la hoja Config, cambiarlos ahí también.

Para probar sin desplegar nada hay un servidor de desarrollo con Bold simulado:

```bash
node tests/reservas/servidor-local.js
```

y abrir [http://localhost:3000/reservas/?api=local](http://localhost:3000/reservas/?api=local)
(el puerto se cambia con la variable `PORT`). Ese mismo servidor sirve el resto del sitio, así
que también sirve para `npm run test:e2e`.

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
reservas de grupo y opiniones con fórmulas. `tests/reservas/` prueba el backend de las
reservas en línea (cupos, estados, Bold, correos, hoja) con servicios de Google falsos.
`tests/e2e.js` abre la página en Microsoft Edge (escritorio y celular) y revisa horario,
selector de sede, modales, opiniones, enlaces a reservas y áreas táctiles. Los envíos
de opiniones se simulan: nunca escriben en la hoja real. Las capturas quedan en
`tests/shots/`.

## Información de contacto del restaurante

Cada sede atiende su propio teléfono, su propio correo y su propia carta.

| Dato | Sede El Carmen | Sede Hipódromo |
|------|----------------|----------------|
| Dirección | Calle 53D # 19-06, Barranquilla | Cra. 29 # 26-04, Soledad, Atlántico |
| Teléfono / WhatsApp | +57 312 755 7694 | ⚠️ +57 300 000 0000 (provisional) |
| Correo | urbanfoodbq@gmail.com | ⚠️ hipodromo@urbanfoodbq.com (provisional) |
| Pedidos | [menu.fu.do/urbanfoodbq](https://menu.fu.do/urbanfoodbq) | [menu.fu.do/urbanfoodsl](https://menu.fu.do/urbanfoodsl) |

> ⚠️ **El teléfono y el correo de Hipódromo son de relleno**, a la espera de los reales.
> El número `+57 300 000 0000` no corresponde a ninguna línea activa, justamente para que
> nadie termine llamando a un desconocido. Cuando lleguen los datos verdaderos hay que
> cambiarlos en cuatro sitios (los cuatro están marcados con `TODO`):
>
> 1. `index.html` — ficha de la sede en la sección **Sedes** (ahí solo va el teléfono)
> 2. `index.html` — ficha de la sede en el **pie de página**
> 3. `index.html` — bloque **JSON-LD** de la cabecera
> 4. `assets/js/config.js` — objeto `SEDES` (de ahí sale el enlace de WhatsApp del selector)

## Licencia

© Urban Food. Todos los derechos reservados.
