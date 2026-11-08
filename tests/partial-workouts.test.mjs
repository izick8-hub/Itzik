import test from "node:test";
import assert from "node:assert/strict";
import { enteredSessionSets, validPartialSets } from "../src/model.ts";
import { volume, comparison, summary } from "../src/insights.ts";
import { nextLoad, readyToProgress } from "../src/progression.ts";
const partial = [
  { weight: "40", reps: "8" },
  { weight: "", reps: "" },
  { weight: "45", reps: "" },
];
test("saving retains partial rows at original indices and omits untouched exercises", () => {
  const entered = enteredSessionSets(["legs", "shoulders"], {
    legs: partial,
    shoulders: [{ weight: "", reps: "" }],
  });
  assert.deepEqual(entered, { legs: partial });
  assert.equal(entered.legs.length, 3);
  assert.equal(validPartialSets(partial), true);
  assert.deepEqual(
    enteredSessionSets(["legs"], { legs: [{ weight: "", reps: "12" }] }),
    { legs: [{ weight: "", reps: "12" }] },
  );
  assert.deepEqual(enteredSessionSets(["legs"], {}), {});
});
test("blank fields are allowed but invalid entered numbers still fail", () => {
  assert.equal(
    validPartialSets([
      { weight: "0", reps: "" },
      { weight: "", reps: "10" },
    ]),
    true,
  );
  for (const set of [
    { weight: "-2", reps: "" },
    { weight: "x", reps: "" },
    { weight: "", reps: "0" },
    { weight: "", reps: "1.5" },
  ])
    assert.equal(validPartialSets([set]), false);
});
test("partial logs do not invent zeros, comparisons, progression readiness or volume", () => {
  assert.equal(volume(partial), 320);
  assert.equal(comparison(partial, partial), null);
  assert.equal(nextLoad(partial, 2, { equipment: "barbell" }), null);
  assert.equal(
    readyToProgress(
      [[{ weight: "", reps: "12" }], [{ weight: "", reps: "12" }]],
      { equipment: "barbell" },
    ),
    false,
  );
  const s = summary({
    selections: {},
    drafts: {},
    cardio: [],
    sessions: {
      0: [
        {
          id: "1",
          date: "2026-11-08",
          sets: { press: [{ weight: "40", reps: "" }] },
        },
      ],
    },
  });
  assert.equal(s.count, 1);
  assert.equal(s.hasVolume, false);
  assert.equal(s.totalVolume, 0);
});
