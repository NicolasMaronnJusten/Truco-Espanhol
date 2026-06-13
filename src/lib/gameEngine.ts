import { dealCards, generateDeck, shuffleDeck } from "./deck";
import { resolveTrickWithTieCancellation } from "./rules";
import type {
  Card,
  GameEvent,
  GameEventType,
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
export const DEFAULT_BID_TIME_LIMIT_SECONDS = 30;

export type BidValidationResult =
  | { isValid: true; player: Player }
  | { isValid: false; message: string };

function nowIso(): string {
  return new Date().toISOString();
}

function cloneSnapshot(snapshot: GameSnapshot): GameSnapshot {
  return structuredClone(snapshot);
}

function getActivePlayers(players: Player[]): Player[] {
  return players.filter((player) => player.isAlive && !player.isSpectator);
}

function canTakeTurn(player: Player): boolean {
  return (
    player.isAlive &&
    !player.isSpectator &&
    player.isConnected &&
    !player.isInactive &&
    !player.pendingKick
  );
}

function getTurnPlayers(players: Player[]): Player[] {
  return players.filter(canTakeTurn);
}

function getFallbackTableOrder(players: Player[]): string[] {
  return players.map((player) => player.id).reverse();
}

export function getTableOrder(snapshot: GameSnapshot): string[] {
  const playerIds = new Set(snapshot.players.map((player) => player.id));
  const storedOrder = snapshot.room.tableOrder ?? [];
  const tableOrder = storedOrder.filter(
    (playerId, index) => playerIds.has(playerId) && storedOrder.indexOf(playerId) === index
  );

  if (tableOrder.length === playerIds.size) {
    return tableOrder;
  }

  const fallbackOrder = getFallbackTableOrder(snapshot.players);

  if (tableOrder.length === 0) {
    return fallbackOrder;
  }

  const missingIds = fallbackOrder.filter((playerId) => !tableOrder.includes(playerId));
  return [...missingIds, ...tableOrder];
}

export function getNextPlayerToRight(
  currentPlayerId: string | null,
  tableOrder: string[],
  players: Player[],
  canUsePlayer: (player: Player) => boolean = canTakeTurn
): Player | null {
  if (tableOrder.length === 0) {
    return null;
  }

  const playerById = new Map(players.map((player) => [player.id, player]));
  const startIndex = currentPlayerId ? tableOrder.indexOf(currentPlayerId) : -1;

  for (let offset = 1; offset <= tableOrder.length; offset += 1) {
    const nextIndex =
      startIndex === -1 ? offset - 1 : (startIndex + offset) % tableOrder.length;
    const player = playerById.get(tableOrder[nextIndex]);

    if (player && canUsePlayer(player)) {
      return player;
    }
  }

  return null;
}

function getReplacementHostId(players: Player[], currentHostId: string): string {
  const candidates = players.filter((player) => player.id !== currentHostId);

  return (
    candidates.find(
      (player) =>
        !player.isSpectator &&
        player.isConnected &&
        !player.isInactive &&
        !player.pendingKick
    )?.id ??
    candidates.find((player) => !player.isSpectator && !player.pendingKick)?.id ??
    candidates.find(
      (player) => player.isConnected && !player.isInactive && !player.pendingKick
    )?.id ??
    candidates[0]?.id ??
    currentHostId
  );
}

function syncHostFlags(players: Player[], hostId: string): Player[] {
  return players.map((player) => ({
    ...player,
    isHost: player.id === hostId,
  }));
}

export function getBidTimeLimitSeconds(snapshot: GameSnapshot): number {
  const value = snapshot.room.bidTimeLimitSeconds;
  return Number.isFinite(value) && value >= 5 ? value : DEFAULT_BID_TIME_LIMIT_SECONDS;
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
    events: [],
  };
}

function createGameEvent(type: GameEventType, message: string, playerId?: string): GameEvent {
  return {
    id: crypto.randomUUID(),
    type,
    message,
    playerId,
    createdAt: nowIso(),
  };
}

function appendEvents(snapshot: GameSnapshot, events: GameEvent[]): GameSnapshot {
  if (events.length === 0) {
    return snapshot;
  }

  return {
    ...snapshot,
    gameState: {
      ...snapshot.gameState,
      events: [...(snapshot.gameState.events ?? []), ...events].slice(-30),
    },
  };
}

function getNextHandSize(currentHandSize: number, activePlayerCount: number): number {
  const maxHandSize = Math.max(1, Math.floor(40 / activePlayerCount));
  const nextHandSize = currentHandSize + 1;
  return nextHandSize > maxHandSize ? 1 : nextHandSize;
}

function getNextPlayerIdInOrder(
  players: Player[],
  tableOrder: string[],
  currentPlayerId: string,
  alreadyPlayedIds: Set<string>
): string | null {
  return (
    getNextPlayerToRight(
      currentPlayerId,
      tableOrder,
      players,
      (player) => canTakeTurn(player) && !alreadyPlayedIds.has(player.id)
    )?.id ?? null
  );
}

function getPlayerAfter(
  players: Player[],
  tableOrder: string[],
  previousPlayerId: string | null
): Player | null {
  return getNextPlayerToRight(previousPlayerId, tableOrder, players);
}

function getRoundStarterId(snapshot: GameSnapshot): string | null {
  const tableOrder = getTableOrder(snapshot);

  if (snapshot.room.currentRound === 0) {
    const activePlayers = getTurnPlayers(snapshot.players);
    const randomIndex = Math.floor(Math.random() * activePlayers.length);

    return activePlayers[randomIndex]?.id ?? null;
  }

  return getPlayerAfter(snapshot.players, tableOrder, snapshot.room.roundStarterPlayerId)?.id ?? null;
}

function getNextBidderId(
  players: Player[],
  tableOrder: string[],
  currentPlayerId: string
): string | null {
  return (
    getNextPlayerToRight(
      currentPlayerId,
      tableOrder,
      players,
      (player) => canTakeTurn(player) && player.bid === null
    )?.id ?? null
  );
}

function isLastBidder(snapshot: GameSnapshot, playerId: string): boolean {
  const pendingPlayers = getTurnPlayers(snapshot.players).filter((player) => player.bid === null);

  return pendingPlayers.length === 1 && pendingPlayers[0]?.id === playerId;
}

export function getForbiddenFinalBid(snapshot: GameSnapshot, playerId: string): number | null {
  if (snapshot.room.status !== "betting" || snapshot.room.handSize <= 1) {
    return null;
  }

  const activePlayers = getTurnPlayers(snapshot.players);

  if (!isLastBidder(snapshot, playerId)) {
    return null;
  }

  const currentBidTotal = activePlayers.reduce((total, player) => total + (player.bid ?? 0), 0);
  const forbiddenBid = snapshot.room.handSize - currentBidTotal;

  return forbiddenBid >= 0 && forbiddenBid <= snapshot.room.handSize ? forbiddenBid : null;
}

export function getAllowedBids(snapshot: GameSnapshot, playerId: string): number[] {
  const forbiddenBid = getForbiddenFinalBid(snapshot, playerId);

  return Array.from({ length: snapshot.room.handSize + 1 }, (_, bid) => bid).filter(
    (bid) => bid !== forbiddenBid
  );
}

export function validateBid(
  playerId: string,
  bid: number,
  snapshot: GameSnapshot
): BidValidationResult {
  if (snapshot.room.status !== "betting") {
    return { isValid: false, message: "Acao indisponivel neste estado da sala." };
  }

  const player = snapshot.players.find((candidate) => candidate.id === playerId);

  if (!player || !player.isAlive || player.isSpectator) {
    return { isValid: false, message: "Jogador nao pode palpitar." };
  }

  if (snapshot.room.currentTurnPlayerId !== playerId) {
    return { isValid: false, message: "Ainda nao e a vez deste jogador palpitar." };
  }

  if (player.bid !== null) {
    return { isValid: false, message: "Este jogador ja deu palpite nesta rodada." };
  }

  if (!Number.isInteger(bid) || bid < 0 || bid > snapshot.room.handSize) {
    return { isValid: false, message: "Palpite invalido para esta rodada." };
  }

  if (snapshot.room.handSize === 1) {
    return { isValid: true, player };
  }

  if (isLastBidder(snapshot, playerId) && bid === getForbiddenFinalBid(snapshot, playerId)) {
    return {
      isValid: false,
      message: `A soma dos palpites nao pode fechar ${snapshot.room.handSize}.`,
    };
  }

  return { isValid: true, player };
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
      roundStarterPlayerId: null,
      firstRoundStarterPlayerId: null,
      tableOrder: [host.id],
      bidTurnStartedAt: null,
      bidTimeLimitSeconds: DEFAULT_BID_TIME_LIMIT_SECONDS,
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
    isInactive: false,
    pendingKick: false,
    bid: null,
    tricksWon: 0,
    hand: [],
  }));
  const tableOrder = getTableOrder({ ...draft, players: resetPlayers });

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
      roundStarterPlayerId: null,
      firstRoundStarterPlayerId: null,
      tableOrder,
      bidTurnStartedAt: null,
      bidTimeLimitSeconds: getBidTimeLimitSeconds(draft),
      updatedAt: nowIso(),
    },
  };

  return startRound(resetSnapshot);
}

export function startRound(snapshot: GameSnapshot): GameSnapshot {
  ensureStatus(snapshot, ["lobby", "round_result"]);

  const draft = cloneSnapshot(snapshot);
  const activePlayers = getTurnPlayers(draft.players);

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
  const starterId = getRoundStarterId(draft);
  const firstRoundStarterPlayerId =
    draft.room.currentRound === 0 ? starterId : draft.room.firstRoundStarterPlayerId ?? null;
  const bidTurnStartedAt = nowIso();

  const players = draft.players.map((player) => {
    if (!canTakeTurn(player)) {
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
      roundStarterPlayerId: starterId,
      firstRoundStarterPlayerId,
      bidTurnStartedAt,
    }
  );
}

export function submitBid(snapshot: GameSnapshot, playerId: string, bid: number): GameSnapshot {
  ensureStatus(snapshot, ["betting"]);

  const draft = cloneSnapshot(snapshot);
  const validation = validateBid(playerId, bid, draft);

  if (!validation.isValid) {
    throw new Error(validation.message);
  }

  const { player } = validation;
  const players = draft.players.map((candidate) =>
    candidate.id === playerId ? { ...candidate, bid } : candidate
  );
  const nextBidderId = getNextBidderId(players, getTableOrder(draft), playerId);
  const cardLabel = bid === 1 ? "carta" : "cartas";

  return appendEvents(
    updateRoom(
      {
        ...draft,
        players,
      },
      !nextBidderId
        ? {
            status: "playing",
            currentTurnPlayerId: draft.room.trickStarterPlayerId,
            bidTurnStartedAt: null,
          }
        : {
            currentTurnPlayerId: nextBidderId,
            bidTurnStartedAt: nowIso(),
          }
    ),
    [createGameEvent("bid", `${player.name} cantou ${bid} ${cardLabel}`, player.id)]
  );
}

export function autoSubmitCurrentBid(snapshot: GameSnapshot): GameSnapshot {
  if (snapshot.room.status !== "betting" || !snapshot.room.currentTurnPlayerId) {
    return snapshot;
  }

  const currentPlayerId = snapshot.room.currentTurnPlayerId;
  const allowedBids = getAllowedBids(snapshot, currentPlayerId);
  const fallbackBid = allowedBids.includes(0) ? 0 : allowedBids[0];

  return submitBid(snapshot, currentPlayerId, fallbackBid ?? 0);
}

export function setBidTimeLimit(snapshot: GameSnapshot, seconds: number): GameSnapshot {
  ensureStatus(snapshot, ["lobby"]);

  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 120) {
    throw new Error("Tempo de palpite invalido.");
  }

  return updateRoom(snapshot, {
    bidTimeLimitSeconds: seconds,
  });
}

export function kickPlayer(
  snapshot: GameSnapshot,
  hostPlayerId: string,
  targetPlayerId: string
): GameSnapshot {
  const draft = cloneSnapshot(snapshot);
  const host = draft.players.find((player) => player.id === hostPlayerId);
  const target = draft.players.find((player) => player.id === targetPlayerId);

  if (!host || draft.room.hostId !== host.id) {
    throw new Error("Apenas o host pode expulsar jogadores.");
  }

  if (!target) {
    throw new Error("Jogador nao encontrado.");
  }

  if (target.id === host.id) {
    throw new Error("O host nao pode expulsar a si mesmo.");
  }

  if (draft.room.status === "lobby") {
    const players = draft.players.filter((player) => player.id !== target.id);

    return appendEvents(
      updateRoom(
        {
          ...draft,
          players,
        },
        {
          tableOrder: getTableOrder(draft).filter((playerId) => playerId !== target.id),
        }
      ),
      [createGameEvent("kick", `${target.name} foi expulso`, target.id)]
    );
  }

  let nextSnapshot = appendEvents(
    updateRoom(
      {
        ...draft,
        players: draft.players.map((player) =>
          player.id === target.id
            ? {
                ...player,
                isConnected: false,
                isInactive: true,
                pendingKick: true,
              }
            : player
        ),
      },
      {}
    ),
    [
      createGameEvent("inactive", `${target.name} esta inativo`, target.id),
      createGameEvent("kick", `${target.name} sera removido ao fim da rodada`, target.id),
    ]
  );

  if (nextSnapshot.room.status === "betting" && nextSnapshot.room.currentTurnPlayerId === target.id) {
    nextSnapshot = autoSubmitCurrentBid(nextSnapshot);
  }

  if (nextSnapshot.room.status === "playing" && nextSnapshot.room.currentTurnPlayerId === target.id) {
    const kickedPlayer = nextSnapshot.players.find((player) => player.id === target.id);
    const fallbackCard = kickedPlayer?.hand[0];

    if (fallbackCard) {
      nextSnapshot = playCard(nextSnapshot, target.id, fallbackCard.id);
    }
  }

  return nextSnapshot;
}

export function leavePlayer(snapshot: GameSnapshot, playerId: string): GameSnapshot {
  const draft = cloneSnapshot(snapshot);
  const target = draft.players.find((player) => player.id === playerId);

  if (!target) {
    return draft;
  }

  if (draft.room.status === "lobby") {
    const remainingPlayers = draft.players.filter((player) => player.id !== playerId);
    const hostId =
      draft.room.hostId === playerId
        ? getReplacementHostId(remainingPlayers, playerId)
        : draft.room.hostId;
    const tableOrder = getTableOrder(draft).filter((orderedPlayerId) => orderedPlayerId !== playerId);

    return appendEvents(
      updateRoom(
        {
          ...draft,
          players: syncHostFlags(remainingPlayers, hostId),
        },
        { hostId, tableOrder }
      ),
      [createGameEvent("inactive", `${target.name} saiu da sala`, target.id)]
    );
  }

  const players = draft.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          isConnected: false,
          isInactive: true,
        }
      : player
  );
  const hostId =
    draft.room.hostId === playerId ? getReplacementHostId(players, playerId) : draft.room.hostId;

  let nextSnapshot = appendEvents(
    updateRoom(
      {
        ...draft,
        players: syncHostFlags(players, hostId),
      },
      { hostId }
    ),
    [createGameEvent("inactive", `${target.name} saiu da sala`, target.id)]
  );

  if (nextSnapshot.room.status === "betting" && nextSnapshot.room.currentTurnPlayerId === target.id) {
    nextSnapshot = autoSubmitCurrentBid(nextSnapshot);
  }

  if (nextSnapshot.room.status === "playing" && nextSnapshot.room.currentTurnPlayerId === target.id) {
    const leavingPlayer = nextSnapshot.players.find((player) => player.id === target.id);
    const fallbackCard = leavingPlayer?.hand[0];

    if (fallbackCard) {
      nextSnapshot = playCard(nextSnapshot, target.id, fallbackCard.id);
    }
  }

  return nextSnapshot;
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
  const activePlayers = getTurnPlayers(players);
  const tableOrder = getTableOrder(draft);
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
      currentTurnPlayerId: getNextPlayerIdInOrder(
        players,
        tableOrder,
        playerId,
        alreadyPlayedIds
      ),
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

    const bid = player.bid ?? 0;
    const difference = Math.abs(bid - player.tricksWon);
    const matchedBid = difference === 0;
    const lostLife = difference;
    const livesAfter = Math.max(0, player.lives - lostLife);
    const eliminated = livesAfter <= 0;

    if (eliminated) {
      eliminatedIds.add(player.id);
    }

    roundResults.push({
      playerId: player.id,
      playerName: player.name,
      name: player.name,
      bid: player.bid,
      tricksWon: player.tricksWon,
      difference,
      matchedBid,
      livesBefore: player.lives,
      remainingLives: livesAfter,
      livesAfter,
      livesLost: lostLife,
      lostLife,
      wasEliminated: eliminated,
      eliminated,
    });

    return {
      ...player,
      lives: livesAfter,
    };
  });

  const roundEvents = roundResults.flatMap((result) => {
    const events = [];

    if (result.lostLife > 0) {
      const lifeLabel = result.lostLife === 1 ? "vida" : "vidas";
      events.push(
        createGameEvent(
          "life_lost",
          `${result.name} perdeu ${result.lostLife} ${lifeLabel}`,
          result.playerId
        )
      );
    }

    if (result.eliminated) {
      events.push(createGameEvent("eliminated", `${result.name} foi eliminado`, result.playerId));
    }

    return events;
  });

  const snapshotWithLives: GameSnapshot = appendEvents(
    {
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
    },
    [createGameEvent("round_end", "Rodada encerrada"), ...roundEvents]
  );

  const kickedPlayerIds = new Set(
    snapshotWithLives.players.filter((player) => player.pendingKick).map((player) => player.id)
  );
  const snapshotWithEliminations = eliminatePlayers(snapshotWithLives, eliminatedIds);
  const snapshotWithoutKickedPlayers =
    kickedPlayerIds.size > 0
      ? appendEvents(
          {
            ...snapshotWithEliminations,
            room: {
              ...snapshotWithEliminations.room,
              tableOrder: getTableOrder(snapshotWithEliminations).filter(
                (playerId) => !kickedPlayerIds.has(playerId)
              ),
            },
            players: snapshotWithEliminations.players.filter(
              (player) => !kickedPlayerIds.has(player.id)
            ),
          },
          snapshotWithEliminations.players
            .filter((player) => kickedPlayerIds.has(player.id))
            .map((player) => createGameEvent("kick", `${player.name} foi expulso`, player.id))
        )
      : snapshotWithEliminations;
  const winnerIds = checkWinners(snapshotWithoutKickedPlayers);

  if (winnerIds.length > 0) {
    return finishAsCompleted(snapshotWithoutKickedPlayers);
  }

  return updateRoom(
    {
      ...snapshotWithoutKickedPlayers,
      players: snapshotWithoutKickedPlayers.players.map((player) => ({
        ...player,
        hand: [],
      })),
      gameState: {
        ...snapshotWithoutKickedPlayers.gameState,
        tableCards: [],
        deck: [],
      },
    },
    {
      status: "round_result",
      currentTurnPlayerId: null,
      trickStarterPlayerId: null,
      bidTurnStartedAt: null,
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
      bidTurnStartedAt: null,
    }
  );
}

export function resetGame(snapshot: GameSnapshot): GameSnapshot {
  const draft = cloneSnapshot(snapshot);
  const players = draft.players.map((player) => ({
    ...player,
    lives: STARTING_LIVES,
    isAlive: true,
    isSpectator: false,
    isInactive: false,
    pendingKick: false,
    bid: null,
    tricksWon: 0,
    hand: [],
  }));

  return updateRoom(
    {
      ...draft,
      players,
      gameState: createEmptyGameState(draft.room.id),
    },
    {
      status: "lobby",
      currentRound: 0,
      handSize: 0,
      currentTurnPlayerId: null,
      currentTrick: 0,
      trickStarterPlayerId: null,
      roundStarterPlayerId: null,
      firstRoundStarterPlayerId: null,
      tableOrder: getTableOrder({ ...draft, players }),
      bidTurnStartedAt: null,
      bidTimeLimitSeconds: getBidTimeLimitSeconds(draft),
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
              isInactive: false,
              lastSeenAt: nowIso(),
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
  const targetPlayer = draft.players.find((player) => player.id === playerId);
  const players = draft.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          isConnected,
          isInactive: !isConnected,
          lastSeenAt: isConnected ? nowIso() : player.lastSeenAt,
        }
      : player
  );
  const hostId =
    !isConnected && draft.room.hostId === playerId
      ? getReplacementHostId(players, playerId)
      : draft.room.hostId;

  return appendEvents(
    updateRoom(
      {
        ...draft,
        players: syncHostFlags(players, hostId),
      },
      { hostId }
    ),
    !isConnected && targetPlayer && targetPlayer.isConnected
      ? [createGameEvent("inactive", `${targetPlayer.name} esta inativo`, targetPlayer.id)]
      : []
  );
}

export function removeCardFromHand(hand: Card[], cardId: string): Card[] {
  return hand.filter((card) => card.id !== cardId);
}
