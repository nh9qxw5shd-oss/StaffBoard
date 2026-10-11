import type { McRag, MomStatus } from "@/lib/duty/model";

export const MC_COLOR: Record<McRag, string> = { green: "var(--good)", amber: "var(--moderate)", red: "var(--poor)", unknown: "var(--text-faint)" };
export const MOM_COLOR: Record<MomStatus, string> = { g: "var(--good)", a: "var(--moderate)", r: "var(--poor)", x: "var(--text-faint)" };
