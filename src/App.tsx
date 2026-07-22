import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, RefreshCw } from "lucide-react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  createExportEnvelope,
  createInitialState,
  MAX_IMPORT_BYTES,
  type AppAccent,
  type ClassBudStateV2,
  type Session,
  type Subject,
  type Task,
  type ThemePreference,
} from "./domain";
import { useClassReminders } from "./notifications";
import type { PwaUpdateDetail } from "./pwa";
import {
  classBudReducer,
  createPersistenceController,
  createSubjectDeletionSnapshot,
  getBrowserStorage,
  importClassBudExport,
  listRecoveryBackups,
  loadOrMigrateState,
  subscribeToStorageUpdates,
  type ClassBudAction,
  type SubjectDeletionSnapshot,
} from "./state";
import { AppShell } from "./ui/components/AppShell";
import { EditorDialogs, type EditorState, type EditorKind } from "./ui/components/EditorDialogs";
import { BuddyView } from "./ui/views/BuddyView";
import { ScheduleView } from "./ui/views/ScheduleView";
import { SettingsView } from "./ui/views/SettingsView";
import { SubjectsView } from "./ui/views/SubjectsView";
import { TasksView } from "./ui/views/TasksView";
import { TodayView } from "./ui/views/TodayView";

interface ToastState {
  id: number;
  title: string;
  detail: string;
  tone?: "success" | "warning" | "info";
  action?: { label: string; run: () => void };
}

const APP_ROUTES = new Set(["/today", "/schedule", "/tasks", "/subjects", "/buddy", "/settings"]);

function isAppRoute(route: string | undefined): route is string {
  return Boolean(route && APP_ROUTES.has(route));
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function IndexRedirect({ state }: { state: ClassBudStateV2 }) {
  const compact = window.matchMedia("(max-width: 719px)").matches;
  const saved = compact ? state.settings.lastRoute.compact : state.settings.lastRoute.wide;
  return <Navigate replace to={isAppRoute(saved) ? saved : compact ? "/today" : "/schedule"} />;
}

export default function App() {
  const [loadResult] = useState(() => loadOrMigrateState());
  const [state, dispatch] = useReducer(classBudReducer, loadResult.state ?? createInitialState());
  const routeStateRef = useRef(state);
  routeStateRef.current = state;
  const [canPersist, setCanPersist] = useState(loadResult.canPersist);
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [editor, setEditor] = useState<EditorState>({ kind: null });
  const [toast, setToast] = useState<ToastState | null>(() => loadResult.warning ? {
    id: Date.now(), title: "Storage needs attention", detail: loadResult.warning, tone: "warning",
  } : loadResult.source === "migrated-v1" ? {
    id: Date.now(), title: "Welcome to ClassBud 2.0", detail: "Your original ClassBuddy data was backed up before the new timetable was installed.", tone: "success",
  } : null);
  const location = useLocation();
  useClassReminders(state);

  const persistence = useMemo(() => createPersistenceController(getBrowserStorage(), {
    delayMs: 250,
    onError: (result) => setToast({
      id: Date.now(),
      title: result.reason === "conflict" ? "Newer changes found" : "Changes aren’t saved",
      detail: result.error,
      tone: "warning",
    }),
  }), []);

  useEffect(() => {
    if (canPersist) persistence.schedule(state);
  }, [canPersist, persistence, state]);

  useEffect(() => {
    const flush = () => persistence.flush();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      persistence.dispose();
    };
  }, [persistence]);

  useEffect(() => subscribeToStorageUpdates((incoming) => {
    if (incoming.revision > state.revision) dispatch({ type: "replace-state", state: incoming });
  }), [state.revision]);

  useEffect(() => {
    if (state.settings.theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = state.settings.theme;
    document.documentElement.style.colorScheme = state.settings.theme === "system" ? "light dark" : state.settings.theme;
  }, [state.settings.theme]);

  useEffect(() => {
    document.documentElement.dataset.uiAccent = state.settings.appAccent;
  }, [state.settings.appAccent]);

  useEffect(() => {
    if (!isAppRoute(location.pathname)) return;
    const layout = window.matchMedia("(max-width: 719px)").matches ? "compact" : "wide";
    if (routeStateRef.current.settings.lastRoute[layout] !== location.pathname) {
      dispatch({ type: "set-last-route", layout, route: location.pathname });
    }
  }, [location.pathname]);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PwaUpdateDetail>).detail;
      setToast({
        id: Date.now(), title: "ClassBud update ready", detail: "Restart to use the newest version.", tone: "info",
        action: { label: "Update", run: () => void detail.update() },
      });
    };
    const onOffline = () => setToast({ id: Date.now(), title: "Ready offline", detail: "ClassBud can now open without a connection.", tone: "success" });
    window.addEventListener("classbud:pwa-update", onUpdate);
    window.addEventListener("classbud:offline-ready", onOffline);
    return () => {
      window.removeEventListener("classbud:pwa-update", onUpdate);
      window.removeEventListener("classbud:offline-ready", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!toast || toast.action || toast.tone === "warning") return;
    const timer = window.setTimeout(() => setToast((current) => current?.id === toast.id ? null : current), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function notify(title: string, detail: string, tone: ToastState["tone"] = "success") {
    setToast({ id: Date.now(), title, detail, tone });
  }

  function safeDispatch(action: ClassBudAction, success?: { title: string; detail: string }) {
    try {
      classBudReducer(state, action);
      dispatch(action);
      if (success) notify(success.title, success.detail);
      return true;
    } catch (error) {
      notify("Couldn’t save that change", error instanceof Error ? error.message : "The data is invalid.", "warning");
      return false;
    }
  }

  function openAdd() {
    if (location.pathname === "/schedule") setEditor({ kind: "session" });
    else if (location.pathname === "/tasks") setEditor({ kind: "task" });
    else if (location.pathname === "/subjects") setEditor({ kind: "subject" });
    else setEditor({ kind: "menu" });
  }

  function saveTask(task: Task) {
    const existing = state.tasks.some((item) => item.id === task.id);
    const action: ClassBudAction = existing
      ? { type: "update-task", id: task.id, changes: {
          subjectId: task.subjectId,
          sessionId: task.sessionId,
          title: task.title,
          dueAt: task.dueAt,
          notes: task.notes,
          completed: task.completed,
        }, updatedAt: task.updatedAt }
      : { type: "add-task", task };
    if (safeDispatch(action, { title: existing ? "Task updated" : "Task added", detail: "Saved to your ClassBud task list." })) setEditor({ kind: null });
  }

  function saveSubject(subject: Subject) {
    const existing = state.subjects.some((item) => item.id === subject.id);
    const action: ClassBudAction = existing
      ? { type: "update-subject", id: subject.id, changes: {
          code: subject.code, nameTh: subject.nameTh, nameEn: subject.nameEn, teachers: subject.teachers, accent: subject.accent,
        } }
      : { type: "add-subject", subject };
    if (safeDispatch(action, { title: existing ? "Subject updated" : "Subject added", detail: subject.nameEn })) setEditor({ kind: null });
  }

  function saveSession(session: Session) {
    const existing = state.sessions.some((item) => item.id === session.id);
    const action: ClassBudAction = existing
      ? { type: "update-session", id: session.id, changes: {
          subjectId: session.subjectId, weekday: session.weekday, periodIds: session.periodIds, room: session.room, mode: session.mode,
        } }
      : { type: "add-session", session };
    if (safeDispatch(action, { title: existing ? "Class updated" : "Class added", detail: "The weekly timetable is up to date." })) {
      setSelectedSessionId(session.id);
      setEditor({ kind: null });
    }
  }

  function deleteSubject(id: string) {
    let snapshot: SubjectDeletionSnapshot;
    try {
      snapshot = createSubjectDeletionSnapshot(state, id);
    } catch (error) {
      notify("Can’t delete subject", error instanceof Error ? error.message : "Only custom subjects can be deleted.", "warning");
      return;
    }
    if (!safeDispatch({ type: "delete-subject", id })) return;
    setEditor({ kind: null });
    const expires = window.setTimeout(() => setToast((current) => current?.title === "Subject deleted" ? null : current), 8000);
    setToast({
      id: Date.now(), title: "Subject deleted", detail: `${snapshot.subject.nameEn} and linked data were removed.`, tone: "info",
      action: { label: "Undo", run: () => {
        window.clearTimeout(expires);
        safeDispatch({ type: "restore-deleted-subject", snapshot }, { title: "Subject restored", detail: snapshot.subject.nameEn });
      } },
    });
  }

  async function changeNotifications(enabled: boolean) {
    if (!enabled) {
      safeDispatch({ type: "set-notifications", enabled: false });
      return;
    }
    if (!("Notification" in window)) {
      notify("Reminders unavailable", "This browser doesn’t support notifications.", "warning");
      return;
    }
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") {
      safeDispatch({ type: "set-notifications", enabled: false });
      notify("Reminders stayed off", "Notification permission was not granted.", "warning");
      return;
    }
    safeDispatch({ type: "set-notifications", enabled: true }, { title: "Reminders on", detail: "ClassBud will remind you while it is open." });
  }

  function exportData() {
    try {
      downloadText(`classbud-2.0-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(createExportEnvelope(state), null, 2));
      notify("Export ready", "Your ClassBud v2 backup was downloaded.");
    } catch (error) {
      notify("Export failed", error instanceof Error ? error.message : "Couldn’t create the export.", "warning");
    }
  }

  async function importData(file: File) {
    try {
      if (file.size > MAX_IMPORT_BYTES) {
        notify("Import rejected", "Import exceeds the 2 MiB limit", "warning");
        return;
      }
      const result = importClassBudExport(await file.text());
      if (!result.success) {
        notify("Import rejected", result.error, "warning");
        return;
      }
      dispatch({ type: "replace-state", state: result.state });
      setCanPersist(true);
      notify("Import complete", "The previous state was backed up before replacement.");
    } catch (error) {
      notify("Import failed", error instanceof Error ? error.message : "Couldn’t read that file.", "warning");
    }
  }

  const recoveryBackups = listRecoveryBackups();

  return (
    <AppShell
      state={state}
      onAdd={openAdd}
      onSelectSession={setSelectedSessionId}
      onEditTask={(id) => setEditor({ kind: "task", id })}
      onEditSubject={(id) => setEditor({ kind: "subject", id })}
    >
      {loadResult.warning ? (
        <div className="recovery-banner" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span><strong>Running with recovery protection</strong><small>{loadResult.warning}</small></span>
          {loadResult.rawRecovery ? <button type="button" onClick={() => downloadText("classbud-recovery.json", loadResult.rawRecovery ?? "")}>Download raw data <Download aria-hidden="true" /></button> : null}
        </div>
      ) : null}
      <Routes>
        <Route path="/" element={<IndexRedirect state={state} />} />
        <Route path="/today" element={<TodayView state={state} onSelectSession={setSelectedSessionId} onToggleTask={(id) => safeDispatch({ type: "update-task", id, changes: { completed: !state.tasks.find((task) => task.id === id)?.completed }, updatedAt: new Date().toISOString() })} />} />
        <Route path="/schedule" element={<ScheduleView state={state} selectedSessionId={selectedSessionId} onSelectSession={setSelectedSessionId} onToggleTask={(id) => safeDispatch({ type: "update-task", id, changes: { completed: !state.tasks.find((task) => task.id === id)?.completed }, updatedAt: new Date().toISOString() })} onDeleteTask={(id) => safeDispatch({ type: "delete-task", id }, { title: "Task deleted", detail: "The task was removed." })} onAddTask={(subjectId, sessionId) => setEditor({ kind: "task", subjectId, sessionId })} onEditSession={(id) => setEditor({ kind: "session", id })} onDeleteSession={(id) => setEditor({ kind: "delete-session", id })} onNoteChange={(subjectId, body) => safeDispatch({ type: "set-subject-note", subjectId, body, updatedAt: new Date().toISOString() })} onAddSession={() => setEditor({ kind: "session" })} />} />
        <Route path="/tasks" element={<TasksView state={state} onToggleTask={(id) => safeDispatch({ type: "update-task", id, changes: { completed: !state.tasks.find((task) => task.id === id)?.completed }, updatedAt: new Date().toISOString() })} onAddTask={() => setEditor({ kind: "task" })} onEditTask={(id) => setEditor({ kind: "task", id })} onDeleteTask={(id) => safeDispatch({ type: "delete-task", id }, { title: "Task deleted", detail: "The task was removed." })} />} />
        <Route path="/subjects" element={<SubjectsView state={state} onAddSubject={() => setEditor({ kind: "subject" })} onEditSubject={(id) => setEditor({ kind: "subject", id })} onDeleteSubject={(id) => setEditor({ kind: "delete-subject", id })} />} />
        <Route path="/buddy" element={<BuddyView state={state} />} />
        <Route path="/settings" element={<SettingsView state={state} onThemeChange={(theme: ThemePreference) => safeDispatch({ type: "set-theme", theme })} onAppAccentChange={(accent: AppAccent) => safeDispatch({ type: "set-app-accent", accent })} onNotificationsChange={changeNotifications} onAssistantNameChange={(name) => safeDispatch({ type: "set-assistant-name", name })} onExport={exportData} onImport={importData} recoveryBackups={recoveryBackups.map(({ key, kind, createdAt }) => ({ key, kind, createdAt }))} onDownloadRecoveryBackup={(key) => {
          const backup = recoveryBackups.find((item) => item.key === key);
          if (backup) downloadText(`classbud-${backup.kind}-backup.json`, backup.text);
        }} onRestoreOfficial={() => setEditor({ kind: "restore" })} />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
      <EditorDialogs
        state={state}
        editor={editor}
        onClose={() => setEditor({ kind: null })}
        onChoose={(kind: Exclude<EditorKind, "menu" | "restore" | "delete-session" | "delete-subject" | null>) => setEditor({ kind })}
        onSaveTask={saveTask}
        onSaveSubject={saveSubject}
        onSaveSession={saveSession}
        onRestore={() => {
          if (safeDispatch({ type: "restore-seed" }, { title: "Official timetable restored", detail: "Your custom data and tasks are still here." })) setEditor({ kind: null });
        }}
        onDeleteSession={(id) => {
          if (safeDispatch({ type: "delete-session", id }, { title: "Weekly class deleted", detail: "Linked tasks were kept." })) {
            setSelectedSessionId(undefined);
            setEditor({ kind: null });
          }
        }}
        onDeleteSubject={deleteSubject}
      />
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast ? (
          <div className="toast" data-tone={toast.tone === "warning" ? "amber" : toast.tone === "success" ? "green" : "blue"}>
            <span>{toast.tone === "warning" ? <AlertTriangle aria-hidden="true" /> : toast.action?.label === "Update" ? <RefreshCw aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}</span>
            <div><strong>{toast.title}</strong><small>{toast.detail}</small></div>
            {toast.action ? <button type="button" onClick={() => { toast.action?.run(); setToast(null); }}>{toast.action.label}</button> : <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}>Close</button>}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
