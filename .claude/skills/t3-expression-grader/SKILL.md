---
name: t3-expression-grader
description: Quiz the user on their saved key expressions (T3 in the OPIC 어시스턴트 project) — presents each expression's Korean meaning and grades the user's English answer with paraphrase-tolerant judging (correct if meaning is preserved, wrong only if it deviates from the original intent). Trigger when the user pastes a "[OPIC 어시스턴트] 복습 정보 — {topic}" block and asks to quiz/test the expressions, or otherwise gives a topic's list of important English expressions and asks "표현 테스트", "표현 채점해줘", or "T3 실행/돌려줘" — trigger even on loose mentions of testing or reviewing saved expressions in this project's context.
---

# T3 — 표현 채점 도구

T3는 사용자가 이전에 골라둔 "주요 표현"들을 실제로 영어로 다시 말할 수 있는지 테스트하는 도구다. 채점 기준은 항상 같아야 한다 — 뜻만 통하면 정답으로 인정하되, 봐주기 식으로 관대하게 굴지 않는다.

보통은 복습일에 T2가 체화 정도를 계산한 직후 이 로직을 자동으로 이어서 수행한다(왕복을 줄이기 위해) — 스크립트 재채점 없이 표현만 다시 테스트하고 싶을 때는 이 스킬을 그대로 단독으로 불러도 된다.

## 입력 받는 법

가장 흔한 입력은 대시보드의 "복습 정보 복사" 버튼이 만드는 블록이다:

```
[OPIC 어시스턴트] 복습 정보 — {주제}
직전 채점 등급: ...
최초 스크립트: ...
수정된 스크립트: ...
주요 표현 N개:
1. ...
```

이 블록이 오면 스크립트 맥락을 이용해 각 표현이 그 스크립트 안에서 정확히 어떤 뜻으로 쓰였는지 파악한 뒤 한국어 문제를 만든다 — 맥락 덕분에 관용구도 뜻이 명확해진다.

스크립트 없이 주제명 + 표현 목록만 오는 경우도 지원한다. 다만 맥락이 없어 뜻이 여러 갈래로 해석될 수 있는 표현(관용구, 다의어 등)이 있으면 "이 표현, 어떤 뜻으로 익히신 거예요?"라고 짧게 확인한 뒤 출제한다 — 임의로 한 가지 뜻을 정해서 채점하지 않는다.

최소한 필요한 것: 주제명, 표현 목록(1개 이상, 보통 5개). 둘 다 없으면 채점을 시작하지 말고 먼저 물어본다.

## 채점 원칙 — paraphrase 허용

**의미가 보존되면 정답, 원래 의도에서 크게 벗어나면 오답.** "토씨 하나까지 일치"가 기준이 아니다.

예: 표현이 "that sort of thing"(그런 부류의 것)이라면 — "stuff like that", "things of that kind"는 의미가 같으니 정답. 반대로 완전히 다른 의미로 답하면(예: "I don't care about it") 오답.

## 진행 방식

1. 표현들을 번호를 매겨 한국어 뜻으로 제시한다. 사용자가 한 번에 다 답하고 싶어하면 전부 제시하고, 하나씩 주고받는 대화를 원하면 순서대로 진행한다 — 사용자 스타일에 맞춘다.
2. 답이 오면 원래 영어 표현과 의미를 비교해 정답/오답을 판정하고, 왜 그런지 한 줄로 짧게 설명한다.
3. 전부 답변을 받으면 결과를 요약한다: 정답 개수, 오답 표현 목록.
4. 오답이 하나라도 있으면 "오답 표현만 다시 도전해볼까요? (T4)"라고 이어갈지 물어본다.

## masteryPct 잠정 규칙 (PRD에 명시되지 않은 부분 — T3/T4가 공유하는 제안값)

PRD는 표현 개별 체화 정도가 정확히 어떻게 산출되는지 정의하지 않는다. 대시보드의 표현 데이터는 처음 저장될 때 항상 0%로 시작하고 그 뒤로 갱신할 방법이 없으므로, T3/T4가 그 공백을 메운다:

- 1회 만에 정답 → 100
- 오답이면 이 시점에서는 아직 최종 점수를 매기지 않는다 — T4로 재도전하면 그 결과에 따라 최종값이 정해진다(T4 참고).
- T3만 단독으로 끝내고(T4로 안 넘어가고) 오답이 남았다면 잠정 25로 표기하고 "아직 재학습(T4)을 거치지 않았다"는 점을 함께 밝힌다.

## 출력 형식

사람이 읽는 요약(정답 개수, 오답 목록) 먼저, 그다음 JSON 코드블록:

```json
{
  "topic": "카페/커피전문점 가기",
  "results": [
    { "text": "my go-to spot", "correct": true, "userAnswer": "my usual place", "attempts": 1, "masteryPct": 100 },
    { "text": "that sort of thing", "correct": false, "userAnswer": "I don't care about it", "attempts": 1, "masteryPct": 25 }
  ],
  "wrongExpressions": ["that sort of thing"]
}
```

`text` 필드는 T1 출력 JSON의 `expressions[].text`와 같은 표현 문자열을 가리킨다 — 필드명을 T1과 통일해서 나중에 표현 DB의 같은 항목임을 쉽게 매칭할 수 있게 한다.

이 스키마는 대시보드에 아직 이 결과를 받는 가져오기 UI가 없어서 잠정안이다(T0/T1의 JSON도 같은 이유로 잠정안임을 명시하고 있다) — 출력 끝에 한 줄로 이 점을 알린다.

## 마지막에 항상 할 것

1. 오답이 있으면 T4로 이어갈지 명시적으로 제안한다.
2. `wrongExpressions` 목록이 정답/오답 판정과 정확히 일치하는지 스스로 확인한다.
3. JSON 스키마가 잠정안임을 한 줄로 언급한다.
