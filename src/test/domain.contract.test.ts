import { describe, expect, it } from "vitest";
import {
  CANONICAL_SESSIONS,
  CANONICAL_SUBJECTS,
  DAY_BANDS,
  PERIODS,
  createInitialState,
  getCurrentScheduleContext,
  respondToBuddy,
  serializeClassBudExport,
  validateClassBudState,
  validateImportText,
} from "../domain";
import { classBudReducer } from "../state";

describe("canonical M.5 timetable contract", () => {
  it("contains the exact subject, session, and period totals", () => {
    expect(CANONICAL_SUBJECTS).toHaveLength(15);
    expect(CANONICAL_SESSIONS).toHaveLength(17);
    expect(PERIODS.map(({ start, end }) => `${start}-${end}`)).toEqual([
      "08:15-09:00",
      "09:00-09:45",
      "09:50-10:35",
      "10:35-11:20",
      "12:55-13:40",
      "13:40-14:25",
      "14:30-15:15",
      "15:15-16:00",
    ]);

    const periodTotals = CANONICAL_SESSIONS.reduce(
      (totals, session) => {
        totals.total += session.periodIds.length;
        totals[session.mode] += session.periodIds.length;
        return totals;
      },
      { total: 0, classroom: 0, flipped: 0, "self-study": 0 },
    );
    expect(periodTotals).toEqual({ total: 32, classroom: 26, flipped: 4, "self-study": 2 });
    expect(DAY_BANDS.map(({ id, start, end }) => [id, start, end])).toEqual([
      ["assembly", "07:45", "08:15"],
      ["morning-break", "09:45", "09:50"],
      ["lunch", "11:20", "12:55"],
      ["afternoon-break", "14:25", "14:30"],
    ]);
  });

  it("preserves exact rooms, teachers, codes, and modes", () => {
    const state = createInitialState();
    const game = state.subjects.find(({ id }) => id === "game-design-development");
    const fridayMath = state.sessions.find(({ id }) => id === "fri-additional-mathematics-3");
    const career = state.sessions.find(({ id }) => id === "wed-career-industry");
    const health = state.sessions.find(({ id }) => id === "fri-health-education-9");
    expect(game).toMatchObject({ code: "ว32274", teachers: ["ผศ.สุคนธ์", "อ.คัทลียา"] });
    expect(fridayMath).toMatchObject({ room: "555", periodIds: ["P1", "P2"] });
    expect(career).toMatchObject({ mode: "flipped", periodIds: ["P7", "P8"] });
    expect(health).toMatchObject({ mode: "self-study", periodIds: ["P8"] });
  });

  it("uses Bangkok time for current, lunch, and next class", () => {
    const state = createInitialState();
    const at0917 = getCurrentScheduleContext(state, new Date("2026-07-15T02:17:00.000Z"));
    expect(at0917.currentSession?.subject.id).toBe("game-design-development");
    expect(at0917.nextSession?.subject.id).toBe("mathematics-9");
    expect(at0917.minutesRemaining).toBe(28);

    const atLunch = getCurrentScheduleContext(state, new Date("2026-07-15T04:30:00.000Z"));
    expect(atLunch.currentBand?.id).toBe("lunch");
    expect(atLunch.currentSession).toBeUndefined();
    expect(atLunch.nextSession?.subject.id).toBe("english-listening-speaking-3");

    const duringTuesdayBreak = getCurrentScheduleContext(
      state,
      new Date("2026-07-14T07:27:00.000Z"),
    );
    expect(duringTuesdayBreak.currentBand?.id).toBe("afternoon-break");
    expect(duringTuesdayBreak.currentSession).toBeUndefined();
    expect(duringTuesdayBreak.nextSession?.session.id).toBe("tue-3d-model-sculpting");
    expect(duringTuesdayBreak.minutesRemaining).toBe(3);
  });

  it("answers Buddy from the canonical state in both languages", () => {
    const state = createInitialState();
    const now = new Date("2026-07-15T02:17:00.000Z");
    expect(respondToBuddy("What is next?", state, now).text).toContain("Mathematics 9");
    expect(respondToBuddy("คณิตศาสตร์เพิ่มเติมเรียนห้องไหน", state, now).text).toContain("555");
  });
});

describe("v2 validation contract", () => {
  it("hydrates an incoming cross-tab revision without creating a write loop", () => {
    const local = { ...createInitialState(), revision: 2 };
    const incoming = { ...createInitialState(), revision: 3 };
    expect(classBudReducer(local, { type: "replace-state", state: incoming }).revision).toBe(3);
  });

  it("round-trips a strict export", () => {
    const state = createInitialState();
    const text = serializeClassBudExport(state, new Date("2026-07-15T00:00:00.000Z"));
    const result = validateImportText(text);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.state.scheduleVersion).toBe("m5-im-s1-2569");
  });

  it("hydrates older v2 state with the default app accent", () => {
    const legacyV2 = createInitialState() as unknown as { settings: Record<string, unknown> };
    delete legacyV2.settings.appAccent;
    const result = validateClassBudState(legacyV2);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.settings.appAccent).toBe("blue");
  });

  it("rejects collisions and unknown references", () => {
    const state = createInitialState();
    state.sessions.push({
      id: "collision",
      subjectId: "missing-subject",
      weekday: 2,
      periodIds: ["P1"],
      room: "1",
      mode: "classroom",
      source: "custom",
    });
    const result = validateClassBudState(state);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues?.join(" ")).toMatch(/Unknown subject|Overlaps/);
  });

  it("rejects reversed periods, reserved IDs, mismatched task sessions, and invalid dates", () => {
    const reversed = createInitialState();
    reversed.sessions[0]!.periodIds = ["P2", "P1"];
    expect(validateClassBudState(reversed)).toMatchObject({ success: false });

    const reserved = createInitialState();
    reserved.subjects[0]!.id = "__proto__";
    expect(validateClassBudState(reserved)).toMatchObject({ success: false });

    const mismatched = createInitialState();
    mismatched.tasks.push({
      id: "mismatch",
      subjectId: "mathematics-9",
      sessionId: "tue-art-9",
      title: "Wrong link",
      dueAt: "2026-07-31T23:59:00+07:00",
      completed: false,
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
    });
    expect(validateClassBudState(mismatched)).toMatchObject({ success: false });

    const impossibleDate = createInitialState();
    impossibleDate.tasks.push({
      id: "bad-date",
      subjectId: "art-9",
      title: "Impossible",
      dueAt: "2026-02-31T23:59:00+07:00",
      completed: false,
      createdAt: "0",
      updatedAt: "2026-07-15T00:00:00.000Z",
    });
    expect(validateClassBudState(impossibleDate)).toMatchObject({ success: false });
  });

  it("keeps HTML-looking text inert data", () => {
    const state = createInitialState();
    state.tasks.push({
      id: "task-xss",
      subjectId: "art-9",
      title: "<img src=x onerror=alert(1)>",
      completed: false,
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
    });
    expect(validateClassBudState(state).success).toBe(true);
  });
});
