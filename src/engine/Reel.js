import { sounds } from '../audio.js';
import { haptics } from '../haptics.js';
import { store } from './store.js';
import { Input } from './input.js';
import { VoidEater } from '../games/voidEater.js';
import { DeepFeeder } from '../games/deepFeeder.js';
import { TowerSlice } from '../games/towerSlice.js';
import { MultiplierRunner } from '../games/multiplierRunner.js';
import { FruitMerge } from '../games/fruitMerge.js';
import { Motherload } from '../games/motherload.js';
import { DoodleJump } from '../games/doodleJump.js';
import { PaperIo } from '../games/paperIo.js';
import { BlockBuster } from '../games/blockBuster.js';
import { CrossyRoad } from '../games/crossyRoad.js';
import { ZombieFortress } from '../games/zombieFortress.js';
import { SubwaySurfers } from '../games/subwaySurfers.js';
import { SaveTheBean } from '../games/saveTheBean.js';
import { BeanTD } from '../games/beanTD.js';
import { ColorClash } from '../games/colorClash.js';
import { BallBlast } from '../games/ballBlast.js';
import { SledSurfers } from '../games/sledSurfers.js';
import { AgeOfBeans } from '../games/ageOfBeans.js';

export const W = 450;
export const H = 800;

const GAMES = [VoidEater, DeepFeeder, TowerSlice, MultiplierRunner, FruitMerge, Motherload, DoodleJump, PaperIo, BlockBuster, CrossyRoad, ZombieFortress, SubwaySurfers, SaveTheBean, BeanTD, ColorClash, BallBlast, SledSurfers, AgeOfBeans];
const $ = (s) => document.querySelector(s);

export class Reel {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.roundLen = Number(params.get('t')) || 60;

    this.stage = $('#stage');
    this.canvas = $('#game');
    this.snap = $('#snap');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    for (const c of [this.canvas, this.snap]) {
      c.width = Math.round(W * this.dpr);
      c.height = Math.round(H * this.dpr);
    }
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.input = new Input(this.canvas, W, H);
    this.env = { input: this.input, sounds, haptics };

    this.mode = 'menu'; // menu | playing | secured | dying | transition | summary
    this.game = null;
    this.index = 0;
    this.holdT = 0;
    this.transT = 0;
    this.timeLeft = this.roundLen;
    this.roundStartScore = 0;
    this.restored = false;
    this.lastSecs = -1;
    this.lastScoreShown = -1;
    this.hintTimer = null;
    this.welcomeTimer = null;

    this.bindUI();
    this.buildMenuIcons();
    this.buildPips();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    // Direct game launch via URL query parameter (e.g. ?game=subway-surfers or ?g=12)
    const targetGame = params.get('game') || params.get('g');
    if (targetGame) {
      const idx = GAMES.findIndex((g, i) => g.meta.id === targetGame || String(i + 1) === targetGame || String(i) === targetGame);
      if (idx !== -1) {
        if (store.data.meta.eliminated) {
          delete store.data.meta.eliminated[GAMES[idx].meta.id];
          store.save();
        }
        setTimeout(() => this.jumpToGame(idx), 50);
      }
    }
  }

  isGameAlive(i) {
    if (i < 0 || i >= GAMES.length) return false;
    const id = GAMES[i].meta.id;
    return !store.isEliminated(id);
  }

  getAliveIndices() {
    const list = [];
    for (let i = 0; i < GAMES.length; i++) {
      if (this.isGameAlive(i)) list.push(i);
    }
    return list;
  }

  /* ---------------------------------------------------------- UI setup */
  bindUI() {
    $('#btnPlay').onclick = () => this.startRun(false);
    $('#btnContinue').onclick = () => this.startRun(true);
    $('#btnNew').onclick = () => this.startRun(false);
    $('#btnNext').onclick = () => this.nextCycle();

    if (store.hasSession()) {
      $('#btnPlay').classList.add('hidden');
      $('#btnContinue').classList.remove('hidden');
      $('#btnNew').classList.remove('hidden');
      $('#btnContinue').style.animation = 'btnpulse 1.8s ease-in-out infinite';
    }

    $('#btnMute').onclick = () => {
      sounds.setMuted(!sounds.muted);
      $('#muteIco').textContent = sounds.muted ? '🔇' : '🔊';
      if (!sounds.muted) sounds.like();
    };
    $('#muteIco').textContent = sounds.muted ? '🔇' : '🔊';

    $('#btnLike').onclick = () => {
      if (!this.game) return;
      const id = GAMES[this.index].meta.id;
      const liked = store.toggleLike(id);
      this.refreshLike();
      if (liked) {
        sounds.like();
        haptics.light();
      }
    };

    // Keyboard shortcuts: 1..9, 0 to jump immediately to any game for testing
    // Note: When Motherload or Age of Beans is active (which use keys 1..3 for units/items),
    // require Shift+1..0 or clicking the top pips to jump, preventing key conflicts.
    window.addEventListener('keydown', (e) => {
      const gameId = this.game?.constructor?.meta?.id || this.game?.meta?.id;
      if (this.game && (gameId === 'motherload' || gameId === 'age-of-beans') && !e.shiftKey) {
        return;
      }
      if (e.key === '0' && GAMES.length >= 10) {
        this.jumpToGame(9);
        return;
      }
      if ((e.key === '-' || e.key.toLowerCase() === 'z') && GAMES.length >= 11) {
        this.jumpToGame(10);
        return;
      }
      if ((e.key === '=' || e.key.toLowerCase() === 's') && GAMES.length >= 12) {
        this.jumpToGame(11);
        return;
      }
      if ((e.key === 'b' || e.key.toLowerCase() === 'b') && GAMES.length >= 13) {
        this.jumpToGame(12);
        return;
      }
      if ((e.key === 't' || e.key.toLowerCase() === 't') && GAMES.length >= 14) {
        this.jumpToGame(13);
        return;
      }
      if ((e.key === 'c' || e.key.toLowerCase() === 'c') && GAMES.length >= 15) {
        this.jumpToGame(14);
        return;
      }
      if ((e.key === 'x' || e.key.toLowerCase() === 'x') && GAMES.length >= 16) {
        this.jumpToGame(15);
        return;
      }
      if ((e.key === 'u' || e.key.toLowerCase() === 'u') && GAMES.length >= 17) {
        this.jumpToGame(16);
        return;
      }
      if ((e.key === 'w' || e.key.toLowerCase() === 'w') && GAMES.length >= 18) {
        this.jumpToGame(17);
        return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= GAMES.length) {
        this.jumpToGame(n - 1);
      }
    });
  }

  buildMenuIcons() {
    const mi = $('#menuIcons');
    mi.innerHTML = GAMES.map((g, i) => `<span data-i="${i}" title="Play Game ${i + 1}: ${g.meta.title} (Click or press ${i + 1})">${g.meta.icon}</span>`).join('');
    mi.onclick = (e) => {
      const btn = e.target.closest('[data-i]');
      if (!btn) return;
      const targetIndex = Number(btn.dataset.i);
      if (Number.isNaN(targetIndex)) return;
      store.data.started = true;
      this.jumpToGame(targetIndex);
    };
  }

  buildPips() {
    const pipsEl = $('#pips');
    pipsEl.innerHTML = GAMES.map((g, i) => `<div class="pip" data-i="${i}" title="Game ${i + 1}: ${g.meta.title}">${g.meta.icon}</div>`).join('');
    
    let isDragging = false;
    let hasDragged = false;
    let startX = 0;
    let scrollLeft = 0;

    pipsEl.onclick = (e) => {
      if (hasDragged) {
        hasDragged = false;
        return;
      }
      const pip = e.target.closest('.pip');
      if (!pip) return;
      const targetIndex = Number(pip.dataset.i);
      if (Number.isNaN(targetIndex)) return;

      if (!this.isGameAlive(targetIndex)) {
        this.banner('GAME ELIMINATED! 💀', `${GAMES[targetIndex].meta.title} is excluded from this run`, 'fail');
        sounds.fail();
        haptics.fail();
        return;
      }

      // Strict Gauntlet Flow: jumping ahead is disabled during an active run unless Shift is held for dev testing
      if (this.mode === 'playing' && !e.shiftKey) {
        this.banner('STRICT GAUNTLET ⚔️', 'Survive 60s to advance through the sequence', 'info');
        return;
      }

      this.jumpToGame(targetIndex);
    };

    // Mouse wheel horizontal scrolling
    pipsEl.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        pipsEl.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    // Drag-to-scroll support for mouse/trackpad
    pipsEl.addEventListener('pointerdown', (e) => {
      isDragging = true;
      hasDragged = false;
      startX = e.clientX;
      scrollLeft = pipsEl.scrollLeft;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) hasDragged = true;
      pipsEl.scrollLeft = scrollLeft - dx;
    });

    window.addEventListener('pointerup', () => {
      isDragging = false;
    });
  }

  jumpToGame(i) {
    if (i < 0 || i >= GAMES.length) return;
    if (!this.isGameAlive(i)) {
      this.banner('GAME ELIMINATED! 💀', `${GAMES[i].meta.title} is excluded from this run`, 'fail');
      sounds.fail();
      return;
    }
    sounds.init();

    // Preserve active game's score and serialized state if currently running
    if (this.game) {
      this.bank();
      const currId = GAMES[this.index]?.meta.id;
      if (currId) {
        store.set(currId, this.game.serialize(), this.game.score);
      }
      this.destroyGame();
    }

    // Dismiss overlays and show HUD
    $('#menu').classList.add('hidden');
    $('#summary').classList.add('hidden');
    $('#hud').classList.remove('hidden');

    this.mode = 'playing';
    this.snap.style.display = 'none';
    this.input.reset();
    this.loadGame(i);
    this.banner(`GAME ${i + 1} / ${GAMES.length}`, GAMES[i].meta.title, 'info');
    sounds.whoosh();
    haptics.light();
    store.save();
  }

  renderPips() {
    const res = store.meta.results;
    document.querySelectorAll('.pip').forEach((el, i) => {
      const isElim = !this.isGameAlive(i) || res[i] === 'eliminated';
      el.className = 'pip';
      if (isElim) {
        el.classList.add('eliminated');
      } else if (res[i] === 'survived') {
        el.classList.add('survived');
      }

      if (i === this.index && (this.mode === 'playing' || this.mode === 'transition' || this.mode === 'secured' || this.mode === 'dying')) {
        el.classList.add('current');
        // Smoothly scroll active pip into view
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } catch { /* ignore */ }
      }
    });
  }

  resize() {
    this.stage.style.fontSize = `${(this.stage.clientWidth / W) * 16}px`;
  }

  refreshLike() {
    const meta = GAMES[this.index].meta;
    const btn = $('#btnLike');
    btn.classList.toggle('liked', store.isLiked(meta.id));
    const n = store.likeCount(meta.id, meta.baseLikes);
    $('#likeCount').textContent = n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  }

  banner(title, sub, kind) {
    const b = $('#banner');
    b.className = 'banner';
    void b.offsetWidth;
    b.querySelector('.banner-title').textContent = title;
    b.querySelector('.banner-sub').textContent = sub || '';
    b.classList.add('show', kind);
  }

  flash(kind) {
    const f = $('#flash');
    f.className = '';
    void f.offsetWidth;
    f.className = kind;
  }

  showWelcome(text) {
    const w = $('#welcome');
    w.textContent = `⟲ Welcome back — ${text}`;
    w.classList.add('show');
    clearTimeout(this.welcomeTimer);
    this.welcomeTimer = setTimeout(() => w.classList.remove('show'), 2800);
  }

  /* ----------------------------------------------------------- run flow */
  startRun(cont) {
    sounds.init();
    if (!cont) store.reset();
    store.data.started = true;
    $('#menu').classList.add('hidden');
    $('#summary').classList.add('hidden');
    $('#hud').classList.remove('hidden');

    const alive = this.getAliveIndices();
    if (alive.length === 0) {
      store.reset();
    }
    const freshAlive = this.getAliveIndices();
    let startIdx = 0;
    if (cont && this.isGameAlive(store.meta.index)) {
      startIdx = store.meta.index;
    } else {
      startIdx = freshAlive[0] ?? 0;
    }

    this.index = startIdx;
    this.loadGame(this.index);
    this.mode = 'transition';
    this.transT = 0.45;
    this.snap.style.display = 'none';
    sounds.whoosh();
    this.banner(`GAME ${this.index + 1} / ${GAMES.length}`, GAMES[this.index].meta.title, 'info');
    this.renderPips();
    store.save();
  }

  loadGame(i) {
    const G = GAMES[i];
    this.index = i;
    this.game = new G(this.ctx, W, H, this.env);
    const snap = store.get(G.meta.id);
    this.game.init(snap ? snap.state : null, snap ? snap.score : 0);
    this.restored = !!snap;
    this.roundStartScore = this.game.score;
    this.roundLen = Number(new URLSearchParams(location.search).get('t')) || 60;
    this.timeLeft = this.roundLen;
    this.lastSecs = -1;
    this.lastScoreShown = -1;
    this.stage.classList.remove('urgent');

    $('#infoTitle').textContent = `${G.meta.icon}  ${G.meta.title}`;
    const hint = $('#infoHint');
    hint.textContent = G.meta.hint;
    hint.classList.remove('fade');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => hint.classList.add('fade'), 6000);
    const aliveCount = this.getAliveIndices().length;
    $('#cycleLabel').textContent = `CYCLE ${store.meta.cycle} · ${aliveCount}/${GAMES.length} ACTIVE`;
    $('#welcome').classList.remove('show');
    this.refreshLike();
    store.meta.index = i;
    this.renderPips();
  }

  destroyGame() {
    if (this.game) this.game.destroy();
    this.game = null;
  }

  bank() {
    const live = Math.max(0, Math.round(this.game.score - this.roundStartScore));
    store.meta.global += live;
    store.meta.cycleBase += live;
    this.roundStartScore = this.game.score;
  }

  onSurvive() {
    this.bank();
    const id = GAMES[this.index].meta.id;
    store.set(id, this.game.serialize(), this.game.score);
    store.meta.results[this.index] = 'survived';
    store.save();
    this.mode = 'secured';
    this.holdT = 1.0;
    this.banner('60s SURVIVED! ✓', 'PROGRESS FROZEN · NEXT GAME', 'ok');
    this.flash('ok');
    sounds.survive();
    haptics.success();
    this.stage.classList.remove('urgent');
    this.renderPips();
  }

  onDeath() {
    this.bank();
    const id = GAMES[this.index].meta.id;
    store.eliminate(id);
    store.meta.results[this.index] = 'eliminated';
    store.save();
    this.mode = 'dying';
    this.holdT = 1.1;
    const aliveLeft = this.getAliveIndices().length;
    const sub = this.game.deathReason ? `${this.game.deathReason} · ` : '';
    this.banner('GAME ELIMINATED! 💀', `${sub}${aliveLeft} Games Remaining in Run`, 'fail');
    this.flash('fail');
    sounds.fail();
    haptics.fail();
    this.stage.classList.remove('urgent');
    this.renderPips();
  }

  advance() {
    const alive = this.getAliveIndices();
    if (alive.length === 0) {
      // All games eliminated for this run!
      this.showRunOver();
      return;
    }

    // Find next alive game in sequence
    const nextAfter = alive.find((idx) => idx > this.index);
    if (nextAfter !== undefined) {
      this.transitionTo(nextAfter, 0.7);
    } else {
      // Seamless Auto-Loop back to the first available game for the next cycle
      store.meta.cycle += 1;
      store.meta.cycleBase = 0;
      store.save();

      const loopIdx = alive[0];
      this.transitionTo(loopIdx, 0.7);
      this.banner(`CYCLE ${store.meta.cycle} BEGUN! 🔁`, `${alive.length} Games Remaining · Saved Progress Resuming`, 'info');
    }
  }

  transitionTo(i, dur = 0.7) {
    this.mode = 'transition';
    this.input.reset();
    const s = this.snap;
    const sc = s.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, s.width, s.height);
    sc.drawImage(this.canvas, 0, 0);
    s.style.transition = 'none';
    s.style.transform = 'translateY(0)';
    s.style.display = 'block';

    this.destroyGame();
    this.loadGame(i);

    void s.offsetWidth;
    s.style.transition = `transform ${dur}s cubic-bezier(.7,0,.2,1)`;
    s.style.transform = 'translateY(-102%)';
    this.transT = dur;
    sounds.whoosh();
    haptics.light();
  }

  endTransition() {
    this.snap.style.display = 'none';
    this.mode = 'playing';
    this.input.reset();
    if (this.restored) {
      this.showWelcome(this.game.restoreLabel());
      sounds.welcome();
    }
    this.renderPips();
  }

  showRunOver() {
    this.mode = 'summary';
    this.destroyGame();
    sounds.fail();
    haptics.fail();
    this.flash('fail');

    const totalScore = store.meta.global;
    const cycles = store.meta.cycle;

    $('#sumEyebrow').textContent = 'GAUNTLET TERMINATED';
    $('#sumTitle').textContent = 'All Games Eliminated!';
    const chipsEl = $('#sumChips');
    chipsEl.innerHTML = GAMES.map((g, i) => `<div class="chip eliminated" data-i="${i}" title="${g.meta.title} (Eliminated)">${g.meta.icon}</div>`).join('');
    chipsEl.onclick = null;

    $('#sumMult').textContent = `CYCLE ${cycles}`;
    $('#sumSub').textContent = `Total Score: ${totalScore.toLocaleString()} PTS · All 18 games succumbed!`;
    const footEl = $('#sumFoot');
    if (footEl) footEl.textContent = 'All 18 games succumbed to the gauntlet. Can you survive longer next run?';

    const btnNext = $('#btnNext');
    btnNext.textContent = 'START NEW RUN 🔄';
    btnNext.onclick = () => {
      $('#summary').classList.add('hidden');
      this.startRun(false);
    };

    $('#summary').classList.remove('hidden');
    this.lastScoreShown = -1;
  }

  showSummary() {
    this.showRunOver();
  }

  nextCycle() {
    sounds.init();
    $('#summary').classList.add('hidden');
    store.meta.cycle += 1;
    store.meta.cycleBase = 0;
    store.save();
    const alive = this.getAliveIndices();
    if (alive.length === 0) {
      this.startRun(false);
    } else {
      this.transitionTo(alive[0], 0.7);
    }
  }

  /* -------------------------------------------------------------- loop */
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    try {
      this.tick(dt);
    } catch (err) {
      console.error('Game loop tick error:', err);
    } finally {
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  tick(dt) {
    // 1) Mode timers that need the previous frame still on the canvas.
    if (this.mode === 'secured' || this.mode === 'dying') {
      this.holdT -= dt;
      if (this.holdT <= 0) this.advance();
    }
    if (this.mode === 'transition') {
      this.transT -= dt;
      if (this.transT <= 0) this.endTransition();
    }

    // 2) Simulation.
    if (this.mode === 'playing' && this.game) {
      const g = this.game;
      g.time += dt;
      g.grace = Math.max(0, g.grace - dt);
      g.update(dt);
      this.timeLeft -= dt;
      this.updateTimerUI();
      if (g.dead) this.onDeath();
      else if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.updateTimerUI();
        this.onSurvive();
      }
    } else if (this.mode === 'dying' && this.game) {
      this.game.updateDying(dt * 0.4);
    }

    // 3) Render.
    this.ctx.clearRect(0, 0, W, H);
    if (this.game && this.mode !== 'menu') this.game.render();

    if (this.game && (this.mode === 'playing' || this.mode === 'secured' || this.mode === 'dying')) {
      const live = Math.max(0, Math.round(this.game.score - this.roundStartScore));
      const total = store.meta.global + live;
      if (total !== this.lastScoreShown) {
        this.lastScoreShown = total;
        $('#score').textContent = total.toLocaleString();
      }
    } else if (this.mode === 'summary' || this.mode === 'transition') {
      const total = store.meta.global;
      if (total !== this.lastScoreShown) {
        this.lastScoreShown = total;
        $('#score').textContent = total.toLocaleString();
      }
    }

    this.input.endFrame();
  }

  updateTimerUI() {
    const secs = Math.ceil(Math.max(0, this.timeLeft));
    if (secs !== this.lastSecs) {
      this.lastSecs = secs;
      $('#time').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      if (secs <= 5 && secs > 0) {
        this.stage.classList.add('urgent');
        sounds.tick();
        haptics.light();
      }
    }
    $('#timerFill').style.transform = `scaleX(${Math.max(0, this.timeLeft / this.roundLen)})`;
  }
}
