import { registerSW } from "virtual:pwa-register";
import { cleanupLegacyCachesAfterPrecache } from "./pwa-cache";

export type PwaUpdateDetail = { update: () => Promise<void> };

export function registerClassBudPwa() {
  const cleanupLegacyCaches = async () => {
    if (!("caches" in window)) return [];
    try {
      return await cleanupLegacyCachesAfterPrecache(window.caches);
    } catch {
      // Keep the old offline cache when the new precache cannot be verified.
      return [];
    }
  };

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: async () => {
      const deletedLegacyCaches = await cleanupLegacyCaches();
      if (deletedLegacyCaches.length) {
        await updateSW(true);
        return;
      }

      window.dispatchEvent(
        new CustomEvent<PwaUpdateDetail>("classbud:pwa-update", {
          detail: { update: () => updateSW(true) }
        })
      );
    },
    onOfflineReady: async () => {
      await cleanupLegacyCaches();
      window.dispatchEvent(new CustomEvent("classbud:offline-ready"));
    },
    onRegisteredSW: () => {
      void cleanupLegacyCaches();
    }
  });

  return updateSW;
}
