# Mantém o servidor (e o túnel próprio) de pé. Chamado escondido pelo iniciar.vbs.
$Base = "D:\TimelineYT"
$cfg = Get-Content -LiteralPath (Join-Path $Base "config.json") -Raw | ConvertFrom-Json

$criado = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\TimelineYT-manter-ativo", [ref]$criado)
if (-not $criado) { exit }

function Test-Porta([int] $porta) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect("127.0.0.1", $porta)
    $c.Close()
    return $true
  } catch { return $false }
}

function Iniciar-Escondido([string] $arquivo, [string] $argumentos, [hashtable] $ambiente) {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $arquivo
  $info.Arguments = $argumentos
  $info.WorkingDirectory = $cfg.app
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  if ($ambiente) { foreach ($k in $ambiente.Keys) { $info.EnvironmentVariables[$k] = $ambiente[$k] } }
  [void][System.Diagnostics.Process]::Start($info)
}

while ($true) {
  if (-not (Test-Porta $cfg.porta)) {
    Iniciar-Escondido $cfg.node "server.mjs" @{ TIMELINE_DADOS = $cfg.dados; TIMELINE_PORTA = "$($cfg.porta)" }
  }
  if ($cfg.tunel) {
    $rodando = Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" |
      Where-Object { $_.CommandLine -like "*TimelineYT*" }
    if (-not $rodando) {
      $log = Join-Path $cfg.dados "logs\tunel.log"
      Iniciar-Escondido $cfg.cloudflared "tunnel --config `"$($cfg.configTunel)`" --logfile `"$log`" run timeline-yt" $null
    }
  }
  Start-Sleep -Seconds 20
}
