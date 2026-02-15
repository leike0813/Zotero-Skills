import { assert } from "chai";
import { SkillRunnerClient } from "../../src/providers/skillrunner/client";
import { fixturePath } from "./workflow-test-utils";

function createJsonResponse(payload: unknown, status = 200): Response {
  const text = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "ERROR",
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  } as unknown as Response;
}

describe("transport: upload fallback without FormData", function () {
  it("uploads using multipart bytes when FormData is unavailable", async function () {
    const originalFormData = (globalThis as { FormData?: unknown }).FormData;
    const originalBlob = (globalThis as { Blob?: unknown }).Blob;

    (globalThis as { FormData?: unknown }).FormData = undefined;
    (globalThis as { Blob?: unknown }).Blob = undefined;

    const capturedUpload: {
      headers?: Record<string, string>;
      bodyBytes?: Uint8Array;
    } = {};

    try {
      const client = new SkillRunnerClient({
        baseUrl: "http://127.0.0.1:8030",
        fetchImpl: async (url: string, init?: RequestInit) => {
          if (url.endsWith("/v1/jobs")) {
            return createJsonResponse({ request_id: "req-1" });
          }
          if (url.endsWith("/v1/jobs/req-1/upload")) {
            capturedUpload.headers = (init?.headers || {}) as Record<string, string>;
            const body = init?.body as Uint8Array;
            capturedUpload.bodyBytes =
              body instanceof Uint8Array ? body : new Uint8Array();
            return createJsonResponse({ ok: true });
          }
          if (url.endsWith("/v1/jobs/req-1")) {
            return createJsonResponse({ request_id: "req-1", status: "succeeded" });
          }
          if (url.endsWith("/v1/jobs/req-1/result")) {
            return createJsonResponse({
              request_id: "req-1",
              status: "succeeded",
              data: { digest_path: "digest.md", references_path: "references.json" },
            });
          }
          return createJsonResponse({ error: "unexpected route" }, 404);
        },
      });

      const result = await client.executeHttpSteps({
        kind: "http.steps",
        poll: { interval_ms: 0, timeout_ms: 1000 },
        steps: [
          {
            id: "create",
            request: {
              method: "POST",
              path: "/v1/jobs",
              json: {
                skill_id: "literature-digest",
                engine: "gemini",
                parameter: { language: "en-US" },
              },
            },
            extract: { request_id: "$.request_id" },
          },
          {
            id: "upload",
            request: {
              method: "POST",
              path: "/v1/jobs/{request_id}/upload",
              multipart: true,
            },
            files: [
              {
                key: "md_path",
                path: fixturePath("literature-digest", "example.md"),
              },
            ],
          },
          {
            id: "poll",
            request: {
              method: "GET",
              path: "/v1/jobs/{request_id}",
            },
          },
          {
            id: "result",
            request: {
              method: "GET",
              path: "/v1/jobs/{request_id}/result",
            },
          },
        ],
      });

      assert.equal(result.status, "succeeded");
      assert.equal(result.fetchType, "result");
      const contentType = String(capturedUpload.headers?.["content-type"] || "");
      assert.match(contentType, /^multipart\/form-data;\s*boundary=/);
      const uploadText = new TextDecoder().decode(capturedUpload.bodyBytes);
      assert.include(uploadText, 'name="file"');
      assert.include(uploadText, 'filename="inputs.zip"');
    } finally {
      (globalThis as { FormData?: unknown }).FormData = originalFormData;
      (globalThis as { Blob?: unknown }).Blob = originalBlob;
    }
  });
});
