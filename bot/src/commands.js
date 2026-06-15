import { db } from './firebaseAdmin.js';

const STATUS_LABELS = {
  disponivel: 'Disponível',
  em_servico: 'Em serviço',
  manutencao: 'Manutenção',
  baixada: 'Baixada',
  inativa: 'Inativa'
};

function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function normalizePhone(value = '') {
  const digits = onlyDigits(value);

  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  return digits;
}

function formatStatus(status) {
  return STATUS_LABELS[status] || status || 'Sem status';
}

function getPrefixo(doc) {
  const data = doc.data();
  return data.prefixo || data.prefixo_vtr || doc.id;
}

async function findMotoristaByWhatsapp(senderNumber) {
  const normalizedSender = normalizePhone(senderNumber);
  const snapshot = await db.collection('motoristas').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (normalizePhone(data.telefone) === normalizedSender) {
      return {
        id: doc.id,
        matricula: data.matricula || doc.id,
        nome: data.nome || '',
        graduacao: data.graduacao || '',
        telefone: data.telefone || ''
      };
    }
  }

  return null;
}

export async function handleVtrCommand(senderNumber) {
  const motorista = await findMotoristaByWhatsapp(senderNumber);

  if (!motorista) {
    return 'Não encontrei seu WhatsApp cadastrado em Usuários ME. Procure a administração/P4 para vincular seu telefone.';
  }

  const snapshot = await db
    .collection('viaturas')
    .where('status', '==', 'em_servico')
    .where('matricula_ativa', '==', motorista.matricula)
    .get();

  if (snapshot.empty) {
    return `Nenhuma VTR em assunção para ${motorista.graduacao} ${motorista.nome} (${motorista.matricula}).`;
  }

  const linhas = snapshot.docs.map((doc) => {
    const vtr = doc.data();
    const prefixo = getPrefixo(doc);
    const km = Number.isFinite(Number(vtr.km_atual)) ? `${vtr.km_atual} km` : 'KM não informado';

    return `VTR ${prefixo} - ${formatStatus(vtr.status)} - ${km}`;
  });

  return [
    `VTR em assunção para ${motorista.graduacao} ${motorista.nome}:`,
    '',
    ...linhas
  ].join('\n');
}

export async function handleStatusCommand() {
  const snapshot = await db.collection('viaturas').get();

  if (snapshot.empty) {
    return 'Nenhuma VTR cadastrada no sistema.';
  }

  const linhas = snapshot.docs
    .map((doc) => {
      const vtr = doc.data();
      const prefixo = getPrefixo(doc);
      const matricula = vtr.matricula_ativa ? ` - ME ${vtr.matricula_ativa}` : '';

      return `VTR ${prefixo}: ${formatStatus(vtr.status)}${matricula}`;
    })
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

  return ['Status da frota:', '', ...linhas].join('\n');
}

export async function resolveCommand(text, senderNumber) {
  const [command] = text.trim().toLowerCase().split(/\s+/);

  if (command === '!vtr') {
    return handleVtrCommand(senderNumber);
  }

  if (command === '!status') {
    return handleStatusCommand();
  }

  return null;
}
