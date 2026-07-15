import { BANGKOK_TIMEZONE, DAY_BANDS, PERIOD_BY_ID } from "./schedule";
import type {
  CalendarWeekday,
  ClassBudStateV2,
  DayBand,
  Session,
  Subject,
  Task,
  Weekday,
} from "./types";

export interface BangkokDateParts {
  year: number;
  month: number;
  day: number;
  weekday: CalendarWeekday;
  hour: number;
  minute: number;
  second: number;
}

export interface SessionBounds {
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
}

export interface SessionOccurrence extends SessionBounds {
  dateKey: string;
  startAt: Date;
  endAt: Date;
  session: Session;
  subject: Subject;
}

export interface CurrentScheduleContext {
  dateKey: string;
  weekday: CalendarWeekday;
  minuteOfDay: number;
  currentSession?: SessionOccurrence;
  currentBand?: DayBand;
  nextSession?: SessionOccurrence;
  minutesRemaining?: number;
}

const datePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BANGKOK_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function numericPart(parts: Intl.DateTimeFormatPart[], type: string): number {
  return Number(parts.find((part) => part.type === type)?.value ?? 0);
}

export function getBangkokParts(date: Date = new Date()): BangkokDateParts {
  const parts = datePartsFormatter.formatToParts(date);
  const year = numericPart(parts, "year");
  const month = numericPart(parts, "month");
  const day = numericPart(parts, "day");
  const isoWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    year,
    month,
    day,
    weekday: (isoWeekday === 0 ? 7 : isoWeekday) as CalendarWeekday,
    hour: numericPart(parts, "hour"),
    minute: numericPart(parts, "minute"),
    second: numericPart(parts, "second"),
  };
}

export function bangkokDateKey(date: Date = new Date()): string {
  const { year, month, day } = getBangkokParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function bangkokDateAt(dateKey: string, time = "00:00"): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !timeMatch) {
    throw new Error("Invalid Bangkok date or time");
  }
  const [, year = "0", month = "1", day = "1"] = match;
  const [, hour = "0", minute = "0"] = timeMatch;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 7,
      Number(minute),
    ),
  );
}

export function addDaysToBangkokDateKey(dateKey: string, days: number): string {
  const base = bangkokDateAt(dateKey);
  base.setUTCDate(base.getUTCDate() + days);
  return bangkokDateKey(base);
}

export function getWeekdayForDateKey(dateKey: string): CalendarWeekday {
  return getBangkokParts(bangkokDateAt(dateKey, "12:00")).weekday;
}

export function getSessionBounds(session: Session): SessionBounds {
  const periods = session.periodIds
    .map((id) => PERIOD_BY_ID[id])
    .sort((left, right) => left.ordinal - right.ordinal);
  const first = periods[0];
  const last = periods.at(-1);
  if (!first || !last) {
    throw new Error(`Session ${session.id} has no periods`);
  }
  return {
    start: first.start,
    end: last.end,
    startMinutes: first.startMinutes,
    endMinutes: last.endMinutes,
  };
}

export function getSessionsForWeekday(
  state: Pick<ClassBudStateV2, "sessions">,
  weekday: CalendarWeekday,
): Session[] {
  if (weekday > 5) return [];
  return state.sessions
    .filter((session) => session.weekday === weekday)
    .sort(
      (left, right) =>
        getSessionBounds(left).startMinutes - getSessionBounds(right).startMinutes,
    );
}

export function getSessionsForDate(
  state: Pick<ClassBudStateV2, "sessions">,
  date: Date,
): Session[] {
  return getSessionsForWeekday(state, getBangkokParts(date).weekday);
}

export function getSessionOccurrence(
  state: Pick<ClassBudStateV2, "subjects">,
  session: Session,
  dateKey: string,
): SessionOccurrence | undefined {
  const subject = state.subjects.find(({ id }) => id === session.subjectId);
  if (!subject) return undefined;
  const bounds = getSessionBounds(session);
  return {
    ...bounds,
    dateKey,
    startAt: bangkokDateAt(dateKey, bounds.start),
    endAt: bangkokDateAt(dateKey, bounds.end),
    session,
    subject,
  };
}

function getNextSession(
  state: Pick<ClassBudStateV2, "subjects" | "sessions">,
  dateKey: string,
  now: Date,
): SessionOccurrence | undefined {
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateKey = addDaysToBangkokDateKey(dateKey, offset);
    const weekday = getWeekdayForDateKey(candidateKey);
    for (const session of getSessionsForWeekday(state, weekday)) {
      const occurrence = getSessionOccurrence(state, session, candidateKey);
      if (occurrence && occurrence.startAt.getTime() > now.getTime()) return occurrence;
    }
  }
  return undefined;
}

export function getCurrentScheduleContext(
  state: Pick<ClassBudStateV2, "subjects" | "sessions">,
  now: Date = new Date(),
): CurrentScheduleContext {
  const parts = getBangkokParts(now);
  const dateKey = bangkokDateKey(now);
  const minuteOfDay = parts.hour * 60 + parts.minute + parts.second / 60;
  const currentBand = DAY_BANDS.find(
    (item) =>
      item.weekdays.includes(parts.weekday as Weekday) &&
      minuteOfDay >= item.startMinutes &&
      minuteOfDay < item.endMinutes,
  );
  const activeSession = getSessionsForWeekday(state, parts.weekday)
    .map((session) => getSessionOccurrence(state, session, dateKey))
    .find(
      (occurrence): occurrence is SessionOccurrence =>
        Boolean(
          occurrence &&
            minuteOfDay >= occurrence.startMinutes &&
            minuteOfDay < occurrence.endMinutes,
        ),
    );
  const currentSession = currentBand ? undefined : activeSession;
  const activeEnd = currentBand?.endMinutes ?? currentSession?.endMinutes;
  const resumedSession = currentBand && activeSession && activeSession.endMinutes > currentBand.endMinutes
    ? activeSession
    : undefined;
  const nextSession = resumedSession ?? getNextSession(state, dateKey, now);
  return {
    dateKey,
    weekday: parts.weekday,
    minuteOfDay,
    ...(currentSession ? { currentSession } : {}),
    ...(currentBand ? { currentBand } : {}),
    ...(nextSession ? { nextSession } : {}),
    ...(activeEnd === undefined
      ? {}
      : { minutesRemaining: Math.max(0, Math.ceil(activeEnd - minuteOfDay)) }),
  };
}

export function getTasksDueToday(
  state: Pick<ClassBudStateV2, "tasks">,
  now: Date = new Date(),
): Task[] {
  const today = bangkokDateKey(now);
  return state.tasks
    .filter((task) => task.dueAt && bangkokDateKey(new Date(task.dueAt)) === today)
    .sort((left, right) =>
      String(left.dueAt).localeCompare(String(right.dueAt)),
    );
}

export function formatBangkokTime(date: Date, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: BANGKOK_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatBangkokDate(
  date: Date,
  locale = "en-GB",
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: BANGKOK_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...options,
  }).format(date);
}
