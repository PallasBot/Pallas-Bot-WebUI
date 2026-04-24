$ErrorActionPreference = "Stop"

# 同步 WebUI 构建产物到主仓插件静态目录，保证 /pallas/ 总是加载最新前端包。
$source = Join-Path $PSScriptRoot "..\dist"
$target = Join-Path $PSScriptRoot "..\..\Pallas-Bot\data\pallas_webui\public"

if (-not (Test-Path $source)) {
  throw "dist 目录不存在：$source"
}

if (-not (Test-Path $target)) {
  New-Item -ItemType Directory -Path $target -Force | Out-Null
}

robocopy $source $target /MIR | Out-Null
$code = $LASTEXITCODE
if ($code -ge 8) {
  throw "robocopy 同步失败，退出码：$code"
}

Write-Output "已同步 dist -> Pallas-Bot/data/pallas_webui/public"
