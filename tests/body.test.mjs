import test from "node:test";
import assert from "node:assert/strict";
import {
  BASELINE,
  PROPOSED_BODY_GOALS,
  percentChange,
  goalProgress,
  suggestedWeight,
} from "../src/body.ts";
test("scan baseline preserves the supplied readings and proposed goal states its lean-mass assumption", () => {
  assert.equal(BASELINE.weight, 89.7);
  assert.equal(BASELINE.bodyFat, 23.5);
  assert.equal(BASELINE.muscleMass, 39.1);
  assert.equal(BASELINE.date, "2026-11-01");
  assert.equal(Object.keys(BASELINE.scan).length, 12);
  assert.equal(PROPOSED_BODY_GOALS.weight, 83.7);
  assert.equal(PROPOSED_BODY_GOALS.bodyFat, 18);
});
test("check-in changes and goal completion support loss, gain, zero baselines and moving away", () => {
  assert.ok(Math.abs(percentChange(88, 89.7) + 1.895206243) < 0.0001);
  assert.equal(percentChange(5, 0), null);
  assert.equal(goalProgress(85, 90, 80), 50);
  assert.equal(goalProgress(85, 80, 90), 50);
  assert.equal(goalProgress(92, 90, 80), -20);
  assert.equal(goalProgress(90, 90, 90), null);
});
test("grey loads preview an equipment step even for pyramid sets without filling bodyweight values", () => {
  const sets = Array.from({ length: 3 }, () => ({ weight: "40", reps: "12" }));
  assert.equal(suggestedWeight(sets, 0, "barbell"), 42.5);
  assert.equal(
    suggestedWeight([{ weight: "40", reps: "8" }], 0, "barbell"),
    42.5,
  );
  assert.equal(
    suggestedWeight([{ weight: "0", reps: "15" }], 0, "body only"),
    null,
  );
  assert.equal(
    suggestedWeight(
      [
        { weight: "40", reps: "12" },
        { weight: "30", reps: "12" },
      ],
      0,
      "barbell",
    ),
    42.5,
  );
});
