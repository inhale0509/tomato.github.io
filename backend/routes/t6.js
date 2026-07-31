const express = require("express");

const router = express.Router();
const VALID_DECISIONS = ["weekend_makeup", "push_deadline"];

// T6's SKILL.md content is almost entirely a decision-gate rule plus the
// user's own free-form text (studyMinutes/achievementNote/goodPoints/
// improvements/decision) — there is no judgment call for Claude to make here
// (completedNewScript is the user's own fact, and which rescheduling option
// to take is explicitly "the user picks, never decided for them"). So this
// endpoint is pure validation, no Claude call.
router.post("/", (req, res) => {
  const body = req.body || {};

  if (!body.date || typeof body.date !== "string" || !body.date.trim()) {
    return res.status(400).json({ error: "'date'가 없어요." });
  }
  if (typeof body.completedNewScript !== "boolean") {
    return res.status(400).json({ error: "오늘 배정된 신규 스크립트 작성을 완료했는지(true/false)가 없어요 — 미달성 판정의 유일한 기준이라 꼭 필요해요." });
  }

  if (!body.completedNewScript && VALID_DECISIONS.indexOf(body.decision) === -1) {
    return res.json({
      status: "need_decision",
      message: "오늘 신규 학습을 다 못 끝냈어요 — 일정을 어떻게 조정할지 골라주세요.",
      options: [
        { value: "weekend_makeup", label: "주말 보충 학습 — 평일 스케줄은 그대로, 다가오는 주말에 이어서 함 (3주 목표 유지)" },
        { value: "push_deadline", label: "학습 완료 목표일 연장 — 이후 신규일·복습 예정일을 하루씩 순연 (3주 목표 자체가 늘어남)" },
      ],
    });
  }

  res.json({
    status: "ok",
    data: {
      date: body.date,
      studyMinutes: typeof body.studyMinutes === "number" ? body.studyMinutes : null,
      completedNewScript: body.completedNewScript,
      achievementNote: body.achievementNote || "",
      goodPoints: body.goodPoints || "",
      improvements: body.improvements || "",
      decision: body.completedNewScript ? null : body.decision,
    },
  });
});

module.exports = router;
