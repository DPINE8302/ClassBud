import { z } from "zod";
import { PERIOD_BY_ID } from "./schedule";
import type { ClassBudExportV2, ClassBudStateV2 } from "./types";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

const idSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((value) => value === value.trim(), "IDs cannot have outer whitespace")
  .refine(
    (value) => !["__proto__", "prototype", "constructor"].includes(value),
    "Reserved ID",
  );
const limitedText = z.string().trim().min(1).max(200);
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const BANGKOK_RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?\+07:00$/;

function hasRealCalendarFields(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0) && hour <= 23 && minute <= 59 && second <= 59;
}

function isValidTimestamp(value: string): boolean {
  return hasRealCalendarFields(value) && !Number.isNaN(Date.parse(value));
}

const timestampSchema = z
  .string()
  .regex(RFC3339_PATTERN, "Timestamp must use RFC 3339 with a timezone")
  .refine(isValidTimestamp, "Invalid RFC 3339 timestamp");
const bangkokTimestampSchema = z
  .string()
  .regex(BANGKOK_RFC3339_PATTERN, "Due dates must be RFC 3339 timestamps with +07:00")
  .refine(isValidTimestamp, "Invalid due date");

export const SubjectSchema = z
  .object({
    id: idSchema,
    code: limitedText,
    nameTh: limitedText,
    nameEn: limitedText,
    teachers: z.array(limitedText).min(1).max(20),
    accent: z.enum(["blue", "cyan", "amber", "rose", "slate"]),
    source: z.enum(["seed", "custom"]),
  })
  .strict();

export const SessionSchema = z
  .object({
    id: idSchema,
    subjectId: idSchema,
    weekday: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    periodIds: z
      .array(z.enum(["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]))
      .min(1)
      .max(8),
    room: z.string().trim().min(1).max(50).optional(),
    mode: z.enum(["classroom", "flipped", "self-study"]),
    source: z.enum(["seed", "custom"]),
  })
  .strict()
  .superRefine((session, context) => {
    if (session.mode === "classroom" && !session.room) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["room"],
        message: "Classroom sessions require a room",
      });
    }
    const ordinals = session.periodIds.map((id) => PERIOD_BY_ID[id].ordinal);
    const unique = new Set(ordinals);
    if (unique.size !== ordinals.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodIds"],
        message: "Periods cannot be duplicated",
      });
      return;
    }
    const sorted = [...ordinals].sort((left, right) => left - right);
    if (ordinals.some((ordinal, index) => index > 0 && ordinal <= ordinals[index - 1]!)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodIds"],
        message: "Session periods must be in chronological order",
      });
      return;
    }
    if (sorted.some((ordinal, index) => index > 0 && ordinal !== sorted[index - 1]! + 1)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodIds"],
        message: "Session periods must be contiguous",
      });
    }
  });

export const TaskSchema = z
  .object({
    id: idSchema,
    subjectId: idSchema,
    sessionId: idSchema.optional(),
    title: limitedText,
    dueAt: bangkokTimestampSchema.optional(),
    notes: z.string().max(20_000).optional(),
    completed: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const SubjectNoteSchema = z
  .object({ body: z.string().max(20_000), updatedAt: timestampSchema })
  .strict();

const AppRouteSchema = z.enum(["/today", "/schedule", "/tasks", "/subjects", "/buddy", "/settings"]);

const SettingsSchema = z
  .object({
    theme: z.enum(["system", "light", "dark"]),
    // Default keeps existing ClassBud v2 state and 2.0 exports compatible.
    appAccent: z
      .enum(["blue", "green", "orange", "red", "purple", "indigo", "pink", "teal"])
      .default("blue"),
    notificationsEnabled: z.boolean(),
    assistantName: z.string().max(40).optional(),
    lastRoute: z
      .object({
        compact: AppRouteSchema.optional(),
        wide: AppRouteSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const ClassBudStateSchema = z
  .object({
    schemaVersion: z.literal(2),
    scheduleVersion: z.literal("m5-im-s1-2569"),
    timezone: z.literal("Asia/Bangkok"),
    revision: z.number().int().nonnegative().safe(),
    subjects: z.array(SubjectSchema).max(200),
    sessions: z.array(SessionSchema).max(1_000),
    tasks: z.array(TaskSchema).max(5_000),
    subjectNotes: z.record(z.string(), SubjectNoteSchema),
    settings: SettingsSchema,
  })
  .strict()
  .superRefine((state, context) => {
    const subjectIds = new Set<string>();
    for (const [index, subject] of state.subjects.entries()) {
      if (subjectIds.has(subject.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subjects", index, "id"],
          message: `Duplicate subject ID: ${subject.id}`,
        });
      }
      subjectIds.add(subject.id);
    }

    const sessionIds = new Set<string>();
    const sessionSubjects = new Map<string, string>();
    const occupied = new Map<string, string>();
    for (const [index, session] of state.sessions.entries()) {
      if (sessionIds.has(session.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sessions", index, "id"],
          message: `Duplicate session ID: ${session.id}`,
        });
      }
      sessionIds.add(session.id);
      sessionSubjects.set(session.id, session.subjectId);
      if (!subjectIds.has(session.subjectId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sessions", index, "subjectId"],
          message: `Unknown subject ID: ${session.subjectId}`,
        });
      }
      for (const periodId of session.periodIds) {
        const key = `${session.weekday}:${periodId}`;
        const existing = occupied.get(key);
        if (existing) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["sessions", index, "periodIds"],
            message: `Overlaps ${existing} on ${key}`,
          });
        } else {
          occupied.set(key, session.id);
        }
      }
    }

    const taskIds = new Set<string>();
    for (const [index, task] of state.tasks.entries()) {
      if (taskIds.has(task.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tasks", index, "id"],
          message: `Duplicate task ID: ${task.id}`,
        });
      }
      taskIds.add(task.id);
      if (!subjectIds.has(task.subjectId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tasks", index, "subjectId"],
          message: `Unknown subject ID: ${task.subjectId}`,
        });
      }
      if (task.sessionId && !sessionIds.has(task.sessionId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tasks", index, "sessionId"],
          message: `Unknown session ID: ${task.sessionId}`,
        });
      } else if (task.sessionId && sessionSubjects.get(task.sessionId) !== task.subjectId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tasks", index, "sessionId"],
          message: `Session ${task.sessionId} belongs to a different subject`,
        });
      }
    }

    const noteEntries = Object.entries(state.subjectNotes);
    if (noteEntries.length > 200) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subjectNotes"],
        message: "At most 200 subject notes are allowed",
      });
    }
    for (const [subjectId] of noteEntries) {
      if (!subjectIds.has(subjectId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subjectNotes", subjectId],
          message: `Unknown subject ID: ${subjectId}`,
        });
      }
    }
  });

export const ClassBudExportSchema = z
  .object({
    format: z.literal("classbud-export"),
    version: z.literal(2),
    appVersion: z.literal("2.0.0"),
    exportedAt: timestampSchema,
    state: ClassBudStateSchema,
  })
  .strict();

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  error: string;
  issues?: string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function issueMessages(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "root";
    return `${path}: ${issue.message}`;
  });
}

export function validateClassBudState(value: unknown): ValidationResult<ClassBudStateV2> {
  const result = ClassBudStateSchema.safeParse(value);
  if (!result.success) {
    const issues = issueMessages(result.error);
    return { success: false, error: issues[0] ?? "Invalid ClassBud state", issues };
  }
  return { success: true, data: result.data as ClassBudStateV2 };
}

export function parseClassBudState(value: unknown): ClassBudStateV2 {
  return ClassBudStateSchema.parse(value) as ClassBudStateV2;
}

export function validateImportText(text: string): ValidationResult<ClassBudExportV2> {
  const size = new TextEncoder().encode(text).byteLength;
  if (size > MAX_IMPORT_BYTES) {
    return { success: false, error: "Import exceeds the 2 MiB limit" };
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return { success: false, error: "Import is not valid JSON" };
  }
  const result = ClassBudExportSchema.safeParse(value);
  if (!result.success) {
    const issues = issueMessages(result.error);
    return { success: false, error: issues[0] ?? "Invalid ClassBud export", issues };
  }
  return { success: true, data: result.data as ClassBudExportV2 };
}

export function createExportEnvelope(
  state: ClassBudStateV2,
  now: Date = new Date(),
): ClassBudExportV2 {
  const validState = parseClassBudState(state);
  return {
    format: "classbud-export",
    version: 2,
    appVersion: "2.0.0",
    exportedAt: now.toISOString(),
    state: validState,
  };
}

export function serializeClassBudExport(
  state: ClassBudStateV2,
  now: Date = new Date(),
): string {
  return JSON.stringify(createExportEnvelope(state, now), null, 2);
}
