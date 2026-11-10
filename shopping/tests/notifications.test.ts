import test from "node:test";
import assert from "node:assert/strict";
import {
  detectAdditions,
  listAddedMessage,
  mergeNotices,
} from "../lib/notifications.ts";
import { applyAction } from "../lib/localActions.ts";
import { emptyData, type Data, type List, type Item } from "../lib/model.ts";
const list: List = {
  id: "list-a",
  name: "הרשימה שלנו",
  date: "2026-11-12",
  status: "planned",
  version: 1,
  created_at: "2026-11-11T10:00:00.000Z",
};
const item: Item = {
  id: "item-a",
  list_id: list.id,
  product_id: "starter-0-0",
  name: "מלפפונים",
  category: "ירקות",
  emoji: "🥒",
  quantity: 1.5,
  unit: "קילוגרמים",
  checked: false,
  version: 1,
};
test("Finish without receipt preserves items and quantities, creates no prices, and is idempotent", () => {
  const original: Data = { ...emptyData, lists: [list], items: [item] };
  const next = applyAction(original, {
    type: "completeList",
    id: list.id,
    expected: 1,
  });
  assert.equal(next.lists[0].status, "completed");
  assert.deepEqual(next.items, original.items);
  assert.equal(next.items[0].checked, false);
  assert.deepEqual(next.receipts, []);
  assert.deepEqual(
    applyAction(next, { type: "completeList", id: list.id, expected: 1 }),
    next,
  );
  assert.throws(
    () =>
      applyAction(original, { type: "completeList", id: list.id, expected: 2 }),
    /השתנתה/,
  );
});
test("List notices name Moani and use the selected date rather than assuming Thursday", () => {
  const now = new Date(2026, 10, 11, 12);
  assert.match(listAddedMessage(list, now), /מואני.*לחמישי הקרוב/);
  assert.doesNotMatch(
    listAddedMessage({ ...list, date: "2026-11-15" }, now),
    /לחמישי הקרוב/,
  );
});
test("Remote additions batch by list and unchanged snapshots never duplicate notices", () => {
  const before = { ...emptyData, lists: [list] };
  const next = {
    ...before,
    items: [item, { ...item, id: "b" }, { ...item, id: "c" }],
  };
  const n = detectAdditions(before, next, new Set(), 1000);
  assert.equal(n.length, 1);
  assert.equal(n[0].count, 3);
  assert.match(n[0].title, /מואני.*3 מוצרים/);
  assert.equal(detectAdditions(next, next, new Set()).length, 0);
  const newer = { ...next, items: [...next.items, { ...item, id: "d" }] };
  const merged = mergeNotices(n, detectAdditions(next, newer, new Set(), 2000));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].count, 4);
});
test("Own additions are suppressed, while updates and removals are not mislabeled as new products", () => {
  const before = { ...emptyData, lists: [list] };
  assert.equal(
    detectAdditions(
      before,
      { ...before, items: [item] },
      new Set([`item:${item.id}`]),
    ).length,
    0,
  );
  assert.equal(
    detectAdditions(
      { ...before, items: [item] },
      { ...before, items: [{ ...item, checked: true, quantity: 2 }] },
      new Set(),
    ).length,
    0,
  );
  assert.equal(
    detectAdditions({ ...before, items: [item] }, before, new Set()).length,
    0,
  );
  const notices = detectAdditions(
    emptyData,
    { ...before, items: [item] },
    new Set(),
  );
  assert.equal(notices.length, 1);
  assert.equal(notices[0].kind, "list");
});
