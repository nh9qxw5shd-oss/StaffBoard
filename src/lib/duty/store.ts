"use client";

// The board's working copy lives in this browser's storage under the original keys; Supabase holds
// the shared copy. As the original board did:
//   - on open, the latest board_state is loaded into storage (teams, MCC main + weekend preloads,
//     MOM) along with the command structure (mcc_command_state) and the phonebook (contacts);
//   - every edit is published to board_state (and logged to board_snapshots) 800 ms after the
//     last change, but only once the remote copy has been loaded, so a blank browser can never
//     overwrite the live board;
//   - every 10 seconds the remote copy is re-read when it has changed, unless someone is typing.
// Every view re-renders when storage changes, here or in another open copy (another tab, the
// Derby Control hub frame), so the most recent write shows everywhere.

import { useSyncExternalStore } from "react";
import { sb } from "@/lib/supabase";
import { applyBoardState, BOARD_ID, buildBoardState, keyPhonebook, MCC, mccCmdKey, normName, type Command, type Contact, type KV } from "./model.ts";

const CHANGE = "duty:change";
let version = 0;
const bump = () => {
  version++;
  window.dispatchEvent(new Event(CHANGE));
};

export const kv: KV = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      if (localStorage.getItem(k) === v) return;
      localStorage.setItem(k, v);
    } catch {
      /* storage full or blocked */
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.storageArea !== localStorage) return;
    version++;
    cb();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE, cb);
  };
}

/** Re-render on any change to the board's storage (here or in another open copy). */
export function useBoardVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => -1);
}

// -------------------------------------------------------------- publishing

let remoteHydrated = false;
let ready = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const ALLOWED_EVENTS = new Set(["change", "wipe", "manual"]);

/** Apply local edits (one or many writes), then publish. */
export function edit(fn: (s: KV) => void, eventType = "change"): void {
  fn(kv);
  bump();
  queuePublish(eventType);
}

export function queuePublish(eventType = "change"): void {
  if (!ready || !remoteHydrated) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void publish(eventType), 800);
}

async function publish(eventType: string): Promise<void> {
  if (!ready || !remoteHydrated) return;
  try {
    const state = buildBoardState(kv, new Date().toISOString());
    const { error } = await sb().from("board_state").upsert({ board_id: BOARD_ID, state }, { onConflict: "board_id" });
    if (error) throw error;
    setSync({ lastPublished: Date.now(), error: null });
    // board_snapshots only accepts change / wipe / manual: anything else is logged as "change".
    const type = ALLOWED_EVENTS.has(eventType) ? eventType : "change";
    let { error: snapErr } = await sb().from("board_snapshots").insert({ board_id: BOARD_ID, event_type: type, state });
    if (snapErr && snapErr.code === "23514") ({ error: snapErr } = await sb().from("board_snapshots").insert({ board_id: BOARD_ID, event_type: "change", state }));
    if (snapErr) console.warn("Board snapshot not logged", snapErr.message);
  } catch (e) {
    setSync({ error: `Not saved to the shared board: ${(e as Error).message}` });
  }
}

// -------------------------------------------------------------- sync status

export interface SyncState {
  loaded: boolean;
  remote: boolean;
  lastPulled: number | null;
  lastPublished: number | null;
  error: string | null;
}
let sync: SyncState = { loaded: false, remote: false, lastPulled: null, lastPublished: null, error: null };
const syncListeners = new Set<() => void>();
function setSync(p: Partial<SyncState>) {
  sync = { ...sync, ...p };
  syncListeners.forEach((l) => l());
}
export function useSync(): SyncState {
  return useSyncExternalStore(
    (cb) => {
      syncListeners.add(cb);
      return () => syncListeners.delete(cb);
    },
    () => sync,
    () => sync,
  );
}

// ---------------------------------------------------------------- loading

let lastBoardUpdatedAt: string | null = null;
let lastContactsUpdatedAt: string | null = null;

async function loadCommandState(): Promise<void> {
  const { data, error } = await sb().from("mcc_command_state").select("command, updated_at").eq("board_id", BOARD_ID).maybeSingle();
  if (error || !data?.command) return;
  const areas = data.command as Record<string, Command | null | undefined>;
  // Stored per area; a null area is never deleted locally (only the UI clears it).
  for (const area of MCC.areas) if (areas[area]) kv.set(mccCmdKey(area), JSON.stringify(areas[area]));
}

async function loadBoardState(): Promise<void> {
  const { data, error } = await sb().from("board_state").select("state, updated_at").eq("board_id", BOARD_ID).maybeSingle();
  if (error) throw error;
  if (!data?.state) return;
  remoteHydrated = true;
  applyBoardState(kv, data.state);
  await loadCommandState();
  lastBoardUpdatedAt = (data as { updated_at?: string }).updated_at ?? lastBoardUpdatedAt;
  setSync({ remote: true, lastPulled: Date.now(), error: null });
  bump();
}

/** Someone is typing in this document: do not pull remote state over their field. */
function editing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el || !document.hasFocus()) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

async function poll(): Promise<void> {
  if (editing()) return;
  try {
    const { data } = await sb().from("board_state").select("updated_at").eq("board_id", BOARD_ID).maybeSingle();
    const at = (data as { updated_at?: string } | null)?.updated_at;
    if (at && at !== lastBoardUpdatedAt) await loadBoardState();
  } catch {
    /* next poll */
  }
  try {
    const { data } = await sb().from("contacts").select("updated_at").eq("board_id", BOARD_ID).order("updated_at", { ascending: false }).limit(1);
    const at = (data as { updated_at?: string }[] | null)?.[0]?.updated_at;
    if (at && at !== lastContactsUpdatedAt) {
      lastContactsUpdatedAt = at;
      await loadPhonebook();
    }
  } catch {
    /* next poll */
  }
}

let booted = false;
/** Load the shared board once per page, then keep it fresh. */
export async function boot(): Promise<void> {
  if (booted) return;
  booted = true;
  await loadPhonebook();
  try {
    await loadBoardState();
  } catch (e) {
    setSync({ error: `Shared board not reached: ${(e as Error).message}. Showing this browser's copy.` });
  }
  ready = true;
  setSync({ loaded: true });
  bump();
  setInterval(() => void poll(), 10_000);
}

// --------------------------------------------------------------- phonebook

let phonebook: Contact[] = [];
const pbListeners = new Set<() => void>();
const setBook = (b: Contact[]) => {
  phonebook = b;
  pbListeners.forEach((l) => l());
};
export function usePhonebook(): Contact[] {
  return useSyncExternalStore(
    (cb) => {
      pbListeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        // Another open copy refreshed the cached book (kept in storage as a fallback).
        if (e.key !== keyPhonebook() || !e.newValue) return;
        try {
          const v = JSON.parse(e.newValue);
          if (Array.isArray(v)) setBook(v);
        } catch {
          /* ignore */
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        pbListeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => phonebook,
    () => phonebook,
  );
}

export async function loadPhonebook(): Promise<void> {
  try {
    const { data, error } = await sb().from("contacts").select("id, name, role, phone, notes").eq("board_id", BOARD_ID).order("name", { ascending: true });
    if (error) throw error;
    setBook((data ?? []).map((r) => ({ id: r.id, name: r.name || "", role: r.role || "", phone: r.phone || "", notes: r.notes || "" })));
  } catch {
    try {
      const v = JSON.parse(kv.get(keyPhonebook()) || "[]");
      setBook(Array.isArray(v) ? v : []);
    } catch {
      setBook([]);
    }
  }
}

async function saveBook(book: Contact[]): Promise<void> {
  kv.set(keyPhonebook(), JSON.stringify(book));
  const payload = book.map((c) => ({ id: c.id || undefined, board_id: BOARD_ID, name: c.name, name_norm: normName(c.name), role: c.role || null, phone: c.phone, notes: c.notes || null }));
  const { error } = await sb().from("contacts").upsert(payload, { onConflict: "board_id,name_norm" });
  if (error) throw new Error(`Phonebook not saved: ${error.message}`);
}

export async function addContact(c: Contact): Promise<void> {
  // A name already in the book is replaced (contacts are unique on board and normalised name).
  const existing = phonebook.find((x) => normName(x.name) === normName(c.name));
  const next = [...phonebook.filter((x) => x !== existing), { ...c, id: existing?.id ?? crypto.randomUUID?.() ?? `pb_${Date.now().toString(36)}` }];
  setBook(next);
  await saveBook(next);
}

export async function deleteContact(c: Contact): Promise<void> {
  const next = phonebook.filter((x) => normName(x.name) !== normName(c.name));
  setBook(next);
  const { error } = await sb().from("contacts").delete().eq("board_id", BOARD_ID).eq("name_norm", normName(c.name));
  if (error) console.warn("Contact delete failed (retried on next save)", error.message);
  await saveBook(next);
}

// ----------------------------------------------------------------- command

export async function saveCommand(area: string, cmd: Command, viewUpdatedKey: string): Promise<void> {
  edit((s) => {
    s.set(mccCmdKey(area), JSON.stringify(cmd));
    // Command updates keep the area's "updated" time fresh too.
    s.set(viewUpdatedKey, new Date().toISOString());
  }, "mcc_command_save");
  const areas: Record<string, Command | null> = {};
  for (const a of MCC.areas) {
    try {
      areas[a] = JSON.parse(kv.get(mccCmdKey(a)) || "null");
    } catch {
      areas[a] = null;
    }
  }
  const { error } = await sb().from("mcc_command_state").upsert({ board_id: BOARD_ID, command: areas }, { onConflict: "board_id" });
  if (error) throw new Error(`Command structure not saved: ${error.message}`);
  await sb()
    .from("board_snapshots")
    .insert({ board_id: BOARD_ID, event_type: "change", state: { type: "mcc_command_state_ref", captured_at: new Date().toISOString() } });
}
