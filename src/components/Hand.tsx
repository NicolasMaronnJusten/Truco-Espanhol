import { PlayingCard } from "./Card";
import type { RoomStatus, VisiblePlayer } from "../types/game";

type HandProps = {
  player?: VisiblePlayer;
  status: RoomStatus;
  isTurn: boolean;
  isResolvingTrick?: boolean;
  disabled?: boolean;
  onPlayCard: (cardId: string) => void;
};

export function Hand({
  player,
  status,
  isTurn,
  isResolvingTrick = false,
  disabled = false,
  onPlayCard,
}: HandProps) {
  if (!player) {
    return null;
  }

  const canPlay =
    status === "playing" &&
    !isResolvingTrick &&
    !disabled &&
    isTurn &&
    player.isAlive &&
    !player.isSpectator;

  return (
    <section className="felt-panel rounded-md p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-100/80">
          Suas cartas
        </h2>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
          {player.hand.length + player.hiddenCardCount} na mao
        </span>
      </div>

      <div
        className="-mx-3 mt-3 overflow-x-auto overscroll-x-contain px-3 pb-2 scroll-smooth touch-pan-x sm:-mx-4 sm:px-4"
        aria-label="Cartas na mao"
      >
        <div className="flex min-h-32 w-max min-w-full flex-nowrap items-center gap-3 sm:min-h-36">
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
            <p className="text-sm text-white/60">Nenhuma carta disponivel.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
