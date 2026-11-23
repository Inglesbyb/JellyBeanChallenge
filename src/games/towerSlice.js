import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';
import {
  shadeColor,
  mixColor,
  toyRim,
  toyLineW,
  drawToyShadow,
  drawToySphere,
  drawToyBevelRect,
  drawToyPill,
  drawToyEyes,
  traceRoundRect,
} from '../engine/toyStyle.js';

const BH = 32;          // block height
const BASE_Y = 660;     // screen y of the first block's top at camera 0
const BASE_W = 195;
const DEPTH = 12;       // pseudo-3D perspective depth
const TOL = 7;          // perfect-drop tolerance (px)
const FLOOR_GOAL = 50;  // spire height that completes the stage (Space Apex)

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class TowerSlice extends Game {
  static meta = {
    id: 'tower-slice',
    title: 'Royal Spire',
    icon: '🏰',
    hint: 'TAP to stack confectionery slabs — outbuild the rising caramel flood!',
    baseLikes: 1420,
    isPrestige: true,
    parScore60s: 520,
    cue: 'STACK THE SPIRE!',
    prestigeCue: 'FASTER SLABS · FASTER FLOOD!',
    scaling: {
      slabSpeedMult: { base: 1.0,  rate: 0.16, cap: 1.55, mode: 'up',   label: 'Slab Speed' },
      snapTolerance: { base: 7.0,  rate: 0.18, floor: 3.2, mode: 'down', label: 'Snap Margin' },
      floodSpeed:    { base: 15.5, rate: 0.18, cap: 27.0, mode: 'up',   unit: 'px/s', label: 'Flood Speed' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    // Prestige rank (1 = first playthrough). Set by Reel.js before init().
    this.pLevel = Math.max(1, this.prestige || 1);
    const validSavedBlocks = Array.isArray(saved?.blocks) && saved.blocks.length > 0
      && saved.blocks.every((b) => Number.isFinite(b?.x) && Number.isFinite(b?.w) && b.w > 0);
    this.blocks = validSavedBlocks
      ? saved.blocks.map((b) => ({ ...b }))
      : [{ x: (this.W - BASE_W) / 2, w: BASE_W, hue: 210, type: 'wafer', milestone: false }];
    this.combo = (saved && Number.isFinite(saved.combo)) ? saved.combo : 0;
    this.falling = [];
    this.crumbs = [];
    this.cam = 0;
    this.tapLock = 0.3;
    this.glow = 0;
    this.comboText = 0;
    this.sway = 0;
    this.mascotUmbrella = false;

    // Atmospheric stars and floating sugar flecks
    this.stars = Array.from({ length: 50 }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      s: 0.8 + Math.random() * 2.2,
      d: 0.15 + Math.random() * 0.85,
      sparkle: Math.random() * TAU,
    }));

    // Floating cotton candy clouds in mid-sky
    this.clouds = Array.from({ length: 8 }, (_, i) => ({
      x: Math.random() * this.W,
      y: 400 + i * 220,
      w: 90 + Math.random() * 110,
      h: 36 + Math.random() * 24,
      speed: (Math.random() > 0.5 ? 1 : -1) * (12 + Math.random() * 18),
      color: i % 2 === 0 ? 'rgba(255, 182, 193, 0.45)' : 'rgba(180, 240, 255, 0.45)',
    }));

    // Chimney smoke puffs for Victorian rooftop layer
    this.smokePuffs = Array.from({ length: 14 }, () => ({
      x: 30 + Math.random() * (this.W - 60),
      y: Math.random() * 500,
      r: 6 + Math.random() * 14,
      vy: -18 - Math.random() * 15,
      alpha: 0.15 + Math.random() * 0.3,
    }));

    // Ground cheering crowd of jellybeans
    this.crowd = Array.from({ length: 11 }, (_, i) => ({
      x: 20 + i * ((this.W - 40) / 10),
      color: ['#ff4d6d', '#3dffa2', '#ffbe0b', '#4cc9f0', '#b5179e', '#ff9f1c'][i % 6],
      banner: i === 2 ? 'UP! 🎈' : i === 8 ? 'MORE SUGAR! 🍬' : null,
      phase: Math.random() * TAU,
    }));

    this.cam = this.camTarget();
    const startTopH = (this.blocks.length - 1) * BH;
    this.floodH = startTopH - 170;
    this.floodDelay = 1.25;
    this.floodWarnT = 0;
    this.floodBubbles = Array.from({ length: 14 }, (_, i) => ({
      x: 18 + (i / 13) * (this.W - 36),
      phase: Math.random() * TAU,
      r: 3.5 + Math.random() * 5,
      spd: 2.2 + Math.random() * 2.5,
    }));
    this.spawnCur();
  }

  serialize() {
    return {
      blocks: this.blocks.map((b) => ({ ...b })),
      combo: this.combo,
    };
  }

  restoreLabel() {
    return `spire height ${this.blocks.length - 1}`;
  }

  camTarget() {
    return Math.max(0, this.blocks.length * BH - 280);
  }

  slotY(i) {
    return BASE_Y - i * BH + this.cam;
  }

  getSlabType(index, combo) {
    if (index > 0 && index % 10 === 0) return 'gold';
    if (combo >= 4) return 'gold';
    const cycle = ['wafer', 'fondant', 'gummy', 'chocolate', 'fondant'];
    return cycle[index % cycle.length];
  }

  spawnCur() {
    const top = this.blocks[this.blocks.length - 1];
    const n = this.blocks.length;
    const fromLeft = n % 2 === 0;
    const mn = 8;
    const mx = this.W - 8 - top.w;
    const type = this.getSlabType(n, this.combo);

    this.cur = {
      w: top.w,
      x: fromLeft ? mn : mx,
      dir: fromLeft ? 1 : -1,
      speed: Math.min(560, (185 + n * 5.2) * (this.diff.slabSpeedMult ?? 1)),
      hue: (200 + n * 11) % 360,
      type,
      milestone: n % 10 === 0,
    };
  }

  update(dt) {
    this.tapLock -= dt;
    this.glow = Math.max(0, this.glow - dt * 2.2);
    this.comboText = Math.max(0, this.comboText - dt);
    this.sway *= Math.exp(-dt * 4.5);

    const c = this.cur;
    if (c) {
      c.x += c.dir * c.speed * dt;
      const mn = 8;
      const mx = this.W - 8 - c.w;
      if (c.x > mx) { c.x = mx; c.dir = -1; }
      if (c.x < mn) { c.x = mn; c.dir = 1; }
      if (this.input.pressed && this.tapLock <= 0) this.drop();
    }

    // Rising Caramel Flood chase (incentivizes rapid stacking upward like Crossy Road!)
    if (!this.dead && !this.won) {
      const topH = (this.blocks.length - 1) * BH;
      if (this.floodDelay > 0) {
        this.floodDelay = Math.max(0, this.floodDelay - dt);
      } else {
        const riseRate = this.diff.floodSpeed ?? 15.5;
        this.floodH += riseRate * dt;
        // Rubber-band minimum pursuit gap (~8.5 floors behind) so fast climbers still see the tide below
        if (topH - this.floodH > 270) {
          this.floodH += (topH - 270 - this.floodH) * Math.min(1, dt * 3.0);
        }
        const gap = topH - this.floodH;
        if (gap < 95) {
          this.floodWarnT += dt;
        } else {
          this.floodWarnT = 0;
        }
        if (this.floodH >= topH - 4) {
          const topBlock = this.blocks[this.blocks.length - 1];
          const floodScreenY = BASE_Y - this.floodH + this.cam;
          this.spawnCrumbs(topBlock.x, floodScreenY - 12, topBlock.w, 'gummy', 32);
          this.mascotUmbrella = false;
          this.cur = null;
          this.sounds.fail?.();
          this.fx.shake(12, 0.45);
          this.die('Swallowed by the rising Caramel Flood!');
          return;
        }
      }
    }

    for (const fb of this.floodBubbles) {
      fb.phase += dt * fb.spd;
    }

    this.cam += (this.camTarget() - this.cam) * Math.min(1, dt * 5.5);
    this.updateFalling(dt);
    this.updateCrumbs(dt);
    this.fx.update(dt);

    // Update clouds
    for (const cl of this.clouds) {
      cl.x += cl.speed * dt;
      if (cl.x > this.W + 120) cl.x = -120;
      if (cl.x < -120) cl.x = this.W + 120;
    }

    // Update chimney smoke
    for (const sm of this.smokePuffs) {
      sm.y += sm.vy * dt;
      if (sm.y < 0) {
        sm.y = 520;
        sm.x = 30 + Math.random() * (this.W - 60);
      }
    }

    // Update stars sparkle
    for (const s of this.stars) {
      s.sparkle += dt * 3;
    }
  }

  updateFalling(dt) {
    for (const f of this.falling) {
      f.vy += 1600 * dt;
      f.y += f.vy * dt;
      f.x += f.vx * dt;
      f.rot += f.vr * dt;
    }
    this.falling = this.falling.filter((f) => f.y < this.H + 300);
  }

  updateCrumbs(dt) {
    for (const c of this.crumbs) {
      c.vy += 1200 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      c.life -= dt;
    }
    this.crumbs = this.crumbs.filter((c) => c.life > 0);
  }

  updateDying(dt) {
    this.updateFalling(dt);
    this.updateCrumbs(dt);
    super.updateDying(dt);
  }

  spawnCrumbs(x, y, w, type, count = 22) {
    const colors = {
      wafer: ['#e9c46a', '#f4a261', '#e76f51', '#ffffff'],
      fondant: ['#ff70a6', '#ffd166', '#06d6a0', '#ffffff', '#118ab2'],
      gummy: ['#ff0054', '#70e000', '#00b4d8', '#ffb703'],
      chocolate: ['#4a2810', '#6f4e37', '#e29578', '#fff'],
      gold: ['#ffd700', '#ffbe0b', '#fff3b0', '#ffffff'],
    }[type] || ['#ffd166', '#fff'];

    for (let i = 0; i < count; i++) {
      const px = x + Math.random() * w;
      const angle = (Math.random() - 0.5) * Math.PI;
      const spd = 80 + Math.random() * 260;
      this.crumbs.push({
        x: px,
        y: y + Math.random() * BH,
        vx: Math.sin(angle) * spd,
        vy: -Math.cos(angle) * spd * 0.7 - 60,
        s: 2.5 + Math.random() * 5,
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 14,
        life: 0.6 + Math.random() * 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        isSprinkle: type === 'fondant' && Math.random() > 0.4,
      });
    }
  }

  drop() {
    const top = this.blocks[this.blocks.length - 1];
    const cur = this.cur;
    const n = this.blocks.length;
    const y = this.slotY(n);
    const delta = cur.x - top.x;

    const tol = this.diff.snapTolerance ?? TOL;
    if (Math.abs(delta) <= tol) {
      // PERFECT DROP
      this.combo += 1;
      const isMilestone = (n % 10 === 0);
      const expand = this.combo >= 3 ? 10 : 0;
      const w = Math.min(BASE_W + (isMilestone ? 24 : 0), cur.w + expand);
      const nx = top.x - (w - top.w) / 2;

      this.blocks.push({
        x: clamp(nx, 0, this.W - w),
        w,
        hue: cur.hue,
        type: cur.type,
        milestone: isMilestone,
      });

      this.score += 15 + this.combo * 8 + (isMilestone ? 50 : 0);
      this.glow = 1.0;
      this.comboText = 1.3;
      this.sway = 0; // perfect drops steady the tower

      // Perfect FX
      this.fx.ring(this.W / 2, y + BH / 2, '#fff', 260, 0.55, 5);
      this.fx.ring(top.x + top.w / 2, y + BH / 2, '#ffd700', 180, 0.45, 3);
      this.spawnCrumbs(top.x, y, top.w, cur.type, 30);

      const title = isMilestone
        ? `ROYAL BALCONY! FLOOR ${n}`
        : this.combo > 1
        ? `PERFECT ×${this.combo}!`
        : 'PERFECT!';
      this.fx.text(this.W / 2, y - 28, title, '#ffe066', 22, 1.0);

      this.sounds.stack(this.combo);
      this.haptics.medium();
    } else {
      const overlap = cur.w - Math.abs(delta);
      if (overlap <= 0) {
        // Complete Miss -> Game Over
        this.falling.push({
          x: cur.x,
          y,
          w: cur.w,
          hue: cur.hue,
          type: cur.type,
          milestone: cur.milestone,
          vx: delta > 0 ? 90 : -90,
          vy: -60,
          rot: 0,
          vr: delta > 0 ? 1.8 : -1.8,
        });
        this.spawnCrumbs(cur.x, y, cur.w, cur.type, 35);
        this.cur = null;
        this.mascotUmbrella = true;
        this.sounds.slice();
        this.fx.shake(12, 0.45);
        this.die('Missed the spire slab!');
        return;
      }

      // Sliced Overhang
      let nx, cutX, cutW;
      cutW = Math.abs(delta);
      if (delta > 0) {
        nx = cur.x;
        cutX = top.x + top.w;
      } else {
        nx = top.x;
        cutX = cur.x;
      }

      this.falling.push({
        x: cutX,
        y,
        w: cutW,
        hue: cur.hue,
        type: cur.type,
        milestone: cur.milestone,
        vx: delta > 0 ? 70 : -70,
        vy: -40,
        rot: 0,
        vr: delta > 0 ? 2.2 : -2.2,
      });

      this.spawnCrumbs(cutX, y, cutW, cur.type, 18);
      this.blocks.push({
        x: nx,
        w: overlap,
        hue: cur.hue,
        type: cur.type,
        milestone: n % 10 === 0,
      });

      this.combo = 0;
      this.score += 10;
      this.sway = clamp(delta * 0.05, -3.2, 3.2); // Tower wobbles from off-center impact
      this.sounds.slice();
      this.sounds.stack(1);
      this.haptics.light();
    }

    // Stage complete: spire topped out at the goal floor.
    if (this.blocks.length - 1 >= FLOOR_GOAL && !this.won) {
      this.won = true;
      this.winReason = `Spire Reached Floor ${FLOOR_GOAL}! 🏰`;
    }

    this.spawnCur();
  }

  /* ------------------------------------------------------------ render */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const n = this.blocks.length;
    const floor = n - 1;

    // 1. Dynamic Parallax Sky Palette (Street -> Rooftops -> Clouds -> Stratosphere)
    this.renderSky(ctx, W, H, floor);

    // 2. Giant faint height counter
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "900 135px 'Fredoka', 'Outfit', sans-serif";
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillText(String(floor), W / 2, 250);

    const off = this.fx.offset();
    ctx.save();
    ctx.translate(off.x, off.y);

    // 3. Ground Pedestal: Victorian Cobblestone & Cheering Crowd
    this.renderGroundPedestal(ctx, W);

    // 4. Render Tower Slabs (Bottom-up with gentle height sway)
    for (let i = 0; i < n; i++) {
      const y = this.slotY(i);
      if (y > H + 60 || y < -80) continue;
      const b = this.blocks[i];
      // Subtle sway wobble as tower gets taller
      const swayOff = Math.sin(this.time * 6 + i * 0.4) * this.sway * (i / Math.max(1, n));
      this.drawConfectionerySlab(
        b.x + swayOff,
        y,
        b.w,
        b.hue,
        b.type || 'wafer',
        b.milestone,
        i === n - 1 ? this.glow : 0,
        false,
        i
      );
    }

    // 5. Active Moving Slab & Alignment Guide Rails
    if (this.cur) {
      const c = this.cur;
      const top = this.blocks[n - 1];
      const curY = this.slotY(n);

      // Cartoon alignment guidelines
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(top.x, curY + BH);
      ctx.lineTo(top.x, curY - 90);
      ctx.moveTo(top.x + top.w, curY + BH);
      ctx.lineTo(top.x + top.w, curY - 90);
      ctx.stroke();
      ctx.restore();

      this.drawConfectionerySlab(c.x, curY, c.w, c.hue, c.type, c.milestone, 0, true, n);
    }

    // 6. Tumbling Sliced-off Slab Chunks
    for (const f of this.falling) {
      ctx.save();
      ctx.translate(f.x + f.w / 2, f.y + BH / 2);
      ctx.rotate(f.rot);
      this.drawConfectionerySlab(
        -f.w / 2,
        -BH / 2,
        f.w,
        f.hue,
        f.type || 'wafer',
        f.milestone,
        0,
        false,
        0
      );
      ctx.restore();
    }

    // 7. Slicing Crumbs, Sprinkles & Frosting Particles
    this.renderCrumbs(ctx);

    // 8. Living Acrobat Mascot (Captain Bean / Paul Mac-Candy)
    this.renderMascot(ctx, n);

    // 9. Rising Caramel / Berry Flood Chase Layer
    this.renderCaramelFlood(ctx, W, H);

    this.fx.render(ctx, 1);
    ctx.restore();

    // 9. Floating Combo Text Banner
    if (this.comboText > 0 && this.combo >= 2) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.comboText * 2);
      const cw = 210;
      const ch = 32;
      drawToyPill(ctx, W / 2 - cw / 2, 110, cw, ch, '#f59e0b', {
        rimColor: '#78350f',
        lineWidth: 2,
        gloss: true,
      });
      ctx.font = "800 17px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#0f172a';
      const txt = `🔥 SWEET COMBO ×${this.combo}`;
      ctx.strokeText(txt, W / 2, 126);
      ctx.fillStyle = '#fef08a';
      ctx.fillText(txt, W / 2, 126);
      ctx.restore();
    }

    // 10. Clean In-Game Spire Stage HUD
    this.renderSpireHUD(ctx, W, H, floor);
  }

  /* ------------------------------------------------------------ Environment Sky */
  renderSky(ctx, W, H, floor) {
    const g = ctx.createLinearGradient(0, 0, 0, H);

    if (floor < 12) {
      // Zone 1: Beanpool Twilight (warm apricot to Victorian purple)
      g.addColorStop(0, '#2b1055');
      g.addColorStop(0.5, '#56196b');
      g.addColorStop(1, '#ff8a5b');
    } else if (floor < 30) {
      // Zone 2: Rooftops & Spires (deep violet to magenta)
      g.addColorStop(0, '#190a36');
      g.addColorStop(0.6, '#3a0ca3');
      g.addColorStop(1, '#b5179e');
    } else if (floor < 55) {
      // Zone 3: Cotton Candy Cloud Kingdom (soft azure to candy pink)
      g.addColorStop(0, '#102a71');
      g.addColorStop(0.5, '#4361ee');
      g.addColorStop(1, '#f72585');
    } else {
      // Zone 4: Cosmic Sherbet Stratosphere (deep midnight indigo with jawbreaker nebula)
      g.addColorStop(0, '#03071e');
      g.addColorStop(0.5, '#0d1b2a');
      g.addColorStop(1, '#3a0ca3');
    }

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Victorian Rooftops silhouette at low heights
    const roofY = BASE_Y + this.cam - 180;
    if (roofY < H + 100 && roofY > -100) {
      ctx.fillStyle = 'rgba(20, 9, 36, 0.45)';
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, roofY + 60);
      ctx.lineTo(40, roofY + 30);
      ctx.lineTo(70, roofY + 60);
      ctx.lineTo(130, roofY + 10);
      ctx.lineTo(160, roofY + 60);
      ctx.lineTo(210, roofY - 20); // Spire silhouette
      ctx.lineTo(220, roofY - 70);
      ctx.lineTo(230, roofY - 20);
      ctx.lineTo(280, roofY + 50);
      ctx.lineTo(W, roofY + 50);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }

    // Drifting cotton candy clouds (plump 3D vinyl toy clouds)
    for (const cl of this.clouds) {
      const cy = (cl.y + this.cam * 0.4) % (H + 200) - 100;
      const cg = ctx.createLinearGradient(0, cy - cl.h * 0.5, 0, cy + cl.h * 0.5);
      cg.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
      cg.addColorStop(1, cl.color);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(cl.x, cy, cl.w * 0.5, cl.h * 0.5, 0, 0, TAU);
      ctx.ellipse(cl.x - cl.w * 0.25, cy + 4, cl.w * 0.35, cl.h * 0.4, 0, 0, TAU);
      ctx.ellipse(cl.x + cl.w * 0.25, cy + 2, cl.w * 0.35, cl.h * 0.4, 0, 0, TAU);
      ctx.fill();
    }

    // Cosmic Sherbet Moon & Donut Planet (visible at high floors)
    if (floor >= 35) {
      ctx.save();
      const moonAlpha = Math.min(1, (floor - 35) / 15);
      ctx.globalAlpha = moonAlpha;

      // Crescent Jawbreaker Moon with soft studio glow
      const mg = ctx.createRadialGradient(W - 65, 110, 14, W - 65, 110, 44);
      mg.addColorStop(0, 'rgba(255, 234, 167, 0.45)');
      mg.addColorStop(1, 'rgba(255, 234, 167, 0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(W - 65, 110, 44, 0, TAU);
      ctx.fill();

      drawToySphere(ctx, W - 65, 110, 26, '#ffeaa7', { rimColor: '#ca8a04', lineWidth: 1.4 });
      ctx.fillStyle = '#0d1b2a';
      ctx.beginPath();
      ctx.arc(W - 55, 104, 22, 0, TAU);
      ctx.fill();

      // Ringed Frosted Donut Planet
      const px = 55;
      const py = 160;
      drawToySphere(ctx, px, py, 19, '#ff70a6', { rimColor: '#9d174d', lineWidth: 1.4 });
      // Planet ring
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.ellipse(px, py, 34, 9, -0.35, 0, TAU);
      ctx.stroke();

      ctx.restore();
    }

    // Sparkling stars
    for (const s of this.stars) {
      const sy = (s.y + this.cam * s.d * 0.25) % H;
      const sparkle = 0.5 + Math.sin(s.sparkle) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + sparkle * 0.65})`;
      ctx.beginPath();
      ctx.arc(s.x, sy, s.s * (0.8 + sparkle * 0.4), 0, TAU);
      ctx.fill();
    }
  }

  /* ------------------------------------------------------------ Ground Pedestal */
  renderGroundPedestal(ctx, W) {
    const py = this.slotY(0) + BH;
    if (py < this.H + 120) {
      // Victorian Foundation Pedestal with smooth 3D gradient & tinted rim
      const pg = ctx.createLinearGradient(0, py, 0, py + 140);
      pg.addColorStop(0, '#3b1232');
      pg.addColorStop(1, '#1e0920');
      ctx.fillStyle = pg;
      ctx.strokeStyle = toyRim('#581c87', 0.5);
      ctx.lineWidth = 2;
      ctx.fillRect(8, py, W - 16, 500);
      ctx.strokeRect(8, py, W - 16, 500);

      // Gilded foundation cornice bevel
      drawToyBevelRect(ctx, 8, py, W - 16, 10, 4, '#ffd166', {
        depth: 2,
        rimColor: '#92400e',
        lineWidth: 1.4,
        gloss: true,
      });

      // Cobblestone gumdrop paving (3D pebble domes)
      for (let cx = 16; cx < W - 20; cx += 22) {
        drawToySphere(ctx, cx + 8, py + 24, 5.5, '#6b21a8', {
          rimColor: '#3b0764',
          lineWidth: 0.9,
          shine: 0.45,
          bottomBounce: false,
        });
      }

      // Cheering Jellybean Crowd at the base!
      for (const b of this.crowd) {
        const jump = Math.sin(this.time * 6 + b.phase) * 8;
        const by = py + 48 - jump;
        const shScale = clamp(1 - jump * 0.025, 0.72, 1.15);

        drawToyShadow(ctx, b.x, py + 58, 10 * shScale, 3.6 * shScale, 0.28);

        drawBean(ctx, b.x, by, 16, {
          color: b.color,
          walkT: this.time * 2,
          squash: jump > 0 ? 1.15 : 0.95,
          eyes: 'happy',
        });

        // Banners held by citizens
        if (b.banner && jump > 2) {
          ctx.save();
          drawToyBevelRect(ctx, b.x - 32, by - 29, 64, 17, 6, '#ffffff', {
            depth: 2,
            rimColor: '#334155',
            lineWidth: 1.4,
            gloss: true,
          });
          ctx.font = "800 8.5px 'Fredoka', 'Outfit', sans-serif";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#0f172a';
          ctx.fillText(b.banner, b.x, by - 20);
          ctx.restore();
        }
      }
    }
  }

  /* ------------------------------------------------------------ Confectionery Slabs (3D Vinyl Toy Blocks) */
  drawConfectionerySlab(x, y, w, hue, type, milestone, glow = 0, moving = false, floorIndex = 0) {
    const ctx = this.ctx;
    const d = DEPTH;

    ctx.save();

    // 1. Slab Base Colors by Confectionery Type
    let frontBase, topBase, sideBase;

    switch (type) {
      case 'wafer':
        frontBase = moving ? '#e76f51' : '#d4a373';
        topBase = '#faedcd';
        sideBase = '#99582a';
        break;
      case 'fondant':
        frontBase = `hsl(${hue}, 85%, ${moving ? 70 : 64}%)`;
        topBase = `hsl(${hue}, 90%, 84%)`;
        sideBase = `hsl(${hue}, 75%, 44%)`;
        break;
      case 'gummy':
        frontBase = `hsl(${hue}, 95%, ${moving ? 58 : 52}%)`;
        topBase = `hsl(${hue}, 100%, 78%)`;
        sideBase = `hsl(${hue}, 90%, 36%)`;
        break;
      case 'chocolate':
        frontBase = '#6f3d1c';
        topBase = '#9a5b32';
        sideBase = '#3d1f0a';
        break;
      case 'gold':
      default:
        frontBase = '#ffb703';
        topBase = '#ffea00';
        sideBase = '#c77d00';
        break;
    }

    const rim = toyRim(frontBase, 0.56);
    const lw = toyLineW(Math.min(w, BH), 0.048, 0.9, 1.85);
    ctx.lineJoin = 'round';

    // 2. Draw 3D Top Face (Volumetric gradient + tinted rim)
    const tg = ctx.createLinearGradient(x, y - d * 0.6, x + w, y);
    tg.addColorStop(0, shadeColor(topBase, 0.25));
    tg.addColorStop(0.55, topBase);
    tg.addColorStop(1, shadeColor(topBase, -0.08));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + d, y - d * 0.6);
    ctx.lineTo(x + w + d, y - d * 0.6);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = lw;
    ctx.stroke();

    // 3. Draw 3D Right Side Face (Shaded depth gradient)
    const sg = ctx.createLinearGradient(x + w, y, x + w + d, y + BH);
    sg.addColorStop(0, shadeColor(sideBase, 0.1));
    sg.addColorStop(1, shadeColor(sideBase, -0.24));
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w + d, y - d * 0.6);
    ctx.lineTo(x + w + d, y + BH - d * 0.6);
    ctx.lineTo(x + w, y + BH);
    ctx.closePath();
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = lw;
    ctx.stroke();

    // 4. Draw Front Face (3D Vinyl studio lighting + soft top bevel + tinted rim)
    const fg = ctx.createLinearGradient(x, y, x, y + BH);
    fg.addColorStop(0, shadeColor(frontBase, 0.26));
    fg.addColorStop(0.52, frontBase);
    fg.addColorStop(1, shadeColor(frontBase, -0.18));
    ctx.fillStyle = fg;
    ctx.fillRect(x, y, w, BH);

    // 5. Confectionery Texture Patterns
    if (type === 'wafer') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.2;
      for (let gx = x + 10; gx < x + w - 4; gx += 14) {
        ctx.beginPath();
        ctx.moveTo(gx, y); ctx.lineTo(gx + 6, y + BH);
        ctx.moveTo(gx + 6, y); ctx.lineTo(gx, y + BH);
        ctx.stroke();
      }
      // Creamy vanilla filling layer
      ctx.fillStyle = '#fff9ec';
      ctx.fillRect(x, y + BH * 0.42, w, 4.5);
      ctx.fillStyle = 'rgba(120, 53, 15, 0.16)';
      ctx.fillRect(x, y + BH * 0.42 + 4.5, w, 1.5);
      ctx.restore();
    } else if (type === 'fondant') {
      ctx.save();
      // Royal icing scalloped drips with soft bounce shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
      const dripW = 12;
      for (let dx = x; dx < x + w - 4; dx += dripW) {
        ctx.beginPath();
        ctx.arc(dx + dripW * 0.5, y + 6.5, dripW * 0.5, 0, Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      for (let dx = x; dx < x + w - 4; dx += dripW) {
        ctx.beginPath();
        ctx.arc(dx + dripW * 0.5, y + 5, dripW * 0.5, 0, Math.PI);
        ctx.fill();
      }
      // Pill sprinkles on top face
      if (w >= 40) {
        drawToyPill(ctx, x + 12, y - 5, 8, 3, '#ff0054', { lineWidth: 0.4, gloss: false });
        drawToyPill(ctx, x + 28, y - 6, 8, 3, '#06d6a0', { lineWidth: 0.4, gloss: false });
        drawToyPill(ctx, x + w - 24, y - 5, 8, 3, '#ffbe0b', { lineWidth: 0.4, gloss: false });
      }
      ctx.restore();
    } else if (type === 'gummy') {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 10, 6.5, 3, -0.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w - 18, y + 18, 3.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (type === 'chocolate') {
      // Molded cocoa tablet grooves
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.2;
      for (let cx = x + 18; cx < x + w - 10; cx += 24) {
        traceRoundRect(ctx, cx - 8, y + 6, 16, BH - 12, 3);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Front face crisp tinted rim stroke
    ctx.strokeStyle = rim;
    ctx.lineWidth = lw;
    ctx.strokeRect(x, y, w, BH);

    // 6. Arched Victorian Windows with Peeking Jellybean Citizens!
    if (!moving && w >= 80 && floorIndex > 0 && floorIndex % 3 === 0) {
      const winX = x + w / 2;
      const winY = y + 7;
      const winW = 18;
      const winH = 20;

      // Warm brass/stone arched frame
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(winX - winW / 2, winY, winW, winH, [8, 8, 2, 2]);
      ctx.fill();

      // Window interior warm glow
      const wg = ctx.createLinearGradient(0, winY, 0, winY + winH);
      wg.addColorStop(0, '#fef08a');
      wg.addColorStop(1, '#fbbf24');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.roundRect(winX - winW / 2 + 2, winY + 2, winW - 4, winH - 4, [6, 6, 1, 1]);
      ctx.fill();

      // Tiny 3D vinyl peeking jellybean face
      const beanColor = ['#3dffa2', '#ff4d6d', '#4cc9f0', '#ff9f1c'][floorIndex % 4];
      drawToySphere(ctx, winX, winY + 12, 5.2, beanColor, {
        rimColor: toyRim(beanColor),
        lineWidth: 0.85,
        bottomBounce: false,
      });
      drawToyEyes(ctx, winX, winY + 11.5, 1.4, { spacing: 3.2, style: 'happy' });
    }

    // 7. Milestone Balcony Decorative Cornices (Liver-Bird Statues!)
    if (milestone) {
      ctx.save();
      this.drawMiniLiverBird(ctx, x - 2, y - 8);
      this.drawMiniLiverBird(ctx, x + w + 2, y - 8);

      for (let rx = x + 10; rx < x + w - 6; rx += 12) {
        drawToySphere(ctx, rx, y + 4, 2.8, '#fde047', {
          rimColor: '#92400e',
          lineWidth: 0.8,
          bottomBounce: false,
        });
      }
      ctx.restore();
    }

    // Soft studio top-edge specular crescent
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), 3.2);

    // Perfect Drop Golden Glow Burst
    if (glow > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${glow * 0.72})`;
      ctx.fillRect(x, y, w, BH);
    }

    ctx.restore();
  }

  drawMiniLiverBird(ctx, bx, by) {
    // Stylized 3D golden Liver-Bird mascot finial
    drawToySphere(ctx, bx, by + 6, 5.2, '#ffd700', {
      rimColor: '#78350f',
      lineWidth: 1.1,
      bottomBounce: false,
    });
    drawToySphere(ctx, bx, by, 4.6, '#ffe066', {
      rimColor: '#78350f',
      lineWidth: 1.1,
      bottomBounce: false,
    });
    // Emerald sprig in beak
    drawToySphere(ctx, bx + 4.2, by - 2, 2.0, '#3dffa2', {
      rimColor: '#065f46',
      lineWidth: 0.6,
      bottomBounce: false,
    });
  }

  /* ------------------------------------------------------------ Crumb Particles */
  renderCrumbs(ctx) {
    for (const c of this.crumbs) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      const rim = toyRim(c.color, 0.54);
      const lw = toyLineW(c.s * 2, 0.04, 0.65, 1.3);

      if (c.isSprinkle) {
        drawToyPill(ctx, -c.s, -c.s * 0.42, c.s * 2, c.s * 0.84, c.color, {
          rimColor: rim,
          lineWidth: lw,
          gloss: true,
        });
      } else {
        drawToySphere(ctx, 0, 0, c.s * 0.55, c.color, {
          rimColor: rim,
          lineWidth: lw,
          bottomBounce: false,
        });
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ Living Acrobat Mascot */
  renderMascot(ctx, n) {
    if (n <= 0) return;

    const top = this.blocks[n - 1];
    const bx = top.x + top.w / 2;
    const isWobbly = top.w < 70;
    const isDead = this.dead;
    const floodGap = (n - 1) * BH - this.floodH;
    const nearFlood = !isDead && floodGap < 95;

    // Jumping acrobatics on perfect drops
    const jumpY = this.glow > 0 ? Math.sin(this.glow * Math.PI) * 28 : 0;
    const flipRot = this.glow > 0 ? (1 - this.glow) * TAU : 0;
    const slabTopY = this.slotY(n - 1);
    const by = slabTopY - 18 - jumpY;

    // Grounding shadow on top of the spire slab
    if (!isDead) {
      const shScale = clamp(1 - jumpY * 0.018, 0.45, 1);
      drawToyShadow(ctx, bx, slabTopY - 1, 14 * shScale, 4.5 * shScale, 0.28 * shScale);
    }

    // Wobble angle when platform is narrow or flood is licking toes
    const wobbleAngle = (isWobbly || nearFlood) && !isDead ? Math.sin(this.time * (nearFlood ? 16 : 12)) * (nearFlood ? 0.2 : 0.28) : 0;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(flipRot + wobbleAngle);

    drawBean(ctx, 0, 0, 24, {
      color: '#25e6ff',
      bellyColor: '#ff758f',
      squash: this.glow > 0 ? 1.28 : isWobbly ? 0.92 : 1,
      hat: this.combo >= 2 ? 'crown' : null,
      walkT: this.time * (nearFlood ? 5.5 : 3),
      eyes: isDead ? 'squish' : nearFlood ? 'alert' : this.combo >= 2 ? 'happy' : isWobbly ? 'wink' : 'happy',
      dead: isDead,
    });

    // Sweat drops when wobbling on a narrow slab or escaping the flood
    if ((isWobbly || nearFlood) && !isDead) {
      ctx.fillStyle = nearFlood ? '#fb7185' : '#4cc9f0';
      ctx.font = "800 12px 'Fredoka', 'Outfit', sans-serif";
      ctx.fillText(nearFlood ? '🔥' : '💦', 14, -12);
      ctx.fillText('💦', -18, -10);
    }

    // Vinyl cocktail umbrella when tumbling during Game Over
    if (isDead && this.mascotUmbrella) {
      ctx.save();
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(8, -12);
      ctx.lineTo(14, -36);
      ctx.stroke();

      const ug = ctx.createRadialGradient(8, -42, 2, 14, -36, 18);
      ug.addColorStop(0, '#fda4af');
      ug.addColorStop(0.45, '#f43f5e');
      ug.addColorStop(1, '#9f1239');
      ctx.fillStyle = ug;
      ctx.strokeStyle = '#881337';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(14, -36, 18, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------ Rising Caramel Flood */
  renderCaramelFlood(ctx, W, H) {
    const floodY = BASE_Y - this.floodH + this.cam;
    if (floodY > H + 36) return;

    ctx.save();

    // 1. Back swirling berry-orange wave
    ctx.fillStyle = 'rgba(251, 146, 60, 0.52)';
    ctx.beginPath();
    ctx.moveTo(-10, H + 40);
    for (let x = -10; x <= W + 20; x += 18) {
      const wy = floodY - 5 + Math.sin(x * 0.032 - this.time * 3.6) * 6;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(W + 20, H + 40);
    ctx.closePath();
    ctx.fill();

    // 2. Main glossy translucent molten caramel-berry tide
    const fg = ctx.createLinearGradient(0, floodY - 8, 0, Math.max(floodY + 120, H));
    fg.addColorStop(0, 'rgba(251, 146, 60, 0.84)');
    fg.addColorStop(0.28, 'rgba(244, 63, 94, 0.88)');
    fg.addColorStop(1, 'rgba(136, 19, 55, 0.96)');
    ctx.fillStyle = fg;

    ctx.beginPath();
    ctx.moveTo(-10, H + 40);
    for (let x = -10; x <= W + 20; x += 14) {
      const wy = floodY + Math.sin(x * 0.042 + this.time * 4.5) * 6.5;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(W + 20, H + 40);
    ctx.closePath();
    ctx.fill();

    // 3. Glossy sunlit caramel foam ridge
    ctx.strokeStyle = 'rgba(255, 251, 235, 0.86)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = -10; x <= W + 20; x += 14) {
      const wy = floodY + Math.sin(x * 0.042 + this.time * 4.5) * 6.5;
      if (x === -10) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();

    // 4. Boiling soda-caramel bubbles rising along surface crest
    for (const fb of this.floodBubbles) {
      const crestY = floodY + Math.sin(fb.x * 0.042 + this.time * 4.5) * 6.5;
      const lift = ((fb.phase * 14) % 28);
      const alpha = Math.max(0, 1 - lift / 28);
      ctx.globalAlpha = alpha * 0.85;
      drawToySphere(ctx, fb.x, crestY + 6 - lift, fb.r * (0.65 + alpha * 0.35), '#fde047', {
        rimColor: '#9a3412',
        lineWidth: 1,
        bottomBounce: false,
      });
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  /* ------------------------------------------------------------ Spire HUD */
  renderSpireHUD(ctx, W, H, floor) {
    const pillX = 14;
    const pillY = 98;
    const pillW = 224;
    const pillH = 62;
    const curW = Math.round(this.cur ? this.cur.w : this.blocks[this.blocks.length - 1].w);
    const goalPct = clamp(floor / FLOOR_GOAL, 0, 1);
    const topH = floor * BH;
    const gapPx = Math.max(0, topH - this.floodH);
    const gapFloors = (gapPx / BH).toFixed(1);
    const floodDanger = gapPx < 96 && !this.dead;

    // Bottom crimson danger aura when flood is < 3 floors below
    if (floodDanger) {
      const pulse = 0.22 + 0.16 * Math.sin(this.time * 10);
      const vg = ctx.createLinearGradient(0, H - 180, 0, H);
      vg.addColorStop(0, 'rgba(244, 63, 94, 0)');
      vg.addColorStop(1, `rgba(244, 63, 94, ${pulse})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, H - 180, W, 180);
    }

    ctx.save();
    drawToyBevelRect(ctx, pillX, pillY, pillW, pillH, 14, '#0f172a', {
      depth: 3,
      rimColor: floodDanger ? '#fb7185' : '#38bdf8',
      lineWidth: 2,
      gloss: false,
    });

    ctx.fillStyle = '#3dffa2';
    ctx.font = "800 12.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText(`🏰 ROYAL SPIRE · FL ${floor}/${FLOOR_GOAL}`, pillX + 13, pillY + 18);

    ctx.fillStyle = '#f8fafc';
    ctx.font = "700 10.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.fillText(`SLAB WIDTH: ${curW}px`, pillX + 13, pillY + 33);

    const zoneName =
      floor < 12
        ? 'STREET LEVEL'
        : floor < 30
        ? 'ROOFTOPS & CHIMNEYS'
        : floor < 55
        ? 'SPUN-SUGAR CLOUDS'
        : 'COSMIC STRATOSPHERE';

    ctx.fillStyle = '#ffd166';
    ctx.font = "800 9.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.fillText(`● ${zoneName}`, pillX + 13, pillY + 46);

    // Compact goal progress track at bottom
    const barX = pillX + 13;
    const barY = pillY + 52;
    const barW = pillW - 26;
    ctx.fillStyle = '#1e293b';
    traceRoundRect(ctx, barX, barY, barW, 5, 2.5);
    ctx.fill();
    if (goalPct > 0) {
      drawToyPill(ctx, barX, barY, Math.max(8, barW * goalPct), 5, '#3dffa2', {
        lineWidth: 0,
        gloss: true,
      });
    }

    // Flood Pursuit Badge tucked cleanly below Prestige Badge on right margin
    const fw = 128;
    const fh = 28;
    const fx = W - fw - 14;
    const fy = 132;
    drawToyBevelRect(ctx, fx, fy, fw, fh, 11, floodDanger ? '#e11d48' : '#1e293b', {
      depth: 2.5,
      rimColor: floodDanger ? '#fecdd3' : '#fb923c',
      lineWidth: 1.8,
      gloss: true,
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = "800 10.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.fillText(
      floodDanger ? `⚠️ STACK UP! ${gapFloors} FL` : `🌊 TIDE: -${gapFloors} FL`,
      fx + fw * 0.5,
      fy + fh * 0.5 + 0.5,
    );

    ctx.restore();
  }

  rr(x, y, w, h, r) {
    traceRoundRect(this.ctx, x, y, w, h, r);
  }
}
