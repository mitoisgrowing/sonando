// Diseño de la pantalla del directo: cada parte es una «pieza» con su rectángulo y su estilo.
// Lo usan el servidor (validar y guardar), la pantalla (/stage) y el editor (/editor).
export const PIECE_IDS = ['np', 'lyrics', 'queue', 'top', 'meter', 'bar', 'toast', 'game', 'idle'];
export const LABELS = {
  np: 'Canción que suena', lyrics: 'Letra y portada grande', queue: 'Cola', top: 'Top del directo', meter: 'Medidor',
  bar: 'Barra de progreso', toast: 'Avisos de regalos', game: 'Juegos', idle: 'Pantalla en espera',
};
export const TOAST_POS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
export const TOAST_OPEN = { w: 1000, h: 138 }; // tamaño aproximado de la isla abierta (para dibujarla en el editor)
// tipografías para los textos libres (se cargan de Google Fonts en /stage y en el editor; si no hay red, cae a la del sistema)
export const FONTS = {
  inter: { label: 'Inter', css: "'Inter', system-ui, sans-serif" },
  anton: { label: 'Anton · titular', css: "'Anton', 'Impact', sans-serif" },
  bebas: { label: 'Bebas Neue · mayúsculas', css: "'Bebas Neue', 'Impact', sans-serif" },
  playfair: { label: 'Playfair · elegante', css: "'Playfair Display', Georgia, serif" },
  mono: { label: 'Space Mono · máquina', css: "'Space Mono', ui-monospace, monospace" },
  pacifico: { label: 'Pacifico · a mano', css: "'Pacifico', cursive" },
};
export const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Pacifico&family=Playfair+Display:wght@400..900&family=Space+Mono:wght@400;700&display=swap';
const DEFAULT_ORDER = ['idle', 'lyrics', 'np', 'queue', 'top', 'meter', 'bar', 'game', 'toast']; // de atrás a delante

// El aspecto de siempre expresado en rectángulos (lienzo de 1920×1080)
const PANEL = { bg: '#0a060c', bgA: 34, radius: 34 };
const CLASSIC = {
  np: { x: 72, y: 60, w: 1096, h: 136 },
  lyrics: { x: 72, y: 220, w: 1096, h: 660 },
  queue: { x: 1248, y: 60, w: 600, h: 616, ...PANEL },
  top: { x: 1248, y: 676, w: 600, h: 294, ...PANEL },
  meter: { x: 72, y: 895, w: 1096, h: 75 },
  bar: { x: 72, y: 998, w: 1776, h: 30 },
  toast: { pos: 'top-center' },
  game: { x: 72, y: 236, w: 1096, h: 654 },
  idle: { x: 72, y: 300, w: 1096, h: 430 },
};

const base = () => ({ v: 1, canvas: { w: 1920, h: 1080 }, bg: { mode: 'album', color: '#0b0a0c', image: '' }, pieces: structuredClone(CLASSIC), extras: [], order: [...DEFAULT_ORDER] });
const put = (l, id, r) => { Object.assign(l.pieces[id], r); return l; };
const hide = (l, ...ids) => { for (const i of ids) l.pieces[i].hidden = true; return l; };

export const PRESETS = {
  clasico: { label: 'Clásico', build: base },
  letra: {
    label: 'Solo letra', build() {
      const l = base();
      put(l, 'lyrics', { x: 160, y: 100, w: 1600, h: 800 }); put(l, 'meter', { x: 160, y: 915, w: 1600, h: 75 });
      put(l, 'game', { x: 160, y: 120, w: 1600, h: 760 }); put(l, 'idle', { x: 160, y: 300, w: 1600, h: 430 });
      return hide(l, 'np', 'queue', 'top', 'bar');
    },
  },
  minimal: {
    label: 'Minimal', build() {
      const l = base();
      put(l, 'np', { x: 160, y: 380, w: 1600, h: 136 }); put(l, 'bar', { x: 160, y: 560, w: 1600, h: 30 });
      put(l, 'idle', { x: 160, y: 300, w: 1600, h: 430 });
      return hide(l, 'lyrics', 'queue', 'top', 'meter');
    },
  },
  vertical: {
    label: 'Vertical 9:16', build() {
      const l = base(); l.canvas = { w: 1080, h: 1920 };
      put(l, 'np', { x: 60, y: 110, w: 960, h: 136 }); put(l, 'lyrics', { x: 60, y: 290, w: 960, h: 980, size: 80 });
      put(l, 'meter', { x: 60, y: 1290, w: 960, h: 75 }); put(l, 'queue', { x: 60, y: 1390, w: 960, h: 400 });
      put(l, 'bar', { x: 60, y: 1830, w: 960, h: 30 }); put(l, 'game', { x: 60, y: 290, w: 960, h: 980 }); put(l, 'idle', { x: 60, y: 700, w: 960, h: 460 });
      return hide(l, 'top');
    },
  },
  vacio: { label: 'Vacío', build() { return hide(base(), ...PIECE_IDS); } },
};
export const PRESET_LIST = Object.entries(PRESETS).map(([key, p]) => ({ key, label: p.label }));
export const presetLayout = key => { const p = PRESETS[key]; if (!p) return null; const l = p.build(); l.base = key; return l; };

// ---------- validar lo que llega (del disco o de la red) ----------
const int = (v, lo, hi, d) => (v === null || v === '' || !Number.isFinite(+v)) ? d : Math.min(hi, Math.max(lo, Math.round(+v)));
const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : undefined;
const upl = v => typeof v === 'string' && /^\/uploads\/[\w.\-]{1,120}$/.test(v) && !v.includes('..') ? v : '';
const text = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';

// estilo común a piezas y extras; solo se guarda lo que se sale del valor por defecto
function look(p, o, size) {
  const c = hex(p.color); if (c) o.color = c;
  const bg = hex(p.bg); if (bg) { o.bg = bg; o.bgA = int(p.bgA, 0, 100, 100); }
  const op = int(p.opacity, 0, 100, 100); if (op < 100) o.opacity = op;
  const rd = int(p.radius, 0, 300, 0); if (rd) o.radius = rd;
  const sh = int(p.shadow, 0, 100, 0); if (sh) o.shadow = sh;
  if (size) { const s = int(p.size, size[0], size[1], size[2]); if (s !== size[2] || size[3]) o.size = s; }
  if (p.hidden === true) o.hidden = true;
  return o;
}

function piece(id, p) {
  const d = CLASSIC[id], src = p && typeof p === 'object' ? p : d;
  if (id === 'toast') return look(src, { pos: TOAST_POS.includes(src.pos) ? src.pos : 'top-center' }, [40, 250, 100]);
  return look(src, { x: int(src.x, -2000, 6000, d.x), y: int(src.y, -2000, 6000, d.y), w: int(src.w, 20, 8000, d.w), h: int(src.h, 20, 8000, d.h) }, [40, 250, 100]);
}

function extra(e) {
  if (!e || typeof e !== 'object' || !/^x[a-z0-9]{3,10}$/.test(e.id) || (e.kind !== 'text' && e.kind !== 'image')) return null;
  const o = { id: e.id, kind: e.kind, x: int(e.x, -2000, 6000, 100), y: int(e.y, -2000, 6000, 100), w: int(e.w, 20, 8000, 400), h: int(e.h, 20, 8000, 120) };
  if (e.kind === 'image') { o.src = upl(e.src); if (!o.src) return null; o.ar = Math.min(20, Math.max(0.05, +e.ar || o.w / o.h)); return look(e, o); }
  o.text = text(e.text, 200);
  look(e, o, [8, 400, 64, true]);
  if (FONTS[e.font] && e.font !== 'inter') o.font = e.font;
  const w = int(e.weight, 100, 900, 0); if (w) o.weight = w;
  if (e.align === 'center' || e.align === 'right') o.align = e.align;
  if (e.ls !== null && e.ls !== '' && Number.isFinite(+e.ls)) o.ls = int(e.ls, -20, 100, 0); // espaciado entre letras en centésimas de em
  return o;
}

export function clean(l) {
  if (!l || typeof l !== 'object' || Array.isArray(l)) return null;
  const b = l.bg || {};
  const bg = { mode: ['album', 'solid', 'transparent', 'image'].includes(b.mode) ? b.mode : 'album', color: hex(b.color) || '#0b0a0c', image: upl(b.image) };
  if (bg.mode === 'image' && !bg.image) bg.mode = 'album';
  const pieces = {}; for (const id of PIECE_IDS) pieces[id] = piece(id, l.pieces?.[id]);
  const seen = new Set(PIECE_IDS);
  const extras = (Array.isArray(l.extras) ? l.extras : []).slice(0, 40).map(extra).filter(e => e && !seen.has(e.id) && seen.add(e.id));
  const all = [...DEFAULT_ORDER, ...extras.map(e => e.id)];
  const order = [...new Set([...(Array.isArray(l.order) ? l.order : []).filter(i => all.includes(i)), ...all])];
  const out = { v: 1, canvas: { w: int(l.canvas?.w, 320, 4096, 1920), h: int(l.canvas?.h, 320, 4096, 1080) }, bg, pieces, extras, order };
  if (typeof l.base === 'string' && /^[\w:\- áéíóúñÁÉÍÓÚÑ]{1,40}$/.test(l.base)) out.base = l.base;
  return out;
}

// dónde ancla el aviso de regalo: x/y del punto de anclaje y f = qué parte del ancho queda a su izquierda (0, .5, 1)
export function toastAnchor(pos, cw, ch) {
  const [v, h] = pos.split('-');
  return { tx: h === 'left' ? 40 : h === 'right' ? cw - 40 : cw / 2, ty: v === 'top' ? 26 : ch - 26 - TOAST_OPEN.h, f: h === 'left' ? 0 : h === 'right' ? 1 : 0.5 };
}
