import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { Loader2 } from 'lucide-react';

/**
 * Componente: ProtectedRoute (Rota Protegida)
 * Propósito: Atuar como um "Guard" (Guarda de Rota) para proteger páginas que exigem autenticação.
 * 
 * Funcionamento:
 * Este componente envolve as rotas privadas da aplicação. Ao ser renderizado, ele verifica 
 * o estado de autenticação atual do usuário no Firebase.
 * - Se o usuário estiver autenticado, o componente renderiza o conteúdo filho (a página solicitada).
 * - Se o usuário NÃO estiver autenticado, ele o redireciona automaticamente para a tela de `/login`.
 * - Enquanto verifica o estado (loading), exibe um spinner de carregamento.
 * 
 * @param {Object} props - Propriedades do componente.
 * @param {React.ReactNode} props.children - Os componentes filhos (a página) que serão renderizados caso o usuário esteja autenticado.
 * @returns {React.ReactElement} A página renderizada ou o componente de redirecionamento (<Navigate>).
 */
const ProtectedRoute = ({ children }) => {
  // Estado para armazenar o usuário logado (se houver)
  const [user, setUser] = useState(null);
  
  // Estado de carregamento, iniciado como true para evitar redirecionamentos prematuros antes do Firebase responder
  const [loading, setLoading] = useState(true);
  
  // Hook do React Router para acessar a URL atual (usado para redirecionar o usuário de volta após o login)
  const location = useLocation();

  useEffect(() => {
    // Inscreve-se no listener de estado de autenticação do Firebase
    // onAuthStateChanged é acionado sempre que há um login, logout ou a página é recarregada
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); // Define o usuário (ou null se deslogado)
      setLoading(false);    // Finaliza o estado de carregamento
    });

    // Cleanup function: remove o listener quando o componente for desmontado
    // Isso evita vazamentos de memória (memory leaks) na aplicação
    return () => unsubscribe();
  }, []);

  // 1º Cenário: O Firebase ainda está processando o status de autenticação
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '60vh',
        color: 'var(--bm-green)'
      }}>
        {/* Ícone giratório indicando processamento */}
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  // 2º Cenário: O Firebase confirmou que NÃO há usuário logado
  if (!user) {
    // Redireciona para a página de login. 
    // A prop 'state={{ from: location }}' permite que a página de login saiba de onde o usuário veio
    // e possa redirecioná-lo de volta para lá após o login ser concluído.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3º Cenário: O Firebase confirmou que HÁ um usuário logado
  // Renderiza a rota/página protegida que o usuário solicitou
  return children;
};

export default ProtectedRoute;
