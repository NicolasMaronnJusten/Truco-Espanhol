# Fodinha Online

Jogo web multiplayer casual de cartas para jogar com amigos pelo navegador.
Não envolve dinheiro real, apostas reais, cassino ou prêmio financeiro.

## Setup

1. Instale Node.js 18+.
2. Instale dependências:

```bash
npm install
```

3. Crie `.env` a partir de `.env.example`:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
VITE_SUPABASE_ALLOW_SPECTATORS_AFTER_START=true
```

4. No Supabase, execute `supabase/schema.sql` no SQL Editor.
5. Em Database > Replication, garanta que a tabela `rooms` esteja publicada para Realtime.
6. Rode o app:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Observação de segurança

Este MVP filtra as cartas na interface com `getVisibleGameStateForPlayer`.
Para uma versão competitiva contra clientes não confiáveis, mova o embaralhamento,
a distribuição e as validações de ação para Edge Functions/RPC no Supabase.
