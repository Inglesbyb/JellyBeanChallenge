// Panel-by-panel Weebl Story, How-To-Play & Ending Epilogue Comic Deck (readable 100% muted, explicit BACK/NEXT progression).
import { sounds } from '../audio.js';
import { haptics } from '../haptics.js';

export const COMIC_COLLECTIBLES = [
  {
    id: 'intro_comic',
    issueNumber: 'ISSUE #01',
    tag: 'PROLOGUE',
    title: 'WHO ROBBED ME BIRD?!',
    description: 'Lord Brim ambushes Sunburst Plaza! Watch the original intro comic & arcade guide.',
    cover: '/assets/story/panel_01.jpg',
    panelCountLabel: '6 PANELS · STORY + GUIDE',
    scope: 'story',
    unlockedByDefault: true,
    unlockHint: 'Unlocked from the beginning!',
  },
  {
    id: 'pub_call_comic',
    issueNumber: 'ISSUE #02',
    tag: 'BONUS STILL',
    title: "KING JELLY'S PUB CALL",
    description: 'Down at the boozer with the lads while Queen Bean goes nuclear on the phone!',
    lockedDescription: 'Clear Stage 1-1 (Snack Street) in World 1 to unlock this comic in Collectables!',
    cover: '/assets/story/pub_call_01.jpg',
    panelCountLabel: '1 PANEL · COMIC STILL',
    scope: 'pub_call',
    unlockedByDefault: false,
    unlockHint: 'Clear Stage 1-1',
  },
  {
    id: 'queen_40th_comic',
    issueNumber: 'ISSUE #03',
    tag: 'BONUS STILL',
    title: "QUEEN BEAN'S 40TH GLOW-UP",
    description: 'She asked for a subtle 40th birthday refresh… King Jelly is speechless!',
    lockedDescription: 'Clear Stage 1-2 (Harbor Drop) in World 1 to unlock this comic in Collectables!',
    cover: '/assets/story/queen_40th_01.jpg',
    panelCountLabel: '1 PANEL · COMIC STILL',
    scope: 'queen_40th',
    unlockedByDefault: false,
    unlockHint: 'Clear Stage 1-2',
  },
  {
    id: 'klarna_pizza_comic',
    issueNumber: 'ISSUE #04',
    tag: 'BONUS STILL',
    title: "KING JELLY'S KLARNA PIZZA",
    description: "Treasury's empty, so King Jelly's ordering a cheeky Domino's in 3 easy payments!",
    lockedDescription: 'Clear Stage 1-3 (Brick District) in World 1 to unlock this comic in Collectables!',
    cover: '/assets/story/klarna_pizza_01.jpg',
    panelCountLabel: '1 PANEL · COMIC STILL',
    scope: 'klarna_pizza',
    unlockedByDefault: false,
    unlockHint: 'Clear Stage 1-3',
  },
  {
    id: 'asbo_prep_comic',
    issueNumber: 'ISSUE #05',
    tag: 'BONUS STILL',
    title: 'LOCAL TEENAGER PREP',
    description: 'One deep breath on the attic ledge before braving the lads outside the shop!',
    lockedDescription: 'Clear Stage 1-4 (Skyline Siege) in World 1 to unlock this comic in Collectables!',
    cover: '/assets/story/asbo_prep_01.jpg',
    panelCountLabel: '1 PANEL · COMIC STILL',
    scope: 'asbo_prep',
    unlockedByDefault: false,
    unlockHint: 'Clear Stage 1-4',
  },
  {
    id: 'karate_pickup_comic',
    issueNumber: 'ISSUE #06',
    tag: 'BONUS STILL',
    title: 'KARATE PICKUP',
    description: 'King Jelly picks his lad up from karate — guess what he learned!',
    lockedDescription: 'Clear Stage 1-5 (Apex Spire) in World 1 to unlock this comic in Collectables!',
    cover: '/assets/story/karate_pickup_01.jpg',
    panelCountLabel: '1 PANEL · COMIC STILL',
    scope: 'karate_pickup',
    unlockedByDefault: false,
    unlockHint: 'Clear Stage 1-5',
  },
  {
    id: 'ending_comic',
    issueNumber: 'ISSUE #07',
    tag: 'EPILOGUE',
    title: 'LORD BRIM VANQUISHED!',
    description: 'The Citadel falls, Queen Bean is rescued, and Brim flees in his Neon 110s!',
    lockedDescription: "Beat Stage 1-6 (Lord Brim's Citadel) in World 1 to unlock this comic in Collectables!",
    cover: '/assets/story/ending_01.jpg',
    panelCountLabel: '5 PANELS · EPILOGUE',
    scope: 'ending',
    unlockedByDefault: false,
    unlockHint: 'Defeat Lord Brim (1-6)',
  },
];

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

export const ENDING_PANELS = [
  {
    id: 1,
    section: 'ending',
    art: '/assets/story/ending_01.jpg',
    cue: 'finale',
    shake: true,
    caption: "MEANWHILE, IN THE RUINS OF LORD BRIM'S CITADEL…",
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: 'Thought you was mad n that — what now, yer little victim?!',
        style: 'tail-bl',
        top: '10.5%',
        left: '4.5%',
        maxWidth: '65%',
      },
    ],
    sfx: [],
    rules: [],
  },
  {
    id: 2,
    section: 'ending',
    art: '/assets/story/ending_02.jpg',
    cue: 'sunny',
    shake: false,
    caption: 'QUEEN BEAN RESCUED! REUNITED AT LAST…',
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: 'Are you ok luv?',
        style: 'tail-bc compact-split',
        top: '10%',
        left: '3.2%',
        maxWidth: '33%',
      },
      {
        speaker: 'QUEEN BEAN',
        role: 'queen',
        text: "Yeah am sound thanks, but HIM — eeee he's horrible him, robbing birds an' that, he needs to get a grip!",
        style: 'tail-queen compact-split',
        top: '10%',
        right: '3.2%',
        maxWidth: '59%',
      },
    ],
    sfx: [],
    rules: [],
  },
  {
    id: 3,
    section: 'ending',
    art: '/assets/story/ending_03.jpg',
    cue: 'ambush',
    shake: false,
    caption: 'WAIT A SECOND — WHY IS HE STILL LAUGHING?!',
    bubbles: [
      {
        speaker: 'LORD BRIM',
        role: 'brim',
        text: 'Hahah you may of got your bird back, but I still have these…',
        style: 'brim-bubble tail-br-wide',
        top: '10.5%',
        right: '4%',
        maxWidth: '66%',
      },
    ],
    sfx: [
      { text: 'MWAHAHA!', top: '28%', left: '38%', rot: '-8deg', color: '#e879f9' },
      { text: 'GRRR!', top: '26.5%', left: '15.5%', rot: '-6deg', color: '#fbbf24', style: 'compact-grrr' },
    ],
    rules: [],
  },
  {
    id: 4,
    section: 'ending',
    art: '/assets/story/ending_04.jpg',
    cue: 'punch',
    shake: true,
    caption: 'WAIT A SECOND!!',
    captionStyle: 'right-split',
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: 'Lad they best not be my <span class="comic-neon-txt">NEON 110s</span>',
        style: 'compact-split tail-bc',
        top: '9.5%',
        left: '58.5%',
        right: '2.4%',
      },
    ],
    sfx: [],
    rules: [],
  },
  {
    id: 5,
    section: 'ending',
    art: '/assets/story/ending_05.jpg',
    cue: 'escape',
    shake: false,
    caption: 'TO BE CONTINUED IN WORLD 2!!',
    captionEvil: true,
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: "It's time to go into World&nbsp;2… and this time it's personal",
        style: 'compact-split tail-bl',
        top: '11%',
        left: '2.8%',
        maxWidth: '44%',
      },
      {
        speaker: 'QUEEN BEAN',
        role: 'queen',
        text: 'Hey, he did kidnap me you know',
        style: 'compact-queen tail-rc',
        top: '55.5%',
        left: '43%',
        width: '27.5%',
      },
    ],
    sfx: [],
    rules: [],
  },
];

export const PUB_CALL_PANELS = [
  {
    id: 1,
    section: 'pub_call',
    art: '/assets/story/pub_call_01.jpg',
    cue: 'ambush',
    shake: true,
    caption: "KING JELLY BEAN TRYING TO BLEND IT LIKE HE'S NOT GETTING ABUSE…",
    captionStyle: 'compact-line',
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: 'Yeah ok… love you too babe!',
        style: 'compact-split tail-bc',
        top: '9.5%',
        left: '2.5%',
        maxWidth: '41%',
      },
      {
        speaker: 'QUEEN BEAN',
        role: 'queen',
        text: '<span class="comic-grawlix-txt">$$%@!</span> And watch when yer get home you&rsquo;re gettin&rsquo; <span class="comic-grawlix-txt">$$%!!</span> You little <span class="comic-grawlix-txt">R%T!! #$%&amp;!</span>',
        style: 'compact-queen queen-rage tail-queen',
        top: '9%',
        right: '2.4%',
        maxWidth: '47%',
      },
    ],
    sfx: [
      { text: '#@$%!!', top: '28%', right: '5.5%', rot: '9deg', color: '#fde047' },
    ],
    rules: [],
  },
];

export const QUEEN_40TH_PANELS = [
  {
    id: 1,
    section: 'queen_40th',
    art: '/assets/story/queen_40th_01.jpg',
    cue: 'sunny',
    shake: false,
    caption: 'KING JELLY REGRETTING TAKING HIS BIRD FOR LIP FILLERS…',
    captionStyle: 'compact-line',
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: "Er… yeah luv, dead subtle! Can't even tell!!",
        style: 'compact-split tail-bc',
        top: '9%',
        left: '2.4%',
        maxWidth: '37%',
      },
      {
        speaker: 'QUEEN BEAN',
        role: 'queen',
        text: "Do I look 21 or wha', babe? Pure natural look!",
        style: 'compact-queen tail-queen',
        top: '9%',
        right: '2.4%',
        maxWidth: '38%',
      },
    ],
    sfx: [],
    rules: [],
  },
];

export const KLARNA_PIZZA_PANELS = [
  {
    id: 1,
    section: 'klarna_pizza',
    art: '/assets/story/klarna_pizza_01.jpg',
    cue: 'sunny',
    shake: false,
    caption: "LACK OF GOLD IN THE KINGDOM, KING JELLY IS GETTING A DOMINO'S ON KLARNA",
    bubbles: [],
    sfx: [],
    rules: [],
  },
];

export const ASBO_PREP_PANELS = [
  {
    id: 1,
    section: 'asbo_prep',
    art: '/assets/story/asbo_prep_01.jpg',
    cue: 'sunny',
    shake: false,
    caption: 'KING JELLY IS HYPING HIMSELF UP TO WALK PAST THE LOCAL TEENAGERS WHO HANG OUT OUTSIDE THE SHOP',
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: 'Not intimidating me today mate, no chance',
        style: 'compact-split tail-bc',
        top: '16.5%',
        left: '4.5%',
        maxWidth: '72%',
      },
    ],
    sfx: [],
    rules: [],
  },
];

export const KARATE_PICKUP_PANELS = [
  {
    id: 1,
    section: 'karate_pickup',
    art: '/assets/story/karate_pickup_01.jpg',
    cue: 'punch',
    shake: true,
    caption: 'PICKING HIS LAD UP FROM KARATE',
    captionStyle: 'left-tag',
    bubbles: [
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: 'Hey, how was karate? What did you learn?',
        style: 'compact-lifted tail-bl',
        top: '4.8%',
        right: '2.4%',
        maxWidth: '47%',
      },
      {
        speaker: 'SON',
        role: 'hero',
        text: '...',
        style: 'compact-ellipsis tail-lc',
        top: '21%',
        left: '76.5%',
      },
      {
        speaker: 'KING JELLY BEAN',
        role: 'hero',
        text: 'Nothing!! You learned absolutely nothing!!',
        style: 'compact-split tail-bl',
        top: '51.5%',
        right: '2.6%',
        maxWidth: '51%',
      },
    ],
    sfx: [],
    rules: [],
  },
];

export const HOWTO_START_INDEX = 4;

function getPanelsForScope(scope) {
  if (scope === 'ending') return ENDING_PANELS;
  if (scope === 'pub_call') return PUB_CALL_PANELS;
  if (scope === 'queen_40th') return QUEEN_40TH_PANELS;
  if (scope === 'klarna_pizza') return KLARNA_PIZZA_PANELS;
  if (scope === 'asbo_prep') return ASBO_PREP_PANELS;
  if (scope === 'karate_pickup') return KARATE_PICKUP_PANELS;
  return STORY_PANELS;
}

export class StoryComicDeck {
  constructor({ onComplete } = {}) {
    this.onComplete = onComplete;
    this.scope = 'story'; // 'story' (1..6) | 'howto' (5..6) | 'ending' (1..5) | 'pub_call' | 'queen_40th' | 'klarna_pizza' | 'asbo_prep' | 'karate_pickup'
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
    if (this.el.stage) {
      let sx = 0;
      let sy = 0;
      let tracking = false;
      this.el.stage.addEventListener('dragstart', (e) => e.preventDefault());
      this.el.stage.addEventListener('pointerdown', (e) => {
        if (e.button && e.button !== 0) return;
        sx = e.clientX;
        sy = e.clientY;
        tracking = true;
      });
      window.addEventListener('pointerup', (e) => {
        if (!tracking) return;
        tracking = false;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if (Math.abs(dx) >= 48 && Math.abs(dy) < 75) {
          if (dx < 0) this.next();
          else this.prev();
        }
      });
      window.addEventListener('pointercancel', () => { tracking = false; });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (!this.isOpen()) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.next();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.prev();
        } else if (e.key === 'Escape' && !this.lockUntilComplete) {
          e.preventDefault();
          sounds.whoosh();
          this.close({ completed: false });
        }
      });
    }
    this._bound = true;
  }

  _panels() {
    return getPanelsForScope(this.scope);
  }

  _minIndex() {
    return this.scope === 'howto' ? HOWTO_START_INDEX : 0;
  }

  _maxIndex() {
    return this._panels().length - 1;
  }

  isOpen() {
    this._bindDOM();
    return Boolean(this.el.modal && !this.el.modal.classList.contains('hidden'));
  }

  _resolveScope(scope) {
    if (scope === 'story' || scope === 'ending' || scope === 'pub_call' || scope === 'queen_40th' || scope === 'klarna_pizza' || scope === 'asbo_prep' || scope === 'karate_pickup') return scope;
    return 'howto';
  }

  _isBonusScope(scope = this.scope) {
    return scope === 'pub_call' || scope === 'queen_40th' || scope === 'klarna_pizza' || scope === 'asbo_prep' || scope === 'karate_pickup';
  }

  open({ scope = 'howto', lockUntilComplete = false } = {}) {
    this._bindDOM();
    this.scope = this._resolveScope(scope);
    this.lockUntilComplete = Boolean(lockUntilComplete);
    this.index = this._minIndex();
    this.el.modal?.classList.remove('hidden');
    this.el.card?.classList.toggle('is-locked', this.lockUntilComplete);
    this.el.card?.classList.toggle('is-ending', this.scope === 'ending');
    this.el.card?.classList.toggle('is-bonus', this._isBonusScope());
    this.render({ playCue: false });
  }

  close({ completed = false } = {}) {
    this._bindDOM();
    this.el.modal?.classList.add('hidden');
    this.el.card?.classList.remove('is-ending', 'is-bonus');
    if (typeof this.onComplete === 'function') {
      this.onComplete({ completed, scope: this.scope });
    }
  }

  setScope(scope) {
    const target = this._resolveScope(scope);
    if (
      this.scope === target &&
      ((target === 'story' && this.index === 0) ||
        (target === 'ending' && this.index === 0) ||
        (this._isBonusScope(target) && this.index === 0) ||
        (target === 'howto' && this.index >= HOWTO_START_INDEX))
    ) {
      return;
    }
    this.scope = target;
    this.index = this._minIndex();
    this.el.card?.classList.toggle('is-ending', this.scope === 'ending');
    this.el.card?.classList.toggle('is-bonus', this._isBonusScope());
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
    const panels = this._panels();
    const panel = panels[this.index] || panels[0];
    const minIdx = this._minIndex();
    const maxIdx = this._maxIndex();
    const totalInScope = maxIdx - minIdx + 1;
    const stepInScope = this.index - minIdx + 1;

    if (this.el.eyebrow) {
      this.el.eyebrow.textContent = panel.section === 'ending'
        ? 'CITADEL FINALE · EPILOGUE'
        : this._isBonusScope(panel.section)
          ? 'BONUS STILL · COLLECTABLE'
          : panel.section === 'howto'
            ? 'HOW TO PLAY'
            : 'THE STORY SO FAR';
    }
    if (this.el.title) {
      this.el.title.textContent = panel.section === 'ending'
        ? 'LORD BRIM VANQUISHED!'
        : panel.section === 'pub_call'
          ? "KING JELLY'S PUB CALL"
          : panel.section === 'queen_40th'
            ? "QUEEN BEAN'S 40TH GLOW-UP"
            : panel.section === 'klarna_pizza'
              ? "KING JELLY'S KLARNA PIZZA"
              : panel.section === 'asbo_prep'
                ? 'LOCAL TEENAGER PREP'
                : panel.section === 'karate_pickup'
                  ? 'KARATE PICKUP'
                  : panel.section === 'howto'
                    ? 'ARCADE RULES'
                    : 'WHO ROBBED ME BIRD?!';
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
      this.el.caption.className = `comic-caption${panel.captionEvil ? ' evil' : ''}${panel.captionStyle ? ` ${panel.captionStyle}` : ''}`;
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
        if (b.width) el.style.width = b.width;
        if (b.maxWidth) el.style.maxWidth = b.maxWidth;
        el.innerHTML = `<span class="comic-speaker ${b.role}">${b.speaker}</span><span class="comic-line">${b.text}</span>`;
        this.el.bubbles.appendChild(el);
      });

      panel.sfx.forEach((fx, i) => {
        const el = document.createElement('div');
        el.className = `comic-sfx${fx.style ? ` ${fx.style}` : ''}`;
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
        ? (this.scope === 'ending'
          ? '🗺️ RETURN TO WORLD'
          : this._isBonusScope()
            ? '✓ BACK TO COMICS'
            : this.scope === 'story'
              ? "LET'S PLAY! ▶"
              : 'GOT IT! ✓')
        : 'NEXT ▶';
      this.el.btnNext.classList.toggle('finish', isLast);
    }

    if (playCue) this._playPanelCue(panel.cue);
  }
}
