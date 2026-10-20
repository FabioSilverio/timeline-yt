# Baixa a versão nova do GitHub e reinicia só o servidor do Timeline YT.
# O vigia (manter-ativo.ps1) sobe o servidor de novo em até 20 segundos. Os dados não mudam.
$App = Split-Path -Parent $PSScriptRoot
git -C $App pull --ff-only
$cfg = Get-Content -LiteralPath "D:\TimelineYT\config.json" -Raw | ConvertFrom-Json
Get-NetTCPConnection -LocalPort $cfg.porta -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Write-Host "Atualizado. O servidor volta em alguns segundos."
