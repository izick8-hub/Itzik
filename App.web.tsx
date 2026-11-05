import ProgressionControls from "./src/ProgressionControls";
import { progressionAdvice } from "./src/progression";
import TrainingDial from "./src/TrainingDial";
import BodyPanel from "./src/BodyPanel";
import {
  BASELINE,
  PROPOSED_BODY_GOALS,
  suggestedWeight,
  percentChange,
} from "./src/body";
import React, { useEffect, useRef, useState } from "react";
import catalog from "./src/exercises.json";
import photoFiles from "./src/photo-files.json";
import {
  DAYS,
  GROUPS,
  Data,
  Session,
  emptyData,
  newSets,
  validSets,
  keyFor,
} from "./src/model";
import { summary, comparison, volume } from "./src/insights";
import "./src/web.css";
const KEY = "lift-journal:v1";
const muscles: Record<string, string[]> = {
  Legs: [
    "quadriceps",
    "hamstrings",
    "glutes",
    "calves",
    "adductors",
    "abductors",
  ],
  Shoulders: ["shoulders", "traps"],
  Chest: ["chest"],
  Biceps: ["biceps"],
  Back: ["lats", "middle back", "lower back"],
  Triceps: ["triceps"],
};
const fmt = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
const date = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const catalogName = (id: string) =>
  catalog.find((e) => e.id === id)?.name || id;
const paths: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  lift: (
    <>
      <path d="m6 6 12 12M3 8l5-5M16 21l5-5M1 6l5-5M18 23l5-5M4 11l7-7M13 20l7-7" />
    </>
  ),
  cardio: (
    <>
      <path d="M2 13h5l3-9 4 16 3-7h5" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  edit: (
    <>
      <path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  plus: <path d="M5 12h14M12 5v14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  chart: (
    <>
      <path d="M4 4v16h16M7 15l4-5 4 2 5-7" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6" />
    </>
  ),
};
function Icon({ type }: { type: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[type] || paths.lift}
    </svg>
  );
}
const MUSCLE_TILES: Record<string, [number, number]> = {
  Shoulders: [0, 0],
  Legs: [1, 0],
  Back: [2, 0],
  Triceps: [0, 1],
  Biceps: [1, 1],
  Chest: [2, 1],
};
function MuscleArt({
  muscle,
  small = false,
}: {
  muscle: string;
  small?: boolean;
}) {
  const [column, row] = MUSCLE_TILES[muscle];
  return (
    <span
      className={`muscle-art ${small ? "muscle-art-small" : ""}`}
      role="img"
      aria-label={`${muscle} illustration`}
      data-muscle={muscle}
    >
      <img
        src="icons/muscle-outline-atlas.png"
        alt=""
        style={{ left: `${-column * 100}%`, top: `${-row * 100}%` }}
      />
    </span>
  );
}
function Photo({
  id,
  label,
  interactive = true,
}: {
  id: string;
  label?: string;
  interactive?: boolean;
}) {
  const file = (photoFiles as Record<string, string>)[id];
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="exercise-photo">
      {file && !failed ? (
        <img
          src={`exercise-photos/${file}${attempt ? `?retry=${attempt}` : ""}`}
          alt={`${label || catalogName(id)} demonstration`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : file && interactive ? (
        <button
          className="photo-retry"
          aria-label={`Retry photo for ${label || catalogName(id)}`}
          onClick={() => {
            setAttempt((n) => n + 1);
            setFailed(false);
          }}
        >
          <Icon type="lift" />
          <span>Retry</span>
        </button>
      ) : (
        <Icon type="lift" />
      )}
    </div>
  );
}
export default function App() {
  const [data, setData] = useState<Data>(emptyData);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(() => {
    try {
      return sessionStorage.getItem("lift-journal:view") || "Home";
    } catch {
      return "Home";
    }
  });
  const [day, setDay] = useState(0);
  const [homeDay, setHomeDay] = useState<number | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customEquipment, setCustomEquipment] = useState("body only");
  const [equipment, setEquipment] = useState("All");
  const [editing, setEditing] = useState<{
    day: number;
    session: Session;
  } | null>(null);
  const [deleting, setDeleting] = useState<{
    day: number;
    session: Session;
  } | null>(null);
  const [historyIndex, setHistoryIndex] = useState<Record<string, number>>({});
  const [activity, setActivity] = useState("Walking");
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [notice, setNotice] = useState("");
  const [lastRemoved, setLastRemoved] = useState<{
    day: number;
    group: string;
    id: string;
    index: number;
  } | null>(null);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (
          !d.selections ||
          !d.sessions ||
          !d.drafts ||
          !Array.isArray(d.cardio)
        )
          throw Error();
        setData({
          ...d,
          bodyMeasurements: d.bodyMeasurements ?? [BASELINE],
          bodyGoals: d.bodyGoals ?? PROPOSED_BODY_GOALS,
        });
      }
      if (!raw)
        setData((d) => ({
          ...d,
          bodyMeasurements: [BASELINE],
          bodyGoals: PROPOSED_BODY_GOALS,
        }));
      setReady(true);
    } catch {
      setError(
        "Your saved data could not be read. It has not been overwritten. Please reload to try again.",
      );
    }
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
        setError("");
      } catch {
        setError(
          "Changes could not be saved. Your device storage may be full. Keep this page open.",
        );
      }
  }, [data, ready]);
  useEffect(() => {
    try {
      sessionStorage.setItem("lift-journal:view", tab);
    } catch {}
    main.current?.scrollTo({ top: 0 });
    window.scrollTo(0, 0);
  }, [tab]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  const name = (id: string) =>
    data.exerciseNames?.[id] ||
    data.customExercises?.find((e) => e.id === id)?.name ||
    catalogName(id);
  const exercises = [
    ...catalog.map((e) => ({ ...e, originalName: e.name, name: name(e.id) })),
    ...(data.customExercises || []).map((e) => ({
      ...e,
      originalName: e.name,
      name: name(e.id),
      primaryMuscles: muscles[e.group] || [],
      secondaryMuscles: [] as string[],
      images: [] as string[],
    })),
  ];
  function createCustom(event: React.FormEvent) {
    event.preventDefault();
    if (!picker) return;
    if (!customName.trim()) {
      window.alert("Enter an exercise name.");
      return;
    }
    const exercise = {
      id: `custom:${crypto.randomUUID()}`,
      name: customName.trim(),
      group: picker,
      equipment: customEquipment,
    };
    setData((d) => ({
      ...d,
      customExercises: [...(d.customExercises || []), exercise],
      selections: {
        ...d.selections,
        [keyFor(day, picker)]: [
          ...(d.selections[keyFor(day, picker)] || []),
          exercise.id,
        ],
      },
    }));
    setCustomName("");
    setShowCustom(false);
    setPicker(null);
    setNotice("Custom exercise added to your list.");
  }
  function saveName(event: React.FormEvent) {
    event.preventDefault();
    if (!renaming) return;
    if (!newName.trim()) {
      window.alert("Enter an exercise name.");
      return;
    }
    setData((d) => ({
      ...d,
      exerciseNames: { ...d.exerciseNames, [renaming]: newName.trim() },
    }));
    setRenaming(null);
    setNotice("Exercise name updated. Your history stays linked.");
  }
  const stats = summary(data);
  const draft = data.drafts[day];
  const ids = GROUPS[day].flatMap((g) => data.selections[keyFor(day, g)] || []);
  const completed = ids.reduce(
    (n, id) =>
      n + (draft?.sets[id] || newSets()).filter((s) => validSets([s])).length,
    0,
  );
  const options = picker
    ? exercises.filter(
        (e) =>
          muscles[picker].some(
            (m) =>
              e.primaryMuscles.includes(m) || e.secondaryMuscles.includes(m),
          ) &&
          e.name.toLowerCase().includes(query.toLowerCase()) &&
          (equipment === "All" || e.equipment === equipment),
      )
    : [];
  function start(d: number) {
    setDay(d);
    setTab("Weight-lifting");
  }
  function removeExercise(group: string, id: string) {
    const removed = {
      day,
      group,
      id,
      index: (data.selections[keyFor(day, group)] || []).indexOf(id),
    };
    setLastRemoved(removed);
    setData((d) => ({
      ...d,
      selections: {
        ...d.selections,
        [keyFor(day, group)]: (d.selections[keyFor(day, group)] || []).filter(
          (x) => x !== id,
        ),
      },
      removedExercises: [
        ...(d.removedExercises || []).filter(
          (x) => !(x.day === day && x.group === group && x.id === id),
        ),
        removed,
      ],
    }));
  }
  function restoreExercise(removed: {
    day: number;
    group: string;
    id: string;
    index: number;
  }) {
    setData((d) => {
      const key = keyFor(removed.day, removed.group);
      const selected = [...(d.selections[key] || [])];
      if (!selected.includes(removed.id))
        selected.splice(
          Math.min(removed.index, selected.length),
          0,
          removed.id,
        );
      return {
        ...d,
        selections: { ...d.selections, [key]: selected },
        removedExercises: (d.removedExercises || []).filter(
          (x) =>
            !(
              x.day === removed.day &&
              x.group === removed.group &&
              x.id === removed.id
            ),
        ),
      };
    });
    setLastRemoved(null);
  }
  function newWorkout() {
    if (data.drafts[day]) {
      setNotice(
        "Your current workout is already open. Finish it before starting another.",
      );
      return;
    }
    setData((d) => {
      const selections = { ...d.selections };
      const latest = (d.sessions[day] || []).at(-1);
      for (const id of Object.keys(latest?.sets || {})) {
        if (
          GROUPS[day].some((g) =>
            (selections[keyFor(day, g)] || []).includes(id),
          )
        )
          continue;
        const exercise = exercises.find((e) => e.id === id);
        const group =
          GROUPS[day].find((g) =>
            exercise?.primaryMuscles.some((m) => muscles[g].includes(m)),
          ) ||
          GROUPS[day].find((g) =>
            exercise?.secondaryMuscles.some((m) => muscles[g].includes(m)),
          ) ||
          GROUPS[day][0];
        const key = keyFor(day, group);
        selections[key] = [...(selections[key] || []), id];
      }
      const now = new Date().toISOString();
      return {
        ...d,
        selections,
        removedExercises: (d.removedExercises || []).filter(
          (x) =>
            x.day !== day ||
            !GROUPS[day].some((g) =>
              (selections[keyFor(day, g)] || []).includes(x.id),
            ),
        ),
        drafts: {
          ...d.drafts,
          [day]: { id: crypto.randomUUID(), date: now, sets: {} },
        },
      };
    });
    setHistoryIndex({});
    setLastRemoved(null);
    setNotice(
      "New dated workout opened. Your previous results stay beside it.",
    );
  }
  function updateSet(
    id: string,
    i: number,
    field: "weight" | "reps",
    value: string,
  ) {
    setData((d) => {
      const current = d.drafts[day] || {
        id: new Date().toISOString(),
        date: new Date().toISOString(),
        sets: {},
      };
      return {
        ...d,
        drafts: {
          ...d.drafts,
          [day]: {
            ...current,
            sets: {
              ...current.sets,
              [id]: (current.sets[id] || newSets()).map((s, j) =>
                j === i ? { ...s, [field]: value.replace(",", ".") } : s,
              ),
            },
          },
        },
      };
    });
  }
  function finish() {
    if (
      !ids.length ||
      !draft ||
      !ids.every((id) => validSets(draft.sets[id] || newSets()))
    ) {
      window.alert(
        "Complete your sets\nEnter a weight of zero or more and positive whole-number reps for every set.",
      );
      return;
    }
    setData((d) => {
      const drafts = { ...d.drafts };
      delete drafts[day];
      return {
        ...d,
        drafts,
        sessions: {
          ...d.sessions,
          [day]: [
            ...(d.sessions[day] || []),
            {
              ...draft,
              sets: Object.fromEntries(ids.map((id) => [id, draft.sets[id]])),
            },
          ],
        },
      };
    });
    setHistoryIndex({});
    setNotice("Workout saved. Another session in the bank.");
  }
  function saveEdit() {
    if (!editing) return;
    if (!Object.values(editing.session.sets).every(validSets)) {
      window.alert(
        "Check your sets. Use a nonnegative weight and positive whole-number reps.",
      );
      return;
    }
    const target = editing;
    setData((d) => ({
      ...d,
      sessions: {
        ...d.sessions,
        [target.day]: (d.sessions[target.day] || []).map((s) =>
          s.id === target.session.id ? target.session : s,
        ),
      },
    }));
    setEditing(null);
    setNotice("Workout updated.");
  }
  function removeSaved() {
    if (!deleting) return;
    const target = deleting;
    setData((d) => ({
      ...d,
      sessions: {
        ...d.sessions,
        [target.day]: (d.sessions[target.day] || []).filter(
          (s) => s.id !== target.session.id,
        ),
      },
    }));
    setDeleting(null);
    setHistoryIndex({});
    setNotice("Saved workout deleted.");
  }
  function saveCardio() {
    if (
      !minutes.trim() ||
      !Number.isFinite(Number(minutes)) ||
      Number(minutes) <= 0 ||
      !distance.trim() ||
      !Number.isFinite(Number(distance)) ||
      Number(distance) < 0
    ) {
      window.alert(
        "Enter a duration above zero and a distance of zero or more.",
      );
      return;
    }
    setData((d) => ({
      ...d,
      cardio: [
        {
          id: new Date().toISOString(),
          date: new Date().toISOString(),
          activity,
          minutes,
          distance,
        },
        ...d.cardio,
      ],
    }));
    setMinutes("");
    setDistance("");
    setNotice("Activity saved.");
  }
  const progress = stats.sessions
    .flatMap((s) =>
      Object.entries(s.sets).map(([id, sets]) => {
        const previous = stats.sessions.find(
          (p) =>
            p.day === s.day &&
            Date.parse(p.date) < Date.parse(s.date) &&
            p.sets[id],
        );
        return previous
          ? { id, change: comparison(sets, previous.sets[id]) }
          : null;
      }),
    )
    .find((p) => p?.change);
  const homeSelection =
    homeDay ??
    (Object.keys(data.drafts).length
      ? Number(Object.keys(data.drafts)[0])
      : stats.nextDay);
  if (!ready)
    return (
      <div className="loading">
        <span className="brand">LIFT JOURNAL</span>
        <p>{error || "Opening your journal…"}</p>
      </div>
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setTab("Home")}>
          <span className="brand-mark">
            <Icon type="lift" />
          </span>{" "}
          Lift Journal
        </button>
        <span className="device-badge">
          <span /> ON YOUR DEVICE
        </span>
      </header>
      <main ref={main} className="main-content">
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {tab === "Home" ? (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">
                  {new Date()
                    .toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })
                    .toUpperCase()}
                </p>
                <h1>
                  Show up.
                  <br />
                  <span>Get stronger.</span>
                </h1>
                <p className="supporting">
                  Your next chapter starts with one set.
                </p>
              </div>
              <div className="welcome-emblem">
                <Icon type="chart" />
              </div>
            </section>
            <section className="hero">
              <div className="hero-line">
                <span className="pill">
                  {Object.keys(data.drafts).length
                    ? "KEEP THE MOMENTUM"
                    : "YOUR NEXT SESSION"}
                </span>
                <span className="session-number">
                  0{homeSelection + 1} / 03
                </span>
              </div>
              <p className="eyebrow">WEIGHT-LIFTING · YOUR SPLIT</p>
              <h2>{DAYS[homeSelection].replace(" Day", "")}</h2>
              <p className="supporting">
                {data.drafts[homeSelection]
                  ? "You have an unfinished session. Pick up where you left off."
                  : "Focused training. Measurable progress. Your pace."}
              </p>
              <TrainingDial day={homeSelection} onChange={setHomeDay} />
              <button
                className="primary hero-cta"
                onClick={() => start(homeSelection)}
              >
                {data.drafts[homeSelection]
                  ? "Continue Workout"
                  : "Start Workout"}
                <Icon type="arrow" />
              </button>
              <div className="hero-decoration" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </section>
            <BodyPanel data={data} onChange={setData} />
            <section className="stats-grid" aria-label="Training summary">
              <Metric
                label="WORKOUTS COMPLETED"
                value={String(stats.count)}
                detail="All-time lifting sessions"
              />
              <Metric
                label="CURRENT STREAK"
                value={`${stats.streak}`}
                unit={stats.streak === 1 ? "day" : "days"}
                detail="Consecutive training days"
              />
              <Metric
                label="TRAINING VOLUME"
                value={stats.count ? fmt(stats.totalVolume) : "—"}
                unit={stats.count ? "kg" : ""}
                detail="All-time weight × reps"
              />
              <Metric
                label="RECENT PROGRESS"
                value={
                  progress?.change?.weight != null
                    ? `${progress.change.weight >= 0 ? "+" : ""}${fmt(progress.change.weight)}%`
                    : "—"
                }
                detail={
                  progress
                    ? `${name(progress.id)} · mean load`
                    : "Two comparable sessions needed"
                }
              />
            </section>
            <section>
              <SectionTitle
                label="YOUR ROTATION"
                title="A plan. A little progress."
              />
              <div className="split-grid">
                {DAYS.map((d, i) => (
                  <button
                    className="split-card"
                    key={d}
                    onClick={() => start(i)}
                  >
                    <span className="split-index">0{i + 1}</span>
                    <div>
                      <h3>{d.replace(" Day", "")}</h3>
                      <p>
                        {(data.sessions[i] || []).length} sessions ·{" "}
                        {
                          GROUPS[i].flatMap(
                            (g) => data.selections[keyFor(i, g)] || [],
                          ).length
                        }{" "}
                        exercises
                      </p>
                    </div>
                    <span className="split-mascots" aria-hidden="true">
                      {GROUPS[i].map((muscle) => (
                        <MuscleArt key={muscle} muscle={muscle} small />
                      ))}
                    </span>
                    <Icon type="chevron" />
                  </button>
                ))}
              </div>
            </section>
            <section>
              <SectionTitle label="THE WORK ADDS UP" title="Recent sessions" />
              {stats.sessions.length ? (
                <div className="recent-list">
                  {stats.sessions.slice(0, 4).map((s) => (
                    <button
                      key={`${s.day}-${s.id}`}
                      className="recent-session"
                      onClick={() => start(s.day)}
                    >
                      <span className="small-icon">
                        <Icon type="check" />
                      </span>
                      <div>
                        <h3>{DAYS[s.day].replace(" Day", "")}</h3>
                        <p>
                          {date(s.date)} · {Object.keys(s.sets).length}{" "}
                          exercises
                        </p>
                      </div>
                      <strong>
                        {fmt(
                          Object.values(s.sets).reduce(
                            (n, x) => n + volume(x),
                            0,
                          ),
                        )}
                        <small> kg volume</small>
                      </strong>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Icon type="chart" />
                  <h3>Your story starts here.</h3>
                  <p>
                    Finish your first workout to see your training take shape.
                  </p>
                </div>
              )}
            </section>
          </>
        ) : tab === "Weight-lifting" ? (
          <>
            <section className="page-heading">
              <p className="eyebrow">BUILD WITH INTENTION</p>
              <h1>Weight-lifting</h1>
              <p className="supporting">
                One set at a time. Every session counts.
              </p>
            </section>
            <div className="day-switch" aria-label="Workout day">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  className={day === i ? "active" : ""}
                  aria-pressed={day === i}
                  onClick={() => setDay(i)}
                >
                  <span>0{i + 1}</span>
                  <span>{d}</span>
                </button>
              ))}
            </div>
            <div className="section-title">
              <div>
                <p className="eyebrow">{DAYS[day].toUpperCase()}</p>
                <h2>Your exercises</h2>
              </div>
              <span className="muted count-label">
                {(data.sessions[day] || []).length} workouts saved
              </span>
            </div>
            <div className="new-session-bar">
              <div>
                <p className="eyebrow">
                  {draft ? "CURRENT WORKOUT" : "READY FOR YOUR NEXT SESSION"}
                </p>
                <strong>{date(draft?.date || new Date().toISOString())}</strong>
                <p className="supporting">
                  New sets beside your saved results. Exercises carry over.
                </p>
              </div>
              <button className="secondary" onClick={newWorkout}>
                <Icon type="plus" />
                New workout
              </button>
            </div>
            {GROUPS[day].map((group) => (
              <section className="muscle-section" key={group}>
                <div className="muscle-header">
                  <div className="muscle-title">
                    <MuscleArt muscle={group} />
                    <div>
                      <p className="eyebrow">MUSCLE GROUP</p>
                      <h3>{group}</h3>
                    </div>
                  </div>
                  <button
                    className="secondary add-exercise"
                    aria-label="+ Exercise"
                    onClick={() => {
                      setPicker(group);
                      setQuery("");
                      setEquipment("All");
                    }}
                  >
                    <Icon type="plus" />
                    Exercise<span className="sr-only">+ Exercise</span>
                  </button>
                </div>
                {!(data.selections[keyFor(day, group)] || []).length && (
                  <button
                    className="empty-exercise"
                    onClick={() => {
                      setPicker(group);
                      setQuery("");
                      setEquipment("All");
                    }}
                  >
                    <Icon type="plus" />
                    <span>
                      Build your {group.toLowerCase()} session
                      <small>Choose an exercise to get started</small>
                    </span>
                    <Icon type="chevron" />
                  </button>
                )}
                {(data.removedExercises || []).filter(
                  (x) => x.day === day && x.group === group,
                ).length > 0 && (
                  <div className="removed-exercises">
                    <p className="eyebrow">REMOVED EXERCISES · HISTORY KEPT</p>
                    {(data.removedExercises || [])
                      .filter((x) => x.day === day && x.group === group)
                      .map((x) => (
                        <div key={x.id}>
                          <span>{name(x.id)}</span>
                          <button
                            className="secondary"
                            onClick={() => restoreExercise(x)}
                            aria-label={`Restore ${name(x.id)}`}
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                  </div>
                )}
                {(data.selections[keyFor(day, group)] || []).map((id) => {
                  const e = exercises.find((e) => e.id === id);
                  if (!e) return null;
                  const history = (data.sessions[day] || [])
                    .filter((s) => s.sets[id])
                    .slice()
                    .reverse();
                  const index = Math.min(
                    historyIndex[id] || 0,
                    Math.max(history.length - 1, 0),
                  );
                  const previous = history[index];
                  const change =
                    history.length >= 2
                      ? comparison(history[0].sets[id], history[1].sets[id])
                      : null;
                  return (
                    <article className="exercise-card" key={id}>
                      <header className="exercise-header">
                        <Photo id={id} label={e.name} />
                        <div>
                          <p className="eyebrow">
                            {e.equipment || "BODYWEIGHT"}
                          </p>
                          <h3>{e.name}</h3>
                          <button
                            className="rename-exercise"
                            aria-label={`Rename ${e.name}`}
                            onClick={() => {
                              setRenaming(id);
                              setNewName(name(id));
                            }}
                          >
                            <Icon type="edit" />
                            Rename
                          </button>
                        </div>
                        <button
                          className="icon-button remove"
                          aria-label={`Remove ${e.name} from ${group}`}
                          onClick={() => removeExercise(group, id)}
                        >
                          <Icon type="minus" />
                        </button>
                      </header>
                      {history[0] && (
                        <p className="load-preview-note">
                          Grey = next possible load. Increase only after meeting
                          your rep goal with controlled technique.
                        </p>
                      )}
                      <div className="set-table">
                        <div className="session-columns">
                          <span />
                          <div>
                            <span className="eyebrow">
                              {draft ? "CURRENT WORKOUT" : "NEW WORKOUT"}
                            </span>
                            <time>
                              {date(draft?.date || new Date().toISOString())}
                            </time>
                          </div>
                          <div>
                            <span className="eyebrow">
                              {previous ? "SAVED WORKOUT" : "NO HISTORY YET"}
                            </span>
                            {previous && <time>{date(previous.date)}</time>}
                          </div>
                          <button
                            className="icon-button"
                            aria-label={`Start new workout for ${e.name}`}
                            onClick={newWorkout}
                          >
                            <Icon type="plus" />
                          </button>
                        </div>
                        <div className="set-table-heading">
                          <span>SET</span>
                          <span>
                            WEIGHT <small>kg</small>
                          </span>
                          <span>REPS</span>
                          <span>{previous ? "PREVIOUS" : "LAST TIME"}</span>
                        </div>
                        {(draft?.sets[id] || newSets()).map((s, i) => (
                          <div
                            className={`set-row ${validSets([s]) ? "set-complete" : ""}`}
                            key={i}
                          >
                            <span className="set-badge">
                              {validSets([s]) ? <Icon type="check" /> : i + 1}
                            </span>
                            <input
                              aria-label={`${e.name} set ${i + 1} weight in kilograms`}
                              inputMode="decimal"
                              placeholder={
                                history[0]
                                  ? String(
                                      suggestedWeight(
                                        history[0].sets[id],
                                        i,
                                        e.equipment,
                                        data.progressionSettings?.[id],
                                        e,
                                      ) ?? "kg",
                                    )
                                  : "kg"
                              }
                              value={s.weight}
                              onChange={(v) =>
                                updateSet(id, i, "weight", v.target.value)
                              }
                            />
                            <input
                              aria-label={`${e.name} set ${i + 1} reps`}
                              inputMode="numeric"
                              placeholder="reps"
                              value={s.reps}
                              onChange={(v) =>
                                updateSet(id, i, "reps", v.target.value)
                              }
                            />
                            <span className="previous-result">
                              {previous
                                ? `${previous.sets[id][i]?.weight || "—"} × ${previous.sets[id][i]?.reps || "—"}`
                                : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                      {history.length > 0 && (
                        <div className="history-toolbar">
                          <button
                            className="icon-button"
                            aria-label={`Older workout for ${e.name}`}
                            disabled={index >= history.length - 1}
                            onClick={() =>
                              setHistoryIndex((v) => ({
                                ...v,
                                [id]: index + 1,
                              }))
                            }
                          >
                            <span className="reverse">
                              <Icon type="chevron" />
                            </span>
                          </button>
                          <div>
                            <span className="eyebrow">
                              {index === 0 ? "LAST WORKOUT" : "SAVED WORKOUT"}
                            </span>
                            <time>{date(previous.date)}</time>
                          </div>
                          <button
                            className="icon-button"
                            aria-label={`Newer workout for ${e.name}`}
                            disabled={index === 0}
                            onClick={() =>
                              setHistoryIndex((v) => ({
                                ...v,
                                [id]: index - 1,
                              }))
                            }
                          >
                            <Icon type="chevron" />
                          </button>
                          <span className="toolbar-spacer" />
                          <button
                            className="icon-button"
                            aria-label={`Edit saved workout ${previous.id} for ${e.name}`}
                            onClick={() =>
                              setEditing({
                                day,
                                session: JSON.parse(JSON.stringify(previous)),
                              })
                            }
                          >
                            <Icon type="edit" />
                          </button>
                          <button
                            className="icon-button danger"
                            aria-label={`Delete saved workout ${previous.id} for ${e.name}`}
                            onClick={() =>
                              setDeleting({ day, session: previous })
                            }
                          >
                            <Icon type="trash" />
                          </button>
                        </div>
                      )}
                      {history[0] && (
                        <div className="draft-weight-progress">
                          <p>
                            Grey numbers are a conditional next-load preview,
                            rounded to your equipment step. Try them only when
                            ready; they are not saved until you type.
                          </p>
                          {(draft?.sets[id] || newSets()).filter(
                            (s) =>
                              s.weight.trim() !== "" &&
                              Number.isFinite(Number(s.weight)),
                          ).length > 0 && (
                            <div>
                              {(draft?.sets[id] || newSets()).map((s, i) => {
                                const old = Number(
                                  history[0].sets[id][i]?.weight,
                                );
                                const pct =
                                  s.weight.trim() !== ""
                                    ? percentChange(Number(s.weight), old)
                                    : null;
                                return pct !== null && Number.isFinite(pct) ? (
                                  <span key={i}>
                                    Set {i + 1}: {pct > 0 ? "+" : ""}
                                    {fmt(pct)}% weight vs last workout
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      <ProgressionControls
                        exercise={e}
                        history={history.map((session) => session.sets[id])}
                        settings={data.progressionSettings?.[id]}
                        onSave={(settings) =>
                          setData((d) => ({
                            ...d,
                            progressionSettings: {
                              ...d.progressionSettings,
                              [id]: settings,
                            },
                          }))
                        }
                      />
                      <div className="exercise-insight">
                        <Icon type="chart" />
                        <div>
                          {change && (
                            <p className="change-line">
                              {change.weight == null
                                ? "Load baseline"
                                : `${change.weight >= 0 ? "+" : ""}${fmt(change.weight)}% mean weight`}
                              <span> · </span>
                              {change.reps == null
                                ? "Rep baseline"
                                : `${change.reps >= 0 ? "+" : ""}${fmt(change.reps)}% total reps`}
                              <small>Last two sessions · same set count</small>
                            </p>
                          )}
                          <p>
                            {history.length
                              ? progressionAdvice(
                                  history.map((session) => session.sets[id]),
                                  e,
                                  data.progressionSettings?.[id],
                                )
                              : "Log your first session to establish a baseline."}
                          </p>
                          {history.length > 0 && (
                            <small>
                              A starting point, not a personalized training
                              prescription.
                            </small>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
            <p className="footnote">
              Weights in kilograms. Your history stays yours.
            </p>
          </>
        ) : (
          <>
            <section className="page-heading">
              <p className="eyebrow">MOVE WITH PURPOSE</p>
              <h1>Cardio</h1>
              <p className="supporting">Find your rhythm. Keep moving.</p>
            </section>
            <section className="cardio-form">
              <SectionTitle
                label="LOG AN ACTIVITY"
                title="Every minute matters."
              />
              <div className="activity-grid">
                {[
                  "Walking",
                  "Running",
                  "Spinning",
                  "Cycling",
                  "Swimming",
                  "Rowing",
                  "Elliptical",
                  "Stair climber",
                  "Hiking",
                  "Other",
                ].map((a) => (
                  <button
                    key={a}
                    className={a === activity ? "active" : ""}
                    onClick={() => setActivity(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div className="cardio-fields">
                <label>
                  DURATION <span>min</span>
                  <input
                    aria-label="Cardio duration in minutes"
                    inputMode="decimal"
                    placeholder="30"
                    value={minutes}
                    onChange={(e) =>
                      setMinutes(e.target.value.replace(",", "."))
                    }
                  />
                </label>
                <label>
                  DISTANCE <span>km</span>
                  <input
                    aria-label="Cardio distance in kilometers"
                    inputMode="decimal"
                    placeholder="2.5"
                    value={distance}
                    onChange={(e) =>
                      setDistance(e.target.value.replace(",", "."))
                    }
                  />
                </label>
              </div>
              <button className="primary" onClick={saveCardio}>
                Save activity
                <Icon type="arrow" />
              </button>
            </section>
            <section>
              <SectionTitle label="YOUR MOVEMENT" title="Activity history" />
              {data.cardio.length ? (
                data.cardio.map((c) => (
                  <div key={c.id} className="recent-session">
                    <span className="small-icon">
                      <Icon type="cardio" />
                    </span>
                    <div>
                      <h3>{c.activity}</h3>
                      <p>
                        {date(c.date)} · {c.minutes} min · {c.distance} km
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <Icon type="cardio" />
                  <h3>Make your first move.</h3>
                  <p>Your activities will appear here once logged.</p>
                </div>
              )}
            </section>
          </>
        )}
        {tab === "Weight-lifting" && (
          <div className="workout-action">
            <div>
              <strong>
                {completed}
                <span> / {ids.length * 3} sets</span>
              </strong>
              <small>{DAYS[day].replace(" Day", "")}</small>
            </div>
            <button className="primary" onClick={finish}>
              <Icon type="check" />
              Finish &amp; save workout
            </button>
          </div>
        )}
        <footer className="privacy-note">
          <span /> SAVED ON THIS DEVICE · NO ACCOUNT REQUIRED
        </footer>
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        {[
          ["Home", "home"],
          ["Weight-lifting", "lift"],
          ["Cardio", "cardio"],
        ].map(([label, icon]) => (
          <button
            key={label}
            className={tab === label ? "active" : ""}
            aria-current={tab === label ? "page" : undefined}
            onClick={() => setTab(label)}
          >
            <Icon type={icon} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {lastRemoved && (
        <div className="undo-removal" role="status">
          <span>{name(lastRemoved.id)} removed</span>
          <button onClick={() => restoreExercise(lastRemoved)}>Undo</button>
          <button
            aria-label="Dismiss removal notification"
            onClick={() => setLastRemoved(null)}
          >
            <Icon type="close" />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Icon type="check" />
          {notice}
        </div>
      )}
      {renaming && (
        <Dialog title="Rename exercise" onClose={() => setRenaming(null)}>
          <form onSubmit={saveName} className="custom-exercise-form">
            <p className="supporting">
              This changes its name in your list and history. Your saved sets
              stay linked.
            </p>
            <label>
              Exercise name
              <input
                aria-label="Exercise name"
                autoFocus
                maxLength={100}
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button className="primary" type="submit">
                Save name
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setRenaming(null)}
              >
                Cancel rename
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {picker && (
        <Dialog title={`${picker} exercises`} onClose={() => setPicker(null)}>
          <p className="supporting">
            Find your movement. Make it part of your session.
          </p>
          <button
            className="secondary custom-toggle"
            onClick={() => {
              setShowCustom((v) => !v);
              setCustomName(query);
            }}
          >
            <Icon type="plus" />
            Add custom exercise
          </button>
          {showCustom && (
            <form className="custom-exercise-form" onSubmit={createCustom}>
              <h3>Add to {picker}</h3>
              <label>
                Exercise name
                <input
                  aria-label="Custom exercise name"
                  maxLength={100}
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </label>
              <label>
                Equipment
                <select
                  aria-label="Custom exercise equipment"
                  value={customEquipment}
                  onChange={(e) => setCustomEquipment(e.target.value)}
                >
                  {[
                    "body only",
                    "barbell",
                    "dumbbell",
                    "cable",
                    "machine",
                    "bands",
                    "kettlebells",
                    "other",
                  ].map((eq) => (
                    <option key={eq}>{eq}</option>
                  ))}
                </select>
              </label>
              <button className="primary" type="submit">
                Create exercise
              </button>
            </form>
          )}
          <label className="search-box">
            <Icon type="search" />
            <input
              autoFocus
              aria-label="Search exercises"
              placeholder="Search exercises…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="filter-label">
            Equipment
            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            >
              {[
                "All",
                "barbell",
                "dumbbell",
                "cable",
                "machine",
                "body only",
                "bands",
                "kettlebells",
              ].map((eq) => (
                <option key={eq}>{eq}</option>
              ))}
            </select>
          </label>
          <p className="muted">
            {options.length} exercises · primary and supporting muscles
          </p>
          <div className="exercise-options">
            {options.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  setData((d) => {
                    const k = keyFor(day, picker);
                    return {
                      ...d,
                      removedExercises: (d.removedExercises || []).filter(
                        (x) =>
                          !(
                            x.day === day &&
                            x.group === picker &&
                            x.id === e.id
                          ),
                      ),
                      selections: {
                        ...d.selections,
                        [k]: Array.from(
                          new Set([...(d.selections[k] || []), e.id]),
                        ),
                      },
                    };
                  });
                  setPicker(null);
                  if (lastRemoved?.id === e.id) setLastRemoved(null);
                }}
              >
                <Photo id={e.id} label={e.name} interactive={false} />
                <div>
                  <h3>{e.name}</h3>
                  <p>
                    {e.primaryMuscles.join(", ")} ·{" "}
                    {e.equipment || "bodyweight"}
                  </p>
                </div>
                <Icon type="plus" />
              </button>
            ))}
            {!options.length && (
              <p className="empty-state">
                No matches. Try another search or equipment filter.
              </p>
            )}
          </div>
          <p className="footnote">
            Exercise data & photos: free-exercise-db · public domain
          </p>
        </Dialog>
      )}
      {editing && (
        <Dialog title="Edit saved workout" onClose={() => setEditing(null)}>
          <p className="supporting">
            {DAYS[editing.day]} · {date(editing.session.date)}
          </p>
          {Object.entries(editing.session.sets).map(([id, sets]) => (
            <section className="edit-exercise" key={id}>
              <h3>{name(id)}</h3>
              {sets.map((set, i) => (
                <div className="edit-row" key={i}>
                  <span>Set {i + 1}</span>
                  {(["weight", "reps"] as const).map((field) => (
                    <label key={field}>
                      <span>{field === "weight" ? "kg" : "reps"}</span>
                      <input
                        aria-label={`Edit ${id} set ${i + 1} ${field === "weight" ? "weight in kilograms" : "reps"}`}
                        inputMode={field === "weight" ? "decimal" : "numeric"}
                        value={set[field]}
                        onChange={(e) => {
                          const value = e.target.value.replace(",", ".");
                          setEditing((c) =>
                            c
                              ? {
                                  ...c,
                                  session: {
                                    ...c.session,
                                    sets: {
                                      ...c.session.sets,
                                      [id]: c.session.sets[id].map((s, j) =>
                                        j === i ? { ...s, [field]: value } : s,
                                      ),
                                    },
                                  },
                                }
                              : c,
                          );
                        }}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </section>
          ))}
          <div className="dialog-actions">
            <button className="primary" onClick={saveEdit}>
              Save changes
            </button>
            <button className="secondary" onClick={() => setEditing(null)}>
              Cancel editing
            </button>
          </div>
        </Dialog>
      )}
      {deleting && (
        <Dialog title="Delete saved workout?" onClose={() => setDeleting(null)}>
          <p className="supporting">
            {DAYS[deleting.day]} · {date(deleting.session.date)}
          </p>
          <p className="supporting">
            This deletes the entire saved workout, including all its exercises.
            It cannot be undone. Today’s unfinished entries stay as they are.
          </p>
          <div className="dialog-actions">
            <button className="destructive" onClick={removeSaved}>
              Delete workout
            </button>
            <button className="secondary" onClick={() => setDeleting(null)}>
              Keep workout
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <span className="eyebrow">{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <p>{detail}</p>
    </div>
  );
}
function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="section-title">
      <div>
        <p className="eyebrow">{label}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon type="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
