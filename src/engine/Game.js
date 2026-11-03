// Base class every reel game extends.
// Standard Playbook Contract: init(saved, score) -> update(dt) -> render() -> serialize()

export class Game {
  // Standard UI Safe Bounds on 450 x 800 portrait viewport
  static SAFE_TOP = 130;     // Space below header HUD (timer, pips, score, prestige badge)
  static SAFE_BOTTOM = 695;  // Space above bottom dock (title, hint, likes, mute)
  static PLAY_HEIGHT = 565;  // SAFE_BOTTOM - SAFE_TOP

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
    this.prestige = 1; // Injected by Reel before init() (1 = Round 1, 2 = Prestige II, etc.)
    this.fx = null;
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

  // Standard difficulty scaler: baseVal * (1 + pctPerRank * (prestige - 1))
  scaleStat(baseVal, pctPerRank = 0.2) {
    return baseVal * (1 + pctPerRank * (Math.max(1, this.prestige || 1) - 1));
  }

  // Helper to test if a Y coordinate is inside the interactive playable area
  isInSafeBounds(y, margin = 0) {
    return y >= (Game.SAFE_TOP + margin) && y <= (Game.SAFE_BOTTOM - margin);
  }

  destroy() {}
}
