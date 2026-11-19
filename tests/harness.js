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
  async pfs() {
    const { renderPfs } = await import("../js/charts-pfs.js");
    const data = await (await fetch("../data/pfs.json")).json();
    const m = { coef: mount("pfs-coef"), cv: mount("pfs-cv"), eval: mount("pfs-eval") };
    renderPfs(data, m);
    check("cv: 60 fold dots", m.cv.querySelectorAll("circle.fold").length === 60, m.cv.querySelectorAll("circle.fold").length);
    check("cv: lasso highlighted", m.cv.querySelectorAll("circle.fold.on").length === 10);
    const dots = m.coef.querySelectorAll("g.coef-row");
    check("coef: one row per term", dots.length === data.coef.length, dots.length);
    const zero = +m.coef.querySelector("line.zero").getAttribute("x1");
    const her2 = m.coef.querySelector('g.coef-row[data-term="HER21"] circle.coef-dot');
    const xOf = (el) => +/translate\(([-\d.]+)px/.exec(el.style.transform)[1];
    check("coef: HER2 negative in earlier cohort", xOf(her2) < zero, `${xOf(her2)} vs ${zero}`);
    press(m.coef, 'button[data-id="later"]');
    check("coef: HER2 crosses to >= 0 in later cohort", xOf(her2) >= zero, `${xOf(her2)} vs ${zero}`);
    check("coef: later button pressed", m.coef.querySelector('button[data-id="later"]').getAttribute("aria-pressed") === "true");
    const ghost = m.coef.querySelector('g.coef-row[data-term="HER21"] circle.coef-ghost');
    check("coef: ghost left at earlier value", !!ghost && xOf(ghost) < zero);
    const order = [...dots].map((d) => d.dataset.term).join();
    check("coef: row order unchanged by toggle", order === [...m.coef.querySelectorAll("g.coef-row")].map((d) => d.dataset.term).join());
    const dur = getComputedStyle(her2).transitionDuration;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) check("coef: no animation with reduced motion", dur === "0s", dur);
    else check("coef: animates when motion allowed", parseFloat(dur) > 0, dur);
    check("eval: 3 bars", m.eval.querySelectorAll(".bar").length === 3);
    check("eval: cross-cohort bar highlighted", m.eval.querySelectorAll(".bar.on").length === 1);
    for (const [k, el] of Object.entries(m)) check(`${k}: has data table`, !!el.querySelector("table.chart-table"));
    // Phone width: the coefficient chart must not shrink its text below ~11px
    const narrow = mount("pfs-coef-narrow");
    narrow.style.width = "340px";
    renderPfs(data, { coef: narrow, cv: mount("x1"), eval: mount("x2") });
    const sv = narrow.querySelector("svg");
    const scale = sv.getBoundingClientRect().width / sv.viewBox.baseVal.width;
    check("coef: readable at phone width (scale >= 0.9)", scale >= 0.9, scale.toFixed(2));
  },
  async brca() {
    const { renderBrca } = await import("../js/charts-brca.js");
    const data = await (await fetch("../data/brca.json")).json();
    const m = { km: mount("brca-km"), auc: mount("brca-auc") };
    renderBrca(data, m);
    const tabs = m.km.querySelectorAll('[role="tab"]');
    check("km: 3 tabs", tabs.length === 3, tabs.length);
    const curves = () => m.km.querySelectorAll("path.curve");
    check("km: overall has 1 curve", curves().length === 1, curves().length);
    check("km: censor marks match data", m.km.querySelectorAll(".censor").length === data.km.overall.groups[0].censor.length);
    check("km: no p-value for overall", !/p [=<]/.test(m.km.querySelector(".pval")?.textContent || ""));
    tabs[1].click();
    check("km: stage has 3 curves", curves().length === 3, curves().length);
    check("km: stage emphasizes exactly one", m.km.querySelectorAll("path.curve.on").length === 1);
    const pick = m.km.querySelectorAll(".choice-group button");
    check("km: stage has a group picker", pick.length === 3, pick.length);
    pick[0].click();
    check("km: picking stage I emphasizes it", m.km.querySelector("path.curve.on")?.dataset.group === data.km.stage.groups[0].name);
    check("km: stage p-value shown", /p = 0\.10/.test(m.km.querySelector(".pval").textContent), m.km.querySelector(".pval").textContent);
    check("km: at-risk table has a row per group", m.km.querySelectorAll(".at-risk tr.group").length === 3);
    tabs[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    check("km: arrow key moves to HER2", tabs[2].getAttribute("aria-selected") === "true");
    check("km: HER2 has 2 curves in two blues", curves().length === 2 && m.km.querySelectorAll("path.curve.on").length === 1 && m.km.querySelectorAll("path.curve.on2").length === 1);
    check("km: HER2 hides the group picker", m.km.querySelectorAll(".choice-group button").length === 0);
    check("km: HER2 p-value shown", /p = 0\.97/.test(m.km.querySelector(".pval").textContent));
    check("auc: 5 split dots", m.auc.querySelectorAll("circle.mc").length === 5);
    check("auc: chance line", !!m.auc.querySelector("line.chance"));
    for (const [k, el] of Object.entries(m)) check(`${k}: has data table`, !!el.querySelector("table.chart-table"));
  },
  async fallback() {
    // Recreate the page's chart mounts, make every data request fail, then run main.js.
    const ids = ["covid-roc", "covid-cv", "covid-imp", "covid-pdp", "pfs-coef", "pfs-cv", "pfs-eval", "brca-km", "brca-auc"];
    const art = document.createElement("article");
    art.innerHTML = `<div class="project-links"><a href="https://github.com/heather-lu/x">Code</a></div>` +
      ids.map((id) => `<figure class="chart" id="${id}" data-fallback="Summary for ${id}."></figure>`).join("");
    document.getElementById("mounts").append(art);
    window.fetch = () => Promise.reject(new TypeError("offline"));
    await import("../js/main.js");
    await new Promise((r) => setTimeout(r, 300));
    const fb = art.querySelectorAll(".chart-fallback");
    check("fallback: every chart shows a text summary", fb.length === ids.length, fb.length);
    check("fallback: no empty chart boxes", [...art.querySelectorAll("figure.chart")].every((f) => f.textContent.trim().length > 0));
    check("fallback: links to the analysis", [...fb].every((p) => p.querySelector("a[href*='github.com']")));
  },
  async phone() {
    const f = document.createElement("iframe");
    f.style.cssText = "width:375px;height:800px;border:0";
    f.src = "../index.html";
    document.body.append(f);
    await new Promise((r) => f.addEventListener("load", r));
    await new Promise((r) => setTimeout(r, 1500));
    const d = f.contentDocument;
    const wide = [...d.body.querySelectorAll("*")].filter((el) => el.getBoundingClientRect().right > 376)
      .slice(0, 4).map((el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${el.className?.baseVal ?? el.className}`);
    check("phone: no horizontal scroll", d.documentElement.scrollWidth <= 375, `${d.documentElement.scrollWidth} ${wide.join(" ")}`);
    const figs = [...d.querySelectorAll("figure.chart[id]")];
    check("phone: all 9 charts rendered", figs.length === 9 && figs.every((x) => x.querySelector("svg")), figs.filter((x) => !x.querySelector("svg")).map((x) => x.id).join());
    // A tooltip opened near the right edge stays inside the 375px viewport
    const row = d.querySelector("#covid-cv g.datum");
    row.dispatchEvent(new f.contentWindow.PointerEvent("pointermove", { clientX: 370, clientY: 200, bubbles: true }));
    const tip = d.querySelector(".chart-tip");
    const r = tip.getBoundingClientRect();
    check("phone: tooltip stays on screen", !tip.hidden && r.right <= 375 && r.left >= 0, `${r.left}-${r.right}`);
    check("phone: hero heading present", /Heather Lu/.test(d.querySelector("h1").textContent));
  },
};

(suites[suite] ? suites[suite]() : Promise.reject(new Error(`unknown suite ${suite}`)))
  .catch((e) => { results.error = `FAIL ${e.message}`; })
  .finally(() => { document.getElementById("results").textContent = JSON.stringify(results); });
