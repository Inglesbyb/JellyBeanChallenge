import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

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
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function pseudoRandom(seed) {
  let s = Math.sin(seed) * 10000;
  return s - Math.floor(s);
}

export class VoidEater extends Game {
  static meta = {
    id: 'void-eater',
    title: 'Void Eater',
    icon: '🌀',
    hint: 'DRAG to steer · VACUUM CANDY DROPS · climb TOP 5 LEADERBOARD!',
    baseLikes: 1420,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.hole = { x: WORLD / 2, y: WORLD / 2, r: 16, vx: 0, vy: 0, pulse: 0 };
    this.zoom = 1.45;
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

    this.chunks = new Map();
    this.eatenProps = new Set();
    this.activeProps = [];
    this.fallingProps = new Set();
    this.respawnQueue = [];

    if (saved) {
      this.hole.x = saved.x ?? WORLD / 2;
      this.hole.y = saved.y ?? WORLD / 2;
      this.hole.r = saved.r ?? 16;
      this.lastTier = this.getTier().level;
      if (saved.eaten) {
        for (const id of saved.eaten) this.eatenProps.add(id);
      }
      this.grace = 1.0;
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

    // 44 Roaming Rival Holes across the city sectors
    const prefixes = ['Apex', 'Shadow', 'Turbo', 'Gummy', 'Vortex', 'Chomp', 'Gulp', 'Titan', 'Cosmic', 'Abyss', 'Neon', 'Sugar', 'Savage', 'Brutal', 'Vicious'];
    const suffixes = ['Hunter', 'Maw', 'Reaper', 'Beast', 'Mayor', 'Demon', 'Fiend', 'King', 'Crusher', 'Swallow', 'Phantom', 'Horror', 'Void', 'Slayer'];
    const rivalColors = ['#ff4b5c', '#ffd166', '#06d6a0', '#ff70a6', '#4cc9f0', '#9b5de5', '#f15bb5', '#ffbe0b', '#e71d36', '#ff9f1c', '#2ec4b6', '#00f5d4', '#e63946'];

    const rivalRoster = [...districtBosses];
    let rIdx = 0;
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 7; gx++) {
        if ((gx === 0 && gy === 1) || (gx === 1 && gy === 5) || (gx === 5 && gy === 5)) continue;
        const x = 1200 + gx * 2500 + (pseudoRandom(rIdx * 11) - 0.5) * 800;
        const y = 1200 + gy * 2500 + (pseudoRandom(rIdx * 13) - 0.5) * 800;
        const name = `${prefixes[rIdx % prefixes.length]}${suffixes[(rIdx * 3) % suffixes.length]}`;
        const scale = 0.85 + pseudoRandom(rIdx * 17) * 0.85;
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
    return clamp(36 / (this.hole.r + 7), 0.035, 1.45);
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
        addProp('bollard', wx + ox, wy + 115, 0, '#111');
      });
      addProp('ped', wx + 200, wy + 130, 0);
      addProp('ped', wx + 360, wy + 130, 0);

    } else if (dist.id === 'strand') {
      // The Strand 8-Lane Boulevard & Pier Head
      addProp('liverBuilding', wx + 380, wy + 340, 0, '#4a5759');
      addProp('doubleDecker', wx + 240, wy + 80, 0, '#d90429');
      addProp('taxi', wx + 420, wy + 80, 0, '#111');
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
      addProp('taxi', wx + 290, wy + 60, 0, '#111');
      addProp('doubleDecker', wx + 420, wy + 60, 0, '#d90429');
      addProp('ped', wx + 200, wy + 140, 0);
    }

    this.chunks.set(key, props);
    return props;
  }

  updateActiveProps() {
    const h = this.hole;
    const viewDist = (this.H / 2 + 420) / this.zoom;
    const minCX = Math.max(0, Math.floor((h.x - viewDist) / CHUNK_SIZE));
    const maxCX = Math.min(CHUNKS_ACROSS - 1, Math.floor((h.x + viewDist) / CHUNK_SIZE));
    const minCY = Math.max(0, Math.floor((h.y - viewDist) / CHUNK_SIZE));
    const maxCY = Math.min(CHUNKS_ACROSS - 1, Math.floor((h.y + viewDist) / CHUNK_SIZE));

    const active = [];
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const cp = this.getChunkProps(cx, cy);
        for (let i = 0; i < cp.length; i++) {
          if (!cp[i].dead) active.push(cp[i]);
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
    // Sizing up at a rewarding pace so players can reach maximum size in ~40-50s
    const mult = isPlayer ? 2.2 : 0.65;
    const rate = (propSize * mult * scaling) / (1 + Math.sqrt(h.r) * 0.22);
    h.r = Math.min(1000, h.r + rate);
  }

  absorb(h, dt) {
    for (let i = 0; i < this.activeProps.length; i++) {
      const p = this.activeProps[i];
      if (p.fall > 0 || p.dead) continue;

      if (p.size > h.r * 0.85) continue;

      const dx = h.x - p.x;
      const dy = h.y - p.y;
      const d = Math.hypot(dx, dy);

      if (d < h.r * 1.55 && d > 0.1) {
        const pull = (65 + h.r * 0.5) * dt;
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

  absorbRival(rv, dt) {
    if (rv.dead) return;
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
    const v = this.input.vec(55);
    const sp = 100 + h.r * 1.05;
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
      p.fall += dt * 3.5;
      p.x += (o.x - p.x) * Math.min(1, dt * 10);
      p.y += (o.y - p.y) * Math.min(1, dt * 10);

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

    const punch = Math.min(0.3, (p.size / this.hole.r) * 0.4 + 0.08);
    this.hole.pulse = Math.min(0.45, this.hole.pulse + punch);
    this.beanSquash = Math.max(0.7, 1.3 - punch * 0.7);

    if (this.gulpCooldown <= 0) {
      this.sounds.gulp(Math.max(0.55, 1.45 - p.size * 0.025));
      this.gulpCooldown = 0.07;
    }

    if (p.size <= 8) {
      // Tiny snappy ripple for micro sweets & litter
      this.fx.ring(this.hole.x, this.hole.y, '#ffd166', this.hole.r * this.zoom * 1.25, 0.18, 2);
    } else if (p.size < 20) {
      this.fx.ring(this.hole.x, this.hole.y, '#25e6ff', this.hole.r * this.zoom * 1.35, 0.22, 2.5);
    } else if (p.size < 40) {
      this.fx.ring(this.hole.x, this.hole.y, '#ffd166', this.hole.r * this.zoom * 1.5, 0.28, 3);
      if (this.eatTextCooldown <= 0) {
        this.fx.text(this.hole.x, this.hole.y - this.hole.r - 20 * k, `+${this.batchPts} PTS`, '#ffd166', 22);
        this.batchPts = 0;
        this.eatTextCooldown = 0.32;
      }
      this.haptics.light();
    } else {
      this.fx.ring(this.hole.x, this.hole.y, '#ff4fa3', this.hole.r * this.zoom * 1.8, 0.35, 4);
      this.fx.burst(this.hole.x, this.hole.y, '#ffd166', 12, 140 * k, 0.5, 3.5);
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
      this.fx.burst(this.hole.x, this.hole.y, '#ffd166', 32, 280 * k, 0.9, 5);
      this.fx.text(this.hole.x, this.hole.y - this.hole.r - 40 * k, `TIER UP: ${curTier.name.toUpperCase()}!`, '#3dffa2', 26, 2.0);
      this.fx.shake(7, 0.3);
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
        const leadFactor = Math.min(0.9, pd / 500);
        tx = h.x + h.vx * leadFactor;
        ty = h.y + h.vy * leadFactor;

        if (pd < 550) {
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
                // Prioritize larger edible items to maximize mass gain
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

      // Player's exact current top speed
      const playerSpeed = 100 + h.r * 1.05;

      const dx = tx - rv.x;
      const dy = ty - rv.y;
      const d = Math.hypot(dx, dy) || 1;

      // FAIR COMPETITION: Rivals can NEVER move faster than the player!
      // Capped strictly at playerSpeed so the player can always outrun / outmaneuver pursuers
      const naturalSpeed = 95 + rv.r * 0.95;
      const baseSp = Math.min(playerSpeed, naturalSpeed * speedMultiplier);
      const accelK = Math.min(1, dt * 4.0);
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

        // 1. RIVAL IS BIGGER THAN PLAYER -> SWALLOWS & ELIMINATES PLAYER!
        if (rv.r >= h.r + 1.0) {
          if (this.grace > 0) {
            // Push apart during initial 1s spawn grace only
            const push = overlap * 0.5;
            const nx = (h.x - rv.x) / (pd || 1);
            const ny = (h.y - rv.y) / (pd || 1);
            h.x += nx * push;
            h.y += ny * push;
          } else {
            // Bigger enemy crashes into player -> ELIMINATES PLAYER!
            if (this.die(`Devoured by ${rv.name} (${rv.title})`)) {
              this.fx.burst(h.x, h.y, '#ff4b5c', 44, 320 / this.zoom, 0.95, 6);
              this.fx.ring(rv.x, rv.y, rv.color, rv.r * this.zoom * 1.5, 0.5, 4);
              this.fx.shake(18, 0.55);
              this.sounds.tick();
              this.haptics.heavy();
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

    // 1. Draw Authentic Bird's Eye Liverpool Urban Map
    this.drawCityMap(ctx, h, halfW, halfT, halfB);

    // 2. Draw Props in Depth Order
    this.activeProps.sort((a, b) => a.size - b.size);
    for (let i = 0; i < this.activeProps.length; i++) {
      const p = this.activeProps[i];
      if (p.fall > 0 || p.dead) continue;
      this.drawProp(p, 1, 1);
    }

    // 3. Draw Rivals (with Aggressive Threat Auras)
    for (const rv of this.rivals) {
      if (rv.dead) continue;
      const isThreat = rv.r > h.r + 10;
      const isPrey = h.r >= rv.r + 2;
      const rim = isThreat ? '#ff0054' : isPrey ? '#00f5d4' : '#ffd166';
      this.drawHole(rv, rim, rv.color, rv.name, false, isThreat);
    }

    // 4. Draw Player Hole with Captain Jellybean in UFO
    this.drawHole(h, '#25e6ff', '#25e6ff', 'YOU', true, false);

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

    // 7. Apex Invulnerability & Victory Countdown Pill
    if (this.isMaxSize()) {
      ctx.save();
      const bannerW = 296;
      const bannerH = 40;
      const bannerX = W / 2 - bannerW / 2;
      const bannerY = 82;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 13px Outfit, system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
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
    const top5 = competitors.slice(0, 5);
    const playerInTop5 = playerRank <= 5;

    const lx = 12;
    const ly = 108;
    const lw = 158;
    const lh = playerInTop5 ? 136 : 158;

    ctx.save();
    // Glassmorphism Card Background
    const g = ctx.createLinearGradient(lx, ly, lx + lw, ly + lh);
    g.addColorStop(0, 'rgba(12, 16, 32, 0.92)');
    g.addColorStop(1, 'rgba(20, 26, 48, 0.86)');
    ctx.fillStyle = g;
    this.rr(lx, ly, lw, lh, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Header: 👑 TOP 5 VOIDS
    ctx.fillStyle = '#ffd166';
    ctx.font = '900 11px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('👑 TOP 5 VOIDS', lx + 10, ly + 18);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '700 9px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('SIZE', lx + lw - 10, ly + 18);

    // Top 5 Rows
    const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
    top5.forEach((c, idx) => {
      const rowY = ly + 36 + idx * 19;

      // Player highlight pill
      if (c.isPlayer) {
        ctx.fillStyle = 'rgba(37, 230, 255, 0.22)';
        this.rr(lx + 6, rowY - 12, lw - 12, 16, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(37, 230, 255, 0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Medal / Rank
      ctx.fillStyle = idx === 0 ? '#ffd166' : idx === 1 ? '#e0e1dd' : idx === 2 ? '#cd7f32' : 'rgba(255,255,255,0.6)';
      ctx.font = '800 10px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(medals[idx], lx + 8, rowY);

      // Name
      ctx.fillStyle = c.isPlayer ? '#25e6ff' : c.boss ? '#ffd166' : '#ffffff';
      ctx.font = c.isPlayer ? '900 10px Outfit, sans-serif' : '700 10px Outfit, sans-serif';
      const cleanName = c.name.length > 10 ? c.name.slice(0, 9) + '…' : c.name;
      ctx.fillText(cleanName, lx + 28, rowY);

      // Radius / Size
      ctx.fillStyle = c.isPlayer ? '#25e6ff' : 'rgba(255,255,255,0.85)';
      ctx.font = '800 10px Outfit, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(c.r)}`, lx + lw - 10, rowY);
    });

    // If player is outside top 5, render rank divider + player position
    if (!playerInTop5) {
      const pRowY = ly + lh - 12;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(lx + 8, pRowY - 15);
      ctx.lineTo(lx + lw - 8, pRowY - 15);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(37, 230, 255, 0.18)';
      this.rr(lx + 6, pRowY - 12, lw - 12, 16, 5);
      ctx.fill();

      ctx.fillStyle = '#25e6ff';
      ctx.font = '900 10px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⭐ #${playerRank} YOU`, lx + 10, pRowY);

      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(this.hole.r)}`, lx + lw - 10, pRowY);
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

          ctx.strokeStyle = 'rgba(20, 20, 30, 0.8)';
          ctx.lineWidth = 5;
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

        // 7. DIAGONAL RADIAL BOULEVARDS & TRIANGULAR CIVIC PLAZAS (Default Commercial)
        ctx.fillStyle = dist.street;
        ctx.fillRect(bx, by, CHUNK_SIZE, 80);
        ctx.fillRect(bx, by, 80, CHUNK_SIZE);

        ctx.fillStyle = '#22283e';
        ctx.fillRect(bx + 80, by + 80, CHUNK_SIZE - 80, 40);
        ctx.fillRect(bx + 80, by + 80, 40, CHUNK_SIZE - 80);

        if ((gx + gy) % 4 === 0) {
          ctx.fillStyle = dist.street;
          ctx.beginPath();
          ctx.moveTo(bx + 80, by + CHUNK_SIZE);
          ctx.lineTo(bx + CHUNK_SIZE, by + 80);
          ctx.lineTo(bx + CHUNK_SIZE, by + 190);
          ctx.lineTo(bx + 190, by + CHUNK_SIZE);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = dist.turf;
          ctx.beginPath();
          ctx.moveTo(bx + 140, by + 140);
          ctx.lineTo(bx + CHUNK_SIZE - 140, by + 140);
          ctx.lineTo(bx + 140, by + CHUNK_SIZE - 140);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = dist.turf;
          this.rr(bx + 125, by + 125, CHUNK_SIZE - 145, CHUNK_SIZE - 145, 18);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = 3.5;
          ctx.setLineDash([16, 20]);
          ctx.beginPath();
          ctx.moveTo(bx + 80, by + 40); ctx.lineTo(bx + CHUNK_SIZE, by + 40);
          ctx.moveTo(bx + 40, by + 80); ctx.lineTo(bx + 40, by + CHUNK_SIZE);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Outer Boundary Ring
    ctx.strokeStyle = '#25e6ff';
    ctx.lineWidth = 14 / this.zoom;
    ctx.strokeRect(0, 0, WORLD, WORLD);
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
      ctx.fillStyle = 'rgba(255, 0, 84, 0.88)';
      this.rr(W / 2 - 125, 68, 250, 32, 16);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '900 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`⚠️ HUNTER LOCK: ${hunter.name.toUpperCase()} (${distM}m)!`, W / 2, 89);
      ctx.restore();
    }
  }

  drawRadar(ctx, W, H) {
    const pad = 12;
    const size = 78;
    const rx = W - size - pad;
    const ry = 108;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 28, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.5;
    this.rr(rx, ry, size, size, 12);
    ctx.fill();
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
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(3.5, leaderObj.r * scale * 2.2), 0, TAU);
      ctx.fill();
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑', lx, ly - 4);
    }

    // Player beacon on radar
    const px = rx + this.hole.x * scale;
    const py = ry + this.hole.y * scale;
    ctx.fillStyle = '#25e6ff';
    ctx.shadowColor = '#25e6ff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2.8, this.hole.r * scale * 2), 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  drawDistrictHUD(ctx, W, H) {
    const t = this.getTier();
    const dist = this.getDistrictInfo(this.hole.x, this.hole.y);

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = '800 13px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(dist.name, 14, H - 94);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '700 12px Outfit, system-ui, sans-serif';
    ctx.fillText(`SIZE ${Math.round(this.hole.r)}  •  TIER ${t.level}: ${t.name.toUpperCase()} (${t.desc})`, 14, H - 76);
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
      const col = rv.boss ? '#ffbe0b' : isThreat ? '#ff0054' : isPrey ? '#00f5d4' : '#ffe066';

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-9, -11);
      ctx.lineTo(-9, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  rr(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  drawHole(hl, rim, mascotCol, label, isPlayer = false, isThreat = false) {
    const ctx = this.ctx;
    const pulseScale = isPlayer && this.hole.pulse > 0 ? (1 + Math.sin(this.hole.pulse * Math.PI) * 0.18) : 1;
    const curR = hl.r * pulseScale;

    if (isThreat) {
      const ringPulse = 1.1 + Math.sin(this.time * 8) * 0.15;
      ctx.strokeStyle = 'rgba(255, 0, 84, 0.45)';
      ctx.lineWidth = Math.max(3, 4 / this.zoom);
      ctx.beginPath();
      ctx.arc(hl.x, hl.y, curR * ringPulse, 0, TAU);
      ctx.stroke();
    }

    const g = ctx.createRadialGradient(hl.x, hl.y, curR * 0.2, hl.x, hl.y, curR * 1.35);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.72, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hl.x, hl.y, curR * 1.35, 0, TAU);
    ctx.fill();

    const g2 = ctx.createRadialGradient(hl.x - curR * 0.25, hl.y - curR * 0.25, curR * 0.08, hl.x, hl.y, curR);
    g2.addColorStop(0, '#0a0a16');
    g2.addColorStop(1, '#000000');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(hl.x, hl.y, curR, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(hl.x, hl.y, curR, 0, TAU);
    ctx.clip();
    for (const p of this.fallingProps) {
      if (p.owner === hl) {
        this.drawProp(p, 1 - p.fall * 0.8, 1 - p.fall * 0.35);
      }
    }
    ctx.restore();

    ctx.lineWidth = Math.max(3.5, 5 / this.zoom);
    ctx.strokeStyle = rim;
    ctx.shadowColor = rim;
    ctx.shadowBlur = isThreat ? 24 : 16;
    ctx.beginPath();
    ctx.arc(hl.x, hl.y, curR, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const beanSize = Math.max(16, Math.min(48, curR * 0.44));
    drawBean(ctx, hl.x, hl.y - curR * 0.12, beanSize, {
      ufo: true,
      color: mascotCol || (isPlayer ? '#25e6ff' : '#ff4fa3'),
      bellyColor: isPlayer ? '#ff758f' : '#ffe066',
      walkT: this.time * 2.8,
      squash: isPlayer ? this.beanSquash : 1,
      dir: (hl.vx || 0) < -1 ? -1 : 1,
      eyes: isThreat ? 'squish' : 'happy',
      hat: hl.boss ? 'crown' : isPlayer && this.hole.r >= 54 ? 'crown' : null,
    });

    if (!isPlayer && label) {
      ctx.fillStyle = isThreat ? '#ff4b5c' : 'rgba(255,255,255,0.88)';
      ctx.font = `900 ${Math.max(11, Math.round(14 / this.zoom))}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, hl.x, hl.y - hl.r - 8);
    }
  }

  /* --------------------------------------------------- Prop Drawing Library */
  drawProp(p, alpha, scale) {
    const ctx = this.ctx;
    const s = p.size * scale;
    const col = p.col;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    // Ambient drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(s * 0.15, s * 0.22, s * 1.15, s * 0.85, 0, 0, TAU);
    ctx.fill();

    switch (p.kind) {
      case 'sugarDrop':
        // Shiny little confectionery jellybean drop
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 1.1, s * 0.8, -0.3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.ellipse(-s * 0.35, -s * 0.3, s * 0.35, s * 0.15, -0.3, 0, TAU);
        ctx.fill();
        break;

      case 'sweetWrapper':
        // Holographic shiny candy wrapper with twisted bowtie ends
        ctx.fillStyle = '#ff70a6';
        ctx.beginPath();
        ctx.moveTo(-s * 1.2, -s * 0.5); ctx.lineTo(-s * 0.5, 0); ctx.lineTo(-s * 1.2, s * 0.5);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s * 1.2, -s * 0.5); ctx.lineTo(s * 0.5, 0); ctx.lineTo(s * 1.2, s * 0.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = col;
        this.rr(-s * 0.6, -s * 0.5, s * 1.2, s, 3); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-s * 0.2, -s * 0.5, s * 0.4, s);
        break;

      case 'sodaCan':
        // Crushed metal fizzy soda can
        ctx.fillStyle = col;
        this.rr(-s * 0.7, -s * 1.1, s * 1.4, s * 2.2, 3); ctx.fill();
        ctx.fillStyle = '#e0e1dd';
        ctx.beginPath(); ctx.ellipse(0, -s * 1.05, s * 0.6, s * 0.25, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(0, -s * 1.05, s * 0.15, 0, TAU); ctx.fill();
        break;

      case 'pigeon':
        // Quayside Liverpool seagull / pigeon that hops
        ctx.fillStyle = '#adb5bd';
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.1, s * 0.75, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#495057';
        ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.2, s * 0.6, s * 0.35, 0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f8f9fa';
        ctx.beginPath(); ctx.arc(s * 0.7, -s * 0.35, s * 0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff9f1c'; // Beak
        ctx.beginPath(); ctx.moveTo(s * 1.05, -s * 0.35); ctx.lineTo(s * 1.45, -s * 0.35); ctx.lineTo(s * 1.05, -s * 0.15); ctx.closePath(); ctx.fill();
        break;

      case 'flowerPot':
        // Terracotta planter pot with blooming flowers
        ctx.fillStyle = '#d97706';
        this.rr(-s * 0.75, -s * 0.2, s * 1.5, s * 1.2, 2); ctx.fill();
        ctx.fillStyle = '#059669';
        ctx.beginPath(); ctx.arc(0, -s * 0.3, s * 0.65, 0, TAU); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, -s * 0.45, s * 0.35, 0, TAU); ctx.fill();
        break;

      case 'coffeeCup':
        ctx.fillStyle = '#f8f9fa';
        this.rr(-s * 0.65, -s * 1.0, s * 1.3, s * 2.0, 2); ctx.fill();
        ctx.fillStyle = '#b45309'; // Kraft sleeve
        ctx.fillRect(-s * 0.65, -s * 0.3, s * 1.3, s * 0.7);
        break;

      case 'streetSign':
        // Lollipop Street Sign
        ctx.fillStyle = '#6c757d';
        ctx.fillRect(-s * 0.1, -s * 0.2, s * 0.2, s * 1.6);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, -s * 0.6, s * 0.75, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -s * 0.6, s * 0.45, 0, TAU); ctx.fill();
        break;

      case 'cone':
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, TAU); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, s * 0.25, 0, TAU); ctx.fill();
        break;

      case 'hydrant':
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe066';
        ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7);
        break;

      case 'trash':
        ctx.fillStyle = col;
        this.rr(-s, -s * 0.8, s * 2, s * 1.6, s * 0.3); ctx.fill();
        break;

      case 'barrel':
        ctx.fillStyle = col;
        this.rr(-s * 0.75, -s * 0.9, s * 1.5, s * 1.8, s * 0.35); ctx.fill();
        ctx.fillStyle = '#1c1b24';
        ctx.fillRect(-s * 0.7, -s * 0.3, s * 1.4, s * 0.2);
        break;

      case 'bollard':
        ctx.fillStyle = '#1c1b24';
        this.rr(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4, s * 0.3); ctx.fill();
        ctx.fillStyle = '#ffbe0b';
        ctx.fillRect(-s * 0.6, -s * 0.2, s * 1.2, s * 0.3);
        break;

      case 'redPhoneBox':
        ctx.fillStyle = '#d90429';
        this.rr(-s * 0.65, -s * 1.2, s * 1.3, s * 2.4, s * 0.25); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-s * 0.45, -s * 0.85, s * 0.9, s * 1.4);
        ctx.fillStyle = 'rgba(217, 4, 41, 0.4)';
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(-s * 0.4, -s * 0.8 + i * s * 0.45, s * 0.8, 2);
        }
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(0, -s * 1.0, s * 0.12, 0, TAU); ctx.fill();
        break;

      case 'mailbox':
        ctx.fillStyle = col;
        this.rr(-s * 0.7, -s * 1.1, s * 1.4, s * 2.2, s * 0.35); ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-s * 0.45, -s * 0.5, s * 0.9, s * 0.25);
        break;

      case 'ped':
        drawBean(ctx, 0, 0, s * 1.7, {
          color: col,
          bellyColor: '#ffffff',
          walkT: p.animT * 4,
          dir: p.vx < 0 ? -1 : 1,
          eyes: p.fall > 0 ? 'squish' : 'happy',
        });
        break;

      case 'bench':
        ctx.fillStyle = '#8b5a2b';
        this.rr(-s, -s * 0.4, s * 2, s * 0.8, 3); ctx.fill();
        ctx.fillStyle = '#c18c5d';
        ctx.fillRect(-s * 0.85, -s * 0.25, s * 1.7, s * 0.15);
        ctx.fillRect(-s * 0.85, 0.05, s * 1.7, s * 0.15);
        break;

      case 'lamp':
        ctx.fillStyle = '#a0a0a0';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe066';
        ctx.shadowColor = '#ffe066';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        break;

      case 'tree':
        ctx.fillStyle = '#5c4033';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.25, 0, TAU); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, s * 0.95, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.25, s * 0.45, 0, TAU); ctx.fill();
        break;

      case 'lionStatue':
        ctx.fillStyle = col;
        this.rr(-s * 1.1, -s * 0.6, s * 2.2, s * 1.2, 4); ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(s * 0.6, 0, s * 0.45, 0, TAU); ctx.fill();
        break;

      case 'swingBridge':
        ctx.fillStyle = '#2b2d42';
        this.rr(-s * 0.4, -s * 1.2, s * 0.8, s * 2.4, 4); ctx.fill();
        ctx.fillStyle = '#e63946';
        ctx.fillRect(-s * 0.35, -s * 0.1, s * 0.7, s * 0.2);
        break;

      case 'superlambanana':
        ctx.fillStyle = '#6c757d';
        this.rr(-s * 0.9, s * 0.3, s * 1.8, s * 0.7, 4); ctx.fill();
        ctx.fillStyle = '#ffd000';
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.2, s * 0.85, s * 0.45, -0.25, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ff007f';
        ctx.beginPath(); ctx.arc(-s * 0.55, -s * 0.5, s * 0.35, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-s * 0.75, -s * 0.65, s * 0.25, s * 0.12, -0.6, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.ellipse(0, -s * 0.4, s * 0.4, s * 0.1, -0.2, 0, TAU); ctx.fill();
        break;

      case 'beatleBeans':
        ctx.fillStyle = '#5c4033';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 3;
        ctx.stroke();
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
        ctx.fillStyle = '#495057';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7209b7';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.72, 0, TAU); ctx.fill();
        ctx.fillStyle = '#d4af37';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f72585';
        for (let b = 0; b < 4; b++) {
          const a = (b * Math.PI) / 2 + this.time * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.08, 0, TAU);
          ctx.fill();
        }
        break;

      case 'anchorMonument':
        ctx.fillStyle = '#212529';
        ctx.fillRect(-s * 0.12, -s * 0.9, s * 0.24, s * 1.8);
        ctx.fillRect(-s * 0.7, -s * 0.5, s * 1.4, s * 0.24);
        ctx.beginPath();
        ctx.arc(0, s * 0.3, s * 0.75, 0.1, Math.PI - 0.1);
        ctx.lineWidth = s * 0.22;
        ctx.strokeStyle = '#212529';
        ctx.stroke();
        break;

      case 'cavernClub':
        ctx.fillStyle = col;
        this.rr(-s, -s, s * 2, s * 2, s * 0.18); ctx.fill();
        ctx.fillStyle = '#1c1b24';
        ctx.beginPath();
        ctx.arc(0, s * 0.1, s * 0.5, Math.PI, 0);
        ctx.lineTo(s * 0.5, s * 0.85);
        ctx.lineTo(-s * 0.5, s * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f72585';
        ctx.shadowColor = '#f72585';
        ctx.shadowBlur = 12;
        ctx.fillRect(-s * 0.6, -s * 0.7, s * 1.2, s * 0.25);
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${Math.round(s * 0.16)}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('CAVERN', 0, -s * 0.52);
        ctx.shadowBlur = 0;
        break;

      case 'townhouse':
        ctx.fillStyle = col;
        this.rr(-s, -s, s * 2, s * 2, s * 0.12); ctx.fill();
        ctx.fillStyle = '#2b2d42';
        this.rr(-s * 0.9, -s * 0.9, s * 1.8, s * 0.6, 2); ctx.fill();
        ctx.fillStyle = '#ffe066';
        [-s * 0.5, 0, s * 0.5].forEach((wx) => {
          ctx.fillRect(wx - s * 0.14, -s * 0.15, s * 0.28, s * 0.32);
          ctx.fillRect(wx - s * 0.14, s * 0.35, s * 0.28, s * 0.32);
        });
        ctx.fillStyle = '#3a86ff';
        ctx.fillRect(-s * 0.18, s * 0.35, s * 0.36, s * 0.65);
        break;

      case 'palmHouse':
        ctx.fillStyle = '#52b788';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.95, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(216, 243, 220, 0.65)';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.78, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1b4332';
        for (let p = 0; p < 6; p++) {
          const a = (p * Math.PI) / 3;
          ctx.fillRect(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3, s * 0.12, s * 0.4);
        }
        break;

      case 'albertDock':
        ctx.fillStyle = col;
        this.rr(-s, -s * 0.8, s * 2, s * 1.6, s * 0.15); ctx.fill();
        ctx.fillStyle = '#1b1b1e';
        for (let a = -3; a <= 3; a++) {
          ctx.beginPath();
          ctx.arc(a * s * 0.26, s * 0.3, s * 0.1, Math.PI, 0);
          ctx.lineTo(a * s * 0.26 + s * 0.1, s * 0.7);
          ctx.lineTo(a * s * 0.26 - s * 0.1, s * 0.7);
          ctx.fill();
        }
        break;

      case 'stJellyHall':
        ctx.fillStyle = col;
        this.rr(-s, -s * 0.75, s * 2, s * 1.5, s * 0.18); ctx.fill();
        ctx.fillStyle = '#f8f9fa';
        for (let p = -4; p <= 4; p++) {
          ctx.fillRect(p * s * 0.2 - s * 0.05, -s * 0.5, s * 0.1, s);
        }
        ctx.fillStyle = '#e9ecef';
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, -s * 0.5);
        ctx.lineTo(0, -s * 0.85);
        ctx.lineTo(s * 0.8, -s * 0.5);
        ctx.closePath();
        ctx.fill();
        break;

      case 'liverBuilding':
        ctx.fillStyle = col;
        this.rr(-s, -s * 0.6, s * 2, s * 1.2, s * 0.12); ctx.fill();
        [-s * 0.55, s * 0.55].forEach((tx) => {
          ctx.fillStyle = '#3d405b';
          ctx.fillRect(tx - s * 0.3, -s * 1.25, s * 0.6, s * 0.7);
          ctx.fillStyle = '#ffd166';
          ctx.beginPath(); ctx.arc(tx, -s * 0.95, s * 0.18, 0, TAU); ctx.fill();
          ctx.fillStyle = '#2ec4b6';
          ctx.beginPath(); ctx.arc(tx, -s * 1.25, s * 0.28, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#ffd700';
          ctx.beginPath(); ctx.arc(tx, -s * 1.45, s * 0.1, 0, TAU); ctx.fill();
        });
        break;

      case 'cathedral':
        ctx.fillStyle = '#495057';
        this.rr(-s, -s * 0.8, s * 2, s * 1.6, s * 0.2); ctx.fill();
        ctx.fillStyle = '#343a40';
        ctx.fillRect(-s * 0.4, -s * 1.3, s * 0.8, s * 0.6);
        ctx.fillStyle = '#f72585';
        ctx.beginPath(); ctx.arc(0, -s * 0.3, s * 0.35, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4cc9f0';
        ctx.beginPath(); ctx.arc(0, -s * 0.3, s * 0.2, 0, TAU); ctx.fill();
        break;

      case 'metroCathedral':
        ctx.fillStyle = '#3d405b';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4cc9f0';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd166';
        for (let sp = 0; sp < 8; sp++) {
          const a = (sp * Math.PI) / 4;
          ctx.fillRect(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, s * 0.1, s * 0.25);
        }
        break;

      case 'doubleDecker':
        ctx.fillStyle = '#d90429';
        this.rr(-s * 1.2, -s * 0.6, s * 2.4, s * 1.2, s * 0.25); ctx.fill();
        ctx.fillStyle = '#ffe066';
        for (let w = -3; w <= 3; w++) {
          ctx.fillRect(w * s * 0.3 - s * 0.1, -s * 0.45, s * 0.2, s * 0.28);
          ctx.fillRect(w * s * 0.3 - s * 0.1, s * 0.05, s * 0.2, s * 0.28);
        }
        ctx.fillStyle = '#000000';
        ctx.fillRect(s * 0.85, -s * 0.4, s * 0.25, s * 0.2);
        break;

      case 'car':
      case 'taxi':
        ctx.fillStyle = col;
        this.rr(-s * 1.1, -s * 0.55, s * 2.2, s * 1.1, s * 0.3); ctx.fill();
        ctx.fillStyle = 'rgba(20,30,60,0.85)';
        this.rr(-s * 0.38, -s * 0.42, s * 0.85, s * 0.84, s * 0.15); ctx.fill();
        ctx.fillStyle = '#ffe066';
        ctx.fillRect(s * 0.95, -s * 0.42, s * 0.14, s * 0.2);
        ctx.fillRect(s * 0.95, s * 0.22, s * 0.14, s * 0.2);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.ellipse(-s * 0.4, -s * 0.2, s * 0.5, s * 0.12, 0, 0, TAU); ctx.fill();
        break;

      case 'truck':
        ctx.fillStyle = col;
        this.rr(-s * 1.2, -s * 0.6, s * 2.4, s * 1.2, s * 0.2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        this.rr(-s * 1.1, -s * 0.5, s * 1.6, s * 1.0, 3); ctx.fill();
        break;

      case 'donutShop':
        ctx.fillStyle = col;
        this.rr(-s, -s, s * 2, s * 2, s * 0.15); ctx.fill();
        ctx.fillStyle = '#ff70a6';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.65, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fdf0d5';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, TAU); ctx.fill();
        break;

      case 'tower':
        ctx.fillStyle = col;
        this.rr(-s, -s, s * 2, s * 2, s * 0.12); ctx.fill();
        ctx.fillStyle = '#ffe066';
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            ctx.fillRect(c * s * 0.34 - s * 0.08, r * s * 0.34 - s * 0.08, s * 0.16, s * 0.16);
          }
        }
        break;

      case 'sky':
        ctx.fillStyle = col;
        this.rr(-s, -s, s * 2, s * 2, s * 0.08); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        this.rr(-s * 0.65, -s * 0.65, s * 1.3, s * 1.3, s * 0.08); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.16, 0, TAU); ctx.fill();
        break;

      case 'stadium':
        ctx.fillStyle = col;
        this.rr(-s, -s * 0.75, s * 2, s * 1.5, s * 0.35); ctx.fill();
        ctx.fillStyle = '#2bb673';
        this.rr(-s * 0.65, -s * 0.45, s * 1.3, s * 0.9, s * 0.15); ctx.fill();
        break;

      case 'wheel':
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(3, s * 0.05);
        ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, TAU); ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + this.time * 0.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85);
          ctx.stroke();
        }
        break;

      default:
        ctx.fillStyle = col;
        this.rr(-s, -s, s * 2, s * 2, s * 0.2); ctx.fill();
        break;
    }
    ctx.restore();
  }
}

function pickColor(kind, seed) {
  const p = pseudoRandom(seed);
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
  if (kind === 'taxi') return '#111111';
  if (kind === 'cottage') return pick(['#f2cc8f', '#81b29a', '#bde0fe', '#f4a261'], p);
  if (kind === 'townhouse') return pick(['#8b263e', '#78290f', '#a63a50', '#a37081'], p);
  if (kind === 'donutShop') return '#ff99c8';
  if (kind === 'apt') return pick(['#4361ee', '#3a0ca3', '#7209b7'], p);
  if (kind === 'tower') return pick(['#4a4e69', '#22223b', '#6c7a89'], p);
  if (kind === 'sky') return pick(['#0077b6', '#023e8a', '#03045e'], p);
  if (kind === 'albertDock') return '#8b263e';
  if (kind === 'liverBuilding') return '#4a5759';
  if (kind === 'stJellyHall') return '#d6ccc2';
  if (kind === 'stadium') return '#d90429';
  if (kind === 'wheel') return '#e71d36';
  if (kind === 'tree') return '#2d6a4f';
  return '#2bb673';
}

function pick(arr, val) {
  return arr[Math.floor(val * arr.length) % arr.length];
}
