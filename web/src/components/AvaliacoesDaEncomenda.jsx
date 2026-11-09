// Numa encomenda entregue: avaliar o produtor e cada produto (uma avaliação por item)
import { useState } from 'react';
import { api } from '../api/client';
import FormAvaliacao from './FormAvaliacao.jsx';

export default function AvaliacoesDaEncomenda({ encomenda, minhas, token, aoAvaliar }) {
  const [aberto, setAberto] = useState(null); // chave do item com o formulário aberto

  // Uma linha por produto distinto, mais o produtor (produto: null)
  const itens = [{ chave: 'produtor', produto: null, rotulo: `Produtor: ${encomenda.produtor.nome}` }];
  for (const l of encomenda.linhas) {
    if (l.produto && !itens.some((i) => i.produto === l.produto)) {
      itens.push({ chave: l.produto, produto: l.produto, rotulo: l.nome });
    }
  }

  const feita = (produto) =>
    minhas.find((r) => r.encomenda === encomenda.id && (r.produto ?? null) === produto);

  async function enviar(item, { classificacao, comentario }) {
    const nova = await api('/reviews', {
      metodo: 'POST',
      token,
      corpo: {
        encomenda: encomenda.id,
        ...(item.produto ? { produto: item.produto } : {}),
        classificacao,
        ...(comentario ? { comentario } : {}),
      },
    });
    aoAvaliar(nova);
    setAberto(null);
  }

  return (
    <section aria-label="Avaliações da encomenda" className="mt-3 pt-3 border-top">
      <h2 className="h6">Avaliar</h2>
      <ul className="list-unstyled mb-0">
        {itens.map((item) => {
          const r = feita(item.produto);
          return (
            <li key={item.chave} className="mb-2">
              <div className="d-flex justify-content-between align-items-center gap-2">
                <span>{item.rotulo}</span>
                {r ? (
                  <span className="small texto-secundario">Avaliado: ★ {r.classificacao}</span>
                ) : (
                  <button type="button" className="btn btn-outline-success btn-sm"
                    onClick={() => setAberto(aberto === item.chave ? null : item.chave)}>
                    Avaliar
                  </button>
                )}
              </div>
              {!r && aberto === item.chave && (
                <FormAvaliacao
                  rotulo={item.rotulo}
                  aoEnviar={(dados) => enviar(item, dados)}
                  aoCancelar={() => setAberto(null)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
