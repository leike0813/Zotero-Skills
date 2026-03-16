## Context

该 change 在当前阶段不再承担“未来周计划”职责，而是承担“已交付里程碑基线”职责。  
目标是让 roadmap 与真实实现对齐，并保证每个关键能力都可回溯到已归档 change。

## Goals / Non-Goals

**Goals**

- 以能力基线替换过时周计划叙述。
- 固化 4 项核心里程碑与 3 组核心补充里程碑。
- 为每项里程碑提供显式 archived change id 追溯。
- 提供后续维护规则，防止 roadmap 再次漂移。

**Non-Goals**

- 不新增任何运行时能力。
- 不修改已有行为、API、类型或 UI。
- 不重写 archived change，仅在本 change 中建立汇总与追溯。

## Decisions

### Decision 1: 从“周计划”切换为“里程碑基线”

- 采用能力里程碑作为唯一编排单位，删除周序列与未来任务描述。
- 原因：当前项目已经跨过原计划阶段，继续保留周计划会造成误导。

### Decision 2: 采用“4+3”里程碑口径

- 必须覆盖 4 项：
  - interactive 执行模式
  - 统一 Dashboard/运行详情对话窗口
  - 一键部署本地后端
  - literature-explainer workflow
- 同时补充 3 组高影响更新：
  - workflow 设置单源化网页化
  - Dashboard 运行任务可交互跳转
  - 本地后端 UI/i18n 治理收敛

### Decision 3: 追溯规则强制化

- 每个里程碑必须附 archived change id。
- 只允许引用已归档且已通过校验的 change。
- 文档描述粒度控制在“能力级”，不复制实现细节。

### Decision 4: 后续更新规则

- roadmap 后续仅通过“新增已交付里程碑”方式更新。
- 不再回退到未完成任务清单模式。
- 当能力跨多个 change 时，允许多 id 绑定到同一里程碑。

## Risks / Trade-offs

- 风险：能力汇总粒度过高，可能弱化实现细节可见性。  
  缓解：保留 change id 追溯入口，细节查 archived change。

- 风险：新变更持续进入时，基线文档再次失真。  
  缓解：强制执行“里程碑+change id”更新规则，并在任务中加入一致性检查。
