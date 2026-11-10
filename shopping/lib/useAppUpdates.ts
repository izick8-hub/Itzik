"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "local";
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
export function useAppUpdates() {
  const [available, setAvailable] = useState(false),
    [checking, setChecking] = useState(false),
    [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const check = useCallback(async (manual = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (manual) setChecking(true);
    try {
      const response = await fetch(`${base}/version.json`, {
        cache: "no-store",
      });
      if (!response.ok) throw Error("version unavailable");
      const data = await response.json();
      if (typeof data.version !== "string") throw Error("invalid metadata");
      const newer = data.version !== APP_VERSION;
      setAvailable(newer);
      if (manual)
        setMessage(
          newer
            ? "מואני מצאה עדכון חדש לאתר 🐾"
            : "מואני בדקה: זו הגרסה העדכנית שמפורסמת כרגע 🐾",
        );
      if ("serviceWorker" in navigator)
        void navigator.serviceWorker
          .getRegistration(`${base}/`)
          .then((reg) => reg?.update())
          .catch(() => {});
    } catch {
      if (manual) setMessage("לא הצלחנו לבדוק עדכונים. התחברו לרשת ונסו שוב.");
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void check();
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const focus = () => void check();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    const change = () => void check();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.addEventListener("controllerchange", change);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
      if ("serviceWorker" in navigator)
        navigator.serviceWorker.removeEventListener("controllerchange", change);
    };
  }, [check]);
  return {
    available,
    checking,
    message,
    check,
    load: () => window.location.reload(),
  };
}
