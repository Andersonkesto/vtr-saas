import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, orderBy, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { ShieldAlert, CheckCircle, Car, AlertCircle, ClipboardCheck, MapPin, Camera, List, ChevronRight, AlertTriangle, Info, CheckCircle2, User, LogOut, UserPlus, Download } from 'lucide-react';

/**
 * Componente: Viatura (Página Operacional - Mobile/Front-end)
 * Propósito: Interface de uso diário dos policiais na rua para gerenciamento do ciclo de vida do turno.
 * 
 * Funcionalidades Principais:
 * - Listagem de Frota: Exibe viaturas disponíveis e em uso.
 * - Assunção (Check-in): Valida matrícula, quilometragem, checklist (G.A.L.O.P.E) e envia notificação de Início de Turno para o WhatsApp.
 * - Finalização (Check-out): Encerra o turno, calcula KM percorrido e permite abertura de ticket de manutenção (O.S.).
 * - Auditoria: Registra logs de geolocalização e IP a cada ação importante.
 */

// Componente de Alerta Profissional
function ModalAlert({ open, title, message, type = 'info', onConfirm }) {
  if (!open) return null;

  const colors = {
    info: 'var(--bm-gold)',
    danger: 'var(--status-alteration)',
    success: 'var(--status-available)',
    warning: 'var(--status-warning)'
  };

  const icons = {
    info: <Info size={48} color={colors.info} />,
    danger: <AlertTriangle size={48} color={colors.danger} />,
    success: <CheckCircle2 size={48} color={colors.success} />,
    warning: <AlertCircle size={48} color={colors.warning} />
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal-content" style={{ borderTopColor: colors[type] }}>
        <div className="modal-confirm-icon">{icons[type]}</div>
        <h3>{title}</h3>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>{message}</p>
        <div className="modal-confirm-buttons">
          <button className="btn" onClick={onConfirm} style={{ backgroundColor: colors[type], color: 'white' }}>
            Ok, entendi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Viatura() {
  const { prefixo } = useParams();
  const navigate = useNavigate();
  const [viatura, setViatura] = useState(null);
  const [listaViaturas, setListaViaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const loggedRef = useRef(false);

  // Estado para Modal de Alerta Customizado
  const [modalAlert, setModalAlert] = useState({ open: false, title: '', message: '', type: 'info', onConfirm: null });

  // Estados para Autenticação ME
  const [meUser, setMeUser] = useState(() => {
    const saved = localStorage.getItem('vtr_me_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          return parsed;
        }
      } catch (e) { }
      localStorage.removeItem('vtr_me_user');
    }
    return null;
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [authMatricula, setAuthMatricula] = useState('');
  const [authSenha, setAuthSenha] = useState('');
  const [authGraduacao, setAuthGraduacao] = useState('Sd');
  const [authNome, setAuthNome] = useState('');
  const [authTelefone, setAuthTelefone] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // PWA Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Estados Form Assunção
  const [motorista, setMotorista] = useState('');
  const [patrulheiro, setPatrulheiro] = useState('');
  const [kmInicial, setKmInicial] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [realizouGalope, setRealizouGalope] = useState(false);
  const [temAlteracaoInicial, setTemAlteracaoInicial] = useState(false);
  const [descAlteracaoInicial, setDescAlteracaoInicial] = useState('');
  const [fotoAlteracaoInicial, setFotoAlteracaoInicial] = useState(null);
  const [matricula, setMatricula] = useState('');
  const [tentouSubmeter, setTentouSubmeter] = useState(false);

  // Estados Form Finalização
  const [kmFinal, setKmFinal] = useState('');
  const [comAlteracao, setComAlteracao] = useState(false);
  const [descAlteracao, setDescAlteracao] = useState('');
  const [fotoAlteracaoFinal, setFotoAlteracaoFinal] = useState(null);
  const [matriculaConfirmacao, setMatriculaConfirmacao] = useState('');

  const showAlert = (title, message, type, onConfirm = null) => {
    setModalAlert({
      open: true, title, message, type, onConfirm: () => {
        setModalAlert({ ...modalAlert, open: false });
        if (onConfirm) onConfirm();
      }
    });
  };

  useEffect(() => {
    if (meUser) {
      setMotorista(`${meUser.graduacao} ${meUser.nome}`);
      setMatricula(meUser.matricula);
    } else {
      setMotorista('');
      setMatricula('');
    }
  }, [meUser]);

  const handleLogoutMe = () => {
    setMeUser(null);
    localStorage.removeItem('vtr_me_user');
    navigate('/vtr');
  };

  useEffect(() => {
    if (meUser && meUser.expiresAt) {
      const timeLeft = meUser.expiresAt - Date.now();
      if (timeLeft > 0) {
        const timer = setTimeout(() => {
          handleLogoutMe();
          showAlert("Sessão Expirada", "Sua sessão de motorista expirou por segurança (30 minutos). Faça login novamente.", "warning");
        }, timeLeft);
        return () => clearTimeout(timer);
      } else {
        handleLogoutMe();
      }
    }
  }, [meUser]);

  const handleLoginMe = async (e) => {
    e.preventDefault();
    if (!authMatricula || !authSenha) return;
    setAuthLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'motoristas', authMatricula));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.senha === authSenha) {
          const userData = { matricula: authMatricula, graduacao: data.graduacao, nome: data.nome, telefone: data.telefone, expiresAt: Date.now() + 30 * 60 * 1000 };
          setMeUser(userData);
          localStorage.setItem('vtr_me_user', JSON.stringify(userData));
        } else {
          showAlert("Erro", "Senha incorreta.", "danger");
        }
      } else {
        showAlert("Erro", "Matrícula não encontrada. Cadastre-se primeiro.", "warning");
      }
    } catch (err) {
      console.error(err);
      showAlert("Erro", "Falha ao realizar login.", "danger");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterMe = async (e) => {
    e.preventDefault();
    if (authMatricula.length !== 7) {
      showAlert("Atenção", "A matrícula deve ter 7 números.", "warning");
      return;
    }
    setAuthLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'motoristas', authMatricula));
      if (docSnap.exists()) {
        showAlert("Erro", "Matrícula já está cadastrada no sistema. Faça o login.", "danger");
        setAuthLoading(false);
        return;
      }
      const data = {
        graduacao: authGraduacao,
        nome: authNome,
        matricula: authMatricula,
        telefone: authTelefone,
        senha: authSenha,
        criado_em: serverTimestamp(),
        atualizado_em: serverTimestamp()
      };
      await setDoc(doc(db, 'motoristas', authMatricula), data);

      const userData = { matricula: authMatricula, graduacao: authGraduacao, nome: authNome, telefone: authTelefone, expiresAt: Date.now() + 30 * 60 * 1000 };
      setMeUser(userData);
      localStorage.setItem('vtr_me_user', JSON.stringify(userData));

      showAlert("Sucesso", "Cadastro realizado com sucesso! Bem-vindo.", "success");
    } catch (err) {
      console.error(err);
      showAlert("Erro", "Falha ao realizar cadastro.", "danger");
    } finally {
      setAuthLoading(false);
    }
  };

  // Função para comprimir imagem nativamente via Canvas
  const comprimirImagem = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; // Resolução Full HD amigável
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Converte para JPEG com 70% de qualidade (ótimo equilíbrio)
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.7);
        };
      };
    });
  };

  const obterLocalizacao = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ erro: 'API Não Suportada' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          resolve({ erro: error.message, negado: error.code === error.PERMISSION_DENIED });
        },
        { timeout: 7000, enableHighAccuracy: true } // 7s de limite para não travar muito a tela
      );
    });
  };

  const registrarAcao = async (acao, prefOverride = null) => {
    try {
      let ip = 'Desconhecido';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ip = ipData.ip;
      } catch (ipErr) {
        console.warn("Não foi possível obter o IP:", ipErr);
      }

      const loc = await obterLocalizacao();

      const logData = {
        prefixo_vtr: prefOverride || prefixo || 'LISTAGEM',
        timestamp: serverTimestamp(),
        acao: acao,
        ip: ip,
        userAgent: navigator.userAgent,
        plataforma: navigator.platform,
        dispositivo: /Mobi|Android/i.test(navigator.userAgent) ? 'Celular' : 'PC',
        tela: `${window.innerWidth}x${window.innerHeight}`
      };

      if (loc.lat && loc.lng) {
        logData.latitude = loc.lat;
        logData.longitude = loc.lng;
      } else if (loc.negado) {
        logData.gps_negado = true;
      }

      await addDoc(collection(db, 'acessos'), logData);
    } catch (e) {
      console.error("Erro ao registrar ação:", e);
    }
  };

  const criarTicketManutencao = async (descricao, origem, servicoId, arquivoFoto) => {
    try {
      let fotoUrl = null;
      if (arquivoFoto) {
        const fotoComprimida = await comprimirImagem(arquivoFoto);
        const filename = `foto_${Date.now()}.jpg`;
        const fileRef = ref(storage, `manutencoes/${servicoId}/${filename}`);
        await uploadBytes(fileRef, fotoComprimida);
        fotoUrl = await getDownloadURL(fileRef);
      }

      await addDoc(collection(db, 'manutencoes'), {
        prefixo_vtr: prefixo,
        descricao,
        origem,
        status: 'pendente',
        data_relato: serverTimestamp(),
        servico_id: servicoId,
        relatado_por: motorista || 'Desconhecido',
        foto_url: fotoUrl
      });
    } catch (e) {
      console.error("Erro ao criar ticket de manutenção:", e);
    }
  };

  useEffect(() => {
    // Resetar estados de erro/loading ao mudar de rota
    setLoading(true);
    setViatura(null);
    setError('');

    if (!prefixo) {
      // Se não tem prefixo, carrega a lista
      const q = query(collection(db, 'viaturas'), orderBy('prefixo'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const vtrs = [];
        snapshot.forEach(doc => vtrs.push({ id: doc.id, ...doc.data() }));
        setListaViaturas(vtrs);
        setLoading(false);
        if (!loggedRef.current) {
          registrarAcao('Acessou Listagem Geral');
          loggedRef.current = true;
        }
      });
      return () => unsubscribe();
    } else {
      // Se tem prefixo, carrega a viatura específica
      const fetchViatura = async () => {
        try {
          const docRef = doc(db, 'viaturas', prefixo);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setViatura({ id: docSnap.id, ...docSnap.data() });
            if (!loggedRef.current) {
              registrarAcao('Visualizou Página VTR');
              loggedRef.current = true;
            }
          } else {
            setError(`Viatura ${prefixo} não encontrada no sistema.`);
          }
        } catch (err) {
          console.error(err);
          setError("Erro ao carregar viatura.");
        } finally {
          setLoading(false);
        }
      };
      fetchViatura();
    }
  }, [prefixo]);

  useEffect(() => {
    if (viatura && viatura.status === 'disponivel') {
      setKmInicial(viatura.km_atual || 0);
    }
  }, [viatura]);

  const handleIniciarServico = async (e) => {
    e.preventDefault();
    if (matricula.length !== 7) {
      setTentouSubmeter(true);
      showAlert("Matrícula Inválida", "A matrícula deve conter exatamente 7 números.", "warning");
      return;
    }

    if (!realizouGalope) {
      setTentouSubmeter(true);
      showAlert("Atenção Obrigatória", "Você deve confirmar que realizou o G.A.L.O.P.E antes de assumir a viatura.", "danger");
      return;
    }

    setSubmitting(true);

    try {
      const loc = await obterLocalizacao();

      const servicoData = {
        prefixo_vtr: prefixo,
        motorista,
        patrulheiro,
        km_inicial: Number(kmInicial),
        finalidade,
        galope_realizado: realizouGalope,
        alteracao_inicial: temAlteracaoInicial ? descAlteracaoInicial : null,
        matricula_assuncao: matricula,
        hora_inicial: serverTimestamp(),
        timestamp: serverTimestamp()
      };

      if (loc.lat && loc.lng) {
        servicoData.lat_inicial = loc.lat;
        servicoData.lng_inicial = loc.lng;
      }

      const servicoRef = await addDoc(collection(db, 'servicos'), servicoData);

      await updateDoc(doc(db, 'viaturas', prefixo), {
        status: 'em_servico',
        km_atual: Number(kmInicial),
        servico_atual_id: servicoRef.id,
        matricula_ativa: matricula
      });

      if (temAlteracaoInicial) {
        await criarTicketManutencao(descAlteracaoInicial, 'Assunção', servicoRef.id, fotoAlteracaoInicial);
      }

      await registrarAcao('Iniciou Turno');

      // Notificação via WhatsApp (Evolution API)
      try {
        const waSnap = await getDoc(doc(db, 'settings', 'whatsapp'));
        if (waSnap.exists()) {
          const waConfig = waSnap.data();
          if (waConfig.enabled && waConfig.url && waConfig.instance && waConfig.apikey) {
            let baseUrl = waConfig.url.trim();
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

            const msg = `🔔 *VTR SaaS - Início de Serviço* 🔔\n\n` +
              `*Viatura:* VTR ${prefixo}\n` +
              `*Motorista:* ${motorista}\n` +
              `*Matrícula:* ${matricula}\n` +
              `*Patrulheiro:* ${patrulheiro || 'Nenhum'}\n` +
              `*KM Inicial:* ${kmInicial} km\n` +
              `*Finalidade:* ${finalidade}\n` +
              `*G.A.L.O.P.E. Realizado:* Sim ✅\n` +
              `*Observações/Alterações:* ${temAlteracaoInicial ? descAlteracaoInicial : 'Sem alterações'}\n\n` +
              `*Hora:* ${new Date().toLocaleString('pt-BR')}` +
              `*Desenvolvido por:* Sd Anderson`;

            const headers = { 'Content-Type': 'application/json', 'apikey': waConfig.apikey.trim() };
            const endpoint = `${baseUrl}/message/sendText/${waConfig.instance.trim()}`;

            const foneLimpoMotorista = meUser && meUser.telefone ? meUser.telefone.replace(/\D/g, '') : '';
            const foneMotoristaFormatado = foneLimpoMotorista && !foneLimpoMotorista.startsWith('55') && (foneLimpoMotorista.length === 10 || foneLimpoMotorista.length === 11) ? '55' + foneLimpoMotorista : foneLimpoMotorista;

            // Enviar notificação via WhatsApp para o Motorista logado (ME)
            if (foneMotoristaFormatado) {
              fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  number: foneMotoristaFormatado,
                  textMessage: { text: msg }
                })
              }).catch(err => console.error("Erro ao enviar WhatsApp Motorista:", err));
            }
          }
        }
      } catch (waErr) {
        console.warn("Erro ao processar notificação de WhatsApp:", waErr);
      }

      showAlert("Sucesso!", "Turno iniciado com sucesso. Bom serviço!", "success", () => {
        window.location.reload();
      });
    } catch (err) {
      console.error(err);
      showAlert("Erro", "Não foi possível iniciar o serviço.", "danger");
      setSubmitting(false);
    }
  };

  const handleFinalizarServico = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (Number(kmFinal) < (viatura.km_atual || 0)) {
        showAlert("Erro de KM", "O KM final não pode ser menor que o KM inicial.", "warning");
        setSubmitting(false);
        return;
      }

      if (matriculaConfirmacao !== viatura.matricula_ativa) {
        showAlert("Matrícula Incorreta", "A matrícula informada não confere com quem assumiu a VTR.", "danger");
        setSubmitting(false);
        return;
      }

      const loc = await obterLocalizacao();

      const servicoRef = doc(db, 'servicos', viatura.servico_atual_id);
      const updateData = {
        km_final: Number(kmFinal),
        hora_final: serverTimestamp(),
        com_alteracao: comAlteracao,
        descricao_alteracao: comAlteracao ? descAlteracao : null
      };

      if (loc.lat && loc.lng) {
        updateData.lat_final = loc.lat;
        updateData.lng_final = loc.lng;
      }

      await updateDoc(servicoRef, updateData);

      await updateDoc(doc(db, 'viaturas', prefixo), {
        status: 'disponivel',
        km_atual: Number(kmFinal),
        servico_atual_id: null,
        matricula_ativa: null
      });

      if (comAlteracao) {
        await criarTicketManutencao(descAlteracao, 'Finalização', viatura.servico_atual_id, fotoAlteracaoFinal);
      }

      await registrarAcao('Finalizou Turno');

      // Notificação via WhatsApp (Evolution API)
      try {
        const waSnap = await getDoc(doc(db, 'settings', 'whatsapp'));
        if (waSnap.exists()) {
          const waConfig = waSnap.data();
          if (waConfig.enabled && waConfig.url && waConfig.instance && waConfig.apikey) {
            let baseUrl = waConfig.url.trim();
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

            // Obter dados do motorista para exibir o nome correto na notificação de fim e pegar o telefone
            let motoristaNomeFinal = motorista || 'Desconhecido';
            let foneMotorista = meUser && meUser.telefone ? meUser.telefone : '';

            try {
              const motSnap = await getDoc(doc(db, 'motoristas', matriculaConfirmacao));
              if (motSnap.exists()) {
                const motData = motSnap.data();
                motoristaNomeFinal = `${motData.graduacao} ${motData.nome}`;
                if (!foneMotorista) {
                  foneMotorista = motData.telefone;
                }
              }
            } catch (motErr) {
              console.warn("Erro ao buscar dados do motorista para fim de serviço:", motErr);
            }

            const msg = `🔔 *VTR SaaS - Fim de Serviço* 🔔\n\n` +
              `*Viatura:* VTR ${prefixo}\n` +
              `*Motorista:* ${motoristaNomeFinal}\n` +
              `*Matrícula:* ${matriculaConfirmacao}\n` +
              `*KM Final:* ${kmFinal} km\n` +
              `*KM Percorrido:* ${Number(kmFinal) - (viatura.km_atual || 0)} km\n` +
              `*Observações/Alterações:* ${comAlteracao ? descAlteracao : 'Sem alterações'}\n\n` +
              `*Hora:* ${new Date().toLocaleString('pt-BR')}` +
              `*Desenvolvido por:* Sd Anderson`;

            const headers = { 'Content-Type': 'application/json', 'apikey': waConfig.apikey.trim() };
            const endpoint = `${baseUrl}/message/sendText/${waConfig.instance.trim()}`;

            const foneLimpoMotorista = foneMotorista ? foneMotorista.replace(/\D/g, '') : '';
            const foneMotoristaFormatado = foneLimpoMotorista && !foneLimpoMotorista.startsWith('55') && (foneLimpoMotorista.length === 10 || foneLimpoMotorista.length === 11) ? '55' + foneLimpoMotorista : foneLimpoMotorista;

            // Enviar notificação via WhatsApp para o Motorista logado (ME)
            if (foneMotoristaFormatado) {
              fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  number: foneMotoristaFormatado,
                  textMessage: { text: msg }
                })
              }).catch(err => console.error("Erro ao enviar WhatsApp Motorista:", err));
            }
          }
        }
      } catch (waErr) {
        console.warn("Erro ao processar notificação de WhatsApp:", waErr);
      }

      showAlert("Finalizado!", "Turno encerrado com sucesso. Bom descanso!", "success", () => {
        window.location.reload();
      });
    } catch (err) {
      console.error(err);
      showAlert("Erro", "Não foi possível finalizar o serviço.", "danger");
      setSubmitting(false);
    }
  };

  // Tela de Login/Cadastro do ME
  if (!meUser) {
    return (
      <div className="fade-in container" style={{ maxWidth: '400px', marginTop: '2rem' }}>
        <ModalAlert open={modalAlert.open} title={modalAlert.title} message={modalAlert.message} type={modalAlert.type} onConfirm={modalAlert.onConfirm} />

        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ backgroundColor: 'var(--bm-gold)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <User size={32} color="white" />
          </div>
          <h2 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Acesso ME</h2>
          <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {isRegistering ? 'Preencha seus dados para criar o cadastro.' : 'Faça login com sua matrícula e senha.'}
          </p>

          {!isRegistering ? (
            <form onSubmit={handleLoginMe} style={{ textAlign: 'left' }}>
              <div className="form-group">
                <label className="form-label">Matrícula (7 dígitos)</label>
                <input type="text" className="form-input" required maxLength={7} value={authMatricula} onChange={e => setAuthMatricula(e.target.value.replace(/\D/g, ''))} placeholder="0000000" style={{ letterSpacing: '2px', fontWeight: 'bold' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Senha</label>
                <input type="password" className="form-input" required value={authSenha} onChange={e => setAuthSenha(e.target.value)} placeholder="Sua senha de acesso" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={authLoading} style={{ marginTop: '1rem' }}>
                {authLoading ? 'Acessando...' : 'Entrar'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <p style={{ fontSize: '0.85rem' }}>Não possui cadastro?</p>
                <button type="button" onClick={() => setIsRegistering(true)} style={{ background: 'none', border: 'none', color: 'var(--bm-green)', fontWeight: 600, cursor: 'pointer', marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <UserPlus size={16} /> Cadastre-se rapidamente
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterMe} style={{ textAlign: 'left' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Grad.</label>
                  <select className="form-input" value={authGraduacao} onChange={e => setAuthGraduacao(e.target.value)} required>
                    <option value="Sd">Sd</option>
                    <option value="2º Sgt">2º Sgt</option>
                    <option value="1º Sgt">1º Sgt</option>
                    <option value="1º Ten">1º Ten</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Nome de Guerra</label>
                  <input type="text" className="form-input" required value={authNome} onChange={e => setAuthNome(e.target.value)} placeholder="Ex: Silva" />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Matrícula (ID Func.) <span style={{ color: 'red' }}>*</span></label>
                <input type="text" className="form-input" required maxLength={7} value={authMatricula} onChange={e => setAuthMatricula(e.target.value.replace(/\D/g, ''))} placeholder="0000000" style={{ letterSpacing: '2px', fontWeight: 'bold' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Telefone (WhatsApp)</label>
                <input type="text" className="form-input" required value={authTelefone} onChange={e => setAuthTelefone(e.target.value)} placeholder="(53) 99999-9999" />
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Crie uma Senha <span style={{ color: 'red' }}>*</span></label>
                <input type="password" className="form-input" required value={authSenha} onChange={e => setAuthSenha(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
              </div>

              <button type="submit" className="btn btn-primary" disabled={authLoading} style={{ marginTop: '1rem' }}>
                {authLoading ? 'Cadastrando...' : 'Finalizar Cadastro'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setIsRegistering(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}>
                  Já tenho cadastro (Voltar ao Login)
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container fade-in" style={{ maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto', marginTop: '2rem' }}>
        <div className="skeleton skeleton-card" style={{ height: '120px' }}></div>
        <div className="skeleton skeleton-card" style={{ height: '400px' }}></div>
      </div>
    );
  }

  // Visualização de Listagem Geral
  if (!prefixo) {
    return (
      <div className="fade-in container" style={{ maxWidth: '800px' }}>
        <div className="card" style={{ textAlign: 'center', backgroundColor: 'var(--bm-gold)', color: 'var(--bg-color)', border: 'none', marginBottom: '1.5rem', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '8px' }}>
            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: 'var(--bg-color)', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}
                title="Instalar Aplicativo no Celular"
              >
                <Download size={16} /> Instalar
              </button>
            )}
            <button
              onClick={handleLogoutMe}
              style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: 'var(--bg-color)', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}
              title="Sair da Conta ME"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
          <List size={40} style={{ margin: '1rem auto 0.5rem' }} />
          <h2 style={{ margin: 0 }}>Frota 1ª CIA</h2>
          <p style={{ opacity: 0.8 }}>Selecione uma VTR para operar</p>
          {meUser && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 600, opacity: 0.9 }}>
              👤 Logado como: {meUser.graduacao} {meUser.nome}
            </div>
          )}
        </div>

        <div className="grid-list">
          {listaViaturas.map(vtr => (
            <Link key={vtr.id} to={`/vtr/${vtr.prefixo}`} className="vtr-list-item card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `6px solid ${vtr.status === 'disponivel' ? '#10b981' : vtr.status === 'em_servico' ? '#3b82f6' : '#f59e0b'}` }}>
              <div>
                <h3 style={{ margin: 0 }}>VTR {vtr.prefixo}</h3>
                <span className={`badge ${vtr.status === 'disponivel' ? 'badge-available' : vtr.status === 'em_servico' ? 'badge-inservice' : 'badge-alert'}`} style={{ marginTop: '4px', display: 'inline-block' }}>
                  {vtr.status === 'disponivel' ? 'Disponível' : vtr.status === 'em_servico' ? 'Em Uso' : 'Baixada'}
                </span>
              </div>
              <ChevronRight size={20} color="var(--text-muted)" />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container card" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <ShieldAlert size={48} color="var(--status-alteration)" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ color: 'var(--status-alteration)' }}>Atenção</h2>
        <p style={{ marginTop: '1rem' }}>{error}</p>
        <button onClick={() => navigate('/vtr')} className="btn btn-secondary" style={{ marginTop: '1.5rem' }}>Ver todas as VTRs</button>
      </div>
    );
  }

  // Caso a VTR esteja BAIXADA
  if (viatura.status === 'baixada') {
    return (
      <div className="fade-in container" style={{ maxWidth: '600px' }}>
        <div className="card" style={{ textAlign: 'center', backgroundColor: '#f59e0b', color: 'white', border: 'none' }}>
          <AlertTriangle size={48} style={{ margin: '0 auto 0.5rem' }} />
          <h2 style={{ color: 'white', margin: 0 }}>VTR {prefixo} BAIXADA</h2>
          <p style={{ opacity: 0.9, marginTop: '0.5rem' }}>Indisponível para operação no momento.</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p>Esta viatura foi marcada como <strong>BAIXADA</strong> pelo administrador ou P4.</p>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '1rem' }}>Favor utilizar outra viatura disponível na frota.</p>
          <button onClick={() => navigate('/vtr')} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>Voltar para Lista</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in container" style={{ maxWidth: '700px' }}>
      {/* Modal de Alerta Customizado */}
      <ModalAlert
        open={modalAlert.open}
        title={modalAlert.title}
        message={modalAlert.message}
        type={modalAlert.type}
        onConfirm={modalAlert.onConfirm}
      />

      <div className="card" style={{ textAlign: 'center', backgroundColor: 'var(--bm-green)', color: 'white', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <button onClick={() => navigate('/vtr')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} title="Lista de VTRs"><List size={20} /></button>
          <Car size={48} color="var(--bm-gold)" />
          <button onClick={handleLogoutMe} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} title="Sair da Conta ME"><LogOut size={20} /></button>
        </div>
        <h2 style={{ color: 'white', margin: 0, fontSize: '2rem' }}>VTR {prefixo}</h2>
        <p style={{ opacity: 0.9, marginTop: '0.5rem' }}>
          Status: {viatura.status === 'disponivel' ? 'Disponível' : 'Em Serviço'}
        </p>
      </div>

      {viatura.status === 'disponivel' ? (
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Assunção de Viatura</h3>
          <form onSubmit={handleIniciarServico}>
            <div className="responsive-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Motorista (Logado)</label>
                <input type="text" className="form-input" required value={motorista} readOnly style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-muted)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Matrícula do ME (ID Func.) <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  className={`form-input ${tentouSubmeter && matricula.length !== 7 ? 'shake' : ''}`}
                  style={{
                    textAlign: 'center',
                    letterSpacing: window.innerWidth < 640 ? '4px' : '8px',
                    fontSize: window.innerWidth < 640 ? '1.1rem' : '1.2rem',
                    fontWeight: 'bold',
                    borderColor: tentouSubmeter && matricula.length !== 7 ? 'red' : 'inherit',
                    backgroundColor: 'var(--input-bg)', color: 'var(--text-muted)'
                  }}
                  required
                  readOnly
                  maxLength={7}
                  pattern="\d*"
                  value={matricula}
                  placeholder="0000000"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Patrulheiro(s)</label>
                <input type="text" className="form-input" required value={patrulheiro} onChange={(e) => setPatrulheiro(e.target.value)} placeholder="Ex: Sd Oliveira" />
              </div>
              <div className="form-group">
                <label className="form-label">KM Inicial</label>
                <input type="number" className="form-input" required value={kmInicial} onChange={(e) => setKmInicial(e.target.value)} min={viatura.km_atual || 0} />
              </div>
              <div className="form-group">
                <label className="form-label">Finalidade</label>
                <select className="form-input" required value={finalidade} onChange={(e) => setFinalidade(e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="Patrulhamento Ostensivo">Patrulhamento Ostensivo</option>
                  <option value="Apoio">Apoio</option>
                  <option value="Deslocamento Administrativo">Deslocamento Administrativo</option>
                  <option value="Operação Específica">Operação Específica</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>

            <div className={`${tentouSubmeter && !realizouGalope ? 'shake' : ''}`} style={{
              backgroundColor: tentouSubmeter && !realizouGalope ? 'rgba(239, 68, 68, 0.1)' : 'var(--badge-inservice-bg)',
              padding: '1rem',
              borderRadius: '8px',
              border: `1px solid ${tentouSubmeter && !realizouGalope ? 'red' : 'var(--badge-inservice-text)'}`,
              marginBottom: '1rem',
              transition: 'all 0.3s'
            }}>
              <h4 style={{ color: tentouSubmeter && !realizouGalope ? 'red' : 'var(--badge-inservice-text)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardCheck size={20} /> Inspeção Obrigatória <span style={{ color: 'red' }}>*</span>
              </h4>
              <label className="checkbox-group">
                <input type="checkbox" checked={realizouGalope} onChange={(e) => setRealizouGalope(e.target.checked)} />
                <span style={{ fontWeight: 600, color: tentouSubmeter && !realizouGalope ? 'red' : 'inherit' }}>Foi realizado o G.A.L.O.P.E?</span>
              </label>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                (Gasolina, Água, Lubrificante, Óleo, Pneus, Elétrica)
              </p>

              <div style={{ marginTop: '1rem', borderTop: `1px solid var(--badge-inservice-text)`, paddingTop: '0.75rem' }}>
                <label className="checkbox-group">
                  <input type="checkbox" checked={temAlteracaoInicial} onChange={(e) => setTemAlteracaoInicial(e.target.checked)} />
                  <span>Identificou alguma alteração ao assumir?</span>
                </label>
                {temAlteracaoInicial && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <textarea
                      className="form-input"
                      style={{ backgroundColor: 'var(--input-bg)' }}
                      rows="2"
                      required
                      placeholder="Descreva o problema identificado..."
                      value={descAlteracaoInicial}
                      onChange={(e) => setDescAlteracaoInicial(e.target.value)}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem', backgroundColor: 'var(--card-bg)', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                      <Camera size={18} color="var(--bm-green)" />
                      <span style={{ fontSize: '0.85rem' }}>{fotoAlteracaoInicial ? 'Foto Anexada' : 'Tirar Foto (Opcional)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setFotoAlteracaoInicial(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={12} /> Este registro poderá solicitar sua localização GPS
              </span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Iniciando...' : 'Confirmar e Iniciar Serviço'}
            </button>
          </form>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--status-inservice)' }}>Finalizar Serviço</h3>
          <form onSubmit={handleFinalizarServico}>
            <div className="form-group">
              <label className="form-label">KM Final (Inicial era: {viatura.km_atual})</label>
              <input type="number" className="form-input" required value={kmFinal} onChange={(e) => setKmFinal(e.target.value)} placeholder="Digite o KM final" min={viatura.km_atual} />
            </div>

            <div className="form-group" style={{ backgroundColor: 'var(--badge-inservice-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--badge-inservice-text)', marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ color: 'var(--badge-inservice-text)' }}>Confirmar Matrícula do ME</label>
              <input
                type="text"
                className="form-input"
                required
                maxLength={7}
                pattern="\d*"
                value={matriculaConfirmacao}
                onChange={(e) => setMatriculaConfirmacao(e.target.value.replace(/\D/g, ''))}
                placeholder="Informe sua matrícula para desativar"
                style={{ textAlign: 'center', letterSpacing: '4px', fontWeight: 'bold' }}
              />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                Digite os 7 números da matrícula usada na ativação.
              </p>
            </div>

            <div className="form-group" style={{ backgroundColor: 'var(--hover-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <label className="checkbox-group">
                <input type="checkbox" checked={comAlteracao} onChange={(e) => setComAlteracao(e.target.checked)} />
                <span style={{ fontWeight: 600, color: comAlteracao ? 'var(--status-alteration)' : 'var(--text-main)' }}>
                  Houve Alteração na Viatura durante o serviço?
                </span>
              </label>
              {comAlteracao && (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label">Descreva a alteração:</label>
                    <textarea
                      className="form-input"
                      rows="3"
                      required
                      value={descAlteracao}
                      onChange={(e) => setDescAlteracao(e.target.value)}
                      placeholder="Descreva detalhadamente..."
                      style={{ resize: 'vertical' }}
                    ></textarea>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem', backgroundColor: 'var(--card-bg)', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                    <Camera size={18} color="var(--bm-green)" />
                    <span style={{ fontSize: '0.85rem' }}>{fotoAlteracaoFinal ? 'Foto Anexada' : 'Tirar Foto (Opcional)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setFotoAlteracaoFinal(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            <button type="submit" className={`btn ${comAlteracao ? 'btn-danger' : 'btn-primary'}`} disabled={submitting}>
              <CheckCircle size={20} />
              {submitting ? 'Finalizando...' : 'Finalizar Turno'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
