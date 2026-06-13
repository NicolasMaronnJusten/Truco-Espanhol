import { useEffect, useMemo, useState } from "react";
import { HelpCircle, LogIn, Plus, WifiOff } from "lucide-react";
import { FinalResult } from "../components/FinalResult";
import { GameBoard } from "../components/GameBoard";
import { Lobby } from "../components/Lobby";
import { TutorialModal } from "../components/TutorialModal";
import {
  autoSubmitCurrentBid,
  getBidTimeLimitSeconds,
  kickPlayer,
  playCard as playCardInSnapshot,
  resetGame,
  setBidTimeLimit,
  startGame,
  startRound,
  submitBid as submitBidInSnapshot,
} from "../lib/gameEngine";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import {
  clearStoredSession,
  createRoom,
  getStoredSession,
  joinRoom,
  markPlayerConnection,
  reconnectPlayer,
  updateRoom,
} from "../lib/roomService";
import { subscribeToPresence, subscribeToRoomState } from "../lib/realtimeService";
import { getVisibleGameStateForPlayer } from "../lib/visibleState";
import type { GameSnapshot } from "../types/game";

function getInitialRoomCode(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("room") ?? "";
}

export function HomePage() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState(getInitialRoomCode);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const visibleSnapshot = useMemo(
    () => (snapshot ? getVisibleGameStateForPlayer(snapshot, currentPlayerId) : null),
    [snapshot, currentPlayerId]
  );
  const currentRoomId = snapshot?.room.id ?? null;
  const currentPlayerIsHost = Boolean(
    visibleSnapshot?.players.some(
      (player) => player.id === currentPlayerId && player.id === visibleSnapshot.room.hostId
    )
  );

  useEffect(() => {
    const session = getStoredSession();

    if (!session || !isSupabaseConfigured) {
      return;
    }

    setIsBusy(true);
    reconnectPlayer(session.roomId, session.playerId)
      .then((restoredSnapshot) => {
        if (restoredSnapshot) {
          setSnapshot(restoredSnapshot);
          setCurrentPlayerId(session.playerId);
          setRoomCode(restoredSnapshot.room.code);
        }
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : "Falha ao reconectar.");
      })
      .finally(() => setIsBusy(false));
  }, []);

  useEffect(() => {
    if (!currentRoomId) {
      return undefined;
    }

    return subscribeToRoomState(currentRoomId, setSnapshot);
  }, [currentRoomId]);

  useEffect(() => {
    if (!currentRoomId || !currentPlayerId) {
      return undefined;
    }

    return subscribeToPresence(currentRoomId, currentPlayerId, (connectedIds) => {
      setSnapshot((currentSnapshot) => {
        if (!currentSnapshot) {
          return currentSnapshot;
        }

        return {
          ...currentSnapshot,
          players: currentSnapshot.players.map((player) => ({
            ...player,
            isConnected: connectedIds.includes(player.id),
          })),
        };
      });
    });
  }, [currentRoomId, currentPlayerId]);

  useEffect(() => {
    if (
      !snapshot ||
      !currentPlayerId ||
      snapshot.room.status !== "betting" ||
      snapshot.room.hostId !== currentPlayerId ||
      !snapshot.room.currentTurnPlayerId
    ) {
      return undefined;
    }

    const turnStartedAt = snapshot.room.bidTurnStartedAt ?? snapshot.room.updatedAt;
    const startedAtMs = new Date(turnStartedAt).getTime();
    const limitMs = getBidTimeLimitSeconds(snapshot) * 1000;
    const elapsedMs = Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : 0;
    const timeoutMs = Math.max(0, limitMs - elapsedMs) + 150;
    const roomId = snapshot.room.id;

    const timeoutId = window.setTimeout(() => {
      setError(null);
      setIsBusy(true);
      updateRoom(roomId, autoSubmitCurrentBid)
        .then(setSnapshot)
        .catch((caughtError) => {
          setError(caughtError instanceof Error ? caughtError.message : "Algo deu errado.");
        })
        .finally(() => setIsBusy(false));
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [
    currentPlayerId,
    snapshot,
  ]);

  async function runAction(action: () => Promise<GameSnapshot | null | void>) {
    setError(null);
    setIsBusy(true);

    try {
      const nextSnapshot = await action();

      if (nextSnapshot) {
        setSnapshot(nextSnapshot);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Algo deu errado.");
    } finally {
      setIsBusy(false);
    }
  }

  function ensureNickname(): string {
    const trimmedName = nickname.trim();

    if (!trimmedName) {
      throw new Error("Digite um apelido.");
    }

    return trimmedName;
  }

  async function handleCreateRoom() {
    await runAction(async () => {
      const nextSnapshot = await createRoom(ensureNickname());
      setCurrentPlayerId(nextSnapshot.room.hostId);
      return nextSnapshot;
    });
  }

  async function handleJoinRoom() {
    await runAction(async () => {
      if (!roomCode.trim()) {
        throw new Error("Digite o código da sala.");
      }

      const nextSnapshot = await joinRoom(roomCode, ensureNickname());
      const session = getStoredSession();
      setCurrentPlayerId(session?.playerId ?? null);
      return nextSnapshot;
    });
  }

  async function handleSnapshotUpdate(updater: (gameSnapshot: GameSnapshot) => GameSnapshot) {
    if (!snapshot) {
      return;
    }

    await runAction(() => updateRoom(snapshot.room.id, updater));
  }

  async function handleKickPlayer(playerId: string) {
    if (!currentPlayerId) {
      return;
    }

    await handleSnapshotUpdate((current) => kickPlayer(current, currentPlayerId, playerId));
  }

  async function handleLeave() {
    if (snapshot && currentPlayerId) {
      await markPlayerConnection(snapshot.room.id, currentPlayerId, false).catch(() => undefined);
    }

    clearStoredSession();
    setSnapshot(null);
    setCurrentPlayerId(null);
  }

  if (visibleSnapshot?.room.status === "lobby") {
    return (
      <>
        <Lobby
          snapshot={visibleSnapshot}
          currentPlayerId={currentPlayerId}
          isBusy={isBusy}
          onLeave={handleLeave}
          onStartGame={() => handleSnapshotUpdate(startGame)}
          onSetBidTimeLimit={(seconds) =>
            handleSnapshotUpdate((current) => setBidTimeLimit(current, seconds))
          }
          onKickPlayer={handleKickPlayer}
        />
        {error ? <ErrorToast message={error} /> : null}
      </>
    );
  }

  if (visibleSnapshot?.room.status === "finished") {
    return (
      <>
        <FinalResult
          snapshot={visibleSnapshot}
          currentPlayerIsHost={currentPlayerIsHost}
          isBusy={isBusy}
          onBackToLobby={() => handleSnapshotUpdate(resetGame)}
          onPlayAgain={() => handleSnapshotUpdate((current) => startGame(resetGame(current)))}
        />
        {error ? <ErrorToast message={error} /> : null}
      </>
    );
  }

  if (visibleSnapshot) {
    return (
      <>
        <GameBoard
          snapshot={visibleSnapshot}
          currentPlayerId={currentPlayerId}
          isBusy={isBusy}
          onLeave={handleLeave}
          onNextRound={() => handleSnapshotUpdate(startRound)}
          onKickPlayer={handleKickPlayer}
          onPlayCard={(cardId) =>
            currentPlayerId
              ? handleSnapshotUpdate((current) =>
                  playCardInSnapshot(current, currentPlayerId, cardId)
                )
              : undefined
          }
          onSubmitBid={(bid) =>
            currentPlayerId
              ? handleSnapshotUpdate((current) =>
                  submitBidInSnapshot(current, currentPlayerId, bid)
                )
              : undefined
          }
        />
        {error ? <ErrorToast message={error} /> : null}
      </>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="felt-panel rounded-md p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-200/70">
                truco casual por palpites
              </p>
              <h1 className="mt-2 font-display text-5xl font-bold text-white">Fodinha</h1>
            </div>
            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              <HelpCircle size={16} />
              regras
            </button>
          </div>

          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
            Crie uma sala privada, compartilhe o código e jogue em tempo real. Cada
            rodada começa com palpites, as cartas sobem de 1 em 1 e os 2 últimos
            jogadores vivos vencem.
          </p>

          {!isSupabaseConfigured ? (
            <div className="mt-6 flex gap-3 rounded-md border border-red-300/30 bg-red-400/10 p-4 text-sm text-red-100">
              <WifiOff className="mt-0.5 shrink-0" size={18} />
              <p>
                Configure as variáveis do Supabase no arquivo .env para criar e entrar
                em salas online.
              </p>
            </div>
          ) : null}
        </section>

        <section className="felt-panel rounded-md p-5">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-white/75">Apelido</span>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={24}
                placeholder="Seu nome na mesa"
                className="w-full rounded-md border border-white/15 bg-white px-3 py-3 text-mesa-950 placeholder:text-zinc-500"
              />
            </label>

            <button
              type="button"
              disabled={isBusy}
              onClick={handleCreateRoom}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-4 py-3 font-bold text-mesa-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus size={18} />
              criar sala
            </button>

            <div className="border-t border-white/10 pt-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-white/75">
                  Código da sala
                </span>
                <input
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                  placeholder="FOD-4821"
                  className="w-full rounded-md border border-white/15 bg-white px-3 py-3 font-mono text-mesa-950 placeholder:text-zinc-500"
                />
              </label>

              <button
                type="button"
                disabled={isBusy}
                onClick={handleJoinRoom}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/15 px-4 py-3 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <LogIn size={18} />
                entrar em sala
              </button>
            </div>
          </div>
        </section>
      </div>

      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
      {error ? <ErrorToast message={error} /> : null}
    </main>
  );
}

function ErrorToast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,34rem)] -translate-x-1/2 rounded-md border border-red-200/30 bg-red-950 px-4 py-3 text-sm text-red-50 shadow-2xl">
      {message}
    </div>
  );
}
