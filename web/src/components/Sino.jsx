import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCaixaDeNotificacoes } from '../context/NotificacoesContext.jsx';

const relativo = new Intl.RelativeTimeFormat('pt-PT', { numeric: 'auto' });

function ha(data) {
  const s = Math.round((new Date(data).getTime() - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return 'agora mesmo';
  if (abs < 3600) return relativo.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return relativo.format(Math.round(s / 3600), 'hour');
  return relativo.format(Math.round(s / 86400), 'day');
}

function IconeSino() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function Sino() {
  const { itens, naoLidas, carregar, marcarLidas } = useCaixaDeNotificacoes();
  const raiz = useRef(null);
  const aoFechar = useRef(marcarLidas);
  const aoAbrir = useRef(carregar);
  useEffect(() => { aoFechar.current = marcarLidas; aoAbrir.current = carregar; });

  // Eventos do dropdown do Bootstrap (já usado no resto da app)
  useEffect(() => {
    const el = raiz.current;
    const abrir = () => aoAbrir.current();
    const fechar = () => aoFechar.current();
    el.addEventListener('show.bs.dropdown', abrir);
    el.addEventListener('hidden.bs.dropdown', fechar);
    return () => {
      el.removeEventListener('show.bs.dropdown', abrir);
      el.removeEventListener('hidden.bs.dropdown', fechar);
    };
  }, []);

  return (
    <div className="dropdown" ref={raiz}>
      <button type="button" className="btn btn-outline-secondary position-relative d-inline-flex align-items-center"
        data-bs-toggle="dropdown" aria-expanded="false"
        aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} por ler` : 'Notificações'}>
        <IconeSino />
        {naoLidas > 0 && (
          <span className="badge rounded-pill text-bg-danger position-absolute top-0 start-100 translate-middle" aria-hidden="true">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>
      <div className="dropdown-menu dropdown-menu-end sino__menu p-0">
        <p className="sino__titulo mb-0">Notificações</p>
        {itens.length === 0 ? (
          <p className="sino__vazio mb-0">Ainda não tens notificações.</p>
        ) : (
          <ul className="list-unstyled mb-0 sino__lista">
            {itens.map((n) => {
              const conteudo = (
                <>
                  <span className="sino__texto">{n.texto}</span>
                  <span className="sino__hora">{ha(n.criadoEm)}</span>
                </>
              );
              return (
                <li key={n.id} className={n.lida ? 'sino__item' : 'sino__item sino__item--nova'}>
                  {n.link
                    ? <Link to={n.link} className="sino__ligacao">{conteudo}</Link>
                    : <div className="sino__ligacao">{conteudo}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
