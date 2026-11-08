// Contagem decrescente calculada a partir de uma hora de fim e do desvio do relógio do servidor
import { useEffect, useState } from 'react';

// Devolve os milissegundos que faltam até "alvo" (nunca negativos).
// "offset" = relógio do servidor - relógio do cliente.
export function useContagem(alvo, offset = 0) {
  const [agora, setAgora] = useState(() => Date.now() + offset);

  useEffect(() => {
    setAgora(Date.now() + offset);
    const t = setInterval(() => setAgora(Date.now() + offset), 250);
    return () => clearInterval(t);
  }, [offset]);

  return Math.max(0, new Date(alvo).getTime() - agora);
}

export function formatarTempo(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
