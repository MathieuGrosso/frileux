// Wrapper minimal autour de @anthropic-ai/sdk pour les edge functions.
// Pattern imposé : appel tool_use forcé + parsing Zod → JSON garanti.
// Maptient maxRetries: 4 (backoff exponentiel sur 429 / 529 / 5xx géré par le SDK).

import Anthropic from "npm:@anthropic-ai/sdk@^0.32";
import type { ZodSchema } from "npm:zod@^3.23";

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export interface CallToolArgs<T> {
  apiKey: string;
  model: string;
  tool: AnthropicTool;
  prompt: string;
  maxTokens?: number;
  maxRetries?: number;
  schema: ZodSchema<T>;
}

export interface CallToolResult<T> {
  data: T;
  tokensIn: number;
  tokensOut: number;
}

export class AnthropicToolError extends Error {
  constructor(
    public code:
      | "no_tool_use"
      | "schema_mismatch"
      | "network",
    public detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "AnthropicToolError";
  }
}

export async function callTool<T>(args: CallToolArgs<T>): Promise<CallToolResult<T>> {
  const client = new Anthropic({
    apiKey: args.apiKey,
    maxRetries: args.maxRetries ?? 4,
  });

  let msg: Anthropic.Message;
  try {
    msg = await client.messages.create({
      model: args.model,
      max_tokens: args.maxTokens ?? 1500,
      tools: [args.tool],
      tool_choice: { type: "tool", name: args.tool.name },
      messages: [{ role: "user", content: args.prompt }],
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new AnthropicToolError("network", detail.slice(0, 300));
  }

  const toolBlock = msg.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === args.tool.name,
  );
  if (!toolBlock) {
    throw new AnthropicToolError(
      "no_tool_use",
      `stop_reason=${msg.stop_reason ?? "unknown"}`,
    );
  }

  const parsed = args.schema.safeParse(toolBlock.input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}:${i.code}`)
      .join("|");
    throw new AnthropicToolError("schema_mismatch", issues);
  }

  return {
    data: parsed.data,
    tokensIn: msg.usage?.input_tokens ?? 0,
    tokensOut: msg.usage?.output_tokens ?? 0,
  };
}
