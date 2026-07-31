const express = require("express");
const { loadSkill } = require("../lib/skills");
const { callForJson } = require("../lib/claude");

const router = express.Router();

const MASTERY_SCHEMA = {
  type: "object",
  properties: {
    masteryPct: { type: "integer", enum: [0, 25, 50, 75, 100] },
    note: { type: "string" },
  },
  required: ["masteryPct", "note"],
};

function buildMessage(body) {
  const lines = [
    "주제: " + body.topic,
    "",
    "최초 스크립트:",
    body.originalScriptText,
    "",
    "수정된 스크립트:",
    body.revisedScriptText,
    "",
    "오늘 복습 시점의 전사 결과:",
    body.reviewTranscript,
  ];
  if (Array.isArray(body.importantExpressions) && body.importantExpressions.length) {
    lines.push("");
    lines.push("주요 표현 " + body.importantExpressions.length + "개:");
    body.importantExpressions.forEach((e, i) => lines.push((i + 1) + ". " + e));
  }
  if (body.priorGrade) {
    lines.push("");
    lines.push("직전 T1 채점 등급(참고용): " + body.priorGrade);
  }
  return lines.join("\n");
}

function validateBody(body) {
  if (!body || typeof body !== "object") return "요청 본문이 없어요.";
  if (!body.topic || typeof body.topic !== "string" || !body.topic.trim()) return "'topic'이 없어요.";
  if (!body.originalScriptText || typeof body.originalScriptText !== "string") return "'originalScriptText'(최초 스크립트)가 없어요.";
  if (!body.revisedScriptText || typeof body.revisedScriptText !== "string") return "'revisedScriptText'(수정된 스크립트)가 없어요.";
  if (!body.reviewTranscript || typeof body.reviewTranscript !== "string" || !body.reviewTranscript.trim()) {
    return "오늘 다시 말해본 내용(전사 결과)이 없어요 — 이게 없으면 체화 정도를 판단할 근거가 없어요.";
  }
  return null;
}

router.post("/", async (req, res, next) => {
  try {
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const system = loadSkill("t2-mastery-calculator");
    const userMessage = buildMessage(req.body);

    const result = await callForJson({
      system,
      userMessage,
      toolName: "submit_mastery",
      toolDescription: "Submit the script's mastery percentage (0/25/50/75/100) and a one-sentence judgment note.",
      toolInputSchema: MASTERY_SCHEMA,
      maxTokens: 1500,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
