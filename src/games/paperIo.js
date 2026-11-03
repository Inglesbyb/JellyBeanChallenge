import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

// Screen Viewport dimensions
const W = 450;
const H = 800;

// Giant Open World Arena dimensions (Massive scale: 2250 x 3900)
const WORLD_W = 2250;
const WORLD_H = 3900;
const CELL = 15;
const GRID_W = 150; // 2250 / 15
const GRID_H = 260; // 3900 / 15
const TOTAL_CELLS = GRID_W * GRID_H; // 39,000
const PLAYABLE_CELLS = (GRID_W - 2) * (GRID_H - 2); // 38,184
const TAU = Math.PI * 2;
const WIN_PCT = 75; // % of the playable map the player must own to complete the stage

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const normalizeAngle = (a) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};

// Distance from point (px, py) to line segment (x1, y1) -> (x2, y2)
function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// Contenders Palette Definitions (20 Active Competitors in the Arena)
const PALETTES = {
  0: { name: 'Neutral', main: '#0b0f19', fill: '#0b0f19', trail: '#0b0f19', text: '#64748b' },
  1: { name: 'You', main: '#ff007f', fill: 'rgba(255, 0, 127, 0.82)', trail: '#ff4da6', glow: '#ff007f', text: '#ff99cc' },
  2: { name: 'Crimson Viper', main: '#ef4444', fill: 'rgba(239, 68, 68, 0.82)', trail: '#f87171', glow: '#ef4444', text: '#fca5a5' },
  3: { name: 'Neon Mint', main: '#10b981', fill: 'rgba(16, 185, 129, 0.82)', trail: '#34d399', glow: '#10b981', text: '#6ee7b7' },
  4: { name: 'Cyber Violet', main: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.82)', trail: '#a78bfa', glow: '#8b5cf6', text: '#c4b5fd' },
  5: { name: 'Solar Flare', main: '#f59e0b', fill: 'rgba(245, 158, 11, 0.82)', trail: '#fbbf24', glow: '#f59e0b', text: '#fde68a' },
  6: { name: 'Cobalt Wave', main: '#06b6d4', fill: 'rgba(6, 182, 212, 0.82)', trail: '#22d3ee', glow: '#06b6d4', text: '#67e8f9' },
  7: { name: 'Blaze Phoenix', main: '#f97316', fill: 'rgba(249, 115, 22, 0.82)', trail: '#fb923c', glow: '#f97316', text: '#fdba74' },
  8: { name: 'Arctic Frost', main: '#38bdf8', fill: 'rgba(56, 189, 248, 0.82)', trail: '#7dd3fc', glow: '#38bdf8', text: '#bae6fd' },
  9: { name: 'Electric Lime', main: '#a3e635', fill: 'rgba(163, 230, 53, 0.82)', trail: '#bef264', glow: '#a3e635', text: '#d9f99d' },
  10: { name: 'Shadow Phantom', main: '#c084fc', fill: 'rgba(192, 132, 252, 0.82)', trail: '#e9d5ff', glow: '#c084fc', text: '#f5d0fe' },
  11: { name: 'Ruby Warlord', main: '#e63946', fill: 'rgba(230, 57, 70, 0.82)', trail: '#ff6b77', glow: '#e63946', text: '#ffccd0' },
  12: { name: 'Tangerine Titan', main: '#fb8500', fill: 'rgba(251, 133, 0, 0.82)', trail: '#ffaa33', glow: '#fb8500', text: '#ffe0b2' },
  13: { name: 'Golden Dragon', main: '#ffd60a', fill: 'rgba(255, 214, 10, 0.82)', trail: '#ffee55', glow: '#ffd60a', text: '#fff9c4' },
  14: { name: 'Emerald Sentinel', main: '#0077b6', fill: 'rgba(0, 119, 182, 0.82)', trail: '#33aaff', glow: '#0077b6', text: '#b3e5fc' },
  15: { name: 'Aquamarine Hydra', main: '#00f5d4', fill: 'rgba(0, 245, 212, 0.82)', trail: '#66ffee', glow: '#00f5d4', text: '#e0fbf7' },
  16: { name: 'Violet Valkyrie', main: '#b5179e', fill: 'rgba(181, 23, 158, 0.82)', trail: '#e044c8', glow: '#b5179e', text: '#f3c4ee' },
  17: { name: 'Magma Crusher', main: '#d90429', fill: 'rgba(217, 4, 41, 0.82)', trail: '#ff4d6d', glow: '#d90429', text: '#ffccd5' },
  18: { name: 'Obsidian Reaper', main: '#7209b7', fill: 'rgba(114, 9, 183, 0.82)', trail: '#9d4edd', glow: '#7209b7', text: '#e8d4f7' },
  19: { name: 'Prism Sovereign', main: '#f72585', fill: 'rgba(247, 37, 133, 0.82)', trail: '#ff66b2', glow: '#f72585', text: '#fed4e7' },
  20: { name: 'Hyper Nitro', main: '#4cc9f0', fill: 'rgba(76, 201, 240, 0.82)', trail: '#85ddf6', glow: '#4cc9f0', text: '#e1f7fd' },
};

// 32-bit ABGR colors for instant pixel buffer stamping (Little-Endian: 0xAABBGGRR)
const COLOR_LUT = new Uint32Array([
  0xff190f0b, // 0: Neutral deep slate
  0xff7f00ff, // 1: Player vibrant rose/pink (#ff007f)
  0xff4444ef, // 2: Crimson Viper (#ef4444)
  0xff81b910, // 3: Neon Mint (#10b981)
  0xfff65c8b, // 4: Cyber Violet (#8b5cf6)
  0xff0b9ef5, // 5: Solar Flare (#f59e0b)
  0xffd4b606, // 6: Cobalt Wave (#06b6d4)
  0xff1673f9, // 7: Blaze Phoenix (#f97316)
  0xfff8bd38, // 8: Arctic Frost (#38bdf8)
  0xff35e6a3, // 9: Electric Lime (#a3e635)
  0xfffc84c0, // 10: Shadow Phantom (#c084fc)
  0xff4639e6, // 11: Ruby Warlord (#e63946)
  0xff0085fb, // 12: Tangerine Titan (#fb8500)
  0xff0ad6ff, // 13: Golden Dragon (#ffd60a)
  0xffb67700, // 14: Emerald Sentinel (#0077b6)
  0xffd4f500, // 15: Aquamarine Hydra (#00f5d4)
  0xff9e17b5, // 16: Violet Valkyrie (#b5179e)
  0xff2904d9, // 17: Magma Crusher (#d90429)
  0xffb70972, // 18: Obsidian Reaper (#7209b7)
  0xff8525f7, // 19: Prism Sovereign (#f72585)
  0xfff0c94c, // 20: Hyper Nitro (#4cc9f0)
]);

export class PaperIo extends Game {
  static meta = {
    id: 'paper-turf',
    title: 'Paper Turf',
    icon: '🗺️',
    hint: 'EXPLORE the giant map! STEER with Arrows/WASD or DRAG! Check RADAR & TOP SCORES, slice enemy trails & conquer the world!',
    baseLikes: 6420,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    // Prestige rank (1 = first playthrough). Set by Reel.js before init().
    this.pLevel = Math.max(1, this.prestige || 1);
    this.t = 0;
    this.highestPct = 0;

    // Camera center coordinates
    this.camX = WORLD_W * 0.5;
    this.camY = WORLD_H * 0.7;

    // Grid representation (0 = unowned, 1 = Player, 2..10 = Bots)
    this.grid = new Uint8Array(TOTAL_CELLS);

    // Reusable buffers for BFS flood-fill (Zero runtime allocations)
    this.boundaryMask = new Uint8Array(TOTAL_CELLS);
    this.visitedMask = new Uint8Array(TOTAL_CELLS);
    this.bfsQueue = new Int32Array(TOTAL_CELLS);

    // Fast offscreen rendering buffer for territory layer
    this.offCanvas = document.createElement('canvas');
    this.offCanvas.width = GRID_W;
    this.offCanvas.height = GRID_H;
    this.offCtx = this.offCanvas.getContext('2d');
    this.imgData = this.offCtx.createImageData(GRID_W, GRID_H);
    this.pixels = new Uint32Array(this.imgData.data.buffer);

    // Territory capture visual ripple waves
    this.conquerWaves = [];
    this.killFeed = [];

    // Entities: Player + 19 Smart Competitor Bots across the massive 2250 x 3900 arena
    this.player = this.createEntity(1, 'You', WORLD_W * 0.5, WORLD_H * 0.7, true, 'human', '#ff007f');
    this.bots = [
      // Sector 1: Northern Quarters (y: 350 - 550)
      this.createEntity(2,  'Crimson Viper',    380,  420,  false, 'hunter',        '#ef4444'),
      this.createEntity(3,  'Neon Mint',        920,  380,  false, 'expander',      '#10b981'),
      this.createEntity(4,  'Cyber Violet',     1450, 440,  false, 'nibbler',       '#8b5cf6'),
      this.createEntity(5,  'Solar Flare',      1950, 410,  false, 'flanker',       '#f59e0b'),

      // Sector 2: Upper Mid-Plateau (y: 1050 - 1250)
      this.createEntity(6,  'Cobalt Wave',      300,  1100, false, 'leader_hunter', '#06b6d4'),
      this.createEntity(7,  'Blaze Phoenix',    820,  1220, false, 'hunter',        '#f97316'),
      this.createEntity(8,  'Arctic Frost',     1380, 1150, false, 'border_patrol', '#38bdf8'),
      this.createEntity(9,  'Electric Lime',    1920, 1200, false, 'nibbler',       '#a3e635'),

      // Sector 3: Central Arena (y: 1750 - 1980)
      this.createEntity(10, 'Shadow Phantom',   340,  1950, false, 'stealer',       '#c084fc'),
      this.createEntity(11, 'Ruby Warlord',     820,  1850, false, 'leader_hunter', '#e63946'),
      this.createEntity(12, 'Tangerine Titan',  1420, 1920, false, 'expander',      '#fb8500'),
      this.createEntity(13, 'Golden Dragon',    1950, 1880, false, 'hunter',        '#ffd60a'),

      // Sector 4: Lower Basin (y: 2550 - 2750)
      this.createEntity(14, 'Emerald Sentinel', 350,  2620, false, 'border_patrol', '#0077b6'),
      this.createEntity(15, 'Aquamarine Hydra', 720,  2720, false, 'expander',      '#00f5d4'),
      // [Human Player starts at 1125, 2730]
      this.createEntity(16, 'Violet Valkyrie',  1550, 2680, false, 'flanker',       '#b5179e'),
      this.createEntity(17, 'Magma Crusher',    1950, 2600, false, 'hunter',        '#d90429'),

      // Sector 5: Southern Frontier (y: 3350 - 3550)
      this.createEntity(18, 'Obsidian Reaper',  450,  3420, false, 'stealer',       '#7209b7'),
      this.createEntity(19, 'Prism Sovereign',  1125, 3480, false, 'leader_hunter', '#f72585'),
      this.createEntity(20, 'Hyper Nitro',      1850, 3400, false, 'nibbler',       '#4cc9f0'),
    ];

    // Prestige: roughly one extra bot in three turns into a trail-hunting predator per level.
    if (this.pLevel > 1) {
      for (const b of this.bots) {
        if (b.personality !== 'hunter' && (b.id % 3) < Math.min(3, this.pLevel - 1)) {
          b.personality = 'hunter';
        }
      }
    }

    this.allEntities = [this.player, ...this.bots];

    // Seed initial bases for all contenders (Radius 5 grid cells = ~75px radius)
    for (const e of this.allEntities) {
      this.seedBase(e.id, Math.floor(e.x / CELL), Math.floor(e.y / CELL), 5);
      e.baseCenterX = e.x;
      e.baseCenterY = e.y;
    }

    this.updateGridTexture();

    // Cache rankings
    this.rankings = [];
    this.updateRankings();

    if (saved) {
      if (Number.isFinite(saved.highestPct)) this.highestPct = saved.highestPct;
      if (Number.isFinite(saved.kills)) this.player.kills = saved.kills;
      this.grace = 1.2;
    }
  }

  createEntity(id, name, x, y, isHuman, personality = 'balanced', color = '#ff007f') {
    let speed = 155;
    let turnSpeed = 8.0;
    let maxTrail = 36;
    if (personality === 'hunter') {
      speed = 162;
      turnSpeed = 8.6;
      maxTrail = 38;
    } else if (personality === 'expander') {
      speed = 150;
      turnSpeed = 7.5;
      maxTrail = 54;
    } else if (personality === 'nibbler') {
      speed = 166;
      turnSpeed = 9.2;
      maxTrail = 22;
    } else if (personality === 'flanker') {
      speed = 158;
      turnSpeed = 8.4;
      maxTrail = 35;
    } else if (personality === 'leader_hunter') {
      speed = 164;
      turnSpeed = 8.8;
      maxTrail = 32;
    } else if (personality === 'stealer') {
      speed = 160;
      turnSpeed = 8.2;
      maxTrail = 40;
    } else if (personality === 'border_patrol') {
      speed = 156;
      turnSpeed = 8.0;
      maxTrail = 28;
    }

    // Prestige: bots (never the human) get +5% speed per level.
    if (!isHuman) speed *= 1 + 0.05 * ((this.pLevel || 1) - 1);

    return {
      id,
      name,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      targetAngle: -Math.PI / 2,
      speed,
      turnSpeed,
      isHuman,
      personality,
      color,
      trail: [],
      inBase: true,
      alive: true,
      kills: 0,
      score: 100,
      stamina: 100,
      boost: false,
      mood: 'normal', // 'normal' | 'hunting' | 'panicking' | 'taunting'
      moodTimer: 0,
      lastTrailX: x,
      lastTrailY: y,
      baseCenterX: x,
      baseCenterY: y,
      exitX: x,
      exitY: y,
      maxTrail,
      aiTimer: Math.random() * 0.5,
      expandAngle: null,
      turnDir: Math.random() < 0.5 ? 1 : -1,
      respawnTimer: 0,
    };
  }

  seedBase(id, cx, cy, rad) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy <= rad * rad) {
          const gx = clamp(cx + dx, 1, GRID_W - 2);
          const gy = clamp(cy + dy, 1, GRID_H - 2);
          this.grid[gy * GRID_W + gx] = id;
        }
      }
    }
  }

  serialize() {
    return {
      score: Math.round(this.score),
      kills: this.player.kills,
      highestPct: this.highestPct,
    };
  }

  restoreLabel() {
    return `Territory ${this.highestPct.toFixed(1)}% · Score ${Math.round(this.score)}`;
  }

  /* ------------------------------------------------------------ Main Update Loop */
  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }

    this.t += dt;
    this.fx.update(dt);

    // Passive score tick from holding territory
    const myPct = this.rankings.find((r) => r.isHuman)?.pct || 0;
    this.score += myPct * dt * 28;
    this.player.score = Math.round(this.score);

    // Update conquer visual ripples
    for (const w of this.conquerWaves) {
      w.t += dt;
      w.r += dt * 420;
    }
    this.conquerWaves = this.conquerWaves.filter((w) => w.t < 0.65);

    // Update live battle kill feed
    if (this.killFeed.length > 0) {
      for (let i = this.killFeed.length - 1; i >= 0; i--) {
        this.killFeed[i].time -= dt;
        if (this.killFeed[i].time <= 0) this.killFeed.splice(i, 1);
      }
    }

    // Update bot moods
    for (const b of this.bots) {
      if (b.moodTimer > 0) {
        b.moodTimer -= dt;
        if (b.moodTimer <= 0) b.mood = 'normal';
      }
    }

    // 1. Process Human Player Input
    this.updatePlayerInput(dt);

    // 2. Process Smart Bot AI
    for (const bot of this.bots) {
      this.updateBotAI(bot, dt);
    }

    // 3. Move Entities & Sample Trails
    for (const e of this.allEntities) {
      if (!e.alive) {
        if (!e.isHuman) {
          e.respawnTimer -= dt;
          if (e.respawnTimer <= 0) this.respawnBot(e);
        }
        continue;
      }
      this.moveEntity(e, dt);
    }

    // 4. Smooth Camera Following Player
    const targetCamX = clamp(this.player.x, W / 2, WORLD_W - W / 2);
    const targetCamY = clamp(this.player.y, H / 2, WORLD_H - H / 2);
    this.camX += (targetCamX - this.camX) * Math.min(1, dt * 10);
    this.camY += (targetCamY - this.camY) * Math.min(1, dt * 10);

    // 5. Test Slices & Collisions
    this.testCollisions();

    // 6. Periodic Rank & Score Recalculation (4 times/sec)
    if (this.t % 0.25 < dt) {
      this.updateRankings();

      // Stage complete: 75%+ of the map, or every rival eliminated at the same time.
      if (!this.won && !this.dead) {
        const me = this.rankings.find((r) => r.isHuman);
        const rivalsAlive = this.bots.some((b) => b.alive);
        if (me && (me.pct >= WIN_PCT || !rivalsAlive)) {
          this.won = true;
          this.winReason = me.pct >= WIN_PCT ? `Arena Conquered: ${me.pct.toFixed(0)}% Turf! ⭕` : 'Every Rival Eliminated! ⭕';
          this.fx.text(this.player.x, this.player.y - 40, 'ARENA CONQUERED!', '#ffd166', 30, 1.8);
        }
      }
    }
  }

  /* ------------------------------------------------------------ Player Input */
  updatePlayerInput(dt) {
    const p = this.player;
    if (!p.alive) return;

    // Turbo Boost handling (Spacebar, Shift, or multi-touch hold)
    const wantsBoost = this.input.key(' ', 'shift') || (this.input.down && this.input.pointerCount >= 2);
    if (wantsBoost && p.stamina > 10) {
      p.boost = true;
      p.stamina = Math.max(0, p.stamina - dt * 48);
    } else {
      p.boost = false;
      p.stamina = Math.min(100, p.stamina + dt * 26);
    }

    // Directional Steering
    let dirX = 0;
    let dirY = 0;

    // Keyboard controls (Arrow keys / WASD)
    if (this.input.key('arrowleft', 'a')) dirX -= 1;
    if (this.input.key('arrowright', 'd')) dirX += 1;
    if (this.input.key('arrowup', 'w')) dirY -= 1;
    if (this.input.key('arrowdown', 's')) dirY += 1;

    // Touch / Mouse Pointer Aim (World relative from screen center)
    if (this.input.down) {
      const screenX = p.x - this.camX + W / 2;
      const screenY = p.y - this.camY + H / 2;
      const dx = this.input.x - screenX;
      const dy = this.input.y - screenY;
      if (Math.hypot(dx, dy) > 18) {
        p.targetAngle = Math.atan2(dy, dx);
      }
    } else if (dirX !== 0 || dirY !== 0) {
      p.targetAngle = Math.atan2(dirY, dirX);
    }

    // Smooth continuous turning toward target angle
    const diff = normalizeAngle(p.targetAngle - p.angle);
    p.angle += Math.sign(diff) * Math.min(Math.abs(diff), p.turnSpeed * dt);
  }

  /* ------------------------------------------------------------ Intelligent Competitor AI Engine */
  updateBotAI(bot, dt) {
    if (!bot.alive) return;

    bot.aiTimer -= dt;
    const inBase = this.isInBase(bot.x, bot.y, bot.id);
    const trailLen = bot.trail.length;

    // Stamina recharge
    bot.stamina = Math.min(100, bot.stamina + dt * 28);

    // Default mood
    if (bot.moodTimer <= 0) bot.mood = 'normal';

    // 1. NEAREST SAFE HOME TURF CALCULATION (Smart shortest-path escape vector)
    let homeTargetX = bot.exitX;
    let homeTargetY = bot.exitY;
    let bestHomeDist = Math.hypot(bot.exitX - bot.x, bot.exitY - bot.y);

    const baseCenterDist = Math.hypot(bot.baseCenterX - bot.x, bot.baseCenterY - bot.y);
    if (baseCenterDist < bestHomeDist) {
      bestHomeDist = baseCenterDist;
      homeTargetX = bot.baseCenterX;
      homeTargetY = bot.baseCenterY;
    }

    // 8-Compass radial probe to find the absolute closest owned territory tile
    for (let a = 0; a < TAU; a += Math.PI / 4) {
      for (let r = 24; r <= 220; r += 32) {
        const px = bot.x + Math.cos(a) * r;
        const py = bot.y + Math.sin(a) * r;
        if (this.isInBase(px, py, bot.id)) {
          const d = Math.hypot(px - bot.x, py - bot.y);
          if (d < bestHomeDist) {
            bestHomeDist = d;
            homeTargetX = px;
            homeTargetY = py;
          }
          break;
        }
      }
    }

    // 2. TACTICAL RISK & PROXIMITY SCAN
    let nearestEnemy = null;
    let nearestEnemyDist = Infinity;
    let intruder = null;
    let intruderDist = Infinity;

    for (const other of this.allEntities) {
      if (!other.alive || other.id === bot.id) continue;
      const d = Math.hypot(other.x - bot.x, other.y - bot.y);
      if (d < nearestEnemyDist) {
        nearestEnemyDist = d;
        nearestEnemy = other;
      }
      // Check if other is trespassing inside our painted territory
      if (other.trail.length > 1 && this.isInBase(other.x, other.y, bot.id)) {
        if (d < intruderDist) {
          intruderDist = d;
          intruder = other;
        }
      }
    }

    // Dynamic adaptive greed: adapt maximum loop size based on nearby danger
    const isUnderThreat = nearestEnemyDist < 320;
    const dynamicMaxTrail = isUnderThreat ? (bot.personality === 'nibbler' ? 14 : 22) : bot.maxTrail;

    // 3. THREAT DETECTION & EMERGENCY DODGE: Is anyone threatening the bot's trail?
    let threatClose = false;
    let threatSource = null;
    let minThreatDist = Infinity;

    if (!inBase && trailLen > 2) {
      for (const other of this.allEntities) {
        if (!other.alive || other.id === bot.id) continue;
        for (let i = 0; i < bot.trail.length; i += 2) {
          const pt = bot.trail[i];
          const d = Math.hypot(other.x - pt.x, other.y - pt.y);
          if (d < 140 && d < minThreatDist) {
            minThreatDist = d;
            threatClose = true;
            threatSource = other;
          }
        }
      }
    }

    // 4. PREDICTIVE HUNTING & TRAIL SLICING
    let huntAngle = null;
    let huntTargetDist = Infinity;
    const seekDist = bot.personality === 'hunter' || bot.personality === 'leader_hunter' ? 380 : 270;
    let bestInterceptScore = -Infinity;

    if (!threatClose) {
      for (const other of this.allEntities) {
        if (!other.alive || other.id === bot.id) continue;

        let targetBonus = 0;
        if (other.isHuman) targetBonus += 150; // Challenge player
        if (other.id === this.rankings[0]?.id) targetBonus += 200; // King of the Hill aggression
        if (other === intruder) targetBonus += 220; // Defend sovereign border!

        if (other.trail.length > 1) {
          // A. Segment Intercept Calculation
          for (let i = 0; i < other.trail.length - 1; i += 2) {
            const pt = other.trail[i];
            const d = Math.hypot(bot.x - pt.x, bot.y - pt.y);
            if (d < seekDist) {
              const score = targetBonus + (other.trail.length * 4.5) - d;
              if (score > bestInterceptScore) {
                bestInterceptScore = score;
                const nextPt = other.trail[i + 1] || pt;
                const leadX = (pt.x + nextPt.x) * 0.5;
                const leadY = (pt.y + nextPt.y) * 0.5;
                huntAngle = Math.atan2(leadY - bot.y, leadX - bot.x);
                huntTargetDist = d;
              }
            }
          }

          // B. Predictive Head-Leading (Interception ahead of victim trajectory)
          const leadSecs = clamp(Math.hypot(other.x - bot.x, other.y - bot.y) / (bot.speed * 1.45), 0.15, 0.5);
          const leadX = other.x + other.vx * leadSecs;
          const leadY = other.y + other.vy * leadSecs;
          const leadDist = Math.hypot(bot.x - leadX, bot.y - leadY);
          if (leadDist < seekDist * 0.8) {
            const score = targetBonus + 80 - leadDist;
            if (score > bestInterceptScore) {
              bestInterceptScore = score;
              huntAngle = Math.atan2(leadY - bot.y, leadX - bot.x);
              huntTargetDist = leadDist;
            }
          }
        }
      }
    }

    // 5. DECISION TREE WITH TACTICAL NITRO & MOOD
    const homeAngle = Math.atan2(homeTargetY - bot.y, homeTargetX - bot.x);

    if (threatClose) {
      // EMERGENCY EVASION: Sprint directly to the closest home turf!
      bot.targetAngle = homeAngle;
      bot.mood = 'panicking';
      if (bot.stamina > 12) {
        bot.boost = true;
        bot.stamina -= dt * 48;
      }
    } else if (huntAngle !== null && (trailLen < dynamicMaxTrail * 0.85 || inBase)) {
      // AGGRESSIVE HUNT: Charge and slice!
      bot.targetAngle = huntAngle;
      bot.mood = 'hunting';
      if (huntTargetDist < 190 && bot.stamina > 20) {
        bot.boost = true;
        bot.stamina -= dt * 42;
      } else {
        bot.boost = false;
      }
    } else if (trailLen >= dynamicMaxTrail) {
      // SAFELY CLOSE LOOP
      bot.targetAngle = homeAngle;
      bot.boost = false;
    } else {
      // TACTICAL EXPANSION & TERRITORY STEALING
      if (inBase) {
        if (bot.aiTimer <= 0) {
          bot.aiTimer = 0.42 + Math.random() * 0.38;
          let angleChoice = Math.random() * TAU;

          // Aggressive territory stealing: target the leader's turf or high-value neighbors
          const targetContender = (bot.personality === 'leader_hunter' || bot.personality === 'stealer')
            ? (this.rankings[0]?.id !== bot.id ? this.rankings[0] : this.player)
            : nearestEnemy;

          if (targetContender && nearestEnemyDist < 800 && Math.random() < 0.75) {
            angleChoice = Math.atan2(targetContender.baseCenterY - bot.y, targetContender.baseCenterX - bot.x) + (Math.random() - 0.5) * 0.5;
          }
          bot.expandAngle = angleChoice;
          bot.turnDir = Math.random() < 0.5 ? 1 : -1;
        }
        bot.targetAngle = bot.expandAngle || bot.angle;
      } else {
        // Curve smoothly to complete enclosure
        const curveRate = isUnderThreat ? 1.5 : (bot.personality === 'nibbler' ? 1.6 : 0.9);
        bot.expandAngle = (bot.expandAngle || bot.angle) + bot.turnDir * dt * (curveRate + Math.random() * 0.25);
        bot.targetAngle = bot.expandAngle;
      }
      bot.boost = false;
    }

    // 6. SELF-TRAIL COLLISION GUARD (Look ahead to avoid cutting own trail)
    if (trailLen > 8) {
      const testDist = 26;
      const testX = bot.x + Math.cos(bot.targetAngle) * testDist;
      const testY = bot.y + Math.sin(bot.targetAngle) * testDist;
      for (let i = 0; i < trailLen - 7; i += 2) {
        const pt = bot.trail[i];
        if (Math.hypot(testX - pt.x, testY - pt.y) < 15) {
          bot.targetAngle += Math.PI * 0.55 * bot.turnDir;
          break;
        }
      }
    }

    // 7. ARENA BOUNDARY REPULSION
    const margin = 85;
    if (bot.x < margin) bot.targetAngle = 0;
    else if (bot.x > WORLD_W - margin) bot.targetAngle = Math.PI;
    if (bot.y < margin) bot.targetAngle = Math.PI / 2;
    else if (bot.y > WORLD_H - margin) bot.targetAngle = -Math.PI / 2;

    // Smooth turning towards target angle
    const diff = normalizeAngle(bot.targetAngle - bot.angle);
    bot.angle += Math.sign(diff) * Math.min(Math.abs(diff), bot.turnSpeed * dt);
  }

  /* ------------------------------------------------------------ Entity Motion & Trail Sampling */
  moveEntity(e, dt) {
    const curSpeed = e.boost ? e.speed * 1.45 : e.speed;

    e.vx = Math.cos(e.angle) * curSpeed;
    e.vy = Math.sin(e.angle) * curSpeed;

    // World Boundary clamped position
    const minX = CELL * 1.5;
    const maxX = WORLD_W - CELL * 1.5;
    const minY = CELL * 1.5;
    const maxY = WORLD_H - CELL * 1.5;

    e.x = clamp(e.x + e.vx * dt, minX, maxX);
    e.y = clamp(e.y + e.vy * dt, minY, maxY);

    const nowInBase = this.isInBase(e.x, e.y, e.id);

    // Trail sampling while outside territory
    if (!nowInBase) {
      if (e.inBase) {
        // Just exited base! Record exit point
        e.exitX = e.x;
        e.exitY = e.y;
      }

      const distFromLast = Math.hypot(e.x - e.lastTrailX, e.y - e.lastTrailY);
      if (distFromLast >= 8 || e.trail.length === 0) {
        e.trail.push({ x: e.x, y: e.y });
        e.lastTrailX = e.x;
        e.lastTrailY = e.y;
      }
    } else {
      // Re-entered home territory!
      if (e.trail.length > 2) {
        // Enclose territory!
        const captured = this.captureTerritory(e);
        if (captured > 0) {
          const bonusPts = captured * 4;
          e.score += bonusPts;
          if (e.isHuman) {
            this.score += bonusPts;
            const pct = (captured / PLAYABLE_CELLS) * 100;
            this.sounds.gate(true);
            this.sounds.bubble();
            this.haptics.medium();
            this.fx.text(e.x, e.y - 30, `+${pct.toFixed(1)}% TURF! 🗺️`, '#ff007f', 26, 0.95);
            this.conquerWaves.push({ x: e.x, y: e.y, r: 20, t: 0, color: '#ff007f' });
          } else {
            this.conquerWaves.push({ x: e.x, y: e.y, r: 20, t: 0, color: e.color });
          }
        }
      }
      e.trail = [];
    }

    e.inBase = nowInBase;
  }

  isInBase(x, y, id) {
    const gx = clamp(Math.floor(x / CELL), 0, GRID_W - 1);
    const gy = clamp(Math.floor(y / CELL), 0, GRID_H - 1);
    return this.grid[gy * GRID_W + gx] === id;
  }

  /* ------------------------------------------------------------ Slicing & Collision Tests */
  testCollisions() {
    for (const attacker of this.allEntities) {
      if (!attacker.alive) continue;

      // 1. Self-collision: Did attacker run into their own trail?
      if (attacker.trail.length > 8) {
        for (let i = 0; i < attacker.trail.length - 7; i++) {
          const pt = attacker.trail[i];
          const next = attacker.trail[i + 1] || pt;
          if (distToSegment(attacker.x, attacker.y, pt.x, pt.y, next.x, next.y) < 9) {
            this.eliminateEntity(attacker, null, 'Crashed into your own trail!');
            break;
          }
        }
      }

      if (!attacker.alive) continue;

      // 2. Enemy trail slicing: Did attacker slice anyone else's trail?
      for (const victim of this.allEntities) {
        if (!victim.alive || victim.id === attacker.id) continue;
        if (victim.trail.length < 2) continue;

        let sliced = false;
        for (let i = 0; i < victim.trail.length - 1; i++) {
          const p1 = victim.trail[i];
          const p2 = victim.trail[i + 1];
          if (distToSegment(attacker.x, attacker.y, p1.x, p1.y, p2.x, p2.y) < 11) {
            sliced = true;
            break;
          }
        }

        if (sliced) {
          attacker.kills++;
          attacker.score += 1000;
          attacker.mood = 'taunting';
          attacker.moodTimer = 2.5;

          // Push live battle notification
          this.killFeed.unshift({
            text: `${attacker.isHuman ? 'YOU' : attacker.name} ⚔️ ${victim.isHuman ? 'YOU' : victim.name}`,
            color: attacker.color,
            time: 3.8,
          });
          if (this.killFeed.length > 5) this.killFeed.pop();

          if (attacker.isHuman) {
            this.score += 1000;
            this.sounds.slice();
            this.haptics.heavy();
            this.fx.burst(victim.x, victim.y, victim.color, 45, 300, 0.8, 5);
            this.fx.ring(victim.x, victim.y, victim.color, 160, 0.6, 5);
            this.fx.text(victim.x, victim.y - 40, `${victim.name.toUpperCase()} SLICED! +1000 ⚔️`, '#ffd166', 28, 1.3);
            this.fx.shake(14, 0.4);
          } else if (victim.isHuman) {
            this.eliminateEntity(victim, attacker, `Trail sliced by ${attacker.name}!`);
            return;
          } else {
            // Bot-on-bot elimination nearby: trigger slice audio & visual burst!
            const distToPlayer = Math.hypot(victim.x - this.player.x, victim.y - this.player.y);
            if (distToPlayer < 750) {
              this.sounds.bubble(0.85);
              this.fx.burst(victim.x, victim.y, victim.color, 24, 220, 0.6, 4);
              this.fx.text(victim.x, victim.y - 32, `⚔️ ${victim.name} SLICED!`, victim.color, 16, 1.0);
            }
          }
          this.eliminateEntity(victim, attacker, `Trail sliced by ${attacker.name}!`);
        }
      }
    }
  }

  eliminateEntity(victim, killer, reason) {
    if (!victim.alive) return;
    victim.alive = false;
    victim.trail = [];

    // Particle explosion
    this.fx.burst(victim.x, victim.y, victim.color, 40, 320, 0.85, 6);
    this.fx.shake(12, 0.35);

    // Dissolve victim's territory on the grid back to neutral
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.grid[i] === victim.id) {
        this.grid[i] = 0;
      }
    }
    this.updateGridTexture();

    if (victim.isHuman) {
      this.die(reason || 'Eliminated in the turf war!');
    } else {
      victim.respawnTimer = 2.6; // Rapid respawn to maintain high map competition
    }
  }

  respawnBot(bot) {
    let bestX = WORLD_W / 2;
    let bestY = WORLD_H / 2;
    let bestClearance = 0;

    for (let attempts = 0; attempts < 12; attempts++) {
      const rx = 120 + Math.random() * (WORLD_W - 240);
      const ry = 120 + Math.random() * (WORLD_H - 240);
      let minEnemyDist = Infinity;
      for (const e of this.allEntities) {
        if (e.alive && e.id !== bot.id) {
          minEnemyDist = Math.min(minEnemyDist, Math.hypot(e.x - rx, e.y - ry));
        }
      }
      if (minEnemyDist > bestClearance) {
        bestClearance = minEnemyDist;
        bestX = rx;
        bestY = ry;
      }
    }

    bot.x = bestX;
    bot.y = bestY;
    bot.baseCenterX = bestX;
    bot.baseCenterY = bestY;
    bot.angle = Math.random() * TAU;
    bot.targetAngle = bot.angle;
    bot.alive = true;
    bot.trail = [];
    bot.stamina = 100;
    this.seedBase(bot.id, Math.floor(bestX / CELL), Math.floor(bestY / CELL), 5);
    this.updateGridTexture();
  }

  /* ------------------------------------------------------------ Flood-Fill Loop Closure */
  captureTerritory(entity) {
    const id = entity.id;
    const trail = entity.trail;
    if (!trail || trail.length < 2) return 0;

    // 1. Boundary mask = current territory of entity + line segments of trail
    this.boundaryMask.fill(0);
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.grid[i] === id) this.boundaryMask[i] = 1;
    }

    // Rasterize trail segments into boundaryMask using Bresenham
    for (let i = 0; i < trail.length - 1; i++) {
      const p1 = trail[i];
      const p2 = trail[i + 1];
      const x0 = clamp(Math.floor(p1.x / CELL), 0, GRID_W - 1);
      const y0 = clamp(Math.floor(p1.y / CELL), 0, GRID_H - 1);
      const x1 = clamp(Math.floor(p2.x / CELL), 0, GRID_W - 1);
      const y1 = clamp(Math.floor(p2.y / CELL), 0, GRID_H - 1);
      this.rasterizeLine(x0, y0, x1, y1);
    }

    // 2. Flood-fill from outer perimeter to identify exterior space
    this.visitedMask.fill(0);
    let head = 0;
    let tail = 0;

    // Queue top and bottom border rows
    for (let x = 0; x < GRID_W; x++) {
      const topIdx = x;
      const botIdx = (GRID_H - 1) * GRID_W + x;
      if (!this.visitedMask[topIdx] && this.boundaryMask[topIdx] === 0) {
        this.visitedMask[topIdx] = 1;
        this.bfsQueue[tail++] = topIdx;
      }
      if (!this.visitedMask[botIdx] && this.boundaryMask[botIdx] === 0) {
        this.visitedMask[botIdx] = 1;
        this.bfsQueue[tail++] = botIdx;
      }
    }

    // Queue left and right border columns
    for (let y = 0; y < GRID_H; y++) {
      const leftIdx = y * GRID_W;
      const rightIdx = y * GRID_W + (GRID_W - 1);
      if (!this.visitedMask[leftIdx] && this.boundaryMask[leftIdx] === 0) {
        this.visitedMask[leftIdx] = 1;
        this.bfsQueue[tail++] = leftIdx;
      }
      if (!this.visitedMask[rightIdx] && this.boundaryMask[rightIdx] === 0) {
        this.visitedMask[rightIdx] = 1;
        this.bfsQueue[tail++] = rightIdx;
      }
    }

    // 3. 4-directional BFS
    while (head < tail) {
      const curr = this.bfsQueue[head++];
      const cx = curr % GRID_W;
      const cy = Math.floor(curr / GRID_W);

      // Up
      if (cy > 0) {
        const n = curr - GRID_W;
        if (!this.visitedMask[n] && this.boundaryMask[n] === 0) {
          this.visitedMask[n] = 1;
          this.bfsQueue[tail++] = n;
        }
      }
      // Down
      if (cy < GRID_H - 1) {
        const n = curr + GRID_W;
        if (!this.visitedMask[n] && this.boundaryMask[n] === 0) {
          this.visitedMask[n] = 1;
          this.bfsQueue[tail++] = n;
        }
      }
      // Left
      if (cx > 0) {
        const n = curr - 1;
        if (!this.visitedMask[n] && this.boundaryMask[n] === 0) {
          this.visitedMask[n] = 1;
          this.bfsQueue[tail++] = n;
        }
      }
      // Right
      if (cx < GRID_W - 1) {
        const n = curr + 1;
        if (!this.visitedMask[n] && this.boundaryMask[n] === 0) {
          this.visitedMask[n] = 1;
          this.bfsQueue[tail++] = n;
        }
      }
    }

    // 4. Any cell inside playable bounds that was NOT reached is enclosed!
    let captured = 0;
    let sumX = 0;
    let sumY = 0;
    let totalOwned = 0;

    for (let y = 1; y < GRID_H - 1; y++) {
      const row = y * GRID_W;
      for (let x = 1; x < GRID_W - 1; x++) {
        const idx = row + x;
        if (!this.visitedMask[idx]) {
          if (this.grid[idx] !== id) {
            captured++;
            this.grid[idx] = id;
          }
        }
        if (this.grid[idx] === id) {
          totalOwned++;
          sumX += x * CELL + CELL / 2;
          sumY += y * CELL + CELL / 2;
        }
      }
    }

    if (totalOwned > 0) {
      entity.baseCenterX = sumX / totalOwned;
      entity.baseCenterY = sumY / totalOwned;
    }

    this.updateGridTexture();
    return captured;
  }

  rasterizeLine(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (true) {
      if (cx >= 0 && cx < GRID_W && cy >= 0 && cy < GRID_H) {
        this.boundaryMask[cy * GRID_W + cx] = 1;
      }
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  updateGridTexture() {
    for (let i = 0; i < TOTAL_CELLS; i++) {
      this.pixels[i] = COLOR_LUT[this.grid[i]];
    }
    this.offCtx.putImageData(this.imgData, 0, 0);
  }

  updateRankings() {
    const counts = new Uint16Array(21);
    for (let i = 0; i < TOTAL_CELLS; i++) {
      counts[this.grid[i]]++;
    }

    this.rankings = this.allEntities.map((e) => {
      const pct = (counts[e.id] / PLAYABLE_CELLS) * 100;
      if (e.isHuman) {
        this.highestPct = Math.max(this.highestPct, pct);
      }
      return {
        id: e.id,
        name: e.name,
        color: PALETTES[e.id].main,
        pct,
        score: Math.round(e.score),
        kills: e.kills,
        alive: e.alive,
        isHuman: e.isHuman,
        x: e.x,
        y: e.y,
      };
    });

    // Ranked by Score (with territory % tiebreaker)
    this.rankings.sort((a, b) => b.score - a.score || b.pct - a.pct);
  }

  /* ------------------------------------------------------------ Rendering Pipeline */
  render() {
    const ctx = this.ctx;
    const off = this.fx.offset();

    // Frustum view bounds for culling
    const viewLeft = this.camX - W / 2;
    const viewTop = this.camY - H / 2;
    const viewRight = this.camX + W / 2;
    const viewBottom = this.camY + H / 2;

    // 1. Clear Screen Canvas
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(0, 0, W, H);

    // ============================================================
    // WORLD RENDERING (Camera Transformed Space)
    // ============================================================
    ctx.save();
    ctx.translate(-this.camX + W / 2 + off.x, -this.camY + H / 2 + off.y);

    // 2. Territory Texture (Hardware scaled directly from offscreen canvas)
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.offCanvas, 0, 0, WORLD_W, WORLD_H);

    // 3. Futuristic Grid Overlay on active camera view
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startGridX = Math.floor(viewLeft / 40) * 40;
    const endGridX = Math.ceil(viewRight / 40) * 40;
    const startGridY = Math.floor(viewTop / 40) * 40;
    const endGridY = Math.ceil(viewBottom / 40) * 40;

    for (let x = startGridX; x <= endGridX; x += 40) {
      if (x >= 0 && x <= WORLD_W) {
        ctx.moveTo(x, Math.max(0, viewTop));
        ctx.lineTo(x, Math.min(WORLD_H, viewBottom));
      }
    }
    for (let y = startGridY; y <= endGridY; y += 40) {
      if (y >= 0 && y <= WORLD_H) {
        ctx.moveTo(Math.max(0, viewLeft), y);
        ctx.lineTo(Math.min(WORLD_W, viewRight), y);
      }
    }
    ctx.stroke();

    // 4. Territory Conquer Ripple Waves
    for (const w of this.conquerWaves) {
      if (w.x + w.r < viewLeft || w.x - w.r > viewRight || w.y + w.r < viewTop || w.y - w.r > viewBottom) continue;
      const alpha = Math.max(0, 1 - w.t / 0.65);
      ctx.strokeStyle = w.color;
      ctx.globalAlpha = alpha * 0.75;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 5. Active Player & Bot Trails (Glowing Neon Ribbons)
    for (const e of this.allEntities) {
      if (!e.alive || e.trail.length < 2) continue;
      const pal = PALETTES[e.id];

      ctx.save();
      ctx.strokeStyle = pal.trail;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = pal.glow;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(e.trail[0].x, e.trail[0].y);
      for (let i = 1; i < e.trail.length; i++) {
        ctx.lineTo(e.trail[i].x, e.trail[i].y);
      }
      ctx.lineTo(e.x, e.y);
      ctx.stroke();

      // Inner white neon core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.restore();
    }

    // 6. Giant Arena Perimeter Barrier Rails (Neon boundary)
    ctx.save();
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 8;
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 18;
    ctx.strokeRect(CELL, CELL, WORLD_W - CELL * 2, WORLD_H - CELL * 2);
    ctx.restore();

    // 7. Render Entities (Mascot Heads, Eyes & Crown)
    const leaderId = this.rankings[0]?.id || 1;

    for (const e of this.allEntities) {
      if (!e.alive) continue;
      // Frustum culling
      if (e.x < viewLeft - 60 || e.x > viewRight + 60 || e.y < viewTop - 60 || e.y > viewBottom + 60) continue;
      this.renderEntity(ctx, e, leaderId === e.id);
    }

    // 8. Particle & Floating Text FX in world coordinates
    this.fx.render(ctx);

    ctx.restore();

    // ============================================================
    // SCREEN SPACE HUD & OVERLAYS
    // ============================================================
    this.renderMinimap(ctx);
    this.renderTopScores(ctx);
    this.renderPlayerHUD(ctx);
  }

  renderEntity(ctx, e, isLeader) {
    const pal = PALETTES[e.id];
    ctx.save();
    ctx.translate(e.x, e.y);

    // Glow under entity
    ctx.fillStyle = pal.trail;
    ctx.globalAlpha = 0.38;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Nitro Thruster Exhaust Flames
    if (e.boost) {
      const angleBack = e.angle + Math.PI;
      const flameDist = 18 + Math.random() * 8;
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.arc(Math.cos(angleBack) * flameDist, Math.sin(angleBack) * flameDist, 5 + Math.random() * 4, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#ff0054';
      ctx.beginPath();
      ctx.arc(Math.cos(angleBack) * (flameDist * 0.7), Math.sin(angleBack) * (flameDist * 0.7), 3 + Math.random() * 3, 0, TAU);
      ctx.fill();
    }

    // Body Mascot
    drawBean(ctx, 0, 0, 24, {
      color: pal.main,
      bellyColor: pal.text,
      dir: Math.cos(e.angle) >= 0 ? 1 : -1,
      walkT: this.t * 8,
      squash: e.boost ? 0.85 : 1.0,
      eyes: e.mood === 'hunting' ? 'angry' : e.mood === 'panicking' ? 'shocked' : 'happy',
      hat: isLeader ? 'crown' : null,
    });

    // Directional aim arrow indicator
    ctx.rotate(e.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(8, -5);
    ctx.lineTo(8, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Name tag & Mood reaction badge above head
    ctx.save();
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10, 13, 24, 0.78)';
    const textW = ctx.measureText(e.name).width;
    ctx.fillRect(e.x - textW / 2 - 5, e.y - 32, textW + 10, 15);

    ctx.fillStyle = pal.trail;
    ctx.fillText(e.name, e.x, e.y - 20);

    // Expressive combat mood badge above head
    if (e.mood && e.mood !== 'normal') {
      ctx.font = '14px system-ui';
      const badge = e.mood === 'hunting' ? '⚔️' : e.mood === 'panicking' ? '💦' : '😈';
      ctx.fillText(badge, e.x, e.y - 38);
    } else if (isLeader) {
      ctx.font = '13px system-ui';
      ctx.fillText('👑', e.x, e.y - 38);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ Radar Minimap */
  renderMinimap(ctx) {
    ctx.save();
    // Compact, sleek radar in top-left below top reel timer
    const cardW = 90;
    const cardH = 162;
    const x = 12;
    const y = 86;

    // Glassmorphism background
    ctx.fillStyle = 'rgba(13, 17, 28, 0.88)';
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    // Header
    ctx.font = '900 9.5px system-ui, sans-serif';
    ctx.fillStyle = '#ff99cc';
    ctx.textAlign = 'center';
    ctx.fillText('RADAR 🛰️', x + cardW / 2, y + 14);

    // Inner Map Viewport
    const mapX = x + 5;
    const mapY = y + 20;
    const mapW = cardW - 10;
    const mapH = cardH - 26;

    // Draw full world territory directly onto minimap
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.offCanvas, mapX, mapY, mapW, mapH);

    // Subtle map border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // Camera view rectangle showing where screen currently looks
    const viewNormX = (this.camX - W / 2) / WORLD_W;
    const viewNormY = (this.camY - H / 2) / WORLD_H;
    const viewNormW = W / WORLD_W;
    const viewNormH = H / WORLD_H;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(mapX + viewNormX * mapW, mapY + viewNormY * mapH, viewNormW * mapW, viewNormH * mapH);

    // Contender dots on minimap
    const leaderId = this.rankings[0]?.id || 1;

    for (const e of this.allEntities) {
      if (!e.alive) continue;
      const dotX = mapX + (e.x / WORLD_W) * mapW;
      const dotY = mapY + (e.y / WORLD_H) * mapH;
      const pal = PALETTES[e.id];

      if (e.isHuman) {
        // Pulsing radar ping for YOU
        const pingR = 3 + (this.t * 4) % 5;
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(dotX, dotY, pingR, 0, TAU);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2.5, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = pal.main;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2, 0, TAU);
        ctx.fill();
      }

      // Leader crown on map
      if (e.id === leaderId) {
        ctx.font = '8px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('👑', dotX, dotY - 3);
      }
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------ Top Scores Leaderboard & Live Kill Feed */
  renderTopScores(ctx) {
    ctx.save();
    // Glassmorphic card in top right below top timer bar
    const cardW = 152;
    const cardH = 208;
    const x = W - cardW - 12;
    const y = 86;

    ctx.fillStyle = 'rgba(13, 17, 28, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    // Header
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'left';
    ctx.fillText('TOP 5 / 20 MAP 🏆', x + 10, y + 16);

    // List top 5 contenders
    ctx.font = 'bold 9.5px system-ui, sans-serif';
    const top5 = this.rankings.slice(0, 5);

    top5.forEach((r, idx) => {
      const rowY = y + 34 + idx * 19;

      // Color indicator dot
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(x + 12, rowY - 3, 3.5, 0, TAU);
      ctx.fill();

      // Rank & Name
      ctx.fillStyle = r.isHuman ? '#ffffff' : '#cbd5e1';
      const crown = idx === 0 ? '👑 ' : '';
      const name = r.isHuman ? 'YOU' : r.name.length > 8 ? `${r.name.slice(0, 7)}…` : r.name;
      ctx.fillText(`${idx + 1}. ${crown}${name}`, x + 19, rowY);

      // Score / Turf %
      ctx.textAlign = 'right';
      ctx.fillStyle = r.isHuman ? '#ff007f' : '#94a3b8';
      ctx.fillText(`${r.score}`, x + cardW - 10, rowY);
      ctx.textAlign = 'left';
    });

    // Divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 132);
    ctx.lineTo(x + cardW - 8, y + 132);
    ctx.stroke();

    // Live Battle Kill Feed ticker
    if (this.killFeed && this.killFeed.length > 0) {
      ctx.font = 'bold 8.5px system-ui, sans-serif';
      const kfY = y + 148;
      this.killFeed.slice(0, 2).forEach((kf, idx) => {
        const itemY = kfY + idx * 15;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.roundRect(x + 6, itemY - 10, cardW - 12, 13, 3);
        ctx.fill();
        ctx.fillStyle = kf.color;
        const text = kf.text.length > 21 ? kf.text.slice(0, 20) + '…' : kf.text;
        ctx.fillText(text, x + 9, itemY);
      });
    } else {
      ctx.font = 'italic 8.5px system-ui, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('⚔️ Contenders fighting...', x + 10, y + 152);
    }

    // If player is not in top 5, show player's rank at bottom
    const myRank = this.rankings.findIndex((r) => r.isHuman) + 1;
    if (myRank > 5) {
      const rowY = y + cardH - 11;
      ctx.font = 'bold 9.5px system-ui, sans-serif';
      ctx.fillStyle = '#ff007f';
      ctx.fillText(`... #${myRank} YOU: ${Math.round(this.score)}`, x + 10, rowY);
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------ Player Status & Nitro Gauge */
  renderPlayerHUD(ctx) {
    ctx.save();
    const p = this.player;

    const myRank = this.rankings.findIndex((r) => r.isHuman) + 1;
    const myPct = this.rankings.find((r) => r.isHuman)?.pct || 0;

    // Compact status strip below the radar minimap
    const cardW = 104;
    const cardH = 68;
    const x = 12;
    const y = 256;

    ctx.fillStyle = 'rgba(13, 17, 28, 0.88)';
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 8);
    ctx.fill();
    ctx.stroke();

    // Turf % & Kills
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${myPct.toFixed(1)}% TURF`, x + 8, y + 17);

    ctx.font = 'bold 9.5px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`KILLS: ${p.kills} ⚔️ · #${myRank}`, x + 8, y + 33);

    // Nitro stamina bar
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('NITRO [SPACE]', x + 8, y + 47);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(x + 8, y + 53, cardW - 16, 6);
    ctx.fillStyle = p.boost ? '#ff0054' : '#00f59b';
    ctx.fillRect(x + 8, y + 53, (p.stamina / 100) * (cardW - 16), 6);

    ctx.restore();
  }
}
