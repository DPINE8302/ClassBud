import { parseClassBudState } from "../domain/schema";
import { restoreOfficialTimetable } from "../domain/schedule";
import type {
  Accent,
  AppAccent,
  ClassBudStateV2,
  Session,
  Subject,
  SubjectNote,
  Task,
  ThemePreference,
} from "../domain/types";

export interface SubjectDeletionSnapshot {
  subject: Subject;
  sessions: Session[];
  tasks: Task[];
  note?: SubjectNote;
}

type SubjectChanges = Partial<
  Pick<Subject, "code" | "nameTh" | "nameEn" | "teachers" | "accent">
>;
type SessionChanges = Partial<
  Pick<Session, "subjectId" | "weekday" | "periodIds" | "room" | "mode">
>;
type TaskChanges = Partial<
  Pick<Task, "subjectId" | "sessionId" | "title" | "dueAt" | "notes" | "completed">
>;

export type ClassBudAction =
  | { type: "replace-state"; state: ClassBudStateV2 }
  | { type: "add-task"; task: Task }
  | { type: "update-task"; id: string; changes: TaskChanges; updatedAt: string }
  | { type: "delete-task"; id: string }
  | { type: "set-subject-note"; subjectId: string; body: string; updatedAt: string }
  | { type: "set-theme"; theme: ThemePreference }
  | { type: "set-app-accent"; accent: AppAccent }
  | { type: "set-notifications"; enabled: boolean }
  | { type: "set-assistant-name"; name: string }
  | { type: "set-last-route"; layout: "compact" | "wide"; route: string }
  | { type: "add-subject"; subject: Subject }
  | { type: "update-subject"; id: string; changes: SubjectChanges }
  | { type: "delete-subject"; id: string }
  | { type: "restore-deleted-subject"; snapshot: SubjectDeletionSnapshot }
  | { type: "add-session"; session: Session }
  | { type: "update-session"; id: string; changes: SessionChanges }
  | { type: "delete-session"; id: string }
  | { type: "restore-seed" };

export class ClassBudReducerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClassBudReducerError";
  }
}

function commit(state: ClassBudStateV2, patch: Partial<ClassBudStateV2>): ClassBudStateV2 {
  return parseClassBudState({ ...state, ...patch, revision: state.revision + 1 });
}

function requireSubject(state: ClassBudStateV2, id: string): Subject {
  const subject = state.subjects.find((item) => item.id === id);
  if (!subject) throw new ClassBudReducerError(`Unknown subject: ${id}`);
  return subject;
}

function requireSession(state: ClassBudStateV2, id: string): Session {
  const session = state.sessions.find((item) => item.id === id);
  if (!session) throw new ClassBudReducerError(`Unknown session: ${id}`);
  return session;
}

function requireTask(state: ClassBudStateV2, id: string): Task {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) throw new ClassBudReducerError(`Unknown task: ${id}`);
  return task;
}

export function createSubjectDeletionSnapshot(
  state: ClassBudStateV2,
  id: string,
): SubjectDeletionSnapshot {
  const subject = requireSubject(state, id);
  if (subject.source !== "custom") {
    throw new ClassBudReducerError("Seed subjects cannot be deleted");
  }
  const sessionIds = new Set(
    state.sessions.filter(({ subjectId }) => subjectId === id).map(({ id: sessionId }) => sessionId),
  );
  return {
    subject: { ...subject, teachers: [...subject.teachers] },
    sessions: state.sessions
      .filter(({ subjectId }) => subjectId === id)
      .map((session) => ({ ...session, periodIds: [...session.periodIds] })),
    tasks: state.tasks
      .filter((task) => task.subjectId === id || (task.sessionId ? sessionIds.has(task.sessionId) : false))
      .map((task) => ({ ...task })),
    ...(state.subjectNotes[id] ? { note: { ...state.subjectNotes[id] } } : {}),
  };
}

function deleteSubject(state: ClassBudStateV2, id: string): ClassBudStateV2 {
  const snapshot = createSubjectDeletionSnapshot(state, id);
  const deletedSessionIds = new Set(snapshot.sessions.map(({ id: sessionId }) => sessionId));
  const notes = { ...state.subjectNotes };
  delete notes[id];
  return commit(state, {
    subjects: state.subjects.filter((subject) => subject.id !== id),
    sessions: state.sessions.filter((session) => session.subjectId !== id),
    tasks: state.tasks.filter(
      (task) => task.subjectId !== id && !(task.sessionId && deletedSessionIds.has(task.sessionId)),
    ),
    subjectNotes: notes,
  });
}

function restoreDeletedSubject(
  state: ClassBudStateV2,
  snapshot: SubjectDeletionSnapshot,
): ClassBudStateV2 {
  if (state.subjects.some(({ id }) => id === snapshot.subject.id)) {
    throw new ClassBudReducerError(`Subject already exists: ${snapshot.subject.id}`);
  }
  const sessionIds = new Set(state.sessions.map(({ id }) => id));
  const taskIds = new Set(state.tasks.map(({ id }) => id));
  if (snapshot.sessions.some(({ id }) => sessionIds.has(id))) {
    throw new ClassBudReducerError("Cannot undo: a session ID is already in use");
  }
  if (snapshot.tasks.some(({ id }) => taskIds.has(id))) {
    throw new ClassBudReducerError("Cannot undo: a task ID is already in use");
  }
  return commit(state, {
    subjects: [...state.subjects, snapshot.subject],
    sessions: [...state.sessions, ...snapshot.sessions],
    tasks: [...state.tasks, ...snapshot.tasks],
    subjectNotes: snapshot.note
      ? { ...state.subjectNotes, [snapshot.subject.id]: snapshot.note }
      : state.subjectNotes,
  });
}

export function classBudReducer(
  state: ClassBudStateV2,
  action: ClassBudAction,
): ClassBudStateV2 {
  switch (action.type) {
    case "replace-state":
      // Imported state already receives a new revision in storage.ts. Cross-tab
      // hydration must preserve the incoming revision or tabs can ping-pong writes.
      return parseClassBudState(action.state);
    case "add-task":
      return commit(state, { tasks: [...state.tasks, action.task] });
    case "update-task": {
      requireTask(state, action.id);
      return commit(state, {
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, ...action.changes, updatedAt: action.updatedAt } : task,
        ),
      });
    }
    case "delete-task":
      requireTask(state, action.id);
      return commit(state, { tasks: state.tasks.filter(({ id }) => id !== action.id) });
    case "set-subject-note": {
      requireSubject(state, action.subjectId);
      const notes = { ...state.subjectNotes };
      if (action.body.length) notes[action.subjectId] = { body: action.body, updatedAt: action.updatedAt };
      else delete notes[action.subjectId];
      return commit(state, { subjectNotes: notes });
    }
    case "set-theme":
      return commit(state, { settings: { ...state.settings, theme: action.theme } });
    case "set-app-accent":
      return commit(state, { settings: { ...state.settings, appAccent: action.accent } });
    case "set-notifications":
      return commit(state, {
        settings: { ...state.settings, notificationsEnabled: action.enabled },
      });
    case "set-assistant-name":
      return commit(state, {
        settings: { ...state.settings, assistantName: action.name.slice(0, 40) },
      });
    case "set-last-route":
      return commit(state, {
        settings: {
          ...state.settings,
          lastRoute: { ...state.settings.lastRoute, [action.layout]: action.route },
        },
      });
    case "add-subject":
      return commit(state, { subjects: [...state.subjects, action.subject] });
    case "update-subject": {
      requireSubject(state, action.id);
      return commit(state, {
        subjects: state.subjects.map((subject) =>
          subject.id === action.id ? { ...subject, ...action.changes } : subject,
        ),
      });
    }
    case "delete-subject":
      return deleteSubject(state, action.id);
    case "restore-deleted-subject":
      return restoreDeletedSubject(state, action.snapshot);
    case "add-session":
      return commit(state, { sessions: [...state.sessions, action.session] });
    case "update-session": {
      requireSession(state, action.id);
      return commit(state, {
        sessions: state.sessions.map((session) =>
          session.id === action.id ? { ...session, ...action.changes } : session,
        ),
      });
    }
    case "delete-session": {
      requireSession(state, action.id);
      return commit(state, {
        sessions: state.sessions.filter(({ id }) => id !== action.id),
        tasks: state.tasks.map((task) => {
          if (task.sessionId !== action.id) return task;
          const remaining = { ...task };
          delete remaining.sessionId;
          return remaining;
        }),
      });
    }
    case "restore-seed":
      return parseClassBudState(restoreOfficialTimetable(state));
  }
}

export function createEntityId(prefix: "subject" | "session" | "task"): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export const SUBJECT_ACCENTS: readonly Accent[] = ["blue", "cyan", "amber", "rose", "slate"];
