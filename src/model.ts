import type { ProgressionSettings } from "./progression";
import type { BodyMeasurement, BodyGoals } from "./body";
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
  progressionSettings?: Record<string, ProgressionSettings>;
  bodyMeasurements?: BodyMeasurement[];
  bodyGoals?: BodyGoals;
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

export const hasSetEntry = (set: SetEntry) =>
  set.weight.trim() !== "" || set.reps.trim() !== "";
export function validPartialSets(sets: SetEntry[]) {
  return sets.every(
    (set) =>
      (set.weight.trim() === "" ||
        (Number.isFinite(Number(set.weight)) && Number(set.weight) >= 0)) &&
      (set.reps.trim() === "" ||
        (/^\d+$/.test(set.reps.trim()) && Number(set.reps) > 0)),
  );
}
export function enteredSessionSets(
  ids: string[],
  sets: Record<string, SetEntry[]>,
): Record<string, SetEntry[]> {
  return Object.fromEntries(
    ids
      .filter((id) => (sets[id] || []).some(hasSetEntry))
      .map((id) => [
        id,
        sets[id].map((set) => ({
          weight: set.weight.trim(),
          reps: set.reps.trim(),
        })),
      ]),
  );
}
