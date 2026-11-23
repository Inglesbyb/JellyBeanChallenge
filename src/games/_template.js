/**
 * ============================================================================
 * GAME REELS - STANDARDIZED GAME PLAYBOOK TEMPLATE (SINGLE SOURCE OF TRUTH)
 * ============================================================================
 *
 * Copy and rename this file to create any new minigame for Game Reels.
 * Every field in `static meta` is validated by `src/games/registry.js` and
 * automatically drives:
 *   1. Play 1 Intro Wrap (`meta.cue` + PRESTIGE 1 HUD badge)
 *   2. Play 2+ Prestige Wrap (`meta.prestigeCue` + delta chips + PRESTIGE 2, 3...)
 *   3. Diminishing-returns difficulty slope (`meta.scaling` -> `this.diff`)
 *   4. Normalized Reel Points (`meta.parScore60s`)
 *   5. Board reset vs continuous save (`meta.isPrestige`)
 *
 * Registration:
 *   Import and add your class to `src/games/registry.js` (NEVER Reel.js).
 *   Run `npm run verify:games` to confirm your game satisfies the SSOT contract.
 * ============================================================================
 */

import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';
import {
  toyRim,
  toyLineW,
  drawToyShadow,
  drawToySphere,
  drawToyBevelRect,
  traceRoundRect,
} from '../engine/toyStyle.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export class TemplateGame extends Game {
  // ---------------------------------------------------------------------------
  // 1. SINGLE SOURCE OF TRUTH METADATA SPECIFICATION
  // ---------------------------------------------------------------------------
  static meta = {
    id: 'template-game',
    title: 'Template Quest',
    icon: '🎮',
    hint: 'DRAG to move · TAP to collect · dodge hazards!',
    baseLikes: 2500,
    isPrestige: true,     // true = reset board on complete(); false = keep saved progress across cycles
    parScore60s: 1500,    // Raw 60s score worth 1,000 base Performance RP
    roundLen: 60,

    // Intro Wrap & Prestige Progression Contract
    cue: 'COLLECT THE STARS!',           // Big Play 1 action pop-up (2-5 words)
    prestigeCue: 'FASTER HAZARDS!',      // Big Play 2+ escalation callout
    scaling: {
      hazardSpeed:   { base: 145,  rate: 0.18, cap: 245,   mode: 'up',   round: true, label: 'Hazard Speed' },
      spawnInterval: { base: 1.15, rate: 0.18, floor: 0.48, mode: 'down',              label: 'Spawn Pace' },
      targetGoal:    { base: 3000, rate: 0.20, cap: 5500,  mode: 'up',   round: true, label: 'Stage Goal' },
    },
  };

  // ---------------------------------------------------------------------------
  // 2. INITIALIZATION & STATE RESTORE
  // ---------------------------------------------------------------------------
  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    // `this.prestige` (1, 2, 3...) and `this.diff` (resolved from `meta.scaling`)
    // are injected by Reel before init(). Always apply `this.diff` even on `saved`
    // restores so Cycle 2+ continuous plays also receive the higher Prestige slope.
    this.playerSpeed = 220;
    this.hazardSpeed = this.diff.hazardSpeed;
    this.spawnInterval = this.diff.spawnInterval;
    this.targetScoreGoal = this.diff.targetGoal;

    this.player = {
      x: this.W / 2,
      y: 520,
      r: 22,
      vx: 0,
      vy: 0,
    };

    this.items = [];
    this.spawnTimer = 0;

    if (saved) {
      if (Number.isFinite(saved.x)) this.player.x = saved.x;
      if (Number.isFinite(saved.y)) this.player.y = saved.y;
      this.grace = 1.5;
    } else {
      this.grace = 1.0;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. MAIN GAMEPLAY UPDATE (dt in seconds)
  // ---------------------------------------------------------------------------
  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }

    this.fx.update(dt);

    const stick = this.input.vec(50);
    this.player.vx = stick.x * this.playerSpeed;
    this.player.vy = stick.y * this.playerSpeed;

    this.player.x = clamp(this.player.x + this.player.vx * dt, 30, this.W - 30);
    this.player.y = clamp(this.player.y + this.player.vy * dt, Game.SAFE_TOP + 30, Game.SAFE_BOTTOM - 30);

    if (this.input.pressed) {
      this.sounds.pop?.();
      this.haptics.light();
      this.fx.burst(this.input.x, this.input.y, '#ffd166', 8, 120, 0.4, 3);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval;
      this.items.push({
        x: 40 + Math.random() * (this.W - 80),
        y: Game.SAFE_TOP + 10,
        vy: this.hazardSpeed,
        r: 16,
        color: '#ff70a6',
      });
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.y += it.vy * dt;

      const dist = Math.hypot(it.x - this.player.x, it.y - this.player.y);
      if (dist < it.r + this.player.r) {
        this.items.splice(i, 1);
        this.score += 150;
        this.sounds.up?.();
        this.haptics.medium();
        this.fx.burst(it.x, it.y, '#3dffa2', 15, 180, 0.6, 4);
        this.fx.text(it.x, it.y - 20, '+150 PTS', '#ffd166', 20, 0.8);
        continue;
      }

      if (it.y > Game.SAFE_BOTTOM) {
        this.items.splice(i, 1);
      }
    }

    if (this.constructor.meta.isPrestige && this.score >= this.targetScoreGoal && !this.won) {
      this.sounds.survive?.();
      this.haptics.success();
      this.fx.ring(this.W / 2, this.H / 2, '#ffd166', 320, 1.0, 8);
      this.complete(`Target Score of ${this.targetScoreGoal.toLocaleString()} Cleared! 👑`);
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. RENDERING PIPELINE
  // ---------------------------------------------------------------------------
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const shake = this.fx.offset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Studio-lit Nintendo 3D Vinyl Toy Diorama backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#131130');
    bg.addColorStop(0.5, '#22174a');
    bg.addColorStop(1, '#0e1026');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const spot = ctx.createRadialGradient(W * 0.5, Game.SAFE_TOP + 220, 20, W * 0.5, Game.SAFE_TOP + 240, W * 0.8);
    spot.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
    spot.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);

    // 2. Rounded toy diorama playfield frame
    ctx.save();
    traceRoundRect(ctx, 20, Game.SAFE_TOP + 10, W - 40, Game.PLAY_HEIGHT - 20, 16);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // 3. Volumetric 3D toy items with subtle grounding shadows
    for (const it of this.items) {
      drawToyShadow(ctx, it.x, it.y + it.r * 1.2, it.r * 0.8, it.r * 0.3, 0.26);
      drawToySphere(ctx, it.x, it.y, it.r, it.color, {
        rimColor: toyRim(it.color, 0.56),
        lineWidth: toyLineW(it.r * 2, 0.048, 0.95, 2.0),
      });
    }

    // 4. Master 3D Vinyl Toy Jellybean Mascot + Grounding Shadow
    drawToyShadow(ctx, this.player.x, this.player.y + this.player.r * 1.15, this.player.r * 0.82, this.player.r * 0.32, 0.3);
    drawBean(ctx, this.player.x, this.player.y, this.player.r * 1.3, {
      color: '#00b4d8',
      bellyColor: '#90e0ef',
      walkT: this.time,
      eyes: this.dead ? 'squish' : 'happy',
      hat: this.prestige > 1 ? 'crown' : null,
      dead: this.dead,
    });

    // 5. Crisp Toy Bevel HUD Pill (Goal indicator)
    if (this.constructor.meta.isPrestige) {
      drawToyBevelRect(ctx, 28, Game.SAFE_TOP + 18, 152, 26, 11, '#0f172a', {
        depth: 2,
        rimColor: '#38bdf8',
        lineWidth: 1.6,
        gloss: false,
      });
      ctx.save();
      ctx.font = "700 11px 'Fredoka', 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`GOAL ${this.score.toLocaleString()} / ${this.targetScoreGoal.toLocaleString()}`, 104, Game.SAFE_TOP + 31.5);
      ctx.restore();
    }

    this.fx.render(ctx, 1);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 5. SERIALIZATION & PERSISTENCE
  // ---------------------------------------------------------------------------
  serialize() {
    return {
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
    };
  }

  restoreLabel() {
    return `Score ${this.score.toLocaleString()}`;
  }

  destroy() {}
}
