# Interactive Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `index.html` into a blue, interactive portfolio whose charts are drawn from Heather's own reran analysis results.

**Architecture:** R scripts in `analysis/` run the R code extracted from each project's own R Markdown file (via `knitr::purl`) and write small summary JSON files to `data/`. They assert the published headline numbers before writing. The page loads those JSON files and draws hand-written SVG charts with vanilla ES modules in `js/`. Styles move out of `index.html` into `css/site.css`, with a blue token set.

**Tech Stack:** R 4.6 (caret, gbm, kernlab, pROC, pdp, glmnet, mgcv, earth, gam, rsample, survival, jsonlite, knitr). Plain HTML/CSS/ES modules, no libraries. Node 26 `node --test` for JS unit tests. Headless Chrome and `python3 -m http.server` for page checks.

**Spec:** `docs/superpowers/specs/2026-11-19-interactive-portfolio-design.md`

## Global Constraints

- Static GitHub Pages site, no build step. JSON is loaded with `fetch` and needs a readable fallback if loading fails.
- Never commit patient-level data. `severity.RData` stays at `~/Documents/Columbia Projects/DSII_final/severity.RData`. Cloned source repos live in `analysis/_src/` (gitignored).
- Every number on the site must match her reports. Headline values to assert:
  - COVID test AUCs: decision tree 0.896, logistic 0.911, AdaBoost 0.918, SVM 0.918 (3 dp).
  - PFS lasso RMSE: 0.6842 (earlier test set), 0.8293 (earlier model on the full later cohort), 0.6674 (later test set) (4 dp).
  - BRCA: 334 patients, 317 in the survival analysis.
  - On a mismatch, stop and report. Never adjust.
- Seeds and code come from her Rmds unchanged: COVID 3978, PFS 67, BRCA 123.
- Palette is shades of blue; one non-blue accent only if the dataviz validator fails for blue-only series.
- Must work at 375px wide with no horizontal scroll. Keyboard accessible. Respects `prefers-reduced-motion`. Has a validated dark mode.
- Copy stays sentence case, no all-caps eyebrows, no `→` on links.
- Fonts stay Literata and Public Sans.
- Don't push to `origin` until Heather has reviewed locally. Pushing deploys the live site.

## Review Focus

- **JSON fails to load** (opened via `file://`, network error). Each chart box shows a one-line text fallback with the headline numbers and a link to the GitHub repo, never an empty panel. *(Task 10 test.)*
- **375px phone.** Charts scale to the column, tick labels don't collide, tooltips stay inside the viewport. *(Task 10 test.)*
- **Keyboard only.** Every toggle is a `<button>` with `aria-pressed` (or a `role="tablist"` group). Data marks are focusable and show the same tooltip on focus as on hover. *(Tasks 7–9 tests.)*
- **Reduced motion.** The coefficient toggle and hero line jump straight to their end state. *(Tasks 8 and 10 tests.)*
- **Dark mode.** Charts read colors from CSS custom properties, never hard-coded hex values, so dark mode applies to them. *(Task 5 validator run, Task 10 screenshot.)*

---

### Task 1: R environment and code runner

**Files:**
- Create: `analysis/common.R`, `analysis/README.md`, `tests/test_common.R`, `tests/fixtures/mini.Rmd`
- Modify: `.gitignore` (add `analysis/_src/`)

**Interfaces:**
- Produces:
  - `run_rmd_code(rmd_path: character, workdir: character) -> environment` (purls the Rmd and evaluates it in a fresh env with `workdir` as the working directory, using a null graphics device).
  - `write_summary_json(x: list, path: character) -> invisible(path)` (`jsonlite::write_json`, `auto_unbox = TRUE`, `digits = 6`).
  - `assert_close(actual, expected, dp, label)` (stops with a message naming `label`, actual and expected when `round(actual, dp) != expected`).

- [ ] **Step 1:** Install the missing packages: `Rscript -e 'install.packages(c("gbm","pdp","earth","gam","rsample"), repos="https://cloud.r-project.org")'`. Then check that every package `library()`'d in the three Rmds is installed, and install any others it lists. Expected: all report TRUE.
- [ ] **Step 2:** Clone `heather-lu/covid-severity-prediction`, `breast-cancer-pfs-prediction` and `breast-cancer-outcomes-prediction` into `analysis/_src/`. Copy `severity.RData` into `analysis/_src/covid-severity-prediction/data/`. Add `analysis/_src/` to `.gitignore`.
- [ ] **Step 3:** Write the failing test `tests/test_common.R`:
  - `env <- run_rmd_code("tests/fixtures/mini.Rmd", "tests/fixtures")`; `stopifnot(env$x == 42)`. The fixture has one chunk, `x <- 6 * 7; plot(1)`.
  - `assert_close(0.91149, 0.911, 3, "auc")` passes.
  - `tryCatch(assert_close(0.9, 0.911, 3, "auc"), error = function(e) grepl("auc", conditionMessage(e)))` is TRUE.
- [ ] **Step 4:** Run `Rscript tests/test_common.R`. Expected: error, `run_rmd_code` not found.
- [ ] **Step 5:** Implement `analysis/common.R`. Use `knitr::purl(documentation = 0)` to a tempfile, `withr`-free `setwd` with `on.exit` restore, `pdf(NULL)`, `sys.source(file, envir = env)`.
- [ ] **Step 6:** Run `Rscript tests/test_common.R`. Expected: no error.
- [ ] **Step 7:** Write `analysis/README.md`: how to rerun (clone step, data path, `Rscript analysis/export_*.R`), and the fact that patient data is never committed. Commit `analysis/common.R analysis/README.md tests/ .gitignore`.

### Task 2: COVID export

**Files:**
- Create: `analysis/export_covid.R`, `data/covid.json`

**Interfaces:**
- Consumes: `run_rmd_code`, `write_summary_json`, `assert_close`.
- Produces: `data/covid.json`:
  ```json
  {"n_train":800,"n_test":200,
   "models":[{"id":"glm","label":"Logistic regression","test_auc":0.911,
              "roc":[[fpr,tpr,threshold],...],"cv_auc":[10 numbers],"cv_auc_mean":0.861}, ...],
   "selected":"gbmA",
   "importance":[{"var":"vaccine","label":"Vaccination status","rel_inf":55.0}, ...],
   "pdp":{"vaccine":{"kind":"categorical","label":"Vaccination status","x":["Not vaccinated","Vaccinated"],"y":[0.59,0.15]},
          "SBP":{"kind":"numeric","label":"Systolic blood pressure (mmHg)","x":[...],"y":[...]},
          "bmi":{"kind":"numeric","label":"BMI (kg/m²)","x":[...],"y":[...]}}}
  ```
  Model order and ids: `glm`, `rpart`, `gbmA`, `svmr`. Labels: "Logistic regression", "Decision tree", "AdaBoost", "SVM (radial)".

- [ ] **Step 1:** Write `export_covid.R`. It runs `analysis/_src/covid-severity-prediction/analysis/covid_severity.Rmd` with workdir set to that `analysis/` folder. It then reads:
  - `roc.*` objects: build `roc` from `1 - specificities`, `sensitivities` and `thresholds`, ordered by fpr, and drop non-finite thresholds.
  - `model.*$resample$ROC` for the fold AUCs.
  - `summary(model.gbmA$finalModel, plotit = FALSE)` for relative influence.
  - The three `pdp::partial` calls rerun without `autoplot`.

  Check how `vaccine` is coded in the Rmd before labeling the categorical PDP levels.
- [ ] **Step 2:** Assertions before writing: `assert_close` on the four test AUCs (0.911, 0.896, 0.918, 0.918; 3 dp); `nrow(testing_data) == 200`; the PDP vaccine values round to 0.59 and 0.15 (2 dp), per the README.
- [ ] **Step 3:** Run `Rscript analysis/export_covid.R`. This takes several minutes because of the grid searches. Expected: prints the four AUCs, writes `data/covid.json` under 60 KB. If an assertion fails, stop and report to Heather.
- [ ] **Step 4:** Check that the JSON has no row-level fields: `grep -E '"(id|age|race)"' data/covid.json` returns nothing. Commit.

### Task 3: PFS export

**Files:**
- Create: `analysis/export_pfs.R`, `data/pfs.json`

**Interfaces:**
- Produces: `data/pfs.json`:
  ```json
  {"cohorts":{"earlier":"1990–1995, n = 2,000","later":"2000–2005, n = 2,000"},
   "cv_rmse":{"earlier":[{"id":"lasso","label":"Lasso","mean":0.707,"folds":[10]}, ...6 models],
              "later":[...]},
   "eval":[{"train":"earlier","test":"earlier test set","n":400,"rmse":0.6842,"r2":0.1900},
           {"train":"earlier","test":"full later cohort","n":2000,"rmse":0.8293,"r2":0.1565},
           {"train":"later","test":"later test set","n":400,"rmse":0.6674,"r2":0.1843}],
   "coef":[{"term":"HER21","label":"HER2 positive","earlier":-0.05,"later":0.01}, ...]}
  ```
  Model ids: `ols`, `ridge`, `lasso`, `enet`, `gam`, `mars`. Coefficients exclude the intercept. Keep terms that are nonzero in either fit. Give every term a readable label.

- [ ] **Step 1:** Write `export_pfs.R`. It runs `analysis/_src/breast-cancer-pfs-prediction/dsci_II_midterm.Rmd` with workdir set to the repo root, then reads `resamp`, `resampB` (`$values` columns `*~RMSE`), `lasso_fit`, `lasso_fitB`, `lasso_datB`, `lasso_pred`, `lasso_predB`, `testing_data`, `testing_dataB`, `datB`.
- [ ] **Step 2:** Assertions: the three RMSEs at 4 dp (0.6842, 0.8293, 0.6674). Each `cv_rmse` list has 6 models with 10 folds.
- [ ] **Step 3:** Run it. Expected: prints the three RMSEs, writes `data/pfs.json`. Commit.

### Task 4: Breast cancer outcomes export

**Files:**
- Create: `analysis/export_brca.R`, `data/brca.json`

**Interfaces:**
- Produces: `data/brca.json`:
  ```json
  {"n":334,"n_surv":317,"time_unit":"<from the Rmd>",
   "km":{"overall":{"label":"All patients","p":null,"groups":[KMGroup]},
         "stage":{"label":"Tumour stage","p":0.xx,"groups":[KMGroup,...]},
         "her2":{"label":"HER2 status","p":0.xx,"groups":[KMGroup,...]}},
   "mc_auc":[5 numbers]}
  ```
  `KMGroup` = `{"name":"Stage II","n":120,"steps":[[t,s],...],"censor":[[t,s],...],"at_risk":[[t,n],...]}`. `steps` starts at `[0,1]`. `at_risk` is sampled at 5 evenly spaced times across the follow-up range.

- [ ] **Step 1:** Write `export_brca.R`. It runs `analysis/_src/breast-cancer-outcomes-prediction/final_report.Rmd` with workdir set to the repo root, then reads:
  - `km_overall`, `km_stage` and `km_her2`, via `summary(fit, censored = TRUE)` and `fit$strata`.
  - The p-values from `logrank_stage` and `logrank_her2`, via `pchisq(chisq, df, lower.tail = FALSE)`.
  - The Monte Carlo AUC column. The single full-data ROC curve isn't charted, so it isn't exported.

  Find the time unit in the Rmd's date parsing and record it.
- [ ] **Step 2:** Assertions:
  - `nrow(brca) == 334` (or whatever the Rmd's analysis data frame is named).
  - `nrow(brca_surv) == 317`.
  - Survival is non-increasing within every group.
  - The 5 MC AUCs are in [0, 1].
- [ ] **Step 3:** Run it. Expected: prints n, n_surv, both log-rank p-values. Commit.

### Task 5: Blue palette and stylesheet

**Files:**
- Create: `css/site.css`
- Modify: `index.html` (replace the inline `<style>` with `<link rel="stylesheet" href="css/site.css">`)

**Interfaces:**
- Produces CSS custom properties used by all charts:
  - Text and surfaces: `--ink`, `--ink-2`, `--muted`, `--paper`, `--panel`, `--rule`, `--link`, `--focus`.
  - Series: `--s1`, `--s2`, `--s3`, `--s4` (the four ROC models; `--s3` = AdaBoost, the strongest).
  - Emphasis: `--hi` (the emphasized mark), `--quiet` (de-emphasized marks).
  - Same names under both dark-mode selectors.

- [ ] **Step 1:** Pick blue steps:
  - Ink: navy, around `#0F2440`.
  - Link: cobalt, around `#1F5FBF`.
  - Panel: ice blue, around `#EEF4FB`.
  - Series: four blues spread across lightness.

  Run the dataviz validator for `--s1..--s4` in light mode (surface = `--panel`) and dark mode. Expected: PASS. If the normal-vision floor fails for four blues, replace `--s1` (decision tree) with the single allowed non-blue accent and re-run.
- [ ] **Step 2:** Move all CSS from `index.html` into `css/site.css`, swapping old tokens for the new ones (marigold `--mark` → `--hi`). Hero KM curve uses `--link`.
- [ ] **Step 3:** Screenshot desktop light, desktop dark (`--force-dark-mode`) and the 375px iframe (the method from the first redesign). Expected: the page looks the same as before apart from the colors. No marigold left: `grep -i 'D9922E\|E8A84A' -r css index.html` is empty. Commit.

### Task 6: Chart toolkit

**Files:**
- Create: `js/chartkit.js`, `tests/chartkit.test.mjs`

**Interfaces:**
- Produces (named ES exports):
  - `scaleLinear([d0, d1], [r0, r1]) -> fn` (with `.invert`).
  - `ticks(d0, d1, count) -> number[]` (nice 1/2/5 steps).
  - `linePath(points, x, y) -> string`.
  - `stepPath(points, x, y) -> string` (post-step, for KM and ROC).
  - `svg(tag, attrs, children?) -> SVGElement`.
  - `tooltip(container) -> {show(html, clientX, clientY), hide()}` (clamped inside the viewport).
  - `dataTable(caption, headers, rows) -> HTMLTableElement` (visually hidden).
  - `toggleGroup(container, items: {id,label,pressed}[], onChange(ids: string[])) -> void` (buttons with `aria-pressed`).
  - `tabGroup(container, items: {id,label}[], onSelect(id)) -> void` (`role="tablist"`, arrow keys move focus).
  - `prefersReducedMotion() -> boolean`.
  - `cssVar(name) -> string`.

- [ ] **Step 1:** Write failing tests:
  - `scaleLinear([0,1],[0,100])(0.25) === 25` and `.invert(25) === 0.25`.
  - `ticks(0.88, 0.93, 5)` deep-equals `[0.88,0.89,0.9,0.91,0.92,0.93]` (within 1e-9).
  - `stepPath([[0,1],[2,0.8],[5,0.6]], x=id, y=id) === "M0,1H2V0.8H5V0.6"`.
  - `linePath([[0,0],[1,1]], id, id) === "M0,0L1,1"`.
  - Tooltip clamp: pure helper `clampToViewport(x, y, w, h, vw, vh, pad=8)`; `clampToViewport(370, 10, 120, 40, 375, 800)` returns x ≤ 375 − 120 − 8.
- [ ] **Step 2:** Run `node --test tests/`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `js/chartkit.js`. DOM helpers are not unit-tested here; they're covered in Tasks 7–10.
- [ ] **Step 4:** Run `node --test tests/`. Expected: all pass. Commit.

### Task 7: COVID charts

**Files:**
- Create: `js/charts-covid.js`
- Modify: `index.html` (COVID project section → chart grid with 4 mounts: `#covid-roc`, `#covid-cv`, `#covid-imp`, `#covid-pdp`)

**Interfaces:**
- Consumes: `data/covid.json` schema (Task 2); chartkit exports (Task 6).
- Produces: `renderCovid(data, mounts: {roc, cv, imp, pdp}) -> void`.

- [ ] **Step 1:** **ROC.** Square plot with a diagonal reference line. One `stepPath` per model, colored `--s1..--s4`, with a different dash per model. Direct labels show name and AUC. A `toggleGroup` above it, all pressed by default. Hovering or focusing shows a crosshair snapped to the nearest point of the visible curves, with model, threshold, sensitivity and specificity. Caption: "Held-out test set, n = 200."
- [ ] **Step 2:** **CV folds.** A strip per model with 10 fold dots and a mean tick. AdaBoost row uses `--hi`. Caption notes AdaBoost was selected on mean CV AUC.
- [ ] **Step 3:** **Importance.** Horizontal bars for relative influence, sorted, starting at 0. Top 3 use `--hi`, the rest `--quiet`. Direct value labels.
- [ ] **Step 4:** **PDP.** A `tabGroup` for vaccine, SBP and BMI. Numeric predictors get a line plus a light band below; vaccine gets two dots with values. The y axis is "Predicted probability of severe illness" and stays fixed at 0–1 across tabs, so switching tabs compares honestly.
- [ ] **Step 5:** Each chart appends a `dataTable`, and data marks have `tabindex="0"`.
- [ ] **Step 6:** Serve with `python3 -m http.server 8000` and check with headless Chrome `--dump-dom http://localhost:8000/`. Expected:
  - `#covid-roc` contains 4 `path.curve` elements.
  - After the test clicks the logistic toggle (scripted with a `?test=covid` hook that toggles the first model off), 3 are visible and that button has `aria-pressed="false"`.
  - No console errors (`--enable-logging=stderr --v=0`, grep for "Uncaught").
- [ ] **Step 7:** Screenshot desktop and 375px, and look at them. Commit.

### Task 8: PFS charts

**Files:**
- Create: `js/charts-pfs.js`
- Modify: `index.html` (PFS section mounts: `#pfs-cv`, `#pfs-coef`, `#pfs-eval`)

**Interfaces:**
- Produces: `renderPfs(data, mounts: {cv, coef, eval}) -> void`.

- [ ] **Step 1:** **CV RMSE.** Six model rows with fold dots and mean ticks, earlier cohort, lasso marked as selected. The caption repeats that differences are small and lasso was chosen for interpretability.
- [ ] **Step 2:** **Coefficients** (the signature interaction). A dot plot of lasso coefficients with a zero line, sorted by the earlier-cohort value. A two-button toggle switches between "Earlier cohort (1990–1995)" and "Later cohort (2000–2005)".
  - Switching animates each dot's x position over 600 ms (CSS transition on `transform`), with a faint ghost dot left at the other cohort's value.
  - HER2, hormonal therapy and lymph nodes get `--hi`.
  - With reduced motion there is no transition.
  - Terms are listed in the same order in both states.
- [ ] **Step 3:** **Eval bars.** Port the existing RMSE bar chart to read from `data.eval`.
- [ ] **Step 4:** Check with the headless test hook `?test=pfs`: toggle to "later"; the HER2 dot's `transform` changes sign side of the zero line (earlier negative, later ≥ 0, per README). Reduced-motion check: with `--force-prefers-reduced-motion`, the computed `transition-duration` on `.coef-dot` is `0s`.
- [ ] **Step 5:** Screenshot both cohort states, desktop and 375px. Commit.

### Task 9: Breast cancer outcomes charts

**Files:**
- Create: `js/charts-brca.js`
- Modify: `index.html` (outcomes section becomes a lead project with mounts `#brca-km`, `#brca-auc`)

**Interfaces:**
- Produces: `renderBrca(data, mounts: {km, auc}) -> void`.

- [ ] **Step 1:** **KM plot.**
  - A `tabGroup` for overall, stage and HER2.
  - Each group gets a `stepPath` in `--s1..` order, with censor tick marks and direct end labels.
  - A number-at-risk table below the axis, aligned to the `at_risk` times.
  - Log-rank p in the corner, formatted `p = 0.xx` (or `p < 0.001`).
  - The y axis stays fixed at 0–1.
  - Hover shows the group, time and survival.
- [ ] **Step 2:** **MC AUC strip.** 5 dots plus the mean, with a 0.5 reference line labelled "chance".
- [ ] **Step 3:** Update the project text to mention the log-rank results using the exported p-values. Keep the existing "limited evidence" framing.
- [ ] **Step 4:** Headless check `?test=brca`: the stage tab renders as many `path.curve` elements as stage groups in the JSON, and the HER2 tab replaces them. Arrow-right on the tablist moves `aria-selected`. Commit.

### Task 10: Page integration and checks

**Files:**
- Create: `js/main.js`, `tests/check-page.sh`
- Modify: `index.html`, `css/site.css`

**Interfaces:**
- Consumes: `renderCovid`, `renderPfs`, `renderBrca`.
- Produces: `main.js` loads the three JSON files with `fetch` in parallel. Each project renders independently, so one failure doesn't block the others.

- [ ] **Step 1:** **Fallback.** On a failed fetch, each mount shows `<p class="chart-fallback">` with the headline numbers (hard-coded from Global Constraints) and the GitHub link. Test: `tests/check-page.sh` opens `file://…/index.html`, where fetch fails, and asserts 3+ `.chart-fallback` elements and no empty `figure.chart`.
- [ ] **Step 2:** **Layout.**
  - Lead projects use a 2-column chart grid at ≥ 820px and stack below that.
  - The "Selected projects" intro mentions that the charts are interactive and come from rerunning each analysis.
  - The hero KM line switches to blue and is static under reduced motion.
- [ ] **Step 3:** **`tests/check-page.sh`.**
  - Start `python3 -m http.server` on a free port.
  - Dump the DOM of `/` and `/?test=covid|pfs|brca` and assert the counts from Tasks 7–9.
  - Assert that `document.documentElement.scrollWidth <= 375` inside a 375px iframe wrapper.
  - Grep stderr for "Uncaught".
  - Expected: prints `ALL CHECKS PASSED`.
- [ ] **Step 4:** Screenshot desktop light, desktop dark and 375px, and look at all three for label collisions, overflow and contrast. Fix anything found.
- [ ] **Step 5:** Run `node --test tests/ && Rscript tests/test_common.R && bash tests/check-page.sh`. All pass. Commit.
- [ ] **Step 6:** Hand to Heather to review locally (`python3 -m http.server`, open `http://localhost:8000`). Push to `origin main` only after she approves.
