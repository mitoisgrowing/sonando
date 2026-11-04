// Traducción de la letra al español, verso por verso.
//  DeepL si hay clave (oficial, gratis hasta 500.000 caracteres al mes); si no hay clave o falla, Google sin clave
//  (endpoint no oficial: puede dejar de funcionar). Si la canción ya está en español no se traduce.
const TARGET = 'es';

async function deepl(texts, key) {
  const host = key.trim().endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
  const r = await fetch(`https://${host}/v2/translate`, {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { Authorization: `DeepL-Auth-Key ${key.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts, target_lang: 'ES', preserve_formatting: true }),
  });
  if (!r.ok) throw new Error(r.status === 456 ? 'DeepL: se acabaron los caracteres gratis de este mes' : r.status === 403 ? 'DeepL: la clave no es válida' : `DeepL: ${r.status}`);
  const j = await r.json();
  return { from: (j.translations[0]?.detected_source_language || '').toLowerCase(), texts: j.translations.map(t => t.text) };
}

async function google(texts) {
  // los versos van juntos separados por saltos de línea (una sola petición) y vuelven en el mismo orden
  const out = [];
  let from = '';
  for (let i = 0; i < texts.length; i += 40) {
    const part = texts.slice(i, i + 40);
    const r = await fetch('https://translate.googleapis.com/translate_a/single?' + new URLSearchParams({ client: 'gtx', sl: 'auto', tl: TARGET, dt: 't', q: part.join('\n') }), { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`Google: ${r.status}`);
    const j = await r.json();
    from ||= j[2] || '';
    const got = j[0].map(x => x[0]).join('').split('\n');
    if (got.length !== part.length) throw new Error('Google: no devolvió los mismos versos');
    out.push(...got);
  }
  return { from, texts: out };
}

// Devuelve { lines (con `tr` en cada verso), by } o null si no hace falta (vacía o ya en español)
export async function translate(lines, deeplKey, fetchers = { deepl, google }) {
  const idx = lines.map((l, i) => (l.text.trim() ? i : -1)).filter(i => i >= 0);
  if (!idx.length) return null;
  const texts = idx.map(i => lines[i].text);
  let res, by = 'google', error = '';
  if (deeplKey) { try { res = await fetchers.deepl(texts, deeplKey); by = 'deepl'; } catch (e) { error = e.message; } }
  if (!res) res = await fetchers.google(texts);
  if (res.from.startsWith(TARGET)) return { lines, by, error, same: true };
  const out = lines.map(l => ({ ...l }));
  idx.forEach((i, k) => { const t = res.texts[k]?.trim(); if (t && t.toLowerCase() !== out[i].text.trim().toLowerCase()) out[i].tr = t; });
  return { lines: out, by, error };
}
