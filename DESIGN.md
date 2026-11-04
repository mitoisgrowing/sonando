# Design

Mundo: la vista de letra a pantalla completa de un reproductor de Apple, pedida explícitamente en el brief.

- **Fondo:** la portada actual, enorme, con `blur(110px) saturate(1.7)`, dos copias girando lento (48 s / 66 s, linear). Cambio de canción = fundido de 1,4 s. Velo oscuro arriba y abajo para legibilidad.
- **Tipo:** Inter con optical sizing (SF Pro no tiene licencia web). Letra 70px/760, tracking −0.032em. Títulos 50px/720.
- **Letra:** línea activa blanca al 100 %; resto al 30 %, las lejanas con desenfoque creciente (1,2px por línea, tope 3,6px). Scroll con `cubic-bezier(0.32, 0.72, 0, 1)` 720 ms. Huecos instrumentales = tres puntos que respiran.
- **Color:** casi negro `#0b0a0c`, tinta blanca en tres niveles (100 / 62 / 52 %), un solo acento rosa `oklch(0.7 0.19 12)` reservado para regalos y monedas.
- **Momento animado:** el aviso de regalo (pastilla con blur, entra 560 ms ease-drawer, sale 240 ms) y la canción moviéndose en la cola (FLIP 520 ms).
- **Lienzo del directo:** horizontal, diseñado a 1920 de ancho y estirado para llenar la ventana entera (va en la franja central del directo vertical). Letra a la izquierda, cola en panel a la derecha, barra de progreso abajo. Sin chat: ya lo muestra TikTok.
- **Panel:** mismo sistema, 14px, tres columnas (chat · añadir · cola), botones con `scale(.97)` al pulsar, hover solo en `(hover: hover)`.
