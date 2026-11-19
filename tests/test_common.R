# Tests for analysis/common.R. Run from repo root: Rscript tests/test_common.R
source("analysis/common.R")

env <- run_rmd_code("tests/fixtures/mini.Rmd", "tests/fixtures")
stopifnot(identical(env$x, 42))
stopifnot(identical(env$z, 42))  # code that looks objects up globally works, as when knitting
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

# load_or_run: runs once, snapshots results into a standalone env, caches it
cache <- tempfile(fileext = ".rds")
s1 <- load_or_run("tests/fixtures/mini.Rmd", "tests/fixtures", cache)
stopifnot(!identical(s1, globalenv()), identical(s1$x, 42), file.exists(cache))
rm(x, z, envir = globalenv())
s2 <- load_or_run("tests/fixtures/mini.Rmd", "tests/fixtures", cache)  # from cache, no rerun
stopifnot(identical(s2$x, 42), !exists("x", envir = globalenv(), inherits = FALSE))
cat("test_common load_or_run: OK\n")
