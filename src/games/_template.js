/**
 * ============================================================================
 * GAME REELS - STANDARDIZED GAME PLAYBOOK TEMPLATE
 * ============================================================================
 * 
 * Copy and rename this file to create any new minigame for Game Reels.
 * Follow the 5 Core Tenets below to ensure seamless engine integration:
 *
 * 1. GAME TYPE: Choose either:
 *    - `isPrestige: true`  -> Milestone/growth game. Completing triggers stage
 *                             clear, banks score bonus, discards the maxed board,
 *                             and restarts fresh at Prestige Rank +1 on next cycle.
 *    - `isPrestige: false` -> Continuous/endless runner or deep crawler (like Motherload).
 *                             Saves board/upgrades across cycles; never resets unless player dies.
 *
 * 2. SAFE VIEWPORT BOUNDS (W = 450, H = 800):
 *    - Top HUD Safe Zone: Y = 0 to 125 (reserved for Timer, Pips, Score, Cycle & Prestige Badge).
 *    - Playable Area: Y = 130 to 695 (keep all gameplay and primary interaction here).
 *    - Bottom Dock Safe Zone: Y = 700 to 800 (reserved for Game Title, Hint, Likes & Mute).
 *    - Helper: `this.isInSafeBounds(y)`
 *
 * 3. PRESTIGE DIFFICULTY SCALING:
 *    - Use `this.scaleStat(baseValue, percentPerRank)` to easily tune speed, HP, or spawn rates.
 *      Example: `this.enemySpeed = this.scaleStat(150, 0.15); // +15% per prestige rank`
 *
 * 4. COMPLETION & DEATH:
 *    - Win/Stage Clear: Call `this.complete('Milestone description! 👑')`.
 *    - Loss/Elimination: Call `this.die('Cause of death! 💀')`.
 *
 * 5. REGISTRATION IN src/engine/Reel.js:
 *    - Import your class and add it to the `GAMES` array. Done!
 * ============================================================================
 */

import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export class TemplateGame extends Game {
  // ---------------------------------------------------------------------------
  // 1. METADATA SPECIFICATION
  // ---------------------------------------------------------------------------
  static meta = {
    id: 'template-game',               // Unique slug (kebab-case)
    title: 'Template Quest',           // Display name in HUD & banners
    icon: '🎮',                        // Emoji icon for pips & chips
    hint: 'DRAG to move · TAP to act · achieve goal before 60s expires!',
    baseLikes: 2500,                   // Starting social like count
    isPrestige: true,                  // true = milestone/prestige, false = continuous/endless
    roundLen: 60,                      // Default round length in seconds (normally 60)
  };

  // ---------------------------------------------------------------------------
  // 2. INITIALIZATION & STATE RESTORE
  // ---------------------------------------------------------------------------
  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    // Prestige rank is injected by the engine before init() (1 = Round 1, 2 = Prestige II...)
    // Use this.scaleStat(base, pctPerRank) to calculate difficulty parameters:
    this.playerSpeed = 220;
    this.hazardSpeed = this.scaleStat(140, 0.12);     // +12% speed per prestige rank
    this.targetScoreGoal = this.scaleStat(3000, 0.25); // +25% target per prestige rank

    // Player entity state
    this.player = {
      x: this.W / 2,
      y: 520,
      r: 22,
      vx: 0,
      vy: 0,
    };

    // Game objects / hazards / items
    this.items = [];
    this.spawnTimer = 0;

    // Restore frozen snapshot if returning from a previous cycle in the same run
    if (saved) {
      if (Number.isFinite(saved.x)) this.player.x = saved.x;
      if (Number.isFinite(saved.y)) this.player.y = saved.y;
      this.grace = 1.5; // Seconds of invulnerability upon resume
    } else {
      this.grace = 0.5;
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

    // 1. Process Input
    // Drag / virtual stick: returns normalized vector { x, y } clamped to radius 50px
    const stick = this.input.vec(50);
    this.player.vx = stick.x * this.playerSpeed;
    this.player.vy = stick.y * this.playerSpeed;

    // Move player and clamp strictly inside the SAFE PLAYABLE AREA
    this.player.x = clamp(this.player.x + this.player.vx * dt, 30, this.W - 30);
    this.player.y = clamp(this.player.y + this.player.vy * dt, Game.SAFE_TOP + 30, Game.SAFE_BOTTOM - 30);

    // Tap/Click handling
    if (this.input.pressed) {
      this.sounds.pop?.() || this.sounds.slice?.();
      this.haptics.light();
      this.fx.burst(this.input.pos.x, this.input.pos.y, '#ffd166', 8, 120, 0.4, 3);
    }

    // 2. Spawn & Update Items/Hazards
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.4, 1.2 - 0.1 * (this.prestige - 1));
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

      // Collision with player
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

      // Despawn at bottom of safe zone
      if (it.y > Game.SAFE_BOTTOM) {
        this.items.splice(i, 1);
      }
    }

    // 3. Stage Completion Milestone Trigger (Prestige Games Only)
    if (this.constructor.meta.isPrestige && this.score >= this.targetScoreGoal && !this.won) {
      this.sounds.survive?.();
      this.haptics.success();
      this.fx.ring(this.W / 2, this.H / 2, '#ffd166', 320, 1.0, 8);
      // Calling complete() marks the game cleared, awards completion bonus,
      // and advances the game to Prestige Level + 1 on the next cycle!
      this.complete(`Target Score of ${this.targetScoreGoal.toLocaleString()} Cleared! 👑`);
      return;
    }

    // 4. Death Condition (Loss / Elimination)
    // if (playerHitFatalHazard && this.grace <= 0) {
    //   this.sounds.fail?.();
    //   this.haptics.fail();
    //   this.die('Crushed by falling confectionery! 💀');
    // }
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

    // 1. Stylized Background Gradient (Candy / Jelly Aesthetic)
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#15102a');
    bg.addColorStop(0.5, '#241442');
    bg.addColorStop(1, '#0e0b1f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 2. Playable Field Boundary / Subtle Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, Game.SAFE_TOP + 10, W - 40, Game.PLAY_HEIGHT - 20);

    // 3. Render Game Items
    for (const it of this.items) {
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 4. Render Mascot Player Bean using standard drawBean()
    drawBean(ctx, this.player.x, this.player.y, this.player.r * 1.3, {
      color: '#00b4d8',
      bellyColor: '#90e0ef',
      eyes: this.dead ? 'cross' : 'happy',
      hat: this.prestige > 1 ? 'crown' : null, // Crown the player bean on prestige cycles!
    });

    // 5. Render Particle FX (burts, rings, floating score text)
    this.fx.render(ctx, 1);

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 5. SERIALIZATION & PERSISTENCE
  // ---------------------------------------------------------------------------
  // Returns state to freeze when the 60s timer expires.
  // NOTE: If the game was completed, Reel.js automatically discards this snapshot
  // and starts the game fresh on the next prestige cycle.
  serialize() {
    return {
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
    };
  }

  // Text shown in the "Welcome back — [restoreLabel]" toast upon re-entry
  restoreLabel() {
    return `Score ${this.score.toLocaleString()}`;
  }

  // Cleanup listeners or physics engines when game is unloaded
  destroy() {
    // e.g. removeEventListener or Composite.clear()
  }
}
