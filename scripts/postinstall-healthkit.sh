#!/usr/bin/env bash
# postinstall: @perfood/capacitor-healthkit を Capacitor 8 SPM 互換にパッチする
# npm install で node_modules が再生成されると消えるため毎回復元する。
#
# 修正内容:
# 1. Package.swift を追加 (SPM パッケージ化)
# 2. Plugin.swift に CAPBridgedPlugin プロトコル実装を追加
#    (CAP_PLUGIN ObjC マクロが SPM 環境で動作しないため)

set -euo pipefail

TARGET_DIR="node_modules/@perfood/capacitor-healthkit"

# node_modules が存在しない or 対象パッケージが未インストールならスキップ
if [ ! -d "${TARGET_DIR}" ]; then
  echo "[postinstall-healthkit] ${TARGET_DIR} not found, skipping."
  exit 0
fi

# Package.swift
PKG_PATCH="patches/perfood-capacitor-healthkit-Package.swift"
PKG_TARGET="${TARGET_DIR}/Package.swift"
if [ -f "${PKG_PATCH}" ]; then
  cp "${PKG_PATCH}" "${PKG_TARGET}"
  echo "[postinstall-healthkit] Restored ${PKG_TARGET}"
fi

# Plugin.swift (CAPBridgedPlugin 対応版)
PLUGIN_PATCH="patches/perfood-capacitor-healthkit-Plugin.swift"
PLUGIN_TARGET="${TARGET_DIR}/ios/Plugin/CapacitorHealthkitPlugin.swift"
if [ -f "${PLUGIN_PATCH}" ]; then
  cp "${PLUGIN_PATCH}" "${PLUGIN_TARGET}"
  echo "[postinstall-healthkit] Restored ${PLUGIN_TARGET}"
fi

echo "[postinstall-healthkit] Done."
