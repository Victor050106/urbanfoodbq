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
│   ├── js/script.js      # Sedes, horarios, estado abierto/cerrado, opiniones, modales
│   ├── img/
│   │   ├── hero-pattern.webp # Textura de doodles del hero (~128 KB)
│   │   ├── mascota.webp      # Mascota de marca con transparencia (~113 KB)
│   │   ├── og-cover.jpg      # Imagen 1200x630 para WhatsApp / Facebook / X
│   │   └── menu/             # 7 fotos de categorías, 800x800
│   └── brand/            # logo.png, logor.png, favicon.png, faviconr.png
├── apps-script/
│   └── Code.gs           # Backend de comentarios (Google Apps Script)
├── docs/                 # Documentos internos, NO se suben al repo
│   ├── PASOS-PARA-VICTOR.md
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

## Funcionalidades

- **Navbar responsivo** con menú hamburguesa accesible (`aria-expanded`) y sombra al hacer scroll
- **Hero section** con la mascota de marca como protagonista y textura de doodles de fondo
- **Indicador "Abierto ahora / Cerrado"** en vivo, calculado en hora de Barranquilla
  (`America/Bogota`) y no en la del visitante. Contempla los cierres de madrugada
  (el sábado cierra a las 2 AM del domingo)
- **Sección de menú** con 12 categorías (Grill, Perros, Hamburguesas, Pizzas, Salchipapas, Sandwiches, Mazorcas, Salvajadas, Taco Pizza & Pinchos, Menú Infantil, Bebidas & Frappés, Adicionales)
- **Horario dinámico**: detecta el día actual y resalta sus horas automáticamente
- **Selector de sedes** (El Carmen / Hipódromo) con datos de contacto y mapa por sede
- **Selector de sede al pedir**: los botones de pedido y de carta abren un modal que pregunta
  a qué sede va el pedido, porque cada una tiene su propio menú en fu.do. Los dos links viven
  en el objeto `SEDES` al inicio de `assets/js/script.js`: ahí se cambian, no en el HTML
- **Animaciones de scroll** (Intersection Observer), desactivadas si el sistema pide
  `prefers-reduced-motion`
- **Botón flotante de WhatsApp** con mensaje de pedido preescrito
- **Sección de opiniones** con formulario de comentarios y moderación previa (ver más abajo)
- **Accesibilidad**: etiquetas asociadas a sus campos, calificación por estrellas manejable
  con teclado (patrón `radiogroup` con flechas), modal con foco atrapado y devuelto, y
  objetivos táctiles de 44 px

## Comentarios y moderación

Los comentarios que dejan los clientes se guardan en una hoja de Google Sheets a través de
un Google Apps Script (ver `apps-script/Code.gs`).

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

> Después de modificar `apps-script/Code.gs` hay que volver a desplegar el script:
> Implementar > Administrar implementaciones > (lápiz) > Versión: Nueva versión > Implementar.

## Correr localmente

Requiere [Node.js](https://nodejs.org) instalado.

```bash
npx serve . -l 3000
```

Luego abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Información de contacto del restaurante

| Campo     | Dato                                         |
|-----------|----------------------------------------------|
| Sede El Carmen | Calle 53D # 19-06, Barranquilla, Colombia |
| Sede Hipódromo  | Cra. 29 # 26-04, Soledad, Atlántico       |
| Teléfono  | +57 312 755 7694                             |
| Correo    | urbanfoodbq@gmail.com                        |
| Pedidos El Carmen | [menu.fu.do/urbanfoodbq](https://menu.fu.do/urbanfoodbq) |
| Pedidos Hipódromo  | [menu.fu.do/urbanfoodsl](https://menu.fu.do/urbanfoodsl) |

## Licencia

© Urban Food. Todos los derechos reservados.
