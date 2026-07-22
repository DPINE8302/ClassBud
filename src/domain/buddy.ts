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
  getWeekdayForDateKey,
} from "./time";
import { normalizeSearchText } from "./search";
import type {
  CalendarWeekday,
  ClassBudStateV2,
  Session,
  Subject,
  Task,
  Weekday,
} from "./types";

export type BuddyLanguage = "th" | "en";
export type BuddyIntent =
  | "current"
  | "next"
  | "day-schedule"
  | "week-schedule"
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

interface ScheduleWindow {
  id: "morning" | "afternoon" | "evening";
  startMinutes: number;
  endMinutes: number;
  english: string;
  thai: string;
  queries: string[];
}

const SCHEDULE_WINDOWS: readonly ScheduleWindow[] = [
  {
    id: "morning",
    startMinutes: 0,
    endMinutes: 12 * 60,
    english: "morning",
    thai: "ช่วงเช้า",
    queries: ["morning", "this morning", "ตอนเช้า", "ช่วงเช้า"],
  },
  {
    id: "afternoon",
    startMinutes: 12 * 60,
    endMinutes: 17 * 60,
    english: "afternoon",
    thai: "ช่วงบ่าย",
    queries: ["afternoon", "this afternoon", "ตอนบ่าย", "ช่วงบ่าย"],
  },
  {
    id: "evening",
    startMinutes: 17 * 60,
    endMinutes: 24 * 60,
    english: "evening",
    thai: "ช่วงเย็น",
    queries: ["evening", "this evening", "ตอนเย็น", "ช่วงเย็น"],
  },
];

const SCHOOL_WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5];

function containsAny(query: string, values: string[]): boolean {
  return values.some((value) => query.includes(normalizeSearchText(value)));
}

function getScheduleWindow(query: string): ScheduleWindow | undefined {
  return SCHEDULE_WINDOWS.find((window) => containsAny(query, window.queries));
}

function sessionMatchesWindow(
  session: Session,
  scheduleWindow?: ScheduleWindow,
): boolean {
  if (!scheduleWindow) return true;
  const bounds = getSessionBounds(session);
  return bounds.startMinutes < scheduleWindow.endMinutes &&
    bounds.endMinutes > scheduleWindow.startMinutes;
}

function isWeeklyScheduleQuery(query: string): boolean {
  if (containsAny(query, [
    "weekly schedule",
    "weekly timetable",
    "full schedule",
    "full timetable",
    "ตารางสัปดาห์",
    "ตารางทั้งสัปดาห์",
  ])) return true;
  return containsAny(query, ["all week", "this week", "ทั้งสัปดาห์", "ทั้งอาทิตย์"]) &&
    containsAny(query, ["schedule", "timetable", "classes", "class", "ตาราง", "เรียน"]);
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
  if (containsAny(query, ["yesterday", "เมื่อวาน", "เมื่อวานนี้"])) {
    return addDaysToBangkokDateKey(today, -1);
  }
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
  scheduleWindow?: ScheduleWindow,
): BuddyResponse {
  const weekday = getWeekdayForDateKey(dateKey);
  const sessions = getSessionsForWeekday(state, weekday)
    .filter((session) => sessionMatchesWindow(session, scheduleWindow));
  const date = bangkokDateAt(dateKey, "12:00");
  const dateLabel = formatBangkokDate(date, language === "th" ? "th-TH" : "en-GB");
  if (!sessions.length) {
    return {
      language,
      intent: "day-schedule",
      text:
        scheduleWindow
          ? language === "th"
            ? `${dateLabel} ไม่มีเรียน${scheduleWindow.thai}`
            : `${dateLabel} has no ${scheduleWindow.english} classes.`
          : language === "th"
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
    text: `${dateLabel}${scheduleWindow ? ` · ${language === "th" ? scheduleWindow.thai : scheduleWindow.english}` : ""}\n${lines.map((line) => `• ${line}`).join("\n")}`,
  };
}

function weeklyScheduleResponse(
  state: ClassBudStateV2,
  language: BuddyLanguage,
): BuddyResponse {
  const subjectById = new Map(state.subjects.map((subject) => [subject.id, subject]));
  const sections = SCHOOL_WEEKDAYS.map((weekday) => {
    const day = WEEKDAY_NAMES[weekday];
    const sessions = getSessionsForWeekday(state, weekday);
    const lines = sessions.flatMap((session) => {
      const subject = subjectById.get(session.subjectId);
      return subject ? [`• ${describeSession(session, subject, language)}`] : [];
    });
    return `${language === "th" ? day.thai : day.long}\n${lines.length ? lines.join("\n") : language === "th" ? "• ไม่มีเรียน" : "• No classes"}`;
  });
  return {
    language,
    intent: "week-schedule",
    text: `${language === "th" ? "ตารางเรียนประจำสัปดาห์" : "Weekly timetable"}\n\n${sections.join("\n\n")}`,
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return (leftDue - rightDue) ||
      compareText(left.createdAt, right.createdAt) ||
      compareText(left.title, right.title) ||
      compareText(left.id, right.id);
  });
}

function taskResponse(
  query: string,
  state: ClassBudStateV2,
  now: Date,
  language: BuddyLanguage,
): BuddyResponse {
  const isAllQuery = containsAny(query, [
    "all tasks",
    "all task",
    "all homework",
    "every task",
    "งานทั้งหมด",
    "การบ้านทั้งหมด",
    "งานทุกชิ้น",
  ]);
  const isOpenQuery = containsAny(query, [
    "open task",
    "open homework",
    "unfinished",
    "pending",
    "incomplete",
    "not done",
    "งานค้าง",
    "การบ้านค้าง",
    "ยังไม่เสร็จ",
    "ยังไม่ได้ทำ",
  ]);
  const scope: "all" | "open" | "due" = isAllQuery ? "all" : isOpenQuery ? "open" : "due";
  const subjects = findSubjects(query, state);
  if (subjects.length > 1) return ambiguousResponse(subjects, language);
  const targetSubject = subjects[0];
  const requestedDateKey = getRequestedDateKey(query, now);
  const today = bangkokDateKey(now);
  const targetDateKey = requestedDateKey ?? today;
  const tasks = sortTasks(state.tasks.filter((task) => {
    if (targetSubject && task.subjectId !== targetSubject.id) return false;
    const matchesDate = task.dueAt
      ? bangkokDateKey(new Date(task.dueAt)) === targetDateKey
      : false;
    if (scope === "all") return requestedDateKey ? matchesDate : true;
    if (scope === "open") return !task.completed && (requestedDateKey ? matchesDate : true);
    return !task.completed && matchesDate;
  }));

  const subjectLabel = targetSubject ? subjectName(targetSubject, language) : undefined;
  const dateLabel = requestedDateKey
    ? formatBangkokDate(
        bangkokDateAt(requestedDateKey, "12:00"),
        language === "th" ? "th-TH" : "en-GB",
      )
    : undefined;

  if (!tasks.length) {
    if (!subjectLabel && !dateLabel && scope === "all") {
      return {
        language,
        intent: "tasks",
        text: language === "th" ? "ไม่พบงาน" : "No tasks found.",
      };
    }
    if (!subjectLabel && !dateLabel && scope === "open") {
      return {
        language,
        intent: "tasks",
        text: language === "th" ? "ไม่มีงานค้าง" : "You have no open tasks.",
      };
    }
    if (!subjectLabel && (!requestedDateKey || requestedDateKey === today) && scope === "due") {
      return {
        language,
        intent: "tasks",
        text: language === "th" ? "วันนี้ไม่มีงานที่ต้องส่ง" : "Nothing is due today.",
      };
    }
    const qualifiers = [subjectLabel, dateLabel].filter((value): value is string => Boolean(value));
    const scopeLabel = language === "th"
      ? scope === "all" ? "งาน" : scope === "open" ? "งานที่ยังไม่เสร็จ" : "งานที่ต้องส่ง"
      : scope === "all" ? "tasks" : scope === "open" ? "open tasks" : "tasks due";
    return {
      language,
      intent: "tasks",
      text: language === "th"
        ? `ไม่พบ${scopeLabel}${qualifiers.length ? `สำหรับ ${qualifiers.join(" · ")}` : ""}`
        : `No ${scopeLabel} found${qualifiers.length ? ` for ${qualifiers.join(" · ")}` : ""}.`,
    };
  }

  const subjectById = new Map(state.subjects.map((subject) => [subject.id, subject]));
  const includeDueDate = scope !== "due" && !requestedDateKey;
  const lines = tasks.map((task) => {
    const subject = subjectById.get(task.subjectId);
    const status = language === "th"
      ? task.completed ? "เสร็จแล้ว" : "ยังไม่เสร็จ"
      : task.completed ? "Done" : "Open";
    const details = [scope === "all" ? `[${status}] ${task.title}` : task.title];
    if (subject) details.push(subjectName(subject, language));
    if (includeDueDate) {
      details.push(task.dueAt
        ? `${language === "th" ? "ส่ง" : "Due"} ${formatBangkokDate(new Date(task.dueAt), language === "th" ? "th-TH" : "en-GB")}`
        : language === "th" ? "ไม่มีกำหนดส่ง" : "No due date");
    }
    return details.join(" · ");
  });
  let heading: string;
  if (scope === "all") {
    heading = language === "th" ? "งานทั้งหมด" : "All tasks";
  } else if (scope === "open") {
    heading = language === "th" ? "งานที่ยังไม่เสร็จ" : "Open tasks";
  } else if (!requestedDateKey || requestedDateKey === today) {
    heading = language === "th" ? "งานที่ต้องส่งวันนี้" : "Due today";
  } else {
    heading = language === "th" ? `งานที่ต้องส่ง ${dateLabel}` : `Due ${dateLabel}`;
  }
  const headingQualifiers = [
    subjectLabel,
    scope === "due" ? undefined : dateLabel,
  ].filter((value): value is string => Boolean(value));
  return {
    language,
    intent: "tasks",
    text: `${heading}${headingQualifiers.length ? ` · ${headingQualifiers.join(" · ")}` : ""}\n${lines.map((line) => `• ${line}`).join("\n")}`,
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

type SubjectIntent = "subject-schedule" | "room" | "teacher" | "mode";

function subjectResponse(
  subject: Subject,
  intent: SubjectIntent,
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

function scopedSubjectResponse(
  subject: Subject,
  intent: Exclude<SubjectIntent, "teacher">,
  state: ClassBudStateV2,
  dateKey: string,
  language: BuddyLanguage,
  scheduleWindow?: ScheduleWindow,
): BuddyResponse {
  const weekday = getWeekdayForDateKey(dateKey);
  const sessions = getSessionsForWeekday(state, weekday)
    .filter((session) => session.subjectId === subject.id)
    .filter((session) => sessionMatchesWindow(session, scheduleWindow));
  const dateLabel = formatBangkokDate(
    bangkokDateAt(dateKey, "12:00"),
    language === "th" ? "th-TH" : "en-GB",
  );
  const scopeLabel = `${dateLabel}${scheduleWindow ? ` · ${language === "th" ? scheduleWindow.thai : scheduleWindow.english}` : ""}`;

  if (!sessions.length) {
    return {
      language,
      intent,
      text: language === "th"
        ? `${scopeLabel} ไม่มีเรียน${subject.nameTh}`
        : `${subject.nameEn} is not scheduled${scheduleWindow ? ` in the ${scheduleWindow.english}` : ""} on ${dateLabel}.`,
    };
  }
  if (intent === "room") {
    const rooms = [...new Set(sessions.map((session) => roomLabel(session, language)))];
    return {
      language,
      intent,
      text: `${scopeLabel}\n${subjectName(subject, language)}: ${rooms.join(", ")}`,
    };
  }
  if (intent === "mode") {
    const modes = [...new Set(sessions.map((session) => modeLabel(session, language)))];
    return {
      language,
      intent,
      text: `${scopeLabel}\n${subjectName(subject, language)}: ${modes.join(", ")}`,
    };
  }
  return {
    language,
    intent,
    text: `${scopeLabel}\n${sessions.map((session) => `• ${describeSession(session, subject, language)}`).join("\n")}`,
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
    return taskResponse(query, state, now, language);
  }

  if (isWeeklyScheduleQuery(query)) {
    return weeklyScheduleResponse(state, language);
  }

  const subjects = findSubjects(query, state);
  const requestedDate = getRequestedDateKey(query, now);
  const scheduleWindow = getScheduleWindow(query);
  const requestedIntent: SubjectIntent =
    containsAny(query, ["room", "where", "ห้อง", "ที่ไหน"])
      ? "room"
      : containsAny(query, ["teacher", "who teaches", "ครู", "อาจารย์", "ใครสอน"])
        ? "teacher"
        : containsAny(query, ["mode", "online", "flipped", "self-study", "รูปแบบ", "ออนไลน์", "เรียนเอง"])
          ? "mode"
          : "subject-schedule";
  if (subjects.length > 1) return ambiguousResponse(subjects, language);
  if (subjects[0]) {
    if (requestedIntent === "teacher" || (!requestedDate && !scheduleWindow)) {
      return subjectResponse(subjects[0], requestedIntent, state, language);
    }
    return scopedSubjectResponse(
      subjects[0],
      requestedIntent,
      state,
      requestedDate ?? bangkokDateKey(now),
      language,
      scheduleWindow,
    );
  }

  if (requestedDate || scheduleWindow || containsAny(query, ["schedule", "timetable", "classes", "class", "ตาราง", "เรียน"])) {
    return dayScheduleResponse(
      state,
      requestedDate ?? bangkokDateKey(now),
      language,
      scheduleWindow,
    );
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
