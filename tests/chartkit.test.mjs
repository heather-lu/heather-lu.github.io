// Unit tests for the pure helpers in js/chartkit.js. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { scaleLinear, ticks, linePath, stepPath, clampToViewport, nearestPoint, formatP } from "../js/chartkit.js";

const id = (v) => v;

test("scaleLinear maps and inverts", () => {
  const s = scaleLinear([0, 1], [0, 100]);
  assert.equal(s(0.25), 25);
  assert.equal(s.invert(25), 0.25);
  const flipped = scaleLinear([0, 1], [200, 0]); // SVG y axis
  assert.equal(flipped(1), 0);
});

test("ticks uses nice 1/2/5 steps", () => {
  const t = ticks(0.88, 0.93, 5);
  const want = [0.88, 0.89, 0.9, 0.91, 0.92, 0.93];
  assert.equal(t.length, want.length);
  t.forEach((v, i) => assert.ok(Math.abs(v - want[i]) < 1e-9, `${v} vs ${want[i]}`));
  assert.deepEqual(ticks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
});

test("linePath joins points", () => {
  assert.equal(linePath([[0, 0], [1, 1]], id, id), "M0,0L1,1");
});

test("stepPath draws post-steps (Kaplan-Meier / ROC)", () => {
  assert.equal(stepPath([[0, 1], [2, 0.8], [5, 0.6]], id, id), "M0,1H2V0.8H5V0.6");
});

test("clampToViewport keeps a tooltip on screen", () => {
  const [x, y] = clampToViewport(370, 10, 120, 40, 375, 800);
  assert.ok(x <= 375 - 120 - 8, `x=${x}`);
  assert.ok(x >= 8 && y >= 8);
  // fits as-is: offset to the right/below the pointer
  assert.deepEqual(clampToViewport(100, 100, 50, 20, 375, 800), [112, 112]);
});

test("nearestPoint finds the closest point by x", () => {
  const pts = [[0, 0], [0.1, 0.5], [0.4, 0.8], [1, 1]];
  assert.deepEqual(nearestPoint(pts, 0.3), [0.4, 0.8]);
  assert.deepEqual(nearestPoint(pts, 0.04), [0, 0]);
});

test("formatP formats log-rank p-values", () => {
  assert.equal(formatP(0.103), "p = 0.10");
  assert.equal(formatP(0.97), "p = 0.97");
  assert.equal(formatP(0.0004), "p < 0.001");
});
