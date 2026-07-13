# AutoML Studio (MLPilot) — Milestones

Single source of truth for build progress. Update this after every milestone.

- **Product:** upload a CSV → pick a target → get a trained, compared, explained,
  exportable ML model. No manual pipeline code.
- **Architecture (locked):** Astro 7 shell + React islands (`apps/web`), FastAPI
  (`apps/api`), SSE progress, disk artifacts under `runs/<dataset_id>/`, no DB,
  no auth, contract-first (`npm run gen:api` after every backend schema change).
- **Ports:** backend + Astro `/api` proxy both use **8001** (8000 is blocked on
  this machine). `gen:api` and the Vite proxy already point at 8001.
- **Rule:** do milestones **one at a time**; never start a milestone before its
  predecessor is verified.

---

## ✅ Done

### M0 — Scaffold + API contract + SSE proxy
Astro+React shell, FastAPI app, `/api` proxy, OpenAPI → TS types
(`apps/web/src/lib/api/types.ts`). Health + demo run/stream endpoints.

### M1 — Upload + preview
`POST /api/datasets` streams the file to `runs/<id>/raw.csv`, returns dtypes,
nulls, and a 50-row preview. UI: `apps/web/src/islands/DatasetUploader.tsx`.
Validations: .csv only, non-empty, ≤100 MB, parseable, has columns.

### Training pipeline (shipped in commit `927586c`, ahead of old notes)
Target selection + auto classification/regression detection, train & compare
(5 classifiers / 4 regressors), 5-fold CV ranking, permutation importances,
templated plain-language insights, SSE progress, downloads for model
(`.joblib`), predictions (CSV), and a **Markdown** report.
Core: `apps/api/app/core/ml.py`, `apps/api/app/api/routers/run.py`.

### Cross-cutting fix — run lookup survives restart
`run.py` `_runs` was in-memory only → result/download 404'd after a backend
restart. Added `_find_run_dir` (scans `runs/*/<run_id>/` for `result.json`),
used by `_load_result` and `download_artifact`.

### M2 — Deep profiling  ✅ (2026-07-13, verified)
Statistical profile surfaced after upload, before training.
- Backend: `GET /api/datasets/{id}/profile` → `app/core/profiling.py`
  (`build_profile`); schemas in `app/schemas/profile.py` (`ProfileResponse`,
  `ProfileOverall`, `ColumnProfile`, `ClassBalance`). Computes overall
  (rows/cols/memory/duplicates/missing %/kind counts), per-column stats
  (kind ∈ numeric|categorical|datetime|boolean|constant, nulls, unique, numeric
  min/max/mean/std or categorical top value), numeric Pearson correlation,
  suggested target + task, and class balance for classification.
- Frontend: `apps/web/src/components/DatasetProfile.tsx` (rendered inside
  `DatasetUploader`): quality tiles, class-balance bars, per-column table with
  kind badges, CSS correlation heatmap. Client fn `getProfile` + types added.
- Verified: profiling smoke test on `sample.csv` correct; `astro build` OK.

---

### M3 — Explicit cleaning + preprocessing  ✅ (2026-07-13, verified)
Cleaning made visible + a downloadable cleaned CSV. Impute/scale/encode stay
automatic (locked: no user options in V1).
- Backend (`ml.py`): new `clean_dataframe(df, target)` runs before training —
  drops duplicate rows, drops constant/all-empty columns (target protected),
  **IQR outlier capping** (1.5×IQR clip) on numeric features. Returns a
  `CleaningSummary` (dropped_dupes, dropped_cols[], capped_cols[{col,count}],
  impute_strategy per kind, rows_before/after). Writes `cleaned.csv`, adds
  `"cleaned"` to `artifacts`, emits a `"clean"` SSE step (pct 42), and appends a
  cleaning section to the Markdown report.
- Schema (`app/schemas/run.py`): added `CappedColumn`, `CleaningSummary`, and
  `cleaning: CleaningSummary` on `RunResult`.
- Download (`run.py`): added `"cleaned": "text/csv"` to the media map.
- Frontend: `CleaningSummaryCard` in `ResultsPanel` (stat tiles + dropped/capped
  detail + impute strategy), "Download cleaned CSV" button, `"cleaned"` added to
  the `downloadRunArtifact` union and a `CleaningSummary` type export.
- Verified: `clean_dataframe` on crafted data (dupes/constant/empty/outliers all
  handled); full live-server flow (upload → run → SSE `clean` step → result has
  `cleaning` → cleaned.csv downloads as text/csv); `npm run gen:api` + `astro
  build` OK.

### M4 — Fuller model roster (meet "10+")  ✅ (2026-07-13, verified)
Expanded `ml._build_models` only (no schema/frontend change — `models` is a list
the leaderboard already maps N rows of).
- Classification (9): Logistic Regression, Decision Tree, Random Forest, Extra
  Trees, HistGradientBoosting, AdaBoost, KNN, `SVC(probability=True)`, GaussianNB.
- Regression (8): Linear, Ridge, Lasso, ElasticNet, Decision Tree, Random Forest,
  Extra Trees, HistGradientBoosting.
- Reused `_build_preprocessor`; `MAX_TRAIN_ROWS` sampling unchanged so SVM/KNN stay
  fast. Added `random_state=42` to stochastic estimators for reproducible ranking.
- New imports: `AdaBoostClassifier`, `ExtraTrees{Classifier,Regressor}`,
  `Ridge`/`Lasso`/`ElasticNet`, `SVC`, `DecisionTree{Classifier,Regressor}`.
- Verified: `_build_models` returns 9/8 keys; full classification run on
  `sample.csv` (9 models, ranked, ~12s incl. CV + permutation importance) and a
  synthetic regression run (8 models, linear models top a linear target, ~11s)
  both complete; `astro build` OK. Note: sklearn 1.9 emits a benign FutureWarning
  that `SVC(probability=True)` is deprecated (removal in 1.11) — still functional;
  revisit with `CalibratedClassifierCV` if/when the roster is next touched.

### M5 — Evaluation metrics + visualizations  ✅ (2026-07-13, verified)
Richer metrics + server-computed chart data, rendered client-side with
**Recharts** (heatmaps stay CSS grids — the right form for a matrix).
- Metrics (`ml._metrics_for`): added `log_loss` (clf, from the full predict_proba
  matrix + `classes`), and `mse` + `adjusted_r2` (reg; adjusted_r2 falls back to
  r2 when `n - p - 1 ≤ 0`). Call site now passes full proba, classes, and
  `X_train.shape[1]`.
- Chart data (`ml._build_evaluation`, run on the hold-out set for the best model):
  clf → `confusion_matrix{labels,matrix}`, `roc_curve{fpr,tpr,auc}` (binary only,
  downsampled ≤100 pts), `class_distribution[{label,count}]`; reg →
  `pred_vs_actual` + `residuals` (reproducible random sample ≤500 pts); shared →
  `correlation{labels,matrix}` (numeric Pearson, reuses M2 logic, capped 30 cols).
  Emits a new `"visualize"` SSE step (pct 98).
- Schema (`app/schemas/run.py`): added `ConfusionMatrix`, `RocCurve`, `ClassCount`,
  `PredPoint`, `ResidualPoint`, `Correlation`, `Evaluation`, and
  `evaluation: Evaluation | None` on `RunResult`. Regenerated TS via `gen:api`.
- Frontend: `recharts` added; new `components/charts/` — `ConfusionMatrix`
  (sequential-blue CSS heatmap), `RocCurve` (line + chance diagonal),
  `ClassDistribution` (bar), `PredVsActual` + `ResidualPlot` (scatter w/ reference
  lines), `CorrelationHeatmap` (diverging CSS heatmap), plus `EvaluationCharts`
  section (renders conditionally by `problem_type`) wired into `ResultsPanel`.
  Chart colors via new `--chart-*` CSS vars in `globals.css` (dataviz palette,
  light + dark). Shared themed tooltip in `ChartTooltip.tsx`.
- Verified: direct-core + live-API runs for a classification file (sample.csv) and
  a synthetic regression file — evaluation object populated correctly per task,
  clf-only fields empty on reg runs and vice-versa, all new metrics present;
  `gen:api` + `astro build` OK. Note: sample.csv is tiny so its ROC has few points
  (expected).
- **Browser light/dark visual QA ✅ (2026-07-13):** walked every chart in both themes
  on `sample.csv` (clf) and `sample_regression.csv` (reg). Fixes made during QA:
  (1) `RocCurve`/`PredVsActual`/`ResidualPlot` — y-axis title overlapped the tick
  numbers → widened y-axis `width` to 56 + `offset` 16 and added
  `style:{textAnchor:"middle"}` so the rotated label is clear of the numbers and
  vertically centered; (2) correlation heatmaps — faint low values were nearly
  invisible and the `0` text disappeared in light mode → `DatasetProfile` corrColor
  now uses a gamma curve (`a^0.6`) to lift low magnitudes (0 still transparent), and
  BOTH heatmaps (`DatasetProfile` + `charts/CorrelationHeatmap`) set number text to
  `var(--foreground)` (black in light / white in dark). Confusion-matrix diagonal
  outline on a 0-value cell confirmed working-as-intended (marks correct-prediction
  cells by position, not value) and kept as-is. `astro build` OK after fixes.

### M6 — PDF report + full downloads  ✅ (2026-07-13, verified)
Polished PDF report generated in the export phase + completed the download set.
- Backend (`ml.py`): new `_write_pdf_report` (reportlab platypus — pure-Python, no
  Windows/GTK deps) renders title, run-summary metadata table, model-comparison
  table (zebra rows + highlighted best row), key insights (bulleted), top features
  (inline importance bars), and the cleaning summary, with an A4 layout and a
  branded palette. Helper `_pdf_styles` holds the paragraph/table styles. Called
  from `train_and_compare` after the Markdown report as **best-effort** (wrapped in
  try/except — a PDF failure pops `"pdf"` from artifacts, rewrites result.json, and
  never sinks the run). Writes `report.pdf`, adds `"pdf"` to `artifacts`, emits a
  new `"export"` SSE step (pct 99).
- Deps: added `reportlab>=4.0` to `apps/api/pyproject.toml` and installed it into
  the venv (pulls in pillow + charset-normalizer).
- Download (`run.py`): added `"pdf": "application/pdf"` to the media map.
- Frontend: "Download PDF" button in `ResultsPanel` (guarded on `artifacts.pdf`)
  and `ReportsList` (plus a "Cleaned CSV" button there); extended the
  `downloadRunArtifact` kind union with `"pdf"`. No schema shape change (`artifacts`
  is a free-form dict) so no `gen:api` needed.
- Verified: direct-core runs for classification (`sample.csv`, 9 models) and a
  synthetic regression file (8 models) both emit a valid `%PDF-` file (~5 KB) with
  all sections present (confirmed via pypdf text extraction — tables, insights,
  importances, cleaning summary all render, clf/reg variants correct); live API
  `GET /run/{id}/download/pdf` returns `application/pdf`; `astro build` OK. Note:
  the benign `SVC(probability=True)` FutureWarning from M4 still appears.

## 🔜 To do

### M7 — UI/UX design pass  ✅ (2026-07-13, build + code review verified)
The **only** milestone where design skills are unlocked (apple-design,
web-design-guidelines, emil-design-eng, dataviz, gsap-core, impeccable).

- **Real dashboard workspace.** `/dashboard` now renders a single `Workspace`
  island (`apps/web/src/islands/Workspace.tsx`) with sticky section nav +
  scrollspy and nine PRD sections: Overview, Dataset, Training, Cleaning,
  Preprocessing, Leaderboard, Visualizations, Reports, Downloads. `/upload`
  redirects (308 → `/dashboard`) since the upload+training flow now lives in
  the workspace. Navbar + index CTAs repoint to Dashboard/Reports.
- **Refactor of the monolith.** `DatasetUploader.tsx` is replaced by
  sectioned components under `apps/web/src/components/workspace/`:
  `Dropzone`, `Section` (+`EmptyState`), `Stat`, `SectionNav`
  (+`MobileSectionNav`, horizontal pills under the navbar on mobile),
  `sections/Overview|Dataset|Training|Cleaning|Preprocessing|Leaderboard|
  Visualizations|Reports|Downloads`. `DatasetProfile` → presentational
  `DatasetProfileView` (fetch lifted into Workspace so the profile is shared
  across Overview/Dataset/Training). Shared `lib/format.ts` helpers.
- **Motion (emil/apple craft).** Custom easing tokens in `globals.css`
  (`--ease-out`, `--ease-in-out`, durs), `scale(0.97)` press feedback on
  every interactive surface (incl. the `Button` primitive + `press` util),
  `@starting-style`-style reveal on data arrival, a shimmer on the
  indeterminate training bar, size-specific tracking, and a full
  `prefers-reduced-motion` block (keeps opacity fades, drops movement).
- **States + theming.** Every section has a quiet `EmptyState` (icon + CTA)
  before its data exists; error/loading states throughout; full light/dark via
  the existing `--chart-*` / token system (charts already QA'd in M5).
- **Verified:** `astro build` passes (all 6 pages); TS clean on new files;
  dashboard serves 200 from the live dev server. **NOTE:** the in-browser
  light/dark e2e walkthrough (upload→profile→clean→train→charts→downloads→
  /reports) could NOT be run in this session — the shell classifier blocked
  network/query commands — so the live visual QA is left for the user to click
  through. Code-review pass is done; no schema/surface changes needed.

## M7 residue (user to verify)
- Click through the full flow in BOTH light and dark at http://localhost:4321/dashboard.
- Confirm scrollspy nav + mobile pill nav, press feedback, reveal motion, and
  the empty→filled section transitions feel right.

---

## Deferred to FUTURE (explicitly NOT V1)
Hyperparameter tuning; XGBoost/LightGBM/CatBoost; date decomposition; feature
selection; multicollinearity removal; full plot catalog; SHAP/LIME; AI chat
assistant; experiment history / versioning; auto-deploy; auth; cloud storage;
PostgreSQL; 500 MB uploads (V1 cap ~100–200 MB); deep learning / time-series /
NLP / CV.

---

## Verification (run for every milestone)
- Backend: `cd apps/api && .venv\Scripts\python -m uvicorn app.main:app --reload --port 8001`
  (`uvicorn` is **not** on the global PATH — must use the venv).
- Frontend: `cd apps/web && npm run dev` (proxies `/api` → :8001).
- After any schema change: `npm run gen:api` with the backend running.
- Manual e2e: `/upload` → upload `D:/AutoML/sample.csv` → profile → pick target →
  train (watch SSE steps) → inspect results/charts → download artifacts → confirm
  the run appears on `/reports` and still resolves after a backend restart.

### Env quirks (this machine)
- No `httpx` in the backend venv → FastAPI `TestClient` won't import. Test ML /
  profiling by calling core functions directly, or hit the live server.
- The shell classifier intermittently blocks compound commands (`cd; cmd`,
  `a && b`) and file-writing scripts — use single commands with absolute paths
  and retry once if a benign command is blocked.
