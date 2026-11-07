@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo =========================================
echo       NAVEGA360 STUDIO
 echo =========================================
where py >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:8000"
  py -3 -m http.server 8000
  goto :end
)
where python >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:8000"
  python -m http.server 8000
  goto :end
)
echo Para abrir el editor sin Python, sube esta carpeta a GitHub y conecta el repositorio con Vercel.
pause
:end
