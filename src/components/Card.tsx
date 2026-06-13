import { SUIT_LABELS } from "../lib/deck";
import type { Card as CardType, Suit } from "../types/game";

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

function cardTone(card: CardType): string {
  return card.suit === "ouro" || card.suit === "calice" ? "text-carta-red" : "text-carta-ink";
}

function cardValueLabel(card: CardType): string {
  return card.value === "A" ? "AS" : card.value;
}

function getPipCount(card: CardType): number {
  return card.value === "A" ? 1 : Number(card.value);
}

function isCourtCard(card: CardType): boolean {
  return card.value === "10" || card.value === "11" || card.value === "12";
}

function SuitMark({ suit, compact = false }: { suit: Suit; compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "spanish-suit-mark",
        `spanish-suit-${suit}`,
        compact && "spanish-suit-mark-compact"
      )}
    >
      <span className="spanish-suit-detail" />
    </span>
  );
}

function NumberedCardFace({ card, compact = false }: { card: CardType; compact?: boolean }) {
  const pipCount = getPipCount(card);

  return (
    <div className={cx("spanish-card-field", compact && "spanish-card-field-compact")}>
      {Array.from({ length: pipCount }).map((_, index) => (
        <SuitMark key={`${card.id}-${index}`} suit={card.suit} compact={compact || pipCount > 5} />
      ))}
    </div>
  );
}

function CourtCardFace({ card, compact = false }: { card: CardType; compact?: boolean }) {
  const title = card.value === "10" ? "Sota" : card.value === "11" ? "Cavalo" : "Rei";

  return (
    <div className={cx("spanish-court-card", `spanish-court-${card.suit}`, compact && "spanish-court-compact")}>
      <div className="spanish-court-head" />
      <div className="spanish-court-body">
        <span className="spanish-court-sash" />
        <SuitMark suit={card.suit} compact={compact} />
      </div>
      <span className="spanish-court-title">{title}</span>
    </div>
  );
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
    "playing-card spanish-card relative flex shrink-0 flex-col justify-between overflow-hidden rounded-md border border-zinc-300 bg-carta-paper p-2 text-left text-carta-ink shadow-card",
    compact && "playing-card-compact p-1.5",
    onClick && "transition hover:-translate-y-1 hover:shadow-xl disabled:hover:translate-y-0",
    disabled && "cursor-not-allowed opacity-70"
  );
  const cardContent = (
    <>
      <span className={cx("spanish-card-corner spanish-card-corner-top", cardTone(card))}>
        <strong>{cardValueLabel(card)}</strong>
        <small>{SUIT_LABELS[card.suit]}</small>
      </span>
      {isCourtCard(card) ? (
        <CourtCardFace card={card} compact={compact} />
      ) : (
        <NumberedCardFace card={card} compact={compact} />
      )}
      <span className={cx("spanish-card-corner spanish-card-corner-bottom", cardTone(card))}>
        <strong>{cardValueLabel(card)}</strong>
        <small>{SUIT_LABELS[card.suit]}</small>
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
