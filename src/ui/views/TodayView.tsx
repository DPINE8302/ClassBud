import { ArrowRight, BookOpen, Check, CheckSquare2, Clock3, MapPin, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ClassBudStateV2, Session } from "../../domain";
import { useLiveNow } from "../hooks/useLiveNow";
import {
  currentAndUpcoming,
  DATE_FORMAT_LONG,
  formatDue,
  isTaskDueToday,
  minutesNow,
  modeLabel,
  sessionClock,
  subjectFor,
} from "../utils";

interface TodayViewProps {
  state: ClassBudStateV2;
  now?: Date;
  onSelectSession: (sessionId: string) => void;
  onToggleTask: (taskId: string) => void;
}

function SessionMiniRow({
  state,
  session,
  onSelect,
}: {
  state: ClassBudStateV2;
  session: Session;
  onSelect: () => void;
}) {
  const subject = subjectFor(state, session.subjectId);
  if (!subject) return null;
  const clock = sessionClock(session);
  return (
    <button className="session-mini-row" type="button" onClick={onSelect}>
      <span className="event-swatch" data-accent={subject.accent} />
      <span className="session-mini-row__content">
        <strong lang="th">{subject.nameTh}</strong>
        <small>{clock.start}–{clock.end}</small>
      </span>
      <span className="session-mini-row__meta">{session.room ? `Room ${session.room}` : modeLabel(session.mode)}</span>
      <ArrowRight aria-hidden="true" />
    </button>
  );
}

export function TodayView({ state, now: fixedNow, onSelectSession, onToggleTask }: TodayViewProps) {
  const navigate = useNavigate();
  const now = useLiveNow(fixedNow);
  const { current, upcoming, currentBand, minutesRemaining } = currentAndUpcoming(state, now);
  const featured = current ?? upcoming[0];
  const featuredSubject = featured ? subjectFor(state, featured.subjectId) : undefined;
  const clock = featured ? sessionClock(featured) : undefined;
  const dueToday = state.tasks.filter((task) => !task.completed && isTaskDueToday(task, now));
  const minute = minutesNow(now);
  const remaining = current && clock ? Math.max(1, Math.ceil((Number(clock.end.slice(0, 2)) * 60 + Number(clock.end.slice(3))) - minute)) : null;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="page page--today">
      <header className="today-heading page-heading">
        <p>{DATE_FORMAT_LONG.format(now)}</p>
        <h1>{greeting}, Win <span aria-hidden="true">👋</span></h1>
      </header>

      <section className="today-layout" aria-label="Today overview">
        <div className="today-primary">
          {currentBand ? (
            <div className="now-card now-card--routine" data-accent="blue" role="status">
              <span className="now-card__ambient" aria-hidden="true" />
              <span className="now-card__eyebrow"><Clock3 aria-hidden="true" /> Now</span>
              <span className="now-card__title">{currentBand.label}</span>
              <span className="now-card__english" lang="th">{currentBand.labelTh}</span>
              <span className="now-card__details">
                <span><Clock3 aria-hidden="true" /> {currentBand.start}–{currentBand.end}</span>
              </span>
              <span className="now-card__footer">Ends in {minutesRemaining ?? 0} min</span>
            </div>
          ) : featured && featuredSubject && clock ? (
            <button
              className="now-card"
              data-accent={featuredSubject.accent}
              type="button"
              onClick={() => {
                onSelectSession(featured.id);
                navigate("/schedule");
              }}
            >
              <span className="now-card__ambient" aria-hidden="true" />
              <span className="now-card__eyebrow">
                <Sparkles aria-hidden="true" />
                {current ? "Now" : "Up next"}
              </span>
              <span className="now-card__title" lang="th">{featuredSubject.nameTh}</span>
              <span className="now-card__english">{featuredSubject.nameEn}</span>
              <span className="now-card__details">
                <span><Clock3 aria-hidden="true" /> {clock.start}–{clock.end}</span>
                <span><MapPin aria-hidden="true" /> {featured.room ? `Room ${featured.room}` : modeLabel(featured.mode)}</span>
              </span>
              <span className="now-card__footer">
                {remaining ? `Ends in ${remaining} min` : `Starts at ${clock.start}`}
                <ArrowRight aria-hidden="true" />
              </span>
            </button>
          ) : (
            <div className="now-card now-card--empty">
              <span className="now-card__eyebrow"><Sparkles aria-hidden="true" /> Clear for now</span>
              <span className="now-card__title">Nothing scheduled</span>
              <span className="now-card__english">Use the quiet time for a task or a well-earned break.</span>
            </div>
          )}

          <section className="content-section">
            <div className="section-heading">
              <div>
                <h2>Up Next</h2>
                <p>Your remaining timetable for today</p>
              </div>
              <button className="text-button" type="button" onClick={() => navigate("/schedule")}>Full schedule <ArrowRight aria-hidden="true" /></button>
            </div>
            <div className="open-list">
              {upcoming.filter((session) => currentBand || session.id !== featured?.id).slice(0, 4).map((session) => (
                <SessionMiniRow
                  key={session.id}
                  state={state}
                  session={session}
                  onSelect={() => {
                    onSelectSession(session.id);
                    navigate("/schedule");
                  }}
                />
              ))}
              {!upcoming.filter((session) => currentBand || session.id !== featured?.id).length ? (
                <p className="inline-empty">No more classes today.</p>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="today-side">
          <section className="side-section">
            <div className="section-heading">
              <div>
                <h2>Due Today</h2>
                <p>{dueToday.length ? `${dueToday.length} task${dueToday.length === 1 ? "" : "s"} left` : "You’re all clear"}</p>
              </div>
              <CheckSquare2 aria-hidden="true" />
            </div>
            <div className="task-compact-list">
              {dueToday.slice(0, 4).map((task) => {
                const subject = subjectFor(state, task.subjectId);
                return (
                  <div className="task-compact" key={task.id}>
                    <button type="button" className="task-check" aria-label={`Complete ${task.title}`} onClick={() => onToggleTask(task.id)}>
                      <Check aria-hidden="true" />
                    </button>
                    <span>
                      <strong>{task.title}</strong>
                      <small>{subject?.nameTh ?? "Task"} · {formatDue(task)}</small>
                    </span>
                  </div>
                );
              })}
              {!dueToday.length ? (
                <div className="compact-success">
                  <Check aria-hidden="true" />
                  <span><strong>Everything done</strong><small>No tasks are due today.</small></span>
                </div>
              ) : null}
            </div>
            <button className="secondary-button secondary-button--full" type="button" onClick={() => navigate("/tasks")}>
              View all tasks <ArrowRight aria-hidden="true" />
            </button>
          </section>

          <section className="side-section semester-card">
            <span className="semester-card__icon" aria-hidden="true"><BookOpen /></span>
            <div>
              <h2>Semester 1</h2>
              <p>M.5 IM · 2569 (2026)</p>
              <span>15 subjects · 32 periods weekly</span>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
