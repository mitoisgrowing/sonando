// Modo demo (?demo en cualquier página): estado inventado para capturas y para enseñar Sonando sin directo.
// Nombres, canciones, letras y portadas son de mentira; las portadas se dibujan aquí mismo.
const cover = (a, b, txt) => 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
  `<rect width="600" height="600" fill="url(#g)"/><circle cx="430" cy="170" r="120" fill="#fff" opacity=".12"/><circle cx="160" cy="470" r="200" fill="#000" opacity=".12"/>` +
  `<text x="44" y="540" font-family="Inter,Arial" font-weight="800" font-size="64" fill="#fff" opacity=".9">${txt}</text></svg>`);

const SONGS = [
  ['Luces de neón', 'Marea Norte', '#ff5e8a', '#4b1d6b', 'LUCES'],
  ['Madrugada', 'Kai Soler', '#1fb6ff', '#0b2b5c', 'MADRUGADA'],
  ['Papel mojado', 'Ruth & Coral', '#ffb347', '#7a2e12', 'PAPEL'],
  ['Satélite', 'Nube Cero', '#7cf2c2', '#0d4b45', 'SATÉLITE'],
  ['Dembow del sur', 'Brasa', '#ff7a45', '#5a0f1f', 'DEMBOW'],
  ['Cristal', 'Vela Roja', '#c6a7ff', '#2a1a55', 'CRISTAL'],
  ['Kilómetro cero', 'Los Faros', '#9be15d', '#1d4a1a', 'KM 0'],
  ['Domingo', 'Alba Rey', '#ffd36e', '#6b4a10', 'DOMINGO'],
  ['Eco', 'Duna', '#6ee7ff', '#183a5a', 'ECO'],
];
const USERS = ['luna.mp3', 'davidd', 'sofi_rk', 'xavi99', 'ana.beats', 'nico808', 'carla.wav', 'iker_trap'].map((n, i) => ({ id: 'demo' + i, nick: n, handle: n, avatar: '' }));
const track = (i, extra = {}) => { const [name, artists, a, b, t] = SONGS[i]; return { id: 'd' + i, uri: 'spotify:track:demo' + i, name, artists, album: name, art: cover(a, b, t), durationMs: 196000 + i * 7000, user: USERS[i % USERS.length], coins: 0, ...extra }; };

const LYRICS = ['Las luces de neón se apagan al salir', 'y el eco de tu voz no deja de seguir', '', 'Te busco entre la gente que no sabe de ti',
  'la ciudad respira lento, yo respiro por ti', 'Si mañana no vuelves, guárdame la canción', 'que bailamos despacio en mitad del salón',
  '', 'Luces de neón, luces de neón', 'todo brilla más contigo en la habitación', 'Luces de neón, luces de neón', 'quédate un minuto más, quédate'];

export function demoState() {
  const start = Date.now() - 52000;
  const now = { ...track(0, { coins: 0 }), progressMs: Date.now() - start, isPlaying: true, at: Date.now(), owned: true };
  const points = { top: [{ id: 'demo1', nick: 'davidd', pts: 128, avatar: '' }, { id: 'demo4', nick: 'ana.beats', pts: 96, avatar: '' }, { id: 'demo2', nick: 'sofi_rk', pts: 71, avatar: '' }], pts: { demo0: 340, demo1: 128, demo2: 71, demo3: 40, demo4: 96, demo5: 22 }, names: {} };
  const chat = [
    ['demo1', 'ponme madrugada de kai soler porfa'], ['demo3', 'que temazo esta 🔥'], ['demo2', 'papel mojado de ruth & coral!!'],
    ['demo5', 'buenas noches a todos'], ['demo4', 'satélite de nube cero'], ['demo6', 'esta canción me recuerda a verano'],
  ].map(([u, text], i) => ({ id: 'c' + i, at: Date.now() - (6 - i) * 9000, kind: 'chat', user: USERS[+u.slice(4)], text }));
  chat.push({ id: 'g1', at: Date.now() - 4000, kind: 'gift', user: USERS[4], coins: 5, count: 5, gift: 'Rosa', image: '/img/rosa.png', text: '5× Rosa', moved: true, to: 0 });
  return {
    build: 'demo', now, upNext: null,
    queue: [track(3, { coins: 5, user: USERS[4] }), track(1, { user: USERS[1] }), track(2, { user: USERS[2] }), track(4), track(5), track(6), track(7), track(8)],
    credits: {}, chat, lyrics: { uri: now.uri, synced: true, lines: LYRICS.map((text, i) => ({ t: 8000 + i * 4200, text })) },
    tiktok: { status: 'on', user: 'tu_canal', error: '' }, spotify: { status: 'ok', error: '' }, manual: false,
    rules: { max: 10, nextAt: 5, step: 2 }, hasClientId: true, settings: { showTop: true, showAlerts: true, showPoints: true, liveDone: true, onboarded: true },
    supabaseUrl: '', redirect: 'http://127.0.0.1:5190/callback', verdict: null, judge: { uri: now.uri, kind: 'liked', loved: true },
    score: { uri: now.uri, value: 32, set: true }, points, cloud: { status: 'off' }, offset: 0, scroll: 0, alerts: [], stats: {}, fx: { cinema: false, drop: 0 }, canLove: true,
  };
}
