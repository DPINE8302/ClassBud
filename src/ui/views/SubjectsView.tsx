import { BookOpen, Clock3, Edit3, Plus, Trash2, UserRound } from "lucide-react";
import type { ClassBudStateV2 } from "../../domain";
import { modeLabel, sessionClock, WEEKDAYS } from "../utils";

interface SubjectsViewProps {
  state: ClassBudStateV2;
  onAddSubject: () => void;
  onEditSubject: (id: string) => void;
  onDeleteSubject: (id: string) => void;
}

export function SubjectsView({ state, onAddSubject, onEditSubject, onDeleteSubject }: SubjectsViewProps) {
  return (
    <div className="page page--subjects">
      <header className="page-heading page-heading--with-action">
        <div><p>M.5 IM · Semester 1 · 2569 (2026)</p><h1>Subjects</h1></div>
        <button className="primary-button" type="button" aria-label="New subject" onClick={onAddSubject}><Plus aria-hidden="true" /><span>New subject</span></button>
      </header>
      <div className="subjects-grid">
        {state.subjects.map((subject) => {
          const sessions = state.sessions.filter((session) => session.subjectId === subject.id);
          const periods = sessions.reduce((sum, session) => sum + session.periodIds.length, 0);
          return (
            <article className="subject-card" key={subject.id} data-accent={subject.accent}>
              <header>
                <span className="subject-card__icon" aria-hidden="true"><BookOpen /></span>
                <span className="subject-card__code">{subject.code}</span>
                <div className="subject-card__actions">
                  <button className="icon-button icon-button--small" type="button" onClick={() => onEditSubject(subject.id)} aria-label={`Edit ${subject.nameEn}`}><Edit3 aria-hidden="true" /></button>
                  {subject.source === "custom" ? <button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => onDeleteSubject(subject.id)} aria-label={`Delete ${subject.nameEn}`}><Trash2 aria-hidden="true" /></button> : null}
                </div>
              </header>
              <h2 lang="th">{subject.nameTh}</h2>
              <p>{subject.nameEn}</p>
              <dl>
                <div><dt><UserRound aria-hidden="true" />Teacher</dt><dd>{subject.teachers.join(" · ")}</dd></div>
                <div><dt><Clock3 aria-hidden="true" />Weekly</dt><dd>{periods} period{periods === 1 ? "" : "s"}</dd></div>
              </dl>
              <div className="subject-schedule">
                {sessions.map((session) => (
                  <span key={session.id}>
                    <strong>{WEEKDAYS.find((day) => day.value === session.weekday)?.short}</strong>
                    {sessionClock(session).start}–{sessionClock(session).end}
                    <small>{session.room ? `Room ${session.room}` : modeLabel(session.mode)}</small>
                  </span>
                ))}
                {!sessions.length ? <span className="inline-empty">No weekly sessions</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
