import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CarrinhoProvider } from './context/CarrinhoContext.jsx';
import { NotificacoesProvider } from './context/NotificacoesContext.jsx';
import 'bootstrap/dist/js/bootstrap.bundle.min.js'; // menu colapsável, dropdowns, etc.
import './styles/main.scss';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <CarrinhoProvider>
        <NotificacoesProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </NotificacoesProvider>
      </CarrinhoProvider>
    </AuthProvider>
  </React.StrictMode>
);
