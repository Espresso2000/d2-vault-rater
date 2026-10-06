@echo off
rem Vault Rater in your browser at https://localhost:7777 (uses the Bungie app keys in d2-vault-rater\.env).
rem Your browser warns about the self-signed certificate the first time: choose Advanced, then continue.
cd /d "%~dp0d2-vault-rater\web"
if not exist node_modules (echo Installing... & call npm install || goto :fail)
start "" /min cmd /c "timeout /t 5 >nul & start https://localhost:7777/"
call npm run local
if errorlevel 1 pause
goto :eof
:fail
echo Setup failed. Check that Node.js 20 or newer is installed.
pause
