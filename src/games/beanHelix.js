/**
 * ============================================================================
 * BEAN HELIX (Helix Jump AAA Hyper-Casual Edition)
 * ============================================================================
 * 
 * Ultra-juicy, polished 3D isometric procedural tower drop built strictly
 * to the Game Reels Playbook:
 * - Studio ambient backdrop with floating bokeh motes
 * - Solid 3D tiered disc geometry with illuminated front rims and radial gap cut walls
 * - Glossy obsidian/titanium center cylinder with vertical light streak sheen
 * - Signature Helix Jump organic paint splatters on impact
 * - Exaggerated squash & stretch physics with landing shockwave rings
 * - Vertigo wind speed lines during multi-floor freefalls
 * - Fiery comet mode with 3D shattered wedge debris
 * - Safe Zones: Top HUD 130px, Bottom Dock 695px
 * ============================================================================
 */

import { Game } from '../engine/Game.js';
import { FX } from '../engine/fx.js';
import { drawBean } from '../engine/bean.js';
import {
  shadeColor,
  toyRim,
  toyLineW,
  drawToyShadow,
  drawToySphere,
  drawToyBevelRect,
  traceRoundRect,
} from '../engine/toyStyle.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);

const normalizeAngle = (a) => {
  let ang = a % TAU;
  if (ang < 0) ang += TAU;
  return ang;
};

// Sector Types
const SECTOR_SAFE = 0;
const SECTOR_GAP = 1;
const SECTOR_HAZARD = 2;

// Geometry configuration
const SLICES_PER_FLOOR = 12;
const SLICE_ANGLE = TAU / SLICES_PER_FLOOR; // 30 degrees
const R_POLE = 36;   // Central cylinder radius
const R_PLAT = 148;  // Outer platform radius
const TILT_Y = 0.38; // Isometric pitch squish
const RIM_H = 16;    // 3D extrusion thickness
const FLOOR_GAP = 145;

export class BeanHelix extends Game {
  static meta = {
    id: 'bean-helix',
    title: 'Bean Helix',
    icon: '🌀',
    hint: 'DRAG left/right to rotate tower · DROP through gaps · SMASH with multi-floor combos!',
    baseLikes: 8940,
    isPrestige: true,
    parScore60s: 5500,
    roundLen: 60,
    cue: 'DROP THROUGH THE GAPS!',
    prestigeCue: 'TALLER TOWER · MORE HAZARDS!',
    scaling: {
      totalFloors:  { base: 15,   rate: 0.20, cap: 26,   mode: 'up', round: true, label: 'Tower Floors' },
      gravity:      { base: 980,  rate: 0.15, cap: 1240, mode: 'up', round: true, label: 'Drop Speed' },
      hazardChance: { base: 0.18, rate: 0.20, cap: 0.42, mode: 'up', label: 'Hazard Slices' },
    },
  };

  init(saved, score = 0) {
    this.fx = new FX();
    this.score = score;

    // SSOT Prestige difficulty scalers
    this.pLevel = Math.max(1, this.prestige || 1);
    this.totalFloors = this.diff.totalFloors ?? 15;
    this.gravity = this.diff.gravity ?? 980;
    this.hazardChance = this.diff.hazardChance ?? 0.18;

    // Tower State
    this.towerAngle = 0;
    this.targetTowerAngle = 0;
    this.rotVelocity = 0;

    // Ball / Mascot Bean State
    this.ball = {
      worldY: -45,
      vy: 0,
      radius: 14,
      bounceV: -460,
      combo: 0,
      isFire: false,
      flameTimer: 0,
      squashX: 1,
      squashY: 1,
      color: '#ff477e',
      bellyColor: '#ff85a1',
      splatColor: '#ff477e',
    };

    // Camera
    this.camY = -140;

    // Visual Ambiance & Effects
    this.ambientMotes = this.generateAmbientMotes(24);
    this.windLines = [];
    this.impactRipples = [];
    this.shards = [];

    // Procedural Floors
    this.floors = this.generateFloors();

    if (saved) {
      if (Number.isFinite(saved.floor)) {
        const resumeFloor = clamp(saved.floor, 0, this.totalFloors - 2);
        this.ball.worldY = resumeFloor * FLOOR_GAP;
        this.camY = this.ball.worldY - 140;
      }
      this.grace = 1.2;
    } else {
      this.grace = 0.5;
    }
  }

  generateAmbientMotes(count) {
    const motes = [];
    for (let i = 0; i < count; i++) {
      motes.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        r: rand(1.5, 3.5),
        speed: rand(15, 40),
        alpha: rand(0.15, 0.45),
        pulse: Math.random() * TAU,
      });
    }
    return motes;
  }

  /* ----------------------------------------------------------- TOWER GENERATION */
  generateFloors() {
    const floors = [];

    for (let f = 0; f < this.totalFloors; f++) {
      const isTop = f === 0;
      const isGoal = f === this.totalFloors - 1;

      const sectors = [];
      const splats = [];

      if (isGoal) {
        // Final floor: Solid Golden Victory Podium!
        for (let s = 0; s < SLICES_PER_FLOOR; s++) {
          sectors.push({ type: SECTOR_SAFE, isGoal: true });
        }
      } else if (isTop) {
        // Starting floor: Safe landing area with 1 gap positioned away from ball
        for (let s = 0; s < SLICES_PER_FLOOR; s++) {
          sectors.push({ type: s === 5 ? SECTOR_GAP : SECTOR_SAFE });
        }
      } else {
        // Standard floor: 2 or 3 adjacent gap slices, hazards, and safe sectors
        const gapStart = Math.floor(Math.random() * SLICES_PER_FLOOR);
        const gapSize = Math.random() < 0.35 ? 3 : 2;

        for (let s = 0; s < SLICES_PER_FLOOR; s++) {
          const isGap = (s >= gapStart && s < gapStart + gapSize) ||
                        (gapStart + gapSize > SLICES_PER_FLOOR && s < (gapStart + gapSize) % SLICES_PER_FLOOR);

          if (isGap) {
            sectors.push({ type: SECTOR_GAP });
          } else {
            // Hazard chance (toxic red spikes/molten sectors)
            const isHazard = Math.random() < this.hazardChance;
            sectors.push({ type: isHazard ? SECTOR_HAZARD : SECTOR_SAFE });
          }
        }
      }

      floors.push({
        index: f,
        worldY: f * FLOOR_GAP,
        sectors,
        splats,
        broken: false,
        breakAlpha: 1.0,
      });
    }

    return floors;
  }

  /* ----------------------------------------------------------- UPDATE */
  update(dt) {
    if (this.dead) {
      this.updateDying(dt);
      return;
    }

    this.fx.update(dt);
    const b = this.ball;

    // 1. Process Input: Drag left/right to rotate tower with inertia
    const vec = this.input.vec(60);
    const keyVec = this.input.keyVec();

    if (Math.abs(vec.x) > 0.03) {
      this.rotVelocity = vec.x * 4.6;
    } else if (keyVec && Math.abs(keyVec.x) > 0.05) {
      this.rotVelocity = keyVec.x * 4.8;
    } else {
      this.rotVelocity *= Math.pow(0.04, dt); // Smooth drag friction
    }

    this.targetTowerAngle += this.rotVelocity * dt;
    this.towerAngle += (this.targetTowerAngle - this.towerAngle) * Math.min(1, dt * 20);

    // 2. Ball Vertical Gravity & Squash Interpolation
    b.vy += this.gravity * dt;
    b.worldY += b.vy * dt;

    // Relax squash/stretch back to normal over time
    b.squashX += (1 - b.squashX) * Math.min(1, dt * 14);
    b.squashY += (1 - b.squashY) * Math.min(1, dt * 14);

    // Dynamic stretch when falling fast
    if (b.vy > 250) {
      const stretchFactor = clamp(1 + (b.vy - 250) / 1400, 1, 1.45);
      b.squashY = Math.max(b.squashY, stretchFactor);
      b.squashX = Math.min(b.squashX, 1 / Math.sqrt(stretchFactor));
    }

    // Flame Mode timer
    if (b.flameTimer > 0) {
      b.flameTimer -= dt;
      if (b.flameTimer <= 0) b.isFire = false;
    }

    // Freefall Wind Streaks when dropping with combo
    if (b.vy > 400 && b.combo >= 1) {
      if (Math.random() < 0.6) {
        this.windLines.push({
          x: this.W / 2 + rand(-R_PLAT * 0.9, R_PLAT * 0.9),
          y: this.H - rand(60, 160),
          len: rand(40, 110),
          speed: b.vy * rand(0.9, 1.3),
          alpha: rand(0.35, 0.75),
        });
      }
    }

    // Update Wind Lines
    for (let i = this.windLines.length - 1; i >= 0; i--) {
      const wl = this.windLines[i];
      wl.y -= wl.speed * dt;
      wl.alpha -= dt * 2.2;
      if (wl.alpha <= 0 || wl.y < -100) this.windLines.splice(i, 1);
    }

    // Update Impact Ripples on platforms
    for (let i = this.impactRipples.length - 1; i >= 0; i--) {
      const rip = this.impactRipples[i];
      rip.r += 140 * dt;
      rip.alpha -= dt * 2.8;
      if (rip.alpha <= 0) this.impactRipples.splice(i, 1);
    }

    // 3. Collision with Platform Floors
    const currentFloorIdx = Math.floor(b.worldY / FLOOR_GAP);
    const nextFloorIdx = currentFloorIdx;

    if (nextFloorIdx >= 0 && nextFloorIdx < this.totalFloors) {
      const fl = this.floors[nextFloorIdx];
      const floorTop = fl.worldY;

      // Ball crossed floor plane going downwards
      if (!fl.broken && b.vy > 0 && b.worldY >= floorTop && (b.worldY - b.vy * dt) <= floorTop + 28) {
        this.handleFloorImpact(fl, nextFloorIdx);
      }
    }

    // 4. Smooth Camera Tracking
    const targetCamY = b.worldY - 265;
    this.camY += (targetCamY - this.camY) * Math.min(1, dt * 10);

    // 5. Update Ambient Glow Motes
    for (const m of this.ambientMotes) {
      m.y -= m.speed * dt;
      m.pulse += dt * 2;
      if (m.y < 0) {
        m.y = this.H + 10;
        m.x = Math.random() * this.W;
      }
    }

    // 6. Update Falling Platform Shards from smashed floors
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.vy += 880 * dt;
      sh.rot += sh.vRot * dt;
      sh.alpha -= dt * 1.4;
      if (sh.alpha <= 0) this.shards.splice(i, 1);
    }
  }

  /* ----------------------------------------------------------- IMPACT & COMBOS */
  handleFloorImpact(fl, floorIdx) {
    const b = this.ball;

    // Angle of sector facing directly forward at the ball
    const frontAngle = normalizeAngle(Math.PI / 2 - this.towerAngle);
    const sectorIdx = Math.floor(frontAngle / SLICE_ANGLE) % SLICES_PER_FLOOR;
    const sector = fl.sectors[sectorIdx];

    // Case 1: Drop through open GAP!
    if (sector.type === SECTOR_GAP) {
      b.combo++;
      this.score += 60 * b.combo;
      this.sounds.slice?.();
      this.haptics.light();

      // Multi-drop combo: dropping 2+ floors catches fire!
      if (b.combo >= 2) {
        b.isFire = true;
        b.flameTimer = 2.4;
        this.fx.burst(this.W / 2, 420, ['#ff477e', '#ffd166', '#ff9233'], 18, 220, 0.45, 4);
        this.fx.text(this.W / 2, 370, `COMBO ×${b.combo}! 🔥 SMASH READY!`, '#ffd166', 22, 0.95);
      } else {
        this.fx.text(this.W / 2, 390, `+${60 * b.combo}`, '#48dbfb', 18, 0.6);
      }
      return;
    }

    // Case 2: Fire Mode Smash!
    if (b.isFire && b.combo >= 2 && !sector.isGoal) {
      fl.broken = true;
      b.combo = 0;
      b.isFire = false;
      this.score += 300;
      this.sounds.hit?.();
      this.haptics.heavy();
      this.fx.shake(16, 0.4);
      this.fx.burst(this.W / 2, 430, ['#ffd166', '#ff477e', '#ff9f43', '#ffffff'], 36, 320, 0.7, 6);
      this.fx.text(this.W / 2, 370, '💥 SHATTERED! +300', '#ffd166', 24, 1.1);

      this.spawnFloorShards(fl);
      return;
    }

    // Case 3: Goal Podium Reached -> VICTORY!
    if (floorIdx >= this.totalFloors - 1) {
      b.worldY = fl.worldY;
      b.vy = 0;
      this.sounds.survive?.();
      this.haptics.success();
      this.fx.ring(this.W / 2, 440, '#ffd166', 360, 1.2, 8);
      this.fx.burst(this.W / 2, 440, ['#ffd166', '#ffdd59', '#ffffff'], 50, 360, 1.1, 6);
      this.complete('Helix Tower Conquered! 👑');
      return;
    }

    // Case 4: Sour Licorice / Molten Red Hazard -> FATAL
    if (sector.type === SECTOR_HAZARD) {
      b.worldY = fl.worldY;
      b.vy = 0;
      this.sounds.fail?.();
      this.haptics.fail();
      this.fx.shake(18, 0.5);
      this.fx.burst(this.W / 2, 430, ['#ff4757', '#ff6b81', '#2f3542'], 32, 280, 0.8, 5);
      this.die('Smashed onto toxic red hazard! 💀');
      return;
    }

    // Case 5: Safe Sector Regular Bounce
    b.worldY = fl.worldY;
    b.vy = b.bounceV;
    b.combo = 0;
    b.isFire = false;

    // Juicy squash on landing (wide & flat)
    b.squashX = 1.45;
    b.squashY = 0.65;

    this.sounds.pop?.();
    this.haptics.light();

    // Shockwave ripple ring on the platform
    this.impactRipples.push({
      floorIdx,
      r: 12,
      alpha: 0.9,
    });

    // Burst sparkles matching bean color
    this.fx.burst(this.W / 2, 440, ['#ff477e', '#ff85a1', '#ffffff'], 8, 120, 0.3, 3);

    // Leave a signature organic paint splatter decal on the platform
    fl.splats.push(this.createOrganicSplat(frontAngle));
  }

  createOrganicSplat(angle) {
    const mainR = rand(14, 20);
    const droplets = [];
    const dropCount = Math.floor(rand(4, 8));

    for (let i = 0; i < dropCount; i++) {
      const dropAng = Math.random() * TAU;
      const dropDist = mainR + rand(6, 18);
      droplets.push({
        dx: Math.cos(dropAng) * dropDist,
        dy: Math.sin(dropAng) * dropDist,
        r: rand(2.5, 5),
      });
    }

    return {
      angle,
      mainR,
      droplets,
      color: this.ball.splatColor,
      darkColor: '#c41c52',
    };
  }

  spawnFloorShards(fl) {
    const screenY = fl.worldY - this.camY;
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * TAU;
      const spd = rand(110, 260);
      this.shards.push({
        x: this.W / 2 + Math.cos(ang) * (R_PLAT * 0.75),
        y: screenY + Math.sin(ang) * (R_PLAT * 0.75 * TILT_Y),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - rand(60, 160),
        size: rand(10, 22),
        color: ['#5f27cd', '#341f97', '#ff4757', '#ffd166', '#48dbfb'][Math.floor(Math.random() * 5)],
        rot: Math.random() * TAU,
        vRot: rand(-7, 7),
        alpha: 1.0,
      });
    }
  }

  /* ----------------------------------------------------------- RENDER */
  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const shake = this.fx.offset();
    const centerX = W / 2;

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Studio Lighting Ambient Backdrop
    this.renderStudioBackdrop(ctx, W, H);

    // 2. Vertigo Freefall Wind Streaks
    this.renderWindLines(ctx);

    // 3. Central Cylinder Pole (Rendered through safe height with specular sheen)
    this.renderCentralPole(ctx, centerX);

    // 4. Spiral Platform Floors (Rendered back-to-front)
    const currentFloor = Math.floor(this.ball.worldY / FLOOR_GAP);
    const startF = Math.max(0, currentFloor - 2);
    const endF = Math.min(this.totalFloors - 1, currentFloor + 5);

    for (let f = endF; f >= startF; f--) {
      const fl = this.floors[f];
      if (fl.broken) continue;
      const screenY = fl.worldY - this.camY;

      // Only render within visible camera range
      if (screenY > Game.SAFE_TOP - 90 && screenY < Game.SAFE_BOTTOM + 110) {
        this.renderPlatformFloor(ctx, fl, centerX, screenY);
      }
    }

    // 5. Shattered 3D Vinyl Debris Shards
    for (const sh of this.shards) {
      ctx.save();
      ctx.globalAlpha = sh.alpha;
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.rot);
      const sg = ctx.createLinearGradient(-sh.size * 0.5, -sh.size * 0.5, sh.size * 0.5, sh.size * 0.6);
      sg.addColorStop(0, shadeColor(sh.color, 0.34));
      sg.addColorStop(0.55, sh.color);
      sg.addColorStop(1, shadeColor(sh.color, -0.28));
      ctx.fillStyle = sg;
      ctx.strokeStyle = toyRim(sh.color, 0.55);
      ctx.lineWidth = toyLineW(sh.size, 0.08, 0.9, 1.8);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-sh.size * 0.5, -sh.size * 0.5);
      ctx.lineTo(sh.size * 0.6, -sh.size * 0.2);
      ctx.lineTo(sh.size * 0.3, sh.size * 0.6);
      ctx.lineTo(-sh.size * 0.4, sh.size * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(-sh.size * 0.35, -sh.size * 0.35);
      ctx.lineTo(sh.size * 0.4, -sh.size * 0.15);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 6. Mascot Bean Ball & Shadow
    const ballScreenY = this.ball.worldY - this.camY;
    this.renderBouncingBall(ctx, centerX, ballScreenY);

    // 7. Toy Bevel Progress HUD
    this.renderProgressHUD(ctx, W, currentFloor);

    this.fx.render(ctx, 1);
    ctx.restore();
  }

  /* ----------------------------------------------------------- STUDIO BACKDROP */
  renderStudioBackdrop(ctx, W, H) {
    // Rich, soft studio spotlight diorama backdrop
    const grad = ctx.createRadialGradient(W / 2, H * 0.42, 36, W / 2, H * 0.45, W * 0.95);
    grad.addColorStop(0, '#27234f');
    grad.addColorStop(0.55, '#14112e');
    grad.addColorStop(1, '#090818');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Floating Ambient Bokeh Motes with crisp centers
    for (const m of this.ambientMotes) {
      const alpha = m.alpha * (0.7 + 0.3 * Math.sin(m.pulse));
      ctx.fillStyle = `rgba(196, 181, 253, ${alpha * 0.55})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 1.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 0.7, 0, TAU);
      ctx.fill();
    }
  }

  /* ----------------------------------------------------------- WIND LINES */
  renderWindLines(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const wl of this.windLines) {
      ctx.strokeStyle = `rgba(186, 230, 253, ${wl.alpha})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(wl.x, wl.y);
      ctx.lineTo(wl.x, wl.y - wl.len);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ----------------------------------------------------------- CENTRAL POLE */
  renderCentralPole(ctx, cx) {
    const topY = Game.SAFE_TOP - 40;
    const botY = Game.SAFE_BOTTOM + 50;
    const w = R_POLE * 2;
    const leftX = cx - R_POLE;

    // Glossy 3D Vinyl/Titanium Cylinder Gradient
    const poleGrad = ctx.createLinearGradient(leftX, 0, leftX + w, 0);
    poleGrad.addColorStop(0.0, '#1e2235');
    poleGrad.addColorStop(0.22, '#3b4266');
    poleGrad.addColorStop(0.42, '#737da8'); // Primary studio highlight
    poleGrad.addColorStop(0.66, '#2d324d');
    poleGrad.addColorStop(0.88, '#3d456b'); // Rim bounce highlight
    poleGrad.addColorStop(1.0, '#171928');

    ctx.fillStyle = poleGrad;
    ctx.fillRect(leftX, topY, w, botY - topY);

    // Specular plastic sheen stripe
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(leftX + w * 0.36, topY, w * 0.1, botY - topY);

    // Crisp tinted obsidian rim edges
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.lineTo(leftX, botY);
    ctx.moveTo(leftX + w, topY);
    ctx.lineTo(leftX + w, botY);
    ctx.stroke();
  }

  /* ----------------------------------------------------------- PLATFORM RENDERING */
  renderPlatformFloor(ctx, fl, cx, cy) {
    const isGoal = fl.index === this.totalFloors - 1;

    // A. Render 3D Extruded Front Rims (Faces tilted toward camera)
    for (let s = 0; s < SLICES_PER_FLOOR; s++) {
      const sector = fl.sectors[s];
      if (sector.type === SECTOR_GAP) continue;

      const a1 = s * SLICE_ANGLE + this.towerAngle;
      const a2 = (s + 1) * SLICE_ANGLE + this.towerAngle;
      const midAngle = (a1 + a2) / 2;

      // Only draw rim if facing viewer
      if (Math.sin(midAngle) > -0.2) {
        this.renderSliceRim(ctx, s, sector, isGoal, a1, a2, cx, cy);
      }
    }

    // B. Render Radial Gap Cut Walls (Solid 3D disc thickness at slice ends!)
    for (let s = 0; s < SLICES_PER_FLOOR; s++) {
      const sector = fl.sectors[s];
      if (sector.type === SECTOR_GAP) continue;

      const prevIdx = (s - 1 + SLICES_PER_FLOOR) % SLICES_PER_FLOOR;
      const nextIdx = (s + 1) % SLICES_PER_FLOOR;

      const a1 = s * SLICE_ANGLE + this.towerAngle;
      const a2 = (s + 1) * SLICE_ANGLE + this.towerAngle;

      // If previous sector was gap, draw radial wall at a1
      if (fl.sectors[prevIdx].type === SECTOR_GAP) {
        this.renderGapCutWall(ctx, sector, isGoal, a1, cx, cy, true);
      }
      // If next sector was gap, draw radial wall at a2
      if (fl.sectors[nextIdx].type === SECTOR_GAP) {
        this.renderGapCutWall(ctx, sector, isGoal, a2, cx, cy, false);
      }
    }

    // C. Render Top Slices (Discs)
    for (let s = 0; s < SLICES_PER_FLOOR; s++) {
      const sector = fl.sectors[s];
      if (sector.type === SECTOR_GAP) continue;

      const a1 = s * SLICE_ANGLE + this.towerAngle;
      const a2 = (s + 1) * SLICE_ANGLE + this.towerAngle;

      this.renderSliceTop(ctx, s, sector, isGoal, a1, a2, cx, cy);
    }

    // D. Render Glossy 3D Vinyl Paint Splatters on this platform
    for (const spl of fl.splats) {
      const splAngle = spl.angle + this.towerAngle;
      const splRadius = (R_PLAT + R_POLE) * 0.52;
      const sx = cx + Math.cos(splAngle) * splRadius;
      const sy = cy + Math.sin(splAngle) * (splRadius * TILT_Y);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, TILT_Y);

      // Subtle rim/bevel under paint blob
      ctx.fillStyle = spl.darkColor;
      ctx.beginPath();
      ctx.arc(0, 2, spl.mainR + 1, 0, TAU);
      ctx.fill();

      ctx.fillStyle = spl.color;
      ctx.beginPath();
      ctx.arc(0, 0, spl.mainR, 0, TAU);
      ctx.fill();

      // Droplet splashes radiating out
      for (const d of spl.droplets) {
        ctx.fillStyle = spl.color;
        ctx.beginPath();
        ctx.arc(d.dx, d.dy, d.r, 0, TAU);
        ctx.fill();
      }

      // Glossy specular paint sheen
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-spl.mainR * 0.28, -spl.mainR * 0.28, spl.mainR * 0.35, spl.mainR * 0.16, -0.4, 0, TAU);
      ctx.fill();

      ctx.restore();
    }

    // E. Render Impact Shockwave Rings
    for (const rip of this.impactRipples) {
      if (rip.floorIdx === fl.index) {
        const ballWorldR = (R_PLAT + R_POLE) * 0.52;
        const rx = cx;
        const ry = cy + (ballWorldR * TILT_Y);

        ctx.save();
        ctx.strokeStyle = `rgba(255, 117, 143, ${rip.alpha})`;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(rx, ry, rip.r, rip.r * TILT_Y, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  renderSliceRim(ctx, s, sector, isGoal, a1, a2, cx, cy) {
    let baseRim;
    if (isGoal) {
      baseRim = '#f59e0b';
    } else if (sector.type === SECTOR_HAZARD) {
      baseRim = '#dc2626';
    } else {
      baseRim = s % 2 === 0 ? '#4f46e5' : '#4338ca';
    }

    const x1 = cx + Math.cos(a1) * R_PLAT;
    const y1 = cy + Math.sin(a1) * (R_PLAT * TILT_Y);
    const x2 = cx + Math.cos(a2) * R_PLAT;
    const y2 = cy + Math.sin(a2) * (R_PLAT * TILT_Y);

    const rimGrad = ctx.createLinearGradient(x1, y1, x2, y2 + RIM_H);
    rimGrad.addColorStop(0, shadeColor(baseRim, 0.08));
    rimGrad.addColorStop(0.5, shadeColor(baseRim, -0.18));
    rimGrad.addColorStop(1, shadeColor(baseRim, -0.4));

    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 + RIM_H);
    ctx.lineTo(x1, y1 + RIM_H);
    ctx.closePath();
    ctx.fill();

    // Tinted rim crease at bottom lip
    ctx.strokeStyle = toyRim(baseRim, 0.65);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1 + RIM_H);
    ctx.lineTo(x2, y2 + RIM_H);
    ctx.stroke();
  }

  renderGapCutWall(ctx, sector, isGoal, ang, cx, cy, isStart) {
    // Only draw if facing towards camera
    const normal = isStart ? Math.cos(ang - Math.PI / 2) : Math.cos(ang + Math.PI / 2);
    if (normal < -0.1) return;

    let wallBase;
    if (isGoal) {
      wallBase = '#d97706';
    } else if (sector.type === SECTOR_HAZARD) {
      wallBase = '#991b1b';
    } else {
      wallBase = '#312e81';
    }

    const inX = cx + Math.cos(ang) * R_POLE;
    const inY = cy + Math.sin(ang) * (R_POLE * TILT_Y);
    const outX = cx + Math.cos(ang) * R_PLAT;
    const outY = cy + Math.sin(ang) * (R_PLAT * TILT_Y);

    const wg = ctx.createLinearGradient(inX, inY, outX, outY + RIM_H);
    wg.addColorStop(0, shadeColor(wallBase, -0.12));
    wg.addColorStop(1, shadeColor(wallBase, -0.38));

    ctx.fillStyle = wg;
    ctx.strokeStyle = toyRim(wallBase, 0.6);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(inX, inY);
    ctx.lineTo(outX, outY);
    ctx.lineTo(outX, outY + RIM_H);
    ctx.lineTo(inX, inY + RIM_H);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  renderSliceTop(ctx, s, sector, isGoal, a1, a2, cx, cy) {
    let topBase;
    if (isGoal) {
      topBase = '#ffd166';
    } else if (sector.type === SECTOR_HAZARD) {
      topBase = '#f43f5e';
    } else {
      topBase = s % 2 === 0 ? '#6366f1' : '#7c3aed';
    }

    const midA = (a1 + a2) / 2;
    const gStartX = cx + Math.cos(midA) * R_POLE;
    const gStartY = cy + Math.sin(midA) * (R_POLE * TILT_Y);
    const gEndX = cx + Math.cos(midA) * R_PLAT;
    const gEndY = cy + Math.sin(midA) * (R_PLAT * TILT_Y);

    const topGrad = ctx.createLinearGradient(gStartX, gStartY - 20, gEndX, gEndY + 12);
    topGrad.addColorStop(0, shadeColor(topBase, 0.3));
    topGrad.addColorStop(0.55, topBase);
    topGrad.addColorStop(1, shadeColor(topBase, -0.16));

    // Top Polygon
    ctx.fillStyle = topGrad;
    ctx.beginPath();

    // Outer arc
    for (let step = 0; step <= 6; step++) {
      const ang = a1 + (a2 - a1) * (step / 6);
      const px = cx + Math.cos(ang) * R_PLAT;
      const py = cy + Math.sin(ang) * (R_PLAT * TILT_Y);
      if (step === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    // Inner arc
    for (let step = 6; step >= 0; step--) {
      const ang = a1 + (a2 - a1) * (step / 6);
      const px = cx + Math.cos(ang) * R_POLE;
      const py = cy + Math.sin(ang) * (R_POLE * TILT_Y);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Subtle tinted slice seam
    ctx.strokeStyle = toyRim(topBase, 0.42);
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Specular toy bevel highlight on outer rim
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let step = 0; step <= 6; step++) {
      const ang = a1 + (a2 - a1) * (step / 6);
      const px = cx + Math.cos(ang) * R_PLAT;
      const py = cy + Math.sin(ang) * (R_PLAT * TILT_Y);
      if (step === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Tactile 3D Vinyl Hazard Stud
    if (sector.type === SECTOR_HAZARD) {
      const hx = cx + Math.cos(midA) * ((R_PLAT + R_POLE) * 0.52);
      const hy = cy + Math.sin(midA) * ((R_PLAT + R_POLE) * 0.52 * TILT_Y);

      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(1, TILT_Y + 0.18);
      drawToySphere(ctx, 0, 0, 6.2, '#fb7185', {
        rimColor: '#881337',
        lineWidth: 1.2,
        shine: 0.72,
      });
      ctx.restore();
    }
  }

  /* ----------------------------------------------------------- BALL RENDERING */
  renderBouncingBall(ctx, cx, ballScreenY) {
    const b = this.ball;
    const bx = cx;
    const by = ballScreenY;

    // 1. Soft Grounding Shadow on platform below
    const nextFloorIdx = clamp(Math.floor(b.worldY / FLOOR_GAP), 0, this.totalFloors - 1);
    const platScreenY = (nextFloorIdx * FLOOR_GAP) - this.camY;
    const distToPlat = Math.max(0, platScreenY - by);
    const shadowScale = clamp(1 - distToPlat / 190, 0.2, 1.0);
    drawToyShadow(ctx, bx, platScreenY, 21 * shadowScale, 8.5 * shadowScale, 0.42 * shadowScale);

    // 2. Fire Comet Aura when in combo streak
    if (b.isFire) {
      const auraG = ctx.createRadialGradient(bx, by, b.radius * 0.5, bx, by, b.radius * 2.8);
      auraG.addColorStop(0, 'rgba(255, 209, 102, 0.72)');
      auraG.addColorStop(0.55, 'rgba(255, 71, 126, 0.4)');
      auraG.addColorStop(1, 'rgba(255, 71, 126, 0)');
      ctx.fillStyle = auraG;
      ctx.beginPath();
      ctx.arc(bx, by, b.radius * 2.8, 0, TAU);
      ctx.fill();
      this.fx.burst(bx + rand(-6, 6), by + 8, ['#ffd166', '#ff477e', '#ff9233', '#ffffff'], 2, 80, 0.25, 4);
    }

    // 3. Render Mascot Bean with Dynamic Squash & Stretch
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(b.squashX, b.squashY);

    drawBean(ctx, 0, 0, b.radius * 2.3, {
      color: b.isFire ? '#ffd166' : b.color,
      bellyColor: b.isFire ? '#ff4757' : b.bellyColor,
      walkT: this.time * 1.4,
      eyes: this.dead ? 'squish' : b.isFire ? 'wink' : 'happy',
      hat: this.pLevel > 1 ? 'crown' : null,
      squash: 1, // Handled via canvas transform scale
      dead: !!this.dead,
    });
    ctx.restore();
  }

  /* ----------------------------------------------------------- PROGRESS HUD */
  renderProgressHUD(ctx, W, currentFloor) {
    const hudY = Game.SAFE_TOP + 18;
    const progress = clamp(currentFloor / (this.totalFloors - 1), 0, 1);

    // Current Floor Large Indicator with crisp dark ink outline
    ctx.font = "700 24px 'Fredoka', 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeText(`${Math.max(0, currentFloor)}`, W / 2, hudY - 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.max(0, currentFloor)}`, W / 2, hudY - 4);

    // Toy Bevel Progress Capsule
    const barW = 210;
    const barH = 10;
    const barX = (W - barW) / 2;

    drawToyBevelRect(ctx, barX - 2, hudY + 3, barW + 4, barH + 4, (barH + 4) / 2, '#0f172a', {
      depth: 2.5,
      rimColor: '#475569',
      lineWidth: 1.5,
      gloss: false,
    });

    // Animated Glossy Fill
    if (progress > 0) {
      const fillW = Math.max(barH, barW * progress);
      const fillGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
      fillGrad.addColorStop(0, '#6366f1');
      fillGrad.addColorStop(0.55, '#f43f5e');
      fillGrad.addColorStop(1, '#ffd166');

      ctx.fillStyle = fillGrad;
      traceRoundRect(ctx, barX, hudY + 5, fillW, barH, barH / 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
      traceRoundRect(ctx, barX + 2, hudY + 6, Math.max(2, fillW - 4), 3, 1.5);
      ctx.fill();
    }

    // Start Capsule Badge (Floor 1)
    drawToySphere(ctx, barX, hudY + 10, 13, '#48dbfb', {
      rimColor: '#0369a1',
      lineWidth: 1.6,
      shine: 0.72,
    });
    ctx.fillStyle = '#0f172a';
    ctx.font = "700 11px 'Fredoka', 'Outfit', sans-serif";
    ctx.textBaseline = 'middle';
    ctx.fillText('1', barX, hudY + 10.5);

    // Goal Capsule Badge (Crown)
    drawToySphere(ctx, barX + barW, hudY + 10, 13, '#ffd166', {
      rimColor: '#92400e',
      lineWidth: 1.6,
      shine: 0.72,
    });
    ctx.font = "700 11px 'Fredoka', 'Outfit', sans-serif";
    ctx.fillText('👑', barX + barW, hudY + 10.5);
    ctx.textBaseline = 'alphabetic';
  }

  /* ----------------------------------------------------------- SERIALIZE */
  serialize() {
    return {
      floor: Math.floor(this.ball.worldY / FLOOR_GAP),
      score: this.score,
    };
  }

  restoreLabel() {
    const f = Math.floor(this.ball.worldY / FLOOR_GAP);
    return `Floor ${f} / ${this.totalFloors}`;
  }

  destroy() {
    this.shards = [];
    this.floors = [];
    this.windLines = [];
    this.impactRipples = [];
  }
}
