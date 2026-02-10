function truncateLine(input: string, maxLength = 160) {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) {
    return "unknown error";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

export function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return truncateLine(error.message || error.name);
  }
  if (typeof error === "string") {
    return truncateLine(error);
  }
  try {
    return truncateLine(JSON.stringify(error));
  } catch {
    return truncateLine(String(error));
  }
}

export function buildWorkflowFinishMessage(args: {
  workflowLabel: string;
  succeeded: number;
  failed: number;
  skipped?: number;
  failureReasons: string[];
}) {
  const skipped = Math.max(0, args.skipped || 0);
  const skippedPart = skipped > 0 ? `, skipped=${skipped}` : "";
  const base = `Workflow ${args.workflowLabel} finished. succeeded=${args.succeeded}, failed=${args.failed}${skippedPart}`;
  const reasons = args.failureReasons.filter(Boolean);
  if (args.failed <= 0 || reasons.length === 0) {
    return base;
  }
  const visibleReasons = reasons.slice(0, 3);
  const overflow = reasons.length - visibleReasons.length;
  const details = visibleReasons
    .map((reason, index) => `${index + 1}. ${truncateLine(reason)}`)
    .join("\n");
  if (overflow > 0) {
    return `${base}\nFailure reasons:\n${details}\n...and ${overflow} more`;
  }
  return `${base}\nFailure reasons:\n${details}`;
}
