import { test, expect } from "@playwright/test";
test("training dial is tactile and selects the workout that actually opens", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page
    .getByRole("button", { name: "Rotate workout dial", exact: true })
    .click();
  await expect(page.locator(".hero h2")).toHaveText("Chest + Biceps");
  const slider = page.getByRole("slider", {
    name: "Choose workout split",
    exact: true,
  });
  await expect(slider).toHaveValue("1");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".hero h2")).toHaveText("Back + Triceps");
  await page
    .getByRole("button", { name: "Start Workout", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "03 Back + Triceps Day", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("metal body console switches real metrics, respects reduced motion and fits all screens", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  const body = page.getByRole("region", { name: "Body progress", exact: true });
  await expect(body.locator(".body-metrics strong").first()).toContainText(
    "89.7",
  );
  await body.getByRole("button", { name: "Change %", exact: true }).click();
  await expect(body.locator(".body-metrics strong").first()).toContainText(
    "0%",
  );
  await body.getByRole("button", { name: "Snapshot", exact: true }).click();
  await expect(body.locator(".body-metrics strong").first()).toContainText(
    "89.7",
  );
  await expect(body.locator(".orbit-progress").first()).toHaveAttribute(
    "stroke-dasharray",
    "0 100",
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/lift-metal-mobile.png", fullPage: true });
  await body.screenshot({ path: "/tmp/lift-metal-body.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "/tmp/lift-metal-desktop.png",
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".dial-needle")
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
  expect(
    await body
      .locator(".body-metrics>div")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
});
