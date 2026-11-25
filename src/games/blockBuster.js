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
const COLS = 7;
const LEFT_WALL = 15;
const RIGHT_WALL = 435;
const PLAY_W = RIGHT_WALL - LEFT_WALL; // 420
const COL_W = PLAY_W / COLS; // 60
const BLOCK_W = 54;
const BLOCK_H = 38;
const TOP_ROW_Y = 170; // Cleanly below top HUD row (y 98..136) and ceiling lintel (y 142..150)
const CEIL_Y = TOP_ROW_Y - 20; // 150
const ROW_H = 44;
const DANGER_Y = 656;
const CANNON_Y = 718;
const BALL_R = 5.4;
const BASE_SPEED = 740;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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

export class BlockBuster extends Game {
  static meta = {
    id: 'block-buster',
    title: 'Block Buster',
    icon: '💥',
    hint: 'DRAG to aim laser · RELEASE to fire ball stream · TAP for 2.5× TURBO!',
    baseLikes: 1940,
    isPrestige: false,
    parScore60s: 14000,
    cue: 'AIM & BLAST BRICKS!',
    prestigeCue: 'TOUGHER BRICK ARMOR!',
    scaling: {
      brickHpMult:    { base: 1.0, rate: 0.16, cap: 1.75, mode: 'up', label: 'Brick HP' },
      hardBlockBonus: { base: 0.0, rate: 0.20, cap: 0.28, mode: 'up', deltaFormat: 'abs', unit: '%', label: 'Armored Bricks' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    preloadWeeblAtlas();
    this.wave = 1;
    this.ballCount = 15;
    this.cannonX = (LEFT_WALL + RIGHT_WALL) / 2;
    this.targetCannonX = this.cannonX;
    this.nextCannonX = null;

    this.state = 'aim'; // 'aim' | 'firing' | 'returning' | 'advancing'
    this.aimAngle = -Math.PI / 2;
    this.aiming = false;
    this.aimStart = null;

    this.balls = [];
    this.blocks = [];
    this.extraBallsCollected = 0;
    this.fireTimer = 0;
    this.ballsToFire = 0;
    this.combo = 0;
    this.turbo = false;
    this.turnDuration = 0;

    this.lasers = [];
    this.shards = [];
    this.shocks = [];
    this.sfxCooldown = 0;
    this._bgCacheKey = '';
    this._bgCacheCanvas = null;
    this._bgCacheImg = null;

    if (saved && saved.wave) {
      this.wave = saved.wave;
      this.ballCount = saved.ballCount || 15;
      this.cannonX = clamp(Number(saved.cannonX) || (LEFT_WALL + RIGHT_WALL) / 2, LEFT_WALL + 28, RIGHT_WALL - 28);
      this.targetCannonX = this.cannonX;
      if (saved.blocks && Array.isArray(saved.blocks) && saved.blocks.length > 0) {
        this.blocks = saved.blocks.map((b) => {
          const rowIdx = Number.isFinite(b.row) ? b.row : Math.max(0, Math.round(((b.y || TOP_ROW_Y) - TOP_ROW_Y) / ROW_H));
          const normalizedY = b.y < TOP_ROW_Y ? TOP_ROW_Y + rowIdx * ROW_H : b.y;
          return {
            ...b,
            y: clamp(normalizedY, TOP_ROW_Y, DANGER_Y - ROW_H - 1),
            w: b.w || BLOCK_W,
            h: BLOCK_H,
            pulse: 0,
            rot: 0,
          };
        });
      } else {
        this.spawnRow(0);
        this.spawnRow(1);
        this.spawnRow(2);
      }
    } else {
      this.spawnRow(0);
      this.spawnRow(1);
      this.spawnRow(2);
    }
  }

  serialize() {
    return {
      wave: this.wave,
      ballCount: this.ballCount,
      cannonX: Math.round(this.cannonX),
      score: this.score,
      blocks: this.blocks.map((b) => ({
        col: b.col,
        row: b.row,
        x: Math.round(b.x),
        y: Math.round(b.y),
        w: b.w || BLOCK_W,
        h: b.h || BLOCK_H,
        type: b.type,
        hp: b.hp,
        maxHp: b.maxHp,
      })),
    };
  }

  restoreLabel() {
    return `Wave ${this.wave} · ×${this.ballCount} balls · ${Math.round(this.score)} pts`;
  }

  /* ------------------------------------------------------------- Row Spawner */
  spawnRow(targetRow = 0) {
    const cols = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
    const count = 3 + Math.floor(Math.random() * 2);
    const chosenCols = cols.slice(0, count);

    const emptyCols = cols.slice(count);
    const plusCol = emptyCols.length > 0 ? emptyCols[0] : null;

    if (plusCol !== null) {
      this.blocks.push({
        col: plusCol,
        row: targetRow,
        x: LEFT_WALL + plusCol * COL_W + (COL_W - BLOCK_W) / 2,
        y: TOP_ROW_Y + targetRow * ROW_H,
        w: BLOCK_W,
        h: BLOCK_H,
        type: 'plus',
        hp: 1,
        maxHp: 1,
        pulse: 0,
        rot: 0,
      });
    }

    for (let i = 0; i < chosenCols.length; i++) {
      const col = chosenCols[i];
      let type = 'normal';
      const rand = Math.random();

      if (rand < 0.12 && this.wave >= 2) {
        type = 'bomb';
      } else if (rand < 0.22 && this.wave >= 3) {
        type = Math.random() < 0.5 ? 'laserH' : 'laserV';
      } else if (rand < 0.30 && this.wave >= 4) {
        type = 'prism';
      }

      const isHard = Math.random() < (0.25 + (this.diff.hardBlockBonus || 0));
      const baseHp = isHard ? Math.round(this.wave * 1.8) : this.wave;
      const hp = Math.max(1, Math.round(baseHp * (this.diff.brickHpMult ?? 1)));

      this.blocks.push({
        col,
        row: targetRow,
        x: LEFT_WALL + col * COL_W + (COL_W - BLOCK_W) / 2,
        y: TOP_ROW_Y + targetRow * ROW_H,
        w: BLOCK_W,
        h: BLOCK_H,
        type,
        hp,
        maxHp: hp,
        pulse: 0,
        rot: 0,
      });
    }
  }

  /* ------------------------------------------------------------- Main Update Loop */
  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }

    this.time += dt;
    this.sfxCooldown = Math.max(0, this.sfxCooldown - dt);
    this.fx.update(dt);

    this.cannonX += (this.targetCannonX - this.cannonX) * Math.min(1, dt * 12);

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.t += dt;
      if (l.t >= l.maxT) this.lasers.splice(i, 1);
    }

    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 850 * dt;
      s.rot += s.vRot * dt;
      s.alpha -= dt * 1.8;
      if (s.alpha <= 0) this.shards.splice(i, 1);
    }

    for (const b of this.blocks) {
      if (b.pulse > 0) b.pulse = Math.max(0, b.pulse - dt * 5.0);
      if (b.type === 'plus') b.rot += dt * 3.2;
    }

    if (this.state === 'aim') {
      this.updateAiming();
    } else if (this.state === 'firing' || this.state === 'returning') {
      this.updateBalls(dt);
    } else if (this.state === 'advancing') {
      this.updateAdvancing(dt);
    }
  }

  /* ------------------------------------------------------------- Aiming Controls */
  updateAiming() {
    const p = this.input;

    if (p.pressed && p.x > this.W - 90 && p.y > this.H - 56) {
      this.turbo = !this.turbo;
      this.sounds.tick();
      return;
    }

    if (p.down) {
      if (!this.aiming) {
        this.aiming = true;
        this.aimStart = { x: p.x, y: p.y };
      }

      const dx = p.x - this.cannonX;
      const dy = p.y - CANNON_Y;

      if (dy < -18 || Math.abs(dx) > 10) {
        let ang = Math.atan2(dy, dx);
        ang = clamp(ang, -Math.PI + 0.16, -0.16);
        this.aimAngle = ang;
      }
    } else if (this.aiming) {
      this.aiming = false;
      this.startFiring();
    }
  }

  startFiring() {
    this.state = 'firing';
    this.ballsToFire = this.ballCount;
    this.fireTimer = 0;
    this.balls = [];
    this.nextCannonX = null;
    this.extraBallsCollected = 0;
    this.combo = 0;
    this.turnDuration = 0;
    this.sounds.whoosh();
  }

  /* ------------------------------------------------------------- Ball Simulation & Physics */
  updateBalls(dt) {
    this.turnDuration += dt;

    if (this.input.pressed) {
      this.turbo = !this.turbo;
      this.sounds.tick();
      this.haptics.light();
    }

    const speedMult = this.turbo || this.turnDuration > 5.5 ? 2.5 : 1.0;
    const simDt = dt * speedMult;

    if (this.ballsToFire > 0) {
      this.fireTimer -= simDt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 0.042;
        this.ballsToFire--;
        const spd = BASE_SPEED;
        this.balls.push({
          x: this.cannonX,
          y: CANNON_Y - 10,
          vx: Math.cos(this.aimAngle) * spd,
          vy: Math.sin(this.aimAngle) * spd,
          active: true,
          returned: false,
          trail: [],
        });
      }
    }

    const SUB_STEPS = 3;
    const subDt = simDt / SUB_STEPS;
    let activeCount = 0;

    for (let step = 0; step < SUB_STEPS; step++) {
      for (let i = 0; i < this.balls.length; i++) {
        const ball = this.balls[i];
        if (!ball.active) continue;

        ball.x += ball.vx * subDt;
        ball.y += ball.vy * subDt;

        if (ball.x - BALL_R <= LEFT_WALL) {
          ball.x = LEFT_WALL + BALL_R;
          ball.vx = Math.abs(ball.vx);
          this.playWallBounce();
        } else if (ball.x + BALL_R >= RIGHT_WALL) {
          ball.x = RIGHT_WALL - BALL_R;
          ball.vx = -Math.abs(ball.vx);
          this.playWallBounce();
        }

        if (ball.y - BALL_R <= CEIL_Y) {
          ball.y = CEIL_Y + BALL_R;
          ball.vy = Math.abs(ball.vy);
          this.playWallBounce();
        }

        if (ball.y >= CANNON_Y) {
          ball.active = false;
          ball.returned = true;
          ball.y = CANNON_Y;

          if (this.nextCannonX === null) {
            this.nextCannonX = clamp(ball.x, LEFT_WALL + 28, RIGHT_WALL - 28);
            this.targetCannonX = this.nextCannonX;
            this.sounds.tick();
            this.haptics.light();
          }
          continue;
        }

        this.checkBlockCollision(ball);
      }
    }

    for (let i = 0; i < this.balls.length; i++) {
      if (this.balls[i].active) activeCount++;
    }

    if (this.ballsToFire <= 0 && activeCount === 0) {
      this.endTurn();
    }
  }

  playWallBounce() {
    if (this.sfxCooldown <= 0) {
      this.sfxCooldown = 0.035;
      this.sounds.tick();
    }
  }

  checkBlockCollision(ball) {
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      if (b.dead) continue;

      const bw = b.w || BLOCK_W;
      const bh = b.h || BLOCK_H;
      const cx = clamp(ball.x, b.x, b.x + bw);
      const cy = clamp(ball.y, b.y, b.y + bh);
      const dx = ball.x - cx;
      const dy = ball.y - cy;

      if (dx * dx + dy * dy < BALL_R * BALL_R) {
        if (b.type === 'plus') {
          b.dead = true;
          this.extraBallsCollected++;
          this.score += 50;
          this.fx.ring(b.x + b.w / 2, b.y + b.h / 2, '#10b981', 36, 0.4, 3);
          this.fx.text(b.x + b.w / 2, b.y - 10, '+1 BALL!', '#4ade80', 16);
          this.sounds.up();
          this.haptics.medium();
          continue;
        }

        if (b.type === 'prism') {
          this.spawnSplitBalls(ball);
        }

        const overlapL = (ball.x + BALL_R) - b.x;
        const overlapR = (b.x + b.w) - (ball.x - BALL_R);
        const overlapT = (ball.y + BALL_R) - b.y;
        const overlapB = (b.y + b.h) - (ball.y - BALL_R);
        const minOverlapX = Math.min(overlapL, overlapR);
        const minOverlapY = Math.min(overlapT, overlapB);

        if (minOverlapX < minOverlapY) {
          ball.vx = -ball.vx;
          ball.x += (overlapL < overlapR ? -overlapL : overlapR) * 0.5;
        } else {
          ball.vy = -ball.vy;
          ball.y += (overlapT < overlapB ? -overlapT : overlapB) * 0.5;
        }

        b.hp--;
        b.pulse = 0.45;
        this.combo++;
        this.score += 15;

        if (this.sfxCooldown <= 0) {
          this.sfxCooldown = 0.025;
          this.sounds.blockPop(this.combo);
        }

        this.fx.burst(cx, cy, this.getBlockStyle(b).fill, 4, 60, 0.25, 2.5);

        if (b.hp <= 0) {
          b.dead = true;
          this.onBlockDestroyed(b);
        }
        break;
      }
    }
  }

  spawnSplitBalls(parentBall) {
    if (this.balls.length > 250) return;
    const baseAng = Math.atan2(parentBall.vy, parentBall.vx);
    const spd = Math.hypot(parentBall.vx, parentBall.vy);
    for (const diff of [-0.35, 0.35]) {
      const a = baseAng + diff;
      this.balls.push({
        x: parentBall.x,
        y: parentBall.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        active: true,
        returned: false,
        trail: [],
      });
    }
    this.sounds.laser();
    this.fx.ring(parentBall.x, parentBall.y, '#c084fc', 40, 0.35, 3);
  }

  onBlockDestroyed(b) {
    const pts = b.maxHp * 25 + 50;
    this.score += pts;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const st = this.getBlockStyle(b);

    this.fx.burst(cx, cy, st.fill, 16, 140, 0.55, 4);
    this.fx.text(cx, cy - 12, `+${pts}`, '#fde047', 18);
    this.sounds.shatter();
    this.haptics.medium();

    for (let s = 0; s < 6; s++) {
      const ang = Math.random() * TAU;
      const spd = 60 + Math.random() * 180;
      this.shards.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 60,
        rot: Math.random() * TAU,
        vRot: (Math.random() - 0.5) * 12,
        w: 8 + Math.random() * 8,
        h: 6 + Math.random() * 6,
        col: st.fill,
        alpha: 1.0,
      });
    }

    if (b.type === 'bomb') {
      this.fx.burst(cx, cy, '#ef4444', 28, 220, 0.7, 5);
      this.fx.ring(cx, cy, '#facc15', 160, 0.6, 5);
      this.fx.shake(7, 0.3);
      this.sounds.fail();
      this.haptics.heavy();

      const blastDmg = Math.max(2, Math.round(this.wave * 1.5));
      for (const other of this.blocks) {
        if (other.dead || other === b) continue;
        const dist = Math.hypot(other.x + other.w / 2 - cx, other.y + other.h / 2 - cy);
        if (dist < 115) {
          other.hp -= blastDmg;
          other.pulse = 0.5;
          if (other.hp <= 0) {
            other.dead = true;
            this.onBlockDestroyed(other);
          }
        }
      }
    } else if (b.type === 'laserH') {
      this.lasers.push({ type: 'H', y: cy, t: 0, maxT: 0.3, x1: LEFT_WALL, x2: RIGHT_WALL, col: '#38bdf8' });
      this.sounds.laser();
      this.haptics.heavy();

      for (const other of this.blocks) {
        if (other.dead || other === b) continue;
        if (Math.abs(other.y - b.y) < ROW_H * 0.5) {
          other.hp -= Math.max(3, this.wave);
          other.pulse = 0.6;
          if (other.hp <= 0) {
            other.dead = true;
            this.onBlockDestroyed(other);
          }
        }
      }
    } else if (b.type === 'laserV') {
      this.lasers.push({ type: 'V', x: cx, t: 0, maxT: 0.3, y1: CEIL_Y + 4, y2: DANGER_Y + 12, col: '#facc15' });
      this.sounds.laser();
      this.haptics.heavy();

      for (const other of this.blocks) {
        if (other.dead || other === b) continue;
        if (Math.abs(other.col - b.col) === 0) {
          other.hp -= Math.max(3, this.wave);
          other.pulse = 0.6;
          if (other.hp <= 0) {
            other.dead = true;
            this.onBlockDestroyed(other);
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------- Turn Advance & Descent */
  endTurn() {
    this.state = 'advancing';
    this.turbo = false;

    this.blocks = this.blocks.filter((b) => !b.dead);

    if (this.extraBallsCollected > 0) {
      this.ballCount += this.extraBallsCollected;
    }
    if (this.nextCannonX !== null) {
      this.targetCannonX = this.nextCannonX;
    }

    let failed = false;
    for (const b of this.blocks) {
      if (b.type === 'plus') continue;
      if (b.y + ROW_H >= DANGER_Y) {
        failed = true;
        break;
      }
    }

    if (failed) {
      this.die(`Crushed by blocks on Wave ${this.wave}!`);
      this.fx.burst(this.cannonX, CANNON_Y, '#ef4444', 40, 300, 0.9, 6);
      this.fx.shake(16, 0.5);
      this.sounds.fail();
      this.haptics.heavy();
      return;
    }

    for (const b of this.blocks) {
      b.row++;
      b.y += ROW_H;
    }

    this.wave++;
    this.spawnRow(0);

    if (this.wave % 5 === 0) {
      this.sounds.up();
      this.fx.text(this.W / 2, 260, `WAVE ${this.wave} REACHED!`, '#fde047', 26, 1.8);
      this.fx.burst(this.W / 2, 260, '#facc15', 24, 200, 0.8, 4);
    }

    this.state = 'aim';
  }

  updateAdvancing() {
    this.state = 'aim';
  }

  /* ------------------------------------------------------------- Cel Block Palettes */
  getBlockStyle(b) {
    if (b.type === 'bomb') return { fill: '#dc2626', top: '#fb7185', shade: '#991b1b' };
    if (b.type === 'laserH') return { fill: '#0284c7', top: '#38bdf8', shade: '#0369a1' };
    if (b.type === 'laserV') return { fill: '#eab308', top: '#fef08a', shade: '#a16207' };
    if (b.type === 'plus') return { fill: '#10b981', top: '#34d399', shade: '#047857' };
    if (b.type === 'prism') return { fill: '#9333ea', top: '#c084fc', shade: '#6b21a8' };

    const ratio = b.hp / Math.max(1, this.wave);
    if (ratio > 1.4) return { fill: '#7c3aed', top: '#a78bfa', shade: '#4c1d95' };
    if (ratio > 0.9) return { fill: '#2563eb', top: '#60a5fa', shade: '#1d4ed8' };
    if (ratio > 0.5) return { fill: '#16a34a', top: '#4ade80', shade: '#166534' };
    if (ratio > 0.25) return { fill: '#f59e0b', top: '#fde047', shade: '#b45309' };
    return { fill: '#e11d48', top: '#fb7185', shade: '#9f1239' };
  }

  /* ------------------------------------------------------------- Cached Weebl Siege Bastion Arena */
  renderBackdrop(ctx, W, H) {
    const key = `${W}|${H}`;
    if (this._bgCacheKey !== key || !this._bgCacheCanvas) {
      const off = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      const sctx = off?.getContext?.('2d');
      if (off && sctx) {
        off.width = W;
        off.height = H;
        sctx.lineJoin = 'round';
        sctx.lineCap = 'round';

        // 1. Sunlit Weebl Sky + Emerald Harbor Courtyard
        const sky = sctx.createLinearGradient(0, 0, 0, 260);
        sky.addColorStop(0, STYLE_TOKENS.skyTop);
        sky.addColorStop(0.6, STYLE_TOKENS.skyMid);
        sky.addColorStop(1, STYLE_TOKENS.skyHorizon);
        sctx.fillStyle = sky;
        sctx.fillRect(0, 0, W, H);

        drawSunburst(sctx, W * 0.5, CEIL_Y - 12, 290, 0.14, 14, 0.25, false);

        // Rolling inked green hills flanking the bastion behind the slate arena
        sctx.fillStyle = '#4ade80';
        sctx.strokeStyle = STYLE_TOKENS.ink;
        sctx.lineWidth = 3.0;
        sctx.beginPath();
        sctx.moveTo(-10, H);
        sctx.lineTo(-10, 560);
        sctx.quadraticCurveTo(110, 520, 225, 562);
        sctx.quadraticCurveTo(340, 522, W + 10, 558);
        sctx.lineTo(W + 10, H);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();

        // Lower stone bastion parapet courtyard behind turret
        const stoneBaseY = CANNON_Y - 30;
        const stoneGrad = sctx.createLinearGradient(0, stoneBaseY, 0, H);
        stoneGrad.addColorStop(0, '#475569');
        stoneGrad.addColorStop(0.28, '#334155');
        stoneGrad.addColorStop(1, '#0f172a');
        sctx.fillStyle = stoneGrad;
        sctx.fillRect(0, stoneBaseY, W, H - stoneBaseY);

        sctx.fillStyle = '#94a3b8';
        sctx.fillRect(0, stoneBaseY, W, 6);
        sctx.strokeStyle = STYLE_TOKENS.ink;
        sctx.lineWidth = 3.0;
        sctx.beginPath();
        sctx.moveTo(0, stoneBaseY);
        sctx.lineTo(W, stoneBaseY);
        sctx.stroke();

        // Ashlar stone joint ticks
        sctx.lineWidth = 2.0;
        sctx.strokeStyle = '#1e293b';
        for (const sy of [stoneBaseY + 34, stoneBaseY + 68]) {
          sctx.beginPath();
          sctx.moveTo(0, sy);
          sctx.lineTo(W, sy);
          sctx.stroke();
        }

        // 2. High-Contrast Obsidian Slate Arena Play-Well (y = CEIL_Y..DANGER_Y+14)
        const boardH = DANGER_Y + 14 - CEIL_Y;
        sctx.fillStyle = '#0f172a';
        sctx.beginPath();
        sctx.roundRect(LEFT_WALL - 1, CEIL_Y - 2, PLAY_W + 2, boardH, 10);
        sctx.fill();

        // Crisp subtle vertical column tracks
        sctx.strokeStyle = '#1e293b';
        sctx.lineWidth = 2.0;
        for (let c = 1; c < COLS; c++) {
          const x = LEFT_WALL + c * COL_W;
          sctx.beginPath();
          sctx.moveTo(x, CEIL_Y + 6);
          sctx.lineTo(x, DANGER_Y + 8);
          sctx.stroke();
        }
        for (let gy = TOP_ROW_Y; gy < DANGER_Y; gy += ROW_H) {
          sctx.beginPath();
          sctx.moveTo(LEFT_WALL + 4, gy);
          sctx.lineTo(RIGHT_WALL - 4, gy);
          sctx.stroke();
        }

        // 3. Heavy #000-Inked Cobalt Iron Bastion Side Bumpers (Zero clip())
        const drawIronRail = (bx, bw) => {
          sctx.fillStyle = '#1d4ed8';
          sctx.beginPath();
          sctx.roundRect(bx, CEIL_Y - 6, bw, boardH + 8, 6);
          sctx.fill();

          sctx.fillStyle = '#3b82f6';
          sctx.fillRect(bx + 2, CEIL_Y - 2, Math.max(2, bw * 0.35), boardH);

          sctx.strokeStyle = STYLE_TOKENS.ink;
          sctx.lineWidth = 2.6;
          sctx.beginPath();
          sctx.roundRect(bx, CEIL_Y - 6, bw, boardH + 8, 6);
          sctx.stroke();

          // Gold rivet studs along rail
          sctx.fillStyle = '#facc15';
          sctx.lineWidth = 1.6;
          for (let ry = CEIL_Y + 18; ry < CEIL_Y + boardH - 12; ry += 42) {
            sctx.beginPath();
            sctx.arc(bx + bw * 0.5, ry, 2.8, 0, TAU);
            sctx.fill();
            sctx.stroke();
          }
        };
        drawIronRail(2, LEFT_WALL - 2);
        drawIronRail(RIGHT_WALL, W - RIGHT_WALL - 2);

        // 4. Inked Brass Top Ceiling Lintel Connecting Side Rails
        drawComicPanel(sctx, LEFT_WALL - 4, CEIL_Y - 10, PLAY_W + 8, 12, 5, '#f59e0b', {
          lineWidth: 2.8,
          shadowDx: 0,
          shadowDy: 2.5,
        });

        this._bgCacheCanvas = off;
        this._bgCacheImg = null;
        if (typeof off.toDataURL === 'function' && typeof Image !== 'undefined') {
          const img = new Image();
          img.decoding = 'async';
          img.src = off.toDataURL('image/png');
          img.decode?.().catch(() => {});
          this._bgCacheImg = img;
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
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
    }

    // Cornerstone battlements capping the side rails
    drawSprite(ctx, 'p_stone_pillar', LEFT_WALL - 4, CEIL_Y - 2, 18, 30, { fallback: () => {} });
    drawSprite(ctx, 'p_stone_pillar', RIGHT_WALL + 4, CEIL_Y - 2, 18, 30, { fallback: () => {} });
  }

  /* ------------------------------------------------------------- Render Engine */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    // 1. Cached Weebl Bastion Courtyard & Arena
    this.renderBackdrop(ctx, W, H);

    // 2. Danger Hazard Threshold Line
    this.drawDangerLine(ctx);

    // 3. Active Lasers
    this.drawLasers(ctx);

    // 4. #000-Inked 2-Tone Cel Bricks & +1 Orbs
    for (const b of this.blocks) {
      this.drawBlock(ctx, b);
    }

    // 5. Falling Shards
    for (const s of this.shards) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.globalAlpha = clamp(s.alpha, 0, 1);
      ctx.fillStyle = s.col;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(-s.w / 2, -s.h / 2, s.w, s.h, 2.5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 6. Aiming Ricochet Guide
    if (this.state === 'aim' && this.aiming) {
      this.drawAimGuide(ctx);
    }

    // 7. Inked Flying Energy Balls
    for (const ball of this.balls) {
      if (!ball.active) continue;
      this.drawBall(ctx, ball);
    }

    // 8. Cannon Turret & Crowned Green Hero Bean Operator
    this.drawCannonTurret(ctx);

    // 9. FX Layer
    this.fx.render(ctx, 1.0);

    // 10. Clean Safe-Zoned Comic HUD
    this.drawHUD(ctx, W, H);
  }

  drawDangerLine(ctx) {
    const pulse = 0.5 + Math.sin(this.time * 6) * 0.3;
    const ribbonH = 12;
    const ry = DANGER_Y - ribbonH / 2;
    const ribbonW = RIGHT_WALL - LEFT_WALL;

    // Inked extruded yellow hazard ribbon with analytic clipped diagonal black stripes (zero clip())
    ctx.fillStyle = STYLE_TOKENS.ink;
    ctx.beginPath();
    ctx.roundRect(LEFT_WALL, ry + 2.5, ribbonW, ribbonH, 5);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(LEFT_WALL, ry, ribbonW, ribbonH, 5);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    const xMin = LEFT_WALL + 2;
    const xMax = RIGHT_WALL - 2;
    for (let x = LEFT_WALL - 10; x < RIGHT_WALL + 10; x += 18) {
      const bx0 = clamp(x, xMin, xMax);
      const tx0 = clamp(x + 8, xMin, xMax);
      const tx1 = clamp(x + 14, xMin, xMax);
      const bx1 = clamp(x + 6, xMin, xMax);
      if (tx1 <= tx0 && bx1 <= bx0) continue;
      ctx.beginPath();
      ctx.moveTo(bx0, ry + ribbonH - 1.5);
      ctx.lineTo(tx0, ry + 1.5);
      ctx.lineTo(tx1, ry + 1.5);
      ctx.lineTo(bx1, ry + ribbonH - 1.5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(LEFT_WALL, ry, ribbonW, ribbonH, 5);
    ctx.stroke();

    // Comic Danger Callout Badge
    const badgeCol = pulse > 0.55 ? '#dc2626' : '#e11d48';
    drawComicPanel(ctx, RIGHT_WALL - 146, ry - 23, 140, 20, 9, badgeCol, {
      lineWidth: 2.2,
      shadowDx: 1.5,
      shadowDy: 2,
    });
    drawComicText(ctx, 'DANGER BOUNDARY', RIGHT_WALL - 76, ry - 13, "900 10px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
      strokeWidth: 2.6,
    });
  }

  drawLasers(ctx) {
    ctx.save();
    for (const l of this.lasers) {
      const alpha = clamp(1 - l.t / l.maxT, 0, 1);
      ctx.lineCap = 'round';
      ctx.globalAlpha = alpha;

      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 16 * alpha;
      ctx.beginPath();
      if (l.type === 'H') {
        ctx.moveTo(l.x1, l.y); ctx.lineTo(l.x2, l.y);
      } else {
        ctx.moveTo(l.x, l.y1); ctx.lineTo(l.x, l.y2);
      }
      ctx.stroke();

      ctx.strokeStyle = l.col;
      ctx.lineWidth = 10 * alpha;
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4 * alpha;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawAimGuide(ctx) {
    ctx.save();
    let rx = this.cannonX;
    let ry = CANNON_Y;
    let vx = Math.cos(this.aimAngle);
    let vy = Math.sin(this.aimAngle);

    ctx.lineCap = 'round';
    ctx.setLineDash([8, 9]);
    ctx.lineDashOffset = -this.time * 48;

    ctx.beginPath();
    ctx.moveTo(rx, ry);

    let maxDist = 720;
    while (maxDist > 0) {
      const targetWallX = vx < 0 ? LEFT_WALL + BALL_R : RIGHT_WALL - BALL_R;
      const distToWallX = (targetWallX - rx) / vx;
      const distToCeil = (CEIL_Y + BALL_R - ry) / vy;

      const stepDist = Math.min(distToWallX > 0 ? distToWallX : Infinity, distToCeil > 0 ? distToCeil : Infinity);
      if (stepDist === Infinity || stepDist > maxDist) {
        rx += vx * maxDist;
        ry += vy * maxDist;
        ctx.lineTo(rx, ry);
        break;
      }

      rx += vx * stepDist;
      ry += vy * stepDist;
      ctx.lineTo(rx, ry);
      maxDist -= stepDist;

      if (stepDist === distToWallX) vx = -vx;
      else vy = -vy;
    }

    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 6.2;
    ctx.stroke();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(rx, ry, 6.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawBall(ctx, ball) {
    const fillCol = this.turbo || this.turnDuration > 5.5 ? '#fde047' : '#e0f2fe';
    ctx.fillStyle = fillCol;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  drawBlock(ctx, b) {
    const scale = 1.0 + (b.pulse || 0) * 0.14;
    const bw = (b.w || BLOCK_W) * scale;
    const bh = (b.h || BLOCK_H) * scale;
    const bx = Number.isFinite(b.x) ? b.x : LEFT_WALL;
    const by = Number.isFinite(b.y) ? b.y : TOP_ROW_Y;
    const cx = bx + (b.w || BLOCK_W) / 2;
    const cy = by + (b.h || BLOCK_H) / 2;
    const x = cx - bw / 2;
    const y = cy - bh / 2;

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(bw) || !Number.isFinite(bh)) return;

    if (b.type === 'plus') {
      // Spinning #000-Inked Mint +1 Ball Orb
      const pulse = 1 + Math.sin(this.time * 5 + cx) * 0.06;
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.beginPath();
      ctx.arc(cx, cy, 19 * pulse, 0, TAU);
      ctx.fill();

      ctx.translate(cx, cy);
      ctx.rotate(b.rot);
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 14.5, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.ellipse(-4, -5, 6, 3.2, -0.5, 0, TAU);
      ctx.fill();

      ctx.lineCap = 'round';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 5.4;
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
      ctx.moveTo(0, -6); ctx.lineTo(0, 6);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.6;
      ctx.stroke();

      ctx.restore();
      return;
    }

    const st = this.getBlockStyle(b);

    // Inked extruded bottom lip + 2-tone Flash cel block (zero clip())
    ctx.fillStyle = STYLE_TOKENS.ink;
    ctx.beginPath();
    ctx.roundRect(x, y + 4.2, bw, bh, 8);
    ctx.fill();

    ctx.fillStyle = st.shade;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 8);
    ctx.fill();

    ctx.fillStyle = st.fill;
    ctx.beginPath();
    ctx.roundRect(x + 1, y, bw - 2, bh * 0.82, 7);
    ctx.fill();

    ctx.fillStyle = st.top;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 2, bw - 6, Math.max(4, bh * 0.28), 5);
    ctx.fill();

    if (b.pulse > 0.08) {
      ctx.fillStyle = `rgba(255, 255, 255, ${clamp(b.pulse * 0.8, 0, 0.5)})`;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, bw - 2, bh - 2, 7);
      ctx.fill();
    }

    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 8);
    ctx.stroke();

    // Inked Special Icons + Bitmap-Cached HP Numbers
    if (b.type === 'bomb') {
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 6, 5.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx + 5, cy - 11, 2.6, 0, TAU);
      ctx.fill();
      ctx.stroke();

      drawComicText(ctx, b.hp, cx, cy + 9, "900 12px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
        strokeWidth: 3.0,
      });
    } else if (b.type === 'laserH' || b.type === 'laserV') {
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      if (b.type === 'laserH') {
        ctx.moveTo(cx - 12, cy - 7); ctx.lineTo(cx - 6, cy - 11); ctx.lineTo(cx - 6, cy - 3); ctx.closePath();
        ctx.moveTo(cx + 12, cy - 7); ctx.lineTo(cx + 6, cy - 11); ctx.lineTo(cx + 6, cy - 3); ctx.closePath();
        ctx.rect(cx - 6, cy - 9, 12, 4);
      } else {
        ctx.moveTo(cx, cy - 13); ctx.lineTo(cx - 5, cy - 7); ctx.lineTo(cx + 5, cy - 7); ctx.closePath();
        ctx.rect(cx - 2, cy - 7, 4, 6);
      }
      ctx.fill();
      ctx.stroke();

      drawComicText(ctx, b.hp, cx, cy + 9, "900 12px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
        strokeWidth: 3.0,
      });
    } else if (b.type === 'prism') {
      ctx.fillStyle = '#f5d0fe';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 13); ctx.lineTo(cx + 7, cy - 7); ctx.lineTo(cx, cy - 1); ctx.lineTo(cx - 7, cy - 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      drawComicText(ctx, b.hp, cx, cy + 9, "900 12px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
        strokeWidth: 3.0,
      });
    } else {
      drawComicText(ctx, b.hp, cx, cy + 1, "900 16px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
        strokeWidth: 3.4,
      });
    }
  }

  drawCannonTurret(ctx) {
    const cx = this.cannonX;
    const cy = CANNON_Y;
    const aimRight = Math.cos(this.aimAngle) >= 0;

    // Grounding shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 25, 44, 8, 0, 0, TAU);
    ctx.fill();

    // 1. Wide Inked Steel Cannon Carriage Deck
    drawComicPanel(ctx, cx - 40, cy + 2, 80, 22, 10, '#334155', {
      lineWidth: 2.8,
      shadowDx: 0,
      shadowDy: 3,
    });

    // Twin #000-inked gold cannon wheels
    for (const wx of [cx - 28, cx + 28]) {
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(wx, cy + 16, 7.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(wx, cy + 16, 2.5, 0, TAU);
      ctx.fill();
    }

    // 2. Pivoting #000-Inked Steel & Brass Cannon Barrel centered at cannonX
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.aimAngle + Math.PI / 2);

    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-11, -39, 22, 38, 6);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(-7, -36, 7, 32, 3);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(-11, -39, 22, 38, 6);
    ctx.stroke();

    // Gold inked muzzle collar
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(-13.5, -43, 27, 8, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. Pristine HD 3D Cannon Carriage Operator spotting upward & steering
    drawHeroCharacter(ctx, cx - 22, cy + 16, 40, {
      view: 'threeQuarterFront',
      dir: aimRight ? 1 : -1,
      state: 'steer_fire',
      expr: this.state === 'firing' ? 'focus' : 'happy',
      t: this.time * 4.5,
      lean: this.state === 'firing' ? Math.sin(this.time * 18) * 0.12 : Math.max(-0.22, Math.min(0.22, Math.cos(this.aimAngle) * 0.22)),
      lookX: aimRight ? 0.5 : -0.5,
    });

    // 4. Crisp Comic Ball Count Badge neatly beside/below or centered in Aim state
    if (this.state === 'aim') {
      drawComicPanel(ctx, cx - 32, cy - 58, 64, 22, 9, '#0f172a', {
        lineWidth: 2.4,
        shadowDx: 1.5,
        shadowDy: 2,
      });
      ctx.fillStyle = '#e0f2fe';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx - 16, cy - 47, 5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      drawComicText(ctx, `×${this.ballCount}`, cx + 7, cy - 46.5, "900 12px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
        strokeWidth: 2.8,
      });
    }
  }

  drawHUD(ctx, W, H) {
    // 1. Top-Left Wave Pill (y=98..132 — 10px clear above ceiling lintel!)
    drawComicPanel(ctx, 14, 98, 96, 34, 11, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawComicText(ctx, `WAVE ${this.wave}`, 62, 116, "900 14px 'Fredoka', 'Outfit', sans-serif", '#fde047', {
      strokeWidth: 3.0,
    });

    // 2. Top-Right Ball Count / Status Pill cleanly below #prestigeBadge (y=102..134)
    const rw = 108;
    const rh = 32;
    const rx = W - rw - 14;
    const ry = 102;
    const isFiring = this.state === 'firing' || this.state === 'returning';
    const rFill = isFiring ? '#0369a1' : '#166534';
    const rText = isFiring
      ? `IN FLIGHT: ${this.balls.filter((b) => b.active).length}`
      : `${this.ballCount} BALLS`;
    drawComicPanel(ctx, rx, ry, rw, rh, 11, rFill, {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawComicText(ctx, rText, rx + rw * 0.5, ry + rh * 0.5 + 1, "900 11.5px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
      strokeWidth: 2.8,
    });

    // Center Combo Burst cleanly in HUD band when active
    if (this.combo > 15) {
      drawComicText(ctx, `${this.combo} COMBO!`, W * 0.5, 116, "900 14px 'Fredoka', 'Outfit', sans-serif", '#fde047', {
        strokeWidth: 3.4,
      });
    }

    // 3. Bottom-Right Turbo Toggle Comic Button (clear of bottom-left #adminDock)
    const isFast = this.turbo || this.turnDuration > 5.5;
    drawComicPanel(ctx, W - 88, H - 54, 74, 34, 11, isFast ? '#dc2626' : '#334155', {
      lineWidth: 2.6,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawComicText(ctx, isFast ? '2.5× FAST' : '1.0× SPD', W - 51, H - 36, "900 11px 'Fredoka', 'Outfit', sans-serif", isFast ? '#fef08a' : '#ffffff', {
      strokeWidth: 2.8,
    });
  }

  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
}
