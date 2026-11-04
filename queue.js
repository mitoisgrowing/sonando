// Reglas de la cola. Puro: sin red ni disco, para poder testearlo.
export const MAX = 10;        // tope de la cola para quien no dona
export const NEXT_AT = 5;     // monedas acumuladas en una canción para ser la siguiente
export const STEP = 2;        // puestos que sube cada regalo por debajo de NEXT_AT

export function createQueue() {
  return { list: [], credits: {} }; // credits: monedas de quien dona sin tener canción en cola
}

const isPriority = e => e.coins >= NEXT_AT;

// Devuelve { ok, error?, entry? }
export const HOST = '__host'; // el streamer: sin tope de cola

// next: el streamer la pone la siguiente (detrás de quien ya pagó serlo)
export function add(q, track, user, { next = false } = {}) {
  if (q.list.some(e => e.uri === track.uri)) return { ok: false, error: 'Esa canción ya está en la cola' };
  const credit = q.credits[user.id] || 0;
  if (q.list.length >= MAX && credit <= 0 && user.id !== HOST) return { ok: false, error: `Cola llena (${MAX}). Entra si dona` };
  const entry = { ...track, user, coins: 0, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, addedAt: Date.now() };
  if (next) q.list.splice(q.list.filter(isPriority).length, 0, entry);
  else q.list.push(entry);
  if (credit > 0) { delete q.credits[user.id]; gift(q, user, credit); }
  return { ok: true, entry };
}

// Un regalo ya cerrado (racha terminada). Mueve la primera canción del usuario o guarda el crédito.
export function gift(q, user, coins) {
  const i = q.list.findIndex(e => e.user.id === user.id);
  if (i < 0) { q.credits[user.id] = (q.credits[user.id] || 0) + coins; return { moved: false, credit: q.credits[user.id] }; }
  const [e] = q.list.splice(i, 1);
  e.coins += coins;
  const paidAhead = q.list.filter(isPriority).length; // canciones que ya pagaron ser "la siguiente"
  // Quien llega a NEXT_AT se pone detrás de los que ya lo pagaron; si no, sube STEP sin saltarse a esos.
  const to = isPriority(e) ? paidAhead : Math.max(paidAhead, i - STEP);
  q.list.splice(Math.min(to, i), 0, e);
  return { moved: true, from: i, to: Math.min(to, i), entry: e };
}

export function remove(q, id) {
  const i = q.list.findIndex(e => e.id === id);
  if (i >= 0) q.list.splice(i, 1);
  return i >= 0;
}

// El streamer manda: mueve una canción un puesto arriba (-1) o abajo (+1), sin reglas de monedas
export function move(q, id, dir) {
  const i = q.list.findIndex(e => e.id === id), j = i + Math.sign(dir);
  if (i < 0 || j < 0 || j >= q.list.length || !dir) return false;
  [q.list[i], q.list[j]] = [q.list[j], q.list[i]];
  return true;
}

export function toFront(q, id) {
  const i = q.list.findIndex(e => e.id === id);
  if (i < 0) return false;
  q.list.unshift(...q.list.splice(i, 1));
  return true;
}

export function shift(q) { return q.list.shift() || null; }
