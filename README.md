# AutoML Studio (MLPilot)

Upload a CSV, pick a target column, and get a trained, compared, and explained
machine learning model — automatically. Eliminates the repetitive work of
building ML pipelines by hand.

## Monorepo layout

- `apps/web` — Frontend: Astro 7 shell + React islands, Tailwind CSS v4, shadcn/ui.
- `apps/api` — Backend: FastAPI (Python) ML pipeline API.

## Architecture decisions (locked for V1)

- **Frontend:** Astro as the shell; interactive pipeline UI is React islands.
- **Backend:** FastAPI; artifacts stored on local disk under `apps/api/runs/<dataset_id>`.
- **Progress:** Server-Sent Events. `POST /api/run` returns `{ run_id }`;
  `GET /api/run/{run_id}/stream` streams each pipeline step + plain-language
  explanation, then a `done` event.
- **Contract:** TypeScript API client is generated from the FastAPI OpenAPI spec
  (`apps/web/src/lib/api`).
- No database in V1. No auth in V1. Local single-machine.
- **Ports:** backend and the Astro `/api` proxy both run on **8001** (port 8000
  is occupied by an unrelated process on this machine).

See `PRD.md` for the full product requirements, `milestones.md` for build
progress (what's done / what's next), and `CLAUDE.md` for dev conventions.

## Development

### Backend (`apps/api`)

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload --port 8001
```

> `uvicorn` is not on the global PATH — activate the venv first, or run it
> directly: `.venv\Scripts\python -m uvicorn app.main:app --reload --port 8001`.

API docs: http://localhost:8001/docs

### Frontend (`apps/web`)

```bash
cd apps/web
npm install
npm run dev        # background dev server (per CLAUDE.md); use npm run dev:fg for foreground
```

App: http://localhost:4321  (proxies `/api` → http://localhost:8001)

### Regenerate the TypeScript API client

With the API running:

```bash
cd apps/web && npm run gen:api
```

## Status

See `milestones.md` for the authoritative, up-to-date breakdown.

- **Done:** M0 scaffold + contract, M1 upload/preview, full training pipeline
  (target detect, train/compare, importances, insights, SSE, downloads), and
  **M2 deep profiling**.
- **Next:** M3 explicit cleaning (dedupe + IQR outlier capping + downloadable
  cleaned CSV).
- **Remaining:** M4 fuller model roster, M5 metrics + visualizations, M6 PDF
  report, M7 UI/UX design pass.
