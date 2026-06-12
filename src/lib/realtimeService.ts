import type { RealtimeChannel } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type { GameSnapshot, RoomRecord } from "../types/game";

type Unsubscribe = () => void;

export function subscribeToRoomState(
  roomId: string,
  onSnapshot: (snapshot: GameSnapshot) => void
): Unsubscribe {
  if (!isSupabaseConfigured || !supabase) {
    return () => undefined;
  }

  const client = supabase;
  const channel = client
    .channel(`room-state:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        const nextRecord = payload.new as RoomRecord;
        onSnapshot(nextRecord.state);
      }
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToPresence(
  roomId: string,
  playerId: string,
  onConnectedPlayerIds: (ids: string[]) => void
): Unsubscribe {
  if (!isSupabaseConfigured || !supabase) {
    return () => undefined;
  }

  const client = supabase;
  const channel: RealtimeChannel = client
    .channel(`room-presence:${roomId}`, {
      config: {
        presence: {
          key: playerId,
        },
      },
    })
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ playerId: string }>();
      const connectedIds = Object.values(state)
        .flat()
        .map((presence) => presence.playerId)
        .filter(Boolean);
      onConnectedPlayerIds([...new Set(connectedIds)]);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ playerId, onlineAt: new Date().toISOString() });
      }
    });

  return () => {
    void channel.untrack();
    void client.removeChannel(channel);
  };
}
