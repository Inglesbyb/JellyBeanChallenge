// Persistence: frozen game snapshots + run meta, saved to localStorage.
const KEY = 'GAME_REELS_V2';

const freshMeta = () => ({
  cycle: 1,
  index: 0,
  global: 0,
  cycleBase: 0,
  results: new Array(32).fill(null),
  eliminated: {}, // gameId -> boolean
});

export const store = {
  data: { started: false, meta: freshMeta(), games: {}, likes: {} },

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
        if (Array.isArray(meta.results) && meta.results.length < fresh.results.length) {
          while (meta.results.length < fresh.results.length) {
            meta.results.push(null);
          }
        }
        this.data = {
          started: !!p.started,
          meta,
          games: p.games || {},
          likes: p.likes || {},
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

  reset() {
    const likes = this.data.likes;
    this.data = { started: true, meta: freshMeta(), games: {}, likes };
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
