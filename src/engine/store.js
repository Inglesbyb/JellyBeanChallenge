// Persistence: frozen game snapshots, normalized RP progression, World 1 map & quests saved to localStorage.
import {
  GAMES,
  GAME_BY_ID,
  WORLD_1_NODES,
  QUEST_POOL,
  getWorldNodeById,
  getStarsForScore,
} from '../games/registry.js';
import { COMIC_COLLECTIBLES } from './storyComic.js';

const KEY = 'GAME_REELS_V3';
const LEGACY_KEY = 'GAME_REELS_V2';

export const RANKS = [
  { min: 0, title: 'Sprout Bean', icon: '🌱', next: 25000 },
  { min: 25000, title: 'Bronze Bean', icon: '🥉', next: 90000 },
  { min: 90000, title: 'Silver Bean', icon: '🥈', next: 220000 },
  { min: 220000, title: 'Gold Bean', icon: '🥇', next: 500000 },
  { min: 500000, title: 'Diamond Bean', icon: '💎', next: 1000000 },
  { min: 1000000, title: 'Apex Legend', icon: '👑', next: null },
];

export function getRankTier(lifetimeScore = 0) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (lifetimeScore >= RANKS[i].min) {
      const cur = RANKS[i];
      const nextRank = RANKS[i + 1] || null;
      let progress = 1;
      if (cur.next) {
        progress = Math.min(1, Math.max(0, (lifetimeScore - cur.min) / (cur.next - cur.min)));
      }
      return { ...cur, progress, nextRank };
    }
  }
  return { ...RANKS[0], progress: 0, nextRank: RANKS[1] };
}

const freshMeta = () => ({
  cycle: 1,
  index: 0,
  global: 0,
  cycleBase: 0,
  results: {}, // gameId -> 'survived' | 'eliminated'
  eliminated: {}, // gameId -> boolean
  prestige: {}, // gameId -> current prestige rank (absent = 1). Wiped on every new run.
  seenInRun: {}, // gameId -> true after first play in the current run. Wiped on every new run.
});

const defaultSettings = () => ({
  sfxVolume: 0.8,
  musicVolume: 0.45,
  hapticsEnabled: true,
  screenShakeEnabled: true,
});

const defaultProfile = () => ({
  name: `Bean #${Math.floor(100 + Math.random() * 900)}`,
  avatar: '🫘',
  created: Date.now(),
});

const defaultStats = () => ({
  runsAttempted: 0,
  maxCycle: 1,
  highestRunScore: 0,
  lifetimeScore: 0,
  timersSurvived: 0,
  stagesCleared: 0,
  gameHighScores: {},
});

const defaultQuests = () => ({
  setIndex: 1,
  multiplier: 1.0,
  active: [
    { id: 'survive_reels', progress: 0, claimed: false },
    { id: 'prestige_up', progress: 0, claimed: false },
    { id: 'score_run', progress: 0, claimed: false },
  ],
});

const defaultWorlds = () => ({
  selectedWorldId: 'world-1',
  selectedNodeId: '1-1',
  nodes: {
    '1-1': { unlocked: true, cleared: false, stars: 0, bestScore: 0 },
  },
  world2Unlocked: false,
});

const defaultCollectibles = () => {
  const unlockedComics = {};
  const seenComics = {};
  for (const c of COMIC_COLLECTIBLES) {
    unlockedComics[c.id] = !!c.unlockedByDefault;
    seenComics[c.id] = !!c.unlockedByDefault;
  }
  return {
    unlockedComics,
    seenComics,
    unlockedAt: {},
  };
};

function normalizeCollectiblesState(raw, worlds) {
  const base = defaultCollectibles();
  const col = {
    unlockedComics: { ...base.unlockedComics, ...(raw?.unlockedComics || {}) },
    seenComics: { ...base.seenComics, ...(raw?.seenComics || {}) },
    unlockedAt: { ...(raw?.unlockedAt || {}) },
  };
  for (const c of COMIC_COLLECTIBLES) {
    if (c.unlockedByDefault) {
      col.unlockedComics[c.id] = true;
      if (col.seenComics[c.id] === undefined) col.seenComics[c.id] = true;
    }
  }
  if (worlds?.nodes?.['1-1']?.cleared) {
    col.unlockedComics.pub_call_comic = true;
  }
  if (worlds?.nodes?.['1-2']?.cleared) {
    col.unlockedComics.queen_40th_comic = true;
  }
  if (worlds?.nodes?.['1-3']?.cleared) {
    col.unlockedComics.klarna_pizza_comic = true;
  }
  if (worlds?.nodes?.['1-4']?.cleared) {
    col.unlockedComics.asbo_prep_comic = true;
  }
  if (worlds?.nodes?.['1-5']?.cleared) {
    col.unlockedComics.karate_pickup_comic = true;
  }
  if (worlds?.nodes?.['1-6']?.cleared || worlds?.world2Unlocked) {
    col.unlockedComics.ending_comic = true;
  }
  return col;
}

function normalizeWorldsState(raw) {
  const base = defaultWorlds();
  const w = { ...base, ...(raw || {}) };
  w.nodes = { ...base.nodes, ...(raw?.nodes || {}) };
  w.nodes['1-1'] = { unlocked: true, cleared: false, stars: 0, bestScore: 0, ...(w.nodes['1-1'] || {}) };
  w.nodes['1-1'].unlocked = true;
  // Ensure sequential node unlock integrity
  for (let i = 1; i < WORLD_1_NODES.length; i++) {
    const prev = WORLD_1_NODES[i - 1];
    const cur = WORLD_1_NODES[i];
    const existing = w.nodes[cur.id] || { unlocked: false, cleared: false, stars: 0, bestScore: 0 };
    if (w.nodes[prev.id]?.cleared) {
      existing.unlocked = true;
    }
    w.nodes[cur.id] = existing;
  }
  w.world2Unlocked = Boolean(w.nodes['1-6']?.cleared);
  if (!getWorldNodeById(w.selectedNodeId) || !w.nodes[w.selectedNodeId]?.unlocked) {
    w.selectedNodeId = '1-1';
  }
  return w;
}

function normalizeQuestsState(raw) {
  const base = defaultQuests();
  const q = { ...base, ...(raw || {}) };
  q.setIndex = Math.max(1, Number(q.setIndex) || 1);
  q.multiplier = Math.min(2.0, Math.max(1.0, Number(q.multiplier) || 1.0));
  if (!Array.isArray(q.active) || q.active.length !== 3) {
    q.active = base.active;
  } else {
    q.active = q.active.map((slot, i) => {
      const valid = QUEST_POOL.some((t) => t.id === slot?.id);
      return valid
        ? { id: slot.id, progress: Math.max(0, Number(slot.progress) || 0), claimed: !!slot.claimed }
        : base.active[i];
    });
  }
  return q;
}

export const store = {
  data: {
    started: false,
    storySeen: false,
    meta: freshMeta(),
    games: {},
    likes: {},
    settings: defaultSettings(),
    profile: defaultProfile(),
    stats: defaultStats(),
    worlds: defaultWorlds(),
    quests: defaultQuests(),
    collectibles: defaultCollectibles(),
  },

  load() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const fresh = freshMeta();
        const meta = { ...fresh, ...(p.meta || {}) };
        if (!meta.eliminated || typeof meta.eliminated !== 'object') {
          meta.eliminated = {};
        }
        if (!meta.prestige || typeof meta.prestige !== 'object') {
          meta.prestige = {};
        }
        if (!meta.seenInRun || typeof meta.seenInRun !== 'object') {
          meta.seenInRun = {};
        }
        if (!meta.results || Array.isArray(meta.results) || typeof meta.results !== 'object') {
          meta.results = {};
        }

        const settings = { ...defaultSettings(), ...(p.settings || {}) };
        const profile = { ...defaultProfile(), ...(p.profile || {}) };
        const stats = { ...defaultStats(), ...(p.stats || {}) };
        if (!stats.gameHighScores || typeof stats.gameHighScores !== 'object') {
          stats.gameHighScores = {};
        }
        const worlds = normalizeWorldsState(p.worlds);
        const quests = normalizeQuestsState(p.quests);
        const collectibles = normalizeCollectiblesState(p.collectibles, worlds);

        this.data = {
          started: !!p.started,
          storySeen: !!p.storySeen,
          meta,
          games: p.games || {},
          likes: p.likes || {},
          settings,
          profile,
          stats,
          worlds,
          quests,
          collectibles,
        };
        return;
      }

      // Migrate non-economy preferences from legacy V2 save so existing players keep their name, avatar, settings & likes
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        const lp = JSON.parse(legacyRaw);
        this.data = {
          started: false,
          storySeen: false,
          meta: freshMeta(),
          games: {},
          likes: lp.likes || {},
          settings: { ...defaultSettings(), ...(lp.settings || {}) },
          profile: { ...defaultProfile(), ...(lp.profile || {}) },
          stats: defaultStats(),
          worlds: defaultWorlds(),
          quests: defaultQuests(),
          collectibles: defaultCollectibles(),
        };
        this.save();
      }
    } catch (e) {
      console.warn('store load failed', e);
    }
  },

  save() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('store save failed', e);
    }
  },

  get meta() {
    return this.data.meta;
  },

  hasSession() {
    return this.data.started;
  },

  hasSeenStory() {
    return !!this.data.storySeen;
  },

  markStorySeen() {
    if (!this.data.storySeen) {
      this.data.storySeen = true;
      this.save();
    }
  },

  get(id) {
    return this.data.games[id] || null;
  },

  set(id, state, score) {
    this.data.games[id] = { state, score };
    this.save();
  },

  clear(id) {
    delete this.data.games[id];
    this.save();
  },

  isEliminated(id) {
    return !!this.data.meta.eliminated?.[id];
  },

  eliminate(id) {
    if (!this.data.meta.eliminated) this.data.meta.eliminated = {};
    this.data.meta.eliminated[id] = true;
    delete this.data.games[id];
    this.save();
  },

  hasSeenInRun(id) {
    return !!this.data.meta.seenInRun?.[id];
  },

  markSeenInRun(id) {
    if (!this.data.meta.seenInRun) this.data.meta.seenInRun = {};
    if (!this.data.meta.seenInRun[id]) {
      this.data.meta.seenInRun[id] = true;
      this.save();
    }
  },

  getPrestige(id) {
    return Math.max(1, this.data.meta.prestige?.[id] || 1);
  },

  promote(id, { clearState = false } = {}) {
    if (!this.data.meta.prestige) this.data.meta.prestige = {};
    const next = this.getPrestige(id) + 1;
    this.data.meta.prestige[id] = next;
    if (clearState) {
      delete this.data.games[id];
    }
    this.save();
    return next;
  },

  clearedCount() {
    return Object.values(this.data.meta.prestige || {}).filter((v) => v > 1).length;
  },

  /* ----------------------------------------------------------- Playable Roster */
  isGameUnlocked(gameId) {
    return Boolean(GAME_BY_ID[gameId]);
  },

  getUnlockedGameIds() {
    return GAMES.map((g) => g.meta.id);
  },

  getTotalPlayableGameCount() {
    return GAMES.length;
  },

  adminAddRP(delta = 10000) {
    this.stats.lifetimeScore = Math.max(0, (this.stats.lifetimeScore || 0) + delta);
    this.save();
  },

  adminReviveAll() {
    this.data.meta.eliminated = {};
    this.save();
  },

  get settings() {
    if (!this.data.settings) this.data.settings = defaultSettings();
    return this.data.settings;
  },

  updateSettings(partial) {
    if (!this.data.settings) this.data.settings = defaultSettings();
    this.data.settings = { ...this.data.settings, ...partial };
    this.save();
    return this.data.settings;
  },

  get profile() {
    if (!this.data.profile) this.data.profile = defaultProfile();
    return this.data.profile;
  },

  updateProfile(partial) {
    if (!this.data.profile) this.data.profile = defaultProfile();
    this.data.profile = { ...this.data.profile, ...partial };
    this.save();
    return this.data.profile;
  },

  get stats() {
    if (!this.data.stats) this.data.stats = defaultStats();
    return this.data.stats;
  },

  updateStats(partial) {
    if (!this.data.stats) this.data.stats = defaultStats();
    this.data.stats = { ...this.data.stats, ...partial };
    this.save();
    return this.data.stats;
  },

  recordRunStart() {
    const stats = this.stats;
    stats.runsAttempted = (stats.runsAttempted || 0) + 1;
    this.save();
  },

  recordRoundSurvive(gameId, rawScore, netRP) {
    const stats = this.stats;
    stats.timersSurvived = (stats.timersSurvived || 0) + 1;
    stats.lifetimeScore = (stats.lifetimeScore || 0) + Math.max(0, Math.round(netRP || 0));
    if (!stats.gameHighScores) stats.gameHighScores = {};
    stats.gameHighScores[gameId] = Math.max(stats.gameHighScores[gameId] || 0, Math.round(rawScore || 0));
    this.save();
  },

  recordRoundDeath(gameId, rawScore, netRP = 0) {
    const stats = this.stats;
    stats.lifetimeScore = (stats.lifetimeScore || 0) + Math.max(0, Math.round(netRP || 0));
    if (!stats.gameHighScores) stats.gameHighScores = {};
    stats.gameHighScores[gameId] = Math.max(stats.gameHighScores[gameId] || 0, Math.round(rawScore || 0));
    this.save();
  },

  recordGameScore(gameId, rawScore) {
    const stats = this.stats;
    if (!stats.gameHighScores) stats.gameHighScores = {};
    stats.gameHighScores[gameId] = Math.max(stats.gameHighScores[gameId] || 0, Math.round(rawScore || 0));
    this.save();
  },

  recordStageVictory(gameId, rawScore, netRP) {
    const stats = this.stats;
    stats.stagesCleared = (stats.stagesCleared || 0) + 1;
    stats.lifetimeScore = (stats.lifetimeScore || 0) + Math.max(0, Math.round(netRP || 0));
    if (!stats.gameHighScores) stats.gameHighScores = {};
    stats.gameHighScores[gameId] = Math.max(stats.gameHighScores[gameId] || 0, Math.round(rawScore || 0));
    this.save();
  },

  recordRunProgress(cycle, runScore) {
    const stats = this.stats;
    stats.maxCycle = Math.max(stats.maxCycle || 1, cycle || 1);
    stats.highestRunScore = Math.max(stats.highestRunScore || 0, Math.round(runScore || 0));
    this.save();
  },

  reset() {
    const likes = this.data.likes;
    const settings = this.data.settings || defaultSettings();
    const profile = this.data.profile || defaultProfile();
    const stats = this.data.stats || defaultStats();
    const progression = this.progression;
    const worlds = this.worlds;
    const quests = this.quests;
    const collectibles = this.collectibles;
    const storySeen = !!this.data.storySeen;
    this.data = { started: true, storySeen, meta: freshMeta(), games: {}, likes, settings, profile, stats, progression, worlds, quests, collectibles };
    this.save();
  },

  abandonSession() {
    const likes = this.data.likes;
    const settings = this.data.settings || defaultSettings();
    const profile = this.data.profile || defaultProfile();
    const stats = this.data.stats || defaultStats();
    const progression = this.progression;
    const worlds = this.worlds;
    const quests = this.quests;
    const collectibles = this.collectibles;
    const storySeen = !!this.data.storySeen;
    this.data = { started: false, storySeen, meta: freshMeta(), games: {}, likes, settings, profile, stats, progression, worlds, quests, collectibles };
    this.save();
  },

  /* ----------------------------------------------------------- World 1 Progression */
  get worlds() {
    if (!this.data.worlds) this.data.worlds = defaultWorlds();
    return this.data.worlds;
  },

  isNodeUnlocked(nodeId) {
    if (nodeId === '1-1') return true;
    const w = this.worlds;
    if (w.nodes?.[nodeId]?.unlocked) return true;
    const idx = WORLD_1_NODES.findIndex((n) => n.id === nodeId);
    if (idx > 0 && w.nodes?.[WORLD_1_NODES[idx - 1].id]?.cleared) return true;
    return false;
  },

  getNodeState(nodeId) {
    const raw = this.worlds.nodes?.[nodeId] || {};
    return {
      unlocked: this.isNodeUnlocked(nodeId),
      cleared: !!raw.cleared,
      stars: Math.min(3, Math.max(0, raw.stars || 0)),
      bestScore: Math.max(0, raw.bestScore || 0),
    };
  },

  selectWorldNode(nodeId) {
    if (!this.isNodeUnlocked(nodeId)) return false;
    this.worlds.selectedNodeId = nodeId;
    this.save();
    return true;
  },

  getWorld1Stars() {
    return WORLD_1_NODES.reduce((sum, n) => sum + (this.getNodeState(n.id).stars || 0), 0);
  },

  isEndlessUnlocked() {
    return Boolean(this.worlds?.nodes?.['1-6']?.cleared || this.worlds?.world2Unlocked);
  },

  recordWorldRunResult(nodeId, rawRunScore = 0, opts = {}) {
    const node = getWorldNodeById(nodeId);
    const score = Math.max(0, Math.round(rawRunScore || 0));
    const bossVictory = Boolean(node.isBoss && opts?.bossVictory);
    let starsEarned = 0;
    if (node.isBoss) {
      if (bossVictory) {
        const hearts = Math.max(0, Number(opts?.heartsRemaining ?? 1));
        const maxH = Math.max(1, Number(opts?.maxHearts ?? 5));
        starsEarned = hearts >= maxH ? 3 : hearts >= 3 ? 2 : 1;
      }
    } else {
      starsEarned = getStarsForScore(node, score);
    }
    const prev = this.getNodeState(node.id);
    const prevCleared = !!prev.cleared;
    const clearedNow = node.isBoss ? bossVictory : score >= node.clearScore;
    const isFirstClear = clearedNow && !prevCleared;
    const bonusRP = isFirstClear ? (node.firstClearBonusRP || 0) : 0;

    if (!this.worlds.nodes) this.worlds.nodes = {};
    this.worlds.nodes[node.id] = {
      unlocked: true,
      cleared: prevCleared || clearedNow,
      stars: Math.max(prev.stars || 0, starsEarned),
      bestScore: Math.max(prev.bestScore || 0, score),
    };

    const nextNode = WORLD_1_NODES[node.index + 1] || null;
    let nextUnlockedNode = null;
    let world2JustUnlocked = false;
    if (clearedNow) {
      if (nextNode) {
        const hadNext = !!this.worlds.nodes[nextNode.id]?.unlocked;
        const existingNext = this.worlds.nodes[nextNode.id] || { unlocked: true, cleared: false, stars: 0, bestScore: 0 };
        this.worlds.nodes[nextNode.id] = { ...existingNext, unlocked: true };
        if (!hadNext || isFirstClear) {
          nextUnlockedNode = nextNode;
          this.worlds.selectedNodeId = nextNode.id;
        }
      } else {
        world2JustUnlocked = !this.worlds.world2Unlocked;
        this.worlds.world2Unlocked = true;
      }
    }

    let unlockedComicId = null;
    if (clearedNow) {
      if (node.id === '1-1' && this.unlockComic('pub_call_comic')) {
        unlockedComicId = 'pub_call_comic';
      } else if (node.id === '1-2' && this.unlockComic('queen_40th_comic')) {
        unlockedComicId = 'queen_40th_comic';
      } else if (node.id === '1-3' && this.unlockComic('klarna_pizza_comic')) {
        unlockedComicId = 'klarna_pizza_comic';
      } else if (node.id === '1-4' && this.unlockComic('asbo_prep_comic')) {
        unlockedComicId = 'asbo_prep_comic';
      } else if (node.id === '1-5' && this.unlockComic('karate_pickup_comic')) {
        unlockedComicId = 'karate_pickup_comic';
      } else if (node.isBoss && this.unlockComic('ending_comic')) {
        unlockedComicId = 'ending_comic';
      }
    }
    const comicJustUnlocked = Boolean(unlockedComicId);

    if (bonusRP > 0) {
      this.stats.lifetimeScore = (this.stats.lifetimeScore || 0) + bonusRP;
    }

    // Update Star Hunter quest if active
    this.recordQuestProgress('world1Stars', this.getWorld1Stars());
    this.save();

    return {
      node,
      score,
      starsEarned,
      bestStars: this.worlds.nodes[node.id].stars,
      clearedNow,
      isFirstClear,
      firstClearBonusRP: bonusRP,
      nextNode,
      nextUnlockedNode,
      world2JustUnlocked,
      comicJustUnlocked,
      unlockedComicId,
    };
  },

  /* ----------------------------------------------------------- Collectibles · Comics */
  get collectibles() {
    if (!this.data.collectibles) {
      this.data.collectibles = normalizeCollectiblesState(null, this.worlds);
    }
    return this.data.collectibles;
  },

  isComicUnlocked(comicId) {
    return Boolean(this.collectibles.unlockedComics?.[comicId]);
  },

  unlockComic(comicId) {
    const exists = COMIC_COLLECTIBLES.some((c) => c.id === comicId);
    if (!exists) return false;
    const col = this.collectibles;
    if (col.unlockedComics[comicId]) return false;
    col.unlockedComics[comicId] = true;
    col.seenComics[comicId] = false;
    col.unlockedAt[comicId] = Date.now();
    this.save();
    return true;
  },

  getUnseenComics() {
    const col = this.collectibles;
    return COMIC_COLLECTIBLES.filter((c) => col.unlockedComics[c.id] && !col.seenComics[c.id]);
  },

  hasUnseenComics() {
    return this.getUnseenComics().length > 0;
  },

  markComicSeen(comicId) {
    const col = this.collectibles;
    if (!comicId || !col.unlockedComics[comicId] || col.seenComics[comicId]) return false;
    col.seenComics[comicId] = true;
    this.save();
    return true;
  },

  markComicsViewed() {
    const col = this.collectibles;
    let changed = false;
    for (const c of COMIC_COLLECTIBLES) {
      if (col.unlockedComics[c.id] && !col.seenComics[c.id]) {
        col.seenComics[c.id] = true;
        changed = true;
      }
    }
    if (changed) this.save();
    return changed;
  },

  getUnlockedComicsCount() {
    const col = this.collectibles;
    return COMIC_COLLECTIBLES.filter((c) => col.unlockedComics[c.id]).length;
  },

  getComicsCatalog() {
    const col = this.collectibles;
    return COMIC_COLLECTIBLES.map((c) => ({
      ...c,
      unlocked: Boolean(col.unlockedComics[c.id]),
      isNew: Boolean(col.unlockedComics[c.id] && !col.seenComics[c.id]),
    }));
  },

  /* ----------------------------------------------------------- Quests & Multiplier */
  get quests() {
    if (!this.data.quests) this.data.quests = defaultQuests();
    return this.data.quests;
  },

  getQuestMultiplier() {
    return Math.min(2.0, Math.max(1.0, Number(this.quests.multiplier) || 1.0));
  },

  getActiveQuests() {
    const active = this.quests.active || [];
    const totalStars = this.getWorld1Stars();
    return active.map((slot, idx) => {
      const tpl = QUEST_POOL.find((t) => t.id === slot.id) || QUEST_POOL[idx % QUEST_POOL.length];
      const progress = tpl.metric === 'world1Stars' ? Math.max(slot.progress || 0, totalStars) : (slot.progress || 0);
      const capped = Math.min(tpl.target, progress);
      return {
        slotIndex: idx,
        ...tpl,
        progress: capped,
        ready: !slot.claimed && capped >= tpl.target,
        claimed: !!slot.claimed,
      };
    });
  },

  getClaimableQuestCount() {
    return this.getActiveQuests().filter((q) => q.ready).length;
  },

  recordQuestProgress(metric, value = 1) {
    const active = this.quests.active;
    if (!Array.isArray(active)) return false;
    let changed = false;
    for (let i = 0; i < active.length; i++) {
      const slot = active[i];
      if (!slot || slot.claimed) continue;
      const tpl = QUEST_POOL.find((t) => t.id === slot.id);
      if (!tpl || tpl.metric !== metric) continue;

      let nextVal = slot.progress || 0;
      if (metric === 'timersSurvived' || metric === 'stagesCleared') {
        nextVal = Math.min(tpl.target, nextVal + Math.max(0, value));
      } else if (metric === 'prestige2') {
        if (value >= 2) nextVal = 1;
      } else {
        nextVal = Math.min(tpl.target, Math.max(nextVal, Math.round(value || 0)));
      }
      if (nextVal !== slot.progress) {
        slot.progress = nextVal;
        changed = true;
      }
    }
    if (changed) this.save();
    return changed;
  },

  claimQuest(slotIndex) {
    const qList = this.getActiveQuests();
    const item = qList[slotIndex];
    if (!item || !item.ready || item.claimed) return null;

    this.quests.active[slotIndex].claimed = true;
    this.stats.lifetimeScore = (this.stats.lifetimeScore || 0) + (item.rewardRP || 0);

    let setCompleted = false;
    if (this.quests.active.every((s) => s.claimed)) {
      setCompleted = true;
      this.quests.setIndex = (this.quests.setIndex || 1) + 1;
      this.quests.multiplier = Math.min(2.0, Math.round(((this.quests.multiplier || 1.0) + 0.15) * 100) / 100);
      // Rotate next 3 quests cleanly from pool
      const offset = ((this.quests.setIndex - 1) * 3) % QUEST_POOL.length;
      const nextSlots = [];
      for (let k = 0; k < 3; k++) {
        const tpl = QUEST_POOL[(offset + k) % QUEST_POOL.length];
        nextSlots.push({ id: tpl.id, progress: tpl.metric === 'world1Stars' ? this.getWorld1Stars() : 0, claimed: false });
      }
      this.quests.active = nextSlots;
    }

    this.save();
    return {
      quest: item,
      rewardRP: item.rewardRP,
      setCompleted,
      multiplier: this.getQuestMultiplier(),
    };
  },

  likeCount(id, base) {
    return base + (this.data.likes[id] || 0);
  },

  isLiked(id) {
    return (this.data.likes[id] || 0) > 0;
  },

  toggleLike(id) {
    this.data.likes[id] = this.data.likes[id] ? 0 : 1;
    this.save();
    return this.data.likes[id] > 0;
  },
};

store.load();
