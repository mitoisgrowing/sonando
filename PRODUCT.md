# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Delegated: Node 24 sin framework (node:http + SSE), HTML/CSS/JS plano en `public/`, única dependencia `tiktok-live-connector`. Solo corre en el PC del streamer (127.0.0.1:5190).

## Users
Un streamer de TikTok que hace directos reaccionando a canciones sin enseñar la cara (usa un avatar aparte, Bit Buddy). Los espectadores piden canciones en el chat y donan para adelantarlas.

## Product Purpose
Convertir el chat del directo en una cola de Spotify con reglas claras de donación, y mostrar en el stream lo que suena con su letra sincronizada. Éxito: el streamer no escribe nombres a mano y la gente dona porque ve su canción subir.

## Capabilities and Constraints
- El chat de TikTok entra en el panel; el streamer pulsa un mensaje, elige la versión correcta en Spotify y se añade a nombre de quien la pidió.
- Reglas: cola máx. 10; regalo por debajo de 5 monedas sube la canción 2 puestos; 5 monedas acumuladas la ponen la siguiente (detrás de quien ya pagó eso); con la cola llena solo entra quien ha donado; la canción que suena y la que ya está en camino no se pueden quitar.
- Requiere Spotify Premium y una app de desarrollador propia (PKCE, sin secreto). Letras de LRCLIB (Spotify no da acceso a las suyas).
- TikTok vía conector no oficial: puede romperse si TikTok cambia.

## Product Principles
- El streamer decide qué versión suena; la app nunca adivina.
- Las reglas de donación se ven siempre en pantalla.
- La pantalla del directo tiene que dar ganas de quedarse sin necesidad de cara.
