export type SkillRunnerCreatePayload = {
  skill_id?: unknown;
  engine?: unknown;
  parameter?: unknown;
};

export function validateCreatePayload(payload: unknown) {
  const body = (payload || {}) as SkillRunnerCreatePayload;
  const errors: string[] = [];
  if (typeof body.skill_id !== "string" || body.skill_id.length === 0) {
    errors.push("skill_id is required");
  }
  if (typeof body.engine !== "string" || body.engine.length === 0) {
    errors.push("engine is required");
  }
  if (
    typeof body.parameter !== "object" ||
    body.parameter === null ||
    Array.isArray(body.parameter)
  ) {
    errors.push("parameter must be an object");
  }
  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateMultipartHasField(bodyRaw: string, fieldName: string) {
  return bodyRaw.includes(`name="${fieldName}"`);
}

