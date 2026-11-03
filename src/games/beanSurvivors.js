/**
 * ============================================================================
 * BEAN SURVIVORS (Vampire Survivors Arcade Edition)
 * ============================================================================
 * 
 * 360° auto-firing swarm survival game built to the Game Reels Playbook:
 * - Archetype: isPrestige: true (Boss milestone clear -> Prestige promotion)
 * - Safe Zones: Top HUD 130px, Bottom Dock 695px
 * - Start with the Peppermint Wand. Every level-up PAUSES the game and offers
 *   3 random cards: unlock a NEW weapon, upgrade one you own, or take a passive.
 * - Weapons: Peppermint Wand (targeted darts), Bubblegum Orbit (rotating shield),
 *   Pop-Rock Grenade (AoE), Licorice Laser (piercing beams), Candy Cane Sword
 *   (melee slash), Sherbet Zap (chain lightning). Each levels up to 8.
 * - Passives: Sugar Rush (damage), Fizzy Haste (cooldowns), Jelly Boots (speed),
 *   Gem Magnet (pickup range), Gummy Vitality (max HP), Jawbreaker Armor.
 * - Enemies: Gummy Bears, Sour Bats, Jawbreaker Tanks, and the Gummy Behemoth Boss
 * - Sugar XP gems with magnetic attraction
 * ============================================================================
 */

import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);

// Global difficulty bump: applied to enemy HP, contact damage, spawn rate (and a
// gentler +10% to enemy speed so the swarm stays dodgeable).
const DIFFICULTY = 1.25;
const SPEED_DIFFICULTY = 1.10;
const MAX_WEAPON_LEVEL = 8;
const BASE_PLAYER_SPEED = 195;
const BASE_MAGNET = 95;

// Distance from a point to a line segment (used by the laser beams)
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function angleDiff(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

// Enemy archetypes in the confectionery swarm
const ENEMY_TYPES = {
  gummyBear: {
    name: 'Gummy Bear',
    r: 14,
    hp: 18,
    speed: 75,
    damage: 10,
    pts: 25,
    color: '#ff3366',
    bellyColor: '#ff758f',
    ear: true,
  },
  sourBat: {
    name: 'Sour Bat',
    r: 11,
    hp: 10,
    speed: 125,
    damage: 8,
    pts: 35,
    color: '#8338ec',
    bellyColor: '#c77dff',
    wing: true,
  },
  jawbreaker: {
    name: 'Jawbreaker Tank',
    r: 22,
    hp: 65,
    speed: 48,
    damage: 20,
    pts: 90,
    color: '#00b4d8',
    bellyColor: '#90e0ef',
    tank: true,
  },
  boss: {
    name: 'GUMMY BEHEMOTH',
    r: 44,
    hp: 450,
    speed: 55,
    damage: 25,
    pts: 1500,
    color: '#ef233c',
    bellyColor: '#ffd166',
    isBoss: true,
  },
};

// Weapons the player can unlock / upgrade on level-up. `next(l)` describes what
// reaching level `l` gives (shown on the upgrade card).
const WEAPON_DEFS = {
  wand: {
    name: 'Peppermint Wand',
    icon: '🍭',
    color: '#ff70a6',
    blurb: 'Fires sugar darts at the nearest enemy.',
    next: (l) => {
      const cnt = (v) => Math.min(4, 1 + Math.floor((v - 1) / 2));
      let t = '+6 damage, faster fire';
      if (cnt(l) > cnt(l - 1)) t += ', +1 dart';
      if (l === 3 || l === 6) t += ', +1 pierce';
      return t;
    },
  },
  orbit: {
    name: 'Bubblegum Orbit',
    icon: '🫧',
    color: '#ff2d95',
    blurb: 'Gum orbs circle you and smash anything close.',
    next: (l) => {
      const cnt = (v) => Math.min(5, 2 + Math.floor((v - 1) / 2));
      return '+5 damage' + (cnt(l) > cnt(l - 1) ? ', +1 orb' : '');
    },
  },
  grenade: {
    name: 'Pop-Rock Grenade',
    icon: '💥',
    color: '#ffd166',
    blurb: 'Lobs a popping rock that explodes in an area.',
    next: () => '+12 damage, bigger blast, faster lobs',
  },
  laser: {
    name: 'Licorice Laser',
    icon: '🔦',
    color: '#c77dff',
    blurb: 'Fires a piercing beam through whole lines of enemies.',
    next: (l) => '+10 damage, faster' + (l === 4 || l === 7 ? ', +1 beam' : ''),
  },
  sword: {
    name: 'Candy Cane Sword',
    icon: '🗡️',
    color: '#ff5d73',
    blurb: 'Slashes a wide arc at close range. Knocks enemies back.',
    next: (l) => '+9 damage, +6 reach' + (l === 5 ? ', FULL 360° SPIN!' : ''),
  },
  zap: {
    name: 'Sherbet Zap',
    icon: '⚡',
    color: '#5ce1ff',
    blurb: 'Chain lightning that leaps between enemies.',
    next: (l) => {
      const jumps = (v) => 2 + Math.floor(v / 2);
      let t = '+7 damage';
      if (jumps(l) > jumps(l - 1)) t += ', +1 chain';
      if (l === 4 || l === 7) t += ', +1 bolt';
      return t;
    },
  },
};

const PASSIVE_DEFS = {
  might:    { name: 'Sugar Rush',        icon: '🔥', color: '#ff8a3d', max: 5, blurb: '+15% damage with all weapons.' },
  haste:    { name: 'Fizzy Haste',       icon: '⏱️', color: '#3dffa2', max: 5, blurb: 'Weapons recharge 8% faster.' },
  boots:    { name: 'Jelly Boots',       icon: '👟', color: '#4cc9f0', max: 4, blurb: '+10% movement speed.' },
  magnet:   { name: 'Gem Magnet',        icon: '🧲', color: '#c9b6ff', max: 4, blurb: '+40% gem pickup range.' },
  vitality: { name: 'Gummy Vitality',    icon: '❤️', color: '#ff4d6d', max: 5, blurb: '+20 max HP and heal 20.' },
  armor:    { name: 'Jawbreaker Armor',  icon: '🛡️', color: '#90e0ef', max: 4, blurb: 'Take 10% less damage.' },
};

export class BeanSurvivors extends Game {
  static meta = {
    id: 'bean-survivors',
    title: 'Bean Survivors',
    icon: '🧄',
    hint: 'DRAG to move · WEAPONS AUTO-FIRE · LEVEL UP to pick new weapons & slay the Gummy Behemoth!',
    baseLikes: 5890,
    isPrestige: true,
    roundLen: 60,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    // Prestige difficulty scalers (+25% base difficulty on top)
    this.pLevel = Math.max(1, this.prestige || 1);
    this.swarmSpeedScale = this.scaleStat(1.0, 0.08) * SPEED_DIFFICULTY; // +8% enemy speed per prestige
    this.swarmHpScale = this.scaleStat(1.0, 0.20) * DIFFICULTY;          // +20% enemy HP per prestige
    this.swarmDmgScale = DIFFICULTY;
    this.bossMaxHp = Math.round(this.scaleStat(450, 0.35) * DIFFICULTY);

    // Player Hero Bean
    this.player = {
      x: this.W / 2,
      y: (Game.SAFE_TOP + Game.SAFE_BOTTOM) / 2,
      r: 16,
      vx: 0,
      vy: 0,
      speed: BASE_PLAYER_SPEED,
      hp: 100,
      maxHp: 100,
      hurtTimer: 0,
      facing: 1,
      magnetRadius: BASE_MAGNET,
    };

    // XP & Evolution Level
    this.level = 1;
    this.xp = 0;
    this.xpNext = 70;
    this.killCount = 0;

    // Loadout: start with just the Peppermint Wand, everything else is chosen on level-up
    this.weapons = { wand: this.makeWeapon('wand', 1) };
    this.passives = {};
    this.dmgMult = 1;
    this.cdMult = 1;
    this.armorMult = 1;

    // Level-up choice menu state (game is frozen while this is set)
    this.choosing = null;
    this.pendingLevels = 0;
    this.freezeTimer = false;

    // Entities
    this.enemies = [];
    this.projectiles = [];
    this.gems = [];
    this.popRocks = [];
    this.beams = [];
    this.slashes = [];
    this.bolts = [];
    this.nextEnemyId = 1;

    // Boss State
    this.bossSpawned = false;
    this.boss = null;
    this.bossAlertTimer = 0;

    // Spawning pacing
    this.spawnTimer = 0.5;
    this.waveTime = 0;

    if (saved) {
      if (Number.isFinite(saved.level)) this.level = saved.level;
      if (saved.wl && typeof saved.wl === 'object') {
        for (const id of Object.keys(saved.wl)) {
          if (WEAPON_DEFS[id]) this.weapons[id] = this.makeWeapon(id, clamp(Number(saved.wl[id]) || 1, 1, MAX_WEAPON_LEVEL));
        }
      }
      if (saved.pl && typeof saved.pl === 'object') {
        for (const id of Object.keys(saved.pl)) {
          if (PASSIVE_DEFS[id]) this.passives[id] = clamp(Number(saved.pl[id]) || 0, 0, PASSIVE_DEFS[id].max);
        }
      }
      this.applyPassives();
      if (Number.isFinite(saved.hp)) this.player.hp = clamp(saved.hp, 20, this.player.maxHp);
      this.grace = 1.5;
    } else {
      this.grace = 0.8;
    }
  }

  /* ----------------------------------------------------------- LOADOUT HELPERS */
  makeWeapon(id, level = 1) {
    switch (id) {
      case 'wand':    return { level, timer: 0, cooldown: 0.65, projectiles: 1, damage: 22, speed: 460 };
      case 'orbit':   return { level, angle: 0, speed: 2.8, radius: 62, count: 2, damage: 16, hitCooldowns: new Map() };
      case 'grenade': return { level, timer: 1.0, cooldown: 2.2, damage: 45, radius: 65 };
      case 'laser':   return { level, timer: 0.8, cooldown: 2.4, damage: 30, width: 12 };
      case 'sword':   return { level, timer: 0.4, cooldown: 1.1, damage: 28, reach: 70 };
      case 'zap':     return { level, timer: 0.6, cooldown: 1.5, damage: 20, range: 280 };
      default:        return { level };
    }
  }

  // Recompute all stats derived from passive upgrades
  applyPassives() {
    const ps = this.passives;
    const p = this.player;
    this.dmgMult = 1 + 0.15 * (ps.might || 0);
    this.cdMult = Math.max(0.5, 1 - 0.08 * (ps.haste || 0));
    this.armorMult = 1 - 0.10 * (ps.armor || 0);
    p.speed = BASE_PLAYER_SPEED * (1 + 0.10 * (ps.boots || 0));
    p.magnetRadius = BASE_MAGNET * (1 + 0.40 * (ps.magnet || 0));
    p.maxHp = 100 + 20 * (ps.vitality || 0);
  }

  // Scale base damage by the Sugar Rush passive
  dealt(base) {
    return Math.round(base * this.dmgMult);
  }

  /* ----------------------------------------------------------- MAIN UPDATE */
  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }

    // Level-up menu: the whole simulation (and the round timer) is paused
    this.freezeTimer = !!this.choosing;
    if (this.choosing) {
      this.fx.update(dt);
      this.updateChoosing(dt);
      return;
    }

    this.waveTime += dt;
    this.fx.update(dt);
    const p = this.player;

    if (p.hurtTimer > 0) p.hurtTimer -= dt;
    if (this.bossAlertTimer > 0) this.bossAlertTimer -= dt;

    // 1. Player Movement & Safe-Zone Clamping
    const stick = this.input.vec(55);
    const keyVec = this.input.keyVec();
    let mx = stick.x;
    let my = stick.y;

    if (keyVec) {
      mx = keyVec.x;
      my = keyVec.y;
    }

    if (Math.abs(mx) > 0.05) p.facing = Math.sign(mx);

    p.vx = mx * p.speed;
    p.vy = my * p.speed;
    p.x = clamp(p.x + p.vx * dt, 24, this.W - 24);
    p.y = clamp(p.y + p.vy * dt, Game.SAFE_TOP + 28, Game.SAFE_BOTTOM - 28);

    // 2. Weapons Simulation
    this.updateWeapons(dt);

    // 3. Enemy Spawner & Boss Director
    this.updateSpawner(dt);

    // 4. Enemy Movement & Swarm Collision
    this.updateEnemies(dt);

    // 5. Projectiles & Explosions
    this.updateProjectiles(dt);

    // 6. Sugar Gems & Magnetic Pickup
    this.updateGems(dt);

    // 7. Weapon visual effects (beams, slashes, lightning)
    this.updateEffects(dt);
  }

  /* ----------------------------------------------------------- WEAPONS */
  updateWeapons(dt) {
    const p = this.player;
    const cd = this.cdMult;

    // 1. Peppermint Wand (Closest Enemy Targeting)
    const wand = this.weapons.wand;
    if (wand) {
      wand.timer -= dt;
      if (wand.timer <= 0 && this.enemies.length > 0) {
        const target = this.findClosestEnemy(p.x, p.y);
        if (target) {
          wand.timer = Math.max(0.16, Math.max(0.28, wand.cooldown - (wand.level - 1) * 0.08) * cd);
          const count = Math.min(4, wand.projectiles + Math.floor((wand.level - 1) / 2));
          const baseAngle = Math.atan2(target.y - p.y, target.x - p.x);
          const pierce = 1 + (wand.level >= 3 ? 1 : 0) + (wand.level >= 6 ? 1 : 0);

          for (let i = 0; i < count; i++) {
            const spread = (i - (count - 1) / 2) * 0.18;
            const ang = baseAngle + spread;
            this.projectiles.push({
              type: 'dart',
              x: p.x,
              y: p.y,
              vx: Math.cos(ang) * wand.speed,
              vy: Math.sin(ang) * wand.speed,
              damage: this.dealt(wand.damage + (wand.level - 1) * 6),
              life: 1.1,
              r: 6,
              pierce,
            });
          }
          this.sounds.pop?.() || this.sounds.slice?.();
        }
      }
    }

    // 2. Bubblegum Orbit Shield
    const orbit = this.weapons.orbit;
    if (orbit) {
      orbit.angle = (orbit.angle + orbit.speed * dt) % TAU;
      const curOrbitCount = Math.min(5, orbit.count + Math.floor((orbit.level - 1) / 2));

      // Decay hit cooldowns
      for (const [id, timer] of orbit.hitCooldowns.entries()) {
        if (timer - dt <= 0) orbit.hitCooldowns.delete(id);
        else orbit.hitCooldowns.set(id, timer - dt);
      }

      // Check orbit collision with enemies
      for (let i = 0; i < curOrbitCount; i++) {
        const orbAng = orbit.angle + (i / curOrbitCount) * TAU;
        const orbX = p.x + Math.cos(orbAng) * orbit.radius;
        const orbY = p.y + Math.sin(orbAng) * orbit.radius;

        for (const e of this.enemies) {
          if (e.dead || orbit.hitCooldowns.has(e.id)) continue;
          const dist = Math.hypot(e.x - orbX, e.y - orbY);
          if (dist < e.r + 10) {
            orbit.hitCooldowns.set(e.id, 0.35);
            this.damageEnemy(e, this.dealt(orbit.damage + (orbit.level - 1) * 5), orbX, orbY);
            this.haptics.light();
          }
        }
      }
    }

    // 3. Pop-Rock Grenade
    const gren = this.weapons.grenade;
    if (gren) {
      gren.timer -= dt;
      if (gren.timer <= 0 && this.enemies.length > 0) {
        gren.timer = Math.max(0.7, Math.max(1.1, gren.cooldown - (gren.level - 1) * 0.2) * cd);
        // Pick random enemy as target cluster
        const target = this.enemies[Math.floor(Math.random() * this.enemies.length)];
        if (target) {
          this.popRocks.push({
            x: p.x,
            y: p.y,
            tx: target.x,
            ty: target.y,
            t: 0,
            dur: 0.65,
            damage: this.dealt(gren.damage + (gren.level - 1) * 12),
            radius: gren.radius + (gren.level - 1) * 6,
          });
        }
      }
    }

    // 4. Licorice Laser (piercing beams along the line to the nearest enemies)
    const las = this.weapons.laser;
    if (las) {
      las.timer -= dt;
      if (las.timer <= 0 && this.enemies.length > 0) {
        las.timer = Math.max(0.6, Math.max(0.9, las.cooldown - (las.level - 1) * 0.18) * cd);
        const beamCount = 1 + (las.level >= 4 ? 1 : 0) + (las.level >= 7 ? 1 : 0);
        const targets = this.nearestEnemies(p.x, p.y, beamCount);
        const dmg = this.dealt(las.damage + (las.level - 1) * 10);
        const width = las.width + las.level * 1.5;
        const len = 560;

        for (const t of targets) {
          const ang = Math.atan2(t.y - p.y, t.x - p.x);
          const ex = p.x + Math.cos(ang) * len;
          const ey = p.y + Math.sin(ang) * len;
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (segDist(e.x, e.y, p.x, p.y, ex, ey) <= e.r + width / 2) {
              this.damageEnemy(e, dmg, e.x, e.y);
            }
          }
          this.beams.push({ x1: p.x, y1: p.y, x2: ex, y2: ey, width, t: 0, dur: 0.2 });
        }
        if (targets.length) {
          this.sounds.laser?.() || this.sounds.pop?.();
          this.haptics.light();
        }
      }
    }

    // 5. Candy Cane Sword (melee arc, 360° spin at level 5+)
    const sw = this.weapons.sword;
    if (sw) {
      sw.timer -= dt;
      if (sw.timer <= 0 && this.enemies.length > 0) {
        const reach = sw.reach + (sw.level - 1) * 6;
        const tgt = this.findClosestEnemy(p.x, p.y);
        if (tgt && Math.hypot(tgt.x - p.x, tgt.y - p.y) < reach + tgt.r + 70) {
          sw.timer = Math.max(0.35, Math.max(0.45, sw.cooldown - (sw.level - 1) * 0.07) * cd);
          const full = sw.level >= 5;
          const aim = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          const arc = full ? TAU : Math.PI * 0.8;
          const dmg = this.dealt(sw.damage + (sw.level - 1) * 9);

          for (const e of this.enemies) {
            if (e.dead) continue;
            const dx = e.x - p.x;
            const dy = e.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > reach + e.r) continue;
            if (!full && angleDiff(Math.atan2(dy, dx), aim) > arc / 2) continue;
            this.damageEnemy(e, dmg, e.x, e.y);
            if (!e.isBoss) {
              e.x += (dx / d) * 16;
              e.y += (dy / d) * 16;
            }
          }
          this.slashes.push({ x: p.x, y: p.y, ang: aim, arc, reach, t: 0, dur: 0.22 });
          this.sounds.pop?.();
          this.haptics.light();
        }
      }
    }

    // 6. Sherbet Zap (chain lightning)
    const zap = this.weapons.zap;
    if (zap) {
      zap.timer -= dt;
      if (zap.timer <= 0 && this.enemies.length > 0) {
        const bolts = 1 + Math.floor((zap.level - 1) / 3);
        const range = zap.range + zap.level * 10;
        const firsts = this.nearestEnemies(p.x, p.y, bolts, range);
        if (firsts.length) {
          zap.timer = Math.max(0.5, Math.max(0.6, zap.cooldown - (zap.level - 1) * 0.1) * cd);
          const jumps = 2 + Math.floor(zap.level / 2);
          const dmg = this.dealt(zap.damage + (zap.level - 1) * 7);

          for (const first of firsts) {
            const hit = new Set([first.id]);
            const pts = [{ x: p.x, y: p.y - 8 }, { x: first.x, y: first.y }];
            let cur = first;
            this.damageEnemy(first, dmg, first.x, first.y);

            for (let j = 0; j < jumps; j++) {
              let best = null;
              let bd = 130;
              for (const e of this.enemies) {
                if (e.dead || hit.has(e.id)) continue;
                const d = Math.hypot(e.x - cur.x, e.y - cur.y);
                if (d < bd) { bd = d; best = e; }
              }
              if (!best) break;
              hit.add(best.id);
              pts.push({ x: best.x, y: best.y });
              this.damageEnemy(best, dmg, best.x, best.y);
              cur = best;
            }
            this.bolts.push({ pts, t: 0, dur: 0.24 });
          }
          this.sounds.laser?.() || this.sounds.pop?.();
          this.haptics.light();
        }
      }
    }
  }

  // Enemies sorted by distance from (x, y)
  nearestEnemies(x, y, n, maxD = Infinity) {
    const list = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= maxD) list.push({ e, d });
    }
    list.sort((a, b) => a.d - b.d);
    return list.slice(0, n).map((o) => o.e);
  }

  updateEffects(dt) {
    for (const arr of [this.beams, this.slashes, this.bolts]) {
      for (let i = arr.length - 1; i >= 0; i--) {
        arr[i].t += dt;
        if (arr[i].t >= arr[i].dur) arr.splice(i, 1);
      }
    }
  }

  /* ----------------------------------------------------------- SPAWNER */
  updateSpawner(dt) {
    this.spawnTimer -= dt;

    // Boss appearance around 32-35s into the 60s round!
    if (this.waveTime >= 32 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.bossAlertTimer = 2.8;
      this.sounds.gate?.(true) || this.sounds.up?.();
      this.haptics.heavy();
      this.fx.shake(14, 0.5);

      // Clear surrounding small minions for dramatic boss entrance
      this.spawnBoss();
    }

    if (this.spawnTimer <= 0) {
      // Faster, denser swarms as time progresses (+25% overall spawn rate)
      const timeScale = clamp(this.waveTime / 45, 0, 1);
      this.spawnTimer = Math.max(0.14, (0.85 - timeScale * 0.55) / DIFFICULTY);

      // Choose enemy archetype based on round progression
      let type = 'gummyBear';
      const r = Math.random();
      if (this.waveTime > 20 && r < 0.35) {
        type = 'sourBat';
      } else if (this.waveTime > 12 && r < 0.25) {
        type = 'jawbreaker';
      }

      this.spawnEnemy(type);
    }
  }

  spawnEnemy(typeKey) {
    const proto = ENEMY_TYPES[typeKey];
    const side = Math.floor(Math.random() * 4);
    let x, y;

    // Spawn smoothly just outside the safe boundary perimeter
    if (side === 0) { x = rand(20, this.W - 20); y = Game.SAFE_TOP - 20; }
    else if (side === 1) { x = rand(20, this.W - 20); y = Game.SAFE_BOTTOM + 20; }
    else if (side === 2) { x = -20; y = rand(Game.SAFE_TOP, Game.SAFE_BOTTOM); }
    else { x = this.W + 20; y = rand(Game.SAFE_TOP, Game.SAFE_BOTTOM); }

    this.enemies.push({
      id: this.nextEnemyId++,
      type: typeKey,
      x,
      y,
      r: proto.r,
      hp: Math.round(proto.hp * this.swarmHpScale),
      maxHp: Math.round(proto.hp * this.swarmHpScale),
      speed: proto.speed * this.swarmSpeedScale,
      damage: Math.round(proto.damage * this.swarmDmgScale),
      pts: proto.pts,
      color: proto.color,
      bellyColor: proto.bellyColor,
      isBoss: false,
      hurt: 0,
      dead: false,
    });
  }

  spawnBoss() {
    const proto = ENEMY_TYPES.boss;
    const boss = {
      id: this.nextEnemyId++,
      type: 'boss',
      x: this.W / 2,
      y: Game.SAFE_TOP - 50,
      r: proto.r,
      hp: this.bossMaxHp,
      maxHp: this.bossMaxHp,
      speed: proto.speed * this.swarmSpeedScale,
      damage: Math.round(proto.damage * this.swarmDmgScale),
      pts: proto.pts,
      color: proto.color,
      bellyColor: proto.bellyColor,
      isBoss: true,
      hurt: 0,
      dead: false,
    };
    this.boss = boss;
    this.enemies.push(boss);
  }

  /* ----------------------------------------------------------- ENEMIES */
  updateEnemies(dt) {
    const p = this.player;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (e.hurt > 0) e.hurt -= dt;

      // Homing movement towards hero bean
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;

      // Avoidance between nearby enemies
      for (let j = 0; j < Math.min(this.enemies.length, 12); j++) {
        const o = this.enemies[j];
        if (o === e || o.dead) continue;
        const sepX = e.x - o.x;
        const sepY = e.y - o.y;
        const sepD = Math.hypot(sepX, sepY);
        if (sepD < e.r + o.r && sepD > 0.1) {
          e.x += (sepX / sepD) * 35 * dt;
          e.y += (sepY / sepD) * 35 * dt;
        }
      }

      // Damage player on contact (Jawbreaker Armor reduces it)
      if (d < e.r + p.r && p.hurtTimer <= 0 && this.grace <= 0) {
        p.hp = Math.max(0, p.hp - Math.max(1, Math.round(e.damage * this.armorMult)));
        p.hurtTimer = 0.55;
        this.sounds.hit?.();
        this.haptics.heavy();
        this.fx.shake(9, 0.25);
        this.fx.burst(p.x, p.y, '#ef233c', 12, 160, 0.4, 4);

        if (p.hp <= 0) {
          this.die('Swarmed by gummy monsters! 💀');
          return;
        }
      }
    }
  }

  /* ----------------------------------------------------------- PROJECTILES */
  updateProjectiles(dt) {
    // 1. Darts
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      // Test collision against enemies
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - pr.x, e.y - pr.y);
        if (d < e.r + pr.r) {
          this.damageEnemy(e, pr.damage, pr.x, pr.y);
          pr.pierce--;
          break;
        }
      }

      if (pr.pierce <= 0 || pr.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // 2. Pop-Rock Lobbed Grenades
    for (let i = this.popRocks.length - 1; i >= 0; i--) {
      const g = this.popRocks[i];
      g.t += dt;
      const k = clamp(g.t / g.dur, 0, 1);

      if (k >= 1) {
        // Detonate in AoE
        this.sounds.hit?.();
        this.haptics.medium();
        this.fx.shake(8, 0.25);
        this.fx.ring(g.tx, g.ty, '#ffd166', g.radius * 2, 0.45, 6);
        this.fx.burst(g.tx, g.ty, '#ff70a6', 22, 220, 0.6, 5);

        for (const e of this.enemies) {
          if (e.dead) continue;
          const dist = Math.hypot(e.x - g.tx, e.y - g.ty);
          if (dist <= g.radius + e.r) {
            this.damageEnemy(e, g.damage, g.tx, g.ty);
          }
        }
        this.popRocks.splice(i, 1);
      }
    }
  }

  damageEnemy(e, dmg, hitX, hitY) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hurt = 0.15;
    this.fx.burst(hitX, hitY, '#ffffff', 4, 110, 0.25, 2.5);

    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.killCount++;
      this.score += e.pts;

      this.fx.burst(e.x, e.y, e.color, e.isBoss ? 55 : 14, e.isBoss ? 320 : 160, 0.6, e.isBoss ? 6 : 3.5);

      // Boss Victory Milestone!
      if (e.isBoss) {
        this.sounds.survive?.();
        this.haptics.success();
        this.fx.ring(this.W / 2, (Game.SAFE_TOP + Game.SAFE_BOTTOM) / 2, '#ffd166', 360, 1.2, 8);
        this.complete('Gummy Behemoth Slain! 👑');
        return;
      }

      // Drop sugar gem
      this.gems.push({
        x: e.x,
        y: e.y,
        r: 6,
        xpVal: e.pts,
        color: e.pts > 50 ? '#ffd166' : '#3dffa2',
        magnet: false,
      });
    }
  }

  /* ----------------------------------------------------------- GEMS & XP */
  updateGems(dt) {
    const p = this.player;

    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dist = Math.hypot(p.x - g.x, p.y - g.y);

      if (dist < p.magnetRadius) g.magnet = true;

      if (g.magnet) {
        const spd = 360;
        g.x += ((p.x - g.x) / (dist || 1)) * spd * dt;
        g.y += ((p.y - g.y) / (dist || 1)) * spd * dt;

        if (dist < p.r + g.r) {
          this.gems.splice(i, 1);
          this.gainXp(g.xpVal);
        }
      }
    }
  }

  gainXp(amount) {
    this.xp += amount;
    this.sounds.pop?.();

    // Possibly several levels at once; each one queues a choice screen
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(this.xpNext * 1.42);
      this.pendingLevels++;
    }

    if (!this.choosing && this.pendingLevels > 0) {
      this.pendingLevels--;
      this.openChoice();
    }
  }

  /* ----------------------------------------------------------- LEVEL-UP CHOICE MENU */
  // Build up to 3 distinct random options: new weapons, weapon upgrades, passives
  rollOptions() {
    const pool = [];
    for (const id of Object.keys(WEAPON_DEFS)) {
      const lvl = this.weapons[id] ? this.weapons[id].level : 0;
      if (lvl < MAX_WEAPON_LEVEL) pool.push({ kind: 'weapon', id, from: lvl, w: lvl === 0 ? 1.7 : 1.0 });
    }
    for (const id of Object.keys(PASSIVE_DEFS)) {
      const lvl = this.passives[id] || 0;
      if (lvl < PASSIVE_DEFS[id].max) pool.push({ kind: 'passive', id, from: lvl, w: 0.8 });
    }
    pool.push({ kind: 'heal', id: 'heal', from: 0, w: 0.35 });

    const picks = [];
    while (picks.length < 3 && pool.length > 0) {
      const total = pool.reduce((s, o) => s + o.w, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length - 1; idx++) {
        r -= pool[idx].w;
        if (r <= 0) break;
      }
      picks.push(pool.splice(idx, 1)[0]);
    }
    return picks;
  }

  layoutCards(n) {
    const cardW = this.W - 60;
    const cardH = 118;
    const gap = 14;
    const total = n * cardH + (n - 1) * gap;
    const startY = (Game.SAFE_TOP + Game.SAFE_BOTTOM) / 2 - total / 2 + 24;
    const rects = [];
    for (let i = 0; i < n; i++) {
      rects.push({ x: 30, y: startY + i * (cardH + gap), w: cardW, h: cardH });
    }
    return rects;
  }

  openChoice() {
    const options = this.rollOptions();
    // Keyboard nav uses arrows + Enter/Space (digits are reserved by the engine's game-jump shortcut)
    const keyHeld = {};
    for (const k of ['arrowup', 'arrowdown', 'enter', ' ']) keyHeld[k] = this.input.key(k);
    this.choosing = {
      options,
      rects: this.layoutCards(options.length),
      t: 0,
      hover: -1,
      sel: 0,
      px: this.input.x,
      py: this.input.y,
      keyHeld,
    };
    this.sounds.up?.();
    this.haptics.medium();
  }

  updateChoosing(dt) {
    const c = this.choosing;
    c.t += dt;

    // Which card is under the pointer / finger
    const { x, y } = this.input;
    c.hover = -1;
    c.rects.forEach((r, i) => {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) c.hover = i;
    });
    // Moving the mouse over a card moves the keyboard focus there too
    if ((x !== c.px || y !== c.py) && c.hover >= 0) c.sel = c.hover;
    c.px = x;
    c.py = y;

    // Edge-detect keyboard presses
    const edge = {};
    for (const k of ['arrowup', 'arrowdown', 'enter', ' ']) {
      const down = this.input.key(k);
      edge[k] = down && !c.keyHeld[k];
      c.keyHeld[k] = down;
    }

    // Short lockout so a drag in progress can't instantly pick a card by accident
    if (c.t < 0.4) return;

    const n = c.options.length;
    if (edge.arrowup) c.sel = (c.sel + n - 1) % n;
    if (edge.arrowdown) c.sel = (c.sel + 1) % n;

    let pick = -1;
    if (this.input.pressed && c.hover >= 0) pick = c.hover;
    else if (edge.enter || edge[' ']) pick = c.sel;

    if (pick >= 0) this.applyChoice(c.options[pick]);
  }

  applyChoice(opt) {
    const p = this.player;
    const info = this.describeOption(opt);
    let label = info.name;

    if (opt.kind === 'weapon') {
      if (this.weapons[opt.id]) {
        this.weapons[opt.id].level++;
        label = `${info.name} LV ${this.weapons[opt.id].level}`;
      } else {
        this.weapons[opt.id] = this.makeWeapon(opt.id, 1);
        label = `${info.name} UNLOCKED!`;
      }
    } else if (opt.kind === 'passive') {
      this.passives[opt.id] = (this.passives[opt.id] || 0) + 1;
      this.applyPassives();
      if (opt.id === 'vitality') p.hp = Math.min(p.maxHp, p.hp + 20);
      label = `${info.name} LV ${this.passives[opt.id]}`;
    } else {
      p.hp = Math.min(p.maxHp, p.hp + 40);
      label = '+40 HP';
    }

    // Small heal on every level-up
    p.hp = Math.min(p.maxHp, p.hp + 15);

    this.sounds.up?.();
    this.haptics.medium();
    this.fx.text(p.x, p.y - 35, `${info.icon} ${label}`, info.color, 20, 1.3);
    this.fx.ring(p.x, p.y, info.color, 160, 0.5, 4);

    this.choosing = null;
    if (this.pendingLevels > 0) {
      this.pendingLevels--;
      this.openChoice();
    }
  }

  describeOption(opt) {
    if (opt.kind === 'weapon') {
      const d = WEAPON_DEFS[opt.id];
      return {
        icon: d.icon,
        name: d.name,
        color: d.color,
        tag: opt.from === 0 ? 'NEW WEAPON!' : `LEVEL ${opt.from} → ${opt.from + 1}`,
        isNew: opt.from === 0,
        desc: opt.from === 0 ? d.blurb : d.next(opt.from + 1),
      };
    }
    if (opt.kind === 'passive') {
      const d = PASSIVE_DEFS[opt.id];
      return {
        icon: d.icon,
        name: d.name,
        color: d.color,
        tag: opt.from === 0 ? 'NEW PASSIVE' : `LEVEL ${opt.from} → ${opt.from + 1}`,
        isNew: opt.from === 0,
        desc: d.blurb,
      };
    }
    return { icon: '🍬', name: 'Sugar Snack', color: '#3dffa2', tag: 'HEAL', isNew: false, desc: 'Instantly restore 40 HP.' };
  }

  findClosestEnemy(x, y) {
    let closest = null;
    let minDist = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < minDist) {
        minDist = d;
        closest = e;
      }
    }
    return closest;
  }

  /* ----------------------------------------------------------- RENDER */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const shake = this.fx.offset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Dark Confectionery Dungeon Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f0a1c');
    bg.addColorStop(0.5, '#1b122f');
    bg.addColorStop(1, '#0b0816');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle arena floor grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let y = Game.SAFE_TOP; y <= Game.SAFE_BOTTOM; y += 40) {
      ctx.beginPath();
      ctx.moveTo(15, y);
      ctx.lineTo(W - 15, y);
      ctx.stroke();
    }
    for (let x = 20; x <= W - 20; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, Game.SAFE_TOP);
      ctx.lineTo(x, Game.SAFE_BOTTOM);
      ctx.stroke();
    }

    // 2. Sugar Gems
    for (const g of this.gems) {
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // 3. Enemies
    for (const e of this.enemies) {
      const col = e.hurt > 0 ? '#ffffff' : e.color;
      ctx.fillStyle = col;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = e.isBoss ? 3.5 : 2.2;

      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Cute/Scary monster eyes
      ctx.fillStyle = '#ffffff';
      const eyeDx = (this.player.x - e.x) > 0 ? 3 : -3;
      ctx.beginPath();
      ctx.arc(e.x - e.r * 0.35 + eyeDx, e.y - e.r * 0.2, e.r * 0.22, 0, TAU);
      ctx.arc(e.x + e.r * 0.35 + eyeDx, e.y - e.r * 0.2, e.r * 0.22, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(e.x - e.r * 0.35 + eyeDx * 1.5, e.y - e.r * 0.2, e.r * 0.12, 0, TAU);
      ctx.arc(e.x + e.r * 0.35 + eyeDx * 1.5, e.y - e.r * 0.2, e.r * 0.12, 0, TAU);
      ctx.fill();
    }

    // 4. Projectiles (Darts)
    for (const pr of this.projectiles) {
      ctx.fillStyle = '#ff70a6';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // 5. Pop-Rock Lob Arc & Shadows
    for (const rock of this.popRocks) {
      const k = rock.t / rock.dur;
      const arcH = Math.sin(k * Math.PI) * 55;
      const curX = rock.x + (rock.tx - rock.x) * k;
      const curY = rock.y + (rock.ty - rock.y) * k - arcH;

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(rock.x + (rock.tx - rock.x) * k, rock.y + (rock.ty - rock.y) * k, 8, 4, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(curX, curY, 7, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // 6. Bubblegum Orbit Shields
    const orbit = this.weapons.orbit;
    if (orbit) {
      const curOrbitCount = Math.min(5, orbit.count + Math.floor((orbit.level - 1) / 2));
      for (let i = 0; i < curOrbitCount; i++) {
        const orbAng = orbit.angle + (i / curOrbitCount) * TAU;
        const orbX = this.player.x + Math.cos(orbAng) * orbit.radius;
        const orbY = this.player.y + Math.sin(orbAng) * orbit.radius;

        ctx.fillStyle = '#ff007f';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(orbX, orbY, 9, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }

    // 6b. Weapon FX: Licorice Laser beams, Candy Cane slashes, Sherbet lightning
    for (const b of this.beams) {
      const a = 1 - b.t / b.dur;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#c77dff';
      ctx.lineWidth = b.width * (0.6 + 0.4 * a);
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, b.width * 0.35);
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.restore();
    }

    for (const s of this.slashes) {
      const a = 1 - s.t / s.dur;
      const sweep = (s.t / s.dur) * 0.35 + 0.65;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#ff5d73';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.reach * sweep, s.ang - s.arc / 2, s.ang + s.arc / 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.reach * sweep, s.ang - s.arc / 2, s.ang + s.arc / 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const bl of this.bolts) {
      const a = 1 - bl.t / bl.dur;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineJoin = 'round';
      for (const pass of [{ c: '#5ce1ff', w: 5 }, { c: '#ffffff', w: 2 }]) {
        ctx.strokeStyle = pass.c;
        ctx.lineWidth = pass.w;
        ctx.beginPath();
        ctx.moveTo(bl.pts[0].x, bl.pts[0].y);
        for (let i = 1; i < bl.pts.length; i++) {
          const a0 = bl.pts[i - 1];
          const b0 = bl.pts[i];
          const segs = 4;
          for (let s = 1; s <= segs; s++) {
            const k = s / segs;
            const jx = s === segs ? 0 : rand(-7, 7);
            const jy = s === segs ? 0 : rand(-7, 7);
            ctx.lineTo(a0.x + (b0.x - a0.x) * k + jx, a0.y + (b0.y - a0.y) * k + jy);
          }
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 7. Hero Bean Mascot
    const p = this.player;
    const hurtSquash = p.hurtTimer > 0 ? 0.8 : 1.0;
    drawBean(ctx, p.x, p.y, p.r * 1.35, {
      color: p.hurtTimer > 0 ? '#ff4d6d' : '#3dffa2',
      bellyColor: '#b7efc5',
      eyes: this.dead ? 'cross' : p.hurtTimer > 0 ? 'squish' : 'happy',
      hat: this.pLevel > 1 ? 'crown' : null,
      squash: hurtSquash,
    });

    // 8. Player Health Bar (Right beneath the player bean)
    const hpW = 38;
    const hpH = 5;
    const hpRatio = p.hp / p.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(p.x - hpW / 2, p.y + p.r + 6, hpW, hpH);
    ctx.fillStyle = hpRatio > 0.4 ? '#3dffa2' : '#ef233c';
    ctx.fillRect(p.x - hpW / 2, p.y + p.r + 6, hpW * hpRatio, hpH);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(p.x - hpW / 2, p.y + p.r + 6, hpW, hpH);

    // 9. In-Game XP Bar & Level Pill (Drawn just below top safe boundary)
    const xpBarY = Game.SAFE_TOP + 12;
    const xpRatio = clamp(this.xp / this.xpNext, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(25, xpBarY, W - 50, 7);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(25, xpBarY, (W - 50) * xpRatio, 7);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(25, xpBarY, W - 50, 7);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 13px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`LVL ${this.level}`, 25, xpBarY - 4);
    ctx.textAlign = 'right';
    ctx.fillText(`KILLS: ${this.killCount}`, W - 25, xpBarY - 4);

    // 10. Boss Health Bar (When Boss is active)
    if (this.boss && !this.boss.dead) {
      const bRatio = clamp(this.boss.hp / this.bossMaxHp, 0, 1);
      const bBarY = Game.SAFE_TOP + 32;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(40, bBarY, W - 80, 10);
      ctx.fillStyle = '#ef233c';
      ctx.fillRect(40, bBarY, (W - 80) * bRatio, 10);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, bBarY, W - 80, 10);

      ctx.fillStyle = '#ffd166';
      ctx.font = '900 12px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 GUMMY BEHEMOTH 👑', W / 2, bBarY - 4);
    }

    // 11. Boss Alert Flash
    if (this.bossAlertTimer > 0) {
      ctx.fillStyle = `rgba(239, 35, 60, ${0.45 * Math.sin(this.bossAlertTimer * 12)})`;
      ctx.font = '900 24px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ BOSS INCOMING! ⚠️', W / 2, (Game.SAFE_TOP + Game.SAFE_BOTTOM) / 2);
    }

    // 12. Current weapon & passive loadout strip
    this.drawLoadout(ctx);

    this.fx.render(ctx, 1);
    ctx.restore();

    // 13. Level-up choice overlay (drawn un-shaken on top of everything)
    if (this.choosing) this.drawChoice(ctx);
  }

  roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  wrapText(ctx, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Compact row at the bottom of the arena showing owned weapons + passives with levels
  drawLoadout(ctx) {
    const y = Game.SAFE_BOTTOM - 14;
    let x = 24;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const drawItem = (icon, level, color, size) => {
      ctx.font = `${size}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(x, y, size * 0.78, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText(icon, x, y + 1);
      ctx.font = '900 10px Outfit, system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.5;
      ctx.strokeText(String(level), x + size * 0.7, y + size * 0.65);
      ctx.fillText(String(level), x + size * 0.7, y + size * 0.65);
      x += size * 1.85;
    };

    for (const id of Object.keys(this.weapons)) {
      drawItem(WEAPON_DEFS[id].icon, this.weapons[id].level, WEAPON_DEFS[id].color, 16);
    }
    const owned = Object.keys(this.passives).filter((id) => this.passives[id] > 0);
    if (owned.length) {
      x += 8;
      for (const id of owned) {
        drawItem(PASSIVE_DEFS[id].icon, this.passives[id], PASSIVE_DEFS[id].color, 13);
      }
    }
    ctx.restore();
  }

  drawChoice(ctx) {
    const c = this.choosing;
    const { W, H } = this;
    const ready = c.t >= 0.4;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 5, 20, 0.86)';
    ctx.fillRect(0, 0, W, H);

    const top = c.rects[0].y;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffd166';
    ctx.font = '900 30px Outfit, system-ui, sans-serif';
    ctx.fillText('⭐ LEVEL UP! ⭐', W / 2, top - 46);
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '700 13px Outfit, system-ui, sans-serif';
    const more = this.pendingLevels > 0 ? `  (+${this.pendingLevels} more)` : '';
    ctx.fillText(`Level ${this.level} · tap a card (or ↑ ↓ + Enter)${more}`, W / 2, top - 22);

    c.options.forEach((opt, i) => {
      const r = c.rects[i];
      const info = this.describeOption(opt);
      const hot = ready && c.sel === i;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;

      ctx.save();
      ctx.globalAlpha = ready ? 1 : 0.55;
      if (hot) {
        ctx.translate(cx, cy);
        ctx.scale(1.03, 1.03);
        ctx.translate(-cx, -cy);
      }

      // Card body
      this.roundedRect(ctx, r.x, r.y, r.w, r.h, 16);
      ctx.fillStyle = hot ? 'rgba(52, 36, 98, 0.98)' : 'rgba(27, 19, 54, 0.97)';
      ctx.fill();
      ctx.lineWidth = hot ? 4 : 2.5;
      ctx.strokeStyle = info.color;
      ctx.shadowColor = info.color;
      ctx.shadowBlur = hot ? 16 : 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Icon plate
      this.roundedRect(ctx, r.x + 12, cy - 35, 70, 70, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '40px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(info.icon, r.x + 47, cy + 2);

      const tx = r.x + 96;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 18px Outfit, system-ui, sans-serif';
      ctx.fillText(info.name, tx, r.y + 32);

      ctx.fillStyle = info.isNew ? '#ffd166' : info.color;
      ctx.font = '900 11px Outfit, system-ui, sans-serif';
      ctx.fillText(info.tag, tx, r.y + 52);

      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = '600 13px Outfit, system-ui, sans-serif';
      const lines = this.wrapText(ctx, info.desc, r.w - 96 - 16);
      lines.slice(0, 3).forEach((ln, li) => ctx.fillText(ln, tx, r.y + 74 + li * 16));

      ctx.restore();
    });

    ctx.restore();
  }

  /* ----------------------------------------------------------- SERIALIZATION */
  serialize() {
    const wl = {};
    for (const id of Object.keys(this.weapons)) wl[id] = this.weapons[id].level;
    return {
      level: this.level,
      hp: Math.round(this.player.hp),
      killCount: this.killCount,
      wl,
      pl: { ...this.passives },
    };
  }

  restoreLabel() {
    return `Level ${this.level} · ${this.killCount} Kills`;
  }

  destroy() {
    this.enemies = [];
    this.projectiles = [];
    this.gems = [];
    this.popRocks = [];
    this.beams = [];
    this.slashes = [];
    this.bolts = [];
  }
}
