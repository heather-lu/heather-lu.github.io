// Breast cancer PFS charts: lasso coefficients by cohort (with a cohort toggle),
// CV RMSE by model, and the three lasso evaluations. Data: data/pfs.json.
import { scaleLinear, ticks, svg, text, tooltip, centerOf, dataTable, choiceGroup } from "./chartkit.js";
import { title, caption, axisX, foldStrip } from "./charts-common.js";

const f4 = (v) => v.toFixed(4);
const f3 = (v) => v.toFixed(3);
const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(3);
const KEY_TERMS = new Set(["HER21", "hormonal_therapy1", "lymph_nodes"]);

// Drawn at the container's width (1 SVG unit = 1px) so text stays readable.
// Below 560px, each label sits above its row instead of to the left.
function renderCoef(fig, data, cohort = "earlier") {
  fig.replaceChildren();
  title(fig, "Lasso coefficients: how predictors shifted between cohorts");
  const rows = [...data.coef].sort((a, b) => a.earlier - b.earlier);
  const vals = rows.flatMap((r) => [r.earlier, r.later]);
  const pad = 0.03;
  const lo = Math.min(0, ...vals) - pad, hi = Math.max(0, ...vals) + pad;
  const cs = getComputedStyle(fig);
  const avail = Math.max(280, fig.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  const stacked = avail < 560;
  const W = avail, rowH = stacked ? 38 : 22, M = stacked ? { l: 4, r: 14, t: 4, b: 40 } : { l: 250, r: 20, t: 8, b: 40 };
  const H = M.t + rowH * rows.length + M.b, iw = W - M.l - M.r;
  const x = scaleLinear([lo, hi], [0, iw]);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": "Lasso coefficients for each predictor. Use the cohort buttons to move the dots between the earlier and later cohort fits." });
  const g = svg("g", { transform: `translate(${M.l},${M.t})` });
  root.append(g);
  axisX(g, x, rowH * rows.length, ticks(lo, hi, 6), (v) => signed(v).replace(/0+$/, "").replace(/\.$/, ""),
        stacked ? "Coefficient (positive = longer PFS)" : "Coefficient on log-PFS (positive = longer progression-free survival)", iw);
  g.append(svg("line", { class: "zero", x1: x(0), x2: x(0), y1: 0, y2: rowH * rows.length }));

  const tip = tooltip();
  const other = () => (cohort === "earlier" ? "later" : "earlier");
  const items = rows.map((r, i) => {
    const cy = stacked ? rowH * i + 27 : rowH * i + rowH / 2, key = KEY_TERMS.has(r.term);
    const row = svg("g", { class: "coef-row datum", "data-term": r.term, tabindex: 0, role: "img" });
    row.append(svg("rect", { class: "hit", x: -M.l, y: rowH * i, width: W, height: rowH }));
    row.append(stacked ? text(0, rowH * i + 12, r.label, key ? { class: "val" } : {})
                       : text(-10, cy + 4, r.label, { "text-anchor": "end", ...(key ? { class: "val" } : {}) }));
    const track = svg("line", { class: "coef-track", y1: cy, y2: cy });
    const ghost = svg("circle", { class: "coef-ghost", r: 5, cx: 0, cy: 0 });
    const dot = svg("circle", { class: `coef-dot${key ? " on" : ""}`, r: 6, cx: 0, cy: 0 });
    row.append(track, ghost, dot);
    const describe = () => `${r.label}: earlier cohort ${signed(r.earlier)}, later cohort ${signed(r.later)}`;
    row.setAttribute("aria-label", describe());
    const show = (cx, cyy) => tip.show(`<strong>${r.label}</strong><br>Earlier cohort ${signed(r.earlier)}<br>Later cohort ${signed(r.later)}`, cx, cyy);
    row.addEventListener("pointermove", (ev) => show(ev.clientX, ev.clientY));
    row.addEventListener("focus", () => show(...centerOf(dot)));
    row.addEventListener("pointerleave", () => tip.hide());
    row.addEventListener("blur", () => tip.hide());
    g.append(row);
    return { r, cy, dot, ghost, track };
  });

  function place() {
    for (const { r, cy, dot, ghost, track } of items) {
      const now = x(r[cohort]), then = x(r[other()]);
      dot.style.transform = `translate(${now}px, ${cy}px)`;
      ghost.style.transform = `translate(${then}px, ${cy}px)`;
      track.setAttribute("x1", Math.min(now, then)); track.setAttribute("x2", Math.max(now, then));
    }
  }
  choiceGroup(fig, [{ id: "earlier", label: `Earlier cohort (${data.cohorts.earlier.split(",")[0]})` },
                    { id: "later", label: `Later cohort (${data.cohorts.later.split(",")[0]})` }],
              cohort, (id) => { cohort = id; place(); }, "Cohort");
  fig.append(root);
  place();
  fig.dataset.layout = stacked ? "stacked" : "side";
  // Re-draw if a resize crosses the layout breakpoint, keeping the chosen cohort.
  fig._coefObserver?.disconnect();
  fig._coefObserver = new ResizeObserver(() => {
    const now = fig.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) < 560 ? "stacked" : "side";
    if (now !== fig.dataset.layout || Math.abs(fig.clientWidth - fig._coefWidth) > 40) renderCoef(fig, data, cohort);
  });
  fig._coefWidth = fig.clientWidth;
  fig._coefObserver.observe(fig);
  caption(fig, "Solid dots show the selected cohort's fit and faint rings the other one. HER2, hormonal therapy and lymph nodes moved the most. These are shifts in predictive associations, not causal effects.");
  fig.append(dataTable("Lasso coefficients by cohort", ["Predictor", "Earlier cohort", "Later cohort"],
    rows.map((r) => [r.label, f4(r.earlier), f4(r.later)])));
}

function renderEval(fig, data) {
  title(fig, "Lasso prediction error (RMSE, log-PFS)");
  const W = 320, rowH = 50, M = { l: 0, r: 46, t: 4, b: 30 };
  const H = M.t + rowH * data.eval.length + M.b, iw = W - M.l - M.r;
  const x = scaleLinear([0, 0.9], [0, iw]);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Lasso RMSE on each evaluation set" });
  const g = svg("g", { transform: `translate(${M.l + 1},${M.t})` });
  root.append(g);
  axisX(g, x, rowH * data.eval.length, [0, 0.3, 0.6, 0.9], (v) => String(v), null, iw);
  g.append(svg("line", { class: "axis", x1: 0, x2: 0, y1: 0, y2: rowH * data.eval.length }));
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  data.eval.forEach((e, i) => {
    const y0 = rowH * i, w = x(e.rmse), cross = e.train !== e.test.split(" ")[0];
    g.append(text(6, y0 + 16, `${cap(e.train)} model, ${e.test}`, cross ? { class: "val" } : {}));
    g.append(svg("path", { class: `bar${cross ? " on" : ""}`, d: `M0 ${y0 + 24}H${w - 4}a4 4 0 0 1 4 4V${y0 + 38}a4 4 0 0 1 -4 4H0Z` }));
    g.append(text(w + 6, y0 + 37, f3(e.rmse), { class: "val" }));
  });
  fig.append(root);
  caption(fig, "Lower is better. The later-cohort evaluations use different samples, so they aren't a paired comparison.");
  fig.append(dataTable("Lasso RMSE on log-PFS scale", ["Training data", "Evaluation data", "n", "RMSE", "Squared correlation"],
    data.eval.map((e) => [cap(e.train), e.test, e.n, f4(e.rmse), f4(e.r2)])));
}

export function renderPfs(data, mounts) {
  renderCoef(mounts.coef, data);
  foldStrip(mounts.cv, {
    title: "Cross-validated RMSE, earlier cohort",
    rows: data.cv_rmse.earlier.map((m) => ({ id: m.id, label: m.label, folds: m.folds, mean: m.mean })),
    selected: "lasso", fmt: f3, metric: "CV RMSE", step: 20,
    caption: "Lower is better. The six models are nearly tied, so lasso was chosen for parsimony and interpretability.",
    tableCaption: "10-fold CV RMSE by model, earlier cohort",
  });
  renderEval(mounts.eval, data);
}
