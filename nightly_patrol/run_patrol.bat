@echo off
cd /d "%~dp0.."
python nightly_patrol\run_patrol.py
echo.
pause
