// Interactive Toy Courtyard Plaza & World 1 Mario-Style Diorama Overworld Renderer.
import { drawBean } from './bean.js';
import { store } from './store.js';
import { sounds } from '../audio.js';
import {
  WORLD_1_NODES,
  WORLD_1_CHESTS,
  getWorldById,
  getWorldNodeById,
} from '../games/registry.js';

export const STAGE_W = 450;
export const STAGE_H = 800;

function syncCanvasDPR(canvas) {
  if (!canvas) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
 * Live 60fps overlay on the Toy Courtyard Plaza backdrop:
 * - Renders the player's equipped Closet skin + hat standing on the center stone pedestal
 * - Animates subtle ambient sparkle glints over buildings & tap confetti burst
 */
export class PlazaScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.raf = null;
    this.t = 0;
    this.last = 0;
    this.bounceT = 0;
    this.sparkles = [];
  }

  start() {
    this.stop();
    if (!this.canvas) return;
    this.last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
      this.last = now;
      this.t += dt;
      if (this.bounceT > 0) this.bounceT = Math.max(0, this.bounceT - dt * 2.1);
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

  triggerBounce() {
    this.bounceT = 1.0;
    const palette = ['#ffd166', '#38f3ff', '#ff5ea8', '#3dffa2', '#ffffff'];
    for (let i = 0; i < 16; i++) {
      const ang = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.35;
      const spd = 65 + Math.random() * 115;
      this.sparkles.push({
        x: 225 + (Math.random() - 0.5) * 20,
        y: 422 + (Math.random() - 0.5) * 14,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 45,
        life: 0.7 + Math.random() * 0.35,
        maxLife: 1.05,
        r: 2.5 + Math.random() * 3.5,
        color: palette[i % palette.length],
      });
    }
  }

  updateSparkles(dt) {
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 220 * dt;
      s.life -= dt;
      if (s.life <= 0) this.sparkles.splice(i, 1);
    }
  }

  render() {
    const ctx = syncCanvasDPR(this.canvas);
    if (!ctx) return;
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);

    // 1. Subtle ambient glow shimmer on Emerald Portal & Floating Daily Cube
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3.1);
    ctx.save();
    const portalGlow = ctx.createRadialGradient(106, 360, 4, 106, 360, 46);
    portalGlow.addColorStop(0, `rgba(61, 255, 200, ${0.22 + pulse * 0.14})`);
    portalGlow.addColorStop(1, 'rgba(61, 255, 200, 0)');
    ctx.fillStyle = portalGlow;
    ctx.beginPath();
    ctx.arc(106, 360, 46, 0, Math.PI * 2);
    ctx.fill();

    // Floating glint motes near Daily Cube (225, 312) and Vault Chest (388, 412)
    const glints = [
      [225 + Math.sin(this.t * 2.2) * 24, 306 + Math.cos(this.t * 2.8) * 10, '#fff7ae'],
      [388 + Math.cos(this.t * 2.4) * 18, 404 + Math.sin(this.t * 3.1) * 12, '#9beeff'],
      [104 + Math.sin(this.t * 1.9 + 1) * 18, 355 + Math.cos(this.t * 2.5) * 18, '#7cfcc6'],
    ];
    for (const [gx, gy, col] of glints) {
      const a = 0.35 + 0.55 * Math.abs(Math.sin(this.t * 2.6 + gx));
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(gx, gy, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Central golden stone pedestal highlight ring & Bean shadow
    const pedX = 225;
    const pedY = 446;
    const jumpArc = this.bounceT > 0 ? Math.sin(this.bounceT * Math.PI) * 32 : 0;
    const idleBob = Math.sin(this.t * 2.6) * 2.5;
    const by = pedY - 20 - idleBob - jumpArc;

    ctx.save();
    const ringAlpha = 0.25 + 0.18 * pulse;
    ctx.strokeStyle = `rgba(255, 240, 145, ${ringAlpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(pedX, pedY + 4, 58, 22, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Shadow shrinks naturally as Bean jumps
    const shScale = Math.max(0.55, 1 - jumpArc / 65);
    ctx.fillStyle = `rgba(18, 36, 12, ${0.34 * shScale})`;
    ctx.beginPath();
    ctx.ellipse(pedX, pedY + 4, 36 * shScale, 12 * shScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Live Equipped Jelly Bean Hero standing & bouncing on the Plaza Pedestal
    const squash =
      this.bounceT > 0.72
        ? 0.85
        : this.bounceT > 0.12
          ? 1.1
          : 1 + Math.sin(this.t * 5.2) * 0.03;
    const eyes =
      this.bounceT > 0.1
        ? 'happy'
        : Math.floor(this.t * 1.4) % 7 === 0
          ? 'wink'
          : 'happy';

    drawBean(ctx, pedX, by, 44, {
      dir: Math.sin(this.t * 0.9) >= 0 ? 1 : -1,
      walkT: this.bounceT > 0 ? this.t * 5.5 : this.t * 1.4,
      squash,
      eyes,
    });

    // 4. Tap celebration sparkles
    for (const s of this.sparkles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life / s.maxLife));
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
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
      // Soft outer gold aura
      trace();
      ctx.strokeStyle = 'rgba(255, 204, 64, 0.38)';
      ctx.lineWidth = 14;
      ctx.stroke();

      // Core warm golden Nintendo path ribbon
      trace();
      ctx.strokeStyle = '#ffd15c';
      ctx.lineWidth = 6.5;
      ctx.stroke();

      // Animated traveling light bead along spline
      const phase = ((this.t * 0.55 + worldIdx * 0.23) % 1 + 1) % 1;
      const totalPts = pts.length - 1;
      const fIdx = Math.min(totalPts - 1, Math.floor(phase * totalPts));
      const localT = phase * totalPts - fIdx;
      const p0 = pts[fIdx];
      const p1 = pts[fIdx + 1];
      const gx = p0[0] + (p1[0] - p0[0]) * localT;
      const gy = p0[1] + (p1[1] - p0[1]) * localT;

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(gx, gy, 3.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Subtle muted dotted stepping stones on locked stretches
      trace();
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFlag(ctx, x, y, stars) {
    ctx.save();
    const wave = Math.sin(this.t * 5.2 + x) * 2.2;
    const isGold = stars >= 3;
    const flagCol = isGold ? '#ffbe2e' : '#25e6ff';
    const trimCol = isGold ? '#fff3a8' : '#b8fbff';

    // Pole shadow & metal pole
    ctx.strokeStyle = '#1b1d36';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 34);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 34);
    ctx.stroke();

    // Waving pennant
    ctx.fillStyle = flagCol;
    ctx.strokeStyle = '#1b1d36';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 33);
    ctx.quadraticCurveTo(x + 13, y - 36 + wave, x + 23, y - 28 + wave * 0.7);
    ctx.lineTo(x + 1, y - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Mini highlight emblem
    ctx.fillStyle = trimCol;
    ctx.beginPath();
    ctx.arc(x + 9, y - 27 + wave * 0.3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Top gold finial sphere
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#1b1d36';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y - 35, 3.6, 0, Math.PI * 2);
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
        // Expanding Nintendo Mario active pad halo
        ctx.save();
        ctx.strokeStyle = `rgba(255, 226, 85, ${0.55 + pulse * 0.4})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(x, y, 27 + pulse * 4, 15 + pulse * 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (!st.unlocked) {
        // Dim circular lock medallion over locked pad
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.52)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y, 21, 11.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = '700 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText('🔒', x, y - 1);
        ctx.restore();
      } else if (st.cleared) {
        this.drawFlag(ctx, x - 21, y - 4, st.stars);
      }
    }

    // Subtle shimmer inside W2 warp arch when unlocked or previewing
    const world = getWorldById('world-1');
    const px = world.portalPos.x;
    const py = world.portalPos.y - 14;
    ctx.save();
    const w2Open = !!store.worlds.world2Unlocked;
    const g = ctx.createRadialGradient(px, py, 2, px, py, 24);
    g.addColorStop(0, w2Open ? `rgba(56, 243, 255, ${0.42 + pulse * 0.25})` : 'rgba(56, 243, 255, 0.16)');
    g.addColorStop(1, 'rgba(56, 243, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, 24, 0, Math.PI * 2);
    ctx.fill();
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

    // Spur path to W2 Warp Arch
    const world = getWorldById('world-1');
    this.drawPathSegment(ctx, world.portalPath, !!store.worlds.world2Unlocked, 5);

    // 2. Draw pad rings, lock medallions, & clear flags
    this.drawPadHighlights(ctx);

    // 3. Draw Star Chest glow ring if a chest is ready to claim
    const nextChest = store.getNextUnclaimedChest();
    if (nextChest && nextChest.ready) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 5);
      const { x, y } = world.chestPos;
      ctx.save();
      const cg = ctx.createRadialGradient(x, y, 4, x, y, 28 + pulse * 6);
      cg.addColorStop(0, `rgba(255, 215, 70, ${0.55 + pulse * 0.3})`);
      cg.addColorStop(1, 'rgba(255, 215, 70, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(x, y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Live Equipped Jelly Bean walking/bouncing on the active pad
    const { x, y } = this.beanPos;
    const hop = this.isWalking ? Math.abs(Math.sin(this.t * 14)) * 6 : Math.sin(this.t * 3.4) * 2;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 32, 14, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawBean(ctx, x, y - 14 - hop, 24, {
      dir: this.beanDir,
      walkT: this.isWalking ? this.t * 7.5 : this.t * 1.6,
      squash: this.isWalking ? 1 + Math.sin(this.t * 14) * 0.08 : 1 + Math.sin(this.t * 3.4) * 0.03,
      eyes: 'happy',
    });
  }
}

export { WORLD_1_CHESTS };
