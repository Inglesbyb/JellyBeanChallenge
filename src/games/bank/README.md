# WIP Game Bank (Dev Only — Future Worlds)

This folder holds work-in-progress and future-world minigame prototypes that are **excluded from user-facing builds** (not in Endless Mode, World 1, or player progression counters).

## Current Bank Roster
- `laserDodge.js` (`laser-dodge` — Laser Grid)
- `gravityFlip.js` (`gravity-flip` — Gravity Flip)
- `meteorSmasher.js` (`meteor-smasher` — Meteor Tap)
- `rhythmDash.js` (`rhythm-dash` — Beat Hop)
- `ageOfBeans.js` (`age-of-beans` — Age of Beans)

## Playtesting a Bank Game (Devs Only)
- Start local dev (`npm run dev`) or pass `?admin=1` in the URL and open **🛠️ ADMIN LAUNCHER** (`Shift+A`), then launch from the **WIP GAME BANK** section.
- Or jump directly in dev via `?game=<id>&admin=1` (for example, `?game=age-of-beans&admin=1`).
- Progress during Bank playtesting stays in memory for that session so it never modifies player `localStorage` stats, World 1 progress, or active Endless saves.

## Promoting a Game to Live World 2+ / Starter Rotation
1. Move the game file from `src/games/bank/<game>.js` back up to `src/games/<game>.js` and update engine imports from `'../../engine/` back to `'../engine/`.
2. Update the import path in `src/games/registry.js` and move the class from `GAME_BANK` into `STARTER_GAMES` or a future `WORLD_2_NODES` / live release list.
3. Run `npm run verify:games` and `npm run build` to confirm SSOT Playbook contract compliance.
