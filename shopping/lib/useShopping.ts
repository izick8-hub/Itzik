"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  emptyData,
  type Data,
  type List,
  type Item,
  type Receipt,
  duplicateList,
} from "./model";
import type { Product } from "./catalog";
import { loadLocal, saveLocal } from "./storage";
export type Action =
  | { type: "list"; value: List }
  | { type: "item"; value: Item; expected?: number }
  | { type: "deleteItem"; id: string; expected: number }
  | { type: "product"; value: Product }
  | { type: "receipt"; value: Receipt }
  | { type: "confirmReceipt"; value: Receipt }
  | { type: "duplicate"; id: string; date: string };
export function applyAction(data: Data, action: Action): Data {
  const upsert = <T extends { id: string }>(rows: T[], value: T) => [
    ...rows.filter((r) => r.id !== value.id),
    value,
  ];
  switch (action.type) {
    case "list": {
      const old = data.lists.find((l) => l.id === action.value.id);
      if (old && old.version !== action.value.version)
        throw Error("הרשימה השתנתה. נסו שוב.");
      return {
        ...data,
        lists: upsert(data.lists, {
          ...action.value,
          version: old ? old.version + 1 : 1,
        }),
      };
    }
    case "item": {
      const existing = data.items.find((i) => i.id === action.value.id);
      if (
        (existing && existing.version !== action.expected) ||
        (!existing && action.expected !== undefined)
      )
        throw Error("המוצר השתנה. הרשימה עודכנה; נסו שוב.");
      return {
        ...data,
        items: upsert(data.items, {
          ...action.value,
          version: (existing?.version || 0) + 1,
        }),
      };
    }
    case "deleteItem": {
      const existing = data.items.find((i) => i.id === action.id);
      if (existing && existing.version !== action.expected)
        throw Error("המוצר השתנה. נסו שוב.");
      return { ...data, items: data.items.filter((i) => i.id !== action.id) };
    }
    case "product":
      return { ...data, products: upsert(data.products, action.value) };
    case "receipt": {
      const old = data.receipts.find((r) => r.id === action.value.id);
      if (old?.status === "confirmed")
        throw Error("קבלה מאושרת אינה ניתנת לשינוי.");
      if (old && (old.version || 1) !== (action.value.version || 1))
        throw Error("הטיוטה השתנתה. פתחו אותה מחדש.");
      return {
        ...data,
        receipts: upsert(data.receipts, {
          ...action.value,
          version: old ? (old.version || 1) + 1 : 1,
        }),
      };
    }
    case "confirmReceipt":
      if (
        data.receipts.some(
          (r) =>
            r.id === action.value.id &&
            (r.status === "confirmed" ||
              (r.version || 1) !== (action.value.version || 1)),
        )
      )
        throw Error("הקבלה כבר אושרה.");
      return {
        ...data,
        receipts: upsert(data.receipts, {
          ...action.value,
          status: "confirmed",
        }),
        lists: data.lists.map((l) =>
          l.id === action.value.list_id
            ? { ...l, status: "completed", version: l.version + 1 }
            : l,
        ),
      };
    case "duplicate": {
      const original = data.lists.find((l) => l.id === action.id);
      if (!original) throw Error("הרשימה לא נמצאה");
      const copy = duplicateList(original, data.items, action.date);
      return {
        ...data,
        lists: [...data.lists, copy.list],
        items: [...data.items, ...copy.items],
      };
    }
  }
}
export function useShopping() {
  const [data, setData] = useState<Data>(emptyData),
    [ready, setReady] = useState(false),
    [session, setSession] = useState<Session | null>(null),
    [household, setHousehold] = useState<string | null>(null),
    [mode, setMode] = useState<"local" | "cloud">("local"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sync, setSync] = useState("מקומי במכשיר הזה"),
    [online, setOnline] = useState(true);
  const ref = useRef(data);
  ref.current = data;
  const busyRef = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    try {
      setData(loadLocal() || emptyData);
    } catch {
      setError(
        "לא הצלחנו לקרוא את הנתונים השמורים. לא נדרוס אותם; אפשר לנסות לטעון גיבוי.",
      );
    }
    setReady(true);
    setOnline(navigator.onLine);
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    const local = (event: StorageEvent) => {
      if (event.key === "together-cart:data:v1")
        try {
          setData(loadLocal() || emptyData);
        } catch {
          setError("הנתונים המקומיים לא תקינים");
        }
    };
    window.addEventListener("storage", local);
    if (!supabase)
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", on);
        window.removeEventListener("storage", local);
      };
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      generation.current++;
      setSession(s);
      setHousehold(null);
      if (!s) {
        setMode("local");
        try {
          setData(loadLocal() || emptyData);
        } catch {
          setData(emptyData);
        }
      }
    });
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("storage", local);
    };
  }, []);
  const refresh = useCallback(async (hid: string) => {
    if (!supabase) return;
    const gen = generation.current;
    const results = await Promise.all([
      supabase.from("shopping_lists").select("*").eq("household_id", hid),
      supabase.from("shopping_items").select("*").eq("household_id", hid),
      supabase.from("shopping_products").select("data").eq("household_id", hid),
      supabase.from("shopping_receipts").select("*").eq("household_id", hid),
    ]);
    if (results.some((r) => r.error))
      throw Error("טעינת הנתונים נכשלה. בדקו את החיבור וההרשאות.");
    if (gen !== generation.current) return;
    setData({
      lists: results[0].data as unknown as List[],
      items: results[1].data as unknown as Item[],
      products: results[2].data!.map(
        (r) => (r as unknown as { data: Product }).data,
      ),
      receipts: results[3].data as unknown as Receipt[],
    });
  }, []);
  useEffect(() => {
    if (!session || !supabase) return;
    let cancelled = false;
    void supabase
      .from("shopping_members")
      .select("household_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error)
          setError(
            "לא ניתן לקרוא את משק הבית. צריך להפעיל את הגדרת בסיס הנתונים.",
          );
        if (data) {
          setHousehold(data.household_id);
          setMode("cloud");
          void refresh(data.household_id).catch((e) => setError(e.message));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, refresh]);
  useEffect(() => {
    if (mode !== "cloud" || !household || !supabase) return;
    setSync("מתחברים לשיתוף…");
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => void refresh(household).catch((e) => setError(e.message)),
        150,
      );
    };
    const channel = supabase
      .channel(`shopping-${household}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_lists",
          filter: `household_id=eq.${household}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
          filter: `household_id=eq.${household}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_receipts",
          filter: `household_id=eq.${household}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_products",
          filter: `household_id=eq.${household}`,
        },
        update,
      )
      .subscribe((status) => {
        setSync(
          status === "SUBSCRIBED"
            ? "מחוברים לשיתוף חי"
            : "השיתוף מנותק · מנסים להתחבר",
        );
        if (status === "SUBSCRIBED") update();
      });
    const focus = () => update();
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    const poll = setInterval(update, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      void supabase!.removeChannel(channel);
    };
  }, [mode, household, refresh]);
  async function dispatch(action: Action) {
    if (busyRef.current) throw Error("רגע, השינוי הקודם עדיין נשמר");
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (mode === "cloud") {
        if (!online)
          throw Error("אין חיבור. השינוי לא נשמר; נסו שוב כשתחזרו לרשת.");
        const { error } = await supabase!.rpc("shopping_mutate", { action });
        if (error) {
          await refresh(household!);
          throw Error(
            error.message.includes("conflict")
              ? "המוצר השתנה אצל השותף. הרשימה עודכנה; נסו שוב."
              : "השינוי לא נשמר. בדקו חיבור והרשאות ונסו שוב.",
          );
        }
        await refresh(household!);
      } else {
        const write = async () => {
          const latest = loadLocal() || emptyData;
          const next = applyAction(latest, action);
          saveLocal(next);
          setData(next);
        };
        if (navigator.locks)
          await navigator.locks.request("together-cart-write", write);
        else await write();
      }
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function connect(name: string, code?: string) {
    const { data, error } = await supabase!.rpc(
      code ? "shopping_join_household" : "shopping_create_household",
      code ? { invite: code.trim() } : { label: name },
    );
    if (error)
      throw Error(
        "לא ניתן להצטרף. בדקו את קוד ההזמנה או אם הבית כבר כולל שני משתמשים.",
      );
    setHousehold(data);
    setMode("cloud");
    await refresh(data);
  }
  async function restore(next: Data) {
    if (mode === "cloud") throw Error("ייבוא גיבוי זמין במצב מקומי בלבד.");
    saveLocal(next);
    setData(next);
  }
  return {
    data,
    ready,
    session,
    household,
    mode,
    error,
    setError,
    busy,
    sync: mode === "local" ? "מקומי במכשיר הזה" : sync,
    online,
    dispatch,
    connect,
    restore,
    cloudAvailable: !!supabase,
  };
}
