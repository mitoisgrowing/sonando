// Construye dist/Sonando.exe: un solo archivo con Node, el servidor y las páginas dentro.
// Uso: npm run build
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const OUT = path.join(ROOT, 'build', 'out'), DIST = path.join(ROOT, 'dist');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(DIST, { recursive: true });

// 1. todo el código en un solo archivo CommonJS (lo que necesita un ejecutable de Node)
await build({
  entryPoints: [path.join(ROOT, 'server.js')], outfile: path.join(OUT, 'sonando.cjs'),
  bundle: true, platform: 'node', format: 'cjs', target: 'node24', minify: true, legalComments: 'none',
  define: { 'import.meta.url': '__importMetaUrl' },
  banner: { js: "const __importMetaUrl = require('url').pathToFileURL(__filename).href;" },
  logLevel: 'warning',
});

// 2. las páginas van dentro del .exe (los GIF de alertas no: cada uno pone los suyos en %APPDATA%\Sonando\alerts)
const assets = {};
const walk = dir => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
  const p = path.join(dir, f.name), rel = path.relative(path.join(ROOT, 'public'), p).replaceAll('\\', '/');
  if (rel.startsWith('alerts') || rel.startsWith('_test')) continue;
  if (f.isDirectory()) walk(p); else assets['public/' + rel] = p;
} };
walk(path.join(ROOT, 'public'));
// diccionario japonés (kuromoji) para romanizar letras; se saca a %APPDATA%\Sonando la primera vez que hace falta
const DICT = path.join(ROOT, 'node_modules', 'kuromoji', 'dict');
for (const f of fs.readdirSync(DICT)) if (f.endsWith('.dat.gz')) assets['dict/' + f] = path.join(DICT, f);
fs.writeFileSync(path.join(OUT, 'sea-config.json'), JSON.stringify({
  main: path.join(OUT, 'sonando.cjs'), output: path.join(OUT, 'sea-prep.blob'),
  disableExperimentalSEAWarning: true, useCodeCache: false, assets,
}, null, 2));
execFileSync(process.execPath, ['--experimental-sea-config', path.join(OUT, 'sea-config.json')], { stdio: 'inherit' });

// 3. copia de node.exe con el programa inyectado
const exe = path.join(DIST, 'Sonando.exe');
fs.copyFileSync(process.execPath, exe);
execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'postject', 'dist', 'cli.js'), exe, 'NODE_SEA_BLOB', path.join(OUT, 'sea-prep.blob'),
  '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'], { stdio: 'inherit' });
console.log(`\nListo: ${exe} (${(fs.statSync(exe).size / 1048576).toFixed(0)} MB, ${Object.keys(assets).length} archivos dentro)`);
