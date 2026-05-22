import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Shield, Moon, Sun, LogOut } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

import Admin from './pages/Admin';
import Viatura from './pages/Viatura';
import Sobre from './pages/Sobre';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';

/**
 * Componente: Layout
 * Propósito: Define o cabeçalho (Header) e rodapé (Footer) globais que envelopam toda a aplicação.
 * Funcionalidades:
 * - Exibe o botão de alternância de Tema (Claro/Escuro).
 * - Exibe o botão de Logout (caso o usuário esteja logado no painel Admin).
 * - Renderiza as rotas filhas dentro da tag <main>.
 */
function Layout({ children, isDark, toggleTheme, user }) {
  // Função para deslogar do Firebase (Painel Administrativo)
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  return (
    <div className="min-h-screen" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Cabeçalho Global */}
      <header className="header-bar">
        <img src="/logo.png" alt="Logo" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
        <h1 className="header-title">VTR SaaS - 1ª CIA / 46º BPM</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Botão de Tema (Dark Mode) */}
          <button onClick={toggleTheme} className="theme-toggle-btn" title="Alternar Tema">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          {/* Botão de Logout exibido apenas para Admins autenticados */}
          {user && (
            <button 
              onClick={handleLogout} 
              className="theme-toggle-btn" 
              title="Sair do Sistema"
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Área onde as páginas específicas (Admin, Viatura, Login) são renderizadas */}
      <main className="container fade-in" style={{ flex: 1, width: '100%', paddingBottom: '80px' }}>
        {children}
      </main>

      {/* Rodapé Global */}
      <footer style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        backgroundColor: 'var(--bg-color)', 
        textAlign: 'center', 
        padding: '1rem', 
        color: 'var(--text-muted)', 
        fontSize: '0.85rem', 
        borderTop: '1px solid var(--border-color)', 
        zIndex: 100,
        transition: 'background-color 0.3s ease, color 0.3s ease'
      }}>
        Desenvolvido pelo <Link to="/sobre" style={{ color: 'var(--bm-green)', fontWeight: 600, textDecoration: 'none' }}>P4 da 1ª CIA do 46º BPM</Link>
      </footer>
    </div>
  );
}

/**
 * Componente: App (Ponto de Entrada do React)
 * Propósito: Gerenciar estado global básico (Tema e Autenticação) e orquestrar as Rotas (React Router).
 */
function App() {
  // Estado do Tema (Light/Dark Mode). Salva no localStorage para persistência.
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem('vtr_theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Caso não tenha salvo, busca a preferência nativa do sistema operacional
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Estado de Autenticação Global (Firebase)
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Monitora alterações na sessão de usuário (Login/Logout)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Aplica a classe CSS 'dark-theme' ao <body> sempre que isDark mudar
  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('vtr_theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('vtr_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  // Aguarda a verificação do Firebase antes de renderizar qualquer rota protegida
  if (authLoading) {
    return null; 
  }

  return (
    <BrowserRouter>
      <Layout isDark={isDark} toggleTheme={toggleTheme} user={user}>
        <Routes>
          {/* Redirecionamento da raiz diretamente para o Painel Administrativo */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          
          {/* Tela de Acesso Administrativo */}
          <Route path="/login" element={<Login />} />
          
          {/* Painel Administrativo - Protegido por Autenticação */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } 
          />
          
          {/* Telas Operacionais (Acesso Público Mobile / QR Code) */}
          <Route path="/vtr" element={<Viatura />} />
          <Route path="/vtr/:prefixo" element={<Viatura />} />
          
          {/* Página Institucional / Créditos */}
          <Route path="/sobre" element={<Sobre />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
