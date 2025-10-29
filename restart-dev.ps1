# restart-dev.ps1
Write-Host "Restarting development environment…" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File ".\stop-dev.ps1"
powershell -ExecutionPolicy Bypass -File ".\run-tunnel.ps1"
