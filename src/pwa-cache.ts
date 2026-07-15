const LEGACY_CACHE_PREFIX = "classbuddy-";
const WORKBOX_PRECACHE_PREFIX = "workbox-precache";

function requestPath(request: Request): string | undefined {
  try {
    return new URL(request.url).pathname;
  } catch {
    return undefined;
  }
}

export async function hasCompleteClassBudPrecache(storage: CacheStorage): Promise<boolean> {
  const names = await storage.keys();
  const precacheNames = names.filter((name) => name.startsWith(WORKBOX_PRECACHE_PREFIX));

  for (const name of precacheNames) {
    const cache = await storage.open(name);
    const paths = (await cache.keys()).map(requestPath).filter((path): path is string => Boolean(path));
    const hasAppShell = paths.includes("/index.html");
    const hasBundledAsset = paths.some((path) => path.startsWith("/assets/"));
    if (hasAppShell && hasBundledAsset) return true;
  }

  return false;
}

export async function cleanupLegacyCachesAfterPrecache(storage: CacheStorage): Promise<string[]> {
  const names = await storage.keys();
  const legacyNames = names.filter((name) => name.startsWith(LEGACY_CACHE_PREFIX));
  if (!legacyNames.length || !(await hasCompleteClassBudPrecache(storage))) return [];

  const deletions = await Promise.all(
    legacyNames.map(async (name) => {
      try {
        return (await storage.delete(name)) ? name : undefined;
      } catch {
        return undefined;
      }
    }),
  );

  return deletions.filter((name): name is string => Boolean(name));
}
