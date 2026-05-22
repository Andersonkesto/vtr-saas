import { Shield, Cloud, QrCode, BarChart3, Wrench, CheckCircle2, Info, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Componente: Sobre (Página Institucional)
 * Propósito: Apresentar os conceitos do VTR SaaS, estatísticas e os créditos da equipe de desenvolvimento.
 * 
 * NOTA PARA DESENVOLVEDORES OPEN-SOURCE: 
 * Ao utilizar ou realizar o fork deste projeto, solicitamos gentilmente que os 
 * créditos originais de desenvolvimento (Seção de Logística - P4 - 1ª CIA e Anderson Machado) 
 * sejam mantidos como forma de reconhecimento pelo trabalho original.
 */
export default function Sobre() {
  const navigate = useNavigate();

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Botão de navegação para retornar à página anterior */}
      <button
        onClick={() => navigate(-1)}
        className="btn-icon"
        style={{ marginBottom: '1.5rem', border: 'none', background: 'var(--hover-bg)' }}
      >
        <ChevronLeft /> Voltar
      </button>

      <div className="card" style={{ borderTop: '5px solid var(--bm-green)', padding: '2.5rem 1.5rem' }}>
        
        {/* Cabeçalho da página com Logo e Título */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            backgroundColor: 'var(--bm-green)',
            color: 'var(--bm-gold)',
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 10px 15px -3px rgba(45, 74, 34, 0.3)',
            border: '3px solid var(--bm-gold)'
          }}>
            <img src="/logo.png" alt="Logo" style={{ height: '56px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: '2.5rem', color: 'var(--bm-green)', marginBottom: '0.5rem' }}>VTR SaaS Institucional</h1>
          <p className="text-muted" style={{ fontSize: '1.1rem' }}>Operação e Gestão de Frota Inteligente</p>
        </div>

        {/* Seção 1: Conceito Principal do Sistema */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Conceito SaaS Institucional</h3>
          <p style={{ lineHeight: '1.6', color: 'var(--text-main)' }}>
            O <strong>VTR SaaS (Software as a Service Institucional)</strong> é uma solução de vanguarda desenvolvida para modernizar o controle logístico da <strong>1ª CIA do 46º BPM</strong>.
            Diferente de sistemas legados, ele opera inteiramente na nuvem, garantindo que a informação esteja disponível onde a operação acontece: na ponta, na mão do policial e no Centro de Comando.
          </p>
        </section>

        {/* Seção 2: Cards de Estatísticas e Vantagens */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          <div className="stat-card" style={{ flexDirection: 'column', textAlign: 'center', padding: '2rem' }}>
            <div className="stat-icon" style={{ backgroundColor: 'var(--badge-inservice-bg)', color: 'var(--badge-inservice-text)', margin: '0 0 1rem 0' }}><Cloud size={32} /></div>
            <h4 style={{ color: 'var(--text-main)', fontWeight: 700 }}>100% Cloud</h4>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Sem instalação local. Alta disponibilidade e segurança de dados via Firebase.</p>
          </div>

          <div className="stat-card" style={{ flexDirection: 'column', textAlign: 'center', padding: '2rem' }}>
            <div className="stat-icon" style={{ backgroundColor: 'var(--badge-available-bg)', color: 'var(--badge-available-text)', margin: '0 0 1rem 0' }}><QrCode size={32} /></div>
            <h4 style={{ color: 'var(--text-main)', fontWeight: 700 }}>Agilidade QR</h4>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Check-in e Check-out instantâneo, vinculando motorista e viatura em segundos.</p>
          </div>

          <div className="stat-card" style={{ flexDirection: 'column', textAlign: 'center', padding: '2rem' }}>
            <div className="stat-icon" style={{ backgroundColor: 'var(--badge-alert-bg)', color: 'var(--badge-alert-text)', margin: '0 0 1rem 0' }}><BarChart3 size={32} /></div>
            <h4 style={{ color: 'var(--text-main)', fontWeight: 700 }}>Billing Inteligente de Frota</h4>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Dados em tempo real para tomada de decisão estratégica do comando.</p>
          </div>
        </div>

        {/* Seção 3: Detalhes Operacionais do Sistema */}
        <section style={{ marginTop: '3rem' }}>
          <h3 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Detalhes Operacionais</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ color: 'var(--bm-green)', marginTop: '4px' }}><CheckCircle2 size={24} /></div>
              <div>
                <h4 style={{ marginBottom: '0.25rem' }}>Inspeção G.A.L.O.P.E.</h4>
                <p className="text-muted">Integração da doutrina de manutenção preventiva no workflow digital, garantindo que a viatura só assuma o serviço após inspeção rigorosa.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ color: 'var(--bm-green)', marginTop: '4px' }}><Wrench size={24} /></div>
              <div>
                <h4 style={{ marginBottom: '0.25rem' }}>Gestão de Manutenção P4</h4>
                <p className="text-muted">Sistema de tickets automáticos. Qualquer alteração relatada na ponta gera um alerta imediato para a seção de logística.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ color: 'var(--bm-green)', marginTop: '4px' }}><Info size={24} /></div>
              <div>
                <h4 style={{ marginBottom: '0.25rem' }}>Transparência Histórica</h4>
                <p className="text-muted">Rastreabilidade completa de quem operou cada viatura, quilometragem percorrida e ocorrências mecânicas.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Seção Stack Tecnológico */}
        <section style={{ marginTop: '3rem' }}>
          <h3 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Stack Tecnológico do Sistema</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #61dafb', backgroundColor: 'var(--hover-bg)' }}>
              <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '1.1rem' }}>React.js</strong>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>Front-end & Componentização SPA (Single Page Application).</span>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #ffca28', backgroundColor: 'var(--hover-bg)' }}>
              <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '1.1rem' }}>Firebase</strong>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>Backend Serverless, Firestore (NoSQL Realtime), Storage & Auth.</span>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #646cff', backgroundColor: 'var(--hover-bg)' }}>
              <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '1.1rem' }}>Vite & PWA</strong>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>Build ultra-rápido e Progressive Web App (Instalável no Mobile).</span>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #25d366', backgroundColor: 'var(--hover-bg)' }}>
              <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '1.1rem' }}>Evolution API</strong>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>Microserviço em Node.js (Instância v0.4.13) para disparos de WhatsApp.</span>
            </div>
          </div>
        </section>

        {/* Seção 4: Créditos da Equipe e Desenvolvedor (IMPORTANTE: MANTER) */}
        <section style={{ marginTop: '3rem' }}>
          <h3 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Créditos e Equipe (P4 - 1ª CIA)</h3>
          
          {/* Card de Destaque: Desenvolvedor Principal */}
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center', background: 'var(--hover-bg)', border: '1px solid var(--bm-green)', marginBottom: '1.5rem' }}>
            <strong style={{ display: 'block', color: 'var(--bm-green)', fontSize: '1.3rem', marginBottom: '0.25rem' }}>Anderson Machado (Sd Anderson)</strong>
            <span style={{ fontSize: '0.9rem', color: 'var(--bm-gold)', fontWeight: 'bold', display: 'block', marginBottom: '1rem' }}>Desenvolvedor de Software & Idealizador</span>
            <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.5', maxWidth: '600px', margin: '0 auto' }}>
              Responsável pela arquitetura, engenharia e codificação do VTR SaaS. 
              Criado com o objetivo de inovar a gestão logística na segurança pública, 
              entregando tecnologia de ponta, performance e usabilidade para as operações diárias da Brigada Militar.
            </p>
          </div>

          {/* Grid com demais membros da equipe de logística */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--hover-bg)', border: 'none' }}>
              <strong style={{ display: 'block', color: 'var(--text-main)' }}>2º Sgt Ramos</strong>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>Gestão de Frota</span>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--hover-bg)', border: 'none' }}>
              <strong style={{ display: 'block', color: 'var(--text-main)' }}>Sd Poshi</strong>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>Equipe P4</span>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--hover-bg)', border: 'none' }}>
              <strong style={{ display: 'block', color: 'var(--text-main)' }}>Sd Caldas</strong>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>Equipe P4</span>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--hover-bg)', border: 'none' }}>
              <strong style={{ display: 'block', color: 'var(--text-main)' }}>Sd Valerio</strong>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>Equipe P4</span>
            </div>
          </div>
        </section>

        {/* Rodapé Institucional */}
        <footer style={{ marginTop: '4rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
          <p className="text-muted">Desenvolvido pelo <strong>P4 da 1ª CIA - 46º BPM</strong></p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.6 }}>46º Batalhão de Polícia Militar - Bagé/RS</p>
        </footer>
      </div>
    </div>
  );
}
