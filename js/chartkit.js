// Small, dependency-free helpers for the portfolio's SVG charts.
// Pure helpers (scales, ticks, paths, layout math) are unit-tested in tests/chartkit.test.mjs;
// DOM helpers are exercised by tests/check-page.sh.

const SVG_NS = "http://www.w3.org/2000/svg";

export function scaleLinear([d0, d1], [r0, r1]) {
  const k = (r1 - r0) / (d1 - d0);
  const f = (v) => r0 + (v - d0) * k;
  f.invert = (r) => d0 + (r - r0) / k;
  f.domain = [d0, d1];
  return f;
}

export function ticks(d0, d1, count = 5) {
  const span = d1 - d0;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 1);
  const out = [];
  for (let v = Math.ceil(d0 / step - 1e-9) * step; v <= d1 + step * 1e-9; v += step) {
    out.push(Math.round(v / step) * step);
  }
  return out.map((v) => +v.toPrecision(12));
}

const fmt = (n) => +n.toFixed(2);

export function linePath(points, x, y) {
  return points.map(([a, b], i) => `${i ? "L" : "M"}${fmt(x(a))},${fmt(y(b))}`).join("");
}

export function stepPath(points, x, y) {
  return points.map(([a, b], i) => (i ? `H${fmt(x(a))}V${fmt(y(b))}` : `M${fmt(x(a))},${fmt(y(b))}`)).join("");
}

// Place a w×h box near pointer (px, py), offset by 12px, kept `pad` px inside a vw×vh viewport.
export function clampToViewport(px, py, w, h, vw, vh, pad = 8) {
  let x = px + 12, y = py + 12;
  if (x + w > vw - pad) x = Math.max(pad, px - 12 - w);
  if (x + w > vw - pad) x = vw - pad - w;
  if (y + h > vh - pad) y = Math.max(pad, py - 12 - h);
  return [Math.max(pad, x), Math.max(pad, y)];
}

export function nearestPoint(points, xValue) {
  let best = points[0];
  for (const p of points) if (Math.abs(p[0] - xValue) < Math.abs(best[0] - xValue)) best = p;
  return best;
}

export function formatP(p) {
  return p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(2)}`;
}

// ---- DOM helpers (browser only) ----

export function svg(tag, attrs = {}, children = []) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of [].concat(children)) el.append(c);
  return el;
}

export function text(x, y, str, attrs = {}) {
  return svg("text", { x, y, ...attrs }, [str]);
}

let tipEl;
export function tooltip() {
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.className = "chart-tip";
    tipEl.setAttribute("role", "status");
    tipEl.hidden = true;
    document.body.append(tipEl);
  }
  return {
    show(html, clientX, clientY) {
      tipEl.innerHTML = html;
      tipEl.hidden = false;
      const r = tipEl.getBoundingClientRect();
      const [x, y] = clampToViewport(clientX, clientY, r.width, r.height,
                                     document.documentElement.clientWidth, window.innerHeight);
      tipEl.style.transform = `translate(${x}px, ${y}px)`;
    },
    hide() { tipEl.hidden = true; },
  };
}

// Center of an element in client coordinates (for showing a tooltip on keyboard focus).
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

export function dataTable(caption, headers, rows) {
  const t = document.createElement("table");
  t.className = "chart-table";
  t.innerHTML = `<caption>${caption}</caption><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>` +
    rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
  return t;
}

// Single-select button group (aria-pressed). Used to choose which series is emphasized.
export function choiceGroup(container, items, selectedId, onSelect, label) {
  const group = document.createElement("div");
  group.className = "choice-group";
  group.setAttribute("role", "group");
  if (label) group.setAttribute("aria-label", label);
  const buttons = items.map(({ id, label: l }) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = l;
    b.dataset.id = id;
    b.setAttribute("aria-pressed", String(id === selectedId));
    b.addEventListener("click", () => {
      buttons.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      onSelect(id);
    });
    return b;
  });
  group.append(...buttons);
  container.append(group);
  return group;
}

// Tabs (role="tablist"); arrow keys move between tabs.
export function tabGroup(container, items, onSelect, label) {
  const list = document.createElement("div");
  list.className = "tab-group";
  list.setAttribute("role", "tablist");
  if (label) list.setAttribute("aria-label", label);
  const tabs = items.map(({ id, label: l }, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.textContent = l;
    b.dataset.id = id;
    b.setAttribute("aria-selected", String(i === 0));
    b.tabIndex = i === 0 ? 0 : -1;
    b.addEventListener("click", () => select(i));
    b.addEventListener("keydown", (ev) => {
      if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
      ev.preventDefault();
      const j = (i + (ev.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      select(j);
      tabs[j].focus();
    });
    return b;
  });
  function select(i) {
    tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    onSelect(items[i].id);
  }
  list.append(...tabs);
  container.append(list);
  return list;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
