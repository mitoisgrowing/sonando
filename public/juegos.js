// Pantalla del directo: ruleta y batalla de canciones, encima de la columna de la letra.
import { esc, avatar, icon } from '/live.js';

const CSS = `
  .stage > .game { position: absolute; z-index: 5; left: 72px; top: 236px; right: 752px; bottom: 190px; display: grid; pointer-events: none;
    transition: opacity 380ms var(--ease-out) 140ms, transform 380ms var(--ease-out) 140ms; } /* entra cuando la letra ya se ha ido */
  .stage > .game[hidden] { display: grid; visibility: hidden; opacity: 0; transform: translateY(16px); transition-delay: 0ms; }
  /* visibility: la letra se anima con WAAPI (opacity y filter con fill: forwards), que pisaría cualquiera de esos dos */
  .stage.gaming .lyrics, .stage.gaming .bigart, .stage.gaming .idle { visibility: hidden; }
  .g-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
  .g-head h2 { font-size: 72px; font-weight: 800; letter-spacing: -0.045em; line-height: .95; }
  .g-head p { font-size: 30px; color: var(--ink-2); margin-top: 14px; letter-spacing: -0.015em; }
  .g-head p b { color: var(--ink); }
  .g-time { flex: none; min-width: 150px; padding: 14px 26px; border-radius: 99px; text-align: center; font-size: 56px; font-weight: 800; letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums; background: rgb(255 255 255 / .08); box-shadow: inset 0 0 0 2px rgb(255 255 255 / .12); }
  .g-time.hurry { color: oklch(0.82 0.16 25); box-shadow: inset 0 0 0 2px oklch(0.7 0.18 25 / .6); }

  /* ruleta: la rueda siempre a la izquierda (se va llenando), la info a la derecha */
  .r-wrap { display: grid; grid-template-columns: 600px 1fr; gap: 60px; align-items: center; height: 100%; }
  .wheel { position: relative; width: 600px; height: 600px; }
  .wheel .disc { position: absolute; inset: 0; will-change: transform; }
  .wheel svg { width: 100%; height: 100%; display: block; overflow: visible; }
  .wheel .s { transition: opacity 600ms ease; }
  .wheel.won .s:not(.w) { opacity: .28; }
  .wheel.won .s.w > path, .wheel.won .s.w > circle { fill: url(#gRose); }
  .wheel .pin { position: absolute; left: 50%; top: -30px; width: 52px; height: 70px; margin-left: -26px; transform-origin: 50% 18px; z-index: 2;
    filter: drop-shadow(0 8px 12px rgb(0 0 0 / .55)); }
  .wheel .hub { position: absolute; left: 50%; top: 50%; width: 112px; height: 112px; margin: -56px; border-radius: 50%; display: grid; place-items: center;
    background: radial-gradient(circle at 35% 30%, #2a2328, #0b0a0c 70%); box-shadow: 0 0 0 5px rgb(255 255 255 / .92), 0 10px 30px rgb(0 0 0 / .6); color: var(--rose); }
  .wheel .hub svg { width: 46px; height: 46px; }
  .r-side { min-width: 0; animation: rin 420ms var(--ease-out) both; }
  .r-side h2 { font-size: 72px; font-weight: 800; letter-spacing: -0.045em; line-height: .95; }
  .r-side .g-time { display: inline-block; margin-top: 22px; font-size: 48px; padding: 10px 24px; min-width: 0; }
  .r-side .how { font-size: 28px; color: var(--ink-2); margin-top: 22px; line-height: 1.25; letter-spacing: -0.015em; }
  .r-side .how b { color: var(--ink); }
  .r-rows { display: grid; gap: 12px; margin-top: 30px; }
  .r-row { display: grid; grid-template-columns: 44px 1fr; gap: 14px; align-items: center; min-width: 0; animation: rin 420ms var(--ease-out) both; }
  .r-row .av { width: 44px; height: 44px; font-size: 18px; }
  .r-row p { min-width: 0; font-size: 24px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .r-row p b { font-weight: 650; color: var(--ink-2); margin-right: 10px; }
  .r-more { margin-top: 14px; font-size: 22px; font-weight: 650; color: var(--ink-3); }
  .r-state { font-size: 30px; color: var(--ink-2); margin-top: 22px; }
  .r-win .av { width: 112px; height: 112px; font-size: 44px; }
  .r-win h3 { font-size: 28px; font-weight: 700; color: var(--ink-2); margin-top: 24px; }
  .r-win h4 { font-size: 62px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .r-win q { font-size: 38px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin-top: 20px; color: var(--ink); quotes: '«' '»';
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  @keyframes rin { from { opacity: 0; transform: translateY(14px); } }

  /* batalla */
  .b-cards { display: grid; grid-template-columns: 1fr auto 1fr; gap: 34px; align-items: center; margin-top: 24px; }
  .game .b-head h2 { font-size: 56px; } .game .b-head p { font-size: 26px; margin-top: 10px; } .game .b-head .g-time { font-size: 46px; padding: 10px 24px; min-width: 0; }
  .b-card { position: relative; display: grid; justify-items: center; gap: 8px; text-align: center; min-width: 0; transition: opacity 500ms ease, transform 600ms var(--ease-drawer), filter 500ms ease; }
  .b-card img { width: 220px; height: 220px; margin-bottom: 6px; background: rgb(255 255 255 / .06); border-radius: 28px; object-fit: cover; box-shadow: 0 30px 60px -20px rgb(0 0 0 / .7); }
  .b-card .tag { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); z-index: 1; font-size: 24px; font-weight: 800; padding: 4px 16px; border-radius: 99px; background: var(--ink); color: #0b0a0c; }
  .b-card h3 { font-size: 34px; font-weight: 780; letter-spacing: -0.03em; line-height: 1.05; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .b-card small { font-size: 22px; color: var(--ink-2); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .b-card.win { transform: scale(1.06); }
  .b-card.win img { box-shadow: 0 0 0 6px var(--ink), 0 30px 70px -18px rgb(0 0 0 / .8); }
  .b-card.lose { opacity: .28; filter: grayscale(.6); transform: scale(.94); }
  .b-vs { width: 110px; height: 110px; border-radius: 50%; display: grid; place-items: center; font-size: 40px; font-weight: 900; letter-spacing: -0.04em;
    background: var(--ink); color: #0b0a0c; box-shadow: 0 20px 40px -10px rgb(0 0 0 / .6); }
  .b-bar { position: relative; height: 22px; margin-top: 28px; border-radius: 99px; overflow: hidden; background: oklch(0.62 0.13 250); }
  .b-bar i { position: absolute; inset: 0; background: var(--rose); transform-origin: left; transform: scaleX(.5); transition: transform 600ms var(--ease-drawer); }
  .b-bar::after { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 3px; margin-left: -1.5px; background: rgb(0 0 0 / .4); }
  .b-nums { display: flex; justify-content: space-between; margin-top: 10px; font-size: 24px; font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; }
  .b-nums b { color: var(--ink); }
  .b-host { text-align: center; margin-top: 4px; font-size: 24px; color: var(--ink-3); }
  .b-host b { color: var(--ink); }
  .b-result { text-align: center; margin-top: 8px; font-size: 30px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 800; letter-spacing: -0.02em; }
  .testchip { position: absolute; z-index: 9; left: 72px; top: 18px; padding: 6px 16px; border-radius: 99px; font-size: 20px; font-weight: 750; letter-spacing: .02em;
    background: oklch(0.82 0.13 80); color: #1a1205; }
  .testchip[hidden] { display: none; }
  @media (prefers-reduced-motion: reduce) { .r-row, .r-side { animation: none; } }
`;

const SPIN_MS = 6600; // el servidor revela a los 7 s
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let mounted = false, chip, box, stage, last = '', rId = null, sideSig = '', wheelSig = '', spin = null;
const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function mount(st) {
  stage = st;
  const css = document.createElement('style'); css.textContent = CSS; document.head.append(css);
  box = document.createElement('section'); box.className = 'game'; box.hidden = true; box.setAttribute('aria-live', 'polite');
  chip = document.createElement('span'); chip.className = 'testchip'; chip.hidden = true; chip.textContent = 'Modo prueba';
  stage.append(box, chip); mounted = true;
  setInterval(tickTime, 250);
}

function tickTime() {
  const el = box?.querySelector('.g-time'); if (!el) return;
  const left = +el.dataset.ends - Date.now();
  el.textContent = fmtT(left); el.classList.toggle('hurry', left < 10000);
}

// rueda: sectores rosa / carbón con luz desde el borde, clavijas en cada división y nombres de dentro hacia fuera
const C = 300, R = 270;
const pt = (a, r) => [C + r * Math.sin(a * Math.PI / 180), C - r * Math.cos(a * Math.PI / 180)];
function wheelSvg(entries, winner = -1) {
  const n = entries.length, seg = 360 / Math.max(n, 1);
  const tone = i => (n % 2 && i === n - 1 && n > 1) ? 'url(#gMid)' : i % 2 ? 'url(#gDark)' : 'url(#gRose)';
  const fs = n <= 8 ? 24 : n <= 14 ? 20 : n <= 24 ? 16 : 0;
  const sectors = !n ? `<circle cx="${C}" cy="${C}" r="${R}" fill="url(#gDark)"/>` : entries.map((e, i) => {
    const a0 = i * seg, a1 = (i + 1) * seg, [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), mid = a0 + seg / 2;
    const shape = n === 1 ? `<circle cx="${C}" cy="${C}" r="${R}" fill="${tone(0)}"/>`
      : `<path d="M${C},${C} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 ${seg > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${tone(i)}" stroke="#0b0a0c" stroke-width="2"/>`;
    const label = fs ? `<text x="${C + R - 22}" y="${C}" transform="rotate(${(mid - 90).toFixed(2)} ${C} ${C})" text-anchor="end" dominant-baseline="central"
      font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="${fs}" fill="#fff" fill-opacity="${i % 2 ? .82 : .96}">${esc(e.user.nick.length > 13 ? e.user.nick.slice(0, 12) + '…' : e.user.nick)}</text>` : '';
    return `<g class="s${i === winner ? ' w' : ''}">${shape}${label}</g>`;
  }).join('');
  const pegs = Array.from({ length: n > 1 ? n : 24 }, (_, i) => { const [x, y] = pt(i * (n > 1 ? seg : 15), R + 13); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="#fff" fill-opacity=".85"/>`; }).join('');
  return `<svg viewBox="0 0 600 600" aria-hidden="true"><defs>
      <radialGradient id="gRose" cx="300" cy="300" r="270" gradientUnits="userSpaceOnUse"><stop offset=".2" stop-color="oklch(0.48 0.17 12)"/><stop offset="1" stop-color="oklch(0.68 0.2 12)"/></radialGradient>
      <radialGradient id="gDark" cx="300" cy="300" r="270" gradientUnits="userSpaceOnUse"><stop offset=".2" stop-color="oklch(0.17 0.02 12)"/><stop offset="1" stop-color="oklch(0.27 0.04 12)"/></radialGradient>
      <radialGradient id="gMid" cx="300" cy="300" r="270" gradientUnits="userSpaceOnUse"><stop offset=".2" stop-color="oklch(0.32 0.09 12)"/><stop offset="1" stop-color="oklch(0.46 0.13 12)"/></radialGradient>
      <linearGradient id="gRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3237"/><stop offset="1" stop-color="#121013"/></linearGradient>
    </defs>
    <circle cx="${C}" cy="${C}" r="${R + 28}" fill="url(#gRim)"/>
    <circle cx="${C}" cy="${C}" r="${R + 28}" fill="none" stroke="rgb(255 255 255 / .12)" stroke-width="2"/>
    ${sectors}
    <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="rgb(0 0 0 / .45)" stroke-width="6"/>
    ${pegs}</svg>`;
}
const PIN = `<svg class="pin" viewBox="0 0 52 70"><path d="M26 68 C20 54 4 38 4 24 A22 22 0 0 1 48 24 C48 38 32 54 26 68 Z" fill="#fff"/><circle cx="26" cy="24" r="8" fill="#0b0a0c"/></svg>`;

// giro propio con rAF: así el puntero "hace clac" cada vez que pasa una clavija
function startSpin(g) {
  const disc = box.querySelector('.disc'), pin = box.querySelector('.pin'), n = g.entries.length, seg = 360 / n;
  const target = 360 * 7 + (360 - (g.winner + 0.5) * seg) + (Math.random() - 0.5) * seg * 0.6; // dentro del sector, no siempre en el centro
  const t0 = performance.now(), dur = reduce ? 1 : SPIN_MS;
  let lastPeg = 0, lastKick = 0;
  spin = { id: g.id, done: false };
  const me = spin;
  const frame = now => {
    if (spin !== me) return;
    const t = Math.min(1, (now - t0) / dur), a = target * (1 - Math.pow(1 - t, 4));
    disc.style.transform = `rotate(${a}deg)`;
    const peg = Math.floor(a / seg);
    if (peg !== lastPeg && now - lastKick > 45 && !reduce) { lastPeg = peg; lastKick = now; pin.animate([{ transform: 'rotate(-16deg)' }, { transform: 'rotate(0)' }], { duration: 170, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }); }
    if (t < 1) requestAnimationFrame(frame);
    else { me.done = true; reveal(); }
  };
  requestAnimationFrame(frame);
}
let lastG = null;
function reveal() {
  const g = lastG; if (!g || g.type !== 'roulette' || g.phase !== 'done' || !spin?.done || spin.id !== g.id) return;
  box.querySelector('.wheel').classList.add('won');
  setSide(g, 'win');
}

function setSide(g, mode) {
  const sig = JSON.stringify([g.id, mode, mode === 'open' && g.entries.map(e => e.user.id + e.text)]);
  if (sig === sideSig) return; const first = !sideSig.startsWith(`["${g.id}","${mode}"`); sideSig = sig;
  const side = box.querySelector('.r-side');
  if (mode === 'open') {
    const recent = g.entries.slice(-5).reverse();
    side.innerHTML = `<h2>Ruleta</h2><span class="g-time" data-ends="${g.endsAt}">${fmtT(g.endsAt - Date.now())}</span>
      <p class="how">Escribe <b>!</b> y tu canción en el chat para entrar.</p>
      ${recent.length ? `<div class="r-rows">${recent.map(e => `<div class="r-row">${avatar(e.user, 44)}<p><b>${esc(e.user.nick)}</b>${esc(e.text)}</p></div>`).join('')}</div>
        ${g.entries.length > 5 ? `<p class="r-more">y ${g.entries.length - 5} más en la rueda</p>` : ''}` : '<p class="r-state">Esperando la primera…</p>'}`;
  } else if (mode === 'spin') side.innerHTML = `<h2>Ruleta</h2><p class="r-state">Girando entre ${g.entries.length} ${g.entries.length === 1 ? 'canción' : 'canciones'}…</p>`;
  else if (mode === 'empty') side.innerHTML = `<h2>Ruleta</h2><p class="r-state">Nadie ha escrito con ! esta vez.</p>`;
  else { const w = g.entries[g.winner]; side.innerHTML = `<div class="r-win">${avatar(w.user, 112)}<h3>Le toca a</h3><h4>${esc(w.user.nick)}</h4><q>${esc(w.text)}</q></div>`; }
  if (first) { side.style.animation = 'none'; side.offsetWidth; side.style.animation = ''; } // entra suave solo al cambiar de fase
}

function renderRoulette(g) {
  if (rId !== g.id) { // una rueda por partida; no se rehace al cambiar de fase
    rId = g.id; sideSig = ''; wheelSig = ''; spin = null;
    box.innerHTML = `<div class="r-wrap"><div class="wheel">${PIN}<div class="disc"></div><span class="hub">${icon.rose}</span></div><div class="r-side"></div></div>`;
  }
  const wsig = g.phase === 'open' ? g.entries.map(e => e.user.id).join('|') : 'frozen:' + g.winner;
  if (wsig !== wheelSig) { wheelSig = wsig; box.querySelector('.disc').innerHTML = wheelSvg(g.entries, g.winner); }
  if (g.phase === 'open') return setSide(g, 'open');
  if (g.phase === 'empty') return setSide(g, 'empty');
  if (!spin) startSpin(g); // también si la pantalla se abre a mitad de giro
  if (!(g.phase === 'done' && spin.done)) setSide(g, 'spin');
  reveal();
}

export function renderGame(S) {
  if (!mounted) return;
  chip.hidden = !S.test;
  const g = S.game; lastG = g;
  stage.classList.toggle('gaming', !!g);
  if (!g) { box.hidden = true; last = ''; rId = null; spin = null; return; }
  box.hidden = false;
  if (g.type === 'roulette') return renderRoulette(g);
  rId = null;
  const sig = JSON.stringify([g.id, g.phase, g.tally, g.host, g.result]);
  if (sig === last) return; last = sig;

  // batalla
  const t = g.tally, done = g.phase === 'done', r = g.result;
  const card = (e, k) => `<div class="b-card ${done && r?.winner ? (r.winner === k ? 'win' : 'lose') : ''}">
      <span class="tag">!${k}</span><img src="${esc(e.art)}" alt=""><h3>${esc(e.name)}</h3><small>${esc(e.artists)}${e.user && e.user.id !== '__host' ? ` · ${esc(e.user.nick)}` : ''}</small></div>`;
  const pct = Math.round((done ? r.final1 : t.final1) * 100);
  box.innerHTML = `<div><div class="g-head b-head"><div><h2>Batalla</h2><p>Vota <b>!1</b> o <b>!2</b> en el chat. Mi voto cuenta la mitad</p></div>
      ${done ? '' : `<span class="g-time" data-ends="${g.endsAt}">${fmtT(g.endsAt - Date.now())}</span>`}</div>
    <div class="b-cards">${card(g.a, 1)}<span class="b-vs">VS</span>${card(g.b, 2)}</div>
    <div class="b-bar"><i style="transform:scaleX(${pct / 100})"></i></div>
    <div class="b-nums"><span><b>${pct}%</b> · ${t.v1} ${t.v1 === 1 ? 'voto' : 'votos'}</span><span>${t.v2} ${t.v2 === 1 ? 'voto' : 'votos'} · <b>${100 - pct}%</b></span></div>
    ${done ? `<p class="b-result">${r.winner ? `Gana la ${r.winner}: ${esc((r.winner === 1 ? g.a : g.b).name)} · suena la siguiente` : 'Empate'}</p>`
      : `<p class="b-host">Mi voto: <b>${g.host ? '!' + g.host : 'todavía no'}</b></p>`}</div>`;
}

export function initGames(stageEl) { mount(stageEl); }
