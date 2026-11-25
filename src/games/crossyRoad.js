import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import {
  STYLE_TOKENS,
  preloadWeeblAtlas,
  drawSprite,
  drawComicPanel,
  drawComicText as _rawDrawComicText,
  drawWeeblCelBean,
  drawHeroCharacter,
} from './weeblAtlas.js';

const TAU = Math.PI * 2;
const COLS = 9;
const TILE_W = 50; // 450 / 9 = 50 px
const ROW_H = 50;
const HALF_TILE = 25;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const rowCenterY = (r) => -(r * ROW_H + HALF_TILE);
const rowTopY = (r) => -(r + 1) * ROW_H;

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

export class CrossyRoad extends Game {
  static meta = {
    id: 'crossy-road',
    title: 'Crossy Hopper',
    icon: '🚗',
    hint: 'TAP or UP to hop forward · SWIPE/ARROWS to dodge traffic · RIDE logs across the canal!',
    baseLikes: 2180,
    isPrestige: false,
    parScore60s: 520,
    cue: 'HOP & DODGE TRAFFIC!',
    prestigeCue: 'FASTER TRAFFIC · QUICK SEAGULL!',
    scaling: {
      vehicleSpeedMult: { base: 1.0, rate: 0.16, cap: 1.55, mode: 'up',   label: 'Traffic Speed' },
      logSpeedMult:     { base: 1.0, rate: 0.14, cap: 1.35, mode: 'up',   label: 'River Speed' },
      idleLimit:        { base: 7.5, rate: 0.16, floor: 5.0, mode: 'down', label: 'Seagull Timer' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    preloadWeeblAtlas();
    this.distance = 0;
    this.maxDistance = 0;
    this.coins = 0;

    this.player = {
      col: 4,
      row: 0,
      x: 4 * TILE_W + HALF_TILE,
      y: rowCenterY(0),
      targetX: 4 * TILE_W + HALF_TILE,
      targetY: rowCenterY(0),
      startX: 4 * TILE_W + HALF_TILE,
      startY: rowCenterY(0),
      hopping: false,
      hopT: 0,
      hopDur: 0.13,
      dir: 0, // 0: North, 1: East, 2: South, 3: West
      dead: false,
      onLog: null,
    };

    this.cameraY = this.player.y - 560;
    this.targetCameraY = this.cameraY;

    this.idleTimer = 0;
    this.maxIdle = this.diff.idleLimit ?? 7.5;
    this.eagleSwooping = false;
    this.eagleY = this.cameraY - 200;
    this.eagleX = this.player.x;

    this.rows = new Map();
    this.generatedMaxRow = 0;

    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartT = 0;

    if (saved) {
      if (Number.isFinite(saved.maxDistance)) this.maxDistance = saved.maxDistance;
      if (Number.isFinite(saved.coins)) this.coins = saved.coins;
      this.grace = 1.5;
    }

    this.generateUpToRow(24);
  }

  serialize() {
    return {
      distance: this.distance,
      maxDistance: this.maxDistance,
      coins: this.coins,
      score: this.score,
    };
  }

  restoreLabel() {
    return `Distance ${this.maxDistance}m · ×${this.coins} coins · ${Math.round(this.score)} pts`;
  }

  /* ------------------------------------------------------------- Procedural World Generator */
  generateUpToRow(targetRow) {
    while (this.generatedMaxRow <= targetRow) {
      const r = this.generatedMaxRow;
      if (!this.rows.has(r)) {
        this.rows.set(r, this.createRow(r));
      }
      this.generatedMaxRow++;
    }
  }

  createRow(r) {
    if (r <= 2) {
      return {
        row: r,
        type: 'grass',
        obstacles: r === 0 ? [] : this.spawnGrassObstacles(r, 0.15),
        coins: [],
      };
    }

    const cycle = r % 16;
    let type = 'grass';
    if ((cycle >= 2 && cycle <= 4) || (cycle >= 11 && cycle <= 13)) {
      type = 'road';
    } else if (cycle >= 6 && cycle <= 8) {
      type = 'river';
    } else if (cycle === 9) {
      type = 'rail';
    }

    if (type === 'grass') {
      const obstacles = this.spawnGrassObstacles(r, 0.28);
      const coins = [];
      if (Math.random() < 0.35) {
        const freeCols = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((c) => !obstacles.includes(c));
        if (freeCols.length > 0) {
          coins.push({ col: freeCols[Math.floor(Math.random() * freeCols.length)], collected: false });
        }
      }
      return { row: r, type: 'grass', obstacles, coins };
    }

    if (type === 'road') {
      const dir = r % 2 === 0 ? 1 : -1;
      const spd = (95 + Math.min(180, r * 1.8 + Math.random() * 50)) * (this.diff.vehicleSpeedMult ?? 1);
      return { row: r, type: 'road', dir, spd, vehicles: this.spawnVehicles(r, dir, spd), coins: [] };
    }

    if (type === 'river') {
      const dir = r % 2 === 0 ? 1 : -1;
      const spd = (75 + Math.min(130, r * 1.2 + Math.random() * 40)) * (this.diff.logSpeedMult ?? 1);
      return { row: r, type: 'river', dir, spd, logs: this.spawnRiverLogs(r, dir, spd), coins: [] };
    }

    if (type === 'rail') {
      return {
        row: r,
        type: 'rail',
        trainActive: false,
        trainX: -800,
        trainDir: Math.random() < 0.5 ? 1 : -1,
        trainTimer: 2.2 + Math.random() * 2.5,
        warning: false,
        warningT: 0,
        coins: [],
      };
    }

    return { row: r, type: 'grass', obstacles: [], coins: [] };
  }

  spawnGrassObstacles(row, density) {
    const obs = [];
    for (let c = 0; c < COLS; c++) {
      if (row <= 3 && c === 4) continue;
      if (Math.random() < density) obs.push(c);
    }
    if (obs.length >= COLS - 1) obs.splice(0, 2);
    return obs;
  }

  spawnVehicles(row, dir, spd) {
    const vehicles = [];
    const carTypes = ['taxi', 'sportsCar', 'deliveryVan', 'doubleDecker'];
    const count = 2 + Math.floor(Math.random() * 2);
    const spacing = 450 / count;

    for (let i = 0; i < count; i++) {
      const kind = carTypes[Math.floor(Math.random() * carTypes.length)];
      let w = 56;
      let col = '#facc15';
      if (kind === 'sportsCar') { w = 50; col = '#06b6d4'; }
      else if (kind === 'deliveryVan') { w = 72; col = '#8b5cf6'; }
      else if (kind === 'doubleDecker') { w = 88; col = '#dc2626'; }

      const startX = i * spacing + (Math.random() - 0.5) * 40;
      vehicles.push({ x: startX, w, h: 36, kind, col });
    }
    return vehicles;
  }

  spawnRiverLogs(row, dir, spd) {
    const logs = [];
    const count = 3;
    const spacing = 450 / count;

    for (let i = 0; i < count; i++) {
      const isLily = i === 1 && Math.random() < 0.4;
      const w = isLily ? 52 : 88 + Math.floor(Math.random() * 42);
      const startX = i * spacing + (Math.random() - 0.5) * 20;
      logs.push({
        x: startX,
        w,
        h: 38,
        isLily,
        hasCoin: Math.random() < 0.35,
        coinCollected: false,
      });
    }
    return logs;
  }

  /* ------------------------------------------------------------- Update */
  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }

    this.time += dt;
    this.fx.update(dt);
    this.idleTimer += dt;

    if (this.time > 1.2) {
      const creepSpeed = 26 + Math.min(24, this.distance * 0.45);
      this.cameraY -= creepSpeed * dt;
    }

    const targetCam = this.player.y - 560;
    if (targetCam < this.cameraY) {
      this.cameraY += (targetCam - this.cameraY) * Math.min(1, dt * 7.5);
    }

    const playerScreenY = this.player.y - this.cameraY;

    if (playerScreenY > 670 || this.idleTimer > this.maxIdle - 1.8) {
      if ((this.time % 0.35) < dt) this.sounds.tick();
    }

    if ((playerScreenY >= 720 || this.idleTimer >= this.maxIdle) && !this.eagleSwooping) {
      this.triggerSeagullSwoop();
    }

    if (this.eagleSwooping) {
      this.eagleY += dt * 1400;
      if (this.eagleY >= this.player.y || playerScreenY >= 775) {
        this.die('Snatched by a Giant Seagull!');
        this.fx.burst(this.player.x, this.player.y, '#ffffff', 28, 220, 0.7, 5);
        this.fx.shake(14, 0.4);
        this.sounds.fail();
        this.haptics.heavy();
        return;
      }
    }

    this.updatePlayerHop(dt);
    this.generateUpToRow(this.player.row + 18);
    this.updateWorldLanes(dt);
    this.testCollisions(dt);

    const purgeRowBefore = Math.floor(-(this.cameraY + 1100) / ROW_H);
    for (const [rKey] of this.rows) {
      if (rKey < purgeRowBefore) this.rows.delete(rKey);
    }
  }

  /* ------------------------------------------------------------- Input & Controls */
  handleInput() {
    if (this.player.hopping || this.dead) return;

    const inp = this.input;
    const upPressed = inp.key('w', 'arrowup', ' ');
    const leftPressed = inp.key('a', 'arrowleft');
    const rightPressed = inp.key('d', 'arrowright');
    const downPressed = inp.key('s', 'arrowdown');

    if (upPressed && !this.prevUp) { this.hop(0, 1, 0); this.prevUp = true; return; }
    if (leftPressed && !this.prevLeft) { this.hop(-1, 0, 3); this.prevLeft = true; return; }
    if (rightPressed && !this.prevRight) { this.hop(1, 0, 1); this.prevRight = true; return; }
    if (downPressed && !this.prevDown) { this.hop(0, -1, 2); this.prevDown = true; return; }

    if (!upPressed) this.prevUp = false;
    if (!leftPressed) this.prevLeft = false;
    if (!rightPressed) this.prevRight = false;
    if (!downPressed) this.prevDown = false;

    if (inp.pressed) {
      this.touchStartX = inp.x;
      this.touchStartY = inp.y;
      this.touchMoved = false;
    }

    if (inp.down && !this.touchMoved) {
      const dx = inp.x - this.touchStartX;
      const dy = inp.y - this.touchStartY;
      if (Math.hypot(dx, dy) > 26) {
        this.touchMoved = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) this.hop(1, 0, 1);
          else this.hop(-1, 0, 3);
        } else {
          if (dy < 0) this.hop(0, 1, 0);
          else this.hop(0, -1, 2);
        }
        return;
      }
    }

    if (inp.released && !this.touchMoved) {
      this.hop(0, 1, 0);
    }
  }

  hop(dx, dy, dir) {
    if (this.player.hopping || this.dead) return;

    const p = this.player;
    p.col = clamp(Math.round((p.x - HALF_TILE) / TILE_W), 0, COLS - 1);

    const targetRow = Math.max(0, p.row + dy);
    const targetRowObj = this.rows.get(targetRow);
    const curRowObj = this.rows.get(p.row);

    let targetCol = p.col;
    let targetX = p.x;
    let targetLog = null;

    if (dy === 0) {
      if (curRowObj && curRowObj.type === 'river' && p.onLog) {
        targetX = clamp(p.x + dx * TILE_W, 25, 425);
        targetCol = clamp(Math.round((targetX - HALF_TILE) / TILE_W), 0, COLS - 1);
      } else {
        targetCol = clamp(p.col + dx, 0, COLS - 1);
        targetX = targetCol * TILE_W + HALF_TILE;
      }
    } else {
      if (targetRowObj && targetRowObj.type === 'river') {
        const hopDur = p.hopDur;
        let matchedLog = null;
        let bestDist = Infinity;

        for (const log of targetRowObj.logs) {
          const futureX = log.x + targetRowObj.dir * targetRowObj.spd * hopDur;
          const logCenter = futureX + log.w / 2;
          const dist = Math.abs(p.x - logCenter);
          if (p.x >= futureX - 24 && p.x <= futureX + log.w + 24) {
            if (dist < bestDist) {
              bestDist = dist;
              matchedLog = { log, futureX };
            }
          }
        }

        if (matchedLog) {
          targetLog = matchedLog.log;
          targetX = clamp(p.x, matchedLog.futureX + 16, matchedLog.futureX + matchedLog.log.w - 16);
          targetCol = clamp(Math.round((targetX - HALF_TILE) / TILE_W), 0, COLS - 1);
        } else {
          targetX = p.x;
          targetCol = clamp(Math.round((targetX - HALF_TILE) / TILE_W), 0, COLS - 1);
        }
      } else {
        targetCol = clamp(Math.round((p.x - HALF_TILE) / TILE_W) + dx, 0, COLS - 1);
        if (targetRowObj && targetRowObj.type === 'grass' && targetRowObj.obstacles.includes(targetCol)) {
          if (targetCol > 0 && !targetRowObj.obstacles.includes(targetCol - 1)) {
            targetCol -= 1;
          } else if (targetCol < COLS - 1 && !targetRowObj.obstacles.includes(targetCol + 1)) {
            targetCol += 1;
          } else {
            this.sounds.tick();
            this.haptics.light();
            return;
          }
        }
        targetX = targetCol * TILE_W + HALF_TILE;
      }
    }

    if (targetRowObj && targetRowObj.type === 'grass' && targetRowObj.obstacles.includes(targetCol)) {
      this.sounds.tick();
      this.haptics.light();
      return;
    }

    p.hopping = true;
    p.hopT = 0;
    p.dir = dir;
    p.startX = p.x;
    p.startY = p.y;
    p.col = targetCol;
    p.row = targetRow;
    p.targetX = targetX;
    p.targetY = rowCenterY(targetRow);
    p.targetLog = targetLog;
    p.targetRowObj = targetRowObj;
    p.onLog = null;

    if (targetRow > this.distance) {
      this.distance = targetRow;
      this.idleTimer = 0;
      if (this.distance > this.maxDistance) {
        this.maxDistance = this.distance;
        this.score += 10;
      }
    }

    this.sounds.drop();
    this.haptics.light();
  }

  updatePlayerHop(dt) {
    this.handleInput();

    const p = this.player;
    if (p.hopping) {
      if (p.targetLog && p.targetRowObj) {
        p.targetX += p.targetRowObj.dir * p.targetRowObj.spd * dt;
      }

      p.hopT += dt / p.hopDur;
      if (p.hopT >= 1) {
        p.hopT = 1;
        p.x = p.targetX;
        p.y = p.targetY;
        p.hopping = false;
        p.targetLog = null;
        p.targetRowObj = null;
        p.col = clamp(Math.round((p.x - HALF_TILE) / TILE_W), 0, COLS - 1);

        const rowObj = this.rows.get(p.row);
        if (rowObj && rowObj.coins) {
          const coin = rowObj.coins.find((c) => c.col === p.col && !c.collected);
          if (coin) {
            coin.collected = true;
            this.coins++;
            this.score += 25;
            this.fx.ring(p.x, p.y, '#facc15', 36, 0.35, 3);
            this.fx.text(p.x, p.y - 20, '+25', '#fde047', 18);
            this.sounds.like();
            this.haptics.medium();
          }
        }
      } else {
        p.x = p.startX + (p.targetX - p.startX) * p.hopT;
        p.y = p.startY + (p.targetY - p.startY) * p.hopT;
      }
    }
  }

  /* ------------------------------------------------------------- Traffic & River Simulation */
  updateWorldLanes(dt) {
    const minRow = Math.max(0, Math.floor(-(this.cameraY + 850) / ROW_H));
    const maxRow = Math.ceil(-this.cameraY / ROW_H) + 4;

    for (let r = minRow; r <= maxRow; r++) {
      const rowObj = this.rows.get(r);
      if (!rowObj) continue;

      if (rowObj.type === 'road') {
        for (const v of rowObj.vehicles) {
          v.x += rowObj.dir * rowObj.spd * dt;
          if (rowObj.dir === 1 && v.x > 450 + v.w) {
            v.x = -v.w - Math.random() * 60;
          } else if (rowObj.dir === -1 && v.x < -v.w) {
            v.x = 450 + v.w + Math.random() * 60;
          }
        }
      } else if (rowObj.type === 'river') {
        for (const log of rowObj.logs) {
          log.x += rowObj.dir * rowObj.spd * dt;
          if (rowObj.dir === 1 && log.x > 450 + log.w) {
            log.x = -log.w - 20;
          } else if (rowObj.dir === -1 && log.x < -log.w) {
            log.x = 450 + 20;
          }
        }
      } else if (rowObj.type === 'rail') {
        rowObj.trainTimer -= dt;
        if (rowObj.trainTimer <= 1.2 && rowObj.trainTimer > 0) {
          rowObj.warning = true;
          rowObj.warningT += dt;
          if (rowObj.warningT % 0.3 < dt) this.sounds.tick();
        } else if (rowObj.trainTimer <= 0 && !rowObj.trainActive) {
          rowObj.trainActive = true;
          rowObj.warning = false;
          rowObj.trainX = rowObj.trainDir === 1 ? -600 : 1050;
          this.sounds.laser();
          this.fx.shake(7, 0.4);
        }

        if (rowObj.trainActive) {
          rowObj.trainX += rowObj.trainDir * 1350 * dt;
          if ((rowObj.trainDir === 1 && rowObj.trainX > 1050) || (rowObj.trainDir === -1 && rowObj.trainX < -600)) {
            rowObj.trainActive = false;
            rowObj.trainTimer = 3.5 + Math.random() * 3.5;
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------- Collision Tests */
  testCollisions(dt) {
    const p = this.player;
    const curRow = this.rows.get(p.row);
    if (!curRow) return;

    const rowCenter = rowCenterY(p.row);
    const inRowZone = Math.abs(p.y - rowCenter) < 22;

    if (curRow.type === 'river' && inRowZone) {
      let standingOn = null;
      for (const log of curRow.logs) {
        if (p.x >= log.x - 20 && p.x <= log.x + log.w + 20) {
          standingOn = log;
          break;
        }
      }

      if (standingOn) {
        p.onLog = standingOn;
        const drift = curRow.dir * curRow.spd * dt;
        p.x += drift;
        p.targetX += drift;
        p.startX += drift;
        p.col = clamp(Math.round((p.x - HALF_TILE) / TILE_W), 0, COLS - 1);

        if (standingOn.hasCoin && !standingOn.coinCollected) {
          standingOn.coinCollected = true;
          this.coins++;
          this.score += 35;
          this.fx.ring(p.x, p.y, '#facc15', 36, 0.35, 3);
          this.fx.text(p.x, p.y - 20, '+35', '#fde047', 18);
          this.sounds.like();
          this.haptics.medium();
        }

        if (p.x < -18 || p.x > 468) {
          this.die('Swept away down the Mersey!');
          this.sounds.gulp();
          return;
        }
      } else if (!p.hopping) {
        this.die('Sunk into the Mersey Canal!');
        this.fx.ring(p.x, p.y, '#38bdf8', 60, 0.65, 4);
        this.fx.burst(p.x, p.y, '#38bdf8', 24, 180, 0.7, 4);
        this.sounds.gulp();
        this.haptics.heavy();
        return;
      }
    }

    if (curRow.type === 'road' && inRowZone) {
      for (const v of curRow.vehicles) {
        const carLeft = v.x;
        const carRight = v.x + v.w;
        const pRadius = 14;
        if (p.x + pRadius > carLeft && p.x - pRadius < carRight) {
          this.die(`Run over by a ${v.kind.replace(/([A-Z])/g, ' $1').toLowerCase()}!`);
          this.fx.burst(p.x, p.y, '#ef4444', 36, 260, 0.85, 5);
          this.fx.shake(16, 0.45);
          this.sounds.hit();
          this.haptics.heavy();
          return;
        }
      }
    }

    if (curRow.type === 'rail' && curRow.trainActive && inRowZone) {
      const trainLeft = curRow.trainDir === 1 ? curRow.trainX : curRow.trainX - 520;
      const trainRight = curRow.trainDir === 1 ? curRow.trainX + 520 : curRow.trainX;
      if (p.x > trainLeft && p.x < trainRight) {
        this.die('Obliterated by the Mersey Express Train!');
        this.fx.burst(p.x, p.y, '#dc2626', 44, 320, 0.95, 6);
        this.fx.shake(20, 0.6);
        this.sounds.hit();
        this.haptics.heavy();
        return;
      }
    }
  }

  triggerSeagullSwoop() {
    this.eagleSwooping = true;
    this.eagleY = this.cameraY - 180;
    this.eagleX = this.player.x;
    this.sounds.whoosh();
  }

  /* ------------------------------------------------------------- Render Engine (Painter Back-to-Front!) */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(0, -this.cameraY);

    const minRow = Math.floor(-(this.cameraY + 850) / ROW_H) - 2;
    const maxRow = Math.ceil(-this.cameraY / ROW_H) + 2;

    // 1. Flat Ground Buffer Behind Start (r < 0)
    for (let r = minRow; r < 0; r++) {
      const y = rowTopY(r);
      const isAlt = Math.abs(r) % 2 === 0;
      ctx.fillStyle = isAlt ? '#22c55e' : '#4ade80';
      ctx.fillRect(0, y, 450, ROW_H);
      ctx.fillStyle = isAlt ? '#16a34a' : '#22c55e';
      ctx.fillRect(60, y + 12, 16, 4);
      ctx.fillRect(280, y + 26, 16, 4);
    }

    // 2. All Flat Ground Terrain Strips & River Water Logs
    for (let r = maxRow; r >= Math.max(0, minRow); r--) {
      const rowObj = this.rows.get(r);
      if (!rowObj) continue;
      this.drawRowTerrain(ctx, rowObj);
      if (rowObj.type === 'river') {
        this.drawRiverContent(ctx, rowObj);
      }
    }

    // 3. Elevated 2.5D Props (Sorted Far -> Near so closer buses/trees/Hero Bean overlap properly!)
    for (let r = maxRow; r >= Math.max(0, minRow); r--) {
      const rowObj = this.rows.get(r);
      if (rowObj) {
        if (rowObj.type === 'road') this.drawRoadVehicles(ctx, rowObj);
        else if (rowObj.type === 'rail') this.drawRailroad(ctx, rowObj);
        else if (rowObj.type === 'grass') this.drawGrassProps(ctx, rowObj);
      }
      if (r === this.player.row) {
        this.drawPlayer(ctx);
      }
    }

    // 4. Seagull Threat & FX
    this.drawSeagullThreat(ctx);
    this.fx.render(ctx, 1.0);

    ctx.restore();

    // 5. Crisp 2-Pill Comic HUD
    this.drawHUD(ctx, W, H);
  }

  /* ------------------------------------------------------------- Crisp Inked Flat-Cel Lanes (0 Gradients) */
  drawRowTerrain(ctx, rowObj) {
    const y = rowTopY(rowObj.row);

    if (rowObj.type === 'grass') {
      const isAlt = rowObj.row % 2 === 0;
      ctx.fillStyle = isAlt ? '#22c55e' : '#4ade80';
      ctx.fillRect(0, y, 450, ROW_H);

      // Subtle grass blades & cel seam
      ctx.fillStyle = isAlt ? '#16a34a' : '#22c55e';
      ctx.fillRect(0, y + ROW_H - 3, 450, 3);
      ctx.fillRect(62, y + 12, 14, 4);
      ctx.fillRect(195, y + 26, 14, 4);
      ctx.fillRect(342, y + 15, 14, 4);
    } else if (rowObj.type === 'road') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, y, 450, ROW_H);

      // Inked asphalt borders
      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.fillRect(0, y, 450, 2.5);
      ctx.fillRect(0, y + ROW_H - 2.5, 450, 2.5);
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, y + 2.5, 450, 2.5);

      // Crisp lane dashes (zero clip)
      ctx.fillStyle = '#e2e8f0';
      for (let dx = 12; dx < 450; dx += 40) {
        ctx.fillRect(dx, y + ROW_H / 2 - 2, 18, 4);
      }
    } else if (rowObj.type === 'river') {
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(0, y, 450, ROW_H);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, y, 450, 8);
      ctx.fillRect(0, y + ROW_H - 6, 450, 6);

      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.fillRect(0, y, 450, 2.5);
      ctx.fillRect(0, y + ROW_H - 2.5, 450, 2.5);

      // Inked sky-white wave glints
      ctx.fillStyle = '#e0f2fe';
      const rippleOffset = (this.time * rowObj.spd * 0.4 * rowObj.dir) % 80;
      for (let rx = -40; rx < 490; rx += 70) {
        ctx.beginPath();
        ctx.roundRect(rx + rippleOffset, y + 14, 22, 3.5, 1.8);
        ctx.roundRect(rx + rippleOffset + 26, y + 32, 15, 3, 1.5);
        ctx.fill();
      }
    } else if (rowObj.type === 'rail') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, y, 450, ROW_H);
      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.fillRect(0, y, 450, 2.5);
      ctx.fillRect(0, y + ROW_H - 2.5, 450, 2.5);

      // Batched #000-inked oak railway sleepers
      ctx.fillStyle = '#92400e';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      for (let tx = 10; tx < 450; tx += 28) {
        ctx.beginPath();
        ctx.roundRect(tx, y + 7, 12, ROW_H - 14, 3);
        ctx.fill();
        ctx.stroke();
      }

      // Chunky inked steel rails
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 6.0;
      ctx.beginPath();
      ctx.moveTo(0, y + 14.5); ctx.lineTo(450, y + 14.5);
      ctx.moveTo(0, y + ROW_H - 13.5); ctx.lineTo(450, y + ROW_H - 13.5);
      ctx.stroke();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, y + 14); ctx.lineTo(450, y + 14);
      ctx.moveTo(0, y + ROW_H - 14); ctx.lineTo(450, y + ROW_H - 14);
      ctx.stroke();
    }
  }

  drawRiverContent(ctx, rowObj) {
    const topY = rowTopY(rowObj.row);
    const cy = rowCenterY(rowObj.row);

    for (const log of rowObj.logs) {
      if (log.isLily) {
        const lcx = log.x + log.w / 2;
        const lr = log.w / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(lcx + 1, cy + 5, lr * 0.92, lr * 0.72, 0, 0, TAU);
        ctx.fill();

        // Inked 2-tone cel lily pad
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(lcx, cy, lr, 0.22, TAU - 0.22);
        ctx.lineTo(lcx, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(lcx - 3, cy - 3, lr * 0.52, Math.PI * 0.9, Math.PI * 1.8);
        ctx.fill();

        // Inked pink lotus flower
        ctx.fillStyle = '#f472b6';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 1.6;
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * TAU;
          ctx.beginPath();
          ctx.arc(lcx + Math.cos(pa) * 5, cy + Math.sin(pa) * 5, 4.2, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(lcx, cy, 4.2, 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else {
        // Inked Wooden Floating Log
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(log.x + log.w / 2, topY + ROW_H - 4, log.w * 0.48, 7.5, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = STYLE_TOKENS.ink;
        ctx.beginPath();
        ctx.roundRect(log.x, topY + 10, log.w, ROW_H - 14, 11);
        ctx.fill();

        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.roundRect(log.x, topY + 7, log.w, ROW_H - 14, 11);
        ctx.fill();

        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.roundRect(log.x + 3, topY + 9, log.w - 6, 9, 5);
        ctx.fill();

        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.roundRect(log.x, topY + 7, log.w, ROW_H - 14, 11);
        ctx.stroke();

        // Cut end-grain cream circle + bark ticks
        ctx.fillStyle = '#fde68a';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(log.x + 7, cy, 4.5, (ROW_H - 20) * 0.4, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(log.x + 17, topY + 19); ctx.lineTo(log.x + log.w - 14, topY + 19);
        ctx.moveTo(log.x + 24, topY + 28); ctx.lineTo(log.x + log.w - 20, topY + 28);
        ctx.stroke();
      }

      if (log.hasCoin && !log.coinCollected) {
        this.drawCoin(ctx, log.x + log.w / 2, cy);
      }
    }
  }

  drawRoadVehicles(ctx, rowObj) {
    const topY = rowTopY(rowObj.row);
    const isRight = rowObj.dir === 1;

    for (const v of rowObj.vehicles) {
      const vy = topY + (ROW_H - v.h) / 2;
      const cx = v.x + v.w * 0.5;
      const cy = vy + v.h * 0.5;

      // Grounding shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
      ctx.beginPath();
      ctx.ellipse(cx, vy + v.h + 2, v.w * 0.5, v.h * 0.28, 0, 0, TAU);
      ctx.fill();

      // Warm Headlight Beams (aligned cleanly to front grill height)
      const isIsoSprite = v.kind === 'taxi' || v.kind === 'doubleDecker';
      const hx = isRight ? v.x + v.w - 3 : v.x + 3;
      const coneDir = isRight ? 1 : -1;
      const beamTop = isIsoSprite ? vy + v.h * 0.42 : vy + 7;
      const beamBot = isIsoSprite ? vy + v.h + 1 : vy + v.h - 7;
      ctx.fillStyle = 'rgba(254, 240, 138, 0.30)';
      ctx.beginPath();
      ctx.moveTo(hx, beamTop);
      ctx.lineTo(hx + coneDir * 24, beamTop - 5);
      ctx.lineTo(hx + coneDir * 24, beamBot + 5);
      ctx.lineTo(hx, beamBot);
      ctx.closePath();
      ctx.fill();

      if (v.kind === 'taxi') {
        // Real HD Weebl Yellow Cab (source faces bottom-left -> flipX when moving right)
        drawSprite(ctx, 'city_yellow_taxi', cx, cy - 1, 62, 50, {
          flipX: isRight,
          fallback: () => this.drawInkedCelCar(ctx, v, vy, isRight),
        });
      } else if (v.kind === 'doubleDecker') {
        // Real HD Weebl Red Double Decker Bus (source faces bottom-left -> flipX when moving right)
        drawSprite(ctx, 'city_double_decker', cx, cy - 1, 82, 72, {
          flipX: isRight,
          fallback: () => this.drawInkedCelCar(ctx, v, vy, isRight),
        });
      } else {
        this.drawInkedCelCar(ctx, v, vy, isRight);
      }
    }
  }

  drawInkedCelCar(ctx, v, vy, isRight) {
    // Inked black rubber tires
    ctx.fillStyle = '#0f172a';
    for (const wx of [v.x + 7, v.x + v.w - 17]) {
      ctx.beginPath();
      ctx.roundRect(wx, vy - 3, 10, 5, 2.5);
      ctx.roundRect(wx, vy + v.h - 2, 10, 5, 2.5);
      ctx.fill();
    }

    // Extruded bottom #000 shadow + cel chassis
    ctx.fillStyle = STYLE_TOKENS.ink;
    ctx.beginPath();
    ctx.roundRect(v.x, vy + 4, v.w, v.h, 8);
    ctx.fill();

    ctx.fillStyle = v.col;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(v.x, vy, v.w, v.h, 8);
    ctx.fill();
    ctx.stroke();

    if (v.kind === 'deliveryVan') {
      const cabX = isRight ? v.x + v.w - 20 : v.x + 4;
      const boxX = isRight ? v.x + 4 : v.x + 22;
      ctx.fillStyle = '#f8fafc';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(boxX, vy + 4, v.w - 26, v.h - 8, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(cabX, vy + 6, 14, v.h - 12, 4);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.fillRect(v.x + 5, vy + v.h * 0.42, v.w - 10, 5);

      ctx.fillStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(v.x + 12, vy + 6, v.w - 24, v.h - 12, 5);
      ctx.fill();
      ctx.stroke();
    }

    // Inked headlights & taillights
    const hx = isRight ? v.x + v.w - 3 : v.x + 3;
    const tx = isRight ? v.x + 3 : v.x + v.w - 3;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 1.6;
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(hx, vy + 8, 3.2, 0, TAU);
    ctx.arc(hx, vy + v.h - 8, 3.2, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(tx, vy + 8, 2.8, 0, TAU);
    ctx.arc(tx, vy + v.h - 8, 2.8, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  drawRailroad(ctx, rowObj) {
    const topY = rowTopY(rowObj.row);

    // Inked Crossing Signal Post
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(17, topY + 4, 7, ROW_H - 8, 3);
    ctx.fill();
    ctx.stroke();

    if (rowObj.warning) {
      const flash = Math.sin(this.time * 16) > 0;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      ctx.fillStyle = flash ? '#ef4444' : '#475569';
      ctx.beginPath(); ctx.arc(13, topY + 14, 5.2, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = !flash ? '#ef4444' : '#475569';
      ctx.beginPath(); ctx.arc(29, topY + 14, 5.2, 0, TAU); ctx.fill(); ctx.stroke();
    }

    // Inked Mersey Express Train
    if (rowObj.trainActive) {
      const tx = rowObj.trainX;
      const tw = 460;
      const th = 40;
      const ty = topY + (ROW_H - th) / 2;

      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath();
      ctx.roundRect(tx, ty + 4, tw, th, 10);
      ctx.fill();

      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.fillRect(tx + 6, ty + 16, tw - 12, 7);

      ctx.fillStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      for (let wx = tx + 28; wx < tx + tw - 28; wx += 36) {
        ctx.beginPath();
        ctx.roundRect(wx, ty + 6, 22, 12, 4);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  drawGrassProps(ctx, rowObj) {
    const cy = rowCenterY(rowObj.row);

    for (const c of rowObj.coins) {
      if (!c.collected) {
        this.drawCoin(ctx, c.col * TILE_W + HALF_TILE, cy);
      }
    }

    // #000-Inked 2-Tone Cel Weebl Trees
    for (const col of rowObj.obstacles) {
      const ox = col * TILE_W + HALF_TILE;
      const oy = cy;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
      ctx.beginPath();
      ctx.ellipse(ox, oy + 14, 17, 7, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#92400e';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(ox - 6, oy - 2, 12, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(ox, oy - 7, 17, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(ox - 1, oy - 14, 13, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(ox - 5, oy - 18, 5, 3, -0.4, 0, TAU);
      ctx.fill();
    }
  }

  drawCoin(ctx, x, y) {
    ctx.save();
    const bob = Math.sin(this.time * 6) * 3;
    const squish = Math.max(0.26, Math.abs(Math.cos(this.time * 5)));

    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + 11, 8, 3, 0, 0, TAU);
    ctx.fill();

    ctx.translate(x, y + bob);
    ctx.scale(squish, 1);

    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.ellipse(-3, -3.5, 4, 2.2, -0.5, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.lineTo(0, 4.5);
    ctx.stroke();
    ctx.restore();
  }

  drawPlayer(ctx) {
    const p = this.player;
    const arcFrac = p.hopping ? Math.sin(p.hopT * Math.PI) : 0;
    const hopArc = arcFrac * 20;
    const py = p.y - hopArc;

    // Grounding shadow shrinking during hop arc
    const shadowScale = 1 - arcFrac * 0.38;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 13, 15 * shadowScale, 6.5 * shadowScale, 0, 0, TAU);
    ctx.fill();

    // Pristine HD 3D Crowned Hero Bean hopping & leaping cleanly across all 4 headings
    const sq = p.hopping ? clamp(1.24 - arcFrac * 0.36, 0.78, 1.28) : 1.0;
    const viewByDir = p.dir === 0 ? 'rear' : p.dir === 2 ? 'front' : 'side';
    const faceDir = p.dir === 3 ? -1 : 1;
    drawHeroCharacter(ctx, p.x, py + 15, 42, {
      view: this.dead ? 'front' : viewByDir,
      dir: faceDir,
      state: this.dead ? 'dead' : p.hopping ? 'hop_leap' : 'stand_alert',
      expr: this.dead ? 'dizzy' : this.eagleSwooping ? 'panic' : p.hopping ? 'focus' : 'happy',
      t: (this.time || 0) * 4,
      squashX: 2 - sq,
      squashY: sq,
    });
  }

  drawSeagullThreat(ctx) {
    const p = this.player;
    const playerScreenY = p.y - this.cameraY;

    if (playerScreenY > 640 || this.idleTimer > this.maxIdle - 2.5) {
      const dangerRatio = clamp(Math.max((playerScreenY - 640) / 80, (this.idleTimer - (this.maxIdle - 2.5)) / 2.5), 0, 1);
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${0.24 + dangerRatio * 0.34})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 12, 30 * dangerRatio, 13 * dangerRatio, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (this.eagleSwooping) {
      const ex = this.eagleX;
      const ey = this.eagleY;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(ex, ey + 34, 34, 10, 0, 0, TAU);
      ctx.fill();

      // Heavy #000-Inked Gull Wings
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3.0;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - 65, ey - 14);
      ctx.quadraticCurveTo(ex - 30, ey - 24, ex, ey + 4);
      ctx.quadraticCurveTo(ex + 30, ey - 24, ex + 65, ey - 14);
      ctx.quadraticCurveTo(ex + 25, ey + 12, ex, ey + 12);
      ctx.quadraticCurveTo(ex - 25, ey + 12, ex - 65, ey - 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex, ey, 23, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Gull eyes & fierce brow
      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath();
      ctx.arc(ex - 6, ey - 2, 3.2, 0, TAU);
      ctx.arc(ex + 6, ey - 2, 3.2, 0, TAU);
      ctx.fill();

      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(ex - 11, ey - 10); ctx.lineTo(ex - 3, ey - 6);
      ctx.moveTo(ex + 11, ey - 10); ctx.lineTo(ex + 3, ey - 6);
      ctx.stroke();

      // Sharp inked gold beak
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(ex - 8, ey + 14);
      ctx.lineTo(ex + 8, ey + 14);
      ctx.lineTo(ex, ey + 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  drawHUD(ctx, W, H) {
    // 1. Top-Left Distance Card cleanly below CYCLE banner (y=104..140)
    drawComicPanel(ctx, 14, 104, 102, 36, 11, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawComicText(ctx, `${this.maxDistance}m`, 65, 123, "900 15px 'Fredoka', 'Outfit', sans-serif", '#fde047', {
      strokeWidth: 3.2,
    });

    // 2. Top-Right Coin Pill cleanly below #prestigeBadge (y=108..142)
    const rx = W - 114;
    const ry = 108;
    drawComicPanel(ctx, rx, ry, 100, 34, 11, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });

    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(rx + 22, ry + 17, 7.5, 0, TAU);
    ctx.fill();
    ctx.stroke();

    drawComicText(ctx, `×${this.coins}`, rx + 62, ry + 18, "900 14px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
      strokeWidth: 3.0,
    });

    // 3. Seagull Warning Banner
    const playerScreenY = this.player.y - this.cameraY;
    if (playerScreenY > 670 || this.idleTimer > this.maxIdle - 2.5) {
      const pulse = Math.sin(this.time * 8) > 0;
      const bw = 248;
      const bh = 30;
      const bx = (W - bw) / 2;
      const by = 152;
      drawComicPanel(ctx, bx, by, bw, bh, 12, pulse ? '#dc2626' : '#f59e0b', {
        lineWidth: 2.6,
        shadowDx: 2,
        shadowDy: 2.5,
      });
      drawComicText(ctx, 'SEAGULL SWOOP INCOMING!', W / 2, by + bh * 0.5 + 1, "900 11.5px 'Fredoka', 'Outfit', sans-serif", '#ffffff', {
        strokeWidth: 3.0,
      });

      const creepRatio = clamp((playerScreenY - 670) / 90, 0.2, 1);
      ctx.fillStyle = `rgba(220, 38, 38, ${0.32 * creepRatio * (pulse ? 1 : 0.65)})`;
      ctx.fillRect(0, H - 72, W, 72);
    }
  }

  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
}
