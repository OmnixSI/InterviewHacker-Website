# Final 风格维护说明

`/final/`（中文）与 `/final/en/`（英文）是最终版页面，按 InterviewHacker v2 的“纸与墨”视觉语言重做（产品设计见 App 仓库 `docs/redesign/`）：暖白纸底、近黑墨色、墨色主按钮、衬线标题，紫色只标 AI 写的内容，红点只表示录制中，绿点就绪，琥珀色表示需要再看一眼。细线代替阴影，只有浮起来的东西（产品窗口、回答设置、手机）有阴影。

## 源码与生成

| 内容 | 位置 |
| --- | --- |
| 双语页面源码（`{{ 中文 ‖ English }}`） | `scripts/final-i18n/page.html` |
| 产品窗口与示例的数据（对话、回答、改写、纪要模板、会议类型、猜类型的关键词、声音示例） | `scripts/final-i18n/demo.json` |
| 由数据渲染窗口与示例（构建时，无脚本也完整可读） | `scripts/final-app.mjs` |
| 生成两页并为 CSS/JS 加内容哈希 | `scripts/build-final.mjs`（`npm run final:build`，`--check` 在 `npm run check` 中运行） |
| 手绘墨迹 | `scripts/final-lettering.mjs`：手写单线字 “one page.”（页脚），以及编辑笔迹：圈注（首屏）、勾、方括号（纪要的“不足”）、箭头。都是骨架点 → Catmull-Rom → 贝塞尔，按笔顺排列，用 `pathLength=1` 的描边偏移画出来 |
| 样式 | `public/final/style.css` |
| 脚本 | `public/final/scripts/`：`bootstrap` 外观与动效开关、`app` 产品窗口、`page` 滚动叙事与各个示例 |

模板里的特殊标记：`{{@app}}` 产品窗口，`{{@types}}` 会议类型示例，`{{@templates}}` 纪要模板对比，`{{@audio:online|offline}}` 声音示例，`{{@script}}` 手写字，`{{@pen:loop|tick|bracket|arrow|arrow-down|underline}}` 笔迹，`{{@demo}}` 给脚本的 JSON。

不要直接修改 `public/final/index.html` 或 `public/final/en/index.html`；改源码后运行 `npm run final:build`（`npm run docs:sync` 已包含）。

## 字体

全部为 SIL OFL 1.1，子集化后随站分发：

| 用途 | 字体 | 子集文件 |
| --- | --- | --- |
| 中文标题、窗口里的会议标题与纪要小节 | 思源宋体 Noto Serif SC，字重 500–600（改名 IH Serif） | `assets/fonts/serif/ih-serif.woff2` |
| 正文与界面 | 思源黑体 Noto Sans SC，字重 400–500（改名 IH Sans） | `assets/fonts/sans/ih-sans.woff2` |
| 英文标题、字标 | Instrument Serif 正体与斜体 | `assets/fonts/serif/` |
| 英文界面与注记 | Geist、Geist Mono | `assets/fonts/geist/` |

产品标题用 New York / 宋体，所以中文标题改用思源宋体，原先的得意黑不再使用并已移除。思源黑体、思源宋体保留了 “Source” 字体名，因此子集改名。

页面文字有新字时需要重新子集化。原字体来自 `github.com/google/fonts`（`ofl/notosanssc`、`ofl/notoserifsc`、`ofl/instrumentserif`）：

```sh
pip install fonttools brotli
npm run final:build
npm run fonts:final -- <原字体目录>
npm run final:build
```

`assets/fonts/charset.json` 记录已覆盖字符（`sans`、`serif`）；`npm run check` 会报出页面中未覆盖的汉字，以及标题里 IH Serif 没有覆盖的字。`⇧⌘↩` 里的 ↩ 不在思源黑体里，由系统字体显示。

## 叙事与结构

整页讲“一场会议”的时间线，和产品的“一场会议 = 一页”对应：

1. 首屏：「一场会议，就是一页。」，“一页”被一圈手绘墨迹圈住。右侧是唯一的产品窗口（`data-demo-app`）。
2. 流程（`#demo`）：宽屏时窗口固定在右侧，左侧七段文字按时间（14:02 → 15:14）滚过，读到哪一段，窗口就切到哪个状态：首页 → 准备（这是什么会 / 接着上一场 / 新资料与开始前检查）→ 进行中（建议回答逐词浮现）→ 只记录与回答设置 → 结束后的纪要（校对 → 按模板整理 → 核对，然后出现面试复盘）。窗口下方的“首页 · 准备 · 进行中 · 纪要”可以直接跳。窗口里的按钮都能点：新会议、立即记录、会议类型、带入勾选、线上 / 线下、开始、提词 / 只记录、模型标签（回答设置）、更简短 / 举例 / 英文版、“…”、立即回答、计时（暂停）、结束、存进题库。
3. 会议类型（`#scenes`）：输入会议标题时先猜类型（关键词只作演示，页面上已注明），八个类型可以直接点，右边的“会中 / 回答长度 / 纪要 / 建议放”和小窗口示意（提词时右栏有回答，只记录时右栏留空）跟着变。
4. 系列（`#series`）：一面 → 二面 → 三面三张纸；勾掉带入的内容，二面的“AI 读到的重点”会跟着少。
5. 声音（`#audio`）：线上 = 这台 Mac 播放的全部声音（对方）+ 麦克风（我）；线下 = 只用麦克风（现场）。电平每秒刷新 8 次。
6. 纪要（`#notes`）：校对 / 按模板整理 / 核对三步，各附一个例子；下面是面试复盘、学术、工作会议三个模板的对比，“不足”部分用琥珀色手绘方括号标出。
7. 看哪里（`#companion`）：提词器在摄像头下方，手机伴侣；如实写明共享整个屏幕或镜像手机时仍可能被看到。
8. 数据去向（`#privacy`）：虚线框是“这台 Mac”，右边列出会发出去的内容和接收方。
9. 下载（`#download`）：按钮指向 `https://github.com/OmnixSI/InterviewHacker/releases/latest`；写明 v2.0.0 起的新界面、macOS 14+、Apple Silicon、仓库目前不公开需要访问权、未经 Apple 公证的“仍要打开”与 `xattr` 命令、第一次点“开始”时才申请的两项权限、回答服务。
10. 问答（`#faq`）与页脚手写字 “one page.”。

窗口里的对话只有“对方 / 我”（线下为“现场”）。示例公司“云杉科技 / Fernway”是虚构的。所有文案以 App 仓库的 README（readme-v2 分支）、`docs/releases/v2.0.0.md`、`docs/redesign/` 和 App 的英文字符串表为准：不写“无法被检测”，不说手机伴侣“完全看不到”，不写还没做的日历接入。

旧版的试用名单表单已从页面去掉（现在可以直接下载）；`api/waitlist.js` 与 `cloud-functions/api/waitlist.js` 仍保留在仓库里，未删除。

## 动效

- 只用三档时长：悬停 / 按下 120ms，展开 / 切换 200ms，阶段转场 320ms，曲线统一 `cubic-bezier(.2,.8,.2,1)`；只改透明度，不弹、不滑、不放大。回答逐词淡入，每词 160ms。手绘笔迹按 320ms 的倍数画出（首屏圈注 640ms，页脚手写字分笔画出）。
- 进入视野的内容只做一次淡入。
- 页头有暂停动效按钮（记在本机），`prefers-reduced-motion` 时所有内容直接出现，电平和计时停止。
- 计时、电平只在窗口进入视野时运行。

## 外观

默认浅色（与产品 README 一致）。页头的月亮按钮切到深色，使用产品 `tokens.json` 的深色变量，选择记在本机；不跟随系统自动切换。

## 布局

- 宽屏（> 1180px）：左 5 / 右 7.4，窗口固定在右侧。
- 901–1180px：窗口更高（1.22:1），侧边栏收起。
- ≤ 900px：窗口固定在页头下方（约半屏高），文字从下面滚过，读线在屏幕下部；窗口内部用容器查询改成上下两栏。
- ≤ 640px：各个示例改成单列；不出现横向滚动。

## 预览截图

`public/previews/final-home.png` 为 1280 × 844 浅色首页（Playwright Chromium 截取）。改动后运行 `npm run docs:sync` 同步 README 与画廊。

## 部署到 EdgeOne Pages（腾讯云海外站）

- 仓库根目录的 `edgeone.json` 与 `vercel.json` 对应：同样运行 `npm run check && npm run build`，只发布 `dist`（否则会把整个仓库，包括 README 与 package.json，公开出去），安全响应头与 Vercel 一致（`scripts/check.mjs` 会校验）。
- 试用名单在 EdgeOne 上由 `cloud-functions/api/waitlist.js` 处理，与 Vercel 的 `api/waitlist.js` 共用校验与发信代码；需在 EdgeOne 项目的环境变量里同样设置 `SMTP_USER`、`SMTP_PASS`（可选 `WAITLIST_TO`）。表单提交到 `/api/waitlist`：EdgeOne 直接路由到函数，Vercel 以 308 转到带斜杠的地址并保留 POST。
- EdgeOne 自动分配的 `*.edgeone.dev` 地址在中国大陆只返回 401（需要控制台生成的临时预览链接），`*.vercel.app` 在中国大陆被屏蔽；面向国内用户必须绑定自有域名。
