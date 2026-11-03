// Master Jellybean Mascot Renderer
// Bloons TD 6 glossy 3D-vector look meets Fall Guys squishy pill character.

import { store, SKINS } from './store.js';

const TAU = Math.PI * 2;

export function drawBean(ctx, x, y, size = 30, opts = {}) {
  const closet = store?.data?.closet || { skinId: 'cyan', hatId: 'none' };
  const currentSkin = SKINS?.find((s) => s.id === closet.skinId) || { color: '#25e6ff', belly: '#1ec0db' };

  const {
    color = currentSkin.color,
    bellyColor = currentSkin.belly,
    dir = 1,
    walkT = 0,
    squash = 1,
    eyes = 'happy',
    hat = (closet.hatId !== 'none' ? closet.hatId : null),
    ufo = false,
    holding = null,
    holdingTierDraw = null,
    dead = false,
  } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  const w = size * 0.75 * (2 - squash);
  const h = size * 1.15 * squash;
  const legSwing = Math.sin(walkT * 12) * (size * 0.25);

  // 1. UFO / Hover-kart (Void Eater mode)
  if (ufo) {
    // Jet glow
    const jg = ctx.createRadialGradient(0, size * 0.7, 2, 0, size * 0.7, size * 0.6);
    jg.addColorStop(0, '#ffe066');
    jg.addColorStop(0.6, 'rgba(255,100,50,0.5)');
    jg.addColorStop(1, 'rgba(255,50,50,0)');
    ctx.fillStyle = jg;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.75, size * 0.7, size * 0.35, 0, 0, TAU);
    ctx.fill();

    // Kart saucer rim
    const kg = ctx.createLinearGradient(-size * 0.9, 0, size * 0.9, 0);
    kg.addColorStop(0, '#4361ee');
    kg.addColorStop(0.5, '#7209b7');
    kg.addColorStop(1, '#f72585');
    ctx.fillStyle = kg;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.45, size * 0.95, size * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Specular shine on saucer
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, size * 0.38, size * 0.45, size * 0.08, -0.15, 0, TAU);
    ctx.fill();

    // Steering wheel
    ctx.fillStyle = '#ffbe0b';
    ctx.beginPath();
    ctx.arc(size * 0.3, size * 0.22, size * 0.16, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }

  // 2. Legs / Feet (if not in UFO)
  if (!ufo) {
    const footR = size * 0.22;
    const footY = h * 0.48;

    // Scuba flippers
    if (hat === 'scuba') {
      ctx.fillStyle = '#ff9f1c';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      // Left flipper
      ctx.beginPath();
      ctx.ellipse(-w * 0.38, footY + legSwing * 0.5, size * 0.38, size * 0.14, -0.4, 0, TAU);
      ctx.fill(); ctx.stroke();
      // Right flipper
      ctx.beginPath();
      ctx.ellipse(w * 0.38, footY - legSwing * 0.5, size * 0.38, size * 0.14, 0.4, 0, TAU);
      ctx.fill(); ctx.stroke();
    } else {
      // Stubby cartoon feet
      ctx.fillStyle = bellyColor || '#1ec0db';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3.2, size * 0.09);

      // Left foot
      ctx.beginPath();
      ctx.ellipse(-w * 0.32, footY + legSwing, footR, footR * 0.7, 0, 0, TAU);
      ctx.fill(); ctx.stroke();

      // Right foot
      ctx.beginPath();
      ctx.ellipse(w * 0.32, footY - legSwing, footR, footR * 0.7, 0, 0, TAU);
      ctx.fill(); ctx.stroke();
    }
  }

  // 3. Pill Body (Capsule)
  const bodyY = ufo ? size * 0.05 : 0;
  const radius = w * 0.52;
  const bodyH = h * 0.85;

  ctx.save();
  ctx.translate(0, bodyY);

  // Body gradient
  const bg = ctx.createLinearGradient(-w * 0.5, -bodyH * 0.5, w * 0.5, bodyH * 0.5);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.18, color);
  bg.addColorStop(0.85, color);
  bg.addColorStop(1, bellyColor || color);

  ctx.fillStyle = bg;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(3.8, size * 0.12);
  ctx.lineJoin = 'round';

  // Rounded capsule path
  ctx.beginPath();
  const topY = -bodyH * 0.5 + radius;
  const botY = bodyH * 0.5 - radius;
  ctx.arc(0, topY, radius, Math.PI, 0, false);
  ctx.arc(0, botY, radius, 0, Math.PI, false);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 4. Bloons Specular Highlight (The famous white crescent shine on head)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.ellipse(-radius * 0.32, topY - radius * 0.3, radius * 0.36, radius * 0.18, -0.45, 0, TAU);
  ctx.fill();

  // Small secondary shine dot
  ctx.beginPath();
  ctx.arc(-radius * 0.55, topY - radius * 0.05, radius * 0.09, 0, TAU);
  ctx.fill();

  // Belly shine
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, botY * 0.3, radius * 0.55, radius * 0.45, 0, 0, TAU);
  ctx.fill();

  // 5. Cartoon Face / Eyes
  const eyeY = topY + radius * 0.32;
  const eyeSpacing = radius * 0.38;

  if (eyes === 'squish' || dead) {
    // Dizzy X eyes
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    [-eyeSpacing, eyeSpacing].forEach((ex) => {
      ctx.beginPath();
      ctx.moveTo(ex - 4, eyeY - 4); ctx.lineTo(ex + 4, eyeY + 4);
      ctx.moveTo(ex + 4, eyeY - 4); ctx.lineTo(ex - 4, eyeY + 4);
      ctx.stroke();
    });
    // Wavy dizzy mouth
    ctx.beginPath();
    ctx.moveTo(-6, eyeY + 12);
    ctx.quadraticCurveTo(-2, eyeY + 8, 0, eyeY + 12);
    ctx.quadraticCurveTo(2, eyeY + 16, 6, eyeY + 12);
    ctx.stroke();
  } else {
    // Expressive cartoon oval eyes
    [-eyeSpacing, eyeSpacing].forEach((ex, idx) => {
      if (eyes === 'wink' && idx === 1) {
        // Wink curve
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(ex, eyeY, 5, 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else {
        // Big white outer eye
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, radius * 0.26, radius * 0.36, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();

        // Dark pupil
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(ex + 1, eyeY + 1, radius * 0.16, radius * 0.24, 0, 0, TAU);
        ctx.fill();

        // Glossy pupil specular shine
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex, eyeY - radius * 0.1, radius * 0.08, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + 2, eyeY + radius * 0.08, radius * 0.04, 0, TAU);
        ctx.fill();
      }
    });

    // Cute smiling mouth
    ctx.fillStyle = '#ff1744';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, eyeY + radius * 0.38, radius * 0.22, 0.1, Math.PI - 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Tongue
    ctx.fillStyle = '#ff85a1';
    ctx.beginPath();
    ctx.arc(0, eyeY + radius * 0.52, radius * 0.12, Math.PI, 0);
    ctx.fill();
  }

  // 6. Stubby Arms
  const armY = topY + radius * 0.8;
  const armLen = radius * 0.55;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(3.2, size * 0.1);

  if (holding) {
    // Both arms raised high holding the fruit
    ctx.beginPath();
    ctx.ellipse(-radius * 0.85, armY - radius * 0.6, armLen, armLen * 0.5, -0.9, 0, TAU);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(radius * 0.85, armY - radius * 0.6, armLen, armLen * 0.5, 0.9, 0, TAU);
    ctx.fill(); ctx.stroke();
  } else {
    // Natural waddling arms
    const armSwing = Math.sin(walkT * 12) * 0.35;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.85, armY, armLen, armLen * 0.5, -0.3 + armSwing, 0, TAU);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(radius * 0.85, armY, armLen, armLen * 0.5, 0.3 - armSwing, 0, TAU);
    ctx.fill(); ctx.stroke();
  }

  // 7. Hats & Accessories
  if (hat === 'crown') {
    const cy = topY - radius * 0.75;
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.45, cy + 4);
    ctx.lineTo(-radius * 0.45, cy - 14);
    ctx.lineTo(-radius * 0.2, cy - 6);
    ctx.lineTo(0, cy - 18);
    ctx.lineTo(radius * 0.2, cy - 6);
    ctx.lineTo(radius * 0.45, cy - 14);
    ctx.lineTo(radius * 0.45, cy + 4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Ruby jewels
    ctx.fillStyle = '#ff0055';
    ctx.beginPath(); ctx.arc(0, cy - 6, 2.8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-radius * 0.3, cy - 3, 2.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(radius * 0.3, cy - 3, 2.2, 0, TAU); ctx.fill();
  } else if (hat === 'tophat') {
    const cy = topY - radius * 0.72;
    // Brim
    ctx.fillStyle = '#181824';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(0, cy + 2, radius * 0.85, radius * 0.22, 0, 0, TAU);
    ctx.fill(); ctx.stroke();

    // Cylinder
    ctx.fillStyle = '#222233';
    ctx.beginPath();
    ctx.rect(-radius * 0.5, cy - radius * 0.95, radius, radius * 0.95);
    ctx.fill(); ctx.stroke();

    // Red ribbon
    ctx.fillStyle = '#ff3366';
    ctx.fillRect(-radius * 0.5, cy - radius * 0.25, radius, radius * 0.25);
    ctx.strokeRect(-radius * 0.5, cy - radius * 0.25, radius, radius * 0.25);

    // Sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(-radius * 0.4, cy - radius * 0.9, radius * 0.2, radius * 0.65);
  } else if (hat === 'astro') {
    // Glass bubble space helmet
    ctx.fillStyle = 'rgba(180, 240, 255, 0.32)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, topY - radius * 0.1, radius * 1.35, 0, TAU);
    ctx.fill(); ctx.stroke();

    // Reflection shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.65, topY - radius * 0.7, radius * 0.45, radius * 0.16, -0.65, 0, TAU);
    ctx.fill();

    // Collar
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.ellipse(0, topY + radius * 1.05, radius * 0.9, radius * 0.25, 0, 0, TAU);
    ctx.fill(); ctx.stroke();
  } else if (hat === 'viking') {
    const cy = topY - radius * 0.55;
    // Iron Cap
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, cy, radius * 0.68, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Horns
    ctx.fillStyle = '#fef08a';
    // Left horn
    ctx.beginPath();
    ctx.moveTo(-radius * 0.55, cy - 2);
    ctx.quadraticCurveTo(-radius * 1.15, cy - radius * 0.4, -radius * 0.9, cy - radius * 0.95);
    ctx.quadraticCurveTo(-radius * 0.8, cy - radius * 0.3, -radius * 0.35, cy - radius * 0.3);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Right horn
    ctx.beginPath();
    ctx.moveTo(radius * 0.55, cy - 2);
    ctx.quadraticCurveTo(radius * 1.15, cy - radius * 0.4, radius * 0.9, cy - radius * 0.95);
    ctx.quadraticCurveTo(radius * 0.8, cy - radius * 0.3, radius * 0.35, cy - radius * 0.3);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (hat === 'chef') {
    const cy = topY - radius * 0.65;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.2;

    // Puffy top
    ctx.beginPath();
    ctx.arc(0, cy - radius * 0.6, radius * 0.5, 0, TAU);
    ctx.arc(-radius * 0.4, cy - radius * 0.35, radius * 0.42, 0, TAU);
    ctx.arc(radius * 0.4, cy - radius * 0.35, radius * 0.42, 0, TAU);
    ctx.fill(); ctx.stroke();

    // Band
    ctx.fillRect(-radius * 0.55, cy - radius * 0.15, radius * 1.1, radius * 0.3);
    ctx.strokeRect(-radius * 0.55, cy - radius * 0.15, radius * 1.1, radius * 0.3);
  } else if (hat === 'ninja') {
    const cy = topY - radius * 0.1;
    // Headband
    ctx.fillStyle = '#ff2a5f';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(0, cy, radius * 0.72, radius * 0.22, 0, 0, TAU);
    ctx.fill(); ctx.stroke();

    // Silver symbol plate
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.rect(-radius * 0.25, cy - radius * 0.16, radius * 0.5, radius * 0.28);
    ctx.fill(); ctx.stroke();

    // Trailing ribbons behind head
    ctx.fillStyle = '#ff2a5f';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.65, cy);
    ctx.quadraticCurveTo(-radius * 1.1, cy - 8, -radius * 1.35, cy - 2);
    ctx.lineTo(-radius * 1.25, cy + 8);
    ctx.quadraticCurveTo(-radius * 0.95, cy + 4, -radius * 0.6, cy + 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (hat === 'party') {
    const cy = topY - radius * 0.65;
    // Cone
    ctx.fillStyle = '#a855f7';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.45, cy + 4);
    ctx.lineTo(0, cy - radius * 1.2);
    ctx.lineTo(radius * 0.45, cy + 4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Confetti spots
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(-radius * 0.1, cy - radius * 0.3, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(radius * 0.15, cy - radius * 0.65, 3, 0, TAU); ctx.fill();

    // Pom pom
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, cy - radius * 1.22, radius * 0.18, 0, TAU);
    ctx.fill(); ctx.stroke();
  } else if (hat === 'scuba') {
    // Glass bubble scuba dome
    ctx.fillStyle = 'rgba(180, 240, 255, 0.28)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, topY, radius * 1.35, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Glass reflection curve
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.65, topY - radius * 0.65, radius * 0.45, radius * 0.16, -0.65, 0, TAU);
    ctx.fill();

    // Air hose & tank backpack
    ctx.fillStyle = '#ffbe0b';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.2;
    ctx.fillRect(-radius * 1.25, topY - radius * 0.2, radius * 0.35, radius * 1.2);
    ctx.strokeRect(-radius * 1.25, topY - radius * 0.2, radius * 0.35, radius * 1.2);
  }

  ctx.restore(); // restore body transform
  ctx.restore(); // restore root transform
}
