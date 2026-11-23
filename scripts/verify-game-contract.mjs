// Verifies every registered game and _template.js satisfy the SSOT Playbook Contract,
// produce monotonic bounded scaling across Prestige 1..20, and initialize/update/resume cleanly.
import {
  GAMES,
  GAME_BY_ID,
  WORLD_1_NODES,
  WORLD_1_CHESTS,
  QUEST_POOL,
  getStarsForScore,
  validateAllGames,
  validateGameContract,
} from '../src/games/registry.js';
import { store } from '../src/engine/store.js';
import { TemplateGame } from '../src/games/_template.js';
import { Game } from '../src/engine/Game.js';

const noop = () => {};
const mockCanvas2d = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
  ellipse: noop, rect: noop, roundRect: noop, fill: noop, stroke: noop,
  fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop, strokeText: noop,
  drawImage: noop, setTransform: noop, clip: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  putImageData: noop,
  measureText: () => ({ width: 20 }),
};

if (typeof globalThis.window === 'undefined') {
  globalThis.window = { addEventListener: noop, removeEventListener: noop };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => mockCanvas2d }),
  };
}

const mockEnv = {
  input: {
    down: false, isDown: false, pressed: false, released: false,
    x: 225, y: 400, pos: { x: 225, y: 400 }, frameDX: 0, frameDY: 0,
    vec: () => ({ x: 0, y: 0 }), keyVec: () => null, key: () => false,
  },
  sounds: new Proxy({}, { get: () => noop }),
  haptics: new Proxy({}, { get: () => noop }),
};

const errors = [
  ...validateAllGames(GAMES),
  ...validateGameContract(TemplateGame),
];

// Verify asymptotic monotonicity & caps for Prestige 1..20 + live lifecycle at P1 & P2
for (const G of [...GAMES, TemplateGame]) {
  const id = G?.meta?.id || G?.name;
  const spec = G?.meta?.scaling;
  if (!spec || typeof spec !== 'object') continue;

  const p1 = Game.resolveScaling(spec, 1);
  const p2 = Game.resolveScaling(spec, 2);
  const p20 = Game.resolveScaling(spec, 20);

  if (p2.deltas.length === 0) {
    errors.push(`${id}: Prestige 2 produced no human-readable delta chips`);
  }

  for (const [k, s] of Object.entries(spec)) {
    if (!s || typeof s !== 'object') continue;
    const isDown = s.mode === 'down' || Number.isFinite(s.floor);
    if (isDown) {
      if (!(p1.values[k] >= p2.values[k] && p2.values[k] >= p20.values[k] && p20.values[k] >= s.floor - 1e-6)) {
        errors.push(`${id}.scaling.${k}: down-scaling violated monotonicity/floor (p1=${p1.values[k]}, p2=${p2.values[k]}, p20=${p20.values[k]}, floor=${s.floor})`);
      }
    } else {
      if (!(p1.values[k] <= p2.values[k] && p2.values[k] <= p20.values[k] && p20.values[k] <= s.cap + 1e-6)) {
        errors.push(`${id}.scaling.${k}: up-scaling violated monotonicity/cap (p1=${p1.values[k]}, p2=${p2.values[k]}, p20=${p20.values[k]}, cap=${s.cap})`);
      }
    }
  }

  // Runtime smoke check: Prestige 1 fresh -> update -> serialize -> Prestige 2 resume -> update -> destroy
  try {
    const g1 = new G(mockCanvas2d, 450, 800, mockEnv);
    g1.applyPrestige(1);
    g1.init(null, 0);
    g1.update(0.016);
    const saved = g1.serialize();
    const label = g1.restoreLabel();
    if (typeof label !== 'string') errors.push(`${id}: restoreLabel() must return a string`);
    g1.destroy();

    const g2 = new G(mockCanvas2d, 450, 800, mockEnv);
    g2.applyPrestige(2);
    g2.init(saved, 500);
    g2.update(0.016);
    g2.destroy();
  } catch (err) {
    errors.push(`${id}: runtime smoke test failed: ${err?.stack || err}`);
  }
}

// Verify World 1 Overworld SSOT (5 nodes: 4 -> 8 -> 12 -> 16 -> 20 starter reels, monotonic clearScore)
if (WORLD_1_NODES.length !== 5) {
  errors.push(`WORLD_1_NODES: expected 5 nodes, got ${WORLD_1_NODES.length}`);
} else {
  const expectedCounts = [4, 8, 12, 16, 20];
  WORLD_1_NODES.forEach((node, idx) => {
    if (node.gameIds.length !== expectedCounts[idx]) {
      errors.push(`World node ${node.id}: expected ${expectedCounts[idx]} reels, got ${node.gameIds.length}`);
    }
    for (const gid of node.gameIds) {
      if (!GAME_BY_ID[gid]) {
        errors.push(`World node ${node.id}: unknown gameId '${gid}'`);
      }
    }
    if (!Array.isArray(node.starScores) || node.starScores.length !== 3 || node.starScores[0] !== node.clearScore) {
      errors.push(`World node ${node.id}: starScores must have 3 thresholds starting at clearScore`);
    }
  });
}

if (WORLD_1_CHESTS.length !== 3 || QUEST_POOL.length < 3) {
  errors.push('World 1 chests or QUEST_POOL incomplete');
}

// Verify store World 1 unlock progression & star awarding without persisting to browser storage
try {
  store.reset();
  if (!store.isNodeUnlocked('1-1') || store.isNodeUnlocked('1-2')) {
    errors.push('store World 1 initial lock state invalid');
  }
  const failRes = store.recordWorldRunResult('1-1', 2500);
  if (failRes.clearedNow || store.isNodeUnlocked('1-2')) {
    errors.push('store World 1 unlocked 1-2 below clear threshold');
  }
  const clearRes = store.recordWorldRunResult('1-1', 6200);
  if (!clearRes.clearedNow || clearRes.starsEarned !== 2 || !store.isNodeUnlocked('1-2')) {
    errors.push('store World 1 failed to unlock 1-2 or compute 2 stars on 1-1 clear');
  }
  if (getStarsForScore(WORLD_1_NODES[0], 9500) !== 3) {
    errors.push('getStarsForScore failed 3-star threshold check');
  }
  store.recordQuestProgress('timersSurvived', 4);
  const qRes = store.claimQuest(0);
  if (!qRes || qRes.rewardRP <= 0) {
    errors.push('store claimQuest failed for completed starter quest');
  }
} catch (err) {
  errors.push(`World 1 store progression test failed: ${err?.stack || err}`);
}

if (errors.length > 0) {
  console.error(`❌ SSOT Game Contract failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✅ Verified ${GAMES.length} registered games + TemplateGame pass SSOT contract, Prestige 1..20 scaling bounds, World 1 (4→20) progression, and P1→P2 runtime lifecycle.`);
