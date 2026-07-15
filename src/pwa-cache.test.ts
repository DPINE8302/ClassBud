import { describe, expect, it } from "vitest";
import { cleanupLegacyCachesAfterPrecache, hasCompleteClassBudPrecache } from "./pwa-cache";

function createCacheStorage(seed: Record<string, string[]>) {
  const entries = new Map(Object.entries(seed));
  const deleted: string[] = [];
  const storage = {
    keys: async () => [...entries.keys()],
    open: async (name: string) => ({
      keys: async () => (entries.get(name) ?? []).map((url) => ({ url })),
    }),
    delete: async (name: string) => {
      deleted.push(name);
      return entries.delete(name);
    },
  } as unknown as CacheStorage;

  return { deleted, storage };
}

describe("legacy PWA cache cleanup", () => {
  it("keeps the legacy offline cache until a complete Workbox precache exists", async () => {
    const { deleted, storage } = createCacheStorage({
      "classbuddy-v1": ["https://classbud.test/index.html"],
      "workbox-precache-v2-incomplete": ["https://classbud.test/index.html?__WB_REVISION__=one"],
    });

    expect(await hasCompleteClassBudPrecache(storage)).toBe(false);
    expect(await cleanupLegacyCachesAfterPrecache(storage)).toEqual([]);
    expect(deleted).toEqual([]);
  });

  it("deletes only legacy caches after the new app shell and bundle are precached", async () => {
    const { deleted, storage } = createCacheStorage({
      "classbuddy-v1": ["https://classbud.test/index.html"],
      "classbuddy-runtime": ["https://classbud.test/today"],
      "workbox-precache-v2-ready": [
        "https://classbud.test/index.html?__WB_REVISION__=two",
        "https://classbud.test/assets/index-abc123.js",
      ],
      "unrelated-cache": ["https://classbud.test/other"],
    });

    expect(await hasCompleteClassBudPrecache(storage)).toBe(true);
    expect(await cleanupLegacyCachesAfterPrecache(storage)).toEqual([
      "classbuddy-v1",
      "classbuddy-runtime",
    ]);
    expect(deleted).toEqual(["classbuddy-v1", "classbuddy-runtime"]);
    expect(await storage.keys()).toEqual([
      "workbox-precache-v2-ready",
      "unrelated-cache",
    ]);
  });
});
