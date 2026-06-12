import type { RoomStatus, VisiblePlayer } from "../types/game";

type BettingPanelProps = {
  handSize: number;
  status: RoomStatus;
  player?: VisiblePlayer;
  onSubmitBid: (bid: number) => void;
  disabled?: boolean;
};

export function BettingPanel({
  handSize,
  status,
  player,
  onSubmitBid,
  disabled = false,
}: BettingPanelProps) {
  if (status !== "betting" || !player || player.isSpectator || !player.isAlive) {
    return null;
  }

  const hasBid = player.bid !== null;

  return (
    <section className="rounded-md border border-amber-200/20 bg-amber-200/10 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-amber-100">
          {hasBid ? "Aguardando outros jogadores apostarem" : "Sua vez de apostar"}
        </h2>
        <span className="text-sm text-amber-100/70">0 até {handSize}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: handSize + 1 }).map((_, bid) => (
          <button
            key={bid}
            type="button"
            disabled={disabled || hasBid}
            className="grid h-11 w-11 place-items-center rounded-md border border-amber-200/40 bg-amber-100 text-sm font-bold text-mesa-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onSubmitBid(bid)}
          >
            {bid}
          </button>
        ))}
      </div>
    </section>
  );
}
