import { Crown, Heart, ShieldAlert, Trophy, WifiOff } from "lucide-react";
import { PlayingCard } from "./Card";
import type { VisibleGameSnapshot, VisiblePlayer } from "../types/game";

type TableBoardProps = {
  snapshot: VisibleGameSnapshot;
  currentPlayerId: string | null;
  onKickPlayer?: (playerId: string) => void;
};

function getOrderedPlayers(players: VisiblePlayer[], currentPlayerId: string | null): VisiblePlayer[] {
  const currentIndex = players.findIndex((player) => player.id === currentPlayerId);

  if (currentIndex === -1) {
    return players;
  }

  return [...players.slice(currentIndex), ...players.slice(0, currentIndex)];
}

function canKickPlayer(
  player: VisiblePlayer,
  hostId: string,
  currentPlayerId: string | null,
  status: string
): boolean {
  if (player.id === hostId || player.id === currentPlayerId) {
    return false;
  }

  if (status === "lobby") {
    return true;
  }

  return !player.isConnected || Boolean(player.isInactive) || Boolean(player.pendingKick);
}

function getSeatPosition(index: number, total: number): { left: string; top: string } {
  const angle = Math.PI / 2 + (Math.PI * 2 * index) / Math.max(total, 1);
  const x = 50 + Math.cos(angle) * 43;
  const y = 50 + Math.sin(angle) * 38;

  return {
    left: `${x}%`,
    top: `${y}%`,
  };
}

export function TableBoard({ snapshot, currentPlayerId, onKickPlayer }: TableBoardProps) {
  const orderedPlayers = getOrderedPlayers(snapshot.players, currentPlayerId);
  const playerNames = new Map(snapshot.players.map((player) => [player.id, player.name]));
  const currentPlayer = snapshot.players.find((player) => player.id === currentPlayerId);
  const currentPlayerIsHost = currentPlayer?.id === snapshot.room.hostId;
  const lastTrick = snapshot.gameState.lastTrick;
  const winnerName = lastTrick?.winnerPlayerId ? playerNames.get(lastTrick.winnerPlayerId) : null;

  return (
    <section className="table-board relative min-h-[44rem] overflow-hidden rounded-md border border-white/10 bg-mesa-950/45 p-3 sm:min-h-[48rem]">
      <div className="table-oval absolute left-1/2 top-1/2 flex h-[48%] w-[68%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-4 rounded-[50%] border border-amber-100/25 p-6 text-center shadow-2xl">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-100/60">
            Trick {snapshot.room.currentTrick || "-"} de {snapshot.room.handSize || "-"}
          </p>
          <h2 className="text-xl font-bold text-white">{snapshot.room.status}</h2>
        </div>

        <div className="flex min-h-36 max-w-full flex-wrap items-center justify-center gap-3">
          {snapshot.gameState.tableCards.length > 0 ? (
            snapshot.gameState.tableCards.map((tableCard) => (
              <div key={tableCard.id} className="played-card space-y-1">
                <PlayingCard card={tableCard.card} compact />
                <p className="max-w-20 truncate text-center text-[0.68rem] font-semibold text-white/75">
                  {playerNames.get(tableCard.playerId)}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-md bg-black/20 px-3 py-2 text-sm text-white/65">
              Aguardando carta na mesa
            </p>
          )}
        </div>

        {lastTrick ? (
          <p className="max-w-[18rem] rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
            Ultima trick: {winnerName ? `${winnerName} ganhou` : "ninguem ganhou"}
          </p>
        ) : null}
      </div>

      {orderedPlayers.map((player, index) => {
        const isCurrent = player.id === currentPlayerId;
        const isTurn = player.id === snapshot.room.currentTurnPlayerId;
        const isHost = player.id === snapshot.room.hostId;
        const isInactive = !player.isConnected || Boolean(player.isInactive) || Boolean(player.pendingKick);
        const isWinner = snapshot.gameState.winners.includes(player.id);
        const seatPosition = getSeatPosition(index, orderedPlayers.length);
        const showKickButton =
          Boolean(currentPlayerIsHost && onKickPlayer) &&
          canKickPlayer(player, snapshot.room.hostId, currentPlayerId, snapshot.room.status);

        return (
          <article
            key={player.id}
            className={[
              "player-seat absolute w-[min(42vw,12.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border p-3 shadow-xl backdrop-blur",
              isTurn ? "border-amber-300 bg-amber-200/15" : "border-white/10 bg-mesa-900/88",
              isInactive ? "opacity-75 grayscale" : "",
              isCurrent ? "ring-2 ring-emerald-300/70" : "",
            ].join(" ")}
            style={seatPosition}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-sm font-bold text-white">
                    {player.name}
                    {isCurrent ? " (voce)" : ""}
                  </h3>
                  {isHost ? <Crown size={15} className="shrink-0 text-amber-300" /> : null}
                  {isWinner ? <Trophy size={15} className="shrink-0 text-amber-300" /> : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] text-white/70">
                  <span className="inline-flex items-center gap-1">
                    <Heart size={12} />
                    {player.lives}
                  </span>
                  <span>tricks {player.tricksWon}</span>
                  <span>palpite {player.bid ?? "-"}</span>
                </div>
              </div>
              {isTurn ? (
                <span className="rounded-full bg-amber-300 px-2 py-1 text-[0.62rem] font-bold text-mesa-950">
                  turno
                </span>
              ) : null}
            </div>

            {isInactive ? (
              <p className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-200/20 bg-red-400/10 px-2 py-1 text-[0.68rem] font-semibold text-red-50">
                <WifiOff size={12} />
                {player.pendingKick ? "remocao pendente" : "inativo"}
              </p>
            ) : null}

            {player.hand.length > 0 || player.hiddenCardCount > 0 ? (
              isCurrent ? (
                <p className="mt-3 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-center text-xs font-semibold text-white/70">
                  {player.hand.length + player.hiddenCardCount} na mao
                </p>
              ) : (
                <div className="mt-3 flex max-h-28 flex-wrap justify-center gap-1.5 overflow-hidden">
                  {player.hand.map((card) => (
                    <PlayingCard key={card.id} card={card} compact />
                  ))}
                  {Array.from({ length: player.hiddenCardCount }).map((_, cardIndex) => (
                    <PlayingCard key={`${player.id}-hidden-${cardIndex}`} hidden compact />
                  ))}
                </div>
              )
            ) : null}

            {showKickButton ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Expulsar ${player.name}?`)) {
                    onKickPlayer?.(player.id);
                  }
                }}
                className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md border border-red-200/35 px-2 py-1.5 text-xs font-semibold text-red-50 transition hover:bg-red-400/15"
              >
                <ShieldAlert size={14} />
                Expulsar
              </button>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
