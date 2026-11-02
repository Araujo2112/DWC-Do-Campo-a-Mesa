// Estado global da sessão (utilizador + token)
import { createContext, useContext, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sessao')) || null; } catch { return null; }
  });

  async function entrar(email, password) {
    const dados = await api('/auth/login', { metodo: 'POST', corpo: { email, password } });
    guardarSessao(dados);
    return dados.utilizador;
  }

  function sair() {
    localStorage.removeItem('sessao');
    setSessao(null);
  }

  function guardarSessao(nova) {
    localStorage.setItem('sessao', JSON.stringify(nova));
    setSessao(nova);
  }

  return (
    <AuthContext.Provider value={{
      utilizador: sessao?.utilizador || null,
      token: sessao?.token || null,
      entrar, sair, guardarSessao
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
