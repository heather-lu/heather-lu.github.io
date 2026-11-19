// Renders each chart from the real data, drives it like a user, and writes
// {check: "ok" | "FAIL: ..."} into #results for tests/check-page.sh to read.
const suite = new URLSearchParams(location.search).get("suite");
const results = {};
const check = (name, cond, detail = "") => { results[name] = cond ? "ok" : `FAIL ${detail}`; };
const mount = (id) => { const f = document.createElement("figure"); f.className = "chart"; f.id = id; document.getElementById("mounts").append(f); return f; };
const press = (root, sel) => root.querySelector(sel).click();

const suites = {
  async covid() {
    const { renderCovid } = await import("../js/charts-covid.js");
    const data = await (await fetch("../data/covid.json")).json();
    const m = { roc: mount("covid-roc"), cv: mount("covid-cv"), imp: mount("covid-imp"), pdp: mount("covid-pdp") };
    renderCovid(data, m);
    const curves = m.roc.querySelectorAll("path.curve");
    check("roc: 4 curves", curves.length === 4, curves.length);
    const on = () => [...m.roc.querySelectorAll("path.curve.on")].map((p) => p.dataset.id);
    check("roc: AdaBoost emphasized by default", on().join() === "gbmA", on().join());
    press(m.roc, 'button[data-id="glm"]');
    check("roc: choosing logistic emphasizes it", on().join() === "glm", on().join());
    check("roc: chosen button pressed", m.roc.querySelector('button[data-id="glm"]').getAttribute("aria-pressed") === "true");
    check("roc: still 4 curves visible", m.roc.querySelectorAll("path.curve").length === 4);
    const plot = m.roc.querySelector('svg[tabindex="0"]');
    check("roc: plot is keyboard focusable", !!plot);
    plot.focus();
    plot.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    const tip = document.querySelector(".chart-tip");
    check("roc: arrow key shows a point readout", !!tip && !tip.hidden && /sensitivity/i.test(tip.textContent), tip && tip.textContent);
    const cvDots = m.cv.querySelectorAll("circle.fold");
    check("cv: 40 fold dots", cvDots.length === 40, cvDots.length);
    check("imp: top 8 bars + 1 combined", m.imp.querySelectorAll(".bar").length === 9, m.imp.querySelectorAll(".bar").length);
    check("imp: table keeps every predictor", m.imp.querySelectorAll("table.chart-table tr").length === data.importance.length + 1);
    check("grid lines stay inside plots", [...document.querySelectorAll("#covid-roc line.grid, #covid-pdp line.grid")].every((l) => +l.getAttribute("x2") < 400));
    const tabs = m.pdp.querySelectorAll('[role="tab"]');
    check("pdp: 3 tabs", tabs.length === 3, tabs.length);
    check("pdp: vaccine shows 2 dots", m.pdp.querySelectorAll("circle.pd-dot").length === 2);
    tabs[1].click();
    check("pdp: SBP tab draws a line", m.pdp.querySelectorAll("path.pd-line").length === 1 && m.pdp.querySelectorAll("circle.pd-dot").length === 0);
    tabs[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    check("pdp: arrow key moves to BMI", tabs[2].getAttribute("aria-selected") === "true");
    for (const [k, el] of Object.entries(m)) check(`${k}: has data table`, !!el.querySelector("table.chart-table"));
  },
};

(suites[suite] ? suites[suite]() : Promise.reject(new Error(`unknown suite ${suite}`)))
  .catch((e) => { results.error = `FAIL ${e.message}`; })
  .finally(() => { document.getElementById("results").textContent = JSON.stringify(results); });
