import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import {
  STYLE_TOKENS,
  preloadWeeblAtlas,
  drawSprite,
  drawSunburst,
  drawComicPanel,
  drawComicText as _rawDrawComicText,
  drawWeeblCelBean,
  drawHeroCharacter,
} from './weeblAtlas.js';

const TAU = Math.PI * 2;
const GRAVITY = 1150;
const JUMP_VELOCITY = -680;
const SPRING_VELOCITY = -1050;
const TRAMPOLINE_VELOCITY = -1320;
const JETPACK_VELOCITY = -1180;
const PROPELLER_VELOCITY = -520;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const CLIMB_ZONES = [
  { name: 'ALBERT DOCK', minM: 0, skyTop: '#2563eb', skyMid: '#38bdf8', skyBot: '#fef08a' },
  { name: 'CANDY CLOUDS', minM: 160, skyTop: '#0284c7', skyMid: '#ec4899', skyBot: '#fde68a' },
  { name: 'AURORA PEAKS', minM: 360, skyTop: '#0f172a', skyMid: '#0d9488', skyBot: '#38bdf8' },
  { name: 'COSMIC ORBIT', minM: 600, skyTop: '#09061a', skyMid: '#1e1b4b', skyBot: '#4c1d95' },
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(a, b, t) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/* ------------------------------------------------------------ 2x PNG Bitmap Comic Text Cache (60 FPS) */
const TEXT_STAMP_CACHE = new Map();
const TEXT_STAMP_MAX = 180;
let _measureCtx = null;

function drawComicText(ctx, text, x, y, font, fill = '#ffffff', opts = {}) {
  const canCache =
    typeof ctx.drawImage === 'function' &&
    typeof document !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof Image !== 'undefined';

  if (!canCache) {
    _rawDrawComicText(ctx, text, x, y, font, fill, opts);
    return;
  }

  const label = String(text);
  const strokeCol = opts.stroke || '#000000';
  const strokeW = opts.strokeWidth ?? 4.0;
  const shadowTag = opts.shadow ? `${opts.shadowDx ?? 2},${opts.shadowDy ?? 2.5}` : '';
  const key = `${label}|${font}|${fill}|${strokeCol}|${strokeW}|${shadowTag}`;

  let entry = TEXT_STAMP_CACHE.get(key);
  if (!entry) {
    if (!_measureCtx) {
      const mc = document.createElement('canvas');
      mc.width = 4; mc.height = 4;
      _measureCtx = mc.getContext?.('2d') || null;
    }
    const c = document.createElement('canvas');
    const sctx = c.getContext?.('2d');
    if (!_measureCtx || !sctx || typeof c.toDataURL !== 'function') {
      _rawDrawComicText(ctx, label, x, y, font, fill, opts);
      return;
    }

    _measureCtx.font = font;
    const tw = Math.max(4, Math.ceil(_measureCtx.measureText(label).width));
    const fhMatch = /([\d.]+)px/.exec(font);
    const fh = fhMatch ? Math.ceil(parseFloat(fhMatch[1])) : 18;
    const pad = Math.ceil(strokeW + 8);
    const w = tw + pad * 2;
    const h = Math.max(12, Math.ceil(fh * 1.45) + pad * 2);

    c.width = w * 2;
    c.height = h * 2;
    sctx.scale(2, 2);
    _rawDrawComicText(sctx, label, w * 0.5, h * 0.5, font, fill, {
      ...opts,
      align: 'center',
      baseline: 'middle',
    });

    const img = new Image();
    img.decoding = 'async';
    img.src = c.toDataURL('image/png');
    img.decode?.().catch(() => { });

    entry = { img, w, h, pad };
    if (TEXT_STAMP_CACHE.size >= TEXT_STAMP_MAX) {
      const oldest = TEXT_STAMP_CACHE.keys().next().value;
      if (oldest !== undefined) TEXT_STAMP_CACHE.delete(oldest);
    }
    TEXT_STAMP_CACHE.set(key, entry);
  } else {
    TEXT_STAMP_CACHE.delete(key);
    TEXT_STAMP_CACHE.set(key, entry);
  }

  if (entry.img.complete && entry.img.naturalWidth > 0) {
    const align = opts.align || 'center';
    const dx = align === 'left'
      ? x - entry.pad
      : align === 'right'
        ? x - (entry.w - entry.pad)
        : x - entry.w * 0.5;
    const dy = y - entry.h * 0.5;
    ctx.drawImage(entry.img, dx, dy, entry.w, entry.h);
  } else {
    _rawDrawComicText(ctx, label, x, y, font, fill, opts);
  }
}

export class DoodleJump extends Game {
  static meta = {
    id: 'doodle-jump',
    title: 'Doodle Bean Jump',
    icon: '🦘',
    hint: 'A/D or DRAG to steer · BOUNCE on platforms · TAP to shoot monsters · grab Jetpacks!',
    baseLikes: 5840,
    isPrestige: false,
    parScore60s: 1500,
    cue: 'BOUNCE HIGHER!',
    prestigeCue: 'MORE MONSTERS · FASTER PLATFORMS!',
    scaling: {
      platSpeedMult: { base: 1.0, rate: 0.16, cap: 1.60, mode: 'up', label: 'Platform Speed' },
      movingBonus: { base: 0.0, rate: 0.18, cap: 0.20, mode: 'up', deltaFormat: 'abs', unit: '%', label: 'Moving Plats' },
      monsterMult: { base: 1.0, rate: 0.18, cap: 1.65, mode: 'up', label: 'Monsters' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    preloadWeeblAtlas();
    this.t = 0;

    // Player Physics & State
    this.x = (saved && Number.isFinite(saved.x)) ? clamp(saved.x, 30, this.W - 30) : this.W / 2;
    this.camY = (saved && Number.isFinite(saved.camY)) ? saved.camY : 0;
    const rawY = (saved && Number.isFinite(saved.y)) ? saved.y : this.H - 120;
    this.y = saved ? Math.min(rawY, this.camY + this.H - 125) : rawY;
    this.prevY = this.y;
    this.vx = 0;
    const rawVy = (saved && Number.isFinite(saved.vy)) ? saved.vy : JUMP_VELOCITY;
    this.vy = saved ? Math.min(rawVy, JUMP_VELOCITY * 0.68) : rawVy;
    this.w = 34;
    this.h = 42;
    this.dir = 1;
    this.squash = 1;
    this.altitude = (saved && Number.isFinite(saved.altitude)) ? saved.altitude : 0;
    this.maxAltitude = (saved && Number.isFinite(saved.maxAltitude)) ? saved.maxAltitude : 0;
    this.recoilT = 0;
    this.lastSolidY = this.y;

    // Active Equipment
    this.powerup = saved?.powerup || null; // 'propeller' | 'jetpack' | 'shield'
    this.powerupTimer = (saved && Number.isFinite(saved.powerupTimer)) ? saved.powerupTimer : 0;
    this.hasShield = Boolean(saved?.hasShield);

    // World Elements
    this.platforms = [];
    this.monsters = [];
    this.bullets = [];
    this.blackHoles = [];
    this.milestoneBanners = [];
    this.highestGeneratedY = this.H;

    // Drifting Weebl Clouds
    this.clouds = [
      { x: 64, y: 158, w: 94, h: 54, speed: 10, kind: 'cloud_1' },
      { x: 310, y: 270, w: 84, h: 48, speed: 7, kind: 'cloud_2' },
      { x: 135, y: 420, w: 102, h: 58, speed: 12, kind: 'cloud_1' },
      { x: 345, y: 585, w: 78, h: 45, speed: 9, kind: 'cloud_2' },
    ];

    // Initial seed platforms
    if (saved && saved.platforms && saved.platforms.length > 0) {
      this.platforms = saved.platforms.filter(
        (p) => p && Number.isFinite(p.y) && p.y <= this.camY + this.H + 90 && (!p.broken || p.breakProgress < 1)
      );
      this.monsters = saved.monsters || [];
      this.blackHoles = saved.blackHoles || [];
      const minSavedY = this.platforms.length
        ? Math.min(...this.platforms.map((p) => p.y))
        : this.y - 200;
      this.highestGeneratedY = Number.isFinite(saved.highestGeneratedY)
        ? Math.min(saved.highestGeneratedY, minSavedY)
        : minSavedY;
    } else {
      // Wide solid starting home platform directly beneath Bean
      this.platforms.push({
        x: this.W / 2 - 62,
        y: this.H - 64,
        w: 124,
        h: 18,
        type: 'standard',
        item: null,
        broken: false,
        squishT: 0,
      });
      this.lastSolidY = this.H - 64;

      // Guaranteed reachable solid first upper rung before procedural climb
      this.platforms.push({
        x: clamp(this.W / 2 - 44 + rand(-55, 55), 20, this.W - 108),
        y: this.H - 142,
        w: 88,
        h: 18,
        type: 'standard',
        item: null,
        broken: false,
        squishT: 0,
      });
      this.lastSolidY = this.H - 142;
      this.highestGeneratedY = this.H - 142;

      // Seed ladder of introductory platforms
      for (let y = this.H - 210; y > -520; y -= rand(55, 82)) {
        this.spawnPlatformAt(y);
      }
    }

    // Guarantee a solid non-brittle platform directly under the Hero on BOTH start & resume
    this.ensureSafeFloorPlatform();
    this.generateWorldAhead();

    this.grace = saved ? 2.0 : 1.6;
  }

  /**
   * Ensures there is always a solid bounceable platform directly beneath the player
   * so neither fresh starts nor resumed reels can drop straight into an empty void.
   */
  ensureSafeFloorPlatform() {
    const floorMaxY = this.camY + this.H - 28;
    const minBelowY = this.y + this.h * 0.45 + 10;
    const targetY = clamp(this.y + 68, Math.max(minBelowY, this.camY + this.H * 0.56), floorMaxY);

    const hasCatchUnderPlayer = this.platforms.some(
      (p) =>
        !p.broken &&
        p.type !== 'brittle' &&
        p.y >= minBelowY - 8 &&
        p.y <= floorMaxY &&
        this.x >= p.x - 10 &&
        this.x <= p.x + p.w + 10
    );

    if (!hasCatchUnderPlayer) {
      const pw = 112;
      this.platforms.unshift({
        x: clamp(this.x - pw * 0.5, 16, this.W - pw - 16),
        y: targetY,
        w: pw,
        h: 18,
        type: 'standard',
        item: null,
        broken: false,
        breakProgress: 0,
        squishT: 0,
        vx: 0,
        vy: 0,
        startY: targetY,
        rangeY: 0,
      });
    }

    // Ensure lower half of viewport has an extra solid landing stepping stone
    const hasLowerSupport = this.platforms.some(
      (p) => !p.broken && p.type !== 'brittle' && p.y >= this.camY + this.H * 0.62 && p.y <= floorMaxY
    );
    if (!hasLowerSupport) {
      const stepY = clamp(targetY - 76, this.camY + this.H * 0.52, floorMaxY - 40);
      const pw = 96;
      this.platforms.unshift({
        x: clamp(this.x - pw * 0.5 + (this.x > this.W * 0.5 ? -70 : 70), 18, this.W - pw - 18),
        y: stepY,
        w: pw,
        h: 18,
        type: 'standard',
        item: null,
        broken: false,
        breakProgress: 0,
        squishT: 0,
        vx: 0,
        vy: 0,
        startY: stepY,
        rangeY: 0,
      });
    }
  }

  serialize() {
    const activePlats = this.platforms
      .filter((p) => p && (!p.broken || p.breakProgress < 1) && p.y >= this.camY - 850 && p.y <= this.camY + this.H + 80)
      .sort((a, b) => b.y - a.y);
    return {
      x: Math.round(this.x),
      y: Math.round(this.y),
      vy: Math.round(this.vy),
      camY: Math.round(this.camY),
      altitude: Math.round(this.altitude),
      maxAltitude: Math.round(this.maxAltitude),
      powerup: this.powerup,
      powerupTimer: this.powerupTimer,
      hasShield: this.hasShield,
      highestGeneratedY: Math.round(this.highestGeneratedY),
      // Keep bottom-most to top viewport platforms first (max 48) so floor/catch rungs are never sliced off
      platforms: activePlats.slice(0, 48),
      monsters: this.monsters.slice(-6),
      blackHoles: this.blackHoles.slice(-3),
    };
  }

  restoreLabel() {
    return `Altitude: ${Math.round(this.maxAltitude)}m`;
  }

  /* ------------------------------------------------------------ Procedural Spawning */
  spawnPlatformAt(y) {
    const diff = Math.min(1, Math.max(0, -y / 12000));
    const roll = Math.random();
    let type = 'standard';
    let item = null;

    // Never allow a brittle chasm > 135px without a solid bounceable platform, nor brittle in opening zone
    const needsSolid = y > this.H - 340 || (this.lastSolidY - y) >= 130;
    if (!needsSolid) {
      if (roll < 0.22 + diff * 0.25 + (this.diff.movingBonus || 0)) {
        type = 'moving';
      } else if (roll < 0.35 + diff * 0.15 + (this.diff.movingBonus || 0) * 0.5) {
        type = 'brittle';
      } else if (roll < 0.45 + diff * 0.1) {
        type = 'vanishing';
      } else if (roll < 0.52 + diff * 0.1) {
        type = 'vertical';
      }
    } else if (y <= this.H - 340 && roll < 0.22 + diff * 0.20) {
      type = 'moving';
    }

    if (type !== 'brittle') {
      this.lastSolidY = y;
    }

    const pw = type === 'standard' ? rand(74, 88) : rand(64, 78);
    const px = rand(15, this.W - pw - 15);

    if ((type === 'standard' || type === 'moving') && Math.random() < 0.36) {
      const itemRoll = Math.random();
      if (itemRoll < 0.42) item = 'spring';
      else if (itemRoll < 0.68) item = 'trampoline';
      else if (itemRoll < 0.86) item = 'propeller';
      else if (itemRoll < 0.95) item = 'jetpack';
      else item = 'shield';
    }

    const plat = {
      x: px,
      y,
      w: pw,
      h: 18,
      type,
      item,
      broken: false,
      breakProgress: 0,
      squishT: 0,
      vx: type === 'moving' ? (Math.random() < 0.5 ? 1 : -1) * rand(85, 140) * (this.diff.platSpeedMult ?? 1) : 0,
      vy: type === 'vertical' ? (Math.random() < 0.5 ? 1 : -1) * rand(55, 95) * (this.diff.platSpeedMult ?? 1) : 0,
      startY: y,
      rangeY: 50,
    };
    this.platforms.push(plat);

    // Chance to spawn Balloon Imp / UFO well above opening climb height
    if (Math.random() < (0.11 + diff * 0.18) * (this.diff.monsterMult ?? 1) && y < -220) {
      const mx = clamp(px + pw / 2 + rand(-60, 60), 45, this.W - 45);
      const my = y - rand(60, 100);
      if (!this.monsters.some((m) => Math.hypot(m.x - mx, m.y - my) < 95)) {
        this.monsters.push({
          x: mx,
          y: my,
          r: 24,
          type: Math.random() < 0.38 ? 'ufo' : 'goblin',
          color: Math.random() < 0.5 ? '#f43f5e' : '#8b5cf6',
          vx: (Math.random() < 0.5 ? 40 : -40) * (this.diff.platSpeedMult ?? 1),
          hp: 1,
          rot: 0,
        });
      }
    }

    // Occasional Cosmic Black Hole hazard
    if (Math.random() < (0.04 + diff * 0.05) * (this.diff.monsterMult ?? 1) && y < -700) {
      const bx = rand(70, this.W - 70);
      const by = y - rand(75, 115);
      this.blackHoles.push({ x: bx, y: by, r: 26, rot: 0 });
    }

    // Milestone Banners at key heights (every 1000px = 100m)
    const mDist = Math.round(-y / 10);
    if (mDist > 0 && mDist % 100 === 0 && !this.milestoneBanners.some((b) => Math.abs(b.y - y) < 150)) {
      let bannerTitle = `${mDist}m · DOCK ROOFTOPS`;
      if (mDist >= 600) bannerTitle = `${mDist}m · COSMIC ORBIT`;
      else if (mDist >= 360) bannerTitle = `${mDist}m · AURORA PEAKS`;
      else if (mDist >= 160) bannerTitle = `${mDist}m · CANDY CLOUDS`;

      this.milestoneBanners.push({ y, m: mDist, title: bannerTitle, celebrated: false });
    }

    this.highestGeneratedY = Math.min(this.highestGeneratedY, y);
  }

  generateWorldAhead() {
    const targetY = this.camY - 750;
    while (this.highestGeneratedY > targetY) {
      const step = rand(58, 86);
      this.spawnPlatformAt(this.highestGeneratedY - step);
    }
  }

  /* ------------------------------------------------------------ Main Update Loop */
  update(dt) {
    this.t += dt;
    if (this.grace > 0) this.grace = Math.max(0, this.grace - dt);
    if (this.recoilT > 0) this.recoilT -= dt;

    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > this.W + c.w) c.x = -c.w;
    }

    // Powerup Timer & Flight Physics
    if (this.powerup === 'jetpack') {
      this.powerupTimer -= dt;
      this.vy = JETPACK_VELOCITY;
      this.squash = 1.25;
      if (Math.random() < 0.55) {
        this.fx.burst(this.x - 14, this.y + 24, '#f97316', 4, 180, 0.35, 4, 250);
        this.fx.burst(this.x + 14, this.y + 24, '#facc15', 4, 180, 0.35, 4, 250);
      }
      if (this.powerupTimer <= 0) {
        this.powerup = null;
        this.vy = JUMP_VELOCITY * 0.8;
      }
    } else if (this.powerup === 'propeller') {
      this.powerupTimer -= dt;
      this.vy = PROPELLER_VELOCITY;
      this.squash = 1.15;
      if (Math.random() < 0.35) {
        this.fx.burst(this.x, this.y - 32, '#38bdf8', 2, 90, 0.25, 2.5);
      }
      if (this.powerupTimer <= 0) {
        this.powerup = null;
        this.vy = JUMP_VELOCITY * 0.7;
      }
    } else {
      this.vy += GRAVITY * dt;
    }

    // Horizontal Controls
    let moveX = 0;
    if (this.input.down) {
      const dx = this.input.x - this.x;
      this.x += dx * Math.min(1, dt * 18);
      if (Math.abs(dx) > 3) this.dir = dx > 0 ? 1 : -1;
    } else {
      if (this.input.key('arrowleft', 'a')) moveX -= 400;
      if (this.input.key('arrowright', 'd')) moveX += 400;
      if (this.input.frameDX) moveX += this.input.frameDX * 20;

      this.vx += (moveX - this.vx) * Math.min(1, dt * 14);
      this.x += this.vx * dt;
      if (Math.abs(this.vx) > 15) this.dir = this.vx > 0 ? 1 : -1;
    }

    // Seamless Screen Wrap
    const margin = 22;
    if (this.x < -margin) this.x = this.W + margin;
    else if (this.x > this.W + margin) this.x = -margin;

    this.prevY = this.y;
    this.y += this.vy * dt;
    this.squash += (1 - this.squash) * Math.min(1, dt * 12);

    // Shooting Action
    if (this.input.pressed && this.input.y < this.H * 0.65) {
      this.shootBullet(this.input.x, this.input.y);
    } else if (this.input.key('arrowup', 'w', ' ')) {
      if (!this.lastShootT || this.t - this.lastShootT > 0.22) {
        this.shootBullet(this.x, this.y - 120);
        this.lastShootT = this.t;
      }
    }

    this.updateBullets(dt);
    this.updatePlatforms(dt);
    this.updateMonsters(dt);

    if (this.vy > 0 && !this.powerup) {
      this.checkPlatformCollisions();
    }

    // Camera Scrolling & Altitude Tracking
    const cameraThreshold = this.camY + this.H * 0.46;
    if (this.y < cameraThreshold) {
      this.camY -= cameraThreshold - this.y;
    }

    this.altitude = Math.max(0, -this.camY / 10);
    if (this.altitude > this.maxAltitude) {
      const diff = this.altitude - this.maxAltitude;
      this.maxAltitude = this.altitude;
      this.score += diff * 1.5;
    }

    for (const b of this.milestoneBanners) {
      if (!b.celebrated && this.y <= b.y) {
        b.celebrated = true;
        this.score += 250;
        this.sounds.up();
        this.haptics.medium();
        this.fx.text(this.W / 2, this.y - 40, `${b.title}! +250`, '#fde047', 26, 1.3);
        this.fx.burst(this.W / 2, this.y, '#facc15', 30, 260, 0.7, 5);
        this.fx.ring(this.W / 2, this.y, '#38bdf8', 220, 0.6, 5);
      }
    }

    this.generateWorldAhead();

    const despawnFloor = this.camY + this.H + 120;
    this.platforms = this.platforms.filter((p) => p.y < despawnFloor && (!p.broken || p.breakProgress < 1));
    this.monsters = this.monsters.filter((m) => m.y < despawnFloor);
    this.blackHoles = this.blackHoles.filter((b) => b.y < despawnFloor);
    this.milestoneBanners = this.milestoneBanners.filter((b) => b.y < despawnFloor);

    if (this.y > this.camY + this.H + 10 && this.grace > 0 && !this.dead) {
      this.y = this.camY + this.H - 30;
      this.prevY = this.y;
      this.vy = JUMP_VELOCITY;
      this.squash = 1.25;
      this.ensureSafeFloorPlatform();
      this.sounds.pop?.();
    } else if (this.y > this.camY + this.H + 40 && !this.dead) {
      if (this.die('Plummeted into the docklands abyss!')) {
        this.sounds.fail();
        this.haptics.heavy();
        this.fx.shake(16, 0.55);
      }
    }

    this.fx.update(dt);
  }

  /* ------------------------------------------------------------ Combat & Projectiles */
  shootBullet(targetX, targetY) {
    const angle = Math.atan2(targetY - (this.y - 24), targetX - this.x);
    const speed = 950;
    this.recoilT = 0.14;

    this.bullets.push({
      x: this.x,
      y: this.y - 28,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.2,
    });

    this.sounds.slice();
    this.haptics.light();
    this.fx.burst(this.x, this.y - 28, '#fde047', 6, 140, 0.25, 3.5);
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      for (const m of this.monsters) {
        if (m.hp > 0 && Math.hypot(m.x - b.x, m.y - b.y) < m.r + 10) {
          m.hp = 0;
          b.life = 0;
          this.score += 450;
          this.sounds.hit();
          this.haptics.medium();
          this.fx.text(m.x, m.y, 'POW! +450', '#fde047', 24, 1.1);
          this.fx.burst(m.x, m.y, m.color, 28, 260, 0.65, 5);
          this.fx.ring(m.x, m.y, '#facc15', 100, 0.45, 5);
          this.fx.shake(8, 0.25);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  /* ------------------------------------------------------------ Platform Logic */
  updatePlatforms(dt) {
    for (const p of this.platforms) {
      if (p.squishT > 0) p.squishT -= dt * 4;

      if (p.type === 'moving') {
        p.x += p.vx * dt;
        if (p.x < 15) {
          p.x = 15;
          p.vx = Math.abs(p.vx);
        } else if (p.x + p.w > this.W - 15) {
          p.x = this.W - 15 - p.w;
          p.vx = -Math.abs(p.vx);
        }
      } else if (p.type === 'vertical') {
        p.y += p.vy * dt;
        if (p.y < p.startY - p.rangeY) {
          p.y = p.startY - p.rangeY;
          p.vy = Math.abs(p.vy);
        } else if (p.y > p.startY + p.rangeY) {
          p.y = p.startY + p.rangeY;
          p.vy = -Math.abs(p.vy);
        }
      }
      if (p.broken) {
        p.breakProgress += dt * 3.5;
        p.y += dt * 300;
      }
    }
  }

  checkPlatformCollisions() {
    const feetY = this.y + this.h * 0.45;
    const feetPrevY = (Number.isFinite(this.prevY) ? this.prevY : this.y) + this.h * 0.45 - 2;

    for (const p of this.platforms) {
      if (p.broken) continue;

      const platTop = p.y;
      const isOver = this.x >= p.x - 14 && this.x <= p.x + p.w + 14;

      if (isOver && feetPrevY <= platTop + 6 && feetY >= platTop - 6) {
        if (p.type === 'brittle') {
          p.broken = true;
          this.sounds.hit();
          this.haptics.heavy();
          this.fx.burst(p.x + p.w / 2, p.y, '#b45309', 18, 180, 0.45, 4.5);
          this.fx.shake(6, 0.22);
          continue;
        }

        p.squishT = 1.0;

        if (p.item) {
          if (p.item === 'spring') {
            this.vy = SPRING_VELOCITY;
            this.squash = 0.55;
            this.sounds.stack(2);
            this.haptics.heavy();
            this.fx.text(this.x, this.y - 30, 'SPRING BOUNCE!', '#38bdf8', 26, 1.0);
            this.fx.burst(this.x, p.y, '#38bdf8', 20, 220, 0.55, 4.5);
            this.fx.ring(this.x, p.y, '#38bdf8', 110, 0.45, 5);
            p.item = null;
            return;
          } else if (p.item === 'trampoline') {
            this.vy = TRAMPOLINE_VELOCITY;
            this.squash = 0.42;
            this.sounds.stack(4);
            this.haptics.heavy();
            this.fx.text(this.x, this.y - 30, 'SUPER BOUNCE!', '#facc15', 28, 1.2);
            this.fx.burst(this.x, p.y, '#facc15', 26, 280, 0.65, 5);
            this.fx.ring(this.x, p.y, '#facc15', 150, 0.55, 6);
            p.item = null;
            return;
          } else if (p.item === 'jetpack') {
            this.powerup = 'jetpack';
            this.powerupTimer = 4.5;
            this.sounds.up();
            this.haptics.heavy();
            this.fx.text(this.x, this.y - 30, 'ROCKET JETPACK!', '#f97316', 32, 1.4);
            this.fx.ring(this.x, this.y, '#f97316', 180, 0.65, 6);
            p.item = null;
            return;
          } else if (p.item === 'propeller') {
            this.powerup = 'propeller';
            this.powerupTimer = 4.0;
            this.sounds.slice();
            this.haptics.medium();
            this.fx.text(this.x, this.y - 30, 'PROPELLER BEANIE!', '#38bdf8', 28, 1.1);
            p.item = null;
            return;
          } else if (p.item === 'shield') {
            this.hasShield = true;
            this.sounds.up();
            this.haptics.medium();
            this.fx.text(this.x, this.y - 30, 'BUBBLE SHIELD!', '#c084fc', 26, 1.0);
            p.item = null;
          }
        }

        if (p.type === 'vanishing') {
          p.broken = true;
          this.fx.burst(p.x + p.w / 2, p.y, '#c084fc', 16, 160, 0.45, 3.5);
        }

        this.vy = JUMP_VELOCITY;
        this.squash = 0.65;
        this.y = platTop - this.h * 0.45;
        this.sounds.bubble(1.2);
        this.haptics.light();
        this.fx.burst(this.x, platTop, '#4ade80', 10, 140, 0.35, 3.5);
        this.fx.ring(this.x, platTop, '#4ade80', 60, 0.35, 3.5);
        break;
      }
    }
  }

  /* ------------------------------------------------------------ Monsters & Hazards */
  updateMonsters(dt) {
    for (const m of this.monsters) {
      if (m.hp <= 0) continue;
      m.x += m.vx * dt;
      if (m.x < 40 || m.x > this.W - 40) m.vx = -m.vx;

      const d = Math.hypot(m.x - this.x, m.y - this.y);

      if (d < m.r + 22 && (this.powerup === 'jetpack' || this.powerup === 'propeller')) {
        m.hp = 0;
        this.score += 500;
        this.sounds.hit();
        this.fx.text(m.x, m.y, 'SMASHED! +500', '#facc15', 26, 1.1);
        this.fx.burst(m.x, m.y, m.color, 28, 260, 0.65, 5);
        continue;
      }

      if (this.vy > 0 && this.y + this.h * 0.45 < m.y && d < m.r + 26) {
        m.hp = 0;
        this.vy = JUMP_VELOCITY * 1.15;
        this.squash = 0.58;
        this.score += 500;
        this.sounds.hit();
        this.haptics.heavy();
        this.fx.text(m.x, m.y, 'HEAD STOMP! +500', '#38bdf8', 28, 1.2);
        this.fx.burst(m.x, m.y, m.color, 30, 280, 0.7, 5.5);
        continue;
      }

      if (d < m.r + 15 && !this.dead && this.grace <= 0) {
        if (this.hasShield) {
          this.hasShield = false;
          m.hp = 0;
          this.vy = JUMP_VELOCITY;
          this.sounds.hit();
          this.haptics.heavy();
          this.fx.text(this.x, this.y - 30, 'SHIELD BROKEN!', '#c084fc', 26, 1.0);
          this.fx.burst(this.x, this.y, '#c084fc', 24, 220, 0.55, 4.5);
          this.fx.shake(9, 0.32);
          continue;
        }

        if (this.die(`Caught by ${m.type === 'ufo' ? 'Alien UFO' : 'Balloon Imp'}!`)) {
          this.sounds.fail();
          this.haptics.heavy();
          this.fx.burst(this.x, this.y, '#f43f5e', 36, 300, 0.75, 5.5);
          this.fx.shake(16, 0.55);
        }
      }
    }

    for (const bh of this.blackHoles) {
      bh.rot += dt * 5;
      const d = Math.hypot(bh.x - this.x, bh.y - this.y);
      if (d < 120 && this.grace <= 0) {
        const pull = (140 - d) * 1.9 * dt;
        this.x += ((bh.x - this.x) / d) * pull;
        this.y += ((bh.y - this.y) / d) * pull;

        if (d < bh.r + 10 && !this.dead) {
          if (this.die('Swallowed into a cosmic black hole!')) {
            this.sounds.chomp();
            this.haptics.heavy();
            this.fx.burst(bh.x, bh.y, '#8b5cf6', 36, 320, 0.85, 6);
            this.fx.shake(18, 0.6);
          }
        }
      }
    }
  }

  getActiveZone(altM) {
    let idx = 0;
    for (let i = 1; i < CLIMB_ZONES.length; i++) {
      if (altM >= CLIMB_ZONES[i].minM) idx = i;
    }
    const cur = CLIMB_ZONES[idx];
    const next = CLIMB_ZONES[idx + 1];
    if (!next) return { ...cur, name: cur.name };
    const t = clamp((altM - cur.minM) / Math.max(1, next.minM - cur.minM), 0, 1);
    return {
      name: cur.name,
      skyTop: lerpColor(cur.skyTop, next.skyTop, t),
      skyMid: lerpColor(cur.skyMid, next.skyMid, t),
      skyBot: lerpColor(cur.skyBot, next.skyBot, t),
    };
  }

  /* ------------------------------------------------------------ Rendering Pipeline */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const off = this.fx.offset();

    // 1. Continuous Weebl Altitude Biomes, Hills, Skyline & Clouds
    this.renderAtmosphere(ctx, W, H);

    ctx.save();
    ctx.translate(off.x, off.y - this.camY);

    // 2. Milestone Altitude Banners
    for (const b of this.milestoneBanners) {
      this.drawMilestoneBanner(b, ctx);
    }

    // 3. Cosmic Black Holes
    for (const bh of this.blackHoles) {
      this.drawBlackHole(bh, ctx);
    }

    // 4. Inked Cel Platforms & Powerups
    for (const p of this.platforms) {
      this.drawPlatform(p, ctx);
    }

    // 5. Balloon Imps & UFOs
    for (const m of this.monsters) {
      if (m.hp > 0) this.drawMonster(m, ctx);
    }

    // 6. #000-Inked Cel Plasma Orbs
    for (const b of this.bullets) {
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7.5, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x - 2, b.y - 2, 2.8, 0, TAU);
      ctx.fill();
    }

    // 7. Crowned Green Hero Bean Climber
    this.drawDoodler(ctx);

    this.fx.render(ctx, 1);
    ctx.restore();

    // 8. Compact 2-Pill Comic HUD
    this.renderHUD(ctx, W, H);
  }

  /* ------------------------------------------------------------ Weebl Climb Atmosphere */
  renderAtmosphere(ctx, W, H) {
    const altM = this.maxAltitude;
    const zone = this.getActiveZone(altM);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, zone.skyTop);
    bg.addColorStop(0.55, zone.skyMid);
    bg.addColorStop(1, zone.skyBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Warm sunlit sunburst at low docklands launch
    if (altM < 180) {
      const rayAlpha = clamp(1 - altM / 180, 0, 1) * 0.24;
      drawSunburst(ctx, W * 0.5, H - 70 - this.camY * 0.16, 420, 0.12, 14, rayAlpha, false);
    }

    // Crescent sky_moon & #000-inked stars in Aurora/Cosmos altitudes
    if (altM > 200) {
      const starAlpha = clamp((altM - 200) / 140, 0, 1);
      ctx.save();
      ctx.globalAlpha = starAlpha * 0.9;
      for (let i = 0; i < 28; i++) {
        const sx = (i * 67 + 19) % W;
        const sy = ((i * 109 - this.camY * 0.12) % H + H) % H;
        const sr = i % 4 === 0 ? 3.2 : 1.9;
        ctx.fillStyle = i % 3 === 0 ? '#fde047' : '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      const moonY = clamp(185 + (420 - altM) * 0.25, 130, 320);
      drawSprite(ctx, 'sky_moon', W - 76, moonY, 64, 66, {
        alpha: starAlpha,
        fallback: () => { },
      });
    }

    // Crisp Inked Weebl Clouds (replaces flat blurry ovals)
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      const parallaxY = ((c.y - this.camY * 0.22) % (H + 140) + H + 140) % (H + 140) - 70;
      const spriteName = c.kind || (i % 2 === 0 ? 'cloud_1' : 'cloud_2');
      drawSprite(ctx, spriteName, c.x, parallaxY, c.w, c.h, {
        alpha: altM > 500 ? 0.35 : 0.92,
        fallback: () => {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = STYLE_TOKENS.ink;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.ellipse(c.x, parallaxY, c.w * 0.42, c.h * 0.34, 0, 0, TAU);
          ctx.fill();
          ctx.stroke();
        },
      });
    }

    // Grounded Inked Liverpool Hills & Landmarks scrolling smoothly below as you climb
    if (altM < 220) {
      const dropY = -this.camY * 0.32;
      const hillBase = H + 20 + dropY;
      if (hillBase > H - 260 && hillBase < H + 360) {
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 3.0;

        // Back green hill
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.moveTo(-10, hillBase);
        ctx.lineTo(-10, hillBase - 96);
        ctx.quadraticCurveTo(105, hillBase - 146, 225, hillBase - 92);
        ctx.quadraticCurveTo(345, hillBase - 140, W + 10, hillBase - 96);
        ctx.lineTo(W + 10, hillBase);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Grounded Weebl Liverpool Landmarks
        drawSprite(ctx, 'city_liver_building', 68, hillBase - 102, 74, 86, { fallback: () => { } });
        drawSprite(ctx, 'city_superlambanana', 155, hillBase - 82, 42, 56, { fallback: () => { } });
        drawSprite(ctx, 'city_metro_cathedral', W - 74, hillBase - 98, 76, 82, { fallback: () => { } });

        // Foreground hill ridge
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(-10, hillBase);
        ctx.lineTo(-10, hillBase - 54);
        ctx.quadraticCurveTo(135, hillBase - 84, 240, hillBase - 46);
        ctx.quadraticCurveTo(355, hillBase - 76, W + 10, hillBase - 50);
        ctx.lineTo(W + 10, hillBase);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawMilestoneBanner(b, ctx) {
    ctx.save();
    ctx.translate(0, b.y);

    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 4.2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(this.W, 0);
    ctx.stroke();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.setLineDash([]);

    const bw = 236;
    const bh = 32;
    drawComicPanel(ctx, (this.W - bw) / 2, -bh / 2, bw, bh, 11, '#0f172a', {
      lineWidth: 2.6,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawComicText(ctx, b.title, this.W / 2, 1, "900 12.5px 'Fredoka', 'Outfit', sans-serif", '#fde047', {
      strokeWidth: 3.0,
    });

    ctx.restore();
  }

  drawPlatform(p, ctx) {
    if (p.broken && p.breakProgress >= 1) return;

    ctx.save();
    if (p.broken) {
      ctx.globalAlpha = Math.max(0, 1 - p.breakProgress);
    }

    const squishScale = p.squishT > 0 ? 1 - p.squishT * 0.18 : 1;
    const py = p.y + (1 - squishScale) * p.h;
    const ph = p.h * squishScale;

    // Grounding drop ellipse
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w * 0.5, py + ph + 5, p.w * 0.44, 4.5, 0, 0, TAU);
    ctx.fill();

    let bodyCol = '#22c55e';
    let topCol = '#4ade80';
    let rimCol = '#15803d';
    if (p.type === 'moving') {
      bodyCol = '#0284c7'; topCol = '#38bdf8'; rimCol = '#0369a1';
    } else if (p.type === 'brittle') {
      bodyCol = '#b45309'; topCol = '#f59e0b'; rimCol = '#78350f';
    } else if (p.type === 'vanishing') {
      bodyCol = '#9333ea'; topCol = '#c084fc'; rimCol = '#6b21a8';
    } else if (p.type === 'vertical') {
      bodyCol = '#eab308'; topCol = '#fef08a'; rimCol = '#a16207';
    }

    // Extruded #000 bottom shadow lip + 2-tone Flash cel body (zero clip())
    ctx.fillStyle = STYLE_TOKENS.ink;
    ctx.beginPath();
    ctx.roundRect(p.x, py + 3.5 * squishScale, p.w, ph, 9);
    ctx.fill();

    ctx.fillStyle = rimCol;
    ctx.beginPath();
    ctx.roundRect(p.x, py, p.w, ph, 9);
    ctx.fill();

    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.roundRect(p.x + 1, py, p.w - 2, ph * 0.78, 8);
    ctx.fill();

    ctx.fillStyle = topCol;
    ctx.beginPath();
    ctx.roundRect(p.x + 3, py + 2, p.w - 6, Math.max(3, ph * 0.36), 6);
    ctx.fill();

    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(p.x, py, p.w, ph, 9);
    ctx.stroke();

    // Platform type comic badges
    if (p.type === 'moving') {
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      for (const tx of [p.x + 12, p.x + p.w - 12]) {
        ctx.beginPath();
        ctx.arc(tx, py + ph + 2, 4.2, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    } else if (p.type === 'brittle') {
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.36, py + 2);
      ctx.lineTo(p.x + p.w * 0.48, py + ph - 2);
      ctx.moveTo(p.x + p.w * 0.64, py + 2);
      ctx.lineTo(p.x + p.w * 0.52, py + ph - 2);
      ctx.stroke();

      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(p.x + 14, py + ph * 0.5, 3, 0, TAU);
      ctx.arc(p.x + p.w - 16, py + ph * 0.52, 3, 0, TAU);
      ctx.fill();
    } else if (p.type === 'standard') {
      ctx.fillStyle = '#4ade80';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(p.x + p.w - 9, py - 3.5, 5.2, 3.2, -0.4, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (p.type === 'vertical') {
      ctx.fillStyle = '#78350f';
      const cx = p.x + p.w * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, py + 3); ctx.lineTo(cx - 5, py + 8); ctx.lineTo(cx + 5, py + 8);
      ctx.closePath();
      ctx.moveTo(cx, py + ph - 3); ctx.lineTo(cx - 5, py + ph - 8); ctx.lineTo(cx + 5, py + ph - 8);
      ctx.closePath();
      ctx.fill();
    }

    // Platform Items (#000-inked Flash cel pickups)
    if (p.item) {
      const ix = p.x + p.w / 2;
      const iy = py - 12;

      if (p.item === 'spring') {
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 5.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(ix - 8, py);
        ctx.lineTo(ix + 8, py - 4);
        ctx.lineTo(ix - 8, py - 8);
        ctx.lineTo(ix + 8, py - 12);
        ctx.stroke();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(ix - 11, py - 17, 22, 6, 3);
        ctx.fill();
        ctx.stroke();
      } else if (p.item === 'trampoline') {
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(ix - 14, py); ctx.lineTo(ix - 10, py - 3);
        ctx.moveTo(ix + 14, py); ctx.lineTo(ix + 10, py - 3);
        ctx.stroke();

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(ix - 16, py - 10, 32, 9, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ix - 8, py - 9, 5, 7);
        ctx.fillRect(ix + 3, py - 9, 5, 7);
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(ix - 16, py - 10, 32, 9, 4);
        ctx.stroke();
      } else if (p.item === 'jetpack') {
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.2;
        for (const cx of [ix - 6, ix + 6]) {
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.roundRect(cx - 5, iy - 8, 10, 20, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(cx - 5, iy - 8); ctx.lineTo(cx, iy - 16); ctx.lineTo(cx + 5, iy - 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#facc15';
          ctx.fillRect(cx - 3.5, iy + 1, 7, 3.5);
        }
      } else if (p.item === 'propeller') {
        ctx.fillStyle = '#e11d48';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(ix, iy + 1, 9.5, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(ix - 15, iy - 12, 30, 5, 2.5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(ix, iy - 9.5, 3.8, 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else if (p.item === 'shield') {
        ctx.fillStyle = 'rgba(192, 132, 252, 0.55)';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(ix, iy, 11.5, 0, TAU);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ix - 4, iy - 4, 3.8, 1.8, -0.6, 0, TAU);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  drawMonster(m, ctx) {
    ctx.save();
    ctx.translate(m.x, m.y);

    if (m.type === 'ufo') {
      // #000-Inked Retro Flash Flying Saucer
      ctx.fillStyle = 'rgba(250, 204, 21, 0.32)';
      ctx.beginPath();
      ctx.moveTo(-11, 4); ctx.lineTo(11, 4); ctx.lineTo(26, 48); ctx.lineTo(-26, 48);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#7dd3fc';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, -7, 13, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tiny green Weebl alien pilot
      ctx.fillStyle = '#4ade80';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, -10, 6.2, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath();
      ctx.arc(-2.2, -10.5, 1.3, 0, TAU);
      ctx.arc(2.2, -10.5, 1.3, 0, TAU);
      ctx.fill();

      // Hull saucer
      ctx.fillStyle = '#94a3b8';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 10, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-9, -4.5, 10, 2.4, -0.1, 0, TAU);
      ctx.fill();

      const lights = ['#ef4444', '#facc15', '#22c55e', '#38bdf8'];
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        const lx = -18 + i * 12;
        ctx.fillStyle = lights[(i + Math.floor(this.t * 6)) % lights.length];
        ctx.beginPath();
        ctx.arc(lx, 1.5, 3.2, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      // Verified Weebl Balloon Imp Sprite! (imp centered near (0,0), purple balloon bobbing above)
      const bob = Math.sin(this.t * 5 + m.x * 0.04) * 4;
      const tilt = Math.sin(this.t * 3.5 + m.x * 0.03) * 0.08;
      drawSprite(ctx, 'balloon_imp', 0, 2 + bob, 46, 92, {
        dir: m.vx >= 0 ? -1 : 1,
        rot: tilt,
        fallback: (ictx) => {
          ictx.fillStyle = '#dc2626';
          ictx.strokeStyle = STYLE_TOKENS.ink;
          ictx.lineWidth = 2.8;
          ictx.beginPath();
          ictx.arc(0, 0, m.r, 0, TAU);
          ictx.fill();
          ictx.stroke();
        },
      });
    }

    ctx.restore();
  }

  drawBlackHole(bh, ctx) {
    ctx.save();
    ctx.translate(bh.x, bh.y);
    ctx.rotate(bh.rot);

    // Outer accretion ring & swirling #000-inked Flash vortex
    ctx.fillStyle = '#581c87';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.arc(0, 0, bh.r * 1.48, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    for (let a = 0; a < TAU; a += TAU / 3) {
      ctx.beginPath();
      ctx.arc(0, 0, bh.r * 1.24, a, a + 1.15);
      ctx.stroke();
    }

    ctx.fillStyle = '#090418';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, bh.r * 0.85, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  drawDoodler(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 24, 16, 4.5, 0, 0, TAU);
    ctx.fill();

    // Jetpack Canisters & Roaring Flames behind Hero Bean
    if (this.powerup === 'jetpack') {
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.4;
      for (const jx of [-17, 17]) {
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.roundRect(jx - 5, -12, 10, 28, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(jx - 4, -4, 8, 5);
      }

      const flame = rand(18, 30);
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(-22, 16); ctx.lineTo(-17, 16 + flame); ctx.lineTo(-12, 16);
      ctx.closePath();
      ctx.moveTo(12, 16); ctx.lineTo(17, 16 + flame); ctx.lineTo(22, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(-20, 16); ctx.lineTo(-17, 16 + flame * 0.6); ctx.lineTo(-14, 16);
      ctx.moveTo(14, 16); ctx.lineTo(17, 16 + flame * 0.6); ctx.lineTo(20, 16);
      ctx.fill();
    }

    // Recoil Muzzle Star-Flash when firing upward
    if (this.recoilT > 0) {
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, -32, 8.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Pristine HD 3D Crowned Hero Bean Climber with launch, dive & jetpack action states
    const sq = clamp(this.squash, 0.72, 1.32);
    const sx = 2 - sq;
    const sy = sq;
    const tilt = clamp(this.vx * 0.0005, -0.18, 0.18);
    const jumpState =
      this.dead ? 'dead'
      : this.powerup === 'jetpack' ? 'jetpack'
      : this.vy < -160 ? 'jump_launch'
      : this.vy > 210 ? 'fall_dive'
      : 'stand_alert';
    drawHeroCharacter(ctx, 0, 22, 46, {
      view: 'threeQuarterFront',
      dir: this.dir < 0 ? -1 : 1,
      state: jumpState,
      expr: this.dead ? 'dizzy' : this.vy > 260 ? 'panic' : 'happy',
      t: this.t * 4.5,
      squashX: sx,
      squashY: sy,
      lean: this.dead ? 0.35 : tilt,
      prop: this.powerup === 'jetpack' ? 'jetpack' : 'none',
    });

    // Spinning Propeller Beanie Cap mounted cleanly atop crown/head
    if (this.powerup === 'propeller') {
      const spin = Math.max(5, Math.abs(Math.sin(this.t * 40)) * 20);
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(-spin, -38, spin * 2, 6, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, -35, 4.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Crisp Inked Soap-Bubble Shield Dome
    if (this.hasShield) {
      ctx.fillStyle = 'rgba(192, 132, 252, 0.28)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.arc(0, -2, 34, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -2, 35.5, 0, TAU);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.ellipse(-12, -16, 7.5, 3.5, -0.55, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------ Compact 2-Pill Comic HUD */
  renderHUD(ctx, W, H) {
    const m = Math.round(this.maxAltitude);
    const zone = this.getActiveZone(m);

    // 1. Top-Left Altitude & Zone Card (x=14, y=98, w=186, h=46)
    const lx = 14;
    const ly = 98;
    const lw = 186;
    const lh = 46;
    drawComicPanel(ctx, lx, ly, lw, lh, 12, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawComicText(ctx, `${m}m`, lx + 12, ly + 15.5, "900 15.5px 'Fredoka', 'Outfit', sans-serif", '#fde047', {
      align: 'left',
      strokeWidth: 3.2,
    });
    drawComicText(ctx, zone.name, lx + 12, ly + 33.5, "900 10.5px 'Fredoka', 'Outfit', sans-serif", '#38bdf8', {
      align: 'left',
      strokeWidth: 2.6,
    });

    // 2. Top-Right Action/Powerup Pill cleanly below #prestigeBadge
    const rw = 122;
    const rh = 36;
    const rx = W - rw - 14;
    const ry = 104;
    let statusFill = '#166534';
    let statusTxt = 'TAP TO SHOOT';
    let statusCol = '#4ade80';

    if (this.powerup === 'jetpack') {
      statusFill = '#c2410c';
      statusTxt = `JETPACK ${this.powerupTimer.toFixed(1)}s`;
      statusCol = '#fef08a';
    } else if (this.powerup === 'propeller') {
      statusFill = '#0369a1';
      statusTxt = `PROP ${this.powerupTimer.toFixed(1)}s`;
      statusCol = '#ffffff';
    } else if (this.hasShield) {
      statusFill = '#6b21a8';
      statusTxt = 'SHIELD READY';
      statusCol = '#f5d0fe';
    }

    drawComicPanel(ctx, rx, ry, rw, rh, 11, statusFill, {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawComicText(ctx, statusTxt, rx + rw * 0.5, ry + rh * 0.5 + 1, "900 11px 'Fredoka', 'Outfit', sans-serif", statusCol, {
      strokeWidth: 3.0,
    });
  }
}
