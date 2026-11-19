# Rerun breast-cancer-outcomes-prediction and export chart summaries to data/brca.json.
# Run from the repo root: Rscript analysis/export_brca.R
source("analysis/common.R")

src <- "analysis/_src/breast-cancer-outcomes-prediction"
e <- load_or_run(file.path(src, "final_report.Rmd"), src, "analysis/_src/brca_env.rds")

# Verification gate
cat("n =", nrow(e$brca), " n_surv =", nrow(e$brca_surv), "\n")
stopifnot(nrow(e$brca) == 334, nrow(e$brca_surv) == 317)
mc_auc <- e$cv_df$auc
stopifnot(length(mc_auc) == 5, all(mc_auc >= 0 & mc_auc <= 1))
cat("MC AUCs:", round(mc_auc, 3), " mean", round(mean(mc_auc), 3), "\n")

logrank_p <- function(sd) pchisq(sd$chisq, df = length(sd$n) - 1, lower.tail = FALSE)
p_stage <- logrank_p(e$logrank_stage); p_her2 <- logrank_p(e$logrank_her2)
cat("log-rank p: stage", signif(p_stage, 3), " HER2", signif(p_her2, 3), "\n")

# Number at risk at time rt: n.risk at the first recorded time >= rt (0 past the last time)
n_at_risk <- function(t, n_risk, rt) {
  j <- which(t >= rt)
  if (length(j) == 0) 0L else n_risk[min(j)]
}

km_groups <- function(fit, default_name) {
  max_t <- max(fit$time)
  risk_times <- round(seq(0, max_t, length.out = 5))
  strata <- if (is.null(fit$strata)) setNames(length(fit$time), default_name) else fit$strata
  ends <- cumsum(strata); starts <- ends - strata + 1
  lapply(seq_along(strata), function(i) {
    idx <- starts[i]:ends[i]
    t <- fit$time[idx]; s <- fit$surv[idx]; n_event <- fit$n.event[idx]; n_cens <- fit$n.censor[idx]
    stopifnot(all(diff(s) <= 1e-12))  # survival never increases
    # Step coordinates at event times, starting from (0, 1)
    ev <- n_event > 0
    steps <- c(list(c(0, 1)), lapply(which(ev), function(j) c(t[j], round(s[j], 4))))
    last <- c(t[length(t)], round(s[length(s)], 4))
    if (!ev[length(ev)]) steps <- c(steps, list(last))
    cens <- lapply(which(n_cens > 0), function(j) c(t[j], round(s[j], 4)))
    # Number at risk at fixed times
    at_risk <- lapply(risk_times, function(rt) c(rt, n_at_risk(t, fit$n.risk[idx], rt)))
    name <- sub("^[^=]*=", "", names(strata)[i])
    list(name = name, n = fit$n[i], steps = steps, censor = cens, at_risk = at_risk)
  })
}

out <- list(
  n = nrow(e$brca), n_surv = nrow(e$brca_surv), time_unit = "days",
  km = list(
    overall = list(label = "All patients", p = NULL, groups = km_groups(e$km_overall, "All patients")),
    stage = list(label = "Tumour stage", p = signif(p_stage, 3), groups = km_groups(e$km_stage, "")),
    her2 = list(label = "HER2 status", p = signif(p_her2, 3), groups = km_groups(e$km_her2, ""))
  ),
  mc_auc = round(mc_auc, 4)
)
write_summary_json(out, "data/brca.json")
cat("wrote data/brca.json\n")
