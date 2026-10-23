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

页面讲「时刻」而不是技术：首屏一句话 → 随滚动播放的一场面试 → 错落的序 → 五个时刻（面试、报告、谈判、网课、会后）→ 三条隐私原则 → 规格表 → 问答 → 下载。所有技术数字只出现在规格表与问答里。全站只有浅色。

## 动效与交互

- 首屏「两遍识别」：等宽草稿带错字流式出现 → 划掉纠正 → 得意黑定稿，定制字形按笔顺写出；滚动、点击或按键跳到定稿，减少动态效果与同一会话再次访问直接显示定稿。
- 声波水面（`field.js`）：CPU 高度场模拟（约 6 CSS px 一格，120 Hz 固定步长，静止 3 秒后停止），鼠标划过按速度压出涟漪、点击投下一圈；斜率作为纹理上传，在着色器里折射两路声音的线并产生明暗。演示中说话的一方会在自己的线上落下细小涟漪。思路参考了 ambi.ai 公开站点的做法，代码与参数为独立实现。
- 滚动导览：宽屏且高度 ≥ 640 时首屏固定；前段两路声音收束成手写字的基线、设备升起，后段六步对话完全由滚动位置决定（`IHDemo.guide(p)`），可前后拖动；聚光标出每一步对应的界面区域，底部进度条说明步骤；结束后才出现场景、视图与改写控件，并提示「轮到你了」。窄屏、矮屏与减少动态效果时演示按时间自动播放。
- 五个时刻：左侧固定的水面上浮着该时刻的小窗（提词条、幻灯跟随、手机伴侣、截图提问、复盘），随右侧章节切换并在水面投下一圈涟漪；手机上水面固定在上方。
- 指针（`cursor.js`，仅精确指针且允许动效）：墨点加圆环光标，在可操作元素上展开为带字的胶囊（下载、切换、试一试、阅读）；首屏标题与页脚字标按与光标的距离起伏；悬停手写字会重写一遍；卡片边缘跟随指针发光；按钮从进入的一侧填色；设备随指针轻微倾斜。
- WebGL 不可用时显示 SVG 波形与渐变水面；暂停按钮、标签页隐藏、离屏时停止所有循环；`?fps` 显示帧率。动画只改 transform 与 opacity，移动元素不使用滤镜与背景模糊。

## 事实来源

文案依据产品 README 与 v1.9.0 发布说明：屏幕可选窗口 / 显示器 / 区域、持久导入队列（512 MiB、2000 页）、手机伴侣自建加密中转（Android 调试版，iOS 未提供）、联网修订由用户手动应用。500 ms 仅表示语义检索等待上限，1024 维仅表示可选本地向量规格，0.6 s 为问题结束后开始回答的大致时间；页面不宣称“无法被检测”。

## 预览截图

`public/previews/final-home.png` 为 1280 × 844 浅色首页。可用本机 Chrome 无头模式重新截取：

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --blink-settings=preferredColorScheme=1 --window-size=1280,844 --virtual-time-budget=9000 --screenshot=public/previews/final-home.png http://127.0.0.1:4173/final/
```
