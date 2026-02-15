import type { TestDomain } from "./testMode";

const CORE_PATH_RE = /(^|\/)test\/core\//;
const UI_PATH_RE = /(^|\/)test\/ui\//;
const WORKFLOW_PATH_RE = /(^|\/)test\/workflow-/;

export function inferDomainFromFilePath(filePath: string): TestDomain {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  if (CORE_PATH_RE.test(normalized)) {
    return "core";
  }
  if (UI_PATH_RE.test(normalized)) {
    return "ui";
  }
  if (WORKFLOW_PATH_RE.test(normalized)) {
    return "workflow";
  }
  return "all";
}

export function shouldSkipByDomain(args: {
  selectedDomain: TestDomain;
  testDomain: TestDomain;
}) {
  if (args.selectedDomain === "all") {
    return false;
  }
  if (args.testDomain === "all") {
    return false;
  }
  return args.testDomain !== args.selectedDomain;
}
