# Urban Food BQ

Sitio web oficial de **Urban Food BQ**, restaurante ubicado en Barranquilla, Colombia. Plataforma informativa y de marketing que dirige a los clientes a realizar pedidos a través del sistema externo [fu.do](https://menu.fu.do/urbanfoodbq).

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
- [fu.do](https://menu.fu.do/urbanfoodbq) — plataforma de pedidos en línea

## Estructura del proyecto

```
Urban Food/
├── index.html            # Documento principal con todas las secciones + JSON-LD
├── styles.css            # Estilos que complementan a Tailwind
├── script.js             # Horarios, estado abierto/cerrado, sedes, opiniones, modal
├── robots.txt            # Indexación
├── sitemap.xml           # Mapa del sitio
├── img/
│   ├── hero-pattern.webp # Textura de doodles del hero (~128 KB)
│   ├── mascota.webp      # Mascota de marca con transparencia (~113 KB)
│   ├── og-cover.jpg      # Imagen 1200x630 para WhatsApp / Facebook / X
│   └── menu/             # 7 fotos de categorías, 800x800
├── banner.svg            # Arte original del banner (3,7 MB). NO lo usa el sitio:
│                         # es la fuente de la que salieron las imágenes de img/
├── logo.png              # Logo blanco (modo oscuro)
├── logor.png             # Logo naranja (variante)
├── favicon.png           # Favicon estándar
└── faviconr.png          # Favicon variante
```

> **Sobre las imágenes del hero:** el `banner.svg` original pesaba 3,7 MB (18 PNG incrustados)
> y se cargaba entero antes de que se viera nada. Se descompuso en `img/hero-pattern.webp` +
> `img/mascota.webp` (~240 KB entre las dos). Si algún día se rehace el arte, hay que volver a
> exportar esas dos piezas: el sitio ya no lee `banner.svg`.

## Funcionalidades

- **Navbar responsivo** con menú hamburguesa accesible (`aria-expanded`) y sombra al hacer scroll
- **Hero section** con la mascota de marca como protagonista y textura de doodles de fondo
- **Indicador "Abierto ahora / Cerrado"** en vivo, calculado en hora de Barranquilla
  (`America/Bogota`) y no en la del visitante. Contempla los cierres de madrugada
  (el sábado cierra a las 2 AM del domingo)
- **Sección de menú** con 12 categorías (Grill, Perros, Hamburguesas, Pizzas, Salchipapas, Sandwiches, Mazorcas, Salvajadas, Taco Pizza & Pinchos, Menú Infantil, Bebidas & Frappés, Adicionales)
- **Horario dinámico**: detecta el día actual y resalta sus horas automáticamente
- **Selector de sedes** (Principal / Hipódromo) con datos de contacto y mapa por sede
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

1. Abre la hoja de cálculo "Urban Food BQ - Comentarios".
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
| Dirección | Calle 53D # 19-06, Barranquilla, Colombia    |
| Teléfono  | +57 302 401 7935                             |
| Correo    | urbanfoodbq@gmail.com                        |
| Pedidos   | [menu.fu.do/urbanfoodbq](https://menu.fu.do/urbanfoodbq) |

## Licencia

© Urban Food BQ. Todos los derechos reservados.
