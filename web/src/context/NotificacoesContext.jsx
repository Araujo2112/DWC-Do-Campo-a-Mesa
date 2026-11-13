// Caixa de notificações (sino): lista guardada na API + novas em tempo real pela sala pessoal
import { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import { io } from 'socket.io-client';
import { api, API_URL } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const NotificacoesContext = createContext(null);
const MAX = 30;
// versao sobe a cada notificação nova e a cada religação do socket: as páginas usam-na para recarregar da API.
const VAZIO = { itens: [], naoLidas: 0, versao: 0 };

function reduzir(estado, acao) {
  switch (acao.tipo) {
    case 'limpar':
      return VAZIO;
    case 'carregar': {
      // Uma notificação em tempo real pode chegar antes da resposta do pedido inicial: não se perde nem duplica.
      const recebidas = Array.isArray(acao.itens) ? acao.itens : [];
      const ids = new Set(recebidas.map((i) => i.id));
      const extras = estado.itens.filter((i) => !ids.has(i.id));
      return {
        ...estado,
        itens: [...extras, ...recebidas].slice(0, MAX),
        naoLidas: (acao.naoLidas ?? 0) + extras.filter((i) => !i.lida).length,
      };
    }
    case 'chegou':
      if (estado.itens.some((i) => i.id === acao.item.id)) return estado;
      return { itens: [acao.item, ...estado.itens].slice(0, MAX), naoLidas: estado.naoLidas + 1, versao: estado.versao + 1 };
    case 'religou':
      return { ...estado, versao: estado.versao + 1 };
    case 'lidas':
      return { ...estado, itens: estado.itens.map((i) => ({ ...i, lida: true })), naoLidas: 0 };
    default:
      return estado;
  }
}

export function NotificacoesProvider({ children }) {
  const { token } = useAuth();
  const [estado, dispatch] = useReducer(reduzir, VAZIO);

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await api('/notifications', { token });
      dispatch({ tipo: 'carregar', itens: r.itens, naoLidas: r.naoLidas });
    } catch { /* o sino fica como está; a próxima abertura tenta de novo */ }
  }, [token]);

  useEffect(() => {
    dispatch({ tipo: 'limpar' });
    if (!token) return undefined;
    carregar();
    const socket = io(API_URL, { auth: { token } });
    socket.on('notificacao', (item) => dispatch({ tipo: 'chegou', item }));
    // Durante uma queda da ligação perdem-se eventos: ao voltar, as páginas recarregam o estado da API.
    let jaLigou = false;
    socket.on('connect', () => {
      if (jaLigou) { dispatch({ tipo: 'religou' }); carregar(); }
      jaLigou = true;
    });
    return () => socket.disconnect();
  }, [token, carregar]);

  // Chamado quando o menu do sino fecha: só aí se marca tudo como lido, para o destaque se ver enquanto está aberto.
  const marcarLidas = useCallback(async () => {
    if (!token || estado.naoLidas === 0) return;
    dispatch({ tipo: 'lidas' });
    try { await api('/notifications/lidas', { metodo: 'POST', token }); } catch { /* volta a aparecer no próximo carregamento */ }
  }, [token, estado.naoLidas]);

  return (
    <NotificacoesContext.Provider value={{ ...estado, carregar, marcarLidas }}>
      {children}
    </NotificacoesContext.Provider>
  );
}

export const useCaixaDeNotificacoes = () => useContext(NotificacoesContext);
