// Imán del editor: ajusta un rectángulo a los bordes del lienzo, a los márgenes seguros, a los bordes y centros de
// otras piezas y a los huecos iguales entre piezas. Funciones puras: devuelven el rectángulo ajustado y las guías.
export const SAFE = { l: 72, r: 72, t: 60, b: 52 };
const EPS = 0.5;

const AX = {
  x: { pos: 'x', len: 'w', cross: 'y', clen: 'h', lo: 'l', hi: 'r', size: c => c.w },
  y: { pos: 'y', len: 'h', cross: 'x', clen: 'w', lo: 't', hi: 'b', size: c => c.h },
};

// líneas a las que se puede pegar en un eje
function targets(a, others, canvas, safe) {
  const A = AX[a], s = A.size(canvas);
  const t = [{ v: 0, kind: 'edge' }, { v: s, kind: 'edge' }, { v: s / 2, kind: 'center' }, { v: safe[A.lo], kind: 'safe' }, { v: s - safe[A.hi], kind: 'safe' }];
  for (const o of others) { const p = o[A.pos], n = o[A.len]; t.push({ v: p, kind: 'piece', o }, { v: p + n, kind: 'piece', o }, { v: p + n / 2, kind: 'piece', o }); }
  return t;
}

const overlap = (a, b, A) => Math.min(a[A.cross] + a[A.clen], b[A.cross] + b[A.clen]) - Math.max(a[A.cross], b[A.cross]) > 0;

// posiciones que dejan huecos iguales: entre dos piezas, o repitiendo el hueco que ya hay entre dos
function spacing(a, r, others) {
  const A = AX[a], row = others.filter(o => overlap(r, o, A)).sort((p, q) => p[A.pos] - q[A.pos]), out = [];
  const end = o => o[A.pos] + o[A.len], n = r[A.len];
  for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) {
    const P = row[i], N = row[j], room = N[A.pos] - end(P);
    if (room >= n) out.push({ pos: end(P) + (room - n) / 2, between: [P, N], gap: (room - n) / 2 }); // centrada entre las dos
    if (j === i + 1 && room > 0) {
      out.push({ pos: end(N) + room, rep: [P, N], gap: room });            // a la derecha, mismo hueco
      out.push({ pos: P[A.pos] - room - n, rep: [P, N], gap: room, left: true }); // a la izquierda
    }
  }
  return out;
}

function best(cands) { let b = null; for (const c of cands) if (!b || Math.abs(c.d) < Math.abs(b.d)) b = c; return b; }

// guías de la posición final: cada línea objetivo que coincide con un borde/centro del rectángulo
function guidesFor(a, r, probes, tg) {
  const A = AX[a], out = [];
  for (const p of probes) for (const t of tg) {
    if (Math.abs(t.v - (r[A.pos] + p)) > EPS) continue;
    const from = Math.min(r[A.cross], t.o ? t.o[A.cross] : Infinity), to = Math.max(r[A.cross] + r[A.clen], t.o ? t.o[A.cross] + t.o[A.clen] : -Infinity);
    out.push({ axis: a, at: t.v, from: t.o ? from : null, to: t.o ? to : null, kind: t.kind }); // from/to null = de lado a lado del lienzo
  }
  return out.filter((g, i) => out.findIndex(h => h.axis === g.axis && h.at === g.at && h.kind === g.kind && h.from === g.from) === i);
}

// separaciones iguales a dibujar (cada una: eje, tramo y la cruz en la que se miden)
function gapGuides(a, r, e, others) {
  const A = AX[a], gaps = [];
  const seg = (from, to) => gaps.push({ axis: a, from, to, at: r[A.cross] + r[A.clen] / 2 });
  if (e.between) { const [P, N] = e.between; seg(P[A.pos] + P[A.len], r[A.pos]); seg(r[A.pos] + r[A.len], N[A.pos]); }
  else if (e.rep) {
    const [P, N] = e.rep; seg(P[A.pos] + P[A.len], N[A.pos]);
    if (e.left) seg(r[A.pos] + r[A.len], P[A.pos]); else seg(N[A.pos] + N[A.len], r[A.pos]);
  }
  return gaps;
}

// mover: r = {x,y,w,h}; others = rectángulos visibles de las demás piezas; thr en px del lienzo
export function snapMove(r, others, canvas, thr = 8, safe = SAFE) {
  const out = { x: r.x, y: r.y, w: r.w, h: r.h }, guides = [], gaps = [];
  for (const a of ['x', 'y']) {
    const A = AX[a], tg = targets(a, others, canvas, safe), probes = [0, r[A.len] / 2, r[A.len]], cands = [];
    for (const p of probes) for (const t of tg) { const d = t.v - (r[A.pos] + p); if (Math.abs(d) <= thr) cands.push({ d }); }
    for (const e of spacing(a, out, others)) { const d = e.pos - r[A.pos]; if (Math.abs(d) <= thr) cands.push({ d, e }); }
    const b = best(cands);
    if (b) out[A.pos] = r[A.pos] + b.d;
    if (b?.e) gaps.push(...gapGuides(a, out, b.e, others));
    guides.push(...guidesFor(a, out, probes, tg));
  }
  return { rect: out, guides, gaps };
}

// redimensionar por una esquina ('nw' | 'ne' | 'sw' | 'se'): solo los bordes que se mueven se pegan.
// opts.ratio = ancho/alto fijo · opts.min = {w,h}
export function snapResize(r, handle, dx, dy, others, canvas, thr = 8, opts = {}, safe = SAFE) {
  const min = opts.min || { w: 40, h: 40 }, west = handle.includes('w'), north = handle.includes('n');
  let L = r.x + (west ? dx : 0), R = r.x + r.w + (west ? 0 : dx), T = r.y + (north ? dy : 0), B = r.y + r.h + (north ? 0 : dy);
  const guides = [], tgx = targets('x', others, canvas, safe), tgy = targets('y', others, canvas, safe);
  const pull = (v, tg) => { const b = best(tg.map(t => ({ d: t.v - v })).filter(c => Math.abs(c.d) <= thr)); return b ? v + b.d : v; };
  if (west) L = pull(L, tgx); else R = pull(R, tgx);
  if (!opts.ratio) { if (north) T = pull(T, tgy); else B = pull(B, tgy); }
  if (R - L < min.w) { if (west) L = R - min.w; else R = L + min.w; }
  if (B - T < min.h) { if (north) T = B - min.h; else B = T + min.h; }
  if (opts.ratio) { const h = (R - L) / opts.ratio; if (north) T = B - h; else B = T + h; }
  const out = { x: L, y: T, w: R - L, h: B - T };
  guides.push(...guidesFor('x', out, [west ? 0 : out.w], tgx), ...(opts.ratio ? [] : guidesFor('y', out, [north ? 0 : out.h], tgy)));
  return { rect: out, guides, gaps: [] };
}
