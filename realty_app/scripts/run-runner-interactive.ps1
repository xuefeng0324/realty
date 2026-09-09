# run-runner-interactive.ps1 — 不用管理员跑 runner（交互模式）
#
# 用法（PowerShell 普通）：
#   powershell -File realty_app/scripts/run-runner-interactive.ps1
#
# 说明：runner 有两种模式
#   1. install 成 Windows 服务（需管理员）→ 见 install-runner-service-admin.ps1
#   2. 直接 .\run.cmd 交互模式（本脚本） → 不要管理员
#
# 模式 2 缺点：本窗口关闭后 runner 停。要长期跑用模式 1。

$Runner = "C:\actions-runner"
if (-not (Test-Path "$Runner\.runner\runner.cfg")) {
  throw "$Runner\.runner\runner.cfg 不存在，请先跑 config.cmd --url ... --token ..."
}

Write-Host "[run-runner] CWD=$Runner" -ForegroundColor Cyan
Set-Location $Runner
& "$Runner\run.cmd"