"use strict";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const el = id => document.getElementById(id);
const ui = {
  hud: el("hud"), home: el("homeScreen"), shop: el("shopScreen"), pause: el("pauseScreen"), result: el("resultScreen"),
  menuPoints: el("menuPoints"), shopPoints: el("shopPoints"), hudPoints: el("hudPoints"), hudLevel: el("hudLevel"),
  hudFood: el("hudFood"), hudLives: el("hudLives"), combo: el("comboBadge"), power: el("powerBadge"),
  banner: el("levelBanner"), bannerTitle: el("levelBannerTitle"), bannerText: el("levelBannerText"), toast: el("toast"),
  touch: el("touchControls"), resultIcon: el("resultIcon"), resultTitle: el("resultTitle"), resultText: el("resultText"),
  play: el("playBtn"), sound: el("soundBtn"), pauseBtn: el("pauseBtn"), install: el("installBtn")
};

const SPRITE = "assets/sprites/";
const AUDIO = "assets/audio/";
const imageFiles = {
  cover: "cover.webp", grass: "grass.webp", rockBg: "rock.webp", snow: "snow.webp",
  chick: "chicken.webp", hen: "hen.webp", rooster: "rooster.webp", golden: "golden_chicken.webp", boss: "boss_rooster.webp",
  rock: "obstacle_rock.webp", fence: "obstacle_fence.webp", heart: "hud_heart.webp",
  greenHead: "snake_head.webp", greenEat: "snake_head_eating.webp", greenBody: "snake_body.webp", greenTail: "snake_tail.webp",
  yellowHead: "snake_head_yellow.webp", yellowEat: "snake_head_yellow_eating.webp", yellowBody: "snake_body_yellow.webp", yellowTail: "snake_tail_yellow.webp",
  blueHead: "snake_head_blue.webp", blueEat: "snake_head_blue_eating.webp", blueBody: "snake_body_blue.webp", blueTail: "snake_tail_blue.webp",
  shield: "powerup_shield.webp", magnet: "powerup_magnet.webp", slow: "powerup_slow.webp",
  double: "powerup_double_points.webp", ghost: "powerup_ghost.webp", shorten: "powerup_shorten.webp"
};
const soundFiles = {
  eat: "eat_chicken.ogg", cluck: "chicken_cluck.ogg", golden: "golden_chicken.ogg", powerup: "powerup.ogg",
  combo: "combo.ogg", shield: "shield_hit.ogg", collision: "collision_soft.ogg", rock: "rock_hit.ogg",
  fence: "fence_hit.ogg", level: "level_complete.ogg", win: "game_win.ogg", lose: "game_over.ogg",
  boss: "boss_rooster.ogg", click: "ui_click.ogg", back: "ui_back.ogg", buy: "shop_buy.ogg"
};
const images = {};
const sounds = {};

const DIR = {
  up: { x: 0, y: -1, angle: Math.PI }, down: { x: 0, y: 1, angle: 0 },
  left: { x: -1, y: 0, angle: -Math.PI / 2 }, right: { x: 1, y: 0, angle: Math.PI / 2 }
};
const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
const LEVEL_NAMES = ["Græni völlurinn", "Hænsnagarðurinn", "Fyrstu steinarnir", "Hænan á flótta", "Gullið glitrar", "Gamla girðingin", "Hraði haninn", "Power-up veisla", "Síðasta æfingin", "Risahaninn"];
const DIFFICULTY = {
  calm: { speed: 285, lives: 5, wrap: true, label: "Rólegt" },
  normal: { speed: 195, lives: 3, wrap: false, label: "Venjulegt" },
  hard: { speed: 135, lives: 2, wrap: false, label: "Krefjandi" }
};
const POWER_INFO = {
  shield: { label: "Skjöldur", duration: 0 }, magnet: { label: "Segull", duration: 8500 },
  slow: { label: "Hægagangur", duration: 7500 }, double: { label: "Tvöföld stig", duration: 9000 },
  ghost: { label: "Draugur", duration: 7000 }, shorten: { label: "Stytting", duration: 0 }
};

const defaultSave = () => ({
  points: 0, difficulty: "calm", muted: false,
  ownedSkins: ["green"], selectedSkin: "green",
  ownedBackgrounds: ["grass"], selectedBackground: "grass",
  iron: 0, wall: false, lucky: false
});
function loadSave() {
  try {
    const value = JSON.parse(localStorage.getItem("snakeChickenSaveV2"));
    return Object.assign(defaultSave(), value || {});
  } catch { return defaultSave(); }
}
let save = loadSave();
function persist() {
  localStorage.setItem("snakeChickenSaveV2", JSON.stringify(save));
  refreshPoints();
}

let mode = "menu";
let level = 1;
let levelTarget = 5;
let levelProgress = 0;
let lives = 3;
let runPoints = 0;
let snake = [];
let direction = "right";
let queuedDirection = "right";
let food = null;
let goldenFood = null;
let powerup = null;
let obstacles = [];
let obstacleCells = new Set();
let boss = null;
let bossHits = 0;
let moveAccumulator = 0;
let foodMoveAccumulator = 0;
let bossMoveAccumulator = 0;
let combo = 1;
let comboLeft = 0;
let activePowers = {};
let shieldCharges = 0;
let particles = [];
let lastFrame = performance.now();
let deferredInstallPrompt = null;
let bannerTimer = 0;
let toastTimer = 0;
let touchStart = null;

let view = { width: innerWidth, height: innerHeight, dpr: 1, tile: 54, cols: 20, rows: 12, x: 0, y: 64, fieldW: 1080, fieldH: 648 };

function key(pos) { return `${pos.x},${pos.y}`; }
function same(a, b) { return a && b && a.x === b.x && a.y === b.y; }
function randInt(max) { return Math.floor(Math.random() * max); }
function choice(items) { return items[randInt(items.length)]; }

function preload() {
  const imageJobs = Object.entries(imageFiles).map(([name, file]) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { images[name] = img; resolve(); };
    img.onerror = reject;
    img.src = SPRITE + file;
  }));
  for (const [name, file] of Object.entries(soundFiles)) {
    const audio = new Audio(AUDIO + file);
    audio.preload = "auto";
    sounds[name] = audio;
  }
  return Promise.all(imageJobs);
}

function playSound(name, volume = .62) {
  if (save.muted || !sounds[name]) return;
  const audio = sounds[name].cloneNode();
  audio.volume = Math.min(1, volume);
  audio.play().catch(() => {});
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = innerWidth;
  const height = innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = width < 820 ? 92 : 66;
  const targetCols = width < height ? 11 : 20;
  const targetRows = width < height ? 20 : 12;
  const tile = Math.max(28, Math.min(64, Math.floor(Math.min(width / targetCols, (height - top) / targetRows))));
  const cols = Math.max(9, Math.floor(width / tile));
  const rows = Math.max(8, Math.floor((height - top) / tile));
  const fieldW = cols * tile;
  const fieldH = rows * tile;
  view = { width, height, dpr, tile, cols, rows, fieldW, fieldH, x: Math.floor((width - fieldW) / 2), y: top + Math.floor((height - top - fieldH) / 2) };
  if (mode === "playing" || mode === "paused" || mode === "transition") ensureGameInsideBounds();
}

function ensureGameInsideBounds() {
  const inside = p => p.x >= 0 && p.x < view.cols && p.y >= 0 && p.y < view.rows;
  if (snake.some(p => !inside(p))) resetSnakeOnly();
  if (food && !inside(food.pos)) spawnFood();
  if (goldenFood && !inside(goldenFood.pos)) goldenFood = null;
  if (boss && !inside(boss.pos)) spawnBoss();
}

function refreshPoints() {
  ui.menuPoints.textContent = save.points;
  ui.shopPoints.textContent = save.points;
  ui.hudPoints.textContent = save.points;
}

function setScreen(name) {
  ui.home.classList.toggle("hidden", name !== "home");
  ui.shop.classList.toggle("hidden", name !== "shop");
  ui.pause.classList.toggle("hidden", name !== "pause");
  ui.result.classList.toggle("hidden", name !== "result");
  const playingView = ["game", "pause", "result"].includes(name);
  ui.hud.classList.toggle("hidden", !playingView);
  const coarse = matchMedia("(pointer: coarse)").matches || innerWidth < 800;
  ui.touch.classList.toggle("hidden", !(playingView && name === "game" && coarse));
}

async function requestFullscreen() {
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    try { await document.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch {}
  }
}

function showToast(text, ms = 1600) {
  ui.toast.textContent = text;
  ui.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.add("hidden"), ms);
}

function showBanner(title, text, ms = 1250) {
  ui.bannerTitle.textContent = title;
  ui.bannerText.textContent = text;
  ui.banner.classList.remove("hidden");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => ui.banner.classList.add("hidden"), ms);
}

function startRun() {
  requestFullscreen();
  playSound("click", .5);
  mode = "playing";
  level = 1;
  runPoints = 0;
  lives = DIFFICULTY[save.difficulty].lives + save.iron;
  startLevel(1);
  setScreen("game");
}

function startLevel(nextLevel) {
  level = nextLevel;
  levelTarget = level === 10 ? 5 : 4 + level;
  levelProgress = 0;
  bossHits = 0;
  combo = 1;
  comboLeft = 0;
  activePowers = {};
  shieldCharges = 0;
  powerup = null;
  goldenFood = null;
  makeObstacles();
  resetSnakeOnly();
  if (level === 10) {
    food = null;
    spawnBoss();
    playSound("boss", .46);
  } else {
    boss = null;
    spawnFood();
  }
  updateHud();
  showBanner(level === 10 ? "LOKABORÐ" : `Borð ${level}`, LEVEL_NAMES[level - 1], 1550);
}

function resetSnakeOnly() {
  let cx = Math.floor(view.cols / 2);
  let cy = Math.floor(view.rows / 2);
  while (obstacleCells.has(`${cx},${cy}`) || obstacleCells.has(`${cx - 1},${cy}`) || obstacleCells.has(`${cx - 2},${cy}`)) {
    cy = (cy + 1) % Math.max(1, view.rows - 1);
  }
  snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
  direction = "right";
  queuedDirection = "right";
  moveAccumulator = 0;
}

function isFree(pos, extra = []) {
  if (pos.x < 0 || pos.x >= view.cols || pos.y < 0 || pos.y >= view.rows) return false;
  if (obstacleCells.has(key(pos)) || snake.some(p => same(p, pos))) return false;
  if (food && same(food.pos, pos)) return false;
  if (goldenFood && same(goldenFood.pos, pos)) return false;
  if (powerup && same(powerup.pos, pos)) return false;
  if (boss && same(boss.pos, pos)) return false;
  return !extra.some(p => same(p, pos));
}

function randomFreeCell(extra = []) {
  for (let i = 0; i < 500; i++) {
    const p = { x: randInt(view.cols), y: randInt(view.rows) };
    if (isFree(p, extra)) return p;
  }
  return { x: 1, y: 1 };
}

function makeObstacles() {
  obstacles = [];
  obstacleCells = new Set();
  if (level < 3) return;
  const reserved = new Set();
  const cx = Math.floor(view.cols / 2), cy = Math.floor(view.rows / 2);
  for (let x = cx - 4; x <= cx + 3; x++) for (let y = cy - 2; y <= cy + 2; y++) reserved.add(`${x},${y}`);
  const canPlace = cells => cells.every(p => p.x > 0 && p.x < view.cols - 1 && p.y > 1 && p.y < view.rows - 1 && !reserved.has(key(p)) && !obstacleCells.has(key(p)));
  const rockCount = Math.min(5, Math.ceil((level - 2) / 2));
  for (let n = 0; n < rockCount; n++) {
    for (let tries = 0; tries < 100; tries++) {
      const p = { x: 1 + randInt(Math.max(1, view.cols - 2)), y: 2 + randInt(Math.max(1, view.rows - 3)) };
      if (canPlace([p])) { obstacles.push({ type: "rock", cells: [p] }); obstacleCells.add(key(p)); break; }
    }
  }
  if (level >= 6) {
    const fenceCount = Math.min(3, 1 + Math.floor((level - 6) / 2));
    for (let n = 0; n < fenceCount; n++) {
      for (let tries = 0; tries < 100; tries++) {
        const vertical = Math.random() < .45;
        const p = { x: 1 + randInt(Math.max(1, view.cols - 3)), y: 2 + randInt(Math.max(1, view.rows - 4)) };
        const q = vertical ? { x: p.x, y: p.y + 1 } : { x: p.x + 1, y: p.y };
        if (canPlace([p, q])) {
          obstacles.push({ type: "fence", cells: [p, q], vertical });
          obstacleCells.add(key(p)); obstacleCells.add(key(q)); break;
        }
      }
    }
  }
}

function chooseBirdType() {
  const roll = Math.random();
  if (level >= 5 && roll < .14) return "rooster";
  if (level >= 3 && roll < .38) return "hen";
  return "chick";
}

function spawnFood() {
  const type = chooseBirdType();
  food = { pos: randomFreeCell(), type };
  foodMoveAccumulator = 0;
  if (Math.random() < .13) playSound("cluck", .2);
}

function spawnBoss() {
  boss = { pos: randomFreeCell(), hits: bossHits };
  bossMoveAccumulator = 0;
}

function spawnGolden() {
  if (goldenFood || level === 10) return;
  const chance = .11 + (save.lucky ? .09 : 0);
  if (Math.random() < chance) goldenFood = { pos: randomFreeCell(), left: 6500 };
}

function spawnPowerup() {
  if (powerup || level < 2 || Math.random() > .18) return;
  powerup = { pos: randomFreeCell(), type: choice(Object.keys(POWER_INFO)), left: 9000 };
}

function turn(newDirection) {
  if (mode !== "playing" || !DIR[newDirection]) return;
  if (newDirection !== OPPOSITE[queuedDirection]) queuedDirection = newDirection;
}

function movementInterval() {
  let interval = DIFFICULTY[save.difficulty].speed - (level - 1) * (save.difficulty === "hard" ? 4 : 3);
  if (activePowers.slow > 0) interval *= 1.58;
  return Math.max(78, interval);
}

function stepSnake() {
  direction = queuedDirection;
  const d = DIR[direction];
  let next = { x: snake[0].x + d.x, y: snake[0].y + d.y };
  const ghost = activePowers.ghost > 0;
  const wraps = DIFFICULTY[save.difficulty].wrap || save.wall || ghost;
  if (wraps) {
    next.x = (next.x + view.cols) % view.cols;
    next.y = (next.y + view.rows) % view.rows;
  } else if (next.x < 0 || next.x >= view.cols || next.y < 0 || next.y >= view.rows) {
    collide("wall"); return;
  }

  const willEat = (food && same(next, food.pos)) || (goldenFood && same(next, goldenFood.pos)) || (boss && same(next, boss.pos));
  const selfBody = willEat ? snake : snake.slice(0, -1);
  if (!ghost && (selfBody.some(p => same(p, next)) || obstacleCells.has(key(next)))) {
    const obstacle = obstacles.find(o => o.cells.some(p => same(p, next)));
    collide(obstacle?.type || "self"); return;
  }

  snake.unshift(next);
  let grew = false;
  if (level === 10 && boss && same(next, boss.pos)) {
    grew = true;
    catchBoss(next);
  } else {
    if (food && same(next, food.pos)) { grew = true; eatBird(food.type, false, next); }
    if (goldenFood && same(next, goldenFood.pos)) { grew = true; eatBird("golden", true, next); }
    if (powerup && same(next, powerup.pos)) activatePower(powerup.type, next);
  }
  if (!grew) snake.pop();
  if (activePowers.magnet > 0 && food) pullFoodCloser();
}

function collide(type) {
  if (shieldCharges > 0) {
    shieldCharges--;
    playSound("shield");
    burst(snake[0], "#9dff64", 15);
    showToast("Skjöldurinn bjargaði þér!");
    const safe = findSafeDirection();
    if (safe) direction = queuedDirection = safe;
    updateHud();
    return;
  }
  playSound(type === "rock" ? "rock" : type === "fence" ? "fence" : "collision", .6);
  lives--;
  combo = 1;
  comboLeft = 0;
  burst(snake[0], "#ff7b5c", 18);
  updateHud();
  if (lives > 0) {
    showToast(`Úps! ${lives} ${lives === 1 ? "líf" : "líf"} eftir`, 1300);
    resetSnakeOnly();
  } else {
    finishRun(false);
  }
}

function findSafeDirection() {
  const candidates = Object.keys(DIR).filter(name => name !== OPPOSITE[direction]);
  for (const name of candidates) {
    const d = DIR[name];
    let p = { x: snake[0].x + d.x, y: snake[0].y + d.y };
    const wraps = DIFFICULTY[save.difficulty].wrap || save.wall || activePowers.ghost > 0;
    if (wraps) {
      p.x = (p.x + view.cols) % view.cols;
      p.y = (p.y + view.rows) % view.rows;
    }
    if (p.x < 0 || p.x >= view.cols || p.y < 0 || p.y >= view.rows) continue;
    if (!obstacleCells.has(key(p)) && !snake.slice(0, -1).some(cell => same(cell, p))) return name;
  }
  return null;
}

function eatBird(type, isGolden, pos) {
  const base = type === "golden" ? 10 : type === "rooster" ? 5 : type === "hen" ? 3 : 1;
  combo = comboLeft > 0 ? Math.min(5, combo + 1) : 1;
  comboLeft = 4500;
  const multiplier = activePowers.double > 0 ? 2 : 1;
  const gain = base * combo * multiplier;
  save.points += gain;
  runPoints += gain;
  persist();
  if (isGolden) {
    goldenFood = null;
    playSound("golden", .8);
    burst(pos, "#ffe65a", 28);
    showToast(`GULLKJÚKLINGUR! +${gain}`);
  } else {
    levelProgress++;
    playSound(combo > 1 ? "combo" : "eat", .7);
    burst(pos, type === "rooster" ? "#28b7f0" : type === "hen" ? "#f4e0c0" : "#ffd838", 14 + combo * 2);
    spawnFood();
    spawnGolden();
    spawnPowerup();
  }
  updateHud();
  if (!isGolden && levelProgress >= levelTarget) completeLevel();
}

function catchBoss(pos) {
  bossHits++;
  levelProgress = bossHits;
  combo = comboLeft > 0 ? Math.min(5, combo + 1) : 1;
  comboLeft = 5000;
  const gain = 10 * combo * (activePowers.double > 0 ? 2 : 1);
  save.points += gain;
  runPoints += gain;
  persist();
  playSound(bossHits >= 5 ? "win" : "golden", .8);
  burst(pos, choice(["#16a9e6", "#fff4cf", "#ff4d3d", "#ffbf27"]), 34);
  if (bossHits >= 5) {
    boss = null;
    updateHud();
    setTimeout(() => finishRun(true), 250);
  } else {
    spawnBoss();
    showToast(`Risahaninn: ${bossHits}/5`);
    updateHud();
  }
}

function activatePower(type, pos) {
  playSound("powerup", .76);
  burst(pos, "#8cf5ff", 22);
  powerup = null;
  if (type === "shield") shieldCharges++;
  else if (type === "shorten") {
    snake.splice(Math.max(3, snake.length - 4));
    showToast("Snákurinn styttist!");
  } else activePowers[type] = POWER_INFO[type].duration;
  updateHud();
}

function pullFoodCloser() {
  const dX = snake[0].x - food.pos.x;
  const dY = snake[0].y - food.pos.y;
  if (Math.abs(dX) + Math.abs(dY) <= 2) return;
  const options = [];
  if (Math.abs(dX) >= Math.abs(dY)) options.push({ x: food.pos.x + Math.sign(dX), y: food.pos.y });
  if (dY) options.push({ x: food.pos.x, y: food.pos.y + Math.sign(dY) });
  if (dX) options.push({ x: food.pos.x + Math.sign(dX), y: food.pos.y });
  const valid = options.find(p => isFree(p));
  if (valid) food.pos = valid;
}

function moveBird() {
  if (!food || food.type === "chick") return;
  const dirs = Object.values(DIR);
  const candidates = dirs.map(d => ({ x: food.pos.x + d.x, y: food.pos.y + d.y })).filter(p => isFree(p));
  if (!candidates.length) return;
  if (food.type === "rooster") {
    candidates.sort((a, b) => distance(b, snake[0]) - distance(a, snake[0]));
    food.pos = candidates[0];
  } else food.pos = choice(candidates.concat([food.pos, food.pos]));
}

function moveBoss() {
  if (!boss) return;
  const candidates = Object.values(DIR).map(d => ({ x: boss.pos.x + d.x, y: boss.pos.y + d.y })).filter(p => isFree(p));
  if (!candidates.length) return;
  candidates.sort((a, b) => distance(b, snake[0]) - distance(a, snake[0]) + (Math.random() - .5) * 2);
  boss.pos = candidates[0];
}

function distance(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

function completeLevel() {
  if (mode !== "playing") return;
  mode = "transition";
  playSound("level", .72);
  showBanner("BORÐ KLÁRAÐ!", `Þú fékkst ${runPoints} stig í þessari umferð`, 1450);
  setTimeout(() => {
    if (mode !== "transition") return;
    startLevel(level + 1);
    mode = "playing";
  }, 1500);
}

function finishRun(won) {
  mode = won ? "won" : "gameover";
  playSound(won ? "win" : "lose", .82);
  ui.resultIcon.textContent = won ? "🏆" : "🐍";
  ui.resultTitle.textContent = won ? "ÞÚ VANNST!" : "Góð tilraun!";
  ui.resultText.textContent = won ? `Þú sigraðir risahanann og safnaðir ${runPoints} stigum.` : `Þú komst á borð ${level} og safnaðir ${runPoints} stigum.`;
  el("resultBtn").textContent = won ? "SPILA AFTUR" : "REYNA AFTUR";
  setScreen("result");
}

function pauseGame() {
  if (mode !== "playing") return;
  mode = "paused";
  playSound("click", .45);
  setScreen("pause");
}
function resumeGame() {
  if (mode !== "paused") return;
  mode = "playing";
  lastFrame = performance.now();
  playSound("click", .45);
  setScreen("game");
}

function update(dt) {
  updateParticles(dt);
  if (mode !== "playing") return;
  moveAccumulator += dt;
  foodMoveAccumulator += dt;
  bossMoveAccumulator += dt;
  comboLeft = Math.max(0, comboLeft - dt);
  if (!comboLeft) combo = 1;
  for (const type of Object.keys(activePowers)) {
    activePowers[type] = Math.max(0, activePowers[type] - dt);
    if (!activePowers[type]) delete activePowers[type];
  }
  if (goldenFood) {
    goldenFood.left -= dt;
    if (goldenFood.left <= 0) goldenFood = null;
  }
  if (powerup) {
    powerup.left -= dt;
    if (powerup.left <= 0) powerup = null;
  }
  const birdDelay = food?.type === "rooster" ? 900 : 1550;
  if (foodMoveAccumulator >= birdDelay) { foodMoveAccumulator = 0; moveBird(); }
  if (bossMoveAccumulator >= Math.max(480, 850 - level * 18)) { bossMoveAccumulator = 0; moveBoss(); }
  const interval = movementInterval();
  while (moveAccumulator >= interval && mode === "playing") {
    moveAccumulator -= interval;
    stepSnake();
  }
  updateHud();
}

function updateHud() {
  ui.hudLevel.textContent = `${level}/10`;
  ui.hudFood.textContent = `${levelProgress}/${levelTarget}`;
  ui.hudPoints.textContent = save.points;
  ui.hudLives.innerHTML = Array.from({ length: Math.max(0, lives) }, () => `<img src="${SPRITE}hud_heart.webp" alt="">`).join("");
  ui.combo.textContent = `COMBO ×${combo}`;
  ui.combo.classList.toggle("hidden", combo < 2 || comboLeft <= 0);
  const labels = [];
  if (shieldCharges) labels.push(`🛡️ ${shieldCharges}`);
  for (const [type, left] of Object.entries(activePowers)) labels.push(`${POWER_INFO[type].label} ${Math.ceil(left / 1000)}s`);
  ui.power.textContent = labels.join(" · ");
  ui.power.classList.toggle("hidden", !labels.length);
}

function drawCover(img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale, sh = h / scale;
  const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawSprite(img, pos, size = view.tile * 1.04, angle = 0, alpha = 1) {
  if (!img || !pos) return;
  const cx = view.x + (pos.x + .5) * view.tile;
  const cy = view.y + (pos.y + .5) * view.tile;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, view.width, view.height);
  if (!["playing", "paused", "transition", "won", "gameover"].includes(mode)) {
    ctx.fillStyle = "#07150b";
    ctx.fillRect(0, 0, view.width, view.height);
    return;
  }
  const bg = images[save.selectedBackground === "rock" ? "rockBg" : save.selectedBackground] || images.grass;
  ctx.fillStyle = "#07150b";
  ctx.fillRect(0, 0, view.width, view.height);
  drawCover(bg, view.x, view.y, view.fieldW, view.fieldH);
  ctx.strokeStyle = "rgba(255,255,255,.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= view.cols; x++) { ctx.beginPath(); ctx.moveTo(view.x + x * view.tile, view.y); ctx.lineTo(view.x + x * view.tile, view.y + view.fieldH); ctx.stroke(); }
  for (let y = 0; y <= view.rows; y++) { ctx.beginPath(); ctx.moveTo(view.x, view.y + y * view.tile); ctx.lineTo(view.x + view.fieldW, view.y + y * view.tile); ctx.stroke(); }

  for (const obstacle of obstacles) {
    if (obstacle.type === "rock") drawSprite(images.rock, obstacle.cells[0], view.tile * 1.08);
    else {
      const a = obstacle.cells[0], b = obstacle.cells[1];
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const cx = view.x + (center.x + .5) * view.tile, cy = view.y + (center.y + .5) * view.tile;
      ctx.save(); ctx.translate(cx, cy); if (obstacle.vertical) ctx.rotate(Math.PI / 2);
      ctx.drawImage(images.fence, -view.tile, -view.tile / 2, view.tile * 2, view.tile); ctx.restore();
    }
  }

  if (food) {
    const img = images[food.type];
    const bob = 1 + Math.sin(performance.now() / 220) * .035;
    drawSprite(img, food.pos, view.tile * .94 * bob);
  }
  if (goldenFood) {
    const pulse = 1 + Math.sin(performance.now() / 110) * .08;
    glowAt(goldenFood.pos, "#ffe43b", view.tile * .72);
    drawSprite(images.golden, goldenFood.pos, view.tile * 1.03 * pulse, 0, Math.min(1, goldenFood.left / 600));
  }
  if (powerup) {
    const pulse = 1 + Math.sin(performance.now() / 130) * .07;
    glowAt(powerup.pos, "#65f1ff", view.tile * .65);
    drawSprite(images[powerup.type], powerup.pos, view.tile * .84 * pulse, 0, Math.min(1, powerup.left / 600));
  }
  if (boss) {
    glowAt(boss.pos, "#ff8a32", view.tile * 1.05);
    drawSprite(images.boss, boss.pos, view.tile * 1.72 * (1 + Math.sin(performance.now() / 180) * .035));
  }

  drawSnake();
  drawParticles();
  ctx.strokeStyle = "rgba(255,255,255,.2)";
  ctx.lineWidth = 3;
  ctx.strokeRect(view.x + 1.5, view.y + 1.5, view.fieldW - 3, view.fieldH - 3);
}

function drawSnake() {
  if (!snake.length) return;
  const skin = save.selectedSkin;
  const ghostAlpha = activePowers.ghost > 0 ? .62 : 1;
  const bodyImg = images[`${skin}Body`];
  const tailImg = images[`${skin}Tail`];
  const foodAhead = (() => {
    const d = DIR[direction];
    const look = { x: snake[0].x + d.x, y: snake[0].y + d.y };
    return (food && same(look, food.pos)) || (goldenFood && same(look, goldenFood.pos)) || (boss && same(look, boss.pos));
  })();
  for (let i = snake.length - 1; i >= 1; i--) {
    if (i === snake.length - 1) {
      const toward = directionBetween(snake[i], snake[i - 1]);
      drawSprite(tailImg, snake[i], view.tile * 1.1, DIR[toward].angle, ghostAlpha);
    } else {
      const a = snake[i - 1], b = snake[i + 1];
      const horizontal = wrappedDelta(a.x, b.x, view.cols) !== 0;
      drawSprite(bodyImg, snake[i], view.tile * 1.1, horizontal ? Math.PI / 2 : 0, ghostAlpha);
    }
  }
  if (shieldCharges) glowAt(snake[0], "#9dff64", view.tile * .85);
  const headImg = images[`${skin}${foodAhead ? "Eat" : "Head"}`];
  drawSprite(headImg, snake[0], view.tile * 1.18, DIR[direction].angle, ghostAlpha);
}

function wrappedDelta(a, b, size) {
  let d = b - a;
  if (Math.abs(d) > 1) d = d > 0 ? d - size : d + size;
  return d;
}
function directionBetween(a, b) {
  const dx = wrappedDelta(a.x, b.x, view.cols), dy = wrappedDelta(a.y, b.y, view.rows);
  if (dx > 0) return "right"; if (dx < 0) return "left"; if (dy > 0) return "down"; return "up";
}
function glowAt(pos, color, radius) {
  const cx = view.x + (pos.x + .5) * view.tile, cy = view.y + (pos.y + .5) * view.tile;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, color + "99"); gradient.addColorStop(1, color + "00");
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
}

function burst(pos, color, amount) {
  const x = view.x + (pos.x + .5) * view.tile, y = view.y + (pos.y + .5) * view.tile;
  for (let i = 0; i < amount; i++) particles.push({ x, y, vx: (Math.random() - .5) * 190, vy: (Math.random() - .8) * 190, life: 600 + Math.random() * 500, max: 1100, size: 3 + Math.random() * 6, color });
}
function updateParticles(dt) {
  particles.forEach(p => { p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vy += 250 * dt / 1000; p.life -= dt; });
  particles = particles.filter(p => p.life > 0);
}
function drawParticles() {
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}

function frame(now) {
  const dt = Math.min(60, now - lastFrame);
  lastFrame = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

const shopItems = [
  { id: "green", kind: "skin", name: "Græni snákurinn", desc: "Klassíski snákurinn.", price: 0, img: "greenHead" },
  { id: "yellow", kind: "skin", name: "Gullsnákurinn", desc: "Bjartur og glitrandi.", price: 60, img: "yellowHead" },
  { id: "blue", kind: "skin", name: "Íssnákurinn", desc: "Kaldur og knár.", price: 60, img: "blueHead" },
  { id: "grass", kind: "background", name: "Græni völlurinn", desc: "Mjúkt gras og sumar.", price: 0, img: "grass" },
  { id: "rock", kind: "background", name: "Grjótvöllurinn", desc: "Ævintýralegur moldarstígur.", price: 80, img: "rockBg" },
  { id: "snow", kind: "background", name: "Snjóvöllurinn", desc: "Kaldur og fallegur.", price: 80, img: "snow" },
  { id: "iron", kind: "upgrade", name: "Járnsnákur", desc: "Eitt aukalíf í hverri umferð. Hámark 2.", prices: [120, 220], img: "heart" },
  { id: "wall", kind: "upgrade", name: "Veggjasnákur", desc: "Farðu út um eina hlið og inn um hina.", price: 260, img: "ghost" },
  { id: "lucky", kind: "upgrade", name: "Gullheppni", desc: "Gullkjúklingar birtast oftar.", price: 180, img: "golden" }
];

function renderShop() {
  refreshPoints();
  const grid = el("shopGrid");
  grid.replaceChildren();
  for (const item of shopItems) {
    let owned = false, equipped = false, price = item.price || 0, label = "";
    if (item.kind === "skin") { owned = save.ownedSkins.includes(item.id); equipped = save.selectedSkin === item.id; }
    if (item.kind === "background") { owned = save.ownedBackgrounds.includes(item.id); equipped = save.selectedBackground === item.id; }
    if (item.id === "iron") { owned = save.iron >= 2; price = owned ? 0 : item.prices[save.iron]; }
    if (item.id === "wall") owned = save.wall;
    if (item.id === "lucky") owned = save.lucky;
    if (equipped) label = "VALIÐ";
    else if (owned && item.kind !== "upgrade") label = "VELJA";
    else if (owned) label = "KEYPT";
    else if (!price) label = "ÓKEYPIS";
    else label = `KAUPA · ⭐ ${price}`;
    const card = document.createElement("article");
    card.className = `shop-item${equipped ? " equipped" : ""}`;
    card.innerHTML = `<img src="${SPRITE + imageFiles[item.img]}" alt=""><h2>${item.name}</h2><p>${item.desc}</p><button class="${equipped || owned && item.kind === "upgrade" ? "secondary-btn" : "primary-btn"}">${label}</button>`;
    const button = card.querySelector("button");
    button.disabled = equipped || (owned && item.kind === "upgrade");
    button.addEventListener("click", () => buyOrEquip(item, price, owned));
    grid.append(card);
  }
}

function buyOrEquip(item, price, owned) {
  if (!owned && price > save.points) { playSound("collision", .35); showToast("Þú átt ekki nóg af stigum enn."); return; }
  if (!owned && price) save.points -= price;
  if (item.kind === "skin") {
    if (!save.ownedSkins.includes(item.id)) save.ownedSkins.push(item.id);
    save.selectedSkin = item.id;
  } else if (item.kind === "background") {
    if (!save.ownedBackgrounds.includes(item.id)) save.ownedBackgrounds.push(item.id);
    save.selectedBackground = item.id;
  } else if (item.id === "iron") save.iron++;
  else if (item.id === "wall") save.wall = true;
  else if (item.id === "lucky") save.lucky = true;
  persist();
  playSound(owned ? "click" : "buy", .7);
  renderShop();
}

function goHome() {
  mode = "menu";
  playSound("back", .45);
  setScreen("home");
  refreshPoints();
}

function setMuted(value) {
  save.muted = value;
  ui.sound.textContent = save.muted ? "🔇" : "🔊";
  persist();
  if (!value) playSound("click", .5);
}

document.querySelectorAll(".difficulty-btn").forEach(button => button.addEventListener("click", () => {
  save.difficulty = button.dataset.difficulty;
  document.querySelectorAll(".difficulty-btn").forEach(b => b.classList.toggle("selected", b === button));
  persist(); playSound("click", .45);
}));
ui.play.addEventListener("click", startRun);
el("shopBtn").addEventListener("click", () => { playSound("click", .45); mode = "shop"; renderShop(); setScreen("shop"); });
el("shopBackBtn").addEventListener("click", goHome);
el("fullscreenBtn").addEventListener("click", requestFullscreen);
ui.sound.addEventListener("click", () => setMuted(!save.muted));
ui.pauseBtn.addEventListener("click", pauseGame);
el("resumeBtn").addEventListener("click", resumeGame);
el("restartBtn").addEventListener("click", () => { startLevel(level); mode = "playing"; setScreen("game"); });
el("menuBtn").addEventListener("click", goHome);
el("resultMenuBtn").addEventListener("click", goHome);
el("resultBtn").addEventListener("click", startRun);

ui.install.addEventListener("click", async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  } else {
    showToast("Í Edge/Chrome: veldu ⋮ og síðan „Setja upp forrit“.", 3300);
  }
});
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferredInstallPrompt = event; ui.install.classList.remove("hidden"); });
window.addEventListener("appinstalled", () => showToast("Appið er uppsett!"));

window.addEventListener("keydown", event => {
  const map = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
  if (map[event.key]) { event.preventDefault(); turn(map[event.key]); }
  if ((event.key === "p" || event.key === "P" || event.key === "Escape") && mode === "playing") pauseGame();
  else if ((event.key === "p" || event.key === "P" || event.key === "Escape") && mode === "paused") resumeGame();
  if (event.key === "f" || event.key === "F") requestFullscreen();
  if (event.key === "m" || event.key === "M") setMuted(!save.muted);
});
document.querySelectorAll("[data-dir]").forEach(button => {
  button.addEventListener("pointerdown", event => { event.preventDefault(); turn(button.dataset.dir); });
});
canvas.addEventListener("pointerdown", event => { touchStart = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener("pointerup", event => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > 22) turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  touchStart = null;
});
window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "playing") pauseGame(); });

async function init() {
  ui.play.disabled = true;
  ui.play.textContent = "HLEÐ...";
  resize();
  try {
    await preload();
    ui.play.disabled = false;
    ui.play.textContent = "SPILA";
  } catch (error) {
    console.error(error);
    ui.play.textContent = "VILLA VIÐ HLEÐSLU";
    showToast("Ekki tókst að hlaða myndum leiksins.", 5000);
  }
  save.difficulty = DIFFICULTY[save.difficulty] ? save.difficulty : "calm";
  document.querySelectorAll(".difficulty-btn").forEach(b => b.classList.toggle("selected", b.dataset.difficulty === save.difficulty));
  setMuted(save.muted);
  refreshPoints();
  setScreen("home");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  requestAnimationFrame(frame);
}
init();
