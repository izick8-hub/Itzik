import test from "node:test";
import assert from "node:assert/strict";
import { newSets, validSets, emptyData, keyFor } from "../src/model.ts";
test("three independent empty sets are created for each exercise", () => {
  const a = newSets();
  assert.equal(a.length, 3);
  a[0].weight = "10";
  assert.equal(a[1].weight, "");
  assert.equal(newSets()[0].weight, "");
});
test("completed sets accept bodyweight zero and fractional kilograms", () =>
  assert.equal(
    validSets([
      { weight: "0", reps: "12" },
      { weight: "12.5", reps: "8" },
    ]),
    true,
  ));
test("incomplete or invalid sets do not count as fully completed sets", () => {
  for (const set of [
    { weight: "", reps: "8" },
    { weight: "-1", reps: "8" },
    { weight: "10", reps: "1.5" },
    { weight: "Infinity", reps: "8" },
    { weight: "10", reps: "0" },
  ])
    assert.equal(validSets([set]), false);
});
test("day selections and sessions are isolated and survive JSON storage", () => {
  const data = emptyData();
  data.selections[keyFor(0, "Shoulders")] = ["press"];
  data.sessions[0] = [
    {
      id: "1",
      date: "2026-11-02",
      sets: { press: [{ weight: "10", reps: "8" }] },
    },
  ];
  const restored = JSON.parse(JSON.stringify(data));
  assert.equal(restored.sessions[0][0].sets.press[0].weight, "10");
  assert.equal(restored.selections[keyFor(1, "Chest")], undefined);
});
