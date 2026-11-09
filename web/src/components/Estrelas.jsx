// Média de avaliações: "★ 4,5 (12)" ou "Sem avaliações"
export default function Estrelas({ media, total }) {
  if (media === null || media === undefined) return <span>Sem avaliações</span>;
  return <span>★ {media.toLocaleString('pt-PT')} ({total})</span>;
}
