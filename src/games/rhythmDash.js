import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';
import {
  shadeColor,
  toyRim,
  toyLineW,
  drawToyShadow,
  drawToySphere,
  drawToyBevelRect,
  drawToyEyes,
  traceRoundRect,
} from '../engine/toyStyle.js';

const TAU = Math.PI * 2;
const LANES = [95, 225, 355];

export class RhythmDash extends Game {
  static meta = {
    id: 'rhythm-dash',
    title: 'Beat Hop',
    icon: '🎵',
    hint: 'TAP lanes for beats · dodge skulls!',
    baseLikes: 2650,
    isPrestige: false,
    parScore60s: 2800,
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
    this.fx = new FX();
    this.score = score;

    this.lane = saved?.lane ?? 1;
    this.beanX = LANES[this.lane];
    this.beanY = Game.SAFE_BOTTOM - 64;
    this.combo = saved?.combo ?? 0;
    this.baseBeatSpeed = this.diff.baseSpeed ?? 240;
    this.maxBeatSpeed = this.diff.maxSpeed ?? 410;
    this.speed = Math.max(this.baseBeatSpeed, saved?.speed ?? this.baseBeatSpeed);

    this.notes = [];
    this.spawnCd = 0.4;
    this.grace = saved ? 1.2 : 0.6;
  }

  setLane(idx) {
    if (idx < 0 || idx > 2) return;
    if (this.lane !== idx) {
      this.lane = idx;
      this.sounds.pop();
      this.haptics.light();
    }
  }

  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }
    this.fx.update(dt);

    // Input: tap left/center/right third or keys
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
      this.notes.push({
        lane,
        y: Game.SAFE_TOP + 12,
        isHazard,
        r: isHazard ? 17 : 15,
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
            this.fx.burst(this.beanX, this.beanY, '#ff2a5f', 16, 180, 0.45, 4);
            this.die('Hit a discordant skull! 💀');
            return;
          }
        } else {
          this.combo += 1;
          const pts = 60 + Math.min(140, this.combo * 8);
          this.score += pts;
          this.fx.burst(nx, this.beanY, '#3dffa2', 8, 120, 0.3, 3);
          this.fx.text(nx, this.beanY - 24, `+${pts}`, '#ffd166', 15, 0.5);
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

  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    // 1. Concert Stage Toy Diorama Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f0b29');
    bg.addColorStop(0.55, '#1f1448');
    bg.addColorStop(1, '#0c1229');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle beat-synced stage spotlight & background equalizer bars
    const beatPulse = 0.5 + 0.5 * Math.sin(this.time * 7.5);
    const spot = ctx.createRadialGradient(LANES[this.lane], this.beanY - 80, 18, LANES[this.lane], this.beanY, W * 0.65);
    spot.addColorStop(0, `rgba(37, 230, 255, ${0.12 + beatPulse * 0.06})`);
    spot.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);

    const eqBaseY = Game.SAFE_BOTTOM - 22;
    for (let b = 0; b < 14; b++) {
      const bx = 22 + b * 30;
      const bh = 18 + Math.abs(Math.sin(this.time * 5.2 + b * 0.7)) * 42;
      ctx.fillStyle = 'rgba(124, 92, 255, 0.14)';
      traceRoundRect(ctx, bx, eqBaseY - bh, 18, bh, 5);
      ctx.fill();
    }

    // 2. 3D Toy Stage Lane Tracks & Turntable Beat Pads
    const laneCols = ['#38bdf8', '#a855f7', '#fb7185'];
    const tickOff = (this.time * this.speed) % 72;

    for (let i = 0; i < 3; i++) {
      const lx = LANES[i];
      const active = i === this.lane;
      const laneCol = laneCols[i];

      ctx.save();
      traceRoundRect(ctx, lx - 28, Game.SAFE_TOP + 12, 56, Game.PLAY_HEIGHT - 24, 18);
      ctx.fillStyle = active ? 'rgba(37, 230, 255, 0.11)' : 'rgba(15, 23, 42, 0.36)';
      ctx.fill();
      ctx.strokeStyle = active ? laneCol : shadeColor(laneCol, -0.52);
      ctx.lineWidth = active ? 2.2 : 1.3;
      ctx.stroke();

      // Scrolling horizontal beat bars inside lane
      ctx.clip();
      ctx.strokeStyle = active ? 'rgba(255, 255, 255, 0.24)' : 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 2;
      for (let ty = Game.SAFE_TOP + tickOff; ty < this.beanY - 10; ty += 72) {
        ctx.beginPath();
        ctx.moveTo(lx - 20, ty);
        ctx.lineTo(lx + 20, ty);
        ctx.stroke();
      }
      ctx.restore();

      // Center guide rail
      ctx.strokeStyle = active ? laneCol : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = active ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(lx, Game.SAFE_TOP + 16);
      ctx.lineTo(lx, this.beanY - 26);
      ctx.stroke();

      // 3D Extruded Turntable Beat Pad
      const padY = this.beanY + 6;
      const padCol = active ? laneCol : '#334155';
      const padRim = toyRim(padCol, 0.58);

      drawToyShadow(ctx, lx, padY + 12, 31, 11, 0.32);

      // Lower puck cylinder wall
      ctx.fillStyle = shadeColor(padCol, -0.4);
      ctx.strokeStyle = padRim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(lx, padY + 5, 29, 13, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Top glossy puck surface
      const pg = ctx.createRadialGradient(lx - 8, padY - 5, 2, lx, padY, 30);
      pg.addColorStop(0, shadeColor(padCol, 0.45));
      pg.addColorStop(0.65, padCol);
      pg.addColorStop(1, shadeColor(padCol, -0.2));
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.ellipse(lx, padY, 29, 13, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Inner beat ring
      ctx.strokeStyle = active ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(lx, padY, 19, 8, 0, 0, TAU);
      ctx.stroke();
    }

    // 3. 3D Vinyl Music Note Gems & Discordant Skull Hazards
    for (const n of this.notes) {
      const nx = LANES[n.lane];
      const pulse = 1 + Math.sin(this.time * 8 + n.y * 0.05) * 0.06;
      const rad = n.r * pulse;

      if (n.isHazard) {
        ctx.fillStyle = 'rgba(255, 42, 95, 0.26)';
        ctx.beginPath();
        ctx.arc(nx, n.y, rad * 1.4, 0, TAU);
        ctx.fill();

        drawToySphere(ctx, nx, n.y, rad, '#ff2a5f', {
          rimColor: toyRim('#ff2a5f', 0.6),
          lineWidth: toyLineW(n.r * 2, 0.05, 1.0, 2.0),
          shine: 0.72,
        });

        drawToyEyes(ctx, nx, n.y - 2.5, rad * 0.22, {
          spacing: rad * 0.56,
          style: 'angry',
          lookX: 0,
          lookY: 0.2,
        });

        // Cute tiny skull teeth grin
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        traceRoundRect(ctx, nx - rad * 0.34, n.y + rad * 0.22, rad * 0.68, rad * 0.32, 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255, 209, 102, 0.24)';
        ctx.beginPath();
        ctx.arc(nx, n.y, rad * 1.38, 0, TAU);
        ctx.fill();

        drawToySphere(ctx, nx, n.y, rad, '#ffd166', {
          rimColor: toyRim('#ffd166', 0.56),
          lineWidth: toyLineW(n.r * 2, 0.05, 1.0, 2.0),
          shine: 0.88,
        });

        // Crisp vector eighth-note emblem
        ctx.save();
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.ellipse(nx - 2.5, n.y + 3.5, 4, 3, -0.35, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(nx + 0.8, n.y + 3);
        ctx.lineTo(nx + 0.8, n.y - 6.5);
        ctx.quadraticCurveTo(nx + 6.5, n.y - 5, nx + 5.5, n.y - 1);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 4. Player Jelly Bean + Grounding Shadow on Active Pad
    drawToyShadow(ctx, this.beanX, this.beanY + 14, 16, 6, 0.34);
    drawBean(ctx, this.beanX, this.beanY - 4, 22, {
      walkT: this.time * 1.4,
      eyes: this.dead ? 'squish' : 'happy',
      dead: this.dead,
    });

    // 5. Compact Toy Combo Streak Badge
    if (this.combo > 0) {
      const badgeW = 148;
      const bx = W / 2 - badgeW / 2;
      const by = Game.SAFE_TOP + 12;
      drawToyBevelRect(ctx, bx, by, badgeW, 25, 12, '#0f172a', {
        depth: 2,
        rimColor: '#ffd166',
        lineWidth: 1.7,
        gloss: false,
      });
      ctx.save();
      ctx.font = "700 11.5px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`🎵 ${this.combo}x BEAT STREAK`, W / 2, by + 13);
      ctx.restore();
    }

    this.fx.render(ctx);
  }

  serialize() {
    return { lane: this.lane, combo: this.combo, speed: this.speed };
  }

  restoreLabel() {
    return `${this.combo}x beat streak`;
  }
}

