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
    <section className="felt-panel rounded-md p-2 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-100/80 sm:text-sm">
          Suas cartas
        </h2>
        <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[0.68rem] text-white/70 sm:px-3 sm:py-1 sm:text-xs">
          {player.hand.length + player.hiddenCardCount} na mao
        </span>
      </div>

      <div
        className="-mx-2 mt-2 overflow-x-auto overscroll-x-contain px-2 pb-1 scroll-smooth touch-pan-x sm:-mx-4 sm:mt-3 sm:px-4 sm:pb-2"
        aria-label="Cartas na mao"
      >
        <div className="flex min-h-24 w-max min-w-full flex-nowrap items-center gap-2.5 sm:min-h-36 sm:gap-3">
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
