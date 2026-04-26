import { assert } from "chai";
import { AcpClientConnection } from "../../src/modules/acpClientConnection";
import {
  ACP_CLIENT_METHODS,
  ACP_PROTOCOL_VERSION,
  type JsonRpcMessage,
  type RequestPermissionRequest,
  type SessionNotification,
} from "../../src/modules/acpProtocol";

function redefineGlobalProperty(key: string, value: unknown) {
  const runtime = globalThis as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(runtime, key);
  Object.defineProperty(runtime, key, {
    value,
    writable: true,
    configurable: true,
  });
  return previous;
}

function restoreGlobalProperty(key: string, descriptor?: PropertyDescriptor) {
  const runtime = globalThis as Record<string, unknown>;
  if (!descriptor) {
    delete runtime[key];
    return;
  }
  Object.defineProperty(runtime, key, descriptor);
}

function createMessageHarness() {
  const inboundQueue: JsonRpcMessage[] = [];
  const outboundQueue: JsonRpcMessage[] = [];
  const waitingInbound: Array<
    (result: { done: boolean; value?: JsonRpcMessage }) => void
  > = [];
  const waitingOutbound: Array<(message: JsonRpcMessage) => void> = [];
  let inboundClosed = false;

  const flushInbound = () => {
    while (waitingInbound.length > 0) {
      if (inboundQueue.length > 0) {
        const next = waitingInbound.shift();
        next?.({
          done: false,
          value: inboundQueue.shift(),
        });
        continue;
      }
      if (inboundClosed) {
        const next = waitingInbound.shift();
        next?.({ done: true, value: undefined });
        continue;
      }
      break;
    }
  };

  const flushOutbound = () => {
    while (waitingOutbound.length > 0 && outboundQueue.length > 0) {
      const next = waitingOutbound.shift();
      next?.(outboundQueue.shift() as JsonRpcMessage);
    }
  };

  return {
    stream: {
      readable: {
        getReader() {
          return {
            async read() {
              if (inboundQueue.length > 0) {
                return {
                  done: false,
                  value: inboundQueue.shift(),
                };
              }
              if (inboundClosed) {
                return { done: true, value: undefined };
              }
              return new Promise<{ done: boolean; value?: JsonRpcMessage }>(
                (resolve) => {
                  waitingInbound.push(resolve);
                },
              );
            },
            releaseLock() {
              return;
            },
          };
        },
      },
      writable: {
        getWriter() {
          return {
            async write(message: JsonRpcMessage) {
              outboundQueue.push(message);
              flushOutbound();
            },
            releaseLock() {
              return;
            },
          };
        },
      },
    },
    pushInbound(message: JsonRpcMessage) {
      inboundQueue.push(message);
      flushInbound();
    },
    closeInbound() {
      inboundClosed = true;
      flushInbound();
    },
    async nextOutbound() {
      if (outboundQueue.length > 0) {
        return outboundQueue.shift() as JsonRpcMessage;
      }
      return new Promise<JsonRpcMessage>((resolve) => {
        waitingOutbound.push(resolve);
      });
    },
  };
}

describe("acp client connection", function () {
  it("sends initialize request and resolves the matching response", async function () {
    const harness = createMessageHarness();
    const traces: unknown[] = [];
    const connection = new AcpClientConnection(
      () => ({
        requestPermission: async () => ({ outcome: "cancelled" }),
        sessionUpdate: async () => undefined,
      }),
      harness.stream,
      {
        onTrace: (event) => {
          traces.push(event);
        },
      },
    );

    const initializePromise = connection.initialize({
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: {},
    });
    const outbound = await harness.nextOutbound();
    assert.include(outbound, {
      jsonrpc: "2.0",
      method: "initialize",
    });
    assert.deepEqual(outbound.params, {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: {},
    });

    harness.pushInbound({
      jsonrpc: "2.0",
      id: outbound.id,
      result: {
        protocolVersion: ACP_PROTOCOL_VERSION,
        agentInfo: {
          name: "OpenCode",
          version: "1.2.3",
        },
        authMethods: [],
      },
    });

    const response = await initializePromise;
    assert.deepEqual(response.agentInfo, {
      name: "OpenCode",
      version: "1.2.3",
    });
    assert.isTrue(
      traces.some((entry) => {
        const trace = entry as Record<string, unknown>;
        return (
          trace.direction === "out" &&
          trace.kind === "request" &&
          trace.id === 0 &&
          trace.method === "initialize"
        );
      }),
    );
    assert.isTrue(
      traces.some((entry) => {
        const trace = entry as Record<string, unknown>;
        return (
          trace.direction === "in" &&
          trace.kind === "response" &&
          trace.id === 0
        );
      }),
    );
    harness.closeInbound();
    await connection.closed;
  });

  it("handles session/request_permission and responds with the selected outcome", async function () {
    const harness = createMessageHarness();
    let capturedRequest: RequestPermissionRequest | null = null;
    const connection = new AcpClientConnection(
      () => ({
        requestPermission: async (request) => {
          capturedRequest = request;
          return {
            outcome: "selected",
            optionId: "allow-once",
          };
        },
        sessionUpdate: async () => undefined,
      }),
      harness.stream,
    );

    harness.pushInbound({
      jsonrpc: "2.0",
      id: 99,
      method: ACP_CLIENT_METHODS.session_request_permission,
      params: {
        sessionId: "session-1",
        toolCall: {
          toolCallId: "tool-1",
          title: "Inspect notes",
        },
        options: [
          {
            optionId: "allow-once",
            kind: "allow_once",
            name: "Allow Once",
          },
        ],
      },
    });

    const outbound = await harness.nextOutbound();
    assert.deepEqual(capturedRequest, {
      sessionId: "session-1",
      toolCall: {
        toolCallId: "tool-1",
        title: "Inspect notes",
      },
      options: [
        {
          optionId: "allow-once",
          kind: "allow_once",
          name: "Allow Once",
        },
      ],
    });
    assert.deepEqual(outbound, {
      jsonrpc: "2.0",
      id: 99,
      result: {
        outcome: "selected",
        optionId: "allow-once",
      },
    });
    harness.closeInbound();
    await connection.closed;
  });

  it("does not depend on AbortController to receive session/update and close cleanly", async function () {
    const harness = createMessageHarness();
    const previousAbortController = redefineGlobalProperty(
      "AbortController",
      undefined,
    );
    const updates: SessionNotification[] = [];

    try {
      const connection = new AcpClientConnection(
        () => ({
          requestPermission: async () => ({ outcome: "cancelled" }),
          sessionUpdate: async (event) => {
            updates.push(event);
          },
        }),
        harness.stream,
      );

      harness.pushInbound({
        jsonrpc: "2.0",
        method: ACP_CLIENT_METHODS.session_update,
        params: {
          sessionId: "session-1",
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: "Hello from agent",
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.lengthOf(updates, 1);
      assert.deepEqual(updates[0], {
        sessionId: "session-1",
        update: {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text: "Hello from agent",
          },
        },
      });

      harness.closeInbound();
      await connection.closed;
    } finally {
      restoreGlobalProperty("AbortController", previousAbortController);
    }
  });
});
