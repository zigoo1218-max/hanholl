@echo off
rem Housing notice monitor - run once (Windows Task Scheduler entry point)
chcp 65001 > nul
set PYTHONUTF8=1
cd /d "%~dp0"
if not exist data mkdir data
if not exist .venv\Scripts\python.exe (
  python -m venv .venv
  .venv\Scripts\python.exe -m pip install -r requirements.txt
)
.venv\Scripts\python.exe monitor.py %* >> data\monitor.log 2>&1
