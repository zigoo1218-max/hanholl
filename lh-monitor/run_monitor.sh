#!/usr/bin/env bash
# LH/SH 공고 모니터 1회 실행 (crontab 등록용). 최초 실행 시 가상환경을 자동으로 만든다.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
exec .venv/bin/python monitor.py "$@" >> data/monitor.log 2>&1
