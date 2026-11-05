const fs = require('fs');
const path = require('path');

const adminPath = path.resolve(__dirname, '../src/pages/Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Atualizar importações do lucide-react
const oldImport = "ChevronDown, ChevronUp, ChevronRight, Clock, User, Calendar, FileText, CheckCircle, Search, Printer";
const newImport = "ChevronDown, ChevronUp, ChevronRight, Clock, User, Calendar, FileText, CheckCircle, Search, Printer, AlertOctagon, Bug, Copy, RefreshCw, Terminal, Check";

if (content.includes(oldImport) && !content.includes('AlertOctagon')) {
  content = content.replace(oldImport, newImport);
}

// 2. Adicionar estados para error_logs
const stateTarget = "const [buscaTabelaBI, setBuscaTabelaBI] = useState('');";
const stateAdd = `const [buscaTabelaBI, setBuscaTabelaBI] = useState('');

  // Estados para Monitor de Logs de Erros da Aplicação
  const [errorLogs, setErrorLogs] = useState([]);
  const [filtroOrigemErro, setFiltroOrigemErro] = useState('todos');
  const [filtroSeveridadeErro, setFiltroSeveridadeErro] = useState('todas');
  const [filtroStatusErro, setFiltroStatusErro] = useState('todos');
  const [buscaErroTexto, setBuscaErroTexto] = useState('');
  const [erroSelecionadoModal, setErroSelecionadoModal] = useState(null);
  const [salvandoStatusErro, setSalvandoStatusErro] = useState(false);
  const [copiadoDiag, setCopiadoDiag] = useState(false);`;

if (content.includes(stateTarget) && !content.includes('errorLogs')) {
  content = content.replace(stateTarget, stateAdd);
}

// 3. Adicionar funções de gerenciamento de erros antes de carregarAcessos
const carregarAcessosTarget = "  const carregarAcessos = async () => {";
const errorHandlers = `  const alternarStatusErro = async (id, statusAtual) => {
    if (salvandoStatusErro) return;
    setSalvandoStatusErro(true);
    const novoStatus = statusAtual === 'resolvido' ? 'pendente' : 'resolvido';
    try {
      await updateDoc(doc(db, 'error_logs', id), {
        status: novoStatus,
        atualizado_em: serverTimestamp(),
        resolvido_por: auth.currentUser?.email || 'admin'
      });
      setErrorLogs(prev => prev.map(item => item.id === id ? { ...item, status: novoStatus } : item));
      if (erroSelecionadoModal && erroSelecionadoModal.id === id) {
        setErroSelecionadoModal(prev => ({ ...prev, status: novoStatus }));
      }
    } catch (err) {
      console.error('Erro ao atualizar status do log:', err);
      alert('Não foi possível atualizar o status do log de erro.');
    } finally {
      setSalvandoStatusErro(false);
    }
  };

  const excluirLogErro = async (id) => {
    if (!window.confirm('Deseja realmente remover este log de erro do sistema?')) return;
    try {
      await deleteDoc(doc(db, 'error_logs', id));
      setErrorLogs(prev => prev.filter(item => item.id !== id));
      if (erroSelecionadoModal && erroSelecionadoModal.id === id) {
        setErroSelecionadoModal(null);
      }
    } catch (err) {
      console.error('Erro ao excluir log:', err);
      alert('Não foi possível excluir o log.');
    }
  };

  const marcarTodosErrosResolvidos = async () => {
    const pendentes = errorLogs.filter(e => e.status !== 'resolvido');
    if (pendentes.length === 0) {
      alert('Não há erros pendentes para resolver no momento.');
      return;
    }
    if (!window.confirm(\`Deseja marcar todos os \${pendentes.length} erro(s) pendente(s) como resolvidos?\`)) return;
    setSalvandoStatusErro(true);
    try {
      await Promise.all(pendentes.map(item =>
        updateDoc(doc(db, 'error_logs', item.id), {
          status: 'resolvido',
          atualizado_em: serverTimestamp(),
          resolvido_por: auth.currentUser?.email || 'admin'
        })
      ));
      setErrorLogs(prev => prev.map(item => ({ ...item, status: 'resolvido' })));
    } catch (err) {
      console.error('Erro ao resolver todos os erros:', err);
      alert('Erro ao atualizar alguns registros.');
    } finally {
      setSalvandoStatusErro(false);
    }
  };

  const copiarDiagnosticoErro = (log) => {
    if (!log) return;
    const txt = [
      \`=== DIAGNÓSTICO DE ERRO - VTR CONTROL ===\`,
      \`Data/Hora: \${formatarData(log.timestamp)}\`,
      \`Origem/Módulo: \${log.origem}\`,
      \`Severidade: \${log.severidade}\`,
      \`Status: \${log.status}\`,
      \`Mensagem: \${log.mensagem}\`,
      log.matricula ? \`Matrícula: \${log.matricula}\` : null,
      log.prefixo_vtr ? \`Viatura: VTR \${log.prefixo_vtr}\` : null,
      log.usuario_email ? \`Usuário Email: \${log.usuario_email}\` : null,
      \`IP: \${log.ip || 'N/A'}\`,
      \`Dispositivo: \${log.dispositivo || 'N/A'}\`,
      \`User Agent: \${log.userAgent || 'N/A'}\`,
      \`URL: \${log.url || 'N/A'}\`,
      \`Detalhes:\\n\${JSON.stringify(log.detalhes || {}, null, 2)}\`,
      log.detalhes?.stackTrace ? \`Stack Trace:\\n\${log.detalhes.stackTrace}\` : null
    ].filter(Boolean).join('\\n');

    navigator.clipboard.writeText(txt);
    setCopiadoDiag(true);
    setTimeout(() => setCopiadoDiag(false), 2500);
  };

`;

if (content.includes(carregarAcessosTarget) && !content.includes('alternarStatusErro')) {
  content = content.replace(carregarAcessosTarget, errorHandlers + carregarAcessosTarget);
}

// 4. Atualizar carregarAcessos para buscar error_logs também
const oldCarregarAcessos = `  const carregarAcessos = async () => {
    setViewMode('acessos');
    setLoadingContent(true);
    try {
      const qA = query(collection(db, 'acessos'), orderBy('timestamp', 'desc'), limit(300));
      const qAud = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(300));
      const [snapshotA, snapshotAud] = await Promise.all([
        getDocs(qA),
        getDocs(qAud)
      ]);

      const docsA = [];
      snapshotA.forEach(doc => docsA.push({ id: doc.id, ...doc.data() }));
      setAcessos(docsA);

      const docsAud = [];
      snapshotAud.forEach(doc => docsAud.push({ id: doc.id, ...doc.data() }));
      setAuditLogs(docsAud);
    } catch (e) { console.error(e); } finally { setLoadingContent(false); }
  };`;

const newCarregarAcessos = `  const carregarAcessos = async () => {
    setViewMode('acessos');
    setLoadingContent(true);
    try {
      const qA = query(collection(db, 'acessos'), orderBy('timestamp', 'desc'), limit(300));
      const qAud = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(300));
      const qErr = query(collection(db, 'error_logs'), orderBy('timestamp', 'desc'), limit(300));
      const [snapshotA, snapshotAud, snapshotErr] = await Promise.all([
        getDocs(qA),
        getDocs(qAud),
        getDocs(qErr)
      ]);

      const docsA = [];
      snapshotA.forEach(doc => docsA.push({ id: doc.id, ...doc.data() }));
      setAcessos(docsA);

      const docsAud = [];
      snapshotAud.forEach(doc => docsAud.push({ id: doc.id, ...doc.data() }));
      setAuditLogs(docsAud);

      const docsErr = [];
      snapshotErr.forEach(doc => docsErr.push({ id: doc.id, ...doc.data() }));
      setErrorLogs(docsErr);
    } catch (e) { console.error(e); } finally { setLoadingContent(false); }
  };`;

content = content.replace(oldCarregarAcessos, newCarregarAcessos);

// 5. Substituir a renderização de viewMode === 'acessos'
const acessosStartStr = "{viewMode === 'acessos' && (";
const whatsappStartStr = "{viewMode === 'whatsapp' && (";

const idxAcessosStart = content.indexOf(acessosStartStr);
const idxWhatsappStart = content.indexOf(whatsappStartStr);
if (idxAcessosStart === -1 || idxWhatsappStart === -1) {
  throw new Error('Falha ao encontrar bloco de viewMode acessos');
}

const newAcessosSection = `{viewMode === 'acessos' && (
        <div className="fade-in">
          <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.5rem', margin: 0 }}>Logs, Telemetria & Rastreabilidade</h3>
              <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>Monitoramento de acessos, auditoria P4 e logs de erros da aplicação</p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--input-bg)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '0.85rem', width: 'auto', backgroundColor: tipoLogExibido === 'acessos' ? 'var(--bm-green)' : 'transparent', color: tipoLogExibido === 'acessos' ? 'white' : 'var(--text-muted)' }}
                onClick={() => setTipoLogExibido('acessos')}
              >
                Acessos ME
              </button>
              <button
                type="button"
                className="btn"
                style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '0.85rem', width: 'auto', backgroundColor: tipoLogExibido === 'auditoria' ? 'var(--bm-green)' : 'transparent', color: tipoLogExibido === 'auditoria' ? 'white' : 'var(--text-muted)' }}
                onClick={() => setTipoLogExibido('auditoria')}
              >
                Log Auditoria P4
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  width: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: tipoLogExibido === 'erros' ? '#dc2626' : 'transparent',
                  color: tipoLogExibido === 'erros' ? 'white' : 'var(--text-muted)',
                  fontWeight: tipoLogExibido === 'erros' ? 700 : 400
                }}
                onClick={() => setTipoLogExibido('erros')}
              >
                <AlertOctagon size={16} />
                <span>Logs de Erros</span>
                {errorLogs.filter(e => e.status !== 'resolvido').length > 0 && (
                  <span style={{
                    backgroundColor: tipoLogExibido === 'erros' ? '#ffffff' : '#ef4444',
                    color: tipoLogExibido === 'erros' ? '#dc2626' : '#ffffff',
                    borderRadius: '10px',
                    padding: '1px 7px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    marginLeft: '2px'
                  }}>
                    {errorLogs.filter(e => e.status !== 'resolvido').length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* ABA 1: ACESSOS ME */}
          {tipoLogExibido === 'acessos' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
              {Object.keys(acessosAgrupados).sort().map(vtr => (
                <div key={vtr} className="card">
                  <h3 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '8px', marginBottom: '10px' }}>VTR {vtr}</h3>
                  {acessosAgrupados[vtr].slice(0, 5).map(log => (
                    <div key={log.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div className="flex-between">
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatarData(log.timestamp)}</span>
                        <span className="badge badge-inservice" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>{log.acao}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{log.ip} • {log.dispositivo}</span>
                        {log.latitude && (
                          <a
                            href={\`https://google.com/maps?q=\${log.latitude},\${log.longitude}\`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--bm-green)', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600, textDecoration: 'none' }}
                          >
                            <MapPin size={12} /> Ver GPS Exato
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ABA 2: LOG AUDITORIA P4 */}
          {tipoLogExibido === 'auditoria' && (
            <div className="card table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Operador</th>
                    <th>Ação Executada</th>
                    <th>Parâmetros da Ação</th>
                    <th>IP / Origem</th>
                    <th>GPS Exato</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatarData(log.timestamp)}</td>
                      <td><strong>{log.usuario_email}</strong></td>
                      <td>
                        <span className="badge badge-alert" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                          {log.acao}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', maxWidth: '300px', wordBreak: 'break-all' }}>
                        <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(log.detalhes || {})}
                        </pre>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{log.ip} <br /> <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{log.dispositivo}</span></td>
                      <td>
                        {log.latitude ? (
                          <a
                            href={\`https://google.com/maps?q=\${log.latitude},\${log.longitude}\`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--bm-green)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, textDecoration: 'none' }}
                          >
                            <MapPin size={14} /> GPS
                          </a>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ABA 3: MONITOR DE LOGS DE ERROS DA APLICAÇÃO */}
          {tipoLogExibido === 'erros' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Cartões KPI de Resumo de Erros */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #ef4444' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Total Registrado</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--text-main)' }}>{errorLogs.length}</h3>
                    <AlertOctagon size={24} color="#ef4444" opacity={0.6} />
                  </div>
                </div>

                <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Pendentes</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.6rem', color: '#f59e0b' }}>
                      {errorLogs.filter(e => e.status !== 'resolvido').length}
                    </h3>
                    <AlertTriangle size={24} color="#f59e0b" opacity={0.6} />
                  </div>
                </div>

                <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #8b5cf6' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Falhas de Login</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.6rem', color: '#8b5cf6' }}>
                      {errorLogs.filter(e => e.origem?.includes('LOGIN') || e.origem?.includes('CADASTRO')).length}
                    </h3>
                    <User size={24} color="#8b5cf6" opacity={0.6} />
                  </div>
                </div>

                <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #3b82f6' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Assunção / Devolução</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.6rem', color: '#3b82f6' }}>
                      {errorLogs.filter(e => e.origem?.includes('VTR')).length}
                    </h3>
                    <Car size={24} color="#3b82f6" opacity={0.6} />
                  </div>
                </div>
              </div>

              {/* Barra de Filtros e Ações */}
              <div className="card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flex: '1 1 500px' }}>
                  
                  {/* Busca textual */}
                  <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 200px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Buscar por erro, matrícula, VTR, IP..."
                      value={buscaErroTexto}
                      onChange={e => setBuscaErroTexto(e.target.value)}
                      style={{ height: '36px', paddingLeft: '32px', fontSize: '0.82rem', width: '100%', borderRadius: '8px' }}
                    />
                    {buscaErroTexto && (
                      <button type="button" onClick={() => setBuscaErroTexto('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Filtro Origem */}
                  <select
                    className="form-input"
                    value={filtroOrigemErro}
                    onChange={e => setFiltroOrigemErro(e.target.value)}
                    style={{ height: '36px', fontSize: '0.82rem', width: 'auto', minWidth: '150px', borderRadius: '8px' }}
                  >
                    <option value="todos">Todas as Origens</option>
                    <option value="LOGIN_ADMIN">Login Administrativo</option>
                    <option value="LOGIN_ME">Login Militar (ME)</option>
                    <option value="CADASTRO_ME">Cadastro Militar (ME)</option>
                    <option value="ASSUNCAO_VTR">Assunção de VTR</option>
                    <option value="FINALIZACAO_VTR">Finalização de VTR</option>
                    <option value="SISTEMA">Sistema / Runtime</option>
                  </select>

                  {/* Filtro Severidade */}
                  <select
                    className="form-input"
                    value={filtroSeveridadeErro}
                    onChange={e => setFiltroSeveridadeErro(e.target.value)}
                    style={{ height: '36px', fontSize: '0.82rem', width: 'auto', borderRadius: '8px' }}
                  >
                    <option value="todas">Todas as Severidades</option>
                    <option value="critico">Crítico</option>
                    <option value="erro">Erro</option>
                    <option value="aviso">Aviso</option>
                  </select>

                  {/* Filtro Status */}
                  <select
                    className="form-input"
                    value={filtroStatusErro}
                    onChange={e => setFiltroStatusErro(e.target.value)}
                    style={{ height: '36px', fontSize: '0.82rem', width: 'auto', borderRadius: '8px' }}
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="pendente">Apenas Pendentes</option>
                    <option value="resolvido">Apenas Resolvidos</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => carregarAcessos()}
                    style={{ height: '36px', padding: '0 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    title="Recarregar logs de erro agora"
                  >
                    <RefreshCw size={14} /> Atualizar
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={marcarTodosErrosResolvidos}
                    disabled={salvandoStatusErro || errorLogs.filter(e => e.status !== 'resolvido').length === 0}
                    style={{ height: '36px', padding: '0 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--bm-green)' }}
                    title="Marcar todos os erros pendentes como resolvidos"
                  >
                    <CheckCircle2 size={14} /> Resolver Todos
                  </button>
                </div>
              </div>

              {/* Tabela de Logs de Erros */}
              <div className="card table-wrapper" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="table" style={{ margin: 0, fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--table-header-bg)' }}>
                      <th>Data / Hora</th>
                      <th>Origem / Módulo</th>
                      <th>Severidade</th>
                      <th>Mensagem do Erro</th>
                      <th>Matrícula / VTR / Usuário</th>
                      <th>Dispositivo / IP</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const termo = buscaErroTexto.trim().toLowerCase();
                      const filtrados = errorLogs.filter(log => {
                        if (filtroOrigemErro !== 'todos' && log.origem !== filtroOrigemErro) return false;
                        if (filtroSeveridadeErro !== 'todas' && log.severidade !== filtroSeveridadeErro) return false;
                        if (filtroStatusErro !== 'todos' && (log.status || 'pendente') !== filtroStatusErro) return false;
                        if (!termo) return true;

                        const str = \`\${log.mensagem || ''} \${log.origem || ''} \${log.matricula || ''} \${log.prefixo_vtr || ''} \${log.usuario_email || ''} \${log.ip || ''} \${JSON.stringify(log.detalhes || {})}\`.toLowerCase();
                        return str.includes(termo);
                      });

                      if (filtrados.length === 0) {
                        return (
                          <tr>
                            <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle size={36} color="var(--bm-green)" opacity={0.6} />
                                <strong>Nenhum erro encontrado com os filtros selecionados.</strong>
                                <span style={{ fontSize: '0.78rem' }}>A aplicação está operando com estabilidade.</span>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return filtrados.map(log => {
                        const isResolvido = log.status === 'resolvido';
                        const origemBadge = {
                          'LOGIN_ADMIN': { label: 'Login Admin', bg: 'rgba(234, 179, 8, 0.15)', color: '#b45309' },
                          'LOGIN_ME': { label: 'Login ME', bg: 'rgba(139, 92, 246, 0.15)', color: '#7c3aed' },
                          'CADASTRO_ME': { label: 'Cadastro ME', bg: 'rgba(59, 130, 246, 0.15)', color: '#2563eb' },
                          'ASSUNCAO_VTR': { label: 'Assunção VTR', bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' },
                          'FINALIZACAO_VTR': { label: 'Finalização VTR', bg: 'rgba(249, 115, 22, 0.15)', color: '#c2410c' },
                          'SISTEMA': { label: 'Sistema', bg: 'rgba(107, 114, 128, 0.15)', color: '#4b5563' }
                        }[log.origem] || { label: log.origem || 'Geral', bg: 'var(--hover-bg)', color: 'var(--text-main)' };

                        const severidadeBadge = {
                          'critico': { label: 'Crítico', bg: 'rgba(239, 68, 68, 0.2)', color: '#b91c1c' },
                          'erro': { label: 'Erro', bg: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' },
                          'aviso': { label: 'Aviso', bg: 'rgba(245, 158, 11, 0.15)', color: '#b45309' }
                        }[log.severidade] || { label: log.severidade || 'Erro', bg: 'var(--hover-bg)', color: 'var(--text-muted)' };

                        return (
                          <tr
                            key={log.id}
                            style={{
                              backgroundColor: isResolvido ? 'transparent' : 'rgba(239, 68, 68, 0.02)',
                              opacity: isResolvido ? 0.75 : 1
                            }}
                          >
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 600 }}>{formatarData(log.timestamp)}</div>
                            </td>
                            <td>
                              <span style={{ backgroundColor: origemBadge.bg, color: origemBadge.color, padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, display: 'inline-block' }}>
                                {origemBadge.label}
                              </span>
                            </td>
                            <td>
                              <span style={{ backgroundColor: severidadeBadge.bg, color: severidadeBadge.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                                {severidadeBadge.label}
                              </span>
                            </td>
                            <td style={{ maxWidth: '300px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.mensagem}>
                                {log.mensagem}
                              </div>
                              {log.detalhes?.erroOriginal && log.detalhes.erroOriginal !== log.mensagem && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {log.detalhes.erroOriginal}
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {log.prefixo_vtr && (
                                  <span style={{ fontWeight: 700, color: 'var(--bm-green)' }}>VTR {log.prefixo_vtr}</span>
                                )}
                                {log.matricula && (
                                  <span style={{ fontSize: '0.74rem', color: 'var(--text-main)' }}>Mat: <strong>{log.matricula}</strong></span>
                                )}
                                {log.usuario_email && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.usuario_email}</span>
                                )}
                                {!log.prefixo_vtr && !log.matricula && !log.usuario_email && (
                                  <span className="text-muted">-</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.75rem' }}>
                                <span>{log.dispositivo || 'Dispositivo N/A'}</span>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{log.ip || 'IP N/A'}</div>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => alternarStatusErro(log.id, log.status)}
                                disabled={salvandoStatusErro}
                                style={{
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  backgroundColor: isResolvido ? 'var(--badge-available-bg)' : 'var(--badge-alert-bg)',
                                  color: isResolvido ? 'var(--badge-available-text)' : 'var(--badge-alert-text)',
                                  transition: 'all 0.15s ease'
                                }}
                                title="Clique para alternar status entre Pendente e Resolvido"
                              >
                                {isResolvido ? '✓ Resolvido' : '● Pendente'}
                              </button>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => setErroSelecionadoModal(log)}
                                  title="Ver diagnóstico e detalhes completos deste erro"
                                  style={{ padding: '4px', color: 'var(--bm-green)' }}
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => alternarStatusErro(log.id, log.status)}
                                  title={isResolvido ? "Marcar como pendente" : "Marcar como resolvido"}
                                  style={{ padding: '4px', color: isResolvido ? 'var(--bm-green)' : 'var(--text-muted)' }}
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => excluirLogErro(log.id)}
                                  title="Excluir este log"
                                  style={{ padding: '4px', color: 'var(--status-alteration)' }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

            </div>
          )}
        </div>
      )}

      `;

content = content.substring(0, idxAcessosStart) + newAcessosSection + content.substring(idxWhatsappStart);

// 6. Inserir erroSelecionadoModal antes de modalRelatorioExecutivo
const modalExecAnchor = "{modalRelatorioExecutivo && (";
const idxModalExec = content.indexOf(modalExecAnchor);
if (idxModalExec === -1) {
  throw new Error('Falha ao encontrar anchor de modalRelatorioExecutivo');
}

const newErrorModal = `
      {/* MODAL DETALHADO: DIAGNÓSTICO TÉCNICO DE ERRO DA APLICAÇÃO */}
      {erroSelecionadoModal && (
        <div className="modal-overlay" onClick={() => setErroSelecionadoModal(null)} style={{ zIndex: 3100 }}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px', width: '100%', borderTopColor: erroSelecionadoModal.severidade === 'critico' ? '#dc2626' : '#f59e0b', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ backgroundColor: erroSelecionadoModal.severidade === 'critico' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: erroSelecionadoModal.severidade === 'critico' ? '#dc2626' : '#b45309', padding: '10px', borderRadius: '10px' }}>
                  <AlertOctagon size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>Diagnóstico do Erro</h3>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>Módulo: <strong>{erroSelecionadoModal.origem}</strong> • Severidade: <strong style={{ textTransform: 'uppercase' }}>{erroSelecionadoModal.severidade}</strong></span>
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={() => setErroSelecionadoModal(null)} style={{ height: '36px', width: '36px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Mensagem Principal */}
            <div style={{ backgroundColor: 'var(--input-bg)', borderLeft: \`4px solid \${erroSelecionadoModal.severidade === 'critico' ? '#dc2626' : '#f59e0b'}\`, padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Mensagem Registrada</label>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.4 }}>
                {erroSelecionadoModal.mensagem}
              </div>
            </div>

            {/* Metadados Técnicos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ backgroundColor: 'var(--hover-bg)', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Data e Horário</span>
                <strong style={{ fontSize: '0.85rem' }}>{formatarData(erroSelecionadoModal.timestamp)}</strong>
              </div>
              <div style={{ backgroundColor: 'var(--hover-bg)', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Status do Chamado</span>
                <strong style={{ fontSize: '0.85rem', color: erroSelecionadoModal.status === 'resolvido' ? 'var(--status-available)' : 'var(--status-warning)' }}>
                  {erroSelecionadoModal.status === 'resolvido' ? '✓ Resolvido' : '● Pendente de Correção'}
                </strong>
              </div>
              {erroSelecionadoModal.matricula && (
                <div style={{ backgroundColor: 'var(--hover-bg)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Matrícula Envolvida</span>
                  <strong style={{ fontSize: '0.85rem' }}>{erroSelecionadoModal.matricula}</strong>
                </div>
              )}
              {erroSelecionadoModal.prefixo_vtr && (
                <div style={{ backgroundColor: 'var(--hover-bg)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Viatura</span>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--bm-green)' }}>VTR {erroSelecionadoModal.prefixo_vtr}</strong>
                </div>
              )}
              {erroSelecionadoModal.ip && (
                <div style={{ backgroundColor: 'var(--hover-bg)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>IP do Cliente</span>
                  <strong style={{ fontSize: '0.85rem' }}>{erroSelecionadoModal.ip}</strong>
                </div>
              )}
              {erroSelecionadoModal.dispositivo && (
                <div style={{ backgroundColor: 'var(--hover-bg)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Dispositivo / Rota</span>
                  <strong style={{ fontSize: '0.85rem' }}>{erroSelecionadoModal.dispositivo} • {erroSelecionadoModal.url || '/'}</strong>
                </div>
              )}
            </div>

            {/* Parâmetros e Contexto de Execução */}
            {erroSelecionadoModal.detalhes && Object.keys(erroSelecionadoModal.detalhes).length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Parâmetros Capturados no Momento da Falha
                  </label>
                  <button
                    type="button"
                    onClick={() => copiarDiagnosticoErro(erroSelecionadoModal)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bm-green)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  >
                    <Copy size={13} /> {copiadoDiag ? 'Copiado!' : 'Copiar Diagnóstico'}
                  </button>
                </div>
                <div style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', maxHeight: '180px', overflowY: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '0.78rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>
                    {JSON.stringify(erroSelecionadoModal.detalhes, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Stack Trace / Erro Original */}
            {erroSelecionadoModal.detalhes?.stackTrace && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--status-alteration)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  Stack Trace Técnico
                </label>
                <div style={{ backgroundColor: '#1e1e1e', color: '#f87171', border: '1px solid #374151', borderRadius: '8px', padding: '10px 14px', maxHeight: '140px', overflowY: 'auto', fontSize: '0.72rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  {erroSelecionadoModal.detalhes.stackTrace}
                </div>
              </div>
            )}

            {/* Botões de Ação do Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className={\`btn \${erroSelecionadoModal.status === 'resolvido' ? 'btn-secondary' : 'btn-primary'}\`}
                  onClick={() => alternarStatusErro(erroSelecionadoModal.id, erroSelecionadoModal.status)}
                  disabled={salvandoStatusErro}
                  style={{ height: '36px', padding: '0 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={16} />
                  {erroSelecionadoModal.status === 'resolvido' ? 'Reabrir Erro' : 'Marcar como Resolvido'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => excluirLogErro(erroSelecionadoModal.id)}
                  style={{ height: '36px', padding: '0 12px', fontSize: '0.85rem' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setErroSelecionadoModal(null)}
                style={{ height: '36px', padding: '0 16px', fontSize: '0.85rem' }}
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}
`;

content = content.substring(0, idxModalExec) + newErrorModal + '\n\n      ' + content.substring(idxModalExec);

fs.writeFileSync(adminPath, content, 'utf8');
console.log('Successfully updated Admin.jsx with Error Logging view in Acessos!');

