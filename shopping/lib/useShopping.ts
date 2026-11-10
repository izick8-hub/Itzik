"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { loadLocal, saveLocal, localRevision } from "./storage";
import { ShoppingStore } from "./cloudStore";
export { applyAction, type Action } from "./localActions";
export function useShopping() {
  const [controller] = useState(
    () =>
      new ShoppingStore(supabase, {
        load: loadLocal,
        save: saveLocal,
        revision: localRevision,
      }),
  );
  const [state, setState] = useState(controller.state);
  useEffect(() => {
    const unsubscribe = controller.subscribe(() => setState(controller.state));
    const stop = controller.start();
    controller.setOnline(navigator.onLine);
    const online = () => controller.setOnline(navigator.onLine);
    const focus = () => {
      if (controller.state.mode === "cloud")
        void controller.refresh().catch((e) => controller.setError(e.message));
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "together-cart:data:v1") controller.localChanged();
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("focus", focus);
    window.addEventListener("storage", storage);
    return () => {
      unsubscribe();
      stop();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("focus", focus);
      window.removeEventListener("storage", storage);
    };
  }, [controller]);
  return {
    ...state,
    cloudAvailable: !!supabase,
    dispatch: controller.dispatch,
    connect: controller.connect,
    restore: controller.restore,
    setError: controller.setError,
    retry: controller.retry,
    importLocal: controller.importLocal,
    dismissNotice: controller.dismissNotice,
  };
}
