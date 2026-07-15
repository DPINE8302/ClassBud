import {
  getCurrentScheduleContext,
  type ClassBudStateV2,
  type PeriodId,
  type Session,
  type Subject,
  type Task,
  type Weekday,
} from "../domain";

export const WEEKDAYS: Array<{ value: Weekday; short: string; long: string }> = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
];

export const PERIOD_CLOCK: Record<PeriodId, { start: string; end: string }> = {
  P1: { start: "08:15", end: "09:00" },
  P2: { start: "09:00", end: "09:45" },
  P3: { start: "09:50", end: "10:35" },
  P4: { start: "10:35", end: "11:20" },
  P5: { start: "12:55", end: "13:40" },
  P6: { start: "13:40", end: "14:25" },
  P7: { start: "14:30", end: "15:15" },
  P8: { start: "15:15", end: "16:00" },
};

export const DATE_FORMAT_LONG = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  weekday: "long",
  day: "numeric",
  month: "long",
});

export const DATE_FORMAT_COMPACT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  weekday: "short",
  day: "numeric",
  month: "short",
});

export const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function sessionClock(session: Session) {
  const first = session.periodIds[0];
  const last = session.periodIds.at(-1);
  if (!first || !last) return { start: "—", end: "—" };
  return { start: PERIOD_CLOCK[first].start, end: PERIOD_CLOCK[last].end };
}

export function sessionLabel(session: Session, subject: Subject) {
  const clock = sessionClock(session);
  return `${subject.nameTh} · ${clock.start}–${clock.end}`;
}

export function subjectFor(state: ClassBudStateV2, subjectId: string) {
  return state.subjects.find((subject) => subject.id === subjectId);
}

export function sessionsFor(state: ClassBudStateV2, weekday: number) {
  return state.sessions
    .filter((session) => session.weekday === weekday)
    .toSorted((a, b) => {
      const aStart = sessionClock(a).start;
      const bStart = sessionClock(b).start;
      return aStart.localeCompare(bStart);
    });
}

export function jsDayToWeekday(date: Date): Weekday | undefined {
  const day = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", weekday: "short" })
      .formatToParts(date)
      .find((part) => part.type === "weekday")?.value === "Mon"
      ? 1
      : 0,
  );
  if (day) return day as Weekday;
  const token = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", weekday: "short" }).format(date);
  return ({ Tue: 2, Wed: 3, Thu: 4, Fri: 5 } as const)[token as "Tue" | "Wed" | "Thu" | "Fri"];
}

export function dateForBangkokDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T12:00:00+07:00`);
}

export function minutesNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

export function clockMinutes(clock: string) {
  const [hour = 0, minute = 0] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

export function currentAndUpcoming(state: ClassBudStateV2, date = new Date()) {
  const weekday = jsDayToWeekday(date);
  if (!weekday) return { current: undefined, upcoming: [] as Session[] };
  const minute = minutesNow(date);
  const daily = sessionsFor(state, weekday);
  const context = getCurrentScheduleContext(state, date);
  const current = context.currentSession?.session;
  const resumed = context.currentBand ? context.nextSession?.session : undefined;
  const upcoming = daily.filter((session) =>
    session.id === resumed?.id || clockMinutes(sessionClock(session).start) > minute,
  );
  return {
    current,
    upcoming,
    currentBand: context.currentBand,
    minutesRemaining: context.minutesRemaining,
  };
}

export function isTaskDueToday(task: Task, date = new Date()) {
  if (!task.dueAt) return false;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);
  const due = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(task.dueAt));
  return today === due;
}

export function formatDue(task: Task) {
  if (!task.dueAt) return "No due date";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(task.dueAt));
}

export function modeLabel(mode: Session["mode"]) {
  if (mode === "flipped") return "Flipped Classroom";
  if (mode === "self-study") return "Self-study";
  return "Classroom";
}

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export type SearchResult =
  | { kind: "subject"; id: string; title: string; detail: string }
  | { kind: "session"; id: string; title: string; detail: string }
  | { kind: "task"; id: string; title: string; detail: string };

const SPACE_PATTERN = /\s+/g;

export function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(SPACE_PATTERN, " ").trim();
}

export function searchState(state: ClassBudStateV2, query: string): SearchResult[] {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  const scored: Array<SearchResult & { score: number }> = [];
  for (const subject of state.subjects) {
    const haystack = normalizeSearch(
      [subject.nameTh, subject.nameEn, subject.code, ...subject.teachers].join(" "),
    );
    if (haystack.includes(needle)) {
      const score = [subject.nameTh, subject.nameEn, subject.code].some((value) =>
        normalizeSearch(value).startsWith(needle),
      )
        ? 0
        : 1;
      scored.push({
        kind: "subject",
        id: subject.id,
        title: subject.nameTh,
        detail: `${subject.code} · ${subject.nameEn}`,
        score,
      });
    }
  }
  for (const session of state.sessions) {
    const subject = subjectFor(state, session.subjectId);
    if (!subject) continue;
    const haystack = normalizeSearch([subject.nameTh, subject.nameEn, subject.code, session.room ?? ""].join(" "));
    if (haystack.includes(needle)) {
      scored.push({
        kind: "session",
        id: session.id,
        title: subject.nameTh,
        detail: `${WEEKDAYS.find((day) => day.value === session.weekday)?.long} · ${sessionClock(session).start}${
          session.room ? ` · Room ${session.room}` : ""
        }`,
        score: haystack.startsWith(needle) ? 0 : 2,
      });
    }
  }
  for (const task of state.tasks) {
    if (!normalizeSearch(task.title).includes(needle)) continue;
    const subject = subjectFor(state, task.subjectId);
    scored.push({
      kind: "task",
      id: task.id,
      title: task.title,
      detail: subject?.nameTh ?? "Task",
      score: normalizeSearch(task.title).startsWith(needle) ? 0 : 2,
    });
  }
  return scored.toSorted((a, b) => a.score - b.score || a.title.localeCompare(b.title)).slice(0, 20);
}

export function toBangkokLocalInput(iso?: string) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export function fromBangkokLocalInput(value: string) {
  return value ? `${value}:00+07:00` : undefined;
}
