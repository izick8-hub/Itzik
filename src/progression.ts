import type { SetEntry } from "./model";
export type ProgressionSettings = { repTarget: number; increment: number };
export type ExerciseMeta = {
  name?: string;
  originalName?: string;
  equipment: string | null;
  primaryMuscles?: string[];
};
export function defaultProgression(
  exercise: ExerciseMeta,
): ProgressionSettings {
  const lower = exercise.primaryMuscles?.some((m) =>
    ["quadriceps", "hamstrings", "glutes"].includes(m),
  );
  const isolation = /curl|lateral|fly|extension|kickback/i.test(
    exercise.originalName || exercise.name || "",
  );
  return {
    repTarget: 8,
    increment:
      exercise.equipment === "dumbbell"
        ? isolation
          ? 0.5
          : 1
        : exercise.equipment === "barbell"
          ? lower
            ? 5
            : 2.5
          : exercise.equipment === "machine" && lower
            ? 5
            : 2.5,
  };
}
export function settingsFor(
  exercise: ExerciseMeta,
  settings?: ProgressionSettings,
) {
  const defaults = defaultProgression(exercise);
  return {
    repTarget:
      settings && Number.isInteger(settings.repTarget) && settings.repTarget > 0
        ? settings.repTarget
        : defaults.repTarget,
    increment:
      settings && Number.isFinite(settings.increment) && settings.increment > 0
        ? settings.increment
        : defaults.increment,
  };
}
export function nextLoad(
  previous: SetEntry[],
  index: number,
  exercise: ExerciseMeta,
  settings?: ProgressionSettings,
) {
  const old = Number(previous[index]?.weight);
  if (exercise.equipment === "body only" || !Number.isFinite(old) || old <= 0)
    return null;
  const { increment } = settingsFor(exercise, settings);
  const steps = Math.max(1, Math.ceil((old * 0.025) / increment - 1e-9));
  const weight = Math.round((old + steps * increment) * 1000) / 1000;
  const percent = ((weight - old) / old) * 100;
  return { weight, percent, withinRange: percent <= 10 + 1e-8 };
}
export function suggestedWeight(
  previous: SetEntry[],
  index: number,
  equipment: string | null,
  settings?: ProgressionSettings,
  meta?: ExerciseMeta,
) {
  const next = nextLoad(previous, index, meta || { equipment }, settings);
  return next?.withinRange ? next.weight : null;
}
export function readyToProgress(
  history: SetEntry[][],
  exercise: ExerciseMeta,
  settings?: ProgressionSettings,
) {
  const { repTarget } = settingsFor(exercise, settings);
  return (
    history.length >= 2 &&
    history
      .slice(0, 2)
      .every(
        (sets) =>
          sets.length > 0 &&
          sets.every(
            (s) =>
              Number.isInteger(Number(s.reps)) &&
              Number(s.reps) >= repTarget + 1 &&
              Number.isFinite(Number(s.weight)) &&
              Number(s.weight) >= 0,
          ),
      )
  );
}
export function progressionAdvice(
  history: SetEntry[][],
  exercise: ExerciseMeta,
  settings?: ProgressionSettings,
) {
  if (!history[0]?.length) return "Log a session to see your next load step.";
  const cfg = settingsFor(exercise, settings);
  if (
    exercise.equipment === "body only" ||
    history[0].every((s) => Number(s.weight) === 0)
  )
    return `Add a controlled rep before adding external resistance. Rep target: ${cfg.repTarget}.`;
  const previews = history[0].map((_, i) =>
    nextLoad(history[0], i, exercise, cfg),
  );
  if (previews.some((p) => p && !p.withinRange))
    return "Your selected equipment increment would exceed a 10% jump on at least one set. Use a smaller increment or build reps at the current load.";
  return readyToProgress(history, exercise, cfg)
    ? `You exceeded your ${cfg.repTarget}-rep target in two logged sessions. Consider the grey next-load preview if technique stayed controlled and the sets were comfortable.`
    : `The grey numbers preview the next load step, not an automatic increase. First aim for ${cfg.repTarget + 1}–${cfg.repTarget + 2} reps on every set for two sessions, with controlled technique. More reps at the same weight also count as progress.`;
}
export function progression(sets: SetEntry[], equipment: string | null) {
  return progressionAdvice([sets], { equipment });
}
