import { test, expect } from "@playwright/test";
test("lifting history, day isolation, cardio and local persistence", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("Lift Journal", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "+ Exercise", exact: true })
    .nth(1)
    .click();
  await page
    .getByRole("textbox", { name: "Search exercises" })
    .fill("Dumbbell Shoulder Press");
  await page.getByRole("button", { name: /Dumbbell Shoulder Press/ }).click();
  for (let i = 1; i <= 3; i++) {
    await page
      .getByRole("textbox", {
        name: `Dumbbell Shoulder Press set ${i} weight in kilograms`,
        exact: true,
      })
      .fill("12.5");
    await page
      .getByRole("textbox", {
        name: `Dumbbell Shoulder Press set ${i} reps`,
        exact: true,
      })
      .fill(String(13 - i));
  }
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Finish & save workout" }).click();
  await expect(page.getByText("1 workouts saved")).toBeVisible();
  await expect(page.getByText("12.5 × 12", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("12.5 × 12", { exact: true })).toBeVisible();
  await page
    .getByText("Dumbbell Shoulder Press", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/lift-journal-workout.png" });
  await page.getByText("Chest + Biceps Day", { exact: true }).click();
  await expect(
    page.getByText("Dumbbell Shoulder Press", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cardio", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Cardio duration in minutes" })
    .fill("30");
  await page
    .getByRole("textbox", { name: "Cardio distance in kilometers" })
    .fill("2.5");
  await page
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await expect(page.getByText(/30 min · 2.5 km/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Cardio", exact: true }).click();
  await expect(page.getByText(/30 min · 2.5 km/)).toBeVisible();
});
test("mobile screen fits viewport and produces screenshot", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("Lift Journal", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/lift-journal-mobile.png",
    fullPage: true,
  });
});

test("website reopens offline after the app shell is cached", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await expect(page.getByText("Lift Journal", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let n = 0; n < 50 && !navigator.serviceWorker.controller; n++)
      await new Promise((r) => setTimeout(r, 100));
    if (!navigator.serviceWorker.controller)
      throw Error("Offline worker did not take control");
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Lift Journal", { exact: true })).toBeVisible();
  await context.setOffline(false);
});
