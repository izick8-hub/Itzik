import {
  duplicateList,
  type Data,
  type List,
  type Item,
  type Receipt,
} from "./model.ts";
import type { Product } from "./catalog.ts";
export type Action =
  | { type: "list"; value: List }
  | { type: "item"; value: Item; expected?: number }
  | { type: "deleteItem"; id: string; expected: number }
  | { type: "product"; value: Product }
  | { type: "receipt"; value: Receipt }
  | { type: "confirmReceipt"; value: Receipt }
  | { type: "duplicate"; id: string; date: string }
  | { type: "completeList"; id: string; expected: number };
export function applyAction(data: Data, action: Action): Data {
  const upsert = <T extends { id: string }>(rows: T[], value: T) => [
    ...rows.filter((r) => r.id !== value.id),
    value,
  ];
  switch (action.type) {
    case "completeList": {
      const list = data.lists.find((l) => l.id === action.id);
      if (!list) throw Error("הרשימה לא נמצאה.");
      if (list.status === "completed") return data;
      if (list.version !== action.expected)
        throw Error("הרשימה השתנתה. רעננו ונסו שוב.");
      return {
        ...data,
        lists: data.lists.map((l) =>
          l.id === list.id
            ? { ...l, status: "completed", version: l.version + 1 }
            : l,
        ),
      };
    }
    case "list": {
      const old = data.lists.find((l) => l.id === action.value.id);
      if (old && old.version !== action.value.version)
        throw Error("הרשימה השתנתה. נסו שוב.");
      return {
        ...data,
        lists: upsert(data.lists, {
          ...action.value,
          version: old ? old.version + 1 : 1,
        }),
      };
    }
    case "item": {
      const existing = data.items.find((i) => i.id === action.value.id);
      if (
        (existing && existing.version !== action.expected) ||
        (!existing && action.expected !== undefined)
      )
        throw Error("המוצר השתנה. הרשימה עודכנה; נסו שוב.");
      return {
        ...data,
        items: upsert(data.items, {
          ...action.value,
          version: (existing?.version || 0) + 1,
        }),
      };
    }
    case "deleteItem": {
      const existing = data.items.find((i) => i.id === action.id);
      if (existing && existing.version !== action.expected)
        throw Error("המוצר השתנה. נסו שוב.");
      return { ...data, items: data.items.filter((i) => i.id !== action.id) };
    }
    case "product":
      return { ...data, products: upsert(data.products, action.value) };
    case "receipt": {
      const old = data.receipts.find((r) => r.id === action.value.id);
      if (old?.status === "confirmed")
        throw Error("קבלה מאושרת אינה ניתנת לשינוי.");
      if (old && (old.version || 1) !== (action.value.version || 1))
        throw Error("הטיוטה השתנתה. פתחו אותה מחדש.");
      return {
        ...data,
        receipts: upsert(data.receipts, {
          ...action.value,
          version: old ? (old.version || 1) + 1 : 1,
        }),
      };
    }
    case "confirmReceipt":
      if (
        data.receipts.some(
          (r) =>
            r.id === action.value.id &&
            (r.status === "confirmed" ||
              (r.version || 1) !== (action.value.version || 1)),
        )
      )
        throw Error("הקבלה כבר אושרה.");
      return {
        ...data,
        receipts: upsert(data.receipts, {
          ...action.value,
          status: "confirmed",
        }),
        lists: data.lists.map((l) =>
          l.id === action.value.list_id
            ? { ...l, status: "completed", version: l.version + 1 }
            : l,
        ),
      };
    case "duplicate": {
      const original = data.lists.find((l) => l.id === action.id);
      if (!original) throw Error("הרשימה לא נמצאה");
      const copy = duplicateList(original, data.items, action.date);
      return {
        ...data,
        lists: [...data.lists, copy.list],
        items: [...data.items, ...copy.items],
      };
    }
  }
}
