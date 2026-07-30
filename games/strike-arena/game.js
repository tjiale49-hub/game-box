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
};

let THREE;
let scene;
let camera;
let renderer;
let clock;
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

function makeMaterial(color, roughness = 0.55, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

  const wallData = [
    [0, 2.5, -43, 86, 5, 1],
    [0, 2.5, 43, 86, 5, 1],
    [-43, 2.5, 0, 1, 5, 86],
    [43, 2.5, 0, 1, 5, 86],
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
  const shell = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 0.9, 6, 14),
    new THREE.MeshStandardMaterial({
      color: 0xff4567,
      roughness: 0.32,
      metalness: 0.18,
      emissive: 0x3d0712,
    }),
  );
  shell.castShadow = true;
  group.add(shell);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.12, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x18f5ff }),
  );
  visor.position.set(0, 0.25, -0.42);
  group.add(visor);

  const spawn = randomSpawnPoint();
  group.position.set(spawn.x, 1.05, spawn.z);
  scene.add(group);

  const bot = {
    group,
    health: selectedMode.botHealth + wave * 8,
    speed: selectedMode.botSpeed + Math.random() * 0.45 + wave * 0.025,
    nextShot: Math.random() * 2,
    strafe: Math.random() > 0.5 ? 1 : -1,
  };
  bots.push(bot);
  botMeshes.push(shell);
}

function randomSpawnPoint() {
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
  yaw -= event.movementX * 0.0022;
  pitch -= event.movementY * 0.002;
  pitch = Math.max(-1.25, Math.min(1.18, pitch));
}

function onMouseDown(event) {
  if (!started || paused) return;
  if (event.button === 0) shoot();
}

function shoot() {
  if (reloading || fireCooldown > 0) return;
  if (ammo <= 0) {
    reload();
    showToast("弹匣空了，正在换弹");
    return;
  }

  ammo -= 1;
  fireCooldown = selectedWeapon.fireRate;
  lastShotAt = performance.now();
  muzzleLight.intensity = selectedWeapon === WEAPONS.sniper ? 56 : 38;
  weapon.position.z = 0.045;
  pitch += selectedWeapon.recoil + Math.random() * selectedWeapon.recoil * 0.45;
  yaw += (Math.random() - 0.5) * selectedWeapon.recoil * 0.7;

  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hits = raycaster.intersectObjects(botMeshes, false);
  if (hits.length) {
    const mesh = hits[0].object;
    const bot = bots.find((item) => item.group.children.includes(mesh));
    if (bot) {
      const critical = hits[0].point.y - bot.group.position.y > 0.22;
      bot.health -= critical ? selectedWeapon.critical : selectedWeapon.damage;
      spawnTracer(hits[0].point, critical ? 0xffd166 : selectedWeapon.tracer);
      spawnImpact(hits[0].point, critical ? 0xffd166 : selectedMap.glow);
      showHitmarker();
      if (bot.health <= 0) {
        removeBot(bot);
        kills += 1;
        streak += 1;
        reserve = Math.min(selectedWeapon.reserve * 2, reserve + Math.round(8 * selectedMode.reserveScale));
        showToast(critical ? "精准命中 +1" : "BOT 击破 +1");
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

  const next = camera.position.clone().add(move);
  next.x = Math.max(-40, Math.min(40, next.x));
  next.z = Math.max(-40, Math.min(40, next.z));
  if (!collides(next)) {
    camera.position.x = next.x;
    camera.position.z = next.z;
  }
  const bob = Math.sin(performance.now() * 0.009) * (move.lengthSq() > 0 ? 0.018 : 0.004);
  camera.position.y = player.height + bob;
  camera.rotation.set(pitch, yaw, 0);
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
    bot.group.position.copy(next);
    bot.group.lookAt(camera.position.x, bot.group.position.y, camera.position.z);
    bot.group.position.y = 1.05 + Math.sin(performance.now() * 0.004 + bot.speed) * 0.08;

    bot.nextShot -= delta;
    if (distance < 24 && bot.nextShot <= 0) {
      damagePlayer(selectedMode.damage + Math.floor(wave * 0.8));
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
  health = Math.max(0, health - amount);
  streak = 0;
  ui.damage.classList.add("is-visible");
  window.clearTimeout(damagePlayer.timer);
  damagePlayer.timer = window.setTimeout(() => ui.damage.classList.remove("is-visible"), 130);
  if (health <= 0) {
    health = 100;
    ammo = selectedWeapon.mag;
    reserve = Math.round(selectedWeapon.reserve * selectedMode.reserveScale);
    camera.position.set(...selectedMap.spawn);
    showToast("训练失败，已重新部署");
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
  const swayX = Math.sin(performance.now() * 0.003) * 0.006;
  weapon.rotation.z = swayX;
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
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (!paused) {
    fireCooldown = Math.max(0, fireCooldown - delta);
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
      ui.boot.classList.add("is-hidden");
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
    if (!paused) showToast("训练开始");
  });

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("keydown", (event) => {
    keys.add(event.code);
    if (event.code === "KeyR") reload();
  });
  document.addEventListener("keyup", (event) => keys.delete(event.code));
  ui.reload.addEventListener("click", reload);
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
  ui.boot.classList.add("is-hidden");
  showToast("演示模式：训练场已载入");
}

async function main() {
  try {
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
