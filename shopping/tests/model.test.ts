import test from "node:test";
import assert from "node:assert/strict";
import { catalog, searchProducts } from "../lib/catalog.ts";
import {
  duplicateList,
  monthlyTotal,
  nextThursday,
  priceHistory,
  progress,
  validateReceipt,
  type Item,
  type List,
  type Receipt,
} from "../lib/model.ts";
const list: List = {
  id: "one",
  name: "חמישי שלנו",
  date: "2026-11-05",
  status: "completed",
  version: 1,
  created_at: "2026-11-05T10:00:00.000Z",
};
const item: Item = {
  id: "item",
  list_id: "one",
  product_id: "cucumber",
  name: "מלפפונים",
  category: "ירקות",
  emoji: "🥒",
  quantity: 1.5,
  unit: "קילוגרמים",
  checked: true,
  version: 3,
};
const receipt: Receipt = {
  id: "r1",
  list_id: "one",
  date: "2026-11-05",
  store: "סופר",
  total: 14.85,
  status: "confirmed",
  created_at: list.created_at,
  lines: [
    {
      id: "l",
      product_id: "cucumber",
      name: "מלפ",
      quantity: 1.5,
      unit: "קילוגרמים",
      unit_price: 11,
      total: 14.85,
      discount: 1.65,
      uncertain: false,
    },
  ],
};
test("Thursday selection uses local calendar and retains Thursday itself", () => {
  assert.equal(nextThursday(new Date(2026, 10, 5, 23)), "2026-11-05");
  assert.equal(nextThursday(new Date(2026, 10, 6)), "2026-11-12");
  assert.equal(nextThursday(new Date(2026, 11, 31)), "2026-12-31");
});
test("Hebrew prefix finds cucumbers and catalog provenance is explicit", () => {
  assert.ok(catalog.length > 200);
  assert.ok(searchProducts(catalog, "מלפ").some((p) => p.name === "מלפפונים"));
  assert.ok(catalog.every((p) => p.source === "starter"));
  assert.equal(searchProducts(catalog, "שוםמוצרלאקיים").length, 0);
});
test("Duplication preserves quantities, resets checks and creates distinct identities", () => {
  let n = 0;
  const copy = duplicateList(
    list,
    [item, { ...item, id: "other", list_id: "other" }],
    "2026-11-12",
    () => `id${++n}`,
  );
  assert.equal(copy.list.status, "planned");
  assert.equal(copy.items.length, 1);
  assert.equal(copy.items[0].checked, false);
  assert.equal(copy.items[0].quantity, 1.5);
  assert.equal(copy.items[0].list_id, copy.list.id);
  assert.notEqual(copy.items[0].id, item.id);
  assert.equal(item.checked, true);
});
test("Actual paid unit prices use matching units and confirmed receipts only", () => {
  assert.equal(
    priceHistory(
      [receipt, { ...receipt, id: "r2", status: "draft", total: 1 }],
      "cucumber",
      "קילוגרמים",
    )[0].price,
    9.9,
  );
  assert.equal(priceHistory([receipt], "cucumber", "יחידות").length, 0);
  assert.equal(
    monthlyTotal(
      [receipt, { ...receipt, id: "r2", status: "draft" }],
      "2026-11",
    ),
    14.85,
  );
  assert.equal(monthlyTotal([receipt], "2026-10"), 0);
});
test("Receipt reconciliation rejects missing lines, invalid numbers and unmatched totals", () => {
  assert.equal(validateReceipt(receipt), null);
  assert.ok(validateReceipt({ ...receipt, total: 15 }));
  assert.ok(validateReceipt({ ...receipt, lines: [] }));
  assert.ok(
    validateReceipt({
      ...receipt,
      lines: [{ ...receipt.lines[0], quantity: NaN }],
    }),
  );
});
test("Progress handles an empty list and checked quantities count as one product", () => {
  assert.deepEqual(progress([]), { done: 0, total: 0, percent: 0 });
  assert.deepEqual(progress([item, { ...item, id: "two", checked: false }]), {
    done: 1,
    total: 2,
    percent: 50,
  });
});
