@echo off
REM ============================================================
REM  Oversight Safe DNS for Windows
REM  Right-click this file and choose "Run as administrator".
REM  Points every network adapter at the family-safe resolver
REM  (Cloudflare for Families 1.1.1.3 / 1.0.0.3), which blocks
REM  adult content and malware.
REM ============================================================
echo Applying Oversight Safe DNS (1.1.1.3 / 1.0.0.3)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -ExpandProperty InterfaceIndex -Unique | ForEach-Object { try { Set-DnsClientServerAddress -InterfaceIndex $_ -ServerAddresses ('1.1.1.3','1.0.0.3') -ErrorAction SilentlyContinue } catch {} }; Clear-DnsClientCache"
echo.
echo Done. This computer now uses Oversight Safe DNS.
echo To undo, set DNS back to "Obtain automatically" in Network settings.
pause
