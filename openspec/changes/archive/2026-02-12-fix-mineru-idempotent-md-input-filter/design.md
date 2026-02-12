## Context

`mineru` workflow 已实现“若目标目录存在同名 `.md` 则跳过”这一设计意图，但当前线上行为表明该判断在真实文件路径形态下存在漏判。结果是：

- 入口阶段未剔除本应跳过的 PDF；
- 请求仍然执行并返回成功；
- 回写阶段重复将同一路径 `.md` 作为附件链接到同一父条目。

当前右键菜单可执行性判断依赖 `executeBuildRequests`，因此只要 `filterInputs` 与执行统计可靠，菜单层和执行层都能自然继承“不可触发/部分剔除”语义。

## Goals / Non-Goals

**Goals:**

- 在输入阶段稳定识别同目录同名 `.md` 冲突，并在提交前剔除对应 PDF。
- 当全部输入均冲突时，workflow 不进入执行。
- 当部分输入冲突时，仅执行剩余输入，并在执行结果中报告 `skipped`。
- 在回写阶段增加防御，避免同一父条目重复链接同一路径 `.md`。

**Non-Goals:**

- 不改变 MinerU HTTP steps 协议与后端交互参数。
- 不新增新的 workflow 配置项。
- 不改变 markdown 结果落盘命名规则（仍为 `<pdfBaseName>.md` 与 `Images_<itemKey>`）。

## Decisions

### Decision 1: 以“可落盘绝对路径”为幂等判定基准

- 输入过滤不再仅依赖快照字段的字符串拼接结果，而是统一通过 attachment 可解析路径计算目标 `.md` 绝对路径并检查存在性。
- 路径比较统一大小写与分隔符归一化，降低 Windows/跨平台路径差异导致的漏判。

**备选方案：**仅用 `selectionContext.items.attachments[].filePath` 直接替换后缀判断。  
**不选原因：**该字段在不同来源（直接选附件、选父条目展开、历史数据）下一致性不足，是当前漏判来源之一。

### Decision 2: 跳过统计以“输入单元总数 - 实际请求数”为唯一口径

- 保持 `executeBuildRequests().__stats.skippedUnits` 作为 skipped 的单一真值来源。
- 若发生“全量被过滤”，执行层需使用真实输入单元数报告 skipped，而非固定写死 `1`。

**备选方案：**在 `filterInputs` 内直接弹提示，不走统一执行消息。  
**不选原因：**会破坏统一的 workflow 反馈链路，且难以在菜单层/执行层保持一致。

### Decision 3: `applyResult` 增加同路径附件去重防线

- 在 `createFromPath` 前检查父条目现有附件是否已链接到目标 `.md` 路径，若已存在则跳过创建附件。

**备选方案：**只依赖输入过滤保证不重复。  
**不选原因：**异常重试、外部并发修改、历史脏数据都可能绕过入口过滤，缺少回写防线风险高。

## Risks / Trade-offs

- [路径解析差异] 不同 Zotero 路径来源（绝对路径、`attachments:` 相对路径）可能仍有边角差异  
  → Mitigation: 统一归一化函数，并在测试中覆盖直接附件选择/父条目展开两类入口。
- [统计口径变更影响既有断言] 全量跳过时 `skipped` 由固定值改为真实值，可能影响旧测试与文案断言  
  → Mitigation: 同步更新 mineru 与执行消息测试，保持断言与语义一致。
- [回写去重误杀] 若路径比较过于激进，可能跳过本应新增的不同文件  
  → Mitigation: 仅比较“归一化后的完整路径”，不做模糊匹配。

## Migration Plan

1. 先补测试：覆盖全量冲突不触发、部分冲突剔除并报告 skipped、回写不重复链接。
2. 修复 `filterInputs` 路径判定与冲突剔除逻辑。
3. 修复执行层全量跳过的 skipped 报告口径。
4. 增加 `applyResult` 附件去重防御。
5. 回归执行 `build` 与 `test:node:full`。

## Open Questions

- 无。

