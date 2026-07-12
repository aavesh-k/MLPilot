## Development

Monorepo: `apps/web` (Astro + React frontend) and `apps/api` (FastAPI backend).

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

API docs at http://localhost:8001/docs

> Note: port 8000 is occupied on this machine by an unrelated process, so the
> backend and the Astro `/api` proxy both use 8001. Keep them in sync.

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
