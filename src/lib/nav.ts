// Navigation model shared by the app shell and the command palette. The Duty Board is one page
// (27 Oct): route resources, the phonebook page and on call were removed; their old addresses
// redirect to the board (next.config.ts).

import { ClipboardList, LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  desc: string;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Duty board", icon: ClipboardList, desc: "Who is on duty now in each MOM, S&T, OLE, BTP and D&P team" },
];
