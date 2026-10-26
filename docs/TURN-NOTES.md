# Turn 风格维护说明

`/turn/`（中文）与 `/turn/en/`（英文）是以「轮到你」为主题的一套独立风格，为参加 CSS Design Awards 准备。它不展示产品窗口，而是用字体、两根可以拨动的线、时间与声音，讲产品背后的那件事：对话留给你开口的时间，只有一眨眼。

## 概念

- **哲学**：对话中，一方说完到另一方开口，通常只隔约 200 毫秒（Levinson & Torreira, 2015, *Frontiers in Psychology*；Stivers 等, 2009, *PNAS*，比较了十种语言）；而从想说到说出口要 600 毫秒以上，所以人总在对方还没说完时就开始想。InterviewHacker 也这样：对方还在说，它在听；话音一落，回答开始浮上来；没人问你，它就不出声。页面上 200 / 600 只用来讲人的对话，不是产品的速度承诺。
- **叙事**：一个周一。页头时钟随滚动走（`[data-time]`），纸色随时间变化（`[data-palette]`：dawn → morning → noon → afternoon → dusk → evening → night → midnight）。08:59 首屏 → 09:00 一眨眼 → 09:30 例会 → 11:00 二面 → 14:00 线下组会 → 16:30 客户电话 → 黄昏 → 20:00 英文会议 → 21:40 纪要 → 22:30 隐私 → 23:10 问答 → 23:59 等待名单（提交成功后时钟翻到周二 00:00）。
- **三种字体声音**：对方的话用思源宋体 / Instrument Serif 斜体（琥珀）；你和页面本身用得意黑 / Instrument Serif；“下一句”用靛蓝正文与手写字形。琥珀只给对方，靛蓝只给你。
- **一根线贯穿全站**：两根可以拨动的弦（琥珀是对方，靛蓝是你）。线下会议时合成一根，黄昏成为地平线，深夜变成可以搅动的水面；遇到正文会自动断开，不压字。
- **声音**：默认关闭，每次访问都关闭；按下页头“声音”后才创建 AudioContext。全部由 Web Audio 实时合成，不加载音频文件，不访问麦克风。

## 源码与生成

| 内容 | 位置 |
| --- | --- |
| 页面外壳（页头、样式与脚本顺序） | `scripts/turn-i18n/page.html` |
| 各章节（双语 `{{ 中文 ‖ English }}`） | `scripts/turn-i18n/parts/*.html` |
| 生成两页并加内容哈希 | `scripts/build-turn.mjs`（`npm run turn:build`；`--check` 在 `npm run check` 中运行） |
| 手写字形（连笔字母表） | `scripts/turn-lettering.mjs`；章节里写 `{{@letter:your turn.|class}}` |
| 一天章节的细线数字与 14:00 示意图 | `scripts/turn-day/`：改 `day.tpl.html` 后运行 `node scripts/turn-day/build-part.mjs`，再 `npm run turn:build` |
| 字体子集 | `scripts/turn-fonts.py`（`npm run fonts:turn -- --src <原字体目录>`） |
| 基础样式与设计变量 | `public/turn/style.css` |
| 各模块样式 / 脚本 | `public/turn/styles/*.css`、`public/turn/scripts/*.js` |

不要直接修改 `public/turn/index.html` 与 `public/turn/en/index.html`。

### 脚本分工

| 文件 | 作用 |
| --- | --- |
| `bootstrap.js` | 在 `<head>` 中运行：标记脚本与动效状态，建立 `window.IH`（事件、语言、`motionOK()`） |
| `core.js` | Lenis 平滑滚动、动效暂停、页头菜单与语言、时钟与纸色（OKLab 混合，由亮转暗经过蜜桃与暗玫瑰色）、切换语言保持位置 |
| `sound.js` | Web Audio 合成：拨弦（Karplus–Strong，A 小调五声音阶，对方与你相差纯五度）、轮次提示、按键、环境声 |
| `lines.js` | 两根线：弦的物理、拨动、七种形态、正文让位、夜间水面；软件 GPU 时改用 CPU 画布 |
| `cursor.js` | 仅精确指针且允许动效：墨点 + 圆环；标题处变成闪烁的输入符，靠近弦时拉伸 |
| `hero.js`、`gap.js` | 首屏入场（“一扎眼”被纠正成“一眨眼”，只是 CSS 绘制，DOM 文字始终正确）；200 / 600 毫秒时间轴与反应小游戏 |
| `day.js` | 四个场景的播放与手势（只记录、改写、线上 / 线下、共享整个屏幕） |
| `dusk.js`、`evening.js` | 落日与回旋诗句；英文会议的语言切换；转写整理成纪要 |
| `night.js`、`waitlist.js` | 隐私图、问答、结尾与等待名单表单 |

模块之间只通过 `IH` 事件联系：`section`、`tick`、`motion`、`voice {who}`、`turn {who}`、`pluck {who, x, strength}`、`lines {mode, merge}`、`sound`。

## 字体

全部 SIL OFL 1.1，子集化后随站分发，许可放在各目录：

| 用途 | 字体 | 文件 |
| --- | --- | --- |
| 中文标题（你） | 得意黑 Smiley Sans Oblique（改名 IH Display） | `assets/fonts/display/` |
| 中文正文与回答 | Noto Sans SC 400 / 500（改名 IH Sans） | `assets/fonts/sans/` |
| 对方的话 | Noto Serif SC 500 / 600（改名 IH Serif） | `assets/fonts/serif-sc/` |
| 英文标题、对方的话 | Instrument Serif 正体与斜体 | `assets/fonts/serif/` |
| 英文正文、标签与时钟 | Geist、Geist Mono | `assets/fonts/geist/` |

页面有新字时：`pip install fonttools brotli`，`npm run turn:build`，然后 `npm run fonts:turn -- --src <原字体目录>`（原字体来源写在 `scripts/turn-fonts.py` 开头）。`npm run check` 会分别核对正文、标题与对方的话是否都在子集里。

## 无障碍与降级

- 无脚本：所有内容可读，表单直接显示并以普通 POST 提交。
- 减少动态效果：没有固定滚动与入场动画，章节按顺序完整显示；黄昏是一张静止的落日。
- 页头暂停按钮停止所有装饰动画（记在本机）；标签页隐藏、离屏时各循环自行停止。
- 键盘：“声音”是靠前的 Tab 位置；所有手势可用方向键与空格操作；等待名单打开时是对话框，焦点留在其中，Esc 关闭。
- 不支持画布时显示静态 SVG 两根线。

## 事实边界

文案依据 v2 的使用体验：会议类型、系列（一面 → 二面）、只记录、线上双路与线下单路（“现场”）、改写（更简短 / 举例 / 换语言）、回答跟着对话语言、手机伴侣（扫码，打开的页面就是提词屏，不用装 App）、会后纪要（校对、模板、每条对应原话、待确认、题库）。不写模型、速度、准确率、体积；不做“隐身”承诺；页面只开放等待名单，没有下载。等待名单与 Final 共用 `api/waitlist.js`（需要部署平台的 `SMTP_USER`、`SMTP_PASS`）。

## 预览截图

`public/previews/turn-home.png` 是 1280 × 844 的首屏（入场结束后）。修改视觉后重新截图，再运行 `npm run docs:sync`。
