import { SUIT_ICONS } from "../lib/deck";
import type { Card as CardType } from "../types/game";

type PlayingCardProps = {
  card?: CardType | null;
  hidden?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

function cardTone(card: CardType): string {
  return card.suit === "ouro" || card.suit === "calice" ? "text-carta-red" : "text-carta-ink";
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
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
    "playing-card relative flex shrink-0 flex-col justify-between overflow-hidden rounded-md border border-zinc-300 bg-carta-paper p-2 text-left text-carta-ink shadow-card",
    compact && "playing-card-compact p-1.5",
    onClick && "transition hover:-translate-y-1 hover:shadow-xl disabled:hover:translate-y-0",
    disabled && "cursor-not-allowed opacity-70"
  );
  const cardContent = (
    <>
      <span className={cx("text-[0.72rem] font-bold leading-tight", cardTone(card))}>
        {card.label}
      </span>
      <span
        className={cx(
          "grid place-items-center rounded border border-current/15 bg-white/55 font-display leading-none",
          compact ? "text-2xl" : "text-4xl",
          cardTone(card)
        )}
      >
        {SUIT_ICONS[card.suit]}
      </span>
      <span className={cx("text-right text-xs font-semibold", cardTone(card))}>
        {card.value === "A" ? "Ás" : card.value}
      </span>
    </>
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
