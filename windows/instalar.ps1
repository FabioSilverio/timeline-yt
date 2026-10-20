# Timeline YT - instalação no Windows.
# Rode no PowerShell (como seu usuário, não precisa ser administrador):
#   powershell -ExecutionPolicy Bypass -File D:\TimelineYT\app\windows\instalar.ps1
# Opções: -Dominio yt.faaretz.site   -SemTunel   -Porta 3220
param(
  [string]$Dominio = "yt.faaretz.site",
  [int]$Porta = 3220,
  [switch]$SemTunel
)
$ErrorActionPreference = "Stop"

if (-not (Test-Path "D:\")) { throw "Não achei o disco D:. Esta instalação guarda tudo no D:\TimelineYT." }
$Base = "D:\TimelineYT"
$App = Split-Path -Parent $PSScriptRoot
$Dados = Join-Path $Base "dados"
$PastaTunel = Join-Path $Base "cloudflared"
New-Item -ItemType Directory -Force -Path $Dados, $PastaTunel, (Join-Path $Dados "logs") | Out-Null

if (-not $App.StartsWith($Base, [StringComparison]::OrdinalIgnoreCase)) {
  Write-Warning "O código está em $App (fora do D:\TimelineYT). Funciona, mas o recomendado é deixar em D:\TimelineYT\app."
}

# Node
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node -and (Test-Path "C:\Program Files\nodejs\node.exe")) { $Node = "C:\Program Files\nodejs\node.exe" }
if (-not $Node) { throw "Node.js não encontrado. Instale o Node 20 ou mais novo (nodejs.org) e rode de novo." }
$versao = & $Node -v
Write-Host "Node $versao em $Node"

# Senha de acesso (fica em D:\TimelineYT\dados\acesso.txt)
$Acesso = Join-Path $Dados "acesso.txt"
if (-not (Test-Path $Acesso)) {
  $bytes = New-Object byte[] 9
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $senha = [Convert]::ToBase64String($bytes).Replace("+", "x").Replace("/", "y").TrimEnd("=")
  Set-Content -LiteralPath $Acesso -Value $senha -Encoding ASCII
}
$senha = (Get-Content -LiteralPath $Acesso -TotalCount 1).Trim()

# Túnel próprio da Cloudflare (separado do túnel dos outros projetos)
$Cloudflared = $null
$TunelAtivo = $false
if (-not $SemTunel) {
  $Cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
  foreach ($c in @("C:\Program Files (x86)\cloudflared\cloudflared.exe", "C:\Program Files\cloudflared\cloudflared.exe")) {
    if (-not $Cloudflared -and (Test-Path $c)) { $Cloudflared = $c }
  }
  if (-not $Cloudflared) {
    Write-Warning "cloudflared não encontrado; sigo sem túnel (só acesso local)."
  } elseif (-not (Test-Path "$env:USERPROFILE\.cloudflared\cert.pem")) {
    Write-Warning "Falta o login da Cloudflare (cert.pem). Rode: & '$Cloudflared' tunnel login   e depois este script de novo."
  } else {
    $Credenciais = Join-Path $PastaTunel "timeline-yt.json"
    $lista = & $Cloudflared tunnel list --output json | ConvertFrom-Json
    $tunel = $lista | Where-Object { $_.name -eq "timeline-yt" } | Select-Object -First 1
    if (-not $tunel) {
      Write-Host "Criando o túnel timeline-yt..."
      & $Cloudflared tunnel create --credentials-file $Credenciais timeline-yt | Out-Host
      $lista = & $Cloudflared tunnel list --output json | ConvertFrom-Json
      $tunel = $lista | Where-Object { $_.name -eq "timeline-yt" } | Select-Object -First 1
    }
    if (-not (Test-Path $Credenciais)) {
      Write-Warning "O túnel timeline-yt existe mas a credencial não está em $Credenciais. Apague-o com: & '$Cloudflared' tunnel delete timeline-yt   e rode este script de novo."
    } else {
      $config = @"
tunnel: $($tunel.id)
credentials-file: $Credenciais
ingress:
  - hostname: $Dominio
    service: http://127.0.0.1:$Porta
  - service: http_status:404
"@
      Set-Content -LiteralPath (Join-Path $PastaTunel "config.yml") -Value $config -Encoding ASCII
      Write-Host "Apontando $Dominio para o túnel..."
      & $Cloudflared tunnel route dns timeline-yt $Dominio 2>&1 | Out-Host
      $TunelAtivo = $true
    }
  }
}

# Configuração lida pelo manter-ativo.ps1
@{
  app = $App
  dados = $Dados
  node = $Node
  porta = $Porta
  cloudflared = $Cloudflared
  tunel = $TunelAtivo
  configTunel = (Join-Path $PastaTunel "config.yml")
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Base "config.json") -Encoding UTF8

# Tarefa agendada: sobe junto com o Windows, escondido
$vbs = Join-Path $PSScriptRoot "iniciar.vbs"
$acao = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$opcoes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "TimelineYT" -Action $acao -Trigger $gatilho -Settings $opcoes -Force | Out-Null
Start-ScheduledTask -TaskName "TimelineYT"

Start-Sleep -Seconds 4
Write-Host ""
Write-Host "Pronto." -ForegroundColor Green
Write-Host "  No PC:       http://127.0.0.1:$Porta"
if ($TunelAtivo) { Write-Host "  De qualquer lugar: https://$Dominio  (o DNS pode levar 1-2 min na primeira vez)" }
Write-Host "  Senha:       $senha   (guardada em $Acesso)"
Write-Host "  Dados:       $Dados"
Write-Host ""
Start-Process "http://127.0.0.1:$Porta"
