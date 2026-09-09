# install-self-hosted-runner.ps1 — 一步到位：注册 runner + 装成 Windows 服务
#
# 用法（PowerShell 管理员）：
#   1. 浏览器开 https://github.com/xuefeng0324/realty/settings/actions/runners/new
#      选 Windows x64，复制 token（带前缀 "Axxxx..."）
#   2. powershell -File realty_app/scripts/install-self-hosted-runner.ps1 -Token "Axxxx..."
#
# 也可交互模式（不带 -Token 跑，会停下来问）：
#   powershell -File realty_app/scripts/install-self-hosted-runner.ps1

param(
  [string]$Token = "",
  [string]$RunnerName = "realty-runner-01",
  [string[]]$Labels = @("self-hosted", "windows", "x64", "realty-app"),
  [switch]$Uninstall = $false,
  [switch]$StartService = $true
)

$ErrorActionPreference = "Stop"
$RunnerDir = "C:\actions-runner"

if (-not (Test-Path "$RunnerDir\config.cmd")) {
  throw "未找到 $RunnerDir\config.cmd，请先跑完 Android SDK + Runner 下载步骤"
}

# uninstall 路径
if ($Uninstall) {
  Write-Host "[runner] 停止并卸载服务..." -ForegroundColor Yellow
  & "$RunnerDir\bin\RunnerService.exe" stop 2>$null
  & "$RunnerDir\bin\RunnerService.exe" uninstall 2>$null
  & "$RunnerDir\config.cmd" remove --unattended --token "dummy" 2>$null
  Write-Host "[runner] 完成卸载" -ForegroundColor Green
  exit 0
}

# install 路径
if (-not $Token) {
  Write-Host ""
  Write-Host "================================================" -ForegroundColor Cyan
  Write-Host "  需要 GitHub 注册 token" -ForegroundColor Cyan
  Write-Host "================================================" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "1. 浏览器打开：https://github.com/xuefeng0324/realty/settings/actions/runners/new"
  Write-Host "2. 选 Windows / x64"
  Write-Host "3. 复制 token（形如 'A4XKPVDI5OBQ...）"
  Write-Host ""
  $Token = Read-Host "请粘贴 token"
}

if (-not $Token) {
  throw "token 为空"
}

Write-Host "[runner] 配置 runner..." -ForegroundColor Cyan
$labelArg = ($Labels -join ",")
$args = @(
  "--unattended",
  "--url", "https://github.com/xuefeng0324/realty",
  "--token", $Token,
  "--name", $RunnerName,
  "--labels", $labelArg,
  "--replace"
)
& "$RunnerDir\config.cmd" @args
if ($LASTEXITCODE -ne 0) {
  throw "config.cmd 失败（exit $LASTEXITCODE）。检查 token 是否过期。"
}

Write-Host "[runner] 配置成功" -ForegroundColor Green

if ($StartService) {
  Write-Host "[runner] 装成 Windows 服务..." -ForegroundColor Cyan
  & "$RunnerDir\bin\RunnerService.exe" install
  & "$RunnerDir\bin\RunnerService.exe" start
  Start-Sleep -Seconds 3
  $svc = Get-Service -Name "actions.runner.*" -ErrorAction SilentlyContinue
  if ($svc) {
    Write-Host "[runner] 服务状态: $($svc.Status) ($($svc.Name))" -ForegroundColor Green
  } else {
    Write-Host "[runner] 警告：未找到 runner 服务，请检查任务管理器" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  ✅ Self-hosted runner 已就位！" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "现在可以触发一次构建验证："
Write-Host "  cd E:\github\application\realty"
Write-Host "  git commit --allow-empty -m 'chore: trigger apk-self-hosted'"
Write-Host "  git push origin main"
Write-Host ""
Write-Host "查看 job：https://github.com/xuefeng0324/realty/actions"