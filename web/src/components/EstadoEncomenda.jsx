// Linha temporal do estado da encomenda: pendente -> confirmada -> pronta -> entregue
const ESTADOS = ['pendente', 'confirmada', 'pronta', 'entregue'];

export default function EstadoEncomenda({ estado }) {
  const indice = ESTADOS.indexOf(estado);
  return (
    <ol className="estado-encomenda" aria-label={`Estado: ${estado}`}>
      {ESTADOS.map((e, i) => (
        <li key={e} className={i < indice ? 'feito' : i === indice ? 'atual' : ''}>{e}</li>
      ))}
    </ol>
  );
}
