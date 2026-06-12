import type { GameSnapshot, VisibleGameSnapshot, VisiblePlayer } from "../types/game";

function shouldHideHand(
  snapshot: GameSnapshot,
  ownerId: string,
  currentPlayerId: string | null
): boolean {
  const owner = snapshot.players.find((player) => player.id === ownerId);
  const viewer = snapshot.players.find((player) => player.id === currentPlayerId);
  const isActivePlayState = snapshot.room.status === "betting" || snapshot.room.status === "playing";

  if (!owner || !isActivePlayState || owner.hand.length === 0) {
    return false;
  }

  if (!viewer || viewer.isSpectator || !viewer.isAlive) {
    return true;
  }

  const isOwnHand = owner.id === viewer.id;

  if (snapshot.room.status === "betting" && snapshot.room.handSize === 1) {
    return isOwnHand;
  }

  return !isOwnHand;
}

export function getVisibleGameStateForPlayer(
  gameState: GameSnapshot,
  currentPlayerId: string | null
): VisibleGameSnapshot {
  const visiblePlayers: VisiblePlayer[] = gameState.players.map((player) => {
    const hidden = shouldHideHand(gameState, player.id, currentPlayerId);

    return {
      ...player,
      hand: hidden ? [] : player.hand,
      hiddenCardCount: hidden ? player.hand.length : 0,
    };
  });

  return {
    ...gameState,
    gameState: {
      ...gameState.gameState,
      deck: [],
    },
    players: visiblePlayers,
  };
}
