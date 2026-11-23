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
    parScore60s: 650,
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

  /* --------------------------------------------------- Real Liverpool Geographic District Engine */
  getDistrictInfo(x, y) {
    if (x < 2400) {
      return {
        id: 'docks',
        name: '⚓ Royal Albert Dock & Maritime Basins',
        turf: '#102235',
        street: '#1c1b26',
        cobble: true,
        desc: 'Interlocking water basins, red-brick warehouses, quayside swing bridges',
      };
    }
    if (x >= 2400 && x < 4500 && y < 9000) {
      return {
        id: 'strand',
        name: '🏛️ Pier Head & The Strand Grand Arterial Boulevard',
        turf: '#1e2438',
        street: '#141622',
        broadAvenue: true,
        desc: 'The Three Graces, grand Portland stone esplanades & 8-lane boulevard',
      };
    }
    if (x >= 4500 && x < 8500 && y < 8500) {
      return {
        id: 'civic',
        name: '🏛️ St. George\'s Neoclassical Plateau & Lime Street',
        turf: '#2a223a',
        street: '#242032',
        stonePlaza: true,
        desc: 'Sweeping classical terraces, bronze equestrian statues & Corinthian pillars',
      };
    }
    if (x >= 8500 && x < 13500 && y < 8000) {
      return {
        id: 'cavern',
        name: '🎸 The Cavern Quarter & Mathew Street Alleys',
        turf: '#341a24',
        street: '#2a1620',
        tightAlleys: true,
        desc: 'Winding cobblestone pedestrian alleys, brick archways & neon music pub signs',
      };
    }
    if (x >= 13500 && y < 7500) {
      return {
        id: 'theme',
        name: '🎡 Gummy Land & Pier Fairgrounds',
        turf: '#381635',
        street: '#28142c',
        carnival: true,
        desc: 'Giant Ferris wheel, candy floss pavilions & festive promenade',
      };
    }
    if (y >= 8500 && x < 8500) {
      return {
        id: 'georgian',
        name: '🌹 Georgian Quarter, Falkner Square & Hope St Axis',
        turf: '#163222',
        street: '#1c2232',
        gardenSquare: true,
        desc: 'Circular garden squares, London plane trees & twin monumental Cathedrals',
      };
    }
    if (y >= 8000 && x >= 8500) {
      return {
        id: 'stadium',
        name: '🏟️ Stanley Park Boating Lakes & Anfield Colosseum',
        turf: '#123028',
        street: '#14222a',
        parkLakes: true,
        desc: 'Curving ornamental lakes, football pitch turf markings & stadium forecourt',
      };
    }
    return {
      id: 'metro',
      name: '🏙️ Commercial Core & Diagonal Radial Boulevards',
      turf: '#1f223d',
      street: '#16192a',
      diagonal: true,
      desc: 'Historic radial boulevards fanning inward with triangular plazas',
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
    if (dist.id === 'docks') {
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
          }

          if (d < h.r - p.size * 0.3) {
            p.fall = 0.001;
            p.owner = h;
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
      p.x += (o.x - p.x) * Math.min(1, dt * 8.5);
      p.y += ((o.y + p.fall * o.r * 0.28) - p.y) * Math.min(1, dt * 8.5);
      p.rot += dt * 2.6;

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
      // Micro sweets: rate-limited ring to prevent particle bloat
      if (this.ringCooldown <= 0) {
        this.fx.ring(this.hole.x, this.hole.y, '#ffd166', this.hole.r * this.zoom * 1.2, 0.15, 2);
        this.ringCooldown = 0.08;
      }
    } else if (p.size < 20) {
      if (this.ringCooldown <= 0) {
        this.fx.ring(this.hole.x, this.hole.y, '#25e6ff', this.hole.r * this.zoom * 1.3, 0.2, 2.5);
        this.ringCooldown = 0.08;
      }
    } else if (p.size < 40) {
      this.fx.ring(this.hole.x, this.hole.y, '#ffd166', this.hole.r * this.zoom * 1.45, 0.25, 3);
      if (this.eatTextCooldown <= 0) {
        this.fx.text(this.hole.x, this.hole.y - this.hole.r - 20 * k, `+${this.batchPts} PTS`, '#ffd166', 22);
        this.batchPts = 0;
        this.eatTextCooldown = 0.32;
      }
      this.haptics.light();
    } else {
      this.fx.ring(this.hole.x, this.hole.y, '#ff4fa3', this.hole.r * this.zoom * 1.7, 0.35, 4);
      this.fx.burst(this.hole.x, this.hole.y, '#ffd166', 10, 130 * k, 0.45, 3);
      this.fx.shake(3.5, 0.18);
      if (this.eatTextCooldown <= 0) {
        this.fx.text(this.hole.x, this.hole.y - this.hole.r - 24 * k, `DEVOUR! +${this.batchPts}`, '#ff4fa3', 24);
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

    ctx.fillStyle = '#0a0d1a';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(ox + off.x, oy + off.y);
    ctx.scale(sc, sc);
    ctx.translate(-h.x, -h.y);

    // 1. Draw 2.5D Neon Urban Map & Moving Avenue Trams
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

    // 3. Draw Rivals (with Threat Auras & Targeting Telegraph)
    for (const rv of this.rivals) {
      if (rv.dead) continue;
      const isThreat = rv.r > h.r + 10;
      const isPrey = h.r >= rv.r + 2;
      const rim = rv.surging ? '#ff0054' : isThreat ? '#ff0054' : isPrey ? '#00f5d4' : '#ffd166';

      if (rv.telegraphT > 0) {
        ctx.save();
        ctx.strokeStyle = '#ff0054';
        ctx.lineWidth = Math.max(2, 3.5 / sc);
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

    // 4. Draw Player 2.5D Donut Hole + Mascot Peek (flash crimson ring when rim is partially tugged)
    const rimThreat = this.rimThreatPull > 0.12;
    this.drawHole(h, rimThreat ? '#ff0054' : '#25e6ff', '#25e6ff', 'YOU', true, rimThreat);

    // 5. Draw 2.5D Extruded Tall Props Back-to-Front by Ground Y (fade giant roofs occluding player)
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

    // 5. Draw Danger Screen Vignette if hunted
    if (this.dangerIntensity > 0.05) {
      this.drawDangerVignette(ctx, W, H);
    }

    this.drawRivalIndicators(ctx, ox, oy, sc, W, H);
    this.drawLeaderboard(ctx, W, H);
    this.drawRadar(ctx, W, H);
    this.drawDistrictHUD(ctx, W, H);
    this.drawBoostButton(ctx, W, H);

    // 7. Apex Invulnerability & Victory Countdown Pill
    if (this.isMaxSize()) {
      ctx.save();
      const bannerW = 300;
      const bannerH = 42;
      const bannerX = W / 2 - bannerW / 2;
      const bannerY = 82;

      drawToyBevelRect(ctx, bannerX, bannerY, bannerW, bannerH, 12, '#fde047', {
        depth: 3,
        rimColor: '#713f12',
        lineWidth: 2.2,
      });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = "800 12.5px 'Fredoka', 'Outfit', sans-serif";
      ctx.fillStyle = '#451a03';
      if (this.victoryTimer > 0) {
        ctx.fillText(`👑 APEX VICTORY IN ${Math.max(1, Math.ceil(this.victoryTimer))}s · [TAP TO WIN]`, W / 2, bannerY + bannerH / 2);
      } else {
        ctx.fillText('👑 APEX SINGULARITY (INVULNERABLE) 👑', W / 2, bannerY + bannerH / 2);
      }
      ctx.restore();
    }
  }

  /* --------------------------------------------------- Live Top 5 Competitor Leaderboard */
  drawLeaderboard(ctx, W, H) {
    const competitors = [
      { name: 'YOU', r: this.hole.r, isPlayer: true, col: '#25e6ff', boss: false },
      ...this.rivals.filter(r => !r.dead).map(r => ({
        name: r.name,
        r: r.r,
        isPlayer: false,
        col: r.color,
        boss: r.boss,
      }))
    ];
    competitors.sort((a, b) => b.r - a.r);

    const playerRank = competitors.findIndex(c => c.isPlayer) + 1;
    const top3 = competitors.slice(0, 3);
    const playerInTop3 = playerRank <= 3;

    const lx = 12;
    const ly = 100;
    const lw = 136;
    const lh = playerInTop3 ? 90 : 110;

    ctx.save();
    drawToyBevelRect(ctx, lx, ly, lw, lh, 12, '#0f172a', {
      depth: 3,
      rimColor: '#334155',
      lineWidth: 2,
      gloss: false,
    });

    ctx.fillStyle = '#ffd166';
    ctx.font = "800 10.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText('👑 TOP VOIDS', lx + 10, ly + 17);

    const medals = ['🥇', '🥈', '🥉'];
    top3.forEach((c, idx) => {
      const rowY = ly + 35 + idx * 18;
      if (c.isPlayer) {
        drawToyPill(ctx, lx + 6, rowY - 11, lw - 12, 15, '#0369a1', {
          rimColor: '#38bdf8',
          lineWidth: 1,
          gloss: true,
        });
      }
      ctx.font = "700 10px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'left';
      ctx.fillStyle = c.isPlayer ? '#e0f2fe' : 'rgba(255,255,255,0.9)';
      const nm = c.name.length > 9 ? `${c.name.slice(0, 8)}…` : c.name;
      ctx.fillText(`${medals[idx]} ${nm}`, lx + 9, rowY);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(Math.round(c.r), lx + lw - 9, rowY);
    });

    if (!playerInTop3) {
      const youY = ly + lh - 11;
      drawToyPill(ctx, lx + 6, youY - 11, lw - 12, 15, '#0369a1', {
        rimColor: '#38bdf8',
        lineWidth: 1,
        gloss: true,
      });
      ctx.font = "800 10px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e0f2fe';
      ctx.fillText(`#${playerRank} YOU`, lx + 9, youY);
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(this.hole.r), lx + lw - 9, youY);
    }

    ctx.restore();
  }

  /* --------------------------------------------------- Liverpool Bird's Eye Map Drawing */
  drawCityMap(ctx, h, halfW, halfT, halfB) {
    const minX = Math.max(0, h.x - halfW);
    const maxX = Math.min(WORLD, h.x + halfW);
    const minY = Math.max(0, h.y - halfT);
    const maxY = Math.min(WORLD, h.y + halfB);

    ctx.fillStyle = '#0c1020';
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

        // Performance LOD: When zoomed out, draw sleek stylized block districts
        if (this.zoom < 0.35) {
          ctx.fillStyle = dist.turf;
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);
          ctx.fillStyle = dist.street;
          ctx.fillRect(bx, by, CHUNK_SIZE, 60);
          ctx.fillRect(bx, by, 60, CHUNK_SIZE);
          continue;
        }

        // 1. THE RIVER MERSEY & ENCLOSED DOCK BASINS (West: bx < 2400)
        if (bx < 2400) {
          if (bx < 800) {
            ctx.fillStyle = '#081d32';
            ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);
            ctx.strokeStyle = 'rgba(0, 245, 212, 0.28)';
            ctx.lineWidth = 4;
            for (let w = 0; w < 4; w++) {
              const wy = by + w * 150 + Math.sin(this.time * 2.2 + w * 1.5) * 20;
              ctx.beginPath();
              ctx.moveTo(bx + 30, wy);
              ctx.bezierCurveTo(bx + 180, wy - 30, bx + 360, wy + 30, bx + 570, wy);
              ctx.stroke();
            }
            continue;
          }

          // Royal Albert Dock Rectangular Basin Quayside
          ctx.fillStyle = '#262430';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          ctx.fillStyle = '#0a2338';
          this.rr(bx + 80, by + 80, CHUNK_SIZE - 160, CHUNK_SIZE - 160, 16);
          ctx.fill();

          ctx.strokeStyle = '#4a5568';
          ctx.lineWidth = 6;
          this.rr(bx + 80, by + 80, CHUNK_SIZE - 160, CHUNK_SIZE - 160, 16);
          ctx.stroke();

          ctx.fillStyle = '#4a3728';
          ctx.fillRect(bx + 20, by + 20, CHUNK_SIZE - 40, 50);
          ctx.fillRect(bx + 20, by + CHUNK_SIZE - 70, CHUNK_SIZE - 40, 50);
          continue;
        }

        // 2. THE STRAND MULTI-LANE BOULEVARD (bx: 2400..3600, by < 9000)
        if (dist.broadAvenue && (gx % 3 === 0)) {
          ctx.fillStyle = '#181b28';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          ctx.fillStyle = '#12141f';
          ctx.fillRect(bx + 120, by, CHUNK_SIZE - 240, CHUNK_SIZE);

          ctx.fillStyle = '#1c3628';
          ctx.fillRect(bx + 285, by, 30, CHUNK_SIZE);

          ctx.fillStyle = 'rgba(255, 209, 102, 0.22)';
          ctx.fillRect(bx + 130, by, 35, CHUNK_SIZE);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 3;
          ctx.setLineDash([18, 22]);
          [bx + 210, bx + 390].forEach((lx) => {
            ctx.beginPath();
            ctx.moveTo(lx, by);
            ctx.lineTo(lx, by + CHUNK_SIZE);
            ctx.stroke();
          });
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          for (let z = 0; z < 14; z++) {
            ctx.fillRect(bx + 130 + z * 24, by + 120, 14, 45);
          }
          continue;
        }

        // 3. FALKNER SQUARE & GEORGIAN GARDEN SQUARES (Georgian Quarter)
        if (dist.gardenSquare && (gx % 2 === 1 && gy % 2 === 1)) {
          ctx.fillStyle = dist.street;
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          ctx.fillStyle = '#22283a';
          ctx.beginPath();
          ctx.arc(bx + 300, by + 300, 220, 0, TAU);
          ctx.fill();

          ctx.fillStyle = '#1b4332';
          ctx.beginPath();
          ctx.arc(bx + 300, by + 300, 180, 0, TAU);
          ctx.fill();

          ctx.strokeStyle = toyRim('#1b4332', 0.55);
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.strokeStyle = '#d4a373';
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.moveTo(bx + 170, by + 170); ctx.lineTo(bx + 430, by + 430);
          ctx.moveTo(bx + 430, by + 170); ctx.lineTo(bx + 170, by + 430);
          ctx.stroke();

          ctx.fillStyle = '#40916c';
          ctx.beginPath();
          ctx.arc(bx + 300, by + 300, 50, 0, TAU);
          ctx.fill();
          continue;
        }

        // 4. STANLEY PARK CURVED BOATING LAKES (Anfield District)
        if (dist.parkLakes && (gx % 2 === 0 && gy % 2 === 1)) {
          ctx.fillStyle = '#12261f';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          ctx.fillStyle = '#0d3246';
          ctx.beginPath();
          ctx.ellipse(bx + 300, by + 300, 240, 160, 0.35, 0, TAU);
          ctx.fill();

          ctx.strokeStyle = 'rgba(78, 205, 196, 0.4)';
          ctx.lineWidth = 5;
          ctx.stroke();

          ctx.fillStyle = '#b2533e';
          this.rr(bx + 260, by + 160, 80, 280, 8);
          ctx.fill();
          continue;
        }

        // 5. ST GEORGE'S PLATEAU & NEOCLASSICAL STONE PLAZAS
        if (dist.stonePlaza) {
          ctx.fillStyle = '#1c1828';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          ctx.fillStyle = '#3d3448';
          this.rr(bx + 60, by + 60, CHUNK_SIZE - 120, CHUNK_SIZE - 120, 18);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 2;
          for (let s = 1; s < 4; s++) {
            ctx.beginPath();
            ctx.moveTo(bx + 60 + s * 120, by + 60);
            ctx.lineTo(bx + 60 + s * 120, by + CHUNK_SIZE - 60);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bx + 60, by + 60 + s * 120);
            ctx.lineTo(bx + CHUNK_SIZE - 60, by + 60 + s * 120);
            ctx.stroke();
          }

          ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(bx + 300, by + 300, 90, 0, TAU);
          ctx.stroke();
          continue;
        }

        // 6. THE CAVERN QUARTER TIGHT COBBLESTONE ALLEYS
        if (dist.tightAlleys) {
          ctx.fillStyle = '#181119';
          ctx.fillRect(bx, by, CHUNK_SIZE, CHUNK_SIZE);

          ctx.fillStyle = '#2d1e28';
          ctx.fillRect(bx, by + 250, CHUNK_SIZE, 100);
          ctx.fillRect(bx + 250, by, 100, CHUNK_SIZE);

          ctx.strokeStyle = 'rgba(255, 112, 166, 0.18)';
          ctx.lineWidth = 2;
          for (let c = 0; c < 12; c++) {
            ctx.beginPath();
            ctx.moveTo(bx + c * 50, by + 250);
            ctx.lineTo(bx + c * 50 + 40, by + 350);
            ctx.stroke();
          }

          ctx.strokeStyle = 'rgba(255, 214, 10, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx + 200, by + 250);
          ctx.quadraticCurveTo(bx + 300, by + 280, bx + 400, by + 250);
          ctx.stroke();
          continue;
        }

        // 7. 2.5D NEON CITY STREETS, ZEBRA CROSSWALKS, CURBS & PARK BLOCKS
        ctx.fillStyle = '#0e1326';
        ctx.fillRect(bx, by, CHUNK_SIZE, 84);
        ctx.fillRect(bx, by, 84, CHUNK_SIZE);

        // Raised sidewalk curb with 2.5D top highlight
        ctx.fillStyle = '#1d2544';
        ctx.fillRect(bx + 84, by + 84, CHUNK_SIZE - 84, 38);
        ctx.fillRect(bx + 84, by + 84, 38, CHUNK_SIZE - 84);
        ctx.fillStyle = '#2d3a66';
        ctx.fillRect(bx + 84, by + 84, CHUNK_SIZE - 84, 4);
        ctx.fillRect(bx + 84, by + 84, 4, CHUNK_SIZE - 84);

        // White zebra crosswalk bars at every block intersection
        ctx.fillStyle = 'rgba(245, 248, 255, 0.72)';
        for (let z = 0; z < 4; z++) {
          ctx.fillRect(bx + 92 + z * 16, by + 16, 9, 52);
          ctx.fillRect(bx + 16, by + 92 + z * 16, 52, 9);
        }

        if ((gx + gy) % 4 === 0) {
          // Lush park courtyard block with inner trimmed green turf
          ctx.fillStyle = '#173e34';
          this.rr(bx + 124, by + 124, CHUNK_SIZE - 144, CHUNK_SIZE - 144, 18);
          ctx.fill();
          ctx.fillStyle = '#225e4b';
          this.rr(bx + 150, by + 150, CHUNK_SIZE - 196, CHUNK_SIZE - 196, 12);
          ctx.fill();
        } else {
          ctx.fillStyle = dist.turf;
          this.rr(bx + 124, by + 124, CHUNK_SIZE - 144, CHUNK_SIZE - 144, 16);
          ctx.fill();
        }

        // Electric cyan neon road lane dashes
        ctx.strokeStyle = 'rgba(37, 230, 255, 0.38)';
        ctx.lineWidth = 3;
        ctx.setLineDash([16, 18]);
        ctx.beginPath();
        ctx.moveTo(bx + 160, by + 42); ctx.lineTo(bx + CHUNK_SIZE, by + 42);
        ctx.moveTo(bx + 42, by + 160); ctx.lineTo(bx + 42, by + CHUNK_SIZE);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Outer Boundary Ring
    ctx.strokeStyle = '#25e6ff';
    ctx.lineWidth = 14 / this.zoom;
    ctx.strokeRect(0, 0, WORLD, WORLD);
  }

  /* --------------------------------------------------- Ambient 2.5D Avenue Trams */
  drawAmbientTrams(ctx, h, halfW, halfT, halfB) {
    if (this.zoom < 0.3) return;
    const minY = h.y - halfT;
    const maxY = h.y + halfB;
    const minX = h.x - halfW;
    const maxX = h.x + halfW;

    for (let track = 1; track < CHUNKS_ACROSS; track += 3) {
      const ty = track * CHUNK_SIZE + 42;
      if (ty < minY - 60 || ty > maxY + 60) continue;

      // Subtle glowing tram rail lines
      ctx.strokeStyle = 'rgba(130, 160, 220, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.max(0, minX), ty - 7);
      ctx.lineTo(Math.min(WORLD, maxX), ty - 7);
      ctx.moveTo(Math.max(0, minX), ty + 7);
      ctx.lineTo(Math.min(WORLD, maxX), ty + 7);
      ctx.stroke();

      const dir = (track % 2 === 0) ? 1 : -1;
      const period = 3600;
      const offset = ((this.time * 165 * dir + track * 700) % period + period) % period;
      const startSeg = Math.floor(Math.max(0, minX) / period) * period;

      for (let seg = startSeg; seg <= Math.min(WORLD, maxX) + 300; seg += period) {
        const tx = seg + offset;
        if (tx < minX - 240 || tx > maxX + 240) continue;

        for (let car = 0; car < 3; car++) {
          const cx = tx - dir * car * 78;
          const roofCol = car % 2 === 1 ? '#f8fafc' : '#ff4b5c';
          drawToyShadow(ctx, cx, ty + 14, 34, 8, 0.28);

          // 3D Toy Vinyl Tram Body with extruded lower chassis & glossy roof
          drawToyBevelRect(ctx, cx - 33, ty - 22, 66, 26, 7, roofCol, {
            depth: 6,
            rimColor: toyRim(roofCol, 0.56),
            lineWidth: 1.5,
            gloss: true,
          });

          // Cream accent belt stripe
          ctx.fillStyle = car % 2 === 1 ? '#ef4444' : '#fde047';
          ctx.fillRect(cx - 31, ty - 6, 62, 3);

          // Glowing passenger windows
          ctx.fillStyle = '#fef08a';
          for (let w = -23; w <= 17; w += 12) {
            traceRoundRect(ctx, cx + w, ty - 16, 8, 7, 2);
            ctx.fill();
          }
        }
      }
    }
  }

  /* --------------------------------------------------- Danger Screen Vignette & Warning */
  drawDangerVignette(ctx, W, H) {
    const pulse = 0.6 + Math.sin(this.time * 9) * 0.4;
    const alpha = this.dangerIntensity * 0.45 * pulse;

    const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.72);
    g.addColorStop(0, 'rgba(255, 0, 84, 0)');
    g.addColorStop(1, `rgba(255, 0, 84, ${alpha.toFixed(2)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (this.closestHunter) {
      const h = this.hole;
      const hunter = this.closestHunter;
      const distM = Math.round(Math.hypot(hunter.x - h.x, hunter.y - h.y) / 25);

      ctx.save();
      drawToyPill(ctx, W / 2 - 124, 198, 248, 28, '#f43f5e', {
        rimColor: '#881337',
        lineWidth: 2,
        gloss: true,
      });

      ctx.font = "800 11px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = `⚠️ HUNTER: ${hunter.name.toUpperCase()} (${distM}m)`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0f172a';
      ctx.strokeText(label, W / 2, 212);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, W / 2, 212);
      ctx.restore();
    }
  }

  drawRadar(ctx, W, H) {
    const pad = 12;
    const size = 68;
    const rx = W - size - pad;
    const ry = 100;

    ctx.save();
    drawToyBevelRect(ctx, rx, ry, size, size, 13, '#0f172a', {
      depth: 3,
      rimColor: '#38bdf8',
      lineWidth: 2,
      gloss: false,
    });

    // Subtle sonar crosshairs
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + size / 2, ry + 6);
    ctx.lineTo(rx + size / 2, ry + size - 6);
    ctx.moveTo(rx + 6, ry + size / 2);
    ctx.lineTo(rx + size - 6, ry + size / 2);
    ctx.stroke();

    const scale = size / WORLD;

    // Find current #1 leader
    let maxR = this.hole.r;
    let leaderObj = this.hole;
    for (const rv of this.rivals) {
      if (!rv.dead && rv.r > maxR) {
        maxR = rv.r;
        leaderObj = rv;
      }
    }

    // Rivals on radar
    for (const rv of this.rivals) {
      if (rv.dead) continue;
      const x = rx + rv.x * scale;
      const y = ry + rv.y * scale;
      const isThreat = rv.r > this.hole.r + 10;
      ctx.fillStyle = rv.boss ? '#ffbe0b' : isThreat ? '#ff0054' : '#00f5d4';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.8, rv.r * scale * 1.5), 0, TAU);
      ctx.fill();
    }

    // Leader Crown Beacon on radar
    if (leaderObj) {
      const lx = rx + leaderObj.x * scale;
      const ly = ry + leaderObj.y * scale;
      drawToySphere(ctx, lx, ly, Math.max(3.2, leaderObj.r * scale * 2.0), '#ffd166', {
        rimColor: '#92400e',
        lineWidth: 0.9,
        bottomBounce: false,
      });
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑', lx, ly - 5);
    }

    // Player beacon on radar
    const px = rx + this.hole.x * scale;
    const py = ry + this.hole.y * scale;
    drawToySphere(ctx, px, py, Math.max(3.2, this.hole.r * scale * 2), '#25e6ff', {
      rimColor: '#0369a1',
      lineWidth: 1,
      bottomBounce: false,
    });

    ctx.restore();
  }

  drawDistrictHUD(ctx, W, H) {
    const t = this.getTier();
    const label = `TIER ${t.level} · SIZE ${Math.round(this.hole.r)}`;

    ctx.save();
    const pw = 124;
    const px = W / 2 - pw / 2;
    const py = 100;
    drawToyBevelRect(ctx, px, py, pw, 24, 12, '#0f172a', {
      depth: 2.5,
      rimColor: '#38bdf8',
      lineWidth: 1.8,
      gloss: false,
    });

    ctx.fillStyle = '#38bdf8';
    ctx.font = "800 10.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, py + 12.5);
    ctx.restore();
  }

  drawRivalIndicators(ctx, ox, oy, sc, W, H) {
    const h = this.hole;
    for (const rv of this.rivals) {
      if (rv.dead) continue;
      const sx = ox + (rv.x - h.x) * sc;
      const sy = oy + (rv.y - h.y) * sc;
      const m = 26;
      if (sx > m && sx < W - m && sy > 115 && sy < H - 76) continue;
      if (Math.hypot(rv.x - h.x, rv.y - h.y) > 2800) continue;

      const px = clamp(sx, m, W - m);
      const py = clamp(sy, 120, H - 84);
      const ang = Math.atan2(sy - py, sx - px);
      const isThreat = rv.r > h.r + 10;
      const isPrey = h.r >= rv.r + 2;
      const col = rv.boss ? '#ffbe0b' : isThreat ? '#f43f5e' : isPrey ? '#00f5d4' : '#ffe066';

      ctx.save();
      ctx.translate(px, py);
      ctx.fillStyle = isThreat ? 'rgba(244, 63, 94, 0.28)' : 'rgba(15, 23, 42, 0.45)';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.fill();

      ctx.rotate(ang);
      const ag = ctx.createLinearGradient(-9, -11, 16, 11);
      ag.addColorStop(0, shadeColor(col, 0.35));
      ag.addColorStop(1, col);
      ctx.fillStyle = ag;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  rr(x, y, w, h, r) {
    traceRoundRect(this.ctx, x, y, w, h, r);
  }

  drawHole(hl, rim, mascotCol, label, isPlayer = false, isThreat = false) {
    const ctx = this.ctx;
    const pulseScale = isPlayer && this.hole.pulse > 0 ? (1 + Math.sin(this.hole.pulse * Math.PI) * 0.16) : 1;
    const curR = hl.r * pulseScale;
    const ry = curR * 0.85;
    const collarW = Math.max(5.5, Math.min(20, curR * 0.16));

    if (isThreat) {
      const ringPulse = 1.12 + Math.sin(this.time * 8) * 0.12;
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.58)';
      ctx.lineWidth = Math.max(3, 4 / this.zoom);
      ctx.beginPath();
      ctx.ellipse(hl.x, hl.y, curR * ringPulse, ry * ringPulse, 0, 0, TAU);
      ctx.stroke();
    }

    // Soft ambient grounding shadow halo around collar base
    drawToyShadow(ctx, hl.x, hl.y + ry * 0.12, curR * 1.24, ry * 1.2, 0.34);

    // Recessed 2.5D pit shaft (rich plum-to-void inner wall)
    const pitGrad = ctx.createLinearGradient(hl.x, hl.y - ry, hl.x, hl.y + ry * 0.85);
    pitGrad.addColorStop(0, '#3b0764');
    pitGrad.addColorStop(0.32, '#1e0632');
    pitGrad.addColorStop(0.72, '#070212');
    pitGrad.addColorStop(1, '#020005');
    ctx.fillStyle = pitGrad;
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y, curR, ry, 0, 0, TAU);
    ctx.fill();

    // Inner depth rings so the drop looks carved into the street
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.22)';
    ctx.lineWidth = Math.max(1.5, 2.5 / this.zoom);
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y + ry * 0.1, curR * 0.82, ry * 0.78, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(12, 20, 42, 0.55)';
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y + ry * 0.18, curR * 0.62, ry * 0.58, 0, 0, TAU);
    ctx.stroke();

    // Clipped tumbling props spiraling into the pit
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y, curR, ry, 0, 0, TAU);
    ctx.clip();
    for (const p of this.fallingProps) {
      if (p.owner === hl) {
        this.drawProp(p, Math.max(0.15, 1 - p.fall * 0.72), Math.max(0, 1 - p.fall * 0.48));
      }
    }
    ctx.restore();

    // 3D Volumetric Vinyl Toy Donut Collar (bottom depth lip + tinted outer rim + glossy studio gradient)
    ctx.lineWidth = collarW + Math.max(2.2, 2.6 / this.zoom);
    ctx.strokeStyle = toyRim(rim, 0.58);
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y + collarW * 0.2, curR, ry, 0, 0, TAU);
    ctx.stroke();

    const collarGrad = ctx.createLinearGradient(hl.x, hl.y - ry, hl.x, hl.y + ry);
    collarGrad.addColorStop(0, shadeColor(rim, 0.36));
    collarGrad.addColorStop(0.5, rim);
    collarGrad.addColorStop(1, shadeColor(rim, -0.22));
    ctx.lineWidth = collarW;
    ctx.strokeStyle = collarGrad;
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y, curR, ry, 0, 0, TAU);
    ctx.stroke();

    // Outer hairline tinted rim
    ctx.lineWidth = toyLineW(curR * 2, 0.028, 1.0, 2.4);
    ctx.strokeStyle = toyRim(rim, 0.56);
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y, curR + collarW * 0.48, ry + collarW * 0.48, 0, 0, TAU);
    ctx.stroke();

    // Specular upper-lip highlight on collar
    ctx.lineWidth = Math.max(1.8, collarW * 0.3);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.beginPath();
    ctx.ellipse(hl.x, hl.y - collarW * 0.18, curR - collarW * 0.1, ry - collarW * 0.1, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    // Mascot perched cleanly on the upper rim lip so center pit stays open
    const beanSize = Math.max(22, Math.min(48, curR * 0.62));
    drawBean(ctx, hl.x, hl.y - ry * 0.96, beanSize, {
      ufo: false,
      color: mascotCol || (isPlayer ? '#25e6ff' : '#ff4fa3'),
      bellyColor: isPlayer ? '#ff758f' : '#ffe066',
      walkT: this.time * 2.8,
      squash: isPlayer ? this.beanSquash : 1,
      dir: (hl.vx || 0) < -1 ? -1 : 1,
      eyes: isThreat ? (isPlayer ? 'alert' : 'angry') : 'happy',
      hat: hl.boss ? 'crown' : isPlayer && this.hole.r >= 54 ? 'crown' : null,
    });

    if (!isPlayer && label) {
      ctx.save();
      ctx.font = `800 ${Math.max(11, Math.round(14 / this.zoom))}px 'Fredoka', 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2.5, 3.5 / this.zoom);
      ctx.strokeStyle = '#0f172a';
      const labelY = hl.y - ry - beanSize * 1.15 - 6;
      ctx.strokeText(label, hl.x, labelY);
      ctx.fillStyle = isThreat ? '#fda4af' : '#f8fafc';
      ctx.fillText(label, hl.x, labelY);
      ctx.restore();
    }
  }

  /* --------------------------------------------------- 2.5D Extruded Building Helper */
  drawExtrudedBox(w, d, h, topCol, opts = {}) {
    const ctx = this.ctx;
    const hw = w * 0.5;
    const hd = d * 0.5;
    const zoom = this.zoom;
    const wallCol = opts.wallCol || shadeColor(topCol, -0.3);
    const darkWall = opts.darkWall || shadeColor(topCol, -0.52);
    const trimCol = opts.trimCol || shadeColor(topCol, 0.24);
    const padCol = opts.padCol || shadeColor(topCol, -0.14);
    const rim = toyRim(wallCol, 0.56);
    const lw = toyLineW(Math.min(w, h), 0.036, 0.75, 1.8);

    // Diagonal bottom-right oblique diorama shadow
    ctx.fillStyle = 'rgba(12, 20, 42, 0.30)';
    ctx.beginPath();
    ctx.moveTo(hw, -hd);
    ctx.lineTo(hw + h * 0.34, -hd + h * 0.24);
    ctx.lineTo(hw + h * 0.34, hd + h * 0.24);
    ctx.lineTo(-hw + h * 0.2, hd + h * 0.24);
    ctx.lineTo(-hw, hd);
    ctx.closePath();
    ctx.fill();

    // Right chamfered 3D side strip (subtle depth cue)
    const sideW = Math.min(w * 0.14, 10);
    ctx.fillStyle = darkWall;
    ctx.fillRect(hw - sideW, hd - h, sideW, h);

    // Front extruded facade wall
    const frontGrad = ctx.createLinearGradient(0, hd - h, 0, hd);
    frontGrad.addColorStop(0, shadeColor(wallCol, 0.12));
    frontGrad.addColorStop(1, darkWall);
    ctx.fillStyle = frontGrad;
    ctx.fillRect(-hw, hd - h, w - sideW * 0.45, h);

    // Subtle side-strip vertical divider
    ctx.fillStyle = 'rgba(12, 20, 42, 0.18)';
    ctx.fillRect(hw - sideW, hd - h, 1.2, h);

    // Lit window grid on front facade (skip when tiny on screen)
    const facadeW = w - sideW;
    if (h >= 12 && facadeW * zoom > 8) {
      const floors = opts.floors ?? clamp(Math.floor((h - 8) / 16), 1, 7);
      const cols = opts.cols ?? clamp(Math.floor((facadeW - 8) / 18), 2, 8);
      const winW = clamp((facadeW - 10) / (cols * 2.0), 3, 13);
      const winH = clamp((h - 10) / (floors * 1.75), 3, 14);
      const stepX = (facadeW - 8) / cols;
      const stepY = (h - 8) / floors;
      const warmWin = opts.winCol || '#ffe89c';
      const coolWin = opts.winAltCol || '#8be9fd';

      for (let r = 0; r < floors; r++) {
        for (let c = 0; c < cols; c++) {
          if (opts.door !== false && r === floors - 1 && cols >= 3 && c === Math.floor(cols / 2)) continue;
          const wx = -hw + 4 + c * stepX + (stepX - winW) * 0.5;
          const wy = hd - h + 4 + r * stepY + (stepY - winH) * 0.5;
          ctx.fillStyle = (r + c) % 3 === 0 ? warmWin : coolWin;
          traceRoundRect(ctx, wx, wy, winW, winH, Math.min(2, winW * 0.25));
          ctx.fill();
        }
      }
    }

    // Crisp tinted rim outline around facade base so buildings pop like 3D toys
    ctx.strokeStyle = rim;
    ctx.lineWidth = lw;
    ctx.strokeRect(-hw, hd - h, w, h);

    // Ground-floor lobby doorway or colorful awning
    if (opts.door !== false && w >= 16 && h >= 14) {
      const dw = Math.min(w * 0.24, 11);
      const dh = Math.min(h * 0.34, 10);
      ctx.fillStyle = opts.doorCol || '#1e293b';
      traceRoundRect(ctx, -dw * 0.5 - sideW * 0.25, hd - dh, dw, dh, 2);
      ctx.fill();
      if (opts.awningCol) {
        drawToyBevelRect(ctx, -dw * 0.8 - sideW * 0.25, hd - dh - 3, dw * 1.6, 4.5, 2, opts.awningCol, {
          depth: 1.5,
          rimColor: toyRim(opts.awningCol),
          lineWidth: 0.8,
          gloss: true,
        });
      }
    }

    // Parapet cornice trim between facade and roof
    ctx.fillStyle = trimCol;
    ctx.fillRect(-hw - 1, hd - h - 2, w + 2, 3.5);

    // Roof top face with soft studio gradient
    const rY = -hd - h;
    const roofGrad = ctx.createLinearGradient(-hw, rY, hw, rY + d);
    roofGrad.addColorStop(0, shadeColor(topCol, 0.22));
    roofGrad.addColorStop(0.55, topCol);
    roofGrad.addColorStop(1, shadeColor(topCol, -0.14));
    ctx.fillStyle = roofGrad;
    this.rr(-hw - 1, rY, w + 2, d, Math.min(6, w * 0.12));
    ctx.fill();
    ctx.strokeStyle = toyRim(topCol, 0.54);
    ctx.lineWidth = lw;
    ctx.stroke();

    // Inner recessed roof pad
    const inset = Math.max(2.5, Math.min(w, d) * 0.14);
    if (w > inset * 2.4 && d > inset * 2.4) {
      ctx.fillStyle = padCol;
      this.rr(-hw + inset, rY + inset, w - inset * 2, d - inset * 2, Math.min(4, inset * 0.6));
      ctx.fill();
    }

    // Optional HVAC / AC boxes on roof
    if (opts.acUnits && w >= 24 && d >= 20) {
      drawToyBevelRect(ctx, -hw + inset + 2, rY + inset + 2, w * 0.22, d * 0.22, 2.5, '#e2e8f0', {
        depth: 2,
        rimColor: '#64748b',
        lineWidth: 0.75,
        gloss: true,
      });
      if (w >= 34) {
        drawToyBevelRect(ctx, hw - inset - w * 0.24, rY + d - inset - d * 0.28, w * 0.2, d * 0.2, 2.5, '#cbd5e1', {
          depth: 2,
          rimColor: '#64748b',
          lineWidth: 0.75,
          gloss: true,
        });
      }
    }

    // Crisp specular top-left edge highlight on parapet
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-hw - 0.5, rY + d * 0.7);
    ctx.lineTo(-hw - 0.5, rY + 2);
    ctx.lineTo(hw - 1, rY + 2);
    ctx.stroke();
  }

  /* --------------------------------------------------- Prop Drawing Library */
  drawProp(p, alpha, scale) {
    const ctx = this.ctx;
    const s = p.size * scale;
    // Sub-pixel culling: when zoomed out, skip full path geometry for sub-pixel debris
    if (s * this.zoom < 1.3) {
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      return;
    }
    const col = p.col;
    const lw = toyLineW(s * 2, 0.04, 0.75, 2.0);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    // Only tilt upright structures while spiraling into the hole; keep street landmarks strictly vertical
    const isRotProp = p.kind === 'car' || p.kind === 'taxi' || p.kind === 'truck' || p.kind === 'doubleDecker' || p.kind === 'sugarDrop' || p.kind === 'sweetWrapper';
    if (isRotProp || p.fall > 0) {
      ctx.rotate(p.rot);
    }

    // Grounding toy shadow (skip for buildings since drawExtrudedBox casts its own 2.5D shadow)
    if (p.fall <= 0 && !EXTRUDED_PROP_KINDS.has(p.kind)) {
      drawToyShadow(ctx, s * 0.14, s * 0.28, s * 0.96, s * 0.56, 0.26);
    }

    switch (p.kind) {
      case 'sugarDrop': {
        // Plump glossy 3D vinyl jellybean drop
        const beanGrad = ctx.createRadialGradient(-s * 0.32, -s * 0.28, s * 0.08, 0, -s * 0.1, s * 1.15);
        beanGrad.addColorStop(0, shadeColor(col, 0.48));
        beanGrad.addColorStop(0.45, col);
        beanGrad.addColorStop(1, shadeColor(col, -0.34));
        ctx.fillStyle = beanGrad;
        ctx.strokeStyle = toyRim(col, 0.56);
        ctx.lineWidth = lw * 0.85;
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.1, s * 1.12, s * 0.8, -0.25, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
        ctx.beginPath();
        ctx.ellipse(-s * 0.34, -s * 0.36, s * 0.38, s * 0.15, -0.35, 0, TAU);
        ctx.fill();
        break;
      }

      case 'sweetWrapper': {
        // Glossy candy wrapper with twisted bowtie ends
        const wRim = toyRim(col, 0.54);
        ctx.fillStyle = shadeColor(col, 0.18);
        ctx.strokeStyle = wRim;
        ctx.lineWidth = lw * 0.85;
        ctx.beginPath();
        ctx.moveTo(-s * 1.2, -s * 0.5); ctx.lineTo(-s * 0.5, 0); ctx.lineTo(-s * 1.2, s * 0.5);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 1.2, -s * 0.5); ctx.lineTo(s * 0.5, 0); ctx.lineTo(s * 1.2, s * 0.5);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        drawToyBevelRect(ctx, -s * 0.62, -s * 0.52, s * 1.24, s * 1.04, 3, col, {
          depth: 1.5,
          rimColor: wRim,
          lineWidth: lw * 0.85,
          gloss: true,
        });
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.fillRect(-s * 0.16, -s * 0.5, s * 0.32, s * 1.0);
        break;
      }

      case 'sodaCan': {
        drawToyBevelRect(ctx, -s * 0.7, -s * 1.25, s * 1.4, s * 2.05, 3, col, {
          depth: 2,
          rimColor: toyRim(col, 0.56),
          lineWidth: lw * 0.9,
          gloss: true,
        });
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 0.85;
        ctx.beginPath(); ctx.ellipse(0, -s * 1.15, s * 0.65, s * 0.25, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.arc(0, -s * 1.15, s * 0.16, 0, TAU); ctx.fill();
        break;
      }

      case 'pigeon': {
        const pRim = toyRim('#94a3b8', 0.55);
        const pg = ctx.createRadialGradient(-s * 0.2, -s * 0.2, s * 0.1, 0, 0, s * 1.1);
        pg.addColorStop(0, '#e2e8f0');
        pg.addColorStop(0.6, '#94a3b8');
        pg.addColorStop(1, '#64748b');
        ctx.fillStyle = pg;
        ctx.strokeStyle = pRim;
        ctx.lineWidth = lw * 0.85;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.1, s * 0.74, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.beginPath(); ctx.ellipse(-s * 0.12, -s * 0.16, s * 0.58, s * 0.32, 0.35, 0, TAU); ctx.fill();
        drawToySphere(ctx, s * 0.68, -s * 0.35, s * 0.42, '#f8fafc', { rimColor: pRim, lineWidth: lw * 0.8 });
        ctx.fillStyle = '#ff9f1c';
        ctx.beginPath(); ctx.moveTo(s * 1.05, -s * 0.38); ctx.lineTo(s * 1.46, -s * 0.33); ctx.lineTo(s * 1.05, -s * 0.14); ctx.closePath(); ctx.fill();
        drawToyEyes(ctx, s * 0.78, -s * 0.4, s * 0.12, { spacing: 0, lookX: 0.4 });
        break;
      }

      case 'flowerPot':
        drawToyBevelRect(ctx, -s * 0.75, -s * 0.2, s * 1.5, s * 1.2, 3, '#b45309', {
          depth: 2,
          rimColor: toyRim('#b45309'),
          lineWidth: lw * 0.85,
          gloss: false,
        });
        drawToyBevelRect(ctx, -s * 0.85, -s * 0.42, s * 1.7, s * 0.42, 2.5, '#d97706', {
          depth: 1.5,
          rimColor: toyRim('#d97706'),
          lineWidth: lw * 0.8,
        });
        drawToySphere(ctx, 0, -s * 0.58, s * 0.68, '#10b981', { lineWidth: lw * 0.85 });
        drawToySphere(ctx, 0, -s * 0.8, s * 0.38, col, { lineWidth: lw * 0.85 });
        break;

      case 'coffeeCup':
        drawToyBevelRect(ctx, -s * 0.65, -s * 1.1, s * 1.3, s * 1.95, 3, '#f8fafc', {
          depth: 2,
          rimColor: '#64748b',
          lineWidth: lw * 0.85,
        });
        ctx.fillStyle = '#b45309';
        ctx.fillRect(-s * 0.63, -s * 0.35, s * 1.26, s * 0.7);
        drawToyBevelRect(ctx, -s * 0.75, -s * 1.26, s * 1.5, s * 0.36, 2.5, '#e2e8f0', {
          depth: 1.5,
          rimColor: '#64748b',
          lineWidth: lw * 0.8,
        });
        break;

      case 'streetSign':
        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = lw * 0.75;
        ctx.fillRect(-s * 0.12, -s * 0.8, s * 0.24, s * 1.8);
        ctx.strokeRect(-s * 0.12, -s * 0.8, s * 0.24, s * 1.8);
        drawToySphere(ctx, 0, -s * 1.05, s * 0.82, col, { lineWidth: lw * 0.9 });
        drawToySphere(ctx, 0, -s * 1.05, s * 0.46, '#ffffff', { rimColor: toyRim(col), lineWidth: lw * 0.6, bottomBounce: false });
        break;

      case 'cone': {
        drawToyBevelRect(ctx, -s * 0.9, s * 0.15, s * 1.8, s * 0.58, 3, col, {
          depth: 2,
          rimColor: toyRim(col),
          lineWidth: lw * 0.85,
        });
        const cg = ctx.createLinearGradient(-s * 0.6, -s * 1.2, s * 0.6, s * 0.3);
        cg.addColorStop(0, shadeColor(col, 0.35));
        cg.addColorStop(0.5, col);
        cg.addColorStop(1, shadeColor(col, -0.25));
        ctx.fillStyle = cg;
        ctx.strokeStyle = toyRim(col);
        ctx.lineWidth = lw * 0.85;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 0.7, s * 0.35);
        ctx.lineTo(-s * 0.18, -s * 1.35);
        ctx.lineTo(s * 0.18, -s * 1.35);
        ctx.lineTo(s * 0.7, s * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(-s * 0.48, -s * 0.25);
        ctx.lineTo(-s * 0.33, -s * 0.75);
        ctx.lineTo(s * 0.33, -s * 0.75);
        ctx.lineTo(s * 0.48, -s * 0.25);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'hydrant':
        drawToyBevelRect(ctx, -s * 0.52, -s * 0.95, s * 1.04, s * 1.25, 3.5, col, {
          depth: 2,
          rimColor: toyRim(col),
          lineWidth: lw * 0.9,
        });
        drawToyPill(ctx, -s * 0.75, -s * 0.48, s * 1.5, s * 0.3, '#e2e8f0', { rimColor: '#475569', lineWidth: lw * 0.75 });
        drawToySphere(ctx, 0, -s * 0.96, s * 0.42, '#ffd166', { rimColor: '#92400e', lineWidth: lw * 0.8 });
        break;

      case 'trash':
        this.drawExtrudedBox(s * 1.7, s * 1.2, s * 1.1, shadeColor(col, 0.14), { wallCol: col, door: false });
        break;

      case 'barrel':
        drawToyBevelRect(ctx, -s * 0.72, -s * 1.1, s * 1.44, s * 1.7, s * 0.3, col, {
          depth: 2.5,
          rimColor: toyRim(col),
          lineWidth: lw * 0.9,
        });
        ctx.fillStyle = shadeColor(col, 0.24);
        ctx.strokeStyle = toyRim(col);
        ctx.lineWidth = lw * 0.8;
        ctx.beginPath(); ctx.ellipse(0, -s * 1.0, s * 0.72, s * 0.32, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#334155';
        ctx.fillRect(-s * 0.71, -s * 0.42, s * 1.42, s * 0.18);
        break;

      case 'bollard':
        drawToyPill(ctx, -s * 0.46, -s * 1.1, s * 0.92, s * 1.55, '#334155', {
          rimColor: '#0f172a',
          lineWidth: lw * 0.9,
        });
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-s * 0.44, -s * 0.65, s * 0.88, s * 0.28);
        break;

      case 'redPhoneBox':
        this.drawExtrudedBox(s * 1.15, s * 1.15, s * 1.9, '#e63946', {
          wallCol: '#d90429',
          winCol: '#ffffff',
          winAltCol: '#dbeafe',
          floors: 3,
          cols: 2,
          door: false,
        });
        break;

      case 'mailbox':
        this.drawExtrudedBox(s * 1.1, s * 1.0, s * 1.4, shadeColor(col, 0.14), {
          wallCol: col,
          door: false,
          floors: 1,
        });
        break;

      case 'ped':
        drawBean(ctx, 0, -s * 0.25, s * 1.75, {
          color: col,
          bellyColor: '#ffffff',
          walkT: p.animT * 4,
          dir: p.vx < 0 ? -1 : 1,
          eyes: p.fall > 0 ? 'squish' : 'happy',
        });
        break;

      case 'bench':
        drawToyBevelRect(ctx, -s, -s * 0.5, s * 2, s * 0.9, 3, '#8b5a2b', {
          depth: 2.5,
          rimColor: toyRim('#8b5a2b'),
          lineWidth: lw * 0.9,
        });
        ctx.fillStyle = '#d4a373';
        ctx.fillRect(-s * 0.88, -s * 0.65, s * 1.76, s * 0.24);
        ctx.fillRect(-s * 0.88, -s * 0.2, s * 1.76, s * 0.22);
        break;

      case 'lamp':
        drawToyBevelRect(ctx, -s * 0.14, -s * 2.2, s * 0.28, s * 2.3, 2, '#64748b', {
          depth: 0,
          rimColor: '#334155',
          lineWidth: lw * 0.75,
        });
        drawToyBevelRect(ctx, -s * 0.14, -s * 2.2, s * 0.72, s * 0.2, 2, '#64748b', {
          depth: 0,
          rimColor: '#334155',
          lineWidth: lw * 0.75,
        });
        ctx.fillStyle = 'rgba(255, 224, 102, 0.26)';
        ctx.beginPath(); ctx.arc(s * 0.45, -s * 1.95, s * 0.78, 0, TAU); ctx.fill();
        drawToySphere(ctx, s * 0.45, -s * 1.95, s * 0.36, '#ffe066', { rimColor: '#b45309', lineWidth: lw * 0.7 });
        break;

      case 'tree': {
        drawToyBevelRect(ctx, -s * 0.2, -s * 0.55, s * 0.4, s * 0.75, 2, '#8b5a2b', {
          depth: 0,
          rimColor: toyRim('#8b5a2b'),
          lineWidth: lw * 0.8,
        });
        drawToySphere(ctx, 0, -s * 0.55, s * 0.88, shadeColor(col, -0.22), { lineWidth: lw });
        drawToySphere(ctx, -s * 0.08, -s * 0.92, s * 0.76, col, { lineWidth: lw });
        drawToySphere(ctx, -s * 0.18, -s * 1.24, s * 0.5, shadeColor(col, 0.22), { lineWidth: lw });
        break;
      }

      case 'lionStatue':
        this.drawExtrudedBox(s * 1.9, s * 1.1, s * 0.8, '#94a3b8', { door: false });
        drawToySphere(ctx, s * 0.32, -s * 1.05, s * 0.48, '#ffd166', { rimColor: '#92400e', lineWidth: lw });
        drawToyEyes(ctx, s * 0.42, -s * 1.08, s * 0.1, { spacing: s * 0.24, style: 'bright' });
        break;

      case 'swingBridge':
        drawToyBevelRect(ctx, -s * 0.4, -s * 1.2, s * 0.8, s * 2.4, 4, '#334155', {
          depth: 3,
          rimColor: '#0f172a',
          lineWidth: lw,
        });
        ctx.fillStyle = '#e63946';
        ctx.fillRect(-s * 0.35, -s * 0.1, s * 0.7, s * 0.2);
        break;

      case 'superlambanana': {
        drawToyBevelRect(ctx, -s * 0.9, s * 0.3, s * 1.8, s * 0.65, 4, '#94a3b8', {
          depth: 3,
          rimColor: '#475569',
          lineWidth: lw,
        });
        const bg = ctx.createRadialGradient(-s * 0.2, -s * 0.35, s * 0.1, 0, -s * 0.2, s * 0.9);
        bg.addColorStop(0, '#fef08a');
        bg.addColorStop(0.55, '#ffd000');
        bg.addColorStop(1, '#ca8a04');
        ctx.fillStyle = bg;
        ctx.strokeStyle = toyRim('#ffd000');
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.2, s * 0.85, s * 0.45, -0.25, 0, TAU);
        ctx.fill();
        ctx.stroke();
        drawToySphere(ctx, -s * 0.55, -s * 0.5, s * 0.35, '#ff4fa3', { rimColor: toyRim('#ff4fa3'), lineWidth: lw * 0.9 });
        drawToyEyes(ctx, -s * 0.62, -s * 0.52, s * 0.09, { spacing: s * 0.18, style: 'happy' });
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath(); ctx.ellipse(0, -s * 0.4, s * 0.38, s * 0.1, -0.2, 0, TAU); ctx.fill();
        break;
      }

      case 'beatleBeans':
        drawToySphere(ctx, 0, 0, s * 0.92, '#78350f', { rimColor: '#ffd166', lineWidth: lw * 1.2 });
        [-s * 0.45, -s * 0.15, s * 0.15, s * 0.45].forEach((bx, idx) => {
          drawBean(ctx, bx, -s * 0.1, s * 0.48, {
            color: '#b08968',
            bellyColor: '#d4a373',
            eyes: 'happy',
            squash: 1,
            hat: idx === 0 ? 'crown' : null,
          });
        });
        break;

      case 'fountain':
        drawToySphere(ctx, 0, 0, s * 0.92, '#64748b', { rimColor: '#334155', lineWidth: lw * 1.1 });
        drawToySphere(ctx, 0, 0, s * 0.72, '#38bdf8', { rimColor: '#0369a1', lineWidth: lw * 0.9 });
        drawToySphere(ctx, 0, 0, s * 0.3, '#ffd166', { rimColor: '#92400e', lineWidth: lw * 0.8 });
        for (let b = 0; b < 4; b++) {
          const a = (b * Math.PI) / 2 + this.time * 2;
          drawToySphere(ctx, Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.09, '#e0f2fe', {
            rimColor: '#0284c7',
            lineWidth: 0.8,
            bottomBounce: false,
          });
        }
        break;

      case 'anchorMonument':
        drawToyBevelRect(ctx, -s * 0.13, -s * 0.9, s * 0.26, s * 1.8, 3, '#334155', {
          depth: 0,
          rimColor: '#0f172a',
          lineWidth: lw,
        });
        drawToyBevelRect(ctx, -s * 0.7, -s * 0.5, s * 1.4, s * 0.26, 3, '#475569', {
          depth: 0,
          rimColor: '#0f172a',
          lineWidth: lw,
        });
        ctx.beginPath();
        ctx.arc(0, s * 0.3, s * 0.75, 0.1, Math.PI - 0.1);
        ctx.lineWidth = s * 0.22;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#334155';
        ctx.stroke();
        ctx.lineWidth = s * 0.08;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.stroke();
        break;

      case 'cavernClub':
        this.drawExtrudedBox(s * 1.9, s * 1.45, s * 1.05, col, {
          awningCol: '#f72585',
          floors: 2,
          cols: 3,
          acUnits: true,
        });
        drawToyPill(ctx, -s * 0.68, -s * 1.25, s * 1.36, s * 0.32, '#f72585', {
          rimColor: '#831843',
          lineWidth: lw * 0.9,
        });
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${Math.max(8, Math.round(s * 0.2))}px 'Fredoka', 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CAVERN', 0, -s * 1.09);
        break;

      case 'shed':
        this.drawExtrudedBox(s * 1.7, s * 1.3, s * 0.78, col, {
          floors: 1,
          cols: 2,
        });
        break;

      case 'cottage':
        this.drawExtrudedBox(s * 1.85, s * 1.45, s * 0.92, col, {
          awningCol: '#ffbe0b',
          floors: 2,
          cols: 2,
        });
        // Cozy gable roof ridge highlight
        drawToyBevelRect(ctx, -s * 0.85, -s * 1.06, s * 1.7, s * 0.22, 3, shadeColor(col, 0.24), {
          depth: 1.5,
          rimColor: toyRim(col),
          lineWidth: lw * 0.8,
        });
        break;

      case 'gasStation':
        this.drawExtrudedBox(s * 2.1, s * 1.4, s * 0.78, '#22b8cf', {
          wallCol: '#16778a',
          trimCol: '#ff4fa3',
          door: false,
          floors: 1,
          cols: 3,
        });
        drawToyBevelRect(ctx, -s * 0.75, s * 0.1, s * 0.35, s * 0.45, 3, '#ffd166', { depth: 2, rimColor: '#92400e', lineWidth: lw * 0.75 });
        drawToyBevelRect(ctx, s * 0.4, s * 0.1, s * 0.35, s * 0.45, 3, '#ffd166', { depth: 2, rimColor: '#92400e', lineWidth: lw * 0.75 });
        break;

      case 'warehouse':
        this.drawExtrudedBox(s * 2.1, s * 1.55, s * 0.85, col, {
          floors: 1,
          cols: 4,
          acUnits: true,
        });
        break;

      case 'townhouse':
        this.drawExtrudedBox(s * 1.9, s * 1.45, s * 1.15, col, {
          awningCol: '#ffe066',
          floors: 3,
          cols: 3,
        });
        break;

      case 'apt':
        this.drawExtrudedBox(s * 1.9, s * 1.5, s * 1.38, col, {
          acUnits: true,
        });
        break;

      case 'palmHouse': {
        drawToySphere(ctx, 0, -s * 0.15, s * 0.92, '#52b788', { rimColor: '#1b4332', lineWidth: lw });
        const glassG = ctx.createRadialGradient(-s * 0.24, -s * 0.55, s * 0.08, 0, -s * 0.32, s * 0.78);
        glassG.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        glassG.addColorStop(0.5, 'rgba(216, 243, 220, 0.65)');
        glassG.addColorStop(1, 'rgba(116, 198, 157, 0.55)');
        ctx.fillStyle = glassG;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = lw * 0.9;
        ctx.beginPath(); ctx.ellipse(0, -s * 0.32, s * 0.78, s * 0.62, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1b4332';
        for (let pt = 0; pt < 6; pt++) {
          const a = (pt * Math.PI) / 3;
          ctx.fillRect(Math.cos(a) * s * 0.25, -s * 0.32 + Math.sin(a) * s * 0.2, s * 0.12, s * 0.35);
        }
        break;
      }

      case 'albertDock':
        this.drawExtrudedBox(s * 2.0, s * 1.4, s * 1.05, col, {
          acUnits: true,
        });
        break;

      case 'stJellyHall':
        this.drawExtrudedBox(s * 2.0, s * 1.4, s * 1.1, col, {
          trimCol: '#ffffff',
          winCol: '#3d405b',
          winAltCol: '#25e6ff',
        });
        break;

      case 'liverBuilding':
        this.drawExtrudedBox(s * 1.95, s * 1.35, s * 1.42, col);
        [-s * 0.52, s * 0.52].forEach((tx) => {
          drawToyBevelRect(ctx, tx - s * 0.22, -s * 1.92, s * 0.44, s * 0.54, 4, shadeColor(col, -0.15), {
            depth: 2,
            rimColor: toyRim(col),
            lineWidth: lw * 0.85,
          });
          drawToySphere(ctx, tx, -s * 1.66, s * 0.13, '#ffd166', { rimColor: '#92400e', lineWidth: 0.9, bottomBounce: false });
          drawToySphere(ctx, tx, -s * 1.92, s * 0.22, '#20c997', { rimColor: '#065f46', lineWidth: 0.9 });
        });
        break;

      case 'cathedral':
        this.drawExtrudedBox(s * 1.95, s * 1.45, s * 1.35, '#6c757d');
        drawToyBevelRect(ctx, -s * 0.34, -s * 1.92, s * 0.68, s * 0.62, 4, '#64748b', {
          depth: 2,
          rimColor: '#334155',
          lineWidth: lw * 0.9,
        });
        drawToySphere(ctx, 0, -s * 0.72, s * 0.28, '#f72585', { rimColor: '#831843', lineWidth: lw * 0.8 });
        drawToySphere(ctx, 0, -s * 0.72, s * 0.16, '#4cc9f0', { rimColor: '#0369a1', lineWidth: lw * 0.7, bottomBounce: false });
        break;

      case 'metroCathedral':
        drawToySphere(ctx, 0, 0, s * 0.88, '#475569', { rimColor: '#1e293b', lineWidth: lw });
        drawToySphere(ctx, 0, -s * 0.35, s * 0.52, '#4cc9f0', { rimColor: '#0284c7', lineWidth: lw * 0.9 });
        drawToySphere(ctx, 0, -s * 0.65, s * 0.18, '#ffd166', { rimColor: '#92400e', lineWidth: lw * 0.75 });
        break;

      case 'doubleDecker': {
        const ux = -Math.sin(p.rot);
        const uy = -Math.cos(p.rot);
        drawToyBevelRect(ctx, -s * 1.18, -s * 0.58, s * 2.36, s * 1.16, s * 0.24, '#e63946', {
          depth: s * 0.28,
          rimColor: toyRim('#e63946'),
          lineWidth: lw,
          gloss: true,
        });
        drawToyBevelRect(ctx, -s * 1.05 + ux * s * 0.35, -s * 0.48 + uy * s * 0.35, s * 2.1, s * 0.96, s * 0.2, '#ff5c6c', {
          depth: s * 0.16,
          rimColor: toyRim('#e63946'),
          lineWidth: lw * 0.85,
          gloss: true,
        });
        ctx.fillStyle = '#ffe066';
        for (let w = -3; w <= 3; w++) {
          ctx.fillRect(w * s * 0.26 - s * 0.08 + ux * s * 0.35, -s * 0.36 + uy * s * 0.35, s * 0.16, s * 0.22);
          ctx.fillRect(w * s * 0.26 - s * 0.08 + ux * s * 0.35, s * 0.12 + uy * s * 0.35, s * 0.16, s * 0.22);
        }
        break;
      }

      case 'car':
      case 'taxi': {
        const ux = -Math.sin(p.rot);
        const uy = -Math.cos(p.rot);
        drawToyBevelRect(ctx, -s * 1.08, -s * 0.54, s * 2.16, s * 1.08, s * 0.26, col, {
          depth: s * 0.18,
          rimColor: toyRim(col, 0.58),
          lineWidth: lw * 0.95,
          gloss: true,
        });
        // Elevated cabin & glossy windshield
        drawToyBevelRect(ctx, -s * 0.46 + ux * s * 0.26, -s * 0.43 + uy * s * 0.26, s * 1.02, s * 0.86, s * 0.16, '#0284c7', {
          depth: s * 0.1,
          rimColor: '#0f172a',
          lineWidth: lw * 0.75,
          gloss: true,
        });
        drawToyBevelRect(ctx, -s * 0.3 + ux * s * 0.34, -s * 0.38 + uy * s * 0.34, s * 0.68, s * 0.76, s * 0.12, shadeColor(col, 0.22), {
          depth: 0,
          rimColor: toyRim(col),
          lineWidth: lw * 0.7,
          gloss: true,
        });
        // Headlights + taxi beacon
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(s * 0.92 + ux * s * 0.12, -s * 0.4 + uy * s * 0.12, s * 0.14, s * 0.2);
        ctx.fillRect(s * 0.92 + ux * s * 0.12, s * 0.2 + uy * s * 0.12, s * 0.14, s * 0.2);
        if (p.kind === 'taxi') {
          drawToyBevelRect(ctx, -s * 0.1 + ux * s * 0.38, -s * 0.2 + uy * s * 0.38, s * 0.2, s * 0.4, 2, '#ffd166', {
            depth: 1,
            rimColor: '#92400e',
            lineWidth: 0.7,
          });
        }
        break;
      }

      case 'truck': {
        const ux = -Math.sin(p.rot);
        const uy = -Math.cos(p.rot);
        drawToyBevelRect(ctx, -s * 1.18, -s * 0.6, s * 1.62, s * 1.2, 4, '#f8fafc', {
          depth: s * 0.22,
          rimColor: '#64748b',
          lineWidth: lw * 0.95,
          gloss: true,
        });
        drawToyBevelRect(ctx, s * 0.48 + ux * s * 0.14, -s * 0.54 + uy * s * 0.14, s * 0.7, s * 1.08, 4, col, {
          depth: s * 0.18,
          rimColor: toyRim(col),
          lineWidth: lw * 0.95,
          gloss: true,
        });
        break;
      }

      case 'donutShop':
        this.drawExtrudedBox(s * 1.9, s * 1.45, s * 1.05, col, {
          awningCol: '#ff4fa3',
          floors: 2,
          cols: 3,
        });
        drawToySphere(ctx, 0, -s * 1.05, s * 0.48, '#ff70a6', { rimColor: toyRim('#ff70a6'), lineWidth: lw });
        drawToySphere(ctx, 0, -s * 1.05, s * 0.18, '#fdf0d5', { rimColor: '#92400e', lineWidth: lw * 0.7, bottomBounce: false });
        break;

      case 'tower':
        this.drawExtrudedBox(s * 1.9, s * 1.45, s * 1.62, col, {
          acUnits: true,
        });
        break;

      case 'sky':
        this.drawExtrudedBox(s * 1.95, s * 1.5, s * 1.95, col, {
          acUnits: true,
        });
        drawToyBevelRect(ctx, -s * 0.42, -s * 2.33, s * 0.84, s * 0.65, 4, shadeColor(col, 0.22), {
          depth: 2,
          rimColor: toyRim(col),
          lineWidth: lw * 0.85,
        });
        drawToySphere(ctx, 0, -s * 2.07, s * 0.15, '#25e6ff', { rimColor: '#0369a1', lineWidth: 0.9 });
        break;

      case 'stadium':
        this.drawExtrudedBox(s * 2.1, s * 1.45, s * 0.85, col, {
          floors: 2,
          cols: 5,
          door: false,
        });
        drawToyBevelRect(ctx, -s * 0.72, -s * 1.23, s * 1.44, s * 0.78, s * 0.18, '#20c997', {
          depth: 0,
          rimColor: '#065f46',
          lineWidth: lw * 0.9,
          gloss: true,
        });
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-s * 0.52, -s * 1.1, s * 1.04, s * 0.52);
        break;

      case 'wheel':
        ctx.strokeStyle = toyRim(col);
        ctx.lineWidth = Math.max(5, s * 0.075);
        ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, TAU); ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(3, s * 0.05);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + this.time * 0.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85);
          ctx.stroke();
          drawToySphere(ctx, Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85, s * 0.1, i % 2 === 0 ? '#ffd166' : '#38bdf8', {
            rimColor: '#0f172a',
            lineWidth: lw * 0.7,
          });
        }
        drawToySphere(ctx, 0, 0, s * 0.16, '#ffd166', { rimColor: '#92400e', lineWidth: lw });
        break;

      case 'electricSubstation': {
        drawToyBevelRect(ctx, -s * 1.1, -s * 0.9, s * 2.2, s * 1.8, 5, '#334155', {
          depth: 3,
          rimColor: '#0f172a',
          lineWidth: lw,
          gloss: true,
        });
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-s * 0.9, -s * 0.7, s * 1.8, s * 0.4);
        ctx.fillStyle = '#0f172a';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-s * 0.8 + i * s * 0.45, -s * 0.7);
          ctx.lineTo(-s * 0.6 + i * s * 0.45, -s * 0.3);
          ctx.lineTo(-s * 0.7 + i * s * 0.45, -s * 0.3);
          ctx.lineTo(-s * 0.9 + i * s * 0.45, -s * 0.7);
          ctx.fill();
        }
        ctx.strokeStyle = '#25e6ff';
        ctx.lineWidth = Math.max(1.6, s * 0.08);
        ctx.lineCap = 'round';
        ctx.beginPath();
        const arcPhase = this.time * 14;
        ctx.moveTo(-s * 0.6, s * 0.1);
        ctx.lineTo(-s * 0.2 + Math.sin(arcPhase) * s * 0.2, s * 0.3);
        ctx.lineTo(s * 0.2 + Math.cos(arcPhase) * s * 0.2, s * 0.1);
        ctx.lineTo(s * 0.6, s * 0.3);
        ctx.stroke();
        ctx.fillStyle = '#ffd166';
        ctx.font = `800 ${Math.round(s * 0.55)}px 'Fredoka', 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⚡', 0, s * 0.7);
        break;
      }

      case 'voidMine': {
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          ctx.fillStyle = '#6d28d9';
          ctx.strokeStyle = '#3b0764';
          ctx.lineWidth = lw * 0.85;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(Math.cos(a - 0.2) * s * 0.65, Math.sin(a - 0.2) * s * 0.65);
          ctx.lineTo(Math.cos(a) * s * 1.15, Math.sin(a) * s * 1.15);
          ctx.lineTo(Math.cos(a + 0.2) * s * 0.65, Math.sin(a + 0.2) * s * 0.65);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        drawToySphere(ctx, 0, 0, s * 0.75, '#334155', { rimColor: '#0f172a', lineWidth: lw });
        const blink = Math.sin(this.time * 10) > 0;
        drawToySphere(ctx, 0, 0, s * 0.36, blink ? '#f43f5e' : '#881337', {
          rimColor: '#4c0519',
          lineWidth: lw * 0.8,
          shine: blink ? 0.85 : 0.3,
        });
        break;
      }

      default:
        drawToyBevelRect(ctx, -s, -s, s * 2, s * 2, s * 0.2, col, { depth: 2, rimColor: toyRim(col), lineWidth: lw });
        break;
    }
    ctx.restore();
  }

  /* --------------------------------------------------- Cybernetic Turbo Boost HUD Button */
  drawBoostButton(ctx, W, H) {
    const bx = W - 46;
    const by = H - 118;
    const r = 27;
    const h = this.hole;
    const canBoost = h.r > 16.5;

    ctx.save();
    drawToyShadow(ctx, bx, by + r * 0.88, r * 0.85, r * 0.28, 0.3);

    if (this.boosting) {
      drawToySphere(ctx, bx, by, r, '#f97316', {
        rimColor: '#ffd166',
        lineWidth: 2.6,
        shine: 0.78,
      });
    } else if (canBoost) {
      drawToySphere(ctx, bx, by, r, '#0284c7', {
        rimColor: '#38bdf8',
        lineWidth: 2.2,
        shine: 0.65,
      });
    } else {
      drawToySphere(ctx, bx, by, r, '#334155', {
        rimColor: '#475569',
        lineWidth: 1.8,
        shine: 0.28,
      });
    }

    ctx.font = "800 13px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = this.boosting ? '#fef08a' : canBoost ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
    ctx.strokeText('⚡', bx, by - 6);
    ctx.fillText('⚡', bx, by - 6);

    ctx.font = "800 8.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.strokeText('BOOST', bx, by + 9);
    ctx.fillText('BOOST', bx, by + 9);

    ctx.restore();
  }
}

function pickColor(kind, seed) {
  const p = pseudoRandom(seed);
  if (kind === 'electricSubstation') return '#ffd166';
  if (kind === 'voidMine') return '#ff0054';
  if (kind === 'sugarDrop') return pick(['#ff3366', '#06d6a0', '#ffbe0b', '#4cc9f0', '#9b5de5', '#ff70a6'], p);
  if (kind === 'sweetWrapper') return pick(['#ff0054', '#7209b7', '#f72585', '#4361ee', '#ffd166'], p);
  if (kind === 'sodaCan') return pick(['#e63946', '#3a86ff', '#52b788', '#ff70a6', '#ffbe0b'], p);
  if (kind === 'pigeon') return '#adb5bd';
  if (kind === 'flowerPot') return pick(['#ff4b5c', '#ffd166', '#ff70a6', '#7209b7'], p);
  if (kind === 'coffeeCup') return '#ffffff';
  if (kind === 'streetSign') return pick(['#1d3557', '#e63946', '#2a9d8f'], p);
  if (kind === 'cone') return '#ff8a3d';
  if (kind === 'hydrant') return '#ff4b5c';
  if (kind === 'trash') return '#4a4e69';
  if (kind === 'barrel') return '#8b5a2b';
  if (kind === 'ped') return pick(['#ff5b6e', '#3ddc84', '#25e6ff', '#ffd166', '#ff70a6'], p);
  if (kind === 'car') return pick(['#ff5d73', '#4cc9f0', '#f9c74f', '#b388ff', '#ffffff'], p);
  if (kind === 'taxi') return '#1e293b';
  if (kind === 'shed') return pick(['#ffd166', '#2ec4b6', '#ff9f1c', '#e76f51'], p);
  if (kind === 'cottage') return pick(['#ff8fab', '#ffe3b3', '#74c0fc', '#63e6be'], p);
  if (kind === 'warehouse') return pick(['#5c677d', '#4ea8de', '#748cab'], p);
  if (kind === 'townhouse') return pick(['#ff6b81', '#e07a5f', '#20c997', '#f06595'], p);
  if (kind === 'donutShop') return '#ff99c8';
  if (kind === 'cavernClub') return '#9d4edd';
  if (kind === 'apt') return pick(['#845ef7', '#5c7cfa', '#22b8cf', '#f06595'], p);
  if (kind === 'tower') return pick(['#5c7cfa', '#4cc9f0', '#7950f2', '#38d9a9'], p);
  if (kind === 'sky') return pick(['#22b8cf', '#4dabf7', '#748ffc', '#f783ac'], p);
  if (kind === 'albertDock') return '#e05a6d';
  if (kind === 'liverBuilding') return '#748cab';
  if (kind === 'stJellyHall') return '#ffe3b3';
  if (kind === 'stadium') return '#ff4d6d';
  if (kind === 'wheel') return '#ff4fa3';
  if (kind === 'tree') return pick(['#2ec4b6', '#2bb673', '#20c997'], p);
  return '#2bb673';
}

function pick(arr, val) {
  return arr[Math.floor(val * arr.length) % arr.length];
}
