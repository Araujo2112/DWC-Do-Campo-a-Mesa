// Estado global do carrinho
import { createContext, useContext, useMemo, useState } from 'react';

const CarrinhoContext = createContext(null);

export function CarrinhoProvider({ children }) {
  const [linhas, setLinhas] = useState([]); // [{ produto, quantidade }]

  function adicionar(produto, quantidade = 1) {
    setLinhas((atual) => {
      const existe = atual.find((l) => l.produto._id === produto._id);
      if (existe) {
        return atual.map((l) => l.produto._id === produto._id
          ? { ...l, quantidade: l.quantidade + quantidade } : l);
      }
      return [...atual, { produto, quantidade }];
    });
  }

  function alterar(produtoId, quantidade) {
    if (!Number.isInteger(quantidade) || quantidade < 1) return;
    setLinhas((atual) => atual.map((l) => l.produto._id === produtoId ? { ...l, quantidade } : l));
  }

  function remover(produtoId) {
    setLinhas((atual) => atual.filter((l) => l.produto._id !== produtoId));
  }

  function esvaziar() {
    setLinhas([]);
  }

  const total = useMemo(
    () => linhas.reduce((s, l) => s + l.produto.preco * l.quantidade, 0), [linhas]);

  return (
    <CarrinhoContext.Provider value={{ linhas, adicionar, alterar, remover, esvaziar, total }}>
      {children}
    </CarrinhoContext.Provider>
  );
}

export const useCarrinho = () => useContext(CarrinhoContext);