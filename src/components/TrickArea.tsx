import { PlayingCard } from "./Card";
import type { VisibleGameSnapshot } from "../types/game";

type TrickAreaProps = {
  snapshot: VisibleGameSnapshot;
};

export function TrickArea({ snapshot }: TrickAreaProps) {
  const playerNames = new Map(snapshot.players.map((player) => [player.id, player.name]));
  const lastTrick = snapshot.gameState.lastTrick;
  const winnerName = lastTrick?.winnerPlayerId
    ? playerNames.get(lastTrick.winnerPlayerId)
    : null;

  return (
    <section className="table-surface min-h-72 rounded-md border border-white/10 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-white">Cartas na mesa</h2>
          <p className="text-sm text-white/65">
            Trick {snapshot.room.currentTrick || "-"} de {snapshot.room.handSize || "-"}
          </p>
        </div>
      </div>
      <div className="flex min-h-40 flex-wrap items-center gap-4">
        {snapshot.gameState.tableCards.length > 0 ? (
          snapshot.gameState.tableCards.map((tableCard) => (
            <div key={tableCard.id} className="space-y-2">
              <PlayingCard card={tableCard.card} />
              <p className="max-w-28 truncate text-center text-xs font-semibold text-white/80">
                {playerNames.get(tableCard.playerId)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-white/60">Aguardando a próxima carta.</p>
        )}
      </div>
      {lastTrick ? (
        <div className="mt-5 rounded-md border border-white/10 bg-black/15 p-3">
          <p className="mb-2 text-sm font-semibold text-white">
            Última trick: {winnerName ? `${winnerName} ganhou a trick` : "ninguém ganhou"}
          </p>
          <div className="flex flex-wrap gap-2">
            {lastTrick.cards.map((tableCard) => (
              <div key={tableCard.id} className="space-y-1">
                <PlayingCard card={tableCard.card} compact />
                <p className="max-w-20 truncate text-center text-[0.68rem] text-white/65">
                  {playerNames.get(tableCard.playerId)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
