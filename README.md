# Urban Food BQ

Sitio web oficial de **Urban Food BQ**, restaurante ubicado en Barranquilla, Colombia. Plataforma informativa y de marketing que dirige a los clientes a realizar pedidos a través del sistema externo [fu.do](https://menu.fu.do/urbanfoodbq).

## Vista previa
<img width="1335" height="595" alt="image" src="https://github.com/user-attachments/assets/2cf29158-31e1-4996-bf35-669d31a662b7" />

Diseño oscuro con acentos en naranja (`#fe9100`) y teal (`#00c6b0`), pensado para un público joven y urbano.

## Tecnologías

- HTML5 + CSS3 (custom properties, flexbox, grid, animaciones)
- JavaScript vanilla (sin frameworks)
- Google Fonts — `Bebas Neue` y `Inter`
- Google Maps (mapa embebido)
- WhatsApp, Facebook e Instagram (integración de redes sociales)
- [fu.do](https://menu.fu.do/urbanfoodbq) — plataforma de pedidos en línea

## Estructura del proyecto

```
Urban Food/
├── index.html       # Documento principal con todas las secciones
├── styles.css       # Estilos globales y diseño responsivo
├── script.js        # Interactividad: menú móvil, horario dinámico, animaciones
├── banner.jpg       # Imagen de fondo del hero
├── logo.png         # Logo blanco (modo oscuro)
├── logor.png        # Logo naranja (variante)
├── favicon.png      # Favicon estándar
└── faviconr.png     # Favicon variante
```

## Funcionalidades

- **Navbar responsivo** con menú hamburguesa animado y efecto blur al hacer scroll
- **Hero section** con imagen de fondo, overlay y botones de llamada a la acción
- **Sección de menú** con 12 categorías (Grill, Perros, Hamburguesas, Pizzas, Salchipapas, Sandwiches, Mazorcas, Salvajadas, Taco Pizza & Pinchos, Menú Infantil, Bebidas & Frappés, Adicionales)
- **Horario dinámico**: detecta el día actual y resalta sus horas automáticamente
- **Sección de ubicación** con datos de contacto y mapa de Google embebido
- **Animaciones de scroll** (Intersection Observer) y efecto pulsante en el CTA
- **Integración con WhatsApp** para contacto directo
- **Sección de opiniones** con formulario de comentarios y moderación previa (ver más abajo)

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
