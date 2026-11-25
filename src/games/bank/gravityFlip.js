// WIP Bank Reel: Gravity Flip — Geometry Dash "Crimson Circles" HD Cel-Cartoon Edition
// Features:
// - Seamless Nine Circles / Bloodbath crimson-and-black flashing cavern backdrop + BPM equalizer rails
// - Escalating difficulty + synchronized red/black strobe pulse every 15s (0s / 15s / 30s / 45s)
// - 8 progressive Track Sectors unlocked as Prestige increases (spikes, vaults, orbs, saws, pistons, gauntlets)
// - Weebl HD Hero piloting a hovering GD Gravity Pod with neon Nine Circles wave ribbon trail
import { Game } from '../../engine/Game.js';
import { FX } from '../../engine/fx.js';
import { drawToyShadow, traceRoundRect } from '../../engine/toyStyle.js';
import {
  preloadWeeblAtlas,
  drawComicPanel,
  drawComicStarburst,
  drawComicText,
  drawHeroCharacter,
} from '../weeblAtlas.js';

const TAU = Math.PI * 2;
const PHASE_DURATION_S = 15;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const PULSE_PHASES = [
  {
    id: 1,
    name: 'CRIMSON PULSE',
    shortLabel: 'PULSE I',
    bpm: 116,
    speedMult: 1.0,
    spawnMult: 1.0,
    flashDepth: 0.24,
    pillBg: '#450a0a',
    accent: '#ef4444',
  },
  {
    id: 2,
    name: 'BLOOD BEAT',
    shortLabel: 'II +15%',
    bpm: 134,
    speedMult: 1.15,
    spawnMult: 0.88,
    flashDepth: 0.45,
    pillBg: '#7f1d1d',
    accent: '#f97316',
  },
  {
    id: 3,
    name: 'NINE CIRCLES',
    shortLabel: 'III +30%',
    bpm: 152,
    speedMult: 1.30,
    spawnMult: 0.78,
    flashDepth: 0.70,
    pillBg: '#b91c1c',
    accent: '#f43f5e',
  },
  {
    id: 4,
    name: 'BLOODBATH',
    shortLabel: 'IV +48%',
    bpm: 172,
    speedMult: 1.48,
    spawnMult: 0.68,
    flashDepth: 0.92,
    pillBg: '#dc2626',
    accent: '#fef08a',
  },
];

const TRACK_SECTORS = [
  { id: 1, name: 'STEREO CRIMSON',   unlockLabel: 'Obsidian Spikes',       color: '#ef4444' },
  { id: 2, name: 'POLARGEIST VAULT', unlockLabel: 'Air Vaults & Cyan Orbs', color: '#f97316' },
  { id: 3, name: 'NINE CIRCLES',     unlockLabel: 'Crimson Sawblades',     color: '#f43f5e' },
  { id: 4, name: 'CLUTTERFUNK CORE', unlockLabel: 'Slalom Twin Columns',   color: '#e11d48' },
  { id: 5, name: 'DEADLOCKED PULSE', unlockLabel: 'Moving Pistons',        color: '#fb7185' },
  { id: 6, name: 'CATACLYSM RIFT',   unlockLabel: 'Ruby Star Coins',       color: '#fda4af' },
  { id: 7, name: 'BLOODBATH HELL',   unlockLabel: 'Saw & Block Pincers',   color: '#dc2626' },
  { id: 8, name: 'TARTARUS ECLIPSE', unlockLabel: 'Master Abyss Chains',   color: '#fde047' },
];

let _gdBgImg = null;
function getGdBgImage() {
  if (_gdBgImg) return _gdBgImg;
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.decoding = 'async';
  img.src = '/assets/weebl/gd_crimson_bg.jpg';
  _gdBgImg = img;
  return img;
}

export class GravityFlip extends Game {
  static meta = {
    id: 'gravity-flip',
    title: 'Gravity Flip',
    icon: '🔺',
    hint: 'TAP or SPACE to flip · unlock GD track sectors across Prestiges!',
    baseLikes: 3240,
    isPrestige: false,
    parScore60s: 5500,
    roundLen: 60,
    cue: 'TAP TO FLIP · SURVIVE THE RED PULSE!',
    prestigeCue: 'NEW TRACK SECTOR UNLOCKED · FASTER PULSE!',
    scaling: {
      baseSpeed:    { base: 265, rate: 0.16, cap: 375,  mode: 'up',   round: true, label: 'Run Speed' },
      maxSpeed:     { base: 455, rate: 0.16, cap: 620,  mode: 'up',   round: true, label: 'Top Speed' },
      spawnScale:   { base: 1.0, rate: 0.16, floor: 0.64, mode: 'down', label: 'Spike Gaps' },
      trackSectors: { base: 1,   rate: 0.19, cap: 8,    mode: 'up',   round: true, deltaFormat: 'abs', label: 'Track Sectors' },
    },
  };

  init(saved, score = 0) {
    preloadWeeblAtlas();
    getGdBgImage();
    this.fx = new FX();
    this.score = score;

    this.topY = Game.SAFE_TOP + 58;
    this.botY = Game.SAFE_BOTTOM - 50;
    this.playerX = 110;
    this.onTop = saved?.onTop ?? false;
    this.playerY = this.onTop ? this.topY + 24 : this.botY - 24;
    this.vy = 0;
    this.flipAnim = 0;

    this.distance = saved?.distance ?? 0;
    this.roundDistance = 0;
    this.baseRunSpeed = this.diff.baseSpeed ?? 265;
    this.maxRunSpeed = this.diff.maxSpeed ?? 455;
    this.speed = this.baseRunSpeed;

    this.unlockedSectors = clamp(
      Math.max(this.diff.trackSectors ?? 1, Math.min(TRACK_SECTORS.length, this.prestige || 1)),
      1,
      TRACK_SECTORS.length,
    );
    this.prevUnlockedSectors = saved?.unlockedSectors ?? 1;
    this.userCoins = saved?.userCoins ?? 0;

    this.obstacles = [];
    this.collectibles = [];
    this.trail = [];
    this.embers = [];
    this.shockwaves = [];

    this.roundElapsed = 0;
    this.phase = 1;
    this.phaseFlash = 0;
    this.beatPhase = 0;
    this.beatCount = 0;
    this.beatPulse = 0.6;
    this.shake = 0;
    this.orbCooldown = 0;

    this.spawnTimer = 0.65;
    this.grace = saved ? 1.35 : 0.7;
    this._keyHeld = false;

    // Show celebratory sector unlock portal when advancing Prestiges into a new track zone
    this.sectorBannerT = 0;
    if (this.unlockedSectors > this.prevUnlockedSectors || this.prestige > 1) {
      const sec = TRACK_SECTORS[this.unlockedSectors - 1];
      this.sectorBannerT = 2.6;
      this.obstacles.push({
        kind: 'portal',
        x: this.W + 24,
        w: 28,
        sector: sec,
        passed: false,
      });
      this.fx.text(this.W * 0.5, this.topY + 56, `🌀 TRACK ${sec.id}/8: ${sec.name}!`, sec.color, 16, 1.55);
    }
  }

  _elapsedSeconds() {
    return Math.max(this.roundElapsed, this.time || 0);
  }

  _getPhaseIndex() {
    return clamp(Math.floor(this._elapsedSeconds() / PHASE_DURATION_S) + 1, 1, PULSE_PHASES.length);
  }

  _getPhaseConfig(idx = this._getPhaseIndex()) {
    return PULSE_PHASES[clamp(idx - 1, 0, PULSE_PHASES.length - 1)];
  }

  flip(boostVel = 920) {
    this.onTop = !this.onTop;
    this.vy = this.onTop ? -boostVel : boostVel;
    this.flipAnim = 1;
    this.sounds.whoosh();
    this.haptics.light();
    this.fx.burst(this.playerX, this.playerY, this.onTop ? '#ef4444' : '#22d3ee', 10, 145, 0.32, 3);
    this.shockwaves.push({
      x: this.playerX,
      y: this.playerY,
      r: 8,
      maxR: 38,
      life: 0.25,
      maxLife: 0.25,
      color: '#f87171',
    });
  }

  _spawnCollectibleArc(baseX, laneY, count = 3, spacing = 34, kind = 'coin') {
    for (let i = 0; i < count; i++) {
      this.collectibles.push({
        kind,
        x: baseX + i * spacing,
        y: laneY,
        r: kind === 'orb' ? 14 : 11,
        bobSeed: Math.random() * TAU,
      });
    }
  }

  _spawnTrackPattern() {
    const sectors = this.unlockedSectors;
    const midY = (this.topY + this.botY) * 0.5;
    const laneH = this.botY - this.topY;

    // Build weighted pool from currently unlocked Geometry Dash Track Sectors
    const pool = ['spike', 'double_spike', 'stepped_block'];
    if (sectors >= 2) pool.push('floating_vault', 'floating_vault', 'orb_hop');
    if (sectors >= 3) pool.push('saw', 'saw', 'saw_rail');
    if (sectors >= 4) pool.push('slalom');
    if (sectors >= 5) pool.push('piston', 'piston');
    if (sectors >= 6) pool.push('ruby_risk', 'triple_spike');
    if (sectors >= 7) pool.push('pincer_saw');
    if (sectors >= 8) pool.push('eclipse_chain');

    const pick = pool[Math.floor(Math.random() * pool.length)];
    const x0 = this.W + 44;
    const topSide = Math.random() < 0.5;
    const safeCoinY = topSide ? this.botY - 34 : this.topY + 34;

    switch (pick) {
      case 'double_spike': {
        const h = 44 + Math.random() * 24;
        this.obstacles.push({ kind: 'spike', x: x0, topSide, w: 30, h, count: 2 });
        this._spawnCollectibleArc(x0, safeCoinY, 3, 32, 'coin');
        return 0;
      }
      case 'triple_spike': {
        const h = 42 + Math.random() * 18;
        this.obstacles.push({ kind: 'spike', x: x0, topSide, w: 28, h, count: 3 });
        this._spawnCollectibleArc(x0 + 8, safeCoinY, 3, 32, sectors >= 6 ? 'ruby' : 'coin');
        return 0.14;
      }
      case 'stepped_block': {
        const w = 52 + Math.random() * 20;
        const h = 58 + Math.random() * 34;
        this.obstacles.push({ kind: 'block', x: x0, topSide, w, h, spikedCap: sectors >= 2 });
        this._spawnCollectibleArc(x0 - 4, safeCoinY, 3, 32, 'coin');
        return 0.06;
      }
      case 'floating_vault': {
        const w = 74;
        const h = 46;
        const offset = (topSide ? -1 : 1) * (laneH * 0.14);
        const by = midY + offset - h * 0.5;
        this.obstacles.push({ kind: 'floating', x: x0, y: by, w, h, spikedCap: true });
        this._spawnCollectibleArc(x0 + 22, topSide ? this.botY - 40 : this.topY + 40, 2, 34, 'coin');
        this.collectibles.push({
          kind: 'orb',
          x: x0 + w * 0.5,
          y: topSide ? this.topY + 46 : this.botY - 46,
          r: 15,
          bobSeed: 0,
        });
        return 0.12;
      }
      case 'orb_hop': {
        const h = 54 + Math.random() * 26;
        this.obstacles.push({ kind: 'spike', x: x0, topSide, w: 30, h, count: 2 });
        this.collectibles.push({ kind: 'orb', x: x0 + 24, y: midY, r: 15, bobSeed: 1.2 });
        this._spawnCollectibleArc(x0 + 68, topSide ? this.topY + 34 : this.botY - 34, 2, 30, 'coin');
        return 0.1;
      }
      case 'saw': {
        const r = 24 + (sectors >= 6 ? 4 : 0);
        const sy = midY + (Math.random() - 0.5) * (laneH * 0.42);
        this.obstacles.push({ kind: 'saw', x: x0 + r, y: sy, r, spinDir: topSide ? 1 : -1, rot: 0 });
        this._spawnCollectibleArc(x0, sy < midY ? this.botY - 34 : this.topY + 34, 3, 32, 'coin');
        return 0.1;
      }
      case 'saw_rail': {
        const r = 23;
        const sy = topSide ? this.topY + 52 : this.botY - 52;
        this.obstacles.push({ kind: 'saw', x: x0 + r, y: sy, r, spinDir: 1, rot: 0 });
        this._spawnCollectibleArc(x0 - 4, safeCoinY, 3, 30, 'coin');
        return 0.08;
      }
      case 'slalom': {
        const h1 = 56;
        const h2 = 56;
        this.obstacles.push({ kind: 'block', x: x0, topSide, w: 46, h: h1, spikedCap: true });
        this.obstacles.push({ kind: 'block', x: x0 + 165, topSide: !topSide, w: 46, h: h2, spikedCap: true });
        this._spawnCollectibleArc(x0 + 84, midY, 2, 32, 'coin');
        return 0.42;
      }
      case 'piston': {
        const w = 36;
        const h = 76;
        this.obstacles.push({
          kind: 'piston',
          x: x0,
          w,
          h,
          minY: this.topY + 26,
          maxY: this.botY - h - 26,
          oscPhase: Math.random() * TAU,
          oscSpeed: 3.1 + sectors * 0.15,
          y: midY - h * 0.5,
        });
        this._spawnCollectibleArc(x0 + 48, midY, 2, 34, 'ruby');
        return 0.22;
      }
      case 'ruby_risk': {
        const h = 50;
        this.obstacles.push({ kind: 'spike', x: x0, topSide, w: 30, h, count: 2 });
        this._spawnCollectibleArc(x0 + 12, safeCoinY, 2, 32, 'coin');
        // High-risk Ruby coin tucked directly over the opposite rim of the spike peak
        this.collectibles.push({
          kind: 'ruby',
          x: x0 + 28,
          y: topSide ? this.topY + h + 30 : this.botY - h - 30,
          r: 12,
          bobSeed: 0.7,
        });
        return 0.1;
      }
      case 'pincer_saw': {
        const r = 22;
        this.obstacles.push({ kind: 'saw', x: x0 + 28, y: midY - 62, r, spinDir: 1, rot: 0 });
        this.obstacles.push({ kind: 'block', x: x0 + 130, topSide: false, w: 46, h: 64, spikedCap: true });
        this.collectibles.push({ kind: 'orb', x: x0 + 82, y: midY + 44, r: 15, bobSeed: 0 });
        return 0.36;
      }
      case 'eclipse_chain': {
        this.obstacles.push({ kind: 'spike', x: x0, topSide: false, w: 28, h: 48, count: 2 });
        this.obstacles.push({ kind: 'saw', x: x0 + 135, y: this.topY + 72, r: 24, spinDir: -1, rot: 0 });
        this.obstacles.push({ kind: 'block', x: x0 + 250, topSide: false, w: 44, h: 62, spikedCap: true });
        this._spawnCollectibleArc(x0 + 95, this.botY - 36, 2, 34, 'ruby');
        return 0.56;
      }
      case 'spike':
      default: {
        const h = 44 + Math.random() * 34;
        this.obstacles.push({ kind: 'spike', x: x0, topSide, w: 32, h, count: 1 });
        this._spawnCollectibleArc(x0 - 4, safeCoinY, 3, 34, 'coin');
        return 0;
      }
    }
  }

  _checkObstacleCollision(o) {
    const px = this.playerX;
    const py = this.playerY;
    const pr = 14;

    if (o.kind === 'portal') return false;

    if (o.kind === 'saw') {
      return Math.hypot(px - o.x, py - o.y) < (pr + o.r * 0.74);
    }

    if (o.kind === 'floating' || o.kind === 'piston') {
      const hitX = px + pr > o.x + 4 && px - pr < o.x + o.w - 4;
      const hitY = py + pr > o.y + 4 && py - pr < o.y + o.h - 4;
      return hitX && hitY;
    }

    if (o.kind === 'block') {
      const by = o.topSide ? this.topY : this.botY - o.h;
      const hitX = px + pr > o.x + 4 && px - pr < o.x + o.w - 4;
      const hitY = py + pr > by + 4 && py - pr < by + o.h - 4;
      return hitX && hitY;
    }

    // Tapered triangular hitbox for single or clustered GD spikes
    const count = o.count || 1;
    const oy = o.topSide ? this.topY : this.botY - o.h;
    for (let k = 0; k < count; k++) {
      const sx = o.x + k * (o.w - 2);
      const center = sx + o.w * 0.5;
      const apexY = o.topSide ? oy + o.h : oy;
      const relFromTip = o.topSide
        ? clamp((apexY - (py - pr)) / Math.max(12, o.h), 0, 1.2)
        : clamp(((py + pr) - apexY) / Math.max(12, o.h), 0, 1.2);
      const inY = o.topSide ? (py - pr < apexY && py + pr > oy) : (py + pr > apexY && py - pr < oy + o.h);
      if (!inY) continue;
      const halfSpan = o.w * 0.41 * clamp(relFromTip, 0.22, 1.0);
      if (Math.abs(px - center) < halfSpan + pr * 0.72) return true;
    }
    return false;
  }

  _emitEmbers(count, fast = false) {
    for (let i = 0; i < count; i++) {
      this.embers.push({
        x: this.W + Math.random() * 40,
        y: this.topY + 12 + Math.random() * (this.botY - this.topY - 24),
        vx: -(fast ? 260 : 140) - Math.random() * 190,
        vy: (Math.random() - 0.5) * 38,
        size: 1.8 + Math.random() * 2.8,
        life: 1.4 + Math.random() * 1.1,
        maxLife: 2.5,
      });
    }
  }

  updateDying(dt) {
    this.fx.update(dt);
    this.phaseFlash = Math.max(0, this.phaseFlash - dt * 1.8);
    this.beatPulse = Math.max(0, this.beatPulse - dt * 6);
    this.shake = Math.max(0, this.shake - dt * 26);
    for (const o of this.obstacles) {
      if (o.kind === 'saw') o.rot += 9 * o.spinDir * dt;
    }
  }

  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }
    this.fx.update(dt);
    this.roundElapsed += dt;
    this.grace = Math.max(0, this.grace - dt);
    this.flipAnim = Math.max(0, this.flipAnim - dt * 3.8);
    this.phaseFlash = Math.max(0, this.phaseFlash - dt * 1.3);
    this.sectorBannerT = Math.max(0, this.sectorBannerT - dt);
    this.orbCooldown = Math.max(0, this.orbCooldown - dt);
    this.shake = Math.max(0, this.shake - dt * 28);

    // Every 15 seconds: step up speed, spawn density, and Nine Circles red/black strobe pulse
    const nextPhase = this._getPhaseIndex();
    const phaseCfg = this._getPhaseConfig(nextPhase);
    if (nextPhase > this.phase) {
      this.phase = nextPhase;
      this.phaseFlash = 1.0;
      this.shake = 5 + this.phase * 1.6;
      this.sounds.upgrade();
      this.sounds.tone({ f: 110 + this.phase * 18, to: 44, type: 'sawtooth', dur: 0.18, vol: 0.2 });
      this.haptics.medium();
      this.fx.burst(this.W * 0.5, (this.topY + this.botY) * 0.5, phaseCfg.accent, 22, 230, 0.55, 4);
      this.fx.text(
        this.W * 0.5,
        this.topY + 72,
        `⚡ ${(this.phase - 1) * 15}s! ${phaseCfg.name} (${phaseCfg.shortLabel})!`,
        phaseCfg.accent,
        16,
        1.45,
      );
    }

    // Beat clock drives synced Nine Circles red/black flashes
    const prevBeat = Math.floor(this.beatPhase);
    this.beatPhase += (phaseCfg.bpm / 60) * dt;
    const nowBeat = Math.floor(this.beatPhase);
    if (nowBeat > prevBeat) {
      this.beatCount++;
      this.beatPulse = 1.0;
    } else {
      this.beatPulse *= Math.exp(-9.5 * dt);
    }

    // Input (tap/click or Space/W/S/Up/Down — 1 flip per press)
    const keyActive = this.input.key(' ', 'arrowup', 'arrowdown', 'w', 's');
    if (this.input.pressed || (keyActive && !this._keyHeld)) {
      this.flip();
    }
    this._keyHeld = keyActive;

    // Crisp GD gravity physics
    const grav = this.onTop ? -2900 : 2900;
    this.vy += grav * dt;
    this.playerY += this.vy * dt;

    const minY = this.topY + 22;
    const maxY = this.botY - 22;
    if (this.playerY <= minY) {
      this.playerY = minY;
      this.vy = 0;
    } else if (this.playerY >= maxY) {
      this.playerY = maxY;
      this.vy = 0;
    }

    // Scroll speed scales cleanly by distance AND 15s pulse tier
    const baseCurve = Math.min(this.maxRunSpeed, this.baseRunSpeed + this.roundDistance * 0.011);
    this.speed = Math.min(this.maxRunSpeed * (1 + (this.phase - 1) * 0.12), baseCurve * phaseCfg.speedMult);
    const step = this.speed * dt;
    this.distance += step;
    this.roundDistance += step;
    this.score += step * 0.16;

    // Nine Circles wave neon trail behind Hero
    for (const pt of this.trail) pt.x -= step;
    this.trail.push({ x: this.playerX - 10, y: this.playerY });
    while (this.trail.length > 18) this.trail.shift();

    // Crimson ambient sparks (denser at Phase 3/4)
    if (Math.random() < (this.phase >= 3 ? 0.45 : 0.18)) {
      this._emitEmbers(1, this.phase >= 3);
    }
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= dt;
      if (e.life <= 0 || e.x < -30) this.embers.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      sw.r += (sw.maxR - sw.r) * Math.min(1, dt * 11);
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    // Pattern spawner gated by unlocked Prestige Track Sectors + 15s spawnScale
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const extraDelay = this._spawnTrackPattern();
      const baseGap = Math.max(0.42, (1.02 - (baseCurve - this.baseRunSpeed) * 0.002) * (this.diff.spawnScale ?? 1));
      this.spawnTimer = Math.max(0.32, baseGap * phaseCfg.spawnMult + extraDelay);
    }

    // Update Obstacles & Check Collisions
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.x -= step;
      if (o.kind === 'saw') o.rot += 11 * o.spinDir * dt;
      if (o.kind === 'piston') {
        o.oscPhase += o.oscSpeed * dt;
        o.y = o.minY + ((Math.sin(o.oscPhase) + 1) * 0.5) * (o.maxY - o.minY);
      }
      if (o.kind === 'portal' && !o.passed && o.x <= this.playerX) {
        o.passed = true;
        this.sounds.powerup();
        this.fx.burst(this.playerX, (this.topY + this.botY) * 0.5, o.sector.color, 20, 220, 0.55, 4);
      }

      if (this.grace <= 0 && this._checkObstacleCollision(o)) {
        this.fx.burst(this.playerX, this.playerY, '#ef4444', 24, 240, 0.58, 4.5);
        this.shake = 12;
        this.die(o.kind === 'saw' ? 'Sliced by Crimson Saw! 🔺' : 'Crashed on GD Spike! 🔥');
        return;
      }

      if (o.x + (o.w || o.r * 2 || 40) * (o.count || 1) < -40) {
        if (o.kind !== 'portal') this.score += 35 + this.phase * 5;
        this.obstacles.splice(i, 1);
      }
    }

    // Update Collectibles (GD User Coins, Ruby Star Coins & Cyan Gravity Orbs)
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.x -= step;
      c.bobSeed += dt * 4.5;
      const dist = Math.hypot(this.playerX - c.x, this.playerY - c.y);
      if (dist <= c.r + 18) {
        if (c.kind === 'orb') {
          if (this.orbCooldown <= 0) {
            this.orbCooldown = 0.25;
            this.score += 120;
            this.grace = Math.max(this.grace, 0.25);
            this.flipAnim = 1;
            this.sounds.powerup();
            this.haptics.light();
            this.fx.burst(c.x, c.y, '#22d3ee', 14, 175, 0.36, 3.5);
            this.fx.text(c.x, c.y - 18, '+120 BOOST!', '#67e8f9', 15, 0.55);
            this.shockwaves.push({
              x: c.x,
              y: c.y,
              r: 10,
              maxR: 48,
              life: 0.28,
              maxLife: 0.28,
              color: '#22d3ee',
            });
          }
        } else {
          const isRuby = c.kind === 'ruby';
          const pts = isRuby ? 160 : 75;
          this.score += pts;
          this.userCoins += 1;
          this.fx.burst(c.x, c.y, isRuby ? '#fb7185' : '#facc15', 10, 145, 0.34, 3);
          this.fx.text(c.x, c.y - 16, `+${pts}`, isRuby ? '#fda4af' : '#fde047', 15, 0.52);
          this.sounds.bubble(isRuby ? 1.45 : 1.2);
          this.haptics.light();
        }
        this.collectibles.splice(i, 1);
      } else if (c.x < -30) {
        this.collectibles.splice(i, 1);
      }
    }
  }

  _drawGdBackdrop(ctx, animT) {
    const { W, H } = this;
    const cfg = this._getPhaseConfig();
    const strobe = this.beatPulse * cfg.flashDepth;

    // 1. Deep Black-to-Crimson Cavity Base
    const baseGrad = ctx.createLinearGradient(0, 0, 0, H);
    baseGrad.addColorStop(0, '#050205');
    baseGrad.addColorStop(0.5, strobe > 0.4 ? '#22040a' : '#0f0307');
    baseGrad.addColorStop(1, '#050205');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Seamless Panoramic GD Crimson Cavern Layer (1080x960 -> seamless loop!)
    const bgImg = getGdBgImage();
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      const tileW = W * 2; // 1080x960 scales to 900x800 in 450x800 viewport
      const sx = ((this.distance * 0.16) % tileW + tileW) % tileW;
      ctx.save();
      ctx.globalAlpha = 0.54 + strobe * 0.22;
      ctx.drawImage(bgImg, -sx, 0, tileW, H);
      ctx.drawImage(bgImg, tileW - sx, 0, tileW, H);
      ctx.restore();
    }

    // 3. Synchronized Nine Circles Red-and-Black Geometric Diamond Pulse Grid
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.topY, W, this.botY - this.topY);
    ctx.clip();

    // Darken or flash crimson behind grid based on beat polarity
    const beatEven = this.beatCount % 2 === 0;
    const bgFlashAlpha = strobe * (this.phase >= 3 ? 0.28 : 0.16);
    if (bgFlashAlpha > 0.01) {
      ctx.fillStyle = `rgba(220, 38, 38, ${bgFlashAlpha.toFixed(3)})`;
      ctx.fillRect(0, this.topY, W, this.botY - this.topY);
    }

    // Scrolling Nine Circles diamond wave lattice
    const cell = 64;
    const gridOffX = (this.distance * 0.38) % cell;
    const midY = (this.topY + this.botY) * 0.5;
    for (let gx = -cell - gridOffX; gx < W + cell; gx += cell) {
      let row = 0;
      for (let gy = this.topY + 18; gy < this.botY - 12; gy += cell) {
        const checker = ((Math.round((gx + gridOffX) / cell) + row) & 1) === 0;
        const lit = beatEven ? checker : !checker;
        const pulseA = lit ? (0.04 + strobe * (this.phase >= 3 ? 0.22 : 0.11)) : 0.015;
        ctx.fillStyle = lit
          ? `rgba(239, 68, 68, ${pulseA.toFixed(3)})`
          : `rgba(0, 0, 0, ${(pulseA + 0.18).toFixed(3)})`;
        ctx.strokeStyle = `rgba(248, 113, 113, ${(0.06 + strobe * 0.22).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        const cx = gx + cell * 0.5;
        const cy = gy + cell * 0.5;
        const r = cell * 0.34;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        row++;
      }
    }

    // Fast neon red laser speed lines synced to beat
    const streakOff = (this.distance * 0.72) % 320;
    ctx.strokeStyle = `rgba(254, 100, 100, ${(0.14 + strobe * 0.32).toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const lx = ((i * 95 - streakOff + 640) % 640) - 70;
      const ly = this.topY + 28 + ((i * 73) % (this.botY - this.topY - 56));
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 42 + this.phase * 10, ly);
      ctx.stroke();
    }

    // Center dark vignette strip subtly deepens black contrast during flashes
    const vignette = ctx.createRadialGradient(W * 0.5, midY, 80, W * 0.5, midY, W * 0.85);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, `rgba(0,0,0,${(0.32 + (1 - strobe) * 0.16).toFixed(2)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, this.topY, W, this.botY - this.topY);
    ctx.restore();

    // Brief celebratory flash overlay on 15s tier change
    if (this.phaseFlash > 0.02) {
      ctx.fillStyle = `rgba(239, 68, 68, ${(this.phaseFlash * 0.22).toFixed(3)})`;
      ctx.fillRect(0, Game.SAFE_TOP, W, Game.PLAY_HEIGHT);
    }
  }

  _drawDungeonRails(ctx) {
    const { W } = this;
    const cfg = this._getPhaseConfig();
    const strobe = this.beatPulse * cfg.flashDepth;

    // Upper & lower dark obsidian backing bands inside SAFE_TOP..topY and botY..SAFE_BOTTOM
    ctx.fillStyle = '#090407';
    ctx.fillRect(0, Game.SAFE_TOP, W, this.topY - Game.SAFE_TOP);
    ctx.fillRect(0, this.botY, W, Game.SAFE_BOTTOM - this.botY);

    // Classic Geometry Dash scrolling Square-in-Square Obsidian Blocks + Crimson Pulse Equalizer
    const step = 46;
    const off = this.distance % step;
    for (let tx = -off - step; tx < W + step; tx += step) {
      const idx = Math.floor((this.distance + tx) / step);
      const eq = 0.35 + 0.65 * Math.abs(Math.sin(idx * 1.7 + this.beatPhase * 1.2)) * strobe;
      const fillTile = `rgba(${Math.round(35 + eq * 95)}, 8, 14, 1)`;

      for (const ry of [this.topY - 22, this.botY + 6]) {
        ctx.save();
        ctx.fillStyle = fillTile;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.6;
        traceRoundRect(ctx, tx + 2, ry, step - 6, 16, 3);
        ctx.fill();
        ctx.stroke();

        // Inner bevel square rune
        ctx.strokeStyle = `rgba(239, 68, 68, ${(0.28 + strobe * 0.55).toFixed(2)})`;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(tx + 7, ry + 4, step - 16, 8);
        ctx.restore();
      }
    }

    // Active Gravity Surface Laser Rails (bright crimson/gold for active lane, slate for inactive)
    const drawRail = (y, active) => {
      ctx.save();
      ctx.fillStyle = active ? '#ef4444' : '#334155';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.6;
      ctx.fillRect(-4, y, W + 8, 7);
      ctx.strokeRect(-4, y, W + 8, 7);
      if (active) {
        ctx.fillStyle = strobe > 0.35 ? '#fef08a' : '#fca5a5';
        ctx.fillRect(0, y + 1.5, W, 2.5);
      }
      ctx.restore();
    };
    drawRail(this.topY - 6, this.onTop);
    drawRail(this.botY, !this.onTop);
  }

  _drawGdSpike(ctx, sx, oy, w, h, topSide, glowAmt) {
    const cx = sx + w * 0.5;
    const baseY = topSide ? oy : oy + h;
    const apexY = topSide ? oy + h : oy;
    const dir = topSide ? -1 : 1;

    ctx.save();
    ctx.lineJoin = 'round';

    // Subtle dark halo behind spike so it separates cleanly from red background streaks
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(sx + 1, baseY);
    ctx.lineTo(cx, apexY);
    ctx.lineTo(sx + w - 1, baseY);
    ctx.closePath();
    ctx.stroke();

    // Two-tone vivid crimson-obsidian body for crisp foreground pop
    ctx.fillStyle = glowAmt > 0.4 ? '#ef4444' : '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(sx + 1, baseY);
    ctx.lineTo(cx, apexY);
    ctx.lineTo(cx, baseY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.moveTo(cx, baseY);
    ctx.lineTo(cx, apexY);
    ctx.lineTo(sx + w - 1, baseY);
    ctx.closePath();
    ctx.fill();

    // Dark obsidian inner core triangle
    ctx.fillStyle = '#14080e';
    ctx.beginPath();
    ctx.moveTo(sx + 6, baseY + dir * 2);
    ctx.lineTo(cx, apexY + dir * 11);
    ctx.lineTo(sx + w - 6, baseY + dir * 2);
    ctx.closePath();
    ctx.fill();

    // Classic Geometry Dash crisp bright white-pink rim highlight around spike edges
    ctx.strokeStyle = glowAmt > 0.45 ? '#ffffff' : '#fecdd3';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(sx + 2.5, baseY + dir * 1);
    ctx.lineTo(cx, apexY + dir * 2.5);
    ctx.lineTo(sx + w - 2.5, baseY + dir * 1);
    ctx.stroke();

    // Chunky Weebl #000 black outer ink outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(sx + 1, baseY);
    ctx.lineTo(cx, apexY);
    ctx.lineTo(sx + w - 1, baseY);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  _drawGdBlock(ctx, x, y, w, h, strokeBoost) {
    ctx.save();

    // Dark drop silhouette separates block cleanly from crimson pulse background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    traceRoundRect(ctx, x + 3, y + 4, w, h, 5);
    ctx.fill();

    // Solid dark charcoal-slate block fill (neutral dark cool tone pops vs pure red cavern!)
    const blkGrad = ctx.createLinearGradient(x, y, x, y + h);
    blkGrad.addColorStop(0, '#272030');
    blkGrad.addColorStop(1, '#120d18');
    ctx.fillStyle = blkGrad;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.4;
    traceRoundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.stroke();

    // Razor-crisp bright pink-white outer GD neon frame just inside ink border
    ctx.strokeStyle = strokeBoost > 0.45 ? '#ffffff' : '#fda4af';
    ctx.lineWidth = 2.2;
    traceRoundRect(ctx, x + 3.5, y + 3.5, w - 7, h - 7, 3);
    ctx.stroke();

    // Inner bright crimson armored tile core + diagonal cross detail
    ctx.fillStyle = 'rgba(239, 68, 68, 0.34)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.6;
    traceRoundRect(ctx, x + 9, y + 9, Math.max(6, w - 18), Math.max(6, h - 18), 2);
    ctx.fill();
    ctx.stroke();

    // Gloss corner brackets & top highlight bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.fillRect(x + 6, y + 5, Math.max(6, w - 12), 3);
    ctx.restore();
  }

  _drawGdSaw(ctx, s, glowAmt) {
    const teeth = 12;
    const outerR = s.r + 5;
    const innerR = s.r - 4;

    ctx.save();
    ctx.translate(s.x, s.y);

    // Subtle crimson warning aura ring behind spinning saw
    ctx.fillStyle = `rgba(239, 68, 68, ${(0.18 + glowAmt * 0.22).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(0, 0, outerR + 5, 0, TAU);
    ctx.fill();

    ctx.rotate(s.rot);

    // High-contrast steel-silver razor gear blades so teeth pop cleanly against dark red/black!
    const steelGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, outerR);
    steelGrad.addColorStop(0, '#ffffff');
    steelGrad.addColorStop(0.55, '#cbd5e1');
    steelGrad.addColorStop(1, '#475569');

    ctx.fillStyle = steelGrad;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * TAU;
      const aTip = a0 + (0.3 / teeth) * TAU * s.spinDir;
      const a1 = a0 + (0.72 / teeth) * TAU * s.spinDir;
      if (i === 0) ctx.moveTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR);
      else ctx.lineTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR);
      ctx.lineTo(Math.cos(aTip) * outerR, Math.sin(aTip) * outerR);
      ctx.lineTo(Math.cos(a1) * innerR, Math.sin(a1) * innerR);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing crimson inner saw ring
    ctx.fillStyle = '#18111b';
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 0.68, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = glowAmt > 0.45 ? '#ffffff' : '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 0.62, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 0.34, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Inner crosshairs so rotation direction pops visually
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s.r * 0.25, 0);
    ctx.lineTo(s.r * 0.25, 0);
    ctx.moveTo(0, -s.r * 0.25);
    ctx.lineTo(0, s.r * 0.25);
    ctx.stroke();

    ctx.restore();
  }

  _drawObstacle(ctx, o) {
    const strobe = this.beatPulse * this._getPhaseConfig().flashDepth;

    if (o.kind === 'portal') {
      const midY = (this.topY + this.botY) * 0.5;
      const h = (this.botY - this.topY) * 0.72;
      ctx.save();
      ctx.translate(o.x, midY);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, h * 0.45, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = o.sector.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, h * 0.45, 0, 0, TAU);
      ctx.stroke();
      drawComicText(ctx, `TRACK ${o.sector.id}`, 0, -h * 0.5 - 12, "900 12px 'Fredoka', sans-serif", o.sector.color, {
        strokeWidth: 4,
      });
      ctx.restore();
      return;
    }

    if (o.kind === 'saw') {
      this._drawGdSaw(ctx, o, strobe);
      return;
    }

    if (o.kind === 'piston') {
      // Guide slot behind oscillating piston
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w * 0.5, this.topY + 12);
      ctx.lineTo(o.x + o.w * 0.5, this.botY - 12);
      ctx.stroke();
      ctx.restore();
      this._drawGdBlock(ctx, o.x, o.y, o.w, o.h, strobe);
      this._drawGdSpike(ctx, o.x + 4, o.y - 14, o.w - 8, 16, false, strobe);
      this._drawGdSpike(ctx, o.x + 4, o.y + o.h - 2, o.w - 8, 16, true, strobe);
      return;
    }

    if (o.kind === 'floating') {
      this._drawGdBlock(ctx, o.x, o.y, o.w, o.h, strobe);
      this._drawGdSpike(ctx, o.x + 6, o.y - 16, 28, 18, false, strobe);
      this._drawGdSpike(ctx, o.x + o.w - 34, o.y - 16, 28, 18, false, strobe);
      this._drawGdSpike(ctx, o.x + 6, o.y + o.h - 2, 28, 18, true, strobe);
      this._drawGdSpike(ctx, o.x + o.w - 34, o.y + o.h - 2, 28, 18, true, strobe);
      return;
    }

    if (o.kind === 'block') {
      const by = o.topSide ? this.topY : this.botY - o.h;
      this._drawGdBlock(ctx, o.x, by, o.w, o.h, strobe);
      if (o.spikedCap) {
        const capH = 18;
        const capY = o.topSide ? by + o.h - 2 : by - capH + 2;
        this._drawGdSpike(ctx, o.x + o.w * 0.5 - 14, capY, 28, capH, o.topSide, strobe);
      }
      return;
    }

    // Standard single/double/triple spikes
    const count = o.count || 1;
    const oy = o.topSide ? this.topY : this.botY - o.h;
    for (let k = 0; k < count; k++) {
      this._drawGdSpike(ctx, o.x + k * (o.w - 2), oy, o.w, o.h, o.topSide, strobe);
    }
  }

  _drawCollectible(ctx, c, animT) {
    const cy = c.y + Math.sin(c.bobSeed) * 3;
    ctx.save();
    ctx.translate(c.x, cy);

    if (c.kind === 'orb') {
      // Iconic Geometry Dash Neon Cyan Jump/Gravity Orb
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, c.r + 5 + Math.sin(animT * 8) * 1.5, animT * 3, animT * 3 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      drawComicStarburst(ctx, 0, 0, c.r + 1, c.r * 0.65, 8, '#22d3ee', '#000000', animT * 2.5, 2.4);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, TAU);
      ctx.fill();
    } else if (c.kind === 'ruby') {
      // High-value Crimson Star User Coin
      drawComicStarburst(ctx, 0, 0, 17, 11, 7, 'rgba(251, 113, 133, 0.35)', 'rgba(225, 29, 72, 0.55)', -animT * 2, 1.5);
      const grad = ctx.createLinearGradient(-10, -10, 10, 10);
      grad.addColorStop(0, '#fecdd3');
      grad.addColorStop(0.5, '#f43f5e');
      grad.addColorStop(1, '#9f1239');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(11, -3);
      ctx.lineTo(7, 11);
      ctx.lineTo(-7, 11);
      ctx.lineTo(-11, -3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Chunky GD Gold User Coin with black ink border & star stamp
      const coinGrad = ctx.createRadialGradient(-3, -4, 2, 0, 0, c.r);
      coinGrad.addColorStop(0, '#fef08a');
      coinGrad.addColorStop(0.65, '#facc15');
      coinGrad.addColorStop(1, '#b45309');
      ctx.fillStyle = coinGrad;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, c.r * 0.65, 0, TAU);
      ctx.stroke();

      drawComicStarburst(ctx, 0, 0, c.r * 0.45, c.r * 0.2, 5, '#fef9c3', '#92400e', 0, 1.2);
    }
    ctx.restore();
  }

  _drawPlayer(ctx, animT) {
    // 1. Nine Circles Wave Neon Ribbon Trail
    if (this.trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      for (let i = 0; i < this.trail.length; i++) {
        const pt = this.trail[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      const trailGrad = ctx.createLinearGradient(this.trail[0].x, 0, this.playerX, 0);
      trailGrad.addColorStop(0, 'rgba(220, 38, 38, 0.15)');
      trailGrad.addColorStop(0.6, '#ef4444');
      trailGrad.addColorStop(1, '#fef08a');
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = 8;
      ctx.beginPath();
      for (let i = 0; i < this.trail.length; i++) {
        const pt = this.trail[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Proximity Shadow onto current gravity surface
    const surfaceDist = this.onTop
      ? Math.max(0, this.playerY - (this.topY + 22))
      : Math.max(0, (this.botY - 22) - this.playerY);
    const shScale = Math.max(0.32, 1 - surfaceDist / 260);
    drawToyShadow(ctx, this.playerX, this.onTop ? this.topY + 3 : this.botY - 3, 18 * shScale, 5.5 * shScale, 0.4 * shScale);

    // Detect close obstacle for reactive facial expression
    let dangerNear = this.phase >= 4;
    if (!dangerNear) {
      for (const o of this.obstacles) {
        if (o.kind !== 'portal' && Math.abs(o.x - this.playerX) < 75) {
          dangerNear = true;
          break;
        }
      }
    }

    ctx.save();
    if (this.grace > 0 && Math.floor(this.grace * 14) % 2 === 0) ctx.globalAlpha = 0.55;
    ctx.translate(this.playerX, this.playerY);
    if (this.onTop) ctx.scale(1, -1);

    const airborne = Math.abs(this.vy) > 40;
    const tilt = clamp(this.vy * 0.00032, -0.26, 0.26) * (this.onTop ? -1 : 1);
    ctx.rotate(tilt);

    // Hovering Crimson-Gold GD Gravity Cube Pod under Hero
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.6;
    traceRoundRect(ctx, -18, 9, 36, 12, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(-13, 12, 26, 4);

    // Thruster flame jet behind pod
    const jetLen = 9 + Math.sin(animT * 42) * 3;
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-18, 11);
    ctx.lineTo(-18 - jetLen, 15);
    ctx.lineTo(-18, 19);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    drawHeroCharacter(ctx, 0, 14, 50, {
      view: 'threeQuarterFront',
      dir: 1,
      state: this.dead ? 'dead' : airborne ? 'hop_leap' : 'stand_alert',
      expr: this.dead ? 'dizzy' : dangerNear ? 'panic' : airborne ? 'focus' : 'happy',
      t: animT * 5.2,
      lean: 0.16,
      lookX: 0.7,
    });
    ctx.restore();
  }

  _drawHudHeader(ctx) {
    const { W } = this;
    const elapsed = this._elapsedSeconds();
    const curSec = TRACK_SECTORS[this.unlockedSectors - 1];
    const phaseCfg = this._getPhaseConfig();
    const topBarY = Game.SAFE_TOP + 6;

    // Left Pill: Current Prestige + Unlocked Track Sector Name + Segmented 8-Sector Bar
    const leftW = 248;
    drawComicPanel(ctx, 12, topBarY, leftW, 40, 11, '#090407', {
      borderColor: curSec.color,
      borderWidth: 2.5,
      shadowOffset: 3,
      shadowColor: 'rgba(0,0,0,0.5)',
    });
    drawComicText(
      ctx,
      `◆ P${this.prestige} · ${curSec.name}`,
      20,
      topBarY + 13,
      "900 10.5px 'Fredoka', 'Outfit', sans-serif",
      '#ffffff',
      { align: 'left', strokeWidth: 3 },
    );
    drawComicText(
      ctx,
      `${Math.round(this.distance / 10)}m`,
      12 + leftW - 10,
      topBarY + 13,
      "900 10.5px 'Fredoka', 'Outfit', sans-serif",
      '#fde047',
      { align: 'right', strokeWidth: 3 },
    );

    // 8 Segmented Track Progress Blocks showing Prestige Unlocks!
    const segTotalW = leftW - 18;
    const segGap = 3;
    const segW = (segTotalW - segGap * (TRACK_SECTORS.length - 1)) / TRACK_SECTORS.length;
    const segY = topBarY + 24;
    const runFrac = clamp(elapsed / 60, 0, 1);
    for (let i = 0; i < TRACK_SECTORS.length; i++) {
      const sx = 21 + i * (segW + segGap);
      const sec = TRACK_SECTORS[i];
      const unlocked = i < this.unlockedSectors;
      const isCurrent = i === this.unlockedSectors - 1;
      ctx.fillStyle = unlocked ? '#261016' : '#111827';
      ctx.strokeStyle = unlocked ? sec.color : '#374151';
      ctx.lineWidth = 1.4;
      ctx.fillRect(sx, segY, segW, 9);
      if (unlocked) {
        const fillW = isCurrent ? segW * Math.max(0.14, runFrac) : segW;
        ctx.fillStyle = sec.color;
        ctx.fillRect(sx, segY, fillW, 9);
      }
      ctx.strokeRect(sx, segY, segW, 9);
    }

    // Right Pill: Every-15s Red/Black Difficulty & Pulse Tier Indicator
    const rightW = W - (12 + leftW + 18);
    const rightX = 12 + leftW + 6;
    const nextSwitch = this.phase < 4 ? Math.max(1, Math.ceil(this.phase * PHASE_DURATION_S - elapsed)) : Math.max(0, Math.ceil(60 - elapsed));
    const rightLabel = this.phase === 1
      ? `+15% PULSE IN ${nextSwitch}s`
      : this.phase === 2
        ? `+15% · +30% IN ${nextSwitch}s`
        : this.phase === 3
          ? `+30% · +48% IN ${nextSwitch}s`
          : `💀 MAX +48% · ${nextSwitch}s`;

    drawComicPanel(ctx, rightX, topBarY, rightW, 40, 11, phaseCfg.pillBg, {
      borderColor: phaseCfg.accent,
      borderWidth: 2.5,
      shadowOffset: 3,
      shadowColor: 'rgba(0,0,0,0.5)',
    });
    drawComicText(
      ctx,
      phaseCfg.name,
      rightX + rightW * 0.5,
      topBarY + 13,
      "900 10px 'Fredoka', 'Outfit', sans-serif",
      phaseCfg.accent,
      { strokeWidth: 3 },
    );
    drawComicText(
      ctx,
      rightLabel,
      rightX + rightW * 0.5,
      topBarY + 29,
      "900 9.5px 'Fredoka', 'Outfit', sans-serif",
      '#ffffff',
      { strokeWidth: 3 },
    );
  }

  render() {
    const ctx = this.ctx;
    const animT = Math.max(this.time || 0, this.roundElapsed);

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this._drawGdBackdrop(ctx, animT);

    // Floating sparks/embers inside corridor
    for (const e of this.embers) {
      const a = clamp(e.life / e.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = this.phase >= 4 ? '#fde047' : '#ef4444';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Flip shockwave rings
    for (const sw of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = clamp(sw.life / sw.maxLife, 0, 1);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    this._drawDungeonRails(ctx);

    for (const o of this.obstacles) {
      this._drawObstacle(ctx, o);
    }

    for (const c of this.collectibles) {
      this._drawCollectible(ctx, c, animT);
    }

    this._drawPlayer(ctx, animT);
    this._drawHudHeader(ctx);

    this.fx.render(ctx);
    ctx.restore();
  }

  serialize() {
    return {
      onTop: this.onTop,
      distance: this.distance,
      speed: this.speed,
      unlockedSectors: this.unlockedSectors,
      userCoins: this.userCoins,
    };
  }

  restoreLabel() {
    const sec = TRACK_SECTORS[clamp((this.unlockedSectors || 1) - 1, 0, TRACK_SECTORS.length - 1)];
    return `${Math.round(this.distance / 10)}m · Track ${this.unlockedSectors}/8 (${sec.name})`;
  }
}
