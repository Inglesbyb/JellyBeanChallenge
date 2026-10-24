import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const TRACK_L = 45;
const TRACK_R = 405;
const TRACK_W = TRACK_R - TRACK_L;
const MID = (TRACK_L + TRACK_R) / 2; // 225
const CROWD_Y = 620;
const ROW_GAP = 290;
const TAU = Math.PI * 2;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

export class MultiplierRunner extends Game {
  static meta = {
    id: 'multiplier-runner',
    title: 'Albert Dock Rush',
    icon: '⚓',
    hint: 'DRAG left/right! Dodge central posts, pick blue gates, clash with gangs & climb victory stairs!',
    baseLikes: 4180,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.count = saved ? Math.max(8, saved.count) : 10;
    this.dist = saved ? saved.dist : 0;
    this.crowdX = MID; // Center line: requires active steering to avoid central spike posts!
    this.targetX = this.crowdX;
    this.rows = [];
    this.farD = this.dist + 480;
    this.t = 0;
    this.speed = 195; // 25% slower running speed for tactical readability
    this.boostTimer = 0;
    this.feverRush = 0;
    this.shield = 0;
    this.nextMilestone = Math.floor(this.dist / 2200) * 2200 + 2200;

    // Active boss & victory stairs state
    this.activeBoss = null;
    this.bossState = 'none'; // 'none' | 'fighting' | 'stairs'
    this.stairsProgress = 0;
    this.stairsScoreMult = 1;

    // Visual scenery props
    this.quaysideProps = [
      { d: 120, type: 'bollard' },
      { d: 280, type: 'lamp' },
      { d: 460, type: 'crane' },
      { d: 680, type: 'crate' },
      { d: 920, type: 'bollard' },
      { d: 1140, type: 'lamp' },
      { d: 1380, type: 'crane' },
      { d: 1620, type: 'crate' },
    ];

    if (saved) this.grace = 1.5;
    this.spawnRows();
  }

  serialize() {
    return {
      count: Math.round(this.count),
      dist: this.dist,
      rowIdx: this.rowIdx,
    };
  }

  restoreLabel() {
    return `${Math.round(this.count)} dock runners`;
  }

  crowdRadius() {
    return clamp(6 + 4.6 * Math.sqrt(Math.min(this.count, 220)), 12, 85);
  }

  /* ------------------------------------------------------------ Procedural Track Generation */
  spawnRows() {
    while (this.farD < this.dist + 1600) {
      // Milestone Boss & Victory Stairs every ~2200m
      if (this.farD >= this.nextMilestone && !this.rows.some((r) => r.kind === 'boss' && Math.abs(r.d - this.nextMilestone) < 400)) {
        this.rows.push(this.makeBossRow(this.nextMilestone));
        this.nextMilestone += 2400;
        this.farD += ROW_GAP * 2.8;
        this.rowIdx++;
        continue;
      }

      this.rows.push(this.makeRow(this.farD));
      this.farD += ROW_GAP;
      this.rowIdx++;
    }
  }

  makeBossRow(d) {
    const tier = Math.floor(d / 2200);
    let title, req, hp, color, type;

    if (tier <= 1) {
      type = 'captain';
      title = 'PIRATE CAPTAIN CRUMP';
      req = 30;
      hp = 35;
      color = '#e63946';
    } else if (tier === 2) {
      type = 'kraken';
      title = 'MERSEY KRAKEN MECHA';
      req = 55;
      hp = 65;
      color = '#7209b7';
    } else {
      type = 'colossus';
      title = 'ROYAL DOCK LEVIATHAN';
      req = 90;
      hp = 110;
      color = '#f72585';
    }

    return {
      d,
      kind: 'boss',
      done: false,
      type,
      title,
      req,
      hp,
      maxHp: hp,
      x: MID,
      y: 0,
      r: 64,
      slamTimer: 0,
      shockwaves: [],
      defeated: false,
    };
  }

  makeRow(d) {
    const cycle = this.rowIdx % 9;

    // Pattern 0 & 4: Dual Multiplier Gates with Central Spike Divider
    if (cycle === 0 || cycle === 4) {
      const isMoving = Math.random() < 0.28;
      const roll = Math.random();
      let leftGate, rightGate;

      if (roll < 0.35) {
        // High Stakes: Blue Multiplier vs Red Penalty
        const mult = Math.random() < 0.4 ? 3 : 2;
        const pen = Math.round(rand(6, 14) + this.dist / 350);
        const multLeft = Math.random() < 0.5;

        if (multLeft) {
          leftGate = { op: '×', v: mult, good: true };
          rightGate = { op: '−', v: pen, good: false };
        } else {
          leftGate = { op: '−', v: pen, good: false };
          rightGate = { op: '×', v: mult, good: true };
        }
      } else if (roll < 0.7) {
        // Dilemma: Safe Addition vs Multiplier
        const add = Math.round(rand(8, 16) + Math.min(20, this.dist / 200));
        const mult = 2;
        const addLeft = Math.random() < 0.5;

        if (addLeft) {
          leftGate = { op: '+', v: add, good: true };
          rightGate = { op: '×', v: mult, good: true };
        } else {
          leftGate = { op: '×', v: mult, good: true };
          rightGate = { op: '+', v: add, good: true };
        }
      } else {
        // Lesser of Two Evils (Both red! Player must pick smallest loss)
        const penSmall = Math.round(rand(4, 8));
        const penLarge = Math.round(rand(14, 24));
        const smallLeft = Math.random() < 0.5;

        if (smallLeft) {
          leftGate = { op: '−', v: penSmall, good: false };
          rightGate = { op: '÷', v: 2, good: false };
        } else {
          leftGate = { op: '÷', v: 2, good: false };
          rightGate = { op: '−', v: penSmall, good: false };
        }
      }

      return {
        d,
        kind: 'gate',
        gates: [leftGate, rightGate],
        isMoving,
        movePhase: Math.random() * TAU,
        moveAmp: 30,
        done: false,
      };
    }

    // Pattern 1: Rotating Quayside Sweeper Beam (Center hazard!)
    if (cycle === 1) {
      return {
        d,
        kind: 'sweeper',
        done: false,
        angle: Math.random() * TAU,
        rotSpeed: rand(2.2, 3.4),
        beamLen: 170,
        gapDist: rand(45, 95), // Opening gap in the beam that player must pass through!
      };
    }

    // Pattern 2: Tough Rival Dock Gang (Requires army to overpower!)
    if (cycle === 2) {
      // Gang size scales with distance, creating real stakes
      const baseGang = Math.round(rand(12, 22) + (this.dist / 280) * 4);
      const gangCount = clamp(baseGang, 14, 95);
      const lane = Math.random() < 0.35 ? MID : Math.random() < 0.5 ? TRACK_L + 80 : TRACK_R - 80;

      return {
        d,
        kind: 'gang',
        done: false,
        x: lane,
        n: gangCount,
        maxN: gangCount,
        r: clamp(18 + Math.sqrt(gangCount) * 5.2, 22, 68),
        clashing: false,
        clashT: 0,
      };
    }

    // Pattern 3: Albert Dock Drawbridge (Narrow plank over water canal!)
    if (cycle === 3) {
      const bridgeW = rand(105, 140);
      const bridgeX = rand(TRACK_L + bridgeW / 2 + 15, TRACK_R - bridgeW / 2 - 15);
      return {
        d,
        kind: 'drawbridge',
        done: false,
        x: bridgeX,
        w: bridgeW,
        length: 180,
      };
    }

    // Pattern 5: Explosive Gunpowder Barrels (TNT) in Center & Side Lanes
    if (cycle === 5) {
      const centerTnt = Math.random() < 0.65; // High chance of dead-center TNT!
      const barrels = [];
      if (centerTnt) {
        barrels.push({ x: MID, r: 24, fuseT: 0 });
        if (Math.random() < 0.5) {
          barrels.push({ x: Math.random() < 0.5 ? TRACK_L + 60 : TRACK_R - 60, r: 22, fuseT: 0 });
        }
      } else {
        barrels.push({ x: TRACK_L + 75, r: 22, fuseT: 0 });
        barrels.push({ x: TRACK_R - 75, r: 22, fuseT: 0 });
      }

      return {
        d,
        kind: 'tnt',
        done: false,
        barrels,
      };
    }

    // Pattern 6: Golden Duplicator Cannon / Powerup
    if (cycle === 6) {
      const type = Math.random() < 0.55 ? 'cannon' : 'nitro';
      const x = Math.random() < 0.5 ? TRACK_L + 85 : TRACK_R - 85;
      return {
        d,
        kind: 'powerup',
        type,
        done: false,
        x,
        w: 68,
        h: 46,
      };
    }

    // Pattern 7: Giant Rolling Jawbreaker Boulder
    if (cycle === 7) {
      const lane = Math.random() < 0.45 ? MID : Math.random() < 0.5 ? TRACK_L + 80 : TRACK_R - 80;
      return {
        d,
        kind: 'boulder',
        done: false,
        x: lane,
        r: 34,
        rot: 0,
      };
    }

    // Pattern 8: Golden Sovereign Coins Line (High Risk, High Reward)
    const coinLane = Math.random() < 0.5 ? TRACK_L + 45 : TRACK_R - 45;
    return {
      d,
      kind: 'coins',
      done: false,
      coins: [
        { x: coinLane, yOff: -30, collected: false },
        { x: coinLane, yOff: 0, collected: false },
        { x: coinLane, yOff: 30, collected: false },
      ],
    };
  }

  /* ------------------------------------------------------------ Update Loop */
  update(dt) {
    this.t += dt;

    // Victory Multiplier Stairs sequence
    if (this.bossState === 'stairs') {
      this.updateStairs(dt);
      this.fx.update(dt);
      return;
    }

    // Speed & Fever calculation (25% slower for tactical, addictive crowd steering)
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      this.speed = 345; // 460 * 0.75
    } else if (this.feverRush > 0) {
      this.feverRush -= dt;
      this.speed = 270; // 360 * 0.75
    } else {
      this.speed = 188 + Math.min(95, this.dist / 95); // 250 * 0.75
    }

    this.dist += this.speed * dt;
    this.score += (this.speed * dt) / 6;

    const rad = this.crowdRadius();

    // Highly Agile & Responsive Drag & Arrow Steering
    const minX = TRACK_L + rad * 0.75;
    const maxX = TRACK_R - rad * 0.75;

    if (this.input.down) {
      // Direct instant & smooth pointer tracking
      const target = clamp(this.input.x, minX, maxX);
      this.crowdX += (target - this.crowdX) * Math.min(1, dt * 55);
      this.targetX = this.crowdX;
    } else {
      let steerVel = 0;
      // High-speed nimble arrow/AD steering (quick lane switching)
      if (this.input.key('arrowleft', 'a')) steerVel -= 820;
      if (this.input.key('arrowright', 'd')) steerVel += 820;
      if (this.input.frameDX) steerVel += this.input.frameDX * 65;

      this.crowdX = clamp(this.crowdX + steerVel * dt, minX, maxX);
      this.targetX = this.crowdX;
    }

    this.spawnRows();

    // Process Track Rows
    for (const r of this.rows) {
      if (r.done) continue;

      // Real-time animation / update for active obstacles
      if (r.kind === 'sweeper') {
        r.angle += r.rotSpeed * dt;
      } else if (r.kind === 'boulder') {
        r.rot += dt * 8;
      } else if (r.kind === 'gang') {
        // Smart Gang Lateral Movement: larger gangs intercept, smaller gangs scatter!
        const distToPlayer = r.d - this.dist;
        if (!r.clashing && distToPlayer < 520 && distToPlayer > 0) {
          const gangSpd = 145 * dt;
          if (r.n > this.count) {
            r.x += clamp(this.crowdX - r.x, -gangSpd, gangSpd);
          } else {
            const dirAway = r.x >= MID ? 1 : -1;
            r.x += dirAway * gangSpd * 0.75;
          }
          r.x = clamp(r.x, TRACK_L + r.r, TRACK_R - r.r);
        }
        if (r.clashing) this.updateGangClash(r, dt);
      } else if (r.kind === 'boss') {
        const distToBoss = r.d - this.dist;
        if (distToBoss < 550 && distToBoss > -50 && !r.defeated) {
          const bossSpd = 95 * dt;
          r.x += clamp(this.crowdX - r.x, -bossSpd, bossSpd);
          r.x = clamp(r.x, TRACK_L + 60, TRACK_R - 60);
        }
        this.updateBoss(r, dt);
      }

      // Check collision when row reaches player height
      if (r.d <= this.dist) {
        if (!r.done && r.kind !== 'boss' && (!r.clashing || r.n <= 0)) {
          r.done = true;
          this.resolveRow(r, rad);
          if (this.dead) break;
        }
      }
    }

    // Cleanup old rows
    this.rows = this.rows.filter((r) => r.d > this.dist - 400 || (r.kind === 'boss' && !r.defeated));
    this.fx.update(dt);
  }

  /* ------------------------------------------------------------ Row Collision Resolvers */
  resolveRow(r, rad) {
    const y = CROWD_Y - 20;

    // 1. Dual Multiplier Gates with Central Spike Divider
    if (r.kind === 'gate') {
      const dividerW = 26;
      const dividerLeft = MID - dividerW / 2;
      const dividerRight = MID + dividerW / 2;

      // ANTI-AFK CHECK: Did player crash directly into the central iron post?
      if (this.crowdX > dividerLeft - rad * 0.45 && this.crowdX < dividerRight + rad * 0.45) {
        const cut = Math.max(5, Math.ceil(this.count * 0.5));
        this.count = Math.max(0, this.count - cut);

        this.fx.text(this.crowdX, y - 30, `IMPALED ON POST! −${cut}`, '#ff0054', 28, 1.1);
        this.fx.burst(MID, CROWD_Y, '#ff0054', 28, 260, 0.7, 4);
        this.fx.shake(12, 0.4);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Shredded by central dock mooring post!');
          return;
        }
      }

      // Determine which lane gate was chosen
      const chosenIdx = this.crowdX < MID ? 0 : 1;
      const g = r.gates[chosenIdx];
      const before = this.count;
      let after = before;

      if (g.op === '+') after = before + g.v;
      else if (g.op === '×') after = before * g.v;
      else if (g.op === '−') after = before - g.v;
      else if (g.op === '÷') after = Math.floor(before / g.v);

      after = Math.min(9999, Math.max(0, Math.round(after)));
      const isGood = after >= before;
      this.count = after;

      if (isGood) {
        this.score += 45;
        this.fx.text(this.crowdX, y - rad - 28, `${g.op}${g.v}! 🎉`, '#38bdf8', 34, 1.0);
        this.fx.ring(this.crowdX, CROWD_Y, '#38bdf8', rad * 2.8, 0.5, 5);
        this.fx.burst(this.crowdX, CROWD_Y, '#38bdf8', 22, 240, 0.6, 4);
        this.sounds.gate(true);
        this.haptics.medium();
      } else {
        const loss = before - after;
        this.fx.text(this.crowdX, y - rad - 28, `PENALTY! −${loss}`, '#ff0054', 32, 1.0);
        this.fx.burst(this.crowdX, CROWD_Y, '#ff0054', 24, 240, 0.6, 4);
        this.fx.shake(8, 0.3);
        this.sounds.gate(false);
        this.haptics.heavy();
      }

      if (this.count <= 0) {
        this.die('Squad wiped out by a penalty gate!');
      }
    }

    // 2. Rotating Sweeper Beam
    else if (r.kind === 'sweeper') {
      if (this.boostTimer > 0) {
        this.score += 80;
        this.fx.text(this.crowdX, y - 20, 'SWEEPER SMASHED! 💥', '#ffd166', 24, 0.9);
        this.fx.burst(this.crowdX, CROWD_Y, '#ffd166', 24, 260, 0.6, 4);
        return;
      }

      // Check distance from beam gap
      const armCos = Math.cos(r.angle);
      const armSin = Math.sin(r.angle);
      const beamX = MID + armCos * r.gapDist;

      if (Math.abs(this.crowdX - beamX) > rad + 24) {
        const loss = Math.max(4, Math.ceil(this.count * 0.38));
        this.count = Math.max(0, this.count - loss);

        this.fx.text(this.crowdX, y - 24, `SWEPT OFF QUAY! −${loss}`, '#ff7a88', 26, 0.9);
        this.fx.burst(this.crowdX, CROWD_Y, '#6a040f', 24, 260, 0.6, 4);
        this.fx.shake(9, 0.35);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Swept into the Mersey by rotating dock boom!');
          return;
        }
      } else {
        this.score += 40;
        this.fx.text(this.crowdX, y - 26, 'CLEARED GAP! +40', '#3dffa2', 20, 0.8);
        this.sounds.survive();
      }
    }

    // 3. Albert Dock Drawbridge (Narrow plank over water)
    else if (r.kind === 'drawbridge') {
      const halfW = r.w / 2;
      const bLeft = r.x - halfW;
      const bRight = r.x + halfW;

      // Beans outside the bridge plunge into the canal
      if (this.crowdX < bLeft || this.crowdX > bRight) {
        const loss = Math.max(5, Math.ceil(this.count * 0.45));
        this.count = Math.max(0, this.count - loss);

        this.fx.text(this.crowdX, y - 26, `CANAL PLUNGE! −${loss} 💦`, '#4cc9f0', 26, 1.0);
        this.fx.burst(this.crowdX, CROWD_Y, '#0077b6', 28, 280, 0.7, 4);
        this.fx.shake(9, 0.35);
        this.sounds.bubble();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Fell off narrow boardwalk into the dock basin!');
          return;
        }
      } else {
        this.score += 35;
        this.fx.text(this.crowdX, y - 24, 'BRIDGE CROSSED! +35', '#3dffa2', 20, 0.7);
      }
    }

    // 4. Explosive Gunpowder Barrels (TNT)
    else if (r.kind === 'tnt') {
      for (const b of r.barrels) {
        if (Math.abs(b.x - this.crowdX) < rad + b.r * 0.8) {
          if (this.boostTimer > 0) {
            this.score += 100;
            this.fx.text(b.x, y - 24, 'BOOM! TNT DEFUSED! 💥', '#ffd166', 24, 1.0);
            this.fx.burst(b.x, CROWD_Y, '#ffbe0b', 32, 320, 0.7, 5);
            continue;
          }

          const loss = Math.max(6, Math.ceil(this.count * 0.4));
          this.count = Math.max(0, this.count - loss);

          this.fx.text(b.x, y - 24, `TNT EXPLOSION! −${loss} 💣`, '#ff0054', 28, 1.1);
          this.fx.burst(b.x, CROWD_Y, '#e63946', 36, 360, 0.8, 5);
          this.fx.ring(b.x, CROWD_Y, '#ffd166', 260, 0.6, 6);
          this.fx.shake(14, 0.45);
          this.sounds.hit();
          this.haptics.heavy();

          if (this.count <= 0) {
            this.die('Blown up by maritime gunpowder barrel!');
            return;
          }
        }
      }
    }

    // 5. Golden Duplicator Cannon / Nitro Powerup
    else if (r.kind === 'powerup') {
      if (Math.abs(r.x - this.crowdX) < rad + r.w * 0.5) {
        if (r.type === 'cannon') {
          const bonus = Math.round(rand(12, 18));
          this.count += bonus;
          this.score += 120;
          this.fx.text(this.crowdX, y - 30, `CANNON RECRUITS! +${bonus} 🚀`, '#ffd166', 30, 1.2);
          this.fx.burst(this.crowdX, CROWD_Y, '#ffd166', 30, 300, 0.7, 4);
          this.fx.ring(this.crowdX, CROWD_Y, '#ffd166', 280, 0.5, 5);
          this.sounds.up();
          this.haptics.heavy();
        } else {
          this.boostTimer = 3.2; // Invincible Nitro Rush!
          this.score += 80;
          this.fx.text(this.crowdX, y - 30, 'NITRO TURBO RUSH! ⚡⚡', '#3dffa2', 32, 1.3);
          this.fx.ring(this.crowdX, CROWD_Y, '#3dffa2', 320, 0.6, 6);
          this.fx.burst(this.crowdX, CROWD_Y, '#3dffa2', 34, 320, 0.7, 4);
          this.sounds.up();
          this.haptics.heavy();
        }
      }
    }

    // 6. Giant Rolling Jawbreaker Boulder
    else if (r.kind === 'boulder') {
      if (Math.abs(r.x - this.crowdX) < rad + r.r * 0.85) {
        if (this.boostTimer > 0) {
          this.score += 90;
          this.fx.text(this.crowdX, y - 24, 'BOULDER CRUSHED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(r.x, CROWD_Y, '#ff0054', 28, 300, 0.6, 4);
          this.sounds.hit();
          return;
        }

        const loss = Math.max(6, Math.ceil(this.count * 0.42));
        this.count = Math.max(0, this.count - loss);

        this.fx.text(r.x, y - 24, `RUN OVER! −${loss}`, '#ff7a88', 26, 0.9);
        this.fx.burst(r.x, CROWD_Y, '#ff0054', 24, 260, 0.6, 4);
        this.fx.shake(10, 0.38);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Crushed by rolling jawbreaker boulder!');
          return;
        }
      } else {
        this.score += 30;
        this.fx.text(this.crowdX, y - 26, 'CLOSE DODGE! +30', '#3dffa2', 18, 0.6);
      }
    }

    // 7. Golden Coins
    else if (r.kind === 'coins') {
      for (const c of r.coins) {
        if (!c.collected && Math.abs(c.x - this.crowdX) < rad + 18) {
          c.collected = true;
          this.score += 75;
          this.fx.text(c.x, y - 16, '+75 🪙', '#ffd166', 20, 0.6);
          this.fx.burst(c.x, CROWD_Y, '#ffd166', 10, 140, 0.4, 3);
          this.sounds.stack(2);
        }
      }
    }
  }

  /* ------------------------------------------------------------ Real-Time Mob Brawl */
  updateGangClash(r, dt) {
    r.clashT += dt;
    const rad = this.crowdRadius();
    const hit = Math.abs(r.x - this.crowdX) < rad + r.r * 0.85;

    if (!hit) {
      r.done = true;
      r.clashing = false;
      this.score += 40;
      this.fx.text(this.crowdX, CROWD_Y - 40, 'OUTMANEUVERED! +40', '#3dffa2', 22, 0.8);
      return;
    }

    if (this.boostTimer > 0) {
      // Steamroll through in nitro mode!
      r.n = 0;
      r.done = true;
      r.clashing = false;
      this.score += r.maxN * 8;
      this.fx.text(r.x, CROWD_Y - 40, `MOB OBLITERATED! +${r.maxN * 8} 👑`, '#ffd166', 28, 1.2);
      this.fx.burst(r.x, CROWD_Y, '#ff4b5c', 36, 320, 0.7, 4);
      this.fx.shake(12, 0.4);
      this.sounds.hit();
      return;
    }

    // Active Tug-of-War Drain Rate (24 beans/second clash)
    const drain = Math.ceil(24 * dt);
    const playerLoss = Math.min(this.count, drain);
    const enemyLoss = Math.min(r.n, drain);

    this.count -= playerLoss;
    r.n -= enemyLoss;

    this.fx.burst((this.crowdX + r.x) / 2, CROWD_Y, '#ff0054', 4, 140, 0.35, 3);
    this.fx.burst((this.crowdX + r.x) / 2, CROWD_Y, '#25e6ff', 4, 140, 0.35, 3);
    this.fx.shake(4, 0.1);

    if (r.clashT % 0.15 < dt) {
      this.sounds.chomp();
      this.haptics.light();
    }

    // Resolution: Player wiped out!
    if (this.count <= 0) {
      r.done = true;
      r.clashing = false;
      this.die(`Overwhelmed by rival dock gang! (Needed ${r.maxN} beans)`);
      return;
    }

    // Resolution: Enemy gang defeated!
    if (r.n <= 0) {
      r.done = true;
      r.clashing = false;
      this.score += r.maxN * 6;
      this.fx.text(this.crowdX, CROWD_Y - 40, `VICTORY! GANG DEFEATED! +${r.maxN * 6} 👑`, '#3dffa2', 28, 1.3);
      this.fx.burst(r.x, CROWD_Y, '#ff4b5c', 30, 280, 0.7, 4);
      this.fx.shake(10, 0.35);
      this.sounds.survive();
      this.haptics.heavy();
    }
  }

  /* ------------------------------------------------------------ Milestone Boss & Victory Stairs */
  updateBoss(r, dt) {
    if (r.defeated) return;

    // Check if boss reached engagement range
    const distToBoss = r.d - this.dist;
    if (distToBoss <= 180 && distToBoss >= -80) {
      // Boss battle active
      r.slamTimer += dt;
      if (r.slamTimer > 1.2) {
        r.slamTimer = 0;
        // Boss slams ground, creating a shockwave ring
        r.shockwaves.push({ r: 20, maxR: 240, life: 0.8 });
        this.sounds.hit();
        this.fx.shake(8, 0.3);
      }

      // Update shockwaves
      for (const sw of r.shockwaves) {
        sw.r += 260 * dt;
        sw.life -= dt;
        // Shockwave damages squad if caught on the outer ring without dodging
        if (Math.abs(sw.r - Math.abs(this.crowdX - r.x)) < 15 && this.boostTimer <= 0) {
          const cut = Math.max(2, Math.ceil(this.count * 0.15));
          this.count = Math.max(0, this.count - cut);
          this.fx.text(this.crowdX, CROWD_Y - 20, `SHOCKWAVE! −${cut}`, '#ff0054', 22, 0.7);
          this.fx.burst(this.crowdX, CROWD_Y, '#ff0054', 12, 180, 0.4, 3);
          this.sounds.hit();
        }
      }
      r.shockwaves = r.shockwaves.filter((sw) => sw.life > 0);

      // Squad swarm attack against boss
      const attackPower = Math.ceil(18 * dt);
      r.hp -= attackPower;
      this.fx.burst(r.x, CROWD_Y - 40, r.color, 4, 160, 0.35, 3);

      if (r.hp <= 0) {
        // Boss Shattered!
        r.defeated = true;
        r.done = true;
        this.score += 1000;
        this.fx.text(MID, CROWD_Y - 80, `👑 ${r.title} DEFEATED! +1000`, '#ffd166', 32, 1.8);
        this.fx.ring(MID, CROWD_Y, '#ffd166', 380, 0.8, 8);
        this.fx.burst(MID, CROWD_Y, r.color, 50, 360, 0.9, 6);
        this.fx.shake(16, 0.6);
        this.sounds.up();
        this.haptics.heavy();

        // Launch Iconic Victory Multiplier Stairs!
        this.bossState = 'stairs';
        this.stairsProgress = 0;
        this.stairsScoreMult = 1.0;
      }
    }
  }

  updateStairs(dt) {
    this.stairsProgress += dt * 1.5;
    const steps = [
      { step: 1, mult: 1.2, req: 8 },
      { step: 2, mult: 1.5, req: 16 },
      { step: 3, mult: 2.0, req: 28 },
      { step: 4, mult: 3.0, req: 45 },
      { step: 5, mult: 5.0, req: 70 },
      { step: 6, mult: 10.0, req: 100 },
    ];

    const curStepIdx = Math.min(steps.length - 1, Math.floor(this.stairsProgress));
    const step = steps[curStepIdx];

    if (this.stairsScoreMult < step.mult && this.count >= step.req) {
      this.stairsScoreMult = step.mult;
      this.score += Math.round(300 * step.mult);
      this.fx.text(MID, 320 - curStepIdx * 45, `STAIR ${step.step} · ×${step.mult}! 🎉`, '#ffd166', 30, 1.2);
      this.fx.burst(MID, 320 - curStepIdx * 45, '#ffd166', 22, 220, 0.6, 4);
      this.sounds.stack(step.step);
      this.haptics.medium();
    }

    if (this.stairsProgress >= steps.length + 1) {
      // Conquered victory stairs! Return to running with fever speed
      this.bossState = 'none';
      this.feverRush = 4.0;
      this.fx.text(MID, CROWD_Y - 40, 'FEVER DASH UNLOCKED! 🔥', '#3dffa2', 32, 1.5);
      this.sounds.survive();
    }
  }

  /* ------------------------------------------------------------ Rendering Pipeline */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const off = this.fx.offset();

    // 1. Maritime Atmosphere (Sunset over Liverpool & Royal Albert Dock)
    this.renderAtmosphere(ctx, W, H);

    ctx.save();
    ctx.translate(off.x, off.y);

    // 2. Boardwalk & Mersey Tidal Canal
    this.renderBoardwalk(ctx, W, H);

    // 3. Quayside Architectural Props (Cranes, Warehouses, Lamps)
    this.renderQuaysideProps(ctx, W, H);

    // 4. Track Obstacles & Elements (Far -> Near)
    if (this.bossState === 'stairs') {
      this.renderVictoryStairs(ctx, W, H);
    } else {
      const rows = [...this.rows].sort((a, b) => b.d - a.d);
      for (const r of rows) {
        const y = CROWD_Y - (r.d - this.dist);
        if (y < -220 || y > H + 220) continue;

        if (r.kind === 'gate') this.drawGates(r, y);
        else if (r.kind === 'sweeper') this.drawSweeper(r, y);
        else if (r.kind === 'gang') this.drawGang(r, y);
        else if (r.kind === 'drawbridge') this.drawDrawbridge(r, y);
        else if (r.kind === 'tnt') this.drawTnt(r, y);
        else if (r.kind === 'powerup') this.drawPowerup(r, y);
        else if (r.kind === 'boulder') this.drawBoulder(r, y);
        else if (r.kind === 'coins') this.drawCoins(r, y);
        else if (r.kind === 'boss') this.drawBoss(r, y);
      }
    }

    // 5. Living Jellybean Crowd & Captain Mascot
    const rad = this.crowdRadius();
    this.drawLivingCrowd(this.crowdX, CROWD_Y, Math.min(this.count, 180));

    // Crowd Count Badge
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 32px Outfit, system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#140924';
    const badgeY = CROWD_Y - rad - 28;
    ctx.strokeText(fmt(this.count), this.crowdX, badgeY);
    ctx.fillStyle = this.boostTimer > 0 ? '#3dffa2' : this.feverRush > 0 ? '#ffea00' : '#ffffff';
    ctx.fillText(fmt(this.count), this.crowdX, badgeY);

    this.fx.render(ctx, 1);
    ctx.restore();

    // 6. Polished Heads-Up Display
    this.renderHUD(ctx, W, H);
  }

  /* ------------------------------------------------------------ Visual Layers */
  renderAtmosphere(ctx, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.4, '#1e1b4b');
    bg.addColorStop(0.7, '#431407');
    bg.addColorStop(1, '#78350f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Royal Liver Building silhouette on the horizon
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, 140);
    ctx.lineTo(35, 125);
    ctx.lineTo(50, 140);
    ctx.lineTo(95, 90);
    ctx.lineTo(105, 55);
    ctx.lineTo(115, 90);
    ctx.lineTo(145, 135);
    ctx.lineTo(175, 90);
    ctx.lineTo(185, 55);
    ctx.lineTo(195, 90);
    ctx.lineTo(245, 140);
    ctx.lineTo(W, 120);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  }

  renderBoardwalk(ctx, W, H) {
    // Left Flank: Turquoise Mersey Basin Canal (0 to TRACK_L)
    const wg = ctx.createLinearGradient(0, 0, TRACK_L, 0);
    wg.addColorStop(0, '#0077b6');
    wg.addColorStop(0.65, '#4cc9f0');
    wg.addColorStop(1, '#023e8a');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, TRACK_L, H);

    // Animated water ripples
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    const ripStep = 44;
    const ripOff = (this.t * 26) % ripStep;
    for (let y = -ripStep + ripOff; y < H; y += ripStep) {
      ctx.beginPath();
      ctx.arc(TRACK_L * 0.45, y, 14, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // Heavy timber quayside barrier
    ctx.fillStyle = '#2d1808';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 2;
    ctx.fillRect(TRACK_L - 5, 0, 6, H);
    ctx.strokeRect(TRACK_L - 5, 0, 6, H);

    // Right Flank: Historic Albert Dock Red Sugar-Brick Warehouse (TRACK_R to W)
    ctx.fillStyle = '#782a3b';
    ctx.fillRect(TRACK_R, 0, W - TRACK_R, H);

    // Mortar lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 18) {
      ctx.beginPath();
      ctx.moveTo(TRACK_R, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#140924';
    ctx.fillRect(TRACK_R, 0, 4, H);

    // Center Boardwalk Track: Solid Rich Timber
    const bg = ctx.createLinearGradient(TRACK_L, 0, TRACK_R, 0);
    bg.addColorStop(0, '#b07848');
    bg.addColorStop(0.5, '#bd8754');
    bg.addColorStop(1, '#b07848');
    ctx.fillStyle = bg;
    ctx.fillRect(TRACK_L, 0, TRACK_W, H);

    // Scrolling plank seams
    const seamGap = 32;
    const seamOff = (this.dist * 1.2) % seamGap;
    ctx.strokeStyle = 'rgba(20, 9, 36, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = -seamGap + seamOff; y < H + seamGap; y += seamGap) {
      ctx.moveTo(TRACK_L, y);
      ctx.lineTo(TRACK_R, y);
    }
    ctx.stroke();

    // Center warning guide line
    const dashGap = 52;
    const dashOff = (this.dist * 1.2) % dashGap;
    ctx.fillStyle = 'rgba(255, 240, 200, 0.22)';
    for (let y = -dashGap + dashOff; y < H; y += dashGap) {
      ctx.fillRect(MID - 2, y, 4, 26);
    }
  }

  renderQuaysideProps(ctx, W, H) {
    const period = 1600;
    const curDist = this.dist % period;

    for (const p of this.quaysideProps) {
      let dy = CROWD_Y - (p.d - curDist);
      if (dy < -90) dy += period;
      if (dy > H + 90) continue;

      ctx.save();
      if (p.type === 'bollard') {
        const bx = TRACK_L - 12;
        ctx.translate(bx, dy);
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.fillRect(-5, -15, 10, 18);
        ctx.strokeRect(-5, -15, 10, 18);
        ctx.beginPath();
        ctx.arc(0, -15, 7, 0, TAU);
        ctx.fill(); ctx.stroke();
      } else if (p.type === 'lamp') {
        const lx = TRACK_R + 14;
        ctx.translate(lx, dy);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-2, -22, 4, 26);
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, -22, 6, 0, TAU);
        ctx.fill();
      } else if (p.type === 'crane') {
        const cx = TRACK_R + 24;
        ctx.translate(cx, dy);
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.fillRect(-12, -24, 24, 30);
        ctx.strokeRect(-12, -24, 24, 30);
      } else if (p.type === 'crate') {
        const cx = TRACK_L - 14;
        ctx.translate(cx, dy);
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeRect(-8, -8, 16, 16);
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ Dual Multiplier Gates with Central Spike */
  drawGates(r, y) {
    const ctx = this.ctx;
    const midX = MID + (r.isMoving ? Math.sin(this.t * 3 + r.movePhase) * r.moveAmp : 0);

    const leftBox = [TRACK_L + 6, midX - 12];
    const rightBox = [midX + 12, TRACK_R - 6];
    const boxes = [leftBox, rightBox];

    boxes.forEach(([x0, x1], i) => {
      const g = r.gates[i];
      const w = x1 - x0;
      const h = 92;
      const topY = y - h / 2;
      const alpha = r.done ? 0.35 : 1;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Gate Glow Background
      const sg = ctx.createLinearGradient(0, topY, 0, topY + h);
      if (g.good) {
        sg.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
        sg.addColorStop(0.5, 'rgba(3, 105, 161, 0.45)');
        sg.addColorStop(1, 'rgba(56, 189, 248, 0.85)');
      } else {
        sg.addColorStop(0, 'rgba(239, 68, 68, 0.85)');
        sg.addColorStop(0.5, 'rgba(153, 27, 27, 0.45)');
        sg.addColorStop(1, 'rgba(239, 68, 68, 0.85)');
      }
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.roundRect(x0, topY, w, h, 14);
      ctx.fill();

      // Bold Cel Border
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Neon Top Banner
      ctx.fillStyle = g.good ? '#38bdf8' : '#ef4444';
      ctx.beginPath();
      ctx.roundRect(x0 + 4, topY + 4, w - 8, 16, 6);
      ctx.fill();

      ctx.font = '900 11px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(g.good ? '✨ BOOST' : '⚠️ PENALTY', (x0 + x1) / 2, topY + 13);

      // High Contrast Math Text
      ctx.font = '900 44px Outfit, system-ui, sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#140924';
      const label = `${g.op}${g.v}`;
      ctx.strokeText(label, (x0 + x1) / 2, y + 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, (x0 + x1) / 2, y + 8);

      ctx.restore();
    });

    // Central Deadly Spike Mooring Post (Anti-AFK!)
    ctx.save();
    ctx.translate(midX, y);
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-10, -50, 20, 100, 6);
    ctx.fill();
    ctx.stroke();

    // Spikes protruding from the central post
    ctx.fillStyle = '#ffffff';
    for (let sy = -40; sy <= 40; sy += 20) {
      ctx.beginPath();
      ctx.moveTo(-10, sy); ctx.lineTo(-16, sy + 5); ctx.lineTo(-10, sy + 10); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, sy); ctx.lineTo(16, sy + 5); ctx.lineTo(10, sy + 10); ctx.fill();
    }

    ctx.font = '900 12px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('💀', 0, 0);
    ctx.restore();
  }

  /* ------------------------------------------------------------ Rotating Sweeper Beam */
  drawSweeper(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(MID, y);

    // Center Pivot Turret
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, TAU);
    ctx.fill(); ctx.stroke();

    // Spiked Wooden Boom
    ctx.rotate(r.angle);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-r.beamLen / 2, -10, r.beamLen, 20);
    ctx.strokeRect(-r.beamLen / 2, -10, r.beamLen, 20);

    // Safe Passage Gap Indicator (Green ring)
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(r.gapDist - r.beamLen / 2, 0, 14, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  /* ------------------------------------------------------------ Rival Gang */
  drawGang(r, y) {
    const ctx = this.ctx;
    if (r.done) ctx.globalAlpha = 0.25;

    // Draw Rival Mob with angry scallywag styling
    this.drawLivingCrowd(r.x, y, Math.min(r.n, 90), '#ef4444', -1);

    // Gang Strength Banner
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 24px Outfit, system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#140924';
    ctx.strokeText(`⚔️ ${fmt(r.n)} GANG`, r.x, y - r.r * 0.6 - 22);
    ctx.fillStyle = '#fca5a5';
    ctx.fillText(`⚔️ ${fmt(r.n)} GANG`, r.x, y - r.r * 0.6 - 22);

    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------ Albert Dock Drawbridge */
  drawDrawbridge(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x, y);

    // Bridge Timber Planks
    ctx.fillStyle = '#92400e';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-r.w / 2, -40, r.w, 80, 8);
    ctx.fill();
    ctx.stroke();

    // Steel boundary chains
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-r.w / 2, -38); ctx.lineTo(-r.w / 2, 38);
    ctx.moveTo(r.w / 2, -38); ctx.lineTo(r.w / 2, 38);
    ctx.stroke();

    ctx.font = '900 13px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.fillText('⚓ DRAWBRIDGE', 0, 0);

    ctx.restore();
  }

  /* ------------------------------------------------------------ TNT Barrels */
  drawTnt(r, y) {
    const ctx = this.ctx;
    for (const b of r.barrels) {
      ctx.save();
      ctx.translate(b.x, y);

      // Red Explosive Barrel
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-b.r, -b.r * 1.1, b.r * 2, b.r * 2.2, 8);
      ctx.fill(); ctx.stroke();

      // Steel hoops
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-b.r, -b.r * 0.6, b.r * 2, 4);
      ctx.fillRect(-b.r, b.r * 0.6 - 4, b.r * 2, 4);

      // Flashing Fuse
      ctx.fillStyle = Math.sin(this.t * 16) > 0 ? '#fef08a' : '#f97316';
      ctx.beginPath();
      ctx.arc(0, -b.r * 1.1 - 4, 4, 0, TAU);
      ctx.fill();

      ctx.font = '900 14px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('TNT', 0, 2);

      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ Powerup / Cannon */
  drawPowerup(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x, y);

    if (r.type === 'cannon') {
      // Golden Recruiter Cannon
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = '900 24px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚀 +15 BEANS', 0, 6);
    } else {
      // Nitro Speed Pad
      ctx.fillStyle = 'rgba(74, 222, 128, 0.25)';
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = '900 24px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ NITRO RUSH', 0, 6);
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------ Rolling Jawbreaker Boulder */
  drawBoulder(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x, y);
    ctx.rotate(r.rot);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r.r, 0, TAU);
    ctx.fill(); ctx.stroke();

    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, r.r * 0.65, 0, TAU); ctx.stroke();

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r.r * 0.35, 0, TAU); ctx.stroke();

    ctx.restore();
  }

  /* ------------------------------------------------------------ Golden Coins */
  drawCoins(r, y) {
    const ctx = this.ctx;
    for (const c of r.coins) {
      if (c.collected) continue;
      ctx.save();
      ctx.translate(c.x, y + c.yOff);

      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.fill(); ctx.stroke();

      ctx.font = '900 11px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#78350f';
      ctx.fillText('£', 0, 1);

      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ Milestone Bosses (Real Animated Titans!) */
  drawBoss(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x, y);

    // Dynamic ground shockwaves on slam
    for (const sw of r.shockwaves) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, sw.r, 0, TAU);
      ctx.stroke();

      // Splinter debris along shockwave ring
      ctx.fillStyle = '#b45309';
      for (let a = 0; a < TAU; a += 0.8) {
        ctx.fillRect(Math.cos(a) * sw.r - 3, Math.sin(a) * sw.r - 3, 6, 6);
      }
    }

    // Render character based on boss archetype
    if (r.type === 'captain') {
      this.drawPirateCaptainCrump(r, ctx);
    } else if (r.type === 'kraken') {
      this.drawMerseyKrakenMecha(r, ctx);
    } else {
      this.drawRoyalDockColossus(r, ctx);
    }

    // Deluxe Themed Health Bar
    this.drawBossHealthBar(r, ctx);

    ctx.restore();
  }

  /* 1. PIRATE CAPTAIN CRUMP — The Dreaded Liverpool Dock Scallywag */
  drawPirateCaptainCrump(r, ctx) {
    const bob = Math.sin(this.t * 7) * 4;
    const isAttacking = r.slamTimer > 0.9;
    const cutlassRot = isAttacking ? 0.9 : Math.sin(this.t * 5) * 0.25;

    // A. Wooden Peg Leg (Left) & Heavy Naval Boot (Right)
    // Left Peg Leg
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-28, 30 + bob, 12, 38, 4);
    ctx.fill(); ctx.stroke();
    // Iron ferrule tip
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-28, 62 + bob, 12, 6);

    // Right Naval Sea Boot
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(14, 30 + bob, 20, 38, 6);
    ctx.fill(); ctx.stroke();
    // Gold buckle
    ctx.fillStyle = '#facc15';
    ctx.fillRect(18, 48 + bob, 12, 8);

    // B. Crimson Royal Admiral Coat & Body
    ctx.fillStyle = '#991b1b';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-46, -30 + bob, 92, 68, 16);
    ctx.fill(); ctx.stroke();

    // Gold Frogging & Brass Coat Buttons
    ctx.fillStyle = '#facc15';
    for (let by = -20; by <= 20; by += 12) {
      ctx.beginPath();
      ctx.arc(-16, by + bob, 4, 0, TAU);
      ctx.arc(16, by + bob, 4, 0, TAU);
      ctx.fill();
    }

    // White Ruffled Silk Cravat
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(0, -18 + bob, 14, 18, 0, 0, TAU);
    ctx.fill();

    // Gold Shoulder Epaulets with Fringe
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-52, -32 + bob, 16, 10);
    ctx.fillRect(36, -32 + bob, 16, 10);

    // Wide Black Leather Sword Belt with Gold Skull Buckle
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-44, 16 + bob, 88, 14);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(-14, 13 + bob, 28, 20, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#140924';
    ctx.font = '900 10px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💀', 0, 24 + bob);

    // C. Left Arm: Menacing Iron Pirate Hook
    ctx.save();
    ctx.translate(-46, -10 + bob);
    ctx.rotate(Math.sin(this.t * 6) * 0.2);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-10, 0, 14, 22);
    ctx.strokeRect(-10, 0, 14, 22);
    // Iron Hook
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-3, 30, 12, 0.4, Math.PI * 1.5, false);
    ctx.stroke();
    ctx.restore();

    // D. Right Arm: Giant Raised Pirate Cutlass
    ctx.save();
    ctx.translate(46, -16 + bob);
    ctx.rotate(cutlassRot);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-4, 0, 14, 20);
    ctx.strokeRect(-4, 0, 14, 20);
    // Brass Cutlass Guard
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(3, 20, 8, 0, TAU); ctx.fill();
    // Curved Steel Blade
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(3, 20);
    ctx.quadraticCurveTo(24, 0, 32, -45);
    ctx.quadraticCurveTo(16, -35, 3, 20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // E. Menacing Scallywag Head & Face
    ctx.fillStyle = '#fbcfe8';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-24, -62 + bob, 48, 42, 10);
    ctx.fill(); ctx.stroke();

    // Bushy Black Pirate Beard
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, -32 + bob, 22, 0, Math.PI);
    ctx.fill();

    // Grimace & Shiny Gold Tooth
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-12, -40 + bob, 24, 6);
    ctx.fillStyle = '#facc15'; // Gold tooth!
    ctx.fillRect(-2, -40 + bob, 6, 6);

    // Angry Left Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(10, -50 + bob, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(11, -50 + bob, 3, 0, TAU); ctx.fill();
    // Bushy Eyebrow
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(4, -58 + bob); ctx.lineTo(18, -54 + bob); ctx.stroke();

    // Leather Eyepatch (Right Eye)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(-10, -50 + bob, 7, 0, TAU); ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-24, -56 + bob); ctx.lineTo(4, -44 + bob); ctx.stroke();

    // F. Massive Feathery Black Tricorn Hat
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-54, -62 + bob);
    ctx.quadraticCurveTo(0, -82 + bob, 54, -62 + bob);
    ctx.lineTo(40, -96 + bob);
    ctx.quadraticCurveTo(0, -104 + bob, -40, -96 + bob);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Gold Hat Trim
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-50, -64 + bob);
    ctx.quadraticCurveTo(0, -80 + bob, 50, -64 + bob);
    ctx.stroke();

    // Jolly Roger Skull Emblem
    ctx.font = '900 18px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('☠️', 0, -78 + bob);

    // Red Feather Plume
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.ellipse(32, -100 + bob, 8, 18, 0.4, 0, TAU);
    ctx.fill();
  }

  /* 2. MERSEY KRAKEN MECHA — The Steampunk Submersible Dock Monster */
  drawMerseyKrakenMecha(r, ctx) {
    const bob = Math.sin(this.t * 6) * 5;

    // A. 4 Animated Segmented Mechanical Tentacles
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#92400e';
    ctx.fillStyle = '#b45309';

    // Left Tentacles (T1, T2)
    const tL1 = Math.sin(this.t * 4) * 25;
    const tL2 = Math.cos(this.t * 3.5) * 30;
    ctx.beginPath();
    ctx.moveTo(-35, 10 + bob);
    ctx.bezierCurveTo(-85, -20 + bob, -110 + tL1, 30 + bob, -135, 5 + bob);
    ctx.stroke();
    // Spiked iron claw
    ctx.fillStyle = '#334155';
    ctx.beginPath(); ctx.arc(-135, 5 + bob, 10, 0, TAU); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-30, 25 + bob);
    ctx.bezierCurveTo(-75, 45 + bob, -95 + tL2, 85 + bob, -125, 60 + bob);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(-125, 60 + bob, 9, 0, TAU); ctx.fill();

    // Right Tentacles (T3, T4)
    const tR1 = Math.cos(this.t * 4.2) * 25;
    const tR2 = Math.sin(this.t * 3.7) * 30;
    ctx.beginPath();
    ctx.moveTo(35, 10 + bob);
    ctx.bezierCurveTo(85, -20 + bob, 110 + tR1, 30 + bob, 135, 5 + bob);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(135, 5 + bob, 10, 0, TAU); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(30, 25 + bob);
    ctx.bezierCurveTo(75, 45 + bob, 95 + tR2, 85 + bob, 125, 60 + bob);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(125, 60 + bob, 9, 0, TAU); ctx.fill();

    // Brass Suction Cups along tentacles
    ctx.fillStyle = '#facc15';
    for (let cx = -110; cx <= 110; cx += 28) {
      if (Math.abs(cx) > 45) {
        ctx.beginPath(); ctx.arc(cx, 16 + bob, 4, 0, TAU); ctx.fill();
      }
    }

    // B. Twin Brass Steam Exhaust Smokestacks
    ctx.fillStyle = '#b45309';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 3;
    ctx.fillRect(-34, -70 + bob, 16, 26); ctx.strokeRect(-34, -70 + bob, 16, 26);
    ctx.fillRect(18, -70 + bob, 16, 26); ctx.strokeRect(18, -70 + bob, 16, 26);

    // Billowing White Steam Puffs
    ctx.fillStyle = 'rgba(241, 245, 249, 0.7)';
    const steam1 = (this.t * 30) % 20;
    const steam2 = ((this.t + 0.5) * 30) % 20;
    ctx.beginPath();
    ctx.arc(-26, -78 + bob - steam1, 10 + steam1 * 0.4, 0, TAU);
    ctx.arc(26, -78 + bob - steam2, 10 + steam2 * 0.4, 0, TAU);
    ctx.fill();

    // C. Heavy Riveted Bronze Diving-Bell Chassis
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, bob, 52, 0, TAU);
    ctx.fill(); ctx.stroke();

    // Rivet Perimeter Ring
    ctx.fillStyle = '#fef08a';
    for (let a = 0; a < TAU; a += TAU / 10) {
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 44, Math.sin(a) * 44 + bob, 3, 0, TAU);
      ctx.fill();
    }

    // D. Giant Glowing Cyan Cyclops Viewport Lens
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(0, -4 + bob, 28, 0, TAU); ctx.fill();
    ctx.stroke();

    // Glowing cyan glass
    const cg = ctx.createRadialGradient(0, -4 + bob, 4, 0, -4 + bob, 24);
    cg.addColorStop(0, '#e0f2fe');
    cg.addColorStop(0.4, '#38bdf8');
    cg.addColorStop(0.85, '#0284c7');
    cg.addColorStop(1, '#0369a1');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, -4 + bob, 22, 0, TAU); ctx.fill();

    // Specular reflection glint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(-7, -11 + bob, 8, 4, -0.4, 0, TAU);
    ctx.fill();

    // E. Spinning Brass Cogs & Iron Jaw Grate
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-24, 24 + bob, 48, 12);
    ctx.fillStyle = '#f59e0b';
    for (let jx = -20; jx <= 16; jx += 8) {
      ctx.fillRect(jx, 26 + bob, 4, 8);
    }
  }

  /* 3. ROYAL ALBERT SUGAR COLOSSUS — The Victorian Dock Golem */
  drawRoyalDockColossus(r, ctx) {
    const bob = Math.sin(this.t * 5) * 3;
    const beaconRot = this.t * 2.8;

    // A. Sweeping Lighthouse Beacon Light Cone (Atmospheric Fog)
    ctx.save();
    ctx.translate(0, -78 + bob);
    ctx.rotate(beaconRot);
    const bg = ctx.createRadialGradient(0, 0, 5, 0, 0, 280);
    bg.addColorStop(0, 'rgba(254, 240, 138, 0.7)');
    bg.addColorStop(0.4, 'rgba(250, 204, 21, 0.25)');
    bg.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 280, -0.4, 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // B. Miniature Maritime Lighthouse Crown on Top of Head
    // Base platform
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 3;
    ctx.fillRect(-22, -62 + bob, 44, 8);
    ctx.strokeRect(-22, -62 + bob, 44, 8);

    // Red & White Striped Lighthouse Tower
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-14, -86 + bob, 28, 24);
    ctx.strokeRect(-14, -86 + bob, 28, 24);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-14, -80 + bob, 28, 8);

    // Glass Lantern Room & Dome
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, -92 + bob, 10, Math.PI, 0);
    ctx.fill(); ctx.stroke();

    // C. Giant Sugar-Brick Masonry Torso & Shoulders
    ctx.fillStyle = '#7f1d1d';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(-54, -40 + bob, 108, 82, 14);
    ctx.fill(); ctx.stroke();

    // Brick mortar lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    for (let my = -30; my <= 30; my += 14) {
      ctx.beginPath();
      ctx.moveTo(-50, my + bob); ctx.lineTo(50, my + bob);
      ctx.stroke();
    }

    // Carved Granite Coping Stones on Shoulders
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 3;
    ctx.fillRect(-58, -44 + bob, 22, 14); ctx.strokeRect(-58, -44 + bob, 22, 14);
    ctx.fillRect(36, -44 + bob, 22, 14); ctx.strokeRect(36, -44 + bob, 22, 14);

    // D. Molten Caramel Furnace Boiler in Chest
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-22, -10 + bob, 44, 38, 8);
    ctx.fill(); ctx.stroke();

    // Glowing fire core
    const fg = ctx.createRadialGradient(0, 9 + bob, 2, 0, 9 + bob, 18);
    fg.addColorStop(0, '#fef08a');
    fg.addColorStop(0.5, '#f97316');
    fg.addColorStop(1, '#dc2626');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(0, 9 + bob, 16, 0, TAU); ctx.fill();

    // Iron furnace cross-bars
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-20, 7 + bob, 40, 4);
    ctx.fillRect(-2, -8 + bob, 4, 34);

    // E. Heavy Steel Crane Arm & Spiked Anchor Wrecking Fist
    // Left Fist: Brick Piston
    ctx.fillStyle = '#7f1d1d';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-78, -12 + bob, 26, 32, 8);
    ctx.fill(); ctx.stroke();

    // Right Arm: Industrial Crane Lattice Boom & Naval Anchor
    ctx.fillStyle = '#eab308';
    ctx.fillRect(52, -26 + bob, 24, 14);
    ctx.strokeRect(52, -26 + bob, 24, 14);

    // Heavy Iron Links Chain
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(64, -12 + bob);
    ctx.lineTo(64, 26 + bob);
    ctx.stroke();

    // Colossal Spiked Naval Anchor
    ctx.save();
    ctx.translate(64, 38 + bob);
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, -12, 8, 0, TAU); // Ring
    ctx.fill(); ctx.stroke();
    ctx.fillRect(-4, -4, 8, 28); // Shank
    ctx.strokeRect(-4, -4, 8, 28);
    ctx.beginPath(); // Flukes
    ctx.arc(0, 16, 22, 0.2, Math.PI - 0.2);
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.restore();

    // F. Glowing Molten Eyes beneath Heavy Brow
    ctx.fillStyle = '#140924';
    ctx.fillRect(-26, -34 + bob, 52, 10);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(-12, -29 + bob, 4.5, 0, TAU);
    ctx.arc(12, -29 + bob, 4.5, 0, TAU);
    ctx.fill();
  }

  /* Universal Deluxe Boss Health Bar */
  drawBossHealthBar(r, ctx) {
    const hpPct = clamp(r.hp / r.maxHp, 0, 1);
    const barW = 160;
    const barH = 16;
    const barY = r.r + 36; // Positioned below boss character to avoid HUD overlap

    // Outer Chrome Shield Frame
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-barW / 2 - 4, barY - 4, barW + 8, barH + 8, 8);
    ctx.fill(); ctx.stroke();

    // Empty Track
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(-barW / 2, barY, barW, barH, 5);
    ctx.fill();

    // Glowing Animated Health Fill
    const hg = ctx.createLinearGradient(-barW / 2, 0, barW / 2, 0);
    if (hpPct > 0.5) {
      hg.addColorStop(0, '#22c55e');
      hg.addColorStop(1, '#4ade80');
    } else if (hpPct > 0.25) {
      hg.addColorStop(0, '#eab308');
      hg.addColorStop(1, '#facc15');
    } else {
      hg.addColorStop(0, '#dc2626');
      hg.addColorStop(1, '#f87171');
    }
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.roundRect(-barW / 2, barY, barW * hpPct, barH, 5);
    ctx.fill();

    // HP Text & Percent
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 10.5px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HP: ${Math.max(0, Math.round(r.hp))} / ${r.maxHp}`, 0, barY + barH / 2);

    // Grand Boss Title Banner
    ctx.font = '900 22px Outfit, system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#140924';
    ctx.strokeText(`👑 ${r.title}`, 0, barY - 18);
    ctx.fillStyle = '#fde047';
    ctx.fillText(`👑 ${r.title}`, 0, barY - 18);
  }

  /* ------------------------------------------------------------ Iconic Victory Multiplier Stairs */
  renderVictoryStairs(ctx, W, H) {
    const steps = [
      { step: 1, mult: 1.2, color: '#fde047' },
      { step: 2, mult: 1.5, color: '#facc15' },
      { step: 3, mult: 2.0, color: '#fbbf24' },
      { step: 4, mult: 3.0, color: '#f59e0b' },
      { step: 5, mult: 5.0, color: '#d97706' },
      { step: 6, mult: 10.0, color: '#b45309' },
    ];

    ctx.save();
    steps.forEach((s, i) => {
      const sy = 480 - i * 50;
      const sw = 220 - i * 16;
      const sx = MID - sw / 2;

      ctx.fillStyle = s.color;
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 3.5;
      ctx.fillRect(sx, sy, sw, 40);
      ctx.strokeRect(sx, sy, sw, 40);

      ctx.font = '900 24px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeText(`STEP ${s.step} · ×${s.mult}`, MID, sy + 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`STEP ${s.step} · ×${s.mult}`, MID, sy + 20);
    });
    ctx.restore();
  }

  /* ------------------------------------------------------------ Living Jellybean Crowd Mascot */
  drawLivingCrowd(cx, cy, n, customColor = null, flip = 1) {
    const ctx = this.ctx;
    const isPlayer = flip > 0;
    const isFast = (this.boostTimer > 0 || this.feverRush > 0) && isPlayer;

    for (let i = 0; i < n; i++) {
      const a = i * 2.39996;
      const r = 5.6 * Math.sqrt(i + 0.5);
      const x = cx + Math.cos(a) * r;
      const bounce = Math.sin(this.t * 16 + i * 0.5) * 2.5;
      const y = cy + Math.sin(a) * r * 0.85 * flip + bounce;

      const color = isFast
        ? '#3dffa2'
        : customColor || (i % 3 === 0 ? '#38bdf8' : i % 3 === 1 ? '#f472b6' : '#facc15');
      const outline = '#140924';

      // Leader Captain Bean
      if (i === 0 && isPlayer) {
        drawBean(ctx, x, y - 6, 26, {
          color: isFast ? '#3dffa2' : '#0284c7',
          bellyColor: '#fda4af',
          squash: 1.08,
          walkT: this.t * 3.5,
          hat: 'crown',
          eyes: 'happy',
        });
        continue;
      }

      // Mini Runner Bean Body
      const bw = 5.4;
      const bh = 8.0;

      ctx.fillStyle = outline;
      ctx.beginPath();
      ctx.arc(x, y - bh * 0.35, bw + 1.8, Math.PI, 0);
      ctx.arc(x, y + bh * 0.35, bw + 1.8, 0, Math.PI);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y - bh * 0.35, bw, Math.PI, 0);
      ctx.arc(x, y + bh * 0.35, bw, 0, Math.PI);
      ctx.closePath();
      ctx.fill();

      // Specular shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(x - bw * 0.35, y - bh * 0.45, 1.8, 0, TAU);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#140924';
      ctx.beginPath();
      ctx.arc(x - 2.0, y - 1, 1.2, 0, TAU);
      ctx.arc(x + 2.0, y - 1, 1.2, 0, TAU);
      ctx.fill();
    }
  }

  /* ------------------------------------------------------------ Clean HUD */
  renderHUD(ctx, W, H) {
    const pillX = 14;
    const pillY = 105;
    const distM = Math.round(this.dist / 10);

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, 230, 52, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 13px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⚓ ALBERT DOCK RUSH · ${distM}m`, pillX + 14, pillY + 18);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 11px Outfit, system-ui, sans-serif';
    ctx.fillText(`ARMY: ${fmt(this.count)} BEANS`, pillX + 14, pillY + 32);

    if (this.boostTimer > 0) {
      ctx.fillStyle = '#3dffa2';
      ctx.font = '800 10px Outfit, system-ui, sans-serif';
      ctx.fillText(`⚡ NITRO RUSH! ${this.boostTimer.toFixed(1)}s`, pillX + 14, pillY + 45);
    } else if (this.feverRush > 0) {
      ctx.fillStyle = '#fde047';
      ctx.font = '800 10px Outfit, system-ui, sans-serif';
      ctx.fillText(`🔥 FEVER SPEED! ${this.feverRush.toFixed(1)}s`, pillX + 14, pillY + 45);
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '800 10px Outfit, system-ui, sans-serif';
      const toBoss = Math.max(0, Math.round((this.nextMilestone - this.dist) / 10));
      ctx.fillText(`● BOSS IN ${toBoss}m`, pillX + 14, pillY + 45);
    }

    ctx.restore();
  }
}
