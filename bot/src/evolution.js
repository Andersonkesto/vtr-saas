const evolutionUrl = process.env.EVOLUTION_URL?.replace(/\/$/, '');
const evolutionInstance = process.env.EVOLUTION_INSTANCE;
const evolutionApiKey = process.env.EVOLUTION_APIKEY;

export async function sendText(number, text) {
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
