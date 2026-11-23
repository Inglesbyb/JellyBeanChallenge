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

const L = 35;
const R = 385;
const MID = (L + R) / 2;
const FLOOR = 700;
const LINE = 228;
const SPAWN_Y = 170;
const TAU = Math.PI * 2;

export const FR = [
  { name: 'Cherry Drop',          r: 15, c: '#ff3366', topC: '#ff758f', pts: 2,   leaf: true },
  { name: 'Sour Strawberry',      r: 21, c: '#e63946', topC: '#ff70a6', pts: 4,   calyx: true },
  { name: 'Grape Gumdrop',        r: 27, c: '#7209b7', topC: '#b5179e', pts: 8,   stem: true },
  { name: 'Glazed Mandarin',      r: 34, c: '#f77f00', topC: '#fcbf49', pts: 12,  slice: true },
  { name: 'Candy Apple',          r: 42, c: '#d90429', topC: '#ef233c', pts: 18,  stick: true },
  { name: 'Sugar Pear',           r: 51, c: '#90be6d', topC: '#c7f9cc', pts: 25,  pear: true },
  { name: 'Peach Ring Gumdrop',   r: 61, c: '#f4a261', topC: '#ffddd2', pts: 34,  peach: true },
  { name: 'Golden Pineapple',     r: 72, c: '#ffd166', topC: '#ffeaa7', pts: 45,  crown: true },
  { name: 'Honey Dewdrop Melon',  r: 84, c: '#52b788', topC: '#74c69d', pts: 58,  mesh: true },
  { name: 'Watermelon Colossus',  r: 96, c: '#2d6a4f', topC: '#40916c', pts: 75,  stripes: true },
  { name: 'Superlambanana Berry', r: 108,c: '#ffd60a', topC: '#ffea00', pts: 1000,king: true },
];

const TOP = FR.length - 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const dropTier = () => {
  const r = Math.random();
  if (r < 0.04) return -1; // 4% chance for Rainbow Joker Bean!
  if (r < 0.07) return -2; // 3% chance for Pop-Rock Bomb!
  if (r < 0.42) return 0;  // Cherry Drop
  if (r < 0.72) return 1;  // Strawberry
  if (r < 0.90) return 2;  // Grape
  return 3;                // Mandarin
};

const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

export class FruitMerge extends Game {
  static meta = {
    id: 'fruit-merge',
    title: 'Jelly Suika',
    icon: '🍉',
    hint: 'DRAG to aim · RELEASE to drop · merge matching confectionery · shake to unjam!',
    baseLikes: 4120,
    isPrestige: true,
    parScore60s: 1600,
    cue: 'DROP & MERGE SWEETS!',
    prestigeCue: 'HEAVIER DROP · MORE PEGS!',
    scaling: {
      gravityY:      { base: 1.15, rate: 0.16, cap: 1.60, mode: 'up',   label: 'Drop Gravity' },
      pegCount:      { base: 0,    rate: 0.32, cap: 3,    mode: 'up',   round: true, deltaFormat: 'abs', label: 'Jar Pegs' },
      overflowGrace: { base: 3.0,  rate: 0.20, floor: 1.6, mode: 'down', label: 'Overflow Grace' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.pLevel = Math.max(1, this.prestige || 1);
    this.engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
    this.engine.gravity.y = this.diff.gravityY ?? 1.15;
    this.acc = 0;
    this.mergeQ = [];
    this.overT = 0;
    this.cool = 0.3;
    this.aimX = (L + R) / 2;
    this.fruits = [];
    this.shakerCharges = 2; // Jar Shaker tilts
    this.mergesUntilShaker = 4;
    this.comboCount = 0;
    this.comboTimer = 0;

    // Physical Glass Jar Container with rounded base corners
    const wallOpts = { isStatic: true, friction: 0.3, restitution: 0.15, label: 'wall' };
    Composite.add(this.engine.world, [
      Bodies.rectangle((L + R) / 2, FLOOR + 30, R - L + 160, 60, wallOpts),
      Bodies.rectangle(L - 25, 380, 50, 800, wallOpts),
      Bodies.rectangle(R + 25, 380, 50, 800, wallOpts),
    ]);

    // Prestige hazard: rock-candy pegs inside the jar (up to 3).
    const PEG_SLOTS = [{ x: 140, y: 560 }, { x: 280, y: 500 }, { x: 210, y: 620 }];
    this.pegs = PEG_SLOTS.slice(0, Math.min(3, this.diff.pegCount ?? 0)).map((p) => ({ ...p, r: 11 }));
    for (const p of this.pegs) {
      Composite.add(this.engine.world, Bodies.circle(p.x, p.y, p.r, { ...wallOpts, label: 'peg' }));
    }

    this.onCollide = (ev) => {
      for (const pair of ev.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;

        // Special Item 1: Pop-Rock Bomb detonates on impact!
        if (a.tier === -2 || b.tier === -2) {
          const bomb = a.tier === -2 ? a : b;
          if (!bomb.detonated) {
            bomb.detonated = true;
            this.detonateBomb(bomb.position.x, bomb.position.y);
          }
          continue;
        }

        // Special Item 2: Rainbow Joker merges with ANY regular fruit
        if ((a.tier === -1 || b.tier === -1) && !a.merging && !b.merging) {
          const target = a.tier === -1 ? b : a;
          const joker = a.tier === -1 ? a : b;
          if (target.tier !== undefined && target.tier >= 0 && target.tier < TOP) {
            a.merging = b.merging = true;
            this.mergeQ.push([target, joker, target.tier + 1]);
          }
          continue;
        }

        // Regular Suika matching pair merge
        if (
          a.tier !== undefined &&
          b.tier !== undefined &&
          a.tier >= 0 &&
          b.tier >= 0 &&
          a.tier === b.tier &&
          !a.merging &&
          !b.merging
        ) {
          a.merging = b.merging = true;
          this.mergeQ.push([a, b, a.tier + 1]);
        }
      }
    };
    Events.on(this.engine, 'collisionStart', this.onCollide);

    if (saved) {
      if (Array.isArray(saved.fruits)) {
        for (const f of saved.fruits) {
          if (Array.isArray(f) && Number.isFinite(f[0]) && Number.isFinite(f[1]) && Number.isFinite(f[2])) {
            this.addFruit(f[0], f[1], f[2], Number.isFinite(f[3]) ? f[3] : 0, -10, false);
          }
        }
      }
      this.cur = (saved.cur !== undefined && Number.isFinite(saved.cur)) ? saved.cur : dropTier();
      this.next = (saved.next !== undefined && Number.isFinite(saved.next)) ? saved.next : dropTier();
      this.shakerCharges = Number.isFinite(saved.shakerCharges) ? saved.shakerCharges : 2;
      this.grace = 1.5;
    } else {
      this.cur = dropTier();
      this.next = dropTier();
    }
  }

  destroy() {
    if (this.engine) {
      Events.off(this.engine, 'collisionStart', this.onCollide);
      Composite.clear(this.engine.world, false);
      Engine.clear(this.engine);
    }
  }

  serialize() {
    return {
      fruits: this.fruits.map((b) => [
        b.tier,
        +b.position.x.toFixed(1),
        +b.position.y.toFixed(1),
        +b.angle.toFixed(2),
      ]),
      cur: this.cur,
      next: this.next,
      shakerCharges: this.shakerCharges,
    };
  }

  restoreLabel() {
    return `${this.fruits.length} confectionery fruits`;
  }

  addFruit(tier, x, y, angle = 0, born = null, pop = true) {
    const isSpecial = tier < 0;
    const r = isSpecial ? 22 : FR[tier].r;

    const b = Bodies.circle(x, y, r, {
      restitution: 0.22,
      friction: 0.25,
      frictionStatic: 0.45,
      frictionAir: 0.006,
      density: 0.0012,
      label: 'fruit',
    });

    b.tier = tier;
    b.born = born === null ? this.time : born;
    b.pop = pop;
    b.blinkTimer = Math.random() * 3;
    Body.setAngle(b, angle);
    Composite.add(this.engine.world, b);
    this.fruits.push(b);
    return b;
  }

  removeFruit(b) {
    Composite.remove(this.engine.world, b);
    this.fruits = this.fruits.filter((x) => x !== b);
  }

  detonateBomb(bx, by) {
    // Pop-Rock Bomb explodes! Vaporizes low-tier clutter in 70px radius
    this.fx.ring(bx, by, '#ffbe0b', 220, 0.6, 6);
    this.fx.burst(bx, by, '#f72585', 30, 260, 0.7, 5, 300);
    this.fx.text(bx, by - 24, 'POP-ROCK DETONATION! 💣', '#ffe066', 22, 1.1);
    this.fx.shake(12, 0.4);
    this.sounds.hit();
    this.haptics.heavy();

    const victimCandidates = [...this.fruits];
    for (const f of victimCandidates) {
      if (f.tier >= 0 && f.tier <= 3) {
        const dx = f.position.x - bx;
        const dy = f.position.y - by;
        const dist = Math.hypot(dx, dy);
        if (dist < 75) {
          this.removeFruit(f);
          this.score += 15;
          this.fx.burst(f.position.x, f.position.y, '#ffd166', 10, 140, 0.4, 3);
        }
      }
    }
  }

  bumpJar() {
    if (this.shakerCharges <= 0) return;
    this.shakerCharges--;

    // Physical upward & jitter impulse to dislodge stuck fruits
    for (const b of this.fruits) {
      Body.setVelocity(b, {
        x: b.velocity.x + (Math.random() - 0.5) * 6,
        y: b.velocity.y - (4.5 + Math.random() * 2.5),
      });
    }

    this.fx.shake(9, 0.35);
    this.fx.ring(MID, FLOOR - 20, '#3dffa2', 260, 0.4, 4);
    this.fx.text(MID, FLOOR - 40, 'JAR BUMP! 🫨', '#3dffa2', 22, 0.9);
    this.sounds.hit();
    this.haptics.heavy();
  }

  update(dt) {
    this.cool -= dt;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Aim & Drop Controls
    const inp = this.input;
    const r = this.cur < 0 ? 22 : FR[this.cur].r;

    if (inp.down || inp.released) this.aimX = clamp(inp.x, L + r + 4, R - r - 4);
    if (inp.key('arrowleft', 'a')) this.aimX = clamp(this.aimX - 280 * dt, L + r + 4, R - r - 4);
    if (inp.key('arrowright', 'd')) this.aimX = clamp(this.aimX + 280 * dt, L + r + 4, R - r - 4);

    // Jar Shaker Hotkeys ('w', 'arrowup', or click on button)
    const keyShake = inp.key('w', 'arrowup') && !this._keyShakeHeld;
    this._keyShakeHeld = inp.key('w', 'arrowup');
    if (keyShake) this.bumpJar();

    // Drop Fruit
    const keyDrop = inp.key(' ', 'arrowdown', 's') && !this._keyHeld;
    this._keyHeld = inp.key(' ', 'arrowdown', 's');
    if ((inp.released || keyDrop) && this.cool <= 0) this.drop();

    // Physics Update
    this.acc += dt;
    let steps = 0;
    while (this.acc >= 1 / 60 && steps < 4) {
      Engine.update(this.engine, 1000 / 60);
      this.acc -= 1 / 60;
      steps++;
    }
    if (steps === 4) this.acc = 0;

    this.processMerges();

    // Overflow Detection Line
    let over = false;
    for (const b of this.fruits) {
      if (this.time - b.born < 1.3) continue;
      const frR = b.tier < 0 ? 22 : FR[b.tier].r;
      if (b.position.y - frR < LINE && Math.abs(b.velocity.y) < 1.2) {
        over = true;
        break;
      }
    }

    this.overT = over ? this.overT + dt : Math.max(0, this.overT - dt * 2);
    if (this.overT > (this.diff.overflowGrace ?? 3.0)) {
      if (this.die('Jar overflowed!')) {
        this.fx.shake(12, 0.45);
        this.sounds.hit();
      }
    }

    // Fruit eye blinks
    for (const b of this.fruits) {
      b.blinkTimer = (b.blinkTimer || 0) + dt;
    }

    this.fx.update(dt);
  }

  drop() {
    this.addFruit(this.cur, this.aimX, SPAWN_Y, 0, this.time, false);
    this.sounds.drop();
    this.haptics.light();
    this.cur = this.next;
    this.next = dropTier();
    this.cool = 0.52;
  }

  processMerges() {
    while (this.mergeQ.length) {
      const [a, b, nextTier] = this.mergeQ.pop();
      if (!this.fruits.includes(a) || !this.fruits.includes(b)) continue;

      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;
      this.removeFruit(a);
      this.removeFruit(b);

      // Recharging the Jar Shaker!
      this.mergesUntilShaker--;
      if (this.mergesUntilShaker <= 0) {
        this.shakerCharges = Math.min(3, this.shakerCharges + 1);
        this.mergesUntilShaker = 4;
      }

      // Combo Chain Scaling
      this.comboCount++;
      this.comboTimer = 1.0;
      const comboMult = Math.min(5, this.comboCount);

      // Crown the Mythical Superlambanana Berry (Tier 10)
      if (nextTier >= TOP) {
        this.score += 1000 * comboMult;
        this.fx.text(x, y - 30, `👑 SUPERLAMBANANA BERRY! +${1000 * comboMult}`, '#ffd60a', 28, 1.8);
        this.fx.burst(x, y, '#ffd60a', 50, 400, 1.2, 7, 500);
        this.fx.burst(x, y, '#f72585', 30, 320, 1.0, 5, 350);
        this.fx.ring(x, y, '#ffd60a', 280, 0.8, 8);
        this.fx.shake(14, 0.5);
        this.sounds.survive();
        this.haptics.heavy();
        // Stage complete: the King Berry has been crowned.
        this.won = true;
        this.winReason = 'Superlambanana Berry Crowned! 👑';
        continue;
      }

      // Spawn next confectionery tier
      const nb = this.addFruit(nextTier, x, y, a.angle, this.time, true);
      Body.setVelocity(nb, { x: 0, y: -1.2 });

      const fInfo = FR[nextTier];
      const pts = fInfo.pts * comboMult;
      this.score += pts;

      this.fx.burst(x, y, fInfo.c, 12 + nextTier * 2, 170 + nextTier * 18, 0.55, 3 + nextTier * 0.3, 220);
      this.fx.ring(x, y, fInfo.topC, fInfo.r * 2.4, 0.45, 4);

      if (this.comboCount > 1) {
        this.fx.text(x, y - fInfo.r - 14, `COMBO ×${this.comboCount}! +${pts}`, '#ffe066', 22, 0.9);
      } else if (nextTier >= 3) {
        this.fx.text(x, y - fInfo.r - 10, `+${pts}`, '#ffffff', 20, 0.8);
      }

      this.sounds.merge(nextTier);
      nextTier >= 5 ? this.haptics.heavy() : this.haptics.light();
    }
  }

  /* ------------------------------------------------------------ render */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const off = this.fx.offset();
    const jarMidX = (L + R) * 0.5;

    // 1. Studio Diorama Sweet Shop Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1e1136');
    bg.addColorStop(0.48, '#381856');
    bg.addColorStop(0.84, '#27123c');
    bg.addColorStop(1, '#1a0c29');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Warm studio radial spotlight behind the glass jar
    const spot = ctx.createRadialGradient(jarMidX, 420, 30, jarMidX, 420, 290);
    spot.addColorStop(0, 'rgba(255, 182, 224, 0.22)');
    spot.addColorStop(0.55, 'rgba(168, 85, 247, 0.10)');
    spot.addColorStop(1, 'rgba(30, 17, 54, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);

    // Subtle floating confectionery bokeh sparkles
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const bx = ((i * 73 + 29) % (W - 20)) + 10;
      const by = ((i * 119 + Math.sin(this.time * 0.9 + i) * 14) % (FLOOR - 40)) + 20;
      const br = 2 + (i % 3) * 1.4;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 214, 165, 0.14)' : 'rgba(255, 173, 218, 0.14)';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Sweet shop countertop surface under the jar
    const shelfGrad = ctx.createLinearGradient(0, FLOOR + 6, 0, H);
    shelfGrad.addColorStop(0, '#5c2b46');
    shelfGrad.addColorStop(0.25, '#3b1830');
    shelfGrad.addColorStop(1, '#1e0b1b');
    ctx.fillStyle = shelfGrad;
    ctx.fillRect(0, FLOOR + 6, W, H - (FLOOR + 6));
    ctx.fillStyle = 'rgba(255, 220, 240, 0.16)';
    ctx.fillRect(0, FLOOR + 6, W, 2.5);

    ctx.save();
    ctx.translate(off.x, off.y);

    // 2. The 3D Acrylic & Brass Sweet Jar
    this.renderGlassJar(ctx, W);

    // 3. Danger Overflow Line
    const danger = this.overT > 0;
    ctx.save();
    ctx.strokeStyle = danger
      ? `rgba(255, 77, 136, ${0.72 + Math.sin(this.time * 16) * 0.28})`
      : 'rgba(255, 255, 255, 0.34)';
    ctx.lineWidth = danger ? 3.5 : 2;
    ctx.lineCap = 'round';
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(L + 4, LINE);
    ctx.lineTo(R - 4, LINE);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (danger) {
      const warnW = 198;
      const warnH = 26;
      const warnX = jarMidX - warnW / 2;
      const warnY = LINE - 32;
      drawToyPill(ctx, warnX, warnY, warnW, warnH, '#f43f5e', {
        rimColor: toyRim('#f43f5e', 0.6),
        lineWidth: 1.6,
      });
      ctx.save();
      ctx.font = "700 13px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      const msg = `OVERFLOW IN ${Math.max(0, 3 - this.overT).toFixed(1)}s!`;
      ctx.strokeText(msg, jarMidX, warnY + warnH * 0.52);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(msg, jarMidX, warnY + warnH * 0.52);
      ctx.restore();
    }

    // 4. Mascot Bean holding incoming fruit
    if (!this.dead) {
      const ready = this.cool <= 0;
      const isSpecial = this.cur < 0;
      const fR = isSpecial ? 22 : FR[this.cur].r;

      // Dashed Aim Guide Line & ground landing bead
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(this.aimX, SPAWN_Y + fR);
      ctx.lineTo(this.aimX, FLOOR);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(this.aimX, FLOOR - 2, 6, 2.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Captain Bean holding the fruit
      const beanY = SPAWN_Y - fR - 26;
      const beanSquash = ready ? 1 + Math.sin(this.time * 6) * 0.06 : 0.88;

      drawBean(ctx, this.aimX, beanY, 26, {
        color: '#ff70a6',
        bellyColor: '#ff9770',
        holding: true,
        squash: beanSquash,
        eyes: danger ? 'squish' : ready ? 'happy' : 'blink',
        hat: this.fruits.length >= 8 ? 'crown' : null,
      });

      // Drawn held fruit
      this.drawVectorFruit(ctx, this.aimX, SPAWN_Y, this.cur, 0, ready ? 1 : 0.72, false);
    } else {
      drawBean(ctx, this.aimX, SPAWN_Y, 28, {
        color: '#ff70a6',
        dead: true,
        squash: 0.7,
      });
    }

    // 5. Render Rock-Candy Pegs & All Confectionery Fruits in the Jar
    for (const pg of this.pegs || []) {
      drawToyShadow(ctx, pg.x, pg.y + pg.r * 0.45, pg.r * 0.9, pg.r * 0.38, 0.24);
      drawToySphere(ctx, pg.x, pg.y, pg.r, '#f72585', {
        rimColor: toyRim('#f72585', 0.56),
        lineWidth: toyLineW(pg.r * 2, 0.048, 0.9, 1.8),
        shine: 0.8,
      });
    }

    for (const b of this.fruits) {
      let s = 1;
      if (b.pop) {
        const t = clamp((this.time - b.born) / 0.25, 0, 1);
        s = 0.55 + 0.45 * easeOutBack(t);
      }

      // Check if fruit is under heavy squish pressure near the bottom
      const isSquished = b.position.y > 540 && Math.abs(b.velocity.y) < 0.6;
      this.drawVectorFruit(ctx, b.position.x, b.position.y, b.tier, b.angle, s, isSquished, b.blinkTimer);
    }

    this.fx.render(ctx, 1);
    ctx.restore();

    // 6. Next Fruit Preview Bubble
    this.renderNextBubble(ctx);

    // 7. Jar Shaker BUMP HUD Button
    this.renderShakerHUD(ctx, W, H);
  }

  /* ------------------------------------------------------------ 3D Toy Acrylic Sweet Jar */
  renderGlassJar(ctx, W) {
    const jarX = L - 4;
    const jarY = 150;
    const jarW = R - L + 8;
    const jarH = FLOOR - 150 + 6;
    const midX = (L + R) * 0.5;

    // Grounding shadow under jar base
    drawToyShadow(ctx, midX, FLOOR + 12, jarW * 0.54, 11, 0.34);

    // Wooden-gold diorama base coaster beneath the jar
    drawToyBevelRect(ctx, L - 14, FLOOR + 2, (R - L) + 28, 15, 7, '#d97706', {
      depth: 4,
      rimColor: toyRim('#d97706', 0.58),
      lineWidth: 1.6,
    });

    // Translucent frosted interior gradient
    const glassBg = ctx.createLinearGradient(jarX, jarY, jarX + jarW, jarY + jarH);
    glassBg.addColorStop(0, 'rgba(255, 255, 255, 0.11)');
    glassBg.addColorStop(0.5, 'rgba(224, 242, 254, 0.05)');
    glassBg.addColorStop(1, 'rgba(251, 207, 232, 0.10)');
    ctx.fillStyle = glassBg;
    traceRoundRect(ctx, jarX, jarY, jarW, jarH, 22);
    ctx.fill();

    // Left & right vertical glass specular studio highlights
    ctx.save();
    const leftHighlight = ctx.createLinearGradient(jarX + 6, 0, jarX + 26, 0);
    leftHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
    leftHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = leftHighlight;
    traceRoundRect(ctx, jarX + 6, jarY + 12, 20, jarH - 28, 10);
    ctx.fill();

    const rightHighlight = ctx.createLinearGradient(jarX + jarW - 22, 0, jarX + jarW - 6, 0);
    rightHighlight.addColorStop(0, 'rgba(255, 255, 255, 0)');
    rightHighlight.addColorStop(1, 'rgba(255, 255, 255, 0.18)');
    ctx.fillStyle = rightHighlight;
    traceRoundRect(ctx, jarX + jarW - 22, jarY + 12, 16, jarH - 28, 8);
    ctx.fill();
    ctx.restore();

    // Outer soft rim & bright glass wall stroke
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 224, 245, 0.42)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(L - 4, 150);
    ctx.lineTo(L - 4, FLOOR - 16);
    ctx.quadraticCurveTo(L - 4, FLOOR + 4, L + 16, FLOOR + 4);
    ctx.lineTo(R - 16, FLOOR + 4);
    ctx.quadraticCurveTo(R + 4, FLOOR + 4, R + 4, FLOOR - 16);
    ctx.lineTo(R + 4, 150);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.restore();

    // 3D Rounded Brass Jar Mouth Rim Caps
    drawToyBevelRect(ctx, L - 11, 145, 14, 11, 5, '#ffd166', {
      depth: 2,
      rimColor: toyRim('#d97706', 0.56),
      lineWidth: 1.4,
    });
    drawToyBevelRect(ctx, R - 3, 145, 14, 11, 5, '#ffd166', {
      depth: 2,
      rimColor: toyRim('#d97706', 0.56),
      lineWidth: 1.4,
    });
  }

  /* ------------------------------------------------------------ 3D Vinyl Toy Confectionery Fruits */
  drawVectorFruit(ctx, x, y, tier, angle, s = 1, isSquished = false, blinkTime = 0) {
    ctx.save();
    ctx.translate(x, y);

    // Special Item: Rainbow Swirl Joker Bean
    if (tier === -1) {
      const r = 22 * s;
      const lw = toyLineW(r * 2, 0.044, 0.9, 2.0);
      ctx.save();
      ctx.rotate(this.time * 3);
      const swirlColors = ['#ff3366', '#ffd166', '#3dffa2', '#38bdf8', '#a855f7'];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = swirlColors[i];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, (i / 5) * TAU, ((i + 1) / 5) * TAU);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Volumetric 3D studio shading overlay on pinwheel sphere
      const sg = ctx.createRadialGradient(-r * 0.34, -r * 0.34, r * 0.08, 0, 0, r);
      sg.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      sg.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      sg.addColorStop(1, 'rgba(15, 23, 42, 0.32)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = toyRim('#a855f7', 0.58);
      ctx.lineWidth = lw;
      ctx.stroke();

      // Glossy upper-left specular highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.32, -r * 0.35, r * 0.28, r * 0.14, -0.55, 0, TAU);
      ctx.fill();

      drawToySphere(ctx, 0, 0, Math.max(4, r * 0.3), '#ffd166', {
        rimColor: toyRim('#d97706', 0.5),
        lineWidth: toyLineW(r, 0.04, 0.7, 1.4),
      });
      ctx.restore();
      return;
    }

    // Special Item: Pop-Rock Bomb (3D Vinyl Toy Bomb)
    if (tier === -2) {
      const r = 22 * s;
      const lw = toyLineW(r * 2, 0.044, 0.9, 2.0);
      drawToySphere(ctx, 0, 0, r, '#334155', {
        rimColor: '#0f172a',
        lineWidth: lw,
        shine: 0.72,
      });

      // Cute fuse cap & spark
      drawToyBevelRect(ctx, r * 0.25, -r * 1.05, r * 0.44, r * 0.28, 3, '#ffd166', {
        depth: 1.5,
        rimColor: toyRim('#d97706', 0.55),
        lineWidth: 1.1,
      });
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = Math.max(2, r * 0.1);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(r * 0.48, -r * 1.02);
      ctx.quadraticCurveTo(r * 0.72, -r * 1.32, r * 0.9, -r * 1.15);
      ctx.stroke();

      const sparkR = 3.6 + Math.sin(this.time * 20) * 1.6;
      drawToySphere(ctx, r * 0.9, -r * 1.15, sparkR, '#fde047', {
        rimColor: '#f97316',
        lineWidth: 1,
        shine: 0.9,
      });

      // Expressive mischievous eyes
      drawToyEyes(ctx, 0, r * 0.05, Math.max(2, r * 0.16), {
        spacing: r * 0.62,
        style: 'angry',
        lookX: 0.15,
        ink: '#0f172a',
      });
      ctx.restore();
      return;
    }

    const f = FR[tier];
    const r = f.r * s;
    const rim = toyRim(f.c, 0.56);
    const lw = toyLineW(r * 2, 0.04, 0.9, 2.2);

    // 1. Volumetric 3D Confectionery Body Gradient
    const bg = ctx.createRadialGradient(-r * 0.34, -r * 0.34, r * 0.08, 0, 0, r);
    bg.addColorStop(0, shadeColor(f.topC, 0.56));
    bg.addColorStop(0.28, f.topC);
    bg.addColorStop(0.78, f.c);
    bg.addColorStop(1, shadeColor(f.c, -0.3));

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    // Warm lower bounce sheen
    if (r >= 10) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.ellipse(r * 0.06, r * 0.62, r * 0.45, r * 0.14, 0, 0, TAU);
      ctx.fill();
    }

    // 2. Fruit-Specific Confectionery Features (rotated with body angle)
    ctx.save();
    ctx.rotate(angle);

    if (f.stripes) {
      // Watermelon wavy dark green stripes clipped cleanly inside sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r - lw * 0.4, 0, TAU);
      ctx.clip();
      ctx.strokeStyle = '#1b4332';
      ctx.lineWidth = Math.max(3.5, r * 0.11);
      ctx.lineCap = 'round';
      for (let a = -0.7; a <= 0.7; a += 0.45) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.86, a - 0.25, a + 0.25);
        ctx.stroke();
      }
      ctx.restore();
    } else if (f.mesh) {
      // Honeydew subtle candy glaze lattice
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r - lw * 0.4, 0, TAU);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = Math.max(1.5, r * 0.03);
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.arc(k * r * 0.38, 0, r * 0.9, -1.1, 1.1);
        ctx.stroke();
      }
      ctx.restore();
    } else if (f.slice) {
      // Glazed Mandarin soft segment gleam
      ctx.strokeStyle = 'rgba(255, 247, 237, 0.35)';
      ctx.lineWidth = Math.max(1.4, r * 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, -0.8, 0.8);
      ctx.stroke();
    }

    // Top stems, leaves & crowns
    const leafCol = '#22c55e';
    const leafRim = toyRim(leafCol, 0.56);
    if (f.leaf || f.pear) {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = Math.max(2, r * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85);
      ctx.quadraticCurveTo(r * 0.12, -r * 1.15, r * 0.24, -r * 1.18);
      ctx.stroke();

      ctx.fillStyle = leafCol;
      ctx.strokeStyle = leafRim;
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.ellipse(r * 0.22, -r * 1.0, Math.max(4, r * 0.28), Math.max(2.4, r * 0.13), -0.45, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (f.stem) {
      ctx.strokeStyle = '#4c1d95';
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.86);
      ctx.quadraticCurveTo(-r * 0.1, -r * 1.12, r * 0.14, -r * 1.16);
      ctx.stroke();
    } else if (f.stick) {
      // Candy Apple wooden stick
      drawToyBevelRect(ctx, -r * 0.08, -r * 1.24, r * 0.16, r * 0.42, 3, '#d97706', {
        depth: 0,
        rimColor: '#78350f',
        lineWidth: 1.2,
      });
    } else if (f.crown) {
      // Golden Pineapple 3D leafy crown
      const cg = ctx.createLinearGradient(0, -r - 24, 0, -r + 4);
      cg.addColorStop(0, '#4ade80');
      cg.addColorStop(1, '#15803d');
      ctx.fillStyle = cg;
      ctx.strokeStyle = leafRim;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, -r + 4);
      ctx.lineTo(-20, -r - 18);
      ctx.lineTo(-6, -r - 8);
      ctx.lineTo(0, -r - 24);
      ctx.lineTo(6, -r - 8);
      ctx.lineTo(20, -r - 18);
      ctx.lineTo(14, -r + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.calyx) {
      // Strawberry green top calyx leaves
      ctx.fillStyle = leafCol;
      ctx.strokeStyle = leafRim;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, -r + 3, 10, 4, 0, 0, TAU);
      ctx.ellipse(-7, -r + 5, 8, 3.5, -0.6, 0, TAU);
      ctx.ellipse(7, -r + 5, 8, 3.5, 0.6, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (f.king) {
      // Superlambanana Royal Golden Crown & Magenta Lamb Ears
      const earRim = toyRim('#f72585', 0.56);
      ctx.fillStyle = '#f72585';
      ctx.strokeStyle = earRim;
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(-r * 0.7, -r * 0.6, 16, 9, -0.7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(r * 0.7, -r * 0.6, 16, 9, 0.7, 0, TAU); ctx.fill(); ctx.stroke();

      const crownG = ctx.createLinearGradient(0, -r - 22, 0, -r + 6);
      crownG.addColorStop(0, '#fff3b0');
      crownG.addColorStop(0.5, '#ffd166');
      crownG.addColorStop(1, '#d97706');
      ctx.fillStyle = crownG;
      ctx.strokeStyle = '#78350f';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-16, -r + 6);
      ctx.lineTo(-18, -r - 16);
      ctx.lineTo(-6, -r - 6);
      ctx.lineTo(0, -r - 22);
      ctx.lineTo(6, -r - 6);
      ctx.lineTo(18, -r - 16);
      ctx.lineTo(16, -r + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Tinted outer vinyl rim stroke around the sphere
    ctx.strokeStyle = rim;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();

    // 3. Soft Studio Crescent Specular Highlight (Upper Left)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.40, r * 0.3, r * 0.14, -0.52, 0, TAU);
    ctx.fill();

    // 4. Living Animated 3D Toy Eyes & Expressions
    const eyeSpacing = r * 0.32;
    const eyeY = -r * 0.04;
    const isBlinking = (blinkTime % 3.5) > 3.3;

    if (isSquished) {
      // Panicked / Squished expression
      drawToyEyes(ctx, 0, eyeY, Math.max(2.2, r * 0.14), {
        spacing: eyeSpacing * 2,
        style: 'dizzy',
        ink: '#0f172a',
      });

      // Nervous wavy mouth
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.5, r * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, eyeY + r * 0.35);
      ctx.quadraticCurveTo(0, eyeY + r * 0.2, r * 0.2, eyeY + r * 0.35);
      ctx.stroke();

      // Glossy cyan sweat drop
      drawToySphere(ctx, r * 0.55, -r * 0.35, Math.max(2.6, r * 0.08), '#38bdf8', {
        rimColor: '#0284c7',
        lineWidth: 0.9,
      });
    } else if (isBlinking) {
      // Cute blinking closed eye lines
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.6, r * 0.065);
      ctx.lineCap = 'round';
      const blinkR = Math.max(2.6, r * 0.13);
      ctx.beginPath();
      ctx.arc(-eyeSpacing, eyeY, blinkR, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(eyeSpacing, eyeY, blinkR, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else {
      // Rosy soft toy cheeks
      if (r >= 18) {
        ctx.fillStyle = 'rgba(255, 117, 143, 0.36)';
        ctx.beginPath();
        ctx.ellipse(-eyeSpacing * 1.35, eyeY + r * 0.18, r * 0.12, r * 0.07, 0, 0, TAU);
        ctx.ellipse(eyeSpacing * 1.35, eyeY + r * 0.18, r * 0.12, r * 0.07, 0, 0, TAU);
        ctx.fill();
      }

      // Expressive glossy toy eyes without heavy black outlines
      drawToyEyes(ctx, 0, eyeY, Math.max(2.2, r * 0.145), {
        spacing: eyeSpacing * 2,
        style: 'bright',
        lookX: 0.2,
        lookY: -0.05,
        ink: '#0f172a',
      });

      // Cute happy smiling mouth
      ctx.fillStyle = '#881337';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.1, r * 0.036);
      ctx.beginPath();
      ctx.arc(0, eyeY + r * 0.3, Math.max(3.5, r * 0.17), 0.1, Math.PI - 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pink tongue
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(0, eyeY + r * 0.4, Math.max(1.8, r * 0.095), Math.PI, 0);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
  }

  /* ------------------------------------------------------------ Next Bubble Preview */
  renderNextBubble(ctx) {
    const bx = 48;
    const by = 110;
    const bw = 74;
    const bh = 52;

    ctx.save();
    drawToyBevelRect(ctx, bx - bw / 2, by - bh / 2, bw, bh, 14, '#1e1b4b', {
      depth: 3,
      rimColor: '#ffd166',
      lineWidth: 2,
      gloss: false,
    });

    ctx.font = "700 10px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.6;
    ctx.strokeText('NEXT', bx, by - 12);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('NEXT', bx, by - 12);

    this.drawVectorFruit(ctx, bx, by + 9, this.next, 0, 0.62, false);
    ctx.restore();
  }

  /* ------------------------------------------------------------ Jar Shaker BUMP HUD */
  renderShakerHUD(ctx, W, H) {
    const sx = W - 78;
    const sy = 110;
    const sw = 108;
    const sh = 50;

    ctx.save();
    const canShake = this.shakerCharges > 0;
    drawToyBevelRect(
      ctx,
      sx - sw / 2,
      sy - sh / 2,
      sw,
      sh,
      14,
      canShake ? '#065f46' : '#1e1b4b',
      {
        depth: 3,
        rimColor: canShake ? '#3dffa2' : '#475569',
        lineWidth: 2,
        gloss: false,
      },
    );

    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';

    ctx.font = "700 11px 'Fredoka', 'Outfit', sans-serif";
    ctx.lineWidth = 2.6;
    ctx.strokeText('🫨 BUMP JAR', sx, sy - 7);
    ctx.fillStyle = canShake ? '#3dffa2' : '#94a3b8';
    ctx.fillText('🫨 BUMP JAR', sx, sy - 7);

    ctx.font = "700 12px 'Fredoka', 'Outfit', sans-serif";
    ctx.lineWidth = 2.6;
    ctx.strokeText(`⚡ ${this.shakerCharges} LEFT`, sx, sy + 11);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`⚡ ${this.shakerCharges} LEFT`, sx, sy + 11);
    ctx.restore();

    // Bottom Stats
    ctx.save();
    ctx.font = "700 12px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    const statMsg = `CONFECTIONERY FRUITS: ${this.fruits.length}`;
    ctx.strokeText(statMsg, 16, H - 76);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(statMsg, 16, H - 76);
    ctx.restore();
  }

  rr(x, y, w, h, r) {
    traceRoundRect(this.ctx, x, y, w, h, r);
  }
}
