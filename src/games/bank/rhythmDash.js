// WIP Bank Reel: Beat Hop (Weebl's Stuff HD Flash Cel-Cartoon Concert Rhythm Edition)
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
const LANES = [95, 225, 355];
const LANE_COLORS = ['#22d3ee', '#c084fc', '#fb7185'];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

let _stageBgImg = null;
function getStageBgImage() {
  if (_stageBgImg) return _stageBgImg;
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.decoding = 'async';
  img.src = '/assets/weebl/concert_stage_bg.jpg';
  _stageBgImg = img;
  return img;
}

const BEAT_SPRITES = {
  gold:  { src: '/assets/weebl/beat_gold.png',  aspect: 148 / 148 },
  cyan:  { src: '/assets/weebl/beat_cyan.png',  aspect: 148 / 143 },
  skull: { src: '/assets/weebl/beat_skull.png', aspect: 146 / 148 },
};
const _beatImgs = {};
function preloadBeatSprites() {
  if (typeof Image === 'undefined') return;
  for (const [k, cfg] of Object.entries(BEAT_SPRITES)) {
    if (!_beatImgs[k]) {
      const img = new Image();
      img.decoding = 'async';
      img.src = cfg.src;
      _beatImgs[k] = img;
    }
  }
}

export class RhythmDash extends Game {
  static meta = {
    id: 'rhythm-dash',
    title: 'Beat Hop',
    icon: '🎵',
    hint: 'TAP lanes for gold/cyan beats · dodge wicked skulls!',
    baseLikes: 2650,
    isPrestige: false,
    parScore60s: 3600,
    roundLen: 60,
    cue: 'TAP ON THE BEAT!',
    prestigeCue: 'HIGHER BPM · MORE SKULLS!',
    scaling: {
      baseSpeed:   { base: 240,  rate: 0.16, cap: 330,   mode: 'up',   round: true, label: 'Beat Speed' },
      maxSpeed:    { base: 410,  rate: 0.16, cap: 520,   mode: 'up',   round: true, label: 'Peak BPM' },
      spawnScale:  { base: 1.0,  rate: 0.15, floor: 0.68, mode: 'down', label: 'Note Pace' },
      hazardRatio: { base: 0.28, rate: 0.16, cap: 0.42,  mode: 'up',   label: 'Skull Beats' },
    },
  };

  init(saved, score = 0) {
    preloadWeeblAtlas();
    getStageBgImage();
    preloadBeatSprites();
    this.fx = new FX();
    this.score = score;

    this.lane = saved?.lane ?? 1;
    this.beanX = LANES[this.lane];
    this.beanY = Game.SAFE_BOTTOM - 64;
    this.combo = saved?.combo ?? 0;
    this.hits = saved?.hits ?? 0;
    this.baseBeatSpeed = this.diff.baseSpeed ?? 240;
    this.maxBeatSpeed = this.diff.maxSpeed ?? 410;
    this.speed = Math.max(this.baseBeatSpeed, saved?.speed ?? this.baseBeatSpeed);

    this.notes = [];
    this.padFlashes = [0, 0, 0];
    this.hopAnim = 0;
    this.hopDir = 1;
    this.shake = 0;
    this.spawnCd = 0.4;
    this.grace = saved ? 1.2 : 0.6;
  }

  setLane(idx) {
    if (idx < 0 || idx > 2) return;
    if (this.lane !== idx) {
      this.hopDir = idx > this.lane ? 1 : -1;
      this.lane = idx;
      this.hopAnim = 1;
      this.padFlashes[idx] = Math.max(this.padFlashes[idx], 0.5);
      this.sounds.pop();
      this.haptics.light();
    }
  }

  updateDying(dt) {
    this.fx.update(dt);
    this.shake = Math.max(0, this.shake - dt * 26);
    for (let i = 0; i < 3; i++) this.padFlashes[i] = Math.max(0, this.padFlashes[i] - dt * 3.5);
  }

  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }
    this.fx.update(dt);
    this.hopAnim = Math.max(0, this.hopAnim - dt * 5.2);
    this.shake = Math.max(0, this.shake - dt * 28);
    for (let i = 0; i < 3; i++) {
      this.padFlashes[i] = Math.max(0, this.padFlashes[i] - dt * 3.5);
    }

    // Input: tap left/center/right third or keys (A/S/D, Arrows, 1/2/3)
    if (this.input.pressed) {
      const tx = this.input.x;
      if (tx < this.W / 3) this.setLane(0);
      else if (tx < (this.W * 2) / 3) this.setLane(1);
      else this.setLane(2);
    }
    if (this.input.key('a', 'arrowleft', '1')) this.setLane(0);
    if (this.input.key('s', 'arrowdown', '2')) this.setLane(1);
    if (this.input.key('d', 'arrowright', '3')) this.setLane(2);

    this.beanX += (LANES[this.lane] - this.beanX) * Math.min(1, dt * 18);
    this.speed = Math.min(this.maxBeatSpeed, this.baseBeatSpeed + this.time * 2.5);

    this.spawnCd -= dt;
    if (this.spawnCd <= 0) {
      const lane = Math.floor(Math.random() * 3);
      const isHazard = Math.random() < (this.diff.hazardRatio ?? 0.28);
      const isStar = !isHazard && Math.random() < (this.combo >= 4 ? 0.28 : 0.16);
      this.notes.push({
        lane,
        y: Game.SAFE_TOP + 12,
        isHazard,
        isStar,
        r: isHazard ? 18 : (isStar ? 18 : 16),
      });
      this.spawnCd = Math.max(0.26, (0.64 - this.time * 0.004) * (this.diff.spawnScale ?? 1));
    }

    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      n.y += this.speed * dt;
      const nx = LANES[n.lane];

      if (Math.abs(n.y - this.beanY) < 26 && Math.abs(nx - this.beanX) < 34) {
        if (n.isHazard) {
          if (this.grace <= 0) {
            this.fx.burst(this.beanX, this.beanY, '#ef4444', 20, 200, 0.5, 4.5);
            this.shake = 10;
            this.die('Hit a discordant skull! 💀');
            return;
          }
        } else {
          this.combo += n.isStar ? 2 : 1;
          this.hits += 1;
          const feverMult = this.combo >= 8 ? 1.5 : 1;
          const basePts = 60 + Math.min(140, this.combo * 8);
          const pts = Math.round(basePts * (n.isStar ? 1.8 : 1) * feverMult);
          this.score += pts;
          this.padFlashes[n.lane] = 1;
          this.fx.ring(nx, this.beanY + 4, n.isStar ? '#22d3ee' : '#facc15', 36, 0.28, 3);
          this.fx.burst(nx, this.beanY, n.isStar ? '#22d3ee' : '#4ade80', n.isStar ? 13 : 9, 145, 0.34, 3.2);
          this.fx.text(nx, this.beanY - 26, n.isStar ? `★ +${pts}` : `+${pts}`, n.isStar ? '#67e8f9' : '#fde047', 16, 0.55);
          this.sounds.stack(this.combo);
          this.haptics.light();
        }
        this.notes.splice(i, 1);
      } else if (n.y > Game.SAFE_BOTTOM + 20) {
        if (!n.isHazard) this.combo = 0;
        this.notes.splice(i, 1);
      }
    }
  }

  _drawStageBackdrop(ctx, animT) {
    const { W, H } = this;
    const bgImg = getStageBgImage();
    const beatPulse = 0.5 + 0.5 * Math.sin(animT * 8.2);
    const fever = this.combo >= 8;

    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, 0, 0, W, H);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0f0b29');
      bg.addColorStop(0.55, '#1f1448');
      bg.addColorStop(1, '#0c1229');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    // Sweeping spotlight cone following player's active DJ lane
    const activeCol = fever ? '#facc15' : LANE_COLORS[this.lane];
    const spot = ctx.createRadialGradient(
      LANES[this.lane],
      this.beanY - 60,
      20,
      LANES[this.lane],
      this.beanY,
      W * 0.62,
    );
    spot.addColorStop(0, fever ? `rgba(250, 204, 21, ${(0.16 + beatPulse * 0.08).toFixed(2)})` : `rgba(56, 189, 248, ${(0.14 + beatPulse * 0.07).toFixed(2)})`);
    spot.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, Game.SAFE_TOP, W, Game.PLAY_HEIGHT);

    // Live animated neon equalizer glow bars behind the turntables
    const eqBaseY = Game.SAFE_BOTTOM - 22;
    for (let b = 0; b < 11; b++) {
      const bx = 56 + b * 32;
      const bh = 16 + Math.abs(Math.sin(animT * 6.5 + b * 0.75)) * (fever ? 48 : 34);
      ctx.fillStyle = fever ? 'rgba(250, 204, 21, 0.22)' : 'rgba(192, 132, 252, 0.22)';
      ctx.strokeStyle = activeCol;
      ctx.lineWidth = 1;
      traceRoundRect(ctx, bx, eqBaseY - bh, 18, bh, 4);
      ctx.fill();
    }
  }

  _drawLanesAndTurntables(ctx, animT) {
    const tickOff = (animT * this.speed) % 72;
    const fever = this.combo >= 8;

    for (let i = 0; i < 3; i++) {
      const lx = LANES[i];
      const active = i === this.lane;
      const laneCol = LANE_COLORS[i];
      const flash = this.padFlashes[i];

      // 1. Chunky #000-inked Neon Highway Track
      ctx.save();
      traceRoundRect(ctx, lx - 31, Game.SAFE_TOP + 12, 62, Game.PLAY_HEIGHT - 24, 18);
      ctx.fillStyle = active ? 'rgba(15, 23, 42, 0.72)' : 'rgba(9, 13, 30, 0.56)';
      ctx.fill();

      // Thick cel black outer highway frame + colored inner rim
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.strokeStyle = active ? laneCol : 'rgba(148, 163, 184, 0.42)';
      ctx.lineWidth = active ? 2.6 : 1.6;
      ctx.stroke();

      // Scrolling tempo beat bars inside highway
      ctx.clip();
      ctx.strokeStyle = active ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2.2;
      for (let ty = Game.SAFE_TOP + tickOff; ty < this.beanY - 12; ty += 72) {
        ctx.beginPath();
        ctx.moveTo(lx - 22, ty);
        ctx.lineTo(lx + 22, ty);
        ctx.stroke();
      }
      ctx.restore();

      // Center guide rail string
      ctx.strokeStyle = active ? laneCol : 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = active ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(lx, Game.SAFE_TOP + 18);
      ctx.lineTo(lx, this.beanY - 26);
      ctx.stroke();

      // 2. Chunky #000-Outlined DJ Turntable Deck
      const padY = this.beanY + 7;
      drawToyShadow(ctx, lx, padY + 13, 34, 12, 0.42);

      // Lower deck thickness
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(lx, padY + 6, 32, 14, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Top platter rim colored by lane / catch flash
      const deckGrad = ctx.createRadialGradient(lx - 8, padY - 4, 2, lx, padY, 32);
      deckGrad.addColorStop(0, flash > 0.2 ? '#fef08a' : (active ? '#f8fafc' : '#64748b'));
      deckGrad.addColorStop(0.55, active || flash > 0.2 ? laneCol : '#334155');
      deckGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = deckGrad;
      ctx.beginPath();
      ctx.ellipse(lx, padY, 32, 14, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Spinning inner vinyl record groove disc
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = active ? '#ffffff' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(lx, padY, 21, 8.8, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Rotating vinyl gleam spoke so turntable looks spinning live!
      const spinA = animT * (active ? 6 : 2.5) + i * 2;
      ctx.strokeStyle = active ? (fever ? '#fde047' : laneCol) : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx + Math.cos(spinA) * 6, padY + Math.sin(spinA) * 2.5);
      ctx.lineTo(lx + Math.cos(spinA) * 18, padY + Math.sin(spinA) * 7.2);
      ctx.stroke();

      if (flash > 0.15) {
        drawComicStarburst(ctx, lx, padY, 32 + flash * 10, 22, 8, 'rgba(250, 204, 21, 0.35)', laneCol, animT * 4, 2);
      }
    }
  }

  _drawNotes(ctx, animT) {
    for (const n of this.notes) {
      const nx = LANES[n.lane];
      const pulse = 1 + Math.sin(animT * 9 + n.y * 0.04) * 0.07;
      const key = n.isHazard ? 'skull' : n.isStar ? 'cyan' : 'gold';
      const img = _beatImgs[key];
      const spec = BEAT_SPRITES[key];

      ctx.save();
      ctx.translate(nx, n.y);
      if (n.isHazard) {
        // Sinister subtle rock/shake on discordant skulls + crimson warning halo
        ctx.rotate(Math.sin(animT * 14 + n.y * 0.05) * 0.1);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, n.r * 1.45, 0, TAU);
        ctx.fill();
      } else {
        ctx.scale(pulse, pulse);
        ctx.fillStyle = n.isStar ? 'rgba(34, 211, 238, 0.26)' : 'rgba(250, 204, 21, 0.24)';
        ctx.beginPath();
        ctx.arc(0, 0, n.r * 1.4, 0, TAU);
        ctx.fill();
      }

      if (img && img.complete && img.naturalWidth > 0) {
        const sizeH = (n.isHazard ? 44 : (n.isStar ? 44 : 40));
        const sizeW = sizeH * spec.aspect;
        ctx.drawImage(img, -sizeW * 0.5, -sizeH * 0.5, sizeW, sizeH);
      } else {
        // Vector fallback when headless or before PNG decode
        ctx.fillStyle = n.isHazard ? '#ef4444' : n.isStar ? '#22d3ee' : '#facc15';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, n.r, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawPlayer(ctx, animT) {
    const hopLift = Math.sin(this.hopAnim * Math.PI) * 14;
    const py = this.beanY + 4 - hopLift;
    const heroScale = 1 - hopLift * 0.015;

    // Grounding shadow stays pinned on the turntable surface
    drawToyShadow(ctx, this.beanX, this.beanY + 8, 20 * heroScale, 6.5 * heroScale, 0.38);

    // Check if a skull is close overhead in active lane for expressive panic reaction
    const skullClose = this.notes.some(
      (n) => n.isHazard && n.lane === this.lane && n.y > this.beanY - 155 && n.y < this.beanY + 25,
    );
    const lean = clamp((LANES[this.lane] - this.beanX) * 0.008, -0.28, 0.28);
    const expr = this.dead ? 'dizzy' : skullClose ? 'panic' : this.hopAnim > 0.2 ? 'focus' : 'happy';
    const state = this.dead ? 'dead' : this.hopAnim > 0.15 ? 'hop_leap' : 'stand_alert';

    drawHeroCharacter(ctx, this.beanX, py, 54, {
      view: 'threeQuarterFront',
      dir: Math.abs(lean) > 0.04 ? (lean > 0 ? 1 : -1) : this.hopDir,
      state,
      expr,
      t: animT * 4.8,
      lean,
      lookX: clamp(lean * 2.5, -0.75, 0.75),
      squashX: 1 - this.hopAnim * 0.1,
      squashY: 1 + this.hopAnim * 0.12,
    });
  }

  _drawHud(ctx) {
    const { W } = this;
    const pillY = Game.SAFE_TOP + 8;
    const fever = this.combo >= 8;

    // Left Combo Streak Panel
    const leftText = this.combo > 0
      ? (fever ? `🔥 ${this.combo}x FEVER!` : `🎵 ${this.combo}x STREAK`)
      : '🎵 BEAT HOP';
    drawComicPanel(ctx, 14, pillY, 168, 30, 12, fever ? '#b45309' : '#0f172a', {
      borderColor: '#000000',
      borderWidth: 2.8,
      shadowOffset: 3,
      shadowColor: 'rgba(0,0,0,0.45)',
    });
    drawComicText(
      ctx,
      leftText,
      98,
      pillY + 16,
      "900 11.5px 'Fredoka', 'Outfit', sans-serif",
      this.combo > 0 ? '#fde047' : '#ffffff',
      { strokeWidth: 3.5 },
    );

    // Right Speed & Beats Counter Pill
    const rightW = 144;
    const rightX = W - rightW - 14;
    drawComicPanel(ctx, rightX, pillY, rightW, 30, 12, '#1e1b4b', {
      borderColor: '#000000',
      borderWidth: 2.8,
      shadowOffset: 3,
      shadowColor: 'rgba(0,0,0,0.45)',
    });
    drawComicText(
      ctx,
      `🎧 ${this.hits} · ⚡${Math.round(this.speed)}`,
      rightX + rightW * 0.5,
      pillY + 16,
      "900 11px 'Fredoka', 'Outfit', sans-serif",
      '#bae6fd',
      { strokeWidth: 3.2 },
    );
  }

  render() {
    const ctx = this.ctx;
    const animT = this.time || 0;

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this._drawStageBackdrop(ctx, animT);
    this._drawLanesAndTurntables(ctx, animT);
    this._drawNotes(ctx, animT);
    this._drawPlayer(ctx, animT);
    this._drawHud(ctx);

    this.fx.render(ctx);
    ctx.restore();
  }

  serialize() {
    return { lane: this.lane, combo: this.combo, hits: this.hits, speed: this.speed };
  }

  restoreLabel() {
    return `${this.combo}x beat streak`;
  }
}
