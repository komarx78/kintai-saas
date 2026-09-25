@echo off
set PATROL_HEADLESS=true
set PATROL_SLOW_MO=0
cd /d "%~dp0"
python nightly_patrol\run_patrol.py
echo.
pause
