#!/usr/bin/env bash
# ai-trend 자동 수집 파이프라인: fetch → summarize(claude) → leaderboard(claude) → merge → GitHub Pages 게시(push)
# launchd(매일 09:00) 또는 수동 실행. 부분 실패해도 가능한 결과는 게시하도록 set -e 미사용.
set -uo pipefail

# launchd는 최소 환경으로 실행되므로 도구 경로를 명시한다.
export PATH="/Users/minjijung/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Applications/cmux.app/Contents/Resources/bin:$PATH"

cd "$(cd "$(dirname "$0")" && pwd)/.."
ts() { date "+%Y-%m-%d %H:%M:%S"; }
echo "===== ai-trend run @ $(ts) ====="

echo "[1/5] fetch"
npm run --silent fetch || echo "[warn] fetch 실패"

echo "[2/5] summarize (claude -p, 헤드리스)"
claude -p "ai-trend 수집 파이프라인의 summarize 단계를 수행하라. pipeline/RUNBOOK.md 규칙을 따른다.
- data/raw.json 을 읽고, data/state.json 의 seen 목록에 없는 '새 항목'만 처리한다.
- 각 항목에 summaryKo(한국어 2~3문장)·tags·entities·cats·summaryStatus 를 채워 data/summarized.json(배열)으로 저장한다.
- sourceType 이 youtube 이면 watch 스킬로 자막 요약(실패 시 title 기반 fallback), 그 외는 rawText 기반 요약.
- cats 는 고정목록(LLM·모델 / 에이전트 / 코딩·개발 / 멀티모달 / 기업·정책)에서만 고른다.
- 끝나면 data/summarized.json 파일만 남기고 종료한다." \
  --dangerously-skip-permissions || echo "[warn] summarize 실패 — 이전 data로 진행"

echo "[3/5] leaderboard (claude -p, 웹검색 갱신)"
claude -p "ai-trend 리더보드 갱신 단계를 수행하라. pipeline/LEADERBOARD.md 규칙을 따른다.
- WebSearch/WebFetch로 주요 리더보드(LMSYS lmarena.ai · Artificial Analysis · LLM Stats · Vellum · Hugging Face)를 조회한다.
- data/leaderboard.json 을 스키마대로 갱신한다. 카테고리 8종(general/reasoning/coding/math/vision/image/openweight/price)과 고정 순서를 유지한다.
- 각 ranks에 score·basis·source를 채우고, asOf=오늘 날짜·updatedAt=현재시각으로 갱신한다.
- 출처에서 확인 못한 수치는 이전 값을 그대로 유지하고 추정하지 않는다.
- 끝나면 유효한 JSON 파일 data/leaderboard.json 하나만 남기고 종료한다." \
  --dangerously-skip-permissions || echo "[warn] leaderboard 실패 — 이전 data로 진행"

echo "[4/5] merge"
npm run --silent merge || echo "[warn] merge 실패"

echo "[5/5] publish (git push → GitHub Pages)"
git add data/feed.json data/trending.json data/leaderboard.json 2>/dev/null || true
if git diff --cached --quiet; then
  echo "변경 없음 — push 생략"
else
  git commit -q -m "data: 자동 수집 $(date +%Y-%m-%dT%H:%M)" && git push -q && echo "push 완료" || echo "[warn] commit/push 실패(원격/인증 확인)"
fi
echo "===== done @ $(ts) ====="
