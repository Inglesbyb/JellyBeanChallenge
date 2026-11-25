// Boss Prototype V5: Lord Brim's Citadel Siege (HD Flash Cel-Cartoon Edition)
// Unified Single Resource (Scrap) + Swinging Hammer & Anvil Forging + Angry Birds Camera + Puppet-Rigged Lord Brim
import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import {
  STYLE_TOKENS,
  PEDESTAL_GEO,
  SLING_GEO,
  getPedestalSlotPos,
  getSlingHornPoints,
  preloadWeeblAtlas,
  getSprite,
  drawSprite,
  drawWoodTrussTile,
  drawStoneCrackOverlay,
  drawSunburst,
  drawComicPanel,
  drawComicStarburst,
  drawComicText,
  drawHeroCharacter,
} from './weeblAtlas.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

const WORLD_W = 880;
const GROUND_Y = 582;
const SLING = { x: 108, y: 502 };
const GRAVITY = 780;

const AMMO_META = {
  boulder: { id: 'boulder', label: 'ROCK', cost: 8, r: 16, dmg: 50, color: '#94a3b8', accent: '#f8fafc', tip: 'TAP MID-AIR: METEOR SLAM!' },
};

const MAT_STYLE = {
  wood:     { fill: '#d97706', rim: '#fbbf24', grain: '#92400e', hp: 65 },
  glass:    { fill: '#38bdf8', rim: '#bae6fd', grain: '#0284c7', hp: 28 },
  stone:    { fill: '#64748b', rim: '#cbd5e1', grain: '#334155', hp: 140 },
  obsidian: { fill: '#312e81', rim: '#818cf8', grain: '#1e1b4b', hp: 195 },
  spire:    { fill: '#6d28d9', rim: '#fde047', grain: '#4c1d95', hp: 72 },
  tnt:      { fill: '#ef4444', rim: '#fde047', grain: '#991b1b', hp: 14 },
  crate:    { fill: '#f59e0b', rim: '#fef08a', grain: '#78350f', hp: 24 },
};

// Normalized key light for real-time 3D Lord Brim mesh
const L_RAW = [-0.48, -0.62, 0.62];
const L_LEN = Math.hypot(L_RAW[0], L_RAW[1], L_RAW[2]);
const LIGHT = [L_RAW[0] / L_LEN, L_RAW[1] / L_LEN, L_RAW[2] / L_LEN];

function litColor(rgb, nx, ny, nz, specPow = 18, specAmt = 0.45) {
  const nl = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
  const hx = LIGHT[0], hy = LIGHT[1], hz = LIGHT[2] + 1;
  const hLen = Math.hypot(hx, hy, hz) || 1;
  const nh = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
  const spec = Math.pow(nh, specPow) * specAmt;
  const rim = Math.pow(clamp(1 - Math.abs(nz), 0, 1), 2.5) * 0.25;
  const diff = 0.26 + nl * 0.74;
  const r = clamp(Math.round(rgb[0] * diff + 255 * spec + 140 * rim), 0, 255);
  const g = clamp(Math.round(rgb[1] * diff + 245 * spec + 60 * rim), 0, 255);
  const b = clamp(Math.round(rgb[2] * diff + 255 * spec + 220 * rim), 0, 255);
  return `rgb(${r},${g},${b})`;
}

export class CitadelSiegeBoss extends Game {
  static meta = {
    id: 'citadel-siege-boss',
    title: "Lord Brim's Citadel",
    icon: '🏰',
    hint: 'STRIKE Hammer & Anvil for Scrap · SPEND Scrap on Ammo OR Walls · CRUSH Lord Brim!',
    baseLikes: 7200,
    isPrestige: true,
    parScore60s: 3600,
    roundLen: 60,
    cue: 'SHATTER LORD BRIM’S CITADEL!',
    prestigeCue: 'TOUGHER WALLS · FIERCER SPELLS!',
    scaling: {
      bossSpeed: { base: 1.0, rate: 0.14, cap: 1.4, mode: 'up', label: 'Siege Pace' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.freezeTimer = true;

    // SINGLE UNIFIED RESOURCE: SCRAP!
    this.scrap = 30;
    this.hearts = 5;
    this.maxHearts = 5;
    this.playerHurtT = 0;
    this.hitstopT = 0;

    // Angry Birds Camera (Locked at 0 on player; swipes map; follows shot ONLY when shooting)
    this.camX = 0;
    this.targetCamX = 0;
    this.panning = false;
    this.panStartX = 0;
    this.panStartCamX = 0;
    this.panHoldT = 0;
    this.camHoldAfterShotT = 0;

    // Selectable Ammo Magazine (starts with 1 starter boulder ready, rest must be crafted with Scrap!)
    this.ammoQueue = ['boulder'];
    this.maxAmmo = 5;
    this.selectedAmmoIdx = 0;

    // Hammer & Anvil Timing Forge State
    this.hammerPhase = 0;
    this.anvilCd = 0;
    this.hammerSlamT = 0;
    this.anvilSquash = 0;
    this.anvilFlash = 0;
    this.heatStreak = 0;
    this.anvilMsg = 'HIT GOLD FOR +SCRAP!';

    // Slingshot Aiming + Previous Shot Ghost Arc
    this.aiming = false;
    this.grabX = SLING.x;
    this.grabY = SLING.y;
    this.pullX = 0;
    this.pullY = 0;
    this.lastShotArc = [];

    this.shots = [];
    this.enemyShots = [];
    this.imps = [];      // Balloon Imp minions drifting across moat!
    this.impSpawnT = 3.2;
    this.bolts = [];     // Shadow lightning column strikes!
    this.boltCd = 5.0;
    this.crates = [];
    this.crateSpawnT = 6.0;
    this.flyingScrap = [];
    this.stats = { shotsFired: 0, blocksSmashed: 0 };

    // Ambient Environment Layers (Stars, Drifting Toy Clouds, Volcanic Lava Embers)
    this.stars = Array.from({ length: 30 }, () => ({
      x: rand(0, WORLD_W),
      y: rand(80, 320),
      r: rand(0.9, 2.2),
      tw: rand(0, TAU),
    }));
    this.clouds = Array.from({ length: 7 }, (_, i) => ({
      x: i * 160 + rand(-20, 20),
      y: rand(120, 290),
      w: rand(68, 125),
      spd: rand(6, 15),
    }));
    this.embers = Array.from({ length: 18 }, () => ({
      x: rand(292, 460),
      y: rand(390, GROUND_Y),
      vy: rand(24, 58),
      r: rand(1.6, 3.6),
      ph: rand(0, TAU),
    }));

    // Edge-triggered key tracking
    this.prevKeys = {};

    // Player Base Multi-Part Stone Castle Perimeter (`X=28..250`) + Multi-Slot Roof (`this.canopies`)
    this.playerBlocks = [
      { slot: 'front', tier: 0, x: 250, y: GROUND_Y - 23, w: 38, h: 46, hp: 190, maxHp: 190, mat: 'stone', shape: 'pillar' },
      { slot: 'rear',  tier: 0, x: 28,  y: GROUND_Y - 23, w: 38, h: 46, hp: 190, maxHp: 190, mat: 'stone', shape: 'pillar' },
    ];
    this.canopies = [];
    preloadWeeblAtlas();

    // 3D Lord Brim inside Knock-Downable Citadel (`X=520..850`)
    this.boss = {
      x: 705,
      baseX: 705,
      y: GROUND_Y - 172,
      vx: 0,
      vy: 0,
      r: 38,
      hp: 100,
      maxHp: 100,
      phase: 1,
      hurtFlash: 0,
      castT: 0,
      volleyCd: 3.0,
      dashCd: 0.55,
      patrolDir: -1,
      enraged2Fired: false,
      enraged3Fired: false,
      yaw: -0.32,
      pitch: 0.08,
    };

    // Disembodied 3D Floating Hands
    this.hands = [
      { id: 0, side: -1, ox: -92, oy: 12, oz: 26, x: 613, y: 472, z: 26, r: 22, stunT: 0, flash: 0, bob: 0, slamT: 0 },
      { id: 1, side: 1,  ox: 78,  oy: -10, oz: 18, x: 783, y: 450, z: 18, r: 22, stunT: 0, flash: 0, bob: 1.9, slamT: 0 },
    ];

    this.blocks = [];
    this.buildBossCitadel();

    // Restore partial encounter state if paused/switched mid-fight without clearing boss
    if (saved && typeof saved === 'object') {
      if (Number.isFinite(saved.bossHp) && saved.bossHp > 0) {
        this.boss.hp = clamp(saved.bossHp, 1, this.boss.maxHp);
        this.boss.phase = this.boss.hp > 66 ? 1 : this.boss.hp > 33 ? 2 : 3;
      }
      if (Number.isFinite(saved.scrap)) this.scrap = Math.max(0, Math.round(saved.scrap));
      if (Number.isFinite(saved.hearts) && saved.hearts > 0) {
        this.hearts = clamp(Math.round(saved.hearts), 1, this.maxHearts);
      }
    }

    // Detect Reel #hud overlay so floating Hearts & Scrap sit cleanly below timer & badge in main game
    this.hasReelHud = typeof document !== 'undefined' && typeof document.getElementById === 'function' && Boolean(document.getElementById('hud') && document.getElementById('prestigeBadge'));

    // Screen UI Hitboxes (`Bottom Y=620..800`: Single Streamlined Shop Row + Huge Forge Anvil Pit!)
    this.ui = {
      backSling: { x: 18,  y: this.hasReelHud ? 138 : 78,  w: 112, h: 32 },
      // Single Unified Shop Row (`ROCK` | `STONE` | `ROOF/+`)
      buyRock:   { x: 14,  y: 621, w: 134, h: 38 },
      stone:     { x: 158, y: 621, w: 134, h: 38 },
      canopy:    { x: 302, y: 621, w: 134, h: 38 },
      // Enlarged Profound Hammer & Anvil Forge Console (`129px` tall!)
      anvil:     { x: 14,  y: 665, w: 422, h: 129 },
    };
  }

  addBlock(x, y, w, h, mat, shape = 'wall') {
    const st = MAT_STYLE[mat];
    this.blocks.push({
      x, y, w, h,
      vx: 0, vy: 0,
      rot: 0, vrot: 0,
      hp: st.hp,
      maxHp: st.hp,
      mat,
      shape,
      hitCd: 0,
      dead: false,
    });
  }

  buildBossCitadel() {
    const G = GROUND_Y;
    // 100% KNOCK-DOWNABLE MULTI-TOWER DARK CASTLE (every stone, arch, battlement & spire has full physics!)
    // 1. West Gatehouse Tower (`X = 520..574`)
    this.addBlock(520, G - 48, 24, 96, 'obsidian', 'pillar');
    this.addBlock(574, G - 48, 24, 96, 'obsidian', 'pillar');
    this.addBlock(547, G - 107, 84, 22, 'stone', 'battlement');
    this.addBlock(529, G - 144, 20, 52, 'wood', 'pillar');
    this.addBlock(565, G - 144, 20, 52, 'glass', 'wall');
    this.addBlock(547, G - 180, 68, 20, 'stone', 'battlement');
    this.addBlock(547, G - 224, 64, 68, 'spire', 'spire');

    // 2. Gatehouse Courtyard Bastion (`X = 608`)
    this.addBlock(608, G - 36, 26, 72, 'stone', 'pillar');
    this.addBlock(608, G - 88, 32, 32, 'crate', 'crate');

    // 3. Central Multi-Tiered Grand Demon Keep housing Lord Brim (`X = 646..764`)
    this.addBlock(646, G - 52, 26, 104, 'obsidian', 'pillar');
    this.addBlock(764, G - 52, 26, 104, 'obsidian', 'pillar');
    this.addBlock(705, G - 17, 30, 34, 'tnt', 'tnt');
    this.addBlock(705, G - 116, 148, 24, 'stone', 'battlement');
    this.addBlock(646, G - 178, 22, 100, 'glass', 'wall');
    this.addBlock(764, G - 178, 22, 100, 'wood', 'pillar');
    this.addBlock(705, G - 239, 152, 22, 'obsidian', 'battlement');
    this.addBlock(649, G - 266, 28, 32, 'crate', 'crate');
    this.addBlock(761, G - 266, 28, 32, 'obsidian', 'battlement');
    this.addBlock(705, G - 294, 68, 88, 'spire', 'spire');

    // 4. East Dark Watchtower Vault & Spire (`X = 798..846`)
    this.addBlock(798, G - 46, 22, 92, 'stone', 'pillar');
    this.addBlock(846, G - 46, 22, 92, 'obsidian', 'pillar');
    this.addBlock(822, G - 102, 76, 20, 'wood', 'wall');
    this.addBlock(801, G - 134, 16, 44, 'stone', 'pillar');
    this.addBlock(843, G - 134, 16, 44, 'stone', 'pillar');
    this.addBlock(822, G - 128, 22, 32, 'tnt', 'tnt');
    this.addBlock(822, G - 166, 68, 20, 'obsidian', 'battlement');
    this.addBlock(822, G - 210, 62, 68, 'spire', 'spire');
  }

  serialize() {
    return { bossHp: this.boss.hp, scrap: this.scrap, hearts: this.hearts };
  }

  restoreLabel() {
    return `Lord Brim ${Math.ceil(this.boss.hp)}%`;
  }

  inRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  pedestalSlotPos(queueIdx) {
    // 5 sockets locked pixel-accurately onto the stone_bastion_pedestal.png holes
    return getPedestalSlotPos(queueIdx);
  }

  justPressedKey(k) {
    const down = this.input.key(k);
    const prev = !!this.prevKeys[k];
    this.prevKeys[k] = down;
    return down && !prev;
  }

  // Hammer & Anvil Resource Generator (Hammer hitting anvil = Sweet Spot; further backswing = least Scrap!)
  strikeAnvil() {
    if (this.anvilCd > 0) return;
    this.anvilCd = 0.56;
    this.hammerSlamT = 1.0;
    this.anvilSquash = 1.0;
    this.anvilFlash = 1.0;

    // 0 = Hammer head squarely striking anvil ingot; 1 = Full raised backswing (furthest away!)
    const backFrac = 0.5 - 0.5 * Math.cos(this.hammerPhase * TAU);

    let baseScrap = Math.max(2, Math.round(9 - ((backFrac - 0.42) / 0.58) * 7));
    let grade = backFrac > 0.78 ? 'FAR BACKSWING' : 'EARLY SWING';
    let col = '#94a3b8';

    if (backFrac <= 0.16) {
      this.heatStreak = Math.min(4, this.heatStreak + 1);
      const mult = this.heatStreak >= 2 ? 1.5 : 1.0;
      baseScrap = Math.round(24 * mult);
      grade = this.heatStreak >= 2 ? `WHITE-HOT x${this.heatStreak}!` : 'ANVIL STRIKE!';
      col = '#fde047';
      this.fx.shake(6, 0.2);
      this.sounds.up?.();
      this.haptics.heavy?.();
    } else if (backFrac <= 0.42) {
      this.heatStreak = Math.min(4, this.heatStreak + 1);
      const raw = 18 - ((backFrac - 0.16) / 0.26) * 7;
      const mult = this.heatStreak >= 3 ? 1.25 : 1.0;
      baseScrap = Math.round(raw * mult);
      grade = 'WARM CLANG!';
      col = '#fb923c';
      this.sounds.gate?.(true);
      this.haptics.medium?.();
    } else {
      this.heatStreak = 0;
      this.sounds.stack?.(0.85);
      this.haptics.light?.();
    }

    this.scrap += baseScrap;
    this.anvilMsg = `${grade} +${baseScrap}`;
    this.fx.text(225, 606, `${grade} +${baseScrap} SCRAP`, col, 15, 0.85);
    this.fx.burst(215, 742, col, backFrac <= 0.42 ? 16 : 5, 160, 0.42, 3.2);
  }

  // Spend Scrap -> Craft Selected Ammo
  craftAmmo(type) {
    const am = AMMO_META[type];
    if (!am) return;
    if (this.ammoQueue.length >= this.maxAmmo) {
      this.fx.text(225, 602, 'AMMO RACK FULL (MAX 5)!', '#fde047', 14, 0.85);
      this.sounds.drop?.();
      return;
    }
    if (this.scrap < am.cost) return this.needScrap(am.cost);

    this.scrap -= am.cost;
    this.ammoQueue.push(type);
    this.selectedAmmoIdx = this.ammoQueue.length - 1; // Select newly forged ammo immediately!
    this.fx.text(130, 560, `+${am.label} CRAFTED!`, am.accent, 15, 0.85);
    this.sounds.merge?.(1.15);
    this.haptics.light?.();
  }

  getPlayerCastleBlueprint() {
    const G = GROUND_Y;
    return [
      { slot: 'front', tier: 0, x: 250, y: G - 23,  w: 38, h: 46, shape: 'pillar' },
      { slot: 'rear',  tier: 0, x: 28,  y: G - 23,  w: 38, h: 46, shape: 'pillar' },
      { slot: 'front', tier: 1, x: 250, y: G - 69,  w: 36, h: 46, shape: 'wall' },
      { slot: 'mid',   tier: 0, x: 196, y: G - 23,  w: 36, h: 46, shape: 'pillar' },
      { slot: 'rear',  tier: 1, x: 28,  y: G - 69,  w: 36, h: 46, shape: 'wall' },
      { slot: 'front', tier: 2, x: 250, y: G - 112, w: 42, h: 40, shape: 'battlement' },
      { slot: 'mid',   tier: 1, x: 196, y: G - 69,  w: 34, h: 46, shape: 'wall' },
      { slot: 'rear',  tier: 2, x: 28,  y: G - 112, w: 42, h: 40, shape: 'battlement' },
      { slot: 'mid',   tier: 2, x: 196, y: G - 111, w: 38, h: 38, shape: 'battlement' },
      { slot: 'front', tier: 3, x: 250, y: G - 156, w: 40, h: 48, shape: 'spire' },
      { slot: 'rear',  tier: 3, x: 28,  y: G - 156, w: 40, h: 48, shape: 'spire' },
    ];
  }

  findNextPlayerSlot() {
    const bp = this.getPlayerCastleBlueprint();
    return bp.find((s) => !this.playerBlocks.some((b) => b.slot === s.slot && b.tier === s.tier)) || null;
  }

  getRoofSlotsBlueprint() {
    return [
      { slot: 'front',  x: 224, y: 396, w: 88, h: 24, maxHp: 145 },
      { slot: 'rear',   x: 66,  y: 396, w: 92, h: 24, maxHp: 145 },
      { slot: 'center', x: 146, y: 392, w: 72, h: 28, maxHp: 175 },
    ];
  }

  // Spend Scrap -> Build / Repair Multi-Part Stone Castle & Multi-Slot Castle Roof!
  buildPlayerFort(kind) {
    if (kind === 'stone') {
      if (this.scrap < 22) return this.needScrap(22);
      const nextSlot = this.findNextPlayerSlot();
      const dmg = this.playerBlocks
        .filter((b) => b.hp < b.maxHp)
        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      if (dmg && (!nextSlot || dmg.hp < dmg.maxHp * 0.55)) {
        this.scrap -= 22;
        dmg.hp = dmg.maxHp;
        this.fx.text(160, 490, 'MASONRY PATCHED!', '#cbd5e1', 15, 0.85);
        this.sounds.merge?.(1.1);
        this.haptics.medium?.();
        return;
      }
      if (!nextSlot) {
        this.fx.text(160, 490, 'CASTLE MAXED IN STONE!', '#cbd5e1', 14, 0.85);
        return;
      }
      this.scrap -= 22;
      const hp = nextSlot.shape === 'spire' || nextSlot.shape === 'battlement' ? 215 : 190;
      this.playerBlocks.push({ ...nextSlot, hp, maxHp: hp, mat: 'stone' });
      const tag = nextSlot.shape === 'spire' ? '+STONE SPIRE!' : nextSlot.shape === 'battlement' ? '+STONE CRENEL!' : '+STONE KEEP!';
      this.fx.text(155, 490, tag, '#cbd5e1', 15, 0.9);
      this.sounds.merge?.(1.1);
      this.haptics.medium?.();
    } else if (kind === 'canopy') {
      if (this.scrap < 28) return this.needScrap(28);
      const bp = this.getRoofSlotsBlueprint();
      const nextRoof = bp.find((s) => !this.canopies.some((c) => c.slot === s.slot));
      const dmgRoof = this.canopies
        .filter((c) => c.hp < c.maxHp)
        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];

      if (dmgRoof && (!nextRoof || dmgRoof.hp < dmgRoof.maxHp * 0.6)) {
        this.scrap -= 28;
        dmgRoof.hp = dmgRoof.maxHp;
        this.fx.text(dmgRoof.x, 375, 'ROOF SECTION PATCHED!', '#38bdf8', 15, 0.9);
        this.sounds.gate?.(true);
        this.haptics.medium?.();
      } else if (nextRoof) {
        this.scrap -= 28;
        this.canopies.push({ ...nextRoof, hp: nextRoof.maxHp });
        const names = { front: 'FRONT GATE ROOF!', rear: 'WEST KEEP ROOF!', center: 'CROWN CUPOLA COMPLETE!' };
        this.fx.text(nextRoof.x, 375, `+${names[nextRoof.slot]}`, '#38bdf8', 15, 0.95);
        this.sounds.gate?.(true);
        this.haptics.medium?.();
      } else if (this.hearts < this.maxHearts) {
        this.scrap -= 28;
        this.hearts = Math.min(this.maxHearts, this.hearts + 1);
        this.fx.text(140, 460, '+1 HEART RESTORED!', '#3dffa2', 16, 0.95);
        this.sounds.up?.();
      } else {
        this.fx.text(140, 440, 'ALL 3 ROOFS & HEARTS FULL!', '#38bdf8', 14, 0.85);
      }
    }
  }

  needScrap(cost) {
    this.fx.text(225, 608, `NEED ${cost} SCRAP — STRIKE ANVIL!`, '#fb7185', 14, 0.85);
    this.sounds.slice?.();
  }

  update(dt) {
    if (this.hitstopT > 0) {
      this.hitstopT -= dt;
      this.fx.update(dt * 0.45);
      return;
    }

    const scale = this.diff.bossSpeed ?? 1;
    this.hammerPhase = (this.hammerPhase + dt * 0.78) % 1;
    this.anvilCd = Math.max(0, this.anvilCd - dt);
    this.hammerSlamT = Math.max(0, this.hammerSlamT - dt * 5.5);
    this.anvilSquash = Math.max(0, this.anvilSquash - dt * 6);
    this.anvilFlash = Math.max(0, this.anvilFlash - dt * 3.5);
    this.playerHurtT = Math.max(0, this.playerHurtT - dt);
    this.boss.hurtFlash = Math.max(0, this.boss.hurtFlash - dt * 4);
    this.boss.castT = Math.max(0, this.boss.castT - dt);
    this.camHoldAfterShotT = Math.max(0, this.camHoldAfterShotT - dt);
    if (!this.panning) this.panHoldT = Math.max(0, this.panHoldT - dt);

    // Edge-triggered keyboard shortcuts
    if (this.justPressedKey(' ')) this.strikeAnvil();
    if (this.justPressedKey('q')) this.craftAmmo('boulder');
    if (this.justPressedKey('1') || this.justPressedKey('2')) this.buildPlayerFort('stone');
    if (this.justPressedKey('3')) this.buildPlayerFort('canopy');

    // 1. Pointer Handling
    if (this.input.pressed) {
      const ix = this.input.x;
      const iy = this.input.y;
      let handled = false;

      // Pedestal In-World Ammo Swapper (only when viewing player slingshot!)
      if (this.camX < 50) {
        for (let i = 0; i < this.ammoQueue.length; i++) {
          const sp = this.pedestalSlotPos(i);
          if (Math.hypot(ix + this.camX - sp.x, iy - sp.y) <= 13) {
            this.selectedAmmoIdx = i;
            this.sounds.bubble?.(1.2);
            handled = true;
            break;
          }
        }
      }

      if (!handled) {
        if (this.camX > 50 && this.inRect(ix, iy, this.ui.backSling)) {
          this.targetCamX = 0;
          this.panHoldT = 0;
          handled = true;
        } else if (this.inRect(ix, iy, this.ui.anvil))   { this.strikeAnvil(); handled = true; }
        else if (this.inRect(ix, iy, this.ui.buyRock)) { this.craftAmmo('boulder'); handled = true; }
        else if (this.inRect(ix, iy, this.ui.stone))   { this.buildPlayerFort('stone'); handled = true; }
        else if (this.inRect(ix, iy, this.ui.canopy))  { this.buildPlayerFort('canopy'); handled = true; }
      }

      if (!handled) {
        const wx = ix + this.camX;
        for (let i = this.crates.length - 1; i >= 0; i--) {
          const c = this.crates[i];
          if (Math.hypot(wx - c.x, iy - c.y) < 42) {
            this.collectCrate(c, i);
            handled = true;
            break;
          }
        }
      }

      if (!handled) {
        const activeShot = this.shots.find((s) => !s.abilityUsed && s.age > 0.14);
        if (activeShot) {
          this.triggerMidAirAbility(activeShot);
          this.aiming = false;
          this.panning = false;
        } else if (iy < 620) {
          const wx = ix + this.camX;
          const nearSlingshot = Math.hypot(wx - SLING.x, iy - SLING.y) <= 105;
          if (nearSlingshot && this.camX < 85) {
            if (this.ammoQueue.length > 0) {
              this.aiming = true;
              this.panning = false;
              this.grabX = ix;
              this.grabY = iy;
              this.pullX = 0;
              this.pullY = 0;
            } else {
              this.fx.text(225, 550, 'NO AMMO — CRAFT WITH SCRAP BELOW!', '#fde047', 14, 0.9);
              this.sounds.drop?.();
            }
          } else {
            this.panning = true;
            this.aiming = false;
            this.panStartX = ix;
            this.panStartCamX = this.camX;
            this.panHoldT = 3.2;
          }
        }
      } else {
        this.aiming = false;
        this.panning = false;
      }
    }

    if (this.panning && this.input.down) {
      const dx = this.input.x - this.panStartX;
      this.camX = clamp(this.panStartCamX - dx, 0, WORLD_W - this.W);
      this.targetCamX = this.camX;
      this.panHoldT = 3.2;
    }

    if (this.aiming && this.input.down) {
      let dx = this.grabX - this.input.x;
      let dy = this.grabY - this.input.y;
      const dist = Math.hypot(dx, dy);
      const maxPull = 128;
      if (dist > maxPull) {
        dx = (dx / dist) * maxPull;
        dy = (dy / dist) * maxPull;
      }
      this.pullX = clamp(dx, -20, maxPull);
      this.pullY = clamp(dy, -maxPull, 45);
    }

    if (this.input.released) {
      this.panning = false;
      if (this.aiming) {
        this.aiming = false;
        const mag = Math.hypot(this.pullX, this.pullY);
        if (mag >= 22 && this.ammoQueue.length > 0) {
          const idx = clamp(this.selectedAmmoIdx, 0, this.ammoQueue.length - 1);
          const type = this.ammoQueue.splice(idx, 1)[0];
          this.selectedAmmoIdx = clamp(this.selectedAmmoIdx, 0, Math.max(0, this.ammoQueue.length - 1));
          const meta = AMMO_META[type];
          const power = clamp(mag / 128, 0.3, 1) * 900;
          const ang = Math.atan2(this.pullY, this.pullX);
          this.stats.shotsFired += 1;
          this.shots.push({
            type,
            x: SLING.x,
            y: SLING.y,
            vx: Math.cos(ang) * power,
            vy: Math.sin(ang) * power,
            r: meta.r,
            dmg: meta.dmg,
            rot: 0,
            vrot: 6,
            age: 0,
            abilityUsed: false,
            bouncesLeft: type === 'boulder' ? 2 : 1,
            trail: [],
            recordedArc: [{ x: SLING.x, y: SLING.y }],
            arcSampleT: 0,
            impacts: 0,
          });
          this.fx.burst(SLING.x - this.camX, SLING.y, meta.accent, 10, 150, 0.4, 3);
          this.sounds.slice?.();
          this.haptics.medium?.();
        }
        this.pullX = 0;
        this.pullY = 0;
      }
    }

    // 2. Angry Birds Camera Update
    if (this.shots.length > 0) {
      this.targetCamX = clamp(this.shots[0].x - 175, 0, WORLD_W - this.W);
      this.camHoldAfterShotT = 1.35;
      this.panHoldT = 0;
    } else if (this.camHoldAfterShotT > 0) {
      // keep viewing collapsing boss towers
    } else if (this.panning || this.panHoldT > 0) {
      // stay where user swiped
    } else {
      this.targetCamX = 0;
    }
    if (!this.panning) {
      this.camX += (this.targetCamX - this.camX) * Math.min(1, dt * 6.2);
    }

    // 3. Parachute Supply Crates (+Scrap!)
    this.crateSpawnT -= dt;
    if (this.crateSpawnT <= 0 && this.crates.length < 2) {
      this.crateSpawnT = rand(6.8, 10.0);
      this.crates.push({ x: rand(265, 425), y: 90, vy: 36, sway: rand(0, TAU) });
    }
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.sway += dt * 2.5;
      c.y += c.vy * dt;
      c.x += Math.sin(c.sway) * 26 * dt;
      if (c.y > GROUND_Y + 25) this.crates.splice(i, 1);
    }

    // 4. Flying Player Projectiles + Ghost Arc Recording
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.age += dt;
      s.arcSampleT += dt;
      if (s.impacts === 0 && s.arcSampleT >= 0.055 && s.recordedArc.length < 38) {
        s.arcSampleT = 0;
        s.recordedArc.push({ x: s.x, y: s.y });
      }
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 10) s.trail.shift();

      s.vy += GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.vrot * dt;

      for (let ci = this.crates.length - 1; ci >= 0; ci--) {
        const c = this.crates[ci];
        if (Math.hypot(s.x - c.x, s.y - c.y) < s.r + 22) this.collectCrate(c, ci);
      }

      // Snipe Balloon Imps mid-air (+Scrap!)
      for (let ii = this.imps.length - 1; ii >= 0; ii--) {
        const imp = this.imps[ii];
        if (Math.hypot(s.x - imp.x, s.y - imp.y) < s.r + imp.r) {
          this.fx.burst(imp.x - this.camX, imp.y, '#c084fc', 14, 175, 0.45, 3.5);
          this.flyingScrap.push({ x: imp.x - this.camX, y: imp.y, t: 0, amount: 12 });
          this.imps.splice(ii, 1);
          this.sounds.chomp?.();
        }
      }

      // Hit Lord Brim's Floating Hands
      let deflectedByHand = false;
      for (const h of this.hands) {
        const hd = Math.hypot(s.x - h.x, s.y - h.y);
        if (hd < s.r + h.r) {
          h.flash = 1.0;
          s.impacts += 1;
          this.lastShotArc = s.recordedArc;
          if (h.stunT <= 0) {
            h.stunT = 2.2;
            this.flyingScrap.push({ x: h.x - this.camX, y: h.y, t: 0, amount: 12 });
            this.fx.text(h.x - this.camX, h.y - 32, 'HAND DAZED! +12!', '#fde047', 16, 0.95);
            if (this.boss.phase >= 2 && s.type !== 'bomb') {
              s.vx = -Math.abs(s.vx) * 0.45;
              s.vy = -190;
              this.sounds.drop?.();
              deflectedByHand = true;
              break;
            }
          }
          if (s.type === 'bomb') {
            this.explodeAt(s.x, s.y, 136, 112);
            this.shots.splice(i, 1);
            deflectedByHand = true;
            break;
          }
        }
      }
      if (deflectedByHand) continue;

      // Hit Lord Brim Direct
      const bd = Math.hypot(s.x - this.boss.x, s.y - this.boss.y);
      if (bd < s.r + this.boss.r) {
        s.impacts += 1;
        this.lastShotArc = s.recordedArc;
        if (s.type === 'bomb') {
          this.explodeAt(s.x, s.y, 136, 34);
          this.shots.splice(i, 1);
          continue;
        }
        const speedFactor = clamp(Math.hypot(s.vx, s.vy) / 550, 0.65, 1.5);
        this.damageBoss(Math.round(s.dmg * 0.45 * speedFactor));
        const nx = (s.x - this.boss.x) / (bd || 1);
        const ny = (s.y - this.boss.y) / (bd || 1);
        s.vx = nx * 220;
        s.vy = ny * 220;
        s.bouncesLeft -= 1;
        if (s.bouncesLeft <= 0) { this.shots.splice(i, 1); continue; }
      }

      // Hit Boss Citadel Blocks
      let removed = false;
      for (const blk of this.blocks) {
        if (blk.dead) continue;
        if (this.circleRectHit(s.x, s.y, s.r, blk)) {
          s.impacts += 1;
          this.lastShotArc = s.recordedArc;
          if (s.type === 'bomb') {
            this.explodeAt(s.x, s.y, 136, 118);
            this.shots.splice(i, 1);
            removed = true;
            break;
          }
          const spd = Math.hypot(s.vx, s.vy);
          const rawDmg = s.dmg * clamp(spd / 520, 0.65, 1.45);
          const matMult = blk.mat === 'glass' ? 2.0 : blk.mat === 'stone' && s.type === 'boulder' ? 1.3 : 1.0;
          blk.hp -= rawDmg * matMult;
          blk.vx += clamp(s.vx * 0.28, -195, 195);
          blk.vy += clamp(s.vy * 0.18, -140, 120);
          blk.vrot += (s.vx >= 0 ? 1 : -1) * rand(2.5, 5.5);
          this.sounds.chomp?.();

          if (blk.hp <= 0) {
            this.destroyBlock(blk);
            s.vx *= 0.74;
            s.vy *= 0.74;
          } else {
            s.vx *= -0.32;
            s.vy *= 0.5;
            s.bouncesLeft -= 1;
          }
          if (s.bouncesLeft <= 0 || Math.hypot(s.vx, s.vy) < 110) {
            this.shots.splice(i, 1);
            removed = true;
          }
          break;
        }
      }
      if (removed) continue;

      if (s.y + s.r >= GROUND_Y) {
        s.y = GROUND_Y - s.r;
        this.lastShotArc = s.recordedArc;
        if (s.type === 'bomb') {
          this.explodeAt(s.x, s.y, 128, 108);
          this.shots.splice(i, 1);
          continue;
        }
        s.vy = -Math.abs(s.vy) * 0.42;
        s.vx *= 0.65;
        s.bouncesLeft -= 1;
        if (s.bouncesLeft < 0 || Math.hypot(s.vx, s.vy) < 95) {
          this.shots.splice(i, 1);
          continue;
        }
      }
      if (s.x > WORLD_W + 70 || s.x < -70) {
        this.lastShotArc = s.recordedArc;
        this.shots.splice(i, 1);
      }
    }

    // 5. Overhang Toppling Block Physics, 3D Boss Spells & Imp Minions, Counter-Shots
    this.updateBossBlocks(dt);
    this.updateBossAI(dt, scale);
    this.updateEnemyHazards(dt, scale);

    for (let i = this.flyingScrap.length - 1; i >= 0; i--) {
      const fs = this.flyingScrap[i];
      fs.t += dt * 2.2;
      if (fs.t >= 1) {
        this.scrap += fs.amount;
        this.flyingScrap.splice(i, 1);
      }
    }

    // Update atmospheric clouds & rising volcanic lava embers
    for (const c of this.clouds) {
      c.x += c.spd * dt;
      if (c.x > WORLD_W + 140) c.x = -140;
    }
    for (const em of this.embers) {
      em.ph += dt * 4;
      em.y -= em.vy * dt;
      em.x += Math.sin(em.ph) * 14 * dt;
      if (em.y < 360) {
        em.y = GROUND_Y + 4;
        em.x = rand(294, 458);
      }
    }

    this.fx.update(dt);
  }

  triggerMidAirAbility(s) {
    s.abilityUsed = true;
    const sx = s.x - this.camX;
    if (s.type === 'boulder') {
      s.vx = Math.max(240, s.vx * 0.75);
      s.vy = 780;
      s.dmg = 78;
      this.fx.ring(sx, s.y, '#fb923c', 80, 0.35, 4);
      this.fx.text(sx, s.y - 24, 'METEOR SLAM!', '#fb923c', 17, 0.8);
      this.sounds.slice?.();
    } else if (s.type === 'bomb') {
      this.lastShotArc = s.recordedArc;
      this.explodeAt(s.x, s.y, 148, 125);
      const idx = this.shots.indexOf(s);
      if (idx >= 0) this.shots.splice(idx, 1);
    } else if (s.type === 'cluster') {
      this.lastShotArc = s.recordedArc;
      const idx = this.shots.indexOf(s);
      if (idx >= 0) this.shots.splice(idx, 1);
      for (const dy of [-115, 0, 115]) {
        this.shots.push({
          type: 'cluster',
          x: s.x,
          y: s.y,
          vx: s.vx * 1.05,
          vy: s.vy + dy,
          r: 12,
          dmg: 36,
          rot: 0,
          vrot: 9,
          age: 0.5,
          abilityUsed: true,
          bouncesLeft: 1,
          trail: [],
          recordedArc: s.recordedArc,
          arcSampleT: 0,
          impacts: 1,
        });
      }
      this.fx.ring(sx, s.y, '#c084fc', 95, 0.4, 5);
      this.fx.text(sx, s.y - 26, 'TRIPLE SPLIT!', '#fde047', 17, 0.85);
      this.sounds.bubble?.(1.3);
    }
  }

  collectCrate(c, idx) {
    this.crates.splice(idx, 1);
    const sx = c.x - this.camX;
    this.scrap += 22;
    this.fx.text(sx, c.y - 20, '+22 SCRAP CRATE!', '#fde047', 16, 1.0);
    this.fx.burst(sx, c.y, '#fde047', 12, 160, 0.45, 3.5);
    this.sounds.up?.();
  }

  circleRectHit(cx, cy, cr, b) {
    const dx = clamp(cx, b.x - b.w / 2, b.x + b.w / 2) - cx;
    const dy = clamp(cy, b.y - b.h / 2, b.y + b.h / 2) - cy;
    return dx * dx + dy * dy <= cr * cr;
  }

  explodeAt(wx, wy, rad, blkDmg) {
    const sx = wx - this.camX;
    this.fx.ring(sx, wy, '#fb923c', rad * 1.4, 0.5, 7);
    this.fx.burst(sx, wy, '#fde047', 26, 260, 0.65, 5);
    this.fx.burst(sx, wy, '#ef4444', 18, 210, 0.55, 4);
    this.fx.shake(12, 0.35);
    this.hitstopT = 0.055;
    this.sounds.chomp?.();
    this.haptics.heavy?.();

    const bd = Math.hypot(this.boss.x - wx, this.boss.y - wy);
    if (bd < rad + this.boss.r) {
      const falloff = 1 - (bd / (rad + this.boss.r)) * 0.6;
      this.damageBoss(Math.round(28 * falloff));
    }

    for (const h of this.hands) {
      if (Math.hypot(h.x - wx, h.y - wy) < rad + h.r) {
        h.stunT = 2.2;
        h.flash = 1.0;
      }
    }

    for (const b of this.blocks) {
      if (b.dead) continue;
      const d = Math.hypot(b.x - wx, b.y - wy);
      if (d < rad + Math.max(b.w, b.h) * 0.5) {
        const factor = 1 - d / (rad + 40);
        b.hp -= blkDmg * clamp(factor, 0.25, 1);
        const nx = (b.x - wx) / (d || 1);
        const ny = (b.y - wy) / (d || 1);
        b.vx += nx * 240 * factor;
        b.vy += ny * 220 * factor - 90;
        b.vrot += (nx >= 0 ? 1 : -1) * rand(3, 7);
        if (b.hp <= 0) this.destroyBlock(b);
      }
    }
  }

  destroyBlock(b) {
    if (!b || b.dead) return;
    b.dead = true;
    const sx = b.x - this.camX;
    this.stats.blocksSmashed += 1;
    this.score += 120;
    this.fx.burst(sx, b.y, MAT_STYLE[b.mat].fill, 12, 175, 0.48, 3.5);
    this.flyingScrap.push({ x: sx, y: b.y, t: 0, amount: b.mat === 'crate' ? 18 : 6 });

    if (b.mat === 'tnt') {
      this.fx.text(sx, b.y - 22, 'TNT CHAIN BLAST!', '#ef4444', 18, 0.9);
      this.explodeAt(b.x, b.y, 138, 125);
    }
  }

  // Enhanced physics with Center-of-Mass Overhang Toppling!
  updateBossBlocks(dt) {
    for (const b of this.blocks) {
      if (b.dead) continue;
      b.hitCd = Math.max(0, b.hitCd - dt);
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vrot * dt;
      b.vx *= Math.pow(0.25, dt);
      b.vrot *= Math.pow(0.15, dt);

      if (b.y + b.h / 2 >= GROUND_Y) {
        if (b.vy > 185 && b.hitCd <= 0) {
          b.hp -= (b.vy - 150) * 0.16;
          b.hitCd = 0.25;
        }
        b.y = GROUND_Y - b.h / 2;
        b.vy = 0;
        b.rot *= 0.85;
      }
      b.x = clamp(b.x, 495, WORLD_W - 24);
    }

    for (let i = 0; i < this.blocks.length; i++) {
      const top = this.blocks[i];
      if (!top || top.dead) continue;
      let supMin = Infinity;
      let supMax = -Infinity;
      let hasSupport = top.y + top.h / 2 >= GROUND_Y - 2;

      for (let j = 0; j < this.blocks.length; j++) {
        if (i === j) continue;
        const bot = this.blocks[j];
        if (!bot || bot.dead) continue;
        if (Math.abs(top.x - bot.x) < (top.w + bot.w) * 0.48) {
          const topBot = top.y + top.h / 2;
          const botTop = bot.y - bot.h / 2;
          if (top.y < bot.y && topBot >= botTop - 4 && topBot - botTop < 26 && top.vy >= -10) {
            if (top.vy > 190 && top.hitCd <= 0) {
              const impact = (top.vy - 160) * 0.18;
              top.hp -= impact;
              bot.hp -= impact * (top.mat === 'stone' ? 1.5 : 1.0);
              top.hitCd = 0.25;
            }
            top.y = botTop - top.h / 2;
            top.vy = 0;
            hasSupport = true;
            supMin = Math.min(supMin, bot.x - bot.w * 0.48);
            supMax = Math.max(supMax, bot.x + bot.w * 0.48);
          }
        }
      }

      // Overhang torque! If upper beam center overhangs past supporting pillars, tip & tumble sideways!
      if (hasSupport && supMin < supMax && (top.x < supMin || top.x > supMax)) {
        const tipDir = top.x < supMin ? -1 : 1;
        top.vrot += tipDir * 7.5 * dt;
        top.vx += tipDir * 190 * dt;
      }

      if (top.vy > 160 && Math.hypot(top.x - this.boss.x, top.y - this.boss.y) < this.boss.r + top.w * 0.5 && top.hitCd <= 0) {
        top.hitCd = 0.35;
        this.damageBoss(top.mat === 'stone' ? 14 : 9);
      }
      if (top.hp <= 0) this.destroyBlock(top);
    }

    this.blocks = this.blocks.filter((b) => !b.dead);
  }

  damageBoss(amount) {
    const b = this.boss;
    const actual = Math.max(1, Math.round(amount * 0.8));
    if (this.won || amount <= 0) return;
    b.hp = Math.max(0, b.hp - actual);
    b.hurtFlash = 1.0;
    this.score += actual * 25;
    const sx = b.x - this.camX;
    this.fx.text(sx, b.y - 54, `-${actual}% LORD BRIM!`, '#3dffa2', 19, 1.0);
    this.fx.ring(sx, b.y, '#3dffa2', 120, 0.45, 5);
    this.sounds.up?.();

    b.phase = b.hp > 66 ? 1 : b.hp > 33 ? 2 : 3;
    if (b.phase >= 2 && !b.enraged2Fired) {
      b.enraged2Fired = true;
      this.fx.text(sx, b.y - 82, 'PHASE 2: IRON GATE & LIGHTNING!', '#c084fc', 17, 1.3);
      this.addBlock(496, GROUND_Y - 40, 24, 80, 'obsidian', 'pillar');
      this.imps.push({ x: b.x - 50, y: rand(265, 355), vx: -102, r: 16, bob: rand(0, TAU) });
      this.boltCd = Math.min(this.boltCd, 2.2);
    }
    if (b.phase >= 3 && !b.enraged3Fired) {
      b.enraged3Fired = true;
      this.fx.text(sx, b.y - 82, 'PHASE 3: FURY OF LORD BRIM!', '#ef4444', 18, 1.3);
      b.volleyCd = Math.min(b.volleyCd, 0.9);
      this.boltCd = Math.min(this.boltCd, 1.1);
    }

    if (b.hp <= 0) {
      this.fx.shake(16, 0.55);
      this.won = true;
      this.winReason = `Victory (${this.hearts}/${this.maxHearts} Hearts · ${this.stats.shotsFired} Shots · ${this.stats.blocksSmashed} Blocks)`;
    }
  }

  updateBossAI(dt, scale) {
    const b = this.boss;
    const pace = (b.phase === 1 ? 1.44 : b.phase === 2 ? 2.06 : 2.94) * scale;

    // Determine clear horizontal bounds inside Keep Chamber (widen once columns break!)
    const hasLeftCol = this.blocks.some((k) => !k.dead && k.x < 658 && k.x > 634 && k.y < GROUND_Y - 110);
    const hasRightCol = this.blocks.some((k) => !k.dead && k.x > 752 && k.x < 776 && k.y < GROUND_Y - 110);
    const minX = hasLeftCol ? 674 : 630;
    const maxX = hasRightCol ? 736 : 780;

    b.dashCd -= dt * pace;
    const incoming = this.shots.find((s) => s.x > 460 && s.vx > 60 && Math.abs(s.y - b.y) < 110);
    if (b.dashCd <= 0 || (incoming && b.phase >= 2 && b.dashCd < 1.0)) {
      b.patrolDir *= -1;
      const span = (maxX - minX) * 0.48;
      b.targetX = clamp((minX + maxX) * 0.5 + b.patrolDir * span + rand(-6, 6), minX, maxX);
      b.dashCd = Math.max(0.75, 1.75 - b.phase * 0.36);
      if (b.phase >= 2) b.castT = Math.max(b.castT, 0.25);
    }
    const targetX = clamp(b.targetX ?? b.baseX, minX, maxX);
    const accelX = clamp((targetX - b.x) * (5.5 + b.phase * 2.6), -350 * pace, 350 * pace);
    b.vx += (accelX - b.vx) * Math.min(1, dt * (6.8 + b.phase * 2.4));
    b.x = clamp(b.x + b.vx * dt, minX, maxX);

    let supportY = GROUND_Y;
    for (const blk of this.blocks) {
      if (blk.dead) continue;
      if (Math.abs(b.x - blk.x) < blk.w * 0.55 + b.r * 0.4 && blk.y > b.y + 8) {
        const blkTop = blk.y - blk.h / 2;
        if (blkTop < supportY) supportY = blkTop;
      }
    }
    const hoverGap = (b.phase === 3 ? 16 : 8) + Math.sin(this.time * (4.5 + b.phase * 1.4)) * (5 + b.phase * 2.2);
    const desiredY = Math.min(GROUND_Y - b.r, supportY - b.r - hoverGap);
    b.vy += (desiredY - b.y) * 16 * dt;
    b.vy *= Math.pow(0.06, dt);
    b.y = clamp(b.y + b.vy * dt, 180, GROUND_Y - b.r);

    b.yaw = -0.32 + clamp(b.vx * 0.004, -0.32, 0.32) + Math.sin(this.time * (2.6 + b.phase * 0.9)) * 0.24 + (b.castT > 0 ? -0.22 : 0);
    b.pitch = 0.08 + Math.sin(this.time * 3.8) * 0.08 - (b.hurtFlash > 0.2 ? 0.35 : 0);

    for (const h of this.hands) {
      h.bob += dt * (4.75 + b.phase * 1.8);
      h.stunT = Math.max(0, h.stunT - dt);
      h.flash = Math.max(0, h.flash - dt * 5);
      h.slamT = Math.max(0, h.slamT - dt);
      const bobY = h.stunT > 0 ? 22 : Math.sin(h.bob) * (16 + b.phase * 4.5);
      h.x = b.x + h.ox + Math.cos(h.bob * 0.85) * (16 + b.phase * 7);
      h.y = b.y + h.oy + bobY;
      h.z = h.oz + Math.sin(h.bob * 0.9) * 18 + (h.slamT > 0 ? 26 : 0);
    }

    // Spawn Faster Balloon Imp Minions (+25% tempo!)
    this.impSpawnT -= dt * scale;
    if (this.impSpawnT <= 0 && this.imps.length < (b.phase === 3 ? 4 : b.phase === 2 ? 3 : 2)) {
      this.impSpawnT = b.phase >= 2 ? 3.7 : 5.1;
      this.imps.push({ x: b.x - 60, y: rand(265, 360), vx: -98 - b.phase * 22, r: 16, bob: rand(0, TAU) });
    }

    // Phase 2+: Telegraphed Shadow Lightning Strikes ALWAYS target Defences First (+25% cadence)!
    if (b.phase >= 2) {
      this.boltCd -= dt * scale;
      if (this.boltCd <= 0) {
        this.boltCd = b.phase === 3 ? 4.15 : 5.6;
        const defTgt = this.getActiveDefenseTarget(true);
        const targetX = defTgt ? defTgt.x : SLING.x;
        this.bolts.push({ x: targetX, warnT: 0.95, fireT: 0.35, hitApplied: false });
        this.sounds.drop?.();
      }
    }

    b.volleyCd -= dt * scale;
    if (b.volleyCd <= 0.9 && b.volleyCd + dt * scale > 0.9) {
      this.fx.text(180, 165, 'INCOMING CHAOS MORTAR!', '#fb7185', 16, 0.95);
      this.sounds.drop?.();
    }
    if (b.volleyCd <= 0) {
      b.volleyCd = Math.max(2.15, 4.15 - b.phase * 0.68);
      b.castT = 0.45;
      const caster = this.hands[1];
      if (caster.stunT <= 0) caster.slamT = 0.45;
      const count = b.phase === 3 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const defTgt = this.getActiveDefenseTarget(k > 0);
        const targetX = defTgt ? defTgt.x + rand(-8, 8) : SLING.x + rand(-14, 14);
        const targetY = defTgt ? defTgt.y : GROUND_Y - 26;
        const flightT = 0.92;
        const startX = caster.x - 16;
        const startY = caster.y - 10;
        const vx = (targetX - startX) / flightT;
        const vy = (targetY - startY - 0.5 * 820 * flightT * flightT) / flightT;
        this.enemyShots.push({ x: startX, y: startY, vx, vy, r: 14, rot: 0, reflected: false });
      }
      this.sounds.slice?.();
    }
  }

  // Strict Defense-First Targeter: Enemy abilities CANNOT bypass player walls or multi-slot roofs!
  getActiveDefenseTarget(preferRoof = false) {
    const defs = this.playerBlocks;
    const roofs = this.canopies;
    if (defs.length === 0 && roofs.length === 0) return null;
    if (preferRoof && roofs.length > 0) {
      const r = roofs.slice().sort((a, b) => b.x - a.x)[0];
      return { isRoof: true, x: r.x, y: r.y, ref: r };
    }
    if (defs.length > 0) {
      const sorted = defs.slice().sort((a, b) => (b.x - a.x) || (a.y - b.y));
      return { isRoof: false, x: sorted[0].x, y: sorted[0].y, ref: sorted[0] };
    }
    const r = roofs.slice().sort((a, b) => b.x - a.x)[0];
    return { isRoof: true, x: r.x, y: r.y, ref: r };
  }

  damageDefenseTarget(defTgt, dmg, label = 'CASTLE ABSORBED!') {
    if (!defTgt) return false;
    if (defTgt.isRoof) {
      const rIdx = this.canopies.indexOf(defTgt.ref);
      if (rIdx >= 0) {
        const rf = this.canopies[rIdx];
        rf.hp -= dmg;
        this.fx.text(rf.x - this.camX, rf.y - 14, label, '#38bdf8', 15, 0.85);
        this.sounds.gate?.(true);
        if (rf.hp <= 0) {
          this.fx.burst(rf.x - this.camX, rf.y, '#60a5fa', 12, 160, 0.45, 3);
          this.canopies.splice(rIdx, 1);
          this.fx.shake(7, 0.22);
        }
        return true;
      }
    }
    const idx = this.playerBlocks.indexOf(defTgt.ref);
    if (idx >= 0) {
      const pb = this.playerBlocks[idx];
      pb.hp -= dmg;
      this.fx.text(pb.x - this.camX, pb.y - 22, label, '#fbbf24', 14, 0.85);
      this.sounds.chomp?.();
      if (pb.hp <= 0) {
        this.fx.burst(pb.x - this.camX, pb.y, '#cbd5e1', 10, 150, 0.4, 3);
        this.playerBlocks.splice(idx, 1);
        this.fx.shake(6, 0.2);
      }
      return true;
    }
    return false;
  }

  updateEnemyHazards(dt, scale) {
    // 1. Balloon Imp Minions (MUST strike player defences first!)
    for (let i = this.imps.length - 1; i >= 0; i--) {
      const imp = this.imps[i];
      imp.bob += dt * 4;
      imp.x += imp.vx * dt;
      const frontTgt = this.getActiveDefenseTarget(false);
      if (frontTgt) {
        imp.y += clamp(frontTgt.y - imp.y, -110, 110) * dt * 2.2 + Math.sin(imp.bob) * 14 * dt;
      } else {
        imp.y += Math.sin(imp.bob) * 22 * dt;
      }

      let hitRoof = false;
      const orderedRoofs = this.canopies.slice().sort((a, b) => b.x - a.x);
      for (const rf of orderedRoofs) {
        if (this.circleRectHit(imp.x, imp.y, imp.r, rf)) {
          this.damageDefenseTarget({ isRoof: true, ref: rf }, 48, 'ROOF BLOCKED IMP!');
          hitRoof = true;
          break;
        }
      }
      if (hitRoof) { this.imps.splice(i, 1); continue; }

      let hitWall = false;
      const orderedWalls = this.playerBlocks.slice().sort((a, b) => b.x - a.x || a.y - b.y);
      for (const pb of orderedWalls) {
        if (this.circleRectHit(imp.x, imp.y, imp.r, pb)) {
          this.damageDefenseTarget({ isRoof: false, ref: pb }, 48, 'IMP BLOCKED!');
          hitWall = true;
          break;
        }
      }
      if (hitWall) { this.imps.splice(i, 1); continue; }
      if (imp.x <= SLING.x + 15) {
        this.imps.splice(i, 1);
        const remaining = this.getActiveDefenseTarget(false);
        if (remaining) this.damageDefenseTarget(remaining, 48, 'CASTLE INTERCEPT!');
        else this.damagePlayer();
      }
    }

    // 2. Telegraphed Shadow Lightning Columns (NEVER bypass defences!)
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bt = this.bolts[i];
      if (bt.warnT > 0) {
        bt.warnT -= dt;
      } else {
        if (!bt.hitApplied) {
          bt.hitApplied = true;
          this.fx.shake(9, 0.25);
          this.sounds.slice?.();
          const hitRf = this.canopies.find((c) => Math.abs(c.x - bt.x) < c.w * 0.58);
          if (hitRf) {
            this.damageDefenseTarget({ isRoof: true, ref: hitRf }, 62, 'ROOF ABSORBED!');
          } else {
            const topWall = this.playerBlocks
              .filter((p) => Math.abs(p.x - bt.x) < 32)
              .sort((a, b) => a.y - b.y)[0];
            if (topWall) {
              this.damageDefenseTarget({ isRoof: false, ref: topWall }, 68, 'WALL ABSORBED!');
            } else {
              const fallback = this.getActiveDefenseTarget(true);
              if (fallback) {
                bt.x = fallback.x;
                this.damageDefenseTarget(fallback, 65, 'CASTLE ABSORBED!');
              } else {
                this.damagePlayer();
              }
            }
          }
        }
        bt.fireT -= dt;
        if (bt.fireT <= 0) this.bolts.splice(i, 1);
      }
    }

    // 3. Chaos Mortar Shots (Deflected rocks scatter harmlessly into chasm — NEVER hit Boss!)
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const es = this.enemyShots[i];
      es.vy += 820 * dt;
      es.x += es.vx * dt;
      es.y += es.vy * dt;
      es.rot -= dt * 9.5;

      if (es.reflected) {
        if (es.y >= GROUND_Y || es.x > 465 || es.x < -40 || es.y < -40) this.enemyShots.splice(i, 1);
        continue;
      }

      let hitRfObj = null;
      const orderedRoofs = this.canopies.slice().sort((a, b) => b.x - a.x);
      for (const rf of orderedRoofs) {
        if (this.circleRectHit(es.x, es.y, es.r, rf)) {
          hitRfObj = rf;
          break;
        }
      }
      if (hitRfObj) {
        es.reflected = true;
        es.vx = rand(75, 135);
        es.vy = -rand(240, 310);
        this.damageDefenseTarget({ isRoof: true, ref: hitRfObj }, 48, 'ROOF DEFLECTED!');
        continue;
      }

      let blocked = false;
      const frontOrdered = this.playerBlocks.slice().sort((a, b) => b.x - a.x || a.y - b.y);
      for (const pb of frontOrdered) {
        if (this.circleRectHit(es.x, es.y, es.r, pb)) {
          this.damageDefenseTarget({ isRoof: false, ref: pb }, 62, 'WALL BLOCKED!');
          blocked = true;
          break;
        }
      }
      if (blocked) { this.enemyShots.splice(i, 1); continue; }

      if ((es.x < 165 && es.y > SLING.y - 50) || es.y >= GROUND_Y - 8) {
        this.enemyShots.splice(i, 1);
        const remaining = this.getActiveDefenseTarget(false);
        if (remaining) {
          this.damageDefenseTarget(remaining, 60, 'CASTLE DEFENDED!');
        } else if (es.x < 195) {
          this.damagePlayer();
        }
      }
    }
  }

  damagePlayer() {
    this.hearts = Math.max(0, this.hearts - 1);
    this.playerHurtT = 1.0;
    this.fx.shake(12, 0.35);
    this.fx.text(140, 460, '-1 HEART! BUILD WALLS!', '#fb7185', 16, 1.0);
    this.sounds.slice?.();
    this.haptics.heavy?.();
    if (this.hearts <= 0) {
      this.die(`Siege Bastion Overrun! (${this.stats.shotsFired} Shots · ${this.stats.blocksSmashed} Blocks Smashed)`);
    }
  }

  // ---------- 3D-PROJECTED & VOLUMETRIC-LIT LORD BRIM MESH ----------

  project3D(x, y, z, yaw, pitch, fov = 320) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const scale = fov / Math.max(80, fov - z2);
    return { x: x1 * scale, y: y2 * scale, z: z2, s: scale };
  }

  rotNormal(nx, ny, nz, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = nx * cy + nz * sy;
    const z1 = -nx * sy + nz * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [x1, ny * cp - z1 * sp, ny * sp + z1 * cp];
  }

  // Articulated HD Flash Cel-Cartoon Puppet Rig for Lord Brim (Cloak + Head/Hat + Live Expressions)
  drawLordBrim3D(ctx, cx, cy) {
    const b = this.boss;
    const rage = b.phase === 3;
    const hurt = b.hurtFlash > 0.25;
    const casting = b.castT > 0.05;
    const bobY = Math.sin(this.time * (rage ? 6.0 : 4.2)) * 4.0;
    const swayRot = clamp(b.vx * 0.0018, -0.15, 0.15);
    const squashY = hurt ? 0.90 : casting ? 1.07 : 1 + Math.sin(this.time * 4.2 + 1) * 0.025;
    const squashX = 2 - squashY;

    // 1. Signature Weebl Comic Pinwheel Sunburst behind Lord Brim
    const burstR = rage ? 122 : casting ? 110 : 96;
    drawSunburst(
      ctx,
      cx,
      cy + bobY - 12,
      burstR,
      this.time * (rage ? 1.1 : 0.36),
      14,
      hurt ? 0.95 : rage ? 0.85 : 0.65,
      rage
    );

    // 2. Cloak Torso Layer (brim_cloak.png, 279x338 anchored at bottom hem)
    drawSprite(ctx, 'brim_cloak', cx, cy + 56 + bobY, 108, 130, {
      rot: swayRot,
      sx: squashX,
      sy: squashY,
      flashAlpha: hurt ? 0.72 : 0,
      fallback: (c) => {
        c.fillStyle = hurt ? '#ffffff' : '#312e81';
        c.strokeStyle = '#000000';
        c.lineWidth = 3.5;
        c.beginPath();
        c.moveTo(-34, -124);
        c.quadraticCurveTo(0, -132, 34, -124);
        c.lineTo(48, 0);
        c.quadraticCurveTo(0, 12, -48, 0);
        c.closePath();
        c.fill();
        c.stroke();
      },
    });

    // 3. Head + Pointed Wizard Hat Puppet Layer (brim_head_hat.png, 320x332 anchored at neck)
    const headBobY = cy - 30 + bobY * 1.15;
    const headRot = swayRot * 0.8 + (hurt ? -0.18 : Math.sin(this.time * 3.0) * 0.045);
    ctx.save();
    ctx.translate(cx, headBobY);
    ctx.rotate(headRot);
    ctx.scale(squashX, squashY);

    drawSprite(ctx, 'brim_head_hat', 0, 0, 118, 122, {
      flashAlpha: hurt ? 0.65 : 0,
      fallback: (c) => {
        c.fillStyle = '#0f0728';
        c.strokeStyle = '#000000';
        c.lineWidth = 3.5;
        c.beginPath();
        c.arc(0, 0, 26, 0, TAU);
        c.fill();
        c.stroke();
        c.fillStyle = '#581c87';
        c.beginPath();
        c.moveTo(-48, -14);
        c.quadraticCurveTo(0, -24, 48, -14);
        c.quadraticCurveTo(0, -4, -48, -14);
        c.closePath();
        c.fill();
        c.stroke();
        c.beginPath();
        c.moveTo(-26, -16);
        c.lineTo(14, -72);
        c.lineTo(26, -16);
        c.closePath();
        c.fill();
        c.stroke();
      },
    });

    // Live Comic Face Overlays (blinks, Crimson Rage Eyes, Dizzy Hurt X-Eyes!)
    const blink = !hurt && !rage && (this.time % 3.8) > 3.66;
    if (hurt) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      for (const ex of [-11, 11]) {
        ctx.beginPath();
        ctx.moveTo(ex - 4.5, 4); ctx.lineTo(ex + 4.5, 13);
        ctx.moveTo(ex + 4.5, 4); ctx.lineTo(ex - 4.5, 13);
        ctx.stroke();
      }
    } else if (blink) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.6;
      for (const ex of [-11, 11]) {
        ctx.beginPath();
        ctx.moveTo(ex - 5, 8); ctx.lineTo(ex + 5, 8);
        ctx.stroke();
      }
    } else if (rage || casting) {
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * 11, 8);
        ctx.rotate(side * -0.28);
        ctx.fillStyle = rage ? '#fb7185' : '#fef08a';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, 6.2, 4.2, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // Articulated HD Flash Cartoon Disembodied Gloves (brim_glove_l / brim_glove_r)
  drawFloatingHand3D(ctx, h) {
    const pScale = clamp(1 + h.z * 0.0035, 0.9, 1.16);
    const id = h.side < 0 ? 'brim_glove_l' : 'brim_glove_r';
    const w = h.side < 0 ? 64 : 66;
    const ht = h.side < 0 ? 70 : 62;
    const rot = h.stunT > 0 ? Math.sin(this.time * 18) * 0.42 : h.side * 0.14 + Math.sin(this.time * 3.5 + h.bob) * 0.08;

    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.scale(pScale, pScale);

    drawSprite(ctx, id, 0, 0, w, ht, {
      rot,
      flashAlpha: h.flash > 0.2 ? 0.72 : 0,
      alpha: h.stunT > 0 ? 0.86 : 1,
      fallback: (c) => {
        c.rotate(rot);
        c.fillStyle = h.flash > 0.2 ? '#fef08a' : '#f8fafc';
        c.strokeStyle = '#000000';
        c.lineWidth = 3;
        c.beginPath();
        c.roundRect(-16, -16, 32, 32, 9);
        c.fill();
        c.stroke();
      },
    });

    // Comic Dizzy Stars orbiting stunned glove
    if (h.stunT > 0) {
      for (let k = 0; k < 3; k++) {
        const a = this.time * 5.2 + (k * TAU) / 3;
        drawComicStarburst(ctx, Math.cos(a) * 24, -26 + Math.sin(a) * 6, 7.5, 3.2, 5, '#facc15', '#000000', a, 1.6);
      }
    }
    ctx.restore();
  }

  // ---------- Unified World 3D Mesh Projection & Shader Engine ----------

  projWorld(wx, wy, wz = 0) {
    const camCX = this.camX + this.W * 0.5;
    const camCY = 360;
    const fov = 740;
    const s = fov / Math.max(120, fov - wz);
    return { x: camCX + (wx - camCX) * s, y: camCY + (wy - camCY) * s, z: wz, s };
  }

  drawQuad3D(ctx, p0, p1, p2, p3, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fill();
  }

  // Renders any rotated architectural 3D castle block with multi-part Blinn-Phong geometry!
  drawBox3D(ctx, cx, cy, cz, w, h, d, rgb, rot = 0, opts = {}) {
    const { specPow = 18, specAmt = 0.42, alpha = 1, mat = null, shape = 'wall', hpRatio = 1, frontLabel = null, isPlayer = false } = opts;
    const hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const camCX = this.camX + this.W * 0.5;
    const camCY = 360;
    const camZ = 740;

    const pt = (lx, ly, lz) => {
      const wx = cx + lx * cos - ly * sin;
      const wy = cy + lx * sin + ly * cos;
      return this.projWorld(wx, wy, cz + lz);
    };

    const drawLocalSubBox = (lx0, lx1, ly0, ly1, lz0, lz1, subRgb, sp = 18, sa = 0.4) => {
      const sb0 = pt(lx0, ly0, lz0), sb1 = pt(lx1, ly0, lz0), sf1 = pt(lx1, ly0, lz1), sf0 = pt(lx0, ly0, lz1);
      const sf2 = pt(lx1, ly1, lz1), sb2 = pt(lx1, ly1, lz0), sf3 = pt(lx0, ly1, lz1), sb3 = pt(lx0, ly1, lz0);
      if (cos > 0.2) {
        this.drawQuad3D(ctx, sb0, sb1, sf1, sf0, litColor(subRgb, sin, -cos, 0, sp, sa));
      }
      const midX = cx + ((lx0 + lx1) * 0.5) * cos - ((ly0 + ly1) * 0.5) * sin;
      if (camCX > midX + 2) {
        this.drawQuad3D(ctx, sf1, sb1, sb2, sf2, litColor(subRgb, cos, sin, 0, sp, sa));
      } else if (camCX < midX - 2) {
        this.drawQuad3D(ctx, sb0, sf0, sf3, sb3, litColor(subRgb, -cos, -sin, 0, sp, sa));
      }
      this.drawQuad3D(ctx, sf0, sf1, sf2, sf3, litColor(subRgb, 0.05, -0.05, 0.99, sp, sa));
    };

    ctx.save();
    if (alpha < 1) ctx.globalAlpha = alpha;

    if (mat === 'spire') {
      const baseCol = isPlayer ? [100, 116, 139] : [58, 42, 108];
      const trimCol = isPlayer ? [203, 213, 225] : [234, 179, 8];
      const roofCol = isPlayer ? [37, 99, 235] : [109, 40, 217];
      drawLocalSubBox(-hw * 0.94, hw * 0.94, hh * 0.52, hh, -hd * 0.92, hd * 0.92, baseCol, 20, 0.4);
      drawLocalSubBox(-hw * 1.02, hw * 1.02, hh * 0.34, hh * 0.54, -hd * 1.0, hd * 1.0, trimCol, 32, 0.72);
      this.drawPyramid3D(ctx, cx, cy, cz, w * 1.06, h * 0.88, d * 1.06, roofCol, {
        rot,
        baseOffsetY: hh * 0.36,
        finialCol: '#fde047',
        specPow: 28,
        specAmt: 0.65,
      });
    } else {
      // 8 3D corners (0..3 back, 4..7 front)
      const b0 = pt(-hw, -hh, -hd), b1 = pt(hw, -hh, -hd), b2 = pt(hw, hh, -hd), b3 = pt(-hw, hh, -hd);
      const f0 = pt(-hw, -hh, hd),  f1 = pt(hw, -hh, hd),  f2 = pt(hw, hh, hd),  f3 = pt(-hw, hh, hd);

      const faces = [
        { verts: [b0, b1, f1, f0], nx: sin,  ny: -cos, nz: 0, fc: [cx + sin * hh, cy - cos * hh, cz] },
        { verts: [f3, f2, b2, b3], nx: -sin, ny: cos,  nz: 0, fc: [cx - sin * hh, cy + cos * hh, cz] },
        { verts: [b0, f0, f3, b3], nx: -cos, ny: -sin, nz: 0, fc: [cx - cos * hw, cy - sin * hw, cz] },
        { verts: [f1, b1, b2, f2], nx: cos,  ny: sin,  nz: 0, fc: [cx + cos * hw, cy + sin * hw, cz] },
      ];

      for (const f of faces) {
        const toCamX = camCX - f.fc[0], toCamY = camCY - f.fc[1], toCamZ = camZ - f.fc[2];
        if (toCamX * f.nx + toCamY * f.ny + toCamZ * f.nz > 0) {
          this.drawQuad3D(ctx, f.verts[0], f.verts[1], f.verts[2], f.verts[3],
            litColor(rgb, f.nx, f.ny, f.nz, specPow, specAmt));
        }
      }

      // Sculpted Recessed Wall Base vs Outer Timber/Stone Components!
      if (mat === 'wood') {
        // Dark timber plank interior + raised 3D oak framing beams & diagonal struts!
        const innerCol = [Math.round(rgb[0] * 0.72), Math.round(rgb[1] * 0.68), Math.round(rgb[2] * 0.65)];
        this.drawQuad3D(ctx, f0, f1, f2, f3, litColor(innerCol, 0.04, -0.04, 0.99, 10, 0.2));
        // Vertical & horizontal plank lines
        ctx.strokeStyle = 'rgba(92, 40, 10, 0.55)';
        ctx.lineWidth = 1.4;
        for (const t of [-0.35, 0, 0.35]) {
          const p0 = pt(hw * t, -hh * 0.85, hd + 0.3), p1 = pt(hw * t, hh * 0.85, hd + 0.3);
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        }
        // Diagonal timber cross-brace
        const d0 = pt(-hw * 0.76, -hh * 0.72, hd + 0.5), d1 = pt(hw * 0.76, hh * 0.72, hd + 0.5);
        const d2 = pt(hw * 0.76, -hh * 0.72, hd + 0.5), d3 = pt(-hw * 0.76, hh * 0.72, hd + 0.5);
        ctx.strokeStyle = litColor([245, 158, 11], -0.1, -0.2, 0.95, 16, 0.35);
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(d0.x, d0.y); ctx.lineTo(d1.x, d1.y); ctx.moveTo(d2.x, d2.y); ctx.lineTo(d3.x, d3.y); ctx.stroke();
        // Extruded oak top/bottom lintels & corner stanchions
        const beamCol = [234, 148, 22];
        drawLocalSubBox(-hw * 1.03, hw * 1.03, -hh, -hh * 0.72, -hd * 0.95, hd * 1.06, beamCol, 18, 0.45);
        drawLocalSubBox(-hw * 1.03, hw * 1.03, hh * 0.72, hh, -hd * 0.95, hd * 1.06, [180, 96, 12], 14, 0.3);
        drawLocalSubBox(-hw, -hw * 0.76, -hh * 0.74, hh * 0.74, hd * 0.7, hd * 1.04, beamCol, 16, 0.35);
        drawLocalSubBox(hw * 0.76, hw, -hh * 0.74, hh * 0.74, hd * 0.7, hd * 1.04, beamCol, 16, 0.35);
        // Iron corner rivets
        ctx.fillStyle = litColor([148, 163, 184], -0.2, -0.3, 0.9, 36, 0.8);
        for (const [rx, ry] of [[-hw * 0.86, -hh * 0.85], [hw * 0.86, -hh * 0.85], [-hw * 0.86, hh * 0.85], [hw * 0.86, hh * 0.85]]) {
          const rv = pt(rx, ry, hd + 1.4);
          ctx.beginPath(); ctx.arc(rv.x, rv.y, 1.8 * rv.s, 0, TAU); ctx.fill();
        }
      } else if (mat === 'stone') {
        this.drawQuad3D(ctx, f0, f1, f2, f3, litColor(rgb, 0.05, -0.05, 0.99, specPow, specAmt));
        // Multi-course ashlar stone brickwork joints
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = 1.4;
        for (const ry of [-hh * 0.38, hh * 0.05, hh * 0.48]) {
          const m0 = pt(-hw * 0.9, ry, hd + 0.5), m1 = pt(hw * 0.9, ry, hd + 0.5);
          ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.stroke();
        }
        const j0 = pt(-hw * 0.25, -hh * 0.88, hd + 0.5), j1 = pt(-hw * 0.25, -hh * 0.38, hd + 0.5);
        const j2 = pt(hw * 0.3, -hh * 0.38, hd + 0.5),   j3 = pt(hw * 0.3, hh * 0.05, hd + 0.5);
        const j4 = pt(-hw * 0.2, hh * 0.05, hd + 0.5),   j5 = pt(-hw * 0.2, hh * 0.48, hd + 0.5);
        ctx.beginPath();
        ctx.moveTo(j0.x, j0.y); ctx.lineTo(j1.x, j1.y);
        ctx.moveTo(j2.x, j2.y); ctx.lineTo(j3.x, j3.y);
        ctx.moveTo(j4.x, j4.y); ctx.lineTo(j5.x, j5.y);
        ctx.stroke();
        // Carved arrow-slit embrasure on upright walls
        if (shape === 'wall' && h >= 40) {
          const a0 = pt(-hw * 0.14, -hh * 0.45, hd + 0.7), a1 = pt(hw * 0.14, -hh * 0.45, hd + 0.7);
          const a2 = pt(hw * 0.14, hh * 0.36, hd + 0.7),   a3 = pt(-hw * 0.14, hh * 0.36, hd + 0.7);
          this.drawQuad3D(ctx, a0, a1, a2, a3, '#0f172a');
        }
      } else if (mat === 'obsidian') {
        this.drawQuad3D(ctx, f0, f1, f2, f3, litColor(rgb, 0.05, -0.05, 0.99, specPow, specAmt));
        ctx.strokeStyle = 'rgba(165, 180, 252, 0.42)';
        ctx.lineWidth = 1.5;
        for (const ry of [-hh * 0.38, hh * 0.38]) {
          const m0 = pt(-hw * 0.88, ry, hd + 0.5), m1 = pt(hw * 0.88, ry, hd + 0.5);
          ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.stroke();
        }
        if (shape === 'wall' || shape === 'pillar') {
          const s0 = pt(-hw * 0.12, -hh * 0.28, hd + 0.7), s1 = pt(hw * 0.12, -hh * 0.28, hd + 0.7);
          const s2 = pt(hw * 0.12, hh * 0.28, hd + 0.7),   s3 = pt(-hw * 0.12, hh * 0.28, hd + 0.7);
          this.drawQuad3D(ctx, s0, s1, s2, s3, 'rgba(192, 132, 252, 0.65)');
        } else {
          const rune = pt(0, 0, hd + 0.8);
          ctx.fillStyle = litColor([168, 85, 247], -0.2, -0.3, 0.9, 36, 0.85);
          ctx.beginPath(); ctx.arc(rune.x, rune.y, 3.2 * rune.s, 0, TAU); ctx.fill();
        }
      } else if (mat === 'glass') {
        this.drawQuad3D(ctx, f0, f1, f2, f3, litColor(rgb, 0.05, -0.05, 0.99, specPow, specAmt));
        // Dark stone gothic frame around stained glass + diamond muntins
        const frCol = [51, 65, 85];
        drawLocalSubBox(-hw, -hw * 0.76, -hh, hh, hd * 0.75, hd * 1.05, frCol, 18, 0.35);
        drawLocalSubBox(hw * 0.76, hw, -hh, hh, hd * 0.75, hd * 1.05, frCol, 18, 0.35);
        drawLocalSubBox(-hw, hw, -hh, -hh * 0.82, hd * 0.75, hd * 1.05, frCol, 18, 0.35);
        const d0 = pt(0, -hh * 0.72, hd + 0.6), d1 = pt(hw * 0.62, 0, hd + 0.6);
        const d2 = pt(0, hh * 0.72, hd + 0.6),  d3 = pt(-hw * 0.62, 0, hd + 0.6);
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.7)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(d0.x, d0.y); ctx.lineTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y); ctx.lineTo(d3.x, d3.y); ctx.closePath(); ctx.stroke();
      } else {
        this.drawQuad3D(ctx, f0, f1, f2, f3, litColor(rgb, 0.05, -0.05, 0.99, specPow, specAmt));
        if (mat === 'tnt') {
          const t0 = pt(-hw * 0.88, -hh * 0.34, hd + 0.6), t1 = pt(hw * 0.88, -hh * 0.34, hd + 0.6);
          const t2 = pt(hw * 0.88, hh * 0.34, hd + 0.6),   t3 = pt(-hw * 0.88, hh * 0.34, hd + 0.6);
          this.drawQuad3D(ctx, t0, t1, t2, t3, litColor([250, 204, 21], 0, 0, 1, 28, 0.55));
          const fc = pt(0, 0, hd + 1);
          ctx.save();
          ctx.translate(fc.x, fc.y);
          ctx.rotate(rot);
          ctx.fillStyle = '#090514';
          ctx.font = '800 8px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('TNT', 0, 0.5);
          ctx.restore();
        } else if (mat === 'crate') {
          const s0 = pt(-hw * 0.88, -hh * 0.25, hd + 0.6), s1 = pt(hw * 0.88, -hh * 0.25, hd + 0.6);
          const s2 = pt(hw * 0.88, hh * 0.25, hd + 0.6),   s3 = pt(-hw * 0.88, hh * 0.25, hd + 0.6);
          this.drawQuad3D(ctx, s0, s1, s2, s3, litColor([146, 64, 14], 0, 0, 1, 14, 0.25));
          const gem = pt(0, 0, hd + 1);
          ctx.fillStyle = litColor([56, 189, 248], -0.2, -0.3, 0.9, 45, 0.9);
          ctx.beginPath(); ctx.arc(gem.x, gem.y, 4.8 * gem.s, 0, TAU); ctx.fill();
        } else if (frontLabel === 'gift') {
          const v0 = pt(-3, -hh, hd + 0.6), v1 = pt(3, -hh, hd + 0.6), v2 = pt(3, hh, hd + 0.6), v3 = pt(-3, hh, hd + 0.6);
          const h0 = pt(-hw, -3, hd + 0.6), h1 = pt(hw, -3, hd + 0.6), h2 = pt(hw, 3, hd + 0.6), h3 = pt(-hw, 3, hd + 0.6);
          const rCol = litColor([225, 29, 72], 0, -0.2, 0.98, 28, 0.55);
          this.drawQuad3D(ctx, v0, v1, v2, v3, rCol);
          this.drawQuad3D(ctx, h0, h1, h2, h3, rCol);
        }
      }

      // Architectural Plinth & Capital (`pillar`) OR Extruded 3D Crenellated Merlons (`battlement`)!
      if (shape === 'pillar' && mat !== 'tnt' && mat !== 'crate') {
        const capRgb = mat === 'wood' ? [180, 96, 12] : mat === 'obsidian' ? [68, 56, 152] : [148, 163, 184];
        drawLocalSubBox(-hw * 1.1, hw * 1.1, hh * 0.74, hh, -hd * 1.06, hd * 1.08, capRgb, 20, 0.45);
        drawLocalSubBox(-hw * 1.08, hw * 1.08, -hh, -hh * 0.76, -hd * 1.05, hd * 1.07, capRgb, 22, 0.5);
      } else if (shape === 'battlement') {
        const mRgb = mat === 'wood' ? [234, 152, 22] : mat === 'obsidian' ? [68, 56, 152] : [156, 172, 194];
        const ledgeRgb = mat === 'wood' ? [168, 86, 10] : mat === 'obsidian' ? [88, 62, 180] : [186, 198, 214];
        drawLocalSubBox(-hw * 1.06, hw * 1.06, -hh - 2, -hh * 0.52, -hd * 1.04, hd * 1.08, ledgeRgb, 24, 0.55);
        const count = w >= 60 ? Math.min(5, Math.max(3, Math.floor(w / 28))) : 2;
        const mw = w / (count * 2 + 0.4);
        const mh = Math.min(13, Math.max(8, h * 0.36));
        for (let k = 0; k < count; k++) {
          const frac = count === 1 ? 0 : (k / (count - 1) - 0.5) * 2;
          const mx = frac * (hw - mw * 0.62);
          drawLocalSubBox(mx - mw * 0.5, mx + mw * 0.5, -hh - mh, -hh + 1, -hd * 0.92, hd * 1.02, mRgb, 22, 0.5);
        }
      }
    }

    if (hpRatio < 0.68) {
      const c0 = pt(-hw * 0.55, -hh * 0.5, hd + 1), c1 = pt(0, 0, hd + 1), c2 = pt(hw * 0.5, hh * 0.45, hd + 1);
      ctx.strokeStyle = 'rgba(9, 5, 20, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
    }

    ctx.restore();
  }

  // Pointed 3D Gothic Spire / Tapered Pyramid Roof with optional rigid rotation around `(cx, pivotY)`
  drawPyramid3D(ctx, cx, pivotY, cz, w, h, d, rgb, opts = {}) {
    const { specPow = 22, specAmt = 0.5, finialCol = '#fde047', rot = 0, baseOffsetY = 0 } = opts;
    const hw = w * 0.5, hd = d * 0.5;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const camCX = this.camX + this.W * 0.5;
    const camCY = 360;
    const camZ = 740;

    const pRot = (lx, ly, lz) => this.projWorld(cx + lx * cos - ly * sin, pivotY + lx * sin + ly * cos, cz + lz);
    const wPos = (lx, ly, lz) => [cx + lx * cos - ly * sin, pivotY + lx * sin + ly * cos, cz + lz];

    const fl = pRot(-hw, baseOffsetY, hd);
    const fr = pRot(hw, baseOffsetY, hd);
    const bl = pRot(-hw, baseOffsetY, -hd);
    const br = pRot(hw, baseOffsetY, -hd);
    const apex = pRot(0, baseOffsetY - h, 0);

    const sides = [
      { v: [bl, fl, apex], nx: -h, ny: -hw, nz: 0, fc: wPos(-hw * 0.5, baseOffsetY - h * 0.4, 0) },
      { v: [fr, br, apex], nx: h,  ny: -hw, nz: 0, fc: wPos(hw * 0.5, baseOffsetY - h * 0.4, 0) },
      { v: [fl, fr, apex], nx: 0,  ny: -hd, nz: h, fc: wPos(0, baseOffsetY - h * 0.4, hd * 0.5) },
      { v: [br, bl, apex], nx: 0,  ny: -hd, nz: -h, fc: wPos(0, baseOffsetY - h * 0.4, -hd * 0.5) },
    ];
    sides.sort((a, b) => (a.v[0].z + a.v[1].z) - (b.v[0].z + b.v[1].z));

    for (const s of sides) {
      const toX = camCX - s.fc[0], toY = camCY - s.fc[1], toZ = camZ - s.fc[2];
      const rx = s.nx * cos - s.ny * sin;
      const ry = s.nx * sin + s.ny * cos;
      const rz = s.nz;
      const nl = Math.hypot(rx, ry, rz) || 1;
      const nx = rx / nl, ny = ry / nl, nz = rz / nl;
      if (toX * nx + toY * ny + toZ * nz > -20) {
        ctx.fillStyle = litColor(rgb, nx, ny, nz, specPow, specAmt);
        ctx.beginPath();
        ctx.moveTo(s.v[0].x, s.v[0].y);
        ctx.lineTo(s.v[1].x, s.v[1].y);
        ctx.lineTo(s.v[2].x, s.v[2].y);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (finialCol) {
      const tipOff = pRot(0, baseOffsetY - h - 3, 0);
      const frad = Math.max(2, 4.0 * apex.s);
      ctx.fillStyle = finialCol;
      ctx.beginPath();
      ctx.arc(tipOff.x, tipOff.y, frad, 0, TAU);
      ctx.fill();
    }
  }

  // Unified HD Flash Cel-Cartoon Block Renderer (Modular Sprites + Tiled Wood Braces + Ink Cracks)
  drawWeeblBlock(ctx, cx, cy, w, h, mat, shape = 'wall', rot = 0, opts = {}) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !(w > 0) || !(h > 0)) return;
    const isDark = mat === 'obsidian' || mat === 'spire';
    const isPlayer = !!opts.isPlayer;

    ctx.save();
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    if (opts.alpha !== undefined && opts.alpha !== 1) ctx.globalAlpha *= opts.alpha;

    if (mat === 'spire' || shape === 'spire') {
      const spId = isPlayer ? 'p_roof_center' : 'b_purple_spire';
      drawSprite(ctx, spId, 0, 0, w * 1.18, h * 1.14, {
        fallback: (c) => {
          c.fillStyle = isPlayer ? '#2563eb' : '#6d28d9';
          c.strokeStyle = '#000000';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(-w * 0.5, h * 0.45);
          c.lineTo(0, -h * 0.55);
          c.lineTo(w * 0.5, h * 0.45);
          c.closePath();
          c.fill();
          c.stroke();
          c.fillStyle = '#facc15';
          c.beginPath();
          c.arc(0, -h * 0.55, 4.5, 0, TAU);
          c.fill();
          c.stroke();
        },
      });
    } else if (mat === 'wood') {
      drawWoodTrussTile(ctx, w, h);
    } else if (mat === 'glass') {
      drawSprite(ctx, 'b_glass_arch', 0, 0, w * 1.12, h * 1.04, {
        fallback: (c) => {
          c.fillStyle = 'rgba(56, 189, 248, 0.85)';
          c.strokeStyle = '#000000';
          c.lineWidth = 2.6;
          c.beginPath();
          c.roundRect(-w * 0.5, -h * 0.5, w, h, 4);
          c.fill();
          c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.55)';
          c.beginPath();
          c.moveTo(-w * 0.35, -h * 0.38);
          c.lineTo(0, -h * 0.38);
          c.lineTo(-w * 0.35, h * 0.15);
          c.closePath();
          c.fill();
        },
      });
    } else if (mat === 'tnt') {
      drawSprite(ctx, 'b_tnt_barrel', 0, 0, Math.max(w * 1.18, 28), Math.max(h * 1.12, 34), {
        fallback: (c) => {
          c.fillStyle = '#ef4444';
          c.strokeStyle = '#000000';
          c.lineWidth = 2.8;
          c.beginPath();
          c.roundRect(-w * 0.5, -h * 0.5, w, h, 4);
          c.fill();
          c.stroke();
          c.fillStyle = '#facc15';
          c.fillRect(-w * 0.44, -5, w * 0.88, 10);
          c.strokeRect(-w * 0.44, -5, w * 0.88, 10);
        },
      });
      // Live blinking danger spark atop TNT barrel
      ctx.fillStyle = Math.sin(this.time * 12) > 0 ? '#fef08a' : '#ef4444';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -h * 0.46, 3.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (mat === 'crate') {
      drawSprite(ctx, 'b_crate_chest', 0, 0, w * 1.16, h * 1.1, {
        fallback: (c) => {
          c.fillStyle = '#f59e0b';
          c.strokeStyle = '#000000';
          c.lineWidth = 2.8;
          c.beginPath();
          c.roundRect(-w * 0.5, -h * 0.5, w, h, 4);
          c.fill();
          c.stroke();
        },
      });
      if (opts.frontLabel === 'gift') {
        ctx.fillStyle = '#e11d48';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.6;
        ctx.fillRect(-3.5, -h * 0.46, 7, h * 0.92);
        ctx.strokeRect(-3.5, -h * 0.46, 7, h * 0.92);
      }
    } else if (mat === 'obsidian') {
      if (shape === 'battlement' && w > h * 1.35) {
        // Horizontal dark obsidian battlement bridge with crisp crenellated teeth
        ctx.fillStyle = '#312e81';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-w * 0.5, -h * 0.5, w, h, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#4338ca';
        ctx.fillRect(-w * 0.48, -h * 0.45, w * 0.96, h * 0.28);
        const teeth = Math.max(3, Math.floor(w / 26));
        const tw = w / (teeth * 2);
        for (let t = 0; t < teeth; t++) {
          const tx = -w * 0.44 + t * (tw * 2);
          ctx.fillStyle = '#312e81';
          ctx.fillRect(tx, -h * 0.5 - 8, tw, 9);
          ctx.strokeRect(tx, -h * 0.5 - 8, tw, 9);
        }
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.moveTo(0, -5); ctx.lineTo(6, 0); ctx.lineTo(0, 5); ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        drawSprite(ctx, 'b_obsidian_pillar', 0, 0, w * 1.14, h * 1.04, {
          fallback: (c) => {
            c.fillStyle = '#312e81';
            c.strokeStyle = '#000000';
            c.lineWidth = 3;
            c.fillRect(-w * 0.5, -h * 0.5, w, h);
            c.strokeRect(-w * 0.5, -h * 0.5, w, h);
            c.fillStyle = '#6366f1';
            c.fillRect(-w * 0.42, -h * 0.44, w * 0.28, h * 0.88);
          },
        });
      }
    } else if (!isPlayer && w > h * 1.35) {
      // Boss horizontal stone battlement / bridge tiled cleanly with `b_stone_bridge`
      const sp = getSprite('b_stone_bridge');
      const ready = !!(sp && sp.ready());
      const count = Math.max(1, Math.min(3, Math.round(w / 76)));
      const tw = w / count;
      const visH = Math.max(h + 8, Math.min(46, tw * 0.48));
      if (ready) {
        for (let i = 0; i < count; i++) {
          ctx.drawImage(sp.img, -w * 0.5 + i * tw - 1, h * 0.5 + 2 - visH, tw + 2, visH);
        }
      } else {
        ctx.fillStyle = '#64748b';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
        ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
      }
    } else if (isPlayer && shape === 'battlement') {
      // Player castle stone crenellated top wall (`p_stone_battlement`)
      drawSprite(ctx, 'p_stone_battlement', 0, h * 0.5 + 2, w + 10, Math.max(h, 30), {
        anchorX: 0.5,
        anchorY: 1.0,
        fallback: (c) => {
          c.fillStyle = '#94a3b8';
          c.strokeStyle = '#000000';
          c.lineWidth = 3;
          c.fillRect(-w * 0.5, -h * 0.5, w, h);
          c.strokeRect(-w * 0.5, -h * 0.5, w, h);
        },
      });
    } else {
      // Standard Stone Pillar / Wall Masonry (`p_stone_pillar`)
      drawSprite(ctx, 'p_stone_pillar', 0, 0, w * 1.1, h * 1.04, {
        fallback: (c) => {
          c.fillStyle = '#64748b';
          c.strokeStyle = '#000000';
          c.lineWidth = 3;
          c.fillRect(-w * 0.5, -h * 0.5, w, h);
          c.strokeRect(-w * 0.5, -h * 0.5, w, h);
          c.fillStyle = '#94a3b8';
          c.fillRect(-w * 0.42, -h * 0.44, w * 0.3, h * 0.88);
        },
      });
    }

    drawStoneCrackOverlay(ctx, w, h, opts.hpRatio ?? 1, isDark);
    ctx.restore();
  }

  // Multi-Slot Gabled Cobalt Slate Castle Roof Segments (`front`, `rear`, `center` Cupola!)
  drawPlayerCastleRoof3D(ctx, c) {
    const isCenter = c.slot === 'center';
    const yBase = c.y + 4;

    // Crisp Stone Corbel Eaves Beam outlined in bold black ink
    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(c.x - c.w * 0.5, yBase - 4, c.w, 12, 3);
    ctx.fill();
    ctx.stroke();

    if (isCenter) {
      // Central Watch Cupola Lantern Base + Pointed Royal Spire (`p_roof_center`) + Waving Cyan Flag
      ctx.fillStyle = '#64748b';
      ctx.fillRect(c.x - 16, yBase - 16, 32, 14);
      ctx.strokeRect(c.x - 16, yBase - 16, 32, 14);

      drawSprite(ctx, 'p_roof_center', c.x, yBase + 6, 76, 86, {
        fallback: (cc) => {
          cc.fillStyle = '#2563eb';
          cc.strokeStyle = '#000000';
          cc.lineWidth = 3;
          cc.beginPath();
          cc.moveTo(-30, 0); cc.lineTo(0, -78); cc.lineTo(30, 0); cc.closePath();
          cc.fill(); cc.stroke();
        },
      });

      const flap = Math.sin(this.time * 7) * 3.5;
      ctx.fillStyle = '#06b6d4';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(c.x, yBase - 78);
      ctx.lineTo(c.x + 22, yBase - 73 + flap);
      ctx.lineTo(c.x, yBase - 65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Flanking Sloped Cobalt Gable Roof (`p_roof_side`)
      const rw = c.w + 14;
      const rh = Math.round(rw * 0.62);
      drawSprite(ctx, 'p_roof_side', c.x, yBase + 6, rw, rh, {
        flipX: c.slot === 'rear',
        fallback: (cc) => {
          cc.fillStyle = '#2563eb';
          cc.strokeStyle = '#000000';
          cc.lineWidth = 3;
          cc.beginPath();
          cc.moveTo(-rw * 0.5, 0);
          cc.lineTo(0, -rh * 0.86);
          cc.lineTo(rw * 0.5, 0);
          cc.closePath();
          cc.fill();
          cc.stroke();
        },
      });
    }

    const rr = clamp(c.hp / c.maxHp, 0, 1);
    if (rr < 0.99) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(c.x - 21, yBase - 4, 42, 6);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(c.x - 21, yBase - 4, 42, 6);
      ctx.fillStyle = rr > 0.45 ? '#38bdf8' : '#fb7185';
      ctx.fillRect(c.x - 19, yBase - 2.5, 38 * rr, 3);
    }
    ctx.restore();
  }

  // Smooth Blinn-Phong 3D Lit Sphere (zero 2D outline ring!)
  drawSphere3D(ctx, x, y, r, rgb, rimRgb = [139, 92, 246]) {
    const g = ctx.createRadialGradient(x - r * 0.36, y - r * 0.36, Math.max(1, r * 0.08), x, y, r);
    g.addColorStop(0, litColor(rgb, -0.48, -0.62, 0.62, 34, 0.9));
    g.addColorStop(0.5, litColor(rgb, 0, 0, 0.98, 16, 0.35));
    g.addColorStop(0.88, litColor(rgb, 0.5, 0.6, 0.3, 8, 0.05));
    g.addColorStop(1, `rgb(${rimRgb[0]},${rimRgb[1]},${rimRgb[2]})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r), 0, TAU);
    ctx.fill();
  }

  // ---------- Unified 3D Icons & 3D Anvil Forge Pit ----------

  drawHeart(ctx, x, y, r, alive) {
    drawSprite(ctx, 'hud_heart', x, y, r * 2.25, r * 2.05, {
      alpha: alive ? 1 : 0.28,
      fallback: (c) => {
        c.fillStyle = alive ? '#f43f5e' : '#334155';
        c.strokeStyle = '#000000';
        c.lineWidth = 2.6;
        c.beginPath();
        c.moveTo(0, r * 0.72);
        c.bezierCurveTo(-r * 1.1, r * 0.1, -r * 1.05, -r * 0.85, 0, -r * 0.3);
        c.bezierCurveTo(r * 1.05, -r * 0.85, r * 1.1, r * 0.1, 0, r * 0.72);
        c.fill();
        c.stroke();
      },
    });
  }

  drawAmmoOrb(ctx, x, y, r, type, rot = 0) {
    const size = Math.max(4, r * 2.24);
    drawSprite(ctx, 'boulder_rock', x, y, size, size, {
      rot,
      fallback: (c) => {
        c.fillStyle = '#94a3b8';
        c.strokeStyle = '#000000';
        c.lineWidth = Math.max(1.8, r * 0.18);
        c.beginPath();
        c.arc(0, 0, Math.max(1, r), 0, TAU);
        c.fill();
        c.stroke();
        c.fillStyle = '#e2e8f0';
        c.beginPath();
        c.arc(-r * 0.28, -r * 0.28, Math.max(1, r * 0.35), 0, TAU);
        c.fill();
      },
    });
  }

  drawScrapGear(ctx, x, y, r) {
    const size = Math.max(4, r * 2.35);
    drawSprite(ctx, 'hud_gear', x, y, size, size, {
      rot: this.time * 0.65,
      fallback: (c) => {
        c.fillStyle = '#facc15';
        c.strokeStyle = '#000000';
        c.lineWidth = Math.max(1.5, r * 0.2);
        const teeth = 8;
        c.beginPath();
        for (let i = 0; i < teeth * 2; i++) {
          const a = (i / (teeth * 2)) * TAU;
          const rad = i % 2 === 0 ? r : r * 0.74;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = '#0f172a';
        c.beginPath();
        c.arc(0, 0, Math.max(1, r * 0.28), 0, TAU);
        c.fill();
        c.stroke();
      },
    });
  }

  drawHammerAndAnvil(ctx, r) {
    const cx = r.x + r.w * 0.5;
    const ax = cx + 8;
    const baseBottomY = r.y + r.h - 4;
    const backFrac = 0.5 - 0.5 * Math.cos(this.hammerPhase * TAU); // 0 = ON ANVIL, 1 = FULL BACKSWING
    const squash = this.anvilSquash || 0;

    // 1. Crisp Weebl Comic Console Frame (bold black ink border + hard drop shadow)
    drawComicPanel(ctx, r.x, r.y, r.w, r.h, 14, this.anvilFlash > 0.2 ? '#4c1d95' : '#1e293b', {
      stroke: this.heatStreak >= 2 ? '#facc15' : '#000000',
      lineWidth: 3.5,
      shadowDx: 3,
      shadowDy: 4,
      glossColor: 'rgba(255, 255, 255, 0.14)',
    });

    // Inner recessed hearth pit (clips starburst background only; anvil & hammer overlap cleanly!)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x + 114, r.y + 8, 198, r.h - 16, 10);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.clip();

    // Comic Spiky Forge Hearth Burst behind the Anvil
    const burstR = backFrac <= 0.22 || this.anvilFlash > 0.15 ? 88 : 64;
    drawComicStarburst(
      ctx,
      ax - 8,
      baseBottomY - 56,
      burstR,
      burstR * 0.58,
      12,
      this.anvilFlash > 0.2 ? '#fef08a' : '#ea580c',
      '#000000',
      this.time * 0.6,
      2
    );
    ctx.restore();

    // 2. Massive Oak Stump & Steel Anvil (`anvil_stump.png`: 313x308) clipped cleanly inside Forge console
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 12);
    ctx.clip();

    const anvilW = 94;
    const anvilH = 92;
    drawSprite(ctx, 'anvil_stump', ax - 8, baseBottomY + squash * 4, anvilW, anvilH, {
      sx: 1 + squash * 0.08,
      sy: 1 - squash * 0.12,
      flashAlpha: this.anvilFlash > 0.35 ? 0.55 : 0,
      fallback: (c) => {
        c.fillStyle = '#92400e';
        c.strokeStyle = '#000000';
        c.lineWidth = 3;
        c.fillRect(-34, -46, 68, 46);
        c.strokeRect(-34, -46, 68, 46);
        c.fillStyle = '#94a3b8';
        c.fillRect(-48, -92, 96, 30);
        c.strokeRect(-48, -92, 96, 30);
      },
    });

    // 3. Sizzling Comic Molten Steel Billet atop the Anvil Strike Table (`topTableY = 0.023`)
    const ingotY = baseBottomY - anvilH * (1 - 0.023) - 2 + squash * 4;
    ctx.save();
    ctx.fillStyle = backFrac <= 0.18 || this.heatStreak >= 2 ? '#fef08a' : '#f97316';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(ax - 24, ingotY - 6, 34, 10, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ax - 17, ingotY - 4, 18, 3);
    ctx.restore();

    // 4. Crisp Bold-Inked Swing Timing Gauge Arc
    const hitX = ax - 8;
    const hitY = ingotY - 4;
    const pivX = ax + 62;
    const pivY = baseBottomY - 24;
    const dx = hitX - pivX;
    const dy = hitY - pivY;
    const handleL = Math.hypot(dx, dy);
    const strikeAng = Math.atan2(dy, dx);
    const backSpan = 0.60;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 15;
    ctx.beginPath(); ctx.arc(pivX, pivY, handleL, strikeAng - 0.04, strikeAng + backSpan); ctx.stroke();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(pivX, pivY, handleL, strikeAng, strikeAng + backSpan); ctx.stroke();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(pivX, pivY, handleL, strikeAng, strikeAng + backSpan * 0.42); ctx.stroke();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(pivX, pivY, handleL, strikeAng - 0.04, strikeAng + backSpan * 0.16); ctx.stroke();
    ctx.restore();

    // 5. Giant Articulated Sledgehammer (`sledgehammer.png`: grip at x=0.90, head at x=0.190)
    const slamBoost = this.hammerSlamT > 0 ? Math.sin(this.hammerSlamT * Math.PI) * 0.25 : 0;
    const curAng = Math.max(strikeAng, strikeAng + backFrac * backSpan - slamBoost);
    const hammerW = Math.round(handleL / 0.71);
    const hammerH = Math.round(hammerW * (160 / 329));
    drawSprite(ctx, 'sledgehammer', pivX, pivY, hammerW, hammerH, {
      rot: curAng - Math.PI,
      fallback: (c) => {
        c.strokeStyle = '#000000';
        c.lineWidth = 9;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(-handleL, 0); c.stroke();
        c.strokeStyle = '#d97706';
        c.lineWidth = 5;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(-handleL, 0); c.stroke();
        c.fillStyle = '#cbd5e1';
        c.strokeStyle = '#000000';
        c.lineWidth = 3;
        c.fillRect(-handleL - 12, -16, 24, 32);
        c.strokeRect(-handleL - 12, -16, 24, 32);
      },
    });

    // Spiky Flash Impact Star when striking!
    if (this.anvilFlash > 0.3) {
      drawComicStarburst(ctx, hitX, hitY - 4, 24 * this.anvilFlash, 10 * this.anvilFlash, 8, '#fef08a', '#000000', this.time * 12, 2.2);
    }
    ctx.restore();

    // 6. Crisp Left & Right Wing Comic Readouts (leaving X=128..326 unobstructed for Forge!)
    drawComicText(ctx, 'ANVIL FORGE', r.x + 14, r.y + 28, '900 13px Fredoka, sans-serif', '#facc15', {
      align: 'left', strokeWidth: 3.5, shadow: true,
    });
    drawComicText(ctx, 'TAP TO STRIKE', r.x + 14, r.y + 50, '800 11px Outfit, sans-serif', '#f8fafc', {
      align: 'left', strokeWidth: 3,
    });
    if (this.heatStreak >= 2) {
      drawComicPanel(ctx, r.x + 14, r.y + 72, 86, 24, 8, '#ea580c', { lineWidth: 2.5, shadowDx: 2, shadowDy: 2 });
      drawComicText(ctx, `HEAT x${this.heatStreak}!`, r.x + 57, r.y + 84, '900 11px Fredoka, sans-serif', '#fef08a', {
        strokeWidth: 3,
      });
    }

    this.drawScrapGear(ctx, r.x + r.w - 24, r.y + 28, 12);
    drawComicText(ctx, '+SCRAP', r.x + r.w - 40, r.y + 28, '900 12px Fredoka, sans-serif', '#facc15', {
      align: 'right', strokeWidth: 3.5,
    });
    drawComicText(ctx, this.anvilMsg.slice(0, 18), r.x + r.w - 14, r.y + 62, '800 11px Outfit, sans-serif', this.anvilFlash > 0 ? '#fde047' : '#cbd5e1', {
      align: 'right', strokeWidth: 3,
    });
  }

  // ---------- Handcrafted Diorama Block, Torch & Environment Art ----------

  drawMaterialBlock(ctx, w, h, mat, hpRatio = 1) {
    const st = MAT_STYLE[mat];
    if (mat === 'glass') {
      ctx.save();
      traceRoundRect(ctx, -w / 2, -h / 2, w, h, 5);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.fill();
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Diagonal diamond glare reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.beginPath();
      ctx.moveTo(-w * 0.35, -h * 0.4);
      ctx.lineTo(-w * 0.05, -h * 0.4);
      ctx.lineTo(-w * 0.35, h * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      drawToyBevelRect(ctx, -w / 2, -h / 2, w, h, 5, st.fill, { rimColor: st.rim });
      if (mat === 'wood') {
        // Plank seams, cross brace & brass nails
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-w * 0.42, 0); ctx.lineTo(w * 0.42, 0);
        ctx.moveTo(-w * 0.36, -h * 0.38); ctx.lineTo(w * 0.36, h * 0.38);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        for (const [nx, ny] of [[-w * 0.32, -h * 0.34], [w * 0.32, -h * 0.34], [-w * 0.32, h * 0.34], [w * 0.32, h * 0.34]]) {
          ctx.beginPath(); ctx.arc(nx, ny, 1.5, 0, TAU); ctx.fill();
        }
      } else if (mat === 'stone') {
        // Carved stone mortar lines & steel corner rivets
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-w * 0.42, -h * 0.1); ctx.lineTo(w * 0.42, -h * 0.1);
        ctx.moveTo(0, -h * 0.44); ctx.lineTo(0, -h * 0.1);
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        for (const [nx, ny] of [[-w * 0.34, -h * 0.34], [w * 0.34, -h * 0.34]]) {
          ctx.beginPath(); ctx.arc(nx, ny, 1.6, 0, TAU); ctx.fill();
        }
      } else if (mat === 'tnt') {
        // Hazard yellow band, steel hoops, blinking red danger LED & clean TNT mark
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-w * 0.42, -5, w * 0.84, 10);
        ctx.fillStyle = '#090514';
        ctx.fillRect(-w * 0.42, -6, w * 0.84, 2);
        ctx.fillRect(-w * 0.42, 4, w * 0.84, 2);
        ctx.fillStyle = Math.sin(this.time * 10) > 0 ? '#fff' : '#fb923c';
        ctx.beginPath(); ctx.arc(0, -h * 0.3, 2.8, 0, TAU); ctx.fill();
        ctx.fillStyle = '#090514';
        ctx.font = '800 8px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TNT', 0, 0.5);
        ctx.textBaseline = 'alphabetic';
      } else if (mat === 'crate') {
        // Royal gold treasure chest clasp & oak bands
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-w * 0.42, -h * 0.16, w * 0.84, h * 0.24);
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#090514';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }

    if (hpRatio < 0.68) {
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w * 0.28, -h * 0.26);
      ctx.lineTo(-w * 0.04, 0);
      ctx.lineTo(w * 0.24, h * 0.24);
      ctx.stroke();
    }
  }

  drawTorchFlame(ctx, x, y, colA = '#fde047', colB = '#f97316') {
    const flick = Math.sin(this.time * 18 + x) * 3.0;
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.4;
    ctx.fillRect(x - 4, y - 1, 8, 16);
    ctx.strokeRect(x - 4, y - 1, 8, 16);

    ctx.fillStyle = colB;
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.quadraticCurveTo(x - 9, y - 11, x + flick, y - 22);
    ctx.quadraticCurveTo(x + 9, y - 11, x + 7, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colA;
    ctx.beginPath();
    ctx.moveTo(x - 3.5, y);
    ctx.quadraticCurveTo(x + flick * 0.5, y - 12, x + 3.5, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  render() {
    const ctx = this.ctx;
    const { W } = this;
    const off = this.fx.offset();

    ctx.save();
    ctx.translate(off.x, off.y);

    // 1. Crisp HD Flash Cartoon Sky Backdrop (Bright Cerulean Day-Dusk to Dark Boss Sky)
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y + 40);
    sky.addColorStop(0, STYLE_TOKENS.skyTop);
    sky.addColorStop(0.5, STYLE_TOKENS.skyMid);
    sky.addColorStop(0.86, STYLE_TOKENS.skyLow);
    sky.addColorStop(1, STYLE_TOKENS.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND_Y + 45);

    // Dramatic Violet Citadel Sky Shift across right half of battlefield
    const curseAlpha = clamp(0.14 + (this.camX / 430) * 0.42, 0.14, 0.56);
    const curseGrad = ctx.createLinearGradient(0, 0, W, GROUND_Y);
    curseGrad.addColorStop(0, 'rgba(0,0,0,0)');
    curseGrad.addColorStop(0.45, 'rgba(88, 28, 135, 0.18)');
    curseGrad.addColorStop(1, `rgba(76, 29, 149, ${curseAlpha})`);
    ctx.fillStyle = curseGrad;
    ctx.fillRect(0, 0, W, GROUND_Y + 45);

    // Crisp Twinkling Cartoon Sparkle Dots (`0.08x` parallax)
    for (const st of this.stars) {
      const sx = ((st.x - this.camX * 0.08) % W + W) % W;
      const a = 0.35 + 0.55 * Math.sin(this.time * 2.8 + st.tw);
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.beginPath(); ctx.arc(sx, st.y, st.r * 1.15, 0, TAU); ctx.fill();
    }

    // Comic Crescent Moon (`sky_moon.png`, `0.12x` parallax)
    const mx = 108 - this.camX * 0.12;
    const my = this.hasReelHud ? 202 : 142;
    drawSprite(ctx, 'sky_moon', mx, my, 62, 65, {
      fallback: (c) => {
        c.fillStyle = '#fef08a';
        c.strokeStyle = '#000000';
        c.lineWidth = 3;
        c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill(); c.stroke();
      },
    });

    // Crisp Inked Cartoon Clouds (`cloud_1.png` & `cloud_2.png`, `0.22x` parallax)
    for (let idx = 0; idx < this.clouds.length; idx++) {
      const cl = this.clouds[idx];
      const cx = cl.x - this.camX * 0.22;
      const cy = this.hasReelHud ? Math.max(176, cl.y + 42) : cl.y;
      const id = idx % 2 === 0 ? 'cloud_1' : 'cloud_2';
      drawSprite(ctx, id, cx, cy, cl.w, cl.w * 0.58, {
        alpha: 0.92,
        fallback: (c) => {
          c.fillStyle = '#ffffff';
          c.strokeStyle = '#000000';
          c.lineWidth = 2.6;
          c.beginPath();
          c.roundRect(-cl.w * 0.45, -14, cl.w * 0.9, 28, 14);
          c.fill();
          c.stroke();
        },
      });
    }

    // Far Horizon Cel-Shaded Cartoon Mountains (`0.26x` parallax) with Bold Black Ink Outlines
    ctx.lineJoin = 'round';
    for (let i = 0; i < 6; i++) {
      const hx = i * 165 - this.camX * 0.26;
      const peakX = hx + 18;
      const peakY = i >= 3 ? GROUND_Y - 148 : GROUND_Y - 112;
      const baseW = 92;
      ctx.fillStyle = i >= 3 ? '#4338ca' : '#3b82f6';
      ctx.beginPath(); ctx.moveTo(hx - baseW, GROUND_Y + 14); ctx.lineTo(peakX, peakY); ctx.lineTo(peakX + 8, GROUND_Y + 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = i >= 3 ? '#1e1b4b' : '#1d4ed8';
      ctx.beginPath(); ctx.moveTo(peakX, peakY); ctx.lineTo(hx + baseW, GROUND_Y + 14); ctx.lineTo(peakX + 8, GROUND_Y + 14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(hx - baseW, GROUND_Y + 14);
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(hx + baseW, GROUND_Y + 14);
      ctx.stroke();
    }

    // Near Foothills Cel Ridge (`0.48x` parallax: green grass hills left, jagged dark crystal peaks right!)
    for (let i = 0; i < 6; i++) {
      const nx = i * 180 - this.camX * 0.48;
      const peakY = i >= 3 ? GROUND_Y - 94 : GROUND_Y - 78;
      const peakX = i >= 3 ? nx + 6 : nx + 10;
      ctx.fillStyle = i >= 3 ? '#312e81' : '#22c55e';
      ctx.beginPath(); ctx.moveTo(nx - 78, GROUND_Y + 14); ctx.lineTo(peakX, peakY); ctx.lineTo(peakX + 4, GROUND_Y + 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = i >= 3 ? '#1e1b4b' : '#15803d';
      ctx.beginPath(); ctx.moveTo(peakX, peakY); ctx.lineTo(nx + 84, GROUND_Y + 14); ctx.lineTo(peakX + 4, GROUND_Y + 14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(nx - 78, GROUND_Y + 14);
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(nx + 84, GROUND_Y + 14);
      ctx.stroke();
    }

    // 2. World Space Diorama Stage (`camX` panned)
    ctx.save();
    ctx.translate(-this.camX, 0);

    // Bubbling Cartoon Lava Chasm (`X=278..472`)
    ctx.fillStyle = STYLE_TOKENS.lavaOuter;
    ctx.fillRect(278, GROUND_Y + 6, 194, 72);
    ctx.fillStyle = STYLE_TOKENS.lavaMid;
    ctx.fillRect(278, GROUND_Y + 6, 194, 18);
    ctx.fillStyle = STYLE_TOKENS.lavaCore;
    ctx.beginPath();
    ctx.moveTo(278, GROUND_Y + 14);
    for (let lx = 278; lx <= 472; lx += 16) {
      const wave = Math.sin(this.time * 4.5 + lx * 0.08) * 3.5;
      ctx.lineTo(lx, GROUND_Y + 9 + wave);
    }
    ctx.lineTo(472, GROUND_Y + 18);
    ctx.lineTo(278, GROUND_Y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let lx = 278; lx <= 472; lx += 16) {
      const wave = Math.sin(this.time * 4.5 + lx * 0.08) * 3.5;
      if (lx === 278) ctx.moveTo(lx, GROUND_Y + 9 + wave);
      else ctx.lineTo(lx, GROUND_Y + 9 + wave);
    }
    ctx.stroke();

    // Popping Cartoon Lava Bubbles & Inked Rising Embers
    for (let bx = 304; bx < 455; bx += 36) {
      const br = 3.5 + Math.abs(Math.sin(this.time * 3.5 + bx)) * 4.5;
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, GROUND_Y + 10, br, 0, TAU); ctx.fill(); ctx.stroke();
    }
    for (const em of this.embers) {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(em.x, em.y, em.r, 0, TAU); ctx.fill(); ctx.stroke();
    }

    // Left Emerald Meadow Cliff (`X=-40..286`): crisp base slab + `cliff_left.png` + cliff torch
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-40, GROUND_Y + 10, 326, 60);
    ctx.fillStyle = STYLE_TOKENS.grassTop;
    ctx.fillRect(-40, GROUND_Y - 2, 326, 16);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-40, GROUND_Y - 2); ctx.lineTo(286, GROUND_Y - 2); ctx.lineTo(286, GROUND_Y + 60);
    ctx.stroke();
    drawSprite(ctx, 'cliff_left', 126, GROUND_Y - 8, 324, 150, {});
    this.drawWeeblBlock(ctx, 275, GROUND_Y - 12, 20, 26, 'stone', 'pillar', 0, { isPlayer: true });
    this.drawTorchFlame(ctx, 275, GROUND_Y - 27, '#fde047', '#f97316');

    // Right Dark Obsidian Boss Stage (`X=464..WORLD_W+50`): stone foundation + `cliff_right.png` + braziers
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(464, GROUND_Y + 10, WORLD_W - 414, 60);
    ctx.fillStyle = '#4338ca';
    ctx.fillRect(464, GROUND_Y - 2, WORLD_W - 414, 14);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(464, GROUND_Y + 60); ctx.lineTo(464, GROUND_Y - 2); ctx.lineTo(WORLD_W + 50, GROUND_Y - 2);
    ctx.stroke();
    drawSprite(ctx, 'cliff_right', 592, GROUND_Y - 8, 258, 150, {});
    drawSprite(ctx, 'cliff_right', 816, GROUND_Y - 8, 224, 150, { flipX: true });
    this.drawWeeblBlock(ctx, 474, GROUND_Y - 12, 22, 26, 'obsidian', 'pillar', 0, { isPlayer: false });
    this.drawTorchFlame(ctx, 474, GROUND_Y - 27, '#e9d5ff', '#a855f7');
    this.drawTorchFlame(ctx, 858, GROUND_Y - 24, '#e9d5ff', '#a855f7');

    // Phase 3 Telegraphed Comic Lightning Columns
    for (const bt of this.bolts) {
      if (bt.warnT > 0) {
        const alpha = 0.28 + 0.35 * Math.sin(this.time * 22);
        ctx.fillStyle = `rgba(192, 132, 252, ${alpha})`;
        ctx.fillRect(bt.x - 18, 120, 36, GROUND_Y - 120);
        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(bt.x - 18, 120, 36, GROUND_Y - 120);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = '#e879f9';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.fillRect(bt.x - 18, 120, 36, GROUND_Y - 120);
        ctx.strokeRect(bt.x - 18, 120, 36, GROUND_Y - 120);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bt.x - 6, 120, 12, GROUND_Y - 120);
      }
    }

    // Bastion Standard Flagpole + Waving Cyan Cartoon Banner
    const bx = SLING.x - 52;
    const by = GROUND_Y - 46;
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.4;
    ctx.fillRect(bx + 5, by - 46, 5, 46);
    ctx.strokeRect(bx + 5, by - 46, 5, 46);
    const flap = Math.sin(this.time * 6) * 4;
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(bx + 9, by - 44);
    ctx.quadraticCurveTo(bx - 10, by - 42 + flap, bx - 26, by - 36 - flap * 0.5);
    ctx.lineTo(bx + 9, by - 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Player Built Multi-Part Stone Castle (`X=28..250`) + 3-Slot Gabled Roof (`front`, `rear`, `center`)
    for (const pb of this.playerBlocks) {
      const sh = pb.shape || 'wall';
      this.drawWeeblBlock(ctx, pb.x, pb.y, pb.w, pb.h, pb.mat, sh, 0, {
        isPlayer: true,
        hpRatio: pb.hp / pb.maxHp,
      });
      const ratio = pb.hp / pb.maxHp;
      if (ratio < 0.99) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(pb.x - 11, pb.y + pb.h / 2 - 7, 22, 5);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(pb.x - 11, pb.y + pb.h / 2 - 7, 22, 5);
        ctx.fillStyle = ratio > 0.5 ? '#4ade80' : '#fb7185';
        ctx.fillRect(pb.x - 10, pb.y + pb.h / 2 - 6, 20 * ratio, 3);
      }
    }

    for (const rf of this.canopies) {
      this.drawPlayerCastleRoof3D(ctx, rf);
    }

    // Slingshot Carved Stone Bastion Pedestal (`stone_bastion_pedestal.png` w/ 5 ammo sockets!)
    drawSprite(ctx, 'stone_bastion_pedestal', PEDESTAL_GEO.drawX, PEDESTAL_GEO.bottomY, PEDESTAL_GEO.drawW, PEDESTAL_GEO.drawH, {
      fallback: (c) => {
        c.fillStyle = '#64748b';
        c.strokeStyle = '#000000';
        c.lineWidth = 3;
        c.fillRect(-54, -72, 108, 72);
        c.strokeRect(-54, -72, 108, 72);
      },
    });

    // Previous-Shot Ghost Arc (Crisp comic dot sight aid!)
    const arcPts = this.lastShotArc || [];
    for (let i = 0; i < arcPts.length; i++) {
      const pt = arcPts[i];
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * (1 - i / 42)})`;
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.45 * (1 - i / 42)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.2, 0, TAU); ctx.fill(); ctx.stroke();
    }

    // Subtle Aim Halo around Slingshot when idle
    if (!this.aiming && this.camX < 40 && this.ammoQueue.length > 0) {
      const rHalo = 36 + Math.sin(this.time * 4) * 4;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.6;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(SLING.x, SLING.y, rHalo, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Active Live Aim Trajectory Dots
    const pullMag = Math.hypot(this.pullX, this.pullY);
    if (this.aiming && pullMag >= 22) {
      const power = clamp(pullMag / 128, 0.3, 1) * 900;
      const ang = Math.atan2(this.pullY, this.pullX);
      const vx = Math.cos(ang) * power;
      const vy = Math.sin(ang) * power;
      for (let step = 1; step <= 22; step++) {
        const t = step * 0.055;
        const px = SLING.x + vx * t;
        const py = SLING.y + vy * t + 0.5 * GRAVITY * t * t;
        if (py > GROUND_Y) break;
        const rad = Math.max(2.6, 5.6 - step * 0.14);
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }

    // Pristine HD 3D Crowned Hero Bean Slingshot Artilleryman (aim_pull / throw / cheer / hurt)
    const heroSy = this.aiming ? 0.90 : 1 + Math.sin(this.time * 5.0) * 0.035;
    const heroSx = 2 - heroSy;
    const isThrowing = (this.shots || []).some((s) => s.age < 0.42);
    const heroState =
      this.playerHurtT > 0 ? 'hurt'
      : this.won ? 'cheer'
      : this.aiming ? 'aim_pull'
      : isThrowing ? 'throw'
      : 'stand_alert';
    drawHeroCharacter(ctx, SLING.x - 28, 524, 50, {
      view: 'threeQuarterFront',
      dir: 1,
      state: heroState,
      expr: this.playerHurtT > 0 ? 'panic' : this.aiming ? 'focus' : 'happy',
      t: this.time * 4,
      squashX: heroSx,
      squashY: heroSy,
      lean: this.aiming ? -0.10 : 0,
    });

    const activeIdx = clamp(this.selectedAmmoIdx, 0, Math.max(0, this.ammoQueue.length - 1));
    const nextAmmo = this.ammoQueue[activeIdx];
    const rockX = this.aiming ? SLING.x - this.pullX * 0.38 : SLING.x;
    const rockY = this.aiming ? SLING.y - this.pullY * 0.38 : SLING.y;
    const horns = getSlingHornPoints();

    // Back Slingshot Rubber Band
    if (nextAmmo) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 8.5;
      ctx.beginPath(); ctx.moveTo(horns.right.x, horns.right.y); ctx.lineTo(rockX, rockY); ctx.stroke();
      ctx.strokeStyle = '#be123c'; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.moveTo(horns.right.x, horns.right.y); ctx.lineTo(rockX, rockY); ctx.stroke();
    }

    // Wooden Y-Fork (`slingshot_fork.png`)
    drawSprite(ctx, 'slingshot_fork', SLING_GEO.baseX, SLING_GEO.bottomY, SLING_GEO.drawW, SLING_GEO.drawH, {
      fallback: (c) => {
        c.strokeStyle = '#000000'; c.lineWidth = 10; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -28); c.lineTo(-14, -56); c.moveTo(0, -28); c.lineTo(14, -56); c.stroke();
        c.strokeStyle = '#92400e'; c.lineWidth = 6;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -28); c.lineTo(-14, -56); c.moveTo(0, -28); c.lineTo(14, -56); c.stroke();
      },
    });

    // Loaded Projectile + Front Rubber Band attached cleanly to Left Y-Horn
    if (nextAmmo) {
      this.drawAmmoOrb(ctx, rockX, rockY, AMMO_META[nextAmmo].r, nextAmmo);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 8.5;
      ctx.beginPath(); ctx.moveTo(horns.left.x, horns.left.y); ctx.lineTo(rockX, rockY); ctx.stroke();
      ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.moveTo(horns.left.x, horns.left.y); ctx.lineTo(rockX, rockY); ctx.stroke();
    }

    // 5 In-World Pedestal Sockets (`stone_bastion_pedestal.png` exact holes!)
    const pedReady = !!(getSprite('stone_bastion_pedestal')?.ready());
    for (let i = 0; i < this.maxAmmo; i++) {
      const sp = this.pedestalSlotPos(i);
      if (!pedReady) {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 8.2, 0, TAU); ctx.fill(); ctx.stroke();
      }
      if (this.ammoQueue[i]) {
        if (i === activeIdx) {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.arc(sp.x, sp.y, 9.6, 0, TAU); ctx.stroke();
        }
        this.drawAmmoOrb(ctx, sp.x, sp.y, 9.0, this.ammoQueue[i]);
      }
    }

    // Parachuting Supply Chests (`b_crate_chest.png` + Comic Red/White Chute!)
    for (const c of this.crates) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(c.x - 10, c.y - 10); ctx.lineTo(c.x - 20, c.y - 34);
      ctx.moveTo(c.x + 10, c.y - 10); ctx.lineTo(c.x + 20, c.y - 34);
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(c.x, c.y - 34, 21, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(c.x - 8, c.y - 34);
      ctx.arc(c.x, c.y - 34, 21, Math.PI + 1.0, TAU - 1.0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      this.drawWeeblBlock(ctx, c.x, c.y, 30, 26, 'crate', 'crate', Math.sin(this.time * 2) * 0.12, {
        frontLabel: 'gift',
      });
    }

    // Floating Comic Balloon Imps (`balloon_imp.png`)
    for (const imp of this.imps) {
      drawSprite(ctx, 'balloon_imp', imp.x, imp.y, 44, 88, {
        rot: Math.sin(this.time * 6 + imp.x * 0.08) * 0.14,
        fallback: (c) => {
          c.strokeStyle = '#000000';
          c.lineWidth = 2.6;
          c.beginPath(); c.moveTo(0, -10); c.lineTo(0, -34); c.stroke();
          c.fillStyle = '#a855f7';
          c.beginPath(); c.arc(0, -40, 13, 0, TAU); c.fill(); c.stroke();
          c.fillStyle = '#e11d48';
          c.beginPath(); c.arc(0, 0, imp.r, 0, TAU); c.fill(); c.stroke();
        },
      });
    }

    // 100% Knock-Downable Boss Citadel Blocks
    for (const b of this.blocks) {
      this.drawWeeblBlock(ctx, b.x, b.y, b.w, b.h, b.mat, b.shape || 'wall', b.rot, {
        isPlayer: false,
        hpRatio: b.hp / b.maxHp,
        alpha: b.mat === 'glass' ? 0.92 : 1,
      });
    }

    // Hard Ink Ground Shadow + Puppet-Rigged Lord Brim & Floating Gloves
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(this.boss.x, GROUND_Y + 4, this.boss.r * 1.15, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    this.drawLordBrim3D(ctx, this.boss.x, this.boss.y);
    for (const h of this.hands) this.drawFloatingHand3D(ctx, h);

    // Active Player Projectiles with Crisp Black-Inked Speed Trails
    for (const s of this.shots) {
      if (s.trail.length > 1) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(s.trail[0].x, s.trail[0].y);
        for (const pt of s.trail) ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.trail[0].x, s.trail[0].y);
        for (const pt of s.trail) ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
      this.drawAmmoOrb(ctx, s.x, s.y, s.r, s.type, s.rot);
    }

    // Flaming Spiked Mortar Shots (`flaming_mortar.png`, oriented nose-first along velocity)
    for (const es of this.enemyShots) {
      const mRot = Math.atan2(es.vy, es.vx) - Math.PI;
      if (es.reflected) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(es.x, es.y, es.r + 5, 0, TAU); ctx.stroke();
      }
      drawSprite(ctx, 'flaming_mortar', es.x, es.y, es.r * 5.0, es.r * 2.6, {
        rot: mRot,
        fallback: (c) => {
          c.fillStyle = es.reflected ? '#38bdf8' : '#ef4444';
          c.strokeStyle = '#000000';
          c.lineWidth = 2.6;
          c.beginPath(); c.arc(0, 0, es.r, 0, TAU); c.fill(); c.stroke();
        },
      });
    }

    ctx.restore(); // End World Space

    // 3. Flying Unified Scrap Pickups (Crisp comic badges flying to top-right floating Scrap counter) & FX
    const hudHeartY = this.hasReelHud ? 112 : 38;
    const hudScrapY = this.hasReelHud ? 148 : 38;
    for (const fs of this.flyingScrap) {
      const x = fs.x + (380 - fs.x) * fs.t;
      const y = fs.y + (hudScrapY - fs.y) * fs.t;
      drawComicPanel(ctx, x - 21, y - 11, 42, 22, 11, '#facc15', { lineWidth: 2.5, shadowDx: 2, shadowDy: 2 });
      drawComicText(ctx, `+${fs.amount}`, x, y, '900 11px Fredoka, sans-serif', '#ffffff', { strokeWidth: 3 });
    }
    this.fx.render(ctx);

    // 4. ULTRA-CLEAN FLOATING SKY HUD (No dark header bar — large Hearts & Scrap float in the sky!)
    const heartR = this.hasReelHud ? 15.5 : 16.5;
    const heartGap = this.hasReelHud ? 39 : 42;
    for (let i = 0; i < this.maxHearts; i++) {
      this.drawHeart(ctx, 32 + i * heartGap, hudHeartY, heartR, i < this.hearts);
    }

    // Large Floating SCRAP Counter (`hud_gear.png` + bold black-inked sky typography)
    this.drawScrapGear(ctx, 294, hudScrapY, this.hasReelHud ? 18 : 19);
    drawComicText(ctx, 'SCRAP', 322, hudScrapY + 1, '900 14px Outfit, sans-serif', '#ffffff', { align: 'left', strokeWidth: 4.2, shadow: true });
    drawComicText(ctx, `${this.scrap}`, 434, hudScrapY + 1, '900 30px Fredoka, sans-serif', '#facc15', { align: 'right', strokeWidth: 5.5, shadow: true });

    // Quick Return Button when viewing Boss Citadel
    if (this.camX > 50) {
      drawComicPanel(ctx, this.ui.backSling.x, this.ui.backSling.y, this.ui.backSling.w, this.ui.backSling.h, 10, '#f59e0b', {
        lineWidth: 3, shadowDx: 2, shadowDy: 3,
      });
      drawComicText(ctx, '< SLINGSHOT', this.ui.backSling.x + 56, this.ui.backSling.y + 16, '900 11px Fredoka, sans-serif', '#ffffff', {
        strokeWidth: 3.2,
      });
    }

    if (this.shots.length > 0 && !this.shots[0].abilityUsed) {
      const tip = AMMO_META[this.shots[0].type].tip;
      const tipY = this.hasReelHud ? 178 : 82;
      drawComicPanel(ctx, 100, tipY, 250, 26, 13, '#facc15', { lineWidth: 3, shadowDx: 2, shadowDy: 3 });
      drawComicText(ctx, tip, W / 2, tipY + 13, '900 11px Fredoka, sans-serif', '#ffffff', { strokeWidth: 3.2 });
    }

    // 5. Bottom Streamlined 1-Row Shop (`ROCK`, `STONE`, `ROOF/+`) + Huge Anvil Forge Console (`Y=616..800`)
    ctx.fillStyle = '#090518';
    ctx.fillRect(0, 616, W, 184);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(0, 616); ctx.lineTo(W, 616); ctx.stroke();

    const ammoFull = this.ammoQueue.length >= this.maxAmmo;
    const roofCount = this.canopies.length;

    // Button 1: Craft Rock Boulder (`8 Scrap`)
    const rockOk = !ammoFull && this.scrap >= 8;
    const rb = this.ui.buyRock;
    drawComicPanel(ctx, rb.x, rb.y, rb.w, rb.h, 10, rockOk ? '#475569' : '#1e293b', {
      stroke: rockOk ? '#facc15' : '#000000',
      lineWidth: rockOk ? 3 : 2.5,
      shadowDx: 2,
      shadowDy: 3,
    });
    this.drawAmmoOrb(ctx, rb.x + 20, rb.y + 19, 8.5, 'boulder');
    drawComicText(ctx, 'ROCK', rb.x + 34, rb.y + 19, '900 12px Fredoka, sans-serif', rockOk ? '#ffffff' : '#64748b', {
      align: 'left', strokeWidth: 3,
    });
    this.drawScrapGear(ctx, rb.x + rb.w - 30, rb.y + 19, 5.8);
    drawComicText(ctx, '8', rb.x + rb.w - 10, rb.y + 19, '900 13px Fredoka, sans-serif', rockOk ? '#facc15' : '#64748b', {
      align: 'right', strokeWidth: 3,
    });

    // Button 2: Build / Repair Stone Castle Segment (`22 Scrap`)
    const stoneOk = this.scrap >= 22;
    const sb = this.ui.stone;
    drawComicPanel(ctx, sb.x, sb.y, sb.w, sb.h, 10, stoneOk ? '#64748b' : '#1e293b', {
      stroke: stoneOk ? '#facc15' : '#000000',
      lineWidth: stoneOk ? 3 : 2.5,
      shadowDx: 2,
      shadowDy: 3,
    });
    this.drawWeeblBlock(ctx, sb.x + 18, sb.y + 19, 14, 18, 'stone', 'pillar', 0, { isPlayer: true });
    drawComicText(ctx, 'STONE', sb.x + 31, sb.y + 19, '900 12px Fredoka, sans-serif', stoneOk ? '#ffffff' : '#64748b', {
      align: 'left', strokeWidth: 3,
    });
    this.drawScrapGear(ctx, sb.x + sb.w - 30, sb.y + 19, 5.8);
    drawComicText(ctx, '22', sb.x + sb.w - 10, sb.y + 19, '900 13px Fredoka, sans-serif', stoneOk ? '#facc15' : '#64748b', {
      align: 'right', strokeWidth: 3,
    });

    // Button 3: Build Multi-Slot Roof (`3 slots`) / Restore Heart (`28 Scrap`)
    const roofOk = this.scrap >= 28;
    const cb = this.ui.canopy;
    drawComicPanel(ctx, cb.x, cb.y, cb.w, cb.h, 10, roofOk ? '#0284c7' : '#1e293b', {
      stroke: roofOk ? '#facc15' : '#000000',
      lineWidth: roofOk ? 3 : 2.5,
      shadowDx: 2,
      shadowDy: 3,
    });
    drawComicText(ctx, 'ROOF/+', cb.x + 10, cb.y + 15, '900 12px Fredoka, sans-serif', roofOk ? '#ffffff' : '#64748b', {
      align: 'left', strokeWidth: 3,
    });
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = s < roofCount ? '#facc15' : '#0f172a';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cb.x + 15 + s * 11, cb.y + 29, 3.4, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    this.drawScrapGear(ctx, cb.x + cb.w - 30, cb.y + 19, 5.8);
    drawComicText(ctx, '28', cb.x + cb.w - 10, cb.y + 19, '900 13px Fredoka, sans-serif', roofOk ? '#facc15' : '#64748b', {
      align: 'right', strokeWidth: 3,
    });

    // Enlarged Profound Weebl Blacksmith Forge Anvil & Hammer!
    this.drawHammerAndAnvil(ctx, this.ui.anvil);

    ctx.restore();
  }
}
