const fs = require("fs");
const path = require("path");

const SKILLS_ROOT = path.join(__dirname, "..", "..", ".claude", "skills");

function loadSkill(skillDirName) {
  const filePath = path.join(SKILLS_ROOT, skillDirName, "SKILL.md");
  return fs.readFileSync(filePath, "utf8");
}

module.exports = { loadSkill };
