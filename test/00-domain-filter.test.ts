import { getTestDomain } from "./zotero/testMode";
import { inferDomainFromFilePath, shouldSkipByDomain } from "./zotero/domainFilter";

beforeEach(function () {
  const selectedDomain = getTestDomain();
  const currentFile = (this.currentTest && this.currentTest.file) || "";
  const testDomain = inferDomainFromFilePath(currentFile);
  if (shouldSkipByDomain({ selectedDomain, testDomain })) {
    this.skip();
  }
});
