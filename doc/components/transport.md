# Transport 组件说明

## 目标

为 Provider 提供底层 HTTP/上传/下载能力，不理解 Workflow 业务语义。

## 职责

- 执行 `http.steps` 请求流水（create/upload/poll/fetch）
- 处理 multipart 上传（按文件路径上传）
- 处理轮询状态（queued/running/succeeded/failed）
- 下载 bundle 二进制结果
- 统一错误映射（HTTP 错误、超时、远端失败）

## 输入

- `HttpStepsRequest`（由 `workflow.request.kind = skillrunner.job.v1` 生成）
- `baseUrl`（后端地址）

## 输出

- `SkillRunnerExecutionResult`
  - `status = succeeded`
  - `requestId`
  - `bundleBytes`

## 数据结构（建议）

```
TransportRequest {
  kind: "http.steps"
  steps: Array<{
    id: "create" | "upload" | "poll" | "bundle" | "result"
    request: {
      method: string
      path: string
      json?: Record<string, unknown>
      multipart?: boolean
    }
    files?: Array<{ key: string; path: string }>
    extract?: { request_id?: string }
  }>
  poll?: { interval_ms?: number; timeout_ms?: number }
}

TransportResponse {
  status: "succeeded"
  requestId: string
  bundleBytes: Uint8Array
}
```

## 行为与边界

- 不解析 `selectionContext`，不决定输入筛选
- 不执行 `applyResult`
- 只负责网络传输和后端状态驱动

## 失败模式

- HTTP 请求失败：抛出带状态码的错误
- 轮询超时：抛出 timeout 错误
- 后端状态 failed：抛出后端失败信息

## 测试点（TDD）

- create 请求包体校验
- upload 为 `file=@inputs.zip` 且 Zip 内容可被后端解压
- poll 经历短暂等待后进入 succeeded
- bundle 下载成功并返回非空二进制

## M1 Mock SkillRunner 协议

测试侧提供 `test/mock-skillrunner/server.ts`，M1 固定支持以下接口：

- `POST /v1/jobs`：校验 `skill_id/engine/parameter`，返回 `request_id`
- `POST /v1/jobs/{request_id}/upload`：校验 multipart 中包含 `file`（Zip）
- `GET /v1/jobs/{request_id}`：短暂等待后按 `queued/running/succeeded` 返回
- `GET /v1/jobs/{request_id}/bundle`：固定返回 `test/fixtures/literature-digest/run_bundle.zip`
