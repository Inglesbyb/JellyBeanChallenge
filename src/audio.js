// Procedural Web Audio AAA Sound Engine (master limiter, zero-GC noise cache, anti-clip cooldowns, multi-layer foley).
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.noiseBuf = null;
    this.muted = false;
    this.volume = 0.8;
    this._lastPlayed = new Map();
    try { this.muted = localStorage.getItem('gr_muted') === '1'; } catch { /* ignore */ }
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;

      // Soft limiter prevents digital clipping when many arcade events trigger together
      if (typeof this.ctx.createDynamicsCompressor === 'function') {
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -14;
        this.compressor.knee.value = 18;
        this.compressor.ratio.value = 8;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.12;
        this.master.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
      } else {
        this.master.connect(this.ctx.destination);
      }

      // Pre-allocate one reusable 2-second white-noise buffer so combat SFX incur zero GC churn
      const len = Math.floor(this.ctx.sampleRate * 2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
      this.ctx.resume().catch(() => {});
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) ?? 0.8));
    if (this.master && !this.muted) {
      this.master.gain.setValueAtTime(this.volume, this.ctx ? this.ctx.currentTime : 0);
    }
  }

  setMuted(m) {
    this.muted = Boolean(m);
    if (this.master) {
      this.master.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx ? this.ctx.currentTime : 0);
    }
    try { localStorage.setItem('gr_muted', this.muted ? '1' : '0'); } catch { /* ignore */ }
  }

  _canPlay(key, minGapMs = 28) {
    const now = performance.now();
    const prev = this._lastPlayed.get(key) || 0;
    if (now - prev < minGapMs) return false;
    this._lastPlayed.set(key, now);
    return true;
  }

  _jitter(amount = 0.04) {
    return 1 + (Math.random() * 2 - 1) * amount;
  }

  tone({ f = 440, to = null, type = 'sine', dur = 0.15, vol = 0.25, delay = 0, attack = 0.005 }) {
    if (this.muted) return;
    this.init();
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const safeDur = Math.max(0.015, dur);
    const safeVol = Math.max(0.002, vol);
    const atk = Math.min(attack, safeDur * 0.35);

    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f), t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + safeDur);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(safeVol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + safeDur);

    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + safeDur + 0.02);
  }

  noise({ dur = 0.2, from = 400, to = 1800, vol = 0.2, delay = 0, q = 1, filterType = 'bandpass', attack = 0.004 }) {
    if (this.muted) return;
    this.init();
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const safeDur = Math.max(0.015, dur);
    const safeVol = Math.max(0.002, vol);
    const atk = Math.min(attack, safeDur * 0.35);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const maxOffset = Math.max(0.02, this.noiseBuf.duration - safeDur - 0.04);
    const offset = Math.random() * maxOffset;

    const flt = this.ctx.createBiquadFilter();
    flt.type = filterType;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(Math.max(40, from), t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + safeDur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(safeVol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + safeDur);

    src.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    src.start(t, offset, safeDur + 0.02);
  }

  gulp(p = 1) {
    if (!this._canPlay('gulp', 32)) return;
    const j = this._jitter(0.03);
    this.tone({ f: 340 * p * j, to: 92 * p, dur: 0.13, vol: 0.27 });
    this.tone({ f: 510 * p, to: 180 * p, type: 'triangle', dur: 0.07, vol: 0.1, delay: 0.02 });
  }

  bubble(p = 1) {
    if (!this._canPlay('bubble', 28)) return;
    const j = this._jitter(0.05);
    this.tone({ f: 310 * p * j, to: 920 * p * j, dur: 0.085, vol: 0.22 });
    this.tone({ f: 620 * p * j, to: 1320 * p, dur: 0.05, vol: 0.09, delay: 0.03 });
  }

  chomp() {
    if (!this._canPlay('chomp', 45)) return;
    const j = this._jitter(0.04);
    this.tone({ f: 195 * j, to: 72, type: 'square', dur: 0.09, vol: 0.12 });
    this.noise({ dur: 0.06, from: 1100, to: 280, vol: 0.13, q: 1.1 });
  }

  stack(combo = 1) {
    const n = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 988, 1046];
    const idx = Math.max(0, Math.round(combo) - 1) % n.length;
    const f = n[idx];
    this.tone({ f, type: 'triangle', dur: 0.22, vol: 0.27 });
    this.tone({ f: f * 2, type: 'sine', dur: 0.14, vol: 0.09, delay: 0.015 });
  }

  slice() {
    if (!this._canPlay('slice', 35)) return;
    const j = this._jitter(0.06);
    this.noise({ dur: 0.11, from: 2600 * j, to: 420, vol: 0.2, q: 1.4 });
    this.tone({ f: 780 * j, to: 260, type: 'triangle', dur: 0.07, vol: 0.1 });
  }

  merge(tier = 0) {
    const tIdx = Math.max(0, Math.min(12, Math.round(tier)));
    const f = 260 + tIdx * 55;
    this.tone({ f, to: f * 1.65, type: 'triangle', dur: 0.14, vol: 0.26 });
    this.tone({ f: f * 1.5, to: f * 2.25, type: 'sine', dur: 0.18, vol: 0.15, delay: 0.04 });
    this.tone({ f: f * 2, type: 'sine', dur: 0.14, vol: 0.08, delay: 0.07 });
  }

  drop() {
    if (!this._canPlay('drop', 25)) return;
    this.tone({ f: 210 * this._jitter(0.04), to: 110, type: 'sine', dur: 0.08, vol: 0.18 });
  }

  gate(good = true) {
    if (!this._canPlay('gate', 45)) return;
    if (good) {
      this.tone({ f: 523.25, type: 'triangle', dur: 0.1, vol: 0.24 });
      this.tone({ f: 783.99, type: 'triangle', dur: 0.14, vol: 0.24, delay: 0.065 });
      this.tone({ f: 1046.5, type: 'sine', dur: 0.12, vol: 0.1, delay: 0.11 });
    } else {
      this.tone({ f: 280, to: 120, type: 'sawtooth', dur: 0.2, vol: 0.18 });
      this.tone({ f: 210, to: 90, type: 'square', dur: 0.18, vol: 0.08, delay: 0.03 });
    }
  }

  hit() {
    if (!this._canPlay('hit', 35)) return;
    const j = this._jitter(0.05);
    this.noise({ dur: 0.16, from: 1100 * j, to: 140, vol: 0.26, q: 0.75 });
    this.tone({ f: 145 * j, to: 48, type: 'sine', dur: 0.12, vol: 0.24 });
  }

  up() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone({ f, type: 'triangle', dur: 0.22, vol: 0.2, delay: i * 0.065 });
    });
  }

  fail() {
    this.tone({ f: 320, to: 68, type: 'sawtooth', dur: 0.52, vol: 0.24 });
    this.tone({ f: 240, to: 52, type: 'triangle', dur: 0.45, vol: 0.2, delay: 0.06 });
    this.noise({ dur: 0.32, from: 750, to: 110, vol: 0.24, q: 0.65 });
  }

  survive() {
    [392, 523.25, 659.25, 783.99].forEach((f, i) => {
      this.tone({ f, type: 'triangle', dur: 0.28, vol: 0.23, delay: i * 0.085 });
    });
    this.tone({ f: 1046.5, type: 'sine', dur: 0.46, vol: 0.2, delay: 0.36 });
    this.tone({ f: 1318.5, type: 'sine', dur: 0.38, vol: 0.1, delay: 0.4 });
  }

  victory() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.tone({ f, type: 'triangle', dur: i === 4 ? 0.48 : 0.18, vol: 0.22, delay: i * 0.075 });
    });
    this.tone({ f: 523.25, type: 'sine', dur: 0.5, vol: 0.14, delay: 0.3 });
    this.tone({ f: 783.99, type: 'sine', dur: 0.48, vol: 0.12, delay: 0.3 });
  }

  tick(secs = 5) {
    // Escalate urgency semi-tones cleanly across final 5..4..3..2..1 countdown
    const clamped = Math.max(1, Math.min(5, Math.round(Number(secs) || 5)));
    const scale = [1108.73, 932.33, 830.61, 739.99, 659.25];
    const f = scale[clamped - 1];
    this.tone({ f, to: f * 0.92, type: 'triangle', dur: 0.06, vol: 0.13 });
    this.noise({ dur: 0.02, from: 2600, to: 1800, vol: 0.06, q: 2.2 });
  }

  whoosh() {
    if (!this._canPlay('whoosh', 45)) return;
    this.noise({ dur: 0.24, from: 280, to: 2200, vol: 0.18, q: 0.9 });
  }

  welcome() {
    this.tone({ f: 659.25, type: 'triangle', dur: 0.12, vol: 0.2 });
    this.tone({ f: 987.77, type: 'triangle', dur: 0.22, vol: 0.2, delay: 0.095 });
  }

  like() {
    this.tone({ f: 620, to: 1320, type: 'sine', dur: 0.14, vol: 0.2 });
    this.tone({ f: 1320, type: 'triangle', dur: 0.12, vol: 0.1, delay: 0.07 });
  }

  blockPop(pitch = 1) {
    if (!this._canPlay('blockPop', 26)) return;
    const f = Math.min(1800, 290 * Math.pow(1.05, Math.max(0, pitch))) * this._jitter(0.03);
    this.tone({ f, to: f * 1.38, type: 'triangle', dur: 0.08, vol: 0.21 });
    this.tone({ f: f * 2, to: f * 2.4, type: 'sine', dur: 0.045, vol: 0.07 });
  }

  laser() {
    if (!this._canPlay('laser', 38)) return;
    const j = this._jitter(0.04);
    this.tone({ f: 1450 * j, to: 260, type: 'sawtooth', dur: 0.16, vol: 0.19 });
    this.tone({ f: 960 * j, to: 190, type: 'triangle', dur: 0.12, vol: 0.12 });
  }

  shatter() {
    if (!this._canPlay('shatter', 35)) return;
    this.noise({ dur: 0.2, from: 2400, to: 260, vol: 0.23, q: 1.3 });
    this.tone({ f: 1650 * this._jitter(0.08), to: 720, type: 'triangle', dur: 0.08, vol: 0.11 });
    this.tone({ f: 2240 * this._jitter(0.08), to: 1120, type: 'sine', dur: 0.09, vol: 0.08, delay: 0.03 });
  }

  gunfire() {
    if (!this._canPlay('gunfire', 42)) return;
    const j = this._jitter(0.06);
    this.noise({ dur: 0.055, from: 2600 * j, to: 420, vol: 0.16, q: 0.65 });
    this.tone({ f: 420 * j, to: 110, type: 'sawtooth', dur: 0.05, vol: 0.11 });
  }

  cannon() {
    if (!this._canPlay('cannon', 45)) return;
    const j = this._jitter(0.04);
    this.tone({ f: 230 * j, to: 65, type: 'sine', dur: 0.14, vol: 0.24 });
    this.noise({ dur: 0.11, from: 850, to: 150, vol: 0.18, q: 0.8 });
  }

  explosion() {
    if (!this._canPlay('explosion', 45)) return;
    this.noise({ dur: 0.42, from: 680, to: 62, vol: 0.34, q: 0.55 });
    this.tone({ f: 175, to: 38, type: 'sine', dur: 0.36, vol: 0.3 });
    this.tone({ f: 120, to: 46, type: 'sawtooth', dur: 0.22, vol: 0.12, delay: 0.02 });
  }

  upgrade() {
    [587.33, 739.99, 880, 1174.66].forEach((f, i) => {
      this.tone({ f, type: 'triangle', dur: 0.16, vol: 0.21, delay: i * 0.05 });
    });
  }

  jump() {
    if (!this._canPlay('jump', 35)) return;
    this.tone({ f: 280 * this._jitter(0.03), to: 660, type: 'sine', dur: 0.15, vol: 0.21 });
  }

  coin() {
    if (!this._canPlay('coin', 28)) return;
    const j = this._jitter(0.02);
    this.tone({ f: 987.77 * j, type: 'sine', dur: 0.075, vol: 0.2 });
    this.tone({ f: 1318.51 * j, type: 'sine', dur: 0.17, vol: 0.2, delay: 0.055 });
    this.tone({ f: 2637.02 * j, type: 'sine', dur: 0.12, vol: 0.07, delay: 0.065 });
  }

  powerup() {
    [440, 554.37, 659.25, 880, 1108.73].forEach((f, i) => {
      this.tone({ f, type: 'triangle', dur: 0.14, vol: 0.19, delay: i * 0.045 });
    });
  }

  hurt() {
    if (!this._canPlay('hurt', 60)) return;
    this.tone({ f: 190, to: 58, type: 'sawtooth', dur: 0.21, vol: 0.23 });
    this.noise({ dur: 0.18, from: 820, to: 110, vol: 0.19, q: 0.8 });
  }

  pop() {
    if (!this._canPlay('pop', 26)) return;
    const j = this._jitter(0.05);
    this.tone({ f: 450 * j, to: 840 * j, type: 'sine', dur: 0.075, vol: 0.19 });
  }

  bounce() {
    if (!this._canPlay('bounce', 32)) return;
    const j = this._jitter(0.04);
    this.tone({ f: 190 * j, to: 95, type: 'sine', dur: 0.065, vol: 0.16 });
  }

  clink() {
    if (!this._canPlay('clink', 32)) return;
    const j = this._jitter(0.05);
    this.tone({ f: 1680 * j, to: 980, type: 'triangle', dur: 0.06, vol: 0.17 });
    this.tone({ f: 2420 * j, to: 1850, type: 'sine', dur: 0.05, vol: 0.09 });
  }

  scribble() {
    if (!this._canPlay('scribble', 48)) return;
    const j = this._jitter(0.08);
    this.noise({ dur: 0.032, from: 2200 * j, to: 880, vol: 0.065, q: 1.5 });
  }

  anvilClang() {
    if (!this._canPlay('anvil', 60)) return;
    this.tone({ f: 880, to: 860, type: 'triangle', dur: 0.28, vol: 0.22 });
    this.tone({ f: 1320, to: 1295, type: 'sine', dur: 0.24, vol: 0.14 });
    this.tone({ f: 2112, to: 2040, type: 'sine', dur: 0.16, vol: 0.08 });
    this.tone({ f: 150, to: 52, type: 'sine', dur: 0.12, vol: 0.24 });
  }

  bossRoar() {
    this.tone({ f: 145, to: 46, type: 'sawtooth', dur: 0.45, vol: 0.22 });
    this.tone({ f: 98, to: 38, type: 'triangle', dur: 0.48, vol: 0.24, delay: 0.03 });
    this.noise({ dur: 0.38, from: 420, to: 90, vol: 0.2, q: 0.7 });
  }

  trainHorn() {
    this.tone({ f: 460, to: 440, type: 'triangle', dur: 0.28, vol: 0.22 });
    this.tone({ f: 580, to: 552, type: 'triangle', dur: 0.28, vol: 0.2, delay: 0.05 });
    this.tone({ f: 345, to: 332, type: 'sawtooth', dur: 0.26, vol: 0.06, delay: 0.03 });
  }

  comicUnlock() {
    this.noise({ dur: 0.08, from: 1800, to: 450, vol: 0.12, q: 1.2 });
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone({ f, type: 'triangle', dur: 0.2, vol: 0.19, delay: 0.04 + i * 0.055 });
    });
  }

  splash() {
    if (!this._canPlay('splash', 45)) return;
    this.noise({ dur: 0.24, from: 1250, to: 280, vol: 0.24, q: 0.65 });
    this.tone({ f: 260, to: 110, type: 'sine', dur: 0.1, vol: 0.12 });
  }

  boost() {
    if (!this._canPlay('boost', 45)) return;
    this.tone({ f: 380, to: 980, type: 'sawtooth', dur: 0.26, vol: 0.2 });
    this.tone({ f: 570, to: 1380, type: 'triangle', dur: 0.24, vol: 0.12, delay: 0.03 });
  }

  levelUp() {
    this.up();
  }
}

const rawSounds = new SoundEngine();
export const sounds = new Proxy(rawSounds, {
  get(target, prop) {
    if (prop in target) {
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
    return () => {};
  }
});
