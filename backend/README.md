# OPIC 어시스턴트 백엔드

`.claude/skills/*/SKILL.md`를 system prompt로 그대로 읽어 Anthropic API를 호출하는 얇은 Express 서버. API 키는 여기(서버)에만 있고 프론트엔드(`index.html`)에는 절대 들어가지 않는다.

구현된 엔드포인트: `POST /api/t0`, `POST /api/t1/grade`+`/finalize`, `POST /api/t2`, `POST /api/t3/present`+`/grade`(T4 재도전 라운드도 재사용), `POST /api/t6`, `POST /api/t7/propose`+`/execute`.

## 로컬 실행

```bash
cd backend
npm install
cp .env.example .env
# .env에 ANTHROPIC_API_KEY 채우기
npm run dev
```

## 확인

```bash
curl -X POST http://localhost:3001/api/t0 \
  -H "Content-Type: application/json" \
  -d '{
    "surveyAnswers": {
      "part1": "사업/회사", "part2Student": "아니요", "part2Edu": "없음",
      "part3": "개인주택·아파트에 홀로 거주",
      "part4": ["영화보기","독서","카페/커피전문점 가기","국내 여행","요리하기","헬스"],
      "part5": ["호텔","병원","은행","날씨"]
    }
  }'
```

응답은 `{"topics": [...20개...]}` 형태이며, 각 topic은 `name`/`category`/`questions`(4개), 롤플레이 항목은 추가로 `roleplayFormat`/`sourceTopic`을 포함한다 — index.html의 `parseT0Output`이 기대하는 스키마와 동일하다.

## 배포 (Render.com 예시)

1. 이 저장소를 Render에 연결, **Root Directory**를 `backend`로 지정
2. Build Command: `npm install` / Start Command: `npm start`
3. Environment 탭에 `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `FRONTEND_ORIGIN`(GitHub Pages 도메인) 설정
4. 배포된 URL(예: `https://opic-backend.onrender.com`)을 프론트엔드의 API 호출 base URL로 사용

## T7 (Notion 반영) 설정

1. https://www.notion.so/my-integrations 에서 새 Integration을 만들고 토큰을 발급받는다.
2. Notion에서 "OPIC 어시스턴트" 페이지(대본/표현/기록 DB가 들어있는 상위 페이지)를 열어 우측 상단 "..." → Connections에서 방금 만든 Integration을 연결(공유)한다 — 이게 안 되면 API가 DB를 찾지 못한다.
3. 발급받은 토큰을 `NOTION_API_KEY`로 로컬 `.env`(개발용) 또는 Render 환경변수(배포용)에 채운다.
4. `NOTION_API_KEY`가 없으면 `/api/t7/propose`가 `status:"not_connected"`를 반환하고, 수동으로 Notion에 옮겨 적을 수 있는 요약만 준다(SKILL.md 명시 동작).

**주의**: `/api/t7/execute`는 실제로 Notion 페이지를 만들고 갱신한다. 매번 `/propose`로 먼저 무엇이 쓰일지 확인하고, 프론트에서 사용자가 명시적으로 확인 버튼을 눌러야만 `/execute`가 호출되며, `confirmed:true`가 없으면 서버도 거부한다.

## 참고

- system prompt는 매 요청마다 `.claude/skills/<tool>/SKILL.md`를 디스크에서 읽어온다 — SKILL.md를 수정하면 서버 재배포 없이 바로 반영됨.
- 구조화된 JSON 응답은 자유 텍스트 파싱 대신 Anthropic의 tool-use(`tool_choice`로 강제)를 사용해 스키마를 보장한다 (`lib/claude.js`).
