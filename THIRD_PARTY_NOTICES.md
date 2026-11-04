# Avisos de terceros

Sonando (AGPL-3.0) incluye o usa el siguiente trabajo de terceros. Cada uno conserva su licencia.

## Incluido en Sonando.exe

| Componente | Licencia | Origen |
| --- | --- | --- |
| Node.js (el ejecutable lleva su motor dentro) | MIT y otras (ver su LICENSE) | https://nodejs.org |
| tiktok-live-connector 2.5 | AGPL-3.0-only | https://github.com/zerodytrash/TikTok-Live-Connector |
| tiktok-live-proto 0.2 | AGPL-3.0-only | https://github.com/isaackogan/TikTok-Webcast-Protobuf |
| tiktok-live-api-sdk (Euler Stream) | MIT | https://github.com/EulerStream/Euler-Api-Sdk |
| @bufbuild/protobuf | Apache-2.0 y BSD-3-Clause | https://github.com/bufbuild/protobuf-es |
| ws | MIT | https://github.com/websockets/ws |
| got y sus dependencias | MIT | https://github.com/sindresorhus/got |
| rxjs | Apache-2.0 | https://github.com/ReactiveX/rxjs |
| http-cache-semantics | BSD-2-Clause | https://github.com/kornelski/http-cache-semantics |
| tslib | 0BSD | https://github.com/microsoft/tslib |
| type-fest | MIT o CC0-1.0 | https://github.com/sindresorhus/type-fest |
| kuroshiro 1.2 y kuroshiro-analyzer-kuromoji (letra en romaji) | MIT | https://github.com/hexenq/kuroshiro |
| kuromoji 0.1 y su diccionario IPADIC (va dentro del .exe) | Apache-2.0 (diccionario: licencia de IPADIC, ver node_modules/kuromoji) | https://github.com/takuyaa/kuromoji.js |
| pinyin-pro (letra china en pinyin) | MIT | https://github.com/zh-lx/pinyin-pro |
| any-ascii (otros alfabetos) | ISC | https://github.com/anyascii/anyascii |

En total, unas 50 librerías más con licencia MIT (dependencias de las anteriores). La lista exacta y sus textos de licencia están en `node_modules/*/LICENSE` al instalar el proyecto con `npm install`.

## Solo para construir (no van dentro del programa)

| Componente | Licencia |
| --- | --- |
| esbuild | MIT |
| postject | MIT |

## Servicios y recursos externos

- **Inter** (tipografía), servida por Google Fonts — SIL Open Font License 1.1.
- **LRCLIB** (letras sincronizadas) — https://lrclib.net. Las letras pertenecen a sus autores.
- **Spotify Web API** — sujeta a las condiciones para desarrolladores de Spotify.
- **Euler Stream** — servicio de firma usado para conectar con los directos de TikTok.
- Las imágenes de rosa y moneda de TikTok son marcas de TikTok/ByteDance y se usan solo para indicar el tipo de regalo.
