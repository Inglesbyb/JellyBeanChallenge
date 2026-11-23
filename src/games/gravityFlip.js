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
  traceRoundRect,
} from '../engine/toyStyle.js';

const TAU = Math.PI * 2;

export class GravityFlip extends Game {
  static meta = {
    id: 'gravity-flip',
    title: 'Gravity Flip',
    icon: '🧲',
    hint: 'TAP or SPACE to flip gravity!',
    baseLikes: 2980,
    isPrestige: false,
    parScore60s: 2600,
    roundLen: 60,
    cue: 'TAP TO FLIP GRAVITY!',
    prestigeCue: 'FASTER SCROLL · MORE SPIKES!',
    scaling: {
      baseSpeed:    { base: 270, rate: 0.16, cap: 365,  mode: 'up',   round: true, label: 'Run Speed' },
      maxSpeed:     { base: 440, rate: 0.16, cap: 560,  mode: 'up',   round: true, label: 'Top Speed' },
      spawnScale:   { base: 1.0, rate: 0.16, floor: 0.68, mode: 'down', label: 'Spike Gaps' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    this.topY = Game.SAFE_TOP + 54;
    this.botY = Game.SAFE_BOTTOM - 54;
    this.playerX = 110;
    this.onTop = saved?.onTop ?? false;
    this.playerY = this.onTop ? this.topY + 24 : this.botY - 24;
    this.vy = 0;

    this.distance = saved?.distance ?? 0;
    this.baseRunSpeed = this.diff.baseSpeed ?? 270;
    this.maxRunSpeed = this.diff.maxSpeed ?? 440;
    this.speed = Math.max(this.baseRunSpeed, saved?.speed ?? this.baseRunSpeed);
    this.obstacles = [];
    this.coins = [];
    this.spawnTimer = 0.65;

    this.grace = saved ? 1.3 : 0.6;
  }

  flip() {
    this.onTop = !this.onTop;
    this.vy = this.onTop ? -860 : 860;
    this.sounds.whoosh();
    this.haptics.light();
    this.fx.burst(this.playerX, this.playerY, '#25e6ff', 8, 120, 0.3, 2.5);
  }

  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }
    this.fx.update(dt);

    if (this.input.pressed || this.input.key(' ', 'arrowup', 'arrowdown', 'w', 's')) {
      if (this.input.pressed || !this._keyHeld) {
        this.flip();
      }
      this._keyHeld = true;
    } else {
      this._keyHeld = false;
    }

    const grav = this.onTop ? -2600 : 2600;
    this.vy += grav * dt;
    this.playerY += this.vy * dt;

    const minY = this.topY + 22;
    const maxY = this.botY - 22;
    if (this.playerY <= minY) {
      this.playerY = minY;
      this.vy = 0;
    } else if (this.playerY >= maxY) {
      this.playerY = maxY;
      this.vy = 0;
    }

    this.speed = Math.min(this.maxRunSpeed, this.baseRunSpeed + this.distance * 0.012);
    const step = this.speed * dt;
    this.distance += step;
    this.score += step * 0.15;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const topSide = Math.random() < 0.5;
      const h = 44 + Math.random() * 44;
      this.obstacles.push({
        x: this.W + 30,
        topSide,
        w: 32,
        h,
      });

      // Coin arc on the opposite lane
      const coinY = topSide ? this.botY - 28 : this.topY + 28;
      for (let c = 0; c < 3; c++) {
        this.coins.push({
          x: this.W + 20 + c * 34,
          y: coinY,
          r: 10,
        });
      }

      this.spawnTimer = Math.max(0.42, (1.05 - (this.speed - this.baseRunSpeed) * 0.0022) * (this.diff.spawnScale ?? 1));
    }

    // Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.x -= step;
      const oy = o.topSide ? this.topY : this.botY - o.h;
      const hitX = Math.abs(this.playerX - (o.x + o.w / 2)) < o.w * 0.45 + 14;
      const hitY = this.playerY + 15 > oy && this.playerY - 15 < oy + o.h;

      if (hitX && hitY && this.grace <= 0) {
        this.fx.burst(this.playerX, this.playerY, '#ff4b5c', 16, 180, 0.5, 4);
        this.die('Crashed into grav-spike! 🧲');
        return;
      }

      if (o.x + o.w < -20) {
        this.score += 30;
        this.obstacles.splice(i, 1);
      }
    }

    // Coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.x -= step;
      if (Math.hypot(this.playerX - c.x, this.playerY - c.y) <= 26) {
        this.score += 65;
        this.fx.burst(c.x, c.y, '#ffd166', 7, 110, 0.3, 2.5);
        this.fx.text(c.x, c.y - 14, '+65', '#ffd166', 14, 0.45);
        this.sounds.bubble(1.2);
        this.haptics.light();
        this.coins.splice(i, 1);
      } else if (c.x < -20) {
        this.coins.splice(i, 1);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    // 1. Studio-Lit Toy Corridor Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b102d');
    bg.addColorStop(0.5, '#191446');
    bg.addColorStop(1, '#0b102d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle Parallax Diorama Toy Blocks & Speed Lines
    const scrollSlow = this.distance * 0.25;
    for (let i = 0; i < 5; i++) {
      const px = ((i * 125 - (scrollSlow % 625) + 625) % 625) - 90;
      const py = this.topY + 46 + (i % 3) * 118;
      ctx.save();
      traceRoundRect(ctx, px, py, 64, 34, 10);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(165, 180, 252, 0.08)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }

    const scrollMid = this.distance * 0.55;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.11)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const sx = ((i * 95 - (scrollMid % 570) + 570) % 570) - 60;
      const sy = this.topY + 34 + ((i * 67) % Math.max(80, this.botY - this.topY - 70));
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 34, sy);
      ctx.stroke();
    }

    // 2. 3D Extruded Ceiling & Floor Magnetic Tracks
    const topH = this.topY - Game.SAFE_TOP;
    const botH = Game.SAFE_BOTTOM - this.botY;

    const topGrad = ctx.createLinearGradient(0, Game.SAFE_TOP, 0, this.topY);
    topGrad.addColorStop(0, '#181a3d');
    topGrad.addColorStop(1, '#2a2e66');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, Game.SAFE_TOP, W, topH);

    const botGrad = ctx.createLinearGradient(0, this.botY, 0, Game.SAFE_BOTTOM);
    botGrad.addColorStop(0, '#2a2e66');
    botGrad.addColorStop(1, '#181a3d');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, this.botY, W, botH);

    // Scrolling segmented track blocks along ceiling & floor
    const tileStep = 48;
    const tileOff = this.distance % tileStep;
    for (let tx = -tileOff - tileStep; tx < W + tileStep; tx += tileStep) {
      drawToyBevelRect(ctx, tx + 3, this.topY - 22, tileStep - 8, 12, 4, '#312e81', {
        depth: 0,
        rimColor: '#1e1b4b',
        lineWidth: 1,
        gloss: true,
      });
      drawToyBevelRect(ctx, tx + 3, this.botY + 10, tileStep - 8, 12, 4, '#312e81', {
        depth: 2,
        rimColor: '#1e1b4b',
        lineWidth: 1,
        gloss: true,
      });
    }

    // Glowing active magnetic rails
    const topRailCol = this.onTop ? '#25e6ff' : '#4f46e5';
    const botRailCol = !this.onTop ? '#25e6ff' : '#4f46e5';
    drawToyBevelRect(ctx, -4, this.topY - 8, W + 8, 8, 3, topRailCol, {
      depth: 0,
      rimColor: toyRim(topRailCol, 0.55),
      lineWidth: 1.5,
      gloss: true,
    });
    drawToyBevelRect(ctx, -4, this.botY, W + 8, 8, 3, botRailCol, {
      depth: 2.5,
      rimColor: toyRim(botRailCol, 0.55),
      lineWidth: 1.5,
      gloss: true,
    });

    // 3. 3D Toy Grav-Spike Obstacles
    for (const o of this.obstacles) {
      const oy = o.topSide ? this.topY : this.botY - o.h;
      const tipH = Math.min(18, o.h * 0.38);
      const bodyH = Math.max(10, o.h - tipH);
      const bodyY = o.topSide ? oy : oy + tipH;
      const rim = toyRim('#ff2a5f', 0.6);
      const lw = toyLineW(o.w, 0.055, 1.1, 2.0);

      // Contact shadow on rail
      drawToyShadow(ctx, o.x + o.w / 2, o.topSide ? this.topY + 2 : this.botY - 2, o.w * 0.54, 4.5, 0.3);

      // Sculpted 3D pylon body
      drawToyBevelRect(ctx, o.x, bodyY, o.w, bodyH, 6, '#ff2a5f', {
        depth: o.topSide ? 0 : 3,
        rimColor: rim,
        lineWidth: lw,
        gloss: true,
      });

      // Hazard stripe pill across pylon body
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      traceRoundRect(ctx, o.x + 5, bodyY + bodyH * 0.42, o.w - 10, Math.max(3, bodyH * 0.16), 2);
      ctx.fill();

      // 3D two-tone faceted spike tip pointing into corridor
      const cx = o.x + o.w / 2;
      const baseTipY = o.topSide ? oy + bodyH - 2 : oy + tipH + 2;
      const apexY = o.topSide ? oy + o.h : oy;

      ctx.save();
      ctx.lineJoin = 'round';
      // Lit left facet
      ctx.fillStyle = shadeColor('#ff2a5f', 0.25);
      ctx.beginPath();
      ctx.moveTo(o.x + 2, baseTipY);
      ctx.lineTo(cx, apexY);
      ctx.lineTo(cx, baseTipY);
      ctx.closePath();
      ctx.fill();
      // Shaded right facet
      ctx.fillStyle = shadeColor('#ff2a5f', -0.22);
      ctx.beginPath();
      ctx.moveTo(cx, baseTipY);
      ctx.lineTo(cx, apexY);
      ctx.lineTo(o.x + o.w - 2, baseTipY);
      ctx.closePath();
      ctx.fill();
      // Clean tinted outline
      ctx.strokeStyle = rim;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(o.x + 2, baseTipY);
      ctx.lineTo(cx, apexY);
      ctx.lineTo(o.x + o.w - 2, baseTipY);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Glossy 3D Gold Toy Coins
    for (const c of this.coins) {
      ctx.fillStyle = 'rgba(255, 209, 102, 0.22)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 1.4, 0, TAU);
      ctx.fill();

      drawToySphere(ctx, c.x, c.y, c.r, '#ffd166', {
        rimColor: '#92400e',
        lineWidth: toyLineW(c.r * 2, 0.052, 0.95, 1.8),
        shine: 0.88,
      });

      ctx.fillStyle = '#b45309';
      traceRoundRect(ctx, c.x - 1.6, c.y - c.r * 0.42, 3.2, c.r * 0.84, 1.5);
      ctx.fill();
    }

    // 5. Dynamic Proximity Shadow + Captain Bean (flipped cleanly on ceiling!)
    const surfaceDist = this.onTop
      ? Math.max(0, this.playerY - (this.topY + 22))
      : Math.max(0, (this.botY - 22) - this.playerY);
    const shScale = Math.max(0.32, 1 - surfaceDist / 260);
    drawToyShadow(
      ctx,
      this.playerX,
      this.onTop ? this.topY + 3 : this.botY - 3,
      16 * shScale,
      5.5 * shScale,
      0.34 * shScale,
    );

    ctx.save();
    ctx.translate(this.playerX, this.playerY);
    if (this.onTop) ctx.scale(1, -1);
    drawBean(ctx, 0, 0, 20, {
      walkT: this.time * 1.8,
      eyes: this.dead ? 'squish' : 'happy',
      dead: this.dead,
    });
    ctx.restore();

    // 6. Compact Telemetry Badge on Top Track
    drawToyBevelRect(ctx, 16, Game.SAFE_TOP + 8, 152, 22, 10, '#0f172a', {
      depth: 1.5,
      rimColor: '#38bdf8',
      lineWidth: 1.4,
      gloss: false,
    });
    ctx.save();
    ctx.font = "700 10.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(this.onTop ? '▲ CEIL' : '▼ FLOOR', 26, Game.SAFE_TOP + 19.5);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`${Math.round(this.distance / 10)}m`, 158, Game.SAFE_TOP + 19.5);
    ctx.restore();

    this.fx.render(ctx);
  }

  serialize() {
    return { onTop: this.onTop, distance: this.distance, speed: this.speed };
  }

  restoreLabel() {
    return `${Math.round(this.distance / 10)}m`;
  }
}

