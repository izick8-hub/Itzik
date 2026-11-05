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
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Dumbbell Shoulder Press/ })
    .click();
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
  await page.waitForFunction(
    () => localStorage.getItem("lift-journal:v1") !== null,
  );
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
  await expect(
    page.locator(".exercise-insight").getByText(/two logged sessions/),
  ).toBeVisible();
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

test("save action stays below exercises and never floats over inputs on a short phone screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 560 });
  await page.goto("./");
  await page
    .getByRole("button", { name: "Weight-lifting", exact: true })
    .click();
  const save = page.getByRole("button", {
    name: "Finish & save workout",
    exact: true,
  });
  expect(
    await page
      .locator(".workout-action")
      .evaluate((e) => getComputedStyle(e).position),
  ).toBe("static");
  await page
    .getByRole("button", { name: "+ Exercise", exact: true })
    .nth(1)
    .click();
  await page
    .getByRole("textbox", { name: "Search exercises" })
    .fill("Dumbbell Shoulder Press");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Dumbbell Shoulder Press/ })
    .click();
  const lastInput = page.getByRole("textbox", {
    name: "Dumbbell Shoulder Press set 3 reps",
    exact: true,
  });
  await lastInput.scrollIntoViewIfNeeded();
  await lastInput.fill("12");
  await expect(lastInput).toHaveValue("12");
  expect(
    await page.evaluate(() => {
      const a = document
        .querySelector(".workout-action")!
        .getBoundingClientRect();
      const c = document
        .querySelector(".exercise-card")!
        .getBoundingClientRect();
      return a.top >= c.bottom;
    }),
  ).toBe(true);
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(save).toBeInViewport();
  expect(
    await save.evaluate((e) => {
      const r = e.getBoundingClientRect();
      const n = document.querySelector(".bottom-nav")!.getBoundingClientRect();
      return r.bottom <= n.top;
    }),
  ).toBe(true);
});

test("touch swipes reach Shoulders and scrolling returns after closing the exercise picker", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 393, height: 650 });
  await page.goto("./");
  await page
    .getByRole("button", { name: "Weight-lifting", exact: true })
    .click();
  expect(
    await page.evaluate(() => getComputedStyle(document.body).overflowY),
  ).not.toBe("hidden");
  const cdp = await context.newCDPSession(page);
  async function swipe() {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 190, y: 510 }],
    });
    for (let y = 490; y >= 150; y -= 20) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 190, y }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  await swipe();
  await swipe();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(150);
  await expect(
    page.getByRole("heading", { name: "Shoulders", exact: true }),
  ).toBeInViewport();
  await page
    .getByRole("button", { name: "+ Exercise", exact: true })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  expect(
    await page.evaluate(() => getComputedStyle(document.body).overflowY),
  ).not.toBe("hidden");
  await page.evaluate(() => window.scrollTo(0, 0));
  await swipe();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});

test("personalized muscle artwork matches each split, loads locally and fits mobile", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Weight-lifting", exact: true })
    .click();
  const splits = [
    ["Legs + Shoulders Day", ["Legs", "Shoulders"]],
    ["Chest + Biceps Day", ["Chest", "Biceps"]],
    ["Back + Triceps Day", ["Back", "Triceps"]],
  ] as const;
  for (const [day, muscles] of splits) {
    await page.getByText(day, { exact: true }).click();
    for (const muscle of muscles) {
      const art = page
        .locator(".muscle-title")
        .getByRole("img", { name: `${muscle} illustration`, exact: true });
      await expect(art).toBeVisible();
      await art.locator("img").evaluate(async (e: HTMLImageElement) => {
        if (!e.complete)
          await new Promise<void>((resolve, reject) => {
            e.onload = () => resolve();
            e.onerror = () => reject(Error("Muscle artwork did not load"));
          });
      });
      expect(
        await art
          .locator("img")
          .evaluate((e: HTMLImageElement) => e.naturalWidth),
      ).toBe(1536);
    }
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Legs + Shoulders Day", { exact: true }).click();
  await page
    .locator(".muscle-header")
    .first()
    .screenshot({ path: "/tmp/lift-personal-icons.png" });
});
