import { buildSkillrunnerJobV1Request } from "./skillrunnerJobV1";

const builders = {
  "skillrunner.job.v1": buildSkillrunnerJobV1Request,
} as const;

export function buildRequestFromManifest(args: {
  kind: string;
  selectionContext: unknown;
  manifest: import("../types").WorkflowManifest;
}) {
  const builder = builders[args.kind as keyof typeof builders];
  if (!builder) {
    throw new Error(`Unsupported declarative request kind: ${args.kind}`);
  }
  return builder({
    selectionContext: args.selectionContext,
    manifest: args.manifest,
  });
}
