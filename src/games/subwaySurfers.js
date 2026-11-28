import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import {
  STYLE_TOKENS,
  preloadWeeblAtlas,
  drawSprite,
  drawComicPanel,
  drawComicText as _rawDrawComicText,
  drawWeeblCelBean,
  drawWeeblEyeCluster,
  drawHeroCharacter,
} from './weeblAtlas.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// 3 Track Lanes: -1 (Left), 0 (Center), 1 (Right)
const LANE_DIST = 115;
const LANES = [-1, 0, 1];
const TRACK_NEAR_Z = -78; // Extends seamlessly past H = 800 bottom edge
const TRACK_FAR_Z = 1650;
const TIE_SPACING = 44;
const POST_SPACING = 150;
const CITY_SPACING = 240;
const GANTRY_SPACING = 340;

const CITY_SPRITES = [
  'city_donut_shop',
  'city_superlambanana',
  'city_liver_building',
  'city_metro_cathedral',
  'city_palm_house',
  'city_st_jelly_hall',
  'city_yellow_taxi',
  'city_double_decker',
];

const TRAIN_THEMES = [
  { main: '#ef4444', dark: '#b91c1c', roof: '#f8fafc', trim: '#fb7185', stripe: '#fde047', name: 'CHERRY EXPRESS' },
  { main: '#f59e0b', dark: '#b45309', roof: '#fef3c7', trim: '#fb923c', stripe: '#38bdf8', name: 'SUNNY SHUTTLE' },
  { main: '#10b981', dark: '#047857', roof: '#ecfdf5', trim: '#34d399', stripe: '#facc15', name: 'MERSEY FLYER' },
  { main: '#8b5cf6', dark: '#5b21b6', roof: '#f5f3ff', trim: '#a78bfa', stripe: '#f43f5e', name: 'BERRY STEAMER' },
];

const ZONE_PALETTES = [
  {
    // Zone 0: Sunny Weebl Sunburst Blue Sky
    skyTop: '#2563eb',
    skyMid: '#38bdf8',
    skyLow: '#bae6fd',
    rayA: 'rgba(255, 255, 255, 0.14)',
    rayB: 'rgba(254, 240, 138, 0.16)',
    citySil: '#1e3a8a',
    farHill: '#34d399',
    nearHill: '#22c55e',
    grassFar: '#4ade80',
    grassMid: '#22c55e',
    grassNear: '#16a34a',
  },
  {
    // Zone 1: Cotton Candy Sunset
    skyTop: '#7c3aed',
    skyMid: '#ec4899',
    skyLow: '#fed7aa',
    rayA: 'rgba(255, 255, 255, 0.12)',
    rayB: 'rgba(253, 224, 71, 0.18)',
    citySil: '#4c1d95',
    farHill: '#2dd4bf',
    nearHill: '#10b981',
    grassFar: '#34d399',
    grassMid: '#16a34a',
    grassNear: '#15803d',
  },
  {
    // Zone 2: Golden Liverpool Morning
    skyTop: '#0284c7',
    skyMid: '#0ea5e9',
    skyLow: '#fef08a',
    rayA: 'rgba(255, 255, 255, 0.15)',
    rayB: 'rgba(251, 146, 60, 0.16)',
    citySil: '#0f172a',
    farHill: '#86efac',
    nearHill: '#4ade80',
    grassFar: '#4ade80',
    grassMid: '#22c55e',
    grassNear: '#15803d',
  },
];

/* ------------------------------------------------------------ 2x PNG Bitmap Comic Text Cache (60 FPS) */
const TEXT_STAMP_CACHE = new Map();
const TEXT_STAMP_MAX = 220;
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
  const shadow = opts.shadow ? 1 : 0;
  const key = `${label}|${font}|${fill}|${strokeCol}|${strokeW}|${shadow}`;

  let entry = TEXT_STAMP_CACHE.get(key);
  if (!entry) {
    if (!_measureCtx) {
      const mc = document.createElement('canvas');
      mc.width = 4;
      mc.height = 4;
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
    img.src = c.toDataURL('image/png');
    entry = { img, canvas: c, w, h, pad };
    if (TEXT_STAMP_CACHE.size >= TEXT_STAMP_MAX) {
      const oldest = TEXT_STAMP_CACHE.keys().next().value;
      if (oldest !== undefined) TEXT_STAMP_CACHE.delete(oldest);
    }
    TEXT_STAMP_CACHE.set(key, entry);
  } else {
    TEXT_STAMP_CACHE.delete(key);
    TEXT_STAMP_CACHE.set(key, entry);
  }

  const align = opts.align || 'center';
  const dx = align === 'left' || align === 'start'
    ? x - entry.pad
    : align === 'right' || align === 'end'
    ? x - (entry.w - entry.pad)
    : x - entry.w * 0.5;
  const dy = y - entry.h * 0.5;
  const drawable = entry.img.complete && entry.img.naturalWidth > 0 ? entry.img : entry.canvas;
  ctx.drawImage(drawable, dx, dy, entry.w, entry.h);
}

function drawGoldCoinBadge(ctx, cx, cy, r = 7.5, lineW = 2.0) {
  ctx.save();
  ctx.fillStyle = '#eab308';
  ctx.strokeStyle = STYLE_TOKENS.ink;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(cx - r * 0.14, cy - r * 0.14, r * 0.65, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.28, cy - r * 0.28, r * 0.24, r * 0.14, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

const FONT_HUD_SM = "900 10.5px 'Fredoka', 'Outfit', sans-serif";
const FONT_HUD_MD = "900 13.5px 'Fredoka', 'Outfit', sans-serif";
const FONT_HUD_LG = "900 15px 'Fredoka', 'Outfit', sans-serif";
const FONT_BADGE = "900 12px 'Fredoka', 'Outfit', sans-serif";

export class SubwaySurfers extends Game {
  static meta = {
    id: 'subway-surfers',
    title: 'Subway Bean Surfers',
    icon: '🚇',
    hint: 'SWIPE Left/Right to dodge trains · Up to jump · Down to slide! Double tap for Surfboard!',
    baseLikes: 8240,
    isPrestige: false,
    parScore60s: 7200,
    cue: 'SWIPE TO DODGE TRAINS!',
    prestigeCue: 'HIGHER SPEED · MORE TRAINS!',
    scaling: {
      baseSpeed:        { base: 440, rate: 0.16, cap: 560, mode: 'up', round: true, label: 'Run Speed' },
      maxSpeed:         { base: 740, rate: 0.16, cap: 920, mode: 'up', round: true, label: 'Top Speed' },
      movingTrainBonus: { base: 0.0, rate: 0.20, cap: 0.25, mode: 'up', deltaFormat: 'abs', unit: '%', label: 'Moving Trains' },
    },
  };

  init(saved, score = 0) {
    preloadWeeblAtlas();
    this.fx = new FX();
    this.score = score;

    // 2.5D Perspective Projection Constants (Track projects seamlessly off H = 800)
    this.horizonX = this.W / 2;
    this.horizonY = 246;
    this.groundY = 650;
    this.camD = 240;

    // World & Movement Physics (scaled by SSOT prestige ramp)
    this.speed = this.diff.baseSpeed ?? 440;
    this.maxSpeed = this.diff.maxSpeed ?? 740;
    this.distance = 0;
    this.trackOffset = 0;
    this.scrollZ = 0; // Monotonic forward world scroll (prevents modulo jump!)
    this.coins = 0;
    this.scoreMultiplier = 1;

    // Environment Zone (0: Sunny Sunburst, 1: Cotton Candy Sunset, 2: Golden Dawn)
    this.currentZone = 0;

    // Player State
    this.lane = 0;
    this.laneX = 0;
    this.playerBaseY = 0; // 0 on track, 95 on train roof
    this.jumpY = 0;
    this.jumpVY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDustTimer = 0;
    this.onTrain = false;
    this.rollAngle = 0;
    this.spinAngle = 0;
    this.tiltAngle = 0;
    this.runAnimT = 0;
    this.lastFootSide = 1;
    this.stepTimer = 0;
    this.deathTimer = 0;

    // Stumble recovery cooldown (sole Green Hero Bean runner)
    this.stumbleTimer = 0;
    this.stumbleCooldown = 0;

    // Surfboard (Hoverboard) & Shield System
    this.hoverboardActive = false;
    this.hoverboardTimer = 0;
    this.hoverboardStock = 2;

    // Active Power-up Timers
    this.magnetTimer = 0;
    this.jetpackTimer = 0;
    this.sneakerTimer = 0;
    this.doubleTimer = 0;
    this.parachuteTimer = 0;

    // Word Hunt: "B-E-A-N"
    this.lettersCollected = { B: false, E: false, A: false, N: false };

    // Procedural Spawning Trackers (fresh start guarantees >5s clear runway after intro instructions)
    this.worldObjects = [];
    this.nextSpawnZ = saved ? 900 : 2750;
    this.nextTrainZ = saved ? 1100 : 2950;
    this.nextLetterZ = saved ? 950 : 3100;
    this.nextMysteryZ = saved ? 800 : 3000;

    this.sprayIntroT = 0;

    // Touch & Swipe Gesture Tracker
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.lastTapTime = 0;

    // Keyboard states
    this.prevKeyLeft = false;
    this.prevKeyRight = false;
    this.prevKeyUp = false;
    this.prevKeyDown = false;
    this.prevKeyBoard = false;

    // Overhead #000-Inked Signal Gantries (scrolled smoothly in update())
    this.gantries = Array.from({ length: 5 }, (_, i) => ({
      z: 140 + i * GANTRY_SPACING,
      color: i % 2 === 0 ? '#38bdf8' : '#fb923c',
      signal: i % 3 === 0 ? 'green' : (i % 3 === 1 ? 'red' : 'yellow'),
    }));

    // Scrolling Liverpool Toy City Landmarks flanking the embankments
    this.cityProps = [];
    for (let i = 0; i < 7; i++) {
      const z = 80 + i * CITY_SPACING;
      this.cityProps.push({
        z,
        side: -1,
        sprite: CITY_SPRITES[(i * 2) % CITY_SPRITES.length],
      });
      this.cityProps.push({
        z: z + CITY_SPACING * 0.5,
        side: 1,
        sprite: CITY_SPRITES[(i * 2 + 1) % CITY_SPRITES.length],
      });
    }

    // Crisp Weebl Cloud Sprites
    this.clouds = Array.from({ length: 5 }, (_, i) => ({
      x: 40 + i * 95,
      y: 66 + (i % 3) * 32,
      w: 58 + (i % 2) * 18,
      h: 34 + (i % 2) * 10,
      speed: 7 + (i % 3) * 3.5,
      sprite: i % 2 === 0 ? 'cloud_1' : 'cloud_2',
    }));

    // Cached offscreen 2x DPR backdrops per zone
    this._skyCaches = new Map();
    this._groundCaches = new Map();

    if (saved) {
      this.distance = Number.isFinite(saved.distance) ? saved.distance : 0;
      this.coins = Number.isFinite(saved.coins) ? saved.coins : 0;
      this.scoreMultiplier = Number.isFinite(saved.scoreMultiplier) ? saved.scoreMultiplier : 1;
      this.hoverboardStock = Number.isFinite(saved.hoverboardStock) ? saved.hoverboardStock : 2;
      this.lettersCollected = Object.assign({ B: false, E: false, A: false, N: false }, saved.lettersCollected);
      this.grace = 1.5;
    } else {
      this.grace = 5.0;
      this.playIntroSounds();
    }

    this.seedInitialTrack();
  }

  playIntroSounds() {
    this.sounds.whoosh();
  }

  serialize() {
    return {
      distance: Math.floor(this.distance),
      coins: this.coins,
      scoreMultiplier: this.scoreMultiplier,
      hoverboardStock: this.hoverboardStock,
      lettersCollected: this.lettersCollected,
      score: this.score,
    };
  }

  restoreLabel() {
    return `${Math.floor(this.distance)}m · 🪙 ${this.coins} · x${this.scoreMultiplier} · ${Math.round(this.score)} pts`;
  }

  /* ------------------------------------------------------------- 2.5D Projection Helper */
  project(laneX, heightY, z) {
    const depth = z + this.camD;
    if (depth <= 10) return { x: this.horizonX, y: this.groundY, scale: 1, visible: false };
    const scale = this.camD / depth;
    const x = this.horizonX + laneX * scale;
    const y = this.horizonY + (this.groundY - this.horizonY) * scale - heightY * scale;
    return { x, y, scale, visible: z >= TRACK_NEAR_Z && z <= 1700 };
  }

  /* ------------------------------------------------------------- Track & World Generation */
  seedInitialTrack() {
    // 5+ second obstacle-free opening coin & boost runway across all 3 lanes
    for (let z = 220; z <= 700; z += 60) {
      this.worldObjects.push({ type: 'coin', lane: 0, z, y: 20, taken: false });
    }
    for (let z = 820; z <= 1240; z += 60) {
      this.worldObjects.push({ type: 'coin', lane: 1, z, y: 20, taken: false });
    }
    for (let z = 1360; z <= 1780; z += 60) {
      this.worldObjects.push({ type: 'coin', lane: -1, z, y: 20, taken: false });
    }
    // Gentle jump-practice coin arc back in center lane
    this.worldObjects.push({ type: 'coin', lane: 0, z: 1920, y: 24, taken: false });
    this.worldObjects.push({ type: 'coin', lane: 0, z: 1990, y: 58, taken: false });
    this.worldObjects.push({ type: 'coin', lane: 0, z: 2060, y: 74, taken: false });
    this.worldObjects.push({ type: 'coin', lane: 0, z: 2130, y: 58, taken: false });
    this.worldObjects.push({ type: 'coin', lane: 0, z: 2200, y: 24, taken: false });
    this.worldObjects.push({ type: 'powerup', power: 'x2', lane: 0, z: 2350, y: 28, taken: false });
  }

  spawnWorldElements() {
    const cycle = Math.floor(this.distance / 450);
    this.currentZone = cycle % 3;

    while (this.nextSpawnZ < 1550) {
      const z = this.nextSpawnZ;
      const r = Math.random();

      if (this.jetpackTimer > 0) {
        for (const lane of LANES) {
          const coinH = 150 + Math.sin(z * 0.04) * 22;
          this.worldObjects.push({ type: 'coin', lane, z, y: coinH, taken: false });
        }
        this.nextSpawnZ += 55;
        continue;
      }

      if (z >= this.nextLetterZ) {
        const letters = ['B', 'E', 'A', 'N'];
        const missing = letters.filter((l) => !this.lettersCollected[l]);
        if (missing.length > 0) {
          const targetL = missing[Math.floor(Math.random() * missing.length)];
          const lane = LANES[Math.floor(Math.random() * LANES.length)];
          this.worldObjects.push({ type: 'letter', letter: targetL, lane, z, y: 35, taken: false });
          this.nextLetterZ = z + 950 + Math.random() * 500;
        }
      }

      if (z >= this.nextMysteryZ) {
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        this.worldObjects.push({ type: 'mystery', lane, z, y: 30, taken: false });
        this.nextMysteryZ = z + 1200 + Math.random() * 800;
      }

      if (z >= this.nextTrainZ) {
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        const moving = Math.random() < (0.60 + (this.diff.movingTrainBonus || 0));
        const len = 380 + Math.random() * 140;
        const trainTheme = TRAIN_THEMES[Math.floor(Math.random() * TRAIN_THEMES.length)];
        const hasRamp = Math.random() < 0.55;

        this.worldObjects.push({
          type: 'train',
          lane,
          z,
          len,
          moving,
          theme: trainTheme,
          hasRamp,
          horned: false,
        });

        for (let cz = z + 50; cz < z + len - 40; cz += 48) {
          this.worldObjects.push({ type: 'coin', lane, z: cz, y: 114, taken: false });
        }

        if (Math.random() < 0.40) {
          const pTypes = ['magnet', 'jetpack', 'sneakers', 'x2'];
          const p = pTypes[Math.floor(Math.random() * pTypes.length)];
          this.worldObjects.push({ type: 'powerup', power: p, lane, z: z + len * 0.5, y: 124, taken: false });
        }

        this.nextTrainZ = z + 480 + Math.random() * 320;
        this.nextSpawnZ += 170;
        continue;
      }

      if (r < 0.36) {
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        this.worldObjects.push({ type: 'hurdle', lane, z });
        this.worldObjects.push({ type: 'coin', lane, z: z - 40, y: 20, taken: false });
        this.worldObjects.push({ type: 'coin', lane, z, y: 64, taken: false });
        this.worldObjects.push({ type: 'coin', lane, z: z + 40, y: 20, taken: false });
        this.nextSpawnZ += 180;
      } else if (r < 0.64) {
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        this.worldObjects.push({ type: 'overhead', lane, z });
        this.worldObjects.push({ type: 'coin', lane, z: z - 28, y: 16, taken: false });
        this.worldObjects.push({ type: 'coin', lane, z, y: 16, taken: false });
        this.worldObjects.push({ type: 'coin', lane, z: z + 28, y: 16, taken: false });
        this.nextSpawnZ += 180;
      } else if (r < 0.82) {
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        const pTypes = ['magnet', 'jetpack', 'sneakers', 'x2'];
        const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
        this.worldObjects.push({ type: 'powerup', power: pType, lane, z, y: 28, taken: false });
        this.worldObjects.push({ type: 'coin', lane, z: z - 35, y: 20, taken: false });
        this.worldObjects.push({ type: 'coin', lane, z: z + 35, y: 20, taken: false });
        this.nextSpawnZ += 210;
      } else {
        const startLane = LANES[Math.floor(Math.random() * LANES.length)];
        const curve = Math.random() < 0.5;
        for (let i = 0; i < 4; i++) {
          const clane = curve ? clamp(startLane + (i % 2 === 0 ? 0 : 1), -1, 1) : startLane;
          this.worldObjects.push({ type: 'coin', lane: clane, z: z + i * 42, y: 20, taken: false });
        }
        this.nextSpawnZ += 190;
      }
    }
  }

  /* ------------------------------------------------------------- Controls & Input */
  handleInput(dt) {
    const inp = this.input;

    if (inp.pressed) {
      this.touchStartX = inp.x;
      this.touchStartY = inp.y;
      this.touchStartTime = this.time;

      // Bottom-right Surfboard Quick-Deploy Button (clear of bottom-left #adminDock)
      if (inp.x >= this.W - 102 && inp.x <= this.W - 8 && inp.y >= this.H - 68 && inp.y <= this.H - 8) {
        this.activateHoverboard();
        return;
      }

      if (this.time - this.lastTapTime < 0.32) {
        this.activateHoverboard();
        this.lastTapTime = 0;
      } else {
        this.lastTapTime = this.time;
      }
    }

    if (inp.down) {
      const dx = inp.x - this.touchStartX;
      const dy = inp.y - this.touchStartY;
      const dist = Math.hypot(dx, dy);

      if (dist > 22) {
        if (Math.abs(dx) > Math.abs(dy) * 0.8) {
          if (dx > 0) this.changeLane(1);
          else this.changeLane(-1);
        } else {
          if (dy < 0) this.jump();
          else this.slide();
        }
        this.touchStartX = inp.x;
        this.touchStartY = inp.y;
      }
    }

    const kLeft = inp.key('a', 'arrowleft');
    const kRight = inp.key('d', 'arrowright');
    const kUp = inp.key('w', 'arrowup', ' ');
    const kDown = inp.key('s', 'arrowdown');
    const kBoard = inp.key('e', 'b', 'shift');

    if (kLeft && !this.prevKeyLeft) this.changeLane(-1);
    if (kRight && !this.prevKeyRight) this.changeLane(1);
    if (kUp && !this.prevKeyUp) this.jump();
    if (kDown && !this.prevKeyDown) this.slide();
    if (kBoard && !this.prevKeyBoard) this.activateHoverboard();

    this.prevKeyLeft = kLeft;
    this.prevKeyRight = kRight;
    this.prevKeyUp = kUp;
    this.prevKeyDown = kDown;
    this.prevKeyBoard = kBoard;
  }

  changeLane(dir) {
    if (this.dead) return;
    const nextLane = clamp(this.lane + dir, -1, 1);
    if (nextLane !== this.lane) {
      let bumpedTrain = false;
      for (const obj of this.worldObjects) {
        if (obj.type === 'train' && obj.lane === nextLane) {
          if (obj.z <= 25 && obj.z + obj.len >= -25) {
            const pY = this.playerBaseY + this.jumpY;
            if (pY < 85) {
              bumpedTrain = true;
              break;
            }
          }
        }
      }

      if (bumpedTrain) {
        this.triggerStumble('Bumped into a speeding train side!');
        return;
      }

      this.lane = nextLane;
      this.sounds.slice();
      this.haptics.light();
      this.fx.ring(this.W / 2 + this.lane * (LANE_DIST * 0.55), this.groundY - 10, '#facc15', 35, 0.25, 2.5);
    }
  }

  jump() {
    if (this.dead) return;
    if (this.jetpackTimer > 0) return;

    if (!this.isJumping || this.jumpY < 12) {
      const power = this.sneakerTimer > 0 ? 920 : 620;
      this.jumpVY = power;
      this.isJumping = true;
      this.isSliding = false;
      this.slideTimer = 0;
      this.spinAngle = 0;

      if (this.sneakerTimer > 0) {
        this.sounds.bubble(2.5);
        this.sounds.bubble(3.4);
        this.haptics.heavy();
        const proj = this.project(this.lane * LANE_DIST, this.playerBaseY, 0);
        this.fx.ring(proj.x, proj.y, '#f43f5e', 80, 0.45, 4);
        this.fx.text(proj.x, proj.y - 30, 'SPRING JUMP!', '#f43f5e', 20);
      } else {
        this.sounds.drop();
        this.haptics.medium();
        const proj = this.project(this.lane * LANE_DIST, this.playerBaseY, 0);
        this.fx.burst(proj.x, proj.y, '#facc15', 8, 110, 0.35, 2.5);
      }
    }
  }

  slide() {
    if (this.dead) return;
    if (this.jetpackTimer > 0) return;

    if (this.isJumping) {
      this.jumpVY = -880;
      this.sounds.drop();
    }

    this.isSliding = true;
    this.slideTimer = 0.68;
    this.slideDustTimer = 0;
    this.rollAngle = 0;
    this.sounds.slice();
    this.haptics.light();

    const proj = this.project(this.lane * LANE_DIST, this.playerBaseY, 0);
    this.fx.burst(proj.x, proj.y, '#ffffff', 8, 70, 0.25, 2);
  }

  activateHoverboard() {
    if (this.dead) return;
    if (this.hoverboardActive) return;
    if (this.hoverboardStock <= 0) {
      this.sounds.tick();
      return;
    }

    this.hoverboardStock--;
    this.hoverboardActive = true;
    this.hoverboardTimer = 30.0;
    this.sounds.upgrade();
    this.haptics.heavy();

    const proj = this.project(this.laneX, this.playerBaseY + this.jumpY, 0);
    this.fx.ring(proj.x, proj.y, '#38bdf8', 85, 0.5, 4);
    this.fx.text(proj.x, proj.y - 40, 'SURFBOARD ON!', '#38bdf8', 22);
  }

  triggerStumble(reason) {
    if (this.grace > 0 || this.dead) return;
    if (this.stumbleCooldown > 0) return;

    if (this.stumbleTimer > 0.4) {
      this.handleCrash(reason || 'Watch out on the rails!');
      return;
    }

    this.stumbleTimer = 2.6;
    this.stumbleCooldown = 0.9;
    this.sounds.hit();
    this.haptics.medium();

    const proj = this.project(this.laneX, this.playerBaseY + this.jumpY, 0);
    this.fx.shake(10, 0.24);
    this.fx.text(proj.x, proj.y - 35, 'WHOOPS!', '#facc15', 18);
  }

  /* ------------------------------------------------------------- Simulation & Physics */
  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }

    this.time += dt;
    this.fx.update(dt);
    if (this.grace > 0) this.grace -= dt;
    if (this.stumbleCooldown > 0) this.stumbleCooldown -= dt;
    if (this.sprayIntroT > 0) this.sprayIntroT -= dt;

    const currentMax = this.jetpackTimer > 0 ? this.maxSpeed + 90 : this.maxSpeed;
    if (this.speed < currentMax) {
      this.speed += 3.2 * dt;
    }
    const worldStep = this.speed * dt;
    this.distance += worldStep * 0.1;
    this.scrollZ += worldStep;
    this.trackOffset = this.scrollZ % TIE_SPACING;
    this.score += worldStep * 0.18 * this.scoreMultiplier;

    this.nextSpawnZ -= worldStep;
    this.nextTrainZ -= worldStep;
    this.nextLetterZ -= worldStep;
    this.nextMysteryZ -= worldStep;

    // Smooth continuous scroll for gantries & roadside Liverpool city landmarks
    const totalGantrySpan = this.gantries.length * GANTRY_SPACING;
    for (const g of this.gantries) {
      g.z -= worldStep;
      if (g.z < TRACK_NEAR_Z) g.z += totalGantrySpan;
    }
    const totalCitySpan = Math.ceil(this.cityProps.length / 2) * CITY_SPACING;
    for (const p of this.cityProps) {
      p.z -= worldStep;
      if (p.z < -60) p.z += totalCitySpan;
    }

    // Smooth Lane Interpolation & Tilt Angle
    const targetLaneX = this.lane * LANE_DIST;
    const prevLaneX = this.laneX;
    this.laneX += (targetLaneX - this.laneX) * Math.min(1, dt * 17);
    this.tiltAngle = clamp((this.laneX - prevLaneX) * 0.08, -0.28, 0.28);

    this.runAnimT += dt * (this.speed * 0.032);
    const curFootSide = Math.sin(this.runAnimT) >= 0 ? 1 : -1;
    if (
      curFootSide !== this.lastFootSide &&
      !this.isJumping &&
      !this.isSliding &&
      !this.hoverboardActive &&
      this.jetpackTimer <= 0
    ) {
      const proj = this.project(this.laneX, this.playerBaseY, 0);
      this.fx.burst(proj.x + curFootSide * 7, proj.y + 8, '#fde68a', 2, 42, 0.2, 2.0);
      this.lastFootSide = curFootSide;
    }
    if (this.stumbleTimer > 0) this.stumbleTimer = Math.max(0, this.stumbleTimer - dt);

    if (this.sneakerTimer > 0 && !this.isJumping && !this.isSliding) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.26;
        const proj = this.project(this.laneX, this.playerBaseY, 0);
        this.fx.ring(proj.x, proj.y + 4, '#f59e0b', 25, 0.2, 1.8);
      }
    }

    if (this.isSliding) {
      this.slideTimer -= dt;
      this.rollAngle += dt * 18;
      this.slideDustTimer -= dt;
      if (this.slideDustTimer <= 0) {
        this.slideDustTimer = 0.07;
        const proj = this.project(this.laneX, this.playerBaseY, 0);
        this.fx.burst(proj.x, proj.y + 4, '#f8fafc', 1, 45, 0.16, 2.2);
      }
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.rollAngle = 0;
      }
    }

    if (this.magnetTimer > 0) this.magnetTimer -= dt;
    if (this.sneakerTimer > 0) this.sneakerTimer -= dt;
    if (this.doubleTimer > 0) {
      this.doubleTimer -= dt;
      this.scoreMultiplier = 2;
    } else {
      this.scoreMultiplier = 1;
    }

    if (this.hoverboardActive) {
      this.hoverboardTimer -= dt;
      if (this.hoverboardTimer <= 0) this.hoverboardActive = false;
    }

    if (this.jetpackTimer > 0) {
      this.jetpackTimer -= dt;
      this.jumpY += (165 - this.jumpY) * Math.min(1, dt * 6.5);
      this.isJumping = false;
      this.playerBaseY = 0;

      const proj = this.project(this.laneX, this.jumpY, 0);
      this.fx.burst(proj.x - 10, proj.y + 10, '#ffffff', 2, 80, 0.25, 3.5, 240);
      this.fx.burst(proj.x + 10, proj.y + 10, '#ffffff', 2, 80, 0.25, 3.5, 240);
      this.fx.burst(proj.x, proj.y + 12, '#facc15', 2, 70, 0.25, 2, 220);

      if (this.jetpackTimer <= 0) {
        this.parachuteTimer = 2.2;
      }
    } else if (this.parachuteTimer > 0) {
      this.parachuteTimer -= dt;
      this.jumpY = Math.max(0, this.jumpY - 72 * dt);
      if (this.jumpY <= 0) this.parachuteTimer = 0;
    } else {
      if (this.isJumping || this.jumpY > 0) {
        const grav = 1450;
        this.jumpVY -= grav * dt;
        this.jumpY += this.jumpVY * dt;

        if (this.sneakerTimer > 0) {
          this.spinAngle += dt * 14;
        }

        if (this.jumpY <= 0) {
          this.jumpY = 0;
          this.jumpVY = 0;
          this.isJumping = false;
          this.spinAngle = 0;
        }
      }
    }

    this.checkTrainRoofSupport(dt);
    this.updateWorldObjects(dt, worldStep);
    this.spawnWorldElements();

    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > this.W + 70) c.x = -70;
    }

    this.handleInput(dt);
  }

  updateDying(dt) {
    this.deathTimer += dt;
    this.fx.update(dt);
  }

  checkTrainRoofSupport(dt) {
    let supportedByTrain = false;

    for (const obj of this.worldObjects) {
      if (obj.type === 'train' && obj.lane === this.lane) {
        if (obj.hasRamp && obj.z <= 65 && obj.z >= -20) {
          const rampProg = clamp((65 - obj.z) / 65, 0, 1);
          this.playerBaseY = Math.max(this.playerBaseY, rampProg * 95);
          supportedByTrain = true;
          this.onTrain = true;
          break;
        }

        if (obj.z <= 20 && obj.z + obj.len >= -20) {
          if (this.jumpY + this.playerBaseY >= 82) {
            supportedByTrain = true;
            this.playerBaseY = 95;
            break;
          }
        }
      }
    }

    if (!supportedByTrain && this.playerBaseY > 0) {
      this.playerBaseY = 0;
      this.isJumping = true;
      this.jumpY = 95;
      this.jumpVY = 0;
    }
    this.onTrain = supportedByTrain;
  }

  updateWorldObjects(dt, worldStep) {
    const playerZ = 0;
    const runnerLane = this.lane;

    for (let i = this.worldObjects.length - 1; i >= 0; i--) {
      const obj = this.worldObjects[i];

      let moveSpeed = worldStep;
      if (obj.type === 'train' && obj.moving) {
        moveSpeed += 175 * dt;
        if (!obj.horned && obj.z <= 480 && obj.z >= 420) {
          obj.horned = true;
          this.playTrainHorn();
        }
      }
      obj.z -= moveSpeed;

      if (obj.z < -160 && (obj.type !== 'train' || obj.z + (obj.len || 0) < -160)) {
        this.worldObjects.splice(i, 1);
        continue;
      }

      if (this.magnetTimer > 0 && obj.type === 'coin' && !obj.taken) {
        if (obj.z < 480 && obj.z > -20) {
          obj.lane += (runnerLane - obj.lane) * Math.min(1, dt * 12);
          obj.y += ((this.playerBaseY + this.jumpY + 20) - obj.y) * Math.min(1, dt * 10);
        }
      }

      if (obj.type === 'coin' && !obj.taken) {
        if (Math.abs(obj.z - playerZ) < 32 && Math.abs(obj.lane - this.lane) < 0.6) {
          const pY = this.playerBaseY + this.jumpY;
          if (Math.abs(pY - obj.y) < 55) {
            obj.taken = true;
            this.coins += this.scoreMultiplier;
            this.score += 25 * this.scoreMultiplier;
            this.sounds.bubble(1 + (this.coins % 12) * 0.08);
            this.haptics.light();
            const proj = this.project(obj.lane * LANE_DIST, obj.y, obj.z);
            this.fx.burst(proj.x, proj.y, '#facc15', 6, 110, 0.25, 2.5);
            this.worldObjects.splice(i, 1);
            continue;
          }
        }
      }

      if (obj.type === 'powerup' && !obj.taken) {
        if (Math.abs(obj.z - playerZ) < 35 && Math.abs(obj.lane - this.lane) < 0.6) {
          const pY = this.playerBaseY + this.jumpY;
          if (Math.abs(pY - obj.y) < 60) {
            obj.taken = true;
            this.applyPowerup(obj.power);
            const proj = this.project(obj.lane * LANE_DIST, obj.y, obj.z);
            this.fx.burst(proj.x, proj.y, '#f59e0b', 20, 180, 0.6, 4);
            this.fx.ring(proj.x, proj.y, '#38bdf8', 70, 0.45, 3);
            this.worldObjects.splice(i, 1);
            continue;
          }
        }
      }

      if (obj.type === 'mystery' && !obj.taken) {
        if (Math.abs(obj.z - playerZ) < 35 && Math.abs(obj.lane - this.lane) < 0.6) {
          const pY = this.playerBaseY + this.jumpY;
          if (Math.abs(pY - obj.y) < 60) {
            obj.taken = true;
            this.openMysteryBox(obj);
            this.worldObjects.splice(i, 1);
            continue;
          }
        }
      }

      if (obj.type === 'letter' && !obj.taken) {
        if (Math.abs(obj.z - playerZ) < 35 && Math.abs(obj.lane - this.lane) < 0.6) {
          const pY = this.playerBaseY + this.jumpY;
          if (Math.abs(pY - obj.y) < 60) {
            obj.taken = true;
            this.lettersCollected[obj.letter] = true;
            this.sounds.up();
            this.haptics.medium();

            const proj = this.project(obj.lane * LANE_DIST, obj.y, obj.z);
            this.fx.ring(proj.x, proj.y, '#facc15', 80, 0.6, 4);
            this.fx.text(proj.x, proj.y - 30, `LETTER "${obj.letter}"!`, '#f43f5e', 24);

            if (this.lettersCollected.B && this.lettersCollected.E && this.lettersCollected.A && this.lettersCollected.N) {
              this.coins += 1000;
              this.score += 15000;
              this.fx.text(this.W / 2, 260, 'JACKPOT! +1,000 COINS!', '#f59e0b', 28, 1.5);
              this.fx.burst(this.W / 2, 260, '#facc15', 40, 260, 1.0, 5);
              this.sounds.survive();
              this.lettersCollected = { B: false, E: false, A: false, N: false };
            }

            this.worldObjects.splice(i, 1);
            continue;
          }
        }
      }

      if (obj.type === 'hurdle') {
        if (Math.abs(obj.z - playerZ) < 22 && Math.abs(obj.lane - this.lane) < 0.5) {
          const pY = this.playerBaseY + this.jumpY;
          if (pY < 32) {
            if (this.isSliding || pY >= 16) {
              this.triggerStumble('Tripped on a candy hurdle!');
              obj.z = -50;
            } else {
              this.handleCrash('Tripped on a Track Hurdle!');
              return;
            }
          }
        }
      }

      if (obj.type === 'overhead') {
        if (Math.abs(obj.z - playerZ) < 22 && Math.abs(obj.lane - this.lane) < 0.5) {
          const pY = this.playerBaseY + this.jumpY;
          const runnerHeight = this.isSliding ? 25 : 55;
          if (pY + runnerHeight > 44) {
            this.handleCrash('Bonked on Overhead Wooden Sign!');
            return;
          }
        }
      }

      if (obj.type === 'train' && obj.lane === this.lane) {
        if (!obj.hasRamp) {
          if (obj.z <= 25 && obj.z >= -35) {
            const pY = this.playerBaseY + this.jumpY;
            if (pY < 84) {
              this.handleCrash(`SPLAT! Bumped by the ${obj.theme.name}!`);
              return;
            }
          }
        }
      }
    }
  }

  playTrainHorn() {
    this.sounds.trainHorn();
  }

  applyPowerup(power) {
    this.sounds.upgrade();
    this.haptics.heavy();
    const proj = this.project(this.laneX, this.playerBaseY + this.jumpY, 0);

    if (power === 'magnet') {
      this.magnetTimer = 12.0;
      this.fx.text(proj.x, proj.y - 30, 'COIN MAGNET!', '#f43f5e', 20);
    } else if (power === 'jetpack') {
      this.jetpackTimer = 8.5;
      this.fx.text(proj.x, proj.y - 30, 'ROCKET BLAST!', '#38bdf8', 22);
      this.sounds.laser();
    } else if (power === 'sneakers') {
      this.sneakerTimer = 14.0;
      this.fx.text(proj.x, proj.y - 30, 'SPRING SHOES!', '#facc15', 20);
    } else if (power === 'x2') {
      this.doubleTimer = 15.0;
      this.fx.text(proj.x, proj.y - 30, '2X MULTIPLIER!', '#a855f7', 20);
    }
  }

  openMysteryBox(box) {
    this.sounds.survive();
    this.haptics.heavy();
    const proj = this.project(box.lane * LANE_DIST, box.y, box.z);
    this.fx.burst(proj.x, proj.y, '#facc15', 30, 220, 0.8, 5);
    this.fx.ring(proj.x, proj.y, '#38bdf8', 90, 0.5, 4);

    const outcomes = ['board', 'coins', 'score'];
    const pick = outcomes[Math.floor(Math.random() * outcomes.length)];

    if (pick === 'board') {
      this.hoverboardStock++;
      this.fx.text(proj.x, proj.y - 40, '🎁 +1 SURFBOARD!', '#38bdf8', 22);
    } else if (pick === 'coins') {
      this.coins += 500;
      this.score += 5000;
      this.fx.text(proj.x, proj.y - 40, '🎁 +500 COINS!', '#facc15', 22);
    } else {
      this.score += 8000;
      this.fx.text(proj.x, proj.y - 40, '🎁 +8,000 PTS!', '#f43f5e', 22);
    }
  }

  handleCrash(reason) {
    if (this.grace > 0 || this.dead) return;

    if (this.hoverboardActive) {
      this.hoverboardActive = false;
      this.grace = 2.0;
      this.sounds.fail();
      this.haptics.heavy();

      const proj = this.project(this.laneX, this.playerBaseY + this.jumpY, 0);
      this.fx.shake(14, 0.4);
      this.fx.ring(proj.x, proj.y, '#38bdf8', 110, 0.6, 5);
      this.fx.burst(proj.x, proj.y, '#38bdf8', 24, 220, 0.7, 4);
      this.fx.text(proj.x, proj.y - 40, 'SURFBOARD SAVED YOU!', '#38bdf8', 22);
      return;
    }

    this.die(reason);
    this.sounds.fail();
    this.haptics.heavy();
    const proj = this.project(this.laneX, this.playerBaseY + this.jumpY, 0);
    this.fx.shake(22, 0.6);
    this.fx.burst(proj.x, proj.y, '#f43f5e', 36, 260, 1.0, 5);
  }

  /* ------------------------------------------------------------- Pre-Baked 2x DPR Sky & Ground Caches */
  getSkyCache(zone) {
    if (this._skyCaches.has(zone)) return this._skyCaches.get(zone);
    if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') return null;

    const W = this.W;
    const hy = this.horizonY;
    const scale = 2;
    const off = document.createElement('canvas');
    off.width = W * scale;
    off.height = (hy + 26) * scale;
    const c = off.getContext('2d');
    if (!c) return null;
    c.scale(scale, scale);

    const pal = ZONE_PALETTES[zone] || ZONE_PALETTES[0];

    // 1. Flat-cel 3-band sky + radial Weebl Sunburst Rays
    c.fillStyle = pal.skyTop;
    c.fillRect(0, 0, W, hy * 0.42);
    c.fillStyle = pal.skyMid;
    c.fillRect(0, hy * 0.4, W, hy * 0.35);
    c.fillStyle = pal.skyLow;
    c.fillRect(0, hy * 0.72, W, hy * 0.35);

    const rayCount = 16;
    for (let i = 0; i < rayCount; i++) {
      const a0 = -Math.PI + (i / rayCount) * Math.PI;
      const a1 = -Math.PI + ((i + 0.52) / rayCount) * Math.PI;
      c.fillStyle = i % 2 === 0 ? pal.rayA : pal.rayB;
      c.beginPath();
      c.moveTo(W * 0.5, hy);
      c.lineTo(W * 0.5 + Math.cos(a0) * 520, hy + Math.sin(a0) * 520);
      c.lineTo(W * 0.5 + Math.cos(a1) * 520, hy + Math.sin(a1) * 520);
      c.closePath();
      c.fill();
    }

    // Glowing horizon sun dome
    c.fillStyle = 'rgba(255, 255, 255, 0.38)';
    c.beginPath();
    c.arc(W * 0.5, hy, 96, Math.PI, 0);
    c.fill();

    // 2. Inked Liverpool City Horizon Silhouette
    c.fillStyle = pal.citySil;
    c.strokeStyle = STYLE_TOKENS.ink;
    c.lineWidth = 2.4;
    const skyline = [
      [0, 56, 48], [46, 74, 34], [78, 44, 42], [118, 66, 36],
      [152, 34, 28], [178, 52, 46], [222, 40, 40], [260, 62, 34],
      [292, 46, 44], [334, 70, 38], [370, 48, 46], [414, 60, 40],
    ];
    c.beginPath();
    c.moveTo(-4, hy + 10);
    for (const [sx, sh, sw] of skyline) {
      c.lineTo(sx, hy - sh);
      c.lineTo(sx + sw, hy - sh);
    }
    c.lineTo(W + 4, hy + 10);
    c.closePath();
    c.fill();
    c.stroke();

    // 3. Two-Tone #000-Inked Rolling Emerald Hills & Cel Trees
    c.fillStyle = pal.farHill;
    c.beginPath();
    c.moveTo(-4, hy + 18);
    for (let x = -4; x <= W + 4; x += 24) {
      c.lineTo(x, hy - 26 + Math.sin(x * 0.022) * 14);
    }
    c.lineTo(W + 4, hy + 18);
    c.closePath();
    c.fill();
    c.stroke();

    c.fillStyle = pal.nearHill;
    c.beginPath();
    c.moveTo(-4, hy + 20);
    for (let x = -4; x <= W + 4; x += 20) {
      c.lineTo(x, hy - 12 + Math.sin(x * 0.036 + 1.2) * 10);
    }
    c.lineTo(W + 4, hy + 20);
    c.closePath();
    c.fill();
    c.stroke();

    // Crisp #000-inked cel lollipop trees along the ridge
    for (let x = 18; x < W - 12; x += 42) {
      if (Math.abs(x - W * 0.5) < 42) continue; // Keep track vanishing corridor clear
      const ridgeY = hy - 12 + Math.sin(x * 0.036 + 1.2) * 10;
      c.fillStyle = '#92400e';
      c.strokeStyle = STYLE_TOKENS.ink;
      c.lineWidth = 2.0;
      c.beginPath();
      c.roundRect(x - 2.5, ridgeY - 14, 5, 15, 2);
      c.fill();
      c.stroke();

      c.fillStyle = x % 84 === 18 ? '#15803d' : '#22c55e';
      c.beginPath();
      c.arc(x, ridgeY - 19, 10, 0, TAU);
      c.fill();
      c.stroke();

      c.fillStyle = '#86efac';
      c.beginPath();
      c.ellipse(x - 3.5, ridgeY - 22.5, 4, 2.5, -0.5, 0, TAU);
      c.fill();
    }

    this._skyCaches.set(zone, off);
    return off;
  }

  getGroundCache(zone) {
    if (this._groundCaches.has(zone)) return this._groundCaches.get(zone);
    if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') return null;

    const W = this.W;
    const gh = this.H - this.horizonY + 12;
    const scale = 2;
    const off = document.createElement('canvas');
    off.width = W * scale;
    off.height = gh * scale;
    const c = off.getContext('2d');
    if (!c) return null;
    c.scale(scale, scale);

    const pal = ZONE_PALETTES[zone] || ZONE_PALETTES[0];
    c.fillStyle = pal.grassFar;
    c.fillRect(0, 0, W, gh * 0.34);
    c.fillStyle = pal.grassMid;
    c.fillRect(0, gh * 0.32, W, gh * 0.36);
    c.fillStyle = pal.grassNear;
    c.fillRect(0, gh * 0.66, W, gh * 0.36);

    // Subtle crisp cel grass blade stripes on outer verges
    c.fillStyle = 'rgba(255, 255, 255, 0.14)';
    for (let i = 0; i < 26; i++) {
      const gx = (i % 2 === 0 ? 12 : W - 26) + ((i * 19) % 18);
      const gy = 28 + ((i * 53) % (gh - 48));
      c.beginPath();
      c.roundRect(gx, gy, 12, 4, 2);
      c.fill();
    }

    this._groundCaches.set(zone, off);
    return off;
  }

  /* ------------------------------------------------------------- Render Engine */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    const shake = this.fx.offset();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Pre-baked Weebl Sunburst Sky, Hills & Scrolling Clouds
    this.drawEnvironment(ctx, W, H);

    // 2. Continuous Full-Screen Ballast, Curbs, Sleepers, Steel Rails, Tunnel & City Props
    this.drawTracksAndCity(ctx, W, H);

    // 3. Depth-Sorted World Objects, Gantries, Trains, Pickups & Animated Green Hero Bean
    this.drawWorldAndPlayer(ctx);

    // 4. Particle FX Layer
    this.fx.render(ctx, 1.0);

    // 5. #000-Inked Weebl Comic HUD & Surfboard Button
    this.drawHUD(ctx, W, H);

    ctx.restore();
  }

  drawEnvironment(ctx, W) {
    const skyCache = this.getSkyCache(this.currentZone);
    if (skyCache) {
      ctx.drawImage(skyCache, 0, 0, W, this.horizonY + 26);
    } else {
      const pal = ZONE_PALETTES[this.currentZone] || ZONE_PALETTES[0];
      ctx.fillStyle = pal.skyMid;
      ctx.fillRect(0, 0, W, this.horizonY + 20);
    }

    for (const c of this.clouds) {
      drawSprite(ctx, c.sprite, c.x, c.y, c.w, c.h, {
        fallback: (fctx) => {
          fctx.fillStyle = '#ffffff';
          fctx.strokeStyle = STYLE_TOKENS.ink;
          fctx.lineWidth = 2;
          fctx.beginPath();
          fctx.ellipse(0, 0, c.w * 0.42, c.h * 0.36, 0, 0, TAU);
          fctx.fill();
          fctx.stroke();
        },
      });
    }
  }

  drawTracksAndCity(ctx, W, H) {
    const groundCache = this.getGroundCache(this.currentZone);
    if (groundCache) {
      ctx.drawImage(groundCache, 0, this.horizonY, W, H - this.horizonY + 12);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, this.horizonY, W, H - this.horizonY);
    }

    // 1. Stone Platform Apron Curbs flanking the rail corridor (extends past H = 800!)
    const curbFarL = this.project(-214, 0, TRACK_FAR_Z);
    const curbFarR = this.project(214, 0, TRACK_FAR_Z);
    const curbNearL = this.project(-214, 0, TRACK_NEAR_Z);
    const curbNearR = this.project(214, 0, TRACK_NEAR_Z);

    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(curbNearL.x, curbNearL.y);
    ctx.lineTo(curbFarL.x, curbFarL.y);
    ctx.lineTo(curbFarR.x, curbFarR.y);
    ctx.lineTo(curbNearR.x, curbNearR.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Warm Honey/Sand Ballast Gravel Bed inside the stone curbs (extends past H = 800!)
    const pFarL = this.project(-186, 0, TRACK_FAR_Z);
    const pFarR = this.project(186, 0, TRACK_FAR_Z);
    const pNearL = this.project(-186, 0, TRACK_NEAR_Z);
    const pNearR = this.project(186, 0, TRACK_NEAR_Z);

    ctx.fillStyle = '#fde68a';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(pNearL.x, pNearL.y);
    ctx.lineTo(pFarL.x, pFarL.y);
    ctx.lineTo(pFarR.x, pFarR.y);
    ctx.lineTo(pNearR.x, pNearR.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bold yellow platform hazard stripes along left & right curb edges
    const stripeFarL = this.project(-191, 0, TRACK_FAR_Z);
    const stripeNearL = this.project(-191, 0, TRACK_NEAR_Z);
    const stripeFarR = this.project(191, 0, TRACK_FAR_Z);
    const stripeNearR = this.project(191, 0, TRACK_NEAR_Z);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(stripeNearL.x, stripeNearL.y);
    ctx.lineTo(stripeFarL.x, stripeFarL.y);
    ctx.moveTo(stripeNearR.x, stripeNearR.y);
    ctx.lineTo(stripeFarR.x, stripeFarR.y);
    ctx.stroke();

    // 3. Continuous #000-Inked Wooden Railroad Ties (strictly inside ±174 ballast!)
    const tieStart = Math.ceil((TRACK_NEAR_Z + this.trackOffset) / TIE_SPACING) * TIE_SPACING - this.trackOffset;
    ctx.fillStyle = '#92400e';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 1.6;
    for (let z = tieStart; z < 1420; z += TIE_SPACING) {
      if (z <= TRACK_NEAR_Z) continue;
      const pF1 = this.project(-174, 0, z);
      const pF2 = this.project(174, 0, z);
      const pB1 = this.project(-174, 0, z + 13);
      const pB2 = this.project(174, 0, z + 13);
      if (!pF1.visible) continue;

      ctx.beginPath();
      ctx.moveTo(pF1.x, pF1.y);
      ctx.lineTo(pF2.x, pF2.y);
      ctx.lineTo(pB2.x, pB2.y);
      ctx.lineTo(pB1.x, pB1.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (pF1.scale > 0.25) {
        ctx.fillStyle = '#d97706';
        ctx.fillRect(pF1.x + 3 * pF1.scale, pF1.y - 1.5 * pF1.scale, (pF2.x - pF1.x) - 6 * pF1.scale, Math.max(1.2, 2.4 * pF1.scale));
        ctx.fillStyle = '#92400e';
      }
    }

    // 4. Polished #000-Inked Steel Rails extending past bottom edge
    for (const lane of LANES) {
      const lx = lane * LANE_DIST;
      const railHalfW = 32;
      const lN = this.project(lx - railHalfW, 0, TRACK_NEAR_Z);
      const lF = this.project(lx - railHalfW, 0, 1520);
      const rN = this.project(lx + railHalfW, 0, TRACK_NEAR_Z);
      const rF = this.project(lx + railHalfW, 0, 1520);

      // Thick black ink casing
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 6.2;
      ctx.beginPath();
      ctx.moveTo(lN.x, lN.y);
      ctx.lineTo(lF.x, lF.y);
      ctx.moveTo(rN.x, rN.y);
      ctx.lineTo(rF.x, rF.y);
      ctx.stroke();

      // Steel rail core
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3.4;
      ctx.stroke();

      // Specular rail top glint
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(lN.x, lN.y - 0.8);
      ctx.lineTo(lF.x, lF.y - 0.5);
      ctx.moveTo(rN.x, rN.y - 0.8);
      ctx.lineTo(rF.x, rF.y - 0.5);
      ctx.stroke();
    }

    // 5. Scrolling Red-and-White Inked Crossing Posts along Embankment
    const postOffset = this.scrollZ % POST_SPACING;
    const postStart = Math.ceil((TRACK_NEAR_Z + postOffset) / POST_SPACING) * POST_SPACING - postOffset;
    for (let z = postStart; z < 1350; z += POST_SPACING) {
      if (z < 0) continue;
      for (const side of [-1, 1]) {
        const fP = this.project(side * 200, 0, z);
        const fTop = this.project(side * 200, 34, z);
        if (!fP.visible || fP.scale < 0.2) continue;
        const sc = fP.scale;
        const pw = Math.max(2.5, 7 * sc);
        const ph = Math.max(4, fP.y - fTop.y);
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = Math.max(1.1, 2.0 * sc);
        ctx.beginPath();
        ctx.roundRect(fTop.x - pw * 0.5, fTop.y, pw, ph, 2 * sc);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(fTop.x - pw * 0.5 + 0.5, fTop.y + 0.5, pw - 1, Math.max(2, 7 * sc));
      }
    }

    // 6. Scrolling Liverpool Toy City Landmarks flanking the tracks (far-to-near)
    const sortedProps = this.cityProps.slice().sort((a, b) => b.z - a.z);
    for (const p of sortedProps) {
      if (p.z < -40 || p.z > 1350) continue;
      const proj = this.project(p.side * 292, 0, p.z);
      if (!proj.visible || proj.scale < 0.16) continue;
      const sc = proj.scale;
      const dw = 104 * sc;
      const dh = 108 * sc;

      // Grounding oval shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
      ctx.beginPath();
      ctx.ellipse(proj.x, proj.y + 3 * sc, dw * 0.36, 7 * sc, 0, 0, TAU);
      ctx.fill();

      drawSprite(ctx, p.sprite, proj.x, proj.y - dh * 0.22, dw, dh, {
        flipX: p.side > 0 && (p.sprite === 'city_yellow_taxi' || p.sprite === 'city_double_decker'),
        fallback: () => {},
      });
    }

    // 7. Distant Weebl Toy Brick Viaduct Tunnel Portal at Horizon (z = 1560)
    this.drawHorizonTunnel(ctx);
  }

  drawHorizonTunnel(ctx) {
    const tZ = 1560;
    const pL = this.project(-224, 0, tZ);
    const pR = this.project(224, 0, tZ);
    const tL = this.project(-224, 155, tZ);
    const tR = this.project(224, 155, tZ);
    const sc = pL.scale;
    const w = pR.x - pL.x;
    const h = pL.y - tL.y;

    ctx.save();
    ctx.fillStyle = '#991b1b';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(tL.x, tL.y, w, h, 4);
    ctx.fill();
    ctx.stroke();

    // Stone coping lintel & grassy viaduct crown
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.roundRect(tL.x - 4, tL.y - 5, w + 8, 7, 2);
    ctx.fill();
    ctx.stroke();

    // Three dark #000-inked train tunnel arches aligned to LANES
    for (const lane of LANES) {
      const lx = lane * LANE_DIST;
      const aL = this.project(lx - 42, 0, tZ);
      const aR = this.project(lx + 42, 0, tZ);
      const aTop = this.project(lx, 108, tZ);
      const aw = aR.x - aL.x;
      const ah = aL.y - aTop.y;
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(aL.x, aL.y);
      ctx.lineTo(aL.x, aL.y - ah * 0.52);
      ctx.arc((aL.x + aR.x) * 0.5, aL.y - ah * 0.52, aw * 0.5, Math.PI, 0);
      ctx.lineTo(aR.x, aL.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSingleGantry(ctx, g) {
    if (g.z < 10 || g.z > 1520) return;
    const pL = this.project(-198, 134, g.z);
    const pR = this.project(198, 134, g.z);
    const bL = this.project(-198, 0, g.z);
    const bR = this.project(198, 0, g.z);
    if (!pL.visible) return;

    const sc = pL.scale;
    const lw = Math.max(1.1, 2.4 * sc);
    const legW = Math.max(2.5, 8 * sc);
    const beamH = Math.max(3, 9 * sc);

    ctx.fillStyle = g.color;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;

    ctx.beginPath();
    ctx.roundRect(bL.x - legW * 0.5, pL.y, legW, bL.y - pL.y, 2 * sc);
    ctx.roundRect(bR.x - legW * 0.5, pR.y, legW, bR.y - pR.y, 2 * sc);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(pL.x - legW * 0.5, pL.y - beamH * 0.5, (pR.x - pL.x) + legW, beamH, 3 * sc);
    ctx.fill();
    ctx.stroke();

    const boxW = Math.max(5, 16 * sc);
    const boxH = Math.max(7, 22 * sc);
    const bx = pR.x - 24 * sc;
    const by = pR.y + 4 * sc;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 3 * sc);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = g.signal === 'green' ? '#22c55e' : g.signal === 'red' ? '#ef4444' : '#facc15';
    ctx.beginPath();
    ctx.arc(bx + boxW * 0.5, by + boxH * 0.5, Math.max(1.8, 4.4 * sc), 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  drawWorldAndPlayer(ctx) {
    const trains = this.worldObjects.filter((o) => o.type === 'train');
    const drawList = [];

    for (const g of this.gantries) {
      drawList.push({ obj: { type: 'gantry', g }, sortZ: g.z });
    }

    for (const obj of this.worldObjects) {
      if (obj.taken) continue;
      let sortZ = obj.z;
      if (obj.type === 'train') {
        if (obj.z < 0 && obj.z + obj.len > 0) {
          const onOrAboveRoof = obj.lane === this.lane && (this.playerBaseY + this.jumpY >= 60);
          sortZ = (onOrAboveRoof || obj.lane !== this.lane) ? 2 : -1;
        }
      } else if ((obj.y || 0) >= 80) {
        const parent = trains.find((t) => t.lane === obj.lane && obj.z >= t.z - 12 && obj.z <= t.z + t.len + 12);
        if (parent) {
          const parentSortZ = (parent.z < 0 && parent.z + parent.len > 0) ? 2 : parent.z;
          sortZ = parentSortZ - 0.5;
        }
      }
      drawList.push({ obj, sortZ });
    }

    drawList.push({
      obj: {
        type: 'player',
        z: 0,
        laneX: this.laneX,
        heightY: this.playerBaseY + this.jumpY,
      },
      sortZ: 0,
    });

    drawList.sort((a, b) => b.sortZ - a.sortZ);

    for (const { obj } of drawList) {
      if (obj.type === 'gantry') {
        this.drawSingleGantry(ctx, obj.g);
      } else if (obj.type === 'player') {
        this.drawPlayer(ctx, obj);
      } else if (obj.type === 'train') {
        this.drawWeeblTrain(ctx, obj);
      } else if (obj.type === 'hurdle') {
        this.drawWeeblHurdle(ctx, obj);
      } else if (obj.type === 'overhead') {
        this.drawWeeblOverhead(ctx, obj);
      } else if (obj.type === 'coin') {
        this.drawWeeblCoin(ctx, obj);
      } else if (obj.type === 'powerup') {
        this.drawWeeblPowerup(ctx, obj);
      } else if (obj.type === 'mystery') {
        this.drawWeeblMysteryBox(ctx, obj);
      } else if (obj.type === 'letter') {
        this.drawWeeblLetter(ctx, obj);
      } else if (obj.type === 'spray_puff') {
        this.drawWeeblSprayPuff(ctx, obj);
      }
    }
  }

  /* ------------------------------------------------------------- #000-Inked Weebl Object Renderers */
  drawWeeblTrain(ctx, t) {
    const lx = t.lane * LANE_DIST;
    const trainW = 78;
    const trainH = 92;
    const frontZ = Math.max(-75, t.z);
    const backZ = t.z + t.len;

    if (backZ <= -75) return;

    const fBL = this.project(lx - trainW / 2, 0, frontZ);
    const fBR = this.project(lx + trainW / 2, 0, frontZ);
    const fTL = this.project(lx - trainW / 2, trainH, frontZ);
    const fTR = this.project(lx + trainW / 2, trainH, frontZ);

    const bBL = this.project(lx - trainW / 2, 0, backZ);
    const bBR = this.project(lx + trainW / 2, 0, backZ);
    const bTL = this.project(lx - trainW / 2, trainH, backZ);
    const bTR = this.project(lx + trainW / 2, trainH, backZ);

    const sc = fBL.scale;
    const inkW = clamp(2.4 * sc, 1.3, 3.2);

    // 1. Ground shadow on track ballast
    ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
    ctx.beginPath();
    ctx.moveTo(fBL.x - 5 * sc, fBL.y + 3 * sc);
    ctx.lineTo(fBR.x + 5 * sc, fBR.y + 3 * sc);
    ctx.lineTo(bBR.x + 4 * bBR.scale, bBR.y + 2 * bBR.scale);
    ctx.lineTo(bBL.x - 4 * bBL.scale, bBL.y + 2 * bBL.scale);
    ctx.closePath();
    ctx.fill();

    // 2. Flat-Cel Moving Train Headlight Beam (zero gradients!)
    if (t.moving && t.z >= 0 && t.z <= 950) {
      const coneFar = this.project(lx, 0, Math.max(0, t.z - 210));
      ctx.fillStyle = 'rgba(254, 240, 138, 0.28)';
      ctx.beginPath();
      ctx.moveTo(fBL.x - 4 * sc, fBL.y);
      ctx.lineTo(fBR.x + 4 * sc, fBR.y);
      ctx.lineTo(coneFar.x + 46 * coneFar.scale, coneFar.y);
      ctx.lineTo(coneFar.x - 46 * coneFar.scale, coneFar.y);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Train Roof (two-tone Weebl roof + central walkway rib)
    ctx.fillStyle = t.theme.roof;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = inkW;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(fTL.x, fTL.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.lineTo(bTR.x, bTR.y);
    ctx.lineTo(bTL.x, bTL.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Roof racing stripe
    const rFL = this.project(lx - 14, trainH, frontZ);
    const rFR = this.project(lx + 14, trainH, frontZ);
    const rBL = this.project(lx - 14, trainH, backZ);
    const rBR = this.project(lx + 14, trainH, backZ);
    ctx.fillStyle = t.theme.stripe;
    ctx.beginPath();
    ctx.moveTo(rFL.x, rFL.y);
    ctx.lineTo(rFR.x, rFR.y);
    ctx.lineTo(rBR.x, rBR.y);
    ctx.lineTo(rBL.x, rBL.y);
    ctx.closePath();
    ctx.fill();

    // 4. Visible Inner Side Flank ONLY (center lane hides outer flanks accurately in 1-point perspective)
    const drawFlank = (sideSign) => {
      const edgeX = lx + sideSign * (trainW / 2);
      const pFT = sideSign > 0 ? fTR : fTL;
      const pFB = sideSign > 0 ? fBR : fBL;
      const pBT = sideSign > 0 ? bTR : bTL;
      const pBB = sideSign > 0 ? bBR : bBL;

      ctx.fillStyle = t.theme.dark;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = inkW;
      ctx.beginPath();
      ctx.moveTo(pFT.x, pFT.y);
      ctx.lineTo(pBT.x, pBT.y);
      ctx.lineTo(pBB.x, pBB.y);
      ctx.lineTo(pFB.x, pFB.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Perspective-projected livery stripe along flank
      const sFT = this.project(edgeX, 42, frontZ);
      const sFB = this.project(edgeX, 30, frontZ);
      const sBT = this.project(edgeX, 42, backZ);
      const sBB = this.project(edgeX, 30, backZ);
      ctx.fillStyle = t.theme.stripe;
      ctx.beginPath();
      ctx.moveTo(sFT.x, sFT.y);
      ctx.lineTo(sBT.x, sBT.y);
      ctx.lineTo(sBB.x, sBB.y);
      ctx.lineTo(sFB.x, sFB.y);
      ctx.closePath();
      ctx.fill();

      // Perspective-projected passenger windows along carriage flank
      for (let wz = Math.ceil((frontZ + 22) / 90) * 90; wz < backZ - 48; wz += 90) {
        if (wz < frontZ + 12) continue;
        const w1 = this.project(edgeX, 76, wz);
        const w2 = this.project(edgeX, 76, wz + 50);
        const w3 = this.project(edgeX, 50, wz + 50);
        const w4 = this.project(edgeX, 50, wz);
        ctx.fillStyle = '#7dd3fc';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = Math.max(1.0, 1.8 * w1.scale);
        ctx.beginPath();
        ctx.moveTo(w1.x, w1.y);
        ctx.lineTo(w2.x, w2.y);
        ctx.lineTo(w3.x, w3.y);
        ctx.lineTo(w4.x, w4.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    };

    if (t.lane < 0) drawFlank(1);
    else if (t.lane > 0) drawFlank(-1);

    // 5. Train Front Face (drawn smoothly until frontZ passes TRACK_NEAR_Z)
    if (t.z >= -75) {
      const fw = fBR.x - fBL.x;
      const fh = fBL.y - fTL.y;

      // Cel body front
      ctx.fillStyle = t.theme.main;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = inkW;
      ctx.beginPath();
      ctx.roundRect(fTL.x, fTL.y, fw, fh, Math.max(3, 8 * sc));
      ctx.fill();

      // Lower cel shadow band & top highlight rim
      ctx.fillStyle = t.theme.dark;
      ctx.fillRect(fTL.x + 2, fBL.y - fh * 0.28, fw - 4, fh * 0.26);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
      ctx.fillRect(fTL.x + 6 * sc, fTL.y + 3 * sc, fw - 12 * sc, Math.max(2, 5 * sc));

      ctx.beginPath();
      ctx.roundRect(fTL.x, fTL.y, fw, fh, Math.max(3, 8 * sc));
      ctx.stroke();

      // Destination accent stripe across nose
      ctx.fillStyle = t.theme.stripe;
      ctx.fillRect(fTL.x + 2, fTL.y + fh * 0.48, fw - 4, Math.max(3, fh * 0.1));
      ctx.strokeRect(fTL.x + 2, fTL.y + fh * 0.48, fw - 4, Math.max(3, fh * 0.1));

      // Inked dark driver windshield + cel diagonal reflection
      const winW = fw * 0.76;
      const winH = fh * 0.30;
      const winX = (fTL.x + fTR.x) * 0.5 - winW * 0.5;
      const winY = fTL.y + fh * 0.12;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(winX, winY, winW, winH, Math.max(2, 5 * sc));
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.beginPath();
      ctx.moveTo(winX + 4 * sc, winY + winH - 2 * sc);
      ctx.lineTo(winX + winW * 0.42, winY + 2 * sc);
      ctx.lineTo(winX + winW * 0.58, winY + 2 * sc);
      ctx.lineTo(winX + winW * 0.16, winY + winH - 2 * sc);
      ctx.closePath();
      ctx.fill();

      // Crisp #000-Inked Lantern Headlights
      const hlY = fTL.y + fh * 0.68;
      const hlR = Math.max(2.2, 6.2 * sc);
      for (const hx of [winX + 6 * sc, winX + winW - 6 * sc]) {
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = Math.max(1.0, 1.8 * sc);
        ctx.beginPath();
        ctx.arc(hx, hlY, hlR, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      // Steel bumper cowcatcher
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(fBL.x + 2 * sc, fBL.y - fh * 0.16, fw - 4 * sc, fh * 0.16, Math.max(2, 4 * sc));
      ctx.fill();
      ctx.stroke();

      // Climbable Hazard Ramp Wedge
      if (t.hasRamp) {
        const rampTip = this.project(lx, 0, Math.max(-65, t.z - 52));
        const rampTopL = this.project(lx - 26, 48, frontZ);
        const rampTopR = this.project(lx + 26, 48, frontZ);
        const rampBotL = this.project(lx - 28, 0, Math.max(-65, t.z - 52));
        const rampBotR = this.project(lx + 28, 0, Math.max(-65, t.z - 52));

        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = inkW;
        ctx.beginPath();
        ctx.moveTo(rampTopL.x, rampTopL.y);
        ctx.lineTo(rampTopR.x, rampTopR.y);
        ctx.lineTo(rampBotR.x, rampBotR.y);
        ctx.lineTo(rampBotL.x, rampBotL.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Chevron boost arrow on ramp
        if (sc > 0.25) {
          drawComicText(
            ctx,
            '▲ HOP ON! ▲',
            (fTL.x + fTR.x) * 0.5,
            (rampTopL.y + rampTip.y) * 0.5,
            `900 ${Math.max(9, Math.round(12 * sc))}px 'Fredoka', 'Outfit', sans-serif`,
            '#ffffff',
            { strokeWidth: 3.0 }
          );
        }
      }
    }
  }

  drawWeeblHurdle(ctx, h) {
    const lx = h.lane * LANE_DIST;
    const barW = 72;
    const barH = 36;

    const pBL = this.project(lx - barW / 2, 0, h.z);
    const pBR = this.project(lx + barW / 2, 0, h.z);
    const pTL = this.project(lx - barW / 2, barH, h.z);
    const pTR = this.project(lx + barW / 2, barH, h.z);
    if (!pBL.visible) return;

    const w = pBR.x - pBL.x;
    const hgt = pBL.y - pTL.y;
    const sc = pBL.scale;
    const lw = Math.max(1.2, 2.2 * sc);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse((pBL.x + pBR.x) * 0.5, pBL.y + 2 * sc, w * 0.48, 5 * sc, 0, 0, TAU);
    ctx.fill();

    // Timber legs
    ctx.fillStyle = '#b45309';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;
    for (const px of [pBL.x, pBR.x - 6 * sc]) {
      ctx.beginPath();
      ctx.roundRect(px, pTL.y, 6 * sc, hgt, 2 * sc);
      ctx.fill();
      ctx.stroke();
    }

    // Peppermint barrier bar
    const barCh = hgt * 0.48;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(pTL.x, pTL.y, w, barCh, 4 * sc);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pTL.x, pTL.y, w, barCh, 4 * sc);
    ctx.clip();
    ctx.fillStyle = '#ef4444';
    for (let x = pTL.x + 4 * sc; x < pTR.x - 3 * sc; x += 14 * sc) {
      ctx.fillRect(x, pTL.y, 7 * sc, barCh);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.roundRect(pTL.x, pTL.y, w, barCh, 4 * sc);
    ctx.stroke();
  }

  drawWeeblOverhead(ctx, o) {
    const lx = o.lane * LANE_DIST;
    const barW = 86;
    const topH = 104;
    const botH = 48;

    const pTL = this.project(lx - barW / 2, topH, o.z);
    const pTR = this.project(lx + barW / 2, topH, o.z);
    const pBL = this.project(lx - barW / 2, botH, o.z);
    const pGL = this.project(lx - barW / 2, 0, o.z);
    const pGR = this.project(lx + barW / 2, 0, o.z);
    if (!pTL.visible) return;

    const w = pTR.x - pTL.x;
    const hgt = pBL.y - pTL.y;
    const sc = pTL.scale;
    const lw = Math.max(1.2, 2.3 * sc);
    const legW = Math.max(2.5, 6.5 * sc);

    // Planted red-and-white striped support pillars down to track sleepers!
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;
    for (const px of [pTL.x + legW * 0.2, pTR.x - legW * 1.2]) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(px, pTL.y + 4 * sc, legW, pGL.y - pTL.y - 4 * sc, 2 * sc);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(px + 0.5, pBL.y + 6 * sc, legW - 1, (pGR.y - pBL.y) * 0.35);
      ctx.stroke();
    }

    // Bold #000-Inked Sunny Overhead Hazard Sign
    drawComicPanel(ctx, pTL.x, pTL.y, w, hgt, Math.max(4, 7 * sc), '#facc15', {
      lineWidth: lw,
      shadowDx: 1.5 * sc,
      shadowDy: 2.5 * sc,
    });

    if (sc > 0.24) {
      drawComicText(
        ctx,
        '▼ DUCK! ▼',
        (pTL.x + pTR.x) * 0.5,
        (pTL.y + pBL.y) * 0.5 + 1,
        `900 ${Math.max(9, Math.round(12.5 * sc))}px 'Fredoka', 'Outfit', sans-serif`,
        '#ef4444',
        { stroke: '#000000', strokeWidth: Math.max(2.2, 3.2 * sc) }
      );
    }
  }

  drawWeeblCoin(ctx, c) {
    const lx = c.lane * LANE_DIST;
    const p = this.project(lx, c.y, c.z);
    if (!p.visible) return;

    const r = Math.max(3.6, 9.5 * p.scale);
    const spin = Math.sin(this.time * 8 + c.z * 0.05);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(Math.max(0.28, Math.abs(spin)), 1);
    drawGoldCoinBadge(ctx, 0, 0, r, Math.max(1.2, 2.0 * p.scale));
    ctx.restore();
  }

  drawWeeblPowerup(ctx, p) {
    const lx = p.lane * LANE_DIST;
    const proj = this.project(lx, p.y, p.z);
    if (!proj.visible) return;

    const r = Math.max(8, 17 * proj.scale);
    const bob = Math.sin(this.time * 6 + p.z) * 4 * proj.scale;

    let col = '#38bdf8';
    let icon = '🧲';
    if (p.power === 'jetpack') { col = '#f43f5e'; icon = '🚀'; }
    else if (p.power === 'sneakers') { col = '#facc15'; icon = '👟'; }
    else if (p.power === 'x2') { col = '#a855f7'; icon = '2X'; }

    ctx.save();
    ctx.translate(proj.x, proj.y + bob);

    ctx.fillStyle = col;
    ctx.globalAlpha = 0.26;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.28, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = col;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = Math.max(1.4, 2.4 * proj.scale);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.3, r * 0.32, r * 0.16, -0.5, 0, TAU);
    ctx.fill();

    drawComicText(
      ctx,
      icon,
      0,
      1,
      `900 ${Math.max(10, Math.round(14 * proj.scale))}px 'Fredoka', 'Outfit', sans-serif`,
      '#ffffff',
      { strokeWidth: Math.max(2.0, 2.8 * proj.scale) }
    );

    ctx.restore();
  }

  drawWeeblMysteryBox(ctx, m) {
    const lx = m.lane * LANE_DIST;
    const proj = this.project(lx, m.y, m.z);
    if (!proj.visible) return;

    const size = Math.max(14, 28 * proj.scale);
    const bob = Math.sin(this.time * 7 + m.z) * 5 * proj.scale;

    ctx.save();
    ctx.translate(proj.x, proj.y + bob);

    drawComicPanel(ctx, -size * 0.5, -size * 0.5, size, size, Math.max(4, 6 * proj.scale), '#f43f5e', {
      lineWidth: Math.max(1.3, 2.2 * proj.scale),
      shadowDx: 1.5 * proj.scale,
      shadowDy: 2.5 * proj.scale,
    });

    ctx.fillStyle = '#facc15';
    ctx.fillRect(-size * 0.12, -size * 0.44, size * 0.24, size * 0.88);
    ctx.fillRect(-size * 0.44, -size * 0.12, size * 0.88, size * 0.24);

    drawComicText(
      ctx,
      '?',
      0,
      1,
      `900 ${Math.max(10, Math.round(15 * proj.scale))}px 'Fredoka', 'Outfit', sans-serif`,
      '#ffffff',
      { strokeWidth: Math.max(2.0, 2.8 * proj.scale) }
    );

    ctx.restore();
  }

  drawWeeblLetter(ctx, l) {
    const lx = l.lane * LANE_DIST;
    const proj = this.project(lx, l.y, l.z);
    if (!proj.visible) return;

    const size = Math.max(15, 29 * proj.scale);
    const bob = Math.sin(this.time * 5) * 5 * proj.scale;

    ctx.save();
    ctx.translate(proj.x, proj.y + bob);

    drawComicPanel(ctx, -size * 0.5, -size * 0.5, size, size, Math.max(4, 7 * proj.scale), '#facc15', {
      lineWidth: Math.max(1.4, 2.4 * proj.scale),
      shadowDx: 1.5 * proj.scale,
      shadowDy: 2.5 * proj.scale,
    });

    drawComicText(
      ctx,
      l.letter,
      0,
      1,
      `900 ${Math.max(11, Math.round(16 * proj.scale))}px 'Fredoka', 'Outfit', sans-serif`,
      '#ffffff',
      { strokeWidth: Math.max(2.4, 3.2 * proj.scale) }
    );

    ctx.restore();
  }

  drawWeeblSprayPuff(ctx, p) {
    const proj = this.project(p.lane * LANE_DIST, p.y, p.z);
    if (!proj.visible) return;

    ctx.fillStyle = p.col;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = Math.max(1.0, 1.8 * proj.scale);
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, Math.max(2.5, 6.5 * proj.scale), 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  drawPlayer(ctx, p) {
    const proj = this.project(p.laneX, p.heightY, 0);
    const groundProj = this.project(p.laneX, 0, 0);
    const footOffset = 10;

    // Ground shadow pulsing slightly with stride
    const hScale = clamp(1 - p.heightY / 240, 0.35, 1);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.34 * hScale})`;
    ctx.beginPath();
    ctx.ellipse(groundProj.x, groundProj.y + footOffset, 18 * hScale, 6.5 * hScale, 0, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(proj.x, proj.y + footOffset);
    ctx.rotate(this.tiltAngle);

    // Striped Weebl Parachute
    if (this.parachuteTimer > 0) {
      ctx.save();
      ctx.fillStyle = '#f43f5e';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, -58, 34, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(0, -58);
      ctx.arc(0, -58, 34, Math.PI * 1.25, Math.PI * 1.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-32, -58); ctx.lineTo(0, -26);
      ctx.moveTo(32, -58); ctx.lineTo(0, -26);
      ctx.moveTo(0, -58); ctx.lineTo(0, -26);
      ctx.stroke();
      ctx.restore();
    }

    // Animated Cel-Shaded 3D Crowned Green Hero Bean (with clean 2D fallback in headless SSR)
    let mode = 'run';
    if (this.dead) mode = 'dead';
    else if (this.isSliding) mode = 'slide';
    else if (this.jetpackTimer > 0) mode = 'jetpack';
    else if (this.hoverboardActive) mode = 'surf';
    else if (this.isJumping) mode = 'jump';

    const lookDir = clamp((this.lane * LANE_DIST - this.laneX) * 0.015, -0.75, 0.75);
    const spinYaw = !this.dead && !this.isSliding ? this.spinAngle : 0;
    const drew3D = drawHeroCharacter(ctx, 0, 0, 64, {
      view: mode === 'slide' || mode === 'jetpack' ? 'threeQuarterRear' : mode === 'dead' ? 'front' : 'rear',
      yaw:
        mode === 'dead'
          ? 0
          : mode === 'surf'
          ? Math.PI + spinYaw
          : mode === 'slide'
          ? Math.PI - 0.42
          : mode === 'jetpack'
          ? Math.PI - 0.34 + lookDir * 0.35
          : mode === 'jump'
          ? Math.PI - 0.26 + lookDir * 0.42 + spinYaw
          : Math.PI - 0.14 + lookDir * 0.46 + spinYaw,
      pitch: mode === 'run' ? 0.25 : mode === 'jump' ? 0.18 : undefined,
      state: mode,
      expr: mode === 'dead' ? 'dizzy' : mode === 'jump' || mode === 'surf' ? 'happy' : 'focus',
      t: mode === 'run' ? this.runAnimT : this.time * 4.5,
      lean: this.tiltAngle,
      lookX: lookDir,
      prop: this.jetpackTimer > 0 ? 'jetpack' : this.hoverboardActive ? 'hoverboard' : 'none',
    });

    if (this.hoverboardActive) {
      ctx.save();
      if (!drew3D) {
        const hbPulse = 1 + Math.sin(this.time * 12) * 0.05;
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(0, 2, 28 * hbPulse, 8, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.8)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, -28, 39, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (this.dead) {
      const starT = this.time * 6;
      drawComicText(ctx, '💫', Math.cos(starT) * 22, -54 + Math.sin(starT) * 6, "14px 'Fredoka', sans-serif", '#fde047', { strokeWidth: 2 });
      drawComicText(ctx, '⭐', Math.cos(starT + Math.PI) * 22, -54 + Math.sin(starT + Math.PI) * 6, "14px 'Fredoka', sans-serif", '#fde047', { strokeWidth: 2 });
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------- #000-Inked Weebl Comic HUD */
  drawHudBadgeIcon(ctx, kind, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 1.9;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (kind === 'dist') {
      // Crisp cel lightning bolt speed emblem
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(2, -7);
      ctx.lineTo(-4.5, 1);
      ctx.lineTo(-0.5, 1);
      ctx.lineTo(-2, 7);
      ctx.lineTo(4.5, -1);
      ctx.lineTo(0.5, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'surf') {
      ctx.save();
      ctx.rotate(-0.22);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 4.2, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-2, -1, 4.5, 1.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (kind === 'rocket') {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 2);
      ctx.lineTo(0, 5);
      ctx.lineTo(-4, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'magnet') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, -1, 4.5, Math.PI, 0, false);
      ctx.lineTo(4.5, 4);
      ctx.moveTo(-4.5, -1);
      ctx.lineTo(-4.5, 4);
      ctx.stroke();
    } else if (kind === 'sneakers') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-6, -2, 12, 6, 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHUD(ctx, W, H) {
    // 1. Top-Left Distance & Multiplier Panel
    drawComicPanel(ctx, 14, 104, 128, 36, 11, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    this.drawHudBadgeIcon(ctx, 'dist', 30, 122);
    const distLabel = this.scoreMultiplier > 1
      ? `${Math.floor(this.distance)}m ×${this.scoreMultiplier}`
      : `${Math.floor(this.distance)}m`;
    drawComicText(ctx, distLabel, 86, 123, FONT_HUD_MD, '#38bdf8', { strokeWidth: 3.0 });

    // 2. Top-Center "B E A N" Word Hunt Tiles
    const letters = ['B', 'E', 'A', 'N'];
    const tileW = 26;
    const startX = W * 0.5 - (letters.length * 30) * 0.5 + 2;
    for (let i = 0; i < letters.length; i++) {
      const ch = letters[i];
      const got = this.lettersCollected[ch];
      const lx = startX + i * 30;
      drawComicPanel(ctx, lx, 107, tileW, 30, 8, got ? '#facc15' : '#1e293b', {
        lineWidth: 2.4,
        shadowDx: 1.5,
        shadowDy: 2.5,
      });
      drawComicText(ctx, ch, lx + tileW * 0.5, 122.5, FONT_HUD_MD, got ? '#ffffff' : '#64748b', {
        strokeWidth: got ? 3.2 : 2.0,
      });
    }

    // 3. Top-Right Gold Coin Panel
    drawComicPanel(ctx, W - 116, 104, 102, 36, 11, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawGoldCoinBadge(ctx, W - 96, 122, 8.2, 2.0);
    drawComicText(ctx, `${this.coins}`, W - 52, 123, FONT_HUD_LG, '#fde047', { strokeWidth: 3.2 });

    // 4. Active Power-up Progress Pills (y = 148+)
    let pillY = 148;

    const drawTimerPill = (label, iconKind, col, timer, maxT) => {
      const pw = 144;
      const ph = 20;
      const px = W * 0.5 - pw * 0.5;
      drawComicPanel(ctx, px, pillY, pw, ph, 10, '#0f172a', {
        lineWidth: 2.2,
        shadowDx: 1,
        shadowDy: 2,
        glossTop: false,
      });
      const fillW = (pw - 6) * clamp(timer / maxT, 0, 1);
      if (fillW >= 4) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(px + 3, pillY + 3, fillW, ph - 6, 7);
        ctx.fill();
      }
      if (iconKind) {
        this.drawHudBadgeIcon(ctx, iconKind, px + 22, pillY + ph * 0.5);
      }
      drawComicText(ctx, label, W * 0.5 + (iconKind ? 7 : 0), pillY + ph * 0.5 + 0.5, FONT_HUD_SM, '#ffffff', { strokeWidth: 2.8 });
      pillY += 24;
    };

    if (this.jetpackTimer > 0) drawTimerPill('ROCKET', 'rocket', '#38bdf8', this.jetpackTimer, 8.5);
    if (this.magnetTimer > 0) drawTimerPill('MAGNET', 'magnet', '#f43f5e', this.magnetTimer, 12.0);
    if (this.sneakerTimer > 0) drawTimerPill('SPRINGS', 'sneakers', '#facc15', this.sneakerTimer, 14.0);
    if (this.doubleTimer > 0) drawTimerPill('2X COINS', null, '#a855f7', this.doubleTimer, 15.0);

    // 5. Bottom-Right Surfboard Quick-Deploy Button (cleanly clear of bottom-left #adminDock)
    const hbW = 84;
    const hbH = 48;
    const hbX = W - hbW - 12;
    const hbY = H - hbH - 14;
    const hbCol = this.hoverboardActive ? '#38bdf8' : (this.hoverboardStock > 0 ? '#facc15' : '#334155');
    drawComicPanel(ctx, hbX, hbY, hbW, hbH, 13, hbCol, {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    this.drawHudBadgeIcon(ctx, 'surf', hbX + 20, hbY + 17);
    drawComicText(ctx, 'SURF', hbX + 54, hbY + 17.5, FONT_BADGE, '#ffffff', { strokeWidth: 3.0 });
    drawComicText(
      ctx,
      this.hoverboardActive ? 'ACTIVE' : `×${this.hoverboardStock}`,
      hbX + hbW * 0.5,
      hbY + 35,
      FONT_HUD_SM,
      this.hoverboardActive ? '#fef08a' : (this.hoverboardStock > 0 ? '#ffffff' : '#94a3b8'),
      { strokeWidth: 2.8 }
    );
  }

  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
}
