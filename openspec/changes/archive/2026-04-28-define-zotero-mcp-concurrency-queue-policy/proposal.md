# Define Zotero MCP Concurrency Queue Policy

## Summary

Define and implement the v1 concurrency contract for the embedded Zotero MCP
server. External clients may issue concurrent Streamable HTTP `tools/call`
requests, but the server serializes all Zotero host API access through a single
FIFO worker. The default policy is `1 running + 8 pending`; excess requests or
requests that wait too long receive structured JSON-RPC capacity errors instead
of transport failures.

## Motivation

Real agent tests showed that concurrent Zotero MCP tool calls can cascade into
`fetch failed` or closed-stream errors. The root risk is not MCP itself, but
Zotero host APIs and plugin-side native/XPCOM calls that are not guaranteed to be
reentrant. v1 must therefore make queueing, limit failures, and diagnostics a
publicly testable part of the MCP design.

## Changes

- Keep `initialize`, `tools/list`, and notifications outside the tool-call queue.
- Run every `tools/call` through a single FIFO queue before entering Zotero host
  APIs.
- Enforce a default pending limit of `8` and queue wait timeout of `30000ms`.
- Return JSON-RPC `-32001` with `data.code="zotero_mcp_queue_full"` when the
  queue is full.
- Return JSON-RPC `-32002` with `data.code="zotero_mcp_queue_timeout"` when a
  request waits too long.
- Record queue policy, queue position/depth, wait duration, execution duration,
  limit reason, and outcome in diagnostics.
- Add real Zotero runtime probes that demonstrate concurrent client requests are
  accepted while host calls are serialized.

## Non-Goals

- Do not reintroduce legacy SSE.
- Do not implement a per-tool parallel execution whitelist in v1.
- Do not rename or remove any Zotero MCP tool.
- Do not add remote attachment download support.
