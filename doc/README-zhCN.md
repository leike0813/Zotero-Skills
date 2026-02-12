<p align="center">
  <img src="../addon/content/icons/icon_full.png" alt="Zotero-Skills Icon" width="160" />
</p>

# Zotero-Skills

Zotero-Skills 是一个面向 Zotero 7 的插件，它将 Zotero 变成一个可插拔的 AI 与自动化工作流前端。

语言切换：[English](../README.md) | 简体中文 | [Français](./README-frFR.md)

## 这个项目解决什么问题

该项目在 Zotero 内提供一个可复用的执行壳层：

- 统一管理选区上下文、工作流执行、任务追踪与结果回写。
- 将业务逻辑从插件核心中解耦出去。
- 允许你通过外部工作流包扩展或替换行为。

简而言之，Zotero-Skills 是一个“框架型插件”，而不是单一功能插件。

## 可插拔架构

插件采用可插拔工作流模型：

- 每个工作流由 `workflow.json` 和可选 hooks（`filterInputs`、`buildRequest`、`applyResult`）组成。
- 运行时统一完成请求编译、provider/backend 解析、任务执行与结果应用。
- 工作流包可以面向不同后端（Skill-Runner、generic HTTP、pass-through 本地逻辑），而无需改动核心插件代码。

核心优势：

- 可扩展：新增工作流时无需改动核心架构。
- 可隔离：工作流特定逻辑留在各自工作流包中。
- 可复用：共享统一的 runtime、队列、配置与 UI 行为。

## Agent Skills 依赖 Skill-Runner

对于 Agent Skills 调用，Zotero-Skills 依赖 [Skill-Runner](https://github.com/leike0813/Skill-Runner) 作为后端编排层：

- Zotero-Skills 从 Zotero 选区构建标准化请求。
- Skill-Runner 负责技能执行与面向模型/服务的编排。
- Zotero-Skills 接收输出并回写到 Zotero 条目、笔记和附件。

若没有 Skill-Runner，Agent Skills 工作流无法完整执行。

## 成本模型与订阅配额优势

该架构有助于控制 LLM 使用成本：

- 你可以通过 Skill-Runner 与后端集成，匹配已有订阅方案。
- 在很多配置下，可以优先利用周期刷新的订阅额度（例如 OpenAI/Gemini 订阅配额），而不是直接走按 token 计费的 API 调用。
- 插件在 UI/工作流层保持 provider 无关，后端策略可独立演进。

## 典型使用场景（内建工作流）

- 文献摘要工作流：从选中的 markdown/PDF 上下文生成 digest/reference 笔记。
- 参考文献匹配工作流：将参考文献匹配为 citekey 并回写结构化 payload。
- MinerU 工作流：解析选中的 PDF 附件，物化 markdown/资源并挂载到父条目。

## 快速导航

- 架构与当前实现说明：[doc/dev_guide.md](./dev_guide.md)
- 工作流组件说明：[doc/components/workflows.md](./components/workflows.md)
- Provider 组件说明：[doc/components/providers.md](./components/providers.md)
- 测试策略：[doc/testing-framework.md](./testing-framework.md)

## 模板来源

本仓库最初由 [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) 生成，随后演进为当前的 Zotero-Skills 架构与实现。
