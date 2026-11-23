import { sounds } from '../audio.js';
import { haptics } from '../haptics.js';
import { store, getRankTier, RANKS, SKINS, HATS, DAILY_MEDALS, getDailyMedal, getUtcDayKey, getDailyGameIndices } from './store.js';
import { drawBean } from './bean.js';
import { renderSharePoster, shareCardFile, downloadCardPNG } from './shareCard.js';
import { setupNativeAndroidBridge } from './nativeAndroid.js';
import { PlazaScene, WorldMapScene } from './worldMap.js';
import { Input } from './input.js';
import {
  GAMES,
  GAME_BY_ID,
  STARTER_GAMES,
  GAME_PACKS,
  WORLD_1_NODES,
  WORLD_1_CHESTS,
  QUEST_POOL,
  getWorldById,
  getWorldNodeById,
  getStarsForScore,
  isPrestigeGame,
  getGameParScore,
  getGameCue,
  getGamePrestigeCue,
} from '../games/registry.js';

export { isPrestigeGame };
export const W = 450;
export const H = 800;

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
    this._pendingWrap = null;

    // Mascot Closet (TICKET-03) & Toy Courtyard Plaza / World 1 Diorama
    this.closetTab = 'skins';
    this.closetPreviewAnim = null;
    this.closetWalkT = 0;
    this.homeBeanAnim = null;
    this.homeBeanT = 0;
    this.homeBeanBounce = 0;
    this.homeBeanSparkles = [];
    this.activeWorldNodeId = store.worlds.selectedNodeId || '1-1';
    this.plazaScene = new PlazaScene($('#plazaCanvas'));
    this.worldMapScene = new WorldMapScene($('#worldMapCanvas'));

    // Run modes: 'standard' (Endless) | 'world' (World 1 Node) | 'daily'
    this.runType = 'standard';
    this.dailyIndices = [];
    this.dailyStageIndex = 0;
    this.dailyResults = [];
    this.menuMode = 'standard';
    this.dailyTimerInterval = null;

    // Share Card (TICKET-05)
    this.currentShareOpts = null;
    this.shareToastTimer = null;

    // Pack Progression & Mystery Reveal
    this.pendingRevealQueue = store.getPendingRevealPacks();
    this.activeRevealPack = null;
    this.revealedCardIndices = new Set();
    this._resumeAdvanceAfterReveal = false;

    // Admin Playtester Mode (visible in `npm run dev`, ?admin=1, Shift+A, or 5x tap on Settings title)
    const explicitAdmin = params.get('admin') === '1' || params.get('dev') === '1';
    const isDevServer = Boolean(typeof import.meta !== 'undefined' && import.meta.env?.DEV);
    this.adminMode = isDevServer || explicitAdmin || sessionStorage.getItem('gr_admin') === '1';
    if (explicitAdmin || sessionStorage.getItem('gr_admin') === '1') sessionStorage.setItem('gr_admin', '1');
    this._pausedByAdmin = false;
    this._settingsTapCount = 0;
    this._settingsTapTimer = null;

    this.bindUI();
    this.buildMenuIcons();
    this.buildPips();
    this.renderProfileUI();
    this.renderDailyMenuUI();
    this.renderPackUI();
    this.renderPlazaUI();
    this.renderWorldMapUI();
    this.syncAdminUI();
    this.startHomeBeanPreview();
    setupNativeAndroidBridge(this);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    // Direct game launch via URL query parameter (adminMode overrides pack lock)
    const targetGame = params.get('game') || params.get('g');
    if (targetGame) {
      const idx = GAMES.findIndex((g, i) => g.meta.id === targetGame || String(i + 1) === targetGame || String(i) === targetGame);
      if (idx !== -1 && (this.isGameUnlocked(idx) || this.adminMode)) {
        if (store.data.meta.eliminated) {
          delete store.data.meta.eliminated[GAMES[idx].meta.id];
          store.save();
        }
        setTimeout(() => this.jumpToGame(idx, this.adminMode), 50);
      }
    } else if (explicitAdmin) {
      setTimeout(() => this.openAdminModal(), 60);
    }
  }

  isGameUnlocked(i) {
    if (i < 0 || i >= GAMES.length) return false;
    const id = GAMES[i].meta.id;
    if (this.runType === 'world') {
      const node = getWorldNodeById(this.activeWorldNodeId);
      return !!node && node.gameIds.includes(id);
    }
    return store.isGameUnlocked(id);
  }

  getUnlockedIndices() {
    const list = [];
    for (let i = 0; i < GAMES.length; i++) {
      if (this.isGameUnlocked(i)) list.push(i);
    }
    return list;
  }

  isGameAlive(i) {
    if (!this.isGameUnlocked(i)) return false;
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

  /* ---------------------------------------------------------- Normalized Reel Points */
  toPerfRP(gameId, rawDelta) {
    const par = getGameParScore(gameId);
    const linear = (Math.max(0, rawDelta) / Math.max(1, par)) * 1000;
    return linear <= 1500 ? linear : Math.min(2500, 1500 + (linear - 1500) * 0.25);
  }

  getCycleMultiplier() {
    const cycle = this.runType === 'daily' ? 1 : (store.meta.cycle || 1);
    return Math.min(2.0, 1 + 0.05 * (cycle - 1));
  }

  getRunMultiplier() {
    const questBoost = this.runType === 'daily' ? 1 : store.getQuestMultiplier();
    return this.getCycleMultiplier() * questBoost;
  }

  computeLiveRP() {
    if (!this.game || !GAMES[this.index]) return 0;
    const rawDelta = Math.max(0, this.game.score - this.roundStartScore);
    const perfRP = this.toPerfRP(GAMES[this.index].meta.id, rawDelta);
    return Math.round(perfRP * this.getRunMultiplier());
  }

  computeFinalRoundRP({ survived = false, won = false, prestige = 1 } = {}) {
    const id = GAMES[this.index].meta.id;
    const rawDelta = Math.max(0, (this.game?.score || 0) - this.roundStartScore);
    const perfRP = this.toPerfRP(id, rawDelta);
    const runMult = this.getRunMultiplier();
    if (!survived && !won) {
      return Math.round(perfRP * 0.5 * runMult);
    }
    const survivalBase = 500;
    const victoryBonus = won ? Math.min(2500, 1500 + (Math.max(1, prestige) - 1) * 250) : 0;
    return Math.round((perfRP + survivalBase + victoryBonus) * runMult);
  }

  // Console/QA helper on window.__reel to test Pack Unlock & Mystery Reveal flow
  debugGrantRP(amount = 25000) {
    store.stats.lifetimeScore = (store.stats.lifetimeScore || 0) + Math.max(0, Math.round(amount));
    store.save();
    const unlocked = store.checkPackUnlocks();
    this.buildMenuIcons();
    this.buildPips();
    this.renderProfileUI();
    this.renderPackUI();
    this.renderPlazaUI();
    this.renderWorldMapUI();
    if (unlocked.length > 0 && this.mode === 'menu') {
      this.openPackRevealModal(unlocked[0], false);
    }
    return { lifetimeScore: store.stats.lifetimeScore, unlocked: unlocked.map((p) => p.id) };
  }

  /* ---------------------------------------------------------- UI setup */
  bindUI() {
    $('#btnPlay').onclick = () => this.startRun(false);
    $('#btnNext').onclick = () => this.nextCycle();

    const homeBeanBtn = $('#homeBeanBtn');
    if (homeBeanBtn) {
      homeBeanBtn.onclick = () => this.triggerHomeBeanBounce();
    }
    const btnNavHome = $('#btnNavHome');
    if (btnNavHome) {
      btnNavHome.onclick = () => this.triggerHomeBeanBounce();
    }

    // Toy Courtyard Plaza & World 1 Overworld Controls
    ['#btnEnterWorld1', '#btnPlazaWorld1', '#btnPlazaStars'].forEach((sel) => {
      const el = $(sel);
      if (el) el.onclick = () => this.openWorldMap();
    });
    ['#btnPlazaDaily', '#btnNavDaily', '#btnWorldPlayDaily'].forEach((sel) => {
      const el = $(sel);
      if (el) el.onclick = () => this.startDailyRun();
    });
    ['#btnOpenQuestsPlaza', '#btnWorldOpenQuests'].forEach((sel) => {
      const el = $(sel);
      if (el) el.onclick = () => this.openQuestsModal();
    });
    const btnQuestsClose = $('#btnQuestsClose');
    if (btnQuestsClose) btnQuestsClose.onclick = () => this.closeQuestsModal();
    const btnQuestsDone = $('#btnQuestsDone');
    if (btnQuestsDone) btnQuestsDone.onclick = () => this.closeQuestsModal();
    const questsModal = $('#questsModal');
    if (questsModal) {
      questsModal.addEventListener('click', (e) => {
        if (e.target === questsModal) this.closeQuestsModal();
      });
    }

    const btnBackPlaza = $('#btnWorldBackPlaza');
    if (btnBackPlaza) btnBackPlaza.onclick = () => this.closeWorldMap();
    const btnWorldEndless = $('#btnWorldPlayEndless');
    if (btnWorldEndless) {
      btnWorldEndless.onclick = () => {
        this.closeWorldMap(false);
        this.startRun(false);
      };
    }
    const btnPlayNode = $('#btnPlayWorldNode');
    if (btnPlayNode) btnPlayNode.onclick = () => this.startWorldRun(this.activeWorldNodeId);
    const btnChest = $('#btnWorldChest');
    if (btnChest) btnChest.onclick = () => this.handleWorldChestClick();
    const btnW2Portal = $('#btnWorld2Portal');
    if (btnW2Portal) btnW2Portal.onclick = () => this.handleWorld2PortalClick();

    const pinsLayer = $('#wmPinsLayer');
    if (pinsLayer) {
      pinsLayer.addEventListener('click', (e) => {
        const nodeBtn = e.target.closest('.wm-node-btn[data-node]');
        if (nodeBtn) {
          this.selectWorldMapNode(nodeBtn.dataset.node);
        }
      });
    }

    const btnHowTo = $('#btnHowToPlay');
    if (btnHowTo) btnHowTo.onclick = () => this.openHowTo();
    const btnHowToClose = $('#btnHowToClose');
    if (btnHowToClose) btnHowToClose.onclick = () => this.closeHowTo();
    const btnHowToDone = $('#btnHowToDone');
    if (btnHowToDone) btnHowToDone.onclick = () => this.closeHowTo();
    const howToModal = $('#howToModal');
    if (howToModal) {
      howToModal.addEventListener('click', (e) => {
        if (e.target === howToModal) this.closeHowTo();
      });
    }

    const btnMute = $('#btnMute');
    const muteIco = $('#muteIco');
    if (btnMute) {
      btnMute.onclick = () => {
        sounds.setMuted(!sounds.muted);
        if (muteIco) muteIco.textContent = sounds.muted ? '🔇' : '🔊';
        if (!sounds.muted) sounds.like();
      };
    }
    if (muteIco) muteIco.textContent = sounds.muted ? '🔇' : '🔊';

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

    // Packs Vault & Mystery Reveal modals
    const openVaultOrReveal = () => {
      const pending = store.getPendingRevealPacks();
      if (pending.length > 0) {
        this.openPackRevealModal(pending[0], false);
      } else {
        this.openPacksModal();
      }
    };
    const btnPacks = $('#btnOpenPacks');
    if (btnPacks) btnPacks.onclick = () => this.openPacksModal();
    const btnVault = $('#btnOpenVault');
    if (btnVault) btnVault.onclick = openVaultOrReveal;
    const btnRpPill = $('#btnRpPill');
    if (btnRpPill) btnRpPill.onclick = () => this.openPacksModal();
    const btnGamesPill = $('#btnGamesPill');
    if (btnGamesPill) btnGamesPill.onclick = () => this.openPacksModal();
    const btnPacksClose = $('#btnPacksClose');
    if (btnPacksClose) btnPacksClose.onclick = () => this.closePacksModal();
    const btnPacksDone = $('#btnPacksDone');
    if (btnPacksDone) btnPacksDone.onclick = () => this.closePacksModal();
    const packCard = $('#packProgressCard');
    if (packCard) {
      packCard.onclick = openVaultOrReveal;
      packCard.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          packCard.click();
        }
      };
    }
    const btnRevealAct = $('#btnPackRevealAction');
    if (btnRevealAct) btnRevealAct.onclick = () => this.handlePackRevealAction();

    // Admin Mode Launcher & Hidden 5-Tap Unlock on Settings Title
    const btnAdminPill = $('#btnAdminPill');
    if (btnAdminPill) btnAdminPill.onclick = () => this.openAdminModal();
    const btnAdminFromSettings = $('#btnOpenAdminFromSettings');
    if (btnAdminFromSettings) {
      btnAdminFromSettings.onclick = () => {
        $('#settingsModal').classList.add('hidden');
        this.openAdminModal();
      };
    }
    const settingsTitleEl = $('#settingsTitle');
    if (settingsTitleEl) {
      settingsTitleEl.onclick = () => {
        this._settingsTapCount += 1;
        clearTimeout(this._settingsTapTimer);
        this._settingsTapTimer = setTimeout(() => { this._settingsTapCount = 0; }, 1600);
        if (this._settingsTapCount >= 5) {
          this._settingsTapCount = 0;
          $('#settingsModal').classList.add('hidden');
          this.enableAdminMode(true);
        }
      };
    }
    const btnAdminClose = $('#btnAdminClose');
    if (btnAdminClose) btnAdminClose.onclick = () => this.closeAdminModal();
    const adminModalEl = $('#adminModal');
    if (adminModalEl) {
      adminModalEl.addEventListener('click', (e) => {
        if (e.target === adminModalEl) this.closeAdminModal();
      });
    }
    const btnAdminPrev = $('#btnAdminPrev');
    if (btnAdminPrev) btnAdminPrev.onclick = () => this.adminStepGame(-1);
    const btnAdminNext = $('#btnAdminNext');
    if (btnAdminNext) btnAdminNext.onclick = () => this.adminStepGame(1);
    const btnAdminPrevQuick = $('#btnAdminPrevQuick');
    if (btnAdminPrevQuick) btnAdminPrevQuick.onclick = () => this.adminStepGame(-1);
    const btnAdminNextQuick = $('#btnAdminNextQuick');
    if (btnAdminNextQuick) btnAdminNextQuick.onclick = () => this.adminStepGame(1);
    const btnAdminTogglePacks = $('#btnAdminTogglePacks');
    if (btnAdminTogglePacks) btnAdminTogglePacks.onclick = () => this.adminToggleAllPacks();
    const btnAdminAddRP = $('#btnAdminAddRP');
    if (btnAdminAddRP) btnAdminAddRP.onclick = () => this.adminAddRP(10000);
    const btnAdminToggleTimer = $('#btnAdminToggleTimer');
    if (btnAdminToggleTimer) btnAdminToggleTimer.onclick = () => this.adminToggleTimer();
    const btnAdminRevive = $('#btnAdminRevive');
    if (btnAdminRevive) btnAdminRevive.onclick = () => this.adminReviveAll();
    const btnAdminPrestige = $('#btnAdminPrestige');
    if (btnAdminPrestige) btnAdminPrestige.onclick = () => this.adminPromoteCurrentGame();
    const btnAdminUnlockWorld = $('#btnAdminUnlockWorld');
    if (btnAdminUnlockWorld) btnAdminUnlockWorld.onclick = () => this.adminToggleWorld1();

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
        const unlocked = this.getUnlockedIndices();
        this.openShareModal({
          type: 'standard',
          score: store.meta.global,
          cycle: store.meta.cycle,
          unlockedCount: unlocked.length,
          games: unlocked.map((idx) => {
            const g = GAMES[idx];
            return {
              icon: g.meta.icon,
              title: g.meta.title,
              state: store.isEliminated(g.meta.id) ? 'eliminated' : 'alive',
            };
          }),
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

    const btnLike = $('#btnLike');
    if (btnLike) {
      btnLike.onclick = () => {
        if (!this.game) return;
        const id = GAMES[this.index].meta.id;
        const liked = store.toggleLike(id);
        this.refreshLike();
        if (liked) {
          sounds.like();
          haptics.light();
        }
      };
    }

    // Keyboard shortcuts: 1..9, 0 to jump immediately to any game for testing
    // Note: When Motherload or Age of Beans is active (which use keys 1..3 for units/items),
    // require Shift+1..0 or clicking the top pips to jump, preventing key conflicts.
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if (!inInput && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        const modal = $('#adminModal');
        if (modal && !modal.classList.contains('hidden')) this.closeAdminModal();
        else this.enableAdminMode(true);
        return;
      }

      if (!inInput && this.adminMode && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        this.adminStepGame(e.key === ']' ? 1 : -1);
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (!$('#adminModal').classList.contains('hidden')) {
          this.closeAdminModal();
          return;
        } else if (this.mode === 'paused') {
          this.resume();
          return;
        } else if (this.mode === 'playing') {
          this.pause();
          return;
        } else if (!$('#packRevealModal').classList.contains('hidden')) {
          this.closePackRevealModal();
          return;
        } else if (!$('#questsModal')?.classList.contains('hidden')) {
          this.closeQuestsModal();
          return;
        } else if (!$('#packsModal').classList.contains('hidden')) {
          this.closePacksModal();
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
        } else if (!$('#worldMapOverlay')?.classList.contains('hidden') && this.mode === 'menu') {
          this.closeWorldMap();
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
    if (!mi) return;
    const html = [];
    for (const pack of GAME_PACKS) {
      if (!pack.comingSoon && store.isPackUnlocked(pack.id)) {
        for (const gid of pack.gameIds) {
          const i = GAMES.findIndex((g) => g.meta.id === gid);
          if (i === -1) continue;
          const g = GAMES[i];
          html.push(`<span data-i="${i}" title="Play Game ${i + 1}: ${g.meta.title}">${g.meta.icon}</span>`);
        }
      } else {
        const badge = pack.comingSoon ? `⏳ PACK ${pack.packNumber}` : `🔒 PACK ${pack.packNumber}`;
        html.push(`<div class="pack-divider">${badge}</div>`);
        const count = pack.mysteryCount || 5;
        for (let k = 0; k < count; k++) {
          html.push(`<span class="mystery" data-pack="${pack.id}" title="${pack.comingSoon ? 'Coming Soon' : `Unlock at ${pack.unlockRequirement?.label}`}">❓</span>`);
        }
      }
    }
    mi.innerHTML = html.join('');
    mi.onclick = (e) => {
      const mystery = e.target.closest('.mystery');
      if (mystery) {
        mystery.classList.remove('shake');
        void mystery.offsetWidth;
        mystery.classList.add('shake');
        sounds.fail();
        haptics.light();
        this.openPacksModal();
        return;
      }
      const btn = e.target.closest('[data-i]');
      if (!btn) return;
      const targetIndex = Number(btn.dataset.i);
      if (Number.isNaN(targetIndex) || !this.isGameUnlocked(targetIndex)) return;
      store.data.started = true;
      this.jumpToGame(targetIndex);
    };
  }

  buildPips() {
    const pipsEl = $('#pips');
    if (!pipsEl) return;
    const unlocked = this.getUnlockedIndices();
    const parts = unlocked.map((idx, pos) => {
      const g = GAMES[idx];
      return `<div class="pip" data-i="${idx}" title="Game ${pos + 1}: ${g.meta.title}">${g.meta.icon}</div>`;
    });
    const nextLocked = store.getNextLockedPack();
    if (nextLocked && !nextLocked.comingSoon) {
      parts.push(`<div class="pip mystery" data-locked-pack="${nextLocked.id}" title="Mystery Pack ${nextLocked.packNumber} (${nextLocked.unlockRequirement?.label})">❓</div>`);
    }
    pipsEl.innerHTML = parts.join('');
    
    let isDragging = false;
    let hasDragged = false;
    let startX = 0;
    let scrollLeft = 0;

    pipsEl.onclick = (e) => {
      if (hasDragged) {
        hasDragged = false;
        return;
      }
      const lockedPip = e.target.closest('.pip.mystery');
      if (lockedPip) {
        const nextPack = store.getNextLockedPack();
        const prog = nextPack ? store.getPackProgress(nextPack) : null;
        this.banner('MYSTERY PACK LOCKED 🔒', prog ? `${prog.remaining.toLocaleString()} RP to unlock +5 new games` : 'Keep playing to unlock!', 'info');
        sounds.fail();
        haptics.light();
        return;
      }
      const pip = e.target.closest('.pip[data-i]');
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

  jumpToGame(i, adminBypass = false) {
    if (i < 0 || i >= GAMES.length) return;
    if (!adminBypass && !this.isGameUnlocked(i)) {
      this.banner('MYSTERY GAME LOCKED 🔒', 'Unlock this pack with Reel PTS first!', 'fail');
      sounds.fail();
      return;
    }
    if (!adminBypass && !this.isGameAlive(i)) {
      this.banner('GAME ELIMINATED! 💀', `${GAMES[i].meta.title} is excluded from this run`, 'fail');
      sounds.fail();
      return;
    }
    if (adminBypass && store.data.meta.eliminated) {
      delete store.data.meta.eliminated[GAMES[i].meta.id];
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
    $('#menu')?.classList.add('hidden');
    $('#worldMapOverlay')?.classList.add('hidden');
    $('#questsModal')?.classList.add('hidden');
    $('#summary')?.classList.add('hidden');
    $('#hud')?.classList.remove('hidden');
    this.stopHomeBeanPreview();
    this.worldMapScene?.stop();

    this.mode = 'playing';
    this.snap.style.display = 'none';
    this.input.reset();
    this.loadGame(i);
    this.presentRoundWrap();
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

    const res = store.meta.results || {};
    document.querySelectorAll('.pip[data-i]').forEach((el) => {
      const i = Number(el.dataset.i);
      const id = GAMES[i]?.meta.id;
      const isElim = !this.isGameAlive(i) || res[id] === 'eliminated';
      el.className = 'pip';
      if (isElim) {
        el.classList.add('eliminated');
      } else if (res[id] === 'survived') {
        el.classList.add('survived');
      }
      if (store.getPrestige(id) > 1) {
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
    const btn = $('#btnLike');
    if (!btn) return;
    const meta = GAMES[this.index].meta;
    btn.classList.toggle('liked', store.isLiked(meta.id));
    const n = store.likeCount(meta.id, meta.baseLikes);
    const cnt = $('#likeCount');
    if (cnt) cnt.textContent = n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  }

  banner(title, sub, kind) {
    const b = $('#banner');
    b.className = 'banner';
    void b.offsetWidth;
    b.querySelector('.banner-title').textContent = title;
    b.querySelector('.banner-sub').textContent = sub || '';
    b.classList.add('show', kind);
  }

  presentRoundWrap() {
    const wrap = this._pendingWrap;
    this._pendingWrap = null;
    if (!wrap) return false;

    const el = $('#cueFlash');
    if (!el) return false;

    const pillEl = $('#riwPill');
    const gameEl = $('#riwGame');
    const cueEl = $('#riwCue');
    const subEl = $('#riwSub');
    const deltasEl = $('#riwDeltas');

    const isPrestigeUp = wrap.prestige > 1;
    el.className = 'cue-flash';
    if (isPrestigeUp) el.classList.add('is-prestige-up');
    if (wrap.prestige >= 5) el.classList.add('tier-5');
    else if (wrap.prestige >= 3) el.classList.add('tier-3');

    if (pillEl) {
      if (this.runType === 'daily') {
        pillEl.textContent = `DAILY STAGE ${this.dailyStageIndex + 1}/10 · PRESTIGE 1`;
      } else if (isPrestigeUp) {
        pillEl.textContent = `★ PRESTIGE ${wrap.prestige} · HARDER`;
      } else if (wrap.stageLabel) {
        pillEl.textContent = `PRESTIGE 1 · ${wrap.stageLabel}`;
      } else {
        pillEl.textContent = 'PRESTIGE 1 · FIRST PLAY';
      }
    }

    if (gameEl) {
      gameEl.textContent = `${wrap.icon} ${wrap.title}`;
    }

    if (cueEl) {
      cueEl.textContent = isPrestigeUp ? wrap.prestigeCue : wrap.cue;
    }

    if (subEl) {
      if (wrap.restoredLabel) {
        subEl.textContent = `⟲ Resuming: ${wrap.restoredLabel}`;
      } else if (!isPrestigeUp && wrap.hint) {
        subEl.textContent = wrap.hint;
      } else {
        subEl.textContent = '';
      }
    }

    if (deltasEl) {
      if (isPrestigeUp && wrap.deltas.length > 0) {
        deltasEl.innerHTML = wrap.deltas
          .slice(0, 3)
          .map((d) => `<span class="riw-delta-chip">${d}</span>`)
          .join('');
      } else {
        deltasEl.innerHTML = '';
      }
    }

    if (this.runType !== 'daily') {
      store.markSeenInRun(wrap.gameId);
    }

    void el.offsetWidth;
    el.classList.add('show');
    return true;
  }

  clearCueFlash() {
    this._pendingWrap = null;
    const el = $('#cueFlash');
    if (el) el.classList.remove('show');
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
    $('#dailyHudBadge')?.classList.add('hidden');
    $('#cycleLabel')?.classList.remove('hidden');
    this.buildPips();

    if (!cont) {
      store.reset();
      store.recordRunStart();
    }
    this.renderProfileUI();
    store.data.started = true;
    $('#menu')?.classList.add('hidden');
    $('#worldMapOverlay')?.classList.add('hidden');
    $('#questsModal')?.classList.add('hidden');
    $('#summary')?.classList.add('hidden');
    $('#dailySummaryModal')?.classList.add('hidden');
    this.stopHomeBeanPreview();
    this.worldMapScene?.stop();
    $('#hud')?.classList.remove('hidden');

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
    this.renderPips();
    store.save();
  }

  loadGame(i) {
    const G = GAMES[i];
    this.index = i;
    this.game = new G(this.ctx, W, H, this.env);
    // Prestige rank & resolved scaling must be injected BEFORE init()
    const prestige = this.runType === 'daily' ? 1 : store.getPrestige(G.meta.id);
    this.game.applyPrestige(prestige);
    const snap = store.get(G.meta.id);
    this.game.init(snap ? snap.state : null, snap ? snap.score : 0);
    // Ensure brief invulnerability while the round wrap pops in
    this.game.grace = Math.max(this.game.grace || 0, 1.0);
    this.restored = !!snap;
    this.roundStartScore = this.game.score;
    this.roundLen = Number(new URLSearchParams(location.search).get('t')) || 60;
    this.timeLeft = this.roundLen;
    this.lastSecs = -1;
    this.lastScoreShown = -1;
    this.stage.classList.remove('urgent');

    const infoTitle = $('#infoTitle');
    if (infoTitle) infoTitle.textContent = `${G.meta.icon}  ${G.meta.title}`;
    const hint = $('#infoHint');
    if (hint) {
      hint.textContent = G.meta.hint;
      hint.classList.remove('fade');
      clearTimeout(this.hintTimer);
      this.hintTimer = setTimeout(() => hint.classList.add('fade'), 4000);
    }
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
      const unlockedCount = this.getUnlockedIndices().length;
      if (this.runType === 'world') {
        const node = getWorldNodeById(this.activeWorldNodeId);
        $('#cycleLabel').textContent = `${node.code} · CYCLE ${store.meta.cycle} · ${aliveCount}/${unlockedCount} ACTIVE`;
      } else {
        $('#cycleLabel').textContent = `CYCLE ${store.meta.cycle} · ${aliveCount}/${unlockedCount} ACTIVE`;
      }
    }
    $('#welcome').classList.remove('show');

    const badge = $('#prestigeBadge');
    if (badge) {
      const icon = prestige >= 5 ? '👑' : '★';
      badge.textContent = `${icon} PRESTIGE ${prestige}`;
      badge.dataset.tier = prestige >= 5 ? '5' : prestige >= 3 ? '3' : prestige === 2 ? '2' : '1';
      badge.classList.remove('hidden');
      badge.classList.remove('pop');
      void badge.offsetWidth;
      badge.classList.add('pop');
    }
    this.refreshLike();

    const unlocked = this.getUnlockedIndices();
    const pos = unlocked.indexOf(i);
    const stageLabel = pos !== -1 ? `GAME ${pos + 1}/${unlocked.length}` : `GAME #${i + 1}`;
    this._pendingWrap = {
      gameId: G.meta.id,
      title: G.meta.title,
      icon: G.meta.icon,
      hint: G.meta.hint,
      cue: getGameCue(G.meta.id) || G.meta.title.toUpperCase(),
      prestigeCue: getGamePrestigeCue(G.meta.id),
      prestige,
      firstInRun: this.runType === 'daily' || !store.hasSeenInRun(G.meta.id),
      stageLabel,
      deltas: this.game.diffDeltas || [],
      restoredLabel: snap ? this.game.restoreLabel() : '',
    };

    store.meta.index = i;
    this.renderPips();
  }

  destroyGame() {
    if (this.game) this.game.destroy();
    this.game = null;
  }

  bank() {
    const liveRP = this.computeLiveRP();
    store.meta.global += liveRP;
    store.meta.cycleBase += liveRP;
    store.stats.lifetimeScore = (store.stats.lifetimeScore || 0) + liveRP;
    store.recordQuestProgress('runScore', store.meta.global);
    this.roundStartScore = this.game.score;
    this.handleUnlockedPacks();
  }

  onVictory(winReason) {
    this.clearCueFlash();
    const id = GAMES[this.index].meta.id;
    const completable = isPrestigeGame(id);
    const prestigeBefore = this.game.prestige || 1;
    const rp = this.computeFinalRoundRP({ won: true, prestige: prestigeBefore });

    let title = 'STAGE COMPLETED! ⭐';
    let sub = winReason || 'Stage cleared!';
    let rankNow = prestigeBefore;

    if (this.runType !== 'daily') {
      rankNow = store.promote(id, { clearState: completable });
      sub = `${winReason || 'Stage cleared!'} · PRESTIGE ${rankNow} NEXT`;
    }

    this.roundStartScore = this.game.score || 0;
    store.meta.global += rp;
    store.meta.cycleBase += rp;
    if (!completable && this.runType !== 'daily') {
      store.set(id, this.game.serialize(), this.game.score);
    }
    store.meta.results[id] = 'survived';
    store.recordStageVictory(id, this.game.score, rp);
    store.recordRunProgress(store.meta.cycle, store.meta.global);
    store.recordQuestProgress('stagesCleared', 1);
    store.recordQuestProgress('runScore', store.meta.global);
    if (this.runType !== 'daily') store.recordQuestProgress('prestige2', rankNow);
    this.handleUnlockedPacks();
    this.renderProfileUI();
    store.save();

    if (this.runType === 'daily') {
      this.dailyResults[this.dailyStageIndex] = 'survived';
      this.mode = 'secured';
      this.holdT = 1.0;
      this.banner(`STAGE ${this.dailyStageIndex + 1} CLEARED! ⭐`, `${GAMES[this.index].meta.title} (+${rp.toLocaleString()} PTS)`, 'ok');
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
    this.banner(title, `${sub} (+${rp.toLocaleString()} PTS)`, 'ok');
    this.flash('ok');
    sounds.survive();
    sounds.up();
    haptics.success();
    this.stage.classList.remove('urgent');
    this.renderPips();
  }

  onSurvive() {
    this.clearCueFlash();
    const id = GAMES[this.index].meta.id;
    const rp = this.computeFinalRoundRP({ survived: true });
    this.roundStartScore = this.game.score || 0;
    store.meta.global += rp;
    store.meta.cycleBase += rp;
    store.set(id, this.game.serialize(), this.game.score);
    let nextPrestige = 1;
    if (this.runType !== 'daily') {
      nextPrestige = store.promote(id, { clearState: false });
    }
    store.meta.results[id] = 'survived';
    store.recordRoundSurvive(id, this.game.score, rp);
    store.recordRunProgress(store.meta.cycle, store.meta.global);
    store.recordQuestProgress('timersSurvived', 1);
    store.recordQuestProgress('runScore', store.meta.global);
    if (this.runType !== 'daily') store.recordQuestProgress('prestige2', nextPrestige);
    this.handleUnlockedPacks();
    this.renderProfileUI();
    store.save();

    if (this.runType === 'daily') {
      this.dailyResults[this.dailyStageIndex] = 'survived';
      this.mode = 'secured';
      this.holdT = 1.0;
      this.banner(`STAGE ${this.dailyStageIndex + 1} SURVIVED! ✓`, `+${rp.toLocaleString()} PTS · NEXT GAME`, 'ok');
      this.flash('ok');
      sounds.survive();
      haptics.success();
      this.stage.classList.remove('urgent');
      this.renderPips();
      return;
    }

    this.mode = 'secured';
    this.holdT = 1.0;
    this.banner('60s SURVIVED! ✓', `+${rp.toLocaleString()} PTS · PRESTIGE ${nextPrestige} NEXT`, 'ok');
    this.flash('ok');
    sounds.survive();
    haptics.success();
    this.stage.classList.remove('urgent');
    this.renderPips();
  }

  onDeath() {
    this.clearCueFlash();
    const id = GAMES[this.index].meta.id;
    const rp = this.computeFinalRoundRP({ survived: false, won: false });
    this.roundStartScore = this.game.score || 0;
    store.meta.global += rp;
    store.meta.cycleBase += rp;
    store.eliminate(id);
    store.meta.results[id] = 'eliminated';
    store.recordRoundDeath(id, this.game.score, rp);
    store.recordRunProgress(store.meta.cycle, store.meta.global);
    store.recordQuestProgress('runScore', store.meta.global);
    this.handleUnlockedPacks();
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
    this.banner('GAME ELIMINATED! 💀', `${sub}+${rp.toLocaleString()} PTS · ${aliveLeft} Left`, 'fail');
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
      return;
    }

    if (this.pendingRevealQueue.length > 0) {
      this.openPackRevealModal(this.pendingRevealQueue[0], true);
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
    }
  }

  transitionTo(i, dur = 0.7) {
    this.clearCueFlash();
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
    const showedWrap = this.presentRoundWrap();
    if (this.restored && this.game) {
      if (!showedWrap) this.showWelcome(this.game.restoreLabel());
      sounds.welcome();
    }
    this.renderPips();
  }

  showRunOver() {
    this.mode = 'summary';
    this.destroyGame();

    const totalScore = store.meta.global;
    const cycles = store.meta.cycle;

    store.recordRunProgress(cycles, totalScore);
    const unlocked = this.getUnlockedIndices();
    const chipsEl = $('#sumChips');
    chipsEl.innerHTML = unlocked.map((i) => {
      const g = GAMES[i];
      return `<div class="chip eliminated" data-i="${i}" title="${g.meta.title} (Eliminated)">${g.meta.icon}</div>`;
    }).join('');
    chipsEl.onclick = null;

    const worldBox = $('#summaryWorldBox');
    const retryWorldBtn = $('#btnRetryWorldNode');
    const btnNext = $('#btnNext');
    const footEl = $('#sumFoot');

    if (this.runType === 'world') {
      const wRes = store.recordWorldRunResult(this.activeWorldNodeId, totalScore);
      this.handleUnlockedPacks();
      this.renderProfileUI();

      if (wRes.clearedNow) {
        sounds.survive();
        sounds.up();
        haptics.success();
        this.flash('ok');
      } else {
        sounds.fail();
        haptics.fail();
        this.flash('fail');
      }

      $('#sumEyebrow').textContent = wRes.clearedNow ? 'STAGE CLEARED! ⭐' : 'RUN ENDED';
      $('#sumTitle').textContent = `${wRes.node.code} · ${wRes.node.title}`;
      $('#sumMult').textContent = `×${this.getRunMultiplier().toFixed(2)}`;
      $('#sumSub').textContent = `Run Score: ${totalScore.toLocaleString()} PTS · Cycle ${cycles}`;

      if (worldBox) {
        worldBox.classList.remove('hidden');
        const setTxt = (sel, txt) => {
          const el = $(sel);
          if (el) el.textContent = txt;
        };
        setTxt('#swbNodeTitle', `${wRes.node.code} · ${wRes.node.title.toUpperCase()}`);
        setTxt('#swbNodeGoal', `${totalScore.toLocaleString()} / ${wRes.node.clearScore.toLocaleString()} PTS`);
        setTxt('#swbStars', `${'★'.repeat(wRes.starsEarned)}${'☆'.repeat(3 - wRes.starsEarned)}`);
        const fill = $('#swbBarFill');
        if (fill) fill.style.width = `${Math.min(100, Math.round((totalScore / Math.max(1, wRes.node.clearScore)) * 100))}%`;
        const bannerEl = $('#swbUnlockBanner');
        if (bannerEl) {
          if (wRes.nextUnlockedNode) {
            bannerEl.classList.remove('hidden');
            bannerEl.textContent = `🔓 ${wRes.nextUnlockedNode.code} ${wRes.nextUnlockedNode.title.toUpperCase()} (${wRes.nextUnlockedNode.gameIds.length} REELS) UNLOCKED! +${wRes.firstClearBonusRP.toLocaleString()} RP`;
          } else if (wRes.world2JustUnlocked) {
            bannerEl.classList.remove('hidden');
            bannerEl.textContent = `👑 WORLD 1 CONQUERED! +${wRes.firstClearBonusRP.toLocaleString()} BONUS RP!`;
          } else if (!wRes.clearedNow) {
            const need = Math.max(0, wRes.node.clearScore - totalScore);
            bannerEl.classList.remove('hidden');
            bannerEl.textContent = `Need ${need.toLocaleString()} more PTS in one run to unlock next node!`;
          } else {
            bannerEl.classList.add('hidden');
          }
        }
      }

      if (footEl) {
        footEl.textContent = wRes.clearedNow
          ? 'Awesome run! Head back to the World 1 Map to walk forward.'
          : 'Survive longer and build your Prestige multiplier to clear this node!';
      }

      btnNext.textContent = '🗺️ WORLD 1 MAP';
      btnNext.onclick = () => {
        $('#summary').classList.add('hidden');
        this.openWorldMap();
      };
      if (retryWorldBtn) {
        retryWorldBtn.classList.remove('hidden');
        retryWorldBtn.textContent = `🔄 RETRY ${wRes.node.code}`;
        retryWorldBtn.onclick = () => {
          $('#summary').classList.add('hidden');
          this.startWorldRun(wRes.node.id);
        };
      }
    } else {
      sounds.fail();
      haptics.fail();
      this.flash('fail');
      this.renderProfileUI();

      if (worldBox) worldBox.classList.add('hidden');
      if (retryWorldBtn) retryWorldBtn.classList.add('hidden');

      $('#sumEyebrow').textContent = 'GAUNTLET TERMINATED';
      $('#sumTitle').textContent = 'All Games Eliminated!';
      $('#sumMult').textContent = `CYCLE ${cycles}`;
      $('#sumSub').textContent = `Total Score: ${totalScore.toLocaleString()} PTS · All ${unlocked.length} active games succumbed!`;
      if (footEl) footEl.textContent = `All ${unlocked.length} active games succumbed to the gauntlet. Can you survive longer next run?`;

      btnNext.textContent = 'START NEW RUN 🔄';
      btnNext.onclick = () => {
        $('#summary').classList.add('hidden');
        this.startRun(false);
      };
    }

    this.renderPackUI();
    this.renderPlazaUI();
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
      if (this.runType === 'world') this.startWorldRun(this.activeWorldNodeId);
      else this.startRun(false);
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
    $('#settingsGameSub').textContent = `Time Remaining: ${secsLeft}s · Cycle ${store.meta.cycle} · Prestige ${this.game.prestige || 1}`;

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
    this.clearCueFlash();
    $('#settingsModal').classList.add('hidden');
    sounds.fail();
    haptics.medium();

    if (this.game) {
      store.recordRunProgress(store.meta.cycle, store.meta.global);
      this.renderProfileUI();
      this.destroyGame();
    }
    const wasWorld = this.runType === 'world';
    this.runType = 'standard';
    this.buildPips();

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
    this.stage.classList.remove('urgent');
    this.buildMenuIcons();
    this.renderProfileUI();
    this.renderPackUI();

    if (wasWorld) {
      this.openWorldMap();
    } else {
      $('#menu').classList.remove('hidden');
      $('#btnPlay')?.classList.remove('hidden');
      this.startHomeBeanPreview();
    }

    if (this.pendingRevealQueue.length > 0) {
      this.openPackRevealModal(this.pendingRevealQueue[0], false);
    }
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

    // Main menu top bar
    const menuAv = $('#menuPlayerAvatar');
    if (menuAv) {
      if (prof.avatar === '🫘') {
        if (!menuAv.querySelector('img')) {
          menuAv.innerHTML = '<img src="/assets/lobby/avatar-bean.png" alt="Bean Avatar" class="home-avatar-img" />';
        }
      } else {
        menuAv.textContent = prof.avatar;
      }
    }
    const menuName = $('#menuPlayerName');
    if (menuName) menuName.textContent = prof.name;
    const menuRank = $('#menuPlayerRankChip');
    if (menuRank) menuRank.textContent = rank.title.split(' ')[0];
    this.syncHomeHeroSkin();
    const unlockedCount = store.getUnlockedGameIds().length;
    const totalPlayable = store.getTotalPlayableGameCount();
    const rpVal = $('#menuRpVal');
    if (rpVal) rpVal.textContent = (stats.lifetimeScore || 0).toLocaleString();
    const gamesVal = $('#menuGamesVal');
    if (gamesVal) gamesVal.textContent = `${unlockedCount}/${totalPlayable}`;
    const menuMini = $('#menuPlayerMiniStats');
    if (menuMini) {
      menuMini.textContent = `${(stats.lifetimeScore || 0).toLocaleString()} RP · ${unlockedCount}/${totalPlayable} Games`;
    }

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

  /* ----------------------------------------------------------- hero lobby mascot & rules */
  openHowTo() {
    sounds.init();
    $('#howToModal')?.classList.remove('hidden');
    sounds.whoosh();
    haptics.light();
  }

  closeHowTo() {
    $('#howToModal')?.classList.add('hidden');
    sounds.whoosh();
  }

  triggerHomeBeanBounce() {
    sounds.init();
    sounds.bubble();
    haptics.light();
    this.plazaScene?.triggerBounce();
  }

  syncHomeHeroSkin() {
    this.renderPlazaUI();
    if (!$('#worldMapOverlay')?.classList.contains('hidden')) {
      this.renderWorldMapUI();
    }
  }

  startHomeBeanPreview() {
    this.plazaScene?.start();
    this.renderPlazaUI();
  }

  stopHomeBeanPreview() {
    this.plazaScene?.stop();
  }

  /* ----------------------------------------------------------- Toy Courtyard Plaza & World 1 Map */
  renderPlazaUI() {
    const starsEl = $('#menuStarsVal');
    if (starsEl) starsEl.textContent = `${store.getWorld1Stars()}/15`;

    const curNode = getWorldNodeById(store.worlds.selectedNodeId || '1-1');
    const subEl = $('#plazaWorldSub');
    if (subEl) subEl.textContent = `${curNode.code} · ${curNode.gameIds.length} REELS`;

    const w1BtnSub = $('#btnEnterWorld1Sub');
    if (w1BtnSub) w1BtnSub.textContent = `NEXT: ${curNode.code} ${curNode.title.toUpperCase()}`;

    const endSub = $('#btnEndlessSub');
    if (endSub) endSub.textContent = `${store.getUnlockedGameIds().length} REELS`;

    const dlyBadge = $('#plazaDailyBadge');
    if (dlyBadge) {
      const streak = store.daily.streak || 0;
      dlyBadge.textContent = streak > 0 ? `🔥${streak}` : '';
    }

    const qDot = $('#plazaQuestDot');
    if (qDot) {
      const readyCount = store.getClaimableQuestCount() + store.getClaimableChestCount();
      qDot.classList.toggle('hidden', readyCount === 0);
    }
  }

  openWorldMap() {
    sounds.init();
    sounds.whoosh();
    haptics.light();
    this.activeWorldNodeId = store.worlds.selectedNodeId || '1-1';
    $('#menu')?.classList.add('hidden');
    $('#summary')?.classList.add('hidden');
    $('#questsModal')?.classList.add('hidden');
    this.stopHomeBeanPreview();
    $('#worldMapOverlay')?.classList.remove('hidden');
    this.worldMapScene?.start();
    this.worldMapScene?.syncToSelected(false);
    this.renderWorldMapUI();
  }

  closeWorldMap(showPlaza = true) {
    this.worldMapScene?.stop();
    $('#worldMapOverlay')?.classList.add('hidden');
    if (showPlaza) {
      this.mode = 'menu';
      $('#menu')?.classList.remove('hidden');
      this.renderProfileUI();
      this.renderPackUI();
      this.startHomeBeanPreview();
      sounds.whoosh();
      if (this.pendingRevealQueue.length > 0) {
        this.openPackRevealModal(this.pendingRevealQueue[0], false);
      }
    }
  }

  selectWorldMapNode(nodeId) {
    const idx = WORLD_1_NODES.findIndex((n) => n.id === nodeId);
    if (idx === -1) return;
    if (!store.isNodeUnlocked(nodeId)) {
      const prev = WORLD_1_NODES[idx - 1];
      sounds.fail();
      haptics.medium();
      this.banner(
        `${WORLD_1_NODES[idx].code} LOCKED 🔒`,
        prev ? `Clear ${prev.code} (${prev.clearScore.toLocaleString()} PTS) to unlock!` : 'Keep playing!',
        'fail',
      );
      return;
    }
    this.activeWorldNodeId = nodeId;
    store.selectWorldNode(nodeId);
    this.worldMapScene?.walkToNode(nodeId);
    this.renderWorldMapUI();
    sounds.pop();
    haptics.light();
  }

  renderWorldMapUI() {
    const curNode = getWorldNodeById(this.activeWorldNodeId || store.worlds.selectedNodeId || '1-1');
    const curState = store.getNodeState(curNode.id);

    const setTxt = (sel, txt) => {
      const el = $(sel);
      if (el) el.textContent = txt;
    };
    setTxt('#wmReelsVal', `${curNode.gameIds.length}/20`);
    setTxt('#wmStarsVal', `${store.getWorld1Stars()}/15`);
    setTxt('#wmRpVal', (store.stats.lifetimeScore || 0).toLocaleString());
    setTxt('#wmBoostVal', `×${store.getQuestMultiplier().toFixed(1)}`);

    document.querySelectorAll('.wm-node-btn[data-node]').forEach((btn) => {
      const id = btn.dataset.node;
      const st = store.getNodeState(id);
      btn.classList.toggle('selected', id === curNode.id);
      btn.classList.toggle('cleared', !!st.cleared);
      btn.classList.toggle('locked', !st.unlocked);
      const starsEl = btn.querySelector('.wnt-stars');
      if (starsEl) {
        starsEl.textContent = st.unlocked ? `${'★'.repeat(st.stars)}${'☆'.repeat(3 - st.stars)}` : '🔒';
      }
    });

    setTxt('#wmPortalTag', store.worlds.world2Unlocked ? '✨ WORLD 2' : 'W2 SOON');

    const chestBtn = $('#btnWorldChest');
    const nextChest = store.getNextUnclaimedChest();
    if (chestBtn) {
      chestBtn.classList.toggle('ready', !!nextChest?.ready);
      setTxt('#wmChestIco', nextChest ? nextChest.icon : '👑');
      setTxt('#wmChestLbl', nextChest ? (nextChest.ready ? 'CLAIM!' : `${nextChest.starsReq}⭐`) : 'ALL ✓');
    }

    const wqDot = $('#worldQuestDot');
    if (wqDot) {
      const readyCount = store.getClaimableQuestCount() + store.getClaimableChestCount();
      wqDot.classList.toggle('hidden', readyCount === 0);
    }

    setTxt('#wmSelCode', curNode.code);
    setTxt('#wmSelTitle', curNode.title);
    setTxt('#wmSelReels', `${curNode.gameIds.length} REELS`);
    setTxt('#wmSelStars', `${'★'.repeat(curState.stars)}${'☆'.repeat(3 - curState.stars)}`);
    setTxt('#wmSelIcons', curNode.gameIds.map((gid) => GAME_BY_ID[gid]?.meta?.icon || '🎮').join(' '));
    setTxt(
      '#wmSelThresh',
      `1⭐ ${curNode.starScores[0].toLocaleString()} · 2⭐ ${curNode.starScores[1].toLocaleString()} · 3⭐ ${curNode.starScores[2].toLocaleString()}`,
    );
    setTxt('#wmSelBest', `BEST: ${curState.bestScore.toLocaleString()}`);
    setTxt('#btnPlayWorldNode', `PLAY ${curNode.code} ▶`);
  }

  handleWorldChestClick() {
    sounds.init();
    const nextChest = store.getNextUnclaimedChest();
    if (nextChest && nextChest.ready) {
      this.claimStarChestUI(nextChest.id);
      return;
    }
    this.openQuestsModal();
  }

  claimStarChestUI(chestId) {
    const res = store.claimStarChest(chestId);
    if (!res) {
      sounds.fail();
      return;
    }
    sounds.survive();
    sounds.up();
    haptics.success();
    this.banner(`${res.chest.title.toUpperCase()}! 🎁`, `+${res.chest.rewardRP.toLocaleString()} Bonus RP added to Vault!`, 'ok');
    this.handleUnlockedPacks();
    this.renderProfileUI();
    this.renderPackUI();
    this.renderPlazaUI();
    this.renderWorldMapUI();
    this.renderQuestsModal();
  }

  handleWorld2PortalClick() {
    sounds.init();
    if (store.worlds.world2Unlocked) {
      sounds.up();
      haptics.success();
      this.banner('WORLD 2 GATEWAY 🌀', 'World 1 conquered! Play Endless Mode & Pack 1 while World 2 arrives!', 'ok');
    } else {
      sounds.pop();
      haptics.light();
      this.banner('WORLD 2 PORTAL 🔒', 'Clear 1-5 Apex Spire (22,000 PTS) to awaken World 2!', 'info');
    }
  }

  openQuestsModal() {
    sounds.init();
    this.renderQuestsModal();
    $('#questsModal')?.classList.remove('hidden');
    sounds.whoosh();
    haptics.light();
  }

  closeQuestsModal() {
    $('#questsModal')?.classList.add('hidden');
    sounds.whoosh();
  }

  renderQuestsModal() {
    const setEyebrow = $('#questsSetEyebrow');
    if (setEyebrow) setEyebrow.textContent = `SET ${store.quests.setIndex || 1} · COMPLETE ALL 3 FOR +0.1×`;

    const boostVal = $('#questsBoostVal');
    if (boostVal) boostVal.textContent = `×${store.getQuestMultiplier().toFixed(1)}`;

    const starsCount = $('#questsStarsCount');
    if (starsCount) starsCount.textContent = `${store.getWorld1Stars()}/15 ⭐`;

    const listEl = $('#questsList');
    if (listEl) {
      const quests = store.getActiveQuests();
      listEl.innerHTML = quests.map((q) => {
        const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100));
        const btnLabel = q.claimed ? 'CLAIMED ✓' : q.ready ? `CLAIM +${q.rewardRP}` : `${q.progress}/${q.target}`;
        return `
          <div class="quest-row ${q.ready ? 'ready' : ''} ${q.claimed ? 'claimed' : ''}">
            <div class="qr-ico">${q.icon}</div>
            <div class="qr-body">
              <div class="qr-title">${q.title}</div>
              <div class="qr-desc">${q.desc}</div>
              <div class="qr-bar"><div class="qr-bar-fill" style="width:${pct}%"></div></div>
            </div>
            <button type="button" class="qr-btn ${q.ready ? 'claimable' : ''}" data-quest-slot="${q.slotIndex}">${btnLabel}</button>
          </div>`;
      }).join('');

      listEl.querySelectorAll('.qr-btn.claimable').forEach((btn) => {
        btn.onclick = () => {
          const res = store.claimQuest(Number(btn.dataset.questSlot));
          if (!res) return;
          sounds.survive();
          if (res.setCompleted) sounds.up();
          haptics.success();
          this.banner(
            res.setCompleted ? 'QUEST SET COMPLETE! ⚡' : 'QUEST CLAIMED! 📜',
            res.setCompleted
              ? `+${res.rewardRP} RP · Permanent Boost now ×${res.multiplier.toFixed(1)}!`
              : `+${res.rewardRP} RP earned!`,
            'ok',
          );
          this.handleUnlockedPacks();
          this.renderProfileUI();
          this.renderPackUI();
          this.renderPlazaUI();
          this.renderWorldMapUI();
          this.renderQuestsModal();
        };
      });
    }

    const chestsRow = $('#worldChestsRow');
    if (chestsRow) {
      const curStars = store.getWorld1Stars();
      chestsRow.innerHTML = WORLD_1_CHESTS.map((c) => {
        const claimed = store.isChestClaimed(c.id);
        const ready = !claimed && curStars >= c.starsReq;
        return `
          <button type="button" class="wc-card ${claimed ? 'claimed' : ready ? 'ready' : ''}" data-chest-id="${c.id}">
            <span class="wc-ico">${claimed ? '✅' : c.icon}</span>
            <span class="wc-req">${c.starsReq} ⭐</span>
            <span class="wc-rp">${claimed ? 'CLAIMED' : ready ? 'TAP CLAIM!' : `+${c.rewardRP.toLocaleString()} RP`}</span>
          </button>`;
      }).join('');

      chestsRow.querySelectorAll('.wc-card.ready').forEach((btn) => {
        btn.onclick = () => this.claimStarChestUI(btn.dataset.chestId);
      });
    }
  }

  startWorldRun(nodeId = this.activeWorldNodeId) {
    const node = getWorldNodeById(nodeId || store.worlds.selectedNodeId || '1-1');
    if (!store.isNodeUnlocked(node.id)) {
      this.selectWorldMapNode(node.id);
      return;
    }

    sounds.init();
    this.activeWorldNodeId = node.id;
    store.selectWorldNode(node.id);
    this.runType = 'world';
    $('#dailyHudBadge')?.classList.add('hidden');
    $('#cycleLabel')?.classList.remove('hidden');

    store.reset();
    store.recordRunStart();
    this.buildPips();
    this.renderProfileUI();
    store.data.started = true;

    $('#menu')?.classList.add('hidden');
    $('#worldMapOverlay')?.classList.add('hidden');
    $('#questsModal')?.classList.add('hidden');
    $('#summary')?.classList.add('hidden');
    $('#dailySummaryModal')?.classList.add('hidden');
    this.stopHomeBeanPreview();
    this.worldMapScene?.stop();
    $('#hud')?.classList.remove('hidden');

    const freshAlive = this.getAliveIndices();
    this.index = freshAlive[0] ?? 0;
    this.loadGame(this.index);
    this.mode = 'transition';
    this.transT = 0.45;
    this.snap.style.display = 'none';
    sounds.whoosh();
    this.renderPips();
    store.save();
  }

  /* ----------------------------------------------------------- daily challenge (TICKET-04) */
  setMenuMode(mode) {
    this.menuMode = mode;
    $('#tabModeStandard')?.classList.toggle('active', mode === 'standard');
    $('#tabModeDaily')?.classList.toggle('active', mode === 'daily');
    $('#standardMenuContent')?.classList.toggle('hidden', mode !== 'standard');
    $('#dailyMenuContent')?.classList.toggle('hidden', mode !== 'daily');
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

    // 10-Game Preview icons (drawn from STARTER_GAMES so daily runs never spoil mystery packs)
    const dailyIndices = getDailyGameIndices(STARTER_GAMES.length, 10, todayStr);
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
    this.dailyIndices = getDailyGameIndices(STARTER_GAMES.length, 10);
    this.dailyStageIndex = 0;
    this.dailyResults = new Array(10).fill(null);

    // Build pips for 10 daily games
    const pipsEl = $('#pips');
    if (pipsEl) {
      pipsEl.innerHTML = this.dailyIndices.map((gIdx, i) => `<div class="pip" data-i="${i}" title="Stage ${i + 1}: ${GAMES[gIdx].meta.title}">${GAMES[gIdx].meta.icon}</div>`).join('');
    }

    $('#menu')?.classList.add('hidden');
    $('#worldMapOverlay')?.classList.add('hidden');
    $('#questsModal')?.classList.add('hidden');
    $('#summary')?.classList.add('hidden');
    $('#dailySummaryModal')?.classList.add('hidden');
    this.stopHomeBeanPreview();
    this.worldMapScene?.stop();
    $('#hud')?.classList.remove('hidden');

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
    this.renderPips();
  }

  finishDailyRun(clearedAll) {
    this.mode = 'summary';
    this.destroyGame();

    const totalScore = store.meta.global;
    const res = store.recordDailyResult(totalScore);
    store.recordQuestProgress('dailyPlayed', 1);

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
    this.handleUnlockedPacks();
    this.renderDailyMenuUI();
    this.renderProfileUI();
    this.renderPlazaUI();
  }

  closeDailySummary() {
    $('#dailySummaryModal').classList.add('hidden');
    this.runType = 'standard';
    this.buildPips();
    $('#hud').classList.add('hidden');
    $('#menu').classList.remove('hidden');
    this.renderDailyMenuUI();
    this.renderProfileUI();
    this.renderPackUI();
    this.renderPlazaUI();
    this.startHomeBeanPreview();
    sounds.whoosh();
    if (this.pendingRevealQueue.length > 0) {
      this.openPackRevealModal(this.pendingRevealQueue[0], false);
    }
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
      const live = (this.mode === 'playing' || this.mode === 'paused') ? this.computeLiveRP() : 0;
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

  /* ----------------------------------------------------------- Pack Progression & Mystery Reveal */
  handleUnlockedPacks() {
    const newlyUnlocked = store.checkPackUnlocks();
    if (newlyUnlocked.length > 0) {
      for (const pack of newlyUnlocked) {
        if (!this.pendingRevealQueue.some((p) => p.id === pack.id)) {
          this.pendingRevealQueue.push(pack);
        }
      }
      this.buildMenuIcons();
      this.buildPips();
    }
    this.renderPackUI();
    return newlyUnlocked;
  }

  renderPackUI() {
    const unlockedCount = store.getUnlockedGameIds().length;
    const totalPlayable = store.getTotalPlayableGameCount();
    const tagline = $('#menuTagline');
    if (tagline) {
      tagline.innerHTML = unlockedCount > STARTER_GAMES.length
        ? `${unlockedCount} unlocked games · 60 seconds each.<br />Earn Reel Points to unlock even more mystery packs!`
        : `${STARTER_GAMES.length} starter games · 60 seconds each.<br />Earn Reel Points to unlock 5-game mystery packs!`;
    }

    const pending = store.getPendingRevealPacks();
    const dot = $('#menuPackDot');
    if (dot) dot.classList.toggle('hidden', pending.length === 0);

    const card = $('#packProgressCard');
    const sumBox = $('#summaryPackBox');
    const nextPack = store.getNextLockedPack();

    if (pending.length > 0) {
      const readyPack = pending[0];
      if (card) {
        card.classList.add('ready');
        card.classList.remove('hidden');
        const titleEl = $('#packCardTitle');
        const ptsEl = $('#packCardPts');
        const fillEl = $('#packCardBarFill');
        const pctEl = $('#packCardPct');
        if (titleEl) titleEl.textContent = `${readyPack.title.toUpperCase()} READY!`;
        if (ptsEl) ptsEl.textContent = 'TAP TO REVEAL ✨';
        if (fillEl) fillEl.style.width = '100%';
        if (pctEl) pctEl.textContent = '100%';
      }
      if (sumBox) {
        sumBox.classList.remove('hidden');
        const sTitle = $('#sumPackTitle');
        const sPts = $('#sumPackPts');
        const sFill = $('#sumPackBarFill');
        if (sTitle) sTitle.textContent = `🎁 ${readyPack.title.toUpperCase()} UNLOCKED!`;
        if (sPts) sPts.textContent = 'REVEAL IN MENU';
        if (sFill) sFill.style.width = '100%';
      }
    } else if (nextPack) {
      const prog = store.getPackProgress(nextPack);
      const pct = Math.round(prog.pct * 100);
      const rpStr = `${prog.current.toLocaleString()} / ${prog.target.toLocaleString()} RP`;
      if (card) {
        card.classList.remove('ready');
        card.classList.remove('hidden');
        const titleEl = $('#packCardTitle');
        const ptsEl = $('#packCardPts');
        const fillEl = $('#packCardBarFill');
        const pctEl = $('#packCardPct');
        if (titleEl) titleEl.textContent = nextPack.comingSoon ? `${nextPack.title.toUpperCase()} (SOON)` : nextPack.title.toUpperCase();
        if (ptsEl) ptsEl.textContent = rpStr;
        if (fillEl) fillEl.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${pct}%`;
      }
      if (sumBox) {
        sumBox.classList.remove('hidden');
        const sTitle = $('#sumPackTitle');
        const sPts = $('#sumPackPts');
        const sFill = $('#sumPackBarFill');
        if (sTitle) sTitle.textContent = nextPack.comingSoon ? `⏳ ${nextPack.title.toUpperCase()}` : `🔒 ${nextPack.title.toUpperCase()}`;
        if (sPts) sPts.textContent = rpStr;
        if (sFill) sFill.style.width = `${pct}%`;
      }
    } else {
      if (card) {
        card.classList.remove('ready');
        const titleEl = $('#packCardTitle');
        const ptsEl = $('#packCardPts');
        const fillEl = $('#packCardBarFill');
        const pctEl = $('#packCardPct');
        if (titleEl) titleEl.textContent = 'ALL UNLOCKED';
        if (ptsEl) ptsEl.textContent = `${unlockedCount}/${totalPlayable} GAMES`;
        if (fillEl) fillEl.style.width = '100%';
        if (pctEl) pctEl.textContent = '100%';
      }
      if (sumBox) sumBox.classList.add('hidden');
    }

    if (!$('#packsModal')?.classList.contains('hidden')) {
      this.renderPacksModal();
    }
  }

  openPacksModal() {
    sounds.init();
    this.renderPacksModal();
    $('#packsModal').classList.remove('hidden');
    sounds.whoosh();
    haptics.light();
  }

  closePacksModal() {
    $('#packsModal').classList.add('hidden');
    sounds.whoosh();
  }

  renderPacksModal() {
    const lifetime = store.stats.lifetimeScore || 0;
    const unlockedCount = store.getUnlockedGameIds().length;
    const totalPlayable = store.getTotalPlayableGameCount();
    const pill = $('#packsBalancePill');
    if (pill) {
      pill.textContent = `🌟 ${lifetime.toLocaleString()} REEL PTS · ${unlockedCount}/${totalPlayable} GAMES UNLOCKED`;
    }

    const list = $('#packsList');
    if (!list) return;
    list.innerHTML = GAME_PACKS.map((pack) => {
      const prog = store.getPackProgress(pack);
      const isUnlocked = !pack.comingSoon && store.isPackUnlocked(pack.id);
      const isRevealed = isUnlocked && store.isPackRevealed(pack.id);
      const statusText = pack.comingSoon
        ? 'COMING SOON'
        : (isUnlocked ? (isRevealed ? 'UNLOCKED ✓' : 'READY TO REVEAL 🎁') : `🔒 ${prog.target.toLocaleString()} RP`);

      const chipsHtml = pack.gameIds.map((gid) => {
        const g = GAME_BY_ID[gid];
        if (!isUnlocked || !isRevealed || !g) {
          return '<span class="pvi-chip mystery" title="Mystery Game">❓ Mystery</span>';
        }
        return `<button type="button" class="pvi-chip" data-pack-gid="${gid}" title="Play ${g.meta.title}">${g.meta.icon} ${g.meta.title}</button>`;
      }).join('');

      const barHtml = pack.unlockRequirement
        ? `<div class="pack-bar-bg"><div class="pack-bar-fill" style="width:${Math.round(prog.pct * 100)}%"></div></div>`
        : '';

      const actionBtn = isUnlocked && !isRevealed
        ? `<button type="button" class="btn pack-reveal-inline-btn" data-reveal-pack="${pack.id}">REVEAL PACK ✨</button>`
        : '';

      return `
        <div class="pack-vault-item ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="pvi-head">
            <div class="pvi-title">${pack.title}</div>
            <div class="pvi-status">${statusText}</div>
          </div>
          <div class="pvi-desc">${pack.subtitle || pack.desc || ''}</div>
          ${barHtml}
          <div class="pvi-icons">${chipsHtml}</div>
          ${actionBtn}
        </div>`;
    }).join('');

    list.querySelectorAll('[data-pack-gid]').forEach((btn) => {
      btn.onclick = () => {
        const gid = btn.dataset.packGid;
        const idx = GAMES.findIndex((g) => g.meta.id === gid);
        if (idx !== -1 && this.isGameUnlocked(idx)) {
          this.closePacksModal();
          this.jumpToGame(idx);
        }
      };
    });

    list.querySelectorAll('[data-reveal-pack]').forEach((btn) => {
      btn.onclick = () => {
        const pack = GAME_PACKS.find((p) => p.id === btn.dataset.revealPack);
        if (pack) {
          this.closePacksModal();
          this.openPackRevealModal(pack, false);
        }
      };
    });
  }

  openPackRevealModal(pack, resumeAdvance = false) {
    if (!pack) return;
    this.activeRevealPack = pack;
    this.revealedCardIndices = new Set();
    this._resumeAdvanceAfterReveal = Boolean(resumeAdvance);

    const eye = $('#packRevealEyebrow');
    const title = $('#packRevealTitle');
    const sub = $('#packRevealSub');
    if (eye) eye.textContent = 'MYSTERY PACK UNLOCKED!';
    if (title) title.textContent = pack.title.toUpperCase();
    if (sub) sub.textContent = `Tap each mystery card to reveal your ${pack.gameIds.length} new reel games!`;

    this.renderPackRevealGrid();
    $('#packRevealModal').classList.remove('hidden');
    sounds.up();
    haptics.success();
  }

  renderPackRevealGrid() {
    const pack = this.activeRevealPack;
    if (!pack) return;
    const grid = $('#packRevealGrid');
    if (!grid) return;

    grid.innerHTML = pack.gameIds.map((gid, idx) => {
      const g = GAME_BY_ID[gid];
      const shown = this.revealedCardIndices.has(idx);
      if (shown && g) {
        return `
          <div class="mystery-reveal-card revealed" data-card-idx="${idx}">
            <div class="mrc-icon">${g.meta.icon}</div>
            <div class="mrc-title">${g.meta.title}</div>
            <div class="mrc-sub">${g.meta.hint || 'Added to your Reel!'}</div>
          </div>`;
      }
      return `
        <button type="button" class="mystery-reveal-card" data-card-idx="${idx}">
          <div class="mrc-icon">❓</div>
          <div class="mrc-title">MYSTERY #${idx + 1}</div>
          <div class="mrc-sub">Tap to reveal</div>
        </button>`;
    }).join('');

    grid.querySelectorAll('[data-card-idx]').forEach((cardEl) => {
      cardEl.onclick = () => {
        const idx = Number(cardEl.dataset.cardIdx);
        if (!this.revealedCardIndices.has(idx)) {
          this.revealedCardIndices.add(idx);
          sounds.pop();
          haptics.medium();
          if (this.revealedCardIndices.size >= pack.gameIds.length) {
            sounds.up();
            haptics.success();
          }
          this.renderPackRevealGrid();
        }
      };
    });

    const btn = $('#btnPackRevealAction');
    if (btn) {
      const allRevealed = this.revealedCardIndices.size >= pack.gameIds.length;
      btn.textContent = allRevealed ? 'ADD TO REEL & PLAY ▶' : 'REVEAL ALL ✨';
    }
  }

  handlePackRevealAction() {
    const pack = this.activeRevealPack;
    if (!pack) {
      this.closePackRevealModal();
      return;
    }
    if (this.revealedCardIndices.size < pack.gameIds.length) {
      pack.gameIds.forEach((_, idx) => this.revealedCardIndices.add(idx));
      sounds.up();
      haptics.success();
      this.renderPackRevealGrid();
      return;
    }
    this.closePackRevealModal();
  }

  closePackRevealModal() {
    const pack = this.activeRevealPack;
    if (pack) {
      store.markPackRevealed(pack.id);
      this.pendingRevealQueue = this.pendingRevealQueue.filter((p) => p.id !== pack.id);
    }
    this.activeRevealPack = null;
    this.revealedCardIndices.clear();
    this.buildMenuIcons();
    this.buildPips();
    this.renderPackUI();
    this.renderProfileUI();

    if (this.pendingRevealQueue.length > 0) {
      this.openPackRevealModal(this.pendingRevealQueue[0], this._resumeAdvanceAfterReveal);
      return;
    }

    $('#packRevealModal').classList.add('hidden');
    sounds.whoosh();

    if (this._resumeAdvanceAfterReveal) {
      this._resumeAdvanceAfterReveal = false;
      this.advance();
    }
  }

  /* --------------------------------------------------- Admin Playtester Mode */
  syncAdminUI() {
    const dock = $('#adminDock');
    const settingsBtn = $('#btnOpenAdminFromSettings');
    if (dock) dock.classList.toggle('hidden', !this.adminMode);
    if (settingsBtn) settingsBtn.classList.toggle('hidden', !this.adminMode);
  }

  enableAdminMode(openNow = true) {
    this.adminMode = true;
    sessionStorage.setItem('gr_admin', '1');
    this.syncAdminUI();
    sounds.up();
    haptics.success();
    if (openNow) this.openAdminModal();
  }

  openAdminModal() {
    if (!this.adminMode) {
      this.adminMode = true;
      sessionStorage.setItem('gr_admin', '1');
      this.syncAdminUI();
    }
    if (this.mode === 'playing') {
      this._pausedByAdmin = true;
      this.mode = 'paused';
    }
    this.renderAdminModal();
    $('#adminModal').classList.remove('hidden');
    sounds.whoosh();
  }

  closeAdminModal() {
    $('#adminModal').classList.add('hidden');
    sounds.whoosh();
    if (this._pausedByAdmin) {
      this._pausedByAdmin = false;
      if (this.mode === 'paused') {
        this.mode = 'playing';
        this.last = performance.now();
      }
    }
  }

  adminLaunchGame(i) {
    if (i < 0 || i >= GAMES.length) return;
    this._pausedByAdmin = false;
    $('#adminModal').classList.add('hidden');
    $('#packsModal').classList.add('hidden');
    $('#settingsModal').classList.add('hidden');
    store.data.started = true;
    this.runType = 'standard';
    this.buildPips();
    this.jumpToGame(i, true);
    this.syncAdminUI();
  }

  adminStepGame(dir) {
    const nextIdx = (this.index + dir + GAMES.length) % GAMES.length;
    this.adminLaunchGame(nextIdx);
  }

  adminToggleAllPacks() {
    const allOpen = GAME_PACKS.filter((p) => !p.comingSoon).every((p) => store.isPackUnlocked(p.id));
    if (allOpen) store.adminResetPacks();
    else store.adminUnlockAllPacks();
    this.pendingRevealQueue = store.getPendingRevealPacks();
    this.buildMenuIcons();
    this.buildPips();
    this.renderPackUI();
    this.renderProfileUI();
    this.renderAdminModal();
    sounds.up();
    haptics.medium();
  }

  adminAddRP(delta = 10000) {
    const newly = store.adminAddRP(delta);
    if (newly.length > 0) this.pendingRevealQueue = store.getPendingRevealPacks();
    this.renderProfileUI();
    this.renderPackUI();
    this.buildMenuIcons();
    this.buildPips();
    this.renderAdminModal();
    sounds.like();
    haptics.medium();
  }

  adminToggleTimer() {
    this.roundLen = this.roundLen === 60 ? 10 : 60;
    if (this.game) this.timeLeft = Math.min(this.timeLeft, this.roundLen);
    this.renderAdminModal();
    sounds.pop();
  }

  adminReviveAll() {
    store.adminReviveAll();
    this.buildPips();
    this.renderAdminModal();
    sounds.survive();
    haptics.medium();
  }

  adminPromoteCurrentGame() {
    const G = GAMES[this.index] || GAMES[0];
    if (!G) return;
    const rankNow = store.promote(G.meta.id, { clearState: false });
    sounds.up();
    haptics.success();
    this.adminLaunchGame(this.index);
    this.banner(`PRESTIGE ${rankNow} TEST! ★`, `${G.meta.title} scaled to Prestige ${rankNow}`, 'ok');
  }

  adminToggleWorld1() {
    const allOpen = WORLD_1_NODES.every((n) => store.isNodeUnlocked(n.id));
    if (allOpen) {
      store.worlds.nodes = { '1-1': { unlocked: true, cleared: false, stars: 0, bestScore: 0 } };
      store.worlds.selectedNodeId = '1-1';
      store.worlds.world2Unlocked = false;
    } else {
      for (const n of WORLD_1_NODES) {
        const cur = store.worlds.nodes[n.id] || {};
        store.worlds.nodes[n.id] = {
          unlocked: true,
          cleared: n.id !== '1-5' ? true : !!cur.cleared,
          stars: n.id !== '1-5' ? Math.max(cur.stars || 0, 3) : (cur.stars || 0),
          bestScore: Math.max(cur.bestScore || 0, n.id !== '1-5' ? n.starScores[2] : 0),
        };
      }
    }
    store.save();
    this.renderPlazaUI();
    this.renderWorldMapUI();
    this.renderAdminModal();
    sounds.up();
    haptics.medium();
  }

  renderAdminModal() {
    const nowLabel = $('#adminNowLabel');
    const curGame = GAMES[this.index] || GAMES[0];
    if (nowLabel && curGame) {
      const pRank = store.getPrestige(curGame.meta.id);
      nowLabel.textContent = `#${String(this.index + 1).padStart(2, '0')} · ${curGame.meta.icon} ${curGame.meta.title} (P${pRank})`;
    }

    const btnPacks = $('#btnAdminTogglePacks');
    if (btnPacks) {
      const allOpen = GAME_PACKS.filter((p) => !p.comingSoon).every((p) => store.isPackUnlocked(p.id));
      btnPacks.textContent = allOpen ? '🔒 LOCK PACK 1' : `🔓 UNLOCK ALL (${GAMES.length})`;
    }

    const btnTimer = $('#btnAdminToggleTimer');
    if (btnTimer) btnTimer.textContent = `⏱️ TIMER: ${this.roundLen}s`;

    const btnWorld = $('#btnAdminUnlockWorld');
    if (btnWorld) {
      const allOpen = WORLD_1_NODES.every((n) => store.isNodeUnlocked(n.id));
      btnWorld.textContent = allOpen ? '🔒 RESET W1' : '🗺️ UNLOCK W1';
    }

    const listEl = $('#adminGameList');
    if (!listEl) return;

    listEl.innerHTML = GAME_PACKS.filter((p) => !p.comingSoon).map((pack) => {
      const packUnlocked = store.isPackUnlocked(pack.id);
      const rows = pack.gameIds.map((gid) => {
        const idx = GAMES.findIndex((g) => g.meta.id === gid);
        const G = GAMES[idx];
        if (!G) return '';
        const isCurrent = this.game && this.index === idx;
        const isElim = store.isEliminated(gid);
        const badges = [];
        badges.push(G.meta.isPrestige ? 'PRESTIGE' : 'ENDLESS');
        const pRank = store.getPrestige(gid);
        if (pRank > 1) badges.push(`P${pRank}`);
        if (!packUnlocked) badges.push('🔒');
        if (isElim) badges.push('💀');
        return `
          <button type="button" class="admin-game-row ${isCurrent ? 'current' : ''}" data-admin-idx="${idx}">
            <span class="agr-num">#${String(idx + 1).padStart(2, '0')}</span>
            <span class="agr-icon">${G.meta.icon}</span>
            <span class="agr-main">
              <span class="agr-title">${G.meta.title}</span>
              <span class="agr-hint">${G.meta.hint}</span>
            </span>
            <span class="agr-badge">${badges.join(' · ')}</span>
          </button>`;
      }).join('');

      return `
        <div class="admin-pack-group">
          <div class="admin-pack-head">${pack.title} · ${packUnlocked ? 'UNLOCKED' : 'LOCKED (ADMIN BYPASS)'}</div>
          ${rows}
        </div>`;
    }).join('');

    listEl.querySelectorAll('[data-admin-idx]').forEach((btn) => {
      btn.onclick = () => this.adminLaunchGame(Number(btn.dataset.adminIdx));
    });
  }
}

