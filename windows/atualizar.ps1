# Baixa a versão nova do GitHub e reinicia só o servidor do Timeline YT.
# Depois desta versão, o servidor também se atualiza sozinho a cada 15 minutos.
$App = Split-Path -Parent $PSScriptRoot
$cfg = Get-Content -LiteralPath "D:\TimelineYT\config.json" -Raw | ConvertFrom-Json

git -C $App pull --ff-only
git -C $App log -1 --format="Versão: %h (%ci) %s"

Get-NetTCPConnection -LocalPort $cfg.porta -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

# Garante que o vigia está rodando (ele sobe o servidor de novo em até 20 s)
Start-ScheduledTask -TaskName "TimelineYT" -ErrorAction SilentlyContinue

function Test-Porta([int] $porta) {
  try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect("127.0.0.1", $porta); $c.Close(); return $true } catch { return $false }
}
Write-Host "Esperando o servidor voltar..."
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  if (Test-Porta $cfg.porta) { Write-Host "Pronto: servidor no ar com a versão nova." -ForegroundColor Green; exit }
}
Write-Warning "O servidor não voltou em 60 s. Veja D:\TimelineYT\dados\logs\servidor.log"
