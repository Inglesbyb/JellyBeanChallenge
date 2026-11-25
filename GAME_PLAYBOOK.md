# 🕹️ Game Reels — Single Source of Truth Playbook & Architecture Contract

This document is the **official standard** for creating, styling, scaling, and integrating minigames into **Game Reels**. Every minigame must satisfy this contract (enforced automatically by `validateGameContract()` in [`src/games/registry.js`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/registry.js) and `npm run verify:games`) so every game shares identical intro wrap polish, Prestige 1→N progression, bounded difficulty slopes, safe-zone layouts, and run-loop mechanics.

> ### ⚡ Core UX & Gaming Ethos: Design as if the Player Has ADHD
> - **Zero Text Walls:** UI copy, rules, `meta.cue`, and `meta.hint` strings must be scannable in `< 1 second`.
> - **Instant Action (< 2 Taps):** Jump straight into play—intro wraps are non-blocking (`pointer-events: none`) so players can move immediately.
> - **Immediate Feedback & Momentum:** Every tap, hit, survival, and loss gives instant visual + audio/haptic payoff, and Prestige advances visibly on every round played.
> - **Bite-Sized Loops:** Strict 60s rounds, sub-second reel transitions, and escalating Prestige challenges (`PRESTIGE 1`, `2`, `3`, ...).

---

## 📑 Table of Contents
1. [Single Source of Truth Engine Contract](#1-single-source-of-truth-engine-contract)
2. [Intro Wrap & Prestige Lifecycle (Play 1, Play 2, Play 3+)](#2-intro-wrap--prestige-lifecycle-play-1-play-2-play-3)
3. [The Two Persistence Archetypes](#3-the-two-persistence-archetypes)
4. [Bounded Per-Game Difficulty Slopes (`meta.scaling`)](#4-bounded-per-game-difficulty-slopes-metascaling)
5. [Visual & Layout Standards](#5-visual--layout-standards)
6. [Input, Audio & FX Standards](#6-input-audio--fx-standards)
7. [Adding a New Game in 3 Minutes](#7-adding-a-new-game-in-3-minutes)

---

## 1. Single Source of Truth Engine Contract

Every minigame **must** extend `Game` from [`src/engine/Game.js`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/engine/Game.js) and declare all wrap, scoring, persistence, and scaling config inside `static meta`:

```javascript
import { Game } from '../engine/Game.js';

export class MyGame extends Game {
  static meta = {
    id: 'my-game',               // Unique slug (kebab-case)
    title: 'My Game Title',      // Display title in HUD & wraps
    icon: '🎯',                  // Single emoji for menus & wraps
    hint: 'DRAG to aim · TAP to fire!',
    baseLikes: 3500,             // Starting social like count
    isPrestige: true,            // true = resets board on complete(); false = continuous save
    parScore60s: 1500,           // Raw 60s score worth 1,000 base Performance RP
    roundLen: 60,

    // Baked-in Wrap & Difficulty Contract (Required)
    cue: 'BLAST THE TARGETS!',         // Play 1 pop-up action headline (2-5 words)
    prestigeCue: 'FASTER TARGETS!',    // Play 2+ escalation callout
    scaling: {
      enemySpeed: { base: 140, rate: 0.18, cap: 230, mode: 'up', round: true, label: 'Enemy Speed' },
      spawnDelay: { base: 1.2, rate: 0.16, floor: 0.55, mode: 'down', label: 'Spawn Pace' },
    },
  };

  init(saved, score = 0) { ... }
  update(dt) { ... }
  render() { ... }
  serialize() { ... }
  restoreLabel() { ... }
  destroy() { ... }
}
```

### Standard Lifecycle Methods
| Method | Trigger | Purpose |
| :--- | :--- | :--- |
| `init(saved, score)` | When the reel loads this game | Initialize entities. `this.prestige` and `this.diff` are already populated. Apply `this.diff` **even when restoring `saved`**. |
| `update(dt)` | Every frame while `mode === 'playing'` | Physics, input polling, collision, win/loss checks (`dt` clamped to max `0.05s`). |
| `render()` | Every frame | Draw background, game objects, mascot bean, and particle FX onto `this.ctx`. |
| `serialize()` | At 60s expiration or manual jump | Return a JSON-safe snapshot of state to freeze. |
| `restoreLabel()` | When resuming a frozen game | Short string for `"⟲ Welcome back — [restoreLabel]"` (e.g., `"depth 420m"`). |
| `destroy()` | When the game unloads | Remove DOM listeners or clear Matter.js physics (`Matter.Composite.clear()`). |

---

## 2. Intro Wrap & Prestige Lifecycle (Play 1, Play 2, Play 3+)

`Reel.js` automatically wraps every round using the game's `static meta`:

1. **Always-Visible Prestige HUD Badge (`#prestigeBadge`):**
   - Shown on **every** round from `PRESTIGE 1` onward (`PRESTIGE 1` → `PRESTIGE 2` → `PRESTIGE 3` ...), escalating visually by tier (Cyan on 1, Gold on 2, Amber/Coral on 3–4, Prismatic on 5+).
2. **Play 1 (First encounter in run / `prestige === 1`):**
   - Immediately after the transition lands, the non-blocking **Intro Wrap** pops in with:
     - Pill: `PRESTIGE 1`
     - Game Title + Icon
     - Giant WarioWare Headline (`meta.cue`, e.g., `FEED THE FISH!`)
     - Short control hint (`meta.hint`)
3. **Play 2+ (`prestige >= 2`):**
   - Every survived 60s round (`onSurvive`) or stage victory (`onVictory`) increments that game's Prestige rank (`store.promote(id)`) for the next play in the run.
   - The Intro Wrap pops in with:
     - Pill: `★ PRESTIGE N · HARDER`
     - Escalation Headline (`meta.prestigeCue`, e.g., `MORE BIGGER FISH!`)
     - Auto-generated delta chips computed directly from `meta.scaling` (e.g., `+10% FISH SPEED · +5% PREDATORS`)
     - Integrated restore badge (`⟲ Welcome back — ...`) if `saved` state resumed.

---

## 3. The Two Persistence Archetypes

Every game advances Prestige (`1 → 2 → 3...`) on every completed or survived round, while `static meta.isPrestige` controls **whether the board resets on `complete()`**:

* **Milestone / Growth (`isPrestige: true`):**
  - Examples: `void-eater`, `deep-feeder`, `fruit-merge`, `paper-turf`, `multiplier-runner`, `age-of-beans`, `bean-td`, `tower-slice`, `bean-survivors`, `bean-helix`, `bean-breaker`, `meteor-smasher`.
  - Calling `this.complete('Reason! 👑')` awards the stage clear bonus, increments `prestige`, and **discards the maxed-out board** so the next play starts fresh at the higher Prestige rank.
  - Surviving 60s without winning increments `prestige` while keeping progress until `complete()` or death.
* **Continuous / Endless (`isPrestige: false`):**
  - Examples: `motherload`, `crossy-road`, `subway-surfers`, `doodle-jump`, `sled-surfers`, `zombie-fortress`, `ball-blast`, `block-buster`, `color-clash`, `save-the-bean`, `laser-dodge`, `gravity-flip`, `rhythm-dash`.
  - Surviving 60s calls `serialize()` (preserving depth, upgrades, cash, turrets) **and** increments `prestige` (`1 → 2 → 3...`) so the next cycle resumes with your build intact against harder Prestige hazards.

---

## 4. Bounded Per-Game Difficulty Slopes (`meta.scaling`)

Never use unbounded linear formulas (`1 + pct * (p - 1)`) for speeds, HP, or timers. Declare each game's tailored slope in `static meta.scaling` so `Game.resolveScaling()` applies a smooth diminishing-returns curve:

$$\text{up}(p) = \text{base} + (\text{cap} - \text{base}) \cdot \left(1 - e^{-\text{rate} \cdot (p - 1)}\right)$$
$$\text{down}(p) = \text{base} - (\text{base} - \text{floor}) \cdot \left(1 - e^{-\text{rate} \cdot (p - 1)}\right)$$

- `init(saved, score)` reads pre-computed values straight from `this.diff.<key>`.
- **Rule for Restored Games:** Always read `this.diff` outside `if (!saved)` so resumed Cycle 2+ rounds adopt the new Prestige difficulty while keeping player upgrades intact.

---

## 5. Visual & Layout Standards

All games render to a portrait canvas sized **450 × 800** (scaled with DPR up to 2.5×):
- Top HUD Safe Zone: `Y = 0` to `130` (`Game.SAFE_TOP`)
- Active Playable Field: `Y = 130` to `695` (`Game.PLAY_HEIGHT = 565`, helper `this.isInSafeBounds(y)`)
- Bottom Dock Safe Zone: `Y = 695` to `800` (`Game.SAFE_BOTTOM`)
- Cartoon comic outlines (`2.0px–3.0px` `#000000`), `Outfit`/`Fredoka` canvas typography, and for the main **Crowned Green Hero Bean**, always use `drawHeroCharacter(ctx, x, y, size, opts)` from [`weeblAtlas.js`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/weeblAtlas.js) (`Three.js` cel-shaded 3D with automatic 2D SSR fallback — see [`HERO_CHARACTER_SSOT.md`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/HERO_CHARACTER_SSOT.md)).

---

## 6. Input, Audio & FX Standards

- **Input (`this.input`):** `this.input.vec(50)`, `this.input.pressed` / `this.input.pos`, `this.input.key(...)`
- **Audio & Haptics (`this.sounds`, `this.haptics`):** `pop()`, `up()`, `hit()`, `survive()`, `fail()`, `light()`, `medium()`, `heavy()`, `success()`
- **Particles (`this.fx`):** `burst(...)`, `ring(...)`, `text(...)`, `shake(...)`

---

## 7. Adding a New Game in 3 Minutes

1. **Copy the Template:** Copy [`src/games/_template.js`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/_template.js) to `src/games/myGame.js`.
2. **Fill `static meta`:** Set `id`, `title`, `icon`, `hint`, `isPrestige`, `parScore60s`, `cue`, `prestigeCue`, and your tailored `scaling` parameters.
3. **Wire `this.diff` in `init()`:** Read `this.diff.<param>` for both fresh and resumed starts, and implement `update`, `render`, `serialize`, `restoreLabel`, `destroy`.
4. **Register in [`src/games/registry.js`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/registry.js):**
   - **WIP / Future World prototype:** Place the file in `src/games/bank/` and add it to `GAME_BANK` (dev/admin-only, hidden from users).
   - **Live rotation:** Add it to `STARTER_GAMES` (or the target live World node list).
5. **Verify Contract & Test:** Run `npm run verify:games`, then test `?game=my-game&admin=1` in the browser!
