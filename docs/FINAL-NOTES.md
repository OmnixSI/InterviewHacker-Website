# Final 风格维护说明

`/final/`（中文）与 `/final/en/`（英文）是最终版页面。设计语言：暖纸白与墨色，克制留白；两路声音各有一色——琥珀是对方（系统声音），靛蓝是你（麦克风）。

## 源码与生成

| 内容 | 位置 |
| --- | --- |
| 双语页面源码（`{{ 中文 ‖ English }}`） | `scripts/final-i18n/page.html` |
| 演示脚本（四个场景、改写版本） | `scripts/final-i18n/demo.json` |
| 生成两页并为 CSS/JS 加内容哈希 | `scripts/build-final.mjs`（`npm run final:build`，`--check` 在 `npm run check` 中运行） |
| 定制手写字形 “next line.” | `scripts/final-lettering.mjs`（骨架点 → Catmull-Rom → 贝塞尔，13° 斜切，按笔顺排列） |
| 样式 | `public/final/style.css` |
| 脚本 | `public/final/scripts/`：`bootstrap` 暂停状态、`theme` 图片源、`field` 水面与声场、`demo` 演示与滚动导览、`motion` 页面编排、`cursor` 指针交互、`fps` |

不要直接修改 `public/final/index.html` 或 `public/final/en/index.html`；改源码后运行 `npm run final:build`（`npm run docs:sync` 已包含）。

## 字体

全部为 SIL OFL 1.1，子集化后随站分发（约 200 KB，原先 Story 为两个 8.2 MB TTF）：

| 用途 | 字体 | 子集文件 |
| --- | --- | --- |
| 中文标题、字标 | 得意黑 Smiley Sans Oblique v2.0.1（改名 IH Display） | `assets/fonts/display/ih-display.woff2` |
| 正文与界面 | Noto Sans SC 可变字重，限定 400–500（改名 IH Sans） | `assets/fonts/sans/ih-sans.woff2` |
| 英文版标题、衬线注记 | Instrument Serif 正体与斜体 | `assets/fonts/serif/` |
| 英文界面与注记 | Geist、Geist Mono | `assets/fonts/geist/` |

得意黑保留了 “Smiley”“得意黑”，思源黑体保留了 “Source” 字体名，因此子集改名。HarmonyOS Sans 的许可禁止修改字体，无法子集化，本页不使用。

页面文字有新字时需要重新子集化：下载上述原字体到某个目录，执行

```sh
pip install fonttools brotli
npm run final:build
npm run fonts:final -- <原字体目录>
npm run final:build
```

`assets/fonts/charset.json` 记录已覆盖字符；`npm run check` 会报出页面中未覆盖的汉字。

## 叙事与结构

页面讲「时刻」而不是技术：首屏一句话 → 随滚动播放的一场面试 → 回旋的序 → 五个时刻（面试、报告、谈判、网课、会后）→ 手机伴侣 → 三条隐私原则 → 早期试用（页面在这里结束，没有页脚）。按维护者要求不写模型、架构、体积与规格数字，也不设规格表和常见问题；必需的使用前提（系统、仓库访问权、语音识别 + 对话服务、演示为交互示意）合成一句小字放在下载按钮下方。全站只有浅色。

- 回旋的序（参考 ambi.ai 的 textArc）：宽屏时整段固定，几组短句随滚动从屏幕下方升起、越过中间那团缓慢旋转的“声音”（琥珀与靛蓝的模糊锥形渐变加颗粒），经过中线时横向偏移最快，进出屏幕时带模糊淡入淡出；文字移动比页面滚动慢（行程 × 1.7）。窄屏、减少动态效果时为静态错落排版。
- 颗粒消融边缘：水面（`POOL`）与结尾水面（`SHORE`）在着色器里用逐像素随机阈值让边缘溶进纸色；窄屏卡片背后的水面用 SVG 滤镜 `#f-dissolve`（feTurbulence + 离散阈值）做同样的效果。
- 结尾：产品尚未公开下载，结尾为整屏的“即将开放试用”。深色水面上两路声音从各自位置扩散涟漪并在中间交汇，鼠标移动时“你”的声源跟随指针、划过水面留下波纹；只有上边缘溶进纸色，水面一直铺到页面底部，版权、语言与画廊链接以小字放在水面底部。
- 试用名单：“加入试用名单”让标题沉入水面、升起一张磨砂玻璃表单（称呼、邮箱、用途多选、更多）。提交到 `api/waitlist.js`（Vercel 函数，无依赖），由维护者自己的邮箱经 SMTP 发信给自己；有蜜罐字段、长度与格式校验、每个地址十分钟 5 次的限制。无脚本时表单直接显示并以普通 POST 提交（CSP 为此改为 `form-action 'self'`，两份 `vercel.json` 一致）。
  - 需要在 Vercel 项目里设置环境变量（不要提交到仓库）：`SMTP_USER`（发信邮箱，如 QQ 邮箱地址）、`SMTP_PASS`（该邮箱的 SMTP 授权码：QQ 邮箱 → 设置 → 账号 → 开启 POP3/SMTP 服务 → 生成授权码）、可选 `WAITLIST_TO`（收件地址，默认同 `SMTP_USER`）。未设置时接口返回 503，页面提示“暂时没能提交”。
- 手机伴侣：宽屏时整段固定，滚动推进三拍——共享整个屏幕、扫码配对、问答只出现在手机上；手机为浅色钛金属边框，与电脑前后叠放在颗粒水面上，分别标注“对方看到的 / 只有你看到的”。滚动结束后手机交给读者，提示气泡依次指向“更简短 → 英文版 → 上一条”。窄屏时三拍在进入视野后自动播放。
- 由于这是试用名单页面，Final 不再显示仓库访问权与“语音识别 + 对话服务”的使用前提（`check.mjs` 对 Final 豁免这两项）；“交互示意”说明放在演示控件下方。
- 语言菜单：页头“ZH +”展开小浮层，列出两种语言、标出当前语言；切换时保留正在阅读的章节，支持跨文档视图过渡（淡出 + 轻微模糊）。

## 动效与交互

- 首屏「两遍识别」：标题按字（中文）或按词（英文）拆成格子，灰色草稿带错字逐个出现在定稿的位置上；一条靛蓝精修线扫过每一行，经过哪个字就把它翻成定稿字体，错字先划一道琥珀线再纠正；扫到行尾时草稿词 “next lion” 被划掉，定制字形按笔顺写出。每次打开都会播放，滚动、点击或按键立即跳到定稿；减少动态效果时直接显示定稿。
- 声波水面（`field.js`）：CPU 高度场模拟（约 6 CSS px 一格，120 Hz 固定步长，静止 3 秒后停止），鼠标划过按速度压出涟漪、点击投下一圈；斜率作为纹理上传，在着色器里折射两路声音的线并产生明暗。演示中说话的一方会在自己的线上落下细小涟漪。思路参考了 ambi.ai 公开站点的做法，代码与参数为独立实现。
- 滚动导览：宽屏且高度 ≥ 640 时首屏固定；前段两路声音收束成手写字的基线、设备升起，后段六步对话完全由滚动位置决定（`IHDemo.guide(p)`），可前后拖动；聚光标出每一步对应的界面区域，底部进度条说明步骤；结束后才出现场景、视图与改写控件，并提示「轮到你了」。窄屏、矮屏与减少动态效果时演示按时间自动播放。
- 窄屏（≤ 960px）：「五个时刻」不再用固定的水面舞台，每个时刻自带一张窗口卡片（由 `motion.js` 从舞台复制，水面 WebGL 不启动）；手机宽度（≤ 640px）下演示窗口改为 4:5 竖向窗口、字号 12px，首屏两路声音与文案共用一个网格单元，波形始终在文案下方；悬浮的「风格画廊」按钮隐藏，改由页脚链接提供。验证用 Chrome DevTools 协议模拟 iPhone（390 × 844、触屏）和 320 × 640。
- 五个时刻：左侧固定的水面上浮着该时刻的小窗（提词条、幻灯跟随、手机伴侣、截图提问、复盘），随右侧章节切换并在水面投下一圈涟漪；手机上水面固定在上方。
- 手机伴侣（`companion.js`）：进入视野时，手机取景框扫描 Mac 上的配对码，两台设备之间连线后回答流式出现；回答、更简短、举例、换语言、上一条 / 下一条、取消与字号按钮都可用，对应产品文档里的遥控按钮。
- 指针（`cursor.js`，仅精确指针且允许动效）：墨点加圆环光标，在可操作元素上收成一个靛蓝小点，只有下载、外链和手写字会在指针右下角显示一个小标签；首屏标题与页脚字标按与光标的距离起伏；悬停手写字会重写一遍；卡片边缘跟随指针发光；按钮从进入的一侧填色；设备随指针轻微倾斜。
- WebGL 不可用时显示 SVG 波形与渐变水面；暂停按钮、标签页隐藏、离屏时停止所有循环；`?fps` 显示帧率。动画只改 transform 与 opacity，移动元素不使用滤镜与背景模糊。

## 事实来源

文案依据产品 README 与 v1.9.0 发布说明：屏幕可选窗口 / 显示器 / 区域、持久导入队列（512 MiB、2000 页）、手机伴侣自建加密中转（Android 调试版，iOS 未提供）、联网修订由用户手动应用。页面不出现检索等待、向量维度、模型名称与下载体积等数字；不宣称“无法被检测”。

## 预览截图

`public/previews/final-home.png` 为 1280 × 844 浅色首页。可用本机 Chrome 无头模式重新截取：

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --blink-settings=preferredColorScheme=1 --window-size=1280,844 --virtual-time-budget=9000 --screenshot=public/previews/final-home.png http://127.0.0.1:4173/final/
```

## 部署到 EdgeOne Pages（腾讯云海外站）

- 仓库根目录的 `edgeone.json` 与 `vercel.json` 对应：同样运行 `npm run check && npm run build`，只发布 `dist`（否则会把整个仓库，包括 README 与 package.json，公开出去），安全响应头与 Vercel 一致（`scripts/check.mjs` 会校验）。
- 试用名单在 EdgeOne 上由 `cloud-functions/api/waitlist.js` 处理，与 Vercel 的 `api/waitlist.js` 共用校验与发信代码；需在 EdgeOne 项目的环境变量里同样设置 `SMTP_USER`、`SMTP_PASS`（可选 `WAITLIST_TO`）。表单提交到 `/api/waitlist`：EdgeOne 直接路由到函数，Vercel 以 308 转到带斜杠的地址并保留 POST。
- EdgeOne 自动分配的 `*.edgeone.dev` 地址在中国大陆只返回 401（需要控制台生成的临时预览链接），`*.vercel.app` 在中国大陆被屏蔽；面向国内用户必须绑定自有域名。
