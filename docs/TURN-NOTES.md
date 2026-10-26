# Turn 风格维护说明

`/turn/`（中文）与 `/turn/en/`（英文）是以「轮到你」为主题的一套独立风格，为参加 CSS Design Awards 准备。它不展示产品窗口，而是用字体、两根可拨动的线、时间与声音讲产品背后的那件事：对话留给你的时间只有一眨眼。

## 概念

- **哲学**：对话中，一方说完到另一方开口通常只隔约 200 毫秒（Levinson & Torreira, 2015, *Frontiers in Psychology*；Stivers 等, 2009, *PNAS*，比较了十种语言），而从想说到说出口要 600 毫秒以上，所以人总在对方还没说完时就开始想。InterviewHacker 也这样：对方还在说，它在听；话音一落，回答开始浮上来；没人问你，它就不出声。
- **叙事**：一个周一。页头时钟随滚动走（`[data-time]`），纸色随时间变化（`[data-palette]`：dawn → morning → noon → afternoon → dusk → evening → night → midnight），从 08:59 的首屏到 23:59 的等待名单。
- **三种字体声音**：对方的话用思源宋体 / Instrument Serif 斜体（琥珀）；你和页面本身用得意黑 / Instrument Serif；“下一句”用靛蓝的正文与手写字形。
- **一根线贯穿全站**：两根可以拨动的弦（琥珀是对方，靛蓝是你），线下会议时合成一根，黄昏成为地平线，深夜变成可以搅动的水面。
- **声音**：默认关闭；打开后全部由 Web Audio 实时合成，不加载音频文件，不访问麦克风。

（各模块细节在集成完成后补全。）

## 源码与生成

| 内容 | 位置 |
| --- | --- |
| 页面外壳（页头、脚本与样式顺序） | `scripts/turn-i18n/page.html` |
| 各章节（双语 `{{ 中文 ‖ English }}`） | `scripts/turn-i18n/parts/*.html` |
| 生成两页并加内容哈希 | `scripts/build-turn.mjs`（`npm run turn:build`；`--check` 在 `npm run check` 中运行） |
| 手写字形 | `scripts/turn-lettering.mjs`，在章节里写 `{{@letter:your turn.|class}}` |
| 基础样式与设计变量 | `public/turn/style.css` |
| 各模块样式 | `public/turn/styles/*.css` |
| 运行时与各模块脚本 | `public/turn/scripts/`：`bootstrap` → `core` → `sound` → `lines` → `cursor` → 各章节 |

不要直接修改 `public/turn/index.html` 或 `public/turn/en/index.html`。
