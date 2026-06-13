import { useEffect, useRef, useState } from "react";
import type { GameEvent } from "../types/game";

type GameEventsProps = {
  events?: GameEvent[];
  turnAlertKey?: string | null;
};

type QueuedEvent = {
  id: string;
  message: string;
  kind: "event" | "turn";
};

export function GameEvents({ events = [], turnAlertKey = null }: GameEventsProps) {
  const [queue, setQueue] = useState<QueuedEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<QueuedEvent | null>(null);
  const initializedRef = useRef(false);
  const seenEventIdsRef = useRef(new Set<string>());
  const lastTurnAlertKeyRef = useRef<string | null>(null);

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
    setQueue((currentQueue) => [
      ...currentQueue,
      ...nextEvents.map((event) => ({
        id: event.id,
        message: event.message,
        kind: "event" as const,
      })),
    ]);
  }, [events]);

  useEffect(() => {
    if (!turnAlertKey || lastTurnAlertKeyRef.current === turnAlertKey) {
      return;
    }

    lastTurnAlertKeyRef.current = turnAlertKey;
    setQueue((currentQueue) => [
      ...currentQueue,
      {
        id: `turn-${turnAlertKey}`,
        message: "Esta no seu turno",
        kind: "turn",
      },
    ]);
  }, [turnAlertKey]);

  useEffect(() => {
    if (activeEvent || queue.length === 0) {
      return undefined;
    }

    const [nextEvent, ...remainingQueue] = queue;
    setActiveEvent(nextEvent);
    setQueue(remainingQueue);

    const timeoutId = window.setTimeout(() => setActiveEvent(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [activeEvent, queue]);

  if (!activeEvent) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-1/2 top-8 z-[80] w-[min(92vw,34rem)] -translate-x-1/2">
      <div className="rounded-md border border-amber-200/40 bg-mesa-950/95 px-5 py-4 text-center text-lg font-bold text-amber-100 shadow-2xl backdrop-blur">
        {activeEvent.message}
      </div>
    </div>
  );
}
