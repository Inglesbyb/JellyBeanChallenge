import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import {
  STYLE_TOKENS,
  preloadWeeblAtlas,
  drawSprite,
  drawComicPanel,
  drawComicText as _rawDrawComicText,
  drawComicStarburst,
  drawWeeblCelBean,
  drawWeeblEyeCluster,
  drawStoneCrackOverlay,
  drawHeroCharacter,
} from './weeblAtlas.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/* ------------------------------------------------------------ 2x PNG Bitmap Comic Text Cache (60 FPS) */
const TEXT_STAMP_CACHE = new Map();
const TEXT_STAMP_MAX = 200;
let _measureCtx = null;

function drawComicText(ctx, text, x, y, font, fill = '#ffffff', opts = {}) {
  const canCache =
    typeof ctx.drawImage === 'function' &&
    typeof document !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof Image !== 'undefined';

  if (!canCache) {
    _rawDrawComicText(ctx, text, x, y, font, fill, opts);
    return;
  }

  const stroke = opts.stroke || '#000000';
  const strokeW = opts.strokeWidth ?? 4.2;
  const shadow = opts.shadow ? 1 : 0;
  const sdx = opts.shadowDx ?? 2;
  const sdy = opts.shadowDy ?? 2.5;
  const key = `${text}|${font}|${fill}|${stroke}|${strokeW}|${shadow}`;

  let stamp = TEXT_STAMP_CACHE.get(key);
  if (!stamp) {
    if (TEXT_STAMP_CACHE.size >= TEXT_STAMP_MAX) {
      const oldestKey = TEXT_STAMP_CACHE.keys().next().value;
      TEXT_STAMP_CACHE.delete(oldestKey);
    }

    if (!_measureCtx) {
      const mc = document.createElement('canvas');
      mc.width = 16;
      mc.height = 16;
      _measureCtx = mc.getContext('2d');
    }
    _measureCtx.font = font;
    const metrics = _measureCtx.measureText(String(text));
    const fontMatch = /(\d+(?:\.\d+)?)px/.exec(font);
    const fontPx = fontMatch ? parseFloat(fontMatch[1]) : 16;

    const padX = Math.ceil(strokeW + 6);
    const padY = Math.ceil(strokeW + 6);
    const logicalW = Math.max(8, Math.ceil(metrics.width) + padX * 2 + (shadow ? Math.abs(sdx) : 0));
    const logicalH = Math.max(8, Math.ceil(fontPx * 1.45) + padY * 2 + (shadow ? Math.abs(sdy) : 0));
    const scale = 2;

    const off = document.createElement('canvas');
    off.width = logicalW * scale;
    off.height = logicalH * scale;
    const octx = off.getContext('2d');
    octx.scale(scale, scale);

    _rawDrawComicText(octx, text, logicalW * 0.5, logicalH * 0.5, font, fill, {
      ...opts,
      align: 'center',
      baseline: 'middle',
    });

    const img = new Image();
    img.src = off.toDataURL('image/png');
    stamp = { img, canvas: off, w: logicalW, h: logicalH };
    TEXT_STAMP_CACHE.set(key, stamp);
  }

  const align = opts.align || 'center';
  const baseline = opts.baseline || 'middle';
  let dx = x - stamp.w * 0.5;
  if (align === 'left' || align === 'start') dx = x - 6;
  else if (align === 'right' || align === 'end') dx = x - stamp.w + 6;

  let dy = y - stamp.h * 0.5;
  if (baseline === 'top') dy = y - 4;
  else if (baseline === 'bottom') dy = y - stamp.h + 4;

  const drawable = stamp.img.complete && stamp.img.naturalWidth > 0 ? stamp.img : stamp.canvas;
  ctx.drawImage(drawable, dx, dy, stamp.w, stamp.h);
}

/* ------------------------------------------------------------ Helper: Crisp Cel Gold Coin Icon */
function drawGoldCoinBadge(ctx, cx, cy, r = 7, lineW = 2.0) {
  ctx.save();
  ctx.fillStyle = '#eab308';
  ctx.strokeStyle = STYLE_TOKENS.ink;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(cx - r * 0.14, cy - r * 0.14, r * 0.65, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.28, cy - r * 0.28, r * 0.24, r * 0.14, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

const FONT_HUD_SM = "900 10.5px 'Fredoka', 'Outfit', sans-serif";
const FONT_HUD_MD = "900 13.5px 'Fredoka', 'Outfit', sans-serif";
const FONT_HUD_LG = "900 15px 'Fredoka', 'Outfit', sans-serif";
const FONT_DOCK_TITLE = "900 14.5px 'Fredoka', 'Outfit', sans-serif";
const FONT_DOCK_SUB = "900 10.5px 'Fredoka', 'Outfit', sans-serif";
const FONT_DOCK_COST = "900 14.5px 'Fredoka', 'Outfit', sans-serif";

export class ZombieFortress extends Game {
  static meta = {
    id: 'zombie-fortress',
    title: 'Zombie Fortress',
    icon: '🧟',
    hint: 'DRAG to aim & unleash heavy fire · SPEND gold live on Upgrades · DEFEND the wall!',
    baseLikes: 3420,
    isPrestige: false,
    parScore60s: 2600,
    cue: 'DEFEND THE WALL!',
    prestigeCue: 'TOUGHER HORDE · FASTER ZOMBIES!',
    scaling: {
      zombieHpMult:    { base: 1.0, rate: 0.16, cap: 1.85, mode: 'up', label: 'Zombie HP' },
      zombieSpeedMult: { base: 1.0, rate: 0.15, cap: 1.40, mode: 'up', label: 'Zombie Speed' },
      waveSizeMult:    { base: 1.0, rate: 0.15, cap: 1.50, mode: 'up', label: 'Horde Size' },
    },
  };

  init(saved, score = 0) {
    preloadWeeblAtlas();
    this.fx = new FX();
    this.score = score;

    // Upgrades & Economy
    this.gold = 25;
    this.damageLevel = 1;
    this.fireRateLevel = 1;
    this.gunCount = 1; // 1 to 5 guns on fortress wall
    this.multiShotLevel = 1;
    this.wallLevel = 1;

    // Fortress & Wall Stats (Stretched courtyard: Wall sits at Y = 636, Command Deck at 682..800)
    this.wallY = 636;
    this.deckY = this.wallY + 46; // 682
    this.maxWallHp = 200;
    this.wallHp = 200;
    this.wallHitFlash = 0;

    // Turret & Player Batteries (barrels pivot at wallY - 4)
    this.turretX = this.W / 2;
    this.turretY = this.wallY - 4;
    this.aimAngle = -Math.PI / 2;
    this.fireCooldown = 0;
    this.firing = false;
    this.recoil = 0;
    this.muzzleFlash = 0;

    // Multi-turret angles, recoil & flash tracking
    this.turretAngles = [-Math.PI / 2, -Math.PI / 2, -Math.PI / 2, -Math.PI / 2, -Math.PI / 2];
    this.turretRecoil = [0, 0, 0, 0, 0];
    this.turretCooldowns = [0, 0, 0, 0, 0];
    this.turretFlash = [0, 0, 0, 0, 0];

    // Spitting acid pools & casings
    this.acidPools = [];
    this.casings = [];

    // Wave Progression
    this.wave = 1;
    this.waveEnemiesLeft = 0;
    this.waveTotalEnemies = 0;
    this.waveSpawnTimer = 0;
    this.waveBreakTimer = 1.5;
    this.waveActive = false;
    this.zombiesKilled = 0;
    this.killStreak = 0;
    this.streakTimer = 0;

    // Active Entities
    this.zombies = [];
    this.bullets = [];
    this.acidProjectiles = [];
    this.coins = [];

    // Pointer tracking for tactical aim reticle
    this.pointerX = this.W / 2;
    this.pointerY = 300;
    this.isManualAim = false;

    // Upgrade Dock UI Buttons (5 symmetric 82x84 cards inside deckY=682..800)
    const btnW = 82;
    const btnGap = 6;
    const btnStartX = 8;
    const btnHitY = this.deckY + 10; // 692 (covers lifted tab + full card + shadow)
    const btnHitH = 98;
    const btnDrawY = this.deckY + 20; // 702
    const btnDrawH = 84;
    this.upgradeButtons = [
      { id: 'dmg',   label: 'DMG',   key: 'Q', x: btnStartX + (btnW + btnGap) * 0, y: btnHitY, w: btnW, h: btnHitH, drawY: btnDrawY, drawH: btnDrawH, flash: 0, fill: '#f59e0b', fillActive: '#d97706' },
      { id: 'rate',  label: 'RATE',  key: 'W', x: btnStartX + (btnW + btnGap) * 1, y: btnHitY, w: btnW, h: btnHitH, drawY: btnDrawY, drawH: btnDrawH, flash: 0, fill: '#06b6d4', fillActive: '#0891b2' },
      { id: 'guns',  label: '+GUN',  key: 'E', x: btnStartX + (btnW + btnGap) * 2, y: btnHitY, w: btnW, h: btnHitH, drawY: btnDrawY, drawH: btnDrawH, flash: 0, fill: '#22c55e', fillActive: '#16a34a' },
      { id: 'multi', label: 'MULTI', key: 'R', x: btnStartX + (btnW + btnGap) * 3, y: btnHitY, w: btnW, h: btnHitH, drawY: btnDrawY, drawH: btnDrawH, flash: 0, fill: '#ec4899', fillActive: '#db2777' },
      { id: 'wall',  label: 'WALL',  key: 'T', x: btnStartX + (btnW + btnGap) * 4, y: btnHitY, w: btnW, h: btnHitH, drawY: btnDrawY, drawH: btnDrawH, flash: 0, fill: '#3b82f6', fillActive: '#2563eb' },
    ];

    // Deterministic Atmospheric Cobblestone Battle Scuffs
    this.scraps = Array.from({ length: 20 }, (_, idx) => ({
      x: 52 + ((idx * 173 + 29) % Math.max(60, this.W - 104)),
      y: 118 + ((idx * 97 + 41) % Math.max(80, this.wallY - 175)),
      r: 7 + (idx % 4) * 3.5,
      rot: ((idx * 37) % 100) * 0.03,
      type: idx % 3 === 0 ? 'crater' : 'scorch',
    }));

    // Offscreen bitmap arena cache (invalidated if dimensions change)
    this._arenaCache = null;

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
    const y = this.wallY - 4;
    return [
      { id: 0, x: this.W / 2, y, color: '#22c55e', shade: '#15803d', hat: 'crown', name: 'Captain' },
      { id: 1, x: 75, y, color: '#38bdf8', shade: '#0284c7', hat: 'viking', name: 'Left Sentry' },
      { id: 2, x: this.W - 75, y, color: '#f43f5e', shade: '#be123c', hat: 'tophat', name: 'Right Sentry' },
      { id: 3, x: 145, y, color: '#facc15', shade: '#ca8a04', hat: 'ninja', name: 'Mid-Left Gun' },
      { id: 4, x: this.W - 145, y, color: '#a855f7', shade: '#7e22ce', hat: 'astro', name: 'Mid-Right Gun' },
    ];
  }

  getPriorityTarget(x, y, filterFlank = null) {
    if (this.zombies.length === 0) return null;
    let closestZ = null;
    let closestScore = Infinity;

    for (const z of this.zombies) {
      if (z.y < 140) continue;
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

    const btn = this.upgradeButtons.find((b) => b.id === id);
    if (btn) btn.flash = 1.0;
    const fxX = btn ? btn.x + btn.w * 0.5 : this.W * 0.5;
    const fxY = this.deckY - 12;

    if (id === 'dmg') {
      this.damageLevel++;
      this.fx.text(fxX, fxY, `+DMG Lv.${this.damageLevel}`, '#facc15', 18);
    } else if (id === 'rate') {
      this.fireRateLevel++;
      this.fx.text(fxX, fxY, `+RATE Lv.${this.fireRateLevel}`, '#22d3ee', 18);
    } else if (id === 'guns') {
      this.gunCount++;
      this.fx.text(fxX, fxY, `+GUN ${this.gunCount}/5!`, '#4ade80', 20);
      const emplacements = this.getGunEmplacements();
      const newGun = emplacements[this.gunCount - 1];
      if (newGun) {
        this.fx.ring(newGun.x, newGun.y, newGun.color, 72, 0.5, 4);
        this.fx.burst(newGun.x, newGun.y, '#facc15', 18, 180, 0.55, 4);
      }
    } else if (id === 'multi') {
      this.multiShotLevel++;
      this.fx.text(fxX, fxY, `+BARREL Lv.${this.multiShotLevel}`, '#f472b6', 20);
      this.fx.ring(this.turretX, this.turretY, '#ec4899', 54, 0.4, 4);
    } else if (id === 'wall') {
      this.wallLevel++;
      this.maxWallHp += 60;
      this.wallHp = Math.min(this.maxWallHp, this.wallHp + this.maxWallHp * 0.4);
      this.fx.text(fxX, fxY, `+REPAIR & ARMOR`, '#4ade80', 18);
      this.fx.ring(this.W / 2, this.wallY, '#22c55e', 90, 0.45, 4);
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

    if (this.wave % 5 === 0) {
      this.fx.text(this.W / 2, 220, `⚠ BOSS WAVE ${this.wave}! ⚠`, '#facc15', 26, 1.4);
    } else {
      this.fx.text(this.W / 2, 220, `WAVE ${this.wave}`, '#f43f5e', 28, 1.2);
    }
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

    if (isBossWave && this.waveEnemiesLeft === 0) {
      kind = 'titan';
    }

    let hp = 44 + (this.wave - 1) * 12;
    let speed = 52 + Math.random() * 18;
    let size = 18;
    let col = '#4ade80';
    let colDark = '#15803d';
    let feetCol = '#14532d';
    let bounty = 5;
    let walkSpeed = 1.4;
    let shieldHp = 0;
    let shieldBroken = true;

    if (kind === 'runner') {
      hp = 30 + (this.wave - 1) * 7;
      speed = 138 + Math.random() * 32;
      size = 16;
      col = '#f43f5e';
      colDark = '#be123c';
      feetCol = '#facc15';
      bounty = 7;
      walkSpeed = 3.0;
    } else if (kind === 'brute') {
      hp = 125 + (this.wave - 1) * 32;
      speed = 26 + Math.random() * 8;
      size = 25;
      col = '#64748b';
      colDark = '#334155';
      feetCol = '#1e293b';
      bounty = 22;
      walkSpeed = 1.0;
      shieldHp = 130 + (this.wave - 1) * 35;
      shieldBroken = false;
    } else if (kind === 'boomer') {
      hp = 60 + (this.wave - 1) * 15;
      speed = 58 + Math.random() * 14;
      size = 23;
      col = '#a3e635';
      colDark = '#4d7c0f';
      feetCol = '#365314';
      bounty = 16;
      walkSpeed = 1.3;
    } else if (kind === 'spitter') {
      hp = 52 + (this.wave - 1) * 12;
      speed = 46;
      size = 19;
      col = '#a855f7';
      colDark = '#6b21a8';
      feetCol = '#3b0764';
      bounty = 15;
      walkSpeed = 1.1;
    } else if (kind === 'titan') {
      hp = 700 + this.wave * 180;
      speed = 20;
      size = 40;
      col = '#dc2626';
      colDark = '#7f1d1d';
      feetCol = '#111827';
      bounty = 80;
      walkSpeed = 0.85;
    }

    const hpScale = this.diff.zombieHpMult ?? 1;
    const spdScale = this.diff.zombieSpeedMult ?? 1;
    hp = Math.round(hp * hpScale);
    speed *= spdScale;
    if (shieldHp > 0) shieldHp = Math.round(shieldHp * hpScale);

    this.zombies.push({
      x: 42 + Math.random() * (this.W - 84),
      y: 78,
      hp,
      maxHp: hp,
      speed,
      size,
      kind,
      col,
      colDark,
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

    if (this.wallHitFlash > 0) this.wallHitFlash = Math.max(0, this.wallHitFlash - dt * 5);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - 46 * dt);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) this.killStreak = 0;
    }

    for (const b of this.upgradeButtons) {
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 4.5);
    }

    // Wave Spawner
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

      if (this.waveEnemiesLeft <= 0 && this.zombies.length === 0) {
        this.waveActive = false;
        this.waveBreakTimer = 3.0;
        this.score += 250 * this.wave;
        this.gold += 20 + this.wave * 5;
        this.fx.text(this.W / 2, 240, `WAVE ${this.wave} CLEARED!`, '#facc15', 24, 1.5);
        this.fx.burst(this.W / 2, 240, '#facc15', 22, 200, 0.75, 4);
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

    this.handleInput(dt);
    this.updateSentries(dt);
    this.updateBullets(dt);
    this.updateCasings(dt);
    this.updateAcid(dt);
    this.updateZombies(dt);
    this.updateCoins(dt);

    // Acid pools decay on wall
    for (let i = this.acidPools.length - 1; i >= 0; i--) {
      const p = this.acidPools[i];
      p.life -= dt;
      this.wallHp = Math.max(0, this.wallHp - 8.0 * dt);
      if (p.life <= 0) this.acidPools.splice(i, 1);
    }

    if (this.wallHp <= 0 && !this.dead) {
      this.die('The Fortress Wall Was Overrun!');
      this.fx.burst(this.turretX, this.wallY, '#f43f5e', 36, 300, 1.1, 6);
      this.fx.shake(22, 0.7);
      this.sounds.fail();
      this.haptics.heavy();
    }
  }

  /* ------------------------------------------------------------- Controls & Turret Aim */
  handleInput(dt) {
    const inp = this.input;

    if (inp.pressed) {
      for (const btn of this.upgradeButtons) {
        if (inp.x >= btn.x && inp.x <= btn.x + btn.w && inp.y >= btn.y && inp.y <= btn.y + btn.h) {
          this.buyUpgrade(btn.id);
          return;
        }
      }
    }

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

    let isManualAim = false;
    if (inp.down && inp.y < this.deckY) {
      this.pointerX = inp.x;
      this.pointerY = inp.y;
      const dx = inp.x - this.turretX;
      const dy = inp.y - this.turretY;
      this.aimAngle = clamp(Math.atan2(dy, dx), -Math.PI + 0.15, -0.15);
      isManualAim = true;
      this.firing = true;
    } else if (inp.key(' ') || inp.key('ArrowUp')) {
      isManualAim = true;
      this.firing = true;
    } else {
      const targetZ = this.getPriorityTarget(this.turretX, this.turretY);
      if (targetZ) {
        let desired = clamp(Math.atan2(targetZ.y - this.turretY, targetZ.x - this.turretX), -Math.PI + 0.15, -0.15);
        let diff = desired - this.aimAngle;
        while (diff < -Math.PI) diff += TAU;
        while (diff > Math.PI) diff -= TAU;
        this.aimAngle += clamp(diff, -10 * dt, 10 * dt);
        this.firing = true;
      } else {
        const diff = (-Math.PI / 2) - this.aimAngle;
        this.aimAngle += clamp(diff, -4 * dt, 4 * dt);
        this.firing = false;
      }
    }

    this.isManualAim = isManualAim;

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
        this.turretRecoil[i] = Math.max(0, this.turretRecoil[i] - 18 * dt);
      }
      if (this.turretFlash[i] > 0) {
        this.turretFlash[i] = Math.max(0, this.turretFlash[i] - dt);
      }

      const flank = (i === 1) ? 'left' : (i === 2 ? 'right' : null);
      const target = this.getPriorityTarget(g.x, g.y, flank) || this.getPriorityTarget(g.x, g.y, null);

      if (target) {
        const desired = clamp(Math.atan2(target.y - g.y, target.x - g.x), -Math.PI + 0.18, -0.18);
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
        const diff = (-Math.PI / 2) - this.turretAngles[i];
        this.turretAngles[i] += clamp(diff, -3 * dt, 3 * dt);
      }
    }
  }

  shootSentry(index, g) {
    const baseDamage = 13 + (this.damageLevel - 1) * 4.5;
    const bulletSpeed = 920;
    const a = this.turretAngles[index];
    const muzzleDist = 22;
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

    this.turretRecoil[index] = 4.5;
    this.turretFlash[index] = 0.065;
    this.sounds.tick();
    this.fx.burst(bx, by, g.color, 4, 80, 0.15, 2);
  }

  shoot() {
    const baseDamage = 16 + (this.damageLevel - 1) * 6;
    const bulletSpeed = 960;
    const barrels = this.multiShotLevel;

    const spreads = [];
    if (barrels === 1) spreads.push(0);
    else if (barrels === 2) spreads.push(-0.08, 0.08);
    else if (barrels === 3) spreads.push(-0.14, 0, 0.14);
    else if (barrels === 4) spreads.push(-0.20, -0.07, 0.07, 0.20);
    else spreads.push(-0.26, -0.13, 0, 0.13, 0.26);

    for (const spread of spreads) {
      const a = this.aimAngle + spread;
      const muzzleDist = 30;
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

    this.recoil = 6.5;
    this.muzzleFlash = 0.07;
    this.fx.shake(barrels >= 3 ? 3 : 1.5, 0.08);
    this.sounds.gunfire();
    this.haptics.light();

    if (this.casings.length < 36) {
      this.casings.push({
        x: this.turretX + (Math.random() - 0.5) * 14,
        y: this.turretY + 8,
        vx: (Math.random() < 0.5 ? -1 : 1) * (55 + Math.random() * 85),
        vy: 30 + Math.random() * 45,
        rot: Math.random() * TAU,
        vrot: (Math.random() - 0.5) * 16,
        life: 1.5,
      });
    }
  }

  /* ------------------------------------------------------------- Simulation Updates */
  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.y < -20 || b.x < -20 || b.x > this.W + 20) {
        this.bullets.splice(i, 1);
        continue;
      }

      let intercepted = false;
      for (let j = this.acidProjectiles.length - 1; j >= 0; j--) {
        const a = this.acidProjectiles[j];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 16) {
          this.fx.burst(a.x, a.y, '#c084fc', 10, 140, 0.35, 3);
          this.fx.text(a.x, a.y - 10, 'INTERCEPT!', '#22d3ee', 13, 0.45);
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

      let hit = false;
      for (const z of this.zombies) {
        if (z.y < 140) continue;
        const dist = Math.hypot(b.x - z.x, b.y - z.y);
        if (dist < z.size + 8) {
          let damageToDeal = b.crit ? b.damage * 2 : b.damage;

          if (z.kind === 'brute' && !z.shieldBroken) {
            if (!b.crit) {
              z.shieldHp -= damageToDeal;
              damageToDeal = Math.round(damageToDeal * 0.35);
              this.sounds.tick();
              this.fx.burst(b.x, b.y, '#facc15', 4, 100, 0.2, 2);
              if (z.shieldHp <= 0) {
                z.shieldBroken = true;
                this.sounds.shatter();
                this.fx.burst(z.x, z.y, '#94a3b8', 16, 200, 0.5, 4);
                this.fx.text(z.x, z.y - 18, 'SHIELD BROKEN!', '#f43f5e', 15, 0.6);
              }
            } else {
              this.fx.text(z.x, z.y - 18, 'SHIELD PIERCED!', '#facc15', 15, 0.5);
            }
          }

          z.hp -= damageToDeal;
          z.hitFlash = 0.11;

          if (b.crit) {
            this.fx.text(z.x, z.y - 12, `CRIT ${Math.round(damageToDeal)}`, '#facc15', 16, 0.45);
          }
          this.fx.burst(b.x, b.y, z.col, 5, 115, 0.3, 2.5);

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

      if (z.hp <= 0) {
        this.zombiesKilled++;
        this.score += z.bounty * 10;
        this.gold += z.bounty;

        this.killStreak++;
        this.streakTimer = 1.6;
        if (this.killStreak === 8 || this.killStreak === 16 || this.killStreak === 25) {
          const msg = this.killStreak >= 25 ? 'UNSTOPPABLE!' : this.killStreak >= 16 ? 'RAMPAGE!' : 'MULTI-KILL!';
          this.fx.text(z.x, Math.max(185, z.y - 26), msg, '#facc15', 16, 0.7);
        }

        if (z.kind === 'boomer') {
          this.sounds.explosion();
          this.fx.burst(z.x, z.y, '#a3e635', 22, 230, 0.75, 5);
          this.fx.ring(z.x, z.y, '#facc15', 78, 0.45, 4);
          this.fx.shake(12, 0.4);

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
          this.fx.burst(z.x, z.y, z.col, 14, 155, 0.45, 3.2);
        }

        // Spawn Gold coins flying accurately to Top-Right Gold Badge (W - 68, 122)
        const coinCount = Math.min(4, Math.ceil(z.bounty / 4));
        const tx = this.W - 68;
        const ty = 122;
        for (let c = 0; c < coinCount; c++) {
          this.coins.push({
            x: z.x,
            y: z.y,
            vx: (Math.random() - 0.5) * 110,
            vy: -40 - Math.random() * 70,
            targetX: tx,
            targetY: ty,
            life: 0.9,
            t: 0,
          });
        }

        this.zombies.splice(i, 1);
        continue;
      }

      if (z.kind === 'boomer' && z.y >= this.wallY - z.size - 6) {
        this.sounds.explosion();
        this.fx.burst(z.x, this.wallY, '#f43f5e', 30, 290, 0.95, 6.5);
        this.fx.ring(z.x, this.wallY, '#facc15', 100, 0.65, 5);
        this.fx.shake(20, 0.6);
        this.wallHp = Math.max(0, this.wallHp - 55);
        this.wallHitFlash = 1.0;
        this.acidPools.push({ x: z.x, y: this.wallY, life: 5.0 });
        this.fx.text(z.x, this.wallY - 34, 'BOOMER BLAST -55!', '#f43f5e', 20, 0.9);
        this.haptics.heavy();
        this.zombies.splice(i, 1);
        continue;
      }

      if (z.kind === 'spitter' && z.y >= 240) {
        z.x += (z.strafeDir || 1) * 44 * dt;
        if (z.x < 52) { z.x = 52; z.strafeDir = 1; }
        if (z.x > this.W - 52) { z.x = this.W - 52; z.strafeDir = -1; }

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
          this.fx.burst(z.x, z.y + 12, '#e879f9', 8, 90, 0.35, 2.5);
        }
        continue;
      }

      if (z.y < this.wallY - z.size) {
        const inBarbedWire = (z.y > this.wallY - 35);
        const curSpeed = inBarbedWire ? z.speed * 0.72 : z.speed;
        z.y += curSpeed * dt;

        if (z.kind === 'runner') {
          z.x += Math.sin(z.wobble * 2.5) * 65 * dt;
        } else {
          z.x += Math.sin(z.wobble) * (curSpeed * 0.25) * dt;
        }
        z.x = clamp(z.x, 42, this.W - 42);
      } else {
        z.attackCooldown -= dt;
        if (z.attackCooldown <= 0) {
          const dmg = (z.kind === 'titan') ? 45 : (z.kind === 'brute') ? 28 : 11;
          this.wallHp = Math.max(0, this.wallHp - dmg);
          this.wallHitFlash = 0.7;
          z.attackCooldown = 0.55;
          this.fx.shake(z.kind === 'titan' ? 9 : 4.5, 0.2);
          this.fx.burst(z.x, this.wallY, '#facc15', 8, 150, 0.35, 3);
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
        this.wallHitFlash = 0.75;
        this.fx.burst(a.x, this.wallY, '#e879f9', 14, 150, 0.45, 3.5);
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
      if (c.y > this.wallY + 18) {
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
      c.x += (c.targetX - c.x) * (ease * 0.16);
      c.y += (c.targetY - c.y) * (ease * 0.16);
    }
  }

  /* ------------------------------------------------------------- Offscreen Pre-Baked Weebl Arena (2x DPR) */
  getArenaCache() {
    const key = `${this.W}x${this.wallY}`;
    if (this._arenaCache && this._arenaCache.key === key) {
      return this._arenaCache.canvas;
    }

    const canCache =
      typeof document !== 'undefined' &&
      typeof HTMLCanvasElement !== 'undefined';
    if (!canCache) return null;

    const { W, wallY } = this;
    const scale = 2;
    const off = document.createElement('canvas');
    off.width = W * scale;
    off.height = wallY * scale;
    const octx = off.getContext('2d');
    octx.scale(scale, scale);

    this.paintArenaBackdrop(octx, W, wallY);
    this._arenaCache = { key, canvas: off };
    return off;
  }

  paintArenaBackdrop(ctx, W, wallY) {
    const roadX = 34;
    const roadW = W - roadX * 2;

    // 1. Flat-Cel Slate Cobblestone Courtyard Road (high contrast for sprites & bullets!)
    ctx.fillStyle = '#2d3a54';
    ctx.fillRect(roadX, 0, roadW, wallY);

    // Subtle alternating cel cobblestone flagstones
    const tileW = 46;
    const tileH = 38;
    let rowIdx = 0;
    for (let y = 96; y < wallY - 30; y += tileH) {
      const stagger = (rowIdx % 2) * (tileW * 0.5);
      for (let x = roadX - tileW; x < roadX + roadW + tileW; x += tileW) {
        const px = Math.max(roadX + 2, x + stagger);
        const pw = Math.min(roadX + roadW - 2, x + stagger + tileW - 4) - px;
        if (pw < 10) continue;
        const hash = Math.abs(Math.sin(px * 0.13 + y * 0.29));
        ctx.fillStyle = hash > 0.62 ? '#364563' : hash < 0.28 ? '#27334b' : '#313f5c';
        ctx.strokeStyle = '#1b2438';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.roundRect(px, y + 2, pw, tileH - 5, 5);
        ctx.fill();
        ctx.stroke();

        // Crisp upper cel bevel glint on scattered tiles
        if (hash > 0.72) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.fillRect(px + 5, y + 5, pw - 10, 4);
        }
      }
      rowIdx++;
    }

    // Center siege path lane markers (subtle crisp yellow/cream weathered blocks)
    ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
    for (let y = 138; y < wallY - 56; y += 52) {
      ctx.beginPath();
      ctx.roundRect(W / 2 - 4, y, 8, 22, 3);
      ctx.fill();
    }

    // 2. Deterministic Craters & Battle Scorch Splatters
    for (const s of this.scraps) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      if (s.type === 'crater') {
        ctx.fillStyle = '#192235';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, s.r, s.r * 0.56, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(136, 19, 55, 0.42)';
        ctx.beginPath();
        ctx.ellipse(0, 0, s.r * 1.15, s.r * 0.58, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Top Spawn Shadow & Ruined Siege Horizon (y = 0..124)
    ctx.fillStyle = '#131b2e';
    ctx.fillRect(0, 0, W, 108);

    // Jagged distant hill silhouettes & dark spawn mist band
    ctx.fillStyle = '#1d2842';
    ctx.fillRect(roadX, 108, roadW, 18);
    ctx.fillStyle = '#090e1a';
    ctx.fillRect(roadX, 94, roadW, 18);
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(roadX, 112);
    ctx.lineTo(roadX + roadW, 112);
    ctx.stroke();

    // 4. Lush #000-Inked Emerald Countryside Verge & Side Stone Rampart Walls (Left & Right)
    for (const side of [0, 1]) {
      const wallEdgeX = side === 0 ? 0 : W - roadX;
      // Bright cel emerald grass strip along outer borders
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(wallEdgeX, 0, roadX, wallY);

      // Bush & hedge puffs along outer edge
      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      for (let by = 110; by < wallY - 10; by += 42) {
        const bx = side === 0 ? 8 : W - 8;
        ctx.beginPath();
        ctx.arc(bx, by, 13, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      // Inner `#000`-Inked Castle Stone Side Curb Wall bordering the cobblestone road
      const curbX = side === 0 ? roadX - 13 : W - roadX;
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.8;
      ctx.fillRect(curbX, 98, 13, wallY - 98);
      ctx.strokeRect(curbX, 98, 13, wallY - 98);

      // Stone block joints & crenel highlights on side walls
      for (let cy = 112; cy < wallY - 24; cy += 36) {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(curbX + 2, cy, 9, 14);
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(curbX, cy);
        ctx.lineTo(curbX + 13, cy);
        ctx.stroke();
      }
    }

    // 5. Hazard Curb & Barbed Wire Danger Zone ahead of Fortress Wall (y = wallY - 34 .. wallY)
    const dangerTop = wallY - 34;
    ctx.fillStyle = 'rgba(220, 38, 38, 0.16)';
    ctx.fillRect(roadX, dangerTop, roadW, 34);

    // Painted Yellow/Black Warning Stripe ahead of Barricade
    ctx.save();
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.2;
    ctx.fillRect(roadX, dangerTop, roadW, 7);
    ctx.strokeRect(roadX, dangerTop, roadW, 7);

    ctx.fillStyle = STYLE_TOKENS.ink;
    for (let sx = roadX; sx < roadX + roadW - 8; sx += 22) {
      ctx.beginPath();
      ctx.moveTo(sx, dangerTop + 1);
      ctx.lineTo(sx + 10, dangerTop + 1);
      ctx.lineTo(sx + 4, dangerTop + 6);
      ctx.lineTo(sx - 4, dangerTop + 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Heavy #000-Inked Barbed-Wire Timber Stakes & Coils
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Black outer stroke for wire
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 5.2;
    for (let bx = roadX + 8; bx < roadX + roadW - 14; bx += 24) {
      ctx.beginPath();
      ctx.moveTo(bx, wallY - 22);
      ctx.lineTo(bx + 12, wallY - 5);
      ctx.lineTo(bx + 22, wallY - 22);
      ctx.stroke();
    }
    // Bright metallic steel wire center
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.0;
    for (let bx = roadX + 8; bx < roadX + roadW - 14; bx += 24) {
      ctx.beginPath();
      ctx.moveTo(bx, wallY - 22);
      ctx.lineTo(bx + 12, wallY - 5);
      ctx.lineTo(bx + 22, wallY - 22);
      ctx.stroke();
    }

    // Timber defense posts along barbed wire
    for (let px = roadX + 18; px < roadX + roadW - 16; px += 48) {
      ctx.fillStyle = '#92400e';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(px - 4, wallY - 26, 8, 22, 3);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------- Render Engine */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    // 1. Dark exterior background below wall
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // 2. Blit Pre-Baked 2x Weebl Cobblestone Siege Courtyard
    const arenaCache = this.getArenaCache();
    if (arenaCache) {
      ctx.drawImage(arenaCache, 0, 0, W, this.wallY);
    } else {
      this.paintArenaBackdrop(ctx, W, this.wallY);
    }

    // Wall armor spike upgrades visual on stakes (Lv.3+)
    if (this.wallLevel >= 3) {
      ctx.fillStyle = this.wallLevel >= 4 ? '#38bdf8' : '#facc15';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      for (let px = 52; px < W - 50; px += 48) {
        ctx.beginPath();
        ctx.moveTo(px - 4, this.wallY - 24);
        ctx.lineTo(px, this.wallY - 33);
        ctx.lineTo(px + 4, this.wallY - 24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 3. Acid Pools on Wall Barricade (#000-Inked Glowing Venom Puddles)
    for (const pool of this.acidPools) {
      const a = clamp(pool.life * 0.45, 0.2, 0.92);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#9333ea';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(pool.x, pool.y, 24, 9, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e879f9';
      ctx.beginPath();
      ctx.ellipse(pool.x - 4, pool.y - 2, 11, 3.5, -0.1, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // 4. Spitter Venom Projectiles (#000-Inked Acid Bombs)
    for (const a of this.acidProjectiles) {
      ctx.fillStyle = 'rgba(217, 70, 239, 0.34)';
      ctx.beginPath();
      ctx.arc(a.x, a.y, 12.5, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#c026d3';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 8, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#bef264';
      ctx.beginPath();
      ctx.arc(a.x - 2.5, a.y - 2.5, 2.8, 0, TAU);
      ctx.fill();
    }

    // 5. Render Zombies Sorted Back-to-Front for Clean Overlapping
    const sorted = this.zombies.slice().sort((a, b) => a.y - b.y);
    for (const z of sorted) {
      this.drawZombie(ctx, z);
    }

    // 6. Render Inked Comic Blaster Bolts
    for (const b of this.bullets) {
      const col = b.crit ? '#facc15' : (b.col || '#38bdf8');
      const ang = Math.atan2(b.vy, b.vx);
      const len = b.crit ? 15 : 11;
      const thick = b.crit ? 6.8 : 5.2;

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);

      ctx.fillStyle = col;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(-len * 0.5, -thick * 0.5, len, thick, thick * 0.5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-len * 0.25, -thick * 0.22, len * 0.55, thick * 0.44, 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. Render Inked Gold Coins Flying to Top-Right Counter
    for (const c of this.coins) {
      drawGoldCoinBadge(ctx, c.x, c.y, 6, 1.8);
    }

    // 8. Render Brass Shell Casings
    for (const c of this.casings) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-2.2, -4.5, 4.4, 9, 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 9. Draw Weebl Castle Battlement Wall & Damage/Upgrade Details
    this.drawWall(ctx, W);

    // 10. Draw Hero Captain + 4 Squad Sentry Emplacements
    this.drawTurret(ctx);

    // 11. Draw Wall HP Bar cleanly on Wall Masonry Apron (y = 659..678)
    this.drawWallHPBar(ctx, W);

    // 12. Render FX Layer (Bursts, Rings, Floating Damage/Gold Callouts)
    this.fx.render(ctx, 1.0);

    // 13. Draw Top HUD (Wave, Gold, Boss HP)
    this.drawTopHUD(ctx, W);

    // 14. Draw Interactive Weebl Command Upgrade Dock (deckY = 682..800)
    this.drawUpgradeDrawer(ctx, W);
  }

  /* ------------------------------------------------------------- #000-Inked Weebl Zombie Horde */
  drawZombie(ctx, z) {
    ctx.save();
    ctx.translate(z.x, z.y);

    const size = z.size;
    const kind = z.kind;
    const walkT = z.walkT || 0;
    const hitFlash = (z.hitFlash > 0);

    // Boomer imminent wall detonation warning pulse
    if (kind === 'boomer' && z.y > this.wallY - 95 && !hitFlash) {
      const pulse = 0.65 + 0.35 * Math.sin(this.time * 18);
      ctx.fillStyle = `rgba(244, 63, 94, ${0.28 * pulse})`;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(0, size * 0.72, size * 1.15, size * 0.45, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    if (kind === 'runner') {
      // Comic speed wind lines behind sprinting zombie
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.55)';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, -size * 1.1); ctx.lineTo(-10, -size * 1.55);
      ctx.moveTo(0, -size * 1.25); ctx.lineTo(0, -size * 1.75);
      ctx.moveTo(10, -size * 1.05); ctx.lineTo(10, -size * 1.48);
      ctx.stroke();
      ctx.rotate(Math.sin(walkT * 3) * 0.14);
    } else if (kind === 'walker') {
      ctx.rotate(Math.sin(walkT * 1.5) * 0.08);
    }

    let wMult = 1.0;
    let hMult = 1.0;
    let squash = 1.0;

    if (kind === 'brute') {
      wMult = 1.35;
      hMult = 1.15;
    } else if (kind === 'boomer') {
      wMult = 1.42;
      hMult = 0.96;
      squash = 0.94 + Math.sin(this.time * 7 + z.x) * 0.06;
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
    const inkW = Math.max(2.3, Math.min(3.4, size * 0.13));

    // 1. Crisp Oval Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.54, w * 0.72, radius * 0.36, 0, 0, TAU);
    ctx.fill();

    // 2. Stubby #000-Inked Feet
    const footR = radius * 0.4;
    const footY = h * 0.48;
    const legSwing = Math.sin(walkT * (kind === 'runner' ? 14 : 7)) * (radius * 0.44);
    const footCol = hitFlash ? '#ffffff' : (z.feetCol || '#14532d');

    for (const [fx, fy, rot] of [
      [-w * 0.32, footY + legSwing, -0.2],
      [w * 0.32, footY - legSwing, 0.2],
    ]) {
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(rot);
      ctx.fillStyle = footCol;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = inkW;
      ctx.beginPath();
      ctx.ellipse(0, 0, footR, footR * 0.68, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 3. Flat-Cel #000-Inked Arms
    const armY = topY + radius * 0.72;
    const armLen = radius * 0.82;
    const armSwing = Math.sin(walkT * 6) * (radius * 0.2);
    const armCol = hitFlash ? '#ffffff' : z.col;

    const drawArm = (ax, ay, rot) => {
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(rot);
      ctx.fillStyle = armCol;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = inkW;
      ctx.beginPath();
      ctx.ellipse(0, 0, armLen * 0.46, armLen * 0.84, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    drawArm(-w * 0.56, armY + armSwing, -0.25);
    if (kind !== 'brute' || z.shieldBroken) {
      drawArm(w * 0.56, armY - armSwing, 0.25);
    }

    // 4. Flat 2-Tone Cel Bean Body with Heavy #000 Ink Contour (zero gradients!)
    ctx.fillStyle = hitFlash ? '#ffffff' : z.col;
    ctx.beginPath();
    ctx.arc(0, topY, radius, Math.PI, 0, false);
    ctx.arc(0, botY, radius, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();

    if (!hitFlash) {
      // Right/bottom flat-cel shadow crescent (non-clipped clean inner arc)
      ctx.fillStyle = z.colDark;
      ctx.beginPath();
      ctx.ellipse(radius * 0.36, 0, radius * 0.46, bodyH * 0.42, 0.08, -Math.PI * 0.45, Math.PI * 0.52);
      ctx.fill();

      // Forehead cel glint
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.34, topY - radius * 0.36, radius * 0.28, radius * 0.14, -0.45, 0, TAU);
      ctx.fill();
    }

    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = inkW;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(0, topY, radius, Math.PI, 0, false);
    ctx.arc(0, botY, radius, 0, Math.PI, false);
    ctx.closePath();
    ctx.stroke();

    // 5. Distinct Weebl Villain Archetype Props & Faces
    this.drawZombieFeatures(ctx, z, { topY, botY, radius, w, h, hitFlash, size, inkW });

    // 6. Crisp #000-Inked Health Bar when damaged
    if (z.hp < z.maxHp) {
      const barW = Math.max(28, w * 1.5);
      const barH = 6.5;
      const barY = -bodyH * 0.5 - (kind === 'titan' ? 28 : 16);
      const hpRatio = clamp(z.hp / z.maxHp, 0, 1);
      const hpCol = (hpRatio > 0.45) ? '#22c55e' : (hpRatio > 0.2) ? '#facc15' : '#f43f5e';

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(-barW / 2, barY, barW, barH, 3);
      ctx.fill();
      ctx.stroke();

      if (barW * hpRatio >= 3) {
        ctx.fillStyle = hpCol;
        ctx.beginPath();
        ctx.roundRect(-barW / 2 + 1, barY + 1, Math.max(2, (barW - 2) * hpRatio), barH - 2, 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  drawZombieFeatures(ctx, z, geo) {
    const { topY, botY, radius, w, hitFlash, inkW } = geo;
    const kind = z.kind;

    if (kind === 'walker') {
      // Surgical forehead stitches
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.42, topY - radius * 0.24);
      ctx.lineTo(radius * 0.34, topY - radius * 0.08);
      ctx.stroke();
      for (let sx = -radius * 0.3; sx <= radius * 0.22; sx += radius * 0.22) {
        ctx.beginPath();
        ctx.moveTo(sx, topY - radius * 0.33);
        ctx.lineTo(sx + 2, topY - radius * 0.02);
        ctx.stroke();
      }

      // Asymmetric silly Weebl sclera eyes
      const eyeY = topY + radius * 0.34;
      drawWeeblEyeCluster(ctx, -radius * 0.34, eyeY, Math.max(3.6, radius * 0.32), {
        lookX: 0.2,
        mood: 'happy',
        lineW: 2.0,
      });
      drawWeeblEyeCluster(ctx, radius * 0.34, eyeY + 1, Math.max(2.6, radius * 0.22), {
        lookX: -0.3,
        mood: 'panic',
        lineW: 1.8,
      });

      // Crooked jaw + single yellow fang & drool bubble
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-radius * 0.34, botY * 0.35, radius * 0.68, radius * 0.36, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-3, botY * 0.36, 5, 4);

      if (!hitFlash) {
        ctx.fillStyle = '#a3e635';
        ctx.beginPath();
        ctx.arc(radius * 0.2, botY * 0.72, 2.8, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    } else if (kind === 'runner') {
      const bandY = topY - radius * 0.08;
      const ribSwing = Math.sin(this.time * 16) * 5.5;
      ctx.fillStyle = '#f97316';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.88, bandY + 2);
      ctx.lineTo(-radius * 1.4, bandY - 4 + ribSwing);
      ctx.lineTo(-radius * 1.28, bandY + 8 + ribSwing);
      ctx.lineTo(-radius * 0.88, bandY + radius * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bold golden headband
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.roundRect(-radius * 0.94, bandY, radius * 1.88, radius * 0.36, 4);
      ctx.fill();
      ctx.stroke();

      const eyeY = topY + radius * 0.44;
      drawWeeblEyeCluster(ctx, 0, eyeY, Math.max(3.0, radius * 0.28), {
        dual: true,
        spacing: radius * 0.74,
        mood: 'angry',
        lookX: 0,
        lineW: 1.9,
      });

      // Snarling toothy grin
      ctx.fillStyle = '#4c0519';
      ctx.beginPath();
      ctx.roundRect(-radius * 0.38, botY * 0.34, radius * 0.76, radius * 0.32, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-radius * 0.26, botY * 0.36, radius * 0.52, 3);
    } else if (kind === 'brute') {
      // Heavy #000-Inked Iron Riot Helmet
      const helmY = topY - radius * 0.36;
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = inkW;
      ctx.beginPath();
      ctx.arc(0, topY, radius * 1.1, Math.PI, 0);
      ctx.lineTo(radius * 1.1, helmY + radius * 0.95);
      ctx.lineTo(-radius * 1.1, helmY + radius * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Helmet gleam strip
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.32, topY - radius * 0.52, radius * 0.36, radius * 0.14, -0.35, 0, TAU);
      ctx.fill();

      // Crimson laser visor slit
      ctx.fillStyle = '#f43f5e';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(-radius * 0.66, helmY + radius * 0.42, radius * 1.32, 6, 3);
      ctx.fill();
      ctx.stroke();

      // Heavy #000-Inked Iron-&-Hazard Riot Shield
      if (!z.shieldBroken) {
        const shX = w * 0.56;
        const shY = botY * 0.14;
        const shW = radius * 1.15;
        const shH = radius * 1.85;

        ctx.save();
        ctx.translate(shX, shY);

        ctx.fillStyle = '#334155';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.roundRect(-shW / 2, -shH / 2, shW, shH, 6);
        ctx.fill();
        ctx.stroke();

        // Hazard caution band
        ctx.fillStyle = '#facc15';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(-shW / 2 + 2.5, -5, shW - 5, 10, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = STYLE_TOKENS.ink;
        ctx.beginPath();
        ctx.moveTo(-shW / 2 + 5, -4); ctx.lineTo(-shW / 2 + 11, 4); ctx.lineTo(-shW / 2 + 7, 4); ctx.lineTo(-shW / 2 + 3, 0);
        ctx.moveTo(0, -4); ctx.lineTo(6, 4); ctx.lineTo(2, 4); ctx.lineTo(-4, -4);
        ctx.fill();

        // Shield crack feedback below 50%
        if (z.maxShieldHp > 0 && z.shieldHp / z.maxShieldHp < 0.55) {
          drawStoneCrackOverlay(ctx, shW * 0.9, shH * 0.85, z.shieldHp / z.maxShieldHp);
        }

        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 0, 4.2, 0, TAU);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    } else if (kind === 'boomer') {
      // Glowing wobbling toxic boils (#000-inked)
      const boils = [
        { x: -radius * 0.5, y: topY - radius * 0.25, r: radius * 0.36 },
        { x: radius * 0.45, y: topY - radius * 0.16, r: radius * 0.28 },
        { x: radius * 0.64, y: botY * 0.22, r: radius * 0.32 },
      ];
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      for (let i = 0; i < boils.length; i++) {
        const b = boils[i];
        const pulse = 1 + Math.sin(this.time * 9 + i * 2) * 0.14;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * pulse, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      // Biohazard yellow belt sash
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.85, topY + radius * 0.48);
      ctx.lineTo(radius * 0.85, botY * 0.34);
      ctx.lineTo(radius * 0.85, botY * 0.34 + 7);
      ctx.lineTo(-radius * 0.85, topY + radius * 0.48 + 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const eyeY = topY + radius * 0.38;
      drawWeeblEyeCluster(ctx, 0, eyeY, Math.max(3.5, radius * 0.30), {
        dual: true,
        spacing: radius * 0.72,
        mood: 'panic',
        lookX: Math.sin(this.time * 6) * 0.5,
        lineW: 2.0,
      });

      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.roundRect(-radius * 0.38, botY * 0.42, radius * 0.76, radius * 0.4, 5);
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'spitter') {
      // Jagged Necro Hood
      const hoodY = topY - radius * 0.34;
      ctx.fillStyle = '#581c87';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = inkW;
      ctx.beginPath();
      ctx.arc(0, topY, radius * 1.12, Math.PI, 0);
      ctx.lineTo(radius * 1.14, hoodY + radius * 1.08);
      ctx.lineTo(radius * 0.55, hoodY + radius * 0.82);
      ctx.lineTo(0, hoodY + radius * 0.94);
      ctx.lineTo(-radius * 0.55, hoodY + radius * 0.82);
      ctx.lineTo(-radius * 1.14, hoodY + radius * 1.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(0, topY + radius * 0.4, radius * 0.72, radius * 0.44, 0, 0, TAU);
      ctx.fill();

      const eyeY = topY + radius * 0.38;
      drawWeeblEyeCluster(ctx, 0, eyeY, Math.max(2.9, radius * 0.25), {
        dual: true,
        spacing: radius * 0.64,
        mood: 'angry',
        lookX: 0,
        lineW: 1.8,
      });

      // Swelling venom throat sac (pre-spit windup tell!)
      const spitWarn = z.spitTimer < 0.65 ? 1.32 : 1.0;
      const sacR = radius * 0.36 * spitWarn * (1 + Math.sin(this.time * 7) * 0.12);
      ctx.fillStyle = spitWarn > 1 ? '#fef08a' : '#e879f9';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, botY * 0.46, sacR, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'titan') {
      // Colossal Titan Dread King Golden Crown + Ruby Jewels
      const cy = topY - radius * 0.84;
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = Math.max(2.6, inkW);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.64, cy + 8);
      ctx.lineTo(-radius * 0.64, cy - 20);
      ctx.lineTo(-radius * 0.26, cy - 6);
      ctx.lineTo(0, cy - 26);
      ctx.lineTo(radius * 0.26, cy - 6);
      ctx.lineTo(radius * 0.64, cy - 20);
      ctx.lineTo(radius * 0.64, cy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.lineWidth = 1.8;
      for (const [rx, ry, rr] of [
        [0, cy - 8, 4.2],
        [-radius * 0.36, cy + 1, 3.3],
        [radius * 0.36, cy + 1, 3.3],
      ]) {
        ctx.beginPath();
        ctx.arc(rx, ry, rr, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      const eyeY = topY + radius * 0.36;
      drawWeeblEyeCluster(ctx, 0, eyeY, Math.max(4.4, radius * 0.24), {
        dual: true,
        spacing: radius * 0.72,
        mood: 'angry',
        lookX: 0,
        lineW: 2.4,
      });

      // Glowing Magma Chest Core Fissure
      const lavaBright = Math.sin(this.time * 6) > 0 ? '#fde047' : '#fb923c';
      ctx.fillStyle = lavaBright;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.32, botY * 0.28);
      ctx.lineTo(0, botY * 0.08);
      ctx.lineTo(radius * 0.32, botY * 0.28);
      ctx.lineTo(radius * 0.12, botY * 0.62);
      ctx.lineTo(-radius * 0.12, botY * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------- Fortified Weebl Castle Wall */
  drawWall(ctx, W) {
    const y = this.wallY;
    const hpRatio = clamp(this.wallHp / this.maxWallHp, 0, 1);

    // 1. Heavy #000-Inked Stone Fortress Foundation Block (y..610)
    drawComicPanel(ctx, 2, y, W - 4, 46, 6, this.wallHitFlash > 0.2 ? '#7f1d1d' : '#475569', {
      lineWidth: 3.2,
      shadowDx: 0,
      shadowDy: 0,
      glossTop: false,
    });

    // Armored steel trim plating unlocked at Wall Lv.2+
    if (this.wallLevel >= 2) {
      ctx.fillStyle = this.wallLevel >= 4 ? '#f59e0b' : '#94a3b8';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(10, y + 3, W - 20, 8, 3);
      ctx.fill();
      ctx.stroke();
    }

    // 2. Real Tiled HD Weebl Stone Battlement Sprites along the Parapet!
    const tileCount = 7;
    const stepW = (W - 24) / tileCount;
    for (let i = 0; i < tileCount; i++) {
      const bx = 12 + i * stepW + stepW * 0.5;
      drawSprite(ctx, 'p_stone_battlement', bx, y + 6, stepW + 4, 34, {
        fallback: () => {
          drawComicPanel(ctx, bx - stepW * 0.42, y - 8, stepW * 0.84, 18, 4, '#64748b', {
            lineWidth: 2.6,
            shadowDx: 0,
            shadowDy: 2,
          });
        },
      });
    }

    // Wall structural battle cracks when damaged below 85%
    if (hpRatio < 0.85) {
      for (const cx of [108, 225, 342]) {
        ctx.save();
        ctx.translate(cx, y + 14);
        drawStoneCrackOverlay(ctx, 56, 20, hpRatio);
        ctx.restore();
      }
    }

    // Flanking Weebl TNT & Supply Barrels anchored to Outer Bastion Wings
    drawSprite(ctx, 'b_tnt_barrel', 20, y + 6, 28, 32, {
      fallback: () => {},
    });
    drawSprite(ctx, 'b_tnt_barrel', W - 20, y + 6, 28, 32, {
      fallback: () => {},
    });
  }

  drawWallHPBar(ctx, W) {
    const barW = W - 48;
    const barH = 19;
    const barX = 24;
    const barY = this.wallY + 23; // Cleanly sits in lower stone fascia (588..607) below all turrets!
    const hpRatio = clamp(this.wallHp / this.maxWallHp, 0, 1);
    const lowHp = hpRatio <= 0.25;
    const hpCol = hpRatio > 0.45 ? '#22c55e' : hpRatio > 0.22 ? '#facc15' : '#ef4444';

    drawComicPanel(ctx, barX, barY, barW, barH, 8, '#0f172a', {
      lineWidth: 2.6,
      shadowDx: 0,
      shadowDy: 2,
      glossTop: false,
    });

    if (barW * hpRatio >= 8) {
      ctx.fillStyle = hpCol;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(barX + 2.5, barY + 2.5, Math.max(4, (barW - 5) * hpRatio), barH - 5, 6);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.beginPath();
      ctx.roundRect(barX + 4, barY + 3.5, Math.max(2, (barW - 8) * hpRatio), 4.5, 2);
      ctx.fill();
    }

    const labelCol = (lowHp && Math.sin(this.time * 12) > 0) ? '#fef08a' : '#ffffff';
    drawComicText(
      ctx,
      `FORTRESS WALL · ${Math.ceil(this.wallHp)} / ${this.maxWallHp} HP`,
      W / 2,
      barY + barH * 0.5 + 0.5,
      FONT_HUD_SM,
      labelCol,
      { strokeWidth: 3.0 }
    );
  }

  /* ------------------------------------------------------------- 5-Turret Weebl Gunline */
  drawTurret(ctx) {
    const emplacements = this.getGunEmplacements();
    for (let i = 0; i < emplacements.length; i++) {
      const g = emplacements[i];
      if (i >= this.gunCount) {
        // Locked Empty Gun Emplacement Pad
        drawComicPanel(ctx, g.x - 16, g.y - 8, 32, 20, 7, '#1e293b', {
          lineWidth: 2.4,
          shadowDx: 0,
          shadowDy: 2,
          glossTop: false,
        });
        drawComicText(ctx, '🔒', g.x, g.y + 2, FONT_DOCK_SUB, '#94a3b8', { strokeWidth: 2.4 });
        continue;
      }
      this.drawSingleTurret(ctx, i, g);
    }
  }

  drawSingleTurret(ctx, index, g) {
    const isMain = (index === 0);
    const tx = g.x;
    const ty = g.y;
    const a = isMain ? this.aimAngle : this.turretAngles[index];
    const recoil = isMain ? this.recoil : this.turretRecoil[index];
    const flashT = isMain ? this.muzzleFlash : this.turretFlash[index];

    // 1. Tactical Manual Aim Laser & Reticle on Main Battery
    if (isMain && this.isManualAim) {
      ctx.save();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.cos(a) * 580, ty + Math.sin(a) * 580);
      ctx.stroke();
      ctx.setLineDash([]);

      // Spinning crisp crosshair at manual aim point
      const rx = clamp(this.pointerX, 34, this.W - 34);
      const ry = clamp(this.pointerY, 130, this.wallY - 24);
      ctx.translate(rx, ry);
      ctx.rotate(this.time * 2.4);
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }

    const gunnerSq = recoil > 0 ? 0.9 : 1.0;
    const facingLeft = Math.cos(a) < 0;

    // 2. Armored Gun Swivel Base + Rotating Heavy Inked Cannon Barrels (drawn in front of waist)
    ctx.save();
    ctx.translate(tx, ty);

    const shieldR = isMain ? 16 : 12;
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 0, shieldR, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = g.color;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, shieldR * 0.45, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Rotate Cannons toward target
    ctx.rotate(a);
    const ro = recoil > 0 ? -recoil : 0;

    const drawCelBarrel = (bx, by, bw, bh, tipCol) => {
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, bh * 0.38);
      ctx.fill();
      ctx.stroke();

      // Highlight strip along barrel top
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(bx + 3, by + 1.5, Math.max(4, bw - 10), Math.max(1.5, bh * 0.25));

      // Colored muzzle tip collar
      ctx.fillStyle = tipCol;
      ctx.beginPath();
      ctx.roundRect(bx + bw - 7, by - 0.5, 8, bh + 1, 3);
      ctx.fill();
      ctx.stroke();
    };

    let barrelTipX = ro + 30;
    if (isMain) {
      const m = this.multiShotLevel;
      if (m === 1) {
        drawCelBarrel(ro + 2, -4.5, 29, 9, '#38bdf8');
      } else if (m === 2) {
        drawCelBarrel(ro + 2, -9.5, 29, 6.5, '#38bdf8');
        drawCelBarrel(ro + 2, 3, 29, 6.5, '#38bdf8');
      } else if (m === 3) {
        drawCelBarrel(ro + 2, -12, 27, 5.5, '#38bdf8');
        drawCelBarrel(ro + 2, -3, 31, 6, '#f43f5e');
        drawCelBarrel(ro + 2, 6.5, 27, 5.5, '#38bdf8');
      } else if (m === 4) {
        drawCelBarrel(ro + 2, -14, 26, 5, '#38bdf8');
        drawCelBarrel(ro + 2, -6.5, 30, 5.5, '#facc15');
        drawCelBarrel(ro + 2, 1, 30, 5.5, '#facc15');
        drawCelBarrel(ro + 2, 9, 26, 5, '#38bdf8');
      } else {
        // 5-Barrel OMEGA Cannon!
        drawCelBarrel(ro + 2, -15.5, 25, 4.8, '#38bdf8');
        drawCelBarrel(ro + 2, -9, 29, 5, '#facc15');
        drawCelBarrel(ro + 2, -2.6, 33, 5.2, '#f43f5e');
        drawCelBarrel(ro + 2, 4, 29, 5, '#facc15');
        drawCelBarrel(ro + 2, 10.7, 25, 4.8, '#38bdf8');
        barrelTipX = ro + 35;
      }
    } else {
      drawCelBarrel(ro + 2, -6.5, 22, 4.8, g.color);
      drawCelBarrel(ro + 2, 1.8, 22, 4.8, g.color);
      barrelTipX = ro + 24;
    }

    // Spiky Flash Comic Muzzle Starburst!
    if (flashT > 0) {
      drawComicStarburst(
        ctx,
        barrelTipX + 4,
        0,
        isMain ? 14 : 10,
        isMain ? 5.5 : 4,
        7,
        '#fef08a',
        STYLE_TOKENS.ink,
        this.time * 18,
        2.0
      );
    }

    ctx.restore();

    // 3. Crew Gunner peeking over the parapet in FRONT of the gun mount
    //    (legs are tucked behind the wall HP apron drawn afterwards).
    if (isMain) {
      // Action-engaged Cel-Shaded 3D Captain Gunner hunkered behind turret with real recoil!
      const firingRec = Math.max(recoil > 0 ? clamp(recoil / 7, 0.25, 1) : 0, flashT > 0 ? 0.9 : 0);
      drawHeroCharacter(ctx, tx, ty + 42, 44, {
        view: 'threeQuarterFront',
        dir: facingLeft ? -1 : 1,
        state: 'turret_fire',
        prop: 'none',
        recoil: firingRec,
        lean: clamp(Math.cos(a) * 0.25, -0.25, 0.25),
        lookX: facingLeft ? -0.65 : 0.65,
        expr: 'focus',
        t: this.time * 5,
        squashX: 2 - gunnerSq,
        squashY: gunnerSq,
      });
    } else {
      // Unique Hatted Weebl Squad Gunners for Flank Towers!
      drawWeeblCelBean(ctx, tx, ty + 36, 27, {
        color: g.color,
        shadeColor: g.shade,
        hatId: g.hat,
        dir: facingLeft ? -1 : 1,
        squash: gunnerSq,
        waveT: this.time * 1.8 + index,
        eyes: 'happy',
        legs: false,
      });
    }
  }

  /* ------------------------------------------------------------- #000-Inked Top HUD & Boss Plate */
  drawTopHUD(ctx, W) {
    // 1. Wave & Remaining Counter Card (Top Left, cleanly below CYCLE banner)
    const remaining = this.zombies.length + this.waveEnemiesLeft;
    drawComicPanel(ctx, 14, 104, 124, 36, 11, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    const waveStr = this.waveActive ? `WAVE ${this.wave} · ${remaining}` : `WAVE ${this.wave}`;
    drawComicText(ctx, waveStr, 76, 123, FONT_HUD_MD, '#fb7185', { strokeWidth: 3.0 });

    // 2. Gold Counter Card (Top Right, cleanly below #prestigeBadge)
    drawComicPanel(ctx, W - 122, 104, 108, 36, 11, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawGoldCoinBadge(ctx, W - 101, 122, 8.2, 2.0);
    drawComicText(ctx, `${this.gold}`, W - 54, 123, FONT_HUD_LG, '#fde047', { strokeWidth: 3.2 });

    // 3. Wave Progress / Break Countdown Pill (y = 148)
    if (this.waveActive && this.waveTotalEnemies > 0) {
      const progress = clamp(1 - (remaining / this.waveTotalEnemies), 0, 1);
      drawComicPanel(ctx, W / 2 - 82, 148, 164, 9, 5, '#0f172a', {
        lineWidth: 2.2,
        shadowDx: 0,
        shadowDy: 1.5,
        glossTop: false,
      });
      if (158 * progress >= 5) {
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.roundRect(W / 2 - 79, 150.5, 158 * progress, 4, 2);
        ctx.fill();
      }
    } else if (!this.waveActive) {
      drawComicPanel(ctx, W / 2 - 92, 145, 184, 22, 10, '#f59e0b', {
        lineWidth: 2.4,
        shadowDx: 1.5,
        shadowDy: 2,
      });
      const msg = `NEXT WAVE IN ${Math.max(0, Math.ceil(this.waveBreakTimer))}s`;
      drawComicText(ctx, msg, W / 2, 156, FONT_HUD_SM, '#ffffff', { strokeWidth: 2.8 });
    }

    // 4. Dedicated Active Titan Boss Banner
    const boss = this.zombies.find((z) => z.kind === 'titan');
    if (boss) {
      const bx = W / 2 - 110;
      const by = 164;
      const bw = 220;
      const bh = 22;
      drawComicPanel(ctx, bx, by, bw, bh, 9, '#450a0a', {
        lineWidth: 2.6,
        shadowDx: 0,
        shadowDy: 2.5,
      });
      const ratio = clamp(boss.hp / boss.maxHp, 0, 1);
      if (ratio > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(bx + 3, by + 3, Math.max(6, (bw - 6) * ratio), bh - 6, 6);
        ctx.fill();
      }
      drawComicText(ctx, `DREAD KING TITAN · ${Math.ceil(boss.hp)}`, W / 2, by + bh * 0.5 + 0.5, FONT_HUD_SM, '#fef08a', {
        strokeWidth: 2.8,
      });
    }
  }

  /* ------------------------------------------------------------- Interactive Weebl Command Dock */
  drawDockIcon(ctx, id, cx, cy, col, s = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = col;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.0;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (id === 'dmg') {
      drawComicStarburst(ctx, 0, 0, 8, 4, 7, col, STYLE_TOKENS.ink, 0.22, 2.0);
    } else if (id === 'rate') {
      ctx.beginPath();
      ctx.moveTo(2.5, -8);
      ctx.lineTo(-5, 1.2);
      ctx.lineTo(-0.4, 1.2);
      ctx.lineTo(-2.5, 8);
      ctx.lineTo(5.2, -1.4);
      ctx.lineTo(0.6, -1.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (id === 'guns') {
      ctx.beginPath();
      ctx.roundRect(-6.5, -7.5, 5, 13, 2);
      ctx.roundRect(1.5, -7.5, 5, 13, 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-8, 3.5, 16, 5, 2);
      ctx.fill();
      ctx.stroke();
    } else if (id === 'multi') {
      for (const [dx, dy] of [[-6, 2], [0, -5], [6, 2]]) {
        ctx.beginPath();
        ctx.arc(dx, dy, 3.2, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    } else if (id === 'wall') {
      ctx.beginPath();
      ctx.moveTo(-7, -7);
      ctx.lineTo(7, -7);
      ctx.lineTo(6.5, 1);
      ctx.quadraticCurveTo(4, 6, 0, 8.5);
      ctx.quadraticCurveTo(-4, 6, -6.5, 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawUpgradeDrawer(ctx, W) {
    const deckY = this.deckY;
    const deckH = Math.max(88, this.H - deckY);

    // Full-bottom arcade command deck (deckY = 682 .. H = 800, zero wasted gap)
    ctx.fillStyle = '#172033';
    ctx.fillRect(0, deckY, W, deckH);
    ctx.fillStyle = '#263552';
    ctx.fillRect(0, deckY + 2, W, 3);
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, deckY + 1);
    ctx.lineTo(W, deckY + 1);
    ctx.stroke();

    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
    const stripH = 26;

    for (const btn of this.upgradeButtons) {
      const canAfford = this.canUpgrade(btn.id);
      const cost = this.getUpgradeCost(btn.id);
      const isMax = (btn.id === 'guns' && this.gunCount >= 5) || (btn.id === 'multi' && this.multiShotLevel >= 5);

      let lvlStr = '';
      if (btn.id === 'dmg') lvlStr = `LV ${this.damageLevel}`;
      else if (btn.id === 'rate') lvlStr = `LV ${this.fireRateLevel}`;
      else if (btn.id === 'guns') lvlStr = `${this.gunCount}/5`;
      else if (btn.id === 'multi') lvlStr = `LV ${this.multiShotLevel}`;
      else if (btn.id === 'wall') lvlStr = `LV ${this.wallLevel}`;

      const lit = canAfford || isMax;
      const lift = canAfford ? 3 : 0;
      const x = btn.x;
      const y = btn.drawY - lift;
      const w = btn.w;
      const h = btn.drawH;
      const cx = x + w * 0.5;

      // Grounded hard ink drop shadow (stretches when lifted = "pressable")
      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath();
      ctx.roundRect(x, y + 4 + lift, w, h, 14);
      ctx.fill();

      // Two-tone cel body: lighter upper stage + deeper lower price shelf
      const topCol = btn.flash > 0.25 ? '#ffffff' : lit ? btn.fill : '#3b4658';
      const botCol = btn.flash > 0.25 ? '#e2e8f0' : lit ? btn.fillActive : '#2a3343';
      ctx.fillStyle = botCol;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 14);
      ctx.fill();
      ctx.fillStyle = topCol;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h - stripH, [14, 14, 4, 4]);
      ctx.fill();

      // Subtle shelf divider crease
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(x + 3, y + h - stripH - 1, w - 6, 2);

      // Cel glint along top-left edge
      if (lit && btn.flash <= 0.25) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
        ctx.beginPath();
        ctx.roundRect(x + 8, y + 4.5, w - 36, 4.5, 2.2);
        ctx.fill();
      }

      // Outer #000 ink outline (plus pulsing gold inner rim when affordable)
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 14);
      ctx.stroke();
      if (canAfford) {
        ctx.strokeStyle = `rgba(254, 240, 138, ${0.55 + pulse * 0.45})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(x + 3.2, y + 3.2, w - 6.4, h - 6.4, 11);
        ctx.stroke();
      }

      // Centered large icon + bold label (cleanly stacked with zero crowding)
      const iconCol = lit ? '#ffffff' : '#7b8799';
      this.drawDockIcon(ctx, btn.id, cx, y + 21, iconCol, 1.38);
      drawComicText(ctx, btn.label, cx, y + 45.5, FONT_DOCK_TITLE, lit ? '#ffffff' : '#9aa5b5', {
        strokeWidth: 3.4,
      });

      // Bottom price shelf: centered coin + cost (or MAX)
      const stripCenterY = y + h - stripH * 0.5;
      if (isMax) {
        drawComicText(ctx, 'MAX', cx, stripCenterY + 0.5, FONT_DOCK_COST, '#4ade80', { strokeWidth: 3.2 });
      } else {
        const costStr = `${cost}`;
        ctx.save();
        ctx.font = FONT_DOCK_COST;
        const textW = Math.max(12, ctx.measureText(costStr).width);
        ctx.restore();
        const coinR = 7.2;
        const gap = 4.5;
        const totalW = coinR * 2 + gap + textW;
        const groupLeft = cx - totalW * 0.5;
        drawGoldCoinBadge(ctx, groupLeft + coinR, stripCenterY, coinR, 1.9);
        drawComicText(
          ctx,
          costStr,
          groupLeft + coinR * 2 + gap + textW * 0.5,
          stripCenterY + 0.5,
          FONT_DOCK_COST,
          canAfford ? '#fde047' : '#94a3b8',
          { strokeWidth: 3.2 }
        );
      }

      // Level tab badge hanging cleanly off the top-right corner
      const tabW = 36;
      const tabH = 15;
      const tabX = x + w - tabW + 3;
      const tabY = y - 7;
      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath();
      ctx.roundRect(tabX, tabY + 1.8, tabW, tabH, 7.5);
      ctx.fill();
      ctx.fillStyle = isMax ? '#16a34a' : '#0f172a';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(tabX, tabY, tabW, tabH, 7.5);
      ctx.fill();
      ctx.stroke();
      drawComicText(ctx, lvlStr, tabX + tabW * 0.5, tabY + tabH * 0.5 + 0.5, FONT_DOCK_SUB, '#ffffff', {
        strokeWidth: 0.01,
      });
    }
  }
}
