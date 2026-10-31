# Signature 风格维护说明

Signature 位于 `/signature/`（中文）和 `/signature/en/`（英文），是独立的产品官网候选。根路径继续作为风格画廊，`/compare/` 用于评审；新增页面不自动改变正式站入口。路线比较与部署基线见 [SIGNATURE-DESIGN-REVIEW.md](./SIGNATURE-DESIGN-REVIEW.md)。

## 1. 设计与内容来源

核心结构是“同一场会，准备、接话、留下下一步”。首屏有明确产品说明、等待名单入口和可操作窗口；随后用三段内容、手机伴侣、信息处理边界、问答与邮箱表单补足理解。

- **Classic**：吸收设备与工作链路的秩序。
- **Final**：保留暖纸、墨色、手写和轻量的声音隐喻。
- **Final v2**：吸收一场会议一页、会议类型、资料、回答与纪要之间的关系。
- **Turn**：吸收两路声音与主动拨弦的辨识度，保留 Turn 本身为独立作品。

主色从暖纸推进到深梅色手机段，再以柔粉纸收尾。当前 CSS 使用分段纸色和局部渐变；它不是 Turn 的全页时钟与连续换色系统。主标题使用衬线字体，界面和正文保持清晰的无衬线层级；手写只承担短句与边注。

产品能力映射以仓库已有 `docs/FINAL-NOTES.md`、`docs/TURN-NOTES.md`，以及 PR #4 对 v2 产品资料的映射为依据。示例由本站静态数据编排，窗口用 HTML/CSS 绘制；**不是软件截图、软件录屏或在线模型输出**。维护文案时应继续核对桌面产品的 README、发布说明和实际行为。

外部参考采用 Granola 的会议阶段组织、Linear 的具体产品内容、Raycast 的机制同源交互及获奖作品的排版原则；原始官方链接集中在设计评审文档。没有使用这些产品的客户、口碑或转化数据作本站背书。

## 2. 源码入口

| 内容 | 编辑位置 |
| --- | --- |
| 页面外壳、元数据、导航和页脚 | `scripts/signature-i18n/page.html` |
| 首屏窗口、阶段控件、场景选择与声弦 | `scripts/signature-i18n/parts/hero.html` |
| 三阶段说明、手机伴侣、信息处理边界 | `scripts/signature-i18n/parts/story.html` |
| 问答、等待名单与返回状态 | `scripts/signature-i18n/parts/close.html` |
| 双语场景、回答变体、纪要、动态提示 | `scripts/signature-i18n/demo.json` |
| 生成双语 HTML 与 CSS/JS 内容哈希 | `scripts/build-signature.mjs` |
| 字体、排版、响应式、减弱动效与无脚本布局 | `public/signature/style.css` |
| 初始增强标记与动效偏好 | `public/signature/scripts/bootstrap.js` |
| 产品状态、控件、表单提交与语言定位 | `public/signature/scripts/main.js` |
| Canvas 声弦、合成声音与生命周期 | `public/signature/scripts/voice.js` |
| 中文字体子集与实际字符覆盖记录 | `scripts/signature-fonts.py`、`public/signature/assets/fonts/charset.json` |
| 静态交付检查 | `scripts/check-signature.mjs` |
| 共用表单后端与纯函数测试 | `api/waitlist.js`、`scripts/test-waitlist.mjs` |

双语文本使用 `{{ 中文 ‖ English }}`；手写由 `scripts/turn-lettering.mjs` 的构建函数生成 SVG。不要直接编辑 `public/signature/index.html` 或 `public/signature/en/index.html`：它们是提交入库的生成结果。

## 3. 产品交互约定

窗口有 `before`、`live`、`after` 三个阶段；每阶段可使用 `meeting`、`interview`、`research` 三组场景数据。回答有 `base`、`short`、`example`、`english` 四种变体。`english` 是既有字段名：在英文页面实际切换为中文。改动结构或字段时需同步模板、数据、脚本和检查器。

阶段 Tab 支持方向键、Home / End；纪要时间点返回对应对话；“只记录”隐藏回答并呈现记录状态。手机伴侣切换演示回答所在设备，不建立实际配对、远程连接或屏幕共享。共享或镜像手机后其内容仍可见，不能扩写为隐身承诺。

所有示例交互在浏览器本地完成；页面不调用 AI、不请求麦克风、不收集真实音频，也不自动发送遥测。交互示意里的“本机转写”等描述解释桌面产品，不表示网页正在执行转写。

## 4. 动效、声音与降级

- 原生锚点与滚动保持可用，没有强制固定滚动导览。入场是内容已可读后的轻量增强。
- 顶部与页脚暂停按钮共用 `data-motion`，偏好仅保存在本机。系统 `prefers-reduced-motion` 优先，页面不能强行重新开启动效。
- 声弦使用 Canvas 2D，带静态 SVG 后备。鼠标经过、触控与“对方 / 你”按钮可触发拨弦；不捕获触控滚动。
- `AudioContext` 只在用户主动开启声音后创建；每次访问默认关闭。产品控件通过 `signature:voice` 事件强化视觉隐喻，不触发后台连续声音。
- `signature:motion`、离屏、标签页隐藏与 `pagehide` 负责停止动效和声音。暂停状态不阻止产品内容切换。
- 无脚本时三阶段内容顺序显示、依赖脚本的控件隐藏、表单保持原生 POST；结果通过 `#waitlist-*` 与 `:target` 显示。此路径仍需要实际部署的表单后端。

小屏将核心问答改为纵向排列，并收起装饰侧栏。维护时分别核对中英文换行、最长回答、页面溢出、表单和手机示意，而不是只按桌面截图缩放。

## 5. 等待名单与预览边界

邮箱必填，称呼和用途选填；没有填的字段按空值提交。`source` 为 `signature` 或 `signature-en`。共用后端保留 Final / Turn 兼容性，校验来源白名单，并通过维护者邮箱的 SMTP 发送申请；没有数据库入列证明。

前端只在 HTTP 成功且 JSON 明确为 `{ "ok": true }` 后显示收到申请。超时、网络错误、服务不可用或发送失败均保留输入供重试。SMTP 接受消息不等于收件箱已收到；**真实邮箱投递验收仍待维护者授权后完成**。

`npm run dev` 使用 `scripts/dev.mjs`：同源静态预览沿用部署安全头，`/api/waitlist` 明确返回 `503 / preview`，不导入邮件处理器、不发送或存储申请。原生无脚本 POST 也显示预览限制。Vercel 函数在 `VERCEL_ENV=preview` 时同样先返回 `preview`，不进入 SMTP；真实 handler 测试验证 JSON 和原生表单两条响应。不要把预览的失败文案改成模拟成功。其他托管平台需单独确认其环境标记，不能假定所有平台都会自动禁发邮件。

正式环境配置仍为 `SMTP_USER`、`SMTP_PASS`、可选 `WAITLIST_TO` / `SMTP_HOST` / `SMTP_PORT`；凭据不得写入仓库。现有限流是按暖实例记录，不是全局持久限流。

## 6. 字体、构建与更新顺序

字体全部同源分发，保留对应 OFL 许可。拉丁标题使用 Instrument Serif；拉丁正文 / 数字使用 Geist / Geist Mono；中文使用 Noto Sans SC、Noto Serif SC 的改名子集 `IH Signature Sans` / `IH Signature Serif`。中文原字库地址与修改说明在 `scripts/signature-fonts.py` 中。

页面或动态文案增加汉字后，使用原字体重新生成子集；`charset.json` 记录输出字体的实际 cmap。静态检查同时覆盖生成 HTML、示例 JSON 和动态脚本文字，两个语言页切换到中文示例时也不能缺字。

```sh
# 修改模板、demo.json、CSS 或 JS 后生成页面和资源版本。
npm run signature:build

# 只有汉字覆盖发生变化时，先准备 fonttools、brotli 和原字体目录。
python3 scripts/signature-fonts.py --src /path/to/original-fonts
npm run signature:build

# 在浏览器重新截取实际首页，更新 public/previews/signature-home.png。
# 影响画廊时同时更新 gallery-home.png，然后同步派生文件。
npm run docs:sync
npm run check
npm run build
```

站点运行无新增 npm 依赖。`npm run check` 已包含 Signature 页面一致性、链接 / 哈希 / 表单 / 数据 / 字体检查及等待名单纯函数测试。`npm run build` 生成 `dist`；不要手改或提交该输出目录。风格登记继续只编辑根 `styles.json`，再生成 `public/styles.json`、画廊和 README。

## 7. 验收与发布记录

本次实际验证范围记录在 [SIGNATURE-VALIDATION.md](./SIGNATURE-VALIDATION.md)。CI 和部署须以对应提交的真实结果为准：

| 项目 | 记录要求 |
| --- | --- |
| 静态检查与构建 | 命令、结果、对应提交 |
| 浏览器与移动端 | 实际检查的浏览器 / 尺寸、关键交互、键盘、减弱动效和无脚本结果 |
| 真实软件比对 | 实际软件录屏、布局与功能逐状态比对；当前仍待完成 |
| 邮件送达 | 获授权的真实提交及收件确认；当前仍待完成 |
| CI | 真实运行链接与状态；本地成功不能替代 |
| 预览 / 正式部署 | 分别记录部署 ID、源提交、状态和地址 |

发布到现有 Vercel 正式项目遵循 `AGENTS.md` 的维护者授权要求。开 PR 或合并不等于上线；页面路径存在于源码也不证明生产域名已经提供该页面。
