import Matter from 'matter-js';
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
    isPrestige: false,
    parScore60s: 650,
    cue: 'DRAW A SHIELD!',
    prestigeCue: 'FIERCER BEES · LESS INK!',
    scaling: {
      beeForceMult: { base: 1.0, rate: 0.16, cap: 1.50, mode: 'up',   label: 'Bee Aggression' },
      extraBees:    { base: 0,   rate: 0.22, cap: 4,    mode: 'up',   round: true, deltaFormat: 'abs', label: 'Bees / Hive' },
      inkScale:     { base: 1.0, rate: 0.16, floor: 0.76, mode: 'down', label: 'Ink Cap' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.levelIdx = (saved && Number.isFinite(saved.levelIdx)) ? Math.max(0, saved.levelIdx) : 0;
    this.totalStars = (saved && Number.isFinite(saved.totalStars)) ? Math.max(0, saved.totalStars) : 0;

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
    this.maxInk = Math.round((data.maxInk || 800) * (this.diff.inkScale ?? 1));
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
    const extra = this.diff.extraBees || 0;
    this.hives = data.hives.map((h, i) => ({
      x: h.x,
      y: h.y,
      beesTotal: (h.bees || 14) + extra,
      beesRemaining: (h.bees || 14) + extra,
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
      const fMult = this.diff.beeForceMult ?? 1;
      const forceMag = (bee.isQueen ? 0.0009 : 0.00055) * fMult;
      Body.applyForce(bee.body, bPos, {
        x: (nx + fx) * forceMag,
        y: (ny + fy) * forceMag,
      });

      // Clamp bee velocity to prevent clipping
      const spd = Math.hypot(bee.body.velocity.x, bee.body.velocity.y);
      const maxSpd = 5.6 * Math.sqrt(fMult);
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

  restoreLabel() {
    return `Level ${this.levelIdx + 1} · ⭐ ×${this.totalStars}`;
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
    // Warm sunlit diorama paper gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fffef9');
    bg.addColorStop(0.6, '#fffaf0');
    bg.addColorStop(1, '#f8efe0');
    ctx.fillStyle = bg;
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

    // Soft rose vertical margin rule on the left
    ctx.strokeStyle = 'rgba(239, 71, 111, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(42, 100);
    ctx.lineTo(42, H);
    ctx.stroke();

    // Soft 3D vinyl margin sticker doodles
    ctx.save();
    ctx.globalAlpha = 0.42;
    drawToyBevelRect(ctx, 13, 116, 20, 22, 5, '#ffd166', {
      depth: 2,
      rimColor: toyRim('#fb8500', 0.45),
      lineWidth: 1.2,
      gloss: true,
    });
    drawToyPill(ctx, 10, 112, 26, 5, '#d97706', {
      rimColor: toyRim('#92400e', 0.5),
      lineWidth: 1.0,
      gloss: true,
    });
    drawToySphere(ctx, 23, 760, 7, '#ff758f', {
      rimColor: toyRim('#ef476f', 0.45),
      lineWidth: 1.1,
      shine: 0.55,
    });
    ctx.restore();
  }

  renderHazards(ctx) {
    const t = this.stateTimer;
    for (const h of this.hazards) {
      if (h.type === 'lava') {
        // Candy Lava Pit with glossy glowing upper crust
        const left = h.x - h.w / 2;
        const top = h.y - h.h / 2;
        const lg = ctx.createLinearGradient(0, top, 0, h.y + h.h / 2);
        lg.addColorStop(0, '#ff6d00');
        lg.addColorStop(0.38, '#ff4800');
        lg.addColorStop(1, '#9d0208');

        ctx.fillStyle = lg;
        ctx.fillRect(left, top, h.w, h.h);

        // Animated glowing lava surface ripples
        const surfG = ctx.createLinearGradient(0, top - 4, 0, top + 14);
        surfG.addColorStop(0, '#fde047');
        surfG.addColorStop(1, '#ff9e00');
        ctx.fillStyle = surfG;
        ctx.beginPath();
        ctx.moveTo(left, top);
        for (let x = left; x <= h.x + h.w / 2; x += 15) {
          const wy = top + Math.sin(x * 0.05 + t * 4) * 4;
          ctx.lineTo(x, wy);
        }
        ctx.lineTo(h.x + h.w / 2, top + 12);
        ctx.lineTo(left, top + 12);
        ctx.closePath();
        ctx.fill();

        // Top glossy lava highlight line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = left; x <= h.x + h.w / 2; x += 15) {
          const wy = top + Math.sin(x * 0.05 + t * 4) * 4;
          if (x === left) ctx.moveTo(x, wy + 1);
          else ctx.lineTo(x, wy + 1);
        }
        ctx.stroke();

        // Rising glossy lava bubbles
        for (let i = 0; i < 4; i++) {
          const bx = left + 35 + ((i * 90 + t * 40) % h.w);
          const by = top + 8 - ((t * 25 + i * 15) % 35);
          drawToySphere(ctx, bx, by, 3.2 + (i % 3), '#ffd166', {
            rimColor: toyRim('#ff6d00', 0.5),
            lineWidth: 0.9,
            shine: 0.8,
            bottomBounce: false,
          });
        }
      } else if (h.type === 'spikes') {
        // 3D Beveled Candy Spike Trap
        const spikeW = 16;
        const count = Math.floor(h.w / spikeW);
        const startX = h.x - h.w / 2;
        const topY = h.y - h.h / 2;
        const botY = h.y + h.h / 2;
        const spikeRim = toyRim('#e63946', 0.62);
        const spikeLw = toyLineW(spikeW, 0.08, 1.0, 1.7);

        // Beveled metallic base bar under spikes
        drawToyBevelRect(ctx, startX, botY - 12, h.w, 12, 4, '#334155', {
          depth: 2,
          rimColor: '#0f172a',
          lineWidth: 1.5,
          gloss: true,
        });

        ctx.lineJoin = 'round';
        for (let i = 0; i < count; i++) {
          const sx = startX + i * spikeW;
          const midX = sx + spikeW / 2;
          const baseCol = i % 2 === 0 ? '#e63946' : '#f8fafc';

          // Left sunlit bevel face
          ctx.fillStyle = shadeColor(baseCol, 0.25);
          ctx.beginPath();
          ctx.moveTo(sx, botY - 8);
          ctx.lineTo(midX, topY + 4);
          ctx.lineTo(midX, botY - 8);
          ctx.closePath();
          ctx.fill();

          // Right shaded bevel face
          ctx.fillStyle = shadeColor(baseCol, -0.18);
          ctx.beginPath();
          ctx.moveTo(midX, botY - 8);
          ctx.lineTo(midX, topY + 4);
          ctx.lineTo(sx + spikeW, botY - 8);
          ctx.closePath();
          ctx.fill();

          // Crisp tinted rim
          ctx.strokeStyle = i % 2 === 0 ? spikeRim : toyRim('#94a3b8', 0.55);
          ctx.lineWidth = spikeLw;
          ctx.beginPath();
          ctx.moveTo(sx, botY - 8);
          ctx.lineTo(midX, topY + 4);
          ctx.lineTo(sx + spikeW, botY - 8);
          ctx.closePath();
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
      const depth = Math.min(6, Math.max(2.5, p.h * 0.14));
      const blockLw = toyLineW(Math.min(p.w, p.h), 0.045, 1.1, 2.0);

      // Soft grounding diorama drop shadow
      ctx.fillStyle = 'rgba(12, 20, 42, 0.14)';
      traceRoundRect(ctx, -hw + 2, -hh + depth + 4, p.w, p.h, 9);
      ctx.fill();

      // Tactile 3D extruded chocolate earth block
      drawToyBevelRect(ctx, -hw, -hh, p.w, p.h, 9, '#7c5c46', {
        depth,
        rimColor: toyRim('#7c5c46', 0.6),
        lineWidth: blockLw,
        gloss: false,
      });

      // Plush 3D grass trim on top
      const grassH = Math.min(15, p.h * 0.45);
      const gg = ctx.createLinearGradient(0, -hh, 0, -hh + grassH);
      gg.addColorStop(0, '#74c64b');
      gg.addColorStop(0.6, '#588157');
      gg.addColorStop(1, '#3a5a40');
      ctx.fillStyle = gg;
      traceRoundRect(ctx, -hw + 1, -hh + 0.5, p.w - 2, grassH, 7);
      ctx.fill();

      // Glossy top grass specular highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
      traceRoundRect(ctx, -hw + 4, -hh + 2, Math.max(4, p.w - 8), Math.max(2, grassH * 0.28), 3);
      ctx.fill();

      // Scalloped vinyl grass fringe
      ctx.fillStyle = '#487544';
      for (let x = -hw + 10; x < hw - 10; x += 14) {
        ctx.beginPath();
        ctx.arc(x, -hh + grassH - 1, 3.2, 0, Math.PI);
        ctx.fill();
      }

      ctx.restore();
    }

    // Pegs (3D Vinyl Wooden Anchor Posts with metallic screw head)
    for (const peg of this.pegs) {
      ctx.save();
      ctx.translate(peg.x, peg.y);

      const lw = toyLineW(peg.r * 2, 0.048, 1.0, 1.9);
      drawToyShadow(ctx, 2, 4, peg.r * 1.02, peg.r * 0.9, 0.2);

      drawToySphere(ctx, 0, 0, peg.r, '#bc6c25', {
        rimColor: toyRim('#bc6c25', 0.6),
        lineWidth: lw,
        shine: 0.55,
      });

      drawToySphere(ctx, 0, 0, peg.r * 0.45, '#cbd5e1', {
        rimColor: toyRim('#64748b', 0.58),
        lineWidth: lw * 0.75,
        shine: 0.75,
      });

      // Crosshead screw indent
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1.5, peg.r * 0.14);
      ctx.lineCap = 'round';
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

      // 3D beveled candy paddle
      drawToyBevelRect(ctx, -hw, -hh, rot.w, rot.h, 7, '#f46036', {
        depth: 3,
        rimColor: toyRim('#f46036', 0.6),
        lineWidth: toyLineW(rot.h, 0.08, 1.1, 2.0),
        gloss: true,
      });

      // Center Axle Pin
      drawToySphere(ctx, 0, 0, 8.5, '#ffd166', {
        rimColor: toyRim('#d97706', 0.6),
        lineWidth: 1.4,
        shine: 0.8,
      });

      ctx.restore();
    }

    // Boulders
    for (const b of this.boulders) {
      const pos = b.body.position;
      const angle = b.body.angle;
      const baseCol = b.color || '#e63946';

      ctx.save();
      ctx.translate(pos.x, pos.y);
      drawToyShadow(ctx, 2, 4, b.r * 0.98, b.r * 0.9, 0.18);
      ctx.rotate(angle);

      drawToySphere(ctx, 0, 0, b.r, baseCol, {
        rimColor: toyRim(baseCol, 0.6),
        lineWidth: toyLineW(b.r * 2, 0.042, 1.2, 2.2),
        shine: 0.82,
      });

      // Jawbreaker candy speckles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
      [
        { x: b.r * 0.36, y: -b.r * 0.18, r: b.r * 0.11 },
        { x: -b.r * 0.12, y: b.r * 0.42, r: b.r * 0.09 },
        { x: b.r * 0.25, y: b.r * 0.3, r: b.r * 0.07 },
      ].forEach((sp) => {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r, 0, TAU);
        ctx.fill();
      });

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

    const tracePath = (dy = 0) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y + dy);
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2 + dy;
        ctx.quadraticCurveTo(p0.x, p0.y + dy, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y + dy);
    };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 0. Soft 3D diorama shadow below drawn vinyl shield
    tracePath(3);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.2)';
    ctx.lineWidth = 15;
    ctx.stroke();

    // 1. Tinted vinyl rim
    tracePath(0);
    ctx.strokeStyle = toyRim('#4361ee', 0.62);
    ctx.lineWidth = 14.5;
    ctx.stroke();

    // 2. Deep shaded royal blue plastic underside
    tracePath(0.6);
    ctx.strokeStyle = shadeColor('#4361ee', -0.2);
    ctx.lineWidth = 11.5;
    ctx.stroke();

    // 3. Vibrant Royal Blue vinyl core
    tracePath(-0.4);
    ctx.strokeStyle = '#4f6ef7';
    ctx.lineWidth = 9.2;
    ctx.stroke();

    // 4. Glossy upper studio specular ribbon
    tracePath(-2.2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.56)';
    ctx.lineWidth = 3.0;
    ctx.stroke();

    ctx.restore();
  }

  renderBean(ctx) {
    const b = this.beanState;
    const isStung = this.state === 'stung';
    const isWon = this.state === 'won';
    const isDefending = this.state === 'defending';

    // Soft grounding shadow beneath Bean
    drawToyShadow(ctx, b.x, b.y + 22, 18, 5.5, 0.16);

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);

    const scale = isStung ? 1.0 + Math.min(0.35, b.stungAnim * 0.4) : 1.0;
    ctx.scale(scale, scale);

    // Mascot options
    let eyeExpr = 'happy';
    if (isStung) eyeExpr = 'squish';
    else if (isWon) eyeExpr = 'wink';
    else if (isDefending) eyeExpr = 'alert';

    drawBean(ctx, 0, 0, 28, {
      color: isStung ? '#ff758f' : '#25e6ff',
      bellyColor: isStung ? '#ff4d6d' : '#1ec0db',
      eyes: eyeExpr,
      hat: isWon ? 'crown' : null,
      dead: isStung,
    });

    // Anxious Sweat Drop during Defending
    if (isDefending && !isStung && !isWon) {
      const dropY = -18 + Math.sin(this.stateTimer * 8) * 3;
      drawToySphere(ctx, 16, dropY, 3.4, '#4cc9f0', {
        rimColor: toyRim('#0284c7', 0.55),
        lineWidth: 1.0,
        shine: 0.8,
        bottomBounce: false,
      });
    }

    // Comical Stung Features: 3D Vinyl Welts & Bandage
    if (isStung) {
      const weltRim = toyRim('#ef233c', 0.58);
      drawToySphere(ctx, -14, -20, 7, '#ef233c', { rimColor: weltRim, lineWidth: 1.3, shine: 0.72 });
      drawToySphere(ctx, 15, -4, 8, '#ef233c', { rimColor: weltRim, lineWidth: 1.3, shine: 0.72 });

      // Adhesive Bandage across face
      ctx.save();
      ctx.rotate(0.2);
      drawToyBevelRect(ctx, -10, -8, 20, 8, 2.5, '#ffbe0b', {
        depth: 1,
        rimColor: toyRim('#d97706', 0.55),
        lineWidth: 1.0,
        gloss: true,
      });
      ctx.fillStyle = '#b45309';
      [-4, 0, 4].forEach((dx) => {
        ctx.beginPath();
        ctx.arc(dx, -4, 1, 0, TAU);
        ctx.fill();
      });
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

      // Hanging vine / branch from ceiling with soft highlight
      ctx.lineCap = 'round';
      ctx.strokeStyle = toyRim('#40916c', 0.55);
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(0, -h.y);
      ctx.quadraticCurveTo(8, -h.y / 2, 0, -26);
      ctx.stroke();

      ctx.strokeStyle = '#52b788';
      ctx.lineWidth = 2.6;
      ctx.stroke();

      // Beehive layered 3D glossy honey dome
      const layers = [
        { y: -22, rx: 14, ry: 7 },
        { y: -12, rx: 24, ry: 9 },
        { y: 0, rx: 28, ry: 11 },
        { y: 12, rx: 24, ry: 9 },
        { y: 22, rx: 16, ry: 7 },
      ];
      const hiveRim = toyRim('#f59e0b', 0.6);

      for (const lyr of layers) {
        const hg = ctx.createLinearGradient(-lyr.rx, lyr.y - lyr.ry, lyr.rx, lyr.y + lyr.ry);
        hg.addColorStop(0, '#fde047');
        hg.addColorStop(0.45, '#ffbe0b');
        hg.addColorStop(1, '#d97706');

        ctx.fillStyle = hg;
        ctx.strokeStyle = hiveRim;
        ctx.lineWidth = toyLineW(lyr.rx * 2, 0.04, 1.1, 1.8);
        ctx.beginPath();
        ctx.ellipse(0, lyr.y, lyr.rx, lyr.ry, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();

        // Soft glossy shine on upper left of each skep coil
        ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
        ctx.beginPath();
        ctx.ellipse(-lyr.rx * 0.34, lyr.y - lyr.ry * 0.32, lyr.rx * 0.34, lyr.ry * 0.22, -0.2, 0, TAU);
        ctx.fill();
      }

      // Recessed Entrance Doorway Hole
      ctx.fillStyle = '#1e130b';
      ctx.strokeStyle = toyRim('#b45309', 0.6);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 8, 9, 0, Math.PI, false);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glossy Honey Dripping droplet
      const dripY = 16 + Math.sin(this.stateTimer * 3 + h.x) * 4;
      drawToySphere(ctx, 0, dripY, 3.4, '#ffbe0b', {
        rimColor: hiveRim,
        lineWidth: 0.9,
        shine: 0.85,
        bottomBounce: false,
      });

      // 3D Golden Queen Bee Crown on Hive
      if (h.isQueen) {
        const cg = ctx.createLinearGradient(-12, -42, 12, -28);
        cg.addColorStop(0, '#fff3b0');
        cg.addColorStop(0.5, '#ffd166');
        cg.addColorStop(1, '#d97706');
        ctx.fillStyle = cg;
        ctx.strokeStyle = toyRim('#d97706', 0.6);
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
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

        drawToySphere(ctx, 0, -33, 2.5, '#ef233c', {
          rimColor: toyRim('#ef233c', 0.55),
          lineWidth: 0.7,
          shine: 0.8,
          bottomBounce: false,
        });
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

      const br = bee.isQueen ? 11 : 8.5;
      const beeRim = toyRim('#f59e0b', 0.62);
      const beeLw = toyLineW(br * 2, 0.05, 0.95, 1.7);

      // Flapping Translucent Gossamer Wings
      const wingSpread = Math.sin(bee.wingPhase) * 10;
      ctx.fillStyle = 'rgba(235, 248, 255, 0.78)';
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.75)';
      ctx.lineWidth = 1.1;

      ctx.beginPath();
      ctx.ellipse(-2, -7 - wingSpread * 0.3, 7, 4 + Math.abs(wingSpread * 0.2), -0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(-2, 7 + wingSpread * 0.3, 7, 4 + Math.abs(wingSpread * 0.2), 0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Volumetric 3D Vinyl Bee Body
      const bg = ctx.createRadialGradient(-br * 0.25, -br * 0.35, 1, 0, 0, br * 1.25);
      bg.addColorStop(0, '#fef08a');
      bg.addColorStop(0.45, '#ffbe0b');
      bg.addColorStop(1, '#d97706');

      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, br * 1.25, br, 0, 0, TAU);
      ctx.fill();

      // Clipped soft vinyl stripes
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, br * 1.25, br, 0, 0, TAU);
      ctx.clip();
      ctx.fillStyle = '#1e1b4b';
      [-3.5, 0, 3.5].forEach((sx) => {
        ctx.fillRect(sx - 1.1, -br, 2.2, br * 2);
      });
      ctx.restore();

      // Top glossy sheen on bee body
      ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
      ctx.beginPath();
      ctx.ellipse(-br * 0.15, -br * 0.42, br * 0.55, br * 0.2, -0.1, 0, TAU);
      ctx.fill();

      // Crisp tinted outer rim
      ctx.strokeStyle = beeRim;
      ctx.lineWidth = beeLw;
      ctx.beginPath();
      ctx.ellipse(0, 0, br * 1.25, br, 0, 0, TAU);
      ctx.stroke();

      // Sleek Stinger at tail
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(-br * 1.22, -2);
      ctx.lineTo(-br * 1.22 - 4.5, 0);
      ctx.lineTo(-br * 1.22, 2);
      ctx.closePath();
      ctx.fill();

      // Expressive Toy Eye at front
      drawToyEyes(ctx, br * 0.64, -2.2, Math.max(2.0, br * 0.26), {
        spacing: 0,
        style: this.state === 'won' ? 'dizzy' : 'angry',
        lookX: 0.35,
      });

      ctx.restore();
    }
  }

  renderHUD(ctx, W) {
    // 1. Level Header Bevel Pill (comfortably below Reel header bar)
    ctx.save();
    drawToyPill(ctx, 18, 92, 180, 32, '#1e293b', {
      rimColor: '#334155',
      lineWidth: 1.8,
      gloss: true,
    });

    ctx.fillStyle = '#ffffff';
    ctx.font = "700 12px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LVL ${this.levelIdx + 1}: ${this.curLevel.name}`, 30, 108);

    // 2. Ink Gauge / Tube
    const inkX = 224;
    const inkY = 98;
    const inkW = 145;
    const inkH = 20;
    const inkFraction = Math.max(0, 1 - this.inkUsed / this.maxInk);

    drawToyPill(ctx, inkX, inkY, inkW, inkH, '#e2e8f0', {
      rimColor: '#334155',
      lineWidth: 2,
      gloss: false,
    });

    // Ink Liquid Fill
    if (inkFraction > 0) {
      const fillW = Math.max(8, (inkW - 4) * inkFraction);
      drawToyPill(ctx, inkX + 2, inkY + 2, fillW, inkH - 4, '#4361ee', {
        rimColor: toyRim('#4361ee', 0.48),
        lineWidth: 0.9,
        gloss: true,
      });
    }

    // 3 Stars Threshold Indicators
    const s1X = inkX + inkW * 0.3;
    const s2X = inkX + inkW * 0.6;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 2;
    [s1X, s2X].forEach((sx) => {
      ctx.beginPath();
      ctx.moveTo(sx, inkY + 2);
      ctx.lineTo(sx, inkY + inkH - 2);
      ctx.stroke();
    });

    // Star icons above ink bar
    const stars = inkFraction > 0.6 ? 3 : inkFraction > 0.3 ? 2 : 1;
    ctx.font = "700 13px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const starActive = i < stars;
      ctx.fillStyle = starActive ? '#ffd166' : 'rgba(15, 23, 42, 0.22)';
      ctx.fillText('⭐', inkX + 25 + i * 46, inkY - 7);
    }

    // Pencil Icon next to ink
    ctx.font = "700 14px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText('✏️', inkX - 4, inkY + 11);

    // 3. Tactile 3D Reset Button (↺)
    const btn = this.resetBtn;
    ctx.save();
    ctx.translate(btn.x, btn.y);
    drawToyShadow(ctx, 1, 4, btn.r * 0.95, btn.r * 0.85, 0.18);
    if (btn.pressed) ctx.scale(0.92, 0.92);

    drawToySphere(ctx, 0, 0, btn.r, '#f8fafc', {
      rimColor: '#334155',
      lineWidth: 2,
      shine: 0.65,
    });

    ctx.fillStyle = '#0f172a';
    ctx.font = "700 20px 'Fredoka', 'Outfit', sans-serif";
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
      drawToyShadow(ctx, 1, 5, 28 * pulse, 24 * pulse, 0.18);
      ctx.scale(pulse, pulse);

      drawToySphere(ctx, 0, 0, 28, '#ffffff', {
        rimColor: '#cbd5e1',
        lineWidth: 2,
        shine: 0.55,
      });

      // Soft warning track ring
      ctx.strokeStyle = 'rgba(239, 35, 60, 0.24)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, TAU);
      ctx.stroke();

      // Circular Ring Progress
      const prog = timerSec / this.totalDefendTime;
      ctx.strokeStyle = timerSec <= 2 ? '#ef233c' : '#4361ee';
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + TAU * prog, false);
      ctx.stroke();

      // Time Text (Seconds remaining)
      ctx.fillStyle = '#0f172a';
      ctx.font = "700 18px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.ceil(timerSec)}s`, 0, 1);

      ctx.restore();
    }

    // 5. Drawing Tutorial Prompt Pill
    if (this.state === 'drawing' && this.points.length === 0) {
      const bob = Math.sin(this.stateTimer * 4) * 4;
      const py = 144 + bob;
      drawToyBevelRect(ctx, W / 2 - 138, py, 276, 30, 15, '#1e293b', {
        depth: 2.5,
        rimColor: '#38bdf8',
        lineWidth: 2,
        gloss: true,
      });
      ctx.fillStyle = '#ffffff';
      ctx.font = "700 13px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DRAW TO SHIELD THE BEAN! ✏️', W / 2, py + 15);
    }

    ctx.restore();
  }
}
