// Detector de ritmo dentro del hilo de audio del navegador: sigue funcionando aunque la pestaña del panel
// esté en segundo plano. Recibe 3 bandas ya filtradas (graves, medios-agudos, agudos) y avisa al panel de:
//   «tu» (bombo): el grave sube de golpe frente a 30 ms antes, y lo que sube son los graves, no la voz;
//   «pa» (clap/caja): golpe seco a la vez en 1-4 kHz y en 5-12 kHz (una vocal abre una banda, una "s" la otra);
//   drop: tras un parón o una subida sin bombo, vuelve fuerte y con bombo seguido.
// Trabaja por bloques de 128 muestras (~2,7 ms). Umbrales robustos (mediana) que se adaptan a cada canción.
class Band {
  constructor(W, D) { this.W = W; this.D = D; this.ring = new Float64Array(W + D + 2); this.i = 0; this.hist = []; this.th = 6; this.peak = 1e-9; this.prev = 0; }
  push(e) { this.ring[this.i] = e; this.i = (this.i + 1) % this.ring.length; }
  sum(back, n) { let s = 0; for (let k = 0; k < n; k++) s += this.ring[(this.i - 1 - back - k + this.ring.length * 2) % this.ring.length]; return s / n; }
  read() { const e = this.sum(0, this.W), e0 = this.sum(this.D, this.W); return { e, rise: 10 * Math.log10((e + 1e-10) / (e0 + 1e-10)), inc: e - e0 }; }
  adapt(t, k, lo, hi) {
    while (this.hist.length && t - this.hist[0][0] > 2000) this.hist.shift();
    if (this.hist.length < 20) return;
    const v = this.hist.map(x => x[1]).sort((a, b) => a - b), med = v[v.length >> 1];
    const mad = v.map(x => Math.abs(x - med)).sort((a, b) => a - b)[v.length >> 1];
    this.th = Math.max(lo, Math.min(hi, med + k * mad));
  }
}

class Beat extends AudioWorkletProcessor {
  constructor() {
    super();
    const blk = ms => Math.max(1, Math.round(ms / 1000 * sampleRate / 128));
    this.low = new Band(blk(25), blk(30)); this.mid = new Band(blk(6), blk(15)); this.hi = new Band(blk(6), blk(15));
    this.n = 0; this.lastKick = -1e9; this.lastSnare = -1e9; this.kicks = [];
    this.shortDb = -60; this.longDb = -60; this.lastQuiet = -1e9; this.decay = Math.exp(-128 / sampleRate / 4);
  }
  process(inputs) {
    const t = currentTime * 1000;
    const energy = ch => { if (!ch) return 0; let s = 0; for (let k = 0; k < ch.length; k++) s += ch[k] * ch[k]; return s / ch.length; };
    const { low, mid, hi } = this;
    low.push(energy(inputs[0]?.[0])); mid.push(energy(inputs[1]?.[0])); hi.push(energy(inputs[2]?.[0]));
    const L = low.read(), M = mid.read(), H = hi.read();
    low.peak = Math.max(L.e, low.peak * this.decay); mid.peak = Math.max(M.e, mid.peak * this.decay); hi.peak = Math.max(H.e, hi.peak * this.decay);
    if ((this.n & 1) === 0) { low.hist.push([t, L.rise]); mid.hist.push([t, M.rise]); hi.hist.push([t, H.rise]); }
    if (low.prev <= low.th && L.rise > low.th && L.inc / low.peak > 0.1 && L.inc / low.peak > 1.2 * M.inc / Math.max(mid.peak, 1e-9) && t - this.lastKick > 170) {
      this.lastKick = t; this.kicks.push(t);
      this.port.postMessage({ k: 'kick', s: Math.min(1.2, 0.6 + (L.rise - low.th) / 10) });
    }
    if (mid.prev <= mid.th && M.rise > mid.th && H.rise > hi.th && M.inc / mid.peak > 0.05 && H.inc / hi.peak > 0.05 && t - this.lastSnare > 140) {
      this.lastSnare = t;
      this.port.postMessage({ k: 'snare', s: Math.min(0.8, 0.45 + (M.rise - mid.th) / 14) });
    }
    low.prev = L.rise; mid.prev = M.rise; hi.prev = H.rise;
    if (++this.n % 16 === 0) { // ~43 ms: umbrales y drop
      low.adapt(t, 3, 3, 12); mid.adapt(t, 4, 5, 18); hi.adapt(t, 3, 4, 18);
      while (this.kicks.length && t - this.kicks[0] > 2000) this.kicks.shift();
      const db = 10 * Math.log10(L.e + 1e-10), dt = 16 * 128 / sampleRate * 1000;
      this.shortDb += (db - this.shortDb) * (1 - Math.exp(-dt / 700)); this.longDb += (db - this.longDb) * (1 - Math.exp(-dt / 6000));
      if (this.shortDb < this.longDb - 6) this.lastQuiet = t;
      if (t - this.lastQuiet < 9000 && this.shortDb > this.longDb + 1 && this.kicks.filter(k => t - k < 1200).length >= 2) {
        this.lastQuiet = -1e9; this.port.postMessage({ k: 'drop' });
      }
    }
    return true;
  }
}
registerProcessor('beat', Beat);
