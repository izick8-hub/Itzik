import type {
  Session,
  SupabaseClient,
  RealtimeChannel,
} from "@supabase/supabase-js";
import { emptyData, type Data } from "./model.ts";
import { applyAction, type Action } from "./localActions.ts";
import {
  detectAdditions,
  mergeNotices,
  type ShoppingNotice,
} from "./notifications.ts";
export type Mode =
  | "loading"
  | "signin"
  | "connecting"
  | "needs-household"
  | "cloud"
  | "local"
  | "error";
export type State = {
  data: Data;
  localData: Data;
  ready: boolean;
  session: Session | null;
  household: string | null;
  mode: Mode;
  error: string;
  busy: boolean;
  sync: string;
  online: boolean;
  notifications: ShoppingNotice[];
};
type Persistence = {
  load: () => Data | null;
  save: (data: Data) => void;
  revision?: () => number;
};
export function cloudError(
  error: unknown,
  context = "השמירה בענן לא אושרה",
): Error {
  const e = error as { code?: string; message?: string };
  const code =
    e?.code && /^[A-Za-z0-9_-]{1,20}$/.test(e.code) ? ` (${e.code})` : "";
  if (e?.code === "PGRST202" || e?.code === "42883")
    return Error(
      "חסרה הגדרת בסיס הנתונים לעדכון הסנכרון. יש להריץ את migration ‏202611080001 בענן. לא בוצעה שמירה מקומית כתחליף.",
    );
  if (e?.message?.includes("conflict"))
    return Error("הנתון השתנה אצל המשתמש השני. רעננו את הרשימה ונסו שוב.");
  return Error(
    `${context}${code}. לא נשמר עותק מקומי כתחליף. אם החיבור נותק, ייתכן שהבקשה התקבלה; רעננו לפני ניסיון נוסף.`,
  );
}
export function snapshot(result: unknown, hid: string): Data {
  const s = result as Data & { household_id?: string };
  if (
    !s ||
    s.household_id !== hid ||
    !["lists", "items", "products", "receipts"].every((k) =>
      Array.isArray(s[k as keyof Data]),
    )
  )
    throw Error(
      "לא התקבל אישור תקין מבסיס הנתונים. הנתונים המקומיים נשארו ללא שינוי.",
    );
  return {
    lists: s.lists,
    items: s.items,
    products: s.products,
    receipts: s.receipts,
  };
}
export function verifyWrite(data: Data, action: Action) {
  if (
    action.type === "completeList" &&
    !data.lists.some((l) => l.id === action.id && l.status === "completed")
  )
    throw Error("בסיס הנתונים לא אישר את סיום הקנייה.");
  if (
    action.type === "list" &&
    !data.lists.some(
      (l) =>
        l.id === action.value.id &&
        l.name === action.value.name &&
        l.date === action.value.date,
    )
  )
    throw Error("בסיס הנתונים לא אישר שהרשימה נשמרה.");
  if (
    action.type === "item" &&
    !data.items.some(
      (i) =>
        i.id === action.value.id &&
        i.list_id === action.value.list_id &&
        i.quantity === action.value.quantity &&
        i.checked === action.value.checked &&
        i.unit === action.value.unit,
    )
  )
    throw Error("בסיס הנתונים לא אישר שהמוצר נשמר.");
  if (
    action.type === "deleteItem" &&
    data.items.some((i) => i.id === action.id)
  )
    throw Error("בסיס הנתונים לא אישר שהמוצר הוסר.");
  if (
    action.type === "product" &&
    !data.products.some((p) => p.id === action.value.id)
  )
    throw Error("בסיס הנתונים לא אישר שהמוצר האישי נשמר.");
  if (
    (action.type === "receipt" || action.type === "confirmReceipt") &&
    !data.receipts.some(
      (r) =>
        r.id === action.value.id &&
        (action.type !== "confirmReceipt" || r.status === "confirmed"),
    )
  )
    throw Error("בסיס הנתונים לא אישר שהקבלה נשמרה.");
}
export class ShoppingStore {
  state: State;
  private listeners = new Set<() => void>();
  private epoch = 0;
  private identity: string | null | undefined;
  private stopped = false;
  private readSequence = 0;
  private channel: RealtimeChannel | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private live = false;
  private subscriptionId = 0;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private localVersion = 0;
  private ownAdditions = new Set<string>();
  private client: SupabaseClient | null;
  private persistence: Persistence;
  constructor(client: SupabaseClient | null, persistence: Persistence) {
    this.client = client;
    this.persistence = persistence;
    this.state = {
      data: emptyData,
      localData: emptyData,
      ready: false,
      session: null,
      household: null,
      mode: client ? "loading" : "local",
      error: "",
      busy: false,
      sync: client ? "בודקים חיבור לענן…" : "מקומי במכשיר הזה",
      online: true,
      notifications: [],
    };
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private set(patch: Partial<State>) {
    if (this.stopped) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  setError = (error: string) => this.set({ error });
  dismissNotice = (id?: string) =>
    this.set({
      notifications: id
        ? this.state.notifications.filter((n) => n.id !== id)
        : [],
    });
  localChanged = () => {
    try {
      const localData = this.persistence.load() || emptyData;
      const version = this.persistence.revision?.() || 0;
      if (version < this.localVersion) return; // delayed storage events must not undo a newer local write
      this.localVersion = version;
      this.set({ localData, ...(!this.client ? { data: localData } : {}) });
    } catch {
      this.setError(
        "לא ניתן לקרוא את הנתונים המקומיים. הם לא נמחקו ולא נדרסו.",
      );
    }
  };
  start() {
    this.stopped = false;
    this.identity = undefined;
    const startEpoch = this.epoch;
    if (this.client) this.set({ mode: "loading", ready: false });
    this.localChanged();
    if (!this.client) {
      this.set({ ready: true });
      return () => this.stop();
    }
    let eventSeen = false;
    const listener = this.client.auth.onAuthStateChange((_event, s) => {
      eventSeen = true;
      this.authChanged(s);
    }).data.subscription;
    void this.client.auth
      .getSession()
      .then(({ data, error }) => {
        if (this.stopped || eventSeen || startEpoch !== this.epoch) return;
        if (error)
          this.failConnection(cloudError(error, "לא ניתן לאמת התחברות"));
        else this.authChanged(data.session);
      })
      .catch((e) => {
        if (!this.stopped && startEpoch === this.epoch)
          this.failConnection(cloudError(e, "לא ניתן לאמת התחברות"));
      });
    return () => {
      listener.unsubscribe();
      this.stop();
    };
  }
  private stop() {
    this.stopped = true;
    this.epoch++;
    this.unbind();
  }
  private unbind() {
    this.subscriptionId++;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    if (this.channel) void this.client!.removeChannel(this.channel);
    this.channel = null;
    this.live = false;
  }
  private failConnection(e: Error) {
    this.set({
      mode: "error",
      ready: true,
      error: e.message,
      sync: "חיבור הענן לא אומת — השמירה חסומה",
    });
  }
  private authChanged(s: Session | null) {
    if (this.stopped) return;
    this.set({ session: s });
    const id = s?.user.id || null;
    if (this.identity === id) return;
    this.identity = id;
    const epoch = ++this.epoch;
    this.unbind();
    this.ownAdditions.clear();
    this.set({
      household: null,
      data: emptyData,
      error: "",
      notifications: [],
    });
    if (!s) {
      this.set({
        mode: "signin",
        ready: true,
        sync: "נדרשת כניסה לשמירה בענן",
      });
      return;
    }
    this.set({
      mode: "connecting",
      ready: false,
      sync: "טוענים את הבית מהענן…",
    });
    // Never await Supabase methods inside its auth callback (the Auth lock is held).
    setTimeout(() => {
      if (!this.stopped && epoch === this.epoch)
        void this.resolveMembership(epoch);
    }, 0);
  }
  private current(epoch: number, hid?: string) {
    return (
      !this.stopped &&
      epoch === this.epoch &&
      (!hid || this.state.household === hid)
    );
  }
  private async resolveMembership(epoch = this.epoch) {
    if (!this.client || !this.state.session) return;
    try {
      const { data, error } = await this.client
        .from("shopping_members")
        .select("household_id")
        .eq("user_id", this.state.session.user.id)
        .maybeSingle();
      if (!this.current(epoch)) return;
      if (error) throw cloudError(error, "לא ניתן לקרוא את שיוך הבית");
      if (!data) {
        this.set({
          mode: "needs-household",
          ready: true,
          sync: "יש ליצור בית או להצטרף לבית",
        });
        return;
      }
      await this.enterHousehold(data.household_id, epoch);
    } catch (e) {
      if (this.current(epoch)) this.failConnection(e as Error);
    }
  }
  private async enterHousehold(hid: string, epoch: number) {
    this.set({ household: hid, mode: "connecting", ready: false });
    await this.refresh(hid, epoch);
    if (!this.current(epoch, hid)) throw Error("החשבון השתנה בזמן טעינת הבית.");
    this.set({ mode: "cloud", ready: true });
    this.bind(hid, epoch);
  }
  refresh = async (hid = this.state.household, epoch = this.epoch) => {
    if (!this.client || !hid) throw Error("הבית בענן טרם אומת.");
    const sequence = ++this.readSequence;
    const { data, error } = await this.client.rpc("shopping_snapshot", {
      expected_household: hid,
    });
    if (!this.current(epoch, hid)) throw Error("החשבון השתנה בזמן הבקשה.");
    if (error) throw cloudError(error, "טעינת הנתונים מהענן נכשלה");
    const next = snapshot(data, hid);
    if (sequence === this.readSequence)
      this.set({
        notifications:
          this.state.mode === "cloud"
            ? mergeNotices(
                this.state.notifications,
                detectAdditions(this.state.data, next, this.ownAdditions),
              )
            : this.state.notifications,
        data: next,
        sync: this.live
          ? "מחוברים לשיתוף חי"
          : "הנתונים נטענו מהענן · השיתוף מתחבר",
      });
    return next;
  };
  private bind(hid: string, epoch: number) {
    this.unbind();
    const subscriptionId = this.subscriptionId;
    const current = () =>
      this.current(epoch, hid) && subscriptionId === this.subscriptionId;
    const update = () => {
      if (!current() || this.refreshTimer) return;
      // Coalesce a full-list import's many row events into one authorized read.
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        if (current())
          void this.refresh(hid, epoch).catch((e) => {
            if (current())
              this.set({ error: e.message, sync: "טעינת העדכונים נכשלה" });
          });
      }, 50);
    };
    let channel = this.client!.channel(`shopping-${hid}`);
    for (const table of [
      "shopping_lists",
      "shopping_items",
      "shopping_receipts",
      "shopping_products",
    ])
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `household_id=eq.${hid}`,
        },
        update,
      );
    this.channel = channel.subscribe((status) => {
      if (!current()) return;
      this.live = status === "SUBSCRIBED";
      this.set({
        sync: this.live
          ? "מאמתים עדכונים מהענן…"
          : "השיתוף מנותק · מנסים להתחבר",
      });
      if (this.live) update();
    });
    this.poll = setInterval(update, 30000);
  }
  setOnline = (online: boolean) => {
    this.set({ online });
    if (online && this.state.mode === "cloud")
      void this.refresh().catch((e) => this.setError(e.message));
  };
  retry = async () => {
    if (!this.client) return;
    if (this.state.session) await this.resolveMembership();
    else {
      const { data, error } = await this.client.auth.getSession();
      if (error) this.failConnection(cloudError(error));
      else {
        this.identity = undefined;
        this.authChanged(data.session);
      }
    }
  };
  dispatch = async (action: Action) => {
    if (this.state.busy) throw Error("רגע, השינוי הקודם עדיין נשמר");
    if (this.state.mode !== "local" && this.state.mode !== "cloud") {
      const e = Error(
        "השמירה חסומה עד להשלמת ההתחברות, שיוך הבית וטעינת הענן. הנתונים המקומיים לא משתנים.",
      );
      this.setError(e.message);
      throw e;
    }
    this.set({ busy: true, error: "" });
    if (action.type === "list")
      this.ownAdditions.add(`list:${action.value.id}`);
    if (action.type === "item")
      this.ownAdditions.add(`item:${action.value.id}`);
    const epoch = this.epoch,
      hid = this.state.household;
    try {
      if (this.client) {
        if (this.state.mode !== "cloud" || !hid || !this.state.session)
          throw Error("אין בית מאומת לשמירה בענן.");
        if (!this.state.online)
          throw Error("אין חיבור לאינטרנט. לא נשמר שינוי מקומי כתחליף לענן.");
        ++this.readSequence;
        const { data, error } = await this.client.rpc("shopping_commit", {
          action,
          expected_household: hid,
        });
        if (!this.current(epoch, hid))
          throw Error(
            "החשבון השתנה בזמן השמירה. יש לבדוק את הרשימה לפני ניסיון נוסף.",
          );
        if (
          error &&
          action.type === "completeList" &&
          error.message?.includes("unknown action")
        )
          throw Error(
            "סיום ללא קבלה דורש התקנת עדכון בסיס הנתונים 202611110001. הרשימה נשארה ללא שינוי.",
          );
        if (error) throw cloudError(error);
        const next = snapshot(data, hid);
        verifyWrite(next, action);
        ++this.readSequence;
        this.set({
          data: next,
          notifications: mergeNotices(
            this.state.notifications,
            detectAdditions(this.state.data, next, this.ownAdditions),
          ),
        });
      } else {
        const write = async () => {
          const next = applyAction(
            this.persistence.load() || emptyData,
            action,
          );
          this.persistence.save(next);
          this.localVersion = this.persistence.revision?.() || 0;
          this.set({ data: next, localData: next });
        };
        if (typeof navigator !== "undefined" && navigator.locks)
          await navigator.locks.request("together-cart-write", write);
        else await write();
      }
    } catch (e) {
      this.setError((e as Error).message);
      throw e;
    } finally {
      this.set({ busy: false });
    }
  };
  connect = async (name: string, code?: string) => {
    if (!this.client || !this.state.session) throw Error("נדרשת התחברות.");
    const epoch = this.epoch;
    const { data, error } = await this.client.rpc(
      code ? "shopping_join_household" : "shopping_create_household",
      code ? { invite: code.trim() } : { label: name },
    );
    if (!this.current(epoch)) throw Error("החשבון השתנה.");
    if (error) {
      const e = cloudError(error, "לא ניתן ליצור בית או להצטרף לבית");
      this.setError(e.message);
      throw e;
    }
    try {
      await this.enterHousehold(data, epoch);
    } catch (e) {
      if (this.current(epoch)) this.failConnection(e as Error);
      throw e;
    }
  };
  restore = async (next: Data) => {
    if (this.client || this.state.mode !== "local")
      throw Error("שחזור שמחליף נתונים זמין במצב מקומי בלבד.");
    this.persistence.save(next);
    this.localVersion = this.persistence.revision?.() || 0;
    this.set({ data: next, localData: next });
  };
  importLocal = async (ids: string[]) => {
    if (
      this.state.mode !== "cloud" ||
      !this.client ||
      !this.state.household ||
      !this.state.online ||
      this.state.busy
    )
      throw Error("ייבוא זמין רק לאחר חיבור לבית בענן.");
    const local = this.persistence.load();
    if (!local) throw Error("לא נמצאו נתונים מקומיים.");
    const lists = local.lists.filter((l) => ids.includes(l.id));
    if (!lists.length) throw Error("בחרו רשימה לייבוא.");
    const items = local.items.filter((i) =>
      lists.some((l) => l.id === i.list_id),
    );
    const products = local.products.filter((p) =>
      items.some((i) => i.product_id === p.id),
    );
    const hid = this.state.household,
      epoch = this.epoch;
    lists.forEach((l) => this.ownAdditions.add(`list:${l.id}`));
    items.forEach((i) => this.ownAdditions.add(`item:${i.id}`));
    this.set({ busy: true, error: "" });
    try {
      const { data, error } = await this.client.rpc("shopping_import_local", {
        payload: { lists, items, products },
        expected_household: hid,
      });
      if (!this.current(epoch, hid)) throw Error("החשבון השתנה בזמן הייבוא.");
      if (error) throw cloudError(error, "הייבוא לא אושר");
      const next = snapshot(data, hid);
      if (lists.some((l) => !next.lists.some((c) => c.id === l.id)))
        throw Error("לא התקבל אישור לשמירת כל הרשימות.");
      ++this.readSequence;
      this.set({ data: next });
      return lists.length;
    } catch (e) {
      this.setError((e as Error).message);
      throw e;
    } finally {
      this.set({ busy: false });
    }
  };
}
