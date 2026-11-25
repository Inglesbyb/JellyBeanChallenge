// Panel-by-panel Weebl Story & How-To-Play Comic Deck (readable 100% muted, explicit NEXT progression).
import { sounds } from '../audio.js';
import { haptics } from '../haptics.js';

export const STORY_PANELS = [
  {
    id: 1,
    section: 'story',
    art: '/assets/story/panel_01.jpg',
    cue: 'sunny',
    shake: false,
    caption: 'MEANWHILE ON SUNBURST PLAZA…',
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: "Wha' a beltin' day, eh? Just me, me crown, an' me bird!",
        style: 'tail-bl',
        top: '12.5%',
        left: '5%',
        maxWidth: '66%',
      },
    ],
    sfx: [],
    rules: [],
  },
  {
    id: 2,
    section: 'story',
    art: '/assets/story/panel_02.jpg',
    cue: 'ambush',
    shake: true,
    caption: 'THEN ALL OF A SUDDEN THIS HEAVY KID COME OUT OF NOWHERE…',
    captionEvil: true,
    bubbles: [
      {
        speaker: 'LORD BRIM',
        role: 'brim',
        text: "Whatappenin' ye little muppet! I'm taking yer bird!",
        style: 'brim-bubble tail-br',
        top: '13.5%',
        left: '5%',
        maxWidth: '58%',
      },
    ],
    sfx: [
      { text: 'KRAK-ZZZT!', top: '35%', left: '5%', rot: '-11deg', color: '#e879f9' },
    ],
    rules: [],
  },
  {
    id: 3,
    section: 'story',
    art: '/assets/story/panel_03.jpg',
    cue: 'punch',
    shake: true,
    caption: 'KING JELLY SWINGS BACK!!',
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: 'HEZZ!!',
        style: 'shout hezz tail-bl',
        top: '11.5%',
        left: '6%',
        maxWidth: '46%',
      },
    ],
    sfx: [
      { text: 'SMACK!!', top: '16.5%', right: '7%', rot: '11deg', color: '#fde047' },
    ],
    rules: [],
  },
  {
    id: 4,
    section: 'story',
    art: '/assets/story/panel_04.jpg',
    cue: 'escape',
    shake: false,
    caption: 'LORD BRIM BLASTS OFF INTO THE PORTAL…',
    captionEvil: true,
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: 'AS IF!! I WILL COME THROUGH YOUR KEN!!',
        style: 'shout compact tail-bl',
        top: '10%',
        left: '3%',
        maxWidth: '46%',
      },
      {
        speaker: 'LORD BRIM',
        role: 'brim',
        text: 'TERRARRRR, INABIT!! HAHAHAHA!!',
        style: 'laugh compact brim-bubble tail-bl',
        top: '10%',
        right: '3%',
        maxWidth: '45%',
      },
    ],
    sfx: [
      { text: 'VOOP!', top: '28%', right: '5%', rot: '10deg', color: '#c084fc' },
    ],
    rules: [],
  },
  {
    id: 5,
    section: 'howto',
    art: '/assets/story/panel_05.jpg',
    cue: 'briefing',
    shake: false,
    caption: 'HOW TO PLAY · SURVIVE 60s TO KEEP IT IN YER RUN',
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: "Right, here's the crack — last 60s or beat a game to keep it & Prestige Up!",
        style: 'tail-bc compact-hero',
        top: '10.5%',
        left: '6%',
        maxWidth: '88%',
      },
    ],
    sfx: [],
    rules: [
      {
        kind: 'win',
        badge: '60s',
        html: '<b>LAST 60s OR CLEAR:</b> Keep that reel in your run &amp; <b>Prestige Up</b> (faster + bigger PTS!).',
      },
      {
        kind: 'warn',
        badge: 'KO!',
        html: '<b>WIPE OUT:</b> Only that game gets cut — surviving reels keep rolling!',
      },
    ],
  },
  {
    id: 6,
    section: 'howto',
    art: '/assets/story/panel_06.jpg',
    cue: 'finale',
    shake: false,
    caption: "STORM WORLD 1 & SMASH LORD BRIM'S KEN!",
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: "Hold tight, girl — I'm comin' right through 'is citadel!",
        style: 'tail-bl compact-hero',
        top: '10.5%',
        left: '4.5%',
        maxWidth: '56%',
      },
    ],
    sfx: [],
    rules: [
      {
        kind: 'quest',
        badge: 'W1',
        html: '<b>CONQUER WORLD 1 (1-1 → 1-5):</b> Hit run goals to unlock more reels (4 → 20).',
      },
      {
        kind: 'win',
        badge: '1-6',
        html: '<b>BEAT LORD BRIM (1-6):</b> Win back Queen Bean &amp; unlock <b>Endless Mode</b>!',
      },
    ],
  },
];

export const HOWTO_START_INDEX = 4;

export class StoryComicDeck {
  constructor({ onComplete } = {}) {
    this.onComplete = onComplete;
    this.scope = 'story'; // 'story' (1..6) | 'howto' (5..6)
    this.index = 0;
    this.lockUntilComplete = false;
    this._bound = false;
    this.el = {};
  }

  _bindDOM() {
    if (this._bound || typeof document === 'undefined') return;
    const $ = (s) => document.querySelector(s);
    this.el = {
      modal: $('#howToModal'),
      card: $('#howToModal .comic-modal-card'),
      title: $('#howToTitle'),
      eyebrow: $('#comicEyebrow'),
      tabStory: $('#btnComicTabStory'),
      tabHowTo: $('#btnComicTabHowTo'),
      btnClose: $('#btnHowToClose'),
      progress: $('#comicProgressBar'),
      stage: $('#comicStage'),
      art: $('#comicPanelArt'),
      caption: $('#comicCaptionBanner'),
      bubbles: $('#comicBubblesLayer'),
      rules: $('#comicRulesOverlay'),
      btnBack: $('#btnComicPrev'),
      counter: $('#comicCounter'),
      btnNext: $('#btnComicNext'),
    };
    if (!this.el.modal || !this.el.btnNext) return;

    this.el.btnNext.onclick = () => this.next();
    if (this.el.btnBack) this.el.btnBack.onclick = () => this.prev();
    if (this.el.btnClose) {
      this.el.btnClose.onclick = () => {
        if (!this.lockUntilComplete) this.close({ completed: false });
      };
    }
    if (this.el.tabStory) {
      this.el.tabStory.onclick = () => this.setScope('story');
    }
    if (this.el.tabHowTo) {
      this.el.tabHowTo.onclick = () => this.setScope('howto');
    }
    this._bound = true;
  }

  _minIndex() {
    return this.scope === 'howto' ? HOWTO_START_INDEX : 0;
  }

  _maxIndex() {
    return STORY_PANELS.length - 1;
  }

  isOpen() {
    this._bindDOM();
    return Boolean(this.el.modal && !this.el.modal.classList.contains('hidden'));
  }

  open({ scope = 'howto', lockUntilComplete = false } = {}) {
    this._bindDOM();
    this.scope = scope === 'story' ? 'story' : 'howto';
    this.lockUntilComplete = Boolean(lockUntilComplete);
    this.index = this._minIndex();
    this.el.modal?.classList.remove('hidden');
    this.el.card?.classList.toggle('is-locked', this.lockUntilComplete);
    this.render({ playCue: false });
  }

  close({ completed = false } = {}) {
    this._bindDOM();
    this.el.modal?.classList.add('hidden');
    if (typeof this.onComplete === 'function') {
      this.onComplete({ completed, scope: this.scope });
    }
  }

  setScope(scope) {
    const target = scope === 'story' ? 'story' : 'howto';
    if (this.scope === target && ((target === 'story' && this.index === 0) || (target === 'howto' && this.index >= HOWTO_START_INDEX))) {
      return;
    }
    this.scope = target;
    this.index = this._minIndex();
    sounds.pop();
    haptics.light();
    this.render({ playCue: true });
  }

  next() {
    if (this.index < this._maxIndex()) {
      this.index += 1;
      haptics.light();
      this.render({ playCue: true });
    } else {
      sounds.up();
      haptics.success();
      this.close({ completed: true });
    }
  }

  prev() {
    if (this.index > this._minIndex()) {
      this.index -= 1;
      sounds.pop();
      haptics.light();
      this.render({ playCue: false });
    }
  }

  handleBackAction() {
    if (!this.isOpen()) return false;
    if (this.index > this._minIndex()) {
      this.prev();
      return true;
    }
    if (!this.lockUntilComplete) {
      sounds.whoosh();
      this.close({ completed: false });
    }
    return true;
  }

  _playPanelCue(cue) {
    switch (cue) {
      case 'sunny':
        sounds.welcome();
        break;
      case 'ambush':
        sounds.fail();
        break;
      case 'punch':
        sounds.hit();
        sounds.like();
        break;
      case 'escape':
        sounds.whoosh();
        break;
      case 'briefing':
        sounds.upgrade();
        break;
      case 'finale':
        sounds.survive();
        break;
      default:
        sounds.pop();
    }
  }

  render({ playCue = false } = {}) {
    this._bindDOM();
    const panel = STORY_PANELS[this.index] || STORY_PANELS[0];
    const minIdx = this._minIndex();
    const maxIdx = this._maxIndex();
    const totalInScope = maxIdx - minIdx + 1;
    const stepInScope = this.index - minIdx + 1;

    if (this.el.eyebrow) {
      this.el.eyebrow.textContent = panel.section === 'howto' ? 'HOW TO PLAY' : 'THE STORY SO FAR';
    }
    if (this.el.title) {
      this.el.title.textContent = panel.section === 'howto' ? 'ARCADE RULES' : 'WHO ROBBED ME BIRD?!';
    }
    if (this.el.tabStory) {
      const isStory = this.scope === 'story';
      this.el.tabStory.classList.toggle('active', isStory);
      this.el.tabStory.setAttribute('aria-pressed', String(isStory));
    }
    if (this.el.tabHowTo) {
      const isHowTo = this.scope === 'howto';
      this.el.tabHowTo.classList.toggle('active', isHowTo);
      this.el.tabHowTo.setAttribute('aria-pressed', String(isHowTo));
    }
    if (this.el.btnClose) {
      this.el.btnClose.classList.toggle('hidden', this.lockUntilComplete);
    }

    if (this.el.stage) {
      this.el.stage.classList.remove('is-shaking');
      if (panel.shake) {
        void this.el.stage.offsetWidth;
        this.el.stage.classList.add('is-shaking');
      }
    }

    if (this.el.art) {
      this.el.art.src = panel.art;
      this.el.art.alt = panel.caption;
    }

    if (this.el.caption) {
      this.el.caption.textContent = panel.caption;
      this.el.caption.className = `comic-caption${panel.captionEvil ? ' evil' : ''}`;
    }

    if (this.el.bubbles) {
      this.el.bubbles.innerHTML = '';
      panel.bubbles.forEach((b, i) => {
        const el = document.createElement('div');
        el.className = `comic-bubble ${b.style}`;
        el.style.animationDelay = `${i * 0.1}s`;
        if (b.top) el.style.top = b.top;
        if (b.left) el.style.left = b.left;
        if (b.right) el.style.right = b.right;
        if (b.maxWidth) el.style.maxWidth = b.maxWidth;
        el.innerHTML = `<span class="comic-speaker ${b.role}">${b.speaker}</span><span class="comic-line">${b.text}</span>`;
        this.el.bubbles.appendChild(el);
      });

      panel.sfx.forEach((fx, i) => {
        const el = document.createElement('div');
        el.className = 'comic-sfx';
        el.textContent = fx.text;
        el.style.animationDelay = `${0.06 + i * 0.08}s`;
        if (fx.top) el.style.top = fx.top;
        if (fx.left) el.style.left = fx.left;
        if (fx.right) el.style.right = fx.right;
        if (fx.color) el.style.color = fx.color;
        el.style.transform = `rotate(${fx.rot || '-6deg'})`;
        this.el.bubbles.appendChild(el);
      });
    }

    if (this.el.rules) {
      this.el.rules.innerHTML = '';
      if (panel.rules.length > 0) {
        this.el.rules.classList.remove('hidden');
        panel.rules.forEach((r) => {
          const chip = document.createElement('div');
          chip.className = `comic-rule-chip ${r.kind}`;
          chip.innerHTML = `<span class="comic-rule-badge">${r.badge}</span><span class="comic-rule-txt">${r.html}</span>`;
          this.el.rules.appendChild(chip);
        });
      } else {
        this.el.rules.classList.add('hidden');
      }
    }

    if (this.el.progress) {
      this.el.progress.innerHTML = '';
      for (let i = minIdx; i <= maxIdx; i++) {
        const pip = document.createElement('span');
        pip.className = `comic-pip${i < this.index ? ' done' : ''}${i === this.index ? ' active' : ''}`;
        this.el.progress.appendChild(pip);
      }
    }

    if (this.el.counter) {
      this.el.counter.textContent = `${stepInScope} / ${totalInScope}`;
    }
    if (this.el.btnBack) {
      this.el.btnBack.disabled = this.index <= minIdx;
    }
    if (this.el.btnNext) {
      const isLast = this.index >= maxIdx;
      this.el.btnNext.textContent = isLast
        ? (this.scope === 'story' ? "LET'S PLAY! ▶" : 'GOT IT! ✓')
        : 'NEXT ▶';
      this.el.btnNext.classList.toggle('finish', isLast);
    }

    if (playCue) this._playPanelCue(panel.cue);
  }
}
