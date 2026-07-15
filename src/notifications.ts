import { useEffect, useRef } from "react";
import { getCurrentScheduleContext, type ClassBudStateV2 } from "./domain";

const CHANNEL_NAME = "classbud-class-reminders";

function reminderKey(dateKey: string, sessionId: string) {
  return `${dateKey}:${sessionId}`;
}

export function useClassReminders(state: ClassBudStateV2) {
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!state.settings.notificationsEnabled || !("Notification" in window)) return;

    const delivered = new Set<string>();
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : undefined;
    channel?.addEventListener("message", (event: MessageEvent<string>) => delivered.add(event.data));

    const check = () => {
      if (document.visibilityState !== "visible" || Notification.permission !== "granted") return;
      const now = new Date();
      const next = getCurrentScheduleContext(stateRef.current, now).nextSession;
      if (!next) return;
      const minutesUntil = (next.startAt.getTime() - now.getTime()) / 60_000;
      if (minutesUntil <= 0 || minutesUntil > 10) return;

      const key = reminderKey(next.dateKey, next.session.id);
      let alreadyDelivered = delivered.has(key);
      try {
        alreadyDelivered ||= sessionStorage.getItem(`classbud:reminder:${key}`) === "1";
      } catch {
        // Memory and BroadcastChannel deduplication still work when storage is blocked.
      }
      if (alreadyDelivered) return;

      new Notification(`${next.subject.nameEn} starts soon`, {
        body: `${next.start} · ${next.session.room ? `Room ${next.session.room}` : next.session.mode === "flipped" ? "Flipped Classroom" : "Self-study"}`,
        icon: "/classbud-192.png",
        badge: "/classbud-192.png",
        tag: key
      });
      delivered.add(key);
      channel?.postMessage(key);
      try {
        sessionStorage.setItem(`classbud:reminder:${key}`, "1");
      } catch {
        // Notification already delivered; persistence is optional.
      }
    };

    check();
    const interval = window.setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
      channel?.close();
    };
  }, [state.settings.notificationsEnabled]);
}
