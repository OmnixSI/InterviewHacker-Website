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

## 常见修改位置

| 内容 | 文件 |
| --- | --- |
| 页面结构、主要文案、元信息 | `public/index.html` |
| 色彩、排版、响应式和 CSS 动效 | `public/style.css` |
| 场景、技术节点、按钮与滚动叙事 | `public/app.js` |
| 粒子、GPU 形态和 Canvas 备用渲染 | `public/engine.js` |
| 图片、字体与分享卡片 | `public/shots/`、`public/assets/`、`public/og.png` |
| 部署和响应头 | `vercel.json`、`public/vercel.json` |

## 提交与审核

```sh
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
