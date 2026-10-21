# 技术展示改版验收

2026-10-21；本机 ChatGPT in-app browser / Chromium。以下为网页验证，没有重测桌面产品音频或 AI 准确率。

- 实际 CSS 视口 320、390、768、1280 px：文档 scrollWidth 与 innerWidth 一致；图片无损坏。
- WebGL 编译、链接和实际绘制通过。readPixels 检查有非零像素，GL error=0；不是仅用渲染器状态文案代替绘制结果。
- 三种粒子形态按钮、信号注入与暂停/恢复装饰动画通过。
- 原生滚动后章节分别进入 01 声音 / 02 语境 / 03 表达，标题、解释与视觉同步。
- 控制台四个技术节点可切换；方向键可切换并更新 aria-selected / tabindex / panel 标签；运行链路结束在流式响应节点，并恢复重播按钮。
- 模拟 WebGL 上下文丢失，自动切换 Canvas；两个 canvas 仍为独立且唯一的 signal-field / story-field ID。测试后刷新恢复 WebGL。
- 320 px 和 prefers-reduced-motion: reduce 下，四种场景完整文本可切换；故事改为非 sticky 静态阅读，三段说明可见。
- 关闭 JavaScript 后刷新，故事仍保留静态内容与完整产品信息。测试后恢复脚本、媒体和视口覆盖。
- OCR 与向量双开估算仍为 2.07 GB；只是本地演示，不触发下载。
- 没有新增外部字体、遥测、音频、AI 请求或播放声音。
- 浏览器无应用脚本 warning/error。GPU 故障测试是人工注入场景，不视为正常运行故障。

生产状态、文件校验和截图在 validation/；最终部署后补充记录。

正式部署 `dpl_GM3rrwW2GLysMzH4Y5MhAtztRaAu` 已 READY；正式域名公开访问正常。15 个公开文件 HTTP 200、SHA-256 与 dist 全部一致（另 1 个 Vercel 配置文件由平台消费）。线上 GPU 渲染、粒子模式切换、下载 dialog 打开与 Escape 关闭通过，正常运行 console 无 warning/error。静态文件合计 858,570 字节。

收尾：正式站首屏、滚动叙事、技术节点与手机截图已保存；临时视口/媒体/脚本覆盖均恢复，参考页与后台验收页关闭，正式网站标签保留。本轮开发服务器已停止，一次性迁移脚本已删除。
