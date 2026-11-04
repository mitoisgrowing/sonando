import assert from 'node:assert/strict';
import test from 'node:test';
import { createQueue, add, gift, move, toFront, MAX, HOST } from './queue.js';

const u = n => ({ id: n, nick: n });
const t = n => ({ uri: `spotify:track:${n}`, name: n });
const order = q => q.list.map(e => e.name).join(',');

test('rosa sube 2 puestos, 5 monedas = la siguiente', () => {
  const q = createQueue();
  for (const n of 'abcdef') add(q, t(n), u(n));
  gift(q, u('f'), 1);
  assert.equal(order(q), 'a,b,c,f,d,e');
  gift(q, u('e'), 5);
  assert.equal(order(q), 'e,a,b,c,f,d');
  // 4 rosas sueltas más a f: suma 5, pasa a ser la siguiente detrás de e
  for (let i = 0; i < 4; i++) gift(q, u('f'), 1);
  assert.equal(order(q), 'e,f,a,b,c,d');
  // un +2 no se salta a quien pagó ser la siguiente
  gift(q, u('a'), 1);
  assert.equal(order(q), 'e,f,a,b,c,d');
});

test('cola llena: solo entra quien ha donado', () => {
  const q = createQueue();
  for (let i = 0; i < MAX; i++) add(q, t(`s${i}`), u(`u${i}`));
  assert.equal(add(q, t('x'), u('x')).ok, false);
  gift(q, u('x'), 5); // dona antes de tener canción
  assert.equal(add(q, t('x'), u('x')).ok, true);
  assert.equal(q.list[0].name, 'x');
  assert.equal(q.list.length, MAX + 1);
});

test('el streamer no tiene tope y puede poner la siguiente', () => {
  const q = createQueue();
  for (let i = 0; i < MAX; i++) add(q, t(`s${i}`), u(`u${i}`));
  gift(q, u('u5'), 5);
  assert.equal(add(q, t('mia'), u(HOST), { next: true }).ok, true);
  assert.equal(q.list[0].name, 's5');
  assert.equal(q.list[1].name, 'mia');
});

test('el streamer reordena y pone una delante', () => {
  const q = createQueue();
  for (const n of 'abcd') add(q, t(n), u(n));
  const id = n => q.list.find(e => e.name === n).id;
  assert.equal(move(q, id('c'), -1), true);
  assert.equal(order(q), 'a,c,b,d');
  assert.equal(move(q, id('a'), -1), false); // ya es la primera
  assert.equal(toFront(q, id('d')), true);
  assert.equal(order(q), 'd,a,c,b');
});

test('no duplica canciones', () => {
  const q = createQueue();
  add(q, t('a'), u('1'));
  assert.equal(add(q, t('a'), u('2')).ok, false);
});
