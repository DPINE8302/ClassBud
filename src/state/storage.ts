import {
  createExportEnvelope,
  createInitialState,
  parseClassBudState,
  validateClassBudState,
  validateImportText,
} from "../domain";
import type { ClassBudStateV2, ThemePreference } from "../domain";

export const STATE_STORAGE_KEY = "classbud:state:v2";
export const LEGACY_BACKUP_PREFIX = "classbud:legacy-backup:";
export const IMPORT_BACKUP_PREFIX = "classbud:import-backup:";
export const LEGACY_STORAGE_KEYS = [
  "classBuddySchedule",
  "classBuddyTheme",
  "classBuddyNotifications",
] as const;

export interface StorageLike {
  readonly length: number;
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export type LoadSource = "v2" | "migrated-v1" | "fresh" | "recovery";

export interface LoadStateResult {
  state: ClassBudStateV2;
  source: LoadSource;
  canPersist: boolean;
  warning?: string;
  backupKey?: string;
  rawRecovery?: string;
}

export type ImportStateResult =
  | { success: true; state: ClassBudStateV2; backupKey?: string }
  | { success: false; error: string; issues?: string[] };

interface LegacyBackup {
  format: "classbud-legacy-backup";
  createdAt: string;
  raw: Record<(typeof LEGACY_STORAGE_KEYS)[number], string | null>;
}

export interface RecoveryBackup {
  key: string;
  kind: "legacy" | "import";
  createdAt?: string;
  text: string;
}

export function getBrowserStorage(): StorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function timestampKey(prefix: string, now: Date): string {
  return `${prefix}${now.toISOString()}`;
}

function readVerified(storage: StorageLike, key: string, expected: string): void {
  if (storage.getItem(key) !== expected) throw new Error(`Could not verify ${key}`);
}

function writeVerified(storage: StorageLike, key: string, value: string): void {
  storage.setItem(key, value);
  readVerified(storage, key, value);
}

function pruneImportBackups(storage: StorageLike, keep = 3): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(IMPORT_BACKUP_PREFIX)) keys.push(key);
    }
    keys.sort((left, right) => right.localeCompare(left));
    for (const key of keys.slice(keep)) storage.removeItem(key);
  } catch {
    // Backup retention is best-effort and must never invalidate a completed import.
  }
}

function parseLegacyTheme(raw: string | null): ThemePreference {
  if (!raw) return "system";
  let candidate: unknown = raw;
  try {
    candidate = JSON.parse(raw) as unknown;
  } catch {
    // Old versions stored both plain strings and JSON strings.
  }
  return candidate === "light" || candidate === "dark" || candidate === "system"
    ? candidate
    : "system";
}

function parseLegacyNotifications(raw: string | null): boolean {
  if (!raw) return false;
  let candidate: unknown = raw;
  try {
    candidate = JSON.parse(raw) as unknown;
  } catch {
    // Fall through to legacy textual values.
  }
  return candidate === true || candidate === "true" || candidate === "enabled";
}

function parseStoredState(raw: string): ReturnType<typeof validateClassBudState> {
  try {
    return validateClassBudState(JSON.parse(raw) as unknown);
  } catch {
    return { success: false, error: "Stored ClassBud state is not valid JSON" };
  }
}

export function loadOrMigrateState(
  storage: StorageLike | undefined = getBrowserStorage(),
  now: Date = new Date(),
): LoadStateResult {
  if (!storage) {
    return {
      state: createInitialState(),
      source: "fresh",
      canPersist: false,
      warning: "Browser storage is unavailable. Changes will remain in memory only.",
    };
  }

  let v2Raw: string | null;
  try {
    v2Raw = storage.getItem(STATE_STORAGE_KEY);
  } catch (error) {
    return {
      state: createInitialState(),
      source: "recovery",
      canPersist: false,
      warning: `ClassBud could not read browser storage: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }

  if (v2Raw !== null) {
    const parsed = parseStoredState(v2Raw);
    if (parsed.success) {
      return { state: parsed.data, source: "v2", canPersist: true };
    }
    return {
      state: createInitialState(),
      source: "recovery",
      canPersist: false,
      warning: `Saved ClassBud data is corrupt and was not overwritten. ${parsed.error}`,
      rawRecovery: v2Raw,
    };
  }

  let raw: LegacyBackup["raw"];
  try {
    raw = {
      classBuddySchedule: storage.getItem("classBuddySchedule"),
      classBuddyTheme: storage.getItem("classBuddyTheme"),
      classBuddyNotifications: storage.getItem("classBuddyNotifications"),
    };
  } catch (error) {
    return {
      state: createInitialState(),
      source: "recovery",
      canPersist: false,
      warning: `ClassBud could not inspect legacy data: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
  const hasLegacy = Object.values(raw).some((value) => value !== null);
  const state = createInitialState({
    theme: parseLegacyTheme(raw.classBuddyTheme),
    notificationsEnabled: parseLegacyNotifications(raw.classBuddyNotifications),
  });

  if (!hasLegacy) {
    try {
      writeVerified(storage, STATE_STORAGE_KEY, JSON.stringify(state));
      return { state, source: "fresh", canPersist: true };
    } catch (error) {
      return {
        state,
        source: "fresh",
        canPersist: false,
        warning: `ClassBud is running in memory because initial storage failed: ${error instanceof Error ? error.message : "unknown error"}`,
      };
    }
  }

  const backupKey = timestampKey(LEGACY_BACKUP_PREFIX, now);
  const backup: LegacyBackup = {
    format: "classbud-legacy-backup",
    createdAt: now.toISOString(),
    raw,
  };
  const backupText = JSON.stringify(backup, null, 2);
  try {
    writeVerified(storage, backupKey, backupText);
    const stateText = JSON.stringify(state);
    writeVerified(storage, STATE_STORAGE_KEY, stateText);
    const persisted = parseStoredState(storage.getItem(STATE_STORAGE_KEY) ?? "");
    if (!persisted.success) throw new Error("The migrated v2 state failed verification");
    return { state: persisted.data, source: "migrated-v1", canPersist: true, backupKey };
  } catch (error) {
    let backupWasWritten = false;
    try {
      backupWasWritten = storage.getItem(backupKey) === backupText;
    } catch {
      backupWasWritten = false;
    }
    return {
      state,
      source: "recovery",
      canPersist: false,
      warning: `Legacy data was kept, but migration could not be completed: ${error instanceof Error ? error.message : "unknown error"}`,
      ...(backupWasWritten ? { backupKey } : { rawRecovery: backupText }),
    };
  }
}

export function importClassBudExport(
  text: string,
  storage: StorageLike | undefined = getBrowserStorage(),
  now: Date = new Date(),
): ImportStateResult {
  const validated = validateImportText(text);
  if (!validated.success) return validated;
  if (!storage) return { success: false, error: "Browser storage is unavailable" };

  let previousRaw: string | null;
  try {
    previousRaw = storage.getItem(STATE_STORAGE_KEY);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Storage read failed" };
  }
  const previous = previousRaw ? parseStoredState(previousRaw) : undefined;
  const baseRevision = Math.max(
    previous?.success ? previous.data.revision : 0,
    validated.data.state.revision,
  );
  if (baseRevision >= Number.MAX_SAFE_INTEGER) {
    return { success: false, error: "Revision is too large to import safely" };
  }
  let state: ClassBudStateV2;
  try {
    state = parseClassBudState({
      ...validated.data.state,
      revision: baseRevision + 1,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Imported state is invalid",
    };
  }
  const nextRaw = JSON.stringify(state);
  const backupKey = previousRaw ? timestampKey(IMPORT_BACKUP_PREFIX, now) : undefined;
  const backupText = previousRaw && previous?.success
    ? JSON.stringify(createExportEnvelope(previous.data, now), null, 2)
    : previousRaw;
  try {
    if (backupKey && backupText) writeVerified(storage, backupKey, backupText);
    writeVerified(storage, STATE_STORAGE_KEY, nextRaw);
    const verified = parseStoredState(storage.getItem(STATE_STORAGE_KEY) ?? "");
    if (!verified.success) throw new Error("Imported state failed persistence verification");
    pruneImportBackups(storage);
    return { success: true, state: verified.data, ...(backupKey ? { backupKey } : {}) };
  } catch (error) {
    if (previousRaw !== null) {
      try {
        storage.setItem(STATE_STORAGE_KEY, previousRaw);
      } catch {
        // The original raw value is still returned through the recovery backup when possible.
      }
    } else {
      try {
        storage.removeItem(STATE_STORAGE_KEY);
      } catch {
        // Storage is already unavailable; the import remains reported as failed.
      }
    }
    return { success: false, error: error instanceof Error ? error.message : "Import failed" };
  }
}

export function listRecoveryBackups(
  storage: StorageLike | undefined = getBrowserStorage(),
): RecoveryBackup[] {
  if (!storage) return [];
  const backups: RecoveryBackup[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || (!key.startsWith(LEGACY_BACKUP_PREFIX) && !key.startsWith(IMPORT_BACKUP_PREFIX))) continue;
      const text = storage.getItem(key);
      if (text === null) continue;
      let createdAt: string | undefined;
      try {
        const value = JSON.parse(text) as { createdAt?: unknown; exportedAt?: unknown };
        if (typeof value.createdAt === "string") createdAt = value.createdAt;
        else if (typeof value.exportedAt === "string") createdAt = value.exportedAt;
      } catch {
        // Raw import backups are complete prior v2 state JSON, not envelopes.
      }
      backups.push({
        key,
        kind: key.startsWith(LEGACY_BACKUP_PREFIX) ? "legacy" : "import",
        ...(createdAt ? { createdAt } : {}),
        text,
      });
    }
  } catch {
    return [];
  }
  return backups.sort((left, right) => right.key.localeCompare(left.key));
}

export function removeRecoveryBackup(
  key: string,
  storage: StorageLike | undefined = getBrowserStorage(),
): boolean {
  if (!storage || (!key.startsWith(LEGACY_BACKUP_PREFIX) && !key.startsWith(IMPORT_BACKUP_PREFIX))) return false;
  try {
    storage.removeItem(key);
    return storage.getItem(key) === null;
  } catch {
    return false;
  }
}
