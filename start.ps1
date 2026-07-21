$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Starting FitNerve backend..."
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; npm run dev" -WindowStyle Normal
Write-Host "Starting FitNerve admin portal..."
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location '$root/frontend/admin-app'; npm run dev" -WindowStyle Normal
