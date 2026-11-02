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

test('saved workouts can be edited, cancelled and deleted without changing drafts or other workouts', async ({page}) => {
  const sets = [{weight:'40',reps:'12'},{weight:'40',reps:'10'},{weight:'40',reps:'8'}];
  const saved = {id:'saved-one',date:'2026-11-01T10:00:00.000Z',sets:{Dumbbell_Shoulder_Press:sets,Barbell_Squat:sets}};
  await page.goto('./');
  await page.evaluate(({saved,sets}) => localStorage.setItem('lift-journal:v1',JSON.stringify({selections:{'0:Shoulders':['Dumbbell_Shoulder_Press'],'0:Legs':['Barbell_Squat']},sessions:{0:[saved,{...saved,id:'saved-two'}],1:[{...saved,id:'other-day'}]},drafts:{0:{id:'draft',date:'2026-11-02T10:00:00.000Z',sets:{Dumbbell_Shoulder_Press:sets}}},cardio:[]})), {saved,sets});
  await page.reload();
  const edit = page.getByRole('button',{name:'Edit saved workout saved-one for Dumbbell Shoulder Press',exact:true});
  await edit.click();
  const weight=page.getByRole('textbox',{name:'Edit Dumbbell_Shoulder_Press set 1 weight in kilograms',exact:true});
  await weight.fill('99');
  await page.getByRole('button',{name:'Cancel editing',exact:true}).click();
  await edit.click();await expect(weight).toHaveValue('40');
  await weight.fill('42.5');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByText('42.5 × 12',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByText('42.5 × 12',{exact:true})).toBeVisible();
  const remove=page.getByRole('button',{name:'Delete saved workout saved-one for Dumbbell Shoulder Press',exact:true});
  await remove.click();await page.getByRole('button',{name:'Keep workout',exact:true}).click();
  await expect(page.getByText('2 workouts saved',{exact:true})).toBeVisible();
  await remove.click();await page.getByRole('button',{name:'Delete workout',exact:true}).click();
  await expect(page.getByText('1 workouts saved',{exact:true})).toBeVisible();
  await expect(page.getByText('42.5 × 12',{exact:true})).toHaveCount(0);
  await page.reload();await expect(page.getByText('1 workouts saved',{exact:true})).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('lift-journal:v1')!));
  expect(stored.sessions[0].map((s:any)=>s.id)).toEqual(['saved-two']);
  expect(stored.sessions[1][0].id).toBe('other-day');
  expect(stored.drafts[0].sets.Dumbbell_Shoulder_Press[0].weight).toBe('40');
});
