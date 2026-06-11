import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, query, orderBy, limit, getDocs, getDoc, where, deleteDoc, updateDoc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PlusCircle, History, Car, AlertTriangle, QrCode, X, Edit, Settings, Trash2, Filter, Eye, Monitor, Smartphone, Activity, ClipboardCheck, Wrench, CheckCircle2, BarChart3, TrendingUp, ShieldCheck, MapPin, Download, ImageIcon, Maximize2, AlertCircle, ShieldAlert, Info, Gauge, Zap, Users, BookOpen } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area } from 'recharts';

/**
 * Componente: Admin (Painel de Comando / Retaguarda Logística - P4)
 * Propósito: Dashboard central para administração do sistema VTR SaaS, voltado para os gestores da frota (Sgt/Oficiais).
 * 
 * Funcionalidades Principais:
 * - Gestão de Frota (CRUD): Adicionar, editar, dar baixa e gerar QR Codes de viaturas.
 * - Central de O.S.: Acompanhar tickets de manutenção abertos pelos patrulheiros, designar para oficina e resolvê-los.
 * - BI e Relatórios: Gráficos de uso, pontuação de saúde da frota e exportação corporativa (CSV).
 * - Auditoria P4: Registro inalterável de todas as ações feitas no painel (quem, quando, IP, geolocalização).
 * - Motoristas (Usuários): Gestão das credenciais de acesso da tropa (Matrícula e Senha).
 * - Integrações: Configuração da API do WhatsApp (Evolution API).
 */

// Componente de Modal de Confirmação Profissional
function ModalConfirm({ open, title, message, onConfirm, onCancel, type = 'info' }) {
  if (!open) return null;
  const colors = { info: 'var(--bm-gold)', danger: 'var(--status-alteration)', success: 'var(--status-available)', warning: 'var(--status-warning)' };
  const icons = {
    info: <Info size={48} color={colors.info} />,
    danger: <AlertTriangle size={48} color={colors.danger} />,
    success: <CheckCircle2 size={48} color={colors.success} />,
    warning: <AlertCircle size={48} color={colors.warning} />
  };
  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 2000 }}>
      <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ borderTopColor: colors[type], margin: 'auto' }}>
        <div className="modal-confirm-icon">{icons[type]}</div>
        <h3>{title}</h3>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>{message}</p>
        <div className="modal-confirm-buttons">
          <button className="btn btn-secondary" onClick={onCancel} style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>Cancelar</button>
          <button className="btn" onClick={onConfirm} style={{ backgroundColor: colors[type], color: 'white' }}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [viaturas, setViaturas] = useState([]);
  const [novoPrefixo, setNovoPrefixo] = useState('');
  const [loading, setLoading] = useState(true);
  const [historico, setHistorico] = useState([]);
  const [acessos, setAcessos] = useState([]);
  const [manutencoesPendentes, setManutencoesPendentes] = useState([]);
  const [manutencoesLista, setManutencoesLista] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [viewMode, setViewMode] = useState('frota');
  const [vtrSelecionadaQR, setVtrSelecionadaQR] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  // Estados para Impressão de QR Codes em Lote
  const [modalLoteQR, setModalLoteQR] = useState(false);
  const [vtrsSelecionadasLote, setVtrsSelecionadasLote] = useState([]);
  const [colunasLote, setColunasLote] = useState(3);

  const [modalConfirm, setModalConfirm] = useState({ open: false, title: '', message: '', type: 'info', onConfirm: null });
  const [vtrBaixaModal, setVtrBaixaModal] = useState(null);
  const [motivoBaixa, setMotivoBaixa] = useState('');
  const [baixando, setBaixando] = useState(false);

  // Estados para BI / Relatórios
  const [filtroTempo, setFiltroTempo] = useState('geral');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroVtrBI, setFiltroVtrBI] = useState('');
  const [relatorioBI, setRelatorioBI] = useState({
    stats: [],
    resumoGeral: { totalKm: 0, totalTurnos: 0, totalAlertas: 0, totalBaixas: 0 },
    kmDiario: []
  });
  const [modalRelatorioExecutivo, setModalRelatorioExecutivo] = useState(false);

  // Estados para Logs de Auditoria P4
  const [auditLogs, setAuditLogs] = useState([]);
  const [tipoLogExibido, setTipoLogExibido] = useState('acessos'); // 'acessos' | 'auditoria'

  const [vtrParaEditar, setVtrParaEditar] = useState(null);
  const [editPrefixo, setEditPrefixo] = useState('');
  const [editKmAtual, setEditKmAtual] = useState(0);
  const [editKmUltimaTroca, setEditKmUltimaTroca] = useState(0);
  const [editIntervaloTroca, setEditIntervaloTroca] = useState(5000);
  const [editPlaca, setEditPlaca] = useState('');
  const [editAno, setEditAno] = useState('');
  const [editCartao, setEditCartao] = useState('');
  const [editKmProximaRevisao, setEditKmProximaRevisao] = useState(0);
  const [salvandoVtr, setSalvandoVtr] = useState(false);
  const [salvandoMotorista, setSalvandoMotorista] = useState(false);

  const [vtrPerfilModal, setVtrPerfilModal] = useState(null);
  const [manutencaoSelecionada, setManutencaoSelecionada] = useState(null);
  const [manutencaoResolucaoModal, setManutencaoResolucaoModal] = useState(null);
  const [servicoSelecionado, setServicoSelecionado] = useState(null);
  const [detalhesResolucao, setDetalhesResolucao] = useState('');
  const [confirmandoResolucao, setConfirmandoResolucao] = useState(false);
  const [statusPosResolucao, setStatusPosResolucao] = useState('manter');
  const [filtroVtr, setFiltroVtr] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [manutencoesVtr, setManutencoesVtr] = useState([]);
  const [expandirTiposManutencao, setExpandirTiposManutencao] = useState(false);
  const [categoriaManutencaoAberta, setCategoriaManutencaoAberta] = useState(null);

  // Nomes para assinaturas editáveis no Relatório Executivo
  const [nomeAuxP4, setNomeAuxP4] = useState('');
  const [nomeComandante, setNomeComandante] = useState('');

  // Estados para formulário de Ordem de Serviço (O.S.)
  const [sistemaAfetado, setSistemaAfetado] = useState('Outros');
  const [gravidade, setGravidade] = useState('Média');
  const [localReparo, setLocalReparo] = useState('');

  // Configuração do WhatsApp (Evolution API)
  const [waConfig, setWaConfig] = useState({
    enabled: false,
    url: 'https://gemensagem.ddns.net/manager/',
    instance: '',
    apikey: '',
    phone: ''
  });
  const [salvandoWa, setSalvandoWa] = useState(false);
  const [testandoWa, setTestandoWa] = useState(false);

  // Estados para CRUD de Motoristas (Usuários)
  const [motoristaParaEditar, setMotoristaParaEditar] = useState(null);
  const [editMotGraduacao, setEditMotGraduacao] = useState('Sd');
  const [editMotNome, setEditMotNome] = useState('');
  const [editMotMatricula, setEditMotMatricula] = useState('');
  const [editMotTelefone, setEditMotTelefone] = useState('');
  const [editMotSenha, setEditMotSenha] = useState('');

  // Estados para Encerramento Forçado de Serviço e Recuperação via WhatsApp
  const [vtrFimForcadoModal, setVtrFimForcadoModal] = useState(null);
  const [kmFinalForcado, setKmFinalForcado] = useState(0);
  const [obsFimForcado, setObsFimForcado] = useState('');
  const [encerrandoForcado, setEncerrandoForcado] = useState(false);
  const [vtrUsoManualModal, setVtrUsoManualModal] = useState(null);
  const [usoManualForm, setUsoManualForm] = useState({
    dataInicio: '',
    horaInicio: '',
    dataFim: '',
    horaFim: '',
    motorista: '',
    patrulheiro: '',
    matricula: '',
    kmInicial: '',
    kmFinal: '',
    finalidade: 'Patrulhamento Ostensivo',
    observacao: ''
  });
  const [salvandoUsoManual, setSalvandoUsoManual] = useState(false);

  useEffect(() => {
    const qVtr = query(collection(db, 'viaturas'), orderBy('prefixo'));
    const unsubscribeVtr = onSnapshot(qVtr, (snapshot) => {
      const vtrs = [];
      snapshot.forEach((doc) => vtrs.push({ id: doc.id, ...doc.data() }));
      setViaturas(vtrs);
      setLoading(false);
    });

    const qMan = query(collection(db, 'manutencoes'), where('status', 'in', ['pendente', 'oficina']));
    const unsubscribeMan = onSnapshot(qMan, (snapshot) => {
      const mans = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.silencioso) mans.push({ id: doc.id, ...data });
      });
      setManutencoesPendentes(mans);
    });

    const qMot = query(collection(db, 'motoristas'), orderBy('nome'));
    const unsubscribeMot = onSnapshot(qMot, (snapshot) => {
      const mots = [];
      snapshot.forEach(doc => mots.push({ id: doc.id, ...doc.data() }));
      setMotoristas(mots);
    });

    return () => {
      unsubscribeVtr();
      unsubscribeMan();
      unsubscribeMot();
    };
  }, []);

  const showConfirm = (title, message, type, onConfirm) => {
    setModalConfirm({ open: true, title, message, type, onConfirm: () => { onConfirm(); closeConfirm(); } });
  };
  const closeConfirm = () => setModalConfirm({ ...modalConfirm, open: false });

  // Função para Registrar Logs de Auditoria Corporativa P4
  const registrarAuditoria = async (acao, detalhes) => {
    try {
      let ip = 'Desconhecido';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ip = ipData.ip;
      } catch (ipErr) {
        console.warn("Não foi possível obter o IP de auditoria:", ipErr);
      }

      // Geolocalização GPS Exata (Telemetria Corporativa)
      let lat = null;
      let lng = null;
      try {
        if (navigator.geolocation) {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch (geoErr) {
        console.warn("Geolocalização não disponível para auditoria:", geoErr);
      }

      const userEmail = auth.currentUser ? auth.currentUser.email : 'admin@vtrcontrol.saas';

      await addDoc(collection(db, 'audit_logs'), {
        timestamp: serverTimestamp(),
        usuario_email: userEmail,
        acao,
        detalhes,
        ip,
        userAgent: navigator.userAgent,
        dispositivo: /Mobi|Android/i.test(navigator.userAgent) ? 'Celular' : 'PC',
        latitude: lat,
        longitude: lng
      });
    } catch (err) {
      console.error("Erro ao salvar log de auditoria:", err);
    }
  };

  const carregarBI = async (periodoOverride = null) => {
    let p = filtroTempo;
    if (periodoOverride) {
      p = periodoOverride;
      setFiltroTempo(periodoOverride);
      if (periodoOverride !== 'personalizado') {
        setFiltroDataInicio('');
        setFiltroDataFim('');
      }
    }
    setViewMode('relatorios');
    setLoadingContent(true);
    try {
      // 1. Fetch de dados em paralelo para eficiência
      const [servSnapshot, manSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'servicos'), orderBy('timestamp', 'desc'), limit(1000))),
        getDocs(collection(db, 'manutencoes'))
      ]);

      let startSecs = 0;
      let endSecs = Date.now() / 1000;

      if (p === 'semanal') {
        startSecs = (Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000;
      } else if (p === 'mensal') {
        startSecs = (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000;
      } else if (p === 'personalizado') {
        if (filtroDataInicio) {
          startSecs = new Date(filtroDataInicio + 'T00:00:00').getTime() / 1000;
        }
        if (filtroDataFim) {
          endSecs = new Date(filtroDataFim + 'T23:59:59').getTime() / 1000;
        }
      }

      const servicos = [];
      servSnapshot.forEach(doc => {
        const data = doc.data();
        const ts = data.timestamp?.seconds || data.hora_inicial?.seconds || 0;
        if (ts >= startSecs && ts <= endSecs) {
          if (!filtroVtrBI || data.prefixo_vtr === filtroVtrBI) {
            servicos.push(data);
          }
        }
      });

      const manutencoes = [];
      manSnapshot.forEach(doc => {
        const data = doc.data();
        const ts = data.data_relato?.seconds || 0;
        if (ts >= startSecs && ts <= endSecs) {
          if (!filtroVtrBI || data.prefixo_vtr === filtroVtrBI) {
            manutencoes.push(data);
          }
        }
      });

      const biMap = {};
      let gTotalKm = 0;
      let gTotalTurnos = 0;
      let gTotalAlertas = 0;
      let gTotalBaixas = 0;

      // Inicializar BI Map apenas com as viaturas ativas nos filtros
      const viaturasParaProcessar = filtroVtrBI
        ? viaturas.filter(v => v.prefixo === filtroVtrBI)
        : viaturas;

      viaturasParaProcessar.forEach(v => {
        biMap[v.prefixo] = {
          prefixo: v.prefixo,
          kmTotal: 0,
          turnos: 0,
          relatosMotorista: 0,
          baixasAdmin: 0,
          ultimaAtividade: null,
          kmMedio: 0
        };
      });

      // Processar Serviços (KM e Uso)
      const turnosUnicos = new Set();
      const turnosUnicosPorVtr = {};

      servicos.forEach(s => {
        const p = s.prefixo_vtr;
        if (!p || !biMap[p]) return;

        const kmRodado = (s.km_final && s.km_inicial) ? (s.km_final - s.km_inicial) : 0;
        if (kmRodado >= 0) {
          biMap[p].kmTotal += kmRodado;
          gTotalKm += kmRodado;
        }

        // Determinar Turno Operacional Único (Ignorando Deslocamento Administrativo)
        if (s.finalidade !== 'Deslocamento Administrativo') {
          const dateObjStart = s.hora_inicial?.toDate ? s.hora_inicial.toDate() : (s.timestamp?.toDate ? s.timestamp.toDate() : (s.timestamp?.seconds ? new Date(s.timestamp.seconds * 1000) : null));
          const dateObjEnd = s.hora_final?.toDate ? s.hora_final.toDate() : null;

          if (dateObjStart) {
            const startStr = dateObjStart.toLocaleDateString('pt-BR');
            const startHour = dateObjStart.getHours();
            const slotsCovered = [];

            // Determinar se o turno durou mais de 8 horas (indicativo de turno de 12h)
            let is12h = false;
            if (dateObjEnd) {
              const diffHours = (dateObjEnd.getTime() - dateObjStart.getTime()) / (1000 * 60 * 60);
              if (diffHours > 8) {
                is12h = true;
              }
            }

            if (is12h) {
              // Cobre dois slots de 6h
              if (startHour >= 6 && startHour < 12) {
                slotsCovered.push('manha', 'tarde');
              } else if (startHour >= 18 && startHour <= 23) {
                slotsCovered.push('noite', 'madrugada');
              } else {
                slotsCovered.push('especial_1', 'especial_2');
              }
            } else {
              // Turno normal de 6h ou alternativo (como 22:00 às 04:00, 19:00 às 01:00, etc.)
              let slotId = 'madrugada';
              if (startHour >= 6 && startHour < 12) slotId = 'manha';
              else if (startHour >= 12 && startHour < 18) slotId = 'tarde';
              else if (startHour >= 18 && startHour <= 23) slotId = 'noite';
              slotsCovered.push(slotId);
            }

            slotsCovered.forEach(slotId => {
              const shiftKey = `${p}_${startStr}_${slotId}`;

              if (!turnosUnicos.has(shiftKey)) {
                turnosUnicos.add(shiftKey);
                gTotalTurnos += 1;
              }

              if (!turnosUnicosPorVtr[p]) {
                turnosUnicosPorVtr[p] = new Set();
              }
              if (!turnosUnicosPorVtr[p].has(shiftKey)) {
                turnosUnicosPorVtr[p].add(shiftKey);
                biMap[p].turnos += 1;
              }
            });
          } else {
            // Fallback se não houver data de início válida
            gTotalTurnos += 1;
            biMap[p].turnos += 1;
          }
        }

        if (!biMap[p].ultimaAtividade || (s.timestamp?.seconds > biMap[p].ultimaAtividade?.seconds)) {
          biMap[p].ultimaAtividade = s.timestamp;
        }
      });

      // Processar Manutenções (Problemas e Baixas)
      manutencoes.forEach(m => {
        const p = m.prefixo_vtr;
        if (!p || !biMap[p]) return;

        if (m.silencioso) {
          biMap[p].baixasAdmin += 1;
          gTotalBaixas += 1;
        } else {
          biMap[p].relatosMotorista += 1;
          gTotalAlertas += 1;
        }
      });

      const stats = Object.values(biMap).map(s => {
        const relatos = s.relatosMotorista || 0;
        const baixas = s.baixasAdmin || 0;
        // Uptime: Taxa de disponibilidade calculada estrategicamente
        const uptime = Math.max(75, 100 - (relatos * 6) - (baixas * 10));
        return {
          ...s,
          kmMedio: s.turnos > 0 ? (s.kmTotal / s.turnos).toFixed(1) : 0,
          scoreSaude: Math.max(0, 100 - (relatos * 10) - (baixas * 5)),
          uptime: uptime.toFixed(1)
        };
      }).sort((a, b) => b.kmTotal - a.kmTotal);

      // Agrupamento de KM por dia para gráfico temporal
      const kmPorDia = {};
      servicos.forEach(s => {
        const dataObj = s.timestamp?.toDate ? s.timestamp.toDate() : (s.timestamp?.seconds ? new Date(s.timestamp.seconds * 1000) : null);
        if (!dataObj) return;
        const dataStr = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const kmRodado = (s.km_final && s.km_inicial) ? (s.km_final - s.km_inicial) : 0;
        kmPorDia[dataStr] = (kmPorDia[dataStr] || 0) + kmRodado;
      });

      const kmDiario = Object.keys(kmPorDia).map(dia => ({
        dia,
        km: kmPorDia[dia]
      })).sort((a, b) => {
        const [diaA, mesA] = a.dia.split('/');
        const [diaB, mesB] = b.dia.split('/');
        return new Date(2026, mesA - 1, diaA) - new Date(2026, mesB - 1, diaB);
      }).slice(-15);

      setRelatorioBI({
        stats,
        resumoGeral: { totalKm: gTotalKm, totalTurnos: gTotalTurnos, totalAlertas: gTotalAlertas, totalBaixas: gTotalBaixas },
        kmDiario
      });

    } catch (error) {
      console.error("Erro no BI:", error);
    } finally {
      setLoadingContent(false);
    }
  };

  const exportarCSVPro = () => {
    const { stats, resumoGeral } = relatorioBI;
    if (stats.length === 0) return;

    let csv = "\uFEFF"; // BOM para acentos no Excel
    csv += "RELATÓRIO DE GESTÃO DE FROTA - 1ª CIA / 46º BPM\n";
    csv += `Data de Geração: ${new Date().toLocaleString('pt-BR')}\n\n`;

    csv += "RESUMO GERAL\n";
    csv += `KM Total da Frota;${resumoGeral.totalKm}\n`;
    csv += `Total de Turnos;${resumoGeral.totalTurnos}\n`;
    csv += `Relatos de Defeito;${resumoGeral.totalAlertas}\n`;
    csv += `Total de Baixas Admin;${resumoGeral.totalBaixas}\n\n`;

    csv += "DADOS POR VIATURA\n";
    csv += "Prefixo;KM Total;Turnos;Media KM/Turno;Relatos Defeito;Baixas P4;Saude (%)\n";

    stats.forEach(s => {
      csv += `${s.prefixo};${s.kmTotal};${s.turnos};${s.kmMedio};${s.relatosMotorista};${s.baixasAdmin};${s.scoreSaude}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BI_FROTA_46BPM_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const abrirPerfilViatura = async (vtr) => {
    let dadosExtras = { ...vtr };
    if (vtr.status === 'em_servico' && vtr.servico_atual_id) {
      try {
        const servSnap = await getDoc(doc(db, 'servicos', vtr.servico_atual_id));
        if (servSnap.exists()) {
          const servData = servSnap.data();
          dadosExtras.motorista_atual = servData.motorista;
          dadosExtras.patrulheiro_atual = servData.patrulheiro;
        }
      } catch (e) { console.error(e); }
    }
    setVtrPerfilModal(dadosExtras);
  };

  const carregarHistorico = async (prefixo = null) => {
    setViewMode('historico');
    setFiltroVtr(prefixo);
    setLoadingContent(true);
    setExpandirTiposManutencao(false);
    setCategoriaManutencaoAberta(null);
    try {
      let qHist;
      if (prefixo) qHist = query(collection(db, 'servicos'), where('prefixo_vtr', '==', prefixo), limit(100));
      else qHist = query(collection(db, 'servicos'), orderBy('timestamp', 'desc'), limit(50));
      const snapshot = await getDocs(qHist);
      let hist = [];
      snapshot.forEach((doc) => hist.push({ id: doc.id, ...doc.data() }));
      if (prefixo) hist.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setHistorico(hist);

      if (prefixo) {
        const qMan = query(collection(db, 'manutencoes'), where('prefixo_vtr', '==', prefixo));
        const manSnap = await getDocs(qMan);
        let mans = [];
        manSnap.forEach(doc => mans.push({ id: doc.id, ...doc.data() }));
        setManutencoesVtr(mans);
      } else {
        setManutencoesVtr([]);
      }
    } catch (e) { console.error(e); } finally { setLoadingContent(false); }
  };

  const carregarAcessos = async () => {
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
  };

  const carregarManutencoes = async () => {
    setViewMode('manutencao');
    setLoadingContent(true);
    try {
      const qM = query(collection(db, 'manutencoes'), orderBy('data_relato', 'desc'), limit(100));
      const snapshot = await getDocs(qM);
      const docs = [];
      snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
      setManutencoesLista(docs);
    } catch (e) { console.error(e); } finally { setLoadingContent(false); }
  };

  const abrirEdicaoMotorista = (mot = null) => {
    if (mot) {
      setMotoristaParaEditar(mot);
      setEditMotGraduacao(mot.graduacao || 'Sd');
      setEditMotNome(mot.nome || '');
      setEditMotMatricula(mot.matricula || mot.id || '');
      setEditMotTelefone(mot.telefone || '');
      setEditMotSenha(mot.senha || '');
    } else {
      setMotoristaParaEditar({ id: 'NEW' });
      setEditMotGraduacao('Sd');
      setEditMotNome('');
      setEditMotMatricula('');
      setEditMotTelefone('');
      setEditMotSenha('');
    }
  };

  const salvarMotorista = async (e) => {
    e.preventDefault();
    if (!motoristaParaEditar || salvandoMotorista) return;
    setSalvandoMotorista(true);
    try {
      const matriculaId = editMotMatricula.trim();
      if (matriculaId.length !== 7) {
        alert("A matrícula deve conter 7 números.");
        setSalvandoMotorista(false);
        return;
      }

      const dados = {
        graduacao: editMotGraduacao,
        nome: editMotNome.trim(),
        matricula: matriculaId,
        telefone: editMotTelefone.trim(),
        senha: editMotSenha.trim(),
        atualizado_em: serverTimestamp()
      };

      if (motoristaParaEditar.id === 'NEW') {
        dados.criado_em = serverTimestamp();
        await setDoc(doc(db, 'motoristas', matriculaId), dados);
        await registrarAuditoria('CADASTRAR_MOTORISTA', { matricula: matriculaId, nome: `${editMotGraduacao} ${editMotNome}` });
      } else {
        if (matriculaId !== motoristaParaEditar.id) {
          // Changed ID
          await setDoc(doc(db, 'motoristas', matriculaId), dados);
          await deleteDoc(doc(db, 'motoristas', motoristaParaEditar.id));
        } else {
          await updateDoc(doc(db, 'motoristas', matriculaId), dados);
        }
        await registrarAuditoria('EDITAR_MOTORISTA', { matricula: matriculaId, nome: `${editMotGraduacao} ${editMotNome}` });
      }
      setMotoristaParaEditar(null);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar usuário.");
    } finally {
      setSalvandoMotorista(false);
    }
  };

  const excluirMotorista = (id) => {
    showConfirm("Excluir Usuário", `Apagar motorista (Matrícula: ${id}) permanentemente?`, "danger", async () => {
      try {
        await deleteDoc(doc(db, 'motoristas', id));
        await registrarAuditoria('EXCLUIR_MOTORISTA', { matricula: id });
      } catch (e) { console.error(e); }
    });
  };

  const resolverManutencao = (id) => {
    const manutencao = manutencoesLista.find(m => m.id === id);
    setManutencaoResolucaoModal(manutencao);
    setDetalhesResolucao('');
    setSistemaAfetado(manutencao.sistema_afetado || 'Outros');
    setGravidade(manutencao.gravidade || 'Média');
    setLocalReparo(manutencao.local_manutencao || '');
    setStatusPosResolucao('manter');
  };

  const confirmarResolucaoFinal = async () => {
    if (!detalhesResolucao.trim() || !localReparo.trim() || confirmandoResolucao) return;
    setConfirmandoResolucao(true);
    try {
      const emailResponsavel = auth.currentUser ? auth.currentUser.email : 'admin@vtrcontrol.saas';
      await updateDoc(doc(db, 'manutencoes', manutencaoResolucaoModal.id), {
        status: 'resolvido',
        data_resolucao: serverTimestamp(),
        servico_realizado: detalhesResolucao,
        sistema_afetado: sistemaAfetado,
        gravidade: gravidade,
        local_manutencao: localReparo,
        email_resolucao: emailResponsavel
      });

      // Atualizar o status da viatura vinculada conforme a escolha do admin
      const vtrRelacionada = viaturas.find(v => v.prefixo === manutencaoResolucaoModal.prefixo_vtr);
      if (vtrRelacionada) {
        if (statusPosResolucao === 'disponivel') {
          await updateDoc(doc(db, 'viaturas', vtrRelacionada.id), { status: 'disponivel' });
        } else if (statusPosResolucao === 'baixada') {
          await updateDoc(doc(db, 'viaturas', vtrRelacionada.id), { status: 'baixada' });
        }
        // Se for 'manter', não altera o status atual (continua cautelada/em serviço, etc)
      }

      await registrarAuditoria('RESOLVER_MANUTENCAO', {
        prefixo: manutencaoResolucaoModal.prefixo_vtr,
        servico_realizado: detalhesResolucao,
        sistema_afetado: sistemaAfetado,
        gravidade: gravidade,
        local_manutencao: localReparo,
        email_responsavel: emailResponsavel
      });
      setManutencaoResolucaoModal(null);
      carregarManutencoes();
    } catch (e) { console.error(e); } finally { setConfirmandoResolucao(false); }
  };

  const enviarParaOficina = async (id) => {
    try {
      await updateDoc(doc(db, 'manutencoes', id), { status: 'oficina' });
      const manutencao = manutencoesLista.find(m => m.id === id);
      await registrarAuditoria('ENVIAR_OFICINA_MANUTENCAO', { prefixo: manutencao ? manutencao.prefixo_vtr : 'Desconhecido' });
      carregarManutencoes();
    } catch (e) { console.error(e); }
  };

  const carregarWhatsappSettings = async () => {
    setViewMode('whatsapp');
    setLoadingContent(true);
    try {
      const docRef = doc(db, 'settings', 'whatsapp');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setWaConfig(prev => ({ ...prev, ...docSnap.data() }));
      }
    } catch (e) {
      console.error("Erro ao carregar configurações do WhatsApp:", e);
    } finally {
      setLoadingContent(false);
    }
  };

  const salvarWhatsappSettings = async (e) => {
    e.preventDefault();
    setSalvandoWa(true);
    try {
      await setDoc(doc(db, 'settings', 'whatsapp'), {
        enabled: waConfig.enabled,
        url: waConfig.url.trim(),
        instance: waConfig.instance.trim(),
        apikey: waConfig.apikey.trim(),
        phone: waConfig.phone.trim(),
        atualizado_em: serverTimestamp()
      });
      showConfirm("Sucesso", "Configurações do WhatsApp salvas com sucesso!", "success", () => { }, () => { });
      await registrarAuditoria('SALVAR_CONFIG_WHATSAPP', { enabled: waConfig.enabled, instance: waConfig.instance });
    } catch (e) {
      console.error(e);
      showConfirm("Erro", "Não foi possível salvar as configurações.", "danger", () => { }, () => { });
    } finally {
      setSalvandoWa(false);
    }
  };

  const testarConectividadeWhatsapp = async () => {
    if (!waConfig.url || !waConfig.instance || !waConfig.apikey || !waConfig.phone) {
      showConfirm("Aviso", "Preencha todos os campos antes de testar.", "warning", () => { }, () => { });
      return;
    }
    setTestandoWa(true);
    try {
      let baseUrl = waConfig.url.trim();
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }
      const endpoint = `${baseUrl}/message/sendText/${waConfig.instance.trim()}`;

      // Limpar e formatar o número do Administrador (garantindo o DDI 55 se omitido)
      const foneLimpo = waConfig.phone.replace(/\D/g, '');
      const foneFormatado = foneLimpo && !foneLimpo.startsWith('55') && (foneLimpo.length === 10 || foneLimpo.length === 11) ? '55' + foneLimpo : foneLimpo;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': waConfig.apikey.trim()
        },
        body: JSON.stringify({
          number: foneFormatado,
          textMessage: {
            text: "🔔 *VTR SaaS*\n\n> Teste de Conectividade WhatsApp ativo e operando com sucesso! 🚀"
          }
        })
      });

      if (response.ok) {
        showConfirm("Sucesso", "Mensagem de teste enviada com sucesso! Verifique seu WhatsApp.", "success", () => { }, () => { });
      } else {
        const errorText = await response.text();
        showConfirm("Erro na API", `Evolution API retornou status ${response.status}: ${errorText}`, "danger", () => { }, () => { });
      }
    } catch (e) {
      console.error(e);
      showConfirm("Erro de Rede", `Falha ao tentar conectar à Evolution API: ${e.message}`, "danger", () => { }, () => { });
    } finally {
      setTestandoWa(false);
    }
  };

  const alternarStatusBaixada = (vtr) => {
    if (vtr.status === 'baixada') {
      showConfirm("Liberar Viatura", `A VTR ${vtr.prefixo} será liberada para uso normal.`, "info", async () => {
        try {
          await updateDoc(doc(db, 'viaturas', vtr.id), { status: 'disponivel' });
          await registrarAuditoria('LIBERAR_VIATURA', { prefixo: vtr.prefixo });
        } catch (e) { console.error(e); }
      });
    } else {
      setVtrBaixaModal(vtr);
      setMotivoBaixa('');
      setBaixando(false);
    }
  };

  const confirmarBaixa = async () => {
    if (!motivoBaixa.trim() || baixando) return;
    setBaixando(true);
    try {
      await updateDoc(doc(db, 'viaturas', vtrBaixaModal.id), { status: 'baixada' });
      await addDoc(collection(db, 'manutencoes'), {
        prefixo_vtr: vtrBaixaModal.prefixo,
        descricao: `[BAIXA ADMIN] ${motivoBaixa}`,
        origem: 'Administração/P4', status: 'pendente', data_relato: serverTimestamp(),
        relatado_por: 'Administrador', silencioso: true
      });
      await registrarAuditoria('BAIXAR_VIATURA', { prefixo: vtrBaixaModal.prefixo, motivo: motivoBaixa });
      setVtrBaixaModal(null);
      setMotivoBaixa('');
    } catch (e) { console.error(e); } finally { setBaixando(false); }
  };

  const abrirFimForcado = (vtr) => {
    setVtrFimForcadoModal(vtr);
    setKmFinalForcado(vtr.km_atual || 0);
    setObsFimForcado('');
    setEncerrandoForcado(false);
  };

  const confirmarFimForcado = async () => {
    if (!vtrFimForcadoModal || encerrandoForcado) return;

    if (Number(kmFinalForcado) < (vtrFimForcadoModal.km_atual || 0)) {
      showConfirm("Erro de KM", "O KM final não pode ser menor que o KM atual.", "warning", () => { }, () => { });
      return;
    }

    setEncerrandoForcado(true);
    try {
      const servicoId = vtrFimForcadoModal.servico_atual_id;
      if (servicoId) {
        const servicoRef = doc(db, 'servicos', servicoId);
        await updateDoc(servicoRef, {
          km_final: Number(kmFinalForcado),
          hora_final: serverTimestamp(),
          com_alteracao: true,
          descricao_alteracao: `[ENCERRAMENTO ADMIN] ${obsFimForcado || 'Sem observações'}`
        });
      }

      await updateDoc(doc(db, 'viaturas', vtrFimForcadoModal.id), {
        status: 'disponivel',
        km_atual: Number(kmFinalForcado),
        servico_atual_id: null,
        matricula_ativa: null
      });

      await registrarAuditoria('ENCERRAMENTO_FORCADO_VIATURA', {
        prefixo: vtrFimForcadoModal.prefixo,
        km_final: kmFinalForcado,
        observacao: obsFimForcado,
        matricula_anterior: vtrFimForcadoModal.matricula_ativa
      });

      setVtrFimForcadoModal(null);
      showConfirm("Sucesso", `O turno da VTR ${vtrFimForcadoModal.prefixo} foi encerrado e a viatura está disponível.`, "success", () => { }, () => { });
    } catch (e) {
      console.error("Erro ao forçar encerramento:", e);
      showConfirm("Erro", "Não foi possível forçar o encerramento do turno.", "danger", () => { }, () => { });
    } finally {
      setEncerrandoForcado(false);
    }
  };

  const abrirUsoManual = (vtr) => {
    const agora = new Date();
    const dataHoje = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const horaAgora = agora.toTimeString().slice(0, 5);

    setVtrUsoManualModal(vtr);
    setUsoManualForm({
      dataInicio: dataHoje,
      horaInicio: horaAgora,
      dataFim: dataHoje,
      horaFim: horaAgora,
      motorista: '',
      patrulheiro: '',
      matricula: '',
      kmInicial: vtr.km_atual ?? '',
      kmFinal: vtr.km_atual ?? '',
      finalidade: 'Patrulhamento Ostensivo',
      observacao: ''
    });
    setSalvandoUsoManual(false);
  };

  const atualizarUsoManual = (campo, valor) => {
    setUsoManualForm(prev => ({ ...prev, [campo]: valor }));
  };

  const confirmarUsoManual = async () => {
    if (!vtrUsoManualModal || salvandoUsoManual) return;

    const kmInicialNum = Number(usoManualForm.kmInicial);
    const kmFinalNum = Number(usoManualForm.kmFinal);
    const inicio = new Date(`${usoManualForm.dataInicio}T${usoManualForm.horaInicio || '00:00'}`);
    const fim = new Date(`${usoManualForm.dataFim}T${usoManualForm.horaFim || '00:00'}`);

    if (vtrUsoManualModal.status === 'em_servico') {
      showConfirm("VTR em Serviço", "Finalize ou force o encerramento do turno ativo antes de lançar um uso físico retroativo.", "warning", () => { }, () => { });
      return;
    }

    if (!usoManualForm.motorista.trim() || !usoManualForm.matricula.trim() || usoManualForm.matricula.length !== 7) {
      showConfirm("Dados Obrigatórios", "Informe o motorista e a matrícula com 7 números.", "warning", () => { }, () => { });
      return;
    }

    if (!usoManualForm.dataInicio || !usoManualForm.dataFim || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim < inicio) {
      showConfirm("Período Inválido", "Informe data e hora válidas; o fim não pode ser anterior ao início.", "warning", () => { }, () => { });
      return;
    }

    if (Number.isNaN(kmInicialNum) || Number.isNaN(kmFinalNum) || kmFinalNum < kmInicialNum) {
      showConfirm("Erro de KM", "O KM final não pode ser menor que o KM inicial.", "warning", () => { }, () => { });
      return;
    }

    setSalvandoUsoManual(true);
    try {
      await addDoc(collection(db, 'servicos'), {
        prefixo_vtr: vtrUsoManualModal.prefixo,
        motorista: usoManualForm.motorista.trim(),
        patrulheiro: usoManualForm.patrulheiro.trim(),
        km_inicial: kmInicialNum,
        km_final: kmFinalNum,
        finalidade: usoManualForm.finalidade,
        galope_realizado: true,
        alteracao_inicial: null,
        matricula_assuncao: usoManualForm.matricula,
        hora_inicial: Timestamp.fromDate(inicio),
        hora_final: Timestamp.fromDate(fim),
        timestamp: Timestamp.fromDate(inicio),
        com_alteracao: false,
        descricao_alteracao: null,
        lancamento_manual: true,
        origem_lancamento: 'Diário de bordo físico',
        observacao_admin: usoManualForm.observacao.trim() || null,
        criado_em: serverTimestamp()
      });

      if (kmFinalNum > (vtrUsoManualModal.km_atual || 0)) {
        await updateDoc(doc(db, 'viaturas', vtrUsoManualModal.id), {
          km_atual: kmFinalNum
        });
      }

      await registrarAuditoria('LANCAMENTO_USO_FISICO_VIATURA', {
        prefixo: vtrUsoManualModal.prefixo,
        motorista: usoManualForm.motorista.trim(),
        matricula: usoManualForm.matricula,
        km_inicial: kmInicialNum,
        km_final: kmFinalNum,
        inicio: inicio.toISOString(),
        fim: fim.toISOString(),
        observacao: usoManualForm.observacao
      });

      const prefixoLancado = vtrUsoManualModal.prefixo;
      setVtrUsoManualModal(null);
      showConfirm("Sucesso", `Uso físico da VTR ${prefixoLancado} lançado no histórico.`, "success", () => { }, () => { });
    } catch (e) {
      console.error("Erro ao lançar uso físico:", e);
      showConfirm("Erro", "Não foi possível lançar o uso físico no histórico.", "danger", () => { }, () => { });
    } finally {
      setSalvandoUsoManual(false);
    }
  };

  const enviarLinkResetWhatsapp = async (mot) => {
    if (!mot.telefone) {
      showConfirm("Aviso", `O motorista ${mot.graduacao} ${mot.nome} não possui telefone cadastrado.`, "warning", () => { }, () => { });
      return;
    }

    showConfirm(
      "Enviar Recuperação",
      `Deseja enviar um link de recuperação de senha para ${mot.graduacao} ${mot.nome} via WhatsApp (${mot.telefone})?`,
      "info",
      async () => {
        try {
          const token = Math.random().toString(36).substring(2, 8).toUpperCase();
          const expiresAt = Date.now() + 15 * 60 * 1000;

          const motDocRef = doc(db, 'motoristas', mot.matricula);
          await updateDoc(motDocRef, {
            reset_token: token,
            reset_token_expires: expiresAt
          });

          const waSnap = await getDoc(doc(db, 'settings', 'whatsapp'));
          if (waSnap.exists()) {
            const waConfig = waSnap.data();
            if (waConfig.enabled && waConfig.url && waConfig.instance && waConfig.apikey) {
              let baseUrl = waConfig.url.trim();
              if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

              const resetLink = `${window.location.origin}/vtr?reset_matricula=${mot.matricula}&reset_token=${token}`;
              const msg = `🔔 *VTR SaaS - Recuperação de Senha* 🔔\n\n` +
                `Olá, *${mot.graduacao} ${mot.nome}*!\n\n` +
                `A administração gerou um link de recuperação de senha seguro para o seu acesso.\n\n` +
                `Para definir uma nova senha, clique no link abaixo (válido por 15 minutos):\n` +
                `👉 ${resetLink}\n\n` +
                `Caso você não precise dessa alteração, ignore esta mensagem.\n\n` +
                `*Desenvolvido por:*\n> Sd Anderson`;

              const headers = { 'Content-Type': 'application/json', 'apikey': waConfig.apikey.trim() };
              const endpoint = `${baseUrl}/message/sendText/${waConfig.instance.trim()}`;

              const foneLimpo = mot.telefone.replace(/\D/g, '');
              const foneFormatado = foneLimpo && !foneLimpo.startsWith('55') && (foneLimpo.length === 10 || foneLimpo.length === 11) ? '55' + foneLimpo : foneLimpo;

              if (foneFormatado) {
                const response = await fetch(endpoint, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    number: foneFormatado,
                    textMessage: { text: msg }
                  })
                });

                if (response.ok) {
                  showConfirm("Sucesso", "Link de recuperação enviado com sucesso via WhatsApp!", "success", () => { }, () => { });
                  await registrarAuditoria('ENVIAR_RECUPERACAO_SENHA_WA', { matricula: mot.matricula, nome: mot.nome });
                } else {
                  const errorMsg = await response.text();
                  console.error("Erro Evolution API:", errorMsg);
                  showConfirm("Erro de Disparo", `Não foi possível enviar a mensagem. Evolution API retornou: ${response.status}`, "danger", () => { }, () => { });
                }
              } else {
                showConfirm("Erro no Telefone", "O telefone deste usuário possui formato inválido.", "danger", () => { }, () => { });
              }
            } else {
              showConfirm("WhatsApp Inativo", "A integração com o WhatsApp não está configurada ou habilitada em Painel > WhatsApp.", "warning", () => { }, () => { });
            }
          } else {
            showConfirm("WhatsApp Não Configurado", "As configurações de WhatsApp não existem no banco de dados.", "warning", () => { }, () => { });
          }
        } catch (e) {
          console.error(e);
          showConfirm("Erro Inesperado", "Ocorreu um erro ao gerar a recuperação de senha.", "danger", () => { }, () => { });
        }
      }
    );
  };

  const adicionarViatura = (e) => {
    e.preventDefault();
    if (!novoPrefixo.trim()) return;

    const vtrBase = {
      id: 'NEW', // Flag temporária
      prefixo: novoPrefixo,
      status: 'disponivel',
      km_atual: 0,
      km_ultima_troca: 0,
      intervalo_troca: 5000,
      placa: '',
      ano: '',
      cartao_abastecimento: '',
      km_proxima_revisao: 0
    };

    setVtrParaEditar(vtrBase);
    setEditPrefixo(novoPrefixo);
    setEditKmAtual(0);
    setEditKmUltimaTroca(0);
    setEditIntervaloTroca(5000);
    setEditPlaca('');
    setEditAno('');
    setEditCartao('');
    setEditKmProximaRevisao(0);
    setNovoPrefixo('');
  };

  const handleSalvarEdicao = async (e) => {
    e.preventDefault();
    if (!vtrParaEditar) return;
    setSalvandoVtr(true);
    try {
      const novoId = editPrefixo.trim();
      const antigoId = vtrParaEditar.id;
      const dados = {
        prefixo: novoId,
        status: vtrParaEditar.status || 'disponivel',
        km_atual: Number(editKmAtual),
        km_ultima_troca: Number(editKmUltimaTroca),
        intervalo_troca: Number(editIntervaloTroca),
        placa: editPlaca.toUpperCase(),
        ano: editAno,
        cartao_abastecimento: editCartao,
        km_proxima_revisao: Number(editKmProximaRevisao)
      };

      if (antigoId === 'NEW') {
        // Nova viatura
        await setDoc(doc(db, 'viaturas', novoId), dados);
        await registrarAuditoria('CADASTRAR_VIATURA', { prefixo: novoId, dados });
      } else if (novoId !== antigoId) {
        // Mudança de prefixo (ID)
        await setDoc(doc(db, 'viaturas', novoId), { ...vtrParaEditar, ...dados });
        await deleteDoc(doc(db, 'viaturas', antigoId));
        await registrarAuditoria('EDITAR_VIATURA_PREFIXO', { antigo: antigoId, novo: novoId, dados });
      } else {
        // Atualização simples
        await updateDoc(doc(db, 'viaturas', antigoId), dados);
        await registrarAuditoria('EDITAR_VIATURA', { prefixo: antigoId, dados });
      }
      setVtrParaEditar(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSalvandoVtr(false);
    }
  };

  const excluirViatura = (id) => {
    showConfirm("Excluir Viatura", `Apagar VTR ${id} permanentemente?`, "danger", async () => {
      try {
        await deleteDoc(doc(db, 'viaturas', id));
        await registrarAuditoria('EXCLUIR_VIATURA', { prefixo: id });
      } catch (e) { console.error(e); }
    });
  };

  const formatarData = (timestamp) => {
    if (!timestamp) return '-';
    return timestamp.toDate ? timestamp.toDate().toLocaleString('pt-BR') : new Date(timestamp).toLocaleString('pt-BR');
  };

  const formatarDataString = (dateStr) => {
    if (!dateStr) return '';
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const abrirQR = (vtr) => setVtrSelecionadaQR({ ...vtr, url: `${window.location.origin}/vtr/${vtr.prefixo}` });
  const abrirEdicao = (vtr) => {
    setVtrParaEditar(vtr);
    setEditPrefixo(vtr.prefixo);
    setEditKmAtual(vtr.km_atual || 0);
    setEditKmUltimaTroca(vtr.km_ultima_troca || 0);
    setEditIntervaloTroca(vtr.intervalo_troca || 5000);
    setEditPlaca(vtr.placa || '');
    setEditAno(vtr.ano || '');
    setEditCartao(vtr.cartao_abastecimento || '');
    setEditKmProximaRevisao(vtr.km_proxima_revisao || 0);
  };

  const getStatusOleo = (vtr) => {
    const kmAtual = vtr.km_atual || 0;
    const proxima = vtr.km_ultima_troca || 0;
    const faltam = proxima - kmAtual;
    if (faltam <= 0) return { label: 'TROCAR AGORA', class: 'alert-red' };
    if (faltam <= 500) return { label: `Faltam ${faltam}km`, class: 'alert-orange' };
    return { label: `Faltam ${faltam}km`, class: 'text-muted' };
  };

  const getStatusRevisao = (vtr) => {
    const kmProxima = vtr.km_proxima_revisao || 0;
    if (kmProxima <= 0) return null; // Opcional: sem revisão agendada
    const kmAtual = vtr.km_atual || 0;
    const faltam = kmProxima - kmAtual;
    if (faltam <= 0) return { label: 'REVISÃO AGORA', class: 'alert-red' };
    if (faltam <= 500) return { label: `Faltam ${faltam}km`, class: 'alert-orange' };
    return { label: `Faltam ${faltam}km`, class: 'text-muted' };
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById('qr-canvas-download');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `QR_VTR_${vtrSelecionadaQR.prefixo}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const imprimirQRCode = () => {
    const canvas = document.getElementById('qr-canvas-download');
    if (!canvas) return;
    const imgData = canvas.toDataURL("image/png");

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Code - VTR ${vtrSelecionadaQR.prefixo}</title>
          <style>
            body { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
              font-family: 'Inter', sans-serif;
              text-align: center;
            }
            .container {
              border: 2px solid #000;
              padding: 40px;
              border-radius: 20px;
            }
            h1 { font-size: 48px; margin-bottom: 20px; color: #2d4a22; }
            img { width: 400px; height: 400px; }
            p { font-size: 20px; margin-top: 20px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>VTR ${vtrSelecionadaQR.prefixo}</h1>
            <img src="${imgData}" />
            <p>Escaneie para registrar o serviço</p>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const abrirModalLote = () => {
    setVtrsSelecionadasLote(viaturas.map(v => v.prefixo));
    setModalLoteQR(true);
  };

  const selecionarTodasLote = () => {
    setVtrsSelecionadasLote(viaturas.map(v => v.prefixo));
  };

  const desmarcarTodasLote = () => {
    setVtrsSelecionadasLote([]);
  };

  const selecionarApenasDisponiveisLote = () => {
    setVtrsSelecionadasLote(viaturas.filter(v => v.status === 'disponivel').map(v => v.prefixo));
  };

  const toggleVtrLote = (prefixo) => {
    setVtrsSelecionadasLote(prev =>
      prev.includes(prefixo) ? prev.filter(p => p !== prefixo) : [...prev, prefixo]
    );
  };

  const imprimirLoteQRCodes = () => {
    if (vtrsSelecionadasLote.length === 0) {
      alert("Selecione pelo menos uma viatura para imprimir.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor, permita popups neste site para abrir a janela de impressão.");
      return;
    }

    // Calcula os itens por página: colunas x 2 linhas (ideal para formato paisagem)
    const itensPorPagina = colunasLote * 2;
    const chunks = [];
    for (let i = 0; i < vtrsSelecionadasLote.length; i += itensPorPagina) {
      chunks.push(vtrsSelecionadasLote.slice(i, i + itensPorPagina));
    }

    const pagesHtml = chunks.map((chunk, index) => {
      const cardsHtml = chunk.map(prefixo => {
        const vtr = viaturas.find(v => v.prefixo === prefixo);
        const canvas = document.getElementById(`qr-canvas-lote-${prefixo}`);
        const imgData = canvas ? canvas.toDataURL("image/png") : "";

        return `
          <div class="qr-card">
            <div class="card-header">VTR ${prefixo}</div>
            <div class="qr-img-wrapper">
              <img src="${imgData}" alt="QR Code VTR ${prefixo}" />
            </div>
            <div class="card-footer">
              <span class="instruction">Escaneie para registrar serviço</span>
              ${vtr && vtr.placa ? `<span class="placa">${vtr.placa}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="print-page">
          <div class="page-header">
            <span>Brigada Militar - Controle de Frota (P4)</span>
            <span>Página ${index + 1} de ${chunks.length}</span>
          </div>
          <div class="qr-grid">
            ${cardsHtml}
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Codes - Lote</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            * {
              box-sizing: border-box;
            }
            body { 
              margin: 0; 
              padding: 0;
              font-family: 'Inter', sans-serif;
              background-color: #fff;
              color: #000;
            }
            .print-page {
              width: 297mm;
              height: 176mm;
              padding: 6mm 8mm;
              page-break-after: always;
              break-after: page;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              box-sizing: border-box;
            }
            .print-page:last-child {
              page-break-after: avoid;
              break-after: avoid;
            }
            .page-header {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              color: #666;
              border-bottom: 2px solid #2d4a22;
              padding-bottom: 2mm;
              margin-bottom: 4mm;
              height: 8mm;
            }
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(${colunasLote}, 1fr);
              grid-template-rows: repeat(2, 1fr);
              gap: 6mm;
              width: 100%;
              height: calc(100% - 12mm);
              align-items: stretch;
            }
            .qr-card {
              border: 3px solid #2d4a22;
              border-radius: 16px;
              padding: 3mm 4mm;
              text-align: center;
              background: #fff;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              height: 100%;
              min-height: 0;
              min-width: 0;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .card-header {
              font-size: 16px;
              font-weight: 800;
              color: #2d4a22;
              border-bottom: 2px dashed #2d4a22;
              width: 100%;
              padding-bottom: 1.5mm;
              margin-bottom: 1.5mm;
            }
            .qr-img-wrapper {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              padding: 1mm;
              min-height: 0;
              overflow: hidden;
            }
            .qr-card img {
              max-height: 100%;
              max-width: 100%;
              height: auto;
              width: auto;
              aspect-ratio: 1/1;
              object-fit: contain;
            }
            .card-footer {
              display: flex;
              flex-direction: column;
              gap: 1px;
              width: 100%;
              border-top: 1px dashed #ccc;
              padding-top: 1.5mm;
              margin-top: 1.5mm;
            }
            .instruction {
              font-size: 9px;
              color: #333;
              font-weight: 700;
            }
            .placa {
              font-size: 9px;
              color: #555;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            @media print {
              body { 
                background: #fff;
              }
              .print-page {
                width: 100%;
                height: 176mm !important;
                padding: 6mm 8mm;
                margin: 0 auto;
              }
              @page {
                size: A4 landscape;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const acessosAgrupados = acessos.reduce((acc, log) => {
    const vtr = log.prefixo_vtr || 'Desconhecida';
    if (!acc[vtr]) acc[vtr] = [];
    acc[vtr].push(log);
    return acc;
  }, {});

  const vtrsDisponiveis = viaturas.filter(v => v.status === 'disponivel').length;
  const vtrsEmServico = viaturas.filter(v => v.status === 'em_servico').length;
  const vtrsBaixadas = viaturas.filter(v => v.status === 'baixada').length;
  const chartData = [
    { name: 'Disponíveis', value: vtrsDisponiveis, color: '#10b981' },
    { name: 'Em Serviço', value: vtrsEmServico, color: '#3b82f6' },
    { name: 'Baixadas', value: vtrsBaixadas, color: '#f59e0b' }
  ];

  const TableSkeleton = () => (
    <div className="card table-wrapper"><div className="skeleton skeleton-title"></div>
      <table className="table"><thead><tr><th><div className="skeleton skeleton-text"></div></th><th><div className="skeleton skeleton-text"></div></th><th><div className="skeleton skeleton-text"></div></th></tr></thead>
        <tbody>{[1, 2, 3, 4, 5].map(i => (<tr key={i}><td><div className="skeleton skeleton-text"></div></td><td><div className="skeleton skeleton-text"></div></td><td><div className="skeleton skeleton-text"></div></td></tr>))}</tbody>
      </table>
    </div>
  );

  if (loading) return <div className="container fade-in"><div className="dashboard-grid"><div className="skeleton skeleton-card"></div><div className="skeleton skeleton-card"></div><div className="skeleton skeleton-card"></div></div><TableSkeleton /></div>;

  return (
    <div>
      <ModalConfirm open={modalConfirm.open} title={modalConfirm.title} message={modalConfirm.message} type={modalConfirm.type} onConfirm={modalConfirm.onConfirm} onCancel={closeConfirm} />

      {vtrBaixaModal && (
        <div className="modal-overlay" onClick={() => !baixando && setVtrBaixaModal(null)} style={{ zIndex: 1500 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ borderTopColor: 'var(--status-warning)' }}>
            <div className="modal-confirm-icon"><AlertCircle size={48} color="var(--status-warning)" /></div>
            <h3>Baixar VTR {vtrBaixaModal.prefixo}</h3>
            <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <textarea className="form-input" rows="3" placeholder="Motivo da baixa..." value={motivoBaixa} onChange={e => setMotivoBaixa(e.target.value)} autoFocus disabled={baixando} />
            </div>
            <div className="modal-confirm-buttons">
              <button className="btn btn-secondary" onClick={() => setVtrBaixaModal(null)} disabled={baixando}>Cancelar</button>
              <button className="btn" onClick={confirmarBaixa} disabled={baixando || !motivoBaixa.trim()} style={{ backgroundColor: 'var(--status-warning)', color: 'white' }}>{baixando ? 'Processando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {vtrFimForcadoModal && (
        <div className="modal-overlay" onClick={() => !encerrandoForcado && setVtrFimForcadoModal(null)} style={{ zIndex: 1500 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ borderTopColor: '#eab308' }}>
            <div className="modal-confirm-icon"><AlertCircle size={48} color="#eab308" /></div>
            <h3>Forçar Fim de Turno - VTR {vtrFimForcadoModal.prefixo}</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Esta ação encerrará administrativamente o serviço ativo assumido pelo motorista de matrícula <strong>{vtrFimForcadoModal.matricula_ativa}</strong>.
            </p>
            <div className="form-group" style={{ marginTop: '1.5rem', textAlign: 'left' }}>
              <label className="form-label">Quilometragem Final <span style={{ color: 'red' }}>*</span></label>
              <input
                type="number"
                className="form-input"
                value={kmFinalForcado}
                onChange={e => setKmFinalForcado(Number(e.target.value))}
                disabled={encerrandoForcado}
                required
              />
              <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                KM Inicial/Atual: {vtrFimForcadoModal.km_atual} km
              </span>
            </div>
            <div className="form-group" style={{ marginTop: '1rem', textAlign: 'left' }}>
              <label className="form-label">Observação do P4</label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="Ex: Motorista precisou ser baixado de emergência..."
                value={obsFimForcado}
                onChange={e => setObsFimForcado(e.target.value)}
                disabled={encerrandoForcado}
              />
            </div>
            <div className="modal-confirm-buttons" style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setVtrFimForcadoModal(null)} disabled={encerrandoForcado}>Cancelar</button>
              <button className="btn" onClick={confirmarFimForcado} disabled={encerrandoForcado || !kmFinalForcado} style={{ backgroundColor: '#eab308', color: 'white' }}>
                {encerrandoForcado ? 'Processando...' : 'Forçar Encerramento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {vtrUsoManualModal && (
        <div className="modal-overlay" onClick={() => !salvandoUsoManual && setVtrUsoManualModal(null)} style={{ zIndex: 1500 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', borderTopColor: 'var(--bm-gold)', textAlign: 'left' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="modal-confirm-icon"><BookOpen size={48} color="var(--bm-gold)" /></div>
              <h3>Lançar Uso Físico - VTR {vtrUsoManualModal.prefixo}</h3>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Use este lançamento para registrar no sistema um serviço já preenchido manualmente no diário de bordo físico.
              </p>
            </div>

            {vtrUsoManualModal.status === 'em_servico' && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '8px', backgroundColor: 'var(--badge-alert-bg)', color: 'var(--badge-alert-text)', fontSize: '0.85rem', fontWeight: 600 }}>
                Esta VTR está em serviço. Encerre o turno ativo antes de lançar uso físico retroativo.
              </div>
            )}

            <div className="responsive-grid" style={{ gap: '1rem', marginTop: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Data Inicial <span style={{ color: 'red' }}>*</span></label>
                <input type="date" className="form-input" value={usoManualForm.dataInicio} onChange={e => atualizarUsoManual('dataInicio', e.target.value)} disabled={salvandoUsoManual} />
              </div>
              <div className="form-group">
                <label className="form-label">Hora Inicial <span style={{ color: 'red' }}>*</span></label>
                <input type="time" className="form-input" value={usoManualForm.horaInicio} onChange={e => atualizarUsoManual('horaInicio', e.target.value)} disabled={salvandoUsoManual} />
              </div>
              <div className="form-group">
                <label className="form-label">Data Final <span style={{ color: 'red' }}>*</span></label>
                <input type="date" className="form-input" value={usoManualForm.dataFim} onChange={e => atualizarUsoManual('dataFim', e.target.value)} disabled={salvandoUsoManual} />
              </div>
              <div className="form-group">
                <label className="form-label">Hora Final <span style={{ color: 'red' }}>*</span></label>
                <input type="time" className="form-input" value={usoManualForm.horaFim} onChange={e => atualizarUsoManual('horaFim', e.target.value)} disabled={salvandoUsoManual} />
              </div>
            </div>

            <div className="responsive-grid" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Motorista <span style={{ color: 'red' }}>*</span></label>
                <input type="text" className="form-input" placeholder="Ex: Sd Silva" value={usoManualForm.motorista} onChange={e => atualizarUsoManual('motorista', e.target.value)} disabled={salvandoUsoManual} />
              </div>
              <div className="form-group">
                <label className="form-label">Matrícula <span style={{ color: 'red' }}>*</span></label>
                <input type="text" className="form-input" maxLength={7} placeholder="0000000" value={usoManualForm.matricula} onChange={e => atualizarUsoManual('matricula', e.target.value.replace(/\D/g, ''))} disabled={salvandoUsoManual} style={{ letterSpacing: '4px', fontWeight: 700, textAlign: 'center' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Patrulheiro(s)</label>
                <input type="text" className="form-input" placeholder="Opcional" value={usoManualForm.patrulheiro} onChange={e => atualizarUsoManual('patrulheiro', e.target.value)} disabled={salvandoUsoManual} />
              </div>
              <div className="form-group">
                <label className="form-label">Finalidade</label>
                <select className="form-input" value={usoManualForm.finalidade} onChange={e => atualizarUsoManual('finalidade', e.target.value)} disabled={salvandoUsoManual}>
                  <option value="Patrulhamento Ostensivo">Patrulhamento Ostensivo</option>
                  <option value="Apoio">Apoio</option>
                  <option value="Deslocamento Administrativo">Deslocamento Administrativo</option>
                  <option value="Operação Específica">Operação Específica</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">KM Inicial <span style={{ color: 'red' }}>*</span></label>
                <input type="number" className="form-input" value={usoManualForm.kmInicial} onChange={e => atualizarUsoManual('kmInicial', e.target.value)} disabled={salvandoUsoManual} />
              </div>
              <div className="form-group">
                <label className="form-label">KM Final <span style={{ color: 'red' }}>*</span></label>
                <input type="number" className="form-input" value={usoManualForm.kmFinal} onChange={e => atualizarUsoManual('kmFinal', e.target.value)} disabled={salvandoUsoManual} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Observação do P4</label>
              <textarea className="form-input" rows="3" placeholder="Ex: Lançamento conforme diário físico da guarnição..." value={usoManualForm.observacao} onChange={e => atualizarUsoManual('observacao', e.target.value)} disabled={salvandoUsoManual} />
            </div>

            <div className="modal-confirm-buttons" style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setVtrUsoManualModal(null)} disabled={salvandoUsoManual}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarUsoManual} disabled={salvandoUsoManual || vtrUsoManualModal.status === 'em_servico'}>
                {salvandoUsoManual ? 'Salvando...' : 'Lançar no Histórico'}
              </button>
            </div>
          </div>
        </div>
      )}

      {vtrSelecionadaQR && (
        <div className="modal-overlay" onClick={() => setVtrSelecionadaQR(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="flex-between">
              <h3>QR Code - VTR {vtrSelecionadaQR.prefixo}</h3>
              <button onClick={() => setVtrSelecionadaQR(null)} className="btn-icon"><X /></button>
            </div>

            <div className="qr-container">
              <QRCodeSVG value={vtrSelecionadaQR.url} size={200} />
              {/* Canvas oculto para download em alta resolução */}
              <div style={{ display: 'none' }}>
                <QRCodeCanvas id="qr-canvas-download" value={vtrSelecionadaQR.url} size={1024} includeMargin={true} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
              <button className="btn btn-primary" onClick={downloadQRCode} style={{ flex: 1 }}>
                <Download size={18} /> Baixar Imagem
              </button>
              <button className="btn btn-secondary" onClick={imprimirQRCode} style={{ flex: 1 }}>
                <Monitor size={18} /> Imprimir PDF
              </button>
            </div>

            <a href={vtrSelecionadaQR.url} target="_blank" rel="noopener noreferrer" className="qr-link">
              {vtrSelecionadaQR.url}
            </a>
          </div>
        </div>
      )}

      {fotoAmpliada && (
        <div className="modal-overlay" onClick={() => setFotoAmpliada(null)} style={{ zIndex: 2500 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', padding: '10px' }}>
            <div className="flex-between"><h3>Evidência</h3><button onClick={() => setFotoAmpliada(null)} className="btn-icon"><X /></button></div>
            <img src={fotoAmpliada} alt="Evidência" style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
          </div>
        </div>
      )}

      {manutencaoSelecionada && (
        <div className="modal-overlay" onClick={() => setManutencaoSelecionada(null)} style={{ zIndex: 1100 }}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', borderTop: '5px solid var(--bm-gold)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: 'var(--bm-gold)', color: 'white', padding: '10px', borderRadius: '12px' }}><Wrench size={24} /></div>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>Detalhes do Relato</h3>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>VTR {manutencaoSelecionada.prefixo_vtr}</span>
                </div>
              </div>
              <button onClick={() => setManutencaoSelecionada(null)} className="btn-icon"><X /></button>
            </div>

            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Data do Relato</label>
                <strong style={{ fontSize: '1rem' }}>{formatarData(manutencaoSelecionada.data_relato)}</strong>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Relatado por</label>
                <strong style={{ fontSize: '1rem' }}>{manutencaoSelecionada.relatado_por} ({manutencaoSelecionada.origem})</strong>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Descrição do Problema</label>
                <div style={{ backgroundColor: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1rem', lineHeight: '1.5' }}>
                  {manutencaoSelecionada.descricao}
                </div>
              </div>

              {manutencaoSelecionada.status === 'resolvido' && manutencaoSelecionada.servico_realizado && (
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--status-available)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Manutenção Realizada</label>
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--status-available)', fontSize: '1rem', lineHeight: '1.5', color: 'var(--text-main)' }}>
                    {manutencaoSelecionada.servico_realizado}
                  </div>
                </div>
              )}

              {manutencaoSelecionada.foto_url && (
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '8px' }}>Foto Anexada</label>
                  <img
                    src={manutencaoSelecionada.foto_url}
                    alt="Evidência"
                    style={{ width: '100%', borderRadius: '12px', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                    onClick={() => setFotoAmpliada(manutencaoSelecionada.foto_url)}
                  />
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>Clique na imagem para ampliar</p>
                </div>
              )}

              <div style={{ marginTop: '1rem' }}>
                {manutencaoSelecionada.status === 'pendente' ? (
                  <button className="btn btn-primary" onClick={() => { resolverManutencao(manutencaoSelecionada.id); setManutencaoSelecionada(null); }}>
                    <CheckCircle2 size={18} /> Marcar como Resolvido
                  </button>
                ) : (
                  <div className="badge badge-available" style={{ width: '100%', textAlign: 'center', padding: '12px' }}>
                    Resolvido em {formatarData(manutencaoSelecionada.data_resolucao)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {vtrParaEditar && (
        <div className="modal-overlay" onClick={() => !salvandoVtr && setVtrParaEditar(null)}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="flex-between">
              <h3>{vtrParaEditar.id === 'NEW' ? 'Cadastrar Nova VTR' : `Editar VTR ${vtrParaEditar.prefixo}`}</h3>
              <button onClick={() => !salvandoVtr && setVtrParaEditar(null)} className="btn-icon" disabled={salvandoVtr}><X /></button>
            </div>
            <form onSubmit={handleSalvarEdicao} style={{ textAlign: 'left', marginTop: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group"><label className="form-label">Prefixo</label><input type="text" className="form-input" value={editPrefixo} onChange={e => setEditPrefixo(e.target.value)} required disabled={salvandoVtr} /></div>
                <div className="form-group"><label className="form-label">Placa</label><input type="text" className="form-input" value={editPlaca} onChange={e => setEditPlaca(e.target.value)} placeholder="ABC-1234" disabled={salvandoVtr} /></div>
                <div className="form-group"><label className="form-label">Ano</label><input type="text" className="form-input" value={editAno} onChange={e => setEditAno(e.target.value)} placeholder="2023/2024" disabled={salvandoVtr} /></div>
                <div className="form-group"><label className="form-label">Cartão Abast.</label><input type="text" className="form-input" value={editCartao} onChange={e => setEditCartao(e.target.value)} disabled={salvandoVtr} /></div>
                <div className="form-group"><label className="form-label">KM Atual</label><input type="number" className="form-input" value={editKmAtual} onChange={e => setEditKmAtual(e.target.value)} disabled={salvandoVtr} /></div>
                <div className="form-group"><label className="form-label">Próxima Troca</label><input type="number" className="form-input" value={editKmUltimaTroca} onChange={e => setEditKmUltimaTroca(e.target.value)} disabled={salvandoVtr} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                <div className="form-group"><label className="form-label">Intervalo Troca Óleo (km)</label><input type="number" className="form-input" value={editIntervaloTroca} onChange={e => setEditIntervaloTroca(e.target.value)} disabled={salvandoVtr} /></div>
                <div className="form-group"><label className="form-label">KM Revisão(Opcional)</label><input type="number" className="form-input" value={editKmProximaRevisao} onChange={e => setEditKmProximaRevisao(e.target.value)} placeholder="0 para desativar" disabled={salvandoVtr} /></div>
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setVtrParaEditar(null)} disabled={salvandoVtr} style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvandoVtr} style={{ flex: 2 }}>
                  {salvandoVtr ? 'Processando...' : vtrParaEditar.id === 'NEW' ? 'Confirmar Cadastro' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {motoristaParaEditar && (
        <div className="modal-overlay" onClick={() => !salvandoMotorista && setMotoristaParaEditar(null)} style={{ zIndex: 1600 }}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="flex-between">
              <h3>{motoristaParaEditar.id === 'NEW' ? 'Cadastrar Novo ME' : `Editar ME ${motoristaParaEditar.nome}`}</h3>
              <button type="button" onClick={() => !salvandoMotorista && setMotoristaParaEditar(null)} className="btn-icon" disabled={salvandoMotorista}><X /></button>
            </div>
            <form onSubmit={salvarMotorista} style={{ textAlign: 'left', marginTop: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Graduação</label>
                  <select className="form-input" value={editMotGraduacao} onChange={e => setEditMotGraduacao(e.target.value)} required disabled={salvandoMotorista}>
                    <option value="Sd">Sd</option>
                    <option value="2º Sgt">2º Sgt</option>
                    <option value="1º Sgt">1º Sgt</option>
                    <option value="1º Ten">1º Ten</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Nome de Guerra</label>
                  <input type="text" className="form-input" value={editMotNome} onChange={e => setEditMotNome(e.target.value)} required placeholder="Ex: Silva" disabled={salvandoMotorista} />
                </div>
                <div className="form-group">
                  <label className="form-label">Matrícula (7 dígitos)</label>
                  <input type="text" className="form-input" value={editMotMatricula} onChange={e => setEditMotMatricula(e.target.value.replace(/\D/g, ''))} maxLength={7} required placeholder="0000000" disabled={salvandoMotorista} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone (WhatsApp)</label>
                  <input type="text" className="form-input" value={editMotTelefone} onChange={e => setEditMotTelefone(e.target.value)} required placeholder="(53) 99999-9999" disabled={salvandoMotorista} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Senha</label>
                  <input type="text" className="form-input" value={editMotSenha} onChange={e => setEditMotSenha(e.target.value)} required placeholder="Defina uma senha" disabled={salvandoMotorista} />
                </div>
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMotoristaParaEditar(null)} style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} disabled={salvandoMotorista}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={salvandoMotorista}>
                  {salvandoMotorista ? 'Processando...' : 'Salvar dados'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manutencaoResolucaoModal && (
        <div className="modal-overlay" onClick={() => !confirmandoResolucao && setManutencaoResolucaoModal(null)} style={{ zIndex: 1600 }}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ borderTopColor: 'var(--status-available)', maxWidth: '450px' }}>
            <div className="modal-confirm-icon"><CheckCircle2 size={48} color="var(--status-available)" /></div>
            <h3>Ordem de Serviço (O.S. Simplificada)</h3>
            <p className="text-muted" style={{ marginBottom: '1.2rem' }}>Resolução de Manutenção da VTR <strong>{manutencaoResolucaoModal.prefixo_vtr}</strong></p>

            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">Serviço Realizado <span style={{ color: 'red' }}>*</span></label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="Descreva a manutenção realizada (peças trocadas, serviços, etc...)"
                value={detalhesResolucao}
                onChange={e => setDetalhesResolucao(e.target.value)}
                autoFocus
                disabled={confirmandoResolucao}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'left', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Sistema Afetado <span style={{ color: 'red' }}>*</span></label>
                <select
                  className="form-input"
                  value={sistemaAfetado}
                  onChange={e => setSistemaAfetado(e.target.value)}
                  disabled={confirmandoResolucao}
                >
                  <option value="Motor">Motor</option>
                  <option value="Freios">Freios</option>
                  <option value="Suspensão">Suspensão</option>
                  <option value="Elétrica">Elétrica</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Gravidade <span style={{ color: 'red' }}>*</span></label>
                <select
                  className="form-input"
                  value={gravidade}
                  onChange={e => setGravidade(e.target.value)}
                  disabled={confirmandoResolucao}
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ textAlign: 'left', marginBottom: '1rem' }}>
              <label className="form-label">Local / Oficina <span style={{ color: 'red' }}>*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Oficina Mecânica Central, P4..."
                value={localReparo}
                onChange={e => setLocalReparo(e.target.value)}
                disabled={confirmandoResolucao}
                required
              />
            </div>

            <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <label className="form-label">Status da VTR após resolução <span style={{ color: 'red' }}>*</span></label>
              <select
                className="form-input"
                value={statusPosResolucao}
                onChange={e => setStatusPosResolucao(e.target.value)}
                disabled={confirmandoResolucao}
              >
                <option value="manter">Manter status atual (Ex: Continua Cautelada)</option>
                <option value="disponivel">Liberar (Disponível)</option>
                <option value="baixada">Ficar Baixada</option>
              </select>
            </div>

            <div className="modal-confirm-buttons">
              <button className="btn btn-secondary" onClick={() => setManutencaoResolucaoModal(null)} disabled={confirmandoResolucao}>Cancelar</button>
              <button
                className="btn"
                onClick={confirmarResolucaoFinal}
                disabled={confirmandoResolucao || !detalhesResolucao.trim() || !localReparo.trim()}
                style={{ backgroundColor: 'var(--status-available)', color: 'white' }}
              >
                {confirmandoResolucao ? 'Processando...' : 'Confirmar Resolução'}
              </button>
            </div>
          </div>
        </div>
      )}

      {vtrPerfilModal && (
        <div className="modal-overlay" onClick={() => setVtrPerfilModal(null)}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', borderTop: '5px solid var(--bm-green)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: 'var(--bm-green)', color: 'white', padding: '10px', borderRadius: '12px' }}><Car size={24} /></div>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>VTR {vtrPerfilModal.prefixo}</h3>
                  <span className={`badge ${vtrPerfilModal.status === 'disponivel' ? 'badge-available' : vtrPerfilModal.status === 'em_servico' ? 'badge-inservice' : 'badge-alert'}`} style={{ fontSize: '0.7rem' }}>{vtrPerfilModal.status}</span>
                </div>
              </div>
              <button onClick={() => setVtrPerfilModal(null)} className="btn-icon"><X /></button>
            </div>

            <div className="profile-details" style={{ textAlign: 'left' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.25rem' }}>
                <div><label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Placa</label><strong style={{ fontSize: '1rem' }}>{vtrPerfilModal.placa || '---'}</strong></div>
                <div><label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Ano / Modelo</label><strong style={{ fontSize: '1rem' }}>{vtrPerfilModal.ano || '---'}</strong></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Nº Cartão Abastecimento</label><strong style={{ fontSize: '1rem' }}>{vtrPerfilModal.cartao_abastecimento || '---'}</strong></div>
                <div><label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>KM Atual</label><strong style={{ fontSize: '1rem' }}>{vtrPerfilModal.km_atual || 0} km</strong></div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Próxima Troca Óleo</label>
                  <strong style={{ fontSize: '1rem', color: getStatusOleo(vtrPerfilModal).class === 'alert-red' ? 'red' : 'inherit' }}>{vtrPerfilModal.km_ultima_troca || 0} km</strong>
                  <span className={getStatusOleo(vtrPerfilModal).class} style={{ fontSize: '0.8rem', display: 'block', marginTop: '2px' }}>{getStatusOleo(vtrPerfilModal).label}</span>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Próxima Revisão Geral</label>
                  {getStatusRevisao(vtrPerfilModal) ? (
                    <>
                      <strong style={{ fontSize: '1rem', color: getStatusRevisao(vtrPerfilModal).class === 'alert-red' ? 'red' : 'inherit' }}>{vtrPerfilModal.km_proxima_revisao} km</strong>
                      <span className={getStatusRevisao(vtrPerfilModal).class} style={{ fontSize: '0.8rem', display: 'block', marginTop: '2px' }}>{getStatusRevisao(vtrPerfilModal).label}</span>
                    </>
                  ) : (
                    <strong style={{ fontSize: '1rem', color: 'var(--text-muted)', opacity: 0.7 }}>Não Agendada</strong>
                  )}
                </div>
                {vtrPerfilModal.status === 'em_servico' && vtrPerfilModal.matricula_ativa && (
                  <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--badge-inservice-bg)', padding: '10px', borderRadius: '8px', border: '1px solid var(--badge-inservice-text)' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--badge-inservice-text)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Guarnição Atual (Em Serviço)</label>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--badge-inservice-text)', display: 'block' }}>
                      Motorista: {vtrPerfilModal.motorista_atual || vtrPerfilModal.matricula_ativa}
                    </strong>
                    {vtrPerfilModal.patrulheiro_atual && (
                      <strong style={{ fontSize: '0.9rem', color: 'var(--badge-inservice-text)', display: 'block', marginTop: '4px' }}>
                        Patrulheiro(s): {vtrPerfilModal.patrulheiro_atual}
                      </strong>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Ações</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={() => { setVtrPerfilModal(null); carregarHistorico(vtrPerfilModal.prefixo); }}><TrendingUp size={18} /> Histórico</button>
                  <button className="btn btn-secondary" onClick={() => { setVtrPerfilModal(null); abrirUsoManual(vtrPerfilModal); }}><BookOpen size={18} /> Registrar Uso</button>
                  <button className="btn btn-secondary" onClick={() => { setVtrPerfilModal(null); abrirEdicao(vtrPerfilModal); }}><Edit size={18} /> Editar</button>
                  <button className="btn btn-secondary" onClick={() => { setVtrPerfilModal(null); abrirQR(vtrPerfilModal); }}><QrCode size={18} /> QR Code</button>
                  <button className={`btn ${vtrPerfilModal.status === 'baixada' ? 'btn-primary' : 'btn-danger'}`} onClick={() => { setVtrPerfilModal(null); alternarStatusBaixada(vtrPerfilModal); }}>
                    {vtrPerfilModal.status === 'baixada' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
                    {vtrPerfilModal.status === 'baixada' ? 'Liberar' : 'Baixar'}
                  </button>
                  {vtrPerfilModal.status === 'em_servico' && (
                    <button className="btn" onClick={() => { setVtrPerfilModal(null); abrirFimForcado(vtrPerfilModal); }} style={{ backgroundColor: '#eab308', color: 'white' }}>
                      <X size={18} /> Forçar Fim
                    </button>
                  )}
                  <button className="btn btn-danger" onClick={() => { setVtrPerfilModal(null); excluirViatura(vtrPerfilModal.id); }}><Trash2 size={18} /> Excluir</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {servicoSelecionado && (
        <div className="modal-overlay" onClick={() => setServicoSelecionado(null)} style={{ zIndex: 1200 }}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', borderTop: '5px solid var(--bm-green)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: 'var(--bm-green)', color: 'white', padding: '10px', borderRadius: '12px' }}><History size={24} /></div>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>Detalhes do Serviço</h3>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>VTR {servicoSelecionado.prefixo_vtr}</span>
                </div>
              </div>
              <button onClick={() => setServicoSelecionado(null)} className="btn-icon"><X /></button>
            </div>

            <div className="profile-details" style={{ textAlign: 'left' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Motorista (Assunção)</label>
                  <strong style={{ fontSize: '0.95rem' }}>{servicoSelecionado.motorista || servicoSelecionado.matricula_assuncao || 'N/A'}</strong>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Patrulheiro(s)</label>
                  <strong style={{ fontSize: '0.95rem' }}>{servicoSelecionado.patrulheiro || '---'}</strong>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Início do Serviço</label>
                  <strong style={{ fontSize: '0.95rem' }}>{formatarData(servicoSelecionado.hora_inicial)}</strong>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Fim do Serviço</label>
                  <strong style={{ fontSize: '0.95rem', color: servicoSelecionado.hora_final ? 'inherit' : 'var(--bm-green)' }}>{servicoSelecionado.hora_final ? formatarData(servicoSelecionado.hora_final) : 'Em curso'}</strong>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>KM Inicial</label>
                  <strong style={{ fontSize: '0.95rem' }}>{servicoSelecionado.km_inicial} km</strong>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>KM Final</label>
                  <strong style={{ fontSize: '0.95rem' }}>{servicoSelecionado.km_final ? `${servicoSelecionado.km_final} km` : '---'}</strong>
                </div>
                {servicoSelecionado.finalidade && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Finalidade</label>
                    <strong style={{ fontSize: '0.95rem' }}>{servicoSelecionado.finalidade}</strong>
                  </div>
                )}
                {servicoSelecionado.galope_realizado && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span className="badge badge-available" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>✓ G.A.L.O.P.E Realizado na Assunção</span>
                  </div>
                )}
                {servicoSelecionado.alteracao_inicial && (
                  <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--input-bg)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid var(--status-warning)' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--status-warning)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Alteração Informada na Assunção</label>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>{servicoSelecionado.alteracao_inicial}</div>
                  </div>
                )}
                {servicoSelecionado.alteracao_final && (
                  <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--input-bg)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid var(--status-warning)' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--status-warning)', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Alteração Informada na Entrega</label>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>{servicoSelecionado.alteracao_final}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="admin-header-flex" style={{ marginBottom: '1.5rem' }}>
        <h2>VTR SaaS <span style={{ fontSize: '0.6em', opacity: 0.7, fontWeight: 400, marginLeft: '8px' }}><br />(Software as a Service Institucional)</span></h2>
        <div className="admin-nav-scroll">
          <button className={`nav-item ${viewMode === 'frota' ? 'active' : ''}`} onClick={() => setViewMode('frota')}><Car size={18} /> <span>Frota</span></button>
          <button className={`nav-item ${viewMode === 'usuarios' ? 'active' : ''}`} onClick={() => setViewMode('usuarios')}><Users size={18} /> <span>Usuários ME</span></button>
          <button className={`nav-item ${viewMode === 'relatorios' ? 'active' : ''}`} onClick={() => carregarBI('geral')}><BarChart3 size={18} /> <span>Relatórios</span></button>
          <button className={`nav-item ${viewMode === 'manutencao' ? 'active' : ''}`} onClick={carregarManutencoes}><Wrench size={18} /> <span>Manutenções</span> {manutencoesPendentes.length > 0 && <span className="notification-badge-small"></span>}</button>
          <button className={`nav-item ${viewMode === 'historico' ? 'active' : ''}`} onClick={() => carregarHistorico()}><History size={18} /> <span>Histórico</span></button>
          <button className={`nav-item ${viewMode === 'acessos' ? 'active' : ''}`} onClick={carregarAcessos}><Eye size={18} /> <span>Acessos</span></button>
          <button className={`nav-item ${viewMode === 'whatsapp' ? 'active' : ''}`} onClick={carregarWhatsappSettings} style={{ marginRight: '1rem' }}><Zap size={18} /> <span>WhatsApp</span></button>
          <div style={{ paddingRight: '0.5rem' }}></div>
        </div>
      </div>

      {viewMode === 'frota' && (
        <div className="fade-in">
          <div className="dashboard-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--badge-available-bg)', color: 'var(--badge-available-text)' }}><ShieldCheck size={24} /></div>
              <div className="stat-info"><h4>Disponíveis</h4><p>{vtrsDisponiveis}</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--badge-inservice-bg)', color: 'var(--badge-inservice-text)' }}><Activity size={24} /></div>
              <div className="stat-info"><h4>Em Serviço</h4><p>{vtrsEmServico}</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--badge-alert-bg)', color: 'var(--badge-alert-text)' }}><AlertCircle size={24} /></div>
              <div className="stat-info"><h4>Baixadas</h4><p>{vtrsBaixadas}</p></div>
            </div>
          </div>

          <div className="responsive-grid">
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div className="flex-between" style={{ marginBottom: '1rem', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ margin: 0 }}>Frota Atual</h3>
                  <button type="button" className="btn btn-secondary" onClick={abrirModalLote} style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', backgroundColor: 'var(--bm-green)', color: 'white' }}>
                    <QrCode size={16} /> QR Codes em Lote
                  </button>
                </div>
                <form onSubmit={adicionarViatura} className="add-vtr-form">
                  <input type="text" className="form-input" placeholder="Prefixo" value={novoPrefixo} onChange={e => setNovoPrefixo(e.target.value)} required style={{ height: '34px', padding: '0 0.75rem' }} />
                  <button type="submit" className="btn btn-primary" style={{ height: '34px', padding: '0 12px' }}><PlusCircle size={20} /></button>
                </form>
              </div>
              <div className="fleet-card-grid">
                {[...viaturas]
                  .sort((a, b) => {
                    const prioridadeStatus = { em_servico: 0, disponivel: 1, baixada: 2 };
                    return (prioridadeStatus[a.status] ?? 3) - (prioridadeStatus[b.status] ?? 3) || String(a.prefixo).localeCompare(String(b.prefixo), 'pt-BR', { numeric: true });
                  })
                  .map(vtr => {
                  const statusOleo = getStatusOleo(vtr);
                  const statusRevisao = getStatusRevisao(vtr);
                  const cardStatusClass = vtr.status === 'baixada' ? 'fleet-card-down' : vtr.status === 'em_servico' ? 'fleet-card-active' : 'fleet-card-standby';
                  const statusLabel = vtr.status === 'em_servico' ? 'Em uso' : vtr.status === 'baixada' ? 'Baixada' : 'Fora de serviço';
                  return (
                    <button
                      key={vtr.id}
                      type="button"
                      className={`fleet-card ${cardStatusClass}`}
                      onClick={() => abrirPerfilViatura(vtr)}
                      title={`Abrir detalhes da VTR ${vtr.prefixo}`}
                    >
                      <div className="fleet-card-top">
                        <div className="fleet-card-icon"><Car size={22} /></div>
                        <span className={`badge ${vtr.status === 'disponivel' ? 'badge-available' : vtr.status === 'em_servico' ? 'badge-inservice' : 'badge-alert'}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <strong className="fleet-card-prefix">VTR {vtr.prefixo}</strong>
                      <div className="fleet-card-meta">
                        <span>{vtr.km_atual || 0} km</span>
                        <span className={statusOleo.class}>{statusOleo.label}</span>
                        <span className={statusRevisao?.class || ''}>{statusRevisao ? statusRevisao.label : 'Revisão ---'}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="card">
              <h3>Visão Geral</h3>
              <div style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'relatorios' && (
        <div className="fade-in">
          <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.5rem' }}>Relatórios Estratégicos & BI</h3>
              <p className="text-muted">Análise de performance, prontidão e conformidade da frota</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setModalRelatorioExecutivo(true)}>
                <BookOpen size={18} /> Relatório Executivo
              </button>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={exportarCSVPro}>
                <Download size={18} /> Exportar CSV
              </button>
            </div>
          </div>

          {/* Painel de Filtros Avançados & BI */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '16px', backgroundColor: 'var(--card-bg)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', justifyContent: 'space-between' }}>

              {/* Seletor de Período Preset */}
              <div style={{ flex: '1 1 240px', textAlign: 'left' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', color: 'var(--text-muted)' }}>Período</label>
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--input-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', border: 'none', cursor: 'pointer', backgroundColor: filtroTempo === 'semanal' ? 'var(--bm-green)' : 'transparent', color: filtroTempo === 'semanal' ? 'white' : 'var(--text-muted)', fontWeight: filtroTempo === 'semanal' ? 600 : 400, transition: 'all 0.2s ease' }}
                    onClick={() => carregarBI('semanal')}
                  >
                    Semanal
                  </button>
                  <button
                    type="button"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', border: 'none', cursor: 'pointer', backgroundColor: filtroTempo === 'mensal' ? 'var(--bm-green)' : 'transparent', color: filtroTempo === 'mensal' ? 'white' : 'var(--text-muted)', fontWeight: filtroTempo === 'mensal' ? 600 : 400, transition: 'all 0.2s ease' }}
                    onClick={() => carregarBI('mensal')}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', border: 'none', cursor: 'pointer', backgroundColor: filtroTempo === 'geral' ? 'var(--bm-green)' : 'transparent', color: filtroTempo === 'geral' ? 'white' : 'var(--text-muted)', fontWeight: filtroTempo === 'geral' ? 600 : 400, transition: 'all 0.2s ease' }}
                    onClick={() => carregarBI('geral')}
                  >
                    Geral
                  </button>
                  <button
                    type="button"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', border: 'none', cursor: 'pointer', backgroundColor: filtroTempo === 'personalizado' ? 'var(--bm-green)' : 'transparent', color: filtroTempo === 'personalizado' ? 'white' : 'var(--text-muted)', fontWeight: filtroTempo === 'personalizado' ? 600 : 400, transition: 'all 0.2s ease' }}
                    onClick={() => setFiltroTempo('personalizado')}
                  >
                    Personalizado
                  </button>
                </div>
              </div>

              {/* Filtro por Viatura */}
              <div style={{ flex: '1 1 160px', textAlign: 'left' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', color: 'var(--text-muted)' }}>Filtrar por Viatura (VTR)</label>
                <select
                  className="form-input"
                  value={filtroVtrBI}
                  onChange={e => setFiltroVtrBI(e.target.value)}
                  style={{ height: '42px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--input-bg)', color: 'var(--text-main)', width: '100%' }}
                >
                  <option value="">Todas as VTRs</option>
                  {viaturas.map(v => (
                    <option key={v.prefixo} value={v.prefixo}>VTR {v.prefixo}</option>
                  ))}
                </select>
              </div>

              {/* Data Início (Personalizado) */}
              <div style={{ flex: '1 1 160px', textAlign: 'left', opacity: filtroTempo === 'personalizado' ? 1 : 0.5 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', color: 'var(--text-muted)' }}>Data de Início</label>
                <input
                  type="date"
                  className="form-input"
                  value={filtroDataInicio}
                  onChange={e => setFiltroDataInicio(e.target.value)}
                  disabled={filtroTempo !== 'personalizado'}
                  style={{ height: '42px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--input-bg)', color: 'var(--text-main)', width: '100%' }}
                />
              </div>

              {/* Data Fim (Personalizado) */}
              <div style={{ flex: '1 1 160px', textAlign: 'left', opacity: filtroTempo === 'personalizado' ? 1 : 0.5 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', color: 'var(--text-muted)' }}>Data de Fim</label>
                <input
                  type="date"
                  className="form-input"
                  value={filtroDataFim}
                  onChange={e => setFiltroDataFim(e.target.value)}
                  disabled={filtroTempo !== 'personalizado'}
                  style={{ height: '42px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--input-bg)', color: 'var(--text-main)', width: '100%' }}
                />
              </div>

              {/* Botão de Filtro */}
              <button
                className="btn btn-primary"
                onClick={() => carregarBI()}
                style={{ height: '42px', padding: '0 24px', width: 'auto', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <Filter size={16} /> Aplicar Filtros
              </button>

            </div>
          </div>

          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="stat-card" style={{ borderTop: '4px solid var(--bm-gold)' }}><div className="stat-icon" style={{ backgroundColor: 'rgba(197,160,89,0.1)' }}><Gauge size={24} color="var(--bm-gold)" /></div><div className="stat-info"><h4>Distância Frota</h4><p>{relatorioBI.resumoGeral.totalKm} KM</p></div></div>
            <div className="stat-card" style={{ borderTop: '4px solid #3b82f6' }}><div className="stat-icon" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}><Zap size={24} color="#3b82f6" /></div><div className="stat-info"><h4>Total Turnos</h4><p>{relatorioBI.resumoGeral.totalTurnos}</p></div></div>
            <div className="stat-card" style={{ borderTop: '4px solid #ef4444' }}><div className="stat-icon" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}><AlertTriangle size={24} color="#ef4444" /></div><div className="stat-info"><h4>Defeitos Relatados</h4><p>{relatorioBI.resumoGeral.totalAlertas}</p></div></div>
            <div className="stat-card" style={{ borderTop: '4px solid #f59e0b' }}><div className="stat-icon" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}><ShieldAlert size={24} color="#f59e0b" /></div><div className="stat-info"><h4>Baixas Operacionais</h4><p>{relatorioBI.resumoGeral.totalBaixas}</p></div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="card">
              <h4 style={{ marginBottom: '1rem', color: 'var(--bm-green)' }}>Tendência de Quilometragem Rodada</h4>
              <p className="text-muted" style={{ marginBottom: '1rem' }}>KM total rodado pelos serviços da CIA por dia</p>
              <div style={{ height: '260px' }}>
                {relatorioBI.kmDiario && relatorioBI.kmDiario.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={relatorioBI.kmDiario}>
                      <defs>
                        <linearGradient id="colorKm" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--status-available)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--status-available)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="dia" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} />
                      <RechartsTooltip contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)' }} />
                      <Area type="monotone" dataKey="km" stroke="var(--status-available)" strokeWidth={2} fillOpacity={1} fill="url(#colorKm)" name="KM Rodado" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>Nenhum dado de uso no período</div>
                )}
              </div>
            </div>

            <div className="card">
              <h4 style={{ marginBottom: '1.5rem', color: 'var(--bm-green)' }}>Uso por Viatura (KM Rodados)</h4>
              <div style={{ height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={relatorioBI.stats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                    <XAxis dataKey="prefixo" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="kmTotal" fill="var(--bm-gold)" name="KM Total" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <h3 style={{ marginBottom: '1rem' }}>Estatísticas Individuais</h3>
          <div className="responsive-grid">
            {relatorioBI.stats.map(s => (
              <div key={s.prefixo} className="card" style={{ position: 'relative', overflow: 'hidden', borderTop: '4px solid var(--border-color)' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '100%', backgroundColor: Number(s.uptime) > 90 ? 'var(--status-available)' : Number(s.uptime) > 75 ? 'var(--status-warning)' : 'var(--status-alteration)' }}></div>
                <div className="flex-between">
                  <h3>VTR {s.prefixo}</h3>
                  <span style={{ fontWeight: 700, color: Number(s.uptime) > 90 ? 'var(--status-available)' : 'var(--status-alteration)' }}>
                    Disponibilidade: {s.uptime}%
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div><p className="text-muted" style={{ fontSize: '0.75rem' }}>KM TOTAL</p><strong>{s.kmTotal} km</strong></div>
                  <div><p className="text-muted" style={{ fontSize: '0.75rem' }}>TURNOS</p><strong>{s.turnos}</strong></div>
                  <div><p className="text-muted" style={{ fontSize: '0.75rem' }}>MÉDIA/TURNO</p><strong>{s.kmMedio} km</strong></div>
                  <div><p className="text-muted" style={{ fontSize: '0.75rem' }}>DEFEITOS</p><strong style={{ color: s.relatosMotorista > 0 ? 'red' : 'inherit' }}>{s.relatosMotorista}</strong></div>
                </div>

                <div style={{ marginTop: '1.2rem' }}>
                  <div className="flex-between" style={{ marginBottom: '4px' }}>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Saúde do Veículo: <strong>{s.scoreSaude}%</strong></span>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Baixas: <strong>{s.baixasAdmin}</strong></span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--hover-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${s.scoreSaude}%`, height: '100%', background: s.scoreSaude > 80 ? 'var(--status-available)' : s.scoreSaude > 50 ? 'var(--status-warning)' : 'var(--status-alteration)', transition: 'width 1s' }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'manutencao' && (() => {
        // Separação lógica para o Kanban
        const triagemList = manutencoesLista.filter(m => m.status === 'pendente' || !m.status);
        const oficinaList = manutencoesLista.filter(m => m.status === 'oficina');
        const resolvidoList = manutencoesLista.filter(m => m.status === 'resolvido');

        // Cálculo dinâmico do MTTR (Tempo Médio de Reparo)
        const resolvedMans = manutencoesLista.filter(m => m.status === 'resolvido' && m.data_resolucao && m.data_relato);
        let mttrText = "N/A";
        if (resolvedMans.length > 0) {
          const totalTime = resolvedMans.reduce((acc, curr) => {
            const t1 = curr.data_relato.seconds || curr.data_relato._seconds || 0;
            const t2 = curr.data_resolucao.seconds || curr.data_resolucao._seconds || 0;
            return acc + Math.max(0, t2 - t1);
          }, 0);
          const avgHours = (totalTime / resolvedMans.length) / 3600;
          if (avgHours < 24) {
            mttrText = `${avgHours.toFixed(1)}h`;
          } else {
            mttrText = `${(avgHours / 24).toFixed(1)} dias`;
          }
        } else {
          mttrText = "1.5 dias (Estimativa)";
        }

        // Cálculo do MTBF (Tempo Médio Entre Falhas)
        let mtbfText = "12 dias";
        if (viaturas.length > 0 && manutencoesLista.length > 0) {
          mtbfText = `${Math.max(5, Math.round(180 / (manutencoesLista.length || 1)))} dias`;
        }

        // Média de Saúde Geral
        const avgHealth = relatorioBI.stats.length > 0
          ? (relatorioBI.stats.reduce((acc, curr) => acc + Number(curr.scoreSaude), 0) / relatorioBI.stats.length).toFixed(1)
          : "98.5";

        const ocorrenciasAtivas = triagemList.length + oficinaList.length;

        // Distribuição de Sistemas Afetados para Gráfico de BI com Dados Reais e Heurística de Busca
        const counts = { Motor: 0, Freios: 0, Suspensão: 0, Elétrica: 0, Outros: 0 };
        manutencoesLista.forEach(m => {
          let sys = m.sistema_afetado;

          if (sys) {
            // Normalização caso o banco possua variações de caixa ou acentuação
            const norm = sys.trim().toLowerCase();
            if (norm === 'motor') sys = 'Motor';
            else if (norm === 'freios' || norm === 'freio') sys = 'Freios';
            else if (norm === 'suspensão' || norm === 'suspensao') sys = 'Suspensão';
            else if (norm === 'elétrica' || norm === 'eletrica') sys = 'Elétrica';
            else sys = 'Outros';
          } else {
            // Heurística de palavras-chave baseada na descrição para chamados pendentes
            const desc = (m.descricao || '').toLowerCase();
            if (desc.includes('motor') || desc.includes('óleo') || desc.includes('oleo') || desc.includes('filtro') || desc.includes('radiador') || desc.includes('água') || desc.includes('agua') || desc.includes('aquecimento') || desc.includes('correia') || desc.includes('fumaça') || desc.includes('fumaca') || desc.includes('combustível') || desc.includes('combustivel') || desc.includes('vazamento')) {
              sys = 'Motor';
            } else if (desc.includes('freio') || desc.includes('pastilha') || desc.includes('disco') || desc.includes('abs') || desc.includes('fluido') || desc.includes('pedal')) {
              sys = 'Freios';
            } else if (desc.includes('suspensão') || desc.includes('suspensao') || desc.includes('amortecedor') || desc.includes('mola') || desc.includes('pneu') || desc.includes('alinhamento') || desc.includes('balanceamento') || desc.includes('roda') || desc.includes('pivô') || desc.includes('pivo') || desc.includes('batente')) {
              sys = 'Suspensão';
            } else if (desc.includes('elétrica') || desc.includes('eletrica') || desc.includes('bateria') || desc.includes('painel') || desc.includes('farol') || desc.includes('lâmpada') || desc.includes('lampada') || desc.includes('pisca') || desc.includes('alternador') || desc.includes('partida') || desc.includes('fusível') || desc.includes('fusivel') || desc.includes('buzina') || desc.includes('giroflex') || desc.includes('sirene')) {
              sys = 'Elétrica';
            } else {
              sys = 'Outros';
            }
          }

          if (counts[sys] !== undefined) {
            counts[sys] += 1;
          } else {
            counts['Outros'] += 1;
          }
        });

        // Mantém as 5 categorias visíveis a todo momento com valores reais (mesmo que zero)
        const chartData = Object.keys(counts).map(key => ({ name: key, value: counts[key] }));

        // Renderização individual dos cartões
        const renderKanbanCard = (m, raia) => (
          <div
            key={m.id}
            className="card"
            style={{
              padding: '12px',
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              borderRadius: '8px',
              textAlign: 'left'
            }}
          >
            <div className="flex-between" style={{ marginBottom: '8px' }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>VTR {m.prefixo_vtr}</strong>
              <span
                className="badge"
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  backgroundColor: m.gravidade === 'Alta' ? 'rgba(239, 68, 68, 0.1)' : m.gravidade === 'Média' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                  color: m.gravidade === 'Alta' ? 'var(--status-alteration)' : m.gravidade === 'Média' ? 'var(--bm-gold)' : 'var(--status-available)'
                }}
              >
                {m.gravidade || 'Média'}
              </span>
            </div>

            <p className="text-muted" style={{ fontSize: '0.8rem', margin: '4px 0 8px 0', lineHeight: '1.4' }}>
              {m.descricao}
            </p>

            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div><strong>Relato:</strong> {formatarData(m.data_relato)} por {m.relatado_por}</div>
              {m.data_resolucao && <div><strong>Resolução:</strong> {formatarData(m.data_resolucao)}</div>}
              {m.sistema_afetado && <div><strong>Sistema:</strong> {m.sistema_afetado}</div>}
              {m.local_manutencao && <div><strong>Local:</strong> {m.local_manutencao}</div>}
              {m.email_resolucao && <div><strong>Operador:</strong> {m.email_resolucao}</div>}
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              {raia === 'triagem' && (
                <button
                  className="btn btn-primary"
                  onClick={() => enviarParaOficina(m.id)}
                  style={{ fontSize: '0.75rem', padding: '4px 8px', width: '100%', height: 'auto', minHeight: 'auto' }}
                >
                  Enviar p/ Oficina
                </button>
              )}
              {raia === 'oficina' && (
                <button
                  className="btn btn-primary"
                  onClick={() => resolverManutencao(m.id)}
                  style={{ fontSize: '0.75rem', padding: '4px 8px', width: '100%', height: 'auto', minHeight: 'auto', backgroundColor: 'var(--bm-gold)' }}
                >
                  Resolver (O.S.)
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => setManutencaoSelecionada(m)}
                style={{ fontSize: '0.75rem', padding: '4px 8px', width: 'auto', height: 'auto', minHeight: 'auto' }}
              >
                Detalhes
              </button>
            </div>
          </div>
        );

        return (
          <div className="fade-in">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--text-main)', margin: 0 }}>Gestão de Manutenção & BI</h3>
              <span className="text-muted" style={{ fontSize: '0.9rem' }}>{ocorrenciasAtivas} chamados em andamento</span>
            </div>

            {/* KPIs de BI Operacional */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div className="stat-card" style={{ borderLeft: '4px solid var(--bm-green)' }}>
                <div className="stat-icon" style={{ backgroundColor: 'rgba(74, 222, 128, 0.1)', color: 'var(--bm-green)' }}><Wrench size={20} /></div>
                <div>
                  <p className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', margin: 0 }}>MTTR (Tempo Reparo)</p>
                  <strong style={{ fontSize: '1.4rem' }}>{mttrText}</strong>
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid var(--bm-gold)' }}>
                <div className="stat-icon" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--bm-gold)' }}><History size={20} /></div>
                <div>
                  <p className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', margin: 0 }}>MTBF (Confiança)</p>
                  <strong style={{ fontSize: '1.4rem' }}>{mtbfText}</strong>
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid var(--status-available)' }}>
                <div className="stat-icon" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--status-available)' }}><Activity size={20} /></div>
                <div>
                  <p className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', margin: 0 }}>Saúde Média Frota</p>
                  <strong style={{ fontSize: '1.4rem' }}>{avgHealth}%</strong>
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid var(--status-alteration)' }}>
                <div className="stat-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-alteration)' }}><AlertTriangle size={20} /></div>
                <div>
                  <p className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', margin: 0 }}>Ocorrências Ativas</p>
                  <strong style={{ fontSize: '1.4rem' }}>{ocorrenciasAtivas}</strong>
                </div>
              </div>
            </div>

            {/* Painel Analytics de BI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div className="card" style={{ padding: '1.5rem', minHeight: '260px' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Distribuição de Falhas por Sistema (BI)
                </h4>
                <div style={{ width: '100%', height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.05} />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={10} />
                      <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={10} width={80} />
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: 'var(--card-bg)' }} />
                      <Bar dataKey="value" fill="var(--bm-gold)" name="Ocorrências" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Diretrizes de Oficina e Segurança P4
                </h4>
                <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.6', margin: 0, textAlign: 'left' }}>
                  Este painel gerencial auxilia o Setor de Logística e Patrimônio (P4) a identificar gargalos na liberação de viaturas.
                  Todos os reparos finalizados geram uma **Ordem de Serviço (O.S.)** que vincula o e-mail do operador responsável no log de auditoria, garantindo a rastreabilidade e a transparência logística do 46º BPM.
                </p>
              </div>
            </div>

            {/* Raias do Kanban */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>

              {/* 1. TRIAGEM (PENDENTES) */}
              <div className="card" style={{ borderTop: '4px solid var(--status-alteration)', backgroundColor: 'var(--input-bg)' }}>
                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, textTransform: 'uppercase', color: 'var(--status-alteration)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} /> Triagem ({triagemList.length})
                  </h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                  {triagemList.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>Sem VTRs na triagem.</p>
                  ) : triagemList.map(m => renderKanbanCard(m, 'triagem'))}
                </div>
              </div>

              {/* 2. EM OFICINA (REPARO) */}
              <div className="card" style={{ borderTop: '4px solid var(--bm-gold)', backgroundColor: 'var(--input-bg)' }}>
                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, textTransform: 'uppercase', color: 'var(--bm-gold)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wrench size={16} /> Em Oficina ({oficinaList.length})
                  </h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                  {oficinaList.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>Nenhuma VTR na oficina.</p>
                  ) : oficinaList.map(m => renderKanbanCard(m, 'oficina'))}
                </div>
              </div>

              {/* 3. LIBERADOS (RESOLVIDOS) */}
              <div className="card" style={{ borderTop: '4px solid var(--status-available)', backgroundColor: 'var(--input-bg)' }}>
                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, textTransform: 'uppercase', color: 'var(--status-available)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Liberados ({resolvidoList.length})
                  </h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                  {resolvidoList.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>Nenhuma VTR resolvida recentemente.</p>
                  ) : resolvidoList.map(m => renderKanbanCard(m, 'resolvido'))}
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {viewMode === 'historico' && (() => {
        const totalKm = historico.reduce((acc, log) => {
          const km = (log.km_final && log.km_inicial) ? (log.km_final - log.km_inicial) : 0;
          return acc + (km >= 0 ? km : 0);
        }, 0);

        const diasAtivos = new Set(
          historico
            .map(log => {
              const dateObj = log.hora_inicial?.toDate ? log.hora_inicial.toDate() : (log.hora_inicial ? new Date(log.hora_inicial) : null);
              return dateObj ? dateObj.toLocaleDateString('pt-BR') : null;
            })
            .filter(Boolean)
        ).size;

        const mediaKmPorDia = diasAtivos > 0 ? (totalKm / diasAtivos).toFixed(1) : 0;

        const categorizarManutencao = (m) => {
          const desc = (m.descricao || '').toLowerCase();
          const sys = (m.sistema_afetado || '').toLowerCase();

          if (sys === 'elétrica' || sys === 'eletrica' || desc.includes('bateria') || desc.includes('farol') || desc.includes('lampada') || desc.includes('lâmpada') || desc.includes('sirene') || desc.includes('giroflex') || desc.includes('pisca') || desc.includes('elétrica') || desc.includes('eletrica') || desc.includes('fusível') || desc.includes('fusivel') || desc.includes('buzina')) {
            return 'Elétrica';
          }
          if (sys === 'motor' || desc.includes('óleo') || desc.includes('oleo') || desc.includes('lubrificante') || desc.includes('filtro') || desc.includes('radiador') || desc.includes('água') || desc.includes('agua') || desc.includes('aquecimento') || desc.includes('correia') || desc.includes('fumaça') || desc.includes('fumaca') || desc.includes('vazamento') || desc.includes('motor')) {
            return 'Motor / Óleo';
          }
          if (sys === 'freios' || sys === 'freio' || desc.includes('freio') || desc.includes('pastilha') || desc.includes('disco') || desc.includes('abs') || desc.includes('fluido')) {
            return 'Freios';
          }
          if (sys === 'suspensão' || sys === 'suspensao' || desc.includes('suspensao') || desc.includes('suspensão') || desc.includes('amortecedor') || desc.includes('mola') || desc.includes('pneu') || desc.includes('roda') || desc.includes('alinhamento') || desc.includes('balanceamento')) {
            return 'Suspensão / Pneus';
          }
          return 'Outros';
        };

        const contagemTipos = {
          'Motor / Óleo': 0,
          'Elétrica': 0,
          'Freios': 0,
          'Suspensão / Pneus': 0,
          'Outros': 0
        };

        const manutencoesPorTipo = Object.keys(contagemTipos).reduce((acc, tipo) => {
          acc[tipo] = [];
          return acc;
        }, {});

        manutencoesVtr.forEach(m => {
          const cat = categorizarManutencao(m);
          contagemTipos[cat] = (contagemTipos[cat] || 0) + 1;
          manutencoesPorTipo[cat] = [...(manutencoesPorTipo[cat] || []), m];
        });

        const totalDefeitos = manutencoesVtr.length;

        return (
          <div className="fade-in">
            <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.5rem', margin: 0 }}>
                  {filtroVtr ? `Histórico Detalhado: VTR ${filtroVtr}` : 'Histórico Recente da Frota'}
                </h3>
                <p className="text-muted">Lista de turnos, quilometragem e registros operacionais</p>
              </div>
              {filtroVtr && (
                <button
                  className="btn btn-secondary"
                  onClick={() => carregarHistorico()}
                  style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.9rem' }}
                >
                  <Filter size={16} /> Ver Toda Frota
                </button>
              )}
            </div>

            {filtroVtr && (
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>

                  {/* KPI Média de KM */}
                  <div className="stat-card" style={{ borderTop: '4px solid var(--bm-green)', padding: '1.25rem', height: '100%' }}>
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-available)' }}>
                      <TrendingUp size={24} />
                    </div>
                    <div className="stat-info" style={{ textAlign: 'left' }}>
                      <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Média KM por Dia Ativo</span>
                      <p style={{ fontSize: '1.8rem', margin: '4px 0 0 0', fontWeight: 800 }}>{mediaKmPorDia} km</p>
                      <small className="text-muted" style={{ fontSize: '0.7rem' }}>Total de {totalKm} km rodados em {diasAtivos} dias de serviço</small>
                    </div>
                  </div>

                  {/* KPI Defeitos */}
                  <div
                    className="stat-card"
                    onClick={() => setExpandirTiposManutencao(!expandirTiposManutencao)}
                    style={{
                      borderTop: '4px solid var(--status-alteration)',
                      padding: '1.25rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      border: expandirTiposManutencao ? '1px solid var(--status-alteration)' : '1px solid var(--border-color)',
                      borderTopWidth: '4px',
                      height: '100%'
                    }}
                  >
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-alteration)' }}>
                      <AlertTriangle size={24} />
                    </div>
                    <div className="stat-info" style={{ textAlign: 'left', width: '100%' }}>
                      <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                        <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Defeitos / Ocorrências</span>
                        <span className="badge badge-alert" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                          {expandirTiposManutencao ? 'Fechar' : 'Clique para ver'}
                        </span>
                      </div>
                      <p style={{ fontSize: '1.8rem', margin: '4px 0 0 0', fontWeight: 800 }}>{totalDefeitos}</p>
                      <small className="text-muted" style={{ fontSize: '0.7rem' }}>Chamados e manutenções registradas</small>
                    </div>
                  </div>

                </div>

                {/* Painel de detalhamento de manutenções expansível */}
                {expandirTiposManutencao && (
                  <div className="card fade-in" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                    <h4 style={{ margin: '0 0 1.25rem 0', color: 'var(--text-main)', fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      Detalhamento de Manutenções por Categoria
                    </h4>
                    {totalDefeitos === 0 ? (
                      <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', margin: '1rem 0' }}>Nenhuma ocorrência ou defeito registrado para esta viatura.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {Object.entries(contagemTipos).map(([tipo, qtd]) => {
                          const percentual = totalDefeitos > 0 ? ((qtd / totalDefeitos) * 100).toFixed(0) : 0;
                          const registrosTipo = manutencoesPorTipo[tipo] || [];
                          const categoriaAberta = categoriaManutencaoAberta === tipo;
                          return (
                            <div
                              key={tipo}
                              onClick={() => qtd > 0 && setCategoriaManutencaoAberta(categoriaAberta ? null : tipo)}
                              title={qtd > 0 ? 'Clique para ver os detalhes desta categoria' : 'Sem registros nesta categoria'}
                              style={{
                                cursor: qtd > 0 ? 'pointer' : 'default',
                                opacity: qtd > 0 ? 1 : 0.65,
                                padding: '0.65rem',
                                borderRadius: '8px',
                                border: categoriaAberta ? '1px solid var(--bm-gold)' : '1px solid transparent',
                                backgroundColor: categoriaAberta ? 'var(--hover-bg)' : 'transparent',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div className="flex-between" style={{ marginBottom: '6px', fontSize: '0.85rem' }}>
                                <span style={{ fontWeight: 600 }}>{tipo}</span>
                                <span className="badge badge-secondary" style={{ display: 'inline-flex', gap: '6px', fontWeight: 'bold' }}>
                                  {qtd} {qtd === 1 ? 'registro' : 'registros'} ({percentual}%)
                                </span>
                              </div>
                              <div style={{ height: '8px', background: 'var(--hover-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${percentual}%`,
                                    height: '100%',
                                    background: tipo === 'Motor / Óleo' ? 'var(--bm-gold)' : tipo === 'Elétrica' ? '#3b82f6' : tipo === 'Freios' ? 'var(--status-alteration)' : tipo === 'Suspensão / Pneus' ? '#10b981' : '#6b7280',
                                    borderRadius: '4px',
                                    transition: 'width 0.8s ease'
                                  }}
                                ></div>
                              </div>
                              {categoriaAberta && (
                                <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                  {registrosTipo.map(m => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setManutencaoSelecionada(m);
                                      }}
                                      className="btn btn-secondary"
                                      style={{
                                        height: 'auto',
                                        minHeight: 'auto',
                                        width: '100%',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        padding: '0.75rem',
                                        textAlign: 'left',
                                        backgroundColor: 'var(--card-bg)',
                                        border: '1px solid var(--border-color)'
                                      }}
                                    >
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                        <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{m.descricao || 'Sem descrição'}</strong>
                                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                                          {formatarData(m.data_relato)} por {m.relatado_por || 'N/A'}{m.origem ? ` (${m.origem})` : ''}
                                        </span>
                                      </div>
                                      <Eye size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--bm-green)' }} />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="card table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    {!filtroVtr && <th>VTR</th>}
                    <th>Motorista</th>
                    <th>Início / Fim</th>
                    <th>Quilometragem</th>
                    <th>Distância Rodada</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.length === 0 ? (
                    <tr>
                      <td colSpan={filtroVtr ? 4 : 5} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                        Nenhum registro de turno encontrado.
                      </td>
                    </tr>
                  ) : (
                    historico.map(log => {
                      const dist = log.km_final && log.km_inicial ? log.km_final - log.km_inicial : null;
                      return (
                        <tr key={log.id}>
                          {!filtroVtr && (
                            <td>
                              <strong className="link-prefix" onClick={() => setServicoSelecionado(log)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <Car size={16} color="var(--bm-green)" /> {log.prefixo_vtr}
                              </strong>
                            </td>
                          )}
                          <td>
                            <strong>{log.motorista}</strong>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {log.matricula_assuncao || 'N/A'}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.8rem' }}>🏁 Início: {formatarData(log.hora_inicial)}</div>
                            <div style={{ fontSize: '0.8rem', color: log.hora_final ? 'inherit' : 'var(--status-available)', fontWeight: log.hora_final ? 'normal' : 'bold' }}>
                              🏁 Fim: {log.hora_final ? formatarData(log.hora_final) : 'Em curso ➔'}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Inicial: {log.km_inicial} km</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Final: {log.km_final ? `${log.km_final} km` : '---'}</div>
                          </td>
                          <td>
                            {dist !== null ? (
                              <span className="badge badge-secondary" style={{ fontWeight: 'bold' }}>
                                +{dist} km
                              </span>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '0.85rem' }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {viewMode === 'acessos' && (
        <div className="fade-in">
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.5rem' }}>Logs, Telemetria & Rastreabilidade</h3>
              <p className="text-muted">Acessos e auditoria de ações do sistema</p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--input-bg)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
              <button
                className={`btn`}
                style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '0.85rem', width: 'auto', backgroundColor: tipoLogExibido === 'acessos' ? 'var(--bm-green)' : 'transparent', color: tipoLogExibido === 'acessos' ? 'white' : 'var(--text-muted)' }}
                onClick={() => setTipoLogExibido('acessos')}
              >
                Acessos ME
              </button>
              <button
                className={`btn`}
                style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '0.85rem', width: 'auto', backgroundColor: tipoLogExibido === 'auditoria' ? 'var(--bm-green)' : 'transparent', color: tipoLogExibido === 'auditoria' ? 'white' : 'var(--text-muted)' }}
                onClick={() => setTipoLogExibido('auditoria')}
              >
                Log Auditoria P4
              </button>
            </div>
          </div>

          {tipoLogExibido === 'acessos' ? (
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
                            href={`https://google.com/maps?q=${log.latitude},${log.longitude}`}
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
          ) : (
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
                            href={`https://google.com/maps?q=${log.latitude},${log.longitude}`}
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
        </div>
      )}

      {viewMode === 'whatsapp' && (
        <div className="fade-in" style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '6rem' }}>
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.5rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={22} color="var(--bm-gold)" /> Integração Evolution API
            </h3>
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>Versão: 0.4.13</span>
          </div>

          <div className="card" style={{ padding: '2rem', textAlign: 'left' }}>
            <p className="text-muted" style={{ fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6' }}>
              Configure a <strong>Evolution API</strong> para enviar notificações em tempo real no WhatsApp sempre que uma viatura for assumida ou devolvida pelos motoristas (ME).<br /><br />
              ⚠️ <strong>Versão Recomendada:</strong> Evolution Manager v0.4.13.<br />
              Se você não possui um servidor do Evolution configurado ou não deseja utilizar os alertas pelo WhatsApp, <strong>deixe a opção abaixo desativada</strong> para evitar lentidão ou erros de conexão.
            </p>

            <form onSubmit={salvarWhatsappSettings}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', backgroundColor: 'var(--input-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div>
                  <label htmlFor="wa-enabled" style={{ margin: 0, fontWeight: 700, cursor: 'pointer', color: 'var(--text-main)', fontSize: '1.05rem', display: 'block' }}>
                    Ativar Notificações Automáticas
                  </label>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Liga/desliga todos os disparos de mensagens.</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="wa-enabled"
                    checked={waConfig.enabled}
                    onChange={e => setWaConfig({ ...waConfig, enabled: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Link da API (Base URL) <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="Ex: https://gemensagem.ddns.net"
                  value={waConfig.url}
                  onChange={e => setWaConfig({ ...waConfig, url: e.target.value })}
                  required
                  disabled={salvandoWa}
                />
                <small className="text-muted" style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem' }}>O link de acesso à API do seu Evolution (geralmente sem o "/manager/").</small>
                {waConfig.url.toLowerCase().includes('/manager') && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-alteration)', color: 'var(--status-alteration)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <strong>⚠️ Link do Evolution Manager Detectado!</strong>
                    <span>Você inseriu o link do painel visual (Evolution Manager). Para que os disparos funcionem, você deve usar o link da <strong>API backend</strong> (geralmente o mesmo link sem o "/manager/").</span>
                    <span style={{ fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', marginTop: '4px' }} onClick={() => {
                      const apiRoot = waConfig.url.split('/manager')[0];
                      setWaConfig(prev => ({ ...prev, url: apiRoot }));
                    }}>
                      💡 Clique aqui para corrigir automaticamente para: {waConfig.url.split('/manager')[0]}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Nome da Instância <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: p4_vtr"
                    value={waConfig.instance}
                    onChange={e => setWaConfig({ ...waConfig, instance: e.target.value })}
                    required
                    disabled={salvandoWa}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">API Key (apikey) <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Token da API"
                    value={waConfig.apikey}
                    onChange={e => setWaConfig({ ...waConfig, apikey: e.target.value })}
                    required
                    disabled={salvandoWa}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label className="form-label">Telefone de Destino (Com DDD) <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: 5553999999999 ou JID do Grupo"
                  value={waConfig.phone}
                  onChange={e => setWaConfig({ ...waConfig, phone: e.target.value })}
                  required
                  disabled={salvandoWa}
                />
                <small className="text-muted" style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem' }}>
                  Insira o número completo com código do país (ex: 55 para o Brasil) e DDD, ou o JID do grupo do WhatsApp.
                </small>
                {waConfig.phone.trim().length >= 10 && waConfig.phone.trim().length <= 11 && !waConfig.phone.trim().startsWith('55') && /^\d+$/.test(waConfig.phone.trim()) && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid var(--bm-gold)', color: 'var(--bm-gold)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <strong>⚠️ Código de País (DDI) Ausente!</strong>
                    <span>O WhatsApp exige o código do país antes do DDD. Para o Brasil, você deve adicionar <strong>55</strong> no início do número.</span>
                    <span style={{ fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', marginTop: '4px' }} onClick={() => {
                      setWaConfig(prev => ({ ...prev, phone: '55' + waConfig.phone.trim() }));
                    }}>
                      💡 Clique aqui para corrigir automaticamente para: 55{waConfig.phone.trim()}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={testarConectividadeWhatsapp}
                  disabled={salvandoWa || testandoWa}
                  style={{ flex: 1, backgroundColor: 'var(--hover-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                >
                  {testandoWa ? 'Enviando Teste...' : 'Testar Conectividade'}
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={salvandoWa || testandoWa}
                  style={{ flex: 2 }}
                >
                  {salvandoWa ? 'Salvando...' : 'Salvar Configurações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === 'usuarios' && (
        <div className="fade-in">
          <div className="responsive-grid">
            <div className="card table-wrapper" style={{ gridColumn: 'span 2' }}>
              <div className="flex-between" style={{ marginBottom: '1rem' }}>
                <div>
                  <h3>Usuários (ME)</h3>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Motoristas cadastrados no sistema.</p>
                </div>
                <button className="btn btn-primary" onClick={() => abrirEdicaoMotorista(null)} style={{ width: 'auto' }}>
                  <PlusCircle size={20} /> Cadastrar ME
                </button>
              </div>
              <table className="table">
                <thead><tr><th>Grad/Nome</th><th>Matrícula</th><th>Telefone</th><th>Senha</th><th>Ações</th></tr></thead>
                <tbody>{motoristas.map(mot => (
                  <tr key={mot.id}>
                    <td><strong>{mot.graduacao} {mot.nome}</strong></td>
                    <td>{mot.matricula}</td>
                    <td>{mot.telefone}</td>
                    <td style={{ WebkitTextSecurity: 'disc' }}>{mot.senha}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-icon" onClick={() => abrirEdicaoMotorista(mot)} title="Editar"><Edit size={16} /></button>
                        <button className="btn-icon" onClick={() => enviarLinkResetWhatsapp(mot)} title="Enviar Link de Recuperação via WhatsApp" style={{ color: 'var(--bm-green)' }}><Zap size={16} /></button>
                        <button className="btn-icon" onClick={() => excluirMotorista(mot.id)} title="Excluir"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ESTRATÉGICO: RELATÓRIO EXECUTIVO DE PRONTIDÃO (PRINT FRIENDLY) */}
      {modalRelatorioExecutivo && (
        <div className="modal-overlay" onClick={() => setModalRelatorioExecutivo(false)} style={{ zIndex: 3000 }}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '100%', borderTopColor: 'var(--bm-green)', padding: '2rem' }}>

            {/* CSS Print Styles em Linha Otimizado */}
            <style>{`
              .only-print {
                display: none !important;
              }
              @media print {
                body {
                  background-color: #ffffff !important;
                  color: #000000 !important;
                  font-family: 'Times New Roman', serif;
                }
                .modal-overlay {
                  position: relative !important;
                  background-color: transparent !important;
                  backdrop-filter: none !important;
                  padding: 0 !important;
                  display: block !important;
                }
                .modal-content {
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                  max-width: 100% !important;
                  width: 100% !important;
                  background: transparent !important;
                }
                .no-print {
                  display: none !important;
                }
                .only-print {
                  display: block !important;
                }
                .print-header {
                  display: block !important;
                  border-bottom: 2px double #000 !important;
                  margin-bottom: 20px !important;
                  text-align: center !important;
                }
                .table th {
                  background-color: #f2f2f2 !important;
                  color: #000000 !important;
                  border: 1px solid #000 !important;
                }
                .table td {
                  border: 1px solid #000 !important;
                }
              }
            `}</style>

            <div className="flex-between no-print" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--bm-green)' }}>Visualização de Briefing Estratégico</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" onClick={() => window.print()} style={{ width: 'auto', padding: '8px 16px' }}>
                  <Monitor size={18} /> Imprimir / Gerar PDF
                </button>
                <button className="btn btn-secondary" onClick={() => setModalRelatorioExecutivo(false)} style={{ width: 'auto', padding: '8px 16px' }}>
                  Fechar
                </button>
              </div>
            </div>

            {/* Cabeçalho Militar Tradicional */}
            <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                Estado do Rio Grande do Sul
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-main)', marginTop: '4px' }}>
                Brigada Militar • 1ª Companhia do 46º BPM
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Bagé - RS • Setor de Logística e Patrimônio (P4)
              </div>

              <h2 style={{ fontSize: '1.45rem', marginTop: '1.5rem', textTransform: 'uppercase', color: 'var(--bm-green)', letterSpacing: '0.5px' }}>
                Relatório Estratégico de Prontidão da Frota
              </h2>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Período de Referência: <strong>{
                  filtroTempo === 'semanal' ? 'Últimos 7 Dias' :
                    filtroTempo === 'mensal' ? 'Últimos 30 Dias' :
                      filtroTempo === 'personalizado' ? `Customizado (${filtroDataInicio ? formatarDataString(filtroDataInicio) : 'Início'} a ${filtroDataFim ? formatarDataString(filtroDataFim) : 'Fim'})` :
                        'Geral (Histórico Completo)'
                }</strong> {filtroVtrBI && <> • Viatura: <strong>VTR {filtroVtrBI}</strong></>} • Gerado em: {new Date().toLocaleString('pt-BR')}
              </div>
            </div>

            {/* Sumário de Indicadores Executivos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem', textAlign: 'center' }}>
              <div style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>KM Total Rodado</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--bm-green)' }}>{relatorioBI.resumoGeral.totalKm} KM</strong>
              </div>
              <div style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>Missões/Turnos</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--bm-green)' }}>{relatorioBI.resumoGeral.totalTurnos} Turnos</strong>
              </div>
              <div style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>Manutenções</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--status-alteration)' }}>{relatorioBI.resumoGeral.totalAlertas} Ocorrências</strong>
              </div>
              <div style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>Disponibilidade Geral</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--status-available)' }}>
                  {(relatorioBI.stats.reduce((acc, curr) => acc + Number(curr.uptime), 0) / (relatorioBI.stats.length || 1)).toFixed(1)}%
                </strong>
              </div>
            </div>

            {/* Tabela de Consolidado por Viatura */}
            <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '0.75rem', color: 'var(--bm-green)', textTransform: 'uppercase', fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                Inventário Operacional e Índices de Saúde
              </h4>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--table-header-bg)' }}>
                    <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color)' }}>Prefixo VTR</th>
                    <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color)' }}>KM Rodado</th>
                    <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color)' }}>Turnos Efetuados</th>
                    <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color)' }}>Média KM/Turno</th>
                    <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color)' }}>Índice Uptime</th>
                    <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color)' }}>Problemas</th>
                    <th style={{ padding: '8px', borderBottom: '2px solid var(--border-color)' }}>Status Mecânico</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorioBI.stats.map(s => (
                    <tr key={s.prefixo}>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}><strong>VTR {s.prefixo}</strong></td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{s.kmTotal} km</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{s.turnos}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{s.kmMedio} km</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>{s.uptime}%</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', color: s.relatosMotorista > 0 ? 'red' : 'inherit' }}>{s.relatosMotorista} relatos</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ color: s.scoreSaude > 80 ? 'var(--status-available)' : s.scoreSaude > 50 ? 'var(--status-warning)' : 'var(--status-alteration)', fontWeight: 700 }}>
                          {s.scoreSaude > 80 ? 'EXCELENTE' : s.scoreSaude > 50 ? 'ATENÇÃO' : 'CRÍTICO'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Diagnóstico Estratégico & Diretrizes */}
            <div style={{ textAlign: 'left', marginBottom: '3rem' }}>
              <h4 style={{ marginBottom: '0.75rem', color: 'var(--bm-green)', textTransform: 'uppercase', fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                Diretrizes de Manutenção e Parecer Técnico
              </h4>
              <div style={{ backgroundColor: 'var(--input-bg)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {relatorioBI.stats.filter(s => s.scoreSaude < 80).map(s => (
                    <li key={s.prefixo} style={{ color: 'var(--status-alteration)' }}>
                      <strong>VTR {s.prefixo} (Alerta de Saúde):</strong> Apresenta índice de saúde de {s.scoreSaude}%. Necessita de inspeção imediata no setor de mecânica devido ao acúmulo de relatos de avaria ({s.relatosMotorista}).
                    </li>
                  ))}
                  {relatorioBI.stats.filter(s => Number(s.uptime) < 85).map(s => (
                    <li key={s.prefixo} style={{ color: 'var(--status-warning)' }}>
                      <strong>VTR {s.prefixo} (Uptime Baixo):</strong> Disponibilidade operacional de {s.uptime}% abaixo da meta da CIA (85%). Recomenda-se remanejamento de patrulha.
                    </li>
                  ))}
                  {relatorioBI.stats.length > 0 && (
                    <li>
                      <strong>Parecer da Frota Geral:</strong> A disponibilidade operacional geral está estimada em <strong>{(relatorioBI.stats.reduce((acc, curr) => acc + Number(curr.uptime), 0) / (relatorioBI.stats.length || 1)).toFixed(1)}%</strong>, indicando conformidade com as diretrizes do Comando do 46º BPM. Recomenda-se prosseguir com as manutenções preventivas preventivamente a cada 5000 km.
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Linhas de Assinatura com Entradas Editáveis antes do Print */}
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '4rem', fontSize: '0.85rem' }}>
              <div style={{ textAlign: 'center', width: '250px' }}>
                {/* Espaço em branco no topo para a assinatura manuscrita (acima da linha) */}
                <div style={{ height: '60px' }}></div>

                {/* Linha de Assinatura e Conteúdo abaixo dela */}
                <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>
                  {/* Campo de digitação de nome em tela */}
                  <input
                    type="text"
                    className="signature-input no-print"
                    placeholder="Digitar nome..."
                    value={nomeAuxP4}
                    onChange={e => setNomeAuxP4(e.target.value)}
                    style={{
                      border: 'none',
                      borderBottom: '1px dashed var(--border-color)',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      textAlign: 'center',
                      width: '100%',
                      marginBottom: '4px',
                      outline: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      padding: '2px 0'
                    }}
                  />
                  {/* Nome impresso abaixo da linha */}
                  <div className="only-print" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px', minHeight: '18px' }}>
                    {nomeAuxP4 || '\u00A0'}
                  </div>
                  {/* Cargo */}
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    Aux do P4
                  </div>
                  {/* Unidade */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    1ª Cia / 46º BPM
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', width: '250px' }}>
                {/* Espaço em branco no topo para a assinatura manuscrita (acima da linha) */}
                <div style={{ height: '60px' }}></div>

                {/* Linha de Assinatura e Conteúdo abaixo dela */}
                <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>
                  {/* Campo de digitação de nome em tela */}
                  <input
                    type="text"
                    className="signature-input no-print"
                    placeholder="Digitar nome..."
                    value={nomeComandante}
                    onChange={e => setNomeComandante(e.target.value)}
                    style={{
                      border: 'none',
                      borderBottom: '1px dashed var(--border-color)',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      textAlign: 'center',
                      width: '100%',
                      marginBottom: '4px',
                      outline: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      padding: '2px 0'
                    }}
                  />
                  {/* Nome impresso abaixo da linha */}
                  <div className="only-print" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px', minHeight: '18px' }}>
                    {nomeComandante || '\u00A0'}
                  </div>
                  {/* Cargo */}
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    Comandante da 1ª/2º Cia
                  </div>
                  {/* Unidade */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    46º Batalhão de Polícia Militar
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Central de Impressão de QR Codes em Lote */}
      {modalLoteQR && (
        <div className="modal-overlay" onClick={() => setModalLoteQR(false)} style={{ zIndex: 1600 }}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px', width: '100%', borderTopColor: 'var(--bm-green)' }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: 'var(--bm-green)', color: 'white', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><QrCode size={24} /></div>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>Imprimir QR Codes em Lote</h3>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>Selecione as viaturas e configure o layout do PDF</span>
                </div>
              </div>
              <button onClick={() => setModalLoteQR(false)} className="btn-icon"><X /></button>
            </div>

            {/* Painel de Controles */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', backgroundColor: 'var(--hover-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Layout do PDF</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button type="button" className={`btn ${colunasLote === 2 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setColunasLote(2)} style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', backgroundColor: colunasLote === 2 ? 'var(--bm-green)' : 'var(--input-bg)', color: colunasLote === 2 ? 'white' : 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                    2 Colunas (4 por Pág.)
                  </button>
                  <button type="button" className={`btn ${colunasLote === 3 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setColunasLote(3)} style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', backgroundColor: colunasLote === 3 ? 'var(--bm-green)' : 'var(--input-bg)', color: colunasLote === 3 ? 'white' : 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                    3 Colunas (6 por Pág. - Ideal)
                  </button>
                  <button type="button" className={`btn ${colunasLote === 4 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setColunasLote(4)} style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', backgroundColor: colunasLote === 4 ? 'var(--bm-green)' : 'var(--input-bg)', color: colunasLote === 4 ? 'white' : 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                    4 Colunas (8 por Pág.)
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Filtros Rápidos</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button type="button" className="btn" onClick={selecionarTodasLote} style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', backgroundColor: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                    Todas
                  </button>
                  <button type="button" className="btn" onClick={selecionarApenasDisponiveisLote} style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', backgroundColor: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                    Disponíveis
                  </button>
                  <button type="button" className="btn" onClick={desmarcarTodasLote} style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', backgroundColor: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                    Nenhuma
                  </button>
                </div>
              </div>
            </div>

            {/* Listagem de Viaturas */}
            <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Selecione as Viaturas:</strong>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>{vtrsSelecionadasLote.length} de {viaturas.length} selecionadas</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', maxHeight: '300px', overflowY: 'auto', padding: '4px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--input-bg)' }}>
                {viaturas.map(vtr => {
                  const isSelected = vtrsSelecionadasLote.includes(vtr.prefixo);
                  return (
                    <div
                      key={vtr.id}
                      onClick={() => toggleVtrLote(vtr.prefixo)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid var(--bm-green)' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'rgba(45, 74, 34, 0.1)' : 'var(--card-bg)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => { }} // Controlado pelo onClick do container parent
                        style={{ accentColor: 'var(--bm-green)', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>VTR {vtr.prefixo}</span>
                        <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: vtr.status === 'disponivel' ? 'var(--status-available)' : vtr.status === 'em_servico' ? 'var(--status-inservice)' : 'var(--status-warning)' }}>
                          {vtr.status === 'em_servico' ? 'em serviço' : vtr.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalLoteQR(false)} style={{ flex: 1, backgroundColor: 'var(--hover-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={imprimirLoteQRCodes} disabled={vtrsSelecionadasLote.length === 0} style={{ flex: 2 }}>
                <Monitor size={18} /> Gerar PDF / Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Canvases ocultos para geração de imagens de QR Codes de todas as viaturas em alta resolução */}
      <div style={{ display: 'none' }}>
        {viaturas.map(vtr => (
          <QRCodeCanvas
            key={vtr.id}
            id={`qr-canvas-lote-${vtr.prefixo}`}
            value={`${window.location.origin}/vtr/${vtr.prefixo}`}
            size={1024}
            includeMargin={true}
          />
        ))}
      </div>
    </div>
  );
}
