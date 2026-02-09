import { SkillRunnerClient } from "../transport/skillrunnerClient";
import type {
  HttpStepsRequest,
  SkillRunnerExecutionResult,
} from "../transport/types";

export class SkillRunnerProvider {
  private readonly client: SkillRunnerClient;

  constructor(args: { baseUrl: string }) {
    this.client = new SkillRunnerClient({ baseUrl: args.baseUrl });
  }

  supportsRequestKind(requestKind: string) {
    return requestKind === "skillrunner.job.v1";
  }

  async execute(args: {
    requestKind: string;
    request: unknown;
  }): Promise<SkillRunnerExecutionResult> {
    if (!this.supportsRequestKind(args.requestKind)) {
      throw new Error(`Unsupported request kind for SkillRunner: ${args.requestKind}`);
    }
    const request = args.request as HttpStepsRequest;
    return this.client.executeHttpSteps(request);
  }
}

