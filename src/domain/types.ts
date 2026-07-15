export type Weekday = 1 | 2 | 3 | 4 | 5;

export type CalendarWeekday = Weekday | 6 | 7;

export type PeriodId =
  | "P1"
  | "P2"
  | "P3"
  | "P4"
  | "P5"
  | "P6"
  | "P7"
  | "P8";

export type SessionMode = "classroom" | "flipped" | "self-study";

export type Accent = "blue" | "cyan" | "amber" | "rose" | "slate";

export type Source = "seed" | "custom";

export type ThemePreference = "system" | "light" | "dark";

export interface Subject {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  teachers: string[];
  accent: Accent;
  source: Source;
}

export interface Session {
  id: string;
  subjectId: string;
  weekday: Weekday;
  periodIds: PeriodId[];
  room?: string;
  mode: SessionMode;
  source: Source;
}

export interface Task {
  id: string;
  subjectId: string;
  sessionId?: string;
  title: string;
  dueAt?: string;
  notes?: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectNote {
  body: string;
  updatedAt: string;
}

export interface ClassBudSettings {
  theme: ThemePreference;
  notificationsEnabled: boolean;
  lastRoute: {
    compact?: string;
    wide?: string;
  };
}

export interface ClassBudStateV2 {
  schemaVersion: 2;
  scheduleVersion: "m5-im-s1-2569";
  timezone: "Asia/Bangkok";
  revision: number;
  subjects: Subject[];
  sessions: Session[];
  tasks: Task[];
  subjectNotes: Record<string, SubjectNote>;
  settings: ClassBudSettings;
}

export interface ClassBudExportV2 {
  format: "classbud-export";
  version: 2;
  appVersion: "2.0.0";
  exportedAt: string;
  state: ClassBudStateV2;
}

export interface PeriodDefinition {
  id: PeriodId;
  ordinal: number;
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
}

export type DayBandKind = "routine" | "break" | "lunch";

export interface DayBand {
  id: "assembly" | "morning-break" | "lunch" | "afternoon-break";
  label: string;
  labelTh: string;
  kind: DayBandKind;
  weekdays: Weekday[];
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
}
