const THREE_URLS = [
  "./vendor/three.module.js",
  "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "https://unpkg.com/three@0.160.0/build/three.module.js",
  "https://cdn.skypack.dev/three@0.160.0",
];

const ui = {
  canvas: document.querySelector("#gameCanvas"),
  boot: document.querySelector("#bootScreen"),
  start: document.querySelector("#startBtn"),
  kills: document.querySelector("#kills"),
  wave: document.querySelector("#wave"),
  streak: document.querySelector("#streak"),
  ammo: document.querySelector("#ammo"),
  reserve: document.querySelector("#reserve"),
  reload: document.querySelector("#reloadBtn"),
  healthFill: document.querySelector("#healthFill"),
  healthText: document.querySelector("#healthText"),
  staminaFill: document.querySelector("#staminaFill"),
  hitmarker: document.querySelector("#hitmarker"),
  damage: document.querySelector("#damageVignette"),
  radar: document.querySelector("#radar"),
  toast: document.querySelector("#toast"),
  bootMode: document.querySelector("#bootMode"),
  bootTitle: document.querySelector("#bootTitle"),
  bootDesc: document.querySelector("#bootDesc"),
  modeChip: document.querySelector("#modeChip"),
  objectiveText: document.querySelector("#objectiveText"),
  weaponName: document.querySelector("#weaponName"),
  roundLabel: document.querySelector("#roundLabel"),
  crosshair: document.querySelector("#crosshair"),
  killfeed: document.querySelector("#killfeed"),
  scoreboard: document.querySelector("#scoreboardOverlay"),
  settings: document.querySelector("#settingsPanel"),
  result: document.querySelector("#resultOverlay"),
  sensitivity: document.querySelector("#sensitivityInput"),
  volume: document.querySelector("#volumeInput"),
  quality: document.querySelector("#qualityToggle"),
  resume: document.querySelector("#resumeBtn"),
  restart: document.querySelector("#restartBtn"),
  boardMode: document.querySelector("#boardMode"),
  boardKills: document.querySelector("#boardKills"),
  boardAccuracy: document.querySelector("#boardAccuracy"),
  boardBestStreak: document.querySelector("#boardBestStreak"),
  resultTitle: document.querySelector("#resultTitle"),
  resultKills: document.querySelector("#resultKills"),
  resultAccuracy: document.querySelector("#resultAccuracy"),
  resultBestStreak: document.querySelector("#resultBestStreak"),
  resultTime: document.querySelector("#resultTime"),
};

let THREE;
let scene;
let camera;
let renderer;
let clock;
let textureLoader;
let enemyTexture;
let enemyTextures = [];
let enemyActionTexture;
let enemyFrames = {};
let sceneVideo;
let sceneVideoTexture;
let cityVideo;
let cityVideoTexture;
let scenicTexture;
let buildingFacades = {};
let weapon;
let muzzleLight;
let raycaster;
let started = false;
let paused = true;
let yaw = 0;
let pitch = 0;
let health = 100;
let kills = 0;
let streak = 0;
let wave = 1;
let ammo = 30;
let reserve = 90;
let reloading = false;
let fireCooldown = 0;
let botSpawnTimer = 0;
let lastShotAt = 0;
let firing = false;
let recoilPitch = 0;
let recoilYaw = 0;
let shotsFired = 0;
let shotsHit = 0;
let bestStreak = 0;
let matchStartedAt = 0;
let matchEnded = false;
let gameTime = 0;
let sensitivity = 1;
let masterVolume = 0.45;
let audioContext = null;

// --- CF/CS realism: movement state ---
let crouching = false;
let crouchLerp = 0; // 0 = standing, 1 = fully crouched
let verticalVelocity = 0;
let grounded = true;
let stamina = 100;
let sprinting = false;
let headBobPhase = 0;
let headBobAmount = 0;
let lastFootstep = 0;
const FOOTSTEP_INTERVAL_WALK = 0.42;
const FOOTSTEP_INTERVAL_SPRINT = 0.3;

// --- CF/CS realism: ADS (aim down sights) ---
let adsActive = false;
let adsLerp = 0; // 0 = hip, 1 = fully aimed
const ADS_FOV_ZOOM = 52;
const HIP_FOV = 74;

// --- CF/CS realism: recoil pattern (deterministic like CS) ---
let recoilIndex = 0;
const RECOIL_PATTERN_LENGTH = 32;
const recoilPattern = [];
// Generate a spray pattern: initial climb, then S-curve horizontal drift.
for (let i = 0; i < RECOIL_PATTERN_LENGTH; i++) {
  const t = i / RECOIL_PATTERN_LENGTH;
  const vertical = t < 0.25 ? t * 4 : t < 0.6 ? 1 + (t - 0.25) * 0.6 : 1.21 - (t - 0.6) * 0.3;
  const horizontal = Math.sin(t * Math.PI * 3.2) * (0.3 + t * 0.5);
  recoilPattern.push({ v: vertical, h: horizontal });
}

// --- CF/CS realism: weapon animation state ---
let weaponSwayX = 0;
let weaponSwayY = 0;
let weaponBobX = 0;
let weaponBobY = 0;
let reloadAnimPhase = 0; // 0=idle, 1=mag out, 2=mag in, 3=bolt
let reloadAnimTimer = 0;
let weaponKickZ = 0;
let lastMouseX = 0;
let lastMouseY = 0;

// --- CF/CS realism: shell casing pool ---
const shellPool = [];
let shellCursor = 0;
const SHELL_POOL_SIZE = 12;

// --- CF/CS realism: muzzle flash ---
let muzzleFlashMesh = null;
let muzzleFlashTimer = 0;

// --- CF/CS realism: bullet holes ---
const bulletHoles = [];
const MAX_BULLET_HOLES = 40;

// --- View mode & weapon switching ---
let viewMode = "fps"; // "fps" | "tps"
let currentWeaponType = "rifle"; // "rifle" | "knife" | "grenade"
let grenadeCount = 2;
let knifeSwingTimer = 0; // >0 while swinging
let throwAnimTimer = 0; // >0 while throwing grenade
let playerModel = null; // third-person body mesh
let playerModelWeapon = null; // weapon attached to third-person model
const activeGrenades = []; // thrown grenade projectiles
const TP_DISTANCE = 3.4; // third-person camera distance
const EYE_HEIGHT = 1.62; // eye offset above feet

const bots = [];
const botMeshes = [];
const obstacles = [];
const decals = [];
const keys = new Set();
// O(1) lookup from any bot mesh/sprite -> owning bot (replaces bots.find + children.includes).
const meshToBot = new Map();
// Object pools for transient shot effects (initialized in initPools after THREE loads).
const tracerPool = [];
const sparkPool = [];
let tracerCursor = 0;
let sparkCursor = 0;
// Pre-created radar dot element pool (updated in place each frame instead of recreate).
const radarDots = [];
// Cached HUD state for dirty-checking text/style updates.
const hudCache = {};
// Reusable temporary vectors so updateBots does not allocate every frame.
let tmpV1 = null;
let tmpV2 = null;
let tmpV3 = null;
let tmpV4 = null;
let tmpV5 = null;
// Reused up-vector for tracer orientation.
let UP_VECTOR = null;
// Cached noise buffer for the noise-based gunshot sound.
let shotNoiseBuffer = null;
const player = {
  position: null,
  velocity: null,
  radius: 0.58,
  height: 1.72,
};

const params = new URLSearchParams(window.location.search);

const MODES = {
  training: {
    name: "BOT 训练",
    code: "BOT TRAINING",
    target: "清理移动 BOT，熟悉压枪和换弹",
    description: "基础移动 BOT 训练，适合先熟悉移动、鼠标锁定和射击手感。",
    botBase: 4,
    botLimit: 10,
    botHealth: 90,
    botSpeed: 1.05,
    damage: 5,
    reserveScale: 1,
  },
  deathmatch: {
    name: "团队竞技",
    code: "TEAM DEATHMATCH",
    target: "目标 30 击破，保持连杀",
    description: "快节奏团队竞技模拟。BOT 会持续压近，测试中距离压枪和转火。",
    botBase: 7,
    botLimit: 14,
    botHealth: 110,
    botSpeed: 1.28,
    damage: 8,
    reserveScale: 1.15,
  },
  demolition: {
    name: "爆破模拟",
    code: "DEMOLITION",
    target: "守住目标点，阻止 BOT 推进",
    description: "围绕目标点推进的爆破节奏模拟。BOT 更密集，近距离压力更高。",
    botBase: 6,
    botLimit: 12,
    botHealth: 115,
    botSpeed: 1.36,
    damage: 9,
    reserveScale: 0.95,
  },
  survival: {
    name: "生存突围",
    code: "SURVIVAL",
    target: "低补给生存，尽量撑过更多波次",
    description: "低补给、高伤害的生存模式。弹药奖励更少，失误成本更高。",
    botBase: 6,
    botLimit: 16,
    botHealth: 120,
    botSpeed: 1.3,
    damage: 11,
    reserveScale: 0.65,
  },
  sniper: {
    name: "狙击训练",
    code: "SNIPER RANGE",
    target: "远距离单发命中，优先爆头",
    description: "远距离目标训练。BOT 会拉开距离，武器改为高伤低射速狙击枪。",
    botBase: 5,
    botLimit: 10,
    botHealth: 95,
    botSpeed: 0.95,
    damage: 7,
    reserveScale: 0.8,
  },
};

const MAPS = {
  desert: {
    name: "沙漠仓库",
    sky: 0x14100b,
    fog: 0x17130d,
    ground: 0x51412d,
    concrete: 0x4b4c46,
    accent: 0xc28b45,
    glow: 0xffb458,
    spawn: [0, player.height, 18],
  },
  warehouse: {
    name: "集装箱仓库",
    sky: 0x070b10,
    fog: 0x0a1118,
    ground: 0x2a3034,
    concrete: 0x343b40,
    accent: 0x2f5e78,
    glow: 0x18f5ff,
    spawn: [-12, player.height, 20],
  },
  night: {
    name: "夜间工厂",
    sky: 0x03050a,
    fog: 0x05070c,
    ground: 0x1d2023,
    concrete: 0x282a2d,
    accent: 0x4c3730,
    glow: 0xff4567,
    spawn: [14, player.height, 19],
  },
  range: {
    name: "远距靶场",
    sky: 0x0d1112,
    fog: 0x101414,
    ground: 0x3c3a32,
    concrete: 0x4a4a42,
    accent: 0x625238,
    glow: 0xffd166,
    spawn: [0, player.height, 26],
  },
  rainforest: {
    name: "雨林溪谷",
    sky: 0x0b1410,
    fog: 0x102018,
    ground: 0x2f3b28,
    concrete: 0x3d473c,
    accent: 0x31543a,
    glow: 0x66d17a,
    spawn: [-6, player.height, 24],
    nature: "forest",
  },
  alpine: {
    name: "雪山哨站",
    sky: 0x101923,
    fog: 0xb6c2c8,
    ground: 0x87939a,
    concrete: 0x566067,
    accent: 0xd7e2e8,
    glow: 0xcce9ff,
    spawn: [8, player.height, 26],
    nature: "snow",
  },
  coast: {
    name: "海岸断崖",
    sky: 0x0c1a21,
    fog: 0x17313a,
    ground: 0x4d4839,
    concrete: 0x4f5652,
    accent: 0x2b6f79,
    glow: 0x54d6d6,
    spawn: [-10, player.height, 22],
    nature: "coast",
  },
  wetlands: {
    name: "湿地村落",
    sky: 0x0b110e,
    fog: 0x17221a,
    ground: 0x39422f,
    concrete: 0x4b4538,
    accent: 0x5b6b45,
    glow: 0xb8d66b,
    spawn: [10, player.height, 20],
    nature: "wetlands",
  },
  highland: {
    name: "山地废村",
    sky: 0x111712,
    fog: 0x1f2a20,
    ground: 0x3c3f2f,
    concrete: 0x5a5143,
    accent: 0x78634a,
    glow: 0xd8b66a,
    spawn: [-12, player.height, 24],
    nature: "village",
  },
  harbor: {
    name: "雨夜港区",
    sky: 0x070c10,
    fog: 0x0d1d26,
    ground: 0x252d30,
    concrete: 0x384148,
    accent: 0x2f6070,
    glow: 0x5ce0ff,
    spawn: [14, player.height, 22],
    nature: "harbor",
  },
  quarry: {
    name: "山谷采石场",
    sky: 0x14150f,
    fog: 0x24251a,
    ground: 0x565144,
    concrete: 0x6a6558,
    accent: 0x9a7d52,
    glow: 0xffc36a,
    spawn: [-8, player.height, 26],
    nature: "quarry",
  },
  research: {
    name: "林中研究站",
    sky: 0x07110f,
    fog: 0x10241e,
    ground: 0x27362d,
    concrete: 0x46514a,
    accent: 0x8f9b8a,
    glow: 0x9df3c4,
    spawn: [8, player.height, 23],
    nature: "research",
  },
};

const WEAPONS = {
  carbine: {
    name: "VX-9 CARBINE",
    mag: 30,
    reserve: 90,
    fireRate: 0.115,
    damage: 38,
    critical: 72,
    recoil: 0.012,
    reloadMs: 1050,
    tracer: 0xffd166,
  },
  smg: {
    name: "K-VECTOR SMG",
    mag: 38,
    reserve: 152,
    fireRate: 0.075,
    damage: 27,
    critical: 52,
    recoil: 0.017,
    reloadMs: 920,
    tracer: 0x18f5ff,
  },
  sniper: {
    name: "M-700 MARKSMAN",
    mag: 5,
    reserve: 30,
    fireRate: 0.72,
    damage: 125,
    critical: 220,
    recoil: 0.05,
    reloadMs: 1450,
    tracer: 0xfff0a6,
  },
};

// Melee & throwable stats (separate from gun WEAPONS).
const KNIFE = {
  name: "战术军刀",
  range: 2.4,
  damage: 55,
  critical: 110,
  swingInterval: 0.45,
};
const GRENADE = {
  name: "M67 破片手雷",
  fuse: 1.6,
  throwForce: 13,
  blastRadius: 5.2,
  damage: 120,
};

const selectedMode = MODES[params.get("mode")] || MODES.training;
const selectedMap = MAPS[params.get("map")] || MAPS.desert;
const selectedWeapon = WEAPONS[params.get("weapon")] || WEAPONS.carbine;

async function loadThree() {
  for (const url of THREE_URLS) {
    try {
      return await import(url);
    } catch (error) {
      console.warn("Three.js CDN failed:", url, error);
    }
  }
  throw new Error("3D 引擎加载失败，请检查网络后刷新。");
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    ui.toast.classList.remove("is-visible");
  }, 2400);
}

function ensureAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    shotNoiseBuffer = null;
  }
  if (audioContext.state === "suspended") audioContext.resume();
}

function playTone(frequency, duration, type = "square", volume = 0.22) {
  if (!audioContext || masterVolume <= 0) return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(volume * masterVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function getShotNoiseBuffer() {
  if (shotNoiseBuffer) return shotNoiseBuffer;
  const duration = 0.3;
  const length = Math.floor(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const decay = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }
  shotNoiseBuffer = buffer;
  return buffer;
}

function playShotSound() {
  if (!audioContext || masterVolume <= 0) return;
  const now = audioContext.currentTime;
  const isSniper = selectedWeapon === WEAPONS.sniper;
  const isSmg = selectedWeapon === WEAPONS.smg;
  const bodyDuration = isSniper ? 0.22 : isSmg ? 0.09 : 0.13;
  const bodyVolume = (isSniper ? 0.5 : isSmg ? 0.3 : 0.36) * masterVolume;
  const noiseBuffer = getShotNoiseBuffer();

  // Lowpassed noise body (the "thump").
  const bodySrc = audioContext.createBufferSource();
  bodySrc.buffer = noiseBuffer;
  const bodyFilter = audioContext.createBiquadFilter();
  bodyFilter.type = "lowpass";
  bodyFilter.frequency.setValueAtTime(isSniper ? 900 : isSmg ? 2200 : 1500, now);
  bodyFilter.frequency.exponentialRampToValueAtTime(isSniper ? 220 : 480, now + bodyDuration);
  const bodyGain = audioContext.createGain();
  bodyGain.gain.setValueAtTime(bodyVolume, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + bodyDuration);
  bodySrc.connect(bodyFilter).connect(bodyGain).connect(audioContext.destination);
  bodySrc.start(now);
  bodySrc.stop(now + bodyDuration);

  // Highpassed noise crack (the "snap").
  const crackSrc = audioContext.createBufferSource();
  crackSrc.buffer = noiseBuffer;
  const crackFilter = audioContext.createBiquadFilter();
  crackFilter.type = "highpass";
  crackFilter.frequency.setValueAtTime(isSniper ? 1800 : 2600, now);
  const crackGain = audioContext.createGain();
  const crackDuration = isSniper ? 0.08 : 0.05;
  crackGain.gain.setValueAtTime(0.18 * masterVolume, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDuration);
  crackSrc.connect(crackFilter).connect(crackGain).connect(audioContext.destination);
  crackSrc.start(now);
  crackSrc.stop(now + crackDuration);

  // Sub oscillator tail for low-end punch.
  const sub = audioContext.createOscillator();
  const subGain = audioContext.createGain();
  const subBase = isSniper ? 70 : isSmg ? 150 : 110;
  sub.type = "sine";
  sub.frequency.setValueAtTime(subBase, now);
  sub.frequency.exponentialRampToValueAtTime(subBase * 0.5, now + bodyDuration);
  subGain.gain.setValueAtTime(0.22 * masterVolume, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + bodyDuration);
  sub.connect(subGain).connect(audioContext.destination);
  sub.start(now);
  sub.stop(now + bodyDuration);
}

function playHitSound(critical) {
  playTone(critical ? 980 : 620, 0.08, "sine", critical ? 0.16 : 0.1);
}

function playReloadSound() {
  playTone(240, 0.08, "triangle", 0.12);
  window.setTimeout(() => playTone(420, 0.08, "triangle", 0.1), 210);
}

function playFootstep() {
  if (!audioContext || masterVolume <= 0) return;
  const now = audioContext.currentTime;
  const noiseBuffer = getShotNoiseBuffer();
  // Low thump (boot on ground).
  const src = audioContext.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(280 + Math.random() * 120, now);
  filter.frequency.exponentialRampToValueAtTime(80, now + 0.08);
  const gain = audioContext.createGain();
  const vol = (sprinting ? 0.14 : 0.08) * masterVolume;
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  src.connect(filter).connect(gain).connect(audioContext.destination);
  src.start(now);
  src.stop(now + 0.1);
  // Subtle high scrape.
  const src2 = audioContext.createBufferSource();
  src2.buffer = noiseBuffer;
  const hpf = audioContext.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.setValueAtTime(2200 + Math.random() * 800, now);
  const gain2 = audioContext.createGain();
  gain2.gain.setValueAtTime(vol * 0.3, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  src2.connect(hpf).connect(gain2).connect(audioContext.destination);
  src2.start(now);
  src2.stop(now + 0.05);
}

function pushKillfeed(message) {
  if (!ui.killfeed) return;
  const item = document.createElement("span");
  item.innerHTML = message;
  ui.killfeed.prepend(item);
  while (ui.killfeed.children.length > 4) ui.killfeed.lastElementChild.remove();
  window.setTimeout(() => item.remove(), 4200);
}

function makeMaterial(color, roughness = 0.55, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

function loadProjectTextures() {
  textureLoader = new THREE.TextureLoader();
  const colorSpace = THREE.SRGBColorSpace || THREE.LinearSRGBColorSpace;
  const loadTexture = (src) => textureLoader.load(src, (texture) => {
    texture.needsUpdate = true;
  });
  scenicTexture = textureLoader.load("../../assets/strike-arena-hero.png");
  enemyTextures = [
    "../../assets/strike-enemy-operator-game.png",
    "../../assets/strike-enemy-scout-game.png",
    "../../assets/strike-enemy-heavy-game.png",
  ].map(loadTexture);
  enemyFrames = {
    idle: enemyTextures,
    walk: [
      loadTexture("../../assets/strike-enemy-walk-a-game.png"),
      loadTexture("../../assets/strike-enemy-walk-b-game.png"),
    ],
    aim: [loadTexture("../../assets/strike-enemy-action-game.png")],
    fire: [loadTexture("../../assets/strike-enemy-fire-game.png")],
    hit: [loadTexture("../../assets/strike-enemy-hit-game.png")],
    down: [loadTexture("../../assets/strike-enemy-down-game.png")],
  };
  enemyActionTexture = enemyFrames.aim[0];
  // Photorealistic building facade textures (generated assets).
  buildingFacades = {
    concrete: textureLoader.load("../../assets/building-concrete.jpg"),
    brick: textureLoader.load("../../assets/building-brick.jpg"),
    industrial: textureLoader.load("../../assets/building-industrial.jpg"),
    night: textureLoader.load("../../assets/building-night.jpg"),
  };
  if (selectedMap.nature) {
    sceneVideo = document.createElement("video");
    sceneVideo.src = "../../assets/strike-remotion-scene.mp4";
    sceneVideo.muted = true;
    sceneVideo.loop = true;
    sceneVideo.playsInline = true;
    sceneVideo.autoplay = true;
    sceneVideo.preload = "auto";
    sceneVideo.play().catch(() => {});
    sceneVideoTexture = new THREE.VideoTexture(sceneVideo);
  } else {
    cityVideo = document.createElement("video");
    cityVideo.src = "../../assets/strike-city-scene.mp4";
    cityVideo.muted = true;
    cityVideo.loop = true;
    cityVideo.playsInline = true;
    cityVideo.autoplay = true;
    cityVideo.preload = "auto";
    cityVideo.play().catch(() => {});
    cityVideoTexture = new THREE.VideoTexture(cityVideo);
  }
  enemyTexture = enemyTextures[0];
  [scenicTexture, sceneVideoTexture, cityVideoTexture, ...Object.values(enemyFrames).flat(), ...Object.values(buildingFacades)].filter(Boolean).forEach((texture) => {
    if (colorSpace) texture.colorSpace = colorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });
}

// Pick the facade texture that matches the current map's mood.
function getFacadeTexture() {
  const key = selectedMap.name;
  if (key === "夜间工厂" || key === "雨夜港区") return buildingFacades.night;
  if (key === "集装箱仓库" || key === "山谷采石场") return buildingFacades.industrial;
  if (key === "沙漠仓库" || key === "远距靶场") return buildingFacades.concrete;
  return buildingFacades.brick;
}

function isNightMap() {
  return selectedMap.name === "夜间工厂" || selectedMap.name === "雨夜港区";
}

function createGroundMaterial() {
  const S = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  const baseColor = `#${selectedMap.ground.toString(16).padStart(6, "0")}`;
  const baseR = parseInt(baseColor.slice(1, 3), 16);
  const baseG = parseInt(baseColor.slice(3, 5), 16);
  const baseB = parseInt(baseColor.slice(5, 7), 16);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, S, S);

  // Large terrain patches (color variation).
  for (let i = 0; i < 70; i++) {
    const shade = Math.random() > 0.5 ? 22 : -22;
    const r = baseR + shade + Math.floor(Math.random() * 18 - 9);
    const g = baseG + shade + Math.floor(Math.random() * 18 - 9);
    const b = baseB + shade + Math.floor(Math.random() * 18 - 9);
    ctx.fillStyle = `rgba(${Math.max(0, r)}, ${Math.max(0, g)}, ${Math.max(0, b)}, ${0.12 + Math.random() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * S, Math.random() * S, 40 + Math.random() * 120, 30 + Math.random() * 80, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vegetation / moss speckles (subtle green tint, stronger on nature maps).
  const vegAlpha = selectedMap.nature ? 0.16 : 0.07;
  for (let i = 0; i < 500; i++) {
    const g = 60 + Math.floor(Math.random() * 50);
    ctx.fillStyle = `rgba(${40 + Math.floor(Math.random() * 30)}, ${g}, ${30 + Math.floor(Math.random() * 25)}, ${vegAlpha * Math.random()})`;
    const size = 2 + Math.random() * 7;
    ctx.beginPath();
    ctx.ellipse(Math.random() * S, Math.random() * S, size, size * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Oil / grime stains (dark blotches).
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(10, 10, 12, ${0.05 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * S, Math.random() * S, 15 + Math.random() * 45, 10 + Math.random() * 30, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tire tracks (long dark streaks).
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(15, 15, 17, ${0.05 + Math.random() * 0.08})`;
    ctx.lineWidth = 6 + Math.random() * 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    let x = Math.random() * S;
    let y = Math.random() * S;
    ctx.moveTo(x, y);
    const angle = Math.random() * Math.PI * 2;
    for (let j = 0; j < 6; j++) {
      x += Math.cos(angle + (Math.random() - 0.5) * 0.6) * 120;
      y += Math.sin(angle + (Math.random() - 0.5) * 0.6) * 120;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Medium grain / pebbles with a slight highlight.
  for (let i = 0; i < 5000; i++) {
    const shade = 28 + Math.floor(Math.random() * 70);
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.05 + Math.random() * 0.12})`;
    const size = 1 + Math.random() * 4;
    ctx.fillRect(Math.random() * S, Math.random() * S, size, size);
  }

  // Fine noise grain.
  for (let i = 0; i < 12000; i++) {
    const v = Math.random() * 255;
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, ${0.02 + Math.random() * 0.045})`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 1, 1);
  }

  // Cracks and lines (more pronounced).
  for (let i = 0; i < 50; i++) {
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.08 + Math.random() * 0.16})`;
    ctx.lineWidth = 0.5 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * S;
    let y = Math.random() * S;
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (Math.random() - 0.5) * 140;
      y += (Math.random() - 0.5) * 140;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Subtle highlights (worn spots).
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.02 + Math.random() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * S, Math.random() * S, 20 + Math.random() * 55, 14 + Math.random() * 36, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // Bump map for surface relief.
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext("2d");
  bCtx.fillStyle = "#808080";
  bCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) {
    const v = 96 + Math.floor(Math.random() * 64);
    bCtx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    bCtx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.wrapS = THREE.RepeatWrapping;
  bumpTexture.wrapT = THREE.RepeatWrapping;
  bumpTexture.repeat.set(14, 14);

  return new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: bumpTexture,
    bumpScale: 0.35,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.03,
  });
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(selectedMap.sky);
  scene.fog = new THREE.FogExp2(selectedMap.fog, selectedMode === MODES.sniper ? 0.011 : 0.014);

  camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 600);
  camera.rotation.order = "YXZ";
  camera.position.set(...selectedMap.spawn);

  renderer = new THREE.WebGLRenderer({
    canvas: ui.canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = selectedMap.nature ? 1.16 : 1.04;
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  loadProjectTextures();

  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();
  player.position = camera.position;
  player.velocity = new THREE.Vector3();
  tmpV1 = new THREE.Vector3();
  tmpV2 = new THREE.Vector3();
  tmpV3 = new THREE.Vector3();
  tmpV4 = new THREE.Vector3();
  tmpV5 = new THREE.Vector3();
  UP_VECTOR = new THREE.Vector3(0, 1, 0);
  grassDummy = new THREE.Object3D();
  ammo = selectedWeapon.mag;
  reserve = Math.round(selectedWeapon.reserve * selectedMode.reserveScale);

  const hemi = new THREE.HemisphereLight(
    selectedMap.nature ? 0xb8d4e8 : 0xd9e6ff,
    selectedMap.ground,
    selectedMap.nature ? 0.85 : 1.05,
  );
  scene.add(hemi);

  // Ambient fill to prevent pure black shadows.
  const ambient = new THREE.AmbientLight(0x1a2030, 0.35);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(-12, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -62;
  sun.shadow.camera.right = 62;
  sun.shadow.camera.top = 62;
  sun.shadow.camera.bottom = -62;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // Secondary bounce light (cool fill from opposite side).
  const bounce = new THREE.DirectionalLight(0x8ab4d4, 0.5);
  bounce.position.set(14, 8, -12);
  scene.add(bounce);

  const cyan = new THREE.PointLight(selectedMap.glow, 58, 30);
  cyan.position.set(8, 5, -8);
  scene.add(cyan);

  // Gradient sky dome.
  const skyGeo = new THREE.SphereGeometry(280, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(selectedMap.nature ? 0x1a3050 : 0x0a1428) },
      bottomColor: { value: new THREE.Color(selectedMap.sky) },
      offset: { value: 20 },
      exponent: { value: 0.5 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  applyScenarioText();
  createArena();
  initPools();
  initRadarDots();
  initShellPool();
  createViewModel();
  createPlayerModel();
  spawnWave();
  updateHud();
  updateInventoryHud();
}

function applyScenarioText() {
  if (ui.bootMode) ui.bootMode.textContent = selectedMode.code;
  if (ui.bootTitle) ui.bootTitle.textContent = selectedMode.name;
  if (ui.bootDesc) ui.bootDesc.textContent = `${selectedMode.description} 地图：${selectedMap.name}，武器：${selectedWeapon.name}。`;
  if (ui.modeChip) ui.modeChip.textContent = `${selectedMode.name} / ${selectedMap.name}`;
  if (ui.objectiveText) ui.objectiveText.textContent = selectedMode.target;
  if (ui.weaponName) ui.weaponName.textContent = selectedWeapon.name;
  if (ui.roundLabel) ui.roundLabel.innerHTML = selectedMode === MODES.deathmatch ? '回合 <strong id="wave">1</strong>' : '波次 <strong id="wave">1</strong>';
  ui.wave = document.querySelector("#wave");
  // The #wave element was just recreated; clear cached HUD values so updateHud
  // repopulates the fresh elements instead of skipping them as "unchanged".
  Object.keys(hudCache).forEach((key) => delete hudCache[key]);
}

function createArena() {
  createCinematicBackdrop();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(130, 130, 1, 1),
    createGroundMaterial(),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(130, 65, selectedMap.glow, 0x1d2227);
  grid.material.opacity = selectedMode === MODES.training ? 0.16 : 0.08;
  grid.material.transparent = true;
  scene.add(grid);

  const wallMat = makeMaterial(selectedMap.concrete, 0.82, 0.05);
  const accentMat = makeMaterial(selectedMap.accent, 0.64, 0.18);
  if (selectedMap.nature) {
    wallMat.transparent = true;
    wallMat.opacity = 0.38;
    wallMat.depthWrite = false;
  }

  const wallHeight = selectedMap.nature ? 0.72 : 5;
  const wallData = [
    [0, wallHeight / 2, -65, 130, wallHeight, 1],
    [0, wallHeight / 2, 65, 130, wallHeight, 1],
    [-65, wallHeight / 2, 0, 1, wallHeight, 130],
    [65, wallHeight / 2, 0, 1, wallHeight, 130],
  ];
  wallData.forEach((data) => addBox(data, wallMat, false));

  // Large enterable single-storey buildings (walk inside, room by room).
  const enterable = [
    [-22, -16, 16, 12, 4.2],
    [20, -14, 14, 11, 4],
    [-20, 8, 13, 10, 3.8],
    [22, 12, 12, 10, 4],
  ];
  enterable.forEach(([x, z, w, d, h], index) => {
    createEnterableBuilding(x, z, w, d, h, index);
  });

  // Tall solid backdrop buildings ringing the arena (realistic city scale).
  const skyline = [
    [0, -45, 26, 12, 20],
    [-45, -10, 12, 24, 24],
    [45, 0, 12, 22, 18],
    [0, 48, 28, 10, 22],
    [-42, 40, 14, 14, 16],
    [42, -40, 14, 14, 19],
    [-48, 25, 10, 12, 13],
    [48, 30, 10, 16, 17],
  ];
  skyline.forEach(([x, z, w, d, h], index) => {
    createBuilding(x, z, w, d, h, index + 100);
  });

  for (let i = 0; i < 20; i += 1) {
    const h = 2 + Math.random() * 7;
    const x = -55 + Math.random() * 110;
    const z = -55 + Math.random() * 110;
    if (Math.abs(x) < 8 && z > 8) continue;
    // Keep clear of the enterable buildings' footprints.
    const inside = enterable.some(([bx, bz, bw, bd]) => Math.abs(x - bx) < bw / 2 + 1 && Math.abs(z - bz) < bd / 2 + 1);
    if (inside) continue;
    addBox([x, h / 2, z, 1.1, h, 1.1], makeMaterial(0x1b2025, 0.68, 0.16), false);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(17, 0.08, 8, 96),
    new THREE.MeshBasicMaterial({ color: selectedMap.glow }),
  );
  ring.position.set(0, 0.08, 0);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  createArenaProps();
}

function createCinematicBackdrop() {
  if (!selectedMap.nature) {
    // Urban maps: distant animated city skyline (Remotion-rendered video).
    if (!cityVideoTexture) return;
    const cityBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(170, 82),
      new THREE.MeshBasicMaterial({
        map: cityVideoTexture,
        color: 0xffffff,
        transparent: true,
        opacity: isNightMap() ? 0.96 : 0.82,
        depthWrite: false,
        fog: false,
      }),
    );
    cityBackdrop.position.set(0, 26, -64);
    cityBackdrop.renderOrder = -20;
    scene.add(cityBackdrop);

    const cityVeil = new THREE.Mesh(
      new THREE.PlaneGeometry(170, 82),
      new THREE.MeshBasicMaterial({
        color: isNightMap() ? 0x050810 : 0x1a2030,
        transparent: true,
        opacity: isNightMap() ? 0.12 : 0.2,
        depthWrite: false,
      }),
    );
    cityVeil.position.set(0, 26, -63.8);
    cityVeil.renderOrder = -19;
    scene.add(cityVeil);
    return;
  }
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 82),
    new THREE.MeshBasicMaterial({
      map: sceneVideoTexture || scenicTexture,
      color: 0xffffff,
      transparent: true,
      opacity: selectedMap.nature === "forest" ? 0.92 : 0.76,
      depthWrite: false,
      fog: false,
    }),
  );
  backdrop.position.set(0, 26, -64);
  backdrop.renderOrder = -20;
  scene.add(backdrop);

  const duskVeil = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 82),
    new THREE.MeshBasicMaterial({
      color: selectedMap.nature === "snow" ? 0xcad7dc : 0x07110d,
      transparent: true,
      opacity: selectedMap.nature === "forest" ? 0.1 : 0.16,
      depthWrite: false,
    }),
  );
  duskVeil.position.set(0, 26, -63.8);
  duskVeil.renderOrder = -19;
  scene.add(duskVeil);

  const ridgeMat = new THREE.MeshBasicMaterial({
    color: selectedMap.nature === "snow" ? 0x233444 : 0x07140e,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  for (let i = 0; i < 3; i += 1) {
    const ridge = new THREE.Mesh(new THREE.PlaneGeometry(90 - i * 14, 12 + i * 2), ridgeMat.clone());
    ridge.position.set((i - 1) * 24, 6 + i * 1.2, -63.4 + i * 0.2);
    ridge.rotation.z = (i - 1) * 0.05;
    ridge.renderOrder = -18 + i;
    scene.add(ridge);
  }
}

function addBox([x, y, z, sx, sy, sz], material, collidable) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (collidable) {
    obstacles.push({
      minX: x - sx / 2 - player.radius,
      maxX: x + sx / 2 + player.radius,
      minZ: z - sz / 2 - player.radius,
      maxZ: z + sz / 2 + player.radius,
    });
  }
  return mesh;
}

function addContainerRibs(mesh, [x, y, z, sx, sy, sz]) {
  const ribMat = makeMaterial(0x161b20, 0.72, 0.12);
  const longSide = sx >= sz;
  const count = Math.max(3, Math.floor((longSide ? sx : sz) / 1.4));
  for (let i = 0; i < count; i += 1) {
    const offset = -((count - 1) / 2) + i;
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(longSide ? 0.05 : sx + 0.05, sy + 0.08, longSide ? sz + 0.05 : 0.05),
      ribMat,
    );
    rib.position.set(
      x + (longSide ? offset * 1.35 : 0),
      y,
      z + (longSide ? 0 : offset * 1.35),
    );
    rib.castShadow = true;
    scene.add(rib);
  }
}

// Deterministic PRNG so building details are stable per building.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One facade texture tile represents roughly this many world units.
const FACADE_TILE = 8;

// Shared PBR facade material with per-face UV scaling and night-time window glow.
function facadeMaterial(sideWidth, h) {
  const facade = getFacadeTexture();
  const night = isNightMap();
  const tex = facade.clone();
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(0.5, sideWidth / FACADE_TILE), Math.max(0.5, h / FACADE_TILE));
  tex.needsUpdate = true;
  if (facade.image && facade.image.complete) {
    tex.needsUpdate = true;
  } else if (facade.image && facade.image.addEventListener) {
    facade.image.addEventListener("load", () => {
      tex.needsUpdate = true;
    }, { once: true });
  }
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.88,
    metalness: 0.05,
  });
  if (night) {
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveMap = tex;
    mat.emissiveIntensity = 0.5;
  }
  return mat;
}

function createBuilding(x, z, w, d, h, index) {
  const matFrontBack = facadeMaterial(w, h); // ±z faces span width w
  const matLeftRight = facadeMaterial(d, h); // ±x faces span width d
  const roofMat = makeMaterial(0x23262a, 0.92, 0.04);
  const bottomMat = makeMaterial(0x14161a, 0.95, 0.02);

  // BoxGeometry material order: [+x, -x, +y, -y, +z, -z].
  const materials = [matLeftRight, matLeftRight, roofMat, bottomMat, matFrontBack, matFrontBack];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  obstacles.push({
    minX: x - w / 2 - player.radius,
    maxX: x + w / 2 + player.radius,
    minZ: z - d / 2 - player.radius,
    maxZ: z + d / 2 + player.radius,
  });

  const rng = mulberry32(index * 7919 + 13);
  const concreteMat = makeMaterial(selectedMap.concrete, 0.85, 0.05);
  const darkMat = makeMaterial(0x1a1d21, 0.8, 0.1);

  // Base plinth (slightly wider, dark).
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3), darkMat);
  plinth.position.set(x, 0.25, z);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  scene.add(plinth);

  // Roof parapet (frame around the top edge).
  const parapetH = 0.35;
  const t = 0.12;
  [
    [x, h + parapetH / 2, z - d / 2 + t / 2, w + t * 2, parapetH, t],
    [x, h + parapetH / 2, z + d / 2 - t / 2, w + t * 2, parapetH, t],
    [x - w / 2 + t / 2, h + parapetH / 2, z, t, parapetH, d],
    [x + w / 2 - t / 2, h + parapetH / 2, z, t, parapetH, d],
  ].forEach((p) => addBox(p, concreteMat, false));

  // Rooftop clutter (AC units / water tanks).
  const roofItems = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < roofItems; i += 1) {
    const rw = 0.8 + rng() * 1.2;
    const rh = 0.5 + rng() * 0.7;
    const rd = 0.8 + rng() * 1.2;
    const rx = x + (rng() - 0.5) * Math.max(0.5, w - rw - 0.6);
    const rz = z + (rng() - 0.5) * Math.max(0.5, d - rd - 0.6);
    const unit = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), rng() > 0.5 ? concreteMat : darkMat);
    unit.position.set(rx, h + rh / 2, rz);
    unit.castShadow = true;
    scene.add(unit);
  }

  // Antenna on tall buildings.
  if (h > 8 && rng() > 0.4) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 2.2, 8), darkMat);
    antenna.position.set(x + (rng() - 0.5) * w * 0.5, h + 1.1, z + (rng() - 0.5) * d * 0.5);
    antenna.castShadow = true;
    scene.add(antenna);
  }

  // Wall-mounted AC units on the front/back faces.
  const rows = Math.floor(h / 2.5);
  for (let i = 0; i < rows; i += 1) {
    if (rng() > 0.6) continue;
    const side = rng() > 0.5 ? 1 : -1;
    const ay = 1.6 + i * 2.4 + rng() * 0.5;
    if (ay > h - 0.9) continue;
    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.32), concreteMat);
    ac.position.set(x + (rng() - 0.5) * (w - 1.2), ay, z + side * (d / 2 + 0.18));
    ac.castShadow = true;
    scene.add(ac);
  }

  // Vertical drain pipe on a corner.
  if (rng() > 0.35) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 8), darkMat);
    pipe.position.set(
      x + (rng() > 0.5 ? 1 : -1) * (w / 2 + 0.06),
      h / 2,
      z + (rng() > 0.5 ? 1 : -1) * (d / 2 - 0.3),
    );
    pipe.castShadow = true;
    scene.add(pipe);
  }
}

// Build a straight wall with a door gap. The solid parts are collidable; the
// header above the door is visual-only so the 2D collision lets you walk through.
function wallWithDoor(cx, cz, length, thick, h, alongX, doorOffset, doorW, doorH, wallMat, collidable = true) {
  const half = length / 2;
  const doorStart = doorOffset - doorW / 2;
  const doorEnd = doorOffset + doorW / 2;
  const segs = [];
  if (doorStart > -half + 0.05) segs.push({ from: -half, to: doorStart });
  if (doorEnd < half - 0.05) segs.push({ from: doorEnd, to: half });
  segs.forEach((s) => {
    const segLen = s.to - s.from;
    const segCenter = (s.from + s.to) / 2;
    const sx = alongX ? segLen : thick;
    const sz = alongX ? thick : segLen;
    const px = alongX ? cx + segCenter : cx;
    const pz = alongX ? cz : cz + segCenter;
    addBox([px, h / 2, pz, sx, h, sz], wallMat, collidable);
  });
  const headerH = h - doorH;
  if (headerH > 0.05) {
    const sx = alongX ? doorW : thick;
    const sz = alongX ? thick : doorW;
    const px = alongX ? cx + doorOffset : cx;
    const pz = alongX ? cz : cz + doorOffset;
    addBox([px, doorH + headerH / 2, pz, sx, headerH, sz], wallMat, false);
  }
}

// A large single-storey building you can walk into, with interior rooms.
function createEnterableBuilding(x, z, w, d, h, index) {
  const rng = mulberry32(index * 104729 + 7);
  const wallT = 0.3;
  const doorW = 1.5;
  const doorH = 2.3;

  const extMat = facadeMaterial(Math.max(w, d), h);
  const intMat = makeMaterial(0x8a857c, 0.9, 0.02); // interior plaster
  const floorMat = makeMaterial(0x5c5850, 0.85, 0.04);

  // Interior floor slab.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w - wallT, 0.06, d - wallT), floorMat);
  floor.position.set(x, 0.03, z);
  floor.receiveShadow = true;
  scene.add(floor);

  // Perimeter walls with a front and back door.
  const frontDoorX = (rng() - 0.5) * w * 0.4;
  const backDoorX = (rng() - 0.5) * w * 0.4;
  wallWithDoor(x, z + d / 2 - wallT / 2, w, wallT, h, true, frontDoorX, doorW, doorH, extMat);
  wallWithDoor(x, z - d / 2 + wallT / 2, w, wallT, h, true, backDoorX, doorW, doorH, extMat);
  wallWithDoor(x - w / 2 + wallT / 2, z, d, wallT, h, false, 0, 0, doorH, extMat); // solid (doorW 0)
  wallWithDoor(x + w / 2 - wallT / 2, z, d, wallT, h, false, 0, 0, doorH, extMat);

  // Interior partitions to form rooms (each with its own doorway).
  if (d > 9) {
    // Partition along X (splits front/back rooms), doorway offset to one side.
    const partZ = z + (rng() - 0.5) * d * 0.3;
    const partDoorX = x + (rng() > 0.5 ? 1 : -1) * w * 0.28;
    wallWithDoor(x, partZ, w - wallT * 2, wallT, h, true, partDoorX - x, doorW, doorH, intMat);
  }
  if (w > 11) {
    // Partition along Z (splits left/right), doorway offset.
    const partX = x + (rng() - 0.5) * w * 0.3;
    const partDoorZ = z + (rng() > 0.5 ? 1 : -1) * d * 0.25;
    wallWithDoor(partX, z, d - wallT * 2, wallT, h, false, partDoorZ - z, doorW, doorH, intMat);
  }

  // Roof slab (visual only — you can't collide with it in 2D collision).
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.28, d + 0.4), makeMaterial(0x2b2e32, 0.9, 0.05));
  roof.position.set(x, h + 0.14, z);
  roof.castShadow = true;
  roof.receiveShadow = true;
  scene.add(roof);

  // Interior ceiling lights (emissive fixtures + a warm point light).
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xfff2d8, emissive: 0xffe9c0, emissiveIntensity: 1.4, roughness: 0.4,
  });
  const lightCount = w * d > 160 ? 2 : 1;
  for (let i = 0; i < lightCount; i++) {
    const lx = x + (lightCount === 1 ? 0 : (i === 0 ? -1 : 1) * w * 0.22);
    const lz = z;
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.4), fixtureMat);
    fixture.position.set(lx, h - 0.05, lz);
    scene.add(fixture);
    const bulb = new THREE.PointLight(0xffe2b0, 26, 14);
    bulb.position.set(lx, h - 0.4, lz);
    scene.add(bulb);
  }

  // A few interior props (crates / shelves) for realism, kept clear of doorways.
  const crateMat = makeMaterial(0x6a553d, 0.82, 0.03);
  const propCount = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < propCount; i++) {
    const cw = 0.6 + rng() * 0.7;
    const ch = 0.5 + rng() * 0.9;
    const cd = 0.6 + rng() * 0.7;
    const px = x + (rng() - 0.5) * (w - cw - 1.6);
    const pz = z + (rng() - 0.5) * (d - cd - 1.6);
    addBox([px, ch / 2, pz, cw, ch, cd], crateMat, true);
  }
}

function createArenaProps() {
  const barrelMat = makeMaterial(0x6d2e24, 0.58, 0.32);
  const tireMat = makeMaterial(0x090a0b, 0.78, 0.12);
  const crateMat = makeMaterial(0x6a553d, 0.82, 0.03);
  const propSpots = [
    [-28, -4],
    [-10, 18],
    [13, 4],
    [25, -12],
    [31, 22],
    [-25, 27],
  ];
  propSpots.forEach(([x, z], index) => {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.2, 20), barrelMat);
    barrel.position.set(x, 0.6, z);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    scene.add(barrel);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.16, 8, 24), tireMat);
    tire.position.set(x + 1.05, 0.36, z + 0.2);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    scene.add(tire);
    if (index % 2 === 0) {
      addBox([x - 1.4, 0.55, z + 1.1, 1.5, 1.1, 1.2], crateMat, true);
    }
  });

  const objective = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 0.16, 36),
    new THREE.MeshBasicMaterial({ color: selectedMap.glow, transparent: true, opacity: 0.45 }),
  );
  objective.position.set(0, 0.1, 0);
  scene.add(objective);
  createMapSignature();
  createNatureLayer();
}

function createMapSignature() {
  if (!selectedMap.nature) return;
  const hutMat = makeMaterial(selectedMap.accent, 0.88, 0.03);
  const darkMat = makeMaterial(0x171a18, 0.72, 0.16);
  const stoneMat = makeMaterial(selectedMap.concrete, 0.94, 0.02);

  if (selectedMap.nature === "village") {
    [[-18, -8], [-8, 16], [17, -15], [24, 12]].forEach(([x, z], index) => {
      addBox([x, 1.1, z, 5.4, 2.2, 3.2], hutMat, true);
      const roof = addBox([x, 2.45, z, 6.1, 0.34, 3.9], darkMat, false);
      roof.rotation.z = index % 2 ? 0.06 : -0.06;
    });
    addBox([4, 0.55, -22, 14, 1.1, 1.2], stoneMat, true);
  }

  if (selectedMap.nature === "harbor") {
    createWaterPatch(30, 2, 21, 86);
    [[-20, -16], [-12, 12], [6, -6], [24, -20]].forEach(([x, z], index) => {
      const container = addBox([x, 1.35, z, 6.8, 2.7, 2.5], index % 2 ? darkMat : hutMat, true);
      addContainerRibs(container, [x, 1.35, z, 6.8, 2.7, 2.5]);
    });
    addBox([18, 0.35, 0, 2.2, 0.7, 86], stoneMat, true);
  }

  if (selectedMap.nature === "quarry") {
    [[-24, -18, 8, 2.1, 5], [-8, 4, 12, 2.8, 4], [18, -10, 10, 2.4, 6], [24, 18, 7, 1.9, 5]].forEach(
      ([x, z, sx, sy, sz]) => addBox([x, sy / 2, z, sx, sy, sz], stoneMat, true),
    );
    createWaterPatch(-21, 17, 12, 18);
  }

  if (selectedMap.nature === "research") {
    [[-18, -12], [0, -18], [18, -10], [-10, 15], [14, 17]].forEach(([x, z]) => {
      addBox([x, 1.45, z, 7.2, 2.9, 3.4], stoneMat, true);
      addBox([x, 3.05, z, 5.8, 0.22, 2.6], darkMat, false);
    });
    createWaterPatch(24, 6, 8, 38);
  }
}

function createTree(x, z, scale = 1, snowy = false) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 2.2 * scale, 10),
    makeMaterial(0x4a3524, 0.86, 0.02),
  );
  trunk.position.set(x, 1.1 * scale, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const leafColor = snowy ? 0xd8e6e8 : selectedMap.nature === "wetlands" ? 0x40552e : 0x234529;
  for (let i = 0; i < 3; i += 1) {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry((1.05 - i * 0.18) * scale, 1.8 * scale, 9),
      makeMaterial(leafColor, 0.9, 0.01),
    );
    crown.position.set(x, (2.15 + i * 0.76) * scale, z);
    crown.castShadow = true;
    scene.add(crown);
  }
}

function createRock(x, z, scale = 1) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(scale, 0),
    makeMaterial(selectedMap.nature === "snow" ? 0xaeb8bd : 0x56524a, 0.94, 0.02),
  );
  rock.position.set(x, scale * 0.42, z);
  rock.scale.y = 0.56;
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
}

// Scratch object reused while filling the grass InstancedMesh.
let grassDummy = null;

function createGrassField(clusterPositions) {
  if (!clusterPositions.length) return;
  const color = selectedMap.nature === "snow" ? 0xcbd6d8 : selectedMap.nature === "harbor" ? 0x293f3a : 0x2e4f2f;
  const bladeCount = selectedMap.nature === "quarry" ? 4 : 7;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: selectedMap.nature === "snow" ? 0.62 : 0.88,
  });
  const geometry = new THREE.PlaneGeometry(0.08, 1);
  const total = clusterPositions.length * bladeCount;
  const grass = new THREE.InstancedMesh(geometry, material, total);
  grass.castShadow = true;
  grass.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  let index = 0;
  for (const cluster of clusterPositions) {
    for (let i = 0; i < bladeCount; i += 1) {
      const height = (0.55 + Math.random() * 0.65) * cluster.scale;
      grassDummy.position.set(
        cluster.x + (Math.random() - 0.5) * 0.7 * cluster.scale,
        0.22 * cluster.scale,
        cluster.z + (Math.random() - 0.5) * 0.7 * cluster.scale,
      );
      grassDummy.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.42);
      grassDummy.scale.set(cluster.scale, height, cluster.scale);
      grassDummy.updateMatrix();
      grass.setMatrixAt(index, grassDummy.matrix);
      index += 1;
    }
  }
  grass.count = index;
  grass.instanceMatrix.needsUpdate = true;
  scene.add(grass);
}

function createBush(x, z, scale = 1) {
  const bushMat = makeMaterial(selectedMap.nature === "snow" ? 0xc7d0d0 : 0x24442d, 0.94, 0.01);
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 1), bushMat);
  bush.position.set(x, scale * 0.55, z);
  bush.scale.set(1.35, 0.62, 1.05);
  bush.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.25);
  bush.castShadow = true;
  bush.receiveShadow = true;
  scene.add(bush);
}

function createGroundWetMark(x, z, sx, sz, opacity = 0.18) {
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(sx, sz),
    new THREE.MeshBasicMaterial({
      color: selectedMap.nature === "snow" ? 0xe4eef1 : 0x06120e,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
  mark.rotation.x = -Math.PI / 2;
  mark.rotation.z = Math.random() * Math.PI;
  mark.position.set(x, 0.062, z);
  scene.add(mark);
}

function createCanopyShadow(x, z, sx, sz, opacity = 0.12) {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(sx, sz),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.rotation.z = Math.random() * Math.PI;
  shadow.position.set(x, 0.066, z);
  scene.add(shadow);
}

function createLightRay(x, z, width, height, opacity = 0.08) {
  const ray = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color: selectedMap.nature === "snow" ? 0xeaf7ff : 0xd7f0cf,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ray.position.set(x, height * 0.45, z);
  ray.rotation.y = -0.38 + Math.random() * 0.76;
  ray.rotation.z = -0.16 + Math.random() * 0.32;
  ray.renderOrder = -1;
  scene.add(ray);
}

function createWaterPatch(x, z, sx, sz) {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(sx, sz),
    new THREE.MeshStandardMaterial({
      color: selectedMap.nature === "coast" ? 0x123d49 : 0x1f3f35,
      roughness: 0.18,
      metalness: 0.38,
      emissive: selectedMap.nature === "forest" ? 0x07130f : 0x061016,
      transparent: true,
      opacity: 0.78,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 0.045, z);
  scene.add(water);

  const glint = new THREE.Mesh(
    new THREE.PlaneGeometry(sx * 0.82, Math.max(0.4, sz * 0.08)),
    new THREE.MeshBasicMaterial({
      color: selectedMap.glow,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    }),
  );
  glint.rotation.x = -Math.PI / 2;
  glint.rotation.z = -0.08;
  glint.position.set(x + sx * 0.06, 0.055, z - sz * 0.1);
  scene.add(glint);
}

function createFogSheet(x, y, z, width, height, opacity, rotation = 0) {
  const fog = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color: selectedMap.nature === "snow" ? 0xd9e4e8 : 0xc9d7c5,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
  fog.position.set(x, y, z);
  fog.rotation.y = rotation;
  fog.renderOrder = -2;
  scene.add(fog);
}

function createNatureLayer() {
  if (!selectedMap.nature) return;
  const snowy = selectedMap.nature === "snow";
  const sparse = selectedMap.nature === "harbor" || selectedMap.nature === "quarry";
  const treeCount = selectedMap.nature === "coast" ? 18 : selectedMap.nature === "snow" ? 24 : sparse ? 12 : 44;
  for (let i = 0; i < treeCount; i += 1) {
    const edge = Math.random() > 0.5;
    const x = edge ? (Math.random() > 0.5 ? 35 : -35) + Math.random() * 5 - 2.5 : -34 + Math.random() * 68;
    const z = edge ? -34 + Math.random() * 68 : (Math.random() > 0.5 ? 35 : -35) + Math.random() * 5 - 2.5;
    createTree(x, z, 0.75 + Math.random() * 0.65, snowy);
  }
  for (let i = 0; i < 34; i += 1) {
    createRock(-34 + Math.random() * 68, -34 + Math.random() * 68, 0.3 + Math.random() * 0.9);
  }
  const grassCount = sparse ? 46 : selectedMap.nature === "snow" ? 64 : 120;
  const grassClusters = [];
  for (let i = 0; i < grassCount; i += 1) {
    const x = -38 + Math.random() * 76;
    const z = -38 + Math.random() * 76;
    if (Math.abs(x - camera.position.x) < 3 && Math.abs(z - camera.position.z) < 4) continue;
    grassClusters.push({ x, z, scale: 0.65 + Math.random() * 1.1 });
  }
  createGrassField(grassClusters);
  const bushCount = sparse ? 8 : selectedMap.nature === "snow" ? 10 : 24;
  for (let i = 0; i < bushCount; i += 1) {
    createBush(-36 + Math.random() * 72, -36 + Math.random() * 72, 0.38 + Math.random() * 0.72);
  }
  for (let i = 0; i < 18; i += 1) {
    createGroundWetMark(
      -34 + Math.random() * 68,
      -34 + Math.random() * 68,
      2.2 + Math.random() * 6.4,
      0.7 + Math.random() * 2.3,
      selectedMap.nature === "snow" ? 0.12 : 0.16,
    );
  }
  for (let i = 0; i < 16; i += 1) {
    createCanopyShadow(-36 + Math.random() * 72, -36 + Math.random() * 72, 4 + Math.random() * 11, 1.2 + Math.random() * 4, sparse ? 0.08 : 0.13);
  }
  for (let i = 0; i < (sparse ? 4 : 8); i += 1) {
    createLightRay(-30 + Math.random() * 60, -28 + Math.random() * 48, 2.2 + Math.random() * 4.5, 7 + Math.random() * 8, sparse ? 0.045 : 0.075);
  }
  if (selectedMap.nature === "coast") {
    createWaterPatch(28, 0, 24, 86);
    addBox([11, 0.18, 0, 1.2, 0.36, 86], makeMaterial(0x777064, 0.88, 0.03), true);
  }
  if (selectedMap.nature === "wetlands" || selectedMap.nature === "forest" || selectedMap.nature === "village") {
    createWaterPatch(-18, -6, 7, 52);
    createWaterPatch(22, 18, 8, 28);
  }
  for (let i = 0; i < 7; i += 1) {
    createFogSheet(
      -30 + Math.random() * 60,
      1.6 + Math.random() * 2.8,
      -31 + Math.random() * 48,
      14 + Math.random() * 20,
      3.2 + Math.random() * 3.6,
      selectedMap.nature === "forest" || selectedMap.nature === "village" || selectedMap.nature === "research" ? 0.06 : 0.08,
      -0.65 + Math.random() * 1.3,
    );
  }
}

function buildRifleModel() {
  weapon = new THREE.Group();
  const isSniper = selectedWeapon === WEAPONS.sniper;
  const isSmg = selectedWeapon === WEAPONS.smg;

  // PBR materials for realistic gun finish.
  const receiverMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e24, roughness: 0.28, metalness: 0.82,
  });
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x0e1114, roughness: 0.22, metalness: 0.92,
  });
  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x232a32, roughness: 0.72, metalness: 0.06,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x2c333b, roughness: 0.38, metalness: 0.7,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: selectedMap.glow, roughness: 0.4, metalness: 0.3,
    emissive: selectedMap.glow, emissiveIntensity: 0.3,
  });
  const magMat = new THREE.MeshStandardMaterial({
    color: 0x14181c, roughness: 0.55, metalness: 0.4,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a5c, roughness: 0.05, metalness: 0.1,
    emissive: 0x0a2a4a, emissiveIntensity: 0.4,
  });

  const bodyLen = isSniper ? 1.5 : isSmg ? 0.78 : 1.08;
  const bodyH = isSniper ? 0.16 : 0.19;

  // Upper receiver (main body).
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.072, bodyH, bodyLen), receiverMat);
  upper.position.set(0, 0.02, -bodyLen * 0.42);
  weapon.add(upper);

  // Lower receiver.
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.09, bodyLen * 0.72), receiverMat);
  lower.position.set(0, -0.08, -bodyLen * 0.3);
  weapon.add(lower);

  // Barrel with tapered profile.
  const barrelLen = isSniper ? 1.2 : isSmg ? 0.52 : 0.72;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.024, barrelLen, 16),
    barrelMat,
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.025, -bodyLen - barrelLen * 0.42);
  weapon.add(barrel);

  // Barrel shroud / handguard with ventilation slots.
  const shroudLen = isSniper ? 0.9 : isSmg ? 0.44 : 0.6;
  const shroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.042, shroudLen, 12),
    railMat,
  );
  shroud.rotation.x = Math.PI / 2;
  shroud.position.set(0, 0.02, -bodyLen * 0.72 - shroudLen * 0.3);
  weapon.add(shroud);

  // Muzzle device (flash hider / suppressor).
  const muzzleLen = isSniper ? 0.18 : 0.1;
  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.022, muzzleLen, 12),
    barrelMat,
  );
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.025, -bodyLen - barrelLen * 0.86);
  weapon.add(muzzle);

  // Picatinny top rail.
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.018, bodyLen * 0.86), railMat);
  rail.position.set(0, 0.11, -bodyLen * 0.4);
  weapon.add(rail);
  // Rail slots (visual detail).
  for (let i = 0; i < 8; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.006, 0.012), barrelMat);
    slot.position.set(0, 0.12, -bodyLen * 0.15 - i * bodyLen * 0.085);
    weapon.add(slot);
  }

  // Front sight post.
  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.04, 0.008), receiverMat);
  frontSight.position.set(0, 0.14, -bodyLen - barrelLen * 0.3);
  weapon.add(frontSight);
  const frontSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.02), receiverMat);
  frontSightBase.position.set(0, 0.12, -bodyLen - barrelLen * 0.3);
  weapon.add(frontSightBase);

  // Rear sight / optic.
  if (isSniper) {
    // Scope with tube, objective lens, eyepiece, turrets.
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.52, 20), barrelMat);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.17, -bodyLen * 0.38);
    weapon.add(scopeTube);
    const objective = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.036, 0.1, 20), barrelMat);
    objective.rotation.x = Math.PI / 2;
    objective.position.set(0, 0.17, -bodyLen * 0.62);
    weapon.add(objective);
    const objectiveLens = new THREE.Mesh(new THREE.CircleGeometry(0.038, 20), lensMat);
    objectiveLens.position.set(0, 0.17, -bodyLen * 0.67);
    weapon.add(objectiveLens);
    const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.08, 20), polymerMat);
    eyepiece.rotation.x = Math.PI / 2;
    eyepiece.position.set(0, 0.17, -bodyLen * 0.1);
    weapon.add(eyepiece);
    // Turrets (windage + elevation).
    const turret1 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.04, 12), barrelMat);
    turret1.position.set(0, 0.21, -bodyLen * 0.38);
    weapon.add(turret1);
    const turret2 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.035, 12), barrelMat);
    turret2.rotation.z = Math.PI / 2;
    turret2.position.set(0.035, 0.17, -bodyLen * 0.38);
    weapon.add(turret2);
    // Scope rings.
    for (const zOff of [-0.18, 0.12]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 8, 20), railMat);
      ring.position.set(0, 0.17, -bodyLen * 0.38 + zOff);
      weapon.add(ring);
    }
  } else {
    // Iron rear sight.
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.032, 0.012), receiverMat);
    rearSight.position.set(0, 0.135, -bodyLen * 0.08);
    weapon.add(rearSight);
    const rearAperture = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.018, 0.014), barrelMat);
    rearAperture.position.set(0, 0.14, -bodyLen * 0.08);
    weapon.add(rearAperture);
  }

  // Pistol grip (ergonomic angle).
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.06), polymerMat);
  grip.position.set(0, -0.16, -bodyLen * 0.12);
  grip.rotation.x = -0.32;
  weapon.add(grip);
  // Grip texture ridges.
  for (let i = 0; i < 4; i++) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.006, 0.004), barrelMat);
    ridge.position.set(0, -0.12 - i * 0.028, -bodyLen * 0.12 + 0.032);
    ridge.rotation.x = -0.32;
    weapon.add(ridge);
  }

  // Trigger guard + trigger.
  const trigGuard = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 6, 12, Math.PI), receiverMat);
  trigGuard.rotation.y = Math.PI / 2;
  trigGuard.rotation.z = Math.PI;
  trigGuard.position.set(0, -0.11, -bodyLen * 0.22);
  weapon.add(trigGuard);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.024, 0.008), barrelMat);
  trigger.position.set(0, -0.1, -bodyLen * 0.22);
  trigger.rotation.x = 0.2;
  weapon.add(trigger);

  // Magazine (curved for carbine/smg, straight for sniper).
  const magCurve = isSniper ? 0 : 0.12;
  const mag = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, isSniper ? 0.14 : 0.18, isSmg ? 0.04 : 0.055),
    magMat,
  );
  mag.position.set(0, -0.2, -bodyLen * 0.34);
  mag.rotation.x = -0.08 - magCurve;
  weapon.add(mag);
  // Magazine base plate.
  const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.012, 0.06), barrelMat);
  magBase.position.set(0, -0.29, -bodyLen * 0.34 + magCurve * 0.3);
  weapon.add(magBase);

  // Stock (adjustable tactical stock).
  if (!isSmg) {
    const stockTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 10), receiverMat);
    stockTube.rotation.x = Math.PI / 2;
    stockTube.position.set(0, 0.01, 0.18);
    weapon.add(stockTube);
    const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.04), polymerMat);
    stockPad.position.set(0, -0.01, 0.34);
    weapon.add(stockPad);
    const stockCheek = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.14), polymerMat);
    stockCheek.position.set(0, 0.05, 0.26);
    weapon.add(stockCheek);
  } else {
    // Compact folding stock for SMG.
    const stockArm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.22), receiverMat);
    stockArm.position.set(0.025, -0.04, 0.14);
    weapon.add(stockArm);
    const stockEnd = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), polymerMat);
    stockEnd.position.set(0.025, -0.04, 0.26);
    weapon.add(stockEnd);
  }

  // Foregrip (angled tactical grip).
  if (!isSniper) {
    const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.08, 10), polymerMat);
    foregrip.position.set(0, -0.06, -bodyLen * 0.68);
    foregrip.rotation.x = 0.3;
    weapon.add(foregrip);
  }

  // Charging handle.
  const chargeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.025), barrelMat);
  chargeHandle.position.set(0, 0.08, -bodyLen * 0.02);
  weapon.add(chargeHandle);

  // Ejection port.
  const ejPort = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.05), barrelMat);
  ejPort.position.set(0.038, 0.02, -bodyLen * 0.3);
  weapon.add(ejPort);

  // Accent light strip (tactical indicator).
  const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.006, 0.06), accentMat);
  indicator.position.set(0.038, 0.06, -bodyLen * 0.5);
  weapon.add(indicator);

  // Muzzle flash light.
  muzzleLight = new THREE.PointLight(selectedWeapon.tracer, 0, 9);
  muzzleLight.position.set(0, 0.025, -bodyLen - barrelLen * 0.9);
  weapon.add(muzzleLight);

  // Muzzle flash mesh (cross-shaped quad, hidden by default).
  const flashMat = new THREE.MeshBasicMaterial({
    color: selectedWeapon.tracer,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flashGeo1 = new THREE.PlaneGeometry(0.14, 0.04);
  const flashGeo2 = new THREE.PlaneGeometry(0.04, 0.14);
  muzzleFlashMesh = new THREE.Group();
  const f1 = new THREE.Mesh(flashGeo1, flashMat);
  const f2 = new THREE.Mesh(flashGeo2, flashMat.clone());
  const f3 = new THREE.Mesh(flashGeo1, flashMat.clone());
  f3.rotation.y = Math.PI / 2;
  muzzleFlashMesh.add(f1, f2, f3);
  muzzleFlashMesh.position.set(0, 0.025, -bodyLen - barrelLen * 0.92);
  muzzleFlashMesh.visible = false;
  weapon.add(muzzleFlashMesh);

  // First-person arms.
  addViewArms(weapon, {
    grip: new THREE.Vector3(0, -0.16, -bodyLen * 0.12),
    foregrip: new THREE.Vector3(0, -0.06, -bodyLen * 0.68),
  });

  // Position weapon in view (hip-fire default).
  weapon.position.set(0.24, -0.22, -0.42);
  weapon.rotation.set(0, 0.02, 0);
  return weapon;
}

// Build a pair of first-person arms reaching to the given grip points.
function addViewArms(group, points) {
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x2a3226, roughness: 0.85, metalness: 0.02 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.6, metalness: 0.08 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc9a184, roughness: 0.7, metalness: 0 });

  const buildArm = (handPos, elbowDir) => {
    const arm = new THREE.Group();
    // Forearm (sleeve) from hand back/down toward the camera.
    const foreLen = 0.34;
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, foreLen, 12), sleeveMat);
    const dir = elbowDir.clone().normalize();
    fore.position.copy(handPos).addScaledVector(dir, foreLen / 2);
    fore.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    arm.add(fore);
    // Wrist skin.
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.05, 10), skinMat);
    wrist.position.copy(handPos).addScaledVector(dir, 0.03);
    wrist.quaternion.copy(fore.quaternion);
    arm.add(wrist);
    // Hand (glove) gripping.
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.075), gloveMat);
    hand.position.copy(handPos);
    arm.add(hand);
    // Fingers wrap (front of grip).
    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.05, 0.03), gloveMat);
    fingers.position.copy(handPos).add(new THREE.Vector3(0, -0.01, -0.045));
    arm.add(fingers);
    return arm;
  };

  // Right arm: from lower-right of screen to the pistol grip.
  group.add(buildArm(points.grip, new THREE.Vector3(0.16, -0.5, 0.42)));
  // Left arm: from lower-left to the foregrip (crosses under the rifle).
  group.add(buildArm(points.foregrip, new THREE.Vector3(-0.2, -0.48, 0.3)));
}

function buildKnifeModel() {
  weapon = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.18, metalness: 0.95 });
  const guardMat = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.4, metalness: 0.7 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.75, metalness: 0.05 });

  // Blade (tapered via scaled box + tip).
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.045, 0.24), bladeMat);
  blade.position.set(0, 0.01, -0.22);
  weapon.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.07, 4), bladeMat);
  tip.rotation.x = -Math.PI / 2;
  tip.rotation.z = Math.PI / 4;
  tip.position.set(0, 0.01, -0.37);
  weapon.add(tip);
  // Fuller (blood groove) accent.
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.012, 0.18), guardMat);
  fuller.position.set(0, 0.02, -0.2);
  weapon.add(fuller);
  // Guard.
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), guardMat);
  guard.position.set(0, 0.005, -0.09);
  weapon.add(guard);
  // Handle with grip ridges.
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.13, 10), handleMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0, -0.015);
  weapon.add(handle);
  // Pommel.
  const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.025, 10), guardMat);
  pommel.rotation.x = Math.PI / 2;
  pommel.position.set(0, 0, 0.055);
  weapon.add(pommel);

  addViewArms(weapon, {
    grip: new THREE.Vector3(0, -0.02, -0.01),
    foregrip: new THREE.Vector3(-0.05, -0.06, -0.12),
  });

  weapon.position.set(0.26, -0.24, -0.4);
  weapon.rotation.set(0, -0.12, 0);
  return weapon;
}

function buildGrenadeModel() {
  weapon = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a4232, roughness: 0.5, metalness: 0.35 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.3, metalness: 0.9 });
  const leverMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.25, metalness: 0.9 });

  // Grenade body (cylinder with rounded top).
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.09, 16), bodyMat);
  body.position.set(0, -0.02, -0.12);
  weapon.add(body);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
  top.position.set(0, 0.025, -0.12);
  weapon.add(top);
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bodyMat);
  bottom.position.set(0, -0.065, -0.12);
  weapon.add(bottom);
  // Fuse assembly (top cap + striker).
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.02, 12), metalMat);
  cap.position.set(0, 0.055, -0.12);
  weapon.add(cap);
  // Spoon (safety lever).
  const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.05, 0.014), leverMat);
  spoon.position.set(0.028, 0.03, -0.12);
  spoon.rotation.z = -0.25;
  weapon.add(spoon);
  // Pull ring.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 14), metalMat);
  ring.position.set(-0.03, 0.05, -0.12);
  ring.rotation.y = Math.PI / 2;
  weapon.add(ring);
  // Body ridges (fragmentation pattern).
  for (let i = 0; i < 3; i++) {
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.037, 0.003, 6, 16), bodyMat);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.set(0, -0.045 + i * 0.03, -0.12);
    weapon.add(ridge);
  }

  addViewArms(weapon, {
    grip: new THREE.Vector3(0, -0.05, -0.1),
    foregrip: new THREE.Vector3(-0.04, -0.02, -0.14),
  });

  weapon.position.set(0.24, -0.22, -0.4);
  weapon.rotation.set(0, 0.1, 0);
  return weapon;
}

// Build the current weapon view model (with arms) and attach it to the camera.
function createViewModel() {
  if (weapon) camera.remove(weapon);
  if (currentWeaponType === "knife") buildKnifeModel();
  else if (currentWeaponType === "grenade") buildGrenadeModel();
  else buildRifleModel();
  camera.add(weapon);
  if (!camera.parent) scene.add(camera);
  // Keep the third-person model's weapon in sync.
  if (playerModel) updatePlayerModelWeapon();
}

function initShellPool() {
  if (shellPool.length) return;
  const shellGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.028, 8);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xc8a832, roughness: 0.3, metalness: 0.85 });
  for (let i = 0; i < SHELL_POOL_SIZE; i++) {
    const shell = new THREE.Mesh(shellGeo, shellMat.clone());
    shell.visible = false;
    shell.frustumCulled = false;
    scene.add(shell);
    shellPool.push({ mesh: shell, vel: new THREE.Vector3(), life: 0, rotVel: new THREE.Vector3() });
  }
}

// --- Third-person player model ---
function createPlayerModel() {
  playerModel = new THREE.Group();
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x333b34, roughness: 0.6, metalness: 0.15 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x262c26, roughness: 0.8, metalness: 0.02 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc9a184, roughness: 0.7 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.85 });

  // Torso (chest armor).
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.26), armorMat);
  torso.position.y = 1.16;
  torso.castShadow = true;
  playerModel.add(torso);
  // Plate carrier detail.
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.05), clothMat);
  plate.position.set(0, 1.18, 0.14);
  playerModel.add(plate);
  // Head + helmet.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 14), skinMat);
  head.position.y = 1.6;
  head.castShadow = true;
  playerModel.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), armorMat);
  helmet.position.y = 1.62;
  playerModel.add(helmet);
  // Hips / belt.
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.24), clothMat);
  hips.position.y = 0.84;
  playerModel.add(hips);
  // Legs.
  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.42, 10), clothMat);
    thigh.position.set(side * 0.1, 0.58, 0);
    thigh.castShadow = true;
    playerModel.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.4, 10), clothMat);
    shin.position.set(side * 0.1, 0.2, 0);
    playerModel.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.2), bootMat);
    boot.position.set(side * 0.1, 0.045, 0.03);
    playerModel.add(boot);
  }
  // Arms (upper + forearm), angled to hold a weapon in front.
  for (const side of [-1, 1]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.32, 10), armorMat);
    upper.position.set(side * 0.26, 1.28, 0.02);
    upper.rotation.z = side * 0.35;
    upper.rotation.x = -0.5;
    upper.castShadow = true;
    playerModel.add(upper);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.3, 10), clothMat);
    fore.position.set(side * 0.2, 1.06, 0.22);
    fore.rotation.x = -1.1;
    fore.rotation.z = side * -0.25;
    playerModel.add(fore);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.07), skinMat);
    hand.position.set(side * 0.12, 1.0, 0.36);
    playerModel.add(hand);
  }
  // Backpack (tactical pack on the back).
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.16), clothMat);
  pack.position.set(0, 1.22, -0.2);
  pack.castShadow = true;
  playerModel.add(pack);
  const packTop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.14), armorMat);
  packTop.position.set(0, 1.48, -0.2);
  playerModel.add(packTop);

  playerModel.visible = viewMode === "tps";
  scene.add(playerModel);
  updatePlayerModelWeapon();
}

// Attach a simple weapon mesh to the third-person model's hands.
function updatePlayerModelWeapon() {
  if (!playerModel) return;
  if (playerModelWeapon) playerModel.remove(playerModelWeapon);
  const g = new THREE.Group();
  if (currentWeaponType === "knife") {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.05, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.2, metalness: 0.9 }),
    );
    blade.position.z = 0.18;
    g.add(blade);
  } else if (currentWeaponType === "grenade") {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a4232, roughness: 0.5, metalness: 0.35 }),
    );
    g.add(body);
  } else {
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.16, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.3, metalness: 0.8 }),
    );
    gun.position.z = 0.25;
    g.add(gun);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x0e1114, roughness: 0.25, metalness: 0.9 }),
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.8);
    g.add(barrel);
  }
  g.position.set(0.12, 1.02, 0.38);
  playerModel.add(g);
  playerModelWeapon = g;
}

// --- Weapon switching & view mode ---
function switchWeapon(type) {
  if (currentWeaponType === type || reloading) return;
  currentWeaponType = type;
  adsActive = false;
  createViewModel();
  const label = type === "knife" ? KNIFE.name : type === "grenade" ? `${GRENADE.name} (${grenadeCount})` : selectedWeapon.name;
  if (ui.weaponName) ui.weaponName.textContent = label;
  showToast(`已切换：${label}`);
  playTone(620, 0.06, "square", 0.12);
  updateInventoryHud();
}

function toggleViewMode() {
  viewMode = viewMode === "fps" ? "tps" : "fps";
  if (playerModel) playerModel.visible = viewMode === "tps";
  if (weapon) weapon.visible = viewMode === "fps";
  showToast(viewMode === "fps" ? "第一人称视角" : "第三人称视角");
}

// --- Knife melee ---
function knifeAttack() {
  if (knifeSwingTimer > 0) return;
  knifeSwingTimer = KNIFE.swingInterval;
  playTone(220, 0.08, "sawtooth", 0.1);
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hits = raycaster.intersectObjects(botMeshes, false);
  if (hits.length && hits[0].distance <= KNIFE.range) {
    const bot = meshToBot.get(hits[0].object);
    if (bot) {
      const critical = hits[0].point.y - bot.group.position.y > 1.34;
      bot.health -= critical ? KNIFE.critical : KNIFE.damage;
      bot.hitReact = 1;
      spawnImpact(hits[0].point, 0xff5566);
      showHitmarker();
      playHitSound(critical);
      if (bot.health <= 0) {
        removeBot(bot);
        kills += 1;
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
        pushKillfeed("<b>你</b> 刀杀 敌方步兵");
        showToast("刀杀 +1");
        if (selectedMode === MODES.deathmatch && kills >= 30) endMatch("团队竞技胜利");
      }
      updateHud();
    }
  }
}

// --- Grenade throw & explosion ---
function throwGrenade() {
  if (throwAnimTimer > 0) return;
  if (grenadeCount <= 0) {
    showToast("手雷用完了");
    return;
  }
  grenadeCount -= 1;
  throwAnimTimer = 0.5;
  playTone(440, 0.07, "square", 0.12);
  updateInventoryHud();

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a4232, roughness: 0.5, metalness: 0.4 }),
  );
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  mesh.position.copy(camera.position).addScaledVector(dir, 0.5);
  const vel = dir.clone().multiplyScalar(GRENADE.throwForce);
  vel.y += 3.2; // arc upward
  scene.add(mesh);
  activeGrenades.push({ mesh, vel, fuse: GRENADE.fuse });
}

function updateGrenades(delta) {
  for (let i = activeGrenades.length - 1; i >= 0; i--) {
    const g = activeGrenades[i];
    g.fuse -= delta;
    g.vel.y -= 13 * delta; // gravity
    g.mesh.position.addScaledVector(g.vel, delta);
    g.mesh.rotation.x += delta * 9;
    g.mesh.rotation.z += delta * 7;
    // Bounce on ground.
    if (g.mesh.position.y < 0.05) {
      g.mesh.position.y = 0.05;
      g.vel.y *= -0.42;
      g.vel.x *= 0.7;
      g.vel.z *= 0.7;
    }
    if (g.fuse <= 0) {
      explodeGrenade(g.mesh.position);
      scene.remove(g.mesh);
      activeGrenades.splice(i, 1);
    }
  }
}

function explodeGrenade(point) {
  // Flash light + expanding shockwave ring.
  const flash = new THREE.PointLight(0xffa040, 90, 18);
  flash.position.copy(point).setY(point.y + 0.4);
  scene.add(flash);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.position.copy(point).setY(point.y + 0.1);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  decals.push({ type: "blast", light: flash, ring, life: 0.5 });

  playShotSound();
  playTone(90, 0.3, "sine", 0.4);

  // Damage bots within blast radius (falloff with distance).
  bots.forEach((bot) => {
    const d = bot.group.position.distanceTo(point);
    if (d <= GRENADE.blastRadius) {
      const falloff = 1 - d / GRENADE.blastRadius;
      bot.health -= GRENADE.damage * (0.4 + 0.6 * falloff);
      bot.hitReact = 1;
      if (bot.health <= 0) {
        removeBot(bot);
        kills += 1;
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
        pushKillfeed("<b>你</b> 手雷炸毁 敌方步兵");
        if (selectedMode === MODES.deathmatch && kills >= 30) endMatch("团队竞技胜利");
      }
    }
  });
  showToast("手雷爆炸");
  updateHud();
}

function spawnWave() {
  const count = Math.min(selectedMode.botBase + Math.floor(wave * 1.15), selectedMode.botLimit);
  for (let i = 0; i < count; i += 1) {
    spawnBot();
  }
  showToast(`${selectedMode.name}：第 ${wave} 轮目标已出现`);
}

function spawnBot() {
  const group = new THREE.Group();
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x384047,
    roughness: 0.66,
    metalness: 0.18,
    emissive: 0x080b0d,
  });
  const clothMat = new THREE.MeshStandardMaterial({
    color: 0x1b221f,
    roughness: 0.9,
    metalness: 0.04,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0x7e6758,
    roughness: 0.78,
    metalness: 0.02,
  });
  const visorMat = new THREE.MeshBasicMaterial({ color: selectedMap.glow });
  const botTexture = enemyTextures.length ? enemyTextures[Math.floor(Math.random() * enemyTextures.length)] : enemyTexture;
  const idleTexture = botTexture;
  const actionTexture = enemyFrames.aim?.[0] || enemyActionTexture || botTexture;
  if (botTexture) {
    [armorMat, clothMat, skinMat].forEach((material) => {
      material.transparent = true;
      material.opacity = 0.14;
      material.depthWrite = false;
    });
    visorMat.transparent = true;
    visorMat.opacity = 0.22;
  }

  const parts = [
    ["torso", new THREE.BoxGeometry(0.72, 0.98, 0.38), armorMat, [0, 0.95, 0]],
    ["head", new THREE.SphereGeometry(0.24, 18, 14), skinMat, [0, 1.58, -0.02]],
    ["vest", new THREE.BoxGeometry(0.62, 0.46, 0.44), armorMat, [0, 1.1, -0.04]],
    ["leftArm", new THREE.CapsuleGeometry(0.11, 0.54, 5, 10), clothMat, [-0.48, 0.94, 0]],
    ["rightArm", new THREE.CapsuleGeometry(0.11, 0.54, 5, 10), clothMat, [0.48, 0.94, 0]],
    ["leftLeg", new THREE.CapsuleGeometry(0.13, 0.66, 5, 10), clothMat, [-0.18, 0.32, 0]],
    ["rightLeg", new THREE.CapsuleGeometry(0.13, 0.66, 5, 10), clothMat, [0.18, 0.32, 0]],
    ["leftHand", new THREE.SphereGeometry(0.09, 12, 8), skinMat, [-0.55, 0.63, -0.16]],
    ["rightHand", new THREE.SphereGeometry(0.09, 12, 8), skinMat, [0.55, 0.63, -0.16]],
    ["leftBoot", new THREE.BoxGeometry(0.22, 0.12, 0.34), armorMat, [-0.18, 0.02, -0.05]],
    ["rightBoot", new THREE.BoxGeometry(0.22, 0.12, 0.34), armorMat, [0.18, 0.02, -0.05]],
  ];

  parts.forEach(([zone, geometry, material, position]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.hitZone = zone;
    group.add(mesh);
    botMeshes.push(mesh);
  });

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), armorMat);
  helmet.position.set(0, 1.64, -0.02);
  helmet.castShadow = true;
  helmet.userData.hitZone = "head";
  group.add(helmet);
  botMeshes.push(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.035), visorMat);
  visor.position.set(0, 1.57, -0.24);
  group.add(visor);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.22), armorMat);
  backpack.position.set(0, 0.96, 0.31);
  backpack.castShadow = true;
  group.add(backpack);

  const faceMask = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.04), armorMat);
  faceMask.position.set(0, 1.47, -0.24);
  faceMask.castShadow = true;
  group.add(faceMask);

  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.1), armorMat);
  rifle.position.set(0.26, 0.96, -0.38);
  rifle.rotation.y = -0.08;
  rifle.castShadow = true;
  group.add(rifle);

  let visual = null;
  if (botTexture) {
    const visualMaterial = new THREE.SpriteMaterial({
      map: idleTexture,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.04,
      fog: false,
      depthTest: false,
      depthWrite: false,
    });
    const visualHeight = 3.8 + Math.random() * 0.3;
    const visualWidth = botTexture === enemyTextures[2] ? 2.26 : 1.96 + Math.random() * 0.16;
    visual = new THREE.Sprite(visualMaterial);
    visual.scale.set(visualWidth, visualHeight, 1);
    visual.position.set(0, 1.72 + (visualHeight - 3.8) * 0.08, -0.08);
    visual.userData.hitZone = "torso";
    visual.renderOrder = 100;
    group.add(visual);
    botMeshes.push(visual);
  }

  const spawn = randomSpawnPoint();
  group.position.set(spawn.x, 0, spawn.z);
  scene.add(group);

  const bot = {
    group,
    visual,
    visualMaterial: visual?.material || null,
    idleTexture,
    actionTexture,
    walkTextures: enemyFrames.walk || [actionTexture],
    fireTexture: enemyFrames.fire?.[0] || actionTexture,
    hitTexture: enemyFrames.hit?.[0] || actionTexture,
    visualBaseScale: visual ? visual.scale.clone() : null,
    hitReact: 0,
    fireReact: 0,
    lastDistance: 999,
    health: selectedMode.botHealth + wave * 8,
    speed: selectedMode.botSpeed + Math.random() * 0.45 + wave * 0.025,
    nextShot: Math.random() * 2,
    strafe: Math.random() > 0.5 ? 1 : -1,
  };
  bots.push(bot);
  group.traverse((child) => {
    if (child.isMesh || child.isSprite) meshToBot.set(child, bot);
  });
}

function randomSpawnPoint() {
  if (bots.length < 3) {
    const baseX = camera.position.x;
    const baseZ = camera.position.z;
    const earlySpawns = [
      { x: baseX - 3 + Math.random() * 1.2, z: baseZ - 10 - Math.random() * 1.5 },
      { x: baseX + 3 - Math.random() * 1.2, z: baseZ - 13 - Math.random() * 1.5 },
      { x: baseX + Math.random() * 2 - 1, z: baseZ - 16 - Math.random() * 1.5 },
    ];
    const spawn = earlySpawns[bots.length];
    spawn.x = Math.max(-50, Math.min(50, spawn.x));
    spawn.z = Math.max(-50, Math.min(50, spawn.z));
    return spawn;
  }
  for (let i = 0; i < 50; i += 1) {
    const x = -50 + Math.random() * 100;
    const z = -50 + Math.random() * 100;
    const candidate = new THREE.Vector3(x, player.height, z);
    if (camera.position.distanceTo(candidate) > 15 && !collides(candidate)) {
      return { x, z };
    }
  }
  return { x: 28, z: -28 };
}

function onMouseMove(event) {
  if (document.pointerLockElement !== ui.canvas) return;
  yaw -= event.movementX * 0.0022 * sensitivity;
  pitch -= event.movementY * 0.002 * sensitivity;
  pitch = Math.max(-1.25, Math.min(1.18, pitch));
  // Track mouse velocity for weapon sway.
  lastMouseX = event.movementX;
  lastMouseY = event.movementY;
}

function onMouseDown(event) {
  if (!started || paused) return;
  if (event.button === 0) {
    if (currentWeaponType === "rifle") {
      firing = true;
      shoot();
    } else if (currentWeaponType === "knife") {
      knifeAttack();
    } else if (currentWeaponType === "grenade") {
      throwGrenade();
    }
  } else if (event.button === 2) {
    if (currentWeaponType === "rifle") adsActive = true;
  }
}

function shoot() {
  if (reloading || fireCooldown > 0) return;
  if (ammo <= 0) {
    reload();
    showToast("弹匣空了，正在换弹");
    return;
  }

  ammo -= 1;
  shotsFired += 1;
  fireCooldown = selectedWeapon.fireRate;
  lastShotAt = performance.now();

  // Muzzle flash + light.
  muzzleLight.intensity = selectedWeapon === WEAPONS.sniper ? 64 : 42;
  if (muzzleFlashMesh) {
    muzzleFlashMesh.visible = true;
    muzzleFlashMesh.rotation.z = Math.random() * Math.PI;
    const s = 0.7 + Math.random() * 0.6;
    muzzleFlashMesh.scale.set(s, s, s);
    muzzleFlashTimer = 0.04;
  }

  // Weapon kick animation.
  weaponKickZ = 0.06;

  // Deterministic recoil pattern (CS-style).
  const pattern = recoilPattern[Math.min(recoilIndex, RECOIL_PATTERN_LENGTH - 1)];
  const recoilMult = selectedWeapon.recoil * (adsLerp > 0.5 ? 0.6 : 1);
  recoilPitch += pattern.v * recoilMult * 0.8;
  recoilYaw += pattern.h * recoilMult * 0.5;
  recoilIndex = Math.min(recoilIndex + 1, RECOIL_PATTERN_LENGTH - 1);

  playShotSound();
  ejectShellCasing();

  // Raycast with spread (reduced when ADS).
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const moving = player.velocity.lengthSq() > 0.0001;
  const adsSpreadMod = adsLerp > 0.5 ? 0.35 : 1;
  const crouchMod = crouchLerp > 0.5 ? 0.6 : 1;
  const spread = ((moving ? 0.016 : 0.003) + recoilPitch * 0.55) * adsSpreadMod * crouchMod;
  raycaster.ray.direction.x += (Math.random() - 0.5) * spread;
  raycaster.ray.direction.y += (Math.random() - 0.5) * spread;
  raycaster.ray.direction.normalize();
  const hits = raycaster.intersectObjects(botMeshes, false);
  if (hits.length) {
    const mesh = hits[0].object;
    const bot = meshToBot.get(mesh);
    if (bot) {
      shotsHit += 1;
      const critical = mesh.userData.hitZone === "head" || hits[0].point.y - bot.group.position.y > 1.34;
      bot.health -= critical ? selectedWeapon.critical : selectedWeapon.damage;
      bot.hitReact = critical ? 1 : 0.65;
      spawnTracer(hits[0].point, critical ? 0xffd166 : selectedWeapon.tracer);
      spawnImpact(hits[0].point, critical ? 0xffd166 : selectedMap.glow);
      showHitmarker();
      playHitSound(critical);
      if (bot.health <= 0) {
        removeBot(bot);
        kills += 1;
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
        reserve = Math.min(selectedWeapon.reserve * 2, reserve + Math.round(8 * selectedMode.reserveScale));
        const feed = critical ? "<b>你</b> 精准击破 敌方步兵" : "<b>你</b> 击破 敌方步兵";
        pushKillfeed(feed);
        showToast(critical ? "精准命中 +1" : "敌方步兵击破 +1");
        if (selectedMode === MODES.deathmatch && kills >= 30) endMatch("团队竞技胜利");
      }
    }
  } else {
    // Bullet hole on ground/environment.
    const envHits = raycaster.intersectObjects(scene.children, false);
    const envHit = envHits.find((h) => h.object.isMesh && !botMeshes.includes(h.object) && h.object !== muzzleFlashMesh);
    if (envHit && envHit.distance < 80) {
      spawnBulletHole(envHit.point, envHit.face ? envHit.face.normal : UP_VECTOR);
    }
    tmpV2.copy(camera.position).addScaledVector(raycaster.ray.direction, 38);
    spawnTracer(tmpV2, 0xffffff);
  }
  updateHud();
}

function ejectShellCasing() {
  const shell = shellPool[shellCursor];
  shellCursor = (shellCursor + 1) % shellPool.length;
  // Eject from weapon's ejection port world position.
  const worldPos = new THREE.Vector3(0.05, 0.02, -0.3);
  weapon.localToWorld(worldPos);
  camera.localToWorld(worldPos.sub(camera.position)).add(camera.position);
  shell.mesh.position.copy(camera.position).add(
    new THREE.Vector3(0.28, -0.12, -0.5).applyQuaternion(camera.quaternion),
  );
  shell.mesh.visible = true;
  // Random ejection velocity (right + up + slightly back).
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0);
  shell.vel.copy(right).multiplyScalar(1.8 + Math.random() * 1.2)
    .addScaledVector(up, 2.2 + Math.random() * 1.5)
    .add(new THREE.Vector3(0, 0, 0.4 + Math.random() * 0.6).applyQuaternion(camera.quaternion));
  shell.rotVel.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
  shell.life = 1.2;
}

function spawnBulletHole(point, normal) {
  const holeMat = new THREE.MeshBasicMaterial({
    color: 0x0a0a0a,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.04 + Math.random() * 0.02, 8), holeMat);
  hole.position.copy(point).addScaledVector(normal, 0.01);
  hole.lookAt(point.clone().add(normal));
  scene.add(hole);
  bulletHoles.push({ mesh: hole, life: 12 });
  // Limit total bullet holes for performance.
  if (bulletHoles.length > MAX_BULLET_HOLES) {
    const old = bulletHoles.shift();
    scene.remove(old.mesh);
  }
}

function initPools() {
  const tracerGeometry = new THREE.CylinderGeometry(0.012, 0.012, 1, 8);
  for (let i = 0; i < 20; i += 1) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const tracer = new THREE.Mesh(tracerGeometry, material);
    tracer.visible = false;
    tracer.frustumCulled = false;
    scene.add(tracer);
    tracerPool.push(tracer);
  }
  const sparkGeometry = new THREE.BoxGeometry(0.035, 0.035, 0.38);
  for (let i = 0; i < 30; i += 1) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const spark = new THREE.Mesh(sparkGeometry, material);
    spark.visible = false;
    spark.frustumCulled = false;
    scene.add(spark);
    sparkPool.push(spark);
  }
}

function spawnTracer(point, color) {
  const tracer = tracerPool[tracerCursor];
  tracerCursor = (tracerCursor + 1) % tracerPool.length;
  const start = camera.localToWorld(new THREE.Vector3(0.32, -0.22, -1.86));
  tmpV1.copy(point).sub(start);
  const length = tmpV1.length();
  if (length > 0.0001) tmpV1.normalize();
  tracer.position.copy(start).add(point).multiplyScalar(0.5);
  tracer.quaternion.setFromUnitVectors(UP_VECTOR, tmpV1);
  tracer.scale.set(1, length, 1);
  tracer.material.color.setHex(color);
  tracer.material.opacity = 0.8;
  tracer.visible = true;
  decals.push({ mesh: tracer, life: 0.06, pooled: true });
}

function spawnImpact(point, color) {
  for (let i = 0; i < 5; i += 1) {
    const spark = sparkPool[sparkCursor];
    sparkCursor = (sparkCursor + 1) % sparkPool.length;
    spark.position.copy(point);
    spark.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    spark.material.color.setHex(color);
    spark.material.opacity = 0.88;
    spark.visible = true;
    decals.push({ mesh: spark, life: 0.12 + Math.random() * 0.08, pooled: true });
  }
}

function showHitmarker() {
  ui.hitmarker.classList.add("is-visible");
  window.clearTimeout(showHitmarker.timer);
  showHitmarker.timer = window.setTimeout(() => ui.hitmarker.classList.remove("is-visible"), 110);
}

function setBotFrame(bot, texture) {
  if (!bot.visualMaterial || !texture || bot.visualMaterial.map === texture) return;
  bot.visualMaterial.map = texture;
  bot.visualMaterial.needsUpdate = true;
}

function spawnDownedSprite(bot) {
  const texture = enemyFrames.down?.[0] || bot.idleTexture;
  if (!texture) return;
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.04,
    fog: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(bot.group.position);
  sprite.position.y = 1.18;
  sprite.scale.set(2.45, 2.2, 1);
  sprite.renderOrder = 80;
  scene.add(sprite);
  decals.push({ mesh: sprite, life: 1.2 });
}

function removeBot(bot) {
  const index = bots.indexOf(bot);
  if (index >= 0) bots.splice(index, 1);
  spawnDownedSprite(bot);
  bot.group.traverse((child) => {
    if (child.isMesh || child.isSprite) {
      const meshIndex = botMeshes.indexOf(child);
      if (meshIndex >= 0) botMeshes.splice(meshIndex, 1);
      meshToBot.delete(child);
    }
  });
  scene.remove(bot.group);
}

function reload() {
  if (reloading || ammo === selectedWeapon.mag || reserve <= 0) return;
  reloading = true;
  showToast("换弹中...");
  playReloadSound();
  setTimeout(() => {
    const need = selectedWeapon.mag - ammo;
    const take = Math.min(need, reserve);
    ammo += take;
    reserve -= take;
    reloading = false;
    showToast("换弹完成");
    updateHud();
  }, selectedWeapon.reloadMs);
}

function updatePlayer(delta) {
  const weight = selectedWeapon === WEAPONS.sniper ? 0.88 : selectedWeapon === WEAPONS.smg ? 1.08 : 1;

  // Sprint + stamina system.
  const wantSprint = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && stamina > 0;
  const isMoving = keys.has("KeyW") || keys.has("KeyS") || keys.has("KeyA") || keys.has("KeyD");
  sprinting = wantSprint && isMoving && !crouching && !adsActive;
  if (sprinting) {
    stamina = Math.max(0, stamina - delta * 28);
  } else {
    stamina = Math.min(100, stamina + delta * 18);
  }

  // Crouch state.
  crouching = keys.has("ControlLeft") || keys.has("ControlRight");
  const crouchTarget = crouching ? 1 : 0;
  crouchLerp += (crouchTarget - crouchLerp) * Math.min(1, delta * 10);

  // Movement speed (ADS slows you down like CS).
  const adsSpeedMod = adsLerp > 0.5 ? 0.62 : 1;
  const crouchSpeedMod = crouchLerp > 0.5 ? 0.45 : 1;
  const sprintMod = sprinting ? 1.48 : 1;
  const speed = 4.8 * weight * adsSpeedMod * crouchSpeedMod * sprintMod;

  const forward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
  const right = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
  const move = new THREE.Vector3();
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  move.x = right * cos - forward * sin;
  move.z = right * sin + forward * cos;
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * delta);
  player.velocity.copy(move);

  const next = camera.position.clone().add(move);
  next.x = Math.max(-62, Math.min(62, next.x));
  next.z = Math.max(-62, Math.min(62, next.z));
  if (!collides(next)) {
    camera.position.x = next.x;
    camera.position.z = next.z;
  }

  // Jump + gravity.
  if (keys.has("Space") && grounded) {
    verticalVelocity = 5.2;
    grounded = false;
  }
  if (!grounded) {
    verticalVelocity -= 14.5 * delta; // gravity
  }
  const standHeight = player.height;
  const crouchHeight = player.height * 0.62;
  const targetHeight = standHeight + (crouchHeight - standHeight) * crouchLerp;
  let currentY = camera.position.y + verticalVelocity * delta;
  if (currentY <= targetHeight) {
    currentY = targetHeight;
    verticalVelocity = 0;
    grounded = true;
  }
  camera.position.y = currentY;

  // Head bob (CS-style, synced to movement).
  const moveSpeed = move.length() / delta;
  if (moveSpeed > 0.5 && grounded) {
    const bobFreq = sprinting ? 11.5 : crouchLerp > 0.5 ? 6.5 : 8.2;
    const bobAmp = sprinting ? 0.032 : crouchLerp > 0.5 ? 0.012 : 0.022;
    headBobPhase += delta * bobFreq;
    headBobAmount += (bobAmp - headBobAmount) * Math.min(1, delta * 6);
  } else {
    headBobAmount += (0 - headBobAmount) * Math.min(1, delta * 8);
  }
  const bobY = Math.sin(headBobPhase * 2) * headBobAmount;
  const bobX = Math.cos(headBobPhase) * headBobAmount * 0.6;
  camera.position.y += bobY;

  // Footstep sounds.
  if (moveSpeed > 0.5 && grounded) {
    const interval = sprinting ? FOOTSTEP_INTERVAL_SPRINT : FOOTSTEP_INTERVAL_WALK;
    lastFootstep += delta;
    if (lastFootstep >= interval) {
      lastFootstep = 0;
      playFootstep();
    }
  }

  // Apply camera rotation with recoil.
  camera.rotation.set(pitch + recoilPitch, yaw + recoilYaw, bobX * 0.3);
}

function collides(position) {
  return obstacles.some(
    (box) =>
      position.x > box.minX &&
      position.x < box.maxX &&
      position.z > box.minZ &&
      position.z < box.maxZ,
  );
}

function lineBlocked(a, b) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len <= 0) return false;
  dir.normalize();
  for (let d = 1.2; d < len; d += 1.2) {
    const p = a.clone().add(dir.clone().multiplyScalar(d));
    if (collides(p)) return true;
  }
  return false;
}

function botCollides(position) {
  return obstacles.some(
    (box) =>
      position.x > box.minX + 0.16 &&
      position.x < box.maxX - 0.16 &&
      position.z > box.minZ + 0.16 &&
      position.z < box.maxZ - 0.16,
  );
}

function updateBots(delta) {
  botSpawnTimer -= delta;
  bots.forEach((bot) => {
    const toPlayer = tmpV1.copy(camera.position).sub(bot.group.position);
    const distance = toPlayer.length();
    toPlayer.y = 0;
    const dir = toPlayer.normalize();
    const tangent = tmpV2.set(-dir.z, 0, dir.x).multiplyScalar(bot.strafe);

    // Tactical strafing: change direction periodically.
    if (!bot.strafeTimer) bot.strafeTimer = 1.5 + Math.random() * 2;
    bot.strafeTimer -= delta;
    if (bot.strafeTimer <= 0) {
      bot.strafe *= -1;
      bot.strafeTimer = 1.2 + Math.random() * 2.5;
      tangent.multiplyScalar(-1);
    }

    // Movement: approach if far, hold position at mid range, retreat if too close.
    let approachFactor;
    if (distance > 14) approachFactor = 1;
    else if (distance > 6) approachFactor = 0.3;
    else approachFactor = -0.4; // back off at close range

    // Low health bots seek cover (move toward nearest obstacle).
    const healthRatio = bot.health / (selectedMode.botHealth + wave * 8);
    if (healthRatio < 0.35 && distance < 18) {
      // Strafe more aggressively when hurt.
      approachFactor = -0.2;
      tangent.multiplyScalar(1.8);
    }

    // Dodge faster when recently hit.
    const dodgeMod = bot.hitReact > 0.1 ? 1.6 : 1;
    const desired = tmpV3.copy(dir).multiplyScalar(approachFactor).addScaledVector(tangent, 0.5 * dodgeMod);
    if (desired.lengthSq() > 0) desired.normalize();
    const speed = bot.speed * dodgeMod * (healthRatio < 0.35 ? 1.3 : 1);
    const next = tmpV4.copy(bot.group.position).addScaledVector(desired, speed * delta);
    next.x = Math.max(-38, Math.min(38, next.x));
    next.z = Math.max(-38, Math.min(38, next.z));
    if (botCollides(next)) {
      const side = tmpV5.copy(bot.group.position).addScaledVector(tangent.normalize(), speed * delta * 1.8);
      side.x = Math.max(-38, Math.min(38, side.x));
      side.z = Math.max(-38, Math.min(38, side.z));
      if (!botCollides(side)) bot.group.position.copy(side);
    } else {
      bot.group.position.copy(next);
    }
    bot.group.lookAt(camera.position.x, bot.group.position.y, camera.position.z);
    const movingAmount = desired.lengthSq() > 0 ? 1 : 0;
    const step = Math.sin(gameTime * (8.5 + bot.speed * 1.3) + bot.speed * 3);
    bot.group.position.y = Math.abs(step) * 0.045 * movingAmount;
    bot.group.rotation.z = step * 0.035 * movingAmount;

    // Crouch-like behavior at close range (lower the group slightly).
    if (distance < 5 && movingAmount < 0.5) {
      bot.group.position.y -= 0.15;
    }

    if (bot.visual && bot.visualBaseScale) {
      const aiming = distance < 24;
      bot.fireReact = Math.max(0, bot.fireReact - delta * 7);
      let frameTexture = bot.idleTexture;
      if (bot.hitReact > 0.06) {
        frameTexture = bot.hitTexture;
      } else if (bot.fireReact > 0.04) {
        frameTexture = bot.fireTexture;
      } else if (movingAmount) {
        const frameIndex = Math.floor(gameTime * 8.5 + bot.speed * 2) % bot.walkTextures.length;
        frameTexture = bot.walkTextures[frameIndex] || bot.actionTexture;
      } else if (aiming) {
        frameTexture = bot.actionTexture;
      }
      setBotFrame(bot, frameTexture);
      const breathe = 1 + Math.sin(gameTime * 2.2 + bot.speed) * 0.018;
      const stride = 1 + Math.abs(step) * 0.035 * movingAmount;
      bot.hitReact = Math.max(0, bot.hitReact - delta * 5);
      const recoil = bot.hitReact * 0.18;
      bot.visual.scale.set(
        bot.visualBaseScale.x * (breathe + recoil * 0.2),
        bot.visualBaseScale.y * stride * (1 - recoil * 0.05),
        1,
      );
      bot.visual.position.x = step * 0.09 * movingAmount;
      bot.visual.position.y = 1.72 + Math.abs(step) * 0.09 * movingAmount + recoil;
      bot.visual.material.opacity = 0.98 - bot.hitReact * 0.28;
    }

    // Burst fire pattern (CS-style: 2-4 shots per burst).
    if (!bot.burstCount) bot.burstCount = 0;
    if (!bot.burstPause) bot.burstPause = 0;
    bot.nextShot -= delta;
    if (bot.burstPause > 0) {
      bot.burstPause -= delta;
    } else if (distance < 24 && bot.nextShot <= 0 && !lineBlocked(tmpV5.copy(bot.group.position).setY(bot.group.position.y + 1.35), camera.position)) {
      bot.fireReact = 1;
      // Accuracy decreases with distance and movement.
      const accuracyMod = distance > 16 ? 0.6 : distance > 10 ? 0.8 : 1;
      const hitChance = 0.55 * accuracyMod * (movingAmount > 0.5 ? 0.7 : 1);
      if (Math.random() < hitChance) {
        damagePlayer(selectedMode.damage + Math.floor(wave * 0.8));
        pushKillfeed("敌方步兵 命中 <b>你</b>");
      }
      bot.burstCount += 1;
      bot.nextShot = 0.12 + Math.random() * 0.08; // fast within burst
      if (bot.burstCount >= 2 + Math.floor(Math.random() * 3)) {
        // End burst, pause before next.
        bot.burstCount = 0;
        bot.burstPause = 0.8 + Math.random() * 1.2;
        bot.nextShot = 0.4;
      }
    }
  });

  if (bots.length === 0 && botSpawnTimer <= 0) {
    wave += 1;
    botSpawnTimer = 1.5;
    spawnWave();
  }
}

function damagePlayer(amount) {
  if (matchEnded) return;
  health = Math.max(0, health - amount);
  streak = 0;
  playTone(120, 0.1, "sawtooth", 0.16);
  ui.damage.classList.add("is-visible");
  window.clearTimeout(damagePlayer.timer);
  damagePlayer.timer = window.setTimeout(() => ui.damage.classList.remove("is-visible"), 130);
  if (health <= 0) {
    endMatch("行动失败");
    showToast("行动失败，查看结算");
  }
  updateHud();
}

function updateDecals(delta) {
  for (let i = decals.length - 1; i >= 0; i -= 1) {
    const d = decals[i];
    d.life -= delta;
    if (d.type === "blast") {
      // Expanding shockwave ring + fading flash light.
      const t = Math.max(0, d.life / 0.5);
      const scale = 1 + (1 - t) * GRENADE.blastRadius * 1.6;
      d.ring.scale.set(scale, scale, scale);
      d.ring.material.opacity = t * 0.9;
      d.light.intensity = t * 90;
      if (d.life <= 0) {
        scene.remove(d.ring);
        scene.remove(d.light);
        decals.splice(i, 1);
      }
      continue;
    }
    d.mesh.material.opacity = Math.max(0, d.life * 12);
    if (d.life <= 0) {
      if (d.pooled) {
        d.mesh.visible = false;
        d.mesh.material.opacity = 0;
      } else {
        scene.remove(d.mesh);
      }
      decals.splice(i, 1);
    }
  }
}

function updateWeapon(delta) {
  const isRifle = currentWeaponType === "rifle";

  // Muzzle flash decay (rifle only).
  if (isRifle && muzzleLight) {
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - delta * 220);
    if (muzzleFlashTimer > 0) {
      muzzleFlashTimer -= delta;
      if (muzzleFlashTimer <= 0 && muzzleFlashMesh) {
        muzzleFlashMesh.visible = false;
      }
    }
  }

  // ADS (aim down sights) lerp — rifles only.
  const adsTarget = isRifle && adsActive ? 1 : 0;
  adsLerp += (adsTarget - adsLerp) * Math.min(1, delta * 12);
  // Smooth FOV transition.
  const targetFov = HIP_FOV + (ADS_FOV_ZOOM - HIP_FOV) * adsLerp;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, delta * 14);
    camera.updateProjectionMatrix();
  }

  // Weapon position: hip vs ADS.
  const hipPos = { x: 0.24, y: -0.22, z: -0.42 };
  const adsPos = { x: 0, y: -0.14, z: -0.36 };
  const baseX = hipPos.x + (adsPos.x - hipPos.x) * adsLerp;
  const baseY = hipPos.y + (adsPos.y - hipPos.y) * adsLerp;
  const baseZ = hipPos.z + (adsPos.z - hipPos.z) * adsLerp;

  // Weapon sway (follows mouse with delay, reduced when ADS).
  const swayMod = adsLerp > 0.5 ? 0.25 : 1;
  const targetSwayX = -lastMouseX * 0.00012 * swayMod;
  const targetSwayY = lastMouseY * 0.0001 * swayMod;
  weaponSwayX += (targetSwayX - weaponSwayX) * Math.min(1, delta * 5);
  weaponSwayY += (targetSwayY - weaponSwayY) * Math.min(1, delta * 5);

  // Weapon bob (synced to head bob).
  const bobMod = adsLerp > 0.5 ? 0.2 : 1;
  weaponBobX = Math.cos(headBobPhase) * headBobAmount * 1.8 * bobMod;
  weaponBobY = Math.sin(headBobPhase * 2) * headBobAmount * 1.2 * bobMod;

  // Weapon kick from firing (Z recoil).
  weaponKickZ += (0 - weaponKickZ) * Math.min(1, delta * 16);

  // Reload animation (rifle only).
  let reloadOffsetY = 0;
  let reloadRotX = 0;
  if (isRifle && reloading) {
    reloadAnimTimer += delta;
    const totalMs = selectedWeapon.reloadMs / 1000;
    const phase = reloadAnimTimer / totalMs;
    if (phase < 0.3) {
      reloadOffsetY = -0.12 * (phase / 0.3);
      reloadRotX = -0.4 * (phase / 0.3);
    } else if (phase < 0.65) {
      const t = (phase - 0.3) / 0.35;
      reloadOffsetY = -0.12 + 0.12 * t;
      reloadRotX = -0.4 + 0.4 * t;
    } else if (phase < 0.85) {
      const t = (phase - 0.65) / 0.2;
      reloadRotX = 0.12 * Math.sin(t * Math.PI);
    }
  } else if (isRifle) {
    reloadAnimTimer = 0;
  }

  // Knife swing animation (slash arc).
  let knifeRotX = 0;
  let knifeRotZ = 0;
  let knifeOffY = 0;
  if (currentWeaponType === "knife") {
    knifeSwingTimer = Math.max(0, knifeSwingTimer - delta);
    if (knifeSwingTimer > 0) {
      const t = 1 - knifeSwingTimer / KNIFE.swingInterval; // 0 -> 1
      const arc = Math.sin(t * Math.PI); // rise and fall
      knifeRotX = -1.1 * arc; // swing down/forward
      knifeRotZ = -0.5 * arc; // diagonal slash
      knifeOffY = 0.08 * arc;
    }
  }

  // Grenade throw animation (wind up + release).
  let throwOffY = 0;
  let throwRotX = 0;
  if (currentWeaponType === "grenade") {
    throwAnimTimer = Math.max(0, throwAnimTimer - delta);
    if (throwAnimTimer > 0) {
      const t = 1 - throwAnimTimer / 0.5;
      const arc = Math.sin(t * Math.PI);
      throwOffY = 0.12 * arc;
      throwRotX = -0.9 * arc;
    }
  }

  // Apply final weapon transform.
  weapon.position.set(
    baseX + weaponSwayX + weaponBobX,
    baseY + weaponSwayY + weaponBobY + reloadOffsetY + knifeOffY + throwOffY,
    baseZ + weaponKickZ,
  );
  weapon.rotation.set(
    reloadRotX + weaponSwayY * 0.5 + knifeRotX + throwRotX,
    (isRifle ? 0.02 : currentWeaponType === "knife" ? -0.12 : 0.1) + weaponSwayX * 0.3,
    weaponSwayX * 0.4 + Math.sin(gameTime * 2.8) * 0.003 * (1 - adsLerp) + knifeRotZ,
  );

  // Recoil recovery (rifle only).
  if (isRifle) {
    const recover = delta * (selectedWeapon === WEAPONS.sniper ? 0.09 : 0.2);
    recoilPitch = Math.max(0, recoilPitch - recover);
    recoilYaw += (0 - recoilYaw) * Math.min(1, delta * 8);
    if (!firing && recoilPitch < 0.005) {
      recoilIndex = 0;
    }
  }

  // Shell casing physics.
  for (const shell of shellPool) {
    if (shell.life <= 0) continue;
    shell.life -= delta;
    shell.vel.y -= 12 * delta; // gravity
    shell.mesh.position.addScaledVector(shell.vel, delta);
    shell.mesh.rotation.x += shell.rotVel.x * delta;
    shell.mesh.rotation.z += shell.rotVel.z * delta;
    if (shell.mesh.position.y < 0.01) {
      shell.mesh.position.y = 0.01;
      shell.vel.y *= -0.3;
      shell.vel.x *= 0.6;
      shell.vel.z *= 0.6;
      shell.rotVel.multiplyScalar(0.5);
    }
    if (shell.life <= 0) {
      shell.mesh.visible = false;
    } else if (shell.life < 0.3) {
      shell.mesh.material.opacity = shell.life / 0.3;
      shell.mesh.material.transparent = true;
    }
  }

  // Bullet hole life decay.
  for (let i = bulletHoles.length - 1; i >= 0; i--) {
    bulletHoles[i].life -= delta;
    if (bulletHoles[i].life < 2) {
      bulletHoles[i].mesh.material.opacity = bulletHoles[i].life / 2 * 0.7;
    }
    if (bulletHoles[i].life <= 0) {
      scene.remove(bulletHoles[i].mesh);
      bulletHoles.splice(i, 1);
    }
  }

  // Crosshair spread indicator.
  if (ui.crosshair) {
    const wide = firing || player.velocity.lengthSq() > 0.0001 || recoilPitch > 0.02 || !grounded;
    ui.crosshair.classList.toggle("is-wide", wide);
    ui.crosshair.classList.toggle("is-ads", adsLerp > 0.7);
  }
}

function initRadarDots() {
  if (!ui.radar) return;
  for (let i = 0; i < 16; i += 1) {
    const dot = document.createElement("span");
    dot.className = "radar-dot";
    dot.style.visibility = "hidden";
    ui.radar.appendChild(dot);
    radarDots.push(dot);
  }
}

function updateRadar() {
  if (!ui.radar) return;
  const scale = 1.6;
  for (let i = 0; i < radarDots.length; i += 1) {
    const dot = radarDots[i];
    const bot = bots[i];
    if (!bot) {
      if (dot.style.visibility !== "hidden") dot.style.visibility = "hidden";
      continue;
    }
    const x = 69 + (bot.group.position.x - camera.position.x) * scale;
    const y = 69 + (bot.group.position.z - camera.position.z) * scale;
    if (x < 6 || x > 132 || y < 6 || y > 132) {
      if (dot.style.visibility !== "hidden") dot.style.visibility = "hidden";
      continue;
    }
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    if (dot.style.visibility !== "visible") dot.style.visibility = "visible";
  }
}

function setHudText(key, element, value) {
  if (!element || hudCache[key] === value) return;
  hudCache[key] = value;
  element.textContent = value;
}

// Inventory / backpack HUD: weapon slots + grenade count.
function updateInventoryHud() {
  const slots = {
    rifle: document.querySelector("#slotRifle"),
    knife: document.querySelector("#slotKnife"),
    grenade: document.querySelector("#slotGrenade"),
  };
  Object.entries(slots).forEach(([type, el]) => {
    if (el) el.classList.toggle("is-active", currentWeaponType === type);
  });
  const grenadeCountEl = document.querySelector("#grenadeCount");
  if (grenadeCountEl) setHudText("grenadeCount", grenadeCountEl, String(grenadeCount));
  // Ammo readout reflects the active weapon.
  if (currentWeaponType === "knife") {
    setHudText("ammo", ui.ammo, "—");
    setHudText("reserve", ui.reserve, "近战");
  } else if (currentWeaponType === "grenade") {
    setHudText("ammo", ui.ammo, String(grenadeCount));
    setHudText("reserve", ui.reserve, "投掷");
  } else {
    setHudText("ammo", ui.ammo, String(ammo));
    setHudText("reserve", ui.reserve, String(reserve));
  }
}

function updateHud() {
  setHudText("kills", ui.kills, String(kills));
  setHudText("wave", ui.wave, String(wave));
  setHudText("streak", ui.streak, String(streak));
  updateInventoryHud();
  if (ui.weaponName) {
    const weaponLabel =
      currentWeaponType === "knife"
        ? KNIFE.name
        : currentWeaponType === "grenade"
          ? `${GRENADE.name} (${grenadeCount})`
          : selectedWeapon.name;
    setHudText("weaponName", ui.weaponName, weaponLabel);
  }
  const healthRounded = String(Math.round(health));
  setHudText("healthText", ui.healthText, healthRounded);
  const healthWidth = `${health}%`;
  if (hudCache.healthWidth !== healthWidth) {
    hudCache.healthWidth = healthWidth;
    ui.healthFill.style.width = healthWidth;
  }
  const healthBackground =
    health > 45
      ? "linear-gradient(90deg, var(--green), var(--cyan))"
      : "linear-gradient(90deg, var(--red), var(--gold))";
  if (hudCache.healthBackground !== healthBackground) {
    hudCache.healthBackground = healthBackground;
    ui.healthFill.style.background = healthBackground;
  }
  // Stamina bar.
  const staminaWidth = `${Math.round(stamina)}%`;
  if (hudCache.staminaWidth !== staminaWidth) {
    hudCache.staminaWidth = staminaWidth;
    if (ui.staminaFill) ui.staminaFill.style.width = staminaWidth;
  }
  updateBoards();
}

function getAccuracy() {
  return shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
}

function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateBoards() {
  if (ui.boardMode) ui.boardMode.textContent = selectedMode.name;
  if (ui.boardKills) ui.boardKills.textContent = String(kills);
  if (ui.boardAccuracy) ui.boardAccuracy.textContent = `${getAccuracy()}%`;
  if (ui.boardBestStreak) ui.boardBestStreak.textContent = String(bestStreak);
}

function endMatch(title) {
  if (matchEnded) return;
  matchEnded = true;
  firing = false;
  paused = true;
  if (document.pointerLockElement === ui.canvas) document.exitPointerLock();
  if (ui.resultTitle) ui.resultTitle.textContent = title;
  if (ui.resultKills) ui.resultKills.textContent = String(kills);
  if (ui.resultAccuracy) ui.resultAccuracy.textContent = `${getAccuracy()}%`;
  if (ui.resultBestStreak) ui.resultBestStreak.textContent = String(bestStreak);
  if (ui.resultTime) ui.resultTime.textContent = formatTime(performance.now() - matchStartedAt);
  ui.result?.classList.add("is-visible");
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (!paused) {
    gameTime += delta;
    fireCooldown = Math.max(0, fireCooldown - delta);
    if (firing && currentWeaponType === "rifle") shoot();
    updatePlayer(delta);
    updateBots(delta);
    updateGrenades(delta);
    updateDecals(delta);
    // Decay mouse velocity for weapon sway.
    lastMouseX *= Math.max(0, 1 - delta * 8);
    lastMouseY *= Math.max(0, 1 - delta * 8);
    updateWeapon(delta);
    updateRadar();
    // Sync third-person model to the player (feet at camera minus eye height).
    if (playerModel) {
      playerModel.position.set(camera.position.x, camera.position.y - EYE_HEIGHT, camera.position.z);
      playerModel.rotation.y = yaw + Math.PI;
    }
    // Update stamina bar every frame (continuous change).
    if (ui.staminaFill) {
      const w = `${Math.round(stamina)}%`;
      if (hudCache.staminaWidth !== w) {
        hudCache.staminaWidth = w;
        ui.staminaFill.style.width = w;
      }
    }
  }
  if (viewMode === "tps") {
    // Pull the render camera back along the view direction; restore after render
    // so all game logic stays anchored to camera.position.
    const back = new THREE.Vector3();
    camera.getWorldDirection(back);
    camera.position.addScaledVector(back, -TP_DISTANCE);
    camera.position.y += 0.4;
    renderer.render(scene, camera);
    camera.position.addScaledVector(back, TP_DISTANCE);
    camera.position.y -= 0.4;
  } else {
    renderer.render(scene, camera);
  }
}

function bindEvents() {
  ui.start.addEventListener("click", async () => {
    if (!started) {
      started = true;
      matchStartedAt = performance.now();
      ui.boot.classList.add("is-hidden");
      ensureAudio();
      showToast("点击画面锁定鼠标，开始训练");
    }
    try {
      await ui.canvas.requestPointerLock();
    } catch (error) {
      showToast("浏览器阻止了鼠标锁定，请再点一次画面");
    }
  });

  ui.canvas.addEventListener("click", () => {
    if (started && document.pointerLockElement !== ui.canvas) {
      ui.canvas.requestPointerLock().catch(() => {
        showToast("请再点一次画面锁定鼠标");
      });
    }
  });

  document.addEventListener("pointerlockchange", () => {
    paused = document.pointerLockElement !== ui.canvas;
    if (!paused) {
      ui.settings?.classList.remove("is-visible");
      showToast("训练开始");
    } else if (started && !matchEnded && ui.boot.classList.contains("is-hidden")) {
      ui.settings?.classList.add("is-visible");
    }
  });

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mouseup", (event) => {
    if (event.button === 0) firing = false;
    if (event.button === 2) adsActive = false;
  });
  document.addEventListener("contextmenu", (event) => {
    if (started && !paused) event.preventDefault();
  });
  document.addEventListener("keydown", (event) => {
    if (event.code === "Tab") {
      event.preventDefault();
      ui.scoreboard?.classList.add("is-visible");
    }
    if (document.pointerLockElement === ui.canvas) {
      if (event.code === "Space") event.preventDefault();
      if (event.code === "ControlLeft" || event.code === "ControlRight") event.preventDefault();
    }
    keys.add(event.code);
    if (event.code === "KeyR") reload();
    if (event.code === "Digit1") switchWeapon("rifle");
    if (event.code === "Digit2") switchWeapon("knife");
    if (event.code === "Digit3") switchWeapon("grenade");
    if (event.code === "KeyV") toggleViewMode();
  });
  document.addEventListener("keyup", (event) => {
    if (event.code === "Tab") ui.scoreboard?.classList.remove("is-visible");
    keys.delete(event.code);
  });
  ui.reload.addEventListener("click", reload);
  ui.sensitivity?.addEventListener("input", () => {
    sensitivity = Number(ui.sensitivity.value);
  });
  ui.volume?.addEventListener("input", () => {
    masterVolume = Number(ui.volume.value);
  });
  ui.quality?.addEventListener("change", () => {
    const low = ui.quality.checked;
    renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 1.8));
    renderer.shadowMap.enabled = !low;
    showToast(low ? "性能模式已开启" : "画质模式已开启");
  });
  ui.resume?.addEventListener("click", () => {
    ui.settings?.classList.remove("is-visible");
    ui.canvas.requestPointerLock().catch(() => showToast("请点击画面继续"));
  });
  ui.restart?.addEventListener("click", () => {
    window.location.reload();
  });
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function enableDemoMode() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("demo")) return;
  started = true;
  paused = false;
  matchStartedAt = performance.now();
  ui.boot.classList.add("is-hidden");
  showToast("演示模式：训练场已载入");
}

async function main() {
  const bootLoading = document.querySelector("#bootLoading");
  const bootCardText = document.querySelector("#bootDesc");
  const originalBootText = bootCardText ? bootCardText.textContent : "";
  try {
    if (params.has("demo")) ui.boot.classList.add("is-hidden");
    THREE = await loadThree();
    if (bootLoading) bootLoading.style.display = "none";
    if (bootCardText) bootCardText.textContent = originalBootText;
    if (ui.start) ui.start.disabled = false;
    initScene();
    bindEvents();
    enableDemoMode();
    animate();
    window.__strikeArenaReady = true;
    document.documentElement.dataset.strikeArena = "ready";
  } catch (error) {
    console.error(error);
    window.__strikeArenaError = error.message;
    document.documentElement.dataset.strikeArena = "error";
    if (bootLoading) bootLoading.style.display = "none";
    if (bootCardText) bootCardText.textContent = error.message;
    ui.start.disabled = true;
    ui.start.textContent = "加载失败";
  }
}

main();
