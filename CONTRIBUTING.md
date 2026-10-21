# 协作指南

## 开始修改

需要 Node.js 24+，本地预览另需 Python 3。没有 npm 依赖，无需安装依赖即可检查和构建。

```sh
git clone https://github.com/OmnixSI/InterviewHacker-Website.git
cd InterviewHacker-Website
git switch -c feat/your-change
npm run dev
```

浏览器打开 http://127.0.0.1:4173 。

## 风格与展示画廊

README 是风格展示画廊。**只有设计语言明显不同的新方案才增加一个风格入口**；文案、修复、动效与布局优化继续维护原路径，通过 Git 历史追踪，不建立每次更新的对照副本。

| 内容 | 文件 |
| --- | --- |
| 风格登记、特点和固定地址 | `styles.json` |
| 画廊主页 | `public/index.html`、`public/gallery.css` |
| 简洁紫色风格 | `public/minimal/` |
| 技术沉浸风格 | `public/technology/` |
| 并排对比工具 | `public/compare/` |
| 真实首页预览 | `public/previews/<slug>-home.png`、`gallery-home.png` |
| 部署和响应头 | `vercel.json`、`public/vercel.json` |

每套风格独立保留 HTML、CSS、JS、字体和图片，资源使用相对路径，规范链接与分享地址指向该风格路径。新风格复制所需素材时保留授权声明，并在 HTML 内保留返回画廊的入口。

页面改动完成后：

1. 在浏览器检查桌面与窄屏布局、交互和资源加载。
2. 视觉变化时刷新对应真实首页截图；新增风格时先登记 `styles.json`。推荐桌面视口 1280 × 844，使用 PNG。截图必须展示实际页面，不能使用 OG 分享图冒充。
3. 运行 `npm run docs:sync`，同步 README、画廊卡片和公开风格列表。
4. 若画廊外观发生变化，刷新 `gallery-home.png`，再次运行同步。
5. 确认 README 展示当前首页和正确在线地址，再检查、构建、提交。

`docs:sync` 不自动拍摄截图。CI 校验登记、入口、图片文件、源码指纹和 README 是否同步；维护者负责截图与真实视觉的一致性。修改源码但未同步 README 会使检查失败。对比工具自动读取登记列表，不需要为普通更新添加新选项。

## 提交与审核

```sh
npm run docs:sync
npm run check
npm run build
git add .
git commit -m "Describe the change"
git push -u origin feat/your-change
```

提交 Pull Request，说明变更原因和验证结果。涉及 UI 时附桌面与手机截图；涉及动效时检查减少动态效果和暂停控制；涉及渲染时检查 GPU 备用路径。

有写权限的组织成员可在本仓库开分支。没有写权限时，先 Fork，再从自己的分支提交 PR；如需直接写权限，由组织维护者分配。沿用组织当前权限设置，不通过本仓库流程扩大组织权限。

GitHub Actions 只执行静态检查与构建，不调用录音、模型、AI 服务或正式部署。当前网站仍由现有 Vercel 项目维护者发布。要接入 Git 自动部署，请由有权管理现有 Vercel 项目的成员按 README 配置连接；不要把 GitHub/Vercel token 提交到仓库。

## 资源与产品事实

字体遵循 `FONT-LICENSE.txt`。新增素材需确认可公开使用并保留相应声明。产品功能和数字必须如实描述，不能把外部模型称为自主训练模型，也不能把网页示意当作真实音频或 AI 测试结果。

公开源码不自动授予通用开源许可证；当前协作以本项目及组织维护者的授权为准。
