# 宣传站验证

日期：2026-10-21。实际浏览器为本机 ChatGPT in-app browser / Chromium，未宣称 Safari 或真实手机硬件测试。

## 已验证

- 320×740、390×844、768×1024、1280×720 响应式视口均无文档横向溢出；检查首屏、产品卡片与配置区。
- 首屏场景切换更新问题、回答与选择状态；重播重新开始打字。示意内容不访问音频或模型。
- 工作流选项卡更新标题、描述、要点与图片；左右方向键可以切换，并同步 aria-selected、tabindex、tabpanel 标签。
- 点击应用截图打开大图 dialog；关闭后恢复交互。
- 移动菜单打开、导航跳转与自动收起。
- 下载 dialog 能打开与关闭，真实目标为 v1.8.0 Releases，显示私有仓库访问要求。
- 可选组件 4 种组合：关闭 0 MB，语义检索约 835 MB，本机 OCR 约 1.42 GB，二者约 2.07 GB；开启时已含共享运行包约 186 MB。下载与安装占用分别说明。
- FAQ 展开显示关键词检索与语义召回的实际区别。
- 模拟 prefers-reduced-motion: reduce 后回答立即完整出现，CSS 取消动画，canvas 不启动动画循环。测试后恢复媒体和视口覆盖。
- JS 语法、内部资源引用、锚点、唯一 ID、单一 h1、必要产品说明与 vercel.json 检查通过。
- 本地浏览器 console 无应用 warning/error；无损坏图片。
- 首次 Vercel Production 返回 READY，正式别名 `interviewhacker.vercel.app` 可未认证 HTTP 200 访问；CSP、Permissions-Policy、X-Content-Type-Options 已生效。

最终上线后的静态文件 SHA-256 校验与截图另存于 validation/。站点为浏览器交互与展示层验证，不代表重新验证桌面应用音频、OCR 或 AI 准确度。

## 上线前发现并修复的回归

在实际 985 CSS 像素宽度，长提词卡曾覆盖场景切换区域。已将绝对定位卡片改为参与布局的自适应高度，控制区始终留出独立空间。修复后逐一点击四种场景，问题文字与 aria-pressed 均正确改变；实际 320 CSS 像素宽度、减少动态效果模式下，四个完整回答均无文档溢出，卡片与切换区域保持约 75px 间距。另收起极窄屏顶栏的重复下载入口（首屏主按钮仍可用）。

最终 Production 部署：`dpl_E7sH2rAe77Lati4JjTU8zLZD1r62`，状态 READY。14 个公开文件未认证访问均 HTTP 200 且 SHA-256 与 dist 完全一致；线上四种场景逐一点击通过，全部工作流选项卡与 Escape 关闭 dialog 通过，线上浏览器无 warning/error。首次部署与后续修改产生的正式部署记录保留供回滚，不删除可恢复历史。
