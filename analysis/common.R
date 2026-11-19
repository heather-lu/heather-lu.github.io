# Shared helpers for the export scripts.
# Each export runs the R code from one of Heather's project R Markdown files
# unchanged, then pulls summary results out of the objects it creates.

# Extract the R code from an Rmd and evaluate it in a fresh environment,
# with `workdir` as the working directory (so relative data paths resolve)
# and a null graphics device (so plots are drawn nowhere).
run_rmd_code <- function(rmd_path, workdir) {
  rmd_path <- normalizePath(rmd_path, mustWork = TRUE)
  code_file <- tempfile(fileext = ".R")
  knitr::purl(rmd_path, output = code_file, documentation = 0, quiet = TRUE)

  old_wd <- setwd(workdir)
  on.exit(setwd(old_wd), add = TRUE)
  grDevices::pdf(NULL)
  on.exit(grDevices::dev.off(), add = TRUE)

  env <- new.env(parent = globalenv())
  sys.source(code_file, envir = env)
  env
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
