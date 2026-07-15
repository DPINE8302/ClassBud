import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpen, CalendarPlus, CheckSquare2, MonitorUp, Plus, Trash2 } from "lucide-react";
import type { Accent, ClassBudStateV2, PeriodId, Session, SessionMode, Subject, Task, Weekday } from "../../domain";
import { fromBangkokLocalInput, toBangkokLocalInput, WEEKDAYS } from "../utils";
import { Modal } from "./Modal";

export type EditorKind = "menu" | "task" | "subject" | "session" | "restore" | "delete-session" | "delete-subject" | null;

export interface EditorState {
  kind: EditorKind;
  id?: string;
  subjectId?: string;
  sessionId?: string;
}

interface EditorDialogsProps {
  state: ClassBudStateV2;
  editor: EditorState;
  onClose: () => void;
  onChoose: (kind: Exclude<EditorKind, "menu" | "restore" | "delete-session" | "delete-subject" | null>) => void;
  onSaveTask: (task: Task) => void;
  onSaveSubject: (subject: Subject) => void;
  onSaveSession: (session: Session) => void;
  onRestore: () => void;
  onDeleteSession: (sessionId: string) => void;
  onDeleteSubject: (subjectId: string) => void;
}

export function EditorDialogs(props: EditorDialogsProps) {
  const task = props.editor.kind === "task" ? props.state.tasks.find((item) => item.id === props.editor.id) : undefined;
  const subject = props.editor.kind === "subject" ? props.state.subjects.find((item) => item.id === props.editor.id) : undefined;
  const session = props.editor.kind === "session" ? props.state.sessions.find((item) => item.id === props.editor.id) : undefined;
  return (
    <>
      <Modal open={props.editor.kind === "menu"} title="Add to ClassBud" description="Choose what you want to create." onClose={props.onClose}>
        <div className="creation-menu">
          <button type="button" onClick={() => props.onChoose("session")}><span data-tone="blue"><CalendarPlus aria-hidden="true" /></span><div><strong>Class</strong><small>Add a weekly timetable session</small></div></button>
          <button type="button" onClick={() => props.onChoose("task")}><span data-tone="green"><CheckSquare2 aria-hidden="true" /></span><div><strong>Task</strong><small>Track homework or an assignment</small></div></button>
          <button type="button" onClick={() => props.onChoose("subject")}><span data-tone="purple"><BookOpen aria-hidden="true" /></span><div><strong>Subject</strong><small>Create a custom subject</small></div></button>
        </div>
      </Modal>
      <TaskEditor
        open={props.editor.kind === "task"}
        state={props.state}
        task={task}
        initialSubjectId={props.editor.subjectId}
        initialSessionId={props.editor.sessionId}
        onClose={props.onClose}
        onSave={props.onSaveTask}
      />
      <SubjectEditor open={props.editor.kind === "subject"} subject={subject} onClose={props.onClose} onSave={props.onSaveSubject} />
      <SessionEditor open={props.editor.kind === "session"} state={props.state} session={session} onClose={props.onClose} onSave={props.onSaveSession} />
      <ConfirmDialog
        open={props.editor.kind === "restore"}
        title="Restore official timetable?"
        description="Official subjects and weekly classes will return to the M.5 Semester 1 timetable. Tasks, notes, settings, and custom entries stay untouched. Move any custom class using an official period first."
        actionLabel="Restore timetable"
        icon="restore"
        onClose={props.onClose}
        onConfirm={props.onRestore}
      />
      <ConfirmDialog
        open={props.editor.kind === "delete-session"}
        title="Delete this weekly class?"
        description="Linked tasks will stay, but their direct class link will be removed. This changes every projected week."
        actionLabel="Delete class"
        icon="delete"
        danger
        onClose={props.onClose}
        onConfirm={() => props.editor.id && props.onDeleteSession(props.editor.id)}
      />
      <ConfirmDialog
        open={props.editor.kind === "delete-subject"}
        title="Delete this custom subject?"
        description={(() => {
          const subjectId = props.editor.id;
          const sessions = props.state.sessions.filter((item) => item.subjectId === subjectId).length;
          const tasks = props.state.tasks.filter((item) => item.subjectId === subjectId).length;
          return `This also removes ${sessions} weekly class${sessions === 1 ? "" : "es"} and ${tasks} linked task${tasks === 1 ? "" : "s"}. You can undo for eight seconds.`;
        })()}
        actionLabel="Delete subject"
        icon="delete"
        danger
        onClose={props.onClose}
        onConfirm={() => props.editor.id && props.onDeleteSubject(props.editor.id)}
      />
    </>
  );
}

function TaskEditor({ open, state, task, initialSubjectId, initialSessionId, onClose, onSave }: {
  open: boolean;
  state: ClassBudStateV2;
  task?: Task;
  initialSubjectId?: string;
  initialSessionId?: string;
  onClose: () => void;
  onSave: (task: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setSubjectId(task?.subjectId ?? initialSubjectId ?? state.subjects[0]?.id ?? "");
    setDueAt(toBangkokLocalInput(task?.dueAt));
    setNotes(task?.notes ?? "");
  }, [initialSubjectId, open, state.subjects, task]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const now = new Date().toISOString();
    const linkedSessionId = initialSessionId ?? task?.sessionId;
    const linkedSession = state.sessions.find(({ id }) => id === linkedSessionId);
    onSave({
      id: task?.id ?? `task-${crypto.randomUUID()}`,
      subjectId,
      ...(linkedSession?.subjectId === subjectId ? { sessionId: linkedSession.id } : {}),
      title: title.trim(),
      ...(dueAt ? { dueAt: fromBangkokLocalInput(dueAt) } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      completed: task?.completed ?? false,
      createdAt: task?.createdAt ?? now,
      updatedAt: now,
    });
  }
  return (
    <Modal open={open} title={task ? "Edit task" : "New task"} description="Keep the next action clear and specific." onClose={onClose} footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" form="task-editor" disabled={!title.trim() || !subjectId}>{task ? "Save changes" : "Add task"}</button></>}>
      <form id="task-editor" className="editor-form" onSubmit={submit}>
        <label><span>Task title</span><input autoFocus required maxLength={200} value={title} placeholder="e.g. Finish chapter 3 exercises" onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Subject</span><select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>{state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.nameTh} · {subject.code}</option>)}</select></label>
        <label><span>Due date <small>Bangkok time</small></span><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
        <label><span>Notes <small>Optional</small></span><textarea rows={4} maxLength={20000} value={notes} placeholder="Add details, links, or a checklist…" onChange={(event) => setNotes(event.target.value)} /></label>
      </form>
    </Modal>
  );
}

function SubjectEditor({ open, subject, onClose, onSave }: { open: boolean; subject?: Subject; onClose: () => void; onSave: (subject: Subject) => void }) {
  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [code, setCode] = useState("");
  const [teachers, setTeachers] = useState("");
  const [accent, setAccent] = useState<Accent>("blue");
  useEffect(() => {
    if (!open) return;
    setNameTh(subject?.nameTh ?? "");
    setNameEn(subject?.nameEn ?? "");
    setCode(subject?.code ?? "");
    setTeachers(subject?.teachers.join(", ") ?? "");
    setAccent(subject?.accent ?? "blue");
  }, [open, subject]);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: subject?.id ?? `subject-${crypto.randomUUID()}`,
      nameTh: nameTh.trim(),
      nameEn: nameEn.trim(),
      code: code.trim(),
      teachers: teachers.split(",").map((value) => value.trim()).filter(Boolean),
      accent,
      source: subject?.source ?? "custom",
    });
  }
  return (
    <Modal open={open} title={subject ? "Edit subject" : "New subject"} description={subject?.source === "seed" ? "You can personalise official subject details." : "Create a subject before adding it to the timetable."} onClose={onClose} footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" form="subject-editor" disabled={!nameTh.trim() || !nameEn.trim() || !code.trim() || !teachers.trim()}>Save subject</button></>}>
      <form id="subject-editor" className="editor-form" onSubmit={submit}>
        <div className="form-grid"><label><span>Thai name</span><input lang="th" required maxLength={200} value={nameTh} onChange={(event) => setNameTh(event.target.value)} /></label><label><span>English name</span><input required maxLength={200} value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></label></div>
        <label><span>Subject code</span><input required maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} /></label>
        <label><span>Teachers <small>Separate with commas</small></span><input required maxLength={500} value={teachers} placeholder="อ.ชื่อ, อ.Teacher" onChange={(event) => setTeachers(event.target.value)} /></label>
        <fieldset className="accent-picker"><legend>Colour</legend>{([
          ["blue", "Tech"],
          ["cyan", "Lab"],
          ["amber", "Social"],
          ["rose", "Language"],
          ["slate", "Math"],
        ] as const).map(([color, label]) => <label key={color}><input type="radio" name="accent" value={color} checked={accent === color} onChange={() => setAccent(color)} /><span data-accent={color} /><small>{label}</small></label>)}</fieldset>
      </form>
    </Modal>
  );
}

const PERIODS: PeriodId[] = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];

function SessionEditor({ open, state, session, onClose, onSave }: { open: boolean; state: ClassBudStateV2; session?: Session; onClose: () => void; onSave: (session: Session) => void }) {
  const [subjectId, setSubjectId] = useState("");
  const [weekday, setWeekday] = useState<Weekday>(2);
  const [firstPeriod, setFirstPeriod] = useState<PeriodId>("P1");
  const [lastPeriod, setLastPeriod] = useState<PeriodId>("P2");
  const [mode, setMode] = useState<SessionMode>("classroom");
  const [room, setRoom] = useState("");
  useEffect(() => {
    if (!open) return;
    setSubjectId(session?.subjectId ?? state.subjects[0]?.id ?? "");
    setWeekday(session?.weekday ?? 2);
    setFirstPeriod(session?.periodIds[0] ?? "P1");
    setLastPeriod(session?.periodIds.at(-1) ?? "P2");
    setMode(session?.mode ?? "classroom");
    setRoom(session?.room ?? "");
  }, [open, session, state.subjects]);
  const periodRange = useMemo(() => {
    const start = PERIODS.indexOf(firstPeriod);
    const end = PERIODS.indexOf(lastPeriod);
    return PERIODS.slice(Math.min(start, end), Math.max(start, end) + 1);
  }, [firstPeriod, lastPeriod]);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: session?.id ?? `session-${crypto.randomUUID()}`,
      subjectId,
      weekday,
      periodIds: periodRange,
      mode,
      ...(mode === "classroom" && room.trim() ? { room: room.trim() } : {}),
      source: session?.source ?? "custom",
    });
  }
  return (
    <Modal open={open} title={session ? "Edit weekly class" : "Add weekly class"} description="Changes repeat every week. One-off exceptions aren’t included." onClose={onClose} footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" form="session-editor" disabled={!subjectId || (mode === "classroom" && !room.trim())}>Save class</button></>}>
      <form id="session-editor" className="editor-form" onSubmit={submit}>
        <label><span>Subject</span><select value={subjectId} required onChange={(event) => setSubjectId(event.target.value)}>{state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.nameTh} · {subject.code}</option>)}</select></label>
        <div className="form-grid"><label><span>Day</span><select value={weekday} onChange={(event) => setWeekday(Number(event.target.value) as Weekday)}>{WEEKDAYS.map((day) => <option key={day.value} value={day.value}>{day.long}</option>)}</select></label><label><span>Learning mode</span><select value={mode} onChange={(event) => setMode(event.target.value as SessionMode)}><option value="classroom">Classroom</option><option value="flipped">Flipped Classroom</option><option value="self-study">Self-study</option></select></label></div>
        <div className="form-grid"><label><span>First period</span><select value={firstPeriod} onChange={(event) => setFirstPeriod(event.target.value as PeriodId)}>{PERIODS.map((period) => <option key={period}>{period}</option>)}</select></label><label><span>Last period</span><select value={lastPeriod} onChange={(event) => setLastPeriod(event.target.value as PeriodId)}>{PERIODS.map((period) => <option key={period}>{period}</option>)}</select></label></div>
        {mode === "classroom" ? <label><span>Room</span><input required maxLength={40} value={room} placeholder="e.g. 1901" onChange={(event) => setRoom(event.target.value)} /></label> : <div className="editor-callout"><MonitorUp aria-hidden="true" /><span>{mode === "flipped" ? "Flipped sessions don’t require a classroom." : "Self-study sessions don’t require a classroom."}</span></div>}
      </form>
    </Modal>
  );
}

function ConfirmDialog({ open, title, description, actionLabel, danger = false, icon, onClose, onConfirm }: { open: boolean; title: string; description: string; actionLabel: string; danger?: boolean; icon: "restore" | "delete"; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={open} title={title} description={description} onClose={onClose} footer={<><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className={danger ? "danger-button" : "primary-button"} type="button" onClick={onConfirm}>{actionLabel}</button></>}>
      <div className={`confirm-illustration${danger ? " confirm-illustration--danger" : ""}`} aria-hidden="true">{icon === "delete" ? <Trash2 /> : <Plus />}</div>
    </Modal>
  );
}
