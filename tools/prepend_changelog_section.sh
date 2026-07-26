#!/usr/bin/env bash
# 将一版变更说明插入 CHANGELOG.md 的 <!-- entries --> 标记之后。
# 若存在 ## [Unreleased] 段：以其正文作为本版说明，并移除该段；
# BODY_FILE 仍会附在「### 提交明细」下（便于对照），若无 Unreleased 则整段用 BODY_FILE。
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
GENERATED="$(cat "${BODY_FILE}")"
GENERATED="${GENERATED#"${GENERATED%%[![:space:]]*}"}"
GENERATED="${GENERATED%"${GENERATED##*[![:space:]]}"}"

STRIPPED_FILE="$(mktemp)"
UNRELEASED_FILE="$(mktemp)"
SECTION_FILE="$(mktemp)"
OUT_FILE="$(mktemp)"
trap 'rm -f "${STRIPPED_FILE}" "${UNRELEASED_FILE}" "${SECTION_FILE}" "${OUT_FILE}"' EXIT

python3 - "${CHANGELOG_PATH}" "${STRIPPED_FILE}" "${UNRELEASED_FILE}" <<'PY'
import re
import sys

src, stripped_path, unreleased_path = sys.argv[1:4]
text = open(src, encoding="utf-8").read()
# Match ## [Unreleased] ... until next ## heading or EOF
pattern = re.compile(
    r"^##\s+\[Unreleased\][^\n]*\n(.*?)(?=^##\s+|\Z)",
    re.MULTILINE | re.DOTALL,
)
match = pattern.search(text)
unreleased = ""
if match:
    unreleased = match.group(1).strip()
    text = text[: match.start()] + text[match.end() :]
    # collapse excess blank lines around the hole
    text = re.sub(r"\n{3,}", "\n\n", text)
open(stripped_path, "w", encoding="utf-8").write(text)
open(unreleased_path, "w", encoding="utf-8").write(unreleased + ("\n" if unreleased else ""))
PY

UNRELEASED="$(cat "${UNRELEASED_FILE}")"
UNRELEASED="${UNRELEASED#"${UNRELEASED%%[![:space:]]*}"}"
UNRELEASED="${UNRELEASED%"${UNRELEASED##*[![:space:]]}"}"

if [ -n "${UNRELEASED}" ]; then
  BODY="${UNRELEASED}"
  if [ -n "${GENERATED}" ]; then
    BODY="${BODY}

### 提交明细

${GENERATED}"
  fi
  SOURCE_CHANGELOG="${STRIPPED_FILE}"
else
  BODY="${GENERATED}"
  SOURCE_CHANGELOG="${CHANGELOG_PATH}"
fi

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
done <"${SOURCE_CHANGELOG}"

if [ "${found}" -ne 1 ]; then
  echo "failed to insert section after marker" >&2
  exit 1
fi

mv "${OUT_FILE}" "${CHANGELOG_PATH}"
trap 'rm -f "${STRIPPED_FILE}" "${UNRELEASED_FILE}" "${SECTION_FILE}"' EXIT
