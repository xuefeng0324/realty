# commit.ps1 — 参数化 git plumbing commit + push
#
# 背景：本机 git 2.24 较老，不支持 `--trailer`，且 Cursor agent 的内置 git
#       会自动注入 --trailer 导致 commit 失败。用 git plumbing（write-tree
#       + commit-tree）绕过。
#
# 用法：
#   powershell -File scripts/commit.ps1 -MessageFile .git_commit_msg.txt
#   powershell -File scripts/commit.ps1 -Message "docs: foo" -Add "realty_app/README.md" -Push
#
#   -Message     commit message（短消息）
#   -MessageFile 从文件读 commit message（推荐，长消息用这个）
#   -Add         要 add 的文件路径（可多次，可省略 — 只 commit 已 staged 的）
#   -Push        commit 后立即 push 到 origin/<current-branch>
#   -Branch      push 目标分支，默认当前分支
#   -DryRun      只打印要做的步骤，不实际执行
#
# 工作流：
#   1. 对每个 -Add 路径执行 git add
#   2. git write-tree（基于当前 index）
#   3. git commit-tree <tree> -p HEAD -F <msg>
#   4. git reset --soft <new-commit>（保留 staged 状态以便后续 commit）
#   5. （可选）git push origin HEAD:<branch>

param(
  [string]$Message = "",
  [string]$MessageFile = "",
  [string[]]$Add = @(),
  [switch]$Push = $false,
  [string]$Branch = "",
  [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")
$repoRoot = git rev-parse --show-toplevel
Set-Location $repoRoot
Write-Host "[commit.ps1] repo: $repoRoot" -ForegroundColor Cyan

# 解析 message
if ($MessageFile) {
  if (-not (Test-Path $MessageFile)) {
    throw "MessageFile not found: $MessageFile"
  }
  $msgFile = (Resolve-Path $MessageFile).Path
} elseif ($Message) {
  $msgFile = Join-Path $env:TEMP "commit_msg_$PID.txt"
  Set-Content -Path $msgFile -Value $Message -NoNewline -Encoding utf8
} else {
  throw "Either -Message or -MessageFile is required"
}

Write-Host "[commit.ps1] message: $msgFile" -ForegroundColor Cyan
Write-Host "[commit.ps1] message preview:"
Get-Content $msgFile -TotalCount 5 | ForEach-Object { Write-Host "  | $_" -ForegroundColor Gray }

# git add
# 兼容两种传法：-Add a,b,c （单字符串逗号分隔）或 -Add 'a','b','c'（数组）
$addPaths = @()
if ($Add.Count -eq 1 -and $Add[0] -like '*,*') {
  $addPaths = $Add[0] -split ','
} else {
  $addPaths = $Add
}
foreach ($path in $addPaths) {
  $path = $path.Trim()
  if ($path.Length -eq 0) { continue }
  if (-not (Test-Path $path)) {
    throw "Path not found: $path"
  }
  Write-Host "[commit.ps1] add: $path" -ForegroundColor Cyan
  if (-not $DryRun) {
    git add -- $path
    if ($LASTEXITCODE -ne 0) { throw "git add failed: $path" }
  }
}

if ($DryRun) {
  Write-Host "[commit.ps1] DRY-RUN: would write-tree + commit-tree + reset --soft" -ForegroundColor Yellow
  exit 0
}

# write-tree
$tree = git write-tree
if ($LASTEXITCODE -ne 0) { throw "write-tree failed" }
Write-Host "[commit.ps1] tree: $tree" -ForegroundColor Cyan

# parent = HEAD
$parent = git rev-parse HEAD
Write-Host "[commit.ps1] parent: $parent" -ForegroundColor Cyan

# commit-tree
$env:GIT_AUTHOR_NAME = git config user.name
$env:GIT_AUTHOR_EMAIL = git config user.email
$env:GIT_COMMITTER_NAME = $env:GIT_AUTHOR_NAME
$env:GIT_COMMITTER_EMAIL = $env:GIT_AUTHOR_EMAIL
if (-not $env:GIT_AUTHOR_NAME) {
  throw "git user.name not set; run: git config user.name <name>"
}

$commit = git commit-tree $tree -p $parent -F $msgFile
if ($LASTEXITCODE -ne 0) { throw "commit-tree failed" }
Write-Host "[commit.ps1] commit: $commit" -ForegroundColor Green

# reset --soft
git reset --soft $commit | Out-Null
Write-Host "[commit.ps1] HEAD moved to $commit" -ForegroundColor Green

# push
if ($Push) {
  if (-not $Branch) {
    $Branch = git rev-parse --abbrev-ref HEAD
  }
  Write-Host "[commit.ps1] push to origin/$Branch" -ForegroundColor Cyan
  git push origin $Branch
  if ($LASTEXITCODE -ne 0) { throw "git push failed" }
  Write-Host "[commit.ps1] pushed" -ForegroundColor Green
}

# cleanup tmp message file
if (-not $Message) {
  Remove-Item -Path $msgFile -ErrorAction SilentlyContinue
}

Write-Host "[commit.ps1] done" -ForegroundColor Green