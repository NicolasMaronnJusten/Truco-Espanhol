import { Crown, Eye, Heart, ShieldAlert, Trophy, Wifi, WifiOff } from "lucide-react";
import { PlayingCard } from "./Card";
import type { VisiblePlayer } from "../types/game";

type PlayerListProps = {
  players: VisiblePlayer[];
  hostId: string;
  currentPlayerId: string | null;
  currentTurnPlayerId?: string | null;
  winnerIds?: string[];
  canKickPlayers?: boolean;
  onKickPlayer?: (playerId: string) => void;
};

export function PlayerList({
  players,
  hostId,
  currentPlayerId,
  currentTurnPlayerId,
  winnerIds = [],
  canKickPlayers = false,
  onKickPlayer,
}: PlayerListProps) {
  return (
    <div className="space-y-2">
      {players.map((player) => {
        const isCurrent = player.id === currentPlayerId;
        const isTurn = player.id === currentTurnPlayerId;
        const isWinner = winnerIds.includes(player.id);
        const isInactive = !player.isConnected || Boolean(player.isInactive) || Boolean(player.pendingKick);
        const canKick = canKickPlayers && !isCurrent && player.id !== hostId;

        return (
          <div
            key={player.id}
            className="rounded-md border border-white/10 bg-white/[0.045] p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-white">
                    {player.name}
                    {isCurrent ? " (você)" : ""}
                  </span>
                  {player.id === hostId ? (
                    <span title="Host" className="text-amber-300">
                      <Crown size={16} />
                    </span>
                  ) : null}
                  {player.isSpectator ? (
                    <span title="Assistindo" className="text-white/65">
                      <Eye size={16} />
                    </span>
                  ) : null}
                  {isWinner ? (
                    <span title="Vencedor" className="text-amber-300">
                      <Trophy size={16} />
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/65">
                  <span className="inline-flex items-center gap-1">
                    {player.isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {isInactive ? "inativo" : "conectado"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart size={14} />
                    {player.lives} vidas
                  </span>
                  <span>palpite {player.bid ?? "-"}</span>
                  <span>tricks {player.tricksWon}</span>
                </div>
              </div>
              {isTurn ? (
                <span className="rounded-full bg-amber-300 px-2 py-1 text-xs font-bold text-mesa-950">
                  turno
                </span>
              ) : null}
            </div>
            {canKick ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Expulsar ${player.name}?`)) {
                    onKickPlayer?.(player.id);
                  }
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-200/35 px-3 py-2 text-xs font-semibold text-red-50 transition hover:bg-red-400/15"
              >
                <ShieldAlert size={14} />
                Expulsar
              </button>
            ) : null}
            {player.hand.length > 0 || player.hiddenCardCount > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {player.hand.map((card) => (
                  <PlayingCard key={card.id} card={card} compact />
                ))}
                {Array.from({ length: player.hiddenCardCount }).map((_, index) => (
                  <PlayingCard key={`${player.id}-hidden-${index}`} hidden compact />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
