// Procedural Web Audio sound effects (no asset files). Persisted mute flag.
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.8;
    try { this.muted = localStorage.getItem('gr_muted') === '1'; } catch { /* ignore */ }
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) ?? 0.8));
    if (this.master && !this.muted) {
      this.master.gain.setValueAtTime(this.volume, this.ctx ? this.ctx.currentTime : 0);
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setValueAtTime(m ? 0 : this.volume, this.ctx ? this.ctx.currentTime : 0);
    }
    try { localStorage.setItem('gr_muted', m ? '1' : '0'); } catch { /* ignore */ }
  }

  tone({ f = 440, to = null, type = 'sine', dur = 0.15, vol = 0.25, delay = 0 }) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, from = 400, to = 1800, vol = 0.2, delay = 0, q = 1 }) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.Q.value = q;
    flt.frequency.setValueAtTime(from, t);
    flt.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  gulp(p = 1) { this.tone({ f: 330 * p, to: 90 * p, dur: 0.13, vol: 0.28 }); }
  bubble(p = 1) { this.tone({ f: 320 * p, to: 900 * p, dur: 0.08, vol: 0.22 }); }
  chomp() { this.tone({ f: 180, to: 70, type: 'square', dur: 0.1, vol: 0.12 }); }
  stack(combo = 1) {
    const n = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880];
    this.tone({ f: n[(Math.max(1, combo) - 1) % n.length], type: 'triangle', dur: 0.25, vol: 0.3 });
  }
  slice() { this.noise({ dur: 0.12, from: 1200, to: 300, vol: 0.18 }); }
  merge(tier = 0) {
    const f = 260 + tier * 55;
    this.tone({ f, to: f * 1.7, type: 'triangle', dur: 0.14, vol: 0.28 });
    this.tone({ f: f * 1.5, to: f * 2.2, type: 'sine', dur: 0.18, vol: 0.15, delay: 0.04 });
  }
  drop() { this.tone({ f: 200, to: 120, type: 'sine', dur: 0.08, vol: 0.18 }); }
  gate(good = true) {
    if (good) {
      this.tone({ f: 520, type: 'triangle', dur: 0.1, vol: 0.25 });
      this.tone({ f: 780, type: 'triangle', dur: 0.14, vol: 0.25, delay: 0.07 });
    } else {
      this.tone({ f: 300, to: 140, type: 'sawtooth', dur: 0.2, vol: 0.18 });
    }
  }
  hit() { this.noise({ dur: 0.18, from: 900, to: 150, vol: 0.28, q: 0.7 }); }
  up() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ f, dur: 0.22, vol: 0.2, delay: i * 0.07 }));
  }
  fail() {
    this.tone({ f: 330, to: 70, type: 'sawtooth', dur: 0.55, vol: 0.28 });
    this.noise({ dur: 0.35, from: 800, to: 120, vol: 0.25, q: 0.6 });
  }
  survive() {
    [392, 523, 659, 784].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.3, vol: 0.24, delay: i * 0.09 }));
    this.tone({ f: 1046, dur: 0.5, vol: 0.2, delay: 0.38 });
  }
  tick() { this.tone({ f: 880, type: 'square', dur: 0.05, vol: 0.08 }); }
  whoosh() { this.noise({ dur: 0.28, from: 300, to: 2400, vol: 0.2 }); }
  welcome() {
    this.tone({ f: 660, dur: 0.12, vol: 0.2 });
    this.tone({ f: 990, dur: 0.22, vol: 0.2, delay: 0.1 });
  }
  like() { this.tone({ f: 600, to: 1300, dur: 0.14, vol: 0.2 }); }
  blockPop(pitch = 1) {
    const f = Math.min(1800, 280 * Math.pow(1.05, pitch));
    this.tone({ f, to: f * 1.35, type: 'triangle', dur: 0.08, vol: 0.22 });
  }
  laser() {
    this.tone({ f: 1400, to: 280, type: 'sawtooth', dur: 0.18, vol: 0.22 });
  }
  shatter() {
    this.noise({ dur: 0.22, from: 1800, to: 200, vol: 0.25, q: 1.2 });
  }
  gunfire() {
    this.noise({ dur: 0.06, from: 2400, to: 400, vol: 0.16, q: 0.5 });
    this.tone({ f: 440, to: 120, type: 'sawtooth', dur: 0.05, vol: 0.12 });
  }
  explosion() {
    this.noise({ dur: 0.45, from: 600, to: 60, vol: 0.35, q: 0.5 });
    this.tone({ f: 160, to: 40, type: 'sine', dur: 0.38, vol: 0.3 });
  }
  upgrade() {
    [587, 740, 880, 1175].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.16, vol: 0.22, delay: i * 0.05 }));
  }
  jump() {
    this.tone({ f: 280, to: 650, type: 'sine', dur: 0.16, vol: 0.22 });
  }
  coin() {
    this.tone({ f: 988, dur: 0.08, vol: 0.22 });
    this.tone({ f: 1318, dur: 0.18, vol: 0.22, delay: 0.06 });
  }
  powerup() {
    [440, 554, 659, 880].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.14, vol: 0.2, delay: i * 0.05 }));
  }
  hurt() {
    this.tone({ f: 180, to: 60, type: 'sawtooth', dur: 0.22, vol: 0.25 });
    this.noise({ dur: 0.2, from: 800, to: 100, vol: 0.2, q: 0.8 });
  }
  pop() {
    this.tone({ f: 450, to: 820, type: 'sine', dur: 0.08, vol: 0.2 });
  }
  splash() {
    this.noise({ dur: 0.25, from: 1200, to: 300, vol: 0.25, q: 0.6 });
  }
  boost() {
    this.tone({ f: 380, to: 950, type: 'sawtooth', dur: 0.28, vol: 0.22 });
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
