// All gameplay timing runs on `clock`: game-time milliseconds that stop while paused and slow down during
// hit-stop / slow-mo. Per-frame math is scaled by `f` (deltaFactor), where f = 1 is one 60fps frame, so the
// game plays the same at 60Hz, 120Hz, or 144Hz.

const TAU = Math.PI * 2;
const TARGET_DELTA = 1000 / 60;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ROCKET_COLORS = {
  red: '#ff4d4d',
  amber: '#ffbf00',
  green: '#00cc00',
  blue: '#00b7ff',
  purple: '#9900cc',
  pink: '#ff66b2',
  gray: '#686868'
};
const SPACE_INK = '#07020f'; // shadow color for sprites: deep violet, never gray
const CREAM = '#fff1dc';
const ROCKET_SCALE = 1.2;
const ROCKET_SPRITE_SIZE = 56;
const ROCKET_ROTATION_EASING = 0.25;
const NOSE_OFFSET = 22; // distance from ship center to nose tip
const PLAYER_HIT_RADIUS = 10; // deliberately smaller than the ship so near misses feel fair
const PLAYER_WALL_RADIUS = 16;
const SHIELD_RADIUS = 30;
const SPAWN_INVULNERABILITY = 3000;
const STARTING_LIVES = 3;
const MAX_LIVES = 5;
const RESPAWN_DELAY = 1500; // ms between losing a ship and the next one warping in
const SHIP_GLYPH = 'M6 0C9 3 9.6 8 9 13H3C2.4 8 3 3 6 0ZM3 9.5 0 15.5 3 14ZM9 9.5 12 15.5 9 14Z'; // 12×20, nose up (HUD lives)
const THRUST_COLORS = ['#FF6B00', '#FF9500', '#FFC107'];

const ASTEROID_COLORS = ['#ff4d6d', '#2de2c8', '#3cc8ff', '#4dff88', '#ffe066', '#ff4dff', '#ff9a3c', '#b4a7ff'];
const ASTEROID_MIN_SIZE = 20;
const ASTEROID_MAX_SIZE = 50;
const ASTEROID_SPLIT_MIN_SIZE = 28; // asteroids at least this big break into two smaller ones
const ASTEROID_SPLIT_RATIO = 0.6;
const ASTEROID_MAX_SPEED = 4;
const ASTEROID_SPLIT_SPEED = 1.0; // fragment speed relative to the parent (min 1.5)
const ASTEROID_PLAYER_HIT_RATIO = 0.85; // vs the ship, asteroids are a bit smaller than their outline's average radius
const ASTEROID_SPAWN_MIN = 600;
const ASTEROID_SPAWN_MAX = 2000;
const ASTEROID_POINTS_MIN = 50; // largest asteroids
const ASTEROID_POINTS_MAX = 250; // smallest asteroids
const ASTEROID_POINTS_STEP = 50;
const STARTING_ASTEROIDS = 4;
// Asteroids come in waves of "families" (an asteroid plus all its fragments). Clear a wave for a bonus and a
// breather; leave it standing and the next wave still comes, but only tops the field up to its size, so a
// struggling player is never buried and a good one is never punished with a denser field.
const WAVE_SIZE = [4, 1, 10]; // families: first wave, +per wave, max
const WAVE_BREATHER = 1800; // ms of calm after a clear
const WAVE_REINFORCE = 25000; // ms until the next wave arrives anyway
const WAVE_STAGGER = [150, 450]; // ms between a wave's rocks
const WAVE_CLEAR_POINTS = 250; // × the wave number; ×2 for FAST, ×2 more for FLAWLESS
const WAVE_PAR = 3000; // ms per rock family: clear the wave within par for FAST
// New rocks (and boss shots) speed up with the waves you reach, plus a slow creep with time so stalling isn't
// free: difficulty follows skill, not just the clock
const DIFFICULTY_PER_WAVE = 0.045;
const DIFFICULTY_PER_MINUTE = 0.03;
const DIFFICULTY_SPEED_MAX = 1.6;

const BULLET_SPEED = 15;
const BULLET_LIFETIME = 2500;
const BULLET_COLOR = '#FFBF00';
const BULLET_BEND = 0.85; // black hole pull on bullets as a fraction of orbital strength; < 1 so bullets can never orbit forever
const SPREAD_ANGLE = 0.18;

const COMBO_STEP = 3; // consecutive hits per multiplier step
const COMBO_MAX_MULTIPLIER = 8;
const COMBO_COLOR = '#ff4dff';
const TRICK_SHOT_ANGLE = 0.5; // radians a bullet must be bent by gravity to count as a trick shot
const TRICK_SHOT_MULTIPLIER = 2;

const BLACK_HOLE_SIZE = ASTEROID_MAX_SIZE * 1.75;
const BLACK_HOLE_CORE_RADIUS = 16; // touching this kills
const BLACK_HOLE_CORE_DRAW = 20;
const BLACK_HOLE_DURATION_MIN = 8000;
const BLACK_HOLE_DURATION_MAX = 15000;
const BLACK_HOLE_GRAVITY_STRENGTH = 0.2;
const BLACK_HOLE_ROTATION_SPEED = 0.03;
const BLACK_HOLE_SPAWN_MIN = 10000;
const BLACK_HOLE_SPAWN_MAX = 30000;
const BLACK_HOLE_MIN_SPAWN_DISTANCE = 100;

const POWER_UP_SPAWN = {
  star: [20000, 60000],
  shield: [20000, 60000],
  spread: [25000, 50000],
  ricochet: [40000, 80000],
  lance: [40000, 80000],
  well: [40000, 80000],
  life: [75000, 120000] // rare; skipped while you're at MAX_LIVES
};
const POWER_UP_DURATION = { shield: 10000, spread: 8000, ricochet: 10000, lance: 7000, well: 8000 };
const POWER_UP_WARNING = 2000;
const GAUGE_RADIUS = 6; // power-up timer donuts above the ship
const GAUGE_GAP = 26; // between their centers
const GAUGE_STOPS = [[0, '#ff3b3b'], [0.2, '#ff8a1f'], [0.45, '#ffe14d'], [0.7, '#3dff7a']]; // [share of time left, color]
const GAUGE_LIFT = 40; // above the ship's center
const powerUpTable = value => Object.fromEntries(Object.keys(POWER_UP_DURATION).map(type => [type, value]));
const POWER_UP_POINTS = 500;
const POWER_UP_COLORS = {
  star: '#ffe14d',
  shield: '#9ff3ff',
  spread: '#ff4dff',
  ricochet: '#c6ff3c',
  lance: '#a66bff',
  well: '#2de2c8',
  get life() {
    return rocketColor; // an extra ship in your own paint
  }
};
const POWER_UP_LABELS = {
  star: 'SUPERNOVA!',
  shield: 'SHIELD',
  spread: 'SPREAD SHOT',
  ricochet: 'RICOCHET',
  lance: 'LANCE',
  well: 'POCKET WELL',
  life: '1UP!'
};
const RICOCHET_BOUNCES = 3; // wall bounces per bullet; a banked hit scores as a trick shot
const WELL_RADIUS = 170; // pocket well: a gravity well that bends your bullets and corrals asteroids
const WELL_PULL = 90; // bends passing bullets ~0.5–1.4 rad; steering only, so it can never capture them
const WELL_GRAB_RADIUS = 260; // asteroids this close get dragged in...
const WELL_GRAB = 0.08; // ...with this pull per frame...
const WELL_GRAB_DRAG = 0.97; // ...and damped, so they pile up around it instead of slingshotting through

// Gloomray: a void manta mini-boss that drifts in now and then, inhales and spits spores
const GLOOMRAY_ENTRANCE = 2000; // shadow pass + edge ripples before it swims in
const GLOOMRAY_HP = [14, 4, 30]; // first appearance, +per later appearance, max
const GLOOMRAY_SPEED = [1.6, 0.15]; // base, +per appearance
const GLOOMRAY_VOLLEYS = 5; // then it leaves
const GLOOMRAY_VOLLEY_GAP = [2800, 200, 1800]; // ms between volleys: base, -per appearance, min
const GLOOMRAY_TRACK = 400; // inhale, lanes follow you...
const GLOOMRAY_LOCK = 600; // ...then lanes freeze this long before the spit (never shrinks)
const GLOOMRAY_MIN_FIRE_DISTANCE = 140; // never starts an inhale closer than this
const GLOOMRAY_PERSONAL_SPACE = 220; // patrol keeps about this far from the ship
const GLOOMRAY_SCALE = 1.4; // sprite units → world: wingspan ~130
const GLOOMRAY_HIT_RADIUS = 36; // vs bullets (body + inner wings)
const GLOOMRAY_BODY_RADIUS = 22; // vs the ship (just the body, so wingtips don't feel cheap)
const GLOOMRAY_MOUTH = 31; // mouth distance ahead of center
const GLOOMRAY_INHALE_RADIUS = 170; // bullets this close to the mouth get steered into it
const GLOOMRAY_INHALE_PULL = 110;
const GLOOMRAY_CHOKE_HITS = 3; // hits during one inhale cancel the volley
const GLOOMRAY_RAM_DAMAGE = 4; // shield ram
const GLOOMRAY_POINTS = 3000;
const GLOOMRAY_CHOKE_POINTS = 500;
const SPORES_PER_VOLLEY = [3, 1, 7]; // base, +per appearance, max
const SPORE_SPREAD = 0.2; // radians between lanes
const SPORE_SPEED = 2.6; // × difficultySpeed()
const SPORE_LIFETIME = 4500;
const SPORE_RADIUS = 6;
const SPORE_POINTS = 100;
const SPORE_COLOR = '#c6ff3d'; // chartreuse: no asteroid, bullet or power-up uses it
const GLOOMRAY_RIM = '#72f4ff';
const GLOOMRAY_VIOLET = '#9b6bff';
const GLOOMRAY_INK = '#0c0326';
const GLOOMRAY_SPRITE_SIZE = 124;
const SPORE_SPRITE_SIZE = 32;


const HIGH_SCORE_KEY = 'highScore';
const TRACER_LENGTH = 400;
const TRACER_COLOR = '#FFBF00';
const TRACER_WIDTH = 1.5;
// Deep field: the backdrop shared by the title screen and play. A violet base, cosmic-blue nebulae with a
// whisper of cyan on their lit edges, and three parallax star layers. Each wave eases the nebulae one step
// through NEBULA_PALETTES, a quiet "you've gone deeper" marker.
const PHOSPHOR_PERSISTENCE = 0.55; // share of the previous frame still glowing after 1/60s
const NEBULA_PALETTES = [
  { a: '#2140ff', b: '#6a2cff', rim: '#3ff0ff' }, // cosmic blue and violet
  { a: '#2a1bb0', b: '#1067ff', rim: '#5ff6ff' }, // indigo and azure
  { a: '#5b20d6', b: '#1d4dff', rim: '#7fe9ff' }, // violet and blue
  { a: '#0e3aa6', b: '#1aa6d6', rim: '#9ff8ff' } // deep sea and teal
];
const NEBULA_ALPHA = 0.18; // how strongly the clouds show over the base (low: gameplay stays readable)
const NEBULA_FADE = 4000; // ms to ease into a new wave's palette
const NEBULA_RES = 0.5; // painted at half resolution, softened, then scaled up
const STAR_LAYERS = [
  // count per megapixel, size, brightness, parallax (share of the ship's offset), drift px/s
  { density: 90, size: [0.4, 0.9], brightness: [0.25, 0.5], parallax: 0.015, drift: 1.5 },
  { density: 50, size: [0.7, 1.4], brightness: [0.4, 0.75], parallax: 0.04, drift: 4 },
  { density: 16, size: [1.2, 2.2], brightness: [0.6, 1], parallax: 0.08, drift: 9 }
];
const CRUISE_SPEED = 0.025; // px/ms the stars stream past (scaled by layer depth: ~9px/s far, ~31px/s near)
const STAR_TINTS = ['#ffffff', '#ffffff', '#ffffff', '#b8ccff', '#9fe8ff']; // mostly white, some blue, a little cyan
const SOUND_NAMES = [
  'asteroid-explode',
  'asteroid-spawn',
  'black-hole-destroy',
  'black-hole-spawn',
  'bump',
  'click',
  'game-over',
  'game-start',
  'power-up-expire',
  'power-up-spawn',
  'power-up',
  'shoot',
  'supernova',
  'thrust'
];

const $ = id => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = $('score');
const accuracyDisplay = $('accuracy');
const hitsDisplay = $('hits');
const livesDisplay = $('lives');
const shipTitles = $('shipTitles');
const shipStats = $('shipStats');
const shipDetails = $('shipDetails');
const shipAnnounce = $('shipAnnounce');
const comboDisplay = $('combo');
const highScoreDisplay = $('highScore');
const timerDisplay = $('timer');
const soundToggle = $('soundToggle');
const zeroGravityToggle = $('zeroGravityToggle');
const gameOverDisplay = $('gameOver');
const newBestDisplay = $('newBest');
const finalStats = $('finalStats');
const pausedDisplay = $('paused');
const testDeck = $('testDeck');
const startDialog = $('startDialog');
const directionalControl = $('directionalControl');
const joystick = $('joystick');
const shootButton = $('shootButton');
const restartButton = $('restartButton');

let rocketColor = ROCKET_COLORS.blue;
let rocketHull = 'classic';
let rocketSprite = null;
let scaleFactor = 1; // world zoom: phones see a zoomed-out (2x larger) world
let dpr = 1;
let W = 0; // world width in game units
let H = 0;
let clock = 0;
let lastTime = performance.now();
let isPaused = false;
let godMode = false; // test deck: nothing can kill the ship
let hitstop = 0; // real ms left of frozen frame
let slowMo = 0; // real ms left of slow motion
let shake = 0; // current screen shake in px
let flash = 0; // supernova screen flash, 0..1
let bullets = [];
let asteroids = [];
let powerUps = [];
let blackHoles = [];
let pointTexts = [];
let particles = [];
let pendingAsteroids = []; // clock times at which to spawn a new asteroid
let wave = 0;
let nextWave = Infinity;
let waveStats = { at: 0, families: 0, shots: 0, hits: 0 }; // for FAST and FLAWLESS
let score = 0;
let displayScore = 0;
let shotsFired = 0;
let bulletHits = 0;
let hits = 0;
let combo = 0;
let maxCombo = 0;
let gameStarted = false;
let gameStartTime = 0;
let gameOverShown = false;
let gameOverShownAt = 0;
let nextPowerUp = {};
let nextBlackHole = null;
let bosses = [];
let enemyShots = [];
let bossBag = []; // kinds still to meet before any repeat
let bossCounts = new Map(); // kind → appearances this run
let encounters = 0; // boss arrivals this run (a duo counts once)
let bossesOff = false; // tests: no boss waves
let duoAt = Infinity; // when the second boss of a duo arrives
let cover = []; // rocks that block enemy fire this frame: the field plus any worn Hollowclaw shell
let sporeSprite = null;
let gloomrayShadow = null;
let cachedHighScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
let bestAtStart = cachedHighScore;
let isSoundEnabled = localStorage.getItem('soundEnabled') !== 'false';

const player = {
  x: 0,
  y: 0,
  angle: 0,
  velX: 0,
  velY: 0,
  rotationSpeed: 0,
  shootScale: 1,
  shootTimer: 0,
  exploded: false,
  deathTime: 0,
  respawnTime: 0,
  arriveUntil: 0, // gliding in at the start of a run; no input, no hits
  lives: STARTING_LIVES,
  isThrusting: false,
  thrustSign: 1, // 1 = main engine (tail), -1 = retro thrust (nose)
  exhaust: 0,
  timers: powerUpTable(0), // clock time each power-up ends
  warned: powerUpTable(false),
  well: null, // { x, y, opacity } while a pocket well is active
  shieldAngle: 0,
  lastShotTime: -Infinity,
  tracerEnabled: false,
  lastBumpSoundTime: -Infinity
};

//
// Helpers
//
const rand = (min, max) => min + Math.random() * (max - min);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const ease = (rate, f) => 1 - (1 - rate) ** f; // frame-rate independent lerp factor
const hasPowerUp = type => player.timers[type] > clock;
const isPlaying = () => gameStarted && !player.exploded;
const shipInvulnerable = () => godMode || clock - player.respawnTime < SPAWN_INVULNERABILITY;
const comboMultiplier = () => Math.min(COMBO_MAX_MULTIPLIER, 1 + Math.floor(combo / COMBO_STEP));
const accuracy = () => (shotsFired > 0 ? Math.round((bulletHits / shotsFired) * 100) : 0);
const formatTime = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Random point just outside a random edge, with a heading that points into the playfield
function edgeSpawn() {
  switch (Math.floor(Math.random() * 4)) {
    case 0:
      return { x: rand(0, W), y: -10, angle: rand(0.2, Math.PI - 0.2) };
    case 1:
      return { x: W + 10, y: rand(0, H), angle: rand(Math.PI / 2 + 0.2, Math.PI * 1.5 - 0.2) };
    case 2:
      return { x: rand(0, W), y: H + 10, angle: rand(Math.PI + 0.2, TAU - 0.2) };
    default:
      return { x: -10, y: rand(0, H), angle: rand(-Math.PI / 2 + 0.2, Math.PI / 2 - 0.2) };
  }
}

function bounceOffWalls(o, r) {
  let hit = false;
  if (o.x < r) {
    o.x = r;
    o.velX = Math.abs(o.velX);
    hit = true;
  } else if (o.x > W - r) {
    o.x = W - r;
    o.velX = -Math.abs(o.velX);
    hit = true;
  }
  if (o.y < r) {
    o.y = r;
    o.velY = Math.abs(o.velY);
    hit = true;
  } else if (o.y > H - r) {
    o.y = H - r;
    o.velY = -Math.abs(o.velY);
    hit = true;
  }
  return hit;
}

function capSpeed(o, max) {
  const speed = Math.hypot(o.velX, o.velY);
  if (speed > max) {
    o.velX *= max / speed;
    o.velY *= max / speed;
  }
}

// 0..1 visibility from an entity's spawnTime / fadeIn / lifeTime / fadeOut
function fadeLevel(o) {
  const age = clock - o.spawnTime;
  let t = o.fadeIn ? age / o.fadeIn : 1;
  if (o.lifeTime) t = Math.min(t, (o.lifeTime - age) / o.fadeOut);
  return clamp(t, 0, 1);
}

// Strokes the current path as a neon tube: soft halo, colored body, hot white core
function neon(color, width) {
  const alpha = ctx.globalAlpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width * 3;
  ctx.globalAlpha = alpha * 0.2;
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(0.75, width * 0.35);
  ctx.globalAlpha = alpha * 0.8;
  ctx.stroke();
  ctx.globalAlpha = alpha;
}

// Pre-renders an expensive drawing (glow, gradients) once so each frame is a single drawImage
function makeSprite(size, resolution, paint) {
  const s = dpr * scaleFactor * resolution;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = Math.ceil(size * s);
  const g = sprite.getContext('2d');
  g.scale(s, s);
  g.translate(size / 2, size / 2);
  paint(g, s);
  return sprite;
}

// Blends two hex colors; t = 0 gives a, t = 1 gives b
function mixHex(a, b, t) {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = sh => Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

// 4x4 ordered (Bayer) dither: fills `cell`-sized squares wherever field(x, y) beats the threshold
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
function dither(g, extent, cell, field) {
  const n = Math.ceil(extent / cell);
  for (let j = -n; j < n; j++) {
    for (let i = -n; i < n; i++) {
      const x = i * cell;
      const y = j * cell;
      if (field(x + cell / 2, y + cell / 2) > BAYER[(j & 3) * 4 + (i & 3)]) g.fillRect(x, y, cell, cell);
    }
  }
}

//
// Canvas sizing
//
function resizeCanvas() {
  scaleFactor = window.innerWidth < 768 ? 0.5 : 1;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth / scaleFactor;
  H = window.innerHeight / scaleFactor;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr * scaleFactor, 0, 0, dpr * scaleFactor, 0, 0);
}

resizeCanvas();
player.x = W / 2;
player.y = H / 2;

window.addEventListener('resize', () => {
  resizeCanvas();
  rocketSprite = null;
  asteroids.forEach(a => (a.sprite = null));
  sporeSprite = gloomrayShadow = magpieDartSprite = duskwingFlakeSprite = parhelionShardSprite = null;
  bosses.forEach(b => {
    b.sprite = null;
    if (b.shell) b.shell.sprite = null;
  });
  player.x = clamp(player.x, PLAYER_WALL_RADIUS, W - PLAYER_WALL_RADIUS);
  player.y = clamp(player.y, PLAYER_WALL_RADIUS, H - PLAYER_WALL_RADIUS);
  makeStars();
  nebulae = [];
  if (nebulaShown >= 0) showNebula(nebulaShown, true);
  draw(); // resizing clears the canvas; repaint now in case the loop is paused
});

let stars = [];
function makeStars() {
  stars = STAR_LAYERS.flatMap((layer, depth) =>
    Array.from({ length: Math.round((layer.density * W * H) / 1e6) }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      layer: depth,
      size: rand(...layer.size),
      brightness: rand(...layer.brightness),
      color: pick(STAR_TINTS),
      twinkle: depth === 2 && Math.random() < 0.4,
      twinkleSpeed: rand(0.002, 0.006)
    }))
  );
}
makeStars();

//
// Audio
//
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioContext.createGain();
masterGain.gain.value = 0.8;
masterGain.connect(audioContext.destination);
const soundBuffers = {};

// Decoding works on a suspended context, so sounds are ready before the first click
SOUND_NAMES.forEach(async name => {
  try {
    const response = await fetch(`sounds/${name}.mp3`);
    soundBuffers[name] = await audioContext.decodeAudioData(await response.arrayBuffer());
  } catch (err) {
    console.error(`Failed to load sound ${name}:`, err);
  }
});

function unlockAudio() {
  if (audioContext.state !== 'running') audioContext.resume().catch(() => {});
}

// Every play gets a slight random pitch so repeated sounds don't grate
function playSound(name, { rate = 1, volume = 1, vary = 0.08 } = {}) {
  if (!isSoundEnabled || !soundBuffers[name]) return;
  unlockAudio();
  const source = audioContext.createBufferSource();
  source.buffer = soundBuffers[name];
  source.playbackRate.value = rate * (1 + rand(-vary, vary));
  if (volume === 1) {
    source.connect(masterGain);
  } else {
    const gain = audioContext.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(masterGain);
  }
  source.start();
}

//
// Input
//
const keys = {};
const held = (...codes) => codes.some(code => keys[code]);
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

window.addEventListener('keydown', e => {
  document.documentElement.classList.add('is-using-keyboard');
  keys[e.code] = true;
  if (isPlaying() && GAME_KEYS.has(e.code)) e.preventDefault();
  // Start screen, wherever focus is: Enter launches, ↑↓ spin the ship wheel, ←→ cycle the paint (held keys
  // repeat). Taking these ahead of the radio groups' own arrow keys keeps each key meaning one thing.
  if (!gameStarted && !launchAt) {
    const spin = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 }[e.code];
    const paint = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 }[e.code];
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) {
      e.preventDefault();
      startGame();
    } else if (spin) {
      e.preventDefault();
      spinBy(spin);
    } else if (paint) {
      e.preventDefault();
      stepPaint(paint);
    } else if (e.code === 'KeyG' && !e.repeat) {
      // G: Zero G (a quiet shortcut, no hint)
      zeroGravityToggle.checked = !zeroGravityToggle.checked;
      zeroGravityToggle.dispatchEvent(new Event('change'));
    }
  }
  if (e.repeat) return;

  if (e.key === 'Shift') toggleTracer();
  typed = (typed + e.key.toLowerCase()).slice(-3);
  if (typed === 'dev' && isPlaying()) toggleTestDeck();
  if (!testDeck.hidden && /^Digit\d$/.test(e.code)) TEST_ACTIONS[(+e.code.slice(5) + 9) % 10]?.button.click();
  if (e.code === 'Backquote' && isPlaying()) asteroids.push(new Asteroid());
  if (e.code === 'KeyP' || e.code === 'Escape') setPaused(!isPaused);
});
window.addEventListener('keyup', e => (keys[e.code] = false));
window.addEventListener('mousemove', () => document.documentElement.classList.remove('is-using-keyboard'));

// Losing focus would otherwise leave keys "stuck" down
window.addEventListener('blur', () => setPaused(true));
document.addEventListener('visibilitychange', () => document.hidden && setPaused(true));
pausedDisplay.addEventListener('click', () => setPaused(false));

function setPaused(paused) {
  for (const code in keys) keys[code] = false;
  resetTouchState();
  if (paused && !isPlaying()) return;
  isPaused = paused;
  pausedDisplay.hidden = !paused;
}

//
// Dev deck: type "dev" while playing (or load the page with ?dev) for spawn buttons; keys 1–9, 0 work too
//
let typed = '';
const TEST_ACTIONS = [
  ...Object.keys(POWER_UP_SPAWN)
    .filter(type => type !== 'life')
    .map(type => ({ label: POWER_UP_LABELS[type].replace('!', ''), run: () => spawnTestPowerUp(type) })),
  { label: 'Asteroid', run: () => asteroids.push(new Asteroid()) },
  { label: 'Black hole', run: () => blackHoles.push(new BlackHole()) },
  { label: 'God mode', toggle: () => godMode, run: () => (godMode = !godMode) },
  { label: 'Boss', run: () => spawnBoss() }, // random; one button per kind follows
  { label: '1UP', run: () => spawnTestPowerUp('life') }
];

function spawnTestPowerUp(type) {
  const p = new PowerUp(type);
  const d = 140;
  Object.assign(p, {
    x: clamp(player.x + Math.cos(player.angle) * d, 40, W - 40),
    y: clamp(player.y + Math.sin(player.angle) * d, 40, H - 40),
    velX: 0,
    velY: 0,
    spawnTime: clock - p.fadeIn
  });
  powerUps.push(p);
}

function toggleTestDeck(show = testDeck.hidden) {
  testDeck.hidden = !show;
  if (testDeck.childElementCount) return;
  const bossActions = BOSS_KINDS.map(kind => ({ label: kind.label, run: () => spawnBoss(kind) }));
  [...TEST_ACTIONS, ...bossActions].forEach((action, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1; // never takes focus, so Space keeps shooting instead of re-pressing it
    button.innerHTML = `${i < 10 ? `<kbd>${(i + 1) % 10}</kbd>` : ''}${action.label}`;
    button.addEventListener('mousedown', e => e.preventDefault());
    button.addEventListener('click', () => {
      if (!isPlaying()) return; // the deck stays up on the game-over screen; nothing spawns into a dead run
      action.run();
      if (action.toggle) button.classList.toggle('on', action.toggle());
    });
    action.button = button;
    testDeck.append(button);
  });
}

function toggleTracer() {
  player.tracerEnabled = !player.tracerEnabled;
  playSound('click');
}

$('startButton').addEventListener('click', e => {
  e.preventDefault();
  if (!gameStarted) startGame();
});

restartButton.addEventListener('click', e => {
  e.preventDefault();
  // Guard against a held Space/Enter from the final moments of play instantly restarting
  if (gameOverShown && performance.now() - gameOverShownAt > 400) resetGame();
});

// Touch controls
const touchState = { directionX: 0, directionY: 0, shoot: false, touchId: null };

function isTouchingButton(x, y, button) {
  const rect = button.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function resetTouchState() {
  Object.assign(touchState, { directionX: 0, directionY: 0, shoot: false, touchId: null });
  joystick.style.transform = 'translate(0px, 0px)';
}

function updateJoystick(touch) {
  const rect = directionalControl.getBoundingClientRect();
  const dx = touch.clientX - (rect.left + rect.width / 2);
  const dy = touch.clientY - (rect.top + rect.height / 2);
  const maxDistance = (rect.width / 2 - joystick.offsetWidth / 2) * 1.5;
  const distance = Math.hypot(dx, dy);
  const visual = distance > maxDistance ? maxDistance / distance : 1;
  joystick.style.transform = `translate(${dx * visual}px, ${dy * visual}px)`;

  const magnitude = Math.min(distance / maxDistance, 1);
  touchState.directionX = distance > 0 ? (dx / distance) * magnitude : 0;
  touchState.directionY = distance > 0 ? (dy / distance) * magnitude : 0;
}

// Rebuilds stick + fire state from the full touch list on every touch event
function syncTouches(e) {
  e.preventDefault();
  let stick = null;
  let shoot = false;
  for (const t of e.touches) {
    if (t.identifier === touchState.touchId) {
      stick = t;
    } else if (
      touchState.touchId === null &&
      e.type === 'touchstart' &&
      isTouchingButton(t.clientX, t.clientY, directionalControl)
    ) {
      touchState.touchId = t.identifier;
      stick = t;
    }
    if (isTouchingButton(t.clientX, t.clientY, shootButton)) shoot = true;
  }
  touchState.shoot = shoot;
  if (stick) {
    updateJoystick(stick);
  } else {
    const fire = touchState.shoot;
    resetTouchState();
    touchState.shoot = fire;
  }
}

for (const el of [directionalControl, shootButton]) {
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) el.addEventListener(type, syncTouches);
}

// Tap the rocket to toggle the aiming tracer
document.addEventListener(
  'touchstart',
  e => {
    if (!isPlaying() || isPaused) return;
    const rect = canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      if (
        isTouchingButton(t.clientX, t.clientY, directionalControl) ||
        isTouchingButton(t.clientX, t.clientY, shootButton)
      ) {
        continue;
      }
      const x = (t.clientX - rect.left) / scaleFactor;
      const y = (t.clientY - rect.top) / scaleFactor;
      if (Math.hypot(x - player.x, y - player.y) < Math.max(30, 22 / scaleFactor)) {
        e.preventDefault();
        toggleTracer();
        break;
      }
    }
  },
  { passive: false }
);

//
// Particles
//
function addParticle(p) {
  particles.push({ vx: 0, vy: 0, drag: 0.94, size: 2, kind: 'dot', width: 3, ...p, maxLife: p.life });
}

function updateParticles(f) {
  particles = particles.filter(p => {
    p.x += p.vx * f;
    p.y += p.vy * f;
    const drag = p.drag ** f;
    p.vx *= drag;
    p.vy *= drag;
    p.life -= f;
    return p.life > 0;
  });
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const p of particles) {
    const t = p.life / p.maxLife; // 1 → 0 over its life
    ctx.globalAlpha = t;
    ctx.beginPath();
    if (p.kind === 'spark') {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.stroke();
    } else if (p.kind === 'ring') {
      ctx.arc(p.x, p.y, p.size * (1 - t * t) + 2, 0, TAU);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width * t;
      ctx.stroke();
    } else {
      ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, TAU);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
  }
  ctx.restore();
}

function explode(x, y, color, size, { sparks = 14, ring = true } = {}) {
  const power = 0.6 + size / ASTEROID_MAX_SIZE;
  addParticle({ x, y, life: 10, size: size * 0.9, color: '#ffffff', drag: 1 });
  if (ring) addParticle({ kind: 'ring', x, y, life: 22, size: size * 2.2, color, drag: 1 });
  for (let i = 0; i < sparks; i++) {
    const a = rand(0, TAU);
    const speed = rand(2, 8) * power;
    addParticle({
      kind: 'spark',
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: rand(18, 40),
      size: rand(1.5, 3),
      color: Math.random() < 0.3 ? '#ffffff' : color,
      drag: 0.92
    });
  }
  for (let i = 0; i < sparks / 2; i++) {
    const a = rand(0, TAU);
    const speed = rand(0.5, 2.5) * power;
    addParticle({
      x: x + Math.cos(a) * size * 0.4,
      y: y + Math.sin(a) * size * 0.4,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: rand(40, 75),
      size: rand(1.5, 3.5),
      color,
      drag: 0.97
    });
  }
}

function addShake(amount) {
  if (!REDUCED_MOTION) shake = Math.min(20, Math.max(shake, amount));
}

function addHitstop(ms) {
  hitstop = Math.min(90, Math.max(hitstop, ms));
}

//
// Entities
//
class Bullet {
  constructor(x, y, angle, counted, speed = BULLET_SPEED) {
    this.x = x;
    this.y = y;
    this.velX = Math.cos(angle) * speed;
    this.velY = Math.sin(angle) * speed;
    this.turn = 0; // total radians gravity has steered this bullet
    this.size = 4;
    this.born = clock;
    this.counted = counted; // spread-shot side bullets don't count toward accuracy, and their misses don't break combos
    this.hit = false; // a normal bullet dies on its first hit
    this.scored = false; // hit something (a lance keeps flying after)
    this.prevX = x;
    this.prevY = y;
    this.bounces = hasPowerUp('ricochet') ? RICOCHET_BOUNCES : 0;
    this.banked = false;
    this.lance = hasPowerUp('lance');
    this.struck = this.lance ? new Set() : null; // asteroids (and their fresh fragments) a lance already went through
  }

  // Ricochet: reflect off the screen edge instead of leaving
  bounce() {
    const outX = this.x < 0 || this.x > W;
    const outY = this.y < 0 || this.y > H;
    if (!this.bounces || !(outX || outY)) return;
    if (outX) this.velX *= -1;
    if (outY) this.velY *= -1;
    this.x = clamp(this.x, 0, W);
    this.y = clamp(this.y, 0, H);
    this.bounces--;
    this.banked = true;
    const color = POWER_UP_COLORS.ricochet;
    addParticle({ kind: 'ring', x: this.x, y: this.y, life: 12, size: 16, color, drag: 1 });
    for (let i = 0; i < 3; i++) {
      const a = Math.atan2(this.velY, this.velX) + rand(-0.8, 0.8);
      addParticle({ kind: 'spark', x: this.x, y: this.y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, life: 10, size: 1.5, color, drag: 0.85 });
    }
    playSound('bump', { rate: 1.7, volume: 0.35 });
  }

  move(f) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.velX * f;
    this.y += this.velY * f;
  }

  // Swept test over this frame's path so fast/bent bullets can't skip past small asteroids
  hits(a) {
    const dx = this.x - this.prevX;
    const dy = this.y - this.prevY;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? clamp(((a.x - this.prevX) * dx + (a.y - this.prevY) * dy) / lengthSq, 0, 1) : 0;
    return Math.hypot(a.x - (this.prevX + dx * t), a.y - (this.prevY + dy * t)) < a.hitRadius + this.size;
  }

  // Gravity bends bullets like light: it turns them toward (dx, dy) without changing their speed, so a
  // bullet can whip around a black hole but never gets stuck buzzing in orbit
  steer(dx, dy, distance, pull, f) {
    const speedSq = this.velX ** 2 + this.velY ** 2;
    const turn = ((pull * (this.velX * dy - this.velY * dx)) / (distance * speedSq)) * f;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    [this.velX, this.velY] = [this.velX * c - this.velY * s, this.velX * s + this.velY * c];
    this.turn += Math.abs(turn);
  }

  get trick() {
    return this.banked || this.turn > TRICK_SHOT_ANGLE;
  }
}

function drawBullets() {
  if (!bullets.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of bullets) {
    const tail = b.lance ? 1.6 : 0.9;
    ctx.beginPath();
    ctx.moveTo(b.x - b.velX * tail, b.y - b.velY * tail);
    ctx.lineTo(b.x, b.y);
    if (b.lance) neon(POWER_UP_COLORS.lance, 4);
    else neon(b.trick ? POWER_UP_COLORS.ricochet : BULLET_COLOR, 3); // lights up once it qualifies as a trick shot
  }
  ctx.restore();
}

class Asteroid {
  // No options = a fresh asteroid drifting in from an edge; with x/y/size/etc = a fragment of a split
  constructor(opts = {}) {
    const fragment = opts.x !== undefined;
    if (fragment) {
      Object.assign(this, { x: opts.x, y: opts.y, velX: opts.velX, velY: opts.velY });
    } else {
      const spawn = edgeSpawn();
      const speed = rand(0.9, 2.7) * difficultySpeed();
      Object.assign(this, {
        x: spawn.x,
        y: spawn.y,
        velX: Math.cos(spawn.angle) * speed,
        velY: Math.sin(spawn.angle) * speed
      });
    }
    this.size = opts.size ?? rand(ASTEROID_MIN_SIZE, ASTEROID_MAX_SIZE);
    this.color = opts.color ?? pick(ASTEROID_COLORS);
    this.family = opts.family ?? {}; // identity shared by an asteroid and all its fragments
    this.hitRadius = this.size * 0.95;
    this.rotationAngle = rand(0, TAU);
    this.rotationSpeed = rand(-0.01, 0.01) * (fragment ? 3 : 1);
    this.spawnTime = clock;
    this.gracePeriod = fragment ? 250 : 1000;
    this.fadeIn = fragment ? 0 : 1000;
    this.opacity = fragment ? 1 : 0;
    this.dead = false;
    this.sprite = null;
    this.spriteSize = this.size * 2.6 + 36;

    const sizeFraction = clamp((ASTEROID_MAX_SIZE - this.size) / (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE), 0, 1);
    const rawPoints = ASTEROID_POINTS_MIN + sizeFraction * (ASTEROID_POINTS_MAX - ASTEROID_POINTS_MIN);
    this.pointsValue = Math.round(rawPoints / ASTEROID_POINTS_STEP) * ASTEROID_POINTS_STEP;

    const size = this.size;
    const vertexCount = size < 30 ? 9 : 11;
    this.points = Array.from({ length: vertexCount }, (_, i) => {
      const a = ((i + rand(-0.3, 0.3)) / vertexCount) * TAU;
      const r = size * rand(0.82, 1.12); // mean ≈ 0.97, hugs hitRadius
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, light: rand(0, 1) };
    });
    this.apex = { x: rand(-0.15, 0.15) * size, y: rand(-0.15, 0.15) * size };

    // Glowing geode pockets: one big one near the middle, a smaller one on bigger rocks. They never overlap
    // (overlapping pockets read as eyes).
    this.craters = [];
    for (let tries = 0; this.craters.length < (size < 30 ? 1 : 2) && tries < 30; tries++) {
      const first = !this.craters.length;
      const a = rand(0, TAU);
      const d = (first ? rand(0, 0.2) : rand(0.4, 0.55)) * size;
      const c = { x: Math.cos(a) * d, y: Math.sin(a) * d, r: (first ? rand(0.2, 0.25) : rand(0.12, 0.16)) * size };
      if (this.craters.every(o => Math.hypot(o.x - c.x, o.y - c.y) > o.r + c.r + size * 0.12)) this.craters.push(c);
    }

    // Big rocks get mineral veins cracking out from the main pocket
    const main = this.craters[0];
    this.veins =
      size < 34
        ? []
        : Array.from({ length: 2 }, () => {
            let a = Math.atan2(main.y, main.x) + rand(-1.6, 1.6);
            let x = main.x + Math.cos(a) * main.r;
            let y = main.y + Math.sin(a) * main.r;
            const pts = [{ x, y }];
            for (let k = 0; k < 4; k++) {
              a += rand(-0.7, 0.7);
              x += Math.cos(a) * size * 0.22;
              y += Math.sin(a) * size * 0.22;
              pts.push({ x, y });
            }
            return pts;
          });
  }

  move(f) {
    this.x += this.velX * f;
    this.y += this.velY * f;
    bounceOffWalls(this, this.hitRadius);

    capSpeed(this, ASTEROID_MAX_SPEED);
    this.rotationAngle += this.rotationSpeed * f;
    this.opacity = fadeLevel(this);
  }

  // Dark crystal geode lit from inside. All shading is radial or per-facet (no light direction), so the
  // sprite looks right at any rotation.
  paint(g, s) {
    const { points: P, size: R, color: C, apex } = this;
    const fine = scaleFactor < 1 ? 1.5 : 1; // detail lines survive the phone's zoomed-out world
    const inset = P.map(p => ({ x: apex.x + (p.x - apex.x) * 0.55, y: apex.y + (p.y - apex.y) * 0.55 }));
    const poly = pts => {
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath();
    };
    g.lineJoin = 'round';

    // Dark body with a colored aura (kept tight and translucent: the rim and pockets carry the neon)
    poly(P);
    g.shadowColor = hexToRgba(C, 0.55);
    g.shadowBlur = 8 * s;
    g.fillStyle = mixHex(C, SPACE_INK, 0.82);
    g.fill();
    g.shadowBlur = 0;

    // Bevel facets around a darker crown
    for (let i = 0; i < P.length; i++) {
      const j = (i + 1) % P.length;
      poly([P[i], P[j], inset[j], inset[i]]);
      g.fillStyle = mixHex(C, SPACE_INK, 0.88 - P[i].light * 0.32);
      g.fill();
      g.strokeStyle = hexToRgba(C, 0.16 + P[i].light * 0.22);
      g.lineWidth = 0.75 * fine;
      g.stroke();
    }
    poly(inset);
    g.fillStyle = mixHex(C, SPACE_INK, 0.76);
    g.fill();

    g.save();
    poly(P);
    g.clip();

    // Ordered-dither glow bleeding out of the pockets and veins: the retro nod, baked so it rotates cleanly
    const segs = this.veins.flatMap(v => v.slice(1).map((q, i) => [v[i], q]));
    const segDist = (x, y, [p, q]) => {
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const t = clamp(((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(x - p.x - t * dx, y - p.y - t * dy);
    };
    g.fillStyle = hexToRgba(C, 0.45);
    dither(g, R * 1.2, scaleFactor < 1 ? 4 : 2.5, (x, y) => {
      let v = 0;
      for (const c of this.craters) v = Math.max(v, 1.1 - Math.hypot(x - c.x, y - c.y) / (c.r * 2.2));
      for (const sg of segs) v = Math.max(v, 0.55 - segDist(x, y, sg) / (R * 0.14));
      return v;
    });

    g.lineCap = 'round';
    for (const v of this.veins) {
      g.beginPath();
      v.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.strokeStyle = C;
      g.shadowColor = C;
      g.shadowBlur = 4 * s;
      g.lineWidth = 1.6 * fine;
      g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      g.lineWidth = 0.6 * fine;
      g.stroke();
    }

    // Pockets: dark pit, light-emitting core, lit lip. Foreshortened into ellipses toward the edge so the
    // rock reads as round.
    for (const c of this.craters) {
      const d = Math.hypot(c.x, c.y);
      g.save();
      g.translate(c.x, c.y);
      g.rotate(Math.atan2(c.y, c.x));
      g.scale(Math.max(0.55, Math.sqrt(1 - (d / (R * 0.85)) ** 2)), 1);
      g.beginPath();
      g.arc(0, 0, c.r, 0, TAU);
      g.fillStyle = '#05010a';
      g.fill();
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, c.r);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.3, C);
      glow.addColorStop(0.75, hexToRgba(C, 0.15));
      glow.addColorStop(1, hexToRgba(C, 0));
      g.fillStyle = glow;
      g.fill();
      g.lineWidth = fine;
      g.strokeStyle = hexToRgba(C, 0.4);
      g.stroke();
      g.beginPath();
      g.arc(0, 0, c.r, -1.3, 1.3); // brighter outer lip
      g.strokeStyle = mixHex(C, '#ffffff', 0.55);
      g.stroke();
      g.restore();
    }
    g.restore();

    // Hot rim
    poly(P);
    g.strokeStyle = mixHex(C, '#ffffff', 0.3);
    g.lineWidth = 1.75;
    g.stroke();
    g.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    g.lineWidth = 0.6;
    g.stroke();
  }

  draw() {
    if (this.opacity <= 0) return;
    if (!this.sprite) this.sprite = makeSprite(this.spriteSize, 1, (g, s) => this.paint(g, s));
    const half = this.spriteSize / 2;
    ctx.save();
    ctx.translate(this.x, this.y);
    // Spawn-in: a damped spring (overshoots ~9%, settles by the end of the fade), fast ease-out alpha, and
    // a tumble that unwinds into the rock's own spin
    const t = this.opacity;
    const scale = t >= 1 ? 1 : 1 - Math.exp(-7 * t) * Math.cos(9 * t);
    ctx.rotate(this.rotationAngle + Math.sign(this.rotationSpeed) * 1.4 * (1 - t) ** 3);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 1 - (1 - t) ** 3;
    ctx.drawImage(this.sprite, -half, -half, this.spriteSize, this.spriteSize);
    ctx.restore();
  }

  canCollide() {
    return clock - this.spawnTime >= this.gracePeriod;
  }
}

class PowerUp {
  constructor(type) {
    const spawn = edgeSpawn();
    const speed = rand(0.9, 2.7);
    this.type = type;
    this.x = spawn.x;
    this.y = spawn.y;
    this.velX = Math.cos(spawn.angle) * speed;
    this.velY = Math.sin(spawn.angle) * speed;
    this.size = 30;
    this.hitRadius = 34;
    this.rotationAngle = 0;
    this.rotationSpeed = rand(-1, 1) * (type === 'star' ? 0.025 : 0.01);
    this.pulsePhase = rand(0, TAU);
    this.spawnTime = clock;
    this.fadeIn = 1000;
    this.lifeTime = 10000;
    this.fadeOut = 1000;
    this.opacity = 0;
    this.dead = false;
  }

  move(f) {
    this.x += this.velX * f;
    this.y += this.velY * f;
    bounceOffWalls(this, this.hitRadius);
    capSpeed(this, ASTEROID_MAX_SPEED); // black holes can otherwise fling power-ups at absurd speeds
    this.rotationAngle += this.rotationSpeed * f;
    this.opacity = fadeLevel(this);
    if (clock - this.spawnTime > this.lifeTime) this.dead = true;
  }

  draw() {
    if (this.opacity <= 0) return;
    const r = this.size;
    const color = POWER_UP_COLORS[this.type];
    const pulse = 1 + Math.sin(clock * 0.01 + this.pulsePhase) * 0.06;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotationAngle);
    ctx.scale(pulse * this.opacity, pulse * this.opacity);
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (this.type === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? r * 0.45 : r;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.3 + 0.2 * Math.sin(clock * 0.02 + this.pulsePhase));
      ctx.fill();
      neon(color, 2.5);
    } else if (this.type === 'shield') {
      // The bubble ring turns; the heater shield inside stays upright
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.setLineDash([10, 8]);
      neon(color, 2);
      ctx.setLineDash([]);
      ctx.rotate(-this.rotationAngle);
      const w = r * 0.56;
      ctx.beginPath();
      ctx.moveTo(-w, -w * 0.85);
      ctx.quadraticCurveTo(0, -w * 0.62, w, -w * 0.85); // shoulders
      ctx.bezierCurveTo(w, w * 0.05, w * 0.62, w * 0.7, 0, w * 1.08); // down to the point
      ctx.bezierCurveTo(-w * 0.62, w * 0.7, -w, w * 0.05, -w, -w * 0.85);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.16);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = hexToRgba(color, 0.45); // heraldic split: one half lit
      ctx.fillRect(-w * 1.2, -w * 1.2, w * 1.2, w * 2.4);
      ctx.restore();
      neon(color, 2);
    } else if (this.type === 'life') {
      // Your own ship, nose up, with a 1UP badge and a spark circling the ring
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      neon(color, 2);
      const a = clock * 0.004;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2.5, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.rotate(-this.rotationAngle);
      ctx.globalCompositeOperation = 'source-over';
      const size = ROCKET_SPRITE_SIZE * 0.8;
      ctx.drawImage(getRocketSprite(), -size / 2, -size / 2 - 5, size, size);
      ctx.beginPath();
      ctx.roundRect(-14, r * 0.42, 28, 13, 6.5);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.font = '900 9px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = SPACE_INK;
      ctx.fillText('1UP', 0, r * 0.42 + 7);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      neon(color, 2);
      ctx.beginPath();
      if (this.type === 'spread') {
        for (const a of [-0.55, 0, 0.55]) {
          ctx.moveTo(0, r * 0.4);
          ctx.lineTo(Math.sin(a) * r * 0.6, r * 0.4 - Math.cos(a) * r * 0.85);
        }
      } else if (this.type === 'ricochet') {
        // Zig-zag arrow
        ctx.moveTo(-r * 0.55, r * 0.35);
        ctx.lineTo(-r * 0.2, -r * 0.35);
        ctx.lineTo(r * 0.15, r * 0.3);
        ctx.lineTo(r * 0.5, -r * 0.4);
        ctx.moveTo(r * 0.22, -r * 0.38);
        ctx.lineTo(r * 0.5, -r * 0.4);
        ctx.lineTo(r * 0.52, -r * 0.12);
      } else if (this.type === 'lance') {
        // Arrow skewering a rock
        ctx.moveTo(-r * 0.6, r * 0.6);
        ctx.lineTo(r * 0.6, -r * 0.6);
        ctx.moveTo(r * 0.25, -r * 0.6);
        ctx.lineTo(r * 0.6, -r * 0.6);
        ctx.lineTo(r * 0.6, -r * 0.25);
        ctx.moveTo(r * 0.24, 0);
        ctx.arc(0, 0, r * 0.24, 0, TAU);
      } else {
        // Spiral
        for (let t = 0; t <= 3 * Math.PI; t += 0.2) {
          const rr = r * (0.08 + (t / (3 * Math.PI)) * 0.58);
          ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr);
        }
      }
      neon(color, 2);
    }
    ctx.restore();
  }
}

class BlackHole {
  constructor() {
    let spawn;
    let tries = 0;
    do {
      spawn = edgeSpawn();
      tries++;
    } while (Math.hypot(spawn.x - player.x, spawn.y - player.y) < BLACK_HOLE_MIN_SPAWN_DISTANCE && tries < 10);
    const speed = rand(0.45, 1.35);
    this.x = spawn.x;
    this.y = spawn.y;
    this.velX = Math.cos(spawn.angle) * speed;
    this.velY = Math.sin(spawn.angle) * speed;
    this.radius = BLACK_HOLE_SIZE * 1.2;
    this.gravityRadius = this.radius * 3;
    this.rotationAngle = 0;
    this.spawnTime = clock;
    this.gracePeriod = 3000;
    this.fadeIn = 1000;
    this.lifeTime = rand(BLACK_HOLE_DURATION_MIN, BLACK_HOLE_DURATION_MAX);
    this.fadeOut = 1000;
    this.opacity = 0;
    this.dead = false;
    this.motes = Array.from({ length: 70 }, () => this.newMote(true));
  }

  newMote(anywhere) {
    const outer = this.gravityRadius * 0.6;
    return {
      a: rand(0, TAU),
      r: anywhere ? rand(BLACK_HOLE_CORE_DRAW, outer) : rand(outer * 0.7, outer),
      speed: rand(0.6, 1.4),
      color: pick(['#ff6a00', '#ffb347', '#ff3d00', '#ffe0a0'])
    };
  }

  move(f) {
    this.x += this.velX * f;
    this.y += this.velY * f;
    bounceOffWalls(this, this.radius);
    this.rotationAngle += BLACK_HOLE_ROTATION_SPEED * f;

    // Accretion motes spiral inward, faster as they near the core
    for (const m of this.motes) {
      m.r -= (0.4 + 60 / m.r) * m.speed * f;
      m.a += (0.3 / Math.sqrt(m.r)) * m.speed * f;
      if (m.r < BLACK_HOLE_CORE_DRAW) Object.assign(m, this.newMote(false));
    }

    this.opacity = fadeLevel(this);
    if (clock - this.spawnTime > this.lifeTime) {
      this.dead = true;
      scheduleBlackHole();
    }
  }

  draw() {
    const s = this.opacity;
    if (s <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = s;

    // Warm haze that telegraphs how far the pull reaches
    const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, this.gravityRadius);
    haze.addColorStop(0, 'rgba(255, 80, 0, 0.16)');
    haze.addColorStop(0.5, 'rgba(255, 60, 0, 0.05)');
    haze.addColorStop(1, 'rgba(255, 60, 0, 0)');
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.arc(0, 0, this.gravityRadius, 0, TAU);
    ctx.fill();

    ctx.scale(s, s);
    ctx.globalCompositeOperation = 'lighter';
    const outer = this.gravityRadius * 0.6;
    for (const m of this.motes) {
      ctx.globalAlpha = s * clamp((1 - m.r / outer) * 1.3, 0.1, 1);
      ctx.fillStyle = m.color;
      ctx.fillRect(Math.cos(m.a) * m.r - 1, Math.sin(m.a) * m.r - 1, 2, 2);
    }

    const pulse = (Math.sin((clock * TAU) / 2000) + 1) / 2;
    const color = `rgb(255, ${Math.round(165 * (1 - pulse))}, 0)`;
    ctx.globalAlpha = s * 0.75;
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let r = BLACK_HOLE_CORE_DRAW; r <= this.radius; r += 3) {
        const a = this.rotationAngle + (arm * TAU) / 3 - r * 0.035;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      neon(color, 2.5);
    }

    // Event horizon
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = s;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, BLACK_HOLE_CORE_DRAW * 1.8);
    core.addColorStop(0, '#000');
    core.addColorStop(0.55, '#000');
    core.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, BLACK_HOLE_CORE_DRAW * 1.8, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(0, 0, BLACK_HOLE_CORE_DRAW, 0, TAU);
    neon(color, 2);
    ctx.restore();
  }

  canCollide() {
    return clock - this.spawnTime >= this.gracePeriod;
  }

  applyGravity(obj, f) {
    const dx = this.x - obj.x;
    const dy = this.y - obj.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= this.gravityRadius || distance === 0) return;

    const zeroG = zeroGravityToggle.checked ? 0.2 : 1;
    if (obj instanceof Bullet) {
      const h = BULLET_BEND * (1 - distance / this.gravityRadius) * zeroG * this.opacity; // fades to 0 at the edge
      obj.steer(dx, dy, distance, (h * BULLET_SPEED ** 2) / distance, f);
      return;
    }
    const heft = obj === player ? ship.gravity : 1; // some hulls shrug gravity off
    const force = ((BLACK_HOLE_GRAVITY_STRENGTH * zeroG * heft * 100) / distance) * this.opacity * f;
    obj.velX += (dx / distance) * force;
    obj.velY += (dy / distance) * force;
  }
}

class PointText {
  constructor(x, y, text, color = '#ffffff', fontSize = 16) {
    this.x = x + rand(-12, 12); // jitter so simultaneous kills don't stack illegibly
    this.y = y + rand(-6, 6);
    // Keep popups out from under the corner HUD (HUD is sized in CSS px; the world is CSS px / scaleFactor)
    const underHud = this.x < 340 / scaleFactor || this.x > W - 260 / scaleFactor;
    if (underHud) this.y = Math.max(this.y, 150 / scaleFactor);
    this.text = text;
    this.color = color;
    this.fontSize = fontSize;
    this.life = 60;
  }

  update(f) {
    this.y -= 0.8 * f;
    this.life -= f;
  }

  draw() {
    const pop = 1 + Math.max(0, (this.life - 52) / 8) * 0.5; // quick scale-in punch
    ctx.save();
    ctx.globalAlpha = Math.min(1, (this.life / 60) * 2);
    ctx.font = `700 ${this.fontSize * pop}px 'Orbitron', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Halo via a soft stroke: per-frame shadowBlur stalls Safari and some GPUs
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = hexToRgba(this.color, 0.3);
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

//
// Game rules
//
//
// Bosses: big visitors that drop in now and then. A kind is a class extending Boss, listed in BOSS_KINDS.
//
class Boss {
  // Each kind sets these statics:
  // - label, tier ('easy' | 'medium' | 'hard'; a run's first boss is always easy)
  // - colors (sparks and death; [0] is the identity color), points
  // - hitRadius (vs bullets), bodyRadius (vs the ship; 0 = harmless to touch)
  // - hp ([base, +per appearance, max]), ramDamage (vs a shielded ship)
  static ramDamage = 4;

  constructor(n) {
    this.n = n; // appearance number of this kind this run: kinds scale their stats with it
    this.x = this.y = this.velX = this.velY = this.angle = 0;
    this.hp = this.maxHp = scaled(this.kind.hp, n);
    this.state = 'enter';
    this.stateTime = clock;
    this.hurt = 0;
    this.lastRam = -Infinity;
    this.sprite = null;
    this.dead = false;
  }

  get kind() {
    return this.constructor;
  }

  get vulnerable() {
    return this.state !== 'enter' && !this.dead;
  }

  setState(state) {
    this.state = state;
    this.stateTime = clock;
  }

  // Winding up an attack (telegraph showing or locked on). Only one boss may do that at a time, so a duo
  // never stacks two lock-on windows: check mayTelegraph() before starting one.
  get telegraphing() {
    return false;
  }

  mayTelegraph() {
    return !bosses.some(o => o !== this && !o.dead && o.telegraphing);
  }

  // Does this bullet hit it? Override for odd shapes, armor or weak points.
  hitBy(b) {
    return b.hits({ x: this.x, y: this.y, hitRadius: this.kind.hitRadius });
  }

  // Is a circle at x,y (the ship or its shield) touching the body?
  touches(x, y, r) {
    return this.kind.bodyRadius > 0 && Math.hypot(x - this.x, y - this.y) < r + this.kind.bodyRadius;
  }

  // Hooks: onHit returns the damage actually taken (double it on a weak spot, 0 to shrug the hit off);
  // afterHit runs when it survives.
  onHit(damage) {
    return damage;
  }

  afterHit() {}

  hit(damage, info = {}) {
    if (!this.vulnerable || !isPlaying()) return; // nothing scores after the ship is gone
    const { x = this.x, y = this.y, trick = false } = info;
    damage = this.onHit(damage, { ...info, x, y, trick });
    if (damage <= 0) return;
    this.hp -= damage;
    this.hurt = 1;
    addCombo();
    const colors = this.kind.colors;
    for (let i = 0; i < 5; i++) {
      const a = rand(0, TAU);
      const v = rand(1.5, 4);
      addParticle({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(10, 20), size: 1.5, color: colors[i % colors.length], drag: 0.9 });
    }
    if (this.hp <= 0) return this.die(trick);
    playSound('bump', { rate: 1.3, volume: 0.6 });
    addShake(2);
    this.afterHit({ ...info, x, y, trick });
  }

  die(trick) {
    this.dead = true;
    hits++;
    const multiplier = comboMultiplier() * (trick ? TRICK_SHOT_MULTIPLIER : 1);
    const points = this.kind.points * multiplier;
    const [main, ...rest] = this.kind.colors;
    score += points;
    updateHighScore();
    pointTexts.push(new PointText(this.x, this.y, `+${points}${multiplier > 1 ? ` ×${multiplier}` : ''}`, main, 26));
    pointTexts.push(new PointText(this.x, this.y - 30, `${this.kind.label.toUpperCase()} DOWN!`, rest[0] ?? main, 20));
    explode(this.x, this.y, main, 60, { sparks: 24 });
    rest.forEach((color, i) => explode(this.x, this.y, color, 45 - i * 15, { sparks: 16 - i * 4, ring: i === 0 }));
    enemyShots.forEach(s => s.owner === this && s.pop());
    addHitstop(90);
    slowMo = 700;
    flash = 0.6;
    addShake(16);
    playSound('supernova', { rate: 0.6 });
    playSound('asteroid-explode', { rate: 0.5 });
    this.onDeath();
    this.dropLoot();
  }

  onDeath() {}

  // Guaranteed power-up (never a supernova), left drifting where it died. Override to pay out differently.
  dropLoot(type = pick(Object.keys(POWER_UP_DURATION))) {
    const p = new PowerUp(type);
    Object.assign(p, { x: clamp(this.x, 50, W - 50), y: clamp(this.y, 50, H - 50), velX: rand(-0.5, 0.5), velY: rand(-0.5, 0.5), spawnTime: clock - p.fadeIn });
    powerUps.push(p);
  }

  // Gone without a fight (it left the screen)
  leave() {
    this.dead = true;
  }

  isOffScreen(margin = 120) {
    return this.x < -margin || this.x > W + margin || this.y < -margin || this.y > H + margin;
  }

  // Shield ram: a shielded ship bounces off and does damage
  rammed(dx, dy, d) {
    if (clock - this.lastRam <= 500) return;
    this.lastRam = clock;
    this.hit(this.kind.ramDamage);
    player.velX = (dx / d) * 6;
    player.velY = (dy / d) * 6;
  }

  update() {}
  drawBehind() {} // under everything else (entrance shadows, telegraphs on the floor)
  draw() {}
}

// A boss projectile. The shared loop in updateBosses handles black holes (bend it, may swallow it: "baited"),
// asteroids (absorb it unless passesRocks), the shield (pops it), and the ship (kills it).
class EnemyShot {
  constructor(owner, x, y, angle, speed, { radius = 6, color = '#ffffff', lifetime = 4500, points = 0, maxSpeed = 7 } = {}) {
    Object.assign(this, { owner, x, y, color, lifetime, points, maxSpeed });
    this.velX = Math.cos(angle) * speed;
    this.velY = Math.sin(angle) * speed;
    this.hitRadius = radius;
    this.born = clock;
    this.dead = false;
    this.passesRocks = false;
    this.baitable = true;
  }

  get age() {
    return clock - this.born;
  }

  get fade() {
    return clamp((this.lifetime - this.age) / 400, 0, 1);
  }

  move(f) {
    capSpeed(this, this.maxSpeed); // black holes may bend them, not fling them
    this.x += this.velX * f;
    this.y += this.velY * f;
    if (this.age > this.lifetime || this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) this.dead = true;
  }

  pop(color = this.color) {
    this.dead = true;
    addParticle({ kind: 'ring', x: this.x, y: this.y, life: 12, size: this.hitRadius * 2.3, color, drag: 1 });
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU);
      addParticle({ kind: 'spark', x: this.x, y: this.y, vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5, life: 12, size: 1.5, color, drag: 0.88 });
    }
  }

  draw() {}
}

const BOSS_WAVE_EVERY = 3; // waves 3, 6, 9…: a boss arrives (with a few rocks for cover) instead of a full wave
const DUO_SCORE = 25000; // from this score (or the DUO_ENCOUNTER-th boss) a second boss may join
const DUO_ENCOUNTER = 4;
const DUO_CHANCE = [0.3, 0.6]; // at DUO_SCORE, and the cap it rises to (+10% per 10k points)
const DUO_DELAY = 6000; // the second one arrives this long after the first
const MAX_BOSSES = 2;

//
// Gloomray
//
const cubic = (p0, c1, c2, p3, t) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p3;
};
// Right wing's leading edge is the cubic (15,-21) (30,-22) (44,-12) (50,10); trailing edge (50,10) (36,3) (24,8) (14,19)
const leadingEdge = t => ({ x: cubic(15, 30, 44, 50, t), y: cubic(-21, -22, -12, 10, t) });
const trailingEdge = t => ({ x: cubic(50, 36, 24, 14, t), y: cubic(10, 3, 8, 19, t) });
const GLOOMRAY_PHOTOPHORES = [0.12, 0.28, 0.44, 0.6, 0.76, 0.9].map(t => {
  const p = leadingEdge(t);
  return { x: p.x * 0.87, y: p.y * 0.87 + 2, r: 1.8 - t * 0.9, t };
});

function gloomrayPath(g) {
  g.beginPath();
  g.moveTo(0, -19);
  g.quadraticCurveTo(4, -19.5, 7, -23); // mouth to horn root
  g.bezierCurveTo(8, -28, 9, -33, 12, -34); // cephalic horn, curling forward
  g.bezierCurveTo(14, -31, 15, -26, 15, -21);
  g.bezierCurveTo(30, -22, 44, -12, 50, 10); // leading edge, bowed, to a swept wingtip
  g.bezierCurveTo(36, 3, 24, 8, 14, 19); // trailing edge, concave
  g.bezierCurveTo(10, 22, 6, 25, 3, 29);
  g.lineTo(-3, 29);
  g.bezierCurveTo(-6, 25, -10, 22, -14, 19);
  g.bezierCurveTo(-24, 8, -36, 3, -50, 10);
  g.bezierCurveTo(-44, -12, -30, -22, -15, -21);
  g.bezierCurveTo(-15, -26, -14, -31, -12, -34);
  g.bezierCurveTo(-9, -33, -8, -28, -7, -23);
  g.quadraticCurveTo(-4, -19.5, 0, -19);
  g.closePath();
}

// Translucent void manta: ink membrane that brightens toward its thin edges, cartilage rays, a dithered
// spine, photophores on the leading edges and an iridescent cyan-to-violet rim.
function paintGloomray(g, s) {
  const fine = scaleFactor < 1 ? 1.5 : 1;
  g.lineJoin = g.lineCap = 'round';

  gloomrayPath(g);
  g.shadowColor = GLOOMRAY_RIM;
  g.shadowBlur = 16 * s;
  g.fillStyle = GLOOMRAY_INK;
  g.fill();
  g.shadowBlur = 0;
  const body = g.createRadialGradient(0, 0, 0, 0, 0, 46);
  body.addColorStop(0, '#2c1366');
  body.addColorStop(0.4, '#180840');
  body.addColorStop(1, GLOOMRAY_INK);
  g.fillStyle = body;
  g.fill();

  g.save();
  gloomrayPath(g);
  g.clip();

  // Fresnel: the membrane glows where it's thinnest, at every edge
  gloomrayPath(g);
  g.strokeStyle = hexToRgba(GLOOMRAY_RIM, 0.08);
  g.lineWidth = 16;
  g.stroke();
  g.strokeStyle = hexToRgba(GLOOMRAY_RIM, 0.16);
  g.lineWidth = 7;
  g.stroke();

  // Cartilage rays fanning from the body into each wing
  g.strokeStyle = hexToRgba(GLOOMRAY_VIOLET, 0.5);
  g.lineWidth = 0.8 * fine;
  const ends = [0.3, 0.5, 0.7, 0.88].map(leadingEdge).concat([0.2, 0.42, 0.66].map(trailingEdge));
  for (const side of [-1, 1]) {
    ends.forEach((e, i) => {
      const y0 = -9 + i * 3;
      g.beginPath();
      g.moveTo(side * 8, y0);
      g.quadraticCurveTo(side * (8 + e.x) * 0.5, (y0 + e.y) / 2 + 4, side * e.x * 1.05, e.y * 1.05);
      g.stroke();
    });
  }

  // Ordered-dither bioluminescence: a spine stripe and two shoulder patches (the retro nod the geodes share)
  g.fillStyle = hexToRgba(GLOOMRAY_RIM, 0.4);
  dither(g, 40, scaleFactor < 1 ? 4 : 2, (x, y) => 0.9 - Math.abs(x) / (5 - y * 0.08) - Math.abs(y - 4) / 26);

  // Heart cavity: the live heartbeat glows in here
  const pit = g.createRadialGradient(0, 3, 0, 0, 3, 9);
  pit.addColorStop(0, '#04010b');
  pit.addColorStop(0.6, 'rgba(4, 1, 11, 0.8)');
  pit.addColorStop(1, 'rgba(4, 1, 11, 0)');
  g.fillStyle = pit;
  g.fillRect(-9, -6, 18, 18);
  g.restore();

  // Photophores along the leading edges
  for (const side of [-1, 1]) {
    for (const p of GLOOMRAY_PHOTOPHORES) {
      g.beginPath();
      g.arc(side * p.x, p.y, p.r * 1.6 * fine, 0, TAU);
      g.fillStyle = hexToRgba(GLOOMRAY_RIM, 0.3);
      g.fill();
      g.beginPath();
      g.arc(side * p.x, p.y, p.r * 0.6 * fine, 0, TAU);
      g.fillStyle = '#e6feff';
      g.fill();
    }
  }

  // Mouth: dark slit between the horns, with a lit lip
  g.beginPath();
  g.moveTo(-7, -22);
  g.quadraticCurveTo(0, -16.5, 7, -22);
  g.strokeStyle = '#04010b';
  g.lineWidth = 2.6;
  g.stroke();
  g.beginPath();
  g.moveTo(-6, -20.2);
  g.quadraticCurveTo(0, -15.2, 6, -20.2);
  g.strokeStyle = hexToRgba(GLOOMRAY_RIM, 0.75);
  g.lineWidth = 0.7 * fine;
  g.stroke();

  // Eyes on the horn roots, in spore-green: the only warm light on it
  for (const side of [-1, 1]) {
    g.save();
    g.translate(side * 12.6, -21.2);
    g.rotate(side * 0.55);
    g.scale(1, 0.55);
    g.beginPath();
    g.arc(0, 0, 2.4 * fine, 0, TAU);
    g.shadowColor = SPORE_COLOR;
    g.shadowBlur = 6 * s;
    g.fillStyle = SPORE_COLOR;
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.arc(0.5, 0, 0.9 * fine, 0, TAU);
    g.fillStyle = '#ffffff';
    g.fill();
    g.restore();
  }

  // Iridescent rim: icy at the head, violet at the wingtips
  const rim = g.createRadialGradient(0, -8, 6, 0, -8, 52);
  rim.addColorStop(0, '#dcfdff');
  rim.addColorStop(0.35, GLOOMRAY_RIM);
  rim.addColorStop(1, GLOOMRAY_VIOLET);
  gloomrayPath(g);
  g.strokeStyle = rim;
  g.lineWidth = 1.8 * fine;
  g.stroke();
  g.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  g.lineWidth = 0.55;
  g.stroke();
}

// Spore: a spiked seed pod. Bright membrane, thorns, and a DARK nucleus; everything else in the game has a
// hot core, so this reads as "other" even at phone scale.
function paintSpore(g, s) {
  const fine = scaleFactor < 1 ? 1.4 : 1;
  const R = SPORE_RADIUS;
  g.fillStyle = hexToRgba(SPORE_COLOR, 0.8);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    g.beginPath();
    g.moveTo(Math.cos(a - 0.3) * R, Math.sin(a - 0.3) * R);
    g.lineTo(Math.cos(a) * (R + 4.5), Math.sin(a) * (R + 4.5));
    g.lineTo(Math.cos(a + 0.3) * R, Math.sin(a + 0.3) * R);
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.shadowColor = SPORE_COLOR;
  g.shadowBlur = 10 * s;
  const cyto = g.createRadialGradient(0, 0, 0, 0, 0, R);
  cyto.addColorStop(0, hexToRgba(SPORE_COLOR, 0.15));
  cyto.addColorStop(1, hexToRgba(SPORE_COLOR, 0.5));
  g.fillStyle = cyto;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 1.8 * fine;
  g.strokeStyle = SPORE_COLOR;
  g.stroke();
  g.lineWidth = 0.6;
  g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  g.stroke();
  g.beginPath();
  g.arc(-1, -0.6, 2.7, 0, TAU);
  g.fillStyle = '#0e1600';
  g.fill();
  g.lineWidth = 0.8;
  g.strokeStyle = mixHex(SPORE_COLOR, '#000000', 0.35);
  g.stroke();
  g.beginPath();
  g.arc(-0.2, -1.4, 0.85, 0, TAU);
  g.fillStyle = '#ffffff';
  g.fill();
}

// [base, step per later appearance, limit] → this appearance's value
const scaled = ([base, step, limit], n) => (step > 0 ? Math.min : Math.max)(limit, base + step * (n - 1));
const turnToward = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;

class Gloomray extends Boss {
  static label = 'Gloomray';
  static tier = 'easy';
  static colors = [GLOOMRAY_RIM, GLOOMRAY_VIOLET, SPORE_COLOR];
  static points = GLOOMRAY_POINTS;
  static hitRadius = GLOOMRAY_HIT_RADIUS;
  static bodyRadius = GLOOMRAY_BODY_RADIUS;
  static hp = GLOOMRAY_HP;
  static ramDamage = GLOOMRAY_RAM_DAMAGE;

  constructor(n) {
    super(n);
    const spawn = edgeSpawn();
    this.x = spawn.x - Math.cos(spawn.angle) * 90; // waits fully off-screen during the entrance
    this.y = spawn.y - Math.sin(spawn.angle) * 90;
    this.angle = spawn.angle;
    this.velX = 0;
    this.velY = 0;
    this.shadowFrom = { x: W - spawn.x, y: H - spawn.y }; // the shadow crosses the screen toward the entry edge
    this.entry = { x: clamp(spawn.x, 0, W), y: clamp(spawn.y, 0, H) };
    this.waypoint = this.pickWaypoint(spawn.x + Math.cos(spawn.angle) * 260, spawn.y + Math.sin(spawn.angle) * 260);
    this.speed = GLOOMRAY_SPEED[0] + GLOOMRAY_SPEED[1] * (n - 1);
    // States: enter → patrol ⇄ inhale → leave
    this.volleys = 0;
    this.nextVolley = clock + GLOOMRAY_ENTRANCE + 1800;
    this.aim = spawn.angle;
    this.laneOrigin = null;
    this.charge = 0; // 0..1 over the inhale
    this.gulps = 0; // hits taken during this inhale
    this.lastRipple = 0;
  }

  setState(state) {
    super.setState(state);
    this.charge = 0;
  }

  pickWaypoint(x = rand(110, W - 110), y = rand(110, H - 110)) {
    for (let i = 0; i < 8 && Math.hypot(x - player.x, y - player.y) < GLOOMRAY_PERSONAL_SPACE * 1.3; i++) {
      x = rand(110, W - 110);
      y = rand(110, H - 110);
    }
    return { x: clamp(x, 110, W - 110), y: clamp(y, 110, H - 110) };
  }

  get mouth() {
    return { x: this.x + Math.cos(this.angle) * GLOOMRAY_MOUTH, y: this.y + Math.sin(this.angle) * GLOOMRAY_MOUTH };
  }

  get locked() {
    return this.state === 'inhale' && clock - this.stateTime >= GLOOMRAY_TRACK;
  }

  get telegraphing() {
    return this.state === 'inhale';
  }

  update(f) {
    const t = clock - this.stateTime;
    this.hurt = Math.max(0, this.hurt - 0.08 * f);

    if (this.state === 'enter') {
      if (clock - this.lastRipple > 400) {
        addParticle({ kind: 'ring', x: this.entry.x, y: this.entry.y, life: 40, size: 70, width: 3, color: GLOOMRAY_RIM, drag: 1 });
        this.lastRipple = clock;
      }
      if (t > GLOOMRAY_ENTRANCE) this.setState('patrol');
      return;
    }

    let wantX = 0;
    let wantY = 0;
    if (this.state === 'patrol') {
      if (Math.hypot(this.waypoint.x - this.x, this.waypoint.y - this.y) < 60) this.waypoint = this.pickWaypoint();
      const dx = this.waypoint.x - this.x;
      const dy = this.waypoint.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      wantX = (dx / d) * this.speed;
      wantY = (dy / d) * this.speed;
      // A living thing: it shies away from the ship and from black holes
      const keepAway = (x, y, radius, strength) => {
        const ax = this.x - x;
        const ay = this.y - y;
        const ad = Math.hypot(ax, ay) || 1;
        if (ad >= radius) return;
        wantX += (ax / ad) * this.speed * strength * (1 - ad / radius);
        wantY += (ay / ad) * this.speed * strength * (1 - ad / radius);
      };
      if (!player.exploded) keepAway(player.x, player.y, GLOOMRAY_PERSONAL_SPACE, 2);
      blackHoles.forEach(bh => keepAway(bh.x, bh.y, bh.gravityRadius, 3));
      // ...and from the walls, so it never attacks from off-screen
      const wall = (v, max) => (clamp((100 - v) / 50, 0, 2) - clamp((v - max + 100) / 50, 0, 2)) * this.speed;
      wantX += wall(this.x, W);
      wantY += wall(this.y, H);

      const far = Math.hypot(player.x - this.x, player.y - this.y) > GLOOMRAY_MIN_FIRE_DISTANCE;
      const onScreen = this.x > 70 && this.x < W - 70 && this.y > 70 && this.y < H - 70;
      if (clock >= this.nextVolley && isPlaying() && far && onScreen && this.mayTelegraph()) {
        if (this.volleys >= GLOOMRAY_VOLLEYS) {
          this.setState('leave');
          playSound('black-hole-spawn', { rate: 0.6, volume: 0.5 });
        } else {
          this.setState('inhale');
          this.gulps = 0;
          this.laneOrigin = null;
          playSound('power-up-spawn', { rate: 0.55 });
        }
      }
    } else if (this.state === 'inhale') {
      this.charge = Math.min(1, t / (GLOOMRAY_TRACK + GLOOMRAY_LOCK));
      if (!this.locked) this.aim = Math.atan2(player.y - this.y, player.x - this.x);
      else this.laneOrigin ??= this.mouth; // lanes freeze here for the last GLOOMRAY_LOCK ms
      this.angle = turnToward(this.angle, this.aim, ease(0.25, f));
      // Motes stream into the mouth
      if (Math.random() < 0.7 * f) {
        const m = this.mouth;
        const a = this.angle + rand(-0.9, 0.9);
        const d = rand(30, 90);
        const color = Math.random() < 0.6 ? GLOOMRAY_RIM : SPORE_COLOR;
        addParticle({ kind: 'spark', x: m.x + Math.cos(a) * d, y: m.y + Math.sin(a) * d, vx: -Math.cos(a) * d / 14, vy: -Math.sin(a) * d / 14, life: 14, size: 1.5, color, drag: 1 });
      }
      // Shots near the mouth get inhaled: steered (not sped up), so they count as trick shots and never orbit
      const m = this.mouth;
      for (const b of bullets) {
        const dx = m.x - b.x;
        const dy = m.y - b.y;
        const distance = Math.hypot(dx, dy);
        if (distance < GLOOMRAY_INHALE_RADIUS && distance > 0) b.steer(dx, dy, distance, GLOOMRAY_INHALE_PULL / Math.max(distance, 40), f);
      }
      if (t >= GLOOMRAY_TRACK + GLOOMRAY_LOCK) this.spit();
    } else if (this.state === 'leave') {
      // Dives out past the nearest edge
      const ax = this.x - W / 2;
      const ay = this.y - H / 2;
      const ad = Math.hypot(ax, ay) || 1;
      wantX = (ax / ad) * this.speed * 3;
      wantY = (ay / ad) * this.speed * 3;
      if (this.isOffScreen()) this.leave();
    }

    // Glide: ease toward the wanted velocity (inhaling, it hovers) and bank toward where it's going
    const k = ease(this.state === 'inhale' ? 0.12 : 0.03, f);
    this.velX += (wantX - this.velX) * k;
    this.velY += (wantY - this.velY) * k;
    this.x += this.velX * f;
    this.y += this.velY * f;
    if (this.state !== 'inhale' && Math.hypot(this.velX, this.velY) > 0.3) {
      this.angle = turnToward(this.angle, Math.atan2(this.velY, this.velX), ease(0.05, f));
    }
  }

  spit() {
    const o = this.laneOrigin ?? this.mouth;
    const count = scaled(SPORES_PER_VOLLEY, this.n);
    const speed = SPORE_SPEED * difficultySpeed();
    for (let i = 0; i < count; i++) enemyShots.push(new Spore(this, o.x, o.y, this.aim + (i - (count - 1) / 2) * SPORE_SPREAD, speed));
    this.velX = -Math.cos(this.aim) * 3.5; // recoil, like a squid jetting
    this.velY = -Math.sin(this.aim) * 3.5;
    this.endVolley();
    addParticle({ kind: 'ring', x: o.x, y: o.y, life: 14, size: 26, color: SPORE_COLOR, drag: 1 });
    playSound('bump', { rate: 0.5 });
  }

  endVolley() {
    this.volleys++;
    this.nextVolley = clock + scaled(GLOOMRAY_VOLLEY_GAP, this.n);
    this.waypoint = this.pickWaypoint();
    this.setState('patrol');
  }

  onHit(damage, { trick }) {
    return this.state === 'inhale' || trick ? damage * 2 : damage; // an open mouth is a weak spot
  }

  afterHit() {
    if (this.state === 'inhale' && ++this.gulps >= GLOOMRAY_CHOKE_HITS) {
      // Choked on your bullets: the volley is cancelled
      this.endVolley();
      score += GLOOMRAY_CHOKE_POINTS;
      updateHighScore();
      pointTexts.push(new PointText(this.x, this.y - 40, `CHOKED! +${GLOOMRAY_CHOKE_POINTS}`, SPORE_COLOR, 18));
      playSound('power-up-expire', { rate: 0.7 });
    }
  }

  // Entrance: a huge shadow glides across the field toward the entry edge, eclipsing the stars
  drawBehind() {
    const t = (clock - this.stateTime) / GLOOMRAY_ENTRANCE;
    if (this.state !== 'enter' || t >= 1) return;
    gloomrayShadow ??= makeSprite(GLOOMRAY_SPRITE_SIZE, 0.5, g => {
      gloomrayPath(g);
      g.fillStyle = 'rgba(3, 0, 10, 0.85)';
      g.fill();
      g.strokeStyle = hexToRgba(GLOOMRAY_RIM, 0.25);
      g.lineWidth = 0.8;
      g.stroke();
    });
    const { x: x0, y: y0 } = this.shadowFrom;
    const { x: x1, y: y1 } = this.entry;
    const size = GLOOMRAY_SPRITE_SIZE * GLOOMRAY_SCALE * 3;
    ctx.save();
    ctx.translate(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    ctx.rotate(Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2);
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.8;
    ctx.drawImage(gloomrayShadow, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  draw() {
    if (this.state === 'enter') return;
    if (this.state === 'inhale') {
      const o = this.laneOrigin ?? this.mouth;
      drawSporeLanes(o.x, o.y, this.aim, scaled(SPORES_PER_VOLLEY, this.n), this.locked ? 0.85 : 0.35);
    }
    this.sprite ??= makeSprite(GLOOMRAY_SPRITE_SIZE, GLOOMRAY_SCALE, paintGloomray);
    const half = GLOOMRAY_SPRITE_SIZE / 2;
    const t = clock - this.stateTime;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);
    ctx.scale(GLOOMRAY_SCALE, GLOOMRAY_SCALE);

    // Tail whip
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 27);
    for (let i = 1; i <= 10; i++) ctx.lineTo(Math.sin(clock * 0.005 - i * 0.6) * i * 0.8, 27 + i * 6);
    ctx.globalAlpha = 0.8;
    neon(GLOOMRAY_VIOLET, 1.3);
    ctx.restore();

    // Wingbeat: squash the sprite's width, faster while inhaling
    const beat = Math.sin(clock * 0.004 + t * this.charge * 0.004);
    ctx.scale(1 + beat * 0.08, 1 - beat * 0.025);
    ctx.drawImage(this.sprite, -half, -half, GLOOMRAY_SPRITE_SIZE, GLOOMRAY_SPRITE_SIZE);
    ctx.globalCompositeOperation = 'lighter';

    // Heartbeat, racing while it inhales
    const pulse = 0.5 + 0.5 * Math.sin(clock * 0.008 + t * this.charge * 0.03);
    const heartR = 4 + pulse * 1.5 + this.charge * 5;
    ctx.globalAlpha = 0.55 + 0.45 * pulse;
    sporeGlow(0, 3, heartR);

    if (this.charge > 0) {
      // Photophores ripple from wingtip to mouth
      const wave = (this.charge * 2.2) % 1;
      ctx.fillStyle = SPORE_COLOR;
      for (const side of [-1, 1]) {
        for (const p of GLOOMRAY_PHOTOPHORES) {
          const lit = clamp(1 - Math.abs(1 - p.t - wave) * 5, 0, 1);
          if (!lit) continue;
          ctx.globalAlpha = lit;
          ctx.beginPath();
          ctx.arc(side * p.x, p.y, p.r * 2.4, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = this.charge;
      sporeGlow(0, -22, 5 + this.charge * 15); // the mouth swells with light
    }
    if (this.hurt > 0) {
      ctx.globalAlpha = this.hurt * 0.5;
      gloomrayPath(ctx);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  }
}

// Soft white-hot chartreuse glow (live; a gradient, never shadowBlur)
function sporeGlow(x, y, r) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, SPORE_COLOR);
  g.addColorStop(1, hexToRgba(SPORE_COLOR, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// Telegraph: dotted lanes along each spore's launch line
function drawSporeLanes(x, y, aim, count, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.setLineDash([2, 7]);
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  for (let i = 0; i < count; i++) {
    const a = aim + (i - (count - 1) / 2) * SPORE_SPREAD;
    const ex = x + Math.cos(a) * 280;
    const ey = y + Math.sin(a) * 280;
    const grad = ctx.createLinearGradient(x, y, ex, ey);
    grad.addColorStop(0, hexToRgba(SPORE_COLOR, alpha));
    grad.addColorStop(1, hexToRgba(SPORE_COLOR, 0));
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = grad;
    ctx.stroke();
  }
  ctx.restore();
}

class Spore extends EnemyShot {
  constructor(owner, x, y, angle, speed) {
    super(owner, x, y, angle, speed, { radius: SPORE_RADIUS, color: SPORE_COLOR, lifetime: SPORE_LIFETIME, points: SPORE_POINTS });
  }

  draw() {
    sporeSprite ??= makeSprite(SPORE_SPRITE_SIZE, 1, paintSpore);
    const t = this.age;
    const fade = this.fade;
    ctx.save();
    // Soft wake: two fading glows behind it (a smear, not a tail)
    ctx.globalCompositeOperation = 'lighter';
    for (const k of [1, 2]) {
      ctx.globalAlpha = fade * (0.35 / k);
      sporeGlow(this.x - this.velX * k * 2.2, this.y - this.velY * k * 2.2, SPORE_RADIUS * (1.4 - k * 0.25));
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(this.x, this.y);
    ctx.rotate(t * 0.006); // tumbles
    ctx.globalAlpha = fade;
    const w = 1 + Math.sin(t * 0.02) * 0.06; // throbs
    ctx.scale(w, w);
    ctx.drawImage(sporeSprite, -SPORE_SPRITE_SIZE / 2, -SPORE_SPRITE_SIZE / 2, SPORE_SPRITE_SIZE, SPORE_SPRITE_SIZE);
    ctx.restore();
  }
}

//
// Hollowclaw
//
//
// Hollowclaw: a hermit crab that wears the biggest asteroid as its shell, and throws it at you
//
const HOLLOWCLAW_CORAL = '#ff6f59';
const HOLLOWCLAW_CREAM = '#ffe9d6';
const HOLLOWCLAW_PEACH = '#ffb38a';
const HOLLOWCLAW_FLESH = '#3a0f12';
const HOLLOWCLAW_ENTRANCE = 2000; // ms: a big rock trembles, clicks three times, then sprouts legs
const HOLLOWCLAW_HP = [10, 3, 22]; // first appearance, +per later appearance, max
const HOLLOWCLAW_POINTS = 3000;
const HOLLOWCLAW_VISIT = 22000; // ms of fighting, then it scuttles off
const HOLLOWCLAW_THROWS = [3, 1, 5]; // then it leaves
const HOLLOWCLAW_GAP = [2600, -200, 1800]; // ms armored before each throw: base, -per appearance, min
const HOLLOWCLAW_FIRST_THROW = 1500; // ms after it stands up
const HOLLOWCLAW_TRACK = 400; // windup: the lane follows you...
const HOLLOWCLAW_LOCK = 600; // ...then freezes this long before the hurl (never shrinks)
const HOLLOWCLAW_THROW_SPEED = [6, 0.4, 8]; // px/frame
const HOLLOWCLAW_FLIGHT = 1800; // ms a thrown shell keeps its speed and coral ring, then it's an ordinary rock
const HOLLOWCLAW_LANE_STEPS = 80; // frames of flight the lane previews
const HOLLOWCLAW_SPEED = [1.3, 0.1]; // sidle speed: base, +per appearance
const HOLLOWCLAW_SCRAMBLE = 2.6; // naked dash to a new shell
const HOLLOWCLAW_TURN = 0.02; // rad/frame it can turn its shell toward you: slow enough to flank
const HOLLOWCLAW_PERSONAL_SPACE = 260; // sidles at about this distance
const HOLLOWCLAW_MIN_FIRE_DISTANCE = 200; // never starts a windup closer than this
const HOLLOWCLAW_SHELL_MIN = 30; // smallest rock it will wear
const HOLLOWCLAW_ENTRY_MIN = 34; // smallest rock that can stand up as its entrance
const HOLLOWCLAW_WRIGGLE = 600; // ms backing into a new shell
const HOLLOWCLAW_STUN = 1200; // ms after a cave-in
const HOLLOWCLAW_BODY = 21; // soft body radius vs bullets and the ship
const HOLLOWCLAW_CAVE_DAMAGE = 3; // shell split in its claws (×2 for a trick shot)
const HOLLOWCLAW_RETURN_DAMAGE = 4; // its own shell banked back into it
const HOLLOWCLAW_EVICT_POINTS = 300;
const HOLLOWCLAW_RETURN_POINTS = 1000;
const HOLLOWCLAW_SPRITE_SIZE = 64;

// Head: a glowing carapace with eye stalks, facing +x
function paintHollowclaw(g, s) {
  g.lineJoin = g.lineCap = 'round';
  g.shadowColor = HOLLOWCLAW_CORAL;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(6, side * 7);
    g.lineTo(19, side * 13);
    g.strokeStyle = HOLLOWCLAW_CORAL;
    g.lineWidth = 3;
    g.shadowBlur = 6 * s;
    g.stroke();
  }
  g.beginPath();
  g.ellipse(0, 0, 14, 18, 0, 0, TAU);
  const fill = g.createRadialGradient(5, 0, 1, 0, 0, 18);
  fill.addColorStop(0, '#8a2a22');
  fill.addColorStop(1, HOLLOWCLAW_FLESH);
  g.fillStyle = fill;
  g.shadowBlur = 16 * s;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 2.8;
  g.strokeStyle = HOLLOWCLAW_CORAL;
  g.stroke();
  g.lineWidth = 0.9;
  g.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  g.stroke();
  // Plate seams
  g.strokeStyle = hexToRgba(HOLLOWCLAW_PEACH, 0.7);
  g.lineWidth = 1.4;
  for (const r of [9, 15]) {
    g.beginPath();
    g.arc(14, 0, r, Math.PI * 0.72, Math.PI * 1.28);
    g.stroke();
  }
  // Mouthparts
  g.strokeStyle = HOLLOWCLAW_CREAM;
  g.lineWidth = 1.6;
  for (const y of [-4, 0, 4]) {
    g.beginPath();
    g.moveTo(11, y);
    g.lineTo(16, y * 1.2);
    g.stroke();
  }
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(20, side * 13.5, 3.6, 0, TAU);
    g.fillStyle = HOLLOWCLAW_CREAM;
    g.shadowColor = HOLLOWCLAW_CREAM;
    g.shadowBlur = 8 * s;
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.arc(21.2, side * 13.5, 1.5, 0, TAU);
    g.fillStyle = '#1a0306';
    g.fill();
  }
}

class Hollowclaw extends Boss {
  static label = 'Hollowclaw';
  static tier = 'easy';
  static colors = [HOLLOWCLAW_CORAL, HOLLOWCLAW_CREAM, HOLLOWCLAW_PEACH];
  static points = HOLLOWCLAW_POINTS;
  static hitRadius = HOLLOWCLAW_BODY;
  static bodyRadius = HOLLOWCLAW_BODY;
  static hp = HOLLOWCLAW_HP;

  constructor(n) {
    super(n);
    // States: enter → armored ⇄ windup → naked (or stunned, after a cave-in) → wriggle → armored … → leave
    this.speed = HOLLOWCLAW_SPEED[0] + HOLLOWCLAW_SPEED[1] * (n - 1);
    this.throwSpeed = scaled(HOLLOWCLAW_THROW_SPEED, n);
    this.shell = null; // a real Asteroid, taken out of `asteroids` while worn so nothing else moves it
    this.shellHp = 0;
    this.thrown = null; // the shell in flight (back in `asteroids`)
    this.throws = 0;
    this.lift = 0; // 0 = shell on its back, 1 = hoisted in its claws
    this.grow = 1; // legs and claws sprouting out of the rock during the entrance
    this.walk = 0;
    this.side = 1;
    this.flipAt = 0;
    this.lane = null;
    this.clicks = 0;
    // The biggest rock away from you stands up; no big rock and it scuttles in naked, shell-shopping
    const rock = asteroids
      .filter(a => !a.dead && a.size >= HOLLOWCLAW_ENTRY_MIN && a.canCollide() && a.x > 100 && a.x < W - 100 && a.y > 100 && a.y < H - 100)
      .filter(a => Math.hypot(a.x - player.x, a.y - player.y) > 260)
      .sort((a, b) => b.size - a.size)[0];
    if (rock) {
      this.angle = Math.atan2(rock.y - player.y, rock.x - player.x); // shell toward the ship
      this.wear(rock);
      asteroids.push(rock); // still a real rock (shootable, solid) until it stands up
      this.anchor = { x: rock.x, y: rock.y };
      this.x = rock.x + Math.cos(this.angle) * this.back;
      this.y = rock.y + Math.sin(this.angle) * this.back;
      this.grow = 0;
    } else {
      const spawn = edgeSpawn();
      this.x = spawn.x - Math.cos(spawn.angle) * 60;
      this.y = spawn.y - Math.sin(spawn.angle) * 60;
      this.angle = spawn.angle;
      this.velX = Math.cos(spawn.angle) * HOLLOWCLAW_SCRAMBLE;
      this.velY = Math.sin(spawn.angle) * HOLLOWCLAW_SCRAMBLE;
    }
  }

  get telegraphing() {
    return this.state === 'windup';
  }

  get locked() {
    return this.state === 'windup' && clock - this.stateTime >= HOLLOWCLAW_TRACK;
  }

  get soft() {
    return !this.shell || this.state === 'stunned' || this.state === 'wriggle';
  }

  // Shell center sits this far behind the head (or this far ahead of it, hoisted)
  get back() {
    return this.shell ? this.shell.size * 0.75 + 6 : 0;
  }

  get front() {
    return this.shell ? this.shell.size * 0.9 + 16 : 0;
  }

  shellAt(lift = this.lift, angle = this.angle) {
    const d = this.back * (1 - lift) - this.front * lift;
    return { x: this.x - Math.cos(angle) * d, y: this.y - Math.sin(angle) * d };
  }

  wear(a) {
    const i = asteroids.indexOf(a);
    if (i >= 0) asteroids.splice(i, 1);
    a.velX = a.velY = 0;
    this.shell = a;
    this.shellHp = Math.round(2 + a.size / 10);
    this.twist = a.rotationAngle - this.angle;
    // Coral cracks that glow when it's fragile (entrance, windup)
    this.cracks = Array.from({ length: 4 }, (_, k) => {
      let ang = (k / 4) * TAU + rand(-0.4, 0.4);
      let r = a.size * 0.2;
      return Array.from({ length: 4 }, () => {
        const p = { x: Math.cos(ang) * r, y: Math.sin(ang) * r };
        ang += rand(-0.5, 0.5);
        r += a.size * 0.22;
        return p;
      });
    });
  }

  // Hands the shell back to the field (it's an ordinary asteroid again)
  release() {
    const s = this.shell;
    this.shell = null;
    asteroids.push(s);
    return s;
  }

  update(f) {
    const t = clock - this.stateTime;
    this.hurt = Math.max(0, this.hurt - 0.08 * f);
    this.updateThrown();
    this.lift += ((this.state === 'windup' ? 1 : 0) - this.lift) * ease(0.18, f);

    if (this.state === 'enter') {
      if (this.shell?.dead) this.shell = null; // shot apart before it could stand up: it climbs out of the rubble
      if (this.anchor && this.shell) {
        const shiver = (t / HOLLOWCLAW_ENTRANCE) * 2.5;
        this.shell.x = this.anchor.x + rand(-shiver, shiver);
        this.shell.y = this.anchor.y + rand(-shiver, shiver);
        this.grow = clamp((t - 1400) / 600, 0, 1);
        if (this.clicks < 3 && t > 400 + this.clicks * 380) {
          this.clicks++;
          playSound('bump', { rate: 2.2, volume: 0.3 });
          addParticle({ kind: 'ring', x: this.shell.x, y: this.shell.y, life: 16, size: this.shell.size * 1.4, color: HOLLOWCLAW_CORAL, drag: 1 });
        }
      } else if (this.anchor) {
        this.grow = clamp((t - 1400) / 600, 0, 1);
      } else {
        this.x += this.velX * f;
        this.y += this.velY * f;
        this.walk += HOLLOWCLAW_SCRAMBLE * f;
      }
      if (t > HOLLOWCLAW_ENTRANCE) {
        if (this.shell) asteroids.splice(asteroids.indexOf(this.shell), 1); // now it's worn
        this.fightAt = clock;
        this.nextThrow = clock + HOLLOWCLAW_FIRST_THROW;
        if (this.anchor) addShake(4);
        this.setState(this.shell ? 'armored' : 'naked');
      }
      return;
    }

    let wantX = 0;
    let wantY = 0;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const done = this.throws >= scaled(HOLLOWCLAW_THROWS, this.n) || clock - this.fightAt > HOLLOWCLAW_VISIT;
    if ((this.state === 'armored' || this.state === 'naked') && done) {
      this.setState('leave');
      playSound('bump', { rate: 2.2, volume: 0.3 });
    }

    if (this.state === 'armored') {
      // Crabs walk sideways: circle the ship at arm's length, shell turned toward it
      if (clock > this.flipAt) {
        this.side = -this.side;
        this.flipAt = clock + rand(1500, 3000);
      }
      const radial = clamp((d - HOLLOWCLAW_PERSONAL_SPACE) / 100, -1, 1);
      wantX = (-dy / d) * this.side + (dx / d) * radial;
      wantY = (dx / d) * this.side + (dy / d) * radial;
      const away = Math.atan2(-dy, -dx);
      this.angle += clamp(Math.atan2(Math.sin(away - this.angle), Math.cos(away - this.angle)), -HOLLOWCLAW_TURN * f, HOLLOWCLAW_TURN * f);
      const onScreen = this.x > 80 && this.x < W - 80 && this.y > 80 && this.y < H - 80;
      if (clock >= this.nextThrow && isPlaying() && d > HOLLOWCLAW_MIN_FIRE_DISTANCE && onScreen && this.mayTelegraph()) {
        this.setState('windup');
        this.lane = null;
        this.lockedAt = 0;
        playSound('power-up-spawn', { rate: 0.5 });
      }
    } else if (this.state === 'windup') {
      // Spins to face you and hoists the shell into its claws
      if (!this.locked) {
        this.aim = Math.atan2(dy, dx);
        this.lane = this.traceLane();
      } else if (!this.lockedAt) {
        this.lockedAt = clock;
        playSound('click', { rate: 0.7 });
        addParticle({ kind: 'ring', x: this.lane.from.x, y: this.lane.from.y, life: 14, size: this.shell.size * 1.5, color: HOLLOWCLAW_CORAL, drag: 1 });
      }
      this.angle = turnToward(this.angle, this.aim, ease(0.25, f));
      if (t >= HOLLOWCLAW_TRACK + HOLLOWCLAW_LOCK) this.hurl();
    } else if (this.state === 'naked') {
      const rock = this.pickShell();
      if (rock) {
        const rx = rock.x - this.x;
        const ry = rock.y - this.y;
        const rd = Math.hypot(rx, ry) || 1;
        wantX = (rx / rd) * (HOLLOWCLAW_SCRAMBLE / this.speed);
        wantY = (ry / rd) * (HOLLOWCLAW_SCRAMBLE / this.speed);
        if (rd < rock.hitRadius + HOLLOWCLAW_BODY + 8) {
          this.angle = Math.atan2(-ry, -rx); // backs in
          this.wear(rock);
          this.setState('wriggle');
          playSound('bump', { rate: 0.8, volume: 0.6 });
        }
      } else {
        wantX = (-dx / d) * 0.6; // shy without a shell
        wantY = (-dy / d) * 0.6;
      }
    } else if (this.state === 'wriggle') {
      const s = this.shell;
      const k = ease(0.2, f);
      this.x += (s.x + Math.cos(this.angle) * this.back - this.x) * k;
      this.y += (s.y + Math.sin(this.angle) * this.back - this.y) * k;
      if (t > HOLLOWCLAW_WRIGGLE) {
        this.nextThrow = clock + scaled(HOLLOWCLAW_GAP, this.n);
        this.setState('armored');
      }
    } else if (this.state === 'stunned') {
      this.angle += Math.sin(t * 0.03) * 0.03 * f;
      if (t > HOLLOWCLAW_STUN) this.setState('naked');
    } else if (this.state === 'leave') {
      const ax = this.x - W / 2;
      const ay = this.y - H / 2;
      const ad = Math.hypot(ax, ay) || 1;
      wantX = (ax / ad) * 2.5;
      wantY = (ay / ad) * 2.5;
      if (this.isOffScreen(160)) this.leave();
    }

    // Keeps clear of the ship (it's not a rammer), black holes and the walls
    if (this.state !== 'leave') {
      const keepAway = (x, y, radius, strength) => {
        const ax = this.x - x;
        const ay = this.y - y;
        const ad = Math.hypot(ax, ay) || 1;
        if (ad < radius) {
          wantX += (ax / ad) * strength * (1 - ad / radius);
          wantY += (ay / ad) * strength * (1 - ad / radius);
        }
      };
      if (!player.exploded) keepAway(player.x, player.y, 170, 2);
      blackHoles.forEach(bh => keepAway(bh.x, bh.y, bh.gravityRadius * 0.6, 3));
      const wall = (v, max) => clamp((110 - v) / 50, 0, 2) - clamp((v - max + 110) / 50, 0, 2);
      wantX += wall(this.x, W);
      wantY += wall(this.y, H);
    }

    if (this.state !== 'wriggle') {
      const k = ease(this.state === 'naked' ? 0.12 : 0.06, f);
      this.velX += (wantX * this.speed - this.velX) * k;
      this.velY += (wantY * this.speed - this.velY) * k;
      if (this.state === 'windup' || this.state === 'stunned') this.velX = this.velY = 0;
      this.x += this.velX * f;
      this.y += this.velY * f;
      if (this.state === 'naked') this.angle = turnToward(this.angle, Math.atan2(this.velY, this.velX), ease(0.1, f));
      if (this.state !== 'leave') {
        this.x = clamp(this.x, 20, W - 20);
        this.y = clamp(this.y, 20, H - 20);
      }
    }
    this.walk += Math.hypot(this.velX, this.velY) * f;

    const s = this.shell;
    if (!s) return;
    if (this.state !== 'wriggle') {
      Object.assign(s, this.shellAt());
      s.rotationAngle = this.angle + this.twist + this.lift * Math.sin(clock * 0.02) * 0.1;
    }
    // The worn shell is solid: other rocks bounce off it
    for (const a of asteroids) {
      if (a.dead || a === this.thrown) continue;
      const rx = a.x - s.x;
      const ry = a.y - s.y;
      const rd = Math.hypot(rx, ry);
      const min = a.hitRadius + s.hitRadius;
      if (rd >= min || !rd) continue;
      const v = (a.velX * rx + a.velY * ry) / rd;
      if (v < 0) {
        a.velX -= (2 * v * rx) / rd;
        a.velY -= (2 * v * ry) / rd;
      }
      a.x += (rx / rd) * (min - rd);
      a.y += (ry / rd) * (min - rd);
    }
  }

  // Nearest wearable rock, avoiding ones next to the ship
  pickShell() {
    let best = null;
    let bestScore = Infinity;
    for (const a of asteroids) {
      if (a.dead || a === this.thrown || a.size < HOLLOWCLAW_SHELL_MIN || !a.canCollide()) continue;
      if (a.x < 40 || a.x > W - 40 || a.y < 40 || a.y > H - 40) continue;
      const score = Math.hypot(a.x - this.x, a.y - this.y) + (Math.hypot(a.x - player.x, a.y - player.y) < 180 ? 600 : 0);
      if (score < bestScore) [best, bestScore] = [a, score];
    }
    return best;
  }

  // The honest lane: the same per-frame math a thrown shell gets (asteroid speed cap, black-hole and well
  // pull, then our speed hold, walls bounce it), run ahead on a dummy
  traceLane() {
    const from = this.shellAt(1, this.aim);
    const r = this.shell.hitRadius;
    const speed = this.throwSpeed;
    const o = { x: from.x, y: from.y, velX: Math.cos(this.aim) * speed, velY: Math.sin(this.aim) * speed };
    const points = [];
    const w = hasPowerUp('well') && player.well;
    for (let i = 0; i < HOLLOWCLAW_LANE_STEPS; i++) {
      o.x += o.velX;
      o.y += o.velY;
      bounceOffWalls(o, r);
      capSpeed(o, ASTEROID_MAX_SPEED);
      for (const bh of blackHoles) bh.applyGravity(o, 1);
      if (w) {
        const wd = Math.hypot(w.x - o.x, w.y - o.y);
        if (wd < WELL_GRAB_RADIUS && wd > 0) {
          o.velX += ((w.x - o.x) / wd) * WELL_GRAB * w.opacity;
          o.velY += ((w.y - o.y) / wd) * WELL_GRAB * w.opacity;
        }
      }
      const v = Math.hypot(o.velX, o.velY) || 1;
      o.velX *= speed / v;
      o.velY *= speed / v;
      points.push({ x: o.x, y: o.y });
    }
    return { from, points };
  }

  hurl() {
    const s = this.release();
    Object.assign(s, this.lane.from);
    s.velX = Math.cos(this.aim) * this.throwSpeed;
    s.velY = Math.sin(this.aim) * this.throwSpeed;
    s.rotationSpeed = 0.15 * Math.sign(s.rotationSpeed || 1);
    this.thrown = s;
    this.thrownAt = clock;
    this.banked = false;
    this.throws++;
    this.lockedAt = 0;
    this.lane = null;
    this.velX = -Math.cos(this.aim) * 3; // recoil
    this.velY = -Math.sin(this.aim) * 3;
    this.setState('naked');
    addShake(5);
    addParticle({ kind: 'ring', x: s.x, y: s.y, life: 16, size: s.size * 1.6, color: HOLLOWCLAW_CORAL, drag: 1 });
    playSound('thrust', { rate: 0.6 });
    playSound('bump', { rate: 0.5 });
  }

  // A thrown shell holds its speed for a while, and one that banks off a wall back into it hurts
  updateThrown() {
    const a = this.thrown;
    if (!a) return;
    if (a.dead || clock - this.thrownAt > HOLLOWCLAW_FLIGHT) {
      a.rotationSpeed = 0.02 * Math.sign(a.rotationSpeed);
      this.thrown = null;
      return;
    }
    const r = a.hitRadius + 0.5; // bounceOffWalls leaves it exactly on the wall line
    if (a.x <= r || a.x >= W - r || a.y <= r || a.y >= H - r) this.banked = true;
    const v = Math.hypot(a.velX, a.velY) || 1;
    a.velX *= this.throwSpeed / v;
    a.velY *= this.throwSpeed / v;
    if (this.banked && this.state !== 'enter' && isPlaying() && this.touches(a.x, a.y, a.hitRadius)) {
      this.thrown = null;
      destroyAsteroid(a, { cause: 'bullet', angle: Math.atan2(a.velY, a.velX) });
      score += HOLLOWCLAW_RETURN_POINTS;
      updateHighScore();
      pointTexts.push(new PointText(this.x, this.y - 40, `RETURN TO SENDER! +${HOLLOWCLAW_RETURN_POINTS}`, HOLLOWCLAW_CREAM, 18));
      addHitstop(60);
      this.hit(HOLLOWCLAW_RETURN_DAMAGE, { sender: true });
    }
  }

  touches(x, y, r) {
    const s = this.shell;
    if (s && Math.hypot(x - s.x, y - s.y) < r + s.size * ASTEROID_PLAYER_HIT_RATIO) return true;
    return Math.hypot(x - this.x, y - this.y) < r + HOLLOWCLAW_BODY;
  }

  // Straight shots hit whichever it meets first, shell or body. Trick shots curl around the shell and
  // lances punch through it.
  hitBy(b) {
    const body = b.hits({ x: this.x, y: this.y, hitRadius: HOLLOWCLAW_BODY + (this.shell ? 0 : 6) });
    const s = this.shell;
    const shell = s && !b.trick && !b.lance && b.hits(s);
    const nearer = () => Math.hypot(b.prevX - s.x, b.prevY - s.y) - s.hitRadius < Math.hypot(b.prevX - this.x, b.prevY - this.y) - HOLLOWCLAW_BODY;
    this.part = shell && (!body || nearer()) ? 'shell' : 'body';
    return body || shell;
  }

  onHit(damage, { bullet, trick, sender }) {
    if (sender) return damage;
    if (!bullet) {
      // Shield ram or supernova: the shell shatters off
      if (this.shell) {
        const s = this.shell;
        this.shell = null;
        explode(s.x, s.y, s.color, s.size);
        playSound('asteroid-explode', { rate: 0.7 });
        if (this.state !== 'leave') this.setState('naked');
      }
      return damage;
    }
    const angle = Math.atan2(bullet.velY, bullet.velX);
    if (this.part === 'body') return damage * (this.soft ? 2 : 1) * (trick ? 2 : 1);

    if (this.state === 'windup') {
      // CAVE-IN: the hoisted shell splits in its claws, the throw is off, and it's stunned
      destroyAsteroid(this.release(), { cause: 'bullet', angle, trick });
      this.throws++;
      this.lane = null;
      this.lockedAt = 0;
      this.setState('stunned');
      pointTexts.push(new PointText(this.x, this.y - 40, 'CAVE-IN!', HOLLOWCLAW_CREAM, 20));
      addShake(6);
      return HOLLOWCLAW_CAVE_DAMAGE * (trick ? 2 : 1);
    }
    // The shell soaks it (breaking it counts through destroyAsteroid instead)
    this.shellHp -= damage;
    if (this.shellHp > 0) addCombo();
    const s = this.shell;
    for (let i = 0; i < 4; i++) {
      const a = angle + Math.PI + rand(-0.8, 0.8);
      addParticle({ kind: 'spark', x: bullet.x, y: bullet.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 12, size: 1.5, color: s.color, drag: 0.88 });
    }
    playSound('bump', { rate: 1.9, volume: 0.4 });
    if (this.shellHp <= 0) {
      destroyAsteroid(this.release(), { cause: 'bullet', angle, trick });
      score += HOLLOWCLAW_EVICT_POINTS;
      updateHighScore();
      pointTexts.push(new PointText(this.x, this.y - 40, `EVICTED! +${HOLLOWCLAW_EVICT_POINTS}`, HOLLOWCLAW_CREAM, 18));
      this.setState('naked');
    }
    return 0;
  }

  onDeath() {
    if (this.thrown) this.thrown.rotationSpeed = 0.02 * Math.sign(this.thrown.rotationSpeed);
    if (this.shell) {
      const s = this.release();
      s.dead = true;
      splitAsteroid(s, this.angle); // its worn shell cracks open around the power-up
      explode(s.x, s.y, s.color, s.size);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      addParticle({ kind: 'spark', x: this.x, y: this.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, life: 30, size: 3, color: i % 2 ? HOLLOWCLAW_CREAM : HOLLOWCLAW_CORAL, drag: 0.93 });
    }
    playSound('supernova', { rate: 0.7 });
  }

  draw() {
    if (this.thrown) this.drawThrown(this.thrown);
    if (this.state === 'windup' && this.lane) this.drawLane();
    const s = this.shell;
    const R = s ? s.size : 22;
    const hoisted = this.lift > 0.5;
    // Crab-local space (head at the origin, facing +x); while sprouting, everything grows out of the rock
    const local = () => {
      ctx.save();
      if (this.grow < 1) {
        // Grows out of its rock, or where the rock was if it got shot apart mid-entrance
        const k = 1 - Math.exp(-6 * this.grow) * Math.cos(8 * this.grow);
        const o = s ?? this.anchor ?? this;
        ctx.translate(o.x, o.y);
        ctx.scale(k, k);
        ctx.translate(-o.x, -o.y);
      }
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.lineCap = ctx.lineJoin = 'round';
    };
    local();
    if (s && !hoisted) this.drawLegs(R, this.back);
    else this.drawLegs(26, 22); // naked, or braced under a hoisted shell
    ctx.restore();
    if (s && !hoisted && this.state !== 'enter') s.draw(); // entering, the field still draws it
    local();
    if (!s) this.drawAbdomen();
    this.sprite ??= makeSprite(HOLLOWCLAW_SPRITE_SIZE, 1.25, paintHollowclaw);
    const half = (HOLLOWCLAW_SPRITE_SIZE / 2) * 1.25;
    ctx.drawImage(this.sprite, -half, -half, half * 2, half * 2);
    if (this.hurt > 0) {
      ctx.globalAlpha = this.hurt * 0.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 22, 0, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (s && hoisted) {
      ctx.save();
      const k = 1 + (this.lift - 0.5) * 0.2; // held up toward the camera
      ctx.translate(s.x, s.y);
      ctx.scale(k, k);
      ctx.translate(-s.x, -s.y);
      s.draw();
      ctx.restore();
    }
    if (s && (this.state === 'enter' || this.state === 'windup')) this.drawCracks(s);

    local();
    for (const side of [-1, 1]) {
      // Idle claws reach forward and snap now and then; hoisting, they spread to grip the shell's sides
      const grip = s ? Math.atan2(R * 1.05, this.front) : 0.6;
      const ang = side * (0.5 + (grip - 0.5) * this.lift);
      const snap = this.state === 'windup' ? 0 : Math.max(0, Math.sin(clock * (s ? 0.004 : 0.012) + side)) ** 6 * 0.6;
      this.drawClaw(8, side * 13, ang, (side === 1 ? 1.4 : 1) * (1 + this.lift * 0.2), side, snap);
    }
    if (this.state === 'stunned') {
      ctx.fillStyle = HOLLOWCLAW_CREAM;
      for (let i = 0; i < 3; i++) {
        const a = clock * 0.008 + (i * TAU) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 26, Math.sin(a) * 26, 3.5, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Three legs a side, rooted under the shell, stepping as it moves. Thick enough to read at 0.5x.
  drawLegs(R, back) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const step = Math.sin(this.walk * 0.12 + i * 2.1 + (side > 0 ? 0 : Math.PI)) * 0.3;
        const rx = -back * (0.2 + i * 0.35);
        const ry = side * R * 0.45;
        const a = side * (Math.PI / 2 + (i - 1) * 0.55 + step);
        const l1 = 22 + R * 0.3;
        const kx = rx + Math.cos(a) * l1;
        const ky = ry + Math.sin(a) * l1;
        const b = a + side * (0.9 - i * 0.2);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(kx, ky);
        ctx.lineTo(kx + Math.cos(b) * l1 * 0.85, ky + Math.sin(b) * l1 * 0.85);
        neon(HOLLOWCLAW_CORAL, 2.8);
      }
    }
  }

  // Naked: a soft, glowing curl where the shell should be. The tell for ×2.
  drawAbdomen() {
    const pulse = 0.5 + 0.5 * Math.sin(clock * 0.012);
    const glow = ctx.createRadialGradient(-22, 0, 0, -22, 0, 26 + pulse * 4);
    glow.addColorStop(0, hexToRgba(HOLLOWCLAW_CREAM, 0.9));
    glow.addColorStop(0.35, hexToRgba(HOLLOWCLAW_PEACH, 0.6));
    glow.addColorStop(1, hexToRgba(HOLLOWCLAW_CORAL, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(-22, 0, 26 + pulse * 4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = k * 0.42;
      const r = 3 + k * 0.6;
      ctx.lineTo(-22 + Math.cos(a) * r, Math.sin(a) * r);
    }
    neon(HOLLOWCLAW_PEACH, 2.2);
  }

  drawClaw(x, y, ang, k, side, open) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(k, k * side);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(17, 0);
    neon(HOLLOWCLAW_CORAL, 3.6);
    ctx.beginPath(); // fixed finger and palm
    ctx.moveTo(14, -3);
    ctx.quadraticCurveTo(28, -17, 44, -6);
    ctx.quadraticCurveTo(32, -5, 25, 1);
    ctx.closePath();
    ctx.fillStyle = HOLLOWCLAW_FLESH;
    ctx.fill();
    neon(HOLLOWCLAW_CORAL, 2.4);
    ctx.save();
    ctx.translate(24, 2);
    ctx.rotate(open);
    ctx.beginPath(); // the finger that snaps
    ctx.moveTo(-9, 0);
    ctx.quadraticCurveTo(6, 12, 17, 4);
    ctx.quadraticCurveTo(7, 3, 1, -2);
    ctx.closePath();
    ctx.fillStyle = HOLLOWCLAW_FLESH;
    ctx.fill();
    neon(HOLLOWCLAW_CORAL, 2.2);
    ctx.beginPath();
    ctx.moveTo(13, 5);
    ctx.lineTo(18, 4);
    neon(HOLLOWCLAW_CREAM, 2);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(39, -8);
    ctx.lineTo(45, -6);
    neon(HOLLOWCLAW_CREAM, 2);
    ctx.restore();
  }

  drawCracks(s) {
    const t = clock - this.stateTime;
    const glow = this.state === 'enter' ? clamp(t / 900, 0, 1) : 0.6 + 0.4 * Math.sin(t * 0.03);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rotationAngle - this.twist);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow;
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const c of this.cracks) {
      ctx.beginPath();
      c.forEach(p => ctx.lineTo(p.x, p.y));
      neon(HOLLOWCLAW_CORAL, 2);
    }
    ctx.restore();
  }

  // Telegraph: coral beads along the traced path, brightening when it locks
  drawLane() {
    const { points } = this.lane;
    const alpha = this.locked ? 0.95 : 0.4;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 4; i < points.length; i += 3) {
      const p = points[i];
      const fade = alpha * (1 - i / points.length);
      ctx.globalAlpha = fade;
      ctx.fillStyle = HOLLOWCLAW_CORAL;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = HOLLOWCLAW_CREAM;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // In flight: spinning coral brackets, so it can't pass for a stray rock
  drawThrown(a) {
    const r = a.hitRadius + 9;
    const fade = clamp((HOLLOWCLAW_FLIGHT - (clock - this.thrownAt)) / 300, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    ctx.translate(a.x, a.y);
    ctx.rotate(clock * 0.012);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r, (i * TAU) / 3, (i * TAU) / 3 + 1.1);
      neon(HOLLOWCLAW_CORAL, 3);
    }
    ctx.restore();
  }

  // Under the rocks: the thrown shell's straight speed streak
  drawBehind() {
    const a = this.thrown;
    if (!a) return;
    const r = a.hitRadius + 9;
    const fade = clamp((HOLLOWCLAW_FLIGHT - (clock - this.thrownAt)) / 300, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade * 0.5;
    const v = Math.hypot(a.velX, a.velY) || 1;
    const tx = a.x - (a.velX / v) * r * 2.4;
    const ty = a.y - (a.velY / v) * r * 2.4;
    const streak = ctx.createLinearGradient(a.x, a.y, tx, ty);
    streak.addColorStop(0, hexToRgba(HOLLOWCLAW_CORAL, 0.8));
    streak.addColorStop(1, hexToRgba(HOLLOWCLAW_CORAL, 0));
    ctx.strokeStyle = streak;
    ctx.lineWidth = r * 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();
  }
}

//
// Vigil
//
//
// Vigil: a pulsar sweeping twin lighthouse beams. Each beam is traced as a real Bullet path, so black holes
// and your pocket well bend it exactly like they bend your shots.
//
const VIGIL_COBALT = '#4166ff';
const VIGIL_ICE = '#a8bcff';
const VIGIL_HP = [12, 3, 24]; // first appearance, +per later appearance, max
const VIGIL_POINTS = 3000;
const VIGIL_GLITCH_POINTS = 500;
const VIGIL_HIT_RADIUS = 22; // vs bullets: the white-hot core and a little of its glow
const VIGIL_BODY_RADIUS = 16; // vs the ship
const VIGIL_CORE = 14; // beams start this far out from the center
const VIGIL_ENTRANCE = 2000; // a harmless ghost beam sweeps the field from off-screen
const VIGIL_CYCLES = 3; // charge → lit cycles, then it leaves
const VIGIL_FIRST_CHARGE = 900; // ms of drifting after the entrance
const VIGIL_REST = 1200; // ms between lit phases
const VIGIL_TRACK = 600; // charge: the guides follow you...
const VIGIL_LOCK = 700; // ...then freeze this long before ignition
const VIGIL_LIT = [2500, 200, 3300]; // ms the beams burn: base, +per appearance, max
const VIGIL_SPIN = [0.009, 0.001, 0.014]; // sweep in rad/frame (2.3px/frame at 260px; the ship tops out at 4)
const VIGIL_DUO_SPIN = 0.7; // sweeps slower while another boss is on screen
const VIGIL_LEAD = 0.55; // the beam reaches where you were this far through its burn
const VIGIL_SPIN_DOWN = 0.88; // each hit while lit keeps this share of the sweep speed...
const VIGIL_SPIN_RECOVER = 0.01; // ...and it winds back up at this rate per frame
const VIGIL_GLITCH_HITS = 6; // hits in one lit phase kill the beams
const VIGIL_GLITCH = 1500; // ms the core then takes ×2
const VIGIL_SELF_LENS = 0.25; // share of max hp a beam bent back into its own core deals
const VIGIL_RAY_STEPS = 12;
const VIGIL_RAY_STEP = 30; // px per ray-march step, so the beams reach 360px
const VIGIL_REACH = VIGIL_RAY_STEPS * VIGIL_RAY_STEP;
const VIGIL_GROW = 150; // ms for fresh beams to shoot out to full length
const VIGIL_BEAM_WIDTH = 6;
const VIGIL_BEAM_HALF = 4; // vs the ship (on top of PLAYER_HIT_RADIUS)
const VIGIL_SAFE = 80; // never ignites with a beam path this close to the ship
const VIGIL_PERSONAL_SPACE = 260; // drifting keeps about this far from the ship
const VIGIL_SPEED = 1.4;
const VIGIL_EXIT_SPIN = 900; // ms of strobing before it streaks away
const VIGIL_SCALE = 1.2;
const VIGIL_SPRITE_SIZE = 96;

// Where (0..1) along the ray's last step it first enters a circle; Infinity if it misses
function vigilEntry(ray, cx, cy, r) {
  const dx = ray.x - ray.prevX;
  const dy = ray.y - ray.prevY;
  const fx = ray.prevX - cx;
  const fy = ray.prevY - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  const b = fx * dx + fy * dy;
  const disc = b * b - a * c;
  if (b >= 0 || disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / a;
  return t <= 1 ? t : Infinity;
}

// Neutron star: dipole field loops (r = L·sin²θ around the beam axis, x) in a cobalt magnetosphere
function paintVigil(g) {
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, 47);
  glow.addColorStop(0, hexToRgba(VIGIL_ICE, 0.5));
  glow.addColorStop(0.3, hexToRgba(VIGIL_COBALT, 0.3));
  glow.addColorStop(1, hexToRgba(VIGIL_COBALT, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, 47, 0, TAU);
  g.fill();

  g.lineCap = g.lineJoin = 'round';
  g.shadowColor = VIGIL_COBALT;
  g.shadowBlur = 8;
  for (const [L, alpha, width] of [[42, 0.55, 2], [31, 0.8, 2.4], [20, 1, 2.8]]) {
    g.beginPath();
    for (const side of [1, -1]) {
      for (let i = 0; i <= 40; i++) {
        const th = (i / 40) * Math.PI;
        const r = L * Math.sin(th) ** 2;
        g[i ? 'lineTo' : 'moveTo'](r * Math.cos(th), side * r * Math.sin(th));
      }
    }
    g.globalAlpha = alpha;
    g.strokeStyle = mixHex(VIGIL_COBALT, VIGIL_ICE, alpha * 0.6); // inner loops run hotter
    g.lineWidth = width;
    g.stroke();
  }
  g.globalAlpha = 1;

  g.shadowColor = '#ffffff';
  g.shadowBlur = 10;
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 13);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.45, '#ffffff');
  core.addColorStop(0.7, VIGIL_ICE);
  core.addColorStop(1, hexToRgba(VIGIL_COBALT, 0));
  g.fillStyle = core;
  g.beginPath();
  g.arc(0, 0, 13, 0, TAU);
  g.fill();
}

class Vigil extends Boss {
  static label = 'Vigil';
  static tier = 'medium';
  static colors = [VIGIL_COBALT, VIGIL_ICE, '#ffffff'];
  static points = VIGIL_POINTS;
  static hitRadius = VIGIL_HIT_RADIUS;
  static bodyRadius = VIGIL_BODY_RADIUS;
  static hp = VIGIL_HP;

  constructor(n) {
    super(n);
    const spawn = edgeSpawn();
    this.entryAngle = spawn.angle;
    this.x = spawn.x - Math.cos(spawn.angle) * 60; // waits off-screen while its ghost beam sweeps in
    this.y = spawn.y - Math.sin(spawn.angle) * 60;
    // States: enter → drift → charge → lit → drift ... → leave
    this.beamAngle = spawn.angle; // the magnetic axis: the beams fire both ways along it
    this.aim = spawn.angle;
    this.spin = pick([-1, 1]); // flips every cycle
    this.spinDown = 1;
    this.cycles = 0;
    this.nextCharge = Infinity;
    this.litFor = 0;
    this.litHits = 0;
    this.retries = 0;
    this.glitchUntil = 0;
    this.beamOff = -Infinity; // when the beams last died (they fade out harmlessly)
    this.lastBeat = 0;
    this.pulse = 0;
    this.streaking = false;
    this.spot = this.pickSpot();
    this.ray = new Bullet(0, 0, 0, false); // reused every cast: the beam is literally a bullet's path
    this.beams = [0, 1].map(() => ({ pts: new Float32Array((VIGIL_RAY_STEPS + 1) * 2), count: 0, end: null, near: false }));
    // The lensing is the whole point: make sure a black hole turns up soon
    if (!blackHoles.length) nextBlackHole = Math.min(nextBlackHole ?? Infinity, clock + 3000);
  }

  get telegraphing() {
    return this.state === 'charge';
  }

  // Somewhere on-screen, away from the ship; near a black hole if there is one, so its beams bend
  pickSpot() {
    const bh = blackHoles[0];
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU);
      const d = rand(140, 230); // the near end can bend a beam back into its own core
      const x = clamp(bh && i < 8 ? bh.x + Math.cos(a) * d : rand(0, W), 140, W - 140);
      const y = clamp(bh && i < 8 ? bh.y + Math.sin(a) * d : rand(0, H), 140, H - 140);
      if (Math.hypot(x - player.x, y - player.y) > VIGIL_PERSONAL_SPACE) return { x, y };
    }
    return { x: clamp(W - player.x, 140, W - 140), y: clamp(H - player.y, 140, H - 140) };
  }

  // The pulsar's heartbeat: a click and a flash of the core
  beat(interval, rate, volume) {
    if (clock - this.lastBeat < interval) return;
    this.lastBeat = clock;
    this.pulse = 1;
    playSound('click', { rate, volume, vary: 0 });
  }

  update(f) {
    const t = clock - this.stateTime;
    this.hurt = Math.max(0, this.hurt - 0.08 * f);
    this.pulse = Math.max(0, this.pulse - 0.1 * f);
    this.spinDown += (1 - this.spinDown) * ease(VIGIL_SPIN_RECOVER, f);

    if (this.state === 'enter') {
      this.beamAngle = this.entryAngle + Math.sin((t / VIGIL_ENTRANCE) * TAU) * 0.9; // two passes across the field
      this.beat(250, 0.5 + (t / VIGIL_ENTRANCE) * 0.4, 0.4);
      if (t > VIGIL_ENTRANCE) {
        this.setState('drift');
        this.nextCharge = clock + VIGIL_FIRST_CHARGE;
      }
      return;
    }

    if (this.state === 'leave') {
      // Spins up to a strobe and shrinks to a point, then streaks off past the nearest edge
      this.beamAngle += (0.05 + (t / VIGIL_EXIT_SPIN) * 0.6) * f;
      if (t > VIGIL_EXIT_SPIN && !this.streaking) {
        const ax = this.x - W / 2;
        const ay = this.y - H / 2;
        const edge = Math.min(this.x, W - this.x) < Math.min(this.y, H - this.y);
        this.velX = edge ? Math.sign(ax) * 16 : 0;
        this.velY = edge ? 0 : Math.sign(ay) * 16;
        this.streaking = true;
        addParticle({ kind: 'ring', x: this.x, y: this.y, life: 26, size: 90, width: 4, color: VIGIL_COBALT, drag: 1 });
        playSound('thrust', { rate: 1.6, volume: 0.7 });
      }
      if (this.streaking) {
        addParticle({ kind: 'spark', x: this.x, y: this.y, vx: -this.velX * 0.3, vy: -this.velY * 0.3, life: 14, size: 2.5, color: Math.random() < 0.5 ? '#ffffff' : VIGIL_COBALT, drag: 0.9 });
        this.x += this.velX * f;
        this.y += this.velY * f;
        if (this.isOffScreen()) this.leave();
      }
      return;
    }

    let wantX = 0;
    let wantY = 0;
    if (this.state === 'drift') {
      const dx = this.spot.x - this.x;
      const dy = this.spot.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = VIGIL_SPEED * Math.min(1, d / 80); // settles gently onto its spot
      wantX = (dx / d) * speed;
      wantY = (dy / d) * speed;
      const ax = this.x - player.x;
      const ay = this.y - player.y;
      const ad = Math.hypot(ax, ay) || 1;
      if (!player.exploded && ad < VIGIL_PERSONAL_SPACE) {
        wantX += (ax / ad) * VIGIL_SPEED * 1.5 * (1 - ad / VIGIL_PERSONAL_SPACE);
        wantY += (ay / ad) * VIGIL_SPEED * 1.5 * (1 - ad / VIGIL_PERSONAL_SPACE);
      }
      const wall = (v, max) => (clamp((120 - v) / 40, 0, 2) - clamp((v - max + 120) / 40, 0, 2)) * VIGIL_SPEED;
      wantX += wall(this.x, W);
      wantY += wall(this.y, H);
      this.beamAngle += 0.006 * this.spin * f; // idling, slowly turning

      const onScreen = this.x > 90 && this.x < W - 90 && this.y > 90 && this.y < H - 90;
      if (clock >= this.nextCharge && this.cycles >= VIGIL_CYCLES) {
        this.setState('leave');
        playSound('power-up-expire', { rate: 0.6 });
      } else if (clock >= this.nextCharge && isPlaying() && onScreen && this.mayTelegraph()) {
        this.spin = -this.spin;
        this.retries = 0;
        this.setState('charge');
        playSound('power-up-spawn', { rate: 0.7 });
        // First meeting: say the counter out loud (the dashed reach ring is the whole trick)
        if (this.n === 1 && !this.cycles) pointTexts.push(new PointText(player.x, player.y - 44, 'GET OUTSIDE THE RING!', VIGIL_ICE, 18));
      }
    } else if (this.state === 'charge') {
      // Guides track you, then lock; meanwhile they wind into place the way the beams will turn. The
      // trailing beam starts behind you by VIGIL_LEAD of its whole sweep, so you always get a head start but
      // standing still doesn't save you.
      const k = clamp(t / (VIGIL_TRACK + VIGIL_LOCK), 0, 1);
      const lead = Math.min(Math.PI / 2, ((this.sweepSpeed() * scaled(VIGIL_LIT, this.n)) / TARGET_DELTA) * VIGIL_LEAD);
      if (t < VIGIL_TRACK) this.aim = Math.atan2(player.y - this.y, player.x - this.x) - this.spin * lead;
      this.beamAngle = this.aim - this.spin * (1 - k) * 0.6;
      this.beat(300 - k * 230, 0.6 + k * 0.5, 0.5); // ticks quicken
      this.castBeams(VIGIL_REACH, false, f);
      if (k >= 1) {
        if (!this.beams.some(b => b.near) || !isPlaying()) this.ignite();
        else if (++this.retries > 2) {
          this.setState('drift'); // you're hugging it: back off and try again
          this.nextCharge = clock + 800;
        } else this.stateTime = clock; // fail-safe: never ignites on top of you, re-track instead
      }
    } else if (this.state === 'lit') {
      this.beamAngle += this.spin * this.sweepSpeed() * this.spinDown * f;
      this.castBeams(VIGIL_REACH * clamp(t / VIGIL_GROW, 0.05, 1), true, f);
      this.beat(450, 0.5, 0.25);
      if (this.state === 'lit' && t >= this.litFor) this.douse();
    }

    // Hovers still while charging and burning, glides otherwise
    const k = ease(this.state === 'drift' ? 0.03 : 0.1, f);
    this.velX += (wantX - this.velX) * k;
    this.velY += (wantY - this.velY) * k;
    this.x += this.velX * f;
    this.y += this.velY * f;
  }

  // rad/frame, slower while another boss is on screen
  sweepSpeed() {
    return scaled(VIGIL_SPIN, this.n) * (bosses.some(o => o !== this && !o.dead) ? VIGIL_DUO_SPIN : 1);
  }

  ignite() {
    this.setState('lit');
    this.litHits = 0;
    this.litFor = scaled(VIGIL_LIT, this.n);
    addParticle({ kind: 'ring', x: this.x, y: this.y, life: 18, size: 60, width: 5, color: '#ffffff', drag: 1 });
    addShake(4);
    playSound('black-hole-spawn', { rate: 0.8, volume: 0.7 });
  }

  // The beams die: back to drifting
  douse() {
    this.beamOff = clock;
    this.cycles++;
    this.spot = this.pickSpot();
    this.nextCharge = clock + VIGIL_REST;
    this.setState('drift');
  }

  castBeams(len, live, f) {
    for (let i = 0; i < 2 && !this.dead; i++) {
      if (live && this.state !== 'lit') return; // self-lensed by the first beam
      const beam = this.beams[i];
      this.castRay(beam, this.beamAngle + i * Math.PI, len, live);
      if (!live || !beam.end) continue;
      const end = beam.end;
      const x = beam.pts[beam.count * 2 - 2];
      const y = beam.pts[beam.count * 2 - 1];
      if (end === 'ship') killPlayer('game-over');
      else if (end === 'self') this.selfLensed();
      else if (Math.random() < 0.6 * f) {
        // Splash where a rock, the shield or a black hole drinks the beam
        const color = end === 'shield' ? POWER_UP_COLORS.shield : end === 'hole' ? '#ff6a00' : end.color;
        const a = rand(0, TAU);
        addParticle({ kind: 'spark', x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: rand(8, 16), size: 2, color: Math.random() < 0.4 ? '#ffffff' : color, drag: 0.88 });
      }
    }
  }

  // March the beam as a throwaway Bullet: black holes and the well steer it exactly like a shot.
  // Live beams stop at rocks, the shield, black-hole cores and the ship; guides only stop at cores.
  castRay(beam, angle, len, live) {
    const ray = this.ray;
    const pts = beam.pts;
    ray.x = pts[0] = this.x + Math.cos(angle) * VIGIL_CORE;
    ray.y = pts[1] = this.y + Math.sin(angle) * VIGIL_CORE;
    ray.velX = Math.cos(angle) * BULLET_SPEED;
    ray.velY = Math.sin(angle) * BULLET_SPEED;
    ray.turn = 0;
    beam.count = 1;
    beam.end = null;
    beam.near = false;
    const well = player.well && hasPowerUp('well') ? player.well : null;
    const shielded = live && hasPowerUp('shield') && !player.exploded;
    const lethal = live && isPlaying() && !shielded && !shipInvulnerable();
    for (let i = 0, left = len; left > 0 && i < VIGIL_RAY_STEPS; i++, left -= VIGIL_RAY_STEP) {
      const f = Math.min(VIGIL_RAY_STEP, left) / BULLET_SPEED;
      for (const bh of blackHoles) bh.applyGravity(ray, f);
      if (well) {
        const dx = well.x - ray.x;
        const dy = well.y - ray.y;
        const d = Math.hypot(dx, dy);
        if (d < WELL_RADIUS && d > 0) ray.steer(dx, dy, d, (WELL_PULL / Math.max(d, 50)) * well.opacity, f);
      }
      ray.move(f);

      this.hitT = 1;
      this.hitEnd = null;
      for (const bh of blackHoles) this.test(bh.x, bh.y, BLACK_HOLE_CORE_DRAW, 'hole');
      if (ray.turn > 2) this.test(this.x, this.y, VIGIL_HIT_RADIUS, 'self'); // bent all the way back home
      if (live) {
        for (const a of cover) if (!a.dead) this.test(a.x, a.y, a.hitRadius * 0.9, a);
        if (shielded) this.test(player.x, player.y, SHIELD_RADIUS, 'shield');
        if (lethal) this.test(player.x, player.y, PLAYER_HIT_RADIUS + VIGIL_BEAM_HALF, 'ship');
        for (const s of enemyShots) {
          if (s.owner !== this && !s.dead && vigilEntry(ray, s.x, s.y, s.hitRadius + VIGIL_BEAM_HALF) <= this.hitT) s.pop(VIGIL_COBALT); // sweeps up a partner's shots
        }
      } else if (vigilEntry(ray, player.x, player.y, VIGIL_SAFE) < 1) {
        beam.near = true;
      }

      pts[beam.count * 2] = ray.prevX + (ray.x - ray.prevX) * this.hitT;
      pts[beam.count * 2 + 1] = ray.prevY + (ray.y - ray.prevY) * this.hitT;
      beam.count++;
      if ((beam.end = this.hitEnd)) return;
      if (ray.x < -40 || ray.x > W + 40 || ray.y < -40 || ray.y > H + 40) return;
    }
  }

  test(x, y, r, what) {
    const t = vigilEntry(this.ray, x, y, r);
    if (t < this.hitT) {
      this.hitT = t;
      this.hitEnd = what;
    }
  }

  // Its own beam bent back into its core by gravity: a big hit, and the beams go out
  selfLensed() {
    this.douse();
    pointTexts.push(new PointText(this.x, this.y - 40, 'SELF-LENSED!', VIGIL_ICE, 20));
    addHitstop(60);
    this.hit(Math.ceil(this.maxHp * VIGIL_SELF_LENS), { trick: true });
  }

  // Too many hits while lit: the beams sputter out and the core is exposed
  glitch() {
    this.douse();
    this.glitchUntil = clock + VIGIL_GLITCH;
    score += VIGIL_GLITCH_POINTS;
    updateHighScore();
    pointTexts.push(new PointText(this.x, this.y - 40, `GLITCH! +${VIGIL_GLITCH_POINTS}`, VIGIL_ICE, 18));
    addParticle({ kind: 'ring', x: this.x, y: this.y, life: 20, size: 70, width: 3, color: VIGIL_ICE, drag: 1 });
    playSound('power-up-expire', { rate: 0.8 });
  }

  onHit(damage) {
    return clock < this.glitchUntil ? damage * 2 : damage;
  }

  afterHit() {
    if (this.state !== 'lit') return;
    this.spinDown *= VIGIL_SPIN_DOWN; // every hit slows the sweep
    if (++this.litHits >= VIGIL_GLITCH_HITS) this.glitch();
  }

  touches(x, y, r) {
    return this.state !== 'leave' && super.touches(x, y, r); // the exit streak never rams you
  }

  onDeath() {
    // Starquake: jets along the magnetic axis
    for (const side of [0, Math.PI]) {
      for (let i = 0; i < 14; i++) {
        const a = this.beamAngle + side + rand(-0.12, 0.12);
        const v = rand(5, 15);
        addParticle({ kind: 'spark', x: this.x, y: this.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(25, 45), size: rand(2, 3.5), color: i % 3 ? VIGIL_COBALT : '#ffffff', drag: 0.95 });
      }
    }
    addParticle({ kind: 'ring', x: this.x, y: this.y, life: 40, size: 220, width: 8, color: VIGIL_COBALT, drag: 1 });
  }

  tracePath(beam) {
    ctx.beginPath();
    ctx.moveTo(beam.pts[0], beam.pts[1]);
    for (let i = 1; i < beam.count; i++) ctx.lineTo(beam.pts[i * 2], beam.pts[i * 2 + 1]);
  }

  // Floor telegraphs: the entrance ghost beam, the reach ring and the charge guides
  drawBehind() {
    const t = clock - this.stateTime;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    if (this.state === 'enter') {
      ctx.globalAlpha = 0.22 * Math.sin((t / VIGIL_ENTRANCE) * Math.PI) ** 0.5;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.beamAngle) * (W + H), this.y + Math.sin(this.beamAngle) * (W + H));
      neon(VIGIL_COBALT, 10);
    } else if (this.state === 'charge' || this.state === 'lit') {
      const k = this.state === 'charge' ? clamp(t / (VIGIL_TRACK + VIGIL_LOCK), 0, 1) : 1;
      // Reach ring: past it you're safe. Its dashes turn with the beams.
      ctx.setLineDash([10, 14]);
      ctx.lineDashOffset = -this.beamAngle * VIGIL_REACH;
      ctx.globalAlpha = 0.2 + k * 0.15;
      ctx.beginPath();
      ctx.arc(this.x, this.y, VIGIL_REACH, 0, TAU);
      neon(VIGIL_COBALT, 1.5);
      if (this.state === 'charge') {
        const locked = t >= VIGIL_TRACK;
        ctx.setLineDash([3, 9]);
        ctx.lineDashOffset = -clock * 0.06; // marching outward
        ctx.globalAlpha = locked ? 0.9 : 0.45;
        for (const beam of this.beams) {
          this.tracePath(beam);
          neon(VIGIL_ICE, 2.5);
        }
        // Chevrons along each guide point the way it will sweep
        ctx.setLineDash([]);
        ctx.lineJoin = 'round';
        for (const beam of this.beams) {
          for (let i = 3; i < beam.count; i += 4) {
            const [x, y, px, py] = [beam.pts[i * 2], beam.pts[i * 2 + 1], beam.pts[i * 2 - 2], beam.pts[i * 2 - 1]];
            const s = (9 + i * 0.5) / (Math.hypot(x - px, y - py) || 1);
            const [ux, uy, nx, ny] = [(x - px) * s, (y - py) * s, (py - y) * s * this.spin, (x - px) * s * this.spin];
            ctx.beginPath();
            ctx.moveTo(x - nx * 0.2 - ux, y - ny * 0.2 - uy);
            ctx.lineTo(x + nx, y + ny);
            ctx.lineTo(x - nx * 0.2 + ux, y - ny * 0.2 + uy);
            neon(VIGIL_ICE, 2);
          }
        }
      }
    }
    ctx.restore();
  }

  drawBeams(alpha, width) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const beam of this.beams) {
      if (beam.count < 2) continue;
      this.tracePath(beam);
      ctx.globalAlpha = alpha * 0.12;
      ctx.strokeStyle = VIGIL_COBALT;
      ctx.lineWidth = width * 5;
      ctx.stroke();
      ctx.globalAlpha = alpha;
      neon(VIGIL_COBALT, width);
      ctx.lineWidth = width * 0.45; // a second white pass: the beam is white-hot, not just blue
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      // A hot spot where it ends
      const x = beam.pts[beam.count * 2 - 2];
      const y = beam.pts[beam.count * 2 - 1];
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, width * 0.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  draw() {
    if (this.state === 'enter') return;
    const t = clock - this.stateTime;
    const flicker = REDUCED_MOTION ? 1 : 1 + Math.sin(clock * 0.03) * 0.15;
    if (this.state === 'lit') this.drawBeams(1, VIGIL_BEAM_WIDTH * flicker);
    else if (clock - this.beamOff < 300) this.drawBeams((1 - (clock - this.beamOff) / 300) * (Math.random() < 0.5 ? 0.3 : 0.8), VIGIL_BEAM_WIDTH * 0.6); // sputters out

    this.sprite ??= makeSprite(VIGIL_SPRITE_SIZE, VIGIL_SCALE, paintVigil);
    const charge = this.state === 'charge' ? clamp(t / (VIGIL_TRACK + VIGIL_LOCK), 0, 1) : 0;
    const shrink = this.state === 'leave' ? Math.max(0.15, 1 - t / VIGIL_EXIT_SPIN) : 1;
    const glitching = clock < this.glitchUntil;
    ctx.save();
    ctx.translate(this.x + (glitching ? rand(-2, 2) : 0), this.y);
    ctx.rotate(this.beamAngle);
    ctx.scale(VIGIL_SCALE * shrink, VIGIL_SCALE * shrink);
    if (this.state === 'leave' || glitching) ctx.globalAlpha = Math.random() < 0.5 ? 0.45 : 1; // strobe
    ctx.drawImage(this.sprite, -VIGIL_SPRITE_SIZE / 2, -VIGIL_SPRITE_SIZE / 2, VIGIL_SPRITE_SIZE, VIGIL_SPRITE_SIZE);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.35 + this.pulse * 0.65;
    ctx.beginPath();
    ctx.arc(0, 0, 4 + this.pulse * 3 + charge * 5, 0, TAU);
    ctx.fill();
    if (this.hurt > 0) {
      ctx.globalAlpha = this.hurt * 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

//
// Magpie
//
//
// Magpie: a scavenger drone that races you to power-ups, wears them as weapons and drops them when hit
//
const MAGPIE_GREEN = '#1aff1a'; // phosphor green: the brightest hue farthest (OKLab) from every color already in play
const MAGPIE_WHITE = '#eefff0'; // piebald wing bars
const MAGPIE_INK = '#020803';
const MAGPIE_HP = [9, 2, 17]; // first appearance, +per later appearance, max
const MAGPIE_SPEED = [3.2, 0.2, 4.2]; // px/frame: base, +per appearance, max (the ship tops out at 4)
const MAGPIE_GAP = [2400, -150, 1500]; // ms between volleys: base, -per appearance, min
const MAGPIE_DUO_GAP = 1.3; // ...×this when another boss is on screen (and single taps)
const MAGPIE_VOLLEYS = 6; // then it flies off with whatever it's carrying
const MAGPIE_VISIT = 30000; // hard cap on a visit, even if the duo rule keeps it from firing
const MAGPIE_TRACK = 400; // lanes follow you...
const MAGPIE_LOCK = 600; // ...then freeze this long before the first dart
const MAGPIE_TAP_GAP = 140; // ms between the two darts of a double tap
const MAGPIE_FAN = 0.3; // radians between lanes when it wears spread
const MAGPIE_MIN_FIRE = 150; // never starts a volley closer than this
const MAGPIE_ORBIT = 260; // with nothing to steal it circles you at about this range
const MAGPIE_PERSONAL_SPACE = 130;
const MAGPIE_REACH = 300; // entrance: ms for the claw-line to reach a power-up...
const MAGPIE_REEL = 450; // ...to reel it off the field...
const MAGPIE_ZIP = 500; // ...and to zip in wearing it
const MAGPIE_LOOT_MAX = 3;
const MAGPIE_LOOT_LIFE = 6000; // knocked-loose loot drifts this long (it's a lifeline, not free uptime)
const MAGPIE_LOOT_SPEED = 1.4;
const MAGPIE_REGRAB = 1500; // ms it ignores loot it just dropped, so you get a fair race for it
const MAGPIE_GRAB = 30; // grab distance
const MAGPIE_ROPE = 30; // spacing of the trinkets it trails
const MAGPIE_SNATCH_FROM = 2; // appearance number that learns to snatch
const MAGPIE_SNATCH_RANGE = 170;
const MAGPIE_SNATCH_TELL = 700; // claw-line windup; a rock in the way, distance or a hit foils it
const MAGPIE_SNATCH_COOLDOWN = 5000;
const MAGPIE_BUBBLE_HITS = 4; // a worn shield soaks this many bullets (a shield ram pops it outright)
const MAGPIE_BUBBLE_RADIUS = 44;
const MAGPIE_HIT_RADIUS = 28;
const MAGPIE_BODY_RADIUS = 15;
const MAGPIE_POINTS = 2500;
const MAGPIE_SCALE = 1.15; // sprite units → world: wingspan ~70
const MAGPIE_SPRITE_SIZE = 124;
const MAGPIE_DART_SPEED = 3.3; // × difficultySpeed()
const MAGPIE_DART_RADIUS = 6;
const MAGPIE_DART_LIFETIME = 4000;
const MAGPIE_DART_POINTS = 50;
const MAGPIE_DART_SPRITE_SIZE = 34;
let magpieDartSprite = null;

function magpiePath(g) {
  g.beginPath();
  g.moveTo(34, 0);
  g.lineTo(8, -9);
  g.lineTo(-14, -30); // wingtip
  g.lineTo(-10, -11);
  g.lineTo(-22, -4);
  g.lineTo(-52, -9); // long wedge tail, forked
  g.lineTo(-46, 0);
  g.lineTo(-52, 9);
  g.lineTo(-22, 4);
  g.lineTo(-10, 11);
  g.lineTo(-14, 30);
  g.lineTo(8, 9);
  g.closePath();
}

function paintMagpie(g) {
  g.lineJoin = 'round';
  magpiePath(g);
  g.shadowColor = MAGPIE_GREEN;
  g.shadowBlur = 14;
  const body = g.createLinearGradient(34, 0, -52, 0);
  body.addColorStop(0, '#0d2410');
  body.addColorStop(0.5, MAGPIE_INK);
  body.addColorStop(1, '#0a1f2a'); // a blue-green sheen on the tail, like the real bird
  g.fillStyle = body;
  g.fill();
  g.strokeStyle = MAGPIE_GREEN;
  g.lineWidth = 2.4;
  g.stroke();
  g.shadowBlur = 0;
  // White scapular bars: the black-and-white read at half size
  g.fillStyle = MAGPIE_WHITE;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(4, s * 8);
    g.lineTo(-11, s * 25);
    g.lineTo(-8, s * 11);
    g.closePath();
    g.fill();
  }
  // Tail streak
  g.beginPath();
  g.moveTo(-20, 0);
  g.lineTo(-44, 0);
  g.strokeStyle = hexToRgba(MAGPIE_GREEN, 0.55);
  g.lineWidth = 1.6;
  g.stroke();
}

// Tailless chevron dart
function paintMagpieDart(g) {
  g.beginPath();
  g.moveTo(12, 0);
  g.lineTo(-9, -10);
  g.lineTo(-3, 0);
  g.lineTo(-9, 10);
  g.closePath();
  g.lineJoin = 'round';
  g.shadowColor = MAGPIE_GREEN;
  g.shadowBlur = 8;
  g.fillStyle = MAGPIE_GREEN;
  g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.4;
  g.stroke();
}

// A power-up worn on its rack, drawn small
function magpieTrinket(type, x, y) {
  return Object.assign(new PowerUp(type), { x, y, size: 11, opacity: 1 });
}

class Magpie extends Boss {
  static label = 'Magpie';
  static tier = 'easy';
  static colors = [MAGPIE_GREEN, MAGPIE_WHITE];
  static points = MAGPIE_POINTS;
  static hitRadius = MAGPIE_HIT_RADIUS;
  static bodyRadius = MAGPIE_BODY_RADIUS;
  static hp = MAGPIE_HP;

  constructor(n) {
    super(n);
    this.speed = scaled(MAGPIE_SPEED, n);
    this.rack = []; // trinkets; [0] is the one it's wearing (it modifies the volley) and the next to knock loose
    this.bubble = 0; // shield hits left while it wears a shield
    this.volleys = 0;
    this.taps = 0;
    this.aim = 0;
    this.laneOrigin = null;
    this.born = clock;
    this.nextVolley = clock + MAGPIE_REACH + MAGPIE_REEL + MAGPIE_ZIP + 1600;
    this.nextSnatch = clock + MAGPIE_SNATCH_COOLDOWN;
    this.snatchType = null;
    this.snatchIcon = null;
    // Entrance: its claw yanks the power-up nearest an edge off the field. With none around, it brings one.
    const edge = p => Math.min(p.x, W - p.x, p.y, H - p.y);
    this.prize = powerUps.filter(p => !p.dead && p.type !== 'star' && p.opacity > 0.5).sort((a, b) => edge(a) - edge(b))[0] ?? null;
    const from = this.prize ?? { x: rand(120, W - 120), y: rand(120, H - 120) };
    const [d, inward] = [[from.x, 0], [W - from.x, Math.PI], [from.y, Math.PI / 2], [H - from.y, -Math.PI / 2]].sort((a, b) => a[0] - b[0])[0];
    this.angle = inward;
    this.entry = { x: from.x - Math.cos(inward) * d, y: from.y - Math.sin(inward) * d };
    this.prizeFrom = { x: from.x, y: from.y };
    this.x = this.entry.x - Math.cos(inward) * 70; // waits off-screen
    this.y = this.entry.y - Math.sin(inward) * 70;
    this.lastGlint = 0;
    if (this.prize) playSound('power-up-spawn', { rate: 0.7 });
  }

  get wearing() {
    return this.rack[0]?.type;
  }

  get beak() {
    return { x: this.x + Math.cos(this.angle) * 34, y: this.y + Math.sin(this.angle) * 34 };
  }

  get telegraphing() {
    return this.state === 'aim' || this.state === 'snatch';
  }

  get duo() {
    return bosses.some(o => o !== this && !o.dead);
  }

  setState(state) {
    super.setState(state);
    this.taps = 0;
    this.laneOrigin = null;
  }

  // A shield on top of the rack becomes a bubble
  refit() {
    this.bubble = this.wearing === 'shield' ? MAGPIE_BUBBLE_HITS : 0;
  }

  wear(type) {
    this.rack.unshift(magpieTrinket(type, this.x, this.y));
    if (this.rack.length > MAGPIE_LOOT_MAX) this.rack.pop();
    this.refit();
  }

  // Knocked-loose loot is a real power-up again, flung roughly your way, for a short while
  knockLoose(count = 1, toward = Math.atan2(player.y - this.y, player.x - this.x), spread = 1) {
    for (const item of this.rack.splice(0, count)) {
      const p = new PowerUp(item.type);
      const a = toward + rand(-spread, spread);
      Object.assign(p, {
        x: clamp(this.x, 40, W - 40),
        y: clamp(this.y, 40, H - 40),
        velX: Math.cos(a) * MAGPIE_LOOT_SPEED,
        velY: Math.sin(a) * MAGPIE_LOOT_SPEED,
        spawnTime: clock - p.fadeIn,
        lifeTime: p.fadeIn + MAGPIE_LOOT_LIFE,
        magpieSnub: clock + MAGPIE_REGRAB
      });
      powerUps.push(p);
      addParticle({ kind: 'ring', x: this.x, y: this.y, life: 18, size: 40, color: POWER_UP_COLORS[item.type], drag: 1 });
    }
    playSound('power-up', { rate: 1.3, volume: 0.7 });
    this.refit();
    if (!this.rack.length) pointTexts.push(new PointText(this.x, this.y - 34, 'NAKED! ×2', MAGPIE_WHITE, 16));
  }

  update(f) {
    const t = clock - this.stateTime;
    this.hurt = Math.max(0, this.hurt - 0.08 * f);
    if (this.state === 'enter') return this.enter(t);

    // It never takes stars, and grabbing one shakes ALL its loot loose (dead here = collected this frame)
    if (this.rack.length && powerUps.some(p => p.dead && p.type === 'star')) {
      pointTexts.push(new PointText(this.x, this.y - 40, 'DROPPED IT ALL!', POWER_UP_COLORS.star, 18));
      this.knockLoose(this.rack.length, rand(0, TAU), Math.PI);
    }

    let wantX = 0;
    let wantY = 0;
    const toPlayer = Math.atan2(player.y - this.y, player.x - this.x);
    const playerDistance = Math.hypot(player.x - this.x, player.y - this.y);
    const toward = (x, y, speed) => {
      const d = Math.hypot(x - this.x, y - this.y) || 1;
      wantX = ((x - this.x) / d) * speed;
      wantY = ((y - this.y) / d) * speed;
    };

    if (this.state === 'forage') {
      // Races you to power-ups it can reach first, else circles you
      const loot = this.rack.length < MAGPIE_LOOT_MAX && this.nearestLoot();
      if (loot) {
        toward(loot.x, loot.y, this.speed);
        if (Math.hypot(loot.x - this.x, loot.y - this.y) < MAGPIE_GRAB) this.grab(loot);
      } else {
        const a = Math.atan2(this.y - player.y, this.x - player.x) + 0.5;
        toward(player.x + Math.cos(a) * MAGPIE_ORBIT, player.y + Math.sin(a) * MAGPIE_ORBIT, this.speed * 0.8);
      }
      const keepAway = (x, y, radius, strength) => {
        const ax = this.x - x;
        const ay = this.y - y;
        const ad = Math.hypot(ax, ay) || 1;
        if (ad >= radius) return;
        wantX += (ax / ad) * this.speed * strength * (1 - ad / radius);
        wantY += (ay / ad) * this.speed * strength * (1 - ad / radius);
      };
      if (!player.exploded) keepAway(player.x, player.y, MAGPIE_PERSONAL_SPACE, 2.5);
      blackHoles.forEach(bh => keepAway(bh.x, bh.y, bh.gravityRadius * 0.7, 2));
      const wall = (v, max) => (clamp((100 - v) / 50, 0, 2) - clamp((v - max + 100) / 50, 0, 2)) * this.speed;
      wantX += wall(this.x, W);
      wantY += wall(this.y, H);

      const onScreen = this.x > 70 && this.x < W - 70 && this.y > 70 && this.y < H - 70;
      const target = this.snatchTarget();
      if (clock - this.born > MAGPIE_VISIT || (this.volleys >= MAGPIE_VOLLEYS && clock >= this.nextVolley)) {
        this.flee();
      } else if (!isPlaying() || !onScreen || !this.mayTelegraph()) {
        // waits its turn
      } else if (target && clock >= this.nextSnatch && playerDistance < MAGPIE_SNATCH_RANGE) {
        this.setState('snatch');
        this.snatchType = target;
        this.snatchIcon = magpieTrinket(target, 0, 0);
        pointTexts.push(new PointText(player.x, player.y - 46, 'SNATCH!', MAGPIE_GREEN, 16));
        playSound('power-up-spawn', { rate: 1.6, volume: 0.6 });
      } else if (clock >= this.nextVolley && playerDistance > MAGPIE_MIN_FIRE) {
        this.setState('aim');
        playSound('click', { rate: 0.7 });
      }
    } else if (this.state === 'aim') {
      if (t < MAGPIE_TRACK) this.aim = toPlayer;
      else this.laneOrigin ??= this.beak; // lanes freeze here
      this.angle = turnToward(this.angle, this.aim, ease(0.3, f));
      if (t >= MAGPIE_TRACK + MAGPIE_LOCK + this.taps * MAGPIE_TAP_GAP) {
        this.fire();
        if (++this.taps >= (this.duo ? 1 : 2)) this.endVolley();
      }
    } else if (this.state === 'snatch') {
      this.angle = turnToward(this.angle, toPlayer, ease(0.3, f));
      if (t >= MAGPIE_SNATCH_TELL) this.snatch();
    } else if (this.state === 'leave') {
      const a = this.fleeAngle;
      wantX = Math.cos(a) * this.speed * 2.2;
      wantY = Math.sin(a) * this.speed * 2.2;
      if (this.isOffScreen()) this.leave();
    }

    // Swoop: ease toward the wanted velocity (winding up, it hovers) and bank toward where it's going
    const hovering = this.state === 'aim' || this.state === 'snatch';
    const k = ease(hovering ? 0.15 : 0.06, f);
    this.velX += (wantX - this.velX) * k;
    this.velY += (wantY - this.velY) * k;
    this.x += this.velX * f;
    this.y += this.velY * f;
    if (!hovering && Math.hypot(this.velX, this.velY) > 0.3) this.angle = turnToward(this.angle, Math.atan2(this.velY, this.velX), ease(0.15, f));
    this.dragRack(f);
  }

  enter(t) {
    const reel = MAGPIE_REACH + MAGPIE_REEL;
    const p = this.prize;
    if (p) {
      if (p.dead) {
        this.prize = null; // you grabbed it first: it brings its own instead
      } else if (t < MAGPIE_REACH) {
        p.velX = p.velY = 0;
      } else if (t < reel) {
        const u = ((t - MAGPIE_REACH) / MAGPIE_REEL) ** 2;
        p.x = this.prizeFrom.x + (this.entry.x - this.prizeFrom.x) * u;
        p.y = this.prizeFrom.y + (this.entry.y - this.prizeFrom.y) * u;
        p.velX = p.velY = 0;
      } else {
        p.dead = true;
        this.prize = null;
        this.wear(p.type);
        addParticle({ kind: 'ring', x: this.entry.x, y: this.entry.y, life: 18, size: 50, color: POWER_UP_COLORS[p.type], drag: 1 });
      }
      if (this.prize) return;
    }
    if (clock - this.lastGlint > 250) {
      addParticle({ kind: 'ring', x: this.entry.x, y: this.entry.y, life: 24, size: 36, width: 3, color: MAGPIE_GREEN, drag: 1 });
      this.lastGlint = clock;
    }
    if (!this.rack.length) {
      this.wear(pick(Object.keys(POWER_UP_DURATION)));
      this.zipFrom = t + MAGPIE_REACH; // no yank to watch: glint at the edge a moment first
    }
    this.zipFrom ??= t;
    const u = clamp((t - this.zipFrom) / MAGPIE_ZIP, 0, 1);
    const e = 1 - (1 - u) ** 3;
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    this.x = this.entry.x + c * (-70 + 230 * e);
    this.y = this.entry.y + s * (-70 + 230 * e);
    this.dragRack(1);
    if (u >= 1) {
      this.velX = c * this.speed;
      this.velY = s * this.speed;
      this.setState('forage');
    }
  }

  // Trinkets trail on a rigid string from the tail
  dragRack(f) {
    let ax = this.x - Math.cos(this.angle) * 40 * MAGPIE_SCALE;
    let ay = this.y - Math.sin(this.angle) * 40 * MAGPIE_SCALE;
    for (const p of this.rack) {
      // Settles behind it when it hovers, swings out when it turns
      p.x += (ax - Math.cos(this.angle) * MAGPIE_ROPE - p.x) * ease(0.08, f);
      p.y += (ay - Math.sin(this.angle) * MAGPIE_ROPE - p.y) * ease(0.08, f);
      const d = Math.hypot(p.x - ax, p.y - ay) || 1;
      p.x = ax + ((p.x - ax) / d) * MAGPIE_ROPE;
      p.y = ay + ((p.y - ay) / d) * MAGPIE_ROPE;
      p.rotationAngle += 0.04 * f;
      ax = p.x;
      ay = p.y;
    }
  }

  nearestLoot() {
    let best = null;
    let bestD = Infinity;
    for (const p of powerUps) {
      if (p.dead || p.type === 'star' || p.opacity < 0.3 || p.magpieSnub > clock) continue;
      if (Math.hypot(p.x - player.x, p.y - player.y) < MAGPIE_PERSONAL_SPACE) continue; // you're on it: it won't dive at you
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < bestD) [best, bestD] = [p, d];
    }
    return best;
  }

  grab(p) {
    p.dead = true;
    this.wear(p.type);
    pointTexts.push(new PointText(p.x, p.y, 'MINE!', MAGPIE_GREEN, 16));
    addParticle({ kind: 'ring', x: p.x, y: p.y, life: 18, size: 44, color: POWER_UP_COLORS[p.type], drag: 1 });
    playSound('power-up', { rate: 0.8, volume: 0.7 });
  }

  // Your power-up with the most time left, if it can take it
  snatchTarget() {
    if (this.n < MAGPIE_SNATCH_FROM || this.rack.length >= MAGPIE_LOOT_MAX || !isPlaying()) return null;
    const active = Object.keys(POWER_UP_DURATION).filter(hasPowerUp);
    return active.sort((a, b) => player.timers[b] - player.timers[a])[0] ?? null;
  }

  // Where the claw-line lands: the ship (u = 1) or the first rock in the way
  clawLine() {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const lengthSq = dx * dx + dy * dy || 1;
    let u = 1;
    let rock = null;
    for (const a of cover) {
      if (a.dead) continue;
      const t = ((a.x - this.x) * dx + (a.y - this.y) * dy) / lengthSq;
      const off = Math.hypot(a.x - this.x - dx * t, a.y - this.y - dy * t);
      if (t <= 0 || t >= 1 || off >= a.hitRadius) continue;
      const hit = Math.max(0, t - Math.sqrt(a.hitRadius ** 2 - off ** 2) / Math.sqrt(lengthSq));
      if (hit < u) [u, rock] = [hit, a];
    }
    return { u, rock, dx, dy };
  }

  snatch() {
    const { u, rock, dx, dy } = this.clawLine();
    const type = this.snatchType;
    this.nextSnatch = clock + MAGPIE_SNATCH_COOLDOWN;
    this.nextVolley = Math.max(this.nextVolley, clock + 1200); // a breather after it robs you
    this.setState('forage');
    if (rock) {
      const x = this.x + dx * u;
      const y = this.y + dy * u;
      explode(x, y, rock.color, 10, { sparks: 8, ring: false });
      pointTexts.push(new PointText(x, y - 20, 'BLOCKED!', rock.color, 14));
      playSound('bump', { rate: 2, volume: 0.7 });
    } else if (hasPowerUp(type) && isPlaying() && Math.hypot(dx, dy) < MAGPIE_SNATCH_RANGE * 1.35) {
      player.timers[type] = 0;
      this.wear(type);
      const color = POWER_UP_COLORS[type];
      for (let i = 0; i < 10; i++) {
        const k = i / 10;
        addParticle({ kind: 'spark', x: player.x - dx * k, y: player.y - dy * k, vx: -dx * 0.02, vy: -dy * 0.02, life: 14, size: 2, color, drag: 0.9 });
      }
      addParticle({ kind: 'ring', x: player.x, y: player.y, life: 20, size: 50, color, drag: 1 });
      pointTexts.push(new PointText(player.x, player.y - 40, `IT TOOK YOUR ${POWER_UP_LABELS[type]}!`, color, 16));
      playSound('power-up-expire', { rate: 1.4 });
      addShake(4);
    }
  }

  fire() {
    const o = this.laneOrigin ?? this.beak;
    for (const a of this.laneAngles()) enemyShots.push(new MagpieDart(this, o.x, o.y, a));
    addParticle({ kind: 'ring', x: o.x, y: o.y, life: 10, size: 18, color: MAGPIE_GREEN, drag: 1 });
    playSound('shoot', { rate: 1.8, volume: 0.7 });
    this.velX = -Math.cos(this.aim) * 1.5; // recoil
    this.velY = -Math.sin(this.aim) * 1.5;
  }

  laneAngles() {
    const count = this.wearing === 'spread' ? 3 : 1;
    return Array.from({ length: count }, (_, i) => this.aim + (i - (count - 1) / 2) * MAGPIE_FAN);
  }

  endVolley() {
    this.volleys++;
    this.nextVolley = clock + scaled(MAGPIE_GAP, this.n) * (this.duo ? MAGPIE_DUO_GAP : 1);
    this.setState('forage');
  }

  flee() {
    this.setState('leave');
    this.fleeAngle = [[this.x, Math.PI], [W - this.x, 0], [this.y, -Math.PI / 2], [H - this.y, Math.PI / 2]].sort((a, b) => a[0] - b[0])[0][1];
    if (this.rack.length && isPlaying()) {
      const more = this.rack.length > 1 ? ` +${this.rack.length - 1}` : '';
      pointTexts.push(new PointText(this.x, this.y - 40, `IT GOT AWAY WITH ${POWER_UP_LABELS[this.wearing]}${more}!`, MAGPIE_GREEN, 16));
    }
    playSound('power-up-spawn', { rate: 1.3, volume: 0.6 });
  }

  hitBy(b) {
    return b.hits({ x: this.x, y: this.y, hitRadius: this.bubble ? MAGPIE_BUBBLE_RADIUS : MAGPIE_HIT_RADIUS });
  }

  // A worn shield bubble is only rammable by your own shield; otherwise just the body counts
  touches(x, y, r) {
    const radius = this.bubble && hasPowerUp('shield') ? MAGPIE_BUBBLE_RADIUS : MAGPIE_BODY_RADIUS;
    return Math.hypot(x - this.x, y - this.y) < r + radius;
  }

  onHit(damage, { x, y, bullet }) {
    if (this.state === 'snatch') {
      this.nextSnatch = clock + MAGPIE_SNATCH_COOLDOWN; // flinches: the claw-line snaps back
      this.setState('forage');
    }
    if (this.bubble) {
      // Bullets chip the bubble; a ram or a supernova pops it. Either way the shield comes loose at the end.
      this.bubble = bullet ? this.bubble - 1 : 0;
      addCombo();
      addParticle({ kind: 'ring', x, y, life: 10, size: 14, color: POWER_UP_COLORS.shield, drag: 1 });
      if (!this.bubble) {
        explode(this.x, this.y, POWER_UP_COLORS.shield, 30, { sparks: 10 });
        playSound('power-up-expire', { rate: 0.9 });
        this.knockLoose();
      } else {
        playSound('click', { rate: 1.4, volume: 0.6 });
      }
      return 0;
    }
    if (!this.rack.length) return damage * 2; // naked
    if (this.hp <= damage) return damage; // the killing blow: onDeath bursts the whole rack
    this.knockLoose(1, bullet ? Math.atan2(-bullet.velY, -bullet.velX) : undefined); // spat back at the shooter
    return damage;
  }

  // The burst rack is the loot; the usual drop only when it had nothing left
  dropLoot() {
    if (!this.jackpot) super.dropLoot();
  }

  onDeath() {
    if (!this.rack.length) return;
    this.jackpot = true;
    pointTexts.push(new PointText(this.x, this.y - 58, 'JACKPOT!', POWER_UP_COLORS.star, 22));
    this.knockLoose(this.rack.length, rand(0, TAU), Math.PI); // the rack bursts
    playSound('power-up', { rate: 0.8 });
  }

  draw() {
    const t = clock - this.stateTime;
    if (this.state === 'enter') {
      const p = this.prize;
      if (p) {
        const reach = Math.min(1, t / MAGPIE_REACH);
        const { x, y } = this.entry;
        this.drawClaw(x, y, x + (p.x - x) * reach, y + (p.y - y) * reach, reach);
      }
      if (this.zipFrom === undefined) return;
    }
    if (this.state === 'aim') this.drawLanes(t);
    if (this.state === 'snatch') this.drawSnatch(t);
    this.drawRack();

    this.sprite ??= makeSprite(MAGPIE_SPRITE_SIZE, MAGPIE_SCALE, paintMagpie);
    const half = MAGPIE_SPRITE_SIZE / 2;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.scale(MAGPIE_SCALE, MAGPIE_SCALE);
    if (this.bubble) this.drawBubble();
    const flap = this.telegraphing ? 0 : Math.sin(clock * 0.025) * 0.1;
    ctx.save();
    ctx.scale(1, 1 - Math.abs(flap));
    ctx.drawImage(this.sprite, -half, -half, MAGPIE_SPRITE_SIZE, MAGPIE_SPRITE_SIZE);
    if (this.hurt > 0) {
      ctx.globalAlpha = this.hurt * 0.6;
      magpiePath(ctx);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
    // Gem eye: swells while it winds up
    ctx.globalCompositeOperation = 'lighter';
    const charge = this.telegraphing ? Math.min(1, t / (MAGPIE_TRACK + MAGPIE_LOCK)) : 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = MAGPIE_GREEN;
    ctx.beginPath();
    ctx.arc(14, 0, 3.5 + charge * 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(14, 0, 1.6 + charge * 1.5, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (!this.rack.length && this.vulnerable) {
      // Naked: tell the player it's soft now
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(clock * 0.012);
      ctx.font = "700 14px 'Orbitron', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = MAGPIE_WHITE;
      ctx.fillText('×2', this.x, this.y - 40);
      ctx.restore();
    }
  }

  drawBubble() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(clock * 0.002);
    ctx.beginPath();
    ctx.arc(0, 0, MAGPIE_BUBBLE_RADIUS / MAGPIE_SCALE, 0, TAU);
    ctx.fillStyle = hexToRgba(POWER_UP_COLORS.shield, 0.07);
    ctx.fill();
    ctx.setLineDash([10, 8]);
    neon(POWER_UP_COLORS.shield, 2);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < this.bubble; i++) {
      const a = (i / MAGPIE_BUBBLE_HITS) * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * MAGPIE_BUBBLE_RADIUS / MAGPIE_SCALE, Math.sin(a) * MAGPIE_BUBBLE_RADIUS / MAGPIE_SCALE, 2.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawRack() {
    if (!this.rack.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.moveTo(this.x - Math.cos(this.angle) * 40 * MAGPIE_SCALE, this.y - Math.sin(this.angle) * 40 * MAGPIE_SCALE);
    this.rack.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = hexToRgba(MAGPIE_WHITE, 0.45);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    this.rack.forEach((p, i) => {
      p.size = i ? 13 : 17; // the one it wears is bigger
      p.draw();
    });
  }

  // Telegraph: dashes marching out along each lane (open lines, never chevrons: those are the darts)
  drawLanes(t) {
    const o = this.laneOrigin ?? this.beak;
    const locked = t >= MAGPIE_TRACK;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineWidth = locked ? 3 : 2;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -clock * 0.15;
    for (const a of this.laneAngles()) {
      const [x0, y0, x1, y1] = [o.x + Math.cos(a) * 16, o.y + Math.sin(a) * 16, o.x + Math.cos(a) * 340, o.y + Math.sin(a) * 340];
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, hexToRgba(MAGPIE_GREEN, locked ? 0.95 : 0.4));
      grad.addColorStop(1, hexToRgba(MAGPIE_GREEN, 0));
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = grad;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSnatch(t) {
    const { u, rock, dx, dy } = this.clawLine();
    const reach = Math.min(u, t / MAGPIE_SNATCH_TELL);
    this.drawClaw(this.x, this.y, this.x + dx * reach, this.y + dy * reach, t / MAGPIE_SNATCH_TELL);
    if (rock) return;
    // Reticle closing on the ship, with the prize it's after above it
    const close = 1 - t / MAGPIE_SNATCH_TELL;
    const r = 24 + close * 22;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(player.x, player.y);
    ctx.rotate(clock * 0.004);
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(r, -8);
      ctx.lineTo(r + 4, 0);
      ctx.lineTo(r, 8);
      neon(MAGPIE_GREEN, 3);
    }
    ctx.restore();
    Object.assign(this.snatchIcon, { x: player.x, y: player.y - r - 22, size: 18 });
    this.snatchIcon.draw();
  }

  // Claw-line: a dashed tether and a three-prong grabber
  drawClaw(x0, y0, x1, y1, tension) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -clock * 0.1;
    ctx.globalAlpha = 0.5 + 0.5 * clamp(tension, 0, 1);
    neon(MAGPIE_GREEN, 2.5);
    ctx.setLineDash([]);
    ctx.beginPath();
    for (const k of [-0.7, 0, 0.7]) {
      ctx.moveTo(x1 - Math.cos(a) * 4, y1 - Math.sin(a) * 4);
      ctx.lineTo(x1 + Math.cos(a + k) * 10, y1 + Math.sin(a + k) * 10);
    }
    neon(MAGPIE_WHITE, 2);
    ctx.restore();
  }
}

class MagpieDart extends EnemyShot {
  constructor(owner, x, y, angle) {
    super(owner, x, y, angle, MAGPIE_DART_SPEED * difficultySpeed(), {
      radius: MAGPIE_DART_RADIUS,
      color: MAGPIE_GREEN,
      lifetime: MAGPIE_DART_LIFETIME,
      points: MAGPIE_DART_POINTS
    });
  }

  draw() {
    magpieDartSprite ??= makeSprite(MAGPIE_DART_SPRITE_SIZE, 1, paintMagpieDart);
    const half = MAGPIE_DART_SPRITE_SIZE / 2;
    ctx.save();
    ctx.globalAlpha = this.fade;
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.velY, this.velX));
    ctx.drawImage(magpieDartSprite, -half, -half, MAGPIE_DART_SPRITE_SIZE, MAGPIE_DART_SPRITE_SIZE);
    ctx.restore();
  }
}

//
// Duskwing
//
//
// Duskwing: a giant moth that hunts light. Thrust and it sees your flame; coast and it loses you.
//
const DUSKWING_ENTRANCE = 1800; // glitter gathers into a cocoon, then the wings unfold
const DUSKWING_HP = [16, 4, 32]; // first appearance, +per later appearance, max
const DUSKWING_SPEED = [1.8, 0.15]; // base, +per appearance
const DUSKWING_CLAPS = 6; // then it leaves
const DUSKWING_CLAP_GAP = [3600, -250, 2200]; // ms between claps: base, -per appearance, min
const DUSKWING_VISIT = 26000; // ms: it leaves by now even if a partner kept it from clapping
const DUSKWING_FOLD = 700; // wings close and eyespots flare before the clap
const DUSKWING_FOLD_LOCK = 300; // the gap stops following its lure for the fold's last ms
const DUSKWING_MIN_FIRE_DISTANCE = 170; // never folds closer to the ship than this
const DUSKWING_PERSONAL_SPACE = 170; // shies from the ship's body even when it can't see it
const DUSKWING_FLIT_RANGE = 130; // a ship closing faster than 1.5 px/frame inside this makes it dart aside...
const DUSKWING_FLIT_SPEED = 5; // ...this fast...
const DUSKWING_FLIT_COOLDOWN = 500; // ...at most this often (ms)
const DUSKWING_RETHINK = 100; // ms between lure picks
const DUSKWING_STICKY = 1.3; // a new lure must outshine the current one by this much (no dithering)
const DUSKWING_EMBER = 2500; // ms your last flame stays a fading lure after you stop thrusting
const DUSKWING_FRESH_BULLET = 400; // ms a bullet still counts as a light
// Brightness of each lure; it picks the best brightness ÷ distance. A pocket well entrances it outright.
const DUSKWING_LURES = { well: Infinity, hole: 4, flame: 3, powerUp: 2, bullet: 1, ember: 0.5 };
const DUSKWING_ORBIT = { flame: 190, hole: 140, ember: 110, other: 75 }; // circling radius per lure kind
const DUSKWING_SPIRAL = 0.45; // px/frame its orbit tightens around a black hole
const DUSKWING_SCORCH_RADIUS = BLACK_HOLE_CORE_DRAW + 8;
const DUSKWING_SCORCH_POINTS = 1000;
const DUSKWING_DAZZLE_NOVA = 3000; // ms dazzled after a supernova
const DUSKWING_HIT_RADIUS = 44; // vs bullets: body and inner wings
const DUSKWING_BODY_RADIUS = 18; // vs the ship: just the body, so wingtips don't feel cheap
const DUSKWING_POINTS = 4000;
const DUSKWING_FLAKES = [10, 2, 18]; // ring slots per clap...
const DUSKWING_GAP = 1; // ...minus this many facing its lure: a lane that a thrusting ship's flame pulls shut
const DUSKWING_FLAKE_SPEED = 1.6; // × difficultySpeed()
const DUSKWING_FLAKE_HOMING = 0.015; // rad/frame toward a THRUSTING ship, at most...
const DUSKWING_FLAKE_HOMING_FULL = 100; // ...within this distance, fading to 0 at...
const DUSKWING_FLAKE_HOMING_RANGE = 300; // ...this one, so only near misses curl in
const DUSKWING_FLAKE_LIFETIME = 5000;
const DUSKWING_FLAKE_RADIUS = 5;
const DUSKWING_FLAKE_POINTS = 100;
const DUSKWING_INK = '#1a0a24';
const DUSKWING_PEARL = '#ffc4e6';
const DUSKWING_ROSE = '#ff5fa8';
const DUSKWING_ORCHID = '#c77dff';
const DUSKWING_EMBER_COLOR = '#ff9a5c'; // your flame's afterimage: warm, like the exhaust
const DUSKWING_SPRITE_SIZE = 184; // wingspan ~150
const DUSKWING_FLAKE_SPRITE_SIZE = 26;
const DUSKWING_EYESPOT = { x: 45, y: -14 }; // right forewing (mirrored)
let duskwingFlakeSprite = null;

function duskwingDot(g, x, y, r, color) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = color;
  g.fill();
}

// A mote of wing dust
function duskwingGlitter(x, y, vx, vy, life, drag = 0.985) {
  const color = pick([DUSKWING_PEARL, DUSKWING_ROSE, DUSKWING_ORCHID, '#ffffff']);
  addParticle({ x, y, vx, vy, life, size: rand(1.5, 3), color, drag });
}

// Soft white-hot glow (live; a gradient, never shadowBlur)
function duskwingGlow(x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexToRgba('#ffffff', alpha));
  g.addColorStop(0.3, hexToRgba(color, alpha));
  g.addColorStop(1, hexToRgba(color, 0));
  duskwingDot(ctx, x, y, r, g);
}

// Right wings, head up; the left pair is mirrored
function duskwingForewing(g) {
  g.beginPath();
  g.moveTo(5, -10);
  g.bezierCurveTo(24, -28, 52, -38, 76, -34); // costa: a moth's swept, triangular forewing
  g.quadraticCurveTo(83, -32, 78, -24); // blunt hooked tip
  g.bezierCurveTo(70, -10, 58, 6, 44, 14); // outer margin, raked back
  g.bezierCurveTo(30, 14, 14, 8, 5, 2);
  g.closePath();
}

function duskwingHindwing(g) {
  g.beginPath();
  g.moveTo(4, -1);
  g.bezierCurveTo(26, 2, 46, 12, 47, 26);
  g.bezierCurveTo(48, 40, 30, 46, 18, 40);
  g.bezierCurveTo(9, 35, 4, 22, 3, 12);
  g.closePath();
}

// Each wing with the margin points its veins run to (x, y pairs)
const DUSKWING_VEINS = [
  [duskwingHindwing, [44, 18, 42, 32, 28, 42, 16, 38]],
  [duskwingForewing, [75, -31, 72, -20, 62, -4, 50, 10, 34, 12]]
];

// Dusty ink wings: rose under-glow, pearl veins and rim, a scalloped fringe and two hot eyespots
function paintDuskwingWings(g, s) {
  const fine = scaleFactor < 1 ? 1.5 : 1;
  g.lineJoin = g.lineCap = 'round';
  for (const side of [-1, 1]) {
    g.save();
    g.scale(side, 1);
    for (const [wing, veins] of DUSKWING_VEINS) {
      wing(g);
      g.shadowColor = DUSKWING_ROSE;
      g.shadowBlur = 14 * s;
      g.fillStyle = DUSKWING_INK;
      g.fill();
      g.shadowBlur = 0;
      const dust = g.createRadialGradient(0, 0, 4, 0, 0, 80);
      dust.addColorStop(0, '#5a1d52');
      dust.addColorStop(0.45, '#2c0f38');
      dust.addColorStop(1, DUSKWING_INK);
      g.fillStyle = dust;
      g.fill();
      g.save();
      wing(g);
      g.clip();
      // Scale dust: the ordered dither the geodes and Gloomray share
      g.fillStyle = hexToRgba(DUSKWING_ORCHID, 0.22);
      dither(g, 80, scaleFactor < 1 ? 4 : 2.5, (x, y) => 0.75 - Math.hypot(x - 30, y + 2) / 40);
      g.strokeStyle = hexToRgba(DUSKWING_PEARL, 0.45);
      g.lineWidth = 0.8 * fine;
      for (let i = 0; i < veins.length; i += 2) {
        const [x, y] = [veins[i], veins[i + 1]];
        g.beginPath();
        g.moveTo(5, 0);
        g.quadraticCurveTo(x * 0.5, y * 0.5 + 6, x, y);
        g.stroke();
      }
      // Pale submarginal band, then a dashed fringe
      wing(g);
      g.strokeStyle = hexToRgba(DUSKWING_PEARL, 0.14);
      g.lineWidth = 11;
      g.stroke();
      g.setLineDash([2, 3]);
      g.strokeStyle = hexToRgba(DUSKWING_PEARL, 0.5);
      g.lineWidth = 4;
      g.stroke();
      g.setLineDash([]);
      g.restore();
      wing(g);
      g.strokeStyle = DUSKWING_PEARL;
      g.lineWidth = 1.6 * fine;
      g.stroke();
    }
    // Eyespot: hot rose ring, dark iris, pearl glint. At half size the moth reads as a dark X with two rings.
    const { x, y } = DUSKWING_EYESPOT;
    g.shadowColor = DUSKWING_ROSE;
    g.shadowBlur = 10 * s;
    duskwingDot(g, x, y, 10, DUSKWING_ROSE);
    g.shadowBlur = 0;
    duskwingDot(g, x, y, 6.2, '#12030f');
    duskwingDot(g, x - 1.6, y - 1.6, 2.2, DUSKWING_PEARL);
    g.restore();
  }
}

// Furry body and feathered antennae (drawn unsquashed, so only the wings flap)
function paintDuskwingBody(g, s) {
  const fine = scaleFactor < 1 ? 1.5 : 1;
  g.lineJoin = g.lineCap = 'round';
  g.strokeStyle = DUSKWING_PEARL;
  for (const side of [-1, 1]) {
    const p = t => ({ x: side * cubic(3, 5, 14, 25, t), y: cubic(-21, -34, -46, -54, t) });
    g.beginPath();
    for (let t = 0; t <= 1; t += 0.1) g.lineTo(p(t).x, p(t).y);
    g.lineWidth = 1.5 * fine;
    g.stroke();
    g.lineWidth = 0.9 * fine;
    for (let t = 0.15; t < 1; t += 0.075) {
      const a = p(t);
      const b = p(t + 0.05);
      const len = 5.5 * (1 - t) + 2;
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const d = Math.hypot(nx, ny) || 1;
      g.beginPath();
      g.moveTo(a.x - (nx / d) * len, a.y - (ny / d) * len + 1.5);
      g.lineTo(a.x, a.y);
      g.lineTo(a.x + (nx / d) * len, a.y + (ny / d) * len + 1.5);
      g.stroke();
    }
  }
  const fur = (y, rx, ry, top, bottom) => {
    const grad = g.createLinearGradient(-rx, 0, rx, 0);
    grad.addColorStop(0, bottom);
    grad.addColorStop(0.5, top);
    grad.addColorStop(1, bottom);
    g.beginPath();
    g.ellipse(0, y, rx, ry, 0, 0, TAU);
    g.shadowColor = DUSKWING_ROSE;
    g.shadowBlur = 6 * s;
    g.fillStyle = grad;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = hexToRgba(DUSKWING_PEARL, 0.7);
    g.lineWidth = 1 * fine;
    g.stroke();
    // Fur: short pale hairs all around
    g.strokeStyle = hexToRgba(DUSKWING_PEARL, 0.45);
    for (let a = 0; a < TAU; a += 0.35) {
      g.beginPath();
      g.moveTo(Math.cos(a) * rx, y + Math.sin(a) * ry);
      g.lineTo(Math.cos(a) * (rx + 2.5), y + Math.sin(a) * (ry + 2.5));
      g.stroke();
    }
  };
  fur(17, 7.5, 19, '#6a2a62', '#24092c'); // abdomen: a moth is stout, not a butterfly's thread
  fur(-6, 10.5, 11, '#8a3a7c', '#2e0c34'); // thorax
  fur(-18, 5.5, 5, '#6a2a62', '#24092c'); // head
  for (const side of [-1, 1]) duskwingDot(g, side * 3.6, -19.5, 2, '#ffe6f4');
}

// Scale flake: a round rose sequin with a pearl sheen
function paintDuskwingFlake(g, s) {
  const R = DUSKWING_FLAKE_RADIUS + (scaleFactor < 1 ? 2.5 : 1.5); // drawn a touch bigger than it hits, so it reads at half size
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.shadowColor = DUSKWING_ROSE;
  g.shadowBlur = 9 * s;
  const disc = g.createRadialGradient(-1.5, -1.5, 0, 0, 0, R);
  disc.addColorStop(0, '#ffffff');
  disc.addColorStop(0.35, DUSKWING_PEARL);
  disc.addColorStop(1, DUSKWING_ROSE);
  g.fillStyle = disc;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 1.4;
  g.strokeStyle = DUSKWING_ROSE;
  g.stroke();
  g.beginPath();
  g.arc(0, 0, R * 0.55, 0.3, Math.PI - 0.3); // a ridge, so it reads as a scale, not a dot
  g.strokeStyle = hexToRgba('#9c1f63', 0.8);
  g.lineWidth = 1;
  g.stroke();
}

class Duskwing extends Boss {
  static label = 'Duskwing';
  static tier = 'medium';
  static colors = [DUSKWING_PEARL, DUSKWING_ROSE, DUSKWING_ORCHID];
  static points = DUSKWING_POINTS;
  static hitRadius = DUSKWING_HIT_RADIUS;
  static bodyRadius = DUSKWING_BODY_RADIUS;
  static hp = DUSKWING_HP;

  constructor(n) {
    super(n);
    // The cocoon forms a little way in from an edge, well away from the ship
    let spawn;
    for (let i = 0; i < 12; i++) {
      spawn = edgeSpawn();
      const d = rand(150, 240);
      this.x = clamp(spawn.x + Math.cos(spawn.angle) * d, 120, W - 120);
      this.y = clamp(spawn.y + Math.sin(spawn.angle) * d, 120, H - 120);
      if (Math.hypot(this.x - player.x, this.y - player.y) > 280) break;
    }
    this.edge = { x: clamp(spawn.x, 0, W), y: clamp(spawn.y, 0, H) };
    this.angle = -Math.PI / 2;
    this.speed = DUSKWING_SPEED[0] + DUSKWING_SPEED[1] * (n - 1);
    // States: enter → fight ⇄ fold → leave
    this.arrived = clock;
    this.claps = 0;
    this.nextClap = clock + DUSKWING_ENTRANCE + 1500;
    this.clapAt = -Infinity;
    this.aim = 0;
    this.lure = null; // { kind, ref, weight }; ref has x, y
    this.nextThink = 0;
    this.orbit = 0;
    this.orbitDir = pick([-1, 1]);
    this.wander = { x: this.x, y: this.y };
    this.ember = null; // where it last saw your flame
    this.circling = false;
    this.flitAt = -Infinity;
    this.dazzledUntil = 0;
    this.taught = n > 1; // "IT SEES YOUR FLAME" only on its first visit in a run
    playSound('asteroid-spawn', { rate: 0.6 });
  }

  get telegraphing() {
    return this.state === 'fold';
  }

  get dazzled() {
    return this.circling || clock < this.dazzledUntil;
  }

  get charge() {
    return this.state === 'fold' ? clamp((clock - this.stateTime) / DUSKWING_FOLD, 0, 1) : 0;
  }

  get head() {
    return { x: this.x + Math.cos(this.angle) * 22, y: this.y + Math.sin(this.angle) * 22 };
  }

  // Every light it can see right now, with its brightness
  lures() {
    const out = [];
    const add = (kind, ref, weight = DUSKWING_LURES[kind]) => out.push({ kind, ref, weight });
    if (player.well && hasPowerUp('well')) add('well', player.well);
    blackHoles.forEach(bh => bh.opacity > 0.5 && add('hole', bh));
    if (isPlaying() && player.isThrusting) add('flame', player);
    else if (this.ember)
      add('ember', this.ember, DUSKWING_LURES.ember * (1 - (clock - this.ember.time) / DUSKWING_EMBER));
    powerUps.forEach(p => !p.dead && add('powerUp', p));
    bullets.forEach(b => clock - b.born < DUSKWING_FRESH_BULLET && add('bullet', b));
    return out.filter(l => l.weight > 0);
  }

  pickLure() {
    const shine = l => l.weight / Math.max(60, Math.hypot(l.ref.x - this.x, l.ref.y - this.y));
    const all = this.lures();
    const current = all.find(l => l.ref === this.lure?.ref);
    let best = current ?? null;
    for (const l of all) if (shine(l) > (best ? shine(best) * (best === current ? DUSKWING_STICKY : 1) : 0)) best = l;
    if (best?.ref !== this.lure?.ref) {
      this.orbit = Math.hypot(best ? best.ref.x - this.x : 0, best ? best.ref.y - this.y : 0);
      if (best?.kind === 'flame' && !this.taught) {
        this.taught = true;
        pointTexts.push(new PointText(this.x, this.y - 50, 'IT SEES YOUR FLAME', DUSKWING_ROSE, 18));
      }
    }
    this.lure = best;
  }

  update(f) {
    const t = clock - this.stateTime;
    this.hurt = Math.max(0, this.hurt - 0.08 * f);
    if (isPlaying() && player.isThrusting) this.ember = { x: player.x, y: player.y, time: clock };
    else if (this.ember && clock - this.ember.time > DUSKWING_EMBER) this.ember = null;

    if (this.state === 'enter') {
      // Glitter trickles in from the edge and gathers into a cocoon
      if (t < DUSKWING_ENTRANCE * 0.7 && Math.random() < 0.9 * f) {
        const life = rand(30, 45);
        const x = this.edge.x + rand(-40, 40);
        const y = this.edge.y + rand(-40, 40);
        duskwingGlitter(x, y, (this.x - x) / life, (this.y - y) / life, life, 1);
      }
      if (t > DUSKWING_ENTRANCE) {
        this.setState('fight');
        addParticle({
          kind: 'ring',
          x: this.x,
          y: this.y,
          life: 24,
          size: 90,
          width: 3,
          color: DUSKWING_PEARL,
          drag: 1
        });
        playSound('power-up-spawn', { rate: 1.4, volume: 0.5 });
      }
      return;
    }

    if (clock >= this.nextThink || (this.lure && !this.lures().some(l => l.ref === this.lure.ref))) {
      this.pickLure();
      this.nextThink = clock + DUSKWING_RETHINK;
    }
    const lure = this.lure;
    const target = lure?.ref ?? this.wander;
    const dx = this.x - target.x;
    const dy = this.y - target.y;
    const d = Math.hypot(dx, dy) || 1;
    if (!lure && d < 60) this.wander = { x: rand(140, W - 140), y: rand(140, H - 140) };

    let wantX = 0;
    let wantY = 0;
    if (this.state === 'fight') {
      // Circle the light: hold the orbit radius and swing around it. Around a black hole the orbit tightens.
      const radius = lure ? (DUSKWING_ORBIT[lure.kind] ?? DUSKWING_ORBIT.other) : 40;
      this.orbit = lure?.kind === 'hole' ? Math.max(0, Math.min(this.orbit, d) - DUSKWING_SPIRAL * f) : radius;
      const inward = clamp((d - this.orbit) / 50, -1, 1) * (d > this.orbit + 150 ? 1.4 : 1);
      wantX = (-dx / d) * inward * this.speed + (-dy / d) * this.orbitDir * this.speed;
      wantY = (-dy / d) * inward * this.speed + (dx / d) * this.orbitDir * this.speed;
      // Moth flight: it zigzags instead of gliding
      const zig = Math.sin(clock * 0.006 + this.n) * 0.8;
      [wantX, wantY] = [wantX * Math.cos(zig) - wantY * Math.sin(zig), wantX * Math.sin(zig) + wantY * Math.cos(zig)];
      if (lure?.kind !== 'hole') {
        const wall = (v, max) => (clamp((100 - v) / 50, 0, 2) - clamp((v - max + 100) / 50, 0, 2)) * this.speed;
        wantX += wall(this.x, W);
        wantY += wall(this.y, H);
      }

      const hole = lure?.kind === 'hole' && lure.ref;
      if (hole && d < DUSKWING_SCORCH_RADIUS && hole.canCollide() && isPlaying()) return this.scorch();
      this.circling = !!lure && lure.kind !== 'flame' && lure.kind !== 'bullet' && d < this.orbit + 60;

      const far = Math.hypot(player.x - this.x, player.y - this.y) > DUSKWING_MIN_FIRE_DISTANCE;
      const onScreen = this.x > 70 && this.x < W - 70 && this.y > 70 && this.y < H - 70;
      if ((this.claps >= DUSKWING_CLAPS && clock >= this.nextClap) || clock - this.arrived > DUSKWING_VISIT) {
        this.setState('leave');
        playSound('asteroid-spawn', { rate: 0.5, volume: 0.6 });
      } else if (clock >= this.nextClap && isPlaying() && far && onScreen && this.mayTelegraph()) {
        this.setState('fold');
        playSound('power-up-spawn', { rate: 0.7 });
      }
    } else if (this.state === 'fold') {
      if (t < DUSKWING_FOLD - DUSKWING_FOLD_LOCK) this.aim = Math.atan2(-dy, -dx);
      if (t >= DUSKWING_FOLD) this.clap();
    } else if (this.state === 'leave') {
      // Rises off the top, shedding glitter
      this.circling = false;
      wantY = -this.speed * 2.2;
      if (Math.random() < 0.6 * f) {
        duskwingGlitter(this.x + rand(-50, 50), this.y + rand(-10, 30), rand(-0.3, 0.3), rand(0.2, 0.8), rand(30, 60));
      }
      if (this.isOffScreen()) this.leave();
    }

    // It shies from the ship's body even when it can't see it (fight and leave alike)
    if (this.state !== 'fold' && !player.exploded) {
      const ax = this.x - player.x;
      const ay = this.y - player.y;
      const ad = Math.hypot(ax, ay) || 1;
      if (ad < DUSKWING_PERSONAL_SPACE) {
        wantX += (ax / ad) * this.speed * 4 * (1 - ad / DUSKWING_PERSONAL_SPACE);
        wantY += (ay / ad) * this.speed * 4 * (1 - ad / DUSKWING_PERSONAL_SPACE);
      }
      // Startled: a ship bearing down makes it flit sideways, out of the ship's path
      const closing = -(ax * player.velX + ay * player.velY) / ad;
      if (ad < DUSKWING_FLIT_RANGE && closing > 1.5 && clock - this.flitAt > DUSKWING_FLIT_COOLDOWN) {
        const side = Math.sign(ax * player.velY - ay * player.velX) || 1;
        const v = Math.hypot(player.velX, player.velY);
        this.velX = (-player.velY / v) * side * DUSKWING_FLIT_SPEED;
        this.velY = (player.velX / v) * side * DUSKWING_FLIT_SPEED;
        this.flitAt = clock;
      }
    }

    const k = ease(this.state === 'fold' ? 0.15 : 0.1, f);
    this.velX += (wantX - this.velX) * k + rand(-0.2, 0.2) * f; // jittery, like a real moth
    this.velY += (wantY - this.velY) * k + rand(-0.2, 0.2) * f;
    this.x += this.velX * f;
    this.y += this.velY * f;
    // It always faces its light
    const face =
      lure && this.state !== 'leave'
        ? Math.atan2(-dy, -dx)
        : this.state === 'leave'
          ? -Math.PI / 2
          : Math.atan2(this.velY, this.velX);
    this.angle = turnToward(this.angle, face, ease(0.12, f));
  }

  clap() {
    const slots = scaled(DUSKWING_FLAKES, this.n);
    const speed = DUSKWING_FLAKE_SPEED * difficultySpeed();
    // Slot 0 points at its lure; it never sheds toward its light, so the gap is the slots around it
    for (let i = 0; i < slots; i++) {
      const fromAim = Math.min(i, slots - i);
      if (fromAim <= (DUSKWING_GAP - 1) / 2) continue;
      const a = this.aim + (i / slots) * TAU;
      enemyShots.push(new DuskwingFlake(this, this.x + Math.cos(a) * 26, this.y + Math.sin(a) * 26, a, speed));
    }
    this.claps++;
    this.clapAt = clock;
    this.nextClap = clock + scaled(DUSKWING_CLAP_GAP, this.n);
    this.setState('fight');
    addParticle({ kind: 'ring', x: this.x, y: this.y, life: 18, size: 60, width: 4, color: DUSKWING_ROSE, drag: 1 });
    addShake(3);
    playSound('bump', { rate: 0.4 });
  }

  // Lured into a black hole's core: badly burned, and it flees
  scorch() {
    const bh = this.lure.ref;
    score += DUSKWING_SCORCH_POINTS;
    updateHighScore();
    pointTexts.push(new PointText(this.x, this.y - 40, `SCORCHED! +${DUSKWING_SCORCH_POINTS}`, '#ff6a00', 20));
    explode(this.x, this.y, '#ff6a00', 50, { sparks: 24 });
    playSound('black-hole-destroy');
    this.velX = (this.x - bh.x) * 0.1;
    this.velY = -4;
    this.hit(Math.ceil(this.maxHp * 0.5), { scorch: true });
    if (!this.dead) this.setState('leave');
  }

  onHit(damage, { bullet, scorch }) {
    if (scorch) return damage;
    if (!bullet && clock !== this.lastRam) this.dazzledUntil = clock + DUSKWING_DAZZLE_NOVA; // a supernova blinds it
    return this.dazzled ? damage * 2 : damage; // spellbound by another light, it's wide open
  }

  die(trick) {
    const flame = this.dazzled;
    super.die(trick || flame); // MOTH TO FLAME: a kill while it's dazzled pays double
    if (flame) pointTexts.push(new PointText(this.x, this.y - 60, 'MOTH TO FLAME!', DUSKWING_ROSE, 20));
  }

  // The wings tear into drifting rose dust
  onDeath() {
    for (let i = 0; i < 80; i++) {
      const side = i % 2 ? 1 : -1;
      const lx = side * rand(8, 72);
      const ly = rand(-40, 46) * (1 - Math.abs(lx) / 110);
      const c = Math.cos(this.angle + Math.PI / 2);
      const s = Math.sin(this.angle + Math.PI / 2);
      const x = this.x + lx * c - ly * s;
      const y = this.y + lx * s + ly * c;
      duskwingGlitter(
        x,
        y,
        (x - this.x) * 0.02 + rand(-0.4, 0.4),
        (y - this.y) * 0.02 + rand(-0.6, 0.2),
        rand(60, 140)
      );
    }
  }

  // On the floor: the afterimage of your flame while it hunts it
  drawBehind() {
    const e = this.lure?.kind === 'ember' && this.ember;
    if (!e) return;
    const fade = 1 - (clock - e.time) / DUSKWING_EMBER;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade * (0.6 + 0.4 * Math.sin(clock * 0.03));
    duskwingGlow(e.x, e.y, 22, DUSKWING_EMBER_COLOR);
    ctx.beginPath();
    ctx.arc(e.x, e.y, 14 + Math.sin(clock * 0.008) * 4, 0, TAU);
    ctx.setLineDash([3, 5]);
    neon(DUSKWING_EMBER_COLOR, 1.5); // a dotted ring: "it thinks you're here"
    ctx.restore();
  }

  draw() {
    const t = clock - this.stateTime;
    const wingSize = DUSKWING_SPRITE_SIZE;
    this.sprite ??= {
      wings: makeSprite(wingSize, 1, paintDuskwingWings),
      body: makeSprite(wingSize, 1, paintDuskwingBody)
    };
    ctx.save();

    if (this.state === 'enter') {
      // A sparkling cocoon swells, then splits and the wings unfold
      const k = t / DUSKWING_ENTRANCE;
      const grow = clamp((k - 0.25) / 0.45, 0, 1);
      const unfold = clamp((k - 0.7) / 0.3, 0, 1);
      ctx.translate(this.x, this.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = grow * (1 - unfold * 0.7);
      ctx.save();
      ctx.scale(0.45, 1);
      duskwingGlow(0, 0, 14 + grow * 20, DUSKWING_PEARL);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      if (unfold > 0) {
        ctx.globalAlpha = unfold;
        ctx.drawImage(this.sprite.body, -wingSize / 2, -wingSize / 2, wingSize, wingSize);
        ctx.scale(unfold * unfold, 1);
        ctx.drawImage(this.sprite.wings, -wingSize / 2, -wingSize / 2, wingSize, wingSize);
      }
      ctx.restore();
      return;
    }

    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    // Attention thread: dashes march from its antennae to whatever light it's chasing
    if (this.lure && this.state !== 'leave') {
      const h = this.head;
      const { x, y } = this.lure.ref;
      ctx.setLineDash([3, 9]);
      ctx.lineDashOffset = -clock * 0.04;
      ctx.lineWidth = 2;
      ctx.strokeStyle = hexToRgba(DUSKWING_PEARL, this.lure.kind === 'flame' ? 0.6 : 0.35);
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Fold telegraph: a ring contracts onto it while dotted spokes show every flake's lane (and the gap)
    const charge = this.charge;
    if (charge > 0) {
      const slots = scaled(DUSKWING_FLAKES, this.n);
      ctx.globalAlpha = 0.25 + charge * 0.6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 30 + (1 - charge) * 130, 0, TAU);
      neon(DUSKWING_ROSE, 2);
      ctx.setLineDash([2, 8]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = DUSKWING_ROSE;
      ctx.beginPath();
      for (let i = 0; i < slots; i++) {
        if (Math.min(i, slots - i) <= (DUSKWING_GAP - 1) / 2) continue;
        const a = this.aim + (i / slots) * TAU;
        ctx.moveTo(this.x + Math.cos(a) * 34, this.y + Math.sin(a) * 34);
        ctx.lineTo(this.x + Math.cos(a) * (34 + 190 * charge), this.y + Math.sin(a) * (34 + 190 * charge));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);

    // Wings: a fast flutter, folded shut over the back during the fold, flung wide on the clap
    const flutter = 0.62 + 0.38 * Math.abs(Math.cos(clock * 0.013));
    const snap = clamp(1 - (clock - this.clapAt) / 250, 0, 1);
    const shut = charge * charge; // closing speeds up into the clap
    const open = charge > 0 ? 0.62 * (1 - shut) + 0.12 * shut : flutter + snap * 0.35;
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.scale(open, 1);
    ctx.drawImage(this.sprite.wings, -wingSize / 2, -wingSize / 2, wingSize, wingSize);
    ctx.globalCompositeOperation = 'lighter';
    // Eyespots flare as the wings close
    const eye = charge > 0 ? charge : this.dazzled ? 0 : 0.25 + 0.15 * Math.sin(clock * 0.005);
    for (const side of [-1, 1])
      duskwingGlow(side * DUSKWING_EYESPOT.x, DUSKWING_EYESPOT.y, 8 + eye * 18, DUSKWING_ROSE, eye);
    if (this.hurt > 0) {
      ctx.globalAlpha = this.hurt; // hit flash: the wings again, added on top
      ctx.drawImage(this.sprite.wings, -wingSize / 2, -wingSize / 2, wingSize, wingSize);
    }
    ctx.restore();
    ctx.drawImage(this.sprite.body, -wingSize / 2, -wingSize / 2, wingSize, wingSize);
    // Dazzled: a halo of glitter spins over its head, a cue that it's wide open
    if (this.dazzled) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const a = clock * 0.007 + (i * TAU) / 5;
        ctx.globalAlpha = 0.65 + 0.35 * Math.sin(clock * 0.02 + i);
        duskwingGlow(Math.cos(a) * 30, -34 + Math.sin(a) * 10, 7, i % 2 ? DUSKWING_ROSE : DUSKWING_PEARL);
      }
    }
    ctx.restore();
  }
}

class DuskwingFlake extends EnemyShot {
  constructor(owner, x, y, angle, speed) {
    super(owner, x, y, angle, speed, {
      radius: DUSKWING_FLAKE_RADIUS,
      color: DUSKWING_ROSE,
      lifetime: DUSKWING_FLAKE_LIFETIME,
      points: DUSKWING_FLAKE_POINTS,
      maxSpeed: 3.5
    });
    this.spin = rand(0, TAU);
  }

  // Flakes lean toward light too, but only a thrusting ship's flame, and only up close: coast and they sail by
  move(f) {
    const d = Math.hypot(player.x - this.x, player.y - this.y);
    if (isPlaying() && player.isThrusting && d < DUSKWING_FLAKE_HOMING_RANGE) {
      const heading = Math.atan2(this.velY, this.velX);
      const speed = Math.hypot(this.velX, this.velY);
      const max =
        DUSKWING_FLAKE_HOMING *
        clamp((DUSKWING_FLAKE_HOMING_RANGE - d) / (DUSKWING_FLAKE_HOMING_RANGE - DUSKWING_FLAKE_HOMING_FULL), 0, 1) *
        f;
      const a = turnToward(heading, Math.atan2(player.y - this.y, player.x - this.x), 1);
      const turned = heading + clamp(a - heading, -max, max);
      this.velX = Math.cos(turned) * speed;
      this.velY = Math.sin(turned) * speed;
    }
    super.move(f);
  }

  draw() {
    duskwingFlakeSprite ??= makeSprite(DUSKWING_FLAKE_SPRITE_SIZE, 1, paintDuskwingFlake);
    const size = DUSKWING_FLAKE_SPRITE_SIZE;
    const flip = Math.cos(this.spin + this.age * 0.006); // tumbles like a sequin, flashing as it turns face-on
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    ctx.globalAlpha = this.fade;
    ctx.scale(1, 0.35 + 0.65 * Math.abs(flip));
    ctx.drawImage(duskwingFlakeSprite, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

//
// Parhelion
//
//
// Parhelion: a floating ice-crystal lens (a "sun dog"). Its mirror arc catches your plain shots and fires them
// back as glass shards. Flank it to hit the dark glass, or bend/bank a trick shot in for ×3 from any side.
//
const PARHELION_ENTRANCE = 1800; // lens-flare sweep, edge glint, then the crystal unfolds
const PARHELION_GLINT = [700, 1100]; // ms into the entrance: the edge glint grows, then the crystal unfolds
const PARHELION_HP = [8, 2, 16];
const PARHELION_TURN = [0.016, 0.003, 0.028]; // rad/frame the mirror turns toward you: ~break-even with a ship circling at 250px
const PARHELION_MIRROR_HALF = 1.22; // rad: a 140° mirror arc
const PARHELION_CRACK_SHRINK = (7.5 * Math.PI) / 180; // per side per CRACK: the arc loses 15°
const PARHELION_HEX_R = 38; // the glass plate
const PARHELION_MIRROR_MIN_HALF = 0.35;
const PARHELION_MIRROR_R = 56; // mirror arc radius: shots from the mirror side meet it here
const PARHELION_HIT_RADIUS = 40; // dark glass vs shots from the back
const PARHELION_BODY_RADIUS = 30; // vs the ship
const PARHELION_SPEED = 1.1; // drift, px/frame
const PARHELION_PERSONAL_SPACE = 240;
const PARHELION_MIN_FIRE_DISTANCE = 160;
const PARHELION_RETURN_GAP = 3200; // ms between returns
const PARHELION_TRACK = 400; // flare: lanes follow you...
const PARHELION_LOCK = 600; // ...then freeze this long before the return
const PARHELION_DAZZLE = 1200; // ms the mirror stays frozen after a return: the flanking window
const PARHELION_RETURNS = 5; // then it leaves...
const PARHELION_VISIT = 28000; // ...or after this long
const PARHELION_BASE_SHARDS = 2;
const PARHELION_MAX_SHARDS = [9, 6]; // solo, duo
const PARHELION_TRICK_MULTIPLIER = 3;
const PARHELION_POINTS = 4000;
const PARHELION_RAM_DAMAGE = 3;
const PARHELION_PEARL = '#f4f6ff';
const PARHELION_RED = '#ff5c7a'; // spectral fringe: halos are red inside, blue outside
const PARHELION_BLUE = '#5c8dff';
const PARHELION_SPRITE_SIZE = 140;
const PARHELION_SHARD_SPEED = 3.4; // × difficultySpeed()
const PARHELION_SHARD_SPREAD = 0.15; // rad between lanes
const PARHELION_SHARD_RADIUS = 6;
const PARHELION_SHARD_LIFETIME = 5000;
const PARHELION_SHARD_POINTS = 100;
const PARHELION_SHARD_SPRITE_SIZE = 40;
let parhelionShardSprite = null;

const parhelionDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function parhelionHex(g, r, turn = 0) {
  g.beginPath();
  for (let i = 0; i < 6; i++) g.lineTo(Math.cos(turn + (i * TAU) / 6) * r, Math.sin(turn + (i * TAU) / 6) * r);
  g.closePath();
}

// The crystal: a hexagonal ice plate in dark glass, with a spectral fringe and a white-hot "sun" at its heart
function paintParhelion(g, s) {
  const fine = scaleFactor < 1 ? 1.5 : 1;
  g.lineJoin = 'round';
  // The faint full halo: shows where the mirror ISN'T
  g.beginPath();
  g.arc(0, 0, PARHELION_MIRROR_R, 0, TAU);
  g.strokeStyle = hexToRgba(PARHELION_PEARL, 0.16);
  g.lineWidth = 1.5 * fine;
  g.stroke();

  parhelionHex(g, PARHELION_HEX_R);
  g.shadowColor = PARHELION_BLUE;
  g.shadowBlur = 18 * s;
  const glass = g.createRadialGradient(0, 0, 0, 0, 0, PARHELION_HEX_R);
  glass.addColorStop(0, '#3a4590');
  glass.addColorStop(0.45, '#161c44');
  glass.addColorStop(1, '#070918');
  g.fillStyle = glass;
  g.fill();
  g.shadowBlur = 0;

  // Facets
  g.strokeStyle = hexToRgba(PARHELION_PEARL, 0.22);
  g.lineWidth = 0.8 * fine;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos((i * TAU) / 6) * PARHELION_HEX_R, Math.sin((i * TAU) / 6) * PARHELION_HEX_R);
    g.stroke();
  }
  parhelionHex(g, 18, Math.PI / 6);
  g.strokeStyle = hexToRgba(PARHELION_PEARL, 0.4);
  g.stroke();

  // Spectral fringe, then the pearl edge
  g.globalCompositeOperation = 'lighter';
  g.lineWidth = 2 * fine;
  for (const [color, dx] of [[PARHELION_RED, -1.6], [PARHELION_BLUE, 1.6]]) {
    g.save();
    g.translate(dx, 0);
    parhelionHex(g, PARHELION_HEX_R);
    g.strokeStyle = hexToRgba(color, 0.7);
    g.stroke();
    g.restore();
  }
  parhelionHex(g, PARHELION_HEX_R);
  g.strokeStyle = PARHELION_PEARL;
  g.lineWidth = 1.6 * fine;
  g.stroke();

  const sun = g.createRadialGradient(0, 0, 0, 0, 0, 13);
  sun.addColorStop(0, '#ffffff');
  sun.addColorStop(0.35, hexToRgba(PARHELION_PEARL, 0.7));
  sun.addColorStop(1, hexToRgba(PARHELION_BLUE, 0));
  g.fillStyle = sun;
  g.fillRect(-13, -13, 26, 26);
}

// A glass shard: a long white rhombus with red/blue chromatic edges. Nothing else in the game is white.
function paintParhelionShard(g, s) {
  const rhombus = dy => {
    g.beginPath();
    g.moveTo(17, dy);
    g.lineTo(0, 5.5 + dy);
    g.lineTo(-17, dy);
    g.lineTo(0, -5.5 + dy);
    g.closePath();
  };
  g.globalCompositeOperation = 'lighter';
  for (const [color, dy] of [[PARHELION_RED, -1.6], [PARHELION_BLUE, 1.6]]) {
    rhombus(dy);
    g.fillStyle = hexToRgba(color, 0.8);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  rhombus(0);
  g.shadowColor = '#ffffff';
  g.shadowBlur = 8 * s;
  g.fillStyle = '#e9eeff';
  g.fill();
  g.shadowBlur = 0;
  g.beginPath();
  g.moveTo(15, 0);
  g.lineTo(-15, 0);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.4;
  g.stroke();
}

class Parhelion extends Boss {
  static label = 'Parhelion';
  static tier = 'medium';
  static colors = [PARHELION_PEARL, PARHELION_BLUE, PARHELION_RED];
  static points = PARHELION_POINTS;
  static hitRadius = PARHELION_MIRROR_R;
  static bodyRadius = PARHELION_BODY_RADIUS;
  static hp = PARHELION_HP;
  static ramDamage = PARHELION_RAM_DAMAGE;

  constructor(n) {
    super(n);
    // Enter from the edge point farthest-ish from the ship, so it never unfolds on top of you
    let spawn = edgeSpawn();
    for (let i = 0; i < 8 && Math.hypot(spawn.x - player.x, spawn.y - player.y) < 320; i++) spawn = edgeSpawn();
    this.x = clamp(spawn.x, 80, W - 80);
    this.y = clamp(spawn.y, 80, H - 80);
    this.foldAngle = spawn.angle; // unfolds (and later folds) along this axis
    this.angle = Math.atan2(player.y - this.y, player.x - this.x); // mirror facing
    this.spin = rand(0, TAU);
    this.arrived = clock;
    this.turnRate = scaled(PARHELION_TURN, n);
    this.mirrorHalf = PARHELION_MIRROR_HALF;
    this.pips = 0; // caught shots, loaded as extra shards
    this.cracks = [];
    this.returns = 0;
    this.nextFlare = clock + PARHELION_ENTRANCE + 2000;
    this.dazzledUntil = 0;
    this.volley = null; // shard count, frozen when the lanes lock
    this.charge = 0;
    this.lastCatch = { born: -1, text: -Infinity };
    this.taught = false; // "CAUGHT: FLANK IT" shows once, on its first visit
    this.waypoint = this.pickWaypoint();
    playSound('power-up', { rate: 0.6 });
  }

  get maxShards() {
    return PARHELION_MAX_SHARDS[bosses.length > 1 ? 1 : 0];
  }

  get loaded() {
    return Math.min(this.maxShards, PARHELION_BASE_SHARDS + this.pips);
  }

  get locked() {
    return this.state === 'flare' && clock - this.stateTime >= PARHELION_TRACK;
  }

  get telegraphing() {
    return this.state === 'flare';
  }

  get muzzle() {
    return { x: this.x + Math.cos(this.angle) * PARHELION_MIRROR_R, y: this.y + Math.sin(this.angle) * PARHELION_MIRROR_R };
  }

  // 1 = face-on, ~0 = edge-on (the entrance unfold and the exit)
  get fold() {
    const t = clock - this.stateTime;
    if (this.state === 'enter') return clamp((t - PARHELION_GLINT[1]) / (PARHELION_ENTRANCE - PARHELION_GLINT[1]), 0, 1) ** 2;
    if (this.state === 'leave') return Math.max(0.05, 1 - t / 400);
    return 1;
  }

  pickWaypoint(x = rand(120, W - 120), y = rand(120, H - 120)) {
    for (let i = 0; i < 8 && Math.hypot(x - player.x, y - player.y) < PARHELION_PERSONAL_SPACE * 1.2; i++) {
      x = rand(120, W - 120);
      y = rand(120, H - 120);
    }
    return { x, y };
  }

  // Did this bullet come at it from the mirror side?
  facesMirror(b) {
    return Math.abs(parhelionDiff(Math.atan2(b.prevY - this.y, b.prevX - this.x), this.angle)) < this.mirrorHalf;
  }

  hitBy(b) {
    return b.hits({ x: this.x, y: this.y, hitRadius: this.facesMirror(b) ? PARHELION_MIRROR_R : PARHELION_HIT_RADIUS });
  }

  onHit(damage, { trick, bullet }) {
    const mirror = bullet && this.facesMirror(bullet);
    if (trick) {
      if (mirror) this.crack(bullet);
      pointTexts.push(new PointText(this.x, this.y - 50, mirror ? 'CRACK! ×3' : 'TRICK ×3', POWER_UP_COLORS.ricochet, 15));
      return damage * PARHELION_TRICK_MULTIPLIER;
    }
    if (mirror) return this.catch(bullet);
    return damage;
  }

  // A plain shot hits the mirror: it's eaten (no combo cost, not a miss) and loaded as a shard
  catch(b) {
    b.hit = true; // lances too
    b.scored = true;
    if (b.born !== this.lastCatch.born && this.pips < this.maxShards - PARHELION_BASE_SHARDS) this.pips++; // one pip per volley, even with spread
    this.lastCatch.born = b.born;
    const a = Math.atan2(b.prevY - this.y, b.prevX - this.x);
    const x = this.x + Math.cos(a) * PARHELION_MIRROR_R;
    const y = this.y + Math.sin(a) * PARHELION_MIRROR_R;
    addParticle({ kind: 'ring', x, y, life: 14, size: 18, color: PARHELION_PEARL, drag: 1 });
    addParticle({ x, y, life: 8, size: 6, color: '#ffffff', drag: 1 });
    playSound('click', { rate: 2, volume: 0.7 });
    if (this.n === 1 && !this.taught) {
      this.taught = true;
      pointTexts.push(new PointText(this.x, this.y - 70, 'CAUGHT: FLANK IT', PARHELION_PEARL, 17));
    } else if (clock - this.lastCatch.text > 700) {
      pointTexts.push(new PointText(x, y - 14, 'CAUGHT', PARHELION_PEARL, 12));
      this.lastCatch.text = clock;
    }
    return 0;
  }

  // A trick shot on the mirror cracks it: the arc shrinks 15° and a loaded pip shatters
  crack(b) {
    this.mirrorHalf = Math.max(PARHELION_MIRROR_MIN_HALF, this.mirrorHalf - PARHELION_CRACK_SHRINK);
    this.pips = Math.max(0, this.pips - 1);
    this.cracks.push(rand(-0.75, 0.75)); // where on the arc, as a share of its half-width
    const a = Math.atan2(b.prevY - this.y, b.prevX - this.x);
    explode(this.x + Math.cos(a) * PARHELION_MIRROR_R, this.y + Math.sin(a) * PARHELION_MIRROR_R, PARHELION_PEARL, 22, { sparks: 12 });
    playSound('asteroid-explode', { rate: 1.8 });
    addShake(5);
    addHitstop(40);
  }

  turnToPlayer(f) {
    const d = parhelionDiff(Math.atan2(player.y - this.y, player.x - this.x), this.angle);
    this.angle += clamp(d, -this.turnRate * f, this.turnRate * f);
  }

  update(f) {
    const t = clock - this.stateTime;
    this.hurt = Math.max(0, this.hurt - 0.08 * f);
    this.spin += 0.004 * f;

    if (this.state === 'enter') {
      this.angle = Math.atan2(player.y - this.y, player.x - this.x);
      if (t > PARHELION_ENTRANCE) this.setState('drift');
      return;
    }
    if (this.state === 'leave') {
      // Edge-on, it slides out past the nearest edge like a glint off a blade
      if (t > 400) {
        const a = Math.atan2(this.y - H / 2, this.x - W / 2);
        this.x += Math.cos(a) * 7 * f;
        this.y += Math.sin(a) * 7 * f;
      }
      if (this.isOffScreen(80)) this.leave();
      return;
    }

    let wantX = 0;
    let wantY = 0;
    if (this.state === 'flare') {
      this.charge = Math.min(1, t / (PARHELION_TRACK + PARHELION_LOCK));
      if (!this.locked) this.turnToPlayer(f);
      else this.volley ??= this.loaded; // what the lanes show is what fires
      if (Math.random() < 0.6 * f) {
        // Light pours into the mirror
        const a = this.angle + rand(-this.mirrorHalf, this.mirrorHalf);
        const d = rand(70, 120);
        addParticle({ kind: 'spark', x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 3, life: 12, size: 1.5, color: pick([PARHELION_PEARL, PARHELION_RED, PARHELION_BLUE]), drag: 1 });
      }
      if (t >= PARHELION_TRACK + PARHELION_LOCK) this.fire();
    } else {
      if (clock >= this.dazzledUntil) this.turnToPlayer(f);
      if (Math.hypot(this.waypoint.x - this.x, this.waypoint.y - this.y) < 50) this.waypoint = this.pickWaypoint();
      const dx = this.waypoint.x - this.x;
      const dy = this.waypoint.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      wantX = (dx / d) * PARHELION_SPEED;
      wantY = (dy / d) * PARHELION_SPEED;
      const px = this.x - player.x;
      const py = this.y - player.y;
      const pd = Math.hypot(px, py) || 1;
      if (!player.exploded && pd < PARHELION_PERSONAL_SPACE) {
        wantX += (px / pd) * PARHELION_SPEED * 2 * (1 - pd / PARHELION_PERSONAL_SPACE);
        wantY += (py / pd) * PARHELION_SPEED * 2 * (1 - pd / PARHELION_PERSONAL_SPACE);
      }
      const wall = (v, max) => (clamp((110 - v) / 50, 0, 2) - clamp((v - max + 110) / 50, 0, 2)) * PARHELION_SPEED;
      wantX += wall(this.x, W);
      wantY += wall(this.y, H);

      const onScreen = this.x > 80 && this.x < W - 80 && this.y > 80 && this.y < H - 80;
      if (this.returns >= PARHELION_RETURNS || clock - this.arrived > PARHELION_VISIT) {
        this.foldAngle = Math.atan2(this.y - H / 2, this.x - W / 2);
        this.setState('leave');
        playSound('power-up-expire', { rate: 1.4, volume: 0.6 });
      } else if ((clock >= this.nextFlare || this.pips >= this.maxShards - PARHELION_BASE_SHARDS) && isPlaying() && pd > PARHELION_MIN_FIRE_DISTANCE && onScreen && this.mayTelegraph()) {
        this.setState('flare');
        this.volley = null;
        playSound('power-up-spawn', { rate: 1.3 });
      }
    }

    const k = ease(this.state === 'flare' ? 0.12 : 0.03, f);
    this.velX += (wantX - this.velX) * k;
    this.velY += (wantY - this.velY) * k;
    this.x += this.velX * f;
    this.y += this.velY * f;
  }

  setState(state) {
    super.setState(state);
    this.charge = 0;
  }

  // RETURN TO SENDER: the loaded glass fans out along the locked lanes
  fire() {
    const count = this.volley ?? this.loaded;
    const o = this.muzzle;
    const speed = PARHELION_SHARD_SPEED * difficultySpeed();
    for (let i = 0; i < count; i++) enemyShots.push(new ParhelionShard(this, o.x, o.y, this.angle + (i - Math.floor(count / 2)) * PARHELION_SHARD_SPREAD, speed)); // even fans still put a lane dead-center
    this.pips = Math.max(0, this.pips - (count - PARHELION_BASE_SHARDS));
    this.returns++;
    this.nextFlare = clock + PARHELION_RETURN_GAP;
    this.dazzledUntil = clock + PARHELION_DAZZLE;
    this.velX = -Math.cos(this.angle) * 2.5; // recoil
    this.velY = -Math.sin(this.angle) * 2.5;
    this.waypoint = this.pickWaypoint();
    addParticle({ kind: 'ring', x: o.x, y: o.y, life: 16, size: 34, color: PARHELION_PEARL, drag: 1 });
    playSound('shoot', { rate: 0.5 });
    addShake(3);
    this.setState('drift');
  }

  // The mirror shatters, and every caught shot flies back out as YOUR bullet, already banked: trick shots
  // Drops lean ricochet: the gun that beats it next time
  dropLoot() {
    super.dropLoot(Math.random() < 0.5 ? 'ricochet' : undefined);
  }

  onDeath() {
    const offset = rand(0, TAU);
    for (let i = 0; i < this.pips; i++) {
      const a = offset + (i / this.pips) * TAU;
      const b = new Bullet(this.x + Math.cos(a) * PARHELION_MIRROR_R, this.y + Math.sin(a) * PARHELION_MIRROR_R, a, false);
      b.banked = true;
      bullets.push(b);
    }
    if (this.pips) pointTexts.push(new PointText(this.x, this.y + 34, `REFUND ×${this.pips}`, POWER_UP_COLORS.ricochet, 16));
    playSound('supernova', { rate: 1.2 });
    playSound('black-hole-destroy', { rate: 1.5 });
  }

  // Entrance: a lens-flare band sweeps the field toward the entry point
  drawBehind() {
    const t = (clock - this.stateTime) / PARHELION_GLINT[1];
    if (this.state !== 'enter' || t >= 1) return;
    const span = Math.hypot(W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(this.x + Math.cos(this.foldAngle) * span * (1 - t), this.y + Math.sin(this.foldAngle) * span * (1 - t)); // from across the field
    ctx.rotate(this.foldAngle);
    ctx.globalAlpha = Math.sin(t * Math.PI);
    const band = ctx.createLinearGradient(-90, 0, 90, 0);
    band.addColorStop(0, hexToRgba(PARHELION_RED, 0));
    band.addColorStop(0.3, hexToRgba(PARHELION_RED, 0.16));
    band.addColorStop(0.5, hexToRgba(PARHELION_PEARL, 0.26));
    band.addColorStop(0.7, hexToRgba(PARHELION_BLUE, 0.16));
    band.addColorStop(1, hexToRgba(PARHELION_BLUE, 0));
    ctx.fillStyle = band;
    ctx.fillRect(-90, -span, 180, span * 2);
    ctx.restore();
  }

  drawGlint(x, y, size, alpha, rotation = 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    for (const [w, h] of [[size, 0], [0, size * 0.45]]) {
      ctx.beginPath();
      ctx.moveTo(-w, -h);
      ctx.lineTo(w, h);
      neon(PARHELION_PEARL, 2);
    }
    ctx.restore();
  }

  drawLanes() {
    const count = this.volley ?? this.loaded;
    const o = this.muzzle;
    const alpha = this.locked ? 0.9 : 0.4;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.setLineDash([12, 9]);
    ctx.lineWidth = 2.5;
    for (let i = 0; i < count; i++) {
      const a = this.angle + (i - Math.floor(count / 2)) * PARHELION_SHARD_SPREAD;
      const hue = count > 1 ? (i / (count - 1)) * 260 : 0; // red → violet across the fan
      const ex = o.x + Math.cos(a) * 320;
      const ey = o.y + Math.sin(a) * 320;
      const grad = ctx.createLinearGradient(o.x, o.y, ex, ey);
      grad.addColorStop(0, `hsla(${hue}, 100%, 75%, ${alpha})`);
      grad.addColorStop(1, `hsla(${hue}, 100%, 75%, 0)`);
      ctx.beginPath();
      ctx.moveTo(o.x + Math.cos(a) * 16, o.y + Math.sin(a) * 16);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = grad;
      ctx.stroke();
    }
    ctx.restore();
  }

  draw() {
    const t = clock - this.stateTime;
    if (this.state === 'enter' && t < PARHELION_ENTRANCE) {
      const g = clamp((t - PARHELION_GLINT[0]) / (PARHELION_GLINT[1] - PARHELION_GLINT[0]), 0, 1);
      if (g > 0) this.drawGlint(this.x, this.y, 10 + g * 80, Math.min(1, g * 2) * (1 - this.fold * 0.8), this.foldAngle + Math.PI / 2);
      if (this.fold <= 0) return;
    }
    if (this.state === 'flare') this.drawLanes();
    this.sprite ??= makeSprite(PARHELION_SPRITE_SIZE, 1, paintParhelion);
    const half = PARHELION_SPRITE_SIZE / 2;
    const R = PARHELION_MIRROR_R;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.foldAngle);
    ctx.scale(this.fold, 1);
    ctx.rotate(-this.foldAngle);

    ctx.save();
    ctx.rotate(this.spin);
    ctx.drawImage(this.sprite, -half, -half, PARHELION_SPRITE_SIZE, PARHELION_SPRITE_SIZE);
    if (this.hurt > 0) {
      ctx.globalAlpha = this.hurt * 0.6;
      parhelionHex(ctx, PARHELION_HEX_R);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();

    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.5 + 0.5 * Math.sin(clock * 0.006);
    const sun = ctx.createRadialGradient(0, 0, 0, 0, 0, 10 + pulse * 4 + this.charge * 12);
    sun.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    sun.addColorStop(1, hexToRgba(PARHELION_PEARL, 0));
    ctx.fillStyle = sun;
    ctx.fillRect(-30, -30, 60, 60);

    // The mirror: a blazing silver arc with a spectral fringe. Dimmer while dazzled after a return.
    const a0 = this.angle - this.mirrorHalf;
    const a1 = this.angle + this.mirrorHalf;
    const dazzled = clock < this.dazzledUntil ? 0.5 : 1;
    ctx.globalAlpha = dazzled;
    ctx.lineCap = 'butt';
    ctx.lineWidth = 3;
    for (const [color, r] of [[PARHELION_RED, R - 7], [PARHELION_BLUE, R + 7]]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, a0, a1);
      ctx.strokeStyle = hexToRgba(color, 0.8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, R, a0, a1);
    neon(PARHELION_PEARL, 7 + this.charge * 4);
    for (const a of [a0, a1]) {
      // End caps: where the mirror stops and the dark glass starts
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (R - 11), Math.sin(a) * (R - 11));
      ctx.lineTo(Math.cos(a) * (R + 11), Math.sin(a) * (R + 11));
      neon(PARHELION_PEARL, 2);
    }

    // Cracks: dark zigzags across the glass
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#05060f';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const u of this.cracks) {
      const a = this.angle + u * this.mirrorHalf;
      ctx.beginPath();
      [-9, -3, 3, 9].forEach((dr, i) => ctx.lineTo(Math.cos(a + (i % 2 ? 0.07 : -0.05)) * (R + dr), Math.sin(a + (i % 2 ? 0.07 : -0.05)) * (R + dr)));
      ctx.stroke();
    }

    // Loaded shards ride outside the mirror: you can count what's coming back at you
    parhelionShardSprite ??= makeSprite(PARHELION_SHARD_SPRITE_SIZE, 1, paintParhelionShard);
    const count = this.volley ?? this.loaded;
    const step = Math.min(0.24, (this.mirrorHalf * 1.7) / Math.max(1, count - 1));
    const blaze = this.state === 'flare' ? 0.5 + this.charge * 0.3 + 0.08 * Math.sin(clock * 0.05) : 0.42;
    for (let i = 0; i < count; i++) {
      const a = this.angle + (i - (count - 1) / 2) * step;
      ctx.save();
      ctx.translate(Math.cos(a) * (R + 25), Math.sin(a) * (R + 25));
      ctx.rotate(a);
      ctx.scale(blaze, blaze);
      ctx.globalAlpha = dazzled;
      ctx.drawImage(parhelionShardSprite, -PARHELION_SHARD_SPRITE_SIZE / 2, -PARHELION_SHARD_SPRITE_SIZE / 2, PARHELION_SHARD_SPRITE_SIZE, PARHELION_SHARD_SPRITE_SIZE);
      ctx.restore();
    }
    ctx.restore();

    if (this.state === 'leave') this.drawGlint(this.x, this.y, 40, 1 - this.fold, this.foldAngle + Math.PI / 2);
  }
}

class ParhelionShard extends EnemyShot {
  constructor(owner, x, y, angle, speed) {
    super(owner, x, y, angle, speed, { radius: PARHELION_SHARD_RADIUS, color: PARHELION_PEARL, lifetime: PARHELION_SHARD_LIFETIME, points: PARHELION_SHARD_POINTS });
  }

  draw() {
    parhelionShardSprite ??= makeSprite(PARHELION_SHARD_SPRITE_SIZE, 1, paintParhelionShard);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.velY, this.velX)); // points where it's going
    ctx.scale(1, 0.65 + 0.35 * Math.abs(Math.sin(this.age * 0.012))); // a flat shard tumbling, catching the light
    ctx.globalAlpha = this.fade;
    ctx.drawImage(parhelionShardSprite, -PARHELION_SHARD_SPRITE_SIZE / 2, -PARHELION_SHARD_SPRITE_SIZE / 2, PARHELION_SHARD_SPRITE_SIZE, PARHELION_SHARD_SPRITE_SIZE);
    ctx.restore();
  }
}

const BOSS_KINDS = [Gloomray, Hollowclaw, Vigil, Magpie, Duskwing, Parhelion];

// Shuffled bag: you meet every kind before any repeats, and a run's first boss is an easy one
function drawBossKind() {
  const free = k => !bosses.some(b => b.kind === k);
  if (!encounters) {
    const easy = BOSS_KINDS.filter(k => k.tier === 'easy' && free(k));
    if (easy.length) {
      const kind = pick(easy);
      bossBag = BOSS_KINDS.filter(k => k !== kind).sort(() => Math.random() - 0.5);
      return kind;
    }
  }
  if (!bossBag.some(free)) bossBag = BOSS_KINDS.filter(free).sort(() => Math.random() - 0.5);
  const i = bossBag.findIndex(free);
  return i < 0 ? null : bossBag.splice(i, 1)[0];
}

function spawnBoss(kind) {
  if (bosses.length >= MAX_BOSSES) return;
  kind ??= drawBossKind();
  if (!kind) return;
  bossCounts.set(kind, (bossCounts.get(kind) ?? 0) + 1);
  bosses.push(new kind(bossCounts.get(kind)));
  playSound('black-hole-spawn', { rate: 0.45 }); // a low moan
}

// A boss wave's encounter: one boss; later in a run, sometimes a second one joins it a few seconds on
function startBossEncounter() {
  spawnBoss();
  encounters++;
  const duo = score >= DUO_SCORE || encounters >= DUO_ENCOUNTER;
  const chance = clamp(DUO_CHANCE[0] + Math.max(0, score - DUO_SCORE) / 100000, DUO_CHANCE[0], DUO_CHANCE[1]);
  if (duo && Math.random() < chance) duoAt = clock + DUO_DELAY;
}

function directBosses() {
  if (!isPlaying() || clock < duoAt) return;
  duoAt = Infinity;
  spawnBoss();
}

// A bullet vs the bosses and their shots (after it's done with asteroids)
function shootBosses(b) {
  const counted = () => {
    if (b.counted && !b.scored) bulletHits++;
    b.scored = true;
  };
  for (const s of enemyShots) {
    if (s.dead || !s.points || !b.hits(s)) continue;
    counted();
    s.pop();
    addCombo();
    const points = s.points * comboMultiplier();
    score += points;
    updateHighScore();
    pointTexts.push(new PointText(s.x, s.y, `+${points}`, s.color, 14));
    playSound('click', { rate: 1.6, volume: 0.6 });
    if (!b.lance) return (b.hit = true);
  }
  for (const boss of bosses) {
    if (!boss.vulnerable || b.struck?.has(boss) || !boss.hitBy(b)) continue;
    counted();
    boss.hit((b.lance ? 2 : 1) * ship.damage, { x: b.x, y: b.y, trick: b.trick, bullet: b });
    if (!b.lance) return (b.hit = true);
    b.struck.add(boss);
  }
}

function updateBosses(f) {
  bosses = bosses.filter(b => !b.dead); // shot or nova'd earlier this frame: no last attack or body contact
  const worn = bosses.filter(b => b.shell && !b.shell.dead && !asteroids.includes(b.shell)).map(b => b.shell);
  cover = worn.length ? asteroids.concat(worn) : asteroids;
  directBosses();
  bosses.forEach(b => b.update(f));

  const invulnerable = shipInvulnerable();
  const shielded = hasPowerUp('shield');
  for (const s of enemyShots) {
    if (s.baitable) for (const bh of blackHoles) bh.applyGravity(s, f);
    s.move(f);
    if (s.dead) continue;
    const bh = s.baitable && blackHoles.find(h => h.canCollide() && Math.hypot(s.x - h.x, s.y - h.y) < BLACK_HOLE_CORE_DRAW);
    if (bh) {
      s.pop('#ff6a00');
      if (isPlaying()) {
        const points = Math.max(100, s.points * 2);
        score += points;
        updateHighScore();
        pointTexts.push(new PointText(s.x, s.y, `BAITED +${points}`, s.color, 14));
      }
      continue;
    }
    const rock = !s.passesRocks && cover.find(a => !a.dead && Math.hypot(s.x - a.x, s.y - a.y) < a.hitRadius + s.hitRadius);
    if (rock) {
      s.pop(rock.color); // geodes drink enemy shots: rocks are cover
      continue;
    }
    if (player.exploded) continue;
    const d = Math.hypot(s.x - player.x, s.y - player.y);
    if (shielded && d < SHIELD_RADIUS + s.hitRadius) {
      s.pop(POWER_UP_COLORS.shield);
      playSound('click', { rate: 1.6, volume: 0.6 });
    } else if (!shielded && !invulnerable && d < PLAYER_HIT_RADIUS + s.hitRadius - 1) {
      s.pop();
      killPlayer('game-over');
    }
  }
  enemyShots = enemyShots.filter(s => !s.dead);

  // Body contact: deadly, unless you're shielded (then you ram it)
  for (const boss of bosses) {
    if (!boss.vulnerable || player.exploded) continue;
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const d = Math.hypot(dx, dy) || 1;
    if (shielded && boss.touches(player.x, player.y, SHIELD_RADIUS)) boss.rammed(dx, dy, d);
    else if (!shielded && !invulnerable && boss.touches(player.x, player.y, PLAYER_HIT_RADIUS)) killPlayer('game-over');
  }
  bosses = bosses.filter(b => !b.dead);
}

function drawBosses() {
  enemyShots.forEach(s => s.draw());
  bosses.forEach(b => b.draw());
}

function difficultySpeed() {
  if (!gameStarted) return 1;
  const minutes = (clock - gameStartTime) / 60000;
  return Math.min(DIFFICULTY_SPEED_MAX, 1 + Math.max(0, wave - 1) * DIFFICULTY_PER_WAVE + minutes * DIFFICULTY_PER_MINUTE);
}

function scheduleAsteroid(delay = rand(ASTEROID_SPAWN_MIN, ASTEROID_SPAWN_MAX)) {
  pendingAsteroids.push(clock + delay);
}

function scheduleBlackHole() {
  nextBlackHole = clock + rand(BLACK_HOLE_SPAWN_MIN, BLACK_HOLE_SPAWN_MAX);
}

function schedulePowerUp(type) {
  nextPowerUp[type] = clock + rand(...POWER_UP_SPAWN[type]);
}

// Families still in play, counting rocks a Hollowclaw is wearing (read live: `cover` is only rebuilt mid-frame)
const liveFamilies = () => new Set([...asteroids, ...bosses.map(b => b.shell)].filter(a => a && !a.dead).map(a => a.family)).size;

// This wave's family count; halved while a boss is visiting (it brings its own trouble)
const waveSize = () => (bosses.length ? Math.max(2, Math.ceil(scaled(WAVE_SIZE, wave) / 2)) : scaled(WAVE_SIZE, wave));

const isBossWave = n => !bossesOff && n % BOSS_WAVE_EVERY === 0;

function startWave() {
  wave++;
  const bossWave = isBossWave(wave);
  if (bossWave) startBossEncounter(); // first, so the rocks that come with it are the halved boss-wave share
  let delay = 0;
  for (let i = liveFamilies() + pendingAsteroids.length; i < waveSize(); i++) scheduleAsteroid((delay += rand(...WAVE_STAGGER)));
  // A boss wave holds the clock until the boss is gone; a rock wave gets the usual 25s
  nextWave = bossWave ? Infinity : clock + WAVE_REINFORCE;
  waveStats = { at: clock, families: Math.max(1, waveSize()), shots: shotsFired, hits: bulletHits };
  if (bossWave) {
    pointTexts.push(new PointText(W / 2, H * 0.32, `WAVE ${wave} · BOSS`, COMBO_COLOR, 28));
    addShake(5);
  } else {
    pointTexts.push(new PointText(W / 2, H * 0.32, `WAVE ${wave}`, CREAM, 24));
  }
}

// Field (and any boss) cleared: a bonus that doubles for a FAST clear and again for a FLAWLESS one (every shot
// a hit), a free power-up for flawless, then a beat of calm before the next wave
function clearWave() {
  const fast = clock - waveStats.at <= waveStats.families * WAVE_PAR;
  const shots = shotsFired - waveStats.shots;
  const flawless = shots > 0 && bulletHits - waveStats.hits >= shots;
  const multiplier = (fast ? 2 : 1) * (flawless ? 2 : 1);
  const points = WAVE_CLEAR_POINTS * wave * multiplier;
  score += points;
  updateHighScore();
  const y = H * 0.32;
  pointTexts.push(new PointText(W / 2, y, 'WAVE CLEAR!', BULLET_COLOR, 26));
  pointTexts.push(new PointText(W / 2, y + 34, `+${points}`, BULLET_COLOR, 20));
  const tags = [fast && 'FAST ×2', flawless && 'FLAWLESS ×2'].filter(Boolean);
  if (tags.length) pointTexts.push(new PointText(W / 2, y + 62, tags.join('  '), COMBO_COLOR, 16));
  if (flawless) {
    const p = new PowerUp(pick(Object.keys(POWER_UP_DURATION)));
    Object.assign(p, { x: W / 2, y: H * 0.45, velX: rand(-0.4, 0.4), velY: rand(-0.4, 0.4), spawnTime: clock - p.fadeIn });
    powerUps.push(p);
  }
  addParticle({ kind: 'ring', x: player.x, y: player.y, life: 40, size: Math.max(W, H) * 0.6, width: 4, color: BULLET_COLOR, drag: 1 });
  playSound('power-up', { rate: multiplier > 1 ? 1 : 0.8 });
}

function directWaves() {
  if (!isPlaying()) return;
  const bossesDone = !bosses.length && duoAt === Infinity;
  if (bossesDone && !liveFamilies() && !pendingAsteroids.length && nextWave - clock > WAVE_BREATHER) {
    clearWave();
    nextWave = clock + WAVE_BREATHER;
  } else if (bossesDone && nextWave === Infinity) {
    nextWave = clock + WAVE_REINFORCE; // the boss is gone but rocks remain: the usual clock resumes
  }
  if (clock >= nextWave) startWave();
}

function addCombo() {
  const before = comboMultiplier();
  combo++;
  maxCombo = Math.max(maxCombo, combo);
  const after = comboMultiplier();
  if (after > before) {
    pointTexts.push(new PointText(player.x, player.y - 36, `×${after}`, COMBO_COLOR, 22));
    playSound('click', { rate: 0.8 + after * 0.15, vary: 0 });
    comboDisplay.animate([{ transform: 'scale(1.6)' }, { transform: 'scale(1)' }], {
      duration: 300,
      easing: 'ease-out'
    });
  }
}

function resetCombo() {
  combo = 0;
}

function splitAsteroid(a, impactAngle) {
  const size = a.size * ASTEROID_SPLIT_RATIO;
  const speed = Math.max(1.5, Math.hypot(a.velX, a.velY)) * ASTEROID_SPLIT_SPEED;
  for (const side of [-1, 1]) {
    const dir = impactAngle + side * rand(0.6, 1.2);
    asteroids.push(
      new Asteroid({
        x: a.x + Math.cos(dir) * size * 0.6,
        y: a.y + Math.sin(dir) * size * 0.6,
        velX: a.velX * 0.4 + Math.cos(dir) * speed,
        velY: a.velY * 0.4 + Math.sin(dir) * speed,
        size,
        color: a.color,
        family: a.family
      })
    );
  }
}

// cause: 'bullet' | 'shield' | 'supernova' | 'blackhole'
function destroyAsteroid(a, { cause, angle = rand(0, TAU), trick = false }) {
  a.dead = true;

  if (cause === 'blackhole') {
    for (let i = 0; i < 10; i++) {
      addParticle({ x: a.x, y: a.y, vx: rand(-1, 1), vy: rand(-1, 1), life: rand(20, 40), size: 2, color: a.color });
    }
    playSound('black-hole-destroy', { volume: 0.5 });
  } else {
    explode(a.x, a.y, a.color, a.size, { sparks: cause === 'supernova' ? 8 : 14 });
    hits++;

    let points = cause === 'supernova' ? 50 : a.pointsValue;
    let label = '';
    if (cause !== 'supernova') {
      addCombo();
      const multiplier = comboMultiplier() * (trick ? TRICK_SHOT_MULTIPLIER : 1);
      points *= multiplier;
      if (multiplier > 1) label = ` ×${multiplier}`;
      playSound('asteroid-explode', { rate: 1.35 - (a.size / ASTEROID_MAX_SIZE) * 0.55 });
      addShake(2 + a.size / 10);
      addHitstop(20 + a.size * 0.8);
      if (a.size >= ASTEROID_SPLIT_MIN_SIZE) splitAsteroid(a, angle);
    }
    score += points;
    pointTexts.push(new PointText(a.x, a.y, `+${points}${label}`, a.color, 15 + a.size / 10));
    if (trick) pointTexts.push(new PointText(a.x, a.y - 24, 'TRICK SHOT!', BULLET_COLOR, 18));
    updateHighScore();
  }
}

function killPlayer(sound) {
  player.exploded = true;
  player.deathTime = clock;
  player.lives--;
  renderLives();
  playSound(sound);
  explode(player.x, player.y, rocketColor, 45, { sparks: 30 });
  explode(player.x, player.y, '#ffffff', 20, { sparks: 10, ring: false });
  addShake(16);
  slowMo = 1000;
  bullets = [];
  combo = 0;
  updateHighScore();
}

function fire() {
  // This shot's muzzle (hulls with twin guns alternate), from ship-local units to the world
  const [mx, my] = SHIPS[rocketHull].muzzles[shotsFired % SHIPS[rocketHull].muzzles.length];
  const cos = Math.cos(player.angle);
  const sin = Math.sin(player.angle);
  const noseX = player.x + (-my * cos - mx * sin) * ROCKET_SCALE;
  const noseY = player.y + (-my * sin + mx * cos) * ROCKET_SCALE;
  bullets.push(new Bullet(noseX, noseY, player.angle, true, ship.bulletSpeed));
  if (hasPowerUp('spread')) {
    bullets.push(new Bullet(noseX, noseY, player.angle - SPREAD_ANGLE, false, ship.bulletSpeed));
    bullets.push(new Bullet(noseX, noseY, player.angle + SPREAD_ANGLE, false, ship.bulletSpeed));
  }
  playSound('shoot', hasPowerUp('lance') ? { rate: 0.7 } : { volume: 0.8 });
  shotsFired++;
  // Carry the overshoot while fire is held so the rate is 1000/cooldown, not rounded up to whole frames
  const late = clock - player.lastShotTime - ship.cooldown;
  player.lastShotTime = clock - (late > 0 && late < TARGET_DELTA * 2 ? late : 0);
  player.shootTimer = 10;

  // Muzzle flash
  addParticle({ x: noseX, y: noseY, life: 6, size: 6, color: '#fff6d0', drag: 1 });
  for (let i = 0; i < 3; i++) {
    const a = player.angle + rand(-0.5, 0.5);
    const speed = rand(2, 5);
    addParticle({
      kind: 'spark',
      x: noseX,
      y: noseY,
      vx: player.velX + Math.cos(a) * speed,
      vy: player.velY + Math.sin(a) * speed,
      life: rand(6, 12),
      size: 1.5,
      color: BULLET_COLOR,
      drag: 0.85
    });
  }
}

function collectPowerUp(p) {
  p.dead = true;
  const color = POWER_UP_COLORS[p.type];
  addParticle({ kind: 'ring', x: p.x, y: p.y, life: 25, size: 70, color, drag: 1 });
  playSound('power-up');

  if (p.type === 'star') {
    supernova(p);
    return;
  }
  if (p.type === 'life') {
    player.lives = Math.min(MAX_LIVES, player.lives + 1);
    renderLives();
    livesDisplay.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' });
    pointTexts.push(new PointText(p.x, p.y, POWER_UP_LABELS.life, color, 22));
    playSound('power-up', { rate: 1.25 });
    return;
  }
  player.timers[p.type] = clock + POWER_UP_DURATION[p.type] * ship.powerUps;
  player.warned[p.type] = false;
  if (p.type === 'well') {
    player.well = { x: p.x, y: p.y, opacity: 1 }; // anchored where it was grabbed
    playSound('black-hole-spawn', { rate: 1.5, volume: 0.5 });
  }
  score += POWER_UP_POINTS;
  updateHighScore();
  pointTexts.push(new PointText(p.x, p.y, `+${POWER_UP_POINTS}`, color, 18));
  pointTexts.push(new PointText(p.x, p.y - 24, POWER_UP_LABELS[p.type], color, 16));
}

function supernova(p) {
  // Clear the field; the wave director calls it a clear and sends the next wave after a breather
  asteroids.forEach(a => !a.dead && destroyAsteroid(a, { cause: 'supernova' }));
  pendingAsteroids = [];

  if (blackHoles.length) {
    blackHoles.forEach(bh => explode(bh.x, bh.y, '#ff6a00', 60, { sparks: 30 }));
    blackHoles = [];
    playSound('black-hole-destroy');
    scheduleBlackHole();
  }

  enemyShots.forEach(s => s.pop());
  enemyShots = [];
  bosses.forEach(b => b.hit(Math.ceil(b.maxHp * 0.4)));

  score += 1000;
  updateHighScore();
  pointTexts.push(new PointText(p.x, p.y, '+1000', POWER_UP_COLORS.star, 22));
  pointTexts.push(new PointText(p.x, p.y - 28, POWER_UP_LABELS.star, POWER_UP_COLORS.star, 20));
  addParticle({ kind: 'ring', x: p.x, y: p.y, life: 45, size: Math.max(W, H), width: 12, color: '#fff6a0', drag: 1 });
  playSound('supernova');
  flash = 1;
  addShake(16);
  addHitstop(80);
}

function updateHighScore() {
  if (score > (shipBests[rocketHull] ?? 0)) shipBests[rocketHull] = score; // saved at game over (saveShipBests)
  if (score > cachedHighScore) {
    cachedHighScore = score;
    localStorage.setItem(HIGH_SCORE_KEY, score);
    highScoreDisplay.classList.add('is-current');
  }
  setText(highScoreDisplay, `Best: ${cachedHighScore}`);
}

function resetGame(freshAsteroids = true) {
  Object.assign(player, {
    x: W / 2,
    y: H / 2,
    angle: 0,
    velX: 0,
    velY: 0,
    rotationSpeed: 0,
    exploded: false,
    isThrusting: false,
    tracerEnabled: false,
    shieldAngle: 0,
    lastShotTime: -Infinity,
    timers: powerUpTable(0),
    warned: powerUpTable(false),
    well: null,
    lives: STARTING_LIVES,
    respawnTime: clock
  });
  renderLives();
  bullets = [];
  powerUps = [];
  blackHoles = [];
  pointTexts = [];
  particles = [];
  pendingAsteroids = [];
  wave = 1; // the starting rocks (or the ones already drifting behind the title screen)
  nextWave = clock + WAVE_REINFORCE;
  waveStats = { at: clock, families: STARTING_ASTEROIDS, shots: 0, hits: 0 };
  gameStartTime = clock; // before spawning: asteroid speed scales with time since start
  if (freshAsteroids) asteroids = Array.from({ length: STARTING_ASTEROIDS }, () => new Asteroid());
  score = displayScore = shotsFired = bulletHits = hits = combo = maxCombo = 0;
  gameOverShown = false;
  gameOverDisplay.style.display = 'none';
  bestAtStart = cachedHighScore;
  highScoreDisplay.classList.remove('is-current');
  updateHighScore();
  Object.keys(POWER_UP_SPAWN).forEach(schedulePowerUp);
  scheduleBlackHole();
  bosses = [];
  enemyShots = [];
  bossBag = [];
  bossCounts = new Map();
  encounters = 0;
  duoAt = Infinity;
  cover = asteroids;
  slowMo = flash = hitstop = 0;
  playSound('game-start');
}

// The next ship warps in at the center, blinking (invulnerable) for SPAWN_INVULNERABILITY. Power-ups don't
// carry over.
function respawn() {
  Object.assign(player, {
    x: W / 2,
    y: H / 2,
    velX: 0,
    velY: 0,
    rotationSpeed: 0,
    exploded: false,
    isThrusting: false,
    respawnTime: clock,
    timers: powerUpTable(0),
    warned: powerUpTable(false),
    well: null
  });
  addParticle({ kind: 'ring', x: player.x, y: player.y, life: 30, size: 90, width: 4, color: rocketColor, drag: 1 });
  addParticle({ kind: 'ring', x: player.x, y: player.y, life: 20, size: 50, color: '#ffffff', drag: 1 });
  playSound('power-up', { rate: 0.7 });
}

// Lives as little ships under the stats
function renderLives() {
  livesDisplay.style.color = rocketColor;
  livesDisplay.setAttribute('aria-label', `${player.lives} ${player.lives === 1 ? 'life' : 'lives'}`);
  livesDisplay.innerHTML = `<svg viewBox="0 0 12 20" aria-hidden="true"><path d="${SHIP_GLYPH}"/></svg>`.repeat(Math.max(0, player.lives));
}

// Blast off: the preview ship launches, the floor warps away and the title screen peels off in layers (CSS
// .launching), then the run begins with your ship warping in
const LAUNCH_TIME = 650;
const ARRIVAL_TIME = 1200; // ms the ship glides in from below to the center before you take the stick
let launchAt = 0; // when Blast off was hit (0 = still on the title screen)

function startGame() {
  if (launchAt) return;
  launchAt = performance.now();
  unlockAudio();
  playSound('thrust', { rate: 0.75 });
  startDialog.classList.add('launching');
  setTimeout(beginRun, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : LAUNCH_TIME);
}

function beginRun() {
  if (new URLSearchParams(location.search).has('dev')) toggleTestDeck(true);
  startDialog.style.display = 'none';
  startDialog.inert = true;
  gameStarted = true;
  resetGame(false); // keep the asteroids already drifting behind the title screen
  // Arrival: out of hyperspace the ship glides up from below the screen to the center (updateArrival), then
  // you take over. Spawn invulnerability starts when you do.
  const arrival = REDUCED_MOTION ? 0 : ARRIVAL_TIME;
  Object.assign(player, { y: arrival ? H + 60 : H / 2, angle: -Math.PI / 2, arriveUntil: clock + arrival, respawnTime: clock + arrival });
  if (!arrival) arrive();
}

function updateArrival() {
  const t = 1 - (player.arriveUntil - clock) / ARRIVAL_TIME;
  const e = 1 - (1 - t) ** 3; // fast out of warp, easing to a stop
  player.y = H + 60 + (H / 2 - H - 60) * e;
  player.velX = 0;
  player.velY = 0;
  player.isThrusting = t < 0.85; // burning to brake, cut just before it settles
  player.thrustSign = 1;
  if (clock >= player.arriveUntil) arrive();
}

// The hand-off: a ring burst in your paint, a soft flash, and the stick is yours
function arrive() {
  player.arriveUntil = 0;
  player.isThrusting = false;
  player.y = H / 2;
  flash = 0.25;
  addShake(3);
  addParticle({ kind: 'ring', x: player.x, y: player.y, life: 34, size: 120, width: 5, color: rocketColor, drag: 1 });
  addParticle({ kind: 'ring', x: player.x, y: player.y, life: 22, size: 60, color: '#ffffff', drag: 1 });
  playSound('power-up', { rate: 0.8, volume: 0.6 });
}

// Hyperspace: 0..1, how far the stars stretch into streaks. Builds while the rocket lifts off and fades as the
// ship arrives.
function warpLevel() {
  const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  if (REDUCED_MOTION) return 0;
  if (launchAt && !gameStarted) return smooth(((performance.now() - launchAt) / LAUNCH_TIME - 0.15) / 0.85);
  if (player.arriveUntil) return 1 - smooth((1 - (player.arriveUntil - clock) / ARRIVAL_TIME) / 0.75);
  return 0;
}

function showGameOver() {
  saveShipBests();
  gameOverShown = true;
  gameOverShownAt = performance.now();
  newBestDisplay.hidden = !(score > bestAtStart);
  finalStats.innerHTML = [
    ['Score', score],
    ['Time', formatTime(player.deathTime - gameStartTime)],
    ['Wave', wave],
    ['Accuracy', `${accuracy()}%`],
    ['Asteroids', hits],
    ['Best streak', maxCombo]
  ]
    .map(([label, value]) => `<div><span>${label}</span><span>${value}</span></div>`)
    .join('');
  gameOverDisplay.style.display = 'block';
  restartButton.focus({ focusVisible: false });
}

//
// Update
//
function updatePlayer(f) {
  const joystickMagnitude = Math.hypot(touchState.directionX, touchState.directionY);
  const joystickEngaged = joystickMagnitude > 0.2;
  const up = held('ArrowUp', 'KeyW');
  const down = held('ArrowDown', 'KeyS');
  const turn = held('ArrowRight', 'KeyD') - held('ArrowLeft', 'KeyA');

  // Rotation
  if (joystickEngaged) {
    const target = Math.atan2(touchState.directionY, touchState.directionX);
    const diff = Math.atan2(Math.sin(target - player.angle), Math.cos(target - player.angle));
    player.rotationSpeed = clamp(diff * 0.2, -ship.turn, ship.turn);
  } else {
    player.rotationSpeed += (turn * ship.turn - player.rotationSpeed) * ease(ROCKET_ROTATION_EASING, f);
  }
  player.angle += player.rotationSpeed * f;

  // Thrust: (thrustX, thrustY) is the direction the engines push, with magnitude 0..1
  let thrustX = 0;
  let thrustY = 0;
  if (joystickEngaged) {
    thrustX = touchState.directionX;
    thrustY = touchState.directionY;
  } else if (up || down) {
    const sign = up ? 1 : -1;
    thrustX = Math.cos(player.angle) * sign;
    thrustY = Math.sin(player.angle) * sign;
  }
  const thrusting = thrustX !== 0 || thrustY !== 0;
  if (thrusting && !player.isThrusting) playSound('thrust', { volume: 0.7 });
  player.isThrusting = thrusting;
  player.thrustSign = down && !up && !joystickEngaged ? -1 : 1;

  if (zeroGravityToggle.checked) {
    player.velX += thrustX * ship.accel * f;
    player.velY += thrustY * ship.accel * f;
  } else if (thrusting) {
    const k = ease(0.1 * (ship.accel / SHIP_BASE.accel), f); // how quickly thrust reaches top speed
    player.velX += (thrustX * ship.speed - player.velX) * k;
    player.velY += (thrustY * ship.speed - player.velY) * k;
  } else {
    const friction = ship.drift ** f;
    player.velX *= friction;
    player.velY *= friction;
    if (Math.abs(player.velX) < 0.01) player.velX = 0;
    if (Math.abs(player.velY) < 0.01) player.velY = 0;
  }

  const speed = Math.hypot(player.velX, player.velY);
  if (speed > ship.speed) {
    player.velX *= ship.speed / speed;
    player.velY *= ship.speed / speed;
  }
  player.x += player.velX * f;
  player.y += player.velY * f;

  if (bounceOffWalls(player, PLAYER_WALL_RADIUS) && clock - player.lastBumpSoundTime >= 200) {
    playSound('bump');
    player.lastBumpSoundTime = clock;
  }

  if (thrusting) emitExhaust(f, thrustX, thrustY);

  if ((held('Space') || touchState.shoot) && clock - player.lastShotTime >= ship.cooldown) fire();

  if (player.shootTimer > 0) player.shootTimer -= f;
  player.shootScale = 1 + 0.15 * Math.max(0, player.shootTimer / 10);
  player.shieldAngle += (TAU / (2500 / TARGET_DELTA)) * f;

  for (const type in POWER_UP_DURATION) {
    const left = player.timers[type] - clock;
    if (left > 0 && left <= POWER_UP_WARNING && !player.warned[type]) {
      player.warned[type] = true;
      playSound('power-up-expire');
    } else if (left <= 0 && player.warned[type]) {
      // Ran out: its gauge pops
      player.warned[type] = false;
      const active = Object.keys(POWER_UP_DURATION).filter(t => t === type || hasPowerUp(t));
      const { x, y, k } = gaugeSpot(active.indexOf(type), active.length);
      addParticle({ kind: 'ring', x, y, life: 14, size: 22 * k, color: GAUGE_STOPS[0][1], drag: 1 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        addParticle({ kind: 'spark', x, y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, life: 12, size: 1.5, color: POWER_UP_COLORS[type], drag: 0.88 });
      }
    }
  }
}

function emitExhaust(f, thrustX, thrustY) {
  const magnitude = Math.hypot(thrustX, thrustY);
  const dirX = thrustX / magnitude;
  const dirY = thrustY / magnitude;
  player.exhaust += f * 1.5 * magnitude;
  while (player.exhaust >= 1) {
    player.exhaust--;
    const spread = rand(-0.35, 0.35);
    const ex = -(dirX * Math.cos(spread) - dirY * Math.sin(spread));
    const ey = -(dirX * Math.sin(spread) + dirY * Math.cos(spread));
    const speed = rand(2, 4);
    addParticle({
      x: player.x - dirX * 15,
      y: player.y - dirY * 15,
      vx: player.velX + ex * speed,
      vy: player.velY + ey * speed,
      life: rand(14, 26),
      size: rand(1.5, 3),
      color: pick(THRUST_COLORS),
      drag: 0.9
    });
  }
}

function update(f) {
  updateParticles(f);
  pointTexts.forEach(pt => pt.update(f));
  pointTexts = pointTexts.filter(pt => pt.life > 0);
  flash = Math.max(0, flash - 0.04 * f);
  displayScore += (score - displayScore) * ease(0.2, f); // HUD score counts up
  if (Math.abs(score - displayScore) < 1) displayScore = score;

  if (!gameStarted) {
    asteroids.forEach(a => a.move(f));
    return;
  }

  if (player.exploded) {
    if (player.lives > 0) {
      if (clock - player.deathTime > RESPAWN_DELAY) respawn();
    } else if (!gameOverShown && clock - player.deathTime > 1200) showGameOver();
  } else if (player.arriveUntil) {
    updateArrival();
  } else {
    updatePlayer(f);
  }

  // Bullets
  bullets.forEach(b => b.move(f));
  for (const b of bullets) {
    for (const a of asteroids) {
      if (a.dead || b.struck?.has(a) || !b.hits(a)) continue;
      if (b.counted && !b.scored) bulletHits++;
      b.scored = true;
      const before = asteroids.length;
      destroyAsteroid(a, {
        cause: 'bullet',
        angle: Math.atan2(b.velY, b.velX),
        trick: b.trick
      });
      if (!b.lance) {
        b.hit = true;
        break;
      }
      b.struck.add(a);
      asteroids.slice(before).forEach(fragment => b.struck.add(fragment));
    }
    if (!b.hit) shootBosses(b);
  }
  bullets = bullets.filter(b => {
    if (b.hit) return false;
    b.bounce();
    // The core swallows bullets quietly: aiming into a black hole doesn't cost the combo
    const core = blackHoles.find(bh => b.hits({ x: bh.x, y: bh.y, hitRadius: BLACK_HOLE_CORE_DRAW }));
    if (core) addParticle({ x: b.x, y: b.y, life: 10, size: 4, color: '#ff6a00', drag: 1 });
    const gone = core || b.x < 0 || b.x > W || b.y < 0 || b.y > H || clock - b.born > BULLET_LIFETIME;
    if (gone && b.counted && !b.scored && !core) resetCombo();
    return !gone;
  });

  // Player collisions
  if (!player.exploded) {
    const invulnerable = shipInvulnerable();
    const shielded = hasPowerUp('shield');

    for (const bh of blackHoles) {
      if (!invulnerable && bh.canCollide() && Math.hypot(player.x - bh.x, player.y - bh.y) < BLACK_HOLE_CORE_RADIUS) {
        killPlayer('black-hole-destroy');
        break;
      }
    }

    for (const a of asteroids) {
      if (player.exploded || a.dead || !a.canCollide()) continue;
      const distance = Math.hypot(player.x - a.x, player.y - a.y);
      const reach = shielded ? SHIELD_RADIUS + a.hitRadius : PLAYER_HIT_RADIUS + a.size * ASTEROID_PLAYER_HIT_RATIO;
      if (distance >= reach) continue;
      if (shielded) {
        destroyAsteroid(a, { cause: 'shield', angle: Math.atan2(a.y - player.y, a.x - player.x) });
      } else if (!invulnerable) {
        killPlayer('game-over');
      }
    }

    for (const p of powerUps) {
      if (!player.exploded && !p.dead && Math.hypot(player.x - p.x, player.y - p.y) < PLAYER_HIT_RADIUS + p.hitRadius) {
        collectPowerUp(p);
      }
    }
  }

  // Black holes swallow asteroids
  for (const bh of blackHoles) {
    if (!bh.canCollide()) continue;
    for (const a of asteroids) {
      if (!a.dead && Math.hypot(a.x - bh.x, a.y - bh.y) < BLACK_HOLE_CORE_RADIUS) {
        destroyAsteroid(a, { cause: 'blackhole' });
      }
    }
  }

  // Spawning
  for (const type in nextPowerUp) {
    if (clock >= nextPowerUp[type]) {
      if (type === 'life' && player.lives >= MAX_LIVES) {
        schedulePowerUp(type);
        continue;
      }
      powerUps.push(new PowerUp(type));
      playSound('power-up-spawn');
      schedulePowerUp(type);
    }
  }
  if (!blackHoles.length && nextBlackHole !== null && clock >= nextBlackHole) {
    blackHoles.push(new BlackHole());
    playSound('black-hole-spawn');
    nextBlackHole = null; // the next one is scheduled when this one collapses
  }
  directWaves();
  pendingAsteroids = pendingAsteroids.filter(time => {
    if (clock < time) return true;
    asteroids.push(new Asteroid());
    playSound('asteroid-spawn', { volume: 0.5 });
    return false;
  });

  // Asteroid-asteroid collisions (elastic, mass ~ area)
  for (let i = 0; i < asteroids.length; i++) {
    const a1 = asteroids[i];
    if (a1.dead) continue;
    for (let j = i + 1; j < asteroids.length; j++) {
      const a2 = asteroids[j];
      if (a2.dead) continue;
      const dx = a1.x - a2.x;
      const dy = a1.y - a2.y;
      const distance = Math.hypot(dx, dy);
      const minDistance = a1.hitRadius + a2.hitRadius;
      if (distance >= minDistance || distance === 0) continue;

      const nx = dx / distance;
      const ny = dy / distance;
      const velAlongNormal = (a1.velX - a2.velX) * nx + (a1.velY - a2.velY) * ny;
      if (velAlongNormal > 0) continue;

      const mass1 = a1.size * a1.size;
      const mass2 = a2.size * a2.size;
      const impulse = (2 * velAlongNormal) / (mass1 + mass2);
      a1.velX -= impulse * nx * mass2;
      a1.velY -= impulse * ny * mass2;
      a2.velX += impulse * nx * mass1;
      a2.velY += impulse * ny * mass1;

      const overlap = (minDistance - distance) / 2;
      a1.x += nx * overlap;
      a1.y += ny * overlap;
      a2.x -= nx * overlap;
      a2.y -= ny * overlap;

      if (-velAlongNormal > 1.2) {
        const cx = a2.x + nx * a2.hitRadius;
        const cy = a2.y + ny * a2.hitRadius;
        for (let k = 0; k < 4; k++) {
          const a = Math.atan2(ny, nx) + Math.PI / 2 + (k % 2 ? Math.PI : 0) + rand(-0.4, 0.4);
          const speed = rand(1, 3);
          addParticle({
            kind: 'spark',
            x: cx,
            y: cy,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            life: rand(8, 16),
            size: 1.5,
            color: k < 2 ? a1.color : a2.color,
            drag: 0.9
          });
        }
      }
    }
  }

  // Gravity
  for (const bh of blackHoles) {
    asteroids.forEach(a => !a.dead && bh.applyGravity(a, f));
    powerUps.forEach(p => bh.applyGravity(p, f));
    bullets.forEach(b => bh.applyGravity(b, f));
    if (!player.exploded) bh.applyGravity(player, f);
  }
  if (player.well && hasPowerUp('well')) {
    const w = player.well;
    w.opacity = clamp((player.timers.well - clock) / 1000, 0, 1); // fades over its last second
    for (const b of bullets) {
      const dx = w.x - b.x;
      const dy = w.y - b.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= WELL_RADIUS || distance === 0) continue;
      b.steer(dx, dy, distance, (WELL_PULL / Math.max(distance, 50)) * w.opacity, f);
    }
    // ...and drags asteroids in and holds them, so the bent shots have a crowd to hit
    for (const a of asteroids) {
      const dx = w.x - a.x;
      const dy = w.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (a.dead || distance >= WELL_GRAB_RADIUS || distance === 0) continue;
      const k = WELL_GRAB * w.opacity * f;
      a.velX = (a.velX + (dx / distance) * k) * WELL_GRAB_DRAG ** (f * w.opacity);
      a.velY = (a.velY + (dy / distance) * k) * WELL_GRAB_DRAG ** (f * w.opacity);
    }
  }
  updateBosses(f);

  asteroids.forEach(a => !a.dead && a.move(f));
  powerUps.forEach(p => p.move(f));
  blackHoles.forEach(bh => bh.move(f));

  asteroids = asteroids.filter(a => !a.dead);
  powerUps = powerUps.filter(p => !p.dead);
  blackHoles = blackHoles.filter(bh => !bh.dead);
}

//
// Draw
//
// Small seeded random, so every palette's nebula shares one cloud layout and only the colors change
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One palette's backdrop, baked once at NEBULA_RES with margin for the drift: base gradient, clouds with
// cyan-lit edges, a dusting of faint stars, and the title screen's violet horizon glow along the bottom. A
// blur pass melts the gradients' 8-bit dither, which the upscale would otherwise blow up into a faint lattice.
const NEBULA_MARGIN = 80; // matches #deepField's inset
let nebulae = [];
function nebulaSprite(index) {
  if (nebulae[index]) return nebulae[index];
  const { a, b, rim } = NEBULA_PALETTES[index];
  const margin = NEBULA_MARGIN;
  const c = document.createElement('canvas');
  c.width = Math.ceil((W + margin * 2) * NEBULA_RES);
  c.height = Math.ceil((H + margin * 2) * NEBULA_RES);
  const g = c.getContext('2d');
  g.scale(NEBULA_RES, NEBULA_RES);
  const w = W + margin * 2;
  const h = H + margin * 2;
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, 'rgb(5, 2, 14)');
  base.addColorStop(1, 'rgb(20, 6, 42)');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

  const r = seeded(1977);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = (0.18 + r() * 0.3) * Math.max(w, h);
    const color = r() < 0.55 ? a : b;
    const cloud = g.createRadialGradient(x, y, 0, x, y, rad);
    cloud.addColorStop(0, hexToRgba(color, NEBULA_ALPHA * (0.5 + r() * 0.5)));
    cloud.addColorStop(0.55, hexToRgba(color, NEBULA_ALPHA * 0.25));
    cloud.addColorStop(1, hexToRgba(color, 0));
    g.fillStyle = cloud;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    if (i % 3 === 0) {
      // A lit edge: a thin offset crescent of cyan on some clouds
      const angle = r() * TAU;
      const ex = x + Math.cos(angle) * rad * 0.45;
      const ey = y + Math.sin(angle) * rad * 0.45;
      const edge = g.createRadialGradient(ex, ey, rad * 0.05, ex, ey, rad * 0.4);
      edge.addColorStop(0, hexToRgba(rim, 0.07));
      edge.addColorStop(1, hexToRgba(rim, 0));
      g.fillStyle = edge;
      g.fillRect(ex - rad * 0.4, ey - rad * 0.4, rad * 0.8, rad * 0.8);
    }
  }
  // The title screen's horizon, as a whisper along the bottom
  const horizon = g.createLinearGradient(0, h - margin - H * 0.22, 0, h);
  horizon.addColorStop(0, 'rgba(255, 77, 255, 0)');
  horizon.addColorStop(1, 'rgba(255, 77, 255, 0.08)');
  g.fillStyle = horizon;
  g.fillRect(0, 0, w, h);

  const soft = document.createElement('canvas');
  soft.width = c.width;
  soft.height = c.height;
  const sg = soft.getContext('2d');
  sg.filter = 'blur(3px)';
  sg.drawImage(c, 0, 0);
  sg.filter = 'none';
  // Star dust caught in the clouds (after the blur, so it stays crisp)
  sg.scale(NEBULA_RES, NEBULA_RES);
  for (let i = 0; i < 260; i++) {
    sg.fillStyle = `rgba(200, 220, 255, ${0.03 + r() * 0.06})`;
    sg.fillRect(r() * w, r() * h, 2, 2);
  }
  nebulae[index] = soft;
  return soft;
}

// The nebula lives in two page layers behind the (transparent) game canvas, not in the canvas itself: the
// compositor drifts it (CSS animation) and crossfades palettes (CSS transition) on the GPU, off the main
// thread, and the canvas never repaints a full-screen backdrop. The palette follows the wave: the title
// screen and wave 1 use the first, then one step per wave.
const deepField = $('deepField');
const nebulaLayers = [...deepField.children];
let nebulaShown = -1; // palette in the front layer
let nebulaFront = 0;

const paletteFor = () => Math.max(0, wave - 1) % NEBULA_PALETTES.length;

function showNebula(index, instant = false) {
  const sprite = nebulaSprite(index);
  nebulaFront = 1 - nebulaFront;
  const front = nebulaLayers[nebulaFront];
  const back = nebulaLayers[1 - nebulaFront];
  front.width = sprite.width;
  front.height = sprite.height;
  front.getContext('2d').drawImage(sprite, 0, 0);
  // The new palette fades in on top of the old one (no dip in brightness), then becomes the base
  front.style.transition = 'none';
  front.style.opacity = '0';
  front.style.zIndex = '1';
  back.style.zIndex = '0';
  void front.offsetWidth;
  front.style.transition = instant ? 'none' : `opacity ${NEBULA_FADE}ms ease-in-out`;
  front.style.opacity = '1';
  nebulaShown = index;
}

function syncNebula() {
  if (paletteFor() !== nebulaShown) showNebula(paletteFor(), nebulaShown < 0);
}

// `fade` < 1 erases the last frame only partway, so it lingers like phosphor on a vector monitor
function drawBackground(fade = 1) {
  syncNebula();
  if (fade >= 1) {
    ctx.clearRect(-30, -30, W + 60, H + 60); // oversized so screen shake never leaves an edge
    return;
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = fade;
  ctx.fillRect(-30, -30, W + 60, H + 60);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// Three layers of stars: each drifts and leans against the ship by its own amount, so the field has depth
let warpScroll = 0; // px the stars have streamed during hyperspace
let warpLast = 0;

function drawStars() {
  // While arriving, the ship's offset would yank the field around: hold the parallax at center
  const offsetX = player.arriveUntil ? 0 : player.x - W / 2;
  const offsetY = player.arriveUntil ? 0 : player.y - H / 2;
  const seconds = REDUCED_MOTION ? 0 : clock / 1000;
  const now = performance.now();
  const warp = warpLevel();
  // Always cruising: the field streams past at a gentle pace (the near layer fastest), and hyperspace is just
  // that pace turned way up, so the launch eases back into cruise instead of stopping dead
  const dt = Math.min(50, now - (warpLast || now));
  warpScroll += (REDUCED_MOTION ? 0 : CRUISE_SPEED + warp * 1.6) * dt;
  warpLast = now;
  let fill = '';
  for (const star of stars) {
    const layer = STAR_LAYERS[star.layer];
    const x = (((star.x - offsetX * layer.parallax - seconds * layer.drift * 0.6) % W) + W) % W;
    const y = (((star.y - offsetY * layer.parallax + seconds * layer.drift + warpScroll * (0.35 + star.layer * 0.45)) % H) + H) % H;
    if (warp > 0.02) {
      // Hyperspace streak, longer for nearer layers
      ctx.globalAlpha = star.brightness;
      ctx.strokeStyle = star.color;
      ctx.lineWidth = Math.max(0.8, star.size);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - warp * (14 + star.layer * 34));
      ctx.stroke();
      continue;
    }
    ctx.globalAlpha = star.twinkle ? star.brightness * (0.55 + 0.45 * Math.sin(clock * star.twinkleSpeed + star.x)) : star.brightness;
    if (fill !== star.color) ctx.fillStyle = fill = star.color;
    if (star.size < 1) {
      ctx.fillRect(x, y, star.size * 1.6, star.size * 1.6);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, star.size, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// Pulp rocket, rim-lit in neon. Shading is axial (bright spine, darker flanks) so it reads the same at
// any rotation. Local units, drawn at ROCKET_SCALE: nose tip at y = -18.5 (NOSE_OFFSET), nozzle at y ≈ 13.
function paintClassic(g, s, color) {
  const dark = mixHex(color, SPACE_INK, 0.45);
  const light = mixHex(color, '#ffffff', 0.45);
  const rim = mixHex(color, '#ffffff', 0.7);
  const body = () => {
    g.beginPath();
    g.moveTo(0, -18.5);
    g.bezierCurveTo(4.2, -16.5, 6.6, -9, 6.6, -1.5);
    g.bezierCurveTo(6.6, 4.5, 5.4, 8.5, 4.4, 11);
    g.lineTo(-4.4, 11);
    g.bezierCurveTo(-5.4, 8.5, -6.6, 4.5, -6.6, -1.5);
    g.bezierCurveTo(-6.6, -9, -4.2, -16.5, 0, -18.5);
    g.closePath();
  };
  const fin = side => {
    g.beginPath();
    g.moveTo(side * 5.6, -1);
    g.quadraticCurveTo(side * 10.5, 4, side * 10.8, 14);
    g.lineTo(side * 7.5, 12.2);
    g.lineTo(side * 4.2, 11);
    g.closePath();
  };
  const nozzle = () => {
    g.beginPath();
    g.moveTo(-3.4, 10.5);
    g.lineTo(3.4, 10.5);
    g.lineTo(4.4, 13.6);
    g.lineTo(-4.4, 13.6);
    g.closePath();
  };
  // Three axial bands (dark flanks, color, lit spine) inside the current clip
  const bands = (d, m, l) => {
    for (const [k, fill] of [[1, d], [0.66, m], [0.24, l]]) {
      g.save();
      g.scale(k, k === 0.24 ? 0.94 : 1);
      body();
      g.fillStyle = fill;
      g.fill();
      g.restore();
    }
  };
  g.lineJoin = g.lineCap = 'round';

  // Neon edge + halo behind everything
  g.shadowColor = color;
  g.shadowBlur = 9 * s;
  g.strokeStyle = rim;
  g.fillStyle = SPACE_INK;
  g.lineWidth = 2;
  for (const part of [() => fin(-1), () => fin(1), nozzle, body]) {
    part();
    g.stroke();
    g.fill();
  }
  g.shadowBlur = 0;

  // Fins: dark with a lit leading edge
  for (const side of [-1, 1]) {
    fin(side);
    g.fillStyle = mixHex(color, SPACE_INK, 0.65);
    g.fill();
    g.save();
    fin(side);
    g.clip();
    g.beginPath();
    g.moveTo(side * 5.6, -1);
    g.quadraticCurveTo(side * 10.5, 4, side * 10.8, 14);
    g.lineTo(side * 9, 13);
    g.quadraticCurveTo(side * 8.4, 5, side * 4.6, 2);
    g.closePath();
    g.fillStyle = mixHex(color, SPACE_INK, 0.3);
    g.fill();
    g.restore();
  }

  // Gunmetal nozzle
  nozzle();
  g.fillStyle = '#3b3358';
  g.fill();
  g.fillStyle = '#8f86b8';
  g.fillRect(-1, 10.5, 2, 3.1);

  // Body in the player's color, then a cream nose cap and belly stripe in the same bands
  g.save();
  body();
  g.clip();
  bands(dark, color, light);
  g.beginPath();
  g.rect(-8, -20, 16, 8.2);
  g.rect(-8, 3.2, 16, 2.6);
  g.clip();
  bands('#c9b3d6', CREAM, '#ffffff');
  g.restore();

  // Inner rim light, then seams
  g.save();
  body();
  g.clip();
  body();
  g.strokeStyle = rim;
  g.globalAlpha = 0.85;
  g.lineWidth = 1.4;
  g.stroke();
  g.restore();
  g.strokeStyle = SPACE_INK;
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(-6.4, -10.3);
  g.quadraticCurveTo(0, -11.3, 6.4, -10.3);
  g.moveTo(-6.6, 3.2);
  g.lineTo(6.6, 3.2);
  g.moveTo(-6.4, 5.8);
  g.lineTo(6.4, 5.8);
  g.stroke();

  // Porthole: cream ring, deep glass, one glint
  g.beginPath();
  g.arc(0, -4, 3.5, 0, TAU);
  g.fillStyle = CREAM;
  g.fill();
  g.lineWidth = 0.9;
  g.stroke();
  g.beginPath();
  g.arc(0, -4, 2.3, 0, TAU);
  g.fillStyle = '#1a1050';
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(0, -4, 2.3, Math.PI * 1.05, Math.PI * 1.6);
  g.arc(0, -4, 1.1, Math.PI * 1.6, Math.PI * 1.05, true);
  g.fillStyle = '#9ff3ff';
  g.fill();
}

//
// Hulls: same paint, different personality. Every hull keeps the fixed points above (nose tip y = -18.5,
// engine mouth y ≈ 13), so bullets and the thrust flame line up on all of them.
//
// IN-BETWEEN hulls: a capable pilot's ship. Sleek, sporty, confident; neither cute nor menacing.
// Each paint(g, s, color) is a makeSprite paint: nose UP, centered on 0,0, inside the 56-unit box.
// Fixed points match the pulp rocket: nose tip at y = -18.5 (NOSE_OFFSET), engine mouth at y ≈ 13.6 (flame baseY 13).
// Every shade comes from the one paint color (mixHex toward SPACE_INK / white), plus CREAM and gunmetal accents.

// Same recipe as getRocketSprite, plus two wing tones
function hullShades(color) {
  return {
    dark: mixHex(color, SPACE_INK, 0.45),
    light: mixHex(color, '#ffffff', 0.45),
    rim: mixHex(color, '#ffffff', 0.7),
    deep: mixHex(color, SPACE_INK, 0.65), // wings sit "below" the fuselage
    edge: mixHex(color, SPACE_INK, 0.25) // lit leading edges
  };
}

// Neon edge + halo behind everything: each part stroked in the rim color with a colored glow, then inked in
function hullHalo(g, s, color, rim, parts) {
  g.shadowColor = color;
  g.shadowBlur = 9 * s;
  g.strokeStyle = rim;
  g.fillStyle = SPACE_INK;
  g.lineWidth = 2;
  for (const part of parts) {
    part();
    g.stroke();
    g.fill();
  }
  g.shadowBlur = 0;
}

// Axial cel bands (dark flanks, color, lit spine), squeezed in x only so the bands run nose to tail and
// the spine highlight tapers into the tip. Reads the same at any rotation, like the pulp rocket.
function hullBands(g, path, d, m, l, cx = 0) {
  for (const [k, fill] of [[1, d], [0.62, m], [0.22, l]]) {
    g.save();
    g.translate(cx, 0);
    g.scale(k, 1);
    path();
    g.fillStyle = fill;
    g.fill();
    g.restore();
  }
}

// Inner rim light hugging a part's edge
function hullRimLight(g, path, rim, width = 1.4) {
  g.save();
  path();
  g.clip();
  path();
  g.strokeStyle = rim;
  g.globalAlpha = 0.85;
  g.lineWidth = width;
  g.stroke();
  g.restore();
}

// Wing panel: deep tone, then the leading edge stroked fat inside a clip so half of it shows as a lit strip
function hullWing(g, path, leadingEdge, deep, edge) {
  path();
  g.fillStyle = deep;
  g.fill();
  g.save();
  path();
  g.clip();
  leadingEdge();
  g.strokeStyle = edge;
  g.lineWidth = 3.6;
  g.stroke();
  g.restore();
}

// Gunmetal engine bell with one highlight, same materials as the pulp rocket's nozzle
function hullNozzle(g, cx, top, bottom) {
  g.beginPath();
  g.moveTo(cx - top, 10.5);
  g.lineTo(cx + top, 10.5);
  g.lineTo(cx + bottom, 13.6);
  g.lineTo(cx - bottom, 13.6);
  g.closePath();
  g.fillStyle = '#3b3358';
  g.fill();
  g.fillStyle = '#8f86b8';
  g.fillRect(cx - 0.8, 10.5, 1.6, 3.1);
}

// Teardrop canopy, pointed toward the nose: cream frame, deep glass, cyan glint
function hullCanopy(g, top, bottom, w) {
  const drop = (t, b, hw) => {
    g.beginPath();
    g.moveTo(0, t);
    g.quadraticCurveTo(hw, t + (b - t) * 0.3, hw, b - hw);
    g.arc(0, b - hw, hw, 0, Math.PI);
    g.quadraticCurveTo(-hw, t + (b - t) * 0.3, 0, t);
  };
  g.strokeStyle = SPACE_INK;
  g.lineWidth = 0.9;
  drop(top, bottom, w);
  g.fillStyle = CREAM;
  g.fill();
  g.stroke();
  drop(top + 1.3, bottom - 0.9, w - 0.9);
  g.fillStyle = '#1a1050';
  g.fill();
  g.lineWidth = 0.6;
  g.stroke();
  // Glint: a sliver down the left of the glass
  g.beginPath();
  g.moveTo(-(w - 0.9) * 0.55, bottom - w - 0.2);
  g.quadraticCurveTo(-(w - 0.9) * 0.6, top + (bottom - top) * 0.35, -0.2, top + 2.4);
  g.strokeStyle = '#9ff3ff';
  g.lineWidth = 0.75;
  g.lineCap = 'round';
  g.stroke();
}

// A. KESTREL — the racer. Long needle nose, cockpit set far back like a dragster, swept delta wings with cream
// tips, twin racing stripes. At 0.5x it's an arrowhead with two bright wingtip dots and a light spine.
function paintKestrel(g, s, color) {
  const c = hullShades(color);
  const body = () => {
    g.beginPath();
    g.moveTo(0, -18.5);
    g.bezierCurveTo(2.4, -14.5, 4.4, -7, 4.4, 0);
    g.bezierCurveTo(4.4, 4.5, 4.1, 8, 3.6, 11);
    g.lineTo(-3.6, 11);
    g.bezierCurveTo(-4.1, 8, -4.4, 4.5, -4.4, 0);
    g.bezierCurveTo(-4.4, -7, -2.4, -14.5, 0, -18.5);
    g.closePath();
  };
  const leading = side => {
    g.beginPath();
    g.moveTo(side * 3.9, -5);
    g.quadraticCurveTo(side * 8.5, 1, side * 12.6, 9.2);
  };
  const wing = side => {
    leading(side);
    g.lineTo(side * 12.4, 11.8);
    g.lineTo(side * 8, 8.6);
    g.lineTo(side * 3.6, 10.4);
    g.closePath();
  };
  const nozzle = () => {
    g.beginPath();
    g.moveTo(-3.3, 10.5);
    g.lineTo(3.3, 10.5);
    g.lineTo(4.4, 13.6);
    g.lineTo(-4.4, 13.6);
    g.closePath();
  };
  g.lineJoin = g.lineCap = 'round';
  hullHalo(g, s, color, c.rim, [() => wing(-1), () => wing(1), nozzle, body]);

  // Wings, then cream tips: the brightest thing on the silhouette after the canopy, so the sweep reads small
  for (const side of [-1, 1]) {
    hullWing(g, () => wing(side), () => leading(side), c.deep, c.edge);
    g.save();
    wing(side);
    g.clip();
    g.fillStyle = CREAM;
    g.fillRect(side > 0 ? 9.2 : -14, 0, 4.8, 14);
    g.strokeStyle = SPACE_INK;
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(side * 9.2, 3);
    g.lineTo(side * 9.2, 12);
    g.stroke();
    g.restore();
  }

  hullNozzle(g, 0, 3.3, 4.4);

  // Fuselage: bands, then twin cream racing stripes nose to tail
  g.save();
  body();
  g.clip();
  hullBands(g, body, c.dark, color, c.light);
  g.fillStyle = CREAM;
  g.fillRect(-2.5, -20, 1.1, 32);
  g.fillRect(1.4, -20, 1.1, 32);
  g.restore();
  hullRimLight(g, body, c.rim);

  // Seams: a nose-cone joint and an aft panel line
  g.strokeStyle = SPACE_INK;
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(-3.3, -9.5);
  g.quadraticCurveTo(0, -10.6, 3.3, -9.5);
  g.moveTo(-4.2, 6.4);
  g.lineTo(4.2, 6.4);
  g.stroke();

  // Cockpit sits aft: a long nose ahead of the pilot says "speed"
  hullCanopy(g, -5.2, 3.6, 2.1);
}

// B. PATHFINDER — the explorer. A sturdy capsule with a wraparound observation visor, carried on short pylons
// between twin outrigger nacelles with cream nose caps. At 0.5x it's a catamaran: three bright tips side by side.
function paintPathfinder(g, s, color) {
  const c = hullShades(color);
  const NX = 9.8; // nacelle centerline
  const body = () => {
    g.beginPath();
    g.moveTo(0, -18.5);
    g.bezierCurveTo(3.2, -17.2, 4.9, -12.5, 4.9, -6);
    g.lineTo(4.6, 6);
    g.bezierCurveTo(4.6, 8.6, 4.3, 10.2, 3.8, 11.2);
    g.lineTo(-3.8, 11.2);
    g.bezierCurveTo(-4.3, 10.2, -4.6, 8.6, -4.6, 6);
    g.lineTo(-4.9, -6);
    g.bezierCurveTo(-4.9, -12.5, -3.2, -17.2, 0, -18.5);
    g.closePath();
  };
  // Nacelle in local coordinates (centered on x = 0)
  const pod = () => {
    g.beginPath();
    g.moveTo(0, -5.5);
    g.bezierCurveTo(1.4, -4.4, 2.3, -1.5, 2.3, 1.5);
    g.lineTo(1.8, 10.4);
    g.lineTo(-1.8, 10.4);
    g.lineTo(-2.3, 1.5);
    g.bezierCurveTo(-2.3, -1.5, -1.4, -4.4, 0, -5.5);
    g.closePath();
  };
  const nacelle = side => {
    g.save();
    g.translate(side * NX, 0);
    pod();
    g.restore();
  };
  const pylon = side => {
    g.beginPath();
    g.moveTo(side * 4.7, -4);
    g.lineTo(side * NX, 2.5);
    g.lineTo(side * NX, 6.5);
    g.lineTo(side * 4.6, 5.5);
    g.closePath();
  };
  const nozzle = () => {
    g.beginPath();
    g.moveTo(-3.5, 10.5);
    g.lineTo(3.5, 10.5);
    g.lineTo(4.4, 13.6);
    g.lineTo(-4.4, 13.6);
    g.closePath();
  };
  g.lineJoin = g.lineCap = 'round';
  hullHalo(g, s, color, c.rim, [() => pylon(-1), () => pylon(1), () => nacelle(-1), () => nacelle(1), nozzle, body]);

  for (const side of [-1, 1]) {
    pylon(side);
    g.fillStyle = c.deep;
    g.fill();
    g.save();
    pylon(side);
    g.clip();
    g.beginPath();
    g.moveTo(side * 4.7, -4);
    g.lineTo(side * NX, 2.5);
    g.strokeStyle = c.edge;
    g.lineWidth = 3;
    g.stroke();
    g.restore();

    // Nacelle: its own bands, a cream nose cap, and a hot exhaust ring at the tail
    g.save();
    nacelle(side);
    g.clip();
    hullBands(g, pod, c.dark, color, c.light, side * NX);
    g.beginPath();
    g.rect(side * NX - 3, -7, 6, 5.2);
    g.clip();
    hullBands(g, pod, '#c9b3d6', CREAM, '#ffffff', side * NX);
    g.restore();
    hullRimLight(g, () => nacelle(side), c.rim, 1);
    g.fillStyle = '#3b3358';
    g.fillRect(side * NX - 1.4, 9.2, 2.8, 1.2);
    g.fillStyle = c.rim;
    g.fillRect(side * NX - 0.8, 9.5, 1.6, 0.7);
  }

  hullNozzle(g, 0, 3.5, 4.4);

  // Fuselage: plain bands, so the visor and the pods carry the identity
  g.save();
  body();
  g.clip();
  hullBands(g, body, c.dark, color, c.light);
  g.restore();
  hullRimLight(g, body, c.rim);

  // Seams: pylon roots and an aft engine-bay line
  g.strokeStyle = SPACE_INK;
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(-4.4, 6.6);
  g.quadraticCurveTo(0, 5.8, 4.4, 6.6);
  g.moveTo(-4.7, -1.5);
  g.lineTo(-4.7, 4.2);
  g.moveTo(4.7, -1.5);
  g.lineTo(4.7, 4.2);
  g.stroke();

  // Wraparound visor: a cream-framed band of glass across the whole nose, the explorer's wide view
  const visor = (top, bottom) => {
    g.beginPath();
    g.moveTo(-6, top + 2);
    g.quadraticCurveTo(0, top - 1.6, 6, top + 2);
    g.lineTo(6, bottom + 2);
    g.quadraticCurveTo(0, bottom - 1.6, -6, bottom + 2);
    g.closePath();
  };
  g.save();
  body();
  g.clip();
  visor(-14, -7.6);
  g.fillStyle = CREAM;
  g.fill();
  visor(-12.9, -8.7);
  g.fillStyle = '#1a1050';
  g.fill();
  g.lineWidth = 0.6;
  g.stroke();
  g.beginPath();
  g.moveTo(-3.6, -11.4);
  g.quadraticCurveTo(-1.6, -12.4, 0.4, -12.5);
  g.strokeStyle = '#9ff3ff';
  g.lineWidth = 0.8;
  g.stroke();
  g.restore();
}

// C. SWIFT — the sport flyer. A teardrop lifting body with crescent wings swept back to points like a swift's,
// a bubble canopy set forward, twin engine bells and a cream aerobatic chevron across the whole wingspan.
// At 0.5x the chevron is a bright "^" that says which way it's going.
function paintSwift(g, s, color) {
  const c = hullShades(color);
  const body = () => {
    g.beginPath();
    g.moveTo(0, -18.5);
    g.bezierCurveTo(3, -16, 5.4, -9.5, 5.4, -2.5);
    g.bezierCurveTo(5.4, 3.5, 5, 8.6, 4.6, 11.2);
    g.lineTo(-4.6, 11.2);
    g.bezierCurveTo(-5, 8.6, -5.4, 3.5, -5.4, -2.5);
    g.bezierCurveTo(-5.4, -9.5, -3, -16, 0, -18.5);
    g.closePath();
  };
  const leading = side => {
    g.beginPath();
    g.moveTo(side * 4.8, -6);
    g.bezierCurveTo(side * 9.5, -4.5, side * 12.6, 3, side * 13.2, 13);
  };
  const wing = side => {
    leading(side);
    g.quadraticCurveTo(side * 10, 6.6, side * 4.6, 7.6);
    g.closePath();
  };
  const nozzles = () => {
    g.beginPath();
    for (const x of [-2.3, 2.3]) {
      g.moveTo(x - 1.6, 10.5);
      g.lineTo(x + 1.6, 10.5);
      g.lineTo(x + 2, 13.6);
      g.lineTo(x - 2, 13.6);
      g.closePath();
    }
  };
  // Aerobatic chevron, pointing at the nose
  const chevron = () => {
    g.beginPath();
    g.moveTo(0, -7.6);
    g.lineTo(15, 5.4);
    g.lineTo(15, 8.2);
    g.lineTo(0, -4.8);
    g.lineTo(-15, 8.2);
    g.lineTo(-15, 5.4);
    g.closePath();
  };
  g.lineJoin = g.lineCap = 'round';
  hullHalo(g, s, color, c.rim, [() => wing(-1), () => wing(1), nozzles, body]);

  for (const side of [-1, 1]) {
    hullWing(g, () => wing(side), () => leading(side), c.deep, c.edge);
    g.save();
    wing(side);
    g.clip();
    chevron();
    g.fillStyle = CREAM;
    g.fill();
    g.restore();
  }

  hullNozzle(g, -2.3, 1.6, 2);
  hullNozzle(g, 2.3, 1.6, 2);

  g.save();
  body();
  g.clip();
  hullBands(g, body, c.dark, color, c.light);
  chevron();
  g.clip();
  hullBands(g, body, '#c9b3d6', CREAM, '#ffffff');
  g.restore();
  hullRimLight(g, body, c.rim);

  g.strokeStyle = SPACE_INK;
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(-5, 5.6);
  g.quadraticCurveTo(0, 4.8, 5, 5.6);
  g.moveTo(0, 6.5);
  g.lineTo(0, 10.6);
  g.stroke();

  // Bubble canopy well forward: the pilot sits up front, a fighter-trainer posture
  hullCanopy(g, -15, -6.4, 2.7);
}

// WAR MACHINE hulls. Each paint(g, s, color) is a drop-in for the getRocketSprite() paint callback:
// nose up, centered on 0,0, inside the 56-unit ROCKET_SPRITE_SIZE box. Nose tip at y = -18.5 (NOSE_OFFSET),
// engine mouth at y ≈ 13 where drawPlayer's flame attaches. Every shade comes from the paint color via mixHex,
// plus fixed CREAM, SPACE_INK, house gunmetal and a hot visor glow. Uses mixHex / SPACE_INK / CREAM from main.js.

const GUN = '#3b3358'; // same gunmetal as the current rocket's nozzle
const GUN_LIT = '#8f86b8';
const GUN_DEEP = '#221b36';
const VISOR = '#ffbf00'; // the bullets' amber: the visor glows like the guns are hot, never enemy red
const VISOR_CORE = '#fff2c0'; // thrust-flame core

// Path from a point list
function warPoly(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}

// Mirrors a right-side outline (top to bottom) into a closed symmetric hull
function warSym(half) {
  return [...half, ...half.map(([x, y]) => [-x, y]).reverse()];
}

function warShades(color) {
  return {
    dark: mixHex(color, SPACE_INK, 0.45),
    deep: mixHex(color, SPACE_INK, 0.68),
    light: mixHex(color, '#ffffff', 0.45),
    rim: mixHex(color, '#ffffff', 0.7),
    gun: mixHex(GUN, color, 0.12) // gunmetal with a whisper of paint so the metal belongs to the ship
  };
}

// Neon edge + halo behind everything: the same treatment as the rocket, so every hull still reads as the hero
function warHalo(g, s, color, rim, parts) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.shadowColor = color;
  g.shadowBlur = 9 * s;
  g.strokeStyle = rim;
  g.fillStyle = SPACE_INK;
  g.lineWidth = 2;
  for (const part of parts) {
    part();
    g.stroke();
    g.fill();
  }
  g.shadowBlur = 0;
}

// Chined armor: three vertical facets (dark flanks, paint, lit ridge). Scaling only x keeps the facets
// hard-edged and running to the nose, which reads as plate rather than the rocket's rounded tube.
function warFacets(g, shape, d, m, l) {
  for (const [k, fill] of [[1, d], [0.62, m], [0.2, l]]) {
    g.save();
    g.scale(k, 1);
    shape();
    g.fillStyle = fill;
    g.fill();
    g.restore();
  }
}

// Inner rim light so the armor edge catches the neon
function warRimLight(g, shape, rim) {
  g.save();
  shape();
  g.clip();
  shape();
  g.strokeStyle = rim;
  g.globalAlpha = 0.85;
  g.lineWidth = 1.3;
  g.stroke();
  g.restore();
}

// A recessed slot with a hot amber glow inside (the menacing eye)
function warVisor(g, s, outer, inner) {
  warPoly(g, outer);
  g.fillStyle = SPACE_INK;
  g.fill();
  g.save();
  g.shadowColor = VISOR;
  g.shadowBlur = 4 * s;
  warPoly(g, inner);
  g.fillStyle = VISOR;
  g.fill();
  g.restore();
  // White-hot core: the same slot squeezed toward its center
  const cx = inner.reduce((a, p) => a + p[0], 0) / inner.length;
  const cy = inner.reduce((a, p) => a + p[1], 0) / inner.length;
  warPoly(g, inner.map(([x, y]) => [cx + (x - cx) * 0.8, cy + (y - cy) * 0.4]));
  g.fillStyle = VISOR_CORE;
  g.fill();
}

// A gunmetal armor slab laid over the paint, clipped to the hull: dark flanks, metal, a lit ridge
function warPlate(g, hull, region, gun) {
  g.save();
  hull();
  g.clip();
  warPoly(g, region);
  g.clip();
  warFacets(g, hull, GUN_DEEP, gun, GUN_LIT);
  g.restore();
}
// ---------------------------------------------------------------------------------------------------------
// B: REAVER. A strike fighter cut like a blade: dagger fuselage, raked canards over two root cannons,
// swept wings with a sawtooth trailing edge, and a gunmetal canopy helmet with two glaring slits.
// The arrowhead silhouette points wherever you aim.
function paintReaver(g, s, color) {
  const { dark, deep, light, rim, gun } = warShades(color);
  const body = () => warPoly(g, warSym([[0, -18.5], [1.9, -14], [3.4, -7], [4, 2], [3.6, 11]]));
  const wing = side =>
    warPoly(g, [[side * 3.4, -6], [side * 13, 9.6], [side * 10.4, 8], [side * 9.6, 10], [side * 7, 7.2], [side * 3.8, 9.8]]);
  const canard = side => warPoly(g, [[side * 3, -12.4], [side * 7.4, -10], [side * 7, -8.6], [side * 3.2, -8.8]]);
  const cannon = side => {
    g.beginPath();
    g.rect(side * 4.9 - 0.8, -11.6, 1.6, 8);
  };
  const nozzle = () => warPoly(g, [[-3.4, 10.6], [3.4, 10.6], [4.4, 13.6], [-4.4, 13.6]]);

  warHalo(g, s, color, rim, [() => wing(-1), () => wing(1), () => cannon(-1), () => cannon(1), () => canard(-1), () => canard(1), nozzle, body]);

  for (const side of [-1, 1]) {
    // Wing: deep underside, paint on the leading third, lit leading edge
    wing(side);
    g.fillStyle = deep;
    g.fill();
    warPoly(g, [[side * 3.4, -6], [side * 13, 9.6], [side * 11.4, 8.6], [side * 3.6, 1]]);
    g.fillStyle = dark;
    g.fill();
    warPoly(g, [[side * 3.4, -6], [side * 13, 9.6], [side * 12, 9.2], [side * 3.6, -2.8]]);
    g.fillStyle = color;
    g.fill();
    // Cream hazard bands near the tip, raked along the sweep
    g.save();
    wing(side);
    g.clip();
    g.fillStyle = CREAM;
    for (const k of [0, 1.6]) warPoly(g, [[side * (8.6 + k), 2], [side * (9.5 + k), 2], [side * (8.3 + k), 10], [side * (7.4 + k), 10]]), g.fill();
    g.restore();

    // Root cannons: gunmetal, lit spine, dark bore
    cannon(side);
    g.fillStyle = gun;
    g.fill();
    g.fillStyle = GUN_LIT;
    g.fillRect(side * 4.9 - 0.3, -11.2, 0.6, 7.2);
    g.fillStyle = SPACE_INK;
    g.fillRect(side * 4.9 - 0.4, -11.6, 0.8, 0.8);

    // Canards: gunmetal blades over the guns
    canard(side);
    g.fillStyle = gun;
    g.fill();
    warPoly(g, [[side * 3, -12.4], [side * 7.4, -10], [side * 7.2, -9.4], [side * 3.1, -11.2]]);
    g.fillStyle = GUN_LIT;
    g.fill();
  }

  nozzle();
  g.fillStyle = gun;
  g.fill();
  g.fillStyle = GUN_LIT;
  g.fillRect(-1, 10.6, 2, 3);

  // Fuselage: chined paint, gunmetal needle nose and canopy helmet
  g.save();
  body();
  g.clip();
  warFacets(g, body, dark, color, light);
  g.restore();
  warPlate(g, body, [[-5, -20], [5, -20], [5, -15.6], [0, -14], [-5, -15.6]], gun);
  warPlate(g, body, [[-5, -12.4], [0, -10.8], [5, -12.4], [5, -4.6], [0, -2.6], [-5, -4.6]], gun);
  warRimLight(g, body, rim);

  // Spine seams
  g.strokeStyle = SPACE_INK;
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(0, -2.6);
  g.lineTo(0, 9.6);
  g.moveTo(-3.8, 4);
  g.lineTo(0, 6.2);
  g.lineTo(3.8, 4);
  g.stroke();

  // Twin glaring slits, raked inward toward the nose
  for (const side of [-1, 1]) {
    warVisor(
      g,
      s,
      [[side * 0.5, -9.4], [side * 3.3, -8], [side * 3.3, -5.8], [side * 0.5, -7.2]],
      [[side * 0.9, -8.8], [side * 2.8, -7.8], [side * 2.8, -6.6], [side * 0.9, -7.6]]
    );
  }
}

// ---------------------------------------------------------------------------------------------------------
// C: DREADNOUGHT. A siege tower with a railgun for a nose: twin gunmetal rails with the paint charging
// between them, a gunmetal glacis plate with a bar visor like a tank's, and armored intake sponsons.
function paintDreadnought(g, s, color) {
  const { dark, deep, light, rim, gun } = warShades(color);
  const body = () =>
    warPoly(g, warSym([[0, -11.8], [4.4, -11.8], [8.6, -7.6], [9, 4], [6.8, 10.6], [4.8, 11.2]]));
  const sponson = side => warPoly(g, [[side * 8, -5.8], [side * 11.2, -3.8], [side * 12, 7.6], [side * 9.8, 11.8], [side * 7, 9.4]]);
  const rail = side => warPoly(g, [[side * 0.9, -18.5], [side * 3.1, -17.2], [side * 3.1, -11], [side * 0.9, -11]]);
  const nozzle = () => warPoly(g, [[-4.4, 10.6], [4.4, 10.6], [5.4, 13.6], [-5.4, 13.6]]);

  warHalo(g, s, color, rim, [() => sponson(-1), () => sponson(1), () => rail(-1), () => rail(1), nozzle, body]);

  // Charge channel between the rails, glowing in the paint (lit once, so shadowBlur is fine here)
  g.save();
  g.shadowColor = color;
  g.shadowBlur = 6 * s;
  g.fillStyle = light;
  g.fillRect(-0.9, -17.8, 1.8, 7);
  g.fillStyle = '#ffffff';
  g.fillRect(-0.35, -17.4, 0.7, 6.2);
  g.restore();

  // Rails: gunmetal, cream muzzle tips, lit inner edges, dark collars
  for (const side of [-1, 1]) {
    rail(side);
    g.fillStyle = gun;
    g.fill();
    warPoly(g, [[side * 0.9, -18.5], [side * 3.1, -17.2], [side * 3.1, -15.8], [side * 0.9, -16.6]]);
    g.fillStyle = CREAM;
    g.fill();
    g.fillStyle = GUN_LIT;
    g.fillRect(side > 0 ? 0.9 : -1.6, -15.8, 0.7, 4.6);
    g.fillStyle = SPACE_INK;
    for (const y of [-14.4, -12.6]) g.fillRect(side > 0 ? 0.9 : -3.1, y, 2.2, 0.5);
  }

  // Sponsons: deep plate, lit outer face, cream hazard band, intake grille up front
  for (const side of [-1, 1]) {
    sponson(side);
    g.fillStyle = deep;
    g.fill();
    warPoly(g, [[side * 11.2, -3.8], [side * 12, 7.6], [side * 9.8, 11.8], [side * 9.6, 7.2], [side * 9.4, -3.4]]);
    g.fillStyle = dark;
    g.fill();
    g.save();
    sponson(side);
    g.clip();
    warPoly(g, [[side * 6, 4.4], [side * 13, 3], [side * 13, 4.4], [side * 6, 5.8]]);
    g.fillStyle = CREAM;
    g.fill();
    g.restore();
    warPoly(g, [[side * 8.4, -4.4], [side * 10.8, -3], [side * 11, 1], [side * 8.6, 0.4]]);
    g.fillStyle = SPACE_INK;
    g.fill();
    g.fillStyle = gun;
    for (const y of [-2.6, -1.2, 0.2]) g.fillRect(side > 0 ? 8.6 : -10.9, y, 2.3, 0.5);
  }

  nozzle();
  g.fillStyle = gun;
  g.fill();
  g.fillStyle = GUN_LIT;
  for (const x of [-3, -0.5, 2]) g.fillRect(x, 10.8, 1, 2.6);

  // Hull: faceted paint below, a gunmetal glacis plate up top
  g.save();
  body();
  g.clip();
  warFacets(g, body, dark, color, light);
  g.strokeStyle = SPACE_INK;
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(-9, 5.4);
  g.lineTo(0, 2.6);
  g.lineTo(9, 5.4);
  g.moveTo(0, -2);
  g.lineTo(0, 10.6);
  g.stroke();
  g.restore();
  const glacis = [[-10, -13], [10, -13], [10, -4.4], [0, -1.8], [-10, -4.4]];
  warPlate(g, body, glacis, gun);
  g.save();
  body();
  g.clip();
  g.strokeStyle = GUN_LIT; // lit lower lip of the glacis
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(-10, -4.4);
  g.lineTo(0, -1.8);
  g.lineTo(10, -4.4);
  g.stroke();
  g.restore();
  warRimLight(g, body, rim);

  // Bar visor: one long slit with hard angled ends, like a tank's vision block
  warVisor(
    g,
    s,
    [[-6, -9.4], [6, -9.4], [4.8, -6.6], [-4.8, -6.6]],
    [[-5, -8.8], [5, -8.8], [4.2, -7.3], [-4.2, -7.3]]
  );
}

// Each hull trades one strength for one weakness against Classic (SHIP_BASE). Gaps are ~30-75% so the pick
// feels like a play style (smaller gaps don't read in play), never a power ladder. Muzzles are where shots
// leave, in hull units; with two, shots alternate between them (one bullet per shot either way).
const SHIP_BASE = {
  speed: 4, // top speed, px/frame
  accel: 0.2, // thrust responsiveness (lerp rate toward top speed; a true force in zero G)
  drift: 0.98, // velocity kept per frame when coasting (higher = slides longer)
  turn: 0.08, // rad/frame
  cooldown: 200, // ms between shots
  bulletSpeed: 15, // faster flies straighter: black holes bend it less
  gravity: 1, // black hole pull on the hull
  powerUps: 1, // power-up duration multiplier
  damage: 1 // boss damage per hit (asteroids die to any hit)
};
const SHIPS = {
  classic: {
    label: 'Classic',
    kind: 'All-rounder',
    paint: paintClassic,
    muzzles: [[0, -18.5]],
    stats: {},
    pros: ['Balanced: no trade-offs'],
    cons: []
  },
  kestrel: {
    label: 'Kestrel',
    kind: 'Racer',
    paint: paintKestrel,
    muzzles: [[0, -18.5]],
    stats: { speed: 5.6, accel: 0.24, drift: 0.99 },
    pros: ['Top speed +40%, quick off the line'],
    cons: ['Drifts: coasts twice as far']
  },
  swift: {
    label: 'Swift',
    kind: 'Sport flyer',
    paint: paintSwift,
    muzzles: [[0, -18.5]],
    stats: { turn: 0.12, drift: 0.94, speed: 3.4, accel: 0.28 },
    pros: ['Turns 50% faster, snappy thrust', 'Stops on a dime'],
    cons: ['Top speed −15%']
  },
  pathfinder: {
    label: 'Pathfinder',
    kind: 'Explorer',
    paint: paintPathfinder,
    muzzles: [[0, -18.5]],
    stats: { powerUps: 1.5, cooldown: 250 },
    pros: ['Power-ups last 50% longer'],
    cons: ['Fires 20% slower']
  },
  reaver: {
    label: 'Reaver',
    kind: 'Strike fighter',
    paint: paintReaver,
    muzzles: [[-4.9, -11.6], [4.9, -11.6]],
    stats: { cooldown: 115, bulletSpeed: 13, turn: 0.06 },
    pros: ['Bullet hose: fires 75% faster (twin cannons)'],
    cons: ['Turns 25% slower', 'Light rounds fly 13% slower']
  },
  dreadnought: {
    label: 'Dreadnought',
    kind: 'Siege tower',
    paint: paintDreadnought,
    muzzles: [[0, -18.5]],
    stats: { bulletSpeed: 24, cooldown: 340, damage: 2, gravity: 0.25, speed: 2.9, accel: 0.12, drift: 0.985 },
    pros: ['Railgun: shots fly 60% faster, hit bosses twice as hard', 'Black holes barely pull it'],
    cons: ['Heavy: top speed −28%, sluggish thrust', 'Railgun fires 40% slower, barely bends']
  }
};
let ship = SHIP_BASE; // the flown hull's stats

function selectHull(key) {
  rocketHull = key;
  ship = { ...SHIP_BASE, ...SHIPS[key].stats };
  rocketSprite = null;
}

// Stat pips (1–5, Classic = 3) for the hangar, computed from the real numbers so they can't drift from them
function shipPips(stats) {
  const pips = v => clamp(Math.round(3 + v), 1, 5);
  return {
    Speed: pips((stats.speed / SHIP_BASE.speed - 1) * 10 + (stats.accel / SHIP_BASE.accel - 1) * 2),
    Handling: pips((stats.turn / SHIP_BASE.turn - 1) * 8 - (stats.drift - SHIP_BASE.drift) * 100),
    Firepower: pips(((SHIP_BASE.cooldown / stats.cooldown) * stats.damage - 1) * 5 + (stats.bulletSpeed / SHIP_BASE.bulletSpeed - 1) * 2)
  };
}

const SHIP_GLOW = 0.3; // in-game halo strength (the hull paints scale only their shadowBlur by this)

function getRocketSprite() {
  rocketSprite ??= makeSprite(ROCKET_SPRITE_SIZE, ROCKET_SCALE * 1.25, (g, s) => SHIPS[rocketHull].paint(g, s * SHIP_GLOW, rocketColor));
  return rocketSprite;
}

// Draws a hull into a page canvas, crisp at the device's pixel ratio: the hangar preview (with a flame) and
// the picker thumbnails
// glow scales the hull's neon halo (the page's previews run it softer than the game does)
// stage: the hangar's tall frame (ship in the upper part, room for the flame below); hull: null draws only the
// flame (the wheel lights its center ship's engine on a separate layer)
function paintHullCanvas(canvas, hull, color, { stage = false, flame = false, w = canvas.clientWidth, h = canvas.clientHeight, glow = 1 } = {}) {
  if (!w) return; // not on screen
  const r = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * r);
  canvas.height = Math.round(h * r);
  const g = canvas.getContext('2d');
  const k = (stage ? w / 38 : Math.min(w, h) / 40) * r; // px per hull unit: hulls run -18.5..13.6, up to ~26 wide, plus glow
  g.setTransform(k, 0, 0, k, canvas.width / 2, stage ? canvas.height * 0.4 : canvas.height / 2 + 2.5 * k);
  if (flame) {
    for (const [hw, len, c] of [[5.5, 34, '#ff4dff'], [3.8, 26, '#ffbf00'], [2.2, 19, CREAM]]) {
      g.beginPath();
      g.moveTo(-hw, 12);
      g.quadraticCurveTo(0, 12 + len * 1.4, hw, 12);
      g.fillStyle = c;
      g.fill();
    }
  }
  if (hull) SHIPS[hull].paint(g, k * glow, color); // the paints scale only their shadowBlur halo by this
}

// New paint: it rolls up the preview from the engine to the nose behind a bright edge (only on the hull, never
// the empty canvas). Starts from whatever is on screen, so rapid clicks chain smoothly.
let paintWipe = 0;
function wipePaint(canvas, hull) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (reduce || !w) return paintHullCanvas(canvas, hull, rocketColor, STAGE_LOOK);
  const before = document.createElement('canvas');
  before.width = canvas.width;
  before.height = canvas.height;
  before.getContext('2d').drawImage(canvas, 0, 0);
  const after = document.createElement('canvas');
  paintHullCanvas(after, hull, rocketColor, { ...STAGE_LOOK, w, h });
  const id = ++paintWipe;
  const start = performance.now();
  const g = canvas.getContext('2d');
  const step = now => {
    if (id !== paintWipe) return; // a newer wipe took over
    const t = Math.min(1, (now - start) / 450);
    const cut = after.height * (1 - (1 - (1 - t) ** 3)); // ease-out, bottom to top
    const r = after.height / h; // device px per CSS px
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, after.width, after.height);
    g.drawImage(before, 0, 0, after.width, after.height, 0, 0, after.width, after.height);
    g.clearRect(0, cut, after.width, after.height - cut);
    g.drawImage(after, 0, cut, after.width, after.height - cut, 0, cut, after.width, after.height - cut);
    if (t < 1) {
      g.globalCompositeOperation = 'source-atop'; // the edge only lights the hull
      g.fillStyle = `rgba(255, 241, 220, ${0.35 * (1 - t)})`;
      g.fillRect(0, cut - 6 * r, after.width, 12 * r);
      g.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - t)})`;
      g.fillRect(0, cut - 1.5 * r, after.width, 3 * r);
      g.globalCompositeOperation = 'source-over';
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

// The ship card: every hull's title and details are built once and stacked (see .ship-stack), and the pips
// are one shared set that fills and drains in place, so switching ships never reflows the screen
function buildShipCard() {
  const bests = shipBests;
  for (const [key, s] of Object.entries(SHIPS)) {
    shipTitles.insertAdjacentHTML('beforeend', `<div class="ship-title" data-hull="${key}">${s.label}<span class="ship-kind">${s.kind}</span></div>`);
    const perks = [...s.pros.map(t => `<li class="pro">${t}</li>`), ...s.cons.map(t => `<li class="con">${t}</li>`)].join('');
    const best = bests[key] ? `Ship best: ${bests[key].toLocaleString()}` : 'No runs yet';
    shipDetails.insertAdjacentHTML('beforeend', `<div data-hull="${key}"><ul class="ship-perks">${perks}</ul><div class="ship-best">${best}</div></div>`);
  }
  shipStats.innerHTML = Object.keys(shipPips(SHIP_BASE))
    .map(name => `<span>${name}</span><span class="ship-pips" data-stat="${name}">${[0, 1, 2, 3, 4].map(i => `<i style="--i: ${i}"></i>`).join('')}</span>`)
    .join('');
}

const STAGE_LOOK = { stage: true, glow: 0.65 };

// The ship card follows the wheel's centered ship
function renderHangar() {
  const pick = SHIPS[rocketHull];
  for (const el of [...shipTitles.children, ...shipDetails.children]) el.classList.toggle('is-active', el.dataset.hull === rocketHull);
  const pips = shipPips(ship);
  for (const bar of shipStats.querySelectorAll('.ship-pips')) {
    const n = pips[bar.dataset.stat];
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', `${bar.dataset.stat} ${n} of 5`);
    [...bar.children].forEach((pip, i) => pip.classList.toggle('on', i < n));
  }
  shipAnnounce.textContent = `${pick.label}, ${pick.kind}. ${[...pick.pros, ...pick.cons].join('. ')}.`;
}

// Each hull keeps its own best (the overall best still lives in HIGH_SCORE_KEY). Held in memory during a run
// and written once at game over, not on every point.
function bestByShip() {
  try {
    return JSON.parse(localStorage.getItem('bestByShip')) ?? {};
  } catch {
    return {};
  }
}
const shipBests = bestByShip();
const saveShipBests = () => localStorage.setItem('bestByShip', JSON.stringify(shipBests));
window.addEventListener('pagehide', saveShipBests);


function drawWell() {
  const w = player.well;
  if (!w || !hasPowerUp('well') || player.exploded) return;
  const color = POWER_UP_COLORS.well;
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = w.opacity;
  const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, WELL_RADIUS);
  haze.addColorStop(0, hexToRgba(color, 0.18));
  haze.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.arc(0, 0, WELL_RADIUS, 0, TAU);
  ctx.fill();

  // Rings drifting inward show the pull
  ctx.setLineDash([6, 10]);
  for (let i = 0; i < 3; i++) {
    const t = (clock * 0.0005 + i / 3) % 1;
    ctx.save();
    ctx.rotate(-clock * 0.001 * (i + 1));
    ctx.globalAlpha = w.opacity * Math.sin(t * Math.PI) * 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, WELL_RADIUS * (1 - t) + 8, 0, TAU);
    neon(color, 1.25);
    ctx.restore();
  }
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(0, 0, 6 + Math.sin(clock * 0.01) * 1.5, 0, TAU);
  ctx.fillStyle = hexToRgba(color, 0.5);
  ctx.fill();
  neon(color, 2);
  ctx.restore();
}

// Time left as a color: green (most of it) → yellow → orange → red
function gaugeColor(fraction) {
  const i = GAUGE_STOPS.findIndex(([at]) => at > fraction);
  if (i < 0) return GAUGE_STOPS.at(-1)[1];
  if (i === 0) return GAUGE_STOPS[0][1];
  const [a, from] = GAUGE_STOPS[i - 1];
  const [b, to] = GAUGE_STOPS[i];
  return mixHex(from, to, (fraction - a) / (b - a));
}

// Where the i-th of n gauges sits (phones draw the world at half size, so the donuts grow there)
function gaugeSpot(i, n) {
  const k = scaleFactor < 1 ? 1.4 : 1;
  return { x: player.x + (i - (n - 1) / 2) * GAUGE_GAP * k, y: Math.max((GAUGE_RADIUS + 6) * k, player.y - GAUGE_LIFT * k), k };
}

// Donut timers floating above the ship: they pop in on pickup, drain clockwise from green to red, beat
// faster as they run out and pop when they're done. The power-up's own color is the gem in the middle, and
// they stay upright whichever way the ship faces.
function drawTimerGauges() {
  const active = Object.keys(POWER_UP_DURATION).filter(hasPowerUp);
  if (!active.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  active.forEach((type, i) => {
    const total = POWER_UP_DURATION[type] * ship.powerUps;
    const left = player.timers[type] - clock;
    const fraction = clamp(left / total, 0, 1);
    const age = Math.min(1, (total - left) / 400);
    let scale = age >= 1 ? 1 : 1 - Math.exp(-7 * age) * Math.cos(9 * age); // same spring as asteroids
    if (left < POWER_UP_WARNING) scale *= 1 + 0.2 * Math.abs(Math.sin(clock * (0.006 + (1 - left / POWER_UP_WARNING) * 0.012))); // heartbeat, quickening
    const { x, y, k } = gaugeSpot(i, active.length);
    const color = gaugeColor(fraction);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * k, scale * k);
    ctx.beginPath();
    ctx.arc(0, 0, GAUGE_RADIUS, 0, TAU);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = 'rgba(7, 2, 15, 0.7)'; // dark backing so it reads over anything
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; // the spent part
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(0, 0, GAUGE_RADIUS, -Math.PI / 2, -Math.PI / 2 + TAU * fraction);
    ctx.strokeStyle = color; // no white-hot core (neon()'s would bleach a stroke this thin)
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.25;
    ctx.stroke();
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, TAU);
    ctx.fillStyle = POWER_UP_COLORS[type];
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}

function drawPlayer() {
  if (!gameStarted || player.exploded) return;

  // Shield bubble: a clear center and a soft rim, so the ship stays readable inside it (blinks when expiring)
  const shieldLeft = player.timers.shield - clock;
  if (shieldLeft > 0 && (shieldLeft > POWER_UP_WARNING || Math.floor(clock / 125) % 2 === 0)) {
    const c = POWER_UP_COLORS.shield;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.globalCompositeOperation = 'lighter';
    const rim = ctx.createRadialGradient(0, 0, SHIELD_RADIUS * 0.6, 0, 0, SHIELD_RADIUS + 3);
    rim.addColorStop(0, hexToRgba(c, 0));
    rim.addColorStop(0.8, hexToRgba(c, 0.1));
    rim.addColorStop(1, hexToRgba(c, 0));
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(0, 0, SHIELD_RADIUS + 3, 0, TAU);
    ctx.fill();
    ctx.rotate(player.shieldAngle);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, SHIELD_RADIUS, (i * TAU) / 3, (i * TAU) / 3 + 1.2);
      neon(c, 1.5);
    }
    ctx.restore();
  }

  const invulnerable = clock >= player.respawnTime && clock - player.respawnTime < SPAWN_INVULNERABILITY; // blinks once you have control
  const half = ROCKET_SPRITE_SIZE / 2;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle + Math.PI / 2);
  ctx.scale(ROCKET_SCALE * player.shootScale, ROCKET_SCALE * player.shootScale);
  if (invulnerable && Math.floor(clock / 100) % 2) ctx.globalAlpha = 0.35;

  if (player.isThrusting) {
    const length = (player.thrustSign > 0 ? 10 : 6) + Math.sin(clock * 0.05) * 3 + rand(0, 3);
    const baseY = player.thrustSign > 0 ? 13 : -18; // nozzle mouth, or nose for reverse thrust
    const bw = 12;
    const dir = player.thrustSign;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = pick(THRUST_COLORS);
    ctx.beginPath();
    ctx.moveTo(-bw / 3, baseY);
    ctx.lineTo(0, baseY + dir * length);
    ctx.lineTo(bw / 3, baseY);
    ctx.fill();
    ctx.fillStyle = '#fff2c0';
    ctx.beginPath();
    ctx.moveTo(-bw / 6, baseY);
    ctx.lineTo(0, baseY + dir * length * 0.55);
    ctx.lineTo(bw / 6, baseY);
    ctx.fill();
    ctx.restore();
  }

  ctx.drawImage(getRocketSprite(), -half, -half, ROCKET_SPRITE_SIZE, ROCKET_SPRITE_SIZE);
  ctx.restore();

  if (player.tracerEnabled) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    const startX = NOSE_OFFSET + 4;
    const endX = startX + TRACER_LENGTH;
    const gradient = ctx.createLinearGradient(startX, 0, endX, 0);
    gradient.addColorStop(0, `${TRACER_COLOR}33`);
    gradient.addColorStop(0.5, TRACER_COLOR);
    gradient.addColorStop(1, `${TRACER_COLOR}00`);
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(endX, 0);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = TRACER_WIDTH * 4; // halo stroke instead of shadowBlur (too slow per frame on some GPUs)
    ctx.globalAlpha = 0.25;
    ctx.stroke();
    ctx.lineWidth = TRACER_WIDTH;
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.restore();
  }
}

function updateHud() {
  setText(scoreDisplay, `Score: ${Math.round(displayScore)}`);
  setText(accuracyDisplay, `Accuracy: ${accuracy()}%`);
  setText(hitsDisplay, `Hits: ${hits}`);
  const multiplier = comboMultiplier();
  comboDisplay.hidden = multiplier < 2;
  setText(comboDisplay, `Combo ×${multiplier}`);
  if (isPlaying()) setText(timerDisplay, formatTime(clock - gameStartTime));
}

// realDelta (ms) enables phosphor trails; without it the frame is drawn clean
function draw(realDelta) {
  ctx.save();
  if (shake > 0.3) ctx.translate(rand(-shake, shake), rand(-shake, shake));

  drawBackground(realDelta && !REDUCED_MOTION ? 1 - PHOSPHOR_PERSISTENCE ** (realDelta / TARGET_DELTA) : 1);
  drawStars();
  bosses.forEach(b => b.drawBehind());
  blackHoles.forEach(bh => bh.draw());
  drawWell();
  powerUps.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  drawBosses();
  drawParticles();
  drawBullets();
  drawPlayer();
  if (gameStarted && !player.exploded) drawTimerGauges();
  pointTexts.forEach(pt => pt.draw());

  if (flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255, 245, 190, ${flash * flash * (REDUCED_MOTION ? 0.25 : 0.6)})`;
    ctx.fillRect(-30, -30, W + 60, H + 60);
  }
  ctx.restore();
  updateHud();
}

// Title screen floor: a neon grid in true perspective. Every row is drawn at least a pixel wide and fades as
// rows bunch up toward the horizon, so far rows dim instead of shimmering (a CSS-tilted grid squeezes them
// below a pixel, where they pop in and out). Runs only while the title screen is up.
const FLOOR_ROW_TIME = 1600; // ms for the grid to roll one row toward you
const FLOOR_COLUMNS = 26; // converging lines across the screen's width at the bottom edge
const FLOOR_SPREAD = 2.2; // how far past the screen's sides the outer columns reach at the bottom
const FLOOR_ROWS = 40;
const startFloor = $('startFloor');

let floorPhase = 0;
let floorLast = 0;

function drawStartFloor(now) {
  if (gameStarted) return;
  requestAnimationFrame(drawStartFloor);
  const r = window.devicePixelRatio || 1;
  const w = Math.round(startFloor.clientWidth * r);
  const h = Math.round(startFloor.clientHeight * r);
  if (!w || !h) return;
  if (startFloor.width !== w || startFloor.height !== h) {
    startFloor.width = w;
    startFloor.height = h;
  }
  const g = startFloor.getContext('2d');
  g.clearRect(0, 0, w, h);

  // Ground haze and the horizon glow
  const haze = g.createLinearGradient(0, 0, 0, h);
  haze.addColorStop(0, 'rgba(120, 20, 160, 0)');
  haze.addColorStop(1, 'rgba(120, 20, 160, 0.45)');
  g.fillStyle = haze;
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, w * 0.45);
  glow.addColorStop(0, 'rgba(255, 120, 220, 0.3)');
  glow.addColorStop(1, 'rgba(255, 120, 220, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);

  const line = Math.max(1, 1.5 * r);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Rolls toward you; on Blast off it surges to warp speed while it fades (the fade is CSS)
  const dt = floorLast ? Math.min(100, now - floorLast) : 0;
  floorLast = now;
  const warp = launchAt ? 1 + ((now - launchAt) / LAUNCH_TIME) ** 2 * 14 : 1;
  floorPhase = still ? 0 : (floorPhase + (dt / FLOOR_ROW_TIME) * warp) % 1;
  const phase = floorPhase;

  // Rows: a row at depth z sits at y = h / z (z = 1 is the bottom edge). Alpha follows how far it is from the
  // next row, so the crowded far rows fade out smoothly
  g.fillStyle = 'rgb(255, 77, 255)';
  for (let i = 0; i < FLOOR_ROWS; i++) {
    const z = 1 + i - phase;
    if (z <= 0.6) continue;
    const y = h / z;
    const gap = h / z - h / (z + 1);
    g.globalAlpha = clamp((gap - 2 * line) / (14 * r), 0, 1) * 0.85;
    if (g.globalAlpha <= 0) continue;
    g.fillRect(0, y - line / 2, w, line);
  }

  // Columns converge on the vanishing point, fading out toward the horizon where they crowd together
  const fade = g.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, 'rgba(255, 77, 255, 0)');
  fade.addColorStop(0.35, 'rgba(255, 77, 255, 0.35)');
  fade.addColorStop(1, 'rgba(255, 77, 255, 0.85)');
  g.globalAlpha = 1;
  g.strokeStyle = fade;
  g.lineWidth = line;
  g.beginPath();
  for (let j = -FLOOR_COLUMNS; j <= FLOOR_COLUMNS; j++) {
    const bottomX = w / 2 + (j / FLOOR_COLUMNS) * w * FLOOR_SPREAD;
    g.moveTo(w / 2, 0);
    g.lineTo(bottomX, h);
  }
  g.stroke();

  // Melt into the sky: the far edge fades out (and takes the most crowded rows with it)
  g.globalCompositeOperation = 'destination-in';
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, 'rgba(0, 0, 0, 0)');
  sky.addColorStop(0.45, 'rgba(0, 0, 0, 1)');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
}
requestAnimationFrame(drawStartFloor);

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop); // first: an error in one frame logs, but never freezes the game
  const realDelta = Math.min(timestamp - lastTime, 100); // cap so a long stall doesn't teleport things
  lastTime = timestamp;

  if (!isPaused) {
    if (hitstop > 0) {
      hitstop -= realDelta; // freeze-frame on impact
    } else {
      const timeScale = slowMo > 0 ? 0.3 : 1;
      slowMo = Math.max(0, slowMo - realDelta);
      const delta = realDelta * timeScale;
      clock += delta;
      update(delta / TARGET_DELTA);
    }
    shake *= 0.86 ** (realDelta / TARGET_DELTA);
    draw(realDelta);
  }
}

//
// Settings + boot
//
function toggleSound() {
  isSoundEnabled = !isSoundEnabled;
  soundToggle.classList.toggle('muted', !isSoundEnabled);
  localStorage.setItem('soundEnabled', isSoundEnabled);
  if (isSoundEnabled) unlockAudio();
}

soundToggle.addEventListener('click', e => {
  e.preventDefault();
  toggleSound();
  soundToggle.blur();
});

zeroGravityToggle.addEventListener('change', () => {
  localStorage.setItem('zeroGravity', zeroGravityToggle.checked);
  playSound('click', { rate: zeroGravityToggle.checked ? 1.3 : 0.9, volume: 0.45, vary: 0 }); // up for on, down for off
});

document.querySelectorAll('input[name="rocketColor"]').forEach(input => {
  input.addEventListener('change', () => {
    rocketColor = ROCKET_COLORS[input.value];
    rocketSprite = null;
    localStorage.setItem('rocketColor', input.value);
    playSound('click', { rate: 2, volume: 0.35 }); // a touch higher than the hull wheel's tick
    // The centered ship gets the paint wipe; the rest of the drum repaints at once
    for (const item of wheel.items) {
      const key = hullKeys[item.dataset.index];
      if (key === rocketHull) wipePaint(item.lastChild, key);
      else paintHullCanvas(item.lastChild, key, rocketColor, STAGE_LOOK);
    }
  });
});

buildShipCard();

// Ship wheel: the hulls on an endless drum. The centered ship is the pick (full size, engine lit); its
// neighbors shrink, fade and tilt away. Spin it by scroll, drag/flick, clicking a neighbor or the arrow keys
// (a hidden radio group carries keyboard and screen reader use). Each detent clicks and updates the card.
const WHEEL_SLOT = 0.62; // ship spacing as a share of the stage height
const WHEEL_TILT = 34; // degrees a neighbor leans back per slot
const hullKeys = Object.keys(SHIPS);
const wheel = { pos: 0, target: 0, vel: 0, drag: null, acc: 0, running: false, items: [] };

function buildShipWheel() {
  const box = $('shipWheel');
  for (const [i, key] of hullKeys.entries()) {
    const item = document.createElement('div');
    item.className = 'wheel-ship';
    item.dataset.index = i;
    item.innerHTML = '<canvas class="wheel-flame"></canvas><canvas class="wheel-hull"></canvas>';
    $('wheelDrum').append(item);
    wheel.items.push(item);
    const option = document.createElement('label');
    option.innerHTML = `<input type="radio" name="rocketHull" value="${key}" />${SHIPS[key].label}, ${SHIPS[key].kind}`;
    option.querySelector('input').addEventListener('change', () => spinTo(i));
    $('wheelOptions').append(option);
  }
  box.addEventListener('wheel', e => {
    e.preventDefault();
    unlockAudio();
    // A mouse notch is one ship; a trackpad's stream of small deltas glides through several
    const delta = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 16 : 1);
    wheel.acc += delta;
    if (Math.abs(wheel.acc) >= 50) {
      wheel.target = Math.round(wheel.target) + Math.sign(wheel.acc);
      wheel.acc = 0;
    }
    runWheel();
  }, { passive: false });
  // ▲▼ step one ship, ◀▶ one paint, looping (they're for pointers; the keyboard has its own keys)
  for (const button of document.querySelectorAll('.step-button')) {
    button.addEventListener('mousedown', e => e.preventDefault()); // never steal focus
    button.addEventListener('click', () => (button.dataset.step ? spinBy(+button.dataset.step) : stepPaint(+button.dataset.paint)));
  }
  box.addEventListener('pointerdown', e => {
    if (e.target.closest('.wheel-step')) return; // a button press, not a drag
    unlockAudio();
    box.setPointerCapture(e.pointerId);
    wheel.drag = { y: e.clientY, pos: wheel.pos, moved: 0, last: e.clientY, at: performance.now(), v: 0, item: e.target.closest('.wheel-ship') };
    runWheel();
  });
  box.addEventListener('pointermove', e => {
    const d = wheel.drag;
    if (!d) return;
    const now = performance.now();
    d.moved = Math.max(d.moved, Math.abs(e.clientY - d.y));
    d.v = (e.clientY - d.last) / Math.max(1, now - d.at); // px/ms
    d.last = e.clientY;
    d.at = now;
    wheel.target = wheel.pos = d.pos - (e.clientY - d.y) / slotPx();
  });
  const release = () => {
    const d = wheel.drag;
    if (!d) return;
    wheel.drag = null;
    if (d.moved < 5) {
      // A tap: spin a neighbor to the center
      if (d.item) wheel.target = Math.round(wheel.pos) + wrapSlot(+d.item.dataset.index - wheel.pos);
    } else {
      wheel.target = Math.round(wheel.pos - (d.v * 140) / slotPx()); // flick: momentum, then snap to a ship
    }
    runWheel();
  };
  box.addEventListener('pointerup', release);
  box.addEventListener('pointercancel', release);
}

// The wheel is 1.5 stages tall (see .ship-wheel); measure it, not a ship (far ships can be hidden)
const slotPx = () => ($('shipWheel').clientHeight / 1.5) * WHEEL_SLOT;
const wrapSlot = d => ((((d + hullKeys.length / 2) % hullKeys.length) + hullKeys.length) % hullKeys.length) - hullKeys.length / 2;
const centeredIndex = () => ((Math.round(wheel.pos) % hullKeys.length) + hullKeys.length) % hullKeys.length;

function spinBy(step) {
  unlockAudio();
  wheel.target = Math.round(wheel.target) + step;
  runWheel();
}

// Next or previous paint swatch (wrapping), as if it were clicked
function stepPaint(step) {
  const inputs = [...document.querySelectorAll('input[name="rocketColor"]')];
  const hadFocus = inputs.includes(document.activeElement);
  const next = inputs[(inputs.findIndex(i => i.checked) + step + inputs.length) % inputs.length];
  next.checked = true;
  next.dispatchEvent(new Event('change'));
  if (hadFocus) next.focus();
}

// Turn the shortest way round to ship i
function spinTo(i) {
  wheel.target = Math.round(wheel.target) + Math.round(wrapSlot(i - wheel.target));
  runWheel();
}
window.spinToHull = key => spinTo(hullKeys.indexOf(key)); // for tests and the console

function paintWheel() {
  for (const item of wheel.items) {
    const key = hullKeys[item.dataset.index];
    paintHullCanvas(item.lastChild, key, rocketColor, STAGE_LOOK);
    paintHullCanvas(item.firstChild, null, rocketColor, { ...STAGE_LOOK, flame: true });
  }
  layoutWheel();
}

function layoutWheel() {
  const slot = slotPx();
  for (const item of wheel.items) {
    const d = wrapSlot(+item.dataset.index - wheel.pos);
    const a = Math.abs(d);
    item.style.visibility = a > 2.3 ? 'hidden' : '';
    item.style.transform = `translateY(${d * slot}px) rotateX(${-d * WHEEL_TILT}deg) scale(${1 - Math.min(a, 2) * 0.24})`;
    item.style.opacity = clamp(1 - a * 0.38, 0, 1);
    item.style.zIndex = 10 - Math.round(a * 2);
    item.firstChild.style.opacity = clamp(1 - a * 2.5, 0, 1); // the engine burns only at the center
    item.classList.toggle('is-center', a < 0.5);
  }
  // Each detent: a click, and the card follows
  const index = centeredIndex();
  if (hullKeys[index] !== rocketHull) {
    selectHull(hullKeys[index]);
    localStorage.setItem('rocketHull', rocketHull);
    const option = $('wheelOptions').querySelectorAll('input')[index];
    const hadFocus = $('wheelOptions').contains(document.activeElement);
    option.checked = true;
    if (hadFocus) option.focus(); // keyboard focus follows the pick, so screen readers announce it
    renderHangar();
    playSound('click', { rate: 1.7, volume: 0.35 });
  }
}

// Spring the drum toward its target (a touch of overshoot, like a real detent), then rest
function runWheel() {
  if (wheel.running) return;
  wheel.running = true;
  let last = performance.now();
  const step = now => {
    const f = Math.min(3, (now - last) / TARGET_DELTA);
    last = now;
    if (!wheel.drag) {
      wheel.vel = (wheel.vel + (wheel.target - wheel.pos) * 0.16 * f) * 0.7 ** f;
      wheel.pos += wheel.vel * f;
      if (Math.abs(wheel.target - wheel.pos) < 0.001 && Math.abs(wheel.vel) < 0.001) {
        wheel.pos = wheel.target;
        wheel.running = false;
      }
    }
    layoutWheel();
    if (wheel.running) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const savedHull = SHIPS[localStorage.getItem('rocketHull')] ? localStorage.getItem('rocketHull') : 'classic';
selectHull(savedHull);
buildShipWheel();
wheel.pos = wheel.target = hullKeys.indexOf(savedHull);
$('wheelOptions').querySelectorAll('input')[wheel.pos].checked = true;
window.addEventListener('resize', paintWheel);

window.addEventListener('pointerdown', unlockAudio, { once: true });

const savedColor = ROCKET_COLORS[localStorage.getItem('rocketColor')] ? localStorage.getItem('rocketColor') : 'blue';
rocketColor = ROCKET_COLORS[savedColor];
document.querySelectorAll('input[name="rocketColor"]').forEach(input => (input.checked = input.value === savedColor));
paintWheel();
renderHangar();
zeroGravityToggle.checked = localStorage.getItem('zeroGravity') === 'true';
soundToggle.classList.toggle('muted', !isSoundEnabled);
updateHighScore();

asteroids = Array.from({ length: STARTING_ASTEROIDS }, () => new Asteroid());
requestAnimationFrame(gameLoop);
