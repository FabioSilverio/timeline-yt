# Para o Timeline YT. Com -Remover, tira também a tarefa que inicia com o Windows.
# Só encerra os processos deste projeto: o vigia (manter-ativo.ps1), o servidor que
# escuta na porta do Timeline e o túnel timeline-yt. Os dados em D:\TimelineYT ficam intactos.
param([switch]$Remover)
$cfg = Get-Content -LiteralPath "D:\TimelineYT\config.json" -Raw | ConvertFrom-Json

Stop-ScheduledTask -TaskName "TimelineYT" -ErrorAction SilentlyContinue

Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
  Where-Object { $_.CommandLine -like "*TimelineYT*manter-ativo.ps1*" -or $_.CommandLine -like "*timeline-yt*manter-ativo.ps1*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Get-NetTCPConnection -LocalPort $cfg.porta -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" |
  Where-Object { $_.CommandLine -like "*TimelineYT*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

if ($Remover) { Unregister-ScheduledTask -TaskName "TimelineYT" -Confirm:$false -ErrorAction SilentlyContinue }
Write-Host "Timeline YT parado."
