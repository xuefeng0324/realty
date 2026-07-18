# check.ps1 — 一键跑 type-check + unit test + E2E smoke
#
# 用法：
#   powershell -File scripts/check.ps1
#   powershell -File scripts/check.ps1 -SkipSmoke       # 跳过 E2E（dev server 未起时）
#   powershell -File scripts/check.ps1 -SmokeUrl "http://127.0.0.1:9001/"
#
# 输出结构：
#   [CHECK] type-check ... PASS/FAIL (X errors)
#   [CHECK] unit test ... PASS/FAIL (X/Y tests, Z files)
#   [CHECK] E2E smoke .... PASS/FAIL (interactive=N, errors=N)
#   [EXIT ] 0 if all pass; 1 otherwise
#
# 设计原则：
#   - 每步独立 try/catch，单步失败不阻塞后续
#   - 退出码反映是否全部通过，方便 CI 调用
#   - 复用现有 npm script，不引入新依赖

param(
  [switch]$SkipSmoke = $false,
  [string]$SmokeUrl = "http://127.0.0.1:9001/",
  [int]$DevServerStartupWaitSec = 20
)

$ErrorActionPreference = "Continue"
$exitCode = 0

Set-Location (Join-Path $PSScriptRoot "..")
Write-Host "[realty_app] working dir: $(Get-Location)" -ForegroundColor Cyan

# 0. 环境预检：避免缺 Node 时后面的 npm 报一堆看不懂的错
Write-Host ""
Write-Host "[CHECK] pre-check (node/npm) ..." -ForegroundColor Cyan
$nodeMissing = $false
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "  FAIL: 未找到 node" -ForegroundColor Red
  Write-Host "    安装指引：winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
  Write-Host "    或从 https://nodejs.org/ 下载 LTS 版" -ForegroundColor Yellow
  $nodeMissing = $true
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "  FAIL: 未找到 npm" -ForegroundColor Red
  Write-Host "    npm 通常随 Node 一起安装；如确认 Node 已装但 npm 缺失，重装 Node 即可" -ForegroundColor Yellow
  $nodeMissing = $true
}
if (-not $nodeMissing) {
  $nodeVer = (& node -v).Trim()
  $npmVer = (& npm -v).Trim()
  Write-Host "  PASS (node=$nodeVer, npm=$npmVer)" -ForegroundColor Green
} else {
  exit 1
}

# 1. type-check
Write-Host ""
Write-Host "[CHECK] type-check ..." -ForegroundColor Cyan
$tcLog = New-TemporaryFile
try {
  & npm run type-check 2>&1 | Tee-Object -FilePath $tcLog.FullName | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  PASS" -ForegroundColor Green
  } else {
    Write-Host "  FAIL (exit=$LASTEXITCODE)" -ForegroundColor Red
    $exitCode = 1
  }
} catch {
  Write-Host "  FAIL (exception): $_" -ForegroundColor Red
  $exitCode = 1
}

# 2. unit test
Write-Host ""
Write-Host "[CHECK] unit test ..." -ForegroundColor Cyan
$testLog = New-TemporaryFile
try {
  & npm test -- --run 2>&1 | Tee-Object -FilePath $testLog.FullName | Out-Null
  if ($LASTEXITCODE -eq 0) {
    # 从输出末尾抓 "Tests  N passed"
    $passLine = Select-String -Path $testLog.FullName -Pattern "Tests\s+(\d+)\s+passed" | Select-Object -Last 1
    if ($passLine) {
      Write-Host "  PASS ($($passLine.Matches[0].Groups[1].Value) tests)" -ForegroundColor Green
    } else {
      Write-Host "  PASS" -ForegroundColor Green
    }
  } else {
    Write-Host "  FAIL (exit=$LASTEXITCODE)" -ForegroundColor Red
    $exitCode = 1
  }
} catch {
  Write-Host "  FAIL (exception): $_" -ForegroundColor Red
  $exitCode = 1
}

# 3. E2E smoke (optional)
if (-not $SkipSmoke) {
  Write-Host ""
  Write-Host "[CHECK] E2E smoke ($SmokeUrl) ..." -ForegroundColor Cyan
  $smokeLog = New-TemporaryFile
  try {
    $env:E2E_URL = $SmokeUrl
    & node tests/e2e/smoke.mjs 2>&1 | Tee-Object -FilePath $smokeLog.FullName | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $jsonPath = Join-Path (Get-Location) "tests/e2e/artifacts/smoke.json"
      if (Test-Path $jsonPath) {
        $smoke = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Write-Host "  PASS (interactive=$($smoke.interactiveCount), elements=$($smoke.elementCount), errors=$($smoke.consoleErrors.Count + $smoke.pageErrors.Count))" -ForegroundColor Green
      } else {
        Write-Host "  PASS" -ForegroundColor Green
      }
    } else {
      Write-Host "  FAIL (exit=$LASTEXITCODE)" -ForegroundColor Red
      $exitCode = 1
    }
  } catch {
    Write-Host "  FAIL (exception): $_" -ForegroundColor Red
    $exitCode = 1
  }
} else {
  Write-Host ""
  Write-Host "[CHECK] E2E smoke ... SKIPPED (-SkipSmoke)" -ForegroundColor Yellow
}

Write-Host ""
if ($exitCode -eq 0) {
  Write-Host "[EXIT ] 0" -ForegroundColor Green
} else {
  Write-Host "[EXIT ] $exitCode" -ForegroundColor Red
}
exit $exitCode
