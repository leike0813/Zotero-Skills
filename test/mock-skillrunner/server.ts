import { createServer } from "http";
import fs from "fs";
import path from "path";
import {
  validateCreatePayload,
  validateMultipartHasField,
} from "./contracts";

type MockJob = {
  id: string;
  createPayload: unknown;
  uploadReceived: boolean;
  pollCount: number;
};

type TrafficRecord = {
  method: string;
  url: string;
  contentType: string;
  body:
    | { kind: "json"; value: unknown }
    | {
        kind: "multipart";
        fields: string[];
        filenames: string[];
      }
    | { kind: "text"; value: string };
};

export type MockSkillRunnerServer = {
  baseUrl: string;
  close: () => Promise<void>;
  getJobs: () => MockJob[];
  getTraffic: () => TrafficRecord[];
};

export async function startMockSkillRunnerServer(args: {
  bundlePath: string;
  pollDelayMs?: number;
  host?: string;
  port?: number;
}) {
  const jobs = new Map<string, MockJob>();
  const traffic: TrafficRecord[] = [];
  let nextId = 1;
  const bundleBytes = fs.readFileSync(args.bundlePath);
  const pollDelayMs = Math.max(0, args.pollDelayMs ?? 50);

  const server = createServer((req, res) => {
    const method = req.method || "GET";
    const url = req.url || "/";
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", async () => {
      const bodyRaw = Buffer.concat(chunks).toString("utf8");
      const contentType = String(req.headers["content-type"] || "");
      if (bodyRaw.length > 0) {
        if (contentType.includes("application/json")) {
          let parsed: unknown = {};
          try {
            parsed = JSON.parse(bodyRaw);
          } catch {
            parsed = { raw: bodyRaw };
          }
          traffic.push({
            method,
            url,
            contentType,
            body: {
              kind: "json",
              value: parsed,
            },
          });
        } else if (contentType.includes("multipart/form-data")) {
          const fields = Array.from(
            bodyRaw.matchAll(/;\s*name="([^"]+)"/g),
            (match) => match[1],
          );
          const filenames = Array.from(
            bodyRaw.matchAll(/;\s*filename="([^"]+)"/g),
            (match) => match[1],
          );
          traffic.push({
            method,
            url,
            contentType,
            body: {
              kind: "multipart",
              fields,
              filenames,
            },
          });
        } else {
          traffic.push({
            method,
            url,
            contentType,
            body: {
              kind: "text",
              value: bodyRaw,
            },
          });
        }
      } else {
        traffic.push({
          method,
          url,
          contentType,
          body: {
            kind: "text",
            value: "",
          },
        });
      }

      if (method === "POST" && url === "/v1/jobs") {
        let payload: unknown;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          res.statusCode = 400;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "invalid json body" }));
          return;
        }
        const validated = validateCreatePayload(payload);
        if (!validated.ok) {
          res.statusCode = 400;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: validated.errors.join("; ") }));
          return;
        }
        const requestId = String(nextId++);
        jobs.set(requestId, {
          id: requestId,
          createPayload: payload,
          uploadReceived: false,
          pollCount: 0,
        });
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ request_id: requestId }));
        return;
      }

      const uploadMatch = url.match(/^\/v1\/jobs\/([^/]+)\/upload$/);
      if (method === "POST" && uploadMatch) {
        const requestId = uploadMatch[1];
        const job = jobs.get(requestId);
        if (!job) {
          res.statusCode = 404;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "job not found" }));
          return;
        }
        const hasFileField = validateMultipartHasField(bodyRaw, "file");
        const hasLegacyField = validateMultipartHasField(bodyRaw, "md_path");
        if (!hasFileField && !hasLegacyField) {
          res.statusCode = 400;
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              error: "missing multipart field: file (or legacy md_path)",
            }),
          );
          return;
        }
        job.uploadReceived = true;
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      const pollMatch = url.match(/^\/v1\/jobs\/([^/]+)$/);
      if (method === "GET" && pollMatch) {
        const requestId = pollMatch[1];
        const job = jobs.get(requestId);
        if (!job) {
          res.statusCode = 404;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "job not found" }));
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
        job.pollCount += 1;
        let status = "queued";
        if (!job.uploadReceived) {
          status = "queued";
        } else if (job.pollCount === 1) {
          status = "running";
        } else {
          status = "succeeded";
        }
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ request_id: requestId, status }));
        return;
      }

      const bundleMatch = url.match(/^\/v1\/jobs\/([^/]+)\/bundle$/);
      if (method === "GET" && bundleMatch) {
        const requestId = bundleMatch[1];
        const job = jobs.get(requestId);
        if (!job) {
          res.statusCode = 404;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "job not found" }));
          return;
        }
        if (!job.uploadReceived) {
          res.statusCode = 409;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "upload missing" }));
          return;
        }
        res.statusCode = 200;
        res.setHeader("content-type", "application/zip");
        res.end(bundleBytes);
        return;
      }

      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "not found" }));
    });
  });

  const host = args.host || "127.0.0.1";
  const port = typeof args.port === "number" ? args.port : 0;
  await new Promise<void>((resolve) => {
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("mock server failed to bind");
  }
  return {
    baseUrl: `http://${host}:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    getJobs: () => Array.from(jobs.values()),
    getTraffic: () => [...traffic],
  } as MockSkillRunnerServer;
}

export function literatureDigestBundlePath(projectRoot: string) {
  return path.join(
    projectRoot,
    "test",
    "fixtures",
    "literature-digest",
    "run_bundle.zip",
  );
}
