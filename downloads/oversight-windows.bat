@echo off
title Oversight Installer - by BigHappySmiley
color 0B
cls
echo.
echo   OVERSIGHT  -  by BigHappySmiley
echo   ==========================================
echo.

set /p SERVER_URL="Enter your Oversight server URL (e.g. https://oversight.example.com): "
set /p PAIRING_CODE="Enter the 6-digit pairing code from the parent dashboard: "

set INSTALL_DIR=%USERPROFILE%\.oversight
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo.
echo Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
  echo Python not found. Opening Python download page...
  start https://www.python.org/downloads/
  echo Please install Python 3, then run this installer again.
  pause
  exit
)
echo Python found.

echo Installing dependencies...
pip install requests psutil pywin32 --quiet

echo Downloading Oversight agent...
curl -fsSL "%SERVER_URL%/download/agent_windows.py" -o "%INSTALL_DIR%\agent.py" 2>nul
if not exist "%INSTALL_DIR%\agent.py" (
  echo Download failed. Check your server URL.
  pause
  exit
)

echo Writing config...
(
echo {
echo   "server_url": "%SERVER_URL%",
echo   "device_token": ""
echo }
) > "%INSTALL_DIR%\config.json"

echo Pairing with parent account...
cd /d "%INSTALL_DIR%"
python agent.py --pair-code %PAIRING_CODE%

echo Installing as startup service...
python agent.py --install

echo.
echo  Oversight installed successfully!
echo  The agent starts automatically with Windows.
echo.
pause
