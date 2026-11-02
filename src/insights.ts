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
export function progression(sets: SetEntry[], equipment: string | null) {
  if (!sets.length) return "Log a session to build your baseline.";
  const weights = sets.map((s) => Number(s.weight));
  if (weights.some((w) => w <= 0) || equipment === "body only")
    return "Aim for one more controlled rep before adding resistance.";
  if (!weights.every((w) => w === weights[0]))
    return "Repeat your set-by-set loads and aim for one more controlled rep.";
  if (sets.every((s) => Number(s.reps) >= 12))
    return `Consider a 2.5–5% increase (about ${(weights[0] * 1.025).toFixed(1)}–${(weights[0] * 1.05).toFixed(1)} kg), only if every set felt controlled. Use the smallest available increment.`;
  return "Keep the same weight and aim for one more rep on a set, with controlled technique.";
}
