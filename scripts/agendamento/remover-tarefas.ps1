# Remove as rotinas automáticas do Emprego Agora do Agendador de Tarefas.
Get-ScheduledTask -TaskPath "\EmpregoAgora\" -ErrorAction SilentlyContinue | ForEach-Object {
  Unregister-ScheduledTask -TaskPath $_.TaskPath -TaskName $_.TaskName -Confirm:$false
  Write-Host "Removida: $($_.TaskPath)$($_.TaskName)"
}
