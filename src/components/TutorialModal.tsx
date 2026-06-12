import { X } from "lucide-react";

type TutorialModalProps = {
  open: boolean;
  onClose: () => void;
};

export function TutorialModal({ open, onClose }: TutorialModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md border border-white/15 bg-mesa-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">Como funciona</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md border border-white/15 text-white transition hover:bg-white/10"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 text-sm leading-6 text-white/75">
          <p>
            Cada jogador começa com 3 vidas. Em toda rodada, todos fazem um palpite
            antes de jogar as cartas. Quem acertar exatamente quantas tricks ganhou
            mantém as vidas; quem errar perde 1 vida.
          </p>
          <p>
            Na rodada de 1 carta, você não vê a própria carta e vê as cartas dos
            outros jogadores. Da rodada de 2 cartas em diante, você vê suas próprias
            cartas e não vê as cartas dos adversários.
          </p>
          <p>
            Empates anulam cartas do mesmo poder. Se as cartas mais fortes empatarem,
            elas saem da disputa e a maior carta restante vence a trick. Se todas
            empatarem, ninguém ganha a trick.
          </p>
        </div>
      </section>
    </div>
  );
}
