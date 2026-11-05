import React, { useState } from "react";
import {
  ExerciseMeta,
  ProgressionSettings,
  settingsFor,
  progressionAdvice,
  nextLoad,
} from "./progression";
import type { SetEntry } from "./model";
export default function ProgressionControls({
  exercise,
  history,
  settings,
  onSave,
}: {
  exercise: ExerciseMeta;
  history: SetEntry[][];
  settings?: ProgressionSettings;
  onSave: (settings: ProgressionSettings) => void;
}) {
  const cfg = settingsFor(exercise, settings);
  const [reps, setReps] = useState(String(cfg.repTarget));
  const [step, setStep] = useState(String(cfg.increment));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  function save(e: React.FormEvent) {
    e.preventDefault();
    const repTarget = Number(reps),
      increment = Number(step);
    if (
      !Number.isInteger(repTarget) ||
      repTarget < 1 ||
      repTarget > 50 ||
      !Number.isFinite(increment) ||
      increment <= 0 ||
      increment > 50
    ) {
      setError(
        "Choose a rep target from 1–50 and a positive increment up to 50 kg.",
      );
      return;
    }
    onSave({ repTarget, increment });
    setError("");
    setSaved(true);
  }
  const previews = (history[0] || []).map((_, i) =>
    nextLoad(history[0], i, exercise, settings),
  );
  return (
    <details className="progression-plan">
      <summary>
        Next weight plan · {cfg.repTarget}-rep target
        {exercise.equipment !== "body only"
          ? ` · ${cfg.increment} kg increments`
          : ""}
      </summary>
      <p className="supporting">
        {progressionAdvice(history, exercise, settings)}
      </p>
      {previews.some((p) => p?.withinRange) && (
        <div className="load-preview-list">
          {previews.map((p, i) =>
            p?.withinRange ? (
              <span key={i}>
                Set {i + 1}: {p.weight} kg (+{p.percent.toFixed(1)}%)
              </span>
            ) : null,
          )}
        </div>
      )}
      <form onSubmit={save}>
        <label>
          Rep target
          <input
            aria-label={`Rep target for ${exercise.name}`}
            inputMode="numeric"
            value={reps}
            onChange={(e) => {
              setReps(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        {exercise.equipment !== "body only" && (
          <label>
            Smallest available increase (kg)
            <input
              aria-label={`Weight increment for ${exercise.name}`}
              inputMode="decimal"
              value={step}
              onChange={(e) => {
                setStep(e.target.value.replace(",", "."));
                setSaved(false);
              }}
            />
          </label>
        )}
        <button className="secondary" type="submit">
          Save progression settings
        </button>
      </form>
      {saved && (
        <p className="footnote" role="status">
          Progression settings saved.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p className="footnote">
        Defaults are editable estimates, not a machine-specific prescription.
        Use the same per-hand or total-weight convention as your log. Your
        smallest equipment step is rounded up from a 2.5% preview; jumps over
        10% are withheld.
      </p>
      <p className="footnote">
        Reference:{" "}
        <a
          href="https://pubmed.ncbi.nlm.nih.gov/19204579/"
          target="_blank"
          rel="noreferrer"
        >
          ACSM: Progression Models in Resistance Training for Healthy Adults
          (2009)
        </a>
        . General guidance: 2–10% after exceeding the target by 1–2 reps. Our
        two-session check is a conservative app rule. Live source retrieval is
        currently blocked; this is a guideline-informed preview, not a completed
        literature review.
      </p>
    </details>
  );
}
