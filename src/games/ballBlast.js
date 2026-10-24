import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';

const TAU = Math.PI * 2;
const GROUND_Y = 660;
const GRAVITY = 720; // px/s^2

// Ball Tiers: 4 = Mega, 3 = Large, 2 = Medium, 1 = Small
const BALL_TIERS = {
  4: { radius: 38, bounceH: 420, baseHp: 48,  color: '#ef233c', dark: '#d90429', stroke: '#ff85a1', name: 'Mega' },
  3: { radius: 28, bounceH: 360, baseHp: 24,  color: '#f77f00', dark: '#d62828', stroke: '#fcbf49', name: 'Large' },
  2: { radius: 20, bounceH: 300, baseHp: 12,  color: '#06d6a0', dark: '#049669', stroke: '#90e0ef', name: 'Medium' },
  1: { radius: 14, bounceH: 240, baseHp: 6,   color: '#7209b7', dark: '#560bad', stroke: '#b5179e', name: 'Small' },
};

export class BallBlast extends Game {
  static meta = {
    id: 'ball-blast',
    title: 'Ball Blast',
    icon: '💣',
    hint: 'DRAG left & right to DODGE bouncing boulders · BLAST them into pieces & COLLECT gold!',
    baseLikes: 8940,
    roundLen: 90,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    this.wave = saved?.wave || 1;
    this.coins = saved?.coins || 0;
    this.totalPops = saved?.totalPops || 0;

    // Upgrades
    this.upgrades = {
      damage: saved?.upgrades?.damage || 1, // Damage per bullet
      fireRate: saved?.upgrades?.fireRate || 1, // 1..8
      barrels: saved?.upgrades?.barrels || 1, // 1..4 (single, double, triple, quad)
    };

    // Cannon Physics
    this.cannonX = this.W / 2;
    this.cannonY = GROUND_Y - 14;
    this.cannonVx = 0;
    this.targetX = this.W / 2;
    this.cannonRecoil = 0;
    this.wheelRotation = 0;
    this.fireTimer = 0;

    // Powerup Timers
    this.freezeTimer = 0;
    this.laserTimer = 0;
    this.shieldActive = false;

    // Entities
    this.balls = [];
    this.bullets = [];
    this.droppedCoins = [];
    this.powerups = [];
    this.waveSpawnTimer = 0;
    this.waveRemainingBalls = 0;

    // Keyboard support
    this.keys = { left: false, right: false };
    this.keyHandler = (e) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') this.keys.left = e.type === 'keydown';
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') this.keys.right = e.type === 'keydown';
    };
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('keyup', this.keyHandler);

    // Start initial wave
    this.startWave(this.wave);
  }

  destroy() {
    window.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('keyup', this.keyHandler);
  }

  getFireInterval() {
    // 0.12s down to 0.045s
    return Math.max(0.045, 0.12 - (this.upgrades.fireRate - 1) * 0.012);
  }

  startWave(w) {
    this.wave = w;
    this.sounds.whoosh();
    this.haptics.light();
    this.fx.text(this.W / 2, 260, `WAVE ${w}!`, '#ffd166', 32, 1.4);

    // Spawn wave balls
    const ballCount = 2 + Math.min(6, Math.floor(w * 0.7));
    this.waveRemainingBalls = ballCount;
    this.waveSpawnQueue = [];

    for (let i = 0; i < ballCount; i++) {
      const tier = i === 0 && w >= 3 ? 4 : w >= 2 ? 3 : 2;
      const baseHp = BALL_TIERS[tier].baseHp + (w - 1) * 16;
      this.waveSpawnQueue.push({
        tier,
        hp: Math.round(baseHp * (0.8 + Math.random() * 0.4)),
        delay: i * 2.2,
      });
    }
  }

  update(dtRaw) {
    const dt = Math.min(dtRaw, 0.05);
    this.fx.update(dt);

    if (this.dead) return;

    // Power-up countdowns
    if (this.freezeTimer > 0) this.freezeTimer -= dt;
    if (this.laserTimer > 0) this.laserTimer -= dt;

    // Wave Spawner
    this.waveSpawnTimer += dt;
    while (this.waveSpawnQueue.length > 0 && this.waveSpawnQueue[0].delay <= this.waveSpawnTimer) {
      const item = this.waveSpawnQueue.shift();
      this.spawnBall(item.tier, item.hp);
    }

    // Check for Wave Clear
    if (this.balls.length === 0 && this.waveSpawnQueue.length === 0) {
      this.onWaveCleared();
    }

    // Handle Input & Cannon Movement
    this.updateCannon(dt);

    // Update Auto-Firing
    this.updateFiring(dt);

    // Update Bullets
    this.updateBullets(dt);

    // Update Bouncing Balls Physics
    this.updateBalls(dt);

    // Update Falling Coins & Magnetization
    this.updateCoins(dt);

    // Update Powerup Pickups
    this.updatePowerups(dt);
  }

  onWaveCleared() {
    this.sounds.survive();
    this.haptics.success();
    const bonusCoins = 50 + this.wave * 25;
    this.coins += bonusCoins;
    this.score += 500 + this.wave * 150;

    this.fx.text(this.W / 2, 270, 'WAVE CLEARED! ⭐', '#ffd166', 30, 1.5);
    this.fx.text(this.W / 2, 310, `+$${bonusCoins} BONUS`, '#06d6a0', 22, 1.5);
    for (let i = 0; i < 4; i++) {
      this.fx.burst(100 + i * 80, 260, '#ffd166', 14, 160, 0.6, 3);
    }

    this.waveSpawnTimer = 0;
    setTimeout(() => {
      if (!this.dead) this.startWave(this.wave + 1);
    }, 1500);
  }

  spawnBall(tier, hp, x = null, y = null, vx = null) {
    const proto = BALL_TIERS[tier];
    const spawnX = x !== null ? x : 40 + Math.random() * (this.W - 80);
    const spawnY = y !== null ? y : 120 + Math.random() * 40;
    const initialVx = vx !== null ? vx : (Math.random() < 0.5 ? -1 : 1) * (85 + Math.random() * 55);

    this.balls.push({
      tier,
      r: proto.radius,
      bounceH: proto.bounceH,
      hp,
      maxHp: hp,
      color: proto.color,
      dark: proto.dark,
      stroke: proto.stroke,
      x: spawnX,
      y: spawnY,
      vx: initialVx,
      vy: 0,
      hitFlash: 0,
      scale: 1.0,
      rotation: Math.random() * TAU,
      rotSpeed: (Math.random() - 0.5) * 2,
    });
  }

  updateCannon(dt) {
    // 1. Touch / Mouse Follow
    if (this.input.down) {
      this.targetX = Math.max(32, Math.min(this.W - 32, this.input.x));
    }

    // 2. Keyboard Follow
    if (this.keys.left) this.targetX = Math.max(32, this.targetX - 420 * dt);
    if (this.keys.right) this.targetX = Math.min(this.W - 32, this.targetX + 420 * dt);

    // Smooth movement interpolation
    const prevX = this.cannonX;
    const dx = this.targetX - this.cannonX;
    this.cannonX += dx * Math.min(1.0, 18 * dt);

    // Roll wheels based on distance moved
    const moved = this.cannonX - prevX;
    this.wheelRotation += moved * 0.12;

    // Recoil spring recovery
    if (this.cannonRecoil > 0) {
      this.cannonRecoil = Math.max(0, this.cannonRecoil - dt * 25);
    }

    // Check Bottom Upgrade Buttons Click
    if (this.input.pressed && this.input.y >= 670 && this.input.y <= 708) {
      this.handleUpgradeClick(this.input.x);
    }
  }

  handleUpgradeClick(x) {
    const colW = (this.W - 24) / 3;
    const col = Math.floor((x - 12) / colW);

    if (col === 0) {
      // Upgrade Damage
      const cost = 40 + this.upgrades.damage * 35;
      if (this.coins >= cost) {
        this.coins -= cost;
        this.upgrades.damage++;
        this.sounds.upgrade();
        this.haptics.success();
        this.fx.burst(12 + colW * 0.5, 680, '#ffd166', 12, 120, 0.4, 2.5);
        this.fx.text(this.cannonX, this.cannonY - 40, `DAMAGE UP! ⭐`, '#ffd166', 18, 0.8);
      } else {
        this.sounds.fail();
      }
    } else if (col === 1) {
      // Upgrade Fire Speed
      const cost = 40 + this.upgrades.fireRate * 35;
      if (this.coins >= cost && this.upgrades.fireRate < 8) {
        this.coins -= cost;
        this.upgrades.fireRate++;
        this.sounds.upgrade();
        this.haptics.success();
        this.fx.burst(12 + colW * 1.5, 680, '#ffd166', 12, 120, 0.4, 2.5);
        this.fx.text(this.cannonX, this.cannonY - 40, `FIRE RATE UP! ⚡`, '#00b4d8', 18, 0.8);
      } else {
        this.sounds.fail();
      }
    } else if (col === 2) {
      // Upgrade Barrels
      const cost = 120 * this.upgrades.barrels;
      if (this.coins >= cost && this.upgrades.barrels < 4) {
        this.coins -= cost;
        this.upgrades.barrels++;
        this.sounds.upgrade();
        this.haptics.success();
        this.fx.burst(12 + colW * 2.5, 680, '#ffd166', 16, 150, 0.5, 3);
        this.fx.text(this.cannonX, this.cannonY - 45, `${this.upgrades.barrels}X BARRELS! 🚀`, '#f72585', 20, 1.0);
      } else {
        this.sounds.fail();
      }
    }
  }

  updateFiring(dt) {
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.getFireInterval();
      this.cannonRecoil = 5;
      this.sounds.slice();

      const dmg = this.upgrades.damage;
      const barrels = this.upgrades.barrels;
      const speed = 720;
      const cy = this.cannonY - 18;

      if (barrels === 1) {
        this.bullets.push({ x: this.cannonX, y: cy, vx: 0, vy: -speed, damage: dmg });
      } else if (barrels === 2) {
        [-8, 8].forEach((ox) => {
          this.bullets.push({ x: this.cannonX + ox, y: cy, vx: 0, vy: -speed, damage: dmg });
        });
      } else if (barrels === 3) {
        this.bullets.push({ x: this.cannonX, y: cy, vx: 0, vy: -speed, damage: dmg });
        this.bullets.push({ x: this.cannonX - 8, y: cy, vx: -50, vy: -speed, damage: dmg });
        this.bullets.push({ x: this.cannonX + 8, y: cy, vx: 50, vy: -speed, damage: dmg });
      } else {
        [-12, -4, 4, 12].forEach((ox, idx) => {
          const spread = (idx - 1.5) * 45;
          this.bullets.push({ x: this.cannonX + ox, y: cy, vx: spread, vy: -speed, damage: dmg });
        });
      }

      // Laser Beam Active
      if (this.laserTimer > 0) {
        this.damageLaserBeam();
      }
    }
  }

  damageLaserBeam() {
    const beamW = 24;
    for (const b of this.balls) {
      if (Math.abs(b.x - this.cannonX) <= b.r + beamW / 2) {
        this.hitBall(b, this.upgrades.damage * 2);
      }
    }
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const p = this.bullets[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.y < 80) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check collision with balls
      let hit = false;
      for (const b of this.balls) {
        if (Math.hypot(b.x - p.x, b.y - p.y) <= b.r + 4) {
          hit = true;
          this.hitBall(b, p.damage);
          break;
        }
      }

      if (hit) {
        this.bullets.splice(i, 1);
      }
    }
  }

  hitBall(b, damage) {
    b.hp -= damage;
    b.hitFlash = 1.0;
    b.scale = 1.15;
    this.score += damage * 2;
    this.sounds.hit();

    // Small kinetic impulse upwards
    b.vy = Math.min(b.vy, b.vy - 15);

    if (b.hp <= 0) {
      this.destroyBall(b);
    }
  }

  destroyBall(b) {
    const idx = this.balls.indexOf(b);
    if (idx !== -1) this.balls.splice(idx, 1);

    this.totalPops++;
    this.score += b.maxHp * 5;
    this.sounds.blockPop(5);
    this.fx.shake(4, 0.2);
    this.fx.burst(b.x, b.y, b.color, 14, 140, 0.4, 3.5);

    // Drop Gold Coins
    const coinsToDrop = b.tier * 2 + 1;
    for (let c = 0; c < coinsToDrop; c++) {
      this.spawnCoin(b.x, b.y);
    }

    // Chance to drop power-up (10%)
    if (Math.random() < 0.12) {
      this.spawnPowerup(b.x, b.y);
    }

    // Split into smaller balls
    if (b.tier > 1) {
      const nextTier = b.tier - 1;
      const childHp = Math.max(1, Math.round(b.maxHp / 2));
      const spreadVx = Math.abs(b.vx) + 30;

      this.spawnBall(nextTier, childHp, b.x - 12, b.y, -spreadVx);
      this.spawnBall(nextTier, childHp, b.x + 12, b.y, spreadVx);
    }
  }

  spawnCoin(x, y) {
    this.droppedCoins.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 160,
      vy: -150 - Math.random() * 100,
      value: 1,
      life: 14,
    });
  }

  spawnPowerup(x, y) {
    const types = ['freeze', 'shield', 'laser', 'nuke'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.powerups.push({
      type,
      x,
      y,
      vy: 65,
      life: 12,
    });
  }

  updateBalls(dt) {
    for (const b of this.balls) {
      if (b.hitFlash > 0) b.hitFlash -= dt * 5;
      if (b.scale > 1.0) b.scale = Math.max(1.0, b.scale - dt * 2.5);

      // Freeze Powerup
      if (this.freezeTimer > 0) continue;

      // Gravity & Velocity
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rotation += b.rotSpeed * dt;

      // Wall Bounces (Left & Right)
      if (b.x - b.r <= 12) {
        b.x = 12 + b.r;
        b.vx = Math.abs(b.vx);
        this.fx.burst(b.x - b.r, b.y, b.color, 4, 50, 0.2, 2);
      } else if (b.x + b.r >= this.W - 12) {
        b.x = this.W - 12 - b.r;
        b.vx = -Math.abs(b.vx);
        this.fx.burst(b.x + b.r, b.y, b.color, 4, 50, 0.2, 2);
      }

      // Ground Bounce (Smooth calculated parabolic apex)
      if (b.y + b.r >= GROUND_Y) {
        b.y = GROUND_Y - b.r;
        // vy = -sqrt(2 * g * h)
        b.vy = -Math.sqrt(2 * GRAVITY * b.bounceH);
        this.sounds.tone({ f: 180, to: 90, dur: 0.05, vol: 0.15 });
        this.fx.burst(b.x, GROUND_Y, '#ffd166', 5, 70, 0.2, 2);
      }

      // Collision Check with Cannon
      const cannonBox = {
        x1: this.cannonX - 18,
        x2: this.cannonX + 18,
        y1: this.cannonY - 14,
        y2: this.cannonY + 14,
      };

      // Circle-box intersection test
      const closestX = Math.max(cannonBox.x1, Math.min(b.x, cannonBox.x2));
      const closestY = Math.max(cannonBox.y1, Math.min(b.y, cannonBox.y2));
      const dist = Math.hypot(b.x - closestX, b.y - closestY);

      if (dist <= b.r) {
        if (this.shieldActive) {
          // Shield absorbs hit
          this.shieldActive = false;
          this.sounds.shatter();
          this.fx.ring(this.cannonX, this.cannonY, '#00b4d8', 45, 0.4, 5);
          this.fx.text(this.cannonX, this.cannonY - 35, 'SHIELD BROKEN!', '#00b4d8', 18, 1.0);
          b.vy = -350; // Knock ball away
        } else {
          // Game Over! Crushed!
          this.sounds.explosion();
          this.fx.burst(this.cannonX, this.cannonY, '#ef233c', 24, 200, 0.8, 5);
          this.fx.ring(this.cannonX, this.cannonY, '#ffd166', 60, 0.5, 6);
          this.die('Crushed by a giant boulder! 💥');
          return;
        }
      }
    }
  }

  updateCoins(dt) {
    for (let i = this.droppedCoins.length - 1; i >= 0; i--) {
      const c = this.droppedCoins[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.droppedCoins.splice(i, 1);
        continue;
      }

      c.vy += GRAVITY * 0.9 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;

      // Ground bounce & friction
      if (c.y >= GROUND_Y - 4) {
        c.y = GROUND_Y - 4;
        c.vy = -c.vy * 0.45;
        c.vx *= 0.85;
      }

      // Magnetize towards cannon if nearby
      const distToCannon = Math.hypot(this.cannonX - c.x, this.cannonY - c.y);
      if (distToCannon <= 80) {
        c.x += (this.cannonX - c.x) * 8 * dt;
        c.y += (this.cannonY - c.y) * 8 * dt;
      }

      // Collect coin
      if (distToCannon <= 28) {
        this.coins += c.value;
        this.score += 25;
        this.sounds.bubble();
        this.fx.burst(c.x, c.y, '#ffd166', 4, 50, 0.2, 2);
        this.droppedCoins.splice(i, 1);
      }
    }
  }

  updatePowerups(dt) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.life -= dt;
      p.y += p.vy * dt;

      if (p.life <= 0 || p.y >= GROUND_Y) {
        this.powerups.splice(i, 1);
        continue;
      }

      // Check pickup
      if (Math.hypot(this.cannonX - p.x, this.cannonY - p.y) <= 32) {
        this.activatePowerup(p.type);
        this.powerups.splice(i, 1);
      }
    }
  }

  activatePowerup(type) {
    this.sounds.upgrade();
    this.haptics.medium();

    if (type === 'freeze') {
      this.freezeTimer = 4.0;
      this.fx.text(this.cannonX, this.cannonY - 40, 'FREEZE! ❄️', '#00b4d8', 22, 1.2);
      this.fx.ring(this.W / 2, this.H / 2, '#48cae4', 180, 0.5, 8);
    } else if (type === 'shield') {
      this.shieldActive = true;
      this.fx.text(this.cannonX, this.cannonY - 40, 'SHIELD ACTIVE! 🛡️', '#ffd166', 22, 1.2);
    } else if (type === 'laser') {
      this.laserTimer = 5.0;
      this.fx.text(this.cannonX, this.cannonY - 40, 'MEGA LASER! ⚡', '#f72585', 22, 1.2);
    } else if (type === 'nuke') {
      this.sounds.explosion();
      this.fx.shake(8, 0.4);
      this.fx.text(this.W / 2, 280, 'NUKE! 💣', '#ef233c', 28, 1.2);
      for (const b of this.balls) {
        this.hitBall(b, Math.max(1, Math.round(b.hp / 2)));
      }
    }
  }

  serialize() {
    return {
      wave: this.wave,
      coins: this.coins,
      upgrades: { ...this.upgrades },
      totalPops: this.totalPops,
    };
  }

  restoreLabel() {
    return `Wave ${this.wave} · Coins $${this.coins}`;
  }

  /* ------------------------------------------------------------ Rendering */
  render() {
    const { ctx, W, H } = this;
    const shake = this.fx.offset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Vibrant Gradient Sky & Distant Mountain Ridges
    this.renderBackdrop(ctx, W, H);

    // 2. Ground & Floor Line
    this.renderGround(ctx, W);

    // 3. Gold Coins on Ground
    this.renderCoins(ctx);

    // 4. Power-Up Capsules
    this.renderPowerups(ctx);

    // 5. Bullets & Lasers
    this.renderBullets(ctx);

    // 6. Player Cannon
    this.renderCannon(ctx);

    // 7. Bouncing Numbered Boulders
    this.renderBalls(ctx);

    // 8. Particle Effects & Popups
    this.fx.render(ctx);

    // 9. Top Header HUD (Wave, Coins, Score)
    this.renderHeaderHUD(ctx, W);

    // 10. Bottom In-Run Upgrade Bar
    this.renderUpgradeDock(ctx, W);

    ctx.restore();
  }

  renderBackdrop(ctx, W, H) {
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#0f172a');
    sky.addColorStop(0.4, '#1e293b');
    sky.addColorStop(1, '#334155');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Distant soft mountain ridges
    ctx.save();
    ctx.fillStyle = 'rgba(71, 85, 105, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(80, 480);
    ctx.lineTo(190, 560);
    ctx.lineTo(280, 450);
    ctx.lineTo(390, 530);
    ctx.lineTo(W, 490);
    ctx.lineTo(W, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  renderGround(ctx, W) {
    ctx.save();
    // Lush grassy soil border
    ctx.fillStyle = '#06d6a0';
    ctx.fillRect(0, GROUND_Y, W, 6);

    const earthGrad = ctx.createLinearGradient(0, GROUND_Y + 6, 0, this.H);
    earthGrad.addColorStop(0, '#1e293b');
    earthGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = earthGrad;
    ctx.fillRect(0, GROUND_Y + 6, W, this.H - GROUND_Y);

    // Side wall guide lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 90);
    ctx.lineTo(12, GROUND_Y);
    ctx.moveTo(W - 12, 90);
    ctx.lineTo(W - 12, GROUND_Y);
    ctx.stroke();

    ctx.restore();
  }

  renderCannon(ctx) {
    const cx = this.cannonX;
    const cy = this.cannonY;

    ctx.save();
    ctx.translate(cx, cy);

    // Laser Beam FX
    if (this.laserTimer > 0) {
      const beamGrad = ctx.createLinearGradient(-14, 0, 14, 0);
      beamGrad.addColorStop(0, 'rgba(247, 37, 133, 0.2)');
      beamGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
      beamGrad.addColorStop(1, 'rgba(247, 37, 133, 0.2)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(-14, -cy + 85, 28, cy - 85);
    }

    // Shield Bubble
    if (this.shieldActive) {
      ctx.strokeStyle = '#00b4d8';
      ctx.fillStyle = 'rgba(0, 180, 216, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Cannon Barrels (Muzzle)
    const recoilY = this.cannonRecoil;
    const barrelH = 30 - recoilY;
    const barrels = this.upgrades.barrels;

    // Metallic barrel gradient
    const barrelGrad = ctx.createLinearGradient(-15, 0, 15, 0);
    barrelGrad.addColorStop(0, '#f59e0b');
    barrelGrad.addColorStop(0.3, '#fbbf24');
    barrelGrad.addColorStop(0.7, '#d97706');
    barrelGrad.addColorStop(1, '#92400e');

    const drawBarrel = (ox, bw) => {
      ctx.fillStyle = barrelGrad;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(ox, -barrelH, bw, barrelH, [4, 4, 1, 1]);
      ctx.fill();
      ctx.stroke();

      // Golden muzzle ring at top
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.roundRect(ox - 1, -barrelH - 2, bw + 2, 4, 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox - 1, -barrelH - 2, bw + 2, 4, 2);
    };

    if (barrels === 1) {
      drawBarrel(-7, 14);
    } else if (barrels === 2) {
      [-11, 2].forEach(ox => drawBarrel(ox, 9));
    } else if (barrels === 3) {
      [-14, -4, 6].forEach(ox => drawBarrel(ox, 8));
    } else {
      [-16, -8, 0, 8].forEach(ox => drawBarrel(ox, 7));
    }

    // Muzzle Fire Flash Particle if recoiling
    if (this.cannonRecoil > 1.2) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -barrelH - 4, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.arc(0, -barrelH - 4, 9, 0, TAU);
      ctx.fill();
    }

    // Heavy Armored Chassis Hub
    const chassisGrad = ctx.createLinearGradient(-18, -8, 18, 10);
    chassisGrad.addColorStop(0, '#ef4444');
    chassisGrad.addColorStop(0.5, '#dc2626');
    chassisGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = chassisGrad;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-18, -6, 36, 17, [8, 8, 4, 4]);
    ctx.fill();
    ctx.stroke();

    // Center Gold Core Emblem
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, 2, 4.5, 0, TAU);
    ctx.fill();

    // Two Spoked Heavy Rubber Tires
    [-17, 17].forEach((wx) => {
      ctx.save();
      ctx.translate(wx, 5);
      ctx.rotate(this.wheelRotation);

      // Outer Tire
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Golden Spokes
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
      ctx.moveTo(0, -6); ctx.lineTo(0, 6);
      ctx.stroke();

      // Hub Cap
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, TAU);
      ctx.fill();

      ctx.restore();
    });

    ctx.restore();
  }

  renderBalls(ctx) {
    for (const b of this.balls) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(b.scale, b.scale);

      // Soft Shadow on Ground
      const groundDist = GROUND_Y - b.y;
      const shadowScale = Math.max(0.2, 1.0 - groundDist / 500);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, groundDist, b.r * 0.9 * shadowScale, 6 * shadowScale, 0, 0, TAU);
      ctx.fill();

      // Boulder Body with Faceted Rocky Outlines
      ctx.rotate(b.rotation);
      ctx.beginPath();
      const facets = 12;
      for (let i = 0; i < facets; i++) {
        const a = (TAU / facets) * i;
        const rad = b.r * (i % 2 === 0 ? 1.0 : 0.92);
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Shading Gradient
      const grad = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.35, 2, 0, 0, b.r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, b.hitFlash > 0 ? '#ffffff' : b.color);
      grad.addColorStop(1, b.dark);
      ctx.fillStyle = grad;
      ctx.fill();

      // Bold cartoon outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3.8, b.r * 0.12);
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Unrotate for Number Text
      ctx.rotate(-b.rotation);

      // Number Label in Center
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.font = `bold ${Math.max(12, Math.round(b.r * 0.72))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(String(b.hp), 0, 1);
      ctx.fillText(String(b.hp), 0, 1);

      ctx.restore();
    }
  }

  renderBullets(ctx) {
    ctx.save();
    for (const p of this.bullets) {
      // High-velocity glowing plasma bolt
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderCoins(ctx) {
    ctx.save();
    for (const c of this.droppedCoins) {
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#f77f00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f77f00';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', c.x, c.y);
    }
    ctx.restore();
  }

  renderPowerups(ctx) {
    ctx.save();
    for (const p of this.powerups) {
      // Glowing floating orb
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = p.type === 'freeze' ? '❄️' : p.type === 'shield' ? '🛡️' : p.type === 'laser' ? '⚡' : '💣';
      ctx.fillText(icon, p.x, p.y);
    }
    ctx.restore();
  }

  renderHeaderHUD(ctx, W) {
    ctx.save();
    const barY = 94;

    // Background pill
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(14, barY, W - 28, 36, 18);
    ctx.fill();
    ctx.stroke();

    // Wave Badge
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`WAVE ${this.wave}`, 30, barY + 18);

    // Coins Collected
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.fillText(`💰 $${this.coins}`, W / 2, barY + 18);

    // Score
    ctx.fillStyle = '#00b4d8';
    ctx.textAlign = 'right';
    ctx.fillText(`⭐ ${this.score}`, W - 30, barY + 18);

    ctx.restore();
  }

  renderUpgradeDock(ctx, W) {
    ctx.save();
    const dockY = 672;
    const colW = (W - 24) / 3;

    // 3 In-Run Upgrade Buttons
    const buttons = [
      {
        title: 'DAMAGE',
        val: `Lv ${this.upgrades.damage}`,
        cost: 40 + this.upgrades.damage * 35,
        canAfford: this.coins >= 40 + this.upgrades.damage * 35,
        icon: '💥',
      },
      {
        title: 'FIRE SPEED',
        val: `Lv ${this.upgrades.fireRate}`,
        cost: 40 + this.upgrades.fireRate * 35,
        canAfford: this.coins >= 40 + this.upgrades.fireRate * 35 && this.upgrades.fireRate < 8,
        icon: '⚡',
      },
      {
        title: 'BARRELS',
        val: `${this.upgrades.barrels}X`,
        cost: 120 * this.upgrades.barrels,
        canAfford: this.coins >= 120 * this.upgrades.barrels && this.upgrades.barrels < 4,
        icon: '🚀',
      },
    ];

    buttons.forEach((btn, i) => {
      const bx = 12 + i * colW + 4;
      const bw = colW - 8;
      const by = dockY;
      const bh = 34;

      ctx.fillStyle = btn.canAfford ? '#1e293b' : '#0f172a';
      ctx.strokeStyle = btn.canAfford ? '#ffd166' : '#334155';
      ctx.lineWidth = btn.canAfford ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${btn.icon} ${btn.title} (${btn.val})`, bx + bw / 2, by + 11);

      ctx.fillStyle = btn.canAfford ? '#ffd166' : '#ef233c';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`$${btn.cost}`, bx + bw / 2, by + 24);
    });

    ctx.restore();
  }
}
