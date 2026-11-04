import assert from 'node:assert/strict';
import test from 'node:test';
import { translate } from './traducir.js';

const lines = [{ t: 0, text: 'I love you' }, { t: 1, text: '' }, { t: 2, text: 'Thank you' }];
const fake = (from, texts, fail) => async () => { if (fail) throw new Error(fail); return { from, texts }; };

test('traduce verso por verso y deja los huecos', async () => {
  const r = await translate(lines, '', { google: fake('en', ['Te quiero', 'Gracias']) });
  assert.deepEqual(r.lines.map(l => l.tr), ['Te quiero', undefined, 'Gracias']);
  assert.equal(r.by, 'google');
});

test('DeepL primero; si falla, Google', async () => {
  const ok = await translate(lines, 'k:fx', { deepl: fake('en', ['A', 'B']), google: fake('en', ['x', 'y']) });
  assert.equal(ok.by, 'deepl'); assert.equal(ok.lines[0].tr, 'A');
  const ko = await translate(lines, 'k:fx', { deepl: fake('', [], 'DeepL: se acabaron los caracteres'), google: fake('en', ['x', 'y']) });
  assert.equal(ko.by, 'google'); assert.match(ko.error, /caracteres/);
});

test('si ya está en español no se traduce', async () => {
  const r = await translate(lines, '', { google: fake('es', ['I love you', 'Thank you']) });
  assert.equal(r.same, true); assert.equal(r.lines[0].tr, undefined);
});
