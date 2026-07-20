#!/usr/bin/env bash
# 将一版变更说明插入 CHANGELOG.md 的 <!-- entries --> 标记之后。
# 用法: prepend_changelog_section.sh <version_tag> <section_body_file> [changelog_path]
set -euo pipefail

VERSION_TAG="${1:?version tag required}"
BODY_FILE="${2:?body file required}"
CHANGELOG_PATH="${3:-CHANGELOG.md}"
MARKER="<!-- entries -->"

if [ ! -f "${BODY_FILE}" ]; then
  echo "body file not found: ${BODY_FILE}" >&2
  exit 1
fi
if [ ! -f "${CHANGELOG_PATH}" ]; then
  echo "changelog not found: ${CHANGELOG_PATH}" >&2
  exit 1
fi
if ! grep -Fq "${MARKER}" "${CHANGELOG_PATH}"; then
  echo "marker ${MARKER} not found in ${CHANGELOG_PATH}" >&2
  exit 1
fi

VER_DISPLAY="${VERSION_TAG#v}"
DATE_UTC="$(date -u +%Y-%m-%d)"
BODY="$(cat "${BODY_FILE}")"
BODY="${BODY#"${BODY%%[![:space:]]*}"}"
BODY="${BODY%"${BODY##*[![:space:]]}"}"

SECTION_FILE="$(mktemp)"
OUT_FILE="$(mktemp)"
trap 'rm -f "${SECTION_FILE}" "${OUT_FILE}"' EXIT

{
  printf '## [%s] - %s\n\n' "${VER_DISPLAY}" "${DATE_UTC}"
  printf '%s\n' "${BODY}"
} >"${SECTION_FILE}"

found=0
while IFS= read -r line || [ -n "${line}" ]; do
  printf '%s\n' "${line}" >>"${OUT_FILE}"
  if [ "${line}" = "${MARKER}" ]; then
    found=1
    printf '\n' >>"${OUT_FILE}"
    cat "${SECTION_FILE}" >>"${OUT_FILE}"
    printf '\n' >>"${OUT_FILE}"
  fi
done <"${CHANGELOG_PATH}"

if [ "${found}" -ne 1 ]; then
  echo "failed to insert section after marker" >&2
  exit 1
fi

mv "${OUT_FILE}" "${CHANGELOG_PATH}"
trap 'rm -f "${SECTION_FILE}"' EXIT
