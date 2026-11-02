#!/usr/bin/env bash
# git_push_retry.sh — 自动提交工作流共用：远端被别的 bot 抢先 push 时先 rebase 再重试。
#
# 背景：crawl-weekly 的 P0 提交在 crawl 运行期间，OTA / 日更 / 月更 / 人工 push
# 都可能推进 main，裸 `git push` 直接非快进失败 → 整条流水线红。
#
# 另外，两个周更 run 同时排队时会把同一批自动产物（static/seed/*.csv、
# crawl_meta.json）各写一遍，rebase 必然在这几行上冲突。这些文件是爬虫刚生成的
# 最新数据，不应被上游旧版本覆盖，所以冲突时统一保留本次生成的版本。
#
# 用法（在 git 仓库任意子目录）：
#   bash scripts/git_push_retry.sh                 # origin main，默认 remote
#   bash scripts/git_push_retry.sh origin main
#   bash scripts/git_push_retry.sh origin main "https://x-access-token:${TOKEN}@github.com/o/r.git"
# 第 3 个参数用于 build-app-wgt 的显式 token URL 推送。
set -uo pipefail

REMOTE="${1:-origin}"
BRANCH="${2:-main}"
PUSH_URL="${3:-}"

push_once() {
  if [ -n "$PUSH_URL" ]; then
    git push "$PUSH_URL" "HEAD:$BRANCH"
  else
    git push "$REMOTE" "HEAD:$BRANCH"
  fi
}

# 自动产物冲突：保留正在应用的本地提交（REBASE_HEAD）里的版本，然后继续 rebase。
# 只处理「内容冲突」；删除/重命名等其它冲突一律放弃，交回上层 abort。
resolve_conflicts_keep_local() {
  local conflicts file
  conflicts=$(git diff --name-only --diff-filter=U)
  [ -n "$conflicts" ] || return 1
  for file in $conflicts; do
    if git checkout REBASE_HEAD -- "$file" 2>/dev/null; then
      git add -- "$file" || return 1
    else
      return 1
    fi
  done
  GIT_EDITOR=true git rebase --continue || return 1
}

for i in 1 2 3 4; do
  if git pull --rebase --autostash "$REMOTE" "$BRANCH"; then
    if push_once; then
      echo "[push] OK (attempt $i)"
      exit 0
    fi
    echo "[push] attempt $i rejected（远端又前进了），重试..."
  elif [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
    echo "[push] attempt $i rebase 冲突，尝试保留本地新生成的数据后继续..."
    if resolve_conflicts_keep_local; then
      if push_once; then
        echo "[push] OK (attempt $i, 冲突已按本地数据解决)"
        exit 0
      fi
      echo "[push] attempt $i 解决冲突后 push 仍被拒，重试..."
    else
      echo "[push] attempt $i 冲突自动解决失败，放弃本次 rebase"
      git rebase --abort 2>/dev/null || true
    fi
  else
    echo "[push] attempt $i rebase 失败，放弃本次 rebase"
  fi
  sleep $((i * 8))
done

echo "[push] ERROR: 连续 4 次 pull --rebase + push 仍失败" >&2
exit 1
