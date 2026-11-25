// WIP Bank Reel: Meteor Tap (Weebl's Stuff HD Flash Cel-Cartoon Space Defense Edition)
import { Game } from '../../engine/Game.js';
import { FX } from '../../engine/fx.js';
import { drawToyShadow, traceRoundRect } from '../../engine/toyStyle.js';
import {
  preloadWeeblAtlas,
  drawSunburst,
  drawComicPanel,
  drawComicStarburst,
  drawComicText,
  drawHeroCharacter,
} from '../weeblAtlas.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

let _meteorBgImg = null;
function getMeteorBgImage() {
  if (_meteorBgImg) return _meteorBgImg;
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.decoding = 'async';
  img.src = '/assets/weebl/meteor_defense_bg.jpg';
  _meteorBgImg = img;
  return img;
}

const METEOR_SPRITE_META = {
  rock:    { src: '/assets/weebl/meteor_1.png',    aspect: 126 / 220, rockCyFrac: 0.757, rockWidthRFrac: 0.401 },
  lava:    { src: '/assets/weebl/meteor_2.png',    aspect: 120 / 220, rockCyFrac: 0.748, rockWidthRFrac: 0.438 },
  crystal: { src: '/assets/weebl/meteor_3.png',    aspect: 121 / 220, rockCyFrac: 0.730, rockWidthRFrac: 0.426 },
  boss:    { src: '/assets/weebl/meteor_boss.png', aspect: 164 / 240, rockCyFrac: 0.671, rockWidthRFrac: 0.451 },
};
const _meteorSprites = {};
function preloadMeteorSprites() {
  if (typeof Image === 'undefined') return;
  for (const [key, cfg] of Object.entries(METEOR_SPRITE_META)) {
    if (!_meteorSprites[key]) {
      const img = new Image();
      img.decoding = 'async';
      img.src = cfg.src;
      _meteorSprites[key] = img;
    }
  }
}

export class MeteorSmasher extends Game {
  static meta = {
    id: 'meteor-smasher',
    title: 'Meteor Tap',
    icon: '☄️',
    hint: 'TAP meteors before they smash the shield!',
    baseLikes: 2710,
    isPrestige: true,
    parScore60s: 2600,
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
    preloadWeeblAtlas();
    getMeteorBgImage();
    preloadMeteorSprites();
    this.fx = new FX();
    this.score = score;

    this.shieldY = Game.SAFE_BOTTOM - 54;
    this.shieldHp = saved?.shieldHp ?? 3;
    this.destroyed = saved?.destroyed ?? 0;
    this.targetGoal = this.diff.targetGoal ?? 24;
    this.bossSpawned = saved?.bossSpawned ?? false;

    this.meteors = [];
    this.shots = [];
    this.debris = [];
    this.spawnCd = 0.45;
    this.grace = saved ? 1.2 : 0.6;

    this.aimX = this.W * 0.5;
    this.aimDir = 1;
    this.recoil = 0;
    this.shieldFlash = 0;
    this.shake = 0;
  }

  _buildRockRadii(verts = 10, jaggedness = 0.16) {
    const out = [];
    for (let i = 0; i < verts; i++) {
      out.push(1 - jaggedness * 0.5 + (Math.random() - 0.5) * jaggedness);
    }
    return out;
  }

  spawnMeteor(isBoss = false) {
    const r = isBoss ? 48 : (22 + Math.random() * 14);
    const hp = isBoss ? (this.diff.bossHp ?? 8) : (r > 30 ? 2 : 1);
    const spdMult = this.diff.fallSpeedMult ?? 1;
    const variant = isBoss
      ? 'boss'
      : hp > 1
        ? (Math.random() < 0.62 ? 'lava' : 'crystal')
        : (Math.random() < 0.65 ? 'rock' : 'crystal');
    this.meteors.push({
      x: 48 + Math.random() * (this.W - 96),
      y: Game.SAFE_TOP - r,
      r,
      hp,
      maxHp: hp,
      variant,
      vy: (isBoss ? 58 : (115 + Math.random() * 75)) * spdMult,
      vx: (Math.random() - 0.5) * 42,
      isBoss,
      rot: Math.random() * TAU,
      hitFlash: 0,
      emberT: Math.random() * 0.12,
      radii: this._buildRockRadii(isBoss ? 12 : 10, isBoss ? 0.14 : 0.2),
    });
  }

  _spawnRockDebris(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const spd = 75 + Math.random() * 165;
      this.debris.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 40,
        r: 4 + Math.random() * 4.5,
        rot: Math.random() * TAU,
        vrot: (Math.random() - 0.5) * 12,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
        color,
      });
    }
  }

  updateDying(dt) {
    this.fx.update(dt);
    this.shieldFlash = Math.max(0, this.shieldFlash - dt * 2.5);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.shake = Math.max(0, this.shake - dt * 26);
    this._updateEffects(dt);
  }

  _updateEffects(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      if (s.life <= 0) this.shots.splice(i, 1);
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 320 * dt;
      d.rot += d.vrot * dt;
      d.life -= dt;
      if (d.life <= 0) this.debris.splice(i, 1);
    }
  }

  update(dt) {
    if (this.dead || this.won) {
      this.updateDying(dt);
      return;
    }
    this.fx.update(dt);
    this._updateEffects(dt);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.shieldFlash = Math.max(0, this.shieldFlash - dt * 2.4);
    this.shake = Math.max(0, this.shake - dt * 28);

    // Tap to zap/smash meteors
    if (this.input.pressed) {
      const tx = this.input.x;
      const ty = this.input.y;
      const heroX = this.W * 0.5;
      const heroY = this.shieldY + 12;
      this.aimX = tx;
      if (Math.abs(tx - heroX) > 8) this.aimDir = tx > heroX ? 1 : -1;
      this.recoil = 1;

      let hitAny = false;

      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        if (Math.hypot(tx - m.x, ty - m.y) <= m.r + 22) {
          hitAny = true;
          m.hp -= 1;
          m.hitFlash = 1;
          this.shots.push({ x1: heroX, y1: heroY, x2: m.x, y2: m.y, life: 0.14, maxLife: 0.14, hit: true });
          this.fx.ring(m.x, m.y, '#22d3ee', m.r + 24, 0.25, 3);
          this.sounds.hit();
          this.haptics.light();

          if (m.hp <= 0) {
            this.destroyed += 1;
            const pts = m.isBoss ? 850 : m.maxHp * 95;
            this.score += pts;
            const rockCol = m.isBoss ? '#dc2626' : m.maxHp > 1 ? '#f97316' : '#c27849';
            this._spawnRockDebris(m.x, m.y, rockCol, m.isBoss ? 18 : 8);
            this.fx.burst(m.x, m.y, m.isBoss ? '#fde047' : '#fb923c', m.isBoss ? 22 : 14, 195, 0.48, 4.2);
            this.fx.text(m.x, m.y - 10, `+${pts}`, '#fde047', 18, 0.65);
            this.sounds.up();
            this.haptics.medium();
            this.shake = Math.max(this.shake, m.isBoss ? 11 : 4.5);

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
        this.shots.push({ x1: heroX, y1: heroY, x2: tx, y2: ty, life: 0.1, maxLife: 0.1, hit: false });
        this.fx.ring(tx, ty, 'rgba(103, 232, 249, 0.45)', 22, 0.2, 2);
      }
    }

    // Spawn logic
    this.spawnCd -= dt;
    if (this.spawnCd <= 0) {
      if (!this.bossSpawned && this.destroyed >= this.targetGoal) {
        this.bossSpawned = true;
        this.spawnMeteor(true);
        this.sounds.upgrade();
        this.fx.text(this.W * 0.5, Game.SAFE_TOP + 88, '☄️ MEGA BOSS INCOMING!', '#fca5a5', 18, 1.4);
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
      m.rot += dt * (m.isBoss ? 1.1 : 1.85);
      m.hitFlash = Math.max(0, m.hitFlash - dt * 6);

      if (m.x - m.r < 18) { m.x = 18 + m.r; m.vx = Math.abs(m.vx); }
      if (m.x + m.r > this.W - 18) { m.x = this.W - 18 - m.r; m.vx = -Math.abs(m.vx); }

      if (m.y + m.r >= this.shieldY) {
        this.meteors.splice(i, 1);
        if (this.grace <= 0) {
          this.shieldHp -= m.isBoss ? 3 : 1;
          this.shieldFlash = 1;
          this.shake = 9;
          this.fx.burst(m.x, this.shieldY, '#ef4444', 18, 190, 0.48, 4.2);
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

  _drawBackdrop(ctx, animT) {
    const { W, H } = this;
    const bgImg = getMeteorBgImage();

    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, 0, 0, W, H);
    } else {
      // Vibrant Weebl cel-cartoon space fallback
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1e1b4b');
      sky.addColorStop(0.55, '#312e81');
      sky.addColorStop(1, '#0f172a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      drawSunburst(ctx, W * 0.5, this.shieldY + 40, W * 0.9, animT * 0.12, 14, 0.12, this.bossSpawned);

      const planetR = W * 0.92;
      const planetCy = this.shieldY + 26 + planetR;
      const pg = ctx.createRadialGradient(W * 0.45, this.shieldY + 32, 12, W * 0.5, planetCy, planetR);
      pg.addColorStop(0, '#4ade80');
      pg.addColorStop(0.35, '#14b8a6');
      pg.addColorStop(1, '#0f766e');
      ctx.fillStyle = pg;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(W * 0.5, planetCy, planetR, Math.PI * 1.15, Math.PI * 1.85);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Animated comic twinkling stars & subtle boss danger pulse
    for (let i = 0; i < 16; i++) {
      const sx = ((i * 97 + 23) % (W - 28)) + 14;
      const sy = Game.SAFE_TOP + 24 + ((i * 131 + 17) % Math.max(100, this.shieldY - Game.SAFE_TOP - 80));
      const tw = 0.25 + 0.65 * Math.abs(Math.sin(animT * 2.5 + i * 1.3));
      ctx.save();
      ctx.globalAlpha = tw;
      ctx.fillStyle = i % 3 === 0 ? '#fef08a' : '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, i % 4 === 0 ? 2 : 1.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (this.shieldFlash > 0.02) {
      ctx.fillStyle = `rgba(239, 68, 68, ${(this.shieldFlash * 0.24).toFixed(2)})`;
      ctx.fillRect(0, Game.SAFE_TOP, W, Game.PLAY_HEIGHT);
    }
  }

  _drawShieldDome(ctx, animT) {
    const { W, H } = this;
    const low = this.shieldHp <= 1;
    const shieldCol = low ? '#ef4444' : '#22d3ee';
    const coreCol = low ? '#fecaca' : '#ecfeff';
    const archH = 26;

    ctx.save();
    // Subtle translucent dome fill over Bean Planet
    ctx.fillStyle = low ? 'rgba(239, 68, 68, 0.14)' : 'rgba(34, 211, 238, 0.10)';
    ctx.beginPath();
    ctx.moveTo(22, this.shieldY);
    ctx.quadraticCurveTo(W * 0.5, this.shieldY - archH, W - 22, this.shieldY);
    ctx.lineTo(W - 22, H);
    ctx.lineTo(22, H);
    ctx.closePath();
    ctx.fill();

    // Bold Weebl #000 ink shadow + bright plasma dome ribbon
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(22, this.shieldY);
    ctx.quadraticCurveTo(W * 0.5, this.shieldY - archH, W - 22, this.shieldY);
    ctx.stroke();

    ctx.strokeStyle = shieldCol;
    ctx.lineWidth = 5.5;
    ctx.stroke();

    ctx.strokeStyle = coreCol;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -animT * 55;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Chunky #000-outlined left & right Shield Generator Pylons
    for (const px of [20, W - 20]) {
      drawComicPanel(ctx, px - 11, this.shieldY - 8, 22, 24, 6, '#334155', {
        borderColor: '#000000',
        borderWidth: 2.8,
        shadowOffset: 2,
      });
      ctx.save();
      ctx.fillStyle = shieldCol;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(px, this.shieldY - 2, 6.5, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px - 1.8, this.shieldY - 3.8, 2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawMeteor(ctx, m, animT) {
    const key = m.variant || (m.isBoss ? 'boss' : m.maxHp > 1 ? 'lava' : 'rock');
    const spec = METEOR_SPRITE_META[key] || METEOR_SPRITE_META.rock;
    const sprite = _meteorSprites[key];
    const isHit = m.hitFlash > 0.15;

    // Velocity-aligned fall tilt + gentle animated heat wobble
    const fallTilt = Math.atan2(-m.vx, Math.max(40, m.vy)) * 0.55;
    const wobble = Math.sin(animT * 7.5 + m.x * 0.08) * 0.045;
    const pulse = 1 + Math.sin(animT * 16 + m.y * 0.05) * (m.isBoss ? 0.035 : 0.022);

    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      // Scale sprite width so lower spherical rock radius matches physics hitbox m.r cleanly!
      const drawW = (m.r / spec.rockWidthRFrac) * (m.isBoss ? 1.12 : 1.06);
      const drawH = drawW / spec.aspect;
      const anchorY = -drawH * spec.rockCyFrac;

      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(fallTilt + wobble);
      ctx.scale(pulse, pulse);

      // Subtle hot atmospheric glow aura behind the comet tail
      ctx.fillStyle = m.isBoss ? 'rgba(239, 68, 68, 0.22)' : 'rgba(251, 146, 60, 0.16)';
      ctx.beginPath();
      ctx.ellipse(0, -m.r * 0.45, m.r * 1.15, m.r * 1.65, 0, 0, TAU);
      ctx.fill();

      ctx.drawImage(sprite, -drawW * 0.5, anchorY, drawW, drawH);

      if (isHit) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.55)';
        ctx.beginPath();
        ctx.arc(0, 0, m.r * 1.02, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    } else {
      // Headless / pre-decode vector fallback
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(fallTilt);
      ctx.fillStyle = isHit ? '#fef08a' : m.isBoss ? '#dc2626' : m.maxHp > 1 ? '#f97316' : '#57534e';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, 0, m.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Crisp comic HP badge overlaid on armored rocks & Boss (offset cleanly below Boss's angry eyes)
    if (m.hp > 1) {
      const labelY = m.isBoss ? m.y + m.r * 0.62 : m.y + 3;
      drawComicText(
        ctx,
        String(m.hp),
        m.x,
        labelY,
        `900 ${m.isBoss ? 18 : 15}px 'Fredoka', 'Outfit', sans-serif`,
        '#fde047',
        { strokeWidth: 4.5 },
      );
    }
  }

  _drawShotsAndDebris(ctx) {
    for (const s of this.shots) {
      const a = clamp(s.life / s.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = s.hit ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();

      ctx.strokeStyle = s.hit ? '#22d3ee' : '#bae6fd';
      ctx.lineWidth = s.hit ? 3.5 : 2;
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      if (s.hit) {
        drawComicStarburst(ctx, s.x2, s.y2, 20 * a + 4, 9 * a + 2, 7, '#fef08a', '#000000', s.x2 * 0.05, 2.2);
      }
      ctx.restore();
    }

    for (const d of this.debris) {
      const a = clamp(d.life / d.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-d.r, -d.r * 0.5);
      ctx.lineTo(d.r * 0.8, -d.r * 0.8);
      ctx.lineTo(d.r, d.r * 0.6);
      ctx.lineTo(-d.r * 0.5, d.r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawDefenderHero(ctx, animT) {
    const heroX = this.W * 0.5;
    const heroY = this.shieldY + 34;

    // Ground turret pad + shadow right on Bean Planet top curve
    drawToyShadow(ctx, heroX, heroY + 2, 22, 7, 0.38);

    ctx.save();
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.8;
    traceRoundRect(ctx, heroX - 24, heroY - 5, 48, 12, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.shieldHp >= 2 ? '#22d3ee' : '#ef4444';
    ctx.fillRect(heroX - 16, heroY - 2, 32, 4);
    ctx.restore();

    const bossNear = this.meteors.some((m) => (m.isBoss && m.y > this.shieldY - 210) || m.y + m.r > this.shieldY - 90);
    const expr = this.dead ? 'dizzy' : (this.shieldHp <= 1 || bossNear) ? 'panic' : this.recoil > 0.2 ? 'focus' : 'happy';

    drawHeroCharacter(ctx, heroX, heroY, 54, {
      view: 'threeQuarterFront',
      dir: this.aimDir,
      state: this.dead ? 'dead' : this.recoil > 0.2 ? 'hop_leap' : 'stand_alert',
      expr,
      t: animT * 4,
      lean: this.recoil * -0.18 * this.aimDir,
      lookX: this.aimDir * 0.65,
      squashX: 1 + this.recoil * 0.14,
      squashY: 1 - this.recoil * 0.14,
    });
  }

  _drawHudHeader(ctx) {
    const { W } = this;
    const shieldCol = this.shieldHp >= 2 ? '#22d3ee' : '#ef4444';
    const pillY = Game.SAFE_TOP + 8;

    // Left Shield & Meteor Goal Comic Panel
    drawComicPanel(ctx, 14, pillY, 214, 34, 13, '#0f172a', {
      borderColor: '#000000',
      borderWidth: 3,
      shadowOffset: 3,
      shadowColor: 'rgba(0,0,0,0.45)',
    });
    drawComicText(ctx, '🛡️', 29, pillY + 18, "900 13px 'Fredoka', sans-serif", '#ffffff', { strokeWidth: 3 });

    for (let sIdx = 0; sIdx < 3; sIdx++) {
      const px = 54 + sIdx * 20;
      const py = pillY + 17;
      const active = sIdx < this.shieldHp;
      ctx.save();
      ctx.fillStyle = active ? shieldCol : '#1e293b';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (active) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px - 2, py - 2.2, 2.1, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    drawComicText(
      ctx,
      `☄️ ${this.destroyed}/${this.targetGoal}`,
      216,
      pillY + 18,
      "900 12.5px 'Fredoka', 'Outfit', sans-serif",
      '#fde047',
      { align: 'right', strokeWidth: 3.5 },
    );

    // Right Boss Progress / Mega-Boss HP Comic Pill
    const boss = this.meteors.find((m) => m.isBoss);
    const rightW = 148;
    const rightX = W - rightW - 14;
    if (this.bossSpawned && boss) {
      drawComicPanel(ctx, rightX, pillY, rightW, 34, 13, '#991b1b', {
        borderColor: '#000000',
        borderWidth: 3,
        shadowOffset: 3,
      });
      drawComicText(ctx, `☄️ BOSS ${boss.hp}/${boss.maxHp}`, rightX + rightW * 0.5, pillY + 12, "900 10.5px 'Fredoka', sans-serif", '#fef08a', {
        strokeWidth: 3,
      });
      const barW = rightW - 22;
      const frac = clamp(boss.hp / Math.max(1, boss.maxHp), 0, 1);
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(rightX + 11, pillY + 21, barW, 7);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(rightX + 11, pillY + 21, barW * frac, 7);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(rightX + 11, pillY + 21, barW, 7);
    } else {
      const rem = Math.max(0, this.targetGoal - this.destroyed);
      drawComicPanel(ctx, rightX, pillY, rightW, 34, 13, '#1e293b', {
        borderColor: '#000000',
        borderWidth: 3,
        shadowOffset: 3,
      });
      drawComicText(
        ctx,
        rem > 0 ? `👑 BOSS IN ${rem}` : '👑 BOSS READY!',
        rightX + rightW * 0.5,
        pillY + 18,
        "900 11px 'Fredoka', 'Outfit', sans-serif",
        '#bae6fd',
        { strokeWidth: 3.2 },
      );
    }
  }

  render() {
    const ctx = this.ctx;
    const animT = this.time || 0;

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this._drawBackdrop(ctx, animT);
    this._drawShieldDome(ctx, animT);
    this._drawDefenderHero(ctx, animT);

    for (const m of this.meteors) {
      this._drawMeteor(ctx, m, animT);
    }

    this._drawShotsAndDebris(ctx);
    this._drawHudHeader(ctx);

    this.fx.render(ctx);
    ctx.restore();
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
