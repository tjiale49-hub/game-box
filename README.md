# 玩盒 GameBox 初版

这是一个纯静态初版网页界面，可以直接打开 `index.html` 预览。

## 已接入游戏

- `games/strike-arena/`：高能突击，网页 3D FPS 原型，包含电影感游戏官网首页、自然场景地图、真实人形敌人、独立模式大厅、团队竞技、爆破模拟、生存突围、狙击训练、BOT 训练、地图切换、武器参数、HUD 和计分。

## 添加一个游戏

打开 `script.js`，在 `games` 数组里新增一项：

```js
{
  title: "游戏名",
  status: "可玩",
  state: "ready",
  category: "puzzle",
  players: "单人",
  href: "/games/your-game/index.html",
  color: "linear-gradient(135deg, #0f9f7f, #2563eb)",
  description: "一句话介绍"
}
```

## 登录规划

当前是前端占位。公开上线时建议优先接手机号短信登录，再按需要接微信开放平台、QQ 互联或自己的账号系统。
