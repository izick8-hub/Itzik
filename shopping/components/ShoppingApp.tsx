"use client";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  PawPrint,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Copy,
  Download,
  Heart,
  History,
  Home,
  ImagePlus,
  Leaf,
  ListChecks,
  LogOut,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  ShoppingBasket,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import Illustration from "./Illustration";
import Moani from "./Moani";
import { listAddedMessage } from "@/lib/notifications";
import { useAppUpdates, APP_VERSION } from "@/lib/useAppUpdates";
import {
  catalog,
  categories,
  searchProducts,
  units,
  unitLabel,
  type Product,
  type Unit,
} from "@/lib/catalog";
import {
  type Item,
  type List,
  type Receipt,
  type ReceiptLine,
  localDate,
  monthlyTotal,
  nextThursday,
  priceHistory,
  progress,
  quantityText,
  validateReceipt,
} from "@/lib/model";
import { useShopping } from "@/lib/useShopping";
import { backupSchema, readPhoto, storePhoto } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
const money = (n: number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(n);
const dateText = (s: string, short = false) =>
  new Date(`${s}T12:00:00`).toLocaleDateString(
    "he-IL",
    short
      ? { day: "numeric", month: "short" }
      : { weekday: "long", day: "numeric", month: "long" },
  );
const uid = () => crypto.randomUUID();
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
type Tab = "home" | "list" | "history" | "prices";
type Modal =
  "new" | "add" | "settings" | "receipt" | "editList" | "notifications" | null;
function ModalShell({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = ref.current;
    el?.querySelector<HTMLElement>("input,button,select")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && el) {
        const nodes = Array.from(
          el.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select,textarea,a[href]",
          ),
        ).filter((n) => n.offsetParent !== null);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="סגירה" onClick={close}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Calendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const [month, setMonth] = useState(() => new Date(`${value}T12:00:00`));
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="icon-button"
          aria-label="חודש קודם"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          <ChevronRight size={18} />
        </button>
        <strong>
          {month.toLocaleDateString("he-IL", {
            month: "long",
            year: "numeric",
          })}
        </strong>
        <button
          type="button"
          className="icon-button"
          aria-label="חודש הבא"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          <ChevronLeft size={18} />
        </button>
      </div>
      <div className="calendar-grid">
        {["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((s) => (
          <span className="weekday" key={s}>
            {s}
          </span>
        ))}
        {Array.from({ length: start.getDay() }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = localDate(
            new Date(month.getFullYear(), month.getMonth(), i + 1),
          );
          return (
            <button
              type="button"
              key={date}
              aria-pressed={date === value}
              className={`${date === value ? "selected" : ""} ${date === localDate() ? "today" : ""}`}
              onClick={() => onChange(date)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="subtle">ברירת המחדל שלנו: חמישי. האהבה גמישה, גם התאריך.</p>
    </div>
  );
}
export default function ShoppingApp() {
  const store = useShopping();
  const updates = useAppUpdates();
  const { data, dispatch, busy } = store;
  const [tab, setTab] = useState<Tab>("home"),
    [modal, setModal] = useState<Modal>(null),
    [activeId, setActiveId] = useState(""),
    [toast, setToast] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("הכול"),
    [chosen, setChosen] = useState<Product | null>(null),
    [editing, setEditing] = useState<Item | null>(null),
    [quantity, setQuantity] = useState("1"),
    [unit, setUnit] = useState<Unit>("יחידות"),
    [newName, setNewName] = useState("הקנייה השבועית שלנו"),
    [newDate, setNewDate] = useState(nextThursday()),
    [personalName, setPersonalName] = useState(""),
    [personalCategory, setPersonalCategory] = useState<string>("אישי"),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [receiptBusy, setReceiptBusy] = useState(false),
    [photoUrl, setPhotoUrl] = useState(""),
    [confirmClear, setConfirmClear] = useState(false),
    [authEmail, setAuthEmail] = useState(""),
    [authPassword, setAuthPassword] = useState(""),
    [authSignup, setAuthSignup] = useState(false),
    [invite, setInvite] = useState(""),
    [inviteResult, setInviteResult] = useState(""),
    [authBusy, setAuthBusy] = useState(false),
    [receiptTab, setReceiptTab] = useState<"upload" | "review">("upload"),
    [priceQuery, setPriceQuery] = useState("");
  const allProducts = [...catalog, ...data.products];
  const upcoming = [...data.lists]
    .filter((l) => l.status !== "completed")
    .sort((a, b) => a.date.localeCompare(b.date));
  const active =
    data.lists.find((l) => l.id === activeId) ||
    upcoming[0] ||
    data.lists.at(-1);
  const items = data.items.filter((i) => i.list_id === active?.id);
  const p = progress(items);
  const confirmed = data.receipts.filter((r) => r.status === "confirmed");
  const total = monthlyTotal(data.receipts);
  const frequent = allProducts
    .map((product) => ({
      product,
      count: confirmed.reduce(
        (n, r) => n + Number(r.lines.some((l) => l.product_id === product.id)),
        0,
      ),
    }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const [importIds, setImportIds] = useState<string[]>([]);
  const [importConfirmed, setImportConfirmed] = useState(false);
  const newListId = useRef<string | null>(null);
  const newItemId = useRef<string | null>(null);
  const close = useRef(() => setModal(null));
  const seenNotices = useRef(new Map<string, number>());
  useEffect(() => {
    const fresh = [...store.notifications]
      .sort((a, b) => b.created_at - a.created_at)
      .find((n) => seenNotices.current.get(n.id) !== n.count);
    for (const n of store.notifications) seenNotices.current.set(n.id, n.count);
    if (fresh) setToast(`${fresh.title} · ${fresh.body}`);
  }, [store.notifications]);
  useEffect(() => {
    setImportConfirmed(false);
  }, [store.household, store.session?.user.id]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register(`${base}/sw.js`, {
          scope: `${base}/`,
          updateViaCache: "none",
        })
        .catch(() => {});
  }, []);
  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );
  async function run(fn: () => Promise<unknown>, message?: string) {
    try {
      await fn();
      if (message) setToast(message);
      return true;
    } catch (e) {
      store.setError((e as Error).message);
      return false;
    }
  }
  function openNew() {
    newListId.current = null;
    setNewName("הקנייה השבועית שלנו");
    setNewDate(nextThursday());
    setModal("new");
  }
  function openAdd() {
    newItemId.current = null;
    setChosen(null);
    setEditing(null);
    setQuery("");
    setFilter("הכול");
    setQuantity("1");
    setPersonalName("");
    setModal("add");
  }
  async function createList(e: React.FormEvent) {
    e.preventDefault();
    const l: List = {
      id: (newListId.current ||= uid()),
      name: newName.trim(),
      date: newDate,
      status: "planned",
      version: 1,
      created_at: new Date().toISOString(),
    };
    if (
      await run(() => dispatch({ type: "list", value: l }), listAddedMessage(l))
    ) {
      setActiveId(l.id);
      setTab("list");
      setModal(null);
    }
  }
  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !chosen) return;
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0 || q > 100000)
      return store.setError("בחרו כמות חיובית תקינה.");
    const item: Item = {
      id: editing?.id || (newItemId.current ||= uid()),
      list_id: active.id,
      product_id: chosen.id,
      name: chosen.name,
      category: chosen.category,
      emoji: chosen.emoji,
      quantity: q,
      unit,
      checked: editing?.checked || false,
      version: editing?.version || 1,
    };
    if (
      await run(
        () =>
          dispatch({ type: "item", value: item, expected: editing?.version }),
        editing
          ? "מואני מעדכנת: הכמות עודכנה 🐾"
          : "מואני הוסיפה מוצר חדש לרשימה 🐾",
      )
    ) {
      newItemId.current = null;
      setChosen(null);
      setEditing(null);
      setQuantity("1");
      setQuery("");
      if (editing) setModal(null);
    }
  }
  async function addPersonal() {
    const name = personalName.trim() || query.trim();
    if (!name || name.length > 120) return;
    const product: Product = {
      id: uid(),
      name,
      category: personalCategory,
      unit: "יחידות",
      emoji: "🛍️",
      source: "personal",
    };
    if (await run(() => dispatch({ type: "product", value: product }))) {
      setChosen(product);
      setUnit(product.unit);
      setPersonalName("");
    }
  }
  function edit(item: Item) {
    setEditing(item);
    setChosen({
      id: item.product_id,
      name: item.name,
      category: item.category,
      emoji: item.emoji,
      unit: item.unit,
      source: "personal",
    });
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setModal("add");
  }
  async function openReceipt(existing?: Receipt, target?: List) {
    const purchase = target || active;
    if (!purchase && !existing) return;
    setReceipt(
      existing
        ? structuredClone(existing)
        : {
            id: uid(),
            list_id: purchase!.id,
            date: purchase!.date,
            store: "יוחננוף",
            total: 0,
            status: "draft",
            lines: [],
            created_at: new Date().toISOString(),
          },
    );
    setReceiptTab(existing ? "review" : "upload");
    setPhotoUrl("");
    setModal("receipt");
    if (existing?.image_path)
      await run(async () => {
        const blob =
          store.mode === "local"
            ? await readPhoto(existing.id)
            : (
                await supabase!.storage
                  .from("shopping-receipts")
                  .download(existing.image_path!)
              ).data;
        if (blob) setPhotoUrl(URL.createObjectURL(blob));
      });
  }
  async function finishWithoutReceipt() {
    if (!active) return;
    if (
      await run(
        () =>
          dispatch({
            type: "completeList",
            id: active.id,
            expected: active.version,
          }),
        "מואני שומרת: הקנייה הסתיימה! אפשר לצרף קבלה אחר כך 🐾",
      )
    ) {
      setTab("history");
      setActiveId("");
    }
  }
  async function uploadPhoto(file?: File) {
    if (!file || !receipt) return;
    if (store.cloudAvailable && store.mode !== "cloud") {
      store.setError(
        "העלאת קבלה לענן חסומה עד לחיבור לבית. לא נשמור תמונה מקומית כתחליף.",
      );
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      store.setError(
        "בחרו תמונת JPG, PNG או WebP עד 10MB. אפשר להמיר צילום HEIC ל־JPG.",
      );
      return;
    }
    setReceiptBusy(true);
    await run(async () => {
      let path = `local:${receipt.id}`;
      if (store.mode === "cloud") {
        path = `${store.household}/${receipt.list_id}/${receipt.id}.${file.type.split("/")[1]}`;
        const { error } = await supabase!.storage
          .from("shopping-receipts")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (error) throw Error("העלאת הקבלה נכשלה. בדקו הרשאות ונסו שוב.");
      } else await storePhoto(receipt.id, file);
      const next = { ...receipt, image_path: path };
      await dispatch({ type: "receipt", value: next });
      setReceipt({
        ...next,
        version:
          (data.receipts.find((r) => r.id === next.id)?.version || 0) + 1,
      });
      setPhotoUrl(URL.createObjectURL(file));
      setToast("התמונה נשמרה. עכשיו נבדוק את הפרטים יחד.");
      setReceiptTab("review");
    });
    setReceiptBusy(false);
  }
  async function recognize() {
    if (!receipt || !supabase || store.mode !== "cloud") return;
    setReceiptBusy(true);
    await run(async () => {
      const { data: result, error } = await supabase!.functions.invoke(
        "recognize-receipt",
        { body: { receipt_id: receipt.id } },
      );
      if (error)
        throw Error(
          "הזיהוי לא הצליח. ודאו ששירות הזיהוי הוגדר; אפשר להזין את הקבלה ידנית.",
        );
      const lines: ReceiptLine[] = result.lines.map(
        (l: Omit<ReceiptLine, "id" | "product_id">) => ({
          ...l,
          id: uid(),
          product_id: null,
          uncertain: true,
        }),
      );
      setReceipt({
        ...receipt,
        date: result.date || receipt.date,
        total: result.total,
        store: result.store || receipt.store,
        lines,
      });
      setToast("התקבל פענוח ראשוני. בדקו כל שורה לפני אישור.");
      setReceiptTab("review");
    });
    setReceiptBusy(false);
  }
  function lineChange(id: string, patch: Partial<ReceiptLine>) {
    if (receipt)
      setReceipt({
        ...receipt,
        lines: receipt.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      });
  }
  async function confirmReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!receipt) return;
    const error = validateReceipt(receipt);
    if (error) return store.setError(error);
    if (receipt.lines.some((l) => l.uncertain))
      return store.setError("אשרו את בדיקת כל השורות לפני שמירת המחירים.");
    if (
      await run(
        () => dispatch({ type: "confirmReceipt", value: receipt }),
        "הקנייה נשמרה! צוות לעניין 💕",
      )
    ) {
      setModal(null);
      setTab("history");
    }
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `עגלה-לשניים-${localDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("קובץ הנתונים הורד. תמונות הקבלות אינן כלולות בו.");
  }
  async function importBackup(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return store.setError("הקובץ גדול מדי.");
    await run(async () => {
      const value = backupSchema.parse(JSON.parse(await file.text()));
      await store.restore(value);
      setConfirmClear(false);
    }, "הגיבוי נטען בהצלחה");
  }
  async function auth(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    await run(async () => {
      const result = authSignup
        ? await supabase!.auth.signUp({
            email: authEmail,
            password: authPassword,
            options: { emailRedirectTo: location.origin + base },
          })
        : await supabase!.auth.signInWithPassword({
            email: authEmail,
            password: authPassword,
          });
      if (result.error)
        throw Error(
          "ההתחברות לא הצליחה. בדקו פרטים, אישור דוא״ל והגדרות חשבון.",
        );
      if (authSignup && !result.data.session)
        setToast("נשלח דוא״ל לאישור החשבון. בדקו גם את תיקיית הספאם.");
      else setToast("איזה כיף שחזרתם!");
    });
    setAuthBusy(false);
  }
  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href={`${base}/`}
          aria-label="עגלה לשניים, עמוד הבית"
        >
          <span className="brand-mark">
            <ShoppingBasket size={25} />
            <Heart size={11} className="brand-heart" fill="currentColor" />
          </span>
          <span>
            עגלה לשניים<small>של שנינו ושל מואני 🐾</small>
          </span>
        </a>
        <div className="header-actions">
          <button
            className="icon-button notification-button"
            aria-label={`העדכונים של מואני${store.notifications.length ? `, ${store.notifications.length} עדכונים` : ""}`}
            onClick={() => setModal("notifications")}
          >
            <Bell size={21} />
            {store.notifications.length > 0 && (
              <span className="notification-count">
                {store.notifications.length}
              </span>
            )}
          </button>
          <span
            className={`sync-pill ${store.mode === "cloud" ? "cloud" : ""}`}
          >
            <span className="status-dot" />
            {store.online ? store.sync : "אין חיבור לאינטרנט"}
          </span>
          <button
            className="icon-button settings-button"
            aria-label="הגדרות ושיתוף"
            onClick={() => setModal("settings")}
          >
            <Settings size={21} />
          </button>
          <div
            className="couple-avatar personalized"
            aria-label="הדמויות הזוגיות שלכם"
          >
            <span
              style={{ backgroundImage: `url(${base}/couple-shopping.png)` }}
            />
            <span
              style={{ backgroundImage: `url(${base}/couple-shopping.png)` }}
            />
          </div>
        </div>
      </header>
      <main className="app-shell">
        {updates.available && (
          <div className="update-banner" role="status">
            <Moani pose="celebrate" className="moani-update" decorative />
            <div>
              <strong>מואני מצאה גרסה חדשה 🐾</strong>
              <p>
                העדכון ישמור את הנתונים שלכם. סיימו ושמרו עריכות פתוחות לפני
                טעינה.
              </p>
            </div>
            <button
              className="secondary"
              disabled={
                busy ||
                !store.online ||
                !!(modal && modal !== "settings" && modal !== "notifications")
              }
              onClick={updates.load}
            >
              טעינת העדכון
            </button>
          </div>
        )}
        <Moani
          pose="shop"
          className="moani-watermark watermark-one"
          decorative
        />
        <Moani
          pose="rest"
          className="moani-watermark watermark-two"
          decorative
        />
        {store.cloudAvailable && store.mode !== "cloud" && (
          <div className="notice">
            <span>{store.sync}</span>
            <button
              className="text-button"
              onClick={() => setModal("settings")}
            >
              כניסה והגדרות הבית
            </button>
            {store.mode === "error" && (
              <button
                className="text-button"
                onClick={() => void store.retry()}
              >
                ניסיון חיבור נוסף
              </button>
            )}
          </div>
        )}
        {store.mode === "cloud" && store.localData.lists.length > 0 && (
          <div className="notice">
            <span>
              נמצאו רשימות מקומיות ששמורות במכשיר. אפשר לייבא אותן בבטחה
              בהגדרות.
            </span>
            <button
              className="text-button"
              onClick={() => setModal("settings")}
            >
              גיבוי וייבוא לענן
            </button>
          </div>
        )}
        {!store.online && (
          <div className="notice">
            <WifiOff size={18} />
            {store.cloudAvailable
              ? "אין חיבור. השמירה בענן חסומה; לא נשמור מקומית כתחליף."
              : "מצב מקומי. הרשימות נשמרות במכשיר; שיתוף אינו פעיל."}
          </div>
        )}
        {store.error && (
          <div className="error-banner" role="alert">
            <span>{store.error}</span>
            <button
              className="icon-button"
              aria-label="סגירת הודעה"
              onClick={() => store.setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {!store.ready ? (
          <div className="empty">
            <ShoppingBasket />
            <h1>מכינים את העגלה…</h1>
          </div>
        ) : (
          <>
            {tab === "home" && (
              <>
                <section className="welcome-row">
                  <div>
                    <span className="eyebrow">
                      <Heart size={14} /> המקום הקטן שלנו
                    </span>
                    <h1>
                      הכי כיף לקנות <span>ביחד.</span>
                    </h1>
                    <p>הרשימה שלנו, הדברים שאנחנו אוהבים וכל מה שביניהם.</p>
                  </div>
                  <div className="date-sticker">
                    <CalendarDays size={17} />
                    {new Date().toLocaleDateString("he-IL", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                </section>
                <section className="hero">
                  <div className="hero-copy">
                    <span className="handwritten">אתם, אני והעגלה ♡</span>
                    <h2>
                      ממלאים את הבית
                      <br />
                      בדברים טובים.
                    </h2>
                    <p>
                      מתכננים בנחת, קונים בחיוך.
                      <br />
                      ומה ששכחנו? מוסיפים לרשימה.
                    </p>
                    <button className="primary" onClick={openNew}>
                      <Plus size={20} /> רשימת קניות חדשה
                    </button>
                  </div>
                  <div className="hero-art">
                    <span className="floating-note">
                      רשימה קטנה. אהבה גדולה ✨
                    </span>
                    <img
                      className="couple-hero"
                      src={`${base}/couple-shopping.png`}
                      width="1280"
                      height="1280"
                      alt="הדמויות שלכם מחייכות יחד עם עגלת קניות, על בסיס האיורים שצירפתם"
                      fetchPriority="high"
                    />
                    <Moani pose="shop" className="moani-hero" />
                  </div>
                  <span className="hero-sparkle">✧</span>
                </section>
                <div className="section-heading">
                  <h2>
                    מה בתכנון שלנו <span>✿</span>
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setTab("history")}
                  >
                    כל הרשימות <ArrowLeft size={16} />
                  </button>
                </div>
                <div className="home-grid">
                  <section className="next-card">
                    {upcoming[0] ? (
                      (() => {
                        const next = upcoming[0],
                          np = progress(
                            data.items.filter((i) => i.list_id === next.id),
                          );
                        return (
                          <>
                            <div className="card-title">
                              <span className="badge mint">
                                {next.date === localDate()
                                  ? "היום קונים!"
                                  : "הקנייה הקרובה"}
                              </span>
                              <span className="store-label">🛍️ ביחד לסופר</span>
                            </div>
                            <h3>{next.name}</h3>
                            <p className="date-line">
                              <CalendarDays size={17} />
                              {dateText(next.date)}
                            </p>
                            <div className="mini-products">
                              {data.items
                                .filter((i) => i.list_id === next.id)
                                .slice(0, 5)
                                .map((i) => (
                                  <span key={i.id} title={i.name}>
                                    {i.emoji}
                                  </span>
                                ))}
                              {np.total === 0 && <span>📝</span>}
                              <small>
                                {np.total
                                  ? `${np.total} דברים טובים ברשימה`
                                  : "כל הדברים הטובים מתחילים ברשימה"}
                              </small>
                            </div>
                            <div className="progress-label">
                              <span>
                                {np.done} מתוך {np.total} מוצרים בעגלה
                              </span>
                              <strong>{np.percent}%</strong>
                            </div>
                            <div className="progress-track">
                              <span style={{ width: `${np.percent}%` }} />
                            </div>
                            <button
                              className="secondary full"
                              onClick={() => {
                                setActiveId(next.id);
                                setTab("list");
                              }}
                            >
                              בואו לרשימה שלנו <ArrowLeft size={18} />
                            </button>
                          </>
                        );
                      })()
                    ) : (
                      <div className="first-list">
                        <Moani pose="shop" className="moani-empty" />
                        <span className="big-emoji">📝</span>
                        <h3>הקנייה הבאה מתחילה כאן</h3>
                        <p>עוד אין לנו רשימה. נוסיף כמה דברים טובים?</p>
                        <button className="secondary" onClick={openNew}>
                          <Plus size={18} /> יוצרים רשימה ראשונה
                        </button>
                      </div>
                    )}
                  </section>
                  <section className="love-note">
                    <span className="tape" />
                    <Moani pose="notice" className="moani-note" />
                    <div className="note-icon">💌</div>
                    <span className="eyebrow">דברים קטנים, רגעים שלנו</span>
                    <h3>
                      אחד זוכר חלב,
                      <br />
                      השני זוכר שוקולד.
                    </h3>
                    <p>מואני תעזור לזכור את השאר. וחטיפים, ברור.</p>
                    <div className="note-bottom">🥛 + 🍫 = ♡</div>
                  </section>
                </div>
                <section className="stats-grid">
                  <article className="stat-card peach">
                    <span className="stat-icon">
                      <ShoppingBasket />
                    </span>
                    <div>
                      <small>קניות שעשינו</small>
                      <strong>
                        {
                          data.lists.filter((l) => l.status === "completed")
                            .length
                        }
                        <em>ביחד</em>
                      </strong>
                    </div>
                  </article>
                  <article className="stat-card lavender">
                    <span className="stat-icon">
                      <TrendingUp />
                    </span>
                    <div>
                      <small>הוצאות מאושרות החודש</small>
                      <strong>{money(total)}</strong>
                    </div>
                  </article>
                  <article className="stat-card green">
                    <span className="stat-icon">
                      <Leaf />
                    </span>
                    <div>
                      <small>הדברים הקבועים שלנו</small>
                      <strong>
                        {frequent.length
                          ? frequent[0].product.name
                          : "עוד נגלה"}
                        <em>
                          {frequent.length ? "הכי הרבה קבלות" : "עם כל קנייה"}
                        </em>
                      </strong>
                    </div>
                  </article>
                </section>
                <div className="local-note">
                  <span>🌱</span>
                  <p>
                    {store.mode === "local" ? (
                      <>
                        מתחילים בקטן, במכשיר הזה.{" "}
                        <button
                          className="inline-button"
                          onClick={() => setModal("settings")}
                        >
                          על שמירה ושיתוף
                        </button>
                      </>
                    ) : store.mode === "cloud" ? (
                      <>הבית שלכם מחובר. שינויים מאושרים נשמרים בענן.</>
                    ) : (
                      <>לשמירה משותפת יש להתחבר ולטעון את הבית מהענן.</>
                    )}
                  </p>
                </div>
              </>
            )}
            {tab === "list" && (
              <>
                <section className="page-heading">
                  <div>
                    <span className="eyebrow">
                      <PawPrint size={14} />
                      הרשימה שלנו, בפיקוח מואני
                    </span>
                    <h1>{active ? active.name : "מה חסר בבית?"}</h1>
                    {active && (
                      <p>
                        <CalendarDays size={16} />
                        {dateText(active.date)}
                        <span className="separator">·</span>
                        {active.status === "completed"
                          ? "קנייה שהושלמה"
                          : "מוסיפים קצת, שוכחים פחות"}
                      </p>
                    )}
                  </div>
                  <button
                    className="primary"
                    onClick={active ? openAdd : openNew}
                  >
                    <Plus size={19} />
                    {active ? "הוספת מוצר" : "רשימה חדשה"}
                  </button>
                </section>
                {active ? (
                  <>
                    <div className="list-toolbar">
                      <label className="list-select">
                        איזו רשימה?
                        <select
                          value={active.id}
                          onChange={(e) => setActiveId(e.target.value)}
                        >
                          {[...data.lists]
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name} · {dateText(l.date, true)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button
                        className="outline"
                        onClick={() => {
                          setNewName(active.name);
                          setNewDate(active.date);
                          setModal("editList");
                        }}
                      >
                        <Pencil size={16} /> שם ותאריך
                      </button>
                    </div>
                    <div className="shopping-progress">
                      <div>
                        <span className="basket-icon">🛒</span>
                        <div>
                          <strong>
                            {p.done} מתוך {p.total} מוצרים בעגלה
                          </strong>
                          <small>
                            {p.total && p.done === p.total
                              ? "איזה צוות! אפשר לעבור לקבלה 💕"
                              : "כל סימון מקרב אותנו הביתה"}
                          </small>
                        </div>
                        <b>{p.percent}%</b>
                      </div>
                      <div className="progress-track">
                        <span style={{ width: `${p.percent}%` }} />
                      </div>
                    </div>
                    {items.length ? (
                      <div className="shopping-categories">
                        {[
                          ...categories,
                          ...new Set(
                            items
                              .map((i) => i.category)
                              .filter(
                                (c) =>
                                  !categories.includes(
                                    c as (typeof categories)[number],
                                  ),
                              ),
                          ),
                        ].map((category) => {
                          const group = items.filter(
                            (i) => i.category === category,
                          );
                          return group.length ? (
                            <section
                              key={category}
                              className="category-section"
                            >
                              <h2>
                                {group[0].emoji} {category}
                                <span>{group.length}</span>
                              </h2>
                              {group.map((item) => (
                                <article
                                  className={`item-row ${item.checked ? "checked" : ""}`}
                                  key={item.id}
                                >
                                  <button
                                    className="check-button"
                                    aria-label={`${item.checked ? "ביטול סימון" : "סימון נאסף"}: ${item.name}`}
                                    aria-pressed={item.checked}
                                    disabled={busy}
                                    onClick={() =>
                                      void run(
                                        () =>
                                          dispatch({
                                            type: "item",
                                            value: {
                                              ...item,
                                              checked: !item.checked,
                                            },
                                            expected: item.version,
                                          }),
                                        !item.checked && p.done + 1 === p.total
                                          ? "הכול בעגלה! אל תשכחו משהו מתוק 💕"
                                          : undefined,
                                      )
                                    }
                                  >
                                    {item.checked && <Check size={21} />}
                                  </button>
                                  <span className="product-emoji">
                                    {item.emoji}
                                  </span>
                                  <div className="item-name">
                                    <strong>{item.name}</strong>
                                    <span>
                                      {quantityText(item.quantity, item.unit)}
                                    </span>
                                  </div>
                                  <button
                                    className="icon-button"
                                    aria-label={`עריכת ${item.name}`}
                                    disabled={busy}
                                    onClick={() => edit(item)}
                                  >
                                    <Pencil size={17} />
                                  </button>
                                  <button
                                    className="icon-button delete-button"
                                    aria-label={`מחיקת ${item.name}`}
                                    disabled={busy}
                                    onClick={() =>
                                      void run(
                                        () =>
                                          dispatch({
                                            type: "deleteItem",
                                            id: item.id,
                                            expected: item.version,
                                          }),
                                        "המוצר הוסר מהרשימה",
                                      )
                                    }
                                  >
                                    <Trash2 size={17} />
                                  </button>
                                </article>
                              ))}
                            </section>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <div className="empty card">
                        <Moani pose="shop" className="moani-empty" />
                        <h2>עגלה ריקה, מלא אפשרויות</h2>
                        <p>חפשו מוצר או הוסיפו משהו משלכם.</p>
                        <button className="primary" onClick={openAdd}>
                          <Plus size={19} /> מוסיפים את המוצר הראשון
                        </button>
                      </div>
                    )}
                    <div className="finish-card">
                      <Moani
                        pose={
                          active.status === "completed" ? "rest" : "celebrate"
                        }
                        className="moani-finish"
                      />
                      <div>
                        <h3>
                          {active.status === "completed"
                            ? "מואני שומרת את הקנייה שלנו"
                            : "מואני שואלת: סיימנו לקנות?"}
                        </h3>
                        <p>
                          לא חייבים קבלה כדי לסיים. הרשימה והמוצרים נשמרים, ואת
                          הקבלה אפשר להוסיף אחר כך.
                        </p>
                      </div>
                      <div className="finish-actions">
                        {active.status !== "completed" && (
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() => void finishWithoutReceipt()}
                          >
                            <Check size={18} /> סיום קנייה ללא קבלה
                          </button>
                        )}
                        <button
                          className="outline"
                          disabled={busy}
                          onClick={() => void openReceipt()}
                        >
                          <ImagePlus size={18} />
                          {active.status === "completed"
                            ? "העלאת קבלה בדיעבד"
                            : "סיימנו לקנות! העלאת קבלה 📸"}
                        </button>
                        {active.status === "completed" && (
                          <button className="primary" onClick={openNew}>
                            <Plus size={18} />
                            רשימה חדשה
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty card">
                    <Illustration small />
                    <h2>נתחיל בקנייה הבאה שלנו</h2>
                    <p>בחרו תאריך ותנו לרשימה שם.</p>
                    <button className="primary" onClick={openNew}>
                      יוצרים רשימה
                    </button>
                  </div>
                )}
              </>
            )}
            {tab === "history" && (
              <>
                <section className="page-heading">
                  <div>
                    <span className="eyebrow">טוב לזכור</span>
                    <h1>הקניות שהיו, והבאות.</h1>
                    <p>עוד סיבוב בסופר, עוד משהו קטן שלמדנו.</p>
                  </div>
                  <button className="primary" onClick={openNew}>
                    <Plus size={19} /> רשימה חדשה
                  </button>
                </section>
                {!data.lists.length ? (
                  <div className="empty card">
                    <Moani pose="rest" className="moani-empty" />
                    <h2>מואני שומרת מקום לזיכרונות שלנו</h2>
                    <p>הרשימות והקבלות שלכם יופיעו כאן אחרי הקנייה הראשונה.</p>
                  </div>
                ) : (
                  <div className="history-grid">
                    {[...data.lists]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((l) => {
                        const receipts = data.receipts.filter(
                          (r) => r.list_id === l.id,
                        );
                        const pp = progress(
                          data.items.filter((i) => i.list_id === l.id),
                        );
                        return (
                          <article key={l.id} className="history-card">
                            <div className="card-title">
                              <span
                                className={`badge ${l.status === "completed" ? "mint" : "pink"}`}
                              >
                                {l.status === "completed"
                                  ? "קנייה שהושלמה"
                                  : "בתכנון שלנו"}
                              </span>
                              <small>{dateText(l.date, true)}</small>
                            </div>
                            <h2>{l.name}</h2>
                            <p>
                              {pp.total} מוצרים · {pp.done} נאספו
                            </p>
                            <strong className="receipt-amount">
                              {receipts.some((r) => r.status === "confirmed")
                                ? money(
                                    receipts
                                      .filter((r) => r.status === "confirmed")
                                      .reduce((sum, r) => sum + r.total, 0),
                                  )
                                : "עדיין אין סכום מאושר"}
                            </strong>
                            <div className="history-actions">
                              <button
                                className="secondary"
                                onClick={() => {
                                  setActiveId(l.id);
                                  setTab("list");
                                }}
                              >
                                פתיחת רשימה <ArrowLeft size={15} />
                              </button>
                              <button
                                className="outline"
                                disabled={busy}
                                onClick={() =>
                                  void run(
                                    () =>
                                      dispatch({
                                        type: "duplicate",
                                        id: l.id,
                                        date: nextThursday(),
                                      }),
                                    "הרשימה שוכפלה לחמישי הקרוב, בלי סימוני האיסוף",
                                  )
                                }
                              >
                                <Copy size={16} /> שכפול
                              </button>
                            </div>
                            {l.status === "completed" && (
                              <button
                                className="receipt-link retro-receipt"
                                onClick={() =>
                                  void openReceipt(
                                    receipts.find((r) => r.status === "draft"),
                                    l,
                                  )
                                }
                              >
                                <ImagePlus size={16} />
                                {receipts.some((r) => r.status === "confirmed")
                                  ? "הוספת קבלה נוספת"
                                  : "העלאת קבלה בדיעבד"}
                                <span>מואני תשמור גם אותה 🐾</span>
                              </button>
                            )}
                            {receipts.map((r) => (
                              <button
                                className="receipt-link"
                                key={r.id}
                                onClick={() => void openReceipt(r)}
                              >
                                <ImagePlus size={15} />
                                {r.status === "confirmed"
                                  ? "קבלה מאושרת"
                                  : "טיוטת קבלה"}{" "}
                                · {dateText(r.date, true)}{" "}
                                <ChevronLeft size={15} />
                              </button>
                            ))}
                          </article>
                        );
                      })}
                  </div>
                )}
              </>
            )}
            {tab === "prices" && (
              <>
                <section className="page-heading">
                  <div>
                    <span className="eyebrow">קונים קצת יותר חכם</span>
                    <h1>המספרים מאחורי העגלה.</h1>
                    <p>רק מחירים שאישרתם מהקבלות שלכם. בלי ניחושים.</p>
                  </div>
                  <span className="round-sticker">₪</span>
                </section>
                <section className="expense-summary">
                  <div>
                    <span>החודש, בקבלות מאושרות</span>
                    <strong>{money(total)}</strong>
                    <small>
                      {
                        confirmed.filter((r) =>
                          r.date.startsWith(localDate().slice(0, 7)),
                        ).length
                      }{" "}
                      קבלות
                    </small>
                  </div>
                  <div
                    className="month-bars"
                    aria-label="הוצאות בארבעת החודשים האחרונים"
                  >
                    {Array.from({ length: 4 }, (_, i) => {
                      const d = new Date();
                      d.setDate(1);
                      d.setMonth(d.getMonth() - 3 + i);
                      const m = localDate(d).slice(0, 7),
                        n = monthlyTotal(data.receipts, m),
                        max = Math.max(
                          1,
                          ...Array.from({ length: 4 }, (_, j) => {
                            const dt = new Date();
                            dt.setDate(1);
                            dt.setMonth(dt.getMonth() - j);
                            return monthlyTotal(
                              data.receipts,
                              localDate(dt).slice(0, 7),
                            );
                          }),
                        );
                      return (
                        <div key={m} title={money(n)}>
                          <small>{money(n)}</small>
                          <span
                            style={{
                              height: `${Math.max(4, (n / max) * 90)}px`,
                            }}
                          />
                          <small>
                            {d.toLocaleDateString("he-IL", { month: "short" })}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <label className="search-box">
                  <Search size={20} />
                  <input
                    placeholder="חיפוש בהיסטוריית המחירים…"
                    aria-label="חיפוש בהיסטוריית המחירים"
                    value={priceQuery}
                    onChange={(e) => setPriceQuery(e.target.value)}
                  />
                </label>
                <div className="price-list">
                  {allProducts
                    .filter(
                      (product) =>
                        product.name.includes(priceQuery) &&
                        confirmed.some((r) =>
                          r.lines.some((l) => l.product_id === product.id),
                        ),
                    )
                    .map((product) => {
                      const unitTypes = [
                        ...new Set(
                          confirmed.flatMap((r) =>
                            r.lines
                              .filter((l) => l.product_id === product.id)
                              .map((l) => l.unit),
                          ),
                        ),
                      ];
                      return unitTypes.map((unit) => {
                        const history = priceHistory(
                            data.receipts,
                            product.id,
                            unit,
                          ),
                          last = history.at(-1)!,
                          prev = history.at(-2),
                          delta = prev
                            ? Math.round((last.price - prev.price) * 100) / 100
                            : null;
                        return (
                          <article
                            className="price-card"
                            key={`${product.id}-${unit}`}
                          >
                            <span className="product-emoji">
                              {product.emoji}
                            </span>
                            <div>
                              <h3>{product.name}</h3>
                              <small>
                                מחיר בפועל ל־1 {unitLabel[unit]} · לאחר הנחות
                              </small>
                              <div className="price-history">
                                {history.map((h, i) => (
                                  <span key={`${h.receiptId}-${i}`}>
                                    {dateText(h.date, true)}{" "}
                                    <b>{money(h.price)}</b>
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="price-current">
                              <strong>{money(last.price)}</strong>
                              {delta !== null && (
                                <small
                                  className={
                                    delta > 0 ? "price-up" : "price-down"
                                  }
                                >
                                  {delta > 0 ? "↑" : delta < 0 ? "↓" : "="}{" "}
                                  {money(Math.abs(delta))}
                                </small>
                              )}
                            </div>
                          </article>
                        );
                      });
                    })}
                  {!confirmed.some((r) =>
                    r.lines.some((l) => l.product_id),
                  ) && (
                    <div className="empty card">
                      <Moani pose="rest" className="moani-empty" />
                      <h2>המחירים שלכם, הסיפור שלכם</h2>
                      <p>
                        אשרו קבלה והתאימו את השורות למוצרים כדי לראות היסטוריה
                        והשוואות.
                      </p>
                    </div>
                  )}
                </div>
                {frequent.length > 0 && (
                  <section className="favorites">
                    <h2>חוזרים אליהם שוב ושוב ♡</h2>
                    {frequent.map(({ product, count }) => (
                      <span className="badge mint" key={product.id}>
                        {product.emoji} {product.name} · {count} קבלות
                      </span>
                    ))}
                  </section>
                )}
              </>
            )}
          </>
        )}
        <footer className="app-footer">
          <Moani pose="rest" className="moani-footer" decorative />
          <span>
            עגלה לשניים, ושלוש נשמות בבית <PawPrint size={12} /> מואני שומרת
            עלינו<small className="app-version">גרסה {APP_VERSION}</small>
          </span>
        </footer>
      </main>
      <nav className="bottom-nav" aria-label="ניווט ראשי">
        {(
          [
            { id: "home", label: "הבית שלנו", icon: Home },
            { id: "list", label: "הרשימה", icon: ListChecks },
            { id: "history", label: "הקניות שלנו", icon: History },
            { id: "prices", label: "הוצאות ומחירים", icon: TrendingUp },
          ] as const
        ).map((n) => (
          <button
            key={n.id}
            className={tab === n.id ? "active" : ""}
            aria-current={tab === n.id ? "page" : undefined}
            onClick={() => {
              setTab(n.id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <n.icon size={22} />
            <span>{n.label}</span>
            {tab === n.id && <span className="nav-dot" />}
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Moani pose="notice" className="moani-toast" decorative />
          <span>{toast}</span>
        </div>
      )}
      {modal === "notifications" && (
        <ModalShell title="העדכונים של מואני 🐾" close={close.current}>
          <div className="moani-notice-intro">
            <Moani pose="notice" />
            <p>
              מואני מעדכנת על רשימות ומוצרים חדשים כשהאתר פתוח. התראות מערכת
              כשהאתר סגור אינן פעילות.
            </p>
          </div>
          <div role="log" aria-live="polite" className="notice-center">
            {store.notifications.length ? (
              store.notifications.map((n) => (
                <article key={n.id}>
                  <button
                    className="notice-open"
                    onClick={() => {
                      setActiveId(n.list_id);
                      setTab("list");
                      setModal(null);
                      store.dismissNotice(n.id);
                    }}
                  >
                    <strong>{n.title}</strong>
                    <small>{n.body}</small>
                  </button>
                  <button
                    className="icon-button"
                    aria-label="סגירת העדכון"
                    onClick={() => store.dismissNotice(n.id)}
                  >
                    <X size={17} />
                  </button>
                </article>
              ))
            ) : (
              <div className="empty">
                <Moani pose="rest" className="moani-empty" />
                <p>מואני נחה. אין עדכונים חדשים כרגע.</p>
              </div>
            )}
          </div>
          {store.notifications.length > 0 && (
            <button
              className="text-button full"
              onClick={() => store.dismissNotice()}
            >
              ניקוי העדכונים
            </button>
          )}
        </ModalShell>
      )}
      {(modal === "new" || modal === "editList") && (
        <ModalShell
          title={
            modal === "new" ? "מתכננים משהו טוב 🛒" : "הפרטים של הקנייה שלנו"
          }
          close={close.current}
        >
          <form
            onSubmit={
              modal === "new"
                ? createList
                : async (e) => {
                    e.preventDefault();
                    if (
                      active &&
                      (await run(
                        () =>
                          dispatch({
                            type: "list",
                            value: {
                              ...active,
                              name: newName.trim(),
                              date: newDate,
                              version: active.version,
                            },
                          }),
                        "הרשימה עודכנה",
                      ))
                    )
                      setModal(null);
                  }
            }
          >
            <label>
              איך נקרא לקנייה?
              <input
                required
                maxLength={100}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="הקנייה של חמישי"
              />
            </label>
            <label>
              מתי קונים?
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </label>
            <Calendar value={newDate} onChange={setNewDate} />
            <button className="primary full" disabled={busy}>
              {modal === "new" ? "יש לנו דייט בסופר ♡" : "שמירת הפרטים"}
            </button>
          </form>
        </ModalShell>
      )}
      {modal === "add" && (
        <ModalShell
          title={editing ? "קצת יותר, קצת פחות" : "מה נוסיף לעגלה? 🥑"}
          close={close.current}
        >
          {chosen ? (
            <form onSubmit={addItem}>
              <div className="chosen-product">
                <span>{chosen.emoji}</span>
                <h3>{chosen.name}</h3>
                {!editing && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setChosen(null)}
                  >
                    בחירת מוצר אחר
                  </button>
                )}
              </div>
              <div className="form-row">
                <label>
                  כמות
                  <input
                    type="number"
                    min="0.001"
                    max="100000"
                    step="any"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <label>
                  יחידת מידה
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as Unit)}
                  >
                    {units.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button disabled={busy} className="primary full">
                <Plus size={18} />
                {editing ? "עדכון המוצר" : "להוסיף לרשימה"}
              </button>
            </form>
          ) : (
            <>
              <label className="search-box">
                <Search size={20} />
                <input
                  autoComplete="off"
                  placeholder="מה חסר? נסו ״מלפ״…"
                  aria-label="חיפוש מוצר"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="category-chips">
                {["הכול", ...categories].map((c) => (
                  <button
                    className={filter === c ? "selected" : ""}
                    key={c}
                    onClick={() => setFilter(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="product-results">
                {searchProducts(
                  allProducts.filter(
                    (p) => filter === "הכול" || p.category === filter,
                  ),
                  query,
                ).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setChosen(product);
                      setUnit(product.unit);
                    }}
                  >
                    <span>{product.emoji}</span>
                    <div>
                      <strong>{product.name}</strong>
                      <small>{product.category}</small>
                    </div>
                    <Plus size={18} />
                  </button>
                ))}
              </div>
              <details className="personal-product">
                <summary>
                  לא מצאתם? מוסיפים מוצר אישי <Plus size={15} />
                </summary>
                <label>
                  שם המוצר
                  <input
                    maxLength={120}
                    value={personalName}
                    placeholder={query || "למשל: העוגיות שאנחנו אוהבים"}
                    onChange={(e) => setPersonalName(e.target.value)}
                  />
                </label>
                <label>
                  קטגוריה
                  <select
                    value={personalCategory}
                    onChange={(e) => setPersonalCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondary full"
                  disabled={busy || !(personalName.trim() || query.trim())}
                  onClick={() => void addPersonal()}
                >
                  הוספת מוצר אישי
                </button>
              </details>
              <p className="subtle catalog-disclaimer">
                קטלוג התחלתי של מוצרי סופר נפוצים בישראל. אינו קטלוג רשמי של
                יוחננוף ואינו כולל מחירי רשת.
              </p>
            </>
          )}
        </ModalShell>
      )}
      {modal === "receipt" && receipt && (
        <ModalShell
          title={
            receipt.status === "confirmed"
              ? "הקבלה שלנו 🧾"
              : "סיימנו לקנות! 📸"
          }
          close={close.current}
        >
          {receipt.status !== "confirmed" && (
            <div className="receipt-steps">
              <button
                className={receiptTab === "upload" ? "active" : ""}
                onClick={() => setReceiptTab("upload")}
              >
                1. צילום הקבלה
              </button>
              <button
                className={receiptTab === "review" ? "active" : ""}
                onClick={() => setReceiptTab("review")}
              >
                2. בדיקה ואישור
              </button>
            </div>
          )}
          {photoUrl && (
            <a
              className="receipt-photo-link"
              href={photoUrl}
              target="_blank"
              rel="noreferrer"
            >
              <img src={photoUrl} alt="תמונת הקבלה שהעליתם" />
              <span>פתיחת התמונה בגודל מלא</span>
            </a>
          )}
          {receiptTab === "upload" && receipt.status !== "confirmed" ? (
            <>
              <label className="upload-zone">
                <ImagePlus size={36} />
                <strong>חיוך קטן, צילום קבלה</strong>
                <span>צילום מהטלפון או בחירת תמונה · עד 10MB</span>
                <input
                  aria-label="העלאת תמונת קבלה"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={receiptBusy || busy}
                  onChange={(e) => void uploadPhoto(e.target.files?.[0])}
                />
              </label>
              <div className="notice">
                {store.mode === "cloud"
                  ? "התמונה נשמרת באחסון פרטי של משק הבית. זיהוי AI זמין רק לאחר הגדרת השירות."
                  : "התמונה נשמרת רק בדפדפן הזה. זיהוי AI אינו מחובר; ניתן להזין ולשמור את כל הפרטים ידנית."}
              </div>
              <button
                className="secondary full"
                onClick={() => setReceiptTab("review")}
              >
                הזנת קבלה ידנית <ArrowLeft size={17} />
              </button>
            </>
          ) : (
            <form onSubmit={confirmReceipt}>
              <fieldset
                disabled={receipt.status === "confirmed" || busy || receiptBusy}
              >
                <div className="form-row">
                  <label>
                    שם הסופר
                    <input
                      maxLength={100}
                      required
                      value={receipt.store}
                      onChange={(e) =>
                        setReceipt({ ...receipt, store: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    תאריך הקנייה
                    <input
                      type="date"
                      required
                      value={receipt.date}
                      onChange={(e) =>
                        setReceipt({ ...receipt, date: e.target.value })
                      }
                    />
                  </label>
                </div>
                {receipt.status === "draft" &&
                  store.mode === "cloud" &&
                  receipt.image_path && (
                    <button
                      className="outline full"
                      type="button"
                      onClick={() => void recognize()}
                      disabled={receiptBusy}
                    >
                      <Sparkles size={17} /> פענוח ראשוני באמצעות AI
                    </button>
                  )}
                {receipt.status === "draft" && (
                  <p className="subtle">
                    המחיר הסופי הוא אחרי הנחה. חברו כל שורה למוצר כדי לעקוב
                    אחריו, ובדקו אותה לפני האישור.
                  </p>
                )}
                {receipt.lines.map((line, index) => (
                  <div className="receipt-line" key={line.id}>
                    <div className="line-heading">
                      <b>מוצר {index + 1}</b>
                      {receipt.status === "draft" && (
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`מחיקת שורה ${index + 1}`}
                          onClick={() =>
                            setReceipt({
                              ...receipt,
                              lines: receipt.lines.filter(
                                (l) => l.id !== line.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    <label>
                      שם בקבלה
                      <input
                        required
                        value={line.name}
                        maxLength={150}
                        onChange={(e) =>
                          lineChange(line.id, {
                            name: e.target.value,
                            uncertain: true,
                          })
                        }
                      />
                    </label>
                    <label>
                      התאמה למוצר ברשימה או בקטלוג
                      <select
                        value={line.product_id || ""}
                        onChange={(e) =>
                          lineChange(line.id, {
                            product_id: e.target.value || null,
                            uncertain: true,
                          })
                        }
                      >
                        <option value="">
                          ללא התאמה — לא ייכלל בהשוואת מחירים
                        </option>
                        {[...allProducts]
                          .sort(
                            (a, b) =>
                              Number(items.some((i) => i.product_id === b.id)) -
                              Number(items.some((i) => i.product_id === a.id)),
                          )
                          .map((p) => (
                            <option value={p.id} key={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <div className="form-row">
                      <label>
                        כמות
                        <input
                          type="number"
                          min="0.001"
                          max="100000"
                          step="any"
                          required
                          value={line.quantity}
                          onChange={(e) =>
                            lineChange(line.id, {
                              quantity: Number(e.target.value),
                              uncertain: true,
                            })
                          }
                        />
                      </label>
                      <label>
                        יחידה
                        <select
                          value={line.unit}
                          onChange={(e) =>
                            lineChange(line.id, {
                              unit: e.target.value as Unit,
                              uncertain: true,
                            })
                          }
                        >
                          {units.map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="form-row three">
                      <label>
                        מחיר יחידה ₪
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={line.unit_price}
                          onChange={(e) =>
                            lineChange(line.id, {
                              unit_price: Number(e.target.value),
                              uncertain: true,
                            })
                          }
                        />
                      </label>
                      <label>
                        הנחה ₪
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={line.discount}
                          onChange={(e) =>
                            lineChange(line.id, {
                              discount: Number(e.target.value),
                              uncertain: true,
                            })
                          }
                        />
                      </label>
                      <label>
                        סופי לשורה ₪
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={line.total}
                          onChange={(e) =>
                            lineChange(line.id, {
                              total: Number(e.target.value),
                              uncertain: true,
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={!line.uncertain}
                        onChange={(e) =>
                          lineChange(line.id, { uncertain: !e.target.checked })
                        }
                      />
                      בדקתי: השם, הכמות, היחידה והסכום נכונים
                    </label>
                  </div>
                ))}
                {receipt.status === "draft" && (
                  <button
                    type="button"
                    className="outline full"
                    onClick={() =>
                      setReceipt({
                        ...receipt,
                        lines: [
                          ...receipt.lines,
                          {
                            id: uid(),
                            product_id: null,
                            name: "",
                            quantity: 1,
                            unit: "יחידות",
                            unit_price: 0,
                            total: 0,
                            discount: 0,
                            uncertain: true,
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={17} /> הוספת שורה מהקבלה
                  </button>
                )}
                <label className="receipt-total">
                  סכום כולל בקבלה ₪
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={receipt.total}
                    onChange={(e) =>
                      setReceipt({ ...receipt, total: Number(e.target.value) })
                    }
                  />
                </label>
                <p className="subtle">
                  סכום השורות:{" "}
                  {money(receipt.lines.reduce((n, l) => n + l.total, 0))}
                </p>
              </fieldset>
              {receipt.status === "draft" ? (
                <>
                  <button
                    className="primary full"
                    disabled={busy || receiptBusy || !receipt.lines.length}
                  >
                    <Check size={18} /> בדקנו, שומרים את הקבלה
                  </button>
                  <button
                    type="button"
                    className="text-button full"
                    disabled={busy || receiptBusy}
                    onClick={() =>
                      void run(async () => {
                        await dispatch({ type: "receipt", value: receipt });
                        setReceipt({
                          ...receipt,
                          version:
                            (data.receipts.find((r) => r.id === receipt.id)
                              ?.version || 0) + 1,
                        });
                      }, "הטיוטה נשמרה — אפשר לחזור אליה בהיסטוריה")
                    }
                  >
                    שמירת טיוטה להמשך
                  </button>
                </>
              ) : (
                <div className="notice">
                  הקבלה אושרה והמחירים נשמרו. הנתונים המאושרים אינם נדרסים
                  בעריכה.
                </div>
              )}
            </form>
          )}
        </ModalShell>
      )}
      {modal === "settings" && (
        <ModalShell title="הבית הקטן שלנו ⚙️" close={close.current}>
          <section className="settings-section app-updates">
            <Moani pose="notice" className="moani-settings" decorative />
            <h3>מואני בודקת עדכונים</h3>
            <p>
              גרסה מותקנת: <bdi>{APP_VERSION}</bdi>. גם דרך קיצור הדרך במסך הבית
              אפשר לבדוק אם התפרסם עדכון.
            </p>
            <button
              className="outline full"
              disabled={updates.checking}
              onClick={() => void updates.check(true)}
            >
              בדיקת עדכון לאתר
            </button>
            {updates.message && <p role="status">{updates.message}</p>}
            {updates.available && (
              <button
                className="primary full"
                disabled={busy || !store.online}
                onClick={updates.load}
              >
                טעינת העדכון
              </button>
            )}
          </section>
          <section className="settings-section">
            <h3>
              {store.mode === "cloud"
                ? "בית משותף בענן"
                : store.mode === "local"
                  ? "שמירה במכשיר הזה"
                  : "החיבור לענן עדיין לא מוכן"}
            </h3>
            <p>
              {store.mode === "local"
                ? "הרשימות נשמרות בדפדפן הזה בלבד. מחיקת נתוני הדפדפן תמחק אותן. שני טלפונים אינם מסתנכרנים במצב הזה."
                : store.mode === "cloud"
                  ? "כל השינויים המאושרים משותפים לשני חברי הבית. נתונים מקומיים קודמים אינם מועברים לענן אוטומטית."
                  : "השמירה חסומה עד להתחברות, שיוך לבית וטעינה מוצלחת מהענן. לא נשמור מקומית כתחליף לענן."}
            </p>
            <button className="secondary full" onClick={exportBackup}>
              <Download size={17} /> הורדת גיבוי של הנתונים
            </button>
            <small className="subtle">
              תמונות אינן כלולות בגיבוי. אפשר לפתוח ולהוריד אותן בנפרד מהקבלה.
            </small>
            {store.mode === "local" && (
              <>
                <button
                  className="outline full"
                  onClick={() => setConfirmClear(!confirmClear)}
                >
                  <Upload size={17} /> שחזור מקובץ גיבוי
                </button>
                {confirmClear && (
                  <div className="notice vertical">
                    <strong>שחזור מחליף את הנתונים המקומיים הנוכחיים.</strong>
                    <p>
                      הורידו גיבוי לפני שממשיכים. תמונות קודמות נשארות במכשיר.
                    </p>
                    <input
                      aria-label="קובץ גיבוי לשחזור"
                      type="file"
                      accept="application/json"
                      onChange={(e) => void importBackup(e.target.files?.[0])}
                    />
                  </div>
                )}
              </>
            )}
          </section>
          {store.cloudAvailable && store.localData.lists.length > 0 && (
            <section className="settings-section">
              <h3>הרשימות המקומיות שלכם נשמרו במכשיר</h3>
              <p>
                בחרו רשימות להעתקה לבית המשותף. הייבוא לא מוחק מקומית ולא דורס
                נתונים בענן. ניסיון חוזר לא יוצר כפילויות. קבלות ותמונות נשארות
                במכשיר ואינן מיובאות בשלב זה.
              </p>
              <button
                className="secondary full"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(store.localData, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `shopping-local-backup-${localDate()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                הורדת גיבוי מקומי לפני הייבוא
              </button>
              {store.localData.lists.map((list) => (
                <label className="checkbox-label" key={list.id}>
                  <input
                    type="checkbox"
                    checked={importIds.includes(list.id)}
                    onChange={(e) => {
                      setImportIds(
                        e.target.checked
                          ? [...importIds, list.id]
                          : importIds.filter((id) => id !== list.id),
                      );
                      setImportConfirmed(false);
                    }}
                  />
                  {list.name} ·{" "}
                  {
                    store.localData.items.filter((i) => i.list_id === list.id)
                      .length
                  }{" "}
                  מוצרים
                </label>
              ))}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={importConfirmed}
                  onChange={(e) => setImportConfirmed(e.target.checked)}
                />
                אני מאשר להעתיק את הרשימות שבחרתי לבית המשותף בענן
              </label>
              <button
                className="primary full"
                disabled={
                  store.mode !== "cloud" ||
                  busy ||
                  !importConfirmed ||
                  !importIds.length
                }
                onClick={() =>
                  void run(async () => {
                    await store.importLocal(importIds);
                    setImportConfirmed(false);
                    setImportIds([]);
                  }, "הייבוא אושר בענן. המקור המקומי נשמר ללא שינוי.")
                }
              >
                ייבוא הרשימות שבחרנו לענן
              </button>
            </section>
          )}
          <section className="settings-section">
            <h3>
              <Cloud size={18} /> שני טלפונים, רשימה אחת
            </h3>
            {!store.cloudAvailable ? (
              <>
                <p>
                  אפשר להשתמש באתר בלי חשבון. שיתוף חי דורש חיבור לשירות ענן,
                  והוא עדיין לא הוגדר כאן.
                </p>
                <div className="notice">
                  אין כרגע חשבונות, גיבוי ענן או סנכרון בין מכשירים. לא צריך
                  להירשם כדי לנהל רשימות מקומיות.
                </div>
              </>
            ) : !store.session ? (
              <form onSubmit={auth}>
                <label>
                  כתובת דוא״ל
                  <input
                    type="email"
                    autoComplete="email"
                    dir="ltr"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </label>
                <label>
                  סיסמה
                  <input
                    type="password"
                    autoComplete={
                      authSignup ? "new-password" : "current-password"
                    }
                    minLength={8}
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                </label>
                <button className="primary full" disabled={authBusy}>
                  {authSignup ? "יצירת חשבון אישי" : "כניסה לחשבון"}
                </button>
                <button
                  className="text-button full"
                  type="button"
                  onClick={() => setAuthSignup(!authSignup)}
                >
                  {authSignup
                    ? "כבר יש חשבון? נכנסים"
                    : "פעם ראשונה? יוצרים חשבון"}
                </button>
                <button
                  className="text-button full"
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      if (!authEmail) throw Error("הזינו כתובת דוא״ל קודם.");
                      const { error } =
                        await supabase!.auth.resetPasswordForEmail(authEmail, {
                          redirectTo: location.origin + base,
                        });
                      if (error) throw error;
                    }, "אם החשבון קיים, יישלח קישור לאיפוס הסיסמה")
                  }
                >
                  שכחנו סיסמה
                </button>
              </form>
            ) : (
              <>
                <p className="subtle">
                  מחוברים: <bdi>{store.session.user.email}</bdi>
                </p>
                {!store.household ? (
                  <>
                    <button
                      className="primary full"
                      onClick={() =>
                        void run(
                          () => store.connect("הבית שלנו"),
                          "הבית המשותף נוצר. כעת אפשר ליצור הזמנה.",
                        )
                      }
                    >
                      יוצרים את הבית המשותף
                    </button>
                    <label>
                      או מצטרפים עם קוד הזמנה
                      <input
                        value={invite}
                        onChange={(e) => setInvite(e.target.value)}
                        dir="ltr"
                        autoComplete="off"
                      />
                    </label>
                    <button
                      className="secondary full"
                      onClick={() =>
                        void run(
                          () => store.connect("", invite),
                          "ברוכים הבאים הביתה!",
                        )
                      }
                    >
                      הצטרפות לבית
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="secondary full"
                      onClick={() =>
                        void run(async () => {
                          const { data, error } =
                            await supabase!.rpc("shopping_invite");
                          if (error)
                            throw Error(
                              "לא ניתן ליצור הזמנה. ייתכן שהבית כבר מלא.",
                            );
                          setInviteResult(data);
                        })
                      }
                    >
                      יצירת קוד הזמנה לבן הזוג
                    </button>
                    {inviteResult && (
                      <div className="notice vertical">
                        <p>
                          קוד אישי, חד־פעמי, תקף ל־24 שעות. שתפו רק עם בן הזוג:
                        </p>
                        <code dir="ltr" className="invite-code">
                          {inviteResult}
                        </code>
                        <button
                          className="outline"
                          onClick={() =>
                            void run(
                              () => navigator.clipboard.writeText(inviteResult),
                              "הקוד הועתק",
                            )
                          }
                        >
                          העתקת קוד
                        </button>
                      </div>
                    )}
                  </>
                )}
                <button
                  className="text-button full"
                  onClick={() =>
                    void run(async () => {
                      const { error } = await supabase!.auth.signOut();
                      if (error) throw error;
                      setInviteResult("");
                    })
                  }
                >
                  <LogOut size={16} /> יציאה מהחשבון
                </button>
                <details>
                  <summary>עדכון סיסמה</summary>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await run(async () => {
                        const { error } = await supabase!.auth.updateUser({
                          password: authPassword,
                        });
                        if (error) throw error;
                        setAuthPassword("");
                      }, "הסיסמה עודכנה");
                    }}
                  >
                    <label>
                      סיסמה חדשה
                      <input
                        type="password"
                        minLength={8}
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                      />
                    </label>
                    <button className="secondary">שמירת סיסמה</button>
                  </form>
                </details>
              </>
            )}
          </section>
          <section className="settings-section">
            <h3>קיצור דרך למסך הבית</h3>
            <p>
              באייפון: שיתוף ← הוספה למסך הבית. באנדרואיד: תפריט הדפדפן ← התקנת
              אפליקציה או הוספה למסך הבית.
            </p>
            <p className="subtle">
              הדמויות עוצבו על בסיס האיורים שצירפתם. הן נשמרות כקובץ נפרד שאפשר
              להחליף בכל עת.
            </p>
          </section>
        </ModalShell>
      )}
    </>
  );
}
