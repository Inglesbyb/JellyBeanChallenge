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
import { AgeOfBeans } from './ageOfBeans.js';
import { BeanSurvivors } from './beanSurvivors.js';
import { BeanHelix } from './beanHelix.js';

// Mystery Pack 1
import { BeanBreaker } from './beanBreaker.js';
import { LaserDodge } from './laserDodge.js';
import { GravityFlip } from './gravityFlip.js';
import { MeteorSmasher } from './meteorSmasher.js';
import { RhythmDash } from './rhythmDash.js';

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
  AgeOfBeans,
  BeanSurvivors,
  BeanHelix,
];

export const PACK_1_GAMES = [
  BeanBreaker,
  LaserDodge,
  GravityFlip,
  MeteorSmasher,
  RhythmDash,
];

export const GAMES = [...STARTER_GAMES, ...PACK_1_GAMES];

export const GAME_BY_ID = Object.fromEntries(GAMES.map((G) => [G.meta.id, G]));

export function isPrestigeGame(gameClassOrId) {
  if (!gameClassOrId) return false;
  if (typeof gameClassOrId === 'string') {
    return Boolean(GAME_BY_ID[gameClassOrId]?.meta?.isPrestige);
  }
  return Boolean(gameClassOrId?.meta?.isPrestige);
}

export function getGameParScore(gameId) {
  return GAME_BY_ID[gameId]?.meta?.parScore60s || 1500;
}

export function getGameCue(gameId) {
  return GAME_BY_ID[gameId]?.meta?.cue || '';
}

export function getGamePrestigeCue(gameId) {
  return GAME_BY_ID[gameId]?.meta?.prestigeCue || 'HARDER & FASTER!';
}

export function getGameScaling(gameId) {
  return GAME_BY_ID[gameId]?.meta?.scaling || {};
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

export const GAME_PACKS = [
  {
    id: 'starter',
    packNumber: 0,
    title: 'Starter Gauntlet',
    mysteryTitle: 'Starter Gauntlet',
    desc: 'The original 20 arcade challenges.',
    gameIds: STARTER_GAMES.map((G) => G.meta.id),
    mysteryCount: STARTER_GAMES.length,
    unlockRequirement: null,
    comingSoon: false,
  },
  {
    id: 'pack-1',
    packNumber: 1,
    title: 'Arcade Vault I',
    mysteryTitle: 'Mystery Pack I',
    desc: '5 mystery arcade games unlocked with Reel PTS.',
    gameIds: PACK_1_GAMES.map((G) => G.meta.id),
    mysteryCount: 5,
    unlockRequirement: {
      type: 'lifetimeScore',
      target: 25000,
      label: '25,000 Reel PTS',
    },
    comingSoon: false,
  },
  {
    id: 'pack-2',
    packNumber: 2,
    title: 'Mystery Pack II',
    mysteryTitle: 'Mystery Pack II',
    desc: '5 new games arriving in the next update.',
    gameIds: [],
    mysteryCount: 5,
    unlockRequirement: {
      type: 'lifetimeScore',
      target: 100000,
      label: '100,000 Reel PTS',
    },
    comingSoon: true,
  },
];

export function getPackForGame(gameId) {
  return GAME_PACKS.find((p) => p.gameIds.includes(gameId)) || GAME_PACKS[0];
}

// Single Source of Truth for World 1 Overworld Progression (4 -> 8 -> 12 -> 16 -> 20 Reels)
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
    starScores: [4000, 6000, 9500],
    firstClearBonusRP: 500,
    gameIds: STARTER_GAMES.slice(0, 4).map((G) => G.meta.id),
    pos: { x: 184, y: 636 },
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
    pos: { x: 304, y: 524 },
    pathFromPrev: [
      [184, 636],
      [234, 594],
      [258, 554],
      [304, 524],
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
    pos: { x: 142, y: 422 },
    pathFromPrev: [
      [304, 524],
      [258, 496],
      [225, 452],
      [186, 430],
      [142, 422],
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
    pos: { x: 297, y: 356 },
    pathFromPrev: [
      [142, 422],
      [190, 400],
      [220, 375],
      [260, 360],
      [297, 356],
    ],
  },
  {
    id: '1-5',
    worldId: 'world-1',
    code: '1-5',
    index: 4,
    title: 'Apex Spire',
    subtitle: 'Royal Citadel · 20 Reels',
    icon: '👑',
    clearScore: 22000,
    starScores: [22000, 30000, 42000],
    firstClearBonusRP: 3500,
    gameIds: STARTER_GAMES.slice(0, 20).map((G) => G.meta.id),
    pos: { x: 243, y: 204 },
    pathFromPrev: [
      [297, 356],
      [256, 332],
      [234, 300],
      [210, 256],
      [202, 224],
      [243, 204],
    ],
  },
];

export const WORLD_1_CHESTS = [
  {
    id: 'w1-chest-5',
    worldId: 'world-1',
    starsReq: 5,
    rewardRP: 1000,
    title: 'Star Pouch I',
    icon: '🎁',
    desc: '+1,000 Bonus RP',
  },
  {
    id: 'w1-chest-9',
    worldId: 'world-1',
    starsReq: 9,
    rewardRP: 2500,
    title: 'Island Star Chest',
    icon: '🧰',
    desc: '+2,500 Bonus RP',
  },
  {
    id: 'w1-chest-15',
    worldId: 'world-1',
    starsReq: 15,
    rewardRP: 5000,
    title: 'Royal Crown Chest',
    icon: '👑',
    desc: '+5,000 Bonus RP + Mastery Crown',
  },
];

export const WORLDS = [
  {
    id: 'world-1',
    number: 1,
    title: 'SUNNY TOY ISLES',
    nodes: WORLD_1_NODES,
    chests: WORLD_1_CHESTS,
    totalStars: WORLD_1_NODES.length * 3,
    portalPos: { x: 182, y: 188 },
    portalPath: [
      [243, 204],
      [212, 198],
      [182, 188],
    ],
    chestPos: { x: 382, y: 556 },
  },
];

export const QUEST_POOL = [
  {
    id: 'survive_reels',
    title: 'Survival Streak',
    desc: 'Survive 4 total 60s reels',
    metric: 'timersSurvived',
    target: 4,
    rewardRP: 400,
    icon: '⏱️',
  },
  {
    id: 'prestige_up',
    title: 'Prestige Climber',
    desc: 'Reach Prestige 2 in any reel',
    metric: 'prestige2',
    target: 1,
    rewardRP: 450,
    icon: '★',
  },
  {
    id: 'score_run',
    title: 'High Roller',
    desc: 'Reach 5,000 PTS in a single run',
    metric: 'runScore',
    target: 5000,
    rewardRP: 500,
    icon: '💎',
  },
  {
    id: 'clear_victories',
    title: 'Stage Conqueror',
    desc: 'Clear 2 Prestige stages',
    metric: 'stagesCleared',
    target: 2,
    rewardRP: 600,
    icon: '⭐',
  },
  {
    id: 'earn_w1_stars',
    title: 'Star Hunter',
    desc: 'Hold at least 3 World 1 Stars',
    metric: 'world1Stars',
    target: 3,
    rewardRP: 700,
    icon: '🌟',
  },
  {
    id: 'play_daily',
    title: 'Daily Challenger',
    desc: 'Play a stage in the Daily Gauntlet',
    metric: 'dailyPlayed',
    target: 1,
    rewardRP: 550,
    icon: '🎲',
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

export function getStarsForScore(node, score = 0) {
  if (!node || !Array.isArray(node.starScores)) return 0;
  let stars = 0;
  for (const threshold of node.starScores) {
    if (score >= threshold) stars += 1;
  }
  return stars;
}
