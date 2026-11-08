// UI regression tests use an HTTP fixture. Real SQL/RLS is tested separately by test:postgres.
import { test, expect, type Page } from "@playwright/test";
import { emptyData, type Data } from "../../lib/model";
import { applyAction, type Action } from "../../lib/localActions";
const hid = "10000000-0000-4000-8000-000000000000",
  user = "00000000-0000-4000-8000-000000000001";
const local: Data = {
  ...emptyData,
  lists: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      name: "הרשימה המקומית החשובה",
      date: "2026-11-12",
      status: "planned",
      version: 1,
      created_at: "2026-11-08T10:00:00.000Z",
    },
  ],
  items: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      list_id: "10000000-0000-4000-8000-000000000001",
      product_id: "starter-0-0",
      name: "מלפפונים",
      category: "ירקות",
      emoji: "🥒",
      quantity: 1.5,
      unit: "קילוגרמים",
      checked: false,
      version: 1,
    },
  ],
};
async function fixture(page: Page, { fail = false, missing = false } = {}) {
  let data: Data = structuredClone(emptyData),
    imports = 0,
    commits = 0;
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    { alg: "HS256", typ: "JWT" },
    { sub: user, role: "authenticated", aud: "authenticated", exp },
    "fixture",
  ]
    .map((v, i) =>
      i < 2 ? Buffer.from(JSON.stringify(v)).toString("base64url") : v,
    )
    .join(".");
  await page.addInitScript(
    ({ token, exp, user, local }) => {
      localStorage.setItem(
        "sb-cloud-fixture-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: user,
            aud: "authenticated",
            role: "authenticated",
            email: "fixture@example.invalid",
          },
        }),
      );
      if (!localStorage.getItem("together-cart:data:v1"))
        localStorage.setItem("together-cart:data:v1", JSON.stringify(local));
    },
    { token, exp, user, local },
  );
  await page.route("https://cloud-fixture.supabase.co/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    let response: unknown = {};
    let status = 200;
    if (path.includes("shopping_members")) response = { household_id: hid };
    else if (path.includes("shopping_snapshot")) {
      if (missing) {
        status = 404;
        response = { code: "PGRST202", message: "missing fixture function" };
      } else response = { household_id: hid, ...data };
    } else if (path.includes("shopping_commit")) {
      commits++;
      if (fail) {
        status = 403;
        response = { code: "42501", message: "fixture denied" };
      } else {
        data = applyAction(data, body.action as Action);
        response = { household_id: hid, ...data };
      }
    } else if (path.includes("shopping_import_local")) {
      imports++;
      for (const l of body.payload.lists)
        if (!data.lists.some((c) => c.id === l.id)) data.lists.push(l);
      for (const i of body.payload.items)
        if (!data.items.some((c) => c.id === i.id)) data.items.push(i);
      response = { household_id: hid, ...data };
    } else if (path.includes("/auth/v1/user")) response = { id: user };
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
  return {
    get imports() {
      return imports;
    },
    get commits() {
      return commits;
    },
    get data() {
      return data;
    },
  };
}
test("Failed cloud save is visible and does not show success or modify local records", async ({
  page,
}) => {
  const f = await fixture(page, { fail: true });
  await page.goto("/");
  await page
    .getByRole("button", { name: "רשימת קניות חדשה", exact: true })
    .click();
  const before = await page.evaluate(() =>
    localStorage.getItem("together-cart:data:v1"),
  );
  await page.getByRole("button", { name: "יש לנו דייט בסופר ♡" }).click();
  await expect(page.locator(".error-banner")).toContainText("42501");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".toast")).toHaveCount(0);
  expect(f.commits).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem("together-cart:data:v1")),
  ).toBe(before);
});
test("Import requires confirmation, keeps local bytes, and repeated import has no duplicates", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: "הגדרות ושיתוף" }).click();
  await expect(
    page.getByRole("heading", { name: "בית משותף בענן" }),
  ).toBeVisible();
  const button = page.getByRole("button", {
    name: "ייבוא הרשימות שבחרנו לענן",
  });
  await expect(button).toBeDisabled();
  expect(f.imports).toBe(0);
  const before = await page.evaluate(() =>
    localStorage.getItem("together-cart:data:v1"),
  );
  await page.getByLabel(/הרשימה המקומית החשובה/).check();
  await expect(button).toBeDisabled();
  await page
    .getByLabel("אני מאשר להעתיק את הרשימות שבחרתי לבית המשותף בענן")
    .check();
  await button.click();
  await expect(page.locator(".toast")).toContainText("הייבוא אושר");
  expect(f.data.items.length).toBe(1);
  await page.getByLabel(/הרשימה המקומית החשובה/).check();
  await page
    .getByLabel("אני מאשר להעתיק את הרשימות שבחרתי לבית המשותף בענן")
    .check();
  await button.click();
  await expect.poll(() => f.imports).toBe(2);
  expect(f.data.lists.length).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem("together-cart:data:v1")),
  ).toBe(before);
});
test("Missing migration blocks cloud use instead of presenting a ready household", async ({
  page,
}) => {
  await fixture(page, { missing: true });
  await page.goto("/");
  await expect(page.locator(".error-banner")).toContainText("202611080001");
  await page.getByRole("button", { name: "סגירת הודעה", exact: true }).click();
  await page.getByRole("button", { name: "הגדרות ושיתוף" }).click();
  await expect(
    page.getByRole("heading", { name: "החיבור לענן עדיין לא מוכן" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "בית משותף בענן" }),
  ).toHaveCount(0);
});
