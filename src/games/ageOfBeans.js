import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const WORLD_W = 1600;
export const GROUND_Y = 460;

// -----------------------------------------------------------------------------
// 5 Confectionery Eras Specification (Jelly World Canon)
// -----------------------------------------------------------------------------
export const ERAS = [
  {
    id: 0,
    name: 'Rock-Candy Prehistory',
    baseName: 'Sugar-Geode Cave',
    evolveXp: 1000,
    baseMaxHp: 500,
    skyColor: ['#3a86ff', '#8338ec', '#ff006e'],
    groundColor: '#7f5539',
    accentColor: '#ffd166',
    turret: { name: 'Slingshot', cost: 100, dmg: 24, range: 320, cd: 1.6, proj: 'rock' },
    special: { name: 'Meteor Shower', cd: 50, icon: '☄️', count: 8, dmg: 95 },
    units: [
      { name: 'Cave-Bean', icon: '🦴', type: 'melee', hp: 130, dmg: 28, spd: 58, cost: 25, range: 46, cd: 1.0, xp: 30, size: 34 },
      { name: 'Pebble-Sling', icon: '🪨', type: 'ranged', hp: 75, dmg: 18, spd: 48, cost: 40, range: 220, cd: 1.4, xp: 45, size: 30, proj: 'rock' },
      { name: 'Gummy-Rex', icon: '🦖', type: 'heavy', hp: 360, dmg: 60, spd: 68, cost: 110, range: 56, cd: 1.2, xp: 130, size: 46 },
    ],
  },
  {
    id: 1,
    name: 'Royal Wafer Keep',
    baseName: 'Gingerbread Citadel',
    evolveXp: 3000,
    baseMaxHp: 750,
    skyColor: ['#1d3557', '#457b9d', '#a8dadc'],
    groundColor: '#4f772d',
    accentColor: '#ffd60a',
    turret: { name: 'Ballista', cost: 220, dmg: 48, range: 340, cd: 1.4, proj: 'arrow' },
    special: { name: 'Arrow Storm', cd: 52, icon: '🏹', count: 14, dmg: 140 },
    units: [
      { name: 'Sugar Knight', icon: '🗡️', type: 'melee', hp: 260, dmg: 48, spd: 54, cost: 65, range: 48, cd: 0.95, xp: 75, size: 35 },
      { name: 'Robin Bean', icon: '🎯', type: 'ranged', hp: 145, dmg: 38, spd: 46, cost: 95, range: 240, cd: 1.5, xp: 110, size: 31, proj: 'arrow' },
      { name: 'Caramel Steed', icon: '🐎', type: 'heavy', hp: 720, dmg: 120, spd: 72, cost: 260, range: 58, cd: 1.1, xp: 300, size: 48 },
    ],
  },
  {
    id: 2,
    name: 'Marzipan Renaissance',
    baseName: 'Confectioner Citadel',
    evolveXp: 8000,
    baseMaxHp: 1000,
    skyColor: ['#2b2d42', '#8d99ae', '#edf2f4'],
    groundColor: '#606c38',
    accentColor: '#4cc9f0',
    turret: { name: 'Bombard', cost: 480, dmg: 110, range: 370, cd: 1.8, proj: 'cannonball' },
    special: { name: 'Artillery Barrage', cd: 55, icon: '💣', count: 9, dmg: 260 },
    units: [
      { name: 'Musketeer', icon: '🤺', type: 'melee', hp: 520, dmg: 98, spd: 52, cost: 150, range: 48, cd: 0.9, xp: 180, size: 35 },
      { name: 'Flintlock Bean', icon: '🪖', type: 'ranged', hp: 300, dmg: 85, spd: 45, cost: 220, range: 260, cd: 1.6, xp: 260, size: 32, proj: 'bullet' },
      { name: 'Truffle Cannon', icon: '💥', type: 'heavy', hp: 1300, dmg: 250, spd: 40, cost: 580, range: 280, cd: 2.2, xp: 700, size: 50, proj: 'cannonball' },
    ],
  },
  {
    id: 3,
    name: 'Jawbreaker Modern',
    baseName: 'Bubblegum Bunker',
    evolveXp: 22000,
    baseMaxHp: 1250,
    skyColor: ['#1f2421', '#495867', '#9da9a0'],
    groundColor: '#4f5d75',
    accentColor: '#f72585',
    turret: { name: 'Flak Cannon', cost: 1000, dmg: 230, range: 390, cd: 1.1, proj: 'tracer' },
    special: { name: 'Stealth Airstrike', cd: 60, icon: '✈️', count: 10, dmg: 560 },
    units: [
      { name: 'Gummy Commando', icon: '🪖', type: 'melee', hp: 1050, dmg: 195, spd: 56, cost: 350, range: 50, cd: 0.85, xp: 420, size: 36 },
      { name: 'Ghillie Sniper', icon: '🔭', type: 'ranged', hp: 600, dmg: 220, spd: 44, cost: 480, range: 300, cd: 1.9, xp: 600, size: 32, proj: 'tracer' },
      { name: 'Bubblegum Tank', icon: '🛡️', type: 'heavy', hp: 2700, dmg: 500, spd: 46, cost: 1300, range: 290, cd: 2.0, xp: 1600, size: 52, proj: 'tank_shell' },
    ],
  },
  {
    id: 4,
    name: 'Cyber-Jelly Future',
    baseName: 'Neon Quantum Spire',
    evolveXp: 999999, // Max era
    baseMaxHp: 1500,
    skyColor: ['#03071e', '#370617', '#6a040f'],
    groundColor: '#1e1b4b',
    accentColor: '#00f5d4',
    turret: { name: 'Ion Ray', cost: 2400, dmg: 540, range: 420, cd: 0.9, proj: 'laser' },
    special: { name: 'Orbital Ion Beam', cd: 65, icon: '🛰️', count: 12, dmg: 1400 },
    units: [
      { name: 'Cyber-Blade', icon: '⚔️', type: 'melee', hp: 2100, dmg: 420, spd: 60, cost: 800, range: 52, cd: 0.75, xp: 1000, size: 36 },
      { name: 'Pulse Trooper', icon: '⚡', type: 'ranged', hp: 1250, dmg: 400, spd: 50, cost: 1200, range: 320, cd: 1.25, xp: 1500, size: 33, proj: 'laser' },
      { name: 'Hover Titan', icon: '🤖', type: 'heavy', hp: 5800, dmg: 1100, spd: 48, cost: 3000, range: 300, cd: 1.8, xp: 4000, size: 54, proj: 'plasma_orb' },
    ],
  },
];

export class AgeOfBeans extends Game {
  static meta = {
    id: 'age-of-beans',
    title: 'Age of Beans',
    icon: '⚔️',
    hint: 'SPAWN Jellybean Warriors · DEFEND your fortress · EVOLVE through 5 ERAS!',
    baseLikes: 14200,
    roundLen: 360,
  };

  init(saved, score = 0) {
    this.meta = AgeOfBeans.meta;
    this.fx = new FX();
    this.score = score;
    // Prestige rank (1 = first playthrough). Set by Reel.js before init().
    this.pLevel = Math.max(1, this.prestige || 1);
    // Enemy units gain +25% HP and the AI director thinks faster per prestige level.
    this.enemyHpMult = 1 + 0.25 * (this.pLevel - 1);

    // Faction Progression (Player = Left / Cyan Team, Enemy = Right / Magenta Team)
    this.playerEra = clamp(saved?.playerEra || 0, 0, ERAS.length - 1);
    this.enemyEra = clamp(saved?.enemyEra || 0, 0, ERAS.length - 1);

    this.playerGold = Number.isFinite(saved?.playerGold) ? saved.playerGold : 190;
    this.playerXp = Number.isFinite(saved?.playerXp) ? saved.playerXp : 0;

    this.enemyGold = Number.isFinite(saved?.enemyGold) ? saved.enemyGold : 170;
    this.enemyXp = Number.isFinite(saved?.enemyXp) ? saved.enemyXp : 0;

    // Base Fortresses
    this.playerBaseHp = Number.isFinite(saved?.playerBaseHp) ? saved.playerBaseHp : ERAS[this.playerEra].baseMaxHp;
    this.enemyBaseHp = Number.isFinite(saved?.enemyBaseHp) ? saved.enemyBaseHp : ERAS[this.enemyEra].baseMaxHp;
    this.playerBaseMaxHp = ERAS[this.playerEra].baseMaxHp;
    this.enemyBaseMaxHp = Math.round(ERAS[this.enemyEra].baseMaxHp * this.enemyHpMult);
    if (!Number.isFinite(saved?.enemyBaseHp)) this.enemyBaseHp = this.enemyBaseMaxHp;

    // Base Turret Hardpoints (up to 3 tiers per base)
    this.playerTurrets = Array.isArray(saved?.playerTurrets)
      ? saved.playerTurrets.map((t) => ({ ...t }))
      : [
          { unlocked: true, turretEra: 0, cdTimer: 0 },
          { unlocked: false, turretEra: null, cdTimer: 0 },
          { unlocked: false, turretEra: null, cdTimer: 0 },
        ];
    this.enemyTurrets = Array.isArray(saved?.enemyTurrets)
      ? saved.enemyTurrets.map((t) => ({ ...t }))
      : [
          { unlocked: true, turretEra: 0, cdTimer: 0 },
          { unlocked: false, turretEra: null, cdTimer: 0 },
          { unlocked: false, turretEra: null, cdTimer: 0 },
        ];

    if (saved) this.grace = 1.5;

    // Special Ability Timers
    this.playerSpecialCd = 0;
    this.enemySpecialCd = 25;
    this.activeSpecials = [];

    // Unit Queues (Max 5 in training)
    this.playerQueue = [];
    this.playerQueueTimer = 0;
    this.enemyQueue = [];
    this.enemyQueueTimer = 0;

    // Active Combat Battlefield Units, Projectiles & Dynamic FX
    this.units = [];
    this.projectiles = [];
    this.slashArcs = [];
    this.muzzleFlashes = [];
    this.nextUnitId = 1;

    // Ambient floating confectionery background clouds & balloons
    this.clouds = [];
    for (let i = 0; i < 22; i++) {
      this.clouds.push({
        x: Math.random() * WORLD_W,
        y: 35 + Math.random() * 180,
        spd: 6 + Math.random() * 12,
        scale: 0.7 + Math.random() * 1.3,
        alpha: 0.35 + Math.random() * 0.35,
        type: i % 7 === 0 ? 'zeppelin' : 'cloud',
      });
    }

    // Camera Panning & Auto-Tracking
    this.camX = 0;
    this.targetCamX = 0;
    this.isDraggingCam = false;
    this.dragStartX = 0;
    this.dragStartCamX = 0;
    this.userPannedTimer = 0;

    // UI State & Sub-panels
    this.activeTab = 'units'; // 'units' | 'turrets'
    this.gameWon = false;
    this.gameLost = false;

    // AI Director Pacing Timer
    this.aiThinkTimer = 1.0;

    // Keyboard listener (supports both event.key and event.code)
    this.keyHandler = (e) => {
      if (e.repeat) return;
      const k = e.key;
      const code = e.code;
      if (k === '1' || code === 'Digit1' || code === 'Numpad1') this.queueUnit('player', 0);
      else if (k === '2' || code === 'Digit2' || code === 'Numpad2') this.queueUnit('player', 1);
      else if (k === '3' || code === 'Digit3' || code === 'Numpad3') this.queueUnit('player', 2);
      else if (k === 'e' || k === 'E' || code === 'KeyE') this.tryPlayerEvolve();
      else if (k === ' ' || k === 'f' || k === 'F' || code === 'Space' || code === 'KeyF') this.tryTriggerSpecial('player');
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  destroy() {
    window.removeEventListener('keydown', this.keyHandler);
  }

  serialize() {
    return {
      playerEra: this.playerEra,
      enemyEra: this.enemyEra,
      playerGold: Math.floor(this.playerGold),
      playerXp: Math.floor(this.playerXp),
      enemyGold: Math.floor(this.enemyGold),
      enemyXp: Math.floor(this.enemyXp),
      playerBaseHp: Math.floor(this.playerBaseHp),
      enemyBaseHp: Math.floor(this.enemyBaseHp),
      playerTurrets: this.playerTurrets,
      enemyTurrets: this.enemyTurrets,
    };
  }

  restoreLabel() {
    return `${ERAS[this.playerEra].name} · 💰 ${Math.floor(this.playerGold)}`;
  }

  /* -------------------------------------------------------------------------
   * INPUT HANDLING & INTERACTIVE TOUCH DECK
   * ------------------------------------------------------------------------- */
  handleInput() {
    if (this.dead || this.gameWon) return;

    const inp = this.input;

    // Keyboard camera scrolling (A/D or ArrowLeft/ArrowRight)
    if (inp.key && (inp.key('arrowleft', 'a') || inp.key('arrowright', 'd'))) {
      const dir = (inp.key('arrowright', 'd') ? 1 : 0) - (inp.key('arrowleft', 'a') ? 1 : 0);
      this.camX = clamp(this.camX + dir * 600 * 0.016, 0, WORLD_W - this.W);
      this.targetCamX = this.camX;
      this.userPannedTimer = 2.0;
    }

    // 1. Pointer Just Pressed (down on this frame)
    if (inp.pressed) {
      const x = inp.x;
      const y = inp.y;

      // Check Top Mini-Radar Click (Instant Camera Teleport)
      if (y >= 75 && y <= 110 && x >= 115 && x <= 335) {
        const ratio = (x - 115) / 220;
        this.targetCamX = clamp(ratio * (WORLD_W - this.W), 0, WORLD_W - this.W);
        this.camX = this.targetCamX;
        this.userPannedTimer = 2.0;
        return;
      }

      // Check Bottom Command Deck Clicks (y >= 485)
      if (y >= 485) {
        this.handleCommandDeckClick(x, y);
        return;
      }

      // Battlefield Screen Drag Initiated
      this.isDraggingCam = true;
      this.dragStartX = x;
      this.dragStartCamX = this.camX;
      this.userPannedTimer = 2.5;
    }

    // 2. Dragging Camera
    if (inp.down && this.isDraggingCam) {
      const dx = inp.x - this.dragStartX;
      this.camX = clamp(this.dragStartCamX - dx, 0, WORLD_W - this.W);
      this.targetCamX = this.camX;
      this.userPannedTimer = 2.5;
    } else {
      this.isDraggingCam = false;
    }
  }

  handleCommandDeckClick(x, y) {
    // 1. Tab Selectors at y: 485 - 530
    if (y >= 485 && y <= 530) {
      if (x < 118) {
        this.activeTab = 'units';
        this.sounds.pop();
        return;
      }
      if (x >= 118 && x < 225) {
        this.activeTab = 'turrets';
        this.sounds.pop();
        return;
      }
      if (x >= 225 && x < 330) {
        this.tryPlayerEvolve();
        return;
      }
      if (x >= 330) {
        this.tryTriggerSpecial('player');
        return;
      }
    }

    // 2. Tab 1: Units Deck (y > 530)
    if (this.activeTab === 'units' && y > 530) {
      const btnW = (this.W - 32) / 3;
      for (let i = 0; i < 3; i++) {
        const bx = 16 + i * btnW;
        if (x >= bx && x <= bx + btnW) {
          this.queueUnit('player', i);
          return;
        }
      }
    }

    // 3. Tab 2: Turrets Deck (y > 530)
    if (this.activeTab === 'turrets' && y > 530) {
      const slotW = (this.W - 32) / 3;
      for (let i = 0; i < 3; i++) {
        const bx = 16 + i * slotW;
        if (x >= bx && x <= bx + slotW) {
          this.handleTurretSlotAction(i);
          return;
        }
      }
    }
  }

  /* -------------------------------------------------------------------------
   * ECONOMY, UNITS & QUEUE MANAGEMENT
   * ------------------------------------------------------------------------- */
  queueUnit(team, tier) {
    const era = team === 'player' ? this.playerEra : this.enemyEra;
    const uDef = ERAS[era].units[tier];

    if (team === 'player') {
      if (this.playerQueue.length >= 5) {
        this.fx.text(this.W / 2, 470, 'QUEUE FULL! (5/5)', '#ef4444', 20, 0.6);
        this.sounds.fail();
        return;
      }
      if (this.playerGold < uDef.cost) {
        this.fx.text(this.W / 2, 470, `NEED 💰 ${uDef.cost}!`, '#ffd166', 20, 0.6);
        this.sounds.fail();
        return;
      }
      this.playerGold -= uDef.cost;
      this.playerQueue.push({ era, tier, buildTime: 1.2 + tier * 0.4 });
      this.sounds.coin();
      this.haptics.light();
    } else {
      if (this.enemyQueue.length >= 5) return;
      if (this.enemyGold < uDef.cost) return;
      this.enemyGold -= uDef.cost;
      this.enemyQueue.push({ era, tier, buildTime: 1.2 + tier * 0.4 });
    }
  }

  spawnUnit(team, era, tier) {
    const def = ERAS[era].units[tier];
    const isPlayer = team === 'player';
    const x = isPlayer ? 135 : 1465;
    const dir = isPlayer ? 1 : -1;

    const hpMult = isPlayer ? 1 : this.enemyHpMult;
    this.units.push({
      id: this.nextUnitId++,
      team,
      era,
      tier,
      name: def.name,
      type: def.type,
      hp: Math.round(def.hp * hpMult),
      maxHp: Math.round(def.hp * hpMult),
      dmg: def.dmg,
      spd: def.spd,
      range: def.range,
      cd: def.cd,
      attackTimer: 0.25,
      xpValue: def.xp,
      goldValue: Math.floor(def.cost * 0.8),
      size: def.size,
      proj: def.proj || null,
      x,
      y: GROUND_Y,
      dir,
      state: 'walk',
      walkT: Math.random() * 5,
      blinkT: Math.random() * 3,
      attackPhase: 'idle',
      attackTime: 0,
      hasStruckThisCycle: false,
      lungeX: 0,
      recoilX: 0,
      recoilSquash: 1.0,
      shudderT: 0,
      isDying: false,
      deathTimer: 0,
      hitFlash: 0,
    });

    if (isPlayer) {
      this.sounds.pop();
    }
  }

  tryPlayerEvolve() {
    if (this.playerEra >= ERAS.length - 1) {
      this.fx.text(this.W / 2, 470, 'MAX ERA REACHED! ⚡', '#ffd166', 22, 0.7);
      return;
    }
    const needed = ERAS[this.playerEra].evolveXp;
    if (this.playerXp < needed) {
      this.fx.text(this.W / 2, 470, `NEED ⭐ ${needed} XP!`, '#ff006e', 22, 0.7);
      this.sounds.fail();
      return;
    }

    this.playerEra++;
    this.playerBaseMaxHp = ERAS[this.playerEra].baseMaxHp;
    this.playerBaseHp = Math.min(this.playerBaseMaxHp, this.playerBaseHp + 250);

    this.sounds.upgrade();
    this.sounds.powerup();
    this.haptics.heavy();
    this.fx.screenShake(16, 0.5);
    this.fx.burst(100, GROUND_Y - 140, '#ffd166', 45, 280, 0.9, 6);
    this.fx.text(this.W / 2, 270, `EVOLVED TO ${ERAS[this.playerEra].name.toUpperCase()}! 🛡️`, '#06d6a0', 26, 1.4);
  }

  enemyEvolve() {
    if (this.enemyEra >= ERAS.length - 1) return;
    this.enemyEra++;
    this.enemyBaseMaxHp = Math.round(ERAS[this.enemyEra].baseMaxHp * this.enemyHpMult);
    this.enemyBaseHp = Math.min(this.enemyBaseMaxHp, this.enemyBaseHp + 250);

    this.sounds.whoosh();
    this.fx.screenShake(12, 0.45);
    this.fx.burst(1500, GROUND_Y - 140, '#ef4444', 45, 280, 0.9, 6);
    this.fx.text(this.W / 2, 260, `ENEMY EVOLVED TO ${ERAS[this.enemyEra].name.toUpperCase()}! ⚠️`, '#ef4444', 24, 1.2);
  }

  handleTurretSlotAction(slotIdx) {
    const slot = this.playerTurrets[slotIdx];
    const eraTurret = ERAS[this.playerEra].turret;

    // Slot Locked: Purchase Slot
    if (!slot.unlocked) {
      const slotCost = (slotIdx === 1) ? 250 : 600;
      if (this.playerGold < slotCost) {
        this.fx.text(this.W / 2, 470, `SLOT COSTS 💰 ${slotCost}!`, '#ffd166', 20, 0.6);
        this.sounds.fail();
        return;
      }
      this.playerGold -= slotCost;
      slot.unlocked = true;
      this.sounds.upgrade();
      this.haptics.medium();
      this.fx.text(this.W / 2, 470, `TURRET SLOT #${slotIdx + 1} UNLOCKED! 🔨`, '#06d6a0', 22, 0.8);
      return;
    }

    // Slot Empty: Buy Era Turret
    if (slot.turretEra === null) {
      if (this.playerGold < eraTurret.cost) {
        this.fx.text(this.W / 2, 470, `NEED 💰 ${eraTurret.cost}!`, '#ffd166', 20, 0.6);
        this.sounds.fail();
        return;
      }
      this.playerGold -= eraTurret.cost;
      slot.turretEra = this.playerEra;
      slot.cdTimer = 0;
      this.sounds.upgrade();
      this.haptics.heavy();
      this.fx.text(this.W / 2, 470, `MOUNTED ${eraTurret.name.toUpperCase()}! 🏹`, '#06d6a0', 22, 0.8);
      return;
    }

    // Slot Occupied: If out-of-date era, upgrade; or sell for refund
    if (slot.turretEra < this.playerEra) {
      if (this.playerGold < eraTurret.cost) {
        this.fx.text(this.W / 2, 470, `UPGRADE COSTS 💰 ${eraTurret.cost}!`, '#ffd166', 20, 0.6);
        this.sounds.fail();
        return;
      }
      this.playerGold -= eraTurret.cost;
      slot.turretEra = this.playerEra;
      this.sounds.upgrade();
      this.haptics.heavy();
      this.fx.text(this.W / 2, 470, `UPGRADED TO ${eraTurret.name.toUpperCase()}! ⚡`, '#ffd166', 22, 0.8);
    } else {
      const refund = Math.floor(eraTurret.cost * 0.7);
      this.playerGold += refund;
      slot.turretEra = null;
      this.sounds.coin();
      this.fx.text(this.W / 2, 470, `SOLD FOR +💰 ${refund}!`, '#ffd166', 20, 0.7);
    }
  }

  tryTriggerSpecial(team) {
    const isPlayer = team === 'player';
    const era = isPlayer ? this.playerEra : this.enemyEra;
    const sDef = ERAS[era].special;

    if (isPlayer) {
      if (this.playerSpecialCd > 0) {
        this.fx.text(this.W / 2, 470, `COOLDOWN: ${Math.ceil(this.playerSpecialCd)}s`, '#ffd166', 20, 0.6);
        this.sounds.fail();
        return;
      }
      this.playerSpecialCd = sDef.cd;
      this.sounds.powerup();
      this.sounds.explosion();
      this.haptics.heavy();
      this.fx.screenShake(22, 0.75);
      this.fx.text(this.W / 2, 230, `${sDef.name.toUpperCase()} UNLEASHED! ${sDef.icon}`, '#ef4444', 28, 1.5);
    } else {
      if (this.enemySpecialCd > 0) return;
      this.enemySpecialCd = sDef.cd;
      this.sounds.whoosh();
      this.fx.screenShake(18, 0.55);
      this.fx.text(this.W / 2, 230, `ENEMY ${sDef.name.toUpperCase()}! ⚠️`, '#ff006e', 26, 1.3);
    }

    for (let i = 0; i < sDef.count; i++) {
      this.activeSpecials.push({
        team,
        era,
        dmg: sDef.dmg,
        delay: i * 0.20 + Math.random() * 0.12,
        startX: isPlayer ? (150 + i * 80) : (1450 - i * 80),
        startY: -40,
        targetX: isPlayer ? (260 + Math.random() * 1200) : (140 + Math.random() * 1200),
        landed: false,
      });
    }
  }

  /* -------------------------------------------------------------------------
   * SIMULATION TICK & GAME LOOP
   * ------------------------------------------------------------------------- */
  update(dt) {
    if (this.dead || this.gameWon) {
      this.fx.update(dt);
      return;
    }

    this.handleInput();

    // 1. Passive Gold Drip & Cooldowns
    const goldRate = 4.0 + this.playerEra * 1.5;
    this.playerGold += goldRate * dt;
    this.enemyGold += (goldRate * 1.05) * dt;

    if (this.playerSpecialCd > 0) this.playerSpecialCd -= dt;
    if (this.enemySpecialCd > 0) this.enemySpecialCd -= dt;

    // 2. Ambient Clouds
    for (const c of this.clouds) {
      c.x += c.spd * dt;
      if (c.x > WORLD_W + 100) c.x = -150;
    }

    // 3. Production Queue Progress
    this.updateQueues(dt);

    // 4. Units Combat, Movement & Separation
    this.updateUnits(dt);

    // 5. Base Turrets Auto-Targeting & Firing
    this.updateTurrets(dt);

    // 6. Projectiles Simulation
    this.updateProjectiles(dt);

    // 7. Apocalyptic Special Attacks Sequence
    this.updateActiveSpecials(dt);

    // 8. AI Opponent Director
    this.updateAiDirector(dt);

    // 9. Auto-Tracking Camera
    this.updateCamera(dt);

    // 10. Win / Loss Checking
    this.checkWinLoss();

    // 11. Update Combat FX
    for (const a of this.slashArcs) a.life -= dt;
    this.slashArcs = this.slashArcs.filter((a) => a.life > 0);

    for (const m of this.muzzleFlashes) m.life -= dt;
    this.muzzleFlashes = this.muzzleFlashes.filter((m) => m.life > 0);

    this.fx.update(dt);
  }

  updateQueues(dt) {
    if (this.playerQueue.length > 0) {
      this.playerQueueTimer += dt;
      const head = this.playerQueue[0];
      if (this.playerQueueTimer >= head.buildTime) {
        this.spawnUnit('player', head.era, head.tier);
        this.playerQueue.shift();
        this.playerQueueTimer = 0;
      }
    } else {
      this.playerQueueTimer = 0;
    }

    if (this.enemyQueue.length > 0) {
      this.enemyQueueTimer += dt;
      const head = this.enemyQueue[0];
      if (this.enemyQueueTimer >= head.buildTime) {
        this.spawnUnit('enemy', head.era, head.tier);
        this.enemyQueue.shift();
        this.enemyQueueTimer = 0;
      }
    } else {
      this.enemyQueueTimer = 0;
    }
  }

  updateUnits(dt) {
    this.units.sort((a, b) => a.x - b.x);

    for (const u of this.units) {
      if (u.hitFlash > 0) u.hitFlash -= dt * 4.5;
      if (u.shudderT > 0) u.shudderT -= dt;
      if (u.recoilX !== 0) u.recoilX += (0 - u.recoilX) * Math.min(1.0, 14 * dt);
      if (u.recoilSquash !== 1.0) u.recoilSquash += (1.0 - u.recoilSquash) * Math.min(1.0, 16 * dt);
      u.walkT += dt;
      u.blinkT += dt;

      // Handle dying unit state
      if (u.isDying) {
        u.deathTimer -= dt;
        continue;
      }

      const isPlayer = u.team === 'player';
      const enemyBaseX = isPlayer ? 1470 : 130;
      const distToBase = Math.abs(u.x - enemyBaseX);

      let targetUnit = null;
      let minTargetDist = 9999;

      for (const foe of this.units) {
        if (foe.team !== u.team && !foe.isDying) {
          const d = Math.abs(foe.x - u.x);
          const inFront = isPlayer ? (foe.x > u.x) : (foe.x < u.x);
          if (inFront && d <= u.range && d < minTargetDist) {
            minTargetDist = d;
            targetUnit = foe;
          }
        }
      }

      const baseInRange = distToBase <= u.range;

      if (targetUnit || baseInRange) {
        u.state = 'attack';
        u.attackTime += dt;

        const windupDur = Math.min(0.24, u.cd * 0.30);
        const strikeDur = 0.16;
        const recoverDur = Math.max(0.2, u.cd - windupDur - strikeDur);

        if (u.attackTime < windupDur) {
          // 1. Windup / Anticipation Phase: Lean back & raise weapon
          u.attackPhase = 'windup';
          const wp = u.attackTime / windupDur;
          u.lungeX = -5 * Math.sin(wp * Math.PI * 0.5);
        } else if (!u.hasStruckThisCycle) {
          // 2. STRIKE FRAME: Explosive forward snap!
          u.hasStruckThisCycle = true;
          u.attackPhase = 'strike';
          u.lungeX = 14;

          if (u.proj) {
            // Ranged attack + Muzzle/Bow Flash
            const targetX = targetUnit ? targetUnit.x : enemyBaseX;
            this.spawnProjectile(u.x + u.dir * 24, u.y - u.size * 0.7, targetX, GROUND_Y - 20, u.proj, u.dmg, u.team);
            this.spawnMuzzleFlash(u.x + u.dir * (u.size * 0.95), u.y - u.size * 0.7, u.dir, u.proj);
            this.sounds.whoosh();
          } else {
            // Melee Attack + Sweeping Confectionery Slash Arc
            const slashColor = isPlayer ? '#00f5d4' : '#ff006e';
            this.spawnSlashArc(u.x + u.dir * (u.size * 0.8), u.y - u.size * 0.65, u.dir, u.size * 1.35, slashColor);

            if (targetUnit) {
              targetUnit.hp -= u.dmg;
              targetUnit.hitFlash = 1.0;
              targetUnit.shudderT = 0.10;
              targetUnit.recoilX = -targetUnit.dir * 12; // Snappy knockback
              targetUnit.recoilSquash = 0.65; // Snappy jelly squash

              this.spawnCombatHitFX(targetUnit.x, targetUnit.y - targetUnit.size * 0.5, targetUnit.team, u.dmg);

              // Check if killed
              if (targetUnit.hp <= 0 && !targetUnit.isDying) {
                this.triggerUnitDeath(targetUnit);
              }
            } else if (baseInRange) {
              if (isPlayer) {
                this.enemyBaseHp = Math.max(0, this.enemyBaseHp - u.dmg);
                this.spawnCombatHitFX(1470, GROUND_Y - 80, 'enemy', u.dmg);
              } else {
                this.playerBaseHp = Math.max(0, this.playerBaseHp - u.dmg);
                this.spawnCombatHitFX(130, GROUND_Y - 80, 'player', u.dmg);
                this.sounds.hit();
                this.haptics.medium();
              }
              this.fx.screenShake(6, 0.22);
            }
          }
        } else {
          // 3. Recovery Phase: Smooth return with jelly wobble
          u.attackPhase = 'recover';
          const recP = clamp((u.attackTime - windupDur - strikeDur) / recoverDur, 0, 1);
          u.lungeX = 14 * (1.0 - recP);

          if (u.attackTime >= u.cd) {
            u.attackTime = 0;
            u.hasStruckThisCycle = false;
            u.attackPhase = 'idle';
          }
        }
      } else {
        // Walk or Idle
        u.attackPhase = 'idle';
        u.attackTime = 0;
        u.hasStruckThisCycle = false;
        u.lungeX = 0;

        let blocked = false;
        for (const friend of this.units) {
          if (friend.team === u.team && friend.id !== u.id && !friend.isDying) {
            const inFront = isPlayer ? (friend.x > u.x) : (friend.x < u.x);
            const dist = Math.abs(friend.x - u.x);
            if (inFront && dist < (u.size + friend.size) * 0.95) {
              blocked = true;
              break;
            }
          }
        }

        if (!blocked) {
          u.state = 'walk';
          u.x += u.dir * u.spd * dt;
          u.x = clamp(u.x, 120, 1480);
        } else {
          u.state = 'idle';
        }
      }
    }

    this.units = this.units.filter((u) => !u.isDying || u.deathTimer > 0);
  }

  triggerUnitDeath(u) {
    u.isDying = true;
    u.deathTimer = 0.32;
    const isPlayer = u.team === 'player';

    // 1. Initial pop shockwave & bouncy jelly fragments
    this.fx.ring(u.x, u.y - u.size * 0.5, isPlayer ? '#00f5d4' : '#ff006e', 50, 0.35, 5);
    this.fx.burst(u.x, u.y - u.size * 0.6, isPlayer ? '#38bdf8' : '#f72585', 24, 200, 0.6, 4.5, 160);
    this.fx.burst(u.x, u.y - u.size * 0.6, '#ffd166', 12, 160, 0.45, 3.5, 120);

    // 2. Floating cartoon soul/ghost
    this.fx.text(u.x, u.y - u.size * 1.3, '👻', '#ffffff', 22, 0.85);

    this.sounds.pop();
    this.haptics.medium();

    if (isPlayer) {
      this.enemyGold += u.goldValue;
      this.enemyXp += u.xpValue;
    } else {
      this.playerGold += u.goldValue;
      this.playerXp += u.xpValue;
      this.score += u.xpValue * 2;
      this.sounds.coin();
      this.fx.text(u.x, u.y - u.size * 0.9, `+💰${u.goldValue}`, '#ffd166', 20, 0.75);
    }
  }

  spawnCombatHitFX(x, y, team, dmg) {
    const isPlayer = team === 'player';
    const hitColor = isPlayer ? '#00f5d4' : '#ff006e';
    const altColor = '#ffd166';

    // 1. Snappy expanding candy shockwave ring
    this.fx.ring(x, y, hitColor, 44, 0.28, 4);

    // 2. Multi-colored bouncy candy shards & sparkles
    this.fx.burst(x, y, hitColor, 12, 190, 0.45, 4, 180);
    this.fx.burst(x, y, altColor, 8, 140, 0.35, 3, 140);
    this.fx.burst(x, y, '#ffffff', 6, 220, 0.25, 2.5);

    // 3. Popping Floating Damage Text
    this.fx.text(x + (Math.random() - 0.5) * 16, y - 28, `-${dmg}`, isPlayer ? '#ffd166' : '#ff006e', 22, 0.7);

    // 4. Combat audio & haptics
    this.sounds.hit();
    this.haptics.light();
    if (dmg >= 45) {
      this.fx.screenShake(6, 0.22);
    }
  }

  spawnSlashArc(x, y, dir, radius, color) {
    this.slashArcs.push({
      x, y, dir, radius, color,
      life: 0.18, maxLife: 0.18,
    });
  }

  spawnMuzzleFlash(x, y, dir, type) {
    this.muzzleFlashes.push({
      x, y, dir, type,
      life: 0.14, maxLife: 0.14,
    });
  }

  updateTurrets(dt) {
    // Player Turrets (x = 120)
    for (let i = 0; i < this.playerTurrets.length; i++) {
      const slot = this.playerTurrets[i];
      if (!slot.unlocked || slot.turretEra === null) continue;
      if (slot.cdTimer > 0) slot.cdTimer -= dt;

      const tDef = ERAS[slot.turretEra].turret;
      const mountY = GROUND_Y - 120 - (i * 38);

      let target = null;
      let minDist = tDef.range;
      for (const foe of this.units) {
        if (foe.team === 'enemy') {
          const d = foe.x - 120;
          if (d > 0 && d <= tDef.range && d < minDist) {
            minDist = d;
            target = foe;
          }
        }
      }

      if (target && slot.cdTimer <= 0) {
        slot.cdTimer = tDef.cd;
        this.spawnProjectile(125, mountY, target.x, target.y - target.size * 0.6, tDef.proj, tDef.dmg, 'player');
      }
    }

    // Enemy Turrets (x = 1480)
    for (let i = 0; i < this.enemyTurrets.length; i++) {
      const slot = this.enemyTurrets[i];
      if (!slot.unlocked || slot.turretEra === null) continue;
      if (slot.cdTimer > 0) slot.cdTimer -= dt;

      const tDef = ERAS[slot.turretEra].turret;
      const mountY = GROUND_Y - 120 - (i * 38);

      let target = null;
      let minDist = tDef.range;
      for (const foe of this.units) {
        if (foe.team === 'player') {
          const d = 1480 - foe.x;
          if (d > 0 && d <= tDef.range && d < minDist) {
            minDist = d;
            target = foe;
          }
        }
      }

      if (target && slot.cdTimer <= 0) {
        slot.cdTimer = tDef.cd;
        this.spawnProjectile(1475, mountY, target.x, target.y - target.size * 0.6, tDef.proj, tDef.dmg, 'enemy');
      }
    }
  }

  spawnProjectile(x, y, tx, ty, type, dmg, team) {
    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.hypot(dx, dy);

    if (type === 'laser') {
      this.sounds.laser();
      this.fx.ring(tx, ty, team === 'player' ? '#00f5d4' : '#ff006e', 28, 0.28, 4);
      this.damageArea(tx, 38, dmg, team);
      return;
    }

    let speed = 360;
    let gravity = 450;

    if (type === 'bullet' || type === 'tracer') {
      speed = 720;
      gravity = 40;
      this.sounds.gunfire();
    } else if (type === 'arrow') {
      speed = 430;
      gravity = 380;
      this.sounds.whoosh();
    } else if (type === 'cannonball' || type === 'tank_shell') {
      speed = 400;
      gravity = 420;
      this.sounds.explosion();
    } else {
      speed = 350;
      gravity = 440;
      this.sounds.whoosh();
    }

    const flightTime = Math.max(0.15, dist / speed);
    const vx = dx / flightTime;
    const vy = (dy - 0.5 * gravity * flightTime * flightTime) / flightTime;

    this.projectiles.push({
      x, y, vx, vy, gravity, dmg, team, type,
      life: flightTime + 0.1,
      splashRadius: (type === 'cannonball' || type === 'tank_shell' || type === 'plasma_orb') ? 48 : 14,
    });
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.y >= GROUND_Y - 5 || p.life <= 0) {
        p.life = -1;
        this.damageArea(p.x, p.splashRadius, p.dmg, p.team);

        if (p.splashRadius > 20) {
          this.fx.burst(p.x, GROUND_Y - 10, '#ffd166', 16, 160, 0.4, 4);
          this.sounds.explosion();
        } else {
          this.fx.burst(p.x, GROUND_Y - 10, '#ffffff', 8, 80, 0.22, 2.5);
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  damageArea(x, radius, dmg, attackerTeam) {
    for (const u of this.units) {
      if (u.team !== attackerTeam) {
        if (Math.abs(u.x - x) <= radius + u.size * 0.6) {
          u.hp -= dmg;
          u.hitFlash = 1.0;
          this.fx.text(u.x, u.y - u.size, `-${dmg}`, '#ff006e', 16, 0.45);
        }
      }
    }

    if (attackerTeam === 'player' && Math.abs(x - 1470) <= radius + 30) {
      this.enemyBaseHp = Math.max(0, this.enemyBaseHp - dmg);
      this.fx.burst(1470, GROUND_Y - 60, '#ef4444', 10, 130, 0.35, 3.5);
    } else if (attackerTeam === 'enemy' && Math.abs(x - 130) <= radius + 30) {
      this.playerBaseHp = Math.max(0, this.playerBaseHp - dmg);
      this.fx.burst(130, GROUND_Y - 60, '#3a86ff', 10, 130, 0.35, 3.5);
      this.sounds.hit();
    }
  }

  updateActiveSpecials(dt) {
    for (const s of this.activeSpecials) {
      s.delay -= dt;
      if (s.delay <= 0 && !s.landed) {
        s.landed = true;
        this.damageArea(s.targetX, 95, s.dmg, s.team);
        this.fx.screenShake(10, 0.35);
        this.sounds.explosion();
        this.fx.ring(s.targetX, GROUND_Y - 15, '#ffd166', 85, 0.45, 6);
        this.fx.burst(s.targetX, GROUND_Y - 20, '#ff006e', 28, 220, 0.65, 5.5);
      }
    }
    this.activeSpecials = this.activeSpecials.filter((s) => !s.landed);
  }

  updateAiDirector(dt) {
    this.aiThinkTimer -= dt;
    if (this.aiThinkTimer > 0) return;
    this.aiThinkTimer = (1.2 + Math.random() * 0.8) / (1 + 0.2 * (this.pLevel - 1));

    const eEra = this.enemyEra;
    const eraDef = ERAS[eEra];

    if (eEra < ERAS.length - 1 && this.enemyXp >= eraDef.evolveXp) {
      this.enemyEvolve();
      return;
    }

    if (this.enemyBaseHp < this.enemyBaseMaxHp * 0.45 && this.enemySpecialCd <= 0) {
      this.tryTriggerSpecial('enemy');
      return;
    }

    if (this.enemyGold > 400) {
      for (let i = 0; i < this.enemyTurrets.length; i++) {
        const slot = this.enemyTurrets[i];
        if (!slot.unlocked && this.enemyGold >= 300) {
          slot.unlocked = true;
          this.enemyGold -= 250;
          break;
        } else if (slot.unlocked && (slot.turretEra === null || slot.turretEra < eEra)) {
          if (this.enemyGold >= eraDef.turret.cost) {
            this.enemyGold -= eraDef.turret.cost;
            slot.turretEra = eEra;
            break;
          }
        }
      }
    }

    let playerHeavyCount = 0;
    let playerRangedCount = 0;
    for (const u of this.units) {
      if (u.team === 'player') {
        if (u.type === 'heavy') playerHeavyCount++;
        if (u.type === 'ranged') playerRangedCount++;
      }
    }

    let chosenTier = 0;
    if (playerRangedCount >= 2 && this.enemyGold >= eraDef.units[2].cost) {
      chosenTier = 2;
    } else if (playerHeavyCount >= 1 && this.enemyGold >= eraDef.units[1].cost) {
      chosenTier = 1;
    } else {
      const roll = Math.random();
      if (roll < 0.45 && this.enemyGold >= eraDef.units[0].cost) chosenTier = 0;
      else if (roll < 0.80 && this.enemyGold >= eraDef.units[1].cost) chosenTier = 1;
      else if (this.enemyGold >= eraDef.units[2].cost) chosenTier = 2;
    }

    this.queueUnit('enemy', chosenTier);
  }

  updateCamera(dt) {
    if (this.userPannedTimer > 0) {
      this.userPannedTimer -= dt;
      return;
    }

    let frontX = 140;

    if (this.units.length > 0) {
      let pLead = 140;
      let eLead = 1460;
      let hasPlayer = false;
      let hasEnemy = false;
      for (const u of this.units) {
        if (u.team === 'player') {
          if (u.x > pLead) pLead = u.x;
          hasPlayer = true;
        }
        if (u.team === 'enemy') {
          if (u.x < eLead) eLead = u.x;
          hasEnemy = true;
        }
      }
      if (hasPlayer && hasEnemy) {
        frontX = (pLead + eLead) / 2;
      } else if (hasPlayer) {
        frontX = pLead;
      } else if (hasEnemy && eLead < 700) {
        frontX = eLead;
      } else {
        frontX = 140;
      }
    }

    this.targetCamX = clamp(frontX - this.W / 2, 0, WORLD_W - this.W);
    this.camX += (this.targetCamX - this.camX) * Math.min(1.0, 3.2 * dt);
  }

  checkWinLoss() {
    if (this.playerBaseHp <= 0 && !this.gameLost) {
      this.gameLost = true;
      this.die('Base Fortress Destroyed!');
      this.sounds.fail();
      this.haptics.fail();
      this.fx.screenShake(25, 1.0);
      this.fx.burst(120, GROUND_Y - 100, '#ef4444', 60, 300, 1.2, 7);
      return;
    }

    if (this.enemyBaseHp <= 0 && !this.gameWon) {
      this.gameWon = true;
      this.score += 5000 + (this.playerEra * 1500);
      this.sounds.survive();
      this.haptics.success();
      this.fx.screenShake(25, 1.0);
      this.fx.burst(1480, GROUND_Y - 100, '#ffd166', 80, 350, 1.4, 8);
      this.fx.text(this.W / 2, 280, 'VICTORY! ENEMY FORTRESS CRUSHED! 🏆', '#ffd166', 26, 3.0);
      // Signal Reel.js: stage cleared (Reel handles bonus + prestige promotion).
      this.won = true;
      this.winReason = 'Enemy Citadel Destroyed! 🏰';
    }
  }

  /* -------------------------------------------------------------------------
   * RENDERING & JELLY WORLD ART DIRECTION
   * ------------------------------------------------------------------------- */
  render() {
    const ctx = this.ctx;
    const shake = this.fx.offset();

    ctx.save();
    try {
      ctx.translate(shake.x, shake.y);

      // 1. Sky & Celestial Energy (Screen-Space)
      this.renderSky(ctx);

      // 2. Parallax Backdrop (Screen-Space: Mountains, Royal Liver clocktower, Lollipop hills)
      this.renderParallaxBackground(ctx);

      // 3. World Space Layer (Camera Transformed)
      ctx.save();
      try {
        ctx.translate(-Math.floor(this.camX), 0);

        this.renderGround(ctx);
        this.renderBases(ctx);
        this.renderUnits(ctx);
        this.renderTurrets(ctx);
        this.renderProjectiles(ctx);
        this.renderSpecialAttacksWorld(ctx);
        this.renderSlashArcs(ctx);
        this.renderMuzzleFlashes(ctx);
        this.fx.render(ctx);
      } finally {
        ctx.restore();
      }

      // 4. Screen-Space UI & HUD Deck
      this.renderTopRadar(ctx);
      this.renderTopHud(ctx);
      this.renderHomeBaseTracker(ctx);
      this.renderBottomCommandDeck(ctx);
    } finally {
      ctx.restore();
    }
  }

  renderSky(ctx) {
    const eraColors = ERAS[this.playerEra].skyColor;
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, eraColors[0]);
    grad.addColorStop(0.55, eraColors[1]);
    grad.addColorStop(1, eraColors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, GROUND_Y);

    // Soft celestial sun / glowing candy energy orb
    const sunGlow = ctx.createRadialGradient(this.W * 0.78, 85, 4, this.W * 0.78, 85, 130);
    sunGlow.addColorStop(0, 'rgba(255, 240, 180, 0.6)');
    sunGlow.addColorStop(0.4, 'rgba(255, 210, 110, 0.22)');
    sunGlow.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, this.W, GROUND_Y);
  }

  renderParallaxBackground(ctx) {
    // --- Layer 1: Cotton-Candy Marshmallow Clouds & Zeppelins (Speed 0.08) ---
    for (const c of this.clouds) {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      const wrapW = this.W + 180;
      const cx = ((c.x - this.camX * 0.08) % wrapW + wrapW) % wrapW - 90;

      if (c.type === 'zeppelin') {
        // Candy Airship
        ctx.fillStyle = '#ff006e';
        ctx.beginPath();
        ctx.ellipse(cx, c.y, 24 * c.scale, 11 * c.scale, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(cx - 7 * c.scale, c.y + 7 * c.scale, 14 * c.scale, 4 * c.scale);
      } else {
        // Puffy Marshmallow Cloud
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.beginPath();
        ctx.arc(cx, c.y, 18 * c.scale, 0, TAU);
        ctx.arc(cx + 16 * c.scale, c.y - 7 * c.scale, 22 * c.scale, 0, TAU);
        ctx.arc(cx + 36 * c.scale, c.y, 16 * c.scale, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // --- Layer 2: Distant Pastel Horizons & Royal Liver Clock Tower (Speed 0.16) ---
    ctx.save();
    ctx.fillStyle = 'rgba(28, 20, 52, 0.42)';
    ctx.beginPath();
    ctx.moveTo(-20, GROUND_Y);
    const farOffset = (this.camX * 0.16) % 400;
    for (let x = -20; x <= this.W + 30; x += 25) {
      const wx = x + farOffset;
      const peakH = 135 + Math.sin(wx * 0.012) * 50 + Math.cos(wx * 0.025) * 22;
      ctx.lineTo(x, GROUND_Y - peakH);
    }
    ctx.lineTo(this.W + 30, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // Iconic Royal Liver Clock Tower Silhouette
    const tWrap = 650;
    const towerScreenX = ((680 - this.camX * 0.18) % tWrap + tWrap) % tWrap - 80;
    ctx.fillStyle = 'rgba(38, 28, 68, 0.65)';
    // Twin clock towers and central hall
    ctx.fillRect(towerScreenX, GROUND_Y - 210, 24, 210);
    ctx.fillRect(towerScreenX + 36, GROUND_Y - 210, 24, 210);
    ctx.fillRect(towerScreenX - 6, GROUND_Y - 140, 72, 140);
    // Domes
    ctx.beginPath();
    ctx.arc(towerScreenX + 12, GROUND_Y - 218, 12, 0, TAU);
    ctx.arc(towerScreenX + 48, GROUND_Y - 218, 12, 0, TAU);
    ctx.fill();
    // Glowing Clock dials
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(towerScreenX + 12, GROUND_Y - 180, 6, 0, TAU);
    ctx.arc(towerScreenX + 48, GROUND_Y - 180, 6, 0, TAU);
    ctx.fill();
    ctx.restore();

    // --- Layer 3: Midground Marzipan Hills & Swirled Lollipop Trees (Speed 0.38) ---
    ctx.save();
    ctx.fillStyle = 'rgba(44, 32, 74, 0.62)';
    ctx.beginPath();
    ctx.moveTo(-20, GROUND_Y);
    const midOffset = (this.camX * 0.38) % 320;
    for (let x = -20; x <= this.W + 30; x += 20) {
      const wx = x + midOffset;
      const hillH = 75 + Math.sin(wx * 0.016 + 1.2) * 32;
      ctx.lineTo(x, GROUND_Y - hillH);
    }
    ctx.lineTo(this.W + 30, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Spiral Lollipop Trees along Midground
    for (let i = 0; i < 4; i++) {
      const treeWrap = this.W + 80;
      const treeScreenX = (((i * 155 + 30) - (this.camX * 0.38)) % treeWrap + treeWrap) % treeWrap - 40;
      const treeY = GROUND_Y - 55 - Math.sin((treeScreenX + midOffset) * 0.016 + 1.2) * 20;

      // White candy stick
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(treeScreenX - 3, treeY, 6, 55);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(treeScreenX - 3, treeY, 6, 55);

      // Giant Swirled Lollipop head
      const isPink = i % 2 === 0;
      ctx.fillStyle = isPink ? '#ff006e' : '#ffd166';
      ctx.beginPath();
      ctx.arc(treeScreenX, treeY, 18, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.8;
      ctx.stroke();

      // White spiral icing
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(treeScreenX, treeY, 12, 0.3, Math.PI + 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(treeScreenX, treeY, 5, 0.8, Math.PI + 0.8);
      ctx.stroke();

      // Candy canes planted along hills
      const caneX = treeScreenX + 32;
      const caneY = treeY + 15;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(caneX, caneY + 28);
      ctx.lineTo(caneX, caneY);
      ctx.arc(caneX - 6, caneY, 6, 0, Math.PI, true);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderGround(ctx) {
    const groundColor = ERAS[this.playerEra].groundColor;

    // Confectionery Biscuit & Chocolate Bedrock
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, this.H);
    groundGrad.addColorStop(0, groundColor);
    groundGrad.addColorStop(0.2, '#382216');
    groundGrad.addColorStop(1, '#1a0e08');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, WORLD_W, this.H - GROUND_Y);

    // Biscuit wafer grid pattern
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < WORLD_W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 16);
      ctx.lineTo(x + 16, GROUND_Y + 48);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 16, GROUND_Y + 16);
      ctx.lineTo(x, GROUND_Y + 48);
      ctx.stroke();
    }

    // Thick marshmallow frosting glaze with voluptuous drips
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= WORLD_W; x += 36) {
      const dripLen = 8 + (Math.sin(x * 0.1) * 0.5 + 0.5) * 10;
      ctx.lineTo(x + 12, GROUND_Y + 4);
      ctx.quadraticCurveTo(x + 18, GROUND_Y + dripLen, x + 24, GROUND_Y + 4);
      ctx.lineTo(x + 36, GROUND_Y + 3);
    }
    ctx.lineTo(WORLD_W, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Frosted line edge
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(0, GROUND_Y - 2, WORLD_W, 3);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, GROUND_Y - 2, WORLD_W, 3);

    // Colorful candy sprinkles on the frosting
    const sprinkleColors = ['#ff006e', '#00f5d4', '#ffd166', '#8338ec', '#3a86ff'];
    for (let x = 15; x < WORLD_W; x += 40) {
      const color = sprinkleColors[(x * 7) % sprinkleColors.length];
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.save();
      ctx.translate(x, GROUND_Y + 6);
      ctx.rotate((x % 9) * 0.3);
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.strokeRect(-3, -1.5, 6, 3);
      ctx.restore();
    }
  }

  /* -------------------------------------------------------------------------
   * CONFECTIONERY FORTRESS ARCHITECTURE
   * ------------------------------------------------------------------------- */
  renderBases(ctx) {
    // Player Fortress (Left: x = 10..140)
    this.drawJellyFortress(ctx, 10, GROUND_Y, 130, 190, this.playerEra, 'player', this.playerBaseHp, this.playerBaseMaxHp);

    // Enemy Fortress (Right: x = 1450..1580)
    this.drawJellyFortress(ctx, 1450, GROUND_Y, 130, 190, this.enemyEra, 'enemy', this.enemyBaseHp, this.enemyBaseMaxHp);
  }

  drawJellyFortress(ctx, x, groundY, w, h, era, team, hp, maxHp) {
    ctx.save();
    const isPlayer = team === 'player';
    const topY = groundY - h;

    if (era === 0) {
      // --- Era 0: Prehistoric Sugar-Geode Cave ---
      // Luminous high-contrast candy geode formation (never blends with background)
      const caveGrad = ctx.createLinearGradient(x, topY, x + w, groundY);
      if (isPlayer) {
        caveGrad.addColorStop(0, '#00f5d4'); // Bright electric cyan crystal spire
        caveGrad.addColorStop(0.3, '#00b4d8');
        caveGrad.addColorStop(0.7, '#0077b6');
        caveGrad.addColorStop(1, '#03045e');
      } else {
        caveGrad.addColorStop(0, '#ff0055'); // Fiery ruby crystal spire
        caveGrad.addColorStop(0.3, '#d90429');
        caveGrad.addColorStop(0.7, '#9d0208');
        caveGrad.addColorStop(1, '#370617');
      }
      ctx.fillStyle = caveGrad;
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x + 12, topY + 40);
      ctx.lineTo(x + 35, topY - 15);
      ctx.lineTo(x + 65, topY + 10);
      ctx.lineTo(x + 95, topY - 20);
      ctx.lineTo(x + w, topY + 35);
      ctx.lineTo(x + w, groundY);
      ctx.closePath();
      ctx.fill();

      // Bold cartoon outline around the entire fortress silhouette
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Sharp crystal facets with cartoon bevels
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x + 35, topY - 15);
      ctx.lineTo(x + 50, topY + 50);
      ctx.lineTo(x + 95, topY - 20);
      ctx.stroke();

      // Specular shine line along facet
      ctx.strokeStyle = isPlayer ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 200, 220, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 37, topY - 10);
      ctx.lineTo(x + 48, topY + 40);
      ctx.stroke();

      // Glowing sugar crystal clusters protruding from the spire
      const geodeColors = isPlayer ? ['#00f5d4', '#ffd166', '#70e000', '#ffffff'] : ['#ff006e', '#ff758f', '#ffd166', '#ffbe0b'];
      for (let i = 0; i < 5; i++) {
        const gx = x + 16 + i * 22;
        const gy = topY + 12 + (i % 2) * 16;
        const cColor = geodeColors[i % geodeColors.length];
        // Crystal Glow
        const cg = ctx.createRadialGradient(gx + 8, gy + 8, 2, gx + 8, gy + 8, 18);
        cg.addColorStop(0, cColor);
        cg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(gx + 8, gy + 8, 18, 0, TAU);
        ctx.fill();

        // Crystal Prism with thick black outline
        ctx.fillStyle = cColor;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(gx + 8, gy - 10);
        ctx.lineTo(gx + 16, gy + 10);
        ctx.lineTo(gx + 8, gy + 22);
        ctx.lineTo(gx, gy + 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Sugar Stalactite Cave Entrance with thick black outline
      ctx.fillStyle = '#050508';
      const gateX = isPlayer ? (x + w - 48) : x + 8;
      ctx.beginPath();
      ctx.arc(gateX + 20, groundY - 30, 20, Math.PI, 0);
      ctx.rect(gateX, groundY - 30, 40, 30);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Glowing Amber Crystal Torch by entrance with black outline
      const torchX = isPlayer ? (gateX - 8) : (gateX + 48);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(torchX, groundY - 40, 6 + Math.sin(this.time * 8) * 1.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.stroke();

    } else if (era === 1) {
      // --- Era 1: Royal Gingerbread & Wafer Keep ---
      const keepGrad = ctx.createLinearGradient(x, topY, x + w, groundY);
      keepGrad.addColorStop(0, isPlayer ? '#9c6644' : '#7f4f24');
      keepGrad.addColorStop(1, '#4a2810');
      ctx.fillStyle = keepGrad;
      ctx.beginPath();
      ctx.roundRect(x, topY, w, h, [14, 14, 0, 0]);
      ctx.fill();

      // Thick black cartoon outline around keep
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5.5;
      ctx.stroke();

      // White icing brick mortar lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2;
      for (let ly = topY + 24; ly < groundY - 20; ly += 24) {
        ctx.beginPath();
        ctx.moveTo(x + 6, ly);
        ctx.lineTo(x + w - 6, ly);
        ctx.stroke();
      }

      // Peppermint-striped crenellations with thick black outline
      for (let bx = 0; bx < w; bx += 22) {
        ctx.fillStyle = (bx % 44 === 0) ? '#d90429' : '#ffffff';
        ctx.fillRect(x + bx, topY - 14, 14, 14);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + bx, topY - 14, 14, 14);
      }

      // Royal Swallowtail Pennant Flag
      ctx.fillStyle = isPlayer ? '#4cc9f0' : '#f72585';
      const flagX = isPlayer ? x + w - 10 : x + 10;
      ctx.beginPath();
      ctx.moveTo(flagX, topY - 32);
      ctx.lineTo(flagX + (isPlayer ? 22 : -22), topY - 24);
      ctx.lineTo(flagX, topY - 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.8;
      ctx.stroke();

      // Wafer Drawbridge Portal with thick black outline
      ctx.fillStyle = '#1a0d00';
      const gateX = isPlayer ? (x + w - 40) : x + 6;
      ctx.beginPath();
      ctx.roundRect(gateX, groundY - 55, 36, 55, [16, 16, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.stroke();

    } else if (era === 2) {
      // --- Era 2: Marzipan Citadel (Albert Dock Sugar-Brick) ---
      const brickGrad = ctx.createLinearGradient(x, topY, x + w, groundY);
      brickGrad.addColorStop(0, isPlayer ? '#b02a37' : '#821822');
      brickGrad.addColorStop(1, '#440810');
      ctx.fillStyle = brickGrad;
      ctx.beginPath();
      ctx.roundRect(x, topY, w, h, [12, 12, 0, 0]);
      ctx.fill();

      // Thick black cartoon outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5.5;
      ctx.stroke();

      // Marzipan Neoclassical Columns with black borders
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 10, topY + 18, 12, h - 30);
      ctx.fillRect(x + w - 22, topY + 18, 12, h - 30);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 10, topY + 18, 12, h - 30);
      ctx.strokeRect(x + w - 22, topY + 18, 12, h - 30);

      // Verdigris Copper Clock Tower Domes
      ctx.fillStyle = '#4cc9f0';
      ctx.beginPath();
      ctx.arc(x + w / 2, topY - 10, 16, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Golden Clock Dial
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(x + w / 2, topY + 22, 11, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.8;
      ctx.stroke();
      ctx.fillStyle = '#0b090a';
      ctx.fillRect(x + w / 2 - 1.5, topY + 14, 3, 8);

      // Gate
      ctx.fillStyle = '#10002b';
      const gateX = isPlayer ? (x + w - 40) : x + 6;
      ctx.beginPath();
      ctx.roundRect(gateX, groundY - 55, 36, 55, [18, 18, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.stroke();

    } else if (era === 3) {
      // --- Era 3: Reinforced Jawbreaker Bunker ---
      const steelGrad = ctx.createLinearGradient(x, topY, x + w, groundY);
      steelGrad.addColorStop(0, isPlayer ? '#486581' : '#475569');
      steelGrad.addColorStop(1, '#102a43');
      ctx.fillStyle = steelGrad;
      ctx.beginPath();
      ctx.roundRect(x, topY, w, h, [10, 10, 0, 0]);
      ctx.fill();

      // Thick black cartoon outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5.5;
      ctx.stroke();

      // Steel Rivets
      ctx.fillStyle = '#f1f5f9';
      for (let ry = topY + 14; ry < groundY; ry += 30) {
        ctx.beginPath();
        ctx.arc(x + 8, ry, 3, 0, TAU);
        ctx.arc(x + w - 8, ry, 3, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Spinning Radar Lollipop Dish on Roof
      const dishX = isPlayer ? x + 25 : x + w - 25;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(dishX, topY - 16, 12, 0.4, Math.PI - 0.4);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dishX - 2, topY - 10, 4, 10);
      ctx.strokeRect(dishX - 2, topY - 10, 4, 10);

      // Slit armored vision port
      ctx.fillStyle = '#00f5d4';
      ctx.fillRect(x + 30, topY + 35, w - 60, 8);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.8;
      ctx.strokeRect(x + 30, topY + 35, w - 60, 8);

      // Gate
      ctx.fillStyle = '#020617';
      const gateX = isPlayer ? (x + w - 40) : x + 6;
      ctx.beginPath();
      ctx.roundRect(gateX, groundY - 55, 36, 55, [8, 8, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.stroke();

    } else {
      // --- Era 4: Cyber-Jelly Energy Spire ---
      const spireGrad = ctx.createLinearGradient(x, topY, x + w, groundY);
      spireGrad.addColorStop(0, isPlayer ? '#0077b6' : '#9d0208');
      spireGrad.addColorStop(0.5, isPlayer ? '#023e8a' : '#6a040f');
      spireGrad.addColorStop(1, '#000814');
      ctx.fillStyle = spireGrad;
      ctx.beginPath();
      ctx.roundRect(x, topY, w, h, [20, 20, 0, 0]);
      ctx.fill();

      // Thick black cartoon outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5.5;
      ctx.stroke();

      // Pulsing Quantum Jelly Core
      const corePulse = Math.sin(this.time * 5) * 4;
      const coreGrad = ctx.createRadialGradient(x + w / 2, topY + 50, 4, x + w / 2, topY + 50, 26 + corePulse);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.5, isPlayer ? '#00f5d4' : '#ff006e');
      coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(x + w / 2, topY + 50, 26 + corePulse, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Fiber-optic neon circuit traces
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 12, groundY - 10);
      ctx.lineTo(x + 22, topY + 80);
      ctx.lineTo(x + w / 2, topY + 50);
      ctx.stroke();

      // Energy Shield Gate
      ctx.fillStyle = isPlayer ? 'rgba(0, 245, 212, 0.4)' : 'rgba(255, 0, 110, 0.4)';
      const gateX = isPlayer ? (x + w - 40) : x + 6;
      ctx.beginPath();
      ctx.roundRect(gateX, groundY - 55, 36, 55, [14, 14, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // --- Premium Cartoon Fortress Health Bar ---
    const barW = 88;
    const barH = 11;
    const barX = x + (w - barW) / 2;
    const barY = topY - 26;

    // Solid cartoon pill container with thick black border
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(barX - 4, barY - 4, barW + 8, barH + 8, 8);
    ctx.fill();
    ctx.stroke();

    const hpRatio = clamp(hp / maxHp, 0, 1);
    const hpGrad = ctx.createLinearGradient(barX, 0, barX + barW * hpRatio, 0);
    if (isPlayer) {
      hpGrad.addColorStop(0, '#00f5d4');
      hpGrad.addColorStop(1, '#06d6a0');
    } else {
      hpGrad.addColorStop(0, '#ff0055');
      hpGrad.addColorStop(1, '#f72585');
    }
    ctx.fillStyle = hpGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * hpRatio, barH, 4);
    ctx.fill();

    // Text Label with black shadow/outline
    ctx.font = '900 10px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(`${Math.ceil(hp)} / ${maxHp}`, barX + barW / 2, barY - 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.ceil(hp)} / ${maxHp}`, barX + barW / 2, barY - 4);

    ctx.restore();
  }

  renderTurrets(ctx) {
    for (let i = 0; i < this.playerTurrets.length; i++) {
      const slot = this.playerTurrets[i];
      if (!slot.unlocked || slot.turretEra === null) continue;
      const my = GROUND_Y - 120 - i * 38;
      this.drawJellyTurret(ctx, 120, my, slot.turretEra, 1);
    }

    for (let i = 0; i < this.enemyTurrets.length; i++) {
      const slot = this.enemyTurrets[i];
      if (!slot.unlocked || slot.turretEra === null) continue;
      const my = GROUND_Y - 120 - i * 38;
      this.drawJellyTurret(ctx, 1480, my, slot.turretEra, -1);
    }
  }

  drawJellyTurret(ctx, x, y, era, dir) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);

    // Swivel Turret Hub with specular highlight & bold black cartoon stroke
    const hubGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, 10);
    hubGrad.addColorStop(0, '#cbd5e1');
    hubGrad.addColorStop(1, '#475569');
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Era-Specific Candy Barrel with bold black cartoon strokes
    if (era === 0) {
      // Mammoth bone slingshot
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, -3, 16, 6);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, -3, 16, 6);

      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(16, 0, 4.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (era === 1) {
      // Polished brass ballista
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(0, -4, 22, 8);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, -4, 22, 8);

      ctx.fillStyle = '#d90429';
      ctx.fillRect(18, -6, 5, 12);
      ctx.strokeRect(18, -6, 5, 12);
    } else if (era === 2) {
      // Albert dock heavy bombard
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, -6, 24, 12);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, -6, 24, 12);

      ctx.fillStyle = '#ffd166';
      ctx.fillRect(16, -7, 6, 14);
      ctx.strokeRect(16, -7, 6, 14);
    } else if (era === 3) {
      // Twin flak autocannon
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, -6, 26, 4.5);
      ctx.fillRect(0, 2, 26, 4.5);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.8;
      ctx.strokeRect(0, -6, 26, 4.5);
      ctx.strokeRect(0, 2, 26, 4.5);
    } else {
      // Quantum Ion Ray Emitter
      ctx.fillStyle = '#00f5d4';
      ctx.fillRect(0, -4, 24, 8);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, -4, 24, 8);

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(24, 0, 5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /* -------------------------------------------------------------------------
   * JELLY WORLD "BLOONS × FALL GUYS" CHARACTER RENDERING
   * ------------------------------------------------------------------------- */
  renderUnits(ctx) {
    for (const u of this.units) {
      this.renderJellyUnit(ctx, u);
    }
  }

  renderJellyUnit(ctx, u) {
    ctx.save();
    const isPlayer = u.team === 'player';

    // 1. Dying Animation: Jelly Bubble Pop with Ghost Soul
    if (u.isDying) {
      const deathProgress = 1.0 - clamp(u.deathTimer / 0.32, 0, 1);
      const popScale = 1.0 + deathProgress * 0.45;
      const alpha = 1.0 - deathProgress;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(u.x, u.y);
      ctx.scale(u.dir * popScale, popScale * (1.0 - deathProgress * 0.3));

      // Pop jelly ghost bubble
      ctx.fillStyle = isPlayer ? '#38bdf8' : '#f72585';
      ctx.beginPath();
      ctx.arc(0, -u.size * 0.8, u.size * 0.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Dizzy eyes 'X X'
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      for (const ex of [-6, 6]) {
        ctx.beginPath();
        ctx.moveTo(ex - 3, -u.size * 0.8 - 3);
        ctx.lineTo(ex + 3, -u.size * 0.8 + 3);
        ctx.moveTo(ex + 3, -u.size * 0.8 - 3);
        ctx.lineTo(ex - 3, -u.size * 0.8 + 3);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // 2. Kinematic Phasing & Body Deformation
    const isWalking = u.state === 'walk';
    const isWindup = u.attackPhase === 'windup';
    const isStrike = u.attackPhase === 'strike';
    const isRecover = u.attackPhase === 'recover';

    const walkBounce = isWalking ? Math.abs(Math.sin(u.walkT * 10)) * 5 : 0;

    let bodySquashX = 1.0;
    let bodySquashY = 1.0;
    let bodyAngle = 0;

    if (isWindup) {
      const p = u.attackTime / Math.min(0.24, u.cd * 0.30);
      bodyAngle = -0.22 * Math.sin(p * Math.PI * 0.5); // Lean back in anticipation
      bodySquashX = 0.86; // Stretch tall
      bodySquashY = 1.22;
    } else if (isStrike) {
      bodyAngle = 0.32; // Aggressive forward lean
      bodySquashX = 1.28; // Heavy impact squash
      bodySquashY = 0.78;
    } else if (isRecover) {
      const recP = clamp((u.attackTime - 0.4) / (u.cd - 0.4), 0, 1);
      const wobble = Math.sin(recP * 18) * Math.exp(-recP * 4) * 0.16;
      bodyAngle = wobble;
      bodySquashX = 1.0 + wobble;
      bodySquashY = 1.0 - wobble;
    } else if (isWalking) {
      bodySquashY = 1.0 + Math.sin(u.walkT * 10) * 0.12;
      bodySquashX = 2 - bodySquashY;
      bodyAngle = Math.sin(u.walkT * 10) * 0.08;
    }

    // Apply victim recoil squash & knockback
    bodySquashX *= (2 - u.recoilSquash);
    bodySquashY *= u.recoilSquash;

    // Hit-stop shudder jitter
    const shudderX = u.shudderT > 0 ? (Math.random() - 0.5) * 6 : 0;
    const finalX = u.x + (u.lungeX + u.recoilX) * u.dir + shudderX;
    const finalY = u.y - walkBounce;

    ctx.translate(finalX, finalY);
    ctx.scale(u.dir, 1);
    ctx.rotate(bodyAngle);

    // --- MOUNTS (Dino Rider / Caramel Steed / Tank / Mecha) ---
    if (u.tier === 2) {
      this.drawUnitMount(ctx, u, isPlayer);
    }

    // --- JELLYBEAN BODY Silhouettes ---
    const size = u.size;
    const bw = size * 0.78 * bodySquashX;
    const bh = size * 1.15 * bodySquashY;
    const by = -size * 0.95;

    // Candy Color Gradient (Translucent Gummy look)
    const bodyGrad = ctx.createLinearGradient(-bw / 2, by - bh / 2, bw / 2, by + bh / 2);
    if (isPlayer) {
      bodyGrad.addColorStop(0, '#25e6ff');
      bodyGrad.addColorStop(0.55, '#0096c7');
      bodyGrad.addColorStop(1, '#023e8a');
    } else {
      bodyGrad.addColorStop(0, '#ff758f');
      bodyGrad.addColorStop(0.55, '#f72585');
      bodyGrad.addColorStop(1, '#7209b7');
    }

    // Pill Body Outline with thick black cartoon stroke
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, by - bh / 2, bw, bh, bw / 2);
    ctx.fill();
    ctx.stroke();

    // 1. Signature "Bloons Specular Crescent" Forehead Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(-bw * 0.15, by - bh * 0.28, bw * 0.26, bh * 0.12, -0.3, 0, TAU);
    ctx.fill();

    // Lower belly gloss sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-bw * 0.1, by + bh * 0.15, bw * 0.20, bh * 0.08, -0.2, 0, TAU);
    ctx.fill();

    // 2. Animated Expressive Eyes (Combat Glare / Pain Squint / Blinking)
    const eyeY = by - bh * 0.08;

    if (u.hitFlash > 0.15) {
      // Cartoon Pain Squint '> <'
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-bw * 0.22, eyeY - 4);
      ctx.lineTo(-bw * 0.06, eyeY);
      ctx.lineTo(-bw * 0.22, eyeY + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bw * 0.22, eyeY - 4);
      ctx.lineTo(bw * 0.06, eyeY);
      ctx.lineTo(bw * 0.22, eyeY + 4);
      ctx.stroke();
    } else if (isWindup || isStrike) {
      // Fierce Battle Glare with angled eyebrows
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-bw * 0.12, eyeY, bw * 0.11, bh * 0.11, 0, 0, TAU);
      ctx.ellipse(bw * 0.14, eyeY, bw * 0.11, bh * 0.11, 0, 0, TAU);
      ctx.fill();

      // Sharp focused pupils
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-bw * 0.07, eyeY, bw * 0.055, 0, TAU);
      ctx.arc(bw * 0.19, eyeY, bw * 0.055, 0, TAU);
      ctx.fill();

      // Angled eyebrows
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-bw * 0.24, eyeY - 7);
      ctx.lineTo(-bw * 0.04, eyeY - 3);
      ctx.moveTo(bw * 0.24, eyeY - 3);
      ctx.lineTo(bw * 0.04, eyeY - 7);
      ctx.stroke();
    } else {
      const isBlinking = (u.blinkT % 3.6) < 0.15;
      if (isBlinking) {
        // Closed Eye Lines
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-bw * 0.18, eyeY);
        ctx.lineTo(-bw * 0.04, eyeY);
        ctx.moveTo(bw * 0.08, eyeY);
        ctx.lineTo(bw * 0.22, eyeY);
        ctx.stroke();
      } else {
        // Big Glossy Ovals with Specular Catchlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-bw * 0.12, eyeY, bw * 0.11, bh * 0.13, 0, 0, TAU);
        ctx.ellipse(bw * 0.14, eyeY, bw * 0.11, bh * 0.13, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-bw * 0.10, eyeY, bw * 0.06, 0, TAU);
        ctx.arc(bw * 0.16, eyeY, bw * 0.06, 0, TAU);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-bw * 0.12, eyeY - 2, 1.5, 0, TAU);
        ctx.arc(bw * 0.14, eyeY - 2, 1.5, 0, TAU);
        ctx.fill();
      }
    }

    // --- COSTUMES & HATS ---
    this.drawUnitCostume(ctx, u, bw, bh, by);

    // --- WEAPONS & COMBAT SWING ---
    this.drawUnitWeaponV2(ctx, u, bw, bh, by);

    // --- HIT FLASH OVERLAY ---
    if (u.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${u.hitFlash * 0.7})`;
      ctx.beginPath();
      ctx.roundRect(-bw / 2, by - bh / 2, bw, bh, bw / 2);
      ctx.fill();
    }

    // --- FLOATING HEALTH BAR ---
    ctx.scale(u.dir, 1); // Reset dir for text
    const barW = size * 1.35;
    const barH = 5;
    const barX = -barW / 2;
    const barY = by - bh * 0.72;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.roundRect(barX - 1.5, barY - 1.5, barW + 3, barH + 3, 3);
    ctx.fill();

    const hpRatio = clamp(u.hp / u.maxHp, 0, 1);
    ctx.fillStyle = isPlayer ? '#10b981' : '#f72585';
    ctx.roundRect(barX, barY, barW * hpRatio, barH, 2);
    ctx.fill();

    ctx.restore();
  }

  drawUnitMount(ctx, u, isPlayer) {
    const era = u.era;
    const isWindup = u.attackPhase === 'windup';
    const isStrike = u.attackPhase === 'strike';

    if (era === 0) {
      // Adorable Chubby Gummy T-Rex Mount with Animated Chomp Bite
      ctx.save();
      ctx.translate(-6, 0);

      let dinoAngle = 0;
      let dinoLungeX = 0;
      let jawAngle = 0;

      if (isWindup) {
        dinoAngle = -0.25; // Rears back in anticipation!
        dinoLungeX = -8;
        jawAngle = 0.55; // Jaws drop wide open!
      } else if (isStrike) {
        dinoAngle = 0.32; // Violent forward bite snap!
        dinoLungeX = 18;
        jawAngle = 0; // Jaws clamp shut!
      }

      ctx.translate(dinoLungeX, 0);
      ctx.rotate(dinoAngle);

      const dinoGrad = ctx.createLinearGradient(-26, -35, 26, 0);
      dinoGrad.addColorStop(0, '#52b788');
      dinoGrad.addColorStop(0.5, '#40916c');
      dinoGrad.addColorStop(1, '#1b4332');
      ctx.fillStyle = dinoGrad;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.8;

      // Chubby Dino Body
      ctx.beginPath();
      ctx.ellipse(0, -16, 26, 17, -0.15, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Tail with dynamic whip
      const tailWhip = isStrike ? -28 : (isWindup ? -8 : -14);
      ctx.beginPath();
      ctx.moveTo(-22, -14);
      ctx.quadraticCurveTo(-38, tailWhip, -48, tailWhip + 8);
      ctx.lineTo(-24, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Big Chubby Head
      ctx.beginPath();
      ctx.ellipse(22, -24, 16, 12, 0.1, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Lower Jaw (Drops open during windup, snaps shut on strike!)
      ctx.save();
      ctx.translate(16, -18);
      ctx.rotate(jawAngle);
      ctx.fillStyle = dinoGrad;
      ctx.beginPath();
      ctx.roundRect(0, 0, 18, 7, [0, 6, 6, 0]);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.stroke();

      // White Sugar Teeth in open/shut jaw
      ctx.fillStyle = '#ffffff';
      for (let tx = 4; tx < 16; tx += 4) {
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx + 2, -3);
        ctx.lineTo(tx + 4, 0);
        ctx.fill();
      }
      ctx.restore();

      // Bloons Specular Highlight on Dino Forehead & Back
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.ellipse(20, -28, 8, 3.5, -0.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-4, -26, 10, 4, 0, 0, TAU);
      ctx.fill();

      // Big Googly Dino Eye (Glaring forward during attack)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(22, -26, 5.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(isWindup ? 22 : 24, -26, 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(24.5, -27.5, 1.2, 0, TAU);
      ctx.fill();

      // Stumpy Dino Legs (Bouncy trot)
      const legBob = Math.sin(u.walkT * 12) * 5;
      ctx.fillStyle = '#2d6a4f';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.roundRect(-8, -8, 8, 12 + legBob, 4);
      ctx.roundRect(8, -8, 8, 12 - legBob, 4);
      ctx.fill();
      ctx.stroke();

      // Tiny arms
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(14, -16);
      ctx.lineTo(isStrike ? 24 : 20, isStrike ? -14 : -12);
      ctx.stroke();

      ctx.restore();
    } else if (era === 1) {
      // Caramel Jousting Steed (Rears up on hind legs during attack)
      ctx.save();
      ctx.translate(-6, 0);

      let steedAngle = 0;
      let steedLungeX = 0;
      if (isWindup) {
        steedAngle = -0.36; // Rears up majestically!
        steedLungeX = -8;
      } else if (isStrike) {
        steedAngle = 0.24; // Stomps down hard!
        steedLungeX = 18;
      }
      ctx.translate(steedLungeX, 0);
      ctx.rotate(steedAngle);

      const steedGrad = ctx.createLinearGradient(-24, -30, 24, 0);
      steedGrad.addColorStop(0, '#ddb892');
      steedGrad.addColorStop(0.5, '#b08968');
      steedGrad.addColorStop(1, '#7f5539');
      ctx.fillStyle = steedGrad;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.8;

      // Steed Body
      ctx.beginPath();
      ctx.ellipse(0, -16, 26, 15, -0.1, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Royal Barding Blanket
      ctx.fillStyle = isPlayer ? '#2563eb' : '#d90429';
      ctx.fillRect(-14, -20, 28, 14);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-14, -20, 28, 14);

      // Horse Head & Mane
      ctx.fillStyle = steedGrad;
      ctx.beginPath();
      ctx.ellipse(22, -25, 13, 9, 0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Mane
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(16, -30, 6, 0, TAU);
      ctx.arc(10, -26, 6, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    } else if (era === 2) {
      // Brass Truffle Cannon Carriage (Hard kickback recoil on strike)
      ctx.save();
      const recoilX = isStrike ? -14 : (isWindup ? 4 : 0);
      ctx.translate(2 + recoilX, -6);
      ctx.fillStyle = '#2b1b17';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(8, -12, 16, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Chocolate Spoke Wheel
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(4, 4, 12, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    } else if (era === 3) {
      // Chunky Bubblegum Tank (Barrel recoil & chassis tilt)
      ctx.save();
      const tankRecoilX = isStrike ? -12 : (isWindup ? 4 : 0);
      ctx.translate(tankRecoilX, -8);
      ctx.fillStyle = isPlayer ? '#38bdf8' : '#f72585';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-28, -16, 56, 20, 8);
      ctx.fill();
      ctx.stroke();

      // Heavy Treads
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(-30, 0, 60, 10, 5);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Long Cannon Barrel (recoils inward on strike)
      const barrelRecoil = isStrike ? -8 : 0;
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(10 + barrelRecoil, -12, 28, 6.5);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(10 + barrelRecoil, -12, 28, 6.5);
      ctx.restore();
    } else {
      // Hover Titan Grav-Pads (Lunge jets)
      ctx.save();
      const titanLungeX = isStrike ? 16 : (isWindup ? -6 : 0);
      ctx.translate(titanLungeX, 2);
      ctx.fillStyle = 'rgba(0, 245, 212, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 8, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawUnitCostume(ctx, u, bw, bh, by) {
    const era = u.era;

    if (era === 0) {
      // Tiger/Leopard pelt sash across chest
      ctx.fillStyle = '#f77f00';
      ctx.fillRect(-bw * 0.35, by - bh * 0.1, bw * 0.7, 5);
    } else if (era === 1) {
      if (u.tier === 0) {
        // Silver Knight Helmet Crest
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.roundRect(-bw * 0.4, by - bh * 0.55, bw * 0.8, bh * 0.35, [6, 6, 0, 0]);
        ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-bw * 0.1, by - bh * 0.7, bw * 0.2, 8);
      } else if (u.tier === 1) {
        // Robin Hood Cap with Red Feather
        ctx.fillStyle = '#2d6a4f';
        ctx.beginPath();
        ctx.moveTo(-bw * 0.4, by - bh * 0.35);
        ctx.lineTo(bw * 0.4, by - bh * 0.35);
        ctx.lineTo(-bw * 0.1, by - bh * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(bw * 0.1, by - bh * 0.6, 3, 8);
      }
    } else if (era === 2) {
      // Cavalier Plumed Hat
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(0, by - bh * 0.45, bw * 0.6, bh * 0.15, 0, 0, TAU);
      ctx.fill();
      // White Cotton-Candy Feather Plume
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bw * 0.25, by - bh * 0.6, 7, 0, TAU);
      ctx.fill();
    } else if (era === 3) {
      // Camo Combat Helmet
      ctx.fillStyle = '#4a5759';
      ctx.beginPath();
      ctx.arc(0, by - bh * 0.35, bw * 0.48, Math.PI, 0);
      ctx.fill();
    } else {
      // Cyber Neon Visor
      ctx.fillStyle = '#00f5d4';
      ctx.fillRect(-bw * 0.3, by - bh * 0.15, bw * 0.6, 5);
    }
  }

  drawUnitWeaponV2(ctx, u, bw, bh, by) {
    const era = u.era;
    const tier = u.tier;
    const isWindup = u.attackPhase === 'windup';
    const isStrike = u.attackPhase === 'strike';
    const isRecover = u.attackPhase === 'recover';

    let swingAngle = 0;
    let weaponSlideX = 0;
    let weaponSlideY = 0;

    if (tier === 0) {
      // Melee Weapon: Big overhead smash, thrust, or slash
      if (isWindup) {
        const p = u.attackTime / Math.min(0.24, u.cd * 0.30);
        swingAngle = -1.35 * Math.sin(p * Math.PI * 0.5); // Reaches high overhead
        weaponSlideX = -4;
        weaponSlideY = -6;
      } else if (isStrike) {
        swingAngle = 1.35; // Sweeps down violently
        weaponSlideX = 12;
        weaponSlideY = 4;
      } else if (isRecover) {
        const recP = clamp((u.attackTime - 0.4) / (u.cd - 0.4), 0, 1);
        swingAngle = 1.35 * (1.0 - recP) + 0.15 * Math.sin(recP * 12);
        weaponSlideX = 12 * (1.0 - recP);
      } else {
        swingAngle = Math.sin(u.walkT * 10) * 0.12;
      }
    } else if (tier === 1) {
      // Ranged Weapon: Aim, pull-back & kickback recoil
      if (isWindup) {
        weaponSlideX = -8; // Pulled taut toward cheek
        swingAngle = -0.12;
      } else if (isStrike) {
        weaponSlideX = 12; // Forward snap / kickback recoil
        swingAngle = 0.22;
      } else {
        weaponSlideX = 0;
        swingAngle = 0;
      }
    }

    ctx.save();
    ctx.translate(bw * 0.35 + weaponSlideX, by + bh * 0.1 + weaponSlideY);
    ctx.rotate(swingAngle);

    if (tier === 0) {
      // Melee Weapon
      if (era === 0) {
        // Mammoth Bone Club with glowing amber resin tip
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, -6, 22, 6);
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(22, -3, 8, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(20, -4, 3, 0, TAU);
        ctx.fill();
      } else if (era === 1) {
        // Sugar Knight Broadsword & Royal Shield
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, -4, 26, 5);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-2, -8, 5, 13);
        // Crimson pommel gem
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-4, -1.5, 3.5, 0, TAU);
        ctx.fill();
      } else if (era === 2) {
        // Silver Fencing Rapier with gold basket hilt
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, -2, 30, 3);
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(0, -0.5, 6, 0, TAU);
        ctx.fill();
      } else if (era === 3) {
        // Tactical Combat Knife / Baton
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, -5, 24, 6);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(20, -5, 4, 6);
      } else {
        // Dual Plasma Energy Katana with glowing cyan blade
        ctx.fillStyle = '#00f5d4';
        ctx.fillRect(0, -3.5, 30, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, -2, 28, 2);
      }
    } else if (tier === 1) {
      // Ranged Weapon
      if (era === 0) {
        // Forked Slingshot with stretched rubber band
        ctx.fillStyle = '#78350f';
        ctx.fillRect(0, -6, 14, 4);
        ctx.fillRect(10, -12, 4, 16);

        // Stretched elastic band
        const pullX = isWindup ? -12 : 2;
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, -12);
        ctx.lineTo(pullX, -4);
        ctx.lineTo(12, 4);
        ctx.stroke();

        // Pebble in pouch during windup
        if (isWindup) {
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.arc(pullX, -4, 4, 0, TAU);
          ctx.fill();
        }
      } else if (era === 1) {
        // Peppermint Recurve Bow with drawn bowstring
        const bowBend = isWindup ? 14 : 9;
        ctx.strokeStyle = '#d90429';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(6, 0, bowBend, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

        // White bowstring
        const stringPull = isWindup ? -12 : 6;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(6, -bowBend);
        ctx.lineTo(stringPull, 0);
        ctx.lineTo(6, bowBend);
        ctx.stroke();

        // Arrow nocked during windup
        if (isWindup) {
          ctx.fillStyle = '#ffd166';
          ctx.fillRect(stringPull, -1.5, 20, 3);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(stringPull + 16, -2.5, 4, 5);
        }
      } else if (era === 2) {
        // Brass Blunderbuss
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(0, -5, 22, 5);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(18, -8, 6, 11);
      } else if (era === 3) {
        // Ghillie Sniper Rifle with Target Laser
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, -4, 28, 5);
        if (isWindup) {
          // Red targeting laser line locks on!
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(28, -1.5);
          ctx.lineTo(160, -1.5);
          ctx.stroke();
        }
      } else {
        // Particle Energy Blaster
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, -5, 22, 7);
        ctx.fillStyle = '#00f5d4';
        ctx.fillRect(20, -4, 7, 5);
      }
    }

    ctx.restore();
  }

  /* -------------------------------------------------------------------------
   * CONFECTIONERY PROJECTILES & APOCALYPTIC SUPER ATTACKS
   * ------------------------------------------------------------------------- */
  renderProjectiles(ctx) {
    for (const p of this.projectiles) {
      ctx.save();
      const isPlayer = p.team === 'player';

      if (p.type === 'laser') {
        // Blinding dual-core laser beam
        ctx.strokeStyle = isPlayer ? '#00f5d4' : '#ff006e';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (p.type === 'arrow') {
        // Peppermint arrow with sugar trail
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-10, -1.5, 20, 3);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-10, -2.5, 4, 5);
      } else if (p.type === 'cannonball' || p.type === 'tank_shell') {
        // Chocolate Truffle Bomb
        ctx.fillStyle = '#2b1b17';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, TAU);
        ctx.fill();
        // Sizzling Sparkler Fuse
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(p.x - 3, p.y - 3, 2.5, 0, TAU);
        ctx.fill();
      } else {
        // Rotating Rainbow Jawbreaker Pebble
        ctx.fillStyle = isPlayer ? '#ffd166' : '#ff006e';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x - 1.5, p.y - 1.5, 1.5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  renderSpecialAttacksWorld(ctx) {
    for (const s of this.activeSpecials) {
      if (s.delay > 0) {
        // Incoming Projectile in Sky
        const t = clamp(1.0 - (s.delay / 0.8), 0, 1);
        const curX = s.startX + (s.targetX - s.startX) * t;
        const curY = s.startY + (GROUND_Y - s.startY) * t;

        ctx.save();
        try {
          if (s.era === 0) {
            // Fiery Sugar Asteroid
            ctx.fillStyle = '#f72585';
            ctx.beginPath();
            ctx.arc(curX, curY, 14, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(curX - 3, curY - 3, 7, 0, TAU);
            ctx.fill();
          } else if (s.era === 4) {
            // Orbital Ion Beam Targeting Reticle
            ctx.strokeStyle = '#00f5d4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(s.targetX, GROUND_Y - 10, 25, 0, TAU);
            ctx.stroke();
          }
        } finally {
          ctx.restore();
        }
      }
    }
  }

  renderSlashArcs(ctx) {
    for (const a of this.slashArcs) {
      ctx.save();
      const progress = 1.0 - (a.life / a.maxLife);
      const alpha = Math.sin(progress * Math.PI);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(a.x, a.y);
      ctx.scale(a.dir, 1);

      // Sweeping glowing crescent arc
      const grad = ctx.createLinearGradient(-a.radius, -a.radius, a.radius, a.radius);
      grad.addColorStop(0, a.color);
      grad.addColorStop(0.5, '#ffffff');
      grad.addColorStop(1, a.color);

      ctx.strokeStyle = grad;
      ctx.lineWidth = 6 * (1.0 - progress * 0.4);
      ctx.lineCap = 'round';
      ctx.beginPath();
      const startAngle = -Math.PI * 0.45 + progress * 0.2;
      const endAngle = Math.PI * 0.45 + progress * 0.2;
      ctx.arc(0, 0, a.radius, startAngle, endAngle);
      ctx.stroke();

      // Outer glow trail
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 12 * (1.0 - progress * 0.5);
      ctx.globalAlpha = alpha * 0.45;
      ctx.stroke();

      ctx.restore();
    }
  }

  renderMuzzleFlashes(ctx) {
    for (const m of this.muzzleFlashes) {
      ctx.save();
      const progress = 1.0 - (m.life / m.maxLife);
      const alpha = Math.max(0, 1.0 - progress);
      ctx.globalAlpha = alpha;
      ctx.translate(m.x, m.y);
      ctx.scale(m.dir, 1);

      // Starburst Muzzle Flash
      const r = 16 * (1.0 + progress * 0.5);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const dist = (i % 2 === 0) ? r : r * 0.4;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // White hot core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, TAU);
      ctx.fill();

      // Expanding smoke puff
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(10 + progress * 16, -2, 7 + progress * 6, 0, TAU);
      ctx.fill();

      ctx.restore();
    }
  }

  /* -------------------------------------------------------------------------
   * SCREEN-SPACE TOP RADAR & COMMAND DECK HUD
   * ------------------------------------------------------------------------- */
  renderTopRadar(ctx) {
    const rx = 115;
    const ry = 78;
    const rw = 220;
    const rh = 26;

    ctx.save();
    // Glassmorphism Container with subtle cyan/magenta inner tint
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 7);
    ctx.fill();
    ctx.stroke();

    // Base Blips
    ctx.fillStyle = '#00f5d4';
    ctx.fillRect(rx + 5, ry + 5, 6, rh - 10);
    ctx.fillStyle = '#ff006e';
    ctx.fillRect(rx + rw - 11, ry + 5, 6, rh - 10);

    // Units on Mini-Radar
    for (const u of this.units) {
      const uRatio = u.x / WORLD_W;
      const ux = rx + uRatio * rw;
      ctx.fillStyle = (u.team === 'player') ? '#00f5d4' : '#ff006e';
      ctx.beginPath();
      ctx.arc(ux, ry + rh / 2, 2.8, 0, TAU);
      ctx.fill();
    }

    // Camera Box
    const camLeftRatio = this.camX / WORLD_W;
    const camW = (this.W / WORLD_W) * rw;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx + camLeftRatio * rw, ry + 2, camW, rh - 4);

    ctx.restore();
  }

  renderTopHud(ctx) {
    ctx.save();
    ctx.font = 'bold 14px sans-serif';

    // Gold Box at y = 78
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(14, 78, 92, 26, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'left';
    ctx.fillText(`💰 ${Math.floor(this.playerGold)}`, 22, 96);

    // XP Box at y = 78
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(6, 214, 160, 0.4)';
    ctx.beginPath();
    ctx.roundRect(this.W - 108, 78, 94, 26, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#06d6a0';
    ctx.textAlign = 'right';
    ctx.fillText(`⭐ ${Math.floor(this.playerXp)}`, this.W - 20, 96);

    ctx.restore();
  }

  renderHomeBaseTracker(ctx) {
    if (this.camX <= 40) return;
    ctx.save();
    const bx = 12;
    const by = 135;
    const bw = 90;
    const bh = 34;

    // 3D Cartoon Drop Shadow
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(bx, by + 3.5, bw, bh, 10);
    ctx.fill();

    // Body
    const hpRatio = clamp(this.playerBaseHp / (this.playerBaseMaxHp || 500), 0, 1);
    const isLow = hpRatio < 0.3;
    const underAttack = (this.playerBaseFlashTimer || 0) > 0;

    ctx.fillStyle = underAttack ? '#ef4444' : '#0ea5e9';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10);
    ctx.fill();
    ctx.stroke();

    // Title + Mini Health Bar
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText('🏰 BASE', bx + 6, by + 13);

    ctx.fillStyle = '#000000';
    ctx.fillRect(bx + 6, by + 18, bw - 12, 8);
    ctx.fillStyle = isLow ? '#ef4444' : '#10b981';
    ctx.fillRect(bx + 7, by + 19, (bw - 14) * hpRatio, 6);

    ctx.restore();
  }

  renderBottomCommandDeck(ctx) {
    const deckY = 485;
    const deckH = this.H - deckY;

    ctx.save();

    // Chunky Toy Tray Background with bold 3.5px black border
    const bgGrad = ctx.createLinearGradient(0, deckY, 0, this.H);
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, deckY, this.W, deckH);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, deckY);
    ctx.lineTo(this.W, deckY);
    ctx.stroke();

    // Tabs Header
    this.renderTabs(ctx, deckY);

    // Tab Body
    if (this.activeTab === 'units') {
      this.renderUnitsTab(ctx, deckY + 44);
    } else {
      this.renderTurretsTab(ctx, deckY + 44);
    }

    ctx.restore();
  }

  renderTabs(ctx, y) {
    const tabW = 98;
    const tabH = 34;

    const drawTab = (tx, active, label, icon) => {
      // 3D Cartoon Drop Shadow
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(tx, y + 9, tabW, tabH, 8);
      ctx.fill();

      // Tab Face
      ctx.fillStyle = active ? '#2563eb' : '#334155';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(tx, y + 6, tabW, tabH, 8);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${icon} ${label}`, tx + tabW / 2, y + 28);
    };

    // Tab 1: Units
    drawTab(14, this.activeTab === 'units', 'UNITS', '⚔️');

    // Tab 2: Turrets
    drawTab(120, this.activeTab === 'turrets', 'TURRETS', '🏹');

    // Tab 3: Evolve Era
    const nextEraNeeded = ERAS[this.playerEra].evolveXp;
    const canEvolve = (this.playerEra < ERAS.length - 1) && (this.playerXp >= nextEraNeeded);
    
    // 3D Drop Shadow
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(226, y + 9, 96, tabH, 8);
    ctx.fill();

    ctx.fillStyle = canEvolve ? '#10b981' : '#1e293b';
    ctx.strokeStyle = canEvolve ? '#ffd166' : '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(226, y + 6, 96, tabH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = canEvolve ? '#ffffff' : '#94a3b8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(canEvolve ? '✨ EVOLVE!' : '🔒 EVOLVE', 226 + 48, y + 21);
    ctx.font = '9px sans-serif';
    ctx.fillText(`${Math.floor(this.playerXp)}/${nextEraNeeded}`, 226 + 48, y + 33);

    // Tab 4: Special Ability
    const sReady = this.playerSpecialCd <= 0;
    const sDef = ERAS[this.playerEra].special;

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(330, y + 9, 106, tabH, 8);
    ctx.fill();

    ctx.fillStyle = sReady ? '#ef4444' : '#1e293b';
    ctx.strokeStyle = sReady ? '#ffd166' : '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(330, y + 6, 106, tabH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = sReady ? '#ffffff' : '#64748b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(sReady ? `${sDef.icon} SUPER!` : `⏳ ${Math.ceil(this.playerSpecialCd)}s`, 330 + 53, y + 27);
  }

  renderUnitsTab(ctx, y) {
    const eraUnits = ERAS[this.playerEra].units;
    const btnW = (this.W - 32) / 3;
    const btnH = 98;

    for (let i = 0; i < 3; i++) {
      const u = eraUnits[i];
      const bx = 16 + i * btnW;
      const canAfford = this.playerGold >= u.cost;
      const cardW = btnW - 8;

      ctx.save();

      // 3D Cartoon Drop Shadow
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(bx, y + 7.5, cardW, btnH, 12);
      ctx.fill();

      // Card Face with 2.5px solid black border
      const cardGrad = ctx.createLinearGradient(bx, y, bx, y + btnH);
      if (canAfford) {
        cardGrad.addColorStop(0, '#334155');
        cardGrad.addColorStop(1, '#1e293b');
      } else {
        cardGrad.addColorStop(0, '#1e293b');
        cardGrad.addColorStop(1, '#0f172a');
      }
      ctx.fillStyle = cardGrad;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(bx, y + 4, cardW, btnH, 12);
      ctx.fill();
      ctx.stroke();

      // Top Specular Highlight Curve
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(bx + 2, y + 6, cardW - 4, (btnH - 8) * 0.38, [10, 10, 0, 0]);
      ctx.fill();

      // Unit Icon
      const iconCenterX = bx + cardW / 2;
      const iconCenterY = y + 28;

      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(u.icon, iconCenterX, iconCenterY + 8);

      // Name
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(u.name, iconCenterX, y + 52);

      // Stat Badges
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`HP ${u.hp} · ⚔️ ${u.dmg}`, iconCenterX, y + 67);

      // Juicy Candy Gold Badge with 3D drop shadow
      const badgeY = y + 74;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(iconCenterX - 34, badgeY + 1.5, 68, 18, 9);
      ctx.fill();

      ctx.fillStyle = canAfford ? '#fbbf24' : '#475569';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(iconCenterX - 34, badgeY, 68, 18, 9);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = canAfford ? '#000000' : '#94a3b8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`💰 ${u.cost}`, iconCenterX, badgeY + 13);

      ctx.restore();
    }

    // Training Queue Progress Bar
    if (this.playerQueue.length > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`TRAINING (${this.playerQueue.length}/5):`, 20, y + 120);

      const qBarW = this.W - 175;
      const ratio = clamp(this.playerQueueTimer / this.playerQueue[0].buildTime, 0, 1);
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(150, y + 112, qBarW, 11, 5);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.roundRect(151, y + 113, (qBarW - 2) * ratio, 9, 4);
      ctx.fill();
    }
  }

  renderTurretsTab(ctx, y) {
    const eraTurret = ERAS[this.playerEra].turret;
    const slotW = (this.W - 32) / 3;
    const btnH = 98;

    for (let i = 0; i < 3; i++) {
      const slot = this.playerTurrets[i];
      const bx = 16 + i * slotW;
      const cardW = slotW - 8;

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(bx, y + 7.5, cardW, btnH, 12);
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(bx, y + 4, cardW, btnH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';

      if (!slot.unlocked) {
        const cost = (i === 1) ? 250 : 600;
        ctx.font = '24px sans-serif';
        ctx.fillText('🔒', bx + cardW / 2, y + 34);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`UNLOCK #${i + 1}`, bx + cardW / 2, y + 54);
        ctx.fillStyle = '#ffd166';
        ctx.fillText(`💰 ${cost}`, bx + cardW / 2, y + 78);
      } else if (slot.turretEra === null) {
        ctx.font = '24px sans-serif';
        ctx.fillText('➕', bx + cardW / 2, y + 34);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`BUILD ${eraTurret.name}`, bx + cardW / 2, y + 54);
        ctx.fillStyle = '#ffd166';
        ctx.fillText(`💰 ${eraTurret.cost}`, bx + cardW / 2, y + 78);
      } else {
        const tDef = ERAS[slot.turretEra].turret;
        ctx.font = '24px sans-serif';
        ctx.fillText('🏹', bx + cardW / 2, y + 34);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#10b981';
        ctx.fillText(tDef.name, bx + cardW / 2, y + 54);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`DMG: ${tDef.dmg}`, bx + cardW / 2, y + 68);
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('TAP TO SELL', bx + cardW / 2, y + 84);
      }
    }
  }
}
