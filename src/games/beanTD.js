import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const TAU = Math.PI * 2;

// Winding Track Waypoints through a lush meadow
const TRACK_WAYPOINTS = [
  { x: -30, y: 190 },
  { x: 120, y: 190 },
  { x: 120, y: 300 },
  { x: 330, y: 300 },
  { x: 330, y: 190 },
  { x: 225, y: 190 },
  { x: 225, y: 430 },
  { x: 80,  y: 430 },
  { x: 80,  y: 540 },
  { x: 370, y: 540 },
  { x: 370, y: 620 },
];

// Helper: distance from point to line segment
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Bloon Layer Definitions (Bloons TD hierarchy)
const BLOON_TYPES = {
  red:     { color: '#ef233c', r: 12, speed: 75,  hp: 1, reward: 1, next: null },
  blue:    { color: '#0096c7', r: 13, speed: 100, hp: 1, reward: 1, next: 'red' },
  green:   { color: '#06d6a0', r: 14, speed: 135, hp: 1, reward: 1, next: 'blue' },
  yellow:  { color: '#ffd166', r: 15, speed: 200, hp: 1, reward: 1, next: 'green' },
  pink:    { color: '#f72585', r: 15, speed: 260, hp: 1, reward: 1, next: 'yellow' },
  black:   { color: '#161a1d', r: 13, speed: 120, hp: 1, reward: 2, next: 'yellow', splits: 2, isBlack: true },
  lead:    { color: '#6c757d', r: 16, speed: 65,  hp: 1, reward: 3, next: 'black',  splits: 2, isLead: true },
  ceramic: { color: '#8d5b4c', r: 19, speed: 145, hp: 8, reward: 10, next: 'pink',   splits: 2, isCeramic: true },
  moab:    { color: '#3a0ca3', r: 30, speed: 60,  hp: 70, reward: 60, next: 'ceramic', splits: 3, isMoab: true },
};

// Tower Archetypes
const TOWER_TYPES = {
  dart: {
    id: 'dart',
    name: 'Dart Bean',
    icon: '🎯',
    cost: 120,
    range: 115,
    cooldown: 0.62,
    damage: 1,
    projSpeed: 420,
    desc: 'Throws sharp darts at the first bloon in range.',
    upgrades: [
      { name: 'Sharp Darts', cost: 110, range: 130, cooldown: 0.52, damage: 1, pierce: 2, desc: '+Range & Pierce 2' },
      { name: 'Quick Shots', cost: 220, range: 140, cooldown: 0.38, damage: 1, pierce: 2, desc: 'Faster reload' },
      { name: 'Triple Darts', cost: 520, range: 155, cooldown: 0.30, damage: 1, pierce: 2, triple: true, desc: 'Fires 3 darts' },
    ],
  },
  tack: {
    id: 'tack',
    name: 'Tack Sprinkler',
    icon: '⚙️',
    cost: 140,
    range: 75,
    cooldown: 0.85,
    damage: 1,
    projSpeed: 380,
    desc: 'Sprays 8 tacks in all directions. Best on corners!',
    upgrades: [
      { name: 'Faster Tacks', cost: 110, range: 85, cooldown: 0.62, damage: 1, count: 8, desc: 'Faster fire rate' },
      { name: 'Ring of Fire', cost: 260, range: 95, cooldown: 0.50, damage: 1, count: 10, fire: true, desc: 'Fire melts Lead bloons!' },
      { name: 'Super Maelstrom', cost: 540, range: 110, cooldown: 0.28, damage: 1, count: 16, fire: true, desc: '16 blazing tacks' },
    ],
  },
  bomb: {
    id: 'bomb',
    name: 'Bomb Cannon',
    icon: '💣',
    cost: 220,
    range: 105,
    cooldown: 1.25,
    damage: 3,
    splashR: 45,
    projSpeed: 320,
    desc: 'Launches heavy explosives. Destroys Lead Bloons!',
    upgrades: [
      { name: 'Bigger Bombs', cost: 160, range: 115, cooldown: 1.10, splashR: 65, damage: 4, desc: '+Splash radius & damage' },
      { name: 'Cluster Bombs', cost: 320, range: 125, cooldown: 0.95, splashR: 75, damage: 4, cluster: true, desc: 'Explodes into 6 shrapnel tacks' },
      { name: 'MOAB Assassin', cost: 620, range: 135, cooldown: 0.80, splashR: 85, damage: 8, cluster: true, desc: 'Massive damage vs Ceramics & MOABs' },
    ],
  },
  frost: {
    id: 'frost',
    name: 'Frost Slime',
    icon: '🧊',
    cost: 160,
    range: 90,
    cooldown: 1.4,
    damage: 1,
    freezeDur: 1.6,
    desc: 'Freezes passing bloons, slowing them down by 55%.',
    upgrades: [
      { name: 'Deep Freeze', cost: 130, range: 105, cooldown: 1.20, freezeDur: 2.5, damage: 1, desc: 'Longer freeze slow' },
      { name: 'Arctic Blizzard', cost: 280, range: 125, cooldown: 0.95, freezeDur: 3.2, damage: 1, desc: 'Large freeze aura' },
      { name: 'Absolute Zero', cost: 550, range: 145, cooldown: 0.75, freezeDur: 4.2, damage: 2, canFreezeLead: true, desc: 'Chills all bloons, even Lead!' },
    ],
  },
};

// 15 Escalating Waves with authentic tactical archetypes
const WAVES = [
  // Wave 1: Warmup
  {
    name: 'Red Warmup',
    spawns: [
      { type: 'red', count: 8, rate: 0.7 },
      { type: 'red', count: 10, rate: 0.55 },
    ],
  },
  // Wave 2: Blue Patrol
  {
    name: 'Blue Patrol',
    spawns: [
      { type: 'red', count: 12, rate: 0.5 },
      { type: 'blue', count: 8, rate: 0.7 },
      { type: 'blue', count: 8, rate: 0.5 },
    ],
  },
  // Wave 3: Green Squad
  {
    name: 'Green Vanguard',
    spawns: [
      { type: 'blue', count: 14, rate: 0.5 },
      { type: 'green', count: 12, rate: 0.45 },
    ],
  },
  // Wave 4: SPEED TEST - YELLOW RUSH!
  {
    name: 'Yellow Rush! ⚡',
    spawns: [
      { type: 'green', count: 8, rate: 0.4 },
      { type: 'yellow', count: 16, rate: 0.22 }, // Fast pack will slip past a lone dart tower
    ],
  },
  // Wave 5: THE LEAD TEST! Impervious to darts and tacks! Must have Bomb or Fire!
  {
    name: 'Lead Armor! 🛡️',
    spawns: [
      { type: 'blue', count: 8, rate: 0.4, stagger: 1.2 },
      { type: 'lead', count: 6, rate: 1.0 },   // Lead Bloons!
      { type: 'green', count: 10, rate: 0.35, stagger: 1.0 },
      { type: 'lead', count: 4, rate: 0.8 },
    ],
  },
  // Wave 6: PINK BLITZ! Speed 260!
  {
    name: 'Pink Blitz! 💨',
    spawns: [
      { type: 'green', count: 10, rate: 0.35 },
      { type: 'pink', count: 18, rate: 0.20 },  // 18 Pinks in 3.6s
      { type: 'yellow', count: 14, rate: 0.25 },
    ],
  },
  // Wave 7: ARMORED PHALANX! Combo of Lead (immune to darts) & Black (immune to bombs)
  {
    name: 'Armored Phalanx! ⚔️',
    spawns: [
      { type: 'lead', count: 8, rate: 0.75 },   // Immune to Darts & Tacks
      { type: 'black', count: 12, rate: 0.45 }, // Immune to Bombs
      { type: 'yellow', count: 16, rate: 0.25 },
      { type: 'lead', count: 6, rate: 0.75 },
    ],
  },
  // Wave 8: Ceramic Core
  {
    name: 'Ceramic Core! 🧱',
    spawns: [
      { type: 'yellow', count: 20, rate: 0.28 },
      { type: 'ceramic', count: 4, rate: 1.6 },
      { type: 'pink', count: 16, rate: 0.22 },
      { type: 'lead', count: 6, rate: 0.7 },
    ],
  },
  // Wave 9: Rainbow Storm
  {
    name: 'Rainbow Storm 🌈',
    spawns: [
      { type: 'green', count: 20, rate: 0.25 },
      { type: 'yellow', count: 20, rate: 0.22 },
      { type: 'pink', count: 20, rate: 0.20 },
      { type: 'black', count: 12, rate: 0.35 },
      { type: 'lead', count: 10, rate: 0.6 },
    ],
  },
  // Wave 10: Armored Fortress
  {
    name: 'Armored Fortress 🏰',
    spawns: [
      { type: 'lead', count: 14, rate: 0.5 },
      { type: 'black', count: 16, rate: 0.35 },
      { type: 'ceramic', count: 6, rate: 1.2 },
      { type: 'pink', count: 24, rate: 0.18 },
    ],
  },
  // Wave 11: BOSS WAVE: M.O.A.B AIRSHIP!
  {
    name: 'M.O.A.B SIGHTED! 🚨',
    spawns: [
      { type: 'moab', count: 1, rate: 4.0 },
      { type: 'ceramic', count: 6, rate: 1.0 },
      { type: 'pink', count: 20, rate: 0.2 },
    ],
  },
  // Wave 12: Sonic Swarm
  {
    name: 'Sonic Swarm ⚡',
    spawns: [
      { type: 'pink', count: 32, rate: 0.16 },
      { type: 'yellow', count: 28, rate: 0.2 },
      { type: 'black', count: 18, rate: 0.3 },
    ],
  },
  // Wave 13: Twin Titans
  {
    name: 'Twin Titans 🚢🚢',
    spawns: [
      { type: 'moab', count: 2, rate: 3.2 },
      { type: 'lead', count: 14, rate: 0.5 },
      { type: 'ceramic', count: 10, rate: 0.9 },
    ],
  },
  // Wave 14: Ceramic Avalanche
  {
    name: 'Ceramic Avalanche 🏔️',
    spawns: [
      { type: 'ceramic', count: 16, rate: 0.75 },
      { type: 'black', count: 20, rate: 0.3 },
      { type: 'pink', count: 30, rate: 0.18 },
    ],
  },
  // Wave 15: MOAB ARMADA
  {
    name: 'MOAB ARMADA 💥',
    spawns: [
      { type: 'moab', count: 3, rate: 3.5 },
      { type: 'ceramic', count: 14, rate: 0.7 },
      { type: 'lead', count: 16, rate: 0.45 },
      { type: 'black', count: 16, rate: 0.4 },
    ],
  },
];

export class BeanTD extends Game {
  static meta = {
    id: 'bean-td',
    title: 'Bean TD',
    icon: '🎈',
    hint: 'TAP to place & upgrade Bean Towers · POP every candy balloon before they reach the exit!',
    baseLikes: 6850,
    roundLen: 180,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    // Prestige rank (1 = first playthrough). Set by Reel.js before init().
    this.pLevel = Math.max(1, this.prestige || 1);

    this.lives = saved?.lives || 20;
    this.cash = saved?.cash || 250;
    this.wave = saved?.wave || 0;
    this.totalPops = saved?.totalPops || 0;

    this.speedMult = 1.0; // 1.0 or 2.0 (Fast forward)
    this.waveActive = false;
    this.waveCompleteBannerTimer = 0;

    this.towers = [];
    this.bloons = [];
    this.projectiles = [];
    this.spawnQueue = [];

    // Selection & Placement
    this.selectedTrayTower = null; // 'dart' | 'tack' | 'bomb' | 'frost'
    this.selectedPlacedTower = null; // Tower object on field
    this.placementValid = false;

    // Load saved towers if available
    if (Array.isArray(saved?.towers)) {
      for (const t of saved.towers) {
        if (t && TOWER_TYPES[t.type] && Number.isFinite(t.x) && Number.isFinite(t.y)) {
          this.towers.push(this.createTower(t.type, t.x, t.y, Number.isFinite(t.upgradeLvl) ? t.upgradeLvl : 0));
        }
      }
    }

    if (saved) this.grace = 1.5;

    // Auto start wave after short delay if first play
    this.startDelay = 0.5;
  }

  createTower(typeId, x, y, upgradeLvl = 0) {
    const proto = TOWER_TYPES[typeId];
    return {
      type: typeId,
      name: proto.name,
      icon: proto.icon,
      x,
      y,
      range: proto.range,
      cooldown: proto.cooldown,
      timer: 0,
      damage: proto.damage,
      projSpeed: proto.projSpeed,
      splashR: proto.splashR || 0,
      freezeDur: proto.freezeDur || 0,
      upgradeLvl,
      angle: 0,
      totalPops: 0,
      animScale: 1.0,
      attackFlash: 0,
    };
  }

  startNextWave() {
    if (this.waveActive) return;
    this.waveActive = true;
    this.wave++;
    this.sounds.whoosh();
    this.haptics.light();

    const waveDef = this.getWaveDef(this.wave);
    this.spawnQueue = [];

    let curDelay = 0;
    for (const group of waveDef.spawns) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({
          type: group.type,
          delay: curDelay + group.rate * i,
        });
      }
      const stagger = group.stagger !== undefined ? group.stagger : group.rate * group.count;
      curDelay += stagger;
    }

    // Sort queue by delay
    this.spawnQueue.sort((a, b) => a.delay - b.delay);
    this.waveSpawnTimer = 0;

    this.fx.text(this.W / 2, 270, `WAVE ${this.wave}!`, '#ffd166', 30, 1.3);
    if (waveDef.name) {
      this.fx.text(this.W / 2, 305, waveDef.name, '#ffffff', 18, 1.3);
    }
  }

  getWaveDef(w) {
    if (w <= WAVES.length) {
      return WAVES[w - 1];
    }
    // Infinite procedurally scaling waves
    const count = w;
    return {
      name: `Nightmare Swarm ${w}`,
      spawns: [
        { type: 'lead', count: 10 + count, rate: 0.45 },
        { type: 'black', count: 12 + count, rate: 0.35 },
        { type: 'ceramic', count: 8 + Math.floor(count * 1.2), rate: 0.6 },
        { type: 'moab', count: Math.min(8, 2 + Math.floor((count - 15) / 2)), rate: 2.5 },
      ],
    };
  }

  update(dtRaw) {
    const dt = Math.min(dtRaw, 0.05) * this.speedMult;
    this.fx.update(dt);

    if (this.waveCompleteBannerTimer > 0) {
      this.waveCompleteBannerTimer -= dt;
    }

    // Handle Input
    this.handleInput();

    // 1. Wave Spawning
    if (this.waveActive) {
      this.waveSpawnTimer += dt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].delay <= this.waveSpawnTimer) {
        const item = this.spawnQueue.shift();
        this.spawnBloon(item.type);
      }

      // Check for wave clear
      if (this.spawnQueue.length === 0 && this.bloons.length === 0) {
        this.onWaveClear();
      }
    }

    // 2. Update Bloons along Path
    for (let i = this.bloons.length - 1; i >= 0; i--) {
      const b = this.bloons[i];
      if (b.dead) {
        this.bloons.splice(i, 1);
        continue;
      }

      // Chill / Freeze timer
      if (b.freezeTimer > 0) {
        b.freezeTimer -= dt;
      }

      const curSpeed = b.freezeTimer > 0 ? b.speed * 0.45 : b.speed;
      const target = TRACK_WAYPOINTS[b.wpIndex + 1];

      if (!target) {
        // Bloon reached exit! Player loses lives
        this.onBloonEscaped(b);
        this.bloons.splice(i, 1);
        continue;
      }

      const dx = target.x - b.x;
      const dy = target.y - b.y;
      const dist = Math.hypot(dx, dy);
      const step = curSpeed * dt;

      if (dist <= step) {
        b.x = target.x;
        b.y = target.y;
        b.wpIndex++;
      } else {
        b.x += (dx / dist) * step;
        b.y += (dy / dist) * step;
      }

      b.wobble += dt * 8;
      b.distTravelled += step;
    }

    // 3. Update Towers & Target Acquisition
    for (const t of this.towers) {
      t.timer -= dt;
      if (t.attackFlash > 0) t.attackFlash -= dt * 4;
      if (t.animScale > 1.0) t.animScale = Math.max(1.0, t.animScale - dt * 3);

      if (t.timer <= 0) {
        this.fireTower(t);
      }
    }

    // 4. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0 || p.dead) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.homing && p.target && !p.target.dead) {
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          p.vx = (dx / d) * p.speed;
          p.vy = (dy / d) * p.speed;
          p.angle = Math.atan2(dy, dx);
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Projectile collision check
      this.checkProjectileHits(p);
    }
  }

  spawnBloon(typeKey, atX = null, atY = null, atWp = 0, atDist = 0) {
    const proto = BLOON_TYPES[typeKey];
    if (!proto) return;
    this.bloons.push({
      type: typeKey,
      color: proto.color,
      r: proto.r,
      speed: proto.speed * (1 + 0.06 * (this.pLevel - 1)),
      hp: proto.hp > 1 ? Math.round(proto.hp * (1 + 0.25 * (this.pLevel - 1))) : proto.hp,
      maxHp: proto.hp > 1 ? Math.round(proto.hp * (1 + 0.25 * (this.pLevel - 1))) : proto.hp,
      reward: proto.reward,
      next: proto.next,
      splits: proto.splits || 1,
      isLead: !!proto.isLead,
      isBlack: !!proto.isBlack,
      isCeramic: !!proto.isCeramic,
      isMoab: !!proto.isMoab,
      x: atX !== null ? atX : TRACK_WAYPOINTS[0].x,
      y: atY !== null ? atY : TRACK_WAYPOINTS[0].y,
      wpIndex: atWp,
      distTravelled: atDist,
      freezeTimer: 0,
      wobble: Math.random() * TAU,
      dead: false,
    });
  }

  onBloonEscaped(b) {
    const damage = b.isMoab ? 20 : b.isCeramic ? 8 : b.isLead ? 5 : b.isBlack ? 4 : b.type === 'pink' ? 4 : b.type === 'yellow' ? 3 : b.type === 'green' ? 2 : 1;
    this.lives = Math.max(0, this.lives - damage);
    this.sounds.hit();
    this.haptics.heavy();
    this.fx.shake(8, 0.3);
    this.fx.text(b.x, b.y, `-${damage} ❤️`, '#ef233c', 26, 1.0);

    if (this.lives <= 0) {
      this.die('Bloons breached the defenses! 🎈');
    }
  }

  onWaveClear() {
    this.waveActive = false;
    const bonus = 45 + this.wave * 10;
    this.cash += bonus;
    this.score += 350 + this.wave * 75;
    this.sounds.survive();
    this.haptics.success();

    this.fx.text(this.W / 2, 280, 'WAVE CLEARED! ⭐', '#ffd166', 30, 1.4);
    this.fx.text(this.W / 2, 320, `+$${bonus} BONUS`, '#06d6a0', 22, 1.4);
    for (let i = 0; i < 4; i++) {
      this.fx.burst(100 + i * 80, 260, '#ffd166', 12, 180, 0.8, 3.5, 120);
    }

    // Final scripted wave (MOAB ARMADA) cleared -> stage complete.
    if (this.wave >= WAVES.length && !this.won) {
      this.won = true;
      this.winReason = 'MOAB Armada Defeated! 🎈';
    }
  }

  fireTower(t) {
    const proto = TOWER_TYPES[t.type];

    if (t.type === 'dart') {
      // Find First Bloon in range
      const target = this.findBestTarget(t);
      if (!target) return;

      t.angle = Math.atan2(target.y - t.y, target.x - t.x);
      t.timer = t.cooldown;
      t.animScale = 1.25;
      t.attackFlash = 1.0;
      this.sounds.slice();

      const upg = proto.upgrades[t.upgradeLvl - 1];
      if (upg?.triple) {
        [-0.22, 0, 0.22].forEach((spread) => {
          const a = t.angle + spread;
          this.projectiles.push({
            type: 'dart',
            x: t.x,
            y: t.y,
            vx: Math.cos(a) * t.projSpeed,
            vy: Math.sin(a) * t.projSpeed,
            angle: a,
            damage: t.damage,
            pierce: upg.pierce || 2,
            hits: new Set(),
            speed: t.projSpeed,
            life: 0.6,
            sourceTower: t,
          });
        });
      } else {
        this.projectiles.push({
          type: 'dart',
          x: t.x,
          y: t.y,
          vx: Math.cos(t.angle) * t.projSpeed,
          vy: Math.sin(t.angle) * t.projSpeed,
          angle: t.angle,
          damage: t.damage,
          pierce: upg?.pierce || 1,
          hits: new Set(),
          speed: t.projSpeed,
          life: 0.6,
          sourceTower: t,
        });
      }
    } else if (t.type === 'tack') {
      // Fires omnidirectionally if at least one bloon is in range
      const target = this.findBestTarget(t);
      if (!target) return;

      t.timer = t.cooldown;
      t.animScale = 1.3;
      t.attackFlash = 1.0;
      this.sounds.slice();

      const upg = proto.upgrades[t.upgradeLvl - 1];
      const count = upg?.count || 8;
      for (let i = 0; i < count; i++) {
        const a = (TAU / count) * i;
        this.projectiles.push({
          type: upg?.fire ? 'fire' : 'tack',
          x: t.x,
          y: t.y,
          vx: Math.cos(a) * t.projSpeed,
          vy: Math.sin(a) * t.projSpeed,
          angle: a,
          damage: t.damage,
          pierce: 1,
          hits: new Set(),
          speed: t.projSpeed,
          life: 0.28,
          sourceTower: t,
        });
      }
    } else if (t.type === 'bomb') {
      const target = this.findBestTarget(t);
      if (!target) return;

      t.angle = Math.atan2(target.y - t.y, target.x - t.x);
      t.timer = t.cooldown;
      t.animScale = 1.35;
      t.attackFlash = 1.0;
      this.sounds.tone({ f: 220, to: 110, dur: 0.12, vol: 0.25 });

      const upg = proto.upgrades[t.upgradeLvl - 1];
      this.projectiles.push({
        type: 'bomb',
        x: t.x,
        y: t.y,
        vx: Math.cos(t.angle) * t.projSpeed,
        vy: Math.sin(t.angle) * t.projSpeed,
        angle: t.angle,
        target,
        homing: true,
        damage: t.damage,
        splashR: t.splashR,
        speed: t.projSpeed,
        life: 0.75,
        sourceTower: t,
        cluster: !!upg?.cluster,
      });
    } else if (t.type === 'frost') {
      // Radial frost wave chilling all non-lead bloons in range (unless Absolute Zero)
      const upg = proto.upgrades[t.upgradeLvl - 1];
      const canFreezeLead = !!upg?.canFreezeLead;
      let hitAny = false;
      for (const b of this.bloons) {
        if (b.dead) continue;
        if (b.isLead && !canFreezeLead) continue; // Base frost cannot freeze metal armor
        const d = Math.hypot(b.x - t.x, b.y - t.y);
        if (d <= t.range) {
          hitAny = true;
          b.freezeTimer = t.freezeDur;
          this.damageBloon(b, t.damage, 'frost', t);
        }
      }

      if (hitAny) {
        t.timer = t.cooldown;
        t.animScale = 1.3;
        this.sounds.shatter();
        this.fx.ring(t.x, t.y, '#4cc9f0', t.range, 0.35, 4);
      }
    }
  }

  findBestTarget(tower) {
    let best = null;
    let maxDist = -1;

    for (const b of this.bloons) {
      if (b.dead) continue;
      const d = Math.hypot(b.x - tower.x, b.y - tower.y);
      if (d <= tower.range) {
        if (b.distTravelled > maxDist) {
          maxDist = b.distTravelled;
          best = b;
        }
      }
    }
    return best;
  }

  checkProjectileHits(p) {
    if (p.type === 'bomb') {
      // Check collision with target or any bloon
      for (const b of this.bloons) {
        if (b.dead) continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d <= b.r + 6) {
          // Detonate Bomb!
          p.dead = true;
          this.detonateBomb(p.x, p.y, p.damage, p.splashR, p.sourceTower, p.cluster);
          return;
        }
      }
    } else {
      // Piercing darts / tacks / fire
      for (const b of this.bloons) {
        if (b.dead || p.hits.has(b)) continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d <= b.r + 4) {
          p.hits.add(b);
          const didDamage = this.damageBloon(b, p.damage, p.type, p.sourceTower);
          if ((p.type === 'dart' || p.type === 'tack') && b.isLead && !didDamage) {
            // Darts and tacks break immediately upon clinking against metal
            p.dead = true;
            return;
          }
          if (p.hits.size >= p.pierce) {
            p.dead = true;
            return;
          }
        }
      }
    }
  }

  detonateBomb(x, y, damage, splashR, tower, cluster = false) {
    this.sounds.explosion();
    this.haptics.medium();
    this.fx.burst(x, y, '#f77f00', 18, 160, 0.45, 4);
    this.fx.ring(x, y, '#ffbe0b', splashR, 0.3, 4);

    for (const b of this.bloons) {
      if (b.dead) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d <= splashR + b.r) {
        this.damageBloon(b, damage, 'bomb', tower);
      }
    }

    if (cluster) {
      // Cluster shrapnel bursts: 6 small explosive shrapnel pellets
      for (let i = 0; i < 6; i++) {
        const a = (TAU / 6) * i;
        this.projectiles.push({
          type: 'tack',
          x,
          y,
          vx: Math.cos(a) * 320,
          vy: Math.sin(a) * 320,
          angle: a,
          damage: 1,
          pierce: 1,
          hits: new Set(),
          speed: 320,
          life: 0.22,
          sourceTower: tower,
        });
      }
    }
  }

  damageBloon(b, damage, pType, tower) {
    if (b.dead) return false;

    // 1. Lead Bloon Immunity (Sharp darts and tacks bounce off with metallic clink)
    if (b.isLead) {
      if (pType === 'dart' || pType === 'tack') {
        this.sounds.tone({ f: 880, to: 440, type: 'square', dur: 0.05, vol: 0.25 });
        this.fx.burst(b.x, b.y, '#adb5bd', 6, 80, 0.25, 2.5);
        this.fx.text(b.x, b.y - 12, 'CLINK! 🛡️', '#e9ecef', 16, 0.6);
        return false;
      }
    }

    // 2. Black Bloon Explosion Immunity
    if (b.isBlack) {
      if (pType === 'bomb') {
        this.sounds.tone({ f: 300, to: 150, type: 'sine', dur: 0.06, vol: 0.2 });
        this.fx.burst(b.x, b.y, '#495057', 5, 60, 0.25, 2);
        this.fx.text(b.x, b.y - 12, 'IMMUNE! 💥', '#ced4da', 15, 0.6);
        return false;
      }
    }

    // 3. Ceramic Shell or MOAB Hull (Heavy multi-hit absorption)
    if (b.isCeramic || b.isMoab) {
      b.hp -= damage;
      this.sounds.blockPop(Math.max(1, Math.min(8, b.hp)));
      this.fx.burst(b.x, b.y, b.color, 6, 90, 0.25, 2);
      if (b.hp <= 0) {
        this.destroyBloon(b, tower);
      }
      return true;
    }

    // 4. Standard Layer Downgrade & Splitting (Authentic Bloons TD pop mechanics)
    let curType = b.type;
    let remainingDmg = damage;
    let cashEarned = 0;

    while (remainingDmg > 0 && curType) {
      const proto = BLOON_TYPES[curType];
      cashEarned += proto.reward || 1;
      this.totalPops++;
      if (tower) tower.totalPops++;
      remainingDmg--;

      // If this layer splits (e.g. Lead splits to 2 Blacks, Black splits to 2 Yellows)
      if (proto.splits && proto.splits > 1) {
        b.dead = true;
        for (let s = 0; s < proto.splits; s++) {
          const offsetDist = (s - (proto.splits - 1) / 2) * 10;
          this.spawnBloon(proto.next, b.x + offsetDist, b.y, b.wpIndex, b.distTravelled + offsetDist);
        }
        this.cash += cashEarned;
        this.score += cashEarned * 10;
        this.sounds.blockPop(5);
        this.fx.burst(b.x, b.y, proto.color, 8, 120, 0.3, 3);
        return true;
      }

      curType = proto.next;
    }

    this.cash += cashEarned;
    this.score += cashEarned * 10;
    this.sounds.blockPop(3);

    if (!curType) {
      // Fully popped!
      b.dead = true;
      this.fx.burst(b.x, b.y, b.color, 8, 100, 0.3, 2.5);
    } else {
      // Morph bloon in-place to the lower color layer
      const nextProto = BLOON_TYPES[curType];
      b.type = curType;
      b.color = nextProto.color;
      b.r = nextProto.r;
      b.speed = nextProto.speed;
      b.hp = nextProto.hp;
      b.maxHp = nextProto.hp;
      b.reward = nextProto.reward;
      b.next = nextProto.next;
      b.splits = nextProto.splits || 1;
      b.isLead = !!nextProto.isLead;
      b.isBlack = !!nextProto.isBlack;
      b.isCeramic = !!nextProto.isCeramic;
      b.isMoab = !!nextProto.isMoab;
      this.fx.burst(b.x, b.y, b.color, 5, 70, 0.2, 2);
    }

    return true;
  }

  destroyBloon(b, tower) {
    b.dead = true;
    this.totalPops++;
    if (tower) tower.totalPops++;
    this.cash += b.reward;
    this.score += b.reward * 10;
    this.sounds.blockPop(8);

    if (b.isMoab) {
      this.sounds.explosion();
      this.fx.burst(b.x, b.y, '#3a0ca3', 24, 200, 0.7, 5);
      this.fx.ring(b.x, b.y, '#f72585', 60, 0.5, 6);
      this.fx.text(b.x, b.y - 15, 'MOAB DOWN! 💥', '#ffd166', 22, 1.2);
    } else if (b.isCeramic) {
      this.fx.burst(b.x, b.y, '#8d5b4c', 14, 130, 0.4, 3.5);
      this.fx.text(b.x, b.y - 12, 'CRACKED! 🧱', '#e9c46a', 16, 0.8);
    } else {
      this.fx.burst(b.x, b.y, b.color, 8, 100, 0.3, 2.5);
    }

    // Split into child bloons
    if (b.next) {
      const splits = b.splits || 1;
      for (let s = 0; s < splits; s++) {
        const offsetDist = (s - (splits - 1) / 2) * 12;
        this.spawnBloon(b.next, b.x + offsetDist, b.y, b.wpIndex, b.distTravelled + offsetDist);
      }
    }
  }

  /* ---------------------------------------------------- User Input */
  handleInput() {
    if (!this.input.pressed) return;
    const mx = this.input.x;
    const my = this.input.y;

    // 1. Check Top Bar buttons (Start Wave / Fast Forward)
    if (mx >= 310 && mx <= 430 && my >= 92 && my <= 126) {
      if (!this.waveActive) {
        this.startNextWave();
      } else {
        // Toggle 1x / 2x speed
        this.speedMult = this.speedMult === 1.0 ? 2.0 : 1.0;
        this.sounds.tick();
        this.haptics.light();
      }
      return;
    }

    // 2. Check Bottom Tower Tray selection (y: 620 -> 705)
    if (my >= 620 && my <= 705) {
      const cardW = 98;
      const types = ['dart', 'tack', 'bomb', 'frost'];
      for (let i = 0; i < types.length; i++) {
        const cx = 14 + i * 105;
        if (mx >= cx && mx <= cx + cardW) {
          const tId = types[i];
          const proto = TOWER_TYPES[tId];
          if (this.cash >= proto.cost) {
            this.selectedTrayTower = this.selectedTrayTower === tId ? null : tId;
            this.selectedPlacedTower = null;
            this.sounds.bubble();
            this.haptics.light();
          } else {
            this.sounds.fail();
            this.fx.text(mx, my - 25, 'NEED CASH! 💰', '#ef233c', 16, 0.7);
          }
          return;
        }
      }
    }

    // 3. Check Upgrade / Sell modal buttons if a placed tower is currently selected
    if (this.selectedPlacedTower) {
      const t = this.selectedPlacedTower;
      const proto = TOWER_TYPES[t.type];
      const maxLvl = proto.upgrades.length;
      const layout = this.getUpgradeModalLayout(t);

      // Upgrade button bounds
      const ub = layout.upgBtn;
      if (t.upgradeLvl < maxLvl && mx >= ub.x && mx <= ub.x + ub.w && my >= ub.y && my <= ub.y + ub.h) {
        const nextUpg = proto.upgrades[t.upgradeLvl];
        const nextCost = nextUpg ? nextUpg.cost : 99999;
        if (this.cash >= nextCost) {
          this.cash -= nextCost;
          t.upgradeLvl++;
          const upg = proto.upgrades[t.upgradeLvl - 1];
          t.range = upg.range || t.range;
          t.cooldown = upg.cooldown || t.cooldown;
          t.damage = upg.damage || t.damage;
          t.splashR = upg.splashR || t.splashR;
          t.freezeDur = upg.freezeDur || t.freezeDur;
          this.sounds.upgrade();
          this.haptics.success();
          this.fx.burst(t.x, t.y, '#ffd166', 16, 150, 0.6, 3.5);
          this.fx.text(t.x, t.y - 30, 'UPGRADED! ⭐', '#ffd166', 20, 1.0);
        } else {
          this.sounds.fail();
          this.fx.text(t.x, ub.y - 20, 'NEED CASH!', '#ef233c', 16, 0.7);
        }
        return;
      }

      // Sell button bounds
      const sb = layout.sellBtn;
      if (mx >= sb.x && mx <= sb.x + sb.w && my >= sb.y && my <= sb.y + sb.h) {
        let totalInvested = proto.cost;
        for (let lvl = 0; lvl < t.upgradeLvl; lvl++) {
          totalInvested += proto.upgrades[lvl].cost;
        }
        const refund = Math.round(totalInvested * 0.7);
        this.cash += refund;
        this.towers = this.towers.filter((tow) => tow !== t);
        this.selectedPlacedTower = null;
        this.sounds.bubble();
        this.fx.text(t.x, t.y, `+$${refund}`, '#06d6a0', 20, 0.9);
        return;
      }

      // If clicked inside the modal outside buttons, don't deselect
      if (mx >= layout.modalX && mx <= layout.modalX + layout.modalW && my >= layout.modalY && my <= layout.modalY + layout.modalH) {
        return;
      }
    }

    // 4. Check Placed Towers on field (click to select)
    for (const tow of this.towers) {
      if (Math.hypot(mx - tow.x, my - tow.y) <= 24) {
        this.selectedPlacedTower = tow;
        this.selectedTrayTower = null;
        this.sounds.tick();
        this.haptics.light();
        return;
      }
    }

    // 5. Placing Selected Tower on field
    if (this.selectedTrayTower && my >= 145 && my <= 615) {
      if (this.checkValidPlacement(mx, my)) {
        const proto = TOWER_TYPES[this.selectedTrayTower];
        this.cash -= proto.cost;
        const newTower = this.createTower(this.selectedTrayTower, mx, my);
        this.towers.push(newTower);
        this.selectedPlacedTower = newTower;
        this.selectedTrayTower = null;
        this.sounds.drop();
        this.haptics.medium();
        this.fx.burst(mx, my, '#06d6a0', 12, 120, 0.45, 3);
      } else {
        this.sounds.fail();
        this.fx.text(mx, my - 25, 'CANNOT PLACE HERE!', '#ef233c', 16, 0.7);
      }
      return;
    }

    // Tap outside closes tower selection
    this.selectedPlacedTower = null;
  }

  checkValidPlacement(x, y) {
    if (x < 25 || x > this.W - 25 || y < 145 || y > 615) return false;

    // Check distance to all track segments (28px allows placing right next to track curb)
    for (let i = 0; i < TRACK_WAYPOINTS.length - 1; i++) {
      const p1 = TRACK_WAYPOINTS[i];
      const p2 = TRACK_WAYPOINTS[i + 1];
      if (distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) < 28) {
        return false;
      }
    }

    // Check distance to other towers
    for (const tow of this.towers) {
      if (Math.hypot(x - tow.x, y - tow.y) < 38) {
        return false;
      }
    }

    return true;
  }

  serialize() {
    return {
      lives: this.lives,
      cash: this.cash,
      wave: this.wave,
      totalPops: this.totalPops,
      towers: this.towers.map((t) => ({
        type: t.type,
        x: t.x,
        y: t.y,
        upgradeLvl: t.upgradeLvl,
      })),
    };
  }

  restoreLabel() {
    return `Wave ${this.wave} · ${this.towers.length} Towers · 💖 ${this.lives}`;
  }

  /* -------------------------------------------------------- Rendering */
  render() {
    const { ctx, W, H } = this;
    const shake = this.fx.offset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Lush Green Meadow Background
    this.renderMeadow(ctx, W, H);

    // 2. Winding Dirt & Cobblestone Path
    this.renderTrack(ctx);

    // 3. Range Circle for Selected Tower / Placement Follower
    this.renderRangeCircles(ctx);

    // 4. Placed Bean Towers
    this.renderTowers(ctx);

    // 5. Candy Balloons (Bloons)
    this.renderBloons(ctx);

    // 6. Projectiles (Darts, Tacks, Bombs, Slime)
    this.renderProjectiles(ctx);

    // 7. Particle Effects & Floating Text
    this.fx.render(ctx);

    // 8. Top Header HUD (Lives, Cash, Waves, Fast Forward)
    this.renderHeaderHUD(ctx, W);

    // 9. Bottom Tower Placement Tray
    this.renderTowerTray(ctx, W);

    // 10. Selected Tower Upgrade Modal
    if (this.selectedPlacedTower) {
      this.renderUpgradeModal(ctx, this.selectedPlacedTower);
    }

    ctx.restore();
  }

  renderMeadow(ctx, W, H) {
    // Vibrant Bloons-style candy meadow
    const mg = ctx.createLinearGradient(0, 0, 0, H);
    mg.addColorStop(0, '#70e000');
    mg.addColorStop(1, '#38b000');
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();

    // 1. Procedural Marshmallow Daisies
    const daisies = [
      { x: 45, y: 155 }, { x: 410, y: 175 }, { x: 175, y: 255 },
      { x: 420, y: 395 }, { x: 45, y: 535 }, { x: 285, y: 530 },
      { x: 195, y: 645 }, { x: 415, y: 655 }, { x: 50, y: 360 },
      { x: 380, y: 240 }, { x: 180, y: 370 }, { x: 290, y: 440 },
    ];

    for (const d of daisies) {
      // 5 white cartoon petals with black outline
      for (let p = 0; p < 5; p++) {
        const ang = (p / 5) * TAU;
        const px = d.x + Math.cos(ang) * 5.5;
        const py = d.y + Math.sin(ang) * 5.5;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 3.8, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      // Golden gumdrop center
      ctx.fillStyle = '#ffbe0b';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 3.2, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // 2. Juicy Jellybean Boulders along track bends
    const jellyRocks = [
      { x: 170, y: 150, r: 8, col: '#f72585' },
      { x: 385, y: 340, r: 9, col: '#4cc9f0' },
      { x: 35,  y: 470, r: 7, col: '#ffd166' },
      { x: 320, y: 485, r: 9, col: '#7209b7' },
      { x: 145, y: 585, r: 8, col: '#06d6a0' },
    ];

    for (const jr of jellyRocks) {
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(jr.x, jr.y + 3, jr.r * 1.1, jr.r * 0.6, 0, 0, TAU);
      ctx.fill();

      // Jelly body with 2.5px black cartoon outline
      ctx.fillStyle = jr.col;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(jr.x, jr.y, jr.r * 1.1, jr.r * 0.85, 0.2, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Specular highlight glint
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(jr.x - jr.r * 0.35, jr.y - jr.r * 0.3, jr.r * 0.35, jr.r * 0.18, -0.3, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  renderTrack(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 0. Thick Black Cartoon Track Outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 54;
    ctx.beginPath();
    ctx.moveTo(TRACK_WAYPOINTS[0].x, TRACK_WAYPOINTS[0].y);
    for (let i = 1; i < TRACK_WAYPOINTS.length; i++) {
      ctx.lineTo(TRACK_WAYPOINTS[i].x, TRACK_WAYPOINTS[i].y);
    }
    ctx.stroke();

    // 1. Dark Dirt Path Border
    ctx.strokeStyle = '#583101';
    ctx.lineWidth = 48;
    ctx.beginPath();
    ctx.moveTo(TRACK_WAYPOINTS[0].x, TRACK_WAYPOINTS[0].y);
    for (let i = 1; i < TRACK_WAYPOINTS.length; i++) {
      ctx.lineTo(TRACK_WAYPOINTS[i].x, TRACK_WAYPOINTS[i].y);
    }
    ctx.stroke();

    // 2. Sand / Cobblestone Walkway
    ctx.strokeStyle = '#ddb892';
    ctx.lineWidth = 38;
    ctx.beginPath();
    ctx.moveTo(TRACK_WAYPOINTS[0].x, TRACK_WAYPOINTS[0].y);
    for (let i = 1; i < TRACK_WAYPOINTS.length; i++) {
      ctx.lineTo(TRACK_WAYPOINTS[i].x, TRACK_WAYPOINTS[i].y);
    }
    ctx.stroke();

    // 3. Wooden Curbs / Stepping Stones
    ctx.strokeStyle = '#b08968';
    ctx.lineWidth = 30;
    ctx.setLineDash([14, 18]);
    ctx.beginPath();
    ctx.moveTo(TRACK_WAYPOINTS[0].x, TRACK_WAYPOINTS[0].y);
    for (let i = 1; i < TRACK_WAYPOINTS.length; i++) {
      ctx.lineTo(TRACK_WAYPOINTS[i].x, TRACK_WAYPOINTS[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Path Entrance / Exit Decals with cartoon outline
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ENTRY ➔', 40, 186);
    ctx.fillText('EXIT ⚠️', 360, 676);

    ctx.fillStyle = '#ffd166';
    ctx.fillText('ENTRY ➔', 40, 185);
    ctx.fillStyle = '#ef233c';
    ctx.fillText('EXIT ⚠️', 360, 675);

    ctx.restore();
  }

  renderRangeCircles(ctx) {
    // A. Range circle of selected placed tower
    if (this.selectedPlacedTower) {
      const t = this.selectedPlacedTower;
      ctx.save();
      ctx.fillStyle = 'rgba(67, 97, 238, 0.15)';
      ctx.strokeStyle = 'rgba(67, 97, 238, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.range, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // B. Placement Follower Cursor
    if (this.selectedTrayTower) {
      const proto = TOWER_TYPES[this.selectedTrayTower];
      const mx = this.input.x;
      const my = this.input.y;
      const valid = this.checkValidPlacement(mx, my);

      ctx.save();
      ctx.fillStyle = valid ? 'rgba(6, 214, 160, 0.2)' : 'rgba(239, 71, 111, 0.25)';
      ctx.strokeStyle = valid ? '#06d6a0' : '#ef233c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(mx, my, proto.range, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Ghost preview icon
      ctx.globalAlpha = 0.8;
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(proto.icon, mx, my);
      ctx.restore();
    }
  }

  renderTowers(ctx) {
    for (const t of this.towers) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.animScale, t.animScale);

      // Stone Pedestal
      ctx.fillStyle = '#495057';
      ctx.beginPath();
      ctx.ellipse(0, 14, 20, 10, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Jelly Bean Monkey Mascot
      const beanColor =
        t.type === 'dart' ? '#ff9f1c' :
        t.type === 'tack' ? '#e76f51' :
        t.type === 'bomb' ? '#457b9d' : '#48cae4';

      drawBean(ctx, 0, 0, 24, {
        color: beanColor,
        eyes: 'happy',
        dir: t.angle > Math.PI / 2 || t.angle < -Math.PI / 2 ? -1 : 1,
      });

      // Turret Weapon Props with thick black cartoon outlines
      ctx.rotate(t.angle);
      if (t.type === 'dart') {
        // Holding Sharp Dart
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(14, -3);
        ctx.lineTo(24, 0);
        ctx.lineTo(14, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (t.type === 'tack') {
        // Brass Sprinkler Rim
        ctx.fillStyle = '#f4a261';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, TAU);
        ctx.stroke();
      } else if (t.type === 'bomb') {
        // Cannon Barrel
        ctx.fillStyle = '#212529';
        ctx.fillRect(8, -6, 16, 12);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(8, -6, 16, 12);
      } else if (t.type === 'frost') {
        // Frost Orb
        ctx.fillStyle = 'rgba(72, 202, 228, 0.85)';
        ctx.beginPath();
        ctx.arc(16, 0, 7, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Upgrade Stars (★)
      ctx.restore();
      if (t.upgradeLvl > 0) {
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★'.repeat(t.upgradeLvl), t.x, t.y - 24);
      }
    }
  }

  renderBloons(ctx) {
    for (const b of this.bloons) {
      if (b.dead) continue;

      ctx.save();
      ctx.translate(b.x, b.y);

      // Wobble animation
      const wobble = Math.sin(b.wobble) * 2;
      ctx.translate(0, wobble);

      // Bloon Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(2, b.r + 6, b.r * 0.7, 4, 0, 0, TAU);
      ctx.fill();

      // Balloon Body (Teardrop / oval with string knot)
      if (b.isLead) {
        // Metallic armored look
        const lg = ctx.createLinearGradient(-b.r, -b.r, b.r, b.r);
        lg.addColorStop(0, '#f8f9fa');
        lg.addColorStop(0.3, '#adb5bd');
        lg.addColorStop(0.7, '#6c757d');
        lg.addColorStop(1, '#343a40');
        ctx.fillStyle = lg;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.8;
        ctx.beginPath();
        ctx.ellipse(0, -2, b.r * 0.9, b.r * 1.15, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();

        // Armor plate rivets
        ctx.fillStyle = '#000000';
        const rivetAngles = [-0.6, -0.2, 0.2, 0.6];
        for (const ra of rivetAngles) {
          const rx = Math.sin(ra) * (b.r * 0.7);
          const ry = Math.cos(ra) * (b.r * 0.7) - 2;
          ctx.beginPath();
          ctx.arc(rx, ry, 1.8, 0, TAU);
          ctx.fill();
        }

        // Shield badge icon
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', 0, -2);
      } else if (b.isBlack) {
        // Charcoal black balloon with obsidian shine
        const bg = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.35, 2, 0, 0, b.r);
        bg.addColorStop(0, '#6c757d');
        bg.addColorStop(0.4, '#212529');
        bg.addColorStop(1, '#000000');
        ctx.fillStyle = bg;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.8;
        ctx.beginPath();
        ctx.ellipse(0, -2, b.r * 0.9, b.r * 1.15, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();

        // Specular crescent
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(-b.r * 0.32, -b.r * 0.45, b.r * 0.3, b.r * 0.15, -0.4, 0, TAU);
        ctx.fill();

        // Bomb immunity symbol
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣⃠', 0, -2);
      } else {
        // Normal colorful balloon with bold black cartoon outline
        const bg = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.35, 1, 0, 0, b.r);
        bg.addColorStop(0, '#ffffff');
        bg.addColorStop(0.35, b.color);
        bg.addColorStop(1, b.color);

        ctx.fillStyle = bg;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = b.isMoab ? 4.8 : 3.8;

        ctx.beginPath();
        ctx.ellipse(0, -2, b.r * 0.9, b.r * 1.15, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();

        // Specular highlight crescent
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        ctx.ellipse(-b.r * 0.32, -b.r * 0.45, b.r * 0.3, b.r * 0.15, -0.4, 0, TAU);
        ctx.fill();

        // Ceramic crack details if damaged
        if (b.isCeramic && b.hp < b.maxHp) {
          ctx.strokeStyle = '#3d2010';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(-5, -6);
          ctx.lineTo(-1, 0);
          ctx.lineTo(4, -3);
          ctx.stroke();
        }
      }

      // String Knot at bottom
      ctx.fillStyle = b.isLead ? '#495057' : b.color;
      ctx.beginPath();
      ctx.moveTo(-3, b.r * 1.05);
      ctx.lineTo(3, b.r * 1.05);
      ctx.lineTo(0, b.r * 1.25);
      ctx.closePath();
      ctx.fill();

      // Frozen Ice Overlay
      if (b.freezeTimer > 0) {
        ctx.fillStyle = 'rgba(162, 210, 255, 0.65)';
        ctx.beginPath();
        ctx.arc(0, 0, b.r * 1.05, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('❄️', 0, 4);
      }

      // MOAB blimp markings
      if (b.isMoab) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('M.O.A.B', 0, 2);
      }

      ctx.restore();
    }
  }

  renderProjectiles(ctx) {
    for (const p of this.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle || 0);

      if (p.type === 'dart') {
        // Sharp Silver Dart with Red Feathers
        ctx.fillStyle = '#ced4da';
        ctx.strokeStyle = '#212529';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-4, -3);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e63946';
        ctx.fillRect(-8, -2, 4, 4);
      } else if (p.type === 'tack') {
        // Shiny Silver Tack
        ctx.fillStyle = '#e9ecef';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, TAU);
        ctx.fill();
      } else if (p.type === 'fire') {
        // Flame projectile
        ctx.fillStyle = '#ff7b00';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, TAU);
        ctx.fill();
      } else if (p.type === 'bomb') {
        // Heavy Black Cannonball with Sparking Fuse
        ctx.fillStyle = '#212529';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffbe0b';
        ctx.beginPath();
        ctx.arc(4, -4, 2.5, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  renderHeaderHUD(ctx, W) {
    // 1. Top HUD Bar (Sitting below Reel top header at y = 92)
    ctx.save();

    // Background pill
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.roundRect(16, 92, W - 32, 38, 19);
    ctx.fill();

    // Hearts / Lives
    ctx.fillStyle = '#ef233c';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`❤️ ${this.lives}`, 32, 111);

    // Cash / Gold
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`💰 $${this.cash}`, 115, 111);

    // Wave Counter
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`WAVE ${this.wave}/15`, 205, 111);

    // Wave Start / Fast Forward Button
    const btnX = 310;
    const btnW = 120;
    const isFast = this.speedMult === 2.0;

    // 3D Cartoon Drop Shadow
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(btnX, 98.5, btnW, 30, 15);
    ctx.fill();

    const bgGrad = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
    if (!this.waveActive) {
      bgGrad.addColorStop(0, '#06d6a0');
      bgGrad.addColorStop(1, '#118ab2');
    } else {
      bgGrad.addColorStop(0, isFast ? '#f72585' : '#4361ee');
      bgGrad.addColorStop(1, isFast ? '#7209b7' : '#3a0ca3');
    }

    ctx.fillStyle = bgGrad;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(btnX, 96, btnW, 30, 15);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = !this.waveActive ? '▶ START WAVE' : isFast ? '⏩ FAST 2X' : '▶ NORMAL 1X';
    ctx.fillText(label, btnX + btnW / 2, 111);

    ctx.restore();
  }

  renderTowerTray(ctx, W) {
    // Bottom Tower Dock Drawer (y: 622 -> 704, comfortably above Reel bottom info bar)
    ctx.save();

    // 3D Cartoon Drop Shadow
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(8, 625.5, W - 16, 82, 16);
    ctx.fill();

    // Drawer Background with bold 3.5px black border
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(8, 622, W - 16, 82, 16);
    ctx.fill();
    ctx.stroke();

    const types = ['dart', 'tack', 'bomb', 'frost'];
    const cardW = 98;
    const cardH = 70;

    for (let i = 0; i < types.length; i++) {
      const tId = types[i];
      const proto = TOWER_TYPES[tId];
      const cx = 14 + i * 105;
      const cy = 628;
      const isSelected = this.selectedTrayTower === tId;
      const canAfford = this.cash >= proto.cost;

      // 3D Cartoon Drop Shadow
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(cx, cy + 3.5, cardW, cardH, 12);
      ctx.fill();

      // Card Background
      ctx.fillStyle = isSelected ? '#3a86ff' : canAfford ? '#334155' : '#1e293b';
      ctx.strokeStyle = isSelected ? '#ffd166' : '#000000';
      ctx.lineWidth = isSelected ? 3 : 2.5;

      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();

      // Top Specular Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(cx + 2, cy + 2, cardW - 4, (cardH - 4) * 0.38, [10, 10, 0, 0]);
      ctx.fill();

      // Tower Icon
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(proto.icon, cx + cardW / 2, cy + 24);

      // Tower Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9.5px system-ui, sans-serif';
      ctx.fillText(proto.name, cx + cardW / 2, cy + 42);

      // Price Tag Pill with 3D drop shadow
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(cx + cardW / 2 - 24, cy + 49.5, 48, 16, 8);
      ctx.fill();

      ctx.fillStyle = canAfford ? '#fbbf24' : '#ef4444';
      ctx.beginPath();
      ctx.roundRect(cx + cardW / 2 - 24, cy + 48, 48, 16, 8);
      ctx.fill();

      ctx.fillStyle = canAfford ? '#000000' : '#ffffff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(`$${proto.cost}`, cx + cardW / 2, cy + 60);
    }

    ctx.restore();
  }

  getUpgradeModalLayout(t) {
    const modalW = 176;
    const modalH = 104;
    const modalX = Math.max(10, Math.min(this.W - modalW - 10, t.x - modalW / 2));
    const modalY = t.y > 420 ? t.y - 125 : t.y + 55;

    return {
      modalX,
      modalY,
      modalW,
      modalH,
      upgBtn: {
        x: modalX + 10,
        y: modalY + 42,
        w: modalW - 20,
        h: 24,
      },
      sellBtn: {
        x: modalX + 10,
        y: modalY + 72,
        w: modalW - 20,
        h: 22,
      },
    };
  }

  renderUpgradeModal(ctx, t) {
    const proto = TOWER_TYPES[t.type];
    const maxLvl = proto.upgrades.length;
    const layout = this.getUpgradeModalLayout(t);
    const { modalX, modalY, modalW, modalH, upgBtn, sellBtn } = layout;

    ctx.save();

    // Modal Background
    ctx.fillStyle = 'rgba(33, 37, 41, 0.95)';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(modalX, modalY, modalW, modalH, 14);
    ctx.fill();
    ctx.stroke();

    // Tower Name & Stars
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${proto.name} ${'★'.repeat(t.upgradeLvl)}`, modalX + 12, modalY + 18);

    ctx.fillStyle = '#adb5bd';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(`Pops: ${t.totalPops} · Range: ${t.range}`, modalX + 12, modalY + 32);

    // Upgrade Button
    if (t.upgradeLvl < maxLvl) {
      const nextUpg = proto.upgrades[t.upgradeLvl];
      const upgCost = nextUpg ? nextUpg.cost : 99999;
      const canUpg = this.cash >= upgCost;
      const nextName = nextUpg ? nextUpg.name : '';

      ctx.fillStyle = canUpg ? '#06d6a0' : '#495057';
      ctx.beginPath();
      ctx.roundRect(upgBtn.x, upgBtn.y, upgBtn.w, upgBtn.h, 8);
      ctx.fill();

      ctx.fillStyle = canUpg ? '#051923' : '#adb5bd';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`UPGRADE: $${upgCost} (${nextName})`, upgBtn.x + upgBtn.w / 2, upgBtn.y + upgBtn.h / 2);
    } else {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MAX UPGRADE REACHED! 🏆', upgBtn.x + upgBtn.w / 2, upgBtn.y + upgBtn.h / 2);
    }

    // Sell Button
    let totalInvested = proto.cost;
    for (let lvl = 0; lvl < t.upgradeLvl; lvl++) {
      totalInvested += proto.upgrades[lvl].cost;
    }
    const refund = Math.round(totalInvested * 0.7);
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.roundRect(sellBtn.x, sellBtn.y, sellBtn.w, sellBtn.h, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SELL (+$${refund})`, sellBtn.x + sellBtn.w / 2, sellBtn.y + sellBtn.h / 2);

    ctx.restore();
  }
}
