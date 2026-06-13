import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEvent } from "../types/game";

type GameEventsProps = {
  events?: GameEvent[];
  turnAlertKey?: string | null;
};

type ActiveNotification = {
  id: string;
  message: string;
  kind: "event" | "turn";
};

export function GameEvents({ events = [], turnAlertKey = null }: GameEventsProps) {
  const [activeNotification, setActiveNotification] = useState<ActiveNotification | null>(null);
  const initializedRef = useRef(false);
  const seenEventIdsRef = useRef(new Set<string>());
  const lastTurnAlertKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const showTemporaryNotification = useCallback((notification: ActiveNotification) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    setActiveNotification(notification);
    timeoutRef.current = window.setTimeout(() => {
      setActiveNotification(null);
      timeoutRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      events.forEach((event) => seenEventIdsRef.current.add(event.id));
      initializedRef.current = true;
      return;
    }

    const nextEvents = events
      .filter((event) => !seenEventIdsRef.current.has(event.id))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (nextEvents.length === 0) {
      return;
    }

    nextEvents.forEach((event) => seenEventIdsRef.current.add(event.id));
    const newestEvent = nextEvents[nextEvents.length - 1];

    showTemporaryNotification({
      id: newestEvent.id,
      message: newestEvent.message,
      kind: "event",
    });
  }, [events, showTemporaryNotification]);

  useEffect(() => {
    if (!turnAlertKey || lastTurnAlertKeyRef.current === turnAlertKey) {
      return;
    }

    lastTurnAlertKeyRef.current = turnAlertKey;
    showTemporaryNotification({
      id: `turn-${turnAlertKey}`,
      message: "Esta no seu turno",
      kind: "turn",
    });
  }, [showTemporaryNotification, turnAlertKey]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!activeNotification) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-1/2 top-8 z-[80] w-[min(92vw,34rem)] -translate-x-1/2">
      <div className="rounded-md border border-amber-200/40 bg-mesa-950/95 px-5 py-4 text-center text-lg font-bold text-amber-100 shadow-2xl backdrop-blur">
        {activeNotification.message}
      </div>
    </div>
  );
}
