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

const TEXT_STAMP_CACHE = new Map();
const TEXT_STAMP_MAX = 220;
let _textMeasureCtx = null;

/**
 * Bitmap-cached wrapper around drawComicText: renders thick-stroked + emoji strings once
 * at 2x resolution into an HTMLImageElement so perspective-scaled gates/labels blit cleanly
 * without re-rasterizing vector outlines under continuous scale(p.s, p.s) transforms.
 */
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
    if (!_textMeasureCtx) {
      const mc = document.createElement('canvas');
      mc.width = 4; mc.height = 4;
      _textMeasureCtx = mc.getContext?.('2d') || null;
    }
    const c = document.createElement('canvas');
    const sctx = c.getContext?.('2d');
    if (!_textMeasureCtx || !sctx || typeof c.toDataURL !== 'function') {
      _rawDrawComicText(ctx, label, x, y, font, fill, opts);
      return;
    }

    _textMeasureCtx.font = font;
    const tw = Math.max(4, Math.ceil(_textMeasureCtx.measureText(label).width));
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
    // LRU touch so static gate/hazard labels remain cached while live counters roll off
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

const TRACK_L = 45;
const TRACK_R = 405;
const TRACK_W = TRACK_R - TRACK_L;
const MID = (TRACK_L + TRACK_R) / 2; // 225
const HORIZON_Y = -420;
const CROWD_Y = 640;
const FOCAL = 1550;
const PIER_MAX_DZ = 970;
const ROW_GAP = 440;
const TAU = Math.PI * 2;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const posMod = (n, m) => ((n % m) + m) % m;

/* ------------------------------------------------------------ Compact #000-Inked Cel Primitives */
function celShadow(ctx, x, y, rx, ry, alpha = 0.28) {
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function celCircle(ctx, x, y, r, fill, opts = {}) {
  const { rim = STYLE_TOKENS.ink, lineWidth = 2.4, shade = null, shine = true } = opts;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = rim;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  if (shade) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(x + r * 0.28, y + r * 0.28, r * 0.95, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  if (shine && r >= 4) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.32, r * 0.28, r * 0.16, -0.5, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function celBox(ctx, x, y, w, h, r, fill, opts = {}) {
  const {
    rim = STYLE_TOKENS.ink,
    lineWidth = 2.4,
    depth = 0,
    depthColor = 'rgba(0, 0, 0, 0.28)',
    gloss = true,
  } = opts;
  ctx.save();
  if (depth > 0) {
    ctx.fillStyle = STYLE_TOKENS.ink;
    ctx.beginPath();
    ctx.roundRect(x, y + depth, w, h, r);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  if (gloss && h >= 10) {
    const insetR = Math.max(1.5, r - 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, Math.max(2, w - 4), Math.max(3, h * 0.24), insetR);
    ctx.fill();
    if (depth > 0) {
      const dh = Math.min(8, h * 0.22);
      ctx.fillStyle = depthColor;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + h - dh - 1.5, Math.max(2, w - 4), dh, insetR);
      ctx.fill();
    }
  }
  ctx.strokeStyle = rim;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

export class MultiplierRunner extends Game {
  static meta = {
    id: 'multiplier-runner',
    title: 'Albert Dock Rush',
    icon: '⚓',
    hint: 'DRAG left/right! Pick +2/-2 gates, dodge dock hazards & build your squad!',
    baseLikes: 4320,
    isPrestige: true,
    parScore60s: 7500,
    cue: 'BUILD YOUR SQUAD!',
    prestigeCue: 'TOUGHER BOSSES · FASTER RUN!',
    scaling: {
      bossReqMult:  { base: 1.0, rate: 0.18, cap: 1.90, mode: 'up', label: 'Boss Strength' },
      runSpeedMult: { base: 1.0, rate: 0.16, cap: 1.40, mode: 'up', label: 'Run Speed' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    preloadWeeblAtlas();
    // Prestige rank (1 = first playthrough). Set by Reel.js before init().
    this.pLevel = Math.max(1, this.prestige || 1);
    this.count = (saved && Number.isFinite(saved.count) && saved.count > 0) ? saved.count : 10;
    this.dist = (saved && Number.isFinite(saved.dist)) ? saved.dist : 0;
    this.crowdX = MID;
    this.targetX = this.crowdX;
    this.rows = [];
    this.t = 0;
    this.speed = 265; // Snappy arcade run speed
    this.boostTimer = 0;
    this.feverRush = 0;
    this.slipTimer = 0; // Dynamic slippery fish oil drift state

    // Stage progression: Boss 1: 10, Boss 2: 20, Boss 3: 30, etc.
    this.stage = saved?.stage || 1;
    this.bossState = 'none'; // 'none' | 'stairs'
    this.stairsProgress = 0;
    this.stairsScoreMult = 1;

    // Visual scenery props along the quayside
    this.quaysideProps = [
      { d: 120, type: 'bollard' },
      { d: 280, type: 'lamp' },
      { d: 460, type: 'crane' },
      { d: 680, type: 'crate' },
      { d: 920, type: 'bollard' },
      { d: 1140, type: 'lamp' },
      { d: 1380, type: 'crane' },
      { d: 1620, type: 'crate' },
    ];

    if (saved) this.grace = 1.5;
    this.initStage(this.stage);
  }

  serialize() {
    return {
      count: Math.round(this.count),
      dist: this.dist,
      stage: this.stage,
    };
  }

  restoreLabel() {
    return `${Math.round(this.count)} dock runners (Stage ${this.stage})`;
  }

  crowdRadius() {
    return clamp(8 + 3.8 * Math.sqrt(Math.min(this.count, 60)), 16, 52);
  }

  /* ------------------------------------------------------------ Stage & Boss Progression */
  // Boss squad requirement/HP for a stage, scaled asymptotically by prestige.
  bossReqFor(stage) {
    return Math.round(stage * 10 * (this.diff.bossReqMult ?? 1));
  }

  initStage(stage) {
    this.stage = stage;
    this.bossReq = this.bossReqFor(stage); // Boss 1 = 10, Boss 2 = 20, Boss 3 = 30... (+25% per prestige)
    this.stageStartDist = this.dist;
    this.stageLength = 3150;
    this.bossDist = this.stageStartDist + this.stageLength;
    this.spawnStageRows(stage);
  }

  spawnStageRows(stage) {
    const startD = this.stageStartDist + 420;
    const endD = this.bossDist - 320;
    const gap = ROW_GAP;
    let curD = startD;
    let step = 0;

    while (curD < endD) {
      if (step % 2 === 0) {
        this.rows.push(this.makeStageGate(curD, stage, step));
      } else {
        this.rows.push(this.makeStageObstacle(curD, stage, step));
      }
      curD += gap;
      step++;
    }

    // Boss waiting at the end of the stage
    this.rows.push(this.makeBossRow(this.bossDist, stage));
  }

  makeBossRow(d, stage) {
    const req = this.bossReqFor(stage);
    const hp = req;
    let title, color, type;

    if (stage === 1) {
      type = 'captain';
      title = 'PIRATE CAPTAIN CRUMP';
      color = '#e63946';
    } else if (stage === 2) {
      type = 'kraken';
      title = 'MERSEY KRAKEN MECHA';
      color = '#7209b7';
    } else if (stage === 3) {
      type = 'colossus';
      title = 'ROYAL DOCK LEVIATHAN';
      color = '#f72585';
    } else {
      const bossTypes = [
        { type: 'captain', title: `DREAD PIRATE CRUMP Mk.${stage}`, color: '#e63946' },
        { type: 'kraken', title: `MERSEY CYBER KRAKEN Mk.${stage}`, color: '#7209b7' },
        { type: 'colossus', title: `ROYAL ALBERT COLOSSUS Mk.${stage}`, color: '#f72585' },
      ];
      const b = bossTypes[(stage - 1) % 3];
      type = b.type;
      title = b.title;
      color = b.color;
    }

    return {
      d,
      stage,
      kind: 'boss',
      done: false,
      type,
      title,
      req,
      hp,
      maxHp: hp,
      x: MID,
      y: 0,
      r: 68,
      slamTimer: 0,
      shockwaves: [],
      defeated: false,
      clashing: false,
      clashTimer: 0,
    };
  }

  /* ------------------------------------------------------------ Tactical Math Gates (+2 / -2) */
  makeStageGate(d, stage, step) {
    const isMoving = stage >= 2 && Math.random() < 0.3;
    let leftGate, rightGate;

    // Tactical calculated values:
    const baseAdd = Math.min(5, 2 + Math.floor(stage * 0.6)); // 2 for stg 1, 3 for stg 2, 4 for stg 3
    const bigAdd = baseAdd + 1;
    const smallAdd = Math.max(1, baseAdd - 1);
    const penVal = Math.min(4, 2 + Math.floor(stage * 0.4)); // 2 for stg 1, 3 for stg 2

    const roll = Math.random();
    if (roll < 0.45) {
      // Dilemma: Boost vs Penalty (+3 vs -2 or +2 vs -2)
      const isLeftGood = Math.random() < 0.5;
      const goodGate = { op: '+', v: Math.random() < 0.5 ? baseAdd : bigAdd, good: true };
      const badGate = { op: '−', v: penVal, good: false };
      leftGate = isLeftGood ? goodGate : badGate;
      rightGate = isLeftGood ? badGate : goodGate;
    } else if (roll < 0.8) {
      // Choice: Big Boost vs Small Boost (+3 vs +1)
      const isLeftBig = Math.random() < 0.5;
      const g1 = { op: '+', v: bigAdd, good: true };
      const g2 = { op: '+', v: smallAdd, good: true };
      leftGate = isLeftBig ? g1 : g2;
      rightGate = isLeftBig ? g2 : g1;
    } else {
      // Lesser Penalty: Small loss vs Larger loss (-1 vs -3)
      const isLeftSmall = Math.random() < 0.5;
      const g1 = { op: '−', v: Math.max(1, penVal - 1), good: false };
      const g2 = { op: '−', v: penVal + 1, good: false };
      leftGate = isLeftSmall ? g1 : g2;
      rightGate = isLeftSmall ? g2 : g1;
    }

    return {
      d,
      kind: 'gate',
      gates: [leftGate, rightGate],
      isMoving,
      movePhase: Math.random() * TAU,
      moveAmp: 28,
      done: false,
    };
  }

  /* ------------------------------------------------------------ Stage Obstacles (Dynamic Dock Hazards) */
  makeStageObstacle(d, stage, step) {
    let pool;
    if (stage === 1) {
      // Stage 1 (10 Bean Boss): Slower pendulum anchors, rolling rum casks, turnstiles, crane drops, and rewarding bonuses
      pool = ['anchor', 'rum_casks', 'turnstile', 'crane_drop', 'powerup', 'coins'];
    } else if (stage === 2) {
      // Stage 2 (20 Bean Boss): Introduce slapping kraken tentacles & seagull slicks, faster anchors and double casks
      pool = ['tentacle_slap', 'crane_drop', 'rum_casks', 'seagull_slick', 'anchor', 'turnstile', 'powerup', 'coins'];
    } else {
      // Stage 3+ (30+ Bean Bosses): High-intensity dynamic gauntlet
      pool = ['tentacle_slap', 'crane_drop', 'rum_casks', 'turnstile', 'anchor', 'seagull_slick', 'powerup'];
    }

    const kind = pool[(step + stage * 2) % pool.length];

    // 1. Swinging Ship Anchor (Pendulum Arc)
    if (kind === 'anchor') {
      const speed = 2.0 + Math.min(1.6, stage * 0.4);
      const amp = clamp(70 + stage * 10, 75, 115);
      return {
        d,
        kind: 'anchor',
        done: false,
        speed,
        amp,
        phase: Math.random() * TAU,
        x: MID,
        swingAngle: 0,
        r: 26,
      };
    }

    // 2. Victorian Steam Crane Crate Drop (Telegraphed Cargo Smash)
    if (kind === 'crane_drop') {
      const lanes = [MID, TRACK_L + 75, TRACK_R - 75];
      const x = lanes[Math.floor(Math.random() * lanes.length)];
      const w = 82 + Math.min(22, stage * 5);
      const h = 70;
      const warnDur = Math.max(0.45, 0.85 - stage * 0.08);
      const smashDur = 0.35;
      const liftDur = 0.7;
      return {
        d,
        kind: 'crane_drop',
        done: false,
        x,
        w,
        h,
        warnDur,
        smashDur,
        liftDur,
        cycle: warnDur + smashDur + liftDur,
        state: 'warn',
        animT: 0,
      };
    }

    // 3. Rolling Rum Casks (The Mersey Rollers)
    if (kind === 'rum_casks') {
      const casks = [];
      const numCasks = stage === 1 ? 1 : Math.random() < 0.65 ? 2 : 1;
      if (numCasks === 1) {
        const lane = Math.random() < 0.4 ? MID : Math.random() < 0.5 ? TRACK_L + 80 : TRACK_R - 80;
        casks.push({ x: lane, baseX: lane, r: 24, rot: 0, wobble: Math.random() * TAU, spd: 2.2 + stage * 0.3 });
      } else {
        casks.push({ x: TRACK_L + 70, baseX: TRACK_L + 70, r: 24, rot: 0, wobble: 0, spd: 2.4 + stage * 0.3 });
        casks.push({ x: TRACK_R - 70, baseX: TRACK_R - 70, r: 24, rot: Math.PI, wobble: Math.PI, spd: 2.4 + stage * 0.3 });
      }
      return { d, kind: 'rum_casks', done: false, casks };
    }

    // 4. Slapping Mersey Tentacle (Dockside Ambush)
    if (kind === 'tentacle_slap') {
      const side = Math.random() < 0.5 ? 'left' : 'right';
      const w = 125 + Math.min(30, stage * 8);
      const telegraph = Math.max(0.5, 0.95 - stage * 0.09);
      const slamDur = 0.38;
      const retractDur = 0.65;
      return {
        d,
        kind: 'tentacle_slap',
        done: false,
        side,
        w,
        telegraph,
        slamDur,
        retractDur,
        cycle: telegraph + slamDur + retractDur,
        state: 'warn',
        animT: 0,
      };
    }

    // 5. Rotating Dock Turnstile (Padded Customs Revolver)
    if (kind === 'turnstile') {
      const rotSpeed = (Math.random() < 0.5 ? 1 : -1) * (2.0 + Math.min(1.8, stage * 0.35));
      return {
        d,
        kind: 'turnstile',
        done: false,
        angle: Math.random() * TAU,
        rotSpeed,
        armLen: 120,
        x: MID,
      };
    }

    // 6. Seagull Dive-Bomb & Gummy Grease Puddle (Traction Hazard)
    if (kind === 'seagull_slick') {
      const lane = Math.random() < 0.5 ? TRACK_L + 80 : TRACK_R - 80;
      return {
        d,
        kind: 'seagull_slick',
        done: false,
        x: lane,
        w: 96,
        h: 56,
        gulls: [
          { offX: -60, offY: -45, flap: 0 },
          { offX: 0, offY: -58, flap: 1.4 },
          { offX: 55, offY: -42, flap: 2.8 },
        ],
      };
    }

    // 7. Powerup (Cannon +3 Recruits or Nitro Turbo)
    if (kind === 'powerup') {
      const type = Math.random() < 0.6 ? 'cannon' : 'nitro';
      const x = Math.random() < 0.5 ? TRACK_L + 85 : TRACK_R - 85;
      return { d, kind: 'powerup', type, done: false, x, w: 68, h: 46 };
    }

    // 8. Triple Royal Albert Gold Sovereigns
    const coinLane = Math.random() < 0.5 ? TRACK_L + 50 : TRACK_R - 50;
    return {
      d,
      kind: 'coins',
      done: false,
      coins: [
        { x: coinLane, yOff: -25, collected: false },
        { x: coinLane, yOff: 0, collected: false },
        { x: coinLane, yOff: 25, collected: false },
      ],
    };
  }

  getUpcomingBoss() {
    return this.rows.find((r) => r.kind === 'boss' && !r.defeated) || null;
  }

  /* ------------------------------------------------------------ Update Loop */
  update(dt) {
    this.t += dt;

    // Victory Multiplier Stairs sequence
    if (this.bossState === 'stairs') {
      this.updateStairs(dt);
      this.fx.update(dt);
      return;
    }

    // Speed calculation (brisk sprint balanced by wide ROW_GAP spacing)
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      this.speed = 420;
    } else if (this.feverRush > 0) {
      this.feverRush -= dt;
      this.speed = 340;
    } else {
      this.speed = (265 + Math.min(60, this.stage * 12)) * (this.diff.runSpeedMult ?? 1);
    }

    this.dist += this.speed * dt;
    this.score += (this.speed * dt) / 8.0;

    const rad = this.crowdRadius();

    // Responsive Drag & Arrow Steering
    const minX = TRACK_L + rad * 0.75;
    const maxX = TRACK_R - rad * 0.75;

    if (this.input.down) {
      const target = clamp(this.input.x, minX, maxX);
      this.crowdX += (target - this.crowdX) * Math.min(1, dt * 55);
      this.targetX = this.crowdX;
    } else {
      let steerVel = 0;
      if (this.input.key('arrowleft', 'a')) steerVel -= 820;
      if (this.input.key('arrowright', 'd')) steerVel += 820;
      if (this.input.frameDX) steerVel += this.input.frameDX * 65;

      this.crowdX = clamp(this.crowdX + steerVel * dt, minX, maxX);
      this.targetX = this.crowdX;
    }

    // Slippery dock oil drift wobble
    if (this.slipTimer > 0) {
      this.slipTimer -= dt;
      this.crowdX += Math.sin(this.t * 14) * 60 * dt;
      this.crowdX = clamp(this.crowdX, minX, maxX);
      if (Math.random() < 0.25) {
        this.fx.burst(this.crowdX + (Math.random() - 0.5) * rad, CROWD_Y + rad * 0.5, '#38bdf8', 2, 80, 0.25, 2);
      }
    }

    // Process Track Rows
    for (const r of this.rows) {
      if (r.done) continue;

      if (r.kind === 'anchor') {
        r.x = MID + Math.sin(this.t * r.speed + r.phase) * r.amp;
        r.swingAngle = Math.cos(this.t * r.speed + r.phase) * 0.45;
      } else if (r.kind === 'crane_drop') {
        const tIn = (this.t * 1.35) % r.cycle;
        r.animT = tIn;
        r.state = tIn < r.warnDur ? 'warn' : tIn < r.warnDur + r.smashDur ? 'drop' : 'lift';
      } else if (r.kind === 'rum_casks') {
        for (const c of r.casks) {
          c.rot += dt * 8.5;
          if (r.casks.length > 1) {
            c.x = c.baseX + Math.sin(this.t * c.spd + c.wobble) * 16;
          }
        }
      } else if (r.kind === 'tentacle_slap') {
        const tTent = (this.t * 1.25) % r.cycle;
        r.animT = tTent;
        r.state = tTent < r.telegraph ? 'warn' : tTent < r.telegraph + r.slamDur ? 'slam' : 'retract';
      } else if (r.kind === 'turnstile') {
        r.angle += r.rotSpeed * dt;
      } else if (r.kind === 'seagull_slick') {
        for (const g of r.gulls) {
          g.flap += dt * 9.5;
        }
      } else if (r.kind === 'sweeper') {
        r.angle += r.rotSpeed * dt;
      } else if (r.kind === 'boulder') {
        r.rot += dt * 8;
      } else if (r.kind === 'boss') {
        const distToBoss = r.d - this.dist;
        if (distToBoss < 500 && distToBoss > -50 && !r.defeated) {
          const bossSpd = 75 * dt;
          r.x += clamp(this.crowdX - r.x, -bossSpd, bossSpd);
          r.x = clamp(r.x, TRACK_L + 60, TRACK_R - 60);
        }
        this.updateBoss(r, dt);
      }

      // Check collision when row reaches player height
      if (r.d <= this.dist) {
        if (!r.done && r.kind !== 'boss') {
          r.done = true;
          this.resolveRow(r, rad);
          if (this.dead) break;
        }
      }
    }

    // Prune completed rows behind the camera
    this.rows = this.rows.filter((r) => r.d > this.dist - 350 || (r.kind === 'boss' && !r.defeated));
    this.fx.update(dt);
  }

  /* ------------------------------------------------------------ Row Collision Resolvers */
  resolveRow(r, rad) {
    const y = CROWD_Y - 20;

    // 1. Dual Multiplier Gates with Central Spike Divider
    if (r.kind === 'gate') {
      const midX = MID + (r.isMoving ? Math.sin(this.t * 3 + r.movePhase) * r.moveAmp : 0);
      const dividerW = 26;
      const dividerLeft = midX - dividerW / 2;
      const dividerRight = midX + dividerW / 2;

      // Crashed into central post?
      if (this.crowdX > dividerLeft - rad * 0.45 && this.crowdX < dividerRight + rad * 0.45) {
        const cut = 2; // Clean deduction of 2 beans
        this.count = Math.max(0, this.count - cut);

        this.fx.text(this.crowdX, y - 30, `IMPALED ON POST! −${cut}`, '#ff0054', 28, 1.1);
        this.fx.burst(midX, CROWD_Y, '#ff0054', 22, 240, 0.6, 4);
        this.fx.shake(10, 0.35);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Shredded by central dock mooring post!');
          return;
        }
      }

      // Determine which gate was chosen
      const chosenIdx = this.crowdX < midX ? 0 : 1;
      const g = r.gates[chosenIdx];

      if (g.op === '+') {
        this.count += g.v;
        this.score += 50 * this.stage;
        this.fx.text(this.crowdX, y - rad - 28, `+${g.v} BEANS! ✨`, '#38bdf8', 34, 1.0);
        this.fx.ring(this.crowdX, CROWD_Y, '#38bdf8', rad * 2.8, 0.5, 5);
        this.fx.burst(this.crowdX, CROWD_Y, '#38bdf8', 20, 220, 0.55, 4);
        this.sounds.gate(true);
        this.haptics.medium();
      } else {
        this.count = Math.max(0, this.count - g.v);
        this.fx.text(this.crowdX, y - rad - 28, `PENALTY! −${g.v}`, '#ff0054', 32, 1.0);
        this.fx.burst(this.crowdX, CROWD_Y, '#ff0054', 22, 220, 0.55, 4);
        this.fx.shake(8, 0.3);
        this.sounds.gate(false);
        this.haptics.heavy();
      }

      if (this.count <= 0) {
        this.die('Squad wiped out by a penalty gate!');
      }
    }

    // 2. Swinging Ship Anchor
    else if (r.kind === 'anchor') {
      const hit = Math.abs(r.x - this.crowdX) < rad + r.r * 0.85;
      if (hit) {
        if (this.boostTimer > 0) {
          this.score += 80;
          this.fx.text(this.crowdX, y - 24, 'ANCHOR SHATTERED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(this.crowdX, CROWD_Y, '#ffd166', 24, 240, 0.6, 4);
          return;
        }

        const loss = 2; // Exactly 2 beans
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 26, `ANCHOR CLANG! −${loss} ⚓`, '#ff7a88', 26, 0.95);
        this.fx.burst(this.crowdX, CROWD_Y, '#64748b', 22, 230, 0.55, 4);
        this.fx.shake(9, 0.35);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Battered into the Mersey by swinging ship anchor!');
          return;
        }
      } else {
        this.score += 25;
        this.fx.text(this.crowdX, y - 20, 'ANCHOR DODGED! +25', '#3dffa2', 18, 0.6);
      }
    }

    // 3. Victorian Steam Crane Crate Drop
    else if (r.kind === 'crane_drop') {
      const inLane = Math.abs(r.x - this.crowdX) < rad + r.w * 0.45;
      const isSmashed = r.state === 'drop';

      if (inLane && isSmashed) {
        if (this.boostTimer > 0) {
          this.score += 90;
          this.fx.text(this.crowdX, y - 24, 'CRATE SMASHED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(this.crowdX, CROWD_Y, '#b45309', 24, 250, 0.6, 4);
          return;
        }

        const loss = 3; // Exactly 3 beans
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 28, `CRUSHED BY CARGO! −${loss} 📦`, '#ff0054', 28, 1.0);
        this.fx.burst(this.crowdX, CROWD_Y, '#b45309', 26, 260, 0.6, 5);
        this.fx.ring(this.crowdX, CROWD_Y, '#ef4444', 220, 0.5, 5);
        this.fx.shake(12, 0.4);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Flattened by Victorian steam crane sugar crate!');
          return;
        }
      } else {
        this.score += 30;
        this.fx.text(this.crowdX, y - 20, 'CARGO CLEARED! +30', '#3dffa2', 18, 0.6);
      }
    }

    // 4. Rolling Rum Casks
    else if (r.kind === 'rum_casks') {
      let hit = false;
      for (const c of r.casks) {
        if (Math.abs(c.x - this.crowdX) < rad + c.r * 0.85) {
          hit = true;
          break;
        }
      }

      if (hit) {
        if (this.boostTimer > 0) {
          this.score += 70;
          this.fx.text(this.crowdX, y - 24, 'CASKS PULVERIZED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(this.crowdX, CROWD_Y, '#78350f', 24, 240, 0.6, 4);
          return;
        }

        const loss = 2; // Exactly 2 beans
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 26, `CASK SMACK! −${loss} 🪵`, '#ff7a88', 26, 0.95);
        this.fx.burst(this.crowdX, CROWD_Y, '#78350f', 22, 220, 0.5, 4);
        this.fx.shake(9, 0.35);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Tumbled into the dock by rolling rum casks!');
          return;
        }
      } else {
        this.score += 25;
        this.fx.text(this.crowdX, y - 20, 'CASKS DODGED! +25', '#3dffa2', 18, 0.6);
      }
    }

    // 5. Slapping Mersey Tentacle
    else if (r.kind === 'tentacle_slap') {
      const inDanger = r.side === 'left' ? this.crowdX < TRACK_L + r.w : this.crowdX > TRACK_R - r.w;
      const isSlamming = r.state === 'slam';

      if (inDanger && isSlamming) {
        if (this.boostTimer > 0) {
          this.score += 90;
          this.fx.text(this.crowdX, y - 24, 'TENTACLE SLICED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(this.crowdX, CROWD_Y, '#a21caf', 24, 250, 0.6, 4);
          return;
        }

        const loss = 2; // Exactly 2 beans
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 26, `TENTACLE SLAP! −${loss} 🐙`, '#ff0054', 28, 1.0);
        this.fx.burst(this.crowdX, CROWD_Y, '#a21caf', 24, 240, 0.6, 4);
        this.fx.ring(this.crowdX, CROWD_Y, '#0284c7', 220, 0.5, 5);
        this.fx.shake(10, 0.35);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Whipped into the Mersey Basin by a kraken tentacle!');
          return;
        }
      } else {
        this.score += 30;
        this.fx.text(this.crowdX, y - 20, 'TENTACLE DODGED! +30', '#3dffa2', 18, 0.6);
      }
    }

    // 6. Rotating Dock Turnstile
    else if (r.kind === 'turnstile') {
      const distFromCenter = Math.abs(this.crowdX - r.x);
      let hitArm = false;

      if (distFromCenter < rad + r.armLen * 0.9) {
        // Player position angle from center
        const pAng = Math.atan2(0, this.crowdX - r.x);
        for (let i = 0; i < 3; i++) {
          const armAng = (r.angle + (i * TAU) / 3) % TAU;
          let diff = Math.abs(pAng - armAng);
          if (diff > Math.PI) diff = TAU - diff;
          if (diff < 0.45) {
            hitArm = true;
            break;
          }
        }
      }

      if (hitArm) {
        if (this.boostTimer > 0) {
          this.score += 80;
          this.fx.text(this.crowdX, y - 20, 'TURNSTILE SMASHED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(this.crowdX, CROWD_Y, '#ffd166', 24, 240, 0.6, 4);
          return;
        }

        const loss = 2; // Exactly 2 beans
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 24, `TURNSTILE SMACK! −${loss} 🔄`, '#ff7a88', 26, 0.9);
        this.fx.burst(this.crowdX, CROWD_Y, '#cbd5e1', 20, 220, 0.5, 4);
        this.fx.shake(8, 0.3);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Battered by rotating dock customs turnstile!');
          return;
        }
      } else {
        this.score += 30;
        this.fx.text(this.crowdX, y - 20, 'SLIPPED THROUGH! +30', '#3dffa2', 18, 0.6);
      }
    }

    // 7. Slippery Seagull Dive-Bomb & Grease Puddle
    else if (r.kind === 'seagull_slick') {
      const hit = Math.abs(r.x - this.crowdX) < rad + r.w * 0.45;
      if (hit) {
        this.slipTimer = 1.35; // Trigger drift wobble
        const loss = 1; // 1 bean slips into water
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 26, `SLIPPED ON FISH OIL! −${loss} 🐟`, '#38bdf8', 26, 0.95);
        this.fx.burst(this.crowdX, CROWD_Y, '#38bdf8', 18, 190, 0.5, 3.5);
        this.fx.shake(6, 0.25);
        this.sounds.drop();
        this.haptics.medium();

        if (this.count <= 0) {
          this.die('Slipped off the slick dock timber into the Mersey!');
          return;
        }
      } else {
        this.score += 20;
        this.fx.text(this.crowdX, y - 20, 'CLEARED OIL SLICK! +20', '#3dffa2', 18, 0.6);
      }
    }

    // 8. Powerup
    else if (r.kind === 'powerup') {
      if (Math.abs(r.x - this.crowdX) < rad + r.w * 0.5) {
        if (r.type === 'cannon') {
          const bonus = 3; // Exactly 3 recruits
          this.count += bonus;
          this.score += 150;
          this.fx.text(this.crowdX, y - 30, `CANNON RECRUITS! +${bonus} 🚀`, '#ffd166', 30, 1.1);
          this.fx.burst(this.crowdX, CROWD_Y, '#ffd166', 24, 240, 0.6, 4);
          this.sounds.up();
          this.haptics.heavy();
        } else {
          this.boostTimer = 2.8;
          this.score += 100;
          this.fx.text(this.crowdX, y - 30, 'NITRO TURBO! ⚡⚡', '#3dffa2', 30, 1.2);
          this.fx.ring(this.crowdX, CROWD_Y, '#3dffa2', 260, 0.5, 5);
          this.sounds.up();
          this.haptics.heavy();
        }
      }
    }

    // Backward-compatible handlers for legacy obstacles
    else if (r.kind === 'sweeper') {
      const armCos = Math.cos(r.angle);
      const beamX = MID + armCos * r.gapDist;
      if (Math.abs(this.crowdX - beamX) > rad + 24) {
        const loss = 2;
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 24, `SWEPT OFF QUAY! −${loss}`, '#ff7a88', 26, 0.9);
        this.fx.shake(9, 0.35);
        this.sounds.hit();
        if (this.count <= 0) this.die('Swept into the Mersey by rotating dock boom!');
      }
    } else if (r.kind === 'gang') {
      if (Math.abs(r.x - this.crowdX) < rad + r.r * 0.85) {
        const loss = Math.min(this.count, r.n);
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 30, `GANG CLASH! −${loss}`, '#ff0054', 28, 1.0);
        this.sounds.hit();
        if (this.count <= 0) this.die('Overwhelmed by rival dock gang!');
      }
    } else if (r.kind === 'drawbridge') {
      if (this.crowdX < r.x - r.w / 2 || this.crowdX > r.x + r.w / 2) {
        const loss = 2;
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 24, `FELL IN WATER! −${loss} 💦`, '#38bdf8', 26, 0.9);
        this.sounds.drop();
        if (this.count <= 0) this.die('Fell off the drawbridge into the Mersey Basin!');
      }
    } else if (r.kind === 'tnt') {
      for (const b of r.barrels) {
        if (Math.abs(b.x - this.crowdX) < rad + b.r * 0.85) {
          const cut = 3;
          this.count = Math.max(0, this.count - cut);
          this.fx.text(b.x, y - 28, `BARREL BOOM! −${cut}`, '#ff0054', 28, 1.0);
          this.sounds.hit();
          if (this.count <= 0) this.die('Blown up by maritime gunpowder barrel!');
        }
      }
    } else if (r.kind === 'boulder') {
      if (Math.abs(r.x - this.crowdX) < rad + r.r * 0.85) {
        const loss = 2;
        this.count = Math.max(0, this.count - loss);
        this.fx.text(r.x, y - 24, `RUN OVER! −${loss}`, '#ff7a88', 26, 0.9);
        this.sounds.hit();
        if (this.count <= 0) this.die('Crushed by rolling jawbreaker boulder!');
      }
    }

    // 8. Coins
    else if (r.kind === 'coins') {
      for (const c of r.coins) {
        if (!c.collected && Math.abs(c.x - this.crowdX) < rad + 18) {
          c.collected = true;
          this.score += 75;
          this.fx.text(c.x, y - 16, '+75 🪙', '#ffd166', 20, 0.6);
          this.fx.burst(c.x, CROWD_Y, '#ffd166', 10, 140, 0.4, 3);
          this.sounds.stack(2);
        }
      }
    }
  }

  /* ------------------------------------------------------------ Milestone Boss & Victory Stairs */
  updateBoss(r, dt) {
    if (r.defeated) return;

    const distToBoss = r.d - this.dist;

    // Check if player reached boss engagement range
    if (distToBoss <= 100 && !r.clashing) {
      if (this.count < r.req) {
        this.die(`Crushed by ${r.title}! Needed ${r.req} beans, but only brought ${Math.round(this.count)}!`);
        return;
      }
      r.clashing = true;
      r.clashTimer = 0;
      this.sounds.up();
      this.haptics.heavy();
      this.fx.text(MID, CROWD_Y - 90, '⚔️ SQUAD CHARGE! ⚔️', '#ffd166', 34, 1.2);
    }

    if (r.clashing) {
      r.clashTimer += dt;
      const drainRate = Math.max(14, r.maxHp * 1.6);
      const dmg = Math.min(r.hp, drainRate * dt);
      r.hp -= dmg;

      this.fx.burst(r.x + (Math.random() - 0.5) * 80, CROWD_Y - 50 + (Math.random() - 0.5) * 40, r.color, 3, 140, 0.3, 3);
      this.fx.shake(4, 0.1);
      if (Math.random() < 0.35) {
        this.sounds.hit();
        this.haptics.medium();
      }

      if (r.hp <= 0) {
        r.hp = 0;
        r.defeated = true;
        r.done = true;
        r.clashing = false;

        this.score += 1000 * this.stage;
        this.fx.text(MID, CROWD_Y - 90, `👑 ${r.title} DEFEATED! +${1000 * this.stage}`, '#ffd166', 32, 1.8);
        this.fx.ring(MID, CROWD_Y, '#ffd166', 380, 0.8, 8);
        this.fx.burst(MID, CROWD_Y, r.color, 50, 360, 0.9, 6);
        this.fx.burst(MID, CROWD_Y, '#ffd166', 40, 300, 0.8, 5);
        this.fx.shake(16, 0.6);
        this.sounds.survive();
        this.haptics.heavy();

        // Rescued recruits bonus
        const rescueBonus = 3 + this.stage * 2;
        this.count += rescueBonus;
        // Floor guarantee for next stage
        const targetNext = this.bossReqFor(this.stage + 1);
        this.count = Math.max(this.count, targetNext - 8);

        this.fx.text(MID, CROWD_Y - 40, `+${rescueBonus} RESCUED RECRUITS! 🎖️`, '#38bdf8', 26, 1.5);

        // Victory Multiplier Podium
        this.bossState = 'stairs';
        this.stairsProgress = 0;
        this.stairsScoreMult = 1.0;
      }
    }
  }

  updateStairs(dt) {
    this.stairsProgress += dt * 2.2;
    const steps = [
      { step: 1, mult: 1.2 },
      { step: 2, mult: 1.5 },
      { step: 3, mult: 2.0 },
    ];
    const curStepIdx = Math.min(steps.length - 1, Math.floor(this.stairsProgress));
    const step = steps[curStepIdx];

    if (this.stairsScoreMult < step.mult) {
      this.stairsScoreMult = step.mult;
      this.score += Math.round(250 * step.mult);
      this.fx.text(MID, 320 - curStepIdx * 45, `STEP ${step.step} · ×${step.mult}! 🎉`, '#ffd166', 30, 0.8);
      this.fx.burst(MID, 320 - curStepIdx * 45, '#ffd166', 16, 180, 0.5, 3.5);
      this.sounds.stack(step.step);
      this.haptics.medium();
    }

    if (this.stairsProgress >= steps.length + 0.6) {
      if (this.stage >= 3) {
        // Conquered all 3 Bosses!
        this.bossState = 'none';
        this.won = true;
        this.winReason = 'All 3 Dock Bosses Defeated! 👑';
        return;
      }
      this.bossState = 'none';
      this.stage++;
      this.feverRush = 3.0;
      this.sounds.upgrade();
      this.fx.text(MID, CROWD_Y - 50, `STAGE ${this.stage}: TARGET ${this.bossReqFor(this.stage)} BEANS! ⚡`, '#3dffa2', 28, 1.8);
      this.initStage(this.stage);
    }
  }

  /* ------------------------------------------------------------ Gentle Linear-Feel Perspective Projection */
  proj(worldX, dz) {
    const safeDz = Math.max(-220, dz);
    const s = FOCAL / (FOCAL + safeDz);
    return {
      x: MID + (worldX - MID) * s,
      y: HORIZON_Y + (CROWD_Y - HORIZON_Y) * s,
      s,
    };
  }

  /* ------------------------------------------------------------ Rendering Pipeline */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const off = this.fx.offset();

    ctx.save();
    ctx.translate(off.x, off.y);

    // 1. Cached Weebl Harbor Sky, Sunburst Rays, Hills & Liverpool Estuary Landmarks
    this.renderHarborSky(ctx, W, H);

    // 2. Batched Zero-Shimmer 2.5D Perspective Timber Pier & Brick Promenade
    this.renderBoardwalk(ctx, W, H);

    // 3. Perspective Quayside Mooring Props (world-locked integer spacing)
    this.renderQuaysideProps(ctx);

    // 4. Perspective Track Gates, Hazards & Bosses (Far -> Near)
    if (this.bossState === 'stairs') {
      this.renderVictoryStairs(ctx, W, H);
    } else {
      const visRows = [];
      for (let i = 0; i < this.rows.length; i++) {
        const r = this.rows[i];
        const dz = r.d - this.dist;
        if (dz < -85 || dz > PIER_MAX_DZ) continue;
        // Hide passed gates cleanly once behind hero knees so they don't mud-wash HUD/squad
        if (r.done && r.kind === 'gate' && dz < 8) continue;
        visRows.push(r);
      }
      if (visRows.length > 1) visRows.sort((a, b) => b.d - a.d);

      for (let i = 0; i < visRows.length; i++) {
        const r = visRows[i];
        const dz = r.d - this.dist;
        const p = this.proj(MID, dz);
        const fade = dz > PIER_MAX_DZ - 160 ? clamp((PIER_MAX_DZ - dz) / 160, 0, 1) : 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.s, p.s);
        if (fade < 1) ctx.globalAlpha *= fade;

        if (r.kind === 'gate') this.drawGates(r, 0);
        else if (r.kind === 'anchor') this.drawAnchor(r, 0);
        else if (r.kind === 'crane_drop') this.drawCraneDrop(r, 0);
        else if (r.kind === 'rum_casks') this.drawRumCasks(r, 0);
        else if (r.kind === 'tentacle_slap') this.drawTentacleSlap(r, 0);
        else if (r.kind === 'turnstile') this.drawTurnstile(r, 0);
        else if (r.kind === 'seagull_slick') this.drawSeagullSlick(r, 0);
        else if (r.kind === 'powerup') this.drawPowerup(r, 0);
        else if (r.kind === 'coins') this.drawCoins(r, 0);
        else if (r.kind === 'sweeper') this.drawSweeper(r, 0);
        else if (r.kind === 'gang') this.drawGang(r, 0);
        else if (r.kind === 'drawbridge') this.drawDrawbridge(r, 0);
        else if (r.kind === 'tnt') this.drawTnt(r, 0);
        else if (r.kind === 'boulder') this.drawBoulder(r, 0);
        else if (r.kind === 'boss') {
          this.drawBoss(r, 0);
          const ready = this.count >= r.req;
          const bannerY = -126;
          const bTxt = ready
            ? `READY! (${Math.round(this.count)}/${r.req})`
            : `NEED ${r.req} BEANS!`;
          drawComicPanel(ctx, -92, bannerY - 12, 184, 24, 8, ready ? '#166534' : '#7f1d1d', {
            lineWidth: 2.2,
            shadowDx: 1.5,
            shadowDy: 2,
          });
          drawComicText(ctx, bTxt, 0, bannerY, "900 11.5px 'Fredoka', 'Outfit', sans-serif", ready ? '#4ade80' : '#fef08a', {
            strokeWidth: 3.0,
          });
        }
        ctx.restore();
      }
    }

    // 5. Crowned Green Hero Leader + Cached #000-Inked Weebl Pear-Bean Squad
    this.drawLivingCrowd(this.crowdX, CROWD_Y, Math.min(this.count, 180));

    // Crisp Comic Squad Counter Badge centered cleanly above Hero Leader
    const badgeFill = this.boostTimer > 0 ? '#10b981' : this.feverRush > 0 ? '#f59e0b' : (this.count >= this.bossReq ? '#22c55e' : '#0f172a');
    const badgeY = CROWD_Y - 56;
    drawComicPanel(ctx, this.crowdX - 24, badgeY - 12, 48, 24, 9, badgeFill, {
      lineWidth: 2.4,
      shadowDx: 1.5,
      shadowDy: 2,
    });
    drawComicText(ctx, fmt(this.count), this.crowdX, badgeY, "900 15px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
      strokeWidth: 3.6,
    });

    this.fx.render(ctx, 1);
    ctx.restore();

    // 6. Simplified 2-Card Comic HUD seated over Harbor Sky
    this.renderHUD(ctx, W, H);
  }

  /* ------------------------------------------------------------ Cached Weebl Harbor Sky & Landmarks */
  renderHarborSky(ctx, W, H) {
    const seaY = 236;
    const key = `${this.stage}|${W}|${H}`;
    if (this._skyCacheKey !== key || !this._skyCacheCanvas) {
      const off = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      const sctx = off?.getContext?.('2d');
      if (off && sctx) {
        off.width = W;
        off.height = H;
        const g = sctx.createLinearGradient(0, 0, 0, seaY);
        if (this.stage === 2) {
          g.addColorStop(0, '#1d4ed8');
          g.addColorStop(0.55, '#7c3aed');
          g.addColorStop(1, '#fb7185');
        } else if (this.stage >= 3) {
          g.addColorStop(0, '#0f172a');
          g.addColorStop(0.55, '#312e81');
          g.addColorStop(1, '#6d28d9');
        } else {
          g.addColorStop(0, '#1d4ed8');
          g.addColorStop(0.52, '#38bdf8');
          g.addColorStop(1, '#fef08a');
        }
        sctx.fillStyle = g;
        sctx.fillRect(0, 0, W, seaY + 12);

        drawSunburst(sctx, MID, 232, 260, 0.22, 12, this.stage >= 3 ? 0.16 : 0.34, false);

        sctx.fillStyle = this.stage >= 3 ? '#15803d' : '#4ade80';
        sctx.strokeStyle = STYLE_TOKENS.ink;
        sctx.lineWidth = 2.6;
        sctx.beginPath();
        sctx.moveTo(-10, seaY + 10);
        sctx.lineTo(-10, 212);
        sctx.quadraticCurveTo(85, 186, 175, 216);
        sctx.quadraticCurveTo(285, 188, 390, 206);
        sctx.lineTo(W + 10, 214);
        sctx.lineTo(W + 10, seaY + 10);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();

        sctx.fillStyle = '#312e81';
        sctx.beginPath();
        sctx.moveTo(-6, seaY + 8);
        sctx.lineTo(-6, 216);
        sctx.lineTo(28, 198);
        sctx.lineTo(54, 216);
        sctx.lineTo(132, 216);
        sctx.lineTo(152, 194);
        sctx.lineTo(174, 216);
        sctx.lineTo(276, 216);
        sctx.lineTo(304, 192);
        sctx.lineTo(328, 216);
        sctx.lineTo(W + 6, 216);
        sctx.lineTo(W + 6, seaY + 8);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();

        const seaGrad = sctx.createLinearGradient(0, seaY - 6, 0, H);
        seaGrad.addColorStop(0, '#0ea5e9');
        seaGrad.addColorStop(0.35, '#0284c7');
        seaGrad.addColorStop(1, '#0369a1');
        sctx.fillStyle = seaGrad;
        sctx.fillRect(0, seaY - 6, W, H - seaY + 6);

        sctx.strokeStyle = STYLE_TOKENS.ink;
        sctx.lineWidth = 2.8;
        sctx.beginPath();
        sctx.moveTo(0, seaY - 6);
        sctx.lineTo(W, seaY - 6);
        sctx.stroke();

        this._skyCacheCanvas = off;
        this._skyCacheImg = null;
        if (typeof off.toDataURL === 'function' && typeof Image !== 'undefined') {
          const skyImg = new Image();
          skyImg.decoding = 'async';
          skyImg.src = off.toDataURL('image/png');
          skyImg.decode?.().catch(() => {});
          this._skyCacheImg = skyImg;
        }
        this._skyCacheKey = key;
      }
    }

    const skySrc =
      this._skyCacheImg && this._skyCacheImg.complete && this._skyCacheImg.naturalWidth > 0
        ? this._skyCacheImg
        : this._skyCacheCanvas;
    if (skySrc && typeof ctx.drawImage === 'function') {
      ctx.drawImage(skySrc, 0, 0, W, H);
    }

    // Drifting clouds + verified Liverpool landmarks + bobbing harbor sailboat
    const c1X = posMod(82 + this.t * 9, W + 120) - 60;
    const c2X = posMod(345 - this.t * 7, W + 120) - 60;
    drawSprite(ctx, 'cloud_1', c1X, 168, 88, 52, { fallback: () => {} });
    drawSprite(ctx, 'cloud_2', c2X, 164, 78, 45, { fallback: () => {} });
    drawSprite(ctx, 'city_superlambanana', 68, 216, 42, 56, { fallback: () => {} });
    drawSprite(ctx, 'city_liver_building', W - 78, 212, 74, 86, { fallback: () => {} });

    const boatBob = Math.sin(this.t * 3.2) * 2.5;
    ctx.save();
    ctx.translate(46 + Math.sin(this.t * 0.4) * 8, 286 + boatBob);
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -2); ctx.lineTo(0, -24); ctx.lineTo(14, -5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------ Batched Zero-Shimmer 2.5D Boardwalk */
  renderBoardwalk(ctx, W, H) {
    const pFarL = this.proj(TRACK_L, PIER_MAX_DZ);
    const pFarR = this.proj(TRACK_R, PIER_MAX_DZ);
    const pNearL = this.proj(TRACK_L, -220);
    const pNearR = this.proj(TRACK_R, -220);

    // Batched world-locked ocean wave sparkles (single stroke!)
    const wStep = 135;
    const wkMin = Math.floor((this.dist - 150) / wStep);
    const wkMax = Math.ceil((this.dist + PIER_MAX_DZ) / wStep);
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.72)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = wkMin; k <= wkMax; k++) {
      const dz = k * wStep - this.dist;
      if (dz < -180 || dz > PIER_MAX_DZ) continue;
      const side = posMod(k, 2) === 0 ? TRACK_L - 44 : TRACK_L - 78;
      const wp = this.proj(side, dz);
      const r = 13 * wp.s;
      ctx.moveTo(wp.x + r * Math.cos(0.2), wp.y + r * Math.sin(0.2));
      ctx.arc(wp.x, wp.y, r, 0.2, Math.PI - 0.2);
    }
    ctx.stroke();

    // 1. Far Pier Headland Stone Seawall connecting seamlessly into Liverpool shore
    ctx.fillStyle = '#d6d3d1';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(pFarL.x - 18 * pFarL.s, 228);
    ctx.lineTo(pFarR.x + 86 * pFarR.s, 228);
    ctx.lineTo(pFarR.x + 86 * pFarR.s, pFarR.y + 4);
    ctx.lineTo(pFarL.x - 18 * pFarL.s, pFarL.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawSprite(ctx, 'p_stone_battlement', MID, 232, (pFarR.x - pFarL.x) + 18, 22, { fallback: () => {} });

    // 2. Right Red Sugar-Brick Warehouse Apron
    const pApronFarR = this.proj(TRACK_R + 74, PIER_MAX_DZ);
    const pApronNearR = this.proj(TRACK_R + 74, -220);
    ctx.fillStyle = '#9f1239';
    ctx.beginPath();
    ctx.moveTo(pFarR.x, pFarR.y);
    ctx.lineTo(pApronFarR.x, pApronFarR.y);
    ctx.lineTo(pApronNearR.x, pApronNearR.y);
    ctx.lineTo(pNearR.x, pNearR.y);
    ctx.closePath();
    ctx.fill();

    // 3. Base Oak Timber Deck (flat Weebl 2-tone base — zero per-frame gradient allocations!)
    ctx.fillStyle = this.stage === 2 ? '#b8763e' : this.stage >= 3 ? '#d49a16' : '#dfa468';
    ctx.beginPath();
    ctx.moveTo(pFarL.x, pFarL.y);
    ctx.lineTo(pFarR.x, pFarR.y);
    ctx.lineTo(pNearR.x, pNearR.y);
    ctx.lineTo(pNearL.x, pNearL.y);
    ctx.closePath();
    ctx.fill();

    const cFarL = this.proj(MID - 24, PIER_MAX_DZ);
    const cFarR = this.proj(MID + 24, PIER_MAX_DZ);
    const cNearL = this.proj(MID - 24, -220);
    const cNearR = this.proj(MID + 24, -220);
    ctx.fillStyle = 'rgba(254, 243, 199, 0.24)';
    ctx.beginPath();
    ctx.moveTo(cFarL.x, cFarL.y);
    ctx.lineTo(cFarR.x, cFarR.y);
    ctx.lineTo(cNearR.x, cNearR.y);
    ctx.lineTo(cNearL.x, cNearL.y);
    ctx.closePath();
    ctx.fill();

    // 4. Batched World-Locked Planks, Joints, Bricks & Center Dashes (strictly 3 draw calls total!)
    const step = 105;
    const kMin = Math.floor((this.dist - 220) / step);
    const kMax = Math.ceil((this.dist + PIER_MAX_DZ) / step);

    // 4a. Batch alternating dark plank fill bands into ONE path
    ctx.fillStyle = 'rgba(120, 53, 15, 0.08)';
    ctx.beginPath();
    for (let k = kMin; k < kMax; k++) {
      if (posMod(k, 2) !== 0) continue;
      const dz0 = Math.max(-220, k * step - this.dist);
      const dz1 = Math.min(PIER_MAX_DZ, (k + 1) * step - this.dist);
      if (dz1 <= dz0) continue;
      const aL = this.proj(TRACK_L, dz0);
      const aR = this.proj(TRACK_R, dz0);
      const bL = this.proj(TRACK_L, dz1);
      const bR = this.proj(TRACK_R, dz1);
      ctx.moveTo(bL.x, bL.y); ctx.lineTo(bR.x, bR.y);
      ctx.lineTo(aR.x, aR.y); ctx.lineTo(aL.x, aL.y);
      ctx.closePath();
    }
    ctx.fill();

    // 4b. Batch horizontal plank seams & vertical plank joints into ONE stroke
    ctx.strokeStyle = 'rgba(69, 26, 3, 0.44)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let k = kMin; k < kMax; k++) {
      const dz0 = Math.max(-220, k * step - this.dist);
      const dz1 = Math.min(PIER_MAX_DZ, (k + 1) * step - this.dist);
      if (dz1 <= dz0) continue;

      const worldSeamDz = k * step - this.dist;
      if (worldSeamDz >= -220 && worldSeamDz <= PIER_MAX_DZ) {
        const sL = this.proj(TRACK_L, worldSeamDz);
        const sApronR = this.proj(TRACK_R + 74, worldSeamDz);
        ctx.moveTo(sL.x, sL.y);
        ctx.lineTo(sApronR.x, sApronR.y);
      }

      const jOffset = TRACK_L + 42 + posMod(k * 97, TRACK_W - 84);
      const j0 = this.proj(jOffset, dz0);
      const j1 = this.proj(jOffset, dz1);
      ctx.moveTo(j0.x, j0.y);
      ctx.lineTo(j1.x, j1.y);
    }
    ctx.stroke();

    // 4c. Batch all perspective center road dashes into ONE fill + ONE stroke
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = kMin; k < kMax; k++) {
      const dz0 = k * step - this.dist;
      const dMid0 = Math.max(-220, dz0 + 20);
      const dMid1 = Math.min(PIER_MAX_DZ, dz0 + 66);
      if (dMid1 <= dMid0) continue;
      const d0L = this.proj(MID - 4, dMid0);
      const d0R = this.proj(MID + 4, dMid0);
      const d1L = this.proj(MID - 4, dMid1);
      const d1R = this.proj(MID + 4, dMid1);
      ctx.moveTo(d1L.x, d1L.y); ctx.lineTo(d1R.x, d1R.y);
      ctx.lineTo(d0R.x, d0R.y); ctx.lineTo(d0L.x, d0L.y);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    // 5. #000-Inked Perspective Curb Rails
    const pCurbFarL = this.proj(TRACK_L - 10, PIER_MAX_DZ);
    const pCurbNearL = this.proj(TRACK_L - 10, -220);
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(pCurbFarL.x, pCurbFarL.y); ctx.lineTo(pFarL.x, pFarL.y);
    ctx.lineTo(pNearL.x, pNearL.y); ctx.lineTo(pCurbNearL.x, pCurbNearL.y);
    ctx.closePath();
    ctx.fill();

    const pStoneFarR = this.proj(TRACK_R + 10, PIER_MAX_DZ);
    const pStoneNearR = this.proj(TRACK_R + 10, -220);
    ctx.fillStyle = '#e7e5e4';
    ctx.beginPath();
    ctx.moveTo(pFarR.x, pFarR.y); ctx.lineTo(pStoneFarR.x, pStoneFarR.y);
    ctx.lineTo(pStoneNearR.x, pStoneNearR.y); ctx.lineTo(pNearR.x, pNearR.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(pCurbFarL.x, pCurbFarL.y); ctx.lineTo(pCurbNearL.x, pCurbNearL.y);
    ctx.moveTo(pFarL.x, pFarL.y); ctx.lineTo(pNearL.x, pNearL.y);
    ctx.moveTo(pFarR.x, pFarR.y); ctx.lineTo(pNearR.x, pNearR.y);
    ctx.moveTo(pStoneFarR.x, pStoneFarR.y); ctx.lineTo(pStoneNearR.x, pStoneNearR.y);
    ctx.moveTo(pApronFarR.x, pApronFarR.y); ctx.lineTo(pApronNearR.x, pApronNearR.y);
    ctx.stroke();
  }

  renderQuaysideProps(ctx) {
    // World-locked props iterating fixed integer steps back -> front (painter's order!)
    const propStep = 220;
    const pkMin = Math.floor((this.dist - 90) / propStep);
    const pkMax = Math.ceil((this.dist + PIER_MAX_DZ) / propStep);
    const types = ['bollard', 'lamp', 'crane', 'crate'];

    for (let k = pkMax; k >= pkMin; k--) {
      const dz = k * propStep - this.dist;
      if (dz < -90 || dz > PIER_MAX_DZ - 40) continue;
      const kind = types[posMod(k, types.length)];
      const alpha = dz > PIER_MAX_DZ - 260 ? clamp((PIER_MAX_DZ - dz) / 260, 0, 1) : 1;

      ctx.save();
      if (alpha < 1) ctx.globalAlpha *= alpha;

      if (kind === 'bollard') {
        const p = this.proj(TRACK_L - 6, dz);
        ctx.translate(p.x, p.y);
        ctx.scale(p.s, p.s);
        celShadow(ctx, 0, 8, 10, 4, 0.3);
        celBox(ctx, -6, -14, 12, 20, 4, '#334155', { depth: 3, lineWidth: 2.2 });
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(7, 0); ctx.moveTo(-7, 2); ctx.lineTo(7, 4); ctx.stroke();
        celCircle(ctx, 0, -15, 7.5, '#64748b', { lineWidth: 2.2 });
      } else if (kind === 'lamp') {
        const p = this.proj(TRACK_R + 18, dz);
        ctx.translate(p.x, p.y);
        ctx.scale(p.s, p.s);
        celShadow(ctx, 0, 10, 8, 3.5, 0.28);
        celBox(ctx, -3, -24, 6, 30, 2, '#1e293b', { lineWidth: 2.0 });
        ctx.fillStyle = 'rgba(254, 240, 138, 0.34)';
        ctx.beginPath(); ctx.arc(0, -25, 16, 0, TAU); ctx.fill();
        celCircle(ctx, 0, -25, 7.5, '#fef08a', { lineWidth: 2.2 });
      } else if (kind === 'crane') {
        const p = this.proj(TRACK_R + 28, dz);
        ctx.translate(p.x, p.y);
        ctx.scale(p.s, p.s);
        drawSprite(ctx, 'b_crate_chest', 0, 0, 30, 24, {
          fallback: (cctx) => {
            celBox(cctx, -12, -10, 24, 20, 4, '#d97706', { depth: 3, lineWidth: 2.2 });
          },
        });
      } else if (kind === 'crate') {
        const p = this.proj(TRACK_L - 12, dz);
        ctx.translate(p.x, p.y);
        ctx.scale(p.s, p.s);
        celBox(ctx, -11, -5, 22, 16, 4, '#92400e', { depth: 3, lineWidth: 2.2 });
        drawSprite(ctx, 'b_tnt_barrel', 0, -3, 21, 25, {
          fallback: (bctx) => {
            celBox(bctx, -8, -10, 16, 20, 4, '#b45309', { lineWidth: 2.2 });
          },
        });
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ Dual Arcade Gates (local coords around MID) */
  drawGates(r, y) {
    const ctx = this.ctx;
    const midOff = r.isMoving ? Math.sin(this.t * 3 + r.movePhase) * r.moveAmp : 0;
    const trackMin = TRACK_L - MID; // -180
    const trackMax = TRACK_R - MID; // +180

    const leftBox = [trackMin + 10, midOff - 13];
    const rightBox = [midOff + 13, trackMax - 10];
    const boxes = [leftBox, rightBox];

    boxes.forEach(([x0, x1], i) => {
      const g = r.gates[i];
      const w = x1 - x0;
      const h = 88;
      const topY = y - h / 2;
      const alpha = r.done ? 0.35 : 1;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Fast 2-tone Flash Arcade Portal Frame (zero per-frame gradients or clip masks!)
      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath(); ctx.roundRect(x0 + 2, topY + 4, w, h, 14); ctx.fill();

      ctx.fillStyle = g.good ? '#0284c7' : '#e11d48';
      ctx.beginPath(); ctx.roundRect(x0, topY, w, h, 14); ctx.fill();

      ctx.fillStyle = g.good ? '#38bdf8' : '#fb7185';
      ctx.beginPath(); ctx.roundRect(x0 + 3, topY + 2, w - 6, h * 0.42, 11); ctx.fill();

      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3.0;
      ctx.beginPath(); ctx.roundRect(x0, topY, w, h, 14); ctx.stroke();

      drawComicPanel(ctx, x0 + 8, topY - 8, w - 16, 20, 7, '#0f172a', {
        lineWidth: 2.2,
        shadowDx: 1,
        shadowDy: 2,
      });
      drawComicText(
        ctx,
        g.good ? '⚡ BOOST' : '☠️ PENALTY',
        (x0 + x1) / 2,
        topY + 2,
        "900 10.5px 'Fredoka', 'Outfit', sans-serif",
        g.good ? '#fde047' : '#fda4af',
        { strokeWidth: 3.0, stroke: '#000000' },
      );

      const label = `${g.op}${g.v}`;
      drawComicText(ctx, label, (x0 + x1) / 2, y + 6, "900 40px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
        strokeWidth: 5.5,
      });

      const subLabel = g.op === '+' ? `+${g.v} BEANS` : `−${g.v} BEANS`;
      drawComicText(ctx, subLabel, (x0 + x1) / 2, y + 32, "900 11.5px 'Fredoka', 'Outfit', sans-serif", g.good ? '#fef08a' : '#fecdd3', {
        strokeWidth: 3.4,
      });

      ctx.restore();
    });

    // Flanking #000-inked `p_stone_pillar` quayside stanchions
    drawSprite(ctx, 'p_stone_pillar', trackMin + 6, y, 16, 42, { fallback: () => {} });
    drawSprite(ctx, 'p_stone_pillar', trackMax - 6, y, 16, 42, { fallback: () => {} });

    // Central Deadly Spiked Mooring Pillar (#000-inked Warning Post)
    ctx.save();
    ctx.translate(midOff, y);
    celShadow(ctx, 0, 50, 16, 6, 0.3);

    for (let sy = -38; sy <= 36; sy += 19) {
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, sy); ctx.lineTo(-19, sy + 5); ctx.lineTo(-10, sy + 10); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, sy); ctx.lineTo(19, sy + 5); ctx.lineTo(10, sy + 10); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    celBox(ctx, -11, -50, 22, 100, 8, '#dc2626', { depth: 4, lineWidth: 2.8 });
    ctx.fillStyle = '#fef08a';
    for (let hy = -34; hy <= 28; hy += 28) {
      ctx.fillRect(-8, hy, 16, 7);
    }
    celCircle(ctx, 0, 0, 11, '#0f172a', { lineWidth: 2.2, shine: false });
    drawComicText(ctx, '💀', 0, 1, "900 12px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
      strokeWidth: 2.0,
    });
    ctx.restore();
  }

  /* ------------------------------------------------------------ 1. Swinging Ship Anchor (local MID=0) */
  drawAnchor(r, y) {
    const ctx = this.ctx;
    ctx.save();

    const pivotY = y - 135;
    const anchorX = r.x - MID;
    const anchorY = y;

    celShadow(ctx, anchorX, y + 22, 32, 12, 0.32);

    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 8.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, pivotY);
    ctx.lineTo(anchorX, anchorY - 34);
    ctx.stroke();

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4.2;
    ctx.stroke();

    ctx.translate(anchorX, anchorY);
    ctx.rotate(r.swingAngle || 0);
    ctx.lineJoin = 'round';

    celCircle(ctx, 0, -32, 11, '#64748b', { lineWidth: 2.8, shine: false });
    celCircle(ctx, 0, -32, 4.5, '#0f172a', { lineWidth: 2.0, shine: false });

    celBox(ctx, -28, -20, 56, 9, 4, '#64748b', { lineWidth: 2.6 });
    celCircle(ctx, -28, -15.5, 6, '#facc15', { lineWidth: 2.2 });
    celCircle(ctx, 28, -15.5, 6, '#facc15', { lineWidth: 2.2 });
    celBox(ctx, -6, -20, 12, 36, 4, '#475569', { lineWidth: 2.6 });

    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-34, 4);
    ctx.quadraticCurveTo(0, 32, 34, 4);
    ctx.quadraticCurveTo(24, 22, 0, 24);
    ctx.quadraticCurveTo(-24, 22, -34, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(-34, 4); ctx.lineTo(-41, 15); ctx.lineTo(-27, 13); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(34, 4); ctx.lineTo(41, 15); ctx.lineTo(27, 13); ctx.closePath();
    ctx.fill(); ctx.stroke();

    drawComicText(ctx, '⚓ −2 BEANS', 0, 38, "900 11.5px 'Fredoka', 'Outfit', sans-serif", '#fecdd3', {
      strokeWidth: 3.4,
    });
    ctx.restore();
  }

  /* ------------------------------------------------------------ 2. Steam Crane Cargo Drop (local MID=0) */
  drawCraneDrop(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x - MID, y);

    const isWarn = r.state === 'warn';
    const isDrop = r.state === 'drop';

    const flash = Math.sin(this.t * 16) > 0;
    const matFill = isDrop ? '#ef4444' : flash ? '#fef08a' : '#f59e0b';
    ctx.save();
    ctx.globalAlpha = isDrop ? 0.88 : 0.72;
    celBox(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 10, matFill, { lineWidth: 2.8, gloss: false });
    ctx.fillStyle = '#0f172a';
    const hw = r.w * 0.5 - 3;
    const hh = r.h * 0.5 - 3;
    for (let lx = -r.w * 0.5; lx < r.w * 0.5 + 20; lx += 22) {
      const tx0 = clamp(lx, -hw, hw);
      const tx1 = clamp(lx + 11, -hw, hw);
      const bx1 = clamp(lx - 9, -hw, hw);
      const bx0 = clamp(lx - 20, -hw, hw);
      if (tx1 <= tx0 && bx1 <= bx0) continue;
      ctx.beginPath();
      ctx.moveTo(tx0, -hh);
      ctx.lineTo(tx1, -hh);
      ctx.lineTo(bx1, hh);
      ctx.lineTo(bx0, hh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    drawComicPanel(ctx, -36, -12, 72, 24, 7, isDrop ? '#dc2626' : '#0f172a', {
      lineWidth: 2.2,
      shadowDx: 1,
      shadowDy: 2,
    });
    drawComicText(ctx, isDrop ? '💥 SMASH!' : '⚠️ DROP ZONE', 0, 0, "900 10px 'Fredoka', 'Outfit', sans-serif", isDrop ? '#ffffff' : '#fef08a', {
      strokeWidth: 2.6,
    });

    let crateYOff = 0;
    let crateScale = 1.0;
    if (isWarn) {
      crateYOff = -92 + Math.sin(this.t * 6) * 6;
      crateScale = 0.88;
    } else if (isDrop) {
      crateYOff = 0;
      crateScale = 1.04;
    } else {
      const liftProgress = (r.animT - r.warnDur - r.smashDur) / r.liftDur;
      crateYOff = -92 * Math.min(1, liftProgress * 1.5);
      crateScale = 0.94;
    }

    const shadowScale = clamp(1 - (-crateYOff / 140) * 0.42, 0.55, 1.04);
    celShadow(ctx, 0, r.h * 0.46, r.w * 0.48 * shadowScale, 11 * shadowScale, isDrop ? 0.36 : 0.24);

    // Compact overhead crane beam + taut winch cables
    celBox(ctx, -r.w * 0.44, -142, r.w * 0.88, 10, 4, '#eab308', { lineWidth: 2.4 });
    for (const cx of [-r.w * 0.30, r.w * 0.30]) {
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 4.6;
      ctx.beginPath(); ctx.moveTo(cx, -132); ctx.lineTo(cx, crateYOff - 14); ctx.stroke();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.0;
      ctx.stroke();
    }

    if (isDrop) {
      for (let i = -r.w * 0.45; i <= r.w * 0.45; i += 24) {
        celCircle(ctx, i, r.h / 2 + 2, 8.5, '#fef08a', { lineWidth: 2.2, shine: false });
      }
    }

    ctx.save();
    ctx.translate(0, crateYOff);
    ctx.scale(crateScale, crateScale);
    drawSprite(ctx, 'b_crate_chest', 0, 8, r.w * 0.92, r.h * 0.92, {
      fallback: (cctx) => {
        celBox(cctx, -r.w * 0.44, -r.h * 0.44, r.w * 0.88, r.h * 0.88, 8, '#d97706', { depth: 5, lineWidth: 2.8 });
      },
    });
    drawComicText(ctx, isDrop ? '💥 −3 BEANS' : '⚠️ WATCH OUT', 0, -r.h * 0.52, "900 11px 'Fredoka', 'Outfit', sans-serif", isDrop ? '#fecdd3' : '#fde047', {
      strokeWidth: 3.4,
    });
    ctx.restore();
    ctx.restore();
  }

  /* ------------------------------------------------------------ 3. Rolling Rum Barrels (local MID=0) */
  drawRumCasks(r, y) {
    const ctx = this.ctx;
    for (const c of r.casks) {
      ctx.save();
      const hop = Math.abs(Math.sin(c.rot * 2)) * 3;
      ctx.translate(c.x - MID, y - hop);

      celShadow(ctx, 0, c.r + 4 + hop, c.r * 1.05, c.r * 0.38, 0.3);

      ctx.save();
      ctx.rotate(c.rot);
      celCircle(ctx, 0, 0, c.r, '#b45309', { lineWidth: 2.8, shade: '#78350f' });
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.arc(0, 0, c.r * 0.68, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      for (let a = 0; a < Math.PI; a += Math.PI / 3) {
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * c.r * 0.9, -Math.sin(a) * c.r * 0.9);
        ctx.lineTo(Math.cos(a) * c.r * 0.9, Math.sin(a) * c.r * 0.9);
        ctx.stroke();
      }
      celCircle(ctx, 0, 0, 5.5, '#78350f', { lineWidth: 2.0 });
      ctx.restore();

      drawComicText(ctx, '🪵 −2 BEANS', 0, -c.r - 15, "900 11.5px 'Fredoka', 'Outfit', sans-serif", '#fecdd3', {
        strokeWidth: 3.4,
      });
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ 4. Slapping Mersey Tentacle (local MID=0) */
  drawTentacleSlap(r, y) {
    const ctx = this.ctx;
    ctx.save();

    const trackMin = TRACK_L - MID;
    const trackMax = TRACK_R - MID;
    const isLeft = r.side === 'left';
    const edgeX = isLeft ? trackMin : trackMax;
    const isWarn = r.state === 'warn';
    const isSlam = r.state === 'slam';

    const zoneW = r.w;
    const zoneX = isLeft ? trackMin : trackMax - zoneW;
    ctx.save();
    ctx.globalAlpha = isSlam ? 0.55 : 0.35;
    celBox(ctx, zoneX, y - 24, zoneW, 48, 8, isSlam ? '#a21caf' : '#d946ef', { lineWidth: 2.4, gloss: false });
    ctx.restore();

    const reach = isSlam ? zoneW : isWarn ? zoneW * 0.36 : zoneW * 0.68;
    const tipX = isLeft ? trackMin + reach : trackMax - reach;
    const tentY = y - (isSlam ? 0 : 22 + Math.sin(this.t * 8) * 7);

    celShadow(ctx, (edgeX + tipX) / 2, y + 14, reach * 0.48, 10, 0.3);

    ctx.fillStyle = '#a855f7';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.0;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(edgeX, y - 23);
    ctx.bezierCurveTo((edgeX + tipX) / 2, tentY - 28, tipX, tentY - 18, tipX + (isLeft ? 15 : -15), tentY);
    ctx.bezierCurveTo(tipX, tentY + 18, (edgeX + tipX) / 2, tentY + 24, edgeX, y + 23);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (let i = 1; i <= 5; i++) {
      const frac = i / 6;
      const cupX = edgeX + (tipX - edgeX) * frac;
      const cupY = tentY + Math.sin(frac * Math.PI) * (isLeft ? 6 : -6);
      celCircle(ctx, cupX, cupY, 6.2 - frac * 1.8, '#fde047', { lineWidth: 2.0 });
    }

    const badgeX = isLeft ? trackMin + zoneW * 0.5 : trackMax - zoneW * 0.5;
    drawComicText(ctx, isSlam ? '🐙 SLAM! −2' : '⚠️ TENTACLE!', badgeX, y - 36, "900 11.5px 'Fredoka', 'Outfit', sans-serif", isSlam ? '#fecdd3' : '#fde047', {
      strokeWidth: 3.4,
    });
    ctx.restore();
  }

  /* ------------------------------------------------------------ 5. Rotating Dock Turnstile (local MID=0) */
  drawTurnstile(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x - MID, y);

    celShadow(ctx, 0, 5, r.armLen * 0.9, r.armLen * 0.82, 0.24);

    for (let i = 0; i < 3; i++) {
      const armAng = r.angle + (i * TAU) / 3;
      ctx.save();
      ctx.rotate(armAng);
      celBox(ctx, 14, -8, r.armLen - 14, 16, 7, '#f8fafc', { lineWidth: 2.6, gloss: false });
      ctx.fillStyle = '#ef4444';
      for (let sx = 24; sx < r.armLen - 12; sx += 24) {
        ctx.fillRect(sx, -6, 11, 12);
      }
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.roundRect(14, -8, r.armLen - 14, 16, 7); ctx.stroke();
      celCircle(ctx, r.armLen, 0, 9.5, '#334155', { lineWidth: 2.4 });
      ctx.restore();
    }

    const openAng = r.angle + TAU / 6;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3.2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r.armLen * 0.7, openAng - 0.4, openAng + 0.4);
    ctx.stroke();
    ctx.setLineDash([]);

    celCircle(ctx, 0, 0, 21, '#f59e0b', { lineWidth: 2.8, shade: '#b45309' });
    celCircle(ctx, 0, 0, 10, '#78350f', { lineWidth: 2.2, shine: false });

    drawComicText(ctx, '🔄 −2 BEANS', 0, -r.armLen - 12, "900 11.5px 'Fredoka', 'Outfit', sans-serif", '#fecdd3', {
      strokeWidth: 3.4,
    });
    ctx.restore();
  }

  /* ------------------------------------------------------------ 6. Seagull Dive & Cel Oil Slick (local MID=0) */
  drawSeagullSlick(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x - MID, y);

    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, r.w * 0.48, r.h * 0.46, 0.12, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.ellipse(-6, 3, r.w * 0.30, r.h * 0.25, -0.2, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r.w * 0.26, -8); ctx.lineTo(r.w * 0.22, -4);
    ctx.stroke();

    drawComicText(ctx, '⚠️ OIL SLICK −1', 0, 2, "900 10.5px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
      strokeWidth: 3.2,
    });

    for (const g of r.gulls) {
      ctx.save();
      ctx.translate(g.offX, g.offY);
      const wingFlap = Math.sin(g.flap) * 11;
      celShadow(ctx, 0, 32, 10, 4, 0.18);

      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-4, 0); ctx.lineTo(-2, -14 - wingFlap); ctx.lineTo(6, -6); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, 0); ctx.lineTo(-2, 14 + wingFlap); ctx.lineTo(6, 6); ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, 0, 0, TAU);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(9, -2.5); ctx.lineTo(17, 0); ctx.lineTo(9, 2.5); ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath(); ctx.arc(5, -1, 1.4, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ Legacy Compatibility Hazards (local MID=0) */
  drawSweeper(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(0, y);
    celCircle(ctx, 0, 0, 17, '#475569', { lineWidth: 2.6 });
    ctx.rotate(r.angle);
    celBox(ctx, -r.beamLen / 2, -10, r.beamLen, 20, 6, '#92400e', { depth: 3, lineWidth: 2.6 });
    celCircle(ctx, r.gapDist - r.beamLen / 2, 0, 13, '#22c55e', { lineWidth: 2.4 });
    ctx.restore();
  }

  drawGang(r, y) {
    const ctx = this.ctx;
    ctx.save();
    if (r.done) ctx.globalAlpha = 0.25;
    this.drawLivingCrowd(r.x - MID, y, Math.min(r.n, 60), '#ef4444', -1);
    drawComicText(ctx, `⚔️ ${fmt(r.n)} GANG`, r.x - MID, y - r.r * 0.6 - 22, "900 18px 'Fredoka', 'Outfit', sans-serif", '#fecdd3', {
      strokeWidth: 4.0,
    });
    ctx.restore();
  }

  drawDrawbridge(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x - MID, y);
    celBox(ctx, -r.w / 2, -40, r.w, 80, 10, '#92400e', { depth: 4, lineWidth: 2.8 });
    drawComicText(ctx, '⚓ DRAWBRIDGE', 0, 0, "900 13px 'Fredoka', 'Outfit', sans-serif", '#fef08a', { strokeWidth: 3.2 });
    ctx.restore();
  }

  drawTnt(r, y) {
    const ctx = this.ctx;
    for (const b of r.barrels) {
      ctx.save();
      ctx.translate(b.x - MID, y);
      celShadow(ctx, 0, b.r * 1.15, b.r * 1.1, b.r * 0.4, 0.3);
      drawSprite(ctx, 'b_tnt_barrel', 0, 0, b.r * 2.1, b.r * 2.4, {
        fallback: (tctx) => {
          celBox(tctx, -b.r, -b.r * 1.1, b.r * 2, b.r * 2.2, 8, '#dc2626', { depth: 3, lineWidth: 2.6 });
          drawComicText(tctx, 'TNT', 0, 2, "900 13px 'Fredoka', 'Outfit', sans-serif", '#ffffff', { strokeWidth: 3.0 });
        },
      });
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ Powerup / Cannon & Gold Sovereigns (local MID=0) */
  drawPowerup(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x - MID, y);
    const isCannon = r.type === 'cannon';
    drawSunburst(ctx, 0, 0, 38, this.t * 3, 8, 0.35, false);
    drawComicPanel(ctx, -r.w / 2 - 14, -r.h / 2, r.w + 28, r.h, 12, isCannon ? '#f59e0b' : '#10b981', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawComicText(
      ctx,
      isCannon ? '🚀 +3 BEANS' : '⚡ NITRO RUSH',
      0,
      1,
      "900 14.5px 'Fredoka', 'Outfit', sans-serif",
      '#ffffff',
      { strokeWidth: 3.6 },
    );
    ctx.restore();
  }

  drawBoulder(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x - MID, y);
    celShadow(ctx, 0, r.r + 3, r.r, r.r * 0.36, 0.28);
    drawSprite(ctx, 'boulder_rock', 0, 0, r.r * 2.1, r.r * 2.1, {
      rot: r.rot,
      fallback: (bctx) => {
        celCircle(bctx, 0, 0, r.r, '#94a3b8', { lineWidth: 2.8, shade: '#475569' });
      },
    });
    ctx.restore();
  }

  drawCoins(r, y) {
    const ctx = this.ctx;
    for (const c of r.coins) {
      if (c.collected) continue;
      ctx.save();
      ctx.translate(c.x - MID, y + c.yOff);
      celShadow(ctx, 0, 14, 10, 3.8, 0.28);
      celCircle(ctx, 0, 0, 12.5, '#facc15', { lineWidth: 2.5, shade: '#ca8a04' });
      drawComicText(ctx, '£', 0, 1, "900 12px 'Fredoka', 'Outfit', sans-serif", '#78350f', {
        stroke: '#fef08a',
        strokeWidth: 0,
      });
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ Milestone Bosses (Weebl Flash Titans!) */
  drawBoss(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x - MID, y);

    celShadow(ctx, 0, 68, 64, 18, 0.34);

    for (const sw of r.shockwaves) {
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, sw.r, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (r.type === 'captain') {
      this.drawPirateCaptainCrump(r, ctx);
    } else if (r.type === 'kraken') {
      this.drawMerseyKrakenMecha(r, ctx);
    } else {
      this.drawRoyalDockColossus(r, ctx);
    }

    this.drawBossHealthBar(r, ctx);
    ctx.restore();
  }

  /* 1. PIRATE CAPTAIN CRUMP (Authentic Weebl Flash Pirate Bean Boss) */
  drawPirateCaptainCrump(r, ctx) {
    const bob = Math.sin(this.t * 7) * 4;
    const isAttacking = r.slamTimer > 0.9;
    const cutlassRot = isAttacking ? 0.9 : Math.sin(this.t * 5) * 0.25;

    // Peg leg & chunky naval boot
    celBox(ctx, -25, 34 + bob, 11, 32, 4, '#92400e', { depth: 3, lineWidth: 2.8 });
    celBox(ctx, 13, 34 + bob, 19, 32, 6, '#334155', { depth: 3, lineWidth: 2.8 });

    // Left Hook Arm & Right Cutlass Arm behind/around bean body
    ctx.save();
    ctx.translate(-44, 0 + bob);
    ctx.rotate(Math.sin(this.t * 6) * 0.22);
    celBox(ctx, -10, -2, 16, 22, 7, '#dc2626', { lineWidth: 2.8 });
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 8.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-2, 29, 12, 0.35, Math.PI * 1.5, false); ctx.stroke();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4.2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(44, -6 + bob);
    ctx.rotate(cutlassRot);
    celBox(ctx, -6, -2, 16, 22, 7, '#dc2626', { lineWidth: 2.8 });
    celCircle(ctx, 2, 20, 8, '#facc15', { lineWidth: 2.6 });
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.0;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(2, 20);
    ctx.quadraticCurveTo(25, -2, 34, -46);
    ctx.quadraticCurveTo(16, -35, 2, 20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Organic Weebl Pear-Bean Boss Body (no flat rectangles!)
    const traceBossBean = () => {
      ctx.beginPath();
      ctx.moveTo(-40, -34 + bob);
      ctx.bezierCurveTo(-36, -78 + bob, 36, -78 + bob, 40, -34 + bob);
      ctx.bezierCurveTo(48, 2, 46, 36 + bob, 22, 44 + bob);
      ctx.bezierCurveTo(8, 48 + bob, -8, 48 + bob, -22, 44 + bob);
      ctx.bezierCurveTo(-46, 36 + bob, -48, 2, -40, -34 + bob);
      ctx.closePath();
    };
    traceBossBean();
    ctx.fillStyle = '#fb7185';
    ctx.fill();

    // Clip Crimson Admiral Coat, Gold Belt, Dark Beard & Cel Shading strictly inside Pear-Bean silhouette!
    ctx.save();
    traceBossBean();
    ctx.clip();

    // Glossy left bean highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
    ctx.beginPath(); ctx.ellipse(-18, -48 + bob, 8, 16, 0.25, 0, TAU); ctx.fill();

    // Crimson Coat across lower two-thirds
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-52, -4 + bob, 104, 60);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-52, 28 + bob, 104, 24);
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(-52, -4 + bob); ctx.lineTo(52, -4 + bob); ctx.stroke();

    // White cravat V-collar
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(-14, -4 + bob); ctx.lineTo(0, 16 + bob); ctx.lineTo(14, -4 + bob); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Midnight pirate beard wrapping round chin
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-36, -16 + bob);
    ctx.quadraticCurveTo(0, 22 + bob, 36, -16 + bob);
    ctx.lineTo(38, 4 + bob);
    ctx.lineTo(-38, 4 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Brass sword belt & skull clasp
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-50, 20 + bob, 100, 12);
    ctx.restore();

    // Heavy #000000 Weebl silhouette ink contour
    traceBossBean();
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.6;
    ctx.stroke();

    // Gold buttons & Shoulder Epaulets
    for (const bx of [-16, 16]) {
      celCircle(ctx, bx, 10 + bob, 3.8, '#facc15', { lineWidth: 1.8, shine: false });
    }
    celBox(ctx, -13, 17 + bob, 26, 18, 5, '#facc15', { depth: 2, lineWidth: 2.2 });
    celBox(ctx, -50, -8 + bob, 16, 9, 4, '#facc15', { lineWidth: 2.2 });
    celBox(ctx, 34, -8 + bob, 16, 9, 4, '#facc15', { lineWidth: 2.2 });

    // Expressive Bulging Weebl Cyclops Eye + Eyepatch + Crooked Golden-Tooth Grin
    celCircle(ctx, 13, -34 + bob, 9.5, '#ffffff', { lineWidth: 2.8, shine: false });
    celCircle(ctx, 11, -33 + bob, 3.6, '#000000', { lineWidth: 0, shine: false });
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(12.2, -34.6 + bob, 1.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(4, -45 + bob); ctx.lineTo(24, -40 + bob); ctx.stroke();

    celCircle(ctx, -12, -34 + bob, 9.0, '#1e293b', { lineWidth: 2.8, shine: false });
    ctx.lineWidth = 3.0;
    ctx.beginPath(); ctx.moveTo(-36, -42 + bob); ctx.lineTo(6, -24 + bob); ctx.stroke();

    // Wide crooked grin with single gold tooth
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.roundRect(-14, -18 + bob, 28, 9, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, -17 + bob, 7, 7);

    // Oversized Pirate Tricorn Hat snugly gripping the bean crown
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(-54, -48 + bob);
    ctx.quadraticCurveTo(0, -64 + bob, 54, -48 + bob);
    ctx.lineTo(38, -86 + bob);
    ctx.quadraticCurveTo(0, -96 + bob, -38, -86 + bob);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(-48, -51 + bob); ctx.quadraticCurveTo(0, -63 + bob, 48, -51 + bob); ctx.stroke();
    ctx.font = "900 18px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('☠️', 0, -69 + bob);

    ctx.fillStyle = '#f43f5e';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(31, -92 + bob, 8, 17, 0.4, 0, TAU); ctx.fill(); ctx.stroke();
  }

  /* 2. MERSEY KRAKEN MECHA (Weebl Cartoon Twin-Eyed Steampunk Octopus!) */
  drawMerseyKrakenMecha(r, ctx) {
    const bob = Math.sin(this.t * 6) * 5;
    const limbs = [
      [-35, 10, -85, -20, -110 + Math.sin(this.t * 4) * 25, 30, -135, 5, 10],
      [-30, 25, -75, 45, -95 + Math.cos(this.t * 3.5) * 30, 85, -125, 60, 9],
      [35, 10, 85, -20, 110 + Math.cos(this.t * 4.2) * 25, 30, 135, 5, 10],
      [30, 25, 75, 45, 95 + Math.sin(this.t * 3.7) * 30, 85, 125, 60, 9],
    ];
    for (const [sx, sy, c1x, c1y, c2x, c2y, ex, ey, er] of limbs) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(sx, sy + bob);
      ctx.bezierCurveTo(c1x, c1y + bob, c2x, c2y + bob, ex, ey + bob);
      ctx.stroke();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 7.2;
      ctx.stroke();
      celCircle(ctx, ex, ey + bob, er, '#fde047', { lineWidth: 2.6 });
    }

    celBox(ctx, -32, -68 + bob, 14, 24, 4, '#d97706', { lineWidth: 2.6 });
    celBox(ctx, 18, -68 + bob, 14, 24, 4, '#d97706', { lineWidth: 2.6 });
    const s1 = (this.t * 30) % 20;
    const s2 = ((this.t + 0.5) * 30) % 20;
    celCircle(ctx, -25, -76 + bob - s1, 8.5 + s1 * 0.35, '#ffffff', { lineWidth: 2.2, shine: false });
    celCircle(ctx, 25, -76 + bob - s2, 8.5 + s2 * 0.35, '#ffffff', { lineWidth: 2.2, shine: false });

    // Bulbous Copper-Purple Kraken Dome
    celCircle(ctx, 0, bob, 50, '#a855f7', { lineWidth: 3.6, shade: '#6b21a8' });

    // Expressive Twin Bulging Comic Eyes & Angry Brows
    for (const side of [-1, 1]) {
      celCircle(ctx, side * 16, -8 + bob, 13, '#ffffff', { lineWidth: 2.8, shine: false });
      celCircle(ctx, side * 14, -7 + bob, 4.8, '#000000', { lineWidth: 0, shine: false });
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(side * 15.5, -9 + bob, 1.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(side * 28, -23 + bob);
      ctx.lineTo(side * 4, -17 + bob);
      ctx.stroke();
    }

    // Iron Tooth Grate Mouth
    celBox(ctx, -22, 16 + bob, 44, 15, 6, '#1e293b', { lineWidth: 2.6, gloss: false });
    ctx.fillStyle = '#facc15';
    for (let jx = -18; jx <= 14; jx += 8) ctx.fillRect(jx, 19 + bob, 4, 9);
  }

  /* 3. ROYAL ALBERT SUGAR COLOSSUS (Rounded Weebl Brick-Bean Golem) */
  drawRoyalDockColossus(r, ctx) {
    const bob = Math.sin(this.t * 5) * 3;
    ctx.save();
    ctx.translate(0, -78 + bob);
    ctx.rotate(this.t * 2.8);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.32)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 220, -0.35, 0.35); ctx.closePath(); ctx.fill();
    ctx.restore();

    celBox(ctx, -20, -60 + bob, 40, 8, 3, '#475569', { depth: 2, lineWidth: 2.4 });
    celBox(ctx, -13, -84 + bob, 26, 24, 4, '#f8fafc', { lineWidth: 2.6 });
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-11, -78 + bob, 22, 8);
    celCircle(ctx, 0, -88 + bob, 9.5, '#fef08a', { lineWidth: 2.4 });

    // Rounded Chubby Golem Bean Torso
    celBox(ctx, -50, -44 + bob, 100, 86, 36, '#b91c1c', { depth: 6, lineWidth: 3.4 });
    celBox(ctx, -20, -4 + bob, 40, 32, 9, '#1e293b', { depth: 2, lineWidth: 2.6 });
    celCircle(ctx, 0, 12 + bob, 13, '#f97316', { lineWidth: 2.2, shade: '#dc2626' });

    // Twin Big Glowing Comic Eyes
    for (const side of [-1, 1]) {
      celCircle(ctx, side * 16, -24 + bob, 9.5, '#fef08a', { lineWidth: 2.6, shine: false });
      celCircle(ctx, side * 14, -24 + bob, 3.6, '#dc2626', { lineWidth: 0, shine: false });
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(side * 28, -34 + bob); ctx.lineTo(side * 6, -30 + bob); ctx.stroke();
    }

    // Swinging Steel Crane Anchor Arm
    celBox(ctx, -72, -10 + bob, 24, 30, 10, '#b91c1c', { depth: 3, lineWidth: 2.8 });
    celBox(ctx, 48, -22 + bob, 22, 13, 4, '#facc15', { depth: 2, lineWidth: 2.4 });
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(59, -9 + bob); ctx.lineTo(59, 26 + bob); ctx.stroke();
    celCircle(ctx, 59, 32 + bob, 14, '#475569', { lineWidth: 2.8 });
  }

  /* Crisp #000-Inked Boss Health Bar cleanly positioned ABOVE Boss Crown */
  drawBossHealthBar(r, ctx) {
    const hpPct = clamp(r.hp / r.maxHp, 0, 1);
    const barW = 166;
    const barH = 18;
    const barY = -156;

    drawComicPanel(ctx, -barW / 2 - 4, barY - 4, barW + 8, barH + 8, 9, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 2.5,
    });

    ctx.fillStyle = '#334155';
    ctx.beginPath(); ctx.roundRect(-barW / 2, barY, barW, barH, 6); ctx.fill();
    if (hpPct > 0) {
      const fillCol = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillStyle = fillCol;
      ctx.beginPath(); ctx.roundRect(-barW / 2, barY, Math.max(10, barW * hpPct), barH, 6); ctx.fill();
    }
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath(); ctx.roundRect(-barW / 2, barY, barW, barH, 6); ctx.stroke();

    drawComicText(ctx, `HP: ${Math.max(0, Math.round(r.hp))} / ${r.maxHp}`, 0, barY + barH / 2, "900 10.5px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
      strokeWidth: 2.6,
    });
    drawComicText(ctx, `👑 ${r.title}`, 0, barY - 17, "900 16.5px 'Fredoka', 'Outfit', sans-serif", '#fde047', {
      strokeWidth: 4.2,
    });
  }

  /* ------------------------------------------------------------ Golden Perspective Victory Podium Stairs */
  renderVictoryStairs(ctx, W, H) {
    const steps = [
      { step: 1, mult: 1.2, color: '#fef08a' },
      { step: 2, mult: 1.5, color: '#fde047' },
      { step: 3, mult: 2.0, color: '#facc15' },
      { step: 4, mult: 3.0, color: '#fbbf24' },
      { step: 5, mult: 5.0, color: '#f59e0b' },
      { step: 6, mult: 10.0, color: '#ea580c' },
    ];

    ctx.save();
    drawSunburst(ctx, MID, 310, 260, this.t * 0.4, 12, 0.28, false);
    steps.forEach((s, i) => {
      const p = this.proj(MID, i * 165);
      ctx.save();
      ctx.translate(p.x, p.y - i * 26);
      ctx.scale(p.s, p.s);
      const sw = 240;
      drawComicPanel(ctx, -sw / 2, -22, sw, 42, 10, s.color, {
        lineWidth: 2.8,
        shadowDx: 2.5,
        shadowDy: 4,
      });
      drawComicText(ctx, `STEP ${s.step} · ×${s.mult}`, 0, -1, "900 20px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
        strokeWidth: 4.4,
      });
      ctx.restore();
    });
    ctx.restore();
  }

  /* ------------------------------------------------------------ HD Hero Captain & #000-Inked Pear-Bean Squad */
  drawLivingCrowd(cx, cy, n, customColor = null, flip = 1) {
    const ctx = this.ctx;
    const isPlayer = flip > 0;
    const isFast = (this.boostTimer > 0 || this.feverRush > 0) && isPlayer;
    const isSlip = this.slipTimer > 0 && isPlayer;
    const visN = Math.min(n, 48);

    for (let i = visN - 1; i >= 0; i--) {
      const a = i * 2.39996;
      const r = 8.8 * Math.sqrt(i + 0.75);
      const x = cx + Math.cos(a) * r;
      const bounce = Math.sin(this.t * 19 + i * 0.55) * 2.8;
      const y = cy + Math.sin(a) * r * 0.62 * flip + bounce;

      if (i === 0 && isPlayer) {
        const leaderX = cx;
        const leaderY = cy + bounce * 0.6;
        celShadow(ctx, leaderX, cy + 7, 15, 4.8, 0.34);

        if (isFast) {
          drawSunburst(ctx, leaderX, leaderY - 18, 34, this.t * 6, 8, 0.52, false);
        }

        const lean = isSlip ? Math.sin(this.t * 22) * 0.16 : Math.sin(this.t * 17) * 0.06;
        drawHeroCharacter(ctx, leaderX, leaderY + 8, 48, {
          view: 'rear',
          yaw: Math.PI - 0.16,
          state: isSlip ? 'hurt' : 'run',
          expr: isSlip ? 'panic' : 'focus',
          t: this.t * (isFast ? 18 : 13),
          lean,
          squashX: isFast ? 0.94 : 1.0,
          squashY: isFast ? 1.08 : 1.0,
        });

        if (isSlip) {
          ctx.fillStyle = '#38bdf8';
          ctx.strokeStyle = STYLE_TOKENS.ink;
          ctx.lineWidth = 1.6;
          for (const sx of [-19, 19]) {
            ctx.beginPath();
            ctx.moveTo(leaderX + sx, leaderY - 40);
            ctx.quadraticCurveTo(leaderX + sx + 4, leaderY - 34, leaderX + sx, leaderY - 31);
            ctx.quadraticCurveTo(leaderX + sx - 4, leaderY - 34, leaderX + sx, leaderY - 40);
            ctx.fill(); ctx.stroke();
          }
        }
        continue;
      }

      if (isPlayer && i <= 2 && n >= 12) {
        celShadow(ctx, x, y + 6, 9, 3.2, 0.25);
        drawSprite(ctx, 'hero_bean', x, y + 5, 22, 30, {
          rot: Math.sin(this.t * 14 + i) * 0.07,
          fallback: (sctx) => {
            this.drawMiniSquadBean(sctx, 0, 0, '#4ade80', '#15803d', i);
          },
        });
        continue;
      }

      const palette = customColor
        ? [customColor, '#b91c1c']
        : isFast
        ? ['#4ade80', '#15803d']
        : [
            ['#38bdf8', '#0369a1'],
            ['#f472b6', '#be185d'],
            ['#facc15', '#a16207'],
            ['#a855f7', '#6b21a8'],
          ][i % 4];

      celShadow(ctx, x, y + 6, 8, 2.8, 0.24);
      this.drawMiniSquadBean(ctx, x, y + 4, palette[0], palette[1], i);
    }
  }

  drawMiniSquadBean(ctx, x, y, color, shade, idx = 0) {
    // Cached 24x24 mini pear-bean stamp in real browsers; zero clip() per frame!
    if (!this._beanStamps) this._beanStamps = new Map();
    const key = `${color}|${shade}`;
    let stamp = this._beanStamps.get(key);
    const canStamp = typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined';

    if (!stamp && canStamp) {
      const c = document.createElement('canvas');
      const sctx = c.getContext?.('2d');
      if (sctx && typeof c.toDataURL === 'function') {
        c.width = 24;
        c.height = 24;
        sctx.translate(12, 21);
        sctx.lineJoin = 'round';
        sctx.lineCap = 'round';
        const tracePear = () => {
          sctx.beginPath();
          sctx.moveTo(-6.2, -10.5);
          sctx.bezierCurveTo(-5.5, -17.5, 5.5, -17.5, 6.2, -10.5);
          sctx.bezierCurveTo(8.0, -4.5, 7.6, -1.5, 4.4, -0.5);
          sctx.bezierCurveTo(1.5, 0.2, -1.5, 0.2, -4.4, -0.5);
          sctx.bezierCurveTo(-7.6, -1.5, -8.0, -4.5, -6.2, -10.5);
          sctx.closePath();
        };
        tracePear();
        sctx.fillStyle = color;
        sctx.fill();

        // Bake 2-tone right-flank cel shadow once at stamp creation (0 per-frame cost!)
        sctx.save();
        sctx.clip();
        sctx.fillStyle = shade;
        sctx.beginPath();
        sctx.ellipse(4.8, -5.5, 5.2, 10.5, 0.1, 0, TAU);
        sctx.fill();
        sctx.restore();

        tracePear();
        sctx.strokeStyle = STYLE_TOKENS.ink;
        sctx.lineWidth = 2.2;
        sctx.stroke();

        sctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
        sctx.beginPath(); sctx.ellipse(-2.6, -13, 2.1, 1.1, -0.35, 0, TAU); sctx.fill();

        for (const ex of [-2.4, 2.4]) {
          sctx.fillStyle = '#ffffff';
          sctx.beginPath(); sctx.arc(ex, -9.2, 2.4, 0, TAU); sctx.fill();
          sctx.fillStyle = STYLE_TOKENS.ink;
          sctx.beginPath(); sctx.arc(ex + 0.2, -9.0, 1.15, 0, TAU); sctx.fill();
        }
        sctx.strokeStyle = STYLE_TOKENS.ink;
        sctx.lineWidth = 1.4;
        sctx.beginPath(); sctx.arc(0, -5.5, 2.2, 0.2, Math.PI - 0.2); sctx.stroke();
        let img = null;
        if (typeof Image !== 'undefined') {
          img = new Image();
          img.decoding = 'async';
          img.src = c.toDataURL('image/png');
          img.decode?.().catch(() => {});
        }
        stamp = { canvas: c, img };
        this._beanStamps.set(key, stamp);
      }
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const step = Math.sin(this.t * 18 + idx * 1.1) * 1.4;
    ctx.fillStyle = shade;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 1.8;
    for (const [fx, fy] of [[-3.2, step], [3.2, -step]]) {
      ctx.beginPath(); ctx.ellipse(fx, fy - 0.5, 2.4, 1.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }

    const stampSrc =
      stamp?.img && stamp.img.complete && stamp.img.naturalWidth > 0
        ? stamp.img
        : stamp?.canvas;
    if (stampSrc && typeof ctx.drawImage === 'function') {
      ctx.drawImage(stampSrc, -12, -21, 24, 24);
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(-6.2, -10.5);
    ctx.bezierCurveTo(-5.5, -17.5, 5.5, -17.5, 6.2, -10.5);
    ctx.bezierCurveTo(8.0, -4.5, 7.6, -1.5, 4.4, -0.5);
    ctx.bezierCurveTo(1.5, 0.2, -1.5, 0.2, -4.4, -0.5);
    ctx.bezierCurveTo(-7.6, -1.5, -8.0, -4.5, -6.2, -10.5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.beginPath(); ctx.ellipse(-2.6, -13, 2.1, 1.1, -0.35, 0, TAU); ctx.fill();

    for (const ex of [-2.4, 2.4]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ex, -9.2, 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath(); ctx.arc(ex + 0.2, -9.0, 1.15, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, -5.5, 2.2, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------ Simplified 2-Card Comic HUD */
  renderHUD(ctx, W, H) {
    const curBoss = this.getUpcomingBoss();
    const shortBoss = curBoss
      ? (curBoss.type === 'captain' ? 'CAPTAIN' : curBoss.type === 'kraken' ? 'KRAKEN' : 'COLOSSUS')
      : `BOSS ${this.stage}`;
    const distToBoss = curBoss ? Math.max(0, Math.round((curBoss.d - this.dist) / 10)) : 0;
    const ready = this.count >= this.bossReq;

    const stageTotalDist = curBoss ? Math.max(1, curBoss.d - this.stageStartDist) : 2200;
    const stageProgress = clamp((this.dist - this.stageStartDist) / stageTotalDist, 0, 1);

    // 1. Top-Left Progress Pill (x=14, y=98, w=216, h=48)
    const px = 14;
    const py = 98;
    const pw = 216;
    const ph = 48;
    drawComicPanel(ctx, px, py, pw, ph, 12, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2.5,
      shadowDy: 3,
    });

    drawComicText(ctx, `⚓ STG ${this.stage} · ${shortBoss}`, px + 11, py + 15.5, "900 11.5px 'Fredoka', 'Outfit', sans-serif", '#38bdf8', {
      align: 'left',
      strokeWidth: 3.0,
    });
    drawComicText(ctx, distToBoss > 0 ? `${distToBoss}m` : 'CLASH!', px + pw - 11, py + 15.5, "900 11px 'Fredoka', 'Outfit', sans-serif", '#fde047', {
      align: 'right',
      strokeWidth: 2.8,
    });

    const barX = px + 11;
    const barY = py + 29;
    const barW = 108;
    const barH = 9;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4.5); ctx.fill();
    if (stageProgress > 0) {
      ctx.fillStyle = ready ? '#22c55e' : '#38bdf8';
      ctx.beginPath(); ctx.roundRect(barX, barY, Math.max(9, barW * stageProgress), barH, 4.5); ctx.fill();
    }
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4.5); ctx.stroke();

    drawComicText(
      ctx,
      ready ? 'READY!' : `NEED +${this.bossReq - Math.round(this.count)}`,
      px + pw - 11,
      py + 33.5,
      "900 10.5px 'Fredoka', 'Outfit', sans-serif",
      ready ? '#4ade80' : '#fbbf24',
      { align: 'right', strokeWidth: 2.8 },
    );

    // 2. Top-Right Compact Army / Status Pill cleanly below #prestigeBadge
    const rw = 122;
    const rh = 36;
    const rx = W - rw - 14;
    const ry = 104;
    const statusFill = this.boostTimer > 0 ? '#059669' : this.slipTimer > 0 ? '#0284c7' : ready ? '#166534' : '#7f1d1d';
    const statusText = this.boostTimer > 0
      ? '⚡ NITRO!'
      : this.slipTimer > 0
      ? '💨 SLIPPING!'
      : `${Math.round(this.count)}/${this.bossReq} BEANS`;

    drawComicPanel(ctx, rx, ry, rw, rh, 11, statusFill, {
      lineWidth: 2.8,
      shadowDx: 2.5,
      shadowDy: 3,
    });
    drawComicText(ctx, statusText, rx + rw * 0.5, ry + rh * 0.5 + 1, "900 11.5px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
      strokeWidth: 3.4,
    });
  }
}
