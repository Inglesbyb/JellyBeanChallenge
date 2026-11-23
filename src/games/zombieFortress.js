import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';
import {
  shadeColor,
  mixColor,
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
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export class ZombieFortress extends Game {
  static meta = {
    id: 'zombie-fortress',
    title: 'Zombie Fortress',
    icon: '🧟',
    hint: 'DRAG to aim & unleash heavy fire · SPEND gold live on Upgrades · DEFEND the wall!',
    baseLikes: 3420,
    isPrestige: false,
    parScore60s: 2800,
    cue: 'DEFEND THE WALL!',
    prestigeCue: 'TOUGHER HORDE · FASTER ZOMBIES!',
    scaling: {
      zombieHpMult:    { base: 1.0, rate: 0.16, cap: 1.85, mode: 'up', label: 'Zombie HP' },
      zombieSpeedMult: { base: 1.0, rate: 0.15, cap: 1.40, mode: 'up', label: 'Zombie Speed' },
      waveSizeMult:    { base: 1.0, rate: 0.15, cap: 1.50, mode: 'up', label: 'Horde Size' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    // Upgrades & Economy
    this.gold = 25;
    this.damageLevel = 1;
    this.fireRateLevel = 1;
    this.gunCount = 1; // 1 to 5 guns on fortress wall
    this.multiShotLevel = 1;
    this.wallLevel = 1;

    // Fortress & Wall Stats (Wall sits at Y = 565)
    this.wallY = 565;
    this.maxWallHp = 200;
    this.wallHp = 200;

    // Turret & Player Batteries
    this.turretX = this.W / 2;
    this.turretY = this.wallY + 8;
    this.aimAngle = -Math.PI / 2; // Aiming upwards
    this.fireCooldown = 0;
    this.firing = false;
    this.recoil = 0;

    // Multi-turret angles and cooldown tracking
    this.turretAngles = [-Math.PI / 2, -Math.PI / 2, -Math.PI / 2, -Math.PI / 2, -Math.PI / 2];
    this.turretRecoil = [0, 0, 0, 0, 0];
    this.turretCooldowns = [0, 0, 0, 0, 0];

    // Spitting acid pools on the wall
    this.acidPools = [];

    // Shell casings ejected from machine gun
    this.casings = [];

    // Wave Progression
    this.wave = 1;
    this.waveEnemiesLeft = 0;
    this.waveTotalEnemies = 0;
    this.waveSpawnTimer = 0;
    this.waveBreakTimer = 1.5; // Brief intro delay
    this.waveActive = false;
    this.zombiesKilled = 0;

    // Active Entities
    this.zombies = [];
    this.bullets = [];
    this.acidProjectiles = [];
    this.coins = []; // Floating gold pickups

    // Upgrade Dock UI Buttons (Sitting elevated above bottom overlay)
    this.upgradeButtons = [
      { id: 'dmg', label: 'DMG', key: 'Q', x: 12, y: 620, w: 76, h: 64 },
      { id: 'rate', label: 'RATE', key: 'W', x: 98, y: 620, w: 76, h: 64 },
      { id: 'guns', label: '+GUN', key: 'E', x: 184, y: 620, w: 76, h: 64 },
      { id: 'multi', label: 'MULTI', key: 'R', x: 270, y: 620, w: 76, h: 64 },
      { id: 'wall', label: 'WALL', key: 'T', x: 356, y: 620, w: 76, h: 64 },
    ];

    // Atmospheric Background Debris (Ruined Highway)
    this.scraps = Array.from({ length: 24 }, () => ({
      x: 20 + Math.random() * (this.W - 40),
      y: 90 + Math.random() * (this.wallY - 120),
      w: 8 + Math.random() * 18,
      h: 4 + Math.random() * 8,
      rot: (Math.random() - 0.5) * 1.5,
      type: Math.random() < 0.4 ? 'crater' : 'blood',
    }));

    // Restore saved progression if available
    if (saved) {
      this.wave = Number.isFinite(saved.wave) ? saved.wave : 1;
      this.gold = Number.isFinite(saved.gold) ? saved.gold : 0;
      this.damageLevel = Number.isFinite(saved.damageLevel) ? saved.damageLevel : 1;
      this.fireRateLevel = Number.isFinite(saved.fireRateLevel) ? saved.fireRateLevel : 1;
      this.gunCount = Number.isFinite(saved.gunCount) ? saved.gunCount : 1;
      this.multiShotLevel = Number.isFinite(saved.multiShotLevel) ? saved.multiShotLevel : 1;
      this.wallLevel = Number.isFinite(saved.wallLevel) ? saved.wallLevel : 1;
      this.maxWallHp = 200 + (this.wallLevel - 1) * 60;
      this.wallHp = Math.min(this.maxWallHp, Number.isFinite(saved.wallHp) ? saved.wallHp : this.maxWallHp);
      this.zombiesKilled = Number.isFinite(saved.zombiesKilled) ? saved.zombiesKilled : 0;
      this.grace = 1.5;
    }
  }

  serialize() {
    return {
      wave: this.wave,
      gold: this.gold,
      damageLevel: this.damageLevel,
      fireRateLevel: this.fireRateLevel,
      gunCount: this.gunCount,
      multiShotLevel: this.multiShotLevel,
      wallLevel: this.wallLevel,
      wallHp: this.wallHp,
      maxWallHp: this.maxWallHp,
      zombiesKilled: this.zombiesKilled,
      score: this.score,
    };
  }

  restoreLabel() {
    return `Wave ${this.wave} · 🪙 ${this.gold} · Guns: ${this.gunCount} · Dmg Lv.${this.damageLevel} · ${Math.round(this.score)} pts`;
  }

  /* ------------------------------------------------------------- Economy & Costs */
  getGunEmplacements() {
    const y = this.wallY + 8;
    return [
      { id: 0, x: this.W / 2, y, color: '#25e6ff', hat: 'crown', name: 'Captain' },
      { id: 1, x: 75, y, color: '#52b788', hat: 'none', name: 'Left Sentry' },
      { id: 2, x: this.W - 75, y, color: '#ff4d6d', hat: 'none', name: 'Right Sentry' },
      { id: 3, x: 145, y, color: '#ffd166', hat: 'none', name: 'Mid-Left Gun' },
      { id: 4, x: this.W - 145, y, color: '#7209b7', hat: 'none', name: 'Mid-Right Gun' },
    ];
  }

  getPriorityTarget(x, y, filterFlank = null) {
    if (this.zombies.length === 0) return null;
    let closestZ = null;
    let closestScore = Infinity;

    for (const z of this.zombies) {
      if (z.y < 140) continue; // In visible arena
      if (filterFlank === 'left' && z.x > this.W * 0.65) continue;
      if (filterFlank === 'right' && z.x < this.W * 0.35) continue;

      const dist = Math.hypot(z.x - x, z.y - y);
      const urgency = (z.kind === 'boomer') ? 140 : (z.kind === 'runner') ? 70 : 0;
      const threatScore = dist - (z.y * 0.8) - urgency;
      if (threatScore < closestScore) {
        closestScore = threatScore;
        closestZ = z;
      }
    }
    return closestZ;
  }

  getUpgradeCost(id) {
    if (id === 'dmg') return Math.floor(25 * Math.pow(1.38, this.damageLevel - 1));
    if (id === 'rate') return Math.floor(30 * Math.pow(1.40, this.fireRateLevel - 1));
    if (id === 'guns') return Math.floor(80 * Math.pow(2.10, this.gunCount - 1));
    if (id === 'multi') return Math.floor(90 * Math.pow(2.20, this.multiShotLevel - 1));
    if (id === 'wall') return Math.floor(40 * Math.pow(1.36, this.wallLevel - 1));
    return 999;
  }

  canUpgrade(id) {
    if (id === 'guns' && this.gunCount >= 5) return false;
    if (id === 'multi' && this.multiShotLevel >= 5) return false;
    return this.gold >= this.getUpgradeCost(id);
  }

  buyUpgrade(id) {
    if (!this.canUpgrade(id)) {
      this.sounds.tick();
      this.haptics.light();
      return;
    }

    const cost = this.getUpgradeCost(id);
    this.gold -= cost;

    if (id === 'dmg') {
      this.damageLevel++;
      this.fx.text(50, 600, `+DMG Lv.${this.damageLevel}`, '#ffd166', 18);
    } else if (id === 'rate') {
      this.fireRateLevel++;
      this.fx.text(136, 600, `+RATE Lv.${this.fireRateLevel}`, '#00f5d4', 18);
    } else if (id === 'guns') {
      this.gunCount++;
      this.fx.text(222, 600, `+GUN ${this.gunCount}/5!`, '#00f5d4', 20);
      const emplacements = this.getGunEmplacements();
      const newGun = emplacements[this.gunCount - 1];
      if (newGun) {
        this.fx.ring(newGun.x, newGun.y, newGun.color, 70, 0.5, 4);
        this.fx.burst(newGun.x, newGun.y, '#ffd166', 22, 180, 0.6, 4);
      }
    } else if (id === 'multi') {
      this.multiShotLevel++;
      this.fx.text(308, 600, `+BARREL Lv.${this.multiShotLevel}`, '#ff0054', 20);
      this.fx.ring(this.turretX, this.turretY, '#ff0054', 50, 0.4, 4);
    } else if (id === 'wall') {
      this.wallLevel++;
      this.maxWallHp += 60;
      this.wallHp = Math.min(this.maxWallHp, this.wallHp + this.maxWallHp * 0.4);
      this.fx.text(394, 600, `+REPAIR & ARMOR`, '#38b000', 18);
      this.fx.ring(this.W / 2, this.wallY, '#38b000', 90, 0.45, 4);
    }

    this.sounds.upgrade();
    this.haptics.medium();
  }

  /* ------------------------------------------------------------- Wave Director */
  startNextWave() {
    this.waveActive = true;
    this.waveTotalEnemies = Math.round((18 + Math.floor(this.wave * 7.5)) * (this.diff.waveSizeMult ?? 1));
    this.waveEnemiesLeft = this.waveTotalEnemies;
    this.waveSpawnTimer = 0.2;

    this.fx.text(this.W / 2, 220, `WAVE ${this.wave}`, '#ff0054', 28, 1.2);
    this.sounds.laser();
    this.haptics.heavy();
  }

  spawnZombie() {
    if (this.waveEnemiesLeft <= 0) return;
    this.waveEnemiesLeft--;

    const isBossWave = (this.wave % 5 === 0);
    const kinds = ['walker', 'walker', 'runner'];
    if (this.wave >= 2) kinds.push('boomer');
    if (this.wave >= 3) kinds.push('brute');
    if (this.wave >= 4) kinds.push('spitter');

    let kind = kinds[Math.floor(Math.random() * kinds.length)];

    // Spawn Boss Titan on final enemy of boss waves
    if (isBossWave && this.waveEnemiesLeft === 0) {
      kind = 'titan';
    }

    let hp = 44 + (this.wave - 1) * 12;
    let speed = 52 + Math.random() * 18;
    let size = 18;
    let col = '#40916c';
    let colLight = '#74c69d';
    let colDark = '#2d6a4f';
    let bellyCol = '#1b4332';
    let feetCol = '#1b4332';
    let bounty = 5;
    let walkSpeed = 1.4;
    let shieldHp = 0;
    let shieldBroken = true;

    if (kind === 'runner') {
      hp = 30 + (this.wave - 1) * 7;
      speed = 138 + Math.random() * 32; // Blazing fast sprinters!
      size = 16;
      col = '#ff4d6d';
      colLight = '#ff758f';
      colDark = '#c9184a';
      bellyCol = '#800f2f';
      feetCol = '#ffd166';
      bounty = 7;
      walkSpeed = 3.0;
    } else if (kind === 'brute') {
      hp = 125 + (this.wave - 1) * 32;
      speed = 26 + Math.random() * 8;
      size = 25;
      col = '#495057';
      colLight = '#6c757d';
      colDark = '#343a40';
      bellyCol = '#212529';
      feetCol = '#111827';
      bounty = 22;
      walkSpeed = 1.0;
      shieldHp = 130 + (this.wave - 1) * 35; // Heavy reinforced shield
      shieldBroken = false;
    } else if (kind === 'boomer') {
      hp = 60 + (this.wave - 1) * 15;
      speed = 58 + Math.random() * 14;
      size = 23;
      col = '#a7c957';
      colLight = '#d8f3dc';
      colDark = '#6a994e';
      bellyCol = '#386641';
      feetCol = '#386641';
      bounty = 16;
      walkSpeed = 1.3;
    } else if (kind === 'spitter') {
      hp = 52 + (this.wave - 1) * 12;
      speed = 46;
      size = 19;
      col = '#7209b7';
      colLight = '#b5179e';
      colDark = '#560bad';
      bellyCol = '#3a0ca3';
      feetCol = '#240046';
      bounty = 15;
      walkSpeed = 1.1;
    } else if (kind === 'titan') {
      hp = 700 + this.wave * 180;
      speed = 20;
      size = 40;
      col = '#9d0208';
      colLight = '#ff0054';
      colDark = '#6a040f';
      bellyCol = '#370617';
      feetCol = '#03071e';
      bounty = 80;
      walkSpeed = 0.85;
    }

    const hpScale = this.diff.zombieHpMult ?? 1;
    const spdScale = this.diff.zombieSpeedMult ?? 1;
    hp = Math.round(hp * hpScale);
    speed *= spdScale;
    if (shieldHp > 0) shieldHp = Math.round(shieldHp * hpScale);

    this.zombies.push({
      x: 35 + Math.random() * (this.W - 70),
      y: 75,
      hp,
      maxHp: hp,
      speed,
      size,
      kind,
      col,
      colLight,
      colDark,
      bellyCol,
      feetCol,
      bounty,
      walkT: Math.random() * 10,
      walkSpeed,
      wobble: Math.random() * TAU,
      attackCooldown: 0.5,
      spitTimer: 2.0 + Math.random() * 1.8,
      hitFlash: 0,
      shieldHp,
      maxShieldHp: shieldHp,
      shieldBroken,
      strafeDir: Math.random() < 0.5 ? -1 : 1,
    });
  }

  /* ------------------------------------------------------------- Update */
  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }

    this.time += dt;
    this.fx.update(dt);

    // Wave Spawner: Pack and cluster spawning for a true zombie horde
    if (this.waveActive) {
      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0 && this.waveEnemiesLeft > 0) {
        const packSize = Math.min(this.waveEnemiesLeft, (this.wave >= 2 && Math.random() < 0.6) ? (Math.random() < 0.4 ? 3 : 2) : 1);
        for (let p = 0; p < packSize; p++) {
          this.spawnZombie();
        }
        const baseInterval = Math.max(0.20, 0.48 - (this.wave * 0.03));
        this.waveSpawnTimer = baseInterval + Math.random() * 0.18;
      }

      // Check wave completion
      if (this.waveEnemiesLeft <= 0 && this.zombies.length === 0) {
        this.waveActive = false;
        this.waveBreakTimer = 3.0; // Intermission before next wave
        this.score += 250 * this.wave;
        this.gold += 20 + this.wave * 5;
        this.fx.text(this.W / 2, 240, `WAVE ${this.wave} CLEARED!`, '#ffd166', 24, 1.5);
        this.fx.burst(this.W / 2, 240, '#ffd166', 28, 200, 0.8, 4);
        this.sounds.survive();
        this.haptics.success();
      }
    } else {
      this.waveBreakTimer -= dt;
      if (this.waveBreakTimer <= 0) {
        this.wave++;
        this.startNextWave();
      }
    }

    // Process Player Controls & Aiming
    this.handleInput(dt);

    // Update Auxiliary Sentries (Guns 2 through 5)
    this.updateSentries(dt);

    // Update Projectiles & Casings
    this.updateBullets(dt);
    this.updateCasings(dt);
    this.updateAcid(dt);

    // Update Zombies & Wall Collisions
    this.updateZombies(dt);

    // Update Floating Coin Drops
    this.updateCoins(dt);

    // Acid pools decay on wall (Corrosive burn)
    for (let i = this.acidPools.length - 1; i >= 0; i--) {
      const p = this.acidPools[i];
      p.life -= dt;
      this.wallHp = Math.max(0, this.wallHp - 8.0 * dt);
      if (p.life <= 0) this.acidPools.splice(i, 1);
    }

    // Check Wall Breach / Defeat
    if (this.wallHp <= 0 && !this.dead) {
      this.die('The Fortress Wall Was Overrun!');
      this.fx.burst(this.turretX, this.wallY, '#ff0054', 48, 300, 1.2, 6);
      this.fx.shake(22, 0.7);
      this.sounds.fail();
      this.haptics.heavy();
    }
  }

  /* ------------------------------------------------------------- Controls & Turret Aim */
  handleInput(dt) {
    const inp = this.input;

    // Check Upgrade Button Taps
    if (inp.pressed) {
      for (const btn of this.upgradeButtons) {
        if (inp.x >= btn.x && inp.x <= btn.x + btn.w && inp.y >= btn.y && inp.y <= btn.y + btn.h) {
          this.buyUpgrade(btn.id);
          return;
        }
      }
    }

    // Keyboard Shortcuts for Upgrades (Q, W, E, R, T or 1, 2, 3, 4, 5)
    if ((inp.key('q') || inp.key('1')) && !this.prevQ) { this.buyUpgrade('dmg'); this.prevQ = true; }
    if ((inp.key('w') || inp.key('2')) && !this.prevW) { this.buyUpgrade('rate'); this.prevW = true; }
    if ((inp.key('e') || inp.key('3')) && !this.prevE) { this.buyUpgrade('guns'); this.prevE = true; }
    if ((inp.key('r') || inp.key('4')) && !this.prevR) { this.buyUpgrade('multi'); this.prevR = true; }
    if ((inp.key('t') || inp.key('5')) && !this.prevT) { this.buyUpgrade('wall'); this.prevT = true; }
    if (!inp.key('q') && !inp.key('1')) this.prevQ = false;
    if (!inp.key('w') && !inp.key('2')) this.prevW = false;
    if (!inp.key('e') && !inp.key('3')) this.prevE = false;
    if (!inp.key('r') && !inp.key('4')) this.prevR = false;
    if (!inp.key('t') && !inp.key('5')) this.prevT = false;

    // Turret Aiming & AUTO-AIM:
    // If player touches/drags inside field, manual aiming takes over immediately.
    // When idle, auto-aim automatically locks onto closest high-threat zombie!
    let isManualAim = false;
    if (inp.down && inp.y < 610) {
      const dx = inp.x - this.turretX;
      const dy = inp.y - this.turretY;
      this.aimAngle = Math.atan2(dy, dx);
      // Clamp angle so gun only aims upwards onto field
      this.aimAngle = clamp(this.aimAngle, -Math.PI + 0.15, -0.15);
      isManualAim = true;
      this.firing = true;
    } else if (inp.key(' ') || inp.key('ArrowUp')) {
      isManualAim = true;
      this.firing = true;
    } else {
      // AUTO-AIM MODE: Main Battery tracks and fires automatically
      const targetZ = this.getPriorityTarget(this.turretX, this.turretY);
      if (targetZ) {
        let desired = Math.atan2(targetZ.y - this.turretY, targetZ.x - this.turretX);
        desired = clamp(desired, -Math.PI + 0.15, -0.15);
        let diff = desired - this.aimAngle;
        while (diff < -Math.PI) diff += TAU;
        while (diff > Math.PI) diff -= TAU;
        this.aimAngle += clamp(diff, -10 * dt, 10 * dt);
        this.firing = true;
      } else {
        // Return smoothly towards neutral upward aim
        let diff = (-Math.PI / 2) - this.aimAngle;
        this.aimAngle += clamp(diff, -4 * dt, 4 * dt);
        this.firing = false;
      }
    }

    this.isManualAim = isManualAim;

    // Fire Machine Gun rounds
    this.fireCooldown -= dt;
    if (this.firing && this.fireCooldown <= 0) {
      this.shoot();
      const rps = 4.2 + (this.fireRateLevel - 1) * 0.75;
      this.fireCooldown = 1 / rps;
    }
  }

  updateSentries(dt) {
    if (this.gunCount <= 1) return;
    const emplacements = this.getGunEmplacements();

    for (let i = 1; i < this.gunCount; i++) {
      const g = emplacements[i];
      if (!g) continue;

      this.turretCooldowns[i] -= dt;
      if (this.turretRecoil[i] > 0) {
        this.turretRecoil[i] = Math.max(0, this.turretRecoil[i] - 12 * dt);
      }

      // Flank preference: sentry 1 prefers left, sentry 2 prefers right
      const flank = (i === 1) ? 'left' : (i === 2 ? 'right' : null);
      const target = this.getPriorityTarget(g.x, g.y, flank) || this.getPriorityTarget(g.x, g.y, null);

      if (target) {
        let desired = Math.atan2(target.y - g.y, target.x - g.x);
        desired = clamp(desired, -Math.PI + 0.18, -0.18);
        let diff = desired - this.turretAngles[i];
        while (diff < -Math.PI) diff += TAU;
        while (diff > Math.PI) diff -= TAU;
        this.turretAngles[i] += clamp(diff, -8 * dt, 8 * dt);

        if (this.turretCooldowns[i] <= 0) {
          this.shootSentry(i, g);
          const rps = 3.0 + (this.fireRateLevel - 1) * 0.5;
          this.turretCooldowns[i] = 1 / rps;
        }
      } else {
        // Return smoothly towards neutral upward aim
        let diff = (-Math.PI / 2) - this.turretAngles[i];
        this.turretAngles[i] += clamp(diff, -3 * dt, 3 * dt);
      }
    }
  }

  shootSentry(index, g) {
    const baseDamage = 13 + (this.damageLevel - 1) * 4.5;
    const bulletSpeed = 920;
    const a = this.turretAngles[index];
    const muzzleDist = 20;
    const bx = g.x + Math.cos(a) * muzzleDist;
    const by = g.y + Math.sin(a) * muzzleDist;

    this.bullets.push({
      x: bx,
      y: by,
      vx: Math.cos(a) * bulletSpeed,
      vy: Math.sin(a) * bulletSpeed,
      damage: baseDamage,
      crit: Math.random() < 0.15,
      col: g.color,
    });

    this.turretRecoil[index] = 4;
    this.sounds.tick();

    // Muzzle flash at sentry tip
    this.fx.burst(bx, by, g.color, 4, 80, 0.15, 2);
  }

  shoot() {
    const baseDamage = 16 + (this.damageLevel - 1) * 6;
    const bulletSpeed = 960;
    const barrels = this.multiShotLevel;

    // Calculate spread angles based on multi-shot tier
    const spreads = [];
    if (barrels === 1) spreads.push(0);
    else if (barrels === 2) spreads.push(-0.08, 0.08);
    else if (barrels === 3) spreads.push(-0.14, 0, 0.14);
    else if (barrels === 4) spreads.push(-0.20, -0.07, 0.07, 0.20);
    else spreads.push(-0.26, -0.13, 0, 0.13, 0.26);

    for (const spread of spreads) {
      const a = this.aimAngle + spread;
      const muzzleDist = 28;
      const bx = this.turretX + Math.cos(this.aimAngle) * muzzleDist;
      const by = this.turretY + Math.sin(this.aimAngle) * muzzleDist;

      this.bullets.push({
        x: bx,
        y: by,
        vx: Math.cos(a) * bulletSpeed,
        vy: Math.sin(a) * bulletSpeed,
        damage: baseDamage,
        crit: Math.random() < 0.18,
      });
    }

    // Recoil, muzzle sparks & shell casing
    this.recoil = 6;
    this.fx.shake(barrels >= 3 ? 3 : 1.5, 0.08);
    this.sounds.gunfire();
    this.haptics.light();

    // Eject glowing brass casing
    this.casings.push({
      x: this.turretX + (Math.random() - 0.5) * 14,
      y: this.turretY + 4,
      vx: (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80),
      vy: 40 + Math.random() * 50,
      rot: Math.random() * TAU,
      vrot: (Math.random() - 0.5) * 16,
      life: 1.8,
    });
  }

  /* ------------------------------------------------------------- Simulation Updates */
  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Off-screen cleanup
      if (b.y < -20 || b.x < -20 || b.x > this.W + 20) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check intercepting acid projectiles from Spitters (Skill shot!)
      let intercepted = false;
      for (let j = this.acidProjectiles.length - 1; j >= 0; j--) {
        const a = this.acidProjectiles[j];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 16) {
          this.fx.burst(a.x, a.y, '#7209b7', 10, 140, 0.4, 3);
          this.fx.text(a.x, a.y - 10, 'INTERCEPT!', '#00f5d4', 13, 0.45);
          this.sounds.tick();
          this.acidProjectiles.splice(j, 1);
          intercepted = true;
          break;
        }
      }
      if (intercepted) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check hit with zombies
      let hit = false;
      for (const z of this.zombies) {
        if (z.y < 140) continue; // Must be on visible highway arena
        const dist = Math.hypot(b.x - z.x, b.y - z.y);
        if (dist < z.size + 8) {
          let damageToDeal = b.crit ? b.damage * 2 : b.damage;

          // Brute Riot Shield Frontal Mitigation:
          if (z.kind === 'brute' && !z.shieldBroken) {
            if (!b.crit) {
              z.shieldHp -= damageToDeal;
              damageToDeal = Math.round(damageToDeal * 0.35); // 65% deflected by heavy riot shield!
              this.sounds.tick();
              this.fx.burst(b.x, b.y, '#ffd166', 4, 100, 0.2, 2);
              if (z.shieldHp <= 0) {
                z.shieldBroken = true;
                this.sounds.shatter();
                this.fx.burst(z.x, z.y, '#6c757d', 16, 200, 0.5, 4);
                this.fx.text(z.x, z.y - 18, 'SHIELD BROKEN!', '#ff0054', 15, 0.6);
              }
            } else {
              this.fx.text(z.x, z.y - 18, 'SHIELD PIERCED!', '#ffd166', 15, 0.5);
            }
          }

          z.hp -= damageToDeal;
          z.hitFlash = 0.12;

          // Damage pop text & blood burst
          if (b.crit) {
            this.fx.text(z.x, z.y - 12, `CRIT ${Math.round(damageToDeal)}`, '#ffd166', 16, 0.45);
          }
          this.fx.burst(b.x, b.y, z.col, 6, 120, 0.35, 2.5);

          hit = true;
          break;
        }
      }

      if (hit) {
        this.bullets.splice(i, 1);
      }
    }
  }

  updateZombies(dt) {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      z.wobble += dt * 5;
      z.walkT += dt * z.walkSpeed * 5;
      if (z.hitFlash > 0) z.hitFlash -= dt;

      // Zombie Death Check
      if (z.hp <= 0) {
        this.zombiesKilled++;
        this.score += z.bounty * 10;
        this.gold += z.bounty;

        // Death explosion for boomer zombie
        if (z.kind === 'boomer') {
          this.sounds.explosion();
          this.fx.burst(z.x, z.y, '#ff4d6d', 28, 240, 0.8, 5);
          this.fx.ring(z.x, z.y, '#ff4d6d', 75, 0.5, 4);
          this.fx.shake(12, 0.4);

          // Area of effect damage to neighboring zombies
          for (const other of this.zombies) {
            if (other === z) continue;
            const dist = Math.hypot(z.x - other.x, z.y - other.y);
            if (dist < 85) {
              other.hp -= 70;
              other.hitFlash = 0.15;
            }
          }
        } else {
          this.sounds.hit();
          this.fx.burst(z.x, z.y, z.col, 16, 160, 0.5, 3.5);
        }

        // Spawn flying Gold coins
        const coinCount = Math.min(4, Math.ceil(z.bounty / 4));
        for (let c = 0; c < coinCount; c++) {
          this.coins.push({
            x: z.x,
            y: z.y,
            vx: (Math.random() - 0.5) * 120,
            vy: -40 - Math.random() * 80,
            targetX: 65,
            targetY: 125,
            life: 1.0,
            t: 0,
          });
        }

        this.zombies.splice(i, 1);
        continue;
      }

      // Boomer Kamikaze Wall Detonation:
      // If Boomer reaches within touching distance of the wall, it detonate with massive burst damage!
      if (z.kind === 'boomer' && z.y >= this.wallY - z.size - 6) {
        this.sounds.explosion();
        this.fx.burst(z.x, this.wallY, '#ff0054', 42, 300, 1.0, 7);
        this.fx.ring(z.x, this.wallY, '#ff0054', 100, 0.65, 5);
        this.fx.shake(20, 0.6);
        this.wallHp = Math.max(0, this.wallHp - 55); // Severe 55 breach damage!
        this.acidPools.push({ x: z.x, y: this.wallY, life: 5.0 });
        this.fx.text(z.x, this.wallY - 32, 'BOOMER BLAST -55!', '#ff0054', 20, 0.9);
        this.haptics.heavy();
        this.zombies.splice(i, 1);
        continue;
      }

      // Spitter behavior: stops at mid-range and strafes laterally to shoot acid mortars
      if (z.kind === 'spitter' && z.y >= 240) {
        // Lateral strafe
        z.x += (z.strafeDir || 1) * 44 * dt;
        if (z.x < 50) { z.x = 50; z.strafeDir = 1; }
        if (z.x > this.W - 50) { z.x = this.W - 50; z.strafeDir = -1; }

        z.spitTimer -= dt;
        if (z.spitTimer <= 0) {
          z.spitTimer = Math.max(1.8, 2.6 - this.wave * 0.12);
          this.acidProjectiles.push({
            x: z.x,
            y: z.y + 12,
            vx: (this.turretX + (Math.random() - 0.5) * 180 - z.x) * 0.85,
            vy: 290,
          });
          this.sounds.drop();
          this.fx.burst(z.x, z.y + 12, '#b5179e', 8, 90, 0.35, 2.5);
        }
        continue;
      }

      // Marching towards the wall (Y = this.wallY)
      if (z.y < this.wallY - z.size) {
        // Slow down in barbed wire zone (wallY - 35 to wallY)
        const inBarbedWire = (z.y > this.wallY - 35);
        const curSpeed = inBarbedWire ? z.speed * 0.72 : z.speed;
        z.y += curSpeed * dt;

        // Runners zig-zag aggressively
        if (z.kind === 'runner') {
          z.x += Math.sin(z.wobble * 2.5) * 65 * dt;
        } else {
          z.x += Math.sin(z.wobble) * (curSpeed * 0.25) * dt;
        }
        z.x = clamp(z.x, 25, this.W - 25);
      } else {
        // Reached the Wall! Claw & damage barricade
        z.attackCooldown -= dt;
        if (z.attackCooldown <= 0) {
          const dmg = (z.kind === 'titan') ? 45 : (z.kind === 'brute') ? 28 : 11;
          this.wallHp = Math.max(0, this.wallHp - dmg);
          z.attackCooldown = 0.55;
          this.fx.shake(z.kind === 'titan' ? 9 : 4.5, 0.2);
          this.fx.burst(z.x, this.wallY, '#ffb703', 9, 150, 0.35, 3.2);
          this.sounds.hit();
          this.haptics.medium();
        }
      }
    }
  }

  updateAcid(dt) {
    for (let i = this.acidProjectiles.length - 1; i >= 0; i--) {
      const a = this.acidProjectiles[i];
      a.x += a.vx * dt;
      a.y += a.vy * dt;

      if (a.y >= this.wallY) {
        this.acidPools.push({ x: a.x, y: this.wallY, life: 3.5 });
        this.wallHp = Math.max(0, this.wallHp - 15);
        this.fx.burst(a.x, this.wallY, '#7209b7', 14, 150, 0.45, 3.5);
        this.fx.shake(5, 0.2);
        this.sounds.gulp();
        this.acidProjectiles.splice(i, 1);
      }
    }
  }

  updateCasings(dt) {
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vrot * dt;
      c.life -= dt;
      if (c.y > this.wallY + 30) {
        c.vy = 0;
        c.vx *= 0.85;
      }
      if (c.life <= 0) this.casings.splice(i, 1);
    }
  }

  updateCoins(dt) {
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.t += dt / c.life;
      if (c.t >= 1) {
        this.coins.splice(i, 1);
        continue;
      }
      const ease = Math.min(1, c.t * 1.5);
      c.x += (c.targetX - c.x) * (ease * 0.15);
      c.y += (c.targetY - c.y) * (ease * 0.15);
    }
  }

  /* ------------------------------------------------------------- Render Engine */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    // 1. Stylized Toy Diorama Highway Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.6, '#131c31');
    bg.addColorStop(1, '#0b1020');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Highway asphalt deck with soft top-down spotlight
    const roadGrad = ctx.createLinearGradient(20, 0, W - 20, 0);
    roadGrad.addColorStop(0, '#182034');
    roadGrad.addColorStop(0.5, '#202a42');
    roadGrad.addColorStop(1, '#182034');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(20, 0, W - 40, this.wallY);

    // Raised concrete toy side curbs
    drawToyBevelRect(ctx, 4, -4, 16, this.wallY + 8, 4, '#334155', {
      depth: 0,
      rimColor: '#0f172a',
      lineWidth: 1.2,
      gloss: false,
    });
    drawToyBevelRect(ctx, W - 20, -4, 16, this.wallY + 8, 4, '#334155', {
      depth: 0,
      rimColor: '#0f172a',
      lineWidth: 1.2,
      gloss: false,
    });

    // Broken highway rounded dashed lines
    ctx.fillStyle = 'rgba(248, 250, 252, 0.14)';
    for (let y = 12; y < this.wallY - 24; y += 44) {
      traceRoundRect(ctx, W / 2 - 72, y, 4, 20, 2);
      ctx.fill();
      traceRoundRect(ctx, W / 2 + 68, y, 4, 20, 2);
      ctx.fill();
    }

    // Craters and toy battle scuffs
    for (const s of this.scraps) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = s.type === 'blood' ? 'rgba(190, 18, 60, 0.28)' : 'rgba(12, 20, 42, 0.34)';
      ctx.beginPath();
      ctx.ellipse(0, 0, s.w, s.h, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // 2. Barbed Wire & Danger Zone ahead of wall
    ctx.fillStyle = 'rgba(244, 63, 94, 0.10)';
    ctx.fillRect(20, this.wallY - 30, W - 40, 30);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.4;
    for (let bx = 30; bx < W - 30; bx += 22) {
      ctx.beginPath();
      ctx.moveTo(bx, this.wallY - 25);
      ctx.lineTo(bx + 11, this.wallY - 5);
      ctx.lineTo(bx + 20, this.wallY - 25);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = 1.0;
    for (let bx = 30; bx < W - 30; bx += 22) {
      ctx.beginPath();
      ctx.moveTo(bx, this.wallY - 26);
      ctx.lineTo(bx + 11, this.wallY - 6);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Render Glossy Acid Pools
    for (const pool of this.acidPools) {
      ctx.save();
      ctx.globalAlpha = clamp(pool.life * 0.42, 0.15, 0.88);
      const pg = ctx.createRadialGradient(pool.x - 4, pool.y - 2, 2, pool.x, pool.y, 24);
      pg.addColorStop(0, '#e879f9');
      pg.addColorStop(0.5, '#9333ea');
      pg.addColorStop(1, '#581c87');
      ctx.fillStyle = pg;
      ctx.strokeStyle = '#3b0764';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(pool.x, pool.y, 24, 8.5, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.beginPath();
      ctx.ellipse(pool.x - 7, pool.y - 2.5, 6, 2, -0.1, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // 4. Render Acid Projectiles (3D glossy purple venom spheres)
    for (const a of this.acidProjectiles) {
      ctx.save();
      ctx.fillStyle = 'rgba(168, 85, 247, 0.28)';
      ctx.beginPath();
      ctx.arc(a.x, a.y, 11.5, 0, TAU);
      ctx.fill();
      ctx.restore();
      drawToySphere(ctx, a.x, a.y, 7.5, '#c084fc', {
        rimColor: '#581c87',
        lineWidth: 1.4,
        shine: 0.82,
      });
    }

    // 5. Render Zombies
    for (const z of this.zombies) {
      this.drawZombie(ctx, z);
    }

    // 6. Render Bullets (3D glowing tracer beads)
    ctx.save();
    for (const b of this.bullets) {
      const col = b.crit ? '#ffd166' : (b.col || '#38bdf8');
      const r = b.crit ? 4.2 : 3.1;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 2.1, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 1;
      drawToySphere(ctx, b.x, b.y, r, col, {
        rimColor: toyRim(col, 0.52),
        lineWidth: 0.8,
        shine: 0.88,
        bottomBounce: false,
      });
    }
    ctx.restore();

    // 7. Render Floating Gold Coins
    for (const c of this.coins) {
      drawToySphere(ctx, c.x, c.y, 5.2, '#ffd166', {
        rimColor: '#92400e',
        lineWidth: 1.0,
        shine: 0.78,
      });
    }

    // 8. Render Brass Shell Casings
    for (const c of this.casings) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      drawToyPill(ctx, -2, -4, 4, 8, '#facc15', {
        rimColor: '#92400e',
        lineWidth: 0.8,
        gloss: false,
      });
      ctx.restore();
    }

    // 9. Draw Fortified Wall
    this.drawWall(ctx, W);

    // 10. Draw Turret & Mascot Hero (Captain Jellybean)
    this.drawTurret(ctx);

    // 11. Render FX Layer
    this.fx.render(ctx, 1.0);

    // 12. Draw Top HUD (Wave, Gold, Kills)
    this.drawTopHUD(ctx, W);

    // 13. Draw Interactive Mid-Battle Upgrade Drawer
    this.drawUpgradeDrawer(ctx, W);
  }

  drawZombie(ctx, z) {
    ctx.save();
    ctx.translate(z.x, z.y);

    const size = z.size;
    const kind = z.kind;
    const walkT = z.walkT || 0;
    const hitFlash = (z.hitFlash > 0);

    // Dynamic running tilt or shambling tilt
    if (kind === 'runner') {
      ctx.rotate(Math.sin(walkT * 3) * 0.14);
    } else if (kind === 'walker') {
      ctx.rotate(Math.sin(walkT * 1.5) * 0.08);
    }

    // Proportions
    let wMult = 1.0;
    let hMult = 1.0;
    let squash = 1.0;

    if (kind === 'brute') {
      wMult = 1.35;
      hMult = 1.15;
    } else if (kind === 'boomer') {
      wMult = 1.42;
      hMult = 0.96;
      squash = 0.94 + Math.sin(this.time * 7 + z.x) * 0.06; // pulsing bloated chemical belly
    } else if (kind === 'runner') {
      wMult = 0.88;
      hMult = 1.05;
      squash = 0.94 + Math.sin(walkT * 12) * 0.08;
    } else if (kind === 'spitter') {
      wMult = 0.92;
      hMult = 1.15;
    } else if (kind === 'titan') {
      wMult = 1.45;
      hMult = 1.35;
    }

    const w = size * 0.88 * wMult;
    const h = size * 1.28 * hMult * squash;
    const radius = w * 0.52;
    const bodyH = h * 0.85;
    const topY = -bodyH * 0.5 + radius;
    const botY = bodyH * 0.5 - radius;
    const rim = hitFlash ? '#cbd5e1' : toyRim(z.col, 0.58);
    const lw = toyLineW(size * 2, 0.036, 0.9, 1.85);

    // 1. Soft Grounding Shadow
    drawToyShadow(ctx, 0, h * 0.54, w * 0.72, radius * 0.36, 0.34);

    // 2. Volumetric 3D Stubby Shuffling Zombie Feet
    const footR = radius * 0.38;
    const footY = h * 0.48;
    const legSwing = Math.sin(walkT * (kind === 'runner' ? 14 : 7)) * (radius * 0.45);
    const footBase = hitFlash ? '#ffffff' : (z.feetCol || '#1b4332');

    const drawFoot = (fx, fy, rot) => {
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(rot);
      const fg = ctx.createRadialGradient(-footR * 0.25, -footR * 0.25, 1, 0, 0, footR);
      fg.addColorStop(0, shadeColor(footBase, 0.3));
      fg.addColorStop(0.65, footBase);
      fg.addColorStop(1, shadeColor(footBase, -0.28));
      ctx.fillStyle = fg;
      ctx.strokeStyle = rim;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.ellipse(0, 0, footR, footR * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    drawFoot(-w * 0.32, footY + legSwing, -0.2);
    drawFoot(w * 0.32, footY - legSwing, 0.2);

    // 3. Soft Vinyl Outstretched Zombie Arms
    const armY = topY + radius * 0.75;
    const armLen = radius * 0.85;
    const armSwing = Math.sin(walkT * 6) * (radius * 0.2);
    const armBase = hitFlash ? '#ffffff' : (z.skinCol || z.col);

    const drawArm = (ax, ay, rot) => {
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(rot);
      const ag = ctx.createRadialGradient(-armLen * 0.15, -armLen * 0.3, 1, 0, 0, armLen);
      ag.addColorStop(0, shadeColor(armBase, 0.34));
      ag.addColorStop(0.55, armBase);
      ag.addColorStop(1, shadeColor(armBase, -0.28));
      ctx.fillStyle = ag;
      ctx.strokeStyle = rim;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.ellipse(0, 0, armLen * 0.48, armLen * 0.85, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    drawArm(-w * 0.56, armY + armSwing, -0.25);
    if (kind !== 'brute' || z.shieldBroken) {
      drawArm(w * 0.56, armY - armSwing, 0.25);
    }

    // 4. Volumetric 3D Vinyl Capsule Zombie Body
    ctx.save();
    const bg = ctx.createRadialGradient(
      -radius * 0.34,
      topY - radius * 0.22,
      Math.max(1, radius * 0.12),
      radius * 0.1,
      0,
      bodyH * 0.92,
    );
    if (hitFlash) {
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(1, '#e2e8f0');
    } else {
      bg.addColorStop(0, z.colLight || shadeColor(z.col, 0.48));
      bg.addColorStop(0.36, z.col);
      bg.addColorStop(0.82, mixColor(z.col, z.bellyCol || z.colDark || z.col, 0.48));
      bg.addColorStop(1, shadeColor(z.bellyCol || z.colDark || z.col, -0.28));
    }

    ctx.fillStyle = bg;
    ctx.strokeStyle = rim;
    ctx.lineWidth = lw;

    ctx.beginPath();
    ctx.arc(0, topY, radius, Math.PI, 0, false);
    ctx.arc(0, botY, radius, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Studio Vinyl Specular Forehead & Lower Bounce Highlight
    if (!hitFlash) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.50)';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.3, topY - radius * 0.34, radius * 0.36, radius * 0.16, -0.4, 0, TAU);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.20)';
      ctx.beginPath();
      ctx.ellipse(0, botY + radius * 0.24, radius * 0.5, radius * 0.22, 0, 0, TAU);
      ctx.fill();
    }

    // 6. Distinct 3D Vinyl Toy Archetype Features & Crisp Eyes
    this.drawZombieFeatures(ctx, z, {
      topY, botY, radius, w, h, hitFlash, size, rim, lw,
    });

    ctx.restore();

    // 7. Health Bar (Crisp 3D pill bar when damaged)
    if (z.hp < z.maxHp) {
      const barW = Math.max(28, w * 1.5);
      const barH = 5.5;
      const barY = -bodyH * 0.5 - 15;
      const hpRatio = clamp(z.hp / z.maxHp, 0, 1);
      const hpCol = (hpRatio > 0.45) ? '#22c55e' : (hpRatio > 0.2) ? '#f59e0b' : '#f43f5e';

      drawToyPill(ctx, -barW / 2, barY, barW, barH, '#0f172a', {
        rimColor: '#334155',
        lineWidth: 0.9,
        gloss: false,
      });
      if (barW * hpRatio >= 3) {
        drawToyPill(ctx, -barW / 2, barY, barW * hpRatio, barH, hpCol, {
          rimColor: toyRim(hpCol, 0.5),
          lineWidth: 0.6,
          gloss: true,
        });
      }
    }

    ctx.restore();
  }

  drawZombieFeatures(ctx, z, geo) {
    const { topY, botY, radius, w, hitFlash, rim, lw } = geo;
    const kind = z.kind;

    if (kind === 'walker') {
      // 1. Rotten Bean (Walker)
      if (!hitFlash) {
        ctx.fillStyle = 'rgba(27, 67, 50, 0.52)';
        ctx.beginPath();
        ctx.ellipse(-radius * 0.42, botY * 0.22, radius * 0.26, radius * 0.18, 0.3, 0, TAU);
        ctx.fill();
      }

      // Clean suture surgical stitches across forehead
      ctx.strokeStyle = rim;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.2, lw * 0.95);
      ctx.beginPath();
      ctx.moveTo(-radius * 0.4, topY - radius * 0.22);
      ctx.lineTo(radius * 0.3, topY - radius * 0.08);
      ctx.stroke();

      for (let sx = -radius * 0.3; sx <= radius * 0.2; sx += radius * 0.22) {
        ctx.beginPath();
        ctx.moveTo(sx, topY - radius * 0.3);
        ctx.lineTo(sx + 2, topY - radius * 0.03);
        ctx.stroke();
      }

      // Expressive Toy Eyes (clean white/ink catchlights, zero muddy black blobs)
      const eyeY = topY + radius * 0.34;
      drawToyEyes(ctx, 0, eyeY, Math.max(2.2, radius * 0.24), {
        spacing: radius * 0.72,
        style: 'bright',
        lookX: -0.15,
        lookY: 0.35,
        ink: '#0f172a',
      });

      // Quirky raised brow on left eye
      ctx.strokeStyle = rim;
      ctx.lineWidth = Math.max(1.3, radius * 0.13);
      ctx.beginPath();
      ctx.moveTo(-radius * 0.56, eyeY - radius * 0.36);
      ctx.lineTo(-radius * 0.16, eyeY - radius * 0.26);
      ctx.stroke();

      // Rounded open mouth pill with chipped tooth & mint drool bead
      drawToyPill(ctx, -radius * 0.3, botY * 0.42 - radius * 0.16, radius * 0.6, radius * 0.36, '#0f172a', {
        rimColor: rim,
        lineWidth: 1.0,
        gloss: false,
      });

      ctx.fillStyle = '#fef08a';
      traceRoundRect(ctx, -2, botY * 0.42 - radius * 0.13, 4.2, 4, 1.5);
      ctx.fill();

      if (!hitFlash) {
        drawToySphere(ctx, radius * 0.14, botY * 0.42 + radius * 0.26, 2.8, '#86efac', {
          rimColor: rim,
          lineWidth: 0.7,
          shine: 0.6,
          bottomBounce: false,
        });
      }
    } else if (kind === 'runner') {
      // 2. Infected Sprinter (Runner)
      const bandY = topY - radius * 0.08;
      // Trailing frayed ribbon ends flapping in the wind
      const ribSwing = Math.sin(this.time * 16) * 5.5;
      ctx.fillStyle = '#f97316';
      ctx.strokeStyle = toyRim('#f97316', 0.58);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.88, bandY + 2);
      ctx.lineTo(-radius * 1.35, bandY - 4 + ribSwing);
      ctx.lineTo(-radius * 1.25, bandY + 8 + ribSwing);
      ctx.lineTo(-radius * 0.88, bandY + radius * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 3D Beveled Athletic Headband
      drawToyPill(ctx, -radius * 0.92, bandY, radius * 1.84, radius * 0.34, '#ffd166', {
        rimColor: toyRim('#f59e0b', 0.58),
        lineWidth: 1.3,
        gloss: true,
      });

      // Fierce Runner Toy Eyes with glowing crimson rings + symmetric V-brows
      const eyeY = topY + radius * 0.42;
      const eyeSp = radius * 0.74;
      [-eyeSp * 0.5, eyeSp * 0.5].forEach((ex) => {
        ctx.fillStyle = 'rgba(255, 0, 84, 0.36)';
        ctx.beginPath();
        ctx.arc(ex, eyeY, radius * 0.33, 0, TAU);
        ctx.fill();
      });
      drawToyEyes(ctx, 0, eyeY, Math.max(2.1, radius * 0.23), {
        spacing: eyeSp,
        style: 'bright',
        lookX: 0,
        lookY: 0.42,
        ink: '#0f172a',
      });

      // Sharp symmetric angry brows
      ctx.strokeStyle = '#0f172a';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, radius * 0.16);
      ctx.beginPath();
      ctx.moveTo(-radius * 0.62, eyeY - radius * 0.38);
      ctx.lineTo(-radius * 0.16, eyeY - radius * 0.18);
      ctx.moveTo(radius * 0.62, eyeY - radius * 0.38);
      ctx.lineTo(radius * 0.16, eyeY - radius * 0.18);
      ctx.stroke();

      // Snarling mouth pill
      drawToyPill(ctx, -radius * 0.34, botY * 0.36, radius * 0.68, radius * 0.28, '#4c0519', {
        rimColor: rim,
        lineWidth: 1.0,
        gloss: false,
      });
    } else if (kind === 'brute') {
      // 3. Ironclad Juggernaut (Brute)
      const helmY = topY - radius * 0.35;
      const hg = ctx.createRadialGradient(-radius * 0.35, topY - radius * 0.5, 2, 0, topY, radius * 1.15);
      hg.addColorStop(0, '#94a3b8');
      hg.addColorStop(0.5, '#475569');
      hg.addColorStop(1, '#1e293b');
      ctx.fillStyle = hg;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = lw;

      ctx.beginPath();
      ctx.arc(0, topY, radius * 1.08, Math.PI, 0);
      ctx.lineTo(radius * 1.08, helmY + radius * 0.95);
      ctx.lineTo(-radius * 1.08, helmY + radius * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Metallic helmet top sheen
      ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.3, topY - radius * 0.56, radius * 0.42, radius * 0.16, -0.35, 0, TAU);
      ctx.fill();

      // Steel 3D Rivets
      for (let rx = -radius * 0.78; rx <= radius * 0.78; rx += radius * 0.39) {
        drawToySphere(ctx, rx, helmY + radius * 0.85, 2.2, '#cbd5e1', {
          rimColor: '#1e293b',
          lineWidth: 0.8,
          bottomBounce: false,
        });
      }

      // Glowing Red Visor Slit Pill
      drawToyPill(ctx, -radius * 0.65, helmY + radius * 0.42, radius * 1.3, 5, '#ff0054', {
        rimColor: '#4c0519',
        lineWidth: 1.0,
        gloss: true,
      });

      // Heavy 3D Beveled Ballistic Riot Shield (Strapped to right arm)
      if (!z.shieldBroken) {
        const shX = w * 0.55;
        const shY = botY * 0.15;
        const shW = radius * 1.12;
        const shH = radius * 1.82;

        ctx.save();
        ctx.translate(shX, shY);

        drawToyBevelRect(ctx, -shW / 2, -shH / 2, shW, shH, 6.5, '#334155', {
          depth: 4,
          rimColor: '#0f172a',
          lineWidth: 1.5,
          gloss: true,
        });

        // Yellow & Slate Hazard Stripe Band
        drawToyBevelRect(ctx, -shW / 2 + 2.5, -4.5, shW - 5, 9, 2.5, '#ffd166', {
          depth: 0,
          rimColor: '#92400e',
          lineWidth: 0.9,
          gloss: false,
        });
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(-shW / 2 + 6, -4); ctx.lineTo(-shW / 2 + 12, 4); ctx.lineTo(-shW / 2 + 8, 4); ctx.lineTo(-shW / 2 + 3, -1);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -4); ctx.lineTo(6, 4); ctx.lineTo(2, 4); ctx.lineTo(-4, -4);
        ctx.fill();

        // Glossy steel center boss
        drawToySphere(ctx, 0, 0, 4.2, '#cbd5e1', { rimColor: '#1e293b', lineWidth: 1.0 });

        ctx.restore();
      }
    } else if (kind === 'boomer') {
      // 4. Toxic Biohazard (Boomer)
      const boils = [
        { x: -radius * 0.5, y: topY - radius * 0.25, r: radius * 0.38 },
        { x: radius * 0.45, y: topY - radius * 0.15, r: radius * 0.30 },
        { x: radius * 0.65, y: botY * 0.2, r: radius * 0.34 },
      ];

      for (let i = 0; i < boils.length; i++) {
        const b = boils[i];
        const pulse = 1 + Math.sin(this.time * 8 + i * 2) * 0.14;
        drawToySphere(ctx, b.x, b.y, b.r * pulse, '#bef264', {
          rimColor: toyRim('#65a30d', 0.55),
          lineWidth: 1.2,
          shine: 0.85,
        });
      }

      // 3D Biohazard Strap
      ctx.save();
      ctx.strokeStyle = toyRim('#eab308', 0.58);
      ctx.fillStyle = '#ffd166';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.85, topY + radius * 0.5);
      ctx.lineTo(radius * 0.85, botY * 0.35);
      ctx.lineTo(radius * 0.85, botY * 0.35 + 8);
      ctx.lineTo(-radius * 0.85, topY + radius * 0.5 + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Expressive Wide Toy Eyes
      const eyeY = topY + radius * 0.4;
      drawToyEyes(ctx, 0, eyeY, Math.max(2.5, radius * 0.27), {
        spacing: radius * 0.72,
        style: 'bright',
        lookX: 0.32,
        lookY: -0.15,
        ink: '#0f172a',
      });

      // Gaping chemical mouth + foam spheres
      drawToyPill(ctx, -radius * 0.38, botY * 0.42, radius * 0.76, radius * 0.42, '#14532d', {
        rimColor: rim,
        lineWidth: 1.2,
        gloss: false,
      });
      drawToySphere(ctx, -4, botY * 0.55, 2.8, '#d9f99d', { rimColor: '#3f6212', lineWidth: 0.7 });
      drawToySphere(ctx, 3.5, botY * 0.56, 3.4, '#d9f99d', { rimColor: '#3f6212', lineWidth: 0.7 });
    } else if (kind === 'spitter') {
      // 5. Grave Spitter
      const hoodY = topY - radius * 0.35;
      const cg = ctx.createRadialGradient(-radius * 0.3, topY - radius * 0.3, 2, 0, topY, radius * 1.2);
      cg.addColorStop(0, '#7e22ce');
      cg.addColorStop(0.55, '#4c1d95');
      cg.addColorStop(1, '#2e1065');
      ctx.fillStyle = cg;
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = lw;

      ctx.beginPath();
      ctx.arc(0, topY, radius * 1.12, Math.PI, 0);
      ctx.lineTo(radius * 1.15, hoodY + radius * 1.1);
      ctx.lineTo(radius * 0.6, hoodY + radius * 0.85);
      ctx.lineTo(0, hoodY + radius * 0.95);
      ctx.lineTo(-radius * 0.6, hoodY + radius * 0.85);
      ctx.lineTo(-radius * 1.15, hoodY + radius * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Deep cowl shadow face
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(0, topY + radius * 0.4, radius * 0.72, radius * 0.45, 0, 0, TAU);
      ctx.fill();

      // Piercing toxic cyan toy eyes
      const eyeY = topY + radius * 0.38;
      [-radius * 0.32, radius * 0.32].forEach((ex) => {
        ctx.fillStyle = 'rgba(0, 245, 212, 0.32)';
        ctx.beginPath();
        ctx.arc(ex, eyeY, radius * 0.28, 0, TAU);
        ctx.fill();
      });
      drawToyEyes(ctx, 0, eyeY, Math.max(2.1, radius * 0.21), {
        spacing: radius * 0.64,
        style: 'bright',
        lookX: 0,
        lookY: 0.3,
        ink: '#0d9488',
      });

      // Pulsing 3D venom throat sac orb
      const sacPulse = 1 + Math.sin(this.time * 6) * 0.14;
      const sacR = radius * 0.38 * sacPulse;
      drawToySphere(ctx, 0, botY * 0.46, sacR, '#e879f9', {
        rimColor: '#581c87',
        lineWidth: 1.2,
        shine: 0.75,
      });
    } else if (kind === 'titan') {
      // 6. Colossal Titan Boss
      // Sculpted 3D Golden Crown
      const cy = topY - radius * 0.85;
      const cg = ctx.createLinearGradient(-radius * 0.6, cy - 24, radius * 0.6, cy + 8);
      cg.addColorStop(0, '#fff3b0');
      cg.addColorStop(0.5, '#ffd166');
      cg.addColorStop(1, '#d97706');
      ctx.fillStyle = cg;
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = Math.max(1.5, lw);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.6, cy + 8);
      ctx.lineTo(-radius * 0.6, cy - 18);
      ctx.lineTo(-radius * 0.25, cy - 6);
      ctx.lineTo(0, cy - 24);
      ctx.lineTo(radius * 0.25, cy - 6);
      ctx.lineTo(radius * 0.6, cy - 18);
      ctx.lineTo(radius * 0.6, cy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glossy Ruby Gems on Crown
      drawToySphere(ctx, 0, cy - 8, 3.8, '#ff0054', { rimColor: '#881337', lineWidth: 0.9 });
      drawToySphere(ctx, -radius * 0.35, cy + 1, 3.2, '#ff0054', { rimColor: '#881337', lineWidth: 0.9 });
      drawToySphere(ctx, radius * 0.35, cy + 1, 3.2, '#ff0054', { rimColor: '#881337', lineWidth: 0.9 });

      // Twin Fierce Titan Eyes + crimson aura
      const eyeY = topY + radius * 0.36;
      [-radius * 0.36, radius * 0.36].forEach((ex) => {
        ctx.fillStyle = 'rgba(255, 0, 84, 0.35)';
        ctx.beginPath();
        ctx.arc(ex, eyeY, radius * 0.32, 0, TAU);
        ctx.fill();
      });
      drawToyEyes(ctx, 0, eyeY, Math.max(3.2, radius * 0.22), {
        spacing: radius * 0.72,
        style: 'bright',
        lookX: 0,
        lookY: 0.38,
        ink: '#0f172a',
      });
      // Fierce symmetric Titan V-brows
      ctx.strokeStyle = '#0f172a';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2.0, radius * 0.14);
      ctx.beginPath();
      ctx.moveTo(-radius * 0.64, eyeY - radius * 0.34);
      ctx.lineTo(-radius * 0.16, eyeY - radius * 0.14);
      ctx.moveTo(radius * 0.64, eyeY - radius * 0.34);
      ctx.lineTo(radius * 0.16, eyeY - radius * 0.14);
      ctx.stroke();

      // Glowing Magma Lava Fissure in Chest
      const lavaPulse = 0.8 + Math.sin(this.time * 5) * 0.2;
      const lg = ctx.createRadialGradient(0, botY * 0.34, 2, 0, botY * 0.34, radius * 0.4);
      lg.addColorStop(0, `rgba(254, 240, 138, ${lavaPulse})`);
      lg.addColorStop(0.55, `rgba(249, 115, 22, ${lavaPulse})`);
      lg.addColorStop(1, `rgba(225, 29, 72, ${lavaPulse})`);
      ctx.fillStyle = lg;
      ctx.strokeStyle = '#4c0519';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.3, botY * 0.3);
      ctx.lineTo(0, botY * 0.1);
      ctx.lineTo(radius * 0.3, botY * 0.3);
      ctx.lineTo(radius * 0.1, botY * 0.6);
      ctx.lineTo(-radius * 0.1, botY * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  drawWall(ctx, W) {
    const y = this.wallY;

    // 3D Extruded Toy Fortress Wall Foundation
    drawToyBevelRect(ctx, 0, y, W, 42, 4, '#334155', {
      depth: 5,
      rimColor: '#0f172a',
      lineWidth: 1.6,
      gloss: true,
    });

    // Steel 3D beveled battlements along parapet
    for (let x = 10; x < W - 20; x += 44) {
      drawToyBevelRect(ctx, x, y - 6, 34, 14, 5, '#475569', {
        depth: 3,
        rimColor: '#0f172a',
        lineWidth: 1.3,
        gloss: true,
      });
    }

    // Wall Health Bar on top (3D glossy pill meter)
    const barW = W - 80;
    const barH = 10;
    const barX = 40;
    const barY = y - 19;
    const hpRatio = clamp(this.wallHp / this.maxWallHp, 0, 1);
    const hpCol = hpRatio > 0.45 ? '#22c55e' : hpRatio > 0.2 ? '#f59e0b' : '#f43f5e';

    drawToyPill(ctx, barX, barY, barW, barH, '#0f172a', {
      rimColor: '#334155',
      lineWidth: 1.4,
      gloss: false,
    });

    if (barW * hpRatio >= 6) {
      drawToyPill(ctx, barX, barY, barW * hpRatio, barH, hpCol, {
        rimColor: toyRim(hpCol, 0.5),
        lineWidth: 1.0,
        gloss: true,
      });
    }

    // Wall Label & HP numbers
    ctx.save();
    ctx.font = "700 10.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.0;
    const wallLabel = `FORTRESS WALL: ${Math.ceil(this.wallHp)} / ${this.maxWallHp} HP`;
    ctx.strokeText(wallLabel, W / 2, barY - 10);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(wallLabel, W / 2, barY - 10);
    ctx.restore();
  }

  drawTurret(ctx) {
    const emplacements = this.getGunEmplacements();
    // Render all active guns: Main battery (0) + auxiliary sentries (1 .. gunCount - 1)
    for (let i = 0; i < this.gunCount; i++) {
      const g = emplacements[i];
      if (!g) continue;
      this.drawSingleTurret(ctx, i, g);
    }
  }

  drawSingleTurret(ctx, index, g) {
    const isMain = (index === 0);
    const tx = g.x;
    const ty = g.y;
    const a = isMain ? this.aimAngle : this.turretAngles[index];
    const recoil = isMain ? this.recoil : this.turretRecoil[index];

    ctx.save();
    ctx.translate(tx, ty);

    // Tactical Laser Sight Guide on Main Turret when manually aiming
    if (isMain && this.isManualAim) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 440, Math.sin(a) * 440);
      ctx.stroke();
      ctx.setLineDash([]);

      const rx = Math.cos(a) * 220;
      const ry = Math.sin(a) * 220;
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.7)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(rx, ry, 7, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Grounding Shadow & 3D Swivel Turret Base
    const baseRadius = isMain ? 22 : 16;
    drawToyShadow(ctx, 0, 10, baseRadius + 4, baseRadius * 0.48, 0.3);
    drawToySphere(ctx, 0, 0, baseRadius, '#334155', {
      rimColor: g.color,
      lineWidth: isMain ? 2.4 : 1.8,
      shine: 0.45,
    });

    // Rotating 3D gun barrels towards aim
    ctx.save();
    ctx.rotate(a);
    const recoilOffset = (recoil > 0) ? -recoil : 0;

    const drawBarrel = (bx, by, bw, bh, tipCol) => {
      const bg = ctx.createLinearGradient(0, by, 0, by + bh);
      bg.addColorStop(0, '#94a3b8');
      bg.addColorStop(0.4, '#475569');
      bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.1;
      traceRoundRect(ctx, bx, by, bw, bh, bh * 0.42);
      ctx.fill();
      ctx.stroke();

      // Glossy colored muzzle tip
      drawToyPill(ctx, bx + bw - 6.5, by, 7, bh, tipCol, {
        rimColor: toyRim(tipCol, 0.52),
        lineWidth: 0.9,
        gloss: true,
      });
    };

    if (isMain) {
      if (this.multiShotLevel === 1) {
        drawBarrel(recoilOffset, -4, 30, 8, '#4cc9f0');
      } else if (this.multiShotLevel === 2) {
        drawBarrel(recoilOffset, -9, 30, 6, '#4cc9f0');
        drawBarrel(recoilOffset, 3, 30, 6, '#4cc9f0');
      } else {
        drawBarrel(recoilOffset, -11, 28, 5, '#4cc9f0');
        drawBarrel(recoilOffset, -2.5, 32, 5, '#ff0054');
        drawBarrel(recoilOffset, 6, 28, 5, '#4cc9f0');
      }
    } else {
      // Compact dual sentry barrel for auxiliary guns
      drawBarrel(recoilOffset, -6, 22, 4.5, g.color);
      drawBarrel(recoilOffset, 1.5, 22, 4.5, g.color);
    }
    ctx.restore();

    // Crew Bean manning the turret
    const beanSize = isMain ? 26 : 19;
    const beanY = isMain ? 8 : 6;
    drawBean(ctx, 0, beanY, beanSize, {
      ufo: false,
      color: g.color,
      bellyColor: '#ffd166',
      walkT: this.time * 2,
      squash: (recoil > 0) ? 0.88 : 1,
      dir: (Math.cos(a) < 0) ? -1 : 1,
      eyes: isMain ? 'happy' : 'bright',
      hat: g.hat || 'none',
    });

    ctx.restore();
    if (isMain && this.recoil > 0) this.recoil -= 0.8;
  }

  drawTopHUD(ctx, W) {
    ctx.save();

    // Wave Badge (Top Left) — 3D Beveled Toy Card
    drawToyBevelRect(ctx, 14, 106, 120, 34, 11, '#0f172a', {
      depth: 3,
      rimColor: '#334155',
      lineWidth: 1.8,
      gloss: false,
    });

    ctx.font = "700 13.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.6;
    ctx.strokeText(`WAVE ${this.wave}`, 74, 123);
    ctx.fillStyle = '#ff4d6d';
    ctx.fillText(`WAVE ${this.wave}`, 74, 123);

    // Gold Counter Badge (Top Right) — 3D Beveled Toy Card
    drawToyBevelRect(ctx, W - 120, 106, 106, 34, 11, '#0f172a', {
      depth: 3,
      rimColor: '#334155',
      lineWidth: 1.8,
      gloss: false,
    });

    ctx.font = "700 14px 'Fredoka', 'Outfit', sans-serif";
    ctx.strokeText(`🪙 ${this.gold}`, W - 67, 123);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`🪙 ${this.gold}`, W - 67, 123);

    // Wave Progress Pill Meter (under badges)
    if (this.waveActive && this.waveTotalEnemies > 0) {
      const remaining = this.zombies.length + this.waveEnemiesLeft;
      const progress = clamp(1 - (remaining / this.waveTotalEnemies), 0, 1);
      drawToyPill(ctx, W / 2 - 80, 148, 160, 6, '#0f172a', {
        rimColor: '#334155',
        lineWidth: 1.0,
        gloss: false,
      });
      if (160 * progress >= 5) {
        drawToyPill(ctx, W / 2 - 80, 148, 160 * progress, 6, '#00f5d4', {
          rimColor: '#0d9488',
          lineWidth: 0.7,
          gloss: true,
        });
      }
    } else if (!this.waveActive) {
      ctx.font = "700 11.5px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.8;
      const msg = `NEXT WAVE IN ${Math.max(0, Math.ceil(this.waveBreakTimer))}s...`;
      ctx.strokeText(msg, W / 2, 151);
      ctx.fillStyle = '#ffd166';
      ctx.fillText(msg, W / 2, 151);
    }

    ctx.restore();
  }

  drawUpgradeDrawer(ctx, W) {
    ctx.save();

    // Bottom 3D Upgrade Dock Panel
    const dg = ctx.createLinearGradient(0, 610, 0, 694);
    dg.addColorStop(0, '#162033');
    dg.addColorStop(1, '#0b101d');
    ctx.fillStyle = dg;
    ctx.fillRect(0, 610, W, 84);

    // Top studio rim highlight line
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(0, 610, W, 1.5);

    // Render the 5 Tactile 3D Beveled Upgrade Buttons
    for (const btn of this.upgradeButtons) {
      const canAfford = this.canUpgrade(btn.id);
      const cost = this.getUpgradeCost(btn.id);
      const isMax = (btn.id === 'guns' && this.gunCount >= 5) || (btn.id === 'multi' && this.multiShotLevel >= 5);

      let lvlStr = '';
      if (btn.id === 'dmg') lvlStr = `Lv.${this.damageLevel}`;
      else if (btn.id === 'rate') lvlStr = `Lv.${this.fireRateLevel}`;
      else if (btn.id === 'guns') lvlStr = (this.gunCount >= 5) ? 'MAX' : `${this.gunCount}/5 GUNS`;
      else if (btn.id === 'multi') lvlStr = (this.multiShotLevel >= 5) ? 'MAX' : `Lv.${this.multiShotLevel}`;
      else if (btn.id === 'wall') lvlStr = `Lv.${this.wallLevel}`;

      drawToyBevelRect(ctx, btn.x, btn.y, btn.w, btn.h - 2, 11, canAfford ? '#253549' : '#131a29', {
        depth: canAfford ? 3.5 : 1.5,
        rimColor: canAfford ? '#00f5d4' : '#334155',
        lineWidth: canAfford ? 1.9 : 1.1,
        gloss: canAfford,
      });

      // Label & Level
      ctx.fillStyle = canAfford ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = "700 12px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + 8);

      ctx.fillStyle = '#38bdf8';
      ctx.font = "700 10px 'Fredoka', 'Outfit', sans-serif";
      ctx.fillText(lvlStr, btn.x + btn.w / 2, btn.y + 24);

      // Cost in Gold
      ctx.fillStyle = canAfford ? '#ffd166' : 'rgba(255, 209, 102, 0.42)';
      ctx.font = "700 11px 'Fredoka', 'Outfit', sans-serif";
      ctx.fillText(isMax ? 'MAXED' : `🪙 ${cost}`, btn.x + btn.w / 2, btn.y + 42);
    }

    ctx.restore();
  }

  rr(ctx, x, y, w, h, r) {
    traceRoundRect(ctx, x, y, w, h, r);
  }
}
