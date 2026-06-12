import type { Card, CardValue, Player, Suit } from "../types/game";

const SUITS: Suit[] = ["espadas", "ouro", "calice", "paus"];
const VALUES: CardValue[] = ["A", "2", "3", "4", "5", "6", "7", "10", "11", "12"];

export const SUIT_LABELS: Record<Suit, string> = {
  espadas: "espadas",
  ouro: "ouro",
  calice: "cálice",
  paus: "paus",
};

export const SUIT_ICONS: Record<Suit, string> = {
  espadas: "♠",
  ouro: "◆",
  calice: "♔",
  paus: "♣",
};

export function getCardLabel(card: Pick<Card, "suit" | "value">): string {
  const valueLabel = card.value === "A" ? "Ás" : card.value;
  return `${valueLabel} de ${SUIT_LABELS[card.suit]}`;
}

export function getCardPower(card: Pick<Card, "suit" | "value">): number {
  if (card.value === "A" && card.suit === "espadas") {
    return 14;
  }

  if (card.value === "A" && card.suit === "paus") {
    return 13;
  }

  if (card.value === "7" && card.suit === "espadas") {
    return 12;
  }

  if (card.value === "7" && card.suit === "ouro") {
    return 11;
  }

  if (card.value === "3") {
    return 10;
  }

  if (card.value === "2") {
    return 9;
  }

  if (card.value === "A") {
    return 8;
  }

  if (card.value === "12") {
    return 7;
  }

  if (card.value === "11") {
    return 6;
  }

  if (card.value === "10") {
    return 5;
  }

  if (card.value === "7") {
    return 4;
  }

  if (card.value === "6") {
    return 3;
  }

  if (card.value === "5") {
    return 2;
  }

  return 1;
}

export function generateDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    VALUES.map((value) => {
      const cardBase = { suit, value };

      return {
        ...cardBase,
        id: `${value}-${suit}`,
        label: getCardLabel(cardBase),
        power: getCardPower(cardBase),
      };
    })
  );
}

export function shuffleDeck(deck: Card[] = generateDeck()): Card[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

export function compareCards(a: Card, b: Card): number {
  return b.power - a.power;
}

export function dealCards(
  deck: Card[],
  players: Pick<Player, "id">[],
  handSize: number
): { hands: Record<string, Card[]>; remainingDeck: Card[] } {
  const hands = Object.fromEntries(players.map((player) => [player.id, [] as Card[]]));
  let deckIndex = 0;

  for (let cardIndex = 0; cardIndex < handSize; cardIndex += 1) {
    for (const player of players) {
      const card = deck[deckIndex];

      if (card) {
        hands[player.id].push(card);
      }

      deckIndex += 1;
    }
  }

  return {
    hands,
    remainingDeck: deck.slice(deckIndex),
  };
}
