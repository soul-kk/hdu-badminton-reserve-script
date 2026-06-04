@echo off
chcp 65001 >/dev/null 2>&1

REM ============================================================
REM  install_and_run.bat
REM  Windows: double-click to auto-install and run get_token.py
REM ============================================================

REM ---- Request admin privileges ----
net session >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo Requesting admin privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/k cd /d \"%~dp0\" && \"%~f0\" elevated' -Verb RunAs"
    exit /b
)

REM If we get here, we have admin rights
if "%1"=="elevated" shift

cd /d "%~dp0"
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PYTHON_DIR=%SCRIPT_DIR%python_embed"
set "GET_TOKEN=%SCRIPT_DIR%get_token.py"
set "PY_VER=3.11.9"
set "PY_ZIP=python-3.11.9-embed-amd64.zip"
set "PY_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
set "GET_PIP_URL=https://bootstrap.pypa.io/get-pip.py"

echo.
echo ========================================
echo   Token Auto-Installer
echo ========================================
echo.

REM ---- Check system Python ----
echo [*] Checking Python...
where python >/dev/null 2>&1
if %errorlevel% equ 0 (
    python --version >/dev/null 2>&1
    if !errorlevel! equ 0 (
        set "PY=python"
        echo [OK] System Python found
        goto :check_mitm
    )
)

REM ---- Check embedded Python ----
if exist "%PYTHON_DIR%\python.exe" (
    set "PY=%PYTHON_DIR%\python.exe"
    echo [OK] Local Python found
    goto :check_mitm
)

REM ---- Download embedded Python ----
echo [!] Python not found, downloading portable version (~15MB)...
echo     URL: %PY_URL%
echo.

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PY_URL%' -OutFile '%SCRIPT_DIR%%PY_ZIP%'"
if not exist "%SCRIPT_DIR%%PY_ZIP%" (
    echo [X] Download failed. Please check your network.
    pause
    exit /b 1
)

echo [*] Extracting Python...
powershell -Command "Expand-Archive -Path '%SCRIPT_DIR%%PY_ZIP%' -DestinationPath '%PYTHON_DIR%' -Force"
del "%SCRIPT_DIR%%PY_ZIP%" 2>/dev/null

REM Enable pip support in embedded Python
for %%f in ("%PYTHON_DIR%\python*._pth") do (
    echo import site>> "%%f"
)

REM Install pip
echo [*] Installing pip...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%GET_PIP_URL%' -OutFile '%PYTHON_DIR%\get-pip.py'"
"%PYTHON_DIR%\python.exe" "%PYTHON_DIR%\get-pip.py" --quiet 2>/dev/null
del "%PYTHON_DIR%\get-pip.py" 2>/dev/null

set "PY=%PYTHON_DIR%\python.exe"
echo [OK] Python portable installed

:check_mitm
echo.
echo [*] Checking mitmproxy...

where mitmdump >/dev/null 2>&1
if %errorlevel% equ 0 (
    echo [OK] mitmproxy found
    goto :run
)

if exist "%PYTHON_DIR%\Scripts\mitmdump.exe" (
    set "PATH=%PYTHON_DIR%\Scripts;%PATH%"
    echo [OK] mitmproxy found
    goto :run
)

echo [!] mitmproxy not found, installing (2-3 minutes)...
echo     Please wait...
echo.
%PY% -m pip install mitmproxy --quiet 2>/dev/null
if %errorlevel% neq 0 (
    echo [X] mitmproxy install failed
    pause
    exit /b 1
)

REM Add Scripts to PATH
if exist "%PYTHON_DIR%\Scripts" (
    set "PATH=%PYTHON_DIR%\Scripts;%PATH%"
)

echo [OK] mitmproxy installed

:run
echo.
echo [*] Starting Token tool...
echo.
%PY% "%GET_TOKEN%"

echo.
pause
