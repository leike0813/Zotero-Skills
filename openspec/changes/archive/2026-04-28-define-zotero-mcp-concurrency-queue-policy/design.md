# Design

## Concurrency Contract

The embedded Zotero MCP server accepts concurrent HTTP requests, but `tools/call`
execution is single-worker FIFO. This preserves compatibility with agents that
parallelize tool calls while protecting Zotero host APIs from reentrant access.

Non-tool JSON-RPC methods (`initialize`, `tools/list`) and notifications bypass
the queue. They do not enter Zotero library mutation/read primitives and should
remain responsive even when tool calls are queued.

## Queue Policy

Default v1 policy:

- `runningLimit`: `1`
- `pendingLimit`: `8`
- `queueTimeoutMs`: `30000`

Admission uses total accepted capacity of `1 running + 8 pending`. Once accepted,
requests keep their FIFO position. If capacity is exhausted, the server returns a
JSON-RPC error before invoking the tool handler.

Queue timeout is measured from admission until the request starts executing. A
timed-out request returns a JSON-RPC error and is skipped when it reaches the
front of the queue.

## Error Shape

Queue full:

```json
{
  "jsonrpc": "2.0",
  "id": "...",
  "error": {
    "code": -32001,
    "message": "Zotero MCP tool queue is full",
    "data": {
      "code": "zotero_mcp_queue_full"
    }
  }
}
```

Queue timeout:

```json
{
  "jsonrpc": "2.0",
  "id": "...",
  "error": {
    "code": -32002,
    "message": "Zotero MCP tool queue wait timed out",
    "data": {
      "code": "zotero_mcp_queue_timeout"
    }
  }
}
```

Tool parameter and business errors remain owned by the MCP protocol/tool layer.

## Diagnostics

Each `tools/call` request records queue policy, queue depth at accept, FIFO
position, wait duration, execution duration, limit reason, and outcome. Server
status exposes the current queue snapshot so the ACP UI and exported diagnostics
can explain whether failures are capacity failures or tool failures.

## Runtime Probe

Real Zotero runtime tests send concurrent tool calls against the localhost
Streamable HTTP endpoint. The test goal is not to prove host APIs are safe for
parallel execution; it verifies the public v1 behavior: concurrent requests are
accepted, serialized, diagnosed, and never collapse into transport failures.
