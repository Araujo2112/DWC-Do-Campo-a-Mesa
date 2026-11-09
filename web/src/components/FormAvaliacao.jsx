import { useId, useState } from 'react';

export default function FormAvaliacao({ rotulo, aoEnviar, aoCancelar }) {
  const idNota = useId();
  const idComentario = useId();
  const [classificacao, setClassificacao] = useState('');
  const [comentario, setComentario] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setAEnviar(true);
    setErro('');
    try {
      await aoEnviar({ classificacao: Number(classificacao), comentario: comentario.trim() });
    } catch (err) {
      setErro(err.status ? err.message : 'Não foi possível contactar o servidor');
      setAEnviar(false);
    }
  }

  return (
    <form onSubmit={enviar} className="border rounded p-3 mt-2">
      <p className="fw-bold mb-2">{rotulo}</p>

      <label htmlFor={idNota} className="form-label">Classificação</label>
      <select id={idNota} className="form-select mb-2" value={classificacao} required
        onChange={(e) => setClassificacao(e.target.value)}>
        <option value="" disabled>Escolhe de 1 a 5</option>
        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
      </select>

      <label htmlFor={idComentario} className="form-label">Comentário (opcional)</label>
      <textarea id={idComentario} className="form-control mb-2" rows={3} maxLength={500} value={comentario}
        onChange={(e) => setComentario(e.target.value)} />

      {erro && <div className="alert alert-danger py-2" role="alert">{erro}</div>}

      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-success" disabled={aEnviar || !classificacao}>Enviar</button>
        <button type="button" className="btn btn-outline-secondary" onClick={aoCancelar} disabled={aEnviar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
