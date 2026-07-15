import { describe, expect, it, vi } from "vitest";
import {
  createInitialState,
  restoreOfficialTimetable,
  serializeClassBudExport,
  validateImportText,
} from "../domain";
import {
  LEGACY_BACKUP_PREFIX,
  STATE_STORAGE_KEY,
  classBudReducer,
  createPersistenceController,
  importClassBudExport,
  loadOrMigrateState,
} from "./index";
import type { StorageLike } from "./index";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  failWrites = false;

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
    this.values.set(key, value);
  }
}

describe("state migration and persistence", () => {
  it("backs up v1, replaces its schedule, and preserves preferences", () => {
    const storage = new MemoryStorage();
    storage.setItem("classBuddySchedule", JSON.stringify({ old: "schedule" }));
    storage.setItem("classBuddyTheme", "dark");
    storage.setItem("classBuddyNotifications", "true");
    const result = loadOrMigrateState(storage, new Date("2026-07-15T00:00:00.000Z"));
    expect(result).toMatchObject({ source: "migrated-v1", canPersist: true });
    expect(result.state.settings).toMatchObject({ theme: "dark", notificationsEnabled: true });
    expect(result.state.sessions).toHaveLength(17);
    expect(storage.getItem("classBuddySchedule")).not.toBeNull();
    expect(result.backupKey?.startsWith(LEGACY_BACKUP_PREFIX)).toBe(true);
  });

  it("does not overwrite corrupt v2 or legacy data when storage fails", () => {
    const corrupt = new MemoryStorage();
    corrupt.setItem(STATE_STORAGE_KEY, "{bad");
    const result = loadOrMigrateState(corrupt);
    expect(result).toMatchObject({ source: "recovery", canPersist: false, rawRecovery: "{bad" });
    expect(corrupt.getItem(STATE_STORAGE_KEY)).toBe("{bad");

    const quota = new MemoryStorage();
    quota.setItem("classBuddySchedule", "old");
    quota.failWrites = true;
    const quotaResult = loadOrMigrateState(quota);
    expect(quotaResult).toMatchObject({ source: "recovery", canPersist: false });
    expect(quota.getItem("classBuddySchedule")).toBe("old");
  });

  it("backs up current state before a strict import", () => {
    const storage = new MemoryStorage();
    const current = createInitialState();
    storage.setItem(STATE_STORAGE_KEY, JSON.stringify(current));
    const imported = createInitialState({ theme: "dark" });
    const result = importClassBudExport(
      serializeClassBudExport(imported),
      storage,
      new Date("2026-07-15T00:00:00.000Z"),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.backupKey).toBeDefined();
      expect(result.state.settings.theme).toBe("dark");
      expect(result.state.revision).toBe(1);
      const backup = storage.getItem(result.backupKey!);
      expect(backup).not.toBeNull();
      expect(validateImportText(backup!)).toMatchObject({ success: true });
    }
  });

  it("returns a safe failure for a maximum revision instead of throwing", () => {
    const storage = new MemoryStorage();
    const state = createInitialState();
    state.revision = Number.MAX_SAFE_INTEGER;
    expect(() => importClassBudExport(serializeClassBudExport(state), storage)).not.toThrow();
    expect(importClassBudExport(serializeClassBudExport(state), storage)).toMatchObject({
      success: false,
      error: "Revision is too large to import safely",
    });
  });

  it("retains only the three newest pre-import recovery copies", () => {
    const storage = new MemoryStorage();
    storage.setItem(STATE_STORAGE_KEY, JSON.stringify(createInitialState()));
    for (let index = 0; index < 5; index += 1) {
      const result = importClassBudExport(
        serializeClassBudExport(createInitialState({ theme: index % 2 ? "dark" : "light" })),
        storage,
        new Date(`2026-07-${String(10 + index).padStart(2, "0")}T00:00:00.000Z`),
      );
      expect(result.success).toBe(true);
    }
    const importBackups = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key) => key?.startsWith("classbud:import-backup:"));
    expect(importBackups).toHaveLength(3);
  });

  it("debounces writes and refuses to overwrite a newer revision", () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const state = createInitialState();
    storage.setItem(STATE_STORAGE_KEY, JSON.stringify({ ...state, revision: 4 }));
    const onError = vi.fn();
    const controller = createPersistenceController(storage, { onError });
    controller.schedule({ ...state, revision: 3 });
    vi.advanceTimersByTime(250);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ reason: "conflict" }));
    controller.dispose();
    vi.useRealTimers();
  });
});

describe("ClassBud reducer", () => {
  it("updates settings and unlinks tasks when a session is removed", () => {
    const base = createInitialState();
    const withTask = {
      ...base,
      tasks: [
        {
          id: "task-1",
          subjectId: "art-9",
          sessionId: "tue-art-9",
          title: "Sketch",
          completed: false,
          createdAt: "2026-07-15T00:00:00.000Z",
          updatedAt: "2026-07-15T00:00:00.000Z",
        },
      ],
    };
    const themed = classBudReducer(withTask, { type: "set-theme", theme: "dark" });
    const withoutSession = classBudReducer(themed, { type: "delete-session", id: "tue-art-9" });
    expect(withoutSession.settings.theme).toBe("dark");
    expect(withoutSession.tasks[0]?.sessionId).toBeUndefined();
    expect(withoutSession.revision).toBe(2);
  });

  it("persists a customized Buddy name", () => {
    const renamed = classBudReducer(createInitialState(), { type: "set-assistant-name", name: "Nova" });
    expect(renamed.settings.assistantName).toBe("Nova");
    expect(renamed.revision).toBe(1);
  });

  it("protects seed subjects from deletion", () => {
    expect(() => classBudReducer(createInitialState(), { type: "delete-subject", id: "art-9" })).toThrow(
      "Seed subjects cannot be deleted",
    );
  });

  it("refuses to restore official sessions over a conflicting custom class", () => {
    const state = createInitialState();
    state.sessions = state.sessions.filter(({ id }) => id !== "tue-art-9");
    state.sessions.push({
      id: "custom-tuesday-p1",
      subjectId: "art-9",
      weekday: 2,
      periodIds: ["P1"],
      room: "1901",
      mode: "classroom",
      source: "custom",
    });
    expect(() => restoreOfficialTimetable(state)).toThrow(/custom class/);
    expect(state.sessions.some(({ id }) => id === "custom-tuesday-p1")).toBe(true);
  });
});
