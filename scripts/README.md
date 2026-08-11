# Automação de Saldos de Combustível (Ticket Log) - VTR Control

Este módulo realiza a verificação automática diária do saldo do cartão de abastecimento (Ticket Log) de cada viatura cadastrada no sistema e salva o valor no **Firebase Firestore**.

---

## 🚀 Como Funciona

1. O script em Python ([atualizar_saldos_ticketlog.py](file:///c:/Users/P4/Desktop/react/vtr-control/scripts/atualizar_saldos_ticketlog.py)) se conecta ao Firebase Firestore e busca todas as viaturas com `cartao_abastecimento` cadastrado.
2. Ele processa a lista **cartão por cartão** (sequencialmente), abrindo a página da Ticket Log, resolvendo o reCAPTCHA via transcrição de áudio e extraindo o valor do saldo.
3. Insere um intervalo de segurança de 15 a 25 segundos entre cada consulta para evitar bloqueios de IP pelo servidor da Ticket Log.
4. Salva o valor em `saldo_cartao` e a data/hora em `data_atualizacao_saldo` no documento da viatura no Firebase.
5. No painel Admin do `vtr-control`, ao clicar no prefixo da viatura, o saldo do dia aparece em destaque ao lado do número do cartão.

---

## 📋 Pré-requisitos (No computador que rodará a automação)

- **Python 3.9+** instalado no Windows (com opção "Add Python to PATH" marcada na instalação).
- **FFmpeg** instalado (necessário para a biblioteca `pydub` converter áudios do reCAPTCHA MP3 para WAV).
  - *Instalação rápida do FFmpeg via PowerShell (como Administrador)*: `winget install FFmpeg`

---

## 🛠️ Como Executar Manualmente

Basta dar dois cliques no arquivo:
👉 `scripts/run_saldo_update.bat`

O script irá criar o ambiente virtual Python, instalar todas as dependências automaticamente e executar a verificação.

---

## ⏰ Como Agendar para Rodar de Segunda a Sexta (Agendador de Tarefas do Windows)

Para que o script rode todos os dias úteis (ex: às **07:00 da manhã**):

1. Pressione `Win + R`, digite `taskschd.msc` e pressione Enter para abrir o **Agendador de Tarefas do Windows**.
2. No menu à direita, clique em **Criar Tarefa Básica...**.
3. **Nome**: `VTR Control - Atualizar Saldos Ticket Log`.
4. **Disparador**: Selecione **Semanalmente**.
5. **Horário**: Marque `07:00:00` e selecione os dias **Segunda, Terça, Quarta, Quinta e Sexta**.
6. **Ação**: Selecione **Iniciar um programa**.
7. **Programa/script**: Clique em Procurar e selecione o arquivo:
   `C:\Users\P4\Desktop\react\vtr-control\scripts\run_saldo_update.bat`
8. Clique em **Concluir**.

Pronto! Todas as manhãs de segunda a sexta o saldo das viaturas será verificado e exibido no painel de Administração do VTR Control.
