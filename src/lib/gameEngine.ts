import { dealCards, generateDeck, shuffleDeck } from "./deck";
import { resolveTrickWithTieCancellation } from "./rules";
import type {
  Card,
  GameSnapshot,
  GameState,
  Player,
  RankingEntry,
  Room,
  RoomStatus,
  RoundPlayerResult,
  TableCard,
} from "../types/game";

const STARTING_LIVES = 3;
const MIN_PLAYERS = 3;

function nowIso(): string {
  return new Date().toISOString();
}

function cloneSnapshot(snapshot: GameSnapshot): GameSnapshot {
  return structuredClone(snapshot);
}

function getActivePlayers(players: Player[]): Player[] {
  return players.filter((player) => player.isAlive && !player.isSpectator);
}

function updateRoom(snapshot: GameSnapshot, updates: Partial<Room>): GameSnapshot {
  return {
    ...snapshot,
    room: {
      ...snapshot.room,
      ...updates,
      updatedAt: nowIso(),
    },
  };
}

function createEmptyGameState(roomId: string): GameState {
  return {
    roomId,
    deck: [],
    tableCards: [],
    playedCards: [],
    roundHistory: [],
    winners: [],
    ranking: [],
    lastTrick: null,
  };
}

function getNextHandSize(currentHandSize: number, activePlayerCount: number): number {
  const maxHandSize = Math.max(1, Math.floor(40 / activePlayerCount));
  const nextHandSize = currentHandSize + 1;
  return nextHandSize > maxHandSize ? 1 : nextHandSize;
}

function getNextPlayerIdInOrder(
  players: Player[],
  currentPlayerId: string,
  alreadyPlayedIds: Set<string>
): string | null {
  const activePlayers = getActivePlayers(players);
  const currentIndex = activePlayers.findIndex((player) => player.id === currentPlayerId);

  if (currentIndex === -1) {
    return activePlayers.find((player) => !alreadyPlayedIds.has(player.id))?.id ?? null;
  }

  for (let offset = 1; offset <= activePlayers.length; offset += 1) {
    const candidate = activePlayers[(currentIndex + offset) % activePlayers.length];

    if (!alreadyPlayedIds.has(candidate.id)) {
      return candidate.id;
    }
  }

  return null;
}

function ensureStatus(snapshot: GameSnapshot, allowedStatuses: RoomStatus[]): void {
  if (!allowedStatuses.includes(snapshot.room.status)) {
    throw new Error("Ação indisponível neste estado da sala.");
  }
}

export function createInitialSnapshot(roomId: string, code: string, host: Player): GameSnapshot {
  const createdAt = nowIso();

  return {
    room: {
      id: roomId,
      code,
      hostId: host.id,
      status: "lobby",
      currentRound: 0,
      handSize: 0,
      currentTurnPlayerId: null,
      currentTrick: 0,
      trickStarterPlayerId: null,
      createdAt,
      updatedAt: createdAt,
    },
    players: [host],
    gameState: createEmptyGameState(roomId),
  };
}

export function startGame(snapshot: GameSnapshot): GameSnapshot {
  const draft = cloneSnapshot(snapshot);
  const seatedPlayers = draft.players.filter((player) => !player.isSpectator);

  if (seatedPlayers.length < MIN_PLAYERS) {
    throw new Error("A partida precisa de pelo menos 3 jogadores.");
  }

  const resetPlayers = draft.players.map((player) => ({
    ...player,
    lives: player.isSpectator ? 0 : STARTING_LIVES,
    isAlive: !player.isSpectator,
    bid: null,
    tricksWon: 0,
    hand: [],
  }));

  const resetSnapshot: GameSnapshot = {
    ...draft,
    players: resetPlayers,
    gameState: createEmptyGameState(draft.room.id),
    room: {
      ...draft.room,
      status: "lobby",
      currentRound: 0,
      handSize: 0,
      currentTrick: 0,
      currentTurnPlayerId: null,
      trickStarterPlayerId: null,
      updatedAt: nowIso(),
    },
  };

  return startRound(resetSnapshot);
}

export function startRound(snapshot: GameSnapshot): GameSnapshot {
  ensureStatus(snapshot, ["lobby", "round_result"]);

  const draft = cloneSnapshot(snapshot);
  const activePlayers = getActivePlayers(draft.players);

  if (activePlayers.length < MIN_PLAYERS && draft.room.currentRound === 0) {
    throw new Error("A partida precisa de pelo menos 3 jogadores.");
  }

  if (activePlayers.length <= 2) {
    return finishAsCompleted(draft);
  }

  const handSize =
    draft.room.currentRound === 0
      ? 1
      : getNextHandSize(draft.room.handSize, activePlayers.length);
  const deck = shuffleDeck(generateDeck());
  const { hands, remainingDeck } = dealCards(deck, activePlayers, handSize);
  const starterId = activePlayers[0]?.id ?? null;

  const players = draft.players.map((player) => {
    if (!player.isAlive || player.isSpectator) {
      return {
        ...player,
        bid: null,
        tricksWon: 0,
        hand: [],
      };
    }

    return {
      ...player,
      bid: null,
      tricksWon: 0,
      hand: hands[player.id] ?? [],
    };
  });

  return updateRoom(
    {
      ...draft,
      players,
      gameState: {
        ...draft.gameState,
        deck: remainingDeck,
        tableCards: [],
        playedCards: [],
        lastTrick: null,
      },
    },
    {
      status: "betting",
      currentRound: draft.room.currentRound + 1,
      handSize,
      currentTrick: 1,
      currentTurnPlayerId: starterId,
      trickStarterPlayerId: starterId,
    }
  );
}

export function submitBid(snapshot: GameSnapshot, playerId: string, bid: number): GameSnapshot {
  ensureStatus(snapshot, ["betting"]);

  const draft = cloneSnapshot(snapshot);
  const player = draft.players.find((candidate) => candidate.id === playerId);

  if (!player || !player.isAlive || player.isSpectator) {
    throw new Error("Jogador não pode palpitar.");
  }

  if (!Number.isInteger(bid) || bid < 0 || bid > draft.room.handSize) {
    throw new Error("Palpite inválido para esta rodada.");
  }

  const players = draft.players.map((candidate) =>
    candidate.id === playerId ? { ...candidate, bid } : candidate
  );
  const allActivePlayersBid = getActivePlayers(players).every(
    (candidate) => candidate.bid !== null
  );

  return updateRoom(
    {
      ...draft,
      players,
    },
    allActivePlayersBid
      ? {
          status: "playing",
          currentTurnPlayerId: draft.room.trickStarterPlayerId,
        }
      : {}
  );
}

export function playCard(snapshot: GameSnapshot, playerId: string, cardId: string): GameSnapshot {
  ensureStatus(snapshot, ["playing"]);

  const draft = cloneSnapshot(snapshot);

  if (draft.room.currentTurnPlayerId !== playerId) {
    throw new Error("Ainda não é a vez deste jogador.");
  }

  const player = draft.players.find((candidate) => candidate.id === playerId);

  if (!player || !player.isAlive || player.isSpectator) {
    throw new Error("Jogador não pode jogar carta.");
  }

  const selectedCard = player.hand.find((card) => card.id === cardId);

  if (!selectedCard) {
    throw new Error("Carta não encontrada na mão do jogador.");
  }

  const tableCard: TableCard = {
    id: crypto.randomUUID(),
    card: selectedCard,
    playerId,
    playedAt: nowIso(),
    trickNumber: draft.room.currentTrick,
  };

  const players = draft.players.map((candidate) =>
    candidate.id === playerId
      ? {
          ...candidate,
          hand: candidate.hand.filter((card) => card.id !== cardId),
        }
      : candidate
  );
  const tableCards = [...draft.gameState.tableCards, tableCard];
  const playedCards = [...draft.gameState.playedCards, tableCard];
  const activePlayers = getActivePlayers(players);
  const currentTrickCards = tableCards.filter(
    (card) => card.trickNumber === draft.room.currentTrick
  );

  const nextSnapshot: GameSnapshot = {
    ...draft,
    players,
    gameState: {
      ...draft.gameState,
      tableCards,
      playedCards,
    },
  };

  if (currentTrickCards.length < activePlayers.length) {
    const alreadyPlayedIds = new Set(currentTrickCards.map((card) => card.playerId));
    return updateRoom(nextSnapshot, {
      currentTurnPlayerId: getNextPlayerIdInOrder(players, playerId, alreadyPlayedIds),
    });
  }

  const winnerPlayerId = resolveTrickWithTieCancellation(currentTrickCards);
  const playersAfterTrick = players.map((candidate) =>
    candidate.id === winnerPlayerId
      ? {
          ...candidate,
          tricksWon: candidate.tricksWon + 1,
        }
      : candidate
  );

  const trickStarterPlayerId = winnerPlayerId ?? draft.room.trickStarterPlayerId;
  const snapshotAfterTrick: GameSnapshot = {
    ...nextSnapshot,
    players: playersAfterTrick,
    gameState: {
      ...nextSnapshot.gameState,
      tableCards: [],
      lastTrick: {
        trickNumber: draft.room.currentTrick,
        cards: currentTrickCards,
        winnerPlayerId,
        startedByPlayerId: draft.room.trickStarterPlayerId,
      },
    },
  };

  if (draft.room.currentTrick >= draft.room.handSize) {
    return finishRound(snapshotAfterTrick);
  }

  return updateRoom(snapshotAfterTrick, {
    currentTrick: draft.room.currentTrick + 1,
    currentTurnPlayerId: trickStarterPlayerId,
    trickStarterPlayerId,
  });
}

export function finishRound(snapshot: GameSnapshot): GameSnapshot {
  const draft = cloneSnapshot(snapshot);
  const roundResults: RoundPlayerResult[] = [];
  const eliminatedIds = new Set<string>();

  const playersAfterLives = draft.players.map((player) => {
    if (!player.isAlive || player.isSpectator) {
      return player;
    }

    const matchedBid = player.bid === player.tricksWon;
    const lostLife = matchedBid ? 0 : 1;
    const livesAfter = Math.max(0, player.lives - lostLife);
    const eliminated = livesAfter <= 0;

    if (eliminated) {
      eliminatedIds.add(player.id);
    }

    roundResults.push({
      playerId: player.id,
      name: player.name,
      bid: player.bid,
      tricksWon: player.tricksWon,
      matchedBid,
      livesBefore: player.lives,
      livesAfter,
      lostLife,
      eliminated,
    });

    return {
      ...player,
      lives: livesAfter,
    };
  });

  const snapshotWithLives: GameSnapshot = {
    ...draft,
    players: playersAfterLives,
    gameState: {
      ...draft.gameState,
      roundHistory: [
        ...draft.gameState.roundHistory,
        {
          round: draft.room.currentRound,
          handSize: draft.room.handSize,
          finishedAt: nowIso(),
          results: roundResults,
        },
      ],
    },
  };

  const snapshotWithEliminations = eliminatePlayers(snapshotWithLives, eliminatedIds);
  const winnerIds = checkWinners(snapshotWithEliminations);

  if (winnerIds.length > 0) {
    return finishAsCompleted(snapshotWithEliminations);
  }

  return updateRoom(
    {
      ...snapshotWithEliminations,
      players: snapshotWithEliminations.players.map((player) => ({
        ...player,
        hand: [],
      })),
      gameState: {
        ...snapshotWithEliminations.gameState,
        tableCards: [],
        deck: [],
      },
    },
    {
      status: "round_result",
      currentTurnPlayerId: null,
      trickStarterPlayerId: null,
    }
  );
}

export function eliminatePlayers(
  snapshot: GameSnapshot,
  playerIdsToEliminate?: Set<string>
): GameSnapshot {
  const draft = cloneSnapshot(snapshot);
  const idsToEliminate =
    playerIdsToEliminate ??
    new Set(
      draft.players
        .filter((player) => player.isAlive && !player.isSpectator && player.lives <= 0)
        .map((player) => player.id)
    );

  if (idsToEliminate.size === 0) {
    return draft;
  }

  const alreadyRanked = new Set(draft.gameState.ranking.map((entry) => entry.playerId));
  const activeBefore = getActivePlayers(draft.players).length;
  let place = activeBefore;
  const newRanking: RankingEntry[] = [];

  for (const player of draft.players) {
    if (idsToEliminate.has(player.id) && !alreadyRanked.has(player.id)) {
      newRanking.push({
        playerId: player.id,
        name: player.name,
        place,
        reason: "eliminated",
        round: draft.room.currentRound,
      });
      place -= 1;
    }
  }

  return {
    ...draft,
    players: draft.players.map((player) =>
      idsToEliminate.has(player.id)
        ? {
            ...player,
            isAlive: false,
            isSpectator: true,
            hand: [],
          }
        : player
    ),
    gameState: {
      ...draft.gameState,
      ranking: [...draft.gameState.ranking, ...newRanking],
    },
  };
}

export function checkWinners(snapshot: GameSnapshot): string[] {
  const activePlayers = getActivePlayers(snapshot.players);
  return activePlayers.length <= 2 ? activePlayers.map((player) => player.id) : [];
}

function finishAsCompleted(snapshot: GameSnapshot): GameSnapshot {
  const draft = cloneSnapshot(snapshot);
  const winnerIds = checkWinners(draft);
  const alreadyRanked = new Set(draft.gameState.ranking.map((entry) => entry.playerId));
  const winnerRanking = draft.players
    .filter((player) => winnerIds.includes(player.id) && !alreadyRanked.has(player.id))
    .map<RankingEntry>((player, index) => ({
      playerId: player.id,
      name: player.name,
      place: index + 1,
      reason: "winner",
      round: draft.room.currentRound,
    }));

  return updateRoom(
    {
      ...draft,
      players: draft.players.map((player) => ({
        ...player,
        hand: [],
      })),
      gameState: {
        ...draft.gameState,
        winners: winnerIds,
        ranking: [...winnerRanking, ...draft.gameState.ranking],
        tableCards: [],
        deck: [],
      },
    },
    {
      status: "finished",
      currentTurnPlayerId: null,
      trickStarterPlayerId: null,
    }
  );
}

export function resetGame(snapshot: GameSnapshot): GameSnapshot {
  const draft = cloneSnapshot(snapshot);

  return updateRoom(
    {
      ...draft,
      players: draft.players.map((player) => ({
        ...player,
        lives: STARTING_LIVES,
        isAlive: true,
        isSpectator: false,
        bid: null,
        tricksWon: 0,
        hand: [],
      })),
      gameState: createEmptyGameState(draft.room.id),
    },
    {
      status: "lobby",
      currentRound: 0,
      handSize: 0,
      currentTurnPlayerId: null,
      currentTrick: 0,
      trickStarterPlayerId: null,
    }
  );
}

export function reconnectPlayer(
  snapshot: GameSnapshot,
  playerId: string,
  name?: string
): GameSnapshot {
  const draft = cloneSnapshot(snapshot);

  return updateRoom(
    {
      ...draft,
      players: draft.players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              name: name?.trim() || player.name,
              isConnected: true,
            }
          : player
      ),
    },
    {}
  );
}

export function setPlayerConnection(
  snapshot: GameSnapshot,
  playerId: string,
  isConnected: boolean
): GameSnapshot {
  const draft = cloneSnapshot(snapshot);

  return updateRoom(
    {
      ...draft,
      players: draft.players.map((player) =>
        player.id === playerId ? { ...player, isConnected } : player
      ),
    },
    {}
  );
}

export function removeCardFromHand(hand: Card[], cardId: string): Card[] {
  return hand.filter((card) => card.id !== cardId);
}
