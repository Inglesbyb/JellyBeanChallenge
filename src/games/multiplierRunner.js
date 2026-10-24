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
    hint: 'DRAG left/right! Pick +2/-2 gates, dodge dock hazards & build your squad to defeat the 10, 20 & 30 Bean Bosses!',
    baseLikes: 4320,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.count = 10; // Exactly 10 starting jellybeans as requested!
    this.dist = saved ? saved.dist : 0;
    this.crowdX = MID;
    this.targetX = this.crowdX;
    this.rows = [];
    this.t = 0;
    this.speed = 195; // Tactically readable speed
    this.boostTimer = 0;
    this.feverRush = 0;

    // Stage progression: Boss 1: 10, Boss 2: 20, Boss 3: 30, etc.
    this.stage = saved?.stage || 1;
    this.bossState = 'none'; // 'none' | 'stairs'
    this.stairsProgress = 0;
    this.stairsScoreMult = 1;

    // Visual scenery props along the quayside
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
    this.initStage(this.stage);
  }

  serialize() {
    return {
      count: Math.round(this.count),
      dist: this.dist,
      stage: this.stage,
    };
  }

  restoreLabel() {
    return `${Math.round(this.count)} dock runners (Stage ${this.stage})`;
  }

  crowdRadius() {
    return clamp(8 + 3.8 * Math.sqrt(Math.min(this.count, 60)), 16, 52);
  }

  /* ------------------------------------------------------------ Stage & Boss Progression */
  initStage(stage) {
    this.stage = stage;
    this.bossReq = stage * 10; // Boss 1 = 10, Boss 2 = 20, Boss 3 = 30...
    this.stageStartDist = this.dist;
    this.stageLength = 2200;
    this.bossDist = this.stageStartDist + this.stageLength;
    this.spawnStageRows(stage);
  }

  spawnStageRows(stage) {
    const startD = this.stageStartDist + 350;
    const endD = this.bossDist - 250;
    const gap = 270;
    let curD = startD;
    let step = 0;

    while (curD < endD) {
      if (step % 2 === 0) {
        this.rows.push(this.makeStageGate(curD, stage, step));
      } else {
        this.rows.push(this.makeStageObstacle(curD, stage, step));
      }
      curD += gap;
      step++;
    }

    // Boss waiting at the end of the stage
    this.rows.push(this.makeBossRow(this.bossDist, stage));
  }

  makeBossRow(d, stage) {
    const req = stage * 10;
    const hp = req;
    let title, color, type;

    if (stage === 1) {
      type = 'captain';
      title = 'PIRATE CAPTAIN CRUMP';
      color = '#e63946';
    } else if (stage === 2) {
      type = 'kraken';
      title = 'MERSEY KRAKEN MECHA';
      color = '#7209b7';
    } else if (stage === 3) {
      type = 'colossus';
      title = 'ROYAL DOCK LEVIATHAN';
      color = '#f72585';
    } else {
      const bossTypes = [
        { type: 'captain', title: `DREAD PIRATE CRUMP Mk.${stage}`, color: '#e63946' },
        { type: 'kraken', title: `MERSEY CYBER KRAKEN Mk.${stage}`, color: '#7209b7' },
        { type: 'colossus', title: `ROYAL ALBERT COLOSSUS Mk.${stage}`, color: '#f72585' },
      ];
      const b = bossTypes[(stage - 1) % 3];
      type = b.type;
      title = b.title;
      color = b.color;
    }

    return {
      d,
      stage,
      kind: 'boss',
      done: false,
      type,
      title,
      req,
      hp,
      maxHp: hp,
      x: MID,
      y: 0,
      r: 68,
      slamTimer: 0,
      shockwaves: [],
      defeated: false,
      clashing: false,
      clashTimer: 0,
    };
  }

  /* ------------------------------------------------------------ Tactical Math Gates (+2 / -2) */
  makeStageGate(d, stage, step) {
    const isMoving = stage >= 2 && Math.random() < 0.3;
    let leftGate, rightGate;

    // Tactical calculated values:
    const baseAdd = Math.min(5, 2 + Math.floor(stage * 0.6)); // 2 for stg 1, 3 for stg 2, 4 for stg 3
    const bigAdd = baseAdd + 1;
    const smallAdd = Math.max(1, baseAdd - 1);
    const penVal = Math.min(4, 2 + Math.floor(stage * 0.4)); // 2 for stg 1, 3 for stg 2

    const roll = Math.random();
    if (roll < 0.45) {
      // Dilemma: Boost vs Penalty (+3 vs -2 or +2 vs -2)
      const isLeftGood = Math.random() < 0.5;
      const goodGate = { op: '+', v: Math.random() < 0.5 ? baseAdd : bigAdd, good: true };
      const badGate = { op: '−', v: penVal, good: false };
      leftGate = isLeftGood ? goodGate : badGate;
      rightGate = isLeftGood ? badGate : goodGate;
    } else if (roll < 0.8) {
      // Choice: Big Boost vs Small Boost (+3 vs +1)
      const isLeftBig = Math.random() < 0.5;
      const g1 = { op: '+', v: bigAdd, good: true };
      const g2 = { op: '+', v: smallAdd, good: true };
      leftGate = isLeftBig ? g1 : g2;
      rightGate = isLeftBig ? g2 : g1;
    } else {
      // Lesser Penalty: Small loss vs Larger loss (-1 vs -3)
      const isLeftSmall = Math.random() < 0.5;
      const g1 = { op: '−', v: Math.max(1, penVal - 1), good: false };
      const g2 = { op: '−', v: penVal + 1, good: false };
      leftGate = isLeftSmall ? g1 : g2;
      rightGate = isLeftSmall ? g2 : g1;
    }

    return {
      d,
      kind: 'gate',
      gates: [leftGate, rightGate],
      isMoving,
      movePhase: Math.random() * TAU,
      moveAmp: 28,
      done: false,
    };
  }

  /* ------------------------------------------------------------ Stage Obstacles */
  makeStageObstacle(d, stage, step) {
    const obsTypes = ['boulder', 'tnt', 'sweeper', 'drawbridge', 'gang', 'powerup', 'coins'];
    const typeIdx = (step + stage * 2) % obsTypes.length;
    const kind = obsTypes[typeIdx];

    if (kind === 'boulder') {
      const lane = Math.random() < 0.4 ? MID : Math.random() < 0.5 ? TRACK_L + 80 : TRACK_R - 80;
      return { d, kind: 'boulder', done: false, x: lane, r: 32, rot: 0 };
    }
    if (kind === 'tnt') {
      const centerTnt = Math.random() < 0.5;
      const barrels = [];
      if (centerTnt) {
        barrels.push({ x: MID, r: 22, fuseT: 0 });
      } else {
        barrels.push({ x: TRACK_L + 75, r: 22, fuseT: 0 });
        barrels.push({ x: TRACK_R - 75, r: 22, fuseT: 0 });
      }
      return { d, kind: 'tnt', done: false, barrels };
    }
    if (kind === 'sweeper') {
      return {
        d,
        kind: 'sweeper',
        done: false,
        angle: Math.random() * TAU,
        rotSpeed: 2.2 + stage * 0.3,
        beamLen: 165,
        gapDist: 65,
      };
    }
    if (kind === 'drawbridge') {
      const bridgeW = 120;
      const bridgeX = rand(TRACK_L + bridgeW / 2 + 20, TRACK_R - bridgeW / 2 - 20);
      return { d, kind: 'drawbridge', done: false, x: bridgeX, w: bridgeW, length: 180 };
    }
    if (kind === 'gang') {
      const gangCount = 2 + Math.min(3, Math.floor(stage * 0.7)); // 2-4 scallywags
      const lane = Math.random() < 0.5 ? TRACK_L + 80 : TRACK_R - 80;
      return {
        d,
        kind: 'gang',
        done: false,
        x: lane,
        n: gangCount,
        maxN: gangCount,
        r: 24,
        clashing: false,
        clashT: 0,
      };
    }
    if (kind === 'powerup') {
      const type = Math.random() < 0.6 ? 'cannon' : 'nitro';
      const x = Math.random() < 0.5 ? TRACK_L + 85 : TRACK_R - 85;
      return { d, kind: 'powerup', type, done: false, x, w: 68, h: 46 };
    }
    // coins
    const coinLane = Math.random() < 0.5 ? TRACK_L + 50 : TRACK_R - 50;
    return {
      d,
      kind: 'coins',
      done: false,
      coins: [
        { x: coinLane, yOff: -25, collected: false },
        { x: coinLane, yOff: 0, collected: false },
        { x: coinLane, yOff: 25, collected: false },
      ],
    };
  }

  getUpcomingBoss() {
    return this.rows.find((r) => r.kind === 'boss' && !r.defeated) || null;
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

    // Speed calculation
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      this.speed = 330;
    } else if (this.feverRush > 0) {
      this.feverRush -= dt;
      this.speed = 265;
    } else {
      this.speed = 195 + Math.min(50, this.stage * 10);
    }

    this.dist += this.speed * dt;
    this.score += (this.speed * dt) / 6;

    const rad = this.crowdRadius();

    // Responsive Drag & Arrow Steering
    const minX = TRACK_L + rad * 0.75;
    const maxX = TRACK_R - rad * 0.75;

    if (this.input.down) {
      const target = clamp(this.input.x, minX, maxX);
      this.crowdX += (target - this.crowdX) * Math.min(1, dt * 55);
      this.targetX = this.crowdX;
    } else {
      let steerVel = 0;
      if (this.input.key('arrowleft', 'a')) steerVel -= 820;
      if (this.input.key('arrowright', 'd')) steerVel += 820;
      if (this.input.frameDX) steerVel += this.input.frameDX * 65;

      this.crowdX = clamp(this.crowdX + steerVel * dt, minX, maxX);
      this.targetX = this.crowdX;
    }

    // Process Track Rows
    for (const r of this.rows) {
      if (r.done) continue;

      if (r.kind === 'sweeper') {
        r.angle += r.rotSpeed * dt;
      } else if (r.kind === 'boulder') {
        r.rot += dt * 8;
      } else if (r.kind === 'boss') {
        const distToBoss = r.d - this.dist;
        if (distToBoss < 500 && distToBoss > -50 && !r.defeated) {
          const bossSpd = 75 * dt;
          r.x += clamp(this.crowdX - r.x, -bossSpd, bossSpd);
          r.x = clamp(r.x, TRACK_L + 60, TRACK_R - 60);
        }
        this.updateBoss(r, dt);
      }

      // Check collision when row reaches player height
      if (r.d <= this.dist) {
        if (!r.done && r.kind !== 'boss') {
          r.done = true;
          this.resolveRow(r, rad);
          if (this.dead) break;
        }
      }
    }

    // Prune completed rows behind the camera
    this.rows = this.rows.filter((r) => r.d > this.dist - 350 || (r.kind === 'boss' && !r.defeated));
    this.fx.update(dt);
  }

  /* ------------------------------------------------------------ Row Collision Resolvers */
  resolveRow(r, rad) {
    const y = CROWD_Y - 20;

    // 1. Dual Multiplier Gates with Central Spike Divider
    if (r.kind === 'gate') {
      const midX = MID + (r.isMoving ? Math.sin(this.t * 3 + r.movePhase) * r.moveAmp : 0);
      const dividerW = 26;
      const dividerLeft = midX - dividerW / 2;
      const dividerRight = midX + dividerW / 2;

      // Crashed into central post?
      if (this.crowdX > dividerLeft - rad * 0.45 && this.crowdX < dividerRight + rad * 0.45) {
        const cut = 2; // Clean deduction of 2 beans
        this.count = Math.max(0, this.count - cut);

        this.fx.text(this.crowdX, y - 30, `IMPALED ON POST! −${cut}`, '#ff0054', 28, 1.1);
        this.fx.burst(midX, CROWD_Y, '#ff0054', 22, 240, 0.6, 4);
        this.fx.shake(10, 0.35);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Shredded by central dock mooring post!');
          return;
        }
      }

      // Determine which gate was chosen
      const chosenIdx = this.crowdX < midX ? 0 : 1;
      const g = r.gates[chosenIdx];

      if (g.op === '+') {
        this.count += g.v;
        this.score += 50 * this.stage;
        this.fx.text(this.crowdX, y - rad - 28, `+${g.v} BEANS! ✨`, '#38bdf8', 34, 1.0);
        this.fx.ring(this.crowdX, CROWD_Y, '#38bdf8', rad * 2.8, 0.5, 5);
        this.fx.burst(this.crowdX, CROWD_Y, '#38bdf8', 20, 220, 0.55, 4);
        this.sounds.gate(true);
        this.haptics.medium();
      } else {
        this.count = Math.max(0, this.count - g.v);
        this.fx.text(this.crowdX, y - rad - 28, `PENALTY! −${g.v}`, '#ff0054', 32, 1.0);
        this.fx.burst(this.crowdX, CROWD_Y, '#ff0054', 22, 220, 0.55, 4);
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

      const armCos = Math.cos(r.angle);
      const beamX = MID + armCos * r.gapDist;

      if (Math.abs(this.crowdX - beamX) > rad + 24) {
        const loss = 2; // Exactly 2 beans
        this.count = Math.max(0, this.count - loss);

        this.fx.text(this.crowdX, y - 24, `SWEPT OFF QUAY! −${loss}`, '#ff7a88', 26, 0.9);
        this.fx.burst(this.crowdX, CROWD_Y, '#6a040f', 20, 220, 0.5, 4);
        this.fx.shake(9, 0.35);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Swept into the Mersey by rotating dock boom!');
          return;
        }
      } else {
        this.score += 25;
        this.fx.text(this.crowdX, y - 22, 'PERFECT TIMING! +25', '#3dffa2', 18, 0.6);
      }
    }

    // 3. Rival Dock Gang
    else if (r.kind === 'gang') {
      const hit = Math.abs(r.x - this.crowdX) < rad + r.r * 0.85;
      if (hit) {
        if (this.boostTimer > 0) {
          this.score += r.maxN * 50;
          this.fx.text(r.x, y - 30, 'GANG CRUSHED! 🚀', '#ffd166', 26, 0.9);
          this.fx.burst(r.x, CROWD_Y, '#ef4444', 24, 240, 0.6, 4);
          this.sounds.hit();
        } else {
          const loss = Math.min(this.count, r.n);
          this.count = Math.max(0, this.count - loss);
          this.fx.text(this.crowdX, y - 30, `GANG CLASH! −${loss}`, '#ff0054', 28, 1.0);
          this.fx.burst(r.x, CROWD_Y, '#ef4444', 20, 200, 0.5, 3.5);
          this.fx.shake(8, 0.3);
          this.sounds.hit();
          this.haptics.heavy();

          if (this.count <= 0) {
            this.die('Overwhelmed by rival dock gang!');
            return;
          }
        }
      } else {
        this.score += 30;
        this.fx.text(this.crowdX, y - 20, 'OUTMANEUVERED! +30', '#3dffa2', 18, 0.6);
      }
    }

    // 4. Albert Dock Drawbridge
    else if (r.kind === 'drawbridge') {
      if (this.crowdX < r.x - r.w / 2 || this.crowdX > r.x + r.w / 2) {
        if (this.boostTimer <= 0) {
          const loss = 2;
          this.count = Math.max(0, this.count - loss);
          this.fx.text(this.crowdX, y - 24, `FELL IN WATER! −${loss} 💦`, '#38bdf8', 26, 0.9);
          this.fx.burst(this.crowdX, CROWD_Y, '#0077b6', 20, 180, 0.5, 3.5);
          this.sounds.drop();
          this.haptics.medium();

          if (this.count <= 0) {
            this.die('Fell off the drawbridge into the Mersey Basin!');
            return;
          }
        }
      } else {
        this.score += 30;
        this.fx.text(this.crowdX, y - 20, 'SAFE CROSSING! +30', '#3dffa2', 18, 0.6);
      }
    }

    // 5. TNT Barrels
    else if (r.kind === 'tnt') {
      for (const b of r.barrels) {
        if (Math.abs(b.x - this.crowdX) < rad + b.r * 0.85) {
          if (this.boostTimer > 0) {
            this.score += 60;
            this.fx.text(b.x, y - 24, 'BARREL DEFUSED! 💥', '#ffd166', 24, 0.9);
            this.fx.burst(b.x, CROWD_Y, '#ff0054', 24, 260, 0.5, 4);
            continue;
          }

          const cut = 3; // Exactly 3 beans
          this.count = Math.max(0, this.count - cut);

          this.fx.text(b.x, y - 28, `BARREL BOOM! −${cut}`, '#ff0054', 28, 1.0);
          this.fx.burst(b.x, CROWD_Y, '#ff0054', 26, 280, 0.6, 5);
          this.fx.ring(b.x, CROWD_Y, '#ffd166', 220, 0.5, 5);
          this.fx.shake(12, 0.4);
          this.sounds.hit();
          this.haptics.heavy();

          if (this.count <= 0) {
            this.die('Blown up by maritime gunpowder barrel!');
            return;
          }
        }
      }
    }

    // 6. Powerup
    else if (r.kind === 'powerup') {
      if (Math.abs(r.x - this.crowdX) < rad + r.w * 0.5) {
        if (r.type === 'cannon') {
          const bonus = 3; // Exactly 3 recruits
          this.count += bonus;
          this.score += 150;
          this.fx.text(this.crowdX, y - 30, `CANNON RECRUITS! +${bonus} 🚀`, '#ffd166', 30, 1.1);
          this.fx.burst(this.crowdX, CROWD_Y, '#ffd166', 24, 240, 0.6, 4);
          this.sounds.up();
          this.haptics.heavy();
        } else {
          this.boostTimer = 2.8;
          this.score += 100;
          this.fx.text(this.crowdX, y - 30, 'NITRO TURBO! ⚡⚡', '#3dffa2', 30, 1.2);
          this.fx.ring(this.crowdX, CROWD_Y, '#3dffa2', 260, 0.5, 5);
          this.sounds.up();
          this.haptics.heavy();
        }
      }
    }

    // 7. Boulder
    else if (r.kind === 'boulder') {
      if (Math.abs(r.x - this.crowdX) < rad + r.r * 0.85) {
        if (this.boostTimer > 0) {
          this.score += 90;
          this.fx.text(this.crowdX, y - 24, 'BOULDER CRUSHED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(r.x, CROWD_Y, '#ff0054', 28, 280, 0.6, 4);
          this.sounds.hit();
          return;
        }

        const loss = 2; // Exactly 2 beans
        this.count = Math.max(0, this.count - loss);

        this.fx.text(r.x, y - 24, `RUN OVER! −${loss}`, '#ff7a88', 26, 0.9);
        this.fx.burst(r.x, CROWD_Y, '#ff0054', 22, 240, 0.55, 4);
        this.fx.shake(10, 0.35);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Crushed by rolling jawbreaker boulder!');
          return;
        }
      } else {
        this.score += 25;
        this.fx.text(this.crowdX, y - 22, 'CLOSE DODGE! +25', '#3dffa2', 18, 0.6);
      }
    }

    // 8. Coins
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

  /* ------------------------------------------------------------ Milestone Boss & Victory Stairs */
  updateBoss(r, dt) {
    if (r.defeated) return;

    const distToBoss = r.d - this.dist;

    // Check if player reached boss engagement range
    if (distToBoss <= 100 && !r.clashing) {
      if (this.count < r.req) {
        this.die(`Crushed by ${r.title}! Needed ${r.req} beans, but only brought ${Math.round(this.count)}!`);
        return;
      }
      r.clashing = true;
      r.clashTimer = 0;
      this.sounds.up();
      this.haptics.heavy();
      this.fx.text(MID, CROWD_Y - 90, '⚔️ SQUAD CHARGE! ⚔️', '#ffd166', 34, 1.2);
    }

    if (r.clashing) {
      r.clashTimer += dt;
      const drainRate = Math.max(14, r.maxHp * 1.6);
      const dmg = Math.min(r.hp, drainRate * dt);
      r.hp -= dmg;

      this.fx.burst(r.x + (Math.random() - 0.5) * 80, CROWD_Y - 50 + (Math.random() - 0.5) * 40, r.color, 3, 140, 0.3, 3);
      this.fx.shake(4, 0.1);
      if (Math.random() < 0.35) {
        this.sounds.hit();
        this.haptics.medium();
      }

      if (r.hp <= 0) {
        r.hp = 0;
        r.defeated = true;
        r.done = true;
        r.clashing = false;

        this.score += 1000 * this.stage;
        this.fx.text(MID, CROWD_Y - 90, `👑 ${r.title} DEFEATED! +${1000 * this.stage}`, '#ffd166', 32, 1.8);
        this.fx.ring(MID, CROWD_Y, '#ffd166', 380, 0.8, 8);
        this.fx.burst(MID, CROWD_Y, r.color, 50, 360, 0.9, 6);
        this.fx.burst(MID, CROWD_Y, '#ffd166', 40, 300, 0.8, 5);
        this.fx.shake(16, 0.6);
        this.sounds.survive();
        this.haptics.heavy();

        // Rescued recruits bonus
        const rescueBonus = 3 + this.stage * 2;
        this.count += rescueBonus;
        // Floor guarantee for next stage
        const targetNext = (this.stage + 1) * 10;
        this.count = Math.max(this.count, targetNext - 8);

        this.fx.text(MID, CROWD_Y - 40, `+${rescueBonus} RESCUED RECRUITS! 🎖️`, '#38bdf8', 26, 1.5);

        // Victory Multiplier Podium
        this.bossState = 'stairs';
        this.stairsProgress = 0;
        this.stairsScoreMult = 1.0;
      }
    }
  }

  updateStairs(dt) {
    this.stairsProgress += dt * 2.2;
    const steps = [
      { step: 1, mult: 1.2 },
      { step: 2, mult: 1.5 },
      { step: 3, mult: 2.0 },
    ];
    const curStepIdx = Math.min(steps.length - 1, Math.floor(this.stairsProgress));
    const step = steps[curStepIdx];

    if (this.stairsScoreMult < step.mult) {
      this.stairsScoreMult = step.mult;
      this.score += Math.round(250 * step.mult);
      this.fx.text(MID, 320 - curStepIdx * 45, `STEP ${step.step} · ×${step.mult}! 🎉`, '#ffd166', 30, 0.8);
      this.fx.burst(MID, 320 - curStepIdx * 45, '#ffd166', 16, 180, 0.5, 3.5);
      this.sounds.stack(step.step);
      this.haptics.medium();
    }

    if (this.stairsProgress >= steps.length + 0.6) {
      this.bossState = 'none';
      this.stage++;
      this.feverRush = 3.0;
      this.sounds.upgrade();
      this.fx.text(MID, CROWD_Y - 50, `STAGE ${this.stage}: TARGET ${this.stage * 10} BEANS! ⚡`, '#3dffa2', 28, 1.8);
      this.initStage(this.stage);
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
        else if (r.kind === 'boss') {
          this.drawBoss(r, y);
          // Approaching warning banner on the quayside
          const ready = this.count >= r.req;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '900 16px Outfit, system-ui, sans-serif';
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#140924';
          const txt = ready
            ? `🟢 SQUAD READY! (${Math.round(this.count)} / ${r.req} BEANS) 🟢`
            : `⚠️ ${r.title} · NEED ${r.req} BEANS! ⚠️`;
          ctx.strokeText(txt, MID, y + r.r + 62);
          ctx.fillStyle = ready ? '#3dffa2' : '#facc15';
          ctx.fillText(txt, MID, y + r.r + 62);
          ctx.restore();
        }
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
      ctx.strokeText(label, (x0 + x1) / 2, y + 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, (x0 + x1) / 2, y + 5);

      // Subtitle badge
      ctx.font = '900 12px Outfit, system-ui, sans-serif';
      ctx.lineWidth = 3.5;
      const subLabel = g.op === '+' ? `+${g.v} BEANS` : `−${g.v} BEANS`;
      ctx.strokeText(subLabel, (x0 + x1) / 2, y + 30);
      ctx.fillStyle = g.good ? '#fef08a' : '#fca5a5';
      ctx.fillText(subLabel, (x0 + x1) / 2, y + 30);

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
      ctx.fillText('🚀 +3 BEANS', 0, 6);
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
    const pillW = 295;
    const pillH = 74;

    ctx.save();
    // Glassmorphic dark badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.stroke();

    // Stage & Boss Title (Truncated cleanly if needed)
    const curBoss = this.getUpcomingBoss();
    const bossTitle = curBoss
      ? (curBoss.type === 'captain' ? 'CAPTAIN CRUMP' : curBoss.type === 'kraken' ? 'KRAKEN MECHA' : 'SUGAR COLOSSUS')
      : `BOSS ${this.stage}`;

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 12.5px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⚓ STAGE ${this.stage} · ${bossTitle}`, pillX + 14, pillY + 18);

    // Boss distance on top right
    const distToBoss = curBoss ? Math.max(0, Math.round((curBoss.d - this.dist) / 10)) : 0;
    ctx.fillStyle = '#fde047';
    ctx.font = '800 11px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(distToBoss > 0 ? `👑 BOSS IN ${distToBoss}m` : '👑 BOSS ENGAGED!', pillX + pillW - 14, pillY + 18);

    // Beans Count & Required
    const ready = this.count >= this.bossReq;
    ctx.font = '900 15px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ARMY: ', pillX + 14, pillY + 40);

    ctx.fillStyle = ready ? '#3dffa2' : '#f87171';
    ctx.fillText(`${Math.round(this.count)}`, pillX + 66, pillY + 40);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 13px Outfit, system-ui, sans-serif';
    ctx.fillText(`/ ${this.bossReq} REQ`, pillX + 96, pillY + 40);

    // Readiness Status Pill on Right
    ctx.font = '900 11px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'right';
    if (ready) {
      ctx.fillStyle = '#3dffa2';
      ctx.fillText('✅ READY FOR BOSS!', pillX + pillW - 14, pillY + 40);
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`⚠️ NEED ${this.bossReq - Math.round(this.count)} MORE!`, pillX + pillW - 14, pillY + 40);
    }

    // Mini Progress Bar to Boss at bottom of pill
    const stageTotalDist = curBoss ? (curBoss.d - this.stageStartDist) : 2200;
    const stageProgress = clamp((this.dist - this.stageStartDist) / stageTotalDist, 0, 1);

    const barX = pillX + 14;
    const barY = pillY + 54;
    const barW = pillW - 28;
    const barH = 7;

    // Track
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Progress fill
    ctx.fillStyle = ready ? '#3dffa2' : '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * stageProgress, barH, 4);
    ctx.fill();

    ctx.restore();
  }
}
