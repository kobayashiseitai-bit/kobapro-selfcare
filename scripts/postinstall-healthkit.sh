#!/usr/bin/env bash
# postinstall: @perfood/capacitor-healthkit に SPM 用 Package.swift を復元する
# npm install で node_modules が再生成されると Package.swift が消えるため、
# patches/ から復元する。
#
# 詳細: @perfood/capacitor-healthkit は CocoaPods のみ対応で SPM 非対応のため、
# Capacitor 8 (SPM ベース) で利用するには Package.swift を手動追加する必要がある。

set -euo pipefail

PATCH_FILE="patches/perfood-capacitor-healthkit-Package.swift"
TARGET_DIR="node_modules/@perfood/capacitor-healthkit"
TARGET_FILE="${TARGET_DIR}/Package.swift"

# node_modules が存在しない or 対象パッケージが未インストールならスキップ
if [ ! -d "${TARGET_DIR}" ]; then
  echo "[postinstall-healthkit] ${TARGET_DIR} not found, skipping."
  exit 0
fi

if [ ! -f "${PATCH_FILE}" ]; then
  echo "[postinstall-healthkit] Patch file ${PATCH_FILE} not found, skipping."
  exit 0
fi

# 既に存在しても上書きする (バージョンを最新に保つ)
cp "${PATCH_FILE}" "${TARGET_FILE}"
echo "[postinstall-healthkit] Restored ${TARGET_FILE}"
