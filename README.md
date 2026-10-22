# InterviewHacker · Design Gallery

同一个产品，不同的表达。这个公开仓库收集 InterviewHacker 网站的不同设计风格，README 本身就是展示画廊。

**一个风格，一个固定入口。** 同一风格的日常优化在原页面继续维护；只有设计语言明显不同的新方案才新增路径，不为每次小修改建立一个对照版本。更新页面时，同步对应首页预览、访问地址和本 README。

## 风格展示

<!-- STYLES:START -->
[打开在线展示画廊](https://interviewhacker.vercel.app/) · [并排对比风格](https://interviewhacker.vercel.app/compare/)

[![展示画廊首页](public/previews/gallery-home.png?v=43a2e26e500f)](https://interviewhacker.vercel.app/)

<!-- gallery-source:8bed15c4fa849dd14ad454b07d32165f7c25b748b7ad9f4d2ea5ca5c559f3b2e preview:43a2e26e500f8a519a094645c46357ded39df1e1237203556dfc7fee875685b4 -->

### Minimal · 简洁 · 原生 · 从容

[![Minimal 首页](public/previews/minimal-home.png?v=c9ba18983c7b)](https://interviewhacker.vercel.app/minimal/)

温和紫色、玻璃提词卡与清晰的产品叙事，让功能与使用流程自然展开。

**访问页面：[https://interviewhacker.vercel.app/minimal/](https://interviewhacker.vercel.app/minimal/)**

<!-- style:minimal source:d9e2727b209895ebfee1c09c34dc975ac9b0452e2eb686a262d2489ad92bbcab preview:c9ba18983c7be7b2accdb3104a2a989c32163fb3b0c41aef71c6f6b58926be08 -->

### Technology · 技术 · 交互 · 沉浸

[![Technology 首页](public/previews/technology-home.png?v=a975b5668b9d)](https://interviewhacker.vercel.app/technology/)

粒子光场、深浅章节与可操控的技术链路，把声音到表达的过程变成体验。

**访问页面：[https://interviewhacker.vercel.app/technology/](https://interviewhacker.vercel.app/technology/)**

<!-- style:technology source:6ab4b4d80523e89040b345608ba63fea96ed516c44fc7ee8b6a69d8bf862c676 preview:a975b5668b9dba5982d2721dd348cb026f70bf95d7a2bf022dad91a7bb2e8839 -->

### Story · 产品 · 场景 · 精致

[![Story 首页](public/previews/story-home.png?v=8e8115bd48ad)](https://interviewhacker.vercel.app/story/)

鸿蒙字体与金属设备外框，配合可播放的实时演示、WebGL 声纹光场和滚动叙事，串联准备、实时辅助与复盘。

**访问页面：[https://interviewhacker.vercel.app/story/](https://interviewhacker.vercel.app/story/)**

<!-- style:story source:a5df895028c97b1c9374afe7b27554b08d29d4575268cc125a00dd0cfa25cfe6 preview:8e8115bd48ad3d47ac856ddcebf272031aee74955933c1d88c7aa67d30a781b1 -->

### Classic · 专业 · 严肃 · 设备叙事

[![Classic 首页](public/previews/classic-home.png?v=55b6324f4f19)](https://interviewhacker.vercel.app/classic/)

Story 的原始版本：鸿蒙字体、金属设备外框与连续的设备交接，克制的明暗章节串联准备、实时辅助与复盘。

**访问页面：[https://interviewhacker.vercel.app/classic/](https://interviewhacker.vercel.app/classic/)**

<!-- style:classic source:b98e5cbb2764b118d311d7fe32c39beb9f75e22b6d6765820a8e010b5caed340 preview:55b6324f4f19d54173d5a339187bd980e1186596c7672343d1872d037f002891 -->
<!-- STYLES:END -->

## 本地运行

需要 Node.js 24（与正式构建一致，可用 `nvm use`）；本地预览另需 Python 3。没有 npm 依赖。

```sh
git clone https://github.com/OmnixSI/InterviewHacker-Website.git
cd InterviewHacker-Website
npm run dev
```

打开 http://127.0.0.1:4173/ 为画廊；`/minimal/`、`/technology/`、`/story/` 和 `/classic/` 是四种独立风格，`/compare/` 为并排对比工具。对比工具不算一种设计风格，可分别操作两侧页面，并切换桌面版面或自适应视口。

## 修改与新增风格

| 内容 | 位置 |
| --- | --- |
| 风格名称、特点、入口、预览图路径 | `styles.json`（唯一登记来源） |
| 画廊布局与样式 | `public/index.html`、`public/gallery.css` |
| Minimal 全部页面代码和素材 | `public/minimal/` |
| Technology 全部页面代码和素材 | `public/technology/` |
| Story 全部页面代码和素材 | `public/story/` |
| Classic（Story 原始版本）全部页面代码和素材 | `public/classic/` |
| 并排对比工具 | `public/compare/` |
| 每个风格的当前首页截图 | `public/previews/<slug>-home.png` |
| 画廊自身的首页截图 | `public/previews/gallery-home.png` |

每种风格的 HTML、CSS、JavaScript、字体与产品图均独立放在自己的目录，避免修改一套风格时改变另一套。日常迭代直接修改对应目录。**只有全新的设计语言才新增 `public/<new-style>/` 并登记到 `styles.json`。**

完成视觉修改后，更新对应的真实首页截图，再运行：

```sh
npm run docs:sync
npm run check
npm run build
```

`docs:sync` 会把登记信息、截图、页面地址同步到在线画廊和 README。检查会比较当前源码与截图的指纹：README 过期、漏登记页面、入口或截图缺失时不通过。源码指纹写在 Markdown 注释中，不干扰画廊阅读；实际截图仍需维护者在浏览器中更新。

详细协作流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，代理维护约定见 [AGENTS.md](AGENTS.md)。GitHub Actions 自动执行检查与构建。

## 部署

线上地址为 https://interviewhacker.vercel.app/ 。现有 Vercel 项目为 `interviewhacker`；本仓库目前尚未连接 Git 自动部署，单独 push 不会自动改变正式站。

根目录 `vercel.json` 用于 Git 导入：Framework Other，Build `npm run check && npm run build`，Output `dist`，无依赖安装命令。沿用现有项目连接仓库，避免创建重复项目影响域名。

`public/vercel.json` 用于纯静态文件发布；两份安全响应头须保持一致。页面只允许被同源画廊嵌入，供 `/compare/` 使用。发布后可执行 `node scripts/verify-live.mjs` 核验线上文件。

## 产品与素材

本仓库只包含网站，不包含桌面应用、安装包、模型权重、用户资料或凭据。演示不采集音频、不调用模型、不发送遥测。桌面应用下载仍指向其私有 GitHub Releases，需要相应访问权。

Minimal 从已发布的第一版恢复；Technology 为 Think in Flow 技术展示风格，Story 来自已合并的 PR #1，以场景摄影与产品流程展开叙事。设计依据见 [COMPETITION-DIRECTION.md](COMPETITION-DIRECTION.md)，既有验证见 [VALIDATION-COMPETITION.md](VALIDATION-COMPETITION.md)，画廊与路径迁移验证见 [VALIDATION-GALLERY.md](VALIDATION-GALLERY.md)，Story 接入验证见 [VALIDATION-STORY.md](VALIDATION-STORY.md)。

Technology 分享图生成工具保留在 `scripts/`：`python3 scripts/make-og.py` 后，可在 macOS 使用 `swift scripts/render-og.swift scripts/og.svg public/technology/og.png` 更新对应分享图（与首页截图分开维护）；字体许可见 [FONT-LICENSE.txt](FONT-LICENSE.txt)；Story 的 HarmonyOS Sans 与 Geist / Geist Mono 字体许可保留在 `public/story/assets/fonts/` 子目录；Story 本地打包的 GSAP 与 Lenis 版本和许可见 `public/story/assets/vendor/README.md`。当前未附加通用开源许可证，产品名称、截图及其他素材保留原有权利。

不要提交 token、私钥、`.vercel/`、`dist/` 或本机 `validation/` 输出。

### Story 部署维护

Story 保留用户提供源码的独立样式、主题、共享动效及页面脚本加载顺序；不要重新合并为不透明的 app.js。`npm run docs:sync` 会为所有 Story CSS / JS 入口计算内容版本，避免已缓存的旧资源混入新页面。字体、图片及视口尺寸变化后会重新测量滚动区间。

Story 使用本地随站分发的 HarmonyOS Sans SC Regular / Medium，保留原始字体文件与许可，页脚展示字体署名。`public/story/` 为当前维护入口，修改后同步首页截图、README 与线上地址。

Story 产品画面由 `scripts/story-screens.mjs` 生成：运行 `npm run screens:build` 更新 12 组浅色 / 深色矢量界面，再检查页面、更新首页截图并 `npm run docs:sync`。画面与文案的对应表、合成来源及维护约定见 [Story 产品展示](docs/STORY-ARTWORK.md)。

Story 动效与手机适配由 `styles/motion-polish.css` 和 `scripts/motion-polish.js` 维护：入场采用缓出曲线，设备位移由滚动进度控制；触屏场景卡片使用原生滑动，支持定位按钮及系统减少动态效果。修改后需复核 320–430 手机竖屏、短横屏、平板和桌面，更新实际首页预览。部署前须完成检查和构建并等 CI 通过；发布后确认正式别名与逐文件校验成功。

首页首图由 `scripts/hero-handoff.js` 维护单一设备的连续交接，禁止在锚点与目标位置同时淡入两台完整设备。文案与设备共享视口进度；原左右场景叙事继续保留。手机窄屏、短横屏及初始减少动态效果访问采用顺序阅读。设备材质、界面与双路识别动线仍在 `scripts/story-screens.mjs` 编辑。
