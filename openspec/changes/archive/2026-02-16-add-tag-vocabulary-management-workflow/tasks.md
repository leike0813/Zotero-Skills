## 1. Protocol-Aligned Vocabulary Domain

- [x] 1.1 建立词表领域模型与 operation service（create/read/search/update/delete/export/validate/compile）
- [x] 1.2 对齐 `reference/Zotero_TagVocab/protocol/**` 关键约束（facet、pattern、duplicate、abbrev-case）
- [x] 1.3 先写 domain 单元测试（TDD），覆盖成功路径与协议错误码映射

## 2. Persistence and Deterministic Export

- [x] 2.1 新增词表持久化仓储（本地存储读写与损坏兜底）
- [x] 2.2 实现导出字符串数组能力（`facet:value`，稳定排序）
- [x] 2.3 先写持久化/导出测试（包含重启重载与损坏数据回退）

## 3. Tag Manager Workflow Panel

- [x] 3.1 新增 `tag-manager` workflow 清单与 hooks，接入 workflow editor host
- [x] 3.2 实现面板核心交互：增删查改、软删/硬删、导出动作
- [x] 3.3 实现 YAML 文件导入（`tags/tags.yaml` 完整字段格式）与冲突策略（`skip/overwrite/error`）/`dry_run`
- [x] 3.4 先写 UI 行为测试（Node + Zotero）验证关键交互与保存语义

## 4. Integration and Regression Guard

- [x] 4.1 提供供下游 workflow 复用的导出接口（避免跨模块重复实现）
- [x] 4.2 补充端到端回归：面板编辑 -> 持久化 -> 重新加载 -> 导出一致
- [x] 4.3 补充 import 协议回归：YAML 解析、冲突策略、dry-run 与错误中止语义
- [x] 4.4 运行类型检查与分组测试（至少 `core/ui/workflow` 受影响域）
