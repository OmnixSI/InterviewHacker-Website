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
| 脚本 | `public/final/scripts/`：`bootstrap` 外观与动效开关；`field` 水面（WebGL：首屏、结尾）；`app` 产品窗口；`page` 流程步骤、手写批注定位、会议类型、系列、声音波形、模板标签；`companion` 手机伴侣；`motion` 平滑滚动与 GSAP 编排（含间奏）；`waitlist` 等待名单；`cursor` 指针 |
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

页面只讲产品和使用体验，不写安装、签名、系统版本、模型名、下载体积这类技术细节。

几条编排原则（第四轮按用户反馈定下，改动时请保持）：

- **留白与克制**：一次只有一个重点。水面默认几乎静止；涟漪只在说话人换人时落一个，AI 给出回答时才出现一次紫色。不叠加多个大圆环，不用全宽分隔线。
- **过渡连续**：全页同一种纸色，模块之间不画线、不换底色、不做颗粒溶解的“画框”；需要的深色（结尾）用长渐变从纸色沉下去，水面边缘用柔和蒙版淡出。
- **不让人等**：每屏到达时内容已经完整；入场动画 ≤ 0.5 秒且从第一帧起可读；手写字 ≤ 1.2 秒。逐词浮现只在用户点“立即回答”时出现，而且很快。
- **字号偏小**：正文 15px，章节标题 clamp(32px, 3.9vw, 58px)，像杂志的节奏而不是海报。

整页跟着一场会议走：

1. **首屏（#top）**：「一场会议，就是 *one page.*」。标题先以带错字的灰色草稿出现，一条紫色精修线扫过，逐字翻成得意黑，错字先划琥珀线再改正，最后紫色手写字按笔顺写出。背后是声波水面：琥珀（对方）和墨色（我）两条线轮流起伏，只在说话人换人时落下一个很淡的涟漪；“对方 / 我”的标签跟着线的位置走（`field.js` 写入 `--base`）。往下滚，两条线平复成一条墨线。按钮是“加入等待名单”（滚到结尾并打开表单）和“走一遍流程”。
2. **流程（#demo）**：宽屏（≥ 901 × 600）整段固定，纸面上直接放一台笔记本电脑（不再有水池或画框），屏幕里是可点击的 v2 窗口；滚动依次走过七步：首页 → 会议类型 → 接着上一场 → 资料 → 回答 → 只记录 → 纪要。做法借鉴改版前的线上版：每一步窗口都是一个完整、构图好的状态（准备页把该步标题滚到窗口顶部，上下用柔和蒙版，不出现半截卡片）；`data-spot` 只点亮这一步相关的区域，其余变淡；窗口下方是一句居中的小字说明，再下面是带标签、可点击的七格进度条（`data-goto`），说明和控件互不挤压。到达即完整：资料已读完、回答已写好；只有点“立即回答”才逐词浮现（16ms 一个词）。窄屏或矮屏时窗口固定在页头下方，文字从下面滚过。窗口里的模型标签写成中性的“回答设置”，不出现模型名。
3. **间奏（the tide，`[data-tide]`）**：宽屏时固定一屏，纸色背景，没有水面。一次只出现一句（约 26–44px，中文得意黑、英文 Instrument Serif）：“会议，从不等你准备好。”，然后是面试追问、组会、例会被点名、客户问上线几个场景。每句先以灰色草稿出现、带一个听错的字（琥珀色），随滚动在原位从左到右变成墨色定稿，错字原地换成正确的字；定稿时这句后面漾开一圈很淡的环（对方琥珀、现场墨色），只有一圈。最后一句是“问题落下，回答随即浮上来”和一张完整的紫色回答卡片，这是间奏里唯一的紫色。英文的拉丁字母按单词成组，不会在词中间换行。窄屏和减少动态效果时为静态排版，直接显示定稿。
4. **会议类型（#scenes）**：输入标题先猜类型（关键词只作演示），八个类型的默认值和小窗口示意随之变化；手写批注“改个标题试试”的箭头落在标题最后一个字上，随输入移动。
5. **系列（#series）**：一面 → 二面 → 三面三张纸；勾掉带入的内容，二面的“AI 读到的重点”跟着变；手写批注“勾掉一项看看”在二面右上角，箭头落在第一项文字第一行的末尾。
6. **声音（#audio）**：琥珀与墨色两条实时波形；切到“线下”，合成一条“现场”。
7. **纪要（#notes）**：校对 / 整理 / 核对三步各附例子；面试复盘、学术、工作会议三种模板像被批改过的纸：“不足”部分有琥珀色手写方括号，“待确认”被紫色圈出，第一个时间点旁写着“点一下，跳回原话”。
8. **手机伴侣（#companion）**：宽屏整段固定三拍，之后手机交给读者，提示气泡出现在按键下方，不遮挡别的键。如实写明共享整个屏幕或镜像手机时同样会被看到。
9. **隐私（#privacy）**：三句承诺（在这台 Mac 上听、不留录音、交给谁你说了算）和一句“不做隐身承诺”。
10. **问答（#faq）**：只留使用体验相关的问题。
11. **结尾（#download）**：纸色经长渐变沉到深色水面（水面上沿同样用渐变蒙版淡出），两路声音扩散交汇、跟着指针移动；“InterviewHacker 2.0 即将开放。”、紫色手写 “one page.”、“加入等待名单”。点按钮后标题沉入水面，升起一张磨砂玻璃表单（称呼、邮箱、用途多选、更多），提交到 `/api/waitlist`（`api/waitlist.js` / `cloud-functions/api/waitlist.js`，蜜罐、长度与格式校验、限频）；无脚本时表单直接显示并以普通 POST 提交，结果通过 `#waitlist-ok` 等返回。CSP 的 `form-action 'self'` 在 `vercel.json`、`public/vercel.json`、`edgeone.json` 中一致。

### 手写批注怎么对齐

`page.js` 的 `annotators` 用元素的布局偏移（`offsetLeft/Top`，不受视差和倾斜影响）和文字的实际行框计算位置，箭头是一条二次曲线加两笔箭头；窗口尺寸变化、字体加载完成、标题被编辑时重新计算。纪要模板里的方括号、圈注、行内箭头随所在行排版；隐藏的模板面板里的笔迹一律隐藏（DrawSVG 会写行内 `visibility`，CSS 用 `!important` 压住）。指针在正文上方时缩成一个淡色小点，不挡字。

窗口里的对话只有“对方 / 我”（线下为“现场”），示例公司“云杉科技 / Fernway”为虚构。文案以 App 仓库 README（readme-v2）、`docs/releases/v2.0.0.md`、`docs/redesign/` 与英文字符串表为准：不写“无法被检测”，不说手机伴侣“完全看不到”。

## 动效与降级

- 产品窗口内部只用 120 / 200 / 320ms 与 `cubic-bezier(.2,.8,.2,1)`；页面编排用 GSAP（`ih.settle` = `.16,1,.3,1`），只动 transform、opacity 与描边。
- 水面（`field.js`，只在首屏与结尾）：CPU 高度场（约 6 CSS px 一格，120 Hz 固定步长，静止 3 秒后停），斜率上传为纹理，在着色器里折射线条、焦散和光；结尾上沿用平滑渐变淡进纸色。离屏、标签页隐藏、暂停动效时停止循环；WebGL 不可用时首屏显示 SVG 波形，结尾显示渐变背景。
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
