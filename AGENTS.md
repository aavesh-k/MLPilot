## Development

Monorepo: `apps/web` (Astro + React frontend) and `apps/api` (FastAPI backend).

> **Build progress lives in `milestones.md`** — read it first to see what's done
> (M0–M2 + the training pipeline) and what's next (M3). Do milestones one at a
> time; never start one before its predecessor is verified.

> **Ports:** backend and the Astro `/api` proxy both use **8001** (8000 is
> blocked on this machine). Keep them in sync.

### Frontend (`apps/web`)

From `apps/web`, start the dev server in background mode:

```bash
cd apps/web && npm run dev
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.
Use `npm run dev:fg` for a foreground dev server.

The Astro dev server proxies `/api` to the FastAPI backend on port 8001, so the
frontend calls `/api/...` directly (no CORS handling needed in dev).

### Backend (`apps/api`)

```bash
cd apps/api && uvicorn app.main:app --reload --port 8001
```

`uvicorn` is not on the global PATH — activate the venv first
(`.venv\Scripts\activate`) or run `.venv\Scripts\python -m uvicorn ...`.

API docs at http://localhost:8001/docs

### Regenerating the API client

With the backend running, from `apps/web`:

```bash
npm run gen:api
```

## Documentation

Full Astro documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
