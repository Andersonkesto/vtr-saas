function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function jidToNumber(jid = '') {
  return onlyDigits(String(jid).split('@')[0]);
}

function pickText(message = {}) {
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ''
  );
}

export function parseEvolutionPayload(body = {}) {
  const data = body.data || body;
  const key = data.key || {};
  const message = data.message || data.messageStubParameters?.message || {};
  const remoteJid = key.remoteJid || data.remoteJid || data.chatId || data.from || '';
  const participant = key.participant || data.participant || data.sender || '';
  const fromMe = Boolean(key.fromMe || data.fromMe);
  const text = pickText(message) || data.text || data.body || '';

  const senderNumber = jidToNumber(participant || remoteJid);
  const replyNumber = jidToNumber(remoteJid);

  return {
    fromMe,
    text: String(text).trim(),
    senderNumber,
    replyNumber
  };
}
