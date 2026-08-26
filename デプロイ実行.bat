@echo off
echo ===================================================
echo Vercel Deploy Tool (Safe Version)
echo ===================================================
echo.
echo Copying files to a temporary folder (C:\mf-kintai-deploy)
echo to avoid Windows path errors...
echo.

set TEMP_DIR=C:\mf-kintai-deploy

robocopy . %TEMP_DIR% /MIR /XD node_modules .git
if %errorlevel% geq 8 (
    echo Copy failed! Please try again.
    pause
    exit /b
)

echo.
echo Moving to temp directory...
cd /d %TEMP_DIR%

echo.
echo Installing packages...
call npm install

echo.
echo Deploying to Vercel...
set NODE_OPTIONS=--dns-result-order=ipv4first
call npx vercel --prod --yes

echo.
echo ===================================================
echo Deployment Complete!
echo Please find your "Production: https://..." URL above.
echo ===================================================
pause
