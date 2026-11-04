import assert from 'node:assert/strict';
import test from 'node:test';
import { romanizeKo, romanize, scriptOf } from './romaji.js';

test('coreano: enlace, nasales y ㄹ como se pronuncian', () => {
  assert.equal(romanizeKo('각자의 염원이 바래고'), 'gakjaui yeomwoni baraego');
  assert.equal(romanizeKo('오, 발이 닿을 만큼 굳어지면'), 'o, bari daeul mankeum gudeojimyeon');
  assert.equal(romanizeKo('사랑해'), 'saranghae');
  assert.equal(romanizeKo('감사합니다'), 'gamsahamnida');
  assert.equal(romanizeKo('신라'), 'silla');
});

test('detecta el idioma y deja en paz lo que ya es latino', async () => {
  assert.equal(scriptOf([{ text: 'hola que tal' }]), null);
  assert.equal(scriptOf([{ text: '君の名前' }, { text: 'を呼んだ' }]), 'ja');
  assert.equal(scriptOf([{ text: '我爱你' }]), 'zh');
  const r = await romanize([{ t: 0, text: '我爱你' }, { t: 1, text: 'oh yeah' }]);
  assert.deepEqual(r.lines.map(l => l.roman), ['wǒ ài nǐ', 'oh yeah']);
});

test('una versión romanizada subida se usa verso por verso; una traducción no', async () => {
  const { pickRomanized } = await import('./romaji.js');
  const lines = [{ t: 0, text: '사랑해', roman: 'saranghae' }, { t: 1, text: '' }, { t: 2, text: '감사합니다', roman: 'gamsahamnida' }];
  const romanized = '[00:00.00] Saranghae\n[00:02.00] Gamsahamnida';
  const english = '[00:00.00] I love you\n[00:02.00] Thank you so much';
  assert.deepEqual(pickRomanized(lines, [english, romanized]).map(l => l.roman), ['Saranghae', undefined, 'Gamsahamnida']);
  assert.equal(pickRomanized(lines, [english]), null);
});

test('japonés: la っ y las terminaciones no se parten', async () => {
  const { jaFix } = await import('./romaji.js');
  assert.equal(jaFix('" sayonara " dake datsu ta'), '"sayonara" dake datta');
  assert.equal(jaFix('hi ga shizumi dashi ta sora'), 'hi ga shizumi dashita sora');
  assert.equal(jaFix('kasanatte i ta'), 'kasanatte ita');
  assert.equal(jaFix('sono hitokoto de subete ga wakatta'), 'sono hitokoto de subete ga wakatta');
});
