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
  drawToyPill,
  drawToyEyes,
} from '../engine/toyStyle.js';

const TAU = Math.PI * 2;

export class MeteorSmasher extends Game {
  static meta = {
    id: 'meteor-smasher',
    title: 'Meteor Tap',
    icon: '☄️',
    hint: 'TAP meteors before they hit!',
    baseLikes: 2710,
    isPrestige: true,
    parScore60s: 2200,
    roundLen: 60,
    cue: 'TAP METEORS FAST!',
    prestigeCue: 'FASTER METEORS · TANKY BOSS!',
    scaling: {
      targetGoal:    { base: 24,  rate: 0.18, cap: 42,   mode: 'up',   round: true, label: 'Meteors Goal' },
      bossHp:        { base: 8,   rate: 0.20, cap: 16,   mode: 'up',   round: true, label: 'Boss HP' },
      fallSpeedMult: { base: 1.0, rate: 0.16, cap: 1.55, mode: 'up',   label: 'Fall Speed' },
      spawnScale:    { base: 1.0, rate: 0.15, floor: 0.68, mode: 'down', label: 'Spawn Pace' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    this.shieldY = Game.SAFE_BOTTOM - 54;
    this.shieldHp = saved?.shieldHp ?? 3;
    this.destroyed = saved?.destroyed ?? 0;
    this.targetGoal = this.diff.targetGoal ?? 24;
    this.bossSpawned = saved?.bossSpawned ?? false;

    this.meteors = [];
    this.spawnCd = 0.45;
    this.grace = saved ? 1.2 : 0.6;
  }

  spawnMeteor(isBoss = false) {
    const r = isBoss ? 44 : (20 + Math.random() * 14);
    const hp = isBoss ? (this.diff.bossHp ?? 8) : (r > 29 ? 2 : 1);
    const spdMult = this.diff.fallSpeedMult ?? 1;
    this.meteors.push({
      x: 46 + Math.random() * (this.W - 92),
      y: Game.SAFE_TOP - r,
      r,
      hp,
      maxHp: hp,
      vy: (isBoss ? 58 : (115 + Math.random() * 75)) * spdMult,
      vx: (Math.random() - 0.5) * 42,
      isBoss,
      rot: Math.random() * TAU,
    });
  }

  update(dt) {
    if (this.dead || this.won) {
      this.updateDying(dt);
      return;
    }
    this.fx.update(dt);

    // Tap to blast meteors
    if (this.input.pressed) {
      const tx = this.input.x;
      const ty = this.input.y;
      let hitAny = false;

      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        if (Math.hypot(tx - m.x, ty - m.y) <= m.r + 22) {
          hitAny = true;
          m.hp -= 1;
          this.fx.ring(m.x, m.y, '#25e6ff', m.r + 24, 0.25, 3);
          this.sounds.hit();
          this.haptics.light();

          if (m.hp <= 0) {
            this.destroyed += 1;
            const pts = m.isBoss ? 850 : m.maxHp * 95;
            this.score += pts;
            this.fx.burst(m.x, m.y, m.isBoss ? '#ffd166' : '#ff9f1c', 14, 180, 0.45, 4);
            this.fx.text(m.x, m.y, `+${pts}`, '#ffd166', 18, 0.65);
            this.sounds.up();
            this.haptics.medium();

            const wasBoss = m.isBoss;
            this.meteors.splice(i, 1);

            if (wasBoss) {
              this.complete('Mega Meteor Shattered! 👑');
              return;
            }
          }
          break;
        }
      }

      if (!hitAny) {
        this.fx.ring(tx, ty, 'rgba(255,255,255,0.35)', 24, 0.2, 2);
      }
    }

    // Spawn logic
    this.spawnCd -= dt;
    if (this.spawnCd <= 0) {
      if (!this.bossSpawned && this.destroyed >= this.targetGoal) {
        this.bossSpawned = true;
        this.spawnMeteor(true);
      } else if (!this.bossSpawned) {
        this.spawnMeteor(false);
      }
      this.spawnCd = Math.max(0.28, (0.92 - this.destroyed * 0.015) * (this.diff.spawnScale ?? 1));
    }

    // Update meteors
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.rot += dt * 1.8;

      if (m.x - m.r < 18) { m.x = 18 + m.r; m.vx = Math.abs(m.vx); }
      if (m.x + m.r > this.W - 18) { m.x = this.W - 18 - m.r; m.vx = -Math.abs(m.vx); }

      if (m.y + m.r >= this.shieldY) {
        this.meteors.splice(i, 1);
        if (this.grace <= 0) {
          this.shieldHp -= m.isBoss ? 3 : 1;
          this.fx.burst(m.x, this.shieldY, '#ff2a5f', 16, 170, 0.45, 4);
          this.sounds.fail();
          this.haptics.fail();
          if (this.shieldHp <= 0) {
            this.die('Planetary shield breached! ☄️');
            return;
          }
        }
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    // 1. Studio-Lit Space Toybox Diorama Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#070a22');
    bg.addColorStop(0.6, '#1a1442');
    bg.addColorStop(1, '#111638');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Soft deterministic twinkling stars
    for (let i = 0; i < 24; i++) {
      const sx = ((i * 89 + 31) % (W - 24)) + 12;
      const sy = Game.SAFE_TOP + ((i * 137 + 19) % Math.max(120, this.shieldY - Game.SAFE_TOP - 40));
      const tw = 0.35 + 0.5 * Math.abs(Math.sin(this.time * 2.2 + i));
      ctx.fillStyle = `rgba(226, 232, 240, ${tw})`;
      ctx.beginPath();
      ctx.arc(sx, sy, (i % 3 === 0 ? 1.8 : 1.1), 0, TAU);
      ctx.fill();
    }

    // 2. Curved Miniature Planet Surface Below Shield
    const planetR = W * 0.92;
    const planetCy = this.shieldY + 24 + planetR;
    const pg = ctx.createRadialGradient(W * 0.42, this.shieldY + 30, 12, W * 0.5, planetCy, planetR);
    pg.addColorStop(0, '#4f46e5');
    pg.addColorStop(0.28, '#312e81');
    pg.addColorStop(1, '#0f172a');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(W / 2, planetCy, planetR, Math.PI * 1.15, Math.PI * 1.85);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(129, 140, 248, 0.55)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(W / 2, planetCy, planetR, Math.PI * 1.24, Math.PI * 1.76);
    ctx.stroke();

    // 3. Volumetric Planetary Energy Shield Dome + Emitter Pylons
    const shieldCol = this.shieldHp >= 2 ? '#25e6ff' : '#ff4b5c';
    ctx.save();
    ctx.fillStyle = this.shieldHp >= 2 ? 'rgba(37, 230, 255, 0.08)' : 'rgba(255, 75, 92, 0.12)';
    ctx.beginPath();
    ctx.moveTo(20, this.shieldY);
    ctx.quadraticCurveTo(W / 2, this.shieldY - 28, W - 20, this.shieldY);
    ctx.lineTo(W - 20, H);
    ctx.lineTo(20, H);
    ctx.closePath();
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.strokeStyle = this.shieldHp >= 2 ? 'rgba(37, 230, 255, 0.28)' : 'rgba(255, 75, 92, 0.34)';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(20, this.shieldY);
    ctx.quadraticCurveTo(W / 2, this.shieldY - 28, W - 20, this.shieldY);
    ctx.stroke();

    ctx.strokeStyle = shieldCol;
    ctx.lineWidth = 4.2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    drawToyBevelRect(ctx, 12, this.shieldY - 2, 16, 16, 5, '#334155', {
      depth: 2,
      rimColor: '#0f172a',
      lineWidth: 1.2,
    });
    drawToyBevelRect(ctx, W - 28, this.shieldY - 2, 16, 16, 5, '#334155', {
      depth: 2,
      rimColor: '#0f172a',
      lineWidth: 1.2,
    });
    drawToySphere(ctx, 20, this.shieldY, 5.5, shieldCol, { rimColor: toyRim(shieldCol, 0.55), lineWidth: 1.1 });
    drawToySphere(ctx, W - 20, this.shieldY, 5.5, shieldCol, { rimColor: toyRim(shieldCol, 0.55), lineWidth: 1.1 });

    // 4. Toy Bevel HUD Card (Shield Pips + Meteor Goal)
    drawToyBevelRect(ctx, 16, Game.SAFE_TOP + 10, 198, 32, 13, '#0f172a', {
      depth: 2.5,
      rimColor: shieldCol,
      lineWidth: 2,
      gloss: false,
    });

    ctx.save();
    ctx.font = "700 11px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('SHIELD', 28, Game.SAFE_TOP + 26.5);

    for (let sIdx = 0; sIdx < 3; sIdx++) {
      const pipX = 82 + sIdx * 16;
      const active = sIdx < this.shieldHp;
      drawToySphere(ctx, pipX, Game.SAFE_TOP + 26, 5.5, active ? '#25e6ff' : '#334155', {
        rimColor: active ? '#0369a1' : '#1e293b',
        lineWidth: 1.1,
        shine: active ? 0.85 : 0.2,
      });
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde047';
    ctx.font = "700 12px 'Fredoka', 'Outfit', sans-serif";
    ctx.fillText(`${this.destroyed}/${this.targetGoal}`, 202, Game.SAFE_TOP + 26.5);
    ctx.restore();

    if (this.bossSpawned) {
      drawToyPill(ctx, W - 96, Game.SAFE_TOP + 13, 80, 25, '#ff2a5f', {
        rimColor: '#881337',
        lineWidth: 1.6,
      });
      ctx.save();
      ctx.font = "700 11.5px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = '#0f172a';
      ctx.strokeText('☄️ BOSS!', W - 56, Game.SAFE_TOP + 26);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('☄️ BOSS!', W - 56, Game.SAFE_TOP + 26);
      ctx.restore();
    }

    // 5. 3D Vinyl Toy Meteors & Boss Asteroid
    for (const m of this.meteors) {
      const baseCol = m.isBoss ? '#ff2a5f' : (m.hp > 1 ? '#ff9f1c' : '#c27849');
      const rim = toyRim(baseCol, 0.58);
      const lw = toyLineW(m.r * 2, 0.045, 1.0, 2.3);

      // Fiery reentry comet trail opposite velocity
      const spd = Math.hypot(m.vx, m.vy) || 1;
      const nx = -m.vx / spd;
      const ny = -m.vy / spd;
      for (let t = 3; t >= 1; t--) {
        const dist = m.r * (0.45 + t * 0.42);
        const tr = m.r * (0.78 - t * 0.16);
        ctx.fillStyle = m.isBoss
          ? `rgba(255, 75, 92, ${0.32 - t * 0.07})`
          : `rgba(255, 159, 28, ${0.34 - t * 0.08})`;
        ctx.beginPath();
        ctx.arc(m.x + nx * dist, m.y + ny * dist, tr, 0, TAU);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rot);

      if (m.isBoss) {
        // Chunky sculpted crystal spikes around boss asteroid
        for (let sp = 0; sp < 8; sp++) {
          const a = (sp / 8) * TAU;
          ctx.save();
          ctx.rotate(a);
          ctx.fillStyle = shadeColor(baseCol, -0.15);
          ctx.strokeStyle = rim;
          ctx.lineWidth = lw * 0.85;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(m.r * 0.78, -m.r * 0.2);
          ctx.lineTo(m.r * 1.22, 0);
          ctx.lineTo(m.r * 0.78, m.r * 0.2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      drawToySphere(ctx, 0, 0, m.r, baseCol, {
        rimColor: rim,
        lineWidth: lw,
        shine: 0.68,
      });

      // Sculpted vinyl craters
      ctx.fillStyle = shadeColor(baseCol, -0.28);
      ctx.beginPath();
      ctx.ellipse(-m.r * 0.28, m.r * 0.26, m.r * 0.2, m.r * 0.14, 0.3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(m.r * 0.34, -m.r * 0.22, m.r * 0.14, m.r * 0.1, -0.4, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Upright expressive boss face or crisp HP badge
      if (m.isBoss) {
        drawToyEyes(ctx, m.x, m.y - m.r * 0.16, m.r * 0.18, {
          spacing: m.r * 0.52,
          style: 'angry',
          lookX: 0,
          lookY: 0.32,
        });
      }
      if (m.hp > 1) {
        ctx.save();
        ctx.font = `700 ${m.isBoss ? 16 : 14}px 'Fredoka', 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = '#0f172a';
        const labelY = m.isBoss ? m.y + m.r * 0.36 : m.y + 1;
        ctx.strokeText(String(m.hp), m.x, labelY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(m.hp), m.x, labelY);
        ctx.restore();
      }
    }

    // 6. Captain Bean Defender + Grounding Shadow on Planet Surface
    drawToyShadow(ctx, W / 2, this.shieldY + 35, 17, 6, 0.32);
    drawBean(ctx, W / 2, this.shieldY + 18, 22, {
      eyes: this.dead ? 'squish' : 'bright',
      walkT: this.time * 0.5,
      dead: this.dead,
    });

    this.fx.render(ctx);
  }

  serialize() {
    return {
      shieldHp: this.shieldHp,
      destroyed: this.destroyed,
      bossSpawned: this.bossSpawned,
    };
  }

  restoreLabel() {
    return `${this.destroyed}/${this.targetGoal} meteors`;
  }
}

