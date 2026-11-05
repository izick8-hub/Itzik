import type { Data, Session, SetEntry } from "./model";
export const volume = (sets: SetEntry[]) =>
  sets.reduce((sum, s) => sum + Number(s.weight) * Number(s.reps), 0);
const localDay = (date: string) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
export function summary(data: Data, now = new Date()) {
  const sessions = Object.entries(data.sessions)
    .flatMap(([day, items]) => items.map((s) => ({ ...s, day: Number(day) })))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const dates = new Set(sessions.map((s) => localDay(s.date)));
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  if (!dates.has(localDay(cursor.toISOString())))
    cursor.setDate(cursor.getDate() - 1);
  while (dates.has(localDay(cursor.toISOString()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    sessions,
    count: sessions.length,
    streak,
    totalVolume: sessions.reduce(
      (n, s) =>
        n + Object.values(s.sets).reduce((v, sets) => v + volume(sets), 0),
      0,
    ),
    nextDay: sessions.length ? (sessions[0].day + 1) % 3 : 0,
  };
}
export function comparison(latest: SetEntry[], previous: SetEntry[]) {
  // Compare mean load and total reps only when set counts match.
  if (!latest.length || latest.length !== previous.length) return null;
  const mean = (s: SetEntry[]) =>
    s.reduce((n, x) => n + Number(x.weight), 0) / s.length;
  const reps = (s: SetEntry[]) => s.reduce((n, x) => n + Number(x.reps), 0);
  const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
  return {
    weight: pct(mean(latest), mean(previous)),
    reps: pct(reps(latest), reps(previous)),
  };
}
export { progression } from "./progression.ts";
