// Breast cancer outcomes charts: Kaplan-Meier curves (overall / stage / HER2) with
// censor marks, number at risk and log-rank p, plus Monte Carlo AUCs. Data: data/brca.json.
import { scaleLinear, ticks, stepPath, nearestPoint, svg, text, tooltip, centerOf,
         dataTable, choiceGroup, tabGroup, formatP } from "./chartkit.js";
import { title, caption, axisX, axisY } from "./charts-common.js";

const DASH = ["", "6 4", "2 4"];

function renderKm(fig, data) {
  title(fig, "Kaplan–Meier survival after surgery");
  const W = 320, H = 250, M = { l: 48, r: 14, t: 10, b: 44 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const maxT = Math.max(...Object.values(data.km).flatMap((k) => k.groups.flatMap((g) => g.steps.map((s) => s[0]))));
  const x = scaleLinear([0, maxT], [0, iw]), y = scaleLinear([0, 1], [ih, 0]);
  const tip = tooltip();

  const pickerSlot = document.createElement("div");
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", tabindex: 0 });
  const g = svg("g", { transform: `translate(${M.l},${M.t})` });
  root.append(g);
  const riskWrap = document.createElement("div");
  riskWrap.className = "at-risk-wrap";

  let view, emphasized, idx = 0;
  const groups = () => data.km[view].groups;

  function draw() {
    g.replaceChildren();
    const k = data.km[view], gs = k.groups, two = gs.length === 2;
    root.setAttribute("aria-label", `Kaplan–Meier survival curves, ${k.label.toLowerCase()}. Arrow keys read points on the highlighted curve.`);
    axisX(g, x, ih, ticks(0, maxT, 4), (v) => String(Math.round(v)), `Days since surgery`, iw);
    axisY(g, y, 0, ticks(0, 1, 5), (v) => v.toFixed(1), "Survival probability", ih, iw);
    gs.forEach((grp, i) => {
      const cls = gs.length === 1 || grp.name === emphasized ? "on" : two ? "on2" : "";
      const path = svg("path", { class: `curve ${cls}`.trim(), "data-group": grp.name, d: stepPath(grp.steps, x, y),
                                 "stroke-dasharray": cls === "on" ? null : DASH[i % DASH.length] || null });
      g.append(path);
      for (const [t, s] of grp.censor) {
        g.append(svg("line", { class: `censor ${cls}`.trim(), x1: x(t), x2: x(t), y1: y(s) - 4, y2: y(s) + 4 }));
      }
      if (gs.length > 1) {
        const last = grp.steps[grp.steps.length - 1];
        const lx = Math.min(x(last[0]) + 4, iw - 2);
        g.append(text(lx, y(last[1]) - 6, view === "stage" ? `Stage ${grp.name}` : grp.name,
                      { "text-anchor": "end", class: cls ? "val" : "" }));
      }
    });
    // draw emphasized curve last so it sits on top
    const top = g.querySelector("path.curve.on");
    if (top) g.append(top);
    const pv = text(iw, 14, k.p == null ? `n = ${data.n_surv}` : `Log-rank ${formatP(k.p)}`, { "text-anchor": "end", class: "pval val" });
    g.append(pv);
    marker = svg("circle", { class: "cross", r: 5, visibility: "hidden" });
    g.append(marker);

    // Number at risk
    const times = gs[0].at_risk.map((a) => a[0]);
    riskWrap.innerHTML = `<table class="at-risk"><caption>Number at risk</caption><tr><th></th>${times.map((t) => `<th>${t}</th>`).join("")}</tr>` +
      gs.map((grp) => `<tr class="group"><th>${view === "stage" ? `Stage ${grp.name}` : grp.name}</th>${grp.at_risk.map((a) => `<td>${a[1]}</td>`).join("")}</tr>`).join("") +
      `</table>`;
  }
  let marker;

  function setView(v) {
    view = v;
    const gs = groups();
    pickerSlot.replaceChildren();
    if (gs.length > 2) {
      emphasized = gs.reduce((a, b) => (b.n > a.n ? b : a)).name; // largest group first
      choiceGroup(pickerSlot, gs.map((grp) => ({ id: grp.name, label: `Stage ${grp.name} (n = ${grp.n})` })),
                  emphasized, (id) => { emphasized = id; draw(); }, "Highlight a group");
    } else {
      emphasized = gs[0].name;
    }
    idx = 0;
    tip.hide();
    draw();
  }

  function readout(clientX, clientY) {
    const grp = groups().find((gr) => gr.name === emphasized);
    const pt = grp.steps[idx];
    marker.setAttribute("cx", x(pt[0])); marker.setAttribute("cy", y(pt[1])); marker.setAttribute("visibility", "visible");
    const name = view === "stage" ? `Stage ${grp.name}` : view === "her2" ? `HER2 ${grp.name.toLowerCase()}` : "All patients";
    tip.show(`<strong>${name}</strong><br>Day ${Math.round(pt[0])}<br>Survival ${pt[1].toFixed(2)}`, clientX, clientY);
  }
  for (const evName of ["pointermove", "pointerdown"]) root.addEventListener(evName, (ev) => {
    const r = root.getBoundingClientRect();
    const t = x.invert(((ev.clientX - r.left) / r.width) * W - M.l);
    if (t < 0) return;
    const steps = groups().find((gr) => gr.name === emphasized).steps;
    idx = steps.indexOf(nearestPoint(steps, t));
    readout(ev.clientX, ev.clientY);
  });
  root.addEventListener("pointerleave", () => { tip.hide(); marker.setAttribute("visibility", "hidden"); });
  root.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    ev.preventDefault();
    const steps = groups().find((gr) => gr.name === emphasized).steps;
    idx = Math.min(steps.length - 1, Math.max(0, idx + (ev.key === "ArrowRight" ? 1 : -1)));
    readout(...centerOf(root));
  });
  root.addEventListener("blur", () => { tip.hide(); marker.setAttribute("visibility", "hidden"); });

  tabGroup(fig, Object.entries(data.km).map(([id, k]) => ({ id, label: k.label })), setView, "Split by");
  fig.append(pickerSlot, root, riskWrap);
  setView(Object.keys(data.km)[0]);
  caption(fig, `${data.n_surv} patients with usable follow-up. Ticks mark censored patients. Few deaths and small subgroups make these curves imprecise.`);
  fig.append(dataTable("Kaplan–Meier survival at event times", ["Split", "Group", "Day", "Survival"],
    Object.values(data.km).flatMap((k) => k.groups.flatMap((grp) => grp.steps.map(([t, s]) => [k.label, grp.name, Math.round(t), s.toFixed(3)])))));
}

function renderAuc(fig, data) {
  title(fig, "Held-out AUC across 5 random train/test splits");
  const W = 320, H = 110, M = { l: 12, r: 12, t: 24, b: 34 };
  const iw = W - M.l - M.r;
  const x = scaleLinear([0.3, 0.8], [0, iw]);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Logistic regression AUC on five Monte Carlo test splits" });
  const g = svg("g", { transform: `translate(${M.l},${M.t})` });
  root.append(g);
  const cy = 20;
  axisX(g, x, 44, ticks(0.3, 0.8, 5), (v) => v.toFixed(1), "AUC", iw);
  g.append(svg("line", { class: "chance", x1: x(0.5), x2: x(0.5), y1: -14, y2: 44 }));
  g.append(text(x(0.5) + 4, -4, "chance", { class: "axis-label" }));
  const mean = data.mc_auc.reduce((a, b) => a + b, 0) / data.mc_auc.length;
  const tip = tooltip();
  data.mc_auc.forEach((v, i) => {
    const dot = svg("circle", { class: "mc dot on", cx: x(v), cy, r: 6, tabindex: 0, role: "img", "aria-label": `Split ${i + 1}: AUC ${v.toFixed(3)}` });
    const show = (cx, cyy) => tip.show(`Split ${i + 1}<br>AUC ${v.toFixed(3)}`, cx, cyy);
    dot.addEventListener("pointermove", (ev) => show(ev.clientX, ev.clientY));
    dot.addEventListener("focus", () => show(...centerOf(dot)));
    dot.addEventListener("pointerleave", () => tip.hide());
    dot.addEventListener("blur", () => tip.hide());
    g.append(dot);
  });
  g.append(svg("line", { class: "mean on", x1: x(mean), x2: x(mean), y1: cy - 12, y2: cy + 12 }));
  g.append(text(x(mean), cy + 26, `mean ${mean.toFixed(3)}`, { "text-anchor": "middle", class: "val" }));
  fig.append(root);
  caption(fig, "Age, tumour stage, surgery type and four protein biomarkers barely beat chance at predicting vital status.");
  fig.append(dataTable("Monte Carlo AUCs", ["Split", "AUC"], data.mc_auc.map((v, i) => [i + 1, v.toFixed(3)])));
}

export function renderBrca(data, mounts) {
  renderKm(mounts.km, data);
  renderAuc(mounts.auc, data);
}
