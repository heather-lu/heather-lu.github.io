// COVID-19 severity charts: ROC curves, cross-validation folds, variable importance,
// partial dependence. Data: data/covid.json (see analysis/export_covid.R).
import { scaleLinear, ticks, linePath, stepPath, nearestPoint, svg, text, tooltip,
         centerOf, dataTable, choiceGroup, tabGroup } from "./chartkit.js";

const f3 = (v) => v.toFixed(3);
const DASH = { glm: "6 4", rpart: "2 4", gbmA: null, svmr: "10 3 2 3" };

function title(fig, str) {
  const p = document.createElement("p");
  p.className = "chart-title";
  p.textContent = str;
  fig.append(p);
}
function caption(fig, str) {
  const c = document.createElement("figcaption");
  c.textContent = str;
  fig.append(c);
}
function axisX(g, x, y0, tickVals, fmt, label, width) {
  for (const t of tickVals) {
    g.append(svg("line", { class: "grid", x1: x(t), x2: x(t), y1: 0, y2: y0 }));
    g.append(text(x(t), y0 + 16, fmt(t), { "text-anchor": "middle" }));
  }
  if (label) g.append(text(width / 2, y0 + 34, label, { "text-anchor": "middle", class: "axis-label" }));
}
function axisY(g, y, x0, tickVals, fmt, label, height, width) {
  for (const t of tickVals) {
    g.append(svg("line", { class: "grid", x1: x0, x2: x0 + width, y1: y(t), y2: y(t) }));
    g.append(text(x0 - 6, y(t) + 4, fmt(t), { "text-anchor": "end" }));
  }
  if (label) g.append(text(-height / 2, x0 - 38, label, { "text-anchor": "middle", transform: "rotate(-90)", class: "axis-label" }));
}

function renderRoc(fig, data) {
  title(fig, "ROC curves on the held-out test set");
  const W = 320, H = 300, M = { l: 48, r: 8, t: 8, b: 44 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const x = scaleLinear([0, 1], [0, iw]), y = scaleLinear([0, 1], [ih, 0]);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, tabindex: 0, role: "img",
    "aria-label": "ROC curves for four models. Use the buttons to choose which model is highlighted, and arrow keys to read points on its curve." });
  const g = svg("g", { transform: `translate(${M.l},${M.t})` });
  root.append(g);
  axisX(g, x, ih, ticks(0, 1, 5), (v) => v.toFixed(1), "False positive rate (1 − specificity)", iw);
  axisY(g, y, 0, ticks(0, 1, 5), (v) => v.toFixed(1), "Sensitivity", ih, iw);
  g.append(svg("line", { class: "ref", x1: x(0), y1: y(0), x2: x(1), y2: y(1) }));

  const curves = {};
  const ordered = [...data.models];
  for (const m of ordered) {
    curves[m.id] = svg("path", { class: "curve", "data-id": m.id, d: stepPath(m.roc, x, y), "stroke-dasharray": DASH[m.id] });
    g.append(curves[m.id]);
  }
  const marker = svg("circle", { class: "cross", r: 5, visibility: "hidden" });
  const label = text(0, 0, "", { class: "val curve-label" });
  g.append(marker, label);

  let active = data.selected, idx = 0;
  const tip = tooltip();
  const model = () => data.models.find((m) => m.id === active);
  function emphasize(id) {
    active = id;
    for (const [k, p] of Object.entries(curves)) {
      p.classList.toggle("on", k === id);
      if (k === id) g.insertBefore(p, marker); // draw on top
    }
    const m = model();
    label.textContent = `${m.label}, AUC ${f3(m.test_auc)}`;
    label.setAttribute("x", x(0.38)); label.setAttribute("y", y(0.32));
    marker.setAttribute("visibility", "hidden"); tip.hide();
  }
  function readout(pt, clientX, clientY) {
    marker.setAttribute("cx", x(pt[0])); marker.setAttribute("cy", y(pt[1]));
    marker.setAttribute("visibility", "visible");
    const thr = pt[2] == null ? "" : `<br>Threshold ${pt[2].toFixed(2)}`;
    tip.show(`<strong>${model().label}</strong>${thr}<br>Sensitivity ${pt[1].toFixed(2)}<br>Specificity ${(1 - pt[0]).toFixed(2)}`, clientX, clientY);
  }
  root.addEventListener("pointermove", (ev) => {
    const r = root.getBoundingClientRect();
    const fpr = x.invert(((ev.clientX - r.left) / r.width) * W - M.l);
    if (fpr < 0 || fpr > 1) return;
    const pts = model().roc;
    const pt = nearestPoint(pts, fpr);
    idx = pts.indexOf(pt);
    readout(pt, ev.clientX, ev.clientY);
  });
  root.addEventListener("pointerleave", () => { marker.setAttribute("visibility", "hidden"); tip.hide(); });
  root.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    ev.preventDefault();
    const pts = model().roc;
    const step = Math.max(1, Math.round(pts.length / 25));
    idx = Math.min(pts.length - 1, Math.max(0, idx + (ev.key === "ArrowRight" ? step : -step)));
    const [cx, cy] = centerOf(marker.ownerSVGElement);
    readout(pts[idx], cx, cy);
  });
  root.addEventListener("blur", () => { marker.setAttribute("visibility", "hidden"); tip.hide(); });

  choiceGroup(fig, data.models.map((m) => ({ id: m.id, label: `${m.label} ${f3(m.test_auc)}` })),
              active, emphasize, "Highlight a model");
  fig.append(root);
  emphasize(active);
  caption(fig, `n = ${data.n_test}. Each line style is one model; the highlighted one is drawn in blue.`);
  fig.append(dataTable("Test-set AUC by model", ["Model", "Test AUC", "Mean CV AUC"],
    data.models.map((m) => [m.label, f3(m.test_auc), f3(m.cv_auc_mean)])));
}

function renderCv(fig, data) {
  title(fig, "AUC in each of the 10 cross-validation folds");
  const all = data.models.flatMap((m) => m.cv_auc);
  const lo = Math.floor(Math.min(...all) * 20) / 20, hi = Math.ceil(Math.max(...all) * 20) / 20;
  const W = 320, rowH = 34, M = { l: 112, r: 12, t: 6, b: 30 };
  const H = M.t + rowH * data.models.length + M.b, iw = W - M.l - M.r;
  const x = scaleLinear([lo, hi], [0, iw]);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Fold-by-fold cross-validated AUC for each model" });
  const g = svg("g", { transform: `translate(${M.l},${M.t})` });
  root.append(g);
  axisX(g, x, rowH * data.models.length, ticks(lo, hi, 4), (v) => v.toFixed(2), null, iw);
  const tip = tooltip();
  data.models.forEach((m, i) => {
    const cy = rowH * i + rowH / 2;
    const sel = m.id === data.selected;
    const row = svg("g", { class: "datum", tabindex: 0, role: "img",
      "aria-label": `${m.label}: mean CV AUC ${f3(m.cv_auc_mean)}, folds ${f3(Math.min(...m.cv_auc))} to ${f3(Math.max(...m.cv_auc))}` });
    row.append(svg("rect", { class: "hit", x: -M.l, y: cy - rowH / 2, width: W, height: rowH }));
    row.append(text(-M.l, cy + 4, m.label, sel ? { class: "val" } : {}));
    for (const v of m.cv_auc) row.append(svg("circle", { class: `fold${sel ? " on" : ""}`, cx: x(v), cy, r: 4 }));
    row.append(svg("line", { class: `mean${sel ? " on" : ""}`, x1: x(m.cv_auc_mean), x2: x(m.cv_auc_mean), y1: cy - 10, y2: cy + 10 }));
    const show = (cx, cyy) => tip.show(`<strong>${m.label}</strong><br>Mean CV AUC ${f3(m.cv_auc_mean)}<br>Range ${f3(Math.min(...m.cv_auc))}–${f3(Math.max(...m.cv_auc))}`, cx, cyy);
    row.addEventListener("pointermove", (ev) => show(ev.clientX, ev.clientY));
    row.addEventListener("focus", () => show(...centerOf(row)));
    row.addEventListener("pointerleave", () => tip.hide());
    row.addEventListener("blur", () => tip.hide());
    g.append(row);
  });
  fig.append(root);
  caption(fig, "Dots are folds and the tick is the mean. AdaBoost had the highest mean, so it was selected.");
  fig.append(dataTable("Cross-validated AUC by fold", ["Model", ...data.models[0].cv_auc.map((_, i) => `Fold ${i + 1}`), "Mean"],
    data.models.map((m) => [m.label, ...m.cv_auc.map(f3), f3(m.cv_auc_mean)])));
}

function renderImportance(fig, data) {
  title(fig, "What drives AdaBoost's predictions");
  const all = [...data.importance].sort((a, b) => b.rel_inf - a.rel_inf);
  const TOP = 8;
  const rest = all.slice(TOP);
  const rows = all.slice(0, TOP).concat(rest.length ? [{ label: `Other ${rest.length} combined`,
    rel_inf: rest.reduce((a, r) => a + r.rel_inf, 0), other: true }] : []);
  const W = 320, rowH = 17, M = { l: 150, r: 40, t: 2, b: 4 };
  const H = M.t + rowH * rows.length + M.b, iw = W - M.l - M.r;
  const x = scaleLinear([0, Math.max(...rows.map((r) => r.rel_inf))], [0, iw]);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Relative influence of each predictor in the AdaBoost model" });
  const g = svg("g", { transform: `translate(${M.l},${M.t})` });
  root.append(g);
  rows.forEach((r, i) => {
    const cy = rowH * i, w = Math.max(x(r.rel_inf), 1), top = i < 3;
    g.append(text(-8, cy + 12, r.label, { "text-anchor": "end", ...(top ? { class: "val" } : {}) }));
    g.append(svg("path", { class: `bar${top ? " on" : ""}`,
      d: w > 4 ? `M0 ${cy + 3}H${w - 3}a3 3 0 0 1 3 3V${cy + 11}a3 3 0 0 1 -3 3H0Z` : `M0 ${cy + 3}H${w}V${cy + 14}H0Z` }));
    g.append(text(w + 5, cy + 12, `${r.rel_inf.toFixed(1)}%`, top ? { class: "val" } : {}));
  });
  fig.append(root);
  caption(fig, "Relative influence (%) in the final AdaBoost model. Vaccination status alone accounts for over half.");
  fig.append(dataTable("Relative influence", ["Predictor", "Relative influence (%)"], all.map((r) => [r.label, r.rel_inf.toFixed(2)])));
}

function renderPdp(fig, data) {
  title(fig, "How predicted risk changes with each top predictor");
  const W = 320, H = 240, M = { l: 48, r: 12, t: 10, b: 44 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const y = scaleLinear([0, 1], [ih, 0]);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", tabindex: 0 });
  const g = svg("g", { transform: `translate(${M.l},${M.t})` });
  root.append(g);
  const tip = tooltip();
  let current;

  function draw(key) {
    current = data.pdp[key];
    g.replaceChildren();
    root.setAttribute("aria-label", `Partial dependence of predicted probability of severe illness on ${current.label}`);
    axisY(g, y, 0, ticks(0, 1, 5), (v) => v.toFixed(1), "Predicted probability", ih, iw);
    if (current.kind === "categorical") {
      const x = (i) => iw * (i + 0.5) / current.x.length;
      current.x.forEach((lab, i) => {
        g.append(text(x(i), ih + 16, lab, { "text-anchor": "middle" }));
        g.append(svg("line", { class: "stem", x1: x(i), x2: x(i), y1: y(0), y2: y(current.y[i]) }));
        g.append(svg("circle", { class: "pd-dot on dot", cx: x(i), cy: y(current.y[i]), r: 7 }));
        g.append(text(x(i) + 12, y(current.y[i]) + 4, current.y[i].toFixed(2), { class: "val" }));
      });
      g.append(text(iw / 2, ih + 34, current.label, { "text-anchor": "middle", class: "axis-label" }));
    } else {
      const xs = current.x, x = scaleLinear([xs[0], xs[xs.length - 1]], [0, iw]);
      axisX(g, x, ih, ticks(xs[0], xs[xs.length - 1], 5), (v) => String(+v.toFixed(1)), current.label, iw);
      const pts = xs.map((v, i) => [v, current.y[i]]);
      g.append(svg("path", { class: "pd-band", d: `${linePath(pts, x, y)}V${y(0)}H${x(xs[0])}Z` }));
      g.append(svg("path", { class: "pd-line curve on", d: linePath(pts, x, y) }));
      const marker = svg("circle", { class: "cross", r: 5, visibility: "hidden" });
      g.append(marker);
      current.readAt = (fx, cx, cy) => {
        const pt = nearestPoint(pts, fx);
        marker.setAttribute("cx", x(pt[0])); marker.setAttribute("cy", y(pt[1])); marker.setAttribute("visibility", "visible");
        tip.show(`${current.label}: ${pt[0].toFixed(1)}<br>Predicted probability ${pt[1].toFixed(2)}`, cx, cy);
      };
      current.xScale = x;
      current.hideMarker = () => marker.setAttribute("visibility", "hidden");
    }
  }
  root.addEventListener("pointermove", (ev) => {
    if (current.kind !== "numeric") return;
    const r = root.getBoundingClientRect();
    current.readAt(current.xScale.invert(((ev.clientX - r.left) / r.width) * W - M.l), ev.clientX, ev.clientY);
  });
  root.addEventListener("pointerleave", () => { tip.hide(); current.hideMarker?.(); });

  tabGroup(fig, Object.entries(data.pdp).map(([id, v]) => ({ id, label: v.label.replace(/ \(.*\)$/, "") })), draw, "Predictor");
  fig.append(root);
  draw(Object.keys(data.pdp)[0]);
  caption(fig, "Averaged over the training data. The y-axis stays fixed at 0–1, so the tabs compare fairly.");
  fig.append(dataTable("Partial dependence", ["Predictor", "Value", "Predicted probability"],
    Object.values(data.pdp).flatMap((v) => v.kind === "categorical"
      ? v.x.map((lab, i) => [v.label, lab, v.y[i].toFixed(3)])
      : v.x.filter((_, i) => i % 10 === 0).map((xv, j) => [v.label, xv.toFixed(1), v.y[j * 10].toFixed(3)]))));
}

export function renderCovid(data, mounts) {
  renderRoc(mounts.roc, data);
  renderCv(mounts.cv, data);
  renderImportance(mounts.imp, data);
  renderPdp(mounts.pdp, data);
}
