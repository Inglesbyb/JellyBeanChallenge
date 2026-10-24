import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const BH = 32;          // block height
const BASE_Y = 660;     // screen y of the first block's top at camera 0
const BASE_W = 195;
const DEPTH = 12;       // pseudo-3D perspective depth
const TOL = 7;          // perfect-drop tolerance (px)

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class TowerSlice extends Game {
  static meta = {
    id: 'tower-slice',
    title: 'Royal Spire',
    icon: '🏰',
    hint: 'TAP to drop confectionery slabs · build Beanpool’s Liver Spire into the cosmos!',
    baseLikes: 1420,
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;
    this.blocks = saved
      ? saved.blocks.map((b) => ({ ...b }))
      : [{ x: (this.W - BASE_W) / 2, w: BASE_W, hue: 210, type: 'wafer', milestone: false }];
    this.combo = saved ? saved.combo : 0;
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
      speed: Math.min(460, 185 + n * 5.2),
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

    if (Math.abs(delta) <= TOL) {
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
    ctx.font = '900 135px Outfit, system-ui, sans-serif';
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

    this.fx.render(ctx, 1);
    ctx.restore();

    // 9. Floating Combo Text Banner
    if (this.comboText > 0 && this.combo >= 2) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.comboText * 2);
      ctx.font = '900 22px Outfit, system-ui, sans-serif';
      ctx.fillStyle = '#ffe066';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 4;
      ctx.textAlign = 'center';
      const txt = `🔥 SWEET COMBO ×${this.combo}`;
      ctx.strokeText(txt, W / 2, 126);
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

    // Drifting cotton candy clouds (floors 15–60)
    for (const cl of this.clouds) {
      const cy = (cl.y + this.cam * 0.4) % (H + 200) - 100;
      ctx.fillStyle = cl.color;
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

      // Crescent Jawbreaker Moon
      ctx.fillStyle = '#ffeaa7';
      ctx.shadowColor = '#ffeaa7';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(W - 65, 110, 26, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Shadow crescent cut
      ctx.fillStyle = '#0d1b2a';
      ctx.beginPath();
      ctx.arc(W - 55, 104, 22, 0, TAU);
      ctx.fill();

      // Ringed Frosted Donut Planet
      const px = 55;
      const py = 160;
      ctx.fillStyle = '#ff70a6';
      ctx.beginPath();
      ctx.arc(px, py, 18, 0, TAU);
      ctx.fill();
      // Planet ring
      ctx.strokeStyle = 'rgba(255, 230, 109, 0.85)';
      ctx.lineWidth = 3;
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
      // Victorian Foundation Bricks
      ctx.fillStyle = '#22091c';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 3;
      ctx.fillRect(8, py, W - 16, 500);
      ctx.strokeRect(8, py, W - 16, 500);

      // Gilded foundation cornice
      const fg = ctx.createLinearGradient(8, py, W - 8, py);
      fg.addColorStop(0, '#b5179e');
      fg.addColorStop(0.5, '#ffd166');
      fg.addColorStop(1, '#b5179e');
      ctx.fillStyle = fg;
      ctx.fillRect(8, py, W - 16, 8);

      // Cobblestone gumdrop paving
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let cx = 16; cx < W - 20; cx += 22) {
        ctx.beginPath();
        ctx.arc(cx + 8, py + 22, 6, 0, TAU);
        ctx.fill();
      }

      // Cheering Jellybean Crowd at the base!
      for (const b of this.crowd) {
        const jump = Math.sin(this.time * 6 + b.phase) * 8;
        const by = py + 48 - jump;

        drawBean(ctx, b.x, by, 16, {
          color: b.color,
          walkT: this.time * 2,
          squash: jump > 0 ? 1.15 : 0.95,
          eyes: 'happy',
        });

        // Banners held by citizens
        if (b.banner && jump > 2) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#140924';
          ctx.lineWidth = 2;
          ctx.font = '800 9px Outfit, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillRect(b.x - 28, by - 26, 56, 16);
          ctx.strokeRect(b.x - 28, by - 26, 56, 16);
          ctx.fillStyle = '#140924';
          ctx.fillText(b.banner, b.x, by - 14);
          ctx.restore();
        }
      }
    }
  }

  /* ------------------------------------------------------------ Confectionery Slabs */
  drawConfectionerySlab(x, y, w, hue, type, milestone, glow = 0, moving = false, floorIndex = 0) {
    const ctx = this.ctx;
    const d = DEPTH;
    const ink = '#140924';

    ctx.save();

    // 1. Slab Colors by Confectionery Type
    let frontFill, topFill, sideFill;

    switch (type) {
      case 'wafer':
        frontFill = moving ? '#e76f51' : '#d4a373';
        topFill = '#faedcd';
        sideFill = '#99582a';
        break;
      case 'fondant':
        frontFill = `hsl(${hue}, 85%, ${moving ? 72 : 66}%)`;
        topFill = `hsl(${hue}, 90%, 86%)`;
        sideFill = `hsl(${hue}, 75%, 45%)`;
        break;
      case 'gummy':
        frontFill = `hsl(${hue}, 95%, ${moving ? 58 : 52}%)`;
        topFill = `hsl(${hue}, 100%, 78%)`;
        sideFill = `hsl(${hue}, 90%, 36%)`;
        break;
      case 'chocolate':
        frontFill = '#4a2810';
        topFill = '#854d27';
        sideFill = '#2b1704';
        break;
      case 'gold':
      default:
        frontFill = '#ffb703';
        topFill = '#ffea00';
        sideFill = '#c77d00';
        break;
    }

    // 2. Draw 3D Top Face
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + d, y - d * 0.6);
    ctx.lineTo(x + w + d, y - d * 0.6);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fillStyle = topFill;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3. Draw 3D Right Side Face
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w + d, y - d * 0.6);
    ctx.lineTo(x + w + d, y + BH - d * 0.6);
    ctx.lineTo(x + w, y + BH);
    ctx.closePath();
    ctx.fillStyle = sideFill;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 4. Draw Front Face
    ctx.fillStyle = frontFill;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.fillRect(x, y, w, BH);
    ctx.strokeRect(x, y, w, BH);

    // 5. Confectionery Texture Patterns
    if (type === 'wafer') {
      // Waffle grid crosshatch
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.2;
      for (let gx = x + 10; gx < x + w - 4; gx += 14) {
        ctx.beginPath();
        ctx.moveTo(gx, y); ctx.lineTo(gx + 6, y + BH);
        ctx.moveTo(gx + 6, y); ctx.lineTo(gx, y + BH);
        ctx.stroke();
      }
      // Cream filling stripe
      ctx.fillStyle = '#fff9ec';
      ctx.fillRect(x, y + BH * 0.42, w, 4);
      ctx.restore();
    } else if (type === 'fondant') {
      // Royal icing scalloped drips on front face
      ctx.save();
      ctx.fillStyle = '#ffffff';
      const dripW = 12;
      for (let dx = x; dx < x + w - 4; dx += dripW) {
        ctx.beginPath();
        ctx.arc(dx + dripW * 0.5, y + 5, dripW * 0.5, 0, Math.PI);
        ctx.fill();
      }
      // Rainbow sprinkles on top face
      ctx.fillStyle = '#ff0054';
      ctx.fillRect(x + 12, y - 4, 6, 2.5);
      ctx.fillStyle = '#06d6a0';
      ctx.fillRect(x + 28, y - 5, 6, 2.5);
      ctx.fillStyle = '#ffbe0b';
      ctx.fillRect(x + w - 24, y - 4, 6, 2.5);
      ctx.restore();
    } else if (type === 'gummy') {
      // Translucent glossy bubble sparkle
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 10, 6, 3, -0.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w - 18, y + 18, 3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // 6. Arched Victorian Windows with Peeking Jellybean Citizens!
    if (!moving && w >= 80 && floorIndex > 0 && floorIndex % 3 === 0) {
      const winX = x + w / 2;
      const winY = y + 7;
      const winW = 18;
      const winH = 20;

      // Window frame
      ctx.fillStyle = '#140924';
      ctx.beginPath();
      ctx.roundRect(winX - winW / 2, winY, winW, winH, [8, 8, 2, 2]);
      ctx.fill();

      // Window interior warm glow
      ctx.fillStyle = '#ffeaa7';
      ctx.beginPath();
      ctx.roundRect(winX - winW / 2 + 2, winY + 2, winW - 4, winH - 4, [6, 6, 1, 1]);
      ctx.fill();

      // Tiny peeking jellybean face
      const beanColor = ['#3dffa2', '#ff4d6d', '#4cc9f0', '#ff9f1c'][floorIndex % 4];
      ctx.fillStyle = beanColor;
      ctx.beginPath();
      ctx.arc(winX, winY + 12, 5, 0, TAU);
      ctx.fill();

      // Cartoon eyes
      ctx.fillStyle = '#140924';
      ctx.beginPath();
      ctx.arc(winX - 2, winY + 11, 1.2, 0, TAU);
      ctx.arc(winX + 2, winY + 11, 1.2, 0, TAU);
      ctx.fill();
    }

    // 7. Milestone Balcony Decorative Cornices (Liver-Bird Statues!)
    if (milestone) {
      ctx.save();
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 2;

      // Golden Liver-Bird finial on the left
      this.drawMiniLiverBird(ctx, x - 2, y - 8);
      // Golden Liver-Bird finial on the right
      this.drawMiniLiverBird(ctx, x + w + 2, y - 8);

      // Gilded balcony railing dots
      for (let rx = x + 10; rx < x + w - 6; rx += 12) {
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        ctx.arc(rx, y + 4, 2.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Specular top glint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x, y, w, 3);

    // Perfect Drop Golden Glow Burst
    if (glow > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${glow * 0.75})`;
      ctx.fillRect(x, y, w, BH);
    }

    ctx.restore();
  }

  drawMiniLiverBird(ctx, bx, by) {
    // Stylized golden Liver-Bird mascot finial
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, TAU); // head
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(bx, by + 6, 4, 7, 0, 0, TAU); // body
    ctx.fill(); ctx.stroke();
    // Seaweed leaf in beak
    ctx.fillStyle = '#3dffa2';
    ctx.beginPath();
    ctx.arc(bx + 4, by - 2, 2, 0, TAU);
    ctx.fill();
  }

  /* ------------------------------------------------------------ Crumb Particles */
  renderCrumbs(ctx) {
    for (const c of this.crumbs) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 1.2;

      if (c.isSprinkle) {
        ctx.fillRect(-c.s, -c.s * 0.4, c.s * 2, c.s * 0.8);
        ctx.strokeRect(-c.s, -c.s * 0.4, c.s * 2, c.s * 0.8);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, c.s * 0.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
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

    // Jumping acrobatics on perfect drops
    const jumpY = this.glow > 0 ? Math.sin(this.glow * Math.PI) * 28 : 0;
    const flipRot = this.glow > 0 ? (1 - this.glow) * TAU : 0;
    const by = this.slotY(n - 1) - 18 - jumpY;

    // Wobble angle when the tower platform is precariously narrow
    const wobbleAngle = isWobbly && !isDead ? Math.sin(this.time * 12) * 0.28 : 0;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(flipRot + wobbleAngle);

    drawBean(ctx, 0, 0, 24, {
      color: '#25e6ff',
      bellyColor: '#ff758f',
      squash: this.glow > 0 ? 1.28 : isWobbly ? 0.92 : 1,
      hat: this.combo >= 2 ? 'crown' : null,
      walkT: this.time * 3,
      eyes: isDead ? 'squish' : this.combo >= 2 ? 'happy' : isWobbly ? 'wink' : 'happy',
    });

    // Cartoon sweat drops when wobbling on a narrow slab
    if (isWobbly && !isDead) {
      ctx.fillStyle = '#4cc9f0';
      ctx.font = '800 12px Outfit, system-ui, sans-serif';
      ctx.fillText('💦', 14, -12);
      ctx.fillText('💦', -18, -10);
    }

    // Cartoon umbrella when tumbling during Game Over
    if (isDead && this.mascotUmbrella) {
      ctx.save();
      ctx.strokeStyle = '#140924';
      ctx.lineWidth = 2.5;
      // Umbrella stick
      ctx.beginPath();
      ctx.moveTo(8, -12);
      ctx.lineTo(14, -36);
      ctx.stroke();
      // Cocktail umbrella dome
      ctx.fillStyle = '#ff0054';
      ctx.beginPath();
      ctx.arc(14, -36, 18, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------ Spire HUD */
  renderSpireHUD(ctx, W, H, floor) {
    const pillX = 14;
    const pillY = 76;
    const curW = Math.round(this.cur ? this.cur.w : this.blocks[this.blocks.length - 1].w);

    ctx.save();
    ctx.fillStyle = 'rgba(20, 9, 36, 0.85)';
    ctx.strokeStyle = '#140924';
    ctx.lineWidth = 2.5;
    this.rr(pillX, pillY, 215, 50, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#3dffa2';
    ctx.font = '800 12.5px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`🏰 ROYAL SPIRE · FL ${floor}`, pillX + 14, pillY + 18);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 10.5px Outfit, system-ui, sans-serif';
    ctx.fillText(`SLAB WIDTH: ${curW}px`, pillX + 14, pillY + 32);

    const zoneName =
      floor < 12
        ? 'STREET LEVEL'
        : floor < 30
        ? 'ROOFTOPS & CHIMNEYS'
        : floor < 55
        ? 'SPUN-SUGAR CLOUDS'
        : 'COSMIC STRATOSPHERE';

    ctx.fillStyle = '#ffd166';
    ctx.font = '800 9.5px Outfit, system-ui, sans-serif';
    ctx.fillText(`● ${zoneName}`, pillX + 14, pillY + 44);
    ctx.restore();
  }

  rr(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
}
