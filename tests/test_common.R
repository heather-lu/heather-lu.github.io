# Tests for analysis/common.R. Run from repo root: Rscript tests/test_common.R
source("analysis/common.R")

env <- run_rmd_code("tests/fixtures/mini.Rmd", "tests/fixtures")
stopifnot(identical(env$x, 42))
stopifnot(identical(normalizePath(getwd()), normalizePath(".")))  # cwd restored

assert_close(0.91149, 0.911, 3, "auc")
caught <- tryCatch({ assert_close(0.9, 0.911, 3, "auc"); FALSE },
                   error = function(e) grepl("auc", conditionMessage(e)))
stopifnot(caught)

tmp <- tempfile(fileext = ".json")
write_summary_json(list(a = 1, b = c(0.1234567, 2)), tmp)
back <- jsonlite::fromJSON(tmp)
stopifnot(back$a == 1, length(back$b) == 2)
cat("test_common: OK\n")
