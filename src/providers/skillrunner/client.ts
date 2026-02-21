import type {
  ProviderExecutionResult,
  SkillRunnerHttpStepDefinition,
  SkillRunnerHttpStepsRequest,
  SkillRunnerJobRequestV1,
} from "../contracts";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type DynamicImport = (specifier: string) => Promise<any>;

const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

function ensureLeadingSlash(input: string) {
  return input.startsWith("/") ? input : `/${input}`;
}

function interpolatePath(template: string, values: Record<string, string>) {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => values[key] || "");
}

function resolveJsonPath(root: unknown, pathExpr: string) {
  if (!pathExpr.startsWith("$.")) {
    throw new Error(`Unsupported json path expression: ${pathExpr}`);
  }
  const parts = pathExpr.slice(2).split(".").filter(Boolean);
  let cursor: unknown = root;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function basename(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "upload.bin";
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const idx = (crc ^ bytes[i]) & 0xff;
    crc = (CRC32_TABLE[idx] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16LE(value: number, target: number[]) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32LE(value: number, target: number[]) {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, entry) => sum + entry.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function utf8Bytes(input: string) {
  return new TextEncoder().encode(input);
}

function createMultipartZipPayload(args: { zipBytes: Uint8Array; filename: string }) {
  const boundary = `----zotero-skills-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const start = utf8Bytes(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${args.filename}"\r\n` +
      `Content-Type: application/zip\r\n\r\n`,
  );
  const end = utf8Bytes(`\r\n--${boundary}--\r\n`);
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: concatBytes([start, args.zipBytes, end]),
  };
}

function createZipFromNamedFiles(entries: Array<{ name: string; data: Uint8Array }>) {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = utf8Bytes(entry.name);
    const crc = crc32(entry.data);
    const localHeader: number[] = [];
    writeUint32LE(0x04034b50, localHeader);
    writeUint16LE(20, localHeader);
    writeUint16LE(0, localHeader);
    writeUint16LE(0, localHeader);
    writeUint16LE(0, localHeader);
    writeUint16LE(0, localHeader);
    writeUint32LE(crc, localHeader);
    writeUint32LE(entry.data.length, localHeader);
    writeUint32LE(entry.data.length, localHeader);
    writeUint16LE(nameBytes.length, localHeader);
    writeUint16LE(0, localHeader);

    const localBlock = concatBytes([
      new Uint8Array(localHeader),
      nameBytes,
      entry.data,
    ]);
    localChunks.push(localBlock);

    const centralHeader: number[] = [];
    writeUint32LE(0x02014b50, centralHeader);
    writeUint16LE(20, centralHeader);
    writeUint16LE(20, centralHeader);
    writeUint16LE(0, centralHeader);
    writeUint16LE(0, centralHeader);
    writeUint16LE(0, centralHeader);
    writeUint16LE(0, centralHeader);
    writeUint32LE(crc, centralHeader);
    writeUint32LE(entry.data.length, centralHeader);
    writeUint32LE(entry.data.length, centralHeader);
    writeUint16LE(nameBytes.length, centralHeader);
    writeUint16LE(0, centralHeader);
    writeUint16LE(0, centralHeader);
    writeUint16LE(0, centralHeader);
    writeUint16LE(0, centralHeader);
    writeUint32LE(0, centralHeader);
    writeUint32LE(offset, centralHeader);

    const centralBlock = concatBytes([new Uint8Array(centralHeader), nameBytes]);
    centralChunks.push(centralBlock);
    offset += localBlock.length;
  }

  const centralData = concatBytes(centralChunks);
  const localData = concatBytes(localChunks);
  const eocd: number[] = [];
  writeUint32LE(0x06054b50, eocd);
  writeUint16LE(0, eocd);
  writeUint16LE(0, eocd);
  writeUint16LE(entries.length, eocd);
  writeUint16LE(entries.length, eocd);
  writeUint32LE(centralData.length, eocd);
  writeUint32LE(localData.length, eocd);
  writeUint16LE(0, eocd);

  return concatBytes([localData, centralData, new Uint8Array(eocd)]);
}

async function readFileBytes(filePath: string) {
  const runtime = globalThis as {
    IOUtils?: { read: (targetPath: string) => Promise<Uint8Array> };
  };
  if (runtime.IOUtils && typeof runtime.IOUtils.read === "function") {
    return runtime.IOUtils.read(filePath);
  }
  const fs = await dynamicImport("fs/promises");
  const bytes = await fs.readFile(filePath);
  return new Uint8Array(bytes);
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }
  const runtime = globalThis as {
    Zotero?: { Promise?: { delay?: (delayMs: number) => Promise<void> } };
  };
  if (typeof runtime.Zotero?.Promise?.delay === "function") {
    await runtime.Zotero.Promise.delay(ms);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonOrThrow(response: Response) {
  const text = await response.text();
  let body: unknown = {};
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} ${JSON.stringify(body)}`,
    );
  }
  return body;
}

export class SkillRunnerClient {
  private readonly baseUrl: string;

  private readonly fetchImpl: FetchLike;

  constructor(args: { baseUrl: string; fetchImpl?: FetchLike }) {
    this.baseUrl = args.baseUrl.replace(/\/+$/, "");
    const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
    if (typeof args.fetchImpl === "function") {
      this.fetchImpl = args.fetchImpl;
    } else if (typeof globalFetch === "function") {
      this.fetchImpl = globalFetch.bind(globalThis);
    } else {
      throw new Error("fetch() is unavailable in current runtime");
    }
  }

  private buildUrl(path: string) {
    return `${this.baseUrl}${ensureLeadingSlash(path)}`;
  }

  private findStep(request: SkillRunnerHttpStepsRequest, stepId: string) {
    return request.steps.find((step) => step.id === stepId);
  }

  private async executeCreateStep(step: SkillRunnerHttpStepDefinition) {
    const response = await this.fetchImpl(this.buildUrl(step.request.path), {
      method: step.request.method,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(step.request.json || {}),
    });
    const body = await readJsonOrThrow(response);
    const pathExpr = step.extract?.request_id || "$.request_id";
    const requestId = resolveJsonPath(body, pathExpr);
    if (typeof requestId !== "string" || requestId.length === 0) {
      throw new Error(`request_id not found from create step by ${pathExpr}`);
    }
    return requestId;
  }

  private async executeUploadStep(
    step: SkillRunnerHttpStepDefinition,
    requestId: string,
  ) {
    const files = step.files || [];
    const zipEntries: Array<{ name: string; data: Uint8Array }> = [];
    for (const file of files) {
      const bytes = await readFileBytes(file.path);
      zipEntries.push({
        name: file.key,
        data: bytes,
      });
    }
    const zipBytes = createZipFromNamedFiles(zipEntries);
    const runtime = globalThis as {
      FormData?: new () => {
        append: (name: string, value: unknown, filename?: string) => void;
      };
      Blob?: new (
        blobParts?: Array<BlobPart>,
        options?: BlobPropertyBag,
      ) => Blob;
    };
    const canUseNativeFormData =
      typeof runtime.FormData === "function" && typeof runtime.Blob === "function";

    let body: BodyInit;
    let headers: Record<string, string> | undefined;
    if (canUseNativeFormData) {
      const form = new runtime.FormData!();
      form.append("file", new runtime.Blob!([zipBytes]), "inputs.zip");
      body = form as unknown as BodyInit;
    } else {
      const multipart = createMultipartZipPayload({
        zipBytes,
        filename: "inputs.zip",
      });
      headers = {
        "content-type": multipart.contentType,
      };
      body = multipart.body;
    }

    const response = await this.fetchImpl(
      this.buildUrl(interpolatePath(step.request.path, { request_id: requestId })),
      {
        method: step.request.method,
        headers,
        body,
      },
    );
    await readJsonOrThrow(response);
  }

  private async executePollStep(
    request: SkillRunnerHttpStepsRequest,
    step: SkillRunnerHttpStepDefinition,
    requestId: string,
  ) {
    const startedAt = Date.now();
    const intervalMs = Math.max(0, request.poll?.interval_ms ?? 2000);
    const timeoutMs = Math.max(1, request.poll?.timeout_ms ?? 600000);
    while (true) {
      const response = await this.fetchImpl(
        this.buildUrl(
          interpolatePath(step.request.path, { request_id: requestId }),
        ),
        {
          method: step.request.method,
        },
      );
      const body = (await readJsonOrThrow(response)) as {
        status?: string;
        error?: string;
      };
      const status = body.status || "";
      if (status === "succeeded") {
        return body;
      }
      if (status === "failed") {
        throw new Error(`SkillRunner job failed: ${body.error || "unknown error"}`);
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`SkillRunner polling timeout after ${timeoutMs}ms`);
      }
      await sleep(intervalMs);
    }
  }

  private async executeBundleStep(
    step: SkillRunnerHttpStepDefinition,
    requestId: string,
  ) {
    const response = await this.fetchImpl(
      this.buildUrl(interpolatePath(step.request.path, { request_id: requestId })),
      {
        method: step.request.method,
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Bundle fetch failed: HTTP ${response.status} ${text}`);
    }
    const data = await response.arrayBuffer();
    return new Uint8Array(data);
  }

  private async executeResultStep(
    step: SkillRunnerHttpStepDefinition,
    requestId: string,
  ) {
    const response = await this.fetchImpl(
      this.buildUrl(interpolatePath(step.request.path, { request_id: requestId })),
      {
        method: step.request.method,
      },
    );
    return readJsonOrThrow(response);
  }

  private toHttpStepsRequest(
    request: SkillRunnerJobRequestV1,
    providerOptions: Record<string, unknown>,
  ): SkillRunnerHttpStepsRequest {
    const engine = String(providerOptions.engine || "").trim();
    const model = String(providerOptions.model || "").trim();
    const runtimeOptions: Record<string, unknown> = {};
    if (
      providerOptions.no_cache === true ||
      String(providerOptions.no_cache || "").toLowerCase() === "true"
    ) {
      runtimeOptions.no_cache = true;
    }
    const fetchType = request.fetch_type === "result" ? "result" : "bundle";
    return {
      kind: "http.steps",
      targetParentID: request.targetParentID,
      taskName: request.taskName,
      sourceAttachmentPaths: request.sourceAttachmentPaths,
      steps: [
        {
          id: "create",
          request: {
            method: "POST",
            path: "/v1/jobs",
            json: {
              skill_id: request.skill_id,
              ...(engine ? { engine } : {}),
              ...(model ? { model } : {}),
              ...(request.input ? { input: request.input } : {}),
              parameter: request.parameter || {},
              ...(Object.keys(runtimeOptions).length > 0
                ? { runtime_options: runtimeOptions }
                : {}),
            },
          },
          extract: {
            request_id: "$.request_id",
          },
        },
        {
          id: "upload",
          request: {
            method: "POST",
            path: "/v1/jobs/{request_id}/upload",
            multipart: true,
          },
          files: request.upload_files,
        },
        {
          id: "poll",
          request: {
            method: "GET",
            path: "/v1/jobs/{request_id}",
          },
          repeat_until: "status in ['succeeded','failed']",
        },
        {
          id: fetchType,
          request: {
            method: "GET",
            path:
              fetchType === "result"
                ? "/v1/jobs/{request_id}/result"
                : "/v1/jobs/{request_id}/bundle",
          },
        },
      ],
      poll: {
        interval_ms: request.poll?.interval_ms,
        timeout_ms: request.poll?.timeout_ms,
      },
    };
  }

  async executeHttpSteps(
    request: SkillRunnerHttpStepsRequest,
  ): Promise<ProviderExecutionResult> {
    if (request.kind !== "http.steps") {
      throw new Error(`Unsupported transport request kind: ${request.kind}`);
    }

    const createStep = this.findStep(request, "create");
    const uploadStep = this.findStep(request, "upload");
    const pollStep = this.findStep(request, "poll");
    const bundleStep = this.findStep(request, "bundle");
    const resultStep = this.findStep(request, "result");
    if (!createStep || !uploadStep || !pollStep) {
      throw new Error("http.steps request missing create/upload/poll step");
    }
    if (!bundleStep && !resultStep) {
      throw new Error("http.steps request missing terminal fetch step (bundle or result)");
    }

    const requestId = await this.executeCreateStep(createStep);
    await this.executeUploadStep(uploadStep, requestId);
    const pollResult = await this.executePollStep(request, pollStep, requestId);
    if (bundleStep) {
      const bundleBytes = await this.executeBundleStep(bundleStep, requestId);
      return {
        status: "succeeded",
        requestId,
        fetchType: "bundle",
        bundleBytes,
        responseJson: pollResult,
      };
    }
    const resultJson = await this.executeResultStep(resultStep!, requestId);
    return {
      status: "succeeded",
      requestId,
      fetchType: "result",
      resultJson,
      responseJson: pollResult,
    };
  }

  async executeSkillRunnerJob(
    request: SkillRunnerJobRequestV1,
    providerOptions: Record<string, unknown>,
  ) {
    return this.executeHttpSteps(
      this.toHttpStepsRequest(request, providerOptions),
    );
  }
}
