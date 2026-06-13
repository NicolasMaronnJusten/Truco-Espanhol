import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Timer, XCircle } from "lucide-react";
import type { VisibleGameSnapshot } from "../types/game";

const AUTO_ADVANCE_SECONDS = 5;

type RoundResultProps = {
  snapshot: VisibleGameSnapshot;
  isHost: boolean;
  onNextRound: () => void | Promise<void>;
  isBusy?: boolean;
};

export function RoundResult({
  snapshot,
  isHost,
  onNextRound,
  isBusy = false,
}: RoundResultProps) {
  const roundHistory = snapshot.gameState.roundHistory;
  const round = roundHistory[roundHistory.length - 1];
  const roundKey = round?.finishedAt ?? null;
  const isBusyRef = useRef(isBusy);
  const onNextRoundRef = useRef(onNextRound);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_ADVANCE_SECONDS);
  const lostLifeResults = useMemo(
    () => round?.results.filter((result) => result.lostLife > 0) ?? [],
    [round]
  );

  useEffect(() => {
    isBusyRef.current = isBusy;
    onNextRoundRef.current = onNextRound;
  }, [isBusy, onNextRound]);

  useEffect(() => {
    if (!roundKey || snapshot.room.status !== "round_result") {
      return undefined;
    }

    setSecondsLeft(AUTO_ADVANCE_SECONDS);

    const intervalId = window.setInterval(() => {
      setSecondsLeft((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1000);

    const timeoutId = window.setTimeout(() => {
      if (isHost && !isBusyRef.current) {
        void onNextRoundRef.current();
      }
    }, AUTO_ADVANCE_SECONDS * 1000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [isHost, roundKey, snapshot.room.status]);

  if (!round || snapshot.room.status !== "round_result") {
    return null;
  }

  return (
    <section className="felt-panel rounded-md p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Rodada encerrada</h2>
          <p className="text-sm text-white/65">
            Rodada {round.round}, {round.handSize} carta(s)
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm font-semibold text-amber-100">
          <Timer size={16} />
          proxima rodada em {secondsLeft}s
        </div>
        {isHost ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={onNextRound}
            className="inline-flex items-center gap-2 rounded-md bg-amber-300 px-4 py-2 font-bold text-mesa-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ArrowRight size={18} />
            próxima rodada
          </button>
        ) : null}
      </div>
      <div className="mb-4 rounded-md border border-red-200/20 bg-red-400/10 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-red-100/80">
          Perderam vida
        </h3>
        {lostLifeResults.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {lostLifeResults.map((result) => (
              <span
                key={result.playerId}
                className="rounded-md border border-red-200/25 bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-50"
              >
                {result.name} -{result.lostLife} {result.lostLife === 1 ? "vida" : "vidas"}
                {result.eliminated ? " - eliminado" : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-red-50/75">Ninguem perdeu vida nesta rodada.</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/65">
              <th className="py-2 pr-3 font-medium">Jogador</th>
              <th className="py-2 pr-3 font-medium">Palpite</th>
              <th className="py-2 pr-3 font-medium">Tricks feitas</th>
              <th className="py-2 pr-3 font-medium">Diferença</th>
              <th className="py-2 pr-3 font-medium">Resultado</th>
              <th className="py-2 pr-3 font-medium">Vidas perdidas</th>
              <th className="py-2 pr-3 font-medium">Vidas</th>
            </tr>
          </thead>
          <tbody>
            {round.results.map((result) => (
              <tr key={result.playerId} className="border-b border-white/5 text-white">
                <td className="py-3 pr-3 font-semibold">{result.name}</td>
                <td className="py-3 pr-3">{result.bid ?? "-"}</td>
                <td className="py-3 pr-3">{result.tricksWon}</td>
                <td className="py-3 pr-3">
                  {result.difference ?? Math.abs((result.bid ?? 0) - result.tricksWon)}
                </td>
                <td className="py-3 pr-3">
                  <span className="inline-flex items-center gap-1">
                    {result.matchedBid ? (
                      <CheckCircle2 size={16} className="text-emerald-300" />
                    ) : (
                      <XCircle size={16} className="text-red-300" />
                    )}
                    {result.matchedBid ? "acertou" : "errou"}
                  </span>
                </td>
                <td className="py-3 pr-3">{result.lostLife}</td>
                <td className="py-3 pr-3">
                  {result.livesAfter}
                  {result.eliminated ? " · eliminado" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
