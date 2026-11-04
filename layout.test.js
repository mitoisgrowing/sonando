import assert from 'node:assert/strict';
import test from 'node:test';
import { clean, presetLayout, PRESET_LIST, PIECE_IDS, toastAnchor } from './public/layout.js';
import { snapMove, snapResize } from './public/snap.js';

test('los presets sobreviven a clean sin cambios', () => {
  for (const { key } of PRESET_LIST) { const l = presetLayout(key); assert.deepEqual(clean(l), { ...l, order: l.order }); }
});
test('vacío oculta todo; clásico no oculta nada', () => {
  assert.ok(PIECE_IDS.every(id => presetLayout('vacio').pieces[id].hidden));
  assert.ok(PIECE_IDS.every(id => !presetLayout('clasico').pieces[id].hidden));
});
test('clean rechaza basura y limita valores', () => {
  assert.equal(clean(null), null); assert.equal(clean([]), null);
  const l = clean({ canvas: { w: 99999, h: 'x' }, bg: { mode: 'image', image: '/etc/passwd' }, pieces: { np: { x: 'a', w: -5, color: 'red', opacity: 500 } },
    extras: [{ id: 'xabc1', kind: 'image', src: '/uploads/../x.png' }, { id: 'xabc2', kind: 'text', text: 'hola'.repeat(200) }, { id: 'np', kind: 'text' }] });
  assert.equal(l.canvas.w, 4096); assert.equal(l.canvas.h, 1080); assert.equal(l.bg.mode, 'album');
  assert.equal(l.pieces.np.w, 20); assert.equal(l.pieces.np.color, undefined); assert.equal(l.pieces.np.opacity, undefined);
  assert.equal(l.extras.length, 1); assert.equal(l.extras[0].text.length, 200);
  assert.equal(l.order.length, PIECE_IDS.length + 1);
});
test('anclaje del aviso', () => {
  assert.deepEqual(toastAnchor('top-center', 1920, 1080), { tx: 960, ty: 26, f: 0.5 });
  assert.equal(toastAnchor('bottom-right', 1920, 1080).f, 1);
});

const C = { w: 1920, h: 1080 };
test('imán: bordes del lienzo, márgenes seguros y centro', () => {
  assert.equal(snapMove({ x: 4, y: 500, w: 300, h: 100 }, [], C).rect.x, 0);
  assert.equal(snapMove({ x: 68, y: 500, w: 300, h: 100 }, [], C).rect.x, 72);
  assert.equal(snapMove({ x: 812, y: 500, w: 300, h: 100 }, [], C).rect.x, 810);
  assert.equal(snapMove({ x: 400, y: 500, w: 300, h: 100 }, [], C).rect.x, 400); // lejos de todo
});
test('imán: bordes de otras piezas', () => {
  const o = { x: 1000, y: 100, w: 200, h: 200 };
  const s = snapMove({ x: 1003, y: 300, w: 100, h: 80 }, [o], C);
  assert.equal(s.rect.x, 1000); assert.ok(s.guides.some(g => g.axis === 'x' && g.at === 1000));
});
test('imán: soltar entre dos piezas la centra exacta', () => {
  const a = { x: 100, y: 400, w: 200, h: 100 }, b = { x: 700, y: 400, w: 200, h: 100 }; // hueco 300..700 = 400
  const s = snapMove({ x: 447, y: 410, w: 100, h: 80 }, [a, b], C); // centrada: x = 300 + (400-100)/2 = 450
  assert.equal(s.rect.x, 450); assert.equal(s.gaps.length, 2);
});
test('imán: repetir el hueco que ya hay entre dos', () => {
  const a = { x: 100, y: 400, w: 200, h: 100 }, b = { x: 400, y: 400, w: 200, h: 100 }; // hueco 100
  assert.equal(snapMove({ x: 703, y: 410, w: 150, h: 80 }, [a, b], C).rect.x, 700);
});
test('imán al redimensionar: solo el borde que se mueve', () => {
  const s = snapResize({ x: 100, y: 100, w: 300, h: 200 }, 'se', 97, 3, [], C);
  assert.equal(s.rect.x, 100); assert.equal(s.rect.h, 203);
  const t = snapResize({ x: 100, y: 100, w: 300, h: 200 }, 'se', 1450, 0, [], C); // borde derecho cerca de 1848 (margen) → 1848
  assert.equal(t.rect.x + t.rect.w, 1848);
  const m = snapResize({ x: 100, y: 100, w: 300, h: 200 }, 'se', -290, 0, [], C, 8, { min: { w: 40, h: 40 } });
  assert.equal(m.rect.w, 40);
});

test('textos libres: fuente, grosor, alineación y espaciado se conservan; lo inválido se descarta', () => {
  const l = clean({ extras: [{ id: 'xabc1', kind: 'text', text: 'hola', font: 'anton', weight: 900, align: 'center', ls: 0 },
    { id: 'xabc2', kind: 'text', text: 'x', font: 'comic', weight: 5000, align: 'diagonal', ls: 'a' }] });
  assert.deepEqual([l.extras[0].font, l.extras[0].weight, l.extras[0].align, l.extras[0].ls], ['anton', 900, 'center', 0]);
  assert.deepEqual([l.extras[1].font, l.extras[1].weight, l.extras[1].align, l.extras[1].ls], [undefined, 900, undefined, undefined]);
});
