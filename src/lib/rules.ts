import type { TableCard } from "../types/game";

export function resolveTrickWithTieCancellation(tableCards: TableCard[]): string | null {
  const cardsByPower = tableCards.reduce<Map<number, TableCard[]>>((groups, tableCard) => {
    const cards = groups.get(tableCard.card.power) ?? [];
    cards.push(tableCard);
    groups.set(tableCard.card.power, cards);
    return groups;
  }, new Map());

  const sortedPowers = [...cardsByPower.keys()].sort((a, b) => b - a);

  for (const power of sortedPowers) {
    const cardsAtPower = cardsByPower.get(power) ?? [];

    if (cardsAtPower.length === 1) {
      return cardsAtPower[0].playerId;
    }
  }

  return null;
}
