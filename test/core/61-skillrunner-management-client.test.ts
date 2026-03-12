import { assert } from "chai";
import {
  SkillRunnerManagementClient,
  type SkillRunnerManagementSseFrame,
} from "../../src/providers/skillrunner/managementClient";

describe("skillrunner management client", function () {
  it("retries once with prompted basic auth on 401", async function () {
    const calls: Array<{ url: string; auth?: string | null }> = [];
    let count = 0;
    let savedAuth: unknown;
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url,
        auth: headers.get("authorization"),
      });
      count += 1;
      if (count === 1) {
        return new Response("unauthorized", {
          status: 401,
          statusText: "Unauthorized",
        });
      }
      return new Response(
        JSON.stringify({
          runs: [],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    };

    const client = new SkillRunnerManagementClient({
      baseUrl: "http://127.0.0.1:8030",
      fetchImpl,
      promptBasicAuth: async () => ({
        username: "admin",
        password: "secret",
      }),
      saveManagementAuth: (auth) => {
        savedAuth = auth;
      },
      getManagementAuth: () => ({
        kind: "none",
      }),
    });

    const runs = await client.listRuns();
    assert.deepEqual(runs, { runs: [] });
    assert.lengthOf(calls, 2);
    assert.isNull(calls[0].auth);
    assert.match(String(calls[1].auth || ""), /^Basic\s+/i);
    assert.deepEqual(savedAuth, {
      kind: "basic",
      username: "admin",
      password: "secret",
    });
  });

  it("parses SSE chat frames", async function () {
    const frames: SkillRunnerManagementSseFrame[] = [];
    const payload =
      "event: snapshot\n" +
      'data: {"status":"running","cursor":0}\n\n' +
      "event: chat_event\n" +
      'data: {"seq":1,"text":"hello"}\n\n';
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload));
        controller.close();
      },
    });
    const fetchImpl = async () =>
      new Response(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
        },
      });

    const client = new SkillRunnerManagementClient({
      baseUrl: "http://127.0.0.1:8030",
      fetchImpl,
    });
    await client.streamRunChat({
      requestId: "req-1",
      onFrame: (frame) => {
        frames.push(frame);
      },
    });

    assert.lengthOf(frames, 2);
    assert.equal(frames[0].event, "snapshot");
    assert.deepEqual(frames[1].data, {
      seq: 1,
      text: "hello",
    });
  });

  it("posts reply/cancel to management endpoints with stable payload", async function () {
    const requests: Array<{ url: string; method: string; body: string }> = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      requests.push({
        url,
        method: String(init?.method || "GET"),
        body: String(init?.body || ""),
      });
      if (url.endsWith("/reply")) {
        return new Response(
          JSON.stringify({
            request_id: "req-1",
            status: "waiting_user",
            accepted: true,
            mode: "interaction",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }
      return new Response(
        JSON.stringify({
          request_id: "req-1",
          run_id: "run-1",
          status: "canceled",
          accepted: true,
          message: "canceled",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    };

    const client = new SkillRunnerManagementClient({
      baseUrl: "http://127.0.0.1:8030",
      fetchImpl,
    });
    const reply = await client.submitReply({
      requestId: "req-1",
      payload: {
        mode: "interaction",
        interaction_id: 3,
        response: "ok",
      },
    });
    const canceled = await client.cancelRun({
      requestId: "req-1",
    });

    assert.equal(reply.accepted, true);
    assert.equal(canceled.accepted, true);
    assert.lengthOf(requests, 2);
    assert.equal(
      requests[0].url,
      "http://127.0.0.1:8030/v1/management/runs/req-1/reply",
    );
    assert.equal(requests[0].method, "POST");
    assert.deepEqual(JSON.parse(requests[0].body), {
      mode: "interaction",
      interaction_id: 3,
      response: "ok",
    });
    assert.equal(
      requests[1].url,
      "http://127.0.0.1:8030/v1/management/runs/req-1/cancel",
    );
    assert.equal(requests[1].method, "POST");
    assert.equal(requests[1].body, "{}");
  });

  it("posts auth import files to jobs interaction auth import endpoint", async function () {
    const requests: Array<{
      url: string;
      method: string;
      body?: BodyInit | null;
      contentType?: string | null;
    }> = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      requests.push({
        url,
        method: String(init?.method || "GET"),
        body: init?.body,
        contentType: headers.get("content-type"),
      });
      return new Response(
        JSON.stringify({
          request_id: "req-1",
          status: "waiting_auth",
          accepted: true,
          mode: "auth",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    };

    const client = new SkillRunnerManagementClient({
      baseUrl: "http://127.0.0.1:8030",
      fetchImpl,
    });
    const response = await client.submitAuthImport({
      requestId: "req-1",
      providerId: "google",
      files: [
        {
          name: "creds.json",
          content_base64: "eyJvayI6dHJ1ZX0=",
        },
      ],
    });

    assert.equal(response.accepted, true);
    assert.lengthOf(requests, 1);
    assert.equal(
      requests[0].url,
      "http://127.0.0.1:8030/v1/jobs/req-1/interaction/auth/import",
    );
    assert.equal(requests[0].method, "POST");
    assert.isNull(requests[0].contentType);
    const body = requests[0].body as FormData;
    assert.equal(body.get("provider_id"), "google");
    const files = body.getAll("files");
    assert.lengthOf(files, 1);
  });
});
