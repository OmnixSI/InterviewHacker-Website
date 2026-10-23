# Final 风格维护说明

`/final/`（中文）与 `/final/en/`（英文）是集合 Story、Classic、Technology 长处的最终版页面。设计语言：暖纸白与墨色，两路声音各有一色——琥珀是对方（系统声音），靛蓝是你（麦克风）。动效只演示产品真实机制。

## 源码与生成

| 内容 | 位置 |
| --- | --- |
| 双语页面源码（`{{ 中文 ‖ English }}`） | `scripts/final-i18n/page.html` |
| 演示脚本（四个场景、改写版本） | `scripts/final-i18n/demo.json` |
| 生成两页并为 CSS/JS 加内容哈希 | `scripts/build-final.mjs`（`npm run final:build`，`--check` 在 `npm run check` 中运行） |
| 定制手写字形 “next line.” | `scripts/final-lettering.mjs`（骨架点 → Catmull-Rom → 贝塞尔，13° 斜切，按笔顺排列） |
| 产品场景图（由 Story 生成后改配色、去 SVG 滤镜） | `scripts/final-scenes.mjs` |
| 样式 | `public/final/style.css` |
| 脚本 | `public/final/scripts/`：`bootstrap` 主题与暂停、`theme`、`field` 双声道 WebGL 声场、`demo` 演示引擎、`motion` 页面编排、`fps` |

不要直接修改 `public/final/index.html` 或 `public/final/en/index.html`；改源码后运行 `npm run final:build`（`npm run docs:sync` 已包含）。

## 字体

全部为 SIL OFL 1.1，子集化后随站分发（约 200 KB，原先 Story 为两个 8.2 MB TTF）：

| 用途 | 字体 | 子集文件 |
| --- | --- | --- |
| 中文标题、字标 | 得意黑 Smiley Sans Oblique v2.0.1（改名 IH Display） | `assets/fonts/display/ih-display.woff2` |
| 正文与界面 | Noto Sans SC 可变字重，限定 400–500（改名 IH Sans） | `assets/fonts/sans/ih-sans.woff2` |
| 英文版标题 | Instrument Serif | `assets/fonts/serif/instrument-serif.woff2` |
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

## 动效与降级

- 首屏「两遍识别」：等宽草稿带错字流式出现 → 划掉纠正 → 交叉淡入得意黑定稿，定制字形按笔顺写出。滚动、点击或按键立即跳到定稿；减少动态效果和同一会话再次访问时直接显示定稿。
- 「声纹成字」：宽屏且高度 ≥ 640 时首屏固定，两路波形随滚动收束成一条墨线，落在演示标题手写字的基线上，随后设备升起放平。窄屏、矮屏与减少动态效果时按普通顺序阅读。下载区为同一动效的短版。
- 演示为本地预设脚本，不访问麦克风、模型或网络；支持场景切换、改写、⌘⇧↩、工作台 ⇄ 提词器（Flip）与回声恢复。
- WebGL 不可用或上下文丢失时显示 SVG 波形；暂停按钮、标签页隐藏、离屏时停止所有循环；`?fps` 显示帧率。
- 动画只改 transform 与 opacity；移动元素不使用 blur、filter 或 backdrop-filter，场景 SVG 已去掉投影滤镜。

## 事实来源

文案依据产品 README 与 v1.9.0 发布说明：屏幕可选窗口 / 显示器 / 区域、持久导入队列（512 MiB、2000 页）、手机伴侣自建加密中转（Android 调试版，iOS 未提供）、联网修订由用户手动应用。500 ms 仅表示语义检索等待上限，1024 维仅表示可选本地向量规格，0.6 s 为问题结束后开始回答的大致时间；页面不宣称“无法被检测”。

## 预览截图

`public/previews/final-home.png` 为 1280 × 844 浅色首页。可用本机 Chrome 无头模式重新截取：

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --blink-settings=preferredColorScheme=1 --window-size=1280,844 --virtual-time-budget=9000 --screenshot=public/previews/final-home.png http://127.0.0.1:4173/final/
```
