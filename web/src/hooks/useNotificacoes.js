// Notificações em tempo real para o utilizador autenticado (sala pessoal "user:<id>")
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../api/client.js';

// aoReceber(evento, dados) com evento = 'encomenda-atualizada' | 'leilao-ganho' | 'leilao-terminado'
export function useNotificacoes(token, aoReceber) {
  const ref = useRef(aoReceber);
  useEffect(() => { ref.current = aoReceber; }); // a função mais recente, sem religar o socket

  useEffect(() => {
    if (!token) return undefined;
    const socket = io(API_URL, { auth: { token } });
    for (const evento of ['encomenda-atualizada', 'leilao-ganho', 'leilao-terminado']) {
      socket.on(evento, (dados) => ref.current?.(evento, dados));
    }
    return () => socket.disconnect();
  }, [token]);
}
