# Final 风格维护说明

`/final/`（中文）与 `/final/en/`（英文）是最终版页面，内容按 InterviewHacker v2（“一场会议就是一页”）重写，视觉沿用并加强改版前的 Final：暖白纸与墨色、可以拨动的声波水面、得意黑大标题、紫色的自制手写字形、指针交互和滚动编排。

颜色有固定含义：琥珀是对方（这台 Mac 播放的声音），墨色是你（麦克风），紫色是 AI——它写的回答、AI 读到的重点，以及页面上的手写字和批注。产品窗口内部沿用 App 的“纸与墨”变量（墨色主按钮、紫色只标 AI 内容）。

## 源码与生成

| 内容 | 位置 |
| --- | --- |
| 双语页面源码（`{{ 中文 ‖ English }}`） | `scripts/final-i18n/page.html` |
| 产品窗口与示例的数据（对话、回答、改写、纪要模板、会议类型、猜类型的关键词、声音示例） | `scripts/final-i18n/demo.json` |
| 由数据渲染窗口与示例（构建时，无脚本也完整可读） | `scripts/final-app.mjs` |
| 生成两页并为 CSS/JS 加内容哈希 | `scripts/build-final.mjs`（`npm run final:build`，`--check` 在 `npm run check` 中运行） |
| 自制手写字与笔迹 | `scripts/final-lettering.mjs`：手写单线字 “one page.”（首屏、结尾）与 “next line.”（流程标题，带一段引线），以及圈注、勾、方括号、几种箭头。都是骨架点 → Catmull-Rom → 贝塞尔，按笔顺排列 |
| 样式 | `public/final/style.css` |
| 脚本 | `public/final/scripts/`：`bootstrap` 外观与动效开关；`field` 水面（WebGL）；`app` 产品窗口；`page` 流程步骤、会议类型、系列、声音波形、模板标签、复制；`companion` 手机伴侣；`motion` 平滑滚动与 GSAP 编排；`cursor` 指针 |
| 第三方 | `public/final/assets/vendor/`：GSAP（ScrollTrigger、SplitText、DrawSVG、CustomEase）与 Lenis，同源分发，见该目录 README |

模板里的特殊标记：`{{@app}}` 产品窗口，`{{@types}}` 会议类型示例，`{{@templates}}` 纪要模板对比，`{{@audio:online|offline}}` 声音示例，`{{@onepage}}` / `{{@nextline-lead}}` 手写字，`{{@pen:loop|tick|bracket|arrow|arrow-left|arrow-up|arrow-down|underline}}` 笔迹，`{{@demo}}` 给脚本的 JSON。

不要直接修改 `public/final/index.html` 或 `public/final/en/index.html`；改源码后运行 `npm run final:build`（`npm run docs:sync` 已包含）。

## 字体

全部为 SIL OFL 1.1，子集化后随站分发：

| 用途 | 字体 | 子集文件 |
| --- | --- | --- |
| 中文大标题、章节标题、批注 | 得意黑 Smiley Sans Oblique v2.0.1（改名 IH Display） | `assets/fonts/display/ih-display.woff2` |
| 产品窗口里的会议标题与纪要小节 | 思源宋体 Noto Serif SC，500–600（改名 IH Serif） | `assets/fonts/serif/ih-serif.woff2` |
| 正文与界面 | 思源黑体 Noto Sans SC，400–500（改名 IH Sans） | `assets/fonts/sans/ih-sans.woff2` |
| 英文标题、批注 | Instrument Serif 正体与斜体 | `assets/fonts/serif/` |
| 英文界面与注记 | Geist、Geist Mono | `assets/fonts/geist/` |

得意黑保留了 “Smiley”“得意黑”，思源黑体 / 思源宋体保留了 “Source” 字体名，因此子集改名。

页面文字有新字时需要重新子集化。原字体：得意黑来自 `github.com/atelier-anchor/smiley-sans` v2.0.1 发布包，其余来自 `github.com/google/fonts`（`ofl/notosanssc`、`ofl/notoserifsc`、`ofl/instrumentserif`）：

```sh
pip install fonttools brotli
npm run final:build
npm run fonts:final -- <原字体目录>
npm run final:build
```

`assets/fonts/charset.json` 记录已覆盖字符（`display`、`serif`、`sans`）；`npm run check` 会报出正文、h1–h2 大标题和产品窗口标题里没有覆盖的汉字。`⇧⌘↩` 里的 ↩ 不在思源黑体里，由系统字体显示。

## 叙事与结构

整页跟着一场会议走：

1. **首屏（#top）**：「一场会议，就是 *one page.*」。标题先以带错字的灰色草稿出现（“一场汇议”“one pace”），一条紫色精修线扫过，逐字翻成得意黑，错字先划琥珀线再改正，最后紫色手写字按笔顺写出——对应产品的两遍识别和会后校对。背后是声波水面：琥珀（对方）和墨色（我）两条线在纸上起伏，两人轮流说话时说话一方的线上会落下小涟漪；鼠标划过压出涟漪，点击投下一圈。往下滚，两条线慢慢平复成一条墨线。
2. **流程（#demo）**：宽屏（≥ 901 × 600）时整段固定，淡青色水面上放一台笔记本电脑，屏幕里是可点击的 v2 窗口。滚动依次走过七步：首页 → 准备（这是什么会 / 接着上一场 / 新资料与开始前检查）→ 进行中（回答逐词浮现）→ 只记录与回答设置 → 纪要（校对 → 整理 → 核对 → 面试复盘）。对方或你说一句话，水面在电脑左边或右边泛起涟漪；AI 给出回答时，回答下方漾开紫色的一圈。电脑随滚动从倾斜中立起，随指针轻微偏转。底部是步骤说明、进度条和“首页 · 准备 · 进行中 · 纪要”跳转。窄屏或矮屏时窗口固定在页头下方，文字从下面滚过，不启动水面。
3. **间奏**：几句真实场景（面试追问、组会、例会被点名、客户问上线）随滚动从下方升起，越过中线时弯曲、模糊淡入淡出；中线是一条平静的墨线，句子经过时投下一圈墨色 / 琥珀 / 紫色的环。
4. **会议类型（#scenes）**：输入标题先猜类型（关键词只作演示），八个类型的默认值和小窗口示意随之变化；手写批注“改个标题试试”。
5. **系列（#series）**：一面 → 二面 → 三面三张纸，滚动时错落下沉；勾掉带入的内容，二面的“AI 读到的重点”跟着变。
6. **声音（#audio）**：琥珀与墨色两条实时波形；切到“线下”，两条线合成一条“现场”。
7. **纪要（#notes）**：校对 / 整理 / 核对三步各附例子；面试复盘、学术、工作会议三种模板像被批改过的纸：“不足”部分有琥珀色手写方括号，“待确认”被紫色圈出，时间点旁写着“点一下，跳回原话”。
8. **手机伴侣（#companion）**：宽屏（≥ 1061 × 640）整段固定三拍：共享整个屏幕时提词器在画面里（琥珀描边）→ 手机扫码配对 → 提词器从共享画面消失、回答出现在手机上。之后手机交给读者，遥控键都能点，提示气泡依次指向“上一条 → 更简短 → 英文版”。如实写明手机被共享或镜像时同样会被看到。
9. **数据去向（#privacy）**：“这台 Mac”用一圈手绘边线圈起来，紫色箭头指向会发出去的内容和接收方。
10. **安装（#install）**、**问答（#faq）**。
11. **结尾（#download）**：整屏深色水面，两路声音（琥珀、浅色）从各自位置扩散涟漪并在中间交汇，指针移动时“你”的声源跟着走；标题、紫色手写 “one page.”、下载按钮（GitHub Releases latest）、使用前提和“仓库目前不公开”的说明；版权、语言、画廊链接与字体说明以小字放在水面底部。

窗口里的对话只有“对方 / 我”（线下为“现场”），示例公司“云杉科技 / Fernway”为虚构。文案以 App 仓库 README（readme-v2）、`docs/releases/v2.0.0.md`、`docs/redesign/`、`NotesTemplates.swift` 与英文字符串表为准：不写“无法被检测”，不说手机伴侣“完全看不到”，不写还没做的日历接入。试用名单表单已从页面去掉；`api/waitlist.js` 与 `cloud-functions/api/waitlist.js` 仍在仓库里。

## 动效与降级

- 产品窗口内部只用 120 / 200 / 320ms 与 `cubic-bezier(.2,.8,.2,1)`；页面编排用 GSAP（`ih.settle` = `.16,1,.3,1`），只动 transform、opacity 与描边。
- 水面（`field.js`）：CPU 高度场（约 6 CSS px 一格，120 Hz 固定步长，静止 3 秒后停），斜率上传为纹理，在着色器里折射线条、焦散和光；边缘用逐像素随机阈值溶进纸色。离屏、标签页隐藏、暂停动效时停止循环；WebGL 不可用时首屏显示 SVG 波形，流程和结尾显示纯色背景。
- 页头的暂停按钮（记在本机）和 `prefers-reduced-motion`：标题直接显示定稿，笔迹直接画好，水面静止，不做平滑滚动。
- 没有脚本时：页面完整可读，窗口停在首页，步骤文字按顺序排列，纪要模板显示第一个。

## 外观

默认浅色（与产品 README 一致）；页头月亮按钮切到深色，选择记在本机。深色下水面、窗口和纸张都换成深色变量。

## 预览截图

`public/previews/final-home.png` 为 1280 × 844 浅色首页（Playwright Chromium 截取，等首屏标题动画结束）。改动后运行 `npm run docs:sync` 同步 README 与画廊。

## 部署到 EdgeOne Pages（腾讯云海外站）

- 仓库根目录的 `edgeone.json` 与 `vercel.json` 对应：同样运行 `npm run check && npm run build`，只发布 `dist`（否则会把整个仓库，包括 README 与 package.json，公开出去），安全响应头与 Vercel 一致（`scripts/check.mjs` 会校验）。
- 试用名单在 EdgeOne 上由 `cloud-functions/api/waitlist.js` 处理，与 Vercel 的 `api/waitlist.js` 共用校验与发信代码；需在 EdgeOne 项目的环境变量里同样设置 `SMTP_USER`、`SMTP_PASS`（可选 `WAITLIST_TO`）。表单提交到 `/api/waitlist`：EdgeOne 直接路由到函数，Vercel 以 308 转到带斜杠的地址并保留 POST。
- EdgeOne 自动分配的 `*.edgeone.dev` 地址在中国大陆只返回 401（需要控制台生成的临时预览链接），`*.vercel.app` 在中国大陆被屏蔽；面向国内用户必须绑定自有域名。
