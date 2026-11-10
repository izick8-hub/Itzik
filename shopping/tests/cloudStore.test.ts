import test from "node:test";
import assert from "node:assert/strict";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { ShoppingStore } from "../lib/cloudStore.ts";
import { applyAction, type Action } from "../lib/localActions.ts";
import { emptyData, type Data, type List, type Item } from "../lib/model.ts";
const hid = "10000000-0000-4000-8000-000000000000";
const list: List = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "של שנינו",
  date: "2026-11-12",
  status: "planned",
  version: 1,
  created_at: "2026-11-08T10:00:00.000Z",
};
const item: Item = {
  id: "20000000-0000-4000-8000-000000000001",
  list_id: list.id,
  product_id: "starter-0-0",
  name: "מלפפונים",
  category: "ירקות",
  emoji: "🥒",
  quantity: 1.5,
  unit: "קילוגרמים",
  checked: false,
  version: 1,
};
const session = (id: string) =>
  ({
    user: { id },
    access_token: `fixture-${id}`,
    refresh_token: "fixture",
    expires_in: 3600,
    token_type: "bearer",
  }) as Session;
const tick = () => new Promise((r) => setTimeout(r, 5));
async function until(fn: () => boolean) {
  for (let i = 0; i < 150; i++) {
    if (fn()) return;
    await tick();
  }
  assert.fail("Timed out waiting for test state");
}
function disk(initial: Data = emptyData) {
  let value = structuredClone(initial),
    writes = 0;
  return {
    load: () => structuredClone(value),
    save: (next: Data) => {
      writes++;
      value = structuredClone(next);
    },
    get writes() {
      return writes;
    },
  };
}
class Service {
  data: Data = structuredClone(emptyData);
  channels = new Set<Channel>();
  failWrite = false;
  failRead = false;
  calls: string[] = [];
  envelope() {
    return { household_id: hid, ...structuredClone(this.data) };
  }
  emit() {
    for (const c of this.channels) queueMicrotask(() => c.change());
  }
}
class Channel {
  callbacks: (() => void)[] = [];
  status: (s: string) => void = () => {};
  private service: Service;
  constructor(service: Service) {
    this.service = service;
  }
  on(_kind: unknown, _filter: unknown, fn: () => void) {
    this.callbacks.push(fn);
    return this;
  }
  subscribe(fn: (s: string) => void) {
    this.status = fn;
    this.service.channels.add(this);
    queueMicrotask(() => fn("SUBSCRIBED"));
    return this;
  }
  change() {
    this.callbacks[0]?.();
  }
}
class Client {
  current: Session | null;
  listener: (event: string, s: Session | null) => void = () => {};
  holdMembership: Promise<void> | null = null;
  service: Service;
  constructor(service: Service, id = "a") {
    this.service = service;
    this.current = session(id);
  }
  auth = {
    getSession: async () => ({ data: { session: this.current }, error: null }),
    onAuthStateChange: (fn: Client["listener"]) => {
      this.listener = fn;
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.listener = () => {};
            },
          },
        },
      };
    },
  };
  emit(event: string, s = this.current) {
    this.current = s;
    this.listener(event, s);
  }
  from() {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            await this.holdMembership;
            return { data: { household_id: hid }, error: null };
          },
        }),
      }),
    };
  }
  channel() {
    return new Channel(this.service);
  }
  async removeChannel(channel: Channel) {
    this.service.channels.delete(channel);
    return "ok";
  }
  async rpc(name: string, args: Record<string, unknown>) {
    this.service.calls.push(name);
    if (name === "shopping_snapshot")
      return this.service.failRead
        ? { data: null, error: { code: "PGRST202" } }
        : { data: this.service.envelope(), error: null };
    if (name === "shopping_commit") {
      if (this.service.failWrite)
        return { data: null, error: { code: "42501" } };
      assert.equal(args.expected_household, hid);
      this.service.data = applyAction(this.service.data, args.action as Action);
      this.service.emit();
      return { data: this.service.envelope(), error: null };
    }
    if (name === "shopping_import_local") {
      const payload = args.payload as Data;
      for (const l of payload.lists)
        if (!this.service.data.lists.some((c) => c.id === l.id))
          this.service.data.lists.push(l);
      for (const i of payload.items)
        if (!this.service.data.items.some((c) => c.id === i.id))
          this.service.data.items.push(i);
      this.service.emit();
      return { data: this.service.envelope(), error: null };
    }
    throw Error("Unexpected fixture RPC");
  }
}
function store(client: Client, local = disk()) {
  const s = new ShoppingStore(client as unknown as SupabaseClient, local);
  const stop = s.start();
  return { s, stop, local };
}
test("No silent local save during authentication/membership; local records remain intact", async () => {
  const service = new Service(),
    c = new Client(service),
    local = disk({ ...emptyData, lists: [list], items: [item] });
  let release!: () => void;
  c.holdMembership = new Promise((r) => (release = r));
  const { s, stop } = store(c, local);
  try {
    await assert.rejects(
      s.dispatch({ type: "list", value: list }),
      /השמירה חסומה/,
    );
    await until(() => s.state.mode === "connecting");
    await assert.rejects(
      s.dispatch({ type: "item", value: item }),
      /השמירה חסומה/,
    );
    assert.equal(local.writes, 0);
    release();
    await until(() => s.state.mode === "cloud");
    assert.deepEqual(s.state.data, emptyData);
    assert.equal(s.state.localData.items.length, 1);
    s.localChanged();
    assert.deepEqual(s.state.data, emptyData);
    assert.equal(local.writes, 0);
  } finally {
    stop();
  }
});
test("Two user clients share writes, readback, updates, deletes and reconnect refresh", async () => {
  const service = new Service(),
    a = store(new Client(service, "a")),
    bc = new Client(service, "b"),
    b = store(bc);
  try {
    await until(() => a.s.state.mode === "cloud" && b.s.state.mode === "cloud");
    await a.s.dispatch({ type: "list", value: list });
    await until(() => b.s.state.data.lists.length === 1);
    await a.s.dispatch({ type: "item", value: item });
    await until(() => b.s.state.data.items.length === 1);
    await b.s.dispatch({
      type: "item",
      expected: 1,
      value: { ...b.s.state.data.items[0], checked: true },
    });
    await until(() => a.s.state.data.items[0]?.checked === true);
    assert.equal(a.local.writes + b.local.writes, 0);
    bc.emit("TOKEN_REFRESHED");
    assert.equal(b.s.state.household, hid);
    assert.equal(b.s.state.mode, "cloud");
    await b.s.dispatch({ type: "deleteItem", id: item.id, expected: 2 });
    await until(() => a.s.state.data.items.length === 0);
    service.data.lists.push({ ...list, id: "reconnected" });
    for (const channel of service.channels) {
      channel.status("CHANNEL_ERROR");
      channel.status("SUBSCRIBED");
    }
    await until(() => a.s.state.data.lists.length === 2);
    assert.ok(service.calls.includes("shopping_commit"));
  } finally {
    a.stop();
    b.stop();
  }
});
test("Rejected save and missing migration never report success or fall back locally", async () => {
  const service = new Service(),
    { s, stop, local } = store(new Client(service));
  try {
    await until(() => s.state.mode === "cloud");
    service.failWrite = true;
    await assert.rejects(s.dispatch({ type: "list", value: list }), /42501/);
    assert.equal(s.state.data.lists.length, 0);
    assert.equal(local.writes, 0);
    service.failRead = true;
    await s.retry();
    assert.equal(s.state.mode, "error");
    assert.match(s.state.error, /202611080001/);
    await assert.rejects(
      s.dispatch({ type: "list", value: list }),
      /השמירה חסומה/,
    );
  } finally {
    stop();
  }
});
test("Configured cloud requires sign-in rather than offering silent local writes", async () => {
  const c = new Client(new Service());
  c.current = null;
  const { s, stop, local } = store(c);
  try {
    await until(() => s.state.mode === "signin");
    await assert.rejects(s.dispatch({ type: "list", value: list }));
    assert.equal(local.writes, 0);
  } finally {
    stop();
  }
});
test("Import is explicit, preserves the exact local source, and refreshes the partner", async () => {
  const service = new Service(),
    local = disk({ ...emptyData, lists: [list], items: [item] }),
    a = store(new Client(service), local),
    b = store(new Client(service, "b"));
  try {
    await until(() => a.s.state.mode === "cloud" && b.s.state.mode === "cloud");
    assert.equal(service.calls.includes("shopping_import_local"), false);
    const before = JSON.stringify(local.load());
    await a.s.importLocal([list.id]);
    await until(() => b.s.state.data.items.length === 1);
    await a.s.importLocal([list.id]);
    assert.equal(b.s.state.data.lists.length, 1);
    assert.equal(JSON.stringify(local.load()), before);
    assert.equal(local.writes, 0);
  } finally {
    a.stop();
    b.stop();
  }
});
test("An empty success response is not accepted as a persisted write", async () => {
  const service = new Service(),
    client = new Client(service),
    { s, stop, local } = store(client);
  try {
    await until(() => s.state.mode === "cloud");
    const rpc = client.rpc.bind(client);
    client.rpc = async (name, args) =>
      name === "shopping_commit"
        ? { data: service.envelope(), error: null }
        : rpc(name, args);
    await assert.rejects(s.dispatch({ type: "list", value: list }), /לא אישר/);
    assert.equal(local.writes, 0);
    assert.equal(s.state.data.lists.length, 0);
  } finally {
    stop();
  }
});
test("A read started before a successful write cannot replace the newer snapshot", async () => {
  const service = new Service(),
    client = new Client(service),
    { s, stop } = store(client);
  try {
    await until(() => s.state.mode === "cloud");
    await tick();
    const old = service.envelope(),
      rpc = client.rpc.bind(client);
    let release!: (value: { data: typeof old; error: null }) => void;
    let held = false;
    client.rpc = async (name, args) => {
      if (name === "shopping_snapshot" && !held) {
        held = true;
        return await new Promise((r) => (release = r));
      }
      return rpc(name, args);
    };
    const earlier = s.refresh();
    await s.dispatch({ type: "list", value: list });
    release({ data: old, error: null });
    await earlier;
    assert.equal(s.state.data.lists[0].id, list.id);
  } finally {
    stop();
  }
});
test("Delayed local storage events cannot replace a newer successful local write", async () => {
  let value: Data = structuredClone(emptyData),
    revision = 0;
  const s = new ShoppingStore(null, {
    load: () => structuredClone(value),
    save: (next) => {
      value = structuredClone(next);
      revision++;
    },
    revision: () => revision,
  });
  const stop = s.start();
  try {
    await s.dispatch({ type: "list", value: list });
    const latest = value;
    value = structuredClone(emptyData);
    revision = 0;
    s.localChanged();
    assert.equal(s.state.data.lists[0].id, list.id);
    value = latest;
    revision = 1;
    s.localChanged();
    assert.equal(s.state.data.lists.length, 1);
  } finally {
    stop();
  }
});
test("Partner receives Moani notices for new lists and products; the author does not", async () => {
  const service = new Service(),
    a = store(new Client(service, "a")),
    b = store(new Client(service, "b"));
  try {
    await until(() => a.s.state.mode === "cloud" && b.s.state.mode === "cloud");
    await a.s.dispatch({ type: "list", value: list });
    await until(() => b.s.state.notifications.some((n) => n.kind === "list"));
    assert.equal(a.s.state.notifications.length, 0);
    await a.s.dispatch({ type: "item", value: item });
    await until(() => b.s.state.notifications.some((n) => n.kind === "items"));
    assert.match(
      b.s.state.notifications.find((n) => n.kind === "items")!.title,
      /מואני/,
    );
    await b.s.dispatch({
      type: "completeList",
      id: list.id,
      expected: b.s.state.data.lists[0].version,
    });
    await until(() => a.s.state.data.lists[0].status === "completed");
    assert.equal(service.data.receipts.length, 0);
    assert.equal(service.data.items.length, 1);
    b.s.dismissNotice();
    assert.equal(b.s.state.notifications.length, 0);
  } finally {
    a.stop();
    b.stop();
  }
});
