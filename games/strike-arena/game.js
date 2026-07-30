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
let scenicTexture;
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

const bots = [];
const botMeshes = [];
const obstacles = [];
const decals = [];
const keys = new Set();
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

function playShotSound() {
  const base = selectedWeapon === WEAPONS.sniper ? 82 : selectedWeapon === WEAPONS.smg ? 190 : 145;
  playTone(base, selectedWeapon === WEAPONS.sniper ? 0.18 : 0.1, "sawtooth", selectedWeapon === WEAPONS.sniper ? 0.34 : 0.24);
  playTone(base * 2.6, 0.045, "square", 0.08);
}

function playHitSound(critical) {
  playTone(critical ? 980 : 620, 0.08, "sine", critical ? 0.16 : 0.1);
}

function playReloadSound() {
  playTone(240, 0.08, "triangle", 0.12);
  window.setTimeout(() => playTone(420, 0.08, "triangle", 0.1), 210);
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
  scenicTexture = textureLoader.load("../../assets/strike-arena-hero.png");
  enemyTextures = [
    "../../assets/strike-enemy-operator-game.png",
    "../../assets/strike-enemy-scout-game.png",
    "../../assets/strike-enemy-heavy-game.png",
  ].map((src) => textureLoader.load(src, (texture) => {
    texture.needsUpdate = true;
  }));
  enemyActionTexture = textureLoader.load("../../assets/strike-enemy-action-game.png", (texture) => {
    texture.needsUpdate = true;
  });
  enemyTexture = enemyTextures[0];
  [scenicTexture, enemyActionTexture, ...enemyTextures].forEach((texture) => {
    if (colorSpace) texture.colorSpace = colorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });
}

function createGroundMaterial() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = `#${selectedMap.ground.toString(16).padStart(6, "0")}`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 1800; i += 1) {
    const shade = 34 + Math.floor(Math.random() * 44);
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.05 + Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  for (let i = 0; i < 24; i += 1) {
    ctx.strokeStyle = `rgba(255,255,255,${0.025 + Math.random() * 0.05})`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, Math.random() * 256);
    ctx.lineTo(Math.random() * 256, Math.random() * 256);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.04,
  });
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(selectedMap.sky);
  scene.fog = new THREE.FogExp2(selectedMap.fog, selectedMode === MODES.sniper ? 0.016 : 0.025);

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
  ammo = selectedWeapon.mag;
  reserve = Math.round(selectedWeapon.reserve * selectedMode.reserveScale);

  const hemi = new THREE.HemisphereLight(0xd9e6ff, selectedMap.ground, 1.05);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-12, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);

  const cyan = new THREE.PointLight(selectedMap.glow, 58, 30);
  cyan.position.set(8, 5, -8);
  scene.add(cyan);

  applyScenarioText();
  createArena();
  createWeapon();
  spawnWave();
  updateHud();
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
}

function createArena() {
  createCinematicBackdrop();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(86, 86, 1, 1),
    createGroundMaterial(),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(86, 43, selectedMap.glow, 0x1d2227);
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
    [0, wallHeight / 2, -43, 86, wallHeight, 1],
    [0, wallHeight / 2, 43, 86, wallHeight, 1],
    [-43, wallHeight / 2, 0, 1, wallHeight, 86],
    [43, wallHeight / 2, 0, 1, wallHeight, 86],
  ];
  wallData.forEach((data) => addBox(data, wallMat, false));

  const blocks = [
    [-16, 1.4, -15, 8, 2.8, 4],
    [12, 1.6, -13, 5, 3.2, 8],
    [0, 1.25, 0, 9, 2.5, 3],
    [-20, 1.1, 12, 4, 2.2, 8],
    [18, 1.1, 14, 10, 2.2, 3],
    [0, 2.2, 24, 7, 4.4, 5],
    [27, 1.5, -26, 4, 3, 9],
    [-30, 1.5, -24, 6, 3, 5],
  ];
  blocks.forEach((data, index) => {
    const mesh = addBox(data, index % 3 === 0 ? accentMat : wallMat, true);
    if (index % 3 === 0) addContainerRibs(mesh, data);
  });

  for (let i = 0; i < 20; i += 1) {
    const h = 2 + Math.random() * 7;
    const x = -38 + Math.random() * 76;
    const z = -38 + Math.random() * 76;
    if (Math.abs(x) < 8 && z > 8) continue;
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
  if (!selectedMap.nature) return;
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(96, 54),
    new THREE.MeshBasicMaterial({
      map: scenicTexture,
      color: 0xffffff,
      transparent: true,
      opacity: selectedMap.nature === "forest" ? 0.92 : 0.76,
      depthWrite: false,
    }),
  );
  backdrop.position.set(0, 18, -42.6);
  backdrop.renderOrder = -20;
  scene.add(backdrop);

  const duskVeil = new THREE.Mesh(
    new THREE.PlaneGeometry(96, 54),
    new THREE.MeshBasicMaterial({
      color: selectedMap.nature === "snow" ? 0xcad7dc : 0x07110d,
      transparent: true,
      opacity: selectedMap.nature === "forest" ? 0.1 : 0.16,
      depthWrite: false,
    }),
  );
  duskVeil.position.set(0, 18, -42.4);
  duskVeil.renderOrder = -19;
  scene.add(duskVeil);

  const ridgeMat = new THREE.MeshBasicMaterial({
    color: selectedMap.nature === "snow" ? 0x233444 : 0x07140e,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  for (let i = 0; i < 3; i += 1) {
    const ridge = new THREE.Mesh(new THREE.PlaneGeometry(64 - i * 10, 10 + i * 2), ridgeMat.clone());
    ridge.position.set((i - 1) * 17, 5 + i * 1.2, -41.9 + i * 0.2);
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

function createGrassCluster(x, z, scale = 1) {
  const color = selectedMap.nature === "snow" ? 0xcbd6d8 : selectedMap.nature === "harbor" ? 0x293f3a : 0x2e4f2f;
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: selectedMap.nature === "snow" ? 0.62 : 0.88,
  });
  const bladeCount = selectedMap.nature === "quarry" ? 4 : 7;
  for (let i = 0; i < bladeCount; i += 1) {
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.08 * scale, (0.55 + Math.random() * 0.65) * scale), mat);
    blade.position.set(x + (Math.random() - 0.5) * 0.7 * scale, 0.22 * scale, z + (Math.random() - 0.5) * 0.7 * scale);
    blade.rotation.y = Math.random() * Math.PI;
    blade.rotation.z = (Math.random() - 0.5) * 0.42;
    blade.castShadow = true;
    scene.add(blade);
  }
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
  for (let i = 0; i < grassCount; i += 1) {
    const x = -38 + Math.random() * 76;
    const z = -38 + Math.random() * 76;
    if (Math.abs(x - camera.position.x) < 3 && Math.abs(z - camera.position.z) < 4) continue;
    createGrassCluster(x, z, 0.65 + Math.random() * 1.1);
  }
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

function createWeapon() {
  weapon = new THREE.Group();
  const gunMat = makeMaterial(0x10151d, 0.3, 0.65);
  const gripMat = makeMaterial(0x222c38, 0.5, 0.2);
  const glowMat = new THREE.MeshBasicMaterial({ color: selectedMap.glow });
  const isSniper = selectedWeapon === WEAPONS.sniper;
  const isSmg = selectedWeapon === WEAPONS.smg;

  const body = new THREE.Mesh(new THREE.BoxGeometry(isSniper ? 0.3 : 0.34, 0.22, isSniper ? 1.45 : isSmg ? 0.82 : 1.1), gunMat);
  body.position.set(0.32, -0.28, -0.72);
  weapon.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, isSniper ? 1.12 : 0.78, 18), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.32, -0.23, isSniper ? -1.72 : -1.48);
  weapon.add(barrel);

  if (isSniper) {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 24), gunMat);
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0.32, -0.08, -0.8);
    weapon.add(scope);
  }

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.22), gripMat);
  grip.position.set(0.28, -0.58, -0.55);
  grip.rotation.x = -0.22;
  weapon.add(grip);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.54), glowMat);
  rail.position.set(0.32, -0.13, -0.85);
  weapon.add(rail);

  muzzleLight = new THREE.PointLight(selectedWeapon.tracer, 0, 7);
  muzzleLight.position.set(0.32, -0.22, isSniper ? -2.16 : -1.86);
  weapon.add(muzzleLight);

  camera.add(weapon);
  scene.add(camera);
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
  const actionTexture = enemyActionTexture || botTexture;
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
    visualBaseScale: visual ? visual.scale.clone() : null,
    hitReact: 0,
    lastDistance: 999,
    health: selectedMode.botHealth + wave * 8,
    speed: selectedMode.botSpeed + Math.random() * 0.45 + wave * 0.025,
    nextShot: Math.random() * 2,
    strafe: Math.random() > 0.5 ? 1 : -1,
  };
  bots.push(bot);
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
    spawn.x = Math.max(-34, Math.min(34, spawn.x));
    spawn.z = Math.max(-34, Math.min(34, spawn.z));
    return spawn;
  }
  for (let i = 0; i < 50; i += 1) {
    const x = -34 + Math.random() * 68;
    const z = -34 + Math.random() * 68;
    if (camera.position.distanceTo(new THREE.Vector3(x, player.height, z)) > 15) {
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
}

function onMouseDown(event) {
  if (!started || paused) return;
  if (event.button === 0) {
    firing = true;
    shoot();
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
  muzzleLight.intensity = selectedWeapon === WEAPONS.sniper ? 56 : 38;
  weapon.position.z = 0.045;
  recoilPitch += selectedWeapon.recoil + Math.random() * selectedWeapon.recoil * 0.45;
  recoilYaw += (Math.random() - 0.5) * selectedWeapon.recoil * 0.7;
  playShotSound();

  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const moving = player.velocity.lengthSq() > 0.0001;
  const spread = (moving ? 0.014 : 0.004) + recoilPitch * 0.65;
  raycaster.ray.direction.x += (Math.random() - 0.5) * spread;
  raycaster.ray.direction.y += (Math.random() - 0.5) * spread;
  raycaster.ray.direction.normalize();
  const hits = raycaster.intersectObjects(botMeshes, false);
  if (hits.length) {
    const mesh = hits[0].object;
    const bot = bots.find((item) => item.group.children.includes(mesh));
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
    const end = camera.position.clone().add(raycaster.ray.direction.clone().multiplyScalar(38));
    spawnTracer(end, 0xffffff);
  }
  updateHud();
}

function spawnTracer(point, color) {
  const start = camera.localToWorld(new THREE.Vector3(0.32, -0.22, -1.86));
  const direction = point.clone().sub(start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(0.012, 0.012, length, 8);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.8,
  });
  const tracer = new THREE.Mesh(geometry, material);
  tracer.position.copy(start.clone().add(point).multiplyScalar(0.5));
  tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  scene.add(tracer);
  decals.push({ mesh: tracer, life: 0.06 });
}

function spawnImpact(point, color) {
  const sparkMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88 });
  for (let i = 0; i < 5; i += 1) {
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.38), sparkMat.clone());
    spark.position.copy(point);
    spark.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    scene.add(spark);
    decals.push({ mesh: spark, life: 0.12 + Math.random() * 0.08 });
  }
}

function showHitmarker() {
  ui.hitmarker.classList.add("is-visible");
  window.clearTimeout(showHitmarker.timer);
  showHitmarker.timer = window.setTimeout(() => ui.hitmarker.classList.remove("is-visible"), 110);
}

function removeBot(bot) {
  const index = bots.indexOf(bot);
  if (index >= 0) bots.splice(index, 1);
  bot.group.traverse((child) => {
    if (child.isMesh) {
      const meshIndex = botMeshes.indexOf(child);
      if (meshIndex >= 0) botMeshes.splice(meshIndex, 1);
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
  const speed = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 7.1 : 4.8) * weight;
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
  next.x = Math.max(-40, Math.min(40, next.x));
  next.z = Math.max(-40, Math.min(40, next.z));
  if (!collides(next)) {
    camera.position.x = next.x;
    camera.position.z = next.z;
  }
  const bob = Math.sin(performance.now() * 0.009) * (move.lengthSq() > 0 ? 0.018 : 0.004);
  camera.position.y = player.height + bob;
  camera.rotation.set(pitch + recoilPitch, yaw + recoilYaw, 0);
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
    const toPlayer = camera.position.clone().sub(bot.group.position);
    const distance = toPlayer.length();
    toPlayer.y = 0;
    const dir = toPlayer.normalize();
    const tangent = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(bot.strafe);
    const desired = dir.multiplyScalar(distance > 8 ? 1 : -0.2).add(tangent.multiplyScalar(0.42));
    if (desired.lengthSq() > 0) desired.normalize();
    const next = bot.group.position.clone().add(desired.multiplyScalar(bot.speed * delta));
    next.x = Math.max(-38, Math.min(38, next.x));
    next.z = Math.max(-38, Math.min(38, next.z));
    if (botCollides(next)) {
      const side = bot.group.position.clone().add(tangent.normalize().multiplyScalar(bot.speed * delta * 1.8));
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
    if (bot.visual && bot.visualBaseScale) {
      const aiming = distance < 24;
      if (bot.visualMaterial && bot.actionTexture && bot.idleTexture) {
        const nextTexture = aiming || movingAmount ? bot.actionTexture : bot.idleTexture;
        if (bot.visualMaterial.map !== nextTexture) {
          bot.visualMaterial.map = nextTexture;
          bot.visualMaterial.needsUpdate = true;
        }
      }
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

    bot.nextShot -= delta;
    if (distance < 24 && bot.nextShot <= 0 && !lineBlocked(bot.group.position.clone().add(new THREE.Vector3(0, 1.35, 0)), camera.position)) {
      damagePlayer(selectedMode.damage + Math.floor(wave * 0.8));
      pushKillfeed("敌方步兵 命中 <b>你</b>");
      bot.nextShot = 1.2 + Math.random() * 1.1;
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
    decals[i].life -= delta;
    decals[i].mesh.material.opacity = Math.max(0, decals[i].life * 12);
    if (decals[i].life <= 0) {
      scene.remove(decals[i].mesh);
      decals.splice(i, 1);
    }
  }
}

function updateWeapon(delta) {
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - delta * 180);
  weapon.position.z += (0 - weapon.position.z) * Math.min(1, delta * 18);
  const recover = delta * (selectedWeapon === WEAPONS.sniper ? 0.09 : 0.18);
  recoilPitch = Math.max(0, recoilPitch - recover);
  recoilYaw += (0 - recoilYaw) * Math.min(1, delta * 7);
  const swayX = Math.sin(gameTime * 2.8) * 0.006;
  weapon.rotation.z = swayX;
  if (ui.crosshair) {
    const wide = firing || player.velocity.lengthSq() > 0.0001 || recoilPitch > 0.02;
    ui.crosshair.classList.toggle("is-wide", wide);
  }
}

function updateRadar() {
  ui.radar.querySelectorAll(".radar-dot").forEach((dot) => dot.remove());
  bots.forEach((bot) => {
    const dx = bot.group.position.x - camera.position.x;
    const dz = bot.group.position.z - camera.position.z;
    const scale = 1.6;
    const x = 69 + dx * scale;
    const y = 69 + dz * scale;
    if (x < 6 || x > 132 || y < 6 || y > 132) return;
    const dot = document.createElement("span");
    dot.className = "radar-dot";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    ui.radar.appendChild(dot);
  });
}

function updateHud() {
  ui.kills.textContent = String(kills);
  ui.wave.textContent = String(wave);
  ui.streak.textContent = String(streak);
  ui.ammo.textContent = String(ammo);
  ui.reserve.textContent = String(reserve);
  if (ui.weaponName) ui.weaponName.textContent = selectedWeapon.name;
  ui.healthText.textContent = String(Math.round(health));
  ui.healthFill.style.width = `${health}%`;
  ui.healthFill.style.background =
    health > 45
      ? "linear-gradient(90deg, var(--green), var(--cyan))"
      : "linear-gradient(90deg, var(--red), var(--gold))";
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
    if (firing) shoot();
    updatePlayer(delta);
    updateBots(delta);
    updateDecals(delta);
    updateWeapon(delta);
    updateRadar();
  }
  renderer.render(scene, camera);
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
  });
  document.addEventListener("keydown", (event) => {
    if (event.code === "Tab") {
      event.preventDefault();
      ui.scoreboard?.classList.add("is-visible");
    }
    keys.add(event.code);
    if (event.code === "KeyR") reload();
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
  try {
    if (params.has("demo")) ui.boot.classList.add("is-hidden");
    THREE = await loadThree();
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
    document.querySelector(".boot-card p").textContent = error.message;
    ui.start.disabled = true;
    ui.start.textContent = "加载失败";
  }
}

main();
