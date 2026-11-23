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
  traceRoundRect,
} from '../engine/toyStyle.js';

const TAU = Math.PI * 2;
const COLS = 9;
const TILE_W = 50; // 450 / 9 = 50 px
const ROW_H = 50;
const HALF_TILE = 25;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// World coordinate helper:
// Row r: r=0 is starting row. r > 0 are forward rows ahead (higher up on screen).
// Center Y of row r:
const rowCenterY = (r) => -(r * ROW_H + HALF_TILE);
// Top Y of row r (upper edge on canvas):
const rowTopY = (r) => -(r + 1) * ROW_H;

export class CrossyRoad extends Game {
  static meta = {
    id: 'crossy-road',
    title: 'Crossy Hopper',
    icon: '🚗',
    hint: 'TAP or UP to hop forward · SWIPE/ARROWS to dodge traffic · RIDE logs across the canal!',
    baseLikes: 2180,
    isPrestige: false,
    parScore60s: 420,
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
    this.distance = 0;
    this.maxDistance = 0;
    this.coins = 0;

    // Player Grid Position
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
      dir: 0, // 0: North (Up), 1: East (Right), 2: South (Down), 3: West (Left)
      dead: false,
      onLog: null,
    };

    // Camera: Player sits at ~560px from the top (70% down screen)
    this.cameraY = this.player.y - 560;
    this.targetCameraY = this.cameraY;

    // Inactivity Seagull Attack (tightens with Prestige)
    this.idleTimer = 0;
    this.maxIdle = this.diff.idleLimit ?? 7.5;
    this.eagleSwooping = false;
    this.eagleY = this.cameraY - 200;
    this.eagleX = this.player.x;

    // World Rows map: row index -> row object
    this.rows = new Map();
    this.generatedMaxRow = 0;

    // Touch gesture tracking
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartT = 0;

    if (saved) {
      if (Number.isFinite(saved.maxDistance)) this.maxDistance = saved.maxDistance;
      if (Number.isFinite(saved.coins)) this.coins = saved.coins;
      this.grace = 1.5;
    }

    // Generate initial safe zone + upcoming lanes (rows 0 to 24)
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
    return `Distance ${this.maxDistance}m · 🪙 ×${this.coins} · ${Math.round(this.score)} pts`;
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
    // Safe starting bank
    if (r <= 2) {
      return {
        row: r,
        type: 'grass',
        obstacles: r === 0 ? [] : this.spawnGrassObstacles(r, 0.15),
        coins: [],
      };
    }

    // Procedural Biome Pattern Generator
    // Group lanes in thematic chunks: e.g. 2-3 roads, 1 grass, 2-3 rivers, 1 railway
    const cycle = r % 16;
    let type = 'grass';

    if ((cycle >= 2 && cycle <= 4) || (cycle >= 11 && cycle <= 13)) {
      type = 'road';
    } else if (cycle >= 6 && cycle <= 8) {
      type = 'river';
    } else if (cycle === 9) {
      type = 'rail';
    } else {
      type = 'grass';
    }

    if (type === 'grass') {
      const obstacles = this.spawnGrassObstacles(r, 0.28);
      const coins = [];
      if (Math.random() < 0.35) {
        const freeCols = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(c => !obstacles.includes(c));
        if (freeCols.length > 0) {
          coins.push({ col: freeCols[Math.floor(Math.random() * freeCols.length)], collected: false });
        }
      }
      return { row: r, type: 'grass', obstacles, coins };
    }

    if (type === 'road') {
      const dir = (r % 2 === 0) ? 1 : -1;
      const spd = (95 + Math.min(180, (r * 1.8) + (Math.random() * 50))) * (this.diff.vehicleSpeedMult ?? 1);
      const vehicles = this.spawnVehicles(r, dir, spd);
      return { row: r, type: 'road', dir, spd, vehicles, coins: [] };
    }

    if (type === 'river') {
      const dir = (r % 2 === 0) ? 1 : -1;
      const spd = (75 + Math.min(130, (r * 1.2) + (Math.random() * 40))) * (this.diff.logSpeedMult ?? 1);
      const logs = this.spawnRiverLogs(r, dir, spd);
      return { row: r, type: 'river', dir, spd, logs, coins: [] };
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
      // Keep center column free on initial rows
      if (row <= 3 && c === 4) continue;
      if (Math.random() < density) {
        obs.push(c);
      }
    }
    // Guarantee at least 2 open pathways through any row
    if (obs.length >= COLS - 1) {
      obs.splice(0, 2);
    }
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
      let col = '#ffd166';
      if (kind === 'sportsCar') { w = 50; col = '#00f5d4'; }
      else if (kind === 'deliveryVan') { w = 72; col = '#9b5de5'; }
      else if (kind === 'doubleDecker') { w = 92; col = '#d90429'; }

      const startX = i * spacing + (Math.random() - 0.5) * 40;
      vehicles.push({
        x: startX,
        w,
        h: 36,
        kind,
        col,
      });
    }
    return vehicles;
  }

  spawnRiverLogs(row, dir, spd) {
    const logs = [];
    const count = 3;
    const spacing = 450 / count;

    for (let i = 0; i < count; i++) {
      const isLily = (i === 1 && Math.random() < 0.4);
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

    // Inactivity timer & continuous forward camera creep
    this.idleTimer += dt;

    // The bottom of the screen slowly creeps up on the player!
    if (this.time > 1.2) {
      const creepSpeed = 26 + Math.min(24, this.distance * 0.45);
      this.cameraY -= creepSpeed * dt;
    }

    // Smooth Camera Following: Catch up when player hops ahead
    const targetCam = this.player.y - 560;
    if (targetCam < this.cameraY) {
      this.cameraY += (targetCam - this.cameraY) * Math.min(1, dt * 7.5);
    }

    const playerScreenY = this.player.y - this.cameraY;

    // Warning alert sound when bottom screen encroaches or player lingers
    if (playerScreenY > 670 || this.idleTimer > this.maxIdle - 1.8) {
      if ((this.time % 0.35) < dt) {
        this.sounds.tick();
      }
    }

    // Trigger seagull swoop when bottom screen catches up or timer expires
    if ((playerScreenY >= 720 || this.idleTimer >= this.maxIdle) && !this.eagleSwooping) {
      this.triggerSeagullSwoop();
    }

    // Eagle swooping down animation
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

    // Process Player Hopping
    this.updatePlayerHop(dt);

    // Ensure rows are generated ahead of player
    this.generateUpToRow(this.player.row + 18);

    // Update Moving Lanes (Roads, Rivers, Railways)
    this.updateWorldLanes(dt);

    // Test Collisions & River Floating
    this.testCollisions(dt);

    // Cleanup very old rows behind camera to save memory
    const purgeRowBefore = Math.floor(-(this.cameraY + 1100) / ROW_H);
    for (const [rKey] of this.rows) {
      if (rKey < purgeRowBefore) this.rows.delete(rKey);
    }
  }

  /* ------------------------------------------------------------- Input & Controls */
  handleInput() {
    if (this.player.hopping || this.dead) return;

    const inp = this.input;

    // Edge-triggered Keyboard support
    const upPressed = inp.key('w', 'arrowup', ' ');
    const leftPressed = inp.key('a', 'arrowleft');
    const rightPressed = inp.key('d', 'arrowright');
    const downPressed = inp.key('s', 'arrowdown');

    if (upPressed && !this.prevUp) {
      this.hop(0, 1, 0); // Forward / North
      this.prevUp = true;
      return;
    }
    if (leftPressed && !this.prevLeft) {
      this.hop(-1, 0, 3); // Left / West
      this.prevLeft = true;
      return;
    }
    if (rightPressed && !this.prevRight) {
      this.hop(1, 0, 1); // Right / East
      this.prevRight = true;
      return;
    }
    if (downPressed && !this.prevDown) {
      this.hop(0, -1, 2); // Backward / South
      this.prevDown = true;
      return;
    }

    if (!upPressed) this.prevUp = false;
    if (!leftPressed) this.prevLeft = false;
    if (!rightPressed) this.prevRight = false;
    if (!downPressed) this.prevDown = false;

    // Pointer / Touch / Swipe Support
    if (inp.pressed) {
      this.touchStartX = inp.x;
      this.touchStartY = inp.y;
      this.touchMoved = false;
    }

    if (inp.down && !this.touchMoved) {
      const dx = inp.x - this.touchStartX;
      const dy = inp.y - this.touchStartY;
      const dist = Math.hypot(dx, dy);
      if (dist > 26) {
        this.touchMoved = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) this.hop(1, 0, 1); // Swipe Right
          else this.hop(-1, 0, 3); // Swipe Left
        } else {
          if (dy < 0) this.hop(0, 1, 0); // Swipe Up -> Forward!
          else this.hop(0, -1, 2); // Swipe Down -> Backward!
        }
        return;
      }
    }

    if (inp.released && !this.touchMoved) {
      // Tap without swipe -> Hop Forward!
      this.hop(0, 1, 0);
    }
  }

  hop(dx, dy, dir) {
    if (this.player.hopping || this.dead) return;

    const p = this.player;

    // 1. Keep grid column synced to actual X position so we never jump sideways from drift
    p.col = clamp(Math.round((p.x - HALF_TILE) / TILE_W), 0, COLS - 1);

    const targetRow = Math.max(0, p.row + dy);
    const targetRowObj = this.rows.get(targetRow);
    const curRowObj = this.rows.get(p.row);

    let targetCol = p.col;
    let targetX = p.x;
    let targetLog = null;

    if (dy === 0) {
      // Lateral hop (Left dx = -1, or Right dx = 1)
      if (curRowObj && curRowObj.type === 'river' && p.onLog) {
        // While riding a log, lateral hop shifts smoothly along the log
        targetX = clamp(p.x + dx * TILE_W, 25, 425);
        targetCol = clamp(Math.round((targetX - HALF_TILE) / TILE_W), 0, COLS - 1);
      } else {
        targetCol = clamp(p.col + dx, 0, COLS - 1);
        targetX = targetCol * TILE_W + HALF_TILE;
      }
    } else {
      // Forward (dy > 0) or Backward (dy < 0) hop
      if (targetRowObj && targetRowObj.type === 'river') {
        // Jumping towards a RIVER!
        // Find if there is a log / lily pad opposite the player
        const hopDur = p.hopDur;
        let matchedLog = null;
        let bestDist = Infinity;

        // Check where logs will be upon landing (accounting for river movement during the jump)
        for (const log of targetRowObj.logs) {
          const futureX = log.x + (targetRowObj.dir * targetRowObj.spd * hopDur);
          const logCenter = futureX + log.w / 2;
          const dist = Math.abs(p.x - logCenter);

          // Generous alignment window: if player's current X is over or nearly over the log
          if (p.x >= futureX - 24 && p.x <= futureX + log.w + 24) {
            if (dist < bestDist) {
              bestDist = dist;
              matchedLog = { log, futureX };
            }
          }
        }

        if (matchedLog) {
          // Found the log opposite us! Magnetically track into its safe zone
          targetLog = matchedLog.log;
          // Clamp targetX safely within log interior so we don't land right on the edge
          targetX = clamp(p.x, matchedLog.futureX + 16, matchedLog.futureX + matchedLog.log.w - 16);
          targetCol = clamp(Math.round((targetX - HALF_TILE) / TILE_W), 0, COLS - 1);
        } else {
          // No log opposite: jump straight forward along current X into the water
          targetX = p.x;
          targetCol = clamp(Math.round((targetX - HALF_TILE) / TILE_W), 0, COLS - 1);
        }
      } else {
        // Landing on land (grass, road, rail)
        targetCol = clamp(Math.round((p.x - HALF_TILE) / TILE_W) + dx, 0, COLS - 1);

        // Smart obstacle avoidance: if landing on a tree, try nudging to an adjacent open column
        if (targetRowObj && targetRowObj.type === 'grass' && targetRowObj.obstacles.includes(targetCol)) {
          if (targetCol > 0 && !targetRowObj.obstacles.includes(targetCol - 1)) {
            targetCol = targetCol - 1;
          } else if (targetCol < COLS - 1 && !targetRowObj.obstacles.includes(targetCol + 1)) {
            targetCol = targetCol + 1;
          } else {
            // Completely blocked by trees! Solid obstacle thump
            this.sounds.tick();
            this.haptics.light();
            return;
          }
        }
        targetX = targetCol * TILE_W + HALF_TILE;
      }
    }

    // Final check for solid obstacle trees on grass
    if (targetRowObj && targetRowObj.type === 'grass' && targetRowObj.obstacles.includes(targetCol)) {
      this.sounds.tick();
      this.haptics.light();
      return;
    }

    // Initiate hop
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

    // Reset inactivity timer on forward progress
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
      // If jumping towards a moving log, smoothly track its movement in mid-air
      if (p.targetLog && p.targetRowObj) {
        const drift = p.targetRowObj.dir * p.targetRowObj.spd * dt;
        p.targetX += drift;
      }

      p.hopT += dt / p.hopDur;
      if (p.hopT >= 1) {
        p.hopT = 1;
        p.x = p.targetX;
        p.y = p.targetY;
        p.hopping = false;
        p.targetLog = null;
        p.targetRowObj = null;

        // Keep col in sync
        p.col = clamp(Math.round((p.x - HALF_TILE) / TILE_W), 0, COLS - 1);

        // Check coin pickup on landed tile
        const rowObj = this.rows.get(p.row);
        if (rowObj && rowObj.coins) {
          const coin = rowObj.coins.find(c => c.col === p.col && !c.collected);
          if (coin) {
            coin.collected = true;
            this.coins++;
            this.score += 25;
            this.fx.ring(p.x, p.y, '#ffd166', 36, 0.35, 3);
            this.fx.text(p.x, p.y - 20, '+25', '#ffd166', 18);
            this.sounds.like();
            this.haptics.medium();
          }
        }
      } else {
        const ease = p.hopT;
        p.x = p.startX + (p.targetX - p.startX) * ease;
        p.y = p.startY + (p.targetY - p.startY) * ease;
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
            v.x = -v.w - (Math.random() * 60);
          } else if (rowObj.dir === -1 && v.x < -v.w) {
            v.x = 450 + v.w + (Math.random() * 60);
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
          if (rowObj.warningT % 0.3 < dt) {
            this.sounds.tick();
          }
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

    // 1. River Current & Drowning
    if (curRow.type === 'river' && inRowZone) {
      let standingOn = null;
      for (const log of curRow.logs) {
        // Generous landing & riding tolerance (20px beyond log edges)
        if (p.x >= log.x - 20 && p.x <= log.x + log.w + 20) {
          standingOn = log;
          break;
        }
      }

      if (standingOn) {
        p.onLog = standingOn;
        // Carry player with river flow
        const drift = curRow.dir * curRow.spd * dt;
        p.x += drift;
        p.targetX += drift;
        p.startX += drift;

        // Keep column in sync while drifting
        p.col = clamp(Math.round((p.x - HALF_TILE) / TILE_W), 0, COLS - 1);

        // Collect floating coin on log
        if (standingOn.hasCoin && !standingOn.coinCollected) {
          standingOn.coinCollected = true;
          this.coins++;
          this.score += 35;
          this.fx.ring(p.x, p.y, '#ffd166', 36, 0.35, 3);
          this.fx.text(p.x, p.y - 20, '+35', '#ffd166', 18);
          this.sounds.like();
          this.haptics.medium();
        }

        // Out of bounds screen edge elimination
        if (p.x < -18 || p.x > 468) {
          this.die('Swept away down the Mersey!');
          this.sounds.gulp();
          return;
        }
      } else if (!p.hopping) {
        // Landed directly into water -> SPLASH DROWNED!
        this.die('Sunk into the Mersey Canal!');
        this.fx.ring(p.x, p.y, '#00f5d4', 60, 0.65, 4);
        this.fx.burst(p.x, p.y, '#00f5d4', 24, 180, 0.7, 4);
        this.sounds.gulp();
        this.haptics.heavy();
        return;
      }
    }

    // 2. Road Vehicle Hitbox Collision
    if (curRow.type === 'road' && inRowZone) {
      for (const v of curRow.vehicles) {
        const carLeft = v.x;
        const carRight = v.x + v.w;
        const pRadius = 14;

        if (p.x + pRadius > carLeft && p.x - pRadius < carRight) {
          this.die(`Run over by a ${v.kind.replace(/([A-Z])/g, ' $1').toLowerCase()}!`);
          this.fx.burst(p.x, p.y, '#ff4b5c', 36, 260, 0.85, 5);
          this.fx.shake(16, 0.45);
          this.sounds.hit();
          this.haptics.heavy();
          return;
        }
      }
    }

    // 3. Train Collision
    if (curRow.type === 'rail' && curRow.trainActive && inRowZone) {
      const trainLeft = curRow.trainDir === 1 ? curRow.trainX : curRow.trainX - 520;
      const trainRight = curRow.trainDir === 1 ? curRow.trainX + 520 : curRow.trainX;

      if (p.x > trainLeft && p.x < trainRight) {
        this.die('Obliterated by the Mersey Express Train!');
        this.fx.burst(p.x, p.y, '#e63946', 44, 320, 0.95, 6);
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

  /* ------------------------------------------------------------- Render Engine */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    ctx.fillStyle = '#101424';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    // Offset view by camera
    ctx.translate(0, -this.cameraY);

    const minRow = Math.floor(-(this.cameraY + 850) / ROW_H) - 2;
    const maxRow = Math.ceil(-this.cameraY / ROW_H) + 2;

    // Draw background grass buffer for rows behind start (r < 0)
    for (let r = minRow; r < 0; r++) {
      const y = rowTopY(r);
      const baseGrass = (Math.abs(r) % 2 === 0) ? '#2f9e66' : '#38b272';
      const gg = ctx.createLinearGradient(0, y, 0, y + ROW_H);
      gg.addColorStop(0, shadeColor(baseGrass, 0.14));
      gg.addColorStop(0.82, baseGrass);
      gg.addColorStop(1, shadeColor(baseGrass, -0.14));
      ctx.fillStyle = gg;
      ctx.fillRect(0, y, 450, ROW_H);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      traceRoundRect(ctx, 80, y + 12, 16, 5, 2.5);
      ctx.fill();
      traceRoundRect(ctx, 280, y + 24, 16, 5, 2.5);
      ctx.fill();
    }

    // 1. Draw Ground Terrain Rows
    for (let r = Math.max(0, minRow); r <= maxRow; r++) {
      const rowObj = this.rows.get(r);
      if (!rowObj) continue;
      this.drawRowTerrain(ctx, rowObj);
    }

    // 2. Draw River Water Surface & Floating Logs
    for (let r = Math.max(0, minRow); r <= maxRow; r++) {
      const rowObj = this.rows.get(r);
      if (rowObj && rowObj.type === 'river') {
        this.drawRiverContent(ctx, rowObj);
      }
    }

    // 3. Draw Road Markings & Vehicles
    for (let r = Math.max(0, minRow); r <= maxRow; r++) {
      const rowObj = this.rows.get(r);
      if (rowObj && rowObj.type === 'road') {
        this.drawRoadVehicles(ctx, rowObj);
      }
    }

    // 4. Draw Railways & Trains
    for (let r = Math.max(0, minRow); r <= maxRow; r++) {
      const rowObj = this.rows.get(r);
      if (rowObj && rowObj.type === 'rail') {
        this.drawRailroad(ctx, rowObj);
      }
    }

    // 5. Draw Grass Obstacles (Trees, Benches, Coins)
    for (let r = Math.max(0, minRow); r <= maxRow; r++) {
      const rowObj = this.rows.get(r);
      if (rowObj && rowObj.type === 'grass') {
        this.drawGrassProps(ctx, rowObj);
      }
    }

    // 6. Draw Player (Captain Jellybean) with 3D Hop Arc!
    this.drawPlayer(ctx);

    // 7. Draw Seagull Shadow & Swoop
    this.drawSeagullThreat(ctx);

    // 8. Render FX
    this.fx.render(ctx, 1.0);

    ctx.restore();

    // 9. HUD Header
    this.drawHUD(ctx, W, H);
  }

  drawRowTerrain(ctx, rowObj) {
    const y = rowTopY(rowObj.row);

    if (rowObj.type === 'grass') {
      const baseGrass = (rowObj.row % 2 === 0) ? '#2f9e66' : '#38b272';
      const gg = ctx.createLinearGradient(0, y, 0, y + ROW_H);
      gg.addColorStop(0, shadeColor(baseGrass, 0.14));
      gg.addColorStop(0.84, baseGrass);
      gg.addColorStop(1, shadeColor(baseGrass, -0.16));
      ctx.fillStyle = gg;
      ctx.fillRect(0, y, 450, ROW_H);

      // Playful rounded clover/grass tufts
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      traceRoundRect(ctx, 60, y + 9, 14, 5, 2.5);
      ctx.fill();
      traceRoundRect(ctx, 190, y + 26, 16, 5, 2.5);
      ctx.fill();
      traceRoundRect(ctx, 340, y + 15, 14, 5, 2.5);
      ctx.fill();
    } else if (rowObj.type === 'road') {
      const rg = ctx.createLinearGradient(0, y, 0, y + ROW_H);
      rg.addColorStop(0, '#272c3f');
      rg.addColorStop(0.5, '#1e2232');
      rg.addColorStop(1, '#161926');
      ctx.fillStyle = rg;
      ctx.fillRect(0, y, 450, ROW_H);

      // Soft bevel curb lines on road edges
      ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
      ctx.fillRect(0, y, 450, 2);
      ctx.fillStyle = 'rgba(12, 20, 42, 0.36)';
      ctx.fillRect(0, y + ROW_H - 2, 450, 2);

      // Rounded toy lane dashes
      ctx.fillStyle = 'rgba(248, 250, 252, 0.34)';
      for (let dx = 12; dx < 450; dx += 38) {
        traceRoundRect(ctx, dx, y + ROW_H / 2 - 2, 18, 4, 2);
        ctx.fill();
      }
    } else if (rowObj.type === 'river') {
      // Smooth shaded toy canal water
      const wg = ctx.createLinearGradient(0, y, 0, y + ROW_H);
      wg.addColorStop(0, '#0369a1');
      wg.addColorStop(0.25, '#0284c7');
      wg.addColorStop(0.75, '#0ea5e9');
      wg.addColorStop(1, '#0369a1');
      ctx.fillStyle = wg;
      ctx.fillRect(0, y, 450, ROW_H);

      // Canal bank depth rim
      ctx.fillStyle = 'rgba(12, 20, 42, 0.28)';
      ctx.fillRect(0, y, 450, 3);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.24)';
      ctx.fillRect(0, y + ROW_H - 2.5, 450, 2.5);

      // Glossy rounded water ripple pills
      ctx.fillStyle = 'rgba(186, 230, 253, 0.36)';
      const rippleOffset = (this.time * rowObj.spd * 0.4 * rowObj.dir) % 80;
      for (let rx = -40; rx < 490; rx += 70) {
        traceRoundRect(ctx, rx + rippleOffset, y + 14, 24, 3.5, 1.75);
        ctx.fill();
        traceRoundRect(ctx, rx + rippleOffset + 26, y + 32, 16, 3, 1.5);
        ctx.fill();
      }
    } else if (rowObj.type === 'rail') {
      const bg = ctx.createLinearGradient(0, y, 0, y + ROW_H);
      bg.addColorStop(0, '#334155');
      bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, y, 450, ROW_H);

      // Beveled wooden sleepers
      for (let tx = 10; tx < 450; tx += 28) {
        drawToyBevelRect(ctx, tx, y + 6, 12, ROW_H - 12, 3, '#7c4a27', {
          depth: 2,
          rimColor: toyRim('#7c4a27', 0.56),
          lineWidth: 1,
          gloss: false,
        });
      }

      // 3D Steel tracks with specular glint
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(0, y + 14.5); ctx.lineTo(450, y + 14.5);
      ctx.moveTo(0, y + ROW_H - 13.5); ctx.lineTo(450, y + ROW_H - 13.5);
      ctx.stroke();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + 13.5); ctx.lineTo(450, y + 13.5);
      ctx.moveTo(0, y + ROW_H - 14.5); ctx.lineTo(450, y + ROW_H - 14.5);
      ctx.stroke();
    }
  }

  drawRiverContent(ctx, rowObj) {
    const topY = rowTopY(rowObj.row);
    const cy = rowCenterY(rowObj.row);

    for (const log of rowObj.logs) {
      ctx.save();
      if (log.isLily) {
        const lcx = log.x + log.w / 2;
        const lr = log.w / 2;
        // Soft water shadow beneath lily pad
        drawToyShadow(ctx, lcx + 1, cy + 5, lr * 0.92, lr * 0.72, 0.24);

        // Volumetric 3D radial vinyl lily pad
        const lg = ctx.createRadialGradient(lcx - lr * 0.28, cy - lr * 0.28, lr * 0.1, lcx, cy, lr);
        lg.addColorStop(0, '#86efac');
        lg.addColorStop(0.5, '#22c55e');
        lg.addColorStop(1, '#15803d');
        ctx.fillStyle = lg;
        ctx.strokeStyle = toyRim('#16a34a', 0.58);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(lcx, cy, lr, 0.22, TAU - 0.22);
        ctx.lineTo(lcx, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glossy leaf vein highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(lcx, cy, lr * 0.65, Math.PI * 0.9, Math.PI * 1.45);
        ctx.stroke();

        // Sculpted 3D pink lotus bloom
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * TAU;
          drawToySphere(ctx, lcx + Math.cos(pa) * 5, cy + Math.sin(pa) * 5, 4.2, '#f472b6', {
            rimColor: toyRim('#db2777', 0.52),
            lineWidth: 0.9,
            shine: 0.4,
            bottomBounce: false,
          });
        }
        drawToySphere(ctx, lcx, cy, 4.5, '#fde047', {
          rimColor: '#ca8a04',
          lineWidth: 0.9,
          shine: 0.75,
        });
      } else {
        // Floating shadow underneath wooden log
        drawToyShadow(ctx, log.x + log.w / 2, topY + ROW_H - 4, log.w * 0.48, 8, 0.24);

        // Volumetric 3D Wooden Toy Log
        drawToyBevelRect(ctx, log.x, topY + 7, log.w, ROW_H - 14, 11, '#a1622e', {
          depth: 4,
          rimColor: toyRim('#854d0e', 0.58),
          lineWidth: 1.5,
          gloss: true,
        });

        // Lighter wood end-grain rings
        ctx.fillStyle = '#fde68a';
        ctx.strokeStyle = toyRim('#854d0e', 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(log.x + 6, cy, 4.5, (ROW_H - 20) * 0.42, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();

        // Rounded bark grooves
        ctx.strokeStyle = 'rgba(69, 26, 3, 0.35)';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(log.x + 16, topY + 18); ctx.lineTo(log.x + log.w - 14, topY + 18);
        ctx.moveTo(log.x + 22, topY + 27); ctx.lineTo(log.x + log.w - 20, topY + 27);
        ctx.stroke();
      }

      // Coin on log
      if (log.hasCoin && !log.coinCollected) {
        this.drawCoin(ctx, log.x + log.w / 2, cy);
      }
      ctx.restore();
    }
  }

  drawRoadVehicles(ctx, rowObj) {
    const topY = rowTopY(rowObj.row);

    for (const v of rowObj.vehicles) {
      ctx.save();
      const vy = topY + (ROW_H - v.h) / 2;
      const isRight = rowObj.dir === 1;
      const rim = toyRim(v.col, 0.58);

      // Soft grounding shadow
      drawToyShadow(ctx, v.x + v.w / 2, vy + v.h + 2, v.w * 0.52, v.h * 0.32, 0.32);

      // Chunky protruding rubber toy wheels
      ctx.fillStyle = '#1e293b';
      const wheelW = 10;
      const wheelX1 = v.x + 8;
      const wheelX2 = v.x + v.w - 18;
      traceRoundRect(ctx, wheelX1, vy - 2.5, wheelW, 5, 2.5);
      ctx.fill();
      traceRoundRect(ctx, wheelX2, vy - 2.5, wheelW, 5, 2.5);
      ctx.fill();
      traceRoundRect(ctx, wheelX1, vy + v.h - 2.5, wheelW, 5, 2.5);
      ctx.fill();
      traceRoundRect(ctx, wheelX2, vy + v.h - 2.5, wheelW, 5, 2.5);
      ctx.fill();

      // Volumetric 3D Extruded Vinyl Car Chassis
      drawToyBevelRect(ctx, v.x, vy, v.w, v.h, 9, v.col, {
        depth: 4,
        rimColor: rim,
        lineWidth: 1.5,
        gloss: true,
      });

      // Kind-specific 3D Toy Details & Roof Windows
      if (v.kind === 'doubleDecker') {
        drawToyBevelRect(ctx, v.x + 5, vy + 4, v.w - 10, v.h - 8, 6, shadeColor(v.col, 0.16), {
          depth: 2.5,
          rimColor: rim,
          lineWidth: 1.2,
          gloss: true,
        });
        // Dual panoramic glossy roof glass panels
        drawToyPill(ctx, v.x + 10, vy + 7, v.w - 20, 9, '#38bdf8', { rimColor: '#0f172a', lineWidth: 1.1 });
        drawToyPill(ctx, v.x + 10, vy + 20, v.w - 20, 9, '#38bdf8', { rimColor: '#0f172a', lineWidth: 1.1 });
      } else if (v.kind === 'deliveryVan') {
        // Raised white cargo box cabin + windshield
        const cabX = isRight ? v.x + v.w - 20 : v.x + 5;
        const boxX = isRight ? v.x + 4 : v.x + 22;
        drawToyBevelRect(ctx, boxX, vy + 4, v.w - 26, v.h - 8, 5, '#f8fafc', {
          depth: 2,
          rimColor: '#94a3b8',
          lineWidth: 1.1,
          gloss: true,
        });
        drawToyBevelRect(ctx, cabX, vy + 6, 14, v.h - 12, 4, '#38bdf8', {
          depth: 0,
          rimColor: '#0f172a',
          lineWidth: 1.2,
          gloss: true,
        });
      } else {
        // Sports car racing stripe or Taxi roof sign
        if (v.kind === 'sportsCar') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
          traceRoundRect(ctx, v.x + 4, vy + v.h * 0.42, v.w - 8, v.h * 0.16, 2);
          ctx.fill();
        }
        // Glossy tinted glass cabin
        drawToyBevelRect(ctx, v.x + 11, vy + 6, v.w - 22, v.h - 12, 5, '#1e293b', {
          depth: 0,
          rimColor: '#0f172a',
          lineWidth: 1.2,
          gloss: true,
        });
        // Roof panel
        drawToyBevelRect(ctx, v.x + 17, vy + 8, v.w - 34, v.h - 16, 4, shadeColor(v.col, 0.22), {
          depth: 1.5,
          rimColor: rim,
          lineWidth: 1.0,
          gloss: true,
        });
        if (v.kind === 'taxi') {
          drawToyPill(ctx, v.x + v.w * 0.5 - 7, vy + v.h * 0.5 - 4, 14, 8, '#ffffff', {
            rimColor: '#0f172a',
            lineWidth: 1.0,
          });
        }
      }

      // Soft warm headlight cones + rounded headlights & taillights
      const hx = isRight ? v.x + v.w - 3.5 : v.x + 0.5;
      const coneDir = isRight ? 1 : -1;
      const hg = ctx.createLinearGradient(hx, 0, hx + coneDir * 24, 0);
      hg.addColorStop(0, 'rgba(254, 240, 138, 0.42)');
      hg.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(hx + (isRight ? 2 : 0), vy + 5);
      ctx.lineTo(hx + coneDir * 24, vy - 2);
      ctx.lineTo(hx + coneDir * 24, vy + v.h + 2);
      ctx.lineTo(hx + (isRight ? 2 : 0), vy + v.h - 5);
      ctx.closePath();
      ctx.fill();

      drawToySphere(ctx, hx + 1.5, vy + 7, 3.2, '#fef08a', { rimColor: '#ca8a04', lineWidth: 0.8 });
      drawToySphere(ctx, hx + 1.5, vy + v.h - 7, 3.2, '#fef08a', { rimColor: '#ca8a04', lineWidth: 0.8 });

      const tx = isRight ? v.x + 2 : v.x + v.w - 2;
      drawToySphere(ctx, tx, vy + 7, 2.8, '#ff0054', { rimColor: '#881337', lineWidth: 0.8 });
      drawToySphere(ctx, tx, vy + v.h - 7, 2.8, '#ff0054', { rimColor: '#881337', lineWidth: 0.8 });

      ctx.restore();
    }
  }

  drawRailroad(ctx, rowObj) {
    const topY = rowTopY(rowObj.row);

    // Crossing Signal Pole (3D Toy Post + Glowing Warning Lamps)
    ctx.save();
    drawToyBevelRect(ctx, 18, topY + 4, 6, ROW_H - 8, 3, '#64748b', {
      depth: 1.5,
      rimColor: '#1e293b',
      lineWidth: 1,
      gloss: true,
    });

    if (rowObj.warning) {
      const flash = Math.sin(this.time * 16) > 0;
      if (flash) {
        ctx.fillStyle = 'rgba(255, 0, 84, 0.28)';
        ctx.beginPath(); ctx.arc(14, topY + 14, 10, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255, 0, 84, 0.28)';
        ctx.beginPath(); ctx.arc(28, topY + 14, 10, 0, TAU); ctx.fill();
      }
      drawToySphere(ctx, 14, topY + 14, 5, flash ? '#ff3b6b' : '#475569', { rimColor: '#0f172a', lineWidth: 1 });
      drawToySphere(ctx, 28, topY + 14, 5, !flash ? '#ff3b6b' : '#475569', { rimColor: '#0f172a', lineWidth: 1 });
    }
    ctx.restore();

    // High Speed 3D Vinyl Express Train
    if (rowObj.trainActive) {
      ctx.save();
      const tx = rowObj.trainX;
      const tw = 460;
      const th = 40;
      const ty = topY + (ROW_H - th) / 2;

      drawToyShadow(ctx, tx + tw / 2, ty + th + 3, tw * 0.49, 8, 0.34);

      drawToyBevelRect(ctx, tx, ty, tw, th, 11, '#ef4444', {
        depth: 4,
        rimColor: toyRim('#dc2626', 0.6),
        lineWidth: 1.6,
        gloss: true,
      });

      // Cream racing stripe pill
      drawToyPill(ctx, tx + 6, ty + 14, tw - 12, 8, '#f8fafc', {
        rimColor: '#991b1b',
        lineWidth: 0.9,
        gloss: false,
      });

      // Glossy Sky-Blue Passenger Windows
      for (let wx = tx + 30; wx < tx + tw - 30; wx += 36) {
        drawToyBevelRect(ctx, wx, ty + 7, 22, 13, 4, '#38bdf8', {
          depth: 0,
          rimColor: '#0f172a',
          lineWidth: 1.1,
          gloss: true,
        });
      }
      ctx.restore();
    }
  }

  drawGrassProps(ctx, rowObj) {
    const cy = rowCenterY(rowObj.row);

    // Coins on grass
    for (const c of rowObj.coins) {
      if (!c.collected) {
        this.drawCoin(ctx, c.col * TILE_W + HALF_TILE, cy);
      }
    }

    // Solid obstacle 3D Toy Pine/Orb Trees
    for (const col of rowObj.obstacles) {
      const ox = col * TILE_W + HALF_TILE;
      const oy = cy;

      ctx.save();
      // Soft grounding shadow
      drawToyShadow(ctx, ox, oy + 14, 17, 7.5, 0.3);

      // Beveled wooden trunk
      drawToyBevelRect(ctx, ox - 5.5, oy - 2, 11, 16, 4, '#92400e', {
        depth: 2,
        rimColor: '#451a03',
        lineWidth: 1.2,
        gloss: false,
      });

      // Stacked 3D vinyl foliage spheres
      drawToySphere(ctx, ox, oy - 6, 16.5, '#16a34a', {
        rimColor: toyRim('#15803d', 0.58),
        lineWidth: 1.4,
        shine: 0.32,
      });
      drawToySphere(ctx, ox, oy - 13, 12.5, '#22c55e', {
        rimColor: toyRim('#16a34a', 0.56),
        lineWidth: 1.3,
        shine: 0.58,
      });
      ctx.restore();
    }
  }

  drawCoin(ctx, x, y) {
    ctx.save();
    const bob = Math.sin(this.time * 6) * 3;
    const squish = Math.cos(this.time * 5);

    drawToyShadow(ctx, x, y + 11, 8, 3.2, 0.22);

    ctx.translate(x, y + bob);
    ctx.scale(Math.max(0.24, Math.abs(squish)), 1);

    drawToySphere(ctx, 0, 0, 10.5, '#ffd166', {
      rimColor: '#92400e',
      lineWidth: 1.4,
      shine: 0.8,
    });
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx) {
    const p = this.player;
    const hopArc = p.hopping ? Math.sin(p.hopT * Math.PI) * 18 : 0;
    const py = p.y - hopArc;

    // Soft Grounding Shadow under player
    ctx.save();
    const shadowScale = p.hopping ? 1 - Math.sin(p.hopT * Math.PI) * 0.4 : 1;
    drawToyShadow(ctx, p.x, p.y + 12, 15 * shadowScale, 7.5 * shadowScale, 0.34);

    // Draw Captain Jellybean mascot
    drawBean(ctx, p.x, py - 6, 32, {
      ufo: false,
      color: '#25e6ff',
      bellyColor: '#ffd166',
      walkT: this.time * 2.5,
      squash: p.hopping ? 1.25 - Math.sin(p.hopT * Math.PI) * 0.4 : 1,
      dir: (p.dir === 3) ? -1 : 1,
      eyes: this.eagleSwooping ? 'squish' : 'happy',
      hat: 'crown',
      dead: this.dead,
    });

    ctx.restore();
  }

  drawSeagullThreat(ctx) {
    const p = this.player;
    const playerScreenY = p.y - this.cameraY;

    // Warning ground shadow when bottom screen is creeping up
    if (playerScreenY > 640 || this.idleTimer > this.maxIdle - 2.5) {
      const dangerRatio = clamp(Math.max((playerScreenY - 640) / 80, (this.idleTimer - (this.maxIdle - 2.5)) / 2.5), 0, 1);
      ctx.save();
      drawToyShadow(ctx, p.x, p.y + 10, 35 * dangerRatio, 20 * dangerRatio, 0.25 + dangerRatio * 0.42);

      // Wing silhouette
      ctx.strokeStyle = `rgba(15, 23, 42, ${0.35 + dangerRatio * 0.5})`;
      ctx.lineCap = 'round';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 55 * dangerRatio, p.y);
      ctx.quadraticCurveTo(p.x, p.y - 22 * dangerRatio, p.x + 55 * dangerRatio, p.y);
      ctx.stroke();
      ctx.restore();
    }

    // Swooping 3D Vinyl Toy Seagull
    if (this.eagleSwooping) {
      ctx.save();
      const ex = this.eagleX;
      const ey = this.eagleY;

      drawToyShadow(ctx, ex, ey + 34, 34, 10, 0.26);

      // Sculpted shaded wings
      const wg = ctx.createLinearGradient(ex - 65, ey - 16, ex + 65, ey + 10);
      wg.addColorStop(0, '#cbd5e1');
      wg.addColorStop(0.5, '#f8fafc');
      wg.addColorStop(1, '#cbd5e1');
      ctx.fillStyle = wg;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.8;
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

      // Plump 3D vinyl body sphere
      drawToySphere(ctx, ex, ey, 24, '#ffffff', {
        rimColor: '#475569',
        lineWidth: 1.6,
        shine: 0.72,
      });

      // Expressive Toy Eyes + fierce symmetric V-brows
      drawToyEyes(ctx, ex, ey - 3, 4.4, {
        spacing: 12,
        style: 'bright',
        lookX: 0,
        lookY: 0.45,
        ink: '#0f172a',
      });
      ctx.strokeStyle = '#0f172a';
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(ex - 11, ey - 10); ctx.lineTo(ex - 3, ey - 6);
      ctx.moveTo(ex + 11, ey - 10); ctx.lineTo(ex + 3, ey - 6);
      ctx.stroke();

      // Glossy 3D Golden-Orange Beak
      const bg = ctx.createLinearGradient(ex, ey + 14, ex, ey + 34);
      bg.addColorStop(0, '#fde047');
      bg.addColorStop(1, '#f97316');
      ctx.fillStyle = bg;
      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ex - 8, ey + 15);
      ctx.lineTo(ex + 8, ey + 15);
      ctx.lineTo(ex, ey + 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }

  drawHUD(ctx, W, H) {
    ctx.save();

    // 1. Distance Counter Badge (Top Left) — 3D Beveled Toy HUD Card
    drawToyBevelRect(ctx, 14, 106, 110, 34, 11, '#0f172a', {
      depth: 3,
      rimColor: '#334155',
      lineWidth: 1.8,
      gloss: false,
    });

    ctx.font = "700 14px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.6;
    ctx.strokeText(`${this.maxDistance}m`, 69, 123);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`${this.maxDistance}m`, 69, 123);

    // 2. Coins Collected Badge (Top Right) — 3D Beveled Toy HUD Card
    drawToyBevelRect(ctx, W - 112, 106, 98, 34, 11, '#0f172a', {
      depth: 3,
      rimColor: '#334155',
      lineWidth: 1.8,
      gloss: false,
    });

    ctx.strokeText(`🪙 ×${this.coins}`, W - 63, 123);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`🪙 ×${this.coins}`, W - 63, 123);

    // 3. Danger Warning & Bottom Creep Vignette
    const playerScreenY = this.player.y - this.cameraY;
    if (playerScreenY > 670 || this.idleTimer > this.maxIdle - 2.5) {
      const pulse = Math.sin(this.time * 8) > 0;
      const warnText = '⚠️ SEAGULL SWOOP INCOMING!';
      ctx.save();
      ctx.font = "700 12px 'Fredoka', 'Outfit', sans-serif";
      const tw = ctx.measureText(warnText).width;
      const bw = Math.max(248, Math.ceil(tw + 38));
      const bh = 32;
      const bx = (W - bw) / 2;
      const by = 148;

      const warnCol = pulse ? '#ff0054' : '#f59e0b';
      drawToyBevelRect(ctx, bx, by, bw, bh, bh / 2, warnCol, {
        depth: 3,
        rimColor: '#ffffff',
        lineWidth: 1.8,
        gloss: true,
      });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.8;
      ctx.strokeText(warnText, W / 2, by + bh / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(warnText, W / 2, by + bh / 2);
      ctx.restore();

      // Bottom Screen Red Creep Vignette
      const creepRatio = clamp((playerScreenY - 670) / 90, 0.2, 1);
      ctx.save();
      const grad = ctx.createLinearGradient(0, H - 90, 0, H);
      grad.addColorStop(0, 'rgba(255, 0, 84, 0)');
      grad.addColorStop(1, `rgba(255, 0, 84, ${0.5 * creepRatio * (pulse ? 1 : 0.65)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, H - 90, W, 90);
      ctx.restore();
    }

    ctx.restore();
  }

  rr(ctx, x, y, w, h, r) {
    traceRoundRect(ctx, x, y, w, h, r);
  }
}
