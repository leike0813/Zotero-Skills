import { assert } from "chai";
import { compileDeclarativeRequest } from "../../src/workflows/declarativeRequestCompiler";

describe("declarative request compiler guards", function () {
  it("builds skillrunner request with inline input alongside upload selectors", function () {
    const request = compileDeclarativeRequest({
      kind: "skillrunner.job.v1",
      selectionContext: {
        items: {
          attachments: [
            {
              filePath: "D:/fixtures/only.md",
              mimeType: "text/markdown",
              parent: { id: 103, title: "Parent C" },
              item: { id: 9001, key: "AAA111" },
            },
          ],
        },
      },
      manifest: {
        id: "inline-input-pass-through",
        label: "Inline Input Pass Through",
        provider: "skillrunner",
        request: {
          kind: "skillrunner.job.v1",
          create: {
            skill_id: "tag-regulator",
          },
          input: {
            inline: {
              infer_tag: true,
              source: "workflow",
            },
            upload: {
              files: [
                {
                  key: "md_path",
                  from: "selected.markdown",
                },
              ],
            },
          },
        },
        hooks: {
          applyResult: "hooks/applyResult.js",
        },
      } as any,
      executionOptions: {
        workflowParams: {
          profile: "default",
        },
      },
    }) as {
      kind: string;
      skill_id: string;
      input?: Record<string, unknown>;
      upload_files: Array<{ key: string; path: string }>;
      parameter?: Record<string, unknown>;
    };

    assert.equal(request.kind, "skillrunner.job.v1");
    assert.equal(request.skill_id, "tag-regulator");
    assert.deepEqual(request.upload_files, [
      { key: "md_path", path: "D:/fixtures/only.md" },
    ]);
    assert.deepEqual(request.parameter, { profile: "default" });
    assert.deepEqual(request.input, {
      inline: {
        infer_tag: true,
        source: "workflow",
      },
    });
  });

  it("Risk: HR-03 rejects selector cardinality violations for selected.markdown", function () {
    let thrown: unknown = null;

    try {
      compileDeclarativeRequest({
        kind: "skillrunner.job.v1",
        selectionContext: {
          items: {
            attachments: [
              {
                filePath: "D:/fixtures/a.md",
                mimeType: "text/markdown",
                parent: { id: 101, title: "Parent A" },
              },
              {
                filePath: "D:/fixtures/b.md",
                mimeType: "text/markdown",
                parent: { id: 101, title: "Parent A" },
              },
            ],
          },
        },
        manifest: {
          id: "hr03-selector-cardinality",
          label: "HR03 Selector Cardinality",
          provider: "skillrunner",
          request: {
            kind: "skillrunner.job.v1",
            create: {
              skill_id: "literature-digest",
            },
            input: {
              upload: {
                files: [
                  {
                    key: "md_path",
                    from: "selected.markdown",
                  },
                ],
              },
            },
          },
          hooks: {
            applyResult: "hooks/applyResult.js",
          },
        } as any,
      });
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown);
    assert.match(
      String(thrown),
      /requires exactly 1 matched attachment, got 2/i,
    );
  });

  it("Risk: HR-03 rejects duplicated upload file keys deterministically", function () {
    let thrown: unknown = null;

    try {
      compileDeclarativeRequest({
        kind: "skillrunner.job.v1",
        selectionContext: {
          items: {
            attachments: [
              {
                filePath: "D:/fixtures/only.md",
                mimeType: "text/markdown",
                parent: { id: 102, title: "Parent B" },
              },
            ],
          },
        },
        manifest: {
          id: "hr03-duplicate-upload-key",
          label: "HR03 Duplicate Upload Key",
          provider: "skillrunner",
          request: {
            kind: "skillrunner.job.v1",
            create: {
              skill_id: "literature-digest",
            },
            input: {
              upload: {
                files: [
                  {
                    key: "md_path",
                    from: "selected.markdown",
                  },
                  {
                    key: "md_path",
                    from: "selected.markdown",
                  },
                ],
              },
            },
          },
          hooks: {
            applyResult: "hooks/applyResult.js",
          },
        } as any,
      });
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown);
    assert.match(String(thrown), /duplicated upload file key/i);
  });

  it("Risk: HR-03 rejects generic-http.steps.v1 requests without steps", function () {
    let thrown: unknown = null;

    try {
      compileDeclarativeRequest({
        kind: "generic-http.steps.v1",
        selectionContext: {
          items: {
            attachments: [],
          },
        },
        manifest: {
          id: "hr03-steps-missing",
          label: "HR03 Steps Missing",
          provider: "generic-http",
          request: {
            kind: "generic-http.steps.v1",
            steps: [],
          },
          hooks: {
            applyResult: "hooks/applyResult.js",
          },
        } as any,
      });
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown);
    assert.match(String(thrown), /requires request\.steps\[\]/i);
  });
});
