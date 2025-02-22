const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const zeroGravityToggle = document.getElementById('zeroGravityToggle');
const accuracyDisplay = document.getElementById('accuracy');
const hitsDisplay = document.getElementById('hits');
const timerDisplay = document.getElementById('timer');
const highScoreDisplay = document.getElementById('highScore');
const gameOverDisplay = document.getElementById('gameOver');
const startDialog = document.getElementById('startDialog');
const touchControls = document.getElementById('touchControls');
const leftButton = document.getElementById('leftButton');
const rightButton = document.getElementById('rightButton');
const thrustButton = document.getElementById('thrustButton');
const shootButton = document.getElementById('shootButton');
let cachedHighScore = parseInt(localStorage.getItem('highScore')) || 0;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  angle: 0,
  velX: 0,
  velY: 0,
  maxSpeed: 3,
  acceleration: 0.1,
  bodyLength: 14,
  bodyWidth: 14,
  noseLength: 12,
  finSize: 8,
  pulseScale: 1,
  pulseTimer: 0,
  shootScale: 1,
  shootTimer: 0,
  exploded: false,
  pieces: [],
  hitRadius: 25,
  thrustFrame: 0,
  isThrusting: false,
  hasShield: false,
  shieldStartTime: 0,
  shieldAngle: 0,
  shieldVisible: true
};

let bullets = [];
let asteroids = [];
let powerUps = [];
let score = 0;
let shotsFired = 0;
let hits = 0;
let targetAsteroids = 2;
let pendingAsteroids = [];
let asteroidsDestroyed = 0;
let gameStarted = false;
let gameStartTime;
let pendingStarSpawnTime;
let pendingShieldSpawnTime = null;
let flashActive = false;
let flashStartTime;
let fadeInTime = 25;
let fullOpacityTime = 25;
let fadeOutTime = 25;

const ROCKET_COLOR = '#00B7FF';
const ROCKET_ACCENT = '#FFFFFF';
const THRUST_COLORS = ['#FF6B00', '#FF9500', '#FFC107'];
const ASTEROID_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#A100A1'];
const ASTEROID_MIN_SIZE = 20;
const ASTEROID_MAX_SIZE = 45;
const ASTEROID_SPAWN_MIN = 1000; // 1 second
const ASTEROID_SPAWN_MAX = 4000; // 4 seconds
const BULLET_COLOR = '#FFBF00';
const STARTING_ASTEROIDS = 3;
const INCREASE_ASTEROIDS_EVERY_N_HITS = 5;
const STAR_SPAWN_MIN = 60000; // 60 seconds
const STAR_SPAWN_MAX = 90000; // 90 seconds
const SHIELD_SPAWN_MIN = 15000; // 30 seconds
const SHIELD_SPAWN_MAX = 30000; // 60 seconds
const SHIELD_DURATION = 8000; // 8 seconds
const SHIELD_ROTATION_DURATION = 2500;
const SHIELD_BLINK_DURATION = 2000; // 2 seconds blink warning
const HIGH_SCORE_DEFAULT_COLOR = '#00ffcc';
const HIGH_SCORE_BEATEN_COLOR = '#ff3366';

const stars = [];
const STAR_COUNT = 50;
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

  // Add an asteroid when pressing backtick
  if (e.key === '`' && gameStarted && !player.exploded) {
    asteroids.push(new Asteroid());
  }

  if (!gameStarted) {
    startGame();
  } else if (player.exploded && player.pieces.length === 0) {
    restartGame();
  }
});
window.addEventListener('keyup', e => (keys[e.key] = false));

// Touch controls
const touchState = {
  left: false,
  right: false,
  thrust: false,
  shoot: false
};

function handleTouchStart(e) {
  e.preventDefault();
  const touches = e.touches;
  for (let i = 0; i < touches.length; i++) {
    const touch = touches[i];
    const x = touch.clientX;
    const y = touch.clientY;
    if (isTouchingButton(x, y, leftButton)) touchState.left = true;
    if (isTouchingButton(x, y, rightButton)) touchState.right = true;
    if (isTouchingButton(x, y, thrustButton)) touchState.thrust = true;
    if (isTouchingButton(x, y, shootButton)) touchState.shoot = true;
  }
  if (!gameStarted && touches.length > 0) {
    startGame();
  } else if (player.exploded && player.pieces.length === 0 && touches.length > 0) {
    restartGame();
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
    this.rotationSpeed = Math.random() * 0.02 - 0.01;
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
    this.x += this.speed * Math.cos(this.angle);
    this.y += this.speed * Math.sin(this.angle);

    const buffer = this.hitRadius;
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

    // Create base gradient
    const gradient = ctx.createRadialGradient(this.size * 0.3, -this.size * 0.3, 0, 0, 0, this.size * 1.2);

    const hexToRgb = hex => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };

    const baseColor = hexToRgb(this.color);

    // Create more color variants for texture
    const lighten = (color, amount) => ({
      r: Math.min(255, color.r + amount),
      g: Math.min(255, color.g + amount),
      b: Math.min(255, color.b + amount)
    });

    const darken = (color, amount) => ({
      r: Math.max(0, color.r - amount),
      g: Math.max(0, color.g - amount),
      b: Math.max(0, color.b - amount)
    });

    const highlightColor = lighten(baseColor, 80);
    const lightColor = lighten(baseColor, 40);
    const shadowColor = darken(baseColor, 60);
    const deepShadowColor = darken(baseColor, 90);

    // Create multi-step gradient for more depth
    gradient.addColorStop(0, `rgb(${highlightColor.r}, ${highlightColor.g}, ${highlightColor.b})`);
    gradient.addColorStop(0.3, `rgb(${lightColor.r}, ${lightColor.g}, ${lightColor.b})`);
    gradient.addColorStop(0.6, `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})`);
    gradient.addColorStop(0.8, `rgb(${shadowColor.r}, ${shadowColor.g}, ${shadowColor.b})`);
    gradient.addColorStop(1, `rgb(${deepShadowColor.r}, ${deepShadowColor.g}, ${deepShadowColor.b})`);

    // Draw base shape with smooth edges
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      const cp1x = this.points[i - 1].x + (this.points[i].x - this.points[i - 1].x) * 0.3;
      const cp1y = this.points[i - 1].y + (this.points[i].y - this.points[i - 1].y) * 0.3;
      const cp2x = this.points[i].x - (this.points[i].x - this.points[i - 1].x) * 0.3;
      const cp2y = this.points[i].y - (this.points[i].y - this.points[i - 1].y) * 0.3;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, this.points[i].x, this.points[i].y);
    }
    // Connect back to the first point
    const lastIndex = this.points.length - 1;
    const cp1x = this.points[lastIndex].x + (this.points[0].x - this.points[lastIndex].x) * 0.3;
    const cp1y = this.points[lastIndex].y + (this.points[0].y - this.points[lastIndex].y) * 0.3;
    const cp2x = this.points[0].x - (this.points[0].x - this.points[lastIndex].x) * 0.3;
    const cp2y = this.points[0].y - (this.points[0].y - this.points[lastIndex].y) * 0.3;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, this.points[0].x, this.points[0].y);
    ctx.closePath();
    ctx.fill();

    // Generate and store craters if they don't exist
    if (!this.craters) {
      this.craters = [];
      const numCraters = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < numCraters; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.size * 0.6;
        this.craters.push({
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          radius: Math.random() * (this.size * 0.25) + this.size * 0.1,
          depth: Math.random() * 0.6 + 0.2,
          rimWidth: Math.random() * 0.3 + 0.1,
          rimLight: Math.random() * 0.4 + 0.3
        });
      }
    }

    // Draw enhanced craters
    this.craters.forEach(crater => {
      // Draw crater shadow
      const craterGradient = ctx.createRadialGradient(crater.x, crater.y, 0, crater.x, crater.y, crater.radius);

      craterGradient.addColorStop(
        0,
        `rgba(${deepShadowColor.r}, ${deepShadowColor.g}, ${deepShadowColor.b}, ${crater.depth})`
      );
      craterGradient.addColorStop(
        0.7,
        `rgba(${shadowColor.r}, ${shadowColor.g}, ${shadowColor.b}, ${crater.depth * 0.8})`
      );
      craterGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = craterGradient;
      ctx.beginPath();
      ctx.arc(crater.x, crater.y, crater.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw crater rim highlight
      const rimGradient = ctx.createRadialGradient(
        crater.x - crater.radius * 0.2,
        crater.y - crater.radius * 0.2,
        crater.radius * (1 - crater.rimWidth),
        crater.x,
        crater.y,
        crater.radius * 1.1
      );

      rimGradient.addColorStop(
        0,
        `rgba(${highlightColor.r}, ${highlightColor.g}, ${highlightColor.b}, ${crater.rimLight})`
      );
      rimGradient.addColorStop(
        0.3,
        `rgba(${lightColor.r}, ${lightColor.g}, ${lightColor.b}, ${crater.rimLight * 0.7})`
      );
      rimGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = rimGradient;
      ctx.beginPath();
      ctx.arc(crater.x, crater.y, crater.radius * 1.1, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  canCollide() {
    return Date.now() - this.spawnTime >= this.gracePeriod;
  }
}

class ExplosionPiece {
  constructor(x, y, angle, size) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = Math.random() * 5 + 2;
    this.size = size;
    this.life = 60;
  }

  move() {
    this.x += this.speed * Math.cos(this.angle);
    this.y += this.speed * Math.sin(this.angle);
    this.life--;
  }

  draw() {
    ctx.fillStyle = '#FFFFFF';
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
    this.spawnTime = Date.now();
    this.lifeTime = 10000; // 10 seconds
    this.fadeInDuration = 1000;
    this.fadeOutDuration = 1000;
    this.scale = 0;
    this.opacity = 0;
    this.color = '#FFFF00';
  }

  move() {
    this.x += this.speed * Math.cos(this.angle);
    this.y += this.speed * Math.sin(this.angle);

    const buffer = this.hitRadius;
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

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 0, 1)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0.7)');
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
    this.x += this.speed * Math.cos(this.angle);
    this.y += this.speed * Math.sin(this.angle);

    const buffer = this.hitRadius;
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
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.restore();
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
      player.shieldVisible = Math.floor(Date.now() / 250) % 2 === 0;
    }

    if (player.shieldVisible) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.shieldAngle);
      ctx.beginPath();
      ctx.arc(0, 0, player.hitRadius * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'white';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle + Math.PI / 2);

  // Apply scaling while maintaining proper dimensions
  const scale = (window.devicePixelRatio || 1) * 0.625; // Increased by 25%
  ctx.scale(player.pulseScale * player.shootScale * scale, player.pulseScale * player.shootScale * scale);

  // Main body
  ctx.fillStyle = ROCKET_COLOR;
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
  ctx.fillStyle = ROCKET_COLOR;
  ctx.beginPath();
  ctx.moveTo(-player.bodyWidth / 2 + 2, player.bodyLength);
  ctx.lineTo(-player.bodyWidth / 2 - player.finSize * 1.2 + 2, player.bodyLength + player.finSize);
  ctx.lineTo(-player.bodyWidth / 2 + 2, player.bodyLength - player.finSize * 0.8);
  ctx.closePath();
  ctx.fill();

  // Right fin
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

  ctx.restore();
}

function startGame() {
  gameStarted = true;
  startDialog.style.display = 'none';
  gameStartTime = Date.now();
  timerDisplay.textContent = '0:00';
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
  bullets = [];
  asteroids = Array(STARTING_ASTEROIDS)
    .fill()
    .map(() => new Asteroid());
  powerUps = [];
  pendingAsteroids = [];
  score = 0;
  shotsFired = 0;
  hits = 0;
  targetAsteroids = 2;
  asteroidsDestroyed = 0;
  gameOverDisplay.style.display = 'none';
  gameStartTime = Date.now();
  timerDisplay.textContent = '0:00';
  pendingStarSpawnTime = Date.now() + Math.random() * (STAR_SPAWN_MAX - STAR_SPAWN_MIN) + STAR_SPAWN_MIN;
  pendingShieldSpawnTime = Date.now() + Math.random() * (SHIELD_SPAWN_MAX - SHIELD_SPAWN_MIN) + SHIELD_SPAWN_MIN;

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
    highScoreDisplay.textContent = `High Score: ${score}`;
    highScoreDisplay.style.display = 'block';
    highScoreDisplay.classList.add('is-current');
  } else if (cachedHighScore > 0) {
    highScoreDisplay.textContent = `High Score: ${cachedHighScore}`;
    highScoreDisplay.style.display = 'block';
  } else {
    highScoreDisplay.style.display = 'none';
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
    }
  }

  if (player.exploded) {
    player.pieces.forEach(p => p.move());
    player.pieces = player.pieces.filter(p => p.life > 0);
    if (player.pieces.length === 0) {
      gameOverDisplay.style.display = 'block';
      updateHighScore();
    }
  } else {
    // Handle rotation with easing
    const maxRotationSpeed = 0.1;
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

    if (keys[' '] || touchState.shoot) {
      const noseX = player.x + Math.cos(player.angle) * (player.bodyLength + player.noseLength);
      const noseY = player.y + Math.sin(player.angle) * (player.bodyLength + player.noseLength);
      bullets.push(new Bullet(noseX, noseY, player.angle));
      shotsFired++;
      keys[' '] = false; // Reset key state
      touchState.shoot = false; // Reset touch state
      player.shootScale = 1.15;
      player.shootTimer = 10;
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

    for (let i = asteroids.length - 1; i >= 0; i--) {
      if (asteroids[i].exploded) continue;
      for (let j = bullets.length - 1; j >= 0; j--) {
        const dx = asteroids[i].x - bullets[j].x;
        const dy = asteroids[i].y - bullets[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < asteroids[i].hitRadius + bullets[j].size) {
          const asteroidPieces = [];
          for (let k = 0; k < 8; k++) {
            const angle = Math.random() * Math.PI * 2;
            const size = Math.random() * 3 + 1;
            asteroidPieces.push(new ExplosionPiece(asteroids[i].x, asteroids[i].y, angle, size));
          }

          asteroids[i].exploded = true;
          asteroids[i].pieces = asteroidPieces;
          asteroids[i].explosionLife = 30;

          bullets.splice(j, 1);
          score += 50;
          hits++;
          asteroidsDestroyed += 1;

          if (score > cachedHighScore) {
            updateHighScore();
          }

          // Spawn a new asteroid soon
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

    if (!player.exploded) {
      for (let i = 0; i < asteroids.length; i++) {
        if (Date.now() - gameStartTime > 3000 && asteroids[i].canCollide() && !asteroids[i].exploded) {
          const dx = player.x - asteroids[i].x;
          const dy = player.y - asteroids[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < player.hitRadius + asteroids[i].hitRadius) {
            if (player.hasShield) {
              // Destroy asteroid instead of player
              asteroids[i].exploded = true;
              asteroids[i].pieces = [];
              for (let k = 0; k < 8; k++) {
                const angle = Math.random() * Math.PI * 2;
                const size = Math.random() * 3 + 1;
                asteroids[i].pieces.push(new ExplosionPiece(asteroids[i].x, asteroids[i].y, angle, size));
              }
              asteroids[i].explosionLife = 30;
              score += 50;
              hits++;

              const delay = Math.random() * (ASTEROID_SPAWN_MAX - ASTEROID_SPAWN_MIN) + ASTEROID_SPAWN_MIN;
              pendingAsteroids.push({ spawnTime: Date.now() + delay });

              asteroidsDestroyed += 1;
              if (asteroidsDestroyed % INCREASE_ASTEROIDS_EVERY_N_HITS === 0) {
                const delay = Math.random() * (ASTEROID_SPAWN_MAX - ASTEROID_SPAWN_MIN) + ASTEROID_SPAWN_MIN;
                pendingAsteroids.push({ spawnTime: Date.now() + delay });
              }
            } else {
              // Explosion code
              player.exploded = true;
              for (let j = 0; j < 20; j++) {
                const angle = Math.random() * Math.PI * 2;
                const size = Math.random() * 5 + 2;
                player.pieces.push(new ExplosionPiece(player.x, player.y, angle, size));
              }
              // Clear all bullets when player explodes
              bullets = [];
            }
            break;
          }
        }
      }
    }

    if (!player.exploded) {
      for (let i = 0; i < powerUps.length; i++) {
        const p = powerUps[i];
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.hitRadius + p.hitRadius) {
          if (p instanceof Shield) {
            // Shield power up
            player.hasShield = true;
            player.shieldStartTime = Date.now();
            player.shieldVisible = true;
            powerUps.splice(i, 1);
            score += 100;
          } else if (p instanceof Star) {
            // Star power up
            let destroyedCount = 0;
            asteroids.forEach(a => {
              if (!a.exploded) {
                a.exploded = true;
                a.pieces = [];
                for (let k = 0; k < 8; k++) {
                  const angle = Math.random() * Math.PI * 2;
                  const size = Math.random() * 3 + 1;
                  a.pieces.push(new ExplosionPiece(a.x, a.y, angle, size));
                }
                a.explosionLife = 30;
                destroyedCount++;
                hits++;
              }
            });
            score += destroyedCount * 50 + 1000;
            powerUps.splice(i, 1);
            asteroids = asteroids.filter(a => a.exploded && a.explosionLife > 0);
            for (let i = 0; i < STARTING_ASTEROIDS; i++) {
              asteroids.push(new Asteroid());
            }
            pendingAsteroids = [];
            flashActive = true;
            flashStartTime = Date.now();
          }
          break;
        }
      }
    }
  }

  const now = Date.now();
  if (gameStarted && now >= pendingStarSpawnTime) {
    powerUps.push(new Star());
    pendingStarSpawnTime = now + Math.random() * (STAR_SPAWN_MAX - STAR_SPAWN_MIN) + STAR_SPAWN_MIN;
  }

  if (gameStarted && now >= pendingShieldSpawnTime) {
    powerUps.push(new Shield());
    pendingShieldSpawnTime = now + Math.random() * (SHIELD_SPAWN_MAX - SHIELD_SPAWN_MIN) + SHIELD_SPAWN_MIN;
  }

  pendingAsteroids = pendingAsteroids.filter(pending => {
    if (now >= pending.spawnTime) {
      asteroids.push(new Asteroid());
      return false;
    }
    return true;
  });

  for (let i = 0; i < asteroids.length; i++) {
    if (asteroids[i].exploded) continue;
    for (let j = i + 1; j < asteroids.length; j++) {
      if (asteroids[j].exploded) continue;
      const dx = asteroids[i].x - asteroids[j].x;
      const dy = asteroids[i].y - asteroids[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = asteroids[i].hitRadius + asteroids[j].hitRadius;

      if (distance < minDistance) {
        const nx = dx / distance;
        const ny = dy / distance;
        const relVelX =
          asteroids[i].speed * Math.cos(asteroids[i].angle) - asteroids[j].speed * Math.cos(asteroids[j].angle);
        const relVelY =
          asteroids[i].speed * Math.sin(asteroids[i].angle) - asteroids[j].speed * Math.sin(asteroids[j].angle);
        const impulse = (2 * (relVelX * nx + relVelY * ny)) / 2;
        const angleI = Math.atan2(
          asteroids[i].speed * Math.sin(asteroids[i].angle) - impulse * ny,
          asteroids[i].speed * Math.cos(asteroids[i].angle) - impulse * nx
        );
        const angleJ = Math.atan2(
          asteroids[j].speed * Math.sin(asteroids[j].angle) + impulse * ny,
          asteroids[j].speed * Math.cos(asteroids[j].angle) + impulse * nx
        );
        asteroids[i].angle = angleI;
        asteroids[j].angle = angleJ;
        const overlap = minDistance - distance;
        const pushX = (nx * overlap) / 2;
        const pushY = (ny * overlap) / 2;
        asteroids[i].x += pushX;
        asteroids[i].y += pushY;
        asteroids[j].x -= pushX;
        asteroids[j].y -= pushY;
      }
    }
  }

  asteroids.forEach(a => a.move());
  powerUps.forEach(p => p.move());
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStars();
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
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
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
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
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  player.x = canvas.width / 2;
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
  updateHighScore();
});

gameLoop();
