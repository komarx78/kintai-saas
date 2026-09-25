@echo off
set PATROL_HEADLESS=false
set PATROL_SLOW_MO=800
cd /d "%~dp0"
python nightly_patrol\run_patrol.py
echo.
pause
