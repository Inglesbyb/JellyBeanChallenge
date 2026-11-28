// Interactive HD Flash Cel-Cartoon ("Weebl's Stuff") Sunburst Plaza FX & World 1 Overworld Renderer.
import { store } from './store.js';
import { sounds } from '../audio.js';
import {
  WORLD_1_NODES,
  getWorldById,
  getWorldNodeById,
} from '../games/registry.js';
import { drawComicStarburst, drawHeroCharacter, drawSunburst } from '../games/weeblAtlas.js';

let _heroMapSprite = null;
function getHeroMapSprite() {
  if (typeof Image === 'undefined') return null;
  if (!_heroMapSprite) {
    const img = new Image();
    img.src = '/assets/world1/hero-bean-map.png';
    _heroMapSprite = img;
  }
  return _heroMapSprite.complete && _heroMapSprite.naturalWidth > 0 ? _heroMapSprite : null;
}

let _world2MapSprite = null;
function getWorld2MapSprite() {
  if (typeof Image === 'undefined') return null;
  if (!_world2MapSprite) {
    const img = new Image();
    img.src = '/assets/world1/world2-portal-plaza.png';
    _world2MapSprite = img;
  }
  return _world2MapSprite.complete && _world2MapSprite.naturalWidth > 0 ? _world2MapSprite : null;
}

const _summaryAssets = {};
function getSummaryAsset(key, src) {
  if (typeof Image === 'undefined') return null;
  if (!_summaryAssets[key]) {
    const img = new Image();
    img.src = src;
    _summaryAssets[key] = img;
  }
  const img = _summaryAssets[key];
  return img.complete && img.naturalWidth > 0 ? img : null;
}
function preloadSummaryAssets() {
  getSummaryAsset('bg', '/assets/world1/summary-stage-bg.jpg');
  getSummaryAsset('0star', '/assets/world1/hero-summary-0star.png');
  getSummaryAsset('1star', '/assets/world1/hero-summary-1star.png');
  getSummaryAsset('rally', '/assets/world1/hero-summary-rally.png');
  getSummaryAsset('cheer', '/assets/world1/hero-summary-cheer.png');
}

export const STAGE_W = 450;
export const STAGE_H = 800;

function syncCanvasDPR(canvas) {
  if (!canvas) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const tw = Math.round(STAGE_W * dpr);
  const th = Math.round(STAGE_H * dpr);
  if (canvas.width !== tw || canvas.height !== th) {
    canvas.width = tw;
    canvas.height = th;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * Live 60fps Interactive FX Overlay layered seamlessly over the illustrated Opt2 Sunburst Stage:
 * - Animates emerald portal energy ripples inside the World 1 Stone Arch
 * - Pops crisp Weebl starbursts & outlined confetti when tapping the Crowned Hero Bean
 */
export class PlazaScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.raf = null;
    this.t = 0;
    this.last = 0;
    this.bounceT = 0;
    this.world2PulseT = 0;
    this.sparkles = [];
  }

  start() {
    this.stop();
    if (!this.canvas) return;
    getWorld2MapSprite();
    this.last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
      this.last = now;
      this.t += dt;
      if (this.bounceT > 0) this.bounceT = Math.max(0, this.bounceT - dt * 2.1);
      if (this.world2PulseT > 0) this.world2PulseT = Math.max(0, this.world2PulseT - dt * 2.4);
      this.updateSparkles(dt);
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  _spawnSparkBurst(cx, cy, count, palette) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const spd = 70 + Math.random() * 115;
      this.sparkles.push({
        x: cx + (Math.random() - 0.5) * 26,
        y: cy + (Math.random() - 0.5) * 22,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 50,
        life: 0.72 + Math.random() * 0.35,
        maxLife: 1.05,
        r: 3.2 + Math.random() * 3.2,
        color: palette[i % palette.length],
      });
    }
  }

  triggerBounce() {
    this.bounceT = 1.0;
    this._spawnSparkBurst(228, 438, 18, ['#facc15', '#38bdf8', '#fb7185', '#4ade80', '#ffffff']);
  }

  triggerWorld2Pulse() {
    this.world2PulseT = 1.0;
    this._spawnSparkBurst(388, 438, 14, ['#e879f9', '#c084fc', '#fde047', '#ffffff']);
  }

  updateSparkles(dt) {
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 240 * dt;
      s.life -= dt;
      if (s.life <= 0) this.sparkles.splice(i, 1);
    }
  }

  drawWorld2PortalArch(ctx) {
    const cx = 388.5;
    const baseY = 489.5;
    const drawW = 100.8;
    const drawH = 113.5;
    const ready = !!store.worlds.world2Unlocked;
    const tapBump = this.world2PulseT > 0 ? Math.sin(this.world2PulseT * Math.PI) * 0.07 : 0;
    const w2Sprite = getWorld2MapSprite();

    ctx.save();
    ctx.translate(cx, baseY);
    ctx.scale(1 + tapBump, 1 - tapBump * 0.45);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Mystic violet threshold glow radiating onto right patio floor
    const glowGrad = ctx.createRadialGradient(0, -6, 4, 0, -4, 42);
    glowGrad.addColorStop(0, 'rgba(192, 132, 252, 0.55)');
    glowGrad.addColorStop(0.55, 'rgba(147, 51, 234, 0.24)');
    glowGrad.addColorStop(1, 'rgba(147, 51, 234, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.ellipse(0, -4, 42, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    if (w2Sprite) {
      ctx.drawImage(w2Sprite, -drawW / 2, -drawH, drawW, drawH);
    } else {
      // Minimal geometric fallback if sprite image has not decoded yet
      ctx.fillStyle = '#3b0764';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-36, -6);
      ctx.lineTo(-36, -54);
      ctx.arc(0, -54, 36, Math.PI, 0);
      ctx.lineTo(36, -6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Living lavender-violet portal shimmer ripple matching World 1's emerald pulse
    const wave = (this.t * 0.65 + 0.35) % 1;
    ctx.save();
    ctx.globalAlpha = (1 - wave) * 0.5;
    ctx.strokeStyle = '#f5d0fe';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(-2, -46, 5 + wave * 12, 9 + wave * 20, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Crisp Weebl Comic Header Sign: WORLD 2 (styled identically to World 1, shifted to violet-purple)
    ctx.font = "900 16.5px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#000000';
    ctx.strokeText('WORLD 2', 0, -106);
    const titleGrad = ctx.createLinearGradient(0, -115, 0, -97);
    titleGrad.addColorStop(0, '#f5d0fe');
    titleGrad.addColorStop(0.5, '#d8b4fe');
    titleGrad.addColorStop(1, '#9333ea');
    ctx.fillStyle = titleGrad;
    ctx.fillText('WORLD 2', 0, -106);

    // Compact Ribbon Pill at Base: COMING SOON
    const badgeW = 82;
    const badgeH = 17.5;
    const badgeY = -14;
    const pillGrad = ctx.createLinearGradient(0, badgeY, 0, badgeY + badgeH);
    if (ready) {
      pillGrad.addColorStop(0, '#e9d5ff');
      pillGrad.addColorStop(1, '#9333ea');
    } else {
      pillGrad.addColorStop(0, '#fef08a');
      pillGrad.addColorStop(1, '#f59e0b');
    }
    ctx.fillStyle = pillGrad;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-badgeW / 2, badgeY, badgeW, badgeH, 8.75);
    ctx.fill();
    ctx.stroke();

    ctx.font = "900 9px 'Fredoka', 'Outfit', sans-serif";
    ctx.fillStyle = ready ? '#ffffff' : '#451a03';
    ctx.fillText('COMING SOON', 0, badgeY + badgeH / 2 + 0.5);

    ctx.restore();
  }

  render() {
    const ctx = syncCanvasDPR(this.canvas);
    if (!ctx) return;
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);

    // 1. Living Emerald Shimmer & Vortex Pulse inside World 1 Portal Doorway (`x=60, y=444`)
    const wave = (this.t * 0.65) % 1;
    ctx.save();
    ctx.globalAlpha = (1 - wave) * 0.45;
    ctx.strokeStyle = '#bbf7d0';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(58, 446, 6 + wave * 14, 10 + wave * 24, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 2. Right Terrace Companion Landmark: World 2 Coming Soon Sealed Archway
    this.drawWorld2PortalArch(ctx);

    // 3. Celebratory Comic Halo, Starburst & Sparkles when Hero Bean is Tapped
    if (this.bounceT > 0.05) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.bounceT) * 0.65;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(228, 526, 48 + (1 - this.bounceT) * 32, 13 + (1 - this.bounceT) * 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (this.bounceT > 0.42) {
        const k = (this.bounceT - 0.42) / 0.58;
        drawComicStarburst(ctx, 228, 362, 28 * k, 12 * k, 9, '#fef08a', '#000000', this.t * 8, 2.2);
      }
    }

    for (const s of this.sparkles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life / s.maxLife));
      ctx.fillStyle = s.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * Interactive Mario 3D World–style Diorama Map Renderer for World 1.
 * Draws glowing road paths, clear flagpoles, lock domes, and spline-walking Jelly Bean mascot.
 */
export class WorldMapScene {
  constructor(canvas, { onSelectNode } = {}) {
    this.canvas = canvas;
    this.onSelectNode = onSelectNode || (() => {});
    this.raf = null;
    this.t = 0;
    this.last = 0;

    // Live mascot position / spline walk state
    const initial = getWorldNodeById(store.worlds.selectedNodeId || '1-1');
    this.beanPos = { x: initial.pos.x, y: initial.pos.y };
    this.beanDir = 1;
    this.walkQueue = []; // array of [x, y] waypoints along road splines
    this.walkSegIndex = 0;
    this.walkSegT = 0;
    this.isWalking = false;
    this.targetNodeId = initial.id;
  }

  start() {
    this.stop();
    if (!this.canvas) return;
    getHeroMapSprite();
    const cur = getWorldNodeById(store.worlds.selectedNodeId || '1-1');
    if (!this.isWalking) {
      this.beanPos = { x: cur.pos.x, y: cur.pos.y };
      this.targetNodeId = cur.id;
    }
    this.last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
      this.last = now;
      this.t += dt;
      this.updateWalk(dt);
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  syncToSelected(instant = false) {
    const target = getWorldNodeById(store.worlds.selectedNodeId || '1-1');
    if (instant) {
      this.walkQueue = [];
      this.isWalking = false;
      this.beanPos = { x: target.pos.x, y: target.pos.y };
      this.targetNodeId = target.id;
      return;
    }
    this.walkToNode(target.id);
  }

  walkToNode(nodeId) {
    const dest = getWorldNodeById(nodeId);
    if (!dest) return;
    const curId = this.targetNodeId || '1-1';
    if (curId === dest.id && !this.isWalking) {
      this.beanPos = { x: dest.pos.x, y: dest.pos.y };
      return;
    }

    const fromIdx = WORLD_1_NODES.findIndex((n) => n.id === curId);
    const toIdx = WORLD_1_NODES.findIndex((n) => n.id === dest.id);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
      this.beanPos = { x: dest.pos.x, y: dest.pos.y };
      this.targetNodeId = dest.id;
      this.isWalking = false;
      return;
    }

    // Assemble ordered spline waypoints step-by-step across adjacent nodes
    const points = [[this.beanPos.x, this.beanPos.y]];
    const step = toIdx > fromIdx ? 1 : -1;
    let idx = fromIdx;
    while (idx !== toIdx) {
      if (step > 0) {
        const nextNode = WORLD_1_NODES[idx + 1];
        const seg = nextNode.pathFromPrev || [WORLD_1_NODES[idx].pos, nextNode.pos].map((p) => [p.x, p.y]);
        for (let k = 1; k < seg.length; k++) points.push(seg[k]);
        idx += 1;
      } else {
        const curNode = WORLD_1_NODES[idx];
        const prevNode = WORLD_1_NODES[idx - 1];
        const seg = curNode.pathFromPrev || [prevNode.pos, curNode.pos].map((p) => [p.x, p.y]);
        for (let k = seg.length - 2; k >= 0; k--) points.push(seg[k]);
        idx -= 1;
      }
    }

    this.walkQueue = points;
    this.walkSegIndex = 0;
    this.walkSegT = 0;
    this.isWalking = points.length >= 2;
    this.targetNodeId = dest.id;
  }

  updateWalk(dt) {
    if (!this.isWalking || this.walkQueue.length < 2) return;
    let remainingDist = 230 * dt; // Brisk Nintendo map jog speed (px/s in 450x800 coords)
    while (remainingDist > 0 && this.walkSegIndex < this.walkQueue.length - 1) {
      const a = this.walkQueue[this.walkSegIndex];
      const b = this.walkQueue[this.walkSegIndex + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const segLen = Math.hypot(dx, dy) || 1;
      if (Math.abs(dx) > 1) this.beanDir = dx >= 0 ? 1 : -1;

      const curAlong = this.walkSegT * segLen;
      const distLeftInSeg = segLen - curAlong;
      if (remainingDist >= distLeftInSeg) {
        remainingDist -= distLeftInSeg;
        this.walkSegIndex += 1;
        this.walkSegT = 0;
        this.beanPos = { x: b[0], y: b[1] };
      } else {
        this.walkSegT = (curAlong + remainingDist) / segLen;
        this.beanPos = {
          x: a[0] + dx * this.walkSegT,
          y: a[1] + dy * this.walkSegT,
        };
        remainingDist = 0;
      }
    }

    if (this.walkSegIndex >= this.walkQueue.length - 1) {
      const finalPt = this.walkQueue[this.walkQueue.length - 1];
      this.beanPos = { x: finalPt[0], y: finalPt[1] };
      this.isWalking = false;
      this.walkQueue = [];
      sounds.pop();
    }
  }

  drawPathSegment(ctx, pts, unlocked, worldIdx = 0) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
    };

    if (unlocked) {
      // Crisp comic golden path highlight + outlined Spark Bead
      trace();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 8;
      ctx.stroke();

      trace();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4.2;
      ctx.stroke();

      const phase = ((this.t * 0.52 + worldIdx * 0.23) % 1 + 1) % 1;
      const totalPts = pts.length - 1;
      const fIdx = Math.min(totalPts - 1, Math.floor(phase * totalPts));
      const localT = phase * totalPts - fIdx;
      const p0 = pts[fIdx];
      const p1 = pts[fIdx + 1];
      const gx = p0[0] + (p1[0] - p0[0]) * localT;
      const gy = p0[1] + (p1[1] - p0[1]) * localT;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      trace();
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFlag(ctx, x, y, stars) {
    ctx.save();
    const wave = Math.sin(this.t * 5.2 + x) * 2.2;
    const isGold = stars >= 3;
    const flagCol = isGold ? '#facc15' : '#22c55e';
    const trimCol = isGold ? '#fef9c3' : '#bbf7d0';

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 32);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 32);
    ctx.stroke();

    ctx.fillStyle = flagCol;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 31);
    ctx.quadraticCurveTo(x + 13, y - 34 + wave, x + 23, y - 26 + wave * 0.7);
    ctx.lineTo(x + 1, y - 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = trimCol;
    ctx.beginPath();
    ctx.arc(x + 9, y - 25 + wave * 0.3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - 33, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawPadHighlights(ctx) {
    const selectedId = store.worlds.selectedNodeId || '1-1';
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4.0);

    for (const node of WORLD_1_NODES) {
      const st = store.getNodeState(node.id);
      const { x, y } = node.pos;
      const isSelected = node.id === selectedId;

      if (isSelected) {
        // Sunlit gold halo for standard stages, fiery crimson-gold ring for 1-6 Final Boss
        ctx.save();
        ctx.globalAlpha = 0.72 + pulse * 0.24;
        ctx.strokeStyle = node.isBoss ? '#ef4444' : '#fde047';
        ctx.lineWidth = node.isBoss ? 3.8 : 3.2;
        ctx.beginPath();
        ctx.ellipse(x, y + 1, 26 + pulse * 2.5, 14 + pulse * 1.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (node.isBoss) {
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(x, y + 1, 22 + pulse * 1.8, 11.8 + pulse * 1.0, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (!st.unlocked) {
        // Crisp Opt3 Weebl lock medallion sized to nest inside cream disc face (rx 14.5, ry 8.2)
        ctx.save();
        ctx.fillStyle = node.isBoss ? '#7f1d1d' : '#475569';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(x, y, 14.5, 8.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = node.isBoss ? '#fde047' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - 3.2, 3, Math.PI, 0);
        ctx.stroke();

        ctx.fillStyle = node.isBoss ? '#ef4444' : '#facc15';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - 4.5, y - 2.6, 9, 6.8, 1.6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (st.cleared) {
        this.drawFlag(ctx, x - 20, y - 3, st.stars);
      }
    }

    const world = getWorldById('world-1');
    const px = world.portalPos.x;
    const py = world.portalPos.y - 6;
    const w2Open = !!store.worlds.world2Unlocked;
    ctx.save();
    ctx.globalAlpha = w2Open ? 0.55 : 0.28;
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 2.2;
    const pw = (this.t * 0.7) % 1;
    ctx.beginPath();
    ctx.ellipse(px, py, 5 + pw * 10, 8 + pw * 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawWeeblHeroOnMap(ctx, x, y, bounce, walkCycle, dir) {
    const sqY = 1 + Math.sin(walkCycle) * 0.035;
    const sqX = 2 - sqY;

    // Render isolated Crowned Green Bean sprite (with cel vector fallback while loading)
    const sprite = getHeroMapSprite();
    if (sprite) {
      const drawH = 70;
      const drawW = Math.round((sprite.naturalWidth / sprite.naturalHeight) * drawH) || 57;
      ctx.save();
      ctx.translate(x, y + 3 - bounce);
      ctx.scale((dir >= 0 ? 1 : -1) * sqX, sqY);
      ctx.drawImage(sprite, -drawW / 2, -drawH + 2, drawW, drawH);
      ctx.restore();
      return;
    }

    const bodyCol = '#22c55e';
    const shadeCol = '#15803d';
    const hatId = 'crown';

    ctx.save();
    ctx.translate(x, y + 2 - bounce);
    ctx.scale((dir >= 0 ? 0.56 : -0.56) * sqX, 0.56 * sqY);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Waving/swinging cartoon arms
    const swing = Math.sin(walkCycle) * 0.25;
    ctx.save();
    ctx.translate(-22, -46);
    ctx.rotate(-0.45 + swing);
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-15, -6, -20, -20); ctx.stroke();
    ctx.strokeStyle = bodyCol; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-15, -6, -20, -20); ctx.stroke();
    ctx.fillStyle = bodyCol; ctx.strokeStyle = '#000000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-21, -22, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(22, -44);
    ctx.rotate(-swing * 0.7);
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, 1); ctx.lineTo(18, -14); ctx.stroke();
    ctx.strokeStyle = shadeCol; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, 1); ctx.lineTo(18, -14); ctx.stroke();
    ctx.fillStyle = bodyCol; ctx.strokeStyle = '#000000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(18, -16, 7.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Stubby cartoon legs
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    const stepL = this.isWalking ? Math.sin(walkCycle) * 4 : 0;
    for (const lx of [-11, 11]) {
      const ly = lx < 0 ? stepL : -stepL;
      ctx.fillStyle = shadeCol;
      ctx.beginPath(); ctx.roundRect(lx - 4.5, -15 + ly, 9, 13, 4); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(lx + (lx < 0 ? -2.5 : 2.5), -2 + ly, 9.5, 4.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Crisp Weebl kidney-bean torso + separate outer ink contour (never outlines forehead glint!)
    const traceBody = () => {
      ctx.beginPath();
      ctx.moveTo(-24, -62);
      ctx.bezierCurveTo(-22, -96, 26, -96, 27, -62);
      ctx.bezierCurveTo(29, -42, 26, -22, 16, -13);
      ctx.bezierCurveTo(5, -8, -13, -10, -20, -19);
      ctx.bezierCurveTo(-27, -30, -26, -46, -24, -62);
      ctx.closePath();
    };
    traceBody();
    ctx.fillStyle = bodyCol;
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = shadeCol;
    ctx.beginPath(); ctx.ellipse(23, -46, 15, 42, -0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(-10, -78, 5, 11, 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    traceBody();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.8;
    ctx.stroke();

    // Expressive eyebrows, white sclera eyes & wide smile with crisp upper tooth strip
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-14, -71); ctx.quadraticCurveTo(-7, -75, -1, -71);
    ctx.moveTo(5, -71); ctx.quadraticCurveTo(12, -75, 18, -71);
    ctx.stroke();

    for (const ex of [-6, 11]) {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.ellipse(ex, -58, 8, 10.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(ex + 1.5, -57, 3.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ex + 2.6, -59, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-10, -42); ctx.quadraticCurveTo(2, -38, 14, -42);
    ctx.quadraticCurveTo(10, -25, 1, -26); ctx.quadraticCurveTo(-8, -27, -10, -42);
    ctx.closePath();
    ctx.fillStyle = '#7f1d1d'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-12, -43, 28, 6);
    ctx.fillStyle = '#fb7185'; ctx.beginPath(); ctx.ellipse(2, -29, 6, 3.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 2.6; ctx.stroke();

    // Crown or Equipped Hat anchored cleanly atop head
    ctx.save();
    ctx.translate(4, -84);
    ctx.lineWidth = 3; ctx.strokeStyle = '#000000';
    if (hatId === 'tophat') {
      ctx.rotate(0.1);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 5.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillRect(-15, -23, 30, 23); ctx.strokeRect(-15, -23, 30, 23);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(-15, -7, 30, 5); ctx.strokeRect(-15, -7, 30, 5);
    } else if (hatId === 'viking') {
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath(); ctx.arc(0, 4, 21, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fef9c3';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * 18, -2); ctx.quadraticCurveTo(s * 34, -10, s * 28, -24);
        ctx.quadraticCurveTo(s * 20, -12, s * 12, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (hatId === 'party') {
      ctx.rotate(0.12);
      ctx.fillStyle = '#ec4899';
      ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(0, -30); ctx.lineTo(14, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, -30, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (hatId === 'chef') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-9, -14, 11, 0, Math.PI * 2); ctx.arc(9, -14, 11, 0, Math.PI * 2); ctx.arc(0, -20, 12, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); ctx.fillRect(-15, -9, 30, 10); ctx.strokeRect(-15, -9, 30, 10);
    } else if (hatId === 'astro') {
      ctx.strokeStyle = '#bae6fd'; ctx.fillStyle = 'rgba(186,230,253,0.28)';
      ctx.beginPath(); ctx.arc(0, 20, 38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 2.4; ctx.stroke();
    } else {
      ctx.rotate(0.14);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(-20, 4); ctx.lineTo(-23, -18); ctx.lineTo(-9, -7); ctx.lineTo(0, -23);
      ctx.lineTo(9, -7); ctx.lineTo(23, -18); ctx.lineTo(20, 4); ctx.quadraticCurveTo(0, 8, -20, 4);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  render() {
    const ctx = syncCanvasDPR(this.canvas);
    if (!ctx) return;
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);

    // 1. Draw World 1 spline paths
    WORLD_1_NODES.forEach((node, i) => {
      if (!node.pathFromPrev) return;
      const unlocked = store.isNodeUnlocked(node.id);
      this.drawPathSegment(ctx, node.pathFromPrev, unlocked, i);
    });

    const world = getWorldById('world-1');
    this.drawPathSegment(ctx, world.portalPath, !!store.worlds.world2Unlocked, 5);

    // 2. Draw crisp lock medallions, clear pennants, & active pad rings
    this.drawPadHighlights(ctx);

    // 3. Draw Live Crowned Weebl Hero standing/jogging on active pad
    const { x, y } = this.beanPos;
    const hop = this.isWalking ? Math.abs(Math.sin(this.t * 14)) * 7 : Math.sin(this.t * 3.4) * 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.drawWeeblHeroOnMap(ctx, x, y - 1, hop, this.isWalking ? this.t * 12 : this.t * 3.4, this.beanDir);
  }
}

function drawWeeblCloud(ctx, cx, cy, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(-34, 10);
    ctx.bezierCurveTo(-46, 10, -48, -8, -32, -10);
    ctx.bezierCurveTo(-28, -26, -4, -30, 6, -18);
    ctx.bezierCurveTo(18, -26, 38, -18, 36, -3);
    ctx.bezierCurveTo(48, -1, 46, 10, 34, 10);
    ctx.closePath();
  };

  trace();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(-50, 4, 100, 10);
  ctx.restore();

  trace();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.8;
  ctx.stroke();
  ctx.restore();
}

/**
 * Live 60fps HD Cel-Cartoon ("Weebl's Stuff") Run Summary Stage:
 * Renders a bright cartoon sky, drifting inked clouds, spinning Weebl sunburst,
 * rolling emerald hills, celebratory confetti, and animated 3D Crowned Hero Bean.
 */
export class SummaryScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.raf = null;
    this.t = 0;
    this.last = 0;
    this.cleared = false;
    this.isBoss = false;
    this.stars = 0;
    this.bounceT = 0;
    this.sparkles = [];
    this.confetti = [];
    preloadSummaryAssets();
  }

  start({ cleared = false, isBoss = false, stars = 0 } = {}) {
    this.stop();
    if (!this.canvas) return;
    preloadSummaryAssets();
    this.cleared = Boolean(cleared);
    this.isBoss = Boolean(isBoss);
    this.stars = Math.max(0, Math.min(3, Number(stars) || 0));
    this.t = 0;
    this.bounceT = this.stars >= 2 ? 1.0 : 0;
    this.sparkles = [];
    this.confetti = [];

    if (this.stars >= 2) {
      this._spawnBurst(225, 345, 26, ['#fde047', '#4ade80', '#38bdf8', '#fb7185', '#ffffff']);
      const colors = ['#fde047', '#4ade80', '#38bdf8', '#fb7185', '#f97316', '#c084fc'];
      for (let i = 0; i < 24; i++) {
        this.confetti.push({
          x: Math.random() * STAGE_W,
          y: -20 - Math.random() * 260,
          vx: (Math.random() - 0.5) * 34,
          vy: 55 + Math.random() * 65,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 5,
          w: 7 + Math.random() * 5,
          h: 5 + Math.random() * 4,
          color: colors[i % colors.length],
        });
      }
    }

    this.last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
      this.last = now;
      this.t += dt;
      if (this.bounceT > 0) this.bounceT = Math.max(0, this.bounceT - dt * 1.85);
      this.updateParticles(dt);
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  triggerBounce() {
    this.bounceT = 1.0;
    this._spawnBurst(225, 345, 18, ['#fde047', '#4ade80', '#38bdf8', '#fb7185', '#ffffff']);
  }

  _spawnBurst(cx, cy, count, palette) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const spd = 75 + Math.random() * 130;
      this.sparkles.push({
        x: cx + (Math.random() - 0.5) * 28,
        y: cy + (Math.random() - 0.5) * 24,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 65,
        life: 0.75 + Math.random() * 0.4,
        maxLife: 1.15,
        r: 3.4 + Math.random() * 3.4,
        color: palette[i % palette.length],
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 260 * dt;
      s.life -= dt;
      if (s.life <= 0) this.sparkles.splice(i, 1);
    }
    for (const c of this.confetti) {
      c.x += (c.vx + Math.sin(this.t * 3 + c.y * 0.02) * 18) * dt;
      c.y += c.vy * dt;
      c.rot += c.vrot * dt;
      if (c.y > STAGE_H + 20) {
        c.y = -18;
        c.x = Math.random() * STAGE_W;
      }
    }
  }

  render() {
    const ctx = syncCanvasDPR(this.canvas);
    if (!ctx) return;
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);

    const prevSmooth = ctx.imageSmoothingEnabled;
    const prevQual = ctx.imageSmoothingQuality;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const bgImg = getSummaryAsset('bg', '/assets/world1/summary-stage-bg.jpg');
    if (bgImg) {
      const drawH = (STAGE_W / bgImg.naturalWidth) * bgImg.naturalHeight;
      ctx.drawImage(bgImg, 0, 0, STAGE_W, Math.max(STAGE_H, drawH));
    } else {
      // Fallback sky & hills while image decodes
      const sky = ctx.createLinearGradient(0, 0, 0, 420);
      sky.addColorStop(0, '#0284c7');
      sky.addColorStop(0.62, '#38bdf8');
      sky.addColorStop(1, '#fef08a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      drawSunburst(ctx, 225, 340, 175, this.t * 0.25, 14, 0.9, false);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, 380, STAGE_W, STAGE_H - 380);
    }

    // Subtle sunlit halo & Starburst Pop behind King Jelly on Clear or Tap
    const footY = 478;
    const tapLift = this.bounceT > 0 ? Math.sin(this.bounceT * Math.PI) * 18 : 0;
    const idleBob = Math.sin(this.t * 3.4) * 3.2;

    if (this.bounceT > 0.22) {
      const k = Math.min(1, (this.bounceT - 0.22) / 0.78);
      drawComicStarburst(
        ctx,
        225,
        345,
        88 * k,
        42 * k,
        10,
        '#fef08a',
        '#000000',
        this.t * 4.2,
        3.0,
      );
    }

    // Ground contact shadow on the stone pad
    const shadowScale = Math.max(0.72, 1 - tapLift * 0.012);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(225, footY - 3, 56 * shadowScale, 12 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Story-Quality HD King Jelly Illustration per Star Tier (0, 1, 2, 3)
    const poseMap = {
      0: ['0star', '/assets/world1/hero-summary-0star.png'],
      1: ['1star', '/assets/world1/hero-summary-1star.png'],
      2: ['rally', '/assets/world1/hero-summary-rally.png'],
      3: ['cheer', '/assets/world1/hero-summary-cheer.png'],
    };
    const [poseKey, poseSrc] = poseMap[this.stars] || poseMap[0];
    const heroImg = getSummaryAsset(poseKey, poseSrc);

    const sqY = this.bounceT > 0
      ? 1 + Math.sin(this.bounceT * Math.PI * 2) * 0.07
      : 1 + Math.sin(this.t * (this.stars >= 2 ? 3.4 : 2.1)) * 0.015;
    const sqX = 2 - sqY;

    if (heroImg) {
      const drawH = 252;
      const drawW = (heroImg.naturalWidth / heroImg.naturalHeight) * drawH;
      ctx.save();
      ctx.translate(225, footY - tapLift - Math.max(0, idleBob * (this.stars >= 2 ? 1 : 0.45)));
      ctx.scale(sqX, sqY);
      ctx.drawImage(heroImg, -drawW * 0.5, -drawH, drawW, drawH);
      ctx.restore();
    } else {
      drawHeroCharacter(ctx, 225, footY - tapLift, 142, {
        view: 'front',
        dir: 1,
        state: this.stars >= 2 ? 'cheer' : 'idle',
        expr: this.stars === 0 ? 'panic' : 'happy',
        t: this.t * 2.2,
        squashX: sqX,
        squashY: sqY,
      });
    }

    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.imageSmoothingQuality = prevQual;

    // Confetti & Comic Burst Sparkles
    for (const c of this.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.rect(-c.w * 0.5, -c.h * 0.5, c.w, c.h);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    for (const s of this.sparkles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life / s.maxLife));
      ctx.fillStyle = s.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
