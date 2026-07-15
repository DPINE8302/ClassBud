import { useEffect, useState } from "react";

/**
 * Keeps time-sensitive views aligned to real minute boundaries. Passing a
 * fixed value preserves deterministic component tests and static previews.
 */
export function useLiveNow(fixedNow?: Date): Date {
  const fixedTime = fixedNow?.getTime();
  const [now, setNow] = useState(() => fixedNow ?? new Date());

  useEffect(() => {
    if (fixedTime !== undefined) {
      setNow(new Date(fixedTime));
      return;
    }

    let interval: ReturnType<typeof window.setInterval> | undefined;
    const tick = () => setNow(new Date());
    const delayToNextMinute = 60_000 - (Date.now() % 60_000) + 25;
    const timeout = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, 60_000);
    }, delayToNextMinute);

    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [fixedTime]);

  return fixedTime === undefined ? now : new Date(fixedTime);
}
