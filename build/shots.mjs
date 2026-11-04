// Capturas del README con datos de prueba (?demo). Necesita Sonando en marcha (npm start) y Chrome.
// Uso: node build/shots.mjs   → release/screenshots/*.png
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'release', 'screenshots');
const BASE = 'http://127.0.0.1:5190';
const SHOTS = [
  ['inicio', '/?demo', 1440, 900, 2500],
  ['panel', '/control?demo', 1600, 1000, 2500],
  ['pantalla-directo', '/stage?demo', 1920, 1080, 5000],
  ['tutorial', '/control?demo&tour', 1600, 1000, 2500],
  ['top', '/top?demo', 1200, 1400, 2000],
];
fs.mkdirSync(OUT, { recursive: true });
const port = 9333, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sonando-shots-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--hide-scrollbars', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let ver; for (let i = 0; i < 40 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(250); } }
  for (const [name, url, w, h, wait] of SHOTS) {
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.once('open', r));
    let id = 0; const call = (method, params = {}) => new Promise(r => { const n = ++id; const on = m => { const d = JSON.parse(m); if (d.id === n) { ws.off('message', on); r(d.result); } }; ws.on('message', on); ws.send(JSON.stringify({ id: n, method, params })); });
    await call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await call('Page.enable'); await call('Page.navigate', { url: BASE + url });
    await sleep(wait); // tiempo real: que terminen las animaciones de entrada
    const { data } = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data, 'base64'));
    console.log('ok', name); ws.close();
  }
} finally { chrome.kill(); }
