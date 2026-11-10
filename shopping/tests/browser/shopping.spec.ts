import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
test("Hebrew local shopping journey, persistence, receipt review and duplication", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "הכי כיף לקנות ביחד." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page
    .getByRole("button", { name: "רשימת קניות חדשה", exact: true })
    .click();
  await page.getByLabel("איך נקרא לקנייה?").fill("חמישי עם אהבה");
  await page.getByLabel("מתי קונים?").fill("2026-11-12");
  await page.getByRole("button", { name: "יש לנו דייט בסופר ♡" }).click();
  await page.getByRole("button", { name: "הוספת מוצר", exact: true }).click();
  await page.getByRole("textbox", { name: "חיפוש מוצר" }).fill("מלפ");
  await page.getByRole("button", { name: "🥒 מלפפונים ירקות" }).click();
  await page.getByLabel("כמות", { exact: true }).fill("1.5");
  await page.getByRole("button", { name: "להוסיף לרשימה" }).click();
  await page.getByRole("button", { name: "סגירה", exact: true }).click();
  await expect(page.getByText("1.5 ק״ג", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "סימון נאסף: מלפפונים", exact: true })
    .click();
  await expect(
    page.getByText("1 מתוך 1 מוצרים בעגלה", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "הרשימה", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ביטול סימון: מלפפונים" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "עריכת מלפפונים" }).click();
  await page.getByLabel("כמות", { exact: true }).fill("2");
  await page.getByRole("button", { name: "עדכון המוצר" }).click();
  await expect(page.getByText("2 ק״ג", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "סיימנו לקנות! העלאת קבלה 📸" })
    .click();
  await page.getByRole("button", { name: "הזנת קבלה ידנית" }).click();
  await page.getByRole("button", { name: "הוספת שורה מהקבלה" }).click();
  await page.getByLabel("שם בקבלה").fill("מלפפונים");
  await page
    .getByLabel("התאמה למוצר ברשימה או בקטלוג")
    .selectOption("starter-0-0");
  await page.getByLabel("כמות", { exact: true }).fill("2");
  await page
    .getByRole("combobox", { name: "יחידה", exact: true })
    .selectOption("קילוגרמים");
  await page.getByLabel("מחיר יחידה ₪").fill("9.9");
  await page.getByLabel("סופי לשורה ₪").fill("19.8");
  await page.getByLabel("סכום כולל בקבלה ₪").fill("19.8");
  await page.getByRole("button", { name: "בדקנו, שומרים את הקבלה" }).click();
  await expect(page.locator(".error-banner")).toContainText(
    "אשרו את בדיקת כל השורות",
  );
  await page.getByLabel("בדקתי: השם, הכמות, היחידה והסכום נכונים").check();
  await page.getByRole("button", { name: "בדקנו, שומרים את הקבלה" }).click();
  await expect(page.getByText("קנייה שהושלמה", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "הוצאות ומחירים", exact: true })
    .click();
  await expect(page.locator(".price-current")).toContainText("9.90");
  await page.getByRole("button", { name: "הקניות שלנו", exact: true }).click();
  await page.getByRole("button", { name: "שכפול", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "חמישי עם אהבה · שוב ביחד" }),
  ).toBeVisible();
  await page
    .locator(".history-card")
    .filter({
      has: page.getByRole("heading", {
        name: "חמישי עם אהבה · שוב ביחד",
        exact: true,
      }),
    })
    .getByRole("button", { name: "פתיחת רשימה" })
    .click();
  await expect(
    page.getByRole("button", { name: "סימון נאסף: מלפפונים", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2 ק״ג", { exact: true })).toBeVisible();
});
test("Custom product, deletion, backup and truthful cloud status", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "רשימת קניות חדשה", exact: true })
    .click();
  await page.getByRole("button", { name: "יש לנו דייט בסופר ♡" }).click();
  await page.getByRole("button", { name: "הוספת מוצר", exact: true }).click();
  await page.getByText("לא מצאתם? מוסיפים מוצר אישי").click();
  await page.getByLabel("שם המוצר", { exact: true }).fill("העוגיות שלנו");
  await page
    .getByRole("button", { name: "הוספת מוצר אישי", exact: true })
    .click();
  await page.getByRole("button", { name: "להוסיף לרשימה" }).click();
  await page.getByRole("button", { name: "סגירה", exact: true }).click();
  await expect(page.getByText("העוגיות שלנו", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "מחיקת העוגיות שלנו" }).click();
  await expect(page.getByText("העוגיות שלנו", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "הגדרות ושיתוף" }).click();
  await expect(
    page.getByText("אין כרגע חשבונות, גיבוי ענן או סנכרון בין מכשירים."),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "הורדת גיבוי של הנתונים" }).click();
  expect((await download).suggestedFilename()).toContain(".json");
});
test("Responsive layouts, keyboard dialog and absence of runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "רשימת קניות חדשה", exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "רשימת קניות חדשה", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "/tmp/shopping-desktop.png", fullPage: true });
});
test("Offline app shell reopens and local data remain usable", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page
    .getByRole("button", { name: "רשימת קניות חדשה", exact: true })
    .click();
  await page.getByLabel("איך נקרא לקנייה?").fill("רשימה ללא רשת");
  await page.getByRole("button", { name: "יש לנו דייט בסופר ♡" }).click();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "הרשימה", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "רשימה ללא רשת" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "הוספת מוצר", exact: true }).click();
  await page.getByRole("textbox", { name: "חיפוש מוצר" }).fill("חלב");
  await expect(
    page.getByRole("button", { name: "🥛 חלב מוצרי חלב וביצים", exact: true }),
  ).toBeVisible();
});
test("Receipt photo persists privately in this browser and reopens from a draft", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "רשימת קניות חדשה", exact: true })
    .click();
  await page.getByRole("button", { name: "יש לנו דייט בסופר ♡" }).click();
  await page
    .getByRole("button", { name: "סיימנו לקנות! העלאת קבלה 📸" })
    .click();
  await page.getByLabel("העלאת תמונת קבלה").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByAltText("תמונת הקבלה שהעליתם")).toBeVisible();
  await page.getByRole("button", { name: "סגירה", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "הקניות שלנו", exact: true }).click();
  await page.getByRole("button", { name: /טיוטת קבלה/ }).click();
  await expect(page.getByAltText("תמונת הקבלה שהעליתם")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify(localStorage).includes("data:image"),
    ),
  ).toBe(false);
});
test("Two local tabs do not overwrite simultaneous list creation", async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  await Promise.all([page.goto("/"), second.goto("/")]);
  for (const [tab, name] of [
    [page, "רשימה א"],
    [second, "רשימה ב"],
  ] as const) {
    await tab
      .getByRole("button", { name: "רשימת קניות חדשה", exact: true })
      .click();
    await tab.getByLabel("איך נקרא לקנייה?").fill(name);
  }
  await Promise.all([
    page.getByRole("button", { name: "יש לנו דייט בסופר ♡" }).click(),
    second.getByRole("button", { name: "יש לנו דייט בסופר ♡" }).click(),
  ]);
  // A click finishes before the async Web Lock write. Wait for both save confirmations.
  await Promise.all([
    expect(page.getByRole("dialog")).toHaveCount(0),
    expect(second.getByRole("dialog")).toHaveCount(0),
  ]);
  await page.getByRole("button", { name: "הקניות שלנו", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "רשימה א", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "רשימה ב", exact: true }),
  ).toBeVisible();
});
test("Category filtering includes products beyond the initial search limit", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "רשימת קניות חדשה", exact: true })
    .click();
  await page.getByRole("button", { name: "יש לנו דייט בסופר ♡" }).click();
  await page.getByRole("button", { name: "הוספת מוצר", exact: true }).click();
  await page
    .getByRole("button", { name: "מוצרי חלב וביצים", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "🥛 חלב מוצרי חלב וביצים", exact: true }),
  ).toBeVisible();
});
test("Finish without a receipt preserves the purchase and supports a retroactive receipt after creating the next list", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "רשימת קניות חדשה", exact: true })
    .click();
  await page.getByLabel("איך נקרא לקנייה?").fill("הקנייה הישנה");
  await page.getByRole("button", { name: "יש לנו דייט בסופר ♡" }).click();
  await page.getByRole("button", { name: "הוספת מוצר", exact: true }).click();
  await page.getByRole("textbox", { name: "חיפוש מוצר" }).fill("מלפ");
  await page.getByRole("button", { name: "🥒 מלפפונים ירקות" }).click();
  await page.getByLabel("כמות", { exact: true }).fill("1.5");
  await page.getByRole("button", { name: "להוסיף לרשימה" }).click();
  await page.getByRole("button", { name: "סגירה", exact: true }).click();
  await page.getByRole("button", { name: "סיום קנייה ללא קבלה" }).click();
  await expect(page.getByText("קנייה שהושלמה", { exact: true })).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("together-cart:data:v1")!),
  );
  expect(saved.receipts).toHaveLength(0);
  expect(saved.items[0].quantity).toBe(1.5);
  expect(saved.items[0].checked).toBe(false);
  await page.getByRole("button", { name: "רשימה חדשה", exact: true }).click();
  await page.getByLabel("איך נקרא לקנייה?").fill("הקנייה הבאה");
  await page.getByRole("button", { name: "יש לנו דייט בסופר ♡" }).click();
  await page.getByRole("button", { name: "הקניות שלנו", exact: true }).click();
  const old = page.locator(".history-card").filter({
    has: page.getByRole("heading", { name: "הקנייה הישנה", exact: true }),
  });
  await old.getByRole("button", { name: /העלאת קבלה בדיעבד/ }).click();
  await page.getByRole("button", { name: "הזנת קבלה ידנית" }).click();
  await page.getByRole("button", { name: "הוספת שורה מהקבלה" }).click();
  await page.getByLabel("שם בקבלה").fill("מלפפונים");
  await page.getByLabel("סופי לשורה ₪").fill("7");
  await page.getByLabel("סכום כולל בקבלה ₪").fill("7");
  await page.getByLabel("בדקתי: השם, הכמות, היחידה והסכום נכונים").check();
  await page.getByRole("button", { name: "בדקנו, שומרים את הקבלה" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const result = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("together-cart:data:v1")!),
  );
  expect(result.receipts).toHaveLength(1);
  expect(result.receipts[0].list_id).toBe(
    result.lists.find((l: { name: string }) => l.name === "הקנייה הישנה").id,
  );
  expect(
    result.lists.find((l: { name: string }) => l.name === "הקנייה הבאה").status,
  ).toBe("planned");
});
test("Moani artwork and the notification center fit mobile without hiding controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "מואני, הכלבה שלנו" }).first(),
  ).toBeVisible();
  expect((await page.request.get("/moani-atlas.png")).status()).toBe(200);
  await page
    .getByRole("button", { name: "העדכונים של מואני", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "מואני נחה. אין עדכונים חדשים כרגע.",
  );
  await page.getByRole("button", { name: "סגירה", exact: true }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/moani-mobile.png", fullPage: true });
});
test("A bookmarked app detects a real server metadata change through its service worker without deleting data", async ({
  page,
}) => {
  const original = await readFile("out/version.json", "utf8");
  try {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.evaluate(() =>
      localStorage.setItem("bookmark-preservation-fixture", "retained"),
    );
    await writeFile(
      "out/version.json",
      JSON.stringify({ version: "new-release-fixture" }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByText("מואני מצאה גרסה חדשה 🐾", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "רשימת קניות חדשה", exact: true })
      .click();
    await page.getByLabel("איך נקרא לקנייה?").fill("טיוטה לא שמורה");
    await expect(
      page.getByRole("button", { name: "טעינת העדכון", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "סגירה", exact: true }).click();
    await Promise.all([
      page.waitForEvent("framenavigated"),
      page.getByRole("button", { name: "טעינת העדכון", exact: true }).click(),
    ]);
    await expect(
      page.getByRole("heading", { name: "הכי כיף לקנות ביחד." }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("bookmark-preservation-fixture"),
      ),
    ).toBe("retained");
  } finally {
    await writeFile("out/version.json", original);
  }
});
