// Lightweight particle / ring / floating-text effects layer.
// Renders in whatever coordinate space the caller has active.
const TAU = Math.PI * 2;

export class FX {
  constructor() {
    this.parts = [];
    this.rings = [];
    this.texts = [];
    this.shakeMag = 0;
    this.shakeT = 0;
    this.shakeDur = 0.0001;
  }

  burst(x, y, color, n = 12, speed = 160, life = 0.6, size = 3, grav = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life, max: life,
        size: size * (0.6 + Math.random() * 0.8),
        color, grav,
      });
    }
  }

  ring(x, y, color, maxR = 60, life = 0.45, w = 3) {
    this.rings.push({ x, y, color, maxR, life, max: life, w });
  }

  text(x, y, str, color = '#fff', size = 22, life = 0.9) {
    this.texts.push({ x, y, str, color, size, life, max: life });
  }

  shake(mag = 6, t = 0.25) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, t);
    this.shakeDur = Math.max(this.shakeDur, t);
  }

  screenShake(mag = 6, t = 0.25) {
    this.shake(mag, t);
  }

  offset() {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const k = (this.shakeT / this.shakeDur) * this.shakeMag;
    return { x: (Math.random() - 0.5) * 2 * k, y: (Math.random() - 0.5) * 2 * k };
  }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 38 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) {
        this.shakeMag = 0;
        this.shakeDur = 0.0001;
      }
    }
  }

  // scale = camera zoom, so lines & text keep a constant on-screen size
  render(ctx, scale = 1) {
    const k = 1 / scale;
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * k, 0, TAU);
      ctx.fill();
    }
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w * k;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.maxR * k * (0.15 + 0.85 * t), 0, TAU);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const a = t.life / t.max;
      ctx.globalAlpha = Math.min(1, a * 2);
      const pop = 1 + Math.max(0, a - 0.75) * 1.4;
      ctx.font = `900 ${t.size * k * pop}px Outfit, system-ui, sans-serif`;
      ctx.lineWidth = 4 * k;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
