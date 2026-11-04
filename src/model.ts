export const DAYS = [
  "Legs + Shoulders Day",
  "Chest + Biceps Day",
  "Back + Triceps Day",
] as const;
export const GROUPS = [
  ["Legs", "Shoulders"],
  ["Chest", "Biceps"],
  ["Back", "Triceps"],
];
export type SetEntry = { weight: string; reps: string };
export type Session = {
  id: string;
  date: string;
  sets: Record<string, SetEntry[]>;
};
export type Cardio = {
  id: string;
  activity: string;
  date: string;
  minutes: string;
  distance: string;
};
export type Data = {
  exerciseNames?: Record<string, string>;
  customExercises?: {
    id: string;
    name: string;
    group: string;
    equipment: string | null;
  }[];
  removedExercises?: {
    day: number;
    group: string;
    id: string;
    index: number;
  }[];
  selections: Record<string, string[]>;
  sessions: Record<string, Session[]>;
  drafts: Record<string, Session>;
  cardio: Cardio[];
};
export const emptyData = (): Data => ({
  selections: {},
  sessions: {},
  drafts: {},
  cardio: [],
});
export const newSets = (): SetEntry[] =>
  Array.from({ length: 3 }, () => ({ weight: "", reps: "" }));
export function validSets(sets: SetEntry[]) {
  return (
    sets.length > 0 &&
    sets.every(
      (s) =>
        s.weight.trim() !== "" &&
        Number.isFinite(Number(s.weight)) &&
        Number(s.weight) >= 0 &&
        /^\d+$/.test(s.reps) &&
        Number(s.reps) > 0,
    )
  );
}
export const keyFor = (day: number, group: string) => `${day}:${group}`;
