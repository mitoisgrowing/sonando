// Ajustes (cajón lateral) y tutorial de primera vez del panel de control.
// Todo se guarda en la configuración local de cada usuario a través del servidor.
import { esc, icon } from '/live.js';

const $ = id => document.getElementById(id);
let S = null, api = null, step = 0, tourOpen = false, drawerOpen = false;
// Supabase en el tutorial: lo escrito y el resultado de la comprobación (no se guarda hasta que las tablas existen)
const sb = { url: '', key: '', test: null, sql: '' };
const E_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';

const CSS = `
  .scrim { position: fixed; inset: 0; z-index: 40; background: rgb(0 0 0 / .5); opacity: 0; transition: opacity 260ms ease; }
  .scrim.on { opacity: 1; }
  .drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 41; width: min(440px, 100vw); overflow: auto;
    background: #141316; border-left: 1px solid var(--line); box-shadow: -30px 0 60px -20px rgb(0 0 0 / .6);
    transform: translateX(100%); transition: transform 380ms ${E_DRAWER}; padding: 22px 24px 40px; }
  .drawer.on { transform: none; }
  .drawer h2 { font-size: 18px; font-weight: 750; letter-spacing: -0.02em; display: flex; align-items: center; justify-content: space-between; }
  .drawer h3 { font-size: 13px; font-weight: 700; color: var(--ink-2); margin: 26px 0 10px; }
  .set { display: grid; gap: 8px; }
  .set p { color: var(--ink-2); font-size: 13px; line-height: 1.5; }
  .set .row { display: flex; gap: 8px; }
  .set .row input { flex: 1; }
  .toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
  .toggle span { display: grid; gap: 2px; } .toggle small { color: var(--ink-3); font-size: 12.5px; }
  .switch { position: relative; width: 42px; height: 26px; flex: none; }
  .switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .switch i { position: absolute; inset: 0; border-radius: 99px; background: var(--fill-2); transition: background-color 200ms ease; pointer-events: none; }
  .switch i::after { content: ''; position: absolute; left: 3px; top: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 220ms ${E_DRAWER}; }
  .switch input:checked + i { background: var(--ok); }
  .switch input:checked + i::after { transform: translateX(16px); }
  .switch input:focus-visible + i { outline: 2px solid var(--rose); outline-offset: 2px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-2); }
  code.copy { font-size: 12.5px; padding: 3px 7px; border-radius: 6px; background: var(--fill-2); color: var(--ink); cursor: pointer; user-select: all; }

  .tour { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 20px; background: rgb(5 4 7 / .82); backdrop-filter: blur(14px); }
  .tour[hidden] { display: none; }
  .tcard { width: min(860px, 100%); max-height: calc(100vh - 40px); overflow: auto; display: grid; grid-template-columns: 230px 1fr;
    border-radius: 22px; background: #141316; box-shadow: 0 40px 100px -30px rgb(0 0 0 / .8), inset 0 0 0 1px var(--line); }
  .tsteps { padding: 22px 14px; border-right: 1px solid var(--line); display: grid; align-content: start; gap: 2px; }
  .tsteps b { font-size: 15px; font-weight: 750; padding: 0 10px 14px; letter-spacing: -0.02em; }
  .tsteps button { display: flex; align-items: center; gap: 10px; text-align: left; padding: 9px 10px; border-radius: 10px; color: var(--ink-2); font-size: 13.5px; }
  .tsteps button.cur { background: var(--fill-2); color: var(--ink); }
  .tsteps button small { display: block; color: var(--ink-3); font-size: 11.5px; margin-top: 1px; }
  .tsteps .ck { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; flex: none; box-shadow: inset 0 0 0 1.5px var(--ink-3); font-size: 11px; color: var(--ink-3); }
  .tsteps .ck.done { background: var(--ok); box-shadow: none; color: #0b0a0c; }
  .tsteps .ck svg { width: 13px; height: 13px; stroke-width: 2.6; }
  .tbody { padding: 26px 28px 22px; display: grid; grid-template-rows: auto 1fr auto; gap: 18px; min-height: 420px; }
  .tbody h1 { font-size: 24px; font-weight: 760; letter-spacing: -0.03em; line-height: 1.15; }
  .tbody .txt { display: grid; gap: 12px; align-content: start; color: var(--ink-2); line-height: 1.55; font-size: 14px; }
  .tbody .txt b { color: var(--ink); }
  .tbody ol { padding-left: 18px; display: grid; gap: 8px; }
  .tnav { display: flex; align-items: center; gap: 8px; }
  .tnav .grow { flex: 1; }
  .tprog { height: 4px; border-radius: 9px; background: var(--fill-2); overflow: hidden; }
  .tprog i { display: block; height: 100%; background: var(--ink); transform-origin: left; transition: transform 380ms ${E_DRAWER}; }
  .okline { color: oklch(0.88 0.1 150); font-weight: 600; display: flex; gap: 8px; align-items: center; }
  .tbody .fade { animation: tfade 320ms cubic-bezier(0.23, 1, 0.32, 1); }
  @keyframes tfade { from { opacity: 0; transform: translateY(8px); filter: blur(4px); } }
  @media (max-width: 720px) { .tcard { grid-template-columns: 1fr; } .tsteps { display: none; } }
  @media (prefers-reduced-motion: reduce) { .drawer, .scrim, .tprog i { transition: none; } .tbody .fade { animation: none; } }
`;

// pasos del tutorial: «done» se calcula del estado real, así se marcan solos
const STEPS = [
  { t: 'Bienvenida', done: () => true, html: () => `
      <p>Sonando convierte el chat de tu directo en una <b>cola de canciones de Spotify</b>, con la letra sincronizada en pantalla, tus veredictos (Aprobada, Meh, Saltada), el medidor y los regalos.</p>
      <p>En 5 minutos lo dejas listo. Cada paso se marca solo cuando está hecho y puedes volver aquí cuando quieras desde <b>Ajustes</b>.</p>` },
  { t: 'Crea tu app de Spotify', done: () => S.hasClientId, html: () => `
      <ol>
        <li>Entra en <a class="link" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">developer.spotify.com/dashboard</a> con tu cuenta y pulsa <b>Create app</b>.</li>
        <li>Nombre y descripción, los que quieras. En <b>Redirect URI</b> pega <code class="copy" data-copy="${esc(S.redirect)}">${esc(S.redirect)}</code> y pulsa <b>Add</b>.</li>
        <li>Marca <b>Web API</b>, acepta y guarda. Abre la app, copia el <b>Client ID</b> y pégalo aquí:</li>
      </ol>
      <div class="row" style="display:flex;gap:8px"><input id="tCid" placeholder="Client ID" autocomplete="off" spellcheck="false" style="flex:1"><button class="btn primary" data-act="cid">Guardar</button></div>
      ${S.hasClientId ? '<p class="okline">' + icon.check + 'Client ID guardado</p>' : ''}` },
  { t: 'Conecta Spotify', done: () => S.spotify.status === 'ok', html: () => `
      <p>Ahora dale permiso a Sonando en tu cuenta. Se abre Spotify, aceptas y vuelves aquí solo.</p>
      <p>Con <b>Premium</b> las canciones se ponen solas. Sin Premium funciona en <b>modo manual</b>: Sonando te dice cuál toca y la detecta cuando la pones tú.</p>
      ${S.spotify.status === 'ok' ? '<p class="okline">' + icon.check + 'Spotify conectado</p>' : `<p><a class="btn primary" href="/spotify/login" style="text-decoration:none"${S.hasClientId ? '' : ' aria-disabled="true"'}>Conectar Spotify</a></p>${S.hasClientId ? '' : '<p>Primero guarda el Client ID en el paso anterior.</p>'}`}` },
  { t: 'Conecta TikTok', done: () => !!S.tiktok.user, html: () => `
      <p>Escribe tu usuario de TikTok. Cuando estés <b>en directo</b>, Sonando lee el chat y los regalos (si aún no lo estás, se conectará la próxima vez que abras el programa).</p>
      <div class="row" style="display:flex;gap:8px"><input id="tTt" placeholder="@tu_usuario" value="${S.tiktok.user ? '@' + esc(S.tiktok.user) : ''}" autocomplete="off" spellcheck="false" style="flex:1"><button class="btn primary" data-act="tt">Guardar</button></div>
      ${S.tiktok.status === 'on' ? '<p class="okline">' + icon.check + 'Conectado a tu directo</p>' : S.tiktok.user ? '<p class="okline">' + icon.check + 'Usuario guardado</p>' : ''}` },
  { t: 'Pantalla en LIVE Studio', done: () => !!S.settings?.liveDone, manual: true, html: () => `
      <ol>
        <li>Abre la <a class="link" href="/stage" target="_blank">pantalla del directo</a> en una ventana de tu navegador (puedes ponerla a pantalla completa).</li>
        <li>En <b>TikTok LIVE Studio</b> añade una fuente <b>Captura de ventana</b> y elige esa ventana. Colócala en la franja central de tu directo.</li>
        <li>Opcional: mete GIFs o vídeos en la carpeta de alertas para las donaciones.</li>
      </ol>
      <p><button class="btn" data-act="live">Ya está añadida</button></p>` },
  { t: 'Conecta Supabase', optional: true, done: () => S.cloud?.status === 'ok' || !!sb.test?.ok, html: () => `
      <p><b>Opcional.</b> Los puntos de tus espectadores ya se guardan en tu PC. Con Supabase (gratis) tienes además una copia en la nube y el historial de cada directo.</p>
      <ol>
        <li><a class="link" href="https://supabase.com/dashboard/new" target="_blank" rel="noreferrer">Crea un proyecto en Supabase</a> (o usa uno que ya tengas).</li>
        <li>En <a class="link" href="https://supabase.com/dashboard/project/${esc(sb.test?.ref || '_')}/settings/api-keys" target="_blank" rel="noreferrer">Project Settings → API Keys</a> copia la <b>Project URL</b> y la clave <b>publishable</b>, y pégalas aquí:</li>
      </ol>
      <input id="tSbUrl" placeholder="https://tu-proyecto.supabase.co" value="${esc(sb.url || S.supabaseUrl || '')}" autocomplete="off" spellcheck="false">
      <div style="display:flex;gap:8px"><input id="tSbKey" placeholder="sb_publishable_…" value="${esc(sb.key)}" autocomplete="off" spellcheck="false" style="flex:1"><button class="btn primary" data-act="sbtest">Comprobar conexión</button></div>
      <p>${S.cloud?.status === 'ok' ? '<span class="okline">' + icon.check + 'Ya estás conectado a Supabase</span>'
        : sb.test?.ok ? '<span class="okline">' + icon.check + (sb.test.tables ? 'Conecta y las tablas ya existen: listo' : 'Conecta con tu proyecto. Siguiente: crear las tablas') + '</span>'
        : sb.test ? '<span class="err">' + esc(sb.test.error) + '</span>' : ''}</p>` },
  { t: 'Crea las tablas', optional: true, done: () => S.cloud?.status === 'ok', html: () => `
      ${!sb.test?.ok && S.cloud?.status !== 'ok' ? '<p>Primero comprueba la conexión en el paso anterior.</p>' : `
      <ol>
        <li>Copia este SQL: <button class="btn" data-act="sql">Copiar SQL</button></li>
        <li>Ábrelo en el <a class="link" href="https://supabase.com/dashboard/project/${esc(sb.test?.ref || (S.supabaseUrl || '').slice(8).split('.')[0])}/sql/new" target="_blank" rel="noreferrer">SQL Editor de tu proyecto</a>, pégalo y pulsa <b>Run</b>.</li>
        <li>Vuelve aquí y pulsa <b>Comprobar tablas</b>.</li>
      </ol>
      <textarea readonly rows="7" style="width:100%;font:12px/1.5 ui-monospace,Consolas,monospace;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--fill);color:var(--ink-2);resize:vertical">${esc(sb.sql)}</textarea>
      <p><button class="btn primary" data-act="sbtables">Comprobar tablas y guardar</button></p>
      <p>${S.cloud?.status === 'ok' ? '<span class="okline">' + icon.check + 'Tablas listas: los puntos ya se guardan en Supabase</span>' : sb.test?.tables === false ? '<span class="err">Aún no encuentro las tablas: ¿has pulsado Run en el SQL Editor?</span>' : ''}</p>`}` },
  { t: 'Ritmo y extras', optional: true, done: () => !!S.settings?.onboarded, html: () => `
      <p><b>Activar ritmo</b> (en la columna de la cola): compartes tu pantalla con el audio del sistema y el fondo del directo late con el bombo y la caja.</p>
      <p><b>Prueba</b> (arriba): manda mensajes y regalos de mentira para ensayar sin estar en directo. No se guarda nada y al volver a <b>Real</b> todo queda como estaba.</p>
      <p>En <b>Ajustes</b> puedes enseñar u ocultar el top 3, las notificaciones de donación y los puntos del chat.</p>` },
];

function renderTour() {
  if (!tourOpen) return;
  const st = STEPS[step];
  const list = '<b>Primeros pasos</b>' + STEPS.map((x, i) => `
    <button data-go="${i}" class="${i === step ? 'cur' : ''}"><span class="ck ${x.done() ? 'done' : ''}">${x.done() ? icon.check : i + 1}</span><span>${esc(x.t)}${x.optional ? '<small>Opcional</small>' : ''}</span></button>`).join('');
  if ($('tSteps').dataset.sig !== list) { $('tSteps').dataset.sig = list; $('tSteps').innerHTML = list; }
  const body = $('tBody');
  // solo se redibuja si cambia lo que se ve (el servidor manda estado cada 1,5 s); la entrada animada, solo al cambiar de paso
  const typing = body.contains(document.activeElement) && document.activeElement.matches('input, textarea');
  const newStep = body.dataset.step !== String(step);
  if (typing && !newStep) return; // no tocar mientras escribes
  const html = `<div><div class="tprog"><i style="transform:scaleX(${(step + 1) / STEPS.length})"></i></div></div>
      <div class="txt${newStep ? ' fade' : ''}"><h1>${esc(st.t)}</h1>${st.html()}</div>
      <div class="tnav">
        <button class="btn" data-act="skip">Saltar tutorial</button><span class="grow"></span>
        ${step ? '<button class="btn" data-act="prev">Anterior</button>' : ''}
        <button class="btn primary" data-act="${step === STEPS.length - 1 ? 'finish' : 'next'}">${step === STEPS.length - 1 ? 'Empezar' : st.optional && !st.done() ? 'Saltar este paso' : 'Siguiente'}</button>
      </div>`;
  const sig = html.replace(' fade', '');
  if (!newStep && body.dataset.sig === sig) return;
  body.dataset.step = step; body.dataset.sig = sig;
  body.innerHTML = html;
}

function openTour(at = null) {
  tourOpen = true; $('tour').hidden = false;
  step = at ?? Math.max(0, STEPS.findIndex((x, i) => i > 0 && !x.done() && !x.optional));
  if (step < 0) step = 0;
  $('tBody').dataset.step = ''; renderTour();
  $('tour').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease' });
  $('tour').querySelector('.tcard').animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
}
function closeTour() {
  tourOpen = false;
  api('/api/settings', { onboarded: true });
  $('tour').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease' }).finished.then(() => { $('tour').hidden = true; });
}

function renderDrawer() {
  if (!drawerOpen) return;
  const st = S.settings || {};
  const tg = (k, t, d) => `<label class="toggle"><span>${t}<small>${d}</small></span><span class="switch"><input type="checkbox" data-set="${k}" ${st[k] ? 'checked' : ''}><i></i></span></label>`;
  const focused = $('drawer').contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox])');
  if (focused) return; // no repintar mientras escribes
  const dhtml = `
    <h2>Ajustes <button class="btn icon" data-act="close" aria-label="Cerrar ajustes">${icon.x}</button></h2>
    <h3>TikTok</h3>
    <div class="set">
      <p>${S.tiktok.status === 'on' ? 'Conectado a tu directo' : S.tiktok.error ? esc(S.tiktok.error) : S.tiktok.user ? 'Se conecta cuando estés en directo' : 'Escribe tu usuario'}</p>
      <div class="row"><input id="dTt" placeholder="@tu_usuario" value="${S.tiktok.user ? '@' + esc(S.tiktok.user) : ''}" autocomplete="off" spellcheck="false"><button class="btn" data-act="dtt">${S.tiktok.status === 'on' ? 'Reconectar' : 'Conectar'}</button></div>
    </div>
    <h3>Spotify</h3>
    <div class="set">
      <p>${S.spotify.status === 'ok' ? (S.manual ? 'Conectado · modo manual (sin Premium)' : 'Conectado') : S.hasClientId ? 'Sin conectar' : 'Falta tu Client ID'}</p>
      <div class="row"><input id="dCid" placeholder="${S.hasClientId ? 'Client ID guardado (pega otro para cambiarlo)' : 'Client ID'}" autocomplete="off" spellcheck="false"><button class="btn" data-act="dcid">Guardar</button></div>
      <p><a class="btn" href="/spotify/login" style="text-decoration:none;display:inline-flex">Reconectar Spotify</a></p>
      <p>Redirect URI: <code class="copy" data-copy="${esc(S.redirect)}">${esc(S.redirect)}</code></p>
    </div>
    <h3>Puntos en Supabase <span class="chip">· opcional</span></h3>
    <div class="set">
      <p>${S.cloud?.status === 'ok' ? 'Sincronizando · ' + esc(S.supabaseUrl) : S.cloud?.status === 'error' ? '<span class="err">' + esc(S.cloud.error).slice(0, 160) + '</span>' : 'Sin configurar: los puntos solo se guardan en este PC.'}</p>
      <input id="dSbUrl" placeholder="https://tu-proyecto.supabase.co" value="${esc(S.supabaseUrl || '')}" autocomplete="off" spellcheck="false">
      <div class="row"><input id="dSbKey" placeholder="Clave (sb_publishable_… o sb_secret_…)" autocomplete="off" spellcheck="false"><button class="btn" data-act="dsb">Conectar</button></div>
      <div class="row"><button class="btn" data-act="sql">Copiar SQL de las tablas</button>${S.supabaseUrl ? '<button class="btn" data-act="sboff">Desconectar</button>' : ''}</div>
    </div>
    <h3>Pantalla del directo</h3>
    <div class="set">
      ${tg('showTop', 'Top 3 del directo', 'Quién lleva más puntos, debajo de la cola')}
      ${tg('showAlerts', 'Notificaciones de donación', 'La isla negra de arriba cuando alguien regala')}
      ${tg('showPoints', 'Puntos en el chat', 'Los puntos de cada uno junto a su nombre en este panel')}
    </div>
    <h3>Tus datos</h3>
    <div class="set"><p>Puntos, cola y configuración se guardan en este PC${S.cloud?.status === 'ok' ? ' (y una copia en Supabase)' : ''}: <code class="copy" data-copy="${esc(S.dataDir || '')}">${esc(S.dataDir || '')}</code></p>
      <p><button class="btn" data-act="opendata">Abrir carpeta de datos</button></p></div>
    <h3>Pantallas para LIVE Studio</h3>
    <div class="set"><div class="row"><a class="btn" href="/stage" target="_blank" style="text-decoration:none">Pantalla del directo</a></div></div>
    <h3>Ayuda</h3>
    <div class="set"><p><button class="btn" data-act="tour">Ver el tutorial otra vez</button></p></div>`;
  if ($('drawer').dataset.sig !== dhtml) { $('drawer').dataset.sig = dhtml; $('drawer').innerHTML = dhtml; }
}
function openDrawer() { drawerOpen = true; $('scrim').hidden = false; renderDrawer(); requestAnimationFrame(() => { $('scrim').classList.add('on'); $('drawer').classList.add('on'); }); }
function closeDrawer() { drawerOpen = false; $('scrim').classList.remove('on'); $('drawer').classList.remove('on'); setTimeout(() => { if (!drawerOpen) $('scrim').hidden = true; }, 380); }

async function copySql(btn) {
  const sql = await (await fetch('/supabase.sql')).text();
  await navigator.clipboard.writeText(sql);
  const old = btn.innerHTML; btn.innerHTML = `${icon.check}Copiado`; setTimeout(() => btn.innerHTML = old, 1400);
}
async function saveSupabase(url, key, msgEl) {
  try { await api('/api/supabase', { url, key }); } catch (e) { if (msgEl) msgEl.innerHTML = `<span class="err">${esc(e.message)}</span>`; }
}

async function onAct(e) {
  const copy = e.target.closest('[data-copy]');
  if (copy) { navigator.clipboard.writeText(copy.dataset.copy); copy.textContent = 'Copiado'; setTimeout(() => copy.textContent = copy.dataset.copy, 1200); return; }
  const go = e.target.closest('[data-go]'); if (go) { step = +go.dataset.go; if (STEPS[step].t === 'Crea las tablas' && !sb.sql) sb.sql = await (await fetch('/supabase.sql')).text(); renderTour(); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'next') { step = Math.min(STEPS.length - 1, step + 1); if (STEPS[step].t === 'Crea las tablas' && !sb.sql) sb.sql = await (await fetch('/supabase.sql')).text(); renderTour(); }
  else if (a === 'prev') { step = Math.max(0, step - 1); renderTour(); }
  else if (a === 'skip' || a === 'finish') closeTour();
  else if (a === 'cid') { const v = $('tCid').value.trim(); if (v) await api('/api/spotify-client', { clientId: v }); }
  else if (a === 'dcid') { const v = $('dCid').value.trim(); if (v) await api('/api/spotify-client', { clientId: v }); $('dCid').value = ''; renderDrawer(); }
  else if (a === 'dtt') { const v = $('dTt').value.trim(); if (v) await api('/api/tiktok', { username: v }); }
  else if (a === 'tt') { const v = $('tTt').value.trim(); if (v) await api('/api/tiktok', { username: v }); }
  else if (a === 'live') { step = Math.min(STEPS.length - 1, step + 1); renderTour(); api('/api/settings', { liveDone: true }).catch(() => {}); }
  else if (a === 'sql') copySql(b);
  else if (a === 'sbtest' || a === 'sbtables') {
    if (a === 'sbtest') { sb.url = $('tSbUrl').value.trim(); sb.key = $('tSbKey').value.trim(); }
    b.disabled = true; b.textContent = 'Comprobando…';
    sb.test = await (await fetch('/api/supabase-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: sb.url || S.supabaseUrl, key: sb.key }) })).json();
    if (sb.test.ok && sb.test.tables) await saveSupabase(sb.url || S.supabaseUrl, sb.key); // solo se guarda cuando todo está listo
    $('tBody').dataset.sig = ''; renderTour();
  }
  else if (a === 'dsb') { await saveSupabase($('dSbUrl').value, $('dSbKey').value); $('dSbKey').value = ''; }
  else if (a === 'sboff') await api('/api/supabase', { url: '', key: '' });
  else if (a === 'opendata') api('/api/open-data', {});
  else if (a === 'close') closeDrawer();
  else if (a === 'tour') { closeDrawer(); openTour(0); }
}

export function mountAjustes(apiFn) {
  api = apiFn;
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  document.body.insertAdjacentHTML('beforeend', `
    <div class="scrim" id="scrim" hidden></div>
    <aside class="drawer" id="drawer" aria-label="Ajustes"></aside>
    <div class="tour" id="tour" hidden role="dialog" aria-modal="true" aria-label="Primeros pasos"><div class="tcard"><nav class="tsteps" id="tSteps"></nav><div class="tbody" id="tBody"></div></div></div>`);
  $('scrim').onclick = closeDrawer;
  $('drawer').addEventListener('click', onAct); $('tour').addEventListener('click', onAct);
  $('drawer').addEventListener('change', e => { const k = e.target.dataset.set; if (k) api('/api/settings', { [k]: e.target.checked }); });
  addEventListener('keydown', e => { if (e.key === 'Escape') { if (drawerOpen) closeDrawer(); } });
  return { openDrawer };
}

let firstState = true;
export function updateAjustes(state) {
  S = state;
  if (firstState) { firstState = false; if (!S.settings?.onboarded || new URLSearchParams(location.search).has('tour')) openTour(new URLSearchParams(location.search).has('tour') ? 1 : null); }
  renderTour(); renderDrawer();
}
