import { getSessionBounds } from "./time";
import type { ClassBudStateV2, Session, Subject, Task } from "./types";

export type SearchResult =
  | {
      type: "subject";
      id: string;
      score: number;
      title: string;
      subtitle: string;
      subject: Subject;
    }
  | {
      type: "session";
      id: string;
      score: number;
      title: string;
      subtitle: string;
      subject: Subject;
      session: Session;
    }
  | {
      type: "task";
      id: string;
      score: number;
      title: string;
      subtitle: string;
      subject: Subject;
      task: Task;
    };

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function rankFields(query: string, fields: string[]): number | undefined {
  let best: number | undefined;
  for (const field of fields) {
    const normalized = normalizeSearchText(field);
    const tokens = normalized.split(/\s+/u);
    let score: number | undefined;
    if (normalized === query) score = 0;
    else if (normalized.startsWith(query)) score = 1;
    else if (tokens.some((token) => token.startsWith(query))) score = 2;
    else if (normalized.includes(query)) score = 3;
    if (score !== undefined && (best === undefined || score < best)) best = score;
  }
  return best;
}

export function searchClassBud(
  state: Pick<ClassBudStateV2, "subjects" | "sessions" | "tasks">,
  input: string,
  limit = 20,
): SearchResult[] {
  const query = normalizeSearchText(input);
  if (!query || limit <= 0) return [];
  const subjectById = new Map(state.subjects.map((subject) => [subject.id, subject]));
  const results: SearchResult[] = [];

  for (const subject of state.subjects) {
    const score = rankFields(query, [
      subject.nameTh,
      subject.nameEn,
      subject.code,
      ...subject.teachers,
    ]);
    if (score !== undefined) {
      results.push({
        type: "subject",
        id: subject.id,
        score,
        title: subject.nameTh,
        subtitle: `${subject.nameEn} · ${subject.code}`,
        subject,
      });
    }
  }

  for (const session of state.sessions) {
    const subject = subjectById.get(session.subjectId);
    if (!subject) continue;
    const score = rankFields(query, [
      subject.nameTh,
      subject.nameEn,
      subject.code,
      ...subject.teachers,
      session.room ?? "",
      session.mode,
    ]);
    if (score !== undefined) {
      const bounds = getSessionBounds(session);
      results.push({
        type: "session",
        id: session.id,
        score: score + 0.2,
        title: subject.nameTh,
        subtitle: `${subject.nameEn} · ${bounds.start}–${bounds.end}${session.room ? ` · Room ${session.room}` : ""}`,
        subject,
        session,
      });
    }
  }

  for (const task of state.tasks) {
    const subject = subjectById.get(task.subjectId);
    if (!subject) continue;
    const score = rankFields(query, [
      task.title,
      task.notes ?? "",
      subject.nameTh,
      subject.nameEn,
      subject.code,
    ]);
    if (score !== undefined) {
      results.push({
        type: "task",
        id: task.id,
        score: score + 0.1,
        title: task.title,
        subtitle: subject.nameTh,
        subject,
        task,
      });
    }
  }

  const typeOrder = { subject: 0, task: 1, session: 2 } as const;
  return results
    .sort(
      (left, right) =>
        left.score - right.score ||
        typeOrder[left.type] - typeOrder[right.type] ||
        left.title.localeCompare(right.title, "th"),
    )
    .slice(0, Math.min(20, limit));
}
