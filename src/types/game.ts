export type Suit = "espadas" | "ouro" | "calice" | "paus";

export type CardValue =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "10"
  | "11"
  | "12";

export type RoomStatus =
  | "lobby"
  | "betting"
  | "playing"
  | "round_result"
  | "finished";

export type Card = {
  id: string;
  suit: Suit;
  value: CardValue;
  label: string;
  power: number;
};

export type TableCard = {
  id: string;
  card: Card;
  playerId: string;
  playedAt: string;
  trickNumber: number;
};

export type Room = {
  id: string;
  code: string;
  hostId: string;
  status: RoomStatus;
  currentRound: number;
  handSize: number;
  currentTurnPlayerId: string | null;
  currentTrick: number;
  trickStarterPlayerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Player = {
  id: string;
  roomId: string;
  name: string;
  lives: number;
  isAlive: boolean;
  isHost: boolean;
  isConnected: boolean;
  isSpectator: boolean;
  bid: number | null;
  tricksWon: number;
  hand: Card[];
  joinedAt: string;
};

export type RoundPlayerResult = {
  playerId: string;
  name: string;
  bid: number | null;
  tricksWon: number;
  matchedBid: boolean;
  livesBefore: number;
  livesAfter: number;
  lostLife: number;
  eliminated: boolean;
};

export type RoundHistoryEntry = {
  round: number;
  handSize: number;
  finishedAt: string;
  results: RoundPlayerResult[];
};

export type RankingEntry = {
  playerId: string;
  name: string;
  place: number;
  reason: "winner" | "eliminated";
  round: number;
};

export type LastTrick = {
  trickNumber: number;
  cards: TableCard[];
  winnerPlayerId: string | null;
  startedByPlayerId: string | null;
};

export type GameState = {
  roomId: string;
  deck: Card[];
  tableCards: TableCard[];
  playedCards: TableCard[];
  roundHistory: RoundHistoryEntry[];
  winners: string[];
  ranking: RankingEntry[];
  lastTrick: LastTrick | null;
};

export type GameSnapshot = {
  room: Room;
  players: Player[];
  gameState: GameState;
};

export type VisiblePlayer = Omit<Player, "hand"> & {
  hand: Card[];
  hiddenCardCount: number;
};

export type VisibleGameSnapshot = Omit<GameSnapshot, "players"> & {
  players: VisiblePlayer[];
};

export type RoomRecord = {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  state: GameSnapshot;
  created_at: string;
  updated_at: string;
};
