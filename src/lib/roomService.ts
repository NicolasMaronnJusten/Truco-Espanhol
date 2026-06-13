import {
  createInitialSnapshot,
  leavePlayer,
  reconnectPlayer as reconnectPlayerInSnapshot,
  setPlayerConnection,
} from "./gameEngine";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type { GameSnapshot, Player, RoomRecord } from "../types/game";

const SESSION_KEY = "fodinha-session";
const MAX_PLAYERS = 10;
const STORED_SESSION_KEYS = [
  SESSION_KEY,
  "roomId",
  "roomCode",
  "playerId",
  "currentRoom",
  "lastRoom",
  "activeSession",
  "fodinha-room-id",
  "fodinha-room-code",
  "fodinha-player-id",
  "fodinha-current-room",
  "fodinha-last-room",
  "fodinha-active-session",
];

type StoredSession = {
  roomId: string;
  roomCode: string;
  playerId: string;
};

type RoomEntry = {
  snapshot: GameSnapshot;
  playerId: string;
};

type SupabaseLikeError = {
  code?: unknown;
  message?: unknown;
};

function ensureSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para jogar online.");
  }

  return supabase;
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error !== "object" || error === null) {
    return null;
  }

  const supabaseError = error as SupabaseLikeError;

  if (supabaseError.code === "PGRST205") {
    return "Tabela public.rooms nao encontrada. Execute supabase/schema.sql no SQL Editor do Supabase.";
  }

  return typeof supabaseError.message === "string" ? supabaseError.message : null;
}

function throwSupabaseError(error: unknown, fallbackMessage: string): never {
  throw new Error(getErrorMessage(error) ?? fallbackMessage);
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function makeRoomCode(): string {
  const number = Math.floor(1000 + Math.random() * 9000);
  return `FOD-${number}`;
}

function createPlayer(roomId: string, name: string, options?: Partial<Player>): Player {
  const joinedAt = options?.joinedAt ?? new Date().toISOString();

  return {
    id: options?.id ?? crypto.randomUUID(),
    roomId,
    name: name.trim(),
    lives: options?.lives ?? 3,
    isAlive: options?.isAlive ?? true,
    isHost: options?.isHost ?? false,
    isConnected: options?.isConnected ?? true,
    isInactive: options?.isInactive ?? false,
    pendingKick: options?.pendingKick ?? false,
    lastSeenAt: options?.lastSeenAt ?? joinedAt,
    isSpectator: options?.isSpectator ?? false,
    bid: options?.bid ?? null,
    tricksWon: options?.tricksWon ?? 0,
    hand: options?.hand ?? [],
    joinedAt,
  };
}

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // The in-memory React state is enough for the active tab.
  }
}

export function getStoredSession(): StoredSession | null {
  let rawSession: string | null;

  try {
    rawSession = localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredSession;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function clearStoredSession(): void {
  removeStoredSessionKeys(localStorage);
  removeStoredSessionKeys(sessionStorage);
}

function shouldClearStoredSessionKey(key: string): boolean {
  const normalizedKey = key.trim().toLowerCase();

  if (STORED_SESSION_KEYS.some((sessionKey) => sessionKey.toLowerCase() === normalizedKey)) {
    return true;
  }

  return (
    normalizedKey.includes("fodinha") &&
    ["session", "room", "player", "active"].some((term) => normalizedKey.includes(term))
  );
}

function removeStoredSessionKeys(storage: Storage): void {
  try {
    for (const key of STORED_SESSION_KEYS) {
      storage.removeItem(key);
    }

    const matchingKeys = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (key && shouldClearStoredSessionKey(key)) {
        matchingKeys.push(key);
      }
    }

    for (const key of matchingKeys) {
      storage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

async function insertRoom(snapshot: GameSnapshot): Promise<GameSnapshot> {
  const client = ensureSupabase();
  const { error } = await client.from("rooms").insert({
    id: snapshot.room.id,
    code: snapshot.room.code,
    host_id: snapshot.room.hostId,
    status: snapshot.room.status,
    state: snapshot,
  });

  if (error) {
    throwSupabaseError(error, "Nao foi possivel criar a sala.");
  }

  return snapshot;
}

export async function createRoom(name: string): Promise<RoomEntry> {
  const roomId = crypto.randomUUID();
  const host = createPlayer(roomId, name, { isHost: true });
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeRoomCode();
    const snapshot = createInitialSnapshot(roomId, code, host);

    try {
      await insertRoom(snapshot);
      saveSession({ roomId, roomCode: code, playerId: host.id });
      return { snapshot, playerId: host.id };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(getErrorMessage(lastError) ?? "Nao foi possivel criar uma sala com codigo unico.");
}

export async function fetchRoomById(roomId: string): Promise<GameSnapshot | null> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throwSupabaseError(error, "Nao foi possivel buscar a sala.");
  }

  return (data as RoomRecord | null)?.state ?? null;
}

export async function fetchRoomByCode(code: string): Promise<GameSnapshot | null> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("rooms")
    .select("*")
    .eq("code", normalizeCode(code))
    .maybeSingle();

  if (error) {
    throwSupabaseError(error, "Nao foi possivel buscar a sala.");
  }

  return (data as RoomRecord | null)?.state ?? null;
}

export async function saveRoom(snapshot: GameSnapshot): Promise<GameSnapshot> {
  const client = ensureSupabase();
  const snapshotToSave: GameSnapshot = {
    ...snapshot,
    room: {
      ...snapshot.room,
      updatedAt: new Date().toISOString(),
    },
  };
  const { error } = await client
    .from("rooms")
    .update({
      host_id: snapshotToSave.room.hostId,
      status: snapshotToSave.room.status,
      state: snapshotToSave,
    })
    .eq("id", snapshotToSave.room.id);

  if (error) {
    throwSupabaseError(error, "Nao foi possivel salvar a sala.");
  }

  return snapshotToSave;
}

export async function updateRoom(
  roomId: string,
  updater: (snapshot: GameSnapshot) => GameSnapshot
): Promise<GameSnapshot> {
  const currentSnapshot = await fetchRoomById(roomId);

  if (!currentSnapshot) {
    throw new Error("Sala não encontrada.");
  }

  const nextSnapshot = updater(currentSnapshot);
  return saveRoom(nextSnapshot);
}

export async function joinRoom(code: string, name: string): Promise<RoomEntry> {
  const room = await fetchRoomByCode(code);

  if (!room) {
    throw new Error("Sala não encontrada.");
  }

  const allowSpectatorsAfterStart =
    import.meta.env.VITE_SUPABASE_ALLOW_SPECTATORS_AFTER_START !== "false";
  const isLobby = room.room.status === "lobby";

  if (!isLobby && !allowSpectatorsAfterStart) {
    throw new Error("A partida já começou.");
  }

  if (isLobby && room.players.filter((player) => !player.isSpectator).length >= MAX_PLAYERS) {
    throw new Error("A sala já tem 10 jogadores.");
  }

  const player = createPlayer(room.room.id, name, {
    isAlive: isLobby,
    isSpectator: !isLobby,
    lives: isLobby ? 3 : 0,
  });
  const snapshot: GameSnapshot = {
    ...room,
    players: [...room.players, player],
  };

  const savedSnapshot = await saveRoom(snapshot);
  saveSession({ roomId: savedSnapshot.room.id, roomCode: savedSnapshot.room.code, playerId: player.id });
  return { snapshot: savedSnapshot, playerId: player.id };
}

export async function reconnectPlayer(
  roomId: string,
  playerId: string,
  name?: string
): Promise<GameSnapshot | null> {
  const room = await fetchRoomById(roomId);

  if (!room || !room.players.some((player) => player.id === playerId)) {
    return null;
  }

  const nextSnapshot = reconnectPlayerInSnapshot(room, playerId, name);
  const savedSnapshot = await saveRoom(nextSnapshot);
  saveSession({ roomId, roomCode: savedSnapshot.room.code, playerId });
  return savedSnapshot;
}

export async function markPlayerConnection(
  roomId: string,
  playerId: string,
  isConnected: boolean
): Promise<void> {
  await updateRoom(roomId, (snapshot) => setPlayerConnection(snapshot, playerId, isConnected));
}

export async function leaveRoom(roomId: string, playerId: string): Promise<void> {
  await updateRoom(roomId, (snapshot) => leavePlayer(snapshot, playerId));
}
