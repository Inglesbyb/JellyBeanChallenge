import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// 3 Track Lanes: -1 (Left), 0 (Center), 1 (Right)
const LANE_DIST = 110;
const LANES = [-1, 0, 1];

export class SubwaySurfers extends Game {
  static meta = {
    id: 'subway-surfers',
    title: 'Subway Bean Surfers',
    icon: '🚇',
    hint: 'SWIPE Left/Right to dodge trains · SWIPE Up to jump · SWIPE Down to slide! Double tap for Surfboard!',
    baseLikes: 8240,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    // 2.5D Perspective Projection Constants
    this.horizonX = this.W / 2;
    this.horizonY = 205;
    this.groundY = 645;
    this.camD = 220;

    // World & Movement Physics
    this.speed = 440; // Forward speed (units/sec)
    this.maxSpeed = 740;
    this.distance = 0;
    this.trackOffset = 0;
    this.coins = 0;
    this.scoreMultiplier = 1;

    // Time of Day / Cartoon Sky Phase (0: Sunny Blue Sky, 1: Cotton Candy Sunset, 2: Golden Hour)
    this.currentZone = 0;

    // Player State
    this.lane = 0; // -1, 0, 1
    this.laneX = 0; // Rendered lane offset (-110 to 110)
    this.playerBaseY = 0; // 0 on track, 95 on train roof
    this.jumpY = 0;
    this.jumpVY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.onTrain = false;
    this.rollAngle = 0;
    this.spinAngle = 0;
    this.tiltAngle = 0;
    this.runAnimT = 0;
    this.stepTimer = 0;
    this.deathTimer = 0;

    // Inspector & Bulldog Pursuit System
    // Coordinates: z = -22 is right behind runner (y ~ 685), z = -130 is off-screen behind camera
    this.introChaseTimer = 4.2; // Chasing close at run start!
    this.inspectorZ = -22; // In full view right behind runner!
    this.inspectorLaneX = 0;
    this.stumbleTimer = 0; // When stumbled, Inspector rushes up
    this.stumbleCooldown = 0;

    // Surfboard (Hoverboard) & Shield System
    this.hoverboardActive = false;
    this.hoverboardTimer = 0;
    this.hoverboardStock = 2;

    // Active Power-up Timers
    this.magnetTimer = 0;
    this.jetpackTimer = 0;
    this.sneakerTimer = 0;
    this.doubleTimer = 0;
    this.parachuteTimer = 0;

    // Word Hunt: "B-E-A-N" for 1,000 Coin Jackpot
    this.lettersCollected = { B: false, E: false, A: false, N: false };

    // Procedural Spawning Trackers (Z distance ahead of camera)
    this.worldObjects = [];
    this.nextSpawnZ = 280;
    this.nextTrainZ = 620;
    this.nextLetterZ = 950;
    this.nextMysteryZ = 800;

    // Start-of-run Spray Paint intro animation
    this.sprayIntroT = 1.4;

    // Touch & Swipe Gesture Tracker
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.lastTapTime = 0;

    // Keyboard states
    this.prevKeyLeft = false;
    this.prevKeyRight = false;
    this.prevKeyUp = false;
    this.prevKeyDown = false;
    this.prevKeyBoard = false;

    // Scenery Elements: Cartoon Wooden Archways & Candy-striped Signal Posts
    this.gantries = Array.from({ length: 8 }, (_, i) => ({
      z: i * 220,
      color: i % 2 === 0 ? '#38bdf8' : '#fb923c',
      signal: i % 3 === 0 ? 'green' : (i % 3 === 1 ? 'red' : 'yellow'),
    }));

    // Distant cartoon clouds with fluffy marshmallow shapes
    this.clouds = Array.from({ length: 6 }, (_, i) => ({
      x: 20 + i * 85,
      y: 30 + (i % 3) * 28,
      w: 48 + Math.random() * 30,
      h: 22 + Math.random() * 12,
      speed: 7 + Math.random() * 8,
    }));

    // Rolling cartoon hills
    this.hills = Array.from({ length: 5 }, (_, i) => ({
      x: i * 110,
      r: 85 + Math.random() * 40,
      color: i % 2 === 0 ? '#86efac' : '#4ade80',
    }));

    // Restore saved session state if available
    if (saved) {
      this.distance = Number.isFinite(saved.distance) ? saved.distance : 0;
      this.coins = Number.isFinite(saved.coins) ? saved.coins : 0;
      this.scoreMultiplier = Number.isFinite(saved.scoreMultiplier) ? saved.scoreMultiplier : 1;
      this.hoverboardStock = Number.isFinite(saved.hoverboardStock) ? saved.hoverboardStock : 2;
      this.lettersCollected = Object.assign({ B: false, E: false, A: false, N: false }, saved.lettersCollected);
      this.grace = 1.5;
      this.introChaseTimer = 0;
      this.inspectorZ = -130;
    } else {
      this.playIntroSounds();
    }

    // Seed initial safe stretch with coins and stationary intro train
    this.seedInitialTrack();
  }

  playIntroSounds() {
    // Whistle sound: Tweet tweet!
    this.sounds.tone({ f: 880, to: 960, type: 'triangle', dur: 0.13, vol: 0.26, delay: 0.1 });
    this.sounds.tone({ f: 960, to: 880, type: 'triangle', dur: 0.16, vol: 0.26, delay: 0.25 });
    // Spray paint can rattle/hiss
    this.sounds.noise({ dur: 0.35, from: 1800, to: 900, vol: 0.2, delay: 0.02 });
  }

  serialize() {
    return {
      distance: Math.floor(this.distance),
      coins: this.coins,
      scoreMultiplier: this.scoreMultiplier,
      hoverboardStock: this.hoverboardStock,
      lettersCollected: this.lettersCollected,
      score: this.score,
    };
  }

  restoreLabel() {
    return `${Math.floor(this.distance)}m · 🪙 ${this.coins} · x${this.scoreMultiplier} · ${Math.round(this.score)} pts`;
  }

  /* ------------------------------------------------------------- 2.5D Projection Helper */
  project(laneX, heightY, z) {
    const depth = z + this.camD;
    if (depth <= 10) return { x: this.horizonX, y: this.groundY, scale: 1, visible: false };
    const scale = this.camD / depth;
    const x = this.horizonX + laneX * scale;
    const y = this.horizonY + (this.groundY - this.horizonY) * scale - heightY * scale;
    return { x, y, scale, visible: z >= -35 && z <= 1700 };
  }

  /* ------------------------------------------------------------- Track & World Generation */
  seedInitialTrack() {
    // Intro stationary train on Left Lane with graffiti tag
    this.worldObjects.push({
      type: 'train',
      lane: -1,
      z: 70,
      len: 440,
      moving: false,
      theme: { main: '#ff4d6d', roof: '#fff0f3', trim: '#ff758f', name: 'CHERRY EXPRESS' },
      hasRamp: true,
      horned: true,
    });

    // Fresh cartoon spray paint puffs at start
    for (let i = 0; i < 6; i++) {
      this.worldObjects.push({
        type: 'spray_puff',
        lane: -0.65,
        z: 20 + i * 14,
        y: 22 + (i % 2) * 12,
        col: i % 2 === 0 ? '#ff4d6d' : '#38bdf8',
      });
    }

    // Initial coin run down center lane
    for (let z = 180; z < 560; z += 45) {
      this.worldObjects.push({ type: 'coin', lane: 0, z, y: 18, taken: false });
    }
  }

  spawnWorldElements() {
    // Determine active environment zone based on distance (every 450m alternates scenery)
    const cycle = Math.floor(this.distance / 450);
    this.currentZone = cycle % 3;

    while (this.nextSpawnZ < 1550) {
      const z = this.nextSpawnZ;
      const r = Math.random();

      // In Jetpack Mode: spawn high-altitude golden star-coin paths
      if (this.jetpackTimer > 0) {
        for (const lane of LANES) {
          const coinH = 150 + Math.sin(z * 0.04) * 22;
          this.worldObjects.push({ type: 'coin', lane, z, y: coinH, taken: false });
        }
        this.nextSpawnZ += 55;
        continue;
      }

      // 1. Word Hunt Letter Pickups ("B-E-A-N")
      if (z >= this.nextLetterZ) {
        const letters = ['B', 'E', 'A', 'N'];
        const missing = letters.filter((l) => !this.lettersCollected[l]);
        if (missing.length > 0) {
          const targetL = missing[Math.floor(Math.random() * missing.length)];
          const lane = LANES[Math.floor(Math.random() * LANES.length)];
          this.worldObjects.push({ type: 'letter', letter: targetL, lane, z, y: 35, taken: false });
          this.nextLetterZ = z + 950 + Math.random() * 500;
        }
      }

      // 2. Mystery Box Pickup (🎁)
      if (z >= this.nextMysteryZ) {
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        this.worldObjects.push({ type: 'mystery', lane, z, y: 30, taken: false });
        this.nextMysteryZ = z + 1200 + Math.random() * 800;
      }

      // 3. Cartoon Toy Trains (Moving & Parked with Ramps)
      if (z >= this.nextTrainZ) {
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        const moving = Math.random() < 0.60;
        const len = 380 + Math.random() * 140;
        const colorPalette = [
          { main: '#ff4d6d', roof: '#fff0f3', trim: '#ff758f', name: 'CHERRY EXPRESS' },
          { main: '#ffb703', roof: '#38bdf8', trim: '#fb8500', name: 'SUNNY SHUTTLE' },
          { main: '#06d6a0', roof: '#ff70a6', trim: '#118ab2', name: 'MINTY CRUISER' },
          { main: '#7209b7', roof: '#fb8500', trim: '#560bad', name: 'BERRY STEAMER' },
        ];
        const trainTheme = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        const hasRamp = Math.random() < 0.55; // Climbable cartoon ramp wedge

        this.worldObjects.push({
          type: 'train',
          lane,
          z,
          len,
          moving,
          theme: trainTheme,
          hasRamp,
          horned: false,
        });

        // Coins across the train roof!
        for (let cz = z + 50; cz < z + len - 40; cz += 46) {
          this.worldObjects.push({ type: 'coin', lane, z: cz, y: 114, taken: false });
        }

        // Sometimes place a Power-up or Mystery Box on the train roof!
        if (Math.random() < 0.40) {
          const pTypes = ['magnet', 'jetpack', 'sneakers', 'x2'];
          const p = pTypes[Math.floor(Math.random() * pTypes.length)];
          this.worldObjects.push({ type: 'powerup', power: p, lane, z: z + len * 0.5, y: 124, taken: false });
        }

        this.nextTrainZ = z + 480 + Math.random() * 320;
        this.nextSpawnZ += 170;
        continue;
      }

      // 4. Low Candy Roadblocks vs Overhead Duck Bars
      if (r < 0.36) {
        // Candy-Striped Hurdle (Must jump over!)
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        this.worldObjects.push({ type: 'hurdle', lane, z });

        // Coin Jump Arc over the hurdle
        this.worldObjects.push({ type: 'coin', lane, z: z - 40, y: 18, taken: false });
        this.worldObjects.push({ type: 'coin', lane, z: z, y: 62, taken: false });
        this.worldObjects.push({ type: 'coin', lane, z: z + 40, y: 18, taken: false });
        this.nextSpawnZ += 180;
      } else if (r < 0.64) {
        // Wooden Archway Sign (Must slide / duck under!)
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        this.worldObjects.push({ type: 'overhead', lane, z });

        // Flat ground coins under the overhead clearance
        this.worldObjects.push({ type: 'coin', lane, z: z - 28, y: 14, taken: false });
        this.worldObjects.push({ type: 'coin', lane, z: z, y: 14, taken: false });
        this.worldObjects.push({ type: 'coin', lane, z: z + 28, y: 14, taken: false });
        this.nextSpawnZ += 180;
      } else if (r < 0.82) {
        // Cartoon Toy Power-up Orb (Magnet, Jetpack, Sneakers, 2X)
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        const pTypes = ['magnet', 'jetpack', 'sneakers', 'x2'];
        const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
        this.worldObjects.push({ type: 'powerup', power: pType, lane, z, y: 28, taken: false });

        // Lead-in coin line
        this.worldObjects.push({ type: 'coin', lane, z: z - 35, y: 18, taken: false });
        this.worldObjects.push({ type: 'coin', lane, z: z + 35, y: 18, taken: false });
        this.nextSpawnZ += 210;
      } else {
        // S-Curve or Straight Coin Trail
        const startLane = LANES[Math.floor(Math.random() * LANES.length)];
        const curve = Math.random() < 0.5;
        for (let i = 0; i < 4; i++) {
          const clane = curve ? clamp(startLane + (i % 2 === 0 ? 0 : 1), -1, 1) : startLane;
          this.worldObjects.push({ type: 'coin', lane: clane, z: z + i * 40, y: 18, taken: false });
        }
        this.nextSpawnZ += 190;
      }
    }
  }

  /* ------------------------------------------------------------- Controls & Input */
  handleInput(dt) {
    const inp = this.input;

    // Detect Pointer Drag / Swipes & Quick Taps
    if (inp.pressed) {
      this.touchStartX = inp.x;
      this.touchStartY = inp.y;
      this.touchStartTime = this.time;

      // Surfboard Quick-Deploy Button Tap (placed safely at y = 560 on right side)
      if (inp.x >= this.W - 86 && inp.x <= this.W - 10 && inp.y >= 540 && inp.y <= 615) {
        this.activateHoverboard();
        return;
      }

      // Double-Tap anywhere on screen for Surfboard
      if (this.time - this.lastTapTime < 0.32) {
        this.activateHoverboard();
        this.lastTapTime = 0;
      } else {
        this.lastTapTime = this.time;
      }
    }

    if (inp.down) {
      const dx = inp.x - this.touchStartX;
      const dy = inp.y - this.touchStartY;
      const dist = Math.hypot(dx, dy);

      if (dist > 22) {
        if (Math.abs(dx) > Math.abs(dy) * 0.8) {
          // Horizontal Swipe: Lane switch
          if (dx > 0) this.changeLane(1);
          else this.changeLane(-1);
        } else {
          // Vertical Swipe: Jump or Slide
          if (dy < 0) this.jump();
          else this.slide();
        }
        this.touchStartX = inp.x;
        this.touchStartY = inp.y;
      }
    }

    // Keyboard Controls (A/D or Arrows to switch, W/Up/Space to jump, S/Down to slide, E/B/Shift for Board)
    const kLeft = inp.key('a', 'arrowleft');
    const kRight = inp.key('d', 'arrowright');
    const kUp = inp.key('w', 'arrowup', ' ');
    const kDown = inp.key('s', 'arrowdown');
    const kBoard = inp.key('e', 'b', 'shift');

    if (kLeft && !this.prevKeyLeft) this.changeLane(-1);
    if (kRight && !this.prevKeyRight) this.changeLane(1);
    if (kUp && !this.prevKeyUp) this.jump();
    if (kDown && !this.prevKeyDown) this.slide();
    if (kBoard && !this.prevKeyBoard) this.activateHoverboard();

    this.prevKeyLeft = kLeft;
    this.prevKeyRight = kRight;
    this.prevKeyUp = kUp;
    this.prevKeyDown = kDown;
    this.prevKeyBoard = kBoard;
  }

  changeLane(dir) {
    if (this.dead) return;
    const nextLane = clamp(this.lane + dir, -1, 1);
    if (nextLane !== this.lane) {
      // Check if player is bumping into the solid side of a train (Side-swipe stumble)
      let bumpedTrain = false;
      for (const obj of this.worldObjects) {
        if (obj.type === 'train' && obj.lane === nextLane) {
          if (obj.z <= 25 && obj.z + obj.len >= -25) {
            const pY = this.playerBaseY + this.jumpY;
            if (pY < 85) {
              bumpedTrain = true;
              break;
            }
          }
        }
      }

      if (bumpedTrain) {
        // Stumble against train flank!
        this.triggerStumble('Bumped into a speeding train side!');
        return;
      }

      this.lane = nextLane;
      this.sounds.slice();
      this.haptics.light();
      this.fx.ring(this.W / 2 + this.lane * (LANE_DIST * 0.55), this.groundY - 10, '#ffd166', 35, 0.25, 2);
    }
  }

  jump() {
    if (this.dead) return;
    if (this.jetpackTimer > 0) return; // Flying high in sky corridor

    // Can jump if on ground or on top of a train roof
    if (!this.isJumping || this.jumpY < 12) {
      const power = this.sneakerTimer > 0 ? 920 : 620; // Super Sneakers triple jump!
      this.jumpVY = power;
      this.isJumping = true;
      this.isSliding = false;
      this.slideTimer = 0;
      this.spinAngle = 0;

      if (this.sneakerTimer > 0) {
        // High spring bouncy SFX: Boing!
        this.sounds.bubble(2.5);
        this.sounds.bubble(3.4);
        this.haptics.heavy();
        const proj = this.project(this.lane * LANE_DIST, this.playerBaseY, 0);
        this.fx.ring(proj.x, proj.y, '#ff4d6d', 80, 0.45, 4);
        this.fx.text(proj.x, proj.y - 30, 'SPRING JUMP!', '#ff4d6d', 20);
      } else {
        this.sounds.drop();
        this.haptics.medium();
        const proj = this.project(this.lane * LANE_DIST, this.playerBaseY, 0);
        this.fx.burst(proj.x, proj.y, '#ffd166', 8, 110, 0.35, 2.5);
      }
    }
  }

  slide() {
    if (this.dead) return;
    if (this.jetpackTimer > 0) return;

    // Fast-dive to ground if airborne
    if (this.isJumping) {
      this.jumpVY = -880;
      this.sounds.drop();
    }

    this.isSliding = true;
    this.slideTimer = 0.68;
    this.rollAngle = 0;
    this.sounds.slice();
    this.haptics.light();

    const proj = this.project(this.lane * LANE_DIST, this.playerBaseY, 0);
    this.fx.burst(proj.x, proj.y, '#ffffff', 8, 70, 0.25, 2);
  }

  activateHoverboard() {
    if (this.dead) return;
    if (this.hoverboardActive) return;
    if (this.hoverboardStock <= 0) {
      this.sounds.tick();
      return;
    }

    this.hoverboardStock--;
    this.hoverboardActive = true;
    this.hoverboardTimer = 30.0;
    this.sounds.upgrade();
    this.haptics.heavy();

    const proj = this.project(this.laneX, this.playerBaseY + this.jumpY, 0);
    this.fx.ring(proj.x, proj.y, '#38bdf8', 85, 0.5, 4);
    this.fx.text(proj.x, proj.y - 40, 'SURFBOARD ON!', '#38bdf8', 22);
  }

  triggerStumble(reason) {
    if (this.grace > 0 || this.dead) return;
    if (this.stumbleCooldown > 0) return;

    // If already stumbled and Inspector is right on your heels, Inspector tackles you!
    if (this.stumbleTimer > 0.8 && this.inspectorZ > -32) {
      this.die('BUSTED! The Inspector & Bulldog caught you!');
      this.sounds.fail();
      this.haptics.heavy();
      return;
    }

    this.stumbleTimer = 5.0; // Inspector rushes up for 5 seconds
    this.stumbleCooldown = 1.0;
    this.inspectorZ = -22; // Right on heels in clear view!
    this.sounds.hit();
    this.haptics.medium();

    const proj = this.project(this.laneX, this.playerBaseY + this.jumpY, 0);
    this.fx.shake(12, 0.28);
    this.fx.text(proj.x, proj.y - 35, 'WHOOPS! WATCH OUT!', '#ff4d6d', 18);

    // Whistle tone: Tweet tweet!
    this.sounds.tone({ f: 880, to: 940, type: 'triangle', dur: 0.14, vol: 0.28 });
    this.sounds.tone({ f: 940, to: 880, type: 'triangle', dur: 0.16, vol: 0.28, delay: 0.11 });
  }

  /* ------------------------------------------------------------- Simulation & Physics */
  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }

    this.time += dt;
    this.fx.update(dt);
    if (this.grace > 0) this.grace -= dt;
    if (this.stumbleCooldown > 0) this.stumbleCooldown -= dt;
    if (this.sprayIntroT > 0) this.sprayIntroT -= dt;

    // Gradual speed acceleration
    const currentMax = this.jetpackTimer > 0 ? this.maxSpeed + 90 : this.maxSpeed;
    if (this.speed < currentMax) {
      this.speed += 3.2 * dt;
    }
    const worldStep = this.speed * dt;
    this.distance += worldStep * 0.1;
    this.trackOffset = (this.trackOffset + worldStep) % 60;
    this.score += worldStep * 0.18 * this.scoreMultiplier;

    // Advance procedural generation forward with track travel
    this.nextSpawnZ -= worldStep;
    this.nextTrainZ -= worldStep;
    this.nextLetterZ -= worldStep;
    this.nextMysteryZ -= worldStep;

    // Smooth Lane Interpolation & Tilt Angle
    const targetLaneX = this.lane * LANE_DIST;
    const prevLaneX = this.laneX;
    this.laneX += (targetLaneX - this.laneX) * Math.min(1, dt * 17);
    this.tiltAngle = clamp((this.laneX - prevLaneX) * 0.08, -0.28, 0.28);

    // Running Bob & Step SFX for Super Sneakers
    this.runAnimT += dt * (this.speed * 0.024);
    if (this.sneakerTimer > 0 && !this.isJumping && !this.isSliding) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.26;
        const proj = this.project(this.laneX, this.playerBaseY, 0);
        this.fx.ring(proj.x, proj.y + 4, '#ffb703', 25, 0.2, 1.5);
      }
    }

    if (this.isSliding) {
      this.slideTimer -= dt;
      this.rollAngle += dt * 18;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.rollAngle = 0;
      }
    }

    // Power-up Timers
    if (this.magnetTimer > 0) this.magnetTimer -= dt;
    if (this.sneakerTimer > 0) this.sneakerTimer -= dt;
    if (this.doubleTimer > 0) {
      this.doubleTimer -= dt;
      this.scoreMultiplier = 2;
    } else {
      this.scoreMultiplier = 1;
    }

    if (this.hoverboardActive) {
      this.hoverboardTimer -= dt;
      if (this.hoverboardTimer <= 0) this.hoverboardActive = false;
    }

    // Inspector & Dog Pursuit Director
    this.updateInspector(dt);

    // Jetpack Flying Logic & Parachute Descent
    if (this.jetpackTimer > 0) {
      this.jetpackTimer -= dt;
      // Ascend high into sunny sky corridor
      this.jumpY += (165 - this.jumpY) * Math.min(1, dt * 6.5);
      this.isJumping = false;
      this.playerBaseY = 0;

      // Puffy white marshmallow smoke & rainbow candy confetti!
      const proj = this.project(this.laneX, this.jumpY, 0);
      this.fx.burst(proj.x - 12, proj.y + 16, '#ffffff', 2, 80, 0.25, 3.5, 240);
      this.fx.burst(proj.x + 12, proj.y + 16, '#ffffff', 2, 80, 0.25, 3.5, 240);
      this.fx.burst(proj.x, proj.y + 18, '#ffd166', 2, 70, 0.25, 2, 220);

      if (this.jetpackTimer <= 0) {
        // Open circus parachute for gentle floating glide descent!
        this.parachuteTimer = 2.2;
      }
    } else if (this.parachuteTimer > 0) {
      this.parachuteTimer -= dt;
      this.jumpY = Math.max(0, this.jumpY - 72 * dt);
      if (this.jumpY <= 0) this.parachuteTimer = 0;
    } else {
      // Normal Gravity & Vertical Motion
      if (this.isJumping || this.jumpY > 0) {
        const grav = 1450;
        this.jumpVY -= grav * dt;
        this.jumpY += this.jumpVY * dt;

        if (this.sneakerTimer > 0) {
          this.spinAngle += dt * 14;
        }

        if (this.jumpY <= 0) {
          this.jumpY = 0;
          this.jumpVY = 0;
          this.isJumping = false;
          this.spinAngle = 0;
        }
      }
    }

    // Check train roof support & ramp running
    this.checkTrainRoofSupport(dt);

    // Advance World Elements (Trains, Hurdles, Overhead Bars, Coins)
    this.updateWorldObjects(dt, worldStep);

    // Continually Spawn Future Track Segments
    this.spawnWorldElements();

    // Drifting fluffy clouds
    for (const c of this.clouds) {
      c.x = (c.x + c.speed * dt) % (this.W + 80);
    }

    // Player Input
    this.handleInput(dt);
  }

  updateInspector(dt) {
    if (this.introChaseTimer > 0) {
      this.introChaseTimer -= dt;
      this.inspectorZ = -22; // Right on heels in clear view at start!
    } else if (this.stumbleTimer > 0) {
      this.stumbleTimer -= dt;
      this.inspectorZ += (-20 - this.inspectorZ) * Math.min(1, dt * 8);
    } else {
      // Clean running: Inspector drops back into distance
      this.inspectorZ += (-130 - this.inspectorZ) * Math.min(1, dt * 2.2);
    }

    // Inspector chases the player's lane smoothly
    this.inspectorLaneX += (this.laneX - this.inspectorLaneX) * Math.min(1, dt * 7.5);
  }

  updateDying(dt) {
    this.deathTimer += dt;
    this.fx.update(dt);
    // Inspector & Bulldog sprint right to the player to stand over the knocked-down runner
    if (this.inspectorZ < -10) {
      this.inspectorZ += (-10 - this.inspectorZ) * Math.min(1, dt * 8.0);
    }
    this.inspectorLaneX += (this.laneX - this.inspectorLaneX) * Math.min(1, dt * 8.0);
  }

  checkTrainRoofSupport(dt) {
    let supportedByTrain = false;

    for (const obj of this.worldObjects) {
      if (obj.type === 'train' && obj.lane === this.lane) {
        // 1. Train Ramp Climbing: smooth ascent onto roof!
        if (obj.hasRamp && obj.z <= 65 && obj.z >= -20) {
          const rampProg = clamp((65 - obj.z) / 65, 0, 1);
          this.playerBaseY = Math.max(this.playerBaseY, rampProg * 95);
          supportedByTrain = true;
          this.onTrain = true;
          break;
        }

        // 2. Running on flat train roof
        if (obj.z <= 20 && obj.z + obj.len >= -20) {
          if (this.jumpY + this.playerBaseY >= 82) {
            supportedByTrain = true;
            this.playerBaseY = 95; // Roof height
            break;
          }
        }
      }
    }

    if (!supportedByTrain && this.playerBaseY > 0) {
      this.playerBaseY = 0;
      this.isJumping = true;
      this.jumpY = 95; // Begin falling from roof height
      this.jumpVY = 0;
    }
    this.onTrain = supportedByTrain;
  }

  updateWorldObjects(dt, worldStep) {
    const playerZ = 0;
    const runnerLane = this.lane;

    for (let i = this.worldObjects.length - 1; i >= 0; i--) {
      const obj = this.worldObjects[i];

      // Advance z towards player
      let moveSpeed = worldStep;
      if (obj.type === 'train' && obj.moving) {
        moveSpeed += 175 * dt;

        // Friendly cartoon train whistle / horn!
        if (!obj.horned && obj.z <= 480 && obj.z >= 420) {
          obj.horned = true;
          this.playTrainHorn();
        }
      }
      obj.z -= moveSpeed;

      // Clean up past objects
      if (obj.z < -160 && (obj.type !== 'train' || obj.z + (obj.len || 0) < -160)) {
        this.worldObjects.splice(i, 1);
        continue;
      }

      // Coin Magnet Attraction with golden sparkle trails
      if (this.magnetTimer > 0 && obj.type === 'coin' && !obj.taken) {
        if (obj.z < 480 && obj.z > -20) {
          const targetLane = runnerLane;
          obj.lane += (targetLane - obj.lane) * Math.min(1, dt * 12);
          obj.y += ((this.playerBaseY + this.jumpY + 20) - obj.y) * Math.min(1, dt * 10);
        }
      }

      // 1. Coin Pickup Collision
      if (obj.type === 'coin' && !obj.taken) {
        if (Math.abs(obj.z - playerZ) < 32 && Math.abs(obj.lane - this.lane) < 0.6) {
          const pY = this.playerBaseY + this.jumpY;
          if (Math.abs(pY - obj.y) < 55) {
            obj.taken = true;
            this.coins += this.scoreMultiplier;
            this.score += 25 * this.scoreMultiplier;
            this.sounds.bubble(1 + (this.coins % 12) * 0.08);
            this.haptics.light();
            const proj = this.project(obj.lane * LANE_DIST, obj.y, obj.z);
            this.fx.burst(proj.x, proj.y, '#ffd166', 6, 110, 0.25, 2.5);
            this.worldObjects.splice(i, 1);
            continue;
          }
        }
      }

      // 2. Power-up Pickup Collision
      if (obj.type === 'powerup' && !obj.taken) {
        if (Math.abs(obj.z - playerZ) < 35 && Math.abs(obj.lane - this.lane) < 0.6) {
          const pY = this.playerBaseY + this.jumpY;
          if (Math.abs(pY - obj.y) < 60) {
            obj.taken = true;
            this.applyPowerup(obj.power);
            const proj = this.project(obj.lane * LANE_DIST, obj.y, obj.z);
            this.fx.burst(proj.x, proj.y, '#ffb703', 20, 180, 0.6, 4);
            this.fx.ring(proj.x, proj.y, '#38bdf8', 70, 0.45, 3);
            this.worldObjects.splice(i, 1);
            continue;
          }
        }
      }

      // 3. Mystery Box Pickup (🎁)
      if (obj.type === 'mystery' && !obj.taken) {
        if (Math.abs(obj.z - playerZ) < 35 && Math.abs(obj.lane - this.lane) < 0.6) {
          const pY = this.playerBaseY + this.jumpY;
          if (Math.abs(pY - obj.y) < 60) {
            obj.taken = true;
            this.openMysteryBox(obj);
            this.worldObjects.splice(i, 1);
            continue;
          }
        }
      }

      // 4. Word Hunt Letter Pickup ("B-E-A-N")
      if (obj.type === 'letter' && !obj.taken) {
        if (Math.abs(obj.z - playerZ) < 35 && Math.abs(obj.lane - this.lane) < 0.6) {
          const pY = this.playerBaseY + this.jumpY;
          if (Math.abs(pY - obj.y) < 60) {
            obj.taken = true;
            this.lettersCollected[obj.letter] = true;
            this.sounds.up();
            this.haptics.medium();

            const proj = this.project(obj.lane * LANE_DIST, obj.y, obj.z);
            this.fx.ring(proj.x, proj.y, '#ffd166', 80, 0.6, 4);
            this.fx.text(proj.x, proj.y - 30, `LETTER "${obj.letter}"!`, '#ff4d6d', 24);

            // Check if full "B-E-A-N" completed!
            if (this.lettersCollected.B && this.lettersCollected.E && this.lettersCollected.A && this.lettersCollected.N) {
              this.coins += 1000;
              this.score += 15000;
              this.fx.text(this.W / 2, 260, 'JACKPOT! +1,000 COINS!', '#ffb703', 28, 1.5);
              this.fx.burst(this.W / 2, 260, '#ffd166', 40, 260, 1.0, 5);
              this.sounds.survive();
              this.lettersCollected = { B: false, E: false, A: false, N: false };
            }

            this.worldObjects.splice(i, 1);
            continue;
          }
        }
      }

      // 5. Hurdle Collision (Must jump over!)
      if (obj.type === 'hurdle') {
        if (Math.abs(obj.z - playerZ) < 22 && Math.abs(obj.lane - this.lane) < 0.5) {
          const pY = this.playerBaseY + this.jumpY;
          if (pY < 32) {
            if (this.isSliding || pY >= 16) {
              // Sliding through or clipping top edge causes a stumble rather than instant death!
              this.triggerStumble('Tripped on a candy hurdle!');
              obj.z = -50;
            } else {
              this.handleCrash('Tripped on a Track Hurdle!');
              return;
            }
          }
        }
      }

      // 6. Overhead Clearance Bar (Must slide under!)
      if (obj.type === 'overhead') {
        if (Math.abs(obj.z - playerZ) < 22 && Math.abs(obj.lane - this.lane) < 0.5) {
          const pY = this.playerBaseY + this.jumpY;
          const runnerHeight = this.isSliding ? 25 : 55;
          if (pY + runnerHeight > 44) {
            this.handleCrash('Bonked on Overhead Wooden Sign!');
            return;
          }
        }
      }

      // 7. Train Front Collision (Must be on roof or ramp!)
      if (obj.type === 'train' && obj.lane === this.lane) {
        if (!obj.hasRamp) {
          if (obj.z <= 25 && obj.z >= -35) {
            const pY = this.playerBaseY + this.jumpY;
            if (pY < 84) {
              this.handleCrash(`SPLAT! Bumped by the ${obj.theme.name}!`);
              return;
            }
          }
        }
      }
    }
  }

  playTrainHorn() {
    // Cheerful cartoon train whistle: Toot toot!
    this.sounds.tone({ f: 460, to: 440, type: 'triangle', dur: 0.28, vol: 0.24 });
    this.sounds.tone({ f: 580, to: 550, type: 'triangle', dur: 0.28, vol: 0.22, delay: 0.05 });
  }

  applyPowerup(power) {
    this.sounds.upgrade();
    this.haptics.heavy();
    const proj = this.project(this.laneX, this.playerBaseY + this.jumpY, 0);

    if (power === 'magnet') {
      this.magnetTimer = 12.0;
      this.fx.text(proj.x, proj.y - 30, 'COIN MAGNET!', '#ff4d6d', 20);
    } else if (power === 'jetpack') {
      this.jetpackTimer = 8.5;
      this.fx.text(proj.x, proj.y - 30, 'ROCKET BLAST!', '#38bdf8', 22);
      this.sounds.laser();
    } else if (power === 'sneakers') {
      this.sneakerTimer = 14.0;
      this.fx.text(proj.x, proj.y - 30, 'SPRING SHOES!', '#ffb703', 20);
    } else if (power === 'x2') {
      this.doubleTimer = 15.0;
      this.fx.text(proj.x, proj.y - 30, '2X MULTIPLIER!', '#a855f7', 20);
    }
  }

  openMysteryBox(box) {
    this.sounds.survive();
    this.haptics.heavy();
    const proj = this.project(box.lane * LANE_DIST, box.y, box.z);
    this.fx.burst(proj.x, proj.y, '#ffd166', 30, 220, 0.8, 5);
    this.fx.ring(proj.x, proj.y, '#38bdf8', 90, 0.5, 4);

    const outcomes = ['board', 'coins', 'score'];
    const pick = outcomes[Math.floor(Math.random() * outcomes.length)];

    if (pick === 'board') {
      this.hoverboardStock++;
      this.fx.text(proj.x, proj.y - 40, '🎁 +1 SURFBOARD!', '#38bdf8', 22);
    } else if (pick === 'coins') {
      this.coins += 500;
      this.score += 5000;
      this.fx.text(proj.x, proj.y - 40, '🎁 +500 COINS!', '#ffd166', 22);
    } else {
      this.score += 8000;
      this.fx.text(proj.x, proj.y - 40, '🎁 +8,000 PTS!', '#ff4d6d', 22);
    }
  }

  handleCrash(reason) {
    if (this.grace > 0 || this.dead) return;

    if (this.hoverboardActive) {
      // Surfboard protects player from 1 fatal collision!
      this.hoverboardActive = false;
      this.grace = 2.0;
      this.sounds.fail();
      this.haptics.heavy();

      const proj = this.project(this.laneX, this.playerBaseY + this.jumpY, 0);
      this.fx.shake(14, 0.4);
      this.fx.ring(proj.x, proj.y, '#38bdf8', 110, 0.6, 5);
      this.fx.burst(proj.x, proj.y, '#38bdf8', 24, 220, 0.7, 4);
      this.fx.text(proj.x, proj.y - 40, 'SURFBOARD SAVED YOU!', '#38bdf8', 22);
      return;
    }

    // Fatal Crash: snap inspector right into frame
    this.inspectorZ = Math.max(-20, this.inspectorZ);
    this.die(reason);
    this.sounds.fail();
    this.haptics.heavy();
    const proj = this.project(this.laneX, this.playerBaseY + this.jumpY, 0);
    this.fx.shake(22, 0.6);
    this.fx.burst(proj.x, proj.y, '#ff4d6d', 36, 260, 1.0, 5);
  }

  /* ------------------------------------------------------------- Render Engine */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    // Camera Screen Shake
    const shake = this.fx.offset();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Cheerful Cartoon Sky, Rolling Hills & Trees
    this.drawCartoonEnvironment(ctx, W, H);

    // 2. Playful Sandy Ballast, Wooden Ties & Silver Rails
    this.drawCartoonTracks(ctx, W);

    // 3. Depth-Sorted Rendering of World Objects, Trains & Player
    this.drawWorldAndPlayer(ctx);

    // 4. Inspector & Bulldog (Fall Guy Mascots)
    this.drawInspectorAndDog(ctx);

    // 5. Particle FX Layer
    this.fx.render(ctx, 1.0);

    // 6. Playful Candy Arcade HUD
    this.drawHUD(ctx, W);

    ctx.restore();
  }

  drawCartoonEnvironment(ctx, W, H) {
    const hy = this.horizonY;
    const zone = this.currentZone;

    // 1. Bright Cheerful Sky Gradient
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    if (zone === 0) {
      // Sunny Daytime Sky
      sky.addColorStop(0, '#38bdf8');
      sky.addColorStop(0.5, '#7dd3fc');
      sky.addColorStop(1, '#bae6fd');
    } else if (zone === 1) {
      // Cotton Candy Sunset
      sky.addColorStop(0, '#a855f7');
      sky.addColorStop(0.5, '#f472b6');
      sky.addColorStop(1, '#fed7aa');
    } else {
      // Warm Golden Morning
      sky.addColorStop(0, '#0284c7');
      sky.addColorStop(0.6, '#38bdf8');
      sky.addColorStop(1, '#fde68a');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hy + 20);

    // Cute warm sunshine glow at horizon
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(W / 2, hy, 110, Math.PI, 0);
    ctx.fill();

    // 2. Fluffy White Marshmallow Clouds
    for (const c of this.clouds) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w * 0.5, c.h * 0.5, 0, 0, TAU);
      ctx.ellipse(c.x - c.w * 0.25, c.y + 2, c.w * 0.35, c.h * 0.45, 0, 0, TAU);
      ctx.ellipse(c.x + c.w * 0.25, c.y + 2, c.w * 0.35, c.h * 0.45, 0, 0, TAU);
      ctx.fill();
    }

    // 3. Layered Rolling Cartoon Hills with Trees
    // Distant soft blue-green hills
    ctx.fillStyle = '#6ee7b7';
    ctx.beginPath();
    ctx.moveTo(0, hy);
    for (let x = 0; x <= W; x += 40) {
      const y = hy - 32 + Math.sin(x * 0.02) * 16;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, hy + 20);
    ctx.lineTo(0, hy + 20);
    ctx.closePath();
    ctx.fill();

    // Foreground lush green cartoon hills
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(0, hy);
    for (let x = 0; x <= W; x += 30) {
      const y = hy - 18 + Math.sin(x * 0.035 + 1.2) * 14;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, hy + 20);
    ctx.lineTo(0, hy + 20);
    ctx.closePath();
    ctx.fill();

    // Cute Round Cartoon Lollipop Trees along the ridge
    for (let x = 15; x < W; x += 38) {
      const hillY = hy - 18 + Math.sin(x * 0.035 + 1.2) * 14;
      // Brown trunk
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(x - 2, hillY - 14, 4, 14);
      // Fluffy round canopy
      ctx.fillStyle = (x % 3 === 0) ? '#16a34a' : '#22c55e';
      ctx.beginPath();
      ctx.arc(x, hillY - 18, 9, 0, TAU);
      ctx.fill();
      // Cute highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(x - 3, hillY - 21, 3, 0, TAU);
      ctx.fill();
    }

    // 4. Overhead Cartoon Archways & Traffic Lights
    for (const g of this.gantries) {
      g.z = (g.z - this.speed * 0.016 + 1760) % 1760;
      const projL = this.project(-180, 135, g.z);
      const projR = this.project(180, 135, g.z);
      const projBaseL = this.project(-180, 0, g.z);
      const projBaseR = this.project(180, 0, g.z);

      if (projL.visible) {
        // Chunky painted wooden posts
        ctx.fillStyle = g.color;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(1.2, 2.0 * projL.scale);

        // Crossbar
        ctx.fillRect(projL.x, projL.y - 4 * projL.scale, projR.x - projL.x, 8 * projL.scale);
        ctx.strokeRect(projL.x, projL.y - 4 * projL.scale, projR.x - projL.x, 8 * projL.scale);

        // Legs
        ctx.fillRect(projBaseL.x - 3 * projL.scale, projL.y, 6 * projL.scale, projBaseL.y - projL.y);
        ctx.fillRect(projBaseR.x - 3 * projL.scale, projR.y, 6 * projL.scale, projBaseR.y - projR.y);

        // Cartoon Signal Box
        const sigCol = g.signal === 'green' ? '#22c55e' : (g.signal === 'red' ? '#ef4444' : '#f59e0b');
        ctx.fillStyle = '#334155';
        ctx.fillRect(projR.x - 22 * projL.scale, projR.y + 4 * projL.scale, 16 * projL.scale, 22 * projL.scale);
        ctx.fillStyle = sigCol;
        ctx.beginPath();
        ctx.arc(projR.x - 14 * projL.scale, projR.y + 15 * projL.scale, 4.5 * projL.scale, 0, TAU);
        ctx.fill();
      }
    }
  }

  drawCartoonTracks(ctx, W) {
    // 0. Base Lush Green Grass Ground across entire lower screen
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, this.horizonY - 4, W, this.H - this.horizonY + 8);

    // Cute Grass Tufts along the verges
    ctx.fillStyle = '#22c55e';
    for (let x = 12; x < W; x += 32) {
      const gy = this.groundY - 18 + Math.sin(x * 12) * 8;
      ctx.beginPath();
      ctx.arc(x, gy, 4, 0, TAU);
      ctx.fill();
    }

    // 1. Playful Sandy Ballast Bed (Warm honey/sand gravel)
    const pFarL = this.project(-180, 0, 1650);
    const pFarR = this.project(180, 0, 1650);
    const pNearL = this.project(-180, 0, 0);
    const pNearR = this.project(180, 0, 0);

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(pNearL.x, pNearL.y);
    ctx.lineTo(pFarL.x, pFarL.y);
    ctx.lineTo(pFarR.x, pFarR.y);
    ctx.lineTo(pNearR.x, pNearR.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Cute Cartoon Wooden Picket Fences along the grassy edge
    const fenceSpacing = 160;
    for (let i = 0; i < 9; i++) {
      const fz = ((i * fenceSpacing - this.trackOffset * 1.5) % 1440 + 1440) % 1440;
      const fP = this.project(-185, 0, fz);
      const fTop = this.project(-185, 36, fz);
      if (fP.visible && fP.scale > 0.2) {
        // White picket post with red cap
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(1, 1.5 * fP.scale);
        ctx.fillRect(fTop.x - 3 * fP.scale, fTop.y, 6 * fP.scale, fP.y - fTop.y);
        ctx.strokeRect(fTop.x - 3 * fP.scale, fTop.y, 6 * fP.scale, fP.y - fTop.y);
        // Red tip
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(fTop.x - 3 * fP.scale, fTop.y, 6 * fP.scale, 5 * fP.scale);

        // Right side picket post
        const fPR = this.project(185, 0, fz);
        const fTopR = this.project(185, 36, fz);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(fTopR.x - 3 * fP.scale, fTopR.y, 6 * fP.scale, fPR.y - fTopR.y);
        ctx.strokeRect(fTopR.x - 3 * fP.scale, fTopR.y, 6 * fP.scale, fPR.y - fTopR.y);
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(fTopR.x - 3 * fP.scale, fTopR.y, 6 * fP.scale, 5 * fP.scale);
      }
    }

    // 3. Chunky Cartoon Wooden Railroad Ties (Sleepers)
    const tieSpacing = 42;
    for (let z = (tieSpacing - this.trackOffset); z < 1400; z += tieSpacing) {
      const pF1 = this.project(-168, 0, z);
      const pF2 = this.project(168, 0, z);
      const pB1 = this.project(-168, 0, z + 14);
      const pB2 = this.project(168, 0, z + 14);

      if (pF1.visible) {
        // Warm chocolate cartoon wood
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.moveTo(pF1.x, pF1.y);
        ctx.lineTo(pF2.x, pF2.y);
        ctx.lineTo(pB2.x, pB2.y);
        ctx.lineTo(pB1.x, pB1.y);
        ctx.closePath();
        ctx.fill();

        // Dark cartoon outline
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = Math.max(1, 1.2 * pF1.scale);
        ctx.stroke();

        // Warm woodgrain top highlight
        ctx.fillStyle = '#b45309';
        ctx.fillRect(pF1.x + 4, pF1.y - 1.5 * pF1.scale, (pF2.x - pF1.x) - 8, 2.5 * pF1.scale);

        // Silver nailheads / tie plates under the 3 tracks
        ctx.fillStyle = '#cbd5e1';
        for (const lane of LANES) {
          const tpX = this.project(lane * LANE_DIST, 0, z + 7);
          ctx.beginPath();
          ctx.arc(tpX.x - 14 * tpX.scale, tpX.y, 1.8 * tpX.scale, 0, TAU);
          ctx.arc(tpX.x + 14 * tpX.scale, tpX.y, 1.8 * tpX.scale, 0, TAU);
          ctx.fill();
        }
      }
    }

    // 4. Polished Silver Cartoon Steel Rails (No neon glow!)
    for (const lane of LANES) {
      const lx = lane * LANE_DIST;
      const railHalfW = 32;

      const leftNear = this.project(lx - railHalfW, 0, 0);
      const leftFar = this.project(lx - railHalfW, 0, 1500);
      const rightNear = this.project(lx + railHalfW, 0, 0);
      const rightFar = this.project(lx + railHalfW, 0, 1500);

      // Silver rail base
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(leftNear.x, leftNear.y);
      ctx.lineTo(leftFar.x, leftFar.y);
      ctx.moveTo(rightNear.x, rightNear.y);
      ctx.lineTo(rightFar.x, rightFar.y);
      ctx.stroke();

      // Shiny polished white/silver steel top
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(leftNear.x, leftNear.y - 1);
      ctx.lineTo(leftFar.x, leftFar.y - 0.5);
      ctx.moveTo(rightNear.x, rightNear.y - 1);
      ctx.lineTo(rightFar.x, rightFar.y - 0.5);
      ctx.stroke();
    }
  }

  drawWorldAndPlayer(ctx) {
    const drawList = [...this.worldObjects];

    // Player object entry (at z = 0)
    drawList.push({
      type: 'player',
      z: 0,
      laneX: this.laneX,
      heightY: this.playerBaseY + this.jumpY,
    });

    // Sort descending by z (furthest drawn first, closest drawn last)
    drawList.sort((a, b) => b.z - a.z);

    for (const item of drawList) {
      if (item.type === 'player') {
        this.drawPlayer(ctx, item);
      } else if (item.type === 'train') {
        this.drawCartoonTrain(ctx, item);
      } else if (item.type === 'hurdle') {
        this.drawCartoonHurdle(ctx, item);
      } else if (item.type === 'overhead') {
        this.drawCartoonOverhead(ctx, item);
      } else if (item.type === 'coin' && !item.taken) {
        this.drawCartoonCoin(ctx, item);
      } else if (item.type === 'powerup' && !item.taken) {
        this.drawCartoonPowerup(ctx, item);
      } else if (item.type === 'mystery' && !item.taken) {
        this.drawCartoonMysteryBox(ctx, item);
      } else if (item.type === 'letter' && !item.taken) {
        this.drawCartoonLetter(ctx, item);
      } else if (item.type === 'spray_puff') {
        this.drawCartoonSprayPuff(ctx, item);
      }
    }
  }

  /* ------------------------------------------------------------- 3D Cartoon Object Renderers */
  drawCartoonTrain(ctx, t) {
    const lx = t.lane * LANE_DIST;
    const trainW = 74;
    const trainH = 92;
    const frontZ = Math.max(0, t.z);
    const backZ = t.z + t.len;

    if (backZ < 0) return; // Completely behind camera

    const fBL = this.project(lx - trainW / 2, 0, frontZ);
    const fBR = this.project(lx + trainW / 2, 0, frontZ);
    const fTL = this.project(lx - trainW / 2, trainH, frontZ);
    const fTR = this.project(lx + trainW / 2, trainH, frontZ);

    const bBL = this.project(lx - trainW / 2, 0, backZ);
    const bBR = this.project(lx + trainW / 2, 0, backZ);
    const bTL = this.project(lx - trainW / 2, trainH, backZ);
    const bTR = this.project(lx + trainW / 2, trainH, backZ);

    // 0. Soft warm cartoon light beam ahead (for moving trains)
    if (t.moving && t.z >= 0 && t.z <= 950) {
      const coneFar = this.project(lx, 0, Math.max(0, t.z - 210));
      const coneGrad = ctx.createRadialGradient(
        (fBL.x + fBR.x) / 2, fBL.y, 4,
        coneFar.x, coneFar.y, 110 * fBL.scale
      );
      coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
      coneGrad.addColorStop(0.6, 'rgba(254, 240, 138, 0.15)');
      coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(fBL.x - 6 * fBL.scale, fBL.y);
      ctx.lineTo(fBR.x + 6 * fBL.scale, fBL.y);
      ctx.lineTo(coneFar.x + 45 * coneFar.scale, coneFar.y);
      ctx.lineTo(coneFar.x - 45 * coneFar.scale, coneFar.y);
      ctx.closePath();
      ctx.fill();
    }

    // 1. Train Roof Walkway (Glossy pastel / candy color)
    ctx.fillStyle = t.theme.roof;
    ctx.beginPath();
    ctx.moveTo(fTL.x, fTL.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.lineTo(bTR.x, bTR.y);
    ctx.lineTo(bTL.x, bTL.y);
    ctx.closePath();
    ctx.fill();

    // Dark cartoon outline on roof
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(1, 2 * fTL.scale);
    ctx.stroke();

    // 2. Visible Train Flank Side Walls
    if (t.lane <= 0) {
      // Right flank visible
      ctx.fillStyle = t.theme.trim;
      ctx.beginPath();
      ctx.moveTo(fTR.x, fTR.y);
      ctx.lineTo(bTR.x, bTR.y);
      ctx.lineTo(bBR.x, bBR.y);
      ctx.lineTo(fBR.x, fBR.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      // Rounded Cartoon Passenger Windows with waving bean silhouettes!
      ctx.fillStyle = '#bae6fd';
      const midY = (fTR.y + fBR.y) / 2;
      const winScale = fBR.scale;
      this.rr(ctx, (fTR.x + bTR.x) / 2 - 20 * winScale, midY - 8 * winScale, 40 * winScale, 16 * winScale, 4 * winScale);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();
    }
    if (t.lane >= 0) {
      // Left flank visible
      ctx.fillStyle = t.theme.trim;
      ctx.beginPath();
      ctx.moveTo(fTL.x, fTL.y);
      ctx.lineTo(bTL.x, bTL.y);
      ctx.lineTo(bBL.x, bBL.y);
      ctx.lineTo(fBL.x, fBL.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      // Rounded Cartoon Passenger Windows
      ctx.fillStyle = '#bae6fd';
      const midY = (fTL.y + fBL.y) / 2;
      const winScale = fBL.scale;
      this.rr(ctx, (fTL.x + bTL.x) / 2 - 20 * winScale, midY - 8 * winScale, 40 * winScale, 16 * winScale, 4 * winScale);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();
    }

    // 3. Train Front Face & Ramp
    if (t.z >= 0) {
      const fw = fBR.x - fBL.x;
      const fh = fBL.y - fTL.y;

      // Candy Body
      ctx.fillStyle = t.theme.main;
      ctx.beginPath();
      ctx.moveTo(fTL.x, fTL.y);
      ctx.lineTo(fTR.x, fTR.y);
      ctx.lineTo(fBR.x, fBR.y);
      ctx.lineTo(fBL.x, fBL.y);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = Math.max(1.5, 2.5 * fBL.scale);
      ctx.stroke();

      // Large Friendly Driver Windshield with glossy shine streaks
      const winW = fw * 0.76;
      const winH = fh * 0.32;
      const winX = (fTL.x + fTR.x) / 2 - winW / 2;
      const winY = fTL.y + fh * 0.12;

      ctx.fillStyle = '#1e293b';
      this.rr(ctx, winX, winY, winW, winH, 6 * fBL.scale);
      ctx.fill();

      // Diagonal comic shine glare across window
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(winX + 4, winY + winH - 2);
      ctx.lineTo(winX + winW * 0.4, winY + 2);
      ctx.lineTo(winX + winW * 0.55, winY + 2);
      ctx.lineTo(winX + winW * 0.15, winY + winH - 2);
      ctx.closePath();
      ctx.fill();

      // Cute Big Round Lantern Headlights
      const hlY = fTL.y + fh * 0.62;
      const hlRadius = 7 * fBL.scale;
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(winX + 6, hlY, hlRadius, 0, TAU);
      ctx.arc(winX + winW - 6, hlY, hlRadius, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Rounded Toy Cowcatcher / Bumper with Candy Stripes
      ctx.fillStyle = '#334155';
      this.rr(ctx, fBL.x + 2, fBL.y - fh * 0.22, fw - 4, fh * 0.22, 4 * fBL.scale);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      // Sloped Wooden Ramp Wedge with Cheerful Jump Indicator
      if (t.hasRamp) {
        const rampTip = this.project(lx, 0, t.z - 45);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(fTL.x + 4, fTL.y + fh * 0.36);
        ctx.lineTo(fTR.x - 4, fTL.y + fh * 0.36);
        ctx.lineTo(rampTip.x + 18 * rampTip.scale, rampTip.y);
        ctx.lineTo(rampTip.x - 18 * rampTip.scale, rampTip.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2 * fBL.scale;
        ctx.stroke();

        // Bouncy Green Upward Chevrons
        ctx.font = `900 ${Math.max(9, Math.round(13 * fBL.scale))}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeText('▲ HOP ON! ▲', (fTL.x + fTR.x) / 2, fBL.y - 8);
        ctx.fillStyle = '#15803d';
        ctx.fillText('▲ HOP ON! ▲', (fTL.x + fTR.x) / 2, fBL.y - 8);
      }
    }
  }

  drawCartoonHurdle(ctx, h) {
    const lx = h.lane * LANE_DIST;
    const barW = 68;
    const barH = 34;

    const pBL = this.project(lx - barW / 2, 0, h.z);
    const pBR = this.project(lx + barW / 2, 0, h.z);
    const pTL = this.project(lx - barW / 2, barH, h.z);
    const pTR = this.project(lx + barW / 2, barH, h.z);

    if (!pBL.visible) return;

    const w = pBR.x - pBL.x;
    const hgt = pBL.y - pTL.y;

    // Wooden legs
    ctx.fillStyle = '#b45309';
    ctx.fillRect(pBL.x, pTL.y, 4 * pBL.scale, hgt);
    ctx.fillRect(pBR.x - 4 * pBL.scale, pTL.y, 4 * pBL.scale, hgt);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(pBL.x, pTL.y, 4 * pBL.scale, hgt);
    ctx.strokeRect(pBR.x - 4 * pBL.scale, pTL.y, 4 * pBL.scale, hgt);

    // Peppermint / Candy-Striped Crossbar
    ctx.fillStyle = '#ffffff';
    this.rr(ctx, pTL.x, pTL.y, w, hgt * 0.44, 4 * pBL.scale);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    for (let x = pTL.x + 3; x < pTR.x - 5; x += 14 * pBL.scale) {
      ctx.fillRect(x, pTL.y, 7 * pBL.scale, hgt * 0.44);
    }

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    this.rr(ctx, pTL.x, pTL.y, w, hgt * 0.44, 4 * pBL.scale);
    ctx.stroke();
  }

  drawCartoonOverhead(ctx, o) {
    const lx = o.lane * LANE_DIST;
    const barW = 84;
    const topH = 105;
    const botH = 46;

    const pTL = this.project(lx - barW / 2, topH, o.z);
    const pTR = this.project(lx + barW / 2, topH, o.z);
    const pBL = this.project(lx - barW / 2, botH, o.z);
    const pBR = this.project(lx + barW / 2, botH, o.z);

    if (!pTL.visible) return;

    const w = pTR.x - pTL.x;
    const hgt = pBL.y - pTL.y;

    // Friendly Wooden Sign Board
    ctx.fillStyle = '#fde047';
    this.rr(ctx, pTL.x, pTL.y, w, hgt, 6 * pTL.scale);
    ctx.fill();

    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 2.5 * pTL.scale;
    this.rr(ctx, pTL.x, pTL.y, w, hgt, 6 * pTL.scale);
    ctx.stroke();

    // Bouncy Downward Arrow "▼ DUCK! ▼"
    ctx.fillStyle = '#dc2626';
    ctx.font = `900 ${Math.max(9, Math.round(12 * pTL.scale))}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▼ DUCK! ▼', (pTL.x + pTR.x) / 2, (pTL.y + pBL.y) / 2);
  }

  drawCartoonCoin(ctx, c) {
    const lx = c.lane * LANE_DIST;
    const p = this.project(lx, c.y, c.z);
    if (!p.visible) return;

    const r = Math.max(3.5, 9 * p.scale);
    const spin = Math.sin(this.time * 8 + c.z * 0.05);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(spin, 1);

    // Chunky Cartoon Golden Coin
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1.8 * p.scale;
    ctx.stroke();

    // Embossed Star in center (★)
    if (Math.abs(spin) > 0.4 && p.scale > 0.25) {
      ctx.fillStyle = '#eab308';
      ctx.font = `900 ${Math.round(10 * p.scale)}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, 0.5);
    }

    ctx.restore();
  }

  drawCartoonPowerup(ctx, p) {
    const lx = p.lane * LANE_DIST;
    const proj = this.project(lx, p.y, p.z);
    if (!proj.visible) return;

    const size = Math.max(13, 27 * proj.scale);
    const bob = Math.sin(this.time * 6 + p.z) * 4;

    ctx.save();
    ctx.translate(proj.x, proj.y + bob);

    let col = '#38bdf8';
    let icon = '🧲';
    if (p.power === 'jetpack') { col = '#f43f5e'; icon = '🚀'; }
    else if (p.power === 'sneakers') { col = '#fbbf24'; icon = '👟'; }
    else if (p.power === 'x2') { col = '#a855f7'; icon = '2X'; }

    // Cute toy sphere with cartoon shine
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.65, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * proj.scale;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.max(10, Math.round(14 * proj.scale))}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 0, 1);

    ctx.restore();
  }

  drawCartoonMysteryBox(ctx, m) {
    const lx = m.lane * LANE_DIST;
    const proj = this.project(lx, m.y, m.z);
    if (!proj.visible) return;

    const size = Math.max(14, 28 * proj.scale);
    const bob = Math.sin(this.time * 7 + m.z) * 5;

    ctx.save();
    ctx.translate(proj.x, proj.y + bob);

    // Wrapped Polka-Dot Gift Box
    ctx.fillStyle = '#ff4d6d';
    this.rr(ctx, -size * 0.5, -size * 0.5, size, size, 6 * proj.scale);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * proj.scale;
    this.rr(ctx, -size * 0.5, -size * 0.5, size, size, 6 * proj.scale);
    ctx.stroke();

    // Yellow Ribbon & Bow
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-size * 0.12, -size * 0.5, size * 0.24, size);
    ctx.fillRect(-size * 0.5, -size * 0.12, size, size * 0.24);

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.max(10, Math.round(14 * proj.scale))}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎁', 0, 0);

    ctx.restore();
  }

  drawCartoonLetter(ctx, l) {
    const lx = l.lane * LANE_DIST;
    const proj = this.project(lx, l.y, l.z);
    if (!proj.visible) return;

    const size = Math.max(14, 28 * proj.scale);
    const bob = Math.sin(this.time * 5) * 5;

    ctx.save();
    ctx.translate(proj.x, proj.y + bob);

    // Toy Wooden Alphabet Block
    ctx.fillStyle = '#fbbf24';
    this.rr(ctx, -size * 0.5, -size * 0.5, size, size, 6 * proj.scale);
    ctx.fill();

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2 * proj.scale;
    this.rr(ctx, -size * 0.5, -size * 0.5, size, size, 6 * proj.scale);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = `900 ${Math.max(11, Math.round(15 * proj.scale))}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(l.letter, 0, 1);

    ctx.restore();
  }

  drawCartoonSprayPuff(ctx, p) {
    const proj = this.project(p.lane * LANE_DIST, p.y, p.z);
    if (!proj.visible) return;

    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 6 * proj.scale, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ------------------------------------------------------------- Inspector & Bulldog (Cartoon Mascots) */
  drawInspectorAndDog(ctx) {
    if (this.inspectorZ < -110 && !this.dead) return;

    const projInsp = this.project(this.inspectorLaneX - 18, 0, this.inspectorZ);
    const projDog = this.project(this.inspectorLaneX + 26, 0, this.inspectorZ + 4);

    if (!projInsp.visible) return;

    const scale = projInsp.scale;
    const bob = Math.sin(this.time * 14) * (4 * scale);

    // 1. Grumpy Inspector Bean (Royal Blue Police Outfit)
    ctx.save();
    ctx.translate(projInsp.x, projInsp.y + bob);

    drawBean(ctx, 0, 0, 32 * scale, {
      color: '#2563eb',
      bellyColor: '#60a5fa',
      walkT: this.dead ? 0 : this.time * 14,
      squash: 1.05,
      dir: 1,
      eyes: 'squish',
      hat: 'none',
    });

    // Inspector's Police Visor Cap
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(-12 * scale, -22 * scale, 24 * scale, 6 * scale);
    ctx.fillRect(-8 * scale, -26 * scale, 16 * scale, 6 * scale);
    // Gold Sheriff Star Badge
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, -22 * scale, 2.8 * scale, 0, TAU);
    ctx.fill();

    // Outstretched Grasping Hands
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.arc(14 * scale, -6 * scale, 4 * scale, 0, TAU);
    ctx.arc(-14 * scale, -6 * scale, 4 * scale, 0, TAU);
    ctx.fill();

    if (this.dead) {
      // Holding silver cartoon handcuffs over captured player
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5 * scale;
      ctx.beginPath();
      ctx.arc(16 * scale, -2 * scale, 4.5 * scale, 0, TAU);
      ctx.arc(25 * scale, -2 * scale, 4.5 * scale, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();

    // 2. Loyal Bulldog Bean
    ctx.save();
    ctx.translate(projDog.x, projDog.y + Math.abs(Math.sin(this.time * 16)) * 6 * scale);

    drawBean(ctx, 0, 4 * scale, 22 * scale, {
      color: '#b45309',
      bellyColor: '#d97706',
      walkT: this.dead ? 0 : this.time * 16,
      squash: 0.9,
      dir: 1,
      eyes: 'happy',
      hat: 'none',
    });

    // Red Spiked Collar
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-8 * scale, 2 * scale, 16 * scale, 3 * scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-4 * scale, 2 * scale, 2 * scale, 3 * scale);
    ctx.fillRect(2 * scale, 2 * scale, 2 * scale, 3 * scale);

    // Comic Barking Bubble: "WOOF! 🐶"
    if (!this.dead && this.inspectorZ > -32) {
      ctx.fillStyle = '#ffffff';
      this.rr(ctx, 12 * scale, -18 * scale, 36 * scale, 14 * scale, 5);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      this.rr(ctx, 12 * scale, -18 * scale, 36 * scale, 14 * scale, 5);
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.font = `900 ${Math.max(7, Math.round(8.5 * scale))}px Outfit, sans-serif`;
      ctx.fillText('WOOF! 🐶', 30 * scale, -10 * scale);
    }

    ctx.restore();

    // Playful Warning Banner if Inspector is on tail during active run
    if (!this.dead && this.inspectorZ > -32) {
      ctx.fillStyle = '#ff4d6d';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      this.rr(ctx, this.W / 2 - 88, this.groundY + 12, 176, 26, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚨 INSPECTOR ON YOUR TAIL!', this.W / 2, this.groundY + 25);
    }
  }

  /* ------------------------------------------------------------- Player Jelly Bean */
  drawPlayer(ctx, p) {
    const proj = this.project(p.laneX, p.heightY, 0);
    const beanSize = 34;

    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.rotate(this.tiltAngle);

    // Circus Striped Parachute when descending from Jetpack
    if (this.parachuteTimer > 0) {
      ctx.save();
      ctx.fillStyle = '#ff4d6d';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -44, 34, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Yellow & Cyan stripes
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(-12, -44);
      ctx.arc(0, -44, 34, Math.PI * 1.15, Math.PI * 1.35);
      ctx.closePath();
      ctx.fill();

      // Cords
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-32, -44); ctx.lineTo(0, -14);
      ctx.moveTo(32, -44); ctx.lineTo(0, -14);
      ctx.moveTo(0, -44); ctx.lineTo(0, -14);
      ctx.stroke();
      ctx.restore();
    }

    // 1. Cartoon Surfboard (When Active)
    if (this.hoverboardActive) {
      const hbPulse = 1 + Math.sin(this.time * 12) * 0.06;
      ctx.save();
      // Bright sunny yellow surfboard with teal racing stripe
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.ellipse(0, 18, 28 * hbPulse, 7, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Coral / Teal stripe
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(0, 18, 12, 4, 0, 0, TAU);
      ctx.fill();

      // Protective Bubble Shield
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -8, 38, 0, TAU);
      ctx.stroke();

      ctx.restore();
    }

    // 2. Sliding Roll vs Running Stride vs Knocked Down
    if (this.dead) {
      // Knocked down on tracks with dizzy swirly eyes & stars circling
      drawBean(ctx, 0, 8, beanSize * 0.85, {
        color: '#ff4d6d',
        bellyColor: '#ffd166',
        squash: 0.55,
        walkT: 0,
        eyes: 'dizzy',
        hat: 'none',
      });

      // Orbiting cartoon stars
      const starT = this.time * 6;
      ctx.fillStyle = '#fde047';
      ctx.font = '14px Outfit, sans-serif';
      ctx.fillText('💫', Math.cos(starT) * 18, -12 + Math.sin(starT) * 6);
      ctx.fillText('⭐', Math.cos(starT + Math.PI) * 18, -12 + Math.sin(starT + Math.PI) * 6);
    } else if (this.isSliding) {
      ctx.save();
      ctx.rotate(this.rollAngle);
      drawBean(ctx, 0, 4, beanSize * 0.85, {
        color: '#38bdf8',
        bellyColor: '#fde047',
        squash: 0.55,
        walkT: this.time * 8,
        eyes: 'squish',
        hat: 'none',
      });
      ctx.restore();

      // Puffy dust clouds on slide
      this.fx.burst(proj.x, proj.y + 12, '#ffffff', 1, 35, 0.15, 2.0);
    } else {
      // Upright Running Jelly Bean
      const squash = this.isJumping ? 1.15 : (1 - Math.abs(Math.sin(this.runAnimT)) * 0.12);

      ctx.save();
      if (this.spinAngle !== 0) ctx.rotate(this.spinAngle);

      drawBean(ctx, 0, 0, beanSize, {
        color: '#38bdf8',
        bellyColor: '#fde047',
        walkT: this.runAnimT,
        squash,
        dir: 1,
        eyes: this.stumbleTimer > 0 ? 'squish' : 'happy',
        hat: 'crown',
      });

      // Chunky Cartoon Spring Sneakers on Feet!
      if (this.sneakerTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.2;
        // Left Sneaker
        ctx.fillRect(-14, 14, 11, 7);
        ctx.strokeRect(-14, 14, 11, 7);
        // Right Sneaker
        ctx.fillRect(3, 14, 11, 7);
        ctx.strokeRect(3, 14, 11, 7);

        // Spring coils underneath
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-9, 21); ctx.lineTo(-9, 26);
        ctx.moveTo(8, 21); ctx.lineTo(8, 26);
        ctx.stroke();
      }

      // Toy Rocket Jetpack on back
      if (this.jetpackTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-16, -14, 6, 18);
        ctx.fillRect(10, -14, 6, 18);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-15, 4, 4, 8);
        ctx.fillRect(11, 4, 4, 8);
      }

      // Spray Can in hand at run start
      if (this.sprayIntroT > 0) {
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(14, -4, 6, 12);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(15, -7, 4, 3);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------- Playful Cartoon HUD */
  drawHUD(ctx, W) {
    ctx.save();

    // 1. Distance & Multiplier Badge (Top Left)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    this.rr(ctx, 14, 106, 130, 36, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = '900 13px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🏃 ${Math.floor(this.distance)}m`, 24, 124);

    if (this.scoreMultiplier > 1) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 11px Outfit, sans-serif';
      ctx.fillText(`(x${this.scoreMultiplier})`, 96, 124);
    }

    // 2. Gold Coin Counter (Top Right)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    this.rr(ctx, W - 116, 106, 102, 36, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#eab308';
    ctx.font = '900 14px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🪙 ${this.coins}`, W - 65, 124);

    // 3. Word Hunt Alphabet Blocks: [ B ] [ E ] [ A ] [ N ]
    const letters = ['B', 'E', 'A', 'N'];
    const lw = 24;
    const startX = W / 2 - (letters.length * 28) / 2 + 2;
    for (let i = 0; i < letters.length; i++) {
      const char = letters[i];
      const collected = this.lettersCollected[char];
      const lx = startX + i * 28;

      ctx.fillStyle = collected ? '#facc15' : '#ffffff';
      ctx.strokeStyle = collected ? '#ca8a04' : '#cbd5e1';
      ctx.lineWidth = 2;
      this.rr(ctx, lx, 110, lw, 26, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = collected ? '#451a03' : '#94a3b8';
      ctx.font = '900 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(char, lx + lw / 2, 123);
    }

    // 4. Active Power-up Progress Status Pills
    let pillY = 154;
    const drawPill = (label, col, timer, maxT) => {
      ctx.fillStyle = '#ffffff';
      this.rr(ctx, W / 2 - 65, pillY, 130, 20, 6);
      ctx.fill();

      // Progress bar fill
      ctx.fillStyle = col;
      this.rr(ctx, W / 2 - 65, pillY, 130 * clamp(timer / maxT, 0, 1), 20, 6);
      ctx.fill();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      this.rr(ctx, W / 2 - 65, pillY, 130, 20, 6);
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.font = '900 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, W / 2, pillY + 10);
      pillY += 24;
    };

    if (this.jetpackTimer > 0) drawPill('🚀 ROCKET', '#38bdf8', this.jetpackTimer, 8.5);
    if (this.magnetTimer > 0) drawPill('🧲 MAGNET', '#f43f5e', this.magnetTimer, 12.0);
    if (this.sneakerTimer > 0) drawPill('👟 SPRINGS', '#fbbf24', this.sneakerTimer, 14.0);
    if (this.doubleTimer > 0) drawPill('2X COINS', '#c084fc', this.doubleTimer, 15.0);

    // 5. Surfboard Quick Deployment Button (Right side, safely above bottom bar)
    const hbX = W - 76;
    const hbY = 560;
    ctx.fillStyle = this.hoverboardActive ? '#38bdf8' : (this.hoverboardStock > 0 ? '#fde047' : '#f1f5f9');
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    this.rr(ctx, hbX, hbY, 66, 46, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = '900 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏄 SURF', hbX + 33, hbY + 17);

    ctx.fillStyle = '#1e293b';
    ctx.font = '900 10px Outfit, sans-serif';
    ctx.fillText(this.hoverboardActive ? 'ACTIVE' : `x${this.hoverboardStock}`, hbX + 33, hbY + 33);

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
