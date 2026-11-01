// Marcador visual para as partes da interface ainda por fazer
export default function PorImplementar({ passo, children }) {
  return (
    <div className="por-implementar" role="note">
      <strong>Por implementar{passo ? ` (Passo ${passo})` : ''}:</strong> {children}
    </div>
  );
}
