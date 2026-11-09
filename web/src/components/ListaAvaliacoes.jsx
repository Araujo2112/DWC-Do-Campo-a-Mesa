import { useState } from 'react';

// aoDenunciar(id) devolve uma Promise; sem a função, não aparece o botão "Denunciar".
export default function ListaAvaliacoes({ avaliacoes, aoDenunciar }) {
  const [estado, setEstado] = useState({}); // id -> 'enviada' | texto de erro

  async function denunciar(id) {
    try {
      await aoDenunciar(id);
      setEstado((s) => ({ ...s, [id]: 'enviada' }));
    } catch (err) {
      setEstado((s) => ({ ...s, [id]: err.status ? err.message : 'Não foi possível contactar o servidor' }));
    }
  }

  if (avaliacoes.length === 0) return <p className="texto-secundario">Ainda sem avaliações.</p>;

  return (
    <ul className="list-group">
      {avaliacoes.map((a) => (
        <li key={a.id} className="list-group-item">
          <div className="d-flex justify-content-between gap-2">
            <strong>{a.autor.nome}</strong>
            <span aria-label={`${a.classificacao} em 5`}>{'★'.repeat(a.classificacao)}</span>
          </div>
          {a.comentario && <p className="mb-1">{a.comentario}</p>}
          <div className="d-flex justify-content-between align-items-center">
            <span className="small texto-secundario">{new Date(a.criadoEm).toLocaleDateString('pt-PT')}</span>
            {aoDenunciar && estado[a.id] !== 'enviada' && (
              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => denunciar(a.id)}>
                Denunciar
              </button>
            )}
            {estado[a.id] === 'enviada' && <span className="small texto-secundario">Denúncia enviada</span>}
          </div>
          {estado[a.id] && estado[a.id] !== 'enviada' && (
            <div className="small text-danger" role="alert">{estado[a.id]}</div>
          )}
        </li>
      ))}
    </ul>
  );
}
