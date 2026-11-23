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
  traceRoundRect,
} from '../engine/toyStyle.js';

const TAU = Math.PI * 2;
const COLS = 7;
const LEFT_WALL = 15;
const RIGHT_WALL = 435;
const PLAY_W = RIGHT_WALL - LEFT_WALL; // 420
const COL_W = PLAY_W / COLS; // 60
const BLOCK_W = 54;
const BLOCK_H = 40;
const TOP_ROW_Y = 120;
const ROW_H = 48;
const DANGER_Y = 650;
const CANNON_Y = 718;
const BALL_R = 5.2;
const BASE_SPEED = 740;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export class BlockBuster extends Game {
  static meta = {
    id: 'block-buster',
    title: 'Block Buster',
    icon: '💥',
    hint: 'DRAG to aim laser · RELEASE to fire ball stream · TAP for 2.5× TURBO!',
    baseLikes: 1940,
    isPrestige: false,
    parScore60s: 750,
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

    if (saved && saved.wave) {
      this.wave = saved.wave;
      this.ballCount = saved.ballCount || 15;
      this.cannonX = clamp(Number(saved.cannonX) || (LEFT_WALL + RIGHT_WALL) / 2, LEFT_WALL + 28, RIGHT_WALL - 28);
      this.targetCannonX = this.cannonX;
      if (saved.blocks && Array.isArray(saved.blocks) && saved.blocks.length > 0) {
        this.blocks = saved.blocks.map(b => ({
          ...b,
          w: b.w || BLOCK_W,
          h: b.h || BLOCK_H,
          pulse: 0,
          rot: 0,
        }));
      } else {
        this.spawnRow(0);
        this.spawnRow(1);
        this.spawnRow(2);
      }
    } else {
      // Starting board setup: 3 rows to get action started immediately
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
      blocks: this.blocks.map(b => ({
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
    return `Wave ${this.wave} · ⚪ ×${this.ballCount} · ${Math.round(this.score)} pts`;
  }

  /* ------------------------------------------------------------- Row Spawner */
  spawnRow(targetRow = 0) {
    // Pick 3 to 5 columns for standard numbered blocks
    const cols = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
    const count = 3 + Math.floor(Math.random() * 2); // 3 to 4 blocks
    const chosenCols = cols.slice(0, count);

    // Guaranteed +1 Ball ring in one of the remaining empty columns
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

      // Base HP scales with current wave + SSOT Prestige slope
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

    // Cannon glide lerp
    this.cannonX += (this.targetCannonX - this.cannonX) * Math.min(1, dt * 12);

    // Active lasers animation
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.t += dt;
      if (l.t >= l.maxT) {
        this.lasers.splice(i, 1);
      }
    }

    // Active shards
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 850 * dt;
      s.rot += s.vRot * dt;
      s.alpha -= dt * 1.8;
      if (s.alpha <= 0) this.shards.splice(i, 1);
    }

    // Block pulse decay & rotation
    for (const b of this.blocks) {
      if (b.pulse > 0) b.pulse = Math.max(0, b.pulse - dt * 5.0);
      if (b.type === 'plus') b.rot += dt * 3.2;
    }

    // State machine updates
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

    // Check tap on Turbo button (bottom right)
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

      // Drag aim: vector from touch toward cannon OR direct pointer aim
      // Direct drag from cannon up into arena
      const dx = p.x - this.cannonX;
      const dy = p.y - CANNON_Y;

      // Only allow aiming upward into the playfield
      if (dy < -18 || Math.abs(dx) > 10) {
        let ang = Math.atan2(dy, dx);
        // Clamp angle between -170 deg and -10 deg (upward hemisphere)
        const minAng = -Math.PI + 0.16;
        const maxAng = -0.16;
        ang = clamp(ang, minAng, maxAng);
        this.aimAngle = ang;
      }
    } else if (this.aiming) {
      // Touch released -> FIRE!
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

    // Tap during flight toggles 2.5x Turbo speed immediately
    if (this.input.pressed) {
      this.turbo = !this.turbo;
      this.sounds.tick();
      this.haptics.light();
    }

    // Auto-turbo after 6 seconds so rounds stay fast and exciting
    const speedMult = this.turbo || this.turnDuration > 5.5 ? 2.5 : 1.0;
    const simDt = dt * speedMult;

    // Stream firing balls one by one
    if (this.ballsToFire > 0) {
      this.fireTimer -= simDt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 0.042;
        this.ballsToFire--;
        const spd = BASE_SPEED;
        const vx = Math.cos(this.aimAngle) * spd;
        const vy = Math.sin(this.aimAngle) * spd;
        this.balls.push({
          x: this.cannonX,
          y: CANNON_Y - 10,
          vx,
          vy,
          active: true,
          returned: false,
          trail: [],
        });
      }
    }

    // Sub-step ball physics (3 sub-steps) for perfect high-speed collision accuracy
    const SUB_STEPS = 3;
    const subDt = simDt / SUB_STEPS;

    let activeCount = 0;

    for (let step = 0; step < SUB_STEPS; step++) {
      for (let i = 0; i < this.balls.length; i++) {
        const ball = this.balls[i];
        if (!ball.active) continue;

        ball.x += ball.vx * subDt;
        ball.y += ball.vy * subDt;

        // Left / Right Wall Collisions
        if (ball.x - BALL_R <= LEFT_WALL) {
          ball.x = LEFT_WALL + BALL_R;
          ball.vx = Math.abs(ball.vx);
          this.playWallBounce(ball.x, ball.y);
        } else if (ball.x + BALL_R >= RIGHT_WALL) {
          ball.x = RIGHT_WALL - BALL_R;
          ball.vx = -Math.abs(ball.vx);
          this.playWallBounce(ball.x, ball.y);
        }

        // Ceiling Collision
        if (ball.y - BALL_R <= TOP_ROW_Y - 24) {
          ball.y = TOP_ROW_Y - 24 + BALL_R;
          ball.vy = Math.abs(ball.vy);
          this.playWallBounce(ball.x, ball.y);
        }

        // Floor / Return Collision
        if (ball.y >= CANNON_Y) {
          ball.active = false;
          ball.returned = true;
          ball.y = CANNON_Y;

          // The very first ball to return sets the cannon's next position!
          if (this.nextCannonX === null) {
            this.nextCannonX = clamp(ball.x, LEFT_WALL + 28, RIGHT_WALL - 28);
            this.targetCannonX = this.nextCannonX;
            this.sounds.tick();
            this.haptics.light();
          }
          continue;
        }

        // Block Collisions
        this.checkBlockCollision(ball);
      }
    }

    // Count remaining active balls
    for (let i = 0; i < this.balls.length; i++) {
      if (this.balls[i].active) activeCount++;
    }

    // Check if turn complete
    if (this.ballsToFire <= 0 && activeCount === 0) {
      this.endTurn();
    }
  }

  playWallBounce(x, y) {
    if (this.sfxCooldown <= 0) {
      this.sfxCooldown = 0.035;
      this.sounds.tick();
    }
  }

  checkBlockCollision(ball) {
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      if (b.dead) continue;

      // Closest point on rectangle
      const bw = b.w || BLOCK_W;
      const bh = b.h || BLOCK_H;
      const cx = clamp(ball.x, b.x, b.x + bw);
      const cy = clamp(ball.y, b.y, b.y + bh);
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      const distSq = dx * dx + dy * dy;

      if (distSq < BALL_R * BALL_R) {
        // HIT DETECTED!
        if (b.type === 'plus') {
          // Extra ball pickup item
          b.dead = true;
          this.extraBallsCollected++;
          this.score += 50;
          this.fx.ring(b.x + b.w / 2, b.y + b.h / 2, '#00f5d4', 36, 0.4, 3);
          this.fx.text(b.x + b.w / 2, b.y - 10, '+1 BALL!', '#00f5d4', 16);
          this.sounds.up();
          this.haptics.medium();
          continue;
        }

        if (b.type === 'prism') {
          // Multi-ball prism splits this ball into 2 additional split rays!
          this.spawnSplitBalls(ball);
        }

        // Rebound reflection normal determination
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

        // Apply Damage
        b.hp--;
        b.pulse = 0.45;
        this.combo++;
        this.score += 15;

        // Pentatonic ascending chime
        if (this.sfxCooldown <= 0) {
          this.sfxCooldown = 0.025;
          this.sounds.blockPop(this.combo);
        }

        // Sparks
        this.fx.burst(cx, cy, this.getBlockColor(b), 4, 60, 0.25, 2.5);

        // Block destroyed!
        if (b.hp <= 0) {
          b.dead = true;
          this.onBlockDestroyed(b);
        }

        break; // Process one block collision per sub-step
      }
    }
  }

  spawnSplitBalls(parentBall) {
    if (this.balls.length > 250) return; // Prevent infinite runaway balls
    const baseAng = Math.atan2(parentBall.vy, parentBall.vx);
    const spd = Math.hypot(parentBall.vx, parentBall.vy);
    const spreads = [-0.35, 0.35];

    spreads.forEach(diff => {
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
    });

    this.sounds.laser();
    this.fx.ring(parentBall.x, parentBall.y, '#9b5de5', 40, 0.35, 3);
  }

  onBlockDestroyed(b) {
    const pts = b.maxHp * 25 + 50;
    this.score += pts;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    this.fx.burst(cx, cy, this.getBlockColor(b), 16, 140, 0.55, 4);
    this.fx.text(cx, cy - 12, `+${pts}`, '#ffd166', 18);
    this.sounds.shatter();
    this.haptics.medium();

    // Spawn polygon physics shards
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
        col: this.getBlockColor(b),
        alpha: 1.0,
      });
    }

    // Special Block Abilities:
    if (b.type === 'bomb') {
      // 3x3 Explosion: damages all surrounding blocks
      this.fx.burst(cx, cy, '#ff0054', 28, 220, 0.7, 5);
      this.fx.ring(cx, cy, '#ff0054', 160, 0.6, 5);
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
      // Horizontal laser beam clears entire row
      this.lasers.push({
        type: 'H',
        y: cy,
        t: 0,
        maxT: 0.3,
        x1: LEFT_WALL,
        x2: RIGHT_WALL,
        col: '#00f5d4',
      });
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
      // Vertical laser beam clears entire column
      this.lasers.push({
        type: 'V',
        x: cx,
        t: 0,
        maxT: 0.3,
        y1: TOP_ROW_Y - 20,
        y2: DANGER_Y + 20,
        col: '#ffbe0b',
      });
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

    // Filter dead blocks
    this.blocks = this.blocks.filter(b => !b.dead);

    // Add extra balls collected
    if (this.extraBallsCollected > 0) {
      this.ballCount += this.extraBallsCollected;
    }

    // Set cannon position to first returned ball position
    if (this.nextCannonX !== null) {
      this.targetCannonX = this.nextCannonX;
    }

    // Check if any block reaches the danger line (Failure condition!)
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
      this.fx.burst(this.cannonX, CANNON_Y, '#ff4b5c', 40, 300, 0.9, 6);
      this.fx.shake(16, 0.5);
      this.sounds.fail();
      this.haptics.heavy();
      return;
    }

    // Move all rows down by 1
    for (const b of this.blocks) {
      b.row++;
      b.y += ROW_H;
    }

    // Increment wave and spawn fresh top row
    this.wave++;
    this.spawnRow(0);

    // Wave Milestone fanfare
    if (this.wave % 5 === 0) {
      this.sounds.up();
      this.fx.text(this.W / 2, 260, `WAVE ${this.wave} REACHED! ⭐`, '#ffd166', 26, 1.8);
      this.fx.burst(this.W / 2, 260, '#ffd166', 24, 200, 0.8, 4);
    }

    this.state = 'aim';
  }

  updateAdvancing(dt) {
    // Transition back to aim mode
    this.state = 'aim';
  }

  /* ------------------------------------------------------------- Colors & Theming */
  getBlockColor(b) {
    if (b.type === 'bomb') return '#ff0054';
    if (b.type === 'laserH') return '#00f5d4';
    if (b.type === 'laserV') return '#ffbe0b';
    if (b.type === 'plus') return '#4cc9f0';
    if (b.type === 'prism') return '#9b5de5';

    // Normal blocks dynamically change hue based on remaining hit points
    const ratio = b.hp / Math.max(1, this.wave);
    if (ratio > 1.4) return '#7209b7'; // High HP royal purple
    if (ratio > 0.9) return '#3a86ff'; // Solid blue
    if (ratio > 0.5) return '#06d6a0'; // Fresh neon emerald
    if (ratio > 0.25) return '#ffd166'; // Amber yellow
    return '#ff4b5c'; // Critical low HP coral red
  }

  /* ------------------------------------------------------------- Render Engine */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    // 1. Vibrant Nintendo Toy Diorama Studio Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2e1065'); // Playful berry violet
    bg.addColorStop(0.5, '#3b0764'); // Rich plum
    bg.addColorStop(1, '#1e1b4b'); // Deep indigo base
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle studio dome radial key light behind the toy playboard
    const dome = ctx.createRadialGradient(W * 0.5, H * 0.34, 24, W * 0.5, H * 0.42, W * 0.78);
    dome.addColorStop(0, 'rgba(192, 132, 252, 0.22)');
    dome.addColorStop(0.6, 'rgba(99, 102, 241, 0.08)');
    dome.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = dome;
    ctx.fillRect(0, 0, W, H);

    // Recessed glossy playfield backing tray
    const boardTop = TOP_ROW_Y - 24;
    const boardH = DANGER_Y - TOP_ROW_Y + 44;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
    traceRoundRect(ctx, LEFT_WALL, boardTop, PLAY_W, boardH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Playfield Grid Guidelines (Soft subtle rounded track slots)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1.2;
    for (let c = 1; c < COLS; c++) {
      const x = LEFT_WALL + c * COL_W;
      ctx.beginPath();
      ctx.moveTo(x, TOP_ROW_Y - 16);
      ctx.lineTo(x, DANGER_Y + 8);
      ctx.stroke();
    }
    ctx.restore();

    // Outer Inflatable 3D Vinyl Candy Cushion Bumpers
    const drawSideBumper = (bx, bw) => {
      ctx.save();
      const by = TOP_ROW_Y - 24;
      const bh = DANGER_Y - TOP_ROW_Y + 44;
      const rim = toyRim('#ff85b3', 0.58);
      const lw = toyLineW(bw, 0.09, 1.0, 1.8);

      // Soft side drop shadow
      ctx.fillStyle = 'rgba(12, 20, 42, 0.34)';
      traceRoundRect(ctx, bx + 2, by + 4, bw, bh, 8);
      ctx.fill();

      // Volumetric cylindrical cushion body
      const cg = ctx.createLinearGradient(bx, by, bx + bw, by);
      cg.addColorStop(0, shadeColor('#ffafcc', 0.36));
      cg.addColorStop(0.45, '#ff85b3');
      cg.addColorStop(1, shadeColor('#ff85b3', -0.26));
      ctx.fillStyle = cg;
      traceRoundRect(ctx, bx, by, bw, bh, 8);
      ctx.fill();

      // Glossy white marshmallow cushion bands (clipped inside bumper)
      ctx.save();
      traceRoundRect(ctx, bx, by, bw, bh, 8);
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      for (let y = by + 8; y < by + bh - 14; y += 28) {
        traceRoundRect(ctx, bx + 1.5, y, bw - 3, 11, 4);
        ctx.fill();
      }
      // Left specular studio sheen along cushion edge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      traceRoundRect(ctx, bx + 1.5, by + 4, Math.max(2, bw * 0.28), bh - 8, 4);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = rim;
      ctx.lineWidth = lw;
      traceRoundRect(ctx, bx, by, bw, bh, 8);
      ctx.stroke();

      ctx.restore();
    };

    drawSideBumper(4, LEFT_WALL - 6);
    drawSideBumper(RIGHT_WALL + 2, W - RIGHT_WALL - 6);

    // Top bumper rail connecting both side cushions
    drawToyBevelRect(ctx, LEFT_WALL - 2, TOP_ROW_Y - 30, PLAY_W + 4, 8, 4, '#f472b6', {
      depth: 2,
      rimColor: toyRim('#f472b6', 0.56),
      lineWidth: 1.2,
      gloss: true,
    });

    // 3. Danger Hazard Threshold Line
    this.drawDangerLine(ctx);

    // 4. Draw Active Lasers
    this.drawLasers(ctx);

    // 5. Draw Blocks
    for (const b of this.blocks) {
      this.drawBlock(ctx, b);
    }

    // 6. Draw Falling Shards (3D beveled plastic toy chips)
    for (const s of this.shards) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.globalAlpha = clamp(s.alpha, 0, 1);
      const sg = ctx.createLinearGradient(-s.w / 2, -s.h / 2, s.w / 2, s.h / 2);
      sg.addColorStop(0, shadeColor(s.col, 0.35));
      sg.addColorStop(1, shadeColor(s.col, -0.2));
      ctx.fillStyle = sg;
      traceRoundRect(ctx, -s.w / 2, -s.h / 2, s.w, s.h, 2.5);
      ctx.fill();
      ctx.strokeStyle = toyRim(s.col, 0.58);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 7. Draw Active Aiming Trajectory Laser
    if (this.state === 'aim' && this.aiming) {
      this.drawAimGuide(ctx);
    }

    // 8. Draw Flying Balls
    for (const ball of this.balls) {
      if (!ball.active) continue;
      this.drawBall(ctx, ball);
    }

    // 9. Draw Bottom Cannon Turret with Captain Jellybean!
    this.drawCannonTurret(ctx);

    // 10. FX Render
    this.fx.render(ctx, 1.0);

    // 11. HUD Header & Turbo Toggle Button
    this.drawHUD(ctx, W, H);
  }

  drawDangerLine(ctx) {
    const pulse = 0.5 + Math.sin(this.time * 6) * 0.3;
    ctx.save();

    // Tactile 3D beveled safety hazard ribbon
    const ribbonH = 11;
    const ry = DANGER_Y - ribbonH / 2;
    const ribbonW = RIGHT_WALL - LEFT_WALL;
    const amberRim = toyRim('#f59e0b', 0.62);

    // Bottom depth lip
    ctx.fillStyle = shadeColor('#f59e0b', -0.36);
    traceRoundRect(ctx, LEFT_WALL, ry + 2.5, ribbonW, ribbonH, 5);
    ctx.fill();

    // Sunny yellow gradient bar
    const yg = ctx.createLinearGradient(0, ry, 0, ry + ribbonH);
    yg.addColorStop(0, '#fde047');
    yg.addColorStop(1, '#f59e0b');
    ctx.fillStyle = yg;
    traceRoundRect(ctx, LEFT_WALL, ry, ribbonW, ribbonH, 5);
    ctx.fill();

    // Clipped diagonal slate hazard stripes + top gloss
    ctx.save();
    traceRoundRect(ctx, LEFT_WALL, ry, ribbonW, ribbonH, 5);
    ctx.clip();
    ctx.fillStyle = '#1e293b';
    for (let x = LEFT_WALL - 10; x < RIGHT_WALL; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, ry + ribbonH);
      ctx.lineTo(x + 8, ry);
      ctx.lineTo(x + 14, ry);
      ctx.lineTo(x + 6, ry + ribbonH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.fillRect(LEFT_WALL + 2, ry + 1, ribbonW - 4, 2.5);
    ctx.restore();

    ctx.strokeStyle = amberRim;
    ctx.lineWidth = 1.4;
    traceRoundRect(ctx, LEFT_WALL, ry, ribbonW, ribbonH, 5);
    ctx.stroke();

    // Hazard Badge Callout (3D pill card)
    const badgeColor = pulse > 0.55 ? '#ff0054' : '#f43f5e';
    drawToyBevelRect(ctx, RIGHT_WALL - 152, ry - 21, 146, 18, 9, badgeColor, {
      depth: 2.5,
      rimColor: toyRim('#f43f5e', 0.62),
      lineWidth: 1.3,
      gloss: true,
    });

    ctx.font = "700 9.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.6;
    ctx.strokeText('⚠️ DANGER BOUNDARY', RIGHT_WALL - 79, ry - 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('⚠️ DANGER BOUNDARY', RIGHT_WALL - 79, ry - 12);
    ctx.restore();
  }

  drawLasers(ctx) {
    ctx.save();
    for (const l of this.lasers) {
      const alpha = 1 - l.t / l.maxT;
      ctx.lineCap = 'round';
      ctx.globalAlpha = clamp(alpha * 0.42, 0, 1);
      ctx.strokeStyle = l.col;
      ctx.lineWidth = 20 * alpha;
      ctx.beginPath();
      if (l.type === 'H') {
        ctx.moveTo(l.x1, l.y);
        ctx.lineTo(l.x2, l.y);
      } else {
        ctx.moveTo(l.x, l.y1);
        ctx.lineTo(l.x, l.y2);
      }
      ctx.stroke();

      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.strokeStyle = l.col;
      ctx.lineWidth = 10 * alpha;
      ctx.stroke();

      // White inner core
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
    ctx.strokeStyle = 'rgba(37, 230, 255, 0.35)';
    ctx.lineWidth = 6;
    ctx.setLineDash([7, 9]);
    ctx.lineDashOffset = -this.time * 44;

    ctx.beginPath();
    ctx.moveTo(rx, ry);

    // Trace ray forward until hitting wall or ceiling
    let maxDist = 700;
    while (maxDist > 0) {
      // Find distance to left or right wall
      const targetWallX = vx < 0 ? LEFT_WALL + BALL_R : RIGHT_WALL - BALL_R;
      const distToWallX = (targetWallX - rx) / vx;

      // Find distance to ceiling
      const distToCeil = (TOP_ROW_Y - 20 + BALL_R - ry) / vy;

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

      // Ricochet bounce!
      if (stepDist === distToWallX) {
        vx = -vx; // Bounce off wall
      } else {
        vy = -vy; // Bounce off ceiling
      }
    }

    ctx.stroke();
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.setLineDash([]);

    // Glossy 3D toy target bead at bounce/impact tip
    ctx.fillStyle = 'rgba(37, 230, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(rx, ry, 10, 0, TAU);
    ctx.fill();
    drawToySphere(ctx, rx, ry, 6, '#25e6ff', { rimColor: '#0369a1', lineWidth: 1.2, shine: 0.85 });

    ctx.restore();
  }

  drawBall(ctx, ball) {
    // Soft cyan energy aura + glossy 3D marble sphere
    ctx.save();
    ctx.fillStyle = 'rgba(37, 230, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R * 1.45, 0, TAU);
    ctx.fill();
    ctx.restore();
    drawToySphere(ctx, ball.x, ball.y, BALL_R, '#e0f2fe', {
      rimColor: '#0284c7',
      lineWidth: 1.0,
      shine: 0.9,
      bottomBounce: false,
    });
  }

  drawBlock(ctx, b) {
    const scale = 1.0 + (b.pulse || 0) * 0.15;
    const bw = (b.w || BLOCK_W) * scale;
    const bh = (b.h || BLOCK_H) * scale;
    const bx = Number.isFinite(b.x) ? b.x : LEFT_WALL;
    const by = Number.isFinite(b.y) ? b.y : TOP_ROW_Y;
    const cx = bx + (b.w || BLOCK_W) / 2;
    const cy = by + (b.h || BLOCK_H) / 2;
    const x = cx - bw / 2;
    const y = cy - bh / 2;

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(bw) || !Number.isFinite(bh)) {
      return;
    }

    ctx.save();

    if (b.type === 'plus') {
      // Rotating 3D Vinyl Mint +1 Ball Token Orb
      const pulse = 1 + Math.sin(this.time * 5 + cx) * 0.06;
      drawToyShadow(ctx, cx, cy + 16, 13, 4.5, 0.25);

      ctx.fillStyle = 'rgba(0, 245, 212, 0.22)';
      ctx.beginPath();
      ctx.arc(cx, cy, 20 * pulse, 0, TAU);
      ctx.fill();

      ctx.translate(cx, cy);
      ctx.rotate(b.rot);
      drawToySphere(ctx, 0, 0, 15, '#2dd4bf', {
        rimColor: toyRim('#0d9488', 0.56),
        lineWidth: 1.4,
        shine: 0.78,
      });

      // Crisp embossed white + icon with dark teal outline
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#064e3b';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(-6.5, 0); ctx.lineTo(6.5, 0);
      ctx.moveTo(0, -6.5); ctx.lineTo(0, 6.5);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(-6.5, 0); ctx.lineTo(6.5, 0);
      ctx.moveTo(0, -6.5); ctx.lineTo(0, 6.5);
      ctx.stroke();

      ctx.restore();
      return;
    }

    const col = this.getBlockColor(b);
    const rim = toyRim(col, 0.58);
    const lw = toyLineW(Math.min(bw, bh), 0.044, 1.0, 1.85);

    // Subtle grounding shadow under block
    drawToyShadow(ctx, cx, y + bh + 4, bw * 0.45, 5, 0.22);

    // Volumetric 3D Extruded Vinyl Toy Block
    drawToyBevelRect(ctx, x, y, bw, bh, 9, col, {
      depth: 4.5,
      rimColor: rim,
      lineWidth: lw,
      gloss: true,
    });

    // Special block accents & specular crystal facets
    if (b.type === 'prism') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.moveTo(cx, y + 4);
      ctx.lineTo(x + bw - 6, cy);
      ctx.lineTo(cx, y + bh - 4);
      ctx.lineTo(x + 6, cy);
      ctx.closePath();
      ctx.fill();
    } else if (b.type === 'laserH') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      traceRoundRect(ctx, x + 4, cy - 3, 6, 6, 3);
      ctx.fill();
      traceRoundRect(ctx, x + bw - 10, cy - 3, 6, 6, 3);
      ctx.fill();
    } else if (b.type === 'laserV') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      traceRoundRect(ctx, cx - 3, y + 4, 6, 6, 3);
      ctx.fill();
      traceRoundRect(ctx, cx - 3, y + bh - 10, 6, 6, 3);
      ctx.fill();
    }

    // Impact hit-flash glint
    if (b.pulse > 0.08) {
      ctx.fillStyle = `rgba(255, 255, 255, ${clamp(b.pulse * 0.7, 0, 0.38)})`;
      traceRoundRect(ctx, x + 1, y + 1, bw - 2, bh - 2, 8);
      ctx.fill();
    }

    // Inner icon & crisp outlined Toy Typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    if (b.type === 'bomb' || b.type === 'laserH' || b.type === 'laserV' || b.type === 'prism') {
      const icon = b.type === 'bomb' ? '💣' : (b.type === 'laserH' ? '⚡' : (b.type === 'laserV' ? '↕️' : '💎'));
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(icon, cx, cy - 6);

      ctx.font = "800 11.5px 'Fredoka', 'Outfit', sans-serif";
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3.0;
      ctx.strokeText(String(b.hp), cx, cy + 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(b.hp), cx, cy + 10);
    } else {
      ctx.font = "800 17px 'Fredoka', 'Outfit', sans-serif";
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3.4;
      ctx.strokeText(String(b.hp), cx, cy + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(b.hp), cx, cy + 1);
    }

    ctx.restore();
  }

  drawCannonTurret(ctx) {
    const cx = this.cannonX;
    const cy = CANNON_Y;

    ctx.save();

    // Grounding shadow under turret mount
    drawToyShadow(ctx, cx, cy + 24, 42, 9, 0.32);

    // 1. Tactile 3D Vinyl Metallic Turret Platform
    drawToyBevelRect(ctx, cx - 38, cy + 2, 76, 22, 11, '#334155', {
      depth: 4,
      rimColor: '#0f172a',
      lineWidth: 1.6,
      gloss: true,
    });
    drawToySphere(ctx, cx - 26, cy + 13, 3.5, '#38bdf8', { rimColor: '#0f172a', lineWidth: 1.0 });
    drawToySphere(ctx, cx + 26, cy + 13, 3.5, '#38bdf8', { rimColor: '#0f172a', lineWidth: 1.0 });

    // 2. Aiming Cannon Barrel pivoting toward aimAngle
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.aimAngle + Math.PI / 2);

    // 3D Chrome Cannon Barrel with rim highlight
    const barrelGrad = ctx.createLinearGradient(-11, 0, 11, 0);
    barrelGrad.addColorStop(0, '#475569');
    barrelGrad.addColorStop(0.35, '#f1f5f9');
    barrelGrad.addColorStop(0.75, '#94a3b8');
    barrelGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = barrelGrad;
    traceRoundRect(ctx, -10.5, -39, 21, 37, 6);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Glossy Cyan 3D Muzzle Collar
    drawToyPill(ctx, -13, -43, 26, 8, '#25e6ff', {
      rimColor: '#0284c7',
      lineWidth: 1.3,
      gloss: true,
    });
    ctx.restore();

    // 3. Captain Jellybean operating the cannon!
    drawBean(ctx, cx, cy - 4, 32, {
      ufo: false,
      color: '#25e6ff',
      bellyColor: '#ffd166',
      walkT: this.time * 2.5,
      squash: 1,
      dir: Math.cos(this.aimAngle) < 0 ? -1 : 1,
      eyes: this.state === 'firing' ? 'bright' : 'happy',
      hat: 'crown',
    });

    // 4. Ball count badge directly above cannon (3D Pill Card)
    if (this.state === 'aim') {
      drawToyBevelRect(ctx, cx - 32, cy - 50, 64, 22, 11, '#1e293b', {
        depth: 2.5,
        rimColor: '#38bdf8',
        lineWidth: 1.5,
        gloss: false,
      });

      ctx.font = "700 12px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.strokeText(`⚪ ×${this.ballCount}`, cx, cy - 39);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`⚪ ×${this.ballCount}`, cx, cy - 39);
    }

    ctx.restore();
  }

  drawHUD(ctx, W, H) {
    ctx.save();

    // 1. Wave Badge (Top Left) — 3D Beveled Toy HUD Card
    drawToyBevelRect(ctx, 14, 106, 94, 34, 11, '#1e293b', {
      depth: 3,
      rimColor: '#475569',
      lineWidth: 1.6,
      gloss: false,
    });

    ctx.font = "700 14px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.8;
    ctx.strokeText(`WAVE ${this.wave}`, 61, 123);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`WAVE ${this.wave}`, 61, 123);

    // 2. Score Badge (Top Right) — 3D Beveled Toy HUD Card
    drawToyBevelRect(ctx, W - 142, 106, 128, 34, 11, '#1e293b', {
      depth: 3,
      rimColor: '#475569',
      lineWidth: 1.6,
      gloss: false,
    });

    ctx.textAlign = 'right';
    ctx.strokeText(`${Math.round(this.score)} PTS`, W - 26, 123);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${Math.round(this.score)} PTS`, W - 26, 123);

    // 3. Fast-Forward Turbo Toggle Button (Bottom Right)
    const isFast = this.turbo || this.turnDuration > 5.5;
    drawToyBevelRect(ctx, W - 88, H - 54, 74, 32, 11, isFast ? '#f43f5e' : '#334155', {
      depth: 3,
      rimColor: isFast ? '#ffd166' : '#0f172a',
      lineWidth: 1.8,
      gloss: true,
    });

    ctx.font = "700 12px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.strokeText(isFast ? '⚡ 2.5×' : '⚡ 1.0×', W - 51, H - 38);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(isFast ? '⚡ 2.5×' : '⚡ 1.0×', W - 51, H - 38);

    // Combo Callout
    if (this.combo > 15) {
      const alpha = Math.min(1, this.combo / 40);
      ctx.globalAlpha = alpha;
      ctx.font = "700 15px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3.2;
      ctx.strokeText(`🔥 ${this.combo} COMBO!`, W / 2, 123);
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`🔥 ${this.combo} COMBO!`, W / 2, 123);
    }

    ctx.restore();
  }

  rr(ctx, x, y, w, h, r) {
    traceRoundRect(ctx, x, y, w, h, r);
  }
}
