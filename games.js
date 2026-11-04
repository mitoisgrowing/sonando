// Juegos del directo. Puro: sin red ni disco, para poder probarlo.
//  Ruleta: durante X segundos, cada mensaje que empieza por "!" entra en la ruleta (una entrada por persona,
//          la última sustituye a la anterior). Al cerrar, la rueda elige una al azar.
//  Batalla: dos canciones; el chat vota !1 o !2 (un voto por persona, se puede cambiar). El resultado es
//          50 % chat + 50 % tu voto; si no votas, decide solo el chat.
export const MAX_ENTRIES = 60;

export function startRoulette(secs, now = Date.now()) {
  return { type: 'roulette', id: now.toString(36), phase: 'open', startedAt: now, endsAt: now + secs * 1000, entries: [], banned: [], winner: -1 };
}

export function startBattle(a, b, secs, now = Date.now()) {
  return { type: 'battle', id: now.toString(36), phase: 'open', startedAt: now, endsAt: now + secs * 1000, a, b, votes: {}, host: 0, result: null };
}

// Devuelve true si el mensaje era para el juego (así no se cuenta dos veces para otras cosas)
export function onChat(game, user, text) {
  if (!game || game.phase !== 'open' || !user?.id) return false;
  const t = String(text || '').trim();
  if (game.type === 'roulette') {
    if (game.banned?.includes(user.id)) return false; // lo quitaste: no vuelve a entrar en esta ronda
    const m = t.match(/^!\s*(.{2,80})$/s);
    if (!m) return false;
    const entry = { user, text: m[1].replace(/\s+/g, ' ').trim() };
    const i = game.entries.findIndex(e => e.user.id === user.id);
    if (i >= 0) game.entries[i] = entry; else if (game.entries.length < MAX_ENTRIES) game.entries.push(entry); else return false;
    return true;
  }
  if (game.type === 'battle') {
    const m = t.match(/^!\s*([12])(?!\d)/);
    if (!m) return false;
    game.votes[user.id] = +m[1];
    return true;
  }
  return false;
}

// quitar un pedido de la ruleta (y que esa persona no pueda volver a entrar en esta ronda)
export function kick(game, userId) {
  if (game?.type !== 'roulette' || game.phase !== 'open') return false;
  const n = game.entries.length;
  game.entries = game.entries.filter(e => e.user.id !== userId);
  if (!game.banned.includes(userId)) game.banned.push(userId);
  return game.entries.length < n;
}

export function spin(game, rnd = Math.random) {
  if (game?.type !== 'roulette' || game.phase !== 'open') return game;
  game.phase = game.entries.length ? 'spinning' : 'empty';
  game.winner = game.entries.length ? Math.floor(rnd() * game.entries.length) : -1;
  return game;
}

export function tally(game) {
  const v = Object.values(game.votes || {});
  const v1 = v.filter(x => x === 1).length, v2 = v.filter(x => x === 2).length, total = v1 + v2;
  const chat1 = total ? v1 / total : 0.5;
  const host1 = game.host === 1 ? 1 : game.host === 2 ? 0 : null;
  const final1 = host1 == null ? chat1 : 0.5 * chat1 + 0.5 * host1;
  return { v1, v2, total, chat1, final1 };
}

export function endBattle(game) {
  if (game?.type !== 'battle' || game.phase !== 'open') return game;
  const t = tally(game);
  game.phase = 'done';
  game.result = { ...t, winner: t.final1 > 0.5 ? 1 : t.final1 < 0.5 ? 2 : 0 }; // 0 = empate
  return game;
}
