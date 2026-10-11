// Navigation model shared by the app shell and the command palette.

import { BookUser, ClipboardList, LucideIcon, PhoneCall, ShieldCheck } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  desc: string;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Duty board", icon: ClipboardList, desc: "Who is on duty now in each MOM, S&T, OLE, BTP and D&P team" },
  { href: "/resources", label: "Route resources", icon: ShieldCheck, desc: "Maintenance critical competency, MOM cover and command structure" },
  { href: "/phonebook", label: "Phonebook", icon: BookUser, desc: "Contacts behind name autocomplete and phone auto-fill" },
  { href: "/on-call", label: "On call", icon: PhoneCall, desc: "Rostered on-call cover (to follow)" },
];
