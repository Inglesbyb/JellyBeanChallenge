import { store } from './store.js';

// Glossy Toy FX Layer (particles with specular shine, glowing rings, bold rounded floating numbers).
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
    if (this.parts.length > 180) return;
    const count = Math.min(n, 20);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life, max: life,
        size: size * (0.65 + Math.random() * 0.75),
        color, grav,
      });
    }
  }

  ring(x, y, color, maxR = 60, life = 0.45, w = 3) {
    if (this.rings.length > 10) this.rings.shift();
    this.rings.push({ x, y, color, maxR, life, max: life, w });
  }

  text(x, y, str, color = '#fff', size = 22, life = 0.65) {
    const existing = this.texts.find((t) => Math.hypot(t.x - x, t.y - y) < 60);
    if (existing) {
      if (str.startsWith('+') && existing.str.startsWith('+')) {
        const v1 = parseInt(existing.str.replace(/\D/g, ''), 10) || 0;
        const v2 = parseInt(str.replace(/\D/g, ''), 10) || 0;
        if (v1 > 0 && v2 > 0) {
          existing.str = `+${v1 + v2}`;
          existing.life = Math.min(existing.max, existing.life + 0.3);
          existing.color = color;
          existing.size = Math.min(28, existing.size + 1.5);
          return;
        }
      }
      y = existing.y - 26;
    }

    if (this.texts.length >= 6) {
      this.texts.shift();
    }
    this.texts.push({ x, y, str, color, size, life, max: life });
  }

  shake(mag = 6, t = 0.22) {
    this.shakeMag = Math.min(8, Math.max(this.shakeMag, mag));
    this.shakeT = Math.min(0.25, Math.max(this.shakeT, t));
    this.shakeDur = Math.max(this.shakeDur, this.shakeT);
  }

  screenShake(mag = 6, t = 0.22) {
    this.shake(mag, t);
  }

  offset() {
    if (this.shakeT <= 0 || store.settings?.screenShakeEnabled === false) return { x: 0, y: 0 };
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
      t.y -= 42 * dt;
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

  render(ctx, scale = 1) {
    const k = 1 / scale;
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      const pr = p.size * k * (0.45 + 0.55 * a);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr, 0, TAU);
      ctx.fill();

      // Tiny glossy droplet shine
      if (pr >= 1.8) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(p.x - pr * 0.28, p.y - pr * 0.28, pr * 0.34, 0, TAU);
        ctx.fill();
      }
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
    if (this.texts.length > 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      for (const t of this.texts) {
        const a = t.life / t.max;
        ctx.globalAlpha = Math.min(1, a * 2.2);
        const pop = 1 + Math.max(0, a - 0.8) * 0.75;
        ctx.font = `700 ${Math.round(t.size * k * pop)}px 'Fredoka', 'Outfit', system-ui, sans-serif`;
        ctx.lineWidth = Math.min(4.2, Math.max(2.2, t.size * 0.16)) * k;
        ctx.strokeStyle = '#0f172a';
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
    }
    ctx.globalAlpha = 1;
  }
}
