@echo off
setlocal
cd /d "%~dp0"
if not exist "index.html" (
	echo Signal Outpost CPS index.html is missing from this folder.
	echo Extract the complete ZIP before launching the CPS.
	pause
	exit /b 1
)
set "PYTHON_EXE=%USERPROFILE%\Documents\RadioFoundry_Baofeng-DM-32UV_manual_install_2026-11-20\venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE="
if not defined PYTHON_EXE for /f "delims=" %%P in ('where python.exe 2^>nul') do if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
if not defined PYTHON_EXE (
	echo Python 3 was not found. Install Python or the RadioFoundry manual-install kit, then launch this file again.
	pause
	exit /b 1
)
echo Serving this folder: %CD%
start "Signal Outpost CPS local server" "%PYTHON_EXE%" -m http.server 8776 --bind 127.0.0.1
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8776/"
echo Signal Outpost CPS is serving locally at http://127.0.0.1:8776/
echo Use Chrome or Edge. Close the server window when you are finished.