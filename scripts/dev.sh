#!/usr/bin/env bash
# 启动本地预览：./scripts/dev.sh [端口]
set -euo pipefail
cd "$(dirname "$0")/.."
export PORT="${1:-${PORT:-8787}}"

# _manifest.js 不入库，启动前从图床仓库生成一份
node scripts/gen-manifest.mjs

exec node scripts/dev.mjs
