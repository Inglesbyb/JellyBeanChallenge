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
import {
  shadeColor,
  toyRim,
  toyLineW,
  drawToyShadow,
  drawToySphere,
  drawToyBevelRect,
  drawToyPill,
  drawToyEyes,
  traceRoundRect,
} from '../engine/toyStyle.js';

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
    hint: 'DRAG to move · WEAPONS AUTO-FIRE · LEVEL UP to slay the Gummy Behemoth!',
    baseLikes: 5890,
    isPrestige: true,
    parScore60s: 2000,
    roundLen: 60,
    cue: 'MOVE & SURVIVE SWARMS!',
    prestigeCue: 'FASTER SWARMS · TANKIER BOSS!',
    scaling: {
      swarmSpeedMult: { base: 1.0, rate: 0.15, cap: 1.38, mode: 'up',   label: 'Swarm Speed' },
      swarmHpMult:    { base: 1.0, rate: 0.18, cap: 1.85, mode: 'up',   label: 'Swarm HP' },
      bossHpMult:     { base: 1.0, rate: 0.20, cap: 2.00, mode: 'up',   label: 'Boss HP' },
      spawnPaceScale: { base: 1.0, rate: 0.15, floor: 0.70, mode: 'down', label: 'Spawn Pace' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    // SSOT Prestige difficulty scalers (+25% base difficulty on top)
    this.pLevel = Math.max(1, this.prestige || 1);
    this.swarmSpeedScale = (this.diff.swarmSpeedMult ?? 1) * SPEED_DIFFICULTY;
    this.swarmHpScale = (this.diff.swarmHpMult ?? 1) * DIFFICULTY;
    this.swarmDmgScale = DIFFICULTY;
    this.bossMaxHp = Math.round(450 * (this.diff.bossHpMult ?? 1) * DIFFICULTY);

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
      this.spawnTimer = Math.max(0.14, ((0.85 - timeScale * 0.55) / DIFFICULTY) * (this.diff.spawnPaceScale ?? 1));

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

    // 1. Studio Confectionery Diorama Backdrop
    const midY = (Game.SAFE_TOP + Game.SAFE_BOTTOM) * 0.5;
    const bg = ctx.createRadialGradient(W * 0.5, midY, 40, W * 0.5, midY, W * 0.95);
    bg.addColorStop(0, '#241842');
    bg.addColorStop(0.55, '#17102c');
    bg.addColorStop(1, '#0b0816');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle arena floor tile grid
    ctx.strokeStyle = 'rgba(196, 181, 253, 0.055)';
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

    // 2. Faceted 3D Candy Sugar Gems
    for (const g of this.gems) {
      const r = g.r + 1;
      const rim = toyRim(g.color, 0.55);
      const gg = ctx.createLinearGradient(g.x - r, g.y - r, g.x + r, g.y + r);
      gg.addColorStop(0, shadeColor(g.color, 0.5));
      gg.addColorStop(0.5, g.color);
      gg.addColorStop(1, shadeColor(g.color, -0.32));
      ctx.fillStyle = gg;
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - r * 1.15);
      ctx.lineTo(g.x + r * 0.95, g.y);
      ctx.lineTo(g.x, g.y + r * 1.15);
      ctx.lineTo(g.x - r * 0.95, g.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Top crystal facet shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - r * 0.8);
      ctx.lineTo(g.x - r * 0.45, g.y - r * 0.1);
      ctx.lineTo(g.x, g.y);
      ctx.closePath();
      ctx.fill();
    }

    // 3. 3D Vinyl Toy Enemies (Gummy Bears, Sour Bats, Jawbreakers, Behemoth Boss)
    for (const e of this.enemies) {
      const isHurt = e.hurt > 0;
      const col = isHurt ? '#ffffff' : e.color;
      const rim = isHurt ? '#94a3b8' : toyRim(e.color, 0.58);
      const lw = toyLineW(e.r * 2, 0.042, 0.85, 2.3);

      // Soft grounding shadow
      drawToyShadow(ctx, e.x, e.y + e.r * 0.9, e.r * 0.88, e.r * 0.32, 0.3);

      if (e.isBoss) {
        // Boss menacing floor aura ring
        const pulse = 1 + Math.sin(this.waveTime * 5) * 0.08;
        ctx.fillStyle = 'rgba(239, 35, 60, 0.22)';
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + e.r * 0.72, e.r * 1.28 * pulse, e.r * 0.46 * pulse, 0, 0, TAU);
        ctx.fill();
      }

      // Archetype appendages behind torso
      if (e.type === 'gummyBear' || e.isBoss) {
        const earR = e.r * (e.isBoss ? 0.32 : 0.36);
        const earOffX = e.r * 0.64;
        const earOffY = -e.r * 0.66;
        drawToySphere(ctx, e.x - earOffX, e.y + earOffY, earR, col, { rimColor: rim, lineWidth: lw * 0.88, shine: 0.45, bottomBounce: false });
        drawToySphere(ctx, e.x + earOffX, e.y + earOffY, earR, col, { rimColor: rim, lineWidth: lw * 0.88, shine: 0.45, bottomBounce: false });
      } else if (e.type === 'sourBat') {
        const flap = Math.sin(this.waveTime * 15 + e.id) * e.r * 0.42;
        ctx.fillStyle = isHurt ? '#e2e8f0' : shadeColor(col, -0.15);
        ctx.strokeStyle = rim;
        ctx.lineWidth = lw * 0.9;
        ctx.lineJoin = 'round';
        [-1, 1].forEach((side) => {
          ctx.beginPath();
          ctx.moveTo(e.x + side * e.r * 0.55, e.y - e.r * 0.15);
          ctx.quadraticCurveTo(e.x + side * e.r * 1.45, e.y - e.r * 0.95 + flap, e.x + side * e.r * 1.65, e.y + e.r * 0.1 + flap * 0.6);
          ctx.quadraticCurveTo(e.x + side * e.r * 1.1, e.y + e.r * 0.45, e.x + side * e.r * 0.55, e.y + e.r * 0.3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      }

      // Main 3D Vinyl Body Sphere
      drawToySphere(ctx, e.x, e.y, e.r, col, {
        rimColor: rim,
        lineWidth: lw,
        shine: 0.74,
        bottomBounce: true,
      });

      // Archetype surface details
      if (e.type === 'gummyBear') {
        ctx.fillStyle = isHurt ? '#f8fafc' : shadeColor(e.bellyColor, 0.25);
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + e.r * 0.25, e.r * 0.36, e.r * 0.24, 0, 0, TAU);
        ctx.fill();
      } else if (e.type === 'jawbreaker') {
        const spots = ['#ffd166', '#ff70a6', '#ffffff'];
        for (let sp = 0; sp < 4; sp++) {
          const ang = e.id * 1.3 + sp * 1.55;
          ctx.fillStyle = isHurt ? '#e2e8f0' : spots[sp % spots.length];
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(ang) * e.r * 0.5, e.y + Math.sin(ang) * e.r * 0.45 + e.r * 0.12, e.r * 0.12, 0, TAU);
          ctx.fill();
        }
      } else if (e.isBoss) {
        ctx.fillStyle = isHurt ? '#f8fafc' : 'rgba(255, 209, 102, 0.36)';
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + e.r * 0.34, e.r * 0.5, e.r * 0.36, 0, 0, TAU);
        ctx.fill();

        // Boss Golden Crown
        const crY = e.y - e.r * 0.92;
        const crW = e.r * 0.55;
        const cg = ctx.createLinearGradient(e.x - crW, crY - 14, e.x + crW, crY + 6);
        cg.addColorStop(0, '#fff3b0');
        cg.addColorStop(0.5, '#ffd166');
        cg.addColorStop(1, '#d97706');
        ctx.fillStyle = cg;
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(e.x - crW, crY + 4);
        ctx.lineTo(e.x - crW * 1.05, crY - 12);
        ctx.lineTo(e.x - crW * 0.4, crY - 4);
        ctx.lineTo(e.x, crY - 16);
        ctx.lineTo(e.x + crW * 0.4, crY - 4);
        ctx.lineTo(e.x + crW * 1.05, crY - 12);
        ctx.lineTo(e.x + crW, crY + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Expressive Toy Eyes
      const lookX = clamp((this.player.x - e.x) / 90, -0.5, 0.5);
      const lookY = clamp((this.player.y - e.y) / 90, -0.35, 0.35);
      drawToyEyes(ctx, e.x, e.y - e.r * 0.14, Math.max(2.2, e.r * 0.22), {
        spacing: e.r * 0.64,
        style: isHurt ? 'dizzy' : (e.isBoss || e.type === 'jawbreaker') ? 'angry' : 'bright',
        lookX,
        lookY,
        ink: '#0f172a',
      });
    }

    // 4. Projectiles (3D Candy Darts)
    for (const pr of this.projectiles) {
      drawToySphere(ctx, pr.x, pr.y, pr.r, '#ff70a6', {
        rimColor: toyRim('#ff70a6', 0.56),
        lineWidth: 1.2,
        shine: 0.8,
        bottomBounce: false,
      });
    }

    // 5. Pop-Rock Lob Arc, Target Ring & Shadows
    for (const rock of this.popRocks) {
      const k = rock.t / rock.dur;
      const arcH = Math.sin(k * Math.PI) * 55;
      const curX = rock.x + (rock.tx - rock.x) * k;
      const curY = rock.y + (rock.ty - rock.y) * k - arcH;

      // Subtle blast preview ring
      ctx.strokeStyle = `rgba(255, 209, 102, ${0.22 + k * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rock.tx, rock.ty, rock.radius * (0.4 + k * 0.6), 0, TAU);
      ctx.stroke();

      drawToyShadow(ctx, rock.x + (rock.tx - rock.x) * k, rock.y + (rock.ty - rock.y) * k, 8, 4, 0.28);
      drawToySphere(ctx, curX, curY, 7.5, '#ffd166', {
        rimColor: '#92400e',
        lineWidth: 1.3,
        shine: 0.8,
      });
    }

    // 6. Bubblegum Orbit Shields
    const orbit = this.weapons.orbit;
    if (orbit) {
      const curOrbitCount = Math.min(5, orbit.count + Math.floor((orbit.level - 1) / 2));
      for (let i = 0; i < curOrbitCount; i++) {
        const orbAng = orbit.angle + (i / curOrbitCount) * TAU;
        const orbX = this.player.x + Math.cos(orbAng) * orbit.radius;
        const orbY = this.player.y + Math.sin(orbAng) * orbit.radius;

        drawToySphere(ctx, orbX, orbY, 9.5, '#ff2d95', {
          rimColor: toyRim('#ff2d95', 0.52),
          lineWidth: 1.5,
          shine: 0.85,
        });
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

    // 7. Hero Bean Mascot & Grounding Shadow
    const p = this.player;
    const hurtSquash = p.hurtTimer > 0 ? 0.8 : 1.0;
    const isMoving = Math.hypot(p.vx, p.vy) > 10;
    drawToyShadow(ctx, p.x, p.y + p.r * 1.12, p.r * 0.95, p.r * 0.36, 0.32);
    drawBean(ctx, p.x, p.y, p.r * 1.35, {
      color: p.hurtTimer > 0 ? '#ff4d6d' : '#3dffa2',
      bellyColor: '#b7efc5',
      dir: p.facing || 1,
      walkT: isMoving ? this.waveTime * 1.6 : 0,
      eyes: this.dead ? 'squish' : p.hurtTimer > 0 ? 'squish' : 'happy',
      hat: this.pLevel > 1 ? 'crown' : null,
      squash: hurtSquash,
      dead: !!this.dead,
    });

    // 8. Player Health Pill Bar (Right beneath the player bean)
    const hpW = 40;
    const hpH = 6;
    const hpX = p.x - hpW / 2;
    const hpY = p.y + p.r + 6;
    const hpRatio = clamp(p.hp / p.maxHp, 0, 1);

    ctx.fillStyle = '#0f172a';
    traceRoundRect(ctx, hpX - 1.5, hpY - 1.5, hpW + 3, hpH + 3, 4);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (hpRatio > 0) {
      const hpCol = hpRatio > 0.4 ? '#3dffa2' : '#ef233c';
      const hg = ctx.createLinearGradient(hpX, hpY, hpX, hpY + hpH);
      hg.addColorStop(0, shadeColor(hpCol, 0.35));
      hg.addColorStop(1, shadeColor(hpCol, -0.15));
      ctx.fillStyle = hg;
      traceRoundRect(ctx, hpX, hpY, Math.max(3, hpW * hpRatio), hpH, 3);
      ctx.fill();
    }

    // 9. In-Game XP Bar & Level Pill (Drawn just below top safe boundary)
    const xpBarY = Game.SAFE_TOP + 15;
    const xpRatio = clamp(this.xp / this.xpNext, 0, 1);
    drawToyBevelRect(ctx, 25, xpBarY, W - 50, 9, 4.5, '#0f172a', {
      depth: 2,
      rimColor: '#475569',
      lineWidth: 1.4,
      gloss: false,
    });
    if (xpRatio > 0) {
      const fillW = Math.max(8, (W - 50) * xpRatio);
      const xg = ctx.createLinearGradient(25, 0, 25 + fillW, 0);
      xg.addColorStop(0, '#38bdf8');
      xg.addColorStop(1, '#3dffa2');
      ctx.fillStyle = xg;
      traceRoundRect(ctx, 25, xpBarY, fillW, 9, 4.5);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      traceRoundRect(ctx, 27, xpBarY + 1.5, Math.max(2, fillW - 4), 2.5, 1.5);
      ctx.fill();
    }

    ctx.font = "700 13px 'Fredoka', 'Outfit', sans-serif";
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.textAlign = 'left';
    ctx.strokeText(`LVL ${this.level}`, 25, xpBarY - 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`LVL ${this.level}`, 25, xpBarY - 5);

    ctx.textAlign = 'right';
    ctx.strokeText(`KILLS: ${this.killCount}`, W - 25, xpBarY - 5);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`KILLS: ${this.killCount}`, W - 25, xpBarY - 5);

    // 10. Boss Health Bar (When Boss is active)
    if (this.boss && !this.boss.dead) {
      const bRatio = clamp(this.boss.hp / this.bossMaxHp, 0, 1);
      const bBarY = Game.SAFE_TOP + 40;
      drawToyBevelRect(ctx, 38, bBarY, W - 76, 12, 6, '#0f172a', {
        depth: 2.5,
        rimColor: '#ffd166',
        lineWidth: 1.8,
        gloss: false,
      });
      if (bRatio > 0) {
        const bw = Math.max(10, (W - 76) * bRatio);
        const bgGrad = ctx.createLinearGradient(38, bBarY, 38 + bw, bBarY + 12);
        bgGrad.addColorStop(0, '#ff4d6d');
        bgGrad.addColorStop(1, '#dc2626');
        ctx.fillStyle = bgGrad;
        traceRoundRect(ctx, 38, bBarY, bw, 12, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
        traceRoundRect(ctx, 40, bBarY + 1.5, Math.max(2, bw - 4), 3.5, 2);
        ctx.fill();
      }

      ctx.font = "700 12px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeText('👑 GUMMY BEHEMOTH 👑', W / 2, bBarY - 5);
      ctx.fillStyle = '#ffd166';
      ctx.fillText('👑 GUMMY BEHEMOTH 👑', W / 2, bBarY - 5);
    }

    // 11. Boss Alert Banner
    if (this.bossAlertTimer > 0) {
      const pulseA = 0.55 + 0.45 * Math.abs(Math.sin(this.bossAlertTimer * 10));
      ctx.save();
      ctx.globalAlpha = pulseA;
      const alertY = (Game.SAFE_TOP + Game.SAFE_BOTTOM) / 2 - 22;
      drawToyPill(ctx, W / 2 - 140, alertY, 280, 44, '#ef233c', {
        rimColor: '#ffd166',
        lineWidth: 2.2,
        gloss: true,
      });
      ctx.font = "700 20px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3.5;
      ctx.strokeText('⚠️ BOSS INCOMING! ⚠️', W / 2, alertY + 22);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('⚠️ BOSS INCOMING! ⚠️', W / 2, alertY + 22);
      ctx.restore();
    }

    // 12. Current weapon & passive loadout strip
    this.drawLoadout(ctx);

    this.fx.render(ctx, 1);
    ctx.restore();

    // 13. Level-up choice overlay (drawn un-shaken on top of everything)
    if (this.choosing) this.drawChoice(ctx);
  }

  roundedRect(ctx, x, y, w, h, r) {
    traceRoundRect(ctx, x, y, w, h, r);
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
    const y = Game.SAFE_BOTTOM - 16;
    let x = 24;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const drawItem = (icon, level, color, size) => {
      drawToySphere(ctx, x, y, size * 0.82, '#1e293b', {
        rimColor: color,
        lineWidth: 1.8,
        shine: 0.3,
        bottomBounce: false,
      });
      ctx.font = `${size}px 'Fredoka', 'Outfit', sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(icon, x, y + 1);
      ctx.font = "700 10px 'Fredoka', 'Outfit', sans-serif";
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.8;
      ctx.strokeText(String(level), x + size * 0.7, y + size * 0.65);
      ctx.fillStyle = '#ffd166';
      ctx.fillText(String(level), x + size * 0.7, y + size * 0.65);
      x += size * 1.9;
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
    ctx.font = "700 30px 'Fredoka', 'Outfit', sans-serif";
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4.5;
    ctx.strokeText('⭐ LEVEL UP! ⭐', W / 2, top - 46);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('⭐ LEVEL UP! ⭐', W / 2, top - 46);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = "600 13px 'Fredoka', 'Outfit', sans-serif";
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

      // 3D Toy Bevel Upgrade Card
      drawToyBevelRect(ctx, r.x, r.y, r.w, r.h, 16, hot ? '#342462' : '#1b1336', {
        depth: hot ? 5 : 3.5,
        rimColor: info.color,
        lineWidth: hot ? 3 : 2,
        gloss: false,
      });

      // Subtle upper specular highlight inside card
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      traceRoundRect(ctx, r.x + 3, r.y + 2, r.w - 6, r.h * 0.28, 13);
      ctx.fill();

      // Beveled Icon Plate
      drawToyBevelRect(ctx, r.x + 12, cy - 35, 70, 70, 14, '#2a1f4d', {
        depth: 2.5,
        rimColor: info.color,
        lineWidth: 1.6,
        gloss: true,
      });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '38px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(info.icon, r.x + 47, cy + 2);

      const tx = r.x + 96;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = "700 18px 'Fredoka', 'Outfit', sans-serif";
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeText(info.name, tx, r.y + 32);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(info.name, tx, r.y + 32);

      ctx.fillStyle = info.isNew ? '#ffd166' : info.color;
      ctx.font = "700 11px 'Fredoka', 'Outfit', sans-serif";
      ctx.fillText(info.tag, tx, r.y + 52);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
      ctx.font = "600 13px 'Fredoka', 'Outfit', sans-serif";
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
