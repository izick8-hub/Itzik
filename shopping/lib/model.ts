import type { Product, Unit } from "./catalog.ts";
export type List = {
  id: string;
  household_id?: string;
  name: string;
  date: string;
  status: "planned" | "shopping" | "completed";
  version: number;
  created_at: string;
};
export type Item = {
  id: string;
  list_id: string;
  product_id: string;
  name: string;
  category: string;
  emoji: string;
  quantity: number;
  unit: Unit;
  checked: boolean;
  version: number;
};
export type ReceiptLine = {
  id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit: Unit;
  unit_price: number;
  total: number;
  discount: number;
  uncertain: boolean;
};
export type Receipt = {
  version?: number;
  id: string;
  list_id: string;
  date: string;
  store: string;
  total: number;
  status: "draft" | "confirmed";
  lines: ReceiptLine[];
  image_path?: string;
  created_at: string;
};
export type Data = {
  lists: List[];
  items: Item[];
  products: Product[];
  receipts: Receipt[];
};
export const emptyData: Data = {
  lists: [],
  items: [],
  products: [],
  receipts: [],
};
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function nextThursday(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7));
  return localDate(d);
}
export function progress(items: Item[]) {
  const done = items.filter((i) => i.checked).length;
  return {
    done,
    total: items.length,
    percent: items.length ? Math.round((done / items.length) * 100) : 0,
  };
}
export function duplicateList(
  list: List,
  items: Item[],
  date: string,
  uuid: () => string = () => crypto.randomUUID(),
) {
  const id = uuid();
  return {
    list: {
      ...list,
      id,
      name: `${list.name} · שוב ביחד`.slice(0, 100),
      date,
      status: "planned" as const,
      version: 1,
      created_at: new Date().toISOString(),
    },
    items: items
      .filter((i) => i.list_id === list.id)
      .map((i) => ({
        ...i,
        id: uuid(),
        list_id: id,
        checked: false,
        version: 1,
      })),
  };
}
export function priceHistory(
  receipts: Receipt[],
  productId: string,
  unit: Unit,
) {
  return receipts
    .filter((r) => r.status === "confirmed")
    .flatMap((r) =>
      r.lines
        .filter(
          (l) =>
            l.product_id === productId && l.unit === unit && l.quantity > 0,
        )
        .map((l) => ({
          date: r.date,
          price: Math.round((l.total / l.quantity) * 100) / 100,
          unit,
          receiptId: r.id,
        })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function monthlyTotal(
  receipts: Receipt[],
  month = localDate().slice(0, 7),
) {
  return (
    Math.round(
      receipts
        .filter((r) => r.status === "confirmed" && r.date.startsWith(month))
        .reduce((n, r) => n + r.total, 0) * 100,
    ) / 100
  );
}
export function validateReceipt(r: Pick<Receipt, "date" | "total" | "lines">) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
    !Number.isFinite(r.total) ||
    r.total < 0 ||
    !r.lines.length
  )
    return "צריך תאריך, סכום ולפחות מוצר אחד.";
  if (
    r.lines.some(
      (l) =>
        !l.name.trim() ||
        ![l.quantity, l.total, l.unit_price, l.discount].every(
          Number.isFinite,
        ) ||
        l.quantity <= 0 ||
        l.quantity > 100000 ||
        l.total < 0 ||
        l.unit_price < 0 ||
        l.discount < 0,
    )
  )
    return "בדקו את השמות, הכמויות והמחירים בכל שורה.";
  if (Math.abs(r.lines.reduce((n, l) => n + l.total, 0) - r.total) > 0.05)
    return "סכום השורות צריך להתאים לסכום הקבלה. בדקו את ההנחות והמחירים הסופיים לפני האישור.";
  return null;
}
export function quantityText(quantity: number, unit: Unit) {
  return `${quantity} ${{ יחידות: "יח׳", גרמים: "גרם", קילוגרמים: "ק״ג", ליטרים: "ליטר", מיליליטרים: "מ״ל", אריזות: "אריזות" }[unit]}`;
}
