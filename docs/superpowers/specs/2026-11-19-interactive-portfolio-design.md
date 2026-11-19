# Interactive portfolio redesign: design

Date: 2026-11-19

## Intent

Heather finds the current single-page portfolio (`index.html`) visually thin. She wants it to show more real model results and more technical depth, to be more interactive, and to use different shades of blue. The audience is people judging her as a statistician (PIs, PhD committees, technical hiring managers), so the visuals must be her actual results, not decoration.

## Goals

- Each featured project shows several interactive charts drawn from her real analysis outputs.
- A blue palette (several shades) replaces the plum/teal/marigold one, in light and dark mode.
- Visitors can explore results by toggling models, cohorts, predictors and strata.
- The site stays one static page on GitHub Pages, with no build step.

## Non-goals

- No per-project deep-dive pages (possible later).
- No new analyses or changed results. Rerunning her code is only to export numbers it already produces.
- No CMS, framework or bundler.

## Anti-goals (failure even if it works)

- Any number on the site that disagrees with her reports or READMEs.
- Patient-level data published. The COVID dataset is not public, so only aggregates go on the site.
- Charts that look like generic dashboard widgets or slow the page noticeably.
- Losing the content and accessibility of the current page: text, links, keyboard focus, reduced motion, phone layout.

## Approaches considered

1. **Embed existing PNG figures from the repos.** Quick and exact, but static, and default R styling clashes with a blue site.
2. **Rerun the analyses once and draw interactive charts from exported summaries.** *(Chosen: Heather left the pick to Claude.)* Real numbers, matching style, real interactivity, all on one page.
3. **Option 2 plus a page per project.** The most thorough, but the most to build and maintain. Deferred.

## How it works

### Data export (one-time, in R)

One R script per project, kept in the site repo under `analysis/`, reproduces the analysis from her code with the same seeds and writes a small JSON file to `data/`. Sources:

| Project | Source code | Data | Seed |
|---|---|---|---|
| COVID severity | `covid-severity-prediction/analysis/covid_severity.Rmd` | `~/Documents/Columbia Projects/DSII_final/severity.RData` (local, not committed) | 3978 |
| Breast cancer PFS | `breast-cancer-pfs-prediction/dsci_II_midterm.Rmd` | `datA.RData`, `datB.RData` in that repo | 67 |
| Breast cancer outcomes | `breast-cancer-outcomes-prediction/final_report.Rmd` | `BRCA.csv` (public) | 123 |

Exported summaries:

- **COVID:** test-set ROC curves for all four models (thresholded, at most ~200 points each), test AUCs, cross-validated AUC for each fold and model, AdaBoost relative influence, partial dependence curves for vaccine, SBP and BMI.
- **PFS:** cross-validated RMSE by model (OLS, ridge, lasso, elastic net, GAM, MARS), lasso coefficients from the earlier-cohort and later-cohort fits, the three evaluation RMSEs.
- **Outcomes:** Kaplan–Meier step coordinates (time, survival, censor marks, number at risk) overall, by tumour stage and by HER2 status, plus log-rank p-values. Also the ROC curve and the five Monte Carlo AUCs.

**Verification gate:** each export prints the headline numbers. They must match the published figures (COVID test AUCs 0.896/0.911/0.918/0.918; PFS RMSE 0.6842/0.8293/0.6674) before any chart uses them. If a rerun doesn't reproduce a published number, stop and report it. Never adjust the numbers to fit.

### Charts (in the page)

Hand-written SVG with vanilla JS. No library; the dataset is tiny. All charts are built from the JSON files.

- **COVID:**
  - ROC plot: toggle buttons to show or hide each model, a hover crosshair showing sensitivity and specificity at each threshold.
  - Variable-importance bars.
  - Partial dependence plot: tabs for vaccine, SBP and BMI.
  - The existing AUC dot plot becomes a CV-fold strip: 10 fold AUCs per model, with the mean marked.
- **PFS:**
  - CV RMSE across the six models.
  - Coefficient plot with an earlier/later cohort toggle that animates the dots to their new positions. This is the signature interaction, because it shows her main finding moving.
  - The existing RMSE bars, kept.
- **Outcomes:**
  - Kaplan–Meier plot: segmented control for overall, stage and HER2. Censor ticks, a number-at-risk table, the log-rank p-value.
  - Monte Carlo AUC strip.

Every chart has a title, a direct label or legend for each series, a hidden data table for screen readers, and hover/focus tooltips. Captions state sample sizes and caveats, matching the README wording.

### Visual

- **Palette, in shades of blue:**
  - Deep navy ink for text.
  - A mid cobalt for links and primary marks.
  - Lighter steel and sky blues for secondary series.
  - A pale ice-blue background for panels.
  - The page background stays near white.
  - One non-blue accent is allowed only if the chart validator says blue steps alone can't separate four ROC series. Otherwise, separate them with blue lightness steps plus dash patterns and direct labels.
- **Dark mode:** its own blue steps, validated against the dark surface.
- **Validation:** check every series palette with the dataviz validator, in light and dark mode.
- **Type and layout:** typefaces stay (Literata, Public Sans). Each project becomes a wider section with a chart grid (2 columns on desktop, stacked on phone), prose alongside.
- **Hero:** the Kaplan–Meier motif stays but switches to blue.

## Constraints

- GitHub Pages, static files only. JSON is loaded with `fetch`, and the page shows a readable fallback if loading fails.
- `severity.RData` and any patient-level data never get committed. `analysis/` scripts read it from its local path.
- The page stays usable at 375px wide, with keyboard access and `prefers-reduced-motion` respected.

## Left to the builder

- Exact blue hex steps (must pass the validator).
- Chart dimensions, tick choices, tooltip layout.
- Whether to inline the JSON in the page or keep separate files (separate files preferred).
