const express = require("express");
const { loadSkill } = require("../lib/skills");
const { callForJson } = require("../lib/claude");

const router = express.Router();

const GRADE_SCHEMA = {
  type: "object",
  properties: {
    grade: { type: "string" },
    feedback: { type: "string" },
    errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["quote", "explanation"],
      },
    },
    correctedScript: { type: "string" },
    candidateExpressions: { type: "array", minItems: 10, maxItems: 10, items: { type: "string" } },
    keywordFlow: { type: "array", minItems: 5, maxItems: 7, items: { type: "string" } },
    reviewNote: { type: "string" },
  },
  required: ["grade", "feedback", "errors", "correctedScript", "candidateExpressions", "keywordFlow"],
};

function buildGradeMessage(body) {
  const lines = [
    "주제: " + body.topic,
    "실제로 답한 질문: " + body.question,
    "모드: " + (body.mode === "review" ? "복습" : "신규"),
  ];
  if (body.mode === "review") {
    lines.push("원본(최초) 스크립트: " + (body.originalScriptText || "(없음 — 원본 대비 비교 코멘트는 생략)"));
    if (body.previousGrade) lines.push("이전 채점 등급: " + body.previousGrade);
  }
  lines.push("");
  lines.push("스크립트 텍스트:");
  lines.push(body.scriptText);
  return lines.join("\n");
}

function validateGradeBody(body) {
  if (!body || typeof body !== "object") return "요청 본문이 없어요.";
  if (!body.topic || typeof body.topic !== "string" || !body.topic.trim()) return "'topic'이 없어요.";
  if (!body.question || typeof body.question !== "string" || !body.question.trim()) {
    return "실제로 답한 질문이 없어요 — Content & Context 축은 질문 없이 판단할 수 없어요. 어떤 질문에 답했는지 알려주세요.";
  }
  if (!body.scriptText || typeof body.scriptText !== "string" || !body.scriptText.trim()) return "'scriptText'가 없어요.";
  if (body.mode !== "new" && body.mode !== "review") return "'mode'는 'new' 또는 'review'여야 해요.";
  return null;
}

router.post("/grade", async (req, res, next) => {
  try {
    const validationError = validateGradeBody(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const system = loadSkill("t1-script-grader");
    const userMessage = buildGradeMessage(req.body);

    const result = await callForJson({
      system,
      userMessage,
      toolName: "submit_grading",
      toolDescription: "Submit the grading result: grade, feedback, flagged errors, a corrected script, 10 candidate key expressions, and a memorization keyword flow.",
      toolInputSchema: GRADE_SCHEMA,
      maxTokens: 4000,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Pure data assembly — no Claude call. Which candidates get `important: true` is
// the user's checkbox selection, not a new judgment call, so this just tags them.
router.post("/finalize", (req, res) => {
  const body = req.body || {};
  const { topic, originalScriptText, correctedScript, feedback, grade, candidateExpressions, selectedIndices } = body;

  if (!topic || typeof topic !== "string" || !topic.trim()) return res.status(400).json({ error: "'topic'이 없어요." });
  if (!originalScriptText || typeof originalScriptText !== "string") return res.status(400).json({ error: "'originalScriptText'(최초 스크립트 원문)가 없어요." });
  if (!correctedScript || typeof correctedScript !== "string") return res.status(400).json({ error: "'correctedScript'가 없어요." });
  if (!Array.isArray(candidateExpressions) || candidateExpressions.length === 0) return res.status(400).json({ error: "'candidateExpressions'가 없어요." });
  if (!Array.isArray(selectedIndices) || selectedIndices.length === 0) {
    return res.status(400).json({ error: "표현을 하나도 안 골랐어요 — 최소 1개는 골라주세요 (권장 5개)." });
  }

  const expressions = candidateExpressions.map((text, i) => ({
    text,
    important: selectedIndices.indexOf(i) !== -1,
  }));

  res.json({
    topic,
    grade: grade || "",
    originalScriptText,
    scriptText: correctedScript,
    feedback: feedback || "",
    expressions,
  });
});

module.exports = router;
