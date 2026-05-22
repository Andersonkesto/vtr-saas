import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Shield, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Componente: Login (Página de Autenticação)
 * Propósito: Interface de entrada para acesso à área administrativa (Painel de Controle).
 * 
 * Funcionamento:
 * Utiliza a autenticação por e-mail e senha do Firebase.
 * Gerencia os estados do formulário (email, senha), estado de carregamento e exibição de erros.
 * Caso o usuário tenha tentado acessar uma rota protegida antes de logar, o React Router
 * guardou essa rota no 'location.state.from'. Após o login, ele é redirecionado para lá.
 * Caso contrário, vai para o dashboard padrão ('/admin').
 */
const Login = () => {
  // Estados para gerenciar os inputs do usuário
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Estado para exibir mensagens de erro de autenticação (ex: senha inválida)
  const [error, setError] = useState('');
  
  // Estado para controlar o botão de submit (evita múltiplos cliques enquanto autentica)
  const [loading, setLoading] = useState(false);
  
  // Hooks do React Router para navegação e captura de histórico
  const navigate = useNavigate();
  const location = useLocation();
  
  // Identifica de onde o usuário veio antes de ser barrado (se houver) ou define a rota padrão (/admin)
  const from = location.state?.from?.pathname || "/admin";

  /**
   * Manipula o envio do formulário de login.
   * @param {Event} e - Evento de submit do formulário
   */
  const handleSubmit = async (e) => {
    e.preventDefault(); // Impede o reload natural da página ao submeter o form
    setError(''); // Limpa erros anteriores
    setLoading(true); // Inicia o estado de carregamento para desativar o botão

    try {
      // Tenta autenticar o usuário no Firebase com as credenciais fornecidas
      await signInWithEmailAndPassword(auth, email, password);
      
      // Se sucesso, redireciona o usuário. 
      // replace: true substitui a entrada no histórico de navegação, 
      // impedindo que ele volte para a tela de login clicando em "Voltar" no navegador.
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      // Se falhar (senha errada, usuário não existe, etc), exibe a mensagem amigável
      setError('Credenciais inválidas. Verifique seu e-mail e senha.');
    } finally {
      // Independentemente de dar certo ou errado, remove o estado de carregamento
      setLoading(false);
    }
  };

  return (
    <div className="login-container fade-in">
      <div className="login-card">
        
        {/* Cabeçalho do Card de Login */}
        <div className="login-header">
          <div className="login-logo">
            <img src="/logo.png" alt="Logo" style={{ height: '48px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <h2>Acesso Administrativo</h2>
          <p className="text-muted">Entre com suas credenciais para gerenciar a frota</p>
        </div>

        {/* Formulário de Autenticação */}
        <form onSubmit={handleSubmit} className="login-form">
          
          {/* Exibição condicional da mensagem de erro */}
          {error && (
            <div className="error-badge shake">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Campo: E-mail */}
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <div className="input-with-icon">
              <Mail className="input-icon" size={18} />
              <input
                type="email"
                className="form-input"
                placeholder="exemplo@brigadamilitar.rs.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Campo: Senha */}
          <div className="form-group">
            <label className="form-label">Senha</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Botão de Submissão (Desativado durante o carregamento) */}
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ marginTop: '1rem', height: '50px' }}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Autenticando...</span>
              </>
            ) : (
              'Entrar no Sistema'
            )}
          </button>
        </form>

        {/* Rodapé Informativo */}
        <div className="login-footer">
          <p>Acesso restrito a pessoal autorizado.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
