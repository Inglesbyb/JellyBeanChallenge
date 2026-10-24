// Base class every reel game extends.
// Contract: init(saved, score) -> update(dt) -> render() -> serialize()
export class Game {
  constructor(ctx, W, H, env) {
    this.ctx = ctx;
    this.W = W;
    this.H = H;
    this.input = env.input;
    this.sounds = env.sounds;
    this.haptics = env.haptics;
    this.dead = false;
    this.deathReason = '';
    this.score = 0;
    this.grace = 0; // seconds of invulnerability (used after a state restore)
    this.time = 0;
  }

  init() {}
  update() {}
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

  die(reason) {
    if (this.dead || this.grace > 0 || (typeof this.isMaxSize === 'function' && this.isMaxSize())) return false;
    this.dead = true;
    this.deathReason = reason;
    return true;
  }

  destroy() {}
}
