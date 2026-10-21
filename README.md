# InterviewHacker 宣传站

线上地址：**https://interviewhacker.vercel.app**

网站源码：**https://github.com/OmnixSI/InterviewHacker-Website**

![Think in Flow 宣传站](public/og.png)

本仓库只包含宣传网站。桌面应用、安装包、模型和用户资料不在本仓库内。组织成员协作方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。

网站为可编辑的静态 HTML / CSS / ES Modules，无前端依赖或服务端，不接收录音，不调用 AI API，不采集分析事件。

## 本地与构建

需要 Node.js 24+；本地预览需要 Python 3。没有 npm 依赖，无需执行依赖安装。

```sh
npm run dev     # http://127.0.0.1:4173
npm run check   # JS 语法、资源、锚点、产品说明与配置
npm run build   # 产物 dist/
```

`public/` 是完整发布源，`scripts/` 是检查、打包与分享图生成代码。分享图源 `scripts/og.svg`，通过 `python3 scripts/make-og.py` 生成，在 macOS 生成 PNG：

```sh
swift scripts/render-og.swift scripts/og.svg public/og.png
```

## 设计与交互

当前设计为 **Think in Flow** 技术展示版，围绕声音 → 语境 → 表达的叙事。设计研究与技术归属见 `COMPETITION-DIRECTION.md`。

- 自建 WebGL 引擎：3,600 粒子形态变换、指针视角与信号脉冲；无需图形库。GPU 不可用或丢失时自动使用 Canvas 备用画面。
- 大字号与深浅章节，原生滚动驱动形态、标题和解释；没有滚动劫持。
- 技术控制台：双路感知、两遍识别、上下文编排、流式响应，支持节点、方向键与逐步演示。
- 暂停装饰动效、减少动态效果、无脚本静态阅读路径、图片灯箱、原生 dialog、移动导航。
- 四场景提词与可选模型配置预览继续保留；不访问录音或 AI 服务。
- 外部模型名称收进必要说明，产品文案聚焦实际实现的处理管线；没有模型自主研发或获奖声明。
- 仅本机托管字体与图片，全部生产文件仍小于 1 MB（未压缩）。

## 产品边界

内容对齐 v1.8.0 README 与实际实现。语音和对话是核心，OCR 和向量模型可选。不启用向量时仍是关键词片段检索。没有声称所有回答离线、固定响应耗时或录屏绝对不可见。

下载按钮打开说明后前往 v1.8.0 GitHub Releases。仓库当前是私有，下载需要相应访问权；本次没有公开安装包或变更仓库可见性。

## Vercel

正式站由现有 `interviewhacker` 项目承载，本仓库目前尚未连接 Git 自动部署。向 GitHub 推送不会自动改变正式站。

导入或连接 Vercel 时选择仓库根目录，不必填写内部项目 ID 或团队 ID：

| 设置 | 值 |
| --- | --- |
| Framework | Other |
| Root Directory | 仓库根目录 |
| Build Command | `npm run check && npm run build` |
| Output Directory | `dist` |
| Install Command | 留空；没有 npm 依赖 |

根目录 `vercel.json` 已包含这些设置以及现有安全响应头。`public/vercel.json` 兼容纯静态文件发布；修改响应头时保持两份一致。

继续使用现有正式域名时，须由维护者在已有 Vercel 项目中连接此仓库，避免另建项目影响域名。Production 公开、Preview 沿用项目的访问保护设置。Canonical、Open Graph、robots 和 sitemap 均使用正式域名。

如需核验已发布页面与本机构建一致：

```sh
npm run build
node scripts/verify-live.mjs
```

该命令只读线上文件，在本地忽略目录 `validation/` 写入校验记录。

## 自动检查

GitHub Actions 对 main 推送和 Pull Request 执行 JS 语法、内部资源、锚点、文案约束及静态构建检查。工作流仅有仓库读取权限，不需要任何 token 或模型服务密钥；不会自动部署。

## 素材来源

复用用户压缩包中的四张产品演示截图与 Geist / Geist Mono 拉丁字体；其余页面代码、声场、卡片和分享图为本次实现。字体授权见 `FONT-LICENSE.txt`（SIL OFL 1.1，也随站点分发）。没有把初版的虚构时延、上游识别成绩或开发中功能当成已交付指标。

初版验证记录见 `VALIDATION.md`，当前改版见 `VALIDATION-COMPETITION.md`；最终线上文件校验与截图保存在本项目 `validation/`。

## 许可与凭据

公开仓库用于协作，目前未附加通用开源许可证。字体适用随附的 SIL OFL 1.1；产品名称、截图及其他素材保留原有权利。

不提交 GitHub/Vercel token、API Key、私钥、用户资料或本机验收输出。`.gitignore` 已排除凭据文件、构建产物及本地状态。
