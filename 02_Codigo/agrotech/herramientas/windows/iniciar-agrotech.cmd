@echo off
rem Abre la API y la app de AgroTech en dos ventanas (desarrollo).
setlocal
set RAIZ=%~dp0..\..

if not exist "%RAIZ%\api\node_modules" (echo Instalando dependencias de la API... & pushd "%RAIZ%\api" & call npm install & popd)
if not exist "%RAIZ%\app\node_modules" (echo Instalando dependencias de la app... & pushd "%RAIZ%\app" & call npm install & popd)
if not exist "%RAIZ%\api\.env" (echo Falta api\.env: copie api\.env.example y ajuste DATABASE_URL y JWT_SECRETO. & pause & exit /b 1)
if not exist "%RAIZ%\app\.env" copy "%RAIZ%\app\.env.example" "%RAIZ%\app\.env" >nul

start "AgroTech API" /D "%RAIZ%\api" cmd /k npm run dev
timeout /t 3 >nul
start "AgroTech App" /D "%RAIZ%\app" cmd /k npx expo start --clear
echo.
echo API: ventana "AgroTech API" (muestra la IP para el telefono).
echo App: ventana "AgroTech App" (escanee el QR con Expo Go o pulse w para la vista web).
endlocal
