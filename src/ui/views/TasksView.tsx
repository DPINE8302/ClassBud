import { useMemo, useState } from "react";
import { CalendarClock, Check, CheckCircle2, CheckSquare2, Clock3, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import type { ClassBudStateV2, Task } from "../../domain";
import { EmptyState } from "../components/EmptyState";
import { formatDue, isTaskDueToday, subjectFor } from "../utils";

type TaskFilter = "all" | "today" | "completed";

interface TasksViewProps {
  state: ClassBudStateV2;
  onToggleTask: (id: string) => void;
  onAddTask: () => void;
  onEditTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

function TaskRow({ state, task, onToggle, onEdit, onDelete }: {
  state: ClassBudStateV2;
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const subject = subjectFor(state, task.subjectId);
  return (
    <article className={`task-row${task.completed ? " is-completed" : ""}`}>
      <button type="button" className="task-check task-check--large" aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`} onClick={onToggle}>
        <Check aria-hidden="true" />
      </button>
      <button type="button" className="task-row__content" onClick={onEdit}>
        <strong>{task.title}</strong>
        <span>
          <i data-accent={subject?.accent ?? "slate"} />
          {subject?.nameTh ?? "Unknown subject"}
          <small><Clock3 aria-hidden="true" /> {formatDue(task)}</small>
        </span>
        {task.notes ? <p>{task.notes}</p> : null}
      </button>
      <div className="task-row__actions">
        <button className="icon-button" type="button" aria-label={`Edit ${task.title}`} onClick={onEdit}><MoreHorizontal aria-hidden="true" /></button>
        <button className="icon-button icon-button--danger" type="button" aria-label={`Delete ${task.title}`} onClick={onDelete}><Trash2 aria-hidden="true" /></button>
      </div>
    </article>
  );
}

export function TasksView({ state, onToggleTask, onAddTask, onEditTask, onDeleteTask }: TasksViewProps) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const visible = useMemo(() => state.tasks.filter((task) => {
    if (filter === "today") return !task.completed && isTaskDueToday(task);
    if (filter === "completed") return task.completed;
    return true;
  }).toSorted((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")), [filter, state.tasks]);
  const openCount = state.tasks.filter((task) => !task.completed).length;
  const todayCount = state.tasks.filter((task) => !task.completed && isTaskDueToday(task)).length;
  const doneCount = state.tasks.filter((task) => task.completed).length;

  return (
    <div className="page page--tasks">
      <header className="page-heading page-heading--with-action">
        <div><p>Plan less. Finish more.</p><h1>Tasks</h1></div>
        <button className="primary-button" type="button" onClick={onAddTask}><Plus aria-hidden="true" /> New task</button>
      </header>
      <div className="task-stats" aria-label="Task summary">
        <div><span className="stat-icon" data-tone="blue"><CheckSquare2 aria-hidden="true" /></span><strong>{openCount}</strong><small>Open</small></div>
        <div><span className="stat-icon" data-tone="amber"><CalendarClock aria-hidden="true" /></span><strong>{todayCount}</strong><small>Due today</small></div>
        <div><span className="stat-icon" data-tone="green"><CheckCircle2 aria-hidden="true" /></span><strong>{doneCount}</strong><small>Completed</small></div>
      </div>
      <section className="tasks-section">
        <div className="tasks-toolbar">
          <div className="segmented-control" aria-label="Task filter">
            {(["all", "today", "completed"] as const).map((item) => (
              <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>
                {item === "all" ? "All" : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <span>{visible.length} task{visible.length === 1 ? "" : "s"}</span>
        </div>
        <div className="task-list">
          {visible.map((task) => (
            <TaskRow key={task.id} state={state} task={task} onToggle={() => onToggleTask(task.id)} onEdit={() => onEditTask(task.id)} onDelete={() => onDeleteTask(task.id)} />
          ))}
          {!visible.length ? (
            <EmptyState
              icon={filter === "completed" ? CheckCircle2 : CheckSquare2}
              title={filter === "completed" ? "Nothing completed yet" : filter === "today" ? "Nothing due today" : "Your task list is clear"}
              description={filter === "completed" ? "Completed work will stay here." : "Add a task when something needs your attention."}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
