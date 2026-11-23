// Persistence: frozen game snapshots, normalized RP progression, World 1 map & quests saved to localStorage.
import {
  GAME_PACKS,
  WORLD_1_NODES,
  WORLD_1_CHESTS,
  QUEST_POOL,
  getPackForGame,
  getWorldNodeById,
  getStarsForScore,
} from '../games/registry.js';

const KEY = 'GAME_REELS_V3';
const LEGACY_KEY = 'GAME_REELS_V2';

export const RANKS = [
  { min: 0, title: 'Sprout Bean', icon: '🌱', next: 25000 },
  { min: 25000, title: 'Bronze Bean', icon: '🥉', next: 100000 },
  { min: 100000, title: 'Silver Bean', icon: '🥈', next: 250000 },
  { min: 250000, title: 'Gold Bean', icon: '🥇', next: 600000 },
  { min: 600000, title: 'Diamond Bean', icon: '💎', next: 1500000 },
  { min: 1500000, title: 'Apex Legend', icon: '👑', next: null },
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
  hapticsEnabled: true,
  screenShakeEnabled: true,
});

export const SKINS = [
  { id: 'cyan', name: 'Electric Cyan', color: '#25e6ff', belly: '#1ec0db', unlockCost: 0, desc: 'High-voltage candy gloss' },
  { id: 'classic', name: 'Classic Berry', color: '#ff3366', belly: '#ff758c', unlockCost: 0, desc: 'Original jellybean shine' },
  { id: 'lime', name: 'Toxic Lime', color: '#39ff14', belly: '#00b33c', unlockCost: 15000, desc: 'Radioactive citrus burst' },
  { id: 'gold', name: 'Golden Glow', color: '#ffd166', belly: '#ff9f1c', unlockCost: 50000, desc: 'Gauntlet champion luster' },
  { id: 'obsidian', name: 'Obsidian Void', color: '#7c5cff', belly: '#4a148c', unlockCost: 100000, desc: 'Cosmic dark matter finish' },
  { id: 'bubblegum', name: 'Bubblegum', color: '#ff70a6', belly: '#ff9770', unlockCost: 200000, desc: 'Chewy sweet perfection' },
  { id: 'glacier', name: 'Glacier Frost', color: '#e0fbfc', belly: '#98c1d9', unlockCost: 350000, desc: 'Sub-zero cryo crystal' },
  { id: 'magma', name: 'Inferno Magma', color: '#ff4b5c', belly: '#e63946', unlockCost: 500000, desc: 'Volcanic sugar eruption' },
];

export const HATS = [
  { id: 'none', name: 'Pure Bean', icon: '🫘', unlockCost: 0, desc: 'Natural aerodynamic shape' },
  { id: 'crown', name: 'King Crown', icon: '👑', unlockCost: 25000, desc: 'Royalty of the 60s realm' },
  { id: 'tophat', name: 'Top Hat', icon: '🎩', unlockCost: 50000, desc: 'Distinguished gentleman' },
  { id: 'astro', name: 'Astro Dome', icon: '🚀', unlockCost: 100000, desc: 'Pressurized space helmet' },
  { id: 'ninja', name: 'Shinobi Mask', icon: '🥷', unlockCost: 150000, desc: 'Silent shadow runner' },
  { id: 'viking', name: 'Viking Helm', icon: '🪓', unlockCost: 250000, desc: 'Horned berserker strength' },
  { id: 'chef', name: 'Chef Toque', icon: '🍳', unlockCost: 400000, desc: 'Five-star arcade chef' },
  { id: 'party', name: 'Party Cone', icon: '🎉', unlockCost: 600000, desc: 'Confetti jubilee celebration' },
];

// Calibrated to the normalized 10-stage Reel Points economy (~16,100 RP avg for full clear)
export const DAILY_MEDALS = [
  { id: 'gold', name: 'Gold Medal', icon: '🥇', minScore: 20000, desc: 'Apex Gauntlet Master' },
  { id: 'silver', name: 'Silver Medal', icon: '🥈', minScore: 15000, desc: 'Veteran Gauntlet Runner' },
  { id: 'bronze', name: 'Bronze Medal', icon: '🥉', minScore: 10000, desc: 'Proven Challenger' },
];

export function getDailyMedal(score = 0) {
  for (const m of DAILY_MEDALS) {
    if (score >= m.minScore) return m;
  }
  return null;
}

export function getUtcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function getDailySeed(dateStr = getUtcDayKey()) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = Math.imul(h ^ dateStr.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

export function getDailyGameIndices(eligible = 20, count = 10, dateStr = getUtcDayKey()) {
  const seed = getDailySeed(dateStr);
  let s = seed;
  const rng = () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const indices = Array.isArray(eligible)
    ? [...eligible]
    : Array.from({ length: eligible }, (_, i) => i);

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, Math.min(count, indices.length));
}

const defaultCloset = () => ({
  skinId: 'cyan',
  hatId: 'none',
});

const defaultDaily = () => ({
  lastCompletedDay: null,
  streak: 0,
  bestStreak: 0,
  history: {}, // 'YYYY-MM-DD' -> { score: number, medal: string, timestamp: number }
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

const defaultProgression = () => ({
  unlockedPacks: ['starter'],
  revealedPacks: ['starter'],
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
  claimedChests: [],
  world2Unlocked: false,
});

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
  if (!Array.isArray(w.claimedChests)) w.claimedChests = [];
  if (w.nodes['1-5']?.cleared) w.world2Unlocked = true;
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
    meta: freshMeta(),
    games: {},
    likes: {},
    settings: defaultSettings(),
    profile: defaultProfile(),
    stats: defaultStats(),
    closet: defaultCloset(),
    daily: defaultDaily(),
    progression: defaultProgression(),
    worlds: defaultWorlds(),
    quests: defaultQuests(),
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
        const closet = { ...defaultCloset(), ...(p.closet || {}) };
        const daily = { ...defaultDaily(), ...(p.daily || {}) };
        const progression = { ...defaultProgression(), ...(p.progression || {}) };
        if (!Array.isArray(progression.unlockedPacks) || !progression.unlockedPacks.includes('starter')) {
          progression.unlockedPacks = ['starter', ...(Array.isArray(progression.unlockedPacks) ? progression.unlockedPacks : [])];
        }
        if (!Array.isArray(progression.revealedPacks) || !progression.revealedPacks.includes('starter')) {
          progression.revealedPacks = ['starter', ...(Array.isArray(progression.revealedPacks) ? progression.revealedPacks : [])];
        }
        if (!stats.gameHighScores || typeof stats.gameHighScores !== 'object') {
          stats.gameHighScores = {};
        }
        if (!daily.history || typeof daily.history !== 'object') {
          daily.history = {};
        }
        const worlds = normalizeWorldsState(p.worlds);
        const quests = normalizeQuestsState(p.quests);

        this.data = {
          started: !!p.started,
          meta,
          games: p.games || {},
          likes: p.likes || {},
          settings,
          profile,
          stats,
          closet,
          daily,
          progression,
          worlds,
          quests,
        };
        this.checkPackUnlocks();
        return;
      }

      // Migrate non-economy preferences from legacy V2 save so existing players keep their name, avatar, settings & likes
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        const lp = JSON.parse(legacyRaw);
        this.data = {
          started: false,
          meta: freshMeta(),
          games: {},
          likes: lp.likes || {},
          settings: { ...defaultSettings(), ...(lp.settings || {}) },
          profile: { ...defaultProfile(), ...(lp.profile || {}) },
          stats: defaultStats(),
          closet: defaultCloset(),
          daily: defaultDaily(),
          progression: defaultProgression(),
          worlds: defaultWorlds(),
          quests: defaultQuests(),
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

  get progression() {
    if (!this.data.progression) this.data.progression = defaultProgression();
    return this.data.progression;
  },

  hasSession() {
    return this.data.started;
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

  /* ----------------------------------------------------------- Pack Progression */
  isPackUnlocked(packId) {
    return this.progression.unlockedPacks.includes(packId);
  },

  isPackRevealed(packId) {
    return this.progression.revealedPacks.includes(packId);
  },

  isGameUnlocked(gameId) {
    const pack = getPackForGame(gameId);
    return !!pack && !pack.comingSoon && this.isPackUnlocked(pack.id);
  },

  getUnlockedGameIds() {
    const ids = [];
    for (const pack of GAME_PACKS) {
      if (!pack.comingSoon && this.isPackUnlocked(pack.id)) {
        ids.push(...pack.gameIds);
      }
    }
    return ids;
  },

  getTotalPlayableGameCount() {
    return GAME_PACKS.reduce((sum, p) => sum + (p.comingSoon ? 0 : p.gameIds.length), 0);
  },

  getStatValue(type) {
    const s = this.stats;
    if (type === 'timersSurvived') return s.timersSurvived || 0;
    if (type === 'stagesCleared') return s.stagesCleared || 0;
    if (type === 'maxCycle') return s.maxCycle || 1;
    return s.lifetimeScore || 0;
  },

  getPackProgress(pack) {
    const unlocked = !pack.comingSoon && this.isPackUnlocked(pack.id);
    const req = pack.unlockRequirement;
    if (!req) {
      return { current: 1, target: 1, pct: 1, remaining: 0, unlocked: true, comingSoon: false };
    }
    const current = this.getStatValue(req.type);
    const target = Math.max(1, req.target);
    const pct = unlocked ? 1 : Math.min(1, Math.max(0, current / target));
    const remaining = unlocked ? 0 : Math.max(0, target - current);
    return { current, target, pct, remaining, unlocked, comingSoon: !!pack.comingSoon };
  },

  getNextLockedPack() {
    return (
      GAME_PACKS.find((p) => !p.comingSoon && !this.isPackUnlocked(p.id)) ||
      GAME_PACKS.find((p) => p.comingSoon) ||
      null
    );
  },

  getPendingRevealPacks() {
    return GAME_PACKS.filter(
      (p) => !p.comingSoon && this.isPackUnlocked(p.id) && !this.isPackRevealed(p.id)
    );
  },

  checkPackUnlocks() {
    const newlyUnlocked = [];
    for (const pack of GAME_PACKS) {
      if (pack.comingSoon || this.isPackUnlocked(pack.id)) continue;
      const req = pack.unlockRequirement;
      if (!req || this.getStatValue(req.type) >= req.target) {
        this.progression.unlockedPacks.push(pack.id);
        newlyUnlocked.push(pack);
      }
    }
    if (newlyUnlocked.length > 0) this.save();
    return newlyUnlocked;
  },

  markPackRevealed(packId) {
    if (!this.progression.revealedPacks.includes(packId)) {
      this.progression.revealedPacks.push(packId);
      this.save();
    }
  },

  adminUnlockAllPacks() {
    for (const p of GAME_PACKS) {
      if (p.comingSoon) continue;
      if (!this.progression.unlockedPacks.includes(p.id)) this.progression.unlockedPacks.push(p.id);
      if (!this.progression.revealedPacks.includes(p.id)) this.progression.revealedPacks.push(p.id);
    }
    this.save();
  },

  adminResetPacks() {
    this.progression.unlockedPacks = ['starter'];
    this.progression.revealedPacks = ['starter'];
    this.save();
  },

  adminAddRP(delta = 10000) {
    this.stats.lifetimeScore = Math.max(0, (this.stats.lifetimeScore || 0) + delta);
    const newly = this.checkPackUnlocks();
    this.save();
    return newly;
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

  get closet() {
    if (!this.data.closet) this.data.closet = defaultCloset();
    return this.data.closet;
  },

  isSkinUnlocked(skinId) {
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin || skin.unlockCost === 0) return true;
    return (this.stats.lifetimeScore || 0) >= skin.unlockCost;
  },

  isHatUnlocked(hatId) {
    const hat = HATS.find((h) => h.id === hatId);
    if (!hat || hat.unlockCost === 0) return true;
    return (this.stats.lifetimeScore || 0) >= hat.unlockCost;
  },

  equipSkin(skinId) {
    if (!this.isSkinUnlocked(skinId)) return false;
    this.closet.skinId = skinId;
    this.save();
    return true;
  },

  equipHat(hatId) {
    if (!this.isHatUnlocked(hatId)) return false;
    this.closet.hatId = hatId;
    this.save();
    return true;
  },

  get daily() {
    if (!this.data.daily) this.data.daily = defaultDaily();
    return this.data.daily;
  },

  getTodayDaily() {
    const today = getUtcDayKey();
    return this.daily.history?.[today] || null;
  },

  recordDailyResult(score) {
    const today = getUtcDayKey();
    const daily = this.daily;
    const existing = daily.history[today];
    const bestScore = existing ? Math.max(existing.score, Math.round(score)) : Math.round(score);
    const bestMedalObj = getDailyMedal(bestScore);

    if (!existing) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (daily.lastCompletedDay === yesterday) {
        daily.streak = (daily.streak || 0) + 1;
      } else if (daily.lastCompletedDay !== today) {
        daily.streak = 1;
      }
      daily.lastCompletedDay = today;
      daily.bestStreak = Math.max(daily.bestStreak || 0, daily.streak);
    }

    daily.history[today] = {
      score: bestScore,
      medal: bestMedalObj ? bestMedalObj.id : 'none',
      timestamp: Date.now(),
    };

    // Individual daily stages already credit netRP into lifetimeScore on survive/victory/death.
    this.save();

    return {
      score: bestScore,
      medal: bestMedalObj,
      streak: daily.streak,
      isNewDay: !existing,
    };
  },

  reset() {
    const likes = this.data.likes;
    const settings = this.data.settings || defaultSettings();
    const profile = this.data.profile || defaultProfile();
    const stats = this.data.stats || defaultStats();
    const closet = this.data.closet || defaultCloset();
    const daily = this.data.daily || defaultDaily();
    const progression = this.progression;
    const worlds = this.worlds;
    const quests = this.quests;
    this.data = { started: true, meta: freshMeta(), games: {}, likes, settings, profile, stats, closet, daily, progression, worlds, quests };
    this.save();
  },

  abandonSession() {
    const likes = this.data.likes;
    const settings = this.data.settings || defaultSettings();
    const profile = this.data.profile || defaultProfile();
    const stats = this.data.stats || defaultStats();
    const closet = this.data.closet || defaultCloset();
    const daily = this.data.daily || defaultDaily();
    const progression = this.progression;
    const worlds = this.worlds;
    const quests = this.quests;
    this.data = { started: false, meta: freshMeta(), games: {}, likes, settings, profile, stats, closet, daily, progression, worlds, quests };
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

  getNextUnclaimedChest() {
    const stars = this.getWorld1Stars();
    const claimed = this.worlds.claimedChests || [];
    for (const chest of WORLD_1_CHESTS) {
      if (!claimed.includes(chest.id)) {
        return { ...chest, stars, ready: stars >= chest.starsReq };
      }
    }
    return null;
  },

  getClaimableChestCount() {
    const stars = this.getWorld1Stars();
    const claimed = this.worlds.claimedChests || [];
    return WORLD_1_CHESTS.filter((c) => !claimed.includes(c.id) && stars >= c.starsReq).length;
  },

  isChestClaimed(chestId) {
    return (this.worlds.claimedChests || []).includes(chestId);
  },

  claimStarChest(chestId) {
    const chest = WORLD_1_CHESTS.find((c) => c.id === chestId);
    if (!chest) return null;
    if (this.isChestClaimed(chestId)) return null;
    if (this.getWorld1Stars() < chest.starsReq) return null;

    if (!Array.isArray(this.worlds.claimedChests)) this.worlds.claimedChests = [];
    this.worlds.claimedChests.push(chest.id);
    this.stats.lifetimeScore = (this.stats.lifetimeScore || 0) + (chest.rewardRP || 0);
    const newlyUnlockedPacks = this.checkPackUnlocks();
    this.save();
    return { chest, newlyUnlockedPacks };
  },

  recordWorldRunResult(nodeId, rawRunScore = 0) {
    const node = getWorldNodeById(nodeId);
    const score = Math.max(0, Math.round(rawRunScore || 0));
    const starsEarned = getStarsForScore(node, score);
    const prev = this.getNodeState(node.id);
    const prevCleared = !!prev.cleared;
    const clearedNow = score >= node.clearScore;
    const isFirstClear = clearedNow && !prevCleared;
    const bonusRP = isFirstClear ? (node.firstClearBonusRP || 0) : 0;

    if (!this.worlds.nodes) this.worlds.nodes = {};
    this.worlds.nodes[node.id] = {
      unlocked: true,
      cleared: prevCleared || clearedNow,
      stars: Math.max(prev.stars || 0, starsEarned),
      bestScore: Math.max(prev.bestScore || 0, score),
    };

    let nextUnlockedNode = null;
    let world2JustUnlocked = false;
    if (clearedNow) {
      const nextNode = WORLD_1_NODES[node.index + 1] || null;
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

    if (bonusRP > 0) {
      this.stats.lifetimeScore = (this.stats.lifetimeScore || 0) + bonusRP;
    }

    // Update Star Hunter quest if active
    this.recordQuestProgress('world1Stars', this.getWorld1Stars());
    const newlyUnlockedPacks = this.checkPackUnlocks();
    this.save();

    return {
      node,
      score,
      starsEarned,
      bestStars: this.worlds.nodes[node.id].stars,
      clearedNow,
      isFirstClear,
      firstClearBonusRP: bonusRP,
      nextUnlockedNode,
      world2JustUnlocked,
      newlyUnlockedPacks,
    };
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
      } else if (metric === 'prestige2' || metric === 'dailyPlayed') {
        if (value >= 1) nextVal = Math.max(nextVal, metric === 'prestige2' ? (value >= 2 ? 1 : 0) : 1);
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
      this.quests.multiplier = Math.min(2.0, Math.round(((this.quests.multiplier || 1.0) + 0.1) * 10) / 10);
      // Rotate next 3 quests cleanly from pool
      const offset = ((this.quests.setIndex - 1) * 3) % QUEST_POOL.length;
      const nextSlots = [];
      for (let k = 0; k < 3; k++) {
        const tpl = QUEST_POOL[(offset + k) % QUEST_POOL.length];
        nextSlots.push({ id: tpl.id, progress: tpl.metric === 'world1Stars' ? this.getWorld1Stars() : 0, claimed: false });
      }
      this.quests.active = nextSlots;
    }

    const newlyUnlockedPacks = this.checkPackUnlocks();
    this.save();
    return {
      quest: item,
      rewardRP: item.rewardRP,
      setCompleted,
      multiplier: this.getQuestMultiplier(),
      newlyUnlockedPacks,
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
