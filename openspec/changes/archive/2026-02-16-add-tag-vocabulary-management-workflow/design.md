## Context

`reference/Zotero_TagVocab` 已提供语言无关协议：
- `protocol/protocol.yaml`：全局约束（facet 枚举、pattern、路径布局）
- `protocol/operations/*.yaml`：`create/read/update/delete/search/import/export/validate/compile/stats`
- `protocol/schema/*.yaml`：词条与缩写等数据结构

插件侧目前仅有 item tag 写入 handlers，缺少受控词表的治理与存储能力。  
本 change 负责将词表治理能力落地为 workflow 管理面板，并把输出格式固定为 `tag-regulator` 可直接消费的字符串数组。

## Goals / Non-Goals

**Goals:**

- 基于协议实现词表 CRUD、校验、检索与导出。
- 基于 `import_tags` 协议支持从合法 YAML 源（`tags/tags.yaml` 完整字段格式）导入。
- 提供可交互的 workflow 管理面板（基于现有 workflow editor host）。
- 提供稳定持久化与确定性导出（便于下游 workflow 复用）。
- 为后续 `tag-regulator` workflow 提供清晰复用接口（导出字符串数组）。

**Non-Goals:**

- 不实现 LLM 语义规范化逻辑（由 `tag-regulator` workflow 负责）。
- 不改造 Skill-Runner 后端协议。
- 不在本 change 引入新的业务 facet 体系扩展（先按现有 protocol facet 集合落地）。

## Decisions

### Decision 1: 协议优先的数据模型

- 词条结构对齐 `tag.schema.yaml`：`tag/facet/source/note/deprecated`。
- 核心校验对齐 protocol 约束：
  - facet 必须在枚举内；
  - `tag_pattern` 与最大长度检查；
  - exact duplicate + case-insensitive duplicate；
  - 缩写大小写规则（基于 abbrev 注册表）。

### Decision 2: 管理面板通过 workflow editor host 承载

- `tag-manager` workflow 使用本地编辑器会话，提供列表、检索、编辑、软删/硬删、YAML 导入与导出动作。
- UI 只负责交互，规则判断下沉到词表领域模块，避免重复逻辑。

### Decision 3: 导入源与协议映射

- 导入入口采用文件选择，仅接受 `.yaml/.yml`。
- 导入内容要求为 `tags/tags.yaml` 风格完整字段对象列表（`tag/facet/source/note/deprecated`）。
- 冲突处理遵循 `import_tags`：`skip/overwrite/error`，并支持 `dry_run`。
- 对于结构解析错误（缺字段/非法 YAML），中止导入并返回确定性错误。

### Decision 4: 持久化与导出职责分离

- 持久化保存完整词条集合（含 metadata）。
- 导出仅输出 `facet:value` 字符串数组，不携带 metadata。
- 导出结果默认稳定排序（facet -> tag），保证跨运行可复现。

### Decision 5: 先保证协议闭环，再优化管理体验

- 第一阶段优先覆盖协议正确性、可回放与可测试性。
- 词表统计等增强功能作为后续增量项，不阻塞本 change 达成。

## Risks / Trade-offs

- [Risk] 协议规则分散在多个 YAML，若实现分层不清容易重复判断  
  -> Mitigation: 建立单一 `vocab domain` 模块统一校验与操作。

- [Risk] 面板交互与存储耦合导致测试困难  
  -> Mitigation: UI 层只发操作意图，存储/校验逻辑全部在纯函数与 domain service。

- [Risk] 词表规模增长后编辑器响应退化  
  -> Mitigation: 列表检索与渲染采用分页/过滤模型，任务中加入性能守护测试。
