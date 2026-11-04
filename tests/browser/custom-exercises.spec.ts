import { test, expect } from "@playwright/test";
const savedData = {
  selections: { "0:Shoulders": ["Dumbbell_Shoulder_Press"] },
  sessions: {
    0: [
      {
        id: "previous",
        date: "2026-11-01T10:00:00Z",
        sets: {
          Dumbbell_Shoulder_Press: [
            { weight: "20", reps: "10" },
            { weight: "20", reps: "10" },
            { weight: "20", reps: "10" },
          ],
        },
      },
    ],
  },
  drafts: {},
  cardio: [],
};
test("rename keeps history IDs and custom exercises persist in the picker", async ({
  page,
}) => {
  await page.addInitScript((d) => {
    if (!localStorage.getItem("lift-journal:v1"))
      localStorage.setItem("lift-journal:v1", JSON.stringify(d));
  }, savedData);
  await page.goto("./");
  await page
    .getByRole("button", { name: "Weight-lifting", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Rename Dumbbell Shoulder Press",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Exercise name", exact: true })
    .fill("My seated press");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My seated press", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("20 × 10", { exact: true })).toHaveCount(3);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "My seated press", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ Exercise", exact: true })
    .nth(1)
    .click();
  await page
    .getByRole("button", { name: "Add custom exercise", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Custom exercise name", exact: true })
    .fill("My cable shoulder move");
  await page
    .getByLabel("Custom exercise equipment", { exact: true })
    .selectOption("cable");
  await page
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My cable shoulder move", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "My cable shoulder move", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ Exercise", exact: true })
    .nth(1)
    .click();
  await page
    .getByRole("textbox", { name: "Search exercises", exact: true })
    .fill("My cable shoulder move");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: /My cable shoulder move/ }),
  ).toBeVisible();
  const d = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lift-journal:v1")!),
  );
  expect(d.sessions[0][0].sets.Dumbbell_Shoulder_Press[0].weight).toBe("20");
  expect(d.customExercises[0].group).toBe("Shoulders");
  expect(d.customExercises[0].equipment).toBe("cable");
});
test("exercise photos are served locally and viewed photos reopen offline", async ({
  page,
  context,
}) => {
  await page.addInitScript((d) => {
    if (!localStorage.getItem("lift-journal:v1"))
      localStorage.setItem("lift-journal:v1", JSON.stringify(d));
  }, savedData);
  await page.goto("./");
  await page
    .getByRole("button", { name: "Weight-lifting", exact: true })
    .click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++)
      await new Promise((r) => setTimeout(r, 100));
  });
  await page.reload();
  const image = page.locator(
    '.exercise-card img[alt="Dumbbell Shoulder Press demonstration"]',
  );
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveJSProperty("complete", true);
  await expect(image).not.toHaveJSProperty("naturalWidth", 0);
  expect(await image.getAttribute("src")).toMatch(/^exercise-photos\//);
  await page.waitForFunction(async () => {
    const c = await caches.open("lift-journal-photos-v1");
    return (await c.keys()).some((r) => r.url.includes("/exercise-photos/"));
  });
  await context.setOffline(true);
  await page.reload();
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveJSProperty("complete", true);
  await expect(image).not.toHaveJSProperty("naturalWidth", 0);
  await context.setOffline(false);
});
test.describe("photo retry", () => {
  test.use({ serviceWorkers: "block" });
  test("failed photos have a working Retry button", async ({ page }) => {
    await page.addInitScript((d) => {
      localStorage.setItem("lift-journal:v1", JSON.stringify(d));
    }, savedData);
    let first = true;
    await page.route("**/exercise-photos/**", async (route) => {
      if (first) {
        first = false;
        await route.fulfill({ status: 503, body: "Temporary failure" });
      } else await route.continue();
    });
    await page.goto("./");
    await page
      .getByRole("button", { name: "Weight-lifting", exact: true })
      .click();
    const retry = page.getByRole("button", {
      name: "Retry photo for Dumbbell Shoulder Press",
      exact: true,
    });
    await retry.scrollIntoViewIfNeeded();
    await retry.click();
    const image = page.locator(
      '.exercise-card img[alt="Dumbbell Shoulder Press demonstration"]',
    );
    await expect(image).toHaveJSProperty("complete", true);
    await expect(image).not.toHaveJSProperty("naturalWidth", 0);
  });
});
