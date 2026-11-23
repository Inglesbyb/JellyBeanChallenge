// Shared Nintendo / Fall Guys 3D Vinyl Toy Canvas Kit (Single Source of Truth)
// Replaces harsh #000000 comic strokes with soft volumetric lighting, glossy specular highlights, and tinted rims.

const TAU = Math.PI * 2;
const shadeCache = new Map();

function clamp255(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseColor(color) {
  if (typeof color !== 'string') return null;
  const s = color.trim();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length === 6 || hex.length === 8) {
      const n = parseInt(hex.slice(0, 6), 16);
      if (!Number.isNaN(n)) {
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
    }
  }
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) {
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  const hsl = s.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i);
  if (hsl) {
    const h = ((Number(hsl[1]) % 360) + 360) % 360 / 360;
    const sat = Number(hsl[2]) / 100;
    const lig = Number(hsl[3]) / 100;
    if (sat === 0) {
      const v = lig * 255;
      return [v, v, v];
    }
    const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat;
    const p = 2 * lig - q;
    const hue2rgb = (t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    return [hue2rgb(h + 1 / 3) * 255, hue2rgb(h) * 255, hue2rgb(h - 1 / 3) * 255];
  }
  return null;
}

/**
 * Lighten (+amount in 0..1) or darken (-amount in -1..0) any hex/rgb/hsl color cleanly.
 */
export function shadeColor(color, amount = 0) {
  const key = `${color}|${Math.round(amount * 100)}`;
  const cached = shadeCache.get(key);
  if (cached) return cached;

  const rgb = parseColor(color);
  if (!rgb) return color;
  let [r, g, b] = rgb;
  if (amount >= 0) {
    const t = Math.min(1, amount);
    r += (255 - r) * t;
    g += (255 - g) * t;
    b += (255 - b) * t;
  } else {
    const t = 1 + Math.max(-1, amount);
    r *= t;
    g *= t;
    b *= t;
  }
  const out = `rgb(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)})`;
  if (shadeCache.size > 600) shadeCache.clear();
  shadeCache.set(key, out);
  return out;
}

/**
 * Blend two colors smoothly (t in 0..1).
 */
export function mixColor(c1, c2, t = 0.5) {
  const key = `${c1}+${c2}|${Math.round(t * 100)}`;
  const cached = shadeCache.get(key);
  if (cached) return cached;
  const a = parseColor(c1);
  const b = parseColor(c2);
  if (!a || !b) return c1;
  const k = Math.max(0, Math.min(1, t));
  const r = clamp255(a[0] + (b[0] - a[0]) * k);
  const g = clamp255(a[1] + (b[1] - a[1]) * k);
  const bl = clamp255(a[2] + (b[2] - a[2]) * k);
  const out = `rgb(${r}, ${g}, ${bl})`;
  if (shadeCache.size > 600) shadeCache.clear();
  shadeCache.set(key, out);
  return out;
}

/**
 * Rich, saturated dark-tinted rim color instead of flat #000000 ink.
 */
export function toyRim(color, depth = 0.52) {
  return mixColor(shadeColor(color, -depth), '#0f172a', 0.38);
}

/**
 * Proportional hairline rim stroke width so small sprites stay crisp without dark blobbing.
 */
export function toyLineW(size, ratio = 0.042, min = 0.75, max = 2.4) {
  return Math.max(min, Math.min(max, size * ratio));
}

export function drawToyShadow(ctx, x, y, rx, ry = rx * 0.36, alpha = 0.26) {
  ctx.save();
  ctx.fillStyle = `rgba(12, 20, 42, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function traceRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) * 0.5, Math.abs(h) * 0.5);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rr);
  } else {
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}

/**
 * Soft volumetric 3D vinyl sphere/orb with upper-left studio highlight and warm lower bounce.
 */
export function drawToySphere(ctx, x, y, r, color, opts = {}) {
  const {
    rimColor = toyRim(color, 0.55),
    lineWidth = toyLineW(r * 2, 0.042, 0.75, 2.2),
    shine = 0.72,
    bottomBounce = true,
  } = opts;

  ctx.save();
  const rad = Math.max(1, r);
  const g = ctx.createRadialGradient(-rad * 0.32 + x, -rad * 0.32 + y, rad * 0.08, x, y, rad);
  g.addColorStop(0, shadeColor(color, 0.54));
  g.addColorStop(0.36, color);
  g.addColorStop(0.84, shadeColor(color, -0.22));
  g.addColorStop(1, shadeColor(color, -0.36));

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, TAU);
  ctx.fill();

  if (bottomBounce && rad >= 5) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.ellipse(x + rad * 0.08, y + rad * 0.62, rad * 0.44, rad * 0.14, 0, 0, TAU);
    ctx.fill();
  }

  if (shine > 0 && rad >= 3.5) {
    ctx.fillStyle = `rgba(255, 255, 255, ${shine})`;
    ctx.beginPath();
    ctx.ellipse(x - rad * 0.32, y - rad * 0.35, rad * 0.28, rad * 0.14, -0.55, 0, TAU);
    ctx.fill();
  }

  if (lineWidth > 0) {
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Tactile 3D extruded Nintendo-style plastic block (optional front gloss bevel + 3D bottom lip).
 */
export function drawToyBevelRect(ctx, x, y, w, h, r, color, opts = {}) {
  const {
    depth = Math.max(2, Math.min(7, h * 0.18)),
    rimColor = toyRim(color, 0.58),
    lineWidth = toyLineW(Math.min(w, h), 0.045, 0.75, 2.0),
    gloss = true,
  } = opts;

  ctx.save();
  if (depth > 0) {
    ctx.fillStyle = shadeColor(color, -0.36);
    traceRoundRect(ctx, x, y + depth, w, h, r);
    ctx.fill();
    if (lineWidth > 0) {
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  const fg = ctx.createLinearGradient(x, y, x, y + h);
  fg.addColorStop(0, shadeColor(color, 0.28));
  fg.addColorStop(0.55, color);
  fg.addColorStop(1, shadeColor(color, -0.14));
  ctx.fillStyle = fg;
  traceRoundRect(ctx, x, y, w, h, r);
  ctx.fill();

  if (gloss && h >= 8 && w >= 10) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    traceRoundRect(ctx, x + 2, y + 1.5, Math.max(2, w - 4), Math.max(2, h * 0.28), Math.max(1, r - 1.5));
    ctx.fill();
  }

  if (lineWidth > 0) {
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = lineWidth;
    traceRoundRect(ctx, x, y, w, h, r);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Volumetric 3D toy pill / capsule with top studio sheen and soft rim.
 */
export function drawToyPill(ctx, x, y, w, h, color, opts = {}) {
  const {
    rimColor = toyRim(color, 0.54),
    lineWidth = toyLineW(Math.min(w, h), 0.04, 0.75, 2.0),
    gloss = true,
  } = opts;
  const r = Math.min(w, h) * 0.5;
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, shadeColor(color, 0.34));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shadeColor(color, -0.22));
  ctx.fillStyle = g;
  traceRoundRect(ctx, x, y, w, h, r);
  ctx.fill();

  if (gloss && h >= 8) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    traceRoundRect(ctx, x + r * 0.35, y + h * 0.1, Math.max(2, w - r * 0.7), Math.max(1.5, h * 0.24), r * 0.5);
    ctx.fill();
  }

  if (lineWidth > 0) {
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = lineWidth;
    traceRoundRect(ctx, x, y, w, h, r);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Crisp Toy-styled eyes without heavy black sclera rings: supports happy (^ ^), bright, angry, scared, dizzy.
 */
export function drawToyEyes(ctx, x, y, er, opts = {}) {
  const {
    spacing = er * 2.1,
    style = 'bright',
    lookX = 0.25,
    lookY = 0,
    ink = '#0f172a',
  } = opts;

  ctx.save();
  const r = Math.max(1.4, er);
  [-spacing * 0.5, spacing * 0.5].forEach((ox) => {
    const ex = x + ox;
    if (style === 'happy') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.4, r * 0.42);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, y + r * 0.22, r * 0.78, Math.PI * 1.15, Math.PI * 1.85, false);
      ctx.stroke();
    } else if (style === 'dizzy') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.3, r * 0.34);
      ctx.lineCap = 'round';
      const d = r * 0.58;
      ctx.beginPath();
      ctx.moveTo(ex - d, y - d);
      ctx.lineTo(ex + d, y + d);
      ctx.moveTo(ex + d, y - d);
      ctx.lineTo(ex - d, y + d);
      ctx.stroke();
    } else {
      // Bright glossy toy eyes (dark pupil with optional clean inner rim, bright white catchlights)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, y, r * 0.92, r * 1.05, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(0.75, r * 0.2);
      ctx.stroke();

      const px = ex + lookX * r * 0.36;
      const py = y + lookY * r * 0.3;
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.ellipse(px, py, r * 0.58, r * 0.68, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px - r * 0.2, py - r * 0.24, r * 0.24, 0, TAU);
      ctx.fill();
      if (r >= 3) {
        ctx.beginPath();
        ctx.arc(px + r * 0.18, py + r * 0.2, r * 0.11, 0, TAU);
        ctx.fill();
      }

      if (style === 'angry') {
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(1.4, r * 0.34);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - r * 0.95, y - r * 0.9);
        ctx.lineTo(ex + r * 0.85, y - r * 0.42);
        ctx.stroke();
      }
    }
  });
  ctx.restore();
}
