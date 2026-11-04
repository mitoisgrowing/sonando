import assert from 'node:assert/strict';
import test from 'node:test';
import { startRoulette, startBattle, onChat, spin, endBattle, kick, MAX_ENTRIES } from './games.js';

const u = n => ({ id: n, nick: n });

test('ruleta: solo entran mensajes con !, una entrada por persona', () => {
  const g = startRoulette(60, 0);
  assert.equal(onChat(g, u('a'), 'hola'), false);
  assert.equal(onChat(g, u('a'), '!luces de neón'), true);
  assert.equal(onChat(g, u('b'), '! madrugada  kai soler'), true);
  onChat(g, u('a'), '!papel mojado'); // la última sustituye
  assert.deepEqual(g.entries.map(e => e.text), ['papel mojado', 'madrugada kai soler']);
  assert.equal(onChat(g, u('c'), '!'), false); // vacío no cuenta
});

test('ruleta: tope de entradas y giro', () => {
  const g = startRoulette(60, 0);
  for (let i = 0; i < MAX_ENTRIES + 5; i++) onChat(g, u('u' + i), '!canción ' + i);
  assert.equal(g.entries.length, MAX_ENTRIES);
  spin(g, () => 0.999);
  assert.equal(g.phase, 'spinning');
  assert.equal(g.winner, MAX_ENTRIES - 1);
  assert.equal(onChat(g, u('tarde'), '!llego tarde'), false); // cerrada
  const vacia = spin(startRoulette(60, 0));
  assert.equal(vacia.phase, 'empty');
});

test('batalla: un voto por persona y tu voto vale la mitad', () => {
  const g = startBattle({ id: 'A' }, { id: 'B' }, 45, 0);
  onChat(g, u('a'), '!1'); onChat(g, u('b'), '!1'); onChat(g, u('c'), '!2 esta mejor'); onChat(g, u('a'), '!2'); // a cambia
  assert.equal(onChat(g, u('d'), '!12'), false);
  // chat: 1 voto a la 1, 2 a la 2 → la 2 gana con solo chat
  assert.equal(endBattle(structuredClone(g)).result.winner, 2);
  // tu voto a la 1: 0.5·(1/3) + 0.5·1 = 0.667 → gana la 1
  g.host = 1;
  const r = endBattle(g).result;
  assert.equal(r.winner, 1);
  assert.equal(Math.round(r.final1 * 1000), 667);
});

test('ruleta: quitar un pedido y que no vuelva a entrar', () => {
  const g = startRoulette(60, 0);
  onChat(g, u('a'), '!uno'); onChat(g, u('b'), '!dos');
  assert.equal(kick(g, 'a'), true);
  assert.deepEqual(g.entries.map(e => e.user.id), ['b']);
  assert.equal(onChat(g, u('a'), '!otra vez'), false);
});
