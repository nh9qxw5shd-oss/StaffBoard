"use client";

// Route Resource Dashboard: maintenance critical competency by DU area (main board plus Saturday
// and Sunday preloads; Main follows the preload at weekends), weekly MOM cover by MOM area, and
// the command structure and additional resources. Saved data stays until wiped by hand.

import { useState } from "react";
import { ChevronDown, Pencil, Plus, ShieldAlert } from "lucide-react";
import { Card, PageHeader, PageSkeleton } from "@/components/ui";
import { useHydrated, useNow } from "@/lib/hooks";
import {
  areaRag, effectiveView, fmtLocalDateTime, isCommandEmpty, liveResources, liveTactical, MCC, mccKeyUpdated, mccKeyWorks, MOM, MOM_LABEL, momWorst, RAG_LABEL, readCommand, readMccArea,
  readMom, RESOURCE_LABEL, selectedView, type MccView,
} from "@/lib/duty/model";
import { edit, kv, useBoardVersion, useSync } from "@/lib/duty/store";
import StoredText from "./StoredText";
import { CommandDrawer, MccDrawer, MomDrawer } from "./ResourceDrawers";
import { MC_COLOR, MOM_COLOR } from "./colors";

const VIEW_LABEL: Record<MccView, string> = { main: "Main", sat: "Saturday preload", sun: "Sunday preload" };

const hhmm = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function tint(c: string) {
  return { borderTop: `3px solid ${c}`, background: c === "var(--text-faint)" ? undefined : `color-mix(in srgb, ${c} 6%, var(--bg-raised))` };
}

export default function Resources() {
  useBoardVersion();
  const sync = useSync();
  const hydrated = useHydrated();
  const now = useNow(60_000);
  const [mccArea, setMccArea] = useState<string | null>(null);
  const [momArea, setMomArea] = useState<string | null>(null);
  const [cmdArea, setCmdArea] = useState<string | null>(null);
  const [cmdOpen, setCmdOpen] = useState<boolean | null>(null);

  if (!hydrated || !sync.loaded) return <PageSkeleton kind="cards" />;

  const sel = selectedView(kv);
  const view = effectiveView(kv, now.getDay());
  const anyCmd = MCC.areas.some((a) => !isCommandEmpty(readCommand(kv, a)));
  const cmdShown = cmdOpen ?? anyCmd;

  return (
    <>
      <PageHeader eyebrow="Booking On Board" title="Route resources" subtitle="Maintenance critical competency by DU area, weekly MOM cover and the command structure. Saved data stays in place until wiped by hand." />

      {/* ---------------------------------------------------------------- MCC */}
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold">Maintenance critical competency</h2>
            <p className="text-xs text-faint">
              Viewing <b className="text-dim">{VIEW_LABEL[view]}</b>
              {sel === "main" && view !== "main" ? " (automatic at the weekend)" : ""} · grey means not yet updated for this view
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-edge bg-sunken p-1" role="tablist" aria-label="Competency view">
            {(["main", "sat", "sun"] as MccView[]).map((v) => (
              <button key={v} role="tab" aria-selected={sel === v} className={`btn btn-sm ${sel === v ? "btn-primary" : "btn-ghost"}`} onClick={() => edit((s) => s.set(MCC.viewModeKey, v), "change")}>
                {v === "main" ? "Main" : v === "sat" ? "Sat preload" : "Sun preload"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {MCC.areas.map((area) => {
            const a = readMccArea(kv, area, view);
            const rag = areaRag(a);
            const c = MC_COLOR[rag];
            return (
              <div key={area} className="card flex flex-col p-4" style={tint(c)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                      {area}
                      {a.override.enabled && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ color: c, background: `color-mix(in srgb, ${c} 15%, transparent)` }} title={a.override.reason || "Declared risk"}>
                          Declared
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-faint">{a.last_updated ? `Updated ${hhmm(a.last_updated)}` : "Not updated"}</div>
                  </div>
                  <button className="btn btn-sm" onClick={() => setMccArea(area)} title="Update competency status">
                    <Pencil size={13} /> Update
                  </button>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {Object.entries(a.sections).map(([sec, s]) => {
                    const detail = s.rag === "amber" || s.rag === "red" ? [s.missing.join(", "), s.mitigation.length > 70 ? `${s.mitigation.slice(0, 70).trim()}…` : s.mitigation].filter(Boolean).join(" – ") : "";
                    return (
                      <li key={sec} className="text-xs">
                        <span className="flex items-center gap-2">
                          <span className="dot" style={{ color: MC_COLOR[s.rag] }} />
                          <b className="w-12 shrink-0 font-semibold">{sec}</b>
                          <span className="text-dim">{RAG_LABEL[s.rag]}</span>
                        </span>
                        {detail && <span className="ml-[1.1rem] block text-faint">{detail}</span>}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3">
                  <span className="lbl">Critical works</span>
                  <StoredText
                    key={`${area}-${view}`}
                    storageKey={mccKeyWorks(area, view)}
                    multiline
                    trim={false}
                    className="input min-h-[64px] text-xs"
                    placeholder="What's biting today? Critical works, constraints, access…"
                    aria-label={`${area} critical works`}
                    onCommitted={() => edit((s) => s.set(mccKeyUpdated(area, view), new Date().toISOString()), "mcc_edit")}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- MOM */}
      <section className="mb-6">
        <div className="mb-3">
          <h2 className="text-sm font-bold">MOM cover</h2>
          <p className="text-xs text-faint">Weekly cover by MOM area, day by day. Grey means not yet updated this week.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MOM.areas.map((area) => {
            const m = readMom(kv, area);
            const worst = momWorst(m);
            return (
              <div key={area} className="card p-4" style={tint(MOM_COLOR[worst])}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{area}</span>
                  <button className="btn btn-sm" onClick={() => setMomArea(area)}>
                    <Pencil size={13} /> Update
                  </button>
                </div>
                <ul className="space-y-1">
                  {MOM.days.map((d) => {
                    const it = m.days[d];
                    return (
                      <li key={d} className="flex items-start gap-2 text-xs">
                        <span className="dot mt-1" style={{ color: MOM_COLOR[it.s] }} />
                        <b className="w-8 shrink-0 font-semibold">{d}</b>
                        <span className="min-w-0 text-dim">
                          {MOM_LABEL[it.s]}
                          {(it.s === "a" || it.s === "r") && it.m.trim() ? ` · ${it.m.trim()}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2 border-t border-edge pt-2 text-xs">
                  <span className="lbl mb-0.5">Notes</span>
                  <span className={m.notes.trim() ? "whitespace-pre-wrap" : "text-faint"}>{m.notes.trim() || "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------ command */}
      <Card padded={false} className="mb-6">
        <button className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={cmdShown} onClick={() => setCmdOpen(!cmdShown)}>
          <ChevronDown size={16} className={`text-faint transition-transform ${cmdShown ? "" : "-rotate-90"}`} />
          <span className="flex-1 text-sm font-bold">Command structure &amp; additional resources</span>
          <span className="text-xs text-faint">{anyCmd ? `${MCC.areas.filter((a) => !isCommandEmpty(readCommand(kv, a))).length} area(s) recorded` : "Nothing recorded"}</span>
        </button>
        {cmdShown && (
          <div className="grid grid-cols-1 gap-3 border-t border-edge p-3 md:grid-cols-2 xl:grid-cols-4">
            {MCC.areas.map((area) => {
              const cmd = readCommand(kv, area);
              const empty = isCommandEmpty(cmd);
              const tac = cmd ? liveTactical(cmd) : [];
              const res = cmd ? liveResources(cmd) : [];
              return (
                <div key={area} className="rounded-[var(--radius-sm)] border border-edge bg-sunken p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{area}</span>
                    <button className="btn btn-sm" onClick={() => setCmdArea(area)}>
                      {empty ? <Plus size={13} /> : <Pencil size={13} />} {empty ? "Add" : "Edit"}
                    </button>
                  </div>
                  {empty ? (
                    <p className="text-xs text-faint">No command or resource data recorded.</p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="lbl mb-0.5">Tactical leads</span>
                        {tac.length ? (
                          <ul className="space-y-0.5">
                            {tac.map((r, i) => (
                              <li key={i}>
                                <b>{r.team || "—"}</b>: {r.contact || "—"}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </div>
                      <div>
                        <span className="lbl mb-0.5">Resources</span>
                        {res.length ? (
                          <ul className="space-y-1">
                            {res.map((x, i) => (
                              <li key={i}>
                                <b>{RESOURCE_LABEL[x.type] ?? "Asset"}</b>
                                {x.description ? ` — ${x.description}` : ""}
                                {x.start || x.end ? <span className="text-faint"> ({fmtLocalDateTime(x.start)}{x.end ? ` → ${fmtLocalDateTime(x.end)}` : ""})</span> : null}
                                {x.location ? ` @ ${x.location}` : ""}
                                {x.contact ? ` | ${x.contact}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ----------------------------------------------------------- guidance */}
      <Card title={<span className="inline-flex items-center gap-2"><ShieldAlert size={15} className="text-faint" /> RAG guidance</span>}>
        <ul className="space-y-2 text-sm text-dim">
          <li className="flex gap-2">
            <span className="dot mt-1.5" style={{ color: "var(--good)" }} /> Full committed competency within the section.
          </li>
          <li className="flex gap-2">
            <span className="dot mt-1.5" style={{ color: "var(--moderate)" }} /> Any backfilling or cross-coverage in place, including cover from the supervisory grade, cross-cover with other sections or use of a MOM for response.
          </li>
          <li className="flex gap-2">
            <span className="dot mt-1.5" style={{ color: "var(--poor)" }} /> A risk is in place as a competency is not available, with no options for cover. Use this where an on-call provision is covering (e.g. SMTH requiring L2 attendance on site overnight), given the impact on response beyond amber.
          </li>
        </ul>
      </Card>

      {mccArea && <MccDrawer key={`${mccArea}-${view}`} area={mccArea} view={view} selected={sel} onClose={() => setMccArea(null)} />}
      {momArea && <MomDrawer key={momArea} area={momArea} onClose={() => setMomArea(null)} />}
      {cmdArea && <CommandDrawer key={cmdArea} area={cmdArea} view={view} onClose={() => setCmdArea(null)} />}
    </>
  );
}
