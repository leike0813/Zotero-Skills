<p align="center">
  <img src="../addon/content/icons/icon_full.png" alt="Zotero Skills" width="128" />
</p>

<h1 align="center">Zotero Skills</h1>

<p align="center">
  <strong>面向 Zotero 7 的可插拔工作流引擎 — 将你的文献库变成 AI 驱动的研究中心。</strong>
</p>

<p align="center">
  <a href="https://github.com/leike0813/Zotero-Skills/releases"><img src="https://img.shields.io/github/v/release/leike0813/Zotero-Skills?style=flat-square&color=blue" alt="Release" /></a>
  <a href="https://github.com/leike0813/Zotero-Skills/blob/main/LICENSE"><img src="https://img.shields.io/github/license/leike0813/Zotero-Skills?style=flat-square" alt="License" /></a>
  <a href="https://www.zotero.org/"><img src="https://img.shields.io/badge/Zotero-7-CC2936?style=flat-square&logo=zotero&logoColor=white" alt="Zotero 7" /></a>
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  简体中文 ·
  <a href="./README-frFR.md">Français</a> ·
  <a href="./README-jaJP.md">日本語</a>
</p>

---

## ✨ 什么是 Zotero Skills？

Zotero Skills 是一个面向 Zotero 7 的**框架型插件**，它提供了统一的 AI 与自动化工作流执行壳层：

- 📦 **可插拔工作流** — 业务逻辑以外部工作流包的形式存在，核心插件不包含任何具体业务代码。
- 🔌 **多后端支持** — 可将任务路由到 [Skill-Runner](https://github.com/leike0813/Skill-Runner)、通用 HTTP API 或本地透传逻辑。
- ⚡ **统一执行** — 选区上下文构建、请求编译、任务排队、结果落库和错误汇总均由共享运行时统一处理。

> 你可以把它理解为 **Zotero 中的工作流引擎** — 通过声明式 manifest 和 hook 脚本定义「做什么」，插件负责「怎么执行」。

## 🚀 核心能力

| 能力 | 说明 |
|---|---|
| **工作流引擎** | 声明式 `workflow.json` + 可选 hooks（`filterInputs`、`buildRequest`、`applyResult`） |
| **Provider 注册中心** | 三种内建 provider：`skillrunner`、`generic-http`、`pass-through` |
| **后端管理器** | GUI 管理每种 provider 下的多个后端配置 |
| **任务 Dashboard** | 实时任务监控、SkillRunner 交互式对话、运行日志 |
| **Workflow 设置** | 每个 workflow 支持持久化与一次性参数覆盖 |
| **Workflow 编辑器** | 基于 Host 的渲染器框架，用于结构化数据编辑（如参考文献笔记） |
| **日志查看器** | 可过滤的运行日志窗口，支持 NDJSON 导出用于诊断 |

## 📋 内建工作流

| 工作流 | Provider | 说明 |
|---|---|---|
| **文献摘要** | `skillrunner` | 从 markdown/PDF 上下文生成 digest 和参考文献笔记 |
| **文献解读** | `skillrunner` | 交互式对话文献解读，结果以 conversation note 写回 |
| **参考文献匹配** | `pass-through` | 将参考文献匹配为 citekey，回写结构化 payload |
| **参考文献编辑** | `pass-through` | 在独立编辑窗口中维护结构化参考文献条目 |
| **MinerU** | `generic-http` | 解析 PDF 附件，物化 markdown/资源并挂载到父条目 |
| **Tag 管理** | `pass-through` | 受控词表增删改查、facet 过滤、YAML 导入/导出 |
| **Tag 规整** | `skillrunner` | 调用 Skill-Runner 规范化标签，纳入建议标签 |

## 📥 安装

### 前置条件

- [Zotero 7](https://www.zotero.org/download/)（版本 ≥ 6.999）
- 使用 `skillrunner` 工作流时需要运行中的 [Skill-Runner](https://github.com/leike0813/Skill-Runner) 实例

### 安装步骤

1. 从 [Releases](https://github.com/leike0813/Zotero-Skills/releases) 页面下载最新的 `.xpi` 文件。
2. 在 Zotero 中：`工具` → `附加组件` → ⚙️ → `从文件安装附加组件…`
3. 选择下载的 `.xpi` 文件，重启 Zotero。

### 快速上手

1. **配置后端** — `编辑` → `首选项` → `Zotero Skills` → `Backend Manager`，添加 Skill-Runner 端点。
2. **放置工作流** — 将工作流文件夹复制到工作流目录（可在首选项中配置）。
3. **立即使用** — 右键选中的条目 → `Zotero-Skills` → 选择一个工作流。

## 🏗️ 架构概览

```
用户触发
    │
    ▼
选区上下文 ──► 工作流引擎 ──► Provider 注册中心 ──► 任务队列
                  │                   │                 │
            workflow.json        后端配置解析       FIFO + 并发控制
            + hook 脚本
                  │                   │                 │
                  ▼                   ▼                 ▼
            构建请求 ──► 解析 Provider ──► 执行 & 结果落库
                                              │
                                         Handlers:
                                         笔记 / 标签 /
                                         附件 / 条目
```

## 💰 成本优势

- 通过 Skill-Runner 路由调用，匹配已有的订阅方案。
- 优先利用周期刷新的订阅额度（如 OpenAI/Gemini），而非按 token 计费的 API 调用。
- 插件 UI/工作流层保持 provider 无关，后端策略可独立演进。

## 🧑‍💻 开发

```bash
npm install          # 安装依赖
npm start            # 启动开发服务器（含 mock Skill-Runner）
npm test             # 运行 lite 测试
npm run test:full    # 运行全量测试
npm run build        # 生产构建
```

详见 [开发指南](dev_guide.md)。

## 📖 文档索引

| 文档 | 说明 |
|---|---|
| [架构流程](architecture-flow.md) | 执行管线总览（含 Mermaid 流程图） |
| [开发指南](dev_guide.md) | 核心组件、配置模型、执行链路 |
| [工作流组件](components/workflows.md) | Manifest schema、hooks、输入筛选、执行语义 |
| [Provider 组件](components/providers.md) | Provider 契约系统、请求类型 |
| [测试策略](testing-framework.md) | 双运行环境、lite/full 模式、CI 门禁 |

## 📄 许可证

[AGPL-3.0-or-later](../LICENSE)

## 🙏 致谢

- 基于 [@windingwind](https://github.com/windingwind) 的 [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) 构建
- 使用 [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit)
