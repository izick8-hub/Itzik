import test from "node:test";
import assert from "node:assert/strict";
import {
  nextLoad,
  suggestedWeight,
  readyToProgress,
  progressionAdvice,
  defaultProgression,
} from "../src/progression.ts";
const sets = (w, r) =>
  Array.from({ length: 3 }, () => ({ weight: String(w), reps: String(r) }));
test("preview uses equipment steps and supports different weights on every set", () => {
  const pyramid = [
    { weight: "73", reps: "10" },
    { weight: "91", reps: "8" },
    { weight: "91", reps: "8" },
  ];
  assert.equal(suggestedWeight(pyramid, 0, "machine"), 75.5);
  assert.equal(suggestedWeight(pyramid, 1, "machine"), 93.5);
  assert.equal(suggestedWeight(sets(70, 8), 0, "barbell"), 72.5);
  assert.equal(
    defaultProgression({ equipment: "barbell", primaryMuscles: ["quadriceps"] })
      .increment,
    5,
  );
  assert.equal(
    defaultProgression({ equipment: "dumbbell", name: "Biceps curl" })
      .increment,
    0.5,
  );
});
test("large unavoidable jumps are withheld instead of forcing an increase", () => {
  assert.equal(suggestedWeight(sets(5, 12), 0, "dumbbell"), null);
  assert.equal(
    suggestedWeight(sets(5, 12), 0, "dumbbell", {
      repTarget: 8,
      increment: 0.25,
    }),
    5.25,
  );
  assert.equal(suggestedWeight(sets(0, 12), 0, "body only"), null);
  assert.equal(suggestedWeight(sets(70, 12), 0, "body only"), null);
  assert.match(
    progressionAdvice([sets(5, 12)], { equipment: "dumbbell" }),
    /exceed a 10% jump/,
  );
});
test("a higher preview is separate from readiness and requires two over-target sessions", () => {
  const exercise = { equipment: "barbell" };
  assert.equal(readyToProgress([sets(70, 8)], exercise), false);
  assert.equal(readyToProgress([sets(70, 10), sets(70, 9)], exercise), true);
  assert.equal(readyToProgress([sets(70, 10), sets(70, 8)], exercise), false);
  assert.equal(readyToProgress([sets(70, 12)], exercise), false);
  assert.equal(
    readyToProgress([sets(70, 10), sets(70, 10)], exercise, {
      repTarget: 12,
      increment: 2.5,
    }),
    false,
  );
  assert.match(
    progressionAdvice([sets(70, 8)], exercise),
    /not an automatic increase/,
  );
  assert.match(
    progressionAdvice([sets(70, 10), sets(70, 10)], exercise),
    /two logged sessions/,
  );
});

test("personal renames do not change an exercise equipment default", () => {
  assert.equal(
    defaultProgression({
      name: "My arm move",
      originalName: "Biceps curl",
      equipment: "dumbbell",
    }).increment,
    0.5,
  );
});
