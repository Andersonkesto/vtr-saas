import os
import sys
import time
import random
import re
import tempfile
import requests
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Adiciona binários do FFmpeg automaticamente no PATH do Python
try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
except Exception:
    pass

from pydub import AudioSegment
import speech_recognition as sr
from playwright.sync_api import sync_playwright

from dotenv import load_dotenv

# -----------------------------------------------------------------------------
# CONFIGURAÇÕES E INICIALIZAÇÃO DO FIREBASE
# -----------------------------------------------------------------------------
# Caminho para a raiz do projeto e carregamento de variáveis do .env
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

CREDENTIALS_PATH = os.path.join(BASE_DIR, "gecadastro-firebase-adminsdk-fbsvc-5fac624b51.json")

# CPF padrão para consulta de saldo (lido do arquivo .env)
DEFAULT_CPF = os.environ.get("TICKETLOG_CPF", "00000000000")

if not os.path.exists(CREDENTIALS_PATH):
    print(f"[ERRO CRÍTICO] Chave do Firebase não encontrada em: {CREDENTIALS_PATH}")
    sys.exit(1)

# Inicializa o app do Firebase Admin
cred = credentials.Certificate(CREDENTIALS_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()

# -----------------------------------------------------------------------------
# FUNÇÃO AUXILIAR PARA RESOLVER AUDIO RECAPTCHA DO GOOGLE (GRATUITO)
# -----------------------------------------------------------------------------
def resolver_recaptcha_audio(page):
    """
    Localiza o desafio do reCAPTCHA na página, ativa a opção por áudio,
    baixa o MP3, converte para WAV e faz o reconhecimento de voz via SpeechRecognition.
    """
    try:
        print("  -> Tentando resolver reCAPTCHA via áudio...")
        
        # Localiza os iframes do reCAPTCHA
        recaptcha_frame = None
        for _ in range(10):
            for frame in page.frames:
                if "recaptcha/api2/anchor" in frame.url or "recaptcha/enterprise/anchor" in frame.url:
                    recaptcha_frame = frame
                    break
            if recaptcha_frame:
                break
            time.sleep(0.5)

        if recaptcha_frame:
            checkbox = recaptcha_frame.locator("#recaptcha-anchor")
            if checkbox.is_visible():
                checkbox.click(force=True)
                time.sleep(2.5)
                # Verifica se o Google aprovou direto (sem solicitar desafio)
                if checkbox.get_attribute("aria-checked") == "true":
                    print("  -> reCAPTCHA aprovado direto (sem desafio visual/áudio)!")
                    return True

        # Aguarda a aparição do iframe do desafio visual/áudio (bframe)
        challenge_frame = None
        for _ in range(8):
            for frame in page.frames:
                if "recaptcha/api2/bframe" in frame.url or "recaptcha/enterprise/bframe" in frame.url:
                    challenge_frame = frame
                    break
            if challenge_frame:
                break
            time.sleep(0.5)

        if not challenge_frame:
            print("  [AVISO] reCAPTCHA aprovado sem desafio de janela.")
            return True

        # Clica no botão de áudio dentro do desafio se visível
        audio_button = challenge_frame.locator("#recaptcha-audio-button").or_(challenge_frame.locator(".rc-button-audio")).first
        if audio_button.is_visible(timeout=2000):
            audio_button.click(force=True)
            # Aguarda a URL do áudio (tenta tag <audio id="audio-source">, link .rc-audiochallenge-tdownload-link ou payload)
        src_url = None
        for _ in range(12):
            try:
                audio_el = (
                    challenge_frame.locator("#audio-source")
                    .or_(challenge_frame.locator(".rc-audiochallenge-tdownload-link"))
                    .or_(challenge_frame.locator("audio"))
                    .or_(challenge_frame.locator("a[href*='recaptcha']"))
                ).first
                
                src_url = audio_el.get_attribute("src", timeout=500) or audio_el.get_attribute("href", timeout=500)
                if src_url and ("http" in src_url or "payload" in src_url):
                    break
            except Exception:
                pass
            time.sleep(0.5)

        if not src_url:
            # Se a primeira tentativa falhar, tenta clicar no botão 'Recarregar desafio' do reCAPTCHA
            reload_btn = challenge_frame.locator("#recaptcha-reload-button").first
            if reload_btn.is_visible():
                print("  -> Recarregando novo desafio do reCAPTCHA...")
                reload_btn.click(force=True)
                time.sleep(2)
                audio_button = challenge_frame.locator("#recaptcha-audio-button").or_(challenge_frame.locator(".rc-button-audio")).first
                if audio_button.is_visible():
                    audio_button.click(force=True)
                    time.sleep(2)
                    for _ in range(8):
                        try:
                            audio_el = (
                                challenge_frame.locator("#audio-source")
                                .or_(challenge_frame.locator(".rc-audiochallenge-tdownload-link"))
                                .or_(challenge_frame.locator("audio"))
                                .or_(challenge_frame.locator("a[href*='recaptcha']"))
                            ).first
                            src_url = audio_el.get_attribute("src", timeout=500) or audio_el.get_attribute("href", timeout=500)
                            if src_url and ("http" in src_url or "payload" in src_url):
                                break
                        except Exception:
                            pass
                        time.sleep(0.5)

        if not src_url:
            print("  [AVISO] Não foi possível obter a URL do áudio do reCAPTCHA (Google pode ter limitado temporariamente nesta tentativa).")
            return False

        # Baixa o áudio MP3
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        response = requests.get(src_url, headers=headers)
        temp_mp3 = os.path.join(tempfile.gettempdir(), "captcha_audio.mp3")
        temp_wav = os.path.join(tempfile.gettempdir(), "captcha_audio.wav")
        
        with open(temp_mp3, "wb") as f:
            f.write(response.content)

        # Converte MP3 para WAV
        sound = AudioSegment.from_mp3(temp_mp3)
        sound.export(temp_wav, format="wav")

        # Reconhecimento de Voz (Google Speech Recognition - O áudio do reCAPTCHA é falado em Inglês)
        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_wav) as source:
            audio_data = recognizer.record(source)
            text_result = recognizer.recognize_google(audio_data, language="en-US")

        print(f"  -> Áudio transcrito com sucesso (en-US): '{text_result}'")

        # Limpa arquivos temporários
        if os.path.exists(temp_mp3): os.remove(temp_mp3)
        if os.path.exists(temp_wav): os.remove(temp_wav)

        # Digita o resultado no campo de resposta
        audio_response_input = challenge_frame.locator("#audio-response").or_(challenge_frame.locator("input[id*='audio']")).first
        audio_response_input.fill(text_result)
        time.sleep(1)

        # Clica no botão Verificar
        verify_button = challenge_frame.locator("#recaptcha-verify-button").or_(challenge_frame.locator("button:has-text('Verificar')")).first
        verify_button.click(force=True)
        time.sleep(3)

        return True

    except Exception as e:
        print(f"  [ALERTA] Falha ao resolver áudio do reCAPTCHA: {e}")
        return False


# -----------------------------------------------------------------------------
# CONSULTA DE SALDO POR CARTÃO (TICKET LOG)
# -----------------------------------------------------------------------------
def consultar_saldo_cartao(browser, cartao_numero, cpf_responsavel):
    """
    Executa a navegação no site da Ticket Log para 1 cartão específico usando a instância ativa do browser.
    """
    cartao_limpo = re.sub(r'\D', '', str(cartao_numero))
    cpf_usar = cpf_responsavel if cpf_responsavel else DEFAULT_CPF
    cpf_limpo = re.sub(r'\D', '', str(cpf_usar))

    print(f"\n==================================================")
    print(f"Iniciando consulta para o cartão: {cartao_limpo}")
    print(f"==================================================")

    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 720}
    )
    page = context.new_page()

    # Injeta script de desativação do modo automação (stealth mode)
    page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US'] });
    """)

    try:
        # Acessa o site oficial da Ticket Log
        page.goto("https://www.ticketlog.com.br/", timeout=45000)
        time.sleep(2)

        # Remove permanentemente qualquer overlay/modal do OneTrust do DOM para evitar interceptação de cliques
        try:
            page.evaluate("""() => {
                const ids = ['onetrust-consent-sdk', 'onetrust-banner-sdk', 'onetrust-pc-sdk'];
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.remove();
                });
                const filters = document.querySelectorAll('.onetrust-pc-dark-filter');
                filters.forEach(f => f.remove());
            }""")
        except Exception:
            pass

        # Clica no botão 'Meu Saldo' ou abre o modal de consulta
        meu_saldo_btn = page.locator("text=Meu Saldo").first
        if meu_saldo_btn.is_visible():
            meu_saldo_btn.click(force=True)
            time.sleep(2)

        # Preenche os campos do formulário
        cartao_input = page.locator("input[name='nr_cartao']").or_(page.locator("input[name='cartao']")).or_(page.locator("input[placeholder*='Cartão']")).first
        cpf_input = page.locator("input[name='nr_cpf']").or_(page.locator("input[name='cpf']")).or_(page.locator("input[placeholder*='CPF']")).first

        if cartao_input.is_visible():
            cartao_input.click(force=True)
            cartao_input.fill(cartao_limpo)
            cartao_input.dispatch_event("input")
            cartao_input.dispatch_event("change")
            print(f"  -> Campo Cartão preenchido ({cartao_limpo}).")
        
        if cpf_input.is_visible():
            cpf_input.click(force=True)
            cpf_input.fill(cpf_limpo)
            cpf_input.dispatch_event("input")
            cpf_input.dispatch_event("change")
            print(f"  -> Campo CPF preenchido ({cpf_limpo}).")

        # Tenta resolver o CAPTCHA se estiver presente
        resolver_recaptcha_audio(page)

        # Clica no botão Enviar / Consultar
        time.sleep(1)
        submit_btn = page.locator("button:has-text('Enviar')").or_(page.locator("input[type='submit']")).first
        if submit_btn.is_visible():
            try:
                page.evaluate("btn => btn.removeAttribute('disabled')", submit_btn.element_handle())
            except Exception:
                pass
            submit_btn.click(force=True)
            print("  -> Formulário enviado. Aguardando redirecionamento para Embratec...")

        # Aguarda redirecionamento rápido para Embratec
        time.sleep(1.5)
        target_page = page
        if len(context.pages) > 1:
            target_page = context.pages[-1]

        try:
            target_page.wait_for_selector("text=saldo disponível", timeout=4000)
        except Exception:
            pass

        print(f"  -> Página atual de resultado: {target_page.url}")
        page_text = target_page.inner_text("body")

        # Busca ESTRITA pela frase oficial do saldo da Embratec/Ticket Log:
        # Ex: "O saldo disponível de ABASTECIMENTO/SERVICOS em ... é de R$ 4.000,00"
        match_oficial = re.search(r'saldo disponível.*?é de\s*R\$\s*([0-9\.\,]+)', page_text, re.IGNORECASE | re.DOTALL)
        if not match_oficial:
            match_oficial = re.search(r'é de\s*R\$\s*([0-9\.\,]+)', page_text, re.IGNORECASE)

        if match_oficial:
            valor_saldo = match_oficial.group(1).strip()
            print(f"  [SUCESSO] Saldo oficial da viatura capturado: R$ {valor_saldo}")
            context.close()
            return valor_saldo

        print("  [AVISO] O saldo oficial ainda não foi exibido na tela da Embratec.")
        context.close()
        return None

    except Exception as e:
        print(f"  [ERRO] Ocorreu uma exceção durante a consulta do cartão {cartao_limpo}: {e}")
        try:
            context.close()
        except:
            pass
        return None


# -----------------------------------------------------------------------------
# EXECUÇÃO PRINCIPAL (LOOP MULTI-PASSADAS ATÉ 100% CONCLUÍDO)
# -----------------------------------------------------------------------------
def rodar_atualizacao_saldos():
    hoje_str = datetime.now().strftime("%d/%m/%Y")
    max_passadas = 3  # Tenta até 3 ciclos para garantir 100% dos cartões no dia

    for passada in range(1, max_passadas + 1):
        print(f"\n==================================================")
        print(f"[{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}] PASSADA {passada}/{max_passadas} DE VERIFICAÇÃO")
        print(f"==================================================")

        vtrs_ref = db.collection("viaturas").stream()
        viaturas_com_cartao = []

        for doc in vtrs_ref:
            dados = doc.to_dict()
            dados['id'] = doc.id
            cartao = dados.get('cartao_abastecimento') or dados.get('cartaoAbastecimento')
            if cartao and str(cartao).strip() != '':
                viaturas_com_cartao.append(dados)

        if not viaturas_com_cartao:
            print("Nenhuma viatura com cartão cadastrado. Finalizando.")
            return

        # FILTRO INTELIGENTE: Separa já verificadas e pendentes
        viaturas_para_processar = []
        viaturas_ja_atualizadas = 0

        for vtr in viaturas_com_cartao:
            data_atual = vtr.get("data_atualizacao_saldo") or vtr.get("dataAtualizacaoSaldo") or ""
            prefixo = vtr.get('prefixo', 'VTR sem prefixo')
            cartao = vtr.get('cartao_abastecimento') or vtr.get('cartaoAbastecimento')
            saldo = vtr.get('saldo_cartao') or vtr.get('saldoCartao') or '0,00'

            if str(data_atual).startswith(hoje_str):
                if passada == 1:
                    print(f"  [CONCLUÍDO] VTR {prefixo} (Cartão: {cartao}) -> Saldo hoje: R$ {saldo} ({data_atual})")
                viaturas_ja_atualizadas += 1
            else:
                viaturas_para_processar.append(vtr)

        print(f"\nStatus: {viaturas_ja_atualizadas}/{len(viaturas_com_cartao)} viaturas concluídas hoje | {len(viaturas_para_processar)} pendentes.")

        if not viaturas_para_processar:
            print("\n==================================================")
            print("🎉 SUCESSO TOTAL: 100% das viaturas estão atualizadas com saldo hoje!")
            print("==================================================")
            return

        # Modo Headless configurável no .env (Padrão: True)
        is_headless = os.environ.get("TICKETLOG_HEADLESS", "true").lower() != "false"

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=is_headless,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-infobars",
                    "--window-size=1280,720"
                ]
            )

            try:
                for idx, vtr in enumerate(viaturas_para_processar, start=1):
                    prefixo = vtr.get('prefixo', 'VTR sem prefixo')
                    cartao = vtr.get('cartao_abastecimento') or vtr.get('cartaoAbastecimento')
                    cpf = vtr.get('cpf_responsavel', '')

                    print(f"\nProcessando {idx}/{len(viaturas_para_processar)}: {prefixo} (Cartão: {cartao})")

                    saldo_encontrado = None
                    try:
                        # 1ª Tentativa
                        saldo_encontrado = consultar_saldo_cartao(browser, cartao, cpf)
                        
                        # 2ª Tentativa automática caso a 1ª falhe
                        if not saldo_encontrado:
                            print(f"  -> Tentativa 2 de segurança para VTR {prefixo}...")
                            time.sleep(3)
                            saldo_encontrado = consultar_saldo_cartao(browser, cartao, cpf)

                    except Exception as err_vtr:
                        print(f"  [ALERTA] Erro na viatura {prefixo}: {err_vtr}")

                    # Atualiza no Firestore se encontrou o saldo
                    if saldo_encontrado:
                        agora_str = datetime.now().strftime("%d/%m/%Y %H:%M")
                        try:
                            db.collection("viaturas").document(vtr['id']).update({
                                "saldo_cartao": saldo_encontrado,
                                "saldoCartao": saldo_encontrado,
                                "data_atualizacao_saldo": agora_str,
                                "dataAtualizacaoSaldo": agora_str
                            })
                            print(f"  -> Firestore atualizado para {prefixo}: R$ {saldo_encontrado} ({agora_str})")
                        except Exception as err_db:
                            print(f"  [ERRO FIREBASE] {err_db}")
                    else:
                        print(f"  -> Viatura {prefixo} permaneceu pendente nesta passada.")

                    if idx < len(viaturas_para_processar):
                        tempo_espera = random.randint(8, 14)
                        print(f"  -> Aguardando {tempo_espera}s antes da próxima viatura...")
                        time.sleep(tempo_espera)
            finally:
                browser.close()

        # Se ainda restarem viaturas pendentes e houver próximas passadas
        if passada < max_passadas:
            tempo_cooldown = int(os.environ.get("TICKETLOG_COOLDOWN_SEC", "300"))
            minutos = tempo_cooldown // 60
            print(f"\n[PAUSA DE DESBLOQUEIO DE IP] Aguardando {minutos} minuto(s) ({tempo_cooldown}s) para o Google liberar a rede e iniciar a Passada {passada + 1}...")
            time.sleep(tempo_cooldown)

    print("\n==================================================")
    print("Processamento concluído para o dia!")
    print("==================================================")

if __name__ == "__main__":
    rodar_atualizacao_saldos()
