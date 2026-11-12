import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';

export default function PerfilProdutor() {
  const { utilizador, token, sair, guardarSessao } = useAuth();
  const p = utilizador.produtor ?? {};
  const [d, setD] = useState({
    nomeExploracao: p.nomeExploracao ?? '',
    localidade: p.localidade ?? '',
    descricao: p.descricao ?? '',
    lat: p.localizacao?.lat ?? '',
    lng: p.localizacao?.lng ?? '',
  });
  const [erro, setErro] = useState('');
  const [guardado, setGuardado] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [aLocalizar, setALocalizar] = useState(false);

  const atualizar = (campo) => (e) => {
    setGuardado(false);
    setD((x) => ({ ...x, [campo]: e.target.value }));
  };

  function usarLocalizacao() {
    setErro('');
    if (!navigator.geolocation) return setErro('Este browser não permite obter a localização.');
    setALocalizar(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGuardado(false);
        setD((x) => ({ ...x, lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }));
        setALocalizar(false);
      },
      () => {
        setErro('Não foi possível obter a localização. Escreve as coordenadas à mão.');
        setALocalizar(false);
      },
    );
  }

  async function submeter(e) {
    e.preventDefault();
    setErro('');
    setGuardado(false);

    const comLat = String(d.lat).trim() !== '';
    const comLng = String(d.lng).trim() !== '';
    if (comLat !== comLng) return setErro('Indica a latitude e a longitude, ou deixa as duas vazias.');
    if (comLat && !(Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)))) {
      return setErro('A latitude e a longitude têm de ser números.');
    }

    setAGuardar(true);
    try {
      await api('/producers/me', {
        metodo: 'PATCH',
        token,
        corpo: {
          nomeExploracao: d.nomeExploracao,
          localidade: d.localidade,
          descricao: d.descricao,
          localizacao: comLat ? { lat: Number(d.lat), lng: Number(d.lng) } : null,
        },
      });
      guardarSessao({ token, utilizador: await api('/auth/eu', { token }) });
      setGuardado(true);
    } catch (err) {
      if (err.status === 401) return sair();
      setErro(err.status ? err.message : 'Não foi possível contactar o servidor');
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <form className="formulario-estreito" onSubmit={submeter}>
      <h1>Perfil público</h1>
      <p className="texto-secundario">É o que os compradores veem na tua página.</p>

      <label htmlFor="nomeExploracao" className="form-label">Nome da exploração</label>
      <input id="nomeExploracao" type="text" className="form-control mb-3" required maxLength={100}
        value={d.nomeExploracao} onChange={atualizar('nomeExploracao')} />

      <label htmlFor="localidade" className="form-label">Localidade</label>
      <input id="localidade" type="text" className="form-control mb-3" required maxLength={100}
        value={d.localidade} onChange={atualizar('localidade')} />

      <label htmlFor="descricao" className="form-label">Descrição</label>
      <textarea id="descricao" rows={4} className="form-control mb-3" maxLength={1000}
        value={d.descricao} onChange={atualizar('descricao')} />

      <fieldset className="mb-3">
        <legend className="form-label fs-6">Localização no mapa</legend>
        <div className="row g-2 mb-2">
          <div className="col-6">
            <label htmlFor="lat" className="form-label small">Latitude</label>
            <input id="lat" type="number" step="any" min="-90" max="90" className="form-control"
              value={d.lat} onChange={atualizar('lat')} />
          </div>
          <div className="col-6">
            <label htmlFor="lng" className="form-label small">Longitude</label>
            <input id="lng" type="number" step="any" min="-180" max="180" className="form-control"
              value={d.lng} onChange={atualizar('lng')} />
          </div>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={usarLocalizacao} disabled={aLocalizar}>
          {aLocalizar ? 'A localizar...' : 'Usar a minha localização'}
        </button>
        <div className="form-text">Deixa as duas vazias para não mostrar mapa.</div>
      </fieldset>

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {guardado && (
        <div className="alert alert-success" role="status">
          Perfil guardado.{' '}
          {utilizador.produtor?.validado && <Link to={`/produtores/${utilizador.id}`}>Ver a minha página</Link>}
        </div>
      )}

      <div className="d-flex gap-2">
        <Link to="/produtor" className="btn btn-outline-secondary">Voltar ao painel</Link>
        <button type="submit" className="btn btn-success flex-fill" disabled={aGuardar}>
          {aGuardar ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
