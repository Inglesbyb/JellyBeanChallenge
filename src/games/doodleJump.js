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
} from '../engine/toyStyle.js';

const TAU = Math.PI * 2;
const GRAVITY = 1150;
const JUMP_VELOCITY = -680;
const SPRING_VELOCITY = -1050;
const TRAMPOLINE_VELOCITY = -1320;
const JETPACK_VELOCITY = -1180;
const PROPELLER_VELOCITY = -520;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class DoodleJump extends Game {
  static meta = {
    id: 'doodle-jump',
    title: 'Doodle Bean Jump',
    icon: '🦘',
    hint: 'A/D or DRAG to steer · BOUNCE on platforms · TAP to shoot monsters · grab Jetpacks!',
    baseLikes: 5840,
    isPrestige: false,
    parScore60s: 1800,
    cue: 'BOUNCE HIGHER!',
    prestigeCue: 'MORE MONSTERS · FASTER PLATFORMS!',
    scaling: {
      platSpeedMult: { base: 1.0, rate: 0.16, cap: 1.60, mode: 'up', label: 'Platform Speed' },
      movingBonus:   { base: 0.0, rate: 0.18, cap: 0.20, mode: 'up', deltaFormat: 'abs', unit: '%', label: 'Moving Plats' },
      monsterMult:   { base: 1.0, rate: 0.18, cap: 1.65, mode: 'up', label: 'Monsters' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.t = 0;

    // Player Physics & State
    this.x = (saved && Number.isFinite(saved.x)) ? saved.x : this.W / 2;
    this.y = (saved && Number.isFinite(saved.y)) ? saved.y : this.H - 120;
    this.vx = 0;
    this.vy = (saved && Number.isFinite(saved.vy)) ? saved.vy : JUMP_VELOCITY;
    this.w = 34;
    this.h = 42;
    this.dir = 1;
    this.squash = 1;
    this.altitude = (saved && Number.isFinite(saved.altitude)) ? saved.altitude : 0;
    this.maxAltitude = (saved && Number.isFinite(saved.maxAltitude)) ? saved.maxAltitude : 0;
    this.camY = (saved && Number.isFinite(saved.camY)) ? saved.camY : 0;
    this.recoilT = 0;

    // Active Equipment
    this.powerup = saved?.powerup || null; // 'propeller' | 'jetpack' | 'shield'
    this.powerupTimer = (saved && Number.isFinite(saved.powerupTimer)) ? saved.powerupTimer : 0;
    this.hasShield = Boolean(saved?.hasShield);

    // World Elements
    this.platforms = [];
    this.monsters = [];
    this.bullets = [];
    this.blackHoles = [];
    this.milestoneBanners = [];
    this.highestGeneratedY = this.H;

    // Background Parallax Clouds & Skyline
    this.clouds = [
      { x: 40, y: 120, w: 90, h: 28, speed: 12, alpha: 0.35 },
      { x: 260, y: 280, w: 120, h: 34, speed: 8, alpha: 0.4 },
      { x: 110, y: 460, w: 100, h: 30, speed: 15, alpha: 0.3 },
      { x: 300, y: 620, w: 80, h: 26, speed: 10, alpha: 0.35 },
    ];

    // Initial seed platforms
    if (saved && saved.platforms && saved.platforms.length > 0) {
      this.platforms = saved.platforms;
      this.monsters = saved.monsters || [];
      this.blackHoles = saved.blackHoles || [];
      this.highestGeneratedY = saved.highestGeneratedY || (this.y - 400);
    } else {
      // Starting solid home platform
      this.platforms.push({
        x: this.W / 2 - 45,
        y: this.H - 60,
        w: 90,
        h: 18,
        type: 'standard',
        item: null,
        broken: false,
        squishT: 0,
      });

      // Seed ladder of introductory platforms
      for (let y = this.H - 140; y > -500; y -= rand(55, 85)) {
        this.spawnPlatformAt(y);
      }
    }

    if (saved) this.grace = 1.2;
  }

  serialize() {
    return {
      x: Math.round(this.x),
      y: Math.round(this.y),
      vy: Math.round(this.vy),
      camY: Math.round(this.camY),
      altitude: Math.round(this.altitude),
      maxAltitude: Math.round(this.maxAltitude),
      powerup: this.powerup,
      powerupTimer: this.powerupTimer,
      hasShield: this.hasShield,
      highestGeneratedY: Math.round(this.highestGeneratedY),
      platforms: this.platforms.slice(-18),
      monsters: this.monsters.slice(-4),
      blackHoles: this.blackHoles.slice(-2),
    };
  }

  restoreLabel() {
    return `Altitude: ${Math.round(this.maxAltitude)}m`;
  }

  /* ------------------------------------------------------------ Procedural Spawning */
  spawnPlatformAt(y) {
    const diff = Math.min(1, Math.max(0, -y / 12000));
    const roll = Math.random();
    let type = 'standard';
    let item = null;

    if (roll < 0.22 + diff * 0.25 + (this.diff.movingBonus || 0)) {
      type = 'moving';
    } else if (roll < 0.35 + diff * 0.15 + (this.diff.movingBonus || 0) * 0.5) {
      type = 'brittle';
    } else if (roll < 0.45 + diff * 0.1) {
      type = 'vanishing';
    } else if (roll < 0.52 + diff * 0.1) {
      type = 'vertical';
    }

    const pw = type === 'standard' ? rand(74, 88) : rand(64, 78);
    const px = rand(15, this.W - pw - 15);

    // Spawning items on standard or moving platforms
    if ((type === 'standard' || type === 'moving') && Math.random() < 0.36) {
      const itemRoll = Math.random();
      if (itemRoll < 0.42) item = 'spring';
      else if (itemRoll < 0.68) item = 'trampoline';
      else if (itemRoll < 0.86) item = 'propeller';
      else if (itemRoll < 0.95) item = 'jetpack';
      else item = 'shield';
    }

    const plat = {
      x: px,
      y,
      w: pw,
      h: 18,
      type,
      item,
      broken: false,
      breakProgress: 0,
      squishT: 0,
      vx: type === 'moving' ? (Math.random() < 0.5 ? 1 : -1) * rand(85, 140) * (this.diff.platSpeedMult ?? 1) : 0,
      vy: type === 'vertical' ? (Math.random() < 0.5 ? 1 : -1) * rand(55, 95) * (this.diff.platSpeedMult ?? 1) : 0,
      startY: y,
      rangeY: 50,
    };
    this.platforms.push(plat);

    // Chance to spawn Monster above platform
    if (Math.random() < (0.11 + diff * 0.18) * (this.diff.monsterMult ?? 1) && y < this.H - 350) {
      const mx = clamp(px + pw / 2 + rand(-60, 60), 45, this.W - 45);
      const my = y - rand(60, 100);
      if (!this.monsters.some((m) => Math.hypot(m.x - mx, m.y - my) < 95)) {
        this.monsters.push({
          x: mx,
          y: my,
          r: 24,
          type: Math.random() < 0.38 ? 'ufo' : 'goblin',
          color: Math.random() < 0.5 ? '#f43f5e' : '#8b5cf6',
          vx: (Math.random() < 0.5 ? 40 : -40) * (this.diff.platSpeedMult ?? 1),
          hp: 1,
          rot: 0,
        });
      }
    }

    // Occasional Cosmic Black Hole hazard
    if (Math.random() < (0.04 + diff * 0.05) * (this.diff.monsterMult ?? 1) && y < -700) {
      const bx = rand(70, this.W - 70);
      const by = y - rand(75, 115);
      this.blackHoles.push({
        x: bx,
        y: by,
        r: 26,
        rot: 0,
      });
    }

    // Milestone Banners at key heights (every 1000px = 100m)
    const mDist = Math.round(-y / 10);
    if (mDist > 0 && mDist % 100 === 0 && !this.milestoneBanners.some((b) => Math.abs(b.y - y) < 150)) {
      let bannerTitle = `${mDist}m · DOCK ROOFTOPS`;
      if (mDist >= 500) bannerTitle = `${mDist}m · STRATOSPHERE`;
      else if (mDist >= 300) bannerTitle = `${mDist}m · AURORA PEAK`;
      else if (mDist >= 200) bannerTitle = `${mDist}m · CLOUD CITY`;

      this.milestoneBanners.push({
        y,
        m: mDist,
        title: bannerTitle,
        celebrated: false,
      });
    }

    this.highestGeneratedY = Math.min(this.highestGeneratedY, y);
  }

  generateWorldAhead() {
    const targetY = this.camY - 750;
    while (this.highestGeneratedY > targetY) {
      const step = rand(58, 86);
      this.spawnPlatformAt(this.highestGeneratedY - step);
    }
  }

  /* ------------------------------------------------------------ Main Update Loop */
  update(dt) {
    this.t += dt;
    if (this.recoilT > 0) this.recoilT -= dt;

    // Background clouds drift
    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > this.W + c.w) c.x = -c.w;
    }

    // Powerup Timer & Flight Physics
    if (this.powerup === 'jetpack') {
      this.powerupTimer -= dt;
      this.vy = JETPACK_VELOCITY;
      this.squash = 1.25;
      if (Math.random() < 0.55) {
        this.fx.burst(this.x - 14, this.y + 24, '#f97316', 4, 180, 0.35, 4, 250);
        this.fx.burst(this.x + 14, this.y + 24, '#facc15', 4, 180, 0.35, 4, 250);
      }
      if (this.powerupTimer <= 0) {
        this.powerup = null;
        this.vy = JUMP_VELOCITY * 0.8;
      }
    } else if (this.powerup === 'propeller') {
      this.powerupTimer -= dt;
      this.vy = PROPELLER_VELOCITY;
      this.squash = 1.15;
      if (Math.random() < 0.35) {
        this.fx.burst(this.x, this.y - 32, '#38bdf8', 2, 90, 0.25, 2.5);
      }
      if (this.powerupTimer <= 0) {
        this.powerup = null;
        this.vy = JUMP_VELOCITY * 0.7;
      }
    } else {
      // Normal Gravity
      this.vy += GRAVITY * dt;
    }

    // Horizontal Controls (Direct Pointer/Touch drag or Keyboard)
    let moveX = 0;
    if (this.input.down) {
      const dx = this.input.x - this.x;
      this.x += dx * Math.min(1, dt * 18);
      if (Math.abs(dx) > 3) this.dir = dx > 0 ? 1 : -1;
    } else {
      if (this.input.key('arrowleft', 'a')) moveX -= 400;
      if (this.input.key('arrowright', 'd')) moveX += 400;
      if (this.input.frameDX) moveX += this.input.frameDX * 20;

      this.vx += (moveX - this.vx) * Math.min(1, dt * 14);
      this.x += this.vx * dt;
      if (Math.abs(this.vx) > 15) this.dir = this.vx > 0 ? 1 : -1;
    }

    // Seamless Screen Wrap
    const margin = 22;
    if (this.x < -margin) this.x = this.W + margin;
    else if (this.x > this.W + margin) this.x = -margin;

    // Vertical Position Integration
    this.y += this.vy * dt;

    // Smooth Squash & Stretch Recovery
    this.squash += (1 - this.squash) * Math.min(1, dt * 12);

    // Shooting Action (Click/Tap top of screen or Space/W/Up)
    if (this.input.pressed && this.input.y < this.H * 0.65) {
      this.shootBullet(this.input.x, this.input.y);
    } else if (this.input.key('arrowup', 'w', ' ')) {
      if (!this.lastShootT || this.t - this.lastShootT > 0.22) {
        this.shootBullet(this.x, this.y - 120);
        this.lastShootT = this.t;
      }
    }

    // Update Projectiles
    this.updateBullets(dt);

    // Update Platforms
    this.updatePlatforms(dt);

    // Update Monsters & Hazards
    this.updateMonsters(dt);

    // Platform Collisions (Only when falling downward!)
    if (this.vy > 0 && !this.powerup) {
      this.checkPlatformCollisions();
    }

    // Camera Scrolling & Altitude Tracking
    const cameraThreshold = this.camY + this.H * 0.46;
    if (this.y < cameraThreshold) {
      const delta = cameraThreshold - this.y;
      this.camY -= delta;
    }

    // Altitude Calculation (Meters above ground)
    this.altitude = Math.max(0, -this.camY / 10);
    if (this.altitude > this.maxAltitude) {
      const diff = this.altitude - this.maxAltitude;
      this.maxAltitude = this.altitude;
      this.score += diff * 1.5;
    }

    // Check Milestone Banners
    for (const b of this.milestoneBanners) {
      if (!b.celebrated && this.y <= b.y) {
        b.celebrated = true;
        this.score += 250;
        this.sounds.up();
        this.haptics.medium();
        this.fx.text(this.W / 2, this.y - 40, `🚩 ${b.title}! +250`, '#ffd166', 26, 1.3);
        this.fx.burst(this.W / 2, this.y, '#facc15', 30, 260, 0.7, 5);
        this.fx.ring(this.W / 2, this.y, '#38bdf8', 220, 0.6, 5);
      }
    }

    // Generate upcoming world ahead
    this.generateWorldAhead();

    // Clean up fallen entities
    const despawnFloor = this.camY + this.H + 120;
    this.platforms = this.platforms.filter((p) => p.y < despawnFloor && (!p.broken || p.breakProgress < 1));
    this.monsters = this.monsters.filter((m) => m.y < despawnFloor);
    this.blackHoles = this.blackHoles.filter((b) => b.y < despawnFloor);
    this.milestoneBanners = this.milestoneBanners.filter((b) => b.y < despawnFloor);

    // Death Check: Falling below bottom of screen!
    if (this.y > this.camY + this.H + 40 && !this.dead) {
      if (this.die('Plummeted into the docklands abyss!')) {
        this.sounds.fail();
        this.haptics.heavy();
        this.fx.shake(16, 0.55);
      }
    }

    this.fx.update(dt);
  }

  /* ------------------------------------------------------------ Combat & Projectiles */
  shootBullet(targetX, targetY) {
    const angle = Math.atan2(targetY - (this.y - 20), targetX - this.x);
    const speed = 950;
    this.recoilT = 0.12;

    this.bullets.push({
      x: this.x,
      y: this.y - 24,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.2,
    });

    this.sounds.slice();
    this.haptics.light();
    this.fx.burst(this.x, this.y - 24, '#fde047', 6, 140, 0.25, 3.5);
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      // Hit-check against Monsters
      for (const m of this.monsters) {
        if (m.hp > 0 && Math.hypot(m.x - b.x, m.y - b.y) < m.r + 10) {
          m.hp = 0;
          b.life = 0;
          this.score += 450;
          this.sounds.hit();
          this.haptics.medium();
          this.fx.text(m.x, m.y, 'POW! SQUASHED! +450', '#facc15', 24, 1.1);
          this.fx.burst(m.x, m.y, m.color, 28, 260, 0.65, 5);
          this.fx.ring(m.x, m.y, '#facc15', 100, 0.45, 5);
          this.fx.shake(8, 0.25);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  /* ------------------------------------------------------------ Platform Logic */
  updatePlatforms(dt) {
    for (const p of this.platforms) {
      if (p.squishT > 0) p.squishT -= dt * 4;

      // Horizontal slide
      if (p.type === 'moving') {
        p.x += p.vx * dt;
        if (p.x < 15) {
          p.x = 15;
          p.vx = Math.abs(p.vx);
        } else if (p.x + p.w > this.W - 15) {
          p.x = this.W - 15 - p.w;
          p.vx = -Math.abs(p.vx);
        }
      }
      // Vertical glide
      else if (p.type === 'vertical') {
        p.y += p.vy * dt;
        if (p.y < p.startY - p.rangeY) {
          p.y = p.startY - p.rangeY;
          p.vy = Math.abs(p.vy);
        } else if (p.y > p.startY + p.rangeY) {
          p.y = p.startY + p.rangeY;
          p.vy = -Math.abs(p.vy);
        }
      }
      // Brittle breaking animation
      if (p.broken) {
        p.breakProgress += dt * 3.5;
        p.y += dt * 300;
      }
    }
  }

  checkPlatformCollisions() {
    const feetY = this.y + this.h * 0.45;
    const feetPrevY = feetY - this.vy * 0.02;

    for (const p of this.platforms) {
      if (p.broken) continue;

      const platTop = p.y;
      const isOver = this.x >= p.x - 14 && this.x <= p.x + p.w + 14;

      // Crossing platform surface from above
      if (isOver && feetPrevY <= platTop + 6 && feetY >= platTop - 6) {
        // 1. Brittle gingerbread breaks!
        if (p.type === 'brittle') {
          p.broken = true;
          this.sounds.hit();
          this.haptics.heavy();
          this.fx.burst(p.x + p.w / 2, p.y, '#b45309', 18, 180, 0.45, 4.5);
          this.fx.shake(6, 0.22);
          continue;
        }

        p.squishT = 1.0;

        // 2. Equipped Item on platform!
        if (p.item) {
          if (p.item === 'spring') {
            this.vy = SPRING_VELOCITY;
            this.squash = 0.55;
            this.sounds.stack(2);
            this.haptics.heavy();
            this.fx.text(this.x, this.y - 30, 'SPRING BOUNCE! 🌀', '#38bdf8', 26, 1.0);
            this.fx.burst(this.x, p.y, '#38bdf8', 20, 220, 0.55, 4.5);
            this.fx.ring(this.x, p.y, '#38bdf8', 110, 0.45, 5);
            p.item = null;
            return;
          } else if (p.item === 'trampoline') {
            this.vy = TRAMPOLINE_VELOCITY;
            this.squash = 0.42;
            this.sounds.stack(4);
            this.haptics.heavy();
            this.fx.text(this.x, this.y - 30, 'SUPER TRAMPOLINE! 🎪', '#facc15', 28, 1.2);
            this.fx.burst(this.x, p.y, '#facc15', 26, 280, 0.65, 5);
            this.fx.ring(this.x, p.y, '#facc15', 150, 0.55, 6);
            p.item = null;
            return;
          } else if (p.item === 'jetpack') {
            this.powerup = 'jetpack';
            this.powerupTimer = 4.5;
            this.sounds.up();
            this.haptics.heavy();
            this.fx.text(this.x, this.y - 30, 'ROCKET JETPACK! 🚀', '#f97316', 32, 1.4);
            this.fx.ring(this.x, this.y, '#f97316', 180, 0.65, 6);
            p.item = null;
            return;
          } else if (p.item === 'propeller') {
            this.powerup = 'propeller';
            this.powerupTimer = 4.0;
            this.sounds.slice();
            this.haptics.medium();
            this.fx.text(this.x, this.y - 30, 'PROPELLER BEANIE! 🚁', '#38bdf8', 28, 1.1);
            p.item = null;
            return;
          } else if (p.item === 'shield') {
            this.hasShield = true;
            this.sounds.up();
            this.haptics.medium();
            this.fx.text(this.x, this.y - 30, 'BUBBLE SHIELD! 🛡️', '#c084fc', 26, 1.0);
            p.item = null;
          }
        }

        // 3. Vanishing platform evaporates after jump
        if (p.type === 'vanishing') {
          p.broken = true;
          this.fx.burst(p.x + p.w / 2, p.y, '#c084fc', 16, 160, 0.45, 3.5);
        }

        // 4. Standard Jelly Bounce!
        this.vy = JUMP_VELOCITY;
        this.squash = 0.65;
        this.y = platTop - this.h * 0.45;
        this.sounds.bubble(1.2);
        this.haptics.light();
        this.fx.burst(this.x, platTop, '#4ade80', 10, 140, 0.35, 3.5);
        this.fx.ring(this.x, platTop, '#4ade80', 60, 0.35, 3.5);
        break;
      }
    }
  }

  /* ------------------------------------------------------------ Monsters & Hazards */
  updateMonsters(dt) {
    for (const m of this.monsters) {
      if (m.hp <= 0) continue;
      m.x += m.vx * dt;
      if (m.x < 40 || m.x > this.W - 40) m.vx = -m.vx;

      // Distance to Doodler
      const d = Math.hypot(m.x - this.x, m.y - this.y);

      // Jetpack / Propeller invincibility squashes monster
      if (d < m.r + 22 && (this.powerup === 'jetpack' || this.powerup === 'propeller')) {
        m.hp = 0;
        this.score += 500;
        this.sounds.hit();
        this.fx.text(m.x, m.y, 'OBLITERATED! +500', '#facc15', 26, 1.1);
        this.fx.burst(m.x, m.y, m.color, 28, 260, 0.65, 5);
        continue;
      }

      // Stomp on top of monster head
      if (this.vy > 0 && this.y + this.h * 0.45 < m.y && d < m.r + 26) {
        m.hp = 0;
        this.vy = JUMP_VELOCITY * 1.15;
        this.squash = 0.58;
        this.score += 500;
        this.sounds.hit();
        this.haptics.heavy();
        this.fx.text(m.x, m.y, 'HEAD STOMP! +500', '#38bdf8', 28, 1.2);
        this.fx.burst(m.x, m.y, m.color, 30, 280, 0.7, 5.5);
        continue;
      }

      // Monster bite!
      if (d < m.r + 15 && !this.dead) {
        if (this.hasShield) {
          // Bubble Shield absorbs the blow!
          this.hasShield = false;
          m.hp = 0;
          this.vy = JUMP_VELOCITY;
          this.sounds.hit();
          this.haptics.heavy();
          this.fx.text(this.x, this.y - 30, 'SHIELD BROKEN!', '#c084fc', 26, 1.0);
          this.fx.burst(this.x, this.y, '#c084fc', 24, 220, 0.55, 4.5);
          this.fx.shake(9, 0.32);
          continue;
        }

        if (this.die(`Caught by ${m.type === 'ufo' ? 'Alien UFO' : 'Quayside Gargoyle'}!`)) {
          this.sounds.fail();
          this.haptics.heavy();
          this.fx.burst(this.x, this.y, '#f43f5e', 36, 300, 0.75, 5.5);
          this.fx.shake(16, 0.55);
        }
      }
    }

    // Black Holes Gravitational Pull
    for (const bh of this.blackHoles) {
      bh.rot += dt * 5;
      const d = Math.hypot(bh.x - this.x, bh.y - this.y);
      if (d < 120) {
        const pull = (140 - d) * 1.9 * dt;
        this.x += ((bh.x - this.x) / d) * pull;
        this.y += ((bh.y - this.y) / d) * pull;

        if (d < bh.r + 10 && !this.dead) {
          if (this.die('Swallowed into a cosmic black hole!')) {
            this.sounds.chomp();
            this.haptics.heavy();
            this.fx.burst(bh.x, bh.y, '#8b5cf6', 36, 320, 0.85, 6);
            this.fx.shake(18, 0.6);
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------ Rendering Pipeline */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const off = this.fx.offset();

    // 1. Layered Atmosphere (Dusk -> Aurora -> Cosmic Space)
    this.renderAtmosphere(ctx, W, H);

    ctx.save();
    ctx.translate(off.x, off.y - this.camY);

    // 2. Milestone Altitude Banners
    for (const b of this.milestoneBanners) {
      this.drawMilestoneBanner(b, ctx);
    }

    // 3. Black Holes
    for (const bh of this.blackHoles) {
      this.drawBlackHole(bh, ctx);
    }

    // 4. Platforms & Powerups
    for (const p of this.platforms) {
      this.drawPlatform(p, ctx);
    }

    // 5. Monsters
    for (const m of this.monsters) {
      if (m.hp > 0) this.drawMonster(m, ctx);
    }

    // 6. Projectiles (Glowing 3D Energy Orbs)
    for (const b of this.bullets) {
      ctx.save();
      ctx.fillStyle = 'rgba(253, 224, 71, 0.32)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 11, 0, TAU);
      ctx.fill();
      drawToySphere(ctx, b.x, b.y, 7, '#fde047', {
        rimColor: toyRim('#f59e0b', 0.56),
        lineWidth: 1.3,
        shine: 0.85,
      });
      ctx.restore();
    }

    // 7. The Doodler Mascot
    this.drawDoodler(ctx);

    // Particles layer
    this.fx.render(ctx, 1);
    ctx.restore();

    // 8. Polished 3D Toy HUD
    this.renderHUD(ctx, W, H);
  }

  /* ------------------------------------------------------------ Visuals */
  renderAtmosphere(ctx, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    const progress = clamp(this.maxAltitude / 600, 0, 1);

    if (progress < 0.35) {
      // Golden Hour Twilight over Liverpool Albert Dock
      bg.addColorStop(0, '#1e1b4b');
      bg.addColorStop(0.35, '#581c87');
      bg.addColorStop(0.65, '#9d174d');
      bg.addColorStop(0.85, '#ea580c');
      bg.addColorStop(1, '#facc15');
    } else if (progress < 0.75) {
      // Aurora Cloud Kingdom (Deep Indigo to Electric Cyan Ribbon)
      bg.addColorStop(0, '#070b1e');
      bg.addColorStop(0.35, '#1e1b4b');
      bg.addColorStop(0.7, '#0f766e');
      bg.addColorStop(1, '#06b6d4');
    } else {
      // Deep Cosmic Nebula & Velvet Void
      bg.addColorStop(0, '#09061a');
      bg.addColorStop(0.4, '#13092b');
      bg.addColorStop(0.7, '#2e1065');
      bg.addColorStop(1, '#0f172a');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Distant Liverpool Dock Silhouette at early heights
    if (this.maxAltitude < 160) {
      const cityAlpha = Math.max(0, 1 - this.maxAltitude / 160);
      ctx.save();
      ctx.globalAlpha = cityAlpha * 0.45;
      ctx.fillStyle = '#1e1338';
      ctx.beginPath();
      ctx.moveTo(0, H - 40);
      ctx.lineTo(35, H - 75);
      ctx.lineTo(60, H - 55);
      ctx.lineTo(95, H - 120); // Tower
      ctx.lineTo(105, H - 160); // Spire
      ctx.lineTo(115, H - 120);
      ctx.lineTo(160, H - 65);
      ctx.lineTo(210, H - 110);
      ctx.lineTo(220, H - 150); // Clock tower
      ctx.lineTo(230, H - 110);
      ctx.lineTo(280, H - 60);
      ctx.lineTo(W, H - 85);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Drifting Pillowy 3D Vinyl Clouds
    for (const c of this.clouds) {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      const cg = ctx.createLinearGradient(c.x, c.y - c.h * 0.6, c.x, c.y + c.h * 0.6);
      cg.addColorStop(0, '#ffffff');
      cg.addColorStop(0.7, '#f1f5f9');
      cg.addColorStop(1, '#cbd5e1');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w * 0.5, c.h * 0.5, 0, 0, TAU);
      ctx.ellipse(c.x - c.w * 0.25, c.y + 4, c.w * 0.35, c.h * 0.45, 0, 0, TAU);
      ctx.ellipse(c.x + c.w * 0.25, c.y + 4, c.w * 0.35, c.h * 0.45, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Cosmic Starfield & Shimmering Aurora at higher altitudes
    if (this.maxAltitude > 140) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let i = 0; i < 36; i++) {
        const sx = ((i * 59) % W);
        const sy = ((i * 97 - this.camY * 0.15) % H);
        const twinkle = Math.sin(this.t * 4 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const sr = (i % 4 === 0) ? 2.4 : 1.4;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawMilestoneBanner(b, ctx) {
    ctx.save();
    ctx.translate(0, b.y);

    // Decorative Festive Bunting Ribbon across the screen
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(this.W, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3D Toy Milestone Badge
    const bw = 246;
    const bh = 34;
    drawToyBevelRect(ctx, (this.W - bw) / 2, -bh / 2, bw, bh, 12, '#0f172a', {
      depth: 3,
      rimColor: '#facc15',
      lineWidth: 2,
      gloss: false,
    });

    ctx.font = "700 13px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    const titleStr = `🚩 ${b.title}`;
    ctx.strokeText(titleStr, this.W / 2, 0);
    ctx.fillStyle = '#fde047';
    ctx.fillText(titleStr, this.W / 2, 0);

    ctx.restore();
  }

  drawPlatform(p, ctx) {
    if (p.broken && p.breakProgress >= 1) return;

    ctx.save();
    if (p.broken) {
      ctx.globalAlpha = Math.max(0, 1 - p.breakProgress);
    }

    const squishScale = p.squishT > 0 ? 1 - p.squishT * 0.18 : 1;
    const py = p.y + (1 - squishScale) * p.h;
    const ph = p.h * squishScale;

    // Platform Soft Grounding Shadow
    drawToyShadow(ctx, p.x + p.w * 0.5, py + ph + 5, p.w * 0.46, 5, 0.24);

    // Platform Color Palette
    let platCol = '#22c55e'; // Green standard
    if (p.type === 'moving') {
      platCol = '#38bdf8'; // Blue moving
    } else if (p.type === 'brittle') {
      platCol = '#d97706'; // Brown gingerbread
    } else if (p.type === 'vanishing') {
      platCol = '#c084fc'; // Purple amethyst
    } else if (p.type === 'vertical') {
      platCol = '#facc15'; // Yellow honey
    }

    // 3D Vinyl Toy Bevel Platform
    drawToyBevelRect(ctx, p.x, py, p.w, ph, 9, platCol, {
      depth: 4 * squishScale,
      rimColor: toyRim(platCol, 0.58),
      lineWidth: 1.5,
      gloss: true,
    });

    // Moving Platform Hover Thruster Glow
    if (p.type === 'moving') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.beginPath();
      ctx.arc(p.x + 12, py + ph + 3, 4, 0, TAU);
      ctx.arc(p.x + p.w - 12, py + ph + 3, 4, 0, TAU);
      ctx.fill();
    }

    // Brittle Gingerbread Cracking Lines & 3D Chocolate Chips
    if (p.type === 'brittle') {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.35, py + 1);
      ctx.lineTo(p.x + p.w * 0.48, py + ph - 1);
      ctx.moveTo(p.x + p.w * 0.65, py + 1);
      ctx.lineTo(p.x + p.w * 0.52, py + ph - 1);
      ctx.stroke();

      drawToySphere(ctx, p.x + 14, py + ph * 0.48, 3, '#78350f', { rimColor: '#451a03', lineWidth: 0.8 });
      drawToySphere(ctx, p.x + p.w - 16, py + ph * 0.54, 3, '#78350f', { rimColor: '#451a03', lineWidth: 0.8 });
    }

    // Standard Platform Cute Green Sprout Leaf
    if (p.type === 'standard') {
      ctx.fillStyle = '#86efac';
      ctx.strokeStyle = toyRim('#22c55e', 0.55);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(p.x + p.w - 8, py - 3.5, 4.8, 3, -0.4, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Platform Items (3D Vinyl Toy Pickups)
    if (p.item) {
      const ix = p.x + p.w / 2;
      const iy = py - 12;

      if (p.item === 'spring') {
        // 3D Coiled Steel Spring
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(ix - 8, py);
        ctx.lineTo(ix + 8, py - 4);
        ctx.lineTo(ix - 8, py - 8);
        ctx.lineTo(ix + 8, py - 12);
        ctx.stroke();

        // 3D Red Launcher Cap
        drawToyBevelRect(ctx, ix - 10, py - 17, 20, 6, 3, '#ef4444', {
          depth: 1.5,
          rimColor: toyRim('#ef4444', 0.56),
          lineWidth: 1.2,
        });
      } else if (p.item === 'trampoline') {
        // 3D Circus Trampoline
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ix - 14, py); ctx.lineTo(ix - 10, py - 3);
        ctx.moveTo(ix + 14, py); ctx.lineTo(ix + 10, py - 3);
        ctx.stroke();

        drawToyBevelRect(ctx, ix - 16, py - 9, 32, 8, 4, '#ef4444', {
          depth: 2,
          rimColor: toyRim('#ef4444', 0.56),
          lineWidth: 1.3,
        });

        // White stripes
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.fillRect(ix - 8, py - 8, 5, 6);
        ctx.fillRect(ix + 3, py - 8, 5, 6);
      } else if (p.item === 'jetpack') {
        // Dual Chrome Rocket Canisters
        drawToyBevelRect(ctx, ix - 11, iy - 8, 10, 20, 4, '#cbd5e1', {
          depth: 0,
          rimColor: toyRim('#64748b', 0.55),
          lineWidth: 1.2,
        });
        drawToyBevelRect(ctx, ix + 1, iy - 8, 10, 20, 4, '#cbd5e1', {
          depth: 0,
          rimColor: toyRim('#64748b', 0.55),
          lineWidth: 1.2,
        });

        // Red Nozzle Cones
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = toyRim('#ef4444', 0.56);
        ctx.lineWidth = 1.1;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(ix - 11, iy - 8); ctx.lineTo(ix - 6, iy - 16); ctx.lineTo(ix - 1, iy - 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ix + 1, iy - 8); ctx.lineTo(ix + 6, iy - 16); ctx.lineTo(ix + 11, iy - 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Yellow Caution Stripes
        ctx.fillStyle = '#facc15';
        ctx.fillRect(ix - 9.5, iy, 7, 3);
        ctx.fillRect(ix + 2.5, iy, 7, 3);
      } else if (p.item === 'propeller') {
        // Multi-colored Helicopter Beanie
        const dg = ctx.createRadialGradient(ix - 3, iy - 4, 2, ix, iy, 10);
        dg.addColorStop(0, '#fda4af');
        dg.addColorStop(1, '#e11d48');
        ctx.fillStyle = dg;
        ctx.strokeStyle = toyRim('#f43f5e', 0.56);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(ix, iy, 9, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Blue Propeller Blade & Brass Rotor
        drawToyPill(ctx, ix - 14, iy - 11, 28, 4.5, '#38bdf8', {
          rimColor: toyRim('#0284c7', 0.55),
          lineWidth: 1.1,
        });
        drawToySphere(ctx, ix, iy - 9, 3.6, '#facc15', {
          rimColor: toyRim('#ca8a04', 0.55),
          lineWidth: 1.0,
        });
      } else if (p.item === 'shield') {
        // Shimmering 3D Soap Bubble
        const bg = ctx.createRadialGradient(ix - 3, iy - 3, 2, ix, iy, 12);
        bg.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        bg.addColorStop(0.4, 'rgba(192, 132, 252, 0.45)');
        bg.addColorStop(1, 'rgba(56, 189, 248, 0.7)');
        ctx.fillStyle = bg;
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(ix, iy, 11, 0, TAU);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.beginPath();
        ctx.ellipse(ix - 4, iy - 4, 3.5, 1.6, -0.6, 0, TAU);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  drawMonster(m, ctx) {
    ctx.save();
    ctx.translate(m.x, m.y);

    if (m.type === 'ufo') {
      // Sleek Retro-Futuristic 3D Toy Flying Saucer
      // Tractor beam glow
      const tg = ctx.createLinearGradient(0, 0, 0, 50);
      tg.addColorStop(0, 'rgba(250, 204, 21, 0.35)');
      tg.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(-10, 4); ctx.lineTo(10, 4); ctx.lineTo(26, 50); ctx.lineTo(-26, 50);
      ctx.closePath();
      ctx.fill();

      // Glowing Glass Cockpit Bubble
      const domeG = ctx.createRadialGradient(-4, -14, 2, 0, -7, 14);
      domeG.addColorStop(0, 'rgba(224, 242, 254, 0.9)');
      domeG.addColorStop(0.6, 'rgba(56, 189, 248, 0.65)');
      domeG.addColorStop(1, 'rgba(2, 132, 199, 0.8)');
      ctx.fillStyle = domeG;
      ctx.strokeStyle = toyRim('#0284c7', 0.56);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, -7, 13, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Little 3D Vinyl Alien Pilot inside
      drawToySphere(ctx, 0, -9, 6.5, '#4ade80', {
        rimColor: toyRim('#16a34a', 0.56),
        lineWidth: 1.0,
      });
      drawToyEyes(ctx, 0, -9.5, 1.7, { spacing: 4.2, style: 'bright' });

      // 3D Metallic Saucer Hull
      const hullG = ctx.createLinearGradient(0, -10, 0, 10);
      hullG.addColorStop(0, '#cbd5e1');
      hullG.addColorStop(0.5, '#64748b');
      hullG.addColorStop(1, '#334155');
      ctx.fillStyle = hullG;
      ctx.strokeStyle = toyRim('#475569', 0.6);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 10, 0, 0, TAU);
      ctx.fill(); ctx.stroke();

      // Specular hull highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.ellipse(-9, -4.5, 11, 2.5, -0.1, 0, TAU);
      ctx.fill();

      // Pulsing Rainbow Running Lights
      const lights = ['#ef4444', '#facc15', '#22c55e', '#38bdf8'];
      for (let i = 0; i < 4; i++) {
        const lx = -18 + i * 12;
        const lCol = lights[(i + Math.floor(this.t * 6)) % lights.length];
        drawToySphere(ctx, lx, 1.5, 3.2, lCol, {
          rimColor: toyRim(lCol, 0.55),
          lineWidth: 0.9,
        });
      }
    } else {
      // Animated Quayside Gargoyle / Flying Goblin (3D Vinyl Toy Creature)
      const flap = Math.sin(this.t * 14) * 14;
      const wingRim = toyRim('#475569', 0.56);
      const bodyRim = toyRim(m.color, 0.58);

      // Leathery Bat Wings with smooth gradient
      const wg = ctx.createLinearGradient(0, -18, 0, 10);
      wg.addColorStop(0, '#64748b');
      wg.addColorStop(1, '#334155');
      ctx.fillStyle = wg;
      ctx.strokeStyle = wingRim;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.quadraticCurveTo(-26, -24 + flap, -32, -8 + flap);
      ctx.quadraticCurveTo(-20, 8, -10, 4);
      ctx.fill(); ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(10, -4);
      ctx.quadraticCurveTo(26, -24 - flap, 32, -8 - flap);
      ctx.quadraticCurveTo(20, 8, 10, 4);
      ctx.fill(); ctx.stroke();

      // Pointy Ears
      ctx.fillStyle = shadeColor(m.color, 0.12);
      ctx.strokeStyle = bodyRim;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-16, -14); ctx.lineTo(-22, -26); ctx.lineTo(-10, -18);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, -14); ctx.lineTo(22, -26); ctx.lineTo(10, -18);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // 3D Vinyl Round Monster Body
      drawToySphere(ctx, 0, 0, m.r, m.color, {
        rimColor: bodyRim,
        lineWidth: toyLineW(m.r * 2, 0.042, 1.0, 2.0),
        shine: 0.65,
      });

      // Crisp Toy Eyes tracking player
      drawToyEyes(ctx, 0, -4, 5.2, {
        spacing: 15,
        style: 'angry',
        lookX: m.vx >= 0 ? 0.35 : -0.35,
        lookY: 0.35,
        ink: '#0f172a',
      });

      // Cute Vampire Fangs
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.1;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, 8); ctx.lineTo(-4, 15); ctx.lineTo(-1, 8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(1, 8); ctx.lineTo(4, 15); ctx.lineTo(7, 8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    ctx.restore();
  }

  drawBlackHole(bh, ctx) {
    ctx.save();
    ctx.translate(bh.x, bh.y);
    ctx.rotate(bh.rot);

    // Dynamic Swirling Galaxy Accretion Disks
    const bg = ctx.createRadialGradient(0, 0, 4, 0, 0, bh.r * 2.2);
    bg.addColorStop(0, '#090418');
    bg.addColorStop(0.35, '#581c87');
    bg.addColorStop(0.7, '#a855f7');
    bg.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, bh.r * 2.2, 0, TAU);
    ctx.fill();

    // Swirling Spiral Arms
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let a = 0; a < TAU; a += TAU / 3) {
      ctx.beginPath();
      ctx.arc(0, 0, bh.r * 1.5, a, a + 1.2);
      ctx.stroke();
    }

    // Event Horizon Core
    ctx.fillStyle = '#090418';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, bh.r, 0, TAU);
    ctx.fill(); ctx.stroke();

    ctx.restore();
  }

  drawDoodler(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Soft Shadow cast onto nearest platform
    drawToyShadow(ctx, 0, 24, 18, 5, 0.24);

    // Bubble Shield Effect
    if (this.hasShield) {
      const sg = ctx.createRadialGradient(-8, -8, 4, 0, 0, 36);
      sg.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      sg.addColorStop(0.5, 'rgba(192, 132, 252, 0.35)');
      sg.addColorStop(1, 'rgba(56, 189, 248, 0.6)');
      ctx.fillStyle = sg;
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, TAU);
      ctx.fill(); ctx.stroke();
    }

    // Rocket Jetpack Attachment
    if (this.powerup === 'jetpack') {
      drawToyBevelRect(ctx, -22, -12, 10, 30, 4, '#cbd5e1', {
        depth: 0,
        rimColor: toyRim('#64748b', 0.56),
        lineWidth: 1.4,
      });
      drawToyBevelRect(ctx, 12, -12, 10, 30, 4, '#cbd5e1', {
        depth: 0,
        rimColor: toyRim('#64748b', 0.56),
        lineWidth: 1.4,
      });

      // Roaring twin jet flames
      const flame = rand(18, 32);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(-22, 18); ctx.lineTo(-17, 18 + flame); ctx.lineTo(-12, 18);
      ctx.moveTo(12, 18); ctx.lineTo(17, 18 + flame); ctx.lineTo(22, 18);
      ctx.fill();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(-20, 18); ctx.lineTo(-17, 18 + flame * 0.6); ctx.lineTo(-14, 18);
      ctx.moveTo(14, 18); ctx.lineTo(17, 18 + flame * 0.6); ctx.lineTo(20, 18);
      ctx.fill();
    }

    // Propeller Beanie Attachment
    if (this.powerup === 'propeller') {
      const spin = Math.max(4, Math.abs(Math.sin(this.t * 40)) * 18);
      drawToyPill(ctx, -spin, -36, spin * 2, 5, '#38bdf8', {
        rimColor: toyRim('#0284c7', 0.55),
        lineWidth: 1.1,
      });
      drawToySphere(ctx, 0, -30, 4.5, '#facc15', {
        rimColor: toyRim('#ca8a04', 0.55),
        lineWidth: 1.1,
      });
    }

    // Nose Blaster Snout with Recoil (3D shaded)
    const recoil = this.recoilT > 0 ? -4 : 0;
    ctx.save();
    ctx.translate(0, recoil);
    const snoutG = ctx.createRadialGradient(-3, -24, 1.5, 0, -22, 9);
    snoutG.addColorStop(0, '#fda4af');
    snoutG.addColorStop(0.5, '#fb7185');
    snoutG.addColorStop(1, '#e11d48');
    ctx.fillStyle = snoutG;
    ctx.strokeStyle = toyRim('#fb7185', 0.58);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, -22, 8, 6, 0, 0, TAU);
    ctx.fill(); ctx.stroke();
    // Snout opening
    ctx.fillStyle = '#9f1239';
    ctx.beginPath(); ctx.arc(0, -22, 2.8, 0, TAU); ctx.fill();
    ctx.restore();

    // Doodler Jellybean Mascot
    const eyeExpression = this.dead ? 'squish' : this.vy < -600 ? 'wink' : 'happy';
    drawBean(ctx, 0, 0, 30, {
      color: '#38bdf8',
      bellyColor: '#fda4af',
      dir: this.dir,
      squash: this.squash,
      hat: this.powerup ? 'none' : 'crown',
      eyes: eyeExpression,
      dead: this.dead,
    });

    // Cute Bouncing 3D Vinyl Shoes
    const kick = Math.sin(this.t * 12) * 3;
    drawToyBevelRect(ctx, -14, 20 + kick, 10, 8, 4, '#facc15', {
      depth: 2,
      rimColor: toyRim('#ca8a04', 0.55),
      lineWidth: 1.2,
    });
    drawToyBevelRect(ctx, 4, 20 - kick, 10, 8, 4, '#facc15', {
      depth: 2,
      rimColor: toyRim('#ca8a04', 0.55),
      lineWidth: 1.2,
    });

    ctx.restore();
  }

  /* ------------------------------------------------------------ Deluxe 3D Toy HUD */
  renderHUD(ctx, W, H) {
    const pillX = 14;
    const pillY = 105;
    const m = Math.round(this.maxAltitude);

    ctx.save();
    ctx.lineJoin = 'round';

    // 3D Toy Bevel HUD Card
    drawToyBevelRect(ctx, pillX, pillY, 240, 56, 14, '#0f172a', {
      depth: 3,
      rimColor: '#38bdf8',
      lineWidth: 2,
      gloss: false,
    });

    ctx.textAlign = 'left';
    ctx.strokeStyle = '#0f172a';

    // Title & Altitude
    ctx.font = "700 13px 'Fredoka', 'Outfit', sans-serif";
    ctx.lineWidth = 2.6;
    const altTxt = `🦘 DOODLE JUMP · ${m}m`;
    ctx.strokeText(altTxt, pillX + 14, pillY + 19);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(altTxt, pillX + 14, pillY + 19);

    // Score
    ctx.font = "700 11px 'Fredoka', 'Outfit', sans-serif";
    ctx.lineWidth = 2.2;
    const scoreTxt = `SCORE: ${Math.round(this.score)} PTS`;
    ctx.strokeText(scoreTxt, pillX + 14, pillY + 34);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(scoreTxt, pillX + 14, pillY + 34);

    // Status / Equipment Badge
    ctx.font = "700 10px 'Fredoka', 'Outfit', sans-serif";
    let statusTxt = '● TAP TO SHOOT MONSTERS';
    let statusCol = '#4ade80';
    if (this.powerup === 'jetpack') {
      statusTxt = `🚀 JETPACK ACTIVE! ${this.powerupTimer.toFixed(1)}s`;
      statusCol = '#f97316';
    } else if (this.powerup === 'propeller') {
      statusTxt = `🚁 PROPELLER ACTIVE! ${this.powerupTimer.toFixed(1)}s`;
      statusCol = '#38bdf8';
    } else if (this.hasShield) {
      statusTxt = '🛡️ BUBBLE SHIELD EQUIPPED';
      statusCol = '#c084fc';
    }
    ctx.strokeText(statusTxt, pillX + 14, pillY + 48);
    ctx.fillStyle = statusCol;
    ctx.fillText(statusTxt, pillX + 14, pillY + 48);

    ctx.restore();
  }
}
