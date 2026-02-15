import { assert } from "chai";
import { inferDomainFromFilePath } from "../zotero/domainFilter";

describe("domain filter path inference", function () {
  it("infers core domain from relative path", function () {
    const domain = inferDomainFromFilePath("test/core/00-startup.test.ts");
    assert.equal(domain, "core");
  });

  it("infers ui domain from relative path", function () {
    const domain = inferDomainFromFilePath("test/ui/01-startup-workflow-menu-init.test.ts");
    assert.equal(domain, "ui");
  });

  it("infers workflow domain from relative path", function () {
    const domain = inferDomainFromFilePath(
      "test/workflow-literature-digest/21-workflow-literature-digest.test.ts",
    );
    assert.equal(domain, "workflow");
  });

  it("infers domain from absolute path", function () {
    const domain = inferDomainFromFilePath(
      "D:/Workspace/Code/JavaScript/Zotero-Skills/test/core/00-startup.test.ts",
    );
    assert.equal(domain, "core");
  });

  it("infers domain from windows backslash path", function () {
    const domain = inferDomainFromFilePath(
      "D:\\Workspace\\Code\\JavaScript\\Zotero-Skills\\test\\ui\\40-gui-preferences-menu-scan.test.ts",
    );
    assert.equal(domain, "ui");
  });

  it("returns all for unknown path", function () {
    const domain = inferDomainFromFilePath("test/misc/unknown.test.ts");
    assert.equal(domain, "all");
  });
});
