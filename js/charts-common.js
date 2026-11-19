// Pieces shared by the project chart modules.
import { scaleLinear, ticks, svg, text, tooltip, centerOf, dataTable } from "./chartkit.js";

export function title(fig, str) {
  const p = document.createElement("p");
  p.className = "chart-title";
  p.textContent = str;
  fig.append(p);
}
export function caption(fig, str) {
  const c = document.createElement("figcaption");
  c.textContent = str;
  fig.append(c);
}
export function axisX(g, x, y0, tickVals, fmt, label, width) {
  for (const t of tickVals) {
    g.append(svg("line", { class: "grid", x1: x(t), x2: x(t), y1: 0, y2: y0 }));
    g.append(text(x(t), y0 + 16, fmt(t), { "text-anchor": "middle" }));
  }
  if (label) g.append(text(width / 2, y0 + 34, label, { "text-anchor": "middle", class: "axis-label" }));
}
export function axisY(g, y, x0, tickVals, fmt, label, height, width) {
  for (const t of tickVals) {
    g.append(svg("line", { class: "grid", x1: x0, x2: x0 + width, y1: y(t), y2: y(t) }));
    g.append(text(x0 - 6, y(t) + 4, fmt(t), { "text-anchor": "end" }));
  }
  if (label) g.append(text(-height / 2, x0 - 38, label, { "text-anchor": "middle", transform: "rotate(-90)", class: "axis-label" }));
}

// One row per model: a dot per cross-validation fold plus a tick at the mean.
// rows: [{id, label, folds: number[], mean}], selected: id drawn in --hi.
export function foldStrip(fig, { title: t, rows, selected, fmt, metric, step, caption: cap, tableCaption }) {
  title(fig, t);
  const all = rows.flatMap((r) => r.folds);
  const lo = Math.floor(Math.min(...all) * step) / step, hi = Math.ceil(Math.max(...all) * step) / step;
  const W = 320, rowH = 30, M = { l: 112, r: 12, t: 6, b: 30 };
  const H = M.t + rowH * rows.length + M.b, iw = W - M.l - M.r;
  const x = scaleLinear([lo, hi], [0, iw]);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Fold-by-fold ${metric} for each model` });
  const g = svg("g", { transform: `translate(${M.l},${M.t})` });
  root.append(g);
  axisX(g, x, rowH * rows.length, ticks(lo, hi, 4), (v) => String(+v.toFixed(3)), null, iw);
  const tip = tooltip();
  const range = (r) => `${fmt(Math.min(...r.folds))}–${fmt(Math.max(...r.folds))}`;
  rows.forEach((r, i) => {
    const cy = rowH * i + rowH / 2, sel = r.id === selected;
    const row = svg("g", { class: "datum", tabindex: 0, role: "img",
      "aria-label": `${r.label}: mean ${metric} ${fmt(r.mean)}, folds ${range(r)}` });
    row.append(svg("rect", { class: "hit", x: -M.l, y: cy - rowH / 2, width: W, height: rowH }));
    row.append(text(-M.l, cy + 4, r.label, sel ? { class: "val" } : {}));
    for (const v of r.folds) row.append(svg("circle", { class: `fold${sel ? " on" : ""}`, cx: x(v), cy, r: 4 }));
    row.append(svg("line", { class: `mean${sel ? " on" : ""}`, x1: x(r.mean), x2: x(r.mean), y1: cy - 10, y2: cy + 10 }));
    const show = (cx, cyy) => tip.show(`<strong>${r.label}</strong><br>Mean ${metric} ${fmt(r.mean)}<br>Range ${range(r)}`, cx, cyy);
    row.addEventListener("pointermove", (ev) => show(ev.clientX, ev.clientY));
    row.addEventListener("focus", () => show(...centerOf(row)));
    row.addEventListener("pointerleave", () => tip.hide());
    row.addEventListener("blur", () => tip.hide());
    g.append(row);
  });
  fig.append(root);
  caption(fig, cap);
  fig.append(dataTable(tableCaption, ["Model", ...rows[0].folds.map((_, i) => `Fold ${i + 1}`), "Mean"],
    rows.map((r) => [r.label, ...r.folds.map(fmt), fmt(r.mean)])));
}
