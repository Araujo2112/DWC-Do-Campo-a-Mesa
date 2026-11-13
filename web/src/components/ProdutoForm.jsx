// Formulário de produto (criar e editar), usado no painel do produtor
import { useEffect, useState } from 'react';

const CATEGORIAS = ['Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros'];
const EPOCAS = ['Primavera', 'Verão', 'Outono', 'Inverno'];
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGEM = 5 * 1024 * 1024; // o servidor recusa acima disto

export default function ProdutoForm({ inicial, aGuardar, erro, onGuardar, onCancelar }) {
  const [d, setD] = useState({
    nome: inicial?.nome ?? '',
    categoria: inicial?.categoria ?? 'Fruta',
    preco: inicial?.preco ?? '',
    unidade: inicial?.unidade ?? 'kg',
    stock: inicial?.stock ?? 0,
    biologico: inicial?.biologico ?? false,
    epocas: inicial?.epocas ?? [],
  });

  const [ficheiro, setFicheiro] = useState(null);
  const [previa, setPrevia] = useState('');
  const [erroImagem, setErroImagem] = useState('');

  // A pré-visualização é um URL temporário do browser: liberta-se quando muda ou o formulário fecha.
  useEffect(() => {
    if (!ficheiro) { setPrevia(''); return undefined; }
    const url = URL.createObjectURL(ficheiro);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [ficheiro]);

  function escolherImagem(e) {
    const f = e.target.files[0];
    setErroImagem('');
    if (!f) return setFicheiro(null);
    if (!TIPOS_IMAGEM.includes(f.type)) {
      e.target.value = '';
      return setErroImagem('A imagem tem de ser JPEG, PNG ou WebP.');
    }
    if (f.size > MAX_IMAGEM) {
      e.target.value = '';
      return setErroImagem('A imagem não pode ter mais de 5 MB.');
    }
    return setFicheiro(f);
  }

  const atualizar = (campo) => (e) =>
    setD((x) => ({ ...x, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const alternarEpoca = (epoca) =>
    setD((x) => ({
      ...x,
      epocas: x.epocas.includes(epoca) ? x.epocas.filter((e) => e !== epoca) : [...x.epocas, epoca],
    }));

  function submeter(e) {
    e.preventDefault();
    onGuardar({
      nome: d.nome.trim(),
      categoria: d.categoria,
      preco: Number(d.preco),
      unidade: d.unidade.trim() || 'kg',
      stock: parseInt(d.stock, 10) || 0,
      biologico: d.biologico,
      epocas: d.epocas,
    }, ficheiro);
  }

  return (
    <form className="card card-body mb-4" onSubmit={submeter}>
      <h2 className="h5">{inicial ? 'Editar produto' : 'Novo produto'}</h2>

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label htmlFor="pf-nome" className="form-label">Nome</label>
          <input id="pf-nome" type="text" className="form-control" required maxLength={100}
            value={d.nome} onChange={atualizar('nome')} />
        </div>

        <div className="col-12 col-md-6">
          <label htmlFor="pf-categoria" className="form-label">Categoria</label>
          <select id="pf-categoria" className="form-select" value={d.categoria} onChange={atualizar('categoria')}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="col-6 col-md-4">
          <label htmlFor="pf-preco" className="form-label">Preço (€)</label>
          <input id="pf-preco" type="number" className="form-control" required min="0" step="0.01"
            value={d.preco} onChange={atualizar('preco')} />
        </div>

        <div className="col-6 col-md-4">
          <label htmlFor="pf-unidade" className="form-label">Unidade</label>
          <input id="pf-unidade" type="text" className="form-control" maxLength={30}
            value={d.unidade} onChange={atualizar('unidade')} />
        </div>

        <div className="col-6 col-md-4">
          <label htmlFor="pf-stock" className="form-label">Stock</label>
          <input id="pf-stock" type="number" className="form-control" min="0" step="1"
            value={d.stock} onChange={atualizar('stock')} />
        </div>

        <div className="col-12">
          <div className="form-check">
            <input id="pf-bio" type="checkbox" className="form-check-input"
              checked={d.biologico} onChange={atualizar('biologico')} />
            <label htmlFor="pf-bio" className="form-check-label">Produção biológica</label>
          </div>
        </div>

        <div className="col-12">
          <label htmlFor="pf-imagem" className="form-label">Fotografia</label>
          <div className="d-flex align-items-center gap-3">
            {(previa || inicial?.imagemUrl) && (
              <img src={previa || inicial.imagemUrl} alt="" className="miniatura-produto" />
            )}
            <input id="pf-imagem" type="file" className="form-control" accept={TIPOS_IMAGEM.join(',')}
              onChange={escolherImagem} />
          </div>
          <div className="form-text">JPEG, PNG ou WebP, até 5 MB.</div>
          {erroImagem && <div className="text-danger small mt-1" role="alert">{erroImagem}</div>}
        </div>

        <fieldset className="col-12">
          <legend className="form-label fs-6">Épocas</legend>
          {EPOCAS.map((ep) => (
            <div className="form-check form-check-inline" key={ep}>
              <input id={`pf-${ep}`} type="checkbox" className="form-check-input"
                checked={d.epocas.includes(ep)} onChange={() => alternarEpoca(ep)} />
              <label htmlFor={`pf-${ep}`} className="form-check-label">{ep}</label>
            </div>
          ))}
        </fieldset>
      </div>

      {erro && <div className="alert alert-danger mt-3 mb-0" role="alert">{erro}</div>}

      <div className="d-flex gap-2 mt-3">
        <button type="button" className="btn btn-outline-secondary" onClick={onCancelar} disabled={aGuardar}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-success" disabled={aGuardar}>
          {aGuardar ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}