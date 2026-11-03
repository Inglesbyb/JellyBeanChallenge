import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const TILE = 32;
const COLS = 28; // 28 columns = 896px wide world
const ROWS = 650; // 650 rows = ~6,500 ft deep!
const SURFACE_ROW = 5; // Ground level is at row 5 (y = 160px)
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 1:1 Motherload 2004 Authentic Minerals
export const MINERALS = {
  ironium:     { id: 10, name: 'Ironium',     val: 30,     wt: 1.0, col: '#9da3a6', glow: '#ffffff', minFt: 0,    maxFt: 700  },
  bronzium:    { id: 11, name: 'Bronzium',    val: 60,     wt: 1.2, col: '#cd7f32', glow: '#ffb703', minFt: 0,    maxFt: 1100 },
  silverium:   { id: 12, name: 'Silverium',   val: 100,    wt: 1.5, col: '#e0e1dd', glow: '#ffffff', minFt: 200,  maxFt: 1800 },
  goldium:     { id: 13, name: 'Goldium',     val: 250,    wt: 1.8, col: '#ffd166', glow: '#ffeaa7', minFt: 500,  maxFt: 2800 },
  platinum:    { id: 14, name: 'Platinum',    val: 750,    wt: 2.0, col: '#4cc9f0', glow: '#b5e2fa', minFt: 900,  maxFt: 3800 },
  emerald:     { id: 15, name: 'Emerald',     val: 2000,   wt: 2.2, col: '#06d6a0', glow: '#70e000', minFt: 1600, maxFt: 4800 },
  ruby:        { id: 16, name: 'Ruby',        val: 5000,   wt: 2.5, col: '#ef233c', glow: '#ff758f', minFt: 2600, maxFt: 5800 },
  diamond:     { id: 17, name: 'Diamond',     val: 20000,  wt: 3.0, col: '#72efdd', glow: '#ffffff', minFt: 3800, maxFt: 6500 },
  amazonite:   { id: 18, name: 'Amazonite',   val: 100000, wt: 3.5, col: '#3a86ff', glow: '#90e0ef', minFt: 5000, maxFt: 6500 },
  relic:       { id: 19, name: 'Martian Relic',val: 50000, wt: 4.0, col: '#ffd700', glow: '#ff0054', minFt: 1200, maxFt: 6500 },
};

// 1:1 Motherload 2004 Junk Shop Upgrades
export const UPGRADES = {
  drill: [
    { name: 'Stock Drill',       price: 0,      speed: 1.0,  hard: 1, desc: 'Factory standard drill' },
    { name: 'Silvide Drill',     price: 750,    speed: 1.8,  hard: 1, desc: 'Fast drilling through topsoil' },
    { name: 'Goldium Drill',     price: 2000,   speed: 2.8,  hard: 2, desc: 'Cuts hard volcanic basalt' },
    { name: 'Emerald Drill',     price: 5000,   speed: 4.2,  hard: 2, desc: 'High-speed rotary sapphire head' },
    { name: 'Ruby Drill',        price: 20000,  speed: 6.5,  hard: 3, desc: 'Cuts deep dense abyssal rock' },
    { name: 'Diamond Drill',     price: 100000, speed: 10.0, hard: 3, desc: 'Industrial laser-tipped bit' },
    { name: 'Amazonite Drill',   price: 500000, speed: 16.0, hard: 4, desc: 'Quantum disintegration core' },
  ],
  engine: [
    { name: 'Stock Engine',      price: 0,      thrust: 150, desc: 'Starting 80HP thruster' },
    { name: 'V4 1600 cc',        price: 750,    thrust: 190, desc: 'Lightweight agile lift' },
    { name: 'V4 2.0L Turbo',     price: 2000,   thrust: 235, desc: 'Turbo spool for cargo weight' },
    { name: 'V6 3.8 Ltr',        price: 5000,   thrust: 290, desc: 'Heavy hauling capability' },
    { name: 'V8 Supercharged',   price: 20000,  thrust: 355, desc: 'High-thrust planetary booster' },
    { name: 'V12 6.0 Ltr',       price: 100000, thrust: 430, desc: 'Supercharged twin-turbine' },
    { name: 'V16 Jag Engine',    price: 500000, thrust: 520, desc: 'Hyper-drive anti-grav thrusters' },
  ],
  fuelTank: [
    { name: 'Micro Tank',        price: 0,      cap: 10,  desc: '10 Liters (approx 35s)' },
    { name: 'Medium Tank',       price: 750,    cap: 15,  desc: '15 Liters capacity' },
    { name: 'Huge Tank',         price: 2000,   cap: 25,  desc: '25 Liters capacity' },
    { name: 'Gigantic Tank',     price: 5000,   cap: 42,  desc: '42 Liters capacity' },
    { name: 'Titanic Tank',      price: 20000,  cap: 70,  desc: '70 Liters capacity' },
    { name: 'Leviathan Tank',    price: 100000, cap: 110, desc: '110 Liters capacity' },
    { name: 'Liquid Compression',price: 500000, cap: 160, desc: '160 Liters cryogenic storage' },
  ],
  cargoBay: [
    { name: 'Micro Bay',         price: 0,      cap: 7,   desc: '7 Cu ft mineral storage' },
    { name: 'Medium Bay',        price: 750,    cap: 15,  desc: '15 Cu ft mineral storage' },
    { name: 'Huge Bay',          price: 2000,   cap: 25,  desc: '25 Cu ft mineral storage' },
    { name: 'Gigantic Bay',      price: 5000,   cap: 45,  desc: '45 Cu ft mineral storage' },
    { name: 'Titanic Bay',       price: 20000,  cap: 75,  desc: '75 Cu ft mineral storage' },
    { name: 'Leviathan Bay',     price: 100000, cap: 120, desc: '120 Cu ft mineral storage' },
  ],
  hull: [
    { name: 'Stock Hull',        price: 0,      hp: 10,  desc: '10 Health points' },
    { name: 'Ironium Hull',      price: 750,    hp: 18,  desc: '18 Health points' },
    { name: 'Bronzium Hull',     price: 2000,   hp: 32,  desc: '32 Health points' },
    { name: 'Steel Hull',        price: 5000,   hp: 52,  desc: '52 Health points' },
    { name: 'Platinum Hull',     price: 20000,  hp: 85,  desc: '85 Health points' },
    { name: 'Einsteinium Hull',  price: 100000, hp: 130, desc: '130 Health points' },
    { name: 'Energy-Shielded',   price: 500000, hp: 200, desc: '200 Health + energy shield' },
  ],
  radiator: [
    { name: 'Stock Fan',         price: 0,      resist: 0.0, desc: '0% heat protection' },
    { name: 'Dual Fans',         price: 2000,   resist: 0.18,desc: '18% heat damage reduction' },
    { name: 'Single Turbine',    price: 5000,   resist: 0.35,desc: '35% heat damage reduction' },
    { name: 'Dual Turbines',     price: 20000,  resist: 0.55,desc: '55% heat damage reduction' },
    { name: 'Puron Cooling',     price: 100000, resist: 0.75,desc: '75% heat damage reduction' },
    { name: 'Freon Cryo-Array',  price: 500000, resist: 0.90,desc: '90% heat damage reduction' },
  ],
};

// Emergency Shop Consumables
export const ITEMS = {
  reserveFuel: { name: 'Reserve Fuel',  price: 2000,  desc: '+25 Liters fuel instantly', key: '1' },
  nanobots:    { name: 'Nanobots',      price: 5000,  desc: '+35 HP hull auto-repair',   key: '2' },
  dynamite:    { name: 'Dynamite',      price: 2000,  desc: 'Clears 3x3 blast radius',   key: '3' },
  teleporter:  { name: 'Teleporter',    price: 10000, desc: 'Instant beam to surface',    key: '4' },
};

function pseudoRandom(seed) {
  let s = Math.sin(seed) * 10000;
  return s - Math.floor(s);
}

export class Motherload extends Game {
  static meta = {
    id: 'motherload',
    title: 'Motherload',
    icon: '⛏️',
    hint: 'STEER & DRILL: A/D or ARROWS · FLY: W or UP · Return to surface stations to refuel, cash in & upgrade!',
    baseLikes: 8420,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.grid = [];
    this.minedTiles = new Set();
    this.boulders = [];

    // Equipment Upgrades indices
    this.upgrades = {
      drill: 0,
      engine: 0,
      fuelTank: 0,
      cargoBay: 0,
      hull: 0,
      radiator: 0,
    };

    this.cash = 0;
    this.cargo = []; // list of mineral objects
    this.cargoWeight = 0;
    this.inventory = {
      reserveFuel: 0,
      nanobots: 0,
      dynamite: 0,
      teleporter: 0,
    };

    // Pod Physics
    this.pod = {
      x: 14 * TILE,
      y: SURFACE_ROW * TILE - 14,
      vx: 0,
      vy: 0,
      w: 30,
      h: 26,
      fuel: UPGRADES.fuelTank[0].cap,
      hull: UPGRADES.hull[0].hp,
      dir: 1, // -1: left, 1: right
      drilling: null, // { col, row, progress, max, dir: 'down'|'left'|'right' }
      flying: false,
      grounded: true,
      fallSpeed: 0,
      suspension: 0,
    };

    // Stations & Modal System
    this.modal = null; // null | 'mineral' | 'fuel' | 'repair' | 'junk'
    this.stationPrompt = null; // { name, type, x, y }
    this.camX = 0;
    this.camY = 0;
    this.alarmT = 0;
    this.lastFuelGlug = 0;

    // Generate Procedural Subterranean Mars
    this.generateWorld();

    // Restore saved gauntlet state if present
    if (saved) {
      if (saved.upgrades) Object.assign(this.upgrades, saved.upgrades);
      if (saved.cash !== undefined) this.cash = saved.cash;
      if (saved.cargo) this.cargo = [...saved.cargo];
      if (saved.inventory) Object.assign(this.inventory, saved.inventory);
      if (saved.pod) {
        this.pod.x = saved.pod.x ?? this.pod.x;
        this.pod.y = saved.pod.y ?? this.pod.y;
        const maxFuel = UPGRADES.fuelTank[this.upgrades.fuelTank].cap;
        const maxHull = UPGRADES.hull[this.upgrades.hull].hp;
        this.pod.fuel = (saved.pod.fuel && saved.pod.fuel > 0.5) ? saved.pod.fuel : maxFuel;
        this.pod.hull = (saved.pod.hull && saved.pod.hull > 0) ? saved.pod.hull : maxHull;
      }
      if (saved.mined) {
        for (const key of saved.mined) {
          const [c, r] = key.split(',').map(Number);
          // Protect station foundation from ever being mined/corrupted in saved data
          if (r === SURFACE_ROW && ((c >= 2 && c <= 7) || (c >= 9 && c <= 13) || (c >= 15 && c <= 19) || (c >= 21 && c <= 26))) {
            continue;
          }
          this.minedTiles.add(key);
          if (this.grid[r] && this.grid[r][c] !== undefined) {
            this.grid[r][c] = 0;
          }
        }
      }
      // Guarantee station foundations are intact
      for (let c = 0; c < COLS; c++) {
        if ((c >= 2 && c <= 7) || (c >= 9 && c <= 13) || (c >= 15 && c <= 19) || (c >= 21 && c <= 26)) {
          if (this.grid[SURFACE_ROW]) this.grid[SURFACE_ROW][c] = 98;
        }
      }
      this.grace = 1.5;
    } else {
      this.grace = 1.0;
    }

    this.calcCargoWeight();
  }

  serialize() {
    return {
      upgrades: { ...this.upgrades },
      cash: this.cash,
      cargo: [...this.cargo],
      inventory: { ...this.inventory },
      pod: {
        x: Math.round(this.pod.x),
        y: Math.round(this.pod.y),
        fuel: +this.pod.fuel.toFixed(2),
        hull: +this.pod.hull.toFixed(1),
      },
      mined: Array.from(this.minedTiles).slice(-2500),
    };
  }

  restoreLabel() {
    const depth = Math.max(0, Math.round((this.pod.y - SURFACE_ROW * TILE) * 3.33));
    return `Depth -${depth} ft · $${this.cash.toLocaleString()} · ${UPGRADES.drill[this.upgrades.drill].name}`;
  }

  calcCargoWeight() {
    this.cargoWeight = this.cargo.reduce((sum, item) => sum + item.wt, 0);
  }

  /* ------------------------------------------------ Procedural Subterranean World */
  generateWorld() {
    this.grid = [];
    for (let r = 0; r < ROWS; r++) {
      this.grid[r] = new Uint8Array(COLS);
      for (let c = 0; c < COLS; c++) {
        // Bedrock boundaries (left edge, right edge, bottom)
        if (c === 0 || c === COLS - 1 || r === ROWS - 1) {
          this.grid[r][c] = 99; // Bedrock
          continue;
        }

        // Sky above surface
        if (r < SURFACE_ROW) {
          this.grid[r][c] = 0; // Air
          continue;
        }

        // Station Runway Foundations at ground level (Indestructible steel pads)
        if (r === SURFACE_ROW) {
          const isUnderStation = (c >= 2 && c <= 7) || (c >= 9 && c <= 13) || (c >= 15 && c <= 19) || (c >= 21 && c <= 26);
          if (isUnderStation) {
            this.grid[r][c] = 98; // Station Foundation Steel Runway
            continue;
          }
        }

        // Subterranean Depth in feet
        const depthFt = (r - SURFACE_ROW) * 10;
        const seed = c * 73856093 ^ r * 19349663;
        const roll = pseudoRandom(seed);
        const roll2 = pseudoRandom(seed + 101);

        // 1. Hazards: Gas Pockets, Magma, Heavy Boulders
        if (depthFt > 500 && roll < 0.038) {
          this.grid[r][c] = 30; // Methane Gas Pocket
          continue;
        }
        if (depthFt > 2000 && roll < 0.055) {
          this.grid[r][c] = 31; // Lava Channel
          continue;
        }
        if (depthFt > 350 && roll2 < 0.045) {
          this.grid[r][c] = 32; // Heavy Boulder
          continue;
        }

        // 2. Rare Deep Minerals
        if (depthFt >= 5000 && roll < 0.035) {
          this.grid[r][c] = MINERALS.amazonite.id;
          continue;
        }
        if (depthFt >= 1200 && roll < 0.007) {
          this.grid[r][c] = MINERALS.relic.id;
          continue;
        }
        if (depthFt >= 3800 && roll < 0.05) {
          this.grid[r][c] = MINERALS.diamond.id;
          continue;
        }
        if (depthFt >= 2600 && roll < 0.065) {
          this.grid[r][c] = MINERALS.ruby.id;
          continue;
        }
        if (depthFt >= 1600 && roll < 0.08) {
          this.grid[r][c] = MINERALS.emerald.id;
          continue;
        }
        if (depthFt >= 900 && roll < 0.095) {
          this.grid[r][c] = MINERALS.platinum.id;
          continue;
        }
        if (depthFt >= 500 && roll < 0.11) {
          this.grid[r][c] = MINERALS.goldium.id;
          continue;
        }
        if (depthFt >= 200 && roll < 0.13) {
          this.grid[r][c] = MINERALS.silverium.id;
          continue;
        }
        if (roll < 0.16) {
          this.grid[r][c] = MINERALS.bronzium.id;
          continue;
        }
        if (roll < 0.22) {
          this.grid[r][c] = MINERALS.ironium.id;
          continue;
        }

        // 3. Stratified Rock Hardness
        if (depthFt > 4000) {
          this.grid[r][c] = 4; // Dense Obsidian
        } else if (depthFt > 2000) {
          this.grid[r][c] = 3; // Abyssal Granite
        } else if (depthFt > 800) {
          this.grid[r][c] = 2; // Volcanic Basalt
        } else {
          this.grid[r][c] = 1; // Martian Clay / Dirt
        }
      }
    }
  }

  /* ------------------------------------------------ Main Update Loop */
  update(dt) {
    if (this.dead) return;

    const p = this.pod;
    const inp = this.input;

    // Handle Modal Clicks & Key dismissals
    if (this.modal) {
      this.updateModalInput();
      return; // Pause physics while browsing station terminals
    }

    // Input Detection (Keyboard or Virtual Controls)
    const kVec = inp.keyVec ? inp.keyVec() : null;
    let left = inp.key('arrowleft', 'a');
    let right = inp.key('arrowright', 'd');
    let up = inp.key('arrowup', 'w');
    let down = inp.key('arrowdown', 's');

    // Touch / Mouse Drag Joystick
    if (!left && !right && !up && !down && inp.down) {
      const v = inp.vec ? inp.vec(50) : { x: 0, y: 0 };
      if (v.x < -0.3) left = true;
      if (v.x > 0.3) right = true;
      if (v.y < -0.3) up = true;
      if (v.y > 0.3) down = true;
    }

    // Hotkeys & On-Screen Taps for Consumable Items with single-press debounce
    const k1 = inp.key('1') || inp.key('f');
    const k2 = inp.key('2') || inp.key('n');
    const k3 = inp.key('3') || inp.key('b');
    const k4 = inp.key('4') || inp.key('t');

    if (k1 && !this.prevItemKeys?.k1) this.useItem('reserveFuel');
    if (k2 && !this.prevItemKeys?.k2) this.useItem('nanobots');
    if (k3 && !this.prevItemKeys?.k3) this.useItem('dynamite');
    if (k4 && !this.prevItemKeys?.k4) this.useItem('teleporter');

    this.prevItemKeys = { k1, k2, k3, k4 };

    // Tapping bottom quick-items hotbar on screen
    const barY = this.H - 128;
    const barW = 340;
    const barX = this.W / 2 - barW / 2;
    if (inp.pressed && inp.y >= barY && inp.y <= barY + 36 && inp.x >= barX && inp.x <= barX + barW) {
      const slot = Math.floor(((inp.x - barX) / (barW / 4)));
      if (slot === 0) this.useItem('reserveFuel');
      else if (slot === 1) this.useItem('nanobots');
      else if (slot === 2) this.useItem('dynamite');
      else if (slot === 3) this.useItem('teleporter');
    }

    // 1. Drilling In Progress
    if (p.drilling) {
      const drillSpec = UPGRADES.drill[this.upgrades.drill];
      p.drilling.progress += drillSpec.speed * dt * 2.2;
      p.vx = 0;
      p.vy = 0;

      // Dust & grinding spark particles
      const tx = p.drilling.col * TILE + TILE / 2;
      const ty = p.drilling.row * TILE + TILE / 2;
      if (Math.random() < 0.6) {
        this.fx.burst(tx + (Math.random() - 0.5) * 16, ty + (Math.random() - 0.5) * 16, '#c18c5d', 2, 40, 0.25, 2.5);
      }
      p.fuel = Math.max(0, p.fuel - dt * 0.15); // Drilling consumes fuel

      if (p.drilling.progress >= p.drilling.max) {
        this.finishDrilling(p.drilling.col, p.drilling.row);
        p.drilling = null;
      }
      this.fx.update(dt);
      return;
    }

    // 2. Flight & Jetpack Physics
    const engineSpec = UPGRADES.engine[this.upgrades.engine];
    const cargoCap = UPGRADES.cargoBay[this.upgrades.cargoBay].cap;
    const weightPenalty = 1 + (this.cargoWeight / Math.max(1, cargoCap)) * 0.45;

    p.flying = false;
    if (up && p.fuel > 0) {
      // Upward jetpack thrust fighting gravity & cargo weight
      p.vy = Math.max(-210, p.vy - (engineSpec.thrust / weightPenalty) * 3.4 * dt);
      p.fuel = Math.max(0, p.fuel - dt * 0.45); // Thrusters burn fuel steadily
      p.flying = true;
      p.grounded = false;

      // Jet flame particles
      if (Math.random() < 0.75) {
        const fxX = p.x + (Math.random() - 0.5) * 8;
        const fxY = p.y + p.h / 2;
        this.fx.burst(fxX, fxY, '#ff9f1c', 2, 35, 0.22, 3, 40);
        this.fx.burst(fxX, fxY + 4, '#ff0054', 1, 20, 0.15, 2);
      }
    } else {
      // Natural Mars Gravity
      p.vy = Math.min(270, p.vy + 380 * dt);
    }

    // 3. Horizontal Steering
    const maxMoveSpeed = 120 / (1 + (this.cargoWeight / cargoCap) * 0.25);
    if (left) {
      p.vx = -maxMoveSpeed;
      p.dir = -1;
    } else if (right) {
      p.vx = maxMoveSpeed;
      p.dir = 1;
    } else {
      p.vx *= 0.65;
    }

    // 4. Movement Integration & Collision Checks
    const nextX = p.x + p.vx * dt;
    const nextY = p.y + p.vy * dt;

    const col = Math.floor(p.x / TILE);
    const row = Math.floor(p.y / TILE);

    // Drilling Downward (Hold Down while Grounded)
    if (down && p.grounded && !p.drilling) {
      const targetRow = row + 1;
      if (this.isSolid(col, targetRow)) {
        this.startDrilling(col, targetRow, 'down');
        return;
      }
    }

    // Drilling Horizontally (Steer into solid block)
    if ((left || right) && !p.drilling) {
      const targetCol = left ? Math.floor((p.x - p.w / 2 - 2) / TILE) : Math.floor((p.x + p.w / 2 + 2) / TILE);
      if (this.isSolid(targetCol, row)) {
        this.startDrilling(targetCol, row, left ? 'left' : 'right');
        return;
      }
    }

    // Horizontal Movement Collision
    const sideCol = p.vx < 0 ? Math.floor((nextX - p.w / 2) / TILE) : Math.floor((nextX + p.w / 2) / TILE);
    if (this.isSolid(sideCol, row)) {
      p.vx = 0;
    } else {
      p.x = nextX;
    }

    // Vertical Movement Collision & Fall Damage
    const vertRow = p.vy < 0 ? Math.floor((nextY - p.h / 2) / TILE) : Math.floor((nextY + p.h / 2) / TILE);
    if (this.isSolid(col, vertRow)) {
      if (p.vy > 0) {
        // Impact on landing!
        if (p.vy > 215) {
          // Hard fall impact damage
          const dmg = Math.round((p.vy - 215) * 0.22);
          p.hull = Math.max(0, p.hull - dmg);
          this.fx.shake(7, 0.25);
          this.fx.text(p.x, p.y - 20, `FALL IMPACT! -${dmg} HP`, '#ff0054', 16);
          this.sounds.tick();
          this.haptics.heavy();
          if (p.hull <= 0) {
            this.die('Crushed on hard rock impact');
          }
        }
        p.grounded = true;
        p.vy = 0;
        p.y = vertRow * TILE - p.h / 2;
      } else {
        // Ceiling bump
        p.vy = 0;
        p.y = vertRow * TILE + TILE + p.h / 2;
      }
    } else {
      p.y = nextY;
      p.grounded = false;
    }

    // 5. Environmental Lava / Heat Damage
    const curTile = this.grid[row] ? this.grid[row][col] : 0;
    if (curTile === 31) {
      const rad = UPGRADES.radiator[this.upgrades.radiator].resist;
      const heatDmg = (1 - rad) * 24 * dt;
      p.hull = Math.max(0, p.hull - heatDmg);
      this.fx.burst(p.x, p.y, '#ff0054', 3, 30, 0.2, 3);
      if (p.hull <= 0) {
        this.die('Incinerated in subterranean magma channel');
      }
    }

    // 6. Out of Fuel Check
    if (p.fuel <= 0 && p.grounded && p.y > (SURFACE_ROW + 1) * TILE) {
      if (this.die('Stranded underground: Out of fuel!')) {
        this.fx.burst(p.x, p.y, '#ff4b5c', 35, 120, 0.8, 5);
        this.fx.shake(12, 0.4);
      }
    }

    // 7. Update Boulders (Falling rock physics)
    this.updateBoulders(dt);

    // 8. Surface Station Docking Checks
    this.checkStationPrompts();

    // Smooth Camera Tracking: Anchor pod vertically at screen Y = 350
    // When pod is at surface (p.y = 146): targetCamY = 146 - 350 = -204.
    // Clamping minCamY to -190 gives clear headroom above surface buildings
    const targetCamX = clamp(p.x - this.W / 2, 0, COLS * TILE - this.W);
    const minCamY = -190;
    const maxCamY = (ROWS - 1) * TILE - 450;
    const targetCamY = clamp(p.y - 350, minCamY, maxCamY);
    this.camX += (targetCamX - this.camX) * Math.min(1, dt * 8);
    this.camY += (targetCamY - this.camY) * Math.min(1, dt * 6);

    this.fx.update(dt);
  }

  isSolid(c, r) {
    if (c < 0 || c >= COLS) return true;
    if (r < -8) return true; // High ceiling in Martian stratosphere
    if (r < SURFACE_ROW) return false; // Open sky above surface
    if (r >= ROWS) return true;
    const tile = this.grid[r][c];
    return tile !== 0 && tile !== 31; // Air (0) and Lava (31) are passable
  }

  /* ------------------------------------------------ Drilling Action */
  startDrilling(c, r, dir) {
    const tile = this.grid[r][c];
    if (tile === 99 || tile === 98) return; // Unbreakable Bedrock & Station Foundation!

    // Gas Pocket explosion check!
    if (tile === 30) {
      this.grid[r][c] = 0;
      this.minedTiles.add(`${c},${r}`);
      const rad = UPGRADES.radiator[this.upgrades.radiator].resist;
      const dmg = Math.round(35 * (1 - rad));
      this.pod.hull = Math.max(0, this.pod.hull - dmg);
      this.fx.burst(c * TILE + TILE / 2, r * TILE + TILE / 2, '#ffbe0b', 28, 120, 0.6, 5);
      this.fx.shake(10, 0.35);
      this.fx.text(this.pod.x, this.pod.y - 25, `GAS EXPLOSION! -${dmg} HP`, '#ff0054', 18);
      this.sounds.hit();
      this.haptics.heavy();
      if (this.pod.hull <= 0) {
        this.die('Killed in subterranean methane explosion');
      }
      return;
    }

    // Hardness based on rock tier
    let hardness = 1.0;
    if (tile === 2) hardness = 1.6;
    else if (tile === 3) hardness = 2.8;
    else if (tile === 4) hardness = 4.5;
    else if (tile >= 10 && tile <= 19) hardness = 2.0;
    else if (tile === 32) hardness = 3.5; // Boulder

    this.pod.drilling = {
      col: c,
      row: r,
      progress: 0,
      max: hardness,
      dir,
    };
    this.sounds.gulp(0.85);
    this.haptics.light();
  }

  finishDrilling(c, r) {
    const tile = this.grid[r][c];
    this.grid[r][c] = 0;
    this.minedTiles.add(`${c},${r}`);

    // Burst of rock crumble
    this.fx.burst(c * TILE + TILE / 2, r * TILE + TILE / 2, '#8d99ae', 10, 60, 0.3, 3);
    this.sounds.drop();

    // Check if tile is a mineral
    const minEntry = Object.values(MINERALS).find(m => m.id === tile);
    if (minEntry) {
      const cargoCap = UPGRADES.cargoBay[this.upgrades.cargoBay].cap;
      if (this.cargoWeight + minEntry.wt <= cargoCap + 0.01) {
        this.cargo.push(minEntry);
        this.calcCargoWeight();
        this.score += minEntry.val;
        this.fx.text(c * TILE + TILE / 2, r * TILE, `+${minEntry.name} ($${minEntry.val})`, minEntry.glow, 16);
        this.sounds.up();
        this.haptics.light();
      } else {
        this.fx.text(c * TILE + TILE / 2, r * TILE, 'CARGO FULL!', '#ff0054', 18);
        this.sounds.tick();
      }
    }
  }

  /* ------------------------------------------------ Boulders (Falling Rock Hazards) */
  updateBoulders(dt) {
    const p = this.pod;
    const minR = Math.max(SURFACE_ROW, Math.floor((this.camY - 50) / TILE));
    const maxR = Math.min(ROWS - 2, Math.ceil((this.camY + this.H + 50) / TILE));

    for (let r = maxR; r >= minR; r--) {
      for (let c = 1; c < COLS - 1; c++) {
        if (this.grid[r][c] === 32) {
          // Check if space underneath is empty air (0)
          if (this.grid[r + 1][c] === 0) {
            // Drop boulder down one tile!
            this.grid[r][c] = 0;
            this.grid[r + 1][c] = 32;

            // Check if it crushed the pod!
            const bx = c * TILE + TILE / 2;
            const by = (r + 1) * TILE + TILE / 2;
            if (Math.hypot(p.x - bx, p.y - by) < 26) {
              p.hull = Math.max(0, p.hull - 45);
              this.fx.shake(12, 0.4);
              this.fx.text(p.x, p.y - 30, 'CRUSHED BY BOULDER! -45 HP', '#ff0054', 18);
              this.sounds.hit();
              this.haptics.heavy();
              if (p.hull <= 0) {
                this.die('Crushed by subterranean falling boulder');
              }
            }
          }
        }
      }
    }
  }

  /* ------------------------------------------------ Surface Stations Interaction */
  checkStationPrompts() {
    const p = this.pod;
    this.stationPrompt = null;

    // Prompt when pod is in vicinity of surface stations (y between stratosphere and 2.5 tiles into ground)
    if (p.y > (SURFACE_ROW + 2.5) * TILE || p.y < -150) return;

    // 4 Surface Stations across columns:
    // 1. Mineral Processing: Cols 2..7 (x: 64 .. 224)
    if (p.x >= 2 * TILE && p.x <= 7.5 * TILE) {
      this.stationPrompt = { name: 'MINERAL PROCESSING', type: 'mineral', col: '#06d6a0', icon: '💎' };
    }
    // 2. Fuel Depot: Cols 9..13 (x: 288 .. 416)
    else if (p.x >= 8.5 * TILE && p.x <= 13.5 * TILE) {
      this.stationPrompt = { name: 'FUEL DEPOT', type: 'fuel', col: '#ffd166', icon: '⛽' };
    }
    // 3. Repair Bay: Cols 15..19 (x: 480 .. 608)
    else if (p.x >= 14.5 * TILE && p.x <= 19.5 * TILE) {
      this.stationPrompt = { name: 'REPAIR & GEAR', type: 'repair', col: '#4cc9f0', icon: '🔧' };
    }
    // 4. Junk Yard Upgrades: Cols 21..26 (x: 672 .. 832)
    else if (p.x >= 20.5 * TILE && p.x <= 26.5 * TILE) {
      this.stationPrompt = { name: 'AUTOBUY 2000', type: 'junk', col: '#f72585', icon: '🛠️' };
    }

    // Open station terminal if landed, or hovering in front of station with low vertical velocity
    if (this.stationPrompt) {
      const canDock = p.grounded || Math.abs(p.vy) < 140;
      const wantsDock = this.input.key('e', 'enter', ' ') || (this.input.pressed && this.input.y < this.H * 0.75);
      if (canDock && wantsDock) {
        this.openStation(this.stationPrompt.type);
      }
    }
  }

  openStation(type) {
    this.modal = type;
    this.sounds.welcome();
    this.haptics.medium();
  }

  closeStation() {
    this.modal = null;
    this.sounds.like();
  }

  /* ------------------------------------------------ Station Modal Logic */
  updateModalInput() {
    const inp = this.input;
    if (inp.key('escape')) {
      this.closeStation();
      return;
    }

    if (!inp.pressed) return;
    const px = inp.x;
    const py = inp.y;

    const mw = 390;
    const mh = 480;
    const mx = this.W / 2 - mw / 2;
    const my = this.H / 2 - mh / 2 + 15;

    // Click backdrop outside modal card to dismiss
    if (px < mx || px > mx + mw || py < my || py > my + mh) {
      this.closeStation();
      return;
    }

    // Close Button [X] at Top-Right
    if (px >= mx + mw - 50 && px <= mx + mw - 10 && py >= my + 10 && py <= my + 50) {
      this.closeStation();
      return;
    }

    // 1. Mineral Processing Modal: [SELL ALL]
    if (this.modal === 'mineral') {
      // Sell All Minerals Button (drawn at mx + 20, my + 330, mw - 40, 50)
      if (px >= mx + 20 && px <= mx + mw - 20 && py >= my + 330 && py <= my + 380) {
        this.sellCargo();
      }
    }

    // 2. Fuel Depot Modal
    else if (this.modal === 'fuel') {
      const maxFuel = UPGRADES.fuelTank[this.upgrades.fuelTank].cap;
      const needed = maxFuel - this.pod.fuel;
      const fullCost = Math.round(needed * 2);

      // Fill Tank Button (drawn at mx + 20, my + 205, mw - 40, 50)
      if (px >= mx + 20 && px <= mx + mw - 20 && py >= my + 205 && py <= my + 255) {
        if (needed > 0.1 && (this.cash >= fullCost || this.pod.fuel < 2)) {
          this.cash = Math.max(0, this.cash - fullCost);
          this.pod.fuel = maxFuel;
          this.fx.text(this.W / 2, 330, `TANK FULL! -$${fullCost}`, '#06d6a0', 22);
          this.sounds.welcome();
          this.haptics.success();
        }
      }
      // Top up +5L Button (drawn at mx + 20, my + 270, mw - 40, 46)
      if (px >= mx + 20 && px <= mx + mw - 20 && py >= my + 270 && py <= my + 316) {
        if (needed > 0.1 && this.cash >= 10) {
          this.cash -= 10;
          this.pod.fuel = Math.min(maxFuel, this.pod.fuel + 5);
          this.sounds.gulp(1.2);
          this.haptics.light();
        }
      }
    }

    // 3. Repair Bay Modal
    else if (this.modal === 'repair') {
      const maxHull = UPGRADES.hull[this.upgrades.hull].hp;
      const neededHp = maxHull - this.pod.hull;
      const fullCost = Math.round(neededHp * 8);

      // Repair Full Hull (drawn at mx + 16, my + 78, mw - 32, 48)
      if (px >= mx + 16 && px <= mx + mw - 16 && py >= my + 78 && py <= my + 126) {
        if (neededHp > 0.5 && (this.cash >= fullCost || this.pod.hull < 3)) {
          this.cash = Math.max(0, this.cash - fullCost);
          this.pod.hull = maxHull;
          this.fx.text(this.W / 2, 260, `HULL RESTORED! -$${fullCost}`, '#4cc9f0', 20);
          this.sounds.up();
          this.haptics.success();
        }
      }

      // Emergency Consumable Items (drawn at rowY = my + 140 + idx * 48, buy button at mx + mw - 105, rowY + 6, 88, 30)
      const itemKeys = ['reserveFuel', 'nanobots', 'dynamite', 'teleporter'];
      itemKeys.forEach((k, idx) => {
        const item = ITEMS[k];
        const rowY = my + 140 + idx * 48;
        if (px >= mx + mw - 110 && px <= mx + mw - 15 && py >= rowY + 4 && py <= rowY + 38) {
          if (this.cash >= item.price) {
            this.cash -= item.price;
            this.inventory[k]++;
            this.sounds.like();
            this.haptics.medium();
          }
        }
      });
    }

    // 4. Junk Shop Modal (Upgrades)
    else if (this.modal === 'junk') {
      // Categories drawn at rowY = my + 76 + idx * 52, buy button at mx + mw - 110, rowY + 8, 92, 30
      const cats = ['drill', 'engine', 'fuelTank', 'cargoBay', 'hull', 'radiator'];
      cats.forEach((cat, idx) => {
        const rowY = my + 76 + idx * 52;
        if (px >= mx + mw - 115 && px <= mx + mw - 15 && py >= rowY + 6 && py <= rowY + 40) {
          this.buyUpgrade(cat);
        }
      });
    }
  }

  sellCargo() {
    if (this.cargo.length === 0) return;
    let total = 0;
    for (const item of this.cargo) total += item.val;

    this.cash += total;
    this.score += total;
    this.cargo = [];
    this.calcCargoWeight();

    this.fx.text(this.W / 2, 320, `SOLD! +$${total.toLocaleString()}`, '#ffd166', 26);
    this.fx.burst(this.W / 2, 350, '#ffd166', 30, 100, 0.6, 5);
    this.sounds.like();
    this.haptics.success();
  }

  buyUpgrade(cat) {
    const list = UPGRADES[cat];
    const curTier = this.upgrades[cat];
    if (curTier < list.length - 1) {
      const next = list[curTier + 1];
      if (this.cash >= next.price) {
        this.cash -= next.price;
        this.upgrades[cat]++;
        // Immediate stat boost
        if (cat === 'fuelTank') this.pod.fuel = next.cap;
        if (cat === 'hull') this.pod.hull = next.hp;

        this.fx.text(this.W / 2, 190, `${next.name.toUpperCase()} EQUIPPED!`, '#ffd166', 22);
        this.sounds.like();
        this.haptics.success();
      }
    }
  }

  useItem(name) {
    if (!this.inventory[name] || this.inventory[name] <= 0) return;

    if (name === 'reserveFuel') {
      const max = UPGRADES.fuelTank[this.upgrades.fuelTank].cap;
      this.inventory.reserveFuel--;
      this.pod.fuel = Math.min(max, this.pod.fuel + 25);
      this.fx.text(this.pod.x, this.pod.y - 25, '+25L RESERVE FUEL!', '#06d6a0', 20);
      this.sounds.welcome();
    } else if (name === 'nanobots') {
      const max = UPGRADES.hull[this.upgrades.hull].hp;
      this.inventory.nanobots--;
      this.pod.hull = Math.min(max, this.pod.hull + 35);
      this.fx.text(this.pod.x, this.pod.y - 25, '+35 HP NANOBOTS REPAIR!', '#4cc9f0', 20);
      this.sounds.up();
    } else if (name === 'dynamite') {
      this.inventory.dynamite--;
      const pc = Math.floor(this.pod.x / TILE);
      const pr = Math.floor(this.pod.y / TILE);
      for (let r = pr - 1; r <= pr + 1; r++) {
        for (let c = pc - 1; c <= pc + 1; c++) {
          if (r >= SURFACE_ROW && r < ROWS && c > 0 && c < COLS - 1) {
            if (this.grid[r][c] !== 99 && this.grid[r][c] !== 98) {
              this.grid[r][c] = 0;
              this.minedTiles.add(`${c},${r}`);
            }
          }
        }
      }
      this.fx.burst(this.pod.x, this.pod.y, '#ff9f1c', 40, 140, 0.6, 5);
      this.fx.shake(12, 0.4);
      this.sounds.hit();
    } else if (name === 'teleporter') {
      this.inventory.teleporter--;
      this.pod.x = 11 * TILE; // Fuel depot
      this.pod.y = SURFACE_ROW * TILE - 14;
      this.pod.vx = 0;
      this.pod.vy = 0;
      this.fx.burst(this.pod.x, this.pod.y, '#72efdd', 35, 100, 0.5, 4);
      this.fx.text(this.pod.x, this.pod.y - 30, 'QUANTUM TELEPORTED!', '#72efdd', 22);
      this.sounds.like();
    }
  }

  /* ------------------------------------------------ Render Engine */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const p = this.pod;

    // Viewport camera offset with shake
    const off = this.fx.offset();
    const camX = clamp(Math.round(this.camX + off.x), 0, COLS * TILE - W);
    const camY = clamp(Math.round(this.camY + off.y), -200, (ROWS - 1) * TILE - 450);

    ctx.fillStyle = '#0a0512';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-camX, -camY);

    // 1. Martian Sky & Distant Craters
    this.drawMartianSky(ctx, camX, camY);

    // 2. Subterranean Crust & Tiles
    this.drawTiles(ctx, camX, camY);

    // 3. Surface Station Buildings
    this.drawSurfaceStations(ctx);

    // 4. Player Mining Pod & Captain Bean
    this.drawPod(ctx);

    this.fx.render(ctx, 1);
    ctx.restore();

    // 5. Stylized Jelly Reels Dashboard HUD
    this.drawDashboardHUD(ctx, W, H);

    // 6. Interactive Station Modals
    if (this.modal) {
      this.drawStationModal(ctx, W, H);
    }
  }

  /* ------------------------------------------------ Sky & Mountains */
  drawMartianSky(ctx, camX, camY) {
    const skyH = SURFACE_ROW * TILE;
    if (camY >= skyH + 300) return;

    // Deep space red nebula gradient extended upwards into high sky
    const minY = Math.min(-350, camY - 100);
    const g = ctx.createLinearGradient(0, minY, 0, skyH);
    g.addColorStop(0, '#040208');
    g.addColorStop(0.35, '#130818');
    g.addColorStop(0.7, '#2e1122');
    g.addColorStop(1, '#5a1e2d');
    ctx.fillStyle = g;
    ctx.fillRect(camX, minY, this.W, skyH - minY);

    // Distant jagged Martian mountain ridge
    ctx.fillStyle = '#30131d';
    ctx.beginPath();
    ctx.moveTo(0, skyH);
    ctx.lineTo(80, skyH - 65);
    ctx.lineTo(220, skyH - 35);
    ctx.lineTo(380, skyH - 95);
    ctx.lineTo(540, skyH - 45);
    ctx.lineTo(720, skyH - 110);
    ctx.lineTo(COLS * TILE, skyH);
    ctx.closePath();
    ctx.fill();

    // Twinkling stars scattered across the full sky height
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let i = 0; i < 45; i++) {
      const sx = (i * 12345) % (COLS * TILE);
      const sy = -300 + ((i * 6789) % (skyH + 300));
      const sz = (i % 3 === 0) ? 2.5 : 1.5;
      ctx.fillRect(sx, sy, sz, sz);
    }
  }

  /* ------------------------------------------------ Subterranean Tiles & Minerals */
  drawTiles(ctx, camX, camY) {
    const minC = Math.max(0, Math.floor(camX / TILE));
    const maxC = Math.min(COLS - 1, Math.ceil((camX + this.W) / TILE));
    const minR = Math.max(SURFACE_ROW, Math.floor(camY / TILE));
    const maxR = Math.min(ROWS - 1, Math.ceil((camY + this.H) / TILE));

    for (let r = minR; r <= maxR; r++) {
      const depthFt = (r - SURFACE_ROW) * 10;

      // Layered soil palettes matching Bloons/Jelly Reels vector style
      let soilCol, darkCol, litCol;
      if (depthFt > 4000) {
        soilCol = '#241019'; darkCol = '#16080e'; litCol = '#381625';
      } else if (depthFt > 2000) {
        soilCol = '#1e1c38'; darkCol = '#111024'; litCol = '#2f2c57';
      } else if (depthFt > 800) {
        soilCol = '#3d1a2c'; darkCol = '#28101c'; litCol = '#57263f';
      } else {
        soilCol = '#6b2d35'; darkCol = '#471c22'; litCol = '#8a3c46';
      }

      for (let c = minC; c <= maxC; c++) {
        const t = this.grid[r][c];
        if (t === 0) continue; // Mined tunnel

        const tx = c * TILE;
        const ty = r * TILE;

        // Bedrock
        if (t === 99) {
          ctx.fillStyle = '#0f1118';
          ctx.fillRect(tx, ty, TILE, TILE);
          ctx.strokeStyle = '#27293d';
          ctx.lineWidth = 2;
          ctx.strokeRect(tx + 1, ty + 1, TILE - 2, TILE - 2);
          continue;
        }

        // Station Runway Foundation (Indestructible Steel Pad)
        if (t === 98) {
          ctx.fillStyle = '#2b2d42';
          ctx.fillRect(tx, ty, TILE, TILE);
          // Steel plate border & bevel
          ctx.fillStyle = '#4a4e69';
          ctx.fillRect(tx, ty, TILE, 3);
          ctx.fillStyle = '#1c1d2b';
          ctx.fillRect(tx, ty + TILE - 3, TILE, 3);
          // Industrial hazard stripes
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.moveTo(tx + 6, ty + TILE - 4);
          ctx.lineTo(tx + 14, ty + TILE - 4);
          ctx.lineTo(tx + 8, ty + 4);
          ctx.lineTo(tx, ty + 4);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(tx + 20, ty + TILE - 4);
          ctx.lineTo(tx + 28, ty + TILE - 4);
          ctx.lineTo(tx + 22, ty + 4);
          ctx.lineTo(tx + 14, ty + 4);
          ctx.closePath();
          ctx.fill();
          // Runway Rivets
          ctx.fillStyle = '#adb5bd';
          ctx.fillRect(tx + 3, ty + 3, 2, 2);
          ctx.fillRect(tx + TILE - 5, ty + 3, 2, 2);
          continue;
        }

        // Lava Channel (Molten Hazard)
        if (t === 31) {
          ctx.fillStyle = '#ff3300';
          ctx.fillRect(tx, ty, TILE, TILE);
          ctx.fillStyle = '#ffbe0b';
          ctx.beginPath();
          ctx.arc(tx + TILE * 0.35, ty + TILE * 0.4, 4, 0, TAU);
          ctx.arc(tx + TILE * 0.7, ty + TILE * 0.65, 5, 0, TAU);
          ctx.fill();
          continue;
        }

        // Heavy Boulder Hazard
        if (t === 32) {
          ctx.fillStyle = darkCol;
          ctx.fillRect(tx, ty, TILE, TILE);
          // 3D vector stone boulder
          ctx.fillStyle = '#495057';
          ctx.strokeStyle = '#212529';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(tx + TILE / 2, ty + TILE / 2, TILE * 0.44, 0, TAU);
          ctx.fill();
          ctx.stroke();
          // Specular boulder shine
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.arc(tx + TILE * 0.38, ty + TILE * 0.35, 3.5, 0, TAU);
          ctx.fill();
          continue;
        }

        // Gas Pocket
        if (t === 30) {
          ctx.fillStyle = darkCol;
          ctx.fillRect(tx, ty, TILE, TILE);
          ctx.fillStyle = '#38b000';
          ctx.beginPath();
          ctx.arc(tx + TILE / 2, ty + TILE / 2, TILE * 0.38, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#ccff33';
          ctx.beginPath();
          ctx.arc(tx + TILE * 0.4, ty + TILE * 0.4, 4, 0, TAU);
          ctx.fill();
          continue;
        }

        // Standard Soil Tile (Beveled vector block)
        ctx.fillStyle = soilCol;
        ctx.fillRect(tx, ty, TILE, TILE);

        // Highlight & Shadow edges
        ctx.fillStyle = litCol;
        ctx.fillRect(tx, ty, TILE, 3);
        ctx.fillRect(tx, ty, 3, TILE);
        ctx.fillStyle = darkCol;
        ctx.fillRect(tx, ty + TILE - 3, TILE, 3);
        ctx.fillRect(tx + TILE - 3, ty, 3, TILE);

        // Minerals (ID: 10..19)
        if (t >= 10 && t <= 19) {
          const m = Object.values(MINERALS).find(item => item.id === t);
          if (m) {
            this.drawMineralGem(ctx, tx + TILE / 2, ty + TILE / 2, m);
          }
        }

        // Cracking overlay if currently being drilled
        if (this.pod.drilling && this.pod.drilling.col === c && this.pod.drilling.row === r) {
          const pct = this.pod.drilling.progress / this.pod.drilling.max;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(tx + 6, ty + 6);
          ctx.lineTo(tx + TILE / 2, ty + TILE / 2);
          if (pct > 0.4) ctx.lineTo(tx + TILE - 6, ty + 10);
          if (pct > 0.7) {
            ctx.moveTo(tx + TILE / 2, ty + TILE / 2);
            ctx.lineTo(tx + 8, ty + TILE - 6);
          }
          ctx.stroke();
        }
      }
    }
  }

  drawMineralGem(ctx, x, y, m) {
    ctx.save();
    ctx.translate(x, y);

    // Glowing outer halo
    ctx.fillStyle = m.glow;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Faceted Gem Shape
    ctx.fillStyle = m.col;
    ctx.strokeStyle = '#070714';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(8, -3);
    ctx.lineTo(5, 8);
    ctx.lineTo(-5, 8);
    ctx.lineTo(-8, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Specular Star Sparkle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2, -4, 2.5, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  /* ------------------------------------------------ Surface Stations */
  drawSurfaceStations(ctx) {
    const sy = SURFACE_ROW * TILE;

    // 1. Mineral Processing (Cols 2..7)
    this.drawStationBuilding(ctx, 2 * TILE, sy, 5 * TILE, 70, {
      title: 'MINERALS',
      sub: 'SELL ORE',
      col: '#06d6a0',
      roofCol: '#0a3a2d',
      icon: '💎',
    });

    // 2. Fuel Depot (Cols 9..13)
    this.drawStationBuilding(ctx, 9 * TILE, sy, 4 * TILE, 65, {
      title: 'FUEL DEPOT',
      sub: 'REFUEL',
      col: '#ffd166',
      roofCol: '#3a2d0a',
      icon: '⛽',
    });

    // 3. Repair Bay & Outpost (Cols 15..19)
    this.drawStationBuilding(ctx, 15 * TILE, sy, 4 * TILE, 65, {
      title: 'REPAIR BAY',
      sub: 'FIX & GEAR',
      col: '#4cc9f0',
      roofCol: '#0d2b38',
      icon: '🔧',
    });

    // 4. Junk Yard Upgrades (Cols 21..26)
    this.drawStationBuilding(ctx, 21 * TILE, sy, 5 * TILE, 72, {
      title: 'AUTOBUY 2000',
      sub: 'UPGRADES',
      col: '#f72585',
      roofCol: '#420a24',
      icon: '🛠️',
    });

    // Ground landing strip line
    ctx.fillStyle = '#220b12';
    ctx.fillRect(0, sy, COLS * TILE, 4);

    // Docking Prompt Pill if landed at a station
    if (this.stationPrompt && !this.modal) {
      const sp = this.stationPrompt;
      const px = this.pod.x;
      const py = sy - 85;

      ctx.save();
      ctx.fillStyle = 'rgba(10, 14, 28, 0.92)';
      ctx.strokeStyle = sp.col;
      ctx.lineWidth = 2.5;
      this.rr(px - 90, py, 180, 36, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = sp.col;
      ctx.font = '900 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${sp.icon} ${sp.name} [E]`, px, py + 22);
      ctx.restore();
    }
  }

  drawStationBuilding(ctx, x, sy, w, h, spec) {
    const y = sy - h;

    // Building Main Structure
    ctx.fillStyle = spec.roofCol;
    ctx.strokeStyle = '#0c0714';
    ctx.lineWidth = 3;
    this.rr(x + 4, y + 18, w - 8, h - 18, 8);
    ctx.fill();
    ctx.stroke();

    // Glowing Neon Marquee Sign
    ctx.fillStyle = '#12081f';
    ctx.strokeStyle = spec.col;
    ctx.lineWidth = 2.5;
    this.rr(x + 10, y, w - 20, 24, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = spec.col;
    ctx.font = '900 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${spec.icon} ${spec.title}`, x + w / 2, y + 16);

    // Industrial Bay Doors
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    this.rr(x + w / 2 - 24, sy - 28, 48, 28, 4);
    ctx.fill();
  }

  /* ------------------------------------------------ Player Mining Pod & Captain Bean */
  drawPod(ctx) {
    const p = this.pod;
    ctx.save();
    ctx.translate(p.x, p.y);

    // Headlight Beam into the dark subterranean rock
    if (p.y > SURFACE_ROW * TILE + 20) {
      const hg = ctx.createRadialGradient(0, 0, 5, 0, 90, 140);
      hg.addColorStop(0, 'rgba(255, 230, 160, 0.45)');
      hg.addColorStop(0.6, 'rgba(255, 230, 160, 0.1)');
      hg.addColorStop(1, 'rgba(255, 230, 160, 0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(-10, 10);
      ctx.lineTo(-80, 140);
      ctx.lineTo(80, 140);
      ctx.lineTo(10, 10);
      ctx.closePath();
      ctx.fill();
    }

    // Underside Thruster Plasma Flames
    if (p.flying) {
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.moveTo(-p.w * 0.35, p.h * 0.45);
      ctx.lineTo(0, p.h * 0.95 + Math.random() * 12);
      ctx.lineTo(p.w * 0.35, p.h * 0.45);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ff0054';
      ctx.beginPath();
      ctx.moveTo(-p.w * 0.2, p.h * 0.45);
      ctx.lineTo(0, p.h * 0.75 + Math.random() * 8);
      ctx.lineTo(p.w * 0.2, p.h * 0.45);
      ctx.closePath();
      ctx.fill();
    }

    // Heavy Industrial Yellow Chassis
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#140c24';
    ctx.lineWidth = 3;
    this.rr(-p.w / 2, -p.h / 2 + 4, p.w, p.h - 4, 7);
    ctx.fill();
    ctx.stroke();

    // Tread Tracks (Rubber Belts)
    ctx.fillStyle = '#2b2d42';
    ctx.fillRect(-p.w / 2 - 2, p.h * 0.15, 5, p.h * 0.35);
    ctx.fillRect(p.w / 2 - 3, p.h * 0.15, 5, p.h * 0.35);

    // Glass Bubble Canopy Cockpit
    ctx.fillStyle = 'rgba(76, 201, 240, 0.65)';
    ctx.strokeStyle = '#140c24';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -3, p.w * 0.36, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Captain Bean Pilot inside Cockpit
    const beanEyes = p.drilling ? 'squish' : (p.fuel < 3 ? 'dizzy' : 'happy');
    drawBean(ctx, 0, -2, 17, {
      color: '#ff758f',
      bellyColor: '#ff9770',
      eyes: beanEyes,
    });

    // Glass Specular Curve
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-p.w * 0.14, -7, 5, 2, -0.4, 0, TAU);
    ctx.fill();

    // Animated Heavy Steel Drill Bit
    ctx.fillStyle = '#adb5bd';
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = 2;

    if (p.drilling && p.drilling.dir === 'down') {
      // Drilling downward: spinning auger bit extending into rock below
      const augerY = p.h / 2 + (Math.sin(this.time * 40) * 3);
      ctx.beginPath();
      ctx.moveTo(-8, p.h / 2);
      ctx.lineTo(8, p.h / 2);
      ctx.lineTo(0, augerY + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Horizontal drill pointing in direction of travel
      const drillDir = p.dir;
      const drillX = drillDir * (p.w / 2);
      const augerExtend = p.drilling ? Math.sin(this.time * 40) * 3 : 0;
      ctx.beginPath();
      ctx.moveTo(drillX, -3);
      ctx.lineTo(drillX + drillDir * (10 + augerExtend), 0);
      ctx.lineTo(drillX, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ------------------------------------------------ Jelly Reels Style Dashboard HUD */
  drawDashboardHUD(ctx, W, H) {
    const p = this.pod;
    const maxFuel = UPGRADES.fuelTank[this.upgrades.fuelTank].cap;
    const maxHull = UPGRADES.hull[this.upgrades.hull].hp;
    const cargoCap = UPGRADES.cargoBay[this.upgrades.cargoBay].cap;
    const depthFt = Math.max(0, Math.round((p.y - SURFACE_ROW * TILE) * 3.33));

    ctx.save();

    // 1. TOP-LEFT: Compact Cash & Depth Badge (lowered cleanly below reel timer text)
    const cardW = 126;
    const cardH = 44;
    const lx = 14;
    const ly = 116;

    ctx.fillStyle = 'rgba(10, 14, 28, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.5;
    this.rr(lx, ly, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    // Cash Display
    ctx.fillStyle = '#ffd166';
    ctx.font = '900 13px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`💵 $${this.cash.toLocaleString()}`, lx + 10, ly + 18);

    // Depth Display
    ctx.fillStyle = depthFt > 4000 ? '#ff0054' : '#4cc9f0';
    ctx.font = '800 11px Outfit, sans-serif';
    ctx.fillText(`⬇ ${depthFt.toLocaleString()} FT`, lx + 10, ly + 36);

    // 2. TOP-RIGHT: Streamlined Mini Fuel, Hull & Cargo Gauges
    const rx = W - 156 - 14;
    const ry = 116;
    const rW = 156;
    const rH = 46;

    ctx.fillStyle = 'rgba(10, 14, 28, 0.88)';
    ctx.strokeStyle = p.fuel < maxFuel * 0.22 ? '#ff0054' : 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.5;
    this.rr(rx, ry, rW, rH, 10);
    ctx.fill();
    ctx.stroke();

    // Row 1: Fuel
    const fuelPct = clamp(p.fuel / maxFuel, 0, 1);
    ctx.font = '900 9px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = fuelPct > 0.22 ? '#ffd166' : '#ff0054';
    ctx.fillText('⛽', rx + 7, ry + 12);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.rr(rx + 22, ry + 6, 76, 6, 3);
    ctx.fill();
    ctx.fillStyle = fuelPct > 0.4 ? '#06d6a0' : fuelPct > 0.2 ? '#ffd166' : '#ff0054';
    this.rr(rx + 22, ry + 6, 76 * fuelPct, 6, 3);
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${p.fuel.toFixed(1)}L`, rx + rW - 7, ry + 12);

    // Row 2: Hull
    const hullPct = clamp(p.hull / maxHull, 0, 1);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4cc9f0';
    ctx.fillText('🛡️', rx + 7, ry + 25);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.rr(rx + 22, ry + 19, 76, 6, 3);
    ctx.fill();
    ctx.fillStyle = hullPct > 0.35 ? '#4cc9f0' : '#ff0054';
    this.rr(rx + 22, ry + 19, 76 * hullPct, 6, 3);
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(p.hull)}HP`, rx + rW - 7, ry + 25);

    // Row 3: Cargo
    const cargoPct = clamp(this.cargoWeight / cargoCap, 0, 1);
    ctx.textAlign = 'left';
    ctx.fillStyle = cargoPct >= 1 ? '#ff0054' : '#06d6a0';
    ctx.fillText('📦', rx + 7, ry + 39);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.rr(rx + 22, ry + 33, 76, 6, 3);
    ctx.fill();
    ctx.fillStyle = cargoPct >= 1 ? '#ff0054' : '#06d6a0';
    this.rr(rx + 22, ry + 33, 76 * cargoPct, 6, 3);
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.fillStyle = cargoPct >= 1 ? '#ff0054' : '#ffffff';
    ctx.fillText(`${this.cargoWeight.toFixed(1)}/${cargoCap}c`, rx + rW - 7, ry + 39);

    // 3. LOW FUEL / FULL CARGO URGENT ALERTS
    if (p.fuel < maxFuel * 0.2 && p.fuel > 0) {
      ctx.fillStyle = '#ff0054';
      ctx.font = '900 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ LOW FUEL - RETURN TO SURFACE!', W / 2, 162);
    } else if (cargoPct >= 1) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '900 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📦 CARGO FULL - SELL AT MINERAL DEPOT!', W / 2, 162);
    }

    // 4. BOTTOM QUICK-ITEMS HOTBAR
    const barY = H - 128;
    const barW = 344;
    const barX = W / 2 - barW / 2;
    const slotW = barW / 4;

    const slots = [
      { key: '1', name: 'FUEL', ico: '⛽', count: this.inventory.reserveFuel, col: '#ffd166' },
      { key: '2', name: 'NANO', ico: '🩹', count: this.inventory.nanobots,    col: '#4cc9f0' },
      { key: '3', name: 'BOMB', ico: '💣', count: this.inventory.dynamite,    col: '#ff9f1c' },
      { key: '4', name: 'WARP', ico: '⚡', count: this.inventory.teleporter,  col: '#72efdd' },
    ];

    slots.forEach((s, idx) => {
      const sx = barX + idx * slotW + 2;
      const sw = slotW - 4;
      const hasItem = s.count > 0;

      ctx.fillStyle = hasItem ? 'rgba(18, 24, 46, 0.95)' : 'rgba(10, 14, 28, 0.85)';
      ctx.strokeStyle = hasItem ? s.col : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = hasItem ? 2 : 1;
      this.rr(sx, barY, sw, 36, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = '900 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = hasItem ? s.col : 'rgba(255, 255, 255, 0.4)';
      ctx.fillText(`[${s.key}] ${s.ico} ${s.name}`, sx + sw / 2, barY + 16);

      ctx.font = '800 11px Outfit, sans-serif';
      ctx.fillStyle = hasItem ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
      ctx.fillText(`x${s.count}`, sx + sw / 2, barY + 30);
    });

    ctx.restore();
  }

  /* ------------------------------------------------ Interactive Station Modals */
  drawStationModal(ctx, W, H) {
    const mw = 390;
    const mh = 480;
    const mx = W / 2 - mw / 2;
    const my = H / 2 - mh / 2 + 15;

    ctx.save();

    // Dimmed Backdrop
    ctx.fillStyle = 'rgba(5, 5, 15, 0.85)';
    ctx.fillRect(0, 0, W, H);

    // Modal Card
    ctx.fillStyle = '#0f1322';
    ctx.strokeStyle = '#3a86ff';
    ctx.lineWidth = 3;
    this.rr(mx, my, mw, mh, 16);
    ctx.fill();
    ctx.stroke();

    // Close [X] Button
    ctx.fillStyle = '#ff0054';
    this.rr(mx + mw - 45, my + 14, 32, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 14px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✕', mx + mw - 29, my + 35);

    // 1. MINERAL PROCESSING MODAL
    if (this.modal === 'mineral') {
      ctx.fillStyle = '#06d6a0';
      ctx.font = '900 18px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('💎 MINERAL PROCESSING DEPOT', mx + 20, my + 36);

      ctx.fillStyle = '#ffd166';
      ctx.font = '800 13px Outfit, sans-serif';
      ctx.fillText(`CASH BALANCE: $${this.cash.toLocaleString()}`, mx + 20, my + 62);

      // Receipt Box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this.rr(mx + 16, my + 80, mw - 32, 230, 10);
      ctx.fill();

      let totalVal = 0;
      if (this.cargo.length === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '700 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CARGO HOLD IS EMPTY', W / 2, my + 180);
        ctx.fillText('Drill minerals underground and return here to sell!', W / 2, my + 205);
      } else {
        // Summarize counts of minerals
        const counts = {};
        for (const item of this.cargo) {
          counts[item.name] = counts[item.name] || { count: 0, val: item.val, col: item.col };
          counts[item.name].count++;
          totalVal += item.val;
        }

        let lineY = my + 105;
        ctx.font = '800 12px Outfit, sans-serif';
        Object.entries(counts).forEach(([name, data]) => {
          ctx.fillStyle = data.col;
          ctx.textAlign = 'left';
          ctx.fillText(`• ${data.count}x ${name}`, mx + 30, lineY);
          ctx.textAlign = 'right';
          ctx.fillText(`+$${(data.count * data.val).toLocaleString()}`, mx + mw - 30, lineY);
          lineY += 24;
        });

        ctx.fillStyle = '#ffd166';
        ctx.font = '900 14px Outfit, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('TOTAL CARGO VALUE:', mx + 30, my + 290);
        ctx.textAlign = 'right';
        ctx.fillText(`+$${totalVal.toLocaleString()}`, mx + mw - 30, my + 290);
      }

      // Action Button: SELL ALL
      const canSell = this.cargo.length > 0;
      ctx.fillStyle = canSell ? '#06d6a0' : '#495057';
      this.rr(mx + 20, my + 330, mw - 40, 50, 12);
      ctx.fill();

      ctx.fillStyle = canSell ? '#0a291f' : '#8d99ae';
      ctx.font = '900 16px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(canSell ? `SELL ALL MINERALS (+$${totalVal.toLocaleString()})` : 'NO MINERALS TO SELL', W / 2, my + 361);
    }

    // 2. FUEL DEPOT MODAL
    else if (this.modal === 'fuel') {
      const maxFuel = UPGRADES.fuelTank[this.upgrades.fuelTank].cap;
      const needed = maxFuel - this.pod.fuel;
      const fullCost = Math.round(needed * 2);

      ctx.fillStyle = '#ffd166';
      ctx.font = '900 18px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⛽ MARTIAN FUEL DEPOT', mx + 20, my + 36);

      ctx.fillStyle = '#ffd166';
      ctx.font = '800 13px Outfit, sans-serif';
      ctx.fillText(`CASH: $${this.cash.toLocaleString()}`, mx + 20, my + 62);

      // Fuel Tank Status Card
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this.rr(mx + 16, my + 80, mw - 32, 100, 10);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 13px Outfit, sans-serif';
      ctx.fillText(`TANK CAPACITY: ${this.pod.fuel.toFixed(1)} / ${maxFuel} LITERS`, mx + 30, my + 115);
      ctx.fillText(`RATE: $2.00 / Liter`, mx + 30, my + 140);

      // Fill Tank Button
      ctx.fillStyle = needed > 0.1 ? '#06d6a0' : '#495057';
      this.rr(mx + 20, my + 205, mw - 40, 50, 12);
      ctx.fill();

      ctx.fillStyle = needed > 0.1 ? '#0a291f' : '#8d99ae';
      ctx.font = '900 15px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(needed > 0.1 ? `FILL TANK TO MAX ($${fullCost})` : 'TANK ALREADY FULL', W / 2, my + 236);

      // Top Up +5L Button
      ctx.fillStyle = needed > 0.1 ? '#3a86ff' : '#495057';
      this.rr(mx + 20, my + 270, mw - 40, 46, 12);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 14px Outfit, sans-serif';
      ctx.fillText('TOP UP +5 LITERS ($10)', W / 2, my + 299);
    }

    // 3. REPAIR BAY & GEAR MODAL
    else if (this.modal === 'repair') {
      const maxHull = UPGRADES.hull[this.upgrades.hull].hp;
      const neededHp = maxHull - this.pod.hull;
      const fullCost = Math.round(neededHp * 8);

      ctx.fillStyle = '#4cc9f0';
      ctx.font = '900 18px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🔧 REPAIR BAY & EMERGENCY GEAR', mx + 20, my + 36);

      ctx.fillStyle = '#ffd166';
      ctx.font = '800 13px Outfit, sans-serif';
      ctx.fillText(`CASH: $${this.cash.toLocaleString()}`, mx + 20, my + 60);

      // Hull Repair Button
      ctx.fillStyle = neededHp > 0.5 ? '#06d6a0' : '#495057';
      this.rr(mx + 16, my + 78, mw - 32, 48, 10);
      ctx.fill();

      ctx.fillStyle = neededHp > 0.5 ? '#0a291f' : '#8d99ae';
      ctx.font = '900 14px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(neededHp > 0.5 ? `REPAIR FULL HULL (-$${fullCost}) [${Math.round(this.pod.hull)}/${maxHull} HP]` : `HULL IN MINT CONDITION (${maxHull} HP)`, W / 2, my + 107);

      // Emergency Consumable Items List
      const itemKeys = ['reserveFuel', 'nanobots', 'dynamite', 'teleporter'];
      itemKeys.forEach((k, idx) => {
        const item = ITEMS[k];
        const rowY = my + 140 + idx * 48;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        this.rr(mx + 16, rowY, mw - 32, 42, 8);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px Outfit, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`[${item.key}] ${item.name}`, mx + 26, rowY + 18);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '700 10px Outfit, sans-serif';
        ctx.fillText(`${item.desc} (Have: ${this.inventory[k]})`, mx + 26, rowY + 33);

        // Buy Item Button
        const canAfford = this.cash >= item.price;
        ctx.fillStyle = canAfford ? '#4cc9f0' : '#495057';
        this.rr(mx + mw - 105, rowY + 6, 88, 30, 6);
        ctx.fill();

        ctx.fillStyle = canAfford ? '#07202c' : '#adb5bd';
        ctx.font = '900 11px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`BUY $${item.price.toLocaleString()}`, mx + mw - 61, rowY + 25);
      });
    }

    // 4. JUNK YARD (AUTOBUY 2000) UPGRADES MODAL
    else if (this.modal === 'junk') {
      ctx.fillStyle = '#f72585';
      ctx.font = '900 18px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🛠️ AUTOBUY 2000 UPGRADES', mx + 20, my + 36);

      ctx.fillStyle = '#ffd166';
      ctx.font = '800 13px Outfit, sans-serif';
      ctx.fillText(`CASH: $${this.cash.toLocaleString()}`, mx + 20, my + 60);

      // List 6 categories
      const cats = ['drill', 'engine', 'fuelTank', 'cargoBay', 'hull', 'radiator'];
      cats.forEach((cat, idx) => {
        const curTier = this.upgrades[cat];
        const list = UPGRADES[cat];
        const isMax = curTier >= list.length - 1;
        const next = isMax ? null : list[curTier + 1];
        const cur = list[curTier];
        const rowY = my + 76 + idx * 52;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        this.rr(mx + 16, rowY, mw - 32, 46, 8);
        ctx.fill();

        ctx.fillStyle = '#ffd166';
        ctx.font = '900 12px Outfit, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${cat.toUpperCase()}: ${cur.name}`, mx + 26, rowY + 18);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.font = '700 10px Outfit, sans-serif';
        ctx.fillText(cur.desc, mx + 26, rowY + 34);

        if (!isMax) {
          const canAfford = this.cash >= next.price;
          ctx.fillStyle = canAfford ? '#06d6a0' : '#495057';
          this.rr(mx + mw - 110, rowY + 8, 92, 30, 6);
          ctx.fill();

          ctx.fillStyle = canAfford ? '#0a291f' : '#adb5bd';
          ctx.font = '900 10px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`BUY $${next.price.toLocaleString()}`, mx + mw - 64, rowY + 27);
        } else {
          ctx.fillStyle = '#ffd166';
          ctx.font = '900 11px Outfit, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('MAX TIER', mx + mw - 26, rowY + 28);
        }
      });
    }

    ctx.restore();
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
}
