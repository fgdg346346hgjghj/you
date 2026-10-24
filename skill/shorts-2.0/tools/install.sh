#!/usr/bin/env bash
# Install SHORTS dependencies into a local venv (.venv). Needs python3.11+, ffmpeg with libass.
#   bash tools/install.sh            core
#   bash tools/install.sh --local    + offline voice (piper-tts) and word timings (faster-whisper); models go to the cache
set -euo pipefail
cd "$(dirname "$0")/.."
command -v ffmpeg >/dev/null || { echo "install ffmpeg first (apt install ffmpeg / brew install ffmpeg)"; exit 1; }
if command -v uv >/dev/null; then
  uv venv -q .venv && uv pip install -q -p .venv/bin/python -r requirements.txt
else
  python3 -m venv .venv && .venv/bin/python -m pip install -q -r requirements.txt
fi
if [ "${1:-}" = "--local" ]; then
  if command -v uv >/dev/null; then uv pip install -q -p .venv/bin/python -r requirements-local.txt
  else .venv/bin/python -m pip install -q -r requirements-local.txt; fi
fi
# browser: use system Chrome if present, else Playwright's Chromium
if ! command -v google-chrome >/dev/null && ! command -v chromium >/dev/null; then
  .venv/bin/python -m playwright install chromium
fi
.venv/bin/python tools/shorts.py doctor $([ "${1:-}" = "--local" ] && echo --deep)
