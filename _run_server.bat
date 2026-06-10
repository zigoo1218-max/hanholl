@echo off
cd /d "%~dp0"
title Next.js Exhibition Server
node "%~dp0node_modules\next\dist\bin\next" start -p 3000
