import { WEEKDAY_NAMES } from "./schedule";
import {
  addDaysToBangkokDateKey,
  bangkokDateAt,
  bangkokDateKey,
  formatBangkokDate,
  getBangkokParts,
  getCurrentScheduleContext,
  getSessionBounds,
  getSessionsForWeekday,
  getTasksDueToday,
  getWeekdayForDateKey,
} from "./time";
import { normalizeSearchText } from "./search";
import type {
  CalendarWeekday,
  ClassBudStateV2,
  Session,
  Subject,
} from "./types";

export type BuddyLanguage = "th" | "en";
export type BuddyIntent =
  | "current"
  | "next"
  | "day-schedule"
  | "subject-schedule"
  | "room"
  | "teacher"
  | "mode"
  | "tasks"
  | "ambiguous"
  | "unsupported";

export interface BuddyResponse {
  language: BuddyLanguage;
  intent: BuddyIntent;
  text: string;
  choices?: Array<{ id: string; label: string }>;
}

const THAI_PATTERN = /[\u0E00-\u0E7F]/u;

const weekdayQueries: Array<{
  weekday: CalendarWeekday;
  values: string[];
}> = [
  { weekday: 1, values: ["monday", "mon", "วันจันทร์", "จันทร์"] },
  { weekday: 2, values: ["tuesday", "tue", "วันอังคาร", "อังคาร"] },
  { weekday: 3, values: ["wednesday", "wed", "วันพุธ", "พุธ"] },
  { weekday: 4, values: ["thursday", "thu", "วันพฤหัสบดี", "พฤหัส"] },
  { weekday: 5, values: ["friday", "fri", "วันศุกร์", "ศุกร์"] },
  { weekday: 6, values: ["saturday", "sat", "วันเสาร์", "เสาร์"] },
  { weekday: 7, values: ["sunday", "sun", "วันอาทิตย์", "อาทิตย์"] },
];

function containsAny(query: string, values: string[]): boolean {
  return values.some((value) => query.includes(normalizeSearchText(value)));
}

function findSubjects(query: string, state: ClassBudStateV2): Subject[] {
  const exact = state.subjects.filter((subject) => {
    const code = normalizeSearchText(subject.code);
    const names = [subject.nameTh, subject.nameEn].map(normalizeSearchText);
    return query.includes(code) || names.some((name) => query.includes(name));
  });
  if (exact.length) return exact;

  const scored = state.subjects.map((subject) => {
    const names = [subject.nameTh, subject.nameEn].map(normalizeSearchText);
    const matchedStemLength = Math.max(
      0,
      ...names.map((name) => {
        const stem = name.replace(/\s+\d+$/u, "");
        return stem.length >= 4 && query.includes(stem) ? stem.length : 0;
      }),
    );
    const tokens = [...new Set(
      names
        .flatMap((field) => field.split(/[\s&:(),.-]+/u))
        .filter((token) => token.length >= 4 && !/^\d+$/u.test(token)),
    )];
    const tokenMatches = tokens.filter((token) => query.includes(token)).length;
    return { subject, score: matchedStemLength * 100 + tokenMatches };
  });
  const best = Math.max(0, ...scored.map(({ score }) => score));
  return best ? scored.filter(({ score }) => score === best).map(({ subject }) => subject) : [];
}

function subjectName(subject: Subject, language: BuddyLanguage): string {
  return language === "th" ? subject.nameTh : subject.nameEn;
}

function roomLabel(session: Session, language: BuddyLanguage): string {
  if (session.room) return language === "th" ? `ห้อง ${session.room}` : `Room ${session.room}`;
  if (session.mode === "flipped") return language === "th" ? "Flipped Classroom / ออนไลน์" : "Flipped Classroom / online";
  return language === "th" ? "เรียนด้วยตนเอง" : "Self-study";
}

function modeLabel(session: Session, language: BuddyLanguage): string {
  if (language === "th") {
    if (session.mode === "classroom") return "เรียนในห้อง";
    if (session.mode === "flipped") return "Flipped Classroom / ออนไลน์";
    return "เรียนด้วยตนเอง / งานที่ได้รับมอบหมาย";
  }
  if (session.mode === "classroom") return "Classroom";
  if (session.mode === "flipped") return "Flipped Classroom / online";
  return "Self-study / assigned work";
}

function describeSession(
  session: Session,
  subject: Subject,
  language: BuddyLanguage,
): string {
  const { start, end } = getSessionBounds(session);
  return language === "th"
    ? `${subject.nameTh} (${start}–${end}, ${roomLabel(session, language)})`
    : `${subject.nameEn} (${start}–${end}, ${roomLabel(session, language)})`;
}

function getRequestedDateKey(query: string, now: Date): string | undefined {
  const today = bangkokDateKey(now);
  if (containsAny(query, ["tomorrow", "พรุ่งนี้"])) return addDaysToBangkokDateKey(today, 1);
  if (containsAny(query, ["today", "วันนี้"])) return today;
  const todayWeekday = getBangkokParts(now).weekday;
  const requested = weekdayQueries.find(({ values }) => containsAny(query, values));
  if (!requested) return undefined;
  const offset = (requested.weekday - todayWeekday + 7) % 7;
  return addDaysToBangkokDateKey(today, offset);
}

function dayScheduleResponse(
  state: ClassBudStateV2,
  dateKey: string,
  language: BuddyLanguage,
): BuddyResponse {
  const weekday = getWeekdayForDateKey(dateKey);
  const sessions = getSessionsForWeekday(state, weekday);
  const date = bangkokDateAt(dateKey, "12:00");
  const dateLabel = formatBangkokDate(date, language === "th" ? "th-TH" : "en-GB");
  if (!sessions.length) {
    return {
      language,
      intent: "day-schedule",
      text:
        language === "th"
          ? `${dateLabel} ไม่มีวิชาตามตารางประจำสัปดาห์`
          : `${dateLabel} has no classes in the recurring timetable.`,
    };
  }
  const subjectById = new Map(state.subjects.map((subject) => [subject.id, subject]));
  const lines = sessions.flatMap((session) => {
    const subject = subjectById.get(session.subjectId);
    return subject ? [describeSession(session, subject, language)] : [];
  });
  return {
    language,
    intent: "day-schedule",
    text:
      language === "th"
        ? `${dateLabel}\n${lines.map((line) => `• ${line}`).join("\n")}`
        : `${dateLabel}\n${lines.map((line) => `• ${line}`).join("\n")}`,
  };
}

function ambiguousResponse(subjects: Subject[], language: BuddyLanguage): BuddyResponse {
  return {
    language,
    intent: "ambiguous",
    text:
      language === "th"
        ? "หมายถึงวิชาไหน เลือกได้เลย"
        : "Which subject do you mean?",
    choices: subjects.map((subject) => ({
      id: subject.id,
      label: `${subjectName(subject, language)} · ${subject.code}`,
    })),
  };
}

function subjectResponse(
  subject: Subject,
  intent: "subject-schedule" | "room" | "teacher" | "mode",
  state: ClassBudStateV2,
  language: BuddyLanguage,
): BuddyResponse {
  const sessions = state.sessions
    .filter(({ subjectId }) => subjectId === subject.id)
    .sort((left, right) => left.weekday - right.weekday || getSessionBounds(left).startMinutes - getSessionBounds(right).startMinutes);
  if (intent === "teacher") {
    return {
      language,
      intent,
      text:
        language === "th"
          ? `${subject.nameTh} สอนโดย ${subject.teachers.join(", ")}`
          : `${subject.nameEn} is taught by ${subject.teachers.join(", ")}.`,
    };
  }
  if (!sessions.length) {
    return {
      language,
      intent,
      text:
        language === "th"
          ? `${subject.nameTh} ยังไม่มีคาบในตาราง`
          : `${subject.nameEn} has no scheduled sessions.`,
    };
  }
  if (intent === "room") {
    const rooms = [...new Set(sessions.map((session) => roomLabel(session, language)))];
    return {
      language,
      intent,
      text:
        language === "th"
          ? `${subject.nameTh}: ${rooms.join(", ")}`
          : `${subject.nameEn}: ${rooms.join(", ")}.`,
    };
  }
  if (intent === "mode") {
    const modes = [...new Set(sessions.map((session) => modeLabel(session, language)))];
    return {
      language,
      intent,
      text:
        language === "th"
          ? `${subject.nameTh}: ${modes.join(", ")}`
          : `${subject.nameEn}: ${modes.join(", ")}.`,
    };
  }
  const lines = sessions.map((session) => {
    const weekday = WEEKDAY_NAMES[session.weekday];
    const bounds = getSessionBounds(session);
    return language === "th"
      ? `${weekday.thai} ${bounds.start}–${bounds.end} · ${roomLabel(session, language)}`
      : `${weekday.long} ${bounds.start}–${bounds.end} · ${roomLabel(session, language)}`;
  });
  return {
    language,
    intent,
    text: `${subjectName(subject, language)}\n${lines.map((line) => `• ${line}`).join("\n")}`,
  };
}

export function respondToBuddy(
  input: string,
  state: ClassBudStateV2,
  now: Date = new Date(),
): BuddyResponse {
  const language: BuddyLanguage = THAI_PATTERN.test(input) ? "th" : "en";
  const query = normalizeSearchText(input);
  const context = getCurrentScheduleContext(state, now);
  const subjectById = new Map(state.subjects.map((subject) => [subject.id, subject]));

  if (containsAny(query, ["current", "right now", "ตอนนี้", "ขณะนี้"])) {
    if (context.currentSession) {
      const { session, subject, end } = context.currentSession;
      return {
        language,
        intent: "current",
        text:
          language === "th"
            ? `ตอนนี้เรียน ${subject.nameTh} ถึง ${end} · ${roomLabel(session, language)} เหลือประมาณ ${context.minutesRemaining ?? 0} นาที`
            : `You have ${subject.nameEn} now until ${end} · ${roomLabel(session, language)}. About ${context.minutesRemaining ?? 0} minutes remain.`,
      };
    }
    if (context.currentBand) {
      return {
        language,
        intent: "current",
        text:
          language === "th"
            ? `ตอนนี้เป็น${context.currentBand.labelTh} ถึง ${context.currentBand.end}`
            : `It is ${context.currentBand.label.toLowerCase()} until ${context.currentBand.end}.`,
      };
    }
    return {
      language,
      intent: "current",
      text: language === "th" ? "ตอนนี้ไม่มีคาบเรียน" : "There is no class right now.",
    };
  }

  if (containsAny(query, ["next", "up next", "ถัดไป", "ต่อไป"])) {
    const occurrence = context.nextSession;
    if (!occurrence) {
      return { language, intent: "next", text: language === "th" ? "ไม่พบคาบถัดไป" : "No next class was found." };
    }
    const day = WEEKDAY_NAMES[occurrence.session.weekday];
    return {
      language,
      intent: "next",
      text:
        language === "th"
          ? `คาบถัดไปคือ ${occurrence.subject.nameTh} ${day.thai} ${occurrence.start} · ${roomLabel(occurrence.session, language)}`
          : `Next is ${occurrence.subject.nameEn}, ${day.long} at ${occurrence.start} · ${roomLabel(occurrence.session, language)}.`,
    };
  }

  if (containsAny(query, ["task", "tasks", "homework", "due", "งาน", "การบ้าน", "กำหนดส่ง"])) {
    const tasks = getTasksDueToday(state, now).filter(({ completed }) => !completed);
    if (!tasks.length) {
      return { language, intent: "tasks", text: language === "th" ? "วันนี้ไม่มีงานที่ต้องส่ง" : "Nothing is due today." };
    }
    const lines = tasks.map((task) => {
      const subject = subjectById.get(task.subjectId);
      return `${task.title}${subject ? ` · ${subjectName(subject, language)}` : ""}`;
    });
    return {
      language,
      intent: "tasks",
      text: `${language === "th" ? "งานที่ต้องส่งวันนี้" : "Due today"}\n${lines.map((line) => `• ${line}`).join("\n")}`,
    };
  }

  const subjects = findSubjects(query, state);
  const requestedIntent: "subject-schedule" | "room" | "teacher" | "mode" =
    containsAny(query, ["room", "where", "ห้อง", "ที่ไหน"])
      ? "room"
      : containsAny(query, ["teacher", "who teaches", "ครู", "อาจารย์", "ใครสอน"])
        ? "teacher"
        : containsAny(query, ["mode", "online", "flipped", "self-study", "รูปแบบ", "ออนไลน์", "เรียนเอง"])
          ? "mode"
          : "subject-schedule";
  if (subjects.length > 1) return ambiguousResponse(subjects, language);
  if (subjects[0]) return subjectResponse(subjects[0], requestedIntent, state, language);

  const requestedDate = getRequestedDateKey(query, now);
  if (requestedDate || containsAny(query, ["schedule", "timetable", "classes", "class", "ตาราง", "เรียน"])) {
    return dayScheduleResponse(state, requestedDate ?? bangkokDateKey(now), language);
  }

  return {
    language,
    intent: "unsupported",
    text:
      language === "th"
        ? "ลองถามว่า “วันนี้เรียนอะไร”, “คาบถัดไปคืออะไร” หรือ “คณิตเรียนห้องไหน”"
        : "Try “What do I have today?”, “What is next?”, or “Where is Additional Mathematics?”",
  };
}
