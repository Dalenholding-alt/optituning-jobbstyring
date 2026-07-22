@echo off
setlocal
cd /d "%~dp0"
echo.
echo Optituning Jobbstyring - publisering til Cloudflare
echo.
node scripts\publish.mjs
if errorlevel 1 (
  echo.
  echo Publiseringen stoppet. Les feilmeldingen over.
) else (
  echo.
  echo Publiseringen er ferdig. Folg Access-stegene som vises over.
)
echo.
pause
