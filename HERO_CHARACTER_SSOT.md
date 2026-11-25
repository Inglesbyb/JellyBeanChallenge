# Crowned Green Hero Bean — Pristine HD 3D Character & Action Suite SSOT

This document is the **Single Source of Truth** for rendering, posing, and extending the main **Crowned Green Hero Bean** across all **Game Reels** mini-games, overworld screens, and future 3D levels.

> **Visual & Action Standard:**
> 1. **Pristine HD Cartoon 3D:** Rendered via `Three.js` in a `512 × 512` supersampled offscreen WebGL buffer with a multi-step high-quality Canvas 2D mip pyramid (`512 → 256 → 128 → dest`) so `#000000` ink contours stay razor-crisp even on small (`38–64 px`) mobile sprites.
> 2. **Action-Specific Posing Rule:** Never leave Hero Bean passively waving (`state: 'idle'`) inside active action mini-games! Always select the game's dedicated action pose (`turret_fire`, `pilot`, `aim_pull`, `steer_fire`, `balance`, `wobble`, `hop_leap`, `swim`, `run`, `surf`, `jetpack`, etc.).

---

## 1. Official Character Design & HD Shader Spec

Anchored visually to [hero-bean-map.png](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/public/assets/world1/hero-bean-map.png):

| Feature | SSOT Specification | Implementation ([hero3d.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/engine/hero3d.js)) |
| :--- | :--- | :--- |
| **Silhouette** | Organic asymmetric kidney-bean curve (`52 × 56` rings/segments) | `sampleKidneyTorsoPoint()` / `buildKidneyTorsoGeometry()` |
| **Pristine HD Cel Shader** | `fwidth`-antialiased GLSL 2-tone toon shader (eliminates stair-step shadow seams); lime `#3be02c` base -> emerald `#169c22` shadow + `#ecfccb` top-left rim | `createWeeblCelMaterial()` |
| **Ink Outlines** | Uniform gap-free `#000000` comic ink contours scaled cleanly for `450 × 800` readability | `buildSmoothOutlineGeometry()` averaged seam normals + `BackSide` extrusion (`0.022–0.045`) |
| **Clip-Free Projected Face** | Subdivided UV grids (`buildProjectedQuadPatch`) & tubes (`buildProjectedTubeGeo`) mapped directly along `projectOntoTorsoFront()` outer normals so belly skin never clips white teeth/mouth | `buildFaceRig()` (`happy`, `grit` combat smile, `panic` `O`, `dizzy` `X`, auto-blink) |
| **Specular Gloss Pills** | Crisp pale-lime `#eaffde` shine strips offset `+0.011` cleanly off upper-left dome/cheek/back | `createBeanGlossHighlights()` |
| **Hands, Feet & Crown** | 5-finger open palm + clenched running/grip fists; green cartoon shoes (`#1e293b` soles); tilted 5-peak golden crown (`3 front gold + 2 amber back peaks` with pearl tips) | `buildArmRig()`, `buildLegRig()`, `buildCrownRig()` |

---

## 2. Complete Action Pose & Prop Suite (`HERO_STATES`)

```javascript
import { drawHeroCharacter } from './weeblAtlas.js';

drawHeroCharacter(ctx, x, y, size, {
  view: 'front' | 'threeQuarterFront' | 'side' | 'threeQuarterRear' | 'rear',
  dir: 1,                  // 1 = right, -1 = left
  state: 'turret_fire',    // see full table below
  expr: 'happy' | 'focus' | 'panic' | 'dizzy',
  t: this.time * 4,
  lean: 0,                 // banking lean angle
  recoil: 0,               // gun kick [0..1] for turret_fire
  lookX: 0,                // eye look [-1..1]
  prop: 'none' | 'hoverboard' | 'jetpack' | 'blaster' | 'scuba',
  squashX: 1,
  squashY: 1,
});
```

### Canonical Game-to-Action Pose Mapping

| Scene / Game | View & Dir | Action Pose (`state`) & Props | Live Dynamics |
| :--- | :--- | :--- | :--- |
| **Overworld** ([worldMap.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/engine/worldMap.js)) | `threeQuarterFront` / `front` | `'walk'` on splines, `'idle'` wave on pad | Directionally turns left/right along World 1 paths |
| **Subway Bean Surfers** ([subwaySurfers.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/subwaySurfers.js)) | `rear` / `threeQuarterRear` / `front` | `'run'`, `'jump'`, `'slide'`, `'surf'` (+ 3D board), `'jetpack'` (+ twin flames), `'dead'` | Dynamic lane turn (`lookDir`), 360° 3D mid-air spin flips, heel-kick shoe soles |
| **Zombie Fortress** ([zombieFortress.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/zombieFortress.js)) | `threeQuarterFront` (`dir` tracks turret) | `'turret_fire'` (`prop: 'none'`, grips fortress turret controls) | Hunched determined grit (`focus`), live `recoil` kick per shot & aim lean |
| **Void Eater** ([voidEater.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/voidEater.js)) | `threeQuarterFront` (`dir` by `vx`) | `'pilot'` (seated forward cockpit steering grip), `'hurt'` on threat | Hard UFO banking `lean` & excited eyes tracking turn direction |
| **Citadel Siege** ([citadelSiege.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/citadelSiege.js)) | `threeQuarterFront` | `'aim_pull'`, `'throw'`, `'stand_alert'`, `'cheer'`, `'hurt'` | Pulls back pouch under tension (`aim_pull`), snaps forward on launch (`throw`) |
| **Crossy Hopper** ([crossyRoad.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/crossyRoad.js)) | 4-way (`rear`/`side`/`front`) | `'hop_leap'` mid-arc, `'stand_alert'` ready bounce, `'dead'` | Forward tucked frog leap on every hop across 4 headings |
| **Doodle Jump** ([doodleJump.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/doodleJump.js)) | `threeQuarterFront` | `'jump_launch'`, `'fall_dive'`, `'jetpack'`, `'stand_alert'`, `'dead'` | Upward celebratory stretch on boost; panicked arms-up scramble when diving |
| **Deep Feeder** ([deepFeeder.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/deepFeeder.js)) | `side` (`dir: p.dir`) | `'swim'` + `prop: 'scuba'` (curved twin goggles, snorkel, orange flippers) | Horizontal streamlined swim stroke, trailing flutter kick, Sugar Rush gold skin |
| **Fruit Merge** ([fruitMerge.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/fruitMerge.js)) | `front` | `'balance'` while aiming, `'drop_push'` on release | Wide surfer-balance arms countering drop sway + panic jitter near overflow |
| **Tower Slice** ([towerSlice.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/towerSlice.js)) | `front` | `'stand_alert'`, `'wobble'` on sway/flood, `'cheer'` on clean slice, `'dead'` | Tightrope windmilling arms (`wobble`) when tower teeters |
| **Block Buster** ([blockBuster.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/blockBuster.js)) | `threeQuarterFront` (`dir` tracks aim) | `'steer_fire'` | Upward target spotter + launch jitter leaning along cannon carriage |
| **Multiplier Runner** ([multiplierRunner.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/multiplierRunner.js)) | `rear` | `'run'`, `'hurt'` on hazard slip | Squad Captain charging through gates |
| **Save The Bean** ([saveTheBean.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/saveTheBean.js)) | `front` (`lookX` tracks hive / cursor / bees) | `'stand_alert'`, `'balance'`, `'wobble'` on close swarm, `'cheer'` + starburst, `'hurt'` | Nervous eye-tracking while sketching & panicking shield defense |
| **Bean Breaker** ([beanBreaker.js](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/src/games/beanBreaker.js)) | `threeQuarterFront` (`dir` & `lean` track paddle motion) | `'balance'`, `'drop_push'` on paddle bounce, `'steer_fire'` during Laser, `'cheer'`, `'dead'` | Upward ball eye-tracking (`lookX`), paddle velocity bank lean, panic when wall drops low |

---

## 3. Headless & SSR Contract Guarantee (`verify-game-contract.mjs`)
- `isHero3DSupported()` verifies real WebGL availability (`gl.getParameter`), safely rejecting Node SSR `mockCanvas2d` inside [verify-game-contract.mjs](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/scripts/verify-game-contract.mjs).
- Whenever WebGL is absent, `drawHeroCharacter()` returns `false` and draws the matching `drawWeeblCelBean()` silhouette cleanly.
