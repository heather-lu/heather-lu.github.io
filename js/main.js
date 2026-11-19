// Loads each project's chart data and renders it. Each project is independent,
// so one failed load leaves the others working; failed charts show a text fallback.
import { renderCovid } from "./charts-covid.js";

const projects = [
  { data: "data/covid.json", render: renderCovid, mounts: { roc: "covid-roc", cv: "covid-cv", imp: "covid-imp", pdp: "covid-pdp" } },
];

function fallback(el, repo) {
  const p = document.createElement("p");
  p.className = "chart-fallback";
  p.textContent = `${el.dataset.fallback} `;
  if (repo) { const a = document.createElement("a"); a.href = repo; a.textContent = "See the full analysis on GitHub."; p.append(a); }
  el.replaceChildren(p);
}

for (const pr of projects) {
  const mounts = Object.fromEntries(Object.entries(pr.mounts).map(([k, id]) => [k, document.getElementById(id)]));
  const repo = mounts[Object.keys(mounts)[0]].closest("article")?.querySelector(".project-links a")?.href;
  fetch(pr.data)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => pr.render(d, mounts))
    .catch(() => Object.values(mounts).forEach((el) => fallback(el, repo)));
}
