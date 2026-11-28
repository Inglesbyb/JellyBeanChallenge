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

function formatOrdinal(n) {
  const v = Math.max(1, Math.round(n));
  const mod100 = v % 100;
  let suffix = 'TH';
  if (mod100 < 11 || mod100 > 13) {
    if (v % 10 === 1) suffix = 'ST';
    else if (v % 10 === 2) suffix = 'ND';
    else if (v % 10 === 3) suffix = 'RD';
  }
  return { num: `${v}`, suffix, full: `${v}${suffix}` };
}

// Half-pipe geometry constants
const TUBE_RADIUS = 150; // Radius of the curved half-pipe chute
const SEG_LENGTH = 36;   // World units per track slice
const DRAW_DIST = 1600;  // How far ahead to render track segments
const FOCAL_LEN = 280;   // 3D perspective projection focal length
const SAFE_RIM_U = 1.04; // Player steering stays safely atop the banked safety rails
const FALL_RIM_U = 1.28; // Only strong shoves or extreme air drift vault past outer rim

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
    parScore60s: 15000,
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
    this.playerU = clamp(saved?.playerU || 0, -0.85, 0.85); // Normalized lateral position: -1 (left rim), 0 (chute bed), 1 (right rim)
    this.playerTargetU = this.playerU;
    this.playerVu = 0; // Lateral carve velocity for heavy rival slams
    this.playerBumpVu = 0; // Lateral shove velocity when rivals bump you
    this.playerBumpTimer = 0;
    this.playerY = 0; // Altitude above track surface (0 when sliding on water)
    this.playerVy = 0;
    this.isAirborne = false;
    this.flipAngle = 0; // Mid-air stunt rotation in radians
    this.flipSpins = 0; // Completed 360 spins during current jump
    this.isFlipping = false;

    // Movement & Speed (scaled by SSOT Prestige slope; start gently so opening 3.5s is easy to handle)
    this.baseSpeed = this.diff.baseSpeed ?? 520;
    this.speed = saved?.speed ? Math.max(this.baseSpeed * 0.72, saved.speed) : this.baseSpeed * 0.72;
    this.maxSpeed = this.diff.maxSpeed ?? 1050;
    this.speedBoostTimer = 0;
    this.wipeoutTimer = 0; // Non-lethal spinout recovery
    this.openingSafeTimer = saved ? 2.5 : 4.0;
    this.bumpCooldown = 0;

    // Distance & Race Metrics
    this.distanceMeters = Math.floor(this.playerZ / 10);
    this.lastMilestone = Math.floor(this.distanceMeters / 500) * 500;
    this.coins = saved?.coins || 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.rank = 6;
    this.lastRank = 6;
    this.rankPopTimer = 0;
    this.rankToastCd = 0;
    this.lastCcTier = '50cc';

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

    // Procedural Obstacles, Ramps & Pickups (keep opening runway clear before first ramp)
    this.items = [];
    this.spawnStartZ = this.playerZ;
    this.nextItemZ = this.playerZ + 520;

    // Rival AI Surfers staggered safely ahead in clear lanes so nobody bumps you at frame 1
    const agg = this.diff.rivalAggroMult ?? 1;
    this.rivals = [
      { id: 1, name: 'SplashBro',  color: '#f72585', z: this.playerZ + 120, u: -0.52, vu: 0, speed: this.baseSpeed * 0.84, y: 0, vy: 0, aggression: 0.96 * agg, fellTimer: 0, shoveCd: 0, knockTimer: 0 },
      { id: 2, name: 'WaveKing',   color: '#ffb703', z: this.playerZ + 195, u:  0.48, vu: 0, speed: this.baseSpeed * 0.86, y: 0, vy: 0, aggression: 1.00 * agg, fellTimer: 0, shoveCd: 0, knockTimer: 0 },
      { id: 3, name: 'TurboBean',  color: '#06d6a0', z: this.playerZ + 270, u: -0.24, vu: 0, speed: this.baseSpeed * 0.82, y: 0, vy: 0, aggression: 0.94 * agg, fellTimer: 0, shoveCd: 0, knockTimer: 0 },
      { id: 4, name: 'DriftQueen', color: '#7209b7', z: this.playerZ + 345, u:  0.26, vu: 0, speed: this.baseSpeed * 0.88, y: 0, vy: 0, aggression: 1.03 * agg, fellTimer: 0, shoveCd: 0, knockTimer: 0 },
      { id: 5, name: 'HydroBlitz', color: '#ef4444', z: this.playerZ + 430, u: -0.05, vu: 0, speed: this.baseSpeed * 0.90, y: 0, vy: 0, aggression: 1.05 * agg, fellTimer: 0, shoveCd: 0, knockTimer: 0 },
    ];
    this.lastRank = 6;
    this.rank = 6;

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
    this.grace = saved ? 2.5 : 3.5;
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

  /* ---------------------------------------------------- Mario-Style Intensity */
  getRaceIntensity() {
    const total = (this.rivals?.length || 5) + 1;
    // Higher placement (6th -> 1st) AND farther distance crank up CC speed, rival rubber-banding & hazards!
    const rankFactor = clamp((total - this.rank) / Math.max(1, total - 1), 0, 1);
    const distFactor = clamp(this.distanceMeters / 2600, 0, 1);
    const heat = clamp(rankFactor * 0.65 + distFactor * 0.45, 0, 1.15);

    if (heat < 0.25) {
      return { cc: '50cc', tag: 'CHILL', col: '#4ade80', heat, speedAdd: 0, rubberBand: 0.91, hazardChance: 0.0 };
    }
    if (heat < 0.55) {
      return { cc: '100cc', tag: 'PACK', col: '#38bdf8', heat, speedAdd: 85, rubberBand: 0.99, hazardChance: 0.12 };
    }
    if (heat < 0.85) {
      return { cc: '150cc', tag: 'PRO', col: '#fbbf24', heat, speedAdd: 175, rubberBand: 1.08, hazardChance: 0.20 };
    }
    return { cc: '200cc', tag: 'CHAMPS', col: '#f43f5e', heat, speedAdd: 265, rubberBand: 1.16, hazardChance: 0.28 };
  }

  /* ---------------------------------------------------- Procedural Spawning */
  spawnItemBatch(z) {
    const roll = Math.random();
    const introStretch = (z - (this.spawnStartZ || 0)) < 1200;
    const tier = this.getRaceIntensity();

    // When trailing (5th/6th), deal catch-up boosts like Mario Kart; when leading (1st/2nd), deal more hazards!
    if (!introStretch && tier.hazardChance > 0 && roll < tier.hazardChance) {
      const u = (Math.random() - 0.5) * 1.15;
      this.items.push({ type: 'hazard', z, u, collected: false });
      return;
    }

    if (!introStretch && roll < tier.hazardChance + 0.25) {
      // Occasional High-Air Launch Ramp (introduced cleanly after opening run)
      const u = (Math.random() - 0.5) * 0.65;
      this.items.push({ type: 'ramp', z, u, collected: false });
    } else if (roll < (introStretch ? 0.35 : 0.62)) {
      // Golden Boost Chevron Pad (weighted higher when catching up)
      const u = (Math.random() - 0.5) * 0.72;
      this.items.push({ type: 'boost', z, u, collected: false });
    } else {
      // Graceful Arc of Gold Coins along the slide curve
      const centerU = (Math.random() - 0.5) * 0.78;
      for (let i = 0; i < 4; i++) {
        this.items.push({
          type: 'coin',
          z: z + i * 26,
          u: centerU + Math.sin(i * 0.5) * 0.16,
          collected: false,
        });
      }
    }
  }

  /* ---------------------------------------------------- Update Loop */
  update(dt) {
    if (this.dead) return;
    this.time += dt;
    if (this.openingSafeTimer > 0) this.openingSafeTimer = Math.max(0, this.openingSafeTimer - dt);
    if (this.bumpCooldown > 0) this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    if (this.rankPopTimer > 0) this.rankPopTimer = Math.max(0, this.rankPopTimer - dt);
    if (this.rankToastCd > 0) this.rankToastCd = Math.max(0, this.rankToastCd - dt);
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
    const startDragOffset = Math.abs((this.input.x ?? 0) - (this.input.startX ?? 0));

    // Touch/Mouse Dragging (supports both natural relative drag AND gentle off-center hold)
    if (this.input.down) {
      const fdx = this.input.frameDX || 0;
      if (Math.abs(fdx) > 0.05) {
        this.playerTargetU = clamp(this.playerTargetU + fdx / (this.W * 0.36), -SAFE_RIM_U, SAFE_RIM_U);
      } else if (startDragOffset < 8 && Math.abs((this.input.x ?? this.W / 2) - this.W / 2) > 42) {
        const sideDir = Math.sign(this.input.x - this.W / 2);
        this.playerTargetU = clamp(this.playerTargetU + sideDir * 1.95 * dt, -SAFE_RIM_U, SAFE_RIM_U);
      }
    } else {
      // Keyboard A/D or ArrowLeft/ArrowRight (capped safely inside chute walls)
      let keyDir = 0;
      if (this.keys.left) keyDir -= 1;
      if (this.keys.right) keyDir += 1;
      if (keyDir !== 0) {
        this.playerTargetU = clamp(this.playerTargetU + keyDir * 2.35 * dt, -SAFE_RIM_U, SAFE_RIM_U);
      }
    }

    // Smooth lateral movement interpolation + rival knockback kick & velocity tracking
    const prevU = this.playerU;
    const steerSpeed = this.isAirborne ? 4.2 : 6.4;
    if (this.playerBumpTimer > 0) {
      this.playerBumpTimer = Math.max(0, this.playerBumpTimer - dt);
      this.playerU += this.playerBumpVu * dt;
      this.playerBumpVu *= Math.pow(0.16, dt);
    }
    this.playerU += (this.playerTargetU - this.playerU) * Math.min(1.0, steerSpeed * dt);
    this.playerVu = dt > 1e-4 ? (this.playerU - prevU) / dt : 0;

    // Safety cushion on yellow outer rails during opening grace OR gentle rim touches
    if (this.openingSafeTimer > 0 || this.grace > 0) {
      if (Math.abs(this.playerU) > 1.06) {
        this.playerU = clamp(this.playerU, -1.06, 1.06);
        this.playerTargetU = clamp(this.playerTargetU, -SAFE_RIM_U, SAFE_RIM_U);
      }
    }

    // Sled banking roll based on lateral position on the curved half-pipe
    const targetRoll = this.playerU * 0.52;
    this.sledTilt += (targetRoll - this.sledTilt) * Math.min(1.0, 10 * dt);

    // Only vault off the outer lip if forced well past the yellow safety rail!
    if (Math.abs(this.playerU) > FALL_RIM_U) {
      if (!this.isAirborne) {
        // Starts falling off the slide!
        this.isAirborne = true;
        this.playerVy = -20; // Starts descending with time to pull back inward
        this.sounds.whoosh();
        this.haptics.heavy();
        this.fx.burst(this.W / 2, 560, '#ffffff', 16, 140, 0.4, 3);
        this.fx.text(this.W / 2, 300, 'PULL BACK IN! ⚠️', '#ef4444', 22, 0.8);
      }
    }
  }

  updateSpeed(dt) {
    const tier = this.getRaceIntensity();

    // Wipeout recovery (keep sled sliding smoothly while slowing so camera never freezes)
    if (this.wipeoutTimer > 0) {
      this.wipeoutTimer -= dt;
      this.speed = Math.max(280, this.speed - 360 * dt);
      this.playerZ += this.speed * dt;
      return;
    }

    const capSpeed = this.maxSpeed + tier.heat * 140;

    // Speed boost countdown
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      this.speed = Math.min(capSpeed, this.speed + 480 * dt);
      this.fovPunch = Math.min(1.0, this.fovPunch + dt * 4);
    } else {
      // Smooth opening ramp-up over first 3.5s, then escalates the higher in rank/distance you climb!
      const introRamp = Math.min(1.0, (this.time + 0.8) / 4.0);
      const cruiseSpeed = Math.min(
        capSpeed - 80,
        this.baseSpeed * (0.72 + 0.28 * introRamp) + tier.speedAdd + (this.playerZ * 0.012),
      );
      this.speed += (cruiseSpeed - this.speed) * Math.min(1.0, 1.9 * dt);
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

    const overEdge = Math.abs(this.playerU) > FALL_RIM_U;
    // Gravity (forgiving air fall speed gives time to counter-steer back into the chute)
    const gravity = overEdge ? 720 : 660;
    this.playerVy -= gravity * dt;
    this.playerY += this.playerVy * dt;

    // Flip stunt control: Holding Space/Up or dragging high up the screen (y < 320) during air time
    const flipInput = this.keys.space || (this.input.down && this.input.y < 320);
    if (flipInput && !overEdge) {
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
    if (overEdge) {
      if (this.openingSafeTimer > 0 || this.grace > 0) {
        // Opening/restore safeguard: pull back safely onto track rim instead of plunging!
        this.playerU = clamp(this.playerU, -1.0, 1.0);
        this.playerTargetU = clamp(this.playerTargetU, -SAFE_RIM_U, SAFE_RIM_U);
        this.playerY = Math.max(0, this.playerY);
        if (this.playerY <= 0) {
          this.isAirborne = false;
          this.playerVy = 0;
        }
        return;
      }

      // Sled tumbles outwards in the air
      this.sledTilt += Math.sign(this.playerU) * 6.5 * dt;

      // Generous altitude threshold (-75) so pulling back inward can save you
      if (this.playerY < -75) {
        if (this.die('Fell off the slide!')) {
          this.sounds.fail();
          this.haptics.fail();
          this.fx.screenShake(18, 0.6);
          this.fx.burst(this.W / 2, 540, '#00b4d8', 30, 240, 0.8, 5);
          this.fx.text(this.W / 2, 340, 'FELL OFF THE SLIDE! 🌊', '#ef4444', 26, 1.2);
        }
        return;
      }
      return; // Still falling, do not touch down
    }

    // Touchdown on half-pipe water slide (within slide bounds |u| <= FALL_RIM_U)
    if (this.playerY <= 0) {
      this.playerY = 0;
      this.playerVy = 0;
      this.isAirborne = false;

      // Evaluate landing stunt angle with generous tolerance
      const remAngle = (this.flipAngle % TAU);
      const isCleanLanding = remAngle < 0.95 || remAngle > (TAU - 0.95) || this.flipSpins === 0;

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
      const hitU = item.type === 'hazard' ? 0.27 : 0.40;
      const hitZMin = item.type === 'hazard' ? -18 : -25;
      const hitZMax = item.type === 'hazard' ? 28 : 35;
      if (dz > hitZMin && dz < hitZMax && this.playerY < 35 && du < hitU) {
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
        } else if (item.type === 'hazard') {
          item.collected = true;
          if (this.openingSafeTimer <= 0 && this.grace <= 0 && this.wipeoutTimer <= 0) {
            this.triggerWipeout('Hit a warning buoy!');
          }
        }
      }
    }
  }

  triggerRivalKnockout(r, byPlayer = true) {
    r.fellTimer = 3.0;
    r.knockOutAnim = 0.65;
    r.vy = 190;
    if (byPlayer) {
      this.score += 300 * this.combo;
      this.speedBoostTimer = Math.max(this.speedBoostTimer, 1.25);
      this.sounds.powerup();
      this.haptics.heavy();
      this.fx.text(this.W / 2, 310, `KNOCKED OUT ${r.name}! 🌊 +300`, '#06d6a0', 22, 1.2);
      this.fx.burst(this.W / 2, 520, '#ffd166', 24, 220, 0.6, 4);
    }
  }

  updateRivals(dt) {
    const tier = this.getRaceIntensity();

    // Dynamic Mario-Style Pack Racing & Competitive AI
    for (const r of this.rivals) {
      if (r.shoveCd > 0) r.shoveCd = Math.max(0, r.shoveCd - dt);
      if (r.knockTimer > 0) r.knockTimer = Math.max(0, r.knockTimer - dt);

      // Animate knocked-out rival tumbling off the side rail into the ocean!
      if (r.fellTimer > 0) {
        r.fellTimer -= dt;
        if (r.knockOutAnim > 0) {
          r.knockOutAnim = Math.max(0, r.knockOutAnim - dt);
          r.u += (r.vu || Math.sign(r.u || 1) * 3.0) * dt;
          r.vy -= 680 * dt;
          r.y += r.vy * dt;
          r.z += r.speed * 0.7 * dt;
        }
        if (r.fellTimer <= 0) {
          r.z = this.playerZ - 160;
          r.u = (Math.random() - 0.5) * 0.9;
          r.vu = 0;
          r.y = 0;
          r.vy = 0;
          r.knockTimer = 0;
        }
        continue;
      }

      // 1. Balanced Mario-Style Rubber-Banding AI:
      // Leaders ahead stay catchable so you can overtake into 1st; followers draft hard behind to pressure you!
      const distFromPlayer = r.z - this.playerZ;
      let targetSpeed;

      if (distFromPlayer < -35) {
        // Behind player: Draft hard to reclaim spots, stronger at higher CC!
        targetSpeed = this.speed * (1.03 + tier.heat * 0.10) * clamp(r.aggression, 0.94, 1.06);
      } else if (distFromPlayer > 35) {
        // Ahead of player: Capped slightly under player pace so skilled driving catches & passes 1st!
        const aheadCap = this.rank >= 4 ? 0.88 : 0.945;
        targetSpeed = this.speed * aheadCap;
      } else {
        // Side-by-side battle pack: Jostle closely around your speed!
        targetSpeed = this.speed * (0.97 + 0.06 * Math.sin(this.time * 2.1 + r.id));
      }

      r.speed += (targetSpeed - r.speed) * Math.min(1.0, 3.5 * dt);
      r.z += r.speed * dt;

      // 2. Fair Pack Recycling: passed rivals recycle BEHIND you to earn passes legitimately
      if (r.z < this.playerZ - 260) {
        r.z = this.playerZ - 135 - Math.random() * 60;
        const offsetSign = this.playerU >= 0 ? -1 : 1;
        r.u = clamp(this.playerU + offsetSign * (0.40 + Math.random() * 0.45), -0.88, 0.88);
        r.vu = 0;
        r.knockTimer = 0;
        r.speed = this.speed * (1.02 + tier.heat * 0.06);
      } else if (r.z > this.playerZ + 440) {
        r.z = this.playerZ + 220 + Math.random() * 110;
      }

      // 3. Lateral Knockback Physics OR Autonomous Weaving (rivals sometimes ride high banks)
      if (r.knockTimer > 0) {
        r.u += r.vu * dt;
        r.vu *= Math.pow(0.18, dt);
        if (Math.abs(r.u) > 1.14) {
          this.triggerRivalKnockout(r, true);
          continue;
        }
      } else {
        let targetU = Math.sin(r.z * 0.0075 + r.id * 1.7) * 0.86;
        // Rivals alongside you actively lean in to contest & bump you back (harder at higher CC!)
        if (tier.heat >= 0.25 && Math.abs(distFromPlayer) < 105 && this.openingSafeTimer <= 0) {
          const aggroBlend = clamp(0.24 + tier.heat * 0.14, 0.24, 0.38);
          targetU = targetU * (1 - aggroBlend) + clamp(this.playerU, -0.95, 0.95) * aggroBlend;
        }
        r.u += (targetU - r.u) * Math.min(1.0, 2.9 * dt);
      }

      // 4. Two-Way Tactical Bump Physics (center hits jostle; edge hits knock rivals out!)
      if (this.time > 1.0 && r.shoveCd <= 0 && !this.dead) {
        const dz = Math.abs(r.z - this.playerZ);
        const du = Math.abs(r.u - this.playerU);

        if (dz < 50 && du < 0.42 && this.playerY < 45) {
          const pushDir = Math.sign(r.u - this.playerU) || (this.playerVu !== 0 ? Math.sign(this.playerVu) : 1);
          const carveSpeed = Math.abs(this.playerVu);
          const playerInitiated = carveSpeed > 0.65 || this.speedBoostTimer > 0;
          const boostPower = this.speedBoostTimer > 0 ? 0.55 : 0;

          // Modest lateral impulse: ~0.35 on casual touch, ~0.50 on slam -> KOs rivals close to the rail!
          const rivalImpulse = playerInitiated
            ? clamp(1.38 + carveSpeed * 0.22 + boostPower, 1.38, 1.92)
            : 1.05;
          r.vu = pushDir * rivalImpulse;
          r.u += pushDir * (playerInitiated ? 0.08 : 0.05);
          r.knockTimer = playerInitiated ? 0.42 : 0.34;
          r.shoveCd = 0.45;

          // Two-way counter-bump: stronger lateral kick & momentary pace check when rivals slam you!
          if (this.openingSafeTimer <= 0 && this.grace <= 0 && this.bumpCooldown <= 0) {
            const playerRecoil = playerInitiated ? 0.24 : (0.40 + tier.heat * 0.14);
            const maxBumpU = (this.rank >= 4 && this.prestige === 1) ? 1.12 : 1.30;
            this.playerBumpVu = -pushDir * (playerInitiated ? 0.85 : (1.35 + tier.heat * 0.45));
            this.playerBumpTimer = playerInitiated ? 0.20 : 0.28;
            this.playerU = clamp(this.playerU - pushDir * (playerRecoil * 0.50), -maxBumpU, maxBumpU);
            this.playerTargetU = clamp(this.playerTargetU - pushDir * playerRecoil, -maxBumpU, maxBumpU);
            this.bumpCooldown = 0.35;
            if (!playerInitiated) {
              this.speed = Math.max(280, this.speed - 45);
            }
          }

          if (playerInitiated) {
            this.speed = Math.min(this.maxSpeed + tier.heat * 140, this.speed + 20);
          }
          this.fx.screenShake(6, 0.20);
          this.sounds.hit();
          this.haptics.medium();
          this.fx.burst(this.W / 2, 540, r.color, 16, 160, 0.45, 3);

          if (Math.abs(r.u) > 1.14) {
            this.triggerRivalKnockout(r, true);
          } else {
            const label = playerInitiated ? `SLAM! 💥` : `RIVAL BUMP! 💥`;
            this.fx.text(this.W / 2, 370, label, '#ffd166', 18, 0.55);
          }
        }
      }
    }

    // Chain Knockback: sliding rivals jostle neighbors without catapulting midfielders out
    for (let i = 0; i < this.rivals.length; i++) {
      const a = this.rivals[i];
      if (a.fellTimer > 0 || a.knockTimer <= 0) continue;
      for (let j = 0; j < this.rivals.length; j++) {
        if (i === j) continue;
        const b = this.rivals[j];
        if (b.fellTimer > 0 || b.shoveCd > 0) continue;
        if (Math.abs(a.z - b.z) < 40 && Math.abs(a.u - b.u) < 0.34) {
          const dir = Math.sign(b.u - a.u) || Math.sign(a.vu) || 1;
          b.vu = dir * 1.25;
          b.u += dir * 0.06;
          b.knockTimer = 0.36;
          b.shoveCd = 0.48;
          if (Math.abs(b.u) > 1.14) this.triggerRivalKnockout(b, true);
        }
      }
    }

    // Dynamic Race Placement (1st, 2nd, 3rd, 4th, 5th, 6th)
    let currentRank = 1;
    let leaderName = null;
    for (const r of this.rivals) {
      if (r.fellTimer <= 0 && r.z > this.playerZ) {
        currentRank++;
        if (!leaderName) leaderName = r.name;
      }
    }

    if (currentRank !== this.lastRank) {
      this.rankPopTimer = 0.45;
      if (this.rankToastCd <= 0) {
        const ord = formatOrdinal(currentRank).full;
        if (currentRank === 1 && this.lastRank > 1) {
          this.fx.text(this.W / 2, 276, `TAKEN 1ST PLACE! 👑`, '#ffd166', 24, 1.0);
          this.sounds.upgrade();
          this.rankToastCd = 1.0;
        } else if (currentRank < this.lastRank) {
          this.fx.text(this.W / 2, 276, `UP TO ${ord}! 🔥`, '#4ade80', 21, 0.85);
          this.sounds.coin();
          this.rankToastCd = 0.9;
        } else if (currentRank > 1 && this.lastRank === 1) {
          this.fx.text(this.W / 2, 276, `${leaderName || 'Rival'} TOOK 1ST! 💨`, '#f72585', 20, 0.85);
          this.rankToastCd = 1.0;
        }
      }
    }

    if (tier.cc !== this.lastCcTier) {
      this.lastCcTier = tier.cc;
      if (this.time > 2.5) {
        this.fx.text(this.W / 2, 326, `${tier.cc.toUpperCase()} ${tier.tag} PACE! 🏁`, tier.col, 20, 0.9);
      }
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
      } else if (it.type === 'hazard') {
        // Mario-Style Striped Warning Hazard Buoy (appears when leading / high CC!)
        drawToyShadow(ctx, 0, 14 * s, 18 * s, 5 * s, 0.30);
        drawToySphere(ctx, 0, -2 * s, 17 * s, '#ef4444', {
          rimColor: '#0f172a',
          lineWidth: toyLineW(34 * s, 0.055, 0.9, 2.4),
          shine: 0.72,
        });
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, -2 * s, 14 * s, 5 * s, -0.35, 0, TAU);
        ctx.fill();
        ctx.font = `900 ${Math.max(9, Math.round(14 * s))}px 'Fredoka', 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0f172a';
        ctx.fillText('!', 0, -2 * s);
      }

      ctx.restore();
    }
    ctx.restore();
  }

  renderRivals(ctx) {
    ctx.save();
    for (const r of this.rivals) {
      if ((r.fellTimer > 0 && !(r.knockOutAnim > 0)) || r.z < this.camZ + 15 || r.z > this.playerZ + DRAW_DIST) continue;

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
      if (r.knockOutAnim > 0) ctx.rotate((1 - r.knockOutAnim / 0.65) * 6.5);
      else if (r.knockTimer > 0) ctx.rotate(Math.sin(this.time * 28) * 0.25);
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
        eyes: (r.knockTimer > 0 || r.knockOutAnim > 0) ? 'squish' : 'happy',
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
      eyes: (this.dead || this.wipeoutTimer > 0 || Math.abs(this.playerU) > 1.02)
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
    const ord = formatOrdinal(this.rank);
    const tier = this.getRaceIntensity();
    const totalRacers = (this.rivals?.length || 5) + 1;

    // 1. Top Toy Bevel HUD Capsule (Placement, Distance, Coins)
    drawToyBevelRect(ctx, 14, barY, W - 28, 42, 21, '#0f172a', {
      depth: 3,
      rimColor: '#38bdf8',
      lineWidth: 2,
      gloss: false,
    });

    // Ordinal Placement Label
    const rankCol =
      this.rank === 1 ? '#fde047'
      : this.rank === 2 ? '#e2e8f0'
      : this.rank === 3 ? '#fb923c'
      : this.rank <= 4 ? '#38bdf8'
      : '#f472b6';
    const rankIcon = this.rank === 1 ? '🥇' : this.rank === 2 ? '🥈' : this.rank === 3 ? '🥉' : '🏁';
    ctx.fillStyle = rankCol;
    ctx.font = "900 15px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.strokeText(`${rankIcon} ${ord.full}`, 28, barY + 21);
    ctx.fillText(`${rankIcon} ${ord.full}`, 28, barY + 21);

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

    // 1b. Upper-Left Mario-Style CC Intensity Tier Pill (`16..126`, Y = 148)
    drawToyBevelRect(ctx, 16, 148, 110, 38, 12, '#0f172a', {
      depth: 2.5,
      rimColor: tier.col,
      lineWidth: 2,
      gloss: false,
    });
    ctx.fillStyle = tier.col;
    ctx.font = "900 14px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(`${tier.cc} ${tier.tag}`, 71, 167);

    // 1c. Upper-Right Mario Kart Big Placement Emblem (`W - 104 .. W - 16`, Y = 148)
    ctx.save();
    const popScale = 1 + (this.rankPopTimer > 0 ? Math.sin((this.rankPopTimer / 0.45) * Math.PI) * 0.22 : 0);
    ctx.translate(W - 60, 171);
    ctx.scale(popScale, popScale);
    drawToyBevelRect(ctx, -44, -23, 88, 46, 14, '#0f172a', {
      depth: 3,
      rimColor: rankCol,
      lineWidth: 2.4,
      gloss: true,
    });
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.font = "900 26px 'Fredoka', 'Outfit', sans-serif";
    ctx.fillStyle = rankCol;
    ctx.strokeText(ord.num, -4, 0);
    ctx.fillText(ord.num, -4, 0);

    ctx.textAlign = 'left';
    ctx.font = "900 11px 'Fredoka', 'Outfit', sans-serif";
    ctx.strokeText(ord.suffix, -2, -7);
    ctx.fillText(ord.suffix, -2, -7);

    ctx.fillStyle = '#94a3b8';
    ctx.font = "700 10px 'Fredoka', 'Outfit', sans-serif";
    ctx.fillText(`/ ${totalRacers}`, -2, 8);
    ctx.restore();

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
