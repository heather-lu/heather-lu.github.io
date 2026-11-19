# Shared helpers for the export scripts.
# Each export runs the R code from one of Heather's project R Markdown files
# unchanged, then pulls summary results out of the objects it creates.

# Extract the R code from an Rmd and evaluate it in the global environment,
# as knitting does (some functions, like survminer::ggsurvplot, look objects up
# there), with `workdir` as the working directory (so relative data paths
# resolve) and a null graphics device (so plots are drawn nowhere).
# Returns the global environment. Run one Rmd per R session.
run_rmd_code <- function(rmd_path, workdir) {
  rmd_path <- normalizePath(rmd_path, mustWork = TRUE)
  code_file <- tempfile(fileext = ".R")
  knitr::purl(rmd_path, output = code_file, documentation = 0, quiet = TRUE)

  old_wd <- setwd(workdir)
  on.exit(setwd(old_wd), add = TRUE)
  grDevices::pdf(NULL)
  on.exit(grDevices::dev.off(), add = TRUE)

  sys.source(code_file, envir = globalenv())
  globalenv()
}

# Stop unless `actual` rounds to `expected` at `dp` decimal places.
assert_close <- function(actual, expected, dp, label) {
  if (round(actual, dp) != expected) {
    stop(sprintf("%s: expected %s, got %s", label,
                 format(expected, nsmall = dp), format(round(actual, dp), nsmall = dp)),
         call. = FALSE)
  }
  invisible(TRUE)
}

write_summary_json <- function(x, path) {
  dir.create(dirname(path), showWarnings = FALSE, recursive = TRUE)
  jsonlite::write_json(x, path, auto_unbox = TRUE, digits = 6, null = "null", na = "null")
  invisible(path)
}

# Run an Rmd once (see run_rmd_code), copy what it created into a standalone
# environment, and cache that at `cache_path`. Later calls read the cache.
load_or_run <- function(rmd_path, workdir, cache_path) {
  if (file.exists(cache_path)) return(readRDS(cache_path))
  g <- run_rmd_code(rmd_path, workdir)
  snap <- list2env(as.list(g, all.names = TRUE), envir = new.env(parent = emptyenv()))
  saveRDS(snap, cache_path)
  snap
}
