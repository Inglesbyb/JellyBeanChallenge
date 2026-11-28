import Matter from 'matter-js';
import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import {
  STYLE_TOKENS,
  preloadWeeblAtlas,
  drawSprite,
  drawSunburst,
  drawComicPanel,
  drawComicStarburst,
  drawWeeblEyeCluster,
  drawHeroCharacter,
} from './weeblAtlas.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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
    parScore60s: 4800,
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
    preloadWeeblAtlas();
    this.score = score;
    this.levelIdx = (saved && Number.isFinite(saved.levelIdx)) ? Math.max(0, saved.levelIdx) : 0;
    this.totalStars = (saved && Number.isFinite(saved.totalStars)) ? Math.max(0, saved.totalStars) : 0;

    // Reset button bounds cleanly below Reel SAFE_TOP header (`Y >= 130`)
    this.resetBtn = { x: 410, y: 144, r: 19, pressed: false };

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
          this.sounds.scribble();
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
                this.sounds.scribble();
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

    // 1. Sunlit Weebl HD Park Diorama Background
    this.renderWeeblParkBackground(ctx, W, H);

    // 2. Hazards (Lava / Spikes)
    this.renderHazards(ctx);

    // 3. Static Platforms & Pegs
    this.renderPlatforms(ctx);

    // 4. Rotators & Boulders
    this.renderObstacles(ctx);

    // 5. Drawn Ink Line (Under construction OR dynamic rigid body)
    this.renderDrawnLine(ctx);

    // 6. The Pristine HD 3D Crowned Green Hero Bean
    this.renderBean(ctx);

    // 7. Tree-Branch Beehives
    this.renderHives(ctx);

    // 8. Swarming #000-Inked Bees
    this.renderBees(ctx);

    // 9. Particles and FX
    this.fx.render(ctx);

    // 10. Comic HUD (Safely below Reel SAFE_TOP)
    this.renderHUD(ctx, W, H);

    ctx.restore();
  }

  renderWeeblParkBackground(ctx, W, H) {
    const t = this.stateTimer || 0;

    // 1. Crisp Weebl Cartoon Blue-Sky -> Horizon Glow
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, STYLE_TOKENS.skyTop);
    sky.addColorStop(0.32, STYLE_TOKENS.skyMid);
    sky.addColorStop(0.68, STYLE_TOKENS.skyLow);
    sky.addColorStop(1, STYLE_TOKENS.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // 2. Gentle Weebl Sunburst Glow in mid-sky (high readability behind ink shields)
    drawSunburst(ctx, W * 0.5, H * 0.58, 460, t * 0.08, 18, 0.16, false);

    // 3. Slowly drifting #000-outlined Fluffy Clouds
    const c1X = ((t * 9 + 45) % (W + 160)) - 80;
    const c2X = ((t * 6 + 260) % (W + 180)) - 90;
    drawSprite(ctx, 'cloud_1', c1X, 178, 92, 54, {
      fallback: (cctx) => {
        cctx.fillStyle = '#ffffff';
        cctx.strokeStyle = STYLE_TOKENS.ink;
        cctx.lineWidth = 2.4;
        cctx.beginPath();
        cctx.arc(-14, 4, 14, 0, TAU);
        cctx.arc(6, -2, 18, 0, TAU);
        cctx.arc(24, 6, 12, 0, TAU);
        cctx.fill();
        cctx.stroke();
      },
    });
    drawSprite(ctx, 'cloud_2', c2X, 232, 78, 45, { fallback: () => {} });

    // 4. Soft Hazy Distant Park Horizon Hills + Toy City Landmarks on outer horizons
    ctx.save();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.24)';
    ctx.beginPath();
    ctx.moveTo(0, 560);
    ctx.quadraticCurveTo(95, 504, 195, 540);
    ctx.quadraticCurveTo(295, 496, 370, 534);
    ctx.quadraticCurveTo(420, 514, W, 542);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.88;
    drawSprite(ctx, 'city_palm_house', 52, 566, 76, 80, { fallback: () => {} });
    drawSprite(ctx, 'city_donut_shop', 398, 574, 70, 76, { fallback: () => {} });
    ctx.restore();

    // 5. Rolling #000-Inked Emerald Meadow Hills
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#16a34a';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-10, 592);
    ctx.quadraticCurveTo(115, 544, 240, 586);
    ctx.quadraticCurveTo(360, 622, W + 10, 576);
    ctx.lineTo(W + 10, H);
    ctx.lineTo(-10, H);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = STYLE_TOKENS.grassTop;
    ctx.beginPath();
    ctx.moveTo(-10, 626);
    ctx.quadraticCurveTo(135, 596, 285, 628);
    ctx.quadraticCurveTo(385, 646, W + 10, 616);
    ctx.lineTo(W + 10, H);
    ctx.lineTo(-10, H);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rich deep emerald turf shading below ground platforms for grounded bottom HUD contrast
    const meadowGrad = ctx.createLinearGradient(0, 668, 0, H);
    meadowGrad.addColorStop(0, '#16a34a');
    meadowGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = meadowGrad;
    ctx.fillRect(0, 668, W, H - 668);

    // Subtle sunlit grass blades across foreground meadow
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    for (let gx = 28; gx < W; gx += 76) {
      ctx.beginPath();
      ctx.moveTo(gx, 722);
      ctx.lineTo(gx - 4, 712);
      ctx.moveTo(gx + 3, 722);
      ctx.lineTo(gx + 6, 713);
      ctx.stroke();
    }

    // Charming white #000-inked park fence rails along lower meadow
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.0;
    ctx.fillRect(0, 618, W, 5);
    ctx.strokeRect(-2, 618, W + 4, 5);
    for (let px = 14; px < W; px += 34) {
      ctx.beginPath();
      ctx.roundRect(px, 608, 8, 28, 3);
      ctx.fill();
      ctx.stroke();
    }

    // 6. Side Oak Foliage Shoulders cleanly below the top HUD band
    ctx.fillStyle = '#15803d';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.6;
    for (const canopy of [
      [-14, 186, 26],
      [-4, 212, 20],
      [W + 14, 186, 26],
      [W + 4, 212, 20],
    ]) {
      ctx.beginPath();
      ctx.arc(canopy[0], canopy[1], canopy[2], 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#4ade80';
    ctx.lineWidth = 2.0;
    for (const leaf of [
      [2, 178, 12],
      [W - 2, 178, 12],
    ]) {
      ctx.beginPath();
      ctx.arc(leaf[0], leaf[1], leaf[2], 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }

  renderHazards(ctx) {
    const t = this.stateTimer;
    for (const h of this.hazards) {
      if (h.type === 'lava') {
        const left = h.x - h.w / 2;
        const top = h.y - h.h / 2;

        // #000-Inked Lava Gorge Pit
        const lg = ctx.createLinearGradient(0, top, 0, h.y + h.h / 2);
        lg.addColorStop(0, '#f97316');
        lg.addColorStop(0.45, '#ea580c');
        lg.addColorStop(1, '#991b1b');
        ctx.fillStyle = lg;
        ctx.fillRect(left, top, h.w, h.h);

        // Inked bright molten top wave crest
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(left, top);
        for (let x = left; x <= h.x + h.w / 2; x += 15) {
          ctx.lineTo(x, top + Math.sin(x * 0.05 + t * 4) * 4.2);
        }
        ctx.lineTo(h.x + h.w / 2, top + 12);
        ctx.lineTo(left, top + 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Rising #000-inked lava bubbles
        ctx.fillStyle = '#fde047';
        ctx.lineWidth = 2.0;
        for (let i = 0; i < 4; i++) {
          const bx = left + 35 + ((i * 90 + t * 40) % h.w);
          const by = top + 8 - ((t * 25 + i * 15) % 32);
          ctx.beginPath();
          ctx.arc(bx, by, 3.6 + (i % 3), 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      } else if (h.type === 'spikes') {
        const spikeW = 16;
        const count = Math.floor(h.w / spikeW);
        const startX = h.x - h.w / 2;
        const topY = h.y - h.h / 2;
        const botY = h.y + h.h / 2;

        // Heavy #000-inked steel base bar
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.roundRect(startX, botY - 12, h.w, 12, 4);
        ctx.fill();
        ctx.stroke();

        ctx.lineJoin = 'round';
        for (let i = 0; i < count; i++) {
          const sx = startX + i * spikeW;
          const midX = sx + spikeW / 2;
          const baseCol = i % 2 === 0 ? '#ef4444' : '#f8fafc';
          const shadeCol = i % 2 === 0 ? '#b91c1c' : '#cbd5e1';

          ctx.fillStyle = baseCol;
          ctx.beginPath();
          ctx.moveTo(sx, botY - 8);
          ctx.lineTo(midX, topY + 4);
          ctx.lineTo(midX, botY - 8);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = shadeCol;
          ctx.beginPath();
          ctx.moveTo(midX, botY - 8);
          ctx.lineTo(midX, topY + 4);
          ctx.lineTo(sx + spikeW, botY - 8);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = STYLE_TOKENS.ink;
          ctx.lineWidth = 2.2;
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

      // Grounding comic offset drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.roundRect(-hw + 3, -hh + 5, p.w, p.h, 9);
      ctx.fill();

      // Solid earth slab + #000 ink contour
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, p.w, p.h, 9);
      ctx.fill();

      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-hw, -hh, p.w, Math.min(26, p.h * 0.6));

      // Vibrant 2-tone Weebl grass overhang cap
      const grassH = Math.min(18, Math.max(11, p.h * 0.42));
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(-hw, -hh, p.w, grassH);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-hw, -hh, p.w, grassH * 0.65);
      ctx.fillStyle = '#86efac';
      ctx.fillRect(-hw + 6, -hh + 2, Math.max(4, p.w - 12), 3);

      // Inked scalloped turf divider
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-hw, -hh + grassH);
      for (let x = -hw; x <= hw; x += 14) {
        ctx.quadraticCurveTo(x + 7, -hh + grassH + 5, Math.min(hw, x + 14), -hh + grassH);
      }
      ctx.stroke();
      ctx.restore();

      // Re-stroke bold outer comic contour
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, p.w, p.h, 9);
      ctx.stroke();

      ctx.restore();
    }

    // #000-Inked Anchor Pegs
    for (const peg of this.pegs) {
      ctx.save();
      ctx.translate(peg.x, peg.y);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.arc(2, 4, peg.r, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, peg.r, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, 0, peg.r * 0.48, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
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
    for (const rot of this.rotators) {
      ctx.save();
      ctx.translate(rot.x, rot.y);
      ctx.rotate(rot.currentAngle);

      const hw = rot.w / 2;
      const hh = rot.h / 2;

      ctx.fillStyle = '#f97316';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, rot.w, rot.h, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(-hw + 6, -hh + 2.5, Math.max(4, rot.w - 12), 3);

      ctx.fillStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    for (const b of this.boulders) {
      const pos = b.body.position;
      const angle = b.body.angle;
      const baseCol = b.color || '#ef4444';

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.beginPath();
      ctx.arc(2, 4, b.r, 0, TAU);
      ctx.fill();

      ctx.rotate(angle);
      ctx.fillStyle = baseCol;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-b.r * 0.34, -b.r * 0.34, b.r * 0.24, b.r * 0.14, -0.5, 0, TAU);
      ctx.fill();

      ctx.restore();
    }
  }

  renderDrawnLine(ctx) {
    if (this.state === 'drawing' && this.points.length > 0) {
      this.drawStrokePath(ctx, this.points);
      return;
    }
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

    // 0. Crisp comic offset shadow
    tracePath(3.5);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.lineWidth = 17;
    ctx.stroke();

    // 1. Solid #000000 comic outer ink contour
    tracePath(0);
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 16.5;
    ctx.stroke();

    // 2. Deep cobalt cel under-band
    tracePath(0.6);
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 11.2;
    ctx.stroke();

    // 3. Bright electric cyan-blue core
    tracePath(-0.4);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8.4;
    ctx.stroke();

    // 4. Crisp upper #ffffff highlight ribbon
    tracePath(-2.2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    ctx.restore();
  }

  renderBean(ctx) {
    const b = this.beanState;
    const isStung = this.state === 'stung';
    const isWon = this.state === 'won';
    const isDefending = this.state === 'defending';
    const isSketching = this.state === 'drawing' && this.points.length > 0;

    // Grounding comic shadow cleanly beneath Bean feet
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 22, 20, 6, 0, 0, TAU);
    ctx.fill();

    // Find closest bee threat or active target for live eye-tracking & reaction intensity
    let nearestBeeDist = Infinity;
    let lookTargetX = this.hives?.[0]?.x ?? b.x;
    for (const bee of this.bees || []) {
      const bp = bee.body.position;
      const d = Math.hypot(bp.x - b.x, bp.y - b.y);
      if (d < nearestBeeDist) {
        nearestBeeDist = d;
        lookTargetX = bp.x;
      }
    }
    if (isSketching) {
      lookTargetX = this.points[this.points.length - 1].x;
    }
    const lookDir = clamp((lookTargetX - b.x) / 90, -0.85, 0.85);

    ctx.save();
    ctx.translate(b.x, b.y + 22);
    ctx.rotate(b.angle);

    if (isWon) {
      drawComicStarburst(ctx, 0, -24, 38, 17, 10, '#fef08a', STYLE_TOKENS.ink, this.stateTimer * 5, 2.2);
    }

    const scale = isStung ? 1.0 + Math.min(0.32, (b.stungAnim || 0) * 0.4) : 1.0;
    const heroState =
      isStung ? 'hurt'
      : isWon ? 'cheer'
      : isDefending ? (nearestBeeDist < 135 ? 'wobble' : 'balance')
      : 'stand_alert';
    const heroExpr =
      isStung ? 'dizzy'
      : isWon ? 'happy'
      : isDefending && nearestBeeDist < 135 ? 'panic'
      : isSketching ? 'happy'
      : 'focus';

    drawHeroCharacter(ctx, 0, 0, 50, {
      view: 'front',
      state: heroState,
      expr: heroExpr,
      t: this.stateTimer * (isDefending && nearestBeeDist < 135 ? 6 : 4),
      lookX: lookDir,
      lean: clamp(lookDir * 0.16, -0.2, 0.2),
      squashX: scale,
      squashY: scale,
    });

    // #000-Inked Anxious Sweat Drops during swarm siege
    if (isDefending && !isStung && !isWon) {
      const dropY = -38 + Math.sin(this.stateTimer * 9) * 3.5;
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(20, dropY, 4.2, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Comical #000-Inked Stung Welts, Bandage & Tears
    if (isStung) {
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.0;
      for (const [wx, wy, wr] of [[-15, -40, 6], [17, -26, 6.5]]) {
        ctx.beginPath();
        ctx.arc(wx, wy, wr, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(0, -24);
      ctx.rotate(0.2);
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-10, -4, 20, 8, 2.5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const tearT = this.stateTimer * 12;
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.4;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(dir * (18 + (tearT % 10)), -28 + (tearT % 14), 3.2, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  renderHives(ctx) {
    for (const h of this.hives) {
      ctx.save();
      const shakeX = (Math.random() - 0.5) * 8 * h.shake;
      const shakeY = (Math.random() - 0.5) * 6 * h.shake;
      ctx.translate(h.x + shakeX, h.y + shakeY);

      // Sturdy #000-Inked Arching Oak Branch from park side (keeps top HUD 100% clear)
      const fromRight = h.x >= this.W * 0.5;
      const edgeRelX = fromRight ? this.W - h.x + 16 : -h.x - 16;
      const anchorRelY = Math.min(-34, 174 - h.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 10.5;
      ctx.beginPath();
      ctx.moveTo(edgeRelX, anchorRelY);
      ctx.quadraticCurveTo(edgeRelX * 0.36, anchorRelY - 12, 0, -34);
      ctx.lineTo(0, -24);
      ctx.stroke();

      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 5.4;
      ctx.stroke();

      // Green #000-inked leaves along branch + hive crown
      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      for (const [lx, ly, ang] of [
        [-10, -34, -0.45],
        [11, -34, 0.45],
        [edgeRelX * 0.38, anchorRelY - 8, fromRight ? -0.3 : 0.3],
      ]) {
        ctx.beginPath();
        ctx.ellipse(lx, ly, 9.5, 4.8, ang, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      // #000-Inked Golden Cel Honey Skep Coils
      const layers = [
        { y: -22, rx: 14, ry: 7 },
        { y: -12, rx: 24, ry: 9 },
        { y: 0, rx: 28, ry: 11 },
        { y: 12, rx: 24, ry: 9 },
        { y: 22, rx: 16, ry: 7 },
      ];

      for (const lyr of layers) {
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(0, lyr.y, lyr.rx, lyr.ry, 0, 0, TAU);
        ctx.fill();

        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#d97706';
        ctx.fillRect(-lyr.rx, lyr.y + 1, lyr.rx * 2, lyr.ry);
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        ctx.ellipse(-lyr.rx * 0.35, lyr.y - lyr.ry * 0.32, lyr.rx * 0.32, lyr.ry * 0.24, -0.15, 0, TAU);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(0, lyr.y, lyr.rx, lyr.ry, 0, 0, TAU);
        ctx.stroke();
      }

      // Hive Entrance Doorway
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 8, 9, 0, Math.PI, false);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Golden #000-inked Honey Droplet
      const dripY = 17 + Math.sin(this.stateTimer * 3 + h.x) * 4;
      ctx.fillStyle = '#facc15';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, dripY, 4.0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      if (h.isQueen) {
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.2;
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

      const br = bee.isQueen ? 11.5 : 8.8;
      const wingSpread = Math.sin(bee.wingPhase) * 10;

      // #000-Inked Translucent Cartoon Wings
      ctx.fillStyle = 'rgba(224, 242, 254, 0.88)';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(-2, -7 - wingSpread * 0.3, 7, 4 + Math.abs(wingSpread * 0.2), -0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(-2, 7 + wingSpread * 0.3, 7, 4 + Math.abs(wingSpread * 0.2), 0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // #000-Inked Striped Bumblebee Body
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(0, 0, br * 1.25, br, 0, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, br * 1.25, br, 0, 0, TAU);
      ctx.clip();
      ctx.fillStyle = '#0f172a';
      [-3.8, 0, 3.8].forEach((sx) => ctx.fillRect(sx - 1.2, -br, 2.4, br * 2));
      ctx.restore();

      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, br * 1.25, br, 0, 0, TAU);
      ctx.stroke();

      // Tail Stinger
      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath();
      ctx.moveTo(-br * 1.22, -2.5);
      ctx.lineTo(-br * 1.22 - 5, 0);
      ctx.lineTo(-br * 1.22, 2.5);
      ctx.closePath();
      ctx.fill();

      drawWeeblEyeCluster(ctx, br * 0.64, -2.0, Math.max(2.6, br * 0.32), {
        lookX: 0.35,
        mood: this.state === 'won' ? 'dizzy' : 'angry',
        lineW: 1.8,
      });

      ctx.restore();
    }
  }

  renderHUD(ctx, W) {
    // 1. Weebl #000-Inked Level Panel safely below SAFE_TOP (`Y = 128..160`)
    ctx.save();
    drawComicPanel(ctx, 16, 128, 174, 32, 12, '#0f172a', {
      lineWidth: 2.6,
      shadowDx: 0,
      shadowDy: 3,
    });

    ctx.fillStyle = '#ffffff';
    ctx.font = "900 12px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LVL ${this.levelIdx + 1}: ${this.curLevel.name}`, 28, 144);

    // 2. #000-Inked Ink Gauge Bar + Star Thresholds
    const inkX = 224;
    const inkY = 134;
    const inkW = 148;
    const inkH = 20;
    const inkFraction = Math.max(0, 1 - this.inkUsed / this.maxInk);

    drawComicPanel(ctx, inkX, inkY, inkW, inkH, 10, '#e2e8f0', {
      lineWidth: 2.4,
      shadowDx: 0,
      shadowDy: 2.5,
    });

    if (inkFraction > 0) {
      const fillW = Math.max(10, (inkW - 6) * inkFraction);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(inkX + 3, inkY + 3, fillW, inkH - 6, 7);
      ctx.fill();
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(inkX + 6, inkY + 4.5, Math.max(2, fillW - 6), 3);
    }

    const s1X = inkX + inkW * 0.3;
    const s2X = inkX + inkW * 0.6;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.0;
    [s1X, s2X].forEach((sx) => {
      ctx.beginPath();
      ctx.moveTo(sx, inkY + 2);
      ctx.lineTo(sx, inkY + inkH - 2);
      ctx.stroke();
    });

    const stars = inkFraction > 0.6 ? 3 : inkFraction > 0.3 ? 2 : 1;
    ctx.font = "900 13px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < stars ? '#facc15' : 'rgba(15, 23, 42, 0.25)';
      ctx.fillText('★', inkX + 24 + i * 48, inkY - 8);
    }

    ctx.font = "900 14px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText('✏️', inkX - 6, inkY + 11);

    // 3. #000-Bordered Comic Reset Button (`x: 410, y: 144`)
    const btn = this.resetBtn;
    ctx.save();
    ctx.translate(btn.x, btn.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(0, 3, btn.r, 0, TAU);
    ctx.fill();
    if (btn.pressed) ctx.scale(0.92, 0.92);

    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, btn.r, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = STYLE_TOKENS.ink;
    ctx.font = "900 19px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↺', 0, 1);
    ctx.restore();

    // 4. Circular Defend Countdown Badge
    if (this.state === 'defending') {
      const timerSec = Math.max(0, this.defendTimer);
      const pulse = 1.0 + Math.max(0, (1 - (this.defendTimer % 1)) * 0.12);

      ctx.save();
      ctx.translate(W / 2, 194);
      ctx.scale(pulse, pulse);

      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.arc(0, 4, 28, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, TAU);
      ctx.stroke();

      const prog = timerSec / this.totalDefendTime;
      ctx.strokeStyle = timerSec <= 2 ? '#ef4444' : '#2563eb';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + TAU * prog, false);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = "900 17px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.ceil(timerSec)}s`, 0, 1);
      ctx.restore();
    }

    // 5. Drawing Prompt Pill (appears gently after opening Reel cue fades)
    if (this.state === 'drawing' && this.points.length === 0 && this.stateTimer > 1.8) {
      const bob = Math.sin(this.stateTimer * 4) * 3;
      const py = 172 + bob;
      drawComicPanel(ctx, W / 2 - 134, py, 268, 30, 15, '#0f172a', {
        lineWidth: 2.6,
        shadowDx: 0,
        shadowDy: 3,
      });
      ctx.fillStyle = '#fde047';
      ctx.font = "900 13px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DRAW A SHIELD ABOVE THE BEAN! ✏️', W / 2, py + 15);
    }

    ctx.restore();
  }
}
