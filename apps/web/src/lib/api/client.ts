import type { components } from "./types";

export type RunResponse = components["schemas"]["RunResponse"];
export type DatasetResponse = components["schemas"]["DatasetResponse"];
export type ColumnInfo = components["schemas"]["ColumnInfo"];

// SSE event shapes. The FastAPI SSE endpoint returns `text/event-stream`, which
// OpenAPI does not model as a schema, so these mirror `app/schemas/run.py` until
// a formal SSE schema is added (tracked for M1+).
export type StepEvent = {
  type: "step";
  name: string;
  explanation: string;
  pct: number;
};
export type DoneEvent = { type: "done"; message: string };
export type ErrorEvent = { type: "error"; message: string };
export type PipelineEvent = StepEvent | DoneEvent | ErrorEvent;

const BASE = "/api";

export async function createRun(signal?: AbortSignal): Promise<RunResponse> {
  const res = await fetch(`${BASE}/run`, { method: "POST", signal });
  if (!res.ok) throw new Error(`createRun failed: ${res.status}`);
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

export function streamRun(
  runId: string,
  handlers: {
    onEvent: (event: PipelineEvent) => void;
    onError?: (error: unknown) => void;
  }
): EventSource {
  const es = new EventSource(`${BASE}/run/${runId}/stream`);
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
