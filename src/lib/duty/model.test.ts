import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyBoardState, areaRag, buildBoardState, cleanMom, effectiveView, emptyMom, findContact, isCommandEmpty, isNowInRange, keyName, keyTime,
  missingOptions, mccCmdKey, readCommand, mccKeyStatus, mccSections, momWorst, parseRange, readMccArea, readTeam, shiftsFor, slugify, teamState, TEAMS,
  writeMccArea, type KV, type ShiftRow,
} from "./model.ts";

const mapKV = (init: Record<string, string> = {}): KV & { m: Map<string, string> } => {
  const m = new Map(Object.entries(init));
  return { m, get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
};
const team = (n: string) => TEAMS.find((t) => t.name === n)!;
const row = (index: number, time: string, name = ""): ShiftRow => ({ index, label: `r${index}`, time, name, phone: "" });

describe("shift times", () => {
  it("parses ranges and handles overnight", () => {
    assert.deepEqual(parseRange("06:00-18:00"), { start: 360, end: 1080 });
    assert.deepEqual(parseRange("2200-0600"), { start: 1320, end: 360 });
    assert.equal(parseRange("Additional"), null);
    assert.equal(parseRange("-"), null);
    assert.equal(isNowInRange(parseRange("22:00-06:00"), 23 * 60), true);
    assert.equal(isNowInRange(parseRange("22:00-06:00"), 6 * 60), false);
    assert.equal(isNowInRange(parseRange("06:00-06:00"), 7 * 60), false);
  });
  it("lays out MOM 12h / 8h and the fixed non-MOM rows", () => {
    assert.deepEqual(shiftsFor(team("Derby MOM"), "8h").map((s) => s.label), ["Early Turn", "Afternoon Turn", "Night Turn", "Additional"]);
    assert.deepEqual(shiftsFor(team("Derby MOM"), "12h").map((s) => s.label), ["Day Shift", "Night Shift", "Additional"]);
    assert.deepEqual(shiftsFor(team("BTP North"), "8h").map((s) => s.label), ["Current Shift", "Additional"]);
    assert.equal(slugify("West Hampstead S&T Fault Team"), "west_hampstead_s_t_fault_team");
  });
});

describe("team status", () => {
  const st = team("Bedford S&T Fault Team");
  const now = 10 * 60;
  it("on duty, missing a name, out of time, no team, idle", () => {
    assert.equal(teamState(st, [row(0, "06:00-18:00", "A Smith"), row(1, "")], now).status, "on");
    assert.equal(teamState(st, [row(0, "06:00-18:00"), row(1, "")], now).status, "missing");
    assert.equal(teamState(st, [row(0, "18:00-06:00", "A Smith"), row(1, "")], now).status, "expired");
    assert.equal(teamState(st, [row(0, "-"), row(1, "")], now).status, "none");
    assert.equal(teamState(team("Derby MOM"), [row(0, "18:00-06:00", "B"), row(1, ""), row(2, "")], now).status, "idle");
  });
  it("reads stored rows, defaulting an empty time", () => {
    const kv = mapKV({ [keyName("derby_mom", 0)]: "C Jones", [keyTime("derby_mom", 0)]: "" });
    const t = readTeam(kv, team("Derby MOM"));
    assert.equal(t.rows[0].time, "06:00-18:00");
    assert.equal(t.rows[0].name, "C Jones");
  });
});

describe("MCC", () => {
  it("sections and missing-competency options per area", () => {
    assert.deepEqual(mccSections("Derby"), ["Track", "S&T", "D&P"]);
    assert.deepEqual(mccSections("Lincoln"), ["Track", "S&T", "Off Track"]);
    assert.deepEqual(missingOptions("Leicester", "Off Track"), ["Chainsaws", "Polesaws"]);
    assert.deepEqual(missingOptions("Leicester", "S&T"), ["SMTH", "SFI", "COSS", "LXings", "Mech Signalling"]);
    assert.deepEqual(missingOptions("Derby", "Track"), ["TR11", "COSS"]);
  });
  it("Main resolves to the weekend preload on Saturday and Sunday", () => {
    assert.equal(effectiveView(mapKV(), 6), "sat");
    assert.equal(effectiveView(mapKV(), 0), "sun");
    assert.equal(effectiveView(mapKV(), 3), "main");
    assert.equal(effectiveView(mapKV({ mcc_v1_view_mode: "sun" }), 3), "sun");
  });
  it("saves amber with mitigation, drops it for green, and lets a declared override win", () => {
    const kv = mapKV();
    const a = readMccArea(kv, "Derby", "main");
    a.sections["Track"] = { rag: "amber", mitigation: " cover from Notts ", missing: ["COSS"] };
    a.sections["S&T"] = { rag: "green", mitigation: "ignored", missing: ["SFI"] };
    writeMccArea(kv, "Derby", "main", a, "2026-12-01T10:00:00Z");
    const back = readMccArea(kv, "Derby", "main");
    assert.deepEqual(back.sections["Track"], { rag: "amber", mitigation: "cover from Notts", missing: ["COSS"] });
    assert.deepEqual(back.sections["S&T"], { rag: "green", mitigation: "", missing: [] });
    assert.equal(areaRag(back), "amber");
    back.override = { enabled: true, rag: "red", reason: "x" };
    assert.equal(areaRag(back), "red");
    assert.equal(kv.get(mccKeyStatus("Derby", "Track", "sat")), null);
  });
});

describe("MOM and command", () => {
  it("worst day and cleaned mitigation", () => {
    const m = emptyMom();
    assert.equal(momWorst(m), "x");
    m.days.Mon = { s: "g", m: "keep?" };
    m.days.Tue = { s: "a", m: "Notts covering" };
    assert.equal(momWorst(m), "a");
    assert.equal(cleanMom(m).days.Mon.m, "");
    assert.equal(cleanMom(m).days.Tue.m, "Notts covering");
  });
  it("empty command structure", () => {
    assert.equal(isCommandEmpty(null), true);
    assert.equal(isCommandEmpty({ tactical: [{ team: "", contact: " " }], resources: [{ type: "asset", description: "", start: "", end: "", location: "", contact: "" }] }), true);
    assert.equal(isCommandEmpty({ tactical: [{ team: "Tactical", contact: "" }], resources: [] }), false);
    assert.equal(mccCmdKey("Bedford"), "mcc_v1_bedford_cmd_data");
    const kv = mapKV({ mcc_v1_derby_cmd_data: JSON.stringify({ tactical: [], resources: [], strategic: { team: "", contact: "" } }) });
    assert.deepEqual((readCommand(kv, "Derby") as unknown as Record<string, unknown>).strategic, { team: "", contact: "" });
  });
  it("finds phonebook contacts by name ignoring case", () => {
    assert.equal(findContact([{ name: "Derby MOM 1", role: "", phone: "07", notes: "" }], " derby mom 1 ")?.phone, "07");
  });
});

describe("board state", () => {
  it("round-trips teams, MCC and MOM through board_state", () => {
    const a = mapKV({ [keyName("derby_mom", 1)]: "Nights person", "booking_on_board_light_v1_mode_derby_mom": "12h", "mom_v1_derby_data": JSON.stringify({ days: { Mon: { s: "r", m: "gap" } }, notes: "n" }) });
    const area = readMccArea(a, "Bedford", "sat");
    area.sections["OLE"] = { rag: "red", mitigation: "none", missing: ["COSS"] };
    writeMccArea(a, "Bedford", "sat", area, "t");
    const state = buildBoardState(a, "now");
    assert.equal(state.teams.length, TEAMS.length);
    const b = mapKV();
    applyBoardState(b, JSON.parse(JSON.stringify(state)));
    assert.equal(b.get(keyName("derby_mom", 1)), "Nights person");
    assert.equal(readMccArea(b, "Bedford", "sat").sections["OLE"].rag, "red");
    assert.equal(JSON.parse(b.get("mom_v1_derby_data")!).days.Mon.s, "r");
  });
});
