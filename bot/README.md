# Bot WhatsApp VTR

Serviço Node.js para receber webhooks da Evolution API/Manager e responder comandos consultando o Firestore do sistema de assunção de VTR.

## Comandos

- `!vtr`: verifica se o policial que enviou a mensagem possui VTR em assunção.
- `!status`: lista as VTRs cadastradas e seus respectivos status.

## Como rodar

1. Copie `bot/.env.example` para `bot/.env`.
2. Preencha a URL, instância e API key da Evolution.
3. Baixe uma chave de conta de serviço do Firebase Admin SDK e salve como `bot/serviceAccountKey.json`, ou preencha `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`.
4. Instale as dependências:

```bash
cd bot
npm install
```

5. Inicie:

```bash
npm start
```

Configure o webhook da Evolution para apontar para:

```txt
https://seu-dominio.com/evolution/webhook?secret=SEU_WEBHOOK_SECRET
```

Em desenvolvimento local, use um túnel como Cloudflare Tunnel ou ngrok para expor a porta `3333`.
