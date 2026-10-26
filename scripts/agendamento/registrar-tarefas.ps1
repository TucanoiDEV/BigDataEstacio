# Registra as rotinas automáticas no Agendador de Tarefas do Windows (usuário atual, sem senha armazenada).
# Uso: powershell -ExecutionPolicy Bypass -File scripts\agendamento\registrar-tarefas.ps1
# Remover: powershell -ExecutionPolicy Bypass -File scripts\agendamento\remover-tarefas.ps1
$ErrorActionPreference = "Stop"
$Script = Join-Path $PSScriptRoot "rotina.ps1"
$Pasta = "\EmpregoAgora\"
$Usuario = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

# StartWhenAvailable: se o computador estiver desligado no horário, executa assim que possível.
$Config = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
$Principal = New-ScheduledTaskPrincipal -UserId $Usuario -LogonType Interactive -RunLevel Limited

function Acao([string]$tarefa) {
  New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Script`" -Tarefa $tarefa"
}

$tarefas = @(
  @{ Nome = "Dados oficiais (diario)"; Tarefa = "dados";
     Gatilho = New-ScheduledTaskTrigger -Daily -At "06:00";
     Descricao = "Verifica novas competências do Novo CAGED e trimestres da PNAD; importa e publica se aprovado na qualidade." },
  @{ Nome = "Alertas de vagas (a cada hora)"; Tarefa = "alertas";
     Gatilho = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddHours((Get-Date).Hour + 1) -RepetitionInterval (New-TimeSpan -Hours 1);
     Descricao = "Envia aos candidatos as vagas novas que combinam com seus alertas (respeita a frequência de cada alerta)." },
  @{ Nome = "Vagas externas (diario)"; Tarefa = "externas";
     Gatilho = New-ScheduledTaskTrigger -Daily -At "07:00";
     Descricao = "Importa vagas de outros sites (Adzuna, quadros do Greenhouse) e desativa as que saíram do ar." },
  @{ Nome = "Manutencao (diario)"; Tarefa = "manutencao";
     Gatilho = New-ScheduledTaskTrigger -Daily -At "03:30";
     Descricao = "Remove sessões, tokens e limites de requisição expirados." }
)

foreach ($t in $tarefas) {
  Register-ScheduledTask -TaskPath $Pasta -TaskName $t.Nome -Action (Acao $t.Tarefa) -Trigger $t.Gatilho `
    -Settings $Config -Principal $Principal -Description $t.Descricao -Force | Out-Null
  Write-Host "Registrada: $Pasta$($t.Nome)"
}
Write-Host "Logs em data-pipeline\data\logs\. Requer o Docker Desktop instalado; as tarefas rodam com o usuário conectado."
