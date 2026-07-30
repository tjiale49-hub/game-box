const games = [
  {
    title: "高能突击训练场",
    status: "可玩",
    state: "ready",
    category: "action",
    players: "单人",
    href: "./games/strike-arena/",
    color: "linear-gradient(135deg, #18f5ff, #ff4567)",
    description: "网页 3D FPS 训练场：移动、瞄准、射击、换弹、BOT 波次和计分 HUD。",
  },
  {
    title: "霓虹贪吃蛇",
    status: "可玩",
    state: "ready",
    category: "puzzle",
    players: "单人",
    href: "#",
    color: "linear-gradient(135deg, #19f5c6, #4ea1ff)",
    description: "第一个示例游戏位。后续可以把入口替换成真正的 HTML5 游戏地址。",
  },
  {
    title: "好友对战房",
    status: "筹备中",
    state: "soon",
    category: "party",
    players: "多人",
    href: "#",
    color: "linear-gradient(135deg, #ff5f7e, #ffd166)",
    description: "预留给联机小游戏。上线时可接房间码、邀请链接和排行榜。",
  },
  {
    title: "每日脑洞题",
    status: "测试中",
    state: "puzzle",
    category: "puzzle",
    players: "单人",
    href: "#",
    color: "linear-gradient(135deg, #141a2a, #7357ff)",
    description: "适合放轻量益智题、答题闯关或限时挑战。",
  },
  {
    title: "下一个游戏位",
    status: "筹备中",
    state: "soon",
    category: "soon",
    players: "待定",
    href: "#",
    color: "linear-gradient(135deg, #263238, #0f9f7f)",
    description: "你后面每给我一个游戏，我会把这里替换成正式入口。",
  },
];

const grid = document.querySelector("#gameGrid");
const search = document.querySelector("#gameSearch");
const filters = document.querySelectorAll(".filter");
const dialog = document.querySelector("#loginDialog");
const toast = document.querySelector("#toast");
const phoneInput = document.querySelector("#phoneInput");
const codeInput = document.querySelector("#codeInput");
const sendCodeBtn = document.querySelector("#sendCodeBtn");
const loginBtn = document.querySelector("#loginBtn");
const loginHint = document.querySelector("#loginHint");
const loginChipText = document.querySelector("#loginChipText");

let activeFilter = "all";
let demoCode = "";
let cooldown = 0;
let cooldownTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2800);
}

function renderGames() {
  const query = search.value.trim().toLowerCase();
  const visibleGames = games.filter((game) => {
    const text = `${game.title} ${game.status} ${game.category} ${game.players}`.toLowerCase();
    const matchesFilter =
      activeFilter === "all" ||
      game.state === activeFilter ||
      game.category === activeFilter;
    return matchesFilter && text.includes(query);
  });

  grid.innerHTML = visibleGames
    .map(
      (game) => `
        <article class="game-card">
          <div class="game-art" style="background:${game.color}">
            <strong>${game.title.slice(0, 2)}</strong>
          </div>
          <div class="game-body">
            <div class="game-meta">
              <span class="tag">${game.status}</span>
              <span class="tag">${game.players}</span>
              <span class="tag">${game.category}</span>
            </div>
            <h3>${game.title}</h3>
            <p>${game.description}</p>
            <div class="play-row">
              <small>${game.href === "#" ? "入口待配置" : "网页即点即玩"}</small>
              ${
                game.href === "#"
                  ? `<button type="button" data-preview="${game.title}">预览</button>`
                  : `<a href="${game.href}">开始</a>`
              }
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function isValidPhone(value) {
  return /^1[3-9]\d{9}$/.test(value.trim());
}

function startCooldown() {
  cooldown = 60;
  sendCodeBtn.disabled = true;
  sendCodeBtn.textContent = `${cooldown}s`;
  cooldownTimer = window.setInterval(() => {
    cooldown -= 1;
    sendCodeBtn.textContent = `${cooldown}s`;
    if (cooldown <= 0) {
      window.clearInterval(cooldownTimer);
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = "获取";
    }
  }, 1000);
}

function updateLoggedIn(phone) {
  const masked = `${phone.slice(0, 3)}****${phone.slice(7)}`;
  localStorage.setItem("gameboxUser", masked);
  loginChipText.textContent = masked;
  loginHint.textContent = `已作为 ${masked} 登录。`;
  showToast("登录成功，欢迎进入玩盒！");
}

sendCodeBtn.addEventListener("click", () => {
  const phone = phoneInput.value.trim();
  if (!isValidPhone(phone)) {
    showToast("请先输入正确的 11 位中国大陆手机号。");
    phoneInput.focus();
    return;
  }

  demoCode = String(Math.floor(100000 + Math.random() * 900000));
  codeInput.value = demoCode;
  loginHint.textContent = `演示验证码已自动填入：${demoCode}`;
  showToast(`演示验证码：${demoCode}`);
  startCooldown();
});

loginBtn.addEventListener("click", () => {
  const phone = phoneInput.value.trim();
  const code = codeInput.value.trim();
  if (!isValidPhone(phone)) {
    showToast("手机号格式不对，请检查一下。");
    phoneInput.focus();
    return;
  }
  if (!demoCode) {
    showToast("请先点击“获取”生成演示验证码。");
    return;
  }
  if (code !== demoCode) {
    showToast("验证码不正确。演示版会自动填入正确验证码。");
    codeInput.focus();
    return;
  }
  updateLoggedIn(phone);
});

document.querySelectorAll("[data-social]").forEach((button) => {
  button.addEventListener("click", () => {
    const provider = button.dataset.social;
    showToast(`${provider} 登录需要正式接入开放平台，当前先展示入口。`);
    dialog.showModal();
  });
});

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    activeFilter = button.dataset.filter;
    renderGames();
  });
});

search.addEventListener("input", renderGames);

document.addEventListener("click", (event) => {
  const loginTarget = event.target.closest("[data-open-login]");
  const previewTarget = event.target.closest("[data-preview]");
  if (loginTarget) {
    dialog.showModal();
  }
  if (previewTarget) {
    showToast(`${previewTarget.dataset.preview} 还没有接入游戏文件。把入口地址给我，我来接。`);
  }
});

document.querySelector("#showAddGuide").addEventListener("click", () => {
  showToast("新增游戏格式已弹出，复制给我也可以。");
  alert(`新增游戏时，把 script.js 里的 games 数组补一项：

{
  title: "游戏名",
  status: "可玩",
  state: "ready",
  category: "puzzle",
  players: "单人",
  href: "/games/your-game/index.html",
  color: "linear-gradient(135deg, #19f5c6, #4ea1ff)",
  description: "一句话介绍"
}`);
});

const savedUser = localStorage.getItem("gameboxUser");
if (savedUser) {
  loginChipText.textContent = savedUser;
  loginHint.textContent = `已作为 ${savedUser} 登录。`;
}

renderGames();
