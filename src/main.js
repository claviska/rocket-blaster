const ROCKET_COLOR = '#00B7FF';
const ROCKET_ACCENT = '#FFFFFF';
const THRUST_COLORS = ['#FF6B00', '#FF9500', '#FFC107'];
const ASTEROID_COLORS = ['#de3333', '#20afa5', '#24a3c0', '#2fba79', '#e5cb64', '#b818b8'];
const ASTEROID_MIN_SIZE = 20;
const ASTEROID_MAX_SIZE = 45;
const ASTEROID_SPAWN_MIN = 1000; // 1 second
const ASTEROID_SPAWN_MAX = 4000; // 4 seconds
const BULLET_COLOR = '#FFBF00';
const BULLET_GRAVITY_MULTIPLIER = 10;
const STARTING_ASTEROIDS = 3;
const INCREASE_ASTEROIDS_EVERY_N_HITS = 5;
const BLACK_HOLE_SIZE = ASTEROID_MAX_SIZE * 1.75;
const BLACK_HOLE_DURATION = 10000; // 10 seconds
const BLACK_HOLE_GRAVITY_STRENGTH = 0.15;
const BLACK_HOLE_ROTATION_SPEED = 0.075;
const BLACK_HOLE_SPAWN_MIN = 30000; // 30 seconds
const BLACK_HOLE_SPAWN_MAX = 70000; // 70 seconds
const STAR_SPAWN_MIN = 60000; // 60 seconds
const STAR_SPAWN_MAX = 100000; // 100 seconds
const SHIELD_SPAWN_MIN = 30000; // 30 seconds
const SHIELD_SPAWN_MAX = 60000; // 70 seconds
const SHIELD_DURATION = 8000; // 8 seconds
const SHIELD_ROTATION_DURATION = 2500;
const SHIELD_BLINK_DURATION = 2000; // 2 seconds blink warning
const HIGH_SCORE_DEFAULT_COLOR = '#00ffcc';
const HIGH_SCORE_BEATEN_COLOR = '#ff3366';
const STAR_COUNT = 50;
const SOUND_POOL_SIZE = 10;
const TRACER_LENGTH = 350; // Length of the tracer in pixels
const TRACER_COLOR = '#FFBF00'; // Tracer color, matching BULLET_COLOR by default
const TRACER_DASH_SIZE = 8; // Size of dashes and gaps in pixels
const TRACER_WIDTH = 1.5;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const zeroGravityToggle = document.getElementById('zeroGravityToggle');
const accuracyDisplay = document.getElementById('accuracy');
const hitsDisplay = document.getElementById('hits');
const timerDisplay = document.getElementById('timer');
const soundToggle = document.getElementById('soundToggle');
const highScoreDisplay = document.getElementById('highScore');
const gameOverDisplay = document.getElementById('gameOver');
const startDialog = document.getElementById('startDialog');
const touchControls = document.getElementById('touchControls');
const leftButton = document.getElementById('leftButton');
const rightButton = document.getElementById('rightButton');
const thrustButton = document.getElementById('thrustButton');
const shootButton = document.getElementById('shootButton');
const restartButton = document.getElementById('restartButton');
const savedSoundState = localStorage.getItem('soundEnabled');
let scaleFactor = window.innerWidth < 768 ? 0.5 : 1;

canvas.width = window.innerWidth / scaleFactor;
canvas.height = window.innerHeight / scaleFactor;
ctx.scale(scaleFactor, scaleFactor);

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  angle: 0,
  velX: 0,
  velY: 0,
  maxSpeed: 3,
  acceleration: 0.1,
  bodyLength: 12,
  bodyWidth: 12,
  noseLength: 12,
  hitRadius: 20,
  finSize: 6,
  pulseScale: 1,
  pulseTimer: 0,
  shootScale: 1,
  shootTimer: 0,
  exploded: false,
  pieces: [],
  thrustFrame: 0,
  isThrusting: false,
  hasShield: false,
  shieldStartTime: 0,
  shieldAngle: 0,
  shieldVisible: true,
  lastShotTime: 0,
  shootCooldown: 200, // min delay between shots,
  shieldExpireSoundPlayed: false
};

let bullets = [];
let asteroids = [];
let powerUps = [];
let blackHoles = [];
let score = 0;
let shotsFired = 0;
let hits = 0;
let targetAsteroids = 2;
let pendingAsteroids = [];
let asteroidsDestroyed = 0;
let gameStarted = false;
let gameStartTime;
let pendingBlackHoleSpawnTime = null;
let pendingStarSpawnTime;
let pendingShieldSpawnTime = null;
let flashActive = false;
let flashStartTime;
let fadeInTime = 25;
let fullOpacityTime = 25;
let fadeOutTime = 25;
let cachedHighScore = parseInt(localStorage.getItem('highScore')) || 0;
let hasCustomTexture = false;
let textureImage = null;
let isShaking = false;
let shakeDuration = 500; // Duration in milliseconds
let shakeIntensity = 10; // Maximum shake offset in pixels
let shakeStartTime = 0;
let isPaused = false;
let pauseTime = 0;
let isSoundEnabled = true;
let wasThrusting = false;

const stars = [];
for (let i = 0; i < STAR_COUNT; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 0.5,
    brightness: Math.random() * 0.5 + 0.5,
    twinkle: Math.random() < 0.1,
    twinkleSpeed: Math.random() * 0.03 + 0.01,
    depth: Math.random()
  });
}

// Input handling
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key] = true;

  // Add an asteroid when pressing backtick, only during active game play
  if (e.key === '`' && gameStarted && !player.exploded) {
    asteroids.push(new Asteroid());
  }

  // Prevent game start from key presses when startDialog is visible
  if (!gameStarted && startDialog.style.display !== 'none') {
    // Do nothing - wait for Start button click
    return;
  }

  // Start game only if not started, not in game over state, and dialog is hidden
  if (!gameStarted && !e.metaKey && !e.shiftKey && !e.ctrlKey && startDialog.style.display === 'none') {
    startGame();
  }
});
window.addEventListener('keyup', e => (keys[e.key] = false));

// Start button listener
document.getElementById('startButton').addEventListener('click', e => {
  e.preventDefault();
  if (!gameStarted) {
    startGame();
  }
});

// Restart button listener
document.getElementById('restartButton').addEventListener('click', e => {
  e.preventDefault();
  if (gameStarted && player.exploded && player.pieces.length === 0) {
    restartGame();
  }
});

// Touch controls
const touchState = {
  left: false,
  right: false,
  thrust: false,
  shoot: false
};

// Check for texture mode in URL
function checkForTextureMode() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('texture')) {
    hasCustomTexture = true;
    textureImage = new Image();
    textureImage.src = `/textures/${urlParams.get('texture')}.png`;
    textureImage.onerror = err => {
      console.error(err);
    };
  }
}

function handleStartGameInteraction(e) {
  // Don't start the game if clicking the zero G checkbox
  if (e.target.closest('.gravity-label')) {
    return;
  }

  if (!gameStarted) {
    e.preventDefault();
    startGame();
  }
}

function handleTouchStart(e) {
  // Only prevent default if we're handling game controls
  if (e.target.classList.contains('touchButton')) {
    e.preventDefault();
  }

  // Start game if not started
  if (!gameStarted && e.target.id === 'startButton') {
    startGame();
    return;
  }

  // Handle touch controls
  const touches = e.touches;
  for (let i = 0; i < touches.length; i++) {
    const touch = touches[i];
    const x = touch.clientX;
    const y = touch.clientY;

    // Update touch states
    touchState.left = isTouchingButton(x, y, leftButton);
    touchState.right = isTouchingButton(x, y, rightButton);
    touchState.thrust = isTouchingButton(x, y, thrustButton);
    touchState.shoot = isTouchingButton(x, y, shootButton);
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  const touches = e.touches;
  touchState.left = false;
  touchState.right = false;
  touchState.thrust = false;
  touchState.shoot = false;
  for (let i = 0; i < touches.length; i++) {
    const touch = touches[i];
    const x = touch.clientX;
    const y = touch.clientY;
    if (isTouchingButton(x, y, leftButton)) touchState.left = true;
    if (isTouchingButton(x, y, rightButton)) touchState.right = true;
    if (isTouchingButton(x, y, thrustButton)) touchState.thrust = true;
    if (isTouchingButton(x, y, shootButton)) touchState.shoot = true;
  }
}

function handleTouchEnd(e) {
  e.preventDefault();
  const touches = e.touches;
  touchState.left = false;
  touchState.right = false;
  touchState.thrust = false;
  touchState.shoot = false;
  for (let i = 0; i < touches.length; i++) {
    const touch = touches[i];
    const x = touch.clientX;
    const y = touch.clientY;
    if (isTouchingButton(x, y, leftButton)) touchState.left = true;
    if (isTouchingButton(x, y, rightButton)) touchState.right = true;
    if (isTouchingButton(x, y, thrustButton)) touchState.thrust = true;
    if (isTouchingButton(x, y, shootButton)) touchState.shoot = true;
  }
}

function isTouchingButton(x, y, button) {
  const rect = button.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

touchControls.addEventListener('touchstart', handleTouchStart);
touchControls.addEventListener('touchmove', handleTouchMove);
touchControls.addEventListener('touchend', handleTouchEnd);

class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 10;
    this.size = 5;
  }

  move() {
    this.x += this.speed * Math.cos(this.angle);
    this.y += this.speed * Math.sin(this.angle);
  }

  draw() {
    ctx.fillStyle = BULLET_COLOR;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Asteroid {
  constructor() {
    const side = Math.floor(Math.random() * 4);
    let x, y, angle;

    switch (side) {
      case 0:
        x = Math.random() * canvas.width;
        y = -10;
        angle = Math.random() * Math.PI - Math.PI / 2;
        break;
      case 1:
        x = canvas.width + 10;
        y = Math.random() * canvas.height;
        angle = Math.random() * Math.PI + Math.PI;
        break;
      case 2:
        x = Math.random() * canvas.width;
        y = canvas.height + 10;
        angle = Math.random() * Math.PI + Math.PI / 2;
        break;
      case 3:
        x = -10;
        y = Math.random() * canvas.height;
        angle = Math.random() * Math.PI;
        break;
    }
    this.x = x;
    this.y = y;
    this.speed = (Math.random() * 2 + 1) * 0.9;
    this.size = ASTEROID_MIN_SIZE + Math.random() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE);
    this.angle = angle;
    this.hitRadius = this.size * 1.2;
    this.rotationAngle = 0;
    this.rotationSpeed = Math.random() * 0.02 - 0.01; // Initial random spin (-0.01 to 0.01)
    this.spawnTime = Date.now();
    this.gracePeriod = 1000;
    this.fadeInDuration = 1000;
    this.scale = 0;
    this.opacity = 0;
    this.exploded = false;
    this.pieces = [];
    this.explosionLife = 0;
    this.color = ASTEROID_COLORS[Math.floor(Math.random() * ASTEROID_COLORS.length)];
    this.points = [];

    // Initialize velocity components
    this.velX = this.speed * Math.cos(this.angle);
    this.velY = this.speed * Math.sin(this.angle);

    const segments = 10;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const radius = this.size * (0.7 + Math.random() * 0.6);
      this.points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
    }
  }

  move() {
    if (this.exploded) {
      this.pieces.forEach(p => p.move());
      this.explosionLife--;
      if (this.explosionLife <= 0) {
        const index = asteroids.indexOf(this);
        if (index !== -1) asteroids.splice(index, 1);
      }
      return;
    }

    // Update position with velocity
    this.x += this.velX;
    this.y += this.velY;

    // Boundary checks with bounce
    const buffer = this.hitRadius;
    if (this.x - buffer < 0) {
      this.x = buffer;
      this.velX = Math.abs(this.velX);
    } else if (this.x + buffer > canvas.width) {
      this.x = canvas.width - buffer;
      this.velX = -Math.abs(this.velX);
    }
    if (this.y - buffer < 0) {
      this.y = buffer;
      this.velY = Math.abs(this.velY);
    } else if (this.y + buffer > canvas.height) {
      this.y = canvas.height - buffer;
      this.velY = -Math.abs(this.velY);
    }

    // Apply rotation
    this.rotationAngle += this.rotationSpeed;

    // Handle fade-in effect
    const elapsed = Date.now() - this.spawnTime;
    if (elapsed < this.fadeInDuration) {
      this.scale = Math.min(1, elapsed / this.fadeInDuration);
      this.opacity = Math.min(1, elapsed / this.fadeInDuration);
    } else {
      this.scale = 1;
      this.opacity = 1;
    }
  }

  draw() {
    if (this.exploded) {
      this.pieces.forEach(p => p.draw());
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotationAngle);
    ctx.scale(this.scale, this.scale);

    // Extracted curve drawing function
    const drawAsteroidShape = () => {
      ctx.beginPath();
      ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) {
        const prev = this.points[i - 1];
        const curr = this.points[i];
        const cp1x = prev.x + (curr.x - prev.x) * 0.3;
        const cp1y = prev.y + (curr.y - prev.y) * 0.3;
        const cp2x = curr.x - (curr.x - prev.x) * 0.3;
        const cp2y = curr.y - (curr.y - prev.y) * 0.3;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, curr.x, curr.y);
      }
      const last = this.points[this.points.length - 1];
      const first = this.points[0];
      const cp1x = last.x + (first.x - last.x) * 0.3;
      const cp1y = last.y + (first.y - last.y) * 0.3;
      const cp2x = first.x - (first.x - last.x) * 0.3;
      const cp2y = first.y - (first.y - last.y) * 0.3;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, first.x, first.y);
      ctx.closePath();
    };

    // Extracted color utility functions
    const hexToRgb = hex => ({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    });

    const adjustColor = (color, amount) => ({
      r: Math.max(0, Math.min(255, color.r + amount)),
      g: Math.max(0, Math.min(255, color.g + amount)),
      b: Math.max(0, Math.min(255, color.b + amount))
    });

    if (hasCustomTexture && textureImage && textureImage.complete) {
      ctx.save();
      drawAsteroidShape();
      ctx.clip();
      const imgSize = this.size * 2.4;
      ctx.drawImage(textureImage, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
      ctx.restore();
    } else {
      const baseColor = hexToRgb(this.color);
      const gradient = ctx.createRadialGradient(this.size * 0.3, -this.size * 0.3, 0, 0, 0, this.size * 1.2);

      gradient.addColorStop(
        0,
        `rgb(${adjustColor(baseColor, 80).r}, ${adjustColor(baseColor, 80).g}, ${adjustColor(baseColor, 80).b})`
      );
      gradient.addColorStop(
        0.3,
        `rgb(${adjustColor(baseColor, 40).r}, ${adjustColor(baseColor, 40).g}, ${adjustColor(baseColor, 40).b})`
      );
      gradient.addColorStop(0.6, `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})`);
      gradient.addColorStop(
        0.8,
        `rgb(${adjustColor(baseColor, -60).r}, ${adjustColor(baseColor, -60).g}, ${adjustColor(baseColor, -60).b})`
      );
      gradient.addColorStop(
        1,
        `rgb(${adjustColor(baseColor, -90).r}, ${adjustColor(baseColor, -90).g}, ${adjustColor(baseColor, -90).b})`
      );

      ctx.fillStyle = gradient;
      drawAsteroidShape();
      ctx.fill();

      if (!this.craters) {
        const craterCount = Math.floor(Math.random() * 3) + 5; // 5-7 craters
        this.craters = [];
        playSound('asteroid-spawn');
        const minDistance = this.size * 0.3;

        const isTooClose = (x, y, existingCraters, radius) => {
          return existingCraters.some(c => {
            const dx = c.x - x;
            const dy = c.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < minDistance + c.radius + radius;
          });
        };

        for (let i = 0; i < craterCount; i++) {
          let attempts = 0;
          let newCrater;
          do {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.size * 0.7;
            const radius = Math.random() * (this.size * 0.2) + this.size * 0.08;
            newCrater = {
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              radius: radius,
              depth: Math.random() * 0.6 + 0.2,
              rimWidth: Math.random() * 0.3 + 0.1,
              rimLight: Math.random() * 0.4 + 0.3
            };
            attempts++;
          } while (isTooClose(newCrater.x, newCrater.y, this.craters, newCrater.radius) && attempts < 20);

          if (attempts < 20) {
            this.craters.push(newCrater);
          }
        }
      }

      ctx.save();
      drawAsteroidShape();
      ctx.clip();

      this.craters.forEach(crater => {
        const shadowGradient = ctx.createRadialGradient(
          crater.x + crater.radius * 0.2,
          crater.y - crater.radius * 0.2,
          0,
          crater.x,
          crater.y,
          crater.radius * 1.2
        );

        const darknessVariation = Math.random() * 20 - 10;
        const deepShadow = adjustColor(baseColor, -70 + darknessVariation);
        const midShadow = adjustColor(baseColor, -50 + darknessVariation);

        shadowGradient.addColorStop(
          0,
          `rgba(${deepShadow.r}, ${deepShadow.g}, ${deepShadow.b}, ${crater.depth * 1.1})`
        );
        shadowGradient.addColorStop(0.6, `rgba(${midShadow.r}, ${midShadow.g}, ${midShadow.b}, ${crater.depth * 0.8})`);
        shadowGradient.addColorStop(1, `rgba(${midShadow.r}, ${midShadow.g}, ${midShadow.b}, 0)`);

        ctx.fillStyle = shadowGradient;
        ctx.beginPath();
        ctx.arc(crater.x, crater.y, crater.radius, 0, Math.PI * 2);
        ctx.fill();

        const rimGradient = ctx.createRadialGradient(
          crater.x - crater.radius * 0.3,
          crater.y - crater.radius * 0.3,
          crater.radius * (1 - crater.rimWidth * 1.2),
          crater.x,
          crater.y,
          crater.radius * 1.15
        );
        const highlightColor = adjustColor(baseColor, 50);
        const lightColor = adjustColor(baseColor, 20);
        rimGradient.addColorStop(
          0,
          `rgba(${highlightColor.r}, ${highlightColor.g}, ${highlightColor.b}, ${crater.rimLight * 1.2})`
        );
        rimGradient.addColorStop(
          0.4,
          `rgba(${lightColor.r}, ${lightColor.g}, ${lightColor.b}, ${crater.rimLight * 0.8})`
        );
        rimGradient.addColorStop(1, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0)`);

        ctx.fillStyle = rimGradient;
        ctx.beginPath();
        ctx.arc(crater.x, crater.y, crater.radius * 1.15, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    }

    ctx.restore();
  }

  canCollide() {
    return Date.now() - this.spawnTime >= this.gracePeriod;
  }
}

class ExplosionPiece {
  constructor(x, y, angle, size, color) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = Math.random() * 5 + 2;
    this.size = size;
    this.life = 60;
    this.color = color;
  }

  move() {
    this.x += this.speed * Math.cos(this.angle);
    this.y += this.speed * Math.sin(this.angle);
    this.life--;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Star {
  constructor() {
    const side = Math.floor(Math.random() * 4);
    let x, y, angle;
    switch (side) {
      case 0:
        x = Math.random() * canvas.width;
        y = -10;
        angle = Math.random() * Math.PI - Math.PI / 2;
        break;
      case 1:
        x = canvas.width + 10;
        y = Math.random() * canvas.height;
        angle = Math.random() * Math.PI + Math.PI;
        break;
      case 2:
        x = Math.random() * canvas.width;
        y = canvas.height + 10;
        angle = Math.random() * Math.PI + Math.PI / 2;
        break;
      case 3:
        x = -10;
        y = Math.random() * canvas.height;
        angle = Math.random() * Math.PI;
        break;
    }
    this.x = x;
    this.y = y;
    this.speed = (Math.random() * 2 + 1) * 0.9;
    this.size = 30;
    this.angle = angle;
    this.hitRadius = this.size * 1.2;
    this.rotationAngle = 0;
    this.rotationSpeed = Math.random() * 0.05 - 0.025;
    this.pulseScale = 1;
    this.pulseSpeed = 0.01;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.colorPulseSpeed = 0.02; // Speed of color flashing
    this.colorPulsePhase = Math.random() * Math.PI * 2; // Random starting phase for color pulse
    this.spawnTime = Date.now();
    this.lifeTime = 10000; // 10 seconds
    this.fadeInDuration = 1000;
    this.fadeOutDuration = 1000;
    this.scale = 0;
    this.opacity = 0;
    this.baseColor = { r: 255, g: 255, b: 0 }; // Base yellow color in RGB
  }

  move() {
    // Initialize velocities if not present
    if (!this.velX) this.velX = this.speed * Math.cos(this.angle);
    if (!this.velY) this.velY = this.speed * Math.sin(this.angle);

    this.x += this.velX;
    this.y += this.velY;

    const buffer = this.hitRadius;
    if (this.x - buffer < 0) {
      this.x = buffer;
      this.velX = Math.abs(this.velX);
    } else if (this.x + buffer > canvas.width) {
      this.x = canvas.width - buffer;
      this.velX = -Math.abs(this.velX);
    }
    if (this.y - buffer < 0) {
      this.y = buffer;
      this.velY = Math.abs(this.velY);
    } else if (this.y + buffer > canvas.height) {
      this.y = canvas.height - buffer;
      this.velY = -Math.abs(this.velY);
    }

    this.rotationAngle += this.rotationSpeed;
    this.pulseScale = 1 + Math.sin(Date.now() * this.pulseSpeed + this.pulsePhase) * 0.05;

    const elapsed = Date.now() - this.spawnTime;
    if (elapsed < this.fadeInDuration) {
      this.scale = Math.min(1, elapsed / this.fadeInDuration);
      this.opacity = Math.min(1, elapsed / this.fadeInDuration);
    } else if (elapsed > this.lifeTime - this.fadeOutDuration) {
      const fadeOutTime = elapsed - (this.lifeTime - this.fadeOutDuration);
      this.scale = Math.max(0, 1 - fadeOutTime / this.fadeOutDuration);
      this.opacity = Math.max(0, 1 - fadeOutTime / this.fadeOutDuration);
    } else {
      this.scale = 1;
      this.opacity = 1;
    }

    if (elapsed > this.lifeTime) {
      const index = powerUps.indexOf(this);
      if (index !== -1) powerUps.splice(index, 1);
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotationAngle);
    ctx.scale(this.pulseScale * this.scale, this.pulseScale * this.scale);
    ctx.globalAlpha = this.opacity;

    const points = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 * Math.PI) / 180;
      points.push({
        x: Math.cos(angle) * this.size,
        y: Math.sin(angle) * this.size
      });
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.quadraticCurveTo(
      points[0].x * 0.9 + points[2].x * 0.1,
      points[0].y * 0.9 + points[2].y * 0.1,
      points[2].x,
      points[2].y
    );
    ctx.quadraticCurveTo(
      points[2].x * 0.9 + points[4].x * 0.1,
      points[2].y * 0.9 + points[4].y * 0.1,
      points[4].x,
      points[4].y
    );
    ctx.quadraticCurveTo(
      points[4].x * 0.9 + points[1].x * 0.1,
      points[4].y * 0.9 + points[1].y * 0.1,
      points[1].x,
      points[1].y
    );
    ctx.quadraticCurveTo(
      points[1].x * 0.9 + points[3].x * 0.1,
      points[1].y * 0.9 + points[3].y * 0.1,
      points[3].x,
      points[3].y
    );
    ctx.quadraticCurveTo(
      points[3].x * 0.9 + points[0].x * 0.1,
      points[3].y * 0.9 + points[0].y * 0.1,
      points[0].x,
      points[0].y
    );
    ctx.closePath();

    // Calculate the color pulse factor (0 to 1)
    const colorPulse = (Math.sin(Date.now() * this.colorPulseSpeed + this.colorPulsePhase) + 1) / 2; // Ranges from 0 to 1
    const almostWhite = { r: 240, g: 240, b: 240 }; // Almost-white color

    // Interpolate between base yellow and almost-white
    const r = Math.round(this.baseColor.r + (almostWhite.r - this.baseColor.r) * colorPulse);
    const g = Math.round(this.baseColor.g + (almostWhite.g - this.baseColor.g) * colorPulse);
    const b = Math.round(this.baseColor.b + (almostWhite.b - this.baseColor.b) * colorPulse);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`); // Center starts with pulsed color
    gradient.addColorStop(0.5, `rgba(${this.baseColor.r}, ${this.baseColor.g}, ${this.baseColor.b}, 1)`); // Midpoint stays yellow
    gradient.addColorStop(1, `rgba(${this.baseColor.r}, ${this.baseColor.g}, 0, 0.7)`); // Edge fades to transparent yellow
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

class Shield {
  constructor() {
    const side = Math.floor(Math.random() * 4);
    let x, y, angle;
    switch (side) {
      case 0:
        x = Math.random() * canvas.width;
        y = -10;
        angle = Math.random() * Math.PI - Math.PI / 2;
        break;
      case 1:
        x = canvas.width + 10;
        y = Math.random() * canvas.height;
        angle = Math.random() * Math.PI + Math.PI;
        break;
      case 2:
        x = Math.random() * canvas.width;
        y = canvas.height + 10;
        angle = Math.random() * Math.PI + Math.PI / 2;
        break;
      case 3:
        x = -10;
        y = Math.random() * canvas.height;
        angle = Math.random() * Math.PI;
        break;
    }
    this.x = x;
    this.y = y;
    this.speed = (Math.random() * 2 + 1) * 0.9;
    this.size = 30;
    this.angle = angle;
    this.hitRadius = this.size * 1.2;
    this.rotationAngle = 0;
    this.rotationSpeed = Math.random() * 0.02 - 0.01;
    this.pulseScale = 1;
    this.pulseSpeed = 0.01;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.spawnTime = Date.now();
    this.lifeTime = 10000;
    this.fadeInDuration = 1000;
    this.fadeOutDuration = 1000;
    this.scale = 0;
    this.opacity = 0;
  }

  move() {
    // Initialize velocities if not present
    if (!this.velX) this.velX = this.speed * Math.cos(this.angle);
    if (!this.velY) this.velY = this.speed * Math.sin(this.angle);

    this.x += this.velX;
    this.y += this.velY;

    const buffer = this.hitRadius;
    if (this.x - buffer < 0) {
      this.x = buffer;
      this.velX = Math.abs(this.velX);
    } else if (this.x + buffer > canvas.width) {
      this.x = canvas.width - buffer;
      this.velX = -Math.abs(this.velX);
    }
    if (this.y - buffer < 0) {
      this.y = buffer;
      this.velY = Math.abs(this.velY);
    } else if (this.y + buffer > canvas.height) {
      this.y = canvas.height - buffer;
      this.velY = -Math.abs(this.velY);
    }

    this.rotationAngle += this.rotationSpeed;
    this.pulseScale = 1 + Math.sin(Date.now() * this.pulseSpeed + this.pulsePhase) * 0.05;

    const elapsed = Date.now() - this.spawnTime;
    if (elapsed < this.fadeInDuration) {
      this.scale = Math.min(1, elapsed / this.fadeInDuration);
      this.opacity = Math.min(1, elapsed / this.fadeInDuration);
    } else if (elapsed > this.lifeTime - this.fadeOutDuration) {
      const fadeOutTime = elapsed - (this.lifeTime - this.fadeOutDuration);
      this.scale = Math.max(0, 1 - fadeOutTime / this.fadeOutDuration);
      this.opacity = Math.max(0, 1 - fadeOutTime / this.fadeOutDuration);
    } else {
      this.scale = 1;
      this.opacity = 1;
    }

    if (elapsed > this.lifeTime) {
      const index = powerUps.indexOf(this);
      if (index !== -1) powerUps.splice(index, 1);
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotationAngle);
    ctx.scale(this.pulseScale * this.scale, this.pulseScale * this.scale);
    ctx.globalAlpha = this.opacity;

    // Draw a dashed circle like the shield
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.strokeStyle = 'white';
    ctx.setLineDash([12, 12]);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

class BlackHole {
  constructor() {
    const side = Math.floor(Math.random() * 4);
    let x, y, angle;

    switch (side) {
      case 0:
        x = Math.random() * canvas.width;
        y = -10;
        angle = Math.random() * Math.PI - Math.PI / 2;
        break;
      case 1:
        x = canvas.width + 10;
        y = Math.random() * canvas.height;
        angle = Math.random() * Math.PI + Math.PI;
        break;
      case 2:
        x = Math.random() * canvas.width;
        y = canvas.height + 10;
        angle = Math.random() * Math.PI + Math.PI / 2;
        break;
      case 3:
        x = -10;
        y = Math.random() * canvas.height;
        angle = Math.random() * Math.PI;
        break;
    }
    this.x = x;
    this.y = y;
    this.speed = (Math.random() * 2 + 1) * 0.45;
    this.baseSize = BLACK_HOLE_SIZE; // Base size before pulsing
    this.size = this.baseSize; // Current size, now fixed
    this.angle = angle;
    this.baseHitRadius = this.baseSize * 1.2; // Base hit radius for visuals
    this.hitRadius = this.baseHitRadius; // Current hit radius for visuals, now fixed
    this.collisionRadius = this.baseHitRadius * 0.1; // Collision radius is 10% of base hit radius
    this.rotationAngle = 0;
    this.rotationSpeed = BLACK_HOLE_ROTATION_SPEED;
    this.spawnTime = Date.now();
    this.gracePeriod = 3000;
    this.fadeInDuration = 1000;
    this.scale = 0;
    this.opacity = 0;
    this.lifeTime = BLACK_HOLE_DURATION;
    this.fadeOutDuration = 1000; // 1 second fade out
  }

  move() {
    this.x += this.speed * Math.cos(this.angle);
    this.y += this.speed * Math.sin(this.angle);

    const buffer = this.hitRadius; // Use visual hit radius for boundary
    if (this.x - buffer < 0) {
      this.x = buffer;
      this.angle = Math.PI - this.angle;
    } else if (this.x + buffer > canvas.width) {
      this.x = canvas.width - buffer;
      this.angle = Math.PI - this.angle;
    }
    if (this.y - buffer < 0) {
      this.y = buffer;
      this.angle = -this.angle;
    } else if (this.y + buffer > canvas.height) {
      this.y = canvas.height - buffer;
      this.angle = -this.angle;
    }

    this.rotationAngle += this.rotationSpeed;

    const elapsed = Date.now() - this.spawnTime;
    if (elapsed < this.fadeInDuration) {
      this.scale = Math.min(1, elapsed / this.fadeInDuration);
      this.opacity = Math.min(1, elapsed / this.fadeInDuration);
    } else if (elapsed > this.lifeTime - this.fadeOutDuration) {
      const fadeOutTime = elapsed - (this.lifeTime - this.fadeOutDuration);
      this.scale = Math.max(0, 1 - fadeOutTime / this.fadeOutDuration);
      this.opacity = Math.max(0, 1 - fadeOutTime / this.fadeOutDuration);
    } else {
      this.scale = 1;
      this.opacity = 1;
    }

    if (elapsed > this.lifeTime) {
      const index = blackHoles.indexOf(this);
      if (index !== -1) {
        blackHoles.splice(index, 1);
        // Set the next spawn time to be between BLACK_HOLE_SPAWN_MIN and BLACK_HOLE_SPAWN_MAX from NOW
        pendingBlackHoleSpawnTime =
          Date.now() + Math.random() * (BLACK_HOLE_SPAWN_MAX - BLACK_HOLE_SPAWN_MIN) + BLACK_HOLE_SPAWN_MIN;
      }
    }

    // Size and hitRadius remain constant at their base values
    this.size = this.baseSize;
    this.hitRadius = this.baseHitRadius;
    this.collisionRadius = this.baseHitRadius * 0.1;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotationAngle);
    ctx.scale(this.scale, this.scale); // Fade-in scale only
    ctx.globalAlpha = this.opacity;

    // Define the cycle duration for orange to red and back
    const cycleDuration = 2000; // 2 seconds for full cycle (orange -> red -> orange)
    const time = Date.now() % cycleDuration; // Current position in cycle
    const t = time / (cycleDuration / 2); // Normalized time (0 to 2)

    // Define the two distinct colors
    const orange = { r: 255, g: 165, b: 0 }; // #FFA500
    const red = { r: 255, g: 0, b: 0 }; // #FF0000

    let r, g, b;

    // Interpolate between orange and red, then back
    if (t < 1) {
      // Orange to Red (0 to 1)
      const factor = t; // 0 to 1
      r = Math.round(orange.r + (red.r - orange.r) * factor);
      g = Math.round(orange.g + (red.g - orange.g) * factor);
      b = Math.round(orange.b + (red.b - orange.b) * factor);
    } else {
      // Red to Orange (1 to 2)
      const factor = 2 - t; // 1 to 0
      r = Math.round(orange.r + (red.r - orange.r) * factor);
      g = Math.round(orange.g + (red.g - orange.g) * factor);
      b = Math.round(orange.b + (red.b - orange.b) * factor);
    }

    const strokeColor = `rgb(${r}, ${g}, ${b})`;

    // Draw solid spiral extending to current hit radius
    ctx.beginPath();
    const maxRadius = this.hitRadius; // Use visual hit radius for drawing
    for (let r = 0; r <= maxRadius; r += 0.5) {
      const angle = r * 0.3; // Spiral tightness
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (r === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = strokeColor; // Use the smoothly transitioning color
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  canCollide() {
    return Date.now() - this.spawnTime >= this.gracePeriod;
  }

  applyGravity(obj) {
    const dx = this.x - obj.x;
    const dy = this.y - obj.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const gravityRadius = this.hitRadius * 3; // Gravity affects objects within 3x visual hit radius

    if (distance < gravityRadius && distance > 0) {
      // Adjust gravity strength based on Zero G mode
      let gravityStrength = zeroGravityToggle.checked
        ? BLACK_HOLE_GRAVITY_STRENGTH * 0.2 // Reduce strength in Zero G (e.g., 20% of normal)
        : BLACK_HOLE_GRAVITY_STRENGTH; // Normal strength otherwise

      // Apply multiplier only for bullets
      if (obj instanceof Bullet) {
        gravityStrength *= BULLET_GRAVITY_MULTIPLIER;
      }

      const force = (gravityStrength * 100) / distance;
      const forceX = (dx / distance) * force;
      const forceY = (dy / distance) * force;

      if (obj instanceof Asteroid && !obj.exploded) {
        obj.velX += forceX;
        obj.velY += forceY;
        // ... spin calculation remains unchanged ...
      } else if (obj === player) {
        obj.velX += forceX;
        obj.velY += forceY;
      } else if (obj instanceof Bullet) {
        let velX = obj.speed * Math.cos(obj.angle);
        let velY = obj.speed * Math.sin(obj.angle);
        velX += forceX;
        velY += forceY;
        obj.speed = Math.sqrt(velX * velX + velY * velY);
        obj.angle = Math.atan2(velY, velX);
      } else if (obj instanceof Star || obj instanceof Shield) {
        obj.velX += forceX;
        obj.velY += forceY;
      }
    }
  }
}

for (let i = 0; i < STARTING_ASTEROIDS; i++) {
  asteroids.push(new Asteroid());
}

function drawStars() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  stars.forEach(star => {
    const parallaxFactor = star.depth * 0.2;
    const offsetX = (player.x - centerX) * parallaxFactor;
    const offsetY = (player.y - centerY) * parallaxFactor;
    const drawX = star.x - offsetX;
    const drawY = star.y - offsetY;

    let alpha = star.brightness;
    if (star.twinkle) {
      alpha = star.brightness * (0.7 + 0.3 * Math.sin(Date.now() * star.twinkleSpeed));
    }

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(drawX, drawY, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlayer() {
  if (player.exploded) {
    player.pieces.forEach(p => p.draw());
    return;
  }

  // Draw shield if active
  if (player.hasShield) {
    const shieldElapsed = Date.now() - player.shieldStartTime;
    const timeLeft = SHIELD_DURATION - shieldElapsed;

    // Blink shield when it's about to expire
    if (timeLeft <= SHIELD_BLINK_DURATION) {
      if (!player.shieldExpireSoundPlayed) {
        playSound('power-up-expire');
        player.shieldExpireSoundPlayed = true;
      }
      player.shieldVisible = Math.floor(Date.now() / 250) % 2 === 0;
    } else {
      // Reset the flag when shield is not in blinking phase
      player.shieldExpireSoundPlayed = false;
    }

    if (player.shieldVisible) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.shieldAngle);
      ctx.beginPath();
      ctx.arc(0, 0, player.hitRadius * 1.5, 0, Math.PI * 2); // Current size
      ctx.strokeStyle = 'white';
      ctx.setLineDash([12, 12]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle + Math.PI / 2);

  // Apply scaling while maintaining proper dimensions
  const scale = (window.devicePixelRatio || 1) * 0.625;
  ctx.scale(player.pulseScale * player.shootScale * scale, player.pulseScale * player.shootScale * scale);

  // Main body with gradient
  ctx.fillStyle = ROCKET_COLOR;
  ctx.beginPath();
  ctx.moveTo(-player.bodyWidth / 2, player.bodyLength);
  ctx.quadraticCurveTo(-player.bodyWidth / 4, 0, -player.bodyWidth / 2, -player.bodyLength);
  ctx.lineTo(player.bodyWidth / 2, -player.bodyLength);
  ctx.quadraticCurveTo(player.bodyWidth / 4, 0, player.bodyWidth / 2, player.bodyLength);
  ctx.fill();

  // Add gradient overlay
  const gradient = ctx.createLinearGradient(0, -player.bodyLength, 0, player.bodyLength);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-player.bodyWidth / 2, player.bodyLength);
  ctx.quadraticCurveTo(-player.bodyWidth / 4, 0, -player.bodyWidth / 2, -player.bodyLength);
  ctx.lineTo(player.bodyWidth / 2, -player.bodyLength);
  ctx.quadraticCurveTo(player.bodyWidth / 4, 0, player.bodyWidth / 2, player.bodyLength);
  ctx.fill();

  // Nose cone
  ctx.fillStyle = ROCKET_ACCENT;
  ctx.beginPath();
  ctx.arc(0, -player.bodyLength, player.bodyWidth / 2, Math.PI, 0);
  ctx.fill();

  // Left fin
  ctx.fillStyle = ROCKET_ACCENT; // Changed from ROCKET_COLOR
  ctx.beginPath();
  ctx.moveTo(-player.bodyWidth / 2 + 2, player.bodyLength);
  ctx.lineTo(-player.bodyWidth / 2 - player.finSize * 1.2 + 2, player.bodyLength + player.finSize);
  ctx.lineTo(-player.bodyWidth / 2 + 2, player.bodyLength - player.finSize * 0.8);
  ctx.closePath();
  ctx.fill();

  // Right fin
  ctx.fillStyle = ROCKET_ACCENT; // Changed from ROCKET_COLOR
  ctx.beginPath();
  ctx.moveTo(player.bodyWidth / 2 - 2, player.bodyLength);
  ctx.lineTo(player.bodyWidth / 2 + player.finSize * 1.2 - 2, player.bodyLength + player.finSize);
  ctx.lineTo(player.bodyWidth / 2 - 2, player.bodyLength - player.finSize * 0.8);
  ctx.closePath();
  ctx.fill();

  // Window
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, -player.bodyLength / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Thrust animation
  if (player.isThrusting) {
    const thrustSize = 10 + Math.sin(player.thrustFrame * 0.3) * 3;
    const thrustColor = THRUST_COLORS[Math.floor(player.thrustFrame / 2) % THRUST_COLORS.length];
    ctx.fillStyle = thrustColor;
    ctx.beginPath();
    ctx.moveTo(-player.bodyWidth / 3, player.bodyLength);
    ctx.lineTo(0, player.bodyLength + thrustSize);
    ctx.lineTo(player.bodyWidth / 3, player.bodyLength);
    ctx.fill();
    player.thrustFrame++;
  }

  ctx.restore(); // Restore after drawing the rocket

  // Draw tracer when Shift is held
  if (keys['Shift']) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    const startOffset = player.bodyLength + player.noseLength + 4; // 4px in front of nose
    const startX = startOffset;
    const endX = startOffset + TRACER_LENGTH;

    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(endX, 0);
    ctx.strokeStyle = TRACER_COLOR;
    ctx.lineWidth = TRACER_WIDTH;
    ctx.setLineDash([TRACER_DASH_SIZE, TRACER_DASH_SIZE]); // Configurable dash and gap size
    ctx.stroke();

    ctx.restore();
  }
}

async function startGame() {
  await unlockAudioContext();
  gameStarted = true;
  playSound('game-start');
  startDialog.style.display = 'none';
  gameStartTime = Date.now();
  timerDisplay.textContent = '0:00';
  pendingBlackHoleSpawnTime =
    Date.now() + Math.random() * (BLACK_HOLE_SPAWN_MAX - BLACK_HOLE_SPAWN_MIN) + BLACK_HOLE_SPAWN_MIN;
  pendingStarSpawnTime = Date.now() + Math.random() * (STAR_SPAWN_MAX - STAR_SPAWN_MIN) + STAR_SPAWN_MIN;
  pendingShieldSpawnTime = Date.now() + Math.random() * (SHIELD_SPAWN_MAX - SHIELD_SPAWN_MIN) + SHIELD_SPAWN_MIN;
}

function restartGame() {
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.angle = 0;
  player.velX = 0;
  player.velY = 0;
  player.exploded = false;
  player.pieces = [];
  player.hasShield = false;
  player.shieldStartTime = 0;
  player.shieldAngle = 0;
  player.shieldVisible = true;
  player.shieldExpireSoundPlayed = false;
  player.isThrusting = false;
  wasThrusting = false;
  bullets = [];
  asteroids = Array(STARTING_ASTEROIDS)
    .fill()
    .map(() => new Asteroid());
  powerUps = [];
  blackHoles = [];
  pendingAsteroids = [];
  score = 0;
  updateHighScore();
  shotsFired = 0;
  hits = 0;
  targetAsteroids = 2;
  asteroidsDestroyed = 0;
  gameOverDisplay.style.display = 'none';
  gameStartTime = Date.now();
  timerDisplay.textContent = '0:00';
  pendingBlackHoleSpawnTime =
    Date.now() + Math.random() * (BLACK_HOLE_SPAWN_MAX - BLACK_HOLE_SPAWN_MIN) + BLACK_HOLE_SPAWN_MIN;
  pendingStarSpawnTime = Date.now() + STAR_SPAWN_MIN + Math.random() * (STAR_SPAWN_MAX - STAR_SPAWN_MIN);
  pendingShieldSpawnTime = Date.now() + SHIELD_SPAWN_MIN + Math.random() * (SHIELD_SPAWN_MAX - SHIELD_SPAWN_MIN);
  playSound('game-start');

  // Reset high score display state
  highScoreDisplay.classList.remove('is-current');

  // Keep the zero gravity setting when restarting
  const zeroGravityEnabled = zeroGravityToggle.checked;
  zeroGravityToggle.checked = zeroGravityEnabled;
}

function updateHighScore() {
  if (score > cachedHighScore) {
    cachedHighScore = score;
    localStorage.setItem('highScore', score);
    highScoreDisplay.textContent = `Best: ${score}`;
    highScoreDisplay.style.display = 'block';
    highScoreDisplay.classList.add('is-current'); // Apply orange color and blinking
  } else {
    highScoreDisplay.textContent = `Best: ${cachedHighScore}`;
    highScoreDisplay.style.display = 'block'; // Always show the display
    highScoreDisplay.classList.remove('is-current'); // Reset to default color
  }
}

function update() {
  if (!gameStarted) {
    asteroids.forEach(a => a.move());
    powerUps.forEach(p => p.move());
    return;
  }

  // Update shield rotation
  if (player.hasShield) {
    player.shieldAngle += (Math.PI * 2) / (SHIELD_ROTATION_DURATION / 16);
    const shieldElapsed = Date.now() - player.shieldStartTime;
    if (shieldElapsed >= SHIELD_DURATION) {
      player.hasShield = false;
      player.shieldExpireSoundPlayed = false;
    }
  }

  if (player.exploded) {
    player.pieces.forEach(p => p.move());
    player.pieces = player.pieces.filter(p => p.life > 0);
    if (player.pieces.length === 0) {
      gameOverDisplay.style.display = 'block';
      restartButton.focus({ focusVisible: false });
      updateHighScore();
    }
  } else {
    // Handle rotation with easing
    const maxRotationSpeed = 0.075;
    const rotationEasing = 0.2;

    // Target rotation speed based on input
    let targetRotationSpeed = 0;
    if (keys['ArrowLeft'] || touchState.left) targetRotationSpeed = -maxRotationSpeed;
    if (keys['ArrowRight'] || touchState.right) targetRotationSpeed = maxRotationSpeed;

    // Add rotationSpeed to player if it doesn't exist
    if (typeof player.rotationSpeed === 'undefined') player.rotationSpeed = 0;

    // Ease into the target rotation speed
    player.rotationSpeed += (targetRotationSpeed - player.rotationSpeed) * rotationEasing;

    // Apply rotation with small threshold to prevent micro-rotations
    if (Math.abs(player.rotationSpeed) > 0.001) {
      player.angle += player.rotationSpeed;
    } else {
      player.rotationSpeed = 0;
    }

    const isZeroGravity = zeroGravityToggle.checked;
    const isThrusting = keys['ArrowUp'] || touchState.thrust;
    const isReversing = keys['ArrowDown'];

    // Calculate new thrusting state
    const newIsThrusting =
      keys['ArrowUp'] ||
      touchState.thrust ||
      keys['ArrowDown'] ||
      keys['ArrowLeft'] ||
      touchState.left ||
      keys['ArrowRight'] ||
      touchState.right;

    // Play sound when thrust animation starts
    if (newIsThrusting && !wasThrusting && gameStarted) {
      playSound('thrust');
    }

    player.isThrusting = newIsThrusting;
    wasThrusting = newIsThrusting;

    if (isZeroGravity) {
      // Zero gravity mode
      if (isThrusting) {
        player.velX += Math.cos(player.angle) * player.acceleration;
        player.velY += Math.sin(player.angle) * player.acceleration;
      }
      if (isReversing) {
        player.velX -= Math.cos(player.angle) * player.acceleration;
        player.velY -= Math.sin(player.angle) * player.acceleration;
      }
    } else {
      // Regular gravity mode - movement only when keys are pressed
      if (!isThrusting && !isReversing) {
        // Apply friction when not thrusting
        const frictionFactor = 0.98;
        player.velX *= frictionFactor;
        player.velY *= frictionFactor;

        // Stop completely if speed is very low
        if (Math.abs(player.velX) < 0.01) player.velX = 0;
        if (Math.abs(player.velY) < 0.01) player.velY = 0;
      } else {
        // Set velocity directly based on current angle and input
        const targetSpeed = isThrusting ? player.maxSpeed : isReversing ? -player.maxSpeed : 0;
        const targetVelX = Math.cos(player.angle) * targetSpeed;
        const targetVelY = Math.sin(player.angle) * targetSpeed;

        // Ease into the target velocity
        const easeAmount = 0.1;
        player.velX += (targetVelX - player.velX) * easeAmount;
        player.velY += (targetVelY - player.velY) * easeAmount;
      }
    }

    const speed = Math.sqrt(player.velX * player.velX + player.velY * player.velY);
    if (speed > player.maxSpeed) {
      player.velX = (player.velX / speed) * player.maxSpeed;
      player.velY = (player.velY / speed) * player.maxSpeed;
    }

    player.x += player.velX;
    player.y += player.velY;

    // Boundary checks with bounce
    if (player.x - player.hitRadius < 0) {
      player.x = player.hitRadius;
      player.velX = Math.abs(player.velX);
    } else if (player.x + player.hitRadius > canvas.width) {
      player.x = canvas.width - player.hitRadius;
      player.velX = -Math.abs(player.velX);
    }
    if (player.y - player.hitRadius < 0) {
      player.y = player.hitRadius;
      player.velY = Math.abs(player.velY);
    } else if (player.y + player.hitRadius > canvas.height) {
      player.y = canvas.height - player.hitRadius;
      player.velY = -Math.abs(player.velY);
    }

    // Thrust animation during acceleration, deceleration, or turning
    player.isThrusting =
      keys['ArrowUp'] ||
      touchState.thrust ||
      keys['ArrowDown'] ||
      keys['ArrowLeft'] ||
      touchState.left ||
      keys['ArrowRight'] ||
      touchState.right;

    if ((keys[' '] || touchState.shoot) && !player.exploded) {
      const currentTime = Date.now();
      if (currentTime - player.lastShotTime >= player.shootCooldown) {
        const noseX = player.x + Math.cos(player.angle) * (player.bodyLength + player.noseLength);
        const noseY = player.y + Math.sin(player.angle) * (player.bodyLength + player.noseLength);
        bullets.push(new Bullet(noseX, noseY, player.angle));
        playSound('shoot');
        shotsFired++;
        player.lastShotTime = currentTime;
        touchState.shoot = false;
        player.shootScale = 1.15;
        player.shootTimer = 10;
      }
    }

    if (player.pulseTimer > 0) {
      player.pulseTimer--;
      if (player.pulseTimer <= 0) player.pulseScale = 1;
    }

    if (player.shootTimer > 0) {
      player.shootTimer--;
      if (player.shootTimer <= 0) player.shootScale = 1;
      else player.shootScale = 1 + 0.15 * (player.shootTimer / 10);
    }

    bullets = bullets.filter(b => {
      b.move();
      return b.x >= 0 && b.x <= canvas.width && b.y >= 0 && b.y <= canvas.height;
    });

    const collisionFactor = 0.8; // Bullets must get 20% closer to trigger explosion
    for (let i = asteroids.length - 1; i >= 0; i--) {
      if (asteroids[i].exploded) continue;
      for (let j = bullets.length - 1; j >= 0; j--) {
        const dx = asteroids[i].x - bullets[j].x;
        const dy = asteroids[i].y - bullets[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < (asteroids[i].hitRadius + bullets[j].size) * collisionFactor) {
          const asteroidPieces = [];
          for (let k = 0; k < 8; k++) {
            const angle = Math.random() * Math.PI * 2;
            const size = Math.random() * 3 + 1;
            asteroidPieces.push(new ExplosionPiece(asteroids[i].x, asteroids[i].y, angle, size, asteroids[i].color));
          }

          asteroids[i].exploded = true;
          asteroids[i].pieces = asteroidPieces;
          asteroids[i].explosionLife = 30;
          playSound('asteroid-explode');

          bullets.splice(j, 1);
          score += 50;
          hits++;
          asteroidsDestroyed += 1;
          updateHighScore();

          const delay = Math.random() * (ASTEROID_SPAWN_MAX - ASTEROID_SPAWN_MIN) + ASTEROID_SPAWN_MIN;
          pendingAsteroids.push({ spawnTime: Date.now() + delay });

          if (asteroidsDestroyed % INCREASE_ASTEROIDS_EVERY_N_HITS === 0) {
            const delay = Math.random() * (ASTEROID_SPAWN_MAX - ASTEROID_SPAWN_MIN) + ASTEROID_SPAWN_MIN;
            pendingAsteroids.push({ spawnTime: Date.now() + delay });
          }
          break;
        }
      }
    }

    // Player-black hole collision
    if (!player.exploded) {
      for (let i = 0; i < blackHoles.length; i++) {
        if (Date.now() - gameStartTime > 3000 && blackHoles[i].canCollide()) {
          const dx = player.x - blackHoles[i].x;
          const dy = player.y - blackHoles[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < player.hitRadius + blackHoles[i].collisionRadius) {
            // Even with a shield, black hole collision ends the game
            player.exploded = true;
            playSound('game-over');
            shakeCanvas();
            bullets = [];
            break;
          }
        }
      }
    }

    // Player-asteroid collision
    if (!player.exploded) {
      for (let i = 0; i < asteroids.length; i++) {
        if (Date.now() - gameStartTime > 3000 && asteroids[i].canCollide() && !asteroids[i].exploded) {
          const dx = player.x - asteroids[i].x;
          const dy = player.y - asteroids[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < player.hitRadius + asteroids[i].hitRadius) {
            if (player.hasShield) {
              asteroids[i].exploded = true;
              asteroids[i].pieces = [];
              for (let k = 0; k < 8; k++) {
                const angle = Math.random() * Math.PI * 2;
                const size = Math.random() * 3 + 1;
                asteroids[i].pieces.push(
                  new ExplosionPiece(asteroids[i].x, asteroids[i].y, angle, size, asteroids[i].color)
                );
              }
              asteroids[i].explosionLife = 30;
              playSound('asteroid-explode');
              score += 50;
              hits++;
              updateHighScore();

              const delay = Math.random() * (ASTEROID_SPAWN_MAX - ASTEROID_SPAWN_MIN) + ASTEROID_SPAWN_MIN;
              pendingAsteroids.push({ spawnTime: Date.now() + delay });

              asteroidsDestroyed += 1;
              if (asteroidsDestroyed % INCREASE_ASTEROIDS_EVERY_N_HITS === 0) {
                const delay = Math.random() * (ASTEROID_SPAWN_MAX - ASTEROID_SPAWN_MIN) + ASTEROID_SPAWN_MIN;
                pendingAsteroids.push({ spawnTime: Date.now() + delay });
              }
            } else {
              player.exploded = true;
              playSound('game-over');
              for (let j = 0; j < 20; j++) {
                const angle = Math.random() * Math.PI * 2;
                const size = Math.random() * 5 + 2;
                player.pieces.push(new ExplosionPiece(player.x, player.y, angle, size, ROCKET_COLOR));
              }
              shakeCanvas();
              bullets = [];
            }
            break;
          }
        }
      }
    }

    // Player-power up collision
    if (!player.exploded) {
      for (let i = 0; i < powerUps.length; i++) {
        const p = powerUps[i];
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.hitRadius + p.hitRadius) {
          if (p instanceof Shield) {
            player.hasShield = true;
            player.shieldStartTime = Date.now();
            player.shieldVisible = true;
            player.shieldExpireSoundPlayed = false;
            playSound('power-up');
            powerUps.splice(i, 1);
            score += 100;
            updateHighScore();
          } else if (p instanceof Star) {
            let destroyedCount = 0;
            asteroids.forEach(a => {
              if (!a.exploded) {
                a.exploded = true;
                a.pieces = [];
                for (let k = 0; k < 8; k++) {
                  const angle = Math.random() * Math.PI * 2;
                  const size = Math.random() * 3 + 1;
                  a.pieces.push(new ExplosionPiece(a.x, a.y, angle, size, a.color));
                }
                a.explosionLife = 30;
                destroyedCount++;
                hits++;
              }
            });
            // Remove all black holes
            if (blackHoles.length > 0) {
              blackHoles = []; // Clear all black holes
              playSound('black-hole-destroy'); // Play sound for black hole destruction
              score += 500; // Bonus points for removing black holes
              // Reset the black hole spawn timer
              pendingBlackHoleSpawnTime =
                Date.now() + Math.random() * (BLACK_HOLE_SPAWN_MAX - BLACK_HOLE_SPAWN_MIN) + BLACK_HOLE_SPAWN_MIN;
            }
            score += destroyedCount * 50 + 1000;
            updateHighScore();
            powerUps.splice(i, 1);
            asteroids = asteroids.filter(a => a.exploded && a.explosionLife > 0);
            for (let i = 0; i < STARTING_ASTEROIDS; i++) {
              asteroids.push(new Asteroid());
            }
            pendingAsteroids = [];
            playSound('power-up');
            playSound('supernova');
            flashActive = true;
            flashStartTime = Date.now();
            shakeCanvas();
          }
          break;
        }
      }
    }

    // Asteroid-black hole collision
    if (blackHoles.length > 0) {
      for (let i = blackHoles.length - 1; i >= 0; i--) {
        const bh = blackHoles[i];
        if (bh.canCollide()) {
          for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j];
            if (!asteroid.exploded) {
              const dx = asteroid.x - bh.x;
              const dy = asteroid.y - bh.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance < asteroid.hitRadius + bh.collisionRadius) {
                asteroids.splice(j, 1);
                playSound('black-hole-destroy');

                // Spawn a new asteroid like when shot by the player
                const delay = Math.random() * (ASTEROID_SPAWN_MAX - ASTEROID_SPAWN_MIN) + ASTEROID_SPAWN_MIN;
                pendingAsteroids.push({ spawnTime: Date.now() + delay });

                asteroidsDestroyed += 1; // Increment total destroyed asteroids
                if (asteroidsDestroyed % INCREASE_ASTEROIDS_EVERY_N_HITS === 0) {
                  const extraDelay = Math.random() * (ASTEROID_SPAWN_MAX - ASTEROID_SPAWN_MIN) + ASTEROID_SPAWN_MIN;
                  pendingAsteroids.push({ spawnTime: Date.now() + extraDelay });
                }
              }
            }
          }
        }
      }
    }
  }

  const now = Date.now();
  // Shield spawning
  if (gameStarted && now >= pendingShieldSpawnTime && now - gameStartTime >= SHIELD_SPAWN_MIN) {
    powerUps.push(new Shield());
    playSound('power-up-spawn');
    pendingShieldSpawnTime = now + Math.random() * (SHIELD_SPAWN_MAX - SHIELD_SPAWN_MIN) + SHIELD_SPAWN_MIN;
  }

  // Star spawning
  if (gameStarted && now >= pendingStarSpawnTime) {
    powerUps.push(new Star());
    playSound('power-up-spawn');
    pendingStarSpawnTime = now + Math.random() * (STAR_SPAWN_MAX - STAR_SPAWN_MIN) + STAR_SPAWN_MIN;
  }

  // Black hole spawning
  if (
    gameStarted &&
    blackHoles.length === 0 &&
    pendingBlackHoleSpawnTime !== null &&
    now >= pendingBlackHoleSpawnTime
  ) {
    blackHoles.push(new BlackHole());
    playSound('black-hole-spawn');
    pendingBlackHoleSpawnTime = null; // Reset until next despawn sets it
  }

  pendingAsteroids = pendingAsteroids.filter(pending => {
    if (now >= pending.spawnTime) {
      asteroids.push(new Asteroid());
      return false;
    }
    return true;
  });

  // Asteroid-asteroid collisions
  for (let i = 0; i < asteroids.length; i++) {
    if (asteroids[i].exploded) continue;
    for (let j = i + 1; j < asteroids.length; j++) {
      if (asteroids[j].exploded) continue;

      const a1 = asteroids[i];
      const a2 = asteroids[j];
      const dx = a1.x - a2.x;
      const dy = a1.y - a2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = a1.hitRadius + a2.hitRadius;

      if (distance < minDistance) {
        // Normalize collision normal
        const nx = dx / distance;
        const ny = dy / distance;

        // Ensure velocities are initialized
        if (!a1.velX) a1.velX = a1.speed * Math.cos(a1.angle);
        if (!a1.velY) a1.velY = a1.speed * Math.sin(a1.angle);
        if (!a2.velX) a2.velX = a2.speed * Math.cos(a2.angle);
        if (!a2.velY) a2.velY = a2.speed * Math.sin(a2.angle);

        // Relative velocity
        const relVelX = a1.velX - a2.velX;
        const relVelY = a1.velY - a2.velY;

        // Velocity component along the normal
        const velAlongNormal = relVelX * nx + relVelY * ny;

        // If asteroids are moving away, skip collision response
        if (velAlongNormal > 0) continue;

        // Approximate mass as proportional to size (area ~ size^2)
        const mass1 = a1.size * a1.size;
        const mass2 = a2.size * a2.size;

        // Elastic collision impulse (coefficient of restitution = 1 for perfect elasticity)
        const impulse = (2 * velAlongNormal) / (mass1 + mass2);
        const impulseX = impulse * nx;
        const impulseY = impulse * ny;

        // Update velocities
        a1.velX -= impulseX * mass2;
        a1.velY -= impulseY * mass2;
        a2.velX += impulseX * mass1;
        a2.velY += impulseY * mass1;

        // Update speed and angle based on new velocities
        a1.speed = Math.sqrt(a1.velX * a1.velX + a1.velY * a1.velY);
        a1.angle = Math.atan2(a1.velY, a1.velX);
        a2.speed = Math.sqrt(a2.velX * a2.velX + a2.velY * a2.velY);
        a2.angle = Math.atan2(a2.velY, a2.velX);

        // Position correction to prevent sticking
        const overlap = (minDistance - distance) * 0.5; // Split overlap evenly
        const correctionX = nx * overlap;
        const correctionY = ny * overlap;
        a1.x += correctionX;
        a1.y += correctionY;
        a2.x -= correctionX;
        a2.y -= correctionY;
      }
    }
  }

  // Apply black hole gravity
  blackHoles.forEach(bh => {
    asteroids.forEach(a => {
      if (!a.exploded) bh.applyGravity(a);
    });
    powerUps.forEach(p => bh.applyGravity(p));
    bullets.forEach(b => bh.applyGravity(b));
    if (!player.exploded) bh.applyGravity(player);
  });

  // Update positions
  asteroids.forEach(a => a.move());
  powerUps.forEach(p => p.move());
  blackHoles.forEach(bh => bh.move());
}

function formatTime(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);

  return (
    new Intl.NumberFormat('en-US', {
      minimumIntegerDigits: 1,
      useGrouping: false
    }).format(minutes) +
    ':' +
    new Intl.NumberFormat('en-US', {
      minimumIntegerDigits: 2,
      useGrouping: false
    }).format(seconds)
  );
}

function draw() {
  ctx.save(); // Save the context state before applying transformations

  // Apply shake effect if active
  if (isShaking) {
    const elapsed = Date.now() - shakeStartTime;
    if (elapsed < shakeDuration) {
      // Calculate diminishing shake intensity
      const progress = elapsed / shakeDuration;
      const currentIntensity = shakeIntensity * (1 - progress);
      const offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
      const offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
      ctx.translate(offsetX, offsetY);
    } else {
      isShaking = false;
    }
  }

  // Create a gradient for the background
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#06000b'); // Dark blue at the top
  gradient.addColorStop(1, '#1c042f'); // Lighter blue at the bottom
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars();
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
  blackHoles.forEach(bh => bh.draw());
  drawPlayer();
  bullets.forEach(b => b.draw());
  scoreDisplay.textContent = `Score: ${score}`;
  accuracyDisplay.textContent = `Accuracy: ${shotsFired > 0 ? Math.round((hits / shotsFired) * 100) : 0}%`;
  hitsDisplay.textContent = `Hits: ${hits}`;

  // Update timer
  if (gameStarted && !player.exploded) {
    const elapsedTime = Date.now() - gameStartTime;
    timerDisplay.textContent = formatTime(elapsedTime);
  }

  if (flashActive) {
    const elapsed = Date.now() - flashStartTime;
    let flashOpacity;
    if (elapsed < fadeInTime) {
      flashOpacity = elapsed / fadeInTime;
    } else if (elapsed < fadeInTime + fullOpacityTime) {
      flashOpacity = 1;
    } else if (elapsed < fadeInTime + fullOpacityTime + fadeOutTime) {
      flashOpacity = 1 - (elapsed - fadeInTime - fullOpacityTime) / fadeOutTime;
    } else {
      flashActive = false;
      flashOpacity = 0;
    }
    ctx.fillStyle = `rgba(255, 255, 0, ${flashOpacity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.restore(); // Restore the context state after drawing
}

function shakeCanvas() {
  isShaking = true;
  shakeStartTime = Date.now();
}

function gameLoop() {
  if (!isPaused) {
    update();
    draw();
  }
  requestAnimationFrame(gameLoop);
}

function pauseGame() {
  if (!isPaused) {
    isPaused = true;
    pauseTime = Date.now();
    // No need to stop the gameLoop explicitly since it checks isPaused
  }
}

function resumeGame() {
  if (isPaused) {
    isPaused = false;
    const pauseDuration = Date.now() - pauseTime;

    // Adjust all timers to account for the pause duration
    if (gameStarted) {
      gameStartTime += pauseDuration;
    }
    if (pendingStarSpawnTime) pendingStarSpawnTime += pauseDuration;
    if (pendingShieldSpawnTime) pendingShieldSpawnTime += pauseDuration;
    if (pendingBlackHoleSpawnTime) pendingBlackHoleSpawnTime += pauseDuration;
    if (player.hasShield) player.shieldStartTime += pauseDuration;
    if (flashActive) flashStartTime += pauseDuration;
    if (isShaking) shakeStartTime += pauseDuration;

    pendingAsteroids = pendingAsteroids.map(pending => ({
      ...pending,
      spawnTime: pending.spawnTime + pauseDuration
    }));

    asteroids.forEach(a => {
      a.spawnTime += pauseDuration;
    });
    powerUps.forEach(p => {
      p.spawnTime += pauseDuration;
    });
    blackHoles.forEach(bh => {
      bh.spawnTime += pauseDuration;
    });
  }
}

// Sound management with Web Audio API
let audioContext = null;
let isAudioUnlocked = false;
const soundBuffers = {};

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

async function unlockAudioContext() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === 'suspended' || !isAudioUnlocked) {
      await audioContext.resume();
      isAudioUnlocked = true;

      // Load sounds if not already loaded
      if (Object.keys(soundBuffers).length === 0) {
        await preloadSounds();
      }
    }
  } catch (err) {
    console.warn('Audio context initialization failed:', err);
  }
}

async function playSound(soundName) {
  if (!isSoundEnabled || !soundBuffers[soundName]) return;

  const ctx = initAudioContext();

  if (!isAudioUnlocked) {
    await unlockAudioContext();
  }

  const source = ctx.createBufferSource();
  source.buffer = soundBuffers[soundName];
  source.connect(ctx.destination);
  source.start(0);
  source.onended = () => source.disconnect();
}

// Update the preloadSounds function to use the lazy-loaded context
async function preloadSounds() {
  const ctx = initAudioContext();

  const soundFiles = {
    'asteroid-explode': 'sounds/asteroid-explode.mp3',
    'asteroid-spawn': 'sounds/asteroid-spawn.mp3',
    'black-hole-destroy': 'sounds/black-hole-destroy.mp3',
    'black-hole-spawn': 'sounds/black-hole-spawn.mp3',
    click: 'sounds/click.mp3',
    'game-over': 'sounds/game-over.mp3',
    'game-start': 'sounds/game-start.mp3',
    'power-up-spawn': 'sounds/power-up-spawn.mp3',
    'power-up': 'sounds/power-up.mp3',
    'power-up-expire': 'sounds/power-up-expire.mp3',
    shoot: 'sounds/shoot.mp3',
    supernova: 'sounds/supernova.mp3',
    thrust: 'sounds/thrust.mp3'
  };

  for (const [key, url] of Object.entries(soundFiles)) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      soundBuffers[key] = await ctx.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error(`Failed to load sound ${key}:`, error);
    }
  }
}

function initSoundToggle() {
  const soundToggle = document.getElementById('soundToggle');
  let touchStartTime = 0;

  // Use a single handler for both touch and click
  function handleSoundToggle(e) {
    e.preventDefault();
    e.stopPropagation();

    // Prevent double-firing on touch devices
    if (e.type === 'touchend') {
      const touchEndTime = Date.now();
      if (touchEndTime - touchStartTime < 500) {
        // Within 500ms
        toggleSound();
        unlockAudioContext();
      }
    } else if (e.type === 'click') {
      // Only handle click if not a touch device
      if (!('ontouchstart' in window)) {
        toggleSound();
        unlockAudioContext();
      }
    }
  }

  soundToggle.addEventListener('touchstart', e => {
    e.preventDefault();
    touchStartTime = Date.now();
  });

  soundToggle.addEventListener('touchend', handleSoundToggle);
  soundToggle.addEventListener('click', handleSoundToggle);
}

function toggleSound() {
  if (typeof isSoundEnabled === 'undefined') {
    isSoundEnabled = true; // Set default if undefined
  }
  isSoundEnabled = !isSoundEnabled;

  // Update UI
  const soundToggle = document.getElementById('soundToggle');
  soundToggle.classList.toggle('muted', !isSoundEnabled);

  // Save preference
  try {
    localStorage.setItem('soundEnabled', isSoundEnabled.toString());
  } catch (e) {
    console.warn('Could not save sound preference:', e);
  }

  // Initialize audio if enabled
  if (isSoundEnabled) {
    unlockAudioContext();
  }
}

// Load zero gravity preference from localStorage
const savedGravityState = localStorage.getItem('zeroGravity');
if (savedGravityState !== null) {
  zeroGravityToggle.checked = savedGravityState === 'true';
}

// Save zero gravity state when changed
zeroGravityToggle.addEventListener('change', () => {
  localStorage.setItem('zeroGravity', zeroGravityToggle.checked);
});

window.addEventListener('resize', () => {
  scaleFactor = window.innerWidth < 768 ? 0.5 : 1;
  canvas.width = window.innerWidth / scaleFactor;
  canvas.height = window.innerHeight / scaleFactor;
  ctx.scale(scaleFactor, scaleFactor); // Re-apply scale after resize
  player.x = canvas.width / 2; // Reset player position
  player.y = canvas.height / 2;
  stars.forEach(star => {
    star.x = Math.random() * canvas.width;
    star.y = Math.random() * canvas.height;
  });
});

// Cheap focus-visible-like heuristic
window.addEventListener('keydown', () => {
  document.documentElement.classList.add('is-using-keyboard');
});

window.addEventListener('mousemove', () => {
  document.documentElement.classList.remove('is-using-keyboard');
});

window.addEventListener('load', () => {
  // Initialize sound state from localStorage
  try {
    const savedSoundState = localStorage.getItem('soundEnabled');
    isSoundEnabled = savedSoundState === null ? true : savedSoundState === 'true';
  } catch (e) {
    isSoundEnabled = true;
  }

  // Initialize UI
  const soundToggle = document.getElementById('soundToggle');
  soundToggle.classList.toggle('muted', !isSoundEnabled);

  // Initialize other components
  initSoundToggle();
  updateHighScore();
});

// Unlock audio on first user interaction
window.addEventListener(
  'touchstart',
  () => {
    unlockAudioContext();
  },
  { once: true }
);

window.addEventListener(
  'click',
  () => {
    unlockAudioContext();
  },
  { once: true }
);

// Pause + restart the game when visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGame();
  } else {
    resumeGame();
  }
});

if (savedSoundState !== null) {
  isSoundEnabled = savedSoundState === 'true';
  soundToggle.classList.toggle('muted', !isSoundEnabled);
}

checkForTextureMode();
gameLoop();
