import type { JobRecord, JobState } from "../jobQueue/manager";
import { isActive } from "./skillRunnerProviderStateMachine";

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

type JobLike = Pick<JobRecord, "meta" | "result" | "state"> & {
  error?: string;
};

export function isSkillRunnerJobLike(job: Pick<JobRecord, "meta"> | null | undefined) {
  return normalizeString(job?.meta?.providerId) === "skillrunner";
}

export function getSkillRunnerRequestIdFromJob(
  job: Pick<JobRecord, "meta" | "result"> | null | undefined,
) {
  if (!job) {
    return "";
  }
  const resultRequestId =
    job.result && typeof job.result === "object" && !Array.isArray(job.result)
      ? normalizeString((job.result as { requestId?: unknown }).requestId)
      : "";
  return resultRequestId || normalizeString(job.meta?.requestId);
}

export function hasRecoverableSkillRunnerRequest(job: JobLike | null | undefined) {
  return isSkillRunnerJobLike(job) && !!getSkillRunnerRequestIdFromJob(job);
}

export function coerceRecoverableSkillRunnerState(state: JobState) {
  return isActive(state) ? state : ("running" as const);
}

export function isRecoverableSkillRunnerDispatchFailure(
  job: JobLike | null | undefined,
) {
  return hasRecoverableSkillRunnerRequest(job) && normalizeString(job?.state) === "failed";
}
