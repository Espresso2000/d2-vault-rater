@echo off
rem Rates your Destiny 2 vault and opens the report. Keep this window open while you use the page.
cd /d "%~dp0d2-vault-rater"
if not exist node_modules (echo Installing... & call npm install || goto :fail)
if not exist dist\cli.js (call npm run build || goto :fail)
node dist\cli.js serve
if errorlevel 1 pause
goto :eof
:fail
echo Setup failed. Check that Node.js 20 or newer is installed.
pause
