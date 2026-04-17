## Context

当前 SkillRunner 前端已经从“每个 request 一个弹窗”的旧模型演进到“全局单例 run workspace”，但该工作区仍由独立窗口承载。  
与此同时，Zotero 本身已经提供 library item pane 和 reader context pane 两套右侧壳层；插件又同时存在 Dashboard 和 SkillRunner 两个额外窗口，导致运行观察、当前条目上下文和交互回复被分散到多个宿主中。

这次变更的目标不是重写 SkillRunner 会话模型，而是把现有 run workspace 主路径迁入 Zotero 右侧壳层，并在窄栏内重排导航结构，同时保持右侧会话交互协议、状态机、SSE/会话同步和 fallback 能力不变。

## Goals / Non-Goals

**Goals:**

- 让 SkillRunner run workspace 以 Zotero 右侧壳层作为主宿主，覆盖 library 与 reader。
- 保持全局单例 workspace 语义不变，所有 open-run / request-created 入口统一路由到同一侧栏工作区。
- 在窄栏中重排导航：`任务` 抽屉、运行中/已完成分区、当前父条目相关任务快捷区。
- 保持会话详情区交互模型稳定：聊天、pending/auth、reply/cancel、final summary、状态 badge、host action bridge。
- 关闭侧栏时恢复进入前的 Zotero 原生 pane 状态。

**Non-Goals:**

- 不改 SkillRunner provider/backend 协议，也不改 request/session ledger 结构。
- 不把 SkillRunner 做成 item preview section；仍然是右侧壳层中的独立 page。
- 不移除旧 `openSkillRunnerRunDialog` fallback；仅将其降级为宿主注入失败时的备用实现。
- 不改 Dashboard 的职责边界；Dashboard 仍保留任务总览和显式 open-run 入口。

## Decisions

### Decision 1: 复用既有 run workspace/session 模型，只替换宿主

- 选择：保留 `skillRunnerRunDialog` 作为单一 workspace/session SSOT，新增 `skillRunnerSidebar` 承载右侧宿主、bridge、导航快照装饰。
- 原因：当前 run workspace 已经承载会话状态、SSE 生命周期、reply/auth-import/cancel 等完整交互；重写为一套 sidebar 专用模型会复制大量状态机和 host bridge 逻辑。
- 备选方案：重新实现一套 sidebar 专用页面与数据流。  
  放弃原因：重复实现高，且会引入第二套 SkillRunner 会话 UI SSOT。

### Decision 2: 使用 Zotero 私有右侧壳层结构集成，并保留 dialog fallback

- 选择：library 集成到 item pane，reader 集成到 context pane，由侧栏 host 负责显示/隐藏与 native mode 恢复。
- 原因：用户核心诉求是减少额外窗口，直接进入右侧壳层能最大化贴近 Zotero 原生交互。
- 约束：Zotero 右侧壳层属于私有结构，存在版本漂移风险。
- 缓解：保留 `openSkillRunnerRunDialog()` 作为注入失败 fallback，并在 host 初始化失败时显式回退。

### Decision 3: 窄栏导航改为“任务抽屉 + 顶部快捷区”，不保留原左侧 tab 面板

- 选择：
  - 主区顶部工具栏仅保留与窄栏兼容的全局动作（`任务`、`关闭`）。
  - 任务抽屉中分 `Running` / `Completed` 两段，均按 backend 分组。
  - 当前主父条目相关的运行中任务在顶部快捷区额外展示，按钮只显示 workflow 名称。
- 原因：原左侧 tab/workspace 适用于宽窗口，不适合右侧高窄壳层。
- 备选方案：保留完整左侧 tab 区并做可折叠。  
  放弃原因：侧栏宽度不足，持续占用固定列会压缩主交互区。

### Decision 4: 关联性与自动聚焦只按父条目，并且只作用于非终态任务

- 选择：
  - 关联判定仅看 `targetParentID` 与当前 selection 主父条目/父条目集合。
  - 自动焦点只在运行中任务上发生。
  - 顶部快捷区也只展示运行中关联任务。
- 原因：附件级 identity/path 规则在侧栏里容易产生误命中和解释成本；父条目语义更稳定，也与 Zotero 条目层级一致。
- 备选方案：继续混合 attachment id/key/path。  
  放弃原因：关联结果不可预测，已在实际 UI 中导致“看似无关任务被命中”的问题。

### Decision 5: 入口语义分离为 open / toggle / close

- 选择：
  - workflow / Dashboard / request-created 继续走显式 `openSkillRunnerSidebar`
  - 主工具栏按钮改为 `toggleSkillRunnerSidebar`
  - 页面内 `关闭` 与 host action `close-sidebar` 复用 native pane 恢复逻辑
- 原因：显式打开路径与用户手动开关语义不同，混成单一路径会让 toolbar 行为失控。

## Risks / Trade-offs

- [Risk] Zotero 私有右侧壳层 DOM 或行为升级后，sidebar host 可能注入失败。  
  Mitigation: 保留 legacy dialog fallback，并让 open-run/request-created 路径在失败时显式回退。

- [Risk] 窄栏下导航信息被压缩，用户可能找不到历史任务。  
  Mitigation: 保留 `任务` 抽屉分区和 backend 分组，并把当前父条目相关的运行中任务额外提升到顶部快捷区。

- [Risk] 关联/自动焦点逻辑过于积极会造成“切换选择导致任务跳变”。  
  Mitigation: 仅对非终态任务自动聚焦；若当前焦点仍在关联集合内则保持不变。

- [Risk] 多入口并行打开/关闭 SkillRunner 容易造成 host 状态漂移。  
  Mitigation: 所有侧栏入口统一收敛到 `open/toggle/close` 三类 host API，并复用同一套 native mode capture/restore。

## Migration Plan

1. 先把 `open-run`、`request-created`、toolbar/toolstrip 入口全部切换到 sidebar host。
2. 在右侧壳层中挂载 run workspace 前端，并通过快照装饰适配窄栏导航。
3. 将旧独立 dialog 降为 fallback，仅在宿主不可用时启用。
4. 补齐 i18n、toolbar/toolstrip、host bridge 和回归测试。
5. 通过定向测试与 `npx tsc --noEmit` 验证后，再进行 Zotero 实机回归。

## Open Questions

- 当前无阻塞性开放问题；后续若需要进一步收缩 Dashboard 角色或把 SkillRunner 深度嵌入更多 Zotero 原生 pane，再单独起变更。
