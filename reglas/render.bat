@echo off
rem Vuelve a generar Reglas.png (fondo transparente) a partir de reglas.html. Edita el texto ahí y ejecuta esto.
cd /d "%~dp0"
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 --force-device-scale-factor=2 --virtual-time-budget=4000 --window-size=1160,820 --screenshot="%~dp0..\Reglas.png" "file:///%~dp0reglas.html"
