# Job 队列组件说明

## 目标

将 Workflow 执行请求转换为可并发调度的任务序列，实现固定并发、FIFO 调度与独立任务生命周期管理。

## 职责

- 维护任务队列与任务状态
- 按 Workflow 指定的并发配置进行调度
- 提供任务的提交、执行、状态查询与取消能力
- 对每个任务维护独立控制流（状态机）

## 输入

- `JobRequest`（由 Selection/Context + Workflow + buildRequest 构建）
- `Workflow` 配置（并发上限、优先级、策略）

## 输出

- 任务状态流：`queued` → `running` → `succeeded | failed | canceled`
- 队列运行状态：正在运行的任务数、等待队列长度

## 并发模型（当前版本）

- 并发粒度：按 Workflow 指定
- 调度策略：FIFO
- 并发上限：固定值（由 Workflow 或全局配置提供）

## 数据结构（建议）

```
JobQueue {
  workflowId: string
  concurrencyLimit: number
  running: number
  queued: Job[]
}

Job {
  jobId: string
  workflowId: string
  state: "queued" | "running" | "succeeded" | "failed" | "canceled"
  createdAt: string
  updatedAt: string
}
```

## 行为与边界

- 输入校验在 Job 队列阶段完成，校验失败不创建 Job
- 同一 Workflow 使用统一并发池
- 不同 Workflow 可并行运行
- 任务取消需通知 Transport 停止执行
- 失败任务不自动重试（后续扩展）

## 失败模式

- 并发池满：任务进入 `queued`
- 执行异常：任务标记 `failed` 并记录错误

## 测试点（TDD）

- FIFO 顺序入队/出队
- 固定并发上限：超额任务等待
- 任务状态流转正确
- 取消任务从队列或运行中移除
