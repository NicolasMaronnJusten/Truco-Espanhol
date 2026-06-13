import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { BettingPanel } from "./BettingPanel";
import { Hand } from "./Hand";
import { PlayerList } from "./PlayerList";
import { RoundResult } from "./RoundResult";
import { TrickArea } from "./TrickArea";
import { getBidTimeLimitSeconds, getForbiddenFinalBid } from "../lib/gameEngine";
import type { VisibleGameSnapshot } from "../types/game";

type GameBoardProps = {
  snapshot: VisibleGameSnapshot;
  currentPlayerId: string | null;
  onSubmitBid: (bid: number) => void;
  onPlayCard: (cardId: string) => void;
  onNextRound: () => void;
  onLeave: () => void;
  isBusy?: boolean;
};

function getStatusMessage(snapshot: VisibleGameSnapshot, currentPlayerId: string | null): string {
  const currentPlayer = snapshot.players.find((player) => player.id === currentPlayerId);

  if (!currentPlayer) {
    return "Você está assistindo";
  }

  if (currentPlayer.isSpectator) {
    const wasEliminated = snapshot.gameState.ranking.some(
      (entry) => entry.playerId === currentPlayer.id && entry.reason === "eliminated"
    );
    return wasEliminated ? "Você foi eliminado" : "Você está assistindo";
  }

  if (snapshot.room.status === "betting") {
    if (currentPlayer.bid !== null) {
      return `Palpite enviado: ${currentPlayer.bid}`;
    }

    return snapshot.room.currentTurnPlayerId === currentPlayer.id
      ? "Sua vez de palpitar"
      : "Aguardando seu turno de palpite";
  }

  if (snapshot.room.status === "playing") {
    if (snapshot.gameState.lastTrick?.winnerPlayerId === currentPlayer.id) {
      return "Você ganhou a trick";
    }

    return snapshot.room.currentTurnPlayerId === currentPlayer.id
      ? "Sua vez de jogar"
      : "Aguardando outro jogador";
  }

  if (snapshot.room.status === "round_result") {
    return "Rodada encerrada";
  }

  return "Partida em andamento";
}

export function GameBoard({
  snapshot,
  currentPlayerId,
  onSubmitBid,
  onPlayCard,
  onNextRound,
  onLeave,
  isBusy = false,
}: GameBoardProps) {
  const currentPlayer = snapshot.players.find((player) => player.id === currentPlayerId);
  const isHost = currentPlayer?.id === snapshot.room.hostId;
  const activePlayers = snapshot.players.filter((player) => player.isAlive && !player.isSpectator);
  const eliminatedPlayers = snapshot.players.filter((player) => !player.isAlive && player.isSpectator);
  const currentBidder = snapshot.players.find(
    (player) => player.id === snapshot.room.currentTurnPlayerId
  );
  const bidTimeLimitSeconds = getBidTimeLimitSeconds(snapshot);
  const [bidSecondsLeft, setBidSecondsLeft] = useState(bidTimeLimitSeconds);

  useEffect(() => {
    if (snapshot.room.status !== "betting") {
      setBidSecondsLeft(bidTimeLimitSeconds);
      return undefined;
    }

    const turnStartedAt = snapshot.room.bidTurnStartedAt ?? snapshot.room.updatedAt;

    function updateSecondsLeft() {
      const startedAtMs = new Date(turnStartedAt).getTime();
      const elapsedSeconds = Number.isFinite(startedAtMs)
        ? Math.floor((Date.now() - startedAtMs) / 1000)
        : 0;
      setBidSecondsLeft(Math.max(0, bidTimeLimitSeconds - elapsedSeconds));
    }

    updateSecondsLeft();
    const intervalId = window.setInterval(updateSecondsLeft, 500);

    return () => window.clearInterval(intervalId);
  }, [
    bidTimeLimitSeconds,
    snapshot.room.bidTurnStartedAt,
    snapshot.room.status,
    snapshot.room.updatedAt,
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-200/70">
            Sala {snapshot.room.code}
          </p>
          <h1 className="font-display text-3xl font-bold text-white">Fodinha</h1>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
        >
          <LogOut size={16} />
          sair
        </button>
      </header>

      <section className="felt-panel rounded-md p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">Rodada atual</p>
            <p className="text-2xl font-bold text-white">{snapshot.room.currentRound}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">Quantidade de cartas</p>
            <p className="text-2xl font-bold text-white">{snapshot.room.handSize}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">Jogadores vivos</p>
            <p className="text-2xl font-bold text-white">{activePlayers.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">Eliminados</p>
            <p className="text-2xl font-bold text-white">{eliminatedPlayers.length}</p>
          </div>
        </div>
        <p className="mt-4 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-amber-100">
          {getStatusMessage(snapshot, currentPlayerId)}
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-5">
          <TrickArea snapshot={snapshot} />
          <BettingPanel
            handSize={snapshot.room.handSize}
            status={snapshot.room.status}
            player={currentPlayer}
            currentBidderName={currentBidder?.name}
            forbiddenBid={currentPlayer ? getForbiddenFinalBid(snapshot, currentPlayer.id) : null}
            secondsLeft={bidSecondsLeft}
            isTurn={snapshot.room.currentTurnPlayerId === currentPlayerId}
            disabled={isBusy}
            onSubmitBid={onSubmitBid}
          />
          <Hand
            player={currentPlayer}
            status={snapshot.room.status}
            isTurn={snapshot.room.currentTurnPlayerId === currentPlayerId}
            onPlayCard={onPlayCard}
          />
          <RoundResult
            snapshot={snapshot}
            isHost={Boolean(isHost)}
            isBusy={isBusy}
            onNextRound={onNextRound}
          />
        </div>

        <aside className="felt-panel rounded-md p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">Mesa</h2>
            <span className="text-xs text-white/60">{snapshot.room.status}</span>
          </div>
          <PlayerList
            players={snapshot.players}
            hostId={snapshot.room.hostId}
            currentPlayerId={currentPlayerId}
            currentTurnPlayerId={snapshot.room.currentTurnPlayerId}
            winnerIds={snapshot.gameState.winners}
          />
        </aside>
      </div>
    </main>
  );
}
