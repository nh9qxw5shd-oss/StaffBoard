"use client";

// Editors for the Route Resource Dashboard: competency by DU area (with the declared-risk
// override), weekly MOM cover, and the command structure. Each works on a draft and saves on Save;
// Wipe clears the saved entry after a confirmation.

import { useState } from "react";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { Drawer, Field } from "@/components/ui";
import { useDialog, useToast } from "@/components/uiFeedback";
import {
  areaRag, cleanMom, emptyCommand, emptyMom, MCC, mccKeyUpdated, missingOptions, MOM, momKey, momWorst, RAG_LABEL, readCommand, readMccArea, readMom, todayYmd, wipeMccArea,
  writeMccArea, type Command, type McRag, type MccArea, type MccView, type MomArea, type MomStatus, type ResourceType,
} from "@/lib/duty/model";
import { edit, kv, saveCommand } from "@/lib/duty/store";
import { MC_COLOR, MOM_COLOR } from "./colors";

const VIEW_NAME: Record<MccView, string> = { main: "main board", sat: "Saturday preload", sun: "Sunday preload" };

// ------------------------------------------------------------------- MCC

export function MccDrawer({ area, view, selected, onClose }: { area: string; view: MccView; selected: MccView; onClose: () => void }) {
  const toast = useToast();
  const dialog = useDialog();
  const [d, setD] = useState<MccArea>(() => readMccArea(kv, area, view));
  const worst = areaRag(d);

  const setSec = (sec: string, patch: Partial<MccArea["sections"][string]>) => setD({ ...d, sections: { ...d.sections, [sec]: { ...d.sections[sec], ...patch } } });

  function save() {
    edit((s) => writeMccArea(s, area, view, d, new Date().toISOString()), "mcc_save");
    toast.success(`${area} competency saved (${VIEW_NAME[view]})`);
    onClose();
  }

  async function wipe() {
    const auto = selected === "main" && view !== "main" ? " (Main currently shows the weekend preload)" : "";
    const ok = await dialog.confirm({
      title: `Wipe ${area} data?`,
      body: `This permanently clears ${area} on the ${VIEW_NAME[view]}${auto}. Command structure and additional resources are kept.`,
      confirmLabel: "Wipe data",
      danger: true,
    });
    if (!ok) return;
    edit((s) => {
      wipeMccArea(s, area, view);
      s.set(view === "main" ? MCC.wipeKey : MCC.preloadWipeKey, todayYmd());
    }, "manual");
    toast.info(`${area} wiped`);
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`${area} – competency`}
      subtitle={`Coverage per section on the ${VIEW_NAME[view]}. Anything worse than green needs a mitigation note.`}
      footer={
        <>
          <span className="mr-auto flex items-center gap-2 text-sm">
            <span className="dot" style={{ color: MC_COLOR[worst] }} />
            {RAG_LABEL[worst]}
            {d.override.enabled ? " (declared)" : ""}
          </span>
          <button className="btn btn-ghost" onClick={wipe}>
            <Trash2 size={15} /> Wipe data
          </button>
          <button className="btn btn-primary" onClick={save}>
            <Save size={15} /> Save changes
          </button>
        </>
      }
    >
      <div className="mb-4 rounded-[var(--radius-sm)] border border-edge p-3" style={d.override.enabled ? { borderColor: MC_COLOR[d.override.rag === "red" ? "red" : "amber"] } : undefined}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold">Declared risk override</span>
          <button
            type="button"
            role="switch"
            aria-checked={d.override.enabled}
            className="switch"
            onClick={() => setD({ ...d, override: { ...d.override, enabled: !d.override.enabled, rag: d.override.rag === "red" ? "red" : "amber" } })}
          >
            <span />
          </button>
        </div>
        {d.override.enabled && (
          <div className="mt-3 space-y-2">
            <select className="input" value={d.override.rag === "red" ? "red" : "amber"} onChange={(e) => setD({ ...d, override: { ...d.override, rag: e.target.value as McRag } })}>
              <option value="amber">Amber (declared)</option>
              <option value="red">Red (declared)</option>
            </select>
            <Field label="Reason / context">
              <textarea className="input min-h-[60px]" value={d.override.reason} onChange={(e) => setD({ ...d, override: { ...d.override, reason: e.target.value } })} placeholder="Why are we declaring a risk position? Keep it short, keep it useful." />
            </Field>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {Object.entries(d.sections).map(([sec, s]) => {
          const opts = missingOptions(area, sec);
          const needs = s.rag === "amber" || s.rag === "red";
          return (
            <div key={sec} className="rounded-[var(--radius-sm)] border border-edge p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="dot" style={{ color: MC_COLOR[s.rag] }} />
                <span className="w-24 text-sm font-bold">{sec}</span>
                <select className="input min-w-0 flex-1" value={s.rag} onChange={(e) => setSec(sec, { rag: e.target.value as McRag })} aria-label={`${sec} coverage`}>
                  <option value="unknown">Not updated (grey)</option>
                  <option value="green">Full coverage (green)</option>
                  <option value="amber">Missing competency / cover with cross-cover available (amber)</option>
                  <option value="red">Missing competency / cover with NO mitigation available (red)</option>
                </select>
              </div>
              {needs && (
                <div className="mt-3 space-y-2">
                  <span className="lbl">Missing competencies</span>
                  <div className="flex flex-wrap gap-1.5">
                    {opts.length ? (
                      opts.map((o) => (
                        <button key={o} type="button" className="chip" aria-pressed={s.missing.includes(o)} onClick={() => setSec(sec, { missing: s.missing.includes(o) ? s.missing.filter((x) => x !== o) : [...s.missing, o] })}>
                          {o}
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-faint">No options</span>
                    )}
                  </div>
                  <Field label="Mitigation / cover detail">
                    <textarea className="input min-h-[60px]" value={s.mitigation} onChange={(e) => setSec(sec, { mitigation: e.target.value })} placeholder="Who is covering? What's the workaround? Anything to brief ops with?" />
                  </Field>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <Field label="Critical works">
          <textarea className="input min-h-[80px]" value={d.critical_works} onChange={(e) => setD({ ...d, critical_works: e.target.value })} placeholder="Critical works, constraints, resourcing pinch-points…" />
        </Field>
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------- MOM

const MOM_OPTIONS: { v: MomStatus; label: string }[] = [
  { v: "g", label: "Full cover (green)" },
  { v: "a", label: "Reduced cover / mitigation available (amber)" },
  { v: "r", label: "Cover gap / no mitigation (red)" },
  { v: "x", label: "Not updated (grey)" },
];

export function MomDrawer({ area, onClose }: { area: string; onClose: () => void }) {
  const toast = useToast();
  const dialog = useDialog();
  const [d, setD] = useState<MomArea>(() => readMom(kv, area));
  const worst = momWorst(d);
  const setDay = (day: string, patch: Partial<MomArea["days"][string]>) => setD({ ...d, days: { ...d.days, [day]: { ...d.days[day], ...patch } } });

  function save() {
    edit((s) => s.set(momKey(area), JSON.stringify(cleanMom(d))), "mom_change");
    toast.success(`${area} MOM cover saved`);
    onClose();
  }

  async function wipe() {
    const ok = await dialog.confirm({ title: `Wipe ${area} data?`, body: `This permanently clears every day and the notes for ${area}.`, confirmLabel: "Wipe data", danger: true });
    if (!ok) return;
    edit((s) => {
      s.set(momKey(area), JSON.stringify(emptyMom()));
      s.set(MOM.wipeKey, todayYmd());
    }, "mom_change");
    toast.info(`${area} wiped`);
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`MOM cover – ${area}`}
      subtitle="Day-by-day cover position and mitigation. Keep it concise: weekly planning and live awareness."
      footer={
        <>
          <span className="mr-auto flex items-center gap-2 text-sm">
            <span className="dot" style={{ color: MOM_COLOR[worst] }} />
          </span>
          <button className="btn btn-ghost" onClick={wipe}>
            <Trash2 size={15} /> Wipe data
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            <Save size={15} /> Save
          </button>
        </>
      }
    >
      <div className="space-y-2">
        {MOM.days.map((day) => {
          const it = d.days[day];
          return (
            <div key={day} className="rounded-[var(--radius-sm)] border border-edge p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="dot" style={{ color: MOM_COLOR[it.s] }} />
                <span className="w-10 text-sm font-bold">{day}</span>
                <select className="input min-w-0 flex-1" value={it.s} onChange={(e) => setDay(day, { s: e.target.value as MomStatus })} aria-label={`${day} cover`}>
                  {MOM_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {(it.s === "a" || it.s === "r") && (
                <textarea className="input mt-2 min-h-[52px]" value={it.m} onChange={(e) => setDay(day, { m: e.target.value })} placeholder="Who is covering? What's the workaround? Anything to brief ops with?" aria-label={`${day} mitigation`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <Field label="Notes">
          <textarea className="input min-h-[80px]" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} placeholder="Anything to note for the week: constraints, hotspots, handback expectations…" />
        </Field>
      </div>
    </Drawer>
  );
}

// --------------------------------------------------------------- command

export function CommandDrawer({ area, view, onClose }: { area: string; view: MccView; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Command>(() => readCommand(kv, area) ?? emptyCommand());
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await saveCommand(area, d, mccKeyUpdated(area, view));
      toast.success(`${area} command structure saved`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const setTac = (i: number, patch: Partial<Command["tactical"][number]>) => setD({ ...d, tactical: d.tactical.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const setRes = (i: number, patch: Partial<Command["resources"][number]>) => setD({ ...d, resources: d.resources.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Command structure – ${area}`}
      subtitle="Tactical leads and additional resources for this DU area. Keep it concise: rapid coordination during significant events."
      footer={
        <>
          <button className="btn btn-ghost mr-auto" onClick={() => setD(emptyCommand())}>
            Clear
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
          </button>
        </>
      }
    >
      <span className="lbl">Tactical leads</span>
      <div className="space-y-2">
        {d.tactical.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input className="input min-w-0 flex-1" placeholder="Team" value={r.team} onChange={(e) => setTac(i, { team: e.target.value })} aria-label="Team" />
            <input className="input min-w-0 flex-1" placeholder="Contact name" value={r.contact} onChange={(e) => setTac(i, { contact: e.target.value })} aria-label="Contact name" />
            <button className="btn btn-ghost btn-icon" onClick={() => setD({ ...d, tactical: d.tactical.filter((_, j) => j !== i) })} aria-label="Remove tactical lead">
              <X size={15} />
            </button>
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => setD({ ...d, tactical: [...d.tactical, { team: "", contact: "" }] })}>
          <Plus size={14} /> Add tactical lead
        </button>
      </div>

      <span className="lbl mt-5">Resources</span>
      <div className="space-y-2">
        {d.resources.map((r, i) => (
          <div key={i} className="space-y-2 rounded-[var(--radius-sm)] border border-edge p-3">
            <div className="flex gap-2">
              <select className="input !w-auto" value={r.type} onChange={(e) => setRes(i, { type: e.target.value as ResourceType })} aria-label="Resource type">
                <option value="asset">Asset</option>
                <option value="staffing">Staffing</option>
                <option value="competency">Competency cover</option>
              </select>
              <input className="input min-w-0 flex-1" placeholder="Description" value={r.description} onChange={(e) => setRes(i, { description: e.target.value })} aria-label="Description" />
              <button className="btn btn-ghost btn-icon" onClick={() => setD({ ...d, resources: d.resources.filter((_, j) => j !== i) })} aria-label="Remove resource">
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="From">
                <input className="input" type="datetime-local" value={r.start} onChange={(e) => setRes(i, { start: e.target.value })} />
              </Field>
              <Field label="To">
                <input className="input" type="datetime-local" value={r.end} onChange={(e) => setRes(i, { end: e.target.value })} />
              </Field>
              <input className="input" placeholder="Location" value={r.location} onChange={(e) => setRes(i, { location: e.target.value })} aria-label="Location" />
              <input className="input" placeholder="Contact" value={r.contact} onChange={(e) => setRes(i, { contact: e.target.value })} aria-label="Contact" />
            </div>
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => setD({ ...d, resources: [...d.resources, { type: "asset", description: "", start: "", end: "", location: "", contact: "" }] })}>
          <Plus size={14} /> Add resource
        </button>
      </div>
    </Drawer>
  );
}
