import { validateClassBudState } from "../domain";
import type { ClassBudStateV2 } from "../domain";
import { getBrowserStorage, STATE_STORAGE_KEY } from "./storage";
import type { StorageLike } from "./storage";

export type PersistenceFailureReason = "storage" | "validation" | "conflict";

export type PersistenceResult =
  | { success: true; revision: number }
  | { success: false; reason: PersistenceFailureReason; error: string };

export interface PersistenceOptions {
  delayMs?: number;
  onSaved?: (revision: number) => void;
  onError?: (result: Extract<PersistenceResult, { success: false }>) => void;
}

export interface PersistenceController {
  schedule(state: ClassBudStateV2): void;
  flush(): PersistenceResult;
  cancel(): void;
  dispose(): void;
  readonly pendingRevision: number | undefined;
}

export function createPersistenceController(
  storage: StorageLike | undefined = getBrowserStorage(),
  options: PersistenceOptions = {},
): PersistenceController {
  const delayMs = options.delayMs ?? 250;
  let pending: ClassBudStateV2 | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function emitFailure(reason: PersistenceFailureReason, error: string): PersistenceResult {
    const result = { success: false as const, reason, error };
    options.onError?.(result);
    return result;
  }

  function cancel(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  }

  function flush(): PersistenceResult {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    const state = pending;
    pending = undefined;
    if (!state) return { success: true, revision: -1 };
    const validated = validateClassBudState(state);
    if (!validated.success) return emitFailure("validation", validated.error);
    if (!storage) return emitFailure("storage", "Browser storage is unavailable");
    try {
      const text = JSON.stringify(validated.data);
      const currentRaw = storage.getItem(STATE_STORAGE_KEY);
      if (currentRaw) {
        let currentValue: unknown;
        try {
          currentValue = JSON.parse(currentRaw) as unknown;
        } catch {
          return emitFailure("storage", "Stored state is corrupt and was not overwritten");
        }
        const current = validateClassBudState(currentValue);
        if (!current.success) return emitFailure("storage", "Stored state is corrupt and was not overwritten");
        if (current.data.revision > state.revision) {
          return emitFailure("conflict", "A newer ClassBud revision exists in another tab");
        }
        const currentText = JSON.stringify(current.data);
        if (current.data.revision === state.revision && currentText !== text) {
          return emitFailure("conflict", "Another tab saved a different ClassBud change at this revision");
        }
      }
      storage.setItem(STATE_STORAGE_KEY, text);
      if (storage.getItem(STATE_STORAGE_KEY) !== text) {
        return emitFailure("storage", "Could not verify the saved ClassBud state");
      }
      options.onSaved?.(state.revision);
      return { success: true, revision: state.revision };
    } catch (error) {
      return emitFailure("storage", error instanceof Error ? error.message : "Storage write failed");
    }
  }

  return {
    schedule(state) {
      if (pending && state.revision < pending.revision) return;
      pending = state;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        flush();
      }, delayMs);
    },
    flush,
    cancel,
    dispose: cancel,
    get pendingRevision() {
      return pending?.revision;
    },
  };
}

export function subscribeToStorageUpdates(
  onState: (state: ClassBudStateV2) => void,
  target: Pick<Window, "addEventListener" | "removeEventListener"> | undefined =
    typeof window === "undefined" ? undefined : window,
): () => void {
  if (!target) return () => undefined;
  const listener = (event: StorageEvent): void => {
    if (event.key !== STATE_STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = validateClassBudState(JSON.parse(event.newValue) as unknown);
      if (parsed.success) onState(parsed.data);
    } catch {
      // Never propagate corrupt cross-tab data.
    }
  };
  target.addEventListener("storage", listener as EventListener);
  return () => target.removeEventListener("storage", listener as EventListener);
}
