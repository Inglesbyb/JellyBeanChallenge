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
  traceRoundRect,
} from '../engine/toyStyle.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const ROW_COLORS = ['#ff4b5c', '#ff9f1c', '#ffd166', '#3dffa2', '#25e6ff', '#7c5cff'];
const MAX_BALLS = 8;

const CAPSULE_STYLE = {
  multi: { bg: '#ffd166', label: '+BALL' },
  split: { bg: '#ff70a6', label: '×2' },
  wide:  { bg: '#3dffa2', label: 'WIDE' },
  laser: { bg: '#25e6ff', label: 'LASER' },
  fire:  { bg: '#ff9f1c', label: 'FIRE' },
};

export class BeanBreaker extends Game {
  static meta = {
    id: 'bean-breaker',
    title: 'Bean Breaker',
    icon: '🏓',
    hint: 'DRAG paddle · smash descending bricks!',
    baseLikes: 2840,
    isPrestige: true,
    parScore60s: 2000,
    roundLen: 60,
    cue: 'SMASH THE BRICKS!',
    prestigeCue: 'FASTER BALL · SLIMMER PADDLE!',
    scaling: {
      paddleW:         { base: 98,  rate: 0.18, floor: 66,   mode: 'down', round: true, label: 'Paddle Width' },
      ballSpeed:       { base: 325, rate: 0.16, cap: 460,    mode: 'up',   round: true, label: 'Ball Speed' },
      descendInterval: { base: 5.0, rate: 0.18, floor: 1.8,  mode: 'down', label: 'Wall Drop' },
      toughChanceBase: { base: 0.22, rate: 0.18, cap: 0.56,  mode: 'up',   label: 'Armored Bricks' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    this.paddleW = this.diff.paddleW ?? 98;
    this.paddleH = 16;
    this.paddleX = this.W / 2;
    this.paddleY = Game.SAFE_BOTTOM - 34;
    this.dangerY = this.paddleY - 34;

    this.wideTimer = 0;
    this.laserTimer = 0;
    this.fireTimer = 0;
    this.laserCd = 0;

    this.baseBallSpeed = this.diff.ballSpeed ?? 325;
    this.balls = [this.makeBall(this.W / 2, this.paddleY - 18, 95, -this.baseBallSpeed)];

    this.cols = 7;
    this.padX = 24;
    this.gap = 6;
    this.bw = (this.W - this.padX * 2 - this.gap * (this.cols - 1)) / this.cols;
    this.bh = 22;
    this.rowStep = this.bh + this.gap;
    this.startY = Game.SAFE_TOP + 34;

    this.baseDescendInterval = this.diff.descendInterval ?? 5.0;
    this.bricks = [];
    this.powerups = [];
    this.lasers = [];
    this.beamFx = [];
    this.combo = 0;
    this.colorCursor = 0;

    if (saved && Array.isArray(saved.bricks) && saved.bricks.length > 0) {
      this.paddleX = clamp(saved.paddleX ?? this.W / 2, 50, this.W - 50);
      this.bricks = saved.bricks.map((b) => ({
        ...b,
        targetY: b.targetY ?? b.y,
        flash: 0,
      }));
      this.waveCount = saved.waveCount ?? 1;
      this.descendInterval = this.getDescendInterval(this.waveCount);
      this.descendTimer = Math.min(this.descendInterval, saved.descendTimer ?? this.descendInterval);
      this.grace = 1.2;
    } else {
      this.waveCount = 1;
      this.descendInterval = this.getDescendInterval(1);
      this.descendTimer = this.descendInterval;
      this.spawnWave();
      this.grace = 0.6;
    }
  }

  getDescendInterval(wave = this.waveCount) {
    const floor = Math.max(1.5, this.baseDescendInterval - 1.5);
    return Math.max(floor, this.baseDescendInterval - Math.max(0, wave - 1) * 0.12);
  }

  makeBall(x, y, vx, vy) {
    return { x, y, vx, vy, r: 8, trail: [] };
  }

  createBrickRow(rowY, rowIdx, forceNormal = false) {
    const color = ROW_COLORS[rowIdx % ROW_COLORS.length];
    for (let c = 0; c < this.cols; c++) {
      let kind = 'normal';
      if (!forceNormal) {
        const roll = Math.random();
        if (roll < 0.075) kind = 'bomb';
        else if (roll < 0.13) kind = 'zapper';
      }
      const waveBonus = Math.max(0, (this.waveCount || 1) - 1);
      const toughChance = clamp((this.diff.toughChanceBase ?? 0.22) + waveBonus * 0.03, 0.22, 0.65);
      const baseArmor = 2 + (this.prestige >= 3 ? 1 : 0);
      const bonusHp = waveBonus >= 9
        ? (Math.random() < 0.5 ? 2 : 1)
        : (waveBonus >= 4 && Math.random() < 0.55 ? 1 : 0);
      const hp = kind !== 'normal'
        ? 1
        : (Math.random() < toughChance ? Math.min(4, baseArmor + bonusHp) : 1);

      this.bricks.push({
        x: this.padX + c * (this.bw + this.gap),
        y: rowY,
        targetY: rowY,
        w: this.bw,
        h: this.bh,
        hp,
        maxHp: hp,
        kind,
        color: kind === 'bomb' ? '#ff5c39' : kind === 'zapper' ? '#00f5d4' : color,
        flash: 0,
      });
    }
  }

  spawnWave() {
    this.bricks = [];
    const rows = Math.min(6, 5 + Math.floor((this.prestige - 1) / 3));
    for (let r = 0; r < rows; r++) {
      this.createBrickRow(this.startY + r * this.rowStep, r, r === rows - 1);
      this.colorCursor = r + 1;
    }
  }

  descendWallAndSpawnRow() {
    this.waveCount += 1;
    this.descendInterval = this.getDescendInterval(this.waveCount);

    for (const br of this.bricks) {
      br.targetY += this.rowStep;
    }
    this.createBrickRow(this.startY, this.colorCursor++);
    // Slide the new top row smoothly down from just above startY
    for (let i = this.bricks.length - this.cols; i < this.bricks.length; i++) {
      if (this.bricks[i]) {
        this.bricks[i].y = this.startY - this.rowStep * 0.7;
      }
    }
    this.sounds.tick();
    this.haptics.light();
    this.fx.shake(2.5, 0.14);
  }

  spawnPowerup(x, y) {
    const r = Math.random();
    let kind = 'wide';
    if (r < 0.34) kind = 'multi';
    else if (r < 0.52) kind = 'wide';
    else if (r < 0.72) kind = 'laser';
    else if (r < 0.90) kind = 'fire';
    else kind = 'split';
    this.powerups.push({ x, y, kind });
  }

  damageBrick(br, dmg = 1, allowDrop = true) {
    const idx = this.bricks.indexOf(br);
    if (idx === -1) return false;

    br.hp -= dmg;
    br.flash = 0.08;
    this.combo += 1;

    // Calibrated inline with PAR_SCORE_60S['bean-breaker'] = 2000 (~25..60 pts/hit)
    const pts = 25 + Math.min(35, this.combo * 5);
    this.score += pts;
    this.sounds.stack(this.combo);
    this.haptics.light();
    this.fx.burst(br.x + br.w / 2, br.y + br.h / 2, br.color, 8, 145, 0.32, 2.8);

    if (br.hp > 0) return false;

    this.bricks.splice(idx, 1);
    const bx = br.x + br.w / 2;
    const by = br.y + br.h / 2;
    this.fx.text(bx, by, `+${pts}`, br.color, 14, 0.5);

    if (br.kind === 'bomb') {
      this.fx.ring(bx, by, '#ff9f1c', 110, 0.38, 4);
      this.fx.burst(bx, by, '#ff9f1c', 18, 220, 0.45, 4);
      this.fx.shake(7, 0.22);
      this.sounds.explosion();
      this.haptics.heavy();

      const radius = br.w * 1.5;
      const targets = this.bricks.filter((other) => {
        const ox = other.x + other.w / 2;
        const oy = other.y + other.h / 2;
        return Math.hypot(ox - bx, oy - by) <= radius;
      });
      for (const target of targets) {
        this.damageBrick(target, 2, false);
      }
      return true;
    }

    if (br.kind === 'zapper') {
      this.beamFx.push({ y: by, t: 0.24 });
      this.fx.shake(5, 0.16);
      this.sounds.laser();
      this.haptics.medium();

      const rowTargets = this.bricks.filter(
        (other) => Math.abs((other.y + other.h / 2) - by) < this.bh * 0.78
      );
      for (const target of rowTargets) {
        this.damageBrick(target, 2, false);
      }
      return true;
    }

    if (allowDrop && Math.random() < 0.16) {
      this.spawnPowerup(bx, by);
    }
    return true;
  }

  applyCapsule(kind, px, py) {
    if (kind === 'multi' && this.balls.length < MAX_BALLS) {
      const b = this.balls[0] || { x: this.paddleX, y: this.paddleY - 18, vx: 110, vy: -this.baseBallSpeed };
      this.balls.push(this.makeBall(b.x, b.y, -(b.vx || 110) * 0.9, -Math.abs(b.vy || this.baseBallSpeed)));
    } else if (kind === 'split') {
      const curCount = this.balls.length;
      for (let i = 0; i < curCount && this.balls.length < MAX_BALLS; i++) {
        const b = this.balls[i];
        this.balls.push(this.makeBall(b.x, b.y, -b.vx + (Math.random() - 0.5) * 60, b.vy));
      }
    } else if (kind === 'wide') {
      this.wideTimer = 8;
    } else if (kind === 'laser') {
      this.laserTimer = 5.5;
    } else if (kind === 'fire') {
      this.fireTimer = 5.5;
    }

    this.score += 80;
    const style = CAPSULE_STYLE[kind] || CAPSULE_STYLE.wide;
    this.fx.burst(px, py, style.bg, 12, 165, 0.4, 3.5);
    this.fx.text(px, py - 14, style.label, style.bg, 14, 0.6);
    this.sounds.up();
    this.haptics.medium();
  }

  update(dt) {
    if (this.dead || this.won) {
      this.updateDying(dt);
      return;
    }
    this.fx.update(dt);

    // Paddle control (pointer drag or keyboard)
    const kv = this.input.keyVec();
    if (kv && kv.x !== 0) {
      this.paddleX += kv.x * 430 * dt;
    } else if (this.input.down) {
      this.paddleX += (this.input.x - this.paddleX) * Math.min(1, dt * 18);
    }

    if (this.wideTimer > 0) this.wideTimer = Math.max(0, this.wideTimer - dt);
    if (this.laserTimer > 0) this.laserTimer = Math.max(0, this.laserTimer - dt);
    if (this.fireTimer > 0) this.fireTimer = Math.max(0, this.fireTimer - dt);

    const curW = this.wideTimer > 0 ? this.paddleW * 1.4 : this.paddleW;
    this.paddleX = clamp(this.paddleX, curW / 2 + 10, this.W - curW / 2 - 10);

    // Auto-fire paddle blaster lasers when LASER capsule is active
    if (this.laserTimer > 0) {
      this.laserCd -= dt;
      if (this.laserCd <= 0) {
        this.laserCd = 0.28;
        const offset = curW * 0.34;
        this.lasers.push({ x: this.paddleX - offset, y: this.paddleY - 12 });
        this.lasers.push({ x: this.paddleX + offset, y: this.paddleY - 12 });
        this.sounds.pop();
      }
    }

    // Update paddle laser bolts
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const lz = this.lasers[i];
      lz.y -= 620 * dt;
      let hit = false;
      for (let bi = this.bricks.length - 1; bi >= 0; bi--) {
        const br = this.bricks[bi];
        if (lz.x >= br.x && lz.x <= br.x + br.w && lz.y >= br.y && lz.y <= br.y + br.h) {
          this.damageBrick(br, 1, false);
          hit = true;
          break;
        }
      }
      if (hit || lz.y < Game.SAFE_TOP) {
        this.lasers.splice(i, 1);
      }
    }

    // Fade row-zapper beam visuals
    for (let i = this.beamFx.length - 1; i >= 0; i--) {
      this.beamFx[i].t -= dt;
      if (this.beamFx[i].t <= 0) this.beamFx.splice(i, 1);
    }

    // Continuous descending wall countdown & smooth brick sliding
    this.descendTimer -= dt;
    if (this.descendTimer <= 0) {
      this.descendWallAndSpawnRow();
      this.descendTimer = this.descendInterval;
    }

    let breachedDangerLine = false;
    for (const br of this.bricks) {
      if (br.flash > 0) br.flash = Math.max(0, br.flash - dt);
      if (br.y !== br.targetY) {
        const diff = br.targetY - br.y;
        br.y = Math.abs(diff) < 0.5 ? br.targetY : br.y + diff * Math.min(1, dt * 16);
      }
      if (br.y + br.h >= this.dangerY) {
        breachedDangerLine = true;
      }
    }

    if (breachedDangerLine && this.grace <= 0) {
      this.die('Crushed by the Neon Wall! 💀');
      return;
    }

    // Falling Cyber Hex-Chip powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.y += 165 * dt;
      if (
        p.y + 15 >= this.paddleY - this.paddleH / 2 &&
        p.y - 15 <= this.paddleY + this.paddleH / 2 &&
        Math.abs(p.x - this.paddleX) <= curW / 2 + 16
      ) {
        this.applyCapsule(p.kind, p.x, p.y);
        this.powerups.splice(i, 1);
      } else if (p.y > Game.SAFE_BOTTOM + 24) {
        this.powerups.splice(i, 1);
      }
    }

    // Balls physics & brick collisions
    const isFire = this.fireTimer > 0;
    for (let bi = this.balls.length - 1; bi >= 0; bi--) {
      const b = this.balls[bi];
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 6) b.trail.shift();

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x - b.r < 12) { b.x = 12 + b.r; b.vx = Math.abs(b.vx); this.sounds.pop(); }
      if (b.x + b.r > this.W - 12) { b.x = this.W - 12 - b.r; b.vx = -Math.abs(b.vx); this.sounds.pop(); }
      if (b.y - b.r < Game.SAFE_TOP + 8) { b.y = Game.SAFE_TOP + 8 + b.r; b.vy = Math.abs(b.vy); this.sounds.pop(); }

      // Anti-horizontal-loop guard so balls keep moving vertically
      if (Math.abs(b.vy) < 75) {
        b.vy = (b.vy >= 0 ? 1 : -1) * 90;
      }

      // Paddle bounce
      if (
        b.vy > 0 &&
        b.y + b.r >= this.paddleY - this.paddleH / 2 &&
        b.y - b.r <= this.paddleY + this.paddleH / 2 &&
        b.x >= this.paddleX - curW / 2 - b.r &&
        b.x <= this.paddleX + curW / 2 + b.r
      ) {
        const hitNorm = clamp((b.x - this.paddleX) / (curW / 2), -0.95, 0.95);
        const angle = hitNorm * (Math.PI * 0.36);
        const spd = Math.min(this.baseBallSpeed * 1.42, Math.hypot(b.vx, b.vy) * 1.015);
        b.vx = Math.sin(angle) * spd;
        b.vy = -Math.cos(angle) * spd;
        b.y = this.paddleY - this.paddleH / 2 - b.r - 1;
        this.combo = 0;
        this.sounds.bubble(1.1);
        this.haptics.light();
        this.fx.burst(b.x, b.y, isFire ? '#ff9f1c' : '#25e6ff', 7, 110, 0.25, 2.5);
      }

      // Brick collisions
      for (let i = this.bricks.length - 1; i >= 0; i--) {
        const br = this.bricks[i];
        const cx = clamp(b.x, br.x, br.x + br.w);
        const cy = clamp(b.y, br.y, br.y + br.h);
        const dx = b.x - cx;
        const dy = b.y - cy;
        if (dx * dx + dy * dy <= b.r * b.r) {
          const killed = this.damageBrick(br, isFire ? 2 : 1, true);
          // Fireball pierces straight through destroyed bricks without bouncing!
          if (!(isFire && killed)) {
            if (Math.abs(dx) > Math.abs(dy)) b.vx = -b.vx;
            else b.vy = -b.vy;
          }
          break;
        }
      }

      if (b.y - b.r > Game.SAFE_BOTTOM + 6) {
        this.balls.splice(bi, 1);
      }
    }

    // Cleared all current bricks: bonus Prestige completion!
    if (this.bricks.length === 0) {
      this.score += 350;
      this.fx.ring(this.W / 2, this.H / 2, '#ffd166', 260, 0.7, 6);
      this.complete('Neon Wall Wiped! 👑');
      return;
    }

    if (this.balls.length === 0) {
      if (this.grace > 0) {
        this.balls.push(this.makeBall(this.paddleX, this.paddleY - 18, 90, -this.baseBallSpeed));
      } else {
        this.die('Dropped the last energy ball! 💀');
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const { W, H } = this;

    // 1. Studio-lit Nintendo Toy Diorama Arcade Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#101436');
    bg.addColorStop(0.55, '#1b1645');
    bg.addColorStop(1, '#0b1028');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const spot = ctx.createRadialGradient(W * 0.5, Game.SAFE_TOP + 160, 20, W * 0.5, Game.SAFE_TOP + 240, W * 0.85);
    spot.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
    spot.addColorStop(0.6, 'rgba(124, 92, 255, 0.06)');
    spot.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);

    // 2. Recessed 3D Toy Playfield Cabinet
    const fX = 11;
    const fY = Game.SAFE_TOP + 7;
    const fW = W - 22;
    const fH = Game.PLAY_HEIGHT - 14;
    ctx.save();
    traceRoundRect(ctx, fX, fY, fW, fH, 16);
    ctx.fillStyle = 'rgba(9, 13, 34, 0.42)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.34)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Subtle inlaid toy tile grid inside play-well
    ctx.clip();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
    ctx.lineWidth = 1;
    for (let gx = fX + 36; gx < fX + fW; gx += 36) {
      ctx.beginPath(); ctx.moveTo(gx, fY); ctx.lineTo(gx, fY + fH); ctx.stroke();
    }
    for (let gy = fY + 36; gy < fY + fH; gy += 36) {
      ctx.beginPath(); ctx.moveTo(fX, gy); ctx.lineTo(fX + fW, gy); ctx.stroke();
    }
    ctx.restore();

    // 3. Top Descent-Pressure Bar & Wave Indicator
    const topBarY = Game.SAFE_TOP + 13;
    const barW = W - 36;
    const pct = clamp(1 - this.descendTimer / this.descendInterval, 0, 1);
    const barCol = pct > 0.78 ? '#ff4b5c' : '#25e6ff';

    ctx.save();
    traceRoundRect(ctx, 18, topBarY - 1, barW, 7, 3.5);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (pct > 0.01) {
      ctx.save();
      traceRoundRect(ctx, 18, topBarY - 1, barW, 7, 3.5);
      ctx.clip();
      drawToyPill(ctx, 18, topBarY - 1, Math.max(8, barW * pct), 7, barCol, {
        rimColor: toyRim(barCol, 0.45),
        lineWidth: 0.75,
      });
      ctx.restore();
    }

    ctx.font = "700 10.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'right';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';
    const waveLabel = `WAVE ${this.waveCount} · NEXT DROP`;
    ctx.strokeText(waveLabel, W - 20, topBarY + 17);
    ctx.fillStyle = pct > 0.78 ? '#fda4af' : '#e2e8f0';
    ctx.fillText(waveLabel, W - 20, topBarY + 17);
    ctx.restore();

    // 4. Dashed Coral Caution Line + Wall Studs
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 59, 107, 0.72)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(18, this.dangerY);
    ctx.lineTo(W - 18, this.dangerY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    drawToySphere(ctx, 15, this.dangerY, 4.5, '#ff3b6b', { rimColor: '#881337', lineWidth: 1 });
    drawToySphere(ctx, W - 15, this.dangerY, 4.5, '#ff3b6b', { rimColor: '#881337', lineWidth: 1 });

    // 5. Row-Zapper Horizontal Plasma Beams
    for (const beam of this.beamFx) {
      ctx.save();
      ctx.globalAlpha = clamp(beam.t / 0.24, 0, 1);
      drawToyPill(ctx, 14, beam.y - 6, W - 28, 12, '#00f5d4', {
        rimColor: '#0e7490',
        lineWidth: 1.2,
      });
      drawToyPill(ctx, 18, beam.y - 2.5, W - 36, 5, '#ffffff', {
        lineWidth: 0,
        gloss: false,
      });
      ctx.restore();
    }

    // 6. Volumetric 3D Vinyl Toy Bricks
    const urgentPulse = 0.5 + 0.5 * Math.sin(this.time * 12);
    for (const br of this.bricks) {
      const nearDanger = br.y + br.h >= this.dangerY - this.rowStep * 1.15;
      const baseCol = br.flash > 0 ? mixColor(br.color, '#ffffff', 0.85) : br.color;
      const baseRim = toyRim(baseCol, 0.58);
      const rimCol = nearDanger ? mixColor(baseRim, '#ff2a5f', urgentPulse * 0.85) : baseRim;
      const lw = nearDanger ? 2.1 : toyLineW(br.h, 0.06, 1.0, 1.8);

      // Soft grounding shadow beneath each block
      ctx.fillStyle = 'rgba(8, 12, 30, 0.36)';
      traceRoundRect(ctx, br.x + 1, br.y + 4.5, br.w, br.h, 6.5);
      ctx.fill();

      drawToyBevelRect(ctx, br.x, br.y, br.w, br.h, 6.5, baseCol, {
        depth: 3.2,
        rimColor: rimCol,
        lineWidth: lw,
        gloss: true,
      });

      const cx = br.x + br.w / 2;
      const cy = br.y + br.h / 2;

      if (br.kind === 'bomb') {
        // Tactile 3D mini toy bomb + glowing spark
        drawToySphere(ctx, cx - 1, cy + 1.5, 6.2, '#1e293b', {
          rimColor: '#0f172a',
          lineWidth: 1.1,
          shine: 0.65,
        });
        ctx.save();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + 3, cy - 3);
        ctx.quadraticCurveTo(cx + 6, cy - 6.5, cx + 8.5, cy - 5);
        ctx.stroke();
        ctx.fillStyle = urgentPulse > 0.5 ? '#fef08a' : '#ff9f1c';
        ctx.beginPath();
        ctx.arc(cx + 9, cy - 5, 2.3, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (br.kind === 'zapper') {
        ctx.save();
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.8;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + 1.5, cy - 6.5);
        ctx.lineTo(cx - 4.5, cy + 0.5);
        ctx.lineTo(cx - 0.2, cy + 0.5);
        ctx.lineTo(cx - 2, cy + 6.5);
        ctx.lineTo(cx + 4.5, cy - 0.5);
        ctx.lineTo(cx + 0.2, cy - 0.5);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        ctx.restore();
      } else if (br.hp > 1) {
        // Armored corner stud rivets + crisp outlined armor count
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(br.x + 6, br.y + br.h / 2, 1.8, 0, TAU);
        ctx.arc(br.x + br.w - 6, br.y + br.h / 2, 1.8, 0, TAU);
        ctx.fill();

        ctx.font = "700 12px 'Fredoka', 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#0f172a';
        ctx.strokeText(String(br.hp), cx, cy + 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(br.hp), cx, cy + 1);
        ctx.restore();
      }
    }

    // 7. Paddle Laser Bolts
    for (const lz of this.lasers) {
      drawToyPill(ctx, lz.x - 2.5, lz.y - 9, 5, 16, '#25e6ff', {
        rimColor: '#0284c7',
        lineWidth: 0.9,
      });
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lz.x, lz.y - 3, 1.4, 0, TAU);
      ctx.fill();
    }

    // 8. Powerup 3D Toy Hex-Medallions
    for (const p of this.powerups) {
      this.drawPickupChip(ctx, p);
    }

    // 9. 3D Extruded Paddle + Blaster Turrets + Captain Bean Pilot
    const curW = this.wideTimer > 0 ? this.paddleW * 1.4 : this.paddleW;
    const pLeft = this.paddleX - curW / 2;
    const pTop = this.paddleY - this.paddleH / 2;
    const edgeCol = this.laserTimer > 0 ? '#ff4fa3' : this.fireTimer > 0 ? '#ff9f1c' : '#7c5cff';
    const midCol = this.fireTimer > 0 ? '#ffd166' : '#25e6ff';
    const pRim = toyRim(edgeCol, 0.6);

    drawToyShadow(ctx, this.paddleX, this.paddleY + 13, curW * 0.48, 6.5, 0.34);

    if (this.laserTimer > 0) {
      drawToyBevelRect(ctx, this.paddleX - curW * 0.34 - 4, pTop - 7, 8, 8, 3, '#38bdf8', {
        depth: 1.5,
        rimColor: '#0369a1',
        lineWidth: 1.1,
      });
      drawToyBevelRect(ctx, this.paddleX + curW * 0.34 - 4, pTop - 7, 8, 8, 3, '#38bdf8', {
        depth: 1.5,
        rimColor: '#0369a1',
        lineWidth: 1.1,
      });
    }

    // 3D bottom lip of paddle
    ctx.save();
    ctx.fillStyle = mixColor(shadeColor(edgeCol, -0.38), '#0f172a', 0.35);
    traceRoundRect(ctx, pLeft, pTop + 3.5, curW, this.paddleH, 9);
    ctx.fill();
    ctx.strokeStyle = pRim;
    ctx.lineWidth = toyLineW(this.paddleH, 0.08, 1.1, 1.8);
    ctx.stroke();

    // Main horizontal glossy paddle capsule
    const pg = ctx.createLinearGradient(pLeft, pTop, pLeft + curW, pTop + this.paddleH);
    pg.addColorStop(0, edgeCol);
    pg.addColorStop(0.5, midCol);
    pg.addColorStop(1, edgeCol);
    ctx.fillStyle = pg;
    traceRoundRect(ctx, pLeft, pTop, curW, this.paddleH, 9);
    ctx.fill();

    // Specular pill shine across top of paddle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    traceRoundRect(ctx, pLeft + 6, pTop + 2, Math.max(8, curW - 12), 4.2, 2.1);
    ctx.fill();

    ctx.strokeStyle = pRim;
    ctx.lineWidth = toyLineW(this.paddleH, 0.08, 1.1, 1.8);
    traceRoundRect(ctx, pLeft, pTop, curW, this.paddleH, 9);
    ctx.stroke();
    ctx.restore();

    drawToySphere(ctx, pLeft + 7, this.paddleY, 3.2, '#f8fafc', { rimColor: pRim, lineWidth: 0.9 });
    drawToySphere(ctx, pLeft + curW - 7, this.paddleY, 3.2, '#f8fafc', { rimColor: pRim, lineWidth: 0.9 });

    drawToyShadow(ctx, this.paddleX, this.paddleY + 30, 14, 5, 0.28);
    drawBean(ctx, this.paddleX, this.paddleY + 14, 16, {
      eyes: this.dead ? 'squish' : 'happy',
      walkT: this.time * 0.4,
      dead: this.dead,
    });

    // 10. Volumetric Energy Balls & Soft Trails
    const isFire = this.fireTimer > 0;
    for (const b of this.balls) {
      for (let ti = 0; ti < b.trail.length; ti++) {
        const pt = b.trail[ti];
        const frac = (ti + 1) / (b.trail.length + 1);
        ctx.fillStyle = isFire ? `rgba(255, 159, 28, ${frac * 0.48})` : `rgba(56, 189, 248, ${frac * 0.4})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, b.r * frac * 0.85, 0, TAU);
        ctx.fill();
      }

      // Soft ambient aura
      ctx.fillStyle = isFire ? 'rgba(255, 159, 28, 0.32)' : 'rgba(56, 189, 248, 0.28)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 1.45, 0, TAU);
      ctx.fill();

      drawToySphere(ctx, b.x, b.y, b.r, isFire ? '#ffb703' : '#e0f2fe', {
        rimColor: isFire ? '#c2410c' : '#0284c7',
        lineWidth: toyLineW(b.r * 2, 0.06, 1.0, 1.8),
        shine: 0.92,
      });
    }

    this.fx.render(ctx);
  }

  traceHexPath(ctx, r) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k - Math.PI / 6;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  drawPickupIcon(ctx, kind, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'multi') {
      ctx.beginPath(); ctx.arc(-3.5, 1.5, 3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(3.5, -1.5, 3, 0, TAU); ctx.fill();
    } else if (kind === 'split') {
      ctx.beginPath();
      ctx.moveTo(-4, 3); ctx.lineTo(0, -1); ctx.lineTo(4, 3);
      ctx.moveTo(0, -4.5); ctx.lineTo(0, -1);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(-4, 3.5, 2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(4, 3.5, 2, 0, TAU); ctx.fill();
    } else if (kind === 'wide') {
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
      ctx.moveTo(-3.5, -3); ctx.lineTo(-6, 0); ctx.lineTo(-3.5, 3);
      ctx.moveTo(3.5, -3); ctx.lineTo(6, 0); ctx.lineTo(3.5, 3);
      ctx.stroke();
    } else if (kind === 'laser') {
      ctx.beginPath();
      ctx.moveTo(1, -6); ctx.lineTo(-3, 0.5); ctx.lineTo(0.5, 0.5);
      ctx.lineTo(-1, 6); ctx.lineTo(3.5, -0.5); ctx.lineTo(0, -0.5);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'fire') {
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(5.5, -1, 3.5, 4);
      ctx.quadraticCurveTo(0, 6.5, -3.5, 4);
      ctx.quadraticCurveTo(-5.5, -1, 0, -6);
      ctx.fill();
    }
  }

  drawPickupChip(ctx, p) {
    const style = CAPSULE_STYLE[p.kind] || CAPSULE_STYLE.wide;
    const tilt = Math.sin(this.time * 4.2 + p.x * 0.05) * 0.14;
    const rim = toyRim(style.bg, 0.55);

    drawToyShadow(ctx, p.x, p.y + 18, 13, 4.5, 0.28);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(tilt);

    const r = 15.5;
    // Extruded 3D bottom hex lip
    ctx.save();
    ctx.translate(0, 3);
    this.traceHexPath(ctx, r);
    ctx.fillStyle = shadeColor(style.bg, -0.42);
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // Main glossy hex face
    const hg = ctx.createRadialGradient(-4, -5, 2, 0, 0, r);
    hg.addColorStop(0, '#334155');
    hg.addColorStop(0.6, '#1e293b');
    hg.addColorStop(1, '#0f172a');
    this.traceHexPath(ctx, r);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.lineWidth = 2.1;
    ctx.strokeStyle = style.bg;
    ctx.stroke();

    this.traceHexPath(ctx, r - 3.8);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
    ctx.lineWidth = 1;
    ctx.stroke();

    this.drawPickupIcon(ctx, p.kind, style.bg);
    ctx.restore();

    // Crisp toy pill label underneath
    ctx.save();
    drawToyPill(ctx, p.x - 20, p.y + 16, 40, 13.5, '#0f172a', {
      rimColor: style.bg,
      lineWidth: 1.3,
      gloss: false,
    });
    ctx.font = "700 8.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#0f172a';
    ctx.strokeText(style.label, p.x, p.y + 23);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(style.label, p.x, p.y + 23);
    ctx.restore();
  }

  serialize() {
    return {
      paddleX: this.paddleX,
      bricks: this.bricks,
      waveCount: this.waveCount,
      descendTimer: this.descendTimer,
    };
  }

  restoreLabel() {
    return `${this.bricks.length} bricks left`;
  }
}
