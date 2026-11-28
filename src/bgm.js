// Adaptive Look-Ahead Procedural Web Audio BGM Sequencer (zero audio files, warm low-pass mix).
import { sounds } from './audio.js';

const STEP_MS = 60;
const LOOKAHEAD_S = 0.14;

const THEMES = {
  plaza: {
    bpm: 108,
    vol: 0.16,
    bassWave: 'sine',
    leadWave: 'triangle',
    roots: [60, 57, 53, 55], // C major Sunburst groove: C - Am - F - G
    lead: [
      72, 0, 76, 0, 79, 0, 76, 0,  72, 0, 74, 76, 72, 0, 0, 0,
      69, 0, 72, 0, 76, 0, 72, 0,  69, 0, 72, 74, 72, 0, 0, 0,
    ],
    bass: [1, 0, 0, 0, 0, 0, 1, 0,  1, 0, 0, 0, 1, 0, 0, 0],
    hat:  [0, 0, 1, 0, 0, 0, 1, 0,  0, 0, 1, 0, 0, 0, 1, 0],
  },
  arcade: {
    bpm: 128,
    vol: 0.17,
    bassWave: 'triangle',
    leadWave: 'triangle',
    roots: [62, 58, 60, 57], // D minor upbeat gauntlet: Dm - Bb - C - A
    lead: [
      74, 0, 77, 0, 81, 0, 77, 0,  74, 77, 0, 81, 79, 0, 77, 0,
      70, 0, 74, 0, 77, 0, 74, 0,  72, 0, 76, 79, 76, 0, 74, 0,
    ],
    bass: [1, 0, 1, 0, 1, 0, 1, 0,  1, 0, 1, 0, 1, 0, 1, 1],
    hat:  [0, 1, 1, 1, 0, 1, 1, 1,  0, 1, 1, 1, 0, 1, 1, 1],
  },
  boss: {
    bpm: 138,
    vol: 0.19,
    bassWave: 'sawtooth',
    leadWave: 'triangle',
    roots: [48, 48, 44, 46], // C minor dark Citadel Battle: Cm - Cm - Ab - Bb
    lead: [
      60, 0, 63, 0, 67, 0, 66, 0,  60, 0, 63, 67, 72, 0, 67, 0,
      56, 0, 60, 0, 63, 0, 62, 0,  58, 0, 62, 65, 67, 0, 62, 0,
    ],
    bass: [1, 0, 0, 1, 0, 0, 1, 0,  1, 0, 0, 1, 1, 0, 1, 0],
    hat:  [1, 0, 1, 0, 1, 0, 1, 1,  1, 0, 1, 0, 1, 1, 1, 0],
  },
  summary: {
    bpm: 102,
    vol: 0.14,
    bassWave: 'sine',
    leadWave: 'sine',
    roots: [60, 65, 67, 60],
    lead: [
      72, 0, 0, 76, 79, 0, 0, 0,  77, 0, 0, 81, 79, 0, 0, 0,
      74, 0, 0, 79, 83, 0, 0, 0,  72, 0, 76, 0, 84, 0, 0, 0,
    ],
    bass: [1, 0, 0, 0, 0, 0, 0, 0,  1, 0, 0, 0, 0, 0, 0, 0],
    hat:  [0, 0, 0, 0, 0, 0, 0, 0,  0, 0, 0, 0, 0, 0, 0, 0],
  },
};

function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

class BgmEngine {
  constructor() {
    this.theme = 'silent';
    this.prestige = 1;
    this.urgent = false;
    this.volume = 0.45;
    this.muted = sounds.muted;
    this.ducked = false;
    this.bus = null;
    this.filter = null;
    this.timer = null;
    this.nextNoteT = 0;
    this.stepIdx = 0;
  }

  _ensureBus() {
    if (!sounds.ctx) return false;
    if (!this.bus || this.bus.context !== sounds.ctx) {
      const ctx = sounds.ctx;
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 1450;
      this.filter.Q.value = 0.6;

      this.bus = ctx.createGain();
      this.bus.gain.value = 0;
      this.filter.connect(this.bus);
      this.bus.connect(sounds.compressor || ctx.destination);
      this._syncBusGain();
    }
    return true;
  }

  _syncBusGain() {
    if (!this.bus || !sounds.ctx) return;
    const t = sounds.ctx.currentTime;
    const cfg = THEMES[this.theme];
    const base = cfg ? cfg.vol : 0;
    const duckMult = this.ducked ? 0.28 : 1;
    const target = this.muted || this.theme === 'silent' ? 0 : base * this.volume * duckMult;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(target, t, 0.06);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) ?? 0.45));
    this._syncBusGain();
    if (this.volume > 0 && this.theme !== 'silent' && !this.timer && sounds.ctx?.state === 'running') {
      this._startLoop();
    }
  }

  setMuted(m) {
    this.muted = Boolean(m);
    this._syncBusGain();
  }

  setDucked(duck) {
    this.ducked = Boolean(duck);
    this._syncBusGain();
  }

  setUrgent(urgent) {
    this.urgent = Boolean(urgent);
    if (this.filter && sounds.ctx) {
      this.filter.frequency.setTargetAtTime(this.urgent ? 2100 : 1450, sounds.ctx.currentTime, 0.15);
    }
  }

  setTheme(theme = 'plaza', { prestige = 1, urgent = false } = {}) {
    const nextTheme = THEMES[theme] ? theme : 'silent';
    const themeChanged = this.theme !== nextTheme;
    this.theme = nextTheme;
    this.prestige = Math.max(1, Math.round(Number(prestige) || 1));
    this.setUrgent(urgent);

    if (this.theme === 'silent') {
      this.stop();
      return;
    }
    this._ensureBus();
    this._syncBusGain();
    if (themeChanged) this.stepIdx = 0;
    if (sounds.ctx?.state === 'running' && !this.timer && this.volume > 0) {
      this._startLoop();
    }
  }

  unlockAndSync() {
    if (this.theme === 'silent' || this.volume <= 0) return;
    sounds.init();
    this._ensureBus();
    this._syncBusGain();
    if (sounds.ctx?.state === 'running' && !this.timer) {
      this._startLoop();
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._syncBusGain();
  }

  _startLoop() {
    if (this.timer || !sounds.ctx) return;
    this.nextNoteT = sounds.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this._scheduleAhead(), STEP_MS);
  }

  _scheduleAhead() {
    const ctx = sounds.ctx;
    if (!ctx || ctx.state !== 'running' || this.muted || this.volume <= 0 || this.theme === 'silent') return;
    if (!this._ensureBus()) return;

    const cfg = THEMES[this.theme];
    if (!cfg) return;

    const tempoBoost = this.theme === 'arcade'
      ? Math.min(10, (this.prestige - 1) * 2) + (this.urgent ? 6 : 0)
      : (this.urgent ? 5 : 0);
    const stepDur = (60 / (cfg.bpm + tempoBoost)) / 4;

    if (this.nextNoteT < ctx.currentTime - 0.2) {
      this.nextNoteT = ctx.currentTime + 0.03;
    }

    while (this.nextNoteT < ctx.currentTime + LOOKAHEAD_S) {
      this._triggerStep(this.stepIdx, this.nextNoteT, stepDur, cfg);
      this.nextNoteT += stepDur;
      this.stepIdx = (this.stepIdx + 1) % 64;
    }
  }

  _playVoice(freq, dur, vol, wave, atTime) {
    const ctx = sounds.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, atTime);
    g.gain.setValueAtTime(0.0001, atTime);
    g.gain.linearRampToValueAtTime(vol, atTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, atTime + dur);
    o.connect(g);
    g.connect(this.filter);
    o.start(atTime);
    o.stop(atTime + dur + 0.02);
  }

  _triggerStep(sIdx, t, stepDur, cfg) {
    const sb = sIdx % 16;
    const bar = Math.floor(sIdx / 16) % cfg.roots.length;
    const rootMidi = cfg.roots[bar];

    // 1. Warm Bass Pulse
    if (cfg.bass[sb]) {
      const oct = this.theme === 'boss' ? 0 : -12;
      this._playVoice(midiToHz(rootMidi + oct), stepDur * 1.65, 0.52, cfg.bassWave, t);
    }

    // 2. Pluck Melody
    const leadNote = cfg.lead[sIdx % cfg.lead.length];
    if (leadNote > 0) {
      this._playVoice(midiToHz(leadNote), stepDur * 1.4, 0.36, cfg.leadWave, t);
      if (this.urgent || this.prestige >= 3) {
        this._playVoice(midiToHz(leadNote + 12), stepDur * 0.9, 0.14, 'sine', t);
      }
    }

    // 3. Soft Offbeat Hi-Hat Texture (reuses zero-GC noise buffer)
    if (cfg.hat[sb] && sounds.noiseBuf) {
      const ctx = sounds.ctx;
      const src = ctx.createBufferSource();
      src.buffer = sounds.noiseBuf;
      const offset = Math.random() * Math.max(0.05, sounds.noiseBuf.duration - 0.1);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 5200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(this.urgent ? 0.18 : 0.11, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.filter);
      src.start(t, offset, 0.05);
    }
  }
}

export const bgm = new BgmEngine();
