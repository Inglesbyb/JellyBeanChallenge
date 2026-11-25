import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { shadeColor } from '../engine/toyStyle.js';
import {
  STYLE_TOKENS,
  preloadWeeblAtlas,
  drawSprite,
  drawWoodTrussTile,
  drawSunburst,
  drawComicPanel,
  drawComicStarburst,
  drawComicText,
  drawWeeblScubaBean,
  drawWeeblEyeCluster,
  drawHeroCharacter,
} from './weeblAtlas.js';

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
    threatColor: '#4ade80',
    bgTop: '#22d3ee',
    bgBot: '#0284c7',
    ambient: '#38bdf8',
    light: 0.95,
  },
  {
    id: 'shelf',
    name: 'Gummy Coral Shelf',
    yMin: 3500,
    yMax: 8500,
    threat: 'MODERATE REEF (Tier 2)',
    threatColor: '#facc15',
    bgTop: '#0ea5e9',
    bgBot: '#0369a1',
    ambient: '#0284c7',
    light: 0.80,
  },
  {
    id: 'graveyard',
    name: 'Sunken Galleon Graveyard',
    yMin: 8500,
    yMax: 14500,
    threat: 'PIRATE TIMBER TRENCH (Tier 3)',
    threatColor: '#fb923c',
    bgTop: '#1d4ed8',
    bgBot: '#1e3a8a',
    ambient: '#1e40af',
    light: 0.65,
  },
  {
    id: 'trench',
    name: 'Twilight Peppermint Trench',
    yMin: 14500,
    yMax: 21000,
    threat: 'PREDATOR PATROL (Tier 4)',
    threatColor: '#f472b6',
    bgTop: '#4338ca',
    bgBot: '#312e81',
    ambient: '#3730a3',
    light: 0.50,
  },
  {
    id: 'caverns',
    name: 'Midnight Neon Caverns',
    yMin: 21000,
    yMax: 28000,
    threat: 'BIOLUMINESCENT DEPTHS (Tier 5)',
    threatColor: '#e879f9',
    bgTop: '#6d28d9',
    bgBot: '#4c1d95',
    ambient: '#5b21b6',
    light: 0.38,
  },
  {
    id: 'geysers',
    name: 'Hadal Carbonation Vents',
    yMin: 28000,
    yMax: 35000,
    threat: 'THERMAL PRESSURE (Tier 6)',
    threatColor: '#fb7185',
    bgTop: '#9d174d',
    bgBot: '#581c87',
    ambient: '#831843',
    light: 0.28,
  },
  {
    id: 'abyss',
    name: 'Abyssal Megalodon Mariana',
    yMin: 35000,
    yMax: 41000,
    threat: 'APEX PREDATOR TERRITORY (Tier 7)',
    threatColor: '#f43f5e',
    bgTop: '#7f1d1d',
    bgBot: '#4c0519',
    ambient: '#881337',
    light: 0.18,
  },
  {
    id: 'core',
    name: 'Colossal Leviathan Core',
    yMin: 41000,
    yMax: 46000,
    threat: 'ANCIENT LEVIATHAN REALM (Tier 8)',
    threatColor: '#fde047',
    bgTop: '#6b1236',
    bgBot: '#3b0764',
    ambient: '#581c87',
    light: 0.14,
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
const celInk = (s, mult = 1, min = 1.6, max = 4.2) => clamp(s * 0.088 * mult, min, max);
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
    hint: 'DRAG to swim · eat Swedish fish & gummy sharks · dodge giants!',
    baseLikes: 3420,
    isPrestige: true,
    parScore60s: 1400,
    cue: 'FEED THE FISH!',
    prestigeCue: 'MORE BIGGER FISH!',
    scaling: {
      predatorBonus:    { base: 0.0, rate: 0.22, cap: 0.26, mode: 'up', deltaFormat: 'abs', unit: '%', label: 'Big Fish' },
      predatorSizeMult: { base: 1.0, rate: 0.16, cap: 1.32, mode: 'up', label: 'Predator Size' },
      fishSpeedMult:    { base: 1.0, rate: 0.16, cap: 1.48, mode: 'up', label: 'Fish Speed' },
      maxFishCount:     { base: 32,  rate: 0.18, cap: 54,   mode: 'up', round: true, label: 'Ocean Density' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    preloadWeeblAtlas();
    // Prestige rank (1 = first playthrough). Set by Reel.js before init().
    this.pLevel = Math.max(1, this.prestige || 1);
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
      chompT: 0,
      dangerNear: false,
    };
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Number.isFinite(saved.size) && saved.size >= 12) {
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
    this.fishTextCooldown = 0;
    this.fishBatchPts = 0;
    this.sharkTextCooldown = 0;

    // Ocean environment: Strawberry/Apple Licorice Laces, Rock Candy Corals & Parallax Reefs
    this.licoriceLaces = this.buildLicoriceLaces();
    this.corals = this.buildCoralReefs();
    this.deepVents = this.buildHydrothermalVents();
    this.parallaxRidges = [
      { seed: 0.7, speed: 0.25, baseAlpha: 0.16, amp: 34, step: 95 },
      { seed: 2.3, speed: 0.45, baseAlpha: 0.24, amp: 46, step: 115 },
    ];
    this.surfaceClouds = [
      { x: -190, y: -105, scale: 0.78, id: 'cloud_1' },
      { x: 185, y: -125, scale: 0.68, id: 'cloud_2' },
    ];

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
      // Shallows (0 - 3500m) — c1 visible close to starter dive
      { id: 'c1',  x: -340,   y: 660,   opened: false, name: 'Sunlit Shallows Wafer' },
      { id: 'c2',  x: 1100,   y: 2100,  opened: false, name: 'Soda Current Cache' },
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
    // Starter reef kelp clusters visible around initial spawn (y = 300..900)
    const starterOffsets = [-310, -170, -65, 110, 240, 390];
    starterOffsets.forEach((sx, idx) => {
      laces.push({
        x: sx + rand(-25, 25),
        y: rand(460, 760),
        height: rand(165, 310),
        wobPhase: rand(0, TAU),
        color: idx % 2 === 0 ? '#ef4444' : '#14b8a6',
      });
    });
    for (let i = -60; i <= 60; i++) {
      laces.push({
        x: i * 320 + rand(-80, 80),
        y: rand(900, 42000),
        height: rand(260, 620),
        wobPhase: rand(0, TAU),
        color: Math.random() > 0.5 ? '#ef4444' : '#14b8a6',
      });
    }
    return laces;
  }

  buildCoralReefs() {
    const reefs = [];
    const colors = ['#ec4899', '#38bdf8', '#a855f7', '#facc15', '#22c55e'];
    // Starter corals framing opening Sunlit Soda Shallows dive
    [-250, -90, 155, 310].forEach((cx, idx) => {
      reefs.push({
        x: cx + rand(-25, 25),
        y: rand(470, 680),
        type: idx % 3,
        color: colors[idx % colors.length],
        scale: rand(0.95, 1.35),
      });
    });
    for (let i = -50; i <= 50; i++) {
      reefs.push({
        x: i * 380 + rand(-90, 90),
        y: rand(700, 39000),
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

    // Determine target size (Prestige increases predator ratio & size via SSOT scaling)
    let finalSize;
    const isPredator = Math.random() < Math.min(0.94, predatorChance + (this.diff.predatorBonus || 0));
    if (isPredator) {
      const sizeScale = this.diff.predatorSizeMult ?? 1;
      finalSize = Math.max(sizeMin, Math.min(sizeMax * sizeScale, p.size * rand(1.18, 1.85) * sizeScale));
      if (y >= 35000) finalSize = Math.max(finalSize, rand(160, 340) * sizeScale);
    } else {
      finalSize = Math.max(8, Math.min(sizeMax * 0.75, p.size * rand(0.4, 0.88)));
    }

    const baseSpd = rand(spec.baseSpd[0], spec.baseSpd[1]) * (this.diff.fishSpeedMult ?? 1);
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
    this.fishTextCooldown -= dt;
    this.sharkTextCooldown -= dt;

    // Flush accumulated fish feast text smoothly
    if (this.fishTextCooldown <= 0 && this.fishBatchPts > 0) {
      const kk = 1 / this.zoom;
      this.fx.text(p.x, p.y - p.size * 0.5 - 16 * kk, `+${this.fishBatchPts}`, '#ffd166', 20, 0.6);
      this.fishBatchPts = 0;
      this.fishTextCooldown = 0.32;
    }

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
        this.fx.burst(coin.x, coin.y, '#ffd166', 4, 70 * kk, 0.35, 2.5);
        this.sounds.bubble(1.2 + Math.random() * 0.4);
        this.haptics.light();
      }
    }

    const halfW = (this.W / 2 + 160) / this.zoom;
    const halfH = (this.H / 2 + 140) / this.zoom;

    /* ------------------------------------------------ Enhanced Predator AI & Movement Loop */
    p.bumpSquash = Math.max(0, (p.bumpSquash || 0) - dt * 4.8);
    p.chompT = Math.max(0, (p.chompT || 0) - dt * 5.2);
    p.dangerNear = false;

    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];

      // Cull fish only when safely far outside viewport
      if (Math.abs(f.x - p.x) > halfW * 1.6 || Math.abs(f.y - p.y) > halfH * 1.6) {
        this.fish.splice(i, 1);
        continue;
      }

      f.bumpCooldown = Math.max(0, (f.bumpCooldown || 0) - dt);
      f.stunT = Math.max(0, (f.stunT || 0) - dt);
      f.bumpSquash = Math.max(0, (f.bumpSquash || 0) - dt * 4.8);

      const dx = p.x - f.x;
      const dy = p.y - f.y;
      const d = Math.hypot(dx, dy);
      const ratio = f.size / p.size;
      const isDeadly = !this.isMaxSize() && ratio > 1.08 && p.sugarRush <= 0;
      const isEdible = this.isMaxSize() || ratio <= 0.96 || p.sugarRush > 0;
      const isRival = !isDeadly && !isEdible;

      let lungeBoost = 1.0;

      if (f.stunT > 0) {
        f.isHunting = false;
        f.isFleeing = false;
        f.snapT = 0;
        lungeBoost = 0.22;
      } else if (isDeadly) {
        // Aggro detection range scales with predator size
        const aggroRadius = clamp(f.size * 3.0 + 130, 200, 520);

        if (d < aggroRadius) {
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

          const targetVy = clamp(dy * 1.6, -105, 105);
          f.vy += (targetVy - f.vy) * Math.min(1, dt * 2.6);

          const proximity = 1.0 - d / aggroRadius;
          lungeBoost = 1.15 + proximity * 0.25;
          f.isHunting = true;
          if (d < (p.size + f.size) * 1.95) p.dangerNear = true;

          const inFront = (dx * f.dir > 0);
          if (inFront && d < (p.size + f.size) * 1.2) {
            f.snapT = Math.min(1.0, f.snapT + dt * 4.5);
          } else {
            f.snapT = Math.max(0, f.snapT - dt * 2.0);
          }

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
        // Equal-size rival alertness
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

      // Apply smooth knockback impulses directly onto x and baseY so bounced fish glide cleanly
      const kDecay = Math.pow(0.04, dt);
      const knockX = (f.knockVx || 0) * dt;
      const knockY = (f.knockVy || 0) * dt;
      f.knockVx = (f.knockVx || 0) * kDecay;
      f.knockVy = (f.knockVy || 0) * kDecay;

      f.x += f.vx * dt + knockX;
      f.baseY = clamp(f.baseY + f.vy * dt + knockY, MINY + 15, MAXY - 15);
      f.y = clamp(f.baseY + naturalBob, MINY + 15, MAXY - 15);

      // Collision checks
      const reach = (p.size + f.size) * 0.56;
      if (d < reach) {
        if (isEdible) {
          this.eat(i, f, this.isMaxSize() || p.sugarRush > 0);
        } else if (isDeadly) {
          if (this.die(`Swallowed by ${f.name}`)) {
            const kk = 1 / this.zoom;
            this.fx.burst(p.x, p.y, '#ff4b5c', 28, 240 * kk, 0.85, 5);
            this.fx.shake(12, 0.45);
          }
        } else if (isRival && f.bumpCooldown <= 0) {
          // Rubbery 3D Jelly Bounce + Dash Crack-Nibble!
          const nx = d > 0.01 ? dx / d : (p.x >= f.x ? 1 : -1);
          const ny = d > 0.01 ? dy / d : 0;
          const sep = Math.max(4, (reach - d) * 0.55 + 3);
          p.x = clamp(p.x + nx * sep, -WORLD_W / 2 + 50, WORLD_W / 2 - 50);
          p.y = clamp(p.y + ny * sep, MINY, MAXY);
          f.x -= nx * sep;
          f.baseY = clamp(f.baseY - ny * sep, MINY + 15, MAXY - 15);
          f.y = clamp(f.baseY + naturalBob, MINY + 15, MAXY - 15);

          f.bumpCooldown = 0.28;
          p.bumpSquash = 1.0;
          f.bumpSquash = 1.0;

          const dashSurge = p.dash > 0.08 || p.sugarRush > 0 || Math.hypot(p.vx, p.vy) > (this.pSpeed / this.zoom) * 1.18;
          const bouncePow = (dashSurge ? 260 : 195) / Math.max(0.22, this.zoom);
          p.vx += nx * bouncePow * 0.52;
          p.vy += ny * bouncePow * 0.52;
          f.knockVx = -nx * (dashSurge ? 320 : 230) / Math.max(0.35, Math.sqrt(this.zoom));
          f.knockVy = -ny * (dashSurge ? 240 : 175) / Math.max(0.35, Math.sqrt(this.zoom));
          if (Math.abs(nx) > 0.35) f.dir = nx > 0 ? -1 : 1;

          const kk = 1 / this.zoom;
          const midX = (p.x + f.x) * 0.5;
          const midY = (p.y + f.y) * 0.5;

          if (dashSurge) {
            // Headbutt Cracks & Shrinks Rival -> Next chomp swallows it whole!
            f.stunT = 1.45;
            f.size = Math.max(8, f.size * 0.80);
            this.score += 25;
            this.fx.ring(midX, midY, '#ffd166', reach * 1.55, 0.36, 5);
            this.fx.burst(midX, midY, f.flavor || '#ffd166', 12, 160 * kk, 0.5, 3.5);
            this.fx.text(f.x, f.y - f.size * 0.9, '💫 CRACKED! +25', '#ffd166', 19, 0.75);
            this.sounds.hit();
            this.haptics.medium();
          } else {
            // Playful Elastic Boing Rebound!
            this.fx.ring(midX, midY, '#9bf6ff', reach * 1.25, 0.3, 3.5);
            this.fx.burst(midX, midY, '#ffffff', 7, 110 * kk, 0.38, 2.5);
            this.fx.text(midX, midY - 14 * kk, 'BOING!', '#9bf6ff', 14, 0.42);
            this.sounds.bubble(0.65);
            this.haptics.light();
          }
        }
      }
    }

    this.fish = this.fish.filter(Boolean);

    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.fish.length < (this.diff.maxFishCount ?? 32)) {
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
    p.chompT = 1.0;

    const growthMult = wasSharkHunter ? 1.4 : 0.95;
    p.size = Math.min(360, Math.sqrt(p.size * p.size + f.size * f.size * growthMult + f.size * 1.2));

    const pts = wasSharkHunter ? Math.round(f.size * 10) : Math.max(1, Math.round(f.size * 3.5));
    this.score += pts;

    if (wasSharkHunter) {
      this.fx.burst(f.x, f.y, '#f72585', 12, 180 * kk, 0.5, 3.5);
      if (this.sharkTextCooldown <= 0) {
        this.fx.text(f.x, f.y - 18 * kk, `🦈 CRUNCHED! +${pts}`, '#3dffa2', 22, 0.65);
        this.sharkTextCooldown = 0.35;
      }
      this.sounds.chomp();
      this.sounds.hit();
      this.haptics.heavy();
    } else {
      this.fx.burst(f.x, f.y, f.flavor || '#9bf6ff', 8, 140 * kk, 0.45, 3);
      this.fishBatchPts += pts;
      if (this.fishTextCooldown <= 0) {
        this.fx.text(p.x, p.y - p.size * 0.5 - 14 * kk, `+${this.fishBatchPts}`, '#ffd166', 20, 0.6);
        this.fishBatchPts = 0;
        this.fishTextCooldown = 0.32;
      }
      if (this.sfxT <= 0) {
        this.sounds.bubble(0.85 + Math.random() * 0.5);
        this.sfxT = 0.05;
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

    // 1. Dynamic Vibrant Depth-Based Cel Ocean Gradient
    const zone = this.getDepthZone(p.y);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, zone.bgTop);
    bg.addColorStop(1, zone.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 2. Parallax Distant Reef Ridges & Hard-Edged Sunbeams
    this.drawParallaxReefs(ctx, p, zone, W, H);
    if (p.y < 2200) {
      const sunAlpha = (1 - p.y / 2200) * 0.16;
      ctx.fillStyle = `rgba(255, 255, 255, ${sunAlpha})`;
      for (let i = 0; i < 5; i++) {
        const sx = i * 118 - 35 + Math.sin(this.time * 0.45 + i * 1.4) * 16;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + 54, 0);
        ctx.lineTo(sx + 185, H);
        ctx.lineTo(sx + 28, H);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 3. Floating Sugar Crystals / #000-rimmed Sparkles
    for (const q of this.sugarCrystals) {
      ctx.save();
      ctx.globalAlpha = 0.42 + q.d * 0.45;
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.s, 0, TAU);
      ctx.fill();
      if (q.sparkle) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. World Camera Transform
    ctx.save();
    ctx.translate(ox + off.x, oy + off.y);
    ctx.scale(sc, sc);
    ctx.translate(-p.x, -p.y);

    // Weebl Above-Surface Sky, Sunburst, Island & Foamy Wave Crest (`y < 20`)
    if (p.y - oy / sc < 140) {
      this.drawSurfaceSkyAndWaves(ctx, p, ox / sc, oy / sc);
    }

    // Rising Soda Fizz Carbonation Bubbles (#000-rimmed white specular bubbles)
    for (const b of this.sodaBubbles) {
      if (Math.abs(b.x - p.x) > ox / sc + 60 || Math.abs(b.y - p.y) > (H / 2) / sc + 60) continue;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 1.6 / sc;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.28, 0, TAU);
      ctx.fill();
    }

    // Background Rock Candy Corals & Licorice Kelp Laces
    this.drawCorals(ctx, p, ox / sc);
    this.drawLicoriceLaces(ctx, p, ox / sc, (H / 2) / sc);

    // Sunken Sugar Galleons
    this.drawSunkenGalleon(ctx, p, ox / sc, (H / 2) / sc);

    // Seabed at Mariana Trench with Hydrothermal Rock Candy Vents
    this.drawSeabed(ctx, p, ox / sc, (H / 2) / sc);

    // Chocolate Wafer Pirate Chests
    this.drawTreasureChests(ctx, p, ox / sc, (H / 2) / sc);

    // Collectible Gold Foil Chocolate Doubloons
    this.drawCoins(ctx);

    // Render #000-Inked Weebl Cel Confectionery Fish
    const sorted = [...this.fish].sort((a, b) => a.size - b.size);
    for (const f of sorted) {
      if (
        Math.abs(f.x - p.x) > ox / sc + f.size * 2.2 ||
        Math.abs(f.y - p.y) > (H / 2) / sc + f.size * 2.2
      ) {
        continue;
      }
      const ratio = f.size / p.size;
      const isDeadly = !this.isMaxSize() && ratio > 1.08 && p.sugarRush <= 0;
      const isRival = !isDeadly && !this.isMaxSize() && p.sugarRush <= 0 && ratio > 0.96;
      const nearPlayer = Math.hypot(f.x - p.x, f.y - p.y) < (p.size + f.size) * 2.6;
      this.drawConfectioneryFish(ctx, f, ratio, isDeadly, isRival && nearPlayer);
    }

    // Crowned Green Weebl Scuba Hero Swimmer (+ Sugar Rush Sunburst Aura)
    if (p.sugarRush > 0 || this.isMaxSize()) {
      const pulse = 1.0 + Math.sin(this.time * 11) * 0.12;
      drawSunburst(ctx, p.x, p.y, p.size * 1.95 * pulse, this.time * 2.4, 12, p.sugarRush > 0 ? 0.65 : 0.45, p.sugarRush > 0);
    }

    this.drawPlayerHero(ctx, p, sc);

    this.fx.render(ctx, sc);
    ctx.restore();

    // 5. Screen-Edge Threat Arrows
    this.drawThreatRadar(ctx, p, ox, oy, sc, W, H);

    // 6. Clutter-Free Weebl Comic HUD
    this.drawDeepHUD(ctx, W, H, p);
  }

  drawPlayerHero(ctx, p, sc) {
    const eyes = p.dangerNear || p.bumpSquash > 0.2 ? 'panic' : 'happy';
    const sq = 1 + (p.bumpSquash || 0) * 0.2 + (p.chompT || 0) * 0.16;
    const tilt = clamp(p.vy / Math.max(90, Math.abs(p.vx) + 180) * 0.45, -0.45, 0.45);
    const swimSpeed = this.time * (p.dash > 0.1 || p.sugarRush > 0 ? 1.8 : 1.1);

    // Pristine HD 3D Crowned Scuba Hero Bean with curved goggles, snorkel & trailing flippers
    drawHeroCharacter(ctx, p.x, p.y + p.size * 0.72, p.size * 1.92, {
      view: 'side',
      dir: p.dir < 0 ? -1 : 1,
      state: 'swim',
      prop: 'scuba',
      skinColor: p.sugarRush > 0 ? '#facc15' : null,
      expr: eyes,
      t: swimSpeed,
      lean: tilt,
      squashX: 2 - sq,
      squashY: sq,
    });
  }

  drawSurfaceSkyAndWaves(ctx, p, halfW, halfH) {
    const leftX = p.x - halfW - 120;
    const spanW = halfW * 2 + 240;
    const surfY = 20;
    const skyTop = p.y - halfH - 120;

    // 1. Clip sky, sunburst, clouds & island cleanly above animated ocean surface wave
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(leftX, skyTop);
    ctx.lineTo(leftX + spanW, skyTop);
    for (let x = leftX + spanW; x >= leftX; x -= 28) {
      ctx.lineTo(x, surfY + Math.sin(x * 0.032 + this.time * 2.4) * 7);
    }
    ctx.closePath();
    ctx.clip();

    const sg = ctx.createLinearGradient(0, skyTop, 0, surfY);
    sg.addColorStop(0, '#38bdf8');
    sg.addColorStop(1, '#bae6fd');
    ctx.fillStyle = sg;
    ctx.fillRect(leftX, skyTop, spanW, surfY - skyTop + 14);

    // Subtle sky sunburst cleanly tucked behind HUD
    drawSunburst(ctx, p.x * 0.35, -180, 260, this.time * 0.08, 12, 0.14, false);

    // Fluffy Weebl clouds (atlas sprite with cel vector fallback)
    for (const c of this.surfaceClouds) {
      const cx = p.x * 0.65 + c.x;
      drawSprite(ctx, c.id, cx, c.y, 175 * c.scale, 102 * c.scale, {
        fallback: (cctx, w, h) => {
          cctx.fillStyle = '#ffffff';
          cctx.strokeStyle = STYLE_TOKENS.ink;
          cctx.lineWidth = 3.5;
          cctx.beginPath();
          cctx.arc(-w * 0.22, 0, h * 0.32, 0, TAU);
          cctx.arc(0, -h * 0.14, h * 0.42, 0, TAU);
          cctx.arc(w * 0.24, 2, h * 0.3, 0, TAU);
          cctx.fill();
          cctx.stroke();
        },
      });
    }

    // Little sunny Weebl coral atoll tucked in open gap between T1 pill and Sonar
    ctx.fillStyle = '#fde68a';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(42, surfY + 10);
    ctx.quadraticCurveTo(105, surfY - 34, 168, surfY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(64, surfY - 13);
    ctx.quadraticCurveTo(105, surfY - 39, 146, surfY - 13);
    ctx.quadraticCurveTo(105, surfY - 5, 64, surfY - 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 2. Foamy #000-Inked Ocean Wave Ribbon at y = 20
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 10 / Math.max(0.25, this.zoom);
    ctx.beginPath();
    for (let x = leftX; x <= leftX + spanW; x += 28) {
      const wy = surfY + Math.sin(x * 0.032 + this.time * 2.4) * 7;
      if (x === leftX) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5.5 / Math.max(0.25, this.zoom);
    ctx.stroke();
    ctx.restore();
  }

  drawParallaxReefs(ctx, p, zone, W, H) {
    ctx.save();
    for (const layer of this.parallaxRidges) {
      const baseY = H * (0.72 + layer.speed * 0.25);
      const scroll = p.x * this.zoom * layer.speed;
      ctx.fillStyle = zone.ambient;
      ctx.globalAlpha = layer.baseAlpha;
      ctx.beginPath();
      ctx.moveTo(-20, H + 10);
      for (let sx = -40; sx <= W + layer.step; sx += layer.step * 0.5) {
        const wx = sx + scroll;
        const crest = Math.sin(wx * 0.012 + layer.seed) * layer.amp
          + Math.cos(wx * 0.027 - layer.seed) * (layer.amp * 0.45);
        ctx.lineTo(sx, baseY - crest);
      }
      ctx.lineTo(W + 40, H + 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------ Scenery & Landmarks (#000-Inked Weebl Cel Style) */
  drawCorals(ctx, p, halfW) {
    for (const c of this.corals) {
      if (Math.abs(c.x - p.x) > halfW + 120) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const darkCol = shadeColor(c.color, -0.26);

      if (c.type === 0) {
        // 3-branch cel-shaded Weebl staghorn coral with rounded tips & gloss dots
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Shaded back right tine
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 17;
        ctx.beginPath();
        ctx.moveTo(4, -6);
        ctx.quadraticCurveTo(18, -22, 20, -40);
        ctx.stroke();
        ctx.strokeStyle = darkCol;
        ctx.lineWidth = 11;
        ctx.stroke();

        // Main center trunk + left curved tine
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 19;
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.quadraticCurveTo(-2, -26, 2, -56);
        ctx.moveTo(-2, -16);
        ctx.quadraticCurveTo(-18, -28, -19, -46);
        ctx.stroke();

        ctx.strokeStyle = c.color;
        ctx.lineWidth = 13;
        ctx.stroke();

        // Rounded reef base pebble
        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.ellipse(0, 3, 18, 7, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();

        // Specular gloss highlights on coral tips
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.beginPath();
        ctx.arc(0, -54, 2.8, 0, TAU);
        ctx.arc(-19, -44, 2.4, 0, TAU);
        ctx.arc(19, -38, 2.2, 0, TAU);
        ctx.fill();
      } else if (c.type === 1) {
        // Curved candy tube coral
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 17;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(15, -30, -9, -64);
        ctx.stroke();

        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 10.5;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-2, -6);
        ctx.quadraticCurveTo(10, -32, -10, -58);
        ctx.stroke();
      } else {
        // Smiling cel coral cushion & swaying tentacles
        for (let t = -3; t <= 3; t++) {
          const tx = t * 6.5;
          const sw = Math.sin(this.time * 2.2 + t) * 7;
          ctx.strokeStyle = STYLE_TOKENS.ink;
          ctx.lineWidth = 7.2;
          ctx.beginPath();
          ctx.moveTo(tx, -6);
          ctx.lineTo(tx + sw, -25);
          ctx.stroke();
          ctx.strokeStyle = shadeColor(c.color, 0.2);
          ctx.lineWidth = 3.5;
          ctx.stroke();
        }
        ctx.fillStyle = c.color;
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 13, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
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
      ctx.lineJoin = 'round';

      drawComicText(ctx, `🏴‍☠️ ${g.name.toUpperCase()}`, 0, -182, "900 14px 'Fredoka', Outfit, sans-serif", '#fde047', {
        strokeWidth: 4,
      });

      // Cross-braced mast
      ctx.save();
      ctx.translate(-7, -96);
      drawWoodTrussTile(ctx, 18, 128);
      ctx.restore();

      // Peppermint striped tattered sail
      ctx.fillStyle = '#fef3c7';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-10, -152);
      ctx.quadraticCurveTo(54, -112, 62, -68);
      ctx.lineTo(-10, -68);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-10, -112, 46, 16);
      ctx.strokeRect(-10, -112, 46, 16);

      // Pirate Jolly flag
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.roundRect(-62, -156, 46, 28, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-39, -142, 6.5, 0, TAU);
      ctx.fill();

      // Chunky Weebl-inked Hull
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 4.0;
      ctx.beginPath();
      ctx.moveTo(-182, -40);
      ctx.quadraticCurveTo(-142, 64, 0, 78);
      ctx.quadraticCurveTo(162, 78, 212, -20);
      ctx.lineTo(190, -42);
      ctx.lineTo(120, -35);
      ctx.lineTo(-182, -40);
      ctx.closePath();
      ctx.fill();

      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-200, 14, 420, 75);
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      for (let y = -14; y <= 46; y += 20) {
        ctx.beginPath();
        ctx.moveTo(-175, y);
        ctx.lineTo(195, y);
        ctx.stroke();
      }
      ctx.restore();
      ctx.stroke();

      for (let px = -110; px <= 130; px += 55) {
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(px, 15, 10, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(px, 15, 5, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  drawSeabed(ctx, p, halfW, halfH) {
    if (p.y < MAXY - 1400) return;

    ctx.save();
    const seaY = MAXY - 20;

    ctx.fillStyle = '#451a03';
    ctx.fillRect(p.x - halfW - 50, seaY, halfW * 2 + 100, 200);

    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x - halfW - 50, seaY + 10);
    for (let x = p.x - halfW - 50; x <= p.x + halfW + 50; x += 40) {
      ctx.lineTo(x, seaY + Math.sin(x * 0.05) * 9);
    }
    ctx.lineTo(p.x + halfW + 50, seaY + 120);
    ctx.lineTo(p.x - halfW - 50, seaY + 120);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (const v of this.deepVents) {
      if (Math.abs(v.x - p.x) > halfW + 100) continue;
      ctx.fillStyle = '#572814';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(v.x - v.w * 0.5, v.y + v.h);
      ctx.lineTo(v.x - v.w * 0.3, v.y);
      ctx.lineTo(v.x + v.w * 0.3, v.y);
      ctx.lineTo(v.x + v.w * 0.5, v.y + v.h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = v.glow;
      ctx.beginPath();
      ctx.ellipse(v.x, v.y, v.w * 0.28, 9, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      for (let i = 0; i < 4; i++) {
        const by = v.y - ((this.time * 65 + i * 25) % 120);
        const bx = v.x + Math.sin(this.time * 4 + i) * 8;
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, 3.5 + i * 0.8, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawTreasureChests(ctx, p, halfW, halfH) {
    for (const c of this.chests) {
      if (Math.abs(c.x - p.x) > halfW + 100 || Math.abs(c.y - p.y) > halfH + 100) continue;
      ctx.save();
      ctx.translate(c.x, c.y);

      if (!c.opened) {
        const sp = 0.75 + 0.25 * Math.sin(this.time * 4.5 + c.x);
        drawComicStarburst(ctx, 20, -24, 9 * sp, 3.8 * sp, 4, '#fef08a', STYLE_TOKENS.ink, this.time * 1.5, 1.8);
      }

      // Base chest box
      ctx.fillStyle = '#92400e';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.roundRect(-22, -10, 44, 26, 6);
      ctx.fill();
      ctx.stroke();

      // Golden straps & padlock
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-16, -9, 6, 24);
      ctx.strokeRect(-16, -9, 6, 24);
      ctx.fillRect(10, -9, 6, 24);
      ctx.strokeRect(10, -9, 6, 24);

      ctx.beginPath();
      ctx.arc(0, 3, 6, 0, TAU);
      ctx.fill();
      ctx.stroke();

      if (c.opened) {
        drawComicStarburst(ctx, 0, -18, 15, 7, 7, '#fef08a', STYLE_TOKENS.ink, this.time * 3, 2);
      } else {
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.arc(0, -10, 22, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(0, -19, 4.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  drawCoins(ctx) {
    for (const c of this.coins) {
      ctx.save();
      ctx.translate(c.x, c.y);
      const spin = Math.max(0.28, Math.abs(Math.sin(c.t)));
      ctx.scale(spin, 1);

      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 10.5, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  drawLicoriceLaces(ctx, p, halfW, halfH) {
    for (const k of this.licoriceLaces) {
      if (Math.abs(k.x - p.x) > halfW + 100 || Math.abs(k.y - k.height * 0.5 - p.y) > halfH + k.height) continue;
      const sw1 = Math.sin(this.time * 1.9 + k.wobPhase) * 30;
      const sw2 = Math.cos(this.time * 1.5 + k.wobPhase) * 24;
      const cp1x = k.x + sw1 * 0.95;
      const cp1y = k.y - k.height * 0.34;
      const cp2x = k.x - sw2 * 0.95;
      const cp2y = k.y - k.height * 0.68;
      const tipX = k.x + sw1;
      const tipY = k.y - k.height;

      ctx.save();
      // Lively S-sway candy kelp stem
      ctx.lineCap = 'round';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(k.x, k.y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tipX, tipY);
      ctx.stroke();

      ctx.strokeStyle = k.color;
      ctx.lineWidth = 9.5;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 2.6;
      ctx.stroke();

      // Alternating #000-inked gummy leaf buds anchored directly onto the S-curve stem
      ctx.fillStyle = k.color;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      for (const [t, side] of [[0.32, 1], [0.58, -1], [0.82, 1]]) {
        const mt = 1 - t;
        const bx = mt * mt * mt * k.x + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * tipX;
        const by = mt * mt * mt * k.y + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * tipY;
        ctx.beginPath();
        ctx.ellipse(bx + side * 7.5, by - 3, 10, 5, side * -0.45, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      // 2-tone cel #000-outlined reef boulder base
      ctx.fillStyle = '#94a3b8';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(k.x, k.y + 3, 18, 8.5, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.ellipse(k.x + 6, k.y + 4.5, 9, 4.5, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.ellipse(k.x - 13, k.y + 5, 7, 4.5, -0.2, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawCartoonJaws(ctx, x, y, w, h, snapT, teeth = 3) {
    if (snapT <= 0.04) return;
    const open = snapT * h;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#7f1d1d';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = Math.max(1.4, w * 0.1);
    ctx.beginPath();
    ctx.moveTo(-w, -open * 0.35);
    ctx.lineTo(w * 0.2, 0);
    ctx.lineTo(-w * 0.85, open);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    for (let t = 0; t < teeth; t++) {
      const tx = -w * (0.85 - (t / Math.max(1, teeth)) * 0.72);
      ctx.beginPath();
      ctx.moveTo(tx, -open * 0.25);
      ctx.lineTo(tx + w * 0.14, open * 0.35);
      ctx.lineTo(tx + w * 0.28, -open * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------ #000-INKED WEEBL SEA CREATURES */
  drawConfectioneryFish(ctx, f, ratio, isDeadly, showRivalHint = false) {
    ctx.save();
    ctx.translate(f.x, f.y);

    const s = f.size;

    // Predator Aggro / Rival Clash / Fleeing / Cracked Stun Indicators
    if (f.stunT > 0) {
      for (let i = 0; i < 3; i++) {
        const a = this.time * 6.5 + (i / 3) * TAU;
        const sx = Math.cos(a) * s * 0.54;
        const sy = -s * 0.78 + Math.sin(a) * s * 0.16;
        drawComicStarburst(ctx, sx, sy, Math.max(4, s * 0.16), Math.max(2, s * 0.07), 5, '#facc15', STYLE_TOKENS.ink, a, 1.5);
      }
    } else if (f.isHunting) {
      const alertPulse = 1.0 + Math.sin(this.time * 12) * 0.12;
      drawComicStarburst(ctx, 0, 0, s * 1.18 * alertPulse, s * 0.92 * alertPulse, 10, 'rgba(239, 68, 68, 0.26)', '#ef4444', this.time * 2, 2);
      drawComicText(ctx, '!', 0, -s * 0.84, `900 ${Math.max(14, Math.round(s * 0.36))}px 'Fredoka', Outfit, sans-serif`, '#ef4444', { strokeWidth: 3.5 });
    } else if (showRivalHint) {
      const pRing = 1 + Math.sin(this.time * 8) * 0.08;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = celInk(s, 0.75, 1.8, 3.2);
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.08 * pRing, s * 0.64 * pRing, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      drawComicText(ctx, '⚡', 0, -s * 0.78, `900 ${Math.max(12, Math.round(s * 0.32))}px 'Fredoka', Outfit, sans-serif`, '#fde047', { strokeWidth: 3 });
    } else if (f.isFleeing) {
      // Comic sky-blue panic sweat drop
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = Math.max(1.4, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.88);
      ctx.quadraticCurveTo(s * 0.14, -s * 0.66, 0, -s * 0.56);
      ctx.quadraticCurveTo(-s * 0.14, -s * 0.66, 0, -s * 0.88);
      ctx.fill();
      ctx.stroke();
    }

    const sq = f.bumpSquash || 0;
    ctx.scale(f.dir * (1 - sq * 0.16), 1 + sq * 0.22);
    ctx.rotate(Math.atan2(f.vy, Math.abs(f.vx) + 25) * 0.42);

    const swing = Math.sin(f.wob * 2.8) * s * 0.22;
    const eyeMood = f.stunT > 0 ? 'dizzy' : isDeadly ? 'angry' : f.isFleeing ? 'panic' : 'happy';

    switch (f.species) {
      case 'swedish':
        this.renderSwedishFish(ctx, s, swing, f.flavor, eyeMood);
        break;
      case 'candycorn':
        this.renderCandyCornFish(ctx, s, swing, eyeMood);
        break;
      case 'peachring':
        this.renderSourPeachRing(ctx, s, swing, eyeMood);
        break;
      case 'gummyworm':
        this.renderGummyWorm(ctx, s, f.wob, eyeMood);
        break;
      case 'puffer':
        this.renderMarshmallowPuffer(ctx, s, swing, f.puffed, eyeMood);
        break;
      case 'jellydrop':
        this.renderBioluminescentGumdrop(ctx, s, f.wob, eyeMood);
        break;
      case 'peppermint':
        this.renderPeppermintBarracuda(ctx, s, swing, eyeMood, f.snapT);
        break;
      case 'licoriceserpent':
        this.renderLicoriceSerpent(ctx, s, f.wob, eyeMood, f.snapT);
        break;
      case 'rockcandymarlin':
        this.renderRockCandyMarlin(ctx, s, swing, eyeMood, f.snapT);
        break;
      case 'sourkraken':
        this.renderGumdropKraken(ctx, s, f.wob, eyeMood);
        break;
      case 'strawberryshark':
        this.renderHariboShark(ctx, s, swing, eyeMood, true, f.snapT);
        break;
      case 'sourmegalodon':
        this.renderSourMegalodon(ctx, s, swing, eyeMood, f.snapT);
        break;
      case 'hariboshark':
      default:
        this.renderHariboShark(ctx, s, swing, eyeMood, false, f.snapT);
        break;
    }

    ctx.restore();
  }

  // 1. 🍬 Swedish Gummy Fish (#000-inked 2-tone cel + Weebl eyes)
  renderSwedishFish(ctx, s, swing, flavor = '#e63946', eyeMood = 'happy') {
    const lw = celInk(s, 0.95);
    const dark = shadeColor(flavor, -0.25);

    ctx.lineJoin = 'round';
    ctx.fillStyle = dark;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, 0);
    ctx.quadraticCurveTo(-s * 1.05, -s * 0.36 + swing * 0.4, -s * 1.34, -s * 0.44 + swing);
    ctx.quadraticCurveTo(-s * 1.1, swing * 0.5, -s * 1.34, s * 0.44 + swing);
    ctx.quadraticCurveTo(-s * 1.05, s * 0.36 + swing * 0.4, -s * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = flavor;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.92, s * 0.50, 0, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.28, s * 0.96, s * 0.35, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.14, -s * 0.28, s * 0.36, s * 0.09, -0.08, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.92, s * 0.50, 0, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(-s * 0.04, s * 0.22, s * 0.24, s * 0.12, 0.38, 0, TAU);
    ctx.fill();
    ctx.stroke();

    drawWeeblEyeCluster(ctx, s * 0.44, -s * 0.10, s * 0.22, { lookX: 0.45, mood: eyeMood, lineW: lw * 0.8 });
  }

  // 2. 🍊 Candy Corn Fish (Hard cel 3-color block bands)
  renderCandyCornFish(ctx, s, swing, eyeMood = 'happy') {
    const lw = celInk(s, 0.95);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-s * 0.58, 0);
    ctx.lineTo(-s * 1.28, -s * 0.44 + swing);
    ctx.lineTo(-s * 1.28, s * 0.44 + swing);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.88, s * 0.50, 0, 0, TAU);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-s, -s, s * 0.65, s * 2);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(-s * 0.35, -s, s * 0.72, s * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(s * 0.37, -s, s * 0.75, s * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.12, -s * 0.28, s * 0.36, s * 0.09, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.88, s * 0.50, 0, 0, TAU);
    ctx.stroke();

    drawWeeblEyeCluster(ctx, s * 0.44, -s * 0.10, s * 0.22, { lookX: 0.45, mood: eyeMood, lineW: lw * 0.8 });
  }

  // 3. 🍑 Sour Peach Ring Jelly (Real donut ring cutout + #000 outlines)
  renderSourPeachRing(ctx, s, swing, eyeMood = 'happy') {
    const lw = celInk(s, 0.95);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let t = -1; t <= 1; t++) {
      const ty = t * (s * 0.2);
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = lw * 2.2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.56, ty);
      ctx.quadraticCurveTo(-s * 1.0, ty + swing, -s * 1.32, ty - swing);
      ctx.stroke();
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = lw * 1.25;
      ctx.stroke();
    }

    ctx.fillStyle = '#fb7185';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.66, 0, TAU, false);
    ctx.arc(0, 0, s * 0.26, 0, TAU, true);
    ctx.fill('evenodd');

    // Upper sunny peach cel slice
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.66, 0, TAU, false);
    ctx.arc(0, 0, s * 0.26, 0, TAU, true);
    ctx.clip('evenodd');
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(-s * 0.15, -s * 0.3, s * 0.72, s * 0.38, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, s * 0.66, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.26, 0, TAU);
    ctx.stroke();

    drawWeeblEyeCluster(ctx, s * 0.26, -s * 0.34, s * 0.19, { lookX: 0.4, mood: eyeMood, lineW: lw * 0.75 });
  }

  // 4. 🍫 Marshmallow Puffer (Fluffy #000-inked puff + cel butterscotch spikes)
  renderMarshmallowPuffer(ctx, s, swing, puffed, eyeMood = 'happy') {
    const puffScale = 1.0 + puffed * 0.42;
    const pr = s * 0.64 * puffScale;
    const lw = celInk(pr * 2, 0.55);

    if (puffed > 0.05) {
      const numSpikes = 10;
      for (let i = 0; i < numSpikes; i++) {
        const a = (i / numSpikes) * TAU;
        const spLen = pr + puffed * s * 0.36;
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.2) * pr * 0.9, Math.sin(a - 0.2) * pr * 0.9);
        ctx.lineTo(Math.cos(a) * spLen, Math.sin(a) * spLen);
        ctx.lineTo(Math.cos(a + 0.2) * pr * 0.9, Math.sin(a + 0.2) * pr * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(-pr * 0.72, swing * 0.35, pr * 0.26, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.arc(0, 0, pr, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(pr * 0.12, pr * 0.22, pr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-pr * 0.28, -pr * 0.45, pr * 0.3, pr * 0.14, -0.35, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, pr, 0, TAU);
    ctx.stroke();

    drawWeeblEyeCluster(ctx, pr * 0.32, -pr * 0.16, pr * 0.32, { lookX: 0.4, mood: eyeMood, lineW: lw * 0.8 });
  }

  // 5. 🐛 Trolli Gummy Worm (Beaded cel segments + #000 ink)
  renderGummyWorm(ctx, s, wob, eyeMood = 'happy') {
    const segments = 5;
    const lw = celInk(s, 0.85);
    for (let i = segments; i >= 0; i--) {
      const segX = -i * (s * 0.29);
      const segY = Math.sin(wob * 2.8 + i * 0.65) * (s * 0.24);
      const segR = s * (0.37 - i * 0.02);
      const col = i % 2 === 0 ? '#14b8a6' : '#f43f5e';
      ctx.fillStyle = col;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(segX, segY, segR, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
      ctx.beginPath();
      ctx.ellipse(segX - segR * 0.25, segY - segR * 0.35, segR * 0.28, segR * 0.14, -0.3, 0, TAU);
      ctx.fill();
    }
    drawWeeblEyeCluster(ctx, s * 0.14, -s * 0.08, s * 0.18, { lookX: 0.45, mood: eyeMood, lineW: lw * 0.8 });
  }

  // 6. 🍭 Peppermint Razor Barracuda (Snapping jaw + bold stripes)
  renderPeppermintBarracuda(ctx, s, swing, eyeMood = 'angry', snapT = 0) {
    const lw = celInk(s, 0.95);
    const L = s * 1.48;
    const Hh = s * 0.42;

    ctx.lineJoin = 'round';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.moveTo(-L * 0.7, 0);
    ctx.lineTo(-L * 1.34, -Hh * 1.12 + swing);
    ctx.lineTo(-L * 1.34, Hh * 1.12 + swing);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = Math.max(4, s * 0.13);
    [-0.55, -0.22, 0.1, 0.4].forEach((sx) => {
      ctx.beginPath();
      ctx.moveTo(sx * L - Hh, -Hh);
      ctx.lineTo(sx * L + Hh, Hh);
      ctx.stroke();
    });
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.fillRect(-L, -Hh, L * 2, Hh * 0.42);
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.stroke();

    this.drawCartoonJaws(ctx, L * 0.78, Hh * 0.2, L * 0.34, Hh * 0.75, Math.max(0.28, snapT), 3);
    drawWeeblEyeCluster(ctx, L * 0.62, -Hh * 0.2, Hh * 0.46, { lookX: 0.45, mood: eyeMood, lineW: lw * 0.85 });
  }

  // 7. 🦈 Haribo Two-Tone Shark & Strawberry Shark
  renderHariboShark(ctx, s, swing, eyeMood = 'angry', isStrawberry = false, snapT = 0) {
    const L = s * 1.46;
    const Hh = s * 0.54;
    const gelColor = isStrawberry ? '#f43f5e' : '#0284c7';
    const lw = celInk(s, 0.98);

    ctx.lineJoin = 'round';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;

    ctx.fillStyle = shadeColor(gelColor, -0.14);
    ctx.beginPath();
    ctx.moveTo(-L * 0.7, 0);
    ctx.lineTo(-L * 1.34, -Hh * 1.24 + swing);
    ctx.lineTo(-L * 1.02, swing * 0.4);
    ctx.lineTo(-L * 1.34, Hh * 1.24 + swing);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = gelColor;
    ctx.beginPath();
    ctx.moveTo(-L * 0.06, -Hh * 0.86);
    ctx.quadraticCurveTo(-L * 0.24, -Hh * 1.65, -L * 0.44, -Hh * 1.95);
    ctx.lineTo(-L * 0.54, -Hh * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Two-tone cel split: saturated gummy upper + bright cream belly
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = gelColor;
    ctx.fillRect(-L * 1.1, -Hh * 1.1, L * 2.2, Hh * 1.18);
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(-L * 1.1, Hh * 0.08, L * 2.2, Hh);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-L * 0.1, -Hh * 0.56, L * 0.48, Hh * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = gelColor;
    ctx.beginPath();
    ctx.ellipse(-L * 0.12, Hh * 0.5, L * 0.28, Hh * 0.34, 0.38, 0, TAU);
    ctx.fill();
    ctx.stroke();

    this.drawCartoonJaws(ctx, L * 0.72, Hh * 0.24, L * 0.34, Hh * 0.75, Math.max(0.24, snapT), 3);
    drawWeeblEyeCluster(ctx, L * 0.62, -Hh * 0.26, Hh * 0.4, { lookX: 0.45, mood: eyeMood, lineW: lw * 0.85 });
  }

  // 8. 🍓 Bioluminescent Gumdrop Jelly
  renderBioluminescentGumdrop(ctx, s, wob, eyeMood = 'happy') {
    const pulse = 1.0 + Math.sin(wob * 2.5) * 0.12;
    const r = s * 0.72 * pulse;
    const lw = celInk(s, 0.9);

    ctx.lineCap = 'round';
    for (let t = -2; t <= 2; t++) {
      const tx = t * (s * 0.22);
      const sw = Math.sin(wob * 2.5 + t) * s * 0.24;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = Math.max(4, s * 0.14);
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.quadraticCurveTo(tx + sw, s * 0.6, tx - sw, s * 1.2);
      ctx.stroke();
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = Math.max(2.2, s * 0.08);
      ctx.stroke();
    }

    ctx.fillStyle = '#ec4899';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(-r, -r * 0.36, r * 2, r * 0.4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.56, r * 0.26, r * 0.12, -0.4, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.closePath();
    ctx.stroke();

    drawWeeblEyeCluster(ctx, 0, -r * 0.36, r * 0.24, { dual: true, spacing: r * 0.48, lookX: 0.3, mood: eyeMood, lineW: lw * 0.75 });
  }

  // 9. 🗡️ Rock Candy Marlin
  renderRockCandyMarlin(ctx, s, swing, eyeMood = 'angry', snapT = 0) {
    const L = s * 1.46;
    const Hh = s * 0.46;
    const lw = celInk(s, 0.95);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(-L * 0.3, -Hh * 0.85);
    ctx.lineTo(-L * 0.05, -Hh * 2.15);
    ctx.lineTo(L * 0.3, -Hh * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-L, -Hh, L * 2, Hh * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-L, -Hh, L * 2, Hh * 0.72);
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(-L, Hh * 0.25, L * 2, Hh);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.stroke();

    // Candy lance rostrum
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = Math.max(5.5, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(L * 0.84, 0);
    ctx.lineTo(L * 1.88, 0);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, s * 0.09);
    ctx.stroke();
    ctx.setLineDash([s * 0.16, s * 0.16]);
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();
    ctx.setLineDash([]);

    this.drawCartoonJaws(ctx, L * 0.68, Hh * 0.25, L * 0.26, Hh * 0.55, Math.max(0.2, snapT), 2);
    drawWeeblEyeCluster(ctx, L * 0.62, -Hh * 0.22, Hh * 0.42, { lookX: 0.45, mood: eyeMood, lineW: lw * 0.85 });
  }

  // 10. 🐙 Gumdrop Kraken Squid
  renderGumdropKraken(ctx, s, wob, eyeMood = 'angry') {
    const lw = celInk(s, 0.95);
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      const ty = i * (s * 0.15);
      const wave = Math.sin(wob * 3 + i) * s * 0.25;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = Math.max(5, s * 0.15);
      ctx.beginPath();
      ctx.moveTo(s * 0.46, ty);
      ctx.quadraticCurveTo(s * 1.05, ty + wave, s * 1.56, ty - wave);
      ctx.stroke();
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = Math.max(2.6, s * 0.085);
      ctx.stroke();
    }

    ctx.fillStyle = '#9333ea';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, 0, s * 0.86, s * 0.48, 0, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.ellipse(-s * 0.45, -s * 0.25, s * 0.55, s * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(-s * 0.3, 0, s * 0.86, s * 0.48, 0, 0, TAU);
    ctx.stroke();

    drawWeeblEyeCluster(ctx, s * 0.24, -s * 0.16, s * 0.26, { lookX: 0.45, mood: eyeMood, lineW: lw * 0.8 });
  }

  // 11. 🍓 Strawberry Licorice Eel
  renderLicoriceSerpent(ctx, s, wob, eyeMood = 'angry', snapT = 0) {
    const lineW = Math.max(5, s * 0.16);

    ctx.lineCap = 'round';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lineW + Math.max(3, s * 0.09);
    ctx.beginPath();
    for (let x = -s * 1.35; x <= s * 0.85; x += s * 0.18) {
      const y = Math.sin(wob * 3 + x * 0.08) * s * 0.32;
      if (x === -s * 1.35) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = lineW;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = Math.max(1.5, s * 0.045);
    ctx.stroke();

    this.drawCartoonJaws(ctx, s * 0.84, Math.sin(wob * 3 + 0.08 * s * 0.85) * s * 0.32 + s * 0.06, s * 0.22, s * 0.18, Math.max(0.25, snapT), 2);
    drawWeeblEyeCluster(ctx, s * 0.7, Math.sin(wob * 3 + 0.06 * s) * s * 0.32 - s * 0.14, s * 0.18, { lookX: 0.45, mood: eyeMood, lineW: 2 });
  }

  // 12. 👑 Sour Crystal Megalodon (Royal crystal-crowned apex boss titan)
  renderSourMegalodon(ctx, s, swing, eyeMood = 'angry', snapT = 0) {
    const L = s * 1.66;
    const Hh = s * 0.64;
    const lw = celInk(s, 1.05, 2.2, 4.5);

    ctx.lineJoin = 'round';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lw;

    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.moveTo(-L * 0.7, 0);
    ctx.lineTo(-L * 1.38, -Hh * 1.3 + swing);
    ctx.lineTo(-L * 1.04, swing * 0.4);
    ctx.lineTo(-L * 1.38, Hh * 1.3 + swing);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-L * 0.08, -Hh * 0.85);
    ctx.lineTo(-L * 0.45, -Hh * 2.05);
    ctx.lineTo(-L * 0.56, -Hh * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Two-tone crystal cobalt + golden belly
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(-L * 1.1, -Hh * 1.1, L * 2.2, Hh * 2.2);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-L * 1.1, -Hh * 1.1, L * 2.2, Hh * 0.88);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-L * 1.1, Hh * 0.25, L * 2.2, Hh);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, L, Hh, 0, 0, TAU);
    ctx.stroke();

    // Sovereign Crown Crystal Crest
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(L * 0.14, -Hh * 0.82);
    ctx.lineTo(L * 0.22, -Hh * 1.32);
    ctx.lineTo(L * 0.34, -Hh * 0.98);
    ctx.lineTo(L * 0.46, -Hh * 1.36);
    ctx.lineTo(L * 0.56, -Hh * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    this.drawCartoonJaws(ctx, L * 0.72, Hh * 0.25, L * 0.38, Hh * 0.82, Math.max(0.36, snapT), 4);
    drawWeeblEyeCluster(ctx, L * 0.64, -Hh * 0.28, Hh * 0.42, { lookX: 0.45, mood: eyeMood, lineW: lw * 0.85 });
  }

  /* ------------------------------------------------ Screen-Edge Comic Threat Arrows */
  drawThreatRadar(ctx, p, ox, oy, sc, W, H) {
    if (p.sugarRush > 0) return;

    const vr = this.viewR();
    const margin = 24;

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
      const edgeY = clamp(oy + Math.sin(ang) * (H / 2 - margin), 192, H - 78);

      const proximity = 1.0 - clamp((d - vr * 0.45) / (vr * 1.1), 0, 1);
      const pulse = 1.0 + Math.sin(this.time * (7 + proximity * 10)) * 0.16;

      ctx.save();
      ctx.translate(edgeX, edgeY);
      ctx.rotate(ang);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-9, -10);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-9, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const distM = Math.max(1, Math.round(d / 18));
      drawComicText(ctx, `${distM}m`, edgeX, edgeY + 21, "900 11px 'Fredoka', Outfit, sans-serif", '#fef08a', { strokeWidth: 3 });
    }
  }

  /* ------------------------------------------------ Clutter-Free Weebl Comic HUD (Zero #hud or #adminDock overlap!) */
  drawDeepHUD(ctx, W, H, p) {
    const curStage = STAGES[this.stage];
    const nextStage = STAGES[Math.min(STAGES.length - 1, this.stage + 1)];
    const depthM = Math.max(0, Math.round(p.y / 10));
    const zone = this.getDepthZone(p.y);

    // 1. Top-Left Compact Evolution & Depth Comic Pill (`x=12, y=104, 240x48`) — clears CYCLE row above!
    drawComicPanel(ctx, 12, 104, 240, 48, 12, '#0f172a', { lineWidth: 3, shadowDx: 2.5, shadowDy: 3.5 });

    const tierLabel = this.isMaxSize()
      ? 'APEX MEGALODON · MAX'
      : `T${this.stage + 1} · ${curStage.n.toUpperCase()}`;
    drawComicText(
      ctx,
      tierLabel,
      22,
      119,
      "900 11.5px 'Fredoka', Outfit, sans-serif",
      this.isMaxSize() ? '#fde047' : '#4ade80',
      { align: 'left', strokeWidth: 2.8 }
    );

    // Inline evolution progress bar cleanly docked on right edge of card (`x=200..244`)
    if (!this.isMaxSize() && nextStage.s > curStage.s) {
      const evoFrac = clamp((p.size - curStage.s) / Math.max(1, nextStage.s - curStage.s), 0, 1);
      const gx = 200, gy = 113, gw = 42, gh = 10;
      ctx.fillStyle = '#020617';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.roundRect(gx + 1.5, gy + 1.5, Math.max(4, (gw - 3) * evoFrac), gh - 3, 4);
      ctx.fill();
    }

    drawComicText(
      ctx,
      `${depthM}m · ${zone.name}`,
      22,
      138,
      '800 10.5px Outfit, system-ui, sans-serif',
      zone.threatColor,
      { align: 'left', strokeWidth: 2.5 }
    );

    // 2. Top-Right Compact Comic Sonar Disc + Depth Bar (`x=W-80, y=114, 68x68`) — clears ★ PRESTIGE badge!
    const sx = W - 80;
    const sy = 114;
    drawComicPanel(ctx, sx, sy, 68, 68, 14, '#0f172a', { lineWidth: 3, shadowDx: 2.5, shadowDy: 3.5 });

    // Vertical 8-zone depth strip on left side of sonar pod
    const barX = sx + 8;
    const barY = sy + 9;
    const barHeight = 50;
    const barWidth = 7;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2;
    for (let k = 0; k < DEPTH_ZONES.length; k++) {
      const z = DEPTH_ZONES[k];
      const segY0 = (z.yMin / MAXY) * barHeight;
      const segY1 = (z.yMax / MAXY) * barHeight;
      ctx.fillStyle = z.threatColor;
      ctx.fillRect(barX, barY + segY0, barWidth, Math.max(2, segY1 - segY0));
    }
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    const pMarkerY = barY + clamp(p.y / MAXY, 0, 1) * barHeight;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(barX + barWidth / 2, pMarkerY, 4.2, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Circular comic sweep radar
    const cx = sx + 42;
    const cy = sy + 34;
    const cr = 19.5;
    ctx.fillStyle = '#064e3b';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, TAU);
    ctx.fill();
    ctx.stroke();

    const sweepAng = (this.time * 2.8) % TAU;
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAng) * cr, cy + Math.sin(sweepAng) * cr);
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, TAU);
    ctx.fill();
    ctx.stroke();

    const radarScale = cr / 1800;
    for (const f of this.fish) {
      if (f.size / p.size <= 1.08) continue;
      const fdx = (f.x - p.x) * radarScale;
      const fdy = (f.y - p.y) * radarScale;
      if (Math.hypot(fdx, fdy) < cr - 2) {
        ctx.fillStyle = f.isHunting ? '#ef4444' : '#fb7185';
        ctx.beginPath();
        ctx.arc(cx + fdx, cy + fdy, f.isHunting ? 2.8 : 2, 0, TAU);
        ctx.fill();
      }
    }
    for (const c of this.chests) {
      if (c.opened) continue;
      const cdx = (c.x - p.x) * radarScale;
      const cdy = (c.y - p.y) * radarScale;
      if (Math.hypot(cdx, cdy) < cr - 2) {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(cx + cdx, cy + cdy, 2.3, 0, TAU);
        ctx.fill();
      }
    }

    // 3. Bottom-Right ⚡ BUBBLE DASH / 🔥 SUGAR RUSH Pill (`W-152, H-64`, clears #adminDock on bottom-left!)
    const dashW = 138;
    const dashH = 44;
    const dx = W - dashW - 14;
    const dy = H - dashH - 18;
    drawComicPanel(ctx, dx, dy, dashW, dashH, 12, p.sugarRush > 0 ? '#701a75' : '#0f172a', {
      lineWidth: 3,
      shadowDx: 2.5,
      shadowDy: 3.5,
    });

    if (p.sugarRush > 0) {
      drawComicText(ctx, `🔥 SUGAR RUSH ${p.sugarRush.toFixed(1)}s`, dx + dashW / 2, dy + 13, "900 10px 'Fredoka', Outfit, sans-serif", '#fde047', { strokeWidth: 2.8 });
      const rushFrac = clamp(p.sugarRush / 5.2, 0, 1);
      ctx.fillStyle = '#020617';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(dx + 10, dy + 23, dashW - 20, 12, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.roundRect(dx + 12, dy + 25, Math.max(8, (dashW - 24) * rushFrac), 8, 4);
      ctx.fill();
    } else {
      drawComicText(ctx, '⚡ BUBBLE DASH', dx + dashW / 2, dy + 13, "900 10px 'Fredoka', Outfit, sans-serif", '#bae6fd', { strokeWidth: 2.8 });
      ctx.fillStyle = '#020617';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(dx + 10, dy + 23, dashW - 20, 12, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.stamina > 0.25 ? '#38bdf8' : '#ef4444';
      ctx.beginPath();
      ctx.roundRect(dx + 12, dy + 25, Math.max(8, (dashW - 24) * clamp(p.stamina, 0, 1)), 8, 4);
      ctx.fill();
    }

    // 4. Apex Megalodon Crown Banner OR Zone Transition Alert (`y = 190` — clear of Sonar!)
    if (this.isMaxSize()) {
      const vSec = Math.max(0, Math.ceil(this.victoryTimer));
      drawComicPanel(ctx, W / 2 - 140, 190, 280, 46, 12, '#facc15', { lineWidth: 3 });
      drawComicText(ctx, '👑 APEX MEGALODON!', W / 2, 206, "900 13px 'Fredoka', Outfit, sans-serif", '#ffffff', { strokeWidth: 3.4 });
      drawComicText(ctx, vSec > 0 ? `OCEAN DOMINATED · VICTORY IN ${vSec}s` : 'VICTORY!', W / 2, 223, '900 10px Outfit, sans-serif', '#fef9c3', { strokeWidth: 2.8 });
    } else if (this.zoneAlert && this.zoneAlert.timer > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.zoneAlert.timer / 0.7, 0, 1) * clamp((3.2 - this.zoneAlert.timer) / 0.45, 0, 1);
      drawComicPanel(ctx, W / 2 - 144, 190, 288, 46, 12, '#0f172a', { lineWidth: 3 });
      drawComicText(ctx, `ENTERING · ${this.zoneAlert.threat}`, W / 2, 205, '900 10px Outfit, sans-serif', this.zoneAlert.color, { strokeWidth: 2.8 });
      drawComicText(ctx, this.zoneAlert.name.toUpperCase(), W / 2, 223, "900 13px 'Fredoka', Outfit, sans-serif", '#ffffff', { strokeWidth: 3.2 });
      ctx.restore();
    }
  }

  rr(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
}
