import { sounds } from '../audio.js';
import { bgm } from '../bgm.js';
import { haptics } from '../haptics.js';
import { store, getRankTier, RANKS } from './store.js';
import { drawBean } from './bean.js';
import { renderSharePoster, shareCardFile, downloadCardPNG } from './shareCard.js';
import { setupNativeAndroidBridge } from './nativeAndroid.js';
import { PlazaScene, WorldMapScene, SummaryScene } from './worldMap.js';
import { StoryComicDeck, COMIC_COLLECTIBLES } from './storyComic.js';
import { Input } from './input.js';
import {
  GAMES,
  GAME_BY_ID,
  GAME_BANK,
  GAME_BANK_BY_ID,
  WORLD_1_NODES,
  QUEST_POOL,
  getWorldById,
  getWorldNodeById,
  getWorldTotalStars,
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

    // Toy Courtyard Plaza / World 1 Diorama
    this.homeBeanAnim = null;
    this.homeBeanT = 0;
    this.homeBeanBounce = 0;
    this.homeBeanSparkles = [];
    this.activeWorldNodeId = store.worlds.selectedNodeId || '1-1';
    this._pendingBossVictory = null;
    this._pendingBossUnlockModal = null;
    this._returnToComicsAfterComic = false;
    this.plazaScene = new PlazaScene($('#plazaCanvas'));
    this.worldMapScene = new WorldMapScene($('#worldMapCanvas'));
    this.summaryScene = new SummaryScene($('#summaryCanvas'));
    this.storyComic = new StoryComicDeck({
      onComplete: ({ completed, scope }) => {
        const returnToComics = this._returnToComicsAfterComic;
        this._returnToComicsAfterComic = false;
        if (scope === 'ending') {
          this.closeHowTo({ skipSound: true });
          if (completed || !returnToComics) {
            this.hideSummary();
            this.openWorldMap();
            if (this._pendingBossUnlockModal) {
              const unlockRes = this._pendingBossUnlockModal;
              this._pendingBossUnlockModal = null;
              this.openStageUnlockModal(unlockRes);
            }
          } else {
            this.openComicsModal({ skipMarkSeen: true });
          }
          return;
        }
        if (scope === 'pub_call' || scope === 'queen_40th' || scope === 'klarna_pizza' || scope === 'asbo_prep' || scope === 'karate_pickup') {
          this.closeHowTo({ skipSound: true });
          if (returnToComics) {
            this.openComicsModal({ skipMarkSeen: true });
          }
          return;
        }
        if (completed || scope === 'story') store.markStorySeen();
        this.closeHowTo({ skipSound: true });
        if (!completed && returnToComics) {
          this.openComicsModal({ skipMarkSeen: true });
        }
      },
    });

    // Run modes: 'standard' (Endless) | 'world' (World 1 Node) | 'bank' (Dev-only WIP Game Bank test)
    this.runType = 'standard';
    this.menuMode = 'standard';
    this.bankGame = null;
    this._bankSession = new Map();

    // Share Card (TICKET-05)
    this.currentShareOpts = null;
    this.shareToastTimer = null;

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
    this.renderPlazaUI();
    this.renderWorldMapUI();
    this.syncAdminUI();
    this.startHomeBeanPreview();
    setupNativeAndroidBridge(this);
    this.resize();
    bgm.setTheme('plaza');
    if (typeof window !== 'undefined') {
      const unlockBgm = () => bgm.unlockAndSync();
      window.addEventListener('pointerdown', unlockBgm, { once: true, capture: true });
      window.addEventListener('keydown', unlockBgm, { once: true, capture: true });
    }
    window.addEventListener('resize', () => this.resize());

    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    // Direct game launch via URL query parameter (adminMode can launch eliminated & WIP bank reels)
    const targetGame = params.get('game') || params.get('g');
    if (targetGame) {
      const idx = GAMES.findIndex((g, i) => g.meta.id === targetGame || String(i + 1) === targetGame || String(i) === targetGame);
      if (idx !== -1 && (this.isGameUnlocked(idx) || this.adminMode)) {
        if (store.data.meta.eliminated) {
          delete store.data.meta.eliminated[GAMES[idx].meta.id];
          store.save();
        }
        setTimeout(() => this.jumpToGame(idx, this.adminMode), 50);
      } else if (this.adminMode) {
        const bankGame = GAME_BANK_BY_ID[targetGame] || GAME_BANK.find((g) => g.meta.id === targetGame);
        if (bankGame) {
          setTimeout(() => this.adminLaunchBankGame(bankGame), 50);
        }
      }
    } else if (explicitAdmin) {
      setTimeout(() => this.openAdminModal(), 60);
    } else if (!store.hasSeenStory() || params.get('story') === '1') {
      setTimeout(() => this.openHowTo({ scope: 'story', lockUntilComplete: !store.hasSeenStory() }), 80);
    }
  }

  getCurrentGameClass() {
    return this.bankGame || GAMES[this.index] || null;
  }

  _getBankEntry(gameId) {
    if (!this._bankSession.has(gameId)) {
      this._bankSession.set(gameId, { prestige: 1, snap: null });
    }
    return this._bankSession.get(gameId);
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
    const cycle = store.meta.cycle || 1;
    return Math.min(3.0, 1 + 0.20 * (cycle - 1));
  }

  getPrestigeMultiplier(prestige = 1) {
    const p = Math.max(1, Number(prestige) || 1);
    return Math.min(1.5, 1 + 0.05 * (p - 1));
  }

  getRunMultiplier() {
    const questBoost = store.getQuestMultiplier();
    return this.getCycleMultiplier() * questBoost;
  }

  computeLiveRP() {
    const G = this.getCurrentGameClass();
    if (!this.game || !G) return 0;
    const rawDelta = Math.max(0, this.game.score - this.roundStartScore);
    const perfRP = this.toPerfRP(G.meta.id, rawDelta);
    const prestigeMult = this.getPrestigeMultiplier(this.game.prestige || 1);
    const runMult = this.runType === 'bank' ? 1 : this.getRunMultiplier();
    return Math.round(perfRP * prestigeMult * runMult);
  }

  computeFinalRoundRP({ survived = false, won = false, prestige = 1 } = {}) {
    const G = this.getCurrentGameClass();
    if (!G) return 0;
    const id = G.meta.id;
    const p = Math.max(1, Number(prestige) || 1);
    const rawDelta = Math.max(0, (this.game?.score || 0) - this.roundStartScore);
    const perfRP = this.toPerfRP(id, rawDelta) * this.getPrestigeMultiplier(p);
    const runMult = this.runType === 'bank' ? 1 : this.getRunMultiplier();
    if (!survived && !won) {
      return Math.round(perfRP * 0.5 * runMult);
    }
    const survivalBase = Math.min(1200, 500 + (p - 1) * 100);
    const victoryBonus = won ? Math.min(3500, 1500 + (p - 1) * 300) : 0;
    return Math.round((perfRP + survivalBase + victoryBonus) * runMult);
  }

  // Console/QA helper on window.__reel to grant RP during testing
  debugGrantRP(amount = 25000) {
    store.stats.lifetimeScore = (store.stats.lifetimeScore || 0) + Math.max(0, Math.round(amount));
    store.save();
    this.renderProfileUI();
    this.renderPlazaUI();
    this.renderWorldMapUI();
    return { lifetimeScore: store.stats.lifetimeScore };
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
    const btnPlazaWorld2 = $('#btnPlazaWorld2');
    if (btnPlazaWorld2) {
      btnPlazaWorld2.onclick = () => {
        this.plazaScene?.triggerWorld2Pulse();
        this.openWorld2SoonModal();
      };
    }
    const btnW2SoonClose = $('#btnWorld2SoonClose');
    if (btnW2SoonClose) btnW2SoonClose.onclick = () => this.closeWorld2SoonModal();
    const btnW2SoonDone = $('#btnWorld2SoonDone');
    if (btnW2SoonDone) btnW2SoonDone.onclick = () => this.closeWorld2SoonModal();
    const btnW2SoonGoW1 = $('#btnWorld2SoonGoW1');
    if (btnW2SoonGoW1) {
      btnW2SoonGoW1.onclick = () => {
        this.closeWorld2SoonModal();
        if (store.isEndlessUnlocked()) {
          this.startRun(false);
        } else {
          this.openWorldMap();
        }
      };
    }
    const world2SoonModal = $('#world2SoonModal');
    if (world2SoonModal) {
      world2SoonModal.addEventListener('click', (e) => {
        if (e.target === world2SoonModal) this.closeWorld2SoonModal();
      });
    }
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

    ['#btnOpenComicsPlaza', '#btnWorldOpenComics'].forEach((sel) => {
      const el = $(sel);
      if (el) el.onclick = () => this.openComicsModal();
    });
    const btnComicsClose = $('#btnComicsClose');
    if (btnComicsClose) btnComicsClose.onclick = () => this.closeComicsModal();
    const btnComicsDone = $('#btnComicsDone');
    if (btnComicsDone) btnComicsDone.onclick = () => this.closeComicsModal();
    const comicsModal = $('#comicsModal');
    if (comicsModal) {
      comicsModal.addEventListener('click', (e) => {
        if (e.target === comicsModal) this.closeComicsModal();
      });
    }

    const btnBackPlaza = $('#btnWorldBackPlaza');
    if (btnBackPlaza) btnBackPlaza.onclick = () => this.closeWorldMap();
    const btnWorldEndless = $('#btnWorldPlayEndless');
    if (btnWorldEndless) {
      btnWorldEndless.onclick = () => {
        if (!store.isEndlessUnlocked()) {
          this.openEndlessLockedModal();
          return;
        }
        this.closeWorldMap(false);
        this.startRun(false);
      };
    }
    const btnPlayNode = $('#btnPlayWorldNode');
    if (btnPlayNode) btnPlayNode.onclick = () => this.startWorldRun(this.activeWorldNodeId);
    const btnW2Portal = $('#btnWorld2Portal');
    if (btnW2Portal) btnW2Portal.onclick = () => this.handleWorld2PortalClick();

    const btnEndlessLockedClose = $('#btnEndlessLockedClose');
    if (btnEndlessLockedClose) btnEndlessLockedClose.onclick = () => this.closeEndlessLockedModal();
    const btnEndlessLockDone = $('#btnEndlessLockDone');
    if (btnEndlessLockDone) btnEndlessLockDone.onclick = () => this.closeEndlessLockedModal();
    const btnEndlessGoWorld1 = $('#btnEndlessGoWorld1');
    if (btnEndlessGoWorld1) {
      btnEndlessGoWorld1.onclick = () => {
        this.closeEndlessLockedModal();
        if (store.isNodeUnlocked('1-6')) {
          store.selectWorldNode('1-6');
          this.activeWorldNodeId = '1-6';
        }
        if ($('#worldMapOverlay')?.classList.contains('hidden')) {
          this.openWorldMap();
        } else {
          this.worldMapScene?.walkToNode(this.activeWorldNodeId || store.worlds.selectedNodeId || '1-1');
          this.renderWorldMapUI();
        }
      };
    }
    const endlessLockedModal = $('#endlessLockedModal');
    if (endlessLockedModal) {
      endlessLockedModal.addEventListener('click', (e) => {
        if (e.target === endlessLockedModal) this.closeEndlessLockedModal();
      });
    }

    const btnStageUnlockClose = $('#btnStageUnlockClose');
    if (btnStageUnlockClose) btnStageUnlockClose.onclick = () => this.closeStageUnlockModal();
    const btnStageUnlockStay = $('#btnStageUnlockStay');
    if (btnStageUnlockStay) btnStageUnlockStay.onclick = () => this.closeStageUnlockModal();
    const btnStageUnlockGoMap = $('#btnStageUnlockGoMap');
    if (btnStageUnlockGoMap) {
      btnStageUnlockGoMap.onclick = () => {
        this.closeStageUnlockModal({ skipSound: true });
        this.hideSummary();
        this.openWorldMap();
      };
    }
    const stageUnlockModal = $('#stageUnlockModal');
    if (stageUnlockModal) {
      stageUnlockModal.addEventListener('click', (e) => {
        if (e.target === stageUnlockModal) this.closeStageUnlockModal();
      });
    }

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
    if (btnHowTo) btnHowTo.onclick = () => this.openHowTo({ scope: 'howto', lockUntilComplete: false });
    const btnStoryFromSettings = $('#btnOpenStoryFromSettings');
    if (btnStoryFromSettings) {
      btnStoryFromSettings.onclick = () => {
        $('#settingsModal')?.classList.add('hidden');
        this.openHowTo({ scope: 'story', lockUntilComplete: false });
      };
    }
    const btnEndingFromSettings = $('#btnOpenEndingFromSettings');
    if (btnEndingFromSettings) {
      btnEndingFromSettings.onclick = () => {
        this._pendingBossUnlockModal = null;
        $('#settingsModal')?.classList.add('hidden');
        this.openEndingComic({ lockUntilComplete: false });
      };
    }

    const btnMute = $('#btnMute');
    const muteIco = $('#muteIco');
    if (btnMute) {
      btnMute.onclick = () => {
        sounds.setMuted(!sounds.muted);
        bgm.setMuted(sounds.muted);
        if (muteIco) muteIco.textContent = sounds.muted ? '🔇' : '🔊';
        if (!sounds.muted) {
          sounds.like();
          bgm.unlockAndSync();
        }
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
    const musicInput = $('#settingMusic');
    const musicVal = $('#settingMusicVal');
    const hapticsInput = $('#settingHaptics');
    const shakeInput = $('#settingShake');

    const s = store.settings;
    volInput.value = Math.round((s.sfxVolume ?? 0.8) * 100);
    volVal.textContent = `${volInput.value}%`;
    const mVol = s.musicVolume ?? 0.45;
    if (musicInput && musicVal) {
      musicInput.value = Math.round(mVol * 100);
      musicVal.textContent = `${musicInput.value}%`;
      musicInput.oninput = (e) => {
        const v = Number(e.target.value);
        musicVal.textContent = `${v}%`;
        const scaled = v / 100;
        store.updateSettings({ musicVolume: scaled });
        bgm.setVolume(scaled);
      };
    }
    hapticsInput.checked = s.hapticsEnabled !== false;
    shakeInput.checked = s.screenShakeEnabled !== false;
    sounds.setVolume(s.sfxVolume ?? 0.8);
    bgm.setVolume(mVol);
    bgm.setMuted(sounds.muted);
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

    // Top-right HUD stats shortcuts
    const btnRpPill = $('#btnRpPill');
    if (btnRpPill) btnRpPill.onclick = () => this.openQuestsModal();
    const btnGamesPill = $('#btnGamesPill');
    if (btnGamesPill) btnGamesPill.onclick = () => this.openProfile();

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
    const btnAdminEndingComic = $('#btnAdminEndingComic');
    if (btnAdminEndingComic) {
      btnAdminEndingComic.onclick = () => {
        this._pendingBossUnlockModal = null;
        this.closeAdminModal();
        this.openEndingComic({ lockUntilComplete: false });
      };
    }

    const summaryBeanBtn = $('#summaryBeanBtn');
    if (summaryBeanBtn) {
      summaryBeanBtn.onclick = () => {
        sounds.init();
        sounds.bubble();
        haptics.light();
        this.summaryScene?.triggerBounce();
      };
    }
    const btnSummaryPlaza = $('#btnSummaryPlaza');
    if (btnSummaryPlaza) {
      btnSummaryPlaza.onclick = () => {
        this.hideSummary();
        this._resetToMenuSurface();
        $('#menu')?.classList.remove('hidden');
        $('#btnPlay')?.classList.remove('hidden');
        this.startHomeBeanPreview();
        sounds.whoosh();
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
        } else if (!$('#endlessLockedModal')?.classList.contains('hidden')) {
          this.closeEndlessLockedModal();
          return;
        } else if (!$('#world2SoonModal')?.classList.contains('hidden')) {
          this.closeWorld2SoonModal();
          return;
        } else if (!$('#questsModal')?.classList.contains('hidden')) {
          this.closeQuestsModal();
          return;
        } else if (!$('#comicsModal')?.classList.contains('hidden')) {
          this.closeComicsModal();
          return;
        } else if (!$('#settingsModal').classList.contains('hidden')) {
          this.closeSettings();
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
      if (this.mode === 'menu' && !this.adminMode && !store.isEndlessUnlocked()) return;

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
    mi.innerHTML = GAMES.map((g, i) => (
      `<span data-i="${i}" title="Play Game ${i + 1}: ${g.meta.title}">${g.meta.icon}</span>`
    )).join('');
    mi.onclick = (e) => {
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
    pipsEl.innerHTML = unlocked.map((idx, pos) => {
      const g = GAMES[idx];
      return `<div class="pip" data-i="${idx}" title="Game ${pos + 1}: ${g.meta.title}">${g.meta.icon}</div>`;
    }).join('');
    
    let isDragging = false;
    let hasDragged = false;
    let startX = 0;
    let scrollLeft = 0;

    pipsEl.onclick = (e) => {
      if (hasDragged) {
        hasDragged = false;
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

  freezeAndDestroyCurrentGame() {
    if (!this.game) return;
    const currId = this.getCurrentGameClass()?.meta?.id;
    if (this.runType === 'bank') {
      if (currId && !(isPrestigeGame(currId) && this.game.won)) {
        this._getBankEntry(currId).snap = { state: this.game.serialize(), score: this.game.score };
      }
    } else {
      this.bank();
      if (currId && !(isPrestigeGame(currId) && this.game.won)) {
        store.set(currId, this.game.serialize(), this.game.score);
      }
    }
    this.destroyGame();
  }

  _preparePlayStage() {
    $('#menu')?.classList.add('hidden');
    $('#worldMapOverlay')?.classList.add('hidden');
    $('#questsModal')?.classList.add('hidden');
    this.hideSummary();
    $('#hud')?.classList.remove('hidden');
    this.stopHomeBeanPreview();
    this.worldMapScene?.stop();

    this.mode = 'playing';
    this.snap.style.display = 'none';
    this.input.reset();
  }

  jumpToGame(i, adminBypass = false) {
    if (i < 0 || i >= GAMES.length) return;
    if (!adminBypass && !this.isGameUnlocked(i)) {
      this.banner('REEL UNAVAILABLE 🔒', 'Choose an active reel for this mode!', 'fail');
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
    this.freezeAndDestroyCurrentGame();
    if (this.runType === 'bank') this.runType = 'standard';
    this.bankGame = null;

    this._preparePlayStage();
    this.loadGame(i);
    this.presentRoundWrap();
    sounds.whoosh();
    haptics.light();
    store.save();
  }

  renderPips() {
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
    const G = this.getCurrentGameClass();
    if (!btn || !G) return;
    const meta = G.meta;
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
    const gestureEl = $('#riwGesture');
    const subEl = $('#riwSub');
    const deltasEl = $('#riwDeltas');

    const isPrestigeUp = wrap.prestige > 1;
    el.className = 'cue-flash';
    if (isPrestigeUp) el.classList.add('is-prestige-up');
    if (wrap.prestige >= 5) el.classList.add('tier-5');
    else if (wrap.prestige >= 3) el.classList.add('tier-3');

    if (pillEl) {
      if (isPrestigeUp) {
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

    if (gestureEl) {
      if (!isPrestigeUp && wrap.hint) {
        const h = wrap.hint.toLowerCase();
        let g = '👆 TAP OR DRAG';
        if (h.includes('swipe')) g = '👆 SWIPE TO MOVE';
        else if (h.includes('draw')) g = '✏️ DRAW SHIELD LINE';
        else if (h.includes('drag') && h.includes('release')) g = '👆 DRAG & RELEASE';
        else if (h.includes('drag')) g = '👆 TOUCH & DRAG';
        else if (h.includes('hold')) g = '👆 HOLD & STEER';
        else if (h.includes('tap')) g = '👆 TAP TO ACT';
        gestureEl.textContent = g;
      } else {
        gestureEl.textContent = '';
      }
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

    if (this.runType !== 'bank') {
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
    if (!store.isEndlessUnlocked()) {
      this.openEndlessLockedModal();
      return;
    }
    sounds.init();
    this.runType = 'standard';
    this.bankGame = null;
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
    this.hideSummary();
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
    this.mountGameClass(GAMES[i], { index: i, isBank: false });
  }

  loadBankGame(G) {
    this.mountGameClass(G, { index: -1, isBank: true });
  }

  mountGameClass(G, { index = -1, isBank = false } = {}) {
    if (!G) return;
    this.index = isBank ? -1 : index;
    this.bankGame = isBank ? G : null;
    this.stage.dataset.game = G.meta.id;
    this.game = new G(this.ctx, W, H, this.env);

    const bankEntry = isBank ? this._getBankEntry(G.meta.id) : null;
    // Prestige rank & resolved scaling must be injected BEFORE init()
    const prestige = isBank ? bankEntry.prestige : store.getPrestige(G.meta.id);
    this.game.applyPrestige(prestige);
    const snap = isBank ? bankEntry.snap : store.get(G.meta.id);
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
    bgm.setDucked(false);
    bgm.setTheme(G.meta.id === 'citadel-siege' ? 'boss' : 'arcade', { prestige, urgent: false });

    const infoTitle = $('#infoTitle');
    if (infoTitle) infoTitle.textContent = `${G.meta.icon}  ${G.meta.title}`;
    const hint = $('#infoHint');
    if (hint) {
      hint.textContent = G.meta.hint;
      hint.classList.remove('fade');
      clearTimeout(this.hintTimer);
      this.hintTimer = setTimeout(() => hint.classList.add('fade'), 4000);
    }
    $('#cycleLabel').classList.remove('hidden');
    if (isBank) {
      $('#cycleLabel').textContent = '🧪 WIP GAME BANK · DEV ONLY';
    } else {
      const aliveCount = this.getAliveIndices().length;
      const unlockedCount = this.getUnlockedIndices().length;
      if (this.runType === 'world') {
        const node = getWorldNodeById(this.activeWorldNodeId);
        $('#cycleLabel').textContent = node.isBoss
          ? `${node.code} · BOSS FINALE`
          : `${node.code} · CYCLE ${store.meta.cycle} · ${aliveCount}/${unlockedCount} ACTIVE`;
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

    let stageLabel = `GAME #${index + 1}`;
    if (isBank) {
      const bankPos = GAME_BANK.indexOf(G);
      stageLabel = `WIP BANK ${bankPos >= 0 ? bankPos + 1 : 1}/${GAME_BANK.length}`;
    } else {
      const unlocked = this.getUnlockedIndices();
      const pos = unlocked.indexOf(index);
      const activeWorldNode = this.runType === 'world' ? getWorldNodeById(this.activeWorldNodeId) : null;
      stageLabel = activeWorldNode?.isBoss
        ? 'FINAL BOSS'
        : pos !== -1 ? `GAME ${pos + 1}/${unlocked.length}` : `GAME #${index + 1}`;
    }

    this._pendingWrap = {
      gameId: G.meta.id,
      title: G.meta.title,
      icon: G.meta.icon,
      hint: G.meta.hint,
      cue: getGameCue(G.meta.id) || G.meta.title.toUpperCase(),
      prestigeCue: getGamePrestigeCue(G.meta.id),
      prestige,
      firstInRun: isBank ? true : !store.hasSeenInRun(G.meta.id),
      stageLabel,
      deltas: this.game.diffDeltas || [],
      restoredLabel: snap ? this.game.restoreLabel() : '',
    };

    if (!isBank) store.meta.index = index;
    this.renderPips();
  }

  destroyGame() {
    if (this.game) this.game.destroy();
    this.game = null;
    if (this.stage) delete this.stage.dataset.game;
  }

  bank() {
    const liveRP = this.computeLiveRP();
    store.meta.global += liveRP;
    store.meta.cycleBase += liveRP;
    store.stats.lifetimeScore = (store.stats.lifetimeScore || 0) + liveRP;
    store.recordQuestProgress('runScore', store.meta.global);
    this.roundStartScore = this.game.score;
  }

  onVictory(winReason) {
    this.clearCueFlash();
    const G = this.getCurrentGameClass();
    if (!G) return;
    const id = G.meta.id;
    const completable = isPrestigeGame(id);
    const prestigeBefore = this.game.prestige || 1;
    const rp = this.computeFinalRoundRP({ won: true, prestige: prestigeBefore });

    this.roundStartScore = this.game.score || 0;
    let rankNow = prestigeBefore + 1;
    let title = 'STAGE COMPLETED! ⭐';
    let sub = `${winReason || 'Stage cleared!'} · PRESTIGE ${rankNow} NEXT`;

    if (this.runType === 'bank') {
      const entry = this._getBankEntry(id);
      entry.prestige += 1;
      rankNow = entry.prestige;
      entry.snap = completable ? null : { state: this.game.serialize(), score: this.game.score };
      title = 'WIP CLEAR! ⭐';
      sub = `${winReason || 'Stage cleared!'} · PRESTIGE ${rankNow} NEXT`;
    } else {
      rankNow = store.promote(id, { clearState: completable });
      sub = `${winReason || 'Stage cleared!'} · PRESTIGE ${rankNow} NEXT`;
      store.meta.global += rp;
      store.meta.cycleBase += rp;
      if (!completable) {
        store.set(id, this.game.serialize(), this.game.score);
      }
      store.meta.results[id] = 'survived';
      store.recordStageVictory(id, this.game.score, rp);
      store.recordRunProgress(store.meta.cycle, store.meta.global);
      store.recordQuestProgress('stagesCleared', 1);
      store.recordQuestProgress('runScore', store.meta.global);
      store.recordQuestProgress('prestige2', rankNow);
      this.renderProfileUI();
      store.save();

      const worldNode = this.runType === 'world' ? getWorldNodeById(this.activeWorldNodeId) : null;
      if (worldNode?.isBoss) {
        this._pendingBossVictory = {
          bossVictory: true,
          heartsRemaining: Math.max(1, Number(this.game?.hearts ?? 1)),
          maxHearts: Math.max(1, Number(this.game?.maxHearts ?? 5)),
        };
        title = 'BOSS VANQUISHED! 👑';
        sub = `${winReason || 'Citadel shattered!'} · WORLD 2 AWAITS`;
      }
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
    const G = this.getCurrentGameClass();
    if (!G) return;
    const id = G.meta.id;
    const rp = this.computeFinalRoundRP({ survived: true, prestige: this.game?.prestige || 1 });
    this.roundStartScore = this.game.score || 0;

    let nextPrestige = (this.game?.prestige || 1) + 1;
    if (this.runType === 'bank') {
      const entry = this._getBankEntry(id);
      entry.snap = { state: this.game.serialize(), score: this.game.score };
      entry.prestige += 1;
      nextPrestige = entry.prestige;
    } else {
      store.meta.global += rp;
      store.meta.cycleBase += rp;
      store.set(id, this.game.serialize(), this.game.score);
      nextPrestige = store.promote(id, { clearState: false });
      store.meta.results[id] = 'survived';
      store.recordRoundSurvive(id, this.game.score, rp);
      store.recordRunProgress(store.meta.cycle, store.meta.global);
      store.recordQuestProgress('timersSurvived', 1);
      store.recordQuestProgress('runScore', store.meta.global);
      store.recordQuestProgress('prestige2', nextPrestige);
      this.renderProfileUI();
      store.save();
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
    const G = this.getCurrentGameClass();
    if (!G) return;
    const id = G.meta.id;
    const rp = this.computeFinalRoundRP({ survived: false, won: false, prestige: this.game?.prestige || 1 });
    this.roundStartScore = this.game.score || 0;
    const sub = this.game.deathReason ? `${this.game.deathReason} · ` : '';

    if (this.runType === 'bank') {
      this._getBankEntry(id).snap = null;
      this.banner('WIP TEST KO! 💀', `${sub}+${rp.toLocaleString()} TEST PTS`, 'fail');
    } else {
      store.meta.global += rp;
      store.meta.cycleBase += rp;
      store.eliminate(id);
      store.meta.results[id] = 'eliminated';
      store.recordRoundDeath(id, this.game.score, rp);
      store.recordRunProgress(store.meta.cycle, store.meta.global);
      store.recordQuestProgress('runScore', store.meta.global);
      this.renderProfileUI();
      store.save();
      const aliveLeft = this.getAliveIndices().length;
      this.banner('GAME ELIMINATED! 💀', `${sub}+${rp.toLocaleString()} PTS · ${aliveLeft} Left`, 'fail');
    }

    this.mode = 'dying';
    this.holdT = 1.1;
    this.flash('fail');
    sounds.fail();
    haptics.fail();
    this.stage.classList.remove('urgent');
    this.renderPips();
  }

  advance() {
    if (this.runType === 'bank') {
      const bankG = this.bankGame;
      if (this.mode === 'secured' && bankG) {
        this.transitionToBankGame(bankG, 0.7);
      } else {
        this.exitBankTestToAdmin();
      }
      return;
    }

    if (this.runType === 'world' && this._pendingBossVictory) {
      const bossRes = this._pendingBossVictory;
      this._pendingBossVictory = null;
      this.showRunOver(bossRes);
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

  _transitionWithLoader(loaderFn, dur = 0.7) {
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
      loaderFn();
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

  transitionTo(i, dur = 0.7) {
    this._transitionWithLoader(() => this.loadGame(i), dur);
  }

  transitionToBankGame(G, dur = 0.7) {
    this._transitionWithLoader(() => this.loadBankGame(G), dur);
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

  hideSummary() {
    this.summaryScene?.stop();
    $('#summary')?.classList.add('hidden');
  }

  _renderSummaryStars(starsEarned = 0) {
    const el = $('#swbStars');
    if (!el) return;
    el.innerHTML = [0, 1, 2].map((idx) => {
      const lit = idx < starsEarned;
      const fill = lit ? '#facc15' : '#cbd5e1';
      const gloss = lit ? '#fef08a' : '#e2e8f0';
      return `<svg class="swc-star ${lit ? 'is-lit' : ''}" viewBox="0 0 32 32" aria-hidden="true">
        <polygon points="16,2 20.5,11 30.5,12.4 23.2,19.4 25,29.5 16,24.6 7,29.5 8.8,19.4 1.5,12.4 11.5,11" fill="${fill}" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
        <polygon points="16,4.8 18.8,11.6 11.6,13.1" fill="${gloss}"/>
      </svg>`;
    }).join('');
  }

  showRunOver(opts = {}) {
    this.mode = 'summary';
    this._pendingBossVictory = null;
    this.destroyGame();
    $('#hud')?.classList.add('hidden');
    this.stage?.classList.remove('urgent');

    const totalScore = store.meta.global;
    const cycles = store.meta.cycle;

    store.recordRunProgress(cycles, totalScore);

    const summaryEl = $('#summary');
    const starsEl = $('#swbStars');
    const worldBox = $('#summaryWorldBox');
    const btnNext = $('#btnNext');
    const plazaBtn = $('#btnSummaryPlaza');
    const scoreEl = $('#sumScore');
    if (scoreEl) scoreEl.textContent = totalScore.toLocaleString();

    const unlocked = this.getUnlockedIndices();
    let worldRes = null;
    if (this.runType === 'world') {
      const wRes = store.recordWorldRunResult(this.activeWorldNodeId, totalScore, opts);
      worldRes = wRes;
      this.renderProfileUI();

      if (wRes.clearedNow) {
        sounds.survive();
        sounds.up();
        haptics.success();
        this.flash('ok');
        bgm.setTheme('summary');
      } else {
        sounds.fail();
        haptics.fail();
        this.flash('fail');
        bgm.setTheme('plaza');
      }
      bgm.setDucked(false);

      summaryEl?.classList.toggle('is-cleared', Boolean(wRes.clearedNow));
      $('#sumEyebrow').textContent = `${wRes.node.code} · ${wRes.node.title}`;
      $('#sumTitle').textContent = wRes.clearedNow
        ? (wRes.node.isBoss ? 'BOSS CRUSHED!' : 'STAGE CLEARED!')
        : (wRes.node.isBoss ? 'SO CLOSE!' : 'RUN ENDED!');
      $('#sumSub').textContent = wRes.node.isBoss
        ? (wRes.clearedNow
          ? `${opts.heartsRemaining ?? 1}/${opts.maxHearts ?? 5} ♥ Remaining`
          : 'Defeat Lord Brim to clear!')
        : `Goal: ${wRes.node.clearScore.toLocaleString()} PTS`;

      starsEl?.classList.remove('hidden');
      this._renderSummaryStars(wRes.starsEarned);

      if (worldBox) {
        worldBox.classList.remove('hidden');
        const fill = $('#swbBarFill');
        if (fill) {
          fill.style.width = wRes.node.isBoss
            ? (wRes.clearedNow ? '100%' : '0%')
            : `${Math.min(100, Math.round((totalScore / Math.max(1, wRes.node.clearScore)) * 100))}%`;
        }
        const bannerEl = $('#swbUnlockBanner');
        if (bannerEl) {
          bannerEl.classList.remove('hidden');
          if (wRes.nextUnlockedNode) {
            bannerEl.textContent = `🔓 ${wRes.nextUnlockedNode.code} ${wRes.nextUnlockedNode.title.toUpperCase()} UNLOCKED!`;
          } else if (wRes.world2JustUnlocked || (wRes.node.isBoss && wRes.clearedNow)) {
            bannerEl.textContent = '👑 ENDLESS MODE UNLOCKED!';
          } else if (wRes.clearedNow) {
            bannerEl.textContent = '★ STAGE CLEARED! ★';
          } else if (wRes.node.isBoss) {
            bannerEl.textContent = "SMASH LORD BRIM'S CITADEL!";
          } else {
            const need = Math.max(0, wRes.node.clearScore - totalScore);
            bannerEl.textContent = `${need.toLocaleString()} PTS TO CLEAR`;
          }
        }
        const comicNoticeBtn = $('#sumComicNoticeBtn');
        if (comicNoticeBtn) {
          const unlockedComic = wRes.unlockedComicId
            ? COMIC_COLLECTIBLES.find((c) => c.id === wRes.unlockedComicId)
            : null;
          const showNotice = Boolean(unlockedComic && !store.collectibles.seenComics?.[unlockedComic.id]);
          comicNoticeBtn.classList.toggle('hidden', !showNotice);
          if (showNotice) {
            comicNoticeBtn.textContent = `📖 NEW COMIC: ${unlockedComic.issueNumber} — TAP TO READ!`;
            comicNoticeBtn.onclick = () => this.openComicById(unlockedComic.id, { returnToComics: false });
          } else {
            comicNoticeBtn.onclick = null;
          }
        }
      }

      btnNext.textContent = '🗺️ WORLD 1 MAP';
      btnNext.onclick = () => {
        this.hideSummary();
        this.openWorldMap();
      };
      plazaBtn?.classList.add('hidden');
    } else {
      sounds.fail();
      haptics.fail();
      this.flash('fail');
      this.renderProfileUI();

      summaryEl?.classList.remove('is-cleared');
      starsEl?.classList.add('hidden');
      if (worldBox) worldBox.classList.add('hidden');
      $('#sumComicNoticeBtn')?.classList.add('hidden');

      $('#sumEyebrow').textContent = 'ENDLESS GAUNTLET';
      $('#sumTitle').textContent = 'RUN COMPLETE!';
      $('#sumSub').textContent = `Cycle ${cycles} · ${unlocked.length} Reels`;

      btnNext.textContent = '▶ PLAY AGAIN';
      btnNext.onclick = () => {
        this.hideSummary();
        this.startRun(false);
      };
      plazaBtn?.classList.remove('hidden');
    }

    this.renderPlazaUI();
    summaryEl?.classList.remove('hidden');
    this.summaryScene?.start({
      cleared: Boolean(worldRes?.clearedNow),
      isBoss: Boolean(worldRes?.node?.isBoss),
      stars: worldRes?.starsEarned || 0,
    });
    this.lastScoreShown = -1;

    const isBossClear = this.runType === 'world' && Boolean(worldRes?.node?.isBoss && worldRes?.clearedNow);
    if (isBossClear) {
      this._pendingBossUnlockModal = (worldRes.world2JustUnlocked || worldRes.comicJustUnlocked) ? worldRes : null;
      this.openEndingComic({ lockUntilComplete: false });
    } else if (this.runType === 'world' && worldRes && (worldRes.nextUnlockedNode || worldRes.world2JustUnlocked || worldRes.comicJustUnlocked)) {
      this.openStageUnlockModal(worldRes);
    }
  }

  openStageUnlockModal(wRes) {
    const modal = $('#stageUnlockModal');
    if (!modal || !wRes) return;
    const setTxt = (sel, txt) => {
      const el = $(sel);
      if (el) el.textContent = txt;
    };
    const setHtml = (sel, html) => {
      const el = $(sel);
      if (el) el.innerHTML = html;
    };

    const onMapAlready = !$('#worldMapOverlay')?.classList.contains('hidden');
    const goMapBtn = $('#btnStageUnlockGoMap');
    const stayBtn = $('#btnStageUnlockStay');
    if (goMapBtn) goMapBtn.textContent = onMapAlready ? 'AWESOME! ✓' : '🗺️ OPEN WORLD 1 MAP ▶';
    if (stayBtn) {
      stayBtn.textContent = 'VIEW SUMMARY ✓';
      stayBtn.classList.toggle('hidden', onMapAlready);
    }

    const comic = wRes.unlockedComicId
      ? COMIC_COLLECTIBLES.find((c) => c.id === wRes.unlockedComicId)
      : null;

    if (wRes.nextUnlockedNode) {
      const next = wRes.nextUnlockedNode;
      const nextDesc = next.isBoss ? 'FINAL BOSS' : `${next.gameIds.length} Reels`;
      setTxt('#stageUnlockEyebrow', 'NEW STAGE UNLOCKED! 🔓');
      setTxt('#stageUnlockTitle', `${next.code} · ${next.title.toUpperCase()}`);
      setTxt('#stageUnlockMsg', `You crushed ${wRes.node.code} with ${wRes.score.toLocaleString()} PTS and unlocked ${next.code} on the World 1 Map!`);
      setTxt('#stageUnlockIcon', next.icon || '🗺️');
      setHtml('#stageUnlockReels', `<em>${next.subtitle || `${next.title} · ${nextDesc}`}</em> — ready to play!`);
      const bonusHtml = wRes.firstClearBonusRP > 0
        ? `<em>+${wRes.firstClearBonusRP.toLocaleString()} First-Clear Bonus RP</em> added to your rank!`
        : `<em>${'★'.repeat(wRes.starsEarned)} Earned</em> — head to the map to walk forward!`;
      const unlockComicNote = comic
        ? `<br/>📖 <em>${comic.issueNumber} "${comic.title}"</em> added to Comics Collectables!`
        : '';
      setHtml('#stageUnlockBonus', `${bonusHtml}${unlockComicNote}`);
    } else if (wRes.world2JustUnlocked) {
      setTxt('#stageUnlockEyebrow', 'LORD BRIM VANQUISHED! 👑');
      setTxt('#stageUnlockTitle', 'ENDLESS MODE UNLOCKED!');
      setTxt('#stageUnlockMsg', "You shattered Lord Brim's Citadel and rescued Queen Bean! Endless Mode across all 21 reels is now open.");
      setTxt('#stageUnlockIcon', '∞');
      setHtml('#stageUnlockReels', '<em>Endless Gauntlet Unlocked</em> — test how long you survive across all 21 reels!');
      setHtml(
        '#stageUnlockBonus',
        wRes.firstClearBonusRP > 0
          ? `<em>+${wRes.firstClearBonusRP.toLocaleString()} First-Clear Bonus RP</em> &amp; <strong>Issue #07 Ending Comic</strong> added to Collectables!`
          : '<em>World 1 Conquered!</em> Endless Mode &amp; Issue #07 Ending Comic unlocked in Collectables!',
      );
    } else if (comic) {
      setTxt('#stageUnlockEyebrow', 'NEW COMIC UNLOCKED! 📖');
      setTxt('#stageUnlockTitle', `${comic.issueNumber} · ${comic.title}`);
      setTxt('#stageUnlockMsg', `You cleared ${wRes.node.code} with ${wRes.score.toLocaleString()} PTS and unlocked a brand-new Collectables comic!`);
      setTxt('#stageUnlockIcon', '📖');
      setHtml('#stageUnlockReels', `<em>${comic.panelCountLabel}</em> — added to your Comics shelf!`);
      setHtml('#stageUnlockBonus', `<em>${'★'.repeat(Math.max(1, wRes.starsEarned))} Earned</em> on ${wRes.node.code} · ${wRes.node.title}!`);
    }

    const comicCard = $('#stageUnlockComicCard');
    if (comicCard) {
      comicCard.classList.toggle('hidden', !comic);
      if (comic) {
        const coverEl = $('#stageUnlockComicCover');
        if (coverEl) {
          coverEl.src = comic.cover;
          coverEl.alt = `${comic.issueNumber} cover`;
        }
        setTxt('#stageUnlockComicTitle', `${comic.issueNumber} · ${comic.title}`);
        setTxt('#stageUnlockComicDesc', comic.description);
        const readBtn = $('#btnStageUnlockReadComic');
        if (readBtn) {
          readBtn.onclick = () => {
            this.closeStageUnlockModal({ skipSound: true });
            this.openComicById(comic.id, { returnToComics: false });
          };
        }
      }
    }

    modal.classList.remove('hidden');
    if (comic) sounds.comicUnlock();
    else sounds.up();
    haptics.success();
  }

  closeStageUnlockModal({ skipSound = false } = {}) {
    $('#stageUnlockModal')?.classList.add('hidden');
    if (!skipSound) sounds.whoosh();
  }

  showSummary() {
    this.showRunOver();
  }

  nextCycle() {
    sounds.init();
    this.hideSummary();
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
    const G = this.getCurrentGameClass();
    if (!G) return;
    this.mode = 'paused';
    bgm.setDucked(true);
    sounds.whoosh();
    haptics.light();

    const banner = $('#settingsGameBanner');
    banner.classList.remove('hidden');
    $('#settingsGameIcon').textContent = G.meta.icon;
    $('#settingsGameTitle').textContent = G.meta.title;
    const secsLeft = Math.ceil(Math.max(0, this.timeLeft));
    const scopeLabel = this.runType === 'bank' ? 'WIP Game Bank' : `Cycle ${store.meta.cycle}`;
    $('#settingsGameSub').textContent = `Time Remaining: ${secsLeft}s · ${scopeLabel} · Prestige ${this.game.prestige || 1}`;

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
    bgm.setDucked(false);
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
    $('#settingEndingRow')?.classList.toggle('hidden', !(store.isComicUnlocked('ending_comic') || this.adminMode));
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

  _resetToMenuSurface() {
    this.snap.style.display = 'none';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.clearRect(0, 0, W, H);

    this.mode = 'menu';
    $('#hud').classList.add('hidden');
    $('#welcome').classList.remove('show');
    this.stage.classList.remove('urgent');
    bgm.setDucked(false);
    bgm.setTheme('plaza');
    this.buildMenuIcons();
    this.renderProfileUI();
  }

  exitBankTestToAdmin() {
    this.clearCueFlash();
    this.destroyGame();
    this.bankGame = null;
    this.runType = 'standard';
    this.buildPips();
    this._resetToMenuSurface();
    $('#menu')?.classList.remove('hidden');
    $('#btnPlay')?.classList.remove('hidden');
    this.startHomeBeanPreview();
    if (this.adminMode) this.openAdminModal();
  }

  abandonRun() {
    this.clearCueFlash();
    $('#settingsModal').classList.add('hidden');
    sounds.fail();
    haptics.medium();

    const prevRunType = this.runType;
    if (this.game) {
      if (prevRunType !== 'bank') {
        store.recordRunProgress(store.meta.cycle, store.meta.global);
        this.renderProfileUI();
      }
      this.destroyGame();
    }
    const wasWorld = prevRunType === 'world';
    this.bankGame = null;
    this.runType = 'standard';
    this.buildPips();

    // Terminate and clear active run session (keep saved runs intact when exiting dev Bank test)
    if (prevRunType !== 'bank') {
      store.abandonSession();
    }

    this._resetToMenuSurface();

    if (wasWorld) {
      this.openWorldMap();
    } else {
      $('#menu').classList.remove('hidden');
      $('#btnPlay')?.classList.remove('hidden');
      this.startHomeBeanPreview();
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
  }

  /* ----------------------------------------------------------- hero lobby mascot & comic story/rules */
  openHowTo({ scope = 'howto', lockUntilComplete = false } = {}) {
    sounds.init();
    this.storyComic.open({ scope, lockUntilComplete });
    sounds.whoosh();
    haptics.light();
  }

  openEndingComic({ lockUntilComplete = false } = {}) {
    sounds.init();
    store.markComicSeen('ending_comic');
    this.syncComicNotices();
    this.storyComic.open({ scope: 'ending', lockUntilComplete });
    sounds.whoosh();
    haptics.light();
  }

  openComicById(comicId, { returnToComics = false } = {}) {
    const comic = COMIC_COLLECTIBLES.find((c) => c.id === comicId);
    if (!comic) return;
    store.markComicSeen(comic.id);
    this.syncComicNotices();
    this._pendingBossUnlockModal = null;
    this._returnToComicsAfterComic = Boolean(returnToComics);
    if (comic.scope === 'ending') {
      this.openEndingComic({ lockUntilComplete: false });
    } else {
      this.openHowTo({ scope: comic.scope || 'story', lockUntilComplete: false });
    }
  }

  syncComicNotices() {
    const hasUnseen = store.hasUnseenComics();
    $('#plazaComicsDot')?.classList.toggle('hidden', !hasUnseen);
    $('#worldComicsDot')?.classList.toggle('hidden', !hasUnseen);
    if (!hasUnseen) {
      $('#sumComicNoticeBtn')?.classList.add('hidden');
    }
  }

  closeHowTo({ skipSound = false } = {}) {
    $('#howToModal')?.classList.add('hidden');
    if (!skipSound) sounds.whoosh();
  }

  handleHowToBack() {
    return this.storyComic?.handleBackAction() || false;
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
    if (starsEl) starsEl.textContent = `${store.getWorld1Stars()}/${getWorldTotalStars()}`;

    const curNode = getWorldNodeById(store.worlds.selectedNodeId || '1-1');
    const subEl = $('#plazaWorldSub');
    if (subEl) subEl.textContent = curNode.isBoss ? `${curNode.code} · FINAL BOSS` : `${curNode.code} · ${curNode.gameIds.length} REELS`;

    const w1BtnSub = $('#btnEnterWorld1Sub');
    if (w1BtnSub) w1BtnSub.textContent = curNode.isBoss ? `▶ BOSS · ${curNode.code}` : `▶ MAP · ${curNode.code}`;

    const endlessUnlocked = store.isEndlessUnlocked();
    const endlessBtn = $('#btnPlay');
    if (endlessBtn) {
      endlessBtn.classList.toggle('is-locked', !endlessUnlocked);
      endlessBtn.title = endlessUnlocked
        ? `Classic Endless Gauntlet across all ${GAMES.length} reels`
        : 'Play World 1 and defeat Lord Brim (1-6) to unlock Endless Mode!';
    }
    const endSub = $('#btnEndlessSub');
    if (endSub) {
      endSub.textContent = endlessUnlocked
        ? `${store.getUnlockedGameIds().length} REELS`
        : '🔒 BEAT LORD BRIM';
    }

    const qDot = $('#plazaQuestDot');
    if (qDot) {
      const readyCount = store.getClaimableQuestCount();
      qDot.classList.toggle('hidden', readyCount === 0);
    }

    this.syncComicNotices();
  }

  openWorldMap() {
    sounds.init();
    sounds.whoosh();
    haptics.light();
    bgm.setDucked(false);
    bgm.setTheme('plaza');
    this.activeWorldNodeId = store.worlds.selectedNodeId || '1-1';
    $('#menu')?.classList.add('hidden');
    this.hideSummary();
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
      this.startHomeBeanPreview();
      sounds.whoosh();
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
    setTxt('#wmReelsVal', curNode.isBoss ? 'BOSS 👑' : `${curNode.gameIds.length}/20`);
    setTxt('#wmStarsVal', `${store.getWorld1Stars()}/${getWorldTotalStars()}`);
    setTxt('#wmRpVal', (store.stats.lifetimeScore || 0).toLocaleString());
    setTxt('#wmBoostVal', `×${store.getQuestMultiplier().toFixed(1)}`);

    document.querySelectorAll('.wm-node-btn[data-node]').forEach((btn) => {
      const id = btn.dataset.node;
      const nodeMeta = getWorldNodeById(id);
      const st = store.getNodeState(id);
      btn.classList.toggle('selected', id === curNode.id);
      btn.classList.toggle('cleared', !!st.cleared);
      btn.classList.toggle('locked', !st.unlocked);
      const starsEl = btn.querySelector('.wnt-stars');
      if (starsEl) {
        starsEl.textContent = st.unlocked
          ? `${'★'.repeat(st.stars)}${'☆'.repeat(3 - st.stars)}`
          : (nodeMeta?.isBoss ? '👑🔒' : '🔒');
      }
    });

    setTxt('#wmPortalTag', store.worlds.world2Unlocked ? '✨ WORLD 2' : 'W2 SOON');

    const endlessUnlocked = store.isEndlessUnlocked();
    const wmEndlessBtn = $('#btnWorldPlayEndless');
    if (wmEndlessBtn) {
      wmEndlessBtn.classList.toggle('is-locked', !endlessUnlocked);
      wmEndlessBtn.title = endlessUnlocked
        ? `Play Endless Mode (${GAMES.length} Reels)`
        : 'Beat Lord Brim (1-6) to unlock Endless Mode!';
      const lbl = wmEndlessBtn.querySelector('span');
      if (lbl) lbl.textContent = endlessUnlocked ? 'Endless' : '🔒 Endless';
    }

    const wqDot = $('#worldQuestDot');
    if (wqDot) {
      const readyCount = store.getClaimableQuestCount();
      wqDot.classList.toggle('hidden', readyCount === 0);
    }

    this.syncComicNotices();

    setTxt('#wmSelCode', curNode.code);
    setTxt('#wmSelTitle', curNode.title);
    setTxt('#wmSelReels', curNode.isBoss ? 'FINAL BOSS' : `${curNode.gameIds.length} REELS`);
    $('#wmSelReels')?.classList.toggle('boss', !!curNode.isBoss);
    setTxt('#wmSelStars', `${'★'.repeat(curState.stars)}${'☆'.repeat(3 - curState.stars)}`);
    setTxt('#wmSelIcons', curNode.gameIds.map((gid) => GAME_BY_ID[gid]?.meta?.icon || '🎮').join(' '));
    setTxt(
      '#wmSelThresh',
      curNode.isBoss
        ? '1⭐ Defeat Brim · 2⭐ ≥3♥ Left · 3⭐ Full 5♥'
        : `1⭐ ${curNode.starScores[0].toLocaleString()} · 2⭐ ${curNode.starScores[1].toLocaleString()} · 3⭐ ${curNode.starScores[2].toLocaleString()}`,
    );
    setTxt('#wmSelBest', curNode.isBoss ? (curState.cleared ? 'STATUS: VANQUISHED ✓' : 'REWARD: WORLD 2 PORTAL') : `BEST: ${curState.bestScore.toLocaleString()}`);
    const playNodeBtn = $('#btnPlayWorldNode');
    if (playNodeBtn) {
      playNodeBtn.classList.toggle('boss', !!curNode.isBoss);
      playNodeBtn.textContent = curNode.isBoss ? `FIGHT ${curNode.code} ⚔️` : `PLAY ${curNode.code} ▶`;
    }
  }

  handleWorld2PortalClick() {
    sounds.init();
    if (store.worlds.world2Unlocked) {
      sounds.up();
      haptics.success();
      this.banner('WORLD 2 GATEWAY 🌀', `Lord Brim defeated! Endless Mode (${GAMES.length} Reels) is unlocked while World 2 arrives!`, 'ok');
    } else {
      sounds.pop();
      haptics.light();
      this.banner('WORLD 2 PORTAL 🔒', "Defeat 1-6 Lord Brim's Citadel to awaken World 2!", 'info');
    }
  }

  openEndlessLockedModal() {
    sounds.init();
    sounds.fail();
    haptics.medium();

    const bossOpen = store.isNodeUnlocked('1-6');
    const curNode = getWorldNodeById(store.worlds.selectedNodeId || '1-1');
    const titleEl = $('#endlessLockedTitle');
    const msgEl = $('#endlessLockStatus');
    const goBtn = $('#btnEndlessGoWorld1');

    if (bossOpen) {
      if (titleEl) titleEl.textContent = 'DEFEAT LORD BRIM FIRST!';
      if (msgEl) {
        msgEl.textContent = "Stage 1-6 (Lord Brim's Citadel) is waiting! Beat Lord Brim in World 1 to unlock Endless Mode.";
      }
      if (goBtn) goBtn.textContent = 'FIGHT LORD BRIM ⚔️';
    } else {
      if (titleEl) titleEl.textContent = 'PLAY WORLD 1 FIRST!';
      if (msgEl) {
        msgEl.textContent = `Endless Mode is locked until you beat World 1 and defeat Lord Brim (Stage 1-6). Continue at ${curNode.code} · ${curNode.title}!`;
      }
      if (goBtn) goBtn.textContent = '🗺️ PLAY WORLD 1 ▶';
    }

    $('#endlessLockedModal')?.classList.remove('hidden');
  }

  closeEndlessLockedModal() {
    $('#endlessLockedModal')?.classList.add('hidden');
    sounds.whoosh();
  }

  openWorld2SoonModal() {
    sounds.init();
    sounds.pop();
    haptics.light();

    const w2Ready = !!store.worlds.world2Unlocked;
    const statusEl = $('#world2SoonStatus');
    const goBtn = $('#btnWorld2SoonGoW1');

    if (w2Ready) {
      if (statusEl) {
        statusEl.textContent = `Lord Brim is defeated and your World 2 Portal is primed! Test your endurance in Endless Mode (${GAMES.length} Reels) while World 2 launches.`;
      }
      if (goBtn) goBtn.textContent = '∞ PLAY ENDLESS ▶';
    } else {
      if (statusEl) {
        statusEl.textContent = 'New Frost & Cyber realms are coming soon! Conquer World 1 and defeat Lord Brim (Stage 1-6) to unlock Endless Mode first.';
      }
      if (goBtn) goBtn.textContent = '🗺️ PLAY WORLD 1 ▶';
    }

    $('#world2SoonModal')?.classList.remove('hidden');
  }

  closeWorld2SoonModal() {
    $('#world2SoonModal')?.classList.add('hidden');
    sounds.whoosh();
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
          this.renderProfileUI();
          this.renderPlazaUI();
          this.renderWorldMapUI();
          this.renderQuestsModal();
        };
      });
    }
  }

  /* ----------------------------------------------------------- Collectables · Comics Section */
  openComicsModal({ skipMarkSeen = false } = {}) {
    sounds.init();
    const catalogBeforeSeen = store.getComicsCatalog();
    const highlightNewIds = new Set(catalogBeforeSeen.filter((c) => c.isNew).map((c) => c.id));
    if (!skipMarkSeen && highlightNewIds.size > 0) {
      store.markComicsViewed();
      this.syncComicNotices();
    }
    const doneBtn = $('#btnComicsDone');
    if (doneBtn) {
      const onMap = !$('#worldMapOverlay')?.classList.contains('hidden');
      doneBtn.textContent = onMap ? 'BACK TO MAP ✓' : 'BACK TO PLAZA ✓';
    }
    this.renderComicsModal(highlightNewIds);
    $('#comicsModal')?.classList.remove('hidden');
    sounds.whoosh();
    haptics.light();
  }

  closeComicsModal({ skipSound = false } = {}) {
    $('#comicsModal')?.classList.add('hidden');
    this.syncComicNotices();
    if (!skipSound) sounds.whoosh();
  }

  renderComicsModal(highlightNewIds = null) {
    const catalog = store.getComicsCatalog();
    const unlockedCount = store.getUnlockedComicsCount();
    const totalCount = catalog.length;

    const countEl = $('#comicsCollectedCount');
    if (countEl) {
      const allDone = unlockedCount >= totalCount;
      countEl.textContent = allDone ? `${unlockedCount} / ${totalCount} COMPLETE! 👑` : `${unlockedCount} / ${totalCount} COLLECTED`;
      countEl.classList.toggle('complete', allDone);
    }

    const listEl = $('#comicsShelfList');
    if (!listEl) return;

    listEl.innerHTML = catalog.map((c) => {
      const isNew = highlightNewIds ? highlightNewIds.has(c.id) : c.isNew;
      const cls = c.unlocked ? (isNew ? 'is-new' : 'is-unlocked') : 'is-locked';
      const statusText = !c.unlocked ? 'LOCKED 🔒' : isNew ? 'NEW UNLOCK ✨' : 'UNLOCKED ✓';
      const descText = c.unlocked ? c.description : (c.lockedDescription || c.unlockHint);
      const btnText = c.unlocked ? 'READ COMIC ▶' : '🔒 LOCKED';
      return `
        <article class="comic-issue-card ${cls}" data-comic-id="${c.id}">
          <div class="cic-cover-wrap">
            <img class="cic-cover-img" src="${c.cover}" alt="${c.unlocked ? c.title : 'Locked Comic Cover'}" />
            ${!c.unlocked ? '<div class="cic-lock-badge" aria-hidden="true">🔒</div>' : ''}
            ${c.unlocked && isNew ? '<span class="cic-new-badge">NEW!</span>' : ''}
          </div>
          <div class="cic-body">
            <div>
              <div class="cic-meta-row">
                <span class="cic-issue-tag">${c.issueNumber} · ${c.tag}</span>
                <span class="cic-status-pill">${statusText}</span>
              </div>
              <div class="cic-title">${c.title}</div>
              <div class="cic-desc">${descText}</div>
            </div>
            <div class="cic-footer">
              <span class="cic-panels-lbl">${c.panelCountLabel}</span>
              <button type="button" class="cic-read-btn ${c.unlocked ? '' : 'locked'}" data-comic-read="${c.id}">${btnText}</button>
            </div>
          </div>
        </article>`;
    }).join('');

    listEl.querySelectorAll('[data-comic-id]').forEach((cardEl) => {
      cardEl.onclick = () => {
        const comic = catalog.find((item) => item.id === cardEl.dataset.comicId);
        if (!comic) return;
        if (!comic.unlocked) {
          sounds.fail();
          haptics.medium();
          this.banner('COMIC LOCKED 🔒', comic.lockedDescription || comic.unlockHint, 'fail');
          return;
        }
        this.closeComicsModal({ skipSound: true });
        this.openComicById(comic.id, { returnToComics: true });
      };
    });
  }

  startWorldRun(nodeId = this.activeWorldNodeId) {
    const node = getWorldNodeById(nodeId || store.worlds.selectedNodeId || '1-1');
    if (!store.isNodeUnlocked(node.id)) {
      this.selectWorldMapNode(node.id);
      return;
    }

    sounds.init();
    this._pendingBossVictory = null;
    this.bankGame = null;
    this.activeWorldNodeId = node.id;
    store.selectWorldNode(node.id);
    this.runType = 'world';
    $('#cycleLabel')?.classList.remove('hidden');

    store.reset();
    store.recordRunStart();
    this.buildPips();
    this.renderProfileUI();
    store.data.started = true;

    $('#menu')?.classList.add('hidden');
    $('#worldMapOverlay')?.classList.add('hidden');
    $('#questsModal')?.classList.add('hidden');
    this.hideSummary();
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
      const baseScore = this.runType === 'bank' ? 0 : store.meta.global;
      const live = (this.mode === 'playing' || this.mode === 'paused') ? this.computeLiveRP() : 0;
      const total = baseScore + live;
      if (total !== this.lastScoreShown) {
        this.lastScoreShown = total;
        $('#score').textContent = total.toLocaleString();
      }
    } else if (this.mode === 'summary' || this.mode === 'transition') {
      const total = this.runType === 'bank' ? 0 : store.meta.global;
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
      if (secs <= 10 && secs > 0) {
        bgm.setUrgent(true);
      }
      if (secs <= 5 && secs > 0) {
        this.stage.classList.add('urgent');
        sounds.tick(secs);
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
      if (opts.type === 'profile') {
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

    const shareTitle = `Jelly Bean: 60s Challenge — ${playerName} Scored ${scoreVal} PTS!`;
    const shareText = `Surviving ${cycleVal} cycles in Jelly Bean: 60s Challenge with ${scoreVal} PTS! Beat my record!`;
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

  _getAdminCatalog() {
    return [
      ...GAMES.map((G, idx) => ({ kind: 'live', idx, G })),
      ...GAME_BANK.map((G, idx) => ({ kind: 'bank', idx, G })),
    ];
  }

  adminLaunchGame(i) {
    if (i < 0 || i >= GAMES.length) return;
    this._pausedByAdmin = false;
    $('#adminModal').classList.add('hidden');
    $('#settingsModal').classList.add('hidden');
    store.data.started = true;
    this.runType = 'standard';
    this.bankGame = null;
    this.buildPips();
    this.jumpToGame(i, true);
    this.syncAdminUI();
  }

  adminLaunchBankGame(gameOrId) {
    if (!this.adminMode) return;
    const G = typeof gameOrId === 'string'
      ? (GAME_BANK_BY_ID[gameOrId] || GAME_BANK.find((g) => g.meta.id === gameOrId))
      : gameOrId;
    if (!G) return;

    sounds.init();
    this._pausedByAdmin = false;
    $('#adminModal').classList.add('hidden');
    $('#settingsModal').classList.add('hidden');

    this.freezeAndDestroyCurrentGame();
    this.runType = 'bank';
    this._preparePlayStage();
    this.loadBankGame(G);
    this.presentRoundWrap();
    sounds.whoosh();
    haptics.light();
    this.syncAdminUI();
  }

  adminStepGame(dir) {
    const catalog = this._getAdminCatalog();
    if (catalog.length === 0) return;
    const curPos = this.bankGame
      ? catalog.findIndex((c) => c.kind === 'bank' && c.G === this.bankGame)
      : catalog.findIndex((c) => c.kind === 'live' && c.idx === this.index);
    const basePos = curPos >= 0 ? curPos : 0;
    const nextItem = catalog[(basePos + dir + catalog.length) % catalog.length];
    if (nextItem.kind === 'bank') this.adminLaunchBankGame(nextItem.G);
    else this.adminLaunchGame(nextItem.idx);
  }

  adminAddRP(delta = 10000) {
    store.adminAddRP(delta);
    this.renderProfileUI();
    this.renderPlazaUI();
    this.renderWorldMapUI();
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
    const G = this.getCurrentGameClass() || GAMES[0];
    if (!G) return;
    sounds.up();
    haptics.success();
    if (this.runType === 'bank' && this.bankGame) {
      const entry = this._getBankEntry(G.meta.id);
      entry.prestige += 1;
      const rankNow = entry.prestige;
      this.adminLaunchBankGame(G);
      this.banner(`BANK PRESTIGE ${rankNow}! ★`, `${G.meta.title} scaled to Prestige ${rankNow}`, 'ok');
      return;
    }
    const rankNow = store.promote(G.meta.id, { clearState: false });
    this.adminLaunchGame(this.index);
    this.banner(`PRESTIGE ${rankNow} TEST! ★`, `${G.meta.title} scaled to Prestige ${rankNow}`, 'ok');
  }

  adminToggleWorld1() {
    const allOpen = WORLD_1_NODES.every((n) => store.isNodeUnlocked(n.id));
    if (allOpen) {
      store.worlds.nodes = { '1-1': { unlocked: true, cleared: false, stars: 0, bestScore: 0 } };
      store.worlds.selectedNodeId = '1-1';
      store.worlds.world2Unlocked = false;
      store.collectibles.unlockedComics.pub_call_comic = false;
      store.collectibles.seenComics.pub_call_comic = false;
      store.collectibles.unlockedComics.queen_40th_comic = false;
      store.collectibles.seenComics.queen_40th_comic = false;
      store.collectibles.unlockedComics.klarna_pizza_comic = false;
      store.collectibles.seenComics.klarna_pizza_comic = false;
      store.collectibles.unlockedComics.asbo_prep_comic = false;
      store.collectibles.seenComics.asbo_prep_comic = false;
      store.collectibles.unlockedComics.karate_pickup_comic = false;
      store.collectibles.seenComics.karate_pickup_comic = false;
      store.collectibles.unlockedComics.ending_comic = false;
      store.collectibles.seenComics.ending_comic = false;
    } else {
      for (const n of WORLD_1_NODES) {
        const cur = store.worlds.nodes[n.id] || {};
        store.worlds.nodes[n.id] = {
          unlocked: true,
          cleared: !n.isBoss ? true : !!cur.cleared,
          stars: !n.isBoss ? Math.max(cur.stars || 0, 3) : (cur.stars || 0),
          bestScore: Math.max(cur.bestScore || 0, !n.isBoss ? n.starScores[2] : 0),
        };
      }
      store.worlds.world2Unlocked = Boolean(store.worlds.nodes['1-6']?.cleared);
      store.unlockComic('pub_call_comic');
      store.unlockComic('queen_40th_comic');
      store.unlockComic('klarna_pizza_comic');
      store.unlockComic('asbo_prep_comic');
      store.unlockComic('karate_pickup_comic');
    }
    store.save();
    this.renderPlazaUI();
    this.renderWorldMapUI();
    this.renderAdminModal();
    sounds.up();
    haptics.medium();
  }

  _buildAdminRowHtml(G, { prefix, current, pRank, elim, attr }) {
    const badges = [G.meta.isPrestige ? 'PRESTIGE' : 'ENDLESS'];
    if (pRank > 1) badges.push(`P${pRank}`);
    if (elim) badges.push('💀');
    return `
      <button type="button" class="admin-game-row ${current ? 'current' : ''}" ${attr}>
        <span class="agr-num">${prefix}</span>
        <span class="agr-icon">${G.meta.icon}</span>
        <span class="agr-main">
          <span class="agr-title">${G.meta.title}</span>
          <span class="agr-hint">${G.meta.hint}</span>
        </span>
        <span class="agr-badge">${badges.join(' · ')}</span>
      </button>`;
  }

  renderAdminModal() {
    const nowLabel = $('#adminNowLabel');
    const curGame = this.getCurrentGameClass() || GAMES[0];
    if (nowLabel && curGame) {
      if (this.runType === 'bank' && this.bankGame) {
        const bIdx = GAME_BANK.indexOf(this.bankGame);
        const pRank = this._getBankEntry(curGame.meta.id).prestige;
        nowLabel.textContent = `BANK #${String((bIdx >= 0 ? bIdx : 0) + 1).padStart(2, '0')} · ${curGame.meta.icon} ${curGame.meta.title} (P${pRank})`;
      } else {
        const pRank = store.getPrestige(curGame.meta.id);
        nowLabel.textContent = `#${String(this.index + 1).padStart(2, '0')} · ${curGame.meta.icon} ${curGame.meta.title} (P${pRank})`;
      }
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

    const liveRows = GAMES.map((G, idx) => this._buildAdminRowHtml(G, {
      prefix: `#${String(idx + 1).padStart(2, '0')}`,
      current: Boolean(this.game && !this.bankGame && this.index === idx),
      pRank: store.getPrestige(G.meta.id),
      elim: store.isEliminated(G.meta.id),
      attr: `data-admin-idx="${idx}"`,
    })).join('');

    const bankRows = GAME_BANK.map((G, idx) => this._buildAdminRowHtml(G, {
      prefix: `B${String(idx + 1).padStart(2, '0')}`,
      current: Boolean(this.game && this.bankGame === G),
      pRank: this._getBankEntry(G.meta.id).prestige,
      elim: false,
      attr: `data-admin-bank-id="${G.meta.id}"`,
    })).join('');

    listEl.innerHTML = `
      <div class="admin-pack-group">
        <div class="admin-pack-head">ACTIVE REEL GAMES (20 REELS + BOSS) · ${GAMES.length}/${GAMES.length} LIVE</div>
        ${liveRows}
      </div>
      <div class="admin-pack-group admin-bank-group">
        <div class="admin-pack-head bank">🧪 WIP GAME BANK (WORLD 2+ · DEV ONLY) · ${GAME_BANK.length} GAMES</div>
        ${bankRows}
      </div>`;

    listEl.querySelectorAll('[data-admin-idx]').forEach((btn) => {
      btn.onclick = () => this.adminLaunchGame(Number(btn.dataset.adminIdx));
    });
    listEl.querySelectorAll('[data-admin-bank-id]').forEach((btn) => {
      btn.onclick = () => this.adminLaunchBankGame(btn.dataset.adminBankId);
    });
  }
}

