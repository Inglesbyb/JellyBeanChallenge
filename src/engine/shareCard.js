// High-Res Shareable Run Poster Generator (TICKET-05)
// Generates an 800x1060 portrait arcade card and handles Web Share API + PNG download.

import { store, getRankTier, DAILY_MEDALS } from './store.js';
import { drawBean } from './bean.js';

const W = 800;
const H = 1060;

export function renderSharePoster(canvas, opts = {}) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const prof = store.profile;
  const stats = store.stats;
  const daily = store.daily;
  const rank = getRankTier(stats.lifetimeScore || 0);

  const {
    type = 'standard', // 'standard' | 'daily' | 'profile'
    score = store.meta.global || stats.highestRunScore || 0,
    cycle = store.meta.cycle || stats.maxCycle || 1,
    dailyMedal = null,
    games = [], // array of { icon, title, state }
  } = opts;

  // 1. Deep Cybernetic Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a091a');
  bg.addColorStop(0.45, '#12102e');
  bg.addColorStop(0.85, '#070b18');
  bg.addColorStop(1, '#04040a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 2. Ambient Neon Glows
  const drawGlow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  drawGlow(W * 0.2, H * 0.18, 320, 'rgba(124, 92, 255, 0.22)');
  drawGlow(W * 0.8, H * 0.35, 300, 'rgba(37, 230, 255, 0.2)');
  drawGlow(W * 0.5, H * 0.65, 340, 'rgba(255, 209, 102, 0.14)');
  drawGlow(W * 0.85, H * 0.85, 280, 'rgba(255, 42, 95, 0.18)');

  // 3. Futuristic Grid Pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x < W; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // 4. Double Cyber Border with Corner Accents
  ctx.strokeStyle = 'rgba(37, 230, 255, 0.6)';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  ctx.strokeStyle = 'rgba(255, 209, 102, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, W - 52, H - 52);

  // Corner brackets
  ctx.fillStyle = '#ffd166';
  const cornerSize = 18;
  const corners = [
    [18, 18], [W - 18 - cornerSize, 18],
    [18, H - 18 - cornerSize], [W - 18 - cornerSize, H - 18 - cornerSize],
  ];
  corners.forEach(([cx, cy]) => {
    ctx.fillRect(cx, cy, cornerSize, cornerSize);
  });

  // 5. Header Branding
  ctx.textAlign = 'center';
  ctx.font = '900 16px "Outfit", sans-serif';
  ctx.fillStyle = '#25e6ff';
  ctx.letterSpacing = '5px';
  ctx.fillText('★ 60-SECOND SURVIVAL ARCADE GAUNTLET ★', W / 2, 70);

  // Game Logo Title
  ctx.font = '900 46px "Outfit", sans-serif';
  const titleGrad = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
  titleGrad.addColorStop(0, '#ffffff');
  titleGrad.addColorStop(0.35, '#25e6ff');
  titleGrad.addColorStop(0.7, '#ffd166');
  titleGrad.addColorStop(1, '#ff2a5f');
  ctx.fillStyle = titleGrad;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 4;
  ctx.fillText('JELLY BEAN: 60s', W / 2, 122);
  ctx.shadowBlur = 0;

  // 6. Player Identity Strip (Callsign + Rank Chip)
  const idY = 175;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(W / 2 - 260, idY - 26, 520, 52, 26);
  ctx.fill();
  ctx.stroke();

  // Avatar + Name
  ctx.textAlign = 'left';
  ctx.font = '28px sans-serif';
  ctx.fillText(prof.avatar, W / 2 - 240, idY + 9);

  ctx.font = '800 22px "Outfit", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(prof.name, W / 2 - 195, idY + 8);

  // Rank Pill
  ctx.fillStyle = 'rgba(37, 230, 255, 0.18)';
  ctx.strokeStyle = 'rgba(37, 230, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(W / 2 + 50, idY - 18, 190, 36, 18);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '800 15px "Outfit", sans-serif';
  ctx.fillStyle = '#25e6ff';
  ctx.fillText(`${rank.icon} ${rank.title}`, W / 2 + 145, idY + 6);

  // 7. Mascot Center Stage with Floor Pedestal
  const stageY = 370;
  // Glowing stage ellipse
  const pedGrad = ctx.createRadialGradient(W / 2, stageY + 70, 10, W / 2, stageY + 70, 160);
  pedGrad.addColorStop(0, 'rgba(37, 230, 255, 0.6)');
  pedGrad.addColorStop(0.6, 'rgba(124, 92, 255, 0.3)');
  pedGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = pedGrad;
  ctx.beginPath();
  ctx.ellipse(W / 2, stageY + 70, 170, 40, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw Captain Bean wearing equipped skin and hat!
  drawBean(ctx, W / 2, stageY, 70, {
    eyes: 'happy',
    squash: 1.02,
    walkT: 0.2,
  });

  // Mascot caption / title
  ctx.textAlign = 'center';
  ctx.font = '800 15px "Outfit", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  const skinObj = store.closet;
  ctx.fillText(`CAPTAIN BEAN · ${skinObj.skinId.toUpperCase()}`, W / 2, stageY + 115);

  // 8. Main Score & Achievement Banner
  const scoreCardY = 560;
  ctx.fillStyle = 'rgba(13, 14, 28, 0.85)';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(65, scoreCardY - 45, W - 130, 180, 24);
  ctx.fill();
  ctx.stroke();

  // Subtle inner border
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(70, scoreCardY - 40, W - 140, 170, 20);
  ctx.stroke();

  // Card Eyebrow
  ctx.font = '900 16px "Outfit", sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(type === 'daily' ? '📅 DAILY CHALLENGE SEED' : '⚔️ ARCADE GAUNTLET RUN', W / 2, scoreCardY - 12);

  // Score digits
  ctx.font = '900 76px "Outfit", sans-serif';
  const scoreGrad = ctx.createLinearGradient(0, scoreCardY + 10, 0, scoreCardY + 80);
  scoreGrad.addColorStop(0, '#ffffff');
  scoreGrad.addColorStop(0.5, '#ffd166');
  scoreGrad.addColorStop(1, '#ff9f1c');
  ctx.fillStyle = scoreGrad;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 20;
  ctx.fillText(`${score.toLocaleString()} PTS`, W / 2, scoreCardY + 68);
  ctx.shadowBlur = 0;

  // Subtitle / Milestone banner
  ctx.font = '800 20px "Outfit", sans-serif';
  if (type === 'daily') {
    const medalObj = dailyMedal || DAILY_MEDALS.find((m) => score >= m.minScore);
    ctx.fillStyle = '#25e6ff';
    ctx.fillText(medalObj ? `${medalObj.icon} ${medalObj.name.toUpperCase()} AWARDED · STREAK 🔥 ${daily.streak || 1} DAYS` : 'CHALLENGER COMPLETED', W / 2, scoreCardY + 112);
  } else {
    ctx.fillStyle = '#25e6ff';
    ctx.fillText(`🔁 CYCLE ${cycle} SURVIVED · 20 MINI-GAMES ROTATION`, W / 2, scoreCardY + 112);
  }

  // 9. 3-Stat Metrics Row
  const metricsY = 770;
  const metrics = [
    { num: (stats.timersSurvived || 0).toLocaleString(), lbl: '60s SURVIVED ⏱️' },
    { num: (stats.stagesCleared || 0).toLocaleString(), lbl: 'STAGES CLEARED ⭐' },
    { num: `🔥 ${daily.streak || 0}`, lbl: 'DAILY STREAK' },
  ];

  const colW = (W - 130 - 30) / 3;
  metrics.forEach((m, idx) => {
    const mx = 65 + idx * (colW + 15);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(mx, metricsY, colW, 80, 16);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '900 26px "Outfit", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(m.num, mx + colW / 2, metricsY + 40);

    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(m.lbl, mx + colW / 2, metricsY + 65);
  });

  // 10. Games Chips Row (Visual Proof)
  const chipsY = 905;
  ctx.font = '800 13px "Outfit", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillText('BATTLE ROSTER SURVIVED', W / 2, chipsY - 12);

  const displayGames = games.length > 0 ? games.slice(0, 10) : [
    { icon: '🌀' }, { icon: '🍬' }, { icon: '🏰' }, { icon: '⚓' }, { icon: '🍉' },
    { icon: '⛏' }, { icon: '🦘' }, { icon: '👑' }, { icon: '🧱' }, { icon: '🐔' },
  ];

  const chipSize = 44;
  const chipGap = 12;
  const totalChipsW = displayGames.length * chipSize + (displayGames.length - 1) * chipGap;
  const chipStartX = (W - totalChipsW) / 2;

  displayGames.forEach((g, i) => {
    const cx = chipStartX + i * (chipSize + chipGap);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx, chipsY, chipSize, chipSize, 12);
    ctx.fill();
    ctx.stroke();

    ctx.font = '22px sans-serif';
    ctx.fillText(g.icon, cx + chipSize / 2, chipsY + 31);
  });

  // 11. Footer Watermark & Challenge CTA
  const footY = 1010;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(26, footY - 26, W - 52, 52);

  ctx.font = '800 17px "Outfit", sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('CAN YOU BEAT MY SCORE? ⚔️', W / 2, footY);

  ctx.font = '600 13px "Outfit", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('Play Free on Android & Web · Jelly Bean: 60s Challenge', W / 2, footY + 22);
}

export async function shareCardFile(canvas, { title, text, filename = 'jelly-bean-record.png' }) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve({ success: false, method: 'error' });
        return;
      }

      const file = new File([blob], filename, { type: 'image/png' });

      // 1. Try Native Web Share API with image file attachment
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title,
            text,
            files: [file],
          });
          resolve({ success: true, method: 'share' });
          return;
        } catch (err) {
          if (err.name === 'AbortError') {
            resolve({ success: false, method: 'cancelled' });
            return;
          }
          console.warn('Native Web Share with file failed, falling back:', err);
        }
      }

      // 2. Try Web Share API with text/url only
      if (navigator.share) {
        try {
          await navigator.share({
            title,
            text: `${text}\nPlay: ${window.location.origin}`,
          });
          // Also trigger download of the image
          downloadBlob(blob, filename);
          resolve({ success: true, method: 'share_download' });
          return;
        } catch (err) {
          if (err.name === 'AbortError') {
            resolve({ success: false, method: 'cancelled' });
            return;
          }
        }
      }

      // 3. Fallback: Instant Direct PNG Download
      downloadBlob(blob, filename);
      resolve({ success: true, method: 'download' });
    }, 'image/png');
  });
}

export function downloadCardPNG(canvas, filename = 'jelly-bean-record.png') {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, 'image/png');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
