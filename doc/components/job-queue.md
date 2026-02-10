# Job 队列组件说明

## 目标

将 Workflow 构建出的请求转换为可并发调度的任务序列，实现固定并发、FIFO 调度与独立任务生命周期管理。

## 职责

- 维护任务队列与任务状态
- 按固定并发配置进行调度（M1）
- 提供任务的提交、执行与状态查询
- 对每个任务维护独立控制流（状态机）
- 将任务交给 Provider 执行

## 输入

- `JobRequest`（由 `executeBuildRequests` 生成，M1 为 `per_input`）
- `workflowId`
- 队列并发配置 `concurrency`

## 输出

- 任务状态流：`queued` → `running` → `succeeded | failed | canceled`
- 队列运行状态：正在运行的任务数、等待队列长度

说明：当前实现没有公开“主动取消任务”接口，`canceled` 仅保留为状态类型预留。

## 并发模型（当前版本）

- 并发粒度：按输入单元（`per_input`）
- 调度策略：FIFO
- 并发上限：固定值（队列初始化参数）

## 数据结构（建议）

```
JobQueue {
  concurrencyLimit: number
  running: number
  queued: Job[]
}

Job {
  jobId: string
  workflowId: string
  request: unknown
  state: "queued" | "running" | "succeeded" | "failed" | "canceled"
  result?: unknown
  error?: string
  createdAt: string
  updatedAt: string
}
```

## 行为与边界

- 输入合法性由 Workflow 运行时先完成，队列只接收可执行 request
- 队列本身不理解 Workflow 业务，也不修改 request
- M1 只覆盖成功链路与失败标记，不包含自动重试

## 失败模式

- 并发池满：任务进入 `queued`
- 执行异常：任务标记 `failed` 并记录错误

## 测试点（TDD）

- FIFO 顺序入队/出队
- 固定并发上限：超额任务等待
- 任务状态流转正确
- 与 Provider 联调：多个 request 被逐个执行并全部成功
