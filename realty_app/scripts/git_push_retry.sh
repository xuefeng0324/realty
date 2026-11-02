#!/usr/bin/env bash
# git_push_retry.sh — 自动提交工作流共用：远端被别的 bot 抢先 push 时先 rebase 再重试。
#
# 背景：crawl-weekly 的 P0 提交在 crawl 运行期间，OTA / 日更 / 月更 / 人工 push
# 都可能推进 main，裸 `git push` 直接非快进失败 → 整条流水线红。
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

for i in 1 2 3 4; do
  if git pull --rebase --autostash "$REMOTE" "$BRANCH"; then
    if push_once; then
      echo "[push] OK (attempt $i)"
      exit 0
    fi
    echo "[push] attempt $i rejected（远端又前进了），重试..."
  else
    echo "[push] attempt $i rebase 失败，放弃本次 rebase"
    git rebase --abort 2>/dev/null || true
  fi
  sleep $((i * 8))
done

echo "[push] ERROR: 连续 4 次 pull --rebase + push 仍失败" >&2
exit 1
