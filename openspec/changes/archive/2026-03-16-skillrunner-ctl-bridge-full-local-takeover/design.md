# Design: skillrunner-ctl-bridge-full-local-takeover

## 1. Core Decision

本地后端控制面由插件桥接器统一实现，运行期不再依赖 `skill_runnerctl --json` 的返回语义。

## 2. Bridge Native Actions

### bootstrapLocalRuntime

- 调用 `uv run python scripts/agent_manager.py --ensure`。
- 注入本地运行时所需环境变量。
- 使用固定路径推断并读取 bootstrap report（`<localRoot>/data/agent_bootstrap_report.json`）。
- 保留 uv venv 损坏（`pyvenv.cfg` 缺失）自愈重试。

### preflightLocalRuntime

- 执行静态探测：
  - 依赖可用性（uv/node/npm）
  - 必要文件存在性（server/main.py、scripts/agent_manager.py）
  - 端口可用性（含 fallback span）
  - bootstrap report 可读性
  - state 文件健壮性
- 输出与现有消费方兼容的 `blocking_issues/warnings/suggested_next`。

### upLocalRuntime

- 以桥接器直接拉起 `uv run uvicorn server.main:app`。
- 执行端口选择与 fallback。
- 维护 `local_runtime_service.json` state 文件与日志路径。
- 等待健康探测（超时则 kill + 清理 state 并返回失败）。

### statusLocalRuntime

- 读取 state（pid/host/port）并探测健康端点 `GET /`。
- 返回 `running/starting/stopped`。

### downLocalRuntime

- 读取 state，终止 pid（若存活）并删除 state 文件。
- 幂等成功。

### doctorLocalRuntime

- 输出依赖、路径、环境快照诊断。

## 3. Manager Integration

- `deploy/start/stop/ensure/oneclick/startup-preflight/doctor` 全量改接原生动作。
- `resultFromCtl` 继续用于统一 stage/message/details 封装，避免 UI 回归。
- lease acquire/heartbeat/release 保持现有 HTTP 链路不变。

## 4. Compatibility Boundary

- 运行期主流程不依赖 ctl。
- 为测试桩兼容，manager 的桥接调用包装允许在缺失原生方法时回退到 `runCtlCommand`。
- 回退仅用于非生产桩环境，不改变生产路径决策。

## 5. Manual Command Contract

- “手动部署命令”改为桥接等价流程：
  - 下载/校验/解包
  - `agent_manager --ensure`
  - `uvicorn` 启动
- 不再输出 `skill-runnerctl ...` 命令。
