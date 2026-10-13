@echo off
rem Vault Rater in your browser at https://localhost:7777 (uses the Bungie app keys in d2-vault-rater\.env).
rem Your browser warns about the self-signed certificate the first time: choose Advanced, then continue.
cd /d "%~dp0d2-vault-rater"
rem The web app imports shared code from src\, which needs the root packages (zod) too.
if not exist node_modules\zod\package.json (echo Installing... & call npm install || goto :fail)
cd web
rem Reinstall when the packages are missing or half-installed (no vite in node_modules\.bin).
if not exist node_modules\.bin\vite.cmd (echo Installing... & call npm install || goto :fail)
start "" /min cmd /c "timeout /t 5 >nul & start https://localhost:7777/"
call npm run local
if errorlevel 1 pause
goto :eof
:fail
echo Setup failed. Check that Node.js 20 or newer is installed.
pause
