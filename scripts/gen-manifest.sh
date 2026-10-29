#!/usr/bin/env bash
# 从图床仓库拉取文件清单，生成 functions/_manifest.js（实际逻辑在 gen-manifest.mjs）
# 接口只认这一份清单：目录 -> 文件名列表（构建时打包进函数）
# 图床新增 / 删除图片并 push 后执行一次：./scripts/gen-manifest.sh
set -euo pipefail
cd "$(dirname "$0")/.."

exec node scripts/gen-manifest.mjs "$@"
