"use client";

// One team's live duty details: shift format (MOM teams), each shift's time, name and phone, and
// the job card / handover notes. Every change is saved as it is made.

import { useState } from "react";
import { Drawer } from "@/components/ui";
import { useNow } from "@/lib/hooks";
import {
  findContact, keyJob, keyMode, keyName, keyPhone, keyTime, normaliseTimeOfDay, readTeam, STATUS_TEXT, teamState, TIME_OF_DAY, TIME_RANGE_PRESETS, tileRag, type ShiftRow, type Team,
} from "@/lib/duty/model";
import { edit, kv, usePhonebook, useBoardVersion } from "@/lib/duty/store";
import StoredText from "./StoredText";

const RAG_COLOR = { green: "var(--good)", red: "var(--poor)", grey: "var(--text-faint)" } as const;

function TimeCell({ slug, row, isMom }: { slug: string; row: ShiftRow; isMom: boolean }) {
  // Custom From / To being chosen: held here until both ends are picked, then saved.
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);
  if (isMom) return <StoredText storageKey={keyTime(slug, row.index)} placeholder="HHMM-HHMM" className="input font-mono" aria-label={`${row.label} time`} />;
  // Preset ranges, "no team" ("-") or a custom From / To range from half-hourly pickers.
  const t = row.time;
  const noTeam = t === "-";
  const preset = TIME_RANGE_PRESETS.some((p) => p.value === t);
  const storedCustom = !preset && !noTeam && t.includes("-");
  const custom = pending !== null || storedCustom;
  const [from, to] = pending ? [pending.from, pending.to] : storedCustom ? t.split("-").map(normaliseTimeOfDay) : ["", ""];
  const commit = (v: string) => edit((s) => s.set(keyTime(slug, row.index), v), "edit");
  const pick = (f: string, tt: string) => {
    if (f && tt) {
      setPending(null);
      commit(`${f}-${tt}`);
    } else setPending({ from: f, to: tt });
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      <select
        className="input !w-auto min-w-[7.5rem]"
        value={custom ? "custom" : noTeam ? "-" : preset ? t : "custom"}
        onChange={(e) => {
          if (e.target.value === "custom") setPending({ from: "", to: "" });
          else {
            setPending(null);
            commit(e.target.value);
          }
        }}
        aria-label={`${row.label} time`}
      >
        <option value="-">— (no team)</option>
        {TIME_RANGE_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      {custom && (
        <>
          <select className="input !w-auto font-mono" value={from} onChange={(e) => pick(e.target.value, to)} aria-label="From">
            <option value="">From…</option>
            {TIME_OF_DAY.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select className="input !w-auto font-mono" value={to} onChange={(e) => pick(from, e.target.value)} aria-label="To">
            <option value="">To…</option>
            {TIME_OF_DAY.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

export default function TeamDrawer({ team, onClose }: { team: Team; onClose: () => void }) {
  useBoardVersion();
  const book = usePhonebook();
  const now = useNow(30_000);
  const t = readTeam(kv, team);
  const isMom = team.category === "MOM";
  const st = teamState(team, t.rows, now.getHours() * 60 + now.getMinutes());
  const tag = team.subgroup ?? (isMom ? "MOM" : team.category === "OLE" ? "OLE Fault Team" : team.category === "D&P" ? "D&P" : "S&T Fault Team");

  // A name found in the phonebook fills an empty phone (as the original board did).
  const fillPhone = (row: ShiftRow, name: string) => {
    const c = findContact(book, name);
    if (c?.phone && !(kv.get(keyPhone(t.slug, row.index)) ?? "").trim()) edit((s) => s.set(keyPhone(t.slug, row.index), c.phone.trim()), "edit");
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={team.name}
      subtitle="Edit the live duty details for this team. Changes save as you type."
      footer={
        <span className="mr-auto flex items-center gap-2 text-sm">
          <span className="dot" style={{ color: RAG_COLOR[tileRag(st.status)] }} />
          {STATUS_TEXT[st.status]}
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="chip !cursor-default">{tag}</span>
        {isMom && (
          <label className="flex items-center gap-2 text-xs text-dim">
            Shift format
            <select className="input !h-8 !w-auto !py-0 text-xs" value={t.mode} onChange={(e) => edit((s) => s.set(keyMode(t.slug), e.target.value), "change")}>
              <option value="12h">12h (Day / Night)</option>
              <option value="8h">8h (E / A / N)</option>
            </select>
          </label>
        )}
      </div>

      <div className="space-y-3">
        {t.rows.map((row) => {
          const active = st.active.includes(row.index);
          const missing = active && !row.name.trim();
          return (
            <div
              key={`${t.mode}-${row.index}`}
              className="rounded-[var(--radius-sm)] border p-3"
              style={{ borderColor: missing ? "var(--poor)" : active ? "var(--good)" : "var(--border)", background: active ? `color-mix(in srgb, ${missing ? "var(--poor)" : "var(--good)"} 8%, transparent)` : undefined }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{row.label}</span>
                {active && <span className="text-xs font-semibold" style={{ color: missing ? "var(--poor)" : "var(--good)" }}>{missing ? "On now · no name" : "On now"}</span>}
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="sm:col-span-2">
                  <TimeCell slug={t.slug} row={row} isMom={isMom} />
                </div>
                <StoredText storageKey={keyName(t.slug, row.index)} placeholder="Name on duty" list="phonebookNames" aria-label={`${row.label} name`} onCommitted={(v) => fillPhone(row, v)} />
                <StoredText storageKey={keyPhone(t.slug, row.index)} placeholder="Phone" inputMode="tel" className="input font-mono" aria-label={`${row.label} phone`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <span className="lbl">Job card / handover notes</span>
        <StoredText storageKey={keyJob(t.slug)} multiline trim={false} className="input min-h-[96px]" placeholder="What to remind this team when they book on…" aria-label="Job card / handover notes" />
      </div>
    </Drawer>
  );
}
