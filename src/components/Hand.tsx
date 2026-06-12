import { PlayingCard } from "./Card";
import type { RoomStatus, VisiblePlayer } from "../types/game";

type HandProps = {
  player?: VisiblePlayer;
  status: RoomStatus;
  isTurn: boolean;
  onPlayCard: (cardId: string) => void;
};

export function Hand({ player, status, isTurn, onPlayCard }: HandProps) {
  if (!player) {
    return null;
  }

  const canPlay = status === "playing" && isTurn && player.isAlive && !player.isSpectator;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-100/80">
          Suas cartas
        </h2>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
          {player.hand.length + player.hiddenCardCount} na mão
        </span>
      </div>
      <div className="flex min-h-36 flex-wrap items-center gap-3">
        {player.hand.map((card) => (
          <PlayingCard
            key={card.id}
            card={card}
            disabled={!canPlay}
            onClick={canPlay ? () => onPlayCard(card.id) : undefined}
          />
        ))}
        {Array.from({ length: player.hiddenCardCount }).map((_, index) => (
          <PlayingCard key={`hidden-${index}`} hidden disabled />
        ))}
        {player.hand.length === 0 && player.hiddenCardCount === 0 ? (
          <p className="text-sm text-white/60">Nenhuma carta disponível.</p>
        ) : null}
      </div>
    </section>
  );
}
