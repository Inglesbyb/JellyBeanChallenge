import { sounds } from '../audio.js';
import { haptics } from '../haptics.js';
import { store, getRankTier, RANKS, SKINS, HATS, DAILY_MEDALS, getDailyMedal, getUtcDayKey, getDailyGameIndices } from './store.js';
import { drawBean } from './bean.js';
import { renderSharePoster, shareCardFile, downloadCardPNG } from './shareCard.js';
import { setupNativeAndroidBridge } from './nativeAndroid.js';
import { Input } from './input.js';
import { VoidEater } from '../games/voidEater.js';
import { DeepFeeder } from '../games/deepFeeder.js';
import { TowerSlice } from '../games/towerSlice.js';
import { MultiplierRunner } from '../games/multiplierRunner.js';
import { FruitMerge } from '../games/fruitMerge.js';
import { Motherload } from '../games/motherload.js';
import { DoodleJump } from '../games/doodleJump.js';
import { PaperIo } from '../games/paperIo.js';
import { BlockBuster } from '../games/blockBuster.js';
import { CrossyRoad } from '../games/crossyRoad.js';
import { ZombieFortress } from '../games/zombieFortress.js';
import { SubwaySurfers } from '../games/subwaySurfers.js';
import { SaveTheBean } from '../games/saveTheBean.js';
import { BeanTD } from '../games/beanTD.js';
import { ColorClash } from '../games/colorClash.js';
import { BallBlast } from '../games/ballBlast.js';
import { SledSurfers } from '../games/sledSurfers.js';
import { AgeOfBeans } from '../games/ageOfBeans.js';
import { BeanSurvivors } from '../games/beanSurvivors.js';
import { BeanHelix } from '../games/beanHelix.js';

export const W = 450;
export const H = 800;

const GAMES = [VoidEater, DeepFeeder, TowerSlice, MultiplierRunner, FruitMerge, Motherload, DoodleJump, PaperIo, BlockBuster, CrossyRoad, ZombieFortress, SubwaySurfers, SaveTheBean, BeanTD, ColorClash, BallBlast, SledSurfers, AgeOfBeans, BeanSurvivors, BeanHelix];

// Games that can be COMPLETED (growth caps / finite win states). Completing one keeps it in
// the rotation but restarts it fresh at the next prestige rank with tougher settings.
// Everything NOT listed here (motherload, crossy-road, subway-surfers, doodle-jump,
// sled-surfers, zombie-fortress, ...) stays continuous: no completion resets, ever.
const PRESTIGE_IDS = new Set([
  'void-eater',
  'deep-feeder',
  'fruit-merge',
  'paper-turf',
  'multiplier-runner',
  'age-of-beans',
  'bean-td',
  'tower-slice',
  'bean-survivors',
  'bean-helix',
]);

// Any game class defining `static meta = { isPrestige: true, ... }` is automatically
// recognized by the engine playbook, with backward-compatibility for PRESTIGE_IDS.
export const isPrestigeGame = (gameClassOrId) => {
  if (!gameClassOrId) return false;
  if (typeof gameClassOrId === 'string') {
    const G = GAMES.find((g) => g.meta?.id === gameClassOrId);
    return Boolean(G?.meta?.isPrestige || PRESTIGE_IDS.has(gameClassOrId));
  }
  return Boolean(gameClassOrId?.meta?.isPrestige || PRESTIGE_IDS.has(gameClassOrId?.meta?.id));
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const roman = (n) => ROMAN[n] || String(n);
const $ = (s) => document.querySelector(s);

export class Reel {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.roundLen = Number(params.get('t')) || 60;

    this.stage = $('#stage');
    this.canvas = $('#game');
    this.snap = $('#snap');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    for (const c of [this.canvas, this.snap]) {
      c.width = Math.round(W * this.dpr);
      c.height = Math.round(H * this.dpr);
    }
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.input = new Input(this.canvas, W, H);
    this.env = { input: this.input, sounds, haptics };

    this.mode = 'menu'; // menu | playing | secured | dying | transition | summary
    this.game = null;
    this.index = 0;
    this.holdT = 0;
    this.transT = 0;
    this.timeLeft = this.roundLen;
    this.roundStartScore = 0;
    this.restored = false;
    this.lastSecs = -1;
    this.lastScoreShown = -1;
    this.hintTimer = null;
    this.welcomeTimer = null;

    // Mascot Closet (TICKET-03)
    this.closetTab = 'skins';
    this.closetPreviewAnim = null;
    this.closetWalkT = 0;

    // Daily Challenge (TICKET-04)
    this.runType = 'standard'; // 'standard' | 'daily'
    this.dailyIndices = [];
    this.dailyStageIndex = 0;
    this.dailyResults = [];
    this.menuMode = 'standard';
    this.dailyTimerInterval = null;

    // Share Card (TICKET-05)
    this.currentShareOpts = null;
    this.shareToastTimer = null;

    this.bindUI();
    this.buildMenuIcons();
    this.buildPips();
    this.renderProfileUI();
    this.renderDailyMenuUI();
    setupNativeAndroidBridge(this);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    // Direct game launch via URL query parameter (e.g. ?game=subway-surfers or ?g=12)
    const targetGame = params.get('game') || params.get('g');
    if (targetGame) {
      const idx = GAMES.findIndex((g, i) => g.meta.id === targetGame || String(i + 1) === targetGame || String(i) === targetGame);
      if (idx !== -1) {
        if (store.data.meta.eliminated) {
          delete store.data.meta.eliminated[GAMES[idx].meta.id];
          store.save();
        }
        setTimeout(() => this.jumpToGame(idx), 50);
      }
    }
  }

  isGameAlive(i) {
    if (i < 0 || i >= GAMES.length) return false;
    const id = GAMES[i].meta.id;
    return !store.isEliminated(id);
  }

  getAliveIndices() {
    const list = [];
    for (let i = 0; i < GAMES.length; i++) {
      if (this.isGameAlive(i)) list.push(i);
    }
    return list;
  }

  /* ---------------------------------------------------------- UI setup */
  bindUI() {
    $('#btnPlay').onclick = () => this.startRun(false);
    $('#btnContinue').onclick = () => this.startRun(true);
    $('#btnNew').onclick = () => this.startRun(false);
    $('#btnNext').onclick = () => this.nextCycle();

    if (store.hasSession()) {
      $('#btnPlay').classList.add('hidden');
      $('#btnContinue').classList.remove('hidden');
      $('#btnNew').classList.remove('hidden');
      $('#btnContinue').style.animation = 'btnpulse 1.8s ease-in-out infinite';
    }

    $('#btnMute').onclick = () => {
      sounds.setMuted(!sounds.muted);
      $('#muteIco').textContent = sounds.muted ? '🔇' : '🔊';
      if (!sounds.muted) sounds.like();
    };
    $('#muteIco').textContent = sounds.muted ? '🔇' : '🔊';

    // Pause button in HUD
    $('#btnPause').onclick = () => {
      if (this.mode === 'playing') {
        this.pause();
      } else if (this.mode === 'paused') {
        this.resume();
      }
    };

    // Menu Settings button
    $('#btnMenuSettings').onclick = () => this.openSettings(true);

    // Modal controls
    $('#btnSettingsClose').onclick = () => this.closeSettings();
    $('#btnResume').onclick = () => this.resume();
    $('#btnAbandon').onclick = () => this.abandonRun();

    // Settings inputs
    const volInput = $('#settingVolume');
    const volVal = $('#settingVolumeVal');
    const hapticsInput = $('#settingHaptics');
    const shakeInput = $('#settingShake');

    const s = store.settings;
    volInput.value = Math.round((s.sfxVolume ?? 0.8) * 100);
    volVal.textContent = `${volInput.value}%`;
    hapticsInput.checked = s.hapticsEnabled !== false;
    shakeInput.checked = s.screenShakeEnabled !== false;
    sounds.setVolume(s.sfxVolume ?? 0.8);
    haptics.setEnabled(s.hapticsEnabled !== false);

    volInput.oninput = (e) => {
      const v = Number(e.target.value);
      volVal.textContent = `${v}%`;
      const scaled = v / 100;
      store.updateSettings({ sfxVolume: scaled });
      sounds.setVolume(scaled);
    };
    volInput.onchange = () => {
      sounds.bubble();
    };

    hapticsInput.onchange = (e) => {
      const enabled = e.target.checked;
      store.updateSettings({ hapticsEnabled: enabled });
      haptics.setEnabled(enabled);
      if (enabled) haptics.light();
    };

    shakeInput.onchange = (e) => {
      const enabled = e.target.checked;
      store.updateSettings({ screenShakeEnabled: enabled });
      if (enabled) {
        sounds.hit();
        haptics.medium();
      }
    };

    // Profile modal controls
    $('#btnOpenProfile').onclick = () => this.openProfile();
    $('#btnProfileClose').onclick = () => this.closeProfile();
    $('#btnProfileDone').onclick = () => this.closeProfile();

    // Mode switcher (TICKET-04)
    const tabStd = $('#tabModeStandard');
    if (tabStd) tabStd.onclick = () => this.setMenuMode('standard');
    const tabDly = $('#tabModeDaily');
    if (tabDly) tabDly.onclick = () => this.setMenuMode('daily');
    const btnDly = $('#btnStartDaily');
    if (btnDly) btnDly.onclick = () => this.startDailyRun();
    const btnDlyDone = $('#btnDailyDone');
    if (btnDlyDone) btnDlyDone.onclick = () => this.closeDailySummary();

    // Mascot Closet modal controls (TICKET-03)
    $('#btnOpenCloset').onclick = () => this.openCloset();
    const btnProfCloset = $('#btnProfileOpenCloset');
    if (btnProfCloset) {
      btnProfCloset.onclick = () => {
        this.closeProfile();
        this.openCloset();
      };
    }
    $('#btnClosetClose').onclick = () => this.closeCloset();
    $('#btnClosetDone').onclick = () => this.closeCloset();
    $('#tabSkins').onclick = () => this.setClosetTab('skins');
    $('#tabHats').onclick = () => this.setClosetTab('hats');

    // Share Card controls (TICKET-05)
    const btnShareRun = $('#btnShareRun');
    if (btnShareRun) {
      btnShareRun.onclick = () => {
        this.openShareModal({
          type: 'standard',
          score: store.meta.global,
          cycle: store.meta.cycle,
          games: GAMES.map((g) => ({
            icon: g.meta.icon,
            title: g.meta.title,
            state: store.isEliminated(g.meta.id) ? 'eliminated' : 'alive',
          })),
        });
      };
    }
    const btnShareDaily = $('#btnShareDaily');
    if (btnShareDaily) {
      btnShareDaily.onclick = () => {
        const medal = getDailyMedal(store.meta.global);
        this.openShareModal({
          type: 'daily',
          score: store.meta.global,
          dailyMedal: medal,
          games: this.dailyIndices.map((idx, i) => ({
            icon: GAMES[idx].meta.icon,
            title: GAMES[idx].meta.title,
            state: this.dailyResults[i] || 'survived',
          })),
        });
      };
    }
    const btnShareProfile = $('#btnShareProfile');
    if (btnShareProfile) {
      btnShareProfile.onclick = () => {
        this.openShareModal({
          type: 'profile',
          score: store.stats.highestRunScore || store.stats.lifetimeScore || 0,
          cycle: store.stats.maxCycle || 1,
        });
      };
    }
    const btnShareClose = $('#btnShareClose');
    if (btnShareClose) btnShareClose.onclick = () => this.closeShareModal();
    const btnWebShare = $('#btnWebShare');
    if (btnWebShare) btnWebShare.onclick = () => this.executeShare();
    const btnDownloadCard = $('#btnDownloadCard');
    if (btnDownloadCard) btnDownloadCard.onclick = () => this.executeDownload();

    // Avatar options
    document.querySelectorAll('.avatar-opt').forEach((btn) => {
      btn.onclick = () => {
        const av = btn.dataset.av;
        if (!av) return;
        store.updateProfile({ avatar: av });
        this.renderProfileUI();
        sounds.pop();
        haptics.light();
      };
    });

    // Save Callsign
    const nameInput = $('#profileNameInput');
    const saveName = () => {
      const val = nameInput.value.trim();
      if (!val) return;
      store.updateProfile({ name: val });
      this.renderProfileUI();
      sounds.like();
      haptics.medium();
      const btn = $('#btnSaveName');
      btn.textContent = 'SAVED ✓';
      setTimeout(() => { btn.textContent = 'SAVE'; }, 1400);
    };
    $('#btnSaveName').onclick = saveName;
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveName();
    });

    $('#btnLike').onclick = () => {
      if (!this.game) return;
      const id = GAMES[this.index].meta.id;
      const liked = store.toggleLike(id);
      this.refreshLike();
      if (liked) {
        sounds.like();
        haptics.light();
      }
    };

    // Keyboard shortcuts: 1..9, 0 to jump immediately to any game for testing
    // Note: When Motherload or Age of Beans is active (which use keys 1..3 for units/items),
    // require Shift+1..0 or clicking the top pips to jump, preventing key conflicts.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.mode === 'paused') {
          this.resume();
          return;
        } else if (this.mode === 'playing') {
          this.pause();
          return;
        } else if (!$('#settingsModal').classList.contains('hidden')) {
          this.closeSettings();
          return;
        } else if (!$('#closetModal').classList.contains('hidden')) {
          this.closeCloset();
          return;
        } else if (!$('#dailySummaryModal').classList.contains('hidden')) {
          this.closeDailySummary();
          return;
        } else if (!$('#profileModal').classList.contains('hidden')) {
          this.closeProfile();
          return;
        } else if (!$('#shareModal').classList.contains('hidden')) {
          this.closeShareModal();
          return;
        }
      }

      if (this.mode === 'paused') return; // Ignore debug jump keys when paused

      const gameId = this.game?.constructor?.meta?.id || this.game?.meta?.id;
      if (this.game && (gameId === 'motherload' || gameId === 'age-of-beans') && !e.shiftKey) {
        return;
      }
      if (e.key === '0' && GAMES.length >= 10) {
        this.jumpToGame(9);
        return;
      }
      if ((e.key === '-' || e.key.toLowerCase() === 'z') && GAMES.length >= 11) {
        this.jumpToGame(10);
        return;
      }
      if ((e.key === '=' || e.key.toLowerCase() === 's') && GAMES.length >= 12) {
        this.jumpToGame(11);
        return;
      }
      if ((e.key === 'b' || e.key.toLowerCase() === 'b') && GAMES.length >= 13) {
        this.jumpToGame(12);
        return;
      }
      if ((e.key === 't' || e.key.toLowerCase() === 't') && GAMES.length >= 14) {
        this.jumpToGame(13);
        return;
      }
      if ((e.key === 'c' || e.key.toLowerCase() === 'c') && GAMES.length >= 15) {
        this.jumpToGame(14);
        return;
      }
      if ((e.key === 'x' || e.key.toLowerCase() === 'x') && GAMES.length >= 16) {
        this.jumpToGame(15);
        return;
      }
      if ((e.key === 'u' || e.key.toLowerCase() === 'u') && GAMES.length >= 17) {
        this.jumpToGame(16);
        return;
      }
      if ((e.key === 'w' || e.key.toLowerCase() === 'w') && GAMES.length >= 18) {
        this.jumpToGame(17);
        return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= GAMES.length) {
        this.jumpToGame(n - 1);
      }
    });
  }

  buildMenuIcons() {
    const mi = $('#menuIcons');
    mi.innerHTML = GAMES.map((g, i) => `<span data-i="${i}" title="Play Game ${i + 1}: ${g.meta.title} (Click or press ${i + 1})">${g.meta.icon}</span>`).join('');
    mi.onclick = (e) => {
      const btn = e.target.closest('[data-i]');
      if (!btn) return;
      const targetIndex = Number(btn.dataset.i);
      if (Number.isNaN(targetIndex)) return;
      store.data.started = true;
      this.jumpToGame(targetIndex);
    };
  }

  buildPips() {
    const pipsEl = $('#pips');
    pipsEl.innerHTML = GAMES.map((g, i) => `<div class="pip" data-i="${i}" title="Game ${i + 1}: ${g.meta.title}">${g.meta.icon}</div>`).join('');
    
    let isDragging = false;
    let hasDragged = false;
    let startX = 0;
    let scrollLeft = 0;

    pipsEl.onclick = (e) => {
      if (hasDragged) {
        hasDragged = false;
        return;
      }
      const pip = e.target.closest('.pip');
      if (!pip) return;
      const targetIndex = Number(pip.dataset.i);
      if (Number.isNaN(targetIndex)) return;

      if (!this.isGameAlive(targetIndex)) {
        this.banner('GAME ELIMINATED! 💀', `${GAMES[targetIndex].meta.title} is excluded from this run`, 'fail');
        sounds.fail();
        haptics.fail();
        return;
      }

      // Strict Gauntlet Flow: jumping ahead is disabled during an active run unless Shift is held for dev testing
      if (this.mode === 'playing' && !e.shiftKey) {
        this.banner('STRICT GAUNTLET ⚔️', 'Survive 60s to advance through the sequence', 'info');
        return;
      }

      this.jumpToGame(targetIndex);
    };

    // Mouse wheel horizontal scrolling
    pipsEl.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        pipsEl.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    // Drag-to-scroll support for mouse/trackpad
    pipsEl.addEventListener('pointerdown', (e) => {
      isDragging = true;
      hasDragged = false;
      startX = e.clientX;
      scrollLeft = pipsEl.scrollLeft;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) hasDragged = true;
      pipsEl.scrollLeft = scrollLeft - dx;
    });

    window.addEventListener('pointerup', () => {
      isDragging = false;
    });
  }

  jumpToGame(i) {
    if (i < 0 || i >= GAMES.length) return;
    if (!this.isGameAlive(i)) {
      this.banner('GAME ELIMINATED! 💀', `${GAMES[i].meta.title} is excluded from this run`, 'fail');
      sounds.fail();
      return;
    }
    sounds.init();

    // Preserve active game's score and serialized state if currently running.
    // A game that just COMPLETED is never re-saved (its frozen maxed-out board is discarded).
    if (this.game) {
      this.bank();
      const currId = GAMES[this.index]?.meta.id;
      if (currId && !(isPrestigeGame(currId) && this.game.won)) {
        store.set(currId, this.game.serialize(), this.game.score);
      }
      this.destroyGame();
    }

    // Dismiss overlays and show HUD
    $('#menu').classList.add('hidden');
    $('#summary').classList.add('hidden');
    $('#hud').classList.remove('hidden');

    this.mode = 'playing';
    this.snap.style.display = 'none';
    this.input.reset();
    this.loadGame(i);
    this.banner(`GAME ${i + 1} / ${GAMES.length}`, GAMES[i].meta.title, 'info');
    sounds.whoosh();
    haptics.light();
    store.save();
  }

  renderPips() {
    if (this.runType === 'daily') {
      document.querySelectorAll('.pip').forEach((el, i) => {
        el.className = 'pip';
        if (this.dailyResults[i] === 'eliminated') {
          el.classList.add('eliminated');
        } else if (this.dailyResults[i] === 'survived') {
          el.classList.add('survived');
        }
        if (i === this.dailyStageIndex && (this.mode === 'playing' || this.mode === 'transition' || this.mode === 'secured' || this.mode === 'dying')) {
          el.classList.add('current');
          try {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          } catch { /* ignore */ }
        }
      });
      return;
    }

    const res = store.meta.results;
    document.querySelectorAll('.pip').forEach((el, i) => {
      const isElim = !this.isGameAlive(i) || res[i] === 'eliminated';
      el.className = 'pip';
      if (isElim) {
        el.classList.add('eliminated');
      } else if (res[i] === 'survived') {
        el.classList.add('survived');
      }
      if (isPrestigeGame(GAMES[i]) && store.getPrestige(GAMES[i].meta.id) > 1) {
        el.classList.add('prestiged');
      }

      if (i === this.index && (this.mode === 'playing' || this.mode === 'transition' || this.mode === 'secured' || this.mode === 'dying')) {
        el.classList.add('current');
        // Smoothly scroll active pip into view
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } catch { /* ignore */ }
      }
    });
  }

  resize() {
    this.stage.style.fontSize = `${(this.stage.clientWidth / W) * 16}px`;
  }

  refreshLike() {
    const meta = GAMES[this.index].meta;
    const btn = $('#btnLike');
    btn.classList.toggle('liked', store.isLiked(meta.id));
    const n = store.likeCount(meta.id, meta.baseLikes);
    $('#likeCount').textContent = n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  }

  banner(title, sub, kind) {
    const b = $('#banner');
    b.className = 'banner';
    void b.offsetWidth;
    b.querySelector('.banner-title').textContent = title;
    b.querySelector('.banner-sub').textContent = sub || '';
    b.classList.add('show', kind);
  }

  flash(kind) {
    const f = $('#flash');
    f.className = '';
    void f.offsetWidth;
    f.className = kind;
  }

  showWelcome(text) {
    const w = $('#welcome');
    w.textContent = `⟲ Welcome back — ${text}`;
    w.classList.add('show');
    clearTimeout(this.welcomeTimer);
    this.welcomeTimer = setTimeout(() => w.classList.remove('show'), 2800);
  }

  /* ----------------------------------------------------------- run flow */
  startRun(cont) {
    sounds.init();
    this.runType = 'standard';
    $('#dailyHudBadge').classList.add('hidden');
    $('#cycleLabel').classList.remove('hidden');
    this.buildPips();

    if (!cont) {
      store.reset();
      store.recordRunStart();
    }
    this.renderProfileUI();
    store.data.started = true;
    $('#menu').classList.add('hidden');
    $('#summary').classList.add('hidden');
    $('#dailySummaryModal').classList.add('hidden');
    $('#hud').classList.remove('hidden');

    const alive = this.getAliveIndices();
    if (alive.length === 0) {
      store.reset();
      store.recordRunStart();
    }
    const freshAlive = this.getAliveIndices();
    let startIdx = 0;
    if (cont && this.isGameAlive(store.meta.index)) {
      startIdx = store.meta.index;
    } else {
      startIdx = freshAlive[0] ?? 0;
    }

    this.index = startIdx;
    this.loadGame(this.index);
    this.mode = 'transition';
    this.transT = 0.45;
    this.snap.style.display = 'none';
    sounds.whoosh();
    this.banner(`GAME ${this.index + 1} / ${GAMES.length}`, GAMES[this.index].meta.title, 'info');
    this.renderPips();
    store.save();
  }

  loadGame(i) {
    const G = GAMES[i];
    this.index = i;
    this.game = new G(this.ctx, W, H, this.env);
    // Prestige rank must be visible to the game BEFORE init() so it can scale difficulty.
    const prestige = isPrestigeGame(G) ? store.getPrestige(G.meta.id) : 1;
    this.game.prestige = prestige;
    const snap = store.get(G.meta.id);
    this.game.init(snap ? snap.state : null, snap ? snap.score : 0);
    this.restored = !!snap;
    this.roundStartScore = this.game.score;
    this.roundLen = Number(new URLSearchParams(location.search).get('t')) || 60;
    this.timeLeft = this.roundLen;
    this.lastSecs = -1;
    this.lastScoreShown = -1;
    this.stage.classList.remove('urgent');

    $('#infoTitle').textContent = `${G.meta.icon}  ${G.meta.title}`;
    const hint = $('#infoHint');
    hint.textContent = G.meta.hint;
    hint.classList.remove('fade');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => hint.classList.add('fade'), 6000);
    if (this.runType === 'daily') {
      $('#cycleLabel').classList.add('hidden');
      const dBadge = $('#dailyHudBadge');
      if (dBadge) {
        dBadge.classList.remove('hidden');
        dBadge.textContent = `📅 STAGE ${this.dailyStageIndex + 1}/10`;
      }
    } else {
      $('#cycleLabel').classList.remove('hidden');
      const dBadge = $('#dailyHudBadge');
      if (dBadge) dBadge.classList.add('hidden');
      const aliveCount = this.getAliveIndices().length;
      $('#cycleLabel').textContent = `CYCLE ${store.meta.cycle} · ${aliveCount}/${GAMES.length} ACTIVE`;
    }
    $('#welcome').classList.remove('show');
    const badge = $('#prestigeBadge');
    if (badge) {
      if (prestige > 1) {
        badge.textContent = `★ PRESTIGE ${roman(prestige)} · HARDER`;
        badge.classList.remove('hidden');
        badge.classList.remove('pop');
        void badge.offsetWidth;
        badge.classList.add('pop');
      } else {
        badge.classList.add('hidden');
      }
    }
    this.refreshLike();
    store.meta.index = i;
    this.renderPips();
  }

  destroyGame() {
    if (this.game) this.game.destroy();
    this.game = null;
  }

  bank() {
    const live = Math.max(0, Math.round(this.game.score - this.roundStartScore));
    store.meta.global += live;
    store.meta.cycleBase += live;
    this.roundStartScore = this.game.score;
  }

  onVictory(winReason) {
    this.bank();
    const id = GAMES[this.index].meta.id;
    const completable = isPrestigeGame(id);

    let victoryBonus = 2500;
    let title = 'APEX VICTORY! 👑';
    let sub = winReason || 'MAXIMUM POWER ACHIEVED! · NEXT GAME';

    if (completable) {
      // COMPLETED: bonus climbs 3,000 -> 5,000 with each rank already held, then the game's
      // frozen board is discarded and it restarts fresh at the next prestige rank.
      const rankBefore = store.getPrestige(id);
      victoryBonus = Math.min(5000, 2500 + rankBefore * 500);
      const rankNow = store.promote(id);
      title = 'STAGE COMPLETED! ⭐';
      sub = `${winReason || 'Stage cleared!'} · PRESTIGE ${roman(rankNow)} NEXT`;
    }

    // Bonus counts toward the run total immediately (keep roundStartScore in sync so the HUD doesn't double-count).
    this.game.score = (this.game.score || 0) + victoryBonus;
    this.roundStartScore = this.game.score;
    store.meta.global += victoryBonus;
    store.meta.cycleBase += victoryBonus;
    if (!completable) {
      store.set(id, this.game.serialize(), this.game.score);
    }
    store.meta.results[this.index] = 'survived';
    store.recordStageVictory(id, this.game.score, victoryBonus);
    store.recordRunProgress(store.meta.cycle, store.meta.global);
    this.renderProfileUI();
    store.save();

    if (this.runType === 'daily') {
      this.dailyResults[this.dailyStageIndex] = 'survived';
      this.mode = 'secured';
      this.holdT = 1.0;
      this.banner(`STAGE ${this.dailyStageIndex + 1} CLEARED! ⭐`, `${GAMES[this.index].meta.title} · NEXT GAME`, 'ok');
      this.flash('ok');
      sounds.survive();
      sounds.up();
      haptics.success();
      this.stage.classList.remove('urgent');
      this.renderPips();
      return;
    }

    this.mode = 'secured';
    this.holdT = 1.6;
    this.banner(title, `${sub} (+${victoryBonus.toLocaleString()} PTS)`, 'ok');
    this.flash('ok');
    sounds.survive();
    sounds.up();
    haptics.success();
    this.stage.classList.remove('urgent');
    this.renderPips();
  }

  onSurvive() {
    this.bank();
    const id = GAMES[this.index].meta.id;
    store.set(id, this.game.serialize(), this.game.score);
    store.meta.results[this.index] = 'survived';
    store.recordRoundSurvive(id, this.game.score);
    store.recordRunProgress(store.meta.cycle, store.meta.global);
    this.renderProfileUI();
    store.save();

    if (this.runType === 'daily') {
      this.dailyResults[this.dailyStageIndex] = 'survived';
      this.mode = 'secured';
      this.holdT = 1.0;
      this.banner(`STAGE ${this.dailyStageIndex + 1} SURVIVED! ✓`, 'PROGRESS FROZEN · NEXT GAME', 'ok');
      this.flash('ok');
      sounds.survive();
      haptics.success();
      this.stage.classList.remove('urgent');
      this.renderPips();
      return;
    }

    this.mode = 'secured';
    this.holdT = 1.0;
    this.banner('60s SURVIVED! ✓', 'PROGRESS FROZEN · NEXT GAME', 'ok');
    this.flash('ok');
    sounds.survive();
    haptics.success();
    this.stage.classList.remove('urgent');
    this.renderPips();
  }

  onDeath() {
    this.bank();
    const id = GAMES[this.index].meta.id;
    store.eliminate(id);
    store.meta.results[this.index] = 'eliminated';
    store.recordGameScore(id, this.game.score);
    store.recordRunProgress(store.meta.cycle, store.meta.global);
    this.renderProfileUI();
    store.save();

    if (this.runType === 'daily') {
      this.dailyResults[this.dailyStageIndex] = 'eliminated';
      this.mode = 'dying';
      this.holdT = 1.1;
      this.banner('DAILY RUN OVER! 💀', this.game.deathReason || 'Eliminated in Daily Gauntlet', 'fail');
      this.flash('fail');
      sounds.fail();
      haptics.fail();
      this.stage.classList.remove('urgent');
      this.renderPips();
      return;
    }

    this.mode = 'dying';
    this.holdT = 1.1;
    const aliveLeft = this.getAliveIndices().length;
    const sub = this.game.deathReason ? `${this.game.deathReason} · ` : '';
    this.banner('GAME ELIMINATED! 💀', `${sub}${aliveLeft} Games Remaining in Run`, 'fail');
    this.flash('fail');
    sounds.fail();
    haptics.fail();
    this.stage.classList.remove('urgent');
    this.renderPips();
  }

  advance() {
    if (this.runType === 'daily') {
      const isAlive = this.dailyResults[this.dailyStageIndex] === 'survived';
      if (!isAlive || this.dailyStageIndex >= this.dailyIndices.length - 1) {
        this.finishDailyRun(isAlive && this.dailyStageIndex >= this.dailyIndices.length - 1);
        return;
      }
      this.dailyStageIndex += 1;
      const nextGameIdx = this.dailyIndices[this.dailyStageIndex];
      this.transitionTo(nextGameIdx, 0.7);
      this.banner(`STAGE ${this.dailyStageIndex + 1} / 10`, GAMES[nextGameIdx].meta.title, 'info');
      return;
    }

    const alive = this.getAliveIndices();
    if (alive.length === 0) {
      // All games eliminated for this run!
      this.showRunOver();
      return;
    }

    // Find next alive game in sequence
    const nextAfter = alive.find((idx) => idx > this.index);
    if (nextAfter !== undefined) {
      this.transitionTo(nextAfter, 0.7);
    } else {
      // Seamless Auto-Loop back to the first available game for the next cycle
      store.meta.cycle += 1;
      store.meta.cycleBase = 0;
      store.save();

      const loopIdx = alive[0];
      this.transitionTo(loopIdx, 0.7);
      this.banner(`CYCLE ${store.meta.cycle} BEGUN! 🔁`, `${alive.length} Games Remaining · Saved Progress Resuming`, 'info');
    }
  }

  transitionTo(i, dur = 0.7) {
    this.mode = 'transition';
    this.input.reset();
    const s = this.snap;
    const sc = s.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, s.width, s.height);
    sc.drawImage(this.canvas, 0, 0);
    s.style.transition = 'none';
    s.style.transform = 'translateY(0)';
    s.style.display = 'block';

    this.destroyGame();
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    try {
      this.loadGame(i);
    } catch (err) {
      console.error('Failed to load game during transition:', err);
      this.snap.style.display = 'none';
      this.mode = 'playing';
      return;
    }

    void s.offsetWidth;
    s.style.transition = `transform ${dur}s cubic-bezier(.7,0,.2,1)`;
    s.style.transform = 'translateY(-102%)';
    this.transT = dur;
    sounds.whoosh();
    haptics.light();
  }

  endTransition() {
    this.snap.style.display = 'none';
    this.mode = 'playing';
    this.input.reset();
    if (this.restored && this.game) {
      this.showWelcome(this.game.restoreLabel());
      sounds.welcome();
    }
    this.renderPips();
  }

  showRunOver() {
    this.mode = 'summary';
    this.destroyGame();
    sounds.fail();
    haptics.fail();
    this.flash('fail');

    const totalScore = store.meta.global;
    const cycles = store.meta.cycle;

    store.recordRunProgress(cycles, totalScore);
    this.renderProfileUI();

    $('#sumEyebrow').textContent = 'GAUNTLET TERMINATED';
    $('#sumTitle').textContent = 'All Games Eliminated!';
    const chipsEl = $('#sumChips');
    chipsEl.innerHTML = GAMES.map((g, i) => `<div class="chip eliminated" data-i="${i}" title="${g.meta.title} (Eliminated)">${g.meta.icon}</div>`).join('');
    chipsEl.onclick = null;

    $('#sumMult').textContent = `CYCLE ${cycles}`;
    $('#sumSub').textContent = `Total Score: ${totalScore.toLocaleString()} PTS · All ${GAMES.length} games succumbed!`;
    const footEl = $('#sumFoot');
    if (footEl) footEl.textContent = `All ${GAMES.length} games succumbed to the gauntlet. Can you survive longer next run?`;

    const btnNext = $('#btnNext');
    btnNext.textContent = 'START NEW RUN 🔄';
    btnNext.onclick = () => {
      $('#summary').classList.add('hidden');
      this.startRun(false);
    };

    $('#summary').classList.remove('hidden');
    this.lastScoreShown = -1;
  }

  showSummary() {
    this.showRunOver();
  }

  nextCycle() {
    sounds.init();
    $('#summary').classList.add('hidden');
    store.meta.cycle += 1;
    store.meta.cycleBase = 0;
    store.recordRunProgress(store.meta.cycle, store.meta.global);
    this.renderProfileUI();
    store.save();
    const alive = this.getAliveIndices();
    if (alive.length === 0) {
      this.startRun(false);
    } else {
      this.transitionTo(alive[0], 0.7);
    }
  }

  /* ----------------------------------------------------------- pause & settings */
  pause() {
    if (this.mode !== 'playing' || !this.game) return;
    this.mode = 'paused';
    sounds.whoosh();
    haptics.light();

    const G = GAMES[this.index];
    const banner = $('#settingsGameBanner');
    banner.classList.remove('hidden');
    $('#settingsGameIcon').textContent = G.meta.icon;
    $('#settingsGameTitle').textContent = G.meta.title;
    const secsLeft = Math.ceil(Math.max(0, this.timeLeft));
    $('#settingsGameSub').textContent = `Time Remaining: ${secsLeft}s · Cycle ${store.meta.cycle}`;

    $('#settingsEyebrow').textContent = 'TACTICAL PAUSE';
    $('#settingsTitle').textContent = 'GAME PAUSED';
    $('#btnResume').classList.remove('hidden');
    $('#btnAbandon').classList.remove('hidden');
    $('#settingsModal').classList.remove('hidden');
  }

  resume() {
    if (this.mode !== 'paused') return;
    $('#settingsModal').classList.add('hidden');
    this.mode = 'playing';
    this.last = performance.now();
    sounds.whoosh();
    haptics.light();
  }

  openSettings(fromMenu = false) {
    if (fromMenu) {
      $('#settingsGameBanner').classList.add('hidden');
      $('#settingsEyebrow').textContent = 'CONFIGURATION';
      $('#settingsTitle').textContent = 'SETTINGS';
      $('#btnResume').classList.add('hidden');
      $('#btnAbandon').classList.add('hidden');
    }
    sounds.init();
    $('#settingsModal').classList.remove('hidden');
    sounds.whoosh();
    haptics.light();
  }

  closeSettings() {
    if (this.mode === 'paused') {
      this.resume();
      return;
    }
    $('#settingsModal').classList.add('hidden');
    sounds.whoosh();
  }

  abandonRun() {
    $('#settingsModal').classList.add('hidden');
    sounds.fail();
    haptics.medium();

    if (this.game) {
      store.recordRunProgress(store.meta.cycle, store.meta.global);
      this.renderProfileUI();
      this.destroyGame();
    }
    if (this.runType === 'daily') {
      this.runType = 'standard';
      this.buildPips();
    }

    // Terminate and clear active run session
    store.abandonSession();

    // Reset canvas and snap overlay
    this.snap.style.display = 'none';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.clearRect(0, 0, this.W, this.H);

    this.mode = 'menu';
    $('#hud').classList.add('hidden');
    $('#welcome').classList.remove('show');
    $('#menu').classList.remove('hidden');
    $('#btnPlay').classList.remove('hidden');
    $('#btnContinue').classList.add('hidden');
    $('#btnNew').classList.add('hidden');
    this.stage.classList.remove('urgent');
  }

  /* ----------------------------------------------------------- player profile (TICKET-02) */
  openProfile() {
    sounds.init();
    this.renderProfileUI();
    $('#profileModal').classList.remove('hidden');
    sounds.whoosh();
    haptics.light();
  }

  closeProfile() {
    $('#profileModal').classList.add('hidden');
    sounds.whoosh();
  }

  renderProfileUI() {
    const prof = store.profile;
    const stats = store.stats;
    const rank = getRankTier(stats.lifetimeScore || 0);

    // Main menu player pill
    const menuAv = $('#menuPlayerAvatar');
    if (menuAv) menuAv.textContent = prof.avatar;
    const menuName = $('#menuPlayerName');
    if (menuName) menuName.textContent = prof.name;
    const menuRank = $('#menuPlayerRankChip');
    if (menuRank) menuRank.textContent = `${rank.icon} ${rank.title.split(' ')[0]}`;
    const menuMini = $('#menuPlayerMiniStats');
    if (menuMini) menuMini.textContent = `${(stats.lifetimeScore || 0).toLocaleString()} PTS · Max Cycle ${stats.maxCycle || 1}`;

    // Profile modal
    const avPrev = $('#profileAvatarPreview');
    if (avPrev) avPrev.textContent = prof.avatar;
    const nameInp = $('#profileNameInput');
    if (nameInp && document.activeElement !== nameInp) {
      nameInp.value = prof.name;
    }

    document.querySelectorAll('.avatar-opt').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.av === prof.avatar);
    });

    const rankBadge = $('#rankBadgeIcon');
    if (rankBadge) rankBadge.textContent = rank.icon;
    const rankName = $('#rankTierName');
    if (rankName) rankName.textContent = rank.title;
    const rankNext = $('#rankNextSub');
    if (rankNext) {
      if (rank.nextRank) {
        const needed = Math.max(0, rank.next - (stats.lifetimeScore || 0));
        rankNext.textContent = `${needed.toLocaleString()} PTS to ${rank.nextRank.title}`;
      } else {
        rankNext.textContent = 'MAXIMUM RANK ACHIEVED 👑';
      }
    }
    const rankFill = $('#rankBarFill');
    if (rankFill) rankFill.style.width = `${Math.round(rank.progress * 100)}%`;

    // Stats Grid
    const setTxt = (sel, val) => {
      const el = $(sel);
      if (el) el.textContent = val;
    };
    setTxt('#statLifetimePts', (stats.lifetimeScore || 0).toLocaleString());
    setTxt('#statBestRun', (stats.highestRunScore || 0).toLocaleString());
    setTxt('#statMaxCycle', String(stats.maxCycle || 1));
    setTxt('#statSurvived', (stats.timersSurvived || 0).toLocaleString());
    setTxt('#statStagesCleared', (stats.stagesCleared || 0).toLocaleString());
    setTxt('#statRunsAttempted', (stats.runsAttempted || 0).toLocaleString());

    // Daily Stats
    const daily = store.daily;
    setTxt('#statDailyStreak', `🔥 ${daily.streak || 0}`);
    let medalCount = 0;
    for (const day of Object.values(daily.history || {})) {
      if (day.medal && day.medal !== 'none') medalCount++;
    }
    setTxt('#statDailyMedals', `🥇 ${medalCount}`);

    // Top / Favorite Arcade Game
    let topGameId = null;
    let topScore = 0;
    for (const [gid, sc] of Object.entries(stats.gameHighScores || {})) {
      if (sc > topScore) {
        topScore = sc;
        topGameId = gid;
      }
    }
    if (topGameId) {
      const gameObj = GAMES.find((g) => g.meta.id === topGameId);
      if (gameObj) {
        setTxt('#favGameIcon', gameObj.meta.icon);
        setTxt('#favGameTitle', gameObj.meta.title);
        setTxt('#favGameSub', `Personal Best: ${topScore.toLocaleString()} PTS`);
      }
    } else {
      setTxt('#favGameIcon', '🎮');
      setTxt('#favGameTitle', 'No Games Recorded');
      setTxt('#favGameSub', 'Play gauntlet runs to establish personal bests');
    }

    // Profile Closet summary
    const closet = store.closet;
    const currentSkin = SKINS.find((s) => s.id === closet.skinId);
    const currentHat = HATS.find((h) => h.id === closet.hatId);
    const closetSum = $('#profileClosetSummary');
    if (closetSum) {
      closetSum.textContent = `${currentSkin?.name || 'Cyan'} · ${currentHat?.name || 'No Hat'}`;
    }
  }

  /* ----------------------------------------------------------- mascot closet (TICKET-03) */
  openCloset() {
    sounds.init();
    $('#closetModal').classList.remove('hidden');
    sounds.whoosh();
    haptics.light();
    this.renderClosetUI();
    this.startClosetPreview();
  }

  closeCloset() {
    $('#closetModal').classList.add('hidden');
    this.stopClosetPreview();
    sounds.whoosh();
    this.renderProfileUI();
  }

  setClosetTab(tab) {
    if (this.closetTab === tab) return;
    this.closetTab = tab;
    $('#tabSkins').classList.toggle('active', tab === 'skins');
    $('#tabHats').classList.toggle('active', tab === 'hats');
    sounds.pop();
    haptics.light();
    this.renderClosetGrid();
  }

  renderClosetUI() {
    const closet = store.closet;
    const skin = SKINS.find((s) => s.id === closet.skinId) || SKINS[0];
    const hat = HATS.find((h) => h.id === closet.hatId) || HATS[0];

    const skinLbl = $('#closetSkinLabel');
    if (skinLbl) skinLbl.textContent = skin.name;
    const hatLbl = $('#closetHatLabel');
    if (hatLbl) hatLbl.textContent = hat.name;

    const bal = $('#closetBalancePill');
    if (bal) bal.textContent = `🌟 ${(store.stats.lifetimeScore || 0).toLocaleString()} LIFETIME PTS`;

    const skinsCount = $('#skinsCount');
    if (skinsCount) skinsCount.textContent = String(SKINS.length);
    const hatsCount = $('#hatsCount');
    if (hatsCount) hatsCount.textContent = String(HATS.length);

    this.renderClosetGrid();
  }

  renderClosetGrid() {
    const grid = $('#closetGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const closet = store.closet;
    const lifetimeScore = store.stats.lifetimeScore || 0;

    if (this.closetTab === 'skins') {
      SKINS.forEach((skin) => {
        const isEquipped = closet.skinId === skin.id;
        const isUnlocked = store.isSkinUnlocked(skin.id);

        const card = document.createElement('div');
        card.className = `closet-item-card ${isEquipped ? 'equipped' : isUnlocked ? 'unlocked' : 'locked'}`;

        // Swatch
        const icon = document.createElement('div');
        icon.className = 'closet-item-icon';
        icon.style.background = `radial-gradient(circle at 35% 35%, #ffffff 0%, ${skin.color} 38%, ${skin.belly} 100%)`;

        // Name
        const name = document.createElement('div');
        name.className = 'closet-item-name';
        name.textContent = skin.name;

        // Desc
        const desc = document.createElement('div');
        desc.className = 'closet-item-desc';
        desc.textContent = skin.desc;

        // Badge
        const badge = document.createElement('div');
        badge.className = 'closet-item-badge';
        if (isEquipped) {
          badge.textContent = 'EQUIPPED ✓';
        } else if (isUnlocked) {
          badge.textContent = 'EQUIP';
        } else {
          badge.textContent = `🔒 ${(skin.unlockCost || 0).toLocaleString()} PTS`;
        }

        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(desc);
        card.appendChild(badge);

        card.onclick = () => {
          if (isEquipped) return;
          if (isUnlocked) {
            store.equipSkin(skin.id);
            sounds.pop();
            haptics.light();
            this.renderClosetUI();
          } else {
            card.classList.remove('shake');
            void card.offsetWidth;
            card.classList.add('shake');
            sounds.fail();
            haptics.medium();
          }
        };

        grid.appendChild(card);
      });
    } else {
      // Hats tab
      HATS.forEach((hat) => {
        const isEquipped = closet.hatId === hat.id;
        const isUnlocked = store.isHatUnlocked(hat.id);

        const card = document.createElement('div');
        card.className = `closet-item-card ${isEquipped ? 'equipped' : isUnlocked ? 'unlocked' : 'locked'}`;

        // Icon
        const icon = document.createElement('div');
        icon.className = 'closet-item-icon';
        icon.style.background = 'rgba(255, 255, 255, 0.08)';
        icon.textContent = hat.icon || '🎩';

        // Name
        const name = document.createElement('div');
        name.className = 'closet-item-name';
        name.textContent = hat.name;

        // Desc
        const desc = document.createElement('div');
        desc.className = 'closet-item-desc';
        desc.textContent = hat.desc;

        // Badge
        const badge = document.createElement('div');
        badge.className = 'closet-item-badge';
        if (isEquipped) {
          badge.textContent = 'EQUIPPED ✓';
        } else if (isUnlocked) {
          badge.textContent = 'EQUIP';
        } else {
          badge.textContent = `🔒 ${(hat.unlockCost || 0).toLocaleString()} PTS`;
        }

        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(desc);
        card.appendChild(badge);

        card.onclick = () => {
          if (isEquipped) return;
          if (isUnlocked) {
            store.equipHat(hat.id);
            sounds.pop();
            haptics.light();
            this.renderClosetUI();
          } else {
            card.classList.remove('shake');
            void card.offsetWidth;
            card.classList.add('shake');
            sounds.fail();
            haptics.medium();
          }
        };

        grid.appendChild(card);
      });
    }
  }

  startClosetPreview() {
    this.stopClosetPreview();
    const canvas = $('#closetCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let last = performance.now();
    this.closetWalkT = 0;

    const render = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.closetWalkT += dt * 0.95;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Floor shadow
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.72;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 26, 42 + Math.sin(this.closetWalkT * 6) * 3, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw mascot waddling with happy expression
      const squish = 1 + Math.sin(this.closetWalkT * 6) * 0.04;
      const eyes = (Math.floor(this.closetWalkT * 1.5) % 6 === 0) ? 'wink' : 'happy';

      drawBean(ctx, cx, cy - 8, 42, {
        walkT: this.closetWalkT,
        squash: squish,
        eyes,
      });

      this.closetPreviewAnim = requestAnimationFrame(render);
    };

    this.closetPreviewAnim = requestAnimationFrame(render);
  }

  stopClosetPreview() {
    if (this.closetPreviewAnim) {
      cancelAnimationFrame(this.closetPreviewAnim);
      this.closetPreviewAnim = null;
    }
  }

  /* ----------------------------------------------------------- daily challenge (TICKET-04) */
  setMenuMode(mode) {
    this.menuMode = mode;
    $('#tabModeStandard').classList.toggle('active', mode === 'standard');
    $('#tabModeDaily').classList.toggle('active', mode === 'daily');
    $('#standardMenuContent').classList.toggle('hidden', mode !== 'standard');
    $('#dailyMenuContent').classList.toggle('hidden', mode !== 'daily');
    if (mode === 'daily') {
      this.renderDailyMenuUI();
    }
    sounds.pop();
    haptics.light();
  }

  renderDailyMenuUI() {
    const todayStr = getUtcDayKey();
    const d = new Date();
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const formattedDate = `${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}, ${d.getUTCFullYear()}`;
    const dateStrEl = $('#dailyDateStr');
    if (dateStrEl) dateStrEl.textContent = formattedDate;

    const streak = store.daily.streak || 0;
    const streakChip = $('#dailyHeroStreakChip');
    if (streakChip) streakChip.textContent = `🔥 ${streak} STREAK`;
    const tabTag = $('#menuDailyStreakTag');
    if (tabTag) tabTag.textContent = `🔥 ${streak}`;

    // 10-Game Preview icons
    const dailyIndices = getDailyGameIndices(GAMES.length, 10, todayStr);
    const iconsContainer = $('#dailyPreviewIcons');
    if (iconsContainer) {
      iconsContainer.innerHTML = dailyIndices.map((idx, i) => `<span title="Stage ${i + 1}: ${GAMES[idx].meta.title}">${GAMES[idx].meta.icon}</span>`).join('');
    }

    // Today's completion status
    const todayRecord = store.getTodayDaily();
    const statusIcon = $('#dailyStatusIcon');
    const statusTitle = $('#dailyStatusTitle');
    const statusDesc = $('#dailyStatusDesc');
    const btnPlay = $('#btnStartDaily');

    if (todayRecord) {
      const medal = getDailyMedal(todayRecord.score);
      if (statusIcon) statusIcon.textContent = medal ? medal.icon : '⭐';
      if (statusTitle) statusTitle.textContent = `TODAY'S BEST: ${todayRecord.score.toLocaleString()} PTS`;
      if (statusDesc) statusDesc.textContent = medal ? `${medal.name} Earned! You can replay for a higher score.` : 'Gauntlet completed. Replay to earn a medal!';
      if (btnPlay) btnPlay.textContent = 'REPLAY DAILY GAUNTLET ▶';
    } else {
      if (statusIcon) statusIcon.textContent = '🎯';
      if (statusTitle) statusTitle.textContent = '10-Stage Seeded Gauntlet';
      if (statusDesc) statusDesc.textContent = 'Survive 10 curated games to claim today\'s medal!';
      if (btnPlay) btnPlay.textContent = 'PLAY TODAY\'S GAUNTLET ▶';
    }

    this.updateDailyResetTimer();
    if (!this.dailyTimerInterval) {
      this.dailyTimerInterval = setInterval(() => this.updateDailyResetTimer(), 60000);
    }
  }

  updateDailyResetTimer() {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const diff = Math.max(0, tomorrow - now);
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const timerStr = `⏳ Resets in ${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
    const timerEl = $('#dailyResetTimer');
    if (timerEl) timerEl.textContent = timerStr;
  }

  startDailyRun() {
    sounds.init();
    this.runType = 'daily';
    this.dailyIndices = getDailyGameIndices(GAMES.length, 10);
    this.dailyStageIndex = 0;
    this.dailyResults = new Array(10).fill(null);

    // Build pips for 10 daily games
    const pipsEl = $('#pips');
    pipsEl.innerHTML = this.dailyIndices.map((gIdx, i) => `<div class="pip" data-i="${i}" title="Stage ${i + 1}: ${GAMES[gIdx].meta.title}">${GAMES[gIdx].meta.icon}</div>`).join('');

    $('#menu').classList.add('hidden');
    $('#summary').classList.add('hidden');
    $('#dailySummaryModal').classList.add('hidden');
    $('#hud').classList.remove('hidden');

    // Fresh run state
    store.meta.global = 0;
    store.meta.cycleBase = 0;

    const firstGameIdx = this.dailyIndices[0];
    this.index = firstGameIdx;
    this.loadGame(this.index);
    this.mode = 'transition';
    this.transT = 0.45;
    this.snap.style.display = 'none';
    sounds.whoosh();
    this.banner('DAILY GAUNTLET 📅', `Stage 1 of 10 · ${GAMES[firstGameIdx].meta.title}`, 'info');
    this.renderPips();
  }

  finishDailyRun(clearedAll) {
    this.mode = 'summary';
    this.destroyGame();

    const totalScore = store.meta.global;
    const res = store.recordDailyResult(totalScore);

    if (res.medal) {
      sounds.survive();
      sounds.up();
      haptics.success();
      this.flash('ok');
    } else {
      sounds.fail();
      haptics.fail();
      this.flash('fail');
    }

    const modal = $('#dailySummaryModal');
    if (!modal) return;

    const medalObj = res.medal;
    const medalIcon = medalObj ? medalObj.icon : (clearedAll ? '⭐' : '💀');
    const medalTitle = medalObj ? `${medalObj.name.toUpperCase()}!` : (clearedAll ? 'GAUNTLET CLEARED!' : 'GAUNTLET FINISHED');

    $('#dsEyebrow').textContent = clearedAll ? 'DAILY SEED FULLY CLEARED!' : 'DAILY RUN CONCLUDED';
    $('#dsMedalIcon').textContent = medalIcon;
    $('#dsTitle').textContent = medalTitle;
    $('#dsScoreVal').textContent = totalScore.toLocaleString();
    $('#dsStreakVal').textContent = `🔥 ${res.streak} ${res.streak === 1 ? 'DAY' : 'DAYS'}`;
    $('#dsStreakDesc').textContent = res.isNewDay ? 'Daily streak updated and saved!' : 'Personal best daily score recorded!';

    const chipsRow = $('#dsChipsRow');
    if (chipsRow) {
      chipsRow.innerHTML = this.dailyIndices.map((gIdx, i) => {
        const state = this.dailyResults[i];
        const cls = state === 'survived' ? 'survived' : (state === 'eliminated' ? 'eliminated' : '');
        return `<div class="chip ${cls}" title="${GAMES[gIdx].meta.title}">${GAMES[gIdx].meta.icon}</div>`;
      }).join('');
    }

    modal.classList.remove('hidden');
    this.renderDailyMenuUI();
    this.renderProfileUI();
  }

  closeDailySummary() {
    $('#dailySummaryModal').classList.add('hidden');
    this.runType = 'standard';
    this.buildPips();
    $('#hud').classList.add('hidden');
    $('#menu').classList.remove('hidden');
    this.renderDailyMenuUI();
    this.renderProfileUI();
    sounds.whoosh();
  }

  /* -------------------------------------------------------------- loop */
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    try {
      this.tick(dt);
    } catch (err) {
      console.error('Game loop tick error:', err);
    } finally {
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  tick(dt) {
    // 1) Mode timers that need the previous frame still on the canvas.
    if (this.mode === 'secured' || this.mode === 'dying') {
      this.holdT -= dt;
      if (this.holdT <= 0) this.advance();
    }
    if (this.mode === 'transition') {
      this.transT -= dt;
      if (this.transT <= 0) this.endTransition();
    }

    // 2) Simulation.
    if (this.mode === 'playing' && this.game) {
      const g = this.game;
      g.time += dt;
      g.grace = Math.max(0, g.grace - dt);
      g.update(dt);
      if (!g.freezeTimer) this.timeLeft -= dt;
      this.updateTimerUI();
      if (g.dead) this.onDeath();
      else if (g.won || g.secured) {
        this.onVictory(g.winReason);
      } else if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.updateTimerUI();
        this.onSurvive();
      }
    } else if (this.mode === 'dying' && this.game) {
      this.game.updateDying(dt * 0.4);
    }

    // 3) Render with guaranteed transform isolation
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.clearRect(0, 0, W, H);
    if (this.game && this.mode !== 'menu') {
      try {
        this.game.render();
      } catch (err) {
        console.error(`Render error in ${this.game.constructor?.meta?.id || 'game'}:`, err);
      } finally {
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
      }
    }

    if (this.game && (this.mode === 'playing' || this.mode === 'paused' || this.mode === 'secured' || this.mode === 'dying')) {
      const live = Math.max(0, Math.round(this.game.score - this.roundStartScore));
      const total = store.meta.global + live;
      if (total !== this.lastScoreShown) {
        this.lastScoreShown = total;
        $('#score').textContent = total.toLocaleString();
      }
    } else if (this.mode === 'summary' || this.mode === 'transition') {
      const total = store.meta.global;
      if (total !== this.lastScoreShown) {
        this.lastScoreShown = total;
        $('#score').textContent = total.toLocaleString();
      }
    }

    this.input.endFrame();
  }

  updateTimerUI() {
    const secs = Math.ceil(Math.max(0, this.timeLeft));
    if (secs !== this.lastSecs) {
      this.lastSecs = secs;
      $('#time').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      if (secs <= 5 && secs > 0) {
        this.stage.classList.add('urgent');
        sounds.tick();
        haptics.light();
      }
    }
    $('#timerFill').style.transform = `scaleX(${Math.max(0, this.timeLeft / this.roundLen)})`;
  }

  /* ----------------------------------------------------------- shareable card (TICKET-05) */
  openShareModal(opts = {}) {
    sounds.init();
    this.currentShareOpts = opts;
    const canvas = $('#shareCanvas');
    if (canvas) {
      renderSharePoster(canvas, opts);
    }
    const titleEl = $('#shareTitle');
    const eyeEl = $('#shareEyebrow');
    if (titleEl && eyeEl) {
      if (opts.type === 'daily') {
        eyeEl.textContent = 'DAILY SEED TRANSMISSION';
        titleEl.textContent = 'DAILY RECORD POSTER';
      } else if (opts.type === 'profile') {
        eyeEl.textContent = 'COMMANDER DOSSIER';
        titleEl.textContent = 'PILOT PROFILE POSTER';
      } else {
        eyeEl.textContent = 'ARCADE TRANSMISSION';
        titleEl.textContent = 'RUN SUMMARY POSTER';
      }
    }
    $('#shareModal').classList.remove('hidden');
    sounds.victory();
    haptics.success();
  }

  closeShareModal() {
    $('#shareModal').classList.add('hidden');
    sounds.whoosh();
  }

  showShareToast(msg) {
    const toast = $('#shareToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    if (this.shareToastTimer) clearTimeout(this.shareToastTimer);
    this.shareToastTimer = setTimeout(() => {
      toast.classList.add('hidden');
      this.shareToastTimer = null;
    }, 2800);
  }

  async executeShare() {
    sounds.init();
    sounds.pop();
    haptics.medium();
    const canvas = $('#shareCanvas');
    if (!canvas) return;

    const opts = this.currentShareOpts || {};
    const scoreVal = (opts.score || store.meta.global || 0).toLocaleString();
    const cycleVal = opts.cycle || store.meta.cycle || 1;
    const playerName = store.profile?.name || 'Captain Bean';

    const shareTitle = opts.type === 'daily'
      ? `Jelly Bean: 60s Daily Challenge — ${scoreVal} PTS`
      : `Jelly Bean: 60s Challenge — ${playerName} Scored ${scoreVal} PTS!`;
    const shareText = opts.type === 'daily'
      ? `I scored ${scoreVal} PTS in today's 10-stage Daily Seed! Can you beat my high score?`
      : `Surviving ${cycleVal} cycles in Jelly Bean: 60s Challenge with ${scoreVal} PTS! Beat my record!`;
    const filename = `jelly-bean-${opts.type || 'run'}-${Date.now()}.png`;

    try {
      const res = await shareCardFile(canvas, {
        title: shareTitle,
        text: shareText,
        filename,
      });

      if (res.method === 'share') {
        this.showShareToast('Card shared successfully! 🚀');
        sounds.up();
        haptics.success();
      } else if (res.method === 'share_download') {
        this.showShareToast('Shared & Saved PNG to downloads! 💾');
        sounds.like();
      } else if (res.method === 'download') {
        this.showShareToast('High-Res Poster saved to Downloads! 💾');
        sounds.like();
      }
    } catch (e) {
      this.showShareToast('Saved PNG to Downloads! 💾');
    }
  }

  executeDownload() {
    sounds.init();
    sounds.pop();
    haptics.medium();
    const canvas = $('#shareCanvas');
    if (!canvas) return;
    const opts = this.currentShareOpts || {};
    const filename = `jelly-bean-${opts.type || 'run'}-${Date.now()}.png`;
    downloadCardPNG(canvas, filename);
    this.showShareToast('High-Res Poster saved to Downloads! 💾');
    sounds.like();
  }
}

