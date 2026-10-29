# getmydrug — Project Context (for coding prompts)

_Snapshot of repo `postweb21/getmydrug` at commit `7ea22ee` ("Workflow to see the drug prices"), Oct 25 2026. Paste this at the top of any coding prompt so the agent knows the product, the current code, and the conventions to keep._

---

## 1. What this is

**getmydrug** is a patient-facing web app that answers, *before* a prescription is written or filled:

1. **Will my insurance cover this drug, and what does it require first?** (prior authorization, step therapy, quantity limits)
2. **Do I personally meet those requirements?** (a short "Is this for me?" interview scored against the payer's actual criteria)
3. **What will it cost me, and where is it cheapest?** (plan copay vs. cash vs. coupon, **compared across pharmacies** — new in this iteration)

Today patients learn about cost and approval only at the pharmacy counter. getmydrug moves that discovery to the front so patient and prescriber start from the plan's real rules and real prices.

**Context:** built at the Claude Impact Lab hackathon (Seattle, Oct 25 2026) with a clinician partner. It is a **demo**: not medical advice, does not guarantee coverage, not connected to any live payer system. Deployed as a static site (Vercel).

## 2. MVP scope

| Dimension | In scope |
|---|---|
| Condition | Migraine (ICD-10 G43.x) |
| Drugs | **Ubrelvy** (ubrogepant), **Nurtec ODT** (rimegepant), **Qulipta** (atogepant) — the three oral CGRP antagonists ("gepants"). Generic triptans (sumatriptan, rizatriptan) appear as cheap comparators in the React mock. |
| Insurers | **UnitedHealthcare** (all 3 drugs, program 2026 P 2189-15, eff. 2026-06-01), **Cigna** (Nurtec ODT only, policy IP0147, eff. 2026-04-15), plus a **"No insurance / cash"** path. Aetna exists in the React types but has no policy data. No Medicare. |
| Pricing | Plan copay (by tier), cash price, coupon price — **now extended to per-pharmacy comparison via scraped data for each MVP drug.** |

Out of scope: other conditions, renewal-criteria scoring, storing any patient data, live payer/PBM integrations.

## 3. Current repo state — two front ends coexist

The repo currently contains **two independent UIs** that need to converge. Any coding work should be explicit about which one it touches.

### 3a. Original: YAML-driven chat (`getmydrug.html` + `data/`)
- Single-file vanilla HTML/CSS/JS (~840 lines), loads `js-yaml` 4.1.0 and Google Fonts from CDN, `fetch`es YAML at runtime (must be served over HTTP, not `file://`).
- Chat-style flow: pick condition → insurer → drug → shows a **prescription-label style criteria card** (initial authorization + reauthorization) → optional **"Is this for me?"** interview → **checklist** (likely met / not met / confirm) + **copyable note for the prescriber** → links to GoodRx, Cost Plus Drugs, manufacturer support.
- Eligibility engine: `runCheck(type, …)` switch with check types `use, age18, tried_triptans, tried_preventives, prevention_status, no_other_gepant, no_cgrp_mab_or_gepant, episodic_ge4, dx_migraine, qulipta_frequency`. Unknown type → "confirm with your prescriber".
- **Privacy property to preserve:** patient answers live only in a JS variable; no cookies, localStorage, logging, or outbound requests carrying answers.
- This file was `index.html` until today; it was renamed so the Vite app could take `index.html`.

### 3b. New: React "Drug Cost Estimator" (`index.html` → `src/`)
- **Stack:** Vite 8, React 19, TypeScript 6, TanStack Query 5, oxlint. `npm run dev | build | lint | preview`. Package name is still `drug-cost-app`.
- **Flow (3-step form):** `CostEstimatorPage`
  1. `DiagnosisSearch` — debounced ICD-10 search
  2. `PlanPicker` — insurer → coverage type (`employer` | `marketplace`) → formulary (e.g. "Advantage PDL / Optum Rx")
  3. `DrugPicker` — drug (RxNorm `rxcui`) → strength → quantity
  → `useEstimate()` mutation → `CostResult` (coverage badge + details table + **price list with lowest highlighted** + disclaimer).
- **API boundary:** `src/api/client.ts` exports interface `DrugCostApi { searchDiagnoses, listFormularies, listDrugsForDiagnosis, getEstimate }`. Two implementations: `mockApi` (default, backed by `src/api/mockData.ts`) and `httpApi` (used when `VITE_USE_MOCKS=false`; base URL `VITE_API_URL`). HTTP routes expected:
  - `GET /api/diagnoses?q=`
  - `GET /api/formularies?insurer=&coverageType=`
  - `GET /api/drugs?icd10=`
  - `POST /api/estimate` body `EstimateRequest` → `EstimateResponse`
- **Types (`src/types.ts`)** — keep in sync with any backend:
  ```ts
  Insurer = "uhc" | "aetna" | "cigna";  CoverageType = "employer" | "marketplace"
  Diagnosis { icd10, description }
  Formulary { id, insurer, coverageType, name, source }
  Drug { rxcui, name, strengths[], form }
  DrugSelection { rxcui, strength, quantity }
  Coverage { covered, tier?, priorAuth, stepTherapy, stepTherapyNote?, quantityLimit? }
  PriceKind = "plan" | "cash" | "coupon"
  PriceEstimate { kind, amount, label, source, asOf }
  EstimateRequest { diagnosis, plan: PlanSelection, drug: DrugSelection }
  EstimateResponse { drug, strength, quantity, coverage, prices: PriceEstimate[] }
  ```
- Mock data is placeholder only (flat copay by tier $10/$35/$70; per-unit cash prices; coupon = 67% of cash).

### 3c. Data layer (`data/*.yaml`) — the real source of truth for coverage rules
- `directory.yaml` — conditions, insurers (each with `criteria_file`, `rules_file`, `drug_ids`), drugs per condition (name, generic, `plain_use`, `goodrx_url`, `costplus`, `support` link), `pathway_labels`.
- `pa_criteria_<insurer>.yaml` — payer policy in a common shape: `policy` block, `definitions` (triptan/preventive lists), per-drug `initial_authorization` (single criteria list or `pathways` e.g. acute vs preventive) and `reauthorization`, `state_and_plan_notes`, disclaimer. Every criterion has an `id` + `requirement`, optional `options`, `count_required`, `ref:`.
- `eligibility_rules_<insurer>.yaml` — overlay keyed by criterion `id`: `drug_use`, `intake` option lists, `checks: { <id>: { type, label, min… } }`, plus interview shaping (`questions`, `mdays_for`, `cgrp_question_for`, `triptan_trial_question`).
- Adding an insurer/drug = add both YAML files + a `directory.yaml` entry; add a `runCheck` case only if a new rule type is needed.
- YAML was distilled from policy PDFs with AI help and **not clause-by-clause verified**.

### 3d. Housekeeping issues to be aware of
- `readme.md` is **deleted in the working tree** (uncommitted); its content is sitting in `criteria.html` (misnamed — it's markdown, not HTML). Restore as `README.md`.
- `blank.md` is a stub README. `graphify-out/` is an untracked analysis artifact — add to `.gitignore`.
- **ID mismatch between the two UIs:** YAML uses slug ids (`ubrelvy`, `nurtec_odt`, `qulipta`; insurers `uhc`, `cigna`, `none`), React uses RxNorm `rxcui` (`2268236`, `2272552`, …; insurers `uhc`, `aetna`, `cigna`). Qulipta is missing from the React mock; Aetna and non-migraine drugs are missing from YAML. A mapping table (slug ↔ rxcui) is needed.
- `getmydrug.html` has the finished eligibility engine; `src/` has the finished cost/price UI. Neither has both.

## 4. New feature: pharmacy price comparison (web-scraped)

**Goal:** for each MVP drug (and each strength/quantity we support), show the patient a side-by-side of what it costs at different pharmacies — cash and coupon — next to their estimated plan copay, so they can pick the cheapest option.

### Requirements
- Cover the 3 gepants (and ideally the generic triptans as "cheaper alternative" rows) at the strengths/quantities in `DrugPicker`.
- Sources are public pharmacy/price-comparison pages that have to be **scraped** (no paid API for the MVP). Candidates: GoodRx, Mark Cuban Cost Plus Drugs, SingleCare, Amazon Pharmacy, and the big chains (CVS, Walgreens, Walmart, Costco, Kroger/Fred Meyer, Rite Aid) — pick whichever render reliably; the plan copay row comes from the formulary data, not scraping.
- Each price row should carry: `pharmacy`, `kind` (cash/coupon), `amount`, `strength`, `quantity`, `source` (site), `url` (deep link), `asOf`, and optionally `zip`/distance.
- Prices are **cached, not fetched live in the browser** (CORS, bot protection, latency). Scrape on a schedule or on demand server-side, persist, serve to the UI.
- Stale data must be visible: always show `asOf`; degrade gracefully to "last known price" or a link-out if a source fails.
- Respect robots.txt / ToS; rate-limit; don't scrape per user request. Treat scraped numbers as estimates and say so in the UI.

### Proposed design (adjust as needed)
```
scraper/                     Node + Playwright (Chromium) or Python + Playwright
  sources/<site>.ts          one adapter per pharmacy/price site → PriceEstimate[]
  drugs.json                 MVP drug list: slug, rxcui, name, strengths, quantities, per-site URL/search term
  run.ts                     iterates drugs × sources, writes output, logs failures
data/prices/<slug>.json      committed snapshot (works on static Vercel hosting, no backend needed)
   or  GET /api/prices?rxcui=&strength=&quantity=&zip=   if/when a backend exists
```
- Extend `PriceEstimate` with `pharmacy?: string; url?: string; zip?: string`, keep `kind` as `plan|cash|coupon`.
- `getEstimate()` (mock or HTTP) merges plan copay + scraped rows into `prices[]`; `CostResult.PriceBreakdown` becomes a **sortable comparison table** grouped by pharmacy, lowest highlighted, each row linking to its source.
- Optional: a zip-code field in step 2 or 3 to filter pharmacies; default to a Seattle-area zip for the demo.
- Scheduled refresh (GitHub Action cron) re-runs the scraper and commits `data/prices/*.json`.

## 5. Recommended direction for new code
1. **The React app (`src/`) is the shell going forward.** New UI work (price comparison, zip input) goes there.
2. **YAML stays the source of truth for coverage rules.** Port the `getmydrug.html` criteria card + "Is this for me?" engine into React as components (`CriteriaCard`, `EligibilityInterview`, `Checklist`, `PrescriberNote`) that load the same YAML (add `js-yaml` as a dependency) — or serve it via `/api/*` later.
3. Introduce a **drug/insurer id mapping** so one `DrugSelection` can resolve both the YAML slug and the rxcui.
4. Keep `DrugCostApi` as the only seam between UI and data; add `listPrices()` or fold prices into `getEstimate()`.
5. Preserve privacy: interview answers never leave the browser; scraper runs offline and touches no patient data.

## 6. Non-negotiables / conventions
- Always show disclaimers: estimates only; not medical or coverage advice; confirm with insurer/prescriber.
- No PHI persisted anywhere (no analytics, no localStorage of answers).
- Every criterion `id` in a criteria file must have a `checks` entry in its rules file.
- Every price shows `source` + `asOf`.
- TypeScript strict; run `npm run lint` (oxlint) and `tsc -b` before committing.
- Node/React: React 19 function components, TanStack Query for all async data, no extra state library.

## 7. Candidate task list for a coding agent
- [ ] Restore `README.md` from `criteria.html`; delete `blank.md`; gitignore `graphify-out/`.
- [ ] Add Qulipta (atogepant) to `mockData.ts`; add slug↔rxcui mapping module.
- [ ] Build `scraper/` with 2–3 source adapters for the 3 gepants; emit `data/prices/*.json`.
- [ ] Extend `PriceEstimate` + `CostResult` into a pharmacy comparison table.
- [ ] Wire `getEstimate()` to read `data/prices/*.json` (mock mode) so the demo works on static hosting.
- [ ] Port criteria card + eligibility interview from `getmydrug.html` into React.
- [ ] Add GitHub Action to refresh prices nightly.
- [ ] Load Cigna Ubrelvy (IP0148) and Qulipta policies (roadmap).

## 8. Reference
- Repo: https://github.com/postweb21/getmydrug
- Policy sources: UHC Clinical Pharmacy Programs 2026 P 2189-15 (eff. 6/1/2026); Cigna Drug Coverage Policy IP0147 Nurtec ODT (eff. 4/15/2026).
- Earlier pilot finding (from the README): a general-purpose AI with web search finds payer PDFs but omits decisive criteria without saying so; without search it gets rules wrong; cash/coupon price was its weakest area — which is the gap the price-comparison feature targets.
