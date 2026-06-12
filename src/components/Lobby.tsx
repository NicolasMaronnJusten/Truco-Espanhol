import { Copy, LogOut, Play, Share2, Users } from "lucide-react";
import { PlayerList } from "./PlayerList";
import type { VisibleGameSnapshot } from "../types/game";

type LobbyProps = {
  snapshot: VisibleGameSnapshot;
  currentPlayerId: string | null;
  onStartGame: () => void;
  onLeave: () => void;
  isBusy?: boolean;
};

export function Lobby({
  snapshot,
  currentPlayerId,
  onStartGame,
  onLeave,
  isBusy = false,
}: LobbyProps) {
  const seatedPlayers = snapshot.players.filter((player) => !player.isSpectator);
  const currentPlayer = snapshot.players.find((player) => player.id === currentPlayerId);
  const isHost = currentPlayer?.id === snapshot.room.hostId;
  const canStart = isHost && seatedPlayers.length >= 3;

  async function copyCode() {
    await navigator.clipboard.writeText(snapshot.room.code);
  }

  async function shareInvite() {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${snapshot.room.code}`;

    if (navigator.share) {
      await navigator.share({
        title: "Fodinha Online",
        text: `Entra na minha sala de Fodinha: ${snapshot.room.code}`,
        url: inviteUrl,
      });
      return;
    }

    await navigator.clipboard.writeText(inviteUrl);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-white">Fodinha</h1>
          <p className="text-sm text-white/65">Sala privada para jogar com amigos.</p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
        >
          <LogOut size={16} />
          sair
        </button>
      </header>

      <section className="felt-panel rounded-md p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-200/70">Código da sala</p>
            <p className="mt-1 font-mono text-3xl font-bold text-amber-100">
              {snapshot.room.code}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-mesa-950 transition hover:bg-amber-100"
            >
              <Copy size={16} />
              copiar
            </button>
            <button
              type="button"
              onClick={shareInvite}
              className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Share2 size={16} />
              compartilhar
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="felt-panel rounded-md p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
              <Users size={20} />
              Jogadores
            </h2>
            <span className="text-sm text-white/65">{seatedPlayers.length}/10</span>
          </div>
          <PlayerList
            players={snapshot.players}
            hostId={snapshot.room.hostId}
            currentPlayerId={currentPlayerId}
          />
        </section>

        <aside className="felt-panel rounded-md p-5">
          <h2 className="text-lg font-semibold text-white">Iniciar partida</h2>
          <p className="mt-2 text-sm text-white/65">
            Mínimo 3 jogadores. O host controla o início da partida e as próximas rodadas.
          </p>
          {seatedPlayers.length < 3 ? (
            <p className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
              Aguardando pelo menos 3 jogadores.
            </p>
          ) : null}
          <button
            type="button"
            disabled={!canStart || isBusy}
            onClick={onStartGame}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-4 py-3 font-bold text-mesa-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Play size={18} />
            iniciar partida
          </button>
        </aside>
      </div>
    </main>
  );
}
