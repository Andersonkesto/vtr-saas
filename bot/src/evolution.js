export async function sendText(number, text, config = {}) {
  const evolutionUrl = config.url?.trim().replace(/\/$/, '') || process.env.EVOLUTION_URL?.replace(/\/$/, '');
  const evolutionInstance = config.instance?.trim() || process.env.EVOLUTION_INSTANCE;
  const evolutionApiKey = config.apikey?.trim() || process.env.EVOLUTION_APIKEY;

  if (!evolutionUrl || !evolutionInstance || !evolutionApiKey) {
    throw new Error('Configuração da Evolution incompleta.');
  }

  const response = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: evolutionApiKey
    },
    body: JSON.stringify({
      number,
      textMessage: { text }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha ao enviar WhatsApp: ${response.status} ${detail}`);
  }
}
