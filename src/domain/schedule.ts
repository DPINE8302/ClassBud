import type {
  ClassBudStateV2,
  DayBand,
  PeriodDefinition,
  PeriodId,
  Session,
  Subject,
  Weekday,
} from "./types";

export const APP_VERSION = "2.0.0" as const;
export const SCHEDULE_VERSION = "m5-im-s1-2569" as const;
export const BANGKOK_TIMEZONE = "Asia/Bangkok" as const;

export const WEEKDAY_NAMES: Record<
  Weekday,
  { short: string; long: string; thai: string }
> = {
  1: { short: "Mon", long: "Monday", thai: "วันจันทร์" },
  2: { short: "Tue", long: "Tuesday", thai: "วันอังคาร" },
  3: { short: "Wed", long: "Wednesday", thai: "วันพุธ" },
  4: { short: "Thu", long: "Thursday", thai: "วันพฤหัสบดี" },
  5: { short: "Fri", long: "Friday", thai: "วันศุกร์" },
};

function minutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function period(
  id: PeriodId,
  ordinal: number,
  start: string,
  end: string,
): PeriodDefinition {
  return {
    id,
    ordinal,
    start,
    end,
    startMinutes: minutes(start),
    endMinutes: minutes(end),
  };
}

export const PERIODS: readonly PeriodDefinition[] = [
  period("P1", 1, "08:15", "09:00"),
  period("P2", 2, "09:00", "09:45"),
  period("P3", 3, "09:50", "10:35"),
  period("P4", 4, "10:35", "11:20"),
  period("P5", 5, "12:55", "13:40"),
  period("P6", 6, "13:40", "14:25"),
  period("P7", 7, "14:30", "15:15"),
  period("P8", 8, "15:15", "16:00"),
] as const;

export const PERIOD_BY_ID: Readonly<Record<PeriodId, PeriodDefinition>> =
  Object.fromEntries(PERIODS.map((item) => [item.id, item])) as Record<
    PeriodId,
    PeriodDefinition
  >;

const CLASS_DAYS: Weekday[] = [2, 3, 4, 5];

function band(
  id: DayBand["id"],
  label: string,
  labelTh: string,
  kind: DayBand["kind"],
  start: string,
  end: string,
): DayBand {
  return {
    id,
    label,
    labelTh,
    kind,
    weekdays: [...CLASS_DAYS],
    start,
    end,
    startMinutes: minutes(start),
    endMinutes: minutes(end),
  };
}

export const DAY_BANDS: readonly DayBand[] = [
  band("assembly", "Flag ceremony & Homeroom", "เข้าแถวและโฮมรูม", "routine", "07:45", "08:15"),
  band("morning-break", "Short break", "พัก", "break", "09:45", "09:50"),
  band("lunch", "Lunch break", "พักกลางวัน", "lunch", "11:20", "12:55"),
  band("afternoon-break", "Short break", "พัก", "break", "14:25", "14:30"),
] as const;

export const CANONICAL_SUBJECTS: readonly Subject[] = [
  { id: "art-9", code: "ศ32101", nameTh: "ศิลปะ 9", nameEn: "Art 9", teachers: ["อ.ชญานิศ"], accent: "rose", source: "seed" },
  { id: "physical-science-2", code: "ว32103", nameTh: "วิทยาศาสตร์กายภาพ 2", nameEn: "Physical Science 2", teachers: ["อ.โยธิชา"], accent: "cyan", source: "seed" },
  { id: "3d-model-sculpting", code: "ว32297", nameTh: "การปั้นโมเดล 3 มิติ", nameEn: "3D Model Sculpting", teachers: ["อ.คัทลียา"], accent: "blue", source: "seed" },
  { id: "guidance", code: "กน9", nameTh: "แนะแนว", nameEn: "Guidance", teachers: ["อ.กัญญาพัชร"], accent: "slate", source: "seed" },
  { id: "game-design-development", code: "ว32274", nameTh: "การออกแบบและพัฒนาเกม", nameEn: "Game Design & Development", teachers: ["ผศ.สุคนธ์", "อ.คัทลียา"], accent: "blue", source: "seed" },
  { id: "mathematics-9", code: "ค32101", nameTh: "คณิตศาสตร์ 9", nameEn: "Mathematics 9", teachers: ["อ.มลิธชา"], accent: "amber", source: "seed" },
  { id: "english-listening-speaking-3", code: "อ32221", nameTh: "อังกฤษฟัง-พูดเพื่อสื่อสาร 3", nameEn: "English Listening & Speaking 3", teachers: ["อ.Diana", "อ.พาขวัญ"], accent: "cyan", source: "seed" },
  { id: "career-industry", code: "ง32101", nameTh: "การงานอาชีพด้านอุตสาหกรรม", nameEn: "Career Education: Industry", teachers: ["อ.วัชชมา"], accent: "slate", source: "seed" },
  { id: "thai-9", code: "ท32101", nameTh: "ภาษาไทย 9", nameEn: "Thai 9", teachers: ["อ.ดร.สุวิมล"], accent: "rose", source: "seed" },
  { id: "computer-programming-1", code: "ว30254", nameTh: "การเขียนโปรแกรมคอมพิวเตอร์ 1", nameEn: "Computer Programming 1", teachers: ["อ.ธนภูมิ"], accent: "cyan", source: "seed" },
  { id: "additional-mathematics-3", code: "ค32214", nameTh: "คณิตศาสตร์เพิ่มเติม 3", nameEn: "Additional Mathematics 3", teachers: ["อ.มลิธชา"], accent: "amber", source: "seed" },
  { id: "english-9", code: "อ32101", nameTh: "ภาษาอังกฤษ 9", nameEn: "English 9", teachers: ["อ.ดลพร"], accent: "blue", source: "seed" },
  { id: "social-studies-9", code: "ส32101", nameTh: "สังคมศึกษา ศาสนาและวัฒนธรรม 9", nameEn: "Social Studies, Religion and Culture 9", teachers: ["อ.กิ่งกาญจน์"], accent: "rose", source: "seed" },
  { id: "physical-education-9", code: "พ32103", nameTh: "พลศึกษา 9", nameEn: "Physical Education 9", teachers: ["อ.คัทลียา"], accent: "slate", source: "seed" },
  { id: "health-education-9", code: "พ32101", nameTh: "สุขศึกษา 9", nameEn: "Health Education 9", teachers: ["อ.คัทลียา"], accent: "slate", source: "seed" },
] as const;

function session(
  id: string,
  subjectId: string,
  weekday: Weekday,
  periodIds: PeriodId[],
  mode: Session["mode"],
  room?: string,
): Session {
  return { id, subjectId, weekday, periodIds, mode, ...(room ? { room } : {}), source: "seed" };
}

export const CANONICAL_SESSIONS: readonly Session[] = [
  session("tue-art-9", "art-9", 2, ["P1", "P2"], "flipped"),
  session("tue-physical-science-2", "physical-science-2", 2, ["P3", "P4"], "classroom", "558"),
  session("tue-3d-model-sculpting", "3d-model-sculpting", 2, ["P5", "P6", "P7"], "classroom", "1903"),
  session("tue-guidance", "guidance", 2, ["P8"], "classroom", "1903"),
  session("wed-game-design-development", "game-design-development", 3, ["P1", "P2"], "classroom", "1901"),
  session("wed-mathematics-9", "mathematics-9", 3, ["P3", "P4"], "classroom", "1810"),
  session("wed-english-listening-speaking-3", "english-listening-speaking-3", 3, ["P5", "P6"], "classroom", "525"),
  session("wed-career-industry", "career-industry", 3, ["P7", "P8"], "flipped"),
  session("thu-thai-9", "thai-9", 4, ["P1", "P2"], "classroom", "1209"),
  session("thu-game-design-development", "game-design-development", 4, ["P3", "P4"], "classroom", "1901"),
  session("thu-computer-programming-1", "computer-programming-1", 4, ["P5", "P6"], "classroom", "1901"),
  session("thu-additional-mathematics-3", "additional-mathematics-3", 4, ["P7", "P8"], "classroom", "1712"),
  session("fri-additional-mathematics-3", "additional-mathematics-3", 5, ["P1", "P2"], "classroom", "555"),
  session("fri-english-9", "english-9", 5, ["P3", "P4"], "classroom", "555"),
  session("fri-social-studies-9", "social-studies-9", 5, ["P5", "P6"], "classroom", "555"),
  session("fri-physical-education-9", "physical-education-9", 5, ["P7"], "self-study"),
  session("fri-health-education-9", "health-education-9", 5, ["P8"], "self-study"),
] as const;

function cloneSubjects(subjects: readonly Subject[]): Subject[] {
  return subjects.map((subject) => ({ ...subject, teachers: [...subject.teachers] }));
}

function cloneSessions(sessions: readonly Session[]): Session[] {
  return sessions.map((item) => ({ ...item, periodIds: [...item.periodIds] }));
}

export function createInitialState(
  settings: Partial<ClassBudStateV2["settings"]> = {},
): ClassBudStateV2 {
  return {
    schemaVersion: 2,
    scheduleVersion: SCHEDULE_VERSION,
    timezone: BANGKOK_TIMEZONE,
    revision: 0,
    subjects: cloneSubjects(CANONICAL_SUBJECTS),
    sessions: cloneSessions(CANONICAL_SESSIONS),
    tasks: [],
    subjectNotes: {},
    settings: {
      theme: settings.theme ?? "system",
      notificationsEnabled: settings.notificationsEnabled ?? false,
      assistantName: settings.assistantName ?? "Buddy",
      lastRoute: { ...settings.lastRoute },
    },
  };
}

export function restoreOfficialTimetable(state: ClassBudStateV2): ClassBudStateV2 {
  const seedSubjectIds = new Set(CANONICAL_SUBJECTS.map(({ id }) => id));
  const seedSessionIds = new Set(CANONICAL_SESSIONS.map(({ id }) => id));
  const customSessions = state.sessions.filter(({ id, source }) => source === "custom" && !seedSessionIds.has(id));
  const officialSlots = new Set(
    CANONICAL_SESSIONS.flatMap((item) => item.periodIds.map((periodId) => `${item.weekday}:${periodId}`)),
  );
  const conflicts = customSessions.filter((item) =>
    item.periodIds.some((periodId) => officialSlots.has(`${item.weekday}:${periodId}`)),
  );
  if (conflicts.length) {
    throw new Error(
      `Move or delete ${conflicts.length} custom class${conflicts.length === 1 ? "" : "es"} that use official timetable periods before restoring.`,
    );
  }
  return {
    ...state,
    revision: state.revision + 1,
    subjects: [
      ...cloneSubjects(CANONICAL_SUBJECTS),
      ...state.subjects.filter(({ id, source }) => source === "custom" && !seedSubjectIds.has(id)),
    ],
    sessions: [
      ...cloneSessions(CANONICAL_SESSIONS),
      ...customSessions,
    ],
  };
}
