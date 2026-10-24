# Jelly Reels (Game Reels) 🎮🕹️

> **The Swipe-Style Arcade Gauntlet**  
> 18 hypercasual minigames, 60 seconds each. Survive the countdown to freeze your progress — die and you're swiped to the next game!

---

## 🕹️ About the Game

**Game Reels** is a fast-paced arcade gauntlet inspired by short-form video feeds and hypercasual minigames:

- **18 Unique Playable Games**:
  - 🏎️ **Color Clash** — Strategic ink territory turf-war with deployable cards & AI trainers.
  - ⭕ **Paper.io** — Claim territory and ambush opponents.
  - 🐟 **Deep Feeder** — Ocean survival eating smaller fish to evolve.
  - 🫘 **Age of Beans** — Castle defense & era-evolving bean warriors.
  - 🛷 **Sled Surfers** — Alpine downhill obstacle evasion.
  - 🏙️ **Subway Surfers** — 3-lane parkour dash.
  - 👾 **Void Eater**, 🎯 **Tower Slice**, 🔢 **Multiplier Runner**, 🍉 **Fruit Merge**, ⛏️ **Motherload**, 🪜 **Doodle Jump**, 🧱 **Block Buster**, 🐔 **Crossy Road**, 🧟 **Zombie Fortress**, 🛡️ **Save The Bean**, 🏰 **Bean TD**, 💥 **Ball Blast**.
- **The Reel Mechanic**: Survive the round timer to lock in your score and loop back through surviving games with saved states.
- **Audio & Haptics**: Procedural web audio sound effects and rich tactile screen-shake animations.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or newer)
- npm

### Installation & Run

1. Clone or download this repository:
   ```bash
   git clone <YOUR_REPO_URL>
   cd game-reels
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173`.

---

## 📦 Production Build

To build a bundled, optimized version:
```bash
npm run build
```
The output files will be created in the `dist/` directory.

---

## 🛠️ Built With
- **Vite** — High-speed frontend build tooling
- **Vanilla JavaScript & HTML5 Canvas** — 60 FPS physics, rendering, and gameplay
- **Web Audio API** — Real-time synthesized arcade audio
