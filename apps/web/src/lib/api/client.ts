import type { components } from "./types";

export type RunResponse = components["schemas"]["RunResponse"];
export type DatasetResponse = components["schemas"]["DatasetResponse"];
export type ColumnInfo = components["schemas"]["ColumnInfo"];
export type RunResult = components["schemas"]["RunResult"];
export type ModelResult = components["schemas"]["ModelResult"];
export type CleaningSummary = components["schemas"]["CleaningSummary"];
export type Evaluation = components["schemas"]["Evaluation"];
export type ConfusionMatrix = components["schemas"]["ConfusionMatrix"];
export type RocCurve = components["schemas"]["RocCurve"];
export type ClassCount = components["schemas"]["ClassCount"];
export type PredPoint = components["schemas"]["PredPoint"];
export type ResidualPoint = components["schemas"]["ResidualPoint"];
export type Correlation = components["schemas"]["Correlation"];
export type ProfileResponse = components["schemas"]["ProfileResponse"];
export type ColumnProfile = components["schemas"]["ColumnProfile"];
export type ClassBalance = components["schemas"]["ClassBalance"];

// SSE event shapes. The FastAPI SSE endpoint returns `text/event-stream`, which
// OpenAPI does not model as a schema, so these mirror `app/schemas/run.py`.
export type StepEvent = {
  type: "step";
  name: string;
  explanation: string;
  pct: number;
};
export type ResultEvent = { type: "result"; result: RunResult };
export type DoneEvent = { type: "done"; message: string };
export type ErrorEvent = { type: "error"; message: string };
export type PipelineEvent = StepEvent | ResultEvent | DoneEvent | ErrorEvent;

const BASE = "/api";

export async function createRun(
  datasetId: string,
  target: string,
  signal?: AbortSignal
): Promise<RunResponse> {
  const res = await fetch(`${BASE}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId, target }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `createRun failed: ${res.status}`);
  }
  return res.json() as Promise<RunResponse>;
}

export async function uploadDataset(
  file: File,
  signal?: AbortSignal
): Promise<DatasetResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/datasets`, { method: "POST", body: form, signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `upload failed: ${res.status}`);
  }
  return res.json() as Promise<DatasetResponse>;
}

export async function getProfile(
  datasetId: string,
  signal?: AbortSignal
): Promise<ProfileResponse> {
  const res = await fetch(`${BASE}/datasets/${encodeURIComponent(datasetId)}/profile`, {
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `getProfile failed: ${res.status}`);
  }
  return res.json() as Promise<ProfileResponse>;
}

export function streamRun(
  runId: string,
  handlers: {
    onEvent: (event: PipelineEvent) => void;
    onError?: (error: unknown) => void;
  }
): EventSource {
  const es = new EventSource(`${BASE}/runs/${runId}/stream`);
  es.onmessage = (msg) => {
    try {
      handlers.onEvent(JSON.parse(msg.data) as PipelineEvent);
    } catch (err) {
      handlers.onError?.(err);
    }
  };
  es.onerror = (err) => handlers.onError?.(err);
  return es;
}

export function downloadRunArtifact(
  runId: string,
  kind: "model" | "predictions" | "report" | "cleaned" | "pdf"
): string {
  return `${BASE}/runs/${encodeURIComponent(runId)}/download/${kind}`;
}
