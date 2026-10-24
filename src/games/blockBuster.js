import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

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
      this.cannonX = saved.cannonX ?? this.cannonX;
      this.targetCannonX = this.cannonX;
      if (saved.blocks && Array.isArray(saved.blocks)) {
        this.blocks = saved.blocks.map(b => ({ ...b }));
      } else {
        this.spawnRow(0);
        this.spawnRow(1);
      }
    } else {
      // Starting board setup: 2 rows to get action started immediately
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

      // Base HP scales with current wave
      const isHard = Math.random() < 0.25;
      const baseHp = isHard ? Math.round(this.wave * 1.8) : this.wave;
      const hp = Math.max(1, baseHp);

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
    if (p.justDown && p.x > this.W - 90 && p.y > this.H - 56) {
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
    if (this.input.justDown) {
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
      const cx = clamp(ball.x, b.x, b.x + b.w);
      const cy = clamp(ball.y, b.y, b.y + b.h);
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

    // 1. Sleek Arcade Deep Blue Gradient Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0d1a');
    bg.addColorStop(0.5, '#0e1224');
    bg.addColorStop(1, '#080a14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 2. Playfield Grid Guidelines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      const x = LEFT_WALL + c * COL_W;
      ctx.beginPath();
      ctx.moveTo(x, TOP_ROW_Y - 20);
      ctx.lineTo(x, DANGER_Y + 10);
      ctx.stroke();
    }

    // Outer Neon Arena Walls
    ctx.strokeStyle = 'rgba(76, 201, 240, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(LEFT_WALL, TOP_ROW_Y - 20);
    ctx.lineTo(LEFT_WALL, DANGER_Y + 20);
    ctx.moveTo(RIGHT_WALL, TOP_ROW_Y - 20);
    ctx.lineTo(RIGHT_WALL, DANGER_Y + 20);
    ctx.stroke();

    // 3. Danger Hazard Threshold Line
    this.drawDangerLine(ctx);

    // 4. Draw Active Lasers
    this.drawLasers(ctx);

    // 5. Draw Blocks
    for (const b of this.blocks) {
      this.drawBlock(ctx, b);
    }

    // 6. Draw Falling Shards
    for (const s of this.shards) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = s.col;
      ctx.globalAlpha = s.alpha;
      ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
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
    ctx.strokeStyle = `rgba(255, 0, 84, ${0.4 + pulse * 0.4})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(LEFT_WALL, DANGER_Y);
    ctx.lineTo(RIGHT_WALL, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = `rgba(255, 0, 84, ${0.7 + pulse * 0.3})`;
    ctx.font = '900 10px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('⚠️ DANGER BOUNDARY', RIGHT_WALL - 8, DANGER_Y - 6);
    ctx.restore();
  }

  drawLasers(ctx) {
    ctx.save();
    for (const l of this.lasers) {
      const alpha = 1 - l.t / l.maxT;
      ctx.strokeStyle = l.col;
      ctx.shadowColor = l.col;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 14 * alpha;
      ctx.beginPath();
      if (l.type === 'H') {
        ctx.moveTo(l.x1, l.y);
        ctx.lineTo(l.x2, l.y);
      } else {
        ctx.moveTo(l.x, l.y1);
        ctx.lineTo(l.x, l.y2);
      }
      ctx.stroke();

      // White inner core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4 * alpha;
      ctx.beginPath();
      if (l.type === 'H') {
        ctx.moveTo(l.x1, l.y);
        ctx.lineTo(l.x2, l.y);
      } else {
        ctx.moveTo(l.x, l.y1);
        ctx.lineTo(l.x, l.y2);
      }
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

    ctx.strokeStyle = '#25e6ff';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -this.time * 40;

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
    ctx.setLineDash([]);

    // Glowing impact tip indicator
    ctx.fillStyle = '#25e6ff';
    ctx.shadowColor = '#25e6ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(rx, ry, 6, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  drawBall(ctx, ball) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#25e6ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, TAU);
    ctx.fill();

    // Specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(ball.x - BALL_R * 0.3, ball.y - BALL_R * 0.3, BALL_R * 0.45, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawBlock(ctx, b) {
    const scale = 1.0 + (b.pulse || 0) * 0.15;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const bw = b.w * scale;
    const bh = b.h * scale;
    const x = cx - bw / 2;
    const y = cy - bh / 2;

    ctx.save();

    if (b.type === 'plus') {
      // Rotating Glowing +1 Ball Ring Orb
      ctx.translate(cx, cy);
      ctx.rotate(b.rot);
      ctx.fillStyle = '#00f5d4';
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, TAU);
      ctx.fill();

      // Inner icon +
      ctx.strokeStyle = '#051923';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
      ctx.moveTo(0, -7); ctx.lineTo(0, 7);
      ctx.stroke();

      ctx.restore();
      return;
    }

    const col = this.getBlockColor(b);

    // Beveled glossy rounded rectangle
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = b.pulse > 0 ? 16 : 6;
    this.rr(ctx, x, y, bw, bh, 8);
    ctx.fill();

    // 3D Glass Specular Top Highlight
    const gloss = ctx.createLinearGradient(x, y, x, y + bh * 0.5);
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    gloss.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = gloss;
    this.rr(ctx, x + 2, y + 2, bw - 4, bh * 0.48, 6);
    ctx.fill();

    // Thick black cartoon border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.8;
    this.rr(ctx, x, y, bw, bh, 8);
    ctx.stroke();

    // Inner icon / text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (b.type === 'bomb') {
      ctx.font = '18px sans-serif';
      ctx.fillText('💣', cx, cy - 2);
      ctx.font = '900 11px Outfit, sans-serif';
      ctx.fillText(b.hp, cx, cy + 12);
    } else if (b.type === 'laserH') {
      ctx.font = '16px sans-serif';
      ctx.fillText('⚡', cx, cy - 3);
      ctx.font = '900 11px Outfit, sans-serif';
      ctx.fillText(b.hp, cx, cy + 11);
    } else if (b.type === 'laserV') {
      ctx.font = '16px sans-serif';
      ctx.fillText('↕️', cx, cy - 3);
      ctx.font = '900 11px Outfit, sans-serif';
      ctx.fillText(b.hp, cx, cy + 11);
    } else if (b.type === 'prism') {
      ctx.font = '16px sans-serif';
      ctx.fillText('💎', cx, cy - 3);
      ctx.font = '900 11px Outfit, sans-serif';
      ctx.fillText(b.hp, cx, cy + 11);
    } else {
      ctx.font = '900 17px Outfit, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(b.hp, cx, cy + 1);
    }

    ctx.restore();
  }

  drawCannonTurret(ctx) {
    const cx = this.cannonX;
    const cy = CANNON_Y;

    ctx.save();

    // 1. Sleek metallic base plate
    ctx.fillStyle = '#1b263b';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    this.rr(ctx, cx - 36, cy + 2, 72, 22, 10);
    ctx.fill();
    ctx.stroke();

    // 2. Aiming Cannon Barrel pivoting toward aimAngle
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.aimAngle + Math.PI / 2);

    // Chrome cannon barrel
    const barrelGrad = ctx.createLinearGradient(-10, 0, 10, 0);
    barrelGrad.addColorStop(0, '#415a77');
    barrelGrad.addColorStop(0.5, '#e0e1dd');
    barrelGrad.addColorStop(1, '#1b263b');
    ctx.fillStyle = barrelGrad;
    this.rr(ctx, -10, -38, 20, 36, 5);
    ctx.fill();

    // Neon muzzle ring
    ctx.fillStyle = '#25e6ff';
    ctx.shadowColor = '#25e6ff';
    ctx.shadowBlur = 10;
    this.rr(ctx, -12, -41, 24, 7, 3);
    ctx.fill();
    ctx.restore();

    // 3. Captain Jellybean operating the cannon!
    drawBean(ctx, cx, cy - 4, 32, {
      ufo: false,
      color: '#25e6ff',
      bellyColor: '#ffd166',
      walkT: this.time * 2.5,
      squash: 1,
      dir: Math.cos(this.aimAngle) < 0 ? -1 : 1,
      eyes: this.state === 'firing' ? 'squish' : 'happy',
      hat: 'crown',
    });

    // 4. Ball count badge directly above cannon
    if (this.state === 'aim') {
      ctx.fillStyle = 'rgba(12, 16, 32, 0.9)';
      ctx.strokeStyle = '#25e6ff';
      ctx.lineWidth = 1.5;
      this.rr(ctx, cx - 30, cy - 48, 60, 22, 11);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`⚪ ×${this.ballCount}`, cx, cy - 33);
    }

    ctx.restore();
  }

  drawHUD(ctx, W, H) {
    ctx.save();

    // 1. Wave Badge (Top Left)
    ctx.fillStyle = 'rgba(12, 16, 32, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    this.rr(ctx, 14, 106, 92, 34, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffd166';
    ctx.font = '900 14px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${this.wave}`, 60, 128);

    // 2. Score Badge (Top Right)
    ctx.fillStyle = 'rgba(12, 16, 32, 0.88)';
    this.rr(ctx, W - 140, 106, 126, 34, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#25e6ff';
    ctx.font = '900 14px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(this.score)} PTS`, W - 26, 128);

    // 3. Fast-Forward Turbo Toggle Button (Bottom Right)
    const isFast = this.turbo || this.turnDuration > 5.5;
    ctx.fillStyle = isFast ? '#ff0054' : 'rgba(20, 26, 48, 0.88)';
    ctx.strokeStyle = isFast ? '#ffbe0b' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    this.rr(ctx, W - 88, H - 54, 74, 32, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 12px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isFast ? '⚡ 2.5×' : '⚡ 1.0×', W - 51, H - 34);

    // Combo Callout
    if (this.combo > 15) {
      const alpha = Math.min(1, this.combo / 40);
      ctx.fillStyle = `rgba(255, 209, 102, ${alpha})`;
      ctx.font = '900 15px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🔥 ${this.combo} COMBO!`, W / 2, 128);
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
