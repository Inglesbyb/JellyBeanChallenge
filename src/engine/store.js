// Persistence: frozen game snapshots + run meta, saved to localStorage.
const KEY = 'GAME_REELS_V2';

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
  results: new Array(32).fill(null),
  eliminated: {}, // gameId -> boolean
  prestige: {}, // gameId -> completed-run rank (absent = 1). Wiped on every new run.
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

export const DAILY_MEDALS = [
  { id: 'gold', name: 'Gold Medal', icon: '🥇', minScore: 60000, desc: 'Apex Gauntlet Master' },
  { id: 'silver', name: 'Silver Medal', icon: '🥈', minScore: 35000, desc: 'Veteran Gauntlet Runner' },
  { id: 'bronze', name: 'Bronze Medal', icon: '🥉', minScore: 15000, desc: 'Proven Challenger' },
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

export function getDailyGameIndices(totalGames = 20, count = 10, dateStr = getUtcDayKey()) {
  const seed = getDailySeed(dateStr);
  let s = seed;
  const rng = () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const indices = Array.from({ length: totalGames }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count);
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
  },

  load() {
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
        if (Array.isArray(meta.results) && meta.results.length < fresh.results.length) {
          while (meta.results.length < fresh.results.length) {
            meta.results.push(null);
          }
        }
        const settings = { ...defaultSettings(), ...(p.settings || {}) };
        const profile = { ...defaultProfile(), ...(p.profile || {}) };
        const stats = { ...defaultStats(), ...(p.stats || {}) };
        const closet = { ...defaultCloset(), ...(p.closet || {}) };
        const daily = { ...defaultDaily(), ...(p.daily || {}) };
        if (!stats.gameHighScores || typeof stats.gameHighScores !== 'object') {
          stats.gameHighScores = {};
        }
        if (!daily.history || typeof daily.history !== 'object') {
          daily.history = {};
        }
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
        };
      }
    } catch (e) {
      console.warn('store load failed', e);
    }
  },

  save() {
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

  // Prestige rank for a game in this run (1 = never completed).
  getPrestige(id) {
    return this.data.meta.prestige?.[id] || 1;
  },

  // Mark a game as COMPLETED: it stays in rotation, but its frozen (maxed-out)
  // board is discarded and it restarts at the next prestige rank. Returns the new rank.
  promote(id) {
    if (!this.data.meta.prestige) this.data.meta.prestige = {};
    const next = this.getPrestige(id) + 1;
    this.data.meta.prestige[id] = next;
    delete this.data.games[id];
    this.save();
    return next;
  },

  // How many distinct games have been completed at least once this run.
  clearedCount() {
    return Object.values(this.data.meta.prestige || {}).filter((v) => v > 1).length;
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

  recordRoundSurvive(gameId, score) {
    const stats = this.stats;
    stats.timersSurvived = (stats.timersSurvived || 0) + 1;
    stats.lifetimeScore = (stats.lifetimeScore || 0) + Math.max(0, Math.round(score || 0));
    if (!stats.gameHighScores) stats.gameHighScores = {};
    stats.gameHighScores[gameId] = Math.max(stats.gameHighScores[gameId] || 0, Math.round(score || 0));
    this.save();
  },

  recordGameScore(gameId, score) {
    const stats = this.stats;
    if (!stats.gameHighScores) stats.gameHighScores = {};
    stats.gameHighScores[gameId] = Math.max(stats.gameHighScores[gameId] || 0, Math.round(score || 0));
    this.save();
  },

  recordStageVictory(gameId, score, bonus) {
    const stats = this.stats;
    stats.stagesCleared = (stats.stagesCleared || 0) + 1;
    stats.lifetimeScore = (stats.lifetimeScore || 0) + Math.max(0, Math.round(bonus || 0));
    if (!stats.gameHighScores) stats.gameHighScores = {};
    stats.gameHighScores[gameId] = Math.max(stats.gameHighScores[gameId] || 0, Math.round(score || 0));
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
    const medalObj = getDailyMedal(score);

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

    this.stats.lifetimeScore = (this.stats.lifetimeScore || 0) + Math.max(0, Math.round(score));
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
    this.data = { started: true, meta: freshMeta(), games: {}, likes, settings, profile, stats, closet, daily };
    this.save();
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
