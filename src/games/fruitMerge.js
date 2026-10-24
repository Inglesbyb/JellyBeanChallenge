import Matter from 'matter-js';
import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const { Engine, Composite, Bodies, Body, Events } = Matter;

const L = 35;
const R = 385;
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
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
    this.engine.gravity.y = 1.15;
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
      for (const f of saved.fruits) this.addFruit(f[0], f[1], f[2], f[3], -10, false);
      this.cur = saved.cur;
      this.next = saved.next;
      this.shakerCharges = saved.shakerCharges || 2;
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
    if (this.overT > 3.0) {
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

    // 1. Victorian Sweet Shop Interior Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1c0f2b');
    bg.addColorStop(0.45, '#351242');
    bg.addColorStop(1, '#1c0f2b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(off.x, off.y);

    // 2. The Victorian Glass Sweet Jar
    this.renderGlassJar(ctx, W);

    // 3. Danger Overflow Line
    const danger = this.overT > 0;
    ctx.strokeStyle = danger
      ? `rgba(255, 0, 84, ${0.7 + Math.sin(this.time * 16) * 0.3})`
      : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = danger ? 3.5 : 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(L, LINE);
    ctx.lineTo(R, LINE);
    ctx.stroke();
    ctx.setLineDash([]);

    if (danger) {
      ctx.fillStyle = '#ff0054';
      ctx.font = '900 15px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`OVERFLOW IN ${Math.max(0, 3 - this.overT).toFixed(1)}s!`, W / 2, LINE - 12);
    }

    // 4. Mascot Bean holding incoming fruit
    if (!this.dead) {
      const ready = this.cool <= 0;
      const isSpecial = this.cur < 0;
      const fR = isSpecial ? 22 : FR[this.cur].r;

      // Dashed Aim Guide Line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(this.aimX, SPAWN_Y + fR);
      ctx.lineTo(this.aimX, FLOOR);
      ctx.stroke();
      ctx.setLineDash([]);

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
      this.drawVectorFruit(ctx, this.aimX, SPAWN_Y, this.cur, 0, ready ? 1 : 0.7, false);
    } else {
      drawBean(ctx, this.aimX, SPAWN_Y, 28, {
        color: '#ff70a6',
        dead: true,
        squash: 0.7,
      });
    }

    // 5. Render All Confectionery Fruits in the Jar
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

  /* ------------------------------------------------------------ Victorian Glass Sweet Jar */
  renderGlassJar(ctx, W) {
    // Glass interior ambient tint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    this.rr(L - 4, 150, R - L + 8, FLOOR - 150 + 6, 22);
    ctx.fill();

    // Glass wall specular glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(255, 170, 220, 0.6)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(L - 4, 150);
    ctx.lineTo(L - 4, FLOOR - 16);
    ctx.quadraticCurveTo(L - 4, FLOOR + 4, L + 16, FLOOR + 4);
    ctx.lineTo(R - 16, FLOOR + 4);
    ctx.quadraticCurveTo(R + 4, FLOOR + 4, R + 4, FLOOR - 16);
    ctx.lineTo(R + 4, 150);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Brass jar mouth rim
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 2.5;
    ctx.fillRect(L - 10, 146, 12, 10);
    ctx.strokeRect(L - 10, 146, 12, 10);
    ctx.fillRect(R - 2, 146, 12, 10);
    ctx.strokeRect(R - 2, 146, 12, 10);
  }

  /* ------------------------------------------------------------ Custom Vector Confectionery Fruits (NO OS EMOJIS!) */
  drawVectorFruit(ctx, x, y, tier, angle, s = 1, isSquished = false, blinkTime = 0) {
    ctx.save();
    ctx.translate(x, y);

    // Special Item: Rainbow Swirl Joker Bean
    if (tier === -1) {
      const r = 22 * s;
      ctx.rotate(this.time * 3);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();

      const swirlColors = ['#ff0054', '#ffd166', '#3dffa2', '#00b4d8', '#7209b7'];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = swirlColors[i];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r - 2, (i / 5) * TAU, ((i + 1) / 5) * TAU);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      return;
    }

    // Special Item: Pop-Rock Bomb
    if (tier === -2) {
      const r = 22 * s;
      ctx.fillStyle = '#140924';
      ctx.strokeStyle = '#ff0054';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();

      // Glowing candy fuse spark
      ctx.fillStyle = '#ffeaa7';
      ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.7, 4 + Math.sin(this.time * 20) * 2, 0, TAU); ctx.fill();
      ctx.font = '800 13px Outfit, sans-serif';
      ctx.fillStyle = '#ffbe0b';
      ctx.textAlign = 'center';
      ctx.fillText('💣', 0, 4);
      ctx.restore();
      return;
    }

    const f = FR[tier];
    const r = f.r * s;

    // 1. Confectionery Body Gradient
    const bg = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.25, f.topC);
    bg.addColorStop(0.85, f.c);
    bg.addColorStop(1, '#140924');

    ctx.fillStyle = bg;
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = Math.max(3, r * 0.09);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // 2. Fruit-Specific Confectionery Features
    ctx.rotate(angle);

    if (f.stripes) {
      // Watermelon wavy dark green stripes
      ctx.strokeStyle = '#1b4332';
      ctx.lineWidth = Math.max(3.5, r * 0.12);
      for (let a = -0.7; a <= 0.7; a += 0.45) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.88, a - 0.25, a + 0.25);
        ctx.stroke();
      }
    } else if (f.crown) {
      // Golden Pineapple green crown on top
      ctx.fillStyle = '#38b000';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 2.5;
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
      // Strawberry green top leaves
      ctx.fillStyle = '#38b000';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -r + 3, 10, 4, 0, 0, TAU);
      ctx.ellipse(-7, -r + 5, 8, 3.5, -0.6, 0, TAU);
      ctx.ellipse(7, -r + 5, 8, 3.5, 0.6, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (f.king) {
      // Superlambanana Royal Golden Crown & Magenta Lamb Ears
      ctx.fillStyle = '#f72585';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(-r * 0.7, -r * 0.6, 16, 9, -0.7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(r * 0.7, -r * 0.6, 16, 9, 0.7, 0, TAU); ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(-16, -r + 6);
      ctx.lineTo(-18, -r - 16);
      ctx.lineTo(-6, -r - 6);
      ctx.lineTo(0, -r - 22);
      ctx.lineTo(6, -r - 6);
      ctx.lineTo(18, -r - 16);
      ctx.lineTo(16, -r + 6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // 3. Bloons Crescent Specular Highlight (Upper Left)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.32, r * 0.16, -0.5, 0, TAU);
    ctx.fill();

    // 4. Living Animated Cartoon Eyes & Expressions!
    const eyeSpacing = r * 0.32;
    const eyeY = -r * 0.05;
    const isBlinking = (blinkTime % 3.5) > 3.3;

    if (isSquished) {
      // Panicked / Squished expression (>_<)
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = Math.max(2.5, r * 0.08);
      // Left >
      ctx.beginPath();
      ctx.moveTo(-eyeSpacing - 5, eyeY - 5); ctx.lineTo(-eyeSpacing + 3, eyeY); ctx.lineTo(-eyeSpacing - 5, eyeY + 5);
      ctx.stroke();
      // Right <
      ctx.beginPath();
      ctx.moveTo(eyeSpacing + 5, eyeY - 5); ctx.lineTo(eyeSpacing - 3, eyeY); ctx.lineTo(eyeSpacing + 5, eyeY + 5);
      ctx.stroke();

      // Nervous wavy mouth
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, eyeY + r * 0.35);
      ctx.quadraticCurveTo(0, eyeY + r * 0.2, r * 0.2, eyeY + r * 0.35);
      ctx.stroke();

      // Cartoon blue sweat drop
      ctx.fillStyle = '#4cc9f0';
      ctx.beginPath();
      ctx.arc(r * 0.55, -r * 0.35, 3.5, 0, TAU);
      ctx.fill();
    } else if (isBlinking) {
      // Cute blinking closed eye lines
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = Math.max(2.5, r * 0.08);
      ctx.beginPath();
      ctx.arc(-eyeSpacing, eyeY, 4, 0.2, Math.PI - 0.2);
      ctx.arc(eyeSpacing, eyeY, 4, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else {
      // Big expressive cartoon eyes with glossy pupils
      [-eyeSpacing, eyeSpacing].forEach((ex) => {
        const er = Math.max(3.5, r * 0.18);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#140924';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(ex, eyeY, er, 0, TAU);
        ctx.fill();
        ctx.stroke();

        // Dark pupil
        ctx.fillStyle = '#140924';
        ctx.beginPath();
        ctx.arc(ex + 1, eyeY, er * 0.65, 0, TAU);
        ctx.fill();

        // Pupil specular glints
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex, eyeY - er * 0.25, er * 0.25, 0, TAU);
        ctx.fill();
      });

      // Cute happy smiling mouth
      ctx.fillStyle = '#800f2f';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, eyeY + r * 0.32, Math.max(4, r * 0.18), 0.1, Math.PI - 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pink tongue
      ctx.fillStyle = '#ff758f';
      ctx.beginPath();
      ctx.arc(0, eyeY + r * 0.42, Math.max(2, r * 0.1), Math.PI, 0);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------ Next Bubble Preview */
  renderNextBubble(ctx) {
    const bx = 48;
    const by = 110;

    ctx.save();
    ctx.fillStyle = 'rgba(20, 9, 36, 0.85)';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    this.rr(bx - 36, by - 24, 72, 48, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffd166';
    ctx.font = '800 10px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', bx, by - 10);

    this.drawVectorFruit(ctx, bx, by + 8, this.next, 0, 0.65, false);
    ctx.restore();
  }

  /* ------------------------------------------------------------ Jar Shaker BUMP HUD */
  renderShakerHUD(ctx, W, H) {
    const sx = W - 78;
    const sy = 110;

    ctx.save();
    const canShake = this.shakerCharges > 0;
    ctx.fillStyle = canShake ? 'rgba(61, 255, 162, 0.25)' : 'rgba(20, 9, 36, 0.7)';
    ctx.strokeStyle = canShake ? '#3dffa2' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2.5;
    this.rr(sx - 52, sy - 24, 104, 48, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = canShake ? '#3dffa2' : 'rgba(255, 255, 255, 0.5)';
    ctx.font = '900 11px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🫨 BUMP JAR`, sx, sy - 8);

    ctx.font = '800 12px Outfit, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`⚡ ${this.shakerCharges} LEFT`, sx, sy + 10);
    ctx.restore();

    // Bottom Stats
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '800 12px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`CONFECTIONERY FRUITS: ${this.fruits.length}`, 16, H - 76);
  }

  rr(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
