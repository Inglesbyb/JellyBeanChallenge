// Unified pointer/touch/keyboard input mapped into logical game coordinates.
export class Input {
  constructor(canvas, W, H) {
    this.canvas = canvas;
    this.W = W;
    this.H = H;
    this.keys = new Set();
    this.reset();

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const [x, y] = this.map(e);
      this.down = true;
      this.pressed = true;
      this.x = this.startX = this.anchorX = this.lastX = x;
      this.y = this.startY = this.anchorY = y;
    }, opts);

    canvas.addEventListener('pointermove', (e) => {
      const [x, y] = this.map(e);
      if (this.down) this.frameDX += x - this.x;
      this.x = x;
      this.y = y;
    }, opts);

    const up = (e) => {
      if (!this.down) return;
      const [x, y] = this.map(e);
      this.x = x;
      this.y = y;
      this.down = false;
      this.released = true;
    };
    canvas.addEventListener('pointerup', up, opts);
    canvas.addEventListener('pointercancel', up, opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.down = false; });
  }

  map(e) {
    const r = this.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * this.W, ((e.clientY - r.top) / r.height) * this.H];
  }

  reset() {
    this.down = false;
    this.pressed = false;
    this.released = false;
    this.frameDX = 0;
    this.x = this.W / 2;
    this.y = this.H / 2;
    this.startX = this.startY = this.anchorX = this.anchorY = this.lastX = 0;
  }

  endFrame() {
    this.pressed = false;
    this.released = false;
    this.frameDX = 0;
  }

  key(...names) {
    return names.some((n) => this.keys.has(n));
  }

  keyVec() {
    const kx = (this.key('arrowright', 'd') ? 1 : 0) - (this.key('arrowleft', 'a') ? 1 : 0);
    const ky = (this.key('arrowdown', 's') ? 1 : 0) - (this.key('arrowup', 'w') ? 1 : 0);
    if (!kx && !ky) return null;
    const m = Math.hypot(kx, ky);
    return { x: kx / m, y: ky / m };
  }

  // Floating-joystick vector (|v| <= 1). The anchor trails the finger so
  // direction changes feel instant no matter how far you've dragged.
  vec(maxLen = 60) {
    const k = this.keyVec();
    if (k) return k;
    if (!this.down) return { x: 0, y: 0 };
    let dx = this.x - this.anchorX;
    let dy = this.y - this.anchorY;
    let d = Math.hypot(dx, dy);
    const leash = maxLen * 1.4;
    if (d > leash) {
      const f = (d - leash) / d;
      this.anchorX += dx * f;
      this.anchorY += dy * f;
      dx = this.x - this.anchorX;
      dy = this.y - this.anchorY;
      d = Math.hypot(dx, dy);
    }
    if (d < 4) return { x: 0, y: 0 };
    const m = Math.min(1, d / maxLen);
    return { x: (dx / d) * m, y: (dy / d) * m };
  }
}
