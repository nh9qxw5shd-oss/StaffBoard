// The Duty Board's data, rules and storage layout. Pure: everything reads and writes through a
// small key-value interface, so the page uses localStorage and the tests use a Map.
//
// Storage keys are exactly those of the original single-page board (booking_on_board_light_v1_*,
// mcc_v1_*, mom_v1_*), and board_state in Supabase keeps the same shape, so both versions and the
// hub's storage bridge read the same data.

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const BOARD_ID = "booking_on_board_main";
export const STORAGE_PREFIX = "booking_on_board_light_v1_";

// ------------------------------------------------------------------ teams

export type Category = "MOM" | "S&T" | "OLE" | "D&P";

export interface Team {
  name: string;
  category: Category;
  subgroup?: "BTP";
}

export const TEAMS: Team[] = [
  { name: "Derby West S&T Fault Team", category: "S&T" },
  { name: "Bedford S&T Fault Team", category: "S&T" },
  { name: "Derby East S&T Fault Team", category: "S&T" },
  { name: "West Hampstead S&T Fault Team", category: "S&T" },
  { name: "Leicester S&T Fault Team", category: "S&T" },
  { name: "Oakham S&T Fault Team", category: "S&T" },
  { name: "Lincoln S&T Fault Team", category: "S&T" },
  { name: "Bedford OLE Fault Team", category: "OLE" },
  { name: "Kettering OLE Fault Team", category: "OLE" },
  { name: "Derby MOM", category: "MOM" },
  { name: "Bedford MOM", category: "MOM" },
  { name: "Nottingham MOM", category: "MOM" },
  { name: "Elstree MOM", category: "MOM" },
  { name: "Leicester MOM", category: "MOM" },
  { name: "West Hampstead MOM", category: "MOM" },
  { name: "Lincoln MOM", category: "MOM" },
  { name: "Kettering MOM", category: "MOM" },
  { name: "Chesterfield MOM", category: "MOM" },
  { name: "BTP North", category: "OLE", subgroup: "BTP" },
  { name: "BTP South", category: "OLE", subgroup: "BTP" },
  { name: "BTP ERU", category: "OLE", subgroup: "BTP" },
  { name: "Bedford D&P Level 1", category: "D&P" },
];

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const keyName = (slug: string, i: number) => `${STORAGE_PREFIX}name_${slug}_${i}`;
export const keyTime = (slug: string, i: number) => `${STORAGE_PREFIX}time_${slug}_${i}`;
export const keyPhone = (slug: string, i: number) => `${STORAGE_PREFIX}phone_${slug}_${i}`;
export const keyJob = (slug: string) => `${STORAGE_PREFIX}job_${slug}`;
export const keyMode = (slug: string) => `${STORAGE_PREFIX}mode_${slug}`;
export const keyPhonebook = () => `${STORAGE_PREFIX}phonebook`;

export type ShiftMode = "12h" | "8h";

export interface ShiftDef {
  label: string;
  time: string;
}

/** MOM teams choose 12h (Day/Night) or 8h (E/A/N); every other team has Current Shift + Additional. */
export function shiftsFor(team: Team, mode: ShiftMode): ShiftDef[] {
  if (team.category !== "MOM")
    return [
      { label: "Current Shift", time: "06:00-18:00" },
      { label: "Additional", time: "" },
    ];
  if (mode === "8h")
    return [
      { label: "Early Turn", time: "06:00-14:00" },
      { label: "Afternoon Turn", time: "14:00-22:00" },
      { label: "Night Turn", time: "22:00-06:00" },
      { label: "Additional", time: "" },
    ];
  return [
    { label: "Day Shift", time: "06:00-18:00" },
    { label: "Night Shift", time: "18:00-06:00" },
    { label: "Additional", time: "" },
  ];
}

export function modeOf(kv: KV, slug: string): ShiftMode {
  return kv.get(keyMode(slug)) === "8h" ? "8h" : "12h";
}

export interface ShiftRow {
  index: number;
  label: string;
  /** "HH:MM-HH:MM", "" (custom, not yet chosen) or "-" (deliberately no team). */
  time: string;
  name: string;
  phone: string;
}

export function readTeam(kv: KV, team: Team): { slug: string; mode: ShiftMode; rows: ShiftRow[]; job: string } {
  const slug = slugify(team.name);
  const mode = modeOf(kv, slug);
  const rows = shiftsFor(team, mode).map((s, i) => ({
    index: i,
    label: s.label,
    // As the original board: an empty stored time falls back to the row's default.
    time: kv.get(keyTime(slug, i)) || s.time,
    name: kv.get(keyName(slug, i)) ?? "",
    phone: kv.get(keyPhone(slug, i)) ?? "",
  }));
  return { slug, mode, rows, job: kv.get(keyJob(slug)) ?? "" };
}

// Time-range presets offered for S&T, OLE, BTP and D&P rows; the stored value is the full range.
export const TIME_RANGE_PRESETS = [
  { label: "06-18", value: "06:00-18:00" },
  { label: "18-06", value: "18:00-06:00" },
  { label: "06-14", value: "06:00-14:00" },
  { label: "14-22", value: "14:00-22:00" },
  { label: "22-06", value: "22:00-06:00" },
];

/** Half-hourly times for the custom From/To pickers. */
export const TIME_OF_DAY: string[] = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

export const normaliseTimeOfDay = (t: string) => {
  const s = String(t || "").trim();
  return /^\d{4}$/.test(s) ? `${s.slice(0, 2)}:${s.slice(2)}` : s;
};

export function parseTimeToMinutes(raw: string): number | null {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, "");
  const parts = s.split(":");
  let h: number;
  let m: number;
  if (parts.length === 2) {
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  } else if (s.length === 4) {
    h = parseInt(s.slice(0, 2), 10);
    m = parseInt(s.slice(2, 4), 10);
  } else return null;
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function parseRange(range: string): { start: number; end: number } | null {
  if (!range || /additional/i.test(range)) return null;
  const parts = range.replace(/\s+/g, "").split("-");
  if (parts.length !== 2) return null;
  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  return start == null || end == null ? null : { start, end };
}

export function isNowInRange(range: { start: number; end: number } | null, nowMinutes: number): boolean {
  if (!range || range.start === range.end) return false;
  if (range.start < range.end) return nowMinutes >= range.start && nowMinutes < range.end;
  return nowMinutes >= range.start || nowMinutes < range.end;
}

export type TeamStatus = "on" | "missing" | "expired" | "none" | "idle";

export interface TeamState {
  status: TeamStatus;
  /** Rows active now. */
  active: number[];
  /** Summary line: label, time and person shown on the snapshot tile. */
  label: string;
  time: string;
  person: string;
}

/**
 * On duty: a row whose time range contains now. Missing: on duty with no name. For non-MOM teams,
 * expired: a named, timed row exists but none is active now (prompting an update); none: the
 * Current Shift is set to "-" (no team booked on).
 */
export function teamState(team: Team, rows: ShiftRow[], nowMinutes: number): TeamState {
  const isMom = team.category === "MOM";
  const active: number[] = [];
  let missing = false;
  let namedRange = false;
  let noTeam = false;
  rows.forEach((r, idx) => {
    if (!isMom && idx === 0 && r.time.trim() === "-") noTeam = true;
    const range = parseRange(r.time);
    if (!range) return;
    if (r.name.trim()) namedRange = true;
    if (isNowInRange(range, nowMinutes)) {
      active.push(idx);
      if (!r.name.trim()) missing = true;
    }
  });
  const onDuty = active.length > 0;
  if (onDuty) {
    const r = rows[active[0]];
    return { status: missing ? "missing" : "on", active, label: r.label, time: r.time, person: r.name.trim() || "(no name booked on)" };
  }
  if (!isMom && !noTeam && namedRange) {
    const r = rows.find((x) => x.name.trim());
    return { status: "expired", active, label: "Update - outside of times entered", time: r?.time ?? "", person: r?.name.trim() ?? "" };
  }
  if (!isMom && noTeam) return { status: "none", active, label: "No team on duty", time: "", person: "" };
  return { status: "idle", active, label: "No active shift", time: "", person: "" };
}

export const STATUS_TEXT: Record<TeamStatus, string> = {
  on: "Shift active",
  missing: "Shift active but no name booked on",
  expired: "Update - outside of times entered",
  none: "No team on duty",
  idle: "No active shift",
};

/** Snapshot tile colour: green on duty, red missing name or out of time, grey otherwise. */
export const tileRag = (s: TeamStatus): "green" | "red" | "grey" => (s === "on" ? "green" : s === "missing" || s === "expired" ? "red" : "grey");

// -------------------------------------------------------------- phonebook

export interface Contact {
  id?: string;
  name: string;
  role: string;
  phone: string;
  notes: string;
}

export const normName = (s: string) => (s || "").trim().toLowerCase();

export function findContact(book: Contact[], name: string): Contact | null {
  const n = normName(name);
  return n ? (book.find((c) => normName(c.name) === n) ?? null) : null;
}

export function filterContacts(book: Contact[], q: string): Contact[] {
  const f = q.trim().toLowerCase();
  return f ? book.filter((c) => `${c.name} ${c.role} ${c.phone} ${c.notes}`.toLowerCase().includes(f)) : book;
}

// -------------------------------------------------------------------- MCC

export type McRag = "green" | "amber" | "red" | "unknown";
export type MccView = "main" | "sat" | "sun";

export const MCC = {
  areas: ["Bedford", "Leicester", "Derby", "Lincoln"],
  baseSections: ["Track", "S&T", "OLE", "D&P"],
  extraSectionsByArea: { Leicester: ["Off Track"], Lincoln: ["Off Track"] } as Record<string, string[]>,
  omitSectionsByArea: { Derby: ["OLE"], Lincoln: ["OLE", "D&P"] } as Record<string, string[]>,
  sectionAliasesByArea: { Leicester: { "Off Track": "Off Track & Drainage" }, Lincoln: { "Off Track": "Off Track & Drainage" } } as Record<string, Record<string, string>>,
  keyPrefix: "mcc_v1_",
  wipeKey: "mcc_v1_last_wipe_date",
  viewModeKey: "mcc_v1_view_mode",
  preloadWipeKey: "mcc_v1_preload_last_wipe_monday",
};

export function mccSections(area: string): string[] {
  const extra = MCC.extraSectionsByArea[area] ?? [];
  const omit = MCC.omitSectionsByArea[area] ?? [];
  return [...MCC.baseSections, ...extra].filter((s) => !omit.includes(s));
}

/** The competencies that can be flagged missing for a section (order matters: "off track" contains "track"). */
export function missingOptions(area: string, section: string): string[] {
  const sec = section.toLowerCase();
  if (sec.includes("off track") || sec.includes("drainage")) return ["Chainsaws", "Polesaws"];
  if (sec.includes("track")) return ["TR11", "COSS"];
  if (sec.includes("s&t")) return area.toLowerCase() === "leicester" ? ["SMTH", "SFI", "COSS", "LXings", "Mech Signalling"] : ["SMTH", "SFI", "COSS"];
  if (sec.includes("ole")) return ["Nominated Person", "COSS"];
  if (sec.includes("d&p")) return ["Level A", "Plant28 (Switch Sig Power)", "COSS"];
  return [];
}

export function selectedView(kv: KV): MccView {
  const v = (kv.get(MCC.viewModeKey) || "main").toLowerCase();
  return v === "sat" || v === "sun" ? v : "main";
}

/** Main resolves to the Saturday / Sunday preload on those days, so the live view is right at weekends. */
export function effectiveView(kv: KV, day: number): MccView {
  const sel = selectedView(kv);
  if (sel !== "main") return sel;
  return day === 6 ? "sat" : day === 0 ? "sun" : "main";
}

const viewSuffix = (v: MccView) => (v === "sat" ? "_sat" : v === "sun" ? "_sun" : "");
const secKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
export const mccKey = (area: string, part: string, view: MccView) => `${MCC.keyPrefix}${area.toLowerCase()}${viewSuffix(view)}_${part}`;
export const mccKeyStatus = (a: string, s: string, v: MccView) => mccKey(a, `status_${secKey(s)}`, v);
export const mccKeyMit = (a: string, s: string, v: MccView) => mccKey(a, `mit_${secKey(s)}`, v);
export const mccKeyMissing = (a: string, s: string, v: MccView) => mccKey(a, `missing_${secKey(s)}`, v);
export const mccKeyWorks = (a: string, v: MccView) => mccKey(a, "critical_works", v);
export const mccKeyUpdated = (a: string, v: MccView) => mccKey(a, "last_updated", v);
export const mccKeyOvOn = (a: string, v: MccView) => mccKey(a, "override_on", v);
export const mccKeyOvRag = (a: string, v: MccView) => mccKey(a, "override_rag", v);
export const mccKeyOvWhy = (a: string, v: MccView) => mccKey(a, "override_reason", v);
/** Command structure is global (not per view) and never touched by MCC wipes. */
export const mccCmdKey = (area: string) => `${MCC.keyPrefix}${area.toLowerCase()}_cmd_data`;

export function normaliseRag(v: string | null | undefined): McRag {
  const s = (v || "").toLowerCase();
  return s === "green" || s === "amber" || s === "red" ? s : "unknown";
}

export const RAG_SEVERITY: Record<McRag, number> = { unknown: 0, green: 1, amber: 2, red: 3 };
export const RAG_LABEL: Record<McRag, string> = { green: "Full coverage", amber: "Cross-cover / backfill", red: "No mitigation", unknown: "Not updated" };

function readMissing(kv: KV, area: string, sec: string, view: MccView): string[] {
  try {
    const arr: unknown = JSON.parse(kv.get(mccKeyMissing(area, sec, view)) || "[]");
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string" && !!x) : [];
  } catch {
    return [];
  }
}

export interface MccSection {
  rag: McRag;
  mitigation: string;
  missing: string[];
}

export interface MccArea {
  critical_works: string;
  last_updated: string | null;
  override: { enabled: boolean; rag: McRag; reason: string };
  sections: Record<string, MccSection>;
}

export function readMccArea(kv: KV, area: string, view: MccView): MccArea {
  const sections: Record<string, MccSection> = {};
  for (const sec of mccSections(area))
    sections[sec] = { rag: normaliseRag(kv.get(mccKeyStatus(area, sec, view))), mitigation: kv.get(mccKeyMit(area, sec, view)) || "", missing: readMissing(kv, area, sec, view) };
  return {
    critical_works: kv.get(mccKeyWorks(area, view)) || "",
    last_updated: kv.get(mccKeyUpdated(area, view)) || null,
    override: { enabled: (kv.get(mccKeyOvOn(area, view)) || "0") === "1", rag: normaliseRag(kv.get(mccKeyOvRag(area, view))), reason: kv.get(mccKeyOvWhy(area, view)) || "" },
    sections,
  };
}

/** A declared override (amber / red) wins; otherwise the worst section. */
export function areaRag(a: MccArea): McRag {
  if (a.override.enabled && (a.override.rag === "amber" || a.override.rag === "red")) return a.override.rag;
  let worst: McRag = "unknown";
  for (const s of Object.values(a.sections)) if (RAG_SEVERITY[s.rag] > RAG_SEVERITY[worst]) worst = s.rag;
  return worst;
}

/** Save the MCC form: mitigation and missing competencies are kept only for amber / red. */
export function writeMccArea(kv: KV, area: string, view: MccView, a: MccArea, now: string): void {
  if (a.override.enabled) {
    kv.set(mccKeyOvOn(area, view), "1");
    kv.set(mccKeyOvRag(area, view), a.override.rag === "red" ? "red" : "amber");
    kv.set(mccKeyOvWhy(area, view), a.override.reason.trim());
  } else {
    kv.set(mccKeyOvOn(area, view), "0");
    kv.remove(mccKeyOvRag(area, view));
    kv.remove(mccKeyOvWhy(area, view));
  }
  for (const sec of mccSections(area)) {
    const s = a.sections[sec] ?? { rag: "unknown", mitigation: "", missing: [] };
    kv.set(mccKeyStatus(area, sec, view), s.rag);
    if (s.rag === "amber" || s.rag === "red") {
      kv.set(mccKeyMit(area, sec, view), s.mitigation.trim());
      if (s.missing.length) kv.set(mccKeyMissing(area, sec, view), JSON.stringify(s.missing));
      else kv.remove(mccKeyMissing(area, sec, view));
    } else {
      kv.remove(mccKeyMit(area, sec, view));
      kv.remove(mccKeyMissing(area, sec, view));
    }
  }
  kv.set(mccKeyWorks(area, view), a.critical_works);
  kv.set(mccKeyUpdated(area, view), now);
}

export function wipeMccArea(kv: KV, area: string, view: MccView): void {
  for (const sec of mccSections(area)) {
    kv.remove(mccKeyStatus(area, sec, view));
    kv.remove(mccKeyMit(area, sec, view));
    kv.remove(mccKeyMissing(area, sec, view));
  }
  kv.remove(mccKeyWorks(area, view));
  kv.remove(mccKeyUpdated(area, view));
  kv.remove(mccKeyOvRag(area, view));
  kv.remove(mccKeyOvWhy(area, view));
  kv.set(mccKeyOvOn(area, view), "0");
}

export interface MccState {
  version: 2;
  last_wipe: string | null;
  areas: Record<string, MccArea>;
}

export function getMccState(kv: KV, view: MccView): MccState {
  const areas: Record<string, MccArea> = {};
  for (const a of MCC.areas) areas[a] = readMccArea(kv, a, view);
  return { version: 2, last_wipe: kv.get(MCC.wipeKey) || null, areas };
}

/** Write a published MCC state back into storage for one view (as the original's loader did). */
export function applyMccState(kv: KV, state: Partial<MccState> | null | undefined, view: MccView): void {
  if (!state?.areas) return;
  if (state.last_wipe) kv.set(MCC.wipeKey, state.last_wipe);
  for (const area of MCC.areas) {
    const a = state.areas[area];
    if (!a) continue;
    if (typeof a.critical_works === "string") kv.set(mccKeyWorks(area, view), a.critical_works);
    if (a.last_updated) kv.set(mccKeyUpdated(area, view), a.last_updated);
    if (a.override && typeof a.override === "object") {
      const en = !!a.override.enabled;
      kv.set(mccKeyOvOn(area, view), en ? "1" : "0");
      if (en) kv.set(mccKeyOvRag(area, view), normaliseRag(a.override.rag) === "red" ? "red" : "amber");
      else kv.remove(mccKeyOvRag(area, view));
      if (en && typeof a.override.reason === "string") kv.set(mccKeyOvWhy(area, view), a.override.reason);
      else kv.remove(mccKeyOvWhy(area, view));
    }
    if (!a.sections) continue;
    for (const sec of mccSections(area)) {
      const alias = MCC.sectionAliasesByArea[area]?.[sec];
      const s = a.sections[sec] ?? (alias ? a.sections[alias] : undefined);
      if (!s) continue;
      const rag = normaliseRag(s.rag);
      kv.set(mccKeyStatus(area, sec, view), rag);
      const mit = String(s.mitigation ?? "");
      if ((rag === "amber" || rag === "red") && mit.trim()) kv.set(mccKeyMit(area, sec, view), mit);
      else kv.remove(mccKeyMit(area, sec, view));
      const miss = Array.isArray(s.missing) ? s.missing.filter(Boolean) : [];
      if (miss.length) kv.set(mccKeyMissing(area, sec, view), JSON.stringify(miss));
      else kv.remove(mccKeyMissing(area, sec, view));
    }
  }
}

// ---------------------------------------------------------------- command

export interface TacticalLead {
  team: string;
  contact: string;
}
export type ResourceType = "asset" | "staffing" | "competency";
export interface Resource {
  type: ResourceType;
  description: string;
  start: string;
  end: string;
  location: string;
  contact: string;
}
export interface Command {
  tactical: TacticalLead[];
  resources: Resource[];
}

export const emptyCommand = (): Command => ({ tactical: [], resources: [] });

export function readCommand(kv: KV, area: string): Command | null {
  try {
    const v = JSON.parse(kv.get(mccCmdKey(area)) || "null");
    // Fields from older versions (e.g. an empty "strategic" lead) are carried through untouched.
    return v && typeof v === "object" ? { ...v, tactical: Array.isArray(v.tactical) ? v.tactical : [], resources: Array.isArray(v.resources) ? v.resources : [] } : null;
  } catch {
    return null;
  }
}

const filled = (...xs: (string | undefined)[]) => xs.some((x) => (x || "").trim());
export const liveTactical = (c: Command) => c.tactical.filter((r) => filled(r.team, r.contact));
export const liveResources = (c: Command) => c.resources.filter((x) => filled(x.start, x.end, x.location, x.contact, x.description));
export const isCommandEmpty = (c: Command | null) => !c || (!c.tactical.some((r) => filled(r.team, r.contact)) && !c.resources.some((x) => filled(x.start, x.end, x.location, x.contact, x.description)));

export const RESOURCE_LABEL: Record<ResourceType, string> = { asset: "Asset", staffing: "Staffing", competency: "Competency cover" };

/** "2026-12-01T06:30" → "01/12/2026 06:30". */
export function fmtLocalDateTime(v: string): string {
  if (!v) return "";
  const [d, t] = v.split("T");
  const [y, m, dd] = (d || "").split("-");
  return y && m && dd ? `${dd}/${m}/${y}${t ? " " + t.slice(0, 5) : ""}` : v;
}

// -------------------------------------------------------------------- MOM

export type MomStatus = "g" | "a" | "r" | "x";
export const MOM = {
  areas: ["Chesterfield", "Derby", "Nottingham", "Leicester", "Kettering", "Bedford", "Elstree", "West Hampstead", "Lincoln"],
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  keyPrefix: "mom_v1_",
  wipeKey: "mom_v1_last_wipe_monday",
};
export const MOM_LABEL: Record<MomStatus, string> = { g: "Full cover", a: "Reduced cover / mitigation", r: "Cover gap / no mitigation", x: "Not updated" };

export interface MomDay {
  s: MomStatus;
  m: string;
}
export interface MomArea {
  days: Record<string, MomDay>;
  notes: string;
}

export const momKey = (area: string) => `${MOM.keyPrefix}${slugify(area)}_data`;

export function emptyMom(): MomArea {
  const days: Record<string, MomDay> = {};
  for (const d of MOM.days) days[d] = { s: "x", m: "" };
  return { days, notes: "" };
}

export function readMom(kv: KV, area: string): MomArea {
  try {
    const v = JSON.parse(kv.get(momKey(area)) || "{}");
    if (!v || !v.days) return emptyMom();
    const base = emptyMom();
    for (const d of MOM.days) if (v.days[d]) base.days[d] = { s: (["g", "a", "r", "x"].includes(v.days[d].s) ? v.days[d].s : "x") as MomStatus, m: String(v.days[d].m ?? "") };
    base.notes = String(v.notes ?? "");
    return base;
  } catch {
    return emptyMom();
  }
}

export function momWorst(m: MomArea): MomStatus {
  let amber = false;
  let red = false;
  let allGrey = true;
  for (const d of MOM.days) {
    const s = m.days[d]?.s ?? "x";
    if (s !== "x") allGrey = false;
    if (s === "r") red = true;
    else if (s === "a") amber = true;
  }
  return red ? "r" : amber ? "a" : allGrey ? "x" : "g";
}

/** Mitigation is kept only for amber / red days. */
export function cleanMom(m: MomArea): MomArea {
  const out = emptyMom();
  out.notes = m.notes;
  for (const d of MOM.days) {
    const it = m.days[d] ?? { s: "x", m: "" };
    out.days[d] = { s: it.s, m: it.s === "a" || it.s === "r" ? it.m : "" };
  }
  return out;
}

// ------------------------------------------------------------ board state

export interface TeamSnapshot {
  name: string;
  category: Category;
  slug: string;
  mode: ShiftMode;
  shifts: { label: string; time: string; name: string; phone: string }[];
  job: string;
}

export interface BoardState {
  version: 2;
  captured_at: string;
  teams: TeamSnapshot[];
  mcc: MccState;
  mcc_preload: { version: 1; last_wipe: string | null; sat: MccState; sun: MccState };
  mom: { version: 1; last_wipe: string | null; areas: Record<string, MomArea> };
}

/** Everything published to board_state, read from storage (same shape as the original board). */
export function buildBoardState(kv: KV, now: string): BoardState {
  const momAreas: Record<string, MomArea> = {};
  for (const a of MOM.areas) momAreas[a] = readMom(kv, a);
  return {
    version: 2,
    captured_at: now,
    teams: TEAMS.map((team) => {
      const t = readTeam(kv, team);
      return {
        name: team.name,
        category: team.category,
        slug: t.slug,
        mode: t.mode,
        shifts: shiftsFor(team, t.mode).map((s, i) => ({ label: s.label, time: kv.get(keyTime(t.slug, i)) || s.time || "", name: kv.get(keyName(t.slug, i)) || "", phone: kv.get(keyPhone(t.slug, i)) || "" })),
        job: t.job,
      };
    }),
    mcc: getMccState(kv, "main"),
    mcc_preload: { version: 1, last_wipe: kv.get(MCC.preloadWipeKey) || null, sat: getMccState(kv, "sat"), sun: getMccState(kv, "sun") },
    mom: { version: 1, last_wipe: kv.get(MOM.wipeKey) || null, areas: momAreas },
  };
}

/** Load a published board_state into storage (teams, MCC main + preloads, MOM). */
export function applyBoardState(kv: KV, state: Partial<BoardState>): void {
  for (const t of state.teams ?? []) {
    const slug = t.slug || slugify(t.name || "");
    if (t.mode) kv.set(keyMode(slug), t.mode);
    (Array.isArray(t.shifts) ? t.shifts : []).forEach((s, i) => {
      kv.set(keyTime(slug, i), s.time || "");
      kv.set(keyName(slug, i), s.name || "");
      kv.set(keyPhone(slug, i), s.phone || "");
    });
    kv.set(keyJob(slug), t.job || "");
  }
  if (state.mcc) applyMccState(kv, state.mcc, "main");
  if (state.mcc_preload) {
    if (state.mcc_preload.last_wipe) kv.set(MCC.preloadWipeKey, state.mcc_preload.last_wipe);
    if (state.mcc_preload.sat) applyMccState(kv, state.mcc_preload.sat, "sat");
    if (state.mcc_preload.sun) applyMccState(kv, state.mcc_preload.sun, "sun");
  }
  if (state.mom?.areas) {
    if (state.mom.last_wipe) kv.set(MOM.wipeKey, state.mom.last_wipe);
    for (const a of MOM.areas) if (state.mom.areas[a]) kv.set(momKey(a), JSON.stringify(state.mom.areas[a]));
  }
}

export function todayYmd(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
