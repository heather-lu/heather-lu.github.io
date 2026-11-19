# Chart data for the portfolio

The charts on the site are drawn from small summary files in `data/`. Each one
comes from rerunning the R code in one of my project repos, unchanged, with its
original seed. Only summaries (curves, AUCs, coefficients, Kaplan–Meier steps)
are written out. No patient-level data is ever committed here.

## Rerunning

1. Clone the project repos into `analysis/_src/` (this folder is gitignored):

   ```sh
   cd analysis/_src
   git clone https://github.com/heather-lu/covid-severity-prediction.git
   git clone https://github.com/heather-lu/breast-cancer-pfs-prediction.git
   git clone https://github.com/heather-lu/breast-cancer-outcomes-prediction.git
   ```

2. Copy the COVID dataset (not public) to
   `analysis/_src/covid-severity-prediction/data/severity.RData`.

3. From the repo root, run any of:

   ```sh
   Rscript analysis/export_covid.R
   Rscript analysis/export_pfs.R
   Rscript analysis/export_brca.R
   ```

Each script checks its headline numbers against the published reports and
stops without writing anything if they don't match.
