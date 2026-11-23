// Base class every reel game extends.
// Standard Playbook Contract: init(saved, score) -> update(dt) -> render() -> serialize()

export class Game {
  // Standard UI Safe Bounds on 450 x 800 portrait viewport
  static SAFE_TOP = 130;     // Space below header HUD (timer, pips, score, prestige badge)
  static SAFE_BOTTOM = 695;  // Space above bottom dock (title, hint, likes, mute)
  static PLAY_HEIGHT = 565;  // SAFE_BOTTOM - SAFE_TOP

  /**
   * Diminishing-returns asymptotic difficulty resolver shared by all games and the Reel HUD wrap.
   * Formula for prestige p >= 1 (n = p - 1):
   *   up:   base + (cap - base) * (1 - exp(-rate * n))
   *   down: base - (base - floor) * (1 - exp(-rate * n))
   */
  static resolveScaling(scalingSpec = {}, prestige = 1) {
    const p = Math.max(1, Math.round(Number(prestige) || 1));
    const n = p - 1;
    const values = {};
    const deltas = [];

    if (!scalingSpec || typeof scalingSpec !== 'object') {
      return { values, deltas };
    }

    for (const [key, spec] of Object.entries(scalingSpec)) {
      if (!spec || typeof spec !== 'object' || !Number.isFinite(spec.base)) continue;
      const isDown = spec.mode === 'down' || Number.isFinite(spec.floor);
      const rate = Number.isFinite(spec.rate) && spec.rate > 0 ? spec.rate : 0.18;
      const progress = n === 0 ? 0 : 1 - Math.exp(-rate * n);

      let raw;
      if (isDown) {
        const floor = Number.isFinite(spec.floor) ? spec.floor : spec.base * 0.5;
        raw = spec.base - (spec.base - floor) * progress;
      } else {
        const cap = Number.isFinite(spec.cap) ? spec.cap : spec.base * 1.6;
        raw = spec.base + (cap - spec.base) * progress;
      }

      const val = spec.round ? Math.round(raw) : raw;
      values[key] = val;

      if (n > 0 && spec.label) {
        const deltaText = Game.formatScalingDelta(spec, val);
        if (deltaText) deltas.push(deltaText);
      }
    }

    return { values, deltas };
  }

  static formatScalingDelta(spec, val) {
    if (!spec || !spec.label || !Number.isFinite(val)) return '';
    const diff = val - spec.base;
    if (Math.abs(diff) < 1e-4) return '';

    if (spec.deltaFormat === 'abs' || spec.base === 0) {
      const shown = spec.round ? Math.round(diff) : Number(diff.toFixed(2));
      if (shown === 0) return '';
      const sign = shown > 0 ? '+' : '';
      const unit = spec.unit || (spec.base === 0 && spec.cap <= 1 ? '%' : '');
      const num = unit === '%' && Math.abs(shown) <= 1 ? Math.round(shown * 100) : shown;
      return `${sign}${num}${unit} ${spec.label}`;
    }

    const pct = Math.round(((val - spec.base) / Math.abs(spec.base)) * 100);
    if (pct === 0) {
      const shown = spec.round ? Math.round(diff) : Number(diff.toFixed(1));
      if (shown === 0) return '';
      return `${shown > 0 ? '+' : ''}${shown}${spec.unit || ''} ${spec.label}`;
    }
    return `${pct > 0 ? '+' : ''}${pct}% ${spec.label}`;
  }

  constructor(ctx, W, H, env) {
    this.ctx = ctx;
    this.W = W;
    this.H = H;
    this.input = env.input;
    this.sounds = env.sounds;
    this.haptics = env.haptics;

    // Run status & lifecycle
    this.dead = false;
    this.deathReason = '';
    this.won = false;
    this.winReason = '';
    this.score = 0;
    this.grace = 0; // seconds of invulnerability (used after a state restore)
    this.time = 0;
    this.prestige = 1; // Injected by Reel before init() (1 = Prestige 1, 2 = Prestige 2, etc.)
    this.pLevel = 1;
    this.diff = {};
    this.diffDeltas = [];
    this.fx = null;

    this.applyPrestige(1);
  }

  // Called by Reel before init() (and available for standalone testing)
  applyPrestige(prestige = 1) {
    this.prestige = Math.max(1, Math.round(Number(prestige) || 1));
    this.pLevel = this.prestige;
    const spec = this.constructor?.meta?.scaling || {};
    const resolved = Game.resolveScaling(spec, this.prestige);
    this.diff = resolved.values;
    this.diffDeltas = resolved.deltas;
    return this.diff;
  }

  init(saved, score = 0) {}
  update(dt) {}
  render() {}
  serialize() {
    return {};
  }
  restoreLabel() {
    return '';
  }

  // Called while the death banner is showing so effects can finish animating.
  updateDying(dt) {
    if (this.fx) this.fx.update(dt);
  }

  // Trigger elimination for this run
  die(reason) {
    if (this.dead || this.won || this.grace > 0 || (typeof this.isMaxSize === 'function' && this.isMaxSize())) {
      return false;
    }
    this.dead = true;
    this.deathReason = reason;
    return true;
  }

  // Trigger stage completion (Prestige Level Up + Bonus + Fresh Reset next cycle)
  complete(reason = 'Stage Cleared!') {
    if (this.won || this.dead) return false;
    this.won = true;
    this.winReason = reason;
    return true;
  }

  // Bounded diminishing-returns scaler (kept for backward compatibility & ad-hoc scaling)
  scaleStat(baseVal, pctPerRank = 0.2, maxMult = 1.85) {
    const n = Math.max(0, (this.prestige || 1) - 1);
    if (n === 0) return baseVal;
    const mult = 1 + (maxMult - 1) * (1 - Math.exp(-pctPerRank * n));
    return baseVal * mult;
  }

  // Helper to test if a Y coordinate is inside the interactive playable area
  isInSafeBounds(y, margin = 0) {
    return y >= (Game.SAFE_TOP + margin) && y <= (Game.SAFE_BOTTOM - margin);
  }

  destroy() {}
}
