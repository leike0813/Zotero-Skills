# Transport 组件说明

## 目标

为 Provider 提供底层 HTTP/上传/下载能力，不理解业务协议。

## 职责

- 执行单次 HTTP 请求
- 处理 multipart 上传（Zip/文件）
- 下载文件与二进制响应
- 统一错误映射

## 输入

- `TransportRequest`（Provider 构造的单次请求）
- 文件输入（由 Provider 指定）

## 输出

- `TransportResponse`（HTTP 响应）
- `TransportError`（失败）

## 数据结构（建议）

```
TransportRequest {
  method: string
  url: string
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean>
  json?: Record<string, unknown>
  files?: Array<{ key: string; path: string }>
}

TransportResponse {
  status: number
  headers: Record<string, string>
  body: string | ArrayBuffer
}
```

## 行为与边界

- 不在 Transport 层做业务解析，只负责通信与传输

## 失败模式

- 请求失败：返回 `TransportError`（HTTP 状态、错误详情）
- 超时：标记失败并返回可重试提示

## 测试点（TDD）

- 纯 JSON 请求与响应解析
- multipart 上传文件正确
- 二进制下载与内容完整性
- 错误映射与重试策略
