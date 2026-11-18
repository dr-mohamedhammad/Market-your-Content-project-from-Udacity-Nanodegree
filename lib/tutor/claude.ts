import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export class TutorError extends Error {
  constructor(message: string, public status = 500, public code = "tutor_error") {
    super(message);
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new TutorError("The tutor is not configured yet: set ANTHROPIC_API_KEY on the server (see README).", 503, "not_configured");
  }
  // maxRetries: the SDK retries 408/409/429/5xx and connection errors with backoff.
  client ??= new Anthropic({ maxRetries: 3, timeout: 120_000 });
  return client;
}

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const CHAT_EFFORT = (process.env.CLAUDE_CHAT_EFFORT as Effort) || "low";
const ANALYSIS_EFFORT = (process.env.CLAUDE_ANALYSIS_EFFORT as Effort) || "medium";

// Server-side refusal fallback is supported on these models; Haiku models have none.
const FALLBACK_MODELS = ["claude-opus-5-5", "claude-opus-5", "claude-fable-5-2", "claude-fable-5-1", "claude-sonnet-5-5"];
const useFallbacks = process.env.CLAUDE_FALLBACKS !== "off" && FALLBACK_MODELS.includes(MODEL);

export interface CallOptions<S extends z.ZodType> {
  system: { text: string; cache?: boolean }[];
  messages: Anthropic.Beta.BetaMessageParam[];
  schema: S;
  kind: "chat" | "analysis";
  maxTokens?: number;
}

/** One structured call to Claude. Returns data validated against the Zod schema. */
export async function callClaude<S extends z.ZodType>(opts: CallOptions<S>): Promise<z.infer<S>> {
  const anthropic = getClient();
  try {
    const res = await anthropic.beta.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? (opts.kind === "chat" ? 6000 : 14000),
      system: opts.system.map((b) => ({
        type: "text" as const,
        text: b.text,
        ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
      })),
      messages: opts.messages,
      // Caches the growing conversation, so each new turn only pays for the newest messages.
      cache_control: { type: "ephemeral" },
      output_config: {
        effort: opts.kind === "chat" ? CHAT_EFFORT : ANALYSIS_EFFORT,
        format: betaZodOutputFormat(opts.schema),
      },
      ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });

    if (res.stop_reason === "refusal") {
      throw new TutorError("The tutor couldn't respond to that message. Try rephrasing it.", 422, "refusal");
    }
    if (res.stop_reason === "max_tokens") {
      throw new TutorError("The tutor's answer was cut off. Please try again.", 502, "truncated");
    }
    if (res.parsed_output == null) {
      throw new TutorError("The tutor's answer could not be read. Please try again.", 502, "bad_output");
    }
    return res.parsed_output as z.infer<S>;
  } catch (e) {
    throw mapError(e);
  }
}

function mapError(e: unknown): Error {
  if (e instanceof TutorError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new TutorError("The Anthropic API key is invalid. Check ANTHROPIC_API_KEY.", 503, "auth");
  if (e instanceof Anthropic.PermissionDeniedError) return new TutorError("This API key can't use the selected model. Check CLAUDE_MODEL.", 503, "permission");
  if (e instanceof Anthropic.NotFoundError) return new TutorError(`Model "${MODEL}" was not found. Check CLAUDE_MODEL.`, 503, "model");
  if (e instanceof Anthropic.RateLimitError) return new TutorError("The tutor is busy right now (rate limit). Wait a few seconds and try again.", 429, "rate_limit");
  if (e instanceof Anthropic.BadRequestError) {
    const msg = e.message.toLowerCase();
    if (msg.includes("credit") || msg.includes("billing")) return new TutorError("Your Anthropic account has no credit left. Add credit in the Anthropic Console.", 402, "billing");
    console.error("[tutor] bad request:", e.message);
    return new TutorError("The tutor request was rejected. Please try again.", 400, "bad_request");
  }
  if (e instanceof Anthropic.APIConnectionError) return new TutorError("Can't reach the AI service. Check your internet connection.", 503, "connection");
  if (e instanceof Anthropic.InternalServerError) return new TutorError("The AI service is temporarily unavailable. Try again in a moment.", 503, "overloaded");
  if (e instanceof Anthropic.APIError) {
    console.error("[tutor] API error:", e.status, e.message);
    return new TutorError("The AI service returned an error. Please try again.", 502, "api_error");
  }
  console.error("[tutor] unexpected error:", e);
  return new TutorError("Something went wrong. Please try again.", 500, "unknown");
}
