@echo off
setlocal EnableExtensions
title ATLAS - Instalacao
color 0B

set "ROOT=%~dp0.."
set "WEB_DIR=%ROOT%\jarvis-web"
set "AGENT_DIR=%ROOT%\python-agent"

echo.
echo ==========================================
echo        ATLAS - Instalador
echo ==========================================
echo.

call :check_node || goto :fail
call :check_python || goto :fail
call :install_web || goto :fail
call :install_python_core || goto :fail
call :install_python_vision
call :install_optional_tools

echo.
echo ==========================================
echo  INSTALACAO CONCLUIDA
echo ==========================================
echo.
echo Para iniciar tudo, execute:
echo   scripts\start-tudo.bat
echo.
pause
exit /b 0

:check_node
echo [1/6] Verificando Node.js e NPM...
where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado.
  echo Instale o Node.js LTS em https://nodejs.org/ e tente novamente.
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERRO: NPM nao encontrado.
  echo Reinstale o Node.js marcando a opcao npm.
  exit /b 1
)
node -v
call npm -v
exit /b 0

:check_python
echo.
echo [2/6] Verificando Python e PIP...
where python >nul 2>&1
if errorlevel 1 (
  echo ERRO: Python nao encontrado.
  echo Instale Python 3.10, 3.11 ou 3.12 e marque "Add python.exe to PATH".
  exit /b 1
)
python --version
python -m pip --version >nul 2>&1
if errorlevel 1 (
  echo ERRO: PIP nao encontrado.
  echo Reinstale o Python marcando a opcao pip.
  exit /b 1
)
python -m pip install --upgrade pip
exit /b 0

:install_web
echo.
echo [3/6] Instalando dependencias do Atlas Web...
if not exist "%WEB_DIR%\package.json" (
  echo ERRO: package.json nao encontrado em "%WEB_DIR%".
  exit /b 1
)
cd /d "%WEB_DIR%" || exit /b 1
if exist "%WEB_DIR%\node_modules\.bin\vite.cmd" (
  echo Dependencias do Atlas Web ja estao instaladas.
  exit /b 0
)
if exist package-lock.json (
  if exist node_modules (
    call npm install --no-audit --no-fund
  ) else (
    call npm ci --no-audit --no-fund
    if errorlevel 1 (
      echo npm ci falhou. Tentando npm install...
      call npm install --no-audit --no-fund
    )
  )
) else (
  call npm install --no-audit --no-fund
)
if errorlevel 1 (
  echo ERRO: Falha ao instalar dependencias do Atlas Web.
  exit /b 1
)
if not exist "%WEB_DIR%\node_modules\.bin\vite.cmd" (
  echo ERRO: Vite nao foi instalado. Verifique sua instalacao do Node/NPM.
  exit /b 1
)
exit /b 0

:install_python_core
echo.
echo [4/6] Instalando dependencias principais do Agent...
if not exist "%AGENT_DIR%\requirements.txt" (
  echo ERRO: requirements.txt nao encontrado em "%AGENT_DIR%".
  exit /b 1
)
cd /d "%AGENT_DIR%" || exit /b 1
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo ERRO: Falha ao instalar dependencias principais do Python.
  exit /b 1
)
python -c "import flask, flask_cors, pyautogui, psutil, keyboard, requests; print('Dependencias Python principais OK')"
if errorlevel 1 (
  echo ERRO: Python ainda nao consegue importar as dependencias principais.
  exit /b 1
)
exit /b 0

:install_python_vision
echo.
echo [5/6] Instalando dependencias de visao do PC...
cd /d "%AGENT_DIR%" || exit /b 0
python -m pip install numpy opencv-python
if errorlevel 1 (
  echo AVISO: Nao foi possivel instalar numpy/opencv-python. A visao do PC pode ficar indisponivel.
  exit /b 0
)
python -m pip install mediapipe
if errorlevel 1 (
  echo AVISO: Mediapipe nao foi instalado. O chat funciona, mas gestos/camera podem ficar indisponiveis.
  echo Dica: para ATLAS Vision, prefira Python 3.10, 3.11 ou 3.12.
  exit /b 0
)
exit /b 0

:install_optional_tools
echo.
echo [6/6] Instalando ferramentas opcionais...
where openclaw >nul 2>&1
if errorlevel 1 (
  echo Instalando OpenClaw...
  call npm install -g openclaw@latest --no-audit --no-fund
  if errorlevel 1 echo AVISO: OpenClaw nao foi instalado automaticamente.
) else (
  echo OpenClaw ja esta instalado.
)
if exist "%~dp0ngrok.exe" (
  echo Ngrok local encontrado em scripts\ngrok.exe.
) else (
  echo AVISO: scripts\ngrok.exe nao encontrado. Baixe ou copie o ngrok se for usar tunel remoto.
)
exit /b 0

:fail
echo.
echo ==========================================
echo  INSTALACAO FALHOU
echo ==========================================
echo Corrija o erro acima e execute este arquivo novamente.
echo.
pause
exit /b 1
