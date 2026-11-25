// Master 3D Vinyl Toy Jellybean Mascot Renderer
// Clean, soft-lit 3D toy aesthetics: smooth cylindrical lighting, seamless noodle limbs, and minimal crisp expressions.

import { shadeColor, mixColor, toyRim, toyLineW, drawToyShadow } from './toyStyle.js';

const TAU = Math.PI * 2;

export function drawBean(ctx, x, y, size = 30, opts = {}) {
  const {
    color = '#25e6ff',
    bellyColor = '#1ec0db',
    dir = 1,
    walkT = 0,
    squash = 1,
    eyes = 'happy',
    hat = null,
    ufo = false,
    holding = null,
    dead = false,
  } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  const sq = Math.max(0.65, Math.min(1.45, squash));
  const w = size * 0.72 * (2 - sq);
  const h = size * 1.18 * sq;
  const radius = w * 0.5;
  const bodyH = h * 0.88;
  const bodyY = ufo ? size * 0.04 : 0;
  const topY = -bodyH * 0.5 + radius;
  const botY = bodyH * 0.5 - radius;
  const rim = toyRim(color, 0.56);
  const lw = toyLineW(size, 0.032, 0.7, 1.65);
  const legSwing = Math.sin(walkT * 10) * (size * 0.14);
  const armPhase = Math.sin(walkT * 6.5);

  // 1. Optional Hover-UFO Kart (Void Eater mode)
  if (ufo) {
    const jg = ctx.createRadialGradient(0, size * 0.7, 2, 0, size * 0.7, size * 0.65);
    jg.addColorStop(0, '#ffe066');
    jg.addColorStop(0.55, 'rgba(56, 243, 255, 0.5)');
    jg.addColorStop(1, 'rgba(56, 243, 255, 0)');
    ctx.fillStyle = jg;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.72, size * 0.72, size * 0.34, 0, 0, TAU);
    ctx.fill();

    const kg = ctx.createLinearGradient(-size * 0.9, 0, size * 0.9, 0);
    kg.addColorStop(0, '#60a5fa');
    kg.addColorStop(0.5, '#a855f7');
    kg.addColorStop(1, '#f472b6');
    ctx.fillStyle = kg;
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = toyLineW(size, 0.04, 0.9, 2.0);
    ctx.beginPath();
    ctx.ellipse(0, size * 0.45, size * 0.95, size * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(-size * 0.28, size * 0.37, size * 0.44, size * 0.08, -0.15, 0, TAU);
    ctx.fill();
  }

  // Helper for seamless curved vinyl noodle arm
  const drawNoodleArm = (sx, sy, cx, cy, ex, ey, baseCol, shadowBias = 0) => {
    const armW = Math.max(2.0, radius * 0.34);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Hairline tinted rim underneath
    ctx.strokeStyle = rim;
    ctx.lineWidth = armW + lw * 1.45;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();

    // Soft shaded vinyl fill stroke
    ctx.strokeStyle = shadowBias !== 0 ? shadeColor(baseCol, shadowBias) : baseCol;
    ctx.lineWidth = armW;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();

    // Subtle upper vinyl gloss
    if (size >= 18) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.lineWidth = armW * 0.32;
      ctx.beginPath();
      ctx.moveTo(sx, sy - armW * 0.18);
      ctx.quadraticCurveTo(cx, cy - armW * 0.2, ex, ey - armW * 0.16);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Helper for attached stubby vinyl leg/foot (merged cleanly under body silhouette)
  const drawAttachedFoot = (fx, fy, fw, fh, footColor) => {
    ctx.save();
    const fg = ctx.createRadialGradient(fx - fw * 0.2, fy - fh * 0.2, 1, fx, fy, Math.max(fw, fh));
    fg.addColorStop(0, shadeColor(footColor, 0.22));
    fg.addColorStop(0.65, footColor);
    fg.addColorStop(1, shadeColor(footColor, -0.25));
    ctx.fillStyle = fg;
    ctx.strokeStyle = rim;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(fx - fw * 0.5, fy - fh * 0.5, fw, fh, Math.min(fw, fh) * 0.48);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  // 2. Back Noodle Arm (drawn behind body)
  const shoulderY = bodyY + topY + radius * 0.92;
  if (!holding) {
    drawNoodleArm(
      -radius * 0.72, shoulderY,
      -radius * 1.15, shoulderY + radius * (0.28 + armPhase * 0.12),
      -radius * 1.26, shoulderY + radius * (0.72 + armPhase * 0.2),
      color, -0.1,
    );
  }

  // 3. Attached Stubby Legs / Scuba Flippers (tucked into lower torso so they never float detached!)
  if (!ufo) {
    const legTopY = bodyY + botY + radius * 0.72;
    const legH = Math.max(4, size * 0.28);
    const legW = Math.max(3.5, radius * 0.44);

    if (hat === 'scuba') {
      const fCol = '#ff9f1c';
      const fRim = toyRim(fCol, 0.55);
      [-1, 1].forEach((side, idx) => {
        const ly = legTopY + legH * 0.28 + (idx === 0 ? legSwing * 0.5 : -legSwing * 0.5);
        ctx.save();
        ctx.translate(side * radius * 0.48, ly);
        ctx.rotate(side * 0.24);
        const fg = ctx.createLinearGradient(0, -size * 0.12, 0, size * 0.12);
        fg.addColorStop(0, '#ffd166');
        fg.addColorStop(1, '#f97316');
        ctx.fillStyle = fg;
        ctx.strokeStyle = fRim;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.ellipse(side * size * 0.08, 0, size * 0.26, size * 0.11, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    } else {
      const footCol = bellyColor || shadeColor(color, -0.08);
      drawAttachedFoot(-radius * 0.44, legTopY + Math.max(0, legSwing * 0.55), legW, legH, footCol);
      drawAttachedFoot(radius * 0.44, legTopY + Math.max(0, -legSwing * 0.55), legW, legH, footCol);
    }
  }

  // 4. Volumetric 3D Vinyl Torso Pill
  ctx.save();
  ctx.translate(0, bodyY);

  const traceCapsule = () => {
    ctx.beginPath();
    ctx.arc(0, topY, radius, Math.PI, 0, false);
    ctx.arc(0, botY, radius, 0, Math.PI, false);
    ctx.closePath();
  };

  // Multi-stop radial studio lighting (upper-left key light -> bright vinyl cyan -> warm lower-right shadow)
  const bodyGrad = ctx.createRadialGradient(
    -radius * 0.34,
    topY - radius * 0.22,
    Math.max(1, radius * 0.12),
    radius * 0.1,
    0,
    bodyH * 0.92,
  );
  bodyGrad.addColorStop(0, shadeColor(color, 0.56));
  bodyGrad.addColorStop(0.32, color);
  bodyGrad.addColorStop(0.78, mixColor(color, bellyColor || color, 0.45));
  bodyGrad.addColorStop(1, shadeColor(bellyColor || color, -0.28));

  ctx.fillStyle = bodyGrad;
  traceCapsule();
  ctx.fill();

  // Soft glossy vinyl forehead reflection + ambient bounce rim
  if (size >= 10) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.28, topY - radius * 0.36, radius * 0.36, radius * 0.16, -0.35, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, botY + radius * 0.25, radius * 0.52, radius * 0.22, 0, 0, TAU);
    ctx.fill();
  }

  // Clean hairline tinted edge instead of thick #000 border
  ctx.strokeStyle = rim;
  ctx.lineWidth = lw;
  traceCapsule();
  ctx.stroke();

  // Soft shoulder blend dot where front arm meets torso cleanly
  const frontShoulderX = radius * 0.72;

  // 5. Front Noodle Arm (holding overhead OR cheerful wave / walk swing!)
  if (holding) {
    drawNoodleArm(
      -radius * 0.78, shoulderY - radius * 0.15,
      -radius * 1.15, shoulderY - radius * 0.7,
      -radius * 0.6, topY - radius * 0.75,
      color, 0.04,
    );
    drawNoodleArm(
      frontShoulderX, shoulderY - radius * 0.15,
      radius * 1.15, shoulderY - radius * 0.7,
      radius * 0.6, topY - radius * 0.75,
      color, 0.08,
    );
  } else {
    // Cheerful waving or dynamic swing matching the Toy Courtyard reference pose
    const waveRaise = walkT === 0 ? 0.55 : (0.15 - armPhase * 0.48);
    drawNoodleArm(
      frontShoulderX, shoulderY,
      radius * 1.18, shoulderY - radius * (0.1 + waveRaise * 0.35),
      radius * 1.32, shoulderY - radius * (0.45 * waveRaise + 0.05),
      color, 0.08,
    );
  }

  // 6. Clean Expressive Minimal Toy Face (matches 3D toy smile & ^ ^ eyes without muddy rings!)
  const eyeY = topY + radius * 0.22;
  const eyeSpacing = radius * 0.42;
  const faceInk = '#0f172a';
  const strokeEyeW = Math.max(1.3, radius * 0.17);

  if (eyes === 'squish' || dead) {
    ctx.strokeStyle = faceInk;
    ctx.lineWidth = strokeEyeW;
    ctx.lineCap = 'round';
    const xs = Math.max(2, radius * 0.16);
    [-eyeSpacing, eyeSpacing].forEach((ex) => {
      ctx.beginPath();
      ctx.moveTo(ex - xs, eyeY - xs);
      ctx.lineTo(ex + xs, eyeY + xs);
      ctx.moveTo(ex + xs, eyeY - xs);
      ctx.lineTo(ex - xs, eyeY + xs);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(-radius * 0.24, eyeY + radius * 0.38);
    ctx.quadraticCurveTo(-radius * 0.08, eyeY + radius * 0.26, 0, eyeY + radius * 0.38);
    ctx.quadraticCurveTo(radius * 0.08, eyeY + radius * 0.5, radius * 0.24, eyeY + radius * 0.38);
    ctx.stroke();
  } else {
    // Cute curved happy ^ ^ eyes by default, or glossy bright ovals on intense alert states
    const useBrightOvals = eyes === 'alert' || eyes === 'bright' || eyes === 'angry';
    [-eyeSpacing, eyeSpacing].forEach((ex, idx) => {
      if (eyes === 'wink' && idx === 1) {
        ctx.strokeStyle = faceInk;
        ctx.lineWidth = strokeEyeW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(ex, eyeY + radius * 0.06, radius * 0.18, 0.15, Math.PI - 0.15);
        ctx.stroke();
      } else if (!useBrightOvals) {
        // Cheerful thick arched eyes (^ ^) just like the 3D vinyl Bean render
        ctx.strokeStyle = faceInk;
        ctx.lineWidth = Math.max(1.5, radius * 0.19);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(ex, eyeY + radius * 0.12, radius * 0.2, Math.PI * 1.12, Math.PI * 1.88, false);
        ctx.stroke();
      } else {
        // Sleek glossy dark ovals with tiny specular dot (never thick white-ringed mud!)
        ctx.fillStyle = faceInk;
        ctx.beginPath();
        ctx.ellipse(ex + radius * 0.03, eyeY, radius * 0.15, radius * 0.22, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - radius * 0.02, eyeY - radius * 0.08, Math.max(0.8, radius * 0.07), 0, TAU);
        ctx.fill();
      }
    });

    // Wide open cheerful D-mouth with soft coral-pink tongue
    const mouthY = eyeY + radius * 0.28;
    const mouthR = radius * 0.28;
    ctx.fillStyle = faceInk;
    ctx.beginPath();
    ctx.arc(0, mouthY, mouthR, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();

    // Smooth curved tongue pill at bottom of smile
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.ellipse(0, mouthY + mouthR * 0.56, mouthR * 0.52, mouthR * 0.34, 0, 0, TAU);
    ctx.fill();
  }

  // 7. Hats & Accessories (clean 3D vinyl/metallic gradients & subtle tinted strokes)
  const hatLw = toyLineW(size, 0.032, 0.7, 1.5);
  if (hat === 'crown') {
    const cy = topY - radius * 0.82;
    const crR = radius * 0.52;
    const cg = ctx.createLinearGradient(-crR, cy - radius * 0.65, crR, cy + 4);
    cg.addColorStop(0, '#fff3b0');
    cg.addColorStop(0.45, '#ffd166');
    cg.addColorStop(1, '#d97706');
    ctx.fillStyle = cg;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = hatLw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-crR, cy + radius * 0.18);
    ctx.quadraticCurveTo(0, cy + radius * 0.28, crR, cy + radius * 0.18);
    ctx.lineTo(crR * 1.05, cy - radius * 0.38);
    ctx.lineTo(crR * 0.45, cy - radius * 0.12);
    ctx.lineTo(0, cy - radius * 0.55);
    ctx.lineTo(-crR * 0.45, cy - radius * 0.12);
    ctx.lineTo(-crR * 1.05, cy - radius * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Jewel accent
    if (size >= 18) {
      ctx.fillStyle = '#ff3b6b';
      ctx.beginPath();
      ctx.arc(0, cy - radius * 0.1, Math.max(1.2, radius * 0.1), 0, TAU);
      ctx.fill();
    }
  } else if (hat === 'tophat') {
    const cy = topY - radius * 0.76;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = hatLw;
    ctx.beginPath();
    ctx.ellipse(0, cy + 1, radius * 0.85, radius * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    const tg = ctx.createLinearGradient(-radius * 0.5, cy, radius * 0.5, cy);
    tg.addColorStop(0, '#334155');
    tg.addColorStop(0.4, '#475569');
    tg.addColorStop(1, '#0f172a');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.roundRect(-radius * 0.5, cy - radius * 0.9, radius, radius * 0.9, [radius * 0.12, radius * 0.12, 0, 0]);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff3366';
    ctx.fillRect(-radius * 0.5, cy - radius * 0.24, radius, radius * 0.22);
  } else if (hat === 'astro') {
    ctx.fillStyle = 'rgba(186, 230, 253, 0.26)';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = hatLw;
    ctx.beginPath();
    ctx.arc(0, topY - radius * 0.08, radius * 1.32, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.58, topY - radius * 0.68, radius * 0.42, radius * 0.14, -0.65, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(0, topY + radius * 1.0, radius * 0.88, radius * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (hat === 'viking') {
    const cy = topY - radius * 0.56;
    const vg = ctx.createLinearGradient(0, cy - radius * 0.6, 0, cy);
    vg.addColorStop(0, '#e2e8f0');
    vg.addColorStop(1, '#64748b');
    ctx.fillStyle = vg;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = hatLw;
    ctx.beginPath();
    ctx.arc(0, cy, radius * 0.72, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#b45309';
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(side * radius * 0.58, cy - 2);
      ctx.quadraticCurveTo(side * radius * 1.15, cy - radius * 0.4, side * radius * 0.9, cy - radius * 0.95);
      ctx.quadraticCurveTo(side * radius * 0.78, cy - radius * 0.3, side * radius * 0.36, cy - radius * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  } else if (hat === 'chef') {
    const cy = topY - radius * 0.68;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = hatLw;
    ctx.beginPath();
    ctx.arc(0, cy - radius * 0.56, radius * 0.48, 0, TAU);
    ctx.arc(-radius * 0.38, cy - radius * 0.32, radius * 0.4, 0, TAU);
    ctx.arc(radius * 0.38, cy - radius * 0.32, radius * 0.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-radius * 0.52, cy - radius * 0.14, radius * 1.04, radius * 0.28);
    ctx.strokeRect(-radius * 0.52, cy - radius * 0.14, radius * 1.04, radius * 0.28);
  } else if (hat === 'ninja') {
    const cy = topY - radius * 0.16;
    ctx.fillStyle = '#ff2a5f';
    ctx.strokeStyle = '#881337';
    ctx.lineWidth = hatLw;
    ctx.beginPath();
    ctx.ellipse(0, cy, radius * 0.76, radius * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-radius * 0.24, cy - radius * 0.12, radius * 0.48, radius * 0.24);
    ctx.strokeRect(-radius * 0.24, cy - radius * 0.12, radius * 0.48, radius * 0.24);

    ctx.fillStyle = '#ff2a5f';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.68, cy);
    ctx.quadraticCurveTo(-radius * 1.12, cy - 6, -radius * 1.35, cy - 1);
    ctx.lineTo(-radius * 1.24, cy + 6);
    ctx.quadraticCurveTo(-radius * 0.96, cy + 3, -radius * 0.64, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (hat === 'party') {
    const cy = topY - radius * 0.68;
    const pg = ctx.createLinearGradient(0, cy - radius * 1.15, 0, cy);
    pg.addColorStop(0, '#e879f9');
    pg.addColorStop(1, '#7e22ce');
    ctx.fillStyle = pg;
    ctx.strokeStyle = '#581c87';
    ctx.lineWidth = hatLw;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.44, cy + 3);
    ctx.lineTo(0, cy - radius * 1.15);
    ctx.lineTo(radius * 0.44, cy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, cy - radius * 1.18, radius * 0.17, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (hat === 'scuba') {
    ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = hatLw;
    ctx.beginPath();
    ctx.arc(0, topY + radius * 0.04, radius * 1.28, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.58, topY - radius * 0.56, radius * 0.4, radius * 0.14, -0.65, 0, TAU);
    ctx.fill();

    // Cute rounded yellow scuba air tank on back
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#92400e';
    ctx.beginPath();
    ctx.roundRect(-radius * 1.15, topY - radius * 0.1, radius * 0.34, radius * 1.12, radius * 0.16);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore(); // restore body transform
  ctx.restore(); // restore root transform
}

export { drawToyShadow };
