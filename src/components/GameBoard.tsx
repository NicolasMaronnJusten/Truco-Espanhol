import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { BettingPanel } from "./BettingPanel";
import { GameEvents } from "./GameEvents";
import { Hand } from "./Hand";
import { RoundResult } from "./RoundResult";
import { TableBoard } from "./TableBoard";
import { getBidTimeLimitSeconds, getForbiddenFinalBid } from "../lib/gameEngine";
import type { VisibleGameSnapshot } from "../types/game";

type GameBoardProps = {
  snapshot: VisibleGameSnapshot;
  currentPlayerId: string | null;
  onSubmitBid: (bid: number) => void;
  onPlayCard: (cardId: string) => void;
  onNextRound: () => void;
  onKickPlayer: (playerId: string) => void;
  onLeave: () => void;
  isBusy?: boolean;
};

function getStatusMessage(snapshot: VisibleGameSnapshot, currentPlayerId: string | null): string {
  const currentPlayer = snapshot.players.find((player) => player.id === currentPlayerId);
  const isTrickResultPhase =
    snapshot.room.trickPhase === "result" || Boolean(snapshot.room.isShowingTrickResult);
  const lastTrickMessage =
    snapshot.gameState.lastTrickMessage ?? snapshot.gameState.lastTrick?.message;
  const lastTrickWinnerId =
    snapshot.gameState.lastTrickWinnerId ?? snapshot.gameState.lastTrick?.winnerPlayerId;
  const lastTrickWinnerName = lastTrickWinnerId
    ? snapshot.players.find((player) => player.id === lastTrickWinnerId)?.name
    : null;

  if (!currentPlayer) {
    return "Você está assistindo";
  }

  if (currentPlayer.isSpectator) {
    const wasEliminated = snapshot.gameState.ranking.some(
      (entry) => entry.playerId === currentPlayer.id && entry.reason === "eliminated"
    );
    return wasEliminated ? "Você foi eliminado" : "Você está assistindo";
  }

  if (snapshot.room.isResolvingTrick) {
    return "Revelando cartas...";
  }

  if (isTrickResultPhase) {
    return (
      lastTrickMessage ??
      (lastTrickWinnerName ? `${lastTrickWinnerName} venceu a trick` : "Ninguem venceu a trick")
    );
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
  onKickPlayer,
  onLeave,
  isBusy = false,
}: GameBoardProps) {
  const currentPlayer = snapshot.players.find((player) => player.id === currentPlayerId);
  const isResolvingTrick = Boolean(snapshot.room.isResolvingTrick);
  const isTrickLocked =
    isResolvingTrick ||
    snapshot.room.trickPhase === "result" ||
    Boolean(snapshot.room.isShowingTrickResult);
  const isHost = currentPlayer?.id === snapshot.room.hostId;
  const activePlayers = snapshot.players.filter((player) => player.isAlive && !player.isSpectator);
  const eliminatedPlayers = snapshot.players.filter((player) => !player.isAlive && player.isSpectator);
  const currentBidder = snapshot.players.find(
    (player) => player.id === snapshot.room.currentTurnPlayerId
  );
  const bidTimeLimitSeconds = getBidTimeLimitSeconds(snapshot);
  const [bidSecondsLeft, setBidSecondsLeft] = useState(bidTimeLimitSeconds);
  const showHand =
    Boolean(currentPlayer) &&
    (snapshot.room.status === "betting" || snapshot.room.status === "playing") &&
    ((currentPlayer?.hand.length ?? 0) + (currentPlayer?.hiddenCardCount ?? 0) > 0);

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

  const turnAlertKey =
    currentPlayer &&
    snapshot.room.status === "playing" &&
    !isTrickLocked &&
    snapshot.room.currentTurnPlayerId === currentPlayer.id &&
    currentPlayer.isAlive &&
    !currentPlayer.isSpectator
      ? `${snapshot.room.currentTrick}:${snapshot.gameState.playedCards.length}:${currentPlayer.id}`
      : null;

  return (
    <main
      className={[
        "mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-3 px-2 py-3 sm:gap-5 sm:px-6 sm:py-5 lg:px-8",
        showHand ? "pb-44 sm:pb-5" : "",
      ].join(" ")}
    >
      <GameEvents events={snapshot.gameState.events} turnAlertKey={turnAlertKey} />

      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-200/70">
            Sala {snapshot.room.code}
          </p>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Fodinha</h1>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/10 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
        >
          <LogOut size={16} />
          Sair da sala
        </button>
      </header>

      <section className="felt-panel rounded-md p-2.5 sm:p-4">
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          <div>
            <p className="text-[0.62rem] uppercase tracking-wide text-white/50 sm:text-xs">
              Rodada
            </p>
            <p className="text-lg font-bold text-white sm:text-2xl">{snapshot.room.currentRound}</p>
          </div>
          <div>
            <p className="text-[0.62rem] uppercase tracking-wide text-white/50 sm:text-xs">
              Cartas
            </p>
            <p className="text-lg font-bold text-white sm:text-2xl">{snapshot.room.handSize}</p>
          </div>
          <div>
            <p className="text-[0.62rem] uppercase tracking-wide text-white/50 sm:text-xs">
              Vivos
            </p>
            <p className="text-lg font-bold text-white sm:text-2xl">{activePlayers.length}</p>
          </div>
          <div>
            <p className="text-[0.62rem] uppercase tracking-wide text-white/50 sm:text-xs">
              Elim.
            </p>
            <p className="text-lg font-bold text-white sm:text-2xl">{eliminatedPlayers.length}</p>
          </div>
        </div>
        <p className="mt-2 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-amber-100 sm:mt-4 sm:px-3 sm:py-2 sm:text-sm">
          {getStatusMessage(snapshot, currentPlayerId)}
        </p>
      </section>

      <TableBoard
        snapshot={snapshot}
        currentPlayerId={currentPlayerId}
        onPlayCard={onPlayCard}
        onKickPlayer={onKickPlayer}
      />

      {showHand ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-mesa-950/95 px-2 py-2 shadow-2xl backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none sm:backdrop-blur-none">
          <div className="mx-auto max-w-7xl">
            <Hand
              player={currentPlayer}
              status={snapshot.room.status}
              isTurn={snapshot.room.currentTurnPlayerId === currentPlayerId}
              isResolvingTrick={isTrickLocked}
              disabled={isBusy}
              onPlayCard={onPlayCard}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-5">
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
        <RoundResult
          snapshot={snapshot}
          isHost={Boolean(isHost)}
          isBusy={isBusy}
          onNextRound={onNextRound}
        />
      </div>
    </main>
  );
}
