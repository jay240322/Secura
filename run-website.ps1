# Secura — Start Backend and Frontend concurrently in Windows PowerShell
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "🛡️ Starting Secura Development Environment..." -ForegroundColor Cyan

$BackendPath = Join-Path $RepoRoot "website\backend"
$FrontendPath = Join-Path $RepoRoot "website\frontend"

# Virtual environment detection
$VenvActivate = Join-Path $RepoRoot ".venv\Scripts\Activate.ps1"
$VenvCmd = if (Test-Path $VenvActivate) { ". `"$VenvActivate`"; " } else { "" }

Write-Host "🚀 Launching FastAPI Backend on http://localhost:8000..." -ForegroundColor Green
$BackendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$BackendPath`"; $VenvCmd `$env:PYTHONPATH='.;..\..\'; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" -PassThru

Start-Sleep -Seconds 2

Write-Host "🌐 Launching Next.js Frontend on http://localhost:3000..." -ForegroundColor Green
$FrontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$FrontendPath`"; npm run dev" -PassThru

Write-Host "`n✨ Both servers are running in separate terminal windows!" -ForegroundColor Cyan
Write-Host "   👉 Frontend: http://localhost:3000 (or http://127.0.0.1:3000)" -ForegroundColor White
Write-Host "   👉 Backend:  http://localhost:8000 (Docs: http://localhost:8000/docs)`n" -ForegroundColor White

