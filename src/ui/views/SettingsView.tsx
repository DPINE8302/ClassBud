import { useId, useRef, type ChangeEvent } from "react";
import {
  Bell,
  Bot,
  Check,
  ChevronRight,
  Download,
  FileClock,
  HardDrive,
  Info,
  Laptop,
  Moon,
  RefreshCcw,
  ShieldCheck,
  Sun,
  Upload,
} from "lucide-react";
import type { ClassBudStateV2, ThemePreference } from "../../domain";

interface SettingsViewProps {
  state: ClassBudStateV2;
  onThemeChange: (theme: ThemePreference) => void;
  onNotificationsChange: (enabled: boolean) => Promise<void> | void;
  onAssistantNameChange: (name: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  recoveryBackups: Array<{ key: string; kind: "legacy" | "import"; createdAt?: string }>;
  onDownloadRecoveryBackup: (key: string) => void;
  onRestoreOfficial: () => void;
}

const THEMES: Array<{ id: ThemePreference; label: string; icon: typeof Laptop }> = [
  { id: "system", label: "System", icon: Laptop },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

export function SettingsView({ state, onThemeChange, onNotificationsChange, onAssistantNameChange, onExport, onImport, recoveryBackups, onDownloadRecoveryBackup, onRestoreOfficial }: SettingsViewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onImport(file);
    event.target.value = "";
  }
  return (
    <div className="page page--settings">
      <header className="page-heading"><p>Make ClassBud work your way</p><h1>Settings</h1></header>
      <div className="settings-layout">
        <section className="settings-group">
          <header><span className="settings-icon" data-tone="blue"><Laptop aria-hidden="true" /></span><div><h2>Appearance</h2><p>Choose how ClassBud looks on this device.</p></div></header>
          <div className="theme-picker" role="radiogroup" aria-label="Theme">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="radio" aria-checked={state.settings.theme === id} onClick={() => onThemeChange(id)}>
                <span className={`theme-preview theme-preview--${id}`}><Icon aria-hidden="true" /></span>
                <strong>{label}</strong>
                <span className="radio-mark">{state.settings.theme === id ? <Check aria-hidden="true" /> : null}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-group">
          <header><span className="settings-icon" data-tone="rose"><Bell aria-hidden="true" /></span><div><h2>Class reminders</h2><p>Get a reminder ten minutes before class.</p></div></header>
          <div className="settings-row">
            <div><strong>Reminders</strong><small>Only while ClassBud or the installed app is open.</small></div>
            <button className="switch" type="button" role="switch" aria-label="Class reminders" aria-checked={state.settings.notificationsEnabled} onClick={() => void onNotificationsChange(!state.settings.notificationsEnabled)}><span /></button>
          </div>
        </section>

        <section className="settings-group">
          <header><span className="settings-icon" data-tone="purple"><Bot aria-hidden="true" /></span><div><h2>Buddy</h2><p>Personalize your private schedule assistant.</p></div></header>
          <div className="settings-field">
            <label htmlFor="assistant-name"><strong>Assistant name</strong><small>Used in Buddy’s welcome screen and chat.</small></label>
            <input id="assistant-name" type="text" maxLength={40} value={state.settings.assistantName ?? "Buddy"} placeholder="Buddy" onChange={(event) => onAssistantNameChange(event.target.value)} />
          </div>
        </section>

        <section className="settings-group">
          <header><span className="settings-icon" data-tone="green"><HardDrive aria-hidden="true" /></span><div><h2>Your data</h2><p>Everything stays in this browser unless you export it.</p></div></header>
          <div className="settings-actions-list">
            <button type="button" onClick={onExport}><span><Download aria-hidden="true" /></span><div><strong>Export ClassBud data</strong><small>Download a validated v2 backup.</small></div><ChevronRight aria-hidden="true" /></button>
            <button type="button" onClick={() => fileRef.current?.click()}><span><Upload aria-hidden="true" /></span><div><strong>Import ClassBud data</strong><small>Replace this device after validation.</small></div><ChevronRight aria-hidden="true" /></button>
            <label className="sr-only" htmlFor={fileInputId}>Choose a ClassBud JSON backup</label>
            <input id={fileInputId} ref={fileRef} className="sr-only" type="file" accept="application/json,.json" tabIndex={-1} onChange={chooseFile} />
            {recoveryBackups.map((backup) => {
              const date = backup.createdAt
                ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date(backup.createdAt))
                : "Recovery copy";
              const label = backup.kind === "legacy" ? "Download legacy backup" : "Download pre-import backup";
              return <button key={backup.key} type="button" aria-label={`${label}, ${date}`} onClick={() => onDownloadRecoveryBackup(backup.key)}><span><FileClock aria-hidden="true" /></span><div><strong>{label}</strong><small>{backup.kind === "legacy" ? `Original ClassBuddy data · ${date}` : `Restorable ClassBud v2 export · ${date}`}</small></div><ChevronRight aria-hidden="true" /></button>;
            })}
            <button type="button" onClick={onRestoreOfficial}><span><RefreshCcw aria-hidden="true" /></span><div><strong>Restore official timetable</strong><small>Reset seed classes without removing tasks or custom subjects.</small></div><ChevronRight aria-hidden="true" /></button>
          </div>
        </section>

        <section className="settings-group settings-group--about">
          <header><span className="settings-icon" data-tone="purple"><Info aria-hidden="true" /></span><div><h2>About ClassBud</h2><p>A calm, private school companion.</p></div></header>
          <dl>
            <div><dt>Version</dt><dd>2.0.0</dd></div>
            <div><dt>Schedule</dt><dd>M.5 IM · Semester 1/2569</dd></div>
            <div><dt>Privacy</dt><dd><ShieldCheck aria-hidden="true" /> Local-only</dd></div>
          </dl>
          <p>Created by Win (Wiqnnc_)</p>
        </section>
      </div>
    </div>
  );
}
