# Rerun covid-severity-prediction and export chart summaries to data/covid.json.
# Run from the repo root: Rscript analysis/export_covid.R
source("analysis/common.R")

src <- "analysis/_src/covid-severity-prediction/analysis"
e <- load_or_run(file.path(src, "covid_severity.Rmd"), src, "analysis/_src/covid_env.rds")

models <- list(
  list(id = "glm",   label = "Logistic regression", fit = e$model.glm,   roc = e$roc.glm,   auc = 0.911),
  list(id = "rpart", label = "Decision tree",       fit = e$model.rpart, roc = e$roc.rpart, auc = 0.896),
  list(id = "gbmA",  label = "AdaBoost",            fit = e$model.gbmA,  roc = e$roc.gbmA,  auc = 0.918),
  list(id = "svmr",  label = "SVM (radial)",        fit = e$model.svmr,  roc = e$roc.svmr,  auc = 0.918)
)

# Verification gate: published numbers must reproduce before anything is written.
stopifnot(nrow(e$testing_data) == 200, nrow(e$training_data) == 800)
for (m in models) cat(sprintf("%-20s test AUC %.6f\n", m$label, as.numeric(m$roc$auc)))
for (m in models) {
  if (m$id == "svmr") {
    # kernlab's Platt-scaling step draws random numbers differently across versions,
    # so the rerun SVM lands at 0.9192 vs the published 0.918 (the split, folds and
    # every other model reproduce exactly). Heather chose to label the curve with the
    # published value; anything further off than 0.002 still stops the export.
    if (abs(as.numeric(m$roc$auc) - m$auc) > 0.002) stop("test AUC, SVM (radial) drifted beyond 0.002")
  } else {
    assert_close(as.numeric(m$roc$auc), m$auc, 3, paste("test AUC,", m$label))
  }
}

roc_points <- function(r) {
  pts <- data.frame(fpr = 1 - r$specificities, tpr = r$sensitivities, thr = r$thresholds)
  pts <- pts[is.finite(pts$thr), ]
  pts <- pts[order(pts$fpr, pts$tpr), ]
  pts <- rbind(data.frame(fpr = 0, tpr = 0, thr = NA), pts, data.frame(fpr = 1, tpr = 1, thr = NA))
  unname(lapply(seq_len(nrow(pts)), function(i) c(round(pts$fpr[i], 4), round(pts$tpr[i], 4),
                                                   if (is.na(pts$thr[i])) NA else round(pts$thr[i], 4))))
}

model_out <- lapply(models, function(m) {
  folds <- m$fit$resample$ROC
  stopifnot(length(folds) == 10)
  list(id = m$id, label = m$label, test_auc = m$auc,  # published value (see SVM note above)
       roc = roc_points(m$roc), cv_auc = round(folds, 4), cv_auc_mean = mean(folds))
})

# Relative influence from the selected AdaBoost model
ri <- gbm::summary.gbm(e$model.gbmA$finalModel, plotit = FALSE)
pretty_var <- c(vaccine1 = "Vaccinated", SBP = "Systolic blood pressure", bmi = "BMI",
                age = "Age", height = "Height", weight = "Weight", LDL = "LDL cholesterol",
                depression = "Depression score", hypertension1 = "Hypertension",
                diabetes1 = "Diabetes", gender1 = "Gender (male)", smoking1 = "Smoking (former)",
                smoking2 = "Smoking (current)", race2 = "Race 2", race3 = "Race 3", race4 = "Race 4")
importance <- lapply(seq_len(nrow(ri)), function(i) {
  v <- as.character(ri$var[i])
  list(var = v, label = if (v %in% names(pretty_var)) unname(pretty_var[v]) else v,
       rel_inf = round(ri$rel.inf[i], 2))
})

# Partial dependence, same calls as the report (probability of severe illness)
pd <- function(var) pdp::partial(e$model.gbmA, pred.var = var, grid.resolution = 100,
                                 prob = TRUE, train = e$training_data)
pd_vac <- pd("vaccine"); pd_sbp <- pd("SBP"); pd_bmi <- pd("bmi")
vac_levels <- as.character(pd_vac$vaccine)
stopifnot(identical(vac_levels, c("0", "1")))
assert_close(pd_vac$yhat[1], 0.59, 2, "PDP unvaccinated")
# The report reads this off the plot as "approximately 0.15"; the fitted model gives 0.135.
if (abs(pd_vac$yhat[2] - 0.15) > 0.02) stop("PDP vaccinated: far from the reported ~0.15")

out <- list(
  n_train = 800, n_test = 200, selected = "gbmA",
  models = model_out,
  importance = importance,
  pdp = list(
    vaccine = list(kind = "categorical", label = "Vaccination status",
                   x = c("Not vaccinated", "Vaccinated"), y = round(pd_vac$yhat, 4)),
    SBP = list(kind = "numeric", label = "Systolic blood pressure (mmHg)",
               x = round(pd_sbp$SBP, 2), y = round(pd_sbp$yhat, 4)),
    bmi = list(kind = "numeric", label = "BMI (kg/m²)",
               x = round(pd_bmi$bmi, 2), y = round(pd_bmi$yhat, 4))
  )
)
write_summary_json(out, "data/covid.json")
cat("wrote data/covid.json\n")
