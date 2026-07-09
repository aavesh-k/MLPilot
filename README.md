# AutoML Studio (MLPilot)

Upload a CSV, pick a target column, and get a trained, compared, and explained
machine learning model — automatically. Eliminates the repetitive work of
building ML pipelines by hand.

## Monorepo layout

- `apps/web` — Frontend: Astro 7 shell + React islands, Tailwind CSS v4, shadcn/ui.
- `apps/api` — Backend: FastAPI (Python) ML pipeline API.

## Architecture decisions (locked for V1)

- **Frontend:** Astro as the shell; interactive pipeline UI is React islands.
- **Backend:** FastAPI; artifacts stored on local disk under `apps/api/runs/<run_id>`.
- **Progress:** Server-Sent Events. `POST /api/run` returns `{ run_id }`;
  `GET /api/run/{run_id}/stream` streams each pipeline step + plain-language
  explanation, then a `done` event.
- **Contract:** TypeScript API client is generated from the FastAPI OpenAPI spec
  (`apps/web/src/lib/api`).
- No database in V1. No auth in V1. Local single-machine.

See `PRD.md` for the full product requirements and `CLAUDE.md` for dev conventions.

## Development

### Backend (`apps/api`)

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend (`apps/web`)

```bash
cd apps/web
npm install
npm run dev        # background dev server (per CLAUDE.md); use npm run dev:fg for foreground
```

App: http://localhost:4321  (proxies `/api` → http://localhost:8000)

### Regenerate the TypeScript API client

With the API running:

```bash
cd apps/web && npm run gen:api
```

## Status

- **M0 — Scaffold + API contract + SSE proxy (current).** No ML logic yet; the
  landing page has a demo button that calls the real `/api/run` + SSE endpoint.
- M1+ planned: upload/preview, profiling, preprocessing, training, evaluation,
  explanations/exports, and a full UI/UX design pass.
