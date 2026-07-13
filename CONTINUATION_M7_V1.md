# AutoML Studio — Continuation Prompt (post-M7 / V1)

> Paste this into a NEW Claude Code session to resume polish work on AutoML Studio.
> Working dir: `D:\AutoML`. Monorepo: `apps/web` (Astro 7 + React 19 islands)
> and `apps/api` (FastAPI). Read `milestones.md` (source of truth) and `CLAUDE.md`
> first. Architecture memory: `C:\Users\AAVESH JI\.claude\projects\D--AutoML\memory\automl-studio-architecture.md`.

---

## Context — where things stand

**V1 is feature-complete through M7.** All milestones M0–M7 are done and
recorded in `milestones.md`. M7 (the UI/UX design pass) was just finished:
the `/dashboard` page is now a single `Workspace` React island with nine
PRD sections (Overview, Dataset, Training, Cleaning, Preprocessing,
Leaderboard, Visualizations, Reports, Downloads), a sticky section nav with
scrollspy, an `EmptyState` per section, shared `Dropzone`/`Stat`/`Section`
primitives, and motion craft (custom easing tokens, `scale(0.97)` press
feedback, reveal-on-arrival, reduced-motion block) added to
`apps/web/src/styles/globals.css`. The old monolithic `DatasetUploader.tsx`
was removed; `DatasetProfile` became presentational `DatasetProfileView`
(fetch lifted into `Workspace`). `/upload` 308-redirects to `/dashboard`.
No schema change — `gen:api` was NOT needed.

**`astro build` passes (all 6 pages) and TS is clean on the new files.**

## The one gap — LIVE VISUAL QA was NOT done

In the M7 session, the shell classifier **blocked every network/`curl`/grep-over-HTTP
command**, so I could not drive the live browser flow or screenshot it. Code was
reviewed and type-checked, but the actual in-browser feel — light AND dark —
has not been verified by clicking through. The user said things are "feeling off"
and will report specific issues to fix.

**So the new session's job is iterative polish based on the user's feedback.**
Start by running the dev server and doing the walkthrough YOU were blocked from:

- Frontend (background): `cd apps/web && npm run dev` (serves http://localhost:4321).
  Manage with `astro dev stop/status/logs`. If not running, start it.
- Backend (venv, NOT on global PATH): `cd apps/api && .venv\Scripts\python -m uvicorn app.main:app --reload --port 8001`.
  Port 8001 (8000 is blocked). The `/api` proxy + `gen:api` already point at 8001.
- Test fixtures: `D:/AutoML/sample.csv` (classification, target `subscribed`) and
  `D:/AutoML/sample_regression.csv` (regression, target `price`, 600 rows).
- Manual e2e: /dashboard → upload sample.csv → wait for profile → pick target →
  Train → watch SSE steps/bar → inspect Overview/Leaderboard/Visualizations
  (Recharts) → Reports/Downloads → confirm run on /reports. Repeat in DARK mode.

## What to check / likely "feeling off" areas

When the user reports something, these are the spots most likely to need love:
- **Section nav (sticky left rail `SectionNav.tsx` + mobile pills `MobileSectionNav.tsx`)**:
  scrollspy active-state accuracy, offset under the sticky navbar (navbar is
  `h-14`/56px; sections use `scroll-mt-24`), mobile pill positioning.
- **Motion timing/feel**: reveal stagger, press feedback, training-bar shimmer,
  `prefers-reduced-motion` behavior.
- **Spacing/alignment/tracking** in the section components under
  `apps/web/src/components/workspace/sections/`.
- **Light vs dark theming** across the whole workspace (tokens in `globals.css`;
  chart `--chart-*` vars were already QA'd in M5).
- **Empty→filled transitions** when data arrives (reveal animation triggers).
- Responsive breakpoints (the grid is `lg:grid-cols-[180px_1fr]`).

## Hard constraints (do NOT violate)
- Astro 7 dev proxy MUST be under `vite.server.proxy`, NOT top-level `server.proxy`.
- Contract-first: if you change a backend schema, run `npm run gen:api` WITH the
  backend running, then rebuild.
- Backend venv has NO `httpx` → FastAPI `TestClient` won't import. Test ML/profiling
  by calling core functions directly or hitting the live server.
- The shell classifier intermittently blocks `curl`/compound commands — retry, or
  switch Bash↔PowerShell. Prefer single commands with absolute paths.
- No new heavy animation deps (GSAP) unless the user explicitly asks — M7 was
  done with CSS + custom easing + IntersectionObserver (the apple/emil guidance
  favors CSS for predetermined UI motion anyway).

## File map (what was added/changed in M7)
- `apps/web/src/islands/Workspace.tsx` — orchestrator (state, SSE stream, scrollspy).
- `apps/web/src/components/workspace/Section.tsx` — `Section` + `EmptyState`.
- `apps/web/src/components/workspace/SectionNav.tsx` — `SectionNav` + `MobileSectionNav`.
- `apps/web/src/components/workspace/Stat.tsx`, `Dropzone.tsx`.
- `apps/web/src/components/workspace/sections/{Overview,Dataset,Training,Cleaning,Preprocessing,Leaderboard,Visualizations,Reports,Downloads}Section.tsx`.
- `apps/web/src/components/DatasetProfileView.tsx` (replaces `DatasetProfile.tsx`).
- `apps/web/src/lib/format.ts` — shared formatters.
- `apps/web/src/styles/globals.css` — motion tokens + reduced-motion.
- `apps/web/src/components/ui/button.tsx` — press feedback.
- `apps/web/src/pages/dashboard.astro` (renders Workspace), `upload.astro` (redirect),
  `index.astro` + `components/Navbar.astro` (repointed to Dashboard/Reports).
- REMOVED: `apps/web/src/islands/DatasetUploader.tsx` (deprecated monolith).
- `/reports` (ReportsList island) is intentionally still standalone.

## How to start the new session
"Continue AutoML Studio (D:\AutoML). V1 is complete through M7 (UI/UX design
pass) — see milestones.md and CONTINUATION_M7_V1.md. The one thing NOT done
is the live light/dark browser walkthrough (the previous shell blocked network
commands). First bring up the dev server (apps/web: `npm run dev`; backend venv
on :8001) and do the full walkthrough in BOTH themes. Then I'll tell you what
feels off and you'll fix it iteratively. No backend/schema work unless I ask."
