const express = require("express");
const notionLib = require("../lib/notion");

const router = express.Router();
const DB_TITLES = ["대본", "표현", "기록"];

async function resolveDatabases(notion) {
  const found = {};
  const ambiguous = {};
  const missing = [];
  for (const title of DB_TITLES) {
    const matches = await notionLib.findDatabaseByTitle(notion, title);
    if (matches.length === 1) {
      found[title] = matches[0];
    } else if (matches.length > 1) {
      ambiguous[title] = matches.map((m) => ({ id: m.id, url: m.url }));
    } else {
      missing.push(title);
    }
  }
  return { found, ambiguous, missing };
}

// Builds every Notion write target for this record. propose and execute both
// call this so the preview shown to the user is exactly what execute will do.
async function buildTargets(notion, dbs, record) {
  const targets = [];
  const warnings = [];

  if (Array.isArray(record.scripts)) {
    const db = dbs["대본"];
    for (const s of record.scripts) {
      const existing = await notionLib.findScriptPage(notion, db.id, s.topic);
      const properties = {
        Name: notionLib.titleValue(s.topic + " · " + record.date),
        주제: { select: { name: s.topic } },
      };
      if (s.grade) properties["채점 등급"] = { select: { name: s.grade } };
      if (typeof s.masteryPct === "number") properties["체화 정도"] = notionLib.pctToSelectValue(s.masteryPct);
      if (typeof s.exprAvgMasteryPct === "number") properties["표현 평균 체화도"] = notionLib.pctToSelectValue(s.exprAvgMasteryPct);
      targets.push({
        db: "대본", dbId: db.id, operation: existing ? "update" : "create", pageId: existing ? existing.id : null,
        label: (existing ? "갱신: " : "생성: ") + "대본 · " + s.topic, properties,
      });
    }
  }

  if (Array.isArray(record.expressions)) {
    const db = dbs["표현"];
    for (const e of record.expressions) {
      const existing = await notionLib.findExpressionPage(notion, db.id, e.topic, e.text);
      const properties = {
        Name: notionLib.titleValue(e.text),
        주제: { select: { name: e.topic } },
        "중요 표현 여부": { checkbox: !!e.important },
      };
      if (typeof e.masteryPct === "number") properties["체화 정도"] = notionLib.pctToSelectValue(e.masteryPct);
      targets.push({
        db: "표현", dbId: db.id, operation: existing ? "update" : "create", pageId: existing ? existing.id : null,
        label: (existing ? "갱신: " : "생성: ") + "표현 · " + e.text, properties,
      });
    }
  }

  if (record.retro) {
    const db = dbs["기록"];
    const r = record.retro;
    warnings.push('"달성" 필드는 4단계(달성/대부분 달성/일부 달성/안함)지만 T6은 완료 여부만 알아서 완료=달성, 미완료=안함으로 채웁니다 — 다르게 남기고 싶으면 Notion에서 직접 고쳐주세요.');
    const noteParts = [r.achievementNote, r.goodPoints ? "잘한 점: " + r.goodPoints : "", r.improvements ? "개선점: " + r.improvements : ""].filter(Boolean);
    const properties = {
      Name: notionLib.titleValue("회고 · " + record.date),
      날짜: { date: { start: record.date } },
      달성: notionLib.achievementToSelectValue(r.completedNewScript),
      회고: notionLib.richTextValue(noteParts.join(" / ")),
    };
    if (typeof r.studyMinutes === "number") properties["공부시간"] = { number: r.studyMinutes };
    if (r.decision) properties["일정 조정 이력"] = notionLib.richTextValue(r.decision === "weekend_makeup" ? "주말 보충 학습" : "학습 완료 목표일 연장");
    if (Array.isArray(record.topicsToday) && record.topicsToday.length) {
      properties["학습 주제 2개"] = { multi_select: record.topicsToday.map((t) => ({ name: t })) };
      warnings.push('"학습 주제 2개"는 T6 결과가 아니라 오늘 스케줄(신규+복습 주제)에서 자동으로 채웠습니다.');
    }
    targets.push({ db: "기록", dbId: db.id, operation: "create", pageId: null, label: "생성: 기록 · " + record.date, properties });
  }

  return { targets, warnings };
}

function validateRecord(body) {
  if (!body || typeof body !== "object" || !body.record) return "'record'가 없어요.";
  if (!body.record.date || typeof body.record.date !== "string") return "'record.date'가 없어요.";
  if ((!body.record.scripts || !body.record.scripts.length) && !body.record.expressions && !body.record.retro) {
    return "반영할 내용(scripts/expressions/retro)이 하나도 없어요.";
  }
  return null;
}

router.post("/propose", async (req, res, next) => {
  try {
    const validationError = validateRecord(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const notion = notionLib.getClient();
    if (!notion) {
      return res.json({ status: "not_connected", message: "Notion이 연결돼 있지 않아요 — 아래는 수동으로 Notion에 옮겨 적을 수 있는 요약이에요.", manualSummary: req.body.record });
    }

    const { found, ambiguous, missing } = await resolveDatabases(notion);
    if (missing.length || Object.keys(ambiguous).length) {
      return res.json({ status: "db_not_resolved", missing, ambiguous, message: "대본/표현/기록 DB를 확실하게 찾지 못했어요 — 후보를 확인해주세요." });
    }

    const { targets, warnings } = await buildTargets(notion, found, req.body.record);
    res.json({ status: "ok", targets: targets.map((t) => ({ db: t.db, operation: t.operation, label: t.label, properties: t.properties })), warnings });
  } catch (err) {
    next(err);
  }
});

router.post("/execute", async (req, res, next) => {
  try {
    if (req.body.confirmed !== true) {
      return res.status(400).json({ error: "'confirmed:true'가 없으면 실행하지 않아요 — 승인 없이는 절대 쓰지 않습니다." });
    }
    const validationError = validateRecord(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const notion = notionLib.getClient();
    if (!notion) return res.status(409).json({ error: "Notion이 연결돼 있지 않아요." });

    const { found, ambiguous, missing } = await resolveDatabases(notion);
    if (missing.length || Object.keys(ambiguous).length) {
      return res.status(409).json({ error: "대본/표현/기록 DB를 확실하게 찾지 못했어요.", missing, ambiguous });
    }

    const { targets } = await buildTargets(notion, found, req.body.record);
    const results = [];
    for (const t of targets) {
      try {
        if (t.operation === "update") {
          await notion.pages.update({ page_id: t.pageId, properties: t.properties });
        } else {
          await notion.pages.create({ parent: { database_id: t.dbId }, properties: t.properties });
        }
        results.push({ label: t.label, ok: true });
      } catch (e) {
        results.push({ label: t.label, ok: false, error: e.message });
      }
    }
    res.json({ status: "done", results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
