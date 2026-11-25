// Single Source of Truth Registry: imports all reel games, reads metadata/cues/scaling
// directly from each GameClass.meta, and enforces the Playbook Contract.
import { Game } from '../engine/Game.js';
import { VoidEater } from './voidEater.js';
import { DeepFeeder } from './deepFeeder.js';
import { TowerSlice } from './towerSlice.js';
import { MultiplierRunner } from './multiplierRunner.js';
import { FruitMerge } from './fruitMerge.js';
import { Motherload } from './motherload.js';
import { DoodleJump } from './doodleJump.js';
import { PaperIo } from './paperIo.js';
import { BlockBuster } from './blockBuster.js';
import { CrossyRoad } from './crossyRoad.js';
import { ZombieFortress } from './zombieFortress.js';
import { SubwaySurfers } from './subwaySurfers.js';
import { SaveTheBean } from './saveTheBean.js';
import { BeanTD } from './beanTD.js';
import { ColorClash } from './colorClash.js';
import { BallBlast } from './ballBlast.js';
import { SledSurfers } from './sledSurfers.js';
import { BeanBreaker } from './beanBreaker.js';
import { BeanSurvivors } from './beanSurvivors.js';
import { BeanHelix } from './beanHelix.js';
import { CitadelSiegeBoss } from './citadelSiege.js';

// Internal WIP Game Bank (Future Worlds / World 2+ — dev/admin playtesting ONLY, not user-facing)
import { LaserDodge } from './bank/laserDodge.js';
import { GravityFlip } from './bank/gravityFlip.js';
import { MeteorSmasher } from './bank/meteorSmasher.js';
import { RhythmDash } from './bank/rhythmDash.js';
import { AgeOfBeans } from './bank/ageOfBeans.js';

export const STARTER_GAMES = [
  VoidEater,
  DeepFeeder,
  TowerSlice,
  MultiplierRunner,
  FruitMerge,
  Motherload,
  DoodleJump,
  PaperIo,
  BlockBuster,
  CrossyRoad,
  ZombieFortress,
  SubwaySurfers,
  SaveTheBean,
  BeanTD,
  ColorClash,
  BallBlast,
  SledSurfers,
  BeanBreaker,
  BeanSurvivors,
  BeanHelix,
  CitadelSiegeBoss,
];

// Active user-facing roster: starting 20 World 1 reels + Lord Brim's Citadel Boss (21 total).
export const GAMES = [...STARTER_GAMES];

export const GAME_BY_ID = Object.fromEntries(GAMES.map((G) => [G.meta.id, G]));

// Non-user-facing WIP Bank for future Worlds & internal iteration (launched only via Dev/Admin tools).
export const GAME_BANK = [
  LaserDodge,
  GravityFlip,
  MeteorSmasher,
  RhythmDash,
  AgeOfBeans,
];

export const GAME_BANK_BY_ID = Object.fromEntries(GAME_BANK.map((G) => [G.meta.id, G]));

export function getAnyGameById(gameId) {
  if (!gameId) return null;
  return GAME_BY_ID[gameId] || GAME_BANK_BY_ID[gameId] || null;
}

export function isPrestigeGame(gameClassOrId) {
  if (!gameClassOrId) return false;
  if (typeof gameClassOrId === 'string') {
    return Boolean(getAnyGameById(gameClassOrId)?.meta?.isPrestige);
  }
  return Boolean(gameClassOrId?.meta?.isPrestige);
}

export function getGameParScore(gameId) {
  return getAnyGameById(gameId)?.meta?.parScore60s || 1500;
}

export function getGameCue(gameId) {
  return getAnyGameById(gameId)?.meta?.cue || '';
}

export function getGamePrestigeCue(gameId) {
  return getAnyGameById(gameId)?.meta?.prestigeCue || 'HARDER & FASTER!';
}

export function getGameScaling(gameId) {
  return getAnyGameById(gameId)?.meta?.scaling || {};
}

export function validateGameContract(GameClass) {
  const errors = [];
  const label = GameClass?.meta?.id || GameClass?.name || 'UnknownGame';

  if (typeof GameClass !== 'function' || !(GameClass.prototype instanceof Game)) {
    errors.push(`${label}: must extend Game`);
    return errors;
  }

  const meta = GameClass.meta;
  if (!meta || typeof meta !== 'object') {
    errors.push(`${label}: missing static meta`);
    return errors;
  }

  for (const key of ['id', 'title', 'icon', 'hint', 'cue', 'prestigeCue']) {
    if (typeof meta[key] !== 'string' || meta[key].trim().length === 0) {
      errors.push(`${label}: meta.${key} must be a non-empty string`);
    }
  }
  if (typeof meta.isPrestige !== 'boolean') {
    errors.push(`${label}: meta.isPrestige must be a boolean`);
  }
  if (!Number.isFinite(meta.parScore60s) || meta.parScore60s <= 0) {
    errors.push(`${label}: meta.parScore60s must be a positive number`);
  }

  if (!meta.scaling || typeof meta.scaling !== 'object' || Object.keys(meta.scaling).length === 0) {
    errors.push(`${label}: meta.scaling must define at least one difficulty parameter`);
  } else {
    for (const [sKey, spec] of Object.entries(meta.scaling)) {
      if (!spec || typeof spec !== 'object') {
        errors.push(`${label}: meta.scaling.${sKey} must be an object`);
        continue;
      }
      if (!Number.isFinite(spec.base)) {
        errors.push(`${label}: meta.scaling.${sKey}.base must be finite`);
      }
      if (!Number.isFinite(spec.rate) || spec.rate <= 0) {
        errors.push(`${label}: meta.scaling.${sKey}.rate must be > 0`);
      }
      const isDown = spec.mode === 'down' || Number.isFinite(spec.floor);
      if (isDown) {
        if (!Number.isFinite(spec.floor) || spec.floor >= spec.base) {
          errors.push(`${label}: meta.scaling.${sKey}.floor must be < base`);
        }
      } else if (!Number.isFinite(spec.cap) || spec.cap <= spec.base) {
        errors.push(`${label}: meta.scaling.${sKey}.cap must be > base`);
      }
      if (typeof spec.label !== 'string' || spec.label.trim().length === 0) {
        errors.push(`${label}: meta.scaling.${sKey}.label must be a non-empty string`);
      }
    }
  }

  for (const method of ['init', 'update', 'render', 'serialize', 'restoreLabel']) {
    if (typeof GameClass.prototype[method] !== 'function' || GameClass.prototype[method] === Game.prototype[method]) {
      errors.push(`${label}: must implement ${method}()`);
    }
  }

  return errors;
}

export function validateAllGames(games = GAMES) {
  const errors = [];
  const seenIds = new Set();
  for (const G of games) {
    const id = G?.meta?.id;
    if (id) {
      if (seenIds.has(id)) errors.push(`Duplicate game id: ${id}`);
      seenIds.add(id);
    }
    errors.push(...validateGameContract(G));
  }
  return errors;
}

// Single Source of Truth for World 1 Overworld Progression (4 -> 8 -> 12 -> 16 -> 20 Reels, then 1-6 Boss Finale)
// Star thresholds are calibrated to Reel.js normalized RP + survival/victory payouts (~1,200–1,650 PTS/reel).
export const WORLD_1_NODES = [
  {
    id: '1-1',
    worldId: 'world-1',
    code: '1-1',
    index: 0,
    title: 'Snack Street',
    subtitle: 'Starter Square · 4 Reels',
    icon: '🍔',
    clearScore: 4000,
    starScores: [4000, 6000, 9000],
    firstClearBonusRP: 500,
    gameIds: STARTER_GAMES.slice(0, 4).map((G) => G.meta.id),
    pos: { x: 200, y: 635 },
    pathFromPrev: null,
  },
  {
    id: '1-2',
    worldId: 'world-1',
    code: '1-2',
    index: 1,
    title: 'Harbor Drop',
    subtitle: 'Reef Basin · 8 Reels',
    icon: '🐠',
    clearScore: 8500,
    starScores: [8500, 12000, 17500],
    firstClearBonusRP: 1000,
    gameIds: STARTER_GAMES.slice(0, 8).map((G) => G.meta.id),
    pos: { x: 308, y: 535 },
    pathFromPrev: [
      [200, 635],
      [238, 603],
      [274, 570],
      [308, 535],
    ],
  },
  {
    id: '1-3',
    worldId: 'world-1',
    code: '1-3',
    index: 2,
    title: 'Brick District',
    subtitle: 'Spire Crossing · 12 Reels',
    icon: '🏰',
    clearScore: 13000,
    starScores: [13000, 18000, 25000],
    firstClearBonusRP: 1500,
    gameIds: STARTER_GAMES.slice(0, 12).map((G) => G.meta.id),
    pos: { x: 155, y: 434 },
    pathFromPrev: [
      [308, 535],
      [276, 498],
      [248, 464],
      [208, 446],
      [155, 434],
    ],
  },
  {
    id: '1-4',
    worldId: 'world-1',
    code: '1-4',
    index: 3,
    title: 'Skyline Siege',
    subtitle: 'Carnival Ridge · 16 Reels',
    icon: '🎪',
    clearScore: 17500,
    starScores: [17500, 24000, 33000],
    firstClearBonusRP: 2000,
    gameIds: STARTER_GAMES.slice(0, 16).map((G) => G.meta.id),
    pos: { x: 306, y: 369 },
    pathFromPrev: [
      [155, 434],
      [196, 408],
      [226, 382],
      [266, 369],
      [306, 369],
    ],
  },
  {
    id: '1-5',
    worldId: 'world-1',
    code: '1-5',
    index: 4,
    title: 'Apex Spire',
    subtitle: 'Helix Terrace · 20 Reels',
    icon: '🌀',
    clearScore: 22000,
    starScores: [22000, 30000, 42000],
    firstClearBonusRP: 3500,
    gameIds: STARTER_GAMES.slice(0, 20).map((G) => G.meta.id),
    pos: { x: 188, y: 271 },
    pathFromPrev: [
      [306, 369],
      [260, 344],
      [234, 306],
      [188, 271],
    ],
  },
  {
    id: '1-6',
    worldId: 'world-1',
    code: '1-6',
    index: 5,
    title: "Lord Brim's Citadel",
    subtitle: 'Final Boss · Summit Keep',
    icon: '👑',
    isBoss: true,
    clearScore: 2500,
    starScores: [2500, 3000, 3500],
    firstClearBonusRP: 5000,
    gameIds: [CitadelSiegeBoss.meta.id],
    pos: { x: 250, y: 217 },
    pathFromPrev: [
      [188, 271],
      [208, 248],
      [228, 228],
      [250, 217],
    ],
  },
];

export const WORLDS = [
  {
    id: 'world-1',
    number: 1,
    title: 'SUNNY TOY ISLES',
    nodes: WORLD_1_NODES,
    totalStars: WORLD_1_NODES.length * 3,
    portalPos: { x: 189, y: 170 },
    portalPath: [
      [250, 217],
      [218, 198],
      [189, 176],
    ],
  },
];

export const QUEST_POOL = [
  {
    id: 'survive_reels',
    title: 'Survival Streak',
    desc: 'Survive 4 total 60s reels',
    metric: 'timersSurvived',
    target: 4,
    rewardRP: 750,
    icon: '⏱️',
  },
  {
    id: 'prestige_up',
    title: 'Prestige Climber',
    desc: 'Reach Prestige 2 in any reel',
    metric: 'prestige2',
    target: 1,
    rewardRP: 800,
    icon: '★',
  },
  {
    id: 'score_run',
    title: 'High Roller',
    desc: 'Reach 5,000 PTS in a single run',
    metric: 'runScore',
    target: 5000,
    rewardRP: 900,
    icon: '💎',
  },
  {
    id: 'clear_victories',
    title: 'Stage Conqueror',
    desc: 'Clear 2 Prestige stages',
    metric: 'stagesCleared',
    target: 2,
    rewardRP: 1100,
    icon: '⭐',
  },
  {
    id: 'earn_w1_stars',
    title: 'Star Hunter',
    desc: 'Hold at least 3 World 1 Stars',
    metric: 'world1Stars',
    target: 3,
    rewardRP: 1250,
    icon: '🌟',
  },
];

export function getWorldById(worldId = 'world-1') {
  return WORLDS.find((w) => w.id === worldId) || WORLDS[0];
}

export function getWorldNodeById(nodeId) {
  for (const w of WORLDS) {
    const found = w.nodes.find((n) => n.id === nodeId);
    if (found) return found;
  }
  return WORLD_1_NODES[0];
}

export function getWorldTotalStars(worldId = 'world-1') {
  return getWorldById(worldId).nodes.length * 3;
}

export function getStarsForScore(node, score = 0) {
  if (!node || !Array.isArray(node.starScores)) return 0;
  let stars = 0;
  for (const threshold of node.starScores) {
    if (score >= threshold) stars += 1;
  }
  return stars;
}
