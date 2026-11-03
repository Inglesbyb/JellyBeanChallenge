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
    // Prestige rank (1 = first playthrough). Set by Reel.js before init().
    this.pLevel = Math.max(1, this.prestige || 1);
    this.count = (saved && Number.isFinite(saved.count) && saved.count > 0) ? saved.count : 10;
    this.dist = (saved && Number.isFinite(saved.dist)) ? saved.dist : 0;
    this.crowdX = MID;
    this.targetX = this.crowdX;
    this.rows = [];
    this.t = 0;
    this.speed = 195; // Tactically readable speed
    this.boostTimer = 0;
    this.feverRush = 0;
    this.slipTimer = 0; // Dynamic slippery fish oil drift state

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
  // Boss squad requirement/HP for a stage, +25% per prestige level.
  bossReqFor(stage) {
    return Math.round(stage * 10 * (1 + 0.25 * ((this.pLevel || 1) - 1)));
  }

  initStage(stage) {
    this.stage = stage;
    this.bossReq = this.bossReqFor(stage); // Boss 1 = 10, Boss 2 = 20, Boss 3 = 30... (+25% per prestige)
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
    const req = this.bossReqFor(stage);
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

  /* ------------------------------------------------------------ Stage Obstacles (Dynamic Dock Hazards) */
  makeStageObstacle(d, stage, step) {
    let pool;
    if (stage === 1) {
      // Stage 1 (10 Bean Boss): Slower pendulum anchors, rolling rum casks, turnstiles, crane drops, and rewarding bonuses
      pool = ['anchor', 'rum_casks', 'turnstile', 'crane_drop', 'powerup', 'coins'];
    } else if (stage === 2) {
      // Stage 2 (20 Bean Boss): Introduce slapping kraken tentacles & seagull slicks, faster anchors and double casks
      pool = ['tentacle_slap', 'crane_drop', 'rum_casks', 'seagull_slick', 'anchor', 'turnstile', 'powerup', 'coins'];
    } else {
      // Stage 3+ (30+ Bean Bosses): High-intensity dynamic gauntlet
      pool = ['tentacle_slap', 'crane_drop', 'rum_casks', 'turnstile', 'anchor', 'seagull_slick', 'powerup'];
    }

    const kind = pool[(step + stage * 2) % pool.length];

    // 1. Swinging Ship Anchor (Pendulum Arc)
    if (kind === 'anchor') {
      const speed = 2.0 + Math.min(1.6, stage * 0.4);
      const amp = clamp(70 + stage * 10, 75, 115);
      return {
        d,
        kind: 'anchor',
        done: false,
        speed,
        amp,
        phase: Math.random() * TAU,
        x: MID,
        swingAngle: 0,
        r: 26,
      };
    }

    // 2. Victorian Steam Crane Crate Drop (Telegraphed Cargo Smash)
    if (kind === 'crane_drop') {
      const lanes = [MID, TRACK_L + 75, TRACK_R - 75];
      const x = lanes[Math.floor(Math.random() * lanes.length)];
      const w = 82 + Math.min(22, stage * 5);
      const h = 70;
      const warnDur = Math.max(0.45, 0.85 - stage * 0.08);
      const smashDur = 0.35;
      const liftDur = 0.7;
      return {
        d,
        kind: 'crane_drop',
        done: false,
        x,
        w,
        h,
        warnDur,
        smashDur,
        liftDur,
        cycle: warnDur + smashDur + liftDur,
        state: 'warn',
        animT: 0,
      };
    }

    // 3. Rolling Rum Casks (The Mersey Rollers)
    if (kind === 'rum_casks') {
      const casks = [];
      const numCasks = stage === 1 ? 1 : Math.random() < 0.65 ? 2 : 1;
      if (numCasks === 1) {
        const lane = Math.random() < 0.4 ? MID : Math.random() < 0.5 ? TRACK_L + 80 : TRACK_R - 80;
        casks.push({ x: lane, baseX: lane, r: 24, rot: 0, wobble: Math.random() * TAU, spd: 2.2 + stage * 0.3 });
      } else {
        casks.push({ x: TRACK_L + 70, baseX: TRACK_L + 70, r: 24, rot: 0, wobble: 0, spd: 2.4 + stage * 0.3 });
        casks.push({ x: TRACK_R - 70, baseX: TRACK_R - 70, r: 24, rot: Math.PI, wobble: Math.PI, spd: 2.4 + stage * 0.3 });
      }
      return { d, kind: 'rum_casks', done: false, casks };
    }

    // 4. Slapping Mersey Tentacle (Dockside Ambush)
    if (kind === 'tentacle_slap') {
      const side = Math.random() < 0.5 ? 'left' : 'right';
      const w = 125 + Math.min(30, stage * 8);
      const telegraph = Math.max(0.5, 0.95 - stage * 0.09);
      const slamDur = 0.38;
      const retractDur = 0.65;
      return {
        d,
        kind: 'tentacle_slap',
        done: false,
        side,
        w,
        telegraph,
        slamDur,
        retractDur,
        cycle: telegraph + slamDur + retractDur,
        state: 'warn',
        animT: 0,
      };
    }

    // 5. Rotating Dock Turnstile (Padded Customs Revolver)
    if (kind === 'turnstile') {
      const rotSpeed = (Math.random() < 0.5 ? 1 : -1) * (2.0 + Math.min(1.8, stage * 0.35));
      return {
        d,
        kind: 'turnstile',
        done: false,
        angle: Math.random() * TAU,
        rotSpeed,
        armLen: 120,
        x: MID,
      };
    }

    // 6. Seagull Dive-Bomb & Gummy Grease Puddle (Traction Hazard)
    if (kind === 'seagull_slick') {
      const lane = Math.random() < 0.5 ? TRACK_L + 80 : TRACK_R - 80;
      return {
        d,
        kind: 'seagull_slick',
        done: false,
        x: lane,
        w: 96,
        h: 56,
        gulls: [
          { offX: -60, offY: -45, flap: 0 },
          { offX: 0, offY: -58, flap: 1.4 },
          { offX: 55, offY: -42, flap: 2.8 },
        ],
      };
    }

    // 7. Powerup (Cannon +3 Recruits or Nitro Turbo)
    if (kind === 'powerup') {
      const type = Math.random() < 0.6 ? 'cannon' : 'nitro';
      const x = Math.random() < 0.5 ? TRACK_L + 85 : TRACK_R - 85;
      return { d, kind: 'powerup', type, done: false, x, w: 68, h: 46 };
    }

    // 8. Triple Royal Albert Gold Sovereigns
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
      this.speed = (195 + Math.min(50, this.stage * 10)) * (1 + 0.07 * (this.pLevel - 1));
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

    // Slippery dock oil drift wobble
    if (this.slipTimer > 0) {
      this.slipTimer -= dt;
      this.crowdX += Math.sin(this.t * 14) * 60 * dt;
      this.crowdX = clamp(this.crowdX, minX, maxX);
      if (Math.random() < 0.25) {
        this.fx.burst(this.crowdX + (Math.random() - 0.5) * rad, CROWD_Y + rad * 0.5, '#38bdf8', 2, 80, 0.25, 2);
      }
    }

    // Process Track Rows
    for (const r of this.rows) {
      if (r.done) continue;

      if (r.kind === 'anchor') {
        r.x = MID + Math.sin(this.t * r.speed + r.phase) * r.amp;
        r.swingAngle = Math.cos(this.t * r.speed + r.phase) * 0.45;
      } else if (r.kind === 'crane_drop') {
        const tIn = (this.t * 1.35) % r.cycle;
        r.animT = tIn;
        r.state = tIn < r.warnDur ? 'warn' : tIn < r.warnDur + r.smashDur ? 'drop' : 'lift';
      } else if (r.kind === 'rum_casks') {
        for (const c of r.casks) {
          c.rot += dt * 8.5;
          if (r.casks.length > 1) {
            c.x = c.baseX + Math.sin(this.t * c.spd + c.wobble) * 16;
          }
        }
      } else if (r.kind === 'tentacle_slap') {
        const tTent = (this.t * 1.25) % r.cycle;
        r.animT = tTent;
        r.state = tTent < r.telegraph ? 'warn' : tTent < r.telegraph + r.slamDur ? 'slam' : 'retract';
      } else if (r.kind === 'turnstile') {
        r.angle += r.rotSpeed * dt;
      } else if (r.kind === 'seagull_slick') {
        for (const g of r.gulls) {
          g.flap += dt * 9.5;
        }
      } else if (r.kind === 'sweeper') {
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

    // 2. Swinging Ship Anchor
    else if (r.kind === 'anchor') {
      const hit = Math.abs(r.x - this.crowdX) < rad + r.r * 0.85;
      if (hit) {
        if (this.boostTimer > 0) {
          this.score += 80;
          this.fx.text(this.crowdX, y - 24, 'ANCHOR SHATTERED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(this.crowdX, CROWD_Y, '#ffd166', 24, 240, 0.6, 4);
          return;
        }

        const loss = 2; // Exactly 2 beans
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 26, `ANCHOR CLANG! −${loss} ⚓`, '#ff7a88', 26, 0.95);
        this.fx.burst(this.crowdX, CROWD_Y, '#64748b', 22, 230, 0.55, 4);
        this.fx.shake(9, 0.35);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Battered into the Mersey by swinging ship anchor!');
          return;
        }
      } else {
        this.score += 25;
        this.fx.text(this.crowdX, y - 20, 'ANCHOR DODGED! +25', '#3dffa2', 18, 0.6);
      }
    }

    // 3. Victorian Steam Crane Crate Drop
    else if (r.kind === 'crane_drop') {
      const inLane = Math.abs(r.x - this.crowdX) < rad + r.w * 0.45;
      const isSmashed = r.state === 'drop';

      if (inLane && isSmashed) {
        if (this.boostTimer > 0) {
          this.score += 90;
          this.fx.text(this.crowdX, y - 24, 'CRATE SMASHED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(this.crowdX, CROWD_Y, '#b45309', 24, 250, 0.6, 4);
          return;
        }

        const loss = 3; // Exactly 3 beans
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 28, `CRUSHED BY CARGO! −${loss} 📦`, '#ff0054', 28, 1.0);
        this.fx.burst(this.crowdX, CROWD_Y, '#b45309', 26, 260, 0.6, 5);
        this.fx.ring(this.crowdX, CROWD_Y, '#ef4444', 220, 0.5, 5);
        this.fx.shake(12, 0.4);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Flattened by Victorian steam crane sugar crate!');
          return;
        }
      } else {
        this.score += 30;
        this.fx.text(this.crowdX, y - 20, 'CARGO CLEARED! +30', '#3dffa2', 18, 0.6);
      }
    }

    // 4. Rolling Rum Casks
    else if (r.kind === 'rum_casks') {
      let hit = false;
      for (const c of r.casks) {
        if (Math.abs(c.x - this.crowdX) < rad + c.r * 0.85) {
          hit = true;
          break;
        }
      }

      if (hit) {
        if (this.boostTimer > 0) {
          this.score += 70;
          this.fx.text(this.crowdX, y - 24, 'CASKS PULVERIZED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(this.crowdX, CROWD_Y, '#78350f', 24, 240, 0.6, 4);
          return;
        }

        const loss = 2; // Exactly 2 beans
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 26, `CASK SMACK! −${loss} 🪵`, '#ff7a88', 26, 0.95);
        this.fx.burst(this.crowdX, CROWD_Y, '#78350f', 22, 220, 0.5, 4);
        this.fx.shake(9, 0.35);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Tumbled into the dock by rolling rum casks!');
          return;
        }
      } else {
        this.score += 25;
        this.fx.text(this.crowdX, y - 20, 'CASKS DODGED! +25', '#3dffa2', 18, 0.6);
      }
    }

    // 5. Slapping Mersey Tentacle
    else if (r.kind === 'tentacle_slap') {
      const inDanger = r.side === 'left' ? this.crowdX < TRACK_L + r.w : this.crowdX > TRACK_R - r.w;
      const isSlamming = r.state === 'slam';

      if (inDanger && isSlamming) {
        if (this.boostTimer > 0) {
          this.score += 90;
          this.fx.text(this.crowdX, y - 24, 'TENTACLE SLICED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(this.crowdX, CROWD_Y, '#a21caf', 24, 250, 0.6, 4);
          return;
        }

        const loss = 2; // Exactly 2 beans
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 26, `TENTACLE SLAP! −${loss} 🐙`, '#ff0054', 28, 1.0);
        this.fx.burst(this.crowdX, CROWD_Y, '#a21caf', 24, 240, 0.6, 4);
        this.fx.ring(this.crowdX, CROWD_Y, '#0284c7', 220, 0.5, 5);
        this.fx.shake(10, 0.35);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Whipped into the Mersey Basin by a kraken tentacle!');
          return;
        }
      } else {
        this.score += 30;
        this.fx.text(this.crowdX, y - 20, 'TENTACLE DODGED! +30', '#3dffa2', 18, 0.6);
      }
    }

    // 6. Rotating Dock Turnstile
    else if (r.kind === 'turnstile') {
      const distFromCenter = Math.abs(this.crowdX - r.x);
      let hitArm = false;

      if (distFromCenter < rad + r.armLen * 0.9) {
        // Player position angle from center
        const pAng = Math.atan2(0, this.crowdX - r.x);
        for (let i = 0; i < 3; i++) {
          const armAng = (r.angle + (i * TAU) / 3) % TAU;
          let diff = Math.abs(pAng - armAng);
          if (diff > Math.PI) diff = TAU - diff;
          if (diff < 0.45) {
            hitArm = true;
            break;
          }
        }
      }

      if (hitArm) {
        if (this.boostTimer > 0) {
          this.score += 80;
          this.fx.text(this.crowdX, y - 20, 'TURNSTILE SMASHED! 💥', '#ffd166', 24, 0.9);
          this.fx.burst(this.crowdX, CROWD_Y, '#ffd166', 24, 240, 0.6, 4);
          return;
        }

        const loss = 2; // Exactly 2 beans
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 24, `TURNSTILE SMACK! −${loss} 🔄`, '#ff7a88', 26, 0.9);
        this.fx.burst(this.crowdX, CROWD_Y, '#cbd5e1', 20, 220, 0.5, 4);
        this.fx.shake(8, 0.3);
        this.sounds.hit();
        this.haptics.heavy();

        if (this.count <= 0) {
          this.die('Battered by rotating dock customs turnstile!');
          return;
        }
      } else {
        this.score += 30;
        this.fx.text(this.crowdX, y - 20, 'SLIPPED THROUGH! +30', '#3dffa2', 18, 0.6);
      }
    }

    // 7. Slippery Seagull Dive-Bomb & Grease Puddle
    else if (r.kind === 'seagull_slick') {
      const hit = Math.abs(r.x - this.crowdX) < rad + r.w * 0.45;
      if (hit) {
        this.slipTimer = 1.35; // Trigger drift wobble
        const loss = 1; // 1 bean slips into water
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 26, `SLIPPED ON FISH OIL! −${loss} 🐟`, '#38bdf8', 26, 0.95);
        this.fx.burst(this.crowdX, CROWD_Y, '#38bdf8', 18, 190, 0.5, 3.5);
        this.fx.shake(6, 0.25);
        this.sounds.drop();
        this.haptics.medium();

        if (this.count <= 0) {
          this.die('Slipped off the slick dock timber into the Mersey!');
          return;
        }
      } else {
        this.score += 20;
        this.fx.text(this.crowdX, y - 20, 'CLEARED OIL SLICK! +20', '#3dffa2', 18, 0.6);
      }
    }

    // 8. Powerup
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

    // Backward-compatible handlers for legacy obstacles
    else if (r.kind === 'sweeper') {
      const armCos = Math.cos(r.angle);
      const beamX = MID + armCos * r.gapDist;
      if (Math.abs(this.crowdX - beamX) > rad + 24) {
        const loss = 2;
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 24, `SWEPT OFF QUAY! −${loss}`, '#ff7a88', 26, 0.9);
        this.fx.shake(9, 0.35);
        this.sounds.hit();
        if (this.count <= 0) this.die('Swept into the Mersey by rotating dock boom!');
      }
    } else if (r.kind === 'gang') {
      if (Math.abs(r.x - this.crowdX) < rad + r.r * 0.85) {
        const loss = Math.min(this.count, r.n);
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 30, `GANG CLASH! −${loss}`, '#ff0054', 28, 1.0);
        this.sounds.hit();
        if (this.count <= 0) this.die('Overwhelmed by rival dock gang!');
      }
    } else if (r.kind === 'drawbridge') {
      if (this.crowdX < r.x - r.w / 2 || this.crowdX > r.x + r.w / 2) {
        const loss = 2;
        this.count = Math.max(0, this.count - loss);
        this.fx.text(this.crowdX, y - 24, `FELL IN WATER! −${loss} 💦`, '#38bdf8', 26, 0.9);
        this.sounds.drop();
        if (this.count <= 0) this.die('Fell off the drawbridge into the Mersey Basin!');
      }
    } else if (r.kind === 'tnt') {
      for (const b of r.barrels) {
        if (Math.abs(b.x - this.crowdX) < rad + b.r * 0.85) {
          const cut = 3;
          this.count = Math.max(0, this.count - cut);
          this.fx.text(b.x, y - 28, `BARREL BOOM! −${cut}`, '#ff0054', 28, 1.0);
          this.sounds.hit();
          if (this.count <= 0) this.die('Blown up by maritime gunpowder barrel!');
        }
      }
    } else if (r.kind === 'boulder') {
      if (Math.abs(r.x - this.crowdX) < rad + r.r * 0.85) {
        const loss = 2;
        this.count = Math.max(0, this.count - loss);
        this.fx.text(r.x, y - 24, `RUN OVER! −${loss}`, '#ff7a88', 26, 0.9);
        this.sounds.hit();
        if (this.count <= 0) this.die('Crushed by rolling jawbreaker boulder!');
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
        const targetNext = this.bossReqFor(this.stage + 1);
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
      if (this.stage >= 3) {
        // Conquered all 3 Bosses!
        this.bossState = 'none';
        this.won = true;
        this.winReason = 'All 3 Dock Bosses Defeated! 👑';
        return;
      }
      this.bossState = 'none';
      this.stage++;
      this.feverRush = 3.0;
      this.sounds.upgrade();
      this.fx.text(MID, CROWD_Y - 50, `STAGE ${this.stage}: TARGET ${this.bossReqFor(this.stage)} BEANS! ⚡`, '#3dffa2', 28, 1.8);
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
        else if (r.kind === 'anchor') this.drawAnchor(r, y);
        else if (r.kind === 'crane_drop') this.drawCraneDrop(r, y);
        else if (r.kind === 'rum_casks') this.drawRumCasks(r, y);
        else if (r.kind === 'tentacle_slap') this.drawTentacleSlap(r, y);
        else if (r.kind === 'turnstile') this.drawTurnstile(r, y);
        else if (r.kind === 'seagull_slick') this.drawSeagullSlick(r, y);
        else if (r.kind === 'powerup') this.drawPowerup(r, y);
        else if (r.kind === 'coins') this.drawCoins(r, y);
        else if (r.kind === 'sweeper') this.drawSweeper(r, y);
        else if (r.kind === 'gang') this.drawGang(r, y);
        else if (r.kind === 'drawbridge') this.drawDrawbridge(r, y);
        else if (r.kind === 'tnt') this.drawTnt(r, y);
        else if (r.kind === 'boulder') this.drawBoulder(r, y);
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

  /* ------------------------------------------------------------ 1. Swinging Ship Anchor (Pendulum) */
  drawAnchor(r, y) {
    const ctx = this.ctx;
    ctx.save();

    // Top mounting beam / pivot high above the track
    const pivotY = y - 170;
    const anchorX = r.x;
    const anchorY = y;

    // Cast dynamic drop shadow on the quayside timber
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.beginPath();
    ctx.ellipse(anchorX, y + 16, 32, 14, 0, 0, TAU);
    ctx.fill();

    // Heavy hemp hawser rope / steel chain from top pivot to anchor ring
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(MID, pivotY);
    ctx.lineTo(anchorX, anchorY - 34);
    ctx.stroke();

    // Inner chain links
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(MID, pivotY);
    ctx.lineTo(anchorX, anchorY - 34);
    ctx.stroke();
    ctx.setLineDash([]);

    // Translate to anchor head with tilt angle
    ctx.translate(anchorX, anchorY);
    ctx.rotate(r.swingAngle || 0);

    // Cast-iron Pirate Anchor Body
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';

    // Top Shackle Ring
    ctx.beginPath();
    ctx.arc(0, -32, 11, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, -32, 5, 0, TAU);
    ctx.fill();

    // Stock / Crossbar
    ctx.fillStyle = '#475569';
    ctx.fillRect(-28, -20, 56, 8);
    ctx.strokeRect(-28, -20, 56, 8);
    // Brass end knobs on stock
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(-28, -16, 5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(28, -16, 5, 0, TAU); ctx.fill(); ctx.stroke();

    // Central Shank
    ctx.fillStyle = '#334155';
    ctx.fillRect(-6, -20, 12, 36);
    ctx.strokeRect(-6, -20, 12, 36);

    // Curved Flukes / Arms
    ctx.beginPath();
    ctx.moveTo(-34, 4);
    ctx.quadraticCurveTo(0, 32, 34, 4);
    ctx.quadraticCurveTo(24, 22, 0, 24);
    ctx.quadraticCurveTo(-24, 22, -34, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sharp Palms / Arrow tips
    ctx.beginPath();
    ctx.moveTo(-34, 4); ctx.lineTo(-40, 14); ctx.lineTo(-28, 12); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(34, 4); ctx.lineTo(40, 14); ctx.lineTo(28, 12); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Skull emblem on crown
    ctx.font = '900 13px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('☠️', 0, 4);

    // Hazard Badge
    ctx.font = '900 12px Outfit, system-ui, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#140924';
    ctx.strokeText('−2 BEANS', 0, 38);
    ctx.fillStyle = '#f87171';
    ctx.fillText('−2 BEANS', 0, 38);

    ctx.restore();
  }

  /* ------------------------------------------------------------ 2. Victorian Steam Crane Crate Drop */
  drawCraneDrop(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x, y);

    const isWarn = r.state === 'warn';
    const isDrop = r.state === 'drop';

    // 1. Quayside Drop Zone Telegraph Warning Box
    const pulse = Math.sin(this.t * 16) > 0 ? 0.8 : 0.4;
    ctx.lineWidth = 3;
    ctx.strokeStyle = isDrop ? '#ef4444' : `rgba(239, 68, 68, ${pulse})`;
    ctx.fillStyle = isDrop ? 'rgba(239, 68, 68, 0.35)' : `rgba(239, 68, 68, ${pulse * 0.25})`;

    ctx.beginPath();
    ctx.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 8);
    ctx.fill();
    ctx.stroke();

    // Diagonal hazard stripes on landing zone
    ctx.strokeStyle = isDrop ? 'rgba(239, 68, 68, 0.6)' : `rgba(250, 204, 21, ${pulse * 0.7})`;
    ctx.lineWidth = 2;
    for (let lx = -r.w / 2 + 10; lx < r.w / 2 + 30; lx += 18) {
      ctx.beginPath();
      ctx.moveTo(clamp(lx - 20, -r.w / 2, r.w / 2), -r.h / 2);
      ctx.lineTo(clamp(lx, -r.w / 2, r.w / 2), r.h / 2);
      ctx.stroke();
    }

    // 2. Suspended Crate Height (Vertical drop offset)
    let crateYOff = 0;
    let crateScale = 1.0;
    if (isWarn) {
      // Hovering high above with slight winch sway
      crateYOff = -130 + Math.sin(this.t * 6) * 8;
      crateScale = 0.85;
    } else if (isDrop) {
      // Smashed down onto timber floor!
      crateYOff = 0;
      crateScale = 1.05; // Impact squash
    } else {
      // Lifting back up
      const liftProgress = (r.animT - r.warnDur - r.smashDur) / r.liftDur;
      crateYOff = -130 * Math.min(1, liftProgress * 1.5);
      crateScale = 0.95;
    }

    // Crane Winch Chains
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-r.w * 0.38, -260); ctx.lineTo(-r.w * 0.38, crateYOff - r.h * 0.45);
    ctx.moveTo(r.w * 0.38, -260); ctx.lineTo(r.w * 0.38, crateYOff - r.h * 0.45);
    ctx.stroke();

    // Impact Ground Dust Puffs when dropped
    if (isDrop) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
      for (let i = -r.w / 2; i <= r.w / 2; i += 22) {
        ctx.beginPath();
        ctx.arc(i, r.h / 2 + 4, 9, 0, TAU);
        ctx.fill();
      }
    }

    // Crate Body
    ctx.save();
    ctx.translate(0, crateYOff);
    ctx.scale(crateScale, crateScale);

    // Heavy Royal Albert Sugar Crate Planks
    ctx.fillStyle = '#b45309';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 6);
    ctx.fill();
    ctx.stroke();

    // Planks line texture
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-r.w / 2, -r.h / 6); ctx.lineTo(r.w / 2, -r.h / 6);
    ctx.moveTo(-r.w / 2, r.h / 6); ctx.lineTo(r.w / 2, r.h / 6);
    ctx.stroke();

    // Heavy iron cross-braces
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-r.w / 2 + 6, -r.h / 2 + 6); ctx.lineTo(r.w / 2 - 6, r.h / 2 - 6);
    ctx.moveTo(r.w / 2 - 6, -r.h / 2 + 6); ctx.lineTo(-r.w / 2 + 6, r.h / 2 - 6);
    ctx.stroke();

    // Stenciled Sugar / Rum Cargo Stamp
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 13px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CRUMP CARGO', 0, 0);

    // Warning Badge
    ctx.font = '900 11px Outfit, system-ui, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#140924';
    ctx.strokeText(isDrop ? '💥 −3 BEANS' : '⚠️ WATCH OUT', 0, -r.h / 2 - 12);
    ctx.fillStyle = isDrop ? '#ef4444' : '#facc15';
    ctx.fillText(isDrop ? '💥 −3 BEANS' : '⚠️ WATCH OUT', 0, -r.h / 2 - 12);

    ctx.restore();
    ctx.restore();
  }

  /* ------------------------------------------------------------ 3. Rolling Rum Casks */
  drawRumCasks(r, y) {
    const ctx = this.ctx;
    for (const c of r.casks) {
      ctx.save();
      const hop = Math.abs(Math.sin(c.rot * 2)) * 3;
      ctx.translate(c.x, y - hop);

      // Drop shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, c.r + 3, c.r * 1.1, c.r * 0.45, 0, 0, TAU);
      ctx.fill();

      // Barrel Rotation
      ctx.rotate(c.rot);

      // Oak Barrel Exterior
      ctx.fillStyle = '#92400e';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Brass Hoops
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, c.r * 0.72, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, c.r * 0.38, 0, TAU); ctx.stroke();

      // Wooden staves spoke lines
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.5;
      for (let a = 0; a < Math.PI; a += Math.PI / 3) {
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * c.r, -Math.sin(a) * c.r);
        ctx.lineTo(Math.cos(a) * c.r, Math.sin(a) * c.r);
        ctx.stroke();
      }

      // Center Bung Plug
      ctx.fillStyle = '#451a03';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();

      ctx.restore();

      // Floating Penalty Badge above cask
      ctx.save();
      ctx.translate(c.x, y - c.r - 16);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 12px Outfit, system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#140924';
      ctx.strokeText('🪵 −2 BEANS', 0, 0);
      ctx.fillStyle = '#f87171';
      ctx.fillText('🪵 −2 BEANS', 0, 0);
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ 4. Slapping Mersey Tentacle */
  drawTentacleSlap(r, y) {
    const ctx = this.ctx;
    ctx.save();

    const isLeft = r.side === 'left';
    const edgeX = isLeft ? TRACK_L : TRACK_R;
    const isWarn = r.state === 'warn';
    const isSlam = r.state === 'slam';

    // 1. Canal Water Bubbles & Warning Ripples
    ctx.strokeStyle = isSlam ? '#38bdf8' : 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 3;
    const ripR = (this.t * 40) % 28;
    ctx.beginPath();
    ctx.ellipse(edgeX, y, ripR, ripR * 0.5, 0, 0, TAU);
    ctx.stroke();

    // 2. Danger Zone Tint on Boardwalk
    const zoneW = r.w;
    const zoneX = isLeft ? TRACK_L : TRACK_R - zoneW;
    ctx.fillStyle = isSlam ? 'rgba(162, 28, 175, 0.35)' : 'rgba(162, 28, 175, 0.15)';
    ctx.fillRect(zoneX, y - 26, zoneW, 52);
    ctx.strokeStyle = isSlam ? '#a21caf' : 'rgba(162, 28, 175, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(zoneX, y - 26, zoneW, 52);

    // 3. Animated Tentacle Model
    const reach = isSlam ? zoneW : isWarn ? zoneW * 0.35 : zoneW * 0.7;
    const tipX = isLeft ? TRACK_L + reach : TRACK_R - reach;
    const tentY = y - (isSlam ? 0 : 25 + Math.sin(this.t * 8) * 8);

    // Drop shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.beginPath();
    ctx.ellipse((edgeX + tipX) / 2, y + 10, reach * 0.5, 12, 0, 0, TAU);
    ctx.fill();

    // Glossy Kraken Tentacle Body
    ctx.fillStyle = '#a21caf';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(edgeX, y - 24);
    ctx.bezierCurveTo(
      (edgeX + tipX) / 2, tentY - 30,
      tipX, tentY - 20,
      tipX + (isLeft ? 15 : -15), tentY
    );
    ctx.bezierCurveTo(
      tipX, tentY + 20,
      (edgeX + tipX) / 2, tentY + 26,
      edgeX, y + 24
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bright Yellow Suction Cups
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 2;
    const numCups = 5;
    for (let i = 1; i <= numCups; i++) {
      const frac = i / (numCups + 1);
      const cupX = edgeX + (tipX - edgeX) * frac;
      const cupY = tentY + Math.sin(frac * Math.PI) * (isLeft ? 6 : -6);
      ctx.beginPath();
      ctx.arc(cupX, cupY, 6.5 - frac * 2, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Splash Particles when slammed
    if (isSlam) {
      ctx.fillStyle = '#38bdf8';
      for (let s = 0; s < 6; s++) {
        const sx = tipX + (Math.random() - 0.5) * 40;
        const sy = y + (Math.random() - 0.5) * 30;
        ctx.beginPath(); ctx.arc(sx, sy, 4, 0, TAU); ctx.fill();
      }
    }

    // Warning Badge
    ctx.font = '900 12px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#140924';
    const badgeX = isLeft ? TRACK_L + zoneW * 0.5 : TRACK_R - zoneW * 0.5;
    ctx.strokeText(isSlam ? '🐙 SLAM! −2' : '⚠️ TENTACLE!', badgeX, y - 36);
    ctx.fillStyle = isSlam ? '#f43f5e' : '#facc15';
    ctx.fillText(isSlam ? '🐙 SLAM! −2' : '⚠️ TENTACLE!', badgeX, y - 36);

    ctx.restore();
  }

  /* ------------------------------------------------------------ 5. Rotating Dock Turnstile */
  drawTurnstile(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x, y);

    // Cast circular base shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, r.armLen * 0.95, 0, TAU);
    ctx.fill();

    // 3 Rotating Boom Arms
    for (let i = 0; i < 3; i++) {
      const armAng = r.angle + (i * TAU) / 3;
      ctx.save();
      ctx.rotate(armAng);

      // Padded Arm with Hazard Stripes
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(14, -8, r.armLen - 14, 16, 6);
      ctx.fill();
      ctx.stroke();

      // Red hazard stripes
      ctx.fillStyle = '#ef4444';
      for (let sx = 25; sx < r.armLen - 10; sx += 24) {
        ctx.fillRect(sx, -7, 12, 14);
      }

      // Rubber End Bumper
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(r.armLen, 0, 10, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // Safe Open Wedge Indicator (Glowing green guide)
    const openAng = r.angle + TAU / 6;
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r.armLen * 0.7, openAng - 0.4, openAng + 0.4);
    ctx.stroke();
    ctx.setLineDash([]);

    // Central Brass Customs Turret
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.fill();

    // Rivets
    ctx.fillStyle = '#ffffff';
    for (let a = 0; a < TAU; a += TAU / 4) {
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 17, Math.sin(a) * 17, 2.5, 0, TAU);
      ctx.fill();
    }

    // Header label
    ctx.font = '900 12px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#140924';
    ctx.strokeText('🔄 −2 BEANS', 0, -r.armLen - 12);
    ctx.fillStyle = '#f87171';
    ctx.fillText('🔄 −2 BEANS', 0, -r.armLen - 12);

    ctx.restore();
  }

  /* ------------------------------------------------------------ 6. Seagull Dive-Bomb & Gummy Grease Puddle */
  drawSeagullSlick(r, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x, y);

    // 1. Shimmering Iridescent Grease Puddle on Boardwalk
    const pudGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, r.w * 0.5);
    pudGrad.addColorStop(0, 'rgba(56, 189, 248, 0.65)');
    pudGrad.addColorStop(0.5, 'rgba(232, 121, 249, 0.45)');
    pudGrad.addColorStop(1, 'rgba(250, 204, 21, 0.15)');

    ctx.fillStyle = pudGrad;
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, r.w * 0.48, r.h * 0.48, 0.15, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Slick skid streaks
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r.w * 0.28, -6); ctx.lineTo(r.w * 0.25, 4);
    ctx.moveTo(-r.w * 0.15, 8); ctx.lineTo(r.w * 0.2, 14);
    ctx.stroke();

    // Puddle Badge
    ctx.font = '900 11px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#140924';
    ctx.strokeText('⚠️ SLICK OIL −1', 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('⚠️ SLICK OIL −1', 0, 0);

    // 2. Flying Cartoon Liverpool Seagulls Overhead
    for (const g of r.gulls) {
      ctx.save();
      ctx.translate(g.offX, g.offY);

      // Flapping wing calculation
      const wingFlap = Math.sin(g.flap) * 12;

      // Seagull Body
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Animated Wings
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-2, -14 - wingFlap);
      ctx.lineTo(6, -6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-2, 14 + wingFlap);
      ctx.lineTo(6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Yellow Beak
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(10, -2);
      ctx.lineTo(17, 0);
      ctx.lineTo(10, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

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
