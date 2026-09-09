# install-runner-service-admin.ps1 - install runner service (admin needed)
#
# Run in PowerShell AS ADMINISTRATOR:
#   powershell -File "E:\github\application\realty\realty_app\scripts\install-runner-service-admin.ps1"

$ErrorActionPreference = "Stop"
$Runner = "C:\actions-runner"

# 1. admin self-check
$cur = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object Security.Principal.WindowsPrincipal($cur)).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "[ERR] This script must run as Administrator." -ForegroundColor Red
  Write-Host "  Right-click PowerShell -> Run as administrator" -ForegroundColor Yellow
  exit 2
}
Write-Host "[OK] Running as Administrator" -ForegroundColor Green

# 2. kill residual runner processes
$procs = @("RunnerService","Runner.Listener","Runner.Worker","Runner.PluginHost")
foreach ($p in $procs) {
  Get-Process -Name $p -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# 3. remove any existing actions.runner.* service
$existing = Get-Service -Name "actions.runner.*" -ErrorAction SilentlyContinue
foreach ($s in $existing) {
  Write-Host "[cleanup] stopping/removing service: $($s.Name)" -ForegroundColor Yellow
  Stop-Service -Name $s.Name -Force -ErrorAction SilentlyContinue
  & "$Runner\bin\RunnerService.exe" uninstall | Out-Null
  sc.exe delete $s.Name | Out-Null
}
Start-Sleep -Seconds 1

# 4. install the service
Write-Host "[install] running RunnerService.exe install..." -ForegroundColor Cyan
$proc = Start-Process -FilePath "$Runner\bin\RunnerService.exe" -ArgumentList "install" -Wait -PassThru -NoNewWindow
Write-Host "[install] exit code = $($proc.ExitCode)" -ForegroundColor Cyan
Start-Sleep -Seconds 2

# 5. start the service
Write-Host "[start] running RunnerService.exe start..." -ForegroundColor Cyan
$proc2 = Start-Process -FilePath "$Runner\bin\RunnerService.exe" -ArgumentList "start" -Wait -PassThru -NoNewWindow
Write-Host "[start] exit code = $($proc2.ExitCode)" -ForegroundColor Cyan
Start-Sleep -Seconds 4

# 6. verify via Get-Service
$svc = Get-Service -Name "actions.runner.*" -ErrorAction SilentlyContinue
if ($svc) {
  foreach ($s in $svc) {
    Write-Host "[OK] Service: $($s.Name) Status: $($s.Status) StartType: $($s.StartType)" -ForegroundColor Green
  }
} else {
  Write-Host "[FAIL] Service still not installed." -ForegroundColor Red
  Write-Host "Check diag log: $Runner\_diag\" -ForegroundColor Yellow
}

# 7. verify via sc.exe
Write-Host ""
Write-Host "[verify] sc.exe query:" -ForegroundColor Cyan
& sc.exe query "actions.runner.xuefeng0324-realty.realty-runner-01" 2>&1 | Select-Object -First 8

# 8. next steps
Write-Host ""
Write-Host "Open browser: https://github.com/xuefeng0324/realty/settings/actions/runners" -ForegroundColor Cyan
Write-Host "If runner is Idle (green), trigger a build:" -ForegroundColor Cyan
Write-Host "  cd E:\github\application\realty" -ForegroundColor Gray
Write-Host "  git commit --allow-empty -m 'chore: trigger self-hosted apk'" -ForegroundColor Gray
Write-Host "  git push origin main" -ForegroundColor Gray