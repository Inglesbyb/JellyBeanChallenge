import Matter from 'matter-js';
import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const { Engine, Composite, Bodies, Body, Events } = Matter;
const TAU = Math.PI * 2;

// 8 Handcrafted Puzzle Levels followed by endless procedural scaling
const LEVELS = [
  {
    name: 'The Rookie Roof',
    bean: { x: 225, y: 605 },
    hives: [{ x: 330, y: 230, bees: 14 }],
    platforms: [
      { x: 225, y: 670, w: 450, h: 80, label: 'ground' },
    ],
    pegs: [],
    hazards: [],
    maxInk: 750,
  },
  {
    name: 'The High Perch',
    bean: { x: 225, y: 410 },
    hives: [{ x: 90, y: 230, bees: 16 }],
    platforms: [
      { x: 225, y: 550, w: 100, h: 260, label: 'pillar' },
    ],
    pegs: [],
    hazards: [
      { x: 225, y: 760, w: 450, h: 70, type: 'lava' },
    ],
    maxInk: 750,
  },
  {
    name: 'Twin Ambush',
    bean: { x: 225, y: 605 },
    hives: [
      { x: 80, y: 230, bees: 10 },
      { x: 370, y: 230, bees: 10 },
    ],
    platforms: [
      { x: 60, y: 550, w: 120, h: 240, label: 'hill' },
      { x: 390, y: 550, w: 120, h: 240, label: 'hill' },
      { x: 225, y: 670, w: 210, h: 80, label: 'ground' },
    ],
    pegs: [
      { x: 120, y: 430, r: 14 },
      { x: 330, y: 430, r: 14 },
    ],
    hazards: [],
    maxInk: 800,
  },
  {
    name: 'Candy Lava Trench',
    bean: { x: 225, y: 460 },
    hives: [{ x: 225, y: 220, bees: 18 }],
    platforms: [
      { x: 225, y: 510, w: 140, h: 30, label: 'floating' },
      { x: 30, y: 420, w: 60, h: 260, label: 'wall' },
      { x: 420, y: 420, w: 60, h: 260, label: 'wall' },
    ],
    pegs: [
      { x: 80, y: 340, r: 14 },
      { x: 370, y: 340, r: 14 },
    ],
    hazards: [
      { x: 225, y: 740, w: 450, h: 100, type: 'lava' },
    ],
    maxInk: 850,
  },
  {
    name: 'The Slippery Slope',
    bean: { x: 175, y: 480 },
    hives: [{ x: 360, y: 230, bees: 18 }],
    platforms: [
      { x: 210, y: 560, w: 320, h: 26, angle: 0.38, label: 'ramp' },
      { x: 420, y: 620, w: 60, h: 180, label: 'wall' },
    ],
    pegs: [
      { x: 95, y: 370, r: 15 },
    ],
    hazards: [
      { x: 320, y: 720, w: 240, h: 60, type: 'spikes' },
    ],
    maxInk: 800,
  },
  {
    name: 'Rolling Jawbreaker',
    bean: { x: 260, y: 620 },
    hives: [{ x: 360, y: 230, bees: 16 }],
    platforms: [
      { x: 130, y: 310, w: 220, h: 24, angle: 0.38, label: 'ramp' },
      { x: 225, y: 700, w: 450, h: 80, label: 'ground' },
    ],
    pegs: [
      { x: 220, y: 490, r: 14 },
    ],
    hazards: [],
    boulders: [
      { x: 60, y: 240, r: 24, color: '#e63946' },
    ],
    maxInk: 850,
  },
  {
    name: 'Triple Hive Citadel',
    bean: { x: 225, y: 560 },
    hives: [
      { x: 80, y: 220, bees: 8 },
      { x: 225, y: 200, bees: 10 },
      { x: 370, y: 220, bees: 8 },
    ],
    platforms: [
      { x: 225, y: 620, w: 180, h: 30, label: 'platform' },
      { x: 80, y: 510, w: 100, h: 25, label: 'step' },
      { x: 370, y: 510, w: 100, h: 25, label: 'step' },
    ],
    pegs: [
      { x: 150, y: 440, r: 14 },
      { x: 300, y: 440, r: 14 },
    ],
    hazards: [
      { x: 225, y: 750, w: 450, h: 80, type: 'spikes' },
    ],
    maxInk: 900,
  },
  {
    name: "The Queen's Citadel",
    bean: { x: 225, y: 560 },
    hives: [
      { x: 100, y: 220, bees: 12 },
      { x: 350, y: 220, bees: 12 },
      { x: 225, y: 190, bees: 10, isQueen: true },
    ],
    platforms: [
      { x: 225, y: 640, w: 240, h: 40, label: 'citadel' },
    ],
    pegs: [
      { x: 100, y: 420, r: 15 },
      { x: 350, y: 420, r: 15 },
      { x: 225, y: 320, r: 15 },
    ],
    hazards: [
      { x: 225, y: 760, w: 450, h: 70, type: 'lava' },
    ],
    rotators: [
      { x: 225, y: 380, w: 150, h: 16, speed: 1.8 },
    ],
    maxInk: 950,
  },
];

export class SaveTheBean extends Game {
  static meta = {
    id: 'save-the-bean',
    title: 'Save The Bean',
    icon: '🐝',
    hint: 'DRAW a shield to protect the Bean from the angry bee swarm!',
    baseLikes: 5420,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.levelIdx = saved?.levelIdx || 0;
    this.totalStars = saved?.totalStars || 0;

    // Reset button bounds (top right, comfortably below Reel header)
    this.resetBtn = { x: 405, y: 108, r: 20, pressed: false };

    // Collision listener
    this.onCollide = (ev) => this.handleCollision(ev);

    // Setup level
    this.setupLevel(this.levelIdx);
  }

  setupLevel(idx) {
    // Clear previous physics engine
    if (this.engine) {
      if (this.onCollide) Events.off(this.engine, 'collisionStart', this.onCollide);
      Composite.clear(this.engine.world, false);
      Engine.clear(this.engine);
    }

    this.engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
    this.engine.gravity.y = 1.1;

    const data = this.getLevelData(idx);
    this.curLevel = data;
    this.state = 'drawing'; // 'drawing' | 'defending' | 'won' | 'stung'
    this.stateTimer = 0;
    this.defendTimer = 6.0;
    this.totalDefendTime = 6.0;

    // Drawing state
    this.points = [];
    this.inkUsed = 0;
    this.maxInk = data.maxInk || 800;
    this.drawnBody = null;
    this.drawnRelPoints = null;

    // Build static platforms and walls
    this.platforms = [];
    this.hazards = data.hazards || [];
    this.pegs = data.pegs || [];
    this.boulders = [];
    this.rotators = [];

    // Outer screen boundaries (left, right, bottom)
    const wallOpts = { isStatic: true, friction: 0.8, restitution: 0.1, label: 'wall' };
    Composite.add(this.engine.world, [
      Bodies.rectangle(-20, 400, 40, 900, wallOpts),
      Bodies.rectangle(470, 400, 40, 900, wallOpts),
      Bodies.rectangle(225, 830, 600, 60, wallOpts),
    ]);

    // Level platforms
    for (const p of data.platforms) {
      const b = Bodies.rectangle(p.x, p.y, p.w, p.h, {
        isStatic: true,
        angle: p.angle || 0,
        friction: 0.8,
        restitution: 0.1,
        label: p.label || 'platform',
      });
      Composite.add(this.engine.world, b);
      this.platforms.push({ ...p, body: b });
    }

    // Level pegs
    for (const peg of this.pegs) {
      const pb = Bodies.circle(peg.x, peg.y, peg.r || 14, {
        isStatic: true,
        friction: 0.9,
        restitution: 0.1,
        label: 'peg',
      });
      Composite.add(this.engine.world, pb);
      peg.body = pb;
    }

    // Level Hazards (lava, spikes)
    for (const h of this.hazards) {
      const hb = Bodies.rectangle(h.x, h.y, h.w, h.h, {
        isStatic: true,
        isSensor: true,
        label: 'hazard',
      });
      Composite.add(this.engine.world, hb);
      h.body = hb;
    }

    // Rolling boulders
    if (data.boulders) {
      for (const bDef of data.boulders) {
        const bb = Bodies.circle(bDef.x, bDef.y, bDef.r, {
          density: 0.015,
          friction: 0.3,
          restitution: 0.25,
          label: 'boulder',
        });
        Composite.add(this.engine.world, bb);
        this.boulders.push({ body: bb, ...bDef });
      }
    }

    // Rotators
    if (data.rotators) {
      for (const rDef of data.rotators) {
        const rb = Bodies.rectangle(rDef.x, rDef.y, rDef.w, rDef.h, {
          isStatic: true,
          label: 'rotator',
        });
        Composite.add(this.engine.world, rb);
        this.rotators.push({ body: rb, ...rDef, currentAngle: 0 });
      }
    }

    // Spawn the Bean
    // Create bean physics capsule
    const bx = data.bean.x;
    const by = data.bean.y;
    this.beanBody = Bodies.rectangle(bx, by, 34, 46, {
      chamfer: { radius: 17 },
      friction: 0.85,
      frictionAir: 0.02,
      density: 0.003,
      restitution: 0.08,
      label: 'bean',
    });
    Composite.add(this.engine.world, this.beanBody);

    // Bean expression / cosmetic state
    this.beanState = {
      x: bx,
      y: by,
      vx: 0,
      vy: 0,
      angle: 0,
      sweat: 0,
      stung: false,
      stungAnim: 0,
      wobble: 0,
    };

    // Setup Hives & Bees
    this.hives = data.hives.map((h, i) => ({
      x: h.x,
      y: h.y,
      beesTotal: h.bees || 14,
      beesRemaining: h.bees || 14,
      isQueen: !!h.isQueen,
      shake: 0,
      openAnim: 0,
      spawnTimer: 0.2 + i * 0.15,
    }));

    this.bees = [];
    this.beeIdCounter = 0;

    // Attach collision listener
    Events.on(this.engine, 'collisionStart', this.onCollide);
  }

  getLevelData(idx) {
    if (idx < LEVELS.length) {
      return LEVELS[idx];
    }
    // Procedural Endless level
    const count = idx + 1;
    const hiveCount = Math.min(3, 2 + (count % 2));
    const hives = [];
    for (let i = 0; i < hiveCount; i++) {
      hives.push({
        x: 80 + (290 / Math.max(1, hiveCount - 1)) * i,
        y: 140 + Math.sin(i * 1.5) * 30,
        bees: 8 + Math.min(16, Math.floor(count * 1.2)),
        isQueen: i === 1 && count % 3 === 0,
      });
    }
    return {
      name: `Citadel Sector ${count}`,
      bean: { x: 225, y: 560 },
      hives,
      platforms: [
        { x: 225, y: 640, w: 200 + Math.sin(count) * 60, h: 36, label: 'platform' },
      ],
      pegs: [
        { x: 120, y: 440, r: 14 },
        { x: 330, y: 440, r: 14 },
      ],
      hazards: [
        { x: 225, y: 760, w: 450, h: 70, type: count % 2 === 0 ? 'lava' : 'spikes' },
      ],
      maxInk: 850 + Math.min(200, count * 20),
    };
  }

  handleCollision(ev) {
    if (this.state !== 'defending') return;

    for (const pair of ev.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;

      // Bee touches Bean -> Stung!
      if ((a.label === 'bee' && b.label === 'bean') || (b.label === 'bee' && a.label === 'bean')) {
        const beeBody = a.label === 'bee' ? a : b;
        this.onStung(beeBody.position.x, beeBody.position.y);
        return;
      }

      // Bean touches Hazard (Lava / Spikes)
      if ((a.label === 'bean' && b.label === 'hazard') || (b.label === 'bean' && a.label === 'hazard')) {
        this.onHazardDeath();
        return;
      }

      // Boulder touches Bean
      if ((a.label === 'bean' && b.label === 'boulder') || (b.label === 'bean' && a.label === 'boulder')) {
        this.onSquashed();
        return;
      }
    }
  }

  onStung(x, y) {
    if (this.state === 'stung' || this.state === 'won') return;
    this.state = 'stung';
    this.beanState.stung = true;
    this.beanState.stungAnim = 1.0;
    this.sounds.hit();
    this.sounds.fail();
    this.haptics.heavy();
    this.fx.shake(10, 0.45);

    // Stung sting particle burst
    this.fx.burst(x, y, '#ffd166', 16, 180, 0.6, 3.5);
    this.fx.text(this.beanBody.position.x, this.beanBody.position.y - 45, 'OUCH! 🐝', '#ef233c', 26, 1.2);
  }

  onHazardDeath() {
    if (this.state === 'stung' || this.state === 'won') return;
    this.state = 'stung';
    this.beanState.stung = true;
    this.sounds.hit();
    this.sounds.fail();
    this.haptics.heavy();
    this.fx.shake(12, 0.5);
    this.fx.burst(this.beanBody.position.x, this.beanBody.position.y, '#f77f00', 25, 220, 0.7, 4);
    this.fx.text(this.beanBody.position.x, this.beanBody.position.y - 40, 'SIZZLE! 💥', '#ff7b00', 24, 1.0);
  }

  onSquashed() {
    if (this.state === 'stung' || this.state === 'won') return;
    this.state = 'stung';
    this.beanState.stung = true;
    this.sounds.hit();
    this.sounds.fail();
    this.haptics.heavy();
    this.fx.shake(14, 0.5);
    this.fx.burst(this.beanBody.position.x, this.beanBody.position.y, '#e63946', 22, 200, 0.6, 4);
    this.fx.text(this.beanBody.position.x, this.beanBody.position.y - 40, 'CRUSHED! 🍬', '#e63946', 24, 1.0);
  }

  finishDrawing() {
    if (this.points.length < 2) {
      this.points = [];
      this.inkUsed = 0;
      return;
    }

    // Create Matter.js compound body for the drawn line
    const parts = [];
    const thickness = 14;

    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) continue;

      const angle = Math.atan2(dy, dx);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      // Capsule rect segment
      const rect = Bodies.rectangle(midX, midY, dist + 2, thickness, {
        angle,
        friction: 0.75,
        restitution: 0.1,
        density: 0.0035,
        label: 'drawnLine',
      });
      parts.push(rect);

      // Vertex cap circle
      const cap = Bodies.circle(p1.x, p1.y, thickness / 2, {
        friction: 0.75,
        restitution: 0.1,
        density: 0.0035,
        label: 'drawnLine',
      });
      parts.push(cap);
    }

    // End cap
    const lastP = this.points[this.points.length - 1];
    parts.push(
      Bodies.circle(lastP.x, lastP.y, thickness / 2, {
        friction: 0.75,
        restitution: 0.1,
        density: 0.0035,
        label: 'drawnLine',
      })
    );

    // Create rigid compound body
    const lineBody = Body.create({
      parts,
      friction: 0.8,
      frictionAir: 0.015,
      restitution: 0.12,
      density: 0.0035,
      label: 'drawnLine',
    });

    // Store relative points for smooth rendering inside body transform
    const ox = lineBody.position.x;
    const oy = lineBody.position.y;
    this.drawnRelPoints = this.points.map((p) => ({ x: p.x - ox, y: p.y - oy }));
    this.drawnBody = lineBody;

    Composite.add(this.engine.world, lineBody);

    // Transition to defense
    this.state = 'defending';
    this.defendTimer = 6.0;
    this.totalDefendTime = 6.0;
    this.sounds.drop();
    this.haptics.medium();

    // Hives start shaking & honey drops
    for (const h of this.hives) {
      h.shake = 1.0;
      this.fx.burst(h.x, h.y + 20, '#ffb703', 8, 80, 0.5, 2.5);
    }
  }

  update(dt) {
    this.fx.update(dt);
    this.stateTimer += dt;

    // Handle Reset Button Hover / Click
    const mx = this.input.x;
    const my = this.input.y;
    const resetDist = Math.hypot(mx - this.resetBtn.x, my - this.resetBtn.y);
    const hitReset = resetDist <= this.resetBtn.r;

    if (hitReset && this.input.pressed) {
      this.resetBtn.pressed = true;
      this.sounds.bubble();
      this.haptics.light();
      this.setupLevel(this.levelIdx);
      return;
    }
    if (this.input.released) {
      this.resetBtn.pressed = false;
    }

    // 1. DRAWING STATE
    if (this.state === 'drawing') {
      if (this.input.down && !hitReset) {
        if (this.points.length === 0) {
          // First point
          this.points.push({ x: mx, y: my });
          this.sounds.tone({ f: 480, to: 620, dur: 0.05, vol: 0.08 });
        } else {
          const last = this.points[this.points.length - 1];
          const d = Math.hypot(mx - last.x, my - last.y);
          if (d >= 8) {
            if (this.inkUsed + d >= this.maxInk) {
              // Clamp and auto-finish
              const fraction = (this.maxInk - this.inkUsed) / d;
              this.points.push({
                x: last.x + (mx - last.x) * fraction,
                y: last.y + (my - last.y) * fraction,
              });
              this.inkUsed = this.maxInk;
              this.finishDrawing();
            } else {
              this.points.push({ x: mx, y: my });
              this.inkUsed += d;
              // Occasional scratch sound & ink dust
              if (Math.random() < 0.25) {
                this.sounds.noise({ dur: 0.03, from: 2200, to: 800, vol: 0.06 });
                this.fx.burst(mx, my, '#2b2d42', 2, 30, 0.2, 1.8);
              }
            }
          }
        }
      } else if (this.input.released && this.points.length > 0) {
        this.finishDrawing();
      }
    }

    // 2. DEFENDING STATE
    if (this.state === 'defending') {
      // Step Physics Engine
      Engine.update(this.engine, Math.min(dt * 1000, 33));

      // Update Rotators
      for (const rot of this.rotators) {
        rot.currentAngle += rot.speed * dt;
        Body.setAngle(rot.body, rot.currentAngle);
      }

      // Decrement Countdown
      const oldSec = Math.ceil(this.defendTimer);
      this.defendTimer -= dt;
      const newSec = Math.ceil(this.defendTimer);
      if (newSec !== oldSec && newSec > 0) {
        this.sounds.tick();
        this.haptics.light();
      }

      // Check for survival
      if (this.defendTimer <= 0) {
        this.onLevelWin();
      }

      // Spawn Bees from Hives
      for (const h of this.hives) {
        h.shake = Math.max(0, h.shake - dt * 2.5);
        if (h.beesRemaining > 0) {
          h.spawnTimer -= dt;
          if (h.spawnTimer <= 0) {
            h.spawnTimer = 0.075;
            h.beesRemaining--;
            this.spawnBee(h);
          }
        }
      }

      // Update Swarm Physics & Steering
      const beanPos = this.beanBody.position;
      for (const bee of this.bees) {
        this.updateBee(bee, beanPos, dt);
      }

      // Update Bean State
      this.beanState.x = this.beanBody.position.x;
      this.beanState.y = this.beanBody.position.y;
      this.beanState.vx = this.beanBody.velocity.x;
      this.beanState.vy = this.beanBody.velocity.y;
      this.beanState.angle = this.beanBody.angle;
      this.beanState.wobble += dt * 8;
    }

    // 3. STUNG (DEFEAT) STATE
    if (this.state === 'stung') {
      // Keep stepping physics briefly so objects tumble
      Engine.update(this.engine, Math.min(dt * 1000, 33));
      this.beanState.stungAnim += dt * 2;
      this.beanState.x = this.beanBody.position.x;
      this.beanState.y = this.beanBody.position.y;

      if (this.stateTimer > 1.35) {
        this.die('Stung by angry bees! 🐝');
      }
    }

    // 4. WON STATE
    if (this.state === 'won') {
      Engine.update(this.engine, Math.min(dt * 1000, 33));
      // Bees fly away dizzy
      for (const bee of this.bees) {
        bee.body.velocity.y -= 0.15;
        bee.body.velocity.x += Math.sin(this.stateTimer * 5 + bee.id) * 0.2;
      }
      if (this.stateTimer > 1.6) {
        this.nextLevel();
      }
    }
  }

  spawnBee(hive) {
    this.beeIdCounter++;
    const bx = hive.x + (Math.random() - 0.5) * 16;
    const by = hive.y + 14;

    const beeBody = Bodies.circle(bx, by, 8.5, {
      friction: 0.1,
      frictionAir: 0.045,
      restitution: 0.55,
      density: 0.0012,
      label: 'bee',
    });

    // Initial ejection impulse outward
    const spread = (Math.random() - 0.5) * 3;
    Body.setVelocity(beeBody, { x: spread, y: 3.5 });
    Composite.add(this.engine.world, beeBody);

    this.bees.push({
      id: this.beeIdCounter,
      body: beeBody,
      wingPhase: Math.random() * TAU,
      buzzOffset: Math.random() * 10,
      isQueen: hive.isQueen,
      alive: true,
    });

    // Spawn puff
    this.fx.burst(bx, by, '#ffbe0b', 4, 60, 0.35, 2);
  }

  updateBee(bee, beanPos, dt) {
    const bPos = bee.body.position;
    const dx = beanPos.x - bPos.x;
    const dy = beanPos.y - bPos.y;
    const dist = Math.hypot(dx, dy);

    bee.wingPhase += dt * 55;

    if (dist > 8) {
      const nx = dx / dist;
      const ny = dy / dist;

      // Buzzing flutter perpendicular to direction of travel
      const flutter = Math.sin(this.stateTimer * 22 + bee.buzzOffset) * 0.45;
      const fx = -ny * flutter;
      const fy = nx * flutter;

      // Propulsion force towards Bean
      const forceMag = bee.isQueen ? 0.0009 : 0.00055;
      Body.applyForce(bee.body, bPos, {
        x: (nx + fx) * forceMag,
        y: (ny + fy) * forceMag,
      });

      // Clamp bee velocity to prevent clipping
      const spd = Math.hypot(bee.body.velocity.x, bee.body.velocity.y);
      const maxSpd = 5.6;
      if (spd > maxSpd) {
        Body.setVelocity(bee.body, {
          x: (bee.body.velocity.x / spd) * maxSpd,
          y: (bee.body.velocity.y / spd) * maxSpd,
        });
      }
    }

    // Direct proximity check fallback
    if (dist < 22 && this.state === 'defending') {
      this.onStung(bPos.x, bPos.y);
    }
  }

  onLevelWin() {
    this.state = 'won';
    this.stateTimer = 0;
    this.sounds.survive();
    this.haptics.success();

    // Calculate Stars
    const inkFraction = this.inkUsed / this.maxInk;
    let stars = 1;
    if (inkFraction <= 0.4) stars = 3;
    else if (inkFraction <= 0.7) stars = 2;

    this.totalStars += stars;

    // Score calculation
    const basePts = 500;
    const starBonus = stars * 350;
    const inkBonus = Math.round((1 - inkFraction) * 450);
    const award = basePts + starBonus + inkBonus;
    this.score += award;

    // Victory Confetti
    for (let i = 0; i < 3; i++) {
      this.fx.burst(150 + i * 80, 260, ['#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#9d4edd'][i % 5], 18, 220, 0.9, 4, 180);
    }
    this.fx.text(225, 240, `+${award} PTS!`, '#ffd166', 30, 1.4);
    this.fx.text(225, 280, stars === 3 ? '⭐⭐⭐ PERFECT!' : stars === 2 ? '⭐⭐ GREAT SHIELD!' : '⭐ SAVED!', '#ffffff', 22, 1.4);
  }

  nextLevel() {
    this.levelIdx++;
    this.setupLevel(this.levelIdx);
  }

  destroy() {
    if (this.engine) {
      if (this.onCollide) Events.off(this.engine, 'collisionStart', this.onCollide);
      Composite.clear(this.engine.world, false);
      Engine.clear(this.engine);
    }
  }

  serialize() {
    return {
      levelIdx: this.levelIdx,
      totalStars: this.totalStars,
    };
  }

  /* -------------------------------------------------------- Rendering */
  render() {
    const { ctx, W, H } = this;
    const shake = this.fx.offset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Graph Paper Notebook Background
    this.renderNotebook(ctx, W, H);

    // 2. Hazards (Lava / Spikes)
    this.renderHazards(ctx);

    // 3. Static Platforms & Pegs
    this.renderPlatforms(ctx);

    // 4. Rotators & Boulders
    this.renderObstacles(ctx);

    // 5. Drawn Ink Line (Under construction OR dynamic rigid body)
    this.renderDrawnLine(ctx);

    // 6. The Bean Mascot
    this.renderBean(ctx);

    // 7. Beehives
    this.renderHives(ctx);

    // 8. Swarming Bees
    this.renderBees(ctx);

    // 9. Particles and FX
    this.fx.render(ctx);

    // 10. Top HUD: Level Title, Ink Gauge, Stars, Reset Button, and Countdown
    this.renderHUD(ctx, W, H);

    ctx.restore();
  }

  renderNotebook(ctx, W, H) {
    // Warm notebook paper cream
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, W, H);

    // Faint horizontal ruled notebook lines
    ctx.strokeStyle = 'rgba(74, 144, 226, 0.12)';
    ctx.lineWidth = 1.5;
    for (let y = 110; y < H; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Red vertical margin rule on the left
    ctx.strokeStyle = 'rgba(239, 71, 111, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(42, 100);
    ctx.lineTo(42, H);
    ctx.stroke();

    // Cute corner notebook doodles
    ctx.save();
    ctx.fillStyle = 'rgba(255, 183, 3, 0.25)';
    ctx.strokeStyle = 'rgba(180, 120, 20, 0.35)';
    ctx.lineWidth = 1.5;
    // Tiny doodle honey jar in top left
    ctx.beginPath();
    ctx.roundRect(14, 116, 20, 22, 4);
    ctx.fill();
    ctx.stroke();
    // Tiny jar lid
    ctx.beginPath();
    ctx.roundRect(11, 113, 26, 4, 2);
    ctx.fillStyle = 'rgba(180, 120, 20, 0.3)';
    ctx.fill();
    ctx.stroke();

    // Tiny doodle flower in bottom left
    ctx.fillStyle = 'rgba(239, 71, 111, 0.2)';
    ctx.beginPath();
    ctx.arc(24, 760, 6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  renderHazards(ctx) {
    const t = this.stateTimer;
    for (const h of this.hazards) {
      if (h.type === 'lava') {
        // Candy Lava Pit
        const lg = ctx.createLinearGradient(0, h.y - h.h / 2, 0, h.y + h.h / 2);
        lg.addColorStop(0, '#ff4800');
        lg.addColorStop(0.4, '#ff7b00');
        lg.addColorStop(1, '#9d0208');

        ctx.fillStyle = lg;
        ctx.fillRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h);

        // Animated glowing lava surface ripples
        ctx.fillStyle = '#ffbe0b';
        const waveTop = h.y - h.h / 2;
        ctx.beginPath();
        ctx.moveTo(h.x - h.w / 2, waveTop);
        for (let x = h.x - h.w / 2; x <= h.x + h.w / 2; x += 15) {
          const wy = waveTop + Math.sin(x * 0.05 + t * 4) * 4;
          ctx.lineTo(x, wy);
        }
        ctx.lineTo(h.x + h.w / 2, waveTop + 10);
        ctx.lineTo(h.x - h.w / 2, waveTop + 10);
        ctx.fill();

        // Rising bubbles
        for (let i = 0; i < 4; i++) {
          const bx = h.x - h.w / 2 + 35 + ((i * 90 + t * 40) % h.w);
          const by = waveTop + 8 - ((t * 25 + i * 15) % 35);
          ctx.beginPath();
          ctx.arc(bx, by, 3 + (i % 3), 0, TAU);
          ctx.fillStyle = 'rgba(255, 230, 110, 0.7)';
          ctx.fill();
        }
      } else if (h.type === 'spikes') {
        // Cartoon Spike Trap
        const spikeW = 16;
        const count = Math.floor(h.w / spikeW);
        const startX = h.x - h.w / 2;
        const topY = h.y - h.h / 2;
        const botY = h.y + h.h / 2;

        ctx.fillStyle = '#2b2d42';
        ctx.strokeStyle = '#1d3557';
        ctx.lineWidth = 2;

        for (let i = 0; i < count; i++) {
          const sx = startX + i * spikeW;
          ctx.beginPath();
          ctx.moveTo(sx, botY);
          ctx.lineTo(sx + spikeW / 2, topY + 4);
          ctx.lineTo(sx + spikeW, botY);
          ctx.closePath();
          // Alternate red-white candy stripes
          ctx.fillStyle = i % 2 === 0 ? '#e63946' : '#f1faee';
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }

  renderPlatforms(ctx) {
    for (const p of this.platforms) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.angle) ctx.rotate(p.angle);

      const hw = p.w / 2;
      const hh = p.h / 2;

      // Platform body (chocolate earth / block)
      ctx.fillStyle = '#6c584c';
      ctx.strokeStyle = '#382923';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, p.w, p.h, 8);
      ctx.fill();
      ctx.stroke();

      // Lush grass trim on top
      ctx.fillStyle = '#588157';
      ctx.beginPath();
      ctx.roundRect(-hw + 1, -hh, p.w - 2, Math.min(14, p.h * 0.45), [8, 8, 4, 4]);
      ctx.fill();

      // Cute grass scalloped fringe
      ctx.fillStyle = '#3a5a40';
      for (let x = -hw + 10; x < hw - 10; x += 14) {
        ctx.beginPath();
        ctx.arc(x, -hh + 12, 3, 0, Math.PI);
        ctx.fill();
      }

      ctx.restore();
    }

    // Pegs (Wooden Anchor Posts with screw cross)
    for (const peg of this.pegs) {
      ctx.save();
      ctx.translate(peg.x, peg.y);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.arc(2, 3, peg.r, 0, TAU);
      ctx.fill();

      // Wooden Peg
      const pg = ctx.createRadialGradient(-3, -3, 2, 0, 0, peg.r);
      pg.addColorStop(0, '#dda15e');
      pg.addColorStop(0.8, '#bc6c25');
      pg.addColorStop(1, '#7f4f24');

      ctx.fillStyle = pg;
      ctx.strokeStyle = '#432818';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, peg.r, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Inner Screw Metal Head
      ctx.fillStyle = '#ced4da';
      ctx.strokeStyle = '#495057';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, peg.r * 0.42, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Crosshead screw indent
      ctx.strokeStyle = '#343a40';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-peg.r * 0.22, 0);
      ctx.lineTo(peg.r * 0.22, 0);
      ctx.moveTo(0, -peg.r * 0.22);
      ctx.lineTo(0, peg.r * 0.22);
      ctx.stroke();

      ctx.restore();
    }
  }

  renderObstacles(ctx) {
    // Rotators
    for (const rot of this.rotators) {
      ctx.save();
      ctx.translate(rot.x, rot.y);
      ctx.rotate(rot.currentAngle);

      const hw = rot.w / 2;
      const hh = rot.h / 2;

      // Wooden candy blade
      ctx.fillStyle = '#e76f51';
      ctx.strokeStyle = '#264653';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, rot.w, rot.h, 6);
      ctx.fill();
      ctx.stroke();

      // Center Axle Pin
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // Boulders
    for (const b of this.boulders) {
      const pos = b.body.position;
      const angle = b.body.angle;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      // Jawbreaker spherical gradient
      const bg = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.35, 3, 0, 0, b.r);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.3, b.color || '#e63946');
      bg.addColorStop(0.85, '#a4161a');
      bg.addColorStop(1, '#660708');

      ctx.fillStyle = bg;
      ctx.strokeStyle = '#2b0908';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Jawbreaker rings / spots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(-b.r * 0.3, -b.r * 0.3, b.r * 0.22, 0, TAU);
      ctx.fill();

      ctx.restore();
    }
  }

  renderDrawnLine(ctx) {
    // Case A: Still actively drawing (render user path directly)
    if (this.state === 'drawing' && this.points.length > 0) {
      this.drawStrokePath(ctx, this.points);
      return;
    }

    // Case B: Dynamic Rigid Body (render via body transform)
    if (this.drawnBody && this.drawnRelPoints) {
      const pos = this.drawnBody.position;
      const angle = this.drawnBody.angle;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);
      this.drawStrokePath(ctx, this.drawnRelPoints);
      ctx.restore();
    }
  }

  drawStrokePath(ctx, pts) {
    if (pts.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Dark bold outer comic outline
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.strokeStyle = '#1b1b2f';
    ctx.lineWidth = 15;
    ctx.stroke();

    // 2. Vibrant Royal Blue / Ink core
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.strokeStyle = '#4361ee';
    ctx.lineWidth = 9;
    ctx.stroke();

    // 3. Specular gloss highlight along top surface
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y - 2);
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2 - 2;
      ctx.quadraticCurveTo(p0.x, p0.y - 2, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y - 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  renderBean(ctx) {
    const b = this.beanState;
    const isStung = this.state === 'stung';
    const isWon = this.state === 'won';
    const isDefending = this.state === 'defending';

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);

    const scale = isStung ? 1.0 + Math.min(0.35, b.stungAnim * 0.4) : 1.0;
    ctx.scale(scale, scale);

    // Mascot options
    let eyeExpr = 'happy';
    if (isStung) eyeExpr = 'squish';
    else if (isWon) eyeExpr = 'wink';
    else if (isDefending) eyeExpr = 'blink';

    drawBean(ctx, 0, 0, 28, {
      color: isStung ? '#ff758f' : '#25e6ff',
      bellyColor: isStung ? '#ff4d6d' : '#1ec0db',
      eyes: eyeExpr,
      hat: isWon ? 'crown' : null,
      dead: isStung,
    });

    // Anxious Sweat Drops during Defending
    if (isDefending && !isStung && !isWon) {
      const dropY = -18 + Math.sin(this.stateTimer * 8) * 3;
      ctx.fillStyle = '#4cc9f0';
      ctx.strokeStyle = '#0077b6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(16, dropY, 3, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Comical Stung Features: Giant Welts & Bandage
    if (isStung) {
      // Swollen bumps on head
      ctx.fillStyle = '#ef233c';
      ctx.strokeStyle = '#800f2f';
      ctx.lineWidth = 2;

      // Bump 1 (left forehead)
      ctx.beginPath();
      ctx.arc(-14, -20, 7, 0, TAU);
      ctx.fill(); ctx.stroke();
      // Little highlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-16, -22, 2, 0, TAU);
      ctx.fill();

      // Bump 2 (right cheek)
      ctx.fillStyle = '#ef233c';
      ctx.beginPath();
      ctx.arc(15, -4, 8, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(13, -6, 2.5, 0, TAU);
      ctx.fill();

      // Adhesive Bandage across face
      ctx.save();
      ctx.rotate(0.2);
      ctx.fillStyle = '#ffbe0b';
      ctx.strokeStyle = '#d48b00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-10, -8, 20, 8, 2);
      ctx.fill();
      ctx.stroke();
      // Little dots on bandage
      ctx.fillStyle = '#d48b00';
      ctx.beginPath();
      ctx.arc(-4, -4, 1, 0, TAU);
      ctx.arc(0, -4, 1, 0, TAU);
      ctx.arc(4, -4, 1, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Tear Fountains splashing out
      const tearT = this.stateTimer * 12;
      ctx.fillStyle = 'rgba(76, 201, 240, 0.85)';
      [-18, 18].forEach((tx, idx) => {
        const dir = idx === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.arc(tx + dir * (tearT % 12), -10 + (tearT % 14), 3, 0, TAU);
        ctx.fill();
      });
    }

    ctx.restore();
  }

  renderHives(ctx) {
    for (const h of this.hives) {
      ctx.save();
      const shakeX = (Math.random() - 0.5) * 8 * h.shake;
      const shakeY = (Math.random() - 0.5) * 6 * h.shake;
      ctx.translate(h.x + shakeX, h.y + shakeY);

      // Hanging vine / branch from ceiling
      ctx.strokeStyle = '#40916c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -h.y);
      ctx.quadraticCurveTo(8, -h.y / 2, 0, -26);
      ctx.stroke();

      // Beehive layered straw dome (Cartoon Skep)
      const layers = [
        { y: -22, rx: 14, ry: 7 },
        { y: -12, rx: 24, ry: 9 },
        { y: 0, rx: 28, ry: 11 },
        { y: 12, rx: 24, ry: 9 },
        { y: 22, rx: 16, ry: 7 },
      ];

      for (const lyr of layers) {
        const hg = ctx.createLinearGradient(-lyr.rx, 0, lyr.rx, 0);
        hg.addColorStop(0, '#ffb703');
        hg.addColorStop(0.5, '#ffd166');
        hg.addColorStop(1, '#fb8500');

        ctx.fillStyle = hg;
        ctx.strokeStyle = '#7c4d00';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, lyr.y, lyr.rx, lyr.ry, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      // Dark Entrance Doorway Hole
      ctx.fillStyle = '#211710';
      ctx.strokeStyle = '#583600';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 8, 9, 0, Math.PI, false);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Honey Dripping droplet
      const dripY = 16 + Math.sin(this.stateTimer * 3 + h.x) * 4;
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.arc(0, dripY, 3, 0, TAU);
      ctx.fill();

      // Queen Bee Crown on Hive
      if (h.isQueen) {
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-12, -28);
        ctx.lineTo(-12, -38);
        ctx.lineTo(-6, -32);
        ctx.lineTo(0, -42);
        ctx.lineTo(6, -32);
        ctx.lineTo(12, -38);
        ctx.lineTo(12, -28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  renderBees(ctx) {
    for (const bee of this.bees) {
      const pos = bee.body.position;
      const vel = bee.body.velocity;
      const angle = Math.atan2(vel.y, vel.x);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      // Flapping Translucent Gossamer Wings
      const wingSpread = Math.sin(bee.wingPhase) * 10;
      ctx.fillStyle = 'rgba(235, 248, 255, 0.75)';
      ctx.strokeStyle = 'rgba(100, 180, 240, 0.8)';
      ctx.lineWidth = 1.2;

      // Top wing
      ctx.beginPath();
      ctx.ellipse(-2, -7 - wingSpread * 0.3, 7, 4 + Math.abs(wingSpread * 0.2), -0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Bottom wing
      ctx.beginPath();
      ctx.ellipse(-2, 7 + wingSpread * 0.3, 7, 4 + Math.abs(wingSpread * 0.2), 0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Oval Fluffy Bee Body
      const br = bee.isQueen ? 11 : 8.5;
      ctx.fillStyle = '#ffbe0b';
      ctx.strokeStyle = '#3a2000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, br * 1.25, br, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // 3 Black Stripes
      ctx.fillStyle = '#1b1b1b';
      [-3, 0, 3].forEach((sx) => {
        ctx.beginPath();
        ctx.rect(sx - 1, -br * 0.9, 2.2, br * 1.8);
        ctx.fill();
      });

      // Needle Stinger at tail
      ctx.fillStyle = '#0b090a';
      ctx.beginPath();
      ctx.moveTo(-br * 1.25, -2);
      ctx.lineTo(-br * 1.25 - 4.5, 0);
      ctx.lineTo(-br * 1.25, 2);
      ctx.closePath();
      ctx.fill();

      // Angry Cartoon Eyes at front
      if (this.state === 'won') {
        // Dizzy spiral eyes when won
        ctx.strokeStyle = '#051923';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(br * 0.65, -2.5, 2.5, 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(br * 0.65, -2.5, 3, 0, TAU);
        ctx.fill();
        // Slanted angry pupil
        ctx.fillStyle = '#d90429';
        ctx.beginPath();
        ctx.arc(br * 0.75, -2.5, 1.6, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  renderHUD(ctx, W) {
    // 1. Level Header Pill (comfortably below Reel header bar)
    ctx.save();
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.roundRect(34, 92, 175, 32, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LVL ${this.levelIdx + 1}: ${this.curLevel.name}`, 46, 108);

    // 2. Ink Gauge / Tube
    const inkX = 224;
    const inkY = 98;
    const inkW = 145;
    const inkH = 20;
    const inkFraction = Math.max(0, 1 - this.inkUsed / this.maxInk);

    // Background tube
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.strokeStyle = '#2b2d42';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(inkX, inkY, inkW, inkH, 10);
    ctx.fill();
    ctx.stroke();

    // Ink Liquid Fill
    if (inkFraction > 0) {
      const fillW = Math.max(6, (inkW - 4) * inkFraction);
      const ig = ctx.createLinearGradient(inkX, 0, inkX + fillW, 0);
      ig.addColorStop(0, '#4361ee');
      ig.addColorStop(1, '#3a0ca3');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.roundRect(inkX + 2, inkY + 2, fillW, inkH - 4, 8);
      ctx.fill();

      // Liquid shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.roundRect(inkX + 4, inkY + 3, fillW - 4, 3, 1.5);
      ctx.fill();
    }

    // 3 Stars Threshold Indicators
    const s1X = inkX + inkW * 0.3; // 3 Stars threshold
    const s2X = inkX + inkW * 0.6; // 2 Stars threshold

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    [s1X, s2X].forEach((sx) => {
      ctx.beginPath();
      ctx.moveTo(sx, inkY + 2);
      ctx.lineTo(sx, inkY + inkH - 2);
      ctx.stroke();
    });

    // Star icons above ink bar
    const stars = inkFraction > 0.6 ? 3 : inkFraction > 0.3 ? 2 : 1;
    for (let i = 0; i < 3; i++) {
      const starActive = i < stars;
      ctx.fillStyle = starActive ? '#ffd166' : 'rgba(0, 0, 0, 0.2)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⭐', inkX + 25 + i * 46, inkY - 7);
    }

    // Pencil Icon next to ink
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('✏️', inkX - 4, inkY + 13);

    // 3. Reset Button (↺)
    const btn = this.resetBtn;
    ctx.save();
    ctx.translate(btn.x, btn.y);
    if (btn.pressed) ctx.scale(0.92, 0.92);

    // Button Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.arc(1, 2, btn.r, 0, TAU);
    ctx.fill();

    // Button Face
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2b2d42';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, btn.r, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Reset Symbol ↺
    ctx.fillStyle = '#2b2d42';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↺', 0, 1);
    ctx.restore();

    // 4. Circular Countdown Badge (Defending State)
    if (this.state === 'defending') {
      const timerSec = Math.max(0, this.defendTimer);
      const pulse = 1.0 + Math.max(0, (1 - (this.defendTimer % 1)) * 0.12);

      ctx.save();
      ctx.translate(W / 2, 160);
      ctx.scale(pulse, pulse);

      // Outer glow / shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.arc(2, 3, 28, 0, TAU);
      ctx.fill();

      // Circular Badge background
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ef233c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Circular Ring Progress
      const prog = timerSec / this.totalDefendTime;
      ctx.strokeStyle = '#4361ee';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + TAU * prog, false);
      ctx.stroke();

      // Time Text (Seconds remaining)
      ctx.fillStyle = '#2b2d42';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.ceil(timerSec)}s`, 0, 1);

      ctx.restore();
    }

    // 5. Drawing Tutorial Prompt
    if (this.state === 'drawing' && this.points.length === 0) {
      const bob = Math.sin(this.stateTimer * 4) * 4;
      ctx.fillStyle = '#2b2d42';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DRAW TO SHIELD THE BEAN! ✏️', W / 2, 160 + bob);
    }

    ctx.restore();
  }
}
