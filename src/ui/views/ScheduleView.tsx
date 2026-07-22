import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  ExternalLink,
  MapPin,
  MonitorUp,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  addDaysToBangkokDateKey,
  bangkokDateAt,
  bangkokDateKey,
  getWeekdayForDateKey,
  type ClassBudStateV2,
  type Session,
  type Weekday,
} from "../../domain";
import {
  clockMinutes,
  DATE_FORMAT_COMPACT,
  DATE_FORMAT_LONG,
  formatDue,
  minutesNow,
  modeLabel,
  sessionClock,
  sessionsFor,
  subjectFor,
  WEEKDAYS,
} from "../utils";
import { EmptyState } from "../components/EmptyState";
import { useLiveNow } from "../hooks/useLiveNow";

type ScheduleMode = "day" | "week" | "month";

interface ScheduleViewProps {
  state: ClassBudStateV2;
  selectedSessionId?: string;
  onSelectSession: (id?: string) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (subjectId: string, sessionId?: string) => void;
  onEditSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNoteChange: (subjectId: string, body: string) => void;
  onAddSession: () => void;
}

const DAY_START = 7 * 60 + 45;
const DAY_END = 16 * 60;
const DAY_SPAN = DAY_END - DAY_START;
const TIME_MARKS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

function eventStyle(session: Session): CSSProperties {
  const { start, end } = sessionClock(session);
  return {
    "--event-top": `${((clockMinutes(start) - DAY_START) / DAY_SPAN) * 100}%`,
    "--event-height": `${((clockMinutes(end) - clockMinutes(start)) / DAY_SPAN) * 100}%`,
  } as CSSProperties;
}

function schoolWeekday(dateKey: string): Weekday | undefined {
  const weekday = getWeekdayForDateKey(dateKey);
  return weekday <= 5 ? weekday as Weekday : undefined;
}

function shiftMonth(dateKey: string, direction: number): string {
  const [year = 0, month = 1] = dateKey.split("-").map(Number);
  const monthIndex = year * 12 + month - 1 + direction;
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = monthIndex - nextYear * 12 + 1;
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
}

function EventBlock({
  state,
  session,
  selected,
  onClick,
  compact = false,
}: {
  state: ClassBudStateV2;
  session: Session;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const subject = subjectFor(state, session.subjectId);
  if (!subject) return null;
  const clock = sessionClock(session);
  return (
    <button
      type="button"
      className={`schedule-event${selected ? " is-selected" : ""}${compact ? " schedule-event--compact" : ""}`}
      data-accent={session.mode === "classroom" ? subject.accent : session.mode}
      style={compact ? undefined : eventStyle(session)}
      aria-label={`${subject.nameTh}, ${clock.start} to ${clock.end}`}
      onClick={onClick}
    >
      <span className="schedule-event__main">
        <strong lang="th">{subject.nameTh}</strong>
        {compact ? <small className="schedule-event__english">{subject.nameEn}</small> : null}
        {!compact ? <small>{clock.start} – {clock.end}</small> : null}
      </span>
      <span className="schedule-event__meta">
        {session.room ? <span>Room {session.room}</span> : <span>{modeLabel(session.mode)}</span>}
        {!compact ? <span>{subject.teachers.join(" · ")}</span> : null}
      </span>
    </button>
  );
}

function DayGrid({
  state,
  weekday,
  selectedDateKey,
  selectedSessionId,
  onSelectSession,
}: {
  state: ClassBudStateV2;
  weekday?: Weekday;
  selectedDateKey: string;
  selectedSessionId?: string;
  onSelectSession: (id: string) => void;
}) {
  const sessions = weekday ? sessionsFor(state, weekday) : [];
  const now = useLiveNow();
  const selectedDate = bangkokDateAt(selectedDateKey, "12:00");
  const showNow = selectedDateKey === bangkokDateKey(now) && minutesNow(now) >= DAY_START && minutesNow(now) <= DAY_END;
  const currentPosition = ((minutesNow(now) - DAY_START) / DAY_SPAN) * 100;
  return (
    <div className="day-grid-wrap">
      <div className="time-axis" aria-hidden="true">
        {TIME_MARKS.map((hour) => (
          <span key={hour} style={{ "--time-y": `${((hour * 60 - DAY_START) / DAY_SPAN) * 100}%` } as CSSProperties}>
            {hour > 12 ? hour - 12 : hour} {hour >= 12 ? "PM" : "AM"}
          </span>
        ))}
      </div>
      <div className="day-grid" aria-label={`${DATE_FORMAT_LONG.format(selectedDate)} schedule`}>
        {TIME_MARKS.map((hour) => (
          <span className="time-rule" key={hour} style={{ "--time-y": `${((hour * 60 - DAY_START) / DAY_SPAN) * 100}%` } as CSSProperties} />
        ))}
        {weekday && weekday >= 2 ? (
          <>
            <div className="day-band day-band--assembly" style={{ "--event-top": "0%", "--event-height": `${(30 / DAY_SPAN) * 100}%` } as CSSProperties}>
              <span>Assembly &amp; Homeroom · 07:45–08:15</span>
            </div>
            <div className="day-band day-band--break" style={{
              "--event-top": `${((9 * 60 + 45 - DAY_START) / DAY_SPAN) * 100}%`,
              "--event-height": `${(5 / DAY_SPAN) * 100}%`,
            } as CSSProperties}><span className="sr-only">Short break, 09:45 to 09:50</span></div>
            <div className="day-band day-band--lunch" style={{
              "--event-top": `${((11 * 60 + 20 - DAY_START) / DAY_SPAN) * 100}%`,
              "--event-height": `${(95 / DAY_SPAN) * 100}%`,
            } as CSSProperties}>
              <span>Lunch · 11:20–12:55</span>
            </div>
            <div className="day-band day-band--break" style={{
              "--event-top": `${((14 * 60 + 25 - DAY_START) / DAY_SPAN) * 100}%`,
              "--event-height": `${(5 / DAY_SPAN) * 100}%`,
            } as CSSProperties}><span className="sr-only">Short break, 14:25 to 14:30</span></div>
          </>
        ) : null}
        {sessions.map((session) => (
          <EventBlock
            key={session.id}
            state={state}
            session={session}
            selected={session.id === selectedSessionId}
            onClick={() => onSelectSession(session.id)}
          />
        ))}
        {showNow ? (
          <div className="now-line" style={{ "--now-y": `${currentPosition}%` } as CSSProperties} aria-label={`Current time ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(now)}`}>
            <span>{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(now)}</span>
          </div>
        ) : null}
        {!sessions.length ? (
          <div className="day-grid__empty"><EmptyState icon={CalendarDays} title="No classes" description={weekday === 1 ? "Monday is intentionally clear on the official timetable." : "No recurring classes are scheduled for this day."} /></div>
        ) : null}
      </div>
    </div>
  );
}

function Agenda({
  state,
  weekday,
  selectedSessionId,
  onSelectSession,
}: {
  state: ClassBudStateV2;
  weekday?: Weekday;
  selectedSessionId?: string;
  onSelectSession: (id: string) => void;
}) {
  const sessions = weekday ? sessionsFor(state, weekday) : [];
  return (
    <div className="mobile-agenda">
      {weekday && weekday >= 2 ? (
        <div className="routine-row">
          <span className="routine-row__time">07:45</span>
          <span><strong>Assembly &amp; Homeroom</strong><small>07:45–08:15 · Daily routine</small></span>
        </div>
      ) : null}
      {sessions.map((session, index) => {
        const clock = sessionClock(session);
        const previous = sessions[index - 1];
        const showLunch = previous && clockMinutes(sessionClock(previous).end) <= 11 * 60 + 20 && clockMinutes(clock.start) >= 12 * 60 + 55;
        return (
          <div key={session.id}>
            {showLunch ? (
              <div className="routine-row routine-row--lunch">
                <span className="routine-row__time">11:20</span>
                <span><strong>Lunch</strong><small>11:20–12:55</small></span>
              </div>
            ) : null}
            <div className="agenda-row">
              <span className="agenda-row__time">{clock.start}</span>
              <EventBlock state={state} session={session} selected={session.id === selectedSessionId} onClick={() => onSelectSession(session.id)} compact />
            </div>
          </div>
        );
      })}
      {!sessions.length ? <EmptyState icon={CalendarDays} title="No classes" description={weekday === 1 ? "Monday is intentionally clear." : "No recurring classes are scheduled for this day."} /> : null}
    </div>
  );
}

function WeekGrid({ state, selectedSessionId, onSelectSession }: Pick<ScheduleViewProps, "state" | "selectedSessionId"> & { onSelectSession: (id: string) => void }) {
  return (
    <div className="week-grid">
      {WEEKDAYS.map((day) => (
        <section key={day.value} className="week-column">
          <header><span>{day.short}</span><strong>{day.long}</strong></header>
          <div className="week-column__events">
            {sessionsFor(state, day.value).map((session) => (
              <div key={session.id} className="week-event-wrap">
                <span>{sessionClock(session).start}</span>
                <EventBlock state={state} session={session} selected={session.id === selectedSessionId} onClick={() => onSelectSession(session.id)} compact />
              </div>
            ))}
            {!sessionsFor(state, day.value).length ? <p>No classes</p> : null}
          </div>
        </section>
      ))}
    </div>
  );
}

function MonthGrid({ state, selectedDateKey, onChooseDate }: { state: ClassBudStateV2; selectedDateKey: string; onChooseDate: (dateKey: string) => void }) {
  const monthKey = selectedDateKey.slice(0, 7);
  const firstKey = `${monthKey}-01`;
  const gridStart = addDaysToBangkokDateKey(firstKey, -(getWeekdayForDateKey(firstKey) - 1));
  const days = Array.from({ length: 42 }, (_, index) => addDaysToBangkokDateKey(gridStart, index));
  const todayKey = bangkokDateKey();
  return (
    <div className="month-view">
      <div className="month-weekdays" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="month-grid">
        {days.map((dateKey) => {
          const date = bangkokDateAt(dateKey, "12:00");
          const weekday = schoolWeekday(dateKey);
          const sessions = weekday ? sessionsFor(state, weekday) : [];
          const inMonth = dateKey.startsWith(monthKey);
          return (
            <button
              key={dateKey}
              className={`${inMonth ? "" : "is-outside"}${dateKey === todayKey ? " is-today" : ""}`}
              type="button"
              onClick={() => onChooseDate(dateKey)}
              aria-label={`${DATE_FORMAT_LONG.format(date)}, ${sessions.length} classes`}
            >
              <span>{Number(dateKey.slice(8, 10))}</span>
              <div className="month-dots" aria-hidden="true">
                {sessions.slice(0, 4).map((session) => {
                  const subject = subjectFor(state, session.subjectId);
                  return <i key={session.id} data-accent={session.mode === "classroom" ? subject?.accent : session.mode} />;
                })}
              </div>
              {sessions.length ? <small>{sessions.length} class{sessions.length === 1 ? "" : "es"}</small> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SessionInspector({
  state,
  session,
  onClose,
  onToggleTask,
  onDeleteTask,
  onAddTask,
  onEditSession,
  onDeleteSession,
  onNoteChange,
}: {
  state: ClassBudStateV2;
  session: Session;
  onClose: () => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: () => void;
  onEditSession: () => void;
  onDeleteSession: () => void;
  onNoteChange: (body: string) => void;
}) {
  const subject = subjectFor(state, session.subjectId);
  if (!subject) return null;
  const clock = sessionClock(session);
  const tasks = state.tasks.filter((task) => task.subjectId === subject.id && (!task.sessionId || task.sessionId === session.id));
  const note = state.subjectNotes[subject.id]?.body ?? "";
  return (
    <aside className="session-inspector" aria-label={`${subject.nameTh} details`}>
      <header className="inspector-header" data-accent={session.mode === "classroom" ? subject.accent : session.mode}>
        <span className="inspector-header__icon" aria-hidden="true"><BookOpen /></span>
        <div>
          <h2 lang="th">{subject.nameTh}</h2>
          <p>{subject.nameEn}</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close class details"><X aria-hidden="true" /></button>
      </header>
      <dl className="inspector-facts">
        <div><dt><Clock3 aria-hidden="true" />Time</dt><dd>{clock.start}–{clock.end}</dd></div>
        <div><dt>{session.mode === "classroom" ? <MapPin aria-hidden="true" /> : <MonitorUp aria-hidden="true" />}Place</dt><dd>{session.room ? `Room ${session.room}` : modeLabel(session.mode)}</dd></div>
        <div><dt><UserRound aria-hidden="true" />Teacher</dt><dd>{subject.teachers.join(" · ")}</dd></div>
        <div><dt><ExternalLink aria-hidden="true" />Code</dt><dd>{subject.code}</dd></div>
      </dl>
      <div className="inspector-actions">
        <button type="button" onClick={onEditSession}><Edit3 aria-hidden="true" /><span>Edit</span></button>
        <button type="button" onClick={onAddTask}><Plus aria-hidden="true" /><span>Task</span></button>
        <button type="button" className="danger-action" onClick={onDeleteSession}><Trash2 aria-hidden="true" /><span>Delete</span></button>
      </div>
      <section className="inspector-section">
        <div className="section-heading section-heading--compact"><h3>Tasks</h3><button className="icon-button icon-button--small" type="button" onClick={onAddTask} aria-label="Add task"><Plus aria-hidden="true" /></button></div>
        <div className="inspector-task-list">
          {tasks.map((task) => (
            <div className={`inspector-task${task.completed ? " is-completed" : ""}`} key={task.id}>
              <button type="button" className="task-check" aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`} onClick={() => onToggleTask(task.id)}><Check aria-hidden="true" /></button>
              <span><strong>{task.title}</strong><small>{formatDue(task)}</small></span>
              <button className="icon-button icon-button--small inspector-task__delete" type="button" onClick={() => onDeleteTask(task.id)} aria-label={`Delete ${task.title}`}><Trash2 aria-hidden="true" /></button>
            </div>
          ))}
          {!tasks.length ? <p className="inline-empty">No tasks for this subject.</p> : null}
        </div>
      </section>
      <section className="inspector-section inspector-section--note">
        <div className="section-heading section-heading--compact"><h3>Notes</h3><span>Saved locally</span></div>
        <textarea aria-label={`Notes for ${subject.nameTh}`} placeholder="Add a subject note…" value={note} maxLength={20000} onChange={(event) => onNoteChange(event.target.value)} />
      </section>
    </aside>
  );
}

export function ScheduleView(props: ScheduleViewProps) {
  const [mode, setMode] = useState<ScheduleMode>("day");
  const [selectedDateKey, setSelectedDateKey] = useState(() => bangkokDateKey());
  const selectedDate = bangkokDateAt(selectedDateKey, "12:00");
  const selectedSession = props.state.sessions.find((session) => session.id === props.selectedSessionId);
  const weekday = schoolWeekday(selectedDateKey);
  const title = mode === "month"
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", month: "long", year: "numeric" }).format(selectedDate)
    : mode === "week"
      ? `Week of ${DATE_FORMAT_COMPACT.format(bangkokDateAt(addDaysToBangkokDateKey(selectedDateKey, -(getWeekdayForDateKey(selectedDateKey) - 1)), "12:00"))}`
      : DATE_FORMAT_COMPACT.format(selectedDate);

  const step = mode === "day" ? 1 : mode === "week" ? 7 : 0;
  function move(direction: number) {
    if (mode === "month") {
      setSelectedDateKey((dateKey) => shiftMonth(dateKey, direction));
    } else {
      setSelectedDateKey((dateKey) => addDaysToBangkokDateKey(dateKey, step * direction));
    }
  }

  const selectedTasks = useMemo(
    () => props.state.tasks.filter((task) => task.sessionId === props.selectedSessionId),
    [props.selectedSessionId, props.state.tasks],
  );

  return (
    <div className="page page--schedule">
      <header className="page-heading schedule-heading">
        <div><p>{DATE_FORMAT_LONG.format(selectedDate)}</p><h1>Schedule</h1></div>
        <Link className="secondary-button schedule-subjects" to="/subjects"><BookOpen aria-hidden="true" /> Subjects</Link>
        <button className="secondary-button schedule-add" type="button" onClick={props.onAddSession}><Plus aria-hidden="true" /> Add class</button>
      </header>
      <div className="schedule-toolbar">
        <div className="segmented-control" aria-label="Schedule view">
          {(["day", "week", "month"] as const).map((item) => (
            <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}>{item[0].toUpperCase() + item.slice(1)}</button>
          ))}
        </div>
        <div className="date-stepper">
          <button className="icon-button" type="button" aria-label={`Previous ${mode}`} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
          <strong>{title}</strong>
          <button className="icon-button" type="button" aria-label={`Next ${mode}`} onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
        </div>
        <button className="secondary-button secondary-button--small" type="button" onClick={() => setSelectedDateKey(bangkokDateKey())}>Today</button>
      </div>
      <p className="recurrence-note"><RotateCcw aria-hidden="true" /> Recurring timetable · holidays and exceptions not included</p>
      <div className={`schedule-layout${selectedSession ? " has-inspector" : ""}`}>
        <section className="schedule-canvas">
          {mode === "day" ? (
            <>
              <div className="schedule-desktop-day"><DayGrid state={props.state} weekday={weekday} selectedDateKey={selectedDateKey} selectedSessionId={props.selectedSessionId} onSelectSession={props.onSelectSession} /></div>
              <Agenda state={props.state} weekday={weekday} selectedSessionId={props.selectedSessionId} onSelectSession={props.onSelectSession} />
            </>
          ) : mode === "week" ? (
            <WeekGrid state={props.state} selectedSessionId={props.selectedSessionId} onSelectSession={props.onSelectSession} />
          ) : (
            <MonthGrid state={props.state} selectedDateKey={selectedDateKey} onChooseDate={(dateKey) => { setSelectedDateKey(dateKey); setMode("day"); }} />
          )}
        </section>
        {selectedSession ? (
          <SessionInspector
            state={props.state}
            session={selectedSession}
            onClose={() => props.onSelectSession(undefined)}
            onToggleTask={props.onToggleTask}
            onDeleteTask={props.onDeleteTask}
            onAddTask={() => props.onAddTask(selectedSession.subjectId, selectedSession.id)}
            onEditSession={() => props.onEditSession(selectedSession.id)}
            onDeleteSession={() => props.onDeleteSession(selectedSession.id)}
            onNoteChange={(body) => props.onNoteChange(selectedSession.subjectId, body)}
          />
        ) : null}
      </div>
      {selectedTasks.length ? <span className="sr-only">Selected class has {selectedTasks.length} linked tasks.</span> : null}
    </div>
  );
}
