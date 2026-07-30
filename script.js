const games = [
  {
    title: "霓虹贪吃蛇",
    status: "可玩",
    state: "ready",
    category: "puzzle",
    players: "单人",
    href: "#",
    color: "linear-gradient(135deg, #0f9f7f, #2563eb)",
    description: "第一个示例游戏位。后续可以把入口替换成真正的 HTML5 游戏地址。",
  },
  {
    title: "好友对战房",
    status: "筹备中",
    state: "soon",
    category: "party",
    players: "多人",
    href: "#",
    color: "linear-gradient(135deg, #e24a68, #f0b429)",
    description: "预留给联机小游戏。上线时可接房间码、邀请链接和排行榜。",
  },
  {
    title: "每日脑洞题",
    status: "测试中",
    state: "puzzle",
    category: "puzzle",
    players: "单人",
    href: "#",
    color: "linear-gradient(135deg, #15161a, #6b7c93)",
    description: "适合放轻量益智题、答题闯关或限时挑战。",
  },
  {
    title: "下一个游戏位",
    status: "筹备中",
    state: "soon",
    category: "soon",
    players: "待定",
    href: "#",
    color: "linear-gradient(135deg, #536976, #292e49)",
    description: "你后面每给我一个游戏，我会把这里替换成正式入口。",
  },
];

const grid = document.querySelector("#gameGrid");
const search = document.querySelector("#gameSearch");
const filters = document.querySelectorAll(".filter");
const dialog = document.querySelector("#loginDialog");
let activeFilter = "all";

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
                  ? `<button type="button" data-open-login>预览</button>`
                  : `<a href="${game.href}">开始</a>`
              }
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

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
  if (event.target.matches("[data-open-login]")) {
    dialog.showModal();
  }
});

document.querySelector("#showAddGuide").addEventListener("click", () => {
  alert(`新增游戏时，把 script.js 里的 games 数组补一项：

{
  title: "游戏名",
  status: "可玩",
  state: "ready",
  category: "puzzle",
  players: "单人",
  href: "/games/your-game/index.html",
  color: "linear-gradient(135deg, #0f9f7f, #2563eb)",
  description: "一句话介绍"
}`);
});

renderGames();
