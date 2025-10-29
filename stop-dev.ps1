# stop-dev.ps1
$ErrorActionPreference = "SilentlyContinue"

Write-Host "Stopping cloudflared…" -ForegroundColor Yellow
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Stopping Node/Expo…" -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Stopped ✅" -ForegroundColor Green
