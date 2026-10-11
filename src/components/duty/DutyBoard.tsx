"use client";

// On duty snapshot: every team in four columns (MOM, S&T, OLE with BTP grouped at the foot, D&P),
// green when the shift on now has a name, red when it has none or the times entered have passed,
// grey otherwise. Opening a team edits its live details.

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { useHydrated, useNow } from "@/lib/hooks";
import { readTeam, slugify, STATUS_TEXT, teamState, TEAMS, tileRag, type Category, type Team, type TeamState } from "@/lib/duty/model";
import { kv, useBoardVersion, useSync } from "@/lib/duty/store";
import TeamDrawer from "./TeamDrawer";

const COLUMNS: { key: Category; title: string }[] = [
  { key: "MOM", title: "MOM teams" },
  { key: "S&T", title: "S&T teams" },
  { key: "OLE", title: "OLE teams" },
  { key: "D&P", title: "D&P teams" },
];
const RAG_COLOR = { green: "var(--good)", red: "var(--poor)", grey: "var(--text-faint)" } as const;

function Tile({ team, st, onOpen }: { team: Team; st: TeamState; onOpen: () => void }) {
  const rag = tileRag(st.status);
  const c = RAG_COLOR[rag];
  return (
    <button
      onClick={onOpen}
      className="card card-link flex w-full items-start gap-2.5 p-3 text-left"
      style={{ borderLeft: `3px solid ${c}`, background: rag === "grey" ? undefined : `color-mix(in srgb, ${c} 7%, var(--bg-raised))` }}
      title={STATUS_TEXT[st.status]}
    >
      <span className="dot mt-1.5" style={{ color: c }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{team.name}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-dim">
          <b className="font-semibold">{st.label}</b>
          {st.time && <span className="font-mono">· {st.time}</span>}
        </span>
        {st.person && <span className="mt-0.5 block truncate text-xs" style={{ color: st.status === "missing" ? "var(--poor)" : "var(--text)" }}>{st.person}</span>}
      </span>
      <ChevronRight size={16} className="mt-1 shrink-0 text-faint" />
    </button>
  );
}

export default function DutyBoard() {
  useBoardVersion();
  const sync = useSync();
  const hydrated = useHydrated();
  const now = useNow(30_000);
  const params = useSearchParams();
  const router = useRouter();
  const open = params.get("team");

  if (!hydrated || !sync.loaded) return <PageSkeleton kind="cards" />;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const states = new Map(TEAMS.map((t) => [t.name, teamState(t, readTeam(kv, t).rows, minutes)]));
  const active = [...states.values()].filter((s) => s.status === "on" || s.status === "missing" || s.status === "expired").length;
  const missing = [...states.values()].filter((s) => s.status === "missing").length;
  const expired = [...states.values()].filter((s) => s.status === "expired").length;
  const openTeam = open ? TEAMS.find((t) => slugify(t.name) === open) : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Booking On Board"
        title="On duty snapshot"
        subtitle={active ? `${active} active shift${active === 1 ? "" : "s"} based on the current timetable.` : "No active shifts found based on the current timetable."}
        actions={
          <span className="flex flex-wrap gap-1.5">
            {missing > 0 && (
              <span className="chip !cursor-default" style={{ color: "var(--poor)" }}>
                <span className="dot" /> {missing} with no name booked on
              </span>
            )}
            {expired > 0 && (
              <span className="chip !cursor-default" style={{ color: "var(--poor)" }}>
                <span className="dot" /> {expired} outside their times
              </span>
            )}
          </span>
        }
      />
      {sync.error && <p className="mb-4 rounded-lg border border-edge bg-sunken px-3 py-2 text-xs" style={{ color: "var(--moderate)" }}>{sync.error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const teams = TEAMS.filter((t) => t.category === col.key);
          const main = teams.filter((t) => !t.subgroup).sort((a, b) => a.name.localeCompare(b.name));
          const btp = teams.filter((t) => t.subgroup === "BTP").sort((a, b) => a.name.localeCompare(b.name));
          const on = teams.filter((t) => states.get(t.name)!.status === "on").length;
          return (
            <section key={col.key} className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-dim">{col.title}</h2>
                <span className="text-[11px] text-faint">
                  {on}/{teams.length} on duty
                </span>
              </div>
              <div className="space-y-2">
                {main.map((t) => (
                  <Tile key={t.name} team={t} st={states.get(t.name)!} onOpen={() => router.push(`/?team=${slugify(t.name)}`)} />
                ))}
                {btp.length > 0 && <div className="px-1 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">BTP</div>}
                {btp.map((t) => (
                  <Tile key={t.name} team={t} st={states.get(t.name)!} onOpen={() => router.push(`/?team=${slugify(t.name)}`)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {openTeam && <TeamDrawer key={openTeam.name} team={openTeam} onClose={() => router.push("/")} />}
    </>
  );
}
