import { Timer } from "lucide-react";
import type { RoomStatus, VisiblePlayer } from "../types/game";

type BettingPanelProps = {
  handSize: number;
  status: RoomStatus;
  player?: VisiblePlayer;
  currentBidderName?: string;
  forbiddenBid?: number | null;
  secondsLeft?: number | null;
  isTurn: boolean;
  onSubmitBid: (bid: number) => void;
  disabled?: boolean;
};

export function BettingPanel({
  handSize,
  status,
  player,
  currentBidderName,
  forbiddenBid = null,
  secondsLeft = null,
  isTurn,
  onSubmitBid,
  disabled = false,
}: BettingPanelProps) {
  if (status !== "betting" || !player || player.isSpectator || !player.isAlive) {
    return null;
  }

  const hasBid = player.bid !== null;
  const statusText = hasBid
    ? `Seu palpite: voce fara ${player.bid} de ${handSize}`
    : isTurn
      ? "Sua vez de palpitar"
      : `Aguardando palpite de ${currentBidderName ?? "outro jogador"}`;

  return (
    <section className="rounded-md border border-amber-200/20 bg-amber-200/10 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-amber-100">{statusText}</h2>
          <p className="mt-1 text-sm text-amber-100/70">
            Escolha quantas tricks voce fara com {handSize} carta(s).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {secondsLeft !== null ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-100/30 px-2 py-1 text-sm font-semibold text-amber-100">
              <Timer size={15} />
              {secondsLeft}s
            </span>
          ) : null}
          <span className="text-sm text-amber-100/70">0 ate {handSize}</span>
        </div>
      </div>

      {forbiddenBid !== null && !hasBid ? (
        <p className="mb-3 rounded-md border border-red-200/25 bg-red-400/10 px-3 py-2 text-sm text-red-50">
          O ultimo palpite nao pode fazer a soma fechar {handSize}; o {forbiddenBid} esta bloqueado.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: handSize + 1 }).map((_, bid) => {
          const bidIsForbidden = bid === forbiddenBid;

          return (
            <button
              key={bid}
              type="button"
              disabled={disabled || hasBid || !isTurn || bidIsForbidden}
              className="grid h-11 w-11 place-items-center rounded-md border border-amber-200/40 bg-amber-100 text-sm font-bold text-mesa-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onSubmitBid(bid)}
              title={bidIsForbidden ? "Soma proibida nesta rodada" : `${bid} trick(s)`}
            >
              {bid}
            </button>
          );
        })}
      </div>
    </section>
  );
}
