import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export class ZombieFortress extends Game {
  static meta = {
    id: 'zombie-fortress',
    title: 'Zombie Fortress',
    icon: '🧟',
    hint: 'DRAG to aim & unleash heavy fire · SPEND gold live on Upgrades · DEFEND the wall!',
    baseLikes: 3420,
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
      this.wave = saved.wave || 1;
      this.gold = saved.gold || 0;
      this.damageLevel = saved.damageLevel || 1;
      this.fireRateLevel = saved.fireRateLevel || 1;
      this.gunCount = saved.gunCount || 1;
      this.multiShotLevel = saved.multiShotLevel || 1;
      this.wallLevel = saved.wallLevel || 1;
      this.maxWallHp = 200 + (this.wallLevel - 1) * 60;
      this.wallHp = Math.min(this.maxWallHp, saved.wallHp || this.maxWallHp);
      this.zombiesKilled = saved.zombiesKilled || 0;
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
    this.waveTotalEnemies = 18 + Math.floor(this.wave * 7.5);
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

    // 1. Dark Post-Apocalyptic Highway Background
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, W, H);

    // Highway asphalt lanes
    ctx.fillStyle = '#141a29';
    ctx.fillRect(20, 0, W - 40, this.wallY);

    // Broken highway dashed lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 24]);
    ctx.beginPath();
    ctx.moveTo(W / 2 - 70, 0); ctx.lineTo(W / 2 - 70, this.wallY);
    ctx.moveTo(W / 2 + 70, 0); ctx.lineTo(W / 2 + 70, this.wallY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Craters and blood stains
    for (const s of this.scraps) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = s.type === 'blood' ? 'rgba(157, 2, 8, 0.35)' : 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, s.w, s.h, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // 2. Barbed Wire & Danger Zone ahead of wall (Y = 590 to 620)
    ctx.fillStyle = 'rgba(255, 0, 84, 0.08)';
    ctx.fillRect(20, this.wallY - 30, W - 40, 30);
    ctx.strokeStyle = '#6c757d';
    ctx.lineWidth = 1.5;
    for (let bx = 30; bx < W - 30; bx += 22) {
      ctx.beginPath();
      ctx.moveTo(bx, this.wallY - 26);
      ctx.lineTo(bx + 12, this.wallY - 4);
      ctx.lineTo(bx + 20, this.wallY - 26);
      ctx.stroke();
    }

    // 3. Render Acid Pools
    for (const pool of this.acidPools) {
      ctx.fillStyle = `rgba(114, 9, 183, ${Math.min(0.8, pool.life * 0.35)})`;
      ctx.beginPath();
      ctx.ellipse(pool.x, pool.y, 24, 8, 0, 0, TAU);
      ctx.fill();
    }

    // 4. Render Acid Projectiles
    for (const a of this.acidProjectiles) {
      ctx.fillStyle = '#7209b7';
      ctx.shadowColor = '#7209b7';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 7, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 5. Render Zombies
    for (const z of this.zombies) {
      this.drawZombie(ctx, z);
    }

    // 6. Render Bullets
    ctx.save();
    for (const b of this.bullets) {
      const col = b.crit ? '#ffd166' : (b.col || '#ffffff');
      const glow = b.crit ? '#ffb703' : (b.col || '#00f5d4');
      ctx.fillStyle = col;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.crit ? 3.5 : 2.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // 7. Render Floating Gold Coins
    for (const c of this.coins) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, TAU);
      ctx.fill();
    }

    // 8. Render Brass Shell Casings
    for (const c of this.casings) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(-2, -4, 4, 8);
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

    // 1. Soft Floor Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.54, w * 0.72, radius * 0.38, 0, 0, TAU);
    ctx.fill();

    // 2. Cartoon Stubby Shuffling Zombie Feet
    const footR = radius * 0.38;
    const footY = h * 0.48;
    const legSwing = Math.sin(walkT * (kind === 'runner' ? 14 : 7)) * (radius * 0.45);

    ctx.fillStyle = hitFlash ? '#ffffff' : (z.feetCol || '#1b4332');
    ctx.strokeStyle = '#051820';
    ctx.lineWidth = 2;

    // Left Foot
    ctx.beginPath();
    ctx.ellipse(-w * 0.32, footY + legSwing, footR, footR * 0.7, -0.2, 0, TAU);
    ctx.fill(); ctx.stroke();
    // Right Foot
    ctx.beginPath();
    ctx.ellipse(w * 0.32, footY - legSwing, footR, footR * 0.7, 0.2, 0, TAU);
    ctx.fill(); ctx.stroke();

    // 3. Floppy Outstretched Zombie Arms
    const armY = topY + radius * 0.75;
    const armLen = radius * 0.85;
    const armSwing = Math.sin(walkT * 6) * (radius * 0.2);

    ctx.fillStyle = hitFlash ? '#ffffff' : (z.skinCol || z.col);
    ctx.strokeStyle = '#051820';
    ctx.lineWidth = 2;

    // Left Arm (reaching forward toward fortress)
    ctx.beginPath();
    ctx.ellipse(-w * 0.56, armY + armSwing, armLen * 0.48, armLen * 0.85, -0.25, 0, TAU);
    ctx.fill(); ctx.stroke();

    // Right Arm (if not holding riot shield)
    if (kind !== 'brute' || z.shieldBroken) {
      ctx.beginPath();
      ctx.ellipse(w * 0.56, armY - armSwing, armLen * 0.48, armLen * 0.85, 0.25, 0, TAU);
      ctx.fill(); ctx.stroke();
    }

    // 4. Rounded Pill Capsule Zombie Body
    ctx.save();
    const bg = ctx.createLinearGradient(-w * 0.5, -bodyH * 0.5, w * 0.5, bodyH * 0.5);
    if (hitFlash) {
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(1, '#ffffff');
    } else {
      bg.addColorStop(0, z.colLight || '#74c69d');
      bg.addColorStop(0.35, z.col);
      bg.addColorStop(0.85, z.colDark || '#2d6a4f');
      bg.addColorStop(1, z.bellyCol || '#1b4332');
    }

    ctx.fillStyle = bg;
    ctx.strokeStyle = '#051820';
    ctx.lineWidth = Math.max(2, size * 0.08);

    ctx.beginPath();
    ctx.arc(0, topY, radius, Math.PI, 0, false);
    ctx.arc(0, botY, radius, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Bloons 3D Specular Highlight on Head & Belly
    if (!hitFlash) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.32, topY - radius * 0.28, radius * 0.36, radius * 0.18, -0.45, 0, TAU);
      ctx.fill();

      // Specular shine dot
      ctx.beginPath();
      ctx.arc(-radius * 0.52, topY - radius * 0.04, radius * 0.09, 0, TAU);
      ctx.fill();

      // Belly shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.ellipse(0, botY * 0.35, radius * 0.5, radius * 0.38, 0, 0, TAU);
      ctx.fill();
    }

    // 6. Distinct Professional Archetype Features & Accessories
    this.drawZombieFeatures(ctx, z, {
      topY, botY, radius, w, h, hitFlash, size
    });

    ctx.restore();

    // 7. Health Bar (only shown if damaged)
    if (z.hp < z.maxHp) {
      const barW = Math.max(28, w * 1.5);
      const barH = 5;
      const barY = -bodyH * 0.5 - 14;
      ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
      this.rr(ctx, -barW / 2, barY, barW, barH, 2.5);
      ctx.fill();

      const hpRatio = clamp(z.hp / z.maxHp, 0, 1);
      ctx.fillStyle = (hpRatio > 0.45) ? '#38b000' : (hpRatio > 0.2) ? '#ffb703' : '#ff0054';
      this.rr(ctx, -barW / 2, barY, barW * hpRatio, barH, 2.5);
      ctx.fill();
    }

    ctx.restore();
  }

  drawZombieFeatures(ctx, z, geo) {
    const { topY, botY, radius, w, hitFlash } = geo;
    const kind = z.kind;

    if (kind === 'walker') {
      // 1. Rotten Bean (Walker)
      // Decay mould patch on cheek
      if (!hitFlash) {
        ctx.fillStyle = '#1b4332';
        ctx.beginPath();
        ctx.ellipse(-radius * 0.42, botY * 0.22, radius * 0.28, radius * 0.2, 0.3, 0, TAU);
        ctx.fill();
      }

      // Suture surgical stitches across skull
      ctx.strokeStyle = '#051820';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.4, topY - radius * 0.2);
      ctx.lineTo(radius * 0.3, topY - radius * 0.05);
      ctx.stroke();

      for (let sx = -radius * 0.3; sx <= radius * 0.2; sx += radius * 0.22) {
        ctx.beginPath();
        ctx.moveTo(sx, topY - radius * 0.3);
        ctx.lineTo(sx + 2, topY - radius * 0.0);
        ctx.stroke();
      }

      // Mismatched zombie eyes
      const eyeY = topY + radius * 0.35;
      // Left eye: Big bulging sickly yellow eye
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#051820';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-radius * 0.36, eyeY, radius * 0.28, radius * 0.36, 0, 0, TAU);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#061a24';
      ctx.beginPath();
      ctx.arc(-radius * 0.34, eyeY + 1, radius * 0.14, 0, TAU);
      ctx.fill();

      // Right eye: Sunken dead milky eye with bruised ring
      ctx.fillStyle = '#2d6a4f';
      ctx.beginPath();
      ctx.ellipse(radius * 0.36, eyeY, radius * 0.22, radius * 0.26, 0, 0, TAU);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(radius * 0.36, eyeY, radius * 0.1, 0, TAU);
      ctx.fill();

      // Open drooling mouth with a chipped yellow tooth
      ctx.fillStyle = '#081c15';
      ctx.strokeStyle = '#051820';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, botY * 0.45, radius * 0.32, radius * 0.22, 0, 0, TAU);
      ctx.fill(); ctx.stroke();

      // Chipped tooth
      ctx.fillStyle = '#ffeaa7';
      ctx.fillRect(-2, botY * 0.45 - 5, 4, 4);

      // Drool drip
      if (!hitFlash) {
        ctx.fillStyle = '#74c69d';
        ctx.beginPath();
        ctx.ellipse(radius * 0.12, botY * 0.45 + radius * 0.25, 2.5, 4.5, 0, 0, TAU);
        ctx.fill();
      }
    } else if (kind === 'runner') {
      // 2. Infected Sprinter (Runner)
      // Tattered Neon Athletic Headband
      const bandY = topY - radius * 0.05;
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#3d2600';
      ctx.lineWidth = 2;
      ctx.fillRect(-radius * 0.88, bandY, radius * 1.76, radius * 0.34);
      ctx.strokeRect(-radius * 0.88, bandY, radius * 1.76, radius * 0.34);

      // Trailing frayed ribbon ends flapping in the wind
      const ribSwing = Math.sin(this.time * 16) * 6;
      ctx.fillStyle = '#e76f51';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.88, bandY + 2);
      ctx.lineTo(-radius * 1.35, bandY - 4 + ribSwing);
      ctx.lineTo(-radius * 1.25, bandY + 8 + ribSwing);
      ctx.lineTo(-radius * 0.88, bandY + radius * 0.32);
      ctx.closePath();
      ctx.fill();

      // Enraged Glowing Red Eyes
      const eyeY = topY + radius * 0.42;
      const eyeSpacing = radius * 0.38;

      [-eyeSpacing, eyeSpacing].forEach((ex, idx) => {
        ctx.fillStyle = '#ff0054';
        ctx.shadowColor = '#ff0054';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, radius * 0.24, radius * 0.32, (idx === 0 ? 0.15 : -0.15), 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#10002b';
        ctx.beginPath();
        ctx.arc(ex + (idx === 0 ? 1 : -1), eyeY, radius * 0.1, 0, TAU);
        ctx.fill();
      });

      // Sharp angry eyebrows
      ctx.strokeStyle = '#051820';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.65, eyeY - radius * 0.38);
      ctx.lineTo(-radius * 0.15, eyeY - radius * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(radius * 0.65, eyeY - radius * 0.38);
      ctx.lineTo(radius * 0.15, eyeY - radius * 0.15);
      ctx.stroke();

      // Snarling jagged mouth
      ctx.fillStyle = '#370617';
      ctx.beginPath();
      ctx.ellipse(0, botY * 0.42, radius * 0.35, radius * 0.18, 0, 0, TAU);
      ctx.fill();
    } else if (kind === 'brute') {
      // 3. Ironclad Juggernaut (Brute)
      // Steel Military / Welder Helmet
      const helmY = topY - radius * 0.35;
      ctx.fillStyle = '#343a40';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.arc(0, topY, radius * 1.08, Math.PI, 0);
      ctx.lineTo(radius * 1.08, helmY + radius * 0.95);
      ctx.lineTo(-radius * 1.08, helmY + radius * 0.95);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Steel Rivets
      ctx.fillStyle = '#adb5bd';
      for (let rx = -radius * 0.8; rx <= radius * 0.8; rx += radius * 0.4) {
        ctx.beginPath();
        ctx.arc(rx, helmY + radius * 0.85, 2.2, 0, TAU);
        ctx.fill();
      }

      // Red Glowing Visor Slit
      ctx.fillStyle = '#ff0054';
      ctx.shadowColor = '#ff0054';
      ctx.shadowBlur = 8;
      ctx.fillRect(-radius * 0.65, helmY + radius * 0.45, radius * 1.3, 4);
      ctx.shadowBlur = 0;

      // Heavy Ballistic Riot Shield (Strapped to right arm)
      if (!z.shieldBroken) {
        const shX = w * 0.55;
        const shY = botY * 0.15;
        const shW = radius * 1.1;
        const shH = radius * 1.8;

        ctx.save();
        ctx.translate(shX, shY);

        // Shield plate
        ctx.fillStyle = '#212529';
        ctx.strokeStyle = '#adb5bd';
        ctx.lineWidth = 2.5;
        this.rr(ctx, -shW / 2, -shH / 2, shW, shH, 6);
        ctx.fill(); ctx.stroke();

        // Yellow & Black Hazard Stripes
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-shW / 2 + 3, -4, shW - 6, 8);
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.moveTo(-shW / 2 + 5, -4); ctx.lineTo(-shW / 2 + 13, 4); ctx.lineTo(-shW / 2 + 8, 4); ctx.lineTo(-shW / 2 + 3, -1);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -4); ctx.lineTo(8, 4); ctx.lineTo(3, 4); ctx.lineTo(-5, -4);
        ctx.fill();

        // Spiked steel boss
        ctx.fillStyle = '#adb5bd';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, TAU);
        ctx.fill();

        ctx.restore();
      }
    } else if (kind === 'boomer') {
      // 4. Toxic Biohazard (Boomer)
      // Pulsing Glowing Chemical Pustules / Boils
      const boils = [
        { x: -radius * 0.5, y: topY - radius * 0.25, r: radius * 0.4 },
        { x: radius * 0.45, y: topY - radius * 0.15, r: radius * 0.32 },
        { x: radius * 0.65, y: botY * 0.2, r: radius * 0.36 },
      ];

      for (let i = 0; i < boils.length; i++) {
        const b = boils[i];
        const pulse = 1 + Math.sin(this.time * 8 + i * 2) * 0.14;
        const curR = b.r * pulse;

        const bg = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, curR);
        bg.addColorStop(0, '#ffffff');
        bg.addColorStop(0.3, '#d8f3dc');
        bg.addColorStop(0.7, '#74c69d');
        bg.addColorStop(1, '#2d6a4f');

        ctx.fillStyle = bg;
        ctx.strokeStyle = '#051820';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, curR, 0, TAU);
        ctx.fill(); ctx.stroke();
      }

      // Yellow Biohazard Strap
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#051820';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.85, topY + radius * 0.5);
      ctx.lineTo(radius * 0.85, botY * 0.35);
      ctx.lineTo(radius * 0.85, botY * 0.35 + 8);
      ctx.lineTo(-radius * 0.85, topY + radius * 0.5 + 8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Bulging crazy yellow eyes
      const eyeY = topY + radius * 0.4;
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#051820';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-radius * 0.35, eyeY, radius * 0.3, radius * 0.36, -0.1, 0, TAU);
      ctx.ellipse(radius * 0.35, eyeY, radius * 0.34, radius * 0.38, 0.15, 0, TAU);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#051820';
      ctx.beginPath();
      ctx.arc(-radius * 0.32, eyeY, 3, 0, TAU);
      ctx.arc(radius * 0.38, eyeY - 2, 3.5, 0, TAU);
      ctx.fill();

      // Gaping drooling chemical mouth
      ctx.fillStyle = '#1b4332';
      ctx.beginPath();
      ctx.ellipse(0, botY * 0.5, radius * 0.4, radius * 0.28, 0, 0, TAU);
      ctx.fill(); ctx.stroke();
      // Acid foam
      ctx.fillStyle = '#b7e4c7';
      ctx.beginPath();
      ctx.arc(-4, botY * 0.5 + 4, 3, 0, TAU);
      ctx.arc(3, botY * 0.5 + 5, 4, 0, TAU);
      ctx.fill();
    } else if (kind === 'spitter') {
      // 5. Grave Spitter
      // Tattered Dark Sorcerer Cowl / Hood
      const hoodY = topY - radius * 0.35;
      ctx.fillStyle = '#240046';
      ctx.strokeStyle = '#051820';
      ctx.lineWidth = 2.2;

      ctx.beginPath();
      ctx.arc(0, topY, radius * 1.12, Math.PI, 0);
      ctx.lineTo(radius * 1.15, hoodY + radius * 1.1);
      ctx.lineTo(radius * 0.6, hoodY + radius * 0.85);
      ctx.lineTo(0, hoodY + radius * 0.95);
      ctx.lineTo(-radius * 0.6, hoodY + radius * 0.85);
      ctx.lineTo(-radius * 1.15, hoodY + radius * 1.1);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Shadow face underneath hood
      ctx.fillStyle = '#10002b';
      ctx.beginPath();
      ctx.ellipse(0, topY + radius * 0.4, radius * 0.72, radius * 0.45, 0, 0, TAU);
      ctx.fill();

      // Piercing glowing toxic green eyes
      const eyeY = topY + radius * 0.38;
      ctx.fillStyle = '#00f5d4';
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(-radius * 0.32, eyeY, radius * 0.16, radius * 0.28, -0.2, 0, TAU);
      ctx.ellipse(radius * 0.32, eyeY, radius * 0.16, radius * 0.28, 0.2, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Pulsing venom throat sac
      const sacPulse = 1 + Math.sin(this.time * 6) * 0.15;
      const sacR = radius * 0.42 * sacPulse;
      const sacGrad = ctx.createRadialGradient(0, botY * 0.45, 2, 0, botY * 0.45, sacR);
      sacGrad.addColorStop(0, '#f72585');
      sacGrad.addColorStop(0.5, '#7209b7');
      sacGrad.addColorStop(1, 'rgba(58, 12, 163, 0.4)');

      ctx.fillStyle = sacGrad;
      ctx.beginPath();
      ctx.arc(0, botY * 0.45, sacR, 0, TAU);
      ctx.fill();
    } else if (kind === 'titan') {
      // 6. Colossal Titan Boss
      // Cracked Golden Skull Crown
      const cy = topY - radius * 0.85;
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#5a3d00';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.6, cy + 8);
      ctx.lineTo(-radius * 0.6, cy - 18);
      ctx.lineTo(-radius * 0.25, cy - 6);
      ctx.lineTo(0, cy - 24);
      ctx.lineTo(radius * 0.25, cy - 6);
      ctx.lineTo(radius * 0.6, cy - 18);
      ctx.lineTo(radius * 0.6, cy + 8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Blood Rubies on Crown
      ctx.fillStyle = '#d90429';
      ctx.beginPath();
      ctx.arc(0, cy - 8, 3.5, 0, TAU);
      ctx.arc(-radius * 0.35, cy + 2, 3, 0, TAU);
      ctx.arc(radius * 0.35, cy + 2, 3, 0, TAU);
      ctx.fill();

      // Twin Demonic Glowing Red Eyes
      const eyeY = topY + radius * 0.36;
      ctx.fillStyle = '#ff0054';
      ctx.shadowColor = '#ff0054';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(-radius * 0.36, eyeY, radius * 0.2, 0, TAU);
      ctx.arc(radius * 0.36, eyeY, radius * 0.2, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Glowing Magma Lava Fissure in Chest
      const lavaPulse = 0.8 + Math.sin(this.time * 5) * 0.2;
      ctx.fillStyle = `rgba(255, 183, 3, ${lavaPulse})`;
      ctx.shadowColor = '#ff0054';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.3, botY * 0.3);
      ctx.lineTo(0, botY * 0.1);
      ctx.lineTo(radius * 0.3, botY * 0.3);
      ctx.lineTo(radius * 0.1, botY * 0.6);
      ctx.lineTo(-radius * 0.1, botY * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  drawWall(ctx, W) {
    const y = this.wallY;

    // Concrete Wall Foundation
    ctx.fillStyle = '#1e2433';
    ctx.fillRect(0, y, W, 40);

    // Steel battlements & reinforced plating
    ctx.fillStyle = '#2c3549';
    for (let x = 10; x < W - 20; x += 44) {
      ctx.fillRect(x, y - 4, 34, 12);
    }

    // Wall Health Bar on top
    const barW = W - 80;
    const barH = 8;
    const barX = 40;
    const barY = y - 16;
    const hpRatio = clamp(this.wallHp / this.maxWallHp, 0, 1);

    ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
    this.rr(ctx, barX, barY, barW, barH, 4);
    ctx.fill();

    ctx.fillStyle = hpRatio > 0.45 ? '#38b000' : hpRatio > 0.2 ? '#ffb703' : '#ff0054';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = hpRatio < 0.25 ? 8 : 0;
    this.rr(ctx, barX, barY, barW * hpRatio, barH, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Wall Label & HP numbers
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '800 10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`FORTRESS WALL: ${Math.ceil(this.wallHp)} / ${this.maxWallHp} HP`, W / 2, barY - 8);
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
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 440, Math.sin(a) * 440);
      ctx.stroke();
      ctx.setLineDash([]);

      const rx = Math.cos(a) * 220;
      const ry = Math.sin(a) * 220;
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rx, ry, 7, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Turret Base / Heavy Swivel Mount
    const baseRadius = isMain ? 22 : 16;
    ctx.fillStyle = '#111726';
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = g.color;
    ctx.lineWidth = isMain ? 2.5 : 1.8;
    ctx.stroke();

    // Rotating gun barrels towards aim
    ctx.save();
    ctx.rotate(a);
    const recoilOffset = (recoil > 0) ? -recoil : 0;
    ctx.fillStyle = '#2b2d42';

    if (isMain) {
      if (this.multiShotLevel === 1) {
        ctx.fillRect(recoilOffset, -4, 30, 8);
        ctx.fillStyle = '#4cc9f0';
        ctx.fillRect(recoilOffset + 24, -3, 6, 6);
      } else if (this.multiShotLevel === 2) {
        ctx.fillRect(recoilOffset, -9, 30, 6);
        ctx.fillRect(recoilOffset, 3, 30, 6);
        ctx.fillStyle = '#4cc9f0';
        ctx.fillRect(recoilOffset + 24, -9, 6, 6);
        ctx.fillRect(recoilOffset + 24, 3, 6, 6);
      } else {
        ctx.fillRect(recoilOffset, -11, 28, 5);
        ctx.fillRect(recoilOffset, -2.5, 32, 5);
        ctx.fillRect(recoilOffset, 6, 28, 5);
        ctx.fillStyle = '#ff0054';
        ctx.fillRect(recoilOffset + 24, -2.5, 8, 5);
      }
    } else {
      // Compact dual sentry barrel for auxiliary guns
      ctx.fillRect(recoilOffset, -6, 22, 4);
      ctx.fillRect(recoilOffset, 2, 22, 4);
      ctx.fillStyle = g.color;
      ctx.fillRect(recoilOffset + 18, -6, 4, 4);
      ctx.fillRect(recoilOffset + 18, 2, 4, 4);
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
      eyes: isMain ? 'happy' : 'focused',
      hat: g.hat || 'none',
    });

    ctx.restore();
    if (isMain && this.recoil > 0) this.recoil -= 0.8;
  }

  drawTopHUD(ctx, W) {
    ctx.save();

    // Wave Badge (Top Left)
    ctx.fillStyle = 'rgba(12, 16, 32, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    this.rr(ctx, 14, 106, 120, 34, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff0054';
    ctx.font = '900 13px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`WAVE ${this.wave}`, 74, 123);

    // Gold Counter Badge (Top Right)
    ctx.fillStyle = 'rgba(12, 16, 32, 0.9)';
    this.rr(ctx, W - 120, 106, 106, 34, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffd166';
    ctx.font = '900 14px Outfit, sans-serif';
    ctx.fillText(`🪙 ${this.gold}`, W - 67, 123);

    // Wave Progress Bar (under badges)
    if (this.waveActive && this.waveTotalEnemies > 0) {
      const remaining = this.zombies.length + this.waveEnemiesLeft;
      const progress = 1 - (remaining / this.waveTotalEnemies);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(W / 2 - 80, 148, 160, 4);
      ctx.fillStyle = '#00f5d4';
      ctx.fillRect(W / 2 - 80, 148, 160 * progress, 4);
    } else if (!this.waveActive) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '900 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`NEXT WAVE IN ${Math.max(0, Math.ceil(this.waveBreakTimer))}s...`, W / 2, 150);
    }

    ctx.restore();
  }

  drawUpgradeDrawer(ctx, W) {
    ctx.save();

    // Bottom Upgrade Dock Panel
    ctx.fillStyle = 'rgba(11, 15, 26, 0.95)';
    ctx.fillRect(0, 610, W, 84);

    // Divider Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 610); ctx.lineTo(W, 610);
    ctx.stroke();

    // Render the 5 Upgrade Buttons
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

      // Button Chassis
      ctx.fillStyle = canAfford ? '#1b2838' : '#10141e';
      this.rr(ctx, btn.x, btn.y, btn.w, btn.h, 10);
      ctx.fill();

      // Border: Pulsing neon green if affordable
      if (canAfford) {
        ctx.strokeStyle = '#00f5d4';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00f5d4';
        ctx.shadowBlur = 6;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Label & Level
      ctx.fillStyle = canAfford ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = '900 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + 8);

      ctx.fillStyle = '#4cc9f0';
      ctx.font = '800 10px Outfit, sans-serif';
      ctx.fillText(lvlStr, btn.x + btn.w / 2, btn.y + 24);

      // Cost in Gold
      ctx.fillStyle = canAfford ? '#ffd166' : 'rgba(255, 209, 102, 0.4)';
      ctx.font = '900 11px Outfit, sans-serif';
      ctx.fillText(isMax ? 'MAXED' : `🪙 ${cost}`, btn.x + btn.w / 2, btn.y + 44);
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
