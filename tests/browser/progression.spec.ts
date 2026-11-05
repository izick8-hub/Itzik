import { test, expect } from "@playwright/test";
test("next loads rise for pyramid sets and exercise-specific equipment settings persist", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("lift-journal:v1"))
      localStorage.setItem(
        "lift-journal:v1",
        JSON.stringify({
          selections: { "0:Legs": ["Thigh_Abductor"] },
          sessions: {
            0: [
              {
                id: "last",
                date: "2026-11-02T10:00:00Z",
                sets: {
                  Thigh_Abductor: [
                    { weight: "73", reps: "10" },
                    { weight: "91", reps: "8" },
                    { weight: "91", reps: "8" },
                  ],
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
  const first = page.getByRole("textbox", {
    name: "Thigh Abductor set 1 weight in kilograms",
    exact: true,
  });
  const second = page.getByRole("textbox", {
    name: "Thigh Abductor set 2 weight in kilograms",
    exact: true,
  });
  await expect(first).toHaveValue("");
  await expect(first).toHaveAttribute("placeholder", "75.5");
  await expect(second).toHaveAttribute("placeholder", "93.5");
  await page.locator(".progression-plan summary").click();
  await page
    .getByRole("textbox", {
      name: "Weight increment for Thigh Abductor",
      exact: true,
    })
    .fill("5");
  await page
    .getByRole("textbox", {
      name: "Rep target for Thigh Abductor",
      exact: true,
    })
    .fill("10");
  await page
    .getByRole("button", { name: "Save progression settings", exact: true })
    .click();
  await expect(first).toHaveAttribute("placeholder", "78");
  await expect(second).toHaveAttribute("placeholder", "96");
  await expect(first).toHaveValue("");
  await expect(
    page.getByText("Progression settings saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(first).toHaveAttribute("placeholder", "78");
  await first.fill("78");
  await expect(
    page.getByText("Set 1: +6.8% weight vs last workout", { exact: true }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lift-journal:v1")!),
  );
  expect(stored.progressionSettings.Thigh_Abductor).toEqual({
    repTarget: 10,
    increment: 5,
  });
  expect(stored.sessions[0][0].sets.Thigh_Abductor[0].weight).toBe("73");
  expect(stored.drafts[0].sets.Thigh_Abductor[1].weight).toBe("");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
