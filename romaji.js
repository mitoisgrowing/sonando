// Letras romanizadas: para poder cantar canciones en coreano, japonés, chino, ruso, griego…
//  coreano: romanización revisada con las reglas de pronunciación (enlace, nasales, ㄹ), hecha aquí
//  japonés: kuroshiro + diccionario kuromoji (romaji Hepburn, kanji incluidos)
//  chino:   pinyin-pro (pinyin con tonos)
//  resto:   any-ascii (cirílico, griego, tailandés, árabe…)
import { pinyin } from 'pinyin-pro';
import anyAscii from 'any-ascii';

const HANGUL = /[가-힣]/, KANA = /[぀-ヿ]/, HAN = /[㐀-鿿]/;
const NON_LATIN = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

// qué hay que hacer con esta letra (null = ya está en letras latinas)
export function scriptOf(lines) {
  const all = lines.map(l => l.text).join('\n');
  if (KANA.test(all)) return 'ja';
  if (HANGUL.test(all)) return 'ko';
  if (HAN.test(all)) return 'zh';
  return NON_LATIN.test(all) ? 'other' : null;
}

// ---------- coreano ----------
const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
// finales: [cómo suena al final, qué consonante pasa a la sílaba siguiente si empieza por vocal (índice de CHO)]
const JONG = [[''], ['k', 0], ['k', 1], ['k', 9, 'k'], ['n', 2], ['n', 12, 'n'], ['n', 18, 'n'], ['t', 3], ['l', 5], ['k', 0, 'l'], ['m', 6, 'l'], ['p', 7, 'l'],
  ['l', 9, 'l'], ['l', 16, 'l'], ['p', 17, 'l'], ['l', 18, 'l'], ['m', 6], ['p', 7], ['p', 9, 'p'], ['t', 9], ['t', 10], ['ng'], ['t', 12], ['t', 14], ['k', 15], ['t', 16], ['p', 17], ['t', 18]];

function koWord(word) {
  const syl = [...word].map(ch => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? { i: Math.floor(c / 588), v: Math.floor((c % 588) / 28), f: c % 28 } : { raw: ch }; });
  let out = '';
  for (let k = 0; k < syl.length; k++) {
    const s = syl[k], n = syl[k + 1];
    if (s.raw) { out += s.raw; continue; }
    let fin = JONG[s.f][0];
    if (n && !n.raw && s.f) {
      const [, move, keep] = JONG[s.f];
      if (n.i === 11 && s.f !== 21) { // la siguiente empieza por vocal: la final se pasa a ella (enlace)
        if (s.f === 27 || s.f === 6 || s.f === 15) { fin = keep || ''; if (s.f === 27) fin = ''; } // la ㅎ final no suena delante de vocal
        else { fin = keep || ''; n.i = move; }
      } else if (n.i === 18 && [1, 7, 17, 22].includes(s.f)) { fin = ''; n.i = { 1: 15, 7: 16, 17: 17, 22: 14 }[s.f]; } // ㄱㄷㅂㅈ + ㅎ = aspirada
      else if (s.f === 27 && [0, 3, 12].includes(n.i)) { fin = ''; n.i = { 0: 15, 3: 16, 12: 14 }[n.i]; } // ㅎ + ㄱㄷㅈ
      else if ([2, 6].includes(n.i) && ['k', 't', 'p'].includes(fin)) fin = { k: 'ng', t: 'n', p: 'm' }[fin]; // nasales delante de ㄴ ㅁ
      else if (n.i === 5 && (fin === 'n' || fin === 'l')) { fin = 'l'; n.i = -1; } // ㄴ/ㄹ + ㄹ = ll
      else if (n.i === 2 && fin === 'l') n.i = -1; // ㄹ + ㄴ = ll
      else if (n.i === 5 && ['k', 'p', 'm', 'ng'].includes(fin)) { n.i = 2; if (fin === 'k') fin = 'ng'; if (fin === 'p') fin = 'm'; }
    }
    const init = s.i === -1 ? 'l' : s.i === 5 && k === 0 ? 'r' : CHO[s.i];
    out += init + JUNG[s.v] + fin;
  }
  return out;
}
export const romanizeKo = text => text.split(/(\s+)/).map(w => (HANGUL.test(w) ? koWord(w) : w)).join('');

// ---------- japonés (carga perezosa: el diccionario pesa) ----------
let kuro = null;
async function japanese(dictPath) {
  if (!kuro) kuro = (async () => {
    const { default: K } = await import('kuroshiro'), { default: A } = await import('kuroshiro-analyzer-kuromoji');
    const k = new (K.default || K)(); await k.init(new (A.default || A)({ dictPath })); return k;
  })();
  return kuro;
}

// ---------- versión romanizada ya subida por alguien ----------
// Muchas letras «latinas» son traducciones (p. ej. al inglés), no romanizaciones: solo se acepta una candidata
// si tiene los mismos versos y cada uno se parece de verdad a nuestra romanización automática.
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ou/g, 'o').replace(/[^a-z]/g, '');
const bigrams = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) || 0) + 1); return m; };
export function similar(a, b) {
  const x = bigrams(norm(a)), y = bigrams(norm(b)); let both = 0, n = 0;
  for (const [k, v] of x) { both += Math.min(v, y.get(k) || 0); n += v; }
  for (const v of y.values()) n += v;
  return n ? (2 * both) / n : 1;
}
// lines: con `roman` automático · candidates: textos de letra (LRC o planos). Devuelve los versos de la mejor o null.
export function pickRomanized(lines, candidates) {
  const sung = lines.filter(l => l.text.trim());
  let best = null, bestScore = 0.55;
  for (const c of candidates) {
    const verses = c.split('\n').map(l => l.replace(/^\s*(\[[^\]]*\]\s*)+/, '').trim()).filter(Boolean);
    if (verses.length !== sung.length || scriptOf(verses.map(text => ({ text })))) continue;
    const score = verses.reduce((s, v, i) => s + similar(v, sung[i].roman), 0) / verses.length;
    if (score > bestScore) { best = verses; bestScore = score; }
  }
  if (!best) return null;
  let i = 0;
  return lines.map(l => (l.text.trim() ? { ...l, roman: best[i++] } : l));
}

// el modo con espacios de kuroshiro parte las palabras por morfemas: «datsu ta» → «datta», «dashi ta» → «dashita»
export const jaFix = s => s
  .replace(/tsu +([kstpc])/g, '$1$1')
  .replace(/ +(ta|te|tari|tara|teru|tei|tai|nai|nakatta|masu|mashita|masen|reru|rareru|seru)(?=$|[\s,.!?"'])/g, '$1')
  .replace(/" *([^"]*?) *"/g, '"$1"');

// Devuelve las líneas con `roman` añadido (o igual si no hace falta). dictPath: carpeta del diccionario japonés.
export async function romanize(lines, dictPath) {
  const kind = scriptOf(lines);
  if (!kind) return { kind: null, lines };
  const k = kind === 'ja' ? await japanese(dictPath) : null;
  const one = async text => {
    if (!NON_LATIN.test(text)) return text;
    if (kind === 'ja') return jaFix(await k.convert(text, { to: 'romaji', mode: 'spaced', romajiSystem: 'hepburn' }));
    if (kind === 'ko' || HANGUL.test(text)) return romanizeKo(text);
    if (kind === 'zh') return pinyin(text, { toneType: 'symbol', nonZh: 'consecutive' });
    return anyAscii(text);
  };
  const out = [];
  for (const l of lines) out.push({ ...l, roman: (await one(l.text)).replace(/\s+/g, ' ').replace(/\s+([,.!?;:)])/g, '$1').trim() });
  return { kind, lines: out };
}
