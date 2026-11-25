import { Game } from '../../engine/Game.js';
import { FX } from '../../engine/fx.js';
import { drawBean } from '../../engine/bean.js';
import {
  toyRim,
  toyLineW,
  drawToyShadow,
  drawToySphere,
  drawToyBevelRect,
  traceRoundRect,
} from '../../engine/toyStyle.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export class LaserDodge extends Game {
  static meta = {
    id: 'laser-dodge',
    title: 'Laser Grid',
    icon: '⚡',
    hint: 'DRAG to dodge lasers · grab orbs!',
    baseLikes: 3120,
    isPrestige: false,
    parScore60s: 2600,
    roundLen: 60,
    cue: 'DODGE LASERS, GRAB ORBS!',
    prestigeCue: 'SHORTER LASER WARNINGS!',
    scaling: {
      warnScale:       { base: 1.0, rate: 0.18, floor: 0.54, mode: 'down', label: 'Warn Time' },
      laserCadence:    { base: 1.0, rate: 0.16, floor: 0.62, mode: 'down', label: 'Laser Rate' },
      multiLaserBonus: { base: 0.0, rate: 0.20, cap: 0.40,   mode: 'up',   deltaFormat: 'abs', unit: '%', label: 'Double Beams' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    this.player = {
      x: saved?.x ?? this.W / 2,
      y: saved?.y ?? (Game.SAFE_TOP + Game.PLAY_HEIGHT * 0.55),
      r: 17,
      speed: 255,
      walkT: 0,
      dir: 1,
    };

    this.lasers = [];
    this.orbs = [];
    this.laserCd = 0.7;
    this.orbCd = 0.4;
    this.level = saved?.level ?? 1;
    this.streak = saved?.streak ?? 0;

    for (let i = 0; i < 3; i++) this.spawnOrb();
    this.grace = saved ? 1.4 : 0.7;
  }

  spawnOrb() {
    this.orbs.push({
      x: 44 + Math.random() * (this.W - 88),
      y: Game.SAFE_TOP + 36 + Math.random() * (Game.PLAY_HEIGHT - 72),
      r: 11,
      gold: Math.random() < 0.22,
      pulse: Math.random() * TAU,
    });
  }

  spawnLaser() {
    const horiz = Math.random() < 0.52;
    const pos = horiz
      ? Game.SAFE_TOP + 36 + Math.random() * (Game.PLAY_HEIGHT - 72)
      : 38 + Math.random() * (this.W - 76);
    this.lasers.push({
      horiz,
      pos,
      warn: Math.max(0.45, (1.1 - this.level * 0.04) * (this.diff.warnScale ?? 1)),
      active: 0.38,
      width: 14,
      hitDone: false,
    });
  }

  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }
    this.fx.update(dt);

    const stick = this.input.vec(48);
    this.player.x = clamp(this.player.x + stick.x * this.player.speed * dt, 26, this.W - 26);
    this.player.y = clamp(
      this.player.y + stick.y * this.player.speed * dt,
      Game.SAFE_TOP + 26,
      Game.SAFE_BOTTOM - 26
    );
    if (Math.hypot(stick.x, stick.y) > 0.1) {
      this.player.walkT += dt * 1.4;
      if (Math.abs(stick.x) > 0.1) this.player.dir = stick.x > 0 ? 1 : -1;
    }

    // Orbs
    this.orbCd -= dt;
    if (this.orbCd <= 0 && this.orbs.length < 5) {
      this.spawnOrb();
      this.orbCd = 1.25;
    }

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.pulse += dt * 4;
      if (Math.hypot(this.player.x - o.x, this.player.y - o.y) <= this.player.r + o.r) {
        this.streak += 1;
        const pts = (o.gold ? 180 : 90) + Math.min(120, this.streak * 10);
        this.score += pts;
        this.fx.burst(o.x, o.y, o.gold ? '#ffd166' : '#25e6ff', 10, 140, 0.35, 3);
        this.fx.text(o.x, o.y - 16, `+${pts}`, o.gold ? '#ffd166' : '#3dffa2', 16, 0.6);
        this.sounds.bubble(o.gold ? 1.35 : 1.0);
        this.haptics.light();
        this.orbs.splice(i, 1);
      }
    }

    // Lasers
    this.laserCd -= dt;
    if (this.laserCd <= 0) {
      this.spawnLaser();
      const dblChance = (this.level >= 3 ? 0.35 : 0) + (this.diff.multiLaserBonus || 0);
      if (dblChance > 0 && Math.random() < Math.min(0.65, dblChance)) this.spawnLaser();
      this.laserCd = Math.max(0.32, (1.05 - this.level * 0.05) * (this.diff.laserCadence ?? 1));
      this.level = Math.min(12, 1 + Math.floor((this.score || 0) / 1400));
    }

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      if (l.warn > 0) {
        l.warn -= dt;
        if (l.warn <= 0) {
          this.sounds.slice();
        }
      } else {
        l.active -= dt;
        const dist = l.horiz ? Math.abs(this.player.y - l.pos) : Math.abs(this.player.x - l.pos);
        if (dist <= this.player.r * 0.72 + l.width * 0.45 && this.grace <= 0) {
          this.fx.burst(this.player.x, this.player.y, '#ff2a5f', 18, 200, 0.5, 4);
          this.die('Zapped by plasma grid! ⚡');
          return;
        }
        if (l.active <= 0) {
          this.score += 35;
          this.lasers.splice(i, 1);
        }
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    // 1. Studio-Lit Toy Cyber Arena Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0f28');
    bg.addColorStop(0.5, '#15133a');
    bg.addColorStop(1, '#090e22');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const spot = ctx.createRadialGradient(W * 0.5, Game.SAFE_TOP + Game.PLAY_HEIGHT * 0.5, 24, W * 0.5, Game.SAFE_TOP + Game.PLAY_HEIGHT * 0.5, W * 0.78);
    spot.addColorStop(0, 'rgba(56, 189, 248, 0.11)');
    spot.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);

    // 2. Tactile Toy Tile Floor & Rounded Arena Rail
    const fX = 14;
    const fY = Game.SAFE_TOP + 10;
    const fW = W - 28;
    const fH = Game.PLAY_HEIGHT - 20;

    ctx.save();
    traceRoundRect(ctx, fX, fY, fW, fH, 16);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(124, 92, 255, 0.34)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.clip();
    const tileStep = 40;
    for (let x = fX + 10; x < fX + fW - 10; x += tileStep) {
      for (let y = fY + 10; y < fY + fH - 10; y += tileStep) {
        traceRoundRect(ctx, x, y, tileStep - 6, tileStep - 6, 7);
        ctx.fillStyle = 'rgba(124, 92, 255, 0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();

    // 3. Laser Emitters, Warning Guides & Active Volumetric Plasma Beams
    for (const l of this.lasers) {
      const x1 = l.horiz ? fX : l.pos;
      const y1 = l.horiz ? l.pos : fY;
      const x2 = l.horiz ? fX + fW : l.pos;
      const y2 = l.horiz ? l.pos : fY + fH;

      if (l.warn > 0) {
        const critical = l.warn < 0.3;
        ctx.save();
        // Translucent warning ribbon
        ctx.strokeStyle = critical ? 'rgba(255, 42, 95, 0.18)' : 'rgba(255, 209, 102, 0.10)';
        ctx.lineWidth = l.width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = -this.time * 48;
        ctx.strokeStyle = critical ? 'rgba(255, 42, 95, 0.92)' : 'rgba(255, 209, 102, 0.72)';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();

        const podCol = critical ? '#ff2a5f' : '#ffd166';
        drawToySphere(ctx, x1, y1, 5.5, podCol, { rimColor: toyRim(podCol, 0.55), lineWidth: 1.1 });
        drawToySphere(ctx, x2, y2, 5.5, podCol, { rimColor: toyRim(podCol, 0.55), lineWidth: 1.1 });
      } else {
        ctx.save();
        ctx.lineCap = 'round';
        // Outer translucent plasma halo
        ctx.strokeStyle = 'rgba(255, 42, 95, 0.34)';
        ctx.lineWidth = l.width * 1.9;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Main laser beam
        ctx.strokeStyle = '#ff2a5f';
        ctx.lineWidth = l.width;
        ctx.stroke();

        // Specular core
        ctx.strokeStyle = '#fff1f2';
        ctx.lineWidth = Math.max(3.5, l.width * 0.34);
        ctx.stroke();
        ctx.restore();

        drawToySphere(ctx, x1, y1, 7, '#ff2a5f', { rimColor: '#881337', lineWidth: 1.3 });
        drawToySphere(ctx, x2, y2, 7, '#ff2a5f', { rimColor: '#881337', lineWidth: 1.3 });
      }
    }

    // 4. Glossy 3D Vinyl Collectible Energy Orbs
    for (const o of this.orbs) {
      const s = 1 + Math.sin(o.pulse) * 0.12;
      const bob = Math.sin(o.pulse * 1.15) * 2.2;
      const orbCol = o.gold ? '#ffd166' : '#25e6ff';
      const rad = o.r * s;

      drawToyShadow(ctx, o.x, o.y + o.r * 1.25, o.r * 0.85, o.r * 0.32, 0.28);

      ctx.fillStyle = o.gold ? 'rgba(255, 209, 102, 0.24)' : 'rgba(37, 230, 255, 0.22)';
      ctx.beginPath();
      ctx.arc(o.x, o.y + bob, rad * 1.45, 0, TAU);
      ctx.fill();

      drawToySphere(ctx, o.x, o.y + bob, rad, orbCol, {
        rimColor: toyRim(orbCol, 0.56),
        lineWidth: toyLineW(o.r * 2, 0.05, 0.95, 1.9),
        shine: 0.88,
      });

      if (o.gold) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(o.x + rad * 0.25, o.y + bob - rad * 0.25, 2.1, 0, TAU);
        ctx.fill();
      }
    }

    // 5. Player Jelly Bean + Grounding Shadow
    if (this.grace <= 0 || Math.floor(this.time * 12) % 2 === 0) {
      drawToyShadow(ctx, this.player.x, this.player.y + 19, 15, 5.5, 0.32);
      drawBean(ctx, this.player.x, this.player.y, 20, {
        dir: this.player.dir,
        walkT: this.player.walkT,
        eyes: this.dead ? 'squish' : 'bright',
        dead: this.dead,
      });
    }

    // 6. Compact Toy HUD Badge (Grid Level & Orb Streak)
    const hudText = this.streak > 1 ? `LV.${this.level} · 🔥 ${this.streak}x` : `GRID LV.${this.level}`;
    const pillW = this.streak > 1 ? 132 : 96;
    drawToyBevelRect(ctx, 22, Game.SAFE_TOP + 16, pillW, 24, 11, '#0f172a', {
      depth: 2,
      rimColor: '#38bdf8',
      lineWidth: 1.6,
      gloss: false,
    });
    ctx.save();
    ctx.font = "700 11px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.streak > 1 ? '#fde047' : '#e2e8f0';
    ctx.fillText(hudText, 22 + pillW / 2, Game.SAFE_TOP + 28.5);
    ctx.restore();

    this.fx.render(ctx);
  }

  serialize() {
    return { x: this.player.x, y: this.player.y, level: this.level, streak: this.streak };
  }

  restoreLabel() {
    return `grid lv.${this.level}`;
  }
}

