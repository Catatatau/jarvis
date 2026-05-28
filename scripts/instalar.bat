@echo off
setlocal EnableExtensions
title Instalacao do ATLAS
echo Instalando tudo...

echo Verificando Node.js...
node -v || (echo ERRO: Instale Node.js 22 em nodejs.org && pause && exit /b 1)
npm -v || (echo ERRO: NPM nao encontrado. Reinstale o Node.js marcando a opcao npm. && pause && exit /b 1)

echo Verificando Python...
python --version || (echo ERRO: Instale Python em python.org && pause && exit /b 1)
python -m pip --version || (echo ERRO: PIP nao encontrado. Reinstale o Python marcando a opcao pip. && pause && exit /b 1)

echo Instalando OpenClaw e Ngrok...
call npm install -g openclaw@latest
call npm install -g ngrok

echo Instalando dependencias do site Atlas Web...
cd /d "%~dp0..\jarvis-web"
if exist package-lock.json (
  call npm ci || call npm install
) else (
  call npm install
)
if errorlevel 1 (
  echo ERRO: Falha ao instalar dependencias do site. O Vite nao vai funcionar sem node_modules.
  pause
  exit /b 1
)

echo Instalando dependencias Python...
cd /d "%~dp0..\python-agent"
python -m pip install flask flask-cors pyautogui psutil keyboard Pillow requests
if errorlevel 1 (
  echo ERRO: Falha ao instalar dependencias Python principais.
  pause
  exit /b 1
)

echo Instalando dependencias de visao do PC...
python -m pip install numpy opencv-python mediapipe || echo AVISO: dependencias de visao nao instaladas. O chat continua funcionando; use Python 3.10-3.12 para ATLAS Vision.

echo.
echo CONCLUIDO! Execute scripts\start-jarvis.bat para iniciar.
pause
