import { test, expect } from "@playwright/test";
test("skipped exercises and one-sided fields save, survive reload and can be edited later", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("lift-journal:v1"))
      localStorage.setItem(
        "lift-journal:v1",
        JSON.stringify({
          selections: {
            "0:Legs": ["Barbell_Squat"],
            "0:Shoulders": ["Dumbbell_Shoulder_Press"],
          },
          sessions: {
            0: [
              {
                id: "old",
                date: "2026-11-01T10:00:00Z",
                sets: {
                  Barbell_Squat: Array.from({ length: 3 }, () => ({
                    weight: "30",
                    reps: "10",
                  })),
                  Dumbbell_Shoulder_Press: Array.from({ length: 3 }, () => ({
                    weight: "10",
                    reps: "10",
                  })),
                },
              },
            ],
          },
          drafts: {},
          cardio: [],
        }),
      );
  });
  const alerts: string[] = [];
  page.on("dialog", async (dialog) => {
    alerts.push(dialog.message());
    await dialog.accept();
  });
  await page.goto("./");
  await page
    .getByRole("button", { name: "Weight-lifting", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Barbell Squat set 1 weight in kilograms",
      exact: true,
    })
    .fill("40");
  await page
    .getByRole("textbox", { name: "Barbell Squat set 1 reps", exact: true })
    .fill("8");
  await page
    .getByRole("textbox", {
      name: "Barbell Squat set 3 weight in kilograms",
      exact: true,
    })
    .fill("45");
  await page
    .getByRole("button", { name: "Finish & save workout", exact: true })
    .click();
  await expect(
    page.getByText("2 workouts saved", { exact: true }),
  ).toBeVisible();
  expect(alerts).toEqual([]);
  await page.reload();
  await expect(
    page.getByText("2 workouts saved", { exact: true }),
  ).toBeVisible();
  let stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lift-journal:v1")!),
  );
  const saved = stored.sessions[0][1];
  expect(Object.keys(saved.sets)).toEqual(["Barbell_Squat"]);
  expect(saved.sets.Barbell_Squat).toEqual([
    { weight: "40", reps: "8" },
    { weight: "", reps: "" },
    { weight: "45", reps: "" },
  ]);
  expect(stored.selections["0:Shoulders"]).toEqual(["Dumbbell_Shoulder_Press"]);
  await page
    .getByRole("button", {
      name: `Edit saved workout ${saved.id} for Barbell Squat`,
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", {
      name: "Edit Barbell_Squat set 3 reps",
      exact: true,
    })
    .fill("6");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(alerts).toEqual([]);
  await page.getByRole("button", { name: "New workout", exact: true }).click();
  await page
    .getByRole("textbox", {
      name: "Dumbbell Shoulder Press set 1 reps",
      exact: true,
    })
    .fill("12");
  await page
    .getByRole("button", { name: "Finish & save workout", exact: true })
    .click();
  await expect(
    page.getByText("3 workouts saved", { exact: true }),
  ).toBeVisible();
  expect(alerts).toEqual([]);
  stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lift-journal:v1")!),
  );
  expect(stored.sessions[0][1].sets.Barbell_Squat[2]).toEqual({
    weight: "45",
    reps: "6",
  });
  expect(stored.sessions[0][2].sets.Dumbbell_Shoulder_Press[0]).toEqual({
    weight: "",
    reps: "12",
  });
  expect(stored.sessions[0][2].sets.Barbell_Squat).toBeUndefined();
});
test("empty workouts and invalid numbers remain blocked without discarding the draft", async ({
  page,
}) => {
  const alerts: string[] = [];
  page.on("dialog", async (d) => {
    alerts.push(d.message());
    await d.accept();
  });
  await page.goto("./");
  await page
    .getByRole("button", { name: "Weight-lifting", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finish & save workout", exact: true })
    .click();
  expect(alerts[0]).toContain("at least one");
  await page
    .getByRole("button", { name: "+ Exercise", exact: true })
    .nth(1)
    .click();
  await page
    .getByRole("textbox", { name: "Search exercises", exact: true })
    .fill("Dumbbell Shoulder Press");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Dumbbell Shoulder Press/ })
    .click();
  await page
    .getByRole("textbox", {
      name: "Dumbbell Shoulder Press set 1 weight in kilograms",
      exact: true,
    })
    .fill("-4");
  await page
    .getByRole("button", { name: "Finish & save workout", exact: true })
    .click();
  expect(alerts[1]).toContain("Check the values");
  const d = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lift-journal:v1")!),
  );
  expect(d.sessions[0]).toBeUndefined();
  expect(d.drafts[0].sets.Dumbbell_Shoulder_Press[0].weight).toBe("-4");
});
