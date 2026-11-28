import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import {
  STYLE_TOKENS,
  preloadWeeblAtlas,
  drawSprite,
  drawSunburst,
  drawComicPanel,
  drawComicStarburst,
  drawComicText,
  drawWeeblCelBean,
  drawHeroCharacter,
} from './weeblAtlas.js';

const BH = 32;          // block height
const BASE_Y = 660;     // screen y of the first block's top at camera 0
const BASE_W = 195;
const DEPTH = 12;       // pseudo-3D perspective depth
const TOL = 7;          // perfect-drop tolerance (px)
const FLOOR_GOAL = 50;  // spire height that completes the stage (Space Apex)

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SPIRE_ZONES = [
  { name: 'TOY COURTYARD',   minFloor: 0,  skyTop: '#2563eb', skyMid: '#38bdf8', skyBot: '#fde68a', accent: '#4ade80' },
  { name: 'ROYAL ROOFTOPS',  minFloor: 12, skyTop: '#1d4ed8', skyMid: '#7c3aed', skyBot: '#fb7185', accent: '#facc15' },
  { name: 'CANDY CLOUDS',    minFloor: 30, skyTop: '#0284c7', skyMid: '#ec4899', skyBot: '#fef08a', accent: '#f472b6' },
  { name: 'STARLIT APEX',    minFloor: 45, skyTop: '#0f172a', skyMid: '#312e81', skyBot: '#6d28d9', accent: '#38bdf8' },
];

function lerpColor(hexA, hexB, t) {
  const f = clamp(t, 0, 1);
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - f) + ((b >> 16) & 255) * f);
  const g = Math.round(((a >> 8) & 255) * (1 - f) + ((b >> 8) & 255) * f);
  const bl = Math.round((a & 255) * (1 - f) + (b & 255) * f);
  return `rgb(${r}, ${g}, ${bl})`;
}

function getSpireZone(floor) {
  let idx = 0;
  for (let i = 1; i < SPIRE_ZONES.length; i++) {
    if (floor >= SPIRE_ZONES[i].minFloor) idx = i;
  }
  const cur = SPIRE_ZONES[idx];
  const next = SPIRE_ZONES[idx + 1];
  if (!next) return cur;
  const blendStart = next.minFloor - 4;
  if (floor <= blendStart) return cur;
  const t = clamp((floor - blendStart) / 6, 0, 1);
  return {
    name: floor >= next.minFloor ? next.name : cur.name,
    accent: floor >= next.minFloor ? next.accent : cur.accent,
    skyTop: lerpColor(cur.skyTop, next.skyTop, t),
    skyMid: lerpColor(cur.skyMid, next.skyMid, t),
    skyBot: lerpColor(cur.skyBot, next.skyBot, t),
  };
}

function getSlabPalette(type, hue, moving) {
  switch (type) {
    case 'wafer':
      return {
        front: moving ? '#fb923c' : '#f59e0b',
        top: '#fef3c7',
        side: '#b45309',
      };
    case 'fondant':
      return {
        front: `hsl(${hue}, 86%, ${moving ? 66 : 60}%)`,
        top: `hsl(${hue}, 92%, 82%)`,
        side: `hsl(${hue}, 78%, 40%)`,
      };
    case 'gummy':
      return {
        front: `hsl(${hue}, 94%, ${moving ? 56 : 50}%)`,
        top: `hsl(${hue}, 100%, 76%)`,
        side: `hsl(${hue}, 88%, 34%)`,
      };
    case 'chocolate':
      return {
        front: moving ? '#92400e' : '#78350f',
        top: '#d97706',
        side: '#451a03',
      };
    case 'gold':
    default:
      return {
        front: '#facc15',
        top: '#fef08a',
        side: '#ca8a04',
      };
  }
}

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
    preloadWeeblAtlas();
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

    // Comic stars and floating sugar sparkles (most prominent at high altitude)
    this.stars = Array.from({ length: 34 }, (_, i) => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      s: 2.2 + Math.random() * 3.4,
      d: 0.15 + Math.random() * 0.75,
      sparkle: Math.random() * TAU,
      isCross: i % 3 === 0,
    }));

    // Floating Weebl Flash clouds (`cloud_1` / `cloud_2` sprites positioned clear of top status bar)
    this.clouds = Array.from({ length: 5 }, (_, i) => {
      const w = 106 + (i % 3) * 24;
      return {
        id: i % 2 === 0 ? 'cloud_1' : 'cloud_2',
        x: ((i * 97 + 68) % (this.W - 40)) + 20,
        y: 38 + i * 142,
        w,
        h: Math.round(w * 0.59),
        speed: (i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 4),
      };
    });

    // Candy-striped mid-altitude hot-air balloons
    this.balloons = [
      { x: 64,  y: 64,  speed: 14,  bob: 0.4, colA: '#fb7185', colB: '#fef08a' },
      { x: 368, y: 260, speed: -11, bob: 2.1, colA: '#38bdf8', colB: '#ffffff' },
      { x: 210, y: 455, speed: 9,   bob: 4.0, colA: '#a855f7', colB: '#4ade80' },
    ];

    // Courtyard cheering spectators positioned clear of #adminDock (bottom-left) and red carpet
    this.crowd = [
      { x: 48,  yOff: 2,  color: '#fb7185', shade: '#be123c', banner: 'UP! 🎈', phase: 0.3 },
      { x: 98,  yOff: 2,  color: '#facc15', shade: '#ca8a04', banner: null,     phase: 1.9 },
      { x: 318, yOff: 44, color: '#38bdf8', shade: '#0369a1', banner: null,     phase: 3.1 },
      { x: 368, yOff: 44, color: '#a855f7', shade: '#6b21a8', banner: 'HIGHER!', phase: 4.4 },
      { x: 416, yOff: 44, color: '#4ade80', shade: '#15803d', banner: null,     phase: 5.5 },
    ];

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

    // Update clouds & gentle hot-air balloons
    for (const cl of this.clouds) {
      cl.x += cl.speed * dt;
      if (cl.x > this.W + 120) cl.x = -120;
      if (cl.x < -120) cl.x = this.W + 120;
    }
    if (this.balloons) {
      for (const bl of this.balloons) {
        bl.x += bl.speed * dt;
        bl.bob += dt * 1.9;
        if (bl.x > this.W + 46) bl.x = -46;
        if (bl.x < -46) bl.x = this.W + 46;
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
      if (isMilestone) {
        this.sounds.powerup?.();
        this.fx.shake(6, 0.16);
      } else if (this.combo >= 3) {
        this.fx.shake(3.5, 0.12);
      }
      this.fx.burst(top.x + top.w / 2, y, '#ffe066', isMilestone ? 20 : 12, 180, 0.45, 3.5);
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
      this.fx.shake(2.5, 0.1);
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

    // 1. Dynamic Weebl Parallax Sky Palette (Courtyard -> Rooftops -> Clouds -> Starlit Apex)
    this.renderSky(ctx, W, H, floor);

    const off = this.fx.offset();
    ctx.save();
    ctx.translate(off.x, off.y);

    // 2. Courtyard Pedestal: Royal Terrace Deck & Cheering Crowd (above #adminDock)
    this.renderGroundPedestal(ctx, W);

    // 3. Render Tower Slabs (Bottom-up with gentle height sway)
    for (let i = 0; i < n; i++) {
      const y = this.slotY(i);
      if (y > H + 60 || y < -80) continue;
      const b = this.blocks[i];
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

    // 4. Active Moving Slab & Snap-Tolerance Alignment Brackets
    if (this.cur) {
      const c = this.cur;
      const top = this.blocks[n - 1];
      const curY = this.slotY(n);
      const tol = this.diff.snapTolerance ?? TOL;
      const inSnap = Math.abs(c.x - top.x) <= tol;

      ctx.save();
      ctx.strokeStyle = inSnap ? '#facc15' : 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = inSnap ? 3.0 : 2.0;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(top.x, curY + BH);
      ctx.lineTo(top.x, curY - 46);
      ctx.moveTo(top.x + top.w, curY + BH);
      ctx.lineTo(top.x + top.w, curY - 46);
      ctx.stroke();
      ctx.setLineDash([]);

      // Bold inked corner chevrons highlighting snap boundaries
      ctx.fillStyle = inSnap ? '#facc15' : '#38bdf8';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2;
      for (const gx of [top.x, top.x + top.w]) {
        ctx.beginPath();
        ctx.moveTo(gx - 5, curY - 52);
        ctx.lineTo(gx + 5, curY - 52);
        ctx.lineTo(gx, curY - 44);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      this.drawConfectionerySlab(c.x, curY, c.w, c.hue, c.type, c.milestone, 0, true, n);
    }

    // 5. Tumbling Sliced-off Slab Chunks
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

    // 6. #000-Inked Crumb Particles & Sprinkles
    this.renderCrumbs(ctx);

    // 7. Crowned Green Hero Bean Acrobat
    this.renderMascot(ctx, n);

    // 8. Opaque #000-Inked Molten Caramel-Magma Tide
    this.renderCaramelFlood(ctx, W, H);

    this.fx.render(ctx, 1);
    ctx.restore();

    // 9. Unobstructed Floating Combo Banner below Top HUD Cards (`y = 166`)
    if (this.comboText > 0 && this.combo >= 2) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.comboText * 2);
      const cw = 196;
      const ch = 32;
      const fill = this.combo >= 4 ? '#ec4899' : '#f59e0b';
      drawComicPanel(ctx, W / 2 - cw / 2, 164, cw, ch, 12, fill, {
        lineWidth: 2.8,
        shadowDx: 2,
        shadowDy: 3,
      });
      const txt = this.combo >= 4 ? `👑 GOLDEN COMBO ×${this.combo}!` : `🔥 PERFECT ×${this.combo}!`;
      drawComicText(ctx, txt, W / 2, 180, "900 14.5px 'Fredoka', 'Outfit', sans-serif", '#fef08a', {
        strokeWidth: 3.8,
      });
      ctx.restore();
    }

    // 10. Simplified 2-Card Comic HUD
    this.renderSpireHUD(ctx, W, H, floor);
  }

  /* ------------------------------------------------------------ Weebl Environment Sky */
  renderSky(ctx, W, H, floor) {
    const zone = getSpireZone(floor);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, zone.skyTop);
    g.addColorStop(0.55, zone.skyMid);
    g.addColorStop(1, zone.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Subtle Weebl Sunburst radiance behind early/mid climbs
    if (floor < 44) {
      const sunAlpha = clamp(0.24 * (1 - floor / 44), 0.04, 0.24);
      const sunY = clamp(520 + this.cam * 0.28, 220, H + 120);
      drawSunburst(ctx, W / 2, sunY, 340, this.time * 0.06, 12, sunAlpha, false);
    }

    // Starlight & #000-inked comic starburst sparkles ramping gently from dusk into apex
    const starVis = floor >= 28 ? Math.min(1, 0.25 + (floor - 28) / 16) : floor >= 15 ? clamp((floor - 15) / 14, 0, 0.24) : 0;
    if (starVis > 0) {
      for (const s of this.stars) {
        const sy = ((s.y + this.cam * s.d * 0.22) % H + H) % H;
        const pulse = 0.65 + Math.sin(s.sparkle) * 0.35;
        ctx.save();
        ctx.globalAlpha = starVis * pulse;
        if (s.isCross) {
          drawComicStarburst(ctx, s.x, sy, s.s * 2.1, s.s * 0.8, 4, '#fef08a', STYLE_TOKENS.ink, s.sparkle * 0.1, 1.4);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(s.x, sy, s.s * 0.55, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // Distant mid-altitude royal ridge silhouette (keeps horizon lush past floor 12)
    if (floor >= 4 && floor < 36) {
      const ridgeFade = floor > 28 ? clamp(1 - (floor - 28) / 8, 0, 1) : clamp((floor - 4) / 6, 0, 1);
      const ridgeY = clamp(650 + this.cam * 0.14, 520, H + 40);
      ctx.save();
      ctx.globalAlpha = ridgeFade * 0.42;
      ctx.fillStyle = '#312e81';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-10, H + 20);
      ctx.lineTo(-10, ridgeY + 24);
      ctx.lineTo(42, ridgeY - 6);
      ctx.lineTo(86, ridgeY + 20);
      ctx.lineTo(132, ridgeY - 18);
      ctx.lineTo(176, ridgeY + 18);
      ctx.lineTo(225, ridgeY - 26);
      ctx.lineTo(274, ridgeY + 18);
      ctx.lineTo(324, ridgeY - 12);
      ctx.lineTo(372, ridgeY + 22);
      ctx.lineTo(418, ridgeY - 4);
      ctx.lineTo(W + 10, ridgeY + 20);
      ctx.lineTo(W + 10, H + 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Crisp #000-outlined Weebl toy-town rooftops & castle spires near ground
    const roofY = BASE_Y + this.cam - 125;
    if (roofY < H + 140 && roofY > -160) {
      // Back rolling green hills
      ctx.fillStyle = '#4ade80';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-10, H + 20);
      ctx.lineTo(-10, roofY + 55);
      ctx.quadraticCurveTo(100, roofY + 25, 225, roofY + 50);
      ctx.quadraticCurveTo(350, roofY + 20, W + 10, roofY + 52);
      ctx.lineTo(W + 10, H + 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Silhouetted storybook slate-indigo castle & gabled rooftops with #000 contour
      ctx.fillStyle = '#312e81';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-8, H + 20);
      ctx.lineTo(-8, roofY + 58);
      ctx.lineTo(28, roofY + 58);
      ctx.lineTo(54, roofY + 28);
      ctx.lineTo(80, roofY + 58);
      ctx.lineTo(118, roofY + 58);
      ctx.lineTo(136, roofY + 12);
      ctx.lineTo(154, roofY + 58);
      ctx.lineTo(192, roofY + 58);
      ctx.lineTo(208, roofY - 10);
      ctx.lineTo(225, roofY - 58); // Royal Spire distant pinnacle
      ctx.lineTo(242, roofY - 10);
      ctx.lineTo(258, roofY + 58);
      ctx.lineTo(318, roofY + 58);
      ctx.lineTo(344, roofY + 22);
      ctx.lineTo(370, roofY + 58);
      ctx.lineTo(410, roofY + 34);
      ctx.lineTo(W + 8, roofY + 56);
      ctx.lineTo(W + 8, H + 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Crisp Flash clouds (`cloud_1` / `cloud_2` sprites kept cleanly below top HUD bar)
    const cloudBandH = H - 90;
    for (const cl of this.clouds) {
      const cy = 165 + (((cl.y + this.cam * 0.35) % cloudBandH) + cloudBandH) % cloudBandH;
      drawSprite(ctx, cl.id, cl.x, cy, cl.w, cl.h, {
        fallback: (cctx, w, h) => {
          cctx.fillStyle = '#ffffff';
          cctx.strokeStyle = STYLE_TOKENS.ink;
          cctx.lineWidth = 2.6;
          cctx.beginPath();
          cctx.arc(-w * 0.22, 4, h * 0.30, Math.PI * 0.5, Math.PI * 1.55);
          cctx.arc(0, -h * 0.08, h * 0.40, Math.PI * 1.05, Math.PI * 1.95);
          cctx.arc(w * 0.24, 4, h * 0.28, Math.PI * 1.45, Math.PI * 0.5);
          cctx.closePath();
          cctx.fill();
          cctx.stroke();
        },
      });
    }

    // Drifting #000-inked Candy Hot-Air Balloons cleanly foregrounded over clouds
    if (this.balloons && floor >= 6 && floor < 42) {
      const bAlpha = floor < 10 ? (floor - 6) / 4 : floor > 36 ? 1 - (floor - 36) / 6 : 1;
      ctx.save();
      ctx.globalAlpha = clamp(bAlpha, 0, 1);
      for (const bl of this.balloons) {
        const by = 185 + (((bl.y + this.cam * 0.24) % (H - 140)) + (H - 140)) % (H - 140) + Math.sin(bl.bob) * 5;
        ctx.save();
        ctx.translate(bl.x, by);
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-6, 9); ctx.lineTo(-4.5, 19);
        ctx.moveTo(6, 9); ctx.lineTo(4.5, 19);
        ctx.stroke();
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.roundRect(-6.5, 18, 13, 8.5, 2.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = bl.colA;
        ctx.beginPath();
        ctx.arc(0, -4, 15, Math.PI, 0);
        ctx.lineTo(8, 11);
        ctx.lineTo(-8, 11);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = bl.colB;
        ctx.beginPath();
        ctx.ellipse(0, -1, 6, 14, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -4, 15, Math.PI, 0);
        ctx.lineTo(8, 11);
        ctx.lineTo(-8, 11);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // Cosmic Moon & Frosted Donut Planet at Upper Altitude (`floor >= 34`)
    if (floor >= 34) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (floor - 34) / 11);

      // Inked Sky Moon (`sky_moon` atlas sprite with crisp cel vector fallback)
      drawSprite(ctx, 'sky_moon', W - 64, 210, 56, 58, {
        fallback: (mctx, mw) => {
          mctx.fillStyle = '#fde047';
          mctx.strokeStyle = STYLE_TOKENS.ink;
          mctx.lineWidth = 2.6;
          mctx.beginPath();
          mctx.arc(0, 0, mw * 0.44, 0, TAU);
          mctx.fill();
          mctx.stroke();
        },
      });

      // #000-Inked Ringed Donut Planet
      const px = 62;
      const py = 236;
      ctx.fillStyle = '#f472b6';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(px, py, 20, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(px, py, 35, 9, -0.32, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ Weebl Royal Courtyard Pedestal */
  renderGroundPedestal(ctx, W) {
    const py = this.slotY(0) + BH;
    if (py >= this.H + 120) return;

    ctx.save();
    // Cream stone terrace apron + cel shadow plinth
    ctx.fillStyle = '#d6d3d1';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3;
    ctx.fillRect(6, py + 12, W - 12, 500);
    ctx.strokeRect(6, py + 12, W - 12, 500);

    // Plaza cream paver top trim
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(6, py, W - 12, 16);
    ctx.strokeRect(6, py, W - 12, 16);

    // Royal crimson runner carpet under Slab #0
    const carpW = 140;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(W / 2 - carpW / 2, py + 16, carpW, 74);
    ctx.strokeRect(W / 2 - carpW / 2, py + 16, carpW, 74);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(W / 2 - carpW / 2 + 6, py + 16, 4, 74);
    ctx.fillRect(W / 2 + carpW / 2 - 10, py + 16, 4, 74);

    // Decorative #000-inked battlements / corner hedges flanking base slab
    drawSprite(ctx, 'p_stone_battlement', 76, py + 4, 96, 36, {
      fallback: (bctx, bw, bh) => {
        bctx.fillStyle = '#cbd5e1';
        bctx.strokeStyle = STYLE_TOKENS.ink;
        bctx.lineWidth = 2.4;
        bctx.fillRect(-bw * 0.45, -bh * 0.3, bw * 0.9, bh * 0.7);
        bctx.strokeRect(-bw * 0.45, -bh * 0.3, bw * 0.9, bh * 0.7);
      },
    });
    drawSprite(ctx, 'p_stone_battlement', W - 76, py + 4, 96, 36, {
      fallback: () => {},
    });

    // Cheering Hero-styled Weebl Courtyard fans arranged clear of #adminDock & carpet
    for (const b of this.crowd) {
      const jump = Math.max(0, Math.sin(this.time * 6.5 + b.phase)) * 6;
      const baseFootY = py + b.yOff;
      const by = baseFootY - jump;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(b.x, baseFootY + 2, 10, 3.4, 0, 0, TAU);
      ctx.fill();

      this.drawCitizenBean(ctx, b.x, by, 26, b.color, b.shade, this.time + b.phase, jump > 2);
    }

    // Second pass for fan banners so no neighbor overlaps the sign text
    for (const b of this.crowd) {
      if (!b.banner) continue;
      const jump = Math.max(0, Math.sin(this.time * 6.5 + b.phase)) * 6;
      const by = py + b.yOff - jump;
      drawComicPanel(ctx, b.x - 31, by - 44, 62, 17, 5, '#ffffff', {
        lineWidth: 2.0,
        shadowDx: 1.5,
        shadowDy: 2,
        glossTop: false,
      });
      drawComicText(ctx, b.banner, b.x, by - 35.5, "900 8.5px 'Fredoka', 'Outfit', sans-serif", '#0f172a', {
        stroke: '#ffffff',
        strokeWidth: 0,
      });
    }
    ctx.restore();
  }

  drawCitizenBean(ctx, x, y, h, color, shade, waveT, jumping = false) {
    const s = h / 44;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (jumping ? 0.94 : 1.02), s * (jumping ? 1.08 : 0.98));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Cheering mitten arms
    const armL = Math.sin(waveT * 8.2) * 0.35 - 0.85;
    const armR = Math.cos(waveT * 7.8) * 0.35 - 0.55;
    for (const [dir, ang] of [[-1, armL], [1, armR]]) {
      ctx.save();
      ctx.translate(dir * 13, -24);
      ctx.rotate(dir * ang);
      ctx.fillStyle = color;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(0, -2.5);
      ctx.quadraticCurveTo(dir * 9, -6, dir * 13, -11);
      ctx.arc(dir * 13, -11, 3.8, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Chunky cartoon shoes
    ctx.fillStyle = shade;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.0;
    for (const lx of [-7, 7]) {
      ctx.beginPath();
      ctx.ellipse(lx, -2.5, 6.2, 3.5, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Crisp upright kidney-bean torso matching hero-bean-map craftsmanship
    const traceBody = () => {
      ctx.beginPath();
      ctx.roundRect(-14, -42, 28, 37, 14);
    };
    traceBody();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.save();
    ctx.clip();
    // Bottom-right cel shadow rim
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(12, -22, 11, 22, -0.08, 0, TAU);
    ctx.fill();
    // Crisp top-left highlight glint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.beginPath();
    ctx.ellipse(-6.5, -35.5, 4.2, 2.2, -0.35, 0, TAU);
    ctx.fill();
    ctx.restore();

    traceBody();
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.4;
    ctx.stroke();

    // Expressive arched brows + twin touching white sclera eyes
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-8.5, -33.5); ctx.quadraticCurveTo(-5, -36, -1.5, -33.5);
    ctx.moveTo(1.5, -33.5);  ctx.quadraticCurveTo(5, -36, 8.5, -33.5);
    ctx.stroke();

    for (const ex of [-4.4, 4.6]) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(ex, -27.5, 4.6, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath();
      ctx.arc(ex, -27.2, 1.9, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + 0.7, -28.1, 0.75, 0, TAU);
      ctx.fill();
    }

    // D-shaped cheering mouth with teeth bar & tongue
    ctx.beginPath();
    ctx.moveTo(-7, -20.5);
    ctx.quadraticCurveTo(0, -19.2, 7, -20.5);
    ctx.quadraticCurveTo(5.5, -12, 0, -12);
    ctx.quadraticCurveTo(-5.5, -12, -7, -20.5);
    ctx.closePath();
    ctx.fillStyle = '#7f1d1d';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-7.5, -21, 15, 2.8);
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.ellipse(0, -13, 3.8, 2.2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.1;
    ctx.stroke();

    ctx.restore();
  }

  /* ------------------------------------------------------------ #000-Inked Weebl Confectionery Slabs */
  drawConfectionerySlab(x, y, w, hue, type, milestone, glow = 0, moving = false, floorIndex = 0) {
    const ctx = this.ctx;
    const d = DEPTH;
    const pal = getSlabPalette(type, hue, moving);
    const outerInk = w < 24 ? 2.2 : 3.0;
    const innerInk = w < 24 ? 1.5 : 2.1;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. 3D Extruded Faces (Flat cel colors for crisp Weebl readability)
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + d, y - d * 0.6);
    ctx.lineTo(x + w + d, y - d * 0.6);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fillStyle = pal.top;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w + d, y - d * 0.6);
    ctx.lineTo(x + w + d, y + BH - d * 0.6);
    ctx.lineTo(x + w, y + BH);
    ctx.closePath();
    ctx.fillStyle = pal.side;
    ctx.fill();

    ctx.fillStyle = pal.front;
    ctx.fillRect(x, y, w, BH);

    // Subtle 2-tone cel bottom shadow strip inside front face
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.fillRect(x, y + BH - 6, w, 6);

    // 2. Confectionery Cel Patterns (wrapped cleanly onto 3D right & top faces)
    if (type === 'wafer') {
      ctx.save();
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.36)';
      ctx.lineWidth = 1.6;
      for (let gx = x + 10; gx < x + w - 6; gx += 16) {
        ctx.beginPath();
        ctx.moveTo(gx, y + 1); ctx.lineTo(gx + 7, y + BH - 1);
        ctx.moveTo(gx + 7, y + 1); ctx.lineTo(gx, y + BH - 1);
        ctx.stroke();
      }
      // Subtle top biscuit cross score lines
      for (let tx = x + 16; tx < x + w - 6; tx += 22) {
        ctx.beginPath();
        ctx.moveTo(tx, y);
        ctx.lineTo(tx + d, y - d * 0.6);
        ctx.stroke();
      }
      // Front cream wafer filling + angled 3D side continuation
      const bandY = y + BH * 0.41;
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(x, bandY, w, 5.5);
      ctx.beginPath();
      ctx.moveTo(x + w, bandY);
      ctx.lineTo(x + w + d, bandY - d * 0.6);
      ctx.lineTo(x + w + d, bandY + 5.5 - d * 0.6);
      ctx.lineTo(x + w, bandY + 5.5);
      ctx.closePath();
      ctx.fillStyle = '#fde68a';
      ctx.fill();
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, bandY); ctx.lineTo(x + w, bandY); ctx.lineTo(x + w + d, bandY - d * 0.6);
      ctx.moveTo(x, bandY + 5.5); ctx.lineTo(x + w, bandY + 5.5); ctx.lineTo(x + w + d, bandY + 5.5 - d * 0.6);
      ctx.stroke();
      ctx.restore();
    } else if (type === 'fondant') {
      ctx.save();
      // White frosting bevel cap on top face + thick icing rim on right side
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + d, y - d * 0.6);
      ctx.lineTo(x + w + d, y - d * 0.6);
      ctx.lineTo(x + w, y);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w + d, y - d * 0.6);
      ctx.lineTo(x + w + d, y + 6 - d * 0.6);
      ctx.lineTo(x + w, y + 6);
      ctx.closePath();
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      const dripW = 14;
      for (let dx = x + 1; dx < x + w - 4; dx += dripW) {
        const span = Math.min(dripW, x + w - dx);
        ctx.beginPath();
        ctx.arc(dx + span * 0.5, y + 1, span * 0.5, 0, Math.PI);
        ctx.fill();
        ctx.stroke();
      }
      if (w >= 24) {
        const sprinkleCols = ['#ef4444', '#22c55e', '#facc15'];
        const count = w >= 48 ? 3 : 2;
        for (let si = 0; si < count; si++) {
          const sx = count === 3 ? x + 14 + si * ((w - 28) * 0.5) : x + 9 + si * (w - 18);
          ctx.fillStyle = sprinkleCols[si];
          ctx.strokeStyle = STYLE_TOKENS.ink;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(sx - 4, y - 5.5, 9, 4, 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    } else if (type === 'gummy') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3.5, y + 4.5, Math.max(0, w - 7), BH - 9);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.beginPath();
      ctx.ellipse(x + Math.min(18, w * 0.32), y + 9.5, Math.min(8, w * 0.22), 3.4, -0.18, 0, TAU);
      ctx.fill();
      if (w >= 48) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + w - 14, y + 11, 2.2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    } else if (type === 'chocolate') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.lineWidth = 1.6;
      for (let cx = x + 16; cx < x + w - 8; cx += 24) {
        ctx.beginPath();
        ctx.roundRect(cx - 8, y + 6, 16, BH - 12, 3);
        ctx.fill();
        ctx.stroke();
      }
      // Wrapping chocolate glaze seam on side face
      ctx.fillStyle = 'rgba(217, 119, 6, 0.45)';
      ctx.fillRect(x + 2, y + 1, Math.max(0, w - 4), 4);
      ctx.restore();
    } else if (type === 'gold') {
      ctx.save();
      // Diagonal metallic sheen stripe on golden royal blocks
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.22, y + 2);
      ctx.lineTo(x + w * 0.36, y + 2);
      ctx.lineTo(x + w * 0.24, y + BH - 4);
      ctx.lineTo(x + w * 0.10, y + BH - 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Specular white highlight band along top-front bevel
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(x + 2, y + 1.5, Math.max(0, w - 4), 3);

    // 3. Crisp Inner Face Divider Seams
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = innerInk;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y);
    ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + BH);
    ctx.moveTo(x + w, y); ctx.lineTo(x + w + d, y - d * 0.6);
    ctx.stroke();

    // 4. Bold #000000 Outer Contour Silhouette around entire 2.5D prism
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = outerInk;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + d, y - d * 0.6);
    ctx.lineTo(x + w + d, y - d * 0.6);
    ctx.lineTo(x + w + d, y + BH - d * 0.6);
    ctx.lineTo(x + w, y + BH);
    ctx.lineTo(x, y + BH);
    ctx.closePath();
    ctx.stroke();

    // 5. #000-Inked Arched Royal Windows (kept crisp down to slender slabs)
    if (!moving && w >= 40 && floorIndex > 0 && floorIndex % 3 === 0) {
      const winX = x + w / 2;
      const winY = y + 6;
      const winW = Math.min(19, Math.max(13, w * 0.34));
      const winH = 21;

      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(winX - winW / 2, winY, winW, winH, [8, 8, 2, 2]);
      ctx.fill();
      ctx.stroke();

      const peekCol = ['#22c55e', '#fb7185', '#38bdf8', '#f97316'][floorIndex % 4];
      ctx.fillStyle = peekCol;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(winX, winY + 15, winW * 0.29, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath();
      ctx.arc(winX - winW * 0.11, winY + 12.2, 1.1, 0, TAU);
      ctx.arc(winX + winW * 0.11, winY + 12.2, 1.1, 0, TAU);
      ctx.fill();
    }

    // 6. Milestone Royal Balcony Pennant Finials & Golden Rivets
    if (milestone) {
      this.drawMiniLiverBird(ctx, x - 1, y - 2, -1);
      this.drawMiniLiverBird(ctx, x + w + 1, y - 2, 1);

      for (let rx = x + 10; rx < x + w - 8; rx += 14) {
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(rx, y + 5, 3.0, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Perfect Drop Flash
    if (glow > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${glow * 0.72})`;
      ctx.fillRect(x, y, w, BH);
    }

    ctx.restore();
  }

  drawMiniLiverBird(ctx, bx, by, dir = 1) {
    // Crisp #000-inked golden castle finial post & fluttering crimson pennant
    const wave = Math.sin(this.time * 7 + bx * 0.1) * 2.5;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(bx, by + 2);
    ctx.lineTo(bx, by - 16);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(bx, by - 15);
    ctx.lineTo(bx + dir * 13, by - 11 + wave);
    ctx.lineTo(bx, by - 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(bx, by - 17, 3.6, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  /* ------------------------------------------------------------ #000-Inked Crumb Particles */
  renderCrumbs(ctx) {
    for (const c of this.crumbs) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;

      if (c.isSprinkle) {
        ctx.beginPath();
        ctx.roundRect(-c.s, -c.s * 0.45, c.s * 2, c.s * 0.9, c.s * 0.45);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2, c.s * 0.6), 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ Crowned Green Hero Acrobat */
  renderMascot(ctx, n) {
    if (n <= 0) return;

    const top = this.blocks[n - 1];
    const bx = top.x + top.w / 2;
    const isWobbly = top.w < 68;
    const isDead = this.dead;
    const floodGap = (n - 1) * BH - this.floodH;
    const nearFlood = !isDead && floodGap < 95;

    const jumpY = this.glow > 0 ? Math.sin(this.glow * Math.PI) * 28 : nearFlood ? Math.abs(Math.sin(this.time * 16)) * 3.5 : 0;
    const flipRot = this.glow > 0 ? (1 - this.glow) * TAU : 0;
    const slabTopY = this.slotY(n - 1);
    const by = slabTopY - jumpY;

    // Grounding shadow on top of the active slab
    if (!isDead) {
      const shScale = clamp(1 - jumpY * 0.018, 0.45, 1);
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(bx, slabTopY + 1, 15 * shScale, 4.5 * shScale, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Celebratory spinning sunburst behind Hero during active Perfect combo glow or warm alarm glow
    if (this.glow > 0.15) {
      drawSunburst(ctx, bx, by - 24, 34 * this.glow, this.time * 7, 9, this.glow * 0.7, false);
    } else if (nearFlood) {
      ctx.save();
      ctx.globalAlpha = 0.32 + 0.18 * Math.sin(this.time * 14);
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(bx, by - 24, 29, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    const wobbleAngle = (isWobbly || nearFlood) && !isDead
      ? Math.sin(this.time * (nearFlood ? 15 : 11)) * (nearFlood ? 0.11 : 0.14)
      : 0;
    const jitterX = nearFlood ? Math.sin(this.time * 36) * 1.4 : 0;

    ctx.save();
    ctx.translate(bx + jitterX, by);
    ctx.rotate(flipRot + wobbleAngle);

    const sq = this.glow > 0 ? 1.24 : nearFlood ? 1.05 + Math.sin(this.time * 18) * 0.04 : isWobbly ? 0.95 : 1.0;

    // Pristine HD 3D Crowned Hero Bean with acrobat wobble, superhero stomp cheer, & alert stance
    drawHeroCharacter(ctx, 0, -1, 48, {
      view: 'front',
      state: isDead ? 'dead' : this.glow > 0 ? 'cheer' : (isWobbly || nearFlood) ? 'wobble' : 'stand_alert',
      expr: isDead ? 'dizzy' : nearFlood ? 'panic' : isWobbly ? 'focus' : 'happy',
      t: this.time * (nearFlood || isWobbly ? 5.5 : 3.5),
      squashX: 2 - sq,
      squashY: sq,
    });

    // Circus-striped Weebl Cocktail Umbrella when falling on miss
    if (isDead && this.mascotUmbrella) {
      ctx.save();
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(10, -24);
      ctx.lineTo(15, -54);
      ctx.stroke();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(15, -54, 19, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(15, -73);
      ctx.arc(15, -54, 19, Math.PI * 1.36, Math.PI * 1.64);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Upright panic sweat drops & comic reaction pip rendered outside character flip/wobble rotation
    if ((isWobbly || nearFlood) && !isDead) {
      ctx.save();
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.6;
      const dropLift = (this.time * 18) % 6;
      for (const sx of [-23, 23]) {
        ctx.beginPath();
        ctx.moveTo(bx + sx, by - 44 + dropLift);
        ctx.quadraticCurveTo(bx + sx + 4, by - 38 + dropLift, bx + sx, by - 35 + dropLift);
        ctx.quadraticCurveTo(bx + sx - 4, by - 38 + dropLift, bx + sx, by - 44 + dropLift);
        ctx.fill();
        ctx.stroke();
      }

      const warnLabel = nearFlood ? 'HOT!' : 'WHOA!';
      const badgeCol = nearFlood ? '#fb7185' : '#fde047';
      const badgeX = clamp(bx + 20, 12, this.W - 56);
      const badgeY = clamp(by - 68, 152, this.H - 40);
      drawComicPanel(ctx, badgeX, badgeY, 44, 19, 6, badgeCol, {
        lineWidth: 2.0,
        shadowDx: 1.5,
        shadowDy: 2,
        glossTop: false,
      });
      drawComicText(ctx, warnLabel, badgeX + 22, badgeY + 9.5, "900 9.5px 'Fredoka', 'Outfit', sans-serif", '#0f172a', {
        stroke: '#ffffff',
        strokeWidth: 0,
      });
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ Opaque #000-Inked Caramel Tide */
  renderCaramelFlood(ctx, W, H) {
    const floodY = BASE_Y - this.floodH + this.cam;
    if (floodY > H + 40) return;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. Back churning orange magma wave (#000 outlined)
    ctx.fillStyle = STYLE_TOKENS.lavaOuter;
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(-12, H + 40);
    for (let x = -12; x <= W + 24; x += 18) {
      const wy = floodY - 7 + Math.sin(x * 0.032 - this.time * 3.8) * 6;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(W + 24, H + 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Main opaque caramel-magma gradient wave (#000 outlined)
    const fg = ctx.createLinearGradient(0, floodY - 6, 0, Math.max(floodY + 130, H));
    fg.addColorStop(0, STYLE_TOKENS.lavaMid);
    fg.addColorStop(0.35, '#e11d48');
    fg.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-12, H + 40);
    for (let x = -12; x <= W + 24; x += 14) {
      const wy = floodY + Math.sin(x * 0.042 + this.time * 4.6) * 6.5;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(W + 24, H + 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Hot yellow-cream caramel crest stripe
    ctx.strokeStyle = STYLE_TOKENS.lavaHot;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    for (let x = -12; x <= W + 24; x += 14) {
      const wy = floodY + 3 + Math.sin(x * 0.042 + this.time * 4.6) * 6.5;
      if (x === -12) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();

    // 4. Cartoon caramel heat swirl bands & crisp #000-inked bubbles inside body + crest
    for (let row = 0; row < 2; row++) {
      const bandY = floodY + 34 + row * 48;
      if (bandY > H) continue;
      ctx.strokeStyle = row === 0 ? 'rgba(254, 240, 138, 0.34)' : 'rgba(251, 146, 60, 0.28)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let x = -12; x <= W + 24; x += 18) {
        const wy = bandY + Math.sin(x * 0.036 + this.time * (3.2 - row * 0.9) + row * 1.7) * 7;
        if (x === -12) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    for (let i = 0; i < this.floodBubbles.length; i++) {
      const fb = this.floodBubbles[i];
      const crestY = floodY + Math.sin(fb.x * 0.042 + this.time * 4.6) * 6.5;
      const lift = (fb.phase * 14) % 28;
      const alpha = Math.max(0, 1 - lift / 28);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = STYLE_TOKENS.lavaCore;
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(fb.x, crestY + 5 - lift, Math.max(2.5, fb.r * 0.8), 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Deep simmering caramel bubbles inside lower wave field
      const deepY = floodY + 26 + ((i * 37 + fb.phase * 18) % Math.max(40, H - floodY));
      if (deepY < H - 10) {
        ctx.save();
        ctx.fillStyle = i % 2 === 0 ? STYLE_TOKENS.lavaCore : STYLE_TOKENS.lavaMid;
        ctx.strokeStyle = STYLE_TOKENS.ink;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(fb.x, deepY, 3 + (i % 3) * 1.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------ Simplified 2-Card Comic HUD */
  renderSpireHUD(ctx, W, H, floor) {
    const curW = Math.round(this.cur ? this.cur.w : this.blocks[this.blocks.length - 1].w);
    const goalPct = clamp(floor / FLOOR_GOAL, 0, 1);
    const topH = floor * BH;
    const gapPx = Math.max(0, topH - this.floodH);
    const gapFloors = (gapPx / BH).toFixed(1);
    const floodDanger = gapPx < 96 && !this.dead;
    const zone = getSpireZone(floor);

    if (floodDanger) {
      const pulse = 0.2 + 0.14 * Math.sin(this.time * 10);
      const vg = ctx.createLinearGradient(0, H - 150, 0, H);
      vg.addColorStop(0, 'rgba(239, 68, 68, 0)');
      vg.addColorStop(1, `rgba(239, 68, 68, ${pulse})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, H - 150, W, 150);
    }

    // 1. Top-Left Simplified Spire Card (x=14, y=98, 212x50)
    const px = 14;
    const py = 98;
    const pw = 212;
    const ph = 50;
    drawComicPanel(ctx, px, py, pw, ph, 12, '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2.5,
      shadowDy: 3,
    });

    drawComicText(ctx, `🏰 FL ${floor}/${FLOOR_GOAL}`, px + 12, py + 16, "900 13.5px 'Fredoka', 'Outfit', sans-serif", '#4ade80', {
      align: 'left',
      strokeWidth: 3.4,
    });
    drawComicText(ctx, zone.name, px + pw - 11, py + 16, "900 9.2px 'Fredoka', 'Outfit', sans-serif", zone.accent, {
      align: 'right',
      strokeWidth: 2.8,
    });

    // Progress Bar + Compact Width Pill inline
    const barX = px + 12;
    const barY = py + 31;
    const barW = 136;
    const barH = 9;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4.5);
    ctx.fill();
    if (goalPct > 0) {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(9, barW * goalPct), barH, 4.5);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4.5);
    ctx.stroke();

    drawComicText(ctx, `${curW}px`, px + pw - 11, py + 35.5, "900 10.5px 'Fredoka', 'Outfit', sans-serif", '#38bdf8', {
      align: 'right',
      strokeWidth: 3,
    });

    // 2. Top-Right Simplified Tide Card tucked cleanly below #prestigeBadge (y=104)
    const fw = 128;
    const fh = 38;
    const fx = W - fw - 14;
    const fy = 104;
    drawComicPanel(ctx, fx, fy, fw, fh, 11, floodDanger ? '#e11d48' : '#0f172a', {
      lineWidth: 2.8,
      shadowDx: 2.5,
      shadowDy: 3,
    });
    drawComicText(
      ctx,
      floodDanger ? `⚠️ STACK! ${gapFloors}` : `🌊 TIDE -${gapFloors}`,
      fx + fw * 0.5,
      fy + fh * 0.5 + 1,
      "900 11.5px 'Fredoka', 'Outfit', sans-serif",
      floodDanger ? '#fef08a' : '#fb923c',
      { strokeWidth: 3.4 },
    );
  }

  rr(x, y, w, h, r) {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
  }
}
