// Passo 2: routing no cliente
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';
import Catalogo from './pages/Catalogo.jsx';
import Produtor from './pages/Produtor.jsx';
import Leiloes from './pages/Leiloes.jsx';
import SalaLeilao from './pages/SalaLeilao.jsx';
import Carrinho from './pages/Carrinho.jsx';
import Encomendas from './pages/Encomendas.jsx';
import Login from './pages/Login.jsx';
import Registo from './pages/Registo.jsx';
import PainelProdutor from './pages/produtor/Painel.jsx';
import NovoLeilao from './pages/produtor/NovoLeilao.jsx';
import PainelAdmin from './pages/admin/Painel.jsx';
import NaoEncontrado from './pages/NaoEncontrado.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container-xl py-4">
        <Routes>
          {/* Visitante */}
          <Route path="/" element={<Catalogo />} />
          <Route path="/produtores/:id" element={<Produtor />} />
          <Route path="/leiloes" element={<Leiloes />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registo" element={<Registo />} />

          {/* Comprador */}
          <Route element={<RotaProtegida papeis={['comprador']} />}>
            <Route path="/leiloes/:id" element={<SalaLeilao />} />
            <Route path="/carrinho" element={<Carrinho />} />
            <Route path="/encomendas" element={<Encomendas />} />
          </Route>

          {/* Produtor */}
          <Route element={<RotaProtegida papeis={['produtor']} />}>
            <Route path="/produtor" element={<PainelProdutor />} />
            <Route path="/produtor/leiloes/novo" element={<NovoLeilao />} />
          </Route>

          {/* Administrador */}
          <Route element={<RotaProtegida papeis={['admin']} />}>
            <Route path="/admin" element={<PainelAdmin />} />
          </Route>

          <Route path="*" element={<NaoEncontrado />} />
        </Routes>
      </main>
    </>
  );
}
