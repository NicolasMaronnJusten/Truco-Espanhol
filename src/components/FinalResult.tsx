import { Home, RotateCcw, Trophy } from "lucide-react";
import type { VisibleGameSnapshot } from "../types/game";

type FinalResultProps = {
  snapshot: VisibleGameSnapshot;
  currentPlayerIsHost: boolean;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
  isBusy?: boolean;
};

export function FinalResult({
  snapshot,
  currentPlayerIsHost,
  onPlayAgain,
  onBackToLobby,
  isBusy = false,
}: FinalResultProps) {
  const winners = snapshot.players.filter((player) =>
    snapshot.gameState.winners.includes(player.id)
  );
  const eliminated = snapshot.gameState.ranking.filter((entry) => entry.reason === "eliminated");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="felt-panel rounded-md p-6 text-center">
        <Trophy className="mx-auto text-amber-300" size={42} />
        <h1 className="mt-3 font-display text-4xl font-bold text-white">Fim da partida</h1>
        <p className="mt-2 text-white/65">Os 2 últimos jogadores vivos são os vencedores.</p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="felt-panel rounded-md p-5">
          <h2 className="mb-4 text-xl font-semibold text-white">Vencedores</h2>
          <div className="space-y-3">
            {winners.map((winner) => (
              <div
                key={winner.id}
                className="rounded-md border border-amber-300/25 bg-amber-300/10 p-4"
              >
                <p className="font-semibold text-amber-100">{winner.name}</p>
                <p className="text-sm text-white/65">{winner.lives} vidas restantes</p>
              </div>
            ))}
          </div>
        </div>

        <div className="felt-panel rounded-md p-5">
          <h2 className="mb-4 text-xl font-semibold text-white">Ranking final</h2>
          <div className="space-y-2">
            {snapshot.gameState.ranking.map((entry) => (
              <div
                key={`${entry.playerId}-${entry.reason}`}
                className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.045] p-3"
              >
                <span className="font-semibold text-white">{entry.name}</span>
                <span className="text-sm text-white/65">
                  {entry.reason === "winner" ? `${entry.place}º vencedor` : "eliminado"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="felt-panel rounded-md p-5">
        <h2 className="mb-3 text-xl font-semibold text-white">Eliminados</h2>
        {eliminated.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {eliminated.map((entry) => (
              <span
                key={entry.playerId}
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-white/75"
              >
                {entry.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/65">Ninguém foi eliminado antes do fim.</p>
        )}
      </section>

      {currentPlayerIsHost ? (
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            disabled={isBusy}
            onClick={onPlayAgain}
            className="inline-flex items-center gap-2 rounded-md bg-amber-300 px-4 py-3 font-bold text-mesa-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw size={18} />
            jogar novamente
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onBackToLobby}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 px-4 py-3 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Home size={18} />
            voltar ao lobby
          </button>
        </div>
      ) : null}
    </main>
  );
}
