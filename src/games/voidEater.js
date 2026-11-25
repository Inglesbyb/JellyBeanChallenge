import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import {
  STYLE_TOKENS,
  preloadWeeblAtlas,
  drawSprite,
  drawComicPanel,
  drawComicStarburst,
  drawComicText,
  drawWeeblCelBean,
  drawHeroCharacter,
} from './weeblAtlas.js';

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

// Colossal 100X Scale Arena: 18,000 x 18,000 px!
const WORLD = 18000;
const CHUNK_SIZE = 600;
const CHUNKS_ACROSS = WORLD / CHUNK_SIZE; // 30 x 30 = 900 chunks
const TAU = Math.PI * 2;

// 12-Tier Epic Progression from Micro Debris to Cosmic Singularity (Max Size)
export const TIERS = [
  { level: 1,  req: 16,   name: 'Micro Hole',        desc: 'Sweets, Litter, Cones, Birds' },
  { level: 2,  req: 24,   name: 'Sidewalk Maw',      desc: 'Phone Boxes, Benches, Pedestrians' },
  { level: 3,  req: 38,   name: 'Alley Eater',       desc: 'Taxis, Double-Deckers, Anchors' },
  { level: 4,  req: 60,   name: 'Quayside Devourer', desc: 'Statues, Fountains, Banana-Beans' },
  { level: 5,  req: 95,   name: 'Townhouse Scourge', desc: 'Georgian Terraces, Cavern Clubs' },
  { level: 6,  req: 150,  name: 'Dockland Consumer', desc: 'Palm Houses, Albert Warehouses' },
  { level: 7,  req: 230,  name: 'Waterfront Titan',  desc: 'St. Jelly Hall, Clock Towers' },
  { level: 8,  req: 340,  name: 'Cathedral Void',    desc: 'Cathedral Spires, Liver Building' },
  { level: 9,  req: 480,  name: 'District Colossus', desc: 'Dock Basins, Stadiums, Wheels' },
  { level: 10, req: 660,  name: 'Metropolis Leviathan',desc: 'Entire Avenues & Pier Quays' },
  { level: 11, req: 850,  name: 'Continental Maw',   desc: 'Multiple Historic Quarters' },
  { level: 12, req: 1000, name: 'Cosmic Singularity',desc: 'ENTIRE CITY CONQUERED (MAX SIZE)' },
];

const PROP_DEFS = {
  // Tier 1 (3-8): Micro street debris, sidewalk candy drops & litter (EASY FOR TIER 1 TO EAT!)
  sugarDrop:      { size: 4,   pts: 3,   minTier: 1 },
  sweetWrapper:   { size: 4,   pts: 2,   minTier: 1 },
  coffeeCup:      { size: 4,   pts: 3,   minTier: 1 },
  sodaCan:        { size: 5,   pts: 4,   minTier: 1 },
  pigeon:         { size: 6,   pts: 5,   minTier: 1 },
  flowerPot:      { size: 6,   pts: 6,   minTier: 1 },
  cone:           { size: 6,   pts: 4,   minTier: 1 },
  hydrant:        { size: 7,   pts: 6,   minTier: 1 },
  bollard:        { size: 7,   pts: 6,   minTier: 1 },
  streetSign:     { size: 8,   pts: 8,   minTier: 1 },
  trash:          { size: 8,   pts: 7,   minTier: 1 },
  // Tier 2 (9-15): Sidewalk furniture & Heritage British streetscapes
  ped:            { size: 9,   pts: 12,  minTier: 2 },
  mailbox:        { size: 10,  pts: 14,  minTier: 2 },
  redPhoneBox:    { size: 11,  pts: 16,  minTier: 2 },
  barrel:         { size: 11,  pts: 15,  minTier: 2 },
  bench:          { size: 12,  pts: 18,  minTier: 2 },
  lamp:           { size: 14,  pts: 20,  minTier: 2 },
  // Tier 3 (16-28): Vehicles, Public Art & Docks
  bush:           { size: 16,  pts: 24,  minTier: 3 },
  tree:           { size: 24,  pts: 55,  minTier: 3 },
  car:            { size: 20,  pts: 40,  minTier: 3 },
  taxi:           { size: 21,  pts: 45,  minTier: 3 },
  anchorMonument: { size: 26,  pts: 65,  minTier: 3 },
  swingBridge:    { size: 28,  pts: 75,  minTier: 3 },
  // Tier 4 (30-55): Statues, Transit & Outbuildings
  superlambanana: { size: 36,  pts: 130, minTier: 4 },
  doubleDecker:   { size: 38,  pts: 140, minTier: 4 },
  fountain:       { size: 40,  pts: 160, minTier: 4 },
  shed:           { size: 32,  pts: 90,  minTier: 4 },
  truck:          { size: 34,  pts: 110, minTier: 4 },
  lionStatue:     { size: 36,  pts: 135, minTier: 4 },
  // Tier 5 (60-110): Heritage Architecture & Music Monuments
  beatleBeans:    { size: 54,  pts: 320, minTier: 5 },
  townhouse:      { size: 58,  pts: 350, minTier: 5 },
  cottage:        { size: 52,  pts: 250, minTier: 5 },
  cavernClub:     { size: 62,  pts: 420, minTier: 5 },
  donutShop:      { size: 56,  pts: 320, minTier: 5 },
  liverBeanStatue:{ size: 48,  pts: 280, minTier: 5 },
  // Tier 6 (120-200): Victorian Conservatories & Warehouses
  palmHouse:      { size: 95,  pts: 950, minTier: 6 },
  gasStation:     { size: 75,  pts: 600, minTier: 6 },
  apt:            { size: 82,  pts: 750, minTier: 6 },
  // Tier 7 (210-340): Albert Docks, Colonnades & Civic Halls
  albertDock:     { size: 140, pts: 2200,minTier: 7 },
  tower:          { size: 120, pts: 1500,minTier: 7 },
  warehouse:      { size: 125, pts: 1800,minTier: 7 },
  stJellyHall:    { size: 155, pts: 2800,minTier: 7 },
  // Tier 8 (350-500+): Liverpool Liver Building & Cathedrals
  liverBuilding:  { size: 220, pts: 5500,minTier: 8 },
  cathedral:      { size: 240, pts: 6500,minTier: 8 },
  metroCathedral: { size: 230, pts: 6000,minTier: 8 },
  sky:            { size: 180, pts: 4000,minTier: 8 },
  wheel:          { size: 260, pts: 9500,minTier: 9 },
  stadium:        { size: 270, pts: 11000,minTier: 9 },
  // High-voltage industrial hazards & magnetic void mines (requires size 160+ to consume)
  electricSubstation: { size: 30, pts: 2500, minTier: 7, isHazard: true },
  voidMine:           { size: 20, pts: 1800, minTier: 6, isHazard: true },
};

const EXTRUDED_PROP_KINDS = new Set([
  'trash', 'redPhoneBox', 'mailbox', 'lionStatue', 'cavernClub', 'shed',
  'cottage', 'gasStation', 'warehouse', 'townhouse', 'apt', 'albertDock',
  'stJellyHall', 'liverBuilding', 'cathedral', 'donutShop', 'tower', 'sky', 'stadium',
]);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function pseudoRandom(seed) {
  let s = Math.sin(seed) * 10000;
  return s - Math.floor(s);
}

function shadeHex(col, delta = -0.3) {
  let r = 35;
  let g = 40;
  let b = 66;
  if (col && col[0] === '#') {
    const raw = col.length === 4
      ? `${col[1]}${col[1]}${col[2]}${col[2]}${col[3]}${col[3]}`
      : col.slice(1, 7);
    const n = parseInt(raw, 16);
    if (!Number.isNaN(n)) {
      r = (n >> 16) & 255;
      g = (n >> 8) & 255;
      b = n & 255;
    }
  } else if (col && col.startsWith('rgb')) {
    const m = col.match(/\d+/g);
    if (m && m.length >= 3) {
      r = Number(m[0]);
      g = Number(m[1]);
      b = Number(m[2]);
    }
  }
  const pct = clamp(Math.abs(delta) > 1 ? delta / 100 : delta, -0.9, 0.9);
  const adj = (c) => (pct >= 0 ? Math.round(c + (255 - c) * pct) : Math.round(c * (1 + pct)));
  const hex2 = (c) => clamp(adj(c), 0, 255).toString(16).padStart(2, '0');
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

export class VoidEater extends Game {
  static meta = {
    id: 'void-eater',
    title: 'Void Eater',
    icon: '🌀',
    hint: 'DRAG to steer · ⚡ BOOST · swallow the city!',
    baseLikes: 1420,
    isPrestige: true,
    parScore60s: 1800,
    cue: 'SWALLOW THE CITY!',
    prestigeCue: 'FASTER RIVALS & VOID DECAY!',
    scaling: {
      rivalSpeedMult: { base: 1.0, rate: 0.16, cap: 1.45, mode: 'up', label: 'Rival Speed' },
      massScale:      { base: 1.0, rate: 0.16, cap: 1.70, mode: 'up', label: 'Mass Required' },
      idleDecay:      { base: 0.0, rate: 0.18, cap: 0.009, mode: 'up', deltaFormat: 'abs', label: 'Idle Shrink' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    preloadWeeblAtlas();
    this.score = score;
    // Prestige rank (1 = first playthrough). Set by Reel.js before init().
    this.pLevel = Math.max(1, this.prestige || 1);
    this.sinceEat = 0;
    this.hole = { x: WORLD / 2, y: WORLD / 2, r: 16, vx: 0, vy: 0, pulse: 0 };
    this.zoom = 1.35;
    this.sfxT = 0;
    this.hapT = 0;
    this.clashT = 0;
    this.dangerT = 0;
    this.dangerIntensity = 0;
    this.closestHunter = null;
    this.beanSquash = 1;
    this.lastTier = this.getTier().level;
    this.victoryTimer = 0;
    this.maxSizeCelebrated = false;
    this.eatTextCooldown = 0;
    this.batchPts = 0;
    this.gulpCooldown = 0;
    this.ringCooldown = 0;
    this.shockCooldown = 0;
    this.boosting = false;
    this.boostHapT = 0;
    this.rimThreatPull = 0;

    this.chunks = new Map();
    this.eatenProps = new Set();
    this.activeProps = [];
    this.fallingProps = new Set();
    this.respawnQueue = [];

    if (saved) {
      this.hole.x = Number.isFinite(saved.x) ? saved.x : WORLD / 2;
      this.hole.y = Number.isFinite(saved.y) ? saved.y : WORLD / 2;
      this.hole.r = Number.isFinite(saved.r) && saved.r >= 16 ? saved.r : 16;
      this.lastTier = this.getTier().level;
      if (Array.isArray(saved.eaten)) {
        for (const id of saved.eaten) this.eatenProps.add(id);
      }
      this.grace = 1.5;
    } else {
      this.grace = 1.0;
    }

    // 5 Named Legendary Liverpool District Bosses (Aggressive Apex Predators!)
    const districtBosses = [
      { name: 'Mersey Kraken',      col: '#00f5d4', x: 2200,  y: 4500,  baseR: 52, boss: true, title: '👑 Waterfront Terror' },
      { name: 'Cathedral Behemoth', col: '#9b5de5', x: 4200,  y: 13500, baseR: 49, boss: true, title: '👑 Georgian Monarch' },
      { name: 'Colosseum Overlord', col: '#ff0054', x: 13500, y: 13500, baseR: 56, boss: true, title: '👑 Anfield Titan' },
      { name: 'The Pier Head Titan',col: '#ffbe0b', x: 2800,  y: 8000,  baseR: 46, boss: true, title: '👑 Strand Leviathan' },
      { name: 'Cavern Ripper',      col: '#f72585', x: 11000, y: 3500,  baseR: 43, boss: true, title: '👑 Mathew St Stalker' },
    ];

    // 10x10 Grid Roaming Rival Holes across the city + Center-District Swarm Bots
    const prefixes = ['Apex', 'Shadow', 'Turbo', 'Gummy', 'Vortex', 'Chomp', 'Gulp', 'Titan', 'Cosmic', 'Abyss', 'Neon', 'Sugar', 'Savage', 'Brutal', 'Vicious'];
    const suffixes = ['Hunter', 'Maw', 'Reaper', 'Beast', 'Mayor', 'Demon', 'Fiend', 'King', 'Crusher', 'Swallow', 'Phantom', 'Horror', 'Void', 'Slayer'];
    const rivalColors = ['#ff4b5c', '#ffd166', '#06d6a0', '#ff70a6', '#4cc9f0', '#9b5de5', '#f15bb5', '#ffbe0b', '#e71d36', '#ff9f1c', '#2ec4b6', '#00f5d4', '#e63946'];

    const rivalRoster = [...districtBosses];
    let rIdx = 0;
    for (let gy = 0; gy < 10; gy++) {
      for (let gx = 0; gx < 10; gx++) {
        const x = 1100 + gx * 1750 + (pseudoRandom(rIdx * 11) - 0.5) * 650;
        const y = 1100 + gy * 1750 + (pseudoRandom(rIdx * 13) - 0.5) * 650;
        if (Math.hypot(x - WORLD / 2, y - WORLD / 2) < 480) continue;
        const name = `${prefixes[rIdx % prefixes.length]}${suffixes[(rIdx * 3) % suffixes.length]}`;
        const scale = 0.85 + pseudoRandom(rIdx * 17) * 0.95;
        rivalRoster.push({
          name,
          col: rivalColors[rIdx % rivalColors.length],
          x, y,
          scale,
          boss: false,
          title: 'Rival Void',
        });
        rIdx++;
      }
    }

    // 12 Central Sector Bots so early-game action has constant rivals & threats
    for (let s = 0; s < 12; s++) {
      const ang = (s / 12) * TAU + 0.25;
      const dist = 560 + (s % 3) * 420 + pseudoRandom(900 + s) * 180;
      const x = WORLD / 2 + Math.cos(ang) * dist;
      const y = WORLD / 2 + Math.sin(ang) * dist;
      const name = `${prefixes[(s + 5) % prefixes.length]}${suffixes[(s * 5) % suffixes.length]}`;
      const scale = 0.8 + pseudoRandom(700 + s) * 0.85;
      rivalRoster.push({
        name,
        col: rivalColors[(s + 2) % rivalColors.length],
        x, y,
        scale,
        boss: false,
        title: 'Sector Stalker',
      });
    }

    this.rivals = rivalRoster.map((d) => ({
      name: d.name,
      title: d.title,
      color: d.col,
      boss: d.boss,
      homeX: d.x,
      homeY: d.y,
      x: clamp(d.x, 300, WORLD - 300),
      y: clamp(d.y, 300, WORLD - 300),
      r: d.boss ? d.baseR : clamp(this.hole.r * d.scale, 18, 2400),
      vx: 0, vy: 0,
      dead: false,
      respawn: 0,
      frenzyT: 0,
      feedTarget: null,
      feedT: 0,
      wander: { x: d.x, y: d.y, t: 0 },
      surgeCooldown: 3.5 + Math.random() * 4.0,
      telegraphT: 0,
      surging: false,
      surgeT: 0,
      exhaustionT: 0,
    }));

    this.updateActiveProps();
    this.zoom = this.targetZoom();
  }

  serialize() {
    const h = this.hole;
    return {
      x: Math.round(h.x),
      y: Math.round(h.y),
      r: +h.r.toFixed(1),
      eaten: Array.from(this.eatenProps).slice(-3000),
    };
  }

  restoreLabel() {
    const t = this.getTier();
    return `size ${Math.round(this.hole.r)} (${t.name})`;
  }

  isMaxSize() {
    return this.hole.r >= 1000;
  }

  getTier() {
    const r = this.hole.r;
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (r >= TIERS[i].req) return TIERS[i];
    }
    return TIERS[0];
  }

  targetZoom() {
    // Clamped zoom prevents rendering the entire 18,000px city map at once!
    return clamp(45 / (this.hole.r + 18), 0.16, 1.4);
  }

  /* --------------------------------------------------- Sunlight Weebl Liverpool District Engine */
  getDistrictInfo(x, y) {
    // Center Spawn Intersection & Starter Snack Square (`WORLD / 2 = 9000, 9000`)
    if (x >= 8400 && x < 10200 && y >= 8400 && y < 10200) {
      return {
        id: 'starterCore',
        name: '🍩 Candy Crosswalk & Civic Corner',
        turf: '#22c55e',
        street: '#475569',
        starterCore: true,
        desc: 'Sunlit crossings, frosted Donut shops & vibrant Weebl blocks',
      };
    }
    if (x < 2400) {
      return {
        id: 'docks',
        name: '⚓ Royal Albert Dock & Maritime Basins',
        turf: '#38bdf8',
        street: '#64748b',
        cobble: true,
        desc: 'Turquoise harbor basins, brick warehouses & waterfront swing bridges',
      };
    }
    if (x >= 2400 && x < 4500 && y < 9000) {
      return {
        id: 'strand',
        name: '🏛️ Pier Head & The Strand Grand Arterial Boulevard',
        turf: '#4ade80',
        street: '#475569',
        broadAvenue: true,
        desc: 'Liver Building towers, cream stone esplanades & 8-lane boulevard',
      };
    }
    if (x >= 4500 && x < 8500 && y < 8500) {
      return {
        id: 'civic',
        name: '🏛️ St. George\'s Neoclassical Plateau & Lime Street',
        turf: '#fef3c7',
        street: '#64748b',
        stonePlaza: true,
        desc: 'Sunny sandstone terraces, lion statues & St. Jelly Hall',
      };
    }
    if (x >= 8500 && x < 13500 && y < 8000) {
      return {
        id: 'cavern',
        name: '🎸 The Cavern Quarter & Mathew Street Alleys',
        turf: '#fed7aa',
        street: '#64748b',
        tightAlleys: true,
        desc: 'Brick pedestrian alleys, Donut corners & cheerful music cafés',
      };
    }
    if (x >= 13500 && y < 7500) {
      return {
        id: 'theme',
        name: '🎡 Gummy Land & Pier Fairgrounds',
        turf: '#4ade80',
        street: '#475569',
        carnival: true,
        desc: 'Giant Ferris wheel, pastel boardwalks & candy stands',
      };
    }
    if (y >= 8500 && x < 8500) {
      return {
        id: 'georgian',
        name: '🌹 Georgian Quarter, Falkner Square & Hope St Axis',
        turf: '#22c55e',
        street: '#475569',
        gardenSquare: true,
        desc: 'Circular park squares, Palm House domes & twin Cathedrals',
      };
    }
    if (y >= 8000 && x >= 8500) {
      return {
        id: 'stadium',
        name: '🏟️ Stanley Park Boating Lakes & Anfield Colosseum',
        turf: '#4ade80',
        street: '#475569',
        parkLakes: true,
        desc: 'Curving blue lakes, brick bridges & football stadium forecourt',
      };
    }
    return {
      id: 'metro',
      name: '🏙️ Commercial Core & Radial Boulevards',
      turf: '#22c55e',
      street: '#475569',
      diagonal: true,
      desc: 'Crisp sunlit intersections, townhouses & bustling shops',
    };
  }

  /* --------------------------------------------------- Liverpool-Inspired Procedural Chunks */
  getChunkProps(cx, cy) {
    const key = `${cx},${cy}`;
    if (this.chunks.has(key)) return this.chunks.get(key);

    const props = [];
    const seed = cx * 73856093 ^ cy * 19349663;
    const wx = cx * CHUNK_SIZE;
    const wy = cy * CHUNK_SIZE;

    const dist = this.getDistrictInfo(wx + CHUNK_SIZE / 2, wy + CHUNK_SIZE / 2);

    const addProp = (kind, x, y, rot = 0, colOverride = null) => {
      const id = `${key}_${kind}_${Math.round(x)}_${Math.round(y)}`;
      if (this.eatenProps.has(id)) return;
      const def = PROP_DEFS[kind];
      if (!def) return;
      props.push({
        id, kind, size: def.size, pts: def.pts,
        x, y, origX: x, origY: y, rot,
        col: colOverride || pickColor(kind, seed + props.length * 17),
        fall: 0, owner: null, dead: false,
        vx: (kind === 'ped' || kind === 'pigeon') ? (pseudoRandom(seed + props.length) - 0.5) * 32 : 0,
        vy: (kind === 'ped' || kind === 'pigeon') ? (pseudoRandom(seed + props.length + 1) - 0.5) * 32 : 0,
        animT: pseudoRandom(seed + props.length) * 10,
      });
    };

    // =========================================================================
    // 🍬 ABUNDANT TIER 1 MICRO-EDIBLES IN EVERY CHUNK! (Bite-sized sweets & litter)
    // =========================================================================
    // Continuous trails of candy gems, crinkled wrappers, and soda cans along sidewalks
    [90, 140, 190, 240, 290, 340, 390, 440, 490, 540].forEach((ox, i) => {
      const kind = i % 3 === 0 ? 'sugarDrop' : i % 3 === 1 ? 'sweetWrapper' : 'sodaCan';
      addProp(kind, wx + ox, wy + 96);
    });
    [140, 200, 260, 320, 380, 440, 500].forEach((oy, i) => {
      const kind = i % 2 === 0 ? 'sugarDrop' : 'coffeeCup';
      addProp(kind, wx + 96, wy + oy);
    });

    // Dense 2.5D jellybean candy clusters near street corners for instant vacuum satisfaction
    const clusterX = wx + 132 + (cx % 2) * 320;
    const clusterY = wy + 132 + (cy % 2) * 300;
    for (let jb = 0; jb < 7; jb++) {
      const a = (jb / 7) * TAU;
      const distJb = jb === 0 ? 0 : 14 + (jb % 2) * 8;
      addProp('sugarDrop', clusterX + Math.cos(a) * distJb, clusterY + Math.sin(a) * distJb, a);
    }

    // Pigeons and seagulls hopping around searching for crumbs!
    addProp('pigeon', wx + 175, wy + 165);
    addProp('pigeon', wx + 380, wy + 210);
    addProp('pigeon', wx + 290, wy + 420);
    addProp('pigeon', wx + 480, wy + 160);

    // Terracotta flower pots with blooming petals
    addProp('flowerPot', wx + 115, wy + 115);
    addProp('flowerPot', wx + 225, wy + 115);
    addProp('flowerPot', wx + 385, wy + 115);
    addProp('flowerPot', wx + 485, wy + 115);

    // Street lollipop signs and parking meters
    addProp('streetSign', wx + 78, wy + 115);
    addProp('streetSign', wx + 115, wy + 78);

    // Standard street furniture
    addProp('hydrant', wx + 85, wy + 85, 0, '#ff4b5c');
    addProp('cone', wx + 95, wy + 140, 0, '#ff8a3d');
    addProp('cone', wx + 140, wy + 95, 0, '#ff8a3d');
    addProp('trash', wx + 130, wy + 230, 0, '#4a4e69');

    // Strategic High-Voltage & Void Mine Hazards
    if ((cx + cy) % 2 === 0) {
      addProp('electricSubstation', wx + 440, wy + 210, 0, '#ffd166');
    }
    if ((cx * 3 + cy) % 4 === 0) {
      addProp('voidMine', wx + 200, wy + 390, 0, '#ff0054');
    }

    // =========================================================================
    // 🏛️ DISTRICT SPECIFIC LANDMARKS & HIGHER TIER PROPS
    // =========================================================================
    if (dist.id === 'starterCore') {
      // Vivid Weebl Opening Street Block right around spawn (9000, 9000)
      addProp('donutShop', wx + 420, wy + 400, 0);
      addProp('superlambanana', wx + 225, wy + 250, 0, '#facc15');
      addProp('townhouse', wx + 225, wy + 455, 0, '#ef4444');
      addProp('redPhoneBox', wx + 130, wy + 150, 0, '#ef4444');
      addProp('mailbox', wx + 490, wy + 150, 0, '#ef4444');
      addProp('tree', wx + 170, wy + 340, 0, '#22c55e');
      addProp('tree', wx + 470, wy + 220, 0, '#22c55e');
      addProp('doubleDecker', wx + 260, wy + 48, 0, '#ef4444');
      addProp('taxi', wx + 430, wy + 48, 0, '#facc15');
      addProp('car', wx + 48, wy + 290, Math.PI / 2, '#38bdf8');
      addProp('bench', wx + 320, wy + 150, 0);
      addProp('ped', wx + 185, wy + 145, 0);
      addProp('ped', wx + 350, wy + 475, 0);
      addProp('ped', wx + 480, wy + 300, 0);
    } else if (dist.id === 'docks') {
      // Royal Albert Dock Basin Quayside
      addProp('anchorMonument', wx + 280, wy + 200, 0, '#1c1b24');
      addProp('albertDock', wx + 480, wy + 300, 0, '#8b263e');
      addProp('warehouse', wx + 180, wy + 480, 0, '#6c584c');
      addProp('swingBridge', wx + 380, wy + 80, Math.PI / 2);
      [140, 220, 300, 380, 460].forEach((ox) => {
        addProp('bollard', wx + ox, wy + 115, 0, '#1e293b');
      });
      addProp('ped', wx + 200, wy + 130, 0);
      addProp('ped', wx + 360, wy + 130, 0);

    } else if (dist.id === 'strand') {
      // The Strand 8-Lane Boulevard & Pier Head
      addProp('liverBuilding', wx + 380, wy + 340, 0, '#4a5759');
      addProp('doubleDecker', wx + 240, wy + 80, 0, '#d90429');
      addProp('taxi', wx + 420, wy + 80, 0, '#1e293b');
      addProp('redPhoneBox', wx + 120, wy + 140, 0, '#e63946');
      addProp('mailbox', wx + 150, wy + 140, 0, '#e63946');
      addProp('superlambanana', wx + 220, wy + 460, 0, '#ffd60a');
      [160, 320, 480].forEach((ox) => {
        addProp('lamp', wx + ox, wy + 140, 0, '#ffd166');
      });
      addProp('ped', wx + 190, wy + 140, 0);
      addProp('ped', wx + 360, wy + 140, 0);

    } else if (dist.id === 'civic') {
      // St. George's Plateau Neoclassical Cultural Shelf
      addProp('stJellyHall', wx + 340, wy + 300, 0, '#d6ccc2');
      addProp('fountain', wx + 180, wy + 460, 0);
      addProp('lionStatue', wx + 140, wy + 260, 0, '#c9ada7');
      addProp('lionStatue', wx + 540, wy + 260, 0, '#c9ada7');
      addProp('liverBeanStatue', wx + 480, wy + 460, 0, '#ffd166');
      addProp('bench', wx + 260, wy + 460, 0, '#8b5a2b');
      addProp('ped', wx + 280, wy + 380, 0);
      addProp('ped', wx + 420, wy + 380, 0);

    } else if (dist.id === 'cavern') {
      // Mathew Street / Cavern Alleys
      addProp('cavernClub', wx + 240, wy + 240, 0, '#8d0801');
      addProp('beatleBeans', wx + 460, wy + 240, 0, '#b08968');
      addProp('barrel', wx + 140, wy + 160, 0, '#7f4f24');
      addProp('barrel', wx + 160, wy + 160, 0, '#7f4f24');
      addProp('townhouse', wx + 240, wy + 480, 0, '#9c6644');
      addProp('townhouse', wx + 480, wy + 480, 0, '#7f4f24');
      addProp('redPhoneBox', wx + 360, wy + 160, 0, '#e63946');
      addProp('ped', wx + 300, wy + 300, 0);
      addProp('ped', wx + 380, wy + 320, 0);
      addProp('ped', wx + 220, wy + 380, 0);

    } else if (dist.id === 'georgian') {
      // Georgian Quarter & Falkner Square Garden
      if (cx % 2 === 0 && cy % 2 === 0) {
        addProp('fountain', wx + 300, wy + 300, 0);
        addProp('palmHouse', wx + 460, wy + 460, 0, '#52b788');
        addProp('tree', wx + 200, wy + 200, 0, '#2d6a4f');
        addProp('tree', wx + 400, wy + 200, 0, '#2d6a4f');
        addProp('tree', wx + 200, wy + 400, 0, '#2d6a4f');
        addProp('bench', wx + 300, wy + 220, 0);
        addProp('bench', wx + 300, wy + 380, 0);
      } else if (cy % 3 === 0) {
        const cathKind = cx % 2 === 0 ? 'cathedral' : 'metroCathedral';
        addProp(cathKind, wx + 320, wy + 320, 0, '#495057');
        addProp('superlambanana', wx + 180, wy + 460, 0, '#ffd60a');
        addProp('tree', wx + 480, wy + 460, 0, '#2d6a4f');
      } else {
        addProp('townhouse', wx + 220, wy + 220, 0, '#a26769');
        addProp('townhouse', wx + 440, wy + 220, 0, '#b2533e');
        addProp('townhouse', wx + 220, wy + 440, 0, '#6d4c41');
        addProp('townhouse', wx + 440, wy + 440, 0, '#8b263e');
        addProp('redPhoneBox', wx + 120, wy + 140, 0, '#e63946');
      }
      addProp('ped', wx + 160, wy + 130, 0);

    } else if (dist.id === 'stadium') {
      // Anfield Colosseum & Stanley Boating Lakes
      if (cx % 2 === 0 && cy % 2 === 0) {
        addProp('stadium', wx + 350, wy + 350, 0, '#d90429');
        addProp('truck', wx + 180, wy + 160, 0);
        addProp('doubleDecker', wx + 480, wy + 160, 0, '#d90429');
      } else {
        addProp('tree', wx + 240, wy + 240, 0, '#1b4332');
        addProp('tree', wx + 460, wy + 240, 0, '#2d6a4f');
        addProp('fountain', wx + 350, wy + 350, 0);
        addProp('car', wx + 220, wy + 140, 0);
        addProp('car', wx + 420, wy + 140, 0);
      }
      addProp('ped', wx + 200, wy + 300, 0);
      addProp('ped', wx + 380, wy + 300, 0);

    } else if (dist.id === 'theme') {
      addProp('wheel', wx + 350, wy + 350, 0, '#ff0054');
      addProp('donutShop', wx + 200, wy + 200, 0);
      addProp('fountain', wx + 480, wy + 200, 0);
      addProp('ped', wx + 240, wy + 280, 0);
      addProp('ped', wx + 320, wy + 280, 0);

    } else {
      addProp('tower', wx + 240, wy + 240, 0);
      addProp('sky', wx + 460, wy + 350, 0);
      addProp('apt', wx + 240, wy + 460, 0);
      addProp('taxi', wx + 290, wy + 60, 0, '#1e293b');
      addProp('doubleDecker', wx + 420, wy + 60, 0, '#d90429');
      addProp('ped', wx + 200, wy + 140, 0);
    }

    this.chunks.set(key, props);
    return props;
  }

  updateActiveProps() {
    const h = this.hole;
    // Strictly cull to screen viewport + 120px margin, preventing processing 30,000 off-screen props!
    const halfW = (this.W / 2 + 120) / this.zoom;
    const halfH = (this.H / 2 + 120) / this.zoom;
    const minX = h.x - halfW;
    const maxX = h.x + halfW;
    const minY = h.y - halfH;
    const maxY = h.y + halfH;

    const minCX = Math.max(0, Math.floor(minX / CHUNK_SIZE));
    const maxCX = Math.min(CHUNKS_ACROSS - 1, Math.floor(maxX / CHUNK_SIZE));
    const minCY = Math.max(0, Math.floor(minY / CHUNK_SIZE));
    const maxCY = Math.min(CHUNKS_ACROSS - 1, Math.floor(maxY / CHUNK_SIZE));

    const active = [];
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const cp = this.getChunkProps(cx, cy);
        for (let i = 0; i < cp.length; i++) {
          const p = cp[i];
          if (!p.dead && p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
            active.push(p);
          }
        }
      }
    }
    this.activeProps = active;
  }

  /* ----------------------------------------------------------- Growth & Absorption */
  growHole(h, propSize) {
    const isPlayer = h === this.hole;
    const efficiency = propSize / Math.max(8, h.r * 0.85);
    const scaling = Math.min(1.4, Math.max(0.25, efficiency));
    // Slower player growth makes climbing tiers a multi-stage battle while bots stay competitive
    const mult = isPlayer ? 1.1 : 0.9;
    // Bounded Prestige mass scale from SSOT meta.scaling
    const massScale = this.diff.massScale ?? 1;
    const rate = (propSize * mult * scaling) / ((1 + Math.sqrt(h.r) * 0.22) * (isPlayer ? massScale : 1));
    h.r = Math.min(1000, h.r + rate);
    if (isPlayer) this.sinceEat = 0;
  }

  triggerHazardShock(h, p, d) {
    if (this.grace > 0 || this.shockCooldown > 0) return;
    this.shockCooldown = 0.6;

    // Repel violently away from hazard
    const dx = h.x - p.x;
    const dy = h.y - p.y;
    const len = d || 1;
    h.vx = (dx / len) * 320;
    h.vy = (dy / len) * 320;

    // Penalty: shave radius and points
    const loss = Math.max(3.5, h.r * 0.07);
    h.r = Math.max(16, h.r - loss);
    this.score = Math.max(0, this.score - 100);

    const k = 1 / this.zoom;
    this.fx.shake(9, 0.35);
    this.fx.burst(h.x, h.y, '#ffd166', 16, 200 * k, 0.6, 4);
    this.fx.burst(p.x, p.y, '#ff0054', 16, 180 * k, 0.5, 3.5);
    this.fx.ring(p.x, p.y, '#ff0054', p.size * 2.2, 0.45, 4);
    this.fx.text(h.x, h.y - h.r - 28 * k, `⚡ OVERLOAD! -${Math.round(loss)} SIZE`, '#ff0054', 24, 1.4);

    this.sounds.hit();
    this.haptics.heavy();
  }

  absorb(h, dt) {
    const isPlayer = h === this.hole;
    const reach = h.r * 1.55;
    // Query only chunks within suction reach, maintaining lightning-fast 60 FPS!
    const minCX = Math.max(0, Math.floor((h.x - reach) / CHUNK_SIZE));
    const maxCX = Math.min(CHUNKS_ACROSS - 1, Math.floor((h.x + reach) / CHUNK_SIZE));
    const minCY = Math.max(0, Math.floor((h.y - reach) / CHUNK_SIZE));
    const maxCY = Math.min(CHUNKS_ACROSS - 1, Math.floor((h.y + reach) / CHUNK_SIZE));

    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const cp = this.getChunkProps(cx, cy);
        for (let i = 0; i < cp.length; i++) {
          const p = cp[i];
          if (p.fall > 0 || p.dead) continue;

          // Check for Hazard Collision with player hole
          if (p.isHazard && isPlayer) {
            const hDist = Math.hypot(h.x - p.x, h.y - p.y);
            if (h.r < 160) {
              // Too small to absorb: ELECTRICAL/EXPLOSIVE HAZARD OVERLOAD!
              if (hDist < h.r + p.size * 0.75) {
                this.triggerHazardShock(h, p, hDist);
              }
              continue;
            }
          }

          if (p.size > h.r * 0.85) continue;

          const dx = h.x - p.x;
          const dy = h.y - p.y;
          const d = Math.hypot(dx, dy);

          if (d < reach && d > 0.1) {
            const pull = (70 + h.r * 0.4) * dt;
            p.x += (dx / d) * pull;
            p.y += (dy / d) * pull;
            p.sucking = true;
            p.pullAng = Math.atan2(dy, dx);
          }

          if (d < h.r - p.size * 0.3) {
            p.fall = 0.001;
            p.owner = h;
            p.pullAng = Math.atan2(h.y - p.y, h.x - p.x);
            this.fallingProps.add(p);
          }
        }
      }
    }
  }

  absorbRival(rv, dt) {
    if (rv.dead) return;
    if (Math.hypot(rv.x - this.hole.x, rv.y - this.hole.y) > 4500) return;
    const rReach = rv.r * 1.55;
    const minCX = Math.max(0, Math.floor((rv.x - rReach) / CHUNK_SIZE));
    const maxCX = Math.min(CHUNKS_ACROSS - 1, Math.floor((rv.x + rReach) / CHUNK_SIZE));
    const minCY = Math.max(0, Math.floor((rv.y - rReach) / CHUNK_SIZE));
    const maxCY = Math.min(CHUNKS_ACROSS - 1, Math.floor((rv.y + rReach) / CHUNK_SIZE));

    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const cp = this.getChunkProps(cx, cy);
        for (let i = 0; i < cp.length; i++) {
          const p = cp[i];
          if (p.fall > 0 || p.dead) continue;
          if (p.size > rv.r * 0.85) continue;

          const dx = rv.x - p.x;
          const dy = rv.y - p.y;
          const d = Math.hypot(dx, dy);

          if (d < rReach && d > 0.1) {
            const pull = (65 + rv.r * 0.5) * dt;
            p.x += (dx / d) * pull;
            p.y += (dy / d) * pull;
          }

          if (d < rv.r - p.size * 0.3) {
            p.fall = 0.001;
            p.owner = rv;
            p.pullAng = Math.atan2(rv.y - p.y, rv.x - p.x);
            this.fallingProps.add(p);
          }
        }
      }
    }
  }

  update(dt) {
    const h = this.hole;
    this.shockCooldown = Math.max(0, this.shockCooldown - dt);
    this.ringCooldown = Math.max(0, this.ringCooldown - dt);

    // Boost Controls: on-screen boost button OR keyboard Space / Shift / E / W
    const boostBtnX = this.W - 46;
    const boostBtnY = this.H - 118;
    const boostRadius = 34;
    const touchBoost = this.input.down && Math.hypot(this.input.x - boostBtnX, this.input.y - boostBtnY) < boostRadius;
    const keyBoost = this.input.key(' ', 'shift', 'e', 'w');
    this.boosting = (touchBoost || keyBoost) && h.r > 16.5;

    if (this.boosting) {
      // Cost: burns mass at 3.2 radius per second
      h.r = Math.max(16, h.r - dt * 3.2);
      this.boostHapT -= dt;
      if (this.boostHapT <= 0) {
        this.haptics.light();
        this.boostHapT = 0.16;
      }
      // Boost Jetstream particles
      if (Math.random() < 0.55) {
        const k = 1 / this.zoom;
        const ang = Math.atan2(h.vy, h.vx) + Math.PI + (Math.random() - 0.5) * 0.8;
        this.fx.burst(h.x + Math.cos(ang) * h.r * 0.75, h.y + Math.sin(ang) * h.r * 0.75, '#25e6ff', 1, 60 * k, 0.22, 2.5);
      }
    }

    // Dynamic mass momentum: nimble when small, massive and crushing when huge
    const baseSp = Math.max(95, 145 - (h.r - 16) * 0.045);
    const boostMult = this.boosting && h.r > 16.5 ? 1.65 : 1.0;
    const sp = baseSp * boostMult;

    const v = this.input.vec(55);
    const k = Math.min(1, dt * 10);
    h.vx += (v.x * sp - h.vx) * k;
    h.vy += (v.y * sp - h.vy) * k;
    h.x = clamp(h.x + h.vx * dt, 40, WORLD - 40);
    h.y = clamp(h.y + h.vy * dt, 40, WORLD - 40);

    this.zoom += (this.targetZoom() - this.zoom) * Math.min(1, dt * 2.5);
    this.sfxT -= dt;
    this.hapT -= dt;
    this.clashT -= dt;
    this.dangerT -= dt;
    this.eatTextCooldown -= dt;
    this.gulpCooldown -= dt;
    if (this.grace > 0) this.grace = Math.max(0, this.grace - dt);

    // Flush accumulated devour score text smoothly without overlapping spam
    if (this.eatTextCooldown <= 0 && this.batchPts > 0) {
      const k = 1 / this.zoom;
      this.fx.text(this.hole.x, this.hole.y - this.hole.r - 20 * k, `+${this.batchPts} PTS`, '#ffd166', 22);
      this.batchPts = 0;
      this.eatTextCooldown = 0.35;
    }

    if (this.hole.pulse > 0) {
      this.hole.pulse = Math.max(0, this.hole.pulse - dt * 4.2);
    }
    this.beanSquash += (1 - this.beanSquash) * Math.min(1, dt * 10);

    // Prestige idle decay: stop eating for 2.5s and the void slowly shrinks.
    this.sinceEat += dt;
    if ((this.diff.idleDecay || 0) > 0 && this.sinceEat > 2.5 && !this.maxSizeCelebrated && h.r > 16) {
      h.r = Math.max(16, h.r * (1 - this.diff.idleDecay * dt * 10));
    }

    // Check for reaching maximum size (Cosmic Singularity)
    if (this.isMaxSize() && !this.maxSizeCelebrated) {
      this.maxSizeCelebrated = true;
      this.victoryTimer = 4.0;
      const k = 1 / this.zoom;
      this.fx.ring(this.hole.x, this.hole.y, '#ffd166', this.hole.r * this.zoom * 2.8, 1.2, 8);
      this.fx.ring(this.hole.x, this.hole.y, '#3dffa2', this.hole.r * this.zoom * 2.2, 1.0, 6);
      this.fx.burst(this.hole.x, this.hole.y, '#ffd166', 45, 380 * k, 1.2, 6);
      this.fx.burst(this.hole.x, this.hole.y, '#38bdf8', 35, 300 * k, 1.0, 5);
      this.fx.text(this.hole.x, this.hole.y - this.hole.r - 45 * k, '👑 COSMIC SINGULARITY REACHED! YOU CANNOT LOSE! 👑', '#ffd166', 26, 2.8);
      this.sounds.survive();
      this.sounds.up();
      this.haptics.heavy();
    }

    if (this.victoryTimer > 0) {
      this.victoryTimer -= dt;
      // God-mode golden cosmic vortex particles
      if (Math.random() < 0.35) {
        const k = 1 / this.zoom;
        const ang = Math.random() * TAU;
        const dist = Math.random() * this.hole.r;
        this.fx.burst(this.hole.x + Math.cos(ang) * dist, this.hole.y + Math.sin(ang) * dist, '#ffd166', 2, 80 * k, 0.35, 3);
      }
      if (this.victoryTimer <= 0) {
        this.won = true;
        this.winReason = 'Cosmic Singularity Conquered! 🌌';
      }
    }

    this.updateActiveProps();

    // Pedestrians & Pigeons panic and react when holes get close!
    for (let i = 0; i < this.activeProps.length; i++) {
      const p = this.activeProps[i];
      if (p.fall > 0 || p.dead) continue;
      if (p.kind === 'ped') {
        p.animT += dt;
        const pd = Math.hypot(p.x - h.x, p.y - h.y);
        if (pd < h.r * 2.4 && pd > 1) {
          p.x += ((p.x - h.x) / pd) * 95 * dt;
          p.y += ((p.y - h.y) / pd) * 95 * dt;
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.animT % 3 < dt) {
            p.vx = (Math.random() - 0.5) * 30;
            p.vy = (Math.random() - 0.5) * 30;
          }
        }
      } else if (p.kind === 'pigeon') {
        p.animT += dt;
        const pd = Math.hypot(p.x - h.x, p.y - h.y);
        if (pd < h.r * 2.6 && pd > 1) {
          // Flutter hop away fast!
          p.x += ((p.x - h.x) / pd) * 115 * dt;
          p.y += ((p.y - h.y) / pd) * 115 * dt;
        } else {
          // Little pecking steps
          p.x += p.vx * dt * 0.4;
          p.y += p.vy * dt * 0.4;
          if (p.animT % 2 < dt) {
            p.vx = (Math.random() - 0.5) * 20;
            p.vy = (Math.random() - 0.5) * 20;
          }
        }
      }
    }

    // Clear transient pull state before suction pass
    for (let i = 0; i < this.activeProps.length; i++) {
      this.activeProps[i].sucking = false;
    }

    this.absorb(h, dt);
    for (const rv of this.rivals) {
      if (!rv.dead) this.absorbRival(rv, dt);
    }

    // Handle all falling props (both player and rivals)
    for (const p of this.fallingProps) {
      const o = p.owner;
      if (!o || o.dead) {
        p.fall = 0;
        p.owner = null;
        this.fallingProps.delete(p);
        continue;
      }
      p.fall += dt * 3.2;
      const pullDx = o.x - p.x;
      p.x += pullDx * Math.min(1, dt * 8.5);
      p.y += ((o.y + p.fall * o.r * 0.28) - p.y) * Math.min(1, dt * 8.5);
      const tiltDir = (Math.cos(p.pullAng || 0) >= 0) ? 1 : -1;
      p.rot += tiltDir * dt * 2.9;

      if (p.fall >= 1) {
        p.dead = true;
        this.fallingProps.delete(p);
        this.eatenProps.add(p.id);
        this.growHole(o, p.size);
        if (o === h) {
          this.onPlayerAte(p);
        } else {
          o.score = (o.score || 0) + p.pts;
          const screenDist = Math.hypot(o.x - h.x, o.y - h.y);
          if (screenDist < (this.H / 2 + 300) / this.zoom) {
            if (p.size >= 16) {
              this.fx.ring(o.x, o.y, o.color, o.r * this.zoom * 1.3, 0.2, 2);
            }
          }
        }

        // Micro sweets, street litter & pigeons respawn after 28s to keep city vibrant
        if (p.size <= 8) {
          this.respawnQueue.push({ id: p.id, p, t: 28.0 });
        }
      }
    }

    // Process respawn queue for micro sweets & street litter
    if (this.respawnQueue.length > 0) {
      for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
        const item = this.respawnQueue[i];
        item.t -= dt;
        if (item.t <= 0) {
          this.eatenProps.delete(item.id);
          item.p.dead = false;
          item.p.fall = 0;
          item.p.owner = null;
          item.p.x = item.p.origX;
          item.p.y = item.p.origY;
          this.respawnQueue.splice(i, 1);
        }
      }
    }

    this.updateRivals(dt);
    this.fx.update(dt);
  }

  onPlayerAte(p) {
    const k = 1 / this.zoom;
    this.score += p.pts;
    this.batchPts += p.pts;

    const punch = Math.min(0.25, (p.size / this.hole.r) * 0.35 + 0.06);
    this.hole.pulse = Math.min(0.4, this.hole.pulse + punch);
    this.beanSquash = Math.max(0.75, 1.25 - punch * 0.6);

    if (this.gulpCooldown <= 0) {
      this.sounds.gulp(Math.max(0.55, 1.45 - p.size * 0.025));
      this.gulpCooldown = 0.08;
    }

    if (p.isHazard) {
      // Swallowed an electric hazard at giant size!
      this.fx.ring(this.hole.x, this.hole.y, '#ffd166', this.hole.r * this.zoom * 2.0, 0.45, 5);
      this.fx.burst(this.hole.x, this.hole.y, '#25e6ff', 20, 200 * k, 0.7, 4);
      this.fx.shake(5, 0.25);
      this.fx.text(this.hole.x, this.hole.y - this.hole.r - 26 * k, `GRID SMASH! +${p.pts}`, '#ffd166', 24);
      this.sounds.laser();
      this.haptics.heavy();
    } else if (p.size <= 8) {
      // Micro sweets: crisp gold ring burst
      if (this.ringCooldown <= 0) {
        this.fx.ring(this.hole.x, this.hole.y, '#facc15', this.hole.r * this.zoom * 1.25, 0.16, 2.2);
        this.ringCooldown = 0.08;
      }
    } else if (p.size < 20) {
      if (this.ringCooldown <= 0) {
        this.fx.ring(this.hole.x, this.hole.y, '#22c55e', this.hole.r * this.zoom * 1.35, 0.2, 2.8);
        this.ringCooldown = 0.08;
      }
    } else if (p.size < 40) {
      this.fx.ring(this.hole.x, this.hole.y, '#facc15', this.hole.r * this.zoom * 1.5, 0.25, 3.2);
      if (this.eatTextCooldown <= 0) {
        this.fx.text(this.hole.x, this.hole.y - this.hole.r - 20 * k, `+${this.batchPts} PTS`, '#fde047', 22);
        this.batchPts = 0;
        this.eatTextCooldown = 0.32;
      }
      this.haptics.light();
    } else {
      this.fx.ring(this.hole.x, this.hole.y, '#22c55e', this.hole.r * this.zoom * 1.75, 0.35, 4);
      this.fx.burst(this.hole.x, this.hole.y, '#facc15', 10, 140 * k, 0.45, 3.2);
      this.fx.shake(3.5, 0.18);
      if (this.eatTextCooldown <= 0) {
        this.fx.text(this.hole.x, this.hole.y - this.hole.r - 24 * k, `CHOMP! +${this.batchPts}`, '#fde047', 24);
        this.batchPts = 0;
        this.eatTextCooldown = 0.35;
      }
      this.sounds.up();
      this.haptics.heavy();
    }

    const curTier = this.getTier();
    if (curTier.level > this.lastTier) {
      this.lastTier = curTier.level;
      this.fx.ring(this.hole.x, this.hole.y, '#3dffa2', this.hole.r * this.zoom * 2.8, 0.8, 6);
      this.fx.burst(this.hole.x, this.hole.y, '#ffd166', 24, 260 * k, 0.8, 4.5);
      this.fx.text(this.hole.x, this.hole.y - this.hole.r - 40 * k, `TIER UP: ${curTier.name.toUpperCase()}!`, '#3dffa2', 26, 2.0);
      this.fx.shake(6, 0.28);
      this.sounds.up();
      this.haptics.heavy();
    }
  }

  eatRival(rv) {
    rv.dead = true;
    rv.respawn = 2.5;
    const pts = Math.round(800 + rv.r * 15);
    this.score += pts;
    const rivalMass = Math.min(this.hole.r * 0.75, Math.max(35, rv.r * 0.7));
    this.growHole(this.hole, rivalMass);
    const k = 1 / this.zoom;
    this.fx.burst(rv.x, rv.y, '#ffd166', 36, 300 * k, 0.9, 6);
    this.fx.burst(rv.x, rv.y, '#ff4fa3', 28, 240 * k, 0.8, 5);
    this.fx.text(rv.x, rv.y - 30 * k, `RIVAL DEVOURED! +${pts}`, '#fff', 26, 1.5);
    this.fx.ring(this.hole.x, this.hole.y, '#ffd166', this.hole.r * this.zoom * 2.5, 0.6, 5);
    this.fx.shake(12, 0.45);
    this.sounds.up();
    this.haptics.heavy();
  }

  /* --------------------------------------------------- Aggressive Apex Predator AI Engine */
  updateRivals(dt) {
    const h = this.hole;
    this.rimThreatPull = 0;
    let closestHunterDist = Infinity;
    let closestHunterObj = null;

    for (let rIdx = 0; rIdx < this.rivals.length; rIdx++) {
      const rv = this.rivals[rIdx];
      if (rv.dead) {
        rv.respawn -= dt;
        if (rv.respawn <= 0) {
          rv.dead = false;
          rv.x = clamp(rv.homeX + (Math.random() - 0.5) * 1200, 300, WORLD - 300);
          rv.y = clamp(rv.homeY + (Math.random() - 0.5) * 1200, 300, WORLD - 300);
          rv.r = clamp(h.r * (0.8 + Math.random() * 0.6), rv.boss ? 48 : 18, 2400);
        }
        continue;
      }

      const pd = Math.hypot(h.x - rv.x, h.y - rv.y);
      const isBiggerThanPlayer = rv.r > h.r + 3;
      const isPlayerBigger = h.r > rv.r + 3;
      const visionRange = rv.boss ? 2200 : 1450;

      if (isBiggerThanPlayer && pd < closestHunterDist) {
        closestHunterDist = pd;
        closestHunterObj = rv;
      }

      // Check nearby rival holes (Rival vs Rival ecosystem)
      let nearbyPredatorRival = null;
      let nearbyPreyRival = null;
      let closestPreyDist = 650;
      let closestPredDist = 650;

      for (let j = 0; j < this.rivals.length; j++) {
        if (j === rIdx) continue;
        const oRv = this.rivals[j];
        if (oRv.dead) continue;
        const d = Math.hypot(rv.x - oRv.x, rv.y - oRv.y);
        if (oRv.r > rv.r + 3 && d < closestPredDist) {
          closestPredDist = d;
          nearbyPredatorRival = oRv;
        } else if (rv.r > oRv.r + 3 && d < closestPreyDist) {
          closestPreyDist = d;
          nearbyPreyRival = oRv;
        }

        // Rival-vs-rival devouring collision
        if (rv.r >= oRv.r + 3 && d < rv.r) {
          oRv.dead = true;
          oRv.respawn = 3.2;
          rv.r = Math.min(2200, rv.r + Math.min(oRv.r * 0.35, 14));
          const k = 1 / this.zoom;
          this.fx.burst(oRv.x, oRv.y, oRv.col, 24, 200 * k, 0.65, 4);
          const screenDist = Math.hypot(rv.x - h.x, rv.y - h.y);
          if (screenDist < 1200) {
            this.fx.text(rv.x, rv.y - rv.r - 20 * k, `${rv.name} DEVOURED ${oRv.name}! 🌀`, '#ffd166', 18);
          }
        }
      }

      let tx = rv.x;
      let ty = rv.y;
      let speedMultiplier = 1.0;

      // 1. STATE: ESCAPING BIGGER HOLE (Player or Predator Rival)
      const shouldFleePlayer = isPlayerBigger && pd < 750;
      const shouldFleeRival = nearbyPredatorRival && closestPredDist < 550;

      if (shouldFleePlayer || shouldFleeRival) {
        const threatX = shouldFleePlayer ? h.x : nearbyPredatorRival.x;
        const threatY = shouldFleePlayer ? h.y : nearbyPredatorRival.y;
        let fleeDx = rv.x - threatX;
        let fleeDy = rv.y - threatY;
        const fleeLen = Math.hypot(fleeDx, fleeDy) || 1;
        fleeDx /= fleeLen;
        fleeDy /= fleeLen;

        // Smart Wall Reflection: If near boundary, slide along wall tangent instead of trapping in corner
        if (rv.x < 350 && fleeDx < 0) fleeDx = 0.5;
        if (rv.x > WORLD - 350 && fleeDx > 0) fleeDx = -0.5;
        if (rv.y < 350 && fleeDy < 0) fleeDy = 0.5;
        if (rv.y > WORLD - 350 && fleeDy > 0) fleeDy = -0.5;

        tx = rv.x + fleeDx * 600;
        ty = rv.y + fleeDy * 600;
        speedMultiplier = 1.45;

      // 2. STATE: AGGRESSIVE HUNTING! (Player or Prey Rival)
      } else if (isBiggerThanPlayer && pd < visionRange) {
        // Predictive lead trajectory based on player velocity
        const leadFactor = Math.min(0.9, pd / 450);
        tx = h.x + h.vx * leadFactor;
        ty = h.y + h.vy * leadFactor;

        // Predator Surge Lunge Attack Engine
        if (pd < 600) {
          rv.surgeCooldown = (rv.surgeCooldown || 4) - dt;
          if (rv.surgeCooldown <= 0 && rv.telegraphT <= 0 && !rv.surging) {
            rv.telegraphT = 0.75; // 0.75s red targeting telegraph!
          }
        }

        if (rv.telegraphT > 0) {
          rv.telegraphT -= dt;
          if (rv.telegraphT <= 0) {
            rv.surging = true;
            rv.surgeT = 1.1; // 1.1s lunge!
            rv.surgeCooldown = 5.5 + Math.random() * 3.0;
            const k = 1 / this.zoom;
            this.fx.ring(rv.x, rv.y, '#ff0054', rv.r * this.zoom * 1.6, 0.35, 3);
            this.sounds.laser();
            this.haptics.medium();
          }
        }

        if (rv.surging) {
          rv.surgeT -= dt;
          speedMultiplier = 1.85; // Surges at high speed!
          if (Math.random() < 0.4) {
            const k = 1 / this.zoom;
            this.fx.burst(rv.x, rv.y, '#ff0054', 2, 50 * k, 0.2, 2);
          }
          if (rv.surgeT <= 0) {
            rv.surging = false;
            rv.exhaustionT = 1.3; // brief fatigue where rival is slower
          }
        } else if (rv.exhaustionT > 0) {
          rv.exhaustionT -= dt;
          speedMultiplier = 0.65; // recovery slow
        } else if (pd < 550) {
          rv.frenzyT = Math.min(2.5, rv.frenzyT + dt);
          if (Math.random() < 0.25) {
            this.fx.ring(rv.x, rv.y, '#ff0054', rv.r * 1.15, 0.2, 2);
          }
        }

      // 3. STATE: HUNTING WEAKER RIVAL HOLE
      } else if (nearbyPreyRival) {
        tx = nearbyPreyRival.x;
        ty = nearbyPreyRival.y;

      // 4. STATE: ACTIVE FOOD GRAZING
      } else {
        rv.feedT -= dt;
        if (rv.feedT <= 0 || !rv.feedTarget || rv.feedTarget.dead || rv.feedTarget.fall > 0) {
          rv.feedT = 0.8 + Math.random() * 0.7;
          let bestProp = null;
          let bestScore = -Infinity;

          const searchRange = Math.max(CHUNK_SIZE, rv.r * 2.2);
          const minCX = Math.max(0, Math.floor((rv.x - searchRange) / CHUNK_SIZE));
          const maxCX = Math.min(CHUNKS_ACROSS - 1, Math.floor((rv.x + searchRange) / CHUNK_SIZE));
          const minCY = Math.max(0, Math.floor((rv.y - searchRange) / CHUNK_SIZE));
          const maxCY = Math.min(CHUNKS_ACROSS - 1, Math.floor((rv.y + searchRange) / CHUNK_SIZE));

          for (let cy = minCY; cy <= maxCY; cy++) {
            for (let cx = minCX; cx <= maxCX; cx++) {
              const cp = this.getChunkProps(cx, cy);
              for (let i = 0; i < cp.length; i++) {
                const p = cp[i];
                if (p.dead || p.fall > 0 || p.size > rv.r * 0.82) continue;
                const d = Math.hypot(p.x - rv.x, p.y - rv.y);
                if (d > searchRange) continue;
                const score = (p.size * 2.2) - (d * 0.08);
                if (score > bestScore) {
                  bestScore = score;
                  bestProp = p;
                }
              }
            }
          }
          rv.feedTarget = bestProp;
        }

        if (rv.feedTarget && !rv.feedTarget.dead && rv.feedTarget.fall <= 0) {
          tx = rv.feedTarget.x;
          ty = rv.feedTarget.y;
        } else {
          rv.wander.t -= dt;
          if (rv.wander.t <= 0) {
            rv.wander = {
              x: clamp(rv.x + (Math.random() - 0.5) * 1100, 250, WORLD - 250),
              y: clamp(rv.y + (Math.random() - 0.5) * 1100, 250, WORLD - 250),
              t: 2.5,
            };
          }
          tx = rv.wander.x;
          ty = rv.wander.y;
        }
      }

      const dx = tx - rv.x;
      const dy = ty - rv.y;
      const d = Math.hypot(dx, dy) || 1;

      // Dynamic rival speed physics: SSOT bounded prestige ramp + surge lunges
      const pSpd = this.diff.rivalSpeedMult ?? 1;
      const naturalSpeed = Math.max(90, 140 - (rv.r - 16) * 0.04) * pSpd;
      const baseSp = naturalSpeed * speedMultiplier;
      const accelK = Math.min(1, dt * (rv.surging ? 8.0 : 4.0));
      rv.vx += ((dx / d) * baseSp - rv.vx) * accelK;
      rv.vy += ((dy / d) * baseSp - rv.vy) * accelK;
      rv.x = clamp(rv.x + rv.vx * dt, 40, WORLD - 40);
      rv.y = clamp(rv.y + rv.vy * dt, 40, WORLD - 40);

      if (this.dead) continue;

      const overlap = (h.r + rv.r) - pd;
      if (overlap > 0) {
        // MAXIMUM SIZE ACHIEVED: YOU CANNOT LOSE! ALWAYS DEVOURS RIVALS!
        if (this.isMaxSize()) {
          this.eatRival(rv);
          continue;
        }

        // 1. RIVAL IS BIGGER THAN PLAYER -> MUST SWALLOW MAJORITY OF PLAYER TO ELIMINATE
        if (rv.r >= h.r + 1.0) {
          if (this.grace > 0) {
            // Push apart during initial 1s spawn grace only
            const push = overlap * 0.5;
            const nx = (h.x - rv.x) / (pd || 1);
            const ny = (h.y - rv.y) / (pd || 1);
            h.x += nx * push;
            h.y += ny * push;
          } else {
            // Require enemy pit to cover the majority (~66%+) of player's hole before eliminating
            const swallowDist = Math.max(4, rv.r - h.r * 0.25);
            if (pd <= swallowDist) {
              if (this.die(`Devoured by ${rv.name} (${rv.title})`)) {
                this.fx.burst(h.x, h.y, '#ff4b5c', 44, 320 / this.zoom, 0.95, 6);
                this.fx.ring(rv.x, rv.y, rv.color, rv.r * this.zoom * 1.5, 0.5, 4);
                this.fx.shake(18, 0.55);
                this.sounds.tick();
                this.haptics.heavy();
              }
            } else {
              // Rim overlap only: apply gentle tug & danger highlight so player can pull away
              const depthRatio = clamp((h.r + rv.r - pd) / Math.max(1, h.r + rv.r - swallowDist), 0, 1);
              this.rimThreatPull = Math.max(this.rimThreatPull, depthRatio);
              const pull = (55 + depthRatio * 95) * dt;
              const nx = (rv.x - h.x) / (pd || 1);
              const ny = (rv.y - h.y) / (pd || 1);
              h.x = clamp(h.x + nx * pull, h.r, WORLD - h.r);
              h.y = clamp(h.y + ny * pull, h.r, WORLD - h.r);
            }
          }

        // 2. PLAYER IS BIGGER THAN RIVAL -> PLAYER SWALLOWS RIVAL!
        } else if (h.r >= rv.r + 1.0) {
          this.eatRival(rv);

        // 3. EQUAL SIZE HOLES -> BOUNCE & REPEL OFF EACH OTHER!
        } else {
          const push = overlap * 0.5;
          const nx = (h.x - rv.x) / (pd || 1);
          const ny = (h.y - rv.y) / (pd || 1);
          h.x += nx * push;
          h.y += ny * push;
          rv.x -= nx * push;
          rv.y -= ny * push;
        }
      }
    }

    this.closestHunter = closestHunterObj;
    if (closestHunterObj && closestHunterDist < 750) {
      this.dangerIntensity = Math.min(1, 1 - closestHunterDist / 750);
      if (this.dangerT <= 0) {
        this.dangerT = Math.max(0.18, 0.6 - this.dangerIntensity * 0.4);
        this.haptics.light();
      }
    } else {
      this.dangerIntensity = Math.max(0, this.dangerIntensity - dt * 2);
    }
  }

  /* ------------------------------------------------------------ Render Engine */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const h = this.hole;
    const sc = this.zoom;
    const ox = W / 2;
    const oy = H / 2 + 30;
    const off = this.fx.offset();
    const halfW = ox / sc + 120;
    const halfT = oy / sc + 120;
    const halfB = (H - oy) / sc + 120;

    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(ox + off.x, oy + off.y);
    ctx.scale(sc, sc);
    ctx.translate(-h.x, -h.y);

    // 1. Draw Bright Weebl Daylight Toy Metropolis & Trams/Boats
    this.drawCityMap(ctx, h, halfW, halfT, halfB);
    this.drawAmbientTrams(ctx, h, halfW, halfT, halfB);

    // 2. Draw Ground Micro-Debris First (underneath hole rims so candies pour straight in)
    const uprightProps = [];
    for (let i = 0; i < this.activeProps.length; i++) {
      const p = this.activeProps[i];
      if (p.fall > 0 || p.dead) continue;
      if (p.size <= 10) {
        this.drawProp(p, 1, 1);
      } else {
        uprightProps.push(p);
      }
    }

    // 3. Draw Rivals (with Threat Auras & Inked Dash Warning)
    for (const rv of this.rivals) {
      if (rv.dead) continue;
      const isThreat = rv.r > h.r + 10;
      const isPrey = h.r >= rv.r + 2;
      const rim = rv.surging ? '#ef4444' : isThreat ? '#ef4444' : isPrey ? '#22c55e' : '#facc15';

      if (rv.telegraphT > 0) {
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(2.5, 4.0 / sc);
        ctx.setLineDash([12 / sc, 8 / sc]);
        ctx.beginPath();
        ctx.moveTo(rv.x, rv.y);
        ctx.lineTo(h.x, h.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      this.drawHole(rv, rim, rv.color, rv.name, false, isThreat);
    }

    // 4. Draw Hero Weebl Emerald-Gold Vortex Pit + Crowned Green Jellybean Mascot
    const rimThreat = this.rimThreatPull > 0.12;
    this.drawHole(h, rimThreat ? '#ef4444' : (this.boosting ? '#f97316' : '#22c55e'), '#22c55e', 'YOU', true, rimThreat);

    // 5. Draw 2.5D Upright Props Back-to-Front by Ground Y (fade towering roofs blocking Hero)
    uprightProps.sort((a, b) => a.y - b.y);
    for (let i = 0; i < uprightProps.length; i++) {
      const p = uprightProps[i];
      let a = 1;
      if (p.size >= 42 && p.y > h.y - 12 && p.y - p.size * 2.1 < h.y + h.r && Math.abs(p.x - h.x) < p.size * 1.15) {
        a = 0.28;
      }
      this.drawProp(p, a, 1);
    }

    this.fx.render(ctx, sc);
    ctx.restore();

    // 6. Clean Screen-Edge Warning Pulse + Chevrons & Minimal Weebl Comic HUD Chrome
    if (this.dangerIntensity > 0.05) {
      this.drawDangerVignette(ctx, W, H);
    }

    this.drawRivalIndicators(ctx, ox, oy, sc, W, H);
    this.drawDistrictHUD(ctx, W, H);
    this.drawRadar(ctx, W, H);
    this.drawBoostButton(ctx, W, H);

    // 7. Cosmic Singularity Invulnerability Crown Ribbon (Cleanly clear of top HUD!)
    if (this.isMaxSize()) {
      ctx.save();
      const bannerW = 288;
      const bannerH = 34;
      const bannerX = W / 2 - bannerW / 2;
      const bannerY = 144;
      drawComicPanel(ctx, bannerX, bannerY, bannerW, bannerH, 12, '#fde047', { lineWidth: 2.8, shadowDy: 3 });
      const bannerTxt = this.victoryTimer > 0
        ? `👑 VICTORY IN ${Math.max(1, Math.ceil(this.victoryTimer))}s · TAP!`
        : '👑 APEX SINGULARITY · INVINCIBLE!';
      drawComicText(ctx, bannerTxt, W / 2, bannerY + bannerH / 2, '900 12px "Fredoka", sans-serif', '#ffffff', { strokeWidth: 3.4 });
      ctx.restore();
    }
  }

  /* --------------------------------------------------- Danger Edge Vignette (No Blocking Center Bar) */
  drawDangerVignette(ctx, W, H) {
    const pulse = 0.6 + Math.sin(this.time * 9) * 0.4;
    const alpha = this.dangerIntensity * 0.36 * pulse;
    const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.42, W / 2, H / 2, W * 0.74);
    g.addColorStop(0, 'rgba(239, 68, 68, 0)');
    g.addColorStop(1, `rgba(239, 68, 68, ${alpha.toFixed(2)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawRadar(ctx, W, H) {
    const pad = 12;
    const size = 66;
    const rx = W - size - pad;
    const ry = 98;

    ctx.save();
    drawComicPanel(ctx, rx, ry, size, size, 11, '#2563eb', { lineWidth: 3, shadowDx: 2, shadowDy: 3.5, glossTop: false });

    // Inner bright Weebl Toy City district map inset
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rx + 4, ry + 4, size - 8, size - 8, 7);
    ctx.clip();

    const innerX = rx + 4;
    const innerY = ry + 4;
    const innerS = size - 8;
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(innerX, innerY, innerS, innerS);

    // West Mersey Harbor & Docks water strip
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(innerX, innerY, innerS * 0.14, innerS);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(innerX + innerS * 0.14, innerY, innerS * 0.08, innerS);

    // Crisp city road grid lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.6;
    for (const f of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(innerX, innerY + innerS * f);
      ctx.lineTo(innerX + innerS, innerY + innerS * f);
      ctx.moveTo(innerX + innerS * f, innerY);
      ctx.lineTo(innerX + innerS * f, innerY + innerS);
      ctx.stroke();
    }

    const scale = innerS / WORLD;
    let maxR = this.hole.r;
    let leaderObj = this.hole;
    for (const rv of this.rivals) {
      if (!rv.dead && rv.r > maxR) {
        maxR = rv.r;
        leaderObj = rv;
      }
    }

    for (const rv of this.rivals) {
      if (rv.dead) continue;
      const x = innerX + rv.x * scale;
      const y = innerY + rv.y * scale;
      const isThreat = rv.r > this.hole.r + 10;
      ctx.fillStyle = rv.boss ? '#facc15' : isThreat ? '#ef4444' : '#38bdf8';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.8, rv.r * scale * 1.4), 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Leader Crown Beacon
    if (leaderObj && leaderObj !== this.hole) {
      const lx = innerX + leaderObj.x * scale;
      const ly = innerY + leaderObj.y * scale;
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(lx, ly, 3.2, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Player Hero Green Crown Beacon
    const px = clamp(innerX + this.hole.x * scale, innerX + 5, innerX + innerS - 5);
    const py = clamp(innerY + this.hole.y * scale, innerY + 5, innerY + innerS - 5);
    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(4.0, this.hole.r * scale * 2), 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(px - 4, py - 4);
    ctx.lineTo(px - 4.5, py - 9);
    ctx.lineTo(px - 1.5, py - 6.5);
    ctx.lineTo(px, py - 9.5);
    ctx.lineTo(px + 1.5, py - 6.5);
    ctx.lineTo(px + 4.5, py - 9);
    ctx.lineTo(px + 4, py - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  getPlayerRank() {
    let rank = 1;
    const hr = this.hole.r;
    for (let i = 0; i < this.rivals.length; i++) {
      const rv = this.rivals[i];
      if (!rv.dead && rv.r > hr) rank++;
    }
    return rank;
  }

  drawDistrictHUD(ctx, W) {
    const t = this.getTier();
    const nextTier = TIERS.find((x) => x.level === t.level + 1);
    const prevReq = t.req;
    const nextReq = nextTier ? nextTier.req : 1000;
    const progress = nextTier ? clamp((this.hole.r - prevReq) / Math.max(1, nextReq - prevReq), 0, 1) : 1;
    const rank = this.getPlayerRank();

    ctx.save();
    const pillW = 248;
    const pillH = 34;
    const px = 12;
    const py = 98;
    drawComicPanel(ctx, px, py, pillW, pillH, 16, '#ffffff', { lineWidth: 3, shadowDx: 2, shadowDy: 3.5, glossTop: false });

    // Emerald-to-Gold Tier Progress Bar
    const barX = px + 6;
    const barY = py + 6;
    const barW = 186;
    const barH = 22;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 10);
    ctx.fill();
    ctx.stroke();

    const fillW = Math.max(18, Math.round(barW * progress));
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(barX + 1.5, barY + 1.5, barW - 3, barH - 3, 8.5);
    ctx.clip();
    const bgGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    bgGrad.addColorStop(0, '#10b981');
    bgGrad.addColorStop(0.65, '#22c55e');
    bgGrad.addColorStop(1, '#facc15');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(barX, barY, fillW, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(barX, barY + 1, fillW, 6);
    ctx.restore();

    drawComicText(
      ctx,
      `TIER ${t.level} · SIZE ${Math.round(this.hole.r)}`,
      barX + barW / 2,
      barY + barH / 2 + 0.5,
      '900 11.5px "Fredoka", sans-serif',
      '#ffffff',
      { strokeWidth: 3.2 },
    );

    // Compact Gold Crown Rank Chip on right of HUD pill
    const chipX = barX + barW + 5;
    const chipW = 45;
    drawComicPanel(ctx, chipX, barY, chipW, barH, 8, rank === 1 ? '#fde047' : '#facc15', { lineWidth: 2.2, shadowDx: 0, shadowDy: 0 });
    drawComicText(
      ctx,
      `👑#${rank}`,
      chipX + chipW / 2,
      barY + barH / 2 + 0.5,
      '900 10.5px "Fredoka", sans-serif',
      '#000000',
      { stroke: '#ffffff', strokeWidth: 0 },
    );
    ctx.restore();
  }

  drawRivalIndicators(ctx, ox, oy, sc, W, H) {
    const h = this.hole;
    for (const rv of this.rivals) {
      if (rv.dead) continue;
      const sx = ox + (rv.x - h.x) * sc;
      const sy = oy + (rv.y - h.y) * sc;
      const m = 24;
      if (sx > m && sx < W - m && sy > 136 && sy < H - 80) continue;
      const worldDist = Math.hypot(rv.x - h.x, rv.y - h.y);
      if (worldDist > 2600) continue;

      const px = clamp(sx, m, W - m);
      const py = clamp(sy, 144, H - 86);
      const ang = Math.atan2(sy - py, sx - px);
      const isThreat = rv.r > h.r + 10;
      const isPrey = h.r >= rv.r + 2;
      if (!isThreat && !rv.boss && worldDist > 1600) continue;
      const col = rv.boss ? '#facc15' : isThreat ? '#ef4444' : isPrey ? '#22c55e' : '#facc15';

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.fillStyle = col;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-9, -10);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-9, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (isThreat && worldDist < 950) {
        const distM = Math.max(1, Math.round(worldDist / 25));
        drawComicText(ctx, `${distM}m`, px, py + 17, '900 9.5px "Fredoka", sans-serif', '#fca5a5', { strokeWidth: 3 });
      }
    }
  }

  rr(x, y, w, h, r) {
    traceRoundRect(this.ctx, x, y, w, h, r);
  }

  /* --------------------------------------------------- Bright Weebl Toy City Streets & Districts */
  drawCityMap(ctx, h, halfW, halfT, halfB) {
    const minX = Math.max(0, h.x - halfW);
    const maxX = Math.min(WORLD, h.x + halfW);
    const minY = Math.max(0, h.y - halfT);
    const maxY = Math.min(WORLD, h.y + halfB);

    ctx.fillStyle = '#475569';
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

    const startGX = Math.floor(minX / CHUNK_SIZE);
    const endGX = Math.floor(maxX / CHUNK_SIZE);
    const startGY = Math.floor(minY / CHUNK_SIZE);
    const endGY = Math.floor(maxY / CHUNK_SIZE);

    for (let gy = startGY; gy <= endGY; gy++) {
      for (let gx = startGX; gx <= endGX; gx++) {
        const bx = gx * CHUNK_SIZE;
        const by = gy * CHUNK_SIZE;
        const dist = this.getDistrictInfo(bx + CHUNK_SIZE / 2, by + CHUNK_SIZE / 2);

        // Performance LOD when hugely zoomed out
        if (this.zoom < 0.32) {
          ctx.fillStyle = '#475569';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);
          ctx.fillStyle = dist.turf;
          ctx.fillRect(bx + 70, by + 70, CHUNK_SIZE - 90, CHUNK_SIZE - 90);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 6;
          ctx.strokeRect(bx + 70, by + 70, CHUNK_SIZE - 90, CHUNK_SIZE - 90);
          continue;
        }

        // 1. RIVER MERSEY & ROYAL ALBERT DOCK BASINS (West: bx < 2400)
        if (bx < 2400) {
          if (bx < 800) {
            ctx.fillStyle = '#06b6d4';
            ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);
            ctx.strokeStyle = '#67e8f9';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            for (let w = 0; w < 4; w++) {
              const wy = by + w * 150 + Math.sin(this.time * 2.2 + w * 1.5) * 16;
              ctx.beginPath();
              ctx.moveTo(bx + 30, wy);
              ctx.bezierCurveTo(bx + 180, wy - 26, bx + 360, wy + 26, bx + 570, wy);
              ctx.stroke();
            }
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            for (let w = 0; w < 2; w++) {
              const wy = by + 80 + w * 280 + Math.cos(this.time * 2 + w) * 12;
              ctx.beginPath();
              ctx.moveTo(bx + 120, wy);
              ctx.quadraticCurveTo(bx + 240, wy - 14, bx + 340, wy);
              ctx.stroke();
            }
            continue;
          }

          // Sandstone Quay Deck + Crisp Turquoise Harbor Basin
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          ctx.fillStyle = '#0ea5e9';
          this.rr(bx + 84, by + 84, CHUNK_SIZE - 168, CHUNK_SIZE - 168, 18);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.strokeStyle = '#bae6fd';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(bx + 140, by + 220); ctx.lineTo(bx + 260, by + 220);
          ctx.moveTo(bx + 320, by + 380); ctx.lineTo(bx + 450, by + 380);
          ctx.stroke();

          // Timber boardwalk piers along basin edges
          ctx.fillStyle = '#d97706';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.fillRect(bx + 20, by + 20, CHUNK_SIZE - 40, 44);
          ctx.strokeRect(bx + 20, by + 20, CHUNK_SIZE - 40, 44);
          ctx.fillRect(bx + 20, by + CHUNK_SIZE - 64, CHUNK_SIZE - 40, 44);
          ctx.strokeRect(bx + 20, by + CHUNK_SIZE - 64, CHUNK_SIZE - 40, 44);
          continue;
        }

        // 2. THE STRAND GRAND BOULEVARD (bx: 2400..3600, y < 9000)
        if (dist.broadAvenue && (gx % 3 === 0)) {
          ctx.fillStyle = '#475569';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          // Lush Cream Esplanade Aprons
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(bx, by, 108, CHUNK_SIZE);
          ctx.fillRect(bx + CHUNK_SIZE - 108, by, 108, CHUNK_SIZE);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(bx + 108, by); ctx.lineTo(bx + 108, by + CHUNK_SIZE);
          ctx.moveTo(bx + CHUNK_SIZE - 108, by); ctx.lineTo(bx + CHUNK_SIZE - 108, by + CHUNK_SIZE);
          ctx.stroke();

          // Bright Green Boulevard Center Median
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(bx + 282, by + 18, 36, CHUNK_SIZE - 36);
          ctx.strokeRect(bx + 282, by + 18, 36, CHUNK_SIZE - 36);

          // Yellow lane dashes + Crosswalk bars
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 4;
          ctx.setLineDash([18, 18]);
          [bx + 195, bx + 405].forEach((lx) => {
            ctx.beginPath();
            ctx.moveTo(lx, by);
            ctx.lineTo(lx, by + CHUNK_SIZE);
            ctx.stroke();
          });
          ctx.setLineDash([]);

          ctx.fillStyle = '#ffffff';
          for (let z = 0; z < 14; z++) {
            ctx.fillRect(bx + 130 + z * 24, by + 110, 14, 44);
          }
          continue;
        }

        // 3. FALKNER SQUARE & GEORGIAN GARDEN SQUARES
        if (dist.gardenSquare && (gx % 2 === 1 && gy % 2 === 1)) {
          ctx.fillStyle = '#475569';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.arc(bx + 300, by + 300, 224, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(bx + 300, by + 300, 182, 0, TAU);
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = '#fde68a';
          ctx.lineWidth = 18;
          ctx.beginPath();
          ctx.moveTo(bx + 170, by + 170); ctx.lineTo(bx + 430, by + 430);
          ctx.moveTo(bx + 430, by + 170); ctx.lineTo(bx + 170, by + 430);
          ctx.stroke();

          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(bx + 300, by + 300, 52, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.stroke();
          continue;
        }

        // 4. STANLEY PARK BOATING LAKES
        if (dist.parkLakes && (gx % 2 === 0 && gy % 2 === 1)) {
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.ellipse(bx + 300, by + 300, 236, 158, 0.35, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.fillStyle = '#ea580c';
          this.rr(bx + 260, by + 160, 80, 280, 10);
          ctx.fill();
          ctx.stroke();
          continue;
        }

        // 5. ST GEORGE'S CIVIC PLATEAU
        if (dist.stonePlaza) {
          ctx.fillStyle = '#475569';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          ctx.fillStyle = '#fef3c7';
          this.rr(bx + 68, by + 68, CHUNK_SIZE - 136, CHUNK_SIZE - 136, 20);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
          ctx.lineWidth = 2;
          for (let s = 1; s < 4; s++) {
            ctx.beginPath();
            ctx.moveTo(bx + 68 + s * 116, by + 68);
            ctx.lineTo(bx + 68 + s * 116, by + CHUNK_SIZE - 68);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bx + 68, by + 68 + s * 116);
            ctx.lineTo(bx + CHUNK_SIZE - 68, by + 68 + s * 116);
            ctx.stroke();
          }

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(bx + 300, by + 300, 86, 0, TAU);
          ctx.stroke();
          continue;
        }

        // 6. THE CAVERN QUARTER COBBLESTONE ALLEYS
        if (dist.tightAlleys) {
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          ctx.fillStyle = '#fed7aa';
          this.rr(bx + 54, by + 54, CHUNK_SIZE - 108, CHUNK_SIZE - 108, 16);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3.5;
          ctx.stroke();

          ctx.fillStyle = '#fb923c';
          ctx.fillRect(bx, by + 258, CHUNK_SIZE, 84);
          ctx.fillRect(bx + 258, by, 84, CHUNK_SIZE);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(bx, by + 258, CHUNK_SIZE, 84);
          continue;
        }

        // 7. SIGNATURE WEEBL DAYLIGHT STREETS, CROSSWALKS, CREAM SIDEWALKS & PARK BLOCKS
        ctx.fillStyle = '#475569';
        ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

        // White zebra crosswalk bars at every intersection
        ctx.fillStyle = '#ffffff';
        for (let z = 0; z < 4; z++) {
          ctx.fillRect(bx + 104 + z * 18, by + 16, 10, 56);
          ctx.fillRect(bx + 16, by + 104 + z * 18, 56, 10);
        }

        // Sunny yellow center lane dashes
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.setLineDash([18, 18]);
        ctx.beginPath();
        ctx.moveTo(bx + 185, by + 44); ctx.lineTo(bx + CHUNK_SIZE - 16, by + 44);
        ctx.moveTo(bx + 44, by + 185); ctx.lineTo(bx + 44, by + CHUNK_SIZE - 16);
        ctx.stroke();
        ctx.setLineDash([]);

        // Raised Beveled Warm Cream Sidewalk Curb Platform
        ctx.fillStyle = '#cbd5e1';
        this.rr(bx + 88, by + 94, CHUNK_SIZE - 104, CHUNK_SIZE - 104, 20);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.fillStyle = '#fef3c7';
        this.rr(bx + 88, by + 88, CHUNK_SIZE - 104, CHUNK_SIZE - 104, 20);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Inner Lush Emerald Park Turf (or Sunny Courtyard Block)
        const isParkBlock = dist.starterCore || ((gx + gy) % 3 === 0);
        if (isParkBlock) {
          ctx.fillStyle = '#22c55e';
          this.rr(bx + 138, by + 138, CHUNK_SIZE - 204, CHUNK_SIZE - 204, 16);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = '#4ade80';
          this.rr(bx + 158, by + 158, CHUNK_SIZE - 244, CHUNK_SIZE - 244, 12);
          ctx.fill();
        } else {
          ctx.fillStyle = dist.turf;
          this.rr(bx + 138, by + 138, CHUNK_SIZE - 204, CHUNK_SIZE - 204, 16);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.8;
          ctx.stroke();
        }
      }
    }

    // Bold Map Boundary Rim
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 14 / this.zoom;
    ctx.strokeRect(0, 0, WORLD, WORLD);
  }

  /* --------------------------------------------------- Ambient Weebl Trams & Mersey Boats */
  drawAmbientTrams(ctx, h, halfW, halfT, halfB) {
    if (this.zoom < 0.3) return;
    const minY = h.y - halfT;
    const maxY = h.y + halfB;
    const minX = h.x - halfW;
    const maxX = h.x + halfW;

    for (let track = 1; track < CHUNKS_ACROSS; track += 3) {
      const ty = track * CHUNK_SIZE + 44;
      if (ty < minY - 60 || ty > maxY + 60) continue;

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(Math.max(2400, minX), ty - 7);
      ctx.lineTo(Math.min(WORLD, maxX), ty - 7);
      ctx.moveTo(Math.max(2400, minX), ty + 7);
      ctx.lineTo(Math.min(WORLD, maxX), ty + 7);
      ctx.stroke();

      const dir = (track % 2 === 0) ? 1 : -1;
      const period = 3600;
      const offset = ((this.time * 165 * dir + track * 700) % period + period) % period;
      const startSeg = Math.floor(Math.max(2400, minX) / period) * period;

      for (let seg = startSeg; seg <= Math.min(WORLD, maxX) + 300; seg += period) {
        const tx = seg + offset;
        if (tx < minX - 240 || tx > maxX + 240) continue;

        for (let car = 0; car < 3; car++) {
          const cx = tx - dir * car * 82;
          const roofCol = car % 2 === 1 ? '#fef9c3' : '#ef4444';
          ctx.save();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
          ctx.beginPath();
          ctx.ellipse(cx + 3, ty + 14, 34, 9, 0, 0, TAU);
          ctx.fill();

          ctx.fillStyle = roofCol;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.6;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.roundRect(cx - 33, ty - 22, 66, 28, 7);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = car % 2 === 1 ? '#ef4444' : '#facc15';
          ctx.fillRect(cx - 31, ty - 5, 62, 4);

          ctx.fillStyle = '#38bdf8';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.4;
          for (let w = -23; w <= 17; w += 12) {
            ctx.beginPath();
            ctx.roundRect(cx + w, ty - 17, 9, 8, 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }
  }

  /* --------------------------------------------------- Crowned Green Hero Vortex Pit & Rival Beans */
  drawHole(hl, rim, mascotCol, label, isPlayer = false, isThreat = false) {
    const ctx = this.ctx;
    const pulseScale = isPlayer && this.hole.pulse > 0 ? (1 + Math.sin(this.hole.pulse * Math.PI) * 0.16) : 1;
    const curR = hl.r * pulseScale;
    const ry = curR * 0.82;
    const collarW = Math.max(6, Math.min(24, curR * 0.18));
    const inkW = clamp(2.8 / Math.max(0.28, this.zoom), 1.8, 12);

    if (isThreat) {
      const ringPulse = 1.15 + Math.sin(this.time * 8) * 0.12;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
      ctx.lineWidth = inkW * 1.4;
      ctx.beginPath();
      ctx.ellipse(hl.x, hl.y, curR * ringPulse, ry * ringPulse, 0, 0, TAU);
      ctx.stroke();
    }

    // Crisp outer pavement drop rim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(hl.x + collarW * 0.14, hl.y + collarW * 0.28, curR + collarW * 0.68, ry + collarW * 0.65, 0, 0, TAU);
    ctx.fill();

    // Abyss Pit + Animated Swirling Violet/Indigo Vortex Ripples
    ctx.fillStyle = '#070312';
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y, curR, ry, 0, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y, curR, ry, 0, 0, TAU);
    ctx.clip();

    const swirlSpin = this.time * (isPlayer && this.boosting ? 5.2 : 2.6);
    ctx.strokeStyle = '#312e81';
    ctx.lineWidth = Math.max(2.5, curR * 0.14);
    ctx.lineCap = 'round';
    for (let s = 0; s < 3; s++) {
      const a0 = swirlSpin + (s * TAU) / 3;
      ctx.beginPath();
      ctx.ellipse(hl.x, hl.y + ry * 0.06, curR * (0.78 - s * 0.18), ry * (0.72 - s * 0.16), 0, a0, a0 + Math.PI * 0.9);
      ctx.stroke();
    }
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y + ry * 0.08, curR * 0.42, ry * 0.36, 0, 0, TAU);
    ctx.fill();

    // Tucked-in props tumbling into the crater pit
    for (const p of this.fallingProps) {
      if (p.owner === hl) {
        this.drawProp(p, Math.max(0.18, 1 - p.fall * 0.72), Math.max(0, 1 - p.fall * 0.48));
      }
    }
    ctx.restore();

    // Bold Weebl-Inked Crater Rim Ring (Emerald + Sunny Gold on Hero!)
    if (isPlayer && !isThreat) {
      // Gold inner trim ring
      ctx.lineWidth = collarW * 0.45 + inkW * 0.6;
      ctx.strokeStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(hl.x, hl.y, curR - collarW * 0.18, ry - collarW * 0.16, 0, 0, TAU);
      ctx.stroke();
    }

    ctx.lineWidth = collarW;
    ctx.strokeStyle = rim;
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y, curR, ry, 0, 0, TAU);
    ctx.stroke();

    // Crisp outer and inner #000000 black ink contour rings
    ctx.lineWidth = inkW;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y, curR + collarW * 0.5, ry + collarW * 0.5, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y, Math.max(4, curR - collarW * 0.5), Math.max(3, ry - collarW * 0.5), 0, 0, TAU);
    ctx.stroke();

    // Sharp top-left white comic gloss crescent
    ctx.lineWidth = Math.max(2, collarW * 0.24);
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y, curR + collarW * 0.04, ry + collarW * 0.04, 0, Math.PI * 1.08, Math.PI * 1.46);
    ctx.stroke();

    // Mascot perched at upper pit rim (Hero = Crowned Green Jellybean Star!)
    const beanSize = clamp(curR * 0.92, 32, 74);
    const beanY = hl.y - ry * 0.88;
    const tilt = clamp((hl.vx || 0) * 0.0012, -0.18, 0.18);

    if (isPlayer) {
      const hop = Math.abs(Math.sin(this.time * (this.boosting ? 9 : 4.2))) * (beanSize * 0.05);
      const bank = clamp((hl.vx || 0) * 0.0022, -0.35, 0.35);
      drawHeroCharacter(ctx, hl.x, beanY + beanSize * 0.14 - hop, beanSize * 0.96, {
        view: 'threeQuarterFront',
        dir: (hl.vx || 0) < -4 ? -1 : 1,
        state: isThreat ? 'hurt' : 'pilot',
        expr: isThreat ? 'panic' : this.boosting ? 'happy' : 'focus',
        t: this.time * (this.boosting ? 7 : 3.8),
        lean: bank,
        lookX: clamp((hl.vx || 0) * 0.008, -0.8, 0.8),
        squashX: 2 - this.beanSquash,
        squashY: this.beanSquash,
      });
    } else {
      // Rival Angry Weebl Bean peaking from enemy pit
      drawWeeblCelBean(ctx, hl.x, beanY + beanSize * 0.12, beanSize * 0.72, {
        color: hl.boss ? '#ef4444' : (mascotCol || '#f43f5e'),
        shadeColor: shadeHex(hl.boss ? '#ef4444' : (mascotCol || '#f43f5e'), -0.32),
        hatId: hl.boss ? 'crown' : null,
        crownColor: '#facc15',
        eyes: isThreat || hl.boss ? 'angry' : 'panic',
        waveT: this.time + hl.x * 0.01,
        dir: (hl.vx || 0) < -1 ? -1 : 1,
        legs: false,
      });

      if (label) {
        const fontPx = Math.max(10.5, Math.round(13 / Math.max(0.32, this.zoom)));
        const labelY = beanY - beanSize * 0.95 - fontPx * 0.4;
        drawComicText(ctx, label, hl.x, labelY, `900 ${fontPx}px "Fredoka", sans-serif`, isThreat ? '#fde047' : '#ffffff', {
          strokeWidth: Math.max(2.6, fontPx * 0.28),
        });
      }
    }
  }

  /* --------------------------------------------------- Crisp Weebl 2.5D Cel Building Extruder */
  drawExtrudedBox(w, d, h, topCol, opts = {}) {
    const ctx = this.ctx;
    const hw = w * 0.5;
    const hd = d * 0.5;
    const zoom = this.zoom;
    const wallCol = opts.wallCol || shadeHex(topCol, -0.18);
    const darkWall = opts.darkWall || shadeHex(topCol, -0.36);
    const trimCol = opts.trimCol || '#fef3c7';
    const padCol = opts.padCol || shadeHex(topCol, -0.12);
    const lw = Math.max(1.5, Math.min(3.4, Math.min(w, h) * 0.055));

    // Clean comic diagonal drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.moveTo(hw, -hd);
    ctx.lineTo(hw + h * 0.3, -hd + h * 0.22);
    ctx.lineTo(hw + h * 0.3, hd + h * 0.22);
    ctx.lineTo(-hw + h * 0.16, hd + h * 0.22);
    ctx.lineTo(-hw, hd);
    ctx.closePath();
    ctx.fill();

    // Right 2-tone cel shadow wall strip
    const sideW = Math.min(w * 0.18, 12);
    ctx.fillStyle = darkWall;
    ctx.fillRect(hw - sideW, hd - h, sideW, h);

    // Flat sunlit front facade wall
    ctx.fillStyle = wallCol;
    ctx.fillRect(-hw, hd - h, w - sideW, h);

    // Inked vertical corner seam
    ctx.fillStyle = '#000000';
    ctx.fillRect(hw - sideW, hd - h, Math.max(1.2, lw * 0.5), h);

    // Crisp #000-outlined comic windows
    const facadeW = w - sideW;
    if (h >= 12 && facadeW * zoom > 8) {
      const floors = opts.floors ?? clamp(Math.floor((h - 8) / 16), 1, 6);
      const cols = opts.cols ?? clamp(Math.floor((facadeW - 8) / 18), 2, 7);
      const winW = clamp((facadeW - 10) / (cols * 2.0), 3, 13);
      const winH = clamp((h - 10) / (floors * 1.75), 3, 14);
      const stepX = (facadeW - 8) / cols;
      const stepY = (h - 8) / floors;
      const warmWin = opts.winCol || '#fde047';
      const coolWin = opts.winAltCol || '#7dd3fc';

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(0.8, lw * 0.45);
      for (let r = 0; r < floors; r++) {
        for (let c = 0; c < cols; c++) {
          if (opts.door !== false && r === floors - 1 && cols >= 3 && c === Math.floor(cols / 2)) continue;
          const wx = -hw + 4 + c * stepX + (stepX - winW) * 0.5;
          const wy = hd - h + 4 + r * stepY + (stepY - winH) * 0.5;
          ctx.fillStyle = (r + c) % 3 === 0 ? warmWin : coolWin;
          ctx.beginPath();
          ctx.roundRect(wx, wy, winW, winH, Math.min(2, winW * 0.2));
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // Thick #000000 outer facade ink outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.strokeRect(-hw, hd - h, w, h);

    // Doorway & colorful shop awning
    if (opts.door !== false && w >= 16 && h >= 14) {
      const dw = Math.min(w * 0.24, 11);
      const dh = Math.min(h * 0.34, 10);
      ctx.fillStyle = opts.doorCol || '#475569';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(1, lw * 0.6);
      ctx.beginPath();
      ctx.roundRect(-dw * 0.5 - sideW * 0.25, hd - dh, dw, dh, 2);
      ctx.fill();
      ctx.stroke();
      if (opts.awningCol) {
        ctx.fillStyle = opts.awningCol;
        ctx.beginPath();
        ctx.roundRect(-dw * 0.85 - sideW * 0.25, hd - dh - 4, dw * 1.7, 5.5, 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Parapet cornice trim + Flat cel roof top
    ctx.fillStyle = trimCol;
    ctx.fillRect(-hw - 1, hd - h - 2.5, w + 2, 4);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = lw * 0.7;
    ctx.strokeRect(-hw - 1, hd - h - 2.5, w + 2, 4);

    const rY = -hd - h;
    ctx.fillStyle = topCol;
    this.rr(-hw - 1, rY, w + 2, d, Math.min(6, w * 0.12));
    ctx.fill();

    // Top-left cel highlight band on roof
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    this.rr(-hw + 1, rY + 1, w - 3, Math.min(5, d * 0.25), 2);
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = lw;
    this.rr(-hw - 1, rY, w + 2, d, Math.min(6, w * 0.12));
    ctx.stroke();

    const inset = Math.max(2.5, Math.min(w, d) * 0.15);
    if (w > inset * 2.5 && d > inset * 2.5) {
      ctx.fillStyle = padCol;
      this.rr(-hw + inset, rY + inset, w - inset * 2, d - inset * 2, Math.min(4, inset * 0.5));
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(0.9, lw * 0.45);
      ctx.stroke();
    }

    if (opts.acUnits && w >= 24 && d >= 20) {
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(1, lw * 0.5);
      ctx.fillRect(-hw + inset + 2, rY + inset + 2, w * 0.2, d * 0.2);
      ctx.strokeRect(-hw + inset + 2, rY + inset + 2, w * 0.2, d * 0.2);
    }
  }

  /* --------------------------------------------------- Weebl Cel Prop Drawing Library */
  drawProp(p, alpha, scale) {
    const ctx = this.ctx;
    const s = p.size * scale;
    if (s * this.zoom < 1.3) {
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      return;
    }
    const col = p.col;
    const lw = Math.max(1.2, Math.min(2.8, s * 0.085));
    const isSpriteIso = p.kind === 'donutShop' || p.kind === 'superlambanana' || p.kind === 'doubleDecker'
      || p.kind === 'taxi' || p.kind === 'liverBuilding' || p.kind === 'metroCathedral'
      || p.kind === 'stJellyHall' || p.kind === 'palmHouse';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Suction Speed Streaks & Leaning Pull when dragged toward Pit Crater!
    if (p.sucking && p.fall <= 0 && p.size >= 14) {
      const ang = p.pullAng || 0;
      ctx.save();
      ctx.rotate(ang);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.8, lw * 0.9);
      for (const oy of [-s * 0.45, s * 0.45]) {
        ctx.beginPath();
        ctx.moveTo(-s * 1.15, oy);
        ctx.lineTo(-s * 1.95, oy);
        ctx.stroke();
      }
      ctx.restore();
    }

    const isFlatSpin = p.kind === 'car' || p.kind === 'truck' || p.kind === 'sugarDrop' || p.kind === 'sweetWrapper';
    if (p.fall > 0) {
      ctx.rotate(p.rot * 0.55);
    } else if (isFlatSpin) {
      ctx.rotate(p.rot);
    }

    // Crisp dark ground shadow (skip on 2.5D sprites & boxes casting their own)
    if (p.fall <= 0 && !EXTRUDED_PROP_KINDS.has(p.kind) && !isSpriteIso) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(s * 0.14, s * 0.28, s * 0.95, s * 0.54, 0, 0, TAU);
      ctx.fill();
    }

    const flipVehicle = (p.kind === 'doubleDecker' || p.kind === 'taxi') && Math.cos(p.rot || 0) > 0.1;

    switch (p.kind) {
      case 'sugarDrop': {
        ctx.fillStyle = col;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.1, lw * 0.9);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.1, s * 1.15, s * 0.82, -0.25, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-s * 0.36, -s * 0.36, s * 0.36, s * 0.14, -0.35, 0, TAU);
        ctx.fill();
        break;
      }

      case 'sweetWrapper': {
        ctx.fillStyle = shadeHex(col, 0.18);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.1, lw * 0.9);
        ctx.beginPath();
        ctx.moveTo(-s * 1.25, -s * 0.52); ctx.lineTo(-s * 0.5, 0); ctx.lineTo(-s * 1.25, s * 0.52);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 1.25, -s * 0.52); ctx.lineTo(s * 0.5, 0); ctx.lineTo(s * 1.25, s * 0.52);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect(-s * 0.64, -s * 0.54, s * 1.28, s * 1.08, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-s * 0.16, -s * 0.48, s * 0.32, s * 0.96);
        break;
      }

      case 'sodaCan': {
        ctx.fillStyle = col;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.1, lw * 0.9);
        ctx.beginPath(); ctx.roundRect(-s * 0.7, -s * 1.25, s * 1.4, s * 2.05, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath(); ctx.ellipse(0, -s * 1.15, s * 0.68, s * 0.28, 0, 0, TAU); ctx.fill(); ctx.stroke();
        break;
      }

      case 'pigeon': {
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.1, lw * 0.9);
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.1, s * 0.74, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.arc(s * 0.68, -s * 0.35, s * 0.42, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.beginPath(); ctx.moveTo(s * 1.05, -s * 0.38); ctx.lineTo(s * 1.46, -s * 0.3); ctx.lineTo(s * 1.05, -s * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.beginPath(); ctx.arc(s * 0.8, -s * 0.42, s * 0.12, 0, TAU); ctx.fill();
        break;
      }

      case 'flowerPot':
        ctx.fillStyle = '#ea580c';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.1, lw * 0.9);
        ctx.beginPath(); ctx.roundRect(-s * 0.78, -s * 0.3, s * 1.56, s * 1.3, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.arc(0, -s * 0.58, s * 0.68, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, -s * 0.85, s * 0.38, 0, TAU); ctx.fill(); ctx.stroke();
        break;

      case 'coffeeCup':
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.1, lw * 0.9);
        ctx.beginPath(); ctx.roundRect(-s * 0.65, -s * 1.1, s * 1.3, s * 1.95, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#d97706';
        ctx.fillRect(-s * 0.6, -s * 0.32, s * 1.2, s * 0.68);
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.roundRect(-s * 0.76, -s * 1.28, s * 1.52, s * 0.38, 2); ctx.fill(); ctx.stroke();
        break;

      case 'streetSign':
        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.1, lw * 0.85);
        ctx.fillRect(-s * 0.14, -s * 0.8, s * 0.28, s * 1.8);
        ctx.strokeRect(-s * 0.14, -s * 0.8, s * 0.28, s * 1.8);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, -s * 1.05, s * 0.84, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -s * 1.05, s * 0.44, 0, TAU); ctx.fill();
        break;

      case 'cone':
        ctx.fillStyle = '#f97316';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.1, lw * 0.9);
        ctx.beginPath(); ctx.roundRect(-s * 0.85, s * 0.18, s * 1.7, s * 0.55, 2.5); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-s * 0.68, s * 0.3); ctx.lineTo(-s * 0.18, -s * 1.35);
        ctx.lineTo(s * 0.18, -s * 1.35); ctx.lineTo(s * 0.68, s * 0.3);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-s * 0.46, -s * 0.25); ctx.lineTo(-s * 0.32, -s * 0.72);
        ctx.lineTo(s * 0.32, -s * 0.72); ctx.lineTo(s * 0.46, -s * 0.25);
        ctx.closePath(); ctx.fill();
        break;

      case 'hydrant':
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.2, lw * 0.95);
        ctx.beginPath(); ctx.roundRect(-s * 0.52, -s * 0.95, s * 1.04, s * 1.25, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath(); ctx.roundRect(-s * 0.78, -s * 0.52, s * 1.56, s * 0.34, 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.arc(0, -s * 0.98, s * 0.42, 0, TAU); ctx.fill(); ctx.stroke();
        break;

      case 'trash':
        this.drawExtrudedBox(s * 1.7, s * 1.2, s * 1.1, '#22c55e', { wallCol: '#16a34a', door: false });
        break;

      case 'barrel':
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.2, lw * 0.95);
        ctx.beginPath(); ctx.roundRect(-s * 0.72, -s * 1.1, s * 1.44, s * 1.7, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-s * 0.7, -s * 0.42, s * 1.4, s * 0.26);
        break;

      case 'bollard':
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.2, lw * 0.95);
        ctx.beginPath(); ctx.roundRect(-s * 0.46, -s * 1.1, s * 0.92, s * 1.55, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-s * 0.42, -s * 0.65, s * 0.84, s * 0.3);
        break;

      case 'redPhoneBox':
        this.drawExtrudedBox(s * 1.15, s * 1.15, s * 1.95, '#ef4444', {
          wallCol: '#dc2626',
          winCol: '#bae6fd',
          winAltCol: '#ffffff',
          floors: 3,
          cols: 2,
          door: false,
        });
        break;

      case 'mailbox':
        this.drawExtrudedBox(s * 1.1, s * 1.0, s * 1.4, '#ef4444', {
          wallCol: '#dc2626',
          door: false,
          floors: 1,
        });
        break;

      case 'ped': {
        // Tiny Inked Weebl Jellybean Citizen
        const dirP = p.vx < 0 ? -1 : 1;
        ctx.fillStyle = col;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.2, lw);
        ctx.beginPath();
        ctx.roundRect(-s * 0.62, -s * 1.25, s * 1.24, s * 1.55, s * 0.6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(dirP * s * 0.14 - s * 0.22, -s * 0.72, s * 0.22, 0, TAU);
        ctx.arc(dirP * s * 0.14 + s * 0.22, -s * 0.72, s * 0.22, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(dirP * s * 0.18 - s * 0.22, -s * 0.72, s * 0.1, 0, TAU);
        ctx.arc(dirP * s * 0.18 + s * 0.22, -s * 0.72, s * 0.1, 0, TAU);
        ctx.fill();
        break;
      }

      case 'bench':
        ctx.fillStyle = '#d97706';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.2, lw * 0.95);
        ctx.beginPath(); ctx.roundRect(-s, -s * 0.55, s * 2, s * 0.95, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(-s * 0.85, -s * 0.35, s * 1.7, s * 0.22);
        break;

      case 'lamp':
        ctx.fillStyle = '#64748b';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.1, lw * 0.85);
        ctx.fillRect(-s * 0.16, -s * 2.2, s * 0.32, s * 2.3);
        ctx.strokeRect(-s * 0.16, -s * 2.2, s * 0.32, s * 2.3);
        ctx.fillStyle = '#fde047';
        ctx.beginPath(); ctx.arc(s * 0.45, -s * 2.0, s * 0.42, 0, TAU); ctx.fill(); ctx.stroke();
        break;

      case 'tree': {
        // Inked Weebl Lollipop Park Tree
        ctx.fillStyle = '#92400e';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.4, lw * 0.9);
        ctx.fillRect(-s * 0.22, -s * 0.55, s * 0.44, s * 0.82);
        ctx.strokeRect(-s * 0.22, -s * 0.55, s * 0.44, s * 0.82);
        ctx.fillStyle = '#16a34a';
        ctx.beginPath(); ctx.arc(0, -s * 0.78, s * 0.92, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.arc(-s * 0.1, -s * 1.05, s * 0.78, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4ade80';
        ctx.beginPath(); ctx.arc(-s * 0.28, -s * 1.3, s * 0.35, 0, TAU); ctx.fill();
        break;
      }

      case 'lionStatue':
        this.drawExtrudedBox(s * 1.9, s * 1.1, s * 0.8, '#cbd5e1', { door: false });
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.4, lw);
        ctx.beginPath(); ctx.arc(s * 0.3, -s * 1.05, s * 0.48, 0, TAU); ctx.fill(); ctx.stroke();
        break;

      case 'swingBridge':
        ctx.fillStyle = '#64748b';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.6, lw);
        ctx.beginPath(); ctx.roundRect(-s * 0.44, -s * 1.25, s * 0.88, s * 2.5, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-s * 0.36, -s * 0.12, s * 0.72, s * 0.24);
        break;

      case 'superlambanana': {
        drawSprite(ctx, 'city_superlambanana', 0, 0, s * 1.95, s * 2.7, {
          anchorY: 0.74,
          fallback: () => {
            this.drawExtrudedBox(s * 1.7, s * 1.0, s * 0.55, '#cbd5e1', { door: false });
            ctx.fillStyle = '#facc15';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = lw;
            ctx.beginPath(); ctx.ellipse(0, -s * 0.45, s * 0.85, s * 0.46, -0.25, 0, TAU); ctx.fill(); ctx.stroke();
          },
        });
        break;
      }

      case 'beatleBeans':
        ctx.fillStyle = '#fde68a';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.8, lw);
        ctx.beginPath(); ctx.arc(0, 0, s * 0.94, 0, TAU); ctx.fill(); ctx.stroke();
        [-s * 0.46, -s * 0.16, s * 0.16, s * 0.46].forEach((bx, idx) => {
          drawWeeblCelBean(ctx, bx, s * 0.15, s * 0.56, {
            color: idx === 0 ? '#22c55e' : '#38bdf8',
            shadeColor: idx === 0 ? '#15803d' : '#0284c7',
            hatId: idx === 0 ? 'crown' : null,
            legs: false,
          });
        });
        break;

      case 'fountain':
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.8, lw);
        ctx.beginPath(); ctx.arc(0, 0, s * 0.94, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.74, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.fill(); ctx.stroke();
        for (let b = 0; b < 4; b++) {
          const a = (b * Math.PI) / 2 + this.time * 2.2;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.48, Math.sin(a) * s * 0.48, s * 0.1, 0, TAU); ctx.fill();
        }
        break;

      case 'anchorMonument':
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.6, lw);
        ctx.fillRect(-s * 0.15, -s * 0.9, s * 0.3, s * 1.8); ctx.strokeRect(-s * 0.15, -s * 0.9, s * 0.3, s * 1.8);
        ctx.fillRect(-s * 0.7, -s * 0.5, s * 1.4, s * 0.28); ctx.strokeRect(-s * 0.7, -s * 0.5, s * 1.4, s * 0.28);
        ctx.beginPath(); ctx.arc(0, s * 0.3, s * 0.75, 0.1, Math.PI - 0.1);
        ctx.lineWidth = s * 0.22; ctx.strokeStyle = '#000000'; ctx.stroke();
        ctx.lineWidth = s * 0.12; ctx.strokeStyle = '#94a3b8'; ctx.stroke();
        break;

      case 'cavernClub':
        this.drawExtrudedBox(s * 1.9, s * 1.45, s * 1.05, '#fb7185', {
          wallCol: '#e11d48',
          awningCol: '#facc15',
          floors: 2,
          cols: 3,
          acUnits: true,
        });
        ctx.fillStyle = '#ec4899';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.6, lw);
        ctx.beginPath(); ctx.roundRect(-s * 0.68, -s * 1.25, s * 1.36, s * 0.34, 6); ctx.fill(); ctx.stroke();
        drawComicText(ctx, 'CAVERN', 0, -s * 1.08, `900 ${Math.max(8, Math.round(s * 0.2))}px "Fredoka", sans-serif`, '#ffffff', { strokeWidth: 2.5 });
        break;

      case 'shed':
        this.drawExtrudedBox(s * 1.7, s * 1.3, s * 0.78, col, { floors: 1, cols: 2 });
        break;

      case 'cottage':
        this.drawExtrudedBox(s * 1.85, s * 1.45, s * 0.92, col, { awningCol: '#facc15', floors: 2, cols: 2 });
        break;

      case 'gasStation':
        this.drawExtrudedBox(s * 2.1, s * 1.4, s * 0.78, '#38bdf8', {
          wallCol: '#0284c7',
          trimCol: '#facc15',
          door: false,
          floors: 1,
          cols: 3,
        });
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.3, lw);
        ctx.fillRect(-s * 0.75, s * 0.1, s * 0.35, s * 0.45); ctx.strokeRect(-s * 0.75, s * 0.1, s * 0.35, s * 0.45);
        ctx.fillRect(s * 0.4, s * 0.1, s * 0.35, s * 0.45); ctx.strokeRect(s * 0.4, s * 0.1, s * 0.35, s * 0.45);
        break;

      case 'warehouse':
        this.drawExtrudedBox(s * 2.1, s * 1.55, s * 0.85, col, { floors: 1, cols: 4, acUnits: true });
        break;

      case 'townhouse':
        this.drawExtrudedBox(s * 1.9, s * 1.45, s * 1.15, col, { awningCol: '#facc15', floors: 3, cols: 3 });
        break;

      case 'apt':
        this.drawExtrudedBox(s * 1.9, s * 1.5, s * 1.38, col, { acUnits: true });
        break;

      case 'palmHouse':
        drawSprite(ctx, 'city_palm_house', 0, 0, s * 2.35, s * 2.5, {
          anchorY: 0.68,
          fallback: () => {
            ctx.fillStyle = '#22c55e';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = lw;
            ctx.beginPath(); ctx.arc(0, -s * 0.15, s * 0.9, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#bae6fd';
            ctx.beginPath(); ctx.ellipse(0, -s * 0.32, s * 0.74, s * 0.58, 0, 0, TAU); ctx.fill(); ctx.stroke();
          },
        });
        break;

      case 'albertDock':
        this.drawExtrudedBox(s * 2.0, s * 1.4, s * 1.05, '#ea580c', { wallCol: '#c2410c', acUnits: true });
        break;

      case 'stJellyHall':
        drawSprite(ctx, 'city_st_jelly_hall', 0, 0, s * 2.45, s * 2.45, {
          anchorY: 0.66,
          fallback: () => {
            this.drawExtrudedBox(s * 2.0, s * 1.4, s * 1.1, '#fef3c7', { trimCol: '#ffffff', wallCol: '#fde68a' });
          },
        });
        break;

      case 'liverBuilding':
        drawSprite(ctx, 'city_liver_building', 0, 0, s * 2.35, s * 2.84, {
          anchorY: 0.68,
          fallback: () => {
            this.drawExtrudedBox(s * 1.95, s * 1.35, s * 1.42, '#fcd34d');
          },
        });
        break;

      case 'cathedral':
        this.drawExtrudedBox(s * 1.95, s * 1.45, s * 1.35, '#fb923c', { wallCol: '#ea580c' });
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.roundRect(-s * 0.34, -s * 1.92, s * 0.68, s * 0.62, 4); ctx.fill(); ctx.stroke();
        break;

      case 'metroCathedral':
        drawSprite(ctx, 'city_metro_cathedral', 0, 0, s * 2.4, s * 2.62, {
          anchorY: 0.68,
          fallback: () => {
            ctx.fillStyle = '#94a3b8';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = lw;
            ctx.beginPath(); ctx.arc(0, 0, s * 0.88, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath(); ctx.arc(0, -s * 0.35, s * 0.52, 0, TAU); ctx.fill(); ctx.stroke();
          },
        });
        break;

      case 'doubleDecker':
        drawSprite(ctx, 'city_double_decker', 0, 0, s * 2.35, s * 2.56, {
          anchorY: 0.6,
          flipX: flipVehicle,
          fallback: () => {
            drawToyBevelRect(ctx, -s * 1.18, -s * 0.58, s * 2.36, s * 1.16, s * 0.24, '#ef4444', {
              depth: s * 0.28,
              rimColor: '#000000',
              lineWidth: lw,
              gloss: true,
            });
          },
        });
        break;

      case 'car': {
        const ux = -Math.sin(p.rot);
        const uy = -Math.cos(p.rot);
        ctx.fillStyle = col;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.2, lw);
        ctx.beginPath(); ctx.roundRect(-s * 1.08, -s * 0.54, s * 2.16, s * 1.08, s * 0.26); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.roundRect(-s * 0.46 + ux * s * 0.24, -s * 0.42 + uy * s * 0.24, s * 1.0, s * 0.84, s * 0.16); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.fillRect(s * 0.92 + ux * s * 0.12, -s * 0.4 + uy * s * 0.12, s * 0.14, s * 0.2);
        ctx.fillRect(s * 0.92 + ux * s * 0.12, s * 0.2 + uy * s * 0.12, s * 0.14, s * 0.2);
        break;
      }

      case 'taxi': {
        drawSprite(ctx, 'city_yellow_taxi', 0, 0, s * 2.25, s * 1.85, {
          anchorY: 0.58,
          flipX: flipVehicle,
          fallback: () => {
            ctx.fillStyle = '#facc15';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = lw;
            ctx.beginPath(); ctx.roundRect(-s * 1.08, -s * 0.54, s * 2.16, s * 1.08, s * 0.26); ctx.fill(); ctx.stroke();
          },
        });
        break;
      }

      case 'truck': {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.3, lw);
        ctx.beginPath(); ctx.roundRect(-s * 1.18, -s * 0.6, s * 1.62, s * 1.2, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect(s * 0.48, -s * 0.54, s * 0.7, s * 1.08, 4); ctx.fill(); ctx.stroke();
        break;
      }

      case 'donutShop':
        drawSprite(ctx, 'city_donut_shop', 0, 0, s * 2.45, s * 2.68, {
          anchorY: 0.64,
          fallback: () => {
            this.drawExtrudedBox(s * 1.9, s * 1.45, s * 1.05, '#fef3c7', { awningCol: '#fb7185', floors: 2, cols: 3 });
            ctx.fillStyle = '#fb7185';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = lw;
            ctx.beginPath(); ctx.arc(0, -s * 1.05, s * 0.46, 0, TAU); ctx.fill(); ctx.stroke();
          },
        });
        break;

      case 'tower':
        this.drawExtrudedBox(s * 1.9, s * 1.45, s * 1.62, col, { acUnits: true });
        break;

      case 'sky':
        this.drawExtrudedBox(s * 1.95, s * 1.5, s * 1.95, col, { acUnits: true });
        ctx.fillStyle = shadeHex(col, 0.2);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.roundRect(-s * 0.42, -s * 2.33, s * 0.84, s * 0.65, 4); ctx.fill(); ctx.stroke();
        break;

      case 'stadium':
        this.drawExtrudedBox(s * 2.1, s * 1.45, s * 0.85, '#ef4444', { wallCol: '#dc2626', floors: 2, cols: 5, door: false });
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.roundRect(-s * 0.72, -s * 1.23, s * 1.44, s * 0.78, s * 0.18); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-s * 0.52, -s * 1.1, s * 1.04, s * 0.52);
        break;

      case 'wheel':
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(7, s * 0.1);
        ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = Math.max(4, s * 0.055);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + this.time * 0.5;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85);
          ctx.stroke();
          ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#38bdf8';
          ctx.beginPath();
          ctx.arc(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85, s * 0.11, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.16, 0, TAU); ctx.fill(); ctx.stroke();
        break;

      case 'electricSubstation': {
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(2, lw);
        ctx.beginPath(); ctx.roundRect(-s * 1.1, -s * 0.9, s * 2.2, s * 1.8, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-s * 0.9, -s * 0.7, s * 1.8, s * 0.4);
        ctx.strokeRect(-s * 0.9, -s * 0.7, s * 1.8, s * 0.4);
        drawComicText(ctx, '⚡', 0, s * 0.35, `900 ${Math.round(s * 0.65)}px "Fredoka", sans-serif`, '#fde047', { strokeWidth: 2.5 });
        break;
      }

      case 'voidMine': {
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          ctx.fillStyle = '#ef4444';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(1.5, lw);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a - 0.2) * s * 0.65, Math.sin(a - 0.2) * s * 0.65);
          ctx.lineTo(Math.cos(a) * s * 1.18, Math.sin(a) * s * 1.18);
          ctx.lineTo(Math.cos(a + 0.2) * s * 0.65, Math.sin(a + 0.2) * s * 0.65);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.75, 0, TAU); ctx.fill(); ctx.stroke();
        const blink = Math.sin(this.time * 10) > 0;
        ctx.fillStyle = blink ? '#facc15' : '#ef4444';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, TAU); ctx.fill(); ctx.stroke();
        break;
      }

      default:
        ctx.fillStyle = col;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.roundRect(-s, -s, s * 2, s * 2, s * 0.2); ctx.fill(); ctx.stroke();
        break;
    }
    ctx.restore();
  }

  /* --------------------------------------------------- Chunky Weebl Arcade Boost Button */
  drawBoostButton(ctx, W, H) {
    const bx = W - 46;
    const by = H - 118;
    const r = 28;
    const h = this.hole;
    const canBoost = h.r > 16.5;

    ctx.save();
    // Hard offset black drop shadow matching Lord Brim UI Chrome
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(bx, by + 4.5, r, 0, TAU);
    ctx.fill();

    const grad = ctx.createLinearGradient(bx, by - r, bx, by + r);
    if (this.boosting) {
      grad.addColorStop(0, '#fb923c');
      grad.addColorStop(1, '#dc2626');
    } else if (canBoost) {
      grad.addColorStop(0, '#fde047');
      grad.addColorStop(0.55, '#facc15');
      grad.addColorStop(1, '#f97316');
    } else {
      grad.addColorStop(0, '#e2e8f0');
      grad.addColorStop(1, '#94a3b8');
    }

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Sharp white curved gloss highlight on upper-left rim
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(bx, by, r - 6, Math.PI * 1.12, Math.PI * 1.56);
    ctx.stroke();

    drawComicText(
      ctx,
      '⚡',
      bx,
      by - 7,
      '900 16px "Fredoka", sans-serif',
      canBoost ? '#ffffff' : '#cbd5e1',
      { strokeWidth: 3.4 },
    );
    drawComicText(
      ctx,
      'BOOST',
      bx,
      by + 10,
      '900 9.5px "Fredoka", sans-serif',
      '#ffffff',
      { strokeWidth: 3.2 },
    );
    ctx.restore();
  }
}

function pickColor(kind, seed) {
  const p = pseudoRandom(seed);
  if (kind === 'electricSubstation') return '#facc15';
  if (kind === 'voidMine') return '#ef4444';
  if (kind === 'sugarDrop') return pick(['#fb7185', '#22c55e', '#facc15', '#38bdf8', '#c084fc', '#fb923c'], p);
  if (kind === 'sweetWrapper') return pick(['#ef4444', '#a855f7', '#ec4899', '#3b82f6', '#facc15'], p);
  if (kind === 'sodaCan') return pick(['#ef4444', '#38bdf8', '#22c55e', '#ec4899', '#facc15'], p);
  if (kind === 'pigeon') return '#cbd5e1';
  if (kind === 'flowerPot') return pick(['#ef4444', '#facc15', '#ec4899', '#38bdf8'], p);
  if (kind === 'coffeeCup') return '#ffffff';
  if (kind === 'streetSign') return pick(['#2563eb', '#ef4444', '#16a34a'], p);
  if (kind === 'cone') return '#f97316';
  if (kind === 'hydrant') return '#ef4444';
  if (kind === 'trash') return '#22c55e';
  if (kind === 'barrel') return '#b45309';
  if (kind === 'ped') return pick(['#ef4444', '#22c55e', '#38bdf8', '#facc15', '#ec4899'], p);
  if (kind === 'car') return pick(['#ef4444', '#38bdf8', '#facc15', '#a855f7', '#22c55e'], p);
  if (kind === 'taxi') return '#facc15';
  if (kind === 'shed') return pick(['#facc15', '#2dd4bf', '#fb923c', '#f87171'], p);
  if (kind === 'cottage') return pick(['#fda4af', '#fef3c7', '#7dd3fc', '#86efac'], p);
  if (kind === 'warehouse') return pick(['#ea580c', '#60a5fa', '#cbd5e1'], p);
  if (kind === 'townhouse') return pick(['#fb7185', '#fb923c', '#4ade80', '#fef08a'], p);
  if (kind === 'donutShop') return '#f472b6';
  if (kind === 'cavernClub') return '#fb7185';
  if (kind === 'apt') return pick(['#fb923c', '#60a5fa', '#34d399', '#f472b6'], p);
  if (kind === 'tower') return pick(['#60a5fa', '#38bdf8', '#a78bfa', '#34d399'], p);
  if (kind === 'sky') return pick(['#38bdf8', '#60a5fa', '#c084fc', '#fb7185'], p);
  if (kind === 'albertDock') return '#ea580c';
  if (kind === 'liverBuilding') return '#fcd34d';
  if (kind === 'stJellyHall') return '#fef3c7';
  if (kind === 'stadium') return '#ef4444';
  if (kind === 'wheel') return '#facc15';
  if (kind === 'tree') return '#22c55e';
  return '#22c55e';
}

function pick(arr, val) {
  return arr[Math.floor(val * arr.length) % arr.length];
}
