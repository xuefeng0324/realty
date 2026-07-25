# build_apk.ps1 —— 本地一键编译 wgt 并打印 APK 出包提示
# ---------------------------------------------------------------------------
# 设计原则：
#   * OTA（WGT）是日常 100% 自动的（CI 直接走 scripts/commit.wgt），本地不需要它。
#   * APK（整包安装包）必须在 HBuilderX UI 里手动点，云端打包是登录后受保护动作。
#     因此本地脚本只负责"把 dist/build/app 准备好 + 把产物大小 / 路径告诉你"，
#     然后给一段最少步骤的 HBuilderX 提示；
#     真去点云端打包，仍由你点一下按钮（防止脚本误登账号）。
#
# 用法：
#   powershell -File realty_app/scripts/build_apk.ps1
#   powershell -File realty_app/scripts/build_apk.ps1 -OutDir "$env:USERPROFILE\Downloads"
#
# 依赖：Node.js 18+。
# ---------------------------------------------------------------------------
[CmdletBinding()]
param(
  [string]$OutDir = (Join-Path (Get-Location) "dist\build\app"),
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptRoot "..")
Push-Location $RepoRoot
try {
  Write-Host "[realty_app] 仓库根：$RepoRoot" -ForegroundColor Cyan

  if (-not $SkipTests) {
    Write-Host "`n[1/3] 跑单测 (type-check + test)..." -ForegroundColor Cyan
    npm run type-check
    if ($LASTEXITCODE -ne 0) { throw "type-check 失败，停止出包" }
    npm test -- --run
    if ($LASTEXITCODE -ne 0) { throw "单测失败，停止出包" }
  } else {
    Write-Host "[1/3] 跳过 type-check / test（-SkipTests）" -ForegroundColor DarkYellow
  }

  Write-Host "`n[2/3] 编译 wgt (npm run build:app)..." -ForegroundColor Cyan
  if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
  }
  npm run build:app
  if ($LASTEXITCODE -ne 0) { throw "build:app 失败" }

  if (-not (Test-Path $OutDir)) {
    throw "找不到产物目录：$OutDir（build 路径可能变了，请检查 dist 目录）"
  }

  Write-Host "`n[3/3] 校验产物..." -ForegroundColor Cyan
  $size = (Get-ChildItem -Recurse -File $OutDir | Measure-Object -Property Length -Sum).Sum
  $fileCount = (Get-ChildItem -Recurse -File $OutDir).Count
  $sizeMB = [Math]::Round($size / 1MB, 2)
  Write-Host ("  文件数：{0}" -f $fileCount)
  Write-Host ("  体积  ：{0} MB" -f $sizeMB)
  Write-Host ("  位置  ：{0}" -f $OutDir)

  Write-Host "`n[完成] WGT 已编译；按下方步骤到 HBuilderX 5–10 分钟出 APK：" -ForegroundColor Green
  Write-Host "  1. 用 HBuilderX 打开仓库 realty_app 目录" -ForegroundColor Yellow
  Write-Host "  2. 菜单 发行 → 原生 App-云打包" -ForegroundColor Yellow
  Write-Host "  3. Android · 公共测试证书（首次） / 自有 keystore" -ForegroundColor Yellow
  Write-Host "  4. 提交后到 HBuilderX 控制台下载 APK" -ForegroundColor Yellow
  Write-Host "`n如果想完全自动化，请改用 docs/BUILD_APK.md 方案 A（GitHub Actions + DCLOUD_* Secrets）。"
}
finally {
  Pop-Location
}
