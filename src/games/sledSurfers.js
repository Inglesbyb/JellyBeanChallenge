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
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Half-pipe geometry constants
const TUBE_RADIUS = 150; // Radius of the curved half-pipe chute
const SEG_LENGTH = 36;   // World units per track slice
const DRAW_DIST = 1600;  // How far ahead to render track segments
const FOCAL_LEN = 280;   // 3D perspective projection focal length

// Track Curvature Math
function getTrackCenter(z) {
  // Gentle sinusoidal bends that feel like a thrilling downhill water coaster
  const x = Math.sin(z * 0.0016) * 180 + Math.cos(z * 0.0034) * 90;
  const y = Math.sin(z * 0.0012) * 90 + Math.cos(z * 0.0028) * 50;
  const bank = Math.cos(z * 0.0016) * 0.28 - Math.sin(z * 0.0034) * 0.15;
  return { x, y, bank };
}

export class SledSurfers extends Game {
  static meta = {
    id: 'sled-surfers',
    title: 'Sled Surfers',
    icon: '🛷',
    hint: 'DRAG Left/Right to BANK · Hit RAMPS for AIR TIME · FLIP in mid-air for BOOST!',
    baseLikes: 9180,
    isPrestige: false,
    parScore60s: 2200,
    roundLen: 90,
    cue: 'BANK & DO FLIPS!',
    prestigeCue: 'FASTER SLIDE · FIERCER RIVALS!',
    scaling: {
      baseSpeed:      { base: 520,  rate: 0.16, cap: 680,  mode: 'up', round: true, label: 'Cruise Speed' },
      maxSpeed:       { base: 1050, rate: 0.16, cap: 1250, mode: 'up', round: true, label: 'Top Speed' },
      rivalAggroMult: { base: 1.0,  rate: 0.16, cap: 1.16, mode: 'up', label: 'Rival Pace' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    // Longitudinal position along track
    this.playerZ = saved?.playerZ || 0;
    this.playerU = saved?.playerU || 0; // Normalized lateral position: -1 (left rim), 0 (chute bed), 1 (right rim)
    this.playerTargetU = 0;
    this.playerY = 0; // Altitude above track surface (0 when sliding on water)
    this.playerVy = 0;
    this.isAirborne = false;
    this.flipAngle = 0; // Mid-air stunt rotation in radians
    this.flipSpins = 0; // Completed 360 spins during current jump
    this.isFlipping = false;

    // Movement & Speed (scaled by SSOT Prestige slope)
    this.baseSpeed = this.diff.baseSpeed ?? 520;
    this.speed = Math.max(this.baseSpeed, saved?.speed || this.baseSpeed);
    this.maxSpeed = this.diff.maxSpeed ?? 1050;
    this.speedBoostTimer = 0;
    this.wipeoutTimer = 0; // Non-lethal spinout recovery

    // Distance & Race Metrics
    this.distanceMeters = Math.floor(this.playerZ / 10);
    this.lastMilestone = Math.floor(this.distanceMeters / 500) * 500;
    this.coins = saved?.coins || 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.rank = 1;

    // Camera 3D Position
    this.camX = 0;
    this.camY = 210;
    this.camZ = -160;
    this.camRoll = 0;
    this.fovPunch = 0;

    // Sled Visuals
    this.sledTilt = 0;
    this.wakeAnimT = 0;
    this.sprayParticles = [];

    // Keyboard inputs
    this.keys = { left: false, right: false, space: false };
    this.keyHandler = (e) => {
      const down = e.type === 'keydown';
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = down;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = down;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.keys.space = down;
    };
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('keyup', this.keyHandler);

    // Procedural Obstacles, Ramps & Pickups
    this.items = [];
    this.nextItemZ = this.playerZ + 200;

    // Rival AI Surfers with distinct personalities and Prestige-scaled aggression
    const agg = this.diff.rivalAggroMult ?? 1;
    this.rivals = [
      { id: 1, name: 'SplashBro', color: '#f72585', z: this.playerZ + 45,  u: -0.35, speed: this.baseSpeed,       y: 0, aggression: 1.04 * agg, fellTimer: 0 },
      { id: 2, name: 'WaveKing',  color: '#ffb703', z: this.playerZ + 95,  u:  0.30, speed: this.baseSpeed + 20,  y: 0, aggression: 1.07 * agg, fellTimer: 0 },
      { id: 3, name: 'TurboBean', color: '#06d6a0', z: this.playerZ - 25, u: -0.15, speed: this.baseSpeed - 10,  y: 0, aggression: 1.02 * agg, fellTimer: 0 },
      { id: 4, name: 'DriftQueen',color: '#7209b7', z: this.playerZ + 155, u:  0.45, speed: this.baseSpeed + 30,  y: 0, aggression: 1.09 * agg, fellTimer: 0 },
    ];
    this.lastRank = 4;

    // Background floating clouds (high in the sky, y > 240)
    this.clouds = [];
    for (let i = 0; i < 28; i++) {
      this.clouds.push({
        x: (Math.random() - 0.5) * 1600,
        y: 280 + Math.random() * 450,
        z: Math.random() * 2000,
        scale: 0.8 + Math.random() * 1.6,
        alpha: 0.45 + Math.random() * 0.4,
      });
    }

    // Populate initial items with spacious breathing room
    while (this.nextItemZ < this.playerZ + 1800) {
      this.spawnItemBatch(this.nextItemZ);
      this.nextItemZ += 450 + Math.random() * 350;
    }
    if (saved) this.grace = 1.5;
  }

  destroy() {
    window.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('keyup', this.keyHandler);
  }

  serialize() {
    return {
      playerZ: this.playerZ,
      playerU: this.playerU,
      speed: this.speed,
      coins: this.coins,
    };
  }

  restoreLabel() {
    return `${Math.floor(this.playerZ / 10)}m · Coins $${this.coins}`;
  }

  /* ---------------------------------------------------- Procedural Spawning */
  spawnItemBatch(z) {
    const roll = Math.random();

    if (roll < 0.28) {
      // Occasional High-Air Launch Ramp
      const u = (Math.random() - 0.5) * 0.7;
      this.items.push({ type: 'ramp', z, u, collected: false });
    } else if (roll < 0.60) {
      // Golden Boost Chevron Pad
      const u = (Math.random() - 0.5) * 0.8;
      this.items.push({ type: 'boost', z, u, collected: false });
    } else {
      // Graceful Arc of Gold Coins along the slide curve
      const centerU = (Math.random() - 0.5) * 0.9;
      for (let i = 0; i < 4; i++) {
        this.items.push({
          type: 'coin',
          z: z + i * 26,
          u: centerU + Math.sin(i * 0.5) * 0.2,
          collected: false,
        });
      }
    }
  }

  /* ---------------------------------------------------- Update Loop */
  update(dt) {
    if (this.dead) return;
    this.time += dt;
    this.fx.update(dt);

    // 1. Player Lateral Steering & Banking
    this.updateSteering(dt);

    // 2. Downhill Speed & Boost Physics
    this.updateSpeed(dt);

    // 3. Air Time & Stunt Flips
    this.updateAirTime(dt);

    // 4. Update Camera Following Sled
    this.updateCamera(dt);

    // 5. Update Items & Collisions
    this.updateItems(dt);

    // 6. Update Rival AI Surfers
    this.updateRivals(dt);

    // 7. Water Wake & Splash Particles
    this.updateParticles(dt);

    // 8. Distance Scoring & Milestones
    this.updateDistance(dt);
  }

  updateSteering(dt) {
    // Touch/Mouse Dragging
    if (this.input.down) {
      // Map canvas screen X (0..W) to lateral coordinate u (-1.5..1.5)
      const targetU = ((this.input.x / this.W) - 0.5) * 2.9;
      this.playerTargetU = clamp(targetU, -1.5, 1.5);
    } else {
      // Keyboard A/D or ArrowLeft/ArrowRight
      let keyDir = 0;
      if (this.keys.left) keyDir -= 1;
      if (this.keys.right) keyDir += 1;
      if (keyDir !== 0) {
        this.playerTargetU = clamp(this.playerTargetU + keyDir * 2.6 * dt, -1.5, 1.5);
      }
    }

    // Smooth lateral movement interpolation
    const steerSpeed = this.isAirborne ? 2.5 : 5.8;
    this.playerU += (this.playerTargetU - this.playerU) * Math.min(1.0, steerSpeed * dt);

    // Sled banking roll based on lateral position on the curved half-pipe
    const targetRoll = this.playerU * 0.55;
    this.sledTilt += (targetRoll - this.sledTilt) * Math.min(1.0, 10 * dt);

    // Check if player steers over the edge of the slide!
    if (Math.abs(this.playerU) > 1.10) {
      if (!this.isAirborne) {
        // Starts falling off the slide!
        this.isAirborne = true;
        this.playerVy = -35; // Starts plummeting downward
        this.sounds.whoosh();
        this.haptics.heavy();
        this.fx.burst(this.W / 2, 560, '#ffffff', 16, 140, 0.4, 3);
        this.fx.text(this.W / 2, 300, 'FALLING OFF! ⚠️', '#ef4444', 22, 0.8);
      }
    }
  }

  updateSpeed(dt) {
    // Wipeout recovery
    if (this.wipeoutTimer > 0) {
      this.wipeoutTimer -= dt;
      this.speed = Math.max(260, this.speed - 350 * dt);
      return;
    }

    // Speed boost countdown
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      this.speed = Math.min(this.maxSpeed, this.speed + 450 * dt);
      this.fovPunch = Math.min(1.0, this.fovPunch + dt * 4);
    } else {
      // Smooth natural acceleration towards cruising speed based on distance
      const cruiseSpeed = Math.min(this.maxSpeed - 120, this.baseSpeed + (this.playerZ * 0.015));
      this.speed += (cruiseSpeed - this.speed) * Math.min(1.0, 1.5 * dt);
      this.fovPunch = Math.max(0, this.fovPunch - dt * 2);
    }

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }

    // Advance player Z
    this.playerZ += this.speed * dt;
  }

  launchIntoAir(launchVy) {
    this.isAirborne = true;
    this.playerVy = launchVy;
    this.flipAngle = 0;
    this.flipSpins = 0;
    this.sounds.jump();
    this.haptics.heavy();

    // Launch splash burst
    this.fx.burst(this.W / 2, 540, '#ffffff', 18, 160, 0.5, 3.5);
    this.fx.burst(this.W / 2, 540, '#00b4d8', 12, 120, 0.4, 2.5);
  }

  updateAirTime(dt) {
    if (!this.isAirborne) return;

    // Gravity (heavier plunge if off the edge)
    const gravity = Math.abs(this.playerU) > 1.15 ? 900 : 680;
    this.playerVy -= gravity * dt;
    this.playerY += this.playerVy * dt;

    // Flip stunt control: Holding Space or dragging/clicking during air time
    const flipInput = this.keys.space || (this.input.down && this.input.y < 420);
    if (flipInput && Math.abs(this.playerU) <= 1.15) {
      this.isFlipping = true;
      const spinSpeed = 9.2; // rad/s
      const prevAngle = this.flipAngle;
      this.flipAngle += spinSpeed * dt;

      // Track completed 360-degree rotations
      const prevRev = Math.floor(prevAngle / TAU);
      const currRev = Math.floor(this.flipAngle / TAU);
      if (currRev > prevRev) {
        this.flipSpins = currRev;
        this.sounds.pop();
        this.haptics.light();
        this.fx.text(this.W / 2, 260, `FLIP x${this.flipSpins}! 🔄`, '#ffd166', 24, 0.6);
      }
    } else {
      this.isFlipping = false;
    }

    // Check if falling off the sides into the ocean below!
    if (Math.abs(this.playerU) > 1.10) {
      // Sled tumbles outwards in the air
      this.sledTilt += Math.sign(this.playerU) * 8.0 * dt;

      // When player falls below the chute structure (-40 altitude)
      if (this.playerY < -40) {
        this.die('Fell off the slide!');
        this.sounds.fail();
        this.haptics.fail();
        this.fx.screenShake(18, 0.6);
        this.fx.burst(this.W / 2, 540, '#00b4d8', 30, 240, 0.8, 5);
        this.fx.text(this.W / 2, 340, 'FELL OFF THE SLIDE! 🌊', '#ef4444', 26, 1.2);
        return;
      }
      return; // Still falling, do not touch down
    }

    // Touchdown on half-pipe water slide (only when within slide bounds |u| <= 1.15)
    if (this.playerY <= 0) {
      this.playerY = 0;
      this.playerVy = 0;
      this.isAirborne = false;

      // Evaluate landing stunt angle
      const remAngle = (this.flipAngle % TAU);
      const isCleanLanding = remAngle < 0.65 || remAngle > (TAU - 0.65) || this.flipSpins === 0;

      if (isCleanLanding) {
        // Perfect landing bonus!
        this.sounds.powerup();
        this.haptics.success();
        const boostAward = 2.5 + this.flipSpins * 1.5;
        this.speedBoostTimer = Math.max(this.speedBoostTimer, boostAward);
        this.combo = Math.min(4, this.combo + (this.flipSpins > 0 ? 1 : 0));
        this.comboTimer = 5.0;

        const bonusScore = (this.flipSpins > 0 ? this.flipSpins * 250 : 80) * this.combo;
        this.score += bonusScore;

        const label = this.flipSpins > 0 ? `PERFECT LANDING! +${bonusScore} ⭐` : 'SMOOTH TOUCHDOWN! 🌊';
        this.fx.text(this.W / 2, 340, label, '#06d6a0', 22, 1.0);
        this.fx.burst(this.W / 2, 560, '#06d6a0', 20, 180, 0.6, 4);
      } else {
        // Wipeout / belly flop
        this.triggerWipeout('Belly flop splashdown!');
      }

      this.flipAngle = 0;
      this.flipSpins = 0;
    }
  }

  triggerWipeout(reason) {
    this.wipeoutTimer = 1.2;
    this.combo = 1;
    this.sounds.hurt();
    this.haptics.medium();
    this.fx.screenShake(12, 0.4);
    this.fx.burst(this.W / 2, 540, '#ffffff', 24, 220, 0.7, 4);
    this.fx.burst(this.W / 2, 540, '#ef4444', 16, 160, 0.5, 3);
    this.fx.text(this.W / 2, 360, 'WIPEOUT! 💥', '#ef4444', 24, 1.2);
  }

  updateCamera(dt) {
    const track = getTrackCenter(this.playerZ);

    // Target camera follows track curvature with smooth damping
    const targetCamX = track.x + this.playerU * 45;
    const targetCamY = track.y + 210 + (this.isAirborne ? this.playerY * 0.45 : 0);
    const targetCamZ = this.playerZ - 170;

    this.camX += (targetCamX - this.camX) * Math.min(1.0, 10 * dt);
    this.camY += (targetCamY - this.camY) * Math.min(1.0, 8 * dt);
    this.camZ = targetCamZ;
    this.camRoll += (track.bank * 0.7 - this.camRoll) * Math.min(1.0, 6 * dt);
  }

  updateItems(dt) {
    // Generate new items ahead
    while (this.nextItemZ < this.playerZ + DRAW_DIST) {
      this.spawnItemBatch(this.nextItemZ);
      this.nextItemZ += 450 + Math.random() * 350;
    }

    // Clean up items far behind
    this.items = this.items.filter((item) => item.z > this.playerZ - 100);

    // Collision detection with player
    for (const item of this.items) {
      if (item.collected) continue;

      const dz = item.z - this.playerZ;
      const du = Math.abs(item.u - this.playerU);

      // Check within hit box (only when player is near ground or landing)
      if (dz > -25 && dz < 35 && this.playerY < 35 && du < 0.38) {
        if (item.type === 'coin') {
          item.collected = true;
          this.coins++;
          this.score += 25 * this.combo;
          this.sounds.coin();
          this.haptics.light();
          this.fx.burst(this.W / 2, 500, '#ffd166', 10, 100, 0.35, 2.5);
        } else if (item.type === 'boost') {
          item.collected = true;
          this.speedBoostTimer = 3.5;
          this.score += 100 * this.combo;
          this.sounds.powerup();
          this.haptics.heavy();
          this.fx.text(this.W / 2, 300, 'SUPER BOOST! ⚡', '#ffd166', 26, 0.8);
          this.fx.burst(this.W / 2, 520, '#ffd166', 22, 200, 0.6, 4);
        } else if (item.type === 'ramp') {
          item.collected = true;
          this.launchIntoAir(460);
          this.fx.text(this.W / 2, 280, 'BIG AIR! 🚀', '#00b4d8', 26, 1.0);
        }
      }
    }
  }

  updateRivals(dt) {
    // Dynamic Pack Racing & Competitive AI
    for (const r of this.rivals) {
      if (r.fellTimer > 0) {
        r.fellTimer -= dt;
        continue;
      }

      // 1. Dynamic Speed AI: Bots scale to match and challenge player speed!
      const distFromPlayer = r.z - this.playerZ;
      let targetSpeed;

      if (distFromPlayer < -40) {
        // Behind player: Catch slipstream & draft hard!
        targetSpeed = this.speed * (1.05 * r.aggression);
      } else if (distFromPlayer > 120) {
        // Ahead of player: Cruise at competitive pace
        targetSpeed = this.speed * (0.97 * r.aggression);
      } else {
        // Neck-and-neck: Joust for the lead with micro-bursts!
        targetSpeed = this.speed * (1.0 + 0.12 * Math.sin(this.time * 2.0 + r.id));
      }

      r.speed += (targetSpeed - r.speed) * Math.min(1.0, 3.8 * dt);
      r.z += r.speed * dt;

      // 2. Continuous Pack Recycling:
      // If a bot gets left behind (-180 units) or surges too far ahead (+520), keep them closely contested!
      if (r.z < this.playerZ - 180) {
        r.z = this.playerZ + 80 + Math.random() * 140;
        r.u = (Math.random() - 0.5) * 1.3;
        r.speed = this.speed * (0.99 + Math.random() * 0.08);
      } else if (r.z > this.playerZ + 550) {
        r.z = this.playerZ + 200 + Math.random() * 140;
      }

      // 3. Competitive Bot Steering:
      // Bots steer toward the ideal line, but if near player, they try to shove!
      const targetU = Math.sin(r.z * 0.007 + r.id * 1.5) * 0.75;
      r.u += (targetU - r.u) * Math.min(1.0, 3.2 * dt);

      // 4. Bumping & Jostling Physics:
      const dz = Math.abs(r.z - this.playerZ);
      const du = Math.abs(r.u - this.playerU);

      if (dz < 38 && du < 0.38 && this.playerY < 35 && !this.dead) {
        // Lateral shove direction
        const shoveDir = Math.sign(this.playerU - r.u) || 1;

        // Bot pushes player outwards toward dangerous rim!
        this.playerTargetU = clamp(this.playerTargetU + shoveDir * 0.38, -1.5, 1.5);
        // Player pushes bot in opposite direction!
        r.u -= shoveDir * 0.32;

        this.fx.screenShake(7, 0.25);
        this.sounds.hit();
        this.haptics.medium();
        this.fx.burst(this.W / 2, 540, r.color, 14, 140, 0.4, 2.5);

        // Check if bot was shoved off the edge!
        if (Math.abs(r.u) > 1.25) {
          r.fellTimer = 3.5;
          r.z = this.playerZ - 400; // Sent back
          this.score += 300 * this.combo;
          this.sounds.powerup();
          this.fx.text(this.W / 2, 320, `KNOCKED OUT ${r.name}! 🌊`, '#06d6a0', 22, 1.2);
          this.fx.burst(this.W / 2, 540, '#ffd166', 22, 200, 0.6, 4);
        } else {
          this.fx.text(this.W / 2, 380, `RIVAL BUMP! 💥`, '#ffd166', 16, 0.5);
        }
      }
    }

    // Dynamic Race Rank Calculation
    let currentRank = 1;
    let leaderName = null;
    for (const r of this.rivals) {
      if (r.fellTimer <= 0 && r.z > this.playerZ) {
        currentRank++;
        if (!leaderName) leaderName = r.name;
      }
    }

    // Rank alerts
    if (currentRank === 1 && this.lastRank > 1) {
      this.fx.text(this.W / 2, 280, `TAKEN 1ST PLACE! 👑`, '#ffd166', 24, 1.0);
      this.sounds.upgrade();
    } else if (currentRank > 1 && this.lastRank === 1) {
      this.fx.text(this.W / 2, 280, `${leaderName || 'Rival'} OVERTOOK YOU! 💨`, '#f72585', 20, 0.8);
    }
    this.lastRank = currentRank;
    this.rank = currentRank;
  }

  updateParticles(dt) {
    this.wakeAnimT += dt * (this.speed / 200);

    // Spawn water spray droplets
    if (!this.isAirborne && this.wipeoutTimer <= 0) {
      const sprayCount = this.speedBoostTimer > 0 ? 3 : 1;
      for (let i = 0; i < sprayCount; i++) {
        this.sprayParticles.push({
          x: (Math.random() - 0.5) * 32,
          y: 8 + Math.random() * 6,
          vx: (Math.random() - 0.5) * 60,
          vy: -30 - Math.random() * 45,
          life: 0.35 + Math.random() * 0.25,
          maxLife: 0.5,
          scale: 2 + Math.random() * 3,
        });
      }
    }

    // Update particles
    for (let i = this.sprayParticles.length - 1; i >= 0; i--) {
      const p = this.sprayParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt; // gravity
      p.life -= dt;
      if (p.life <= 0) {
        this.sprayParticles.splice(i, 1);
      }
    }
  }

  updateDistance(dt) {
    this.distanceMeters = Math.floor(this.playerZ / 10);
    this.score += Math.round((this.speed * dt * 0.1) * this.combo);

    // Distance Milestone celebration every 500 meters
    const currentMilestone = Math.floor(this.distanceMeters / 500) * 500;
    if (currentMilestone > this.lastMilestone && currentMilestone > 0) {
      this.lastMilestone = currentMilestone;
      this.sounds.upgrade();
      this.haptics.success();
      this.fx.text(this.W / 2, 220, `${currentMilestone}M REACHED! 🏆`, '#ffd166', 28, 1.8);
      this.fx.burst(this.W / 2, 240, '#ffd166', 30, 260, 0.8, 5);
      this.fx.burst(this.W / 2, 240, '#00b4d8', 25, 220, 0.7, 4);
    }
  }

  /* ---------------------------------------------------- 3D Projection Engine */
  project(worldX, worldY, worldZ) {
    const rx = worldX - this.camX;
    const ry = worldY - this.camY;
    const rz = worldZ - this.camZ;

    if (rz <= 10) return null; // Behind camera clipping

    const scale = FOCAL_LEN / rz;
    const horizonY = 240;

    // Camera roll rotation
    const cosR = Math.cos(this.camRoll);
    const sinR = Math.sin(this.camRoll);
    const rotX = rx * cosR - ry * sinR;
    const rotY = rx * sinR + ry * cosR;

    return {
      x: this.W / 2 + rotX * scale,
      y: horizonY - rotY * scale,
      scale,
      rz,
    };
  }

  /* ---------------------------------------------------- Render Pipeline */
  render() {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;

    ctx.clearRect(0, 0, W, H);

    // 1. Sky & Clouds
    this.renderSky(ctx, W, H);

    // 2. 3D Half-Pipe Chute Segments
    this.renderTrack(ctx);

    // 3. Track Items (Ramps, Buoys, Boosters, Coins)
    this.renderItems(ctx);

    // 4. Rival AI Surfers
    this.renderRivals(ctx);

    // 5. Player Sled & Surfing Bean
    this.renderPlayerSled(ctx);

    // 6. Water Spray Particles & Speedlines
    this.renderSpeedEffects(ctx, W, H);

    // 7. Visual FX (text banners, confetti bursts)
    this.fx.render(ctx);

    // 8. Modern Mobile HUD (Distance Meter, Speedometer, Rank Badge)
    this.renderHUD(ctx, W);
  }

  renderSky(ctx, W, H) {
    const horizonY = 240;

    // Sky above horizon
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#0284c7'); // Deep azure
    skyGrad.addColorStop(0.5, '#38bdf8'); // Sky blue
    skyGrad.addColorStop(1, '#bae6fd'); // Tropical haze
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, horizonY + 2);

    // Warm toy diorama sun orb in upper sky
    const sunX = W * 0.78;
    const sunY = 92;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 110);
    sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
    sunGlow.addColorStop(0.35, 'rgba(253, 224, 71, 0.32)');
    sunGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 110, 0, TAU);
    ctx.fill();
    drawToySphere(ctx, sunX, sunY, 24, '#fde047', {
      rimColor: '#ca8a04',
      lineWidth: 1.2,
      shine: 0.65,
      bottomBounce: false,
    });

    // Tropical Ocean below horizon
    const oceanGrad = ctx.createLinearGradient(0, horizonY, 0, H);
    oceanGrad.addColorStop(0, '#0ea5e9');
    oceanGrad.addColorStop(0.35, '#0284c7');
    oceanGrad.addColorStop(1, '#075985');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // Horizon sun shimmer band
    const seaGlint = ctx.createLinearGradient(0, horizonY, 0, horizonY + 46);
    seaGlint.addColorStop(0, 'rgba(186, 230, 253, 0.45)');
    seaGlint.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = seaGlint;
    ctx.fillRect(0, horizonY, W, 46);

    // Fluffy 3D Marshmallow Clouds drifting in the sky
    ctx.save();
    for (const c of this.clouds) {
      const proj = this.project(c.x, c.y, this.playerZ + c.z);
      if (!proj || proj.rz < 80 || proj.y > horizonY - 10) continue;

      const cr = 48 * proj.scale * c.scale;
      ctx.globalAlpha = c.alpha;

      // Soft cool lower bounce shadow lobe
      ctx.fillStyle = '#bae6fd';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y + cr * 0.12, cr * 0.96, 0, TAU);
      ctx.arc(proj.x - cr * 0.6, proj.y + cr * 0.22, cr * 0.68, 0, TAU);
      ctx.arc(proj.x + cr * 0.6, proj.y + cr * 0.25, cr * 0.72, 0, TAU);
      ctx.fill();

      // Bright sunlit marshmallow cloud puffs
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, cr, 0, TAU);
      ctx.arc(proj.x - cr * 0.6, proj.y + cr * 0.08, cr * 0.7, 0, TAU);
      ctx.arc(proj.x + cr * 0.6, proj.y + cr * 0.12, cr * 0.75, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  renderTrack(ctx) {
    ctx.save();

    const startZ = Math.floor((this.playerZ - 120) / SEG_LENGTH) * SEG_LENGTH;
    const maxZ = startZ + DRAW_DIST + 120;

    // Collect track segments from back to front
    const segments = [];
    for (let z = maxZ; z >= startZ; z -= SEG_LENGTH) {
      const track = getTrackCenter(z);
      const points = [];

      // Semicircular half-pipe cross section: 9 vertices across [-1.15 .. 1.15]
      const numPts = 9;
      for (let i = 0; i < numPts; i++) {
        const u = -1.15 + (2.3 / (numPts - 1)) * i;
        const angle = u * (Math.PI / 2.3);

        const localX = Math.sin(angle) * TUBE_RADIUS;
        const localY = (1 - Math.cos(angle)) * TUBE_RADIUS;

        // Apply track banking
        const cosB = Math.cos(track.bank);
        const sinB = Math.sin(track.bank);
        const bankedX = localX * cosB - localY * sinB;
        const bankedY = localX * sinB + localY * cosB;

        const proj = this.project(track.x + bankedX, track.y + bankedY, z);
        points.push({ proj, u });
      }

      segments.push({ z, points });
    }

    // Render quads between adjacent track segments
    for (let s = 0; s < segments.length - 1; s++) {
      const segFar = segments[s];
      const segNear = segments[s + 1];

      // Alternating longitudinal stripe band color
      const bandIndex = Math.floor(segNear.z / (SEG_LENGTH * 2)) % 2;

      for (let i = 0; i < segFar.points.length - 1; i++) {
        const pFarA = segFar.points[i].proj;
        const pFarB = segFar.points[i + 1].proj;
        const pNearA = segNear.points[i].proj;
        const pNearB = segNear.points[i + 1].proj;

        if (!pFarA || !pFarB || !pNearA || !pNearB) continue;

        // Color theme: Alternating glossy turquoise, aqua, and sunlit rail vinyl stripes
        const stripeCol = (i % 2 === bandIndex);
        let fillCol = stripeCol ? '#06b6d4' : '#0284c7';

        // Center lane has a bright aqua speed channel
        if (i === 3 || i === 4) {
          fillCol = stripeCol ? '#67e8f9' : '#22d3ee';
        }
        // Top outer rim rails are bright safety toy yellow-gold
        const isRail = (i === 0 || i === segFar.points.length - 2);
        if (isRail) {
          fillCol = stripeCol ? '#fde047' : '#f59e0b';
        }

        ctx.fillStyle = fillCol;
        ctx.beginPath();
        ctx.moveTo(pNearA.x, pNearA.y);
        ctx.lineTo(pFarA.x, pFarA.y);
        ctx.lineTo(pFarB.x, pFarB.y);
        ctx.lineTo(pNearB.x, pNearB.y);
        ctx.closePath();
        ctx.fill();

        // Tinted edge rim on outer rails, glossy water highlight inside chute
        if (isRail) {
          ctx.strokeStyle = toyRim(fillCol, 0.5);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  renderItems(ctx) {
    ctx.save();
    // Sort items by distance from camera (back to front)
    const visibleItems = this.items
      .filter((it) => it.z > this.camZ + 20 && it.z < this.playerZ + DRAW_DIST)
      .sort((a, b) => b.z - a.z);

    for (const it of visibleItems) {
      if (it.collected) continue;

      const track = getTrackCenter(it.z);
      const angle = it.u * (Math.PI / 2.3);
      const localX = Math.sin(angle) * TUBE_RADIUS;
      const localY = (1 - Math.cos(angle)) * TUBE_RADIUS;

      const cosB = Math.cos(track.bank);
      const sinB = Math.sin(track.bank);
      const worldX = track.x + (localX * cosB - localY * sinB);
      const worldY = track.y + (localX * sinB + localY * cosB) + 10;

      const proj = this.project(worldX, worldY, it.z);
      if (!proj) continue;

      ctx.save();
      ctx.translate(proj.x, proj.y);
      const s = proj.scale;

      if (it.type === 'coin') {
        // Grounding shadow under spinning vinyl coin
        drawToyShadow(ctx, 0, 18 * s, 13 * s, 4 * s, 0.24);
        const spin = Math.max(0.24, Math.abs(Math.sin(this.time * 6 + it.z * 0.1)));
        ctx.scale(spin, 1);
        drawToySphere(ctx, 0, 0, 16 * s, '#ffd166', {
          rimColor: '#92400e',
          lineWidth: toyLineW(32 * s, 0.045, 0.75, 2.0),
          shine: 0.78,
        });
        // Recessed inner gold emblem
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(0, 0, 7.5 * s, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-1.5 * s, -1.5 * s, 3.2 * s, 0, TAU);
        ctx.fill();
      } else if (it.type === 'boost') {
        // Tactile 3D Golden Chevron Booster Pad
        const lw = toyLineW(44 * s, 0.045, 0.8, 2.0);
        const traceChevron = (dy) => {
          ctx.beginPath();
          ctx.moveTo(0, (-22 + dy) * s);
          ctx.lineTo(26 * s, (18 + dy) * s);
          ctx.lineTo(12 * s, (18 + dy) * s);
          ctx.lineTo(0, (-2 + dy) * s);
          ctx.lineTo(-12 * s, (18 + dy) * s);
          ctx.lineTo(-26 * s, (18 + dy) * s);
          ctx.closePath();
        };
        // 3D bottom extruded lip
        ctx.fillStyle = '#d97706';
        traceChevron(4);
        ctx.fill();
        // Volumetric sunlit gradient face
        const bg = ctx.createLinearGradient(0, -22 * s, 0, 18 * s);
        bg.addColorStop(0, '#fef08a');
        bg.addColorStop(0.55, '#ffd166');
        bg.addColorStop(1, '#f59e0b');
        ctx.fillStyle = bg;
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
        traceChevron(0);
        ctx.fill();
        ctx.stroke();

        // Inner specular highlight chevron
        ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
        ctx.beginPath();
        ctx.moveTo(0, -16 * s);
        ctx.lineTo(15 * s, 8 * s);
        ctx.lineTo(7 * s, 8 * s);
        ctx.lineTo(0, -4 * s);
        ctx.lineTo(-7 * s, 8 * s);
        ctx.lineTo(-15 * s, 8 * s);
        ctx.closePath();
        ctx.fill();
      } else if (it.type === 'ramp') {
        // 3D Beveled Vinyl Air Launch Ramp
        drawToyBevelRect(ctx, -30 * s, -14 * s, 60 * s, 24 * s, 7 * s, '#f72585', {
          depth: Math.max(1.5, 4.5 * s),
          rimColor: toyRim('#f72585', 0.56),
          lineWidth: toyLineW(40 * s, 0.05, 0.85, 2.2),
          gloss: true,
        });
        ctx.font = `700 ${Math.max(8, Math.round(12 * s))}px 'Fredoka', 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = Math.max(1.5, 2.6 * s);
        ctx.strokeText('▲ JUMP ▲', 0, -2 * s);
        ctx.fillStyle = '#fef08a';
        ctx.fillText('▲ JUMP ▲', 0, -2 * s);
      }

      ctx.restore();
    }
    ctx.restore();
  }

  renderRivals(ctx) {
    ctx.save();
    for (const r of this.rivals) {
      if (r.fellTimer > 0 || r.z < this.camZ + 15 || r.z > this.playerZ + DRAW_DIST) continue;

      const track = getTrackCenter(r.z);
      const angle = r.u * (Math.PI / 2.3);
      const localX = Math.sin(angle) * TUBE_RADIUS;
      const localY = (1 - Math.cos(angle)) * TUBE_RADIUS;

      const cosB = Math.cos(track.bank);
      const sinB = Math.sin(track.bank);
      const worldX = track.x + (localX * cosB - localY * sinB);
      const rY = (typeof r.y === 'number') ? r.y : 0;
      const worldY = track.y + (localX * sinB + localY * cosB) + rY + 12;

      const proj = this.project(worldX, worldY, r.z);
      if (!proj) continue;

      ctx.save();
      ctx.translate(proj.x, proj.y);
      const s = proj.scale;
      const rim = toyRim(r.color, 0.55);
      const lw = toyLineW(40 * s, 0.045, 0.75, 2.2);

      // Soft grounding shadow on water chute
      drawToyShadow(ctx, 0, 8 * s, 23 * s, 6.5 * s, 0.26);

      // 3D Vinyl Rival Float Sled (extruded bottom rim + glossy top deck)
      ctx.fillStyle = shadeColor(r.color, -0.34);
      ctx.beginPath();
      ctx.ellipse(0, 3 * s, 22 * s, 7 * s, 0, 0, TAU);
      ctx.fill();

      const sledGrad = ctx.createLinearGradient(0, -7 * s, 0, 7 * s);
      sledGrad.addColorStop(0, '#ffffff');
      sledGrad.addColorStop(0.55, '#f1f5f9');
      sledGrad.addColorStop(1, shadeColor(r.color, 0.25));
      ctx.fillStyle = sledGrad;
      ctx.strokeStyle = rim;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.ellipse(0, 0, 22 * s, 7 * s, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Gloss crescent on sled nose
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.ellipse(-5 * s, -2.5 * s, 9 * s, 2.2 * s, -0.1, 0, TAU);
      ctx.fill();

      // Draw Rival Character Bean
      drawBean(ctx, 0, -18 * s, 26 * s, {
        color: r.color,
        bellyColor: shadeColor(r.color, 0.4),
        squash: 0.95,
        walkT: this.wakeAnimT * 0.4,
        eyes: 'happy',
      });

      // 3D Toy Pill Nametag Badge
      drawToyPill(ctx, -30 * s, -49 * s, 60 * s, 16 * s, '#0f172a', {
        rimColor: r.color,
        lineWidth: Math.max(0.9, 1.5 * s),
        gloss: false,
      });
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.max(7, Math.round(8.8 * s))}px 'Fredoka', 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.name, 0, -41 * s);

      ctx.restore();
    }
    ctx.restore();
  }

  renderPlayerSled(ctx) {
    ctx.save();

    // Player sits in foreground
    const track = getTrackCenter(this.playerZ);
    const angle = this.playerU * (Math.PI / 2.3);
    const localX = Math.sin(angle) * TUBE_RADIUS;
    const localY = (1 - Math.cos(angle)) * TUBE_RADIUS;

    const cosB = Math.cos(track.bank);
    const sinB = Math.sin(track.bank);
    const worldX = track.x + (localX * cosB - localY * sinB);
    const trackSurfaceY = track.y + (localX * sinB + localY * cosB) + 14;
    const worldY = trackSurfaceY + this.playerY;

    // Grounding shadow projected on the water slide chute
    if (Math.abs(this.playerU) <= 1.15) {
      const groundProj = this.project(worldX, trackSurfaceY - 4, this.playerZ);
      if (groundProj) {
        const shScale = clamp(1 - this.playerY / 260, 0.35, 1.0);
        const shAlpha = clamp(0.30 - this.playerY * 0.0009, 0.08, 0.30);
        drawToyShadow(ctx, groundProj.x, groundProj.y + 10, 34 * shScale, 9 * shScale, shAlpha);
      }
    }

    const proj = this.project(worldX, worldY, this.playerZ);
    const px = proj ? proj.x : this.W / 2;
    const py = proj ? proj.y : 560;

    ctx.translate(px, py);

    // Mid-air flip or ground bank tilt
    if (this.isAirborne) {
      ctx.rotate(this.flipAngle);
    } else {
      ctx.rotate(this.sledTilt);
    }

    // Twin 3D Beveled Hydrofoil Skis
    drawToyBevelRect(ctx, -26, 17, 14, 6, 3, '#fbbf24', {
      depth: 2,
      rimColor: '#92400e',
      lineWidth: 1.4,
    });
    drawToyBevelRect(ctx, 12, 17, 14, 6, 3, '#fbbf24', {
      depth: 2,
      rimColor: '#92400e',
      lineWidth: 1.4,
    });

    // High-Tech 3D Vinyl Water Sled Hull (extruded under-keel + gradient body + specular shine)
    ctx.fillStyle = '#311068';
    traceRoundRect(ctx, -30, 6, 60, 18, 10);
    ctx.fill();

    const hullGrad = ctx.createLinearGradient(-32, 0, 32, 18);
    hullGrad.addColorStop(0, '#ff4d94');
    hullGrad.addColorStop(0.5, '#7c3aed');
    hullGrad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = hullGrad;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-30, 2, 60, 18, [8, 8, 16, 16]);
    ctx.fill();
    ctx.stroke();

    // Specular plastic sheen along upper sled lip
    ctx.fillStyle = 'rgba(255, 255, 255, 0.44)';
    traceRoundRect(ctx, -25, 3.5, 50, 5, 3);
    ctx.fill();

    // Surfing Mascot Bean!
    drawBean(ctx, 0, -22, 34, {
      color: '#ffd166',
      bellyColor: '#fff7ed',
      squash: this.isAirborne ? 1.15 : 0.95,
      eyes: (this.dead || this.wipeoutTimer > 0 || Math.abs(this.playerU) > 1.15)
        ? 'squish'
        : this.speedBoostTimer > 0
          ? 'alert'
          : 'happy',
      dead: !!this.dead,
    });

    // Glossy 3D Toy Surf Goggles
    const gogGrad = ctx.createLinearGradient(0, -35, 0, -25);
    gogGrad.addColorStop(0, '#38bdf8');
    gogGrad.addColorStop(0.55, '#0f172a');
    gogGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = gogGrad;
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-14, -34, 12, 8, 3.5);
    ctx.roundRect(2, -34, 12, 8, 3.5);
    ctx.fill();
    ctx.stroke();

    // Goggle bridge & bright white studio lens glare
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -30);
    ctx.lineTo(2, -30);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-10, -32, 3.5, 1.3, -0.35, 0, TAU);
    ctx.ellipse(6, -32, 3.5, 1.3, -0.35, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  renderSpeedEffects(ctx, W, H) {
    ctx.save();
    // 1. Glossy 3D water spray droplets behind sled
    const track = getTrackCenter(this.playerZ);
    const angle = this.playerU * (Math.PI / 2.3);
    const localX = Math.sin(angle) * TUBE_RADIUS;
    const localY = (1 - Math.cos(angle)) * TUBE_RADIUS;

    const proj = this.project(track.x + localX, track.y + localY + 6, this.playerZ);
    const originX = proj ? proj.x : W / 2;
    const originY = proj ? proj.y : 580;

    for (const p of this.sprayParticles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha * 0.9;
      drawToySphere(ctx, originX + p.x, originY + p.y, Math.max(1.8, p.scale), '#bae6fd', {
        rimColor: '#0284c7',
        lineWidth: 0.7,
        shine: 0.75,
        bottomBounce: false,
      });
    }
    ctx.globalAlpha = 1;

    // 2. Supersonic Speed Lines during Boost
    if (this.speedBoostTimer > 0) {
      const alpha = Math.min(0.65, this.speedBoostTimer * 0.35);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.5;

      for (let i = 0; i < 14; i++) {
        const lx = Math.random() * W;
        const ly = 180 + Math.random() * 450;
        const len = 40 + Math.random() * 80;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + (lx - W / 2) * 0.25, ly + len);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  renderHUD(ctx, W) {
    ctx.save();
    const barY = 94;

    // 1. Top Toy Bevel HUD Capsule (Rank, Distance, Coins)
    drawToyBevelRect(ctx, 14, barY, W - 28, 42, 21, '#0f172a', {
      depth: 3,
      rimColor: '#38bdf8',
      lineWidth: 2,
      gloss: false,
    });

    // Rank Badge
    const rankCol = this.rank === 1 ? '#ffd166' : this.rank === 2 ? '#cbd5e1' : '#fb923c';
    ctx.fillStyle = rankCol;
    ctx.font = "700 15px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.strokeText(`${this.rank === 1 ? '🥇' : '🏁'} #${this.rank}`, 30, barY + 21);
    ctx.fillText(`${this.rank === 1 ? '🥇' : '🏁'} #${this.rank}`, 30, barY + 21);

    // Large Distance Counter in Center
    ctx.fillStyle = '#ffffff';
    ctx.font = "700 19px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.strokeText(`${this.distanceMeters.toLocaleString()} M`, W / 2, barY + 21);
    ctx.fillText(`${this.distanceMeters.toLocaleString()} M`, W / 2, barY + 21);

    // Coins Collected
    ctx.fillStyle = '#ffd166';
    ctx.font = "700 14px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'right';
    ctx.strokeText(`💰 ${this.coins}`, W - 28, barY + 21);
    ctx.fillText(`💰 ${this.coins}`, W - 28, barY + 21);

    // 2. Toy Speedometer Gauge (Bottom-Left)
    const speedKmh = Math.round((this.speed / 5) * 1.8);
    drawToyBevelRect(ctx, 16, 658, 112, 46, 13, '#0f172a', {
      depth: 3,
      rimColor: this.speedBoostTimer > 0 ? '#ffd166' : '#00b4d8',
      lineWidth: 2,
      gloss: false,
    });

    ctx.fillStyle = '#ffffff';
    ctx.font = "700 18px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(`${speedKmh}`, 72, 676);

    ctx.fillStyle = this.speedBoostTimer > 0 ? '#ffd166' : '#38bdf8';
    ctx.font = "700 10px 'Fredoka', 'Outfit', sans-serif";
    ctx.fillText('KM/H RUSH', 72, 693);

    // 3. Stunt / Air Time Pill if flying
    if (this.isAirborne) {
      drawToyPill(ctx, W / 2 - 84, 150, 168, 34, '#f72585', {
        rimColor: toyRim('#f72585', 0.55),
        lineWidth: 2,
        gloss: true,
      });

      ctx.font = "700 13px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const prompt = this.flipSpins > 0 ? `FLIP x${this.flipSpins}! 🔄` : 'HOLD TO FLIP! 🚀';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeText(prompt, W / 2, 167);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(prompt, W / 2, 167);
    }

    // 4. Multiplier Combo Pill Badge
    if (this.combo > 1) {
      drawToyPill(ctx, W - 122, 667, 106, 30, '#f59e0b', {
        rimColor: '#92400e',
        lineWidth: 2,
        gloss: true,
      });
      ctx.font = "700 13px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.8;
      ctx.strokeText(`x${this.combo} BOOST`, W - 69, 682);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`x${this.combo} BOOST`, W - 69, 682);
    }

    ctx.restore();
  }
}
