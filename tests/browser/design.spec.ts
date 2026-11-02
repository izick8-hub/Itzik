import { test, expect } from "@playwright/test";
test("premium dashboard and logging fit phone, tablet and desktop widths", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "Start Workout", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your story starts here.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.fonts.check("500 16px Inter")),
  ).toBe(true);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/lift-home-new.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "/tmp/lift-desktop-new.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Start Workout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "+ Exercise", exact: true })
    .nth(1)
    .click();
  await page
    .getByRole("textbox", { name: "Search exercises" })
    .fill("Dumbbell Shoulder Press");
  await page.getByRole("button", { name: /Dumbbell Shoulder Press/ }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start Workout", exact: true }),
  ).toBeVisible();
});
test("progress compares real stored sessions and long histories stay within the screen", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(() => {
    const sets = (w: string, r: string) =>
      Array.from({ length: 3 }, () => ({ weight: w, reps: r }));
    localStorage.setItem(
      "lift-journal:v1",
      JSON.stringify({
        selections: { "0:Shoulders": ["Dumbbell_Shoulder_Press"] },
        sessions: {
          0: [
            {
              id: "older",
              date: "2026-10-29T10:00:00.000Z",
              sets: { Dumbbell_Shoulder_Press: sets("10", "12") },
            },
            {
              id: "latest",
              date: "2026-11-01T10:00:00.000Z",
              sets: { Dumbbell_Shoulder_Press: sets("12", "12") },
            },
          ],
        },
        drafts: {},
        cardio: [],
      }),
    );
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Weight-lifting", exact: true })
    .click();
  await expect(
    page.getByText("+20% mean weight", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(/Consider a 2.5–5% increase/)).toBeVisible();
  await page
    .getByRole("button", {
      name: "Older workout for Dumbbell Shoulder Press",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Edit saved workout older for Dumbbell Shoulder Press",
      exact: true,
    }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".exercise-card")
    .screenshot({ path: "/tmp/lift-exercise-new.png" });
});
