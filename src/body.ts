import type { SetEntry } from "./model";
export type BodyMeasurement = {
  id: string;
  date: string;
  weight: number;
  bodyFat?: number;
  muscleMass?: number;
  scan?: Record<string, string>;
};
export type BodyGoals = { weight?: number; bodyFat?: number };
export const BASELINE: BodyMeasurement = {
  id: "scan-2026-11-01",
  date: "2026-11-01",
  weight: 89.7,
  bodyFat: 23.5,
  muscleMass: 39.1,
  scan: {
    Weight: "89.7 kg",
    "Body fat mass (BFM)": "23.5% · 21.1 kg",
    "Skeletal muscle mass (SMM)": "43.6% · 39.1 kg",
    BMI: "28.3",
    "Basal metabolic rate (BMR)": "1871 kcal",
    "Total body water (TBW)": "56% · 50.2 kg",
    "Soft lean mass (SLM)": "72.2% · 64.7 kg",
    "Fat-free mass (FFM)": "76.5% · 68.6 kg",
    "Extracellular water (ECW)": "37.2% · 18.7 kg",
    "Intracellular water (ICW)": "62.75% · 31.5 kg",
    "Phase angle": "7.3°",
    "Bone mineral content (BMC)": "4.35% · 3.9 kg",
  },
};
export const percentChange = (current: number, previous: number) =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;
export function goalProgress(current: number, start: number, target: number) {
  return target === start ? null : ((current - start) / (target - start)) * 100;
}
export function suggestedWeight(
  previous: SetEntry[],
  index: number,
  equipment: string | null,
) {
  const old = Number(previous[index]?.weight);
  if (!Number.isFinite(old) || old <= 0) return null;
  const ready =
    equipment !== "body only" &&
    previous.length > 0 &&
    previous.every((s) => Number(s.reps) >= 12) &&
    previous.every((s) => Number(s.weight) === old);
  return ready ? Math.round(old * 1.025 * 10) / 10 : old;
}

export const PROPOSED_BODY_GOALS: BodyGoals = {
  weight: Math.round((68.6 / (1 - 0.18)) * 10) / 10,
  bodyFat: 18,
};
