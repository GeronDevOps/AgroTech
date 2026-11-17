@echo off
rem Permite que el telefono (misma red Wi-Fi) llegue a la API (3000) y a Metro/Expo (8081).
rem Solo desde la red local (remoteip=localsubnet). Se ejecuta una vez, como administrador.
net session >nul 2>&1
if %errorlevel% neq 0 (powershell -NoProfile -Command "Start-Process -FilePath %~f0 -Verb RunAs" & exit /b)
netsh advfirewall firewall delete rule name="AgroTech API 3000" >nul 2>&1
netsh advfirewall firewall delete rule name="AgroTech Expo 8081" >nul 2>&1
netsh advfirewall firewall add rule name="AgroTech API 3000" dir=in action=allow protocol=TCP localport=3000 remoteip=localsubnet profile=any
netsh advfirewall firewall add rule name="AgroTech Expo 8081" dir=in action=allow protocol=TCP localport=8081 remoteip=localsubnet profile=any
echo Listo: puertos 3000 y 8081 abiertos para la red local.
pause
