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
    expect(respondToBuddy("Who teaches Art 9 this week?", state, now)).toMatchObject({
      intent: "teacher",
    });
  });

  it("returns a deterministic bilingual weekly timetable", () => {
    const state = createInitialState();
    const now = new Date("2026-07-15T02:17:00.000Z");
    const response = respondToBuddy("Show me the full weekly schedule", state, now);

    expect(response).toMatchObject({ language: "en", intent: "week-schedule" });
    expect(response.text).toContain("Monday\n• No classes");
    expect(response.text).toContain("Art 9 (08:15–09:45, Flipped Classroom / online)");
    expect(response.text).toContain("Health Education 9 (15:15–16:00, Self-study)");
    expect(response.text.indexOf("Monday\n")).toBeLessThan(response.text.indexOf("Tuesday\n"));
    expect(response.text.indexOf("Tuesday\n")).toBeLessThan(response.text.indexOf("Wednesday\n"));
    expect(response.text).not.toContain("<strong>");

    const thai = respondToBuddy("ขอตารางทั้งสัปดาห์", state, now);
    expect(thai).toMatchObject({ language: "th", intent: "week-schedule" });
    expect(thai.text).toContain("ตารางเรียนประจำสัปดาห์");
    expect(thai.text).toContain("วันจันทร์\n• ไม่มีเรียน");
  });

  it("resolves yesterday from the Bangkok calendar across a UTC date boundary", () => {
    const state = createInitialState();
    const now = new Date("2026-07-14T18:30:00.000Z"); // Wednesday 01:30 in Bangkok
    const response = respondToBuddy("What did I have yesterday?", state, now);

    expect(response).toMatchObject({ language: "en", intent: "day-schedule" });
    expect(response.text).toContain("Tuesday 14 July");
    expect(response.text).toContain("Art 9");
    expect(response.text).not.toContain("Game Design & Development");
  });

  it("filters day schedules into morning, afternoon, and evening windows", () => {
    const state = createInitialState();
    const now = new Date("2026-07-15T02:17:00.000Z");
    const morning = respondToBuddy("What is on my schedule this morning?", state, now);
    const afternoon = respondToBuddy("What is on my schedule this afternoon?", state, now);
    const evening = respondToBuddy("What is on my schedule this evening?", state, now);

    expect(morning).toMatchObject({ intent: "day-schedule" });
    expect(morning.text).toContain("· morning");
    expect(morning.text).toContain("Game Design & Development");
    expect(morning.text).toContain("Mathematics 9");
    expect(morning.text).not.toContain("English Listening & Speaking 3");

    expect(afternoon.text).toContain("· afternoon");
    expect(afternoon.text).toContain("English Listening & Speaking 3");
    expect(afternoon.text).toContain("Career Education: Industry");
    expect(afternoon.text).not.toContain("Mathematics 9");
    expect(evening.text).toContain("has no evening classes");

    const thaiTomorrow = respondToBuddy("พรุ่งนี้ตอนบ่ายเรียนอะไร", state, now);
    expect(thaiTomorrow).toMatchObject({ language: "th", intent: "day-schedule" });
    expect(thaiTomorrow.text).toContain("ช่วงบ่าย");
    expect(thaiTomorrow.text).toContain("การเขียนโปรแกรมคอมพิวเตอร์ 1");
    expect(thaiTomorrow.text).toContain("คณิตศาสตร์เพิ่มเติม 3");
  });

  it("scopes subject schedule, room, and mode questions to a Bangkok date and window", () => {
    const state = createInitialState();
    const now = new Date("2026-07-15T02:17:00.000Z");
    const matching = respondToBuddy(
      "Do I have Additional Mathematics tomorrow afternoon?",
      state,
      now,
    );

    expect(matching).toMatchObject({ language: "en", intent: "subject-schedule" });
    expect(matching.text).toContain("Thursday 16 July · afternoon");
    expect(matching.text).toContain("Additional Mathematics 3 (14:30–16:00, Room 1712)");
    expect(matching.text).not.toContain("Room 555");
    expect(matching.text).not.toContain("Computer Programming 1");

    const noMatch = respondToBuddy(
      "Do I have Additional Mathematics tomorrow morning?",
      state,
      now,
    );
    expect(noMatch.text).toContain("is not scheduled in the morning");
    expect(noMatch.text).not.toContain("Room 1712");

    const room = respondToBuddy(
      "Where is Additional Mathematics tomorrow afternoon?",
      state,
      now,
    );
    expect(room).toMatchObject({ intent: "room" });
    expect(room.text).toContain("Room 1712");
    expect(room.text).not.toContain("Room 555");
    expect(respondToBuddy(
      "Is Additional Mathematics online tomorrow afternoon?",
      state,
      now,
    )).toMatchObject({ intent: "mode", text: expect.stringContaining("Classroom") });
    expect(respondToBuddy(
      "Who teaches Additional Mathematics tomorrow afternoon?",
      state,
      now,
    )).toMatchObject({ intent: "teacher", text: expect.stringContaining("อ.มลิธชา") });

    const thai = respondToBuddy("พรุ่งนี้ตอนบ่ายมีคณิตศาสตร์เพิ่มเติม 3 ไหม", state, now);
    expect(thai).toMatchObject({ language: "th", intent: "subject-schedule" });
    expect(thai.text).toContain("ช่วงบ่าย");
    expect(thai.text).toContain("ห้อง 1712");
    expect(thai.text).not.toContain("ห้อง 555");
  });

  it("distinguishes due-today tasks from all unfinished tasks", () => {
    const state = createInitialState();
    const now = new Date("2026-07-15T02:17:00.000Z");
    state.tasks = [
      {
        id: "task-no-date",
        subjectId: "art-9",
        title: "Sketch portfolio",
        completed: false,
        createdAt: "2026-07-13T00:00:00.000Z",
        updatedAt: "2026-07-13T00:00:00.000Z",
      },
      {
        id: "task-tomorrow",
        subjectId: "mathematics-9",
        title: "Problem set",
        dueAt: "2026-07-16T08:00:00+07:00",
        completed: false,
        createdAt: "2026-07-12T00:00:00.000Z",
        updatedAt: "2026-07-12T00:00:00.000Z",
      },
      {
        id: "task-today-complete",
        subjectId: "english-listening-speaking-3",
        title: "Completed recording",
        dueAt: "2026-07-15T09:00:00+07:00",
        completed: true,
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-15T00:00:00.000Z",
      },
      {
        id: "task-today",
        subjectId: "game-design-development",
        title: "Level design notes",
        dueAt: "2026-07-15T10:00:00+07:00",
        completed: false,
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z",
      },
    ];

    const dueToday = respondToBuddy("What homework is due today?", state, now);
    expect(dueToday).toMatchObject({ language: "en", intent: "tasks" });
    expect(dueToday.text).toContain("Due today");
    expect(dueToday.text).toContain("Level design notes");
    expect(dueToday.text).not.toContain("Problem set");
    expect(dueToday.text).not.toContain("Sketch portfolio");
    expect(dueToday.text).not.toContain("Completed recording");

    const all = respondToBuddy("Show all tasks", state, now);
    expect(all.text).toContain("All tasks");
    expect(all.text).toContain("[Done] Completed recording");
    expect(all.text).toContain("[Open] Level design notes");
    expect(all.text).toContain("[Open] Problem set");
    expect(all.text).toContain("[Open] Sketch portfolio");

    const completedSubjectToday = respondToBuddy(
      "Show all tasks for English Listening & Speaking 3 today",
      state,
      now,
    );
    expect(completedSubjectToday.text).toContain("[Done] Completed recording");
    expect(completedSubjectToday.text).not.toContain("Level design notes");

    const mathOpen = respondToBuddy("Show unfinished tasks for Mathematics 9", state, now);
    expect(mathOpen.text).toContain("Problem set");
    expect(mathOpen.text).not.toContain("Level design notes");
    expect(mathOpen.text).not.toContain("Sketch portfolio");

    const mathTomorrow = respondToBuddy("What tasks are due tomorrow for Mathematics 9?", state, now);
    expect(mathTomorrow.text).toContain("Problem set");
    expect(mathTomorrow.text).not.toContain("Level design notes");

    const thaiAll = respondToBuddy("แสดงการบ้านทั้งหมด", state, now);
    expect(thaiAll.text).toContain("งานทั้งหมด");
    expect(thaiAll.text).toContain("[เสร็จแล้ว] Completed recording");
    expect(thaiAll.text).toContain("[ยังไม่เสร็จ] Problem set");

    const open = respondToBuddy("Show my unfinished tasks", state, now);
    expect(open.text).toContain("Open tasks");
    expect(open.text).toContain("Level design notes");
    expect(open.text).toContain("Problem set");
    expect(open.text).toContain("Sketch portfolio");
    expect(open.text).not.toContain("Completed recording");
    expect(open.text.indexOf("Level design notes")).toBeLessThan(open.text.indexOf("Problem set"));
    expect(open.text.indexOf("Problem set")).toBeLessThan(open.text.indexOf("Sketch portfolio"));

    state.tasks.reverse();
    expect(respondToBuddy("Show my unfinished tasks", state, now).text).toBe(open.text);
    expect(respondToBuddy("Show all tasks", state, now).text).toBe(all.text);
    expect(respondToBuddy("มีการบ้านที่ยังไม่เสร็จไหม", state, now).text).toContain("งานที่ยังไม่เสร็จ");

    state.tasks = state.tasks.map((task) => ({ ...task, completed: true }));
    expect(respondToBuddy("Show my open tasks", state, now).text).toBe("You have no open tasks.");
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
