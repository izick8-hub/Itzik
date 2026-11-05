import { test, expect } from "@playwright/test";
test("homepage scan, editable goals and dated weight check-ins persist with accurate progress", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  const body = page.getByRole("region", { name: "Body progress", exact: true });
  await expect(
    body.locator(".body-metrics>div").first().locator("strong"),
  ).toContainText("89.7");
  await body
    .getByText("View November 1 scan · all measurements", { exact: true })
    .click();
  await expect(
    body.getByText("62.75% · 31.5 kg", { exact: true }),
  ).toBeVisible();
  await body.getByRole("button", { name: "Set targets", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Target weight in kilograms", exact: true })
    .fill("80");
  await page
    .getByRole("textbox", { name: "Target body fat percentage", exact: true })
    .fill("18");
  await page.getByRole("button", { name: "Save targets", exact: true }).click();
  await body
    .getByRole("button", { name: "+ Add check-in", exact: true })
    .click();
  await page
    .getByLabel("Body check-in date", { exact: true })
    .fill("2026-11-02");
  await page
    .getByRole("textbox", { name: "Body weight in kilograms", exact: true })
    .fill("88");
  await page
    .getByRole("textbox", { name: "Body fat percentage", exact: true })
    .fill("22");
  await page
    .getByRole("button", { name: "Save check-in", exact: true })
    .click();
  await expect(
    body.getByText("-1.9% since baseline", { exact: true }),
  ).toBeVisible();
  await expect(
    body.getByText("8 kg above target", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    body.getByText("8 kg above target", { exact: true }),
  ).toBeVisible();
  await body.getByText("Check-in history (2)", { exact: true }).click();
  await expect(
    body.getByText("-1.9% weight vs previous check-in", { exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lift-journal:v1")!),
  );
  expect(stored.bodyMeasurements).toHaveLength(2);
  expect(stored.bodyGoals.weight).toBe(80);
});
test("grey weight hints never fill or save values and typing shows live percentage change", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "lift-journal:v1",
      JSON.stringify({
        selections: { "0:Shoulders": ["Dumbbell_Shoulder_Press"] },
        sessions: {
          0: [
            {
              id: "last",
              date: "2026-11-01T10:00:00Z",
              sets: {
                Dumbbell_Shoulder_Press: Array.from({ length: 3 }, () => ({
                  weight: "40",
                  reps: "12",
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
  await page.goto("./");
  await page
    .getByRole("button", { name: "Weight-lifting", exact: true })
    .click();
  const field = page.getByRole("textbox", {
    name: "Dumbbell Shoulder Press set 1 weight in kilograms",
    exact: true,
  });
  await expect(field).toHaveAttribute("placeholder", "41");
  await expect(field).toHaveValue("");
  await field.fill("42");
  await expect(field).toHaveValue("42");
  await expect(
    page.getByText("Set 1: +5% weight vs last workout", { exact: true }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lift-journal:v1")!),
  );
  expect(stored.drafts[0].sets.Dumbbell_Shoulder_Press[0].weight).toBe("42");
  expect(stored.drafts[0].sets.Dumbbell_Shoulder_Press[1].weight).toBe("");
});
