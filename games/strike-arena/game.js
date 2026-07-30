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

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b13);
  scene.fog = new THREE.FogExp2(0x070b13, 0.028);

  camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 600);
  camera.rotation.order = "YXZ";
  camera.position.set(0, player.height, 18);

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

  const hemi = new THREE.HemisphereLight(0x8ecfff, 0x1a1020, 1.3);
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

  const cyan = new THREE.PointLight(0x18f5ff, 80, 26);
  cyan.position.set(8, 5, -8);
  scene.add(cyan);

  createArena();
  createWeapon();
  spawnWave();
  updateHud();
}

function createArena() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(86, 86, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x141b26,
      roughness: 0.7,
      metalness: 0.12,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(86, 43, 0x18f5ff, 0x273244);
  grid.material.opacity = 0.22;
  grid.material.transparent = true;
  scene.add(grid);

  const wallMat = makeMaterial(0x273447, 0.42, 0.2);
  const accentMat = makeMaterial(0x18f5ff, 0.3, 0.35);

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
    addBox(data, index % 3 === 0 ? accentMat : wallMat, true);
  });

  for (let i = 0; i < 18; i += 1) {
    const h = 2 + Math.random() * 7;
    const x = -38 + Math.random() * 76;
    const z = -38 + Math.random() * 76;
    if (Math.abs(x) < 8 && z > 8) continue;
    addBox([x, h / 2, z, 1.1, h, 1.1], makeMaterial(0x233142, 0.45, 0.3), false);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(17, 0.08, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0x18f5ff }),
  );
  ring.position.set(0, 0.08, 0);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
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

function createWeapon() {
  weapon = new THREE.Group();
  const gunMat = makeMaterial(0x10151d, 0.3, 0.65);
  const gripMat = makeMaterial(0x222c38, 0.5, 0.2);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x18f5ff });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 1.1), gunMat);
  body.position.set(0.32, -0.28, -0.72);
  weapon.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.78, 18), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.32, -0.23, -1.48);
  weapon.add(barrel);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.22), gripMat);
  grip.position.set(0.28, -0.58, -0.55);
  grip.rotation.x = -0.22;
  weapon.add(grip);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.54), glowMat);
  rail.position.set(0.32, -0.13, -0.85);
  weapon.add(rail);

  muzzleLight = new THREE.PointLight(0xffd166, 0, 7);
  muzzleLight.position.set(0.32, -0.22, -1.86);
  weapon.add(muzzleLight);

  camera.add(weapon);
  scene.add(camera);
}

function spawnWave() {
  const count = Math.min(4 + wave, 12);
  for (let i = 0; i < count; i += 1) {
    spawnBot();
  }
  showToast(`第 ${wave} 波 BOT 已进入训练场`);
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
    health: 100 + wave * 10,
    speed: 1.2 + Math.random() * 0.5 + wave * 0.03,
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
  fireCooldown = 0.115;
  lastShotAt = performance.now();
  muzzleLight.intensity = 38;
  weapon.position.z = 0.045;
  pitch += 0.009 + Math.random() * 0.004;

  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hits = raycaster.intersectObjects(botMeshes, false);
  if (hits.length) {
    const mesh = hits[0].object;
    const bot = bots.find((item) => item.group.children.includes(mesh));
    if (bot) {
      const critical = hits[0].point.y - bot.group.position.y > 0.22;
      bot.health -= critical ? 72 : 38;
      spawnTracer(hits[0].point, critical ? 0xffd166 : 0x18f5ff);
      showHitmarker();
      if (bot.health <= 0) {
        removeBot(bot);
        kills += 1;
        streak += 1;
        reserve = Math.min(150, reserve + 8);
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
  if (reloading || ammo === 30 || reserve <= 0) return;
  reloading = true;
  showToast("换弹中...");
  setTimeout(() => {
    const need = 30 - ammo;
    const take = Math.min(need, reserve);
    ammo += take;
    reserve -= take;
    reloading = false;
    showToast("换弹完成");
    updateHud();
  }, 1050);
}

function updatePlayer(delta) {
  const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 7.1 : 4.8;
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
      damagePlayer(6 + wave);
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
    ammo = 30;
    reserve = 90;
    camera.position.set(0, player.height, 18);
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
