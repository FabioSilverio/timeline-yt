# Timeline YT - instalação no Windows.
# Rode no PowerShell (como seu usuário, não precisa ser administrador):
#   powershell -ExecutionPolicy Bypass -File D:\TimelineYT\app\windows\instalar.ps1
# Opções: -Dominio yt.faaretz.site   -SemTunel   -Porta 3220
#          -SobrescreverDns  (aponta o domínio para este túnel mesmo se o registro já existir)
# Pode rodar de novo quantas vezes quiser: o que já está feito é mantido.
param(
  [string]$Dominio = "yt.faaretz.site",
  [int]$Porta = 3220,
  [switch]$SemTunel,
  [switch]$SobrescreverDns
)
# "Continue": o cloudflared escreve avisos comuns na saída de erro, e com "Stop" o
# PowerShell 5 trata isso como falha. Os erros de verdade são checados à mão abaixo.
$ErrorActionPreference = "Continue"

# Roda o cloudflared sempre com a config do Timeline (nunca a padrão do .cloudflared,
# que é do túnel dos outros projetos) e devolve a saída como texto + código de saída.
function Cloudflared-Timeline([string[]] $argumentos) {
  $saida = & $Cloudflared tunnel --config $ConfigTunel @argumentos 2>&1 | ForEach-Object { "$_" }
  return @{ texto = ($saida -join "`n"); codigo = $LASTEXITCODE }
}

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
    $ConfigTunel = Join-Path $PastaTunel "config.yml"
    $MarcaDns = Join-Path $PastaTunel "dns-ok.txt"
    # Config mínima só para os comandos de gestão não lerem a config padrão
    if (-not (Test-Path $ConfigTunel)) { Set-Content -LiteralPath $ConfigTunel -Value "credentials-file: $Credenciais" -Encoding ASCII }

    $tunel = (Cloudflared-Timeline @("list", "--output", "json", "--name", "timeline-yt")).texto |
      Select-String -Pattern '"id":\s*"([0-9a-f-]{36})"' | Select-Object -First 1
    $tunelId = if ($tunel) { $tunel.Matches[0].Groups[1].Value } else { $null }
    if (-not $tunelId) {
      Write-Host "Criando o túnel timeline-yt..."
      $r = Cloudflared-Timeline @("create", "--credentials-file", $Credenciais, "timeline-yt")
      Write-Host $r.texto
      $m = [regex]::Match($r.texto, "with id ([0-9a-f-]{36})")
      if ($m.Success) { $tunelId = $m.Groups[1].Value }
    }

    if (-not $tunelId) {
      Write-Warning "Não consegui criar nem achar o túnel timeline-yt. Sigo sem túnel (só acesso local)."
    } elseif (-not (Test-Path $Credenciais)) {
      Write-Warning "O túnel timeline-yt existe mas a credencial não está em $Credenciais. Apague-o com: & '$Cloudflared' tunnel delete timeline-yt   e rode este script de novo."
    } else {
      Write-Host "Túnel timeline-yt: $tunelId"
      $config = @"
tunnel: $tunelId
credentials-file: $Credenciais
ingress:
  - hostname: $Dominio
    service: http://127.0.0.1:$Porta
  - service: http_status:404
"@
      Set-Content -LiteralPath $ConfigTunel -Value $config -Encoding ASCII

      $jaFeito = (Test-Path $MarcaDns) -and ((Get-Content -LiteralPath $MarcaDns -Raw).Trim() -eq "$Dominio $tunelId")
      if ($jaFeito -and -not $SobrescreverDns) {
        Write-Host "$Dominio já aponta para o túnel timeline-yt."
      } else {
        Write-Host "Apontando $Dominio para o túnel timeline-yt..."
        $argsDns = @("route", "dns")
        if ($SobrescreverDns) { $argsDns += "--overwrite-dns" }
        $r = Cloudflared-Timeline ($argsDns + @($tunelId, $Dominio))
        Write-Host $r.texto
        if ($r.texto -match [regex]::Escape($tunelId)) {
          Set-Content -LiteralPath $MarcaDns -Value "$Dominio $tunelId" -Encoding ASCII
        } elseif ($r.texto -match "already") {
          Write-Warning "$Dominio já existe no DNS apontando para outra coisa. Se foi criado por este instalador, rode de novo com -SobrescreverDns."
        } else {
          Write-Warning "Não consegui confirmar o DNS de $Dominio (veja a mensagem acima)."
        }
      }
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
