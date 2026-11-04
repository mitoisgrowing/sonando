// Estado en vivo desde el servidor + utilidades compartidas por las dos pantallas.
export function subscribe(fn) {
  // ?demo: datos inventados (capturas y enseñar Sonando sin estar en directo); no se conecta al servidor
  if (new URLSearchParams(location.search).has('demo')) {
    import('/demo.js').then(({ demoState }) => { const s = demoState(); fn(s); setInterval(() => fn({ ...s, now: { ...s.now, at: s.now.at } }), 1500); });
    return { addEventListener() {} };
  }
  const es = new EventSource('/events');
  let build = null;
  es.onmessage = e => {
    const s = JSON.parse(e.data);
    // el servidor se ha reiniciado con una versión nueva: recarga para no quedarse con código viejo
    if (build && s.build && s.build !== build) return location.reload();
    build = s.build;
    fn(s);
  };
  return es;
}

// Progreso interpolado entre sondeos (el servidor pregunta a Spotify cada 1,5 s)
export function progressOf(now) {
  if (!now?.at) return 0;
  return Math.min(now.durationMs, now.progressMs + (now.isPlaying ? Date.now() - now.at : 0));
}

export const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const svg = d => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icon = {
  rose: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.2c1.6 0 3 .8 3.8 2 1.6.1 2.9 1.4 2.9 3.1 0 3.1-2.9 5.3-6.7 5.3S5.3 11.4 5.3 8.3c0-1.7 1.3-3 2.9-3.1.8-1.2 2.2-2 3.8-2Z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M12 13.8V21m0-3.6c-1.4-1.6-3.2-2-4.6-1.5m4.6.1c1.2-1.3 2.8-1.8 4.3-1.4"/></svg>`,
  skip: svg('<path d="M5 5.5v13l9-6.5-9-6.5Z" fill="currentColor"/><path d="M18 5v14"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 5.5v-.2A1.8 1.8 0 0 0 13.7 3.5H5.3a1.8 1.8 0 0 0-1.8 1.8v8.4a1.8 1.8 0 0 0 1.8 1.8h.2"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  up: svg('<path d="m6 15 6-6 6 6"/>'),
  down: svg('<path d="m6 9 6 6 6-6"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  play: svg('<path d="M7 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/>'),
};

// Foto de perfil encima de una inicial con color estable por usuario: si la foto no carga
// (los enlaces de TikTok caducan) se quita sola y queda la inicial, nunca un círculo negro
export function avatar(user, size = 32) {
  let h = 0; for (const c of user?.id || '?') h = (h * 31 + c.charCodeAt(0)) % 360;
  const src = user?.avatar && /^https?:/.test(user.avatar) && !/\/img\//.test(user.avatar) ? `/api/avatar?u=${encodeURIComponent(user.avatar)}` : user?.avatar;
  const img = src ? `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit">` : '';
  return `<span class="av" style="background:oklch(0.42 0.09 ${h});width:${size}px;height:${size}px">${esc((user?.nick || '?')[0].toUpperCase())}${img}</span>`;
}

// FLIP: anima los elementos que cambian de sitio al re-renderizar una lista
export function flip(container, render, scale = 1) {
  const before = new Map([...container.children].map(el => [el.dataset.key, el.getBoundingClientRect().top]));
  render();
  for (const el of container.children) {
    const top = before.get(el.dataset.key);
    if (top == null) continue;
    const dy = (top - el.getBoundingClientRect().top) / scale;
    if (Math.abs(dy) < 1) continue;
    el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
  }
}
