"use client";

// Application shell (Autumn Hub kit): sidebar with the board's views, a top bar with search, the
// shared-board status, the London clock and the theme toggle. Loads the shared board once and
// carries the phonebook list used by every name field.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, X } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useHydrated, useLocalStorage, useNow } from "@/lib/hooks";
import { NAV } from "@/lib/nav";
import { boot, usePhonebook, useSync } from "@/lib/duty/store";
import { CommandPalette, openPalette } from "@/components/CommandPalette";

// Clipboard with the duty list in Network Rail orange (same mark as the favicon, src/app/icon.svg).
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <g fill="none" stroke="#F26522" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <rect x="6" y="5" width="20" height="23" rx="3" />
        <path d="M12 5V3h8v2M11 13h10M11 18h10M11 23h6" />
      </g>
    </svg>
  );
}

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    const ind = indicatorRef.current;
    if (!list || !ind) return;
    const active = list.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) {
      ind.style.opacity = "0";
      return;
    }
    const lr = list.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    ind.style.opacity = "1";
    ind.style.transform = `translateY(${ar.top - lr.top + 6}px)`;
    ind.style.height = `${ar.height - 12}px`;
  }, [path]);
  return (
    <div ref={listRef} className="relative">
      <span ref={indicatorRef} className="nav-indicator" style={{ top: 0, opacity: 0 }} />
      <div className="nav-group-label">Booking On Board</div>
      {NAV.map((it) => (
        <Link key={it.href} href={it.href} className="nav-item" aria-current={isActive(path, it.href) ? "page" : undefined} title={it.desc} onClick={onNavigate}>
          <it.icon size={17} strokeWidth={2.1} />
          <span className="nav-label">{it.label}</span>
        </Link>
      ))}
    </div>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className="sidebar hidden lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-4 py-4">
        <BrandMark />
        <span className="nav-label leading-tight">
          <span className="block text-[15px] font-extrabold tracking-tight">Duty Board</span>
          <span className="block text-[11px] font-semibold text-faint">Booking On Board</span>
        </span>
      </Link>
      <div className="flex-1 overflow-y-auto pb-4">
        <SidebarNav />
      </div>
      <div className="border-t border-edge p-2">
        <button className="nav-item w-[calc(100%-1rem)] text-faint" onClick={onToggle} title={collapsed ? "Expand navigation" : "Collapse navigation"}>
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          <span className="nav-label text-xs">Collapse</span>
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="backdrop lg:hidden" onMouseDown={onClose}>
      <div className="sheet flex h-full w-72 max-w-[85vw] flex-col border-r border-edge bg-sunken" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-[15px] font-extrabold">Duty Board</span>
          </span>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <SidebarNav onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}

function SyncChip() {
  const s = useSync();
  if (!s.loaded) return null;
  const color = s.error ? "var(--poor)" : s.remote ? "var(--good)" : "var(--moderate)";
  const text = s.error ? "Not synced" : s.remote ? "Shared board" : "Local copy";
  const title = s.error ?? (s.remote ? "Edits are published to the shared board and every desk sees them" : "No shared board found: edits stay in this browser");
  return (
    <span className="chip !cursor-default" title={title}>
      <span className="dot" style={{ color }} />
      <span className="hidden sm:inline">{text}</span>
    </span>
  );
}

function Clock() {
  const now = useNow(15000);
  const hydrated = useHydrated();
  if (!hydrated) return null;
  const hhmm = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  const day = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/London" });
  return (
    <span className="hidden items-baseline gap-1.5 text-sm md:inline-flex" title="Europe/London">
      <span className="font-mono text-base font-semibold tabular-nums">{hhmm}</span>
      <span className="text-xs text-dim">{day}</span>
    </span>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const light = theme === "light";
  return (
    <button className="btn btn-ghost btn-icon" onClick={toggle} aria-label={light ? "Switch to dark theme" : "Switch to light theme"} title={light ? "Switch to dark theme" : "Switch to light theme"}>
      <span key={theme} className="pop inline-flex">
        {light ? <Moon size={17} /> : <Sun size={17} />}
      </span>
    </button>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="topbar glass flex items-center gap-2 px-3 sm:px-4">
      <button className="btn btn-ghost btn-icon lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu size={18} />
      </button>
      <Link href="/" className="flex items-center gap-2 lg:hidden">
        <BrandMark size={22} />
        <span className="text-sm font-extrabold">Duty Board</span>
      </Link>
      <button className="btn btn-ghost ml-1 hidden min-w-[220px] justify-start gap-2 border border-edge bg-sunken text-dim sm:flex" onClick={() => openPalette()} title="Find a team, contact or view">
        <Search size={15} />
        <span className="flex-1 text-left text-xs font-medium">Find a team or contact…</span>
        <span className="flex gap-0.5">
          <kbd className="kbd">Ctrl</kbd>
          <kbd className="kbd">K</kbd>
        </span>
      </button>
      <button className="btn btn-ghost btn-icon sm:hidden" onClick={() => openPalette()} aria-label="Search">
        <Search size={18} />
      </button>
      <div className="flex-1" />
      <SyncChip />
      <Clock />
      <ThemeToggle />
    </header>
  );
}

/** Names offered by every "name on duty" field (from the phonebook). */
function PhonebookNames() {
  const book = usePhonebook();
  return (
    <datalist id="phonebookNames">
      {[...book]
        .filter((c) => c.name)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => (
          <option key={c.name} value={c.name} />
        ))}
    </datalist>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useLocalStorage("duty_nav_collapsed", false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    void boot();
  }, []);
  return (
    <div className="app-shell" data-collapsed={collapsed ? "true" : "false"}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-col">
        <TopBar onMenu={() => setMenuOpen(true)} />
        <main className="content flex-1">{children}</main>
        <footer className="content !py-4 text-xs text-faint">Duty Board · Booking On Board · Derby Control · Board {"booking_on_board_main"}</footer>
      </div>
      <PhonebookNames />
      <CommandPalette />
    </div>
  );
}
