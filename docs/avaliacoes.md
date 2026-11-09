# Avaliações: o que vem do enunciado e o que decidi eu

## Pedido pelo enunciado (PDF e esqueleto)

- O comprador avalia produtos e produtores depois da entrega.
- O administrador modera avaliações e conteúdos (painel "Avaliações denunciadas" com Manter e Ocultar).
- O botão "Avaliar" aparece nas encomendas entregues.
- O esqueleto já trazia o modelo `Review` (`classificacao` de 1 a 5, `denuncias`, `visivel`) e as rotas `POST /reviews`, `GET /reviews` e `POST /reviews/:id/denuncia`.
- A média do produtor na página pública; o mockup do catálogo mostra a média nos cartões.

## Decisões minhas

- Uma avaliação ao produtor e uma por cada produto da encomenda (decisão minha).
- Proposta do Claude, aprovada por mim:
  - Lista `denunciadoPor` embebida: cada utilizador denuncia uma avaliação uma só vez (um contador simples deixava uma pessoa esconder qualquer avaliação).
  - Estados `ok`, `denunciada`, `revista`, `oculta` no campo `moderacao` (substitui `visivel` e `denuncias`).
  - "Manter" marca a avaliação como `revista`: novas denúncias já não a põem na fila. "Ocultar" tira-a das listagens e da média.
  - O autor não pode denunciar a própria avaliação (403).
  - Índice único `encomenda + produto`: o servidor recusa a avaliação repetida, mesmo com pedidos simultâneos.
  - A média do produtor só conta as avaliações ao produtor; a média de cada produto conta as avaliações desse produto.
  - A denúncia é uma única operação atómica (`findOneAndUpdate` com pipeline), pela mesma razão da licitação.
  - Comentário com máximo de 500 caracteres.
- O corpo do PATCH de moderação passou de `{ visivel: false }` para `{ acao: 'ocultar' | 'manter' }`.

## Embedding vs linking (para o relatório)

- Avaliações em coleção própria (referenciam autor, produtor, produto e encomenda): crescem sem limite e são consultadas por produtor e por produto.
- `denunciadoPor` embebido: é pequeno e é sempre lido com a avaliação.
