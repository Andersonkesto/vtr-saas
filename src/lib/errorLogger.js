import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

// Cache para evitar logs duplicados idênticos em sequência rápida (dentro de 5 segundos)
const recentLogs = new Map();

/**
 * Registra um erro da aplicação no Firestore para monitoramento e auditoria em 'Acessos'.
 * @param {Object} params
 * @param {'LOGIN_ADMIN' | 'LOGIN_ME' | 'CADASTRO_ME' | 'ASSUNCAO_VTR' | 'FINALIZACAO_VTR' | 'MANUTENCAO' | 'SISTEMA'} params.origem
 * @param {string} params.mensagem
 * @param {Object} [params.detalhes]
 * @param {Error|any} [params.erro]
 * @param {'critico' | 'erro' | 'aviso'} [params.severidade]
 */
export const registrarErroApp = async ({
  origem = 'SISTEMA',
  mensagem = 'Erro não especificado',
  detalhes = {},
  erro = null,
  severidade = 'erro'
}) => {
  try {
    const dedupeKey = `${origem}_${mensagem}_${detalhes?.prefixo || ''}_${detalhes?.matricula || ''}`;
    const now = Date.now();
    if (recentLogs.has(dedupeKey) && now - recentLogs.get(dedupeKey) < 5000) {
      return; // Evita flooding do mesmo erro repetido no mesmo segundo
    }
    recentLogs.set(dedupeKey, now);

    // Obter IP público do cliente com fallback seguro e timeout rápido
    let ip = 'Desconhecido';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        ip = data.ip || 'Desconhecido';
      }
    } catch (_) { }

    const userEmail = auth?.currentUser?.email || detalhes?.usuario_email || null;
    const erroString = erro ? (erro.message || String(erro)) : null;
    const stackTrace = erro?.stack ? String(erro.stack).slice(0, 1500) : null;

    const payload = {
      timestamp: serverTimestamp(),
      origem,
      mensagem: String(mensagem || erroString || 'Erro desconhecido'),
      detalhes: {
        ...detalhes,
        ...(erroString && erroString !== mensagem ? { erroOriginal: erroString } : {}),
        ...(stackTrace ? { stackTrace } : {})
      },
      usuario_email: userEmail,
      matricula: detalhes?.matricula || detalhes?.matriculaConfirmacao || null,
      prefixo_vtr: detalhes?.prefixo || detalhes?.prefixo_vtr || null,
      severidade: ['critico', 'erro', 'aviso'].includes(severidade) ? severidade : 'erro',
      status: 'pendente', // 'pendente' | 'resolvido'
      ip,
      dispositivo: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Celular' : 'PC',
      userAgent: navigator.userAgent,
      url: window.location.pathname + window.location.search
    };

    await addDoc(collection(db, 'error_logs'), payload);
  } catch (logErr) {
    console.error('Falha interna ao registrar log de erro:', logErr);
  }
};

/**
 * Inicializa captura global de erros de runtime do window e promises não tratadas.
 */
export const initGlobalErrorLogging = () => {
  if (typeof window === 'undefined' || window.__vtr_error_logger_initialized) return;
  window.__vtr_error_logger_initialized = true;

  window.addEventListener('error', (event) => {
    // Ignorar erros irrelevantes de extensões de navegador
    if (event.filename && (event.filename.includes('chrome-extension') || event.filename.includes('moz-extension'))) {
      return;
    }
    registrarErroApp({
      origem: 'SISTEMA',
      mensagem: event.message || 'Erro não tratado na aplicação',
      detalhes: {
        arquivo: event.filename,
        linha: event.lineno,
        coluna: event.colno
      },
      erro: event.error,
      severidade: 'erro'
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason || 'Promise rejeitada sem tratamento');
    registrarErroApp({
      origem: 'SISTEMA',
      mensagem: `Promessa não tratada: ${message}`,
      detalhes: {
        tipo: 'unhandledrejection'
      },
      erro: reason instanceof Error ? reason : null,
      severidade: 'aviso'
    });
  });
};

