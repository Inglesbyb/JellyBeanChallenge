/**
 * @file weeblAtlas.js
 * Single Source of Truth (SSOT) for Citadel Siege's HD Flash Cel-Cartoon
 * ("Weebl's Stuff") visual language, modular sprite atlas, rig geometry,
 * and shared procedural ink/FX helpers.
 *
 * Strictly SSR/headless-safe: all Image allocations guard `typeof Image !== 'undefined'`.
 */
import { drawHero3D, HERO_3D_VIEWS, isHero3DSupported } from '../engine/hero3d.js';

export const HERO_VIEWS = HERO_3D_VIEWS;
export const HERO_STATES = [
  'idle',
  'stand_alert',
  'walk',
  'run',
  'jump',
  'jump_launch',
  'fall_dive',
  'hop_leap',
  'slide',
  'surf',
  'jetpack',
  'swim',
  'turret_fire',
  'pilot',
  'aim_pull',
  'throw',
  'steer_fire',
  'balance',
  'drop_push',
  'wobble',
  'cheer',
  'hurt',
  'dead',
];

export const STYLE_TOKENS = {
  ink: '#000000',
  inkSoft: '#09090b',
  inkThin: 2,
  inkMed: 3,
  inkBold: 4,
  shadowColor: 'rgba(0, 0, 0, 0.92)',
  shadowDx: 3,
  shadowDy: 4,
  celFlash: '#ffffff',
  skyTop: '#2563eb',
  skyMid: '#38bdf8',
  skyLow: '#bae6fd',
  skyHorizon: '#fef08a',
  sunburstGold: '#facc15',
  sunburstOrange: '#f97316',
  sunburstRed: '#dc2626',
  sunburstCrimson: '#b91c1c',
  grassTop: '#22c55e',
  grassEdge: '#4ade80',
  lavaOuter: '#ea580c',
  lavaMid: '#f97316',
  lavaCore: '#facc15',
  lavaHot: '#fef08a',
  fontDisplay: '900 18px "Fredoka", "Arial Black", "Impact", sans-serif',
};

const BASE_PATH = './assets/weebl/';
const CITY_PATH = './assets/weebl/city/';

export const SPRITE_ATLAS = {
  // Characters & Forge
  brim_cloak: { file: `${BASE_PATH}brim_cloak.png`, w: 279, h: 338, anchorX: 0.5, anchorY: 1.0 },
  brim_head_hat: { file: `${BASE_PATH}brim_head_hat.png`, w: 320, h: 332, anchorX: 0.5, anchorY: 0.62 },
  brim_glove_l: { file: `${BASE_PATH}brim_glove_l.png`, w: 248, h: 275, anchorX: 0.5, anchorY: 0.5 },
  brim_glove_r: { file: `${BASE_PATH}brim_glove_r.png`, w: 259, h: 242, anchorX: 0.5, anchorY: 0.5 },
  hero_bean: { file: `${BASE_PATH}hero_bean.png`, w: 225, h: 318, anchorX: 0.5, anchorY: 0.95 },
  hero_bean_crowned: { file: './assets/world1/hero-bean-map.png', w: 180, h: 220, anchorX: 0.5, anchorY: 0.94 },
  balloon_imp: { file: `${BASE_PATH}balloon_imp.png`, w: 179, h: 362, anchorX: 0.5, anchorY: 0.68 },
  anvil_stump: { file: `${BASE_PATH}anvil_stump.png`, w: 313, h: 308, anchorX: 0.5, anchorY: 1.0, topTableY: 0.023 },
  sledgehammer: { file: `${BASE_PATH}sledgehammer.png`, w: 329, h: 160, anchorX: 0.90, anchorY: 0.50, headCenterX: 0.190 },

  // Liverpool Toy City Kit (Void Eater)
  city_donut_shop: { file: `${CITY_PATH}city_donut_shop.png`, w: 421, h: 461, anchorX: 0.5, anchorY: 0.64 },
  city_superlambanana: { file: `${CITY_PATH}city_superlambanana.png`, w: 329, h: 456, anchorX: 0.5, anchorY: 0.68 },
  city_double_decker: { file: `${CITY_PATH}city_double_decker.png`, w: 409, h: 447, anchorX: 0.5, anchorY: 0.58 },
  city_yellow_taxi: { file: `${CITY_PATH}city_yellow_taxi.png`, w: 418, h: 344, anchorX: 0.5, anchorY: 0.58 },
  city_liver_building: { file: `${CITY_PATH}city_liver_building.png`, w: 395, h: 477, anchorX: 0.5, anchorY: 0.68 },
  city_metro_cathedral: { file: `${CITY_PATH}city_metro_cathedral.png`, w: 429, h: 469, anchorX: 0.5, anchorY: 0.68 },
  city_st_jelly_hall: { file: `${CITY_PATH}city_st_jelly_hall.png`, w: 424, h: 423, anchorX: 0.5, anchorY: 0.66 },
  city_palm_house: { file: `${CITY_PATH}city_palm_house.png`, w: 414, h: 441, anchorX: 0.5, anchorY: 0.68 },

  // Castle Kit & Ammo
  p_stone_pillar: { file: `${BASE_PATH}p_stone_pillar.png`, w: 194, h: 288, anchorX: 0.5, anchorY: 0.5 },
  p_stone_battlement: { file: `${BASE_PATH}p_stone_battlement.png`, w: 326, h: 173, anchorX: 0.5, anchorY: 0.5 },
  p_roof_side: { file: `${BASE_PATH}p_roof_side.png`, w: 324, h: 243, anchorX: 0.5, anchorY: 0.96 },
  p_roof_center: { file: `${BASE_PATH}p_roof_center.png`, w: 249, h: 285, anchorX: 0.5, anchorY: 0.96 },
  b_obsidian_pillar: { file: `${BASE_PATH}b_obsidian_pillar.png`, w: 181, h: 304, anchorX: 0.5, anchorY: 0.5 },
  b_stone_bridge: { file: `${BASE_PATH}b_stone_bridge.png`, w: 336, h: 153, anchorX: 0.5, anchorY: 0.5 },
  b_wood_brace: { file: `${BASE_PATH}b_wood_brace.png`, w: 279, h: 257, anchorX: 0.5, anchorY: 0.5 },
  b_glass_arch: { file: `${BASE_PATH}b_glass_arch.png`, w: 214, h: 308, anchorX: 0.5, anchorY: 0.5 },
  b_tnt_barrel: { file: `${BASE_PATH}b_tnt_barrel.png`, w: 200, h: 232, anchorX: 0.5, anchorY: 0.5 },
  b_crate_chest: { file: `${BASE_PATH}b_crate_chest.png`, w: 260, h: 204, anchorX: 0.5, anchorY: 0.5 },
  b_purple_spire: { file: `${BASE_PATH}b_purple_spire.png`, w: 206, h: 273, anchorX: 0.5, anchorY: 0.5 },
  slingshot_fork: { file: `${BASE_PATH}slingshot_fork.png`, w: 161, h: 226, anchorX: 0.5, anchorY: 1.0, leftHornNX: 0.192, rightHornNX: 0.801, hornNY: 0.14 },
  boulder_rock: { file: `${BASE_PATH}boulder_rock.png`, w: 181, h: 183, anchorX: 0.5, anchorY: 0.5 },

  // Stage & HUD
  cliff_left: { file: `${BASE_PATH}cliff_left.png`, w: 405, h: 288, anchorX: 0.5, anchorY: 0.0 },
  cliff_right: { file: `${BASE_PATH}cliff_right.png`, w: 418, h: 286, anchorX: 0.5, anchorY: 0.0 },
  stone_bastion_pedestal: { file: `${BASE_PATH}stone_bastion_pedestal.png`, w: 385, h: 286, anchorX: 0.5, anchorY: 1.0 },
  flaming_mortar: { file: `${BASE_PATH}flaming_mortar.png`, w: 342, h: 178, anchorX: 0.28, anchorY: 0.5 },
  cloud_1: { file: `${BASE_PATH}cloud_1.png`, w: 229, h: 136, anchorX: 0.5, anchorY: 0.5 },
  cloud_2: { file: `${BASE_PATH}cloud_2.png`, w: 200, h: 116, anchorX: 0.5, anchorY: 0.5 },
  hud_heart: { file: `${BASE_PATH}hud_heart.png`, w: 129, h: 117, anchorX: 0.5, anchorY: 0.5 },
  hud_gear: { file: `${BASE_PATH}hud_gear.png`, w: 131, h: 131, anchorX: 0.5, anchorY: 0.5 },
  sky_moon: { file: `${BASE_PATH}sky_moon.png`, w: 126, h: 131, anchorX: 0.5, anchorY: 0.5 },
};

/**
 * Exact measured pixel sockets of stone_bastion_pedestal.png (385x286).
 * Pedestal spans x = 108 ± 59 (= 49..167) and top table sits near SLING-friendly height.
 */
export const PEDESTAL_GEO = {
  drawX: 108,
  bottomY: 590,
  drawW: 118,
  drawH: 76,
  slotNX: [0.182, 0.334, 0.491, 0.649, 0.803],
  slotNY: 0.566,
};

/**
 * Exact measured Y-fork horn sockets of slingshot_fork.png (161x226).
 * At drawH = 65 & bottomY = 542, crotch sits at y = 500.6 (right on SLING.y = 502).
 */
export const SLING_GEO = {
  baseX: 108,
  bottomY: 542,
  drawW: 46,
  drawH: 65,
  leftHornNX: 0.192,
  rightHornNX: 0.801,
  hornNY: 0.14,
};

export function getPedestalSlotPos(slotIdx) {
  const i = Math.max(0, Math.min(4, slotIdx));
  return {
    x: PEDESTAL_GEO.drawX + (PEDESTAL_GEO.slotNX[i] - 0.5) * PEDESTAL_GEO.drawW,
    y: PEDESTAL_GEO.bottomY - (1 - PEDESTAL_GEO.slotNY) * PEDESTAL_GEO.drawH,
  };
}

export function getSlingHornPoints() {
  const leftEdge = SLING_GEO.baseX - SLING_GEO.drawW * 0.5;
  const topEdge = SLING_GEO.bottomY - SLING_GEO.drawH;
  const hy = topEdge + SLING_GEO.hornNY * SLING_GEO.drawH;
  return {
    left: { x: leftEdge + SLING_GEO.leftHornNX * SLING_GEO.drawW, y: hy },
    right: { x: leftEdge + SLING_GEO.rightHornNX * SLING_GEO.drawW, y: hy },
    pouchRest: { x: SLING_GEO.baseX, y: hy + 2 },
  };
}

const _spriteCache = new Map();

export function preloadWeeblAtlas() {
  for (const id of Object.keys(SPRITE_ATLAS)) {
    getSprite(id);
  }
}

export function getSprite(id) {
  const meta = SPRITE_ATLAS[id];
  if (!meta) return null;
  if (_spriteCache.has(id)) return _spriteCache.get(id);
  if (typeof Image === 'undefined') return null;

  const img = new Image();
  const entry = {
    img,
    meta,
    failed: false,
    ready() {
      return !this.failed && this.img.complete && this.img.naturalWidth > 0;
    },
  };
  img.onerror = () => {
    entry.failed = true;
  };
  img.src = meta.file;
  _spriteCache.set(id, entry);
  return entry;
}

/**
 * Draw an atlas sprite anchored cleanly around its SSOT pivot, with optional
 * rotation, horizontal flip, squash/stretch, white impact tinting, or SSR fallback.
 */
export function drawSprite(ctx, id, x, y, w, h, opts = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(w > 0) || !(h > 0)) return false;
  const meta = SPRITE_ATLAS[id];
  if (!meta) return false;

  const sp = getSprite(id);
  const ready = !!(sp && sp.ready());
  const ax = opts.anchorX ?? meta.anchorX ?? 0.5;
  const ay = opts.anchorY ?? meta.anchorY ?? 0.5;
  const rot = opts.rot || 0;
  const sx = (opts.flipX ? -1 : 1) * (opts.sx ?? 1);
  const sy = opts.sy ?? 1;
  const alpha = opts.alpha ?? 1;

  if (!ready && typeof opts.fallback !== 'function') return false;

  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  if (alpha !== 1) ctx.globalAlpha *= alpha;

  const drawX = -w * ax;
  const drawY = -h * ay;
  if (ready) {
    ctx.drawImage(sp.img, drawX, drawY, w, h);
    if (opts.flashAlpha > 0) {
      // Crisp cel-white flash cutout
      ctx.globalAlpha *= Math.min(0.85, opts.flashAlpha);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(drawX + w * 0.5, drawY + h * 0.5, w * 0.42, h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    opts.fallback(ctx, w, h, ax, ay, drawX, drawY);
  }
  ctx.restore();
  return ready;
}

/**
 * Tile `b_wood_brace` cleanly along a beam centered at (0, 0) so diagonal X-bracing
 * never squashes or distorts on tall vertical posts or wide horizontal lintels.
 */
export function drawWoodTrussTile(ctx, w, h) {
  if (!(w > 0) || !(h > 0)) return;
  const sp = getSprite('b_wood_brace');
  const ready = !!(sp && sp.ready());
  const horizontal = w >= h;
  const shortSide = Math.max(8, horizontal ? h : w);
  const longSide = horizontal ? w : h;
  const count = Math.max(1, Math.min(6, Math.round(longSide / shortSide)));
  const step = longSide / count;

  if (!ready) {
    ctx.fillStyle = '#b45309';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.rect(-w * 0.5, -h * 0.5, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    for (let i = 0; i < count; i++) {
      const tx = horizontal ? -w * 0.5 + i * step : -w * 0.5;
      const ty = horizontal ? -h * 0.5 : -h * 0.5 + i * step;
      const tw = horizontal ? step : w;
      const th = horizontal ? h : step;
      ctx.beginPath();
      ctx.moveTo(tx + 2, ty + 2);
      ctx.lineTo(tx + tw - 2, ty + th - 2);
      ctx.moveTo(tx + tw - 2, ty + 2);
      ctx.lineTo(tx + 2, ty + th - 2);
      ctx.stroke();
    }
    return;
  }

  for (let i = 0; i < count; i++) {
    const tx = horizontal ? -w * 0.5 + i * step : -w * 0.5;
    const ty = horizontal ? -h * 0.5 : -h * 0.5 + i * step;
    const tw = horizontal ? step + 1 : w;
    const th = horizontal ? h : step + 1;
    ctx.drawImage(sp.img, tx, ty, tw, th);
  }
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.2;
  ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
}

/**
 * Draw sharp angular comic cracks onto damaged blocks (centered at 0,0).
 */
export function drawStoneCrackOverlay(ctx, w, h, hpRatio, isDark = false) {
  if (hpRatio >= 0.85) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const crackColor = isDark ? '#f8fafc' : '#000000';
  const edgeHighlight = isDark ? '#000000' : 'rgba(255,255,255,0.45)';

  // Edge highlight slightly shifted for tactile comic depth
  ctx.strokeStyle = edgeHighlight;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-w * 0.24, -h * 0.44);
  ctx.lineTo(-w * 0.04, -h * 0.14);
  ctx.lineTo(w * 0.16, 2);
  if (hpRatio < 0.55) {
    ctx.moveTo(w * 0.16, 2);
    ctx.lineTo(-w * 0.10, h * 0.34);
  }
  ctx.stroke();

  ctx.strokeStyle = crackColor;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-w * 0.26, -h * 0.45);
  ctx.lineTo(-w * 0.06, -h * 0.15);
  ctx.lineTo(w * 0.14, 0);
  if (hpRatio < 0.55) {
    ctx.lineTo(w * 0.28, h * 0.20);
    ctx.moveTo(w * 0.14, 0);
    ctx.lineTo(-w * 0.12, h * 0.33);
  }
  if (hpRatio < 0.30) {
    ctx.moveTo(w * 0.24, -h * 0.40);
    ctx.lineTo(w * 0.02, -h * 0.04);
    ctx.lineTo(-w * 0.28, h * 0.18);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Classic Weebl radial sunburst pinwheel backdrop behind Lord Brim.
 */
export function drawSunburst(ctx, cx, cy, radius, rot = 0, rays = 14, intensity = 1, rage = false) {
  if (!(radius > 0) || rays < 4) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();

  ctx.globalAlpha *= intensity;
  const step = (Math.PI * 2) / (rays * 2);
  const colA = rage ? '#ef4444' : STYLE_TOKENS.sunburstGold;
  const colB = rage ? '#7f1d1d' : STYLE_TOKENS.sunburstRed;
  const ringFade = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius);
  ringFade.addColorStop(0, '#fef08a');
  ringFade.addColorStop(1, colA);

  for (let i = 0; i < rays * 2; i++) {
    const a0 = rot + i * step;
    const a1 = a0 + step + 0.008;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * radius * 1.1, Math.sin(a0) * radius * 1.1);
    ctx.lineTo(Math.cos(a1) * radius * 1.1, Math.sin(a1) * radius * 1.1);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? ringFade : colB;
    ctx.fill();
  }

  // Bold cartoon perimeter ring on sunburst disk edge when desired
  ctx.globalAlpha = 0.25 * intensity;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Crisp Weebl / Flash comic rounded rectangle panel with thick black ink & hard drop-shadow.
 */
export function drawComicPanel(ctx, x, y, w, h, r = 10, fill = '#1e293b', opts = {}) {
  if (!(w > 0) || !(h > 0)) return;
  const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  const ink = opts.stroke || STYLE_TOKENS.ink;
  const lineW = opts.lineWidth ?? STYLE_TOKENS.inkMed;
  const sdx = opts.shadowDx ?? STYLE_TOKENS.shadowDx;
  const sdy = opts.shadowDy ?? STYLE_TOKENS.shadowDy;

  ctx.save();
  if (sdx !== 0 || sdy !== 0) {
    ctx.fillStyle = opts.shadowColor || STYLE_TOKENS.shadowColor;
    ctx.beginPath();
    ctx.roundRect(x + sdx, y + sdy, w, h, rad);
    ctx.fill();
  }

  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
  ctx.fill();

  if (opts.glossTop !== false && h > 16) {
    ctx.fillStyle = opts.glossColor || 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.roundRect(x + lineW, y + lineW * 0.8, Math.max(4, w - lineW * 2), Math.max(4, h * 0.34), Math.max(2, rad - 2));
    ctx.fill();
  }

  ctx.strokeStyle = ink;
  ctx.lineWidth = lineW;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
  ctx.stroke();
  ctx.restore();
}

/**
 * Spiky Flash comic impact starburst (for Anvil hits, Mortar explosions, Ko bursts).
 */
export function drawComicStarburst(ctx, cx, cy, outerR, innerR, spikes = 9, fill = '#facc15', stroke = '#000000', rot = 0, lineW = 3) {
  if (!(outerR > 0) || spikes < 3) return;
  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.beginPath();
  const total = spikes * 2;
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / total) * Math.PI * 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke && lineW > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineW;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Bold Flash-cartoon outlined typography helper.
 */
export function drawComicText(ctx, text, x, y, font, fill = '#ffffff', opts = {}) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.baseline || 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (opts.shadow) {
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x + (opts.shadowDx ?? 2), y + (opts.shadowDy ?? 2.5));
  }

  ctx.strokeStyle = opts.stroke || '#000000';
  ctx.lineWidth = opts.strokeWidth ?? 4.2;
  ctx.strokeText(text, x, y);

  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Draw an expressive HD Flash Cel-Cartoon Weebl Jellybean ("#000" outer contour + 2-tone shading).
 * Used for custom skins/hats, threat/angry expressions, rival beans, and SSR vector fallbacks.
 */
export function drawWeeblCelBean(ctx, x, y, size = 48, opts = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(size > 0)) return;
  const s = size / 66;
  const bodyCol = opts.color || '#22c55e';
  const shadeCol = opts.shadeColor || '#15803d';
  const dir = opts.dir < 0 ? -1 : 1;
  const sq = Math.max(0.75, Math.min(1.35, opts.squash ?? 1));
  const sx = (2 - sq) * s * dir;
  const sy = sq * s;
  const waveT = opts.waveT || 0;
  const armWave = Math.sin(waveT * 6.2) * 0.25;
  const eyes = opts.eyes || 'happy'; // 'happy' | 'panic' | 'angry'
  const hatId = opts.hatId ?? 'crown';
  const inkScale = opts.inkBoost || 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Waving cartoon arms
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 9 * inkScale;
  ctx.beginPath();
  ctx.moveTo(-22, -40);
  ctx.quadraticCurveTo(-36, -50 + armWave * 16, -40, -64 + armWave * 12);
  ctx.moveTo(22, -40);
  ctx.quadraticCurveTo(36, -48 - armWave * 16, 38, -62 - armWave * 12);
  ctx.stroke();

  ctx.strokeStyle = bodyCol;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-22, -40);
  ctx.quadraticCurveTo(-36, -50 + armWave * 16, -40, -64 + armWave * 12);
  ctx.moveTo(22, -40);
  ctx.quadraticCurveTo(36, -48 - armWave * 16, 38, -62 - armWave * 12);
  ctx.stroke();

  // Stubby fists
  for (const [fx, fy] of [[-40, -64 + armWave * 12], [38, -62 - armWave * 12]]) {
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.8 * inkScale;
    ctx.beginPath();
    ctx.arc(fx, fy, 5.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Optional stubby legs when standing on rim
  if (opts.legs !== false) {
    ctx.fillStyle = shadeCol;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.8 * inkScale;
    for (const lx of [-10, 10]) {
      ctx.beginPath();
      ctx.ellipse(lx, -2, 8.2, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Plump kidney-bean torso + 2-tone cel shadow + specular pill glint
  const traceTorso = () => {
    ctx.beginPath();
    ctx.moveTo(-23, -58);
    ctx.bezierCurveTo(-21, -91, 25, -91, 26, -58);
    ctx.bezierCurveTo(28, -38, 25, -18, 15, -10);
    ctx.bezierCurveTo(4, -5, -13, -7, -20, -16);
    ctx.bezierCurveTo(-26, -27, -25, -43, -23, -58);
    ctx.closePath();
  };
  traceTorso();
  ctx.fillStyle = bodyCol;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = shadeCol;
  ctx.beginPath();
  ctx.ellipse(22, -44, 14, 40, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
  ctx.beginPath();
  ctx.ellipse(-9, -74, 4.8, 10, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  traceTorso();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3.8 * inkScale;
  ctx.stroke();

  // Eyebrows & large Weebl sclera eyes
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  if (eyes === 'angry') {
    ctx.moveTo(-15, -71); ctx.lineTo(-2, -66);
    ctx.moveTo(18, -71); ctx.lineTo(5, -66);
  } else if (eyes === 'panic') {
    ctx.moveTo(-15, -74); ctx.quadraticCurveTo(-8, -79, -2, -73);
    ctx.moveTo(6, -73); ctx.quadraticCurveTo(13, -79, 19, -74);
  } else {
    ctx.moveTo(-14, -69); ctx.quadraticCurveTo(-8, -73, -2, -69);
    ctx.moveTo(5, -69); ctx.quadraticCurveTo(12, -73, 18, -69);
  }
  ctx.stroke();

  const eyeR = eyes === 'panic' ? 9.2 : 8.0;
  const pupilR = eyes === 'panic' ? 2.2 : 3.3;
  for (const ex of [-6, 11]) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(ex, -56, eyeR * 0.95, eyeR * 1.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(ex + 1.3, -55.5, pupilR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 2.2, -57.2, 1.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Expressive Weebl Mouth (wide toothy smile / grimacing angry mouth / shocked O)
  ctx.beginPath();
  if (eyes === 'panic') {
    ctx.ellipse(2, -32, 7.5, 9.0, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7f1d1d';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else if (eyes === 'angry') {
    ctx.moveTo(-10, -34);
    ctx.quadraticCurveTo(2, -41, 14, -34);
    ctx.quadraticCurveTo(12, -26, -8, -26);
    ctx.closePath();
    ctx.fillStyle = '#7f1d1d';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-10, -40, 26, 6.5);
    ctx.restore();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    ctx.moveTo(-11, -40);
    ctx.quadraticCurveTo(2, -36, 15, -40);
    ctx.quadraticCurveTo(11, -23, 2, -24);
    ctx.quadraticCurveTo(-9, -25, -11, -40);
    ctx.closePath();
    ctx.fillStyle = '#7f1d1d';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-12, -41, 28, 6.2);
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.ellipse(2, -27, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Hat / Crown Overlay
  if (hatId && hatId !== 'none') {
    ctx.save();
    ctx.translate(3, -81);
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = '#000000';
    if (hatId === 'tophat') {
      ctx.rotate(0.1);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillRect(-14, -22, 28, 22); ctx.strokeRect(-14, -22, 28, 22);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(-14, -6, 28, 4.5); ctx.strokeRect(-14, -6, 28, 4.5);
    } else if (hatId === 'viking') {
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath(); ctx.arc(0, 4, 20, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fef9c3';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 16, -2); ctx.quadraticCurveTo(side * 30, -10, side * 25, -22);
        ctx.quadraticCurveTo(side * 18, -11, side * 11, -7); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    } else if (hatId === 'party') {
      ctx.rotate(0.12);
      ctx.fillStyle = '#ec4899';
      ctx.beginPath(); ctx.moveTo(-13, 2); ctx.lineTo(0, -28); ctx.lineTo(13, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, -28, 4.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (hatId === 'chef') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-8, -13, 10, 0, Math.PI * 2); ctx.arc(8, -13, 10, 0, Math.PI * 2); ctx.arc(0, -18, 11, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); ctx.fillRect(-14, -8, 28, 9); ctx.strokeRect(-14, -8, 28, 9);
    } else if (hatId === 'astro') {
      ctx.strokeStyle = '#bae6fd'; ctx.fillStyle = 'rgba(186,230,253,0.32)';
      ctx.beginPath(); ctx.arc(0, 20, 36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 2.4; ctx.stroke();
    } else if (hatId === 'ninja') {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.roundRect(-24, 2, 48, 13, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.moveTo(20, 8); ctx.lineTo(34, 2); ctx.lineTo(31, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.rotate(0.14);
      ctx.fillStyle = opts.crownColor || '#facc15';
      ctx.beginPath();
      ctx.moveTo(-19, 4); ctx.lineTo(-22, -17); ctx.lineTo(-8, -6); ctx.lineTo(0, -22);
      ctx.lineTo(8, -6); ctx.lineTo(22, -17); ctx.lineTo(19, 4); ctx.quadraticCurveTo(0, 7, -19, 4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Crisp #000-outlined Weebl cartoon eye helper shared across aquatic fauna and hazards.
 * mood: 'happy' | 'panic' | 'angry' | 'dizzy'
 */
export function drawWeeblEyeCluster(ctx, x, y, r = 6, opts = {}) {
  const {
    lookX = 0.35,
    mood = 'happy',
    lineW = 2.2,
    dual = false,
    spacing = r * 1.15,
  } = opts;
  const rx = Math.max(1.8, r * (mood === 'panic' ? 1.12 : 0.94));
  const ry = Math.max(2.0, r * (mood === 'panic' ? 1.28 : 1.12));
  const pupilR = Math.max(1.1, r * (mood === 'panic' ? 0.3 : 0.44));
  const offsets = dual ? [-spacing * 0.5, spacing * 0.5] : [0];

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const ox of offsets) {
    const ex = x + ox;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = STYLE_TOKENS.ink;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.ellipse(ex, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (mood === 'dizzy') {
      const xr = Math.max(1.6, r * 0.45);
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = Math.max(1.4, lineW * 0.85);
      ctx.beginPath();
      ctx.moveTo(ex - xr, y - xr);
      ctx.lineTo(ex + xr, y + xr);
      ctx.moveTo(ex + xr, y - xr);
      ctx.lineTo(ex - xr, y + xr);
      ctx.stroke();
    } else {
      const px = ex + Math.max(-rx * 0.35, Math.min(rx * 0.35, lookX * rx * 0.45));
      ctx.fillStyle = STYLE_TOKENS.ink;
      ctx.beginPath();
      ctx.arc(px, y, pupilR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px + pupilR * 0.28, y - pupilR * 0.32, Math.max(0.7, pupilR * 0.38), 0, Math.PI * 2);
      ctx.fill();
    }

    if (mood === 'angry') {
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = Math.max(1.6, lineW * 1.1);
      ctx.beginPath();
      ctx.moveTo(ex - rx * 1.05, y - ry * 1.08);
      ctx.lineTo(ex + rx * 0.95, y - ry * 0.42);
      ctx.stroke();
    } else if (mood === 'panic') {
      ctx.strokeStyle = STYLE_TOKENS.ink;
      ctx.lineWidth = Math.max(1.3, lineW * 0.9);
      ctx.beginPath();
      ctx.moveTo(ex - rx * 0.9, y - ry * 1.08);
      ctx.quadraticCurveTo(ex, y - ry * 1.48, ex + rx * 0.9, y - ry * 1.05);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Scuba-equipped Crowned Weebl Hero Bean swimmer for DeepFeeder ("Jelly Reef").
 * Renders kicking cel-shaded flippers, expressive Weebl Bean + Crown/Hat,
 * and glossy transparent comic scuba goggles + snorkel.
 */
export function drawWeeblScubaBean(ctx, x, y, size = 48, opts = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(size > 0)) return;
  const s = size / 66;
  const dir = opts.dir < 0 ? -1 : 1;
  const sq = Math.max(0.75, Math.min(1.35, opts.squash ?? 1));
  const waveT = opts.waveT || 0;
  const tilt = Math.max(-0.55, Math.min(0.55, opts.tilt ?? 0));
  const kick = Math.sin(waveT * 10.5) * 0.38;
  const dashBoost = opts.dashBoost || 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir * tilt);
  // Center vertical anchor at swimmer body midpoint (~44px above bean foot baseline)
  ctx.scale((2 - sq) * s * dir, sq * s);
  ctx.translate(0, 44);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Kicking #000-inked Orange Scuba Flippers tucked cleanly at bean base
  for (let i = 0; i < 2; i++) {
    const legAng = i === 0 ? kick : -kick;
    const fx = i === 0 ? -10 : 9;
    ctx.save();
    ctx.translate(fx, -6);
    ctx.rotate(legAng - 0.14 - dashBoost * 0.18);
    ctx.fillStyle = '#f97316';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.quadraticCurveTo(-18, -6, -24, 2);
    ctx.quadraticCurveTo(-20, 10, -4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-10, -1);
    ctx.lineTo(-19, 0.5);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Crowned Green (or Closet-skinned) Weebl Cel Bean torso & head
  drawWeeblCelBean(ctx, 0, 0, 66, {
    color: opts.color || '#22c55e',
    shadeColor: opts.shadeColor || '#15803d',
    dir: 1,
    squash: 1,
    waveT,
    eyes: opts.eyes || 'happy',
    hatId: opts.hatId ?? 'crown',
    crownColor: opts.crownColor || '#facc15',
    legs: false,
    inkBoost: opts.inkBoost || 1,
  });

  // 3. Snorkel Tube & Glossy Cyan Scuba Goggles over eye line (`y ~ -56`)
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 7.4;
  ctx.beginPath();
  ctx.moveTo(-19, -37);
  ctx.quadraticCurveTo(-30, -39, -31, -57);
  ctx.lineTo(-32, -80);
  ctx.stroke();

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 4.2;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-24, -61, 50, 10, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(56, 243, 255, 0.28)';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.roundRect(-16.5, -67, 37.5, 22, 9);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-11, -63);
  ctx.lineTo(-3, -63);
  ctx.moveTo(10, -63);
  ctx.lineTo(15, -63);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/**
 * Universal SSOT Hero Character Renderer (Real-Time Cel-Shaded 3D + Cartoon Ink Outline).
 * Anchored at bottom-center feet `(x, y)` so all mini-games, overworld map, and runners share
 * exact placement, silhouette, camera angles, expressions, and animation clips.
 * Automatically falls back to inked 2D cel bean if WebGL is unavailable (e.g. Node SSR checks).
 */
export function drawHeroCharacter(ctx, x, y, size = 66, opts = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(size > 0)) return false;
  if (!opts.force2d && drawHero3D(ctx, x, y, size, opts)) {
    return true;
  }

  const expr = opts.expr || 'happy';
  const eyes2d =
    expr === 'focus' ? 'angry'
    : expr === 'panic' || expr === 'dizzy' ? 'panic'
    : 'happy';

  drawWeeblCelBean(ctx, x, y, size, {
    color: opts.skinColor || '#22c55e',
    shadeColor: '#15803d',
    dir: opts.dir < 0 ? -1 : 1,
    squash: opts.squashY ?? 1,
    waveT: opts.t || 0,
    eyes: eyes2d,
    hatId: opts.hatId ?? 'crown',
    legs: true,
    lookX: opts.lookX || 0,
  });
  return false;
}

export { isHero3DSupported };
