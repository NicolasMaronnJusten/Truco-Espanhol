import type { Card as CardType } from "../types/game";

type PlayingCardProps = {
  card?: CardType | null;
  hidden?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function getCardImageSrc(card: CardType): string {
  return `/cards/${card.value}-${card.suit}.jpg`;
}

export function PlayingCard({
  card,
  hidden = false,
  compact = false,
  disabled = false,
  onClick,
}: PlayingCardProps) {
  if (hidden || !card) {
    const hiddenClassName = cx(
      "playing-card card-back relative shrink-0 overflow-hidden rounded-md border border-amber-100/50 shadow-card",
      compact && "playing-card-compact",
      onClick && "transition hover:-translate-y-1 disabled:hover:translate-y-0",
      disabled && "cursor-not-allowed opacity-70"
    );
    const hiddenContent = (
      <>
        <span className="absolute inset-2 rounded border border-amber-100/50" />
        <span className="absolute inset-5 rounded border border-amber-100/30" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-2xl text-amber-100">
          F
        </span>
      </>
    );

    return onClick ? (
      <button
        type="button"
        className={hiddenClassName}
        disabled={disabled}
        onClick={onClick}
        title="Carta oculta"
      >
        {hiddenContent}
      </button>
    ) : (
      <div className={hiddenClassName} title="Carta oculta">
        {hiddenContent}
      </div>
    );
  }

  const cardClassName = cx(
    "playing-card relative shrink-0 overflow-hidden rounded-md border border-zinc-300 bg-carta-paper shadow-card",
    compact && "playing-card-compact",
    onClick && "transition hover:-translate-y-1 hover:shadow-xl disabled:hover:translate-y-0",
    disabled && "cursor-not-allowed opacity-70"
  );
  const cardContent = (
    <img
      src={getCardImageSrc(card)}
      alt={card.label}
      draggable={false}
      className="h-full w-full object-cover"
    />
  );

  return onClick ? (
    <button
      type="button"
      className={cardClassName}
      disabled={disabled}
      onClick={onClick}
      title={card.label}
    >
      {cardContent}
    </button>
  ) : (
    <div className={cardClassName} title={card.label}>
      {cardContent}
    </div>
  );
}
