const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

// Calls Claude with a system prompt (a SKILL.md's content) and forces the
// response into `toolInputSchema` via tool_choice, so callers get back a
// parsed object instead of having to parse free-form text.
async function callForJson({ system, userMessage, toolName, toolDescription, toolInputSchema, maxTokens }) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens || 8000,
    system,
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        name: toolName,
        description: toolDescription,
        input_schema: toolInputSchema,
      },
    ],
    tool_choice: { type: "tool", name: toolName },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) {
    throw new Error("Claude did not return a tool_use block — check MODEL/API key/tool schema.");
  }
  return toolUse.input;
}

module.exports = { callForJson };
