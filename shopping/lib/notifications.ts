import { nextThursday, type Data, type List } from "./model.ts";
export type ShoppingNotice = {
  id: string;
  kind: "list" | "items";
  list_id: string;
  title: string;
  body: string;
  count: number;
  created_at: number;
};
export function listAddedMessage(
  list: Pick<List, "date" | "name">,
  now = new Date(),
) {
  const when =
    list.date === nextThursday(now)
      ? "לחמישי הקרוב"
      : `ל${new Date(`${list.date}T12:00:00`).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}`;
  return `מואני מעדכנת: רשימה חדשה נוספה ${when} 🐾`;
}
export function itemAddedMessage(count: number) {
  return count === 1
    ? "מואני מעדכנת: נוסף מוצר חדש לרשימה 🐾"
    : `מואני מעדכנת: נוספו ${count} מוצרים חדשים לרשימה 🐾`;
}
export function detectAdditions(
  previous: Data,
  next: Data,
  own: Set<string>,
  now = Date.now(),
): ShoppingNotice[] {
  const previousLists = new Set(previous.lists.map((l) => l.id)),
    previousItems = new Set(previous.items.map((i) => i.id));
  const addedLists = next.lists.filter((l) => !previousLists.has(l.id));
  const notices: ShoppingNotice[] = addedLists
    .filter((l) => !own.has(`list:${l.id}`))
    .map((l) => ({
      id: `list:${l.id}`,
      kind: "list",
      list_id: l.id,
      title: listAddedMessage(l, new Date(now)),
      body: l.name,
      count: 1,
      created_at: now,
    }));
  const counts = new Map<string, number>();
  for (const item of next.items)
    if (
      !previousItems.has(item.id) &&
      !own.has(`item:${item.id}`) &&
      !addedLists.some((l) => l.id === item.list_id)
    )
      counts.set(item.list_id, (counts.get(item.list_id) || 0) + 1);
  for (const [id, count] of counts) {
    const list = next.lists.find((l) => l.id === id);
    if (list)
      notices.push({
        id: `items:${id}:${now}`,
        kind: "items",
        list_id: id,
        title: itemAddedMessage(count),
        body: list.name,
        count,
        created_at: now,
      });
  }
  return notices;
}
export function mergeNotices(
  current: ShoppingNotice[],
  incoming: ShoppingNotice[],
): ShoppingNotice[] {
  const result = [...current];
  for (const notice of incoming) {
    if (notice.kind === "list" && result.some((n) => n.id === notice.id))
      continue;
    const group =
      notice.kind === "items"
        ? result.findIndex(
            (n) =>
              n.kind === "items" &&
              n.list_id === notice.list_id &&
              notice.created_at - n.created_at < 5000,
          )
        : -1;
    if (group >= 0) {
      const count = result[group].count + notice.count;
      result[group] = {
        ...result[group],
        count,
        title: itemAddedMessage(count),
        created_at: notice.created_at,
      };
    } else result.unshift(notice);
  }
  return result.slice(0, 20);
}
