#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[1/3] fetch"
npm run --silent fetch

echo "[2/3] summarize (에이전트 세션)"
# 헤드리스 세션이 RUNBOOK의 summarize 단계를 수행해 data/summarized.json을 만든다.
# 대화형 세션에서 수동 실행 시 이 단계는 사람이 '요약 실행'으로 트리거한다.
claude -p "pipeline/RUNBOOK.md의 summarize 단계를 수행해 data/raw.json을 읽고 data/summarized.json을 작성해줘. 작업이 끝나면 파일만 남기고 종료." || {
  echo "summarize 자동 단계 실패/건너뜀 — data/summarized.json을 수동으로 생성하세요."; }

echo "[3/3] merge"
npm run --silent merge
echo "완료. web/ 에서 결과 확인."
