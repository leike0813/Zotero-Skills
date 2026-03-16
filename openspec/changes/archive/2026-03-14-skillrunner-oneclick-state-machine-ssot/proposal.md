## Why

当前 SkillRunner 本地一键部署/启动的行为分散在多个动作和状态判断中，按钮语义、自动拉起切换、监测收敛规则缺少统一契约，容易在后续迭代中产生行为漂移。  
需要先建立一套文档化的状态机 SSOT 与不变量守护，锁定后续实现决策，再进入业务接入。

## What Changes

- 新建独立 capability，定义本地一键部署/启动状态机 SSOT（状态、事件、转移、按钮门禁、动作互斥、不变量）。
- 明确按钮动作最终收敛：`一键部署/启动`、`停止`、`卸载`，并定义可用性矩阵。
- 明确运行时监测与收敛：`up` 后启监测、`stopped` 停监测、`heartbeat/status` 协同收敛。
- 明确自动拉起切换规则与插件启动初始行为（启动默认关闭、按 runtime info 决定是否 preflight）。
- 补充 one-click deploy 分支收敛：deploy 成功后必须等待 post-deploy preflight，再返回最终结果。
- 补充手动 stop 收敛：用户主动停止时立即关闭 auto-start 会话开关，避免后台误拉起。
- 增加后台状态推送到设置页的刷新通道，确保自动拉起与手动动作共用同一状态刷新入口。
- 在设计文档中补充守护脚本伪代码（无业务实现），统一 violation 输出结构。
- 在 `doc/components` 产出组件设计文档，集中描述状态机 SSOT、时序图与不变量清单。
- 更新现有 `skillrunner-local-runtime-bootstrap` 规格，改为引用新 SSOT 能力，避免双真源冲突。

## Capabilities

### New Capabilities

- `skillrunner-local-runtime-state-machine-ssot`: 统一定义 SkillRunner 本地一键部署/启动状态机、按钮动作收敛与不变量守护契约。

### Modified Capabilities

- `skillrunner-local-runtime-bootstrap`: 保留入口能力，状态/动作/监测语义引用 `skillrunner-local-runtime-state-machine-ssot` 作为真源。

## Impact

- 主要影响文档：
  - `openspec/changes/skillrunner-oneclick-state-machine-ssot/*`
  - `doc/components/skillrunner-local-runtime-oneclick-state-machine-ssot.md`
  - `openspec/specs/skillrunner-local-runtime-bootstrap/spec.md`（归档后更新）
- 主要影响实现：
  - `skillRunnerLocalRuntimeManager`（one-click deploy 后置 preflight、stop 关闭 auto-start、状态变更通知）
  - `preferenceScript`（订阅状态通知并刷新快照）
  - `test/core/73` 与 `test/ui/40`（新增回归用例）
- 对外 prefs 事件名保持不变，新增行为通过现有事件与快照字段收敛。
