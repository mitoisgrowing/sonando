import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import sea from 'node:sea';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import * as Q from './queue.js';
import * as G from './games.js';

const PORT = +process.env.SONANDO_PORT || 5190; // otro puerto solo para pruebas (Spotify espera 5190)
const HOST = '127.0.0.1'; // solo este PC: el panel no tiene contraseña
const REDIRECT = `http://${HOST}:${PORT}/callback`;
const PACKED = sea.isSea(); // ¿corriendo como Sonando.exe?
const DIR = PACKED ? path.dirname(process.execPath) : path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
// cada persona guarda su configuración (Spotify, TikTok, cola) en su usuario, nunca dentro del .exe
const DATA = process.env.SONANDO_DATA || (PACKED ? path.join(process.env.APPDATA || DIR, 'Sonando') : path.join(DIR, 'data'));
fs.mkdirSync(DATA, { recursive: true });

const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { return d; } };
const save = (f, v) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(v, null, 2));

const config = load('config.json', { clientId: '', tiktokUser: '', tokens: null });
const SETTINGS = { showTop: true, showAlerts: true, showPoints: true, liveDone: false, onboarded: false }; // valores por defecto
config.settings = { ...SETTINGS, ...config.settings };
// quien ya usaba Sonando antes del tutorial no tiene que verlo
if (config.tokens && config.settings.onboarded === false && !('onboardedSet' in config.settings)) config.settings.onboarded = true;
const saved = load('queue.json', {});
const queue = Object.assign(Q.createQueue(), { list: saved.list || [], credits: saved.credits || {} });
if (saved.upNext) queue.list.unshift(saved.upNext); // se cerró con una canción en camino: vuelve la primera
for (const e of queue.list) if (e.user && !/[\p{L}\p{N}]/u.test(e.user.nick)) e.user.nick = e.user.id; // apodos tipo «...» guardados antes
const state = {
  now: null, upNext: null, chat: [], lyrics: null,
  tiktok: { status: 'off', user: config.tiktokUser, error: '' },
  spotify: { status: config.tokens ? 'ok' : 'off', error: '' },
};

// GIFs/vídeos de las alertas de donación: lo que metas en public/alerts
const ALERTS = PACKED ? path.join(DATA, 'alerts') : path.join(DIR, 'public', 'alerts');
fs.mkdirSync(ALERTS, { recursive: true });
let alerts = [];
const loadAlerts = () => { alerts = fs.readdirSync(ALERTS).filter(f => /\.(gif|webp|png|mp4|webm)$/i.test(f)).map(f => `/alerts/${encodeURIComponent(f)}`); };
loadAlerts(); fs.watch(ALERTS, () => { loadAlerts(); broadcast(); });

state.stats = { songs: 0, coins: 0, liked: 0, meh: 0, skipped: 0 };
state.fx = { cinema: false, drop: 0 };
state.game = null; // ruleta o batalla en curso
state.score = { uri: null, value: 0, set: false }; // medidor de -50 a +50 de la canción que suena // efectos que lanzas desde el panel

// ---------- difusión a las pantallas (SSE) ----------
const clients = new Set();
const BUILD = Date.now().toString(36); // cambia en cada arranque: las pantallas abiertas se recargan solas
function snapshot() {
  return {
    now: state.now, upNext: state.upNext, queue: queue.list, credits: queue.credits,
    chat: state.chat, lyrics: state.lyrics, verdict: state.verdict, judge: state.judge, score: state.score, game: gameView(), points: pointsView(), cloud: state.cloud, canLove: /user-library-modify/.test(config.tokens?.scope || ''), offset: state.offset || 0, scroll: state.scroll || 0, alerts,
    stats: state.stats, test: !!state.test, giftImgs, fx: state.fx, tiktok: state.tiktok, spotify: state.spotify,
    build: BUILD, rules: { max: Q.MAX, nextAt: Q.NEXT_AT, step: Q.STEP }, hasClientId: !!config.clientId, settings: config.settings, dataDir: DATA, supabaseUrl: config.supabase?.url || '', redirect: REDIRECT, manual: state.spotify.premium === false,
  };
}
function broadcast() {
  const msg = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const res of clients) res.write(msg);
}
const saveQueue = () => { if (!state.test) save('queue.json', { ...queue, upNext: state.upNext || null }); }; // en modo prueba no se guarda nada
const persist = () => { saveQueue(); broadcast(); };

function pushChat(item) {
  state.chat.push({ id: crypto.randomUUID(), at: Date.now(), ...item });
  if (state.chat.length > 80) state.chat.splice(0, state.chat.length - 80);
  broadcast();
}

// ---------- Spotify ----------
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing user-library-modify';
let verifier = '';

async function tokenRequest(body) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || 'token');
  config.tokens = { access: j.access_token, refresh: j.refresh_token || config.tokens?.refresh, exp: Date.now() + j.expires_in * 1000 - 60000, scope: j.scope ?? config.tokens?.scope ?? '' };
  save('config.json', config);
}

async function sp(pathname, opts = {}) {
  if (!config.tokens) throw new Error('Spotify sin conectar');
  if (Date.now() > config.tokens.exp) await tokenRequest({ grant_type: 'refresh_token', refresh_token: config.tokens.refresh });
  const r = await fetch(`https://api.spotify.com/v1${pathname}`, { ...opts, headers: { Authorization: `Bearer ${config.tokens.access}`, 'Content-Type': 'application/json' } });
  if (r.status === 204) return null;
  const text = await r.text();
  const j = text ? JSON.parse(text) : null;
  if (!r.ok) {
    if (j?.error?.reason === 'PREMIUM_REQUIRED') { state.spotify.premium = false; const e = new Error('Sin Premium: pon tú las canciones en Spotify'); e.premium = true; throw e; }
    const reason = j?.error?.reason === 'NO_ACTIVE_DEVICE' ? 'Abre Spotify y dale play a algo una vez' : j?.error?.message || `Spotify ${r.status}`;
    throw new Error(reason);
  }
  return j;
}

const toTrack = t => ({
  uri: t.uri, name: t.name, artists: t.artists.map(a => a.name).join(', '),
  album: t.album?.name || '', albumUri: t.album?.uri || '', art: t.album?.images?.[0]?.url || '', durationMs: t.duration_ms,
});

// ---------- letras (LRCLIB: gratis y sin clave; Spotify no expone sus letras) ----------
const lyricsCache = new Map();
function parseLrc(lrc) {
  const lines = [];
  for (const raw of lrc.split('\n')) {
    const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (m) lines.push({ t: (+m[1] * 60 + +m[2]) * 1000, text: m[3].trim() });
  }
  return lines;
}
async function getLyrics(track) {
  if (lyricsCache.has(track.uri)) return lyricsCache.get(track.uri);
  let out = { uri: track.uri, synced: false, lines: [] };
  try {
    const artist = track.artists.split(',')[0];
    const p = new URLSearchParams({ track_name: track.name, artist_name: artist, duration: Math.round(track.durationMs / 1000) });
    let r = await fetch(`https://lrclib.net/api/get?${p}`, { headers: { 'User-Agent': 'Sonando (overlay de directos)' } });
    let j = r.ok ? await r.json() : null;
    if (!j) {
      r = await fetch(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: track.name, artist_name: artist })}`, { headers: { 'User-Agent': 'Sonando (overlay de directos)' } });
      j = r.ok ? (await r.json()).find(x => x.syncedLyrics) || null : null;
    }
    if (j?.syncedLyrics) out = { uri: track.uri, synced: true, lines: parseLrc(j.syncedLyrics) };
    else if (j?.plainLyrics) out = { uri: track.uri, synced: false, lines: j.plainLyrics.split('\n').map(text => ({ t: 0, text })) };
  } catch (e) { console.warn('letras:', e.message); }
  lyricsCache.set(track.uri, out);
  return out;
}

// ---------- reproductor: sigue a Spotify y le pasa la siguiente ----------
let starting = false;
async function tick() {
  if (!config.tokens) return;
  try {
    const t0 = Date.now();
    const p = await sp('/me/player/currently-playing');
    const at = Math.round((t0 + Date.now()) / 2); // Spotify midió el progreso a mitad de la petición, no al recibirla
    const item = p?.item?.type === 'track' ? p.item : null;
    if (item && item.uri !== state.now?.uri && !(state.endedUri === item.uri && !p.is_playing)) {
      let owned = state.upNext?.uri === item.uri ? state.upNext : null;
      if (owned) state.upNext = null;
      else { const k = queue.list.findIndex(e => e.uri === item.uri); if (k >= 0) owned = queue.list.splice(k, 1)[0]; }
      clearTimeout(endTimer); endTimer = null;
      state.now = { ...toTrack(item), user: owned?.user || null, coins: owned?.coins || 0, owned: !!owned };
      state.offset = 0; state.scroll = 0;
      state.score = { uri: item.uri, value: 0, set: false };
      clearTimeout(skipTimer); state.judge = { uri: item.uri, kind: null, loved: false }; // juicio nuevo por canción
      if (owned) state.stats.songs++;
      state.lyrics = null;
      getLyrics(state.now).then(l => { if (l.uri === state.now?.uri) { state.lyrics = l; broadcast(); } });
    }
    if (state.now && item) Object.assign(state.now, { progressMs: p.progress_ms, isPlaying: p.is_playing, at });

    // Spotify no llegó a ponerla (dispositivo dormido, etc.): vuelve la primera a la cola
    if (!starting && state.upNext && Date.now() - state.upNext.sentAt > 8000) { queue.list.unshift(state.upNext); state.upNext = null; retryAt = Date.now() + 15000; }

    // La app pone ella misma cada canción. No usamos la cola de Spotify: su "siguiente" tira de tu lista.
    const remaining = item ? item.duration_ms - p.progress_ms : 0;
    // terminada por nosotros (pausada al final) o sin nada: la pantalla pasa a «Pide tu canción»
    const ended = item && state.endedUri === item.uri && !p.is_playing;
    if (ended && state.now) { state.now = null; state.lyrics = null; }
    if (item && p.is_playing && state.endedUri === item.uri) state.endedUri = null; // le has dado play tú
    const idle = !item || ended || (!p.is_playing && p.progress_ms === 0);
    // cola vacía y la canción acaba: si termina sola, Spotify se queda bloqueado (acepta órdenes y no suena).
    // Se pausa 1 s antes del final y así sigue vivo para la siguiente.
    if (manual()) { state.spotify = { ...state.spotify, status: 'ok', error: '' }; broadcast(); return; } // sin Premium: no se controla nada, solo se mira
    if (state.now?.owned && !queue.list.length && !state.upNext && !endTimer && item && p.is_playing && remaining < 4000) { // solo las que puso la app: tu lista sigue normal
      endTimer = setTimeout(async () => {
        endTimer = null;
        if (queue.list.length || state.now?.uri !== item.uri) return;
        try { await sp('/me/player/pause', { method: 'PUT' }); state.endedUri = item.uri; } catch (e) { console.warn('pausa:', e.message); }
      }, Math.max(0, remaining - 1000));
    }
    if (!starting && !state.upNext && !endTimer && queue.list.length && Date.now() > retryAt) {
      if (idle) await playNext();
      else if (p.is_playing && remaining < 4000) {
        endTimer = setTimeout(() => { endTimer = null; if (state.now?.isPlaying) playNext().catch(e => console.warn('siguiente:', e.message)); }, Math.max(0, remaining - 350));
      }
    }
    if (Date.now() > retryAt) state.spotify = { ...state.spotify, status: 'ok', error: '' };
  } catch (e) {
    state.spotify = { status: config.tokens ? 'ok' : 'off', error: e.message };
  }
  broadcast();
}
let endTimer = null, skipTimer = null, retryAt = 0;
const STAMP_MS = 4900; // lo que tarda el sello en salir y convertirse en la insignia (pantalla del directo)
// modo manual (cuenta sin Premium): la app no puede poner ni saltar canciones; enseña cuál toca y detecta cuándo la pones
const manual = () => state.spotify.premium === false;
async function doSkip() {
  if (manual()) return; // el panel enseña «Pon esta en Spotify»
  if (state.upNext) return; // ya está entrando la siguiente
  if (queue.list.length) await playNext(); else await sp('/me/player/next', { method: 'POST' });
}
async function playNext() {
  clearTimeout(endTimer); endTimer = null;
  if (manual()) return;
  const e = Q.shift(queue);
  if (!e) return;
  starting = true;
  try {
    await playTrack(e);
    state.upNext = { ...e, sentAt: Date.now() };
    await ensurePlaying(e);
    state.endedUri = null;
  } catch (err) { if (state.upNext?.id === e.id) state.upNext = null; queue.list.unshift(e); retryAt = err.premium ? 0 : Date.now() + 15000; if (!err.premium) throw err; }
  finally { starting = false; saveQueue(); }
}

// Spotify de escritorio a veces acepta la orden (204) y no suena: pasa cuando acaba una canción puesta
// desde aquí y el cliente se queda "dormido". Se comprueba y, si hace falta, se le transfiere la
// reproducción para despertarlo y se repite la orden en ese dispositivo.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function playTrack(e, deviceId) {
  const path = '/me/player/play' + (deviceId ? `?device_id=${deviceId}` : '');
  let albumUri = e.albumUri;
  if (!albumUri) { try { albumUri = (await sp(`/tracks/${e.uri.split(':').pop()}`))?.album?.uri; } catch {} }
  if (albumUri) {
    try { return await sp(path, { method: 'PUT', body: JSON.stringify({ context_uri: albumUri, offset: { uri: e.uri } }) }); }
    catch (err) { console.warn('álbum no vale, pista suelta:', err.message); }
  }
  return sp(path, { method: 'PUT', body: JSON.stringify({ uris: [e.uri] }) });
}
async function ensurePlaying(e) {
  const uri = e.uri;
  for (let i = 0; i < 2; i++) {
    await sleep(1500);
    const p = await sp('/me/player');
    if (p?.is_playing && p.item?.uri === uri) return;
    const devices = (await sp('/me/player/devices'))?.devices || [];
    const dev = devices.find(d => d.is_active) || devices.find(d => d.type === 'Computer') || devices[0];
    if (!dev) throw new Error('Abre Spotify en el PC');
    await sp('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [dev.id], play: false }) });
    await sleep(1000);
    await playTrack(e, dev.id);
  }
  await sleep(1500);
  const p = await sp('/me/player');
  if (!(p?.is_playing && p.item?.uri === uri)) throw new Error('Spotify no responde: dale play a cualquier canción en la app de Spotify (o reiníciala)');
}
setInterval(tick, 1500);

// ---------- puntos de los espectadores ----------
// total acumulado de todos los directos (data/points.json) + lo ganado en este directo (session)
const PTS = { chat: 1, request: 5, like: 20, save: 10, meh: 5, love: 10, finalist: 50, coin: 10 };
const points = load('points.json', {});
const session = {};
let pointsDirty = false;
setInterval(() => { if (pointsDirty) { save('points.json', points); pointsDirty = false; } }, 5000);
const lastChatPts = new Map(), simNames = {}, avatarCache = new Map();
function award(user, pts) {
  if (!user?.id || !pts || user.id === Q.HOST || user.id === 'anon') return;
  if (state.test || user.id.startsWith('sim:')) { session[user.id] = (session[user.id] || 0) + pts; (simNames[user.id] = user.nick); return; } // modo desarrollador: solo cuenta en este directo
  if (user.handle && user.handle !== user.id && points[user.handle]) { // puntos de antes, guardados por @usuario
    const old = points[user.handle]; delete points[user.handle];
    points[user.id] = { ...old, ...points[user.id], total: (points[user.id]?.total || 0) + old.total };
    if (session[user.handle]) { session[user.id] = (session[user.id] || 0) + session[user.handle]; delete session[user.handle]; }
  }
  const p = points[user.id] ||= { total: 0 };
  Object.assign(p, { nick: user.nick || p.nick, handle: user.handle || p.handle || '', avatar: user.avatar || p.avatar || '', seen: Date.now() });
  p.total += pts; session[user.id] = (session[user.id] || 0) + pts; pointsDirty = true; dirtyIds.add(user.id);
}
// ---------- Supabase (opcional): copia de los puntos en la nube ----------
// viewers: total de cada persona por su ID de TikTok · stream_points: lo ganado en cada directo
// La URL y la clave se guardan en la configuración local (data/config.json), nunca en el código.
const STREAM_ID = new Date().toISOString().slice(0, 16); // un directo = una sesión del programa
const dirtyIds = new Set();
const supa = (pathq, opts = {}) => fetch(`${config.supabase.url}/rest/v1/${pathq}`, {
  ...opts, signal: AbortSignal.timeout(8000),
  headers: { apikey: config.supabase.key, Authorization: `Bearer ${config.supabase.key}`, 'Content-Type': 'application/json', ...opts.headers },
});
state.cloud = { status: 'off', error: '' };
async function cloudPush() {
  if (!config.supabase?.url || !dirtyIds.size) return;
  const ids = [...dirtyIds]; dirtyIds.clear();
  const now = new Date().toISOString();
  const viewers = ids.map(id => ({ tiktok_id: id, nick: points[id].nick || '', handle: points[id].handle || '', avatar: points[id].avatar || '', total: points[id].total, last_seen: now }));
  const sp = ids.filter(id => session[id]).map(id => ({ stream_id: STREAM_ID, tiktok_id: id, points: session[id] }));
  try {
    for (const [table, rows, key] of [['viewers', viewers, 'tiktok_id'], ['stream_points', sp, 'stream_id,tiktok_id']]) {
      if (!rows.length) continue;
      const r = await supa(`${table}?on_conflict=${key}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
      if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    }
    state.cloud = { status: 'ok', error: '' };
  } catch (e) { ids.forEach(id => dirtyIds.add(id)); state.cloud = { status: 'error', error: e.message }; }
}
// al arrancar: si en la nube hay más puntos (p. ej. de otro PC), se quedan los mayores
async function cloudPull() {
  if (!config.supabase?.url) return;
  try {
    const r = await supa('viewers?select=tiktok_id,nick,handle,avatar,total');
    if (!r.ok) throw new Error(`viewers: ${r.status} ${(await r.text()).slice(0, 160)}`);
    for (const v of await r.json()) {
      const p = points[v.tiktok_id] ||= { total: 0 };
      if (v.total > p.total) Object.assign(p, { total: v.total, nick: p.nick || v.nick, handle: p.handle || v.handle, avatar: p.avatar || v.avatar });
    }
    pointsDirty = true; state.cloud = { status: 'ok', error: '' };
  } catch (e) { state.cloud = { status: 'error', error: e.message }; }
}
setInterval(() => cloudPush().catch(() => {}), 10000);

const ownerOfNow = () => state.now?.user && state.now.user.id !== Q.HOST ? state.now.user : null;
function pointsView() {
  const top = Object.entries(session).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, pts]) => ({ id, pts, total: points[id]?.total || pts, nick: points[id]?.nick || simNames[id] || id, avatar: points[id]?.avatar || '' }));
  const ids = new Set([...state.chat.map(m => m.user.id), ...queue.list.map(e => e.user.id), state.now?.user?.id, state.upNext?.user?.id, ...Object.keys(queue.credits)]);
  const pts = {}; for (const id of ids) if (points[id]) pts[id] = points[id].total;
  const names = {}; for (const id of Object.keys(queue.credits)) names[id] = points[id]?.nick || simNames[id] || id.replace(/^sim:/, "");
  return { top, pts, names };
}

// ---------- modo prueba ----------
// Una caja aparte: empieza con una copia de tu cola y un chat vacío; regalos, chat y puntos de prueba
// no se guardan. Al volver a Real se tira todo y vuelve lo de antes tal cual.
let real = null;
function setTest(on) {
  if (on === !!state.test) return;
  if (on) {
    real = { list: queue.list, credits: queue.credits, chat: state.chat, session: { ...session }, stats: state.stats };
    queue.list = structuredClone(queue.list); queue.credits = {}; state.chat = []; state.stats = { ...state.stats };
    state.test = true;
  } else {
    state.test = false;
    queue.list = real.list; queue.credits = real.credits; state.chat = real.chat; state.stats = real.stats;
    for (const k of Object.keys(session)) delete session[k]; Object.assign(session, real.session);
    real = null;
  }
  clearTimeout(gameTimer); state.game = null; voters.clear();
  persist();
}

// ---------- juegos: ruleta y batalla ----------
let gameTimer = null;
const voters = new Map(); // quién votó en la batalla, para darle puntos si acierta
function gameChat(user, text) {
  if (!G.onChat(state.game, user, text)) return false;
  if (state.game.type === 'battle') voters.set(user.id, user);
  return true;
}
// lo que ven las pantallas: sin el mapa de votos por persona, solo los totales
function gameView() {
  const g = state.game; if (!g) return null;
  if (g.type === 'roulette') return { ...g, entries: g.entries.map(e => ({ user: e.user, text: e.text })) };
  const { votes, ...rest } = g;
  return { ...rest, tally: G.tally(g) };
}
function clearGameLater(id, ms) { setTimeout(() => { if (state.game?.id === id) { state.game = null; broadcast(); } }, ms); }
function closeRoulette() {
  clearTimeout(gameTimer);
  const g = state.game; if (g?.type !== 'roulette' || g.phase !== 'open') return;
  G.spin(g); broadcast();
  if (g.phase === 'spinning') setTimeout(() => { if (state.game?.id === g.id) { g.phase = 'done'; broadcast(); clearGameLater(g.id, 45000); } }, 7000); // lo que tarda la rueda
  else clearGameLater(g.id, 6000);
}
function finishBattle() {
  clearTimeout(gameTimer);
  const g = state.game; if (g?.type !== 'battle' || g.phase !== 'open') return;
  G.endBattle(g);
  const win = g.result.winner === 1 ? g.a : g.result.winner === 2 ? g.b : null;
  if (win) {
    if (queue.list.some(e => e.id === win.id)) Q.toFront(queue, win.id); // la ganadora suena la siguiente
    for (const [id, user] of voters) if (g.votes[id] === g.result.winner) award(user, 3);
    persist();
  }
  voters.clear(); broadcast(); clearGameLater(g.id, 20000);
}

// ---------- TikTok ----------
let tiktok = null;
// foto de perfil: TikTok la manda en avatarThumb (o en otros campos según la versión); la primera URL válida
const imgUrl = (...imgs) => {
  for (const img of imgs) { const url = [img?.url, img?.urlList, img?.urls, img?.mUrls].flat().find(x => typeof x === 'string' && /^https?:/.test(x)); if (url) return url; }
  return '';
};
const avatarOf = u => {
  for (const img of [u?.avatarMedium, u?.avatarThumb, u?.profilePicture, u?.avatarLarge]) { // mediana: nítida a 86 px
    const url = [img?.url, img?.urlList, img?.urls, img?.mUrls].flat().find(x => typeof x === 'string' && /^https?:/.test(x));
    if (url) return url;
  }
  return '';
};
// apodo visible; si no tiene ni una letra ni un número (p. ej. «...»), se usa el @usuario
const userOf = u => {
  const nick = u?.nickname || '', handle = u?.uniqueId || u?.displayId || '';
  // id = ID numérico de TikTok: sigue siendo la misma persona aunque se cambie el nombre o el @usuario
  const num = [u?.userId, u?.idStr].map(x => String(x ?? '')).find(x => x && x !== '0');
  const uid = num ? `u${num}` : u?.secUid ? `s${u.secUid}` : ''; // secUid también es fijo por cuenta
  const id = uid || handle || nick || 'anon';
  return { id, handle, nick: /[\p{L}\p{N}]/u.test(nick) ? nick : handle || id, avatar: avatarOf(u) };
};

// fotos de los regalos de verdad, por nombre: así los regalos de prueba salen con su imagen real
const giftImgs = load('regalos.json', {});
function onGift(user, coins, giftName, count, image = '') {
  const unit = Math.round(coins / count);
  if (!state.test && /^https?:/.test(image) && (giftImgs[giftName]?.img !== image || giftImgs[giftName]?.coins !== unit)) { giftImgs[giftName] = { img: image, coins: unit }; save('regalos.json', giftImgs); }
  const r = Q.gift(queue, user, coins);
  award(user, coins * PTS.coin);
  state.stats.coins += coins;
  pushChat({ kind: 'gift', user, coins, count, gift: giftName, image, text: `${count > 1 ? `${count}× ` : ''}${giftName}`, moved: r.moved, to: r.to });
  persist();
}

async function connectTikTok(name) {
  if (tiktok) { try { await tiktok.disconnect(); } catch {} tiktok = null; }
  config.tiktokUser = name.replace(/^@/, '').trim(); save('config.json', config);
  state.tiktok = { status: 'connecting', user: config.tiktokUser, error: '' }; broadcast();
  const c = new TikTokLiveConnection(config.tiktokUser, { processInitialData: false });
  let chatDebug = 0;
  c.on(WebcastEvent.CHAT, d => {
    if (state.test) setTest(false);
    const text = d.comment ?? d.content ?? d.common?.describe ?? '';
    if (!text && chatDebug++ < 3) console.log('chat sin texto, campos:', JSON.stringify(d, (k, v) => typeof v === 'string' && v.length > 80 ? v.slice(0, 80) : v).slice(0, 1500));
    const user = userOf(d.user);
    if (text && Date.now() - (lastChatPts.get(user.id) || 0) > 30000) { lastChatPts.set(user.id, Date.now()); award(user, PTS.chat); }
    gameChat(user, text);
    pushChat({ kind: 'chat', user, text });
  });
  c.on(WebcastEvent.GIFT, d => {
    if (state.test) setTest(false);
    if (d.giftDetails?.giftType === 1 && !d.repeatEnd) return; // racha en curso: se cuenta al cerrarse
    const count = d.repeatCount || 1;
    const g = d.giftDetails;
    onGift(userOf(d.user), (g?.diamondCount || 1) * count, g?.giftName || 'Regalo', count, imgUrl(g?.giftImage, g?.icon, g?.previewImage, d.extendedGiftInfo?.image));
  });
  c.on(ControlEvent.DISCONNECTED, () => { state.tiktok.status = 'off'; broadcast(); });
  c.on(WebcastEvent.STREAM_END, () => { state.tiktok = { ...state.tiktok, status: 'off', error: 'El directo ha terminado' }; broadcast(); });
  tiktok = c;
  try { await c.connect(); state.tiktok.status = 'on'; }
  catch (e) { state.tiktok = { ...state.tiktok, status: 'off', error: /offline|room id/i.test(e.constructor?.name + e.message) ? 'No encuentro ese directo: revisa el usuario y que estés en vivo' : e.message }; }
  broadcast();
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.sql': 'text/plain; charset=utf-8' };
const body = req => new Promise(r => { let s = ''; req.on('data', c => s += c); req.on('end', () => { try { r(JSON.parse(s || '{}')); } catch { r({}); } }); });
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

const routes = {
  'GET /events': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    clients.add(res); req.on('close', () => clients.delete(res));
  },
  'GET /spotify/login': (req, res) => {
    verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const p = new URLSearchParams({ client_id: config.clientId, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPES, code_challenge_method: 'S256', code_challenge: challenge });
    res.writeHead(302, { Location: `https://accounts.spotify.com/authorize?${p}` }); res.end();
  },
  'GET /callback': async (req, res, url) => {
    try {
      await tokenRequest({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: REDIRECT, code_verifier: verifier });
      state.spotify = { status: 'ok', error: '' }; // se vuelve a comprobar si hay Premium
      res.writeHead(302, { Location: '/control' }); res.end();
    } catch (e) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(`No se pudo conectar Spotify: ${e.message}`); }
  },
  // ajustes: solo se aceptan las claves conocidas y valores sí/no
  // abre la carpeta donde se guarda todo (puntos, cola, configuración) en el explorador de Windows
  'POST /api/open-data': async (req, res) => { if (process.platform === 'win32') exec(`explorer "${DATA}"`); send(res, 200, { dir: DATA }); },
  'POST /api/settings': async (req, res) => {
    const b = await body(req);
    for (const k of Object.keys(SETTINGS)) if (typeof b[k] === 'boolean') config.settings[k] = b[k];
    if (typeof b.onboarded === 'boolean') config.settings.onboardedSet = true;
    save('config.json', config); broadcast(); send(res, 200, config.settings);
  },
  'POST /api/spotify-client': async (req, res) => { config.clientId = String((await body(req)).clientId || '').trim(); save('config.json', config); broadcast(); send(res, 200, { ok: true }); },
  'GET /api/search': async (req, res, url) => {
    try {
      const j = await sp(`/search?type=track,album&limit=10&q=${encodeURIComponent(url.searchParams.get('q') || '')}`);
      const albums = (j.albums?.items || []).filter(Boolean).slice(0, 6).map(a => ({
        id: a.id, name: a.name, artists: a.artists.map(x => x.name).join(', '), art: a.images?.[0]?.url || '', count: a.total_tracks, type: a.album_type,
      }));
      send(res, 200, { tracks: (j.tracks?.items || []).filter(Boolean).map(toTrack), albums });
    } catch (e) { send(res, 400, { error: e.message }); }
  },
  // canciones de un álbum o EP (la API no repite la portada en cada pista: se pone la del álbum)
  'GET /api/album': async (req, res, url) => {
    try {
      const id = String(url.searchParams.get('id') || '').replace(/[^\w]/g, '');
      const a = await sp(`/albums/${id}`);
      const tracks = a.tracks.items.filter(t => t?.uri?.startsWith('spotify:track:')).map(t => toTrack({ ...t, album: { name: a.name, uri: a.uri, images: a.images } }));
      send(res, 200, { id: a.id, name: a.name, artists: a.artists.map(x => x.name).join(', '), art: a.images?.[0]?.url || '', type: a.album_type, tracks });
    } catch (e) { send(res, 400, { error: e.message }); }
  },
  'POST /api/add': async (req, res) => {
    const { track, user, next } = await body(req);
    if (!track?.uri?.startsWith('spotify:track:') || !user?.id) return send(res, 400, { error: 'Falta la canción o el usuario' });
    const r = Q.add(queue, track, user, { next: !!next });
    if (r.ok) { award(user, PTS.request); persist(); tick(); }
    send(res, r.ok ? 200 : 409, r);
  },
  'POST /api/move': async (req, res) => {
    const b = await body(req);
    const ok = Q.move(queue, b.id, +b.dir || 0); if (ok) persist();
    send(res, ok ? 200 : 400, { ok });
  },
  // poner ya una canción de la cola (la que suena se corta, salvo que esté donada)
  'POST /api/playnow': async (req, res) => {
    const id = (await body(req)).id;
    if (state.now?.coins > 0 && state.now?.isPlaying) return send(res, 403, { error: 'La que suena está donada: se escucha entera' });
    if (!Q.toFront(queue, id)) return send(res, 400, { error: 'No está en la cola' });
    if (state.upNext) { queue.list.splice(1, 0, state.upNext); state.upNext = null; } // la que estaba entrando vuelve a la cola
    retryAt = 0; persist();
    try { await playNext(); send(res, 200, { ok: true }); } catch (e) { state.spotify.error = e.message; broadcast(); send(res, 400, { error: e.message }); }
  },
  'POST /api/remove': async (req, res) => { Q.remove(queue, (await body(req)).id); persist(); send(res, 200, { ok: true }); },
  // veredicto del streamer: "like" la aprueba; "skip" la salta, salvo que esté donada
  // Juicio del streamer sobre lo que suena:
  //  like  -> aprobada (tick junto al título)
  //  meh   -> ni fu ni fa (raya junto al título); durante la cuenta atrás también la salva
  //  skip  -> cuenta atrás de 15 s; al acabar sale «Saltada» y pasa a la siguiente. No vale con las donadas.
  //  save  -> durante la cuenta atrás, la salva («Salvada») y sigue sonando
  //  love  -> la guarda en tus Me gusta de Spotify (corazón junto al título)
  'POST /api/verdict': async (req, res) => {
    const v = (await body(req)).v;
    if (!['like', 'meh', 'skip', 'save', 'love'].includes(v)) return send(res, 400, { error: 'Veredicto desconocido' });
    if (!state.now) return send(res, 400, { error: 'No suena nada' });
    const j = state.judge?.uri === state.now.uri ? state.judge : (state.judge = { uri: state.now.uri, kind: null, loved: false });
    const stamp = kind => { state.verdict = { v: kind, uri: state.now.uri, at: Date.now() }; };

    if (v === 'love') {
      try {
        try { await sp(`/me/library?uris=${encodeURIComponent(state.now.uri)}`, { method: 'PUT' }); }
        catch { await sp(`/me/tracks?ids=${state.now.uri.split(':').pop()}`, { method: 'PUT' }); } // API antigua
      }
      catch (e) { return send(res, 400, { error: /scope|permission|insufficient|forbidden|403/i.test(e.message) ? 'Pulsa «Conectar Spotify» otra vez para dar permiso a guardar canciones' : e.message }); }
      if (!j.loved) award(ownerOfNow(), PTS.love);
      j.loved = true; stamp('love'); broadcast(); return send(res, 200, { ok: true });
    }
    if (v === 'meh' && j.kind === 'pending') clearTimeout(skipTimer);
    if (v === 'save' || (v === 'like' && j.kind === 'pending')) {
      if (j.kind !== 'pending') return send(res, 400, { error: 'No hay ninguna cuenta atrás' });
      clearTimeout(skipTimer); award(ownerOfNow(), PTS.save); j.kind = 'saved'; j.until = 0; stamp('save'); broadcast(); return send(res, 200, { ok: true });
    }
    if (v === 'meh' && j.kind !== 'meh') award(ownerOfNow(), PTS.meh);
    if (v === 'like' && j.kind !== 'liked' && j.kind !== 'pending') award(ownerOfNow(), PTS.like);
    if (v === 'meh') { j.kind = 'meh'; j.until = 0; state.stats.meh++; stamp('meh'); broadcast(); return send(res, 200, { ok: true }); }
    if (v === 'like') { j.kind = 'liked'; state.stats.liked++; stamp('like'); broadcast(); return send(res, 200, { ok: true }); }
    // skip
    if (state.now.coins > 0) return send(res, 403, { error: 'Esta la han donado: se escucha entera' });
    if (j.kind === 'pending') return send(res, 200, { ok: true });
    // los 15 s empiezan cuando «Saltada» termina de convertirse en el contador (~5 s de animación)
    j.kind = 'pending'; j.until = Date.now() + STAMP_MS + 15000; stamp('skip');
    clearTimeout(skipTimer);
    skipTimer = setTimeout(() => {
      if (state.judge !== j || j.kind !== 'pending') return;
      j.kind = 'skipped'; state.stats.skipped++; broadcast();
      doSkip().catch(e => console.warn('saltar:', e.message));
    }, STAMP_MS + 15000);
    broadcast(); send(res, 200, { ok: true });
  },
  'POST /api/skip': async (req, res) => {
    if (state.now?.coins > 0) return send(res, 403, { error: 'Esta la han donado: se escucha entera' });
    try { await doSkip(); send(res, 200, { ok: true }); } catch (e) { send(res, 400, { error: e.message }); }
  },
  // ajuste fino de la letra de la canción actual, en ms (positivo = la letra va antes)
  'POST /api/offset': async (req, res) => {
    state.offset = Math.max(-5000, Math.min(5000, (state.offset || 0) + (+(await body(req)).delta || 0)));
    broadcast(); send(res, 200, { offset: state.offset });
  },
  // scroll manual de una letra sin sincronizar, en px del lienzo
  'POST /api/scroll': async (req, res) => {
    const b = await body(req);
    state.scroll = b.reset ? 0 : Math.max(0, (state.scroll || 0) + (+b.delta || 0));
    broadcast(); send(res, 200, { scroll: state.scroll });
  },
  // golpes del detector de ritmo (corre en el panel): se reenvían al momento, sin el estado completo
  // tutorial: comprueba una URL y clave de Supabase sin guardarlas (¿conecta? ¿existen ya las tablas?)
  // foto de perfil de TikTok servida desde aquí: solo de sus servidores de imágenes, con caché,
  // y si TikTok devuelve la imagen vacía de ~70 bytes se responde 404 para que salga la inicial
  'GET /api/avatar': async (req, res, url) => {
    const u = String(url.searchParams.get('u') || '');
    let host = ''; try { host = new URL(u).hostname; } catch {}
    if (!/(^|\.)(tiktokcdn(-[a-z]+)?\.com|tiktokcdn\.com|ibyteimg\.com|byteimg\.com)$/.test(host)) { res.writeHead(400); return res.end(); }
    let hit = avatarCache.get(u);
    if (!hit) {
      try {
        const r = await fetch(u, { signal: AbortSignal.timeout(6000) });
        const buf = Buffer.from(await r.arrayBuffer());
        hit = r.ok && buf.length > 400 ? { type: r.headers.get('content-type') || 'image/webp', buf } : { empty: true };
      } catch { hit = { empty: true }; }
      avatarCache.set(u, hit); if (avatarCache.size > 400) avatarCache.delete(avatarCache.keys().next().value);
    }
    if (hit.empty) { res.writeHead(404, { 'Cache-Control': 'max-age=600' }); return res.end(); }
    res.writeHead(200, { 'Content-Type': hit.type, 'Cache-Control': 'max-age=3600' }); res.end(hit.buf);
  },
  // top de espectadores: 'session' = este directo, 'total' = de siempre
  'GET /api/top': async (req, res, url) => {
    const scope = url.searchParams.get('scope') === 'session' ? 'session' : 'total';
    const rows = scope === 'session'
      ? Object.entries(session).map(([id, pts]) => ({ id, pts, nick: points[id]?.nick || simNames[id] || id, avatar: points[id]?.avatar || '', handle: points[id]?.handle || '' }))
      : Object.entries(points).map(([id, p]) => ({ id, pts: p.total, nick: p.nick || id, avatar: p.avatar || '', handle: p.handle || '' }));
    rows.sort((a, b) => b.pts - a.pts);
    send(res, 200, { scope, rows, count: rows.length }); // todos
  },
  'POST /api/supabase-test': async (req, res) => {
    const b = await body(req);
    const url = String(b.url || '').trim().replace(/\/+$/, ''), key = String(b.key || '').trim();
    if (!/^https:\/\/[\w-]+\.supabase\.co$/.test(url)) return send(res, 200, { ok: false, error: 'La URL debe ser https://<proyecto>.supabase.co' });
    if (!key) return send(res, 200, { ok: false, error: 'Falta la clave' });
    const ref = url.slice(8).split('.')[0];
    const get = t => fetch(`${url}/rest/v1/${t}?select=tiktok_id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
    try {
      const r = await get('viewers'), t = await r.text();
      if (r.status === 401 || (r.status === 403 && /key|jwt|api/i.test(t))) return send(res, 200, { ok: false, ref, error: 'La clave no es válida para ese proyecto' });
      if (!r.ok && !/PGRST205|does not exist|schema cache/.test(t)) return send(res, 200, { ok: false, ref, error: `Supabase respondió ${r.status}` });
      const tables = r.ok && (await get('stream_points')).ok;
      send(res, 200, { ok: true, ref, tables });
    } catch { send(res, 200, { ok: false, ref, error: 'No se puede conectar: revisa la URL' }); }
  },
  'POST /api/supabase': async (req, res) => {
    const b = await body(req);
    const url = String(b.url || '').trim().replace(/\/+$/, ''), key = String(b.key || '').trim();
    if (url && !/^https:\/\/[\w-]+\.supabase\.co$/.test(url)) return send(res, 400, { error: 'La URL debe ser https://<proyecto>.supabase.co' });
    config.supabase = url && key ? { url, key } : null; save('config.json', config);
    if (config.supabase) { await cloudPull(); Object.keys(points).forEach(id => dirtyIds.add(id)); await cloudPush(); } else state.cloud = { status: 'off', error: '' };
    broadcast(); send(res, 200, state.cloud);
  },
  // juegos: { action: 'roulette' | 'spin' | 'battle' | 'vote' | 'end' | 'close', secs, a, b, pick }
  'POST /api/game': async (req, res) => {
    const b = await body(req);
    const busy = state.game && (state.game.phase === 'open' || state.game.phase === 'spinning');
    const secs = Math.max(10, Math.min(300, Math.round(+b.secs || 60)));
    if (b.action === 'roulette') {
      if (busy) return send(res, 409, { error: 'Ya hay un juego en marcha' });
      state.game = G.startRoulette(secs); gameTimer = setTimeout(closeRoulette, secs * 1000);
    } else if (b.action === 'spin') closeRoulette();
    else if (b.action === 'kick') G.kick(state.game, String(b.user || ''));
    else if (b.action === 'battle') {
      if (busy) return send(res, 409, { error: 'Ya hay un juego en marcha' });
      const A = queue.list.find(e => e.id === b.a), B = queue.list.find(e => e.id === b.b);
      if (!A || !B || A === B) return send(res, 400, { error: 'Elige dos canciones distintas de la cola' });
      voters.clear(); state.game = G.startBattle(A, B, secs); gameTimer = setTimeout(finishBattle, secs * 1000);
    } else if (b.action === 'vote') { if (state.game?.type === 'battle' && state.game.phase === 'open') state.game.host = [0, 1, 2].includes(+b.pick) ? +b.pick : 0; }
    else if (b.action === 'end') { if (state.game?.type === 'battle') finishBattle(); else closeRoulette(); }
    else if (b.action === 'close') { clearTimeout(gameTimer); state.game = null; voters.clear(); }
    else return send(res, 400, { error: 'Acción desconocida' });
    broadcast(); send(res, 200, { ok: true });
  },
  'POST /api/beat': async (req, res) => {
    const b = await body(req);
    if (['kick', 'snare', 'drop'].includes(b.k)) {
      const msg = `event: beat\ndata: ${JSON.stringify({ k: b.k, s: Math.max(0, Math.min(1.2, +b.s || 0)) })}\n\n`;
      for (const c of clients) c.write(msg);
    }
    res.writeHead(204); res.end();
  },
  'POST /api/score': async (req, res) => {
    const b = await body(req);
    if (!state.now) return send(res, 400, { error: 'No suena nada' });
    const v = Math.round(+b.value);
    if (b.hide) state.score = { uri: state.now.uri, value: 0, set: false };
    else if (Number.isFinite(v)) {
      const fin = state.score?.uri === state.now.uri && state.score.fin;
      state.score = { uri: state.now.uri, value: Math.max(-50, Math.min(50, v)), set: true, fin: fin || v >= 50 };
      if (v >= 50 && !fin) award(ownerOfNow(), PTS.finalist);
    }
    broadcast(); send(res, 200, state.score);
  },
  'POST /api/fx': async (req, res) => {
    const b = await body(req);
    if (typeof b.cinema === 'boolean') state.fx.cinema = b.cinema;
    if (b.drop) state.fx.drop = Date.now();
    broadcast(); send(res, 200, state.fx);
  },
  'POST /api/tiktok': async (req, res) => { connectTikTok(String((await body(req)).username || '')); send(res, 200, { ok: true }); },
  // simulador para ensayar sin estar en directo
  'POST /api/test': async (req, res) => {
    const on = !!(await body(req)).on;
    if (on && state.tiktok.status === 'on') return send(res, 409, { error: 'Estás en directo: el modo prueba solo se puede usar sin directo' });
    setTest(on); send(res, 200, { test: state.test });
  },
  'POST /api/sim': async (req, res) => {
    const b = await body(req);
    if (!state.test) return send(res, 409, { error: 'Activa el modo prueba para simular' });
    const nick = String(b.nick || 'invitado').slice(0, 40);
    const user = { id: `sim:${nick}`, handle: nick, nick, avatar: '' };
    const count = Math.max(1, Math.min(999, Math.floor(+b.count || 1)));
    if (b.kind === 'reset') { queue.credits = {}; persist(); }
    else if (b.kind === 'gift') onGift(user, Math.max(1, +b.coins || 1) * count, String(b.gift || 'Rosa').slice(0, 40), count, giftImgs[b.gift]?.img || (b.gift === 'Rosa' ? '/img/rosa.png' : '/img/moneda.png'));
    else { gameChat(user, String(b.text || '')); pushChat({ kind: 'chat', user, text: String(b.text || '').slice(0, 300) }); }
    send(res, 200, { ok: true });
  },
};

// En directo no puede caerse: un error inesperado se apunta en data/errores.log y el servidor sigue
const logError = (tipo, e) => { const line = `[${new Date().toISOString()}] ${tipo}: ${e?.stack || e}\n`; console.error(line); try { fs.appendFileSync(path.join(DATA, 'errores.log'), line); } catch {} };
process.on('uncaughtException', e => logError('uncaughtException', e));
process.on('unhandledRejection', e => logError('unhandledRejection', e));

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  const route = routes[`${req.method} ${url.pathname}`];
  if (route) return (async () => route(req, res, url))().catch(e => send(res, 500, { error: e.message }));
  const page = { '/': '/home.html', '/stage': '/stage.html', '/control': '/control.html', '/top': '/top.html' }[url.pathname] || url.pathname;
  const rel = path.posix.normalize(decodeURIComponent(page)).replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
  if (rel.includes('..')) { res.writeHead(403); return res.end(); }
  const type = MIME[path.extname(rel)] || 'application/octet-stream';
  // sin caché: el navegador y LIVE Studio siempre cargan la versión actual (si no, se quedan con pantallas viejas)
  const ok = buf => { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(buf); };
  const notFound = () => { res.writeHead(404); res.end('No existe'); };
  if (rel.startsWith('alerts/')) return fs.readFile(path.join(ALERTS, rel.slice(7)), (err, buf) => err ? notFound() : ok(buf));
  if (PACKED) { try { return ok(Buffer.from(sea.getAsset('public/' + rel))); } catch { return notFound(); } }
  fs.readFile(path.join(DIR, 'public', rel), (err, buf) => err ? notFound() : ok(buf));
}).on('error', e => {
  // ya hay un Sonando abierto: en vez de fallar, se abre su panel y este se cierra
  if (e.code === 'EADDRINUSE') { openPanel(); setTimeout(() => process.exit(0), 500); } else logError('servidor', e);
}).listen(PORT, HOST, () => {
  console.log(`\n  Sonando\n  Pantalla del directo:  http://${HOST}:${PORT}/stage\n  Panel de control:      http://${HOST}:${PORT}/control\n\n  Deja esta ventana abierta mientras estés en directo.\n`);
  if (config.tiktokUser) connectTikTok(config.tiktokUser);
  cloudPull();
  if (PACKED && !process.env.SONANDO_NO_OPEN) openPanel();
});
function openPanel() { if (process.platform === 'win32') exec(`start "" "http://${HOST}:${PORT}/"`); } // abre el menú de inicio
