import React, { useState } from "react";
import type { Data } from "./model";
import { BASELINE, percentChange, goalProgress, BodyMeasurement } from "./body";
const n = (v: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(v);
const signed = (v: number | null) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${n(v)}%`;
const day = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export default function BodyPanel({
  data,
  onChange,
}: {
  data: Data;
  onChange: React.Dispatch<React.SetStateAction<Data>>;
}) {
  const entries = [...(data.bodyMeasurements ?? [BASELINE])]
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = entries[0] ?? BASELINE;
  const goals = data.bodyGoals || {};
  const [showEntry, setShowEntry] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [muscle, setMuscle] = useState("");
  const [targetWeight, setTargetWeight] = useState(
    goals.weight?.toString() || "",
  );
  const [targetFat, setTargetFat] = useState(goals.bodyFat?.toString() || "");
  const [error, setError] = useState("");
  const [metricView, setMetricView] = useState<"snapshot" | "change">(
    "snapshot",
  );
  function add(e: React.FormEvent) {
    e.preventDefault();
    const w = Number(weight),
      f = fat.trim() ? Number(fat) : undefined,
      m = muscle.trim() ? Number(muscle) : undefined;
    if (
      !date ||
      date > today() ||
      date < BASELINE.date ||
      !weight.trim() ||
      !Number.isFinite(w) ||
      w <= 0 ||
      (f !== undefined && (!Number.isFinite(f) || f <= 0 || f >= 100)) ||
      (m !== undefined && (!Number.isFinite(m) || m <= 0))
    ) {
      setError(
        "Enter a valid date from November 1 onward, a positive weight, and valid optional measurements.",
      );
      return;
    }
    const entry: BodyMeasurement = {
      id: crypto.randomUUID(),
      date,
      weight: w,
      ...(f !== undefined ? { bodyFat: f } : {}),
      ...(m !== undefined ? { muscleMass: m } : {}),
    };
    onChange((d) => ({
      ...d,
      bodyMeasurements: [...(d.bodyMeasurements ?? [BASELINE]), entry],
    }));
    setShowEntry(false);
    setWeight("");
    setFat("");
    setMuscle("");
    setError("");
  }
  function saveGoals(e: React.FormEvent) {
    e.preventDefault();
    const w = targetWeight.trim() ? Number(targetWeight) : undefined,
      f = targetFat.trim() ? Number(targetFat) : undefined;
    if (
      (w !== undefined && (!Number.isFinite(w) || w <= 0)) ||
      (f !== undefined && (!Number.isFinite(f) || f <= 0 || f >= 100))
    ) {
      setError(
        "Enter a positive target weight and a body-fat target between 0 and 100.",
      );
      return;
    }
    onChange((d) => ({
      ...d,
      bodyGoals: {
        ...(w !== undefined ? { weight: w } : {}),
        ...(f !== undefined ? { bodyFat: f } : {}),
      },
    }));
    setShowGoals(false);
    setError("");
  }
  return (
    <section className="body-panel" aria-label="Body progress">
      <div className="section-title">
        <div>
          <p className="eyebrow">YOUR BODY · YOUR DIRECTION</p>
          <h2>Body progress</h2>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setShowEntry((v) => !v);
            setError("");
          }}
        >
          + Add check-in
        </button>
      </div>
      <div className="body-record-context">
        <span>178 cm · 31 at baseline · muscle-preserving fat loss</span>
        <span>Baseline Nov 1 · Updated {day(latest.date)}</span>
      </div>
      <div className="body-console-bar">
        <span className="console-indicator">
          <span /> BODY TELEMETRY
        </span>
        <div className="metric-view-switch" aria-label="Body metric display">
          <button
            aria-pressed={metricView === "snapshot"}
            onClick={() => setMetricView("snapshot")}
          >
            Snapshot
          </button>
          <button
            aria-pressed={metricView === "change"}
            onClick={() => setMetricView("change")}
          >
            Change %
          </button>
        </div>
      </div>
      <div className="body-metrics" key={metricView}>
        <div>
          <span className="eyebrow">BODY WEIGHT</span>
          <strong>
            {metricView === "snapshot"
              ? n(latest.weight)
              : signed(percentChange(latest.weight, BASELINE.weight))}
            <small>{metricView === "snapshot" ? "kg" : "change"}</small>
          </strong>
          <p>
            {signed(percentChange(latest.weight, BASELINE.weight))} since
            baseline
          </p>
        </div>
        <div>
          <span className="eyebrow">BODY FAT</span>
          <strong>
            {latest.bodyFat !== undefined
              ? metricView === "snapshot"
                ? n(latest.bodyFat)
                : signed(percentChange(latest.bodyFat, BASELINE.bodyFat!))
              : "—"}
            <small>
              {latest.bodyFat !== undefined
                ? metricView === "snapshot"
                  ? "%"
                  : "relative change"
                : ""}
            </small>
          </strong>
          <p>
            {latest.bodyFat !== undefined
              ? `${n(latest.bodyFat - BASELINE.bodyFat!)} percentage points since baseline`
              : "Not recorded at latest check-in"}
          </p>
        </div>
        <div>
          <span className="eyebrow">SKELETAL MUSCLE</span>
          <strong>
            {latest.muscleMass !== undefined
              ? metricView === "snapshot"
                ? n(latest.muscleMass)
                : signed(percentChange(latest.muscleMass, BASELINE.muscleMass!))
              : "—"}
            <small>
              {latest.muscleMass !== undefined
                ? metricView === "snapshot"
                  ? "kg"
                  : "change"
                : ""}
            </small>
          </strong>
          <p>
            {latest.muscleMass !== undefined
              ? `${signed(percentChange(latest.muscleMass, BASELINE.muscleMass!))} since baseline`
              : "Not recorded at latest check-in"}
          </p>
        </div>
      </div>
      <details className="scan-details">
        <summary>Why these starting targets?</summary>
        <p className="supporting">
          A provisional first target is 18% body fat, roughly 83.7 kg. The
          estimate is 68.6 kg fat-free mass ÷ (1 − 0.18). It assumes fat-free
          mass is maintained; scans and hydration vary. It is a practical
          starting proposal, not a medical optimum or a guaranteed final weight.
        </p>
        <p className="supporting">
          Your first 5% weight-change milestone is 85.2 kg. Keep resistance
          training and compare check-ins under similar conditions. We do not
          assign automatic “optimal” targets to your water compartments, phase
          angle, or bone mineral reading.
        </p>
        <p className="footnote">
          BMI is a population screening measure and does not distinguish fat
          from muscle. At your recorded height and weight it is about 28.3; that
          alone does not set your personal goal.
        </p>
        <p className="footnote">
          Reference links, not live-verified here:{" "}
          <a
            href="https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html"
            target="_blank"
            rel="noreferrer"
          >
            CDC BMI guidance
          </a>{" "}
          ·{" "}
          <a
            href="https://www.acefitness.org/resources/everyone/blog/112/what-are-the-guidelines-for-percentage-of-body-fat-loss/"
            target="_blank"
            rel="noreferrer"
          >
            ACE body-fat guidance
          </a>{" "}
          ·{" "}
          <a
            href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/"
            target="_blank"
            rel="noreferrer"
          >
            ISSN protein position statement
          </a>
        </p>
      </details>
      <div className="body-goal-heading">
        <h3>Your targets</h3>
        <button
          className="rename-exercise"
          onClick={() => {
            setTargetWeight(goals.weight?.toString() || "");
            setTargetFat(goals.bodyFat?.toString() || "");
            setShowGoals((v) => !v);
            setError("");
          }}
        >
          Set targets
        </button>
      </div>
      {!goals.weight && !goals.bodyFat && (
        <p className="supporting">
          Set your weight and body-fat targets to see how far you have to go. A
          scan alone does not establish your personal optimal targets.
        </p>
      )}
      <div className="body-targets">
        {[
          {
            key: "weight",
            label: "Weight",
            unit: "kg",
            start: BASELINE.weight,
            current: latest.weight,
            target: goals.weight,
          },
          {
            key: "bodyFat",
            label: "Body fat",
            unit: "%",
            start: BASELINE.bodyFat!,
            current: latest.bodyFat,
            target: goals.bodyFat,
          },
        ]
          .filter((g) => g.target !== undefined)
          .map((g) => {
            const pct =
              g.current !== undefined
                ? goalProgress(g.current, g.start, g.target!)
                : null;
            return (
              <div key={g.key} className="body-target">
                <div className="goal-orbit" aria-hidden="true">
                  <svg viewBox="0 0 80 80">
                    <circle className="orbit-track" cx="40" cy="40" r="33" />
                    <circle
                      className="orbit-progress"
                      cx="40"
                      cy="40"
                      r="33"
                      pathLength="100"
                      strokeDasharray={`${Math.min(100, Math.max(0, pct ?? 0))} 100`}
                    />
                  </svg>
                  <span>{pct === null ? "—" : `${n(pct)}%`}</span>
                </div>
                <p>
                  {g.label} target{" "}
                  <strong>
                    {n(g.target!)}
                    {g.unit}
                  </strong>
                </p>
                <p className="supporting">
                  {g.current === undefined
                    ? "Add this measurement to your next check-in."
                    : `${n(Math.abs(g.current - g.target!))} ${g.key === "bodyFat" ? "percentage points" : "kg"} ${g.current >= g.target! ? "above" : "below"} target`}
                </p>
                {pct !== null && (
                  <>
                    <progress
                      max={100}
                      value={Math.min(100, Math.max(0, pct))}
                    />
                    <small>{n(pct)}% toward target from Nov 1</small>
                  </>
                )}
              </div>
            );
          })}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {showGoals && (
        <form onSubmit={saveGoals} className="body-form">
          <label>
            Target weight (kg)
            <input
              aria-label="Target weight in kilograms"
              inputMode="decimal"
              value={targetWeight}
              onChange={(e) =>
                setTargetWeight(e.target.value.replace(",", "."))
              }
            />
          </label>
          <label>
            Target body fat (%)
            <input
              aria-label="Target body fat percentage"
              inputMode="decimal"
              value={targetFat}
              onChange={(e) => setTargetFat(e.target.value.replace(",", "."))}
            />
          </label>
          <button className="primary" type="submit">
            Save targets
          </button>
          <button
            className="secondary"
            type="button"
            onClick={() => setShowGoals(false)}
          >
            Cancel targets
          </button>
        </form>
      )}
      {showEntry && (
        <form onSubmit={add} className="body-form">
          <h3>New body check-in</h3>
          <label>
            Date
            <input
              aria-label="Body check-in date"
              type="date"
              min={BASELINE.date}
              max={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label>
            Weight (kg)
            <input
              aria-label="Body weight in kilograms"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value.replace(",", "."))}
              required
            />
          </label>
          <label>
            Body fat (%) · optional
            <input
              aria-label="Body fat percentage"
              inputMode="decimal"
              value={fat}
              onChange={(e) => setFat(e.target.value.replace(",", "."))}
            />
          </label>
          <label>
            Skeletal muscle (kg) · optional
            <input
              aria-label="Skeletal muscle mass in kilograms"
              inputMode="decimal"
              value={muscle}
              onChange={(e) => setMuscle(e.target.value.replace(",", "."))}
            />
          </label>
          <button className="primary" type="submit">
            Save check-in
          </button>
          <button
            className="secondary"
            type="button"
            onClick={() => setShowEntry(false)}
          >
            Cancel check-in
          </button>
        </form>
      )}
      <details className="scan-details">
        <summary>View November 1 scan · all measurements</summary>
        <p className="footnote">
          Transcribed from your screenshots. Percentages are the device-reported
          values; water compartments use different denominators.
        </p>
        <dl>
          {Object.entries(BASELINE.scan!).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
      <details className="scan-details">
        <summary>Check-in history ({entries.length})</summary>
        <div className="body-history">
          {entries.map((e, i) => {
            const previous = entries[i + 1];
            return (
              <div key={e.id}>
                <div>
                  <strong>{day(e.date)}</strong>
                  <p>
                    {n(e.weight)} kg
                    {e.bodyFat !== undefined
                      ? ` · ${n(e.bodyFat)}% body fat`
                      : ""}
                    {e.muscleMass !== undefined
                      ? ` · ${n(e.muscleMass)} kg muscle`
                      : ""}
                  </p>
                  <small>
                    {previous
                      ? `${signed(percentChange(e.weight, previous.weight))} weight vs previous check-in`
                      : "Starting measurement"}
                  </small>
                </div>
                {e.id !== BASELINE.id && (
                  <button
                    className="rename-exercise"
                    aria-label={`Delete body check-in ${e.id}`}
                    onClick={() => {
                      if (window.confirm("Delete this body check-in?"))
                        onChange((d) => ({
                          ...d,
                          bodyMeasurements: (
                            d.bodyMeasurements ?? [BASELINE]
                          ).filter((x) => x.id !== e.id),
                        }));
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
