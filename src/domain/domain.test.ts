import { describe, expect, it } from "vitest";
import {
  CANONICAL_SESSIONS,
  CANONICAL_SUBJECTS,
  createInitialState,
  getCurrentScheduleContext,
  respondToBuddy,
  searchClassBud,
  validateClassBudState,
} from "./index";

describe("ClassBud domain", () => {
  it("ships the exact canonical timetable totals", () => {
    expect(CANONICAL_SUBJECTS).toHaveLength(15);
    expect(CANONICAL_SESSIONS).toHaveLength(17);
    expect(CANONICAL_SESSIONS.reduce((sum, session) => sum + session.periodIds.length, 0)).toBe(32);
    expect(CANONICAL_SESSIONS.filter(({ mode }) => mode === "flipped").reduce((sum, item) => sum + item.periodIds.length, 0)).toBe(4);
    expect(CANONICAL_SESSIONS.filter(({ mode }) => mode === "self-study").reduce((sum, item) => sum + item.periodIds.length, 0)).toBe(2);
  });

  it("resolves Bangkok current and next classes", () => {
    const context = getCurrentScheduleContext(
      createInitialState(),
      new Date("2026-07-15T02:17:00.000Z"),
    );
    expect(context.currentSession?.session.id).toBe("wed-game-design-development");
    expect(context.nextSession?.session.id).toBe("wed-mathematics-9");
    expect(context.minutesRemaining).toBe(28);
  });

  it("prefers the most specific Buddy subject and answers bilingually", () => {
    const state = createInitialState();
    const now = new Date("2026-07-15T02:17:00.000Z");
    expect(respondToBuddy("คณิตศาสตร์เพิ่มเติมเรียนห้องไหน", state, now)).toMatchObject({
      language: "th",
      intent: "room",
    });
    expect(respondToBuddy("คณิตศาสตร์เพิ่มเติมเรียนห้องไหน", state, now).text).toContain("555");
    expect(respondToBuddy("Who teaches Art 9?", state, now).text).toContain("อ.ชญานิศ");
  });

  it("ranks prefix search and rejects overlaps", () => {
    const state = createInitialState();
    expect(searchClassBud(state, "ว32274")[0]).toMatchObject({ type: "subject", id: "game-design-development" });
    state.sessions.push({
      id: "overlap",
      subjectId: "art-9",
      weekday: 2,
      periodIds: ["P1"],
      room: "1",
      mode: "classroom",
      source: "custom",
    });
    expect(validateClassBudState(state).success).toBe(false);
  });
});
