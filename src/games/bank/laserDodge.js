// WIP Bank Reel: Laser Grid (Weebl's Stuff HD Cel-Cartoon Courtyard Edition + 30s +25% Surge + Final 15s Spinning Saws)
import { Game } from '../../engine/Game.js';
import { FX } from '../../engine/fx.js';
import { drawToyShadow } from '../../engine/toyStyle.js';
import {
  STYLE_TOKENS,
  preloadWeeblAtlas,
  drawSunburst,
  drawComicPanel,
  drawComicStarburst,
  drawComicText,
  drawHeroCharacter,
} from '../weeblAtlas.js';

const TAU = Math.PI * 2;
const SURGE_TIME_S = 30;
const SURGE_MULT = 1.25; // +25% faster laser cadence & shorter telegraph 30s into each round
const SAW_TIME_S = 45;   // Last 15 seconds of a 60s round unleash bouncing spinning sawblades

// Playable courtyard bounds aligned to public/assets/weebl/laser_arena_bg.jpg in 450x800 virtual space
const ARENA = {
  x: 42,
  y: 184,
  w: 366,
  h: 482,
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

let _arenaBgImg = null;
function getArenaBgImage() {
  if (_arenaBgImg) return _arenaBgImg;
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.decoding = 'async';
  img.src = '/assets/weebl/laser_arena_bg.jpg';
  _arenaBgImg = img;
  return img;
}

export class LaserDodge extends Game {
  static meta = {
    id: 'laser-dodge',
    title: 'Laser Grid',
    icon: '⚡',
    hint: 'DRAG to dodge zappers & saws · grab Gems & Coins!',
    baseLikes: 3120,
    isPrestige: false,
    parScore60s: 2600,
    roundLen: 60,
    cue: 'DODGE ZAPPERS & SAWS, GRAB COINS!',
    prestigeCue: 'SHORTER LASER WARNINGS!',
    scaling: {
      warnScale:       { base: 1.0, rate: 0.18, floor: 0.54, mode: 'down', label: 'Warn Time' },
      laserCadence:    { base: 1.0, rate: 0.16, floor: 0.62, mode: 'down', label: 'Laser Rate' },
      multiLaserBonus: { base: 0.0, rate: 0.20, cap: 0.40,   mode: 'up',   deltaFormat: 'abs', unit: '%', label: 'Double Beams' },
    },
  };

  init(saved, score = 0) {
    preloadWeeblAtlas();
    getArenaBgImage();
    this.fx = new FX();
    this.score = score;

    const minPx = ARENA.x + 24;
    const maxPx = ARENA.x + ARENA.w - 24;
    const minPy = ARENA.y + 24;
    const maxPy = ARENA.y + ARENA.h - 24;

    this.player = {
      x: clamp(saved?.x ?? (ARENA.x + ARENA.w * 0.5), minPx, maxPx),
      y: clamp(saved?.y ?? (ARENA.y + ARENA.h * 0.58), minPy, maxPy),
      r: 15,
      speed: 245,
      dir: 1,
      walkT: 0,
      moving: false,
      vx: 0,
      vy: 0,
      squash: 1,
      dustT: 0,
    };

    this.lasers = [];
    this.orbs = [];
    this.saws = [];
    this.sparks = [];
    this.nextLaser = 1.05;
    this.nextOrb = 0.7;
    this.level = clamp(saved?.level ?? 1, 1, 12);
    this.streak = saved?.streak ?? 0;

    this.roundElapsed = 0;
    this.surgeTriggered = false;
    this.surgeFlash = 0;
    this.sawsTriggered = false;
    this.bonusSawSpawned = false;
    this.sawFlash = 0;
    this.sawClangCooldown = 0;
    this.shake = 0;
    this.grace = saved ? 1.4 : 0.7;

    for (let i = 0; i < 3; i++) this.spawnOrb();
  }

  _elapsedSeconds() {
    return Math.max(this.roundElapsed, this.time || 0);
  }

  _isSurgeActive() {
    return this.surgeTriggered || this._elapsedSeconds() >= SURGE_TIME_S;
  }

  _areSawsActive() {
    return this.sawsTriggered || this._elapsedSeconds() >= SAW_TIME_S;
  }

  _getTimeIntervalScale() {
    // Increase speed/cadence by 25% (interval * 0.8) from 30s onward
    return this._isSurgeActive() ? (1 / SURGE_MULT) : 1;
  }

  spawnOrb() {
    const padX = 36;
    const topPad = 52;
    const botPad = 36;
    this.orbs.push({
      x: ARENA.x + padX + Math.random() * (ARENA.w - padX * 2),
      y: ARENA.y + topPad + Math.random() * (ARENA.h - topPad - botPad),
      r: 13,
      gold: Math.random() < 0.28,
      pulse: Math.random() * TAU,
      spawnT: 0,
    });
  }

  spawnLaser() {
    const horiz = Math.random() < 0.5;
    // Keep cannons clear of the 4 corner stone bastions
    const margin = 40;
    const pos = horiz
      ? ARENA.y + margin + Math.random() * (ARENA.h - margin * 2)
      : ARENA.x + margin + Math.random() * (ARENA.w - margin * 2);

    const baseWarn = Math.max(0.45, (1.1 - this.level * 0.04) * (this.diff.warnScale ?? 1));
    const warn = Math.max(0.36, baseWarn * this._getTimeIntervalScale());
    const surge = this._isSurgeActive();
    this.lasers.push({
      horiz,
      pos,
      warn,
      maxWarn: warn,
      active: 0.44,
      maxActive: 0.44,
      width: (horiz ? 18 : 16) + Math.min(8, this.level),
      fired: false,
      recoil: 0,
      boltSeed: Math.random() * 100,
      hue: surge ? 'crimson' : 'cyan',
    });
  }

  _createSpinningSaw(anchorX, anchorY, angleRad, spinDir = 1) {
    // Pick a point far enough from player so telegraph spawn never feels unfair
    let x = anchorX;
    let y = anchorY;
    const dist = Math.hypot(x - this.player.x, y - this.player.y);
    if (dist < 110) {
      x = anchorX < ARENA.x + ARENA.w * 0.5 ? ARENA.x + ARENA.w - 70 : ARENA.x + 70;
      y = anchorY < ARENA.y + ARENA.h * 0.5 ? ARENA.y + ARENA.h - 85 : ARENA.y + 95;
    }
    const cadenceMult = 1 + (1 - (this.diff.laserCadence ?? 1)) * 0.45;
    const speed = clamp((152 + this.level * 4) * cadenceMult, 145, 225);
    return {
      x,
      y,
      r: 21,
      vx: Math.cos(angleRad) * speed,
      vy: Math.sin(angleRad) * speed,
      rot: Math.random() * TAU,
      spinDir,
      spinSpeed: 12.5 * spinDir,
      warn: 0.85,
      maxWarn: 0.85,
      sparkT: 0,
      bouncePulse: 0,
    };
  }

  spawnInitialSaws() {
    if (this.saws.length > 0) return;
    const midX = ARENA.x + ARENA.w * 0.5;
    const midY = ARENA.y + ARENA.h * 0.5;
    const pTop = this.player.y < midY;
    const pLeft = this.player.x < midX;

    // Two counter-diagonal circular saws launching from quiet courtyard quadrants
    const s1X = pLeft ? ARENA.x + ARENA.w - 68 : ARENA.x + 68;
    const s1Y = ARENA.y + (pTop ? ARENA.h - 95 : 95);
    const a1 = Math.atan2(midY - s1Y, midX - s1X) + 0.28;

    const s2X = pLeft ? ARENA.x + 68 : ARENA.x + ARENA.w - 68;
    const s2Y = ARENA.y + (pTop ? 120 : ARENA.h - 120);
    const a2 = Math.atan2(midY - s2Y, midX - s2X) - 0.24;

    this.saws.push(this._createSpinningSaw(s1X, s1Y, a1, 1));
    this.saws.push(this._createSpinningSaw(s2X, s2Y, a2, -1));
  }

  _updateSaws(dt, checkCollision) {
    const pad = 6;
    for (const s of this.saws) {
      s.rot += s.spinSpeed * dt;
      s.bouncePulse = Math.max(0, s.bouncePulse - dt * 4);
      if (s.warn > 0) {
        s.warn = Math.max(0, s.warn - dt);
        continue;
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      const minX = ARENA.x + s.r + pad;
      const maxX = ARENA.x + ARENA.w - s.r - pad;
      const minY = ARENA.y + s.r + pad;
      const maxY = ARENA.y + ARENA.h - s.r - pad;
      let bounced = false;
      let hitX = s.x;
      let hitY = s.y;

      if (s.x < minX) {
        s.x = minX;
        s.vx = Math.abs(s.vx);
        hitX = ARENA.x + 4;
        bounced = true;
      } else if (s.x > maxX) {
        s.x = maxX;
        s.vx = -Math.abs(s.vx);
        hitX = ARENA.x + ARENA.w - 4;
        bounced = true;
      }
      if (s.y < minY) {
        s.y = minY;
        s.vy = Math.abs(s.vy);
        hitY = ARENA.y + 4;
        bounced = true;
      } else if (s.y > maxY) {
        s.y = maxY;
        s.vy = -Math.abs(s.vy);
        hitY = ARENA.y + ARENA.h - 4;
        bounced = true;
      }

      if (bounced) {
        s.bouncePulse = 1;
        this._emitSparks(hitX, hitY, 5, '#fde047');
        if (this.sawClangCooldown <= 0) {
          this.sounds?.tick();
          this.sawClangCooldown = 0.22;
        }
      }

      s.sparkT -= dt;
      if (s.sparkT <= 0) {
        s.sparkT = 0.09;
        this._emitSparks(s.x, s.y + s.r * 0.4, 1, '#fb923c');
      }

      if (checkCollision && this.grace <= 0) {
        const d = Math.hypot(this.player.x - s.x, this.player.y - s.y);
        if (d <= this.player.r * 0.68 + s.r * 0.78) {
          this.fx.burst(this.player.x, this.player.y, '#ef4444', 24, 240, 0.58, 4.5);
          this.shake = 10;
          this.die('Sliced by spinning saw! 🪚');
          return true;
        }
      }
    }
    return false;
  }

  _emitSparks(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const spd = 45 + Math.random() * 115;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 20,
        life: 0.22 + Math.random() * 0.2,
        maxLife: 0.42,
        size: 2.2 + Math.random() * 2.2,
        color,
      });
    }
  }

  _updateSparks(dt) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.life -= dt;
      if (p.life <= 0) this.sparks.splice(i, 1);
    }
  }

  updateDying(dt) {
    this.fx.update(dt);
    this._updateSparks(dt);
    this._updateSaws(dt * 0.4, false);
    this.shake = Math.max(0, this.shake - dt * 26);
  }

  update(dt) {
    this.fx.update(dt);
    this._updateSparks(dt);
    this.roundElapsed += dt;
    this.grace = Math.max(0, this.grace - dt);
    this.surgeFlash = Math.max(0, this.surgeFlash - dt * 1.4);
    this.sawFlash = Math.max(0, this.sawFlash - dt * 1.3);
    this.sawClangCooldown = Math.max(0, this.sawClangCooldown - dt);
    this.shake = Math.max(0, this.shake - dt * 28);

    // 30s difficulty milestone: +25% faster laser cadence & telegraph speed
    if (!this.surgeTriggered && this._elapsedSeconds() >= SURGE_TIME_S) {
      this.surgeTriggered = true;
      this.surgeFlash = 1.0;
      this.shake = 6;
      this.sounds.upgrade();
      this.haptics.medium();
      this.fx.burst(ARENA.x + ARENA.w * 0.5, ARENA.y + ARENA.h * 0.45, '#facc15', 22, 230, 0.58, 4.5);
      this.fx.text(this.W * 0.5, ARENA.y + 84, '⚡ 30s! +25% OVERDRIVE!', '#fde047', 18, 1.4);
    }

    // 45s milestone (final 15 seconds): spinning bouncing sawblades enter the courtyard
    if (!this.sawsTriggered && this._elapsedSeconds() >= SAW_TIME_S) {
      this.sawsTriggered = true;
      this.sawFlash = 1.0;
      this.shake = 8;
      this.spawnInitialSaws();
      this.sounds.upgrade();
      this.haptics.medium();
      this.fx.burst(ARENA.x + ARENA.w * 0.5, ARENA.y + ARENA.h * 0.5, '#ef4444', 24, 240, 0.6, 4.5);
      this.fx.text(this.W * 0.5, ARENA.y + 116, '🪚 FINAL 15s! SPINNING SAWS!', '#fca5a5', 18, 1.5);
    }

    // Optional 3rd spinning sawblade at 52.5s on higher levels / prestiges
    if (!this.bonusSawSpawned && this._elapsedSeconds() >= SAW_TIME_S + 7.5 && (this.prestige >= 3 || this.level >= 5)) {
      this.bonusSawSpawned = true;
      this.saws.push(this._createSpinningSaw(ARENA.x + ARENA.w * 0.5, ARENA.y + ARENA.h * 0.5, 0.72, 1));
      this.fx.text(this.W * 0.5, ARENA.y + 116, '🪚 EXTRA SAW DEPLOYED!', '#fed7aa', 16, 1.15);
    }

    const stick = this.input.vec(48);
    const prevX = this.player.x;
    const prevY = this.player.y;
    const padX = 24;
    const padY = 24;
    this.player.x = clamp(this.player.x + stick.x * this.player.speed * dt, ARENA.x + padX, ARENA.x + ARENA.w - padX);
    this.player.y = clamp(this.player.y + stick.y * this.player.speed * dt, ARENA.y + padY, ARENA.y + ARENA.h - padY);

    // Gently deflect around the inner corners where stone bastions meet the courtyard floor
    this.player.vx = (this.player.x - prevX) / Math.max(0.001, dt);
    this.player.vy = (this.player.y - prevY) / Math.max(0.001, dt);
    const speedMag = Math.hypot(stick.x, stick.y);
    this.player.moving = speedMag > 0.08;
    if (this.player.moving) {
      this.player.walkT += dt * 1.9;
      if (Math.abs(stick.x) > 0.08) this.player.dir = stick.x > 0 ? 1 : -1;
      this.player.squash = 1 + Math.sin(this.player.walkT * 11) * 0.09;
      this.player.dustT -= dt;
      if (this.player.dustT <= 0) {
        this.player.dustT = 0.14;
        this._emitSparks(this.player.x - this.player.dir * 8, this.player.y + 18, 1, '#fef9c3');
      }
    } else {
      this.player.squash += (1 - this.player.squash) * Math.min(1, dt * 12);
    }

    // Collect coins & gems
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.pulse += dt * 4;
      o.spawnT = Math.min(1, o.spawnT + dt * 4.5);
      if (Math.hypot(this.player.x - o.x, this.player.y - o.y) <= this.player.r + o.r + 3) {
        this.streak++;
        const pts = (o.gold ? 120 : 65) + this.level * (o.gold ? 15 : 10);
        this.score += pts;
        this.player.squash = 1.24;
        this.fx.burst(o.x, o.y, o.gold ? '#facc15' : '#38bdf8', 13, 175, 0.38, 3.8);
        this.fx.text(o.x, o.y - 20, `+${pts}`, o.gold ? '#fde047' : '#67e8f9', 18, 0.68);
        this.sounds.bubble(o.gold ? 1.35 : 1.0);
        this.haptics.light();
        this.orbs.splice(i, 1);
      }
    }

    this.nextOrb -= dt;
    if (this.nextOrb <= 0 && this.orbs.length < 5) {
      this.spawnOrb();
      this.nextOrb = 1.05;
    }

    this.nextLaser -= dt;
    if (this.nextLaser <= 0) {
      this.spawnLaser();
      const baseDbl = (this.level >= 3 ? 0.35 : 0) + (this.diff.multiLaserBonus || 0);
      const dblChance = this._isSurgeActive() ? Math.min(0.62, baseDbl + 0.12) : baseDbl;
      if (Math.random() < dblChance) this.spawnLaser();

      const basePeriod = Math.max(0.32, (1.05 - this.level * 0.05) * (this.diff.laserCadence ?? 1));
      this.nextLaser = Math.max(0.26, basePeriod * this._getTimeIntervalScale());
      this.level = Math.min(12, 1 + Math.floor((this.score || 0) / 1400));
    }

    // Update cannons & laser beams
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.recoil = Math.max(0, l.recoil - dt * 5);
      if (l.warn > 0) {
        l.warn -= dt;
      } else {
        if (!l.fired) {
          l.fired = true;
          l.recoil = 1;
          this.shake = Math.max(this.shake, 4.5);
          this.sounds.slice();
          const c1x = l.horiz ? ARENA.x : l.pos;
          const c1y = l.horiz ? l.pos : ARENA.y;
          const c2x = l.horiz ? ARENA.x + ARENA.w : l.pos;
          const c2y = l.horiz ? l.pos : ARENA.y + ARENA.h;
          this._emitSparks(c1x, c1y, 5, '#fef08a');
          this._emitSparks(c2x, c2y, 5, '#fef08a');
        }
        l.active -= dt;
        const dist = l.horiz ? Math.abs(this.player.y - l.pos) : Math.abs(this.player.x - l.pos);
        if (dist <= this.player.r * 0.72 + l.width * 0.45 && this.grace <= 0) {
          this.fx.burst(this.player.x, this.player.y, '#ef4444', 22, 230, 0.55, 4.5);
          this.shake = 10;
          this.die('Zapped by Brim’s grid! ⚡');
          return;
        }
        if (l.active <= 0) {
          this.score += 35;
          this.lasers.splice(i, 1);
        }
      }
    }

    // Update spinning sawblades (last 15s)
    this._updateSaws(dt, true);
  }

  _drawArenaBackdrop(ctx, animT) {
    const { W, H } = this;
    const isSurge = this._isSurgeActive();
    const hasSaws = this._areSawsActive();
    const bgImg = getArenaBgImage();

    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, 0, 0, W, H);
    } else {
      // Sunlit Weebl castle fallback if image is still decoding or headless SSR
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.28, '#bae6fd');
      skyGrad.addColorStop(0.32, '#84cc16');
      skyGrad.addColorStop(1, '#65a30d');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      drawSunburst(ctx, W * 0.5, ARENA.y + ARENA.h * 0.45, W * 0.85, animT * 0.25, 16, 0.16, isSurge);

      // Outer stone battlement frame
      drawComicPanel(ctx, ARENA.x - 14, ARENA.y - 14, ARENA.w + 28, ARENA.h + 28, 12, '#a8a29e', {
        borderColor: '#000000',
        borderWidth: 3.5,
      });

      // Checkerboard courtyard limestone tiles
      ctx.save();
      ctx.beginPath();
      ctx.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
      ctx.clip();
      const tile = 46;
      for (let row = 0; row * tile < ARENA.h; row++) {
        for (let col = 0; col * tile < ARENA.w; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#f5efe0' : '#e4d1aa';
          ctx.fillRect(ARENA.x + col * tile, ARENA.y + row * tile, tile, tile);
        }
      }
      ctx.restore();

      // Hazard border stroke
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    }

    // Subtle animated Weebl sky sunburst overlay in overdrive / saw phase
    if (isSurge || hasSaws) {
      const pulse = 0.12 + Math.sin(animT * 7) * 0.05;
      ctx.save();
      ctx.strokeStyle = hasSaws
        ? `rgba(239, 68, 68, ${(pulse + 0.35).toFixed(2)})`
        : `rgba(250, 204, 21, ${(pulse + 0.28).toFixed(2)})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(ARENA.x + 2, ARENA.y + 2, ARENA.w - 4, ARENA.h - 4);
      ctx.restore();
    }

    // Milestone screen flash overlay
    const flash = Math.max(this.surgeFlash, this.sawFlash);
    if (flash > 0.02) {
      ctx.fillStyle = this.sawFlash >= this.surgeFlash
        ? `rgba(239, 68, 68, ${(flash * 0.22).toFixed(2)})`
        : `rgba(250, 204, 21, ${(flash * 0.22).toFixed(2)})`;
      ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    }
  }

  _drawCollectible(ctx, o, animT) {
    const bob = Math.sin(o.pulse * 1.4) * 2.8;
    const pop = o.spawnT < 1 ? (0.4 + 0.6 * o.spawnT) : 1;
    const y = o.y + bob;

    drawToyShadow(ctx, o.x, o.y + 15, 11 * pop, 4.5 * pop, 0.28);

    ctx.save();
    ctx.translate(o.x, y);
    ctx.scale(pop, pop);

    if (o.gold) {
      // Spinning comic starburst aura + chunky golden crown coin
      drawComicStarburst(ctx, 0, 0, 19, 13, 8, 'rgba(253, 224, 71, 0.32)', 'rgba(245, 158, 11, 0.45)', animT * 1.6, 1.5);

      const coinGrad = ctx.createRadialGradient(-4, -5, 2, 0, 0, 14);
      coinGrad.addColorStop(0, '#fef08a');
      coinGrad.addColorStop(0.6, '#facc15');
      coinGrad.addColorStop(1, '#d97706');
      ctx.fillStyle = coinGrad;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Inner coin rim & crisp star stamp
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 8.8, 0, TAU);
      ctx.stroke();

      drawComicStarburst(ctx, 0, 0.5, 6.2, 2.8, 5, '#fef9c3', '#92400e', 0, 1.4);

      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(-4.5, -5.5, 3.4, 2, -0.5, 0, TAU);
      ctx.fill();
    } else {
      // Faceted Cyan Jelly Gem (hexagonal diamond with bold cel ink outline)
      const pulseR = 13.5 + Math.sin(o.pulse * 2) * 1.2;
      const gemGrad = ctx.createLinearGradient(-10, -12, 10, 12);
      gemGrad.addColorStop(0, '#a5f3fc');
      gemGrad.addColorStop(0.55, '#22d3ee');
      gemGrad.addColorStop(1, '#0284c7');

      ctx.fillStyle = gemGrad;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(0, -pulseR);
      ctx.lineTo(pulseR * 0.85, -pulseR * 0.25);
      ctx.lineTo(pulseR * 0.65, pulseR * 0.88);
      ctx.lineTo(-pulseR * 0.65, pulseR * 0.88);
      ctx.lineTo(-pulseR * 0.85, -pulseR * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Crisp inner crystal facets
      ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
      ctx.beginPath();
      ctx.moveTo(0, -pulseR + 2.5);
      ctx.lineTo(pulseR * 0.45, -pulseR * 0.15);
      ctx.lineTo(0, pulseR * 0.25);
      ctx.lineTo(-pulseR * 0.45, -pulseR * 0.15);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  _drawLaserCannon(ctx, cx, cy, aimAngle, chargeRatio, active, recoil, isDangerHue, animT) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(aimAngle);
    const kick = recoil * -5;
    const wobble = !active && chargeRatio > 0.65 ? Math.sin(animT * 55) * 1.4 : 0;
    ctx.translate(kick, wobble);

    // Barrel nozzle pointing right (+X toward arena interior)
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(4, -7.5, 13, 15, 3);
    ctx.fill();
    ctx.stroke();

    // Nozzle tip collar (gold hazard rim)
    ctx.fillStyle = active ? '#ef4444' : '#facc15';
    ctx.beginPath();
    ctx.roundRect(13, -8.5, 5, 17, 2);
    ctx.fill();
    ctx.stroke();

    // Chunky Brim-Tech rounded cannon turret pod
    const podGrad = ctx.createLinearGradient(0, -12, 0, 12);
    podGrad.addColorStop(0, '#64748b');
    podGrad.addColorStop(0.5, '#334155');
    podGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = podGrad;
    ctx.beginPath();
    ctx.roundRect(-13, -12, 21, 24, 6);
    ctx.fill();
    ctx.stroke();

    // Specular pill on cannon casing
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.roundRect(-10, -9.5, 14, 4, 2);
    ctx.fill();

    // Glowing plasma capacitor orb in cannon core
    const coreColor = active
      ? '#fef08a'
      : isDangerHue || chargeRatio > 0.68
        ? '#f97316'
        : '#38bdf8';
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(-2, 0, active ? 6.5 : 4 + chargeRatio * 2.2, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Muzzle blast comic starburst while firing
    if (active) {
      drawComicStarburst(ctx, 19, 0, 15, 7, 8, '#fde047', '#000000', animT * 9, 2.2);
    }

    ctx.restore();
  }

  _drawLaser(ctx, l, animT) {
    const x1 = l.horiz ? ARENA.x : l.pos;
    const y1 = l.horiz ? l.pos : ARENA.y;
    const x2 = l.horiz ? ARENA.x + ARENA.w : l.pos;
    const y2 = l.horiz ? l.pos : ARENA.y + ARENA.h;
    const angle1 = l.horiz ? 0 : Math.PI * 0.5;
    const angle2 = l.horiz ? Math.PI : -Math.PI * 0.5;

    if (l.warn > 0) {
      const progress = clamp(1 - l.warn / Math.max(0.01, l.maxWarn), 0, 1);
      const urgent = l.warn < 0.28;
      const blinkOn = !urgent || Math.floor(l.warn * 24) % 2 === 0;

      // Dark backing + crisp dashed sightline
      ctx.save();
      ctx.setLineDash([11, 8]);
      ctx.lineDashOffset = -animT * 55;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = urgent ? 6.5 : 5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.strokeStyle = urgent && blinkOn ? '#ef4444' : '#facc15';
      ctx.lineWidth = urgent ? 3.5 : 2.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      this._drawLaserCannon(ctx, x1, y1, angle1, progress, false, 0, l.hue === 'crimson', animT);
      this._drawLaserCannon(ctx, x2, y2, angle2, progress, false, 0, l.hue === 'crimson', animT);
    } else {
      const alpha = clamp(l.active / Math.max(0.01, l.maxActive), 0, 1);
      const beamW = l.width * (0.72 + Math.sin(animT * 60) * 0.14);

      ctx.save();
      ctx.globalAlpha = clamp(alpha * 1.3, 0, 1);
      ctx.lineCap = 'butt';

      // Bold Weebl cel-cartoon black outer stroke around beam
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = beamW + 6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Vibrant plasma outer body
      ctx.strokeStyle = l.hue === 'crimson' ? '#f43f5e' : '#ec4899';
      ctx.lineWidth = beamW;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // White-hot inner core
      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = beamW * 0.44;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Crisp crackling electric lightning zigzag inside the beam
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const segs = 12;
      const len = l.horiz ? ARENA.w : ARENA.h;
      for (let i = 0; i <= segs; i++) {
        const frac = i / segs;
        const jit = (i === 0 || i === segs) ? 0 : Math.sin(animT * 65 + i * 2.7 + l.boltSeed) * (beamW * 0.28);
        const px = l.horiz ? ARENA.x + len * frac : l.pos + jit;
        const py = l.horiz ? l.pos + jit : ARENA.y + len * frac;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      this._drawLaserCannon(ctx, x1, y1, angle1, 1, true, l.recoil, l.hue === 'crimson', animT);
      this._drawLaserCannon(ctx, x2, y2, angle2, 1, true, l.recoil, l.hue === 'crimson', animT);
    }
  }

  _drawSawblade(ctx, s, animT) {
    const teeth = 10;
    const isWarn = s.warn > 0;
    const scale = isWarn ? clamp(1.15 - (s.warn / Math.max(0.01, s.maxWarn)) * 0.45, 0.55, 1.0) : (1 + s.bouncePulse * 0.1);
    const outerR = s.r + 4.5;
    const innerR = s.r - 4;

    if (isWarn) {
      // Flashing hazard drop zone target before saw activates
      const blink = Math.floor(s.warn * 16) % 2 === 0;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.strokeStyle = blink ? '#ef4444' : '#facc15';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, s.r + 8, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      drawComicStarburst(ctx, 0, 0, s.r + 3, s.r - 5, 8, 'rgba(239, 68, 68, 0.25)', '#000000', -animT * 5, 2);
      ctx.restore();
    } else {
      drawToyShadow(ctx, s.x + 2, s.y + 8, s.r * 0.9, s.r * 0.38, 0.3);
    }

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = isWarn ? 0.65 : 1;

    // Translucent spin blur motion arcs around the blade
    if (!isWarn) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a0 = animT * 10 * s.spinDir + i * (TAU / 3);
        ctx.beginPath();
        ctx.arc(0, 0, outerR + 3.5, a0, a0 + 0.85);
        ctx.stroke();
      }
    }

    // Rotating serrated steel circular blade with Weebl #000 ink outline
    ctx.save();
    ctx.rotate(s.rot);

    const steelGrad = ctx.createRadialGradient(-4, -4, 3, 0, 0, outerR);
    steelGrad.addColorStop(0, '#f8fafc');
    steelGrad.addColorStop(0.55, '#cbd5e1');
    steelGrad.addColorStop(1, '#64748b');

    ctx.fillStyle = steelGrad;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const baseA = (i / teeth) * TAU;
      const tipA = baseA + (0.28 / teeth) * TAU * s.spinDir;
      const valleyA = baseA + (0.72 / teeth) * TAU * s.spinDir;
      const vx0 = Math.cos(baseA) * innerR;
      const vy0 = Math.sin(baseA) * innerR;
      const tx = Math.cos(tipA) * outerR;
      const ty = Math.sin(tipA) * outerR;
      const vx1 = Math.cos(valleyA) * innerR;
      const vy1 = Math.sin(valleyA) * innerR;
      if (i === 0) ctx.moveTo(vx0, vy0);
      else ctx.lineTo(vx0, vy0);
      ctx.lineTo(tx, ty);
      ctx.lineTo(vx1, vy1);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner crescent steel sheen
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, innerR - 2.5, -0.8, 1.4);
    ctx.stroke();

    // Crimson danger ring + yellow bolted center hub
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, 5.8, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // 4 tiny dark hub rivets
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < 4; i++) {
      const ra = (i * TAU) / 4;
      ctx.beginPath();
      ctx.arc(Math.cos(ra) * 8.1, Math.sin(ra) * 8.1, 1.15, 0, TAU);
      ctx.fill();
    }

    ctx.restore();

    if (isWarn) {
      drawComicText(ctx, 'SAW!', 0, -s.r - 12, "900 11px 'Fredoka', 'Outfit', sans-serif", '#fef08a', {
        strokeWidth: 4,
      });
    }

    ctx.restore();
  }

  _drawPlayer(ctx, animT) {
    // Detect immediate nearby danger so hero reacts expressively
    let dangerNear = false;
    for (const l of this.lasers) {
      if (l.warn <= 0.18) {
        const d = l.horiz ? Math.abs(this.player.y - l.pos) : Math.abs(this.player.x - l.pos);
        if (d < 46) { dangerNear = true; break; }
      }
    }
    if (!dangerNear) {
      for (const s of this.saws) {
        if (s.warn <= 0 && Math.hypot(this.player.x - s.x, this.player.y - s.y) < 72) {
          dangerNear = true;
          break;
        }
      }
    }

    ctx.save();
    if (this.grace > 0 && Math.floor(this.grace * 14) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    drawToyShadow(ctx, this.player.x, this.player.y + 21, 19, 7, 0.36);

    if (this.grace > 0) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y + 2, 26, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const lean = clamp(this.player.vx * 0.001, -0.25, 0.25);
    const expr = this.dead ? 'dizzy' : (dangerNear || this._areSawsActive()) ? 'panic' : 'happy';
    const state = this.dead ? 'dead' : this.player.moving ? 'hop_leap' : 'stand_alert';

    drawHeroCharacter(ctx, this.player.x, this.player.y + 21, 56, {
      view: 'threeQuarterFront',
      dir: this.player.dir,
      state,
      expr,
      t: this.player.moving ? this.player.walkT * 4.5 : animT * 3.5,
      lean,
      lookX: clamp(this.player.vx * 0.004, -0.75, 0.75),
      squashX: 2 - clamp(this.player.squash, 0.85, 1.25),
      squashY: clamp(this.player.squash, 0.85, 1.25),
    });
    ctx.restore();
  }

  _drawHudPills(ctx, animT) {
    const elapsed = this._elapsedSeconds();
    const isSurge = this._isSurgeActive();
    const hasSaws = this._areSawsActive();
    const pillY = ARENA.y + 8;

    const hudText = this.streak > 1 ? `🔥 ${this.streak}x · LV.${this.level}` : `⚡ GRID LV.${this.level}`;
    const pillW = Math.min(138, 76 + hudText.length * 4.2);
    drawComicPanel(ctx, ARENA.x + 8, pillY, pillW, 27, 13, '#0f172a', {
      borderColor: '#000000',
      borderWidth: 2.8,
      shadowOffset: 3,
      shadowColor: 'rgba(0,0,0,0.4)',
    });
    drawComicText(ctx, hudText, ARENA.x + 8 + pillW / 2, pillY + 14.5, "900 11.5px 'Fredoka', 'Outfit', sans-serif", this.streak > 1 ? '#fde047' : '#ffffff', {
      strokeWidth: 3.5,
    });

    // Right status pill showing +25% surge & Final 15s spinning saws countdown/status
    let phaseTxt;
    let phaseBg;
    let phaseInk;
    if (hasSaws) {
      const rem = Math.max(0, Math.ceil(60 - elapsed));
      const blinkRed = Math.sin(animT * 10) > 0;
      phaseTxt = `🪚 SAWS! ${rem}s`;
      phaseBg = blinkRed ? '#dc2626' : '#991b1b';
      phaseInk = '#fef08a';
    } else if (isSurge) {
      const toSaws = Math.max(1, Math.ceil(SAW_TIME_S - elapsed));
      phaseTxt = `🪚 SAWS IN ${toSaws}s`;
      phaseBg = '#ea580c';
      phaseInk = '#fef9c3';
    } else {
      const rem = Math.max(1, Math.ceil(SURGE_TIME_S - elapsed));
      phaseTxt = `⚡ +25% IN ${rem}s`;
      phaseBg = '#1e293b';
      phaseInk = '#bae6fd';
    }

    const phaseW = 128;
    const phaseX = ARENA.x + ARENA.w - phaseW - 8;
    drawComicPanel(ctx, phaseX, pillY, phaseW, 27, 13, phaseBg, {
      borderColor: '#000000',
      borderWidth: 2.8,
      shadowOffset: 3,
      shadowColor: 'rgba(0,0,0,0.4)',
    });
    drawComicText(ctx, phaseTxt, phaseX + phaseW / 2, pillY + 14.5, "900 10.5px 'Fredoka', 'Outfit', sans-serif", phaseInk, {
      strokeWidth: 3.5,
    });
  }

  render() {
    const ctx = this.ctx;
    const animT = Math.max(this.time || 0, this.roundElapsed);

    ctx.save();
    if (this.shake > 0.2) {
      const sx = (Math.random() - 0.5) * this.shake;
      const sy = (Math.random() - 0.5) * this.shake;
      ctx.translate(sx, sy);
    }

    this._drawArenaBackdrop(ctx, animT);

    // Draw sparks & dust puffs on the tiles
    for (const p of this.sparks) {
      const a = clamp(p.life / Math.max(0.01, p.maxLife), 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.6, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    for (const o of this.orbs) {
      this._drawCollectible(ctx, o, animT);
    }

    // Draw warning beams under player/saws, then cannons & active beams
    for (const l of this.lasers) {
      if (l.warn > 0) this._drawLaser(ctx, l, animT);
    }

    this._drawPlayer(ctx, animT);

    for (const l of this.lasers) {
      if (l.warn <= 0) this._drawLaser(ctx, l, animT);
    }

    for (const s of this.saws) {
      this._drawSawblade(ctx, s, animT);
    }

    this._drawHudPills(ctx, animT);

    this.fx.render(ctx);
    ctx.restore();
  }

  serialize() {
    return { x: this.player.x, y: this.player.y, level: this.level, streak: this.streak };
  }

  restoreLabel() {
    return `Grid Lv.${this.level} · Streak ${this.streak}`;
  }
}
