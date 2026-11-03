import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

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

    // Inactivity Seagull Attack
    this.idleTimer = 0;
    this.maxIdle = 7.5;
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
      const spd = 95 + Math.min(180, (r * 1.8) + (Math.random() * 50));
      const vehicles = this.spawnVehicles(r, dir, spd);
      return { row: r, type: 'road', dir, spd, vehicles, coins: [] };
    }

    if (type === 'river') {
      const dir = (r % 2 === 0) ? 1 : -1;
      const spd = 75 + Math.min(130, (r * 1.2) + (Math.random() * 40));
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
      ctx.fillStyle = (Math.abs(r) % 2 === 0) ? '#2d6a4f' : '#347959';
      ctx.fillRect(0, y, 450, ROW_H);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(80, y + 12, 14, 4);
      ctx.fillRect(280, y + 24, 14, 4);
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
      ctx.fillStyle = (rowObj.row % 2 === 0) ? '#2d6a4f' : '#347959';
      ctx.fillRect(0, y, 450, ROW_H);

      // Grass tufts
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(60, y + 8, 12, 4);
      ctx.fillRect(190, y + 26, 14, 4);
      ctx.fillRect(340, y + 14, 12, 4);
    } else if (rowObj.type === 'road') {
      ctx.fillStyle = '#1c1b26';
      ctx.fillRect(0, y, 450, ROW_H);

      // Dashed lane divider
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([16, 18]);
      ctx.beginPath();
      ctx.moveTo(0, y + ROW_H / 2);
      ctx.lineTo(450, y + ROW_H / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (rowObj.type === 'river') {
      ctx.fillStyle = '#0077b6';
      ctx.fillRect(0, y, 450, ROW_H);

      // Water current ripples
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.28)';
      ctx.lineWidth = 2;
      const rippleOffset = (this.time * rowObj.spd * 0.4 * rowObj.dir) % 80;
      for (let rx = -40; rx < 490; rx += 70) {
        ctx.beginPath();
        ctx.moveTo(rx + rippleOffset, y + 15);
        ctx.lineTo(rx + rippleOffset + 24, y + 15);
        ctx.stroke();
      }
    } else if (rowObj.type === 'rail') {
      ctx.fillStyle = '#2b2d42';
      ctx.fillRect(0, y, 450, ROW_H);

      // Wooden ties
      ctx.fillStyle = '#4a3728';
      for (let tx = 10; tx < 450; tx += 28) {
        ctx.fillRect(tx, y + 6, 12, ROW_H - 12);
      }

      // Steel tracks
      ctx.strokeStyle = '#8d99ae';
      ctx.lineWidth = 3.5;
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
      ctx.save();
      if (log.isLily) {
        // Lily Pad
        ctx.fillStyle = '#38b000';
        ctx.beginPath();
        ctx.arc(log.x + log.w / 2, cy, log.w / 2, 0.2, TAU - 0.2);
        ctx.lineTo(log.x + log.w / 2, cy);
        ctx.fill();

        ctx.fillStyle = '#ff70a6';
        ctx.beginPath();
        ctx.arc(log.x + log.w / 2, cy, 6, 0, TAU);
        ctx.fill();
      } else {
        // Wooden Log
        ctx.fillStyle = '#7f4f24';
        this.rr(ctx, log.x, topY + 7, log.w, ROW_H - 14, 8);
        ctx.fill();

        // Bark texture
        ctx.strokeStyle = '#582f0e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(log.x + 12, topY + 16); ctx.lineTo(log.x + log.w - 12, topY + 16);
        ctx.moveTo(log.x + 18, topY + 26); ctx.lineTo(log.x + log.w - 18, topY + 26);
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

      // Drop Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      this.rr(ctx, v.x + 2, vy + 4, v.w, v.h, 6);
      ctx.fill();

      // Vehicle Chassis
      ctx.fillStyle = v.col;
      this.rr(ctx, v.x, vy, v.w, v.h, 7);
      ctx.fill();

      // Windows
      ctx.fillStyle = '#0f172a';
      if (v.kind === 'doubleDecker') {
        this.rr(ctx, v.x + 8, vy + 6, v.w - 16, 10, 3);
        ctx.fill();
        this.rr(ctx, v.x + 8, vy + 20, v.w - 16, 10, 3);
        ctx.fill();
      } else {
        this.rr(ctx, v.x + 10, vy + 6, v.w - 20, v.h - 12, 4);
        ctx.fill();
      }

      // Headlights & Taillights
      const isRight = rowObj.dir === 1;
      ctx.fillStyle = '#ffe066'; // Headlights
      const hx = isRight ? v.x + v.w - 3 : v.x + 1;
      ctx.fillRect(hx, vy + 4, 3, 6);
      ctx.fillRect(hx, vy + v.h - 10, 3, 6);

      ctx.fillStyle = '#ff0054'; // Taillights
      const tx = isRight ? v.x + 1 : v.x + v.w - 3;
      ctx.fillRect(tx, vy + 4, 3, 6);
      ctx.fillRect(tx, vy + v.h - 10, 3, 6);

      ctx.restore();
    }
  }

  drawRailroad(ctx, rowObj) {
    const topY = rowTopY(rowObj.row);

    // Crossing Signal Pole
    ctx.save();
    ctx.fillStyle = '#495057';
    ctx.fillRect(18, topY + 4, 6, ROW_H - 8);

    if (rowObj.warning) {
      const flash = Math.sin(this.time * 16) > 0;
      ctx.fillStyle = flash ? '#ff0054' : '#333';
      ctx.beginPath(); ctx.arc(14, topY + 14, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = !flash ? '#ff0054' : '#333';
      ctx.beginPath(); ctx.arc(28, topY + 14, 5, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // High Speed Express Train
    if (rowObj.trainActive) {
      ctx.save();
      const tx = rowObj.trainX;
      const tw = 460;
      const th = 40;
      const ty = topY + (ROW_H - th) / 2;

      ctx.fillStyle = '#e63946';
      this.rr(ctx, tx, ty, tw, th, 8);
      ctx.fill();

      ctx.fillStyle = '#f1faee';
      ctx.fillRect(tx, ty + 12, tw, 8);

      // Windows
      ctx.fillStyle = '#1d3557';
      for (let wx = tx + 30; wx < tx + tw - 30; wx += 36) {
        ctx.fillRect(wx, ty + 8, 22, 12);
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

    // Solid obstacle trees / rocks
    for (const col of rowObj.obstacles) {
      const ox = col * TILE_W + HALF_TILE;
      const oy = cy;

      ctx.save();
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(ox, oy + 12, 18, 9, 0, 0, TAU);
      ctx.fill();

      // Tree trunk
      ctx.fillStyle = '#582f0e';
      ctx.fillRect(ox - 5, oy, 10, 14);

      // Glossy Pine Foliage Cone
      ctx.fillStyle = '#1b4332';
      ctx.beginPath();
      ctx.arc(ox, oy - 6, 17, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#2d6a4f';
      ctx.beginPath();
      ctx.arc(ox, oy - 11, 13, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  drawCoin(ctx, x, y) {
    ctx.save();
    const bob = Math.sin(this.time * 6) * 3;
    const squish = Math.cos(this.time * 5);

    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(x, y + bob, Math.abs(squish) * 10 + 2, 10, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.ellipse(x, y + bob, Math.abs(squish) * 6 + 1, 6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx) {
    const p = this.player;
    const hopArc = p.hopping ? Math.sin(p.hopT * Math.PI) * 18 : 0;
    const py = p.y - hopArc;

    // Ground Shadow under player
    ctx.save();
    const shadowScale = p.hopping ? 1 - Math.sin(p.hopT * Math.PI) * 0.4 : 1;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 12, 15 * shadowScale, 8 * shadowScale, 0, 0, TAU);
    ctx.fill();

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
      ctx.fillStyle = `rgba(20, 20, 30, ${0.3 + dangerRatio * 0.55})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 10, 35 * dangerRatio, 20 * dangerRatio, 0, 0, TAU);
      ctx.fill();

      // Wing silhouette
      ctx.strokeStyle = `rgba(15, 15, 25, ${0.35 + dangerRatio * 0.55})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - 55 * dangerRatio, p.y);
      ctx.quadraticCurveTo(p.x, p.y - 22 * dangerRatio, p.x + 55 * dangerRatio, p.y);
      ctx.stroke();
      ctx.restore();
    }

    // Swooping Seagull
    if (this.eagleSwooping) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(this.eagleX, this.eagleY, 26, 0, TAU);
      ctx.fill();

      // Giant Wings
      ctx.fillStyle = '#e5e5e5';
      ctx.beginPath();
      ctx.moveTo(this.eagleX - 65, this.eagleY - 15);
      ctx.lineTo(this.eagleX, this.eagleY + 10);
      ctx.lineTo(this.eagleX + 65, this.eagleY - 15);
      ctx.closePath();
      ctx.fill();

      // Yellow Beak
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.moveTo(this.eagleX - 8, this.eagleY + 22);
      ctx.lineTo(this.eagleX + 8, this.eagleY + 22);
      ctx.lineTo(this.eagleX, this.eagleY + 38);
      ctx.lineTo(this.eagleX, this.eagleY + 38);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawHUD(ctx, W, H) {
    ctx.save();

    // 1. Distance Counter Badge (Top Left)
    ctx.fillStyle = 'rgba(12, 16, 32, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    this.rr(ctx, 14, 106, 110, 34, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffd166';
    ctx.font = '900 14px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.maxDistance}m`, 69, 128);

    // 2. Coins Collected Badge (Top Right)
    ctx.fillStyle = 'rgba(12, 16, 32, 0.9)';
    this.rr(ctx, W - 110, 106, 96, 34, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffd166';
    ctx.font = '900 14px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🪙 ×${this.coins}`, W - 62, 128);

    // 3. Danger Warning & Bottom Creep Vignette
    const playerScreenY = this.player.y - this.cameraY;
    if (playerScreenY > 670 || this.idleTimer > this.maxIdle - 2.5) {
      const pulse = Math.sin(this.time * 8) > 0;
      const warnText = '⚠️ SEAGULL SWOOP INCOMING!';
      ctx.save();
      ctx.font = '900 12px Outfit, sans-serif';
      const tw = ctx.measureText(warnText).width;
      const bw = Math.max(240, Math.ceil(tw + 36));
      const bh = 32;
      const bx = (W - bw) / 2;
      const by = 148;

      ctx.fillStyle = pulse ? 'rgba(255, 0, 84, 0.95)' : 'rgba(255, 170, 0, 0.95)';
      ctx.shadowColor = pulse ? '#ff0054' : '#ffaa00';
      ctx.shadowBlur = 12;
      this.rr(ctx, bx, by, bw, bh, bh / 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
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
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
