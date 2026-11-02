import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import catalog from "./src/exercises.json";
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
const notify = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};
const STORAGE = "lift-journal:v1";
const muscleMap: Record<string, string[]> = {
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
const stamp = () => new Date().toISOString();
const dateLabel = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
function Button({
  title,
  onPress,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, secondary && styles.secondary]}
    >
      <Text style={[styles.buttonText, secondary && { color: "#eef3e9" }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Journal />
    </SafeAreaProvider>
  );
}
function Journal() {
  const [data, setData] = useState<Data>(emptyData);
  const [editing, setEditing] = useState<{day: number; session: Session} | null>(null);
  const [deleting, setDeleting] = useState<{day: number; session: Session} | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("Weight-lifting");
  const [day, setDay] = useState(0);
  const [picker, setPicker] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [equipment, setEquipment] = useState("All");
  const [activity, setActivity] = useState("Walking");
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [storageError, setStorageError] = useState("");
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    AsyncStorage.getItem(STORAGE)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            !parsed.selections ||
            !parsed.sessions ||
            !parsed.drafts ||
            !Array.isArray(parsed.cardio)
          )
            throw Error("Invalid stored data");
          setData(parsed);
        }
        setReady(true);
      })
      .catch(() =>
        setStorageError(
          "Unable to read your saved workouts. Restart the app to try again; existing data has not been overwritten.",
        ),
      );
  }, []);
  useEffect(() => {
    if (!ready) return;
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(STORAGE, JSON.stringify(data)))
      .then(() => setStorageError(""))
      .catch(() => {
        setStorageError(
          "Your latest changes could not be saved. Keep the app open and try another edit.",
        );
      });
  }, [data, ready]);
  const draft = data.drafts[day];
  const exerciseIds = GROUPS[day].flatMap(
    (g) => data.selections[keyFor(day, g)] || [],
  );
  function addExercise(id: string) {
    if (!picker) return;
    const group = picker;
    setData((d) => {
      const key = keyFor(day, group);
      if ((d.selections[key] || []).includes(id)) return d;
      return {
        ...d,
        selections: {
          ...d.selections,
          [key]: [...(d.selections[key] || []), id],
        },
      };
    });
    setPicker(null);
  }
  function removeExercise(group: string, exerciseId: string) {
    setData(current => {
      const key = keyFor(day, group);
      return {...current, selections: {...current.selections, [key]: (current.selections[key] || []).filter(id => id !== exerciseId)}};
    });
  }
  function editSet(
    id: string,
    index: number,
    field: "weight" | "reps",
    value: string,
  ) {
    setData((d) => {
      const session = d.drafts[day] || { id: stamp(), date: stamp(), sets: {} };
      const sets = (session.sets[id] || newSets()).map((s, i) =>
        i === index ? { ...s, [field]: value } : s,
      );
      return {
        ...d,
        drafts: {
          ...d.drafts,
          [day]: { ...session, sets: { ...session.sets, [id]: sets } },
        },
      };
    });
  }
  function finish() {
    if (
      !exerciseIds.length ||
      !draft ||
      !exerciseIds.every((id) => validSets(draft.sets[id] || newSets()))
    ) {
      notify(
        "Complete your sets",
        "Enter a weight (0 is allowed) and positive whole-number reps for all three sets of each exercise.",
      );
      return;
    }
    const complete: Session = {
      ...draft,
      sets: Object.fromEntries(exerciseIds.map((id) => [id, draft.sets[id]])),
    };
    setData((d) => {
      const drafts = { ...d.drafts };
      delete drafts[day];
      return {
        ...d,
        drafts,
        sessions: {
          ...d.sessions,
          [day]: [...(d.sessions[day] || []), complete],
        },
      };
    });
    notify(
      "Workout saved",
      "Your results now appear in a dated column beside your next workout.",
    );
  }
  function saveEditedWorkout() {
    if (!editing) return;
    if (!Object.values(editing.session.sets).every(validSets)) {
      notify("Check your sets", "Enter a weight of zero or more and positive whole-number reps for every set.");
      return;
    }
    const updated = editing;
    setData(d => ({...d, sessions: {...d.sessions, [updated.day]: (d.sessions[updated.day] || []).map(s => s.id === updated.session.id ? updated.session : s)}}));
    setEditing(null);
  }
  function deleteWorkout() {
    if (!deleting) return;
    const target = deleting;
    setData(d => ({...d, sessions: {...d.sessions, [target.day]: (d.sessions[target.day] || []).filter(s => s.id !== target.session.id)}}));
    setDeleting(null);
  }
  function saveCardio() {
    if (
      !Number.isFinite(Number(minutes)) ||
      Number(minutes) <= 0 ||
      distance.trim() === "" ||
      !Number.isFinite(Number(distance)) ||
      Number(distance) < 0
    ) {
      notify(
        "Check your activity",
        "Enter duration above zero and distance in kilometers (0 is allowed).",
      );
      return;
    }
    setData((d) => ({
      ...d,
      cardio: [
        { id: stamp(), date: stamp(), activity, minutes, distance },
        ...d.cardio,
      ],
    }));
    setMinutes("");
    setDistance("");
  }
  if (!ready)
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.title}>Lift Journal</Text>
        {storageError ? (
          <Text style={styles.error}>{storageError}</Text>
        ) : (
          <ActivityIndicator color="#b5f36a" />
        )}
      </SafeAreaView>
    );
  const options = picker
    ? catalog.filter(
        (e) =>
          muscleMap[picker].some(
            (m) =>
              e.primaryMuscles.includes(m) || e.secondaryMuscles.includes(m),
          ) &&
          e.name.toLowerCase().includes(search.toLowerCase()) &&
          (equipment === "All" || e.equipment === equipment),
      )
    : [];
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>YOUR PERSONAL TRAINING LOG</Text>
        <Text style={styles.title}>Lift Journal</Text>
        <Text style={styles.subtitle}>A little stronger, every session.</Text>
        <View style={styles.row}>
          {["Weight-lifting", "Cardio"].map((t) => (
            <Button
              key={t}
              title={t}
              secondary={tab !== t}
              onPress={() => setTab(t)}
            />
          ))}
        </View>
        {!!storageError && <Text style={styles.error}>{storageError}</Text>}
        {tab === "Weight-lifting" ? (
          <>
            <Text style={styles.label}>WORKOUT DAY</Text>
            {DAYS.map((d, i) => (
              <Pressable
                key={d}
                onPress={() => setDay(i)}
                style={[styles.day, day === i && styles.selected]}
              >
                <Text style={styles.dayText}>{d}</Text>
                <Text style={styles.muted}>
                  {day === i ? "Selected" : "Choose →"}
                </Text>
              </Pressable>
            ))}
            <View style={styles.row}>
              <Text style={styles.heading}>Your exercises</Text>
              <Text style={styles.muted}>
                {(data.sessions[day] || []).length} workouts saved
              </Text>
            </View>
            {GROUPS[day].map((group) => (
              <View key={group}>
                <View style={styles.row}>
                  <Text style={styles.group}>{group}</Text>
                  <Button
                    title="+ Exercise"
                    secondary
                    onPress={() => {
                      setPicker(group);
                      setSearch("");
                      setEquipment("All");
                    }}
                  />
                </View>
                {!(data.selections[keyFor(day, group)] || []).length && (
                  <Text style={styles.empty}>
                    Choose your first {group.toLowerCase()} exercise.
                  </Text>
                )}
                {(data.selections[keyFor(day, group)] || []).map((id) => {
                  const e = catalog.find((e) => e.id === id);
                  if (!e) return null;
                  const history = (data.sessions[day] || [])
                    .filter((s) => s.sets[id])
                    .slice()
                    .reverse();
                  return (
                    <View key={id} style={styles.card}>
                      <View style={styles.exerciseHeader}>
                        <ExerciseImage path={e.images[0]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.exerciseName}>{e.name}</Text>
                          <Text style={styles.muted}>
                            {e.equipment || "Bodyweight"} · kg × reps
                          </Text>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${e.name} from ${group}`} onPress={() => removeExercise(group, id)} style={styles.iconButton}>
                          <Text style={styles.deleteIcon}>−</Text>
                        </Pressable>
                      </View>
                      <ScrollView
                        horizontal
                        keyboardShouldPersistTaps="handled"
                      >
                        <View>
                          <View style={styles.row}>
                            <View style={styles.setColumn}>
                              <Text style={styles.label}>SET</Text>
                              {[1, 2, 3].map((n) => (
                                <Text key={n} style={styles.setNumber}>
                                  {n}
                                </Text>
                              ))}
                            </View>
                            <View style={styles.todayColumn}>
                              <Text style={styles.columnTitle}>
                                Today · {dateLabel(draft?.date || stamp())}
                              </Text>
                              {(draft?.sets[id] || newSets()).map((s, i) => (
                                <View key={i} style={styles.inputRow}>
                                  <TextInput
                                    accessibilityLabel={`${e.name} set ${i + 1} weight in kilograms`}
                                    placeholder="kg"
                                    placeholderTextColor="#89938f"
                                    keyboardType="decimal-pad"
                                    value={s.weight}
                                    onChangeText={(v) =>
                                      editSet(
                                        id,
                                        i,
                                        "weight",
                                        v.replace(",", "."),
                                      )
                                    }
                                    style={styles.input}
                                  />
                                  <Text style={styles.muted}>×</Text>
                                  <TextInput
                                    accessibilityLabel={`${e.name} set ${i + 1} reps`}
                                    placeholder="reps"
                                    placeholderTextColor="#89938f"
                                    keyboardType="number-pad"
                                    value={s.reps}
                                    onChangeText={(v) =>
                                      editSet(id, i, "reps", v)
                                    }
                                    style={styles.input}
                                  />
                                </View>
                              ))}
                            </View>
                            {history.map((s) => (
                              <View key={s.id} style={styles.historyColumn}>
                                <Text style={styles.columnTitle}>
                                  {dateLabel(s.date)}
                                </Text>
                                {s.sets[id].map((set, i) => (
                                  <Text key={i} style={styles.result}>
                                    {set.weight} × {set.reps}
                                  </Text>
                                ))}
                                <View style={styles.historyActions}>
                                  <Pressable accessibilityRole="button" accessibilityLabel={`Edit saved workout ${s.id} for ${e.name}`} onPress={() => setEditing({day, session: JSON.parse(JSON.stringify(s))})} style={styles.iconButton}><Text style={styles.editIcon}>✎</Text></Pressable>
                                  <Pressable accessibilityRole="button" accessibilityLabel={`Delete saved workout ${s.id} for ${e.name}`} onPress={() => setDeleting({day, session:s})} style={styles.iconButton}><Text style={styles.deleteIcon}>🗑</Text></Pressable>
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                      </ScrollView>
                      <Text style={styles.hint}>
                        Today first · swipe for earlier workouts →
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
            <Button title="Finish & save workout" onPress={finish} />
          </>
        ) : (
          <>
            <Text style={styles.heading}>Keep moving</Text>
            <Text style={styles.subtitle}>
              Record your cardio in minutes and kilometers.
            </Text>
            <View style={styles.wrap}>
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
                <Button
                  key={a}
                  title={a}
                  secondary={activity !== a}
                  onPress={() => setActivity(a)}
                />
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>DURATION · MINUTES</Text>
              <TextInput
                accessibilityLabel="Cardio duration in minutes"
                keyboardType="decimal-pad"
                value={minutes}
                onChangeText={setMinutes}
                placeholder="30"
                placeholderTextColor="#89938f"
                style={styles.fullInput}
              />
              <Text style={styles.label}>DISTANCE · KILOMETERS</Text>
              <TextInput
                accessibilityLabel="Cardio distance in kilometers"
                keyboardType="decimal-pad"
                value={distance}
                onChangeText={(v) => setDistance(v.replace(",", "."))}
                placeholder="2.5"
                placeholderTextColor="#89938f"
                style={styles.fullInput}
              />
              <Button title="Save activity" onPress={saveCardio} />
            </View>
            <Text style={styles.heading}>Activity history</Text>
            {!data.cardio.length && (
              <Text style={styles.empty}>Your first activity starts here.</Text>
            )}
            {data.cardio.map((c) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.exerciseName}>{c.activity}</Text>
                <Text style={styles.subtitle}>
                  {dateLabel(c.date)} · {c.minutes} min · {c.distance} km
                </Text>
              </View>
            ))}
          </>
        )}
        <Text style={styles.footer}>
          Saved on this device · no account required
        </Text>
      </ScrollView>
      <Modal visible={editing !== null} animationType="slide" onRequestClose={() => setEditing(null)}>
        <SafeAreaView style={styles.root}>
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>Edit saved workout</Text>
            <Text style={styles.subtitle}>{editing ? DAYS[editing.day] : ''} · {editing ? new Date(editing.session.date).toLocaleString() : ''}</Text>
            <Text style={styles.muted}>Changes update this saved workout. Today’s entries stay as they are.</Text>
            {editing && Object.entries(editing.session.sets).map(([exerciseId, sets]) => <View key={exerciseId} style={styles.card}>
              <Text style={styles.exerciseName}>{catalog.find(e => e.id === exerciseId)?.name || exerciseId}</Text>
              {sets.map((set, index) => <View key={index} style={styles.row}>
                <Text style={styles.muted}>Set {index + 1}</Text>
                <TextInput accessibilityLabel={`Edit ${exerciseId} set ${index + 1} weight in kilograms`} value={set.weight} keyboardType="decimal-pad" style={styles.input} onChangeText={value => setEditing(current => current ? {...current, session: {...current.session, sets: {...current.session.sets, [exerciseId]: current.session.sets[exerciseId].map((entry, i) => i === index ? {...entry, weight:value.replace(',', '.')} : entry)}}} : current)} />
                <Text style={styles.muted}>kg ×</Text>
                <TextInput accessibilityLabel={`Edit ${exerciseId} set ${index + 1} reps`} value={set.reps} keyboardType="number-pad" style={styles.input} onChangeText={value => setEditing(current => current ? {...current, session: {...current.session, sets: {...current.session.sets, [exerciseId]: current.session.sets[exerciseId].map((entry, i) => i === index ? {...entry, reps:value} : entry)}}} : current)} />
                <Text style={styles.muted}>reps</Text>
              </View>)}
            </View>)}
            <Button title="Save changes" onPress={saveEditedWorkout}/>
            <Button title="Cancel editing" secondary onPress={() => setEditing(null)}/>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal visible={deleting !== null} transparent animationType="fade" onRequestClose={() => setDeleting(null)}>
        <View style={styles.confirmOverlay}><View style={styles.confirmCard}>
          <Text style={styles.heading}>Delete saved workout?</Text>
          <Text style={styles.subtitle}>{deleting ? DAYS[deleting.day] : ''} · {deleting ? new Date(deleting.session.date).toLocaleString() : ''}</Text>
          <Text style={styles.subtitle}>This deletes the entire saved workout, including every exercise in its dated column. This cannot be undone. Today’s entries will remain.</Text>
          <Button title="Delete workout" onPress={deleteWorkout}/>
          <Button title="Keep workout" secondary onPress={() => setDeleting(null)}/>
        </View></View>
      </Modal>
      <Modal
        visible={picker !== null}
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <SafeAreaView style={styles.root}>
          <View style={styles.page}>
            <View style={styles.row}>
              <Text style={styles.heading}>{picker} exercises</Text>
              <Button title="Done" secondary onPress={() => setPicker(null)} />
            </View>
            <TextInput
              accessibilityLabel="Search exercises"
              value={search}
              onChangeText={setSearch}
              placeholder="Search exercises…"
              placeholderTextColor="#89938f"
              style={styles.fullInput}
            />
            <ScrollView horizontal style={{ maxHeight: 52 }}>
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
                <Button
                  key={eq}
                  title={eq}
                  secondary={equipment !== eq}
                  onPress={() => setEquipment(eq)}
                />
              ))}
            </ScrollView>
            <Text style={styles.muted}>
              {options.length} exercises · primary and supporting muscles
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {options.map((e) => (
              <Pressable
                accessibilityRole="button"
                key={e.id}
                onPress={() => addExercise(e.id)}
                style={styles.exerciseOption}
              >
                <ExerciseImage path={e.images[0]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{e.name}</Text>
                  <Text style={styles.muted}>
                    {e.primaryMuscles.join(", ")} ·{" "}
                    {e.equipment || "bodyweight"}
                  </Text>
                </View>
                <Text style={styles.group}>+</Text>
              </Pressable>
            ))}
            {!options.length && (
              <Text style={styles.empty}>
                No matches. Try another search or equipment filter.
              </Text>
            )}
          </ScrollView>
          <Text style={styles.footer}>
            Exercise data & photos: free-exercise-db · public domain
          </Text>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
function ExerciseImage({ path }: { path: string | undefined }) {
  const [failed, setFailed] = useState(false);
  return path && !failed ? (
    <Image
      accessibilityLabel="Exercise demonstration"
      source={{
        uri: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${path}`,
      }}
      onError={() => setFailed(true)}
      style={styles.photo}
    />
  ) : (
    <View
      style={[styles.photo, { justifyContent: "center", alignItems: "center" }]}
    >
      <Text style={styles.muted}>No photo</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#101714",
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  page: { padding: 20, gap: 14 },
  eyebrow: {
    color: "#b5f36a",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: { fontSize: 36, fontWeight: "800", color: "#f3f5ed" },
  subtitle: { color: "#abb7af", fontSize: 14, lineHeight: 22 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
  },
  button: {
    backgroundColor: "#b5f36a",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 3,
  },
  secondary: { backgroundColor: "#34463b" },
  buttonText: { color: "#101714", fontWeight: "800" },
  label: {
    color: "#a9b6ac",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginVertical: 6,
  },
  day: {
    backgroundColor: "#1c2821",
    padding: 15,
    borderRadius: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#344139",
  },
  selected: { borderColor: "#b5f36a" },
  dayText: { color: "#eef3e9", fontWeight: "600", fontSize: 14 },
  muted: { color: "#a9b6ac", fontSize: 12 },
  heading: { color: "#f3f5ed", fontSize: 21, fontWeight: "700", marginTop: 8 },
  group: { color: "#b5f36a", fontSize: 19, fontWeight: "700" },
  empty: { color: "#899b8e", paddingVertical: 20, lineHeight: 22 },
  card: {
    backgroundColor: "#1c2821",
    borderRadius: 18,
    padding: 14,
    marginVertical: 8,
    gap: 12,
  },
  exerciseHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  exerciseName: {
    color: "#f3f5ed",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 5,
  },
  photo: { height: 68, width: 68, borderRadius: 12, backgroundColor: "#fff" },
  setColumn: { width: 30, alignItems: "center" },
  setNumber: {
    height: 48,
    textAlignVertical: "center",
    paddingTop: 15,
    color: "#a9b6ac",
  },
  todayColumn: { width: 164 },
  historyActions: {flexDirection: 'row', gap: 4, marginTop: 8},
  iconButton: {minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#101714'},
  editIcon: {fontSize: 25, color: '#b5f36a'},
  deleteIcon: {fontSize: 22, color: '#ffb6aa'},
  confirmOverlay: {flex: 1, backgroundColor: '#000b', justifyContent: 'center', alignItems: 'center', padding: 20},
  confirmCard: {backgroundColor: '#1c2821', padding: 22, borderRadius: 18, gap: 14, width:'100%', maxWidth: 480},
  historyColumn: { width: 120, alignItems: "center" },
  columnTitle: {
    color: "#b5f36a",
    fontSize: 11,
    fontWeight: "700",
    height: 26,
    paddingTop: 6,
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 5, height: 48 },
  input: {
    backgroundColor: "#101714",
    color: "#fff",
    borderRadius: 8,
    padding: 10,
    width: 66,
    fontSize: 15,
  },
  result: { color: "#d6e0d5", height: 48, paddingTop: 15 },
  hint: { color: "#899b8e", fontSize: 11 },
  fullInput: {
    backgroundColor: "#25362b",
    color: "#fff",
    borderRadius: 10,
    padding: 14,
    fontSize: 17,
    marginBottom: 10,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  footer: { color: "#899b8e", textAlign: "center", fontSize: 11, padding: 16 },
  exerciseOption: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#344139",
  },
  error: { color: "#ffb6aa", padding: 10 },
});
