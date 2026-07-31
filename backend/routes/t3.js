const express = require("express");
const { loadSkill } = require("../lib/skills");
const { callForJson } = require("../lib/claude");

const router = express.Router();

const PRESENT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          prompt: { type: "string" },
        },
        required: ["text", "prompt"],
      },
    },
  },
  required: ["items"],
};

const GRADE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          correct: { type: "boolean" },
          explanation: { type: "string" },
        },
        required: ["text", "correct", "explanation"],
      },
    },
  },
  required: ["results"],
};

function validatePresentBody(body) {
  if (!body || typeof body !== "object") return "요청 본문이 없어요.";
  if (!body.topic || typeof body.topic !== "string" || !body.topic.trim()) return "'topic'이 없어요.";
  if (!Array.isArray(body.expressions) || body.expressions.length === 0) return "'expressions' 목록이 없어요.";
  return null;
}

router.post("/present", async (req, res, next) => {
  try {
    const validationError = validatePresentBody(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const system = loadSkill("t3-expression-grader");
    const lines = ["주제: " + req.body.topic];
    if (req.body.scriptContext) {
      lines.push("", "스크립트 맥락(표현의 정확한 뜻 판단용):", req.body.scriptContext);
    }
    lines.push("", "표현 목록:");
    req.body.expressions.forEach((e, i) => lines.push((i + 1) + ". " + e));
    lines.push("", "위 표현들 각각을 한국어 뜻으로 제시하는 문제만 만들어줘 (아직 채점 아님, 사용자 답변은 나중에 따로 옴).");

    const result = await callForJson({
      system,
      userMessage: lines.join("\n"),
      toolName: "submit_quiz_items",
      toolDescription: "Present each expression as a Korean-meaning quiz prompt (no grading yet).",
      toolInputSchema: PRESENT_SCHEMA,
      maxTokens: 1500,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

function validateGradeBody(body) {
  if (!body || typeof body !== "object") return "요청 본문이 없어요.";
  if (!body.topic || typeof body.topic !== "string" || !body.topic.trim()) return "'topic'이 없어요.";
  if (!Array.isArray(body.items) || body.items.length === 0) return "'items' 목록이 없어요.";
  for (const it of body.items) {
    if (!it || typeof it.text !== "string" || typeof it.userAnswer !== "string") {
      return "각 item에는 'text'와 'userAnswer'가 있어야 해요.";
    }
  }
  return null;
}

// Reused for both the initial T3 quiz and every T4 retry round — T4's SKILL.md
// states it shares T3's grading criteria exactly, so there is no separate
// system prompt or endpoint for retries.
router.post("/grade", async (req, res, next) => {
  try {
    const validationError = validateGradeBody(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const system = loadSkill("t3-expression-grader");
    const lines = ["주제: " + req.body.topic, "", "채점할 답변들:"];
    req.body.items.forEach((it, i) => {
      lines.push((i + 1) + ". 표현: " + it.text + " | 문제: " + (it.prompt || "(한국어 뜻 제시)") + " | 사용자 답변: " + it.userAnswer);
    });
    lines.push("", "각 항목이 의미 보존 기준으로 정답인지 오답인지만 판단해줘 (paraphrase 허용, 원래 의도에서 크게 벗어나야만 오답).");

    const result = await callForJson({
      system,
      userMessage: lines.join("\n"),
      toolName: "submit_grades",
      toolDescription: "Submit correct/incorrect for each expression answer, meaning-preservation basis (paraphrase allowed).",
      toolInputSchema: GRADE_SCHEMA,
      maxTokens: 2000,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
