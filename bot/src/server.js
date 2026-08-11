import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin.js';
import { sendText } from './evolution.js';
import { parseEvolutionPayload } from './evolutionPayload.js';
import { resolveCommand } from './commands.js';

const app = express();
const port = Number(process.env.PORT || 3333);

// Habilita CORS manualmente para permitir requisições do frontend React
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

// Configuração do Salt de Senhas do Motorista
const APP_SALT = 'vtr-saas-46bpm-brigade-2026';

function hashPassword(password) {
  const saltedPayload = `${APP_SALT}::${password}::${APP_SALT}`;
  return crypto.createHash('sha256').update(saltedPayload).digest('hex');
}

// Rota de Login do Motorista (ME)
app.post('/api/login', async (req, res) => {
  const { matricula, senha } = req.body;
  if (!matricula || !senha) {
    return res.status(400).json({ error: 'Matrícula e senha são obrigatórias.' });
  }

  try {
    const docRef = db.collection('motoristas').doc(matricula);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Matrícula não encontrada. Cadastre-se primeiro.' });
    }

    const data = docSnap.data();
    const hashedInput = hashPassword(senha);
    const isValidHash = data.senha_hash && data.senha_hash === hashedInput;
    const isLegacyValid = !data.senha_hash && data.senha && data.senha === senha;

    if (isValidHash || isLegacyValid) {
      // Auto-migração: converte senha em texto puro para hash se for legado
      if (isLegacyValid) {
        try {
          await docRef.update({
            senha_hash: hashedInput,
            senha: FieldValue.delete()
          });
        } catch (migErr) {
          console.warn('Auto-migração de senha falhou:', migErr);
        }
      }

      return res.json({
        ok: true,
        motorista: {
          matricula: matricula,
          graduacao: data.graduacao,
          nome: data.nome,
          telefone: data.telefone || ''
        }
      });
    } else {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

// Rota de Cadastro do Motorista (ME)
app.post('/api/register', async (req, res) => {
  const { matricula, senha, graduacao, nome, telefone } = req.body;
  if (!matricula || !senha || !graduacao || !nome) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
  }

  try {
    const docRef = db.collection('motoristas').doc(matricula);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return res.status(400).json({ error: 'Matrícula já está cadastrada no sistema. Faça o login.' });
    }

    const senhaHash = hashPassword(senha);
    const data = {
      graduacao,
      nome,
      matricula,
      telefone: telefone || '',
      senha_hash: senhaHash,
      criado_em: FieldValue.serverTimestamp(),
      atualizado_em: FieldValue.serverTimestamp()
    };

    await docRef.set(data);

    return res.json({
      ok: true,
      motorista: {
        matricula,
        graduacao,
        nome,
        telefone: telefone || ''
      }
    });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
  }
});

// Rota de Solicitação de Recuperação de Senha (WhatsApp)
app.post('/api/recover-password', async (req, res) => {
  const { matricula, origin } = req.body;
  if (!matricula) {
    return res.status(400).json({ error: 'Matrícula é obrigatória.' });
  }

  try {
    const docRef = db.collection('motoristas').doc(matricula);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Matrícula não cadastrada no sistema.' });
    }

    const motData = docSnap.data();
    if (!motData.telefone) {
      return res.status(400).json({ error: 'Não há telefone cadastrado para esta matrícula. Entre em contato com a administração/P4.' });
    }

    // Token criptograficamente seguro, válido por apenas 15 minutos.
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

    await docRef.update({
      reset_token: token,
      reset_token_expires: expiresAt
    });

    const waSnap = await db.collection('settings').doc('whatsapp').get();
    if (waSnap.exists) {
      const waConfig = waSnap.data();
      if (waConfig.enabled && waConfig.url && waConfig.instance && waConfig.apikey) {
        // Em produção, APP_URL deve ser definido no ambiente do servidor.
        // No desenvolvimento local, mantém compatibilidade com a origem enviada pelo front-end.
        const clientOrigin = process.env.APP_URL || origin || 'http://localhost:5173';
        const resetLink = `${clientOrigin}/vtr?reset_matricula=${matricula}&reset_token=${token}`;
        const msg = `🔔 *VTR SaaS - Recuperação de Senha* 🔔\n\n` +
          `Olá, *${motData.graduacao} ${motData.nome}*!\n\n` +
          `Recebemos uma solicitação para redefinir a sua senha de acesso ao sistema VTR SaaS.\n\n` +
          `Para definir uma nova senha, clique no link seguro abaixo (válido por 15 minutos):\n` +
          `👉 ${resetLink}\n\n` +
          `Caso você não tenha solicitado esta redefinição, pedimos que ignore esta mensagem.\n\n` +
          `*VTR SaaS - por SD Anderson*`;

        const foneLimpo = motData.telefone.replace(/\D/g, '');
        const foneFormatado = foneLimpo && !foneLimpo.startsWith('55') && (foneLimpo.length === 10 || foneLimpo.length === 11) ? '55' + foneLimpo : foneLimpo;

        if (foneFormatado) {
          // Usa a configuração salva pelo painel administrativo no Firestore.
          await sendText(foneFormatado, msg, waConfig);
          return res.json({ ok: true });
        } else {
          return res.status(400).json({ error: 'O número de telefone registrado possui formato inválido.' });
        }
      }
    }

    return res.status(400).json({ error: 'A recuperação de senha via WhatsApp não está configurada ou ativa na central.' });
  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
    return res.status(500).json({ error: 'Erro interno ao processar recuperação de senha.' });
  }
});

// Rota para Validar o Token de Redefinição
app.post('/api/validate-token', async (req, res) => {
  const { matricula, token } = req.body;
  if (!matricula || !token) {
    return res.status(400).json({ error: 'Matrícula e token são obrigatórios.' });
  }

  try {
    const docSnap = await db.collection('motoristas').doc(matricula).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data.reset_token === token && data.reset_token_expires && Date.now() < data.reset_token_expires) {
        return res.json({ ok: true });
      }
    }
    return res.status(400).json({ error: 'Token inválido ou expirado.' });
  } catch (error) {
    console.error('Erro ao validar token:', error);
    return res.status(500).json({ error: 'Erro interno ao validar token.' });
  }
});

// Rota para Salvar a Nova Senha (Fazer o Reset)
app.post('/api/reset-password', async (req, res) => {
  const { matricula, token, novaSenha } = req.body;
  if (!matricula || !token || !novaSenha) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  if (novaSenha.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  try {
    const docRef = db.collection('motoristas').doc(matricula);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      if (data.reset_token === token && data.reset_token_expires && Date.now() < data.reset_token_expires) {
        const senhaHash = hashPassword(novaSenha);
        await docRef.update({
          senha_hash: senhaHash,
          senha: FieldValue.delete(),
          reset_token: FieldValue.delete(),
          reset_token_expires: FieldValue.delete(),
          atualizado_em: FieldValue.serverTimestamp()
        });
        return res.json({ ok: true });
      }
    }
    return res.status(400).json({ error: 'Não foi possível redefinir a senha. Token inválido ou expirado.' });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return res.status(500).json({ error: 'Erro interno ao redefinir senha.' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/evolution/webhook', async (req, res) => {
  const expectedSecret = process.env.WEBHOOK_SECRET;
  const receivedSecret = req.query.secret || req.header('x-webhook-secret');

  if (!expectedSecret) {
    console.error('WEBHOOK_SECRET não configurado; webhook recusado.');
    return res.status(503).json({ ok: false, error: 'webhook não configurado' });
  }

  if (receivedSecret !== expectedSecret) {
    return res.status(401).json({ ok: false, error: 'webhook não autorizado' });
  }

  const payload = parseEvolutionPayload(req.body);

  if (payload.fromMe || !payload.text.startsWith('!')) {
    return res.json({ ok: true, ignored: true });
  }

  try {
    const reply = await resolveCommand(payload.text, payload.senderNumber);

    if (!reply) {
      return res.json({ ok: true, ignored: true });
    }

    await sendText(payload.replyNumber, reply);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);

    if (payload.replyNumber) {
      await sendText(payload.replyNumber, 'Não consegui consultar o sistema agora. Tente novamente em instantes.').catch((sendError) => {
        console.error('Erro ao enviar mensagem de falha:', sendError);
      });
    }

    return res.status(500).json({ ok: false });
  }
});

app.listen(port, () => {
  console.log(`Bot WhatsApp VTR ouvindo na porta ${port}`);
});
