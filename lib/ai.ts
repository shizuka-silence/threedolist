import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { AiPrepParts } from "@/lib/task-rules";

// Raw model output: callers must pass it through normalizeAiPrepOutput (the model may ignore the 2-4 / 2-3 bounds).
// Only the selected parts are requested, so the user never pays for output they did not ask for.
export async function generateTaskPrep(task: { title: string; notes: string | null }, parts: AiPrepParts) {
  const schema = z.object({
    ...(parts.estimate && {
      estimated_minutes: z.number().describe("Realistic minutes to finish the whole task, including the final submit step"),
    }),
    ...(parts.pitfalls && {
      pitfalls: z.array(z.string()).describe("2-4 common traps or last-step mistakes, each one short sentence"),
    }),
    ...(parts.questions && {
      clarifying_questions: z.array(z.string()).describe("2-3 high-leverage questions that resolve ambiguity before starting"),
    }),
  });
  const openai = createOpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
  const { object } = await generateObject({
    model: openai.chat(process.env.LLM_MODEL!),
    schema,
    prompt: `Pre-mortem for a to-do item.
Title: ${task.title}
Notes: ${task.notes ?? "(none)"}`,
  });
  return object;
}

// Raw model output: callers must pass `items` through normalizeParsedTriageItems.
export async function parseEmailBatchToTriageItems(batchText: string) {
  const schema = z.object({
    items: z.array(
      z.object({
        category: z.enum(["announcement", "requirement", "opportunity", "reply"]),
        emailNumber: z.number().describe("The N from the '--- Email N ---' header this item came from; for merged items, the latest email"),
        sourceSubject: z.string().describe("Short title for this item"),
        summary: z.string().describe("One or two sentences, including any deadline"),
        suggestedAction: z.string().describe("Concrete next step, e.g. 'Reply Yes/No to Sam'"),
      }),
    ),
  });
  const openai = createOpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
  const { object } = await generateObject({
    model: openai.chat(process.env.LLM_MODEL!),
    schema,
    prompt: `Sort this batch of emails (or pasted email dump) into triage items.
Merge follow-ups and corrections about the same topic into ONE item that reflects the latest information.
Categories: announcement (FYI, nothing to do), requirement (a task or deadline I must meet), opportunity (optional event/offer I may want to RSVP to), reply (someone is waiting for my answer).

${batchText}`,
  });
  return object;
}
