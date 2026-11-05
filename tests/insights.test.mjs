import test from "node:test";
import assert from "node:assert/strict";
import { summary, comparison, progression } from "../src/insights.ts";
const sets = (w, r) =>
  Array.from({ length: 3 }, () => ({ weight: String(w), reps: String(r) }));
test("empty journal has no fabricated metrics", () => {
  const s = summary({ sessions: {}, cardio: [], drafts: {}, selections: {} });
  assert.equal(s.count, 0);
  assert.equal(s.streak, 0);
  assert.equal(s.totalVolume, 0);
});
test("summary counts lifting sessions, actual volume, and consecutive local training days", () => {
  const now = new Date(2026, 10, 2, 12);
  const yesterday = new Date(2026, 10, 1, 12).toISOString();
  const s = summary(
    {
      sessions: {
        0: [
          { id: "a", date: now.toISOString(), sets: { a: sets(10, 10) } },
          { id: "b", date: now.toISOString(), sets: { a: sets(10, 10) } },
        ],
        1: [{ id: "c", date: yesterday, sets: { a: sets(20, 10) } }],
      },
      cardio: [],
      drafts: {},
      selections: {},
    },
    now,
  );
  assert.equal(s.count, 3);
  assert.equal(s.streak, 2);
  assert.equal(s.totalVolume, 1200);
});
test("load and reps changes are separate and zero baselines stay undefined", () => {
  assert.deepEqual(comparison(sets(12, 8), sets(10, 10)), {
    weight: 20,
    reps: -20,
  });
  assert.equal(comparison(sets(12, 8), sets(0, 10)).weight, null);
  assert.equal(comparison(sets(12, 8), sets(10, 10).slice(1)), null);
});
test("progression increases only after controlled rep-target assumption and never gives bodyweight a kg target", () => {
  assert.match(
    progression(sets(40, 12), "barbell"),
    /not an automatic increase/,
  );
  assert.match(progression(sets(40, 8), "barbell"), /same weight/);
  assert.doesNotMatch(progression(sets(0, 15), "body only"), /kg/);
  assert.match(
    progression(
      [
        { weight: "40", reps: "12" },
        { weight: "30", reps: "12" },
      ],
      "dumbbell",
    ),
    /every set/,
  );
});
