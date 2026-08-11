import crypto from 'crypto';
import express from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';

const api = express();
const APP_URL = 'https://vtrsaas.web.app';
const APP_SALT = 'vtr-saas-46bpm-brigade-2026';

api.use(express.json({ limit: '1mb' }));

function hashPassword(password) {
  return crypto.createHash('sha256').update(`${APP_SALT}::${password}::${APP_SALT}`).digest('hex');
}

// Inicialização adiada: o Firebase CLI precisa apenas descobrir a Function no deploy.
function firestore() {
  const firebaseApp = getApps()[0] || initializeApp();
  return getFirestore(firebaseApp);
}

function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function formatPhone(value = '') {
  const digits = onlyDigits(value);
  return !digits.startsWith('55') && (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
}

async function getWhatsappConfig() {
  const snapshot = await firestore().collection('settings').doc('whatsapp').get();
  const config = snapshot.exists ? snapshot.data() : null;
  if (!config?.enabled || !config.url || !config.instance || !config.apikey) {
    throw new Error('WhatsApp não está configurado ou habilitado no painel.');
  }
  return config;
}

async function sendText(number, text, config) {
  const baseUrl = config.url.trim().replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/message/sendText/${config.instance.trim()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.apikey.trim() },
    body: JSON.stringify({ number, textMessage: { text } })
  });
  if (!response.ok) throw new Error(`Evolution retornou ${response.status}.`);
}

api.post('/api/login', async (req, res) => {
  const { matricula, senha } = req.body;
  if (!matricula || !senha) return res.status(400).json({ error: 'Matrícula e senha são obrigatórias.' });
  try {
    const ref = firestore().collection('motoristas').doc(String(matricula).trim());
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ error: 'Matrícula não encontrada.' });
    const motorista = snapshot.data();
    const hash = hashPassword(senha);
    const legacy = !motorista.senha_hash && motorista.senha === senha;
    if (motorista.senha_hash !== hash && !legacy) return res.status(401).json({ error: 'Senha incorreta.' });
    if (legacy) await ref.update({ senha_hash: hash, senha: FieldValue.delete() });
    return res.json({ ok: true, motorista: { matricula, graduacao: motorista.graduacao, nome: motorista.nome, telefone: motorista.telefone || '' } });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

api.post('/api/register', async (req, res) => {
  const { matricula, senha, graduacao, nome, telefone } = req.body;
  if (!matricula || !senha || !graduacao || !nome) return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
  try {
    const ref = firestore().collection('motoristas').doc(String(matricula).trim());
    if ((await ref.get()).exists) return res.status(400).json({ error: 'Matrícula já cadastrada no sistema.' });
    await ref.set({ matricula, graduacao, nome, telefone: telefone || '', senha_hash: hashPassword(senha), criado_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp() });
    return res.json({ ok: true, motorista: { matricula, graduacao, nome, telefone: telefone || '' } });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
  }
});

api.post('/api/recover-password', async (req, res) => {
  const { matricula } = req.body;
  if (!matricula) return res.status(400).json({ error: 'Matrícula é obrigatória.' });
  try {
    const ref = firestore().collection('motoristas').doc(String(matricula).trim());
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ error: 'Matrícula não cadastrada no sistema.' });
    const motorista = snapshot.data();
    const phone = formatPhone(motorista.telefone);
    if (!phone) return res.status(400).json({ error: 'Não há telefone válido cadastrado para esta matrícula.' });
    const token = crypto.randomBytes(32).toString('base64url');
    await ref.update({ reset_token: token, reset_token_expires: Date.now() + 15 * 60 * 1000 });
    const config = await getWhatsappConfig();
    const link = `${APP_URL}/vtr?reset_matricula=${encodeURIComponent(matricula)}&reset_token=${encodeURIComponent(token)}`;
    await sendText(phone, `🔔 *VTR SaaS - Recuperação de Senha*\n\nOlá, *${motorista.graduacao} ${motorista.nome}*!\n\nPara definir uma nova senha, acesse o link válido por 15 minutos:\n👉 ${link}`, config);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
    return res.status(500).json({ error: 'Erro interno ao processar recuperação de senha.' });
  }
});

api.post('/api/validate-token', async (req, res) => {
  const { matricula, token } = req.body;
  if (!matricula || !token) return res.status(400).json({ error: 'Matrícula e token são obrigatórios.' });
  try {
    const snapshot = await firestore().collection('motoristas').doc(String(matricula).trim()).get();
    const motorista = snapshot.exists ? snapshot.data() : null;
    if (motorista?.reset_token === token && Date.now() < motorista.reset_token_expires) return res.json({ ok: true });
    return res.status(400).json({ error: 'Token inválido ou expirado.' });
  } catch (error) {
    console.error('Erro ao validar token:', error);
    return res.status(500).json({ error: 'Erro interno ao validar token.' });
  }
});

api.post('/api/reset-password', async (req, res) => {
  const { matricula, token, novaSenha } = req.body;
  if (!matricula || !token || !novaSenha) return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  if (novaSenha.length < 6) return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  try {
    const ref = firestore().collection('motoristas').doc(String(matricula).trim());
    const snapshot = await ref.get();
    const motorista = snapshot.exists ? snapshot.data() : null;
    if (motorista?.reset_token !== token || Date.now() >= motorista.reset_token_expires) return res.status(400).json({ error: 'Token inválido ou expirado.' });
    await ref.update({ senha_hash: hashPassword(novaSenha), senha: FieldValue.delete(), reset_token: FieldValue.delete(), reset_token_expires: FieldValue.delete(), atualizado_em: FieldValue.serverTimestamp() });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return res.status(500).json({ error: 'Erro interno ao redefinir senha.' });
  }
});

api.get('/api/health', (_req, res) => res.json({ ok: true }));

export const vtrApi = onRequest({ region: 'southamerica-east1', cors: true }, api);
