const { Client } = require("@notionhq/client");

function getClient() {
  if (!process.env.NOTION_API_KEY) return null;
  return new Client({ auth: process.env.NOTION_API_KEY });
}

// Always searches fresh — never caches a database id across requests, per
// T7's SKILL.md ("매번 다시 확인, 캐시하지 않음").
async function findDatabaseByTitle(notion, title) {
  const res = await notion.search({
    query: title,
    filter: { property: "object", value: "database" },
  });
  const exact = res.results.filter((db) => {
    const t = (db.title || []).map((t) => t.plain_text).join("");
    return t === title;
  });
  if (exact.length) return exact;
  return res.results.filter((db) => {
    const t = (db.title || []).map((t) => t.plain_text).join("");
    return t.indexOf(title) !== -1;
  });
}

function pctToSelectValue(pct) {
  return { select: { name: String(pct) } };
}

function titleValue(text) {
  return { title: [{ text: { content: text } }] };
}

function richTextValue(text) {
  return { rich_text: [{ text: { content: text || "" } }] };
}

// completedNewScript is the only fact T6 tracks; "달성" has 4 steps. This
// binary->4-step mapping is a documented stopgap (see plan) — the propose
// preview surfaces it so the user can hand-correct in Notion if they want a
// finer-grained value.
function achievementToSelectValue(completedNewScript) {
  return { select: { name: completedNewScript ? "달성" : "안함" } };
}

async function findScriptPage(notion, dbId, topic) {
  const res = await notion.databases.query({
    database_id: dbId,
    filter: { property: "주제", select: { equals: topic } },
  });
  return res.results[0] || null;
}

async function findExpressionPage(notion, dbId, topic, text) {
  const res = await notion.databases.query({
    database_id: dbId,
    filter: {
      and: [
        { property: "주제", select: { equals: topic } },
        { property: "Name", title: { equals: text } },
      ],
    },
  });
  return res.results[0] || null;
}

module.exports = {
  getClient,
  findDatabaseByTitle,
  pctToSelectValue,
  titleValue,
  richTextValue,
  achievementToSelectValue,
  findScriptPage,
  findExpressionPage,
};
