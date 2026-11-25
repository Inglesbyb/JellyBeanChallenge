import Matter from 'matter-js';
import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import {
  STYLE_TOKENS,
  preloadWeeblAtlas,
  drawSprite,
  drawSunburst,
  drawComicPanel,
  drawComicStarburst,
  drawComicText as _rawDrawComicText,
  drawWeeblCelBean,
  drawHeroCharacter,
} from './weeblAtlas.js';

const { Engine, Composite, Bodies, Body, Events } = Matter;

// Centered jar geometry inside 450x800 frame (350px playable width, 50px symmetrical gutters)
const L = 50;
const R = 400;
const MID = (L + R) / 2; // 225
const FLOOR = 710;
const LINE = 238;
const SPAWN_Y = 186;
const JAR_TOP = 166;
const TAU = Math.PI * 2;

export const FR = [
  { name: 'Cherry Drop',          r: 15, c: '#ff3366', topC: '#ff758f', shade: '#be123c', pts: 2,   leaf: true },
  { name: 'Sour Strawberry',      r: 21, c: '#ef4444', topC: '#fb7185', shade: '#b91c1c', pts: 4,   calyx: true },
  { name: 'Grape Gumdrop',        r: 27, c: '#9333ea', topC: '#c084fc', shade: '#6b21a8', pts: 8,   stem: true },
  { name: 'Glazed Mandarin',      r: 34, c: '#f97316', topC: '#fdba74', shade: '#c2410c', pts: 12,  slice: true },
  { name: 'Candy Apple',          r: 42, c: '#dc2626', topC: '#f87171', shade: '#991b1b', pts: 18,  stick: true },
  { name: 'Sugar Pear',           r: 51, c: '#4ade80', topC: '#bbf7d0', shade: '#15803d', pts: 25,  pear: true },
  { name: 'Peach Ring Gumdrop',   r: 61, c: '#fb923c', topC: '#fed7aa', shade: '#ea580c', pts: 34,  peach: true },
  { name: 'Golden Pineapple',     r: 72, c: '#facc15', topC: '#fef08a', shade: '#ca8a04', pts: 45,  crown: true },
  { name: 'Honey Dewdrop Melon',  r: 84, c: '#34d399', topC: '#a7f3d0', shade: '#059669', pts: 58,  mesh: true },
  { name: 'Watermelon Colossus',  r: 96, c: '#16a34a', topC: '#4ade80', shade: '#14532d', pts: 75,  stripes: true },
  { name: 'Superlambanana Berry', r: 108, c: '#facc15', topC: '#fef08a', shade: '#eab308', pts: 1000, king: true },
];

const TOP = FR.length - 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const dropTier = () => {
  const r = Math.random();
  if (r < 0.04) return -1; // 4% chance for Rainbow Joker Bean!
  if (r < 0.07) return -2; // 3% chance for Pop-Rock TNT Bomb!
  if (r < 0.42) return 0;  // Cherry Drop
  if (r < 0.72) return 1;  // Strawberry
  if (r < 0.90) return 2;  // Grape
  return 3;                // Mandarin
};

const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

/* ------------------------------------------------------------ 2x PNG Bitmap Caches (Locked 60 FPS) */
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
  const strokeW = opts.strokeWidth ?? 4.2;
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
    img.decode?.().catch(() => {});

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

const FRUIT_STAMP_CACHE = new Map();

function inkWidthForR(r) {
  return clamp(r * 0.08 + 1.4, 2.2, 3.8);
}

function getFruitBodyStamp(tier) {
  if (FRUIT_STAMP_CACHE.has(tier)) return FRUIT_STAMP_CACHE.get(tier);
  if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') return null;

  const r = tier < 0 ? 22 : FR[tier].r;
  const pad = Math.ceil(Math.max(14, r * 0.36));
  const half = Math.ceil(r + pad);
  const size = half * 2;

  const c = document.createElement('canvas');
  const sctx = c.getContext?.('2d');
  if (!sctx || typeof c.toDataURL !== 'function') return null;

  c.width = size * 2;
  c.height = size * 2;
  sctx.scale(2, 2);
  sctx.translate(half, half);
  sctx.lineCap = 'round';
  sctx.lineJoin = 'round';

  const lw = inkWidthForR(r);

  if (tier === -1) {
    // Spinning 5-wedge #000-inked Rainbow Joker Wheel
    const cols = ['#ff3366', '#facc15', '#22c55e', '#38bdf8', '#a855f7'];
    for (let i = 0; i < 5; i++) {
      sctx.fillStyle = cols[i];
      sctx.beginPath();
      sctx.moveTo(0, 0);
      sctx.arc(0, 0, r, (i / 5) * TAU, ((i + 1) / 5) * TAU);
      sctx.closePath();
      sctx.fill();
      sctx.strokeStyle = STYLE_TOKENS.ink;
      sctx.lineWidth = 1.6;
      sctx.stroke();
    }
    sctx.strokeStyle = STYLE_TOKENS.ink;
    sctx.lineWidth = lw;
    sctx.beginPath();
    sctx.arc(0, 0, r, 0, TAU);
    sctx.stroke();

    sctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    sctx.beginPath();
    sctx.ellipse(-r * 0.32, -r * 0.36, r * 0.28, r * 0.14, -0.5, 0, TAU);
    sctx.fill();
  } else if (tier === -2) {
    // Chunky #000-inked Pop-Rock TNT Bomb (paired with b_tnt_barrel look)
    sctx.fillStyle = '#334155';
    sctx.beginPath();
    sctx.arc(0, 0, r, 0, TAU);
    sctx.fill();

    sctx.save();
    sctx.beginPath();
    sctx.arc(0, 0, r, 0, TAU);
    sctx.clip();
    sctx.fillStyle = '#1e293b';
    sctx.beginPath();
    sctx.arc(r * 0.32, r * 0.32, r * 0.96, 0, TAU);
    sctx.fill();
    // Red hazard belly stripe
    sctx.fillStyle = '#dc2626';
    sctx.fillRect(-r, -r * 0.22, r * 2, r * 0.44);
    sctx.strokeStyle = STYLE_TOKENS.ink;
    sctx.lineWidth = 1.8;
    sctx.strokeRect(-r, -r * 0.22, r * 2, r * 0.44);
    sctx.restore();

    sctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    sctx.beginPath();
    sctx.ellipse(-r * 0.34, -r * 0.4, r * 0.28, r * 0.14, -0.52, 0, TAU);
    sctx.fill();

    sctx.strokeStyle = STYLE_TOKENS.ink;
    sctx.lineWidth = lw;
    sctx.beginPath();
    sctx.arc(0, 0, r, 0, TAU);
    sctx.stroke();

    // Gold fuse cap & cord
    sctx.fillStyle = '#facc15';
    sctx.strokeStyle = STYLE_TOKENS.ink;
    sctx.lineWidth = 2.0;
    sctx.beginPath();
    sctx.roundRect(r * 0.2, -r * 1.04, r * 0.48, r * 0.28, 3);
    sctx.fill();
    sctx.stroke();

    sctx.strokeStyle = STYLE_TOKENS.ink;
    sctx.lineWidth = 4.2;
    sctx.beginPath();
    sctx.moveTo(r * 0.46, -r * 1.02);
    sctx.quadraticCurveTo(r * 0.74, -r * 1.32, r * 0.92, -r * 1.12);
    sctx.stroke();
    sctx.strokeStyle = '#fef08a';
    sctx.lineWidth = 2.0;
    sctx.stroke();
  } else {
    // 11 #000-Inked 2-Tone Flash Cel Confectionery Tiers
    const f = FR[tier];

    sctx.fillStyle = f.c;
    sctx.beginPath();
    sctx.arc(0, 0, r, 0, TAU);
    sctx.fill();

    // Clipped 2-tone cel lighting + fruit patterns (baked once!)
    sctx.save();
    sctx.beginPath();
    sctx.arc(0, 0, r, 0, TAU);
    sctx.clip();

    // Lower-right 2-tone cel shadow crescent
    sctx.fillStyle = f.shade;
    sctx.beginPath();
    sctx.arc(r * 0.28, r * 0.32, r * 0.96, 0, TAU);
    sctx.fill();

    // Re-carve main lit body offset to upper-left
    sctx.fillStyle = f.c;
    sctx.beginPath();
    sctx.arc(-r * 0.14, -r * 0.16, r * 0.94, 0, TAU);
    sctx.fill();

    // Upper-left bright cel cap
    sctx.fillStyle = f.topC;
    sctx.beginPath();
    sctx.ellipse(-r * 0.22, -r * 0.34, r * 0.66, r * 0.46, -0.32, 0, TAU);
    sctx.fill();

    if (f.stripes) {
      sctx.strokeStyle = '#14532d';
      sctx.lineWidth = Math.max(4, r * 0.11);
      for (let a = -0.68; a <= 0.68; a += 0.44) {
        sctx.beginPath();
        sctx.arc(0, 0, r * 0.86, a - 0.24, a + 0.24);
        sctx.stroke();
      }
    } else if (f.mesh) {
      sctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
      sctx.lineWidth = Math.max(1.8, r * 0.032);
      for (let k = -2; k <= 2; k++) {
        sctx.beginPath();
        sctx.arc(k * r * 0.38, 0, r * 0.9, -1.1, 1.1);
        sctx.stroke();
      }
    } else if (f.slice) {
      sctx.strokeStyle = 'rgba(255, 247, 237, 0.48)';
      sctx.lineWidth = Math.max(1.6, r * 0.055);
      sctx.beginPath();
      sctx.arc(0, 0, r * 0.62, -0.85, 0.85);
      sctx.stroke();
    } else if (f.peach) {
      sctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      sctx.lineWidth = Math.max(3, r * 0.09);
      sctx.beginPath();
      sctx.arc(0, r * 0.06, r * 0.52, 0, TAU);
      sctx.stroke();
    }
    sctx.restore();

    // Heavy #000 outer ink contour
    sctx.strokeStyle = STYLE_TOKENS.ink;
    sctx.lineWidth = lw;
    sctx.beginPath();
    sctx.arc(0, 0, r, 0, TAU);
    sctx.stroke();

    // Crisp glossy Flash cel pill highlight
    sctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    sctx.beginPath();
    sctx.ellipse(-r * 0.36, -r * 0.42, r * 0.28, r * 0.13, -0.52, 0, TAU);
    sctx.fill();

    // Inked botanical / royal toppings
    if (f.leaf || f.pear) {
      sctx.strokeStyle = STYLE_TOKENS.ink;
      sctx.lineWidth = Math.max(3.6, r * 0.15);
      sctx.beginPath();
      sctx.moveTo(0, -r * 0.88);
      sctx.quadraticCurveTo(r * 0.12, -r * 1.16, r * 0.24, -r * 1.18);
      sctx.stroke();
      sctx.strokeStyle = '#92400e';
      sctx.lineWidth = Math.max(1.6, r * 0.07);
      sctx.stroke();

      sctx.fillStyle = '#22c55e';
      sctx.strokeStyle = STYLE_TOKENS.ink;
      sctx.lineWidth = Math.max(1.6, r * 0.07);
      sctx.beginPath();
      sctx.ellipse(r * 0.23, -r * 1.0, Math.max(4.5, r * 0.29), Math.max(2.6, r * 0.14), -0.45, 0, TAU);
      sctx.fill();
      sctx.stroke();
    } else if (f.stem) {
      sctx.strokeStyle = STYLE_TOKENS.ink;
      sctx.lineWidth = Math.max(3.4, r * 0.13);
      sctx.beginPath();
      sctx.moveTo(0, -r * 0.88);
      sctx.quadraticCurveTo(-r * 0.08, -r * 1.14, r * 0.14, -r * 1.18);
      sctx.stroke();
      sctx.strokeStyle = '#a855f7';
      sctx.lineWidth = Math.max(1.5, r * 0.06);
      sctx.stroke();
    } else if (f.stick) {
      sctx.fillStyle = '#d97706';
      sctx.strokeStyle = STYLE_TOKENS.ink;
      sctx.lineWidth = 2.0;
      sctx.beginPath();
      sctx.roundRect(-r * 0.09, -r * 1.25, r * 0.18, r * 0.42, 3);
      sctx.fill();
      sctx.stroke();
    } else if (f.crown) {
      sctx.fillStyle = '#22c55e';
      sctx.strokeStyle = STYLE_TOKENS.ink;
      sctx.lineWidth = 2.6;
      sctx.beginPath();
      sctx.moveTo(-16, -r + 4);
      sctx.lineTo(-22, -r - 20);
      sctx.lineTo(-7, -r - 9);
      sctx.lineTo(0, -r - 26);
      sctx.lineTo(7, -r - 9);
      sctx.lineTo(22, -r - 20);
      sctx.lineTo(16, -r + 4);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();
    } else if (f.calyx) {
      sctx.fillStyle = '#22c55e';
      sctx.strokeStyle = STYLE_TOKENS.ink;
      sctx.lineWidth = 1.9;
      for (const [ox, oy, ang, sx, sy] of [
        [0, -r + 3, 0, 9.5, 4],
        [-7, -r + 5, -0.55, 7.5, 3.4],
        [7, -r + 5, 0.55, 7.5, 3.4],
      ]) {
        sctx.beginPath();
        sctx.ellipse(ox, oy, sx, sy, ang, 0, TAU);
        sctx.fill();
        sctx.stroke();
      }
    } else if (f.king) {
      // Superlambanana Berry: Magenta Lamb Ears + Golden 3-Point Royal Crown
      sctx.fillStyle = '#f472b6';
      sctx.strokeStyle = STYLE_TOKENS.ink;
      sctx.lineWidth = 2.8;
      sctx.beginPath(); sctx.ellipse(-r * 0.72, -r * 0.58, 17, 10, -0.7, 0, TAU); sctx.fill(); sctx.stroke();
      sctx.beginPath(); sctx.ellipse(r * 0.72, -r * 0.58, 17, 10, 0.7, 0, TAU); sctx.fill(); sctx.stroke();

      sctx.fillStyle = '#fde047';
      sctx.strokeStyle = STYLE_TOKENS.ink;
      sctx.lineWidth = 2.8;
      sctx.beginPath();
      sctx.moveTo(-18, -r + 6);
      sctx.lineTo(-21, -r - 19);
      sctx.lineTo(-7, -r - 7);
      sctx.lineTo(0, -r - 25);
      sctx.lineTo(7, -r - 7);
      sctx.lineTo(21, -r - 19);
      sctx.lineTo(18, -r + 6);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();
    }
  }

  let img = null;
  if (typeof Image !== 'undefined') {
    img = new Image();
    img.decoding = 'async';
    img.src = c.toDataURL('image/png');
    img.decode?.().catch(() => {});
  }
  const entry = { canvas: c, img, size };
  FRUIT_STAMP_CACHE.set(tier, entry);
  return entry;
}

export class FruitMerge extends Game {
  static meta = {
    id: 'fruit-merge',
    title: 'Jelly Suika',
    icon: '🍉',
    hint: 'DRAG to aim · RELEASE to drop · merge matching confectionery · shake to unjam!',
    baseLikes: 4120,
    isPrestige: true,
    parScore60s: 1800,
    cue: 'DROP & MERGE SWEETS!',
    prestigeCue: 'HEAVIER DROP · MORE PEGS!',
    scaling: {
      gravityY:      { base: 1.15, rate: 0.16, cap: 1.60, mode: 'up',   label: 'Drop Gravity' },
      pegCount:      { base: 0,    rate: 0.32, cap: 3,    mode: 'up',   round: true, deltaFormat: 'abs', label: 'Jar Pegs' },
      overflowGrace: { base: 3.0,  rate: 0.20, floor: 1.6, mode: 'down', label: 'Overflow Grace' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    preloadWeeblAtlas();
    this.pLevel = Math.max(1, this.prestige || 1);
    this.engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
    this.engine.gravity.y = this.diff.gravityY ?? 1.15;
    this.acc = 0;
    this.mergeQ = [];
    this.overT = 0;
    this.cool = 0.3;
    this.aimX = MID;
    this.fruits = [];
    this.shakerCharges = 2; // Jar Shaker tilts
    this.mergesUntilShaker = 4;
    this.comboCount = 0;
    this.comboTimer = 0;
    this._bumpTouched = false;
    this._bgCacheKey = '';
    this._bgCacheCanvas = null;
    this._bgCacheImg = null;

    // Physical Glass Jar Container
    const wallOpts = { isStatic: true, friction: 0.3, restitution: 0.15, label: 'wall' };
    Composite.add(this.engine.world, [
      Bodies.rectangle(MID, FLOOR + 30, R - L + 160, 60, wallOpts),
      Bodies.rectangle(L - 25, 380, 50, 800, wallOpts),
      Bodies.rectangle(R + 25, 380, 50, 800, wallOpts),
    ]);

    // Prestige hazard: #000-inked peppermint candy pegs inside the jar (up to 3).
    const PEG_SLOTS = [{ x: 155, y: 560 }, { x: 295, y: 500 }, { x: 225, y: 620 }];
    this.pegs = PEG_SLOTS.slice(0, Math.min(3, this.diff.pegCount ?? 0)).map((p) => ({ ...p, r: 11 }));
    for (const p of this.pegs) {
      Composite.add(this.engine.world, Bodies.circle(p.x, p.y, p.r, { ...wallOpts, label: 'peg' }));
    }

    this.onCollide = (ev) => {
      for (const pair of ev.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;

        // Special Item 1: Pop-Rock TNT Bomb detonates on impact!
        if (a.tier === -2 || b.tier === -2) {
          const bomb = a.tier === -2 ? a : b;
          if (!bomb.detonated) {
            bomb.detonated = true;
            this.detonateBomb(bomb.position.x, bomb.position.y);
          }
          continue;
        }

        // Special Item 2: Rainbow Joker merges with ANY regular fruit
        if ((a.tier === -1 || b.tier === -1) && !a.merging && !b.merging) {
          const target = a.tier === -1 ? b : a;
          const joker = a.tier === -1 ? a : b;
          if (target.tier !== undefined && target.tier >= 0 && target.tier < TOP) {
            a.merging = b.merging = true;
            this.mergeQ.push([target, joker, target.tier + 1]);
          }
          continue;
        }

        // Regular Suika matching pair merge
        if (
          a.tier !== undefined &&
          b.tier !== undefined &&
          a.tier >= 0 &&
          b.tier >= 0 &&
          a.tier === b.tier &&
          !a.merging &&
          !b.merging
        ) {
          a.merging = b.merging = true;
          this.mergeQ.push([a, b, a.tier + 1]);
        }
      }
    };
    Events.on(this.engine, 'collisionStart', this.onCollide);

    if (saved) {
      if (Array.isArray(saved.fruits)) {
        for (const f of saved.fruits) {
          if (Array.isArray(f) && Number.isFinite(f[0]) && Number.isFinite(f[1]) && Number.isFinite(f[2])) {
            const tier = clamp(Math.round(f[0]), -2, TOP);
            const frR = tier < 0 ? 22 : FR[tier].r;
            const fx = clamp(f[1], L + frR + 2, R - frR - 2);
            const fy = clamp(f[2], SPAWN_Y, FLOOR - frR);
            this.addFruit(tier, fx, fy, Number.isFinite(f[3]) ? f[3] : 0, -10, false);
          }
        }
      }
      this.cur = (saved.cur !== undefined && Number.isFinite(saved.cur)) ? saved.cur : dropTier();
      this.next = (saved.next !== undefined && Number.isFinite(saved.next)) ? saved.next : dropTier();
      this.shakerCharges = Number.isFinite(saved.shakerCharges) ? saved.shakerCharges : 2;
      this.grace = 1.5;
    } else {
      this.cur = dropTier();
      this.next = dropTier();
    }
  }

  destroy() {
    if (this.engine) {
      Events.off(this.engine, 'collisionStart', this.onCollide);
      Composite.clear(this.engine.world, false);
      Engine.clear(this.engine);
    }
  }

  serialize() {
    return {
      fruits: this.fruits.map((b) => [
        b.tier,
        +b.position.x.toFixed(1),
        +b.position.y.toFixed(1),
        +b.angle.toFixed(2),
      ]),
      cur: this.cur,
      next: this.next,
      shakerCharges: this.shakerCharges,
    };
  }

  restoreLabel() {
    return `${this.fruits.length} confectionery fruits`;
  }

  addFruit(tier, x, y, angle = 0, born = null, pop = true) {
    const isSpecial = tier < 0;
    const r = isSpecial ? 22 : FR[tier].r;

    const b = Bodies.circle(x, y, r, {
      restitution: 0.22,
      friction: 0.25,
      frictionStatic: 0.45,
      frictionAir: 0.006,
      density: 0.0012,
      label: 'fruit',
    });

    b.tier = tier;
    b.born = born === null ? this.time : born;
    b.pop = pop;
    b.blinkTimer = Math.random() * 3;
    Body.setAngle(b, angle);
    Composite.add(this.engine.world, b);
    this.fruits.push(b);
    return b;
  }

  removeFruit(b) {
    Composite.remove(this.engine.world, b);
    this.fruits = this.fruits.filter((x) => x !== b);
  }

  detonateBomb(bx, by) {
    // Pop-Rock Bomb explodes! Vaporizes low-tier clutter in 75px radius
    this.fx.ring(bx, by, '#facc15', 220, 0.6, 6);
    this.fx.burst(bx, by, '#f43f5e', 30, 260, 0.7, 5, 300);
    this.fx.text(bx, by - 24, 'BOOM! TNT POP!', '#fde047', 24, 1.1);
    this.fx.shake(12, 0.4);
    this.sounds.hit();
    this.haptics.heavy();

    const victimCandidates = [...this.fruits];
    for (const f of victimCandidates) {
      if (f.tier >= 0 && f.tier <= 3) {
        const dist = Math.hypot(f.position.x - bx, f.position.y - by);
        if (dist < 75) {
          this.removeFruit(f);
          this.score += 15;
          this.fx.burst(f.position.x, f.position.y, '#facc15', 10, 140, 0.4, 3);
        }
      }
    }
  }

  bumpJar() {
    if (this.shakerCharges <= 0) return;
    this.shakerCharges--;

    // Physical upward & jitter impulse to dislodge stuck fruits
    for (const b of this.fruits) {
      Body.setVelocity(b, {
        x: b.velocity.x + (Math.random() - 0.5) * 6,
        y: b.velocity.y - (4.5 + Math.random() * 2.5),
      });
    }

    this.fx.shake(9, 0.35);
    this.fx.ring(MID, FLOOR - 20, '#22c55e', 260, 0.4, 4);
    this.fx.text(MID, FLOOR - 42, 'JAR BUMP!', '#4ade80', 24, 0.9);
    this.sounds.hit();
    this.haptics.heavy();
  }

  update(dt) {
    this.cool -= dt;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Aim, Click-Bump & Drop Controls
    const inp = this.input;
    const r = this.cur < 0 ? 22 : FR[this.cur].r;

    const bumpX0 = this.W - 122;
    const bumpX1 = this.W - 14;
    const bumpY0 = 104;
    const bumpY1 = 152;
    const overBump = inp.x >= bumpX0 && inp.x <= bumpX1 && inp.y >= bumpY0 && inp.y <= bumpY1;

    if (inp.justDown && overBump) {
      this._bumpTouched = true;
    }

    if (this._bumpTouched) {
      if (inp.released) {
        this._bumpTouched = false;
        if (overBump) this.bumpJar();
      } else if (!inp.down) {
        this._bumpTouched = false;
      }
    } else {
      if (inp.down || inp.released) this.aimX = clamp(inp.x, L + r + 4, R - r - 4);
      const keyDrop = inp.key(' ', 'arrowdown', 's') && !this._keyHeld;
      this._keyHeld = inp.key(' ', 'arrowdown', 's');
      if ((inp.released || keyDrop) && this.cool <= 0) this.drop();
    }

    if (inp.key('arrowleft', 'a')) this.aimX = clamp(this.aimX - 280 * dt, L + r + 4, R - r - 4);
    if (inp.key('arrowright', 'd')) this.aimX = clamp(this.aimX + 280 * dt, L + r + 4, R - r - 4);

    // Jar Shaker Hotkeys ('w', 'arrowup')
    const keyShake = inp.key('w', 'arrowup') && !this._keyShakeHeld;
    this._keyShakeHeld = inp.key('w', 'arrowup');
    if (keyShake) this.bumpJar();

    // Physics Update
    this.acc += dt;
    let steps = 0;
    while (this.acc >= 1 / 60 && steps < 4) {
      Engine.update(this.engine, 1000 / 60);
      this.acc -= 1 / 60;
      steps++;
    }
    if (steps === 4) this.acc = 0;

    this.processMerges();

    // Overflow Detection Line
    let over = false;
    for (const b of this.fruits) {
      if (this.time - b.born < 1.3) continue;
      const frR = b.tier < 0 ? 22 : FR[b.tier].r;
      if (b.position.y - frR < LINE && Math.abs(b.velocity.y) < 1.2) {
        over = true;
        break;
      }
    }

    this.overT = over ? this.overT + dt : Math.max(0, this.overT - dt * 2);
    if (this.overT > (this.diff.overflowGrace ?? 3.0)) {
      if (this.die('Jar overflowed!')) {
        this.fx.shake(12, 0.45);
        this.sounds.hit();
      }
    }

    // Fruit eye blinks
    for (const b of this.fruits) {
      b.blinkTimer = (b.blinkTimer || 0) + dt;
    }

    this.fx.update(dt);
  }

  drop() {
    this.addFruit(this.cur, this.aimX, SPAWN_Y, 0, this.time, false);
    this.sounds.drop();
    this.haptics.light();
    this.cur = this.next;
    this.next = dropTier();
    this.cool = 0.52;
  }

  processMerges() {
    while (this.mergeQ.length) {
      const [a, b, nextTier] = this.mergeQ.pop();
      if (!this.fruits.includes(a) || !this.fruits.includes(b)) continue;

      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;
      this.removeFruit(a);
      this.removeFruit(b);

      // Recharging the Jar Shaker!
      this.mergesUntilShaker--;
      if (this.mergesUntilShaker <= 0) {
        this.shakerCharges = Math.min(3, this.shakerCharges + 1);
        this.mergesUntilShaker = 4;
      }

      // Combo Chain Scaling
      this.comboCount++;
      this.comboTimer = 1.0;
      const comboMult = Math.min(5, this.comboCount);

      // Crown the Mythical Superlambanana Berry (Tier 10)
      if (nextTier >= TOP) {
        this.score += 1000 * comboMult;
        this.fx.text(x, y - 30, `SUPERLAMBANANA! +${1000 * comboMult}`, '#fde047', 26, 1.8);
        this.fx.burst(x, y, '#facc15', 50, 400, 1.2, 7, 500);
        this.fx.burst(x, y, '#f43f5e', 30, 320, 1.0, 5, 350);
        this.fx.ring(x, y, '#fde047', 280, 0.8, 8);
        this.fx.shake(14, 0.5);
        this.sounds.survive();
        this.haptics.heavy();
        this.won = true;
        this.winReason = 'Superlambanana Berry Crowned!';
        continue;
      }

      // Spawn next confectionery tier
      const nb = this.addFruit(nextTier, x, y, a.angle, this.time, true);
      Body.setVelocity(nb, { x: 0, y: -1.2 });

      const fInfo = FR[nextTier];
      const pts = fInfo.pts * comboMult;
      this.score += pts;

      this.fx.burst(x, y, fInfo.c, 12 + nextTier * 2, 170 + nextTier * 18, 0.55, 3 + nextTier * 0.3, 220);
      this.fx.ring(x, y, fInfo.topC, fInfo.r * 2.4, 0.45, 4);

      if (this.comboCount > 1) {
        this.fx.text(x, y - fInfo.r - 14, `COMBO ×${this.comboCount}! +${pts}`, '#fde047', 22, 0.9);
      } else if (nextTier >= 3) {
        this.fx.text(x, y - fInfo.r - 10, `+${pts}`, '#ffffff', 20, 0.8);
      }

      this.sounds.merge(nextTier);
      nextTier >= 5 ? this.haptics.heavy() : this.haptics.light();
    }
  }

  /* ------------------------------------------------------------ Cached Weebl Sweet Shop Diorama */
  renderBackdrop(ctx, W, H) {
    const horizonY = FLOOR + 6;
    const key = `${W}|${H}`;
    if (this._bgCacheKey !== key || !this._bgCacheCanvas) {
      const off = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      const sctx = off?.getContext?.('2d');
      if (off && sctx) {
        off.width = W;
        off.height = H;
        sctx.lineJoin = 'round';
        sctx.lineCap = 'round';

        // 1. Sunlit Weebl Sky Gradient + Comic Sunburst
        const sky = sctx.createLinearGradient(0, 0, 0, 490);
        sky.addColorStop(0, STYLE_TOKENS.skyTop);
        sky.addColorStop(0.55, STYLE_TOKENS.skyMid);
        sky.addColorStop(1, STYLE_TOKENS.skyHorizon);
        sctx.fillStyle = sky;
        sctx.fillRect(0, 0, W, horizonY);

        drawSunburst(sctx, MID, 410, 320, 0.14, 14, 0.22, false);

        // 2. Rolling Weebl Hills & Liverpool Park Skyline
        sctx.fillStyle = '#4ade80';
        sctx.strokeStyle = STYLE_TOKENS.ink;
        sctx.lineWidth = 3.0;
        sctx.beginPath();
        sctx.moveTo(-10, horizonY);
        sctx.lineTo(-10, 465);
        sctx.quadraticCurveTo(95, 422, 200, 468);
        sctx.quadraticCurveTo(325, 424, W + 10, 462);
        sctx.lineTo(W + 10, horizonY);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();

        sctx.fillStyle = '#22c55e';
        sctx.beginPath();
        sctx.moveTo(-10, horizonY);
        sctx.lineTo(-10, 520);
        sctx.quadraticCurveTo(130, 492, MID, 525);
        sctx.quadraticCurveTo(340, 490, W + 10, 518);
        sctx.lineTo(W + 10, horizonY);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();

        // Warm sunlit foreground meadow apron meeting the sweet-shop counter
        sctx.fillStyle = '#16a34a';
        sctx.beginPath();
        sctx.moveTo(-10, horizonY);
        sctx.lineTo(-10, 576);
        sctx.quadraticCurveTo(MID, 558, W + 10, 576);
        sctx.lineTo(W + 10, horizonY);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();

        // 3. Inked Oak Sweet-Shop Countertop (FLOOR+6 .. H)
        const deckGrad = sctx.createLinearGradient(0, horizonY, 0, H);
        deckGrad.addColorStop(0, '#d97706');
        deckGrad.addColorStop(0.28, '#b45309');
        deckGrad.addColorStop(1, '#78350f');
        sctx.fillStyle = deckGrad;
        sctx.fillRect(0, horizonY, W, H - horizonY);

        sctx.fillStyle = '#fbbf24';
        sctx.fillRect(0, horizonY, W, 6);

        sctx.strokeStyle = STYLE_TOKENS.ink;
        sctx.lineWidth = 3.2;
        sctx.beginPath();
        sctx.moveTo(0, horizonY);
        sctx.lineTo(W, horizonY);
        sctx.stroke();

        sctx.lineWidth = 2.0;
        for (const gy of [horizonY + 26, horizonY + 56]) {
          sctx.strokeStyle = '#78350f';
          sctx.beginPath();
          sctx.moveTo(0, gy);
          sctx.lineTo(W, gy);
          sctx.stroke();
        }
        for (const gx of [90, 225, 360]) {
          sctx.strokeStyle = '#78350f';
          sctx.beginPath();
          sctx.moveTo(gx, horizonY + 6);
          sctx.lineTo(gx, horizonY + 26);
          sctx.moveTo(gx + 55, horizonY + 26);
          sctx.lineTo(gx + 55, H);
          sctx.stroke();
        }

        this._bgCacheCanvas = off;
        this._bgCacheImg = null;
        if (typeof off.toDataURL === 'function' && typeof Image !== 'undefined') {
          const bgImg = new Image();
          bgImg.decoding = 'async';
          bgImg.src = off.toDataURL('image/png');
          bgImg.decode?.().catch(() => {});
          this._bgCacheImg = bgImg;
        }
        this._bgCacheKey = key;
      }
    }

    const bgSrc =
      this._bgCacheImg && this._bgCacheImg.complete && this._bgCacheImg.naturalWidth > 0
        ? this._bgCacheImg
        : this._bgCacheCanvas;
    if (bgSrc && typeof ctx.drawImage === 'function') {
      ctx.drawImage(bgSrc, 0, 0, W, H);
    } else {
      ctx.fillStyle = STYLE_TOKENS.skyMid;
      ctx.fillRect(0, 0, W, H);
    }

    // Drifting Weebl Clouds & Liverpool Sweet-Shop Landmarks flanking behind the Jar
    const c1X = ((68 + this.time * 8) % (W + 140)) - 70;
    const c2X = ((W - 60 - (this.time * 6) % (W + 140)) + W + 140) % (W + 140) - 70;
    drawSprite(ctx, 'cloud_1', c1X, 178, 72, 42, { fallback: () => {} });
    drawSprite(ctx, 'cloud_2', c2X, 166, 66, 38, { fallback: () => {} });

    drawSprite(ctx, 'city_donut_shop', 38, 520, 74, 80, { fallback: () => {} });
    drawSprite(ctx, 'city_palm_house', W - 38, 518, 76, 80, { fallback: () => {} });
  }

  /* ------------------------------------------------------------ render */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const off = this.fx.offset();

    // 1. Cached Sunlit Weebl Sweet-Shop Diorama
    this.renderBackdrop(ctx, W, H);

    ctx.save();
    ctx.translate(off.x, off.y);

    // 2. Centered #000-Inked Comic Glass Candy Jar
    this.renderGlassJar(ctx);

    // 3. Danger Overflow Line & Banner
    const danger = this.overT > 0;
    ctx.save();
    ctx.strokeStyle = danger
      ? `rgba(239, 68, 68, ${0.78 + Math.sin(this.time * 16) * 0.22})`
      : 'rgba(15, 23, 42, 0.42)';
    ctx.lineWidth = danger ? 3.8 : 2.4;
    ctx.lineCap = 'round';
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(L + 5, LINE);
    ctx.lineTo(R - 5, LINE);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (danger) {
      const warnW = 198;
      const warnH = 26;
      const warnX = MID - warnW / 2;
      const warnY = LINE - 32;
      drawComicPanel(ctx, warnX, warnY, warnW, warnH, 10, '#dc2626', {
        lineWidth: 2.4,
        shadowDx: 1.5,
        shadowDy: 2.5,
      });
      const msg = `OVERFLOW IN ${Math.max(0, (this.diff.overflowGrace ?? 3) - this.overT).toFixed(1)}s!`;
      drawComicText(ctx, msg, MID, warnY + warnH * 0.52, "900 12.5px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
        strokeWidth: 3.2,
      });
    }

    // 4. Locked Crowned Green Hero Bean Dropper holding incoming treat
    const isSpecial = this.cur < 0;
    const fR = isSpecial ? 22 : FR[this.cur].r;
    const ready = this.cool <= 0;

    if (!this.dead) {
      // Crisp inked trajectory aim line & ground landing dot
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.32)';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.setLineDash([5, 8]);
      ctx.beginPath();
      ctx.moveTo(this.aimX, SPAWN_Y + fR);
      ctx.lineTo(this.aimX, FLOOR);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(this.aimX, FLOOR - 2, 7.5, 2.8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(this.aimX, FLOOR - 2.5, 5, 1.8, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Held confectionery sphere
      this.drawVectorFruit(ctx, this.aimX, SPAWN_Y, this.cur, 0, ready ? 1 : 0.78, false);

      // Pristine HD 3D Sky-Rigging Hero Bean balancing & drop-shoving atop held sweet
      const heroFeetY = SPAWN_Y - fR + 2 + (ready ? Math.sin(this.time * 6) * 2.2 : 3);
      const tilt = danger ? Math.sin(this.time * 22) * 0.14 : Math.sin(this.time * 4.5) * 0.06;
      drawHeroCharacter(ctx, this.aimX, heroFeetY, 42, {
        view: 'front',
        state: !ready ? 'drop_push' : 'balance',
        expr: danger ? 'panic' : ready ? 'happy' : 'focus',
        t: this.time * 4,
        lean: tilt,
        squashX: ready ? 1.0 : 1.08,
        squashY: ready ? 1.0 : 0.90,
      });

      if (danger) {
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 1.6;
        for (const sx of [-18, 18]) {
          ctx.beginPath();
          ctx.moveTo(this.aimX + sx, heroFeetY - 38);
          ctx.quadraticCurveTo(this.aimX + sx + 4, heroFeetY - 32, this.aimX + sx, heroFeetY - 29);
          ctx.quadraticCurveTo(this.aimX + sx - 4, heroFeetY - 32, this.aimX + sx, heroFeetY - 38);
          ctx.fill();
          ctx.stroke();
        }
      }
    } else {
      drawHeroCharacter(ctx, this.aimX, SPAWN_Y - 12, 40, {
        view: 'front',
        state: 'hurt',
        expr: 'panic',
        t: this.time * 4,
        lean: 0.22,
        squashY: 0.85,
      });
    }

    // 5. #000-Inked Peppermint Rock-Candy Pegs & All Confectionery Tiers
    for (const pg of this.pegs || []) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
      ctx.beginPath();
      ctx.ellipse(pg.x, pg.y + pg.r * 0.6, pg.r * 0.9, pg.r * 0.36, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(pg.x, pg.y, pg.r, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(pg.x, pg.y);
      ctx.arc(pg.x, pg.y, pg.r - 1, 0, 1.4);
      ctx.closePath();
      ctx.moveTo(pg.x, pg.y);
      ctx.arc(pg.x, pg.y, pg.r - 1, Math.PI, Math.PI + 1.4);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pg.x, pg.y, pg.r, 0, TAU);
      ctx.stroke();
    }

    for (const b of this.fruits) {
      let s = 1;
      if (b.pop) {
        const t = clamp((this.time - b.born) / 0.25, 0, 1);
        s = 0.55 + 0.45 * easeOutBack(t);
      }

      // Only show squeezed expression when in danger overflow zone or a smaller tier deeply pinned under another sweet
      const frR = b.tier < 0 ? 22 : FR[b.tier].r;
      let isSquished = danger && b.position.y < LINE + 48;
      if (!isSquished && b.tier >= 0 && b.tier <= 6 && b.position.y > 460 && Math.abs(b.velocity.y) < 0.7) {
        for (let j = 0; j < this.fruits.length; j++) {
          const o = this.fruits[j];
          if (o === b) continue;
          const oR = o.tier < 0 ? 22 : FR[o.tier].r;
          if (o.position.y < b.position.y - frR * 0.7 && Math.hypot(o.position.x - b.position.x, o.position.y - b.position.y) < (frR + oR) * 0.94) {
            isSquished = true;
            break;
          }
        }
      }

      this.drawVectorFruit(ctx, b.position.x, b.position.y, b.tier, b.angle, s, isSquished, b.blinkTimer);
    }

    if (this.won) {
      drawComicStarburst(ctx, MID, 410, 120, '#fde047', '#f97316', 14);
      drawSprite(ctx, 'city_superlambanana', MID, 405, 86, 118, { fallback: () => {} });
    }

    this.fx.render(ctx, 1);
    ctx.restore();

    // 6. Safe-Zoned Comic HUD (zero overlap with #prestigeBadge or #adminDock)
    this.renderNextBubble(ctx);
    this.renderShakerHUD(ctx, W, H);
  }

  /* ------------------------------------------------------------ #000-Inked Comic Glass Candy Jar */
  renderGlassJar(ctx) {
    const jarX = L - 4;
    const jarY = JAR_TOP;
    const jarW = R - L + 8;
    const jarH = FLOOR - JAR_TOP + 6;

    // Grounding counter shadow & oak-gold comic coaster
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.ellipse(MID, FLOOR + 14, jarW * 0.54, 10, 0, 0, TAU);
    ctx.fill();

    drawComicPanel(ctx, L - 16, FLOOR + 2, (R - L) + 32, 18, 8, '#f59e0b', {
      lineWidth: 2.8,
      shadowDx: 0,
      shadowDy: 3,
    });

    // Pale icy-cel tinted clear glass interior (keeps vibrant hill & sweet-shop visibility behind it!)
    ctx.save();
    ctx.fillStyle = 'rgba(224, 242, 254, 0.42)';
    ctx.beginPath();
    ctx.roundRect(jarX, jarY, jarW, jarH, [4, 4, 22, 22]);
    ctx.fill();

    // Diagonal crisp glass sheen slashes (zero clip/gradient churn)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.beginPath();
    ctx.moveTo(jarX + 12, jarY + 26);
    ctx.lineTo(jarX + 28, jarY + 26);
    ctx.lineTo(jarX + 28, FLOOR - 26);
    ctx.lineTo(jarX + 12, FLOOR - 26);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(jarX + jarW - 22, jarY + 26, 10, jarH - 52);

    // Bold #000 outer U-contour + crisp inner white glass rim
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(L - 4, JAR_TOP);
    ctx.lineTo(L - 4, FLOOR - 16);
    ctx.quadraticCurveTo(L - 4, FLOOR + 4, L + 16, FLOOR + 4);
    ctx.lineTo(R - 16, FLOOR + 4);
    ctx.quadraticCurveTo(R + 4, FLOOR + 4, R + 4, FLOOR - 16);
    ctx.lineTo(R + 4, JAR_TOP);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(L - 1, JAR_TOP + 2);
    ctx.lineTo(L - 1, FLOOR - 16);
    ctx.quadraticCurveTo(L - 1, FLOOR + 1, L + 16, FLOOR + 1);
    ctx.lineTo(R - 16, FLOOR + 1);
    ctx.quadraticCurveTo(R + 1, FLOOR + 1, R + 1, FLOOR - 16);
    ctx.lineTo(R + 1, JAR_TOP + 2);
    ctx.stroke();
    ctx.restore();

    // Brass / Gold #000-inked jar rim caps
    drawComicPanel(ctx, L - 12, JAR_TOP - 6, 16, 12, 5, '#facc15', { lineWidth: 2.4, shadowDx: 1, shadowDy: 2 });
    drawComicPanel(ctx, R - 4, JAR_TOP - 6, 16, 12, 5, '#facc15', { lineWidth: 2.4, shadowDx: 1, shadowDy: 2 });
  }

  /* ------------------------------------------------------------ Cached Cel Confectionery Spheres */
  drawVectorFruit(ctx, x, y, tier, angle, s = 1, isSquished = false, blinkTime = 0) {
    const isSpecial = tier < 0;
    const r = isSpecial ? 22 * s : FR[tier].r * s;
    const lw = inkWidthForR(r);
    const stamp = getFruitBodyStamp(tier);

    ctx.save();
    ctx.translate(x, y);

    if (tier === -1) {
      // Rainbow Joker Spin
      ctx.save();
      ctx.rotate(this.time * 3);
      if (stamp && typeof ctx.drawImage === 'function') {
        const src = stamp.img && stamp.img.complete && stamp.img.naturalWidth > 0 ? stamp.img : stamp.canvas;
        const dSize = stamp.size * s;
        ctx.drawImage(src, -dSize * 0.5, -dSize * 0.5, dSize, dSize);
      } else {
        ctx.fillStyle = '#a855f7';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.restore();

      // Golden #000-inked center star gem
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(4, r * 0.32), 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      return;
    }

    if (tier === -2) {
      // Pop-Rock TNT Bomb with flickering fuse spark & angry Weebl brow
      if (stamp && typeof ctx.drawImage === 'function') {
        const src = stamp.img && stamp.img.complete && stamp.img.naturalWidth > 0 ? stamp.img : stamp.canvas;
        const dSize = stamp.size * s;
        ctx.drawImage(src, -dSize * 0.5, -dSize * 0.5, dSize, dSize);
      } else {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      }

      const sparkR = (4.2 + Math.sin(this.time * 22) * 1.6) * s;
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(r * 0.92, -r * 1.12, sparkR, 0, TAU); ctx.fill(); ctx.stroke();

      this.drawCelEyes(ctx, r, false, blinkTime, true);
      ctx.restore();
      return;
    }

    ctx.rotate(angle);
    if (stamp && typeof ctx.drawImage === 'function') {
      const src = stamp.img && stamp.img.complete && stamp.img.naturalWidth > 0 ? stamp.img : stamp.canvas;
      const dSize = stamp.size * s;
      ctx.drawImage(src, -dSize * 0.5, -dSize * 0.5, dSize, dSize);
    } else {
      const f = FR[tier];
      ctx.fillStyle = f.c;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
    }

    this.drawCelEyes(ctx, r, isSquished, blinkTime, false);
    ctx.restore();
  }

  drawCelEyes(ctx, r, isSquished, blinkTime, isAngry) {
    const eyeSpacing = r * 0.33;
    const eyeY = -r * 0.03;
    const isBlinking = (blinkTime % 3.6) > 3.42;

    if (isSquished) {
      // Genuine squeeze chevron eyes (> <) + wavy mouth (never dead X!)
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = Math.max(1.8, r * 0.075);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const es = Math.max(2.6, r * 0.14);
      ctx.beginPath();
      ctx.moveTo(-eyeSpacing - es, eyeY - es * 0.7);
      ctx.lineTo(-eyeSpacing + es * 0.3, eyeY);
      ctx.lineTo(-eyeSpacing - es, eyeY + es * 0.7);
      ctx.moveTo(eyeSpacing + es, eyeY - es * 0.7);
      ctx.lineTo(eyeSpacing - es * 0.3, eyeY);
      ctx.lineTo(eyeSpacing + es, eyeY + es * 0.7);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, eyeY + r * 0.34, Math.max(2.4, r * 0.14), Math.max(1.8, r * 0.1), 0, 0, TAU);
      ctx.fillStyle = '#9f1239';
      ctx.fill();
      ctx.stroke();
      return;
    }

    if (isBlinking && !isAngry) {
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = Math.max(1.8, r * 0.07);
      ctx.lineCap = 'round';
      const blinkR = Math.max(2.6, r * 0.14);
      ctx.beginPath();
      ctx.arc(-eyeSpacing, eyeY, blinkR, 0.18, Math.PI - 0.18);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(eyeSpacing, eyeY, blinkR, 0.18, Math.PI - 0.18);
      ctx.stroke();
      return;
    }

    // Crisp #000-inked Weebl eyes + glossy sclera + black pupils
    const er = Math.max(2.8, r * 0.18);
    ctx.lineWidth = Math.max(1.4, r * 0.055);
    for (const ex of [-eyeSpacing, eyeSpacing]) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.beginPath();
      ctx.arc(ex, eyeY, er, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath();
      ctx.arc(ex + er * 0.18, eyeY + er * 0.06, er * 0.48, 0, TAU);
      ctx.fill();

      if (er >= 4) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - er * 0.15, eyeY - er * 0.28, er * 0.22, 0, TAU);
        ctx.fill();
      }
    }

    if (isAngry) {
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = Math.max(2.2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(-eyeSpacing - er, eyeY - er * 1.15);
      ctx.lineTo(-eyeSpacing + er * 0.7, eyeY - er * 0.55);
      ctx.moveTo(eyeSpacing + er, eyeY - er * 1.15);
      ctx.lineTo(eyeSpacing - er * 0.7, eyeY - er * 0.55);
      ctx.stroke();
      return;
    }

    if (r >= 20) {
      ctx.fillStyle = 'rgba(244, 63, 94, 0.36)';
      ctx.beginPath();
      ctx.ellipse(-eyeSpacing * 1.38, eyeY + r * 0.19, r * 0.12, r * 0.07, 0, 0, TAU);
      ctx.ellipse(eyeSpacing * 1.38, eyeY + r * 0.19, r * 0.12, r * 0.07, 0, 0, TAU);
      ctx.fill();
    }

    // Happy comic open smile
    ctx.fillStyle = '#881337';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = Math.max(1.4, r * 0.048);
    ctx.beginPath();
    ctx.arc(0, eyeY + r * 0.28, Math.max(3.4, r * 0.17), 0.12, Math.PI - 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  /* ------------------------------------------------------------ Safe-Zoned Comic HUD */
  renderNextBubble(ctx) {
    const x = 12;
    const y = 98;
    const w = 70;
    const h = 58;

    drawComicPanel(ctx, x, y, w, h, 12, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawComicText(ctx, 'NEXT', x + w * 0.5, y + 13, "900 10.5px 'Fredoka', 'Outfit', sans-serif", '#fde047', {
      strokeWidth: 2.8,
    });

    this.drawVectorFruit(ctx, x + w * 0.5, y + 38, this.next, 0, 0.56, false);
  }

  renderShakerHUD(ctx, W, H) {
    const sw = 108;
    const sh = 48;
    const sx = W - sw - 14; // x = 328..436
    const sy = 104;         // y = 104..152 — cleanly below #prestigeBadge!
    const canShake = this.shakerCharges > 0;

    drawComicPanel(ctx, sx, sy, sw, sh, 12, canShake ? '#15803d' : '#334155', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });

    drawComicText(ctx, 'BUMP JAR', sx + sw * 0.5, sy + 15, "900 11.5px 'Fredoka', 'Outfit', sans-serif", canShake ? '#fef08a' : '#cbd5e1', {
      strokeWidth: 3.0,
    });
    drawComicText(ctx, `${this.shakerCharges} LEFT`, sx + sw * 0.5, sy + 33, "900 11.5px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
      strokeWidth: 3.0,
    });

    // Bottom-right counter plaque cleanly clear of #adminDock on the bottom-left
    const pw = 160;
    const ph = 28;
    const px = W - pw - 16;
    const py = FLOOR + 32;
    const isCombo = this.comboCount > 1;
    drawComicPanel(ctx, px, py, pw, ph, 10, isCombo ? '#b45309' : '#0f172a', {
      lineWidth: 2.4,
      shadowDx: 1.5,
      shadowDy: 2.5,
    });
    const plaqueText = isCombo
      ? `COMBO ×${this.comboCount}!`
      : `${this.fruits.length} SWEETS IN JAR`;
    drawComicText(ctx, plaqueText, px + pw * 0.5, py + ph * 0.5 + 1, "900 11px 'Fredoka', 'Outfit', sans-serif", isCombo ? '#fef08a' : '#ffffff', {
      strokeWidth: 2.8,
    });
  }

  rr(x, y, w, h, r) {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
  }
}
