// Cliente HTTP da API: junta o URL base e o token JWT a cada pedido
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const USAR_DADOS_SIMULADOS = import.meta.env.VITE_USAR_DADOS_SIMULADOS === 'true';

export async function api(caminho, { metodo = 'GET', corpo, token } = {}) {
  // Com FormData (upload) o browser define o Content-Type, com a fronteira do multipart.
  const ehFicheiro = corpo instanceof FormData;
  const resposta = await fetch(`${API_URL}/api${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo && !ehFicheiro ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: corpo ? (ehFicheiro ? corpo : JSON.stringify(corpo)) : undefined
  });
  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = new Error(dados?.erro || `Erro ${resposta.status}`);
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}
