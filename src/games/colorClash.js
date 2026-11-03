import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const TAU = Math.PI * 2;

// Arena Grid Configuration
const GRID_COLS = 22;
const GRID_ROWS = 28;
const CELL_SIZE = 16;
const GRID_W = GRID_COLS * CELL_SIZE; // 352 px
const GRID_H = GRID_ROWS * CELL_SIZE; // 448 px
const ARENA_X = Math.round((450 - GRID_W) / 2); // 49 px
const ARENA_Y = 148; // Leaves top for HUD & bottom for Card Dock
const TOTAL_TILES = GRID_COLS * GRID_ROWS; // 616 tiles

// Teams: 0 = Neutral, 1 = Blue (Player), 2 = Red (Trainer AI)
const TEAMS = {
  0: { name: 'Neutral', main: '#1e293b', border: '#334155' },
  1: { name: 'Blue', main: '#00b4d8', deep: '#0077b6', light: '#90e0ef', text: '#ffffff' },
  2: { name: 'Red',  main: '#ef233c', deep: '#d90429', light: '#ff85a1', text: '#ffffff' },
};

// 6 Playable Card Archetypes
const CARDS = [
  {
    id: 'roller',
    name: 'Paint Roller',
    icon: '🏎️',
    cost: 3,
    hp: 95,
    speed: 135,
    dps: 50,
    desc: 'Charges forward, rolling out a 3-tile wide paint wake!',
  },
  {
    id: 'cannon',
    name: 'Ink Turret',
    icon: '🎯',
    cost: 2,
    hp: 130,
    range: 135,
    cooldown: 0.55,
    lifetime: 22,
    desc: 'Stationary turret firing 3-shot ink cones.',
  },
  {
    id: 'blaster',
    name: 'Tri Blaster',
    icon: '🤖',
    cost: 4,
    hp: 175,
    speed: 70,
    range: 140,
    cooldown: 0.85,
    desc: 'Heavy mobile tank with 3 forward paint cannons.',
  },
  {
    id: 'mortar',
    name: 'Paint Bomb',
    icon: '💣',
    cost: 3,
    isSpell: true,
    radius: 46,
    desc: 'Cast anywhere! Detonates in a huge 5x5 paint explosion.',
  },
  {
    id: 'spinner',
    name: 'Saw Spinner',
    icon: '🌀',
    cost: 5,
    hp: 240,
    speed: 85,
    dps: 42,
    desc: 'Spinning brawler that carves radial paint paths.',
  },
  {
    id: 'striker',
    name: 'Jet Striker',
    icon: '🚀',
    cost: 3,
    hp: 85,
    speed: 165,
    dps: 40,
    desc: 'Aerial flyer! Ignores sludge, swoops in and executes an explosive paint dive!',
  },
];

const CARD_POOL = ['roller', 'cannon', 'blaster', 'mortar', 'spinner', 'striker'];

export class ColorClash extends Game {
  static meta = {
    id: 'color-clash',
    title: 'Color Clash',
    icon: '🎨',
    hint: 'DRAG & DROP Cards · PAINT the arena & dominate territory before the 60s timer expires!',
    baseLikes: 7420,
    roundLen: 60,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    this.matchTimer = (saved && Number.isFinite(saved.matchTimer)) ? saved.matchTimer : 60;
    this.gameWon = false;
    this.gameLost = false;

    // Ink Pools (0.0 to 10.0)
    this.playerInk = (saved && Number.isFinite(saved.playerInk)) ? saved.playerInk : 5.0;
    this.aiInk = (saved && Number.isFinite(saved.aiInk)) ? saved.aiInk : 5.0;
    this.baseInkRate = 1.0 / 1.15; // 1 Ink every 1.15 seconds
    this.isOvertime = Boolean(saved?.isOvertime);
    this.inkRate = this.isOvertime ? this.baseInkRate * 2.0 : this.baseInkRate;
    this.aiSurgeTriggered = Boolean(saved?.aiSurgeTriggered);
    this.overtimeBannerTimer = 0;

    // Grid Buffer: 0 = Neutral, 1 = Blue (You), 2 = Red (AI)
    this.grid = new Uint8Array(TOTAL_TILES);
    if (Array.isArray(saved?.grid) && saved.grid.length === TOTAL_TILES) {
      this.grid.set(saved.grid);
    } else {
      // Initialize starting territory:
      // Rows 0 to 10: Red (AI)
      // Rows 11 to 16: Neutral contested ground
      // Rows 17 to 27: Blue (Player)
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const idx = r * GRID_COLS + c;
          if (r <= 10) this.grid[idx] = 2;
          else if (r >= 17) this.grid[idx] = 1;
          else this.grid[idx] = 0;
        }
      }
    }

    if (saved) this.grace = 1.5;

    // Territory Counts
    this.blueCount = 0;
    this.redCount = 0;
    this.neutralCount = 0;
    this.bluePercent = 50;
    this.redPercent = 50;
    this.updateTerritoryCounts();

    // Player Card Deck & Hand (4 active cards in hand + 1 Next queue card)
    this.playerHand = saved?.playerHand || ['roller', 'cannon', 'blaster', 'mortar'];
    this.playerNextCard = saved?.playerNextCard || 'striker';
    this.selectedCardIndex = null; // 0..3

    // AI Opponent Deck
    this.aiHand = ['roller', 'cannon', 'blaster', 'mortar'];
    this.aiNextCard = 'striker';
    this.aiDecisionTimer = 0.4;

    // Entities & Projectiles
    this.units = [];
    this.projectiles = [];
    this.unitIdCounter = 1;

    // Pointer Drag & Hover state
    this.dragCardIndex = null;
    this.dragX = 0;
    this.dragY = 0;
    this.isDragging = false;
  }

  updateTerritoryCounts() {
    let b = 0;
    let r = 0;
    for (let i = 0; i < TOTAL_TILES; i++) {
      if (this.grid[i] === 1) b++;
      else if (this.grid[i] === 2) r++;
    }
    this.blueCount = b;
    this.redCount = r;
    this.neutralCount = TOTAL_TILES - (b + r);
    this.bluePercent = Math.round((b / TOTAL_TILES) * 100);
    this.redPercent = Math.round((r / TOTAL_TILES) * 100);
  }

  update(dtRaw) {
    const dt = Math.min(dtRaw, 0.05);
    this.fx.update(dt);

    if (this.dead) return;

    // 1. Match Timer Countdown
    this.matchTimer = Math.max(0, this.matchTimer - dt);

    // Overtime Check (Final 25 Seconds: 2X INK RUSH)
    if (this.matchTimer <= 25 && !this.isOvertime) {
      this.isOvertime = true;
      this.inkRate = this.baseInkRate * 2.0;
      this.overtimeBannerTimer = 3.5;
      this.sounds.up();
      this.haptics.heavy();
      this.fx.shake(10, 0.5);
      this.fx.text(this.W / 2, 280, '⚡ 2X INK OVERTIME RUSH! ⚡', '#ffd166', 26, 3.0);
    }
    if (this.overtimeBannerTimer > 0) {
      this.overtimeBannerTimer -= dt;
    }

    // AI Desperation Ink Surge (Below 35% Red Territory)
    if (this.redPercent <= 35 && !this.aiSurgeTriggered && this.matchTimer > 4) {
      this.aiSurgeTriggered = true;
      this.aiInk = Math.min(10.0, this.aiInk + 3.0);
      this.sounds.laser();
      this.fx.text(this.W / 2, 220, '⚠️ TRAINER INK SURGE! ⚠️', '#ef233c', 22, 2.0);
      this.fx.burst(this.W / 2, ARENA_Y + 60, '#ef233c', 16, 120, 0.5, 3.5);
    }

    // 2. Ink Regeneration
    this.playerInk = Math.min(10.0, this.playerInk + dt * this.inkRate);
    this.aiInk = Math.min(10.0, this.aiInk + dt * this.inkRate);

    // 3. User Input Handling
    this.handleInput();

    // 4. AI Opponent Logic
    this.updateAI(dt);

    // 5. Update Units
    this.updateUnits(dt);

    // 6. Update Projectiles & Splatters
    this.updateProjectiles(dt);

    // 7. Recalculate Territory Percentages
    this.updateTerritoryCounts();

    // 8. Win / Loss Condition Checks
    this.checkMatchConditions();
  }

  checkMatchConditions() {
    // A. Sudden Death Knockout (80%+ Board Control)
    if (this.bluePercent >= 80 && !this.gameWon) {
      this.gameWon = true;
      this.sounds.survive();
      this.haptics.success();
      this.score += 2500;
      this.fx.text(this.W / 2, 280, 'TURF KNOCKOUT! 🏆', '#ffd166', 32, 2.0);
      this.fx.text(this.W / 2, 320, 'TOTAL DOMINATION!', '#06d6a0', 20, 2.0);
      for (let i = 0; i < 6; i++) {
        this.fx.burst(100 + i * 50, 250, '#00b4d8', 16, 180, 0.7, 3.5, 120);
      }
      return;
    }

    if (this.redPercent >= 80 && !this.gameLost) {
      this.gameLost = true;
      this.die('Opponent achieved a Turf Knockout! 💀');
      return;
    }

    // B. Match Timer Expired (0:00)
    if (this.matchTimer <= 0) {
      if (this.bluePercent > this.redPercent) {
        if (!this.gameWon) {
          this.gameWon = true;
          this.sounds.survive();
          this.haptics.success();
          this.score += 1000 + this.bluePercent * 25;
          this.fx.text(this.W / 2, 280, 'VICTORY! ⭐', '#ffd166', 34, 2.0);
          this.fx.text(this.W / 2, 320, `${this.bluePercent}% vs ${this.redPercent}%`, '#00b4d8', 22, 2.0);
        }
      } else if (this.redPercent > this.bluePercent) {
        if (!this.gameLost) {
          this.gameLost = true;
          this.die('Opponent conquered more territory!');
        }
      }
    }
  }

  /* ---------------------------------------------------- Grid Painting */
  paintTile(col, row, team) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    const idx = row * GRID_COLS + col;
    this.grid[idx] = team;
  }

  paintCircle(cx, cy, radiusPx, team) {
    const minCol = Math.max(0, Math.floor((cx - radiusPx - ARENA_X) / CELL_SIZE));
    const maxCol = Math.min(GRID_COLS - 1, Math.floor((cx + radiusPx - ARENA_X) / CELL_SIZE));
    const minRow = Math.max(0, Math.floor((cy - radiusPx - ARENA_Y) / CELL_SIZE));
    const maxRow = Math.min(GRID_ROWS - 1, Math.floor((cy + radiusPx - ARENA_Y) / CELL_SIZE));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const tx = ARENA_X + (c + 0.5) * CELL_SIZE;
        const ty = ARENA_Y + (r + 0.5) * CELL_SIZE;
        if (Math.hypot(tx - cx, ty - cy) <= radiusPx) {
          this.paintTile(c, r, team);
        }
      }
    }
  }

  getTileTeamAtWorld(wx, wy) {
    const col = Math.floor((wx - ARENA_X) / CELL_SIZE);
    const row = Math.floor((wy - ARENA_Y) / CELL_SIZE);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return 0;
    return this.grid[row * GRID_COLS + col];
  }

  isValidPlacement(team, wx, wy, isSpell = false) {
    // Spells can be cast anywhere inside the arena bounds
    if (wx < ARENA_X || wx > ARENA_X + GRID_W || wy < ARENA_Y || wy > ARENA_Y + GRID_H) {
      return false;
    }
    if (isSpell) return true;

    // Ground & Turret units can be deployed on friendly painted tiles or within your backline spawn row
    const tileTeam = this.getTileTeamAtWorld(wx, wy);
    if (team === 1) {
      // Player: allowed on Blue tiles OR within home baseline (rows >= 22)
      const row = Math.floor((wy - ARENA_Y) / CELL_SIZE);
      return tileTeam === 1 || row >= 22;
    } else {
      // AI: allowed on Red tiles OR within home baseline (rows <= 5)
      const row = Math.floor((wy - ARENA_Y) / CELL_SIZE);
      return tileTeam === 2 || row <= 5;
    }
  }

  /* ------------------------------------------------ Unit & Card Spawning */
  deployCard(team, cardId, targetX, targetY) {
    const card = CARDS.find((c) => c.id === cardId);
    if (!card) return false;

    // Deduct Ink
    if (team === 1) {
      if (this.playerInk < card.cost) return false;
      this.playerInk -= card.cost;
    } else {
      if (this.aiInk < card.cost) return false;
      this.aiInk -= card.cost;
    }

    if (card.isSpell) {
      // Launch Paint Mortar shell
      this.sounds.explosion();
      this.haptics.medium();
      const startX = team === 1 ? this.W / 2 : this.W / 2;
      const startY = team === 1 ? ARENA_Y + GRID_H + 15 : ARENA_Y - 15;

      this.projectiles.push({
        type: 'mortar',
        team,
        startX,
        startY,
        x: startX,
        y: startY,
        targetX,
        targetY,
        progress: 0,
        speed: 1.4, // completes arc in ~0.7s
        radius: card.radius,
        damage: 60,
      });

      this.fx.burst(targetX, targetY, team === 1 ? '#00b4d8' : '#ef233c', 8, 80, 0.4, 3);
      return true;
    }

    // Spawn Unit onto Battlefield
    const unit = {
      id: this.unitIdCounter++,
      cardId: card.id,
      name: card.name,
      icon: card.icon,
      team,
      x: targetX,
      y: targetY,
      hp: card.hp,
      maxHp: card.hp,
      speed: card.speed || 0,
      angle: team === 1 ? -Math.PI / 2 : Math.PI / 2, // Facing enemy base
      range: card.range || 0,
      cooldown: card.cooldown || 0,
      timer: 0,
      lifetime: card.lifetime || 999,
      isTurret: card.id === 'cannon',
      animPhase: Math.random() * TAU,
    };

    this.units.push(unit);

    // Initial deployment splash
    this.sounds.drop();
    this.haptics.light();
    this.paintCircle(targetX, targetY, 22, team);
    this.fx.burst(targetX, targetY, team === 1 ? '#00b4d8' : '#ef233c', 14, 110, 0.4, 3);

    return true;
  }

  /* ---------------------------------------------------- Unit Simulation */
  updateUnits(dt) {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      u.animPhase += dt * 6;

      // Lifetime countdown (e.g. turrets)
      if (u.lifetime < 900) {
        u.lifetime -= dt;
        if (u.lifetime <= 0) {
          this.destroyUnit(u, i);
          continue;
        }
      }

      // Check current terrain team (Splatoon rules)
      const terrainTeam = this.getTileTeamAtWorld(u.x, u.y);
      let terrainSpeedMult = 1.0;
      if (terrainTeam === u.team) {
        // Boost on own paint!
        terrainSpeedMult = 1.25;
        if (Math.random() < 0.25) {
          this.fx.burst(u.x, u.y + 4, u.team === 1 ? '#90e0ef' : '#ff85a1', 1, 30, 0.2, 1.5);
        }
      } else if (terrainTeam !== 0 && terrainTeam !== u.team) {
        // Sludge penalty on enemy paint!
        terrainSpeedMult = 0.60;
        u.hp -= dt * 3.5; // Slight friction damage
        if (u.hp <= 0) {
          this.destroyUnit(u, i);
          continue;
        }
      }

      // Archetype Behaviors
      if (u.cardId === 'roller') {
        // High speed charge rolling forward
        const dy = (u.team === 1 ? -1 : 1) * u.speed * terrainSpeedMult * dt;
        u.y += dy;

        // Roll out 3-tile wide paint swath continuously
        this.paintCircle(u.x, u.y, 18, u.team);

        // Check ramming collision with opposing units
        for (const other of this.units) {
          if (other.team !== u.team && Math.hypot(other.x - u.x, other.y - u.y) <= 22) {
            other.hp -= 50 * dt * 4;
            u.hp -= 20 * dt * 4;
            this.sounds.hit();
            this.fx.burst(u.x, u.y, '#ffd166', 3, 60, 0.2, 2);
          }
        }

        // Clamp or despawn at end of arena
        if (u.y < ARENA_Y + 10 || u.y > ARENA_Y + GRID_H - 10) {
          this.paintCircle(u.x, u.y, 28, u.team);
          this.destroyUnit(u, i);
          continue;
        }
      } else if (u.cardId === 'cannon') {
        // Stationary Turret: Find nearest opposing unit or enemy territory
        u.timer -= dt;
        const target = this.findNearestEnemy(u, u.range);
        if (target) {
          u.angle = Math.atan2(target.y - u.y, target.x - u.x);
        } else {
          u.angle = u.team === 1 ? -Math.PI / 2 : Math.PI / 2;
        }

        if (u.timer <= 0) {
          u.timer = u.cooldown;
          this.sounds.slice();
          // Fire 3-spread ink cone
          [-0.2, 0, 0.2].forEach((spread) => {
            const a = u.angle + spread;
            this.projectiles.push({
              type: 'pellet',
              team: u.team,
              x: u.x + Math.cos(a) * 16,
              y: u.y + Math.sin(a) * 16,
              vx: Math.cos(a) * 280,
              vy: Math.sin(a) * 280,
              damage: 16,
              life: 0.55,
              radius: 4,
            });
          });
        }
      } else if (u.cardId === 'blaster') {
        // Heavy Mobile Tank
        const target = this.findNearestEnemy(u, u.range);
        if (target) {
          u.angle = Math.atan2(target.y - u.y, target.x - u.x);
        } else {
          u.angle = u.team === 1 ? -Math.PI / 2 : Math.PI / 2;
          // Advance forward if no enemy in range
          u.y += (u.team === 1 ? -1 : 1) * u.speed * terrainSpeedMult * dt;
        }

        this.paintCircle(u.x, u.y, 14, u.team);

        u.timer -= dt;
        if (u.timer <= 0) {
          u.timer = u.cooldown;
          this.sounds.tone({ f: 380, to: 190, dur: 0.08, vol: 0.2 });
          [-0.14, 0, 0.14].forEach((spread) => {
            const a = u.angle + spread;
            this.projectiles.push({
              type: 'heavy',
              team: u.team,
              x: u.x + Math.cos(a) * 18,
              y: u.y + Math.sin(a) * 18,
              vx: Math.cos(a) * 240,
              vy: Math.sin(a) * 240,
              damage: 24,
              life: 0.65,
              radius: 6,
            });
          });
        }

        if (u.y < ARENA_Y + 10 || u.y > ARENA_Y + GRID_H - 10) {
          this.paintCircle(u.x, u.y, 22, u.team);
          this.destroyUnit(u, i);
          continue;
        }
      } else if (u.cardId === 'spinner') {
        // Whirlwind Saw Brawler
        u.angle += dt * 14;
        u.y += (u.team === 1 ? -1 : 1) * u.speed * terrainSpeedMult * dt;
        this.paintCircle(u.x, u.y, 22, u.team);

        // Constant radial melee contact
        for (const other of this.units) {
          if (other.team !== u.team && Math.hypot(other.x - u.x, other.y - u.y) <= 30) {
            other.hp -= 45 * dt;
            this.sounds.hit();
            this.fx.burst(u.x, u.y, other.team === 1 ? '#00b4d8' : '#ef233c', 2, 40, 0.15, 2);
          }
        }

        if (u.y < ARENA_Y + 10 || u.y > ARENA_Y + GRID_H - 10) {
          this.paintCircle(u.x, u.y, 26, u.team);
          this.destroyUnit(u, i);
          continue;
        }
      } else if (u.cardId === 'striker') {
        // High-Speed Aerial Jet Bean
        u.animPhase += dt * 8;
        // Airborne: completely unaffected by ground paint sludge!
        const dy = (u.team === 1 ? -1 : 1) * u.speed * dt;
        u.y += dy;

        // Check if diving into target or deep enemy base
        const target = this.findNearestEnemy(u, 75);
        const nearBase = u.team === 1 ? (u.y <= ARENA_Y + 40) : (u.y >= ARENA_Y + GRID_H - 40);

        if (target || nearBase) {
          // Impact Paint Dive Explosion!
          const impactX = target ? target.x : u.x;
          const impactY = target ? target.y : u.y;
          this.paintCircle(impactX, impactY, 26, u.team);
          this.sounds.explosion();
          this.haptics.medium();
          this.fx.burst(impactX, impactY, u.team === 1 ? '#00b4d8' : '#ef233c', 14, 130, 0.4, 3);
          this.fx.ring(impactX, impactY, '#ffd166', 26, 0.3, 4);

          for (const other of this.units) {
            if (other.team !== u.team && Math.hypot(other.x - impactX, other.y - impactY) <= 32) {
              other.hp -= 45;
            }
          }
          this.destroyUnit(u, i);
          continue;
        } else {
          // Paint a narrow aerial vapor trail on the ground below
          if (Math.random() < 0.35) {
            this.paintCircle(u.x, u.y, 8, u.team);
            this.fx.burst(u.x, u.y + (u.team === 1 ? 8 : -8), u.team === 1 ? '#90e0ef' : '#ff85a1', 1, 20, 0.2, 1.2);
          }
        }

        // Clamp or despawn at end of arena
        if (u.y < ARENA_Y + 10 || u.y > ARENA_Y + GRID_H - 10) {
          this.paintCircle(u.x, u.y, 24, u.team);
          this.destroyUnit(u, i);
          continue;
        }
      }

      // Check unit death
      if (u.hp <= 0) {
        this.destroyUnit(u, i);
      }
    }
  }

  destroyUnit(u, index) {
    this.units.splice(index, 1);
    this.sounds.blockPop(4);
    this.fx.burst(u.x, u.y, u.team === 1 ? '#00b4d8' : '#ef233c', 12, 120, 0.35, 3.5);
    // Final splash explosion
    this.paintCircle(u.x, u.y, 20, u.team);
  }

  findNearestEnemy(sourceUnit, maxRange) {
    let nearest = null;
    let minDist = maxRange;
    for (const other of this.units) {
      if (other.team !== sourceUnit.team) {
        const d = Math.hypot(other.x - sourceUnit.x, other.y - sourceUnit.y);
        if (d <= minDist) {
          minDist = d;
          nearest = other;
        }
      }
    }
    return nearest;
  }

  /* ----------------------------------------------- Projectiles & Splatters */
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      if (p.type === 'mortar') {
        p.progress = Math.min(1.0, p.progress + dt * p.speed);
        // Parabolic arc interpolation
        p.x = p.startX + (p.targetX - p.startX) * p.progress;
        const linearY = p.startY + (p.targetY - p.startY) * p.progress;
        const heightArc = Math.sin(p.progress * Math.PI) * 110;
        p.y = linearY - heightArc;

        if (p.progress >= 1.0) {
          // Detonate Mortar!
          this.sounds.explosion();
          this.haptics.heavy();
          this.fx.burst(p.targetX, p.targetY, p.team === 1 ? '#00b4d8' : '#ef233c', 20, 160, 0.5, 4);
          this.fx.ring(p.targetX, p.targetY, '#ffd166', p.radius, 0.35, 5);

          // Giant 5x5 Paint Splatter
          this.paintCircle(p.targetX, p.targetY, p.radius, p.team);

          // Damage enemy units in radius
          for (const u of this.units) {
            if (u.team !== p.team && Math.hypot(u.x - p.targetX, u.y - p.targetY) <= p.radius) {
              u.hp -= p.damage;
            }
          }

          this.projectiles.splice(i, 1);
        }
        continue;
      }

      // Standard / Heavy Pellets
      p.life -= dt;
      if (p.life <= 0) {
        // Paint ground where pellet hits the floor
        this.paintCircle(p.x, p.y, p.radius * 2.2, p.team);
        this.projectiles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Paint ground along the flight trajectory
      this.paintCircle(p.x, p.y, p.radius * 1.4, p.team);

      // Check collision with enemy units
      let hit = false;
      for (const u of this.units) {
        if (u.team !== p.team && Math.hypot(u.x - p.x, u.y - p.y) <= (u.hp > 100 ? 18 : 14)) {
          u.hp -= p.damage;
          hit = true;
          this.sounds.hit();
          this.paintCircle(u.x, u.y, 16, p.team);
          this.fx.burst(p.x, p.y, p.team === 1 ? '#00b4d8' : '#ef233c', 6, 80, 0.25, 2.5);
          break;
        }
      }

      if (hit) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  /* ---------------------------------------------------- AI Opponent Logic */
  getLaneStats() {
    const lanes = [
      { id: 0, minCol: 0, maxCol: 6, centerX: ARENA_X + 3.5 * CELL_SIZE },
      { id: 1, minCol: 7, maxCol: 14, centerX: ARENA_X + 11.0 * CELL_SIZE },
      { id: 2, minCol: 15, maxCol: 21, centerX: ARENA_X + 18.5 * CELL_SIZE },
    ];

    for (const lane of lanes) {
      // Find deepest Red row in this lane
      let maxRedRow = 3;
      let minBlueRow = GRID_ROWS - 1;
      let redCount = 0;
      let blueCount = 0;

      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = lane.minCol; c <= lane.maxCol; c++) {
          const val = this.grid[r * GRID_COLS + c];
          if (val === 2) {
            redCount++;
            if (r > maxRedRow) maxRedRow = r;
          } else if (val === 1) {
            blueCount++;
            if (r < minBlueRow) minBlueRow = r;
          }
        }
      }

      lane.maxRedRow = Math.min(GRID_ROWS - 3, maxRedRow);
      lane.minBlueRow = minBlueRow;
      lane.redCount = redCount;
      lane.blueCount = blueCount;

      // Player and AI units in this lane
      lane.playerUnits = this.units.filter((u) => {
        if (u.team !== 1) return false;
        const col = Math.floor((u.x - ARENA_X) / CELL_SIZE);
        return col >= lane.minCol && col <= lane.maxCol;
      });

      lane.aiUnits = this.units.filter((u) => {
        if (u.team !== 2) return false;
        const col = Math.floor((u.x - ARENA_X) / CELL_SIZE);
        return col >= lane.minCol && col <= lane.maxCol;
      });

      // Threat score
      lane.threatScore = lane.playerUnits.reduce((acc, u) => {
        let weight = 20;
        if (u.cardId === 'roller') weight = 50;
        else if (u.cardId === 'blaster') weight = 45;
        else if (u.cardId === 'spinner') weight = 40;
        else if (u.cardId === 'striker') weight = 35;
        // Units closer to AI base are exponentially higher threat
        const distFromBase = Math.max(10, u.y - ARENA_Y);
        const proximityBonus = distFromBase < 170 ? 55 : 0;
        return acc + weight + proximityBonus;
      }, 0);
    }

    return lanes;
  }

  deployAICard(cardId, targetX, targetY) {
    const handIndex = this.aiHand.indexOf(cardId);
    if (handIndex === -1) return false;

    if (this.deployCard(2, cardId, targetX, targetY)) {
      this.aiHand[handIndex] = this.aiNextCard;
      const unused = CARD_POOL.filter((id) => !this.aiHand.includes(id));
      this.aiNextCard = unused.length > 0 ? unused[Math.floor(Math.random() * unused.length)] : CARD_POOL[Math.floor(Math.random() * CARD_POOL.length)];
      return true;
    }
    return false;
  }

  updateAI(dt) {
    this.aiDecisionTimer -= dt;
    if (this.aiDecisionTimer > 0) return;
    this.aiDecisionTimer = this.isOvertime ? 0.22 + Math.random() * 0.22 : 0.38 + Math.random() * 0.30;

    const lanes = this.getLaneStats();

    // How many cards to attempt to play this tick? (1 normally, up to 2 if high ink or Overtime Rush)
    const maxPlays = (this.aiInk >= 6.5 || (this.isOvertime && this.aiInk >= 4.5)) ? 2 : 1;

    for (let play = 0; play < maxPlays; play++) {
      let cardPlayed = false;

      // 1. Critical Defense: Intercept dangerous incoming units (Rollers/Tanks near AI base)
      const urgentThreat = this.units.find(
        (u) => u.team === 1 && u.y < ARENA_Y + 160 && u.cardId !== 'cannon'
      );

      if (urgentThreat) {
        const defensiveCard = this.aiHand.find((id) => id === 'cannon' || id === 'spinner' || id === 'striker');
        if (defensiveCard) {
          const cardObj = CARDS.find((c) => c.id === defensiveCard);
          if (cardObj && this.aiInk >= cardObj.cost) {
            const tx = Math.max(ARENA_X + 25, Math.min(ARENA_X + GRID_W - 25, urgentThreat.x));
            const ty = Math.max(ARENA_Y + 25, urgentThreat.y - 45);
            if (this.isValidPlacement(2, tx, ty, false)) {
              if (this.deployAICard(defensiveCard, tx, ty)) {
                cardPlayed = true;
                continue;
              }
            }
          }
        }
      }

      // 2. High-Value Mortar Strike: Blow up Player Turrets or Unit Clusters
      const hasMortar = this.aiHand.includes('mortar');
      if (hasMortar && this.aiInk >= 3) {
        let mortarTarget = null;

        // A. Target player stationary turret
        const playerTurret = this.units.find((u) => u.team === 1 && u.cardId === 'cannon');
        if (playerTurret) {
          mortarTarget = { x: playerTurret.x, y: playerTurret.y };
        } else {
          // B. Target player unit cluster (2+ units within 65px)
          const playerUnits = this.units.filter((u) => u.team === 1);
          for (let i = 0; i < playerUnits.length; i++) {
            for (let j = i + 1; j < playerUnits.length; j++) {
              if (Math.hypot(playerUnits[i].x - playerUnits[j].x, playerUnits[i].y - playerUnits[j].y) <= 65) {
                mortarTarget = {
                  x: (playerUnits[i].x + playerUnits[j].x) / 2,
                  y: (playerUnits[i].y + playerUnits[j].y) / 2,
                };
                break;
              }
            }
            if (mortarTarget) break;
          }
        }

        // C. Target player territory beachhead if player is winning (> 50% territory)
        if (!mortarTarget && this.bluePercent > 48) {
          const candidateLanes = [...lanes].sort((a, b) => b.blueCount - a.blueCount);
          if (candidateLanes.length > 0) {
            mortarTarget = {
              x: candidateLanes[0].centerX,
              y: ARENA_Y + candidateLanes[0].minBlueRow * CELL_SIZE + 10,
            };
          }
        }

        if (mortarTarget && this.isValidPlacement(2, mortarTarget.x, mortarTarget.y, true)) {
          if (this.deployAICard('mortar', mortarTarget.x, mortarTarget.y)) {
            cardPlayed = true;
            continue;
          }
        }
      }

      // 3. Frontline Bridgehead Assault & Tactical Flanking
      // - If player is pushing heavily in one lane, 50% chance to contest, 50% chance to flank the open lane!
      let targetLane = null;
      const threatenedLanes = [...lanes].filter((l) => l.threatScore > 0).sort((a, b) => b.threatScore - a.threatScore);
      const openLanes = [...lanes].sort((a, b) => a.threatScore - b.threatScore);

      if (threatenedLanes.length > 0 && Math.random() < 0.50) {
        targetLane = threatenedLanes[0];
      } else {
        targetLane = openLanes[0] || lanes[1]; // Flank the undefended corridor!
      }

      if (!targetLane) targetLane = lanes[1];

      // Frontline deployment: spawn directly on the forward red edge of this lane!
      const deployRow = Math.max(3, Math.min(23, targetLane.maxRedRow));
      const spawnX = targetLane.centerX + (Math.random() - 0.5) * CELL_SIZE * 2;
      const spawnY = ARENA_Y + deployRow * CELL_SIZE;

      // Select an affordable unit card from hand
      const affordableCards = this.aiHand
        .map((id) => ({ id, card: CARDS.find((c) => c.id === id) }))
        .filter((entry) => entry.card && entry.card.cost <= this.aiInk && !entry.card.isSpell);

      if (affordableCards.length === 0) break;

      // Prioritize cards based on tactic:
      affordableCards.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        if (targetLane.threatScore === 0) {
          // Open lane -> high speed flanking (roller or striker)
          if (a.id === 'roller' || a.id === 'striker') scoreA += 45;
          if (b.id === 'roller' || b.id === 'striker') scoreB += 45;
        } else {
          // Contested lane -> brawler/tank defense (blaster, spinner, cannon)
          if (a.id === 'blaster' || a.id === 'spinner' || a.id === 'cannon') scoreA += 35;
          if (b.id === 'blaster' || b.id === 'spinner' || b.id === 'cannon') scoreB += 35;
        }
        return (scoreB + Math.random() * 20) - (scoreA + Math.random() * 20);
      });

      const chosen = affordableCards[0];
      if (this.isValidPlacement(2, spawnX, spawnY, false)) {
        if (this.deployAICard(chosen.id, spawnX, spawnY)) {
          cardPlayed = true;
        }
      } else {
        // Fallback to home red row if frontline tile was contested
        const safeY = ARENA_Y + (2 + Math.floor(Math.random() * 4)) * CELL_SIZE;
        if (this.isValidPlacement(2, spawnX, safeY, false)) {
          if (this.deployAICard(chosen.id, spawnX, safeY)) {
            cardPlayed = true;
          }
        }
      }

      if (!cardPlayed) break;
    }
  }

  /* ----------------------------------------------------------- User Input */
  handleInput() {
    const mx = this.input.x;
    const my = this.input.y;

    if (this.input.pressed) {
      // 1. Check Card Selection in Bottom Tray (y: 636 -> 706)
      if (my >= 636 && my <= 706) {
        const cardW = 84;
        const cardSpacing = 6;
        for (let i = 0; i < 4; i++) {
          const cx = 72 + i * (cardW + cardSpacing);
          if (mx >= cx && mx <= cx + cardW) {
            const cardId = this.playerHand[i];
            const card = CARDS.find((c) => c.id === cardId);
            if (card && this.playerInk >= card.cost) {
              this.selectedCardIndex = this.selectedCardIndex === i ? null : i;
              this.isDragging = true;
              this.dragCardIndex = i;
              this.sounds.bubble();
              this.haptics.light();
            } else {
              this.sounds.fail();
              this.fx.text(mx, my - 25, 'NEED INK! 💧', '#ef233c', 16, 0.7);
            }
            return;
          }
        }
      }

      // 2. Tap to Deploy Card onto Arena
      if (this.selectedCardIndex !== null && my >= ARENA_Y && my <= ARENA_Y + GRID_H) {
        const cardId = this.playerHand[this.selectedCardIndex];
        const card = CARDS.find((c) => c.id === cardId);
        if (card && this.isValidPlacement(1, mx, my, card.isSpell)) {
          if (this.deployCard(1, cardId, mx, my)) {
            // Cycle Player Card: replace active slot with Next card, draw new Next
            this.playerHand[this.selectedCardIndex] = this.playerNextCard;
            const unused = CARD_POOL.filter((id) => !this.playerHand.includes(id));
            this.playerNextCard = unused.length > 0 ? unused[Math.floor(Math.random() * unused.length)] : CARD_POOL[Math.floor(Math.random() * CARD_POOL.length)];
            this.selectedCardIndex = null;
            this.isDragging = false;
          }
        } else {
          this.sounds.fail();
          this.fx.text(mx, my - 25, card?.isSpell ? 'OUT OF BOUNDS!' : 'DROP ON YOUR TURF! 🛡️', '#ef233c', 15, 0.8);
        }
        return;
      }
    }

    // Dragging updates
    if (this.input.down && this.selectedCardIndex !== null) {
      this.dragX = mx;
      this.dragY = my;
    } else if (this.isDragging && !this.input.down) {
      // Released drag
      if (my >= ARENA_Y && my <= ARENA_Y + GRID_H && this.selectedCardIndex !== null) {
        const cardId = this.playerHand[this.selectedCardIndex];
        const card = CARDS.find((c) => c.id === cardId);
        if (card && this.isValidPlacement(1, mx, my, card.isSpell)) {
          if (this.deployCard(1, cardId, mx, my)) {
            this.playerHand[this.selectedCardIndex] = this.playerNextCard;
            const unused = CARD_POOL.filter((id) => !this.playerHand.includes(id));
            this.playerNextCard = unused.length > 0 ? unused[Math.floor(Math.random() * unused.length)] : CARD_POOL[Math.floor(Math.random() * CARD_POOL.length)];
            this.selectedCardIndex = null;
          }
        }
      }
      this.isDragging = false;
    }
  }

  serialize() {
    return {
      matchTimer: this.matchTimer,
      playerInk: this.playerInk,
      aiInk: this.aiInk,
      grid: Array.from(this.grid),
      playerHand: this.playerHand,
      playerNextCard: this.playerNextCard,
      bluePercent: this.bluePercent,
      redPercent: this.redPercent,
      isOvertime: this.isOvertime,
      aiSurgeTriggered: this.aiSurgeTriggered,
    };
  }

  restoreLabel() {
    return `Territory ${this.bluePercent}% vs ${this.redPercent}% · ⏱️ ${Math.ceil(this.matchTimer)}s`;
  }

  /* ------------------------------------------------------------ Rendering */
  render() {
    const { ctx, W, H } = this;
    const shake = this.fx.offset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Sleek Cyber Stadium Arena Background
    this.renderStadium(ctx, W, H);

    // 2. 2D Paint Grid & Boundary
    this.renderGrid(ctx);

    // 3. Units (Rollers, Turrets, Blasters, Spinners)
    this.renderUnits(ctx);

    // 4. Projectiles & Mortar Shells
    this.renderProjectiles(ctx);

    // 5. Card Deployment Ghost Indicator
    if (this.selectedCardIndex !== null) {
      this.renderPlacementPreview(ctx);
    }

    // 6. Particle Effects & Floating Banners
    this.fx.render(ctx);

    // 7. Top Header HUD (You vs Trainer Territory Bar & Timer)
    this.renderHeaderHUD(ctx, W);

    // 8. Bottom Ink Elixir Bar & Card Deck
    this.renderBottomDock(ctx, W);

    ctx.restore();
  }

  renderStadium(ctx, W, H) {
    // Deep dark arcade stadium backdrop with ambient neon gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0e17');
    bg.addColorStop(0.5, '#0f172a');
    bg.addColorStop(1, '#05070d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle stadium floodlight glows
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#00b4d8';
    ctx.beginPath();
    ctx.arc(W / 2, H - 100, 260, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#ef233c';
    ctx.beginPath();
    ctx.arc(W / 2, 100, 260, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  renderGrid(ctx) {
    ctx.save();

    // 1. Outer Stadium Border Casing (Bold black cartoon rim with inner white accent)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 7;
    ctx.fillStyle = '#1e293b';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(ARENA_X - 4, ARENA_Y - 4, GRID_W + 8, GRID_H + 8, 14);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner crisp white rim
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ARENA_X - 1, ARENA_Y - 1, GRID_W + 2, GRID_H + 2);

    // Overtime Gold Neon Border Pulse
    if (this.isOvertime) {
      const pulse = 0.5 + Math.sin(Date.now() * 0.009) * 0.5;
      ctx.strokeStyle = `rgba(255, 209, 102, ${0.45 + pulse * 0.55})`;
      ctx.lineWidth = 3.5 + pulse * 2;
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 12 * pulse;
      ctx.beginPath();
      ctx.roundRect(ARENA_X - 7, ARENA_Y - 7, GRID_W + 14, GRID_H + 14, 16);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 2. Individual Grid Cells
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const val = this.grid[r * GRID_COLS + c];
        const x = ARENA_X + c * CELL_SIZE;
        const y = ARENA_Y + r * CELL_SIZE;

        if (val === 1) {
          // Blue Paint Tile (Wet cartoon jelly slime)
          ctx.fillStyle = '#0077b6';
          ctx.beginPath();
          ctx.roundRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1, 3);
          ctx.fill();

          ctx.fillStyle = '#00b4d8';
          ctx.beginPath();
          ctx.roundRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2, 2.5);
          ctx.fill();

          // Wet glossy specular glint
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.beginPath();
          ctx.ellipse(x + 4, y + 4, 3, 1.8, -0.4, 0, TAU);
          ctx.fill();
        } else if (val === 2) {
          // Red Paint Tile (Wet cartoon jelly slime)
          ctx.fillStyle = '#d90429';
          ctx.beginPath();
          ctx.roundRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1, 3);
          ctx.fill();

          ctx.fillStyle = '#ef233c';
          ctx.beginPath();
          ctx.roundRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2, 2.5);
          ctx.fill();

          // Wet glossy specular glint
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.beginPath();
          ctx.ellipse(x + 4, y + 4, 3, 1.8, -0.4, 0, TAU);
          ctx.fill();
        } else {
          // Neutral Grid Floor with dot matrix mesh
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          ctx.fillStyle = '#334155';
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          ctx.fillStyle = '#475569';
          ctx.fillRect(x + CELL_SIZE / 2 - 1, y + CELL_SIZE / 2 - 1, 2, 2);
        }
      }
    }

    // 3. Center Halfway Dashed Boundary Line
    const midY = ARENA_Y + 14 * CELL_SIZE;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(ARENA_X, midY);
    ctx.lineTo(ARENA_X + GRID_W, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  renderUnits(ctx) {
    for (const u of this.units) {
      ctx.save();
      ctx.translate(u.x, u.y);

      const color = u.team === 1 ? '#00b4d8' : '#ef233c';
      const darkColor = u.team === 1 ? '#0077b6' : '#d90429';

      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 14, 6, 0, 0, TAU);
      ctx.fill();

      if (u.cardId === 'roller') {
        // High-Speed Paint Roller Unit
        ctx.rotate(u.angle);

        // Vehicle Chassis with thick black cartoon outline
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.roundRect(-10, -14, 20, 28, 6);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Glowing Ink Tank
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-8, -6, 16, 14, 4);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Front Paint Roller Drum
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-14, 10, 28, 8, 3);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Roller Ink Texture
        ctx.fillStyle = color;
        ctx.fillRect(-12, 12, 24, 4);
      } else if (u.cardId === 'cannon') {
        // Stationary Defense Turret
        // Octagonal Base
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Swiveling Gun Turret
        ctx.rotate(u.angle);
        ctx.fillStyle = darkColor;
        ctx.fillRect(4, -5, 16, 10);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(4, -5, 16, 10);

        // Core Turret Dome
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (u.cardId === 'blaster') {
        // Triple Blaster Tank
        ctx.rotate(u.angle);

        // Heavy Armor Hull
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.roundRect(-14, -12, 28, 24, 6);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.stroke();

        // 3 Forward Laser Barrels
        ctx.fillStyle = color;
        ctx.fillRect(8, -10, 14, 5);
        ctx.fillRect(10, -2.5, 14, 5);
        ctx.fillRect(8, 5, 14, 5);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(8, -10, 14, 5);
        ctx.strokeRect(10, -2.5, 14, 5);
        ctx.strokeRect(8, 5, 14, 5);

        // Driver Visor
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-4, -6, 6, 12);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-4, -6, 6, 12);
      } else if (u.cardId === 'spinner') {
        // Whirlwind Saw Spinner
        ctx.rotate(u.angle);

        // Outer Double Saw Blades
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Razor Teeth
        ctx.fillStyle = '#ffffff';
        for (let t = 0; t < 6; t++) {
          const a = (TAU / 6) * t;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
          ctx.lineTo(Math.cos(a + 0.3) * 25, Math.sin(a + 0.3) * 25);
          ctx.lineTo(Math.cos(a + 0.5) * 16, Math.sin(a + 0.5) * 16);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Inner Core
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (u.cardId === 'striker') {
        // High-Speed Aerial Jet Bean
        ctx.rotate(u.angle);

        // Sleek Arrow Delta Wings
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.moveTo(16, 0); // Nose tip forward along +X
        ctx.lineTo(-10, -14); // Left wingtip
        ctx.lineTo(-6, -6);
        ctx.lineTo(-12, 0); // Tail
        ctx.lineTo(-6, 6);
        ctx.lineTo(-10, 14); // Right wingtip
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Fuselage Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(2, 0, 12, 6, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cockpit Visor
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.ellipse(6, 0, 5, 3, 0, 0, TAU);
        ctx.fill();

        // Glowing Thruster Exhaust Flames (pointing backward along -X)
        const flameLen = 6 + Math.sin(u.animPhase) * 4;
        ctx.fillStyle = '#ff9e00';
        ctx.beginPath();
        ctx.moveTo(-12, -4);
        ctx.lineTo(-12 - flameLen, -2);
        ctx.lineTo(-12, 0);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-12 - flameLen, 2);
        ctx.lineTo(-12, 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      // Health Bar above damaged units
      if (u.hp < u.maxHp) {
        const bw = 26;
        const bh = 4;
        const bx = u.x - bw / 2;
        const by = u.y - 24;
        const hpPct = Math.max(0, u.hp / u.maxHp);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = u.team === 1 ? '#00b4d8' : '#ef233c';
        ctx.fillRect(bx, by, bw * hpPct, bh);
      }
    }
  }

  renderProjectiles(ctx) {
    for (const p of this.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);

      const color = p.team === 1 ? '#00b4d8' : '#ef233c';

      if (p.type === 'mortar') {
        // Shadow on ground below shell
        const shadowScale = 0.5 + p.progress * 0.5;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(p.targetX - p.x, (p.startY + (p.targetY - p.startY) * p.progress) - p.y, 14 * shadowScale, 6 * shadowScale, 0, 0, TAU);
        ctx.fill();

        // Mortar Shell
        ctx.fillStyle = color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, TAU);
        ctx.fill();
        ctx.stroke();

        // Trailing sparks
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(-4, -4, 3, 0, TAU);
        ctx.fill();
      } else {
        // High-velocity Ink Pellet
        ctx.fillStyle = color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  renderPlacementPreview(ctx) {
    const cardId = this.playerHand[this.selectedCardIndex];
    const card = CARDS.find((c) => c.id === cardId);
    if (!card) return;

    const mx = this.input.x;
    const my = this.input.y;
    const valid = this.isValidPlacement(1, mx, my, card.isSpell);

    ctx.save();
    // Holographic placement footprint
    ctx.fillStyle = valid ? 'rgba(0, 180, 216, 0.25)' : 'rgba(239, 35, 60, 0.35)';
    ctx.strokeStyle = valid ? '#00b4d8' : '#ef233c';
    ctx.lineWidth = 2.5;

    if (card.isSpell) {
      // Circle radius footprint
      ctx.beginPath();
      ctx.arc(mx, my, card.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else {
      // Unit grid placement box
      ctx.beginPath();
      ctx.roundRect(mx - 18, my - 18, 36, 36, 8);
      ctx.fill();
      ctx.stroke();
    }

    // Ghost icon preview
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.icon, mx, my);

    ctx.restore();
  }

  renderHeaderHUD(ctx, W) {
    ctx.save();

    // 1. Dual Territory Progress Bar (y: 94, height: 38)
    const barX = 14;
    const barY = 94;
    const barW = W - 28;
    const barH = 34;

    // Background pill container
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 17);
    ctx.fill();
    ctx.stroke();

    // Left Blue Segment (% Blue)
    const blueW = Math.round((this.bluePercent / 100) * (barW - 140));
    const splitX = barX + 70 + blueW;

    // Blue Fill
    ctx.fillStyle = '#00b4d8';
    ctx.beginPath();
    ctx.roundRect(barX + 68, barY + 5, blueW, barH - 10, [8, 0, 0, 8]);
    ctx.fill();

    // Red Fill
    const redW = (barW - 140) - blueW;
    ctx.fillStyle = '#ef233c';
    ctx.beginPath();
    ctx.roundRect(splitX, barY + 5, redW, barH - 10, [0, 8, 8, 0]);
    ctx.fill();

    // Left Avatar: You 🔵
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`YOU 🔵 ${this.bluePercent}%`, barX + 12, barY + barH / 2);

    // Right Avatar: Trainer 🔴
    ctx.textAlign = 'right';
    ctx.fillText(`${this.redPercent}% 🔴 TRAINER`, barX + barW - 12, barY + barH / 2);

    // Center Timer Pill: ⏱️ 0:45
    const secs = Math.ceil(this.matchTimer);
    const timeStr = `0:${String(secs).padStart(2, '0')}`;
    const isUrgent = secs <= 10;

    ctx.fillStyle = isUrgent ? '#ef233c' : this.isOvertime ? '#5c1922' : '#1e293b';
    ctx.strokeStyle = this.isOvertime ? '#ffd166' : '#ffd166';
    ctx.lineWidth = this.isOvertime ? 2.5 : 2;
    ctx.beginPath();
    ctx.roundRect(W / 2 - 36, barY + 3, 72, barH - 6, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isUrgent ? '#ffffff' : '#ffd166';
    ctx.font = 'bold 13px system-ui, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(timeStr, W / 2, barY + barH / 2 - (this.isOvertime ? 5 : 0));

    if (this.isOvertime) {
      ctx.fillStyle = '#ff9e00';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.fillText('⚡ 2X INK', W / 2, barY + barH / 2 + 7);
    }

    ctx.restore();
  }

  renderBottomDock(ctx, W) {
    ctx.save();

    // 1. Ink / Elixir Meter with 3D drop shadow
    const inkX = ARENA_X;
    const inkY = 614;
    const inkW = GRID_W;
    const inkH = 14;

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(inkX, inkY + 2.5, inkW, inkH, 7);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(inkX, inkY, inkW, inkH, 7);
    ctx.fill();
    ctx.stroke();

    // Liquid Ink Fill
    const fillW = (this.playerInk / 10.0) * inkW;
    const inkGrad = ctx.createLinearGradient(inkX, 0, inkX + fillW, 0);
    if (this.isOvertime) {
      inkGrad.addColorStop(0, '#f72585');
      inkGrad.addColorStop(0.5, '#7209b7');
      inkGrad.addColorStop(1, '#00b4d8');
    } else {
      inkGrad.addColorStop(0, '#3a86ff');
      inkGrad.addColorStop(1, '#00b4d8');
    }
    ctx.fillStyle = inkGrad;
    ctx.beginPath();
    ctx.roundRect(inkX, inkY, fillW, inkH, 7);
    ctx.fill();

    // 10 Pip divider marks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.2;
    for (let p = 1; p < 10; p++) {
      const px = inkX + (p / 10) * inkW;
      ctx.beginPath();
      ctx.moveTo(px, inkY);
      ctx.lineTo(px, inkY + inkH);
      ctx.stroke();
    }

    // Ink Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const inkLabel = this.isOvertime ? `⚡ 2X SPEED · 💧 ${Math.floor(this.playerInk)} / 10 INK` : `💧 ${Math.floor(this.playerInk)} / 10 INK`;
    ctx.fillText(inkLabel, inkX + 8, inkY + inkH / 2);

    // 2. Bottom Card Tray (y: 636 -> 706)
    // Next Card Preview (on left: x: 16 -> 62)
    const nextCard = CARDS.find((c) => c.id === this.playerNextCard);
    
    // 3D Cartoon Shadow
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(16, 639.5, 48, 68, 12);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(16, 636, 48, 68, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', 40, 648);
    if (nextCard) {
      ctx.font = '20px sans-serif';
      ctx.fillText(nextCard.icon, 40, 672);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText(`💧${nextCard.cost}`, 40, 694);
    }

    // 4 Playable Cards
    const cardW = 84;
    const cardH = 68;
    const cardSpacing = 6;

    for (let i = 0; i < 4; i++) {
      const cx = 72 + i * (cardW + cardSpacing);
      const cy = 636;
      const cardId = this.playerHand[i];
      const card = CARDS.find((c) => c.id === cardId);
      if (!card) continue;

      const canAfford = this.playerInk >= card.cost;
      const isSelected = this.selectedCardIndex === i;

      // 3D Cartoon Drop Shadow
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(cx, cy + 4, cardW, cardH, 12);
      ctx.fill();

      // Card Background Face
      ctx.fillStyle = isSelected ? '#0077b6' : canAfford ? '#334155' : '#1e293b';
      ctx.strokeStyle = isSelected ? '#ffd166' : '#000000';
      ctx.lineWidth = isSelected ? 3 : 2.5;

      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();

      // Top Specular Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(cx + 2, cy + 2, cardW - 4, (cardH - 4) * 0.4, [10, 10, 0, 0]);
      ctx.fill();

      // Card Icon
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.icon, cx + cardW / 2, cy + 28);

      // Card Name
      ctx.fillStyle = canAfford ? '#ffffff' : '#64748b';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText(card.name, cx + cardW / 2, cy + 46);

      // Ink Cost Drop Badge with mini shadow
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(cx + cardW / 2 - 20, cy + 50.5, 40, 14, 7);
      ctx.fill();

      ctx.fillStyle = canAfford ? '#ffd166' : '#ef233c';
      ctx.beginPath();
      ctx.roundRect(cx + cardW / 2 - 20, cy + 49, 40, 14, 7);
      ctx.fill();

      ctx.fillStyle = canAfford ? '#000000' : '#ffffff';
      ctx.font = 'bold 9.5px system-ui, sans-serif';
      ctx.fillText(`💧${card.cost}`, cx + cardW / 2, cy + 59.5);
    }

    ctx.restore();
  }
}
