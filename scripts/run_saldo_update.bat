@echo off
title Atualizador de Saldos Ticket Log - VTR Control
echo ==================================================
echo   Iniciando Atualizacao Automatica de Saldos VTR
echo ==================================================
echo.

REM Navega para a pasta do projeto
cd /d "%~dp0.."

REM Verifica se a pasta venv existe, senao cria
if not exist "venv" (
    echo Criando ambiente virtual Python ^(venv^)...
    python -m venv venv
)

REM Ativa o ambiente virtual se existir
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

REM Instala/Atualiza dependencias se necessario
echo Verificando dependencias...
pip install -q -r scripts\requirements.txt
playwright install chromium

REM Executa o script Python
echo.
echo Executando consulta cartao por cartao...
python scripts\atualizar_saldos_ticketlog.py

echo.
echo ==================================================
echo Processo finalizado!
echo ==================================================
pause
