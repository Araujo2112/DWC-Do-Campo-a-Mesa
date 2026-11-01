// Estado global da sessão (utilizador + token)
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sessao')) || null; } catch { return null; }
  });

  // TODO (Passo 6): chamar POST /api/auth/login e guardar { token, utilizador }
  async function entrar(email, password) { // eslint-disable-line no-unused-vars
    throw new Error('Login por implementar');
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
