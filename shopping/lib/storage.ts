import { z } from "zod";
import { units } from "./catalog";
import type { Data } from "./model";
const unit = z.enum(units),
  id = z.string().min(1).max(200),
  text = z.string().min(1).max(200);
const product = z.object({
  id,
  name: text,
  category: text,
  unit,
  emoji: z.string().max(16),
  source: z.enum(["starter", "personal", "import"]),
});
const list = z.object({
  id,
  name: text,
  date: z.iso.date(),
  status: z.enum(["planned", "shopping", "completed"]),
  version: z.number().int().positive(),
  created_at: z.iso.datetime(),
  household_id: z.string().optional(),
});
const item = z.object({
  id,
  list_id: id,
  product_id: id,
  name: text,
  category: text,
  emoji: z.string().max(16),
  quantity: z.number().positive().max(100000),
  unit,
  checked: z.boolean(),
  version: z.number().int().positive(),
});
const line = z.object({
  id,
  product_id: id.nullable(),
  name: text,
  quantity: z.number().positive().max(100000),
  unit,
  unit_price: z.number().nonnegative().max(1000000),
  total: z.number().nonnegative().max(1000000),
  discount: z.number().nonnegative().max(1000000),
  uncertain: z.boolean(),
});
const receipt = z.object({
  version: z.number().int().positive().optional(),
  id,
  list_id: id,
  date: z.iso.date(),
  store: text,
  total: z.number().nonnegative().max(1000000),
  status: z.enum(["draft", "confirmed"]),
  lines: z.array(line).max(300),
  image_path: z.string().optional(),
  created_at: z.iso.datetime(),
});
export const backupSchema = z
  .object({
    lists: z.array(list).max(2000),
    items: z.array(item).max(20000),
    products: z.array(product).max(5000),
    receipts: z.array(receipt).max(2000),
  })
  .superRefine((data, ctx) => {
    for (const key of ["lists", "items", "products", "receipts"] as const) {
      if (new Set(data[key].map((x) => x.id)).size !== data[key].length)
        ctx.addIssue({ code: "custom", message: "מזהים כפולים", path: [key] });
    }
    const ids = new Set(data.lists.map((l) => l.id));
    if (
      data.items.some((i) => !ids.has(i.list_id)) ||
      data.receipts.some((r) => !ids.has(r.list_id))
    )
      ctx.addIssue({ code: "custom", message: "קישור לרשימה חסרה" });
  });
const KEY = "together-cart:data:v1";
export function loadLocal(): Data | null {
  const value = localStorage.getItem(KEY);
  return value ? backupSchema.parse(JSON.parse(value)) : null;
}
export function saveLocal(data: Data) {
  localStorage.setItem(KEY, JSON.stringify(backupSchema.parse(data)));
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("together-cart-receipts", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("images");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function storePhoto(id: string, file: Blob) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("images", "readwrite");
    tx.objectStore("images").put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
export async function readPhoto(id: string): Promise<Blob | undefined> {
  const db = await database();
  const result = await new Promise<Blob | undefined>((resolve, reject) => {
    const r = db.transaction("images").objectStore("images").get(id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return result;
}
