import { assert } from "chai";
import { config } from "../../package.json";
import { handlers } from "../../src/handlers";
import type { RuntimeLogEntry } from "../../src/modules/runtimeLogManager";
import { resetRuntimeBridgeOverrideForTests } from "../../src/utils/runtimeBridge";
import { __tagManagerTestOnly } from "../../workflows_builtin/tag-vocabulary-package/tag-manager/hooks/applyResult.mjs";
import {
  installWorkflowFetchMockAcrossRuntimes,
  installTagVocabularyHostApiGlobals,
  installTagVocabularySyncCapture,
} from "../workflow-tag-vocabulary/hostApiTestUtils";
import { encodeBase64Utf8, isZoteroRuntime } from "../zotero/workflow-test-utils";

function installFetchMock(
  mockFetch: (
    input: string,
    init?: Record<string, unknown>,
  ) => Promise<{
    ok: boolean;
    status: number;
    statusText?: string;
    json: () => Promise<unknown>;
  }>,
) {
  return installWorkflowFetchMockAcrossRuntimes(mockFetch);
}

function installSyncBridgeMock(
  logs: RuntimeLogEntry[],
  toasts: Array<{ text?: string; type?: string }> = [],
) {
  return installTagVocabularySyncCapture({ logs, toasts });
}

function listTags(item: Zotero.Item) {
  return item
    .getTags()
    .map((entry) => String(entry.tag || "").trim())
    .filter(Boolean)
    .sort((left, right) =>
      left.localeCompare(right, "en", {
        sensitivity: "base",
      }),
    );
}

function toBase64(text: string) {
  return encodeBase64Utf8(text);
}

function withBase64LineBreaks(text: string) {
  return text.replace(/(.{24})/g, "$1\n");
}

describe("workflow: tag-manager github sync", function () {
  const itNodeOnly = isZoteroRuntime() ? it.skip : it;
  const ACTIVE_PREF_KEY = `${config.prefsPrefix}.tagVocabularyJson`;
  const LOCAL_PREF_KEY = `${config.prefsPrefix}.tagVocabularyLocalCommittedJson`;
  const REMOTE_PREF_KEY = `${config.prefsPrefix}.tagVocabularyRemoteCommittedJson`;
  const STAGED_PREF_KEY = `${config.prefsPrefix}.tagVocabularyStagedJson`;
  let restoreHostApi: (() => void) | null = null;

  beforeEach(function () {
    Zotero.Prefs.clear(ACTIVE_PREF_KEY, true);
    Zotero.Prefs.clear(LOCAL_PREF_KEY, true);
    Zotero.Prefs.clear(REMOTE_PREF_KEY, true);
    Zotero.Prefs.clear(STAGED_PREF_KEY, true);
    resetRuntimeBridgeOverrideForTests();
    restoreHostApi = installTagVocabularyHostApiGlobals();
  });

  afterEach(function () {
    restoreHostApi?.();
    restoreHostApi = null;
    resetRuntimeBridgeOverrideForTests();
    Zotero.Prefs.clear(ACTIVE_PREF_KEY, true);
    Zotero.Prefs.clear(LOCAL_PREF_KEY, true);
    Zotero.Prefs.clear(REMOTE_PREF_KEY, true);
    Zotero.Prefs.clear(STAGED_PREF_KEY, true);
  });

  itNodeOnly("commits staged entries in one subscription-mode publish transaction", async function () {
    const requests: Array<{ url: string; method: string; body: string }> = [];
    const logs: Array<Record<string, unknown>> = [];
    const toasts: Array<{ text?: string; type?: string }> = [];
    const restoreBridge = installSyncBridgeMock(logs, toasts);
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Manager Bound Parent" },
    });
    const restoreFetch = installFetchMock(async (input, init) => {
      const url = String(input || "");
      const method = String(init?.method || "GET").toUpperCase();
      const body = String(init?.body || "");
      requests.push({ url, method, body });
      if (method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sha: "sha-batch-1",
            content: toBase64(
              JSON.stringify({
                version: "1.0.0",
                updated_at: "2026-04-02T00:00:00.000Z",
                facets: ["topic"],
                tags: [
                  {
                    tag: "topic:remote-existing",
                    facet: "topic",
                    source: "remote",
                    note: "existing",
                    deprecated: false,
                  },
                ],
                abbrevs: { llm: "LLM" },
                tag_count: 1,
              }),
            ),
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });

    try {
      __tagManagerTestOnly.persistRemoteCommittedEntries([
        {
          tag: "topic:remote-existing",
          facet: "topic",
          source: "remote",
          note: "existing",
          deprecated: false,
        },
      ]);
      __tagManagerTestOnly.persistStagedEntries([
        {
          tag: "topic:batch-a",
          facet: "topic",
          source: "agent-suggest",
          note: "batch-a",
          deprecated: false,
          parentBindings: [parent.id],
        },
        {
          tag: "topic:batch-b",
          facet: "topic",
          source: "agent-suggest",
          note: "batch-b",
          deprecated: false,
        },
      ]);

      const committed = await __tagManagerTestOnly.commitStagedEntriesBatch({
        workflowId: "tag-manager",
        config: {
          githubOwner: "demo-owner",
          githubRepo: "Zotero_TagVocab",
          filePath: "tags/tags.json",
          githubToken: "secret-token",
        },
        tags: ["topic:batch-a", "topic:batch-b"],
      });

      assert.deepEqual(
        committed.entries.map((entry: { tag: string }) => entry.tag),
        ["topic:batch-a", "topic:batch-b", "topic:remote-existing"],
      );
      assert.deepEqual(
        __tagManagerTestOnly
          .loadRemoteCommittedState()
          .entries.map((entry: { tag: string }) => entry.tag),
        ["topic:batch-a", "topic:batch-b", "topic:remote-existing"],
      );
      assert.deepEqual(
        __tagManagerTestOnly
          .loadPersistedStagedState()
          .entries.map((entry: { tag: string }) => entry.tag),
        [],
      );
      assert.deepEqual(listTags(parent), ["topic:batch-a"]);
      assert.isTrue(
        toasts.some(
          (entry) =>
            String(entry.type || "") === "success" &&
            /staged publish succeeded/i.test(String(entry.text || "")),
        ),
      );
      assert.isTrue(
        logs.some(
          (entry) =>
            String(entry.stage || "") === "staged-parent-bindings-applied-to-items",
        ),
      );
      const putRequests = requests.filter((entry) => entry.method === "PUT");
      assert.lengthOf(putRequests, 1);
      const payload = JSON.parse(String(putRequests[0].body || "{}"));
      const published = JSON.parse(
        Buffer.from(String(payload.content || ""), "base64").toString("utf8"),
      );
      assert.deepEqual(
        published.tags.map((entry: { tag: string }) => entry.tag),
        ["topic:batch-a", "topic:batch-b", "topic:remote-existing"],
      );
    } finally {
      restoreFetch();
      restoreBridge();
    }
  });

  it("keeps staged entries when subscription-mode staged publish fails", async function () {
    const logs: Array<Record<string, unknown>> = [];
    const toasts: Array<{ text?: string; type?: string }> = [];
    const restoreBridge = installSyncBridgeMock(logs, toasts);
    const restoreFetch = installFetchMock(async (_input, init) => {
      const method = String(init?.method || "GET").toUpperCase();
      if (method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sha: "sha-batch-1",
            content: toBase64(
              JSON.stringify({
                version: "1.0.0",
                updated_at: "2026-04-02T00:00:00.000Z",
                facets: ["topic"],
                tags: [
                  {
                    tag: "topic:remote-existing",
                    facet: "topic",
                    source: "remote",
                    note: "existing",
                    deprecated: false,
                  },
                ],
                abbrevs: {},
                tag_count: 1,
              }),
            ),
          }),
        };
      }
      return {
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: async () => ({}),
      };
    });

    try {
      __tagManagerTestOnly.persistRemoteCommittedEntries([
        {
          tag: "topic:remote-existing",
          facet: "topic",
          source: "remote",
          note: "existing",
          deprecated: false,
        },
      ]);
      __tagManagerTestOnly.persistStagedEntries([
        {
          tag: "topic:batch-a",
          facet: "topic",
          source: "agent-suggest",
          note: "batch-a",
          deprecated: false,
        },
      ]);

      let thrown: unknown = null;
      try {
        await __tagManagerTestOnly.commitStagedEntriesBatch({
          workflowId: "tag-manager",
          config: {
            githubOwner: "demo-owner",
            githubRepo: "Zotero_TagVocab",
            filePath: "tags/tags.json",
            githubToken: "secret-token",
          },
          tags: ["topic:batch-a"],
        });
      } catch (error) {
        thrown = error;
      }

      assert.isOk(thrown);
      assert.deepEqual(
        __tagManagerTestOnly
          .loadRemoteCommittedState()
          .entries.map((entry: { tag: string }) => entry.tag),
        ["topic:remote-existing"],
      );
      assert.deepEqual(
        __tagManagerTestOnly
          .loadPersistedStagedState()
          .entries.map((entry: { tag: string }) => entry.tag),
        ["topic:batch-a"],
      );
    } finally {
      restoreFetch();
      restoreBridge();
    }

    assert.isTrue(
      toasts.some(
        (entry) =>
          String(entry.type || "") === "error" &&
          /staged publish failed/i.test(String(entry.text || "")),
      ),
    );
  });

  itNodeOnly("retries once on GitHub contents conflict and preserves remote abbrevs", async function () {
    const requests: Array<{ url: string; method: string; body: string }> = [];
    const logs: Array<Record<string, unknown>> = [];
    let putCount = 0;
    const restoreBridge = installSyncBridgeMock(logs);
    const restoreFetch = installFetchMock(async (input, init) => {
      const url = String(input || "");
      const method = String(init?.method || "GET").toUpperCase();
      const body = String(init?.body || "");
      requests.push({ url, method, body });
      if (method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sha: putCount === 0 ? "sha-1" : "sha-2",
            content: toBase64(
              JSON.stringify({
                version: "1.0.0",
                updated_at: "2026-04-02T00:00:00.000Z",
                facets: ["topic"],
                tags: [],
                abbrevs: { llm: "LLM" },
                tag_count: 0,
              }),
            ),
          }),
        };
      }
      putCount += 1;
      if (putCount === 1) {
        return {
          ok: false,
          status: 409,
          statusText: "Conflict",
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });

    try {
      const published = await __tagManagerTestOnly.publishRemoteVocabulary({
        workflowId: "tag-manager",
        config: {
          githubOwner: "demo-owner",
          githubRepo: "Zotero_TagVocab",
          filePath: "tags/tags.json",
          githubToken: "secret-token",
        },
        entries: [
          {
            tag: "topic:conflict-safe",
            facet: "topic",
            source: "manual",
            note: "local",
            deprecated: false,
          },
        ],
      });

      assert.equal(putCount, 2);
      assert.deepEqual(published.abbrevs, { llm: "LLM" });
      assert.isTrue(
        logs.some((entry) => String(entry.stage || "") === "publish-conflict"),
      );
      const lastPut = requests.filter((entry) => entry.method === "PUT").at(-1);
      assert.isOk(lastPut);
      const body = JSON.parse(String(lastPut!.body || "{}"));
      assert.equal(body.sha, "sha-2");
      const payload = JSON.parse(
        Buffer.from(String(body.content || ""), "base64").toString("utf8"),
      );
      assert.deepEqual(payload.abbrevs, { llm: "LLM" });
      assert.deepEqual(
        payload.tags.map((entry: { tag: string }) => entry.tag),
        ["topic:conflict-safe"],
      );
    } finally {
      restoreFetch();
      restoreBridge();
    }
  });

  itNodeOnly("accepts GitHub contents payload content with line breaks during publish baseline fetch", async function () {
    const requests: Array<{ url: string; method: string; body: string }> = [];
    const restoreBridge = installSyncBridgeMock([]);
    const restoreFetch = installFetchMock(async (input, init) => {
      const url = String(input || "");
      const method = String(init?.method || "GET").toUpperCase();
      const body = String(init?.body || "");
      requests.push({ url, method, body });
      if (method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sha: "sha-line-breaks-1",
            content: withBase64LineBreaks(
              toBase64(
                JSON.stringify({
                  version: "1.0.0",
                  updated_at: "2026-04-02T00:00:00.000Z",
                  facets: ["topic"],
                  tags: [
                    {
                      tag: "topic:remote-existing",
                      facet: "topic",
                      source: "remote",
                      note: "existing",
                      deprecated: false,
                    },
                  ],
                  abbrevs: { llm: "LLM" },
                  tag_count: 1,
                }),
              ),
            ),
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });

    try {
      const published = await __tagManagerTestOnly.publishRemoteVocabulary({
        workflowId: "tag-manager",
        config: {
          githubOwner: "demo-owner",
          githubRepo: "Zotero_TagVocab",
          filePath: "tags/tags.json",
          githubToken: "secret-token",
        },
        entries: [
          {
            tag: "topic:line-break-safe",
            facet: "topic",
            source: "manual",
            note: "local",
            deprecated: false,
          },
        ],
      });

      assert.deepEqual(published.abbrevs, { llm: "LLM" });
      const putRequest = requests.find((entry) => entry.method === "PUT");
      assert.isOk(putRequest);
      const payload = JSON.parse(String(putRequest?.body || "{}"));
      const decoded = JSON.parse(
        Buffer.from(String(payload.content || ""), "base64").toString("utf8"),
      );
      assert.deepEqual(
        decoded.tags.map((entry: { tag: string }) => entry.tag),
        ["topic:line-break-safe"],
      );
      assert.deepEqual(decoded.abbrevs, { llm: "LLM" });
    } finally {
      restoreFetch();
      restoreBridge();
    }
  });
});
