# reconfig-runner-as-service.ps1 - re-register runner WITH --runasservice
# MUST run as Administrator.
#
# Why previous install failed (see screenshot):
#   RunnerService.exe start WITHOUT install -> Windows dialog:
#   "无法从命令行或调试程序启动服务。必须首先安装 Windows 服务..."
# Fix: config.cmd --runasservice  (registers Windows service properly)

param(
  [Parameter(Mandatory=$true)][string]$Token
)

$ErrorActionPreference = "Stop"
$Runner = "C:\actions-runner"

$cur = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object Security.Principal.WindowsPrincipal($cur)).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "[ERR] Run PowerShell as Administrator" -ForegroundColor Red
  exit 2
}

Set-Location $Runner

# remove old config
if (Test-Path "$Runner\.runner") {
  Write-Host "[cleanup] config.cmd remove ..." -ForegroundColor Yellow
  & "$Runner\config.cmd" remove --unattended --token $Token 2>$null
}

Write-Host "[config] register with --runasservice ..." -ForegroundColor Cyan
& "$Runner\config.cmd" `
  --unattended `
  --url "https://github.com/xuefeng0324/realty" `
  --token $Token `
  --name "realty-runner-01" `
  --labels "self-hosted,Windows,X64,realty-app" `
  --runasservice `
  --replace

if ($LASTEXITCODE -ne 0) { throw "config.cmd failed exit=$LASTEXITCODE" }

Start-Sleep -Seconds 3
$svc = Get-Service -Name "actions.runner.*" -ErrorAction SilentlyContinue
if ($svc) {
  foreach ($s in $svc) {
    Write-Host "[OK] $($s.Name) = $($s.Status)" -ForegroundColor Green
  }
} else {
  Write-Host "[FAIL] service still missing. Check $Runner\_diag\" -ForegroundColor Red
  exit 1
}

Write-Host "Open: https://github.com/xuefeng0324/realty/settings/actions/runners" -ForegroundColor Cyan
