# Executa uma rotina agendada do Emprego Agora (chamada pelo Agendador de Tarefas do Windows).
#   -Tarefa dados       importa dados oficiais novos (Novo CAGED, PNAD) e publica se aprovado na qualidade
#   -Tarefa alertas     envia alertas de vagas novas aos candidatos
#   -Tarefa manutencao  remove sessões, tokens e limites expirados
param(
  [Parameter(Mandatory = $true)][ValidateSet("dados", "alertas", "manutencao")][string]$Tarefa
)

$ErrorActionPreference = "Stop"
$Repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Repo
$LogDir = Join-Path $Repo "data-pipeline\data\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log = Join-Path $LogDir ("{0}-{1:yyyy-MM-dd}.log" -f $Tarefa, (Get-Date))

# Comandos nativos via cmd: no PowerShell 5.1, saída em stderr (ex.: progresso do docker)
# seria tratada como erro fatal. O código de saída é verificado explicitamente.
function Invoke-Native([string]$commandLine) {
  cmd /c "$commandLine >> `"$Log`" 2>&1"
  return $LASTEXITCODE
}

function Test-Docker {
  cmd /c "docker info >nul 2>&1"
  return $LASTEXITCODE -eq 0
}

function Write-Log([string]$msg) {
  "[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $msg | Out-File -FilePath $Log -Append -Encoding utf8
}

function Ensure-Database {
  if (-not (Test-Docker)) {
    $exe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path $exe)) { throw "Docker não está em execução e o Docker Desktop não foi encontrado." }
    Write-Log "Iniciando Docker Desktop..."
    Start-Process $exe
    $deadline = (Get-Date).AddMinutes(4)
    do { Start-Sleep -Seconds 5; $ok = Test-Docker } until ($ok -or (Get-Date) -gt $deadline)
    if (-not $ok) { throw "Docker não ficou disponível a tempo." }
  }
  if ((Invoke-Native "docker compose up -d postgres mailpit") -ne 0) { throw "Falha ao subir os contêineres." }
  $deadline = (Get-Date).AddMinutes(2)
  do {
    Start-Sleep -Seconds 2
    $ok = (Invoke-Native "docker compose exec -T postgres pg_isready -U emprego") -eq 0
  } until ($ok -or (Get-Date) -gt $deadline)
  if (-not $ok) { throw "PostgreSQL não respondeu." }
}

try {
  Write-Log "=== Início: $Tarefa ==="
  Ensure-Database
  $env:PYTHONIOENCODING = "utf-8"
  $code = switch ($Tarefa) {
    "dados"      { Invoke-Native "cd /d `"$Repo\data-pipeline`" && .venv\Scripts\python.exe -m emprego_pipeline atualizar --publicar" }
    "alertas"    { Invoke-Native "npm run --silent jobs:alerts" }
    "manutencao" { Invoke-Native "npm run --silent jobs:maintenance" }
  }
  Write-Log "=== Fim: $Tarefa (código $code) ==="
  exit $code
}
catch {
  Write-Log "ERRO: $($_.Exception.Message)"
  exit 1
}
