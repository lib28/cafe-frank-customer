# run-tunnel.ps1 — Windows PowerShell 5.1 compatible
$ErrorActionPreference = 'Stop'

# --- Config ---
$RootDir     = $PSScriptRoot
$BackendDir  = Join-Path $RootDir 'backend'
$BackendCmd  = 'npm run start'
$HealthPath  = '/health'
$EnvFile     = Join-Path $RootDir '.env'
$EnvKey      = 'EXPO_PUBLIC_API_BASE_URL'
$Cloudflared = Join-Path $env:USERPROFILE 'cloudflared.exe'   # e.g. C:\Users\<you>\cloudflared.exe
$TunnelArgs  = @('tunnel','--url','http://localhost:3000','--protocol','quic','--edge-ip-version','auto')

# --- Helpers ---
function Write-Info($msg){ Write-Host $msg -ForegroundColor Cyan }
function Write-Ok($msg){ Write-Host $msg -ForegroundColor Green }
function Write-Err($msg){ Write-Host $msg -ForegroundColor Red }

function Wait-Http200([string]$Url, [int]$TimeoutSec = 60){
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  do {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 8
      if ($r.StatusCode -eq 200) { return $true }
    } catch { }
    Start-Sleep -Milliseconds 700
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Ensure-Backend(){
  if (-not (Test-Path $BackendDir)) { throw "Backend folder not found: $BackendDir" }

  Write-Info "Starting backend ($BackendDir)…"
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.WorkingDirectory = $BackendDir
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/c $BackendCmd"
  $psi.UseShellExecute = $true
  [System.Diagnostics.Process]::Start($psi) | Out-Null

  $healthLocal = "http://localhost:3000$HealthPath"
  Write-Info "Waiting for backend on $healthLocal …"
  if (-not (Wait-Http200 $healthLocal 60)) {
    throw "Backend didn't become healthy at $healthLocal"
  }
  Write-Ok "Backend is up."
}

function Ensure-Cloudflared(){
  if (-not (Test-Path $Cloudflared)) {
    throw "cloudflared not found at $Cloudflared. Download it from https://github.com/cloudflare/cloudflared/releases"
  }
}

function Start-TunnelAndGetUrl([int]$TimeoutSec = 60){
  Write-Info "Starting Cloudflare tunnel…"
  $outLog = Join-Path $RootDir 'tunnel.out.log'
  $errLog = Join-Path $RootDir 'tunnel.err.log'
  Remove-Item -Force -ErrorAction SilentlyContinue $outLog, $errLog | Out-Null

  $proc = Start-Process -FilePath $Cloudflared -ArgumentList $TunnelArgs `
                        -PassThru -NoNewWindow `
                        -RedirectStandardOutput $outLog `
                        -RedirectStandardError  $errLog

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $url = $null
  $pattern = 'https://[a-z0-9-]+\.trycloudflare\.com'

  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500

    $txtOut = ''
    if (Test-Path $outLog) {
      try { $txtOut = Get-Content $outLog -Raw -ErrorAction SilentlyContinue } catch {}
    }
    $txtErr = ''
    if (Test-Path $errLog) {
      try { $txtErr = Get-Content $errLog -Raw -ErrorAction SilentlyContinue } catch {}
    }
    $txt = ($txtOut + "`n" + $txtErr)

    if ($txt -match $pattern) {
      $url = $Matches[0]
      break
    }
  }

  if (-not $url) {
    throw "Tunnel URL not found"
  }

  Write-Ok "Tunnel URL: $url"
  return $url
}

function Update-EnvValue([string]$File, [string]$Key, [string]$Value){
  if (-not (Test-Path $File)) { Set-Content -Path $File -Value "" -Encoding UTF8 }
  $lines = @()
  try { $lines = Get-Content -Path $File -ErrorAction SilentlyContinue } catch {}
  $found = $false
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($ln in $lines) {
    if ($ln -match ("^\s*" + [regex]::Escape($Key) + "=")) {
      $out.Add("$Key=$Value")
      $found = $true
    } else {
      $out.Add($ln)
    }
  }
  if (-not $found) { $out.Add("$Key=$Value") }
  Set-Content -Path $File -Value ($out -join [Environment]::NewLine) -Encoding UTF8
  Write-Ok "Updated $Key in $File"
}

# --- Main ---
Ensure-Backend
Ensure-Cloudflared
$tunnelUrl = Start-TunnelAndGetUrl -TimeoutSec 90

Update-EnvValue -File $EnvFile -Key $EnvKey -Value $tunnelUrl

$healthPublic = "$tunnelUrl$HealthPath"
Write-Info "Waiting for tunnel health at $healthPublic …"
if (Wait-Http200 $healthPublic 60) {
  Write-Ok "Tunnel healthy."
} else {
  Write-Warning "Tunnel /health did not respond 200 within timeout (continuing)."
}

Write-Ok "All set. Expo will read $EnvKey from .env = $tunnelUrl"
