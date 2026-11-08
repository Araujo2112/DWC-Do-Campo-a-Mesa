// Estado global do carrinho
import { createContext, useContext, useMemo, useState } from 'react';

const CarrinhoContext = createContext(null);

export function CarrinhoProvider({ children }) {
  const [linhas, setLinhas] = useState([]); // [{ produto, quantidade }]

  const quantidadeDe = (produtoId) =>
    linhas.find((l) => l.produto._id === produtoId)?.quantidade ?? 0;

  // Devolve false se a quantidade pedida passasse o stock do produto (nesse caso não adiciona).
  function adicionar(produto, quantidade = 1) {
    const limite = produto.stock ?? Infinity;
    if (quantidadeDe(produto._id) + quantidade > limite) return false;

    setLinhas((atual) => {
      const existe = atual.find((l) => l.produto._id === produto._id);
      if (existe) {
        return atual.map((l) => l.produto._id === produto._id
          ? { ...l, produto, quantidade: l.quantidade + quantidade } : l);
      }
      return [...atual, { produto, quantidade }];
    });
    return true;
  }

  function alterar(produtoId, quantidade) {
    if (!Number.isInteger(quantidade) || quantidade < 1) return;
    setLinhas((atual) => atual.map((l) => l.produto._id === produtoId
      ? { ...l, quantidade: Math.min(quantidade, l.produto.stock ?? Infinity) } : l));
  }

  function remover(produtoId) {
    setLinhas((atual) => atual.filter((l) => l.produto._id !== produtoId));
  }

  function esvaziar() {
    setLinhas([]);
  }

  const total = useMemo(
    () => linhas.reduce((s, l) => s + l.produto.preco * l.quantidade, 0), [linhas]);

  // Número de unidades no carrinho (o que aparece no menu)
  const quantidadeTotal = useMemo(
    () => linhas.reduce((s, l) => s + l.quantidade, 0), [linhas]);

  return (
    <CarrinhoContext.Provider
      value={{ linhas, adicionar, alterar, remover, esvaziar, total, quantidadeTotal, quantidadeDe }}>
      {children}
    </CarrinhoContext.Provider>
  );
}

export const useCarrinho = () => useContext(CarrinhoContext);