const express = require("express");
const { loadSkill } = require("../lib/skills");
const { callForJson } = require("../lib/claude");

const router = express.Router();

const TOPIC_SCHEMA = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      minItems: 20,
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string", enum: ["part1_2", "part3", "part4", "part5", "roleplay"] },
          questions: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          roleplayFormat: { type: "string" },
          sourceTopic: { type: "string" },
        },
        required: ["name", "category", "questions"],
      },
    },
  },
  required: ["topics"],
};

// Mirrors index.html's buildSurveyPrompt() so Claude sees the same input shape
// a human would when pasting the "설문 결과 복사 (T0용)" text.
function buildSurveyMessage(sa) {
  const lines = [
    "[OPIC 설문 결과 — T0 입력]",
    "Part1 직업분야: " + sa.part1,
    "Part2 학생여부: " + sa.part2Student,
    "Part2 최근수강: " + sa.part2Edu,
    "Part3 거주형태: " + sa.part3,
    "Part4 일반주제(" + sa.part4.length + "): " + sa.part4.join(", "),
    "Part5 돌발주제(" + sa.part5.length + "): " + sa.part5.join(", "),
    "",
    "위 내용으로 T0를 실행해서 20개 학습 주제와 예시 질문 80개를 만들어줘.",
  ];
  return lines.join("\n");
}

function validateSurveyAnswers(sa) {
  if (!sa || typeof sa !== "object") return "surveyAnswers가 없어요.";
  const required = ["part1", "part2Student", "part2Edu", "part3", "part4", "part5"];
  for (const key of required) {
    if (sa[key] === undefined || sa[key] === null || sa[key] === "") {
      return "surveyAnswers." + key + "가 없어요.";
    }
  }
  if (!Array.isArray(sa.part4) || sa.part4.length !== 6) {
    return "Part4 일반주제는 정확히 6개여야 해요 (현재 " + (Array.isArray(sa.part4) ? sa.part4.length : 0) + "개).";
  }
  if (!Array.isArray(sa.part5) || sa.part5.length !== 4) {
    return "Part5 돌발주제는 정확히 4개여야 해요 (현재 " + (Array.isArray(sa.part5) ? sa.part5.length : 0) + "개).";
  }
  return null;
}

router.post("/", async (req, res, next) => {
  try {
    const validationError = validateSurveyAnswers(req.body.surveyAnswers);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const system = loadSkill("t0-topic-generator");
    const userMessage = buildSurveyMessage(req.body.surveyAnswers);

    const result = await callForJson({
      system,
      userMessage,
      toolName: "submit_topics",
      toolDescription: "Submit the 20 generated OPIc study topics with their 4 example questions each.",
      toolInputSchema: TOPIC_SCHEMA,
    });

    if (!Array.isArray(result.topics) || result.topics.length !== 20) {
      return res.status(502).json({ error: "Claude가 20개 주제를 만들지 못했어요. 다시 시도해주세요." });
    }

    res.json({ topics: result.topics });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
