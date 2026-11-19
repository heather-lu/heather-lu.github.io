# Rerun breast-cancer-pfs-prediction and export chart summaries to data/pfs.json.
# Run from the repo root: Rscript analysis/export_pfs.R
source("analysis/common.R")

src <- "analysis/_src/breast-cancer-pfs-prediction"
e <- load_or_run(file.path(src, "dsci_II_midterm.Rmd"), src, "analysis/_src/pfs_env.rds")

rmse <- function(pred, obs) sqrt(mean((pred - obs)^2))
r2 <- function(pred, obs) cor(pred, obs)^2  # as in the report: squared correlation

ev <- list(
  list(train = "earlier", test = "earlier test set", n = nrow(e$testing_data),
       rmse = rmse(e$lasso_pred, e$testing_data$log_PFS), r2 = r2(e$lasso_pred, e$testing_data$log_PFS), pub = 0.6842),
  list(train = "earlier", test = "full later cohort", n = nrow(e$datB),
       rmse = rmse(e$lasso_datB, e$datB$log_PFS), r2 = r2(e$lasso_datB, e$datB$log_PFS), pub = 0.8293),
  list(train = "later", test = "later test set", n = nrow(e$testing_dataB),
       rmse = rmse(e$lasso_predB, e$testing_dataB$log_PFS), r2 = r2(e$lasso_predB, e$testing_dataB$log_PFS), pub = 0.6674)
)

# Verification gate
for (x in ev) {
  cat(sprintf("%-8s -> %-18s n=%4d RMSE %.6f r2 %.4f\n", x$train, x$test, x$n, x$rmse, x$r2))
  assert_close(x$rmse, x$pub, 4, paste("RMSE", x$train, "->", x$test))
}
stopifnot(ev[[1]]$n == 400, ev[[2]]$n == 2000, ev[[3]]$n == 400)

model_labels <- c(ols = "OLS", ridge = "Ridge", lasso = "Lasso", enet = "Elastic net", gam = "GAM", mars = "MARS")
cv_list <- function(resamp) {
  v <- resamp$values
  lapply(names(model_labels), function(id) {
    folds <- v[[paste0(id, "~RMSE")]]
    stopifnot(length(folds) == 10)
    list(id = id, label = unname(model_labels[id]), mean = mean(folds), folds = round(folds, 4))
  })
}

coef_vec <- function(fit) {
  b <- as.matrix(coef(fit$finalModel, s = fit$bestTune$lambda))[, 1]
  b[names(b) != "(Intercept)"]
}
bA <- coef_vec(e$lasso_fit); bB <- coef_vec(e$lasso_fitB)
stopifnot(identical(names(bA), names(bB)))
keep <- names(bA)[bA != 0 | bB != 0]
cat("coefficient terms:", paste(keep, collapse = ", "), "\n")

# Readable labels, from the factor coding in the report's Table 1 (reference level in brackets)
term_labels <- c(
  age = "Age (per year)", menopause1 = "Post-menopausal [pre]", race2 = "Black [White]",
  race3 = "Asian [White]", race4 = "Hispanic [White]", bmi = "BMI (per kg/m²)",
  tumor_size = "Tumor size (per cm)", tumor_grade2 = "Grade: moderately differentiated [well]",
  tumor_grade3 = "Grade: poorly differentiated [well]", lymph_nodes = "Positive lymph nodes (per node)",
  ER1 = "ER positive", PR1 = "PR positive", HER21 = "HER2 positive", Ki67 = "Ki-67 index (per %)",
  stage2 = "Stage II [I]", stage3 = "Stage III [I]", surgery1 = "Mastectomy [breast-conserving]",
  chemo1 = "Chemotherapy", hormonal_therapy1 = "Hormonal therapy")
stopifnot(all(keep %in% names(term_labels)))

out <- list(
  cohorts = list(earlier = "1990–1995, n = 2,000", later = "2000–2005, n = 2,000"),
  lambda = list(earlier = round(e$lasso_fit$bestTune$lambda, 5), later = round(e$lasso_fitB$bestTune$lambda, 5)),
  cv_rmse = list(earlier = cv_list(e$resamp), later = cv_list(e$resampB)),
  eval = lapply(ev, function(x) list(train = x$train, test = x$test, n = x$n,
                                     rmse = round(x$rmse, 4), r2 = round(x$r2, 4))),
  coef = lapply(keep, function(t) list(term = t, label = unname(term_labels[t]),
                                       earlier = round(unname(bA[t]), 4), later = round(unname(bB[t]), 4)))
)
write_summary_json(out, "data/pfs.json")
cat("wrote data/pfs.json\n")
