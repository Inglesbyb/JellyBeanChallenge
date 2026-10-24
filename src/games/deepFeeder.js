import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const TAU = Math.PI * 2;
export const WORLD_W = 40000;
export const MAXY = 45000;
export const MINY = 70;

export const STAGES = [
  { n: 'Swedish Gummy Fish',    s: 0,   icon: '🍬', title: 'Tier 1: Cherry Gummy Fry' },
  { n: 'Candy Corn Fish',       s: 22,  icon: '🍊', title: 'Tier 2: Glazed Candy Swimmer' },
  { n: 'Sour Peach Ring',       s: 42,  icon: '🍑', title: 'Tier 3: Sugar-Dusted Jelly' },
  { n: 'Marshmallow Puffer',    s: 75,  icon: '🍫', title: 'Tier 4: Fluffy Corn-Spiker' },
  { n: 'Peppermint Barracuda',  s: 120, icon: '🍭', title: 'Tier 5: Hard-Candy Dasher' },
  { n: 'Gummy Worm Serpent',    s: 175, icon: '🐛', title: 'Tier 6: Two-Tone Ribbon' },
  { n: 'Two-Tone Haribo Shark', s: 240, icon: '🦈', title: 'Tier 7: Foam-Belly Apex' },
  { n: 'Sour Crystal Megalodon',s: 320, icon: '👑', title: 'Tier 8: Sour Sugar Colossus' },
];

export const DEPTH_ZONES = [
  {
    id: 'shallows',
    name: 'Sunlit Soda Shallows',
    yMin: 0,
    yMax: 3500,
    threat: 'CALM NURSERY (Tier 1)',
    threatColor: '#3dffa2',
    bgTop: 'hsl(190, 95%, 52%)',
    bgBot: 'hsl(198, 90%, 42%)',
    ambient: '#00b4d8',
    light: 0.95,
  },
  {
    id: 'shelf',
    name: 'Gummy Coral Shelf',
    yMin: 3500,
    yMax: 8500,
    threat: 'MODERATE REEF (Tier 2)',
    threatColor: '#ffd166',
    bgTop: 'hsl(204, 90%, 38%)',
    bgBot: 'hsl(220, 85%, 32%)',
    ambient: '#0077b6',
    light: 0.80,
  },
  {
    id: 'graveyard',
    name: 'Sunken Galleon Graveyard',
    yMin: 8500,
    yMax: 14500,
    threat: 'PIRATE TIMBER TRENCH (Tier 3)',
    threatColor: '#f77f00',
    bgTop: 'hsl(225, 80%, 28%)',
    bgBot: 'hsl(245, 82%, 24%)',
    ambient: '#1d3557',
    light: 0.65,
  },
  {
    id: 'trench',
    name: 'Twilight Peppermint Trench',
    yMin: 14500,
    yMax: 21000,
    threat: 'PREDATOR PATROL (Tier 4)',
    threatColor: '#ff70a6',
    bgTop: 'hsl(255, 85%, 22%)',
    bgBot: 'hsl(270, 88%, 18%)',
    ambient: '#3a0ca3',
    light: 0.50,
  },
  {
    id: 'caverns',
    name: 'Midnight Neon Caverns',
    yMin: 21000,
    yMax: 28000,
    threat: 'BIOLUMINESCENT DEPTHS (Tier 5)',
    threatColor: '#b5179e',
    bgTop: 'hsl(275, 90%, 16%)',
    bgBot: 'hsl(285, 95%, 12%)',
    ambient: '#240046',
    light: 0.38,
  },
  {
    id: 'geysers',
    name: 'Hadal Carbonation Vents',
    yMin: 28000,
    yMax: 35000,
    threat: 'THERMAL PRESSURE (Tier 6)',
    threatColor: '#e63946',
    bgTop: 'hsl(290, 95%, 11%)',
    bgBot: 'hsl(310, 95%, 9%)',
    ambient: '#10002b',
    light: 0.28,
  },
  {
    id: 'abyss',
    name: 'Abyssal Megalodon Mariana',
    yMin: 35000,
    yMax: 41000,
    threat: 'APEX PREDATOR TERRITORY (Tier 7)',
    threatColor: '#ff0054',
    bgTop: 'hsl(320, 100%, 8%)',
    bgBot: 'hsl(335, 100%, 5%)',
    ambient: '#0d0221',
    light: 0.18,
  },
  {
    id: 'core',
    name: 'Colossal Leviathan Core',
    yMin: 41000,
    yMax: 46000,
    threat: 'ANCIENT LEVIATHAN REALM (Tier 8)',
    threatColor: '#ffd60a',
    bgTop: 'hsl(340, 100%, 6%)',
    bgBot: 'hsl(0, 100%, 3%)',
    ambient: '#05010a',
    light: 0.12,
  },
];

const SPECIES = [
  // Shallows & Nursery (Phase 1: 0 - 3,500m)
  { id: 'swedish',          name: 'Swedish Gummy Fish',       minY: 70,    maxY: 4200,  baseSpd: [80, 130] },
  { id: 'candycorn',        name: 'Candy Corn Fish',          minY: 70,    maxY: 5500,  baseSpd: [75, 120] },
  { id: 'peachring',        name: 'Sour Peach Ring',          minY: 1200,  maxY: 7500,  baseSpd: [65, 105] },
  // Coral Shelf (Phase 2: 3,500 - 8,500m)
  { id: 'gummyworm',        name: 'Trolli Gummy Worm',        minY: 3000,  maxY: 10500, baseSpd: [75, 125] },
  { id: 'puffer',           name: 'Marshmallow Puffer',       minY: 3500,  maxY: 11000, baseSpd: [60, 95] },
  // Sunken Galleon Graveyard (Phase 3: 8,500 - 14,500m)
  { id: 'licoriceserpent',  name: 'Strawberry Licorice Eel',  minY: 7500,  maxY: 16500, baseSpd: [85, 140] },
  { id: 'peppermint',       name: 'Peppermint Barracuda',     minY: 8500,  maxY: 24000, baseSpd: [160, 260] },
  // Twilight Trench (Phase 4: 14,500 - 21,000m)
  { id: 'hariboshark',      name: 'Haribo Foam-Belly Shark',  minY: 13000, maxY: 26000, baseSpd: [120, 185] },
  // Midnight Neon Caverns (Phase 5: 21,000 - 28,000m)
  { id: 'jellydrop',        name: 'Bioluminescent Gumdrop',   minY: 18000, maxY: 36000, baseSpd: [45, 75] },
  { id: 'sourkraken',       name: 'Gumdrop Kraken Squid',     minY: 20000, maxY: 39000, baseSpd: [95, 160] },
  // Hadal Geysers & Thermal Vents (Phase 6: 28,000 - 35,000m)
  { id: 'rockcandymarlin',  name: 'Rock Candy Marlin',        minY: 26000, maxY: 39000, baseSpd: [180, 290] },
  { id: 'strawberryshark',  name: 'Jumbo Strawberry Shark',   minY: 27000, maxY: 43000, baseSpd: [130, 210] },
  // Abyssal Mariana & Leviathan Core (Phase 7-8: 35,000 - 45,000m)
  { id: 'sourmegalodon',    name: 'Sour Crystal Megalodon',   minY: 34000, maxY: 45000, baseSpd: [120, 190] },
];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const stageOf = (size) => {
  let i = 0;
  for (let k = 0; k < STAGES.length; k++) if (size >= STAGES[k].s) i = k;
  return i;
};

export class DeepFeeder extends Game {
  static meta = {
    id: 'deep-feeder',
    title: 'Jelly Reef',
    icon: '🍬',
    hint: 'DRAG to swim · eat Swedish fish & gummy sharks · depth determines danger & giants',
    baseLikes: 3420,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.player = {
      x: 0,
      y: 350,
      size: 16,
      vx: 0,
      vy: 0,
      dir: 1,
      dash: 0,
      stamina: 1.0,
      sugarRush: 0,
      bubbleT: 0,
    };
    if (saved && typeof saved.x === 'number') {
      Object.assign(this.player, { x: saved.x, y: saved.y, size: saved.size });
      this.grace = 1.8;
    } else {
      this.grace = 1.5;
    }

    this.fish = [];
    this.zoom = this.targetZoom();
    this.stage = stageOf(this.player.size);
    this.spawnT = 0;
    this.sfxT = 0;
    this.pSpeed = 220;
    this.currentZoneIndex = 0;
    this.zoneAlert = null;
    this.victoryTimer = 0;
    this.maxSizeCelebrated = false;

    // Ocean environment: Strawberry/Apple Licorice Laces & Rock Candy Corals
    this.licoriceLaces = this.buildLicoriceLaces();
    this.corals = this.buildCoralReefs();
    this.deepVents = this.buildHydrothermalVents();

    // 5 Sunken Sugar Galleons across the 40,000 x 45,000 world
    this.galleons = [
      { id: 'g1', x: 200,    y: 11000, w: 460, h: 240, name: 'The Sugar Skull' },
      { id: 'g2', x: -4500,  y: 16500, w: 480, h: 250, name: 'The Peppermint Brig' },
      { id: 'g3', x: 6200,   y: 24500, w: 520, h: 260, name: 'Queen Anne\'s Revenge' },
      { id: 'g4', x: -11000, y: 32000, w: 540, h: 280, name: 'The Abyssal Frigate' },
      { id: 'g5', x: 12500,  y: 41500, w: 600, h: 300, name: 'The Leviathan Flagship' },
    ];
    this.galleon = this.galleons[0];

    // 21 Chocolate Wafer Pirate Treasure Chests across all 8 zones
    this.chests = [
      // Shallows (0 - 3500m)
      { id: 'c1',  x: -800,   y: 800,   opened: false, name: 'Sunlit Shallows Wafer' },
      { id: 'c2',  x: 1200,   y: 2200,  opened: false, name: 'Soda Current Cache' },
      // Coral Shelf (3500 - 8500m)
      { id: 'c3',  x: -3500,  y: 4800,  opened: false, name: 'Peach Ring Reef Chest' },
      { id: 'c4',  x: 4200,   y: 6500,  opened: false, name: 'Coral Cavern Cache' },
      { id: 'c5',  x: -1200,  y: 7900,  opened: false, name: 'Puffer Hollow Vault' },
      // Galleon Graveyard (8500 - 14500m)
      { id: 'c6',  x: 340,    y: 11150, opened: false, name: 'Sugar Skull Deck Vault' },
      { id: 'c7',  x: -4350,  y: 13800, opened: false, name: 'Captain Licorice Cache' },
      { id: 'c8',  x: 5800,   y: 14200, opened: false, name: 'Smuggler\'s Doubloon Chest' },
      // Twilight Trench (14500 - 21000m)
      { id: 'c9',  x: -4300,  y: 16650, opened: false, name: 'Peppermint Brig Hold' },
      { id: 'c10', x: 2100,   y: 18500, opened: false, name: 'Shark Trench Strongbox' },
      { id: 'c11', x: -8400,  y: 20200, opened: false, name: 'Foam-Belly Locker' },
      // Midnight Caverns (21000 - 28000m)
      { id: 'c12', x: 6350,   y: 24650, opened: false, name: 'Queen Anne\'s Treasure' },
      { id: 'c13', x: -3200,  y: 26100, opened: false, name: 'Bioluminescent Cache' },
      { id: 'c14', x: 8900,   y: 27500, opened: false, name: 'Kraken\'s Lost Vault' },
      // Hadal Geysers (28000 - 35000m)
      { id: 'c15', x: -10850, y: 32150, opened: false, name: 'Abyssal Frigate Cargo' },
      { id: 'c16', x: 3400,   y: 33800, opened: false, name: 'Hydrothermal Hotbox' },
      { id: 'c17', x: -6200,  y: 34900, opened: false, name: 'Carbonation Pressure Chest' },
      // Megalodon Mariana (35000 - 41000m)
      { id: 'c18', x: 7500,   y: 37500, opened: false, name: 'Ancient Jaw Relic' },
      { id: 'c19', x: -2800,  y: 39800, opened: false, name: 'Megalodon Royal Vault' },
      // Leviathan Core (41000 - 45000m)
      { id: 'c20', x: 12650,  y: 41650, opened: false, name: 'Leviathan Crown Treasury' },
      { id: 'c21', x: 0,      y: 44200, opened: false, name: 'Mariana Core Sovereign Chest' },
    ];

    // Collectible Gold Foil Chocolate Doubloons
    this.coins = [];

    // Sparkling sugar crystals floating in the water
    this.sugarCrystals = Array.from({ length: 95 }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      s: rand(1.5, 3.8),
      d: rand(0.2, 1.0),
      sparkle: Math.random() > 0.6,
      color: ['#fff', '#ffe066', '#ff70a6', '#9bf6ff', '#3dffa2'][Math.floor(Math.random() * 5)],
    }));

    // Rising soda carbonation bubbles
    this.sodaBubbles = Array.from({ length: 55 }, () => ({
      x: rand(-1200, 1200),
      y: rand(100, MAXY),
      r: rand(3, 8),
      spd: rand(40, 90),
      wob: rand(0, TAU),
    }));

    // Pre-populate ocean with natural confectionery traffic based on depth
    for (let i = 0; i < 40; i++) this.spawnFish(true);
  }

  buildLicoriceLaces() {
    const laces = [];
    for (let i = -60; i <= 60; i++) {
      laces.push({
        x: i * 320 + rand(-80, 80),
        y: rand(1000, 42000),
        height: rand(280, 680),
        wobPhase: rand(0, TAU),
        color: Math.random() > 0.5 ? '#d90429' : '#2ec4b6',
      });
    }
    return laces;
  }

  buildCoralReefs() {
    const reefs = [];
    const colors = ['#f72585', '#4cc9f0', '#7209b7', '#ffbe0b', '#06d6a0'];
    for (let i = -50; i <= 50; i++) {
      reefs.push({
        x: i * 380 + rand(-90, 90),
        y: rand(800, 39000),
        type: Math.floor(Math.random() * 3),
        color: colors[Math.abs(i) % colors.length],
        scale: rand(0.85, 1.6),
      });
    }
    return reefs;
  }

  buildHydrothermalVents() {
    const vents = [];
    for (let i = -40; i <= 40; i++) {
      vents.push({
        x: i * 480 + rand(-80, 80),
        y: MAXY - rand(20, 200),
        w: rand(50, 95),
        h: rand(100, 190),
        glow: ['#ff0054', '#7000ff', '#00f5d4', '#ffd60a'][Math.floor(Math.random() * 4)],
      });
    }
    return vents;
  }

  serialize() {
    const p = this.player;
    return { x: p.x, y: p.y, size: p.size };
  }

  restoreLabel() {
    return `${STAGES[this.stage].n}, size ${Math.round(this.player.size)}`;
  }

  isMaxSize() {
    return this.player.size >= 320;
  }

  targetZoom() {
    return clamp(28 / (this.player.size * 0.65 + 18), 0.12, 0.84);
  }

  viewR() {
    return Math.hypot(this.W, this.H) / 2 / this.zoom;
  }

  getDepthZone(y) {
    for (let i = DEPTH_ZONES.length - 1; i >= 0; i--) {
      if (y >= DEPTH_ZONES[i].yMin) return { ...DEPTH_ZONES[i], index: i };
    }
    return { ...DEPTH_ZONES[0], index: 0 };
  }

  /* ------------------------------------------------ Depth-Driven Confectionery Spawner */
  spawnFish(initial = false) {
    const p = this.player;
    const halfW = (this.W / 2 + 120) / this.zoom;
    const halfH = (this.H / 2 + 100) / this.zoom;

    const fromLeft = Math.random() < 0.5;
    const dir = fromLeft ? 1 : -1;

    let x;
    if (initial) {
      x = clamp(p.x + rand(-halfW * 0.95, halfW * 0.95), -WORLD_W / 2 + 60, WORLD_W / 2 - 60);
    } else {
      x = fromLeft ? p.x - halfW - rand(30, 90) : p.x + halfW + rand(30, 90);
      x = clamp(x, -WORLD_W / 2 + 60, WORLD_W / 2 - 60);
    }

    const y = clamp(p.y + rand(-halfH * 0.95, halfH * 0.95), MINY + 20, MAXY - 20);

    // Candidates matching this depth band
    const candidates = SPECIES.filter((s) => y >= s.minY - 400 && y <= s.maxY + 400);
    const spec = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : SPECIES[0];

    // DIFFICULTY DETERMINED DIRECTLY BY 8 DEPTH PHASES
    let sizeMin, sizeMax, predatorChance;
    if (y < 3500) {
      // Phase 1: Sunlit Soda Shallows (0 - 3,500m)
      sizeMin = 9; sizeMax = 24; predatorChance = 0.12; // 88% safe prey!
    } else if (y < 8500) {
      // Phase 2: Gummy Coral Shelf (3,500 - 8,500m)
      sizeMin = 20; sizeMax = 55; predatorChance = 0.28;
    } else if (y < 14500) {
      // Phase 3: Sunken Galleon Graveyard (8,500 - 14,500m)
      sizeMin = 40; sizeMax = 95; predatorChance = 0.45;
    } else if (y < 21000) {
      // Phase 4: Twilight Peppermint Trench (14,500 - 21,000m)
      sizeMin = 65; sizeMax = 145; predatorChance = 0.60;
    } else if (y < 28000) {
      // Phase 5: Midnight Neon Caverns (21,000 - 28,000m)
      sizeMin = 90; sizeMax = 195; predatorChance = 0.70;
    } else if (y < 35000) {
      // Phase 6: Hadal Carbonation Vents (28,000 - 35,000m)
      sizeMin = 125; sizeMax = 260; predatorChance = 0.78;
    } else if (y < 41000) {
      // Phase 7: Abyssal Megalodon Mariana (35,000 - 41,000m)
      sizeMin = 160; sizeMax = 330; predatorChance = 0.85;
    } else {
      // Phase 8: Colossal Leviathan Core (41,000 - 45,000m)
      sizeMin = 210; sizeMax = 440; predatorChance = 0.92;
    }

    // Determine target size
    let finalSize;
    const isPredator = Math.random() < predatorChance;
    if (isPredator) {
      finalSize = Math.max(sizeMin, Math.min(sizeMax, p.size * rand(1.18, 1.85)));
      if (y >= 35000) finalSize = Math.max(finalSize, rand(160, 340));
    } else {
      finalSize = Math.max(8, Math.min(sizeMax * 0.75, p.size * rand(0.4, 0.88)));
    }

    const baseSpd = rand(spec.baseSpd[0], spec.baseSpd[1]);
    const gummyFlavors = ['#e63946', '#2ec4b6', '#ffd166', '#7209b7', '#f72585', '#ff70a6'];
    const flavor = gummyFlavors[Math.floor(Math.random() * gummyFlavors.length)];

    this.fish.push({
      species: spec.id,
      name: spec.name,
      flavor,
      x,
      y,
      baseY: y,
      size: finalSize,
      spd: baseSpd,
      vx: dir * baseSpd,
      vy: 0,
      dir,
      wob: rand(0, TAU),
      wobSpd: rand(1.8, 3.5),
      bobAmp: rand(8, 20),
      jit: rand(-15, 15),
      puffed: 0,
      snapT: 0,
      nearMissed: false,
      turnTimer: 0,
      isHunting: false,
      isFleeing: false,
    });
  }

  /* ------------------------------------------------ Update */
  update(dt) {
    const p = this.player;
    this.sfxT -= dt;

    // Apex victory countdown when max size reached
    if (this.isMaxSize()) {
      if (!this.maxSizeCelebrated) {
        this.maxSizeCelebrated = true;
        this.victoryTimer = 4.0;
        const kk = 1 / this.zoom;
        this.fx.ring(p.x, p.y, '#ffd166', 360 * kk, 1.2, 8);
        this.fx.burst(p.x, p.y, '#ffd166', 40, 320 * kk, 1.0, 6);
        this.fx.burst(p.x, p.y, '#3dffa2', 30, 260 * kk, 0.9, 5);
        this.fx.text(p.x, p.y - p.size - 40 * kk, '👑 SOUR CRYSTAL MEGALODON REACHED!', '#ffd166', 28, 2.5);
        this.fx.text(p.x, p.y - p.size - 14 * kk, 'INVULNERABLE APEX PREDATOR!', '#3dffa2', 22, 2.2);
        this.sounds.gate(true);
        this.sounds.up();
        this.haptics.heavy();
      }

      // Golden apex aura & particles
      const kk = 1 / this.zoom;
      if (Math.random() < 0.35) {
        this.fx.burst(
          p.x + (Math.random() - 0.5) * p.size * 1.4,
          p.y + (Math.random() - 0.5) * p.size * 0.8,
          ['#ffd166', '#ffbe0b', '#3dffa2', '#ffffff'][Math.floor(Math.random() * 4)],
          2,
          70 * kk,
          0.5,
          3.5
        );
      }

      if (this.victoryTimer > 0) {
        this.victoryTimer -= dt;
        if (this.victoryTimer <= 0) {
          this.won = true;
          this.winReason = 'Apex Ocean Megalodon Conquered! 🦈';
        }
      }
    }

    // Smooth FOV zoom
    this.zoom += (this.targetZoom() - this.zoom) * Math.min(1, dt * 2.5);

    // Stamina recharge
    p.stamina = Math.min(1.0, p.stamina + dt * 0.35);

    // Sugar Rush decay
    if (p.sugarRush > 0) {
      p.sugarRush = Math.max(0, p.sugarRush - dt);
    }

    // Input steering
    const v = this.input.vec(65);
    const isMoving = Math.hypot(v.x, v.y) > 0.08;

    const hasKey = this.input.keyVec() !== null;
    const wantsDash = isMoving && (
      hasKey ? this.input.key(' ', 'shift') : Math.hypot(v.x, v.y) > 0.88
    ) && p.stamina > 0.2;
    if (wantsDash) {
      p.dash = Math.min(0.4, p.dash + dt * 2.0);
      p.stamina = Math.max(0, p.stamina - dt * 0.7);
    } else {
      p.dash = Math.max(0, p.dash - dt * 3.0);
    }

    // Downward hydrodynamic plunge: diving down into the deep accelerates descent
    const diveMult = v.y > 0.2 ? 1.45 : 1.0;
    const dashMult = (1.0 + p.dash * 0.95) * (p.sugarRush > 0 ? 1.55 : 1.0) * diveMult;
    const speed = (this.pSpeed / this.zoom) * dashMult;

    // Smooth water drag / momentum
    const k = Math.min(1, dt * 7.5);
    p.vx += (v.x * speed - p.vx) * k;
    p.vy += (v.y * speed - p.vy) * k;
    p.x = clamp(p.x + p.vx * dt, -WORLD_W / 2 + 50, WORLD_W / 2 - 50);
    p.y = clamp(p.y + p.vy * dt, MINY, MAXY);

    if (Math.abs(p.vx) > 6) p.dir = p.vx > 0 ? 1 : -1;

    // Depth Zone Tracking & Transitions
    const zone = this.getDepthZone(p.y);
    if (zone.index !== this.currentZoneIndex) {
      this.currentZoneIndex = zone.index;
      this.zoneAlert = {
        name: zone.name,
        threat: zone.threat,
        color: zone.threatColor,
        timer: 3.2,
      };
      const kk = 1 / this.zoom;
      this.fx.ring(p.x, p.y, zone.threatColor, 150 * kk, 0.7, 5);
      this.sounds.bubble(0.9);
      this.haptics.medium();
    }
    if (this.zoneAlert) {
      this.zoneAlert.timer -= dt;
      if (this.zoneAlert.timer <= 0) this.zoneAlert = null;
    }

    // Rising soda carbonation bubbles
    for (const b of this.sodaBubbles) {
      b.y -= b.spd * dt;
      b.wob += dt * 3.2;
      b.x += Math.sin(b.wob) * 14 * dt;
      if (b.y < MINY) {
        b.y = MAXY + rand(10, 80);
        b.x = p.x + rand(-1000, 1000);
      }
    }

    // Bubble & candy sparkle trail
    p.bubbleT -= dt;
    if (p.bubbleT <= 0 && isMoving) {
      p.bubbleT = p.dash > 0.1 || p.sugarRush > 0 ? 0.03 : 0.12;
      const kk = 1 / this.zoom;
      const trailColor = p.sugarRush > 0 ? '#ffbe0b' : 'rgba(180, 240, 255, 0.75)';
      this.fx.burst(
        p.x - p.dir * p.size * 0.8,
        p.y + (Math.random() - 0.5) * p.size * 0.4,
        trailColor,
        p.sugarRush > 0 ? 4 : (p.dash > 0.1 ? 3 : 1),
        40 * kk,
        0.55,
        p.sugarRush > 0 ? 4 : 2.5
      );
    }

    /* ------------------------------------------------ Chocolate Wafer Chests */
    for (const c of this.chests) {
      if (c.opened) continue;
      const cd = Math.hypot(p.x - c.x, p.y - c.y);
      if (cd < p.size * 0.8 + 38) {
        this.openChest(c);
      }
    }

    /* ------------------------------------------------ Gold Foil Chocolate Coins */
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      coin.vx *= 0.94;
      coin.vy = coin.vy * 0.94 + 6 * dt;
      coin.x += coin.vx * dt;
      coin.y += coin.vy * dt;
      coin.t += dt * 4;

      const dx = p.x - coin.x;
      const dy = p.y - coin.y;
      const cd = Math.hypot(dx, dy);

      if (cd < p.size * 1.6 + 60) {
        const mag = (240 / (cd || 1)) * 40 * dt;
        coin.x += (dx / (cd || 1)) * mag;
        coin.y += (dy / (cd || 1)) * mag;
      }

      if (cd < p.size * 0.7 + 16) {
        this.coins.splice(i, 1);
        this.score += coin.val;
        const kk = 1 / this.zoom;
        this.fx.burst(coin.x, coin.y, '#ffd166', 6, 80 * kk, 0.4, 3);
        this.fx.text(coin.x, coin.y - 12 * kk, `+${coin.val}`, '#ffd166', 15);
        this.sounds.bubble(1.2 + Math.random() * 0.4);
        this.haptics.light();
      }
    }

    const halfW = (this.W / 2 + 160) / this.zoom;
    const halfH = (this.H / 2 + 140) / this.zoom;

    /* ------------------------------------------------ Enhanced Predator AI & Movement Loop */
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];

      // Cull fish only when safely far outside viewport
      if (Math.abs(f.x - p.x) > halfW * 1.6 || Math.abs(f.y - p.y) > halfH * 1.6) {
        this.fish.splice(i, 1);
        continue;
      }

      const dx = p.x - f.x;
      const dy = p.y - f.y;
      const d = Math.hypot(dx, dy);
      const ratio = f.size / p.size;
      const isDeadly = !this.isMaxSize() && ratio > 1.08 && p.sugarRush <= 0;
      const isEdible = this.isMaxSize() || ratio < 0.95 || p.sugarRush > 0;
      const isShark = f.species === 'hariboshark' || f.species === 'strawberryshark' || f.species === 'peppermint' || f.species === 'sourmegalodon';

      let lungeBoost = 1.0;

      if (isDeadly) {
        // Aggro detection range scales with predator size
        const aggroRadius = clamp(f.size * 3.0 + 130, 200, 520);

        if (d < aggroRadius) {
          // "Bigger fish a bit more aggressive, not too aggressive mind":
          // 1. Notice player and turn smoothly towards them
          const desiredDir = dx > 0 ? 1 : -1;
          if (f.dir !== desiredDir) {
            f.turnTimer = (f.turnTimer || 0) + dt * 3.2;
            if (f.turnTimer >= 0.7) {
              f.dir = desiredDir;
              f.turnTimer = 0;
            }
          } else {
            f.turnTimer = 0;
          }

          // 2. Vertical stalking: match player depth gently
          const targetVy = clamp(dy * 1.6, -105, 105);
          f.vy += (targetVy - f.vy) * Math.min(1, dt * 2.6);

          // 3. Controlled pursuit speed (+20% to +38% boost)
          const proximity = 1.0 - d / aggroRadius;
          lungeBoost = 1.15 + proximity * 0.25;
          f.isHunting = true;

          // 4. Jaws snap when close & facing player
          const inFront = (dx * f.dir > 0);
          if (inFront && d < (p.size + f.size) * 1.2) {
            f.snapT = Math.min(1.0, f.snapT + dt * 4.5);
          } else {
            f.snapT = Math.max(0, f.snapT - dt * 2.0);
          }

          // Close call adrenaline reward
          if (d < (p.size + f.size) * 0.92 && !f.nearMissed) {
            f.nearMissed = true;
            this.score += 75;
            const kk = 1 / this.zoom;
            this.fx.text(p.x, p.y - 28 * kk, '⚡ CLOSE CALL! +75', '#ffbe0b', 18, 1.2);
            this.fx.burst(p.x, p.y, '#ffd166', 8, 90 * kk, 0.4, 3);
            this.sounds.bubble(1.5);
            this.haptics.medium();
          }
        } else {
          f.isHunting = false;
          f.snapT = Math.max(0, f.snapT - dt * 2.0);
          f.vy *= 0.95;
        }
      } else if (isEdible) {
        f.isHunting = false;
        f.snapT = 0;
        // Prey or scared predator flees from player
        const fleeRadius = clamp(p.size * 2.4 + 75, 140, 320);
        if (d < fleeRadius) {
          f.isFleeing = true;
          f.dir = dx > 0 ? -1 : 1;
          lungeBoost = 1.35;
          const targetVy = -clamp(dy * 1.4, -90, 90);
          f.vy += (targetVy - f.vy) * Math.min(1, dt * 3.2);
        } else {
          f.isFleeing = false;
        }
      } else {
        f.isHunting = false;
        f.isFleeing = false;
        f.snapT = 0;
      }

      // Marshmallow Pufferfish expansion
      if (f.species === 'puffer') {
        const scared = d < (p.size + f.size) * 1.5;
        f.puffed += ((scared ? 1 : 0) - f.puffed) * Math.min(1, dt * 6);
      }

      f.wob += dt * f.wobSpd;
      f.vx = f.dir * f.spd * lungeBoost;
      const naturalBob = Math.sin(f.wob) * f.bobAmp;

      f.x += f.vx * dt;
      f.baseY = clamp(f.baseY + f.vy * dt, MINY + 15, MAXY - 15);
      f.y = clamp(f.baseY + naturalBob, MINY + 15, MAXY - 15);

      // Collision checks
      const reach = (p.size + f.size) * 0.56;
      if (d < reach) {
        if (this.isMaxSize() || p.sugarRush > 0) {
          this.eat(i, f, true);
        } else if (ratio < 0.95) {
          this.eat(i, f, false);
        } else if (isDeadly) {
          if (this.die(`Swallowed by ${f.name}`)) {
            const kk = 1 / this.zoom;
            this.fx.burst(p.x, p.y, '#ff4b5c', 28, 240 * kk, 0.85, 5);
            this.fx.shake(12, 0.45);
          }
        } else {
          const nx = dx / (d || 1);
          const ny = dy / (d || 1);
          const push = (reach - d) * 0.5;
          p.x += nx * push;
          p.y += ny * push;
          f.x -= nx * push;
          f.y -= ny * push;
        }
      }
    }

    this.fish = this.fish.filter(Boolean);

    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.fish.length < 32) {
      this.spawnT = 0.14;
      this.spawnFish(false);
    }

    // Floating sugar sparkles
    for (const q of this.sugarCrystals) {
      q.x -= p.vx * this.zoom * dt * q.d * 0.35;
      q.y -= p.vy * this.zoom * dt * q.d * 0.35 + 8 * dt;
      if (q.x < 0) q.x += this.W;
      if (q.x > this.W) q.x -= this.W;
      if (q.y < 0) q.y += this.H;
      if (q.y > this.H) q.y -= this.H;
    }

    this.fx.update(dt);
  }

  openChest(c) {
    c.opened = true;
    const kk = 1 / this.zoom;
    this.score += 350;
    this.player.sugarRush = 5.2; // 5.2s of Invulnerable Gummy Shark Hunter mode!
    this.player.size = Math.min(360, this.player.size + 14);

    this.fx.ring(c.x, c.y, '#ffd166', 180, 0.7, 5);
    this.fx.burst(c.x, c.y, '#ffe066', 22, 180 * kk, 0.8, 5);
    this.fx.burst(c.x, c.y, '#f72585', 18, 140 * kk, 0.6, 4);
    this.fx.text(c.x, c.y - 42 * kk, '🍫 CHOCOLATE CHEST OPENED! +350', '#ffd166', 22, 1.8);
    this.fx.text(c.x, c.y - 18 * kk, '⚡ SUGAR RUSH! SHARK HUNTER!', '#3dffa2', 20, 1.8);
    this.fx.shake(7, 0.25);
    this.sounds.gate(true);
    this.sounds.up();
    this.haptics.heavy();

    const st = stageOf(this.player.size);
    if (st > this.stage) {
      this.stage = st;
      this.fx.text(this.player.x, this.player.y - this.player.size - 36 * kk, `EVOLVED: ${STAGES[st].n.toUpperCase()}`, '#3dffa2', 26, 1.8);
      this.fx.ring(this.player.x, this.player.y, '#3dffa2', 180, 0.75, 5);
      this.sounds.up();
      this.haptics.medium();
    }

    // Spawn 10 gold foil chocolate doubloons
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * TAU + (Math.random() - 0.5) * 0.4;
      const spd = rand(70, 190);
      this.coins.push({
        x: c.x,
        y: c.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        t: rand(0, TAU),
        val: 25,
      });
    }
  }

  eat(i, f, wasSharkHunter = false) {
    const p = this.player;
    const kk = 1 / this.zoom;
    this.fish.splice(i, 1);

    const growthMult = wasSharkHunter ? 1.4 : 0.95;
    p.size = Math.min(360, Math.sqrt(p.size * p.size + f.size * f.size * growthMult + f.size * 1.2));

    const pts = wasSharkHunter ? Math.round(f.size * 10) : Math.max(1, Math.round(f.size * 3.5));
    this.score += pts;

    if (wasSharkHunter) {
      this.fx.burst(f.x, f.y, '#f72585', 18, 220 * kk, 0.7, 4.5);
      this.fx.text(f.x, f.y - 18 * kk, `🦈 GUMMY SHARK CRUNCHED! +${pts}`, '#3dffa2', 24, 1.4);
      this.sounds.chomp();
      this.sounds.hit();
      this.haptics.heavy();
    } else {
      this.fx.burst(f.x, f.y, f.flavor || '#9bf6ff', 10, 160 * kk, 0.55, 3.5);
      this.fx.text(f.x, f.y - 12 * kk, `+${pts}`, '#ffd166', 20);
      if (this.sfxT <= 0) {
        this.sounds.bubble(0.85 + Math.random() * 0.5);
        this.sfxT = 0.04;
      }
      this.haptics.light();
    }

    const st = stageOf(p.size);
    if (st > this.stage) {
      this.stage = st;
      this.fx.text(p.x, p.y - p.size - 36 * kk, `EVOLVED: ${STAGES[st].n.toUpperCase()}`, '#3dffa2', 26, 1.8);
      this.fx.ring(p.x, p.y, '#3dffa2', 180, 0.75, 5);
      this.sounds.up();
      this.haptics.medium();
    }
  }

  /* ------------------------------------------------ Render */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const p = this.player;
    const sc = this.zoom;
    const ox = W / 2;
    const oy = H / 2 + 15;
    const off = this.fx.offset();

    // 1. Dynamic Vibrant Depth-Based Soda Ocean Gradient
    const zone = this.getDepthZone(p.y);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, zone.bgTop);
    bg.addColorStop(1, zone.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 2. Surface Sunbeams (Shallow Waters: y < 1600)
    if (p.y < 1600) {
      const sunAlpha = (1 - p.y / 1600) * 0.28;
      ctx.fillStyle = `rgba(255, 255, 255, ${sunAlpha})`;
      for (let i = 0; i < 6; i++) {
        const sx = i * 105 - 40 + Math.sin(this.time * 0.45 + i * 1.5) * 18;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + 65, 0);
        ctx.lineTo(sx + 210, H);
        ctx.lineTo(sx + 35, H);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 3. Floating Sugar Crystals / Sparkling Plankton
    for (const q of this.sugarCrystals) {
      ctx.fillStyle = q.color;
      ctx.globalAlpha = 0.35 + q.d * 0.5;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.s, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 4. World Camera Transform
    ctx.save();
    ctx.translate(ox + off.x, oy + off.y);
    ctx.scale(sc, sc);
    ctx.translate(-p.x, -p.y);

    // Liquid Soda Surface Wave (Top of ocean)
    if (p.y < 1000) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 4 / sc;
      ctx.beginPath();
      const x0 = p.x - ox / sc - 40;
      ctx.moveTo(x0, 20);
      for (let x = x0; x < p.x + ox / sc + 40; x += 32 / sc) {
        ctx.lineTo(x, 20 + Math.sin(x * 0.04 + this.time * 2.2) * 6 / sc);
      }
      ctx.stroke();
    }

    // Rising Soda Fizz Carbonation Bubbles
    for (const b of this.sodaBubbles) {
      if (Math.abs(b.x - p.x) > ox / sc + 60 || Math.abs(b.y - p.y) > (H / 2) / sc + 60) continue;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5 / sc;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Background Rock Candy Corals & Licorice Laces
    this.drawCorals(ctx, p, ox / sc);
    this.drawLicoriceLaces(ctx, p, ox / sc, (H / 2) / sc);

    // Sunken Sugar Galleon (Chocolate Timber Pirate Shipwreck at y: 2000)
    this.drawSunkenGalleon(ctx, p, ox / sc, (H / 2) / sc);

    // Seabed at Mariana Trench with Hydrothermal Rock Candy Vents
    this.drawSeabed(ctx, p, ox / sc, (H / 2) / sc);

    // Chocolate Wafer Pirate Chests
    this.drawTreasureChests(ctx, p, ox / sc, (H / 2) / sc);

    // Collectible Gold Foil Chocolate Doubloons
    this.drawCoins(ctx);

    // Render Simplified Bold Cartoon Confectionery Fish
    const sorted = [...this.fish].sort((a, b) => a.size - b.size);
    for (const f of sorted) {
      if (
        Math.abs(f.x - p.x) > ox / sc + f.size * 2 ||
        Math.abs(f.y - p.y) > (H / 2) / sc + f.size * 2
      ) {
        continue;
      }
      const ratio = f.size / p.size;
      const isDeadly = ratio > 1.08 && p.sugarRush <= 0;
      this.drawConfectioneryFish(ctx, f, ratio, isDeadly);
    }

    // Scuba-Bean Player Mascot with Sugar Rush Rainbow Aura
    if (p.sugarRush > 0) {
      ctx.save();
      const pulse = 1.0 + Math.sin(this.time * 12) * 0.15;
      const sr = p.size * 1.85 * pulse;
      const sg = ctx.createRadialGradient(p.x, p.y, sr * 0.3, p.x, p.y, sr);
      sg.addColorStop(0, 'rgba(255, 214, 10, 0.75)');
      sg.addColorStop(0.5, 'rgba(247, 37, 133, 0.55)');
      sg.addColorStop(1, 'rgba(76, 201, 240, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sr, 0, TAU);
      ctx.fill();

      // Spinning sugar shield ring
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3.5 / sc;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, sr * 0.85, this.time * 4, this.time * 4 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    drawBean(ctx, p.x, p.y, p.size * 1.5, {
      hat: 'scuba',
      color: p.sugarRush > 0 ? '#ffbe0b' : '#25e6ff',
      bellyColor: '#ff758f',
      dir: p.dir,
      walkT: this.time * 2.5,
    });

    this.fx.render(ctx, sc);
    ctx.restore();

    // 5. Threat Radar
    this.drawThreatRadar(ctx, p, ox, oy, sc, W, H);

    // 6. HUD: Depth Meter, Threat Badge, Dash Stamina, Sugar Rush & Zone Banner Alert
    this.drawDeepHUD(ctx, W, H, p);
  }

  /* ------------------------------------------------ Scenery & Landmarks */
  drawCorals(ctx, p, halfW) {
    for (const c of this.corals) {
      if (Math.abs(c.x - p.x) > halfW + 120) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);

      if (c.type === 0) {
        // Rock Candy Crystal Cluster with Bold Cartoon Outlines
        ctx.fillStyle = c.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-14, -42);
        ctx.lineTo(-4, -58);
        ctx.lineTo(8, -48);
        ctx.lineTo(18, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-4, -58);
        ctx.lineTo(8, -48);
        ctx.closePath();
        ctx.fill();
      } else if (c.type === 1) {
        // Candy Cane Coral Branch
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(15, -30, -10, -65);
        ctx.stroke();

        ctx.strokeStyle = '#ff4b5c';
        ctx.lineWidth = 9;
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.stroke();
      } else {
        // Gumdrop Sea Anemone
        ctx.fillStyle = c.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 14, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = c.color;
        ctx.lineWidth = 4;
        for (let t = -3; t <= 3; t++) {
          const tx = t * 6;
          const sw = Math.sin(this.time * 2 + t) * 6;
          ctx.beginPath();
          ctx.moveTo(tx, -8);
          ctx.lineTo(tx + sw, -24);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  drawSunkenGalleon(ctx, p, halfW, halfH) {
    const list = this.galleons || (this.galleon ? [this.galleon] : []);
    for (const g of list) {
      if (Math.abs(g.x - p.x) > halfW + 320 || Math.abs(g.y - p.y) > halfH + 240) continue;

      ctx.save();
      ctx.translate(g.x, g.y);

      // Name plaque for the pirate wreck
      ctx.fillStyle = '#ffd166';
      ctx.font = '800 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🏴‍☠️ ${g.name.toUpperCase()}`, 0, -180);

      // Chocolate Timber Ship Hull with Bold Cartoon Outlines
      ctx.fillStyle = '#3c2415';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-180, -40);
      ctx.quadraticCurveTo(-140, 60, 0, 75);
      ctx.quadraticCurveTo(160, 75, 210, -20);
      ctx.lineTo(190, -40);
      ctx.lineTo(120, -35);
      ctx.lineTo(-180, -40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hull plank lines
      ctx.strokeStyle = 'rgba(20, 9, 36, 0.45)';
      ctx.lineWidth = 2.5;
      for (let y = -20; y < 60; y += 18) {
        ctx.beginPath();
        ctx.moveTo(-160, y);
        ctx.lineTo(180, y);
        ctx.stroke();
      }

      // Broken Wooden Main Mast
      ctx.fillStyle = '#2c190d';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.fillRect(-15, -160, 16, 125);
      ctx.strokeRect(-15, -160, 16, 125);

      // Tattered Mint Canvas Sail
      ctx.fillStyle = 'rgba(78, 205, 196, 0.5)';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, -150);
      ctx.quadraticCurveTo(50, -110, 60, -70);
      ctx.lineTo(-10, -70);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Jolly Roger Pirate Flag (Smiling Jellybean Skull!)
      ctx.fillStyle = '#000000';
      ctx.fillRect(-60, -155, 45, 28);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-38, -143, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(-40, -144, 1.5, 0, TAU); ctx.arc(-36, -144, 1.5, 0, TAU); ctx.fill();

      // Golden Candy Portholes
      for (let px = -110; px <= 130; px += 55) {
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(px, 15, 9, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.beginPath(); ctx.arc(px, 15, 5, 0, TAU); ctx.fill();
      }

      // Chocolate wafer cannon jutting out
      ctx.fillStyle = '#000000';
      ctx.fillRect(80, -10, 40, 12);

      ctx.restore();
    }
  }

  // Crushed Chocolate Cookie Seabed & Hydrothermal Bubble Vents
  drawSeabed(ctx, p, halfW, halfH) {
    if (p.y < MAXY - 1400) return;

    ctx.save();
    const seaY = MAXY - 20;

    // Dark Cookie Crumble Sand Base
    ctx.fillStyle = '#1a0e08';
    ctx.fillRect(p.x - halfW - 50, seaY, halfW * 2 + 100, 200);

    // Cookie crumb border
    ctx.fillStyle = '#3a2012';
    ctx.beginPath();
    ctx.moveTo(p.x - halfW - 50, seaY);
    for (let x = p.x - halfW - 50; x <= p.x + halfW + 50; x += 40) {
      const yBump = Math.sin(x * 0.05) * 8;
      ctx.lineTo(x, seaY + yBump);
    }
    ctx.lineTo(p.x + halfW + 50, seaY + 100);
    ctx.lineTo(p.x - halfW - 50, seaY + 100);
    ctx.closePath();
    ctx.fill();

    // Hydrothermal Rock Candy Vents
    for (const v of this.deepVents) {
      if (Math.abs(v.x - p.x) > halfW + 100) continue;
      ctx.fillStyle = '#2b1005';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(v.x - v.w * 0.5, v.y + v.h);
      ctx.lineTo(v.x - v.w * 0.3, v.y);
      ctx.lineTo(v.x + v.w * 0.3, v.y);
      ctx.lineTo(v.x + v.w * 0.5, v.y + v.h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing hydrothermal throat
      ctx.fillStyle = v.glow;
      ctx.beginPath();
      ctx.ellipse(v.x, v.y, v.w * 0.28, 8, 0, 0, TAU);
      ctx.fill();

      // Vent effervescent bubble stream
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      for (let i = 0; i < 4; i++) {
        const by = v.y - ((this.time * 65 + i * 25) % 120);
        const bx = v.x + Math.sin(this.time * 4 + i) * 8;
        ctx.beginPath();
        ctx.arc(bx, by, 3 + i, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawTreasureChests(ctx, p, halfW, halfH) {
    for (const c of this.chests) {
      if (Math.abs(c.x - p.x) > halfW + 100 || Math.abs(c.y - p.y) > halfH + 100) continue;
      ctx.save();
      ctx.translate(c.x, c.y);

      // Chocolate Wafer Chest Body
      ctx.fillStyle = '#4a2810';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.fillRect(-22, -10, 44, 26);
      ctx.strokeRect(-22, -10, 44, 26);

      // Gold foil bands
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-17, -10, 6, 26);
      ctx.fillRect(11, -10, 6, 26);

      // Foil-wrapped chocolate coin lock
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 3, 5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(0, 2, 2, 0, TAU); ctx.fill();

      // Wafer Lid
      if (c.opened) {
        ctx.fillStyle = '#ffbe0b';
        ctx.beginPath();
        ctx.arc(0, -12, 14, 0, Math.PI);
        ctx.fill();

        ctx.fillStyle = '#fff';
        const sparkle = Math.sin(this.time * 6) * 3;
        ctx.beginPath(); ctx.arc(0, -15, 4 + sparkle, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = '#5c3315';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, -10, 22, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffd166';
        const sp = Math.sin(this.time * 4) * 2;
        ctx.beginPath();
        ctx.arc(0, -18, 4 + sp, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  drawCoins(ctx) {
    for (const c of this.coins) {
      ctx.save();
      ctx.translate(c.x, c.y);
      const spin = Math.sin(c.t);
      ctx.scale(spin, 1);

      // Gold Foil Chocolate Coin
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#b7791f';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TAU);
      ctx.fill();

      ctx.restore();
    }
  }

  drawLicoriceLaces(ctx, p, halfW, halfH) {
    for (const k of this.licoriceLaces) {
      if (Math.abs(k.x - p.x) > halfW + 100) continue;
      const sway = Math.sin(this.time * 1.6 + k.wobPhase) * 28;

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(k.x, k.y);
      ctx.quadraticCurveTo(k.x + sway * 0.5, k.y - k.height * 0.5, k.x + sway, k.y - k.height);
      ctx.stroke();

      ctx.strokeStyle = k.color;
      ctx.lineWidth = 12;
      ctx.stroke();

      // Candy twists
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  /* ------------------------------------------------ CARTOON EYE HELPER */
  drawCartoonEye(ctx, ex, ey, er, lookX = 0.35, angry = false) {
    // White eyeball disc
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, TAU);
    ctx.fill();

    // Dark cartoon border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2.2, er * 0.32);
    ctx.stroke();

    // Glossy black pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(ex + lookX * er * 0.35, ey, er * 0.52, 0, TAU);
    ctx.fill();

    // White specular highlight dots
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + lookX * er * 0.35 - er * 0.16, ey - er * 0.18, er * 0.22, 0, TAU);
    ctx.arc(ex + lookX * er * 0.35 + er * 0.14, ey + er * 0.14, er * 0.11, 0, TAU);
    ctx.fill();

    // Determined/predator cartoon brow
    if (angry) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2.5, er * 0.35);
      ctx.beginPath();
      ctx.moveTo(ex - er * 1.0, ey - er * 0.7);
      ctx.lineTo(ex + er * 0.8, ey - er * 0.25);
      ctx.stroke();
    }
  }

  /* ------------------------------------------------ SIMPLIFIED CARTOON JELLY WORLD CREATURES */
  drawConfectioneryFish(ctx, f, ratio, isDeadly) {
    ctx.save();
    ctx.translate(f.x, f.y);

    const s = f.size;

    // Predator Aggro & Hunting indicator: menacing warning pulse
    if (f.isHunting) {
      const alertPulse = 1.0 + Math.sin(this.time * 12) * 0.16;
      ctx.fillStyle = 'rgba(255, 0, 84, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.35 * alertPulse, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#ff0054';
      ctx.font = `900 ${Math.max(13, Math.round(s * 0.32))}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('⚠️', 0, -s * 0.72);
    } else if (f.isFleeing) {
      // Scared panic sweat drop
      ctx.fillStyle = '#4cc9f0';
      ctx.beginPath();
      ctx.arc(0, -s * 0.65, Math.max(3, s * 0.12), 0, TAU);
      ctx.fill();
    }

    ctx.scale(f.dir, 1);
    ctx.rotate(Math.atan2(f.vy, Math.abs(f.vx) + 25) * 0.45);

    const swing = Math.sin(f.wob * 2.8) * s * 0.22;

    switch (f.species) {
      case 'swedish':
        this.renderSwedishFish(ctx, s, swing, f.flavor);
        break;
      case 'candycorn':
        this.renderCandyCornFish(ctx, s, swing);
        break;
      case 'peachring':
        this.renderSourPeachRing(ctx, s, swing);
        break;
      case 'gummyworm':
        this.renderGummyWorm(ctx, s, f.wob);
        break;
      case 'puffer':
        this.renderMarshmallowPuffer(ctx, s, swing, f.puffed, isDeadly);
        break;
      case 'jellydrop':
        this.renderBioluminescentGumdrop(ctx, s, f.wob);
        break;
      case 'peppermint':
        this.renderPeppermintBarracuda(ctx, s, swing, isDeadly);
        break;
      case 'licoriceserpent':
        this.renderLicoriceSerpent(ctx, s, f.wob);
        break;
      case 'rockcandymarlin':
        this.renderRockCandyMarlin(ctx, s, swing, isDeadly);
        break;
      case 'sourkraken':
        this.renderGumdropKraken(ctx, s, f.wob, isDeadly);
        break;
      case 'strawberryshark':
        this.renderHariboShark(ctx, s, swing, isDeadly, true);
        break;
      case 'sourmegalodon':
        this.renderSourMegalodon(ctx, s, swing, isDeadly);
        break;
      case 'hariboshark':
      default:
        this.renderHariboShark(ctx, s, swing, isDeadly, false);
        break;
    }

    // High-Gloss Gummy Specular Shine Crescent (Bloons TD 6 / Fall Guys Look!)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, -s * 0.24, s * 0.42, s * 0.1, 0, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  // 1. 🍬 Swedish Gummy Fish (Simplified, bold cartoon contour with dark outlines!)
  renderSwedishFish(ctx, s, swing, flavor = '#e63946') {
    const darkInk = '#000000';
    const lineW = Math.max(3.2, s * 0.09);

    // Chunky Cartoon Tail Fin
    ctx.fillStyle = flavor;
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, 0);
    ctx.lineTo(-s * 1.35, -s * 0.45 + swing);
    ctx.lineTo(-s * 1.15, swing * 0.5);
    ctx.lineTo(-s * 1.35, s * 0.45 + swing);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Chunky Cartoon Bean-Fish Body
    ctx.fillStyle = flavor;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.92, s * 0.48, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // 2 Bold, Simplified Cartoon Scale Arcs
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = Math.max(2.2, s * 0.06);
    [-0.15, 0.15].forEach((ox) => {
      ctx.beginPath();
      ctx.arc(ox * s, 0, s * 0.25, -0.6, 0.6);
      ctx.stroke();
    });

    // Pectoral Fin
    ctx.fillStyle = flavor;
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW * 0.8;
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, s * 0.22, s * 0.22, s * 0.12, 0.4, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Big Cartoon Googly Eye
    this.drawCartoonEye(ctx, s * 0.48, -s * 0.12, s * 0.14, 0.4);
  }

  // 2. 🍊 Candy Corn Fish (3 Clean cartoon color blocks with bold dark outline!)
  renderCandyCornFish(ctx, s, swing) {
    const darkInk = '#000000';
    const lineW = Math.max(3.2, s * 0.09);

    // Chunky Yellow Tail
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, 0);
    ctx.lineTo(-s * 1.3, -s * 0.45 + swing);
    ctx.lineTo(-s * 1.3, s * 0.45 + swing);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 1. Yellow Base Tier
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.ellipse(-s * 0.25, 0, s * 0.45, s * 0.5, 0, 0, TAU);
    ctx.fill();

    // 2. Orange Mid Tier
    ctx.fillStyle = '#f77f00';
    ctx.beginPath();
    ctx.ellipse(s * 0.1, 0, s * 0.4, s * 0.46, 0, 0, TAU);
    ctx.fill();

    // 3. Marshmallow White Tip
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(s * 0.45, 0, s * 0.28, s * 0.35, 0, 0, TAU);
    ctx.fill();

    // Bold Outer Contour Stroke
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.85, s * 0.48, 0, 0, TAU);
    ctx.stroke();

    // Clean Cartoon Separation Ribs
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.45);
    ctx.lineTo(-s * 0.1, s * 0.45);
    ctx.moveTo(s * 0.28, -s * 0.38);
    ctx.lineTo(s * 0.28, s * 0.38);
    ctx.stroke();

    // Big Cartoon Googly Eye
    this.drawCartoonEye(ctx, s * 0.48, -s * 0.12, s * 0.13, 0.4);
  }

  // 3. 🍑 Sour Peach Ring Jelly (Bold cartoon donut ring with dark outline!)
  renderSourPeachRing(ctx, s, swing) {
    const darkInk = '#000000';
    const lineW = Math.max(3.2, s * 0.09);

    // Two-tone peach gel ring
    const g = ctx.createLinearGradient(-s * 0.7, 0, s * 0.7, 0);
    g.addColorStop(0, '#ffd166'); // lemon
    g.addColorStop(1, '#ff70a6'); // peach pink
    ctx.fillStyle = g;
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.65, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Donut hole with dark outline
    ctx.fillStyle = '#0a3a60';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Sour sugar crystal dots
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const r = s * 0.48;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, s * 0.045, 0, TAU);
      ctx.fill();
    }

    // Trailing Cartoon Strawberry Laces
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    for (let t = -1; t <= 1; t++) {
      const ty = t * (s * 0.18);
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, ty);
      ctx.quadraticCurveTo(-s * 1.0, ty + swing, -s * 1.35, ty - swing);
      ctx.stroke();
    }

    // Happy Cartoon Googly Eyes on Top Arch
    this.drawCartoonEye(ctx, s * 0.15, -s * 0.38, s * 0.12, 0.3);
  }

  // 4. 🍫 Marshmallow Puffer (Bold squishy marshmallow with chunky candy corn spikes!)
  renderMarshmallowPuffer(ctx, s, swing, puffed, isDeadly) {
    const darkInk = '#000000';
    const lineW = Math.max(3.2, s * 0.09);
    const puffScale = 1.0 + puffed * 0.45;
    const pr = s * 0.62 * puffScale;

    // Chunky Cartoon Candy-Corn Spikes when puffed!
    if (puffed > 0.05) {
      const numSpikes = 10;
      for (let i = 0; i < numSpikes; i++) {
        const a = (i / numSpikes) * TAU;
        const spLen = pr + puffed * s * 0.36;
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = darkInk;
        ctx.lineWidth = lineW * 0.7;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.2) * pr, Math.sin(a - 0.2) * pr);
        ctx.lineTo(Math.cos(a) * spLen, Math.sin(a) * spLen);
        ctx.lineTo(Math.cos(a + 0.2) * pr, Math.sin(a + 0.2) * pr);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Squishy Marshmallow Body
    ctx.fillStyle = '#fefae0';
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.arc(0, 0, pr, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Cute Little Fin
    ctx.fillStyle = '#dda15e';
    ctx.beginPath();
    ctx.ellipse(-pr * 0.75, swing * 0.4, pr * 0.3, pr * 0.18, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Expressive Cartoon Eyes (Panicked if puffed!)
    const er = pr * 0.32;
    this.drawCartoonEye(ctx, pr * 0.35, -pr * 0.2, er, 0.3, isDeadly);
  }

  // 5. 🐛 Trolli Gummy Worm (Segmented cartoon worm with thick dark outlines!)
  renderGummyWorm(ctx, s, wob) {
    const darkInk = '#000000';
    const lineW = Math.max(3.0, s * 0.08);
    const segments = 5;

    for (let i = segments; i >= 0; i--) {
      const segX = -i * (s * 0.28);
      const segY = Math.sin(wob * 2.8 + i * 0.6) * (s * 0.25);
      const segR = s * (0.36 - i * 0.02);

      // Alternating Neon Cyan and Electric Pink
      ctx.fillStyle = i % 2 === 0 ? '#00f5d4' : '#f72585';
      ctx.strokeStyle = darkInk;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.arc(segX, segY, segR, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Cute Cartoon Face on Head Segment
    this.drawCartoonEye(ctx, s * 0.14, -s * 0.08, s * 0.12, 0.4);
  }

  // 6. 🍭 Peppermint Razor Barracuda (Sleek cartoon torpedo with bold red spirals!)
  renderPeppermintBarracuda(ctx, s, swing, isDeadly) {
    const darkInk = '#000000';
    const lineW = Math.max(3.5, s * 0.09);
    const L = s * 1.5;
    const Hh = s * 0.4;

    // Peppermint Fan Tail
    ctx.fillStyle = '#d90429';
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(-L * 0.7, 0);
    ctx.lineTo(-L * 1.35, -Hh * 1.1 + swing);
    ctx.lineTo(-L * 1.35, Hh * 1.1 + swing);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Torpedo Body Base
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.fill();

    // Bold Diagonal Candy-Cane Red Spirals
    ctx.strokeStyle = '#d90429';
    ctx.lineWidth = Math.max(4, s * 0.11);
    [-0.5, -0.22, 0.06, 0.32].forEach((sx) => {
      ctx.beginPath();
      ctx.moveTo(sx * L - Hh, -Hh * 0.85);
      ctx.lineTo(sx * L + Hh, Hh * 0.85);
      ctx.stroke();
    });

    // Dark Cartoon Outer Stroke
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.stroke();

    // Hard Candy Crystal Teeth
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      const tx = L * (0.68 + i * 0.09);
      ctx.beginPath();
      ctx.moveTo(tx, Hh * 0.15);
      ctx.lineTo(tx + L * 0.04, -Hh * 0.08);
      ctx.lineTo(tx + L * 0.08, Hh * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Sharp Predator Cartoon Eye with Determined Brow
    this.drawCartoonEye(ctx, L * 0.68, -Hh * 0.22, Hh * 0.38, 0.45, isDeadly);
  }

  // 7. 🦈 Haribo Two-Tone Shark (Sapphire Blue or Cherry Top + Marshmallow Foam White Belly!)
  renderHariboShark(ctx, s, swing, isDeadly, isStrawberry = false) {
    const darkInk = '#000000';
    const lineW = Math.max(3.8, s * 0.09);
    const L = s * 1.45;
    const Hh = s * 0.52;
    const gelColor = isStrawberry ? '#e63946' : '#0077b6';

    // Tail Fin
    ctx.fillStyle = gelColor;
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(-L * 0.7, 0);
    ctx.lineTo(-L * 1.35, -Hh * 1.25 + swing);
    ctx.lineTo(-L * 1.05, swing * 0.4);
    ctx.lineTo(-L * 1.35, Hh * 1.25 + swing);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Iconic Molded Dorsal Fin
    ctx.fillStyle = gelColor;
    ctx.beginPath();
    ctx.moveTo(-L * 0.08, -Hh * 0.85);
    ctx.lineTo(-L * 0.42, -Hh * 1.95);
    ctx.lineTo(-L * 0.52, -Hh * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 1. Top Half: Gummy Gel
    ctx.fillStyle = gelColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, Math.PI, 0);
    ctx.fill();

    // 2. Bottom Half: Soft Opaque Marshmallow Foam Belly!
    ctx.fillStyle = '#fefae0';
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, Math.PI);
    ctx.fill();

    // Dark Cartoon Outer Stroke
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.stroke();

    // Seam dividing gel top and foam belly
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = Math.max(2.2, lineW * 0.65);
    ctx.beginPath();
    ctx.moveTo(-L * 0.95, 0);
    ctx.lineTo(L * 0.95, 0);
    ctx.stroke();

    // Pectoral Fin with White Foam Trim
    ctx.fillStyle = gelColor;
    ctx.beginPath();
    ctx.ellipse(-L * 0.1, Hh * 0.55, L * 0.28, Hh * 0.35, 0.4, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Cartoon Chomp Mouth with Rounded White Marshmallow Teeth
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = 1.8;
    for (let t = 0; t < 3; t++) {
      const tx = L * (0.66 + t * 0.08);
      ctx.beginPath();
      ctx.arc(tx, Hh * 0.22, s * 0.055, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Expressive Cartoon Shark Eye
    this.drawCartoonEye(ctx, L * 0.65, -Hh * 0.28, Hh * 0.34, 0.4, isDeadly);
  }

  // 8. 🍓 Bioluminescent Gumdrop Jelly (Glowing cartoon bell with bold dark outline!)
  renderBioluminescentGumdrop(ctx, s, wob) {
    const darkInk = '#000000';
    const lineW = Math.max(3.0, s * 0.08);
    const pulse = 1.0 + Math.sin(wob * 2.5) * 0.14;
    const r = s * 0.72 * pulse;

    // Glowing Gumdrop Dome
    const g = ctx.createLinearGradient(0, -r, 0, 0);
    g.addColorStop(0, '#f72585');
    g.addColorStop(1, '#7209b7');
    ctx.fillStyle = g;
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Trailing Cartoon Strawberry Laces
    ctx.strokeStyle = '#f72585';
    ctx.lineWidth = Math.max(2.5, s * 0.07);
    ctx.lineCap = 'round';
    for (let t = -2; t <= 2; t++) {
      const tx = t * (s * 0.22);
      const sw = Math.sin(wob * 2.5 + t) * s * 0.25;
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.quadraticCurveTo(tx + sw, s * 0.6, tx - sw, s * 1.25);
      ctx.stroke();
    }

    // Cute Googly Eyes
    this.drawCartoonEye(ctx, s * 0.18, -r * 0.35, r * 0.22, 0.3);
  }

  // 9. 🗡️ Rock Candy Marlin (Sleek cartoon marlin with peppermint spear bill!)
  renderRockCandyMarlin(ctx, s, swing, isDeadly) {
    const darkInk = '#000000';
    const lineW = Math.max(3.5, s * 0.09);
    const L = s * 1.45;
    const Hh = s * 0.46;

    // Rock Candy Sail Fin
    ctx.fillStyle = '#4cc9f0';
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(-L * 0.3, -Hh * 0.85);
    ctx.lineTo(-L * 0.05, -Hh * 2.2);
    ctx.lineTo(L * 0.3, -Hh * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Blue Gel Body
    ctx.fillStyle = '#0077b6';
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Peppermint Stick Spear Bill!
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = Math.max(4.5, s * 0.12);
    ctx.beginPath();
    ctx.moveTo(L * 0.85, 0);
    ctx.lineTo(L * 1.9, 0);
    ctx.stroke();

    ctx.strokeStyle = '#d90429';
    ctx.lineWidth = Math.max(3, s * 0.08);
    ctx.stroke();

    // Big Cartoon Eye
    this.drawCartoonEye(ctx, L * 0.65, -Hh * 0.2, Hh * 0.35, 0.45, isDeadly);
  }

  // 10. 🐙 Gumdrop Kraken Squid (Bulbous cartoon head with curly tentacles!)
  renderGumdropKraken(ctx, s, wob, isDeadly) {
    const darkInk = '#000000';
    const lineW = Math.max(3.5, s * 0.09);

    // Purple Gumdrop Head
    ctx.fillStyle = '#7209b7';
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, 0, s * 0.85, s * 0.46, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // 6 Curly Gummy Worm Tentacles
    ctx.strokeStyle = '#f72585';
    ctx.lineWidth = Math.max(3.5, s * 0.08);
    for (let i = -2; i <= 2; i++) {
      const ty = i * (s * 0.14);
      const wave = Math.sin(wob * 3 + i) * s * 0.25;
      ctx.beginPath();
      ctx.moveTo(s * 0.5, ty);
      ctx.quadraticCurveTo(s * 1.1, ty + wave, s * 1.6, ty - wave);
      ctx.stroke();
    }

    // Giant Googly Eyes
    this.drawCartoonEye(ctx, s * 0.22, -s * 0.16, s * 0.22, 0.4, isDeadly);
  }

  // 11. 🍓 Strawberry Licorice Eel (Undulating red rope with bold dark cartoon borders!)
  renderLicoriceSerpent(ctx, s, wob) {
    const darkInk = '#000000';
    const lineW = Math.max(4.5, s * 0.14);

    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW + 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = -s * 1.35; x <= s * 0.85; x += s * 0.2) {
      const y = Math.sin(wob * 3 + x * 0.08) * s * 0.32;
      if (x === -s * 1.35) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#d90429';
    ctx.lineWidth = lineW;
    ctx.stroke();

    // Gloss Stripe
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.stroke();

    // Cartoon Eye
    this.drawCartoonEye(ctx, s * 0.72, -s * 0.08, s * 0.12, 0.4);
  }

  // 12. 👑 Sour Crystal Megalodon (Colossal cartoon titan with thick bold outlines!)
  renderSourMegalodon(ctx, s, swing, isDeadly) {
    const darkInk = '#000000';
    const lineW = Math.max(5.5, s * 0.11);
    const L = s * 1.65;
    const Hh = s * 0.62;

    // Colossal Gummy Tail
    ctx.fillStyle = '#4361ee';
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(-L * 0.7, 0);
    ctx.lineTo(-L * 1.35, -Hh * 1.3 + swing);
    ctx.lineTo(-L * 1.05, swing * 0.4);
    ctx.lineTo(-L * 1.35, Hh * 1.3 + swing);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // High Gummy Dorsal Fin
    ctx.beginPath();
    ctx.moveTo(-L * 0.1, -Hh * 0.85);
    ctx.lineTo(-L * 0.45, -Hh * 2.05);
    ctx.lineTo(-L * 0.55, -Hh * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Two-Tone Sour Blue Raspberry & Lemon Body
    const bg = ctx.createLinearGradient(0, -Hh, 0, Hh);
    bg.addColorStop(0, '#4361ee');
    bg.addColorStop(0.65, '#7209b7');
    bg.addColorStop(1, '#ffbe0b');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Sparkling Sour-Sugar Crystal Studs
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 16; i++) {
      const sx = ((i % 4) - 1.5) * (L * 0.38);
      const sy = (Math.floor(i / 4) - 1.5) * (Hh * 0.35);
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(2, s * 0.035), 0, TAU);
      ctx.fill();
    }

    // Marshmallow-White Razor Teeth
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = 2.2;
    for (let t = 0; t < 5; t++) {
      const tx = L * (0.64 + t * 0.07);
      ctx.beginPath();
      ctx.moveTo(tx, Hh * 0.2);
      ctx.lineTo(tx + L * 0.04, Hh * 0.54);
      ctx.lineTo(tx + L * 0.08, Hh * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Giant Fierce Cartoon Predator Eye
    this.drawCartoonEye(ctx, L * 0.68, -Hh * 0.25, Hh * 0.38, 0.45, true);
  }

  /* ------------------------------------------------ Threat Radar (Lane Approaching Only) */
  drawThreatRadar(ctx, p, ox, oy, sc, W, H) {
    if (p.sugarRush > 0) return;

    const vr = this.viewR();
    const margin = 26;

    for (const f of this.fish) {
      const ratio = f.size / p.size;
      if (ratio <= 1.08) continue;

      const laneOverlap = Math.abs(f.y - p.y) < f.size + p.size + 40;
      if (!laneOverlap) continue;

      const movingTowards = (p.x - f.x) * f.dir > 0;
      if (!movingTowards) continue;

      const dx = f.x - p.x;
      const dy = f.y - p.y;
      const d = Math.hypot(dx, dy);

      if (d < vr * 0.45 || d > vr * 1.55) continue;

      const screenX = ox + dx * sc;
      const screenY = oy + dy * sc;

      const isOffscreen = screenX < margin || screenX > W - margin || screenY < margin || screenY > H - margin;
      if (!isOffscreen) continue;

      const ang = Math.atan2(dy, dx);
      const edgeX = clamp(ox + Math.cos(ang) * (W / 2 - margin), margin, W - margin);
      const edgeY = clamp(oy + Math.sin(ang) * (H / 2 - margin), margin + 40, H - margin - 60);

      const proximity = 1.0 - clamp((d - vr * 0.45) / (vr * 1.1), 0, 1);
      const pulse = 1.0 + Math.sin(this.time * (6 + proximity * 10)) * 0.25;

      ctx.save();
      ctx.translate(edgeX, edgeY);

      ctx.fillStyle = `rgba(255, 75, 92, ${0.35 + proximity * 0.45})`;
      ctx.beginPath();
      ctx.arc(0, 0, 18 * pulse, 0, TAU);
      ctx.fill();

      ctx.rotate(ang);
      ctx.fillStyle = '#ff4b5c';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      ctx.fillStyle = '#fff';
      ctx.font = '800 11px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      const distM = Math.max(1, Math.round(d / 18));
      ctx.fillText(`${distM}m`, edgeX, edgeY + 22);
    }
  }

  /* ------------------------------------------------ HUD */
  drawDeepHUD(ctx, W, H, p) {
    const curStage = STAGES[this.stage];
    const depthM = Math.max(0, Math.round(p.y / 10));
    const zone = this.getDepthZone(p.y);

    // 0. Sonar Scanner & 45km Depth Gauge Widget
    const radarW = 136;
    const radarH = 76;
    const rx = 14;
    const ry = H - 232;

    ctx.fillStyle = 'rgba(20, 9, 36, 0.88)';
    ctx.strokeStyle = '#25e6ff';
    ctx.lineWidth = 2.2;
    this.rr(rx, ry, radarW, radarH, 12);
    ctx.fill();
    ctx.stroke();

    // Radar Header
    ctx.fillStyle = '#25e6ff';
    ctx.font = '800 9px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📡 SONAR · 45km OCEAN', rx + 10, ry + 14);

    // 8-Phase Vertical Depth Gauge Column
    const barX = rx + 12;
    const barY = ry + 22;
    const barHeight = 44;
    const barWidth = 7;

    for (let k = 0; k < DEPTH_ZONES.length; k++) {
      const z = DEPTH_ZONES[k];
      const segY0 = (z.yMin / MAXY) * barHeight;
      const segY1 = (z.yMax / MAXY) * barHeight;
      ctx.fillStyle = z.threatColor;
      ctx.fillRect(barX, barY + segY0, barWidth, Math.max(2, segY1 - segY0));
    }

    // Player depth marker on the gauge
    const playerYNorm = clamp(p.y / MAXY, 0, 1);
    const pMarkerY = barY + playerYNorm * barHeight;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(barX + barWidth / 2, pMarkerY, 4, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Circular Local Radar Sweep
    const cx = rx + 82;
    const cy = ry + 44;
    const cr = 24;

    ctx.fillStyle = 'rgba(0, 30, 45, 0.8)';
    ctx.strokeStyle = 'rgba(37, 230, 255, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Sweep line
    const sweepAng = (this.time * 2.8) % TAU;
    ctx.strokeStyle = 'rgba(37, 230, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAng) * cr, cy + Math.sin(sweepAng) * cr);
    ctx.stroke();

    // Player green dot
    ctx.fillStyle = '#3dffa2';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, TAU);
    ctx.fill();

    // Blips for nearby predatory sharks & chests
    const radarScale = cr / 1800;
    for (const f of this.fish) {
      if (f.size / p.size <= 1.08) continue;
      const fdx = (f.x - p.x) * radarScale;
      const fdy = (f.y - p.y) * radarScale;
      if (Math.hypot(fdx, fdy) < cr - 2) {
        ctx.fillStyle = f.isHunting ? '#ff0054' : '#ff70a6';
        ctx.beginPath();
        ctx.arc(cx + fdx, cy + fdy, f.isHunting ? 3 : 2, 0, TAU);
        ctx.fill();
      }
    }
    for (const c of this.chests) {
      if (c.opened) continue;
      const cdx = (c.x - p.x) * radarScale;
      const cdy = (c.y - p.y) * radarScale;
      if (Math.hypot(cdx, cdy) < cr - 2) {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(cx + cdx, cy + cdy, 2.2, 0, TAU);
        ctx.fill();
      }
    }

    // Apex Megalodon Victory & Invulnerability Banner
    if (this.isMaxSize()) {
      const vSec = Math.max(0, Math.ceil(this.victoryTimer));
      const badgeW = 280;
      const badgeH = 46;
      const bx = W / 2 - badgeW / 2;
      const by = 18;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 214, 10, 0.95)';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      this.rr(bx, by, badgeW, badgeH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = '900 13px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 APEX MEGALODON (INVULNERABLE)', W / 2, by + 19);

      ctx.font = '800 11px Outfit, system-ui, sans-serif';
      ctx.fillStyle = '#10002b';
      ctx.fillText(vSec > 0 ? `OCEAN DOMINATED · VICTORY IN ${vSec}s` : 'OCEAN DOMINATED · VICTORY!', W / 2, by + 36);
      ctx.restore();
    }

    // 1. Stage & Depth Information Pill (positioned safely above bottom reel controls)
    const pillY = H - 148;
    ctx.fillStyle = 'rgba(20, 9, 36, 0.82)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    this.rr(14, pillY, 242, 54, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.isMaxSize() ? '#ffd166' : '#3dffa2';
    ctx.font = '800 13px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(this.isMaxSize() ? '👑 APEX MEGALODON (MAX)' : `${curStage.icon} ${curStage.n.toUpperCase()}`, 26, pillY + 20);

    // Depth & Threat Level Badge
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px Outfit, system-ui, sans-serif';
    ctx.fillText(`${depthM}m · ${zone.name}`, 26, pillY + 36);

    ctx.fillStyle = zone.threatColor;
    ctx.font = '800 10px Outfit, system-ui, sans-serif';
    ctx.fillText(`● ${zone.threat}`, 26, pillY + 48);

    // 2. Dash Stamina or Sugar Rush Bar
    const barW = 120;
    const barH = 14;
    const bx = W - barW - 16;
    const by = H - 122;

    ctx.fillStyle = 'rgba(20, 9, 36, 0.82)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    this.rr(bx - 8, by - 16, barW + 16, 42, 10);
    ctx.fill();
    ctx.stroke();

    if (p.sugarRush > 0) {
      ctx.fillStyle = '#ffbe0b';
      ctx.font = '800 10px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⚡ SUGAR RUSH! ${p.sugarRush.toFixed(1)}s`, bx, by - 4);

      const rushFill = (p.sugarRush / 5.2) * barW;
      const rsg = ctx.createLinearGradient(bx, 0, bx + rushFill, 0);
      rsg.addColorStop(0, '#f72585');
      rsg.addColorStop(0.5, '#ffd166');
      rsg.addColorStop(1, '#4cc9f0');
      ctx.fillStyle = rsg;
      this.rr(bx, by, rushFill, barH, 7);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '800 10px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⚡ BUBBLE DASH', bx, by - 4);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      this.rr(bx, by, barW, barH, 7);
      ctx.fill();

      const fillW = Math.max(10, barW * p.stamina);
      const sg = ctx.createLinearGradient(bx, 0, bx + fillW, 0);
      sg.addColorStop(0, '#4cc9f0');
      sg.addColorStop(1, '#7209b7');
      ctx.fillStyle = sg;
      this.rr(bx, by, fillW, barH, 7);
      ctx.fill();
    }

    // 3. Depth Zone Transition Alert Banner
    if (this.zoneAlert && this.zoneAlert.timer > 0) {
      ctx.save();
      const alpha = clamp(this.zoneAlert.timer / 0.8, 0, 1) * clamp((3.2 - this.zoneAlert.timer) / 0.5, 0, 1);
      ctx.globalAlpha = alpha;

      const bw = 320;
      const bh = 54;
      const bbx = W / 2 - bw / 2;
      const bby = 68;

      ctx.fillStyle = 'rgba(20, 9, 36, 0.88)';
      ctx.strokeStyle = this.zoneAlert.color;
      ctx.lineWidth = 3;
      this.rr(bbx, bby, bw, bh, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.zoneAlert.color;
      ctx.font = '900 11px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`ENTERING ZONE · ${this.zoneAlert.threat}`, W / 2, bby + 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 14px Outfit, system-ui, sans-serif';
      ctx.fillText(this.zoneAlert.name.toUpperCase(), W / 2, bby + 39);

      ctx.restore();
    }
  }

  rr(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  serialize() {
    return {
      x: this.player.x,
      y: this.player.y,
      size: this.player.size,
      stageIndex: this.stage.index,
    };
  }

  restoreLabel() {
    const zone = this.getDepthZone(this.player.y);
    return `${this.stage.icon} ${this.stage.name} · ${Math.round(this.player.y)}m (${zone.name})`;
  }
}
