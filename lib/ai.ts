import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const prepSchema = z.object({
  estimated_minutes: z.number().describe("Realistic minutes to finish the whole task, including the final submit step"),
  pitfalls: z.array(z.string()).describe("2-4 common traps or last-step mistakes, each one short sentence"),
  clarifying_questions: z.array(z.string()).describe("2-3 high-leverage questions that resolve ambiguity before starting"),
});

// Raw model output: callers must pass it through normalizeAiPrepOutput (the model may ignore the 2-4 / 2-3 bounds).
export async function generateTaskPrep(task: { title: string; notes: string | null }) {
  const openai = createOpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
  const { object } = await generateObject({
    model: openai.chat(process.env.LLM_MODEL!),
    schema: prepSchema,
    prompt: `Pre-mortem for a to-do item.\nTitle: ${task.title}\nNotes: ${task.notes ?? "(none)"}`,
  });
  return object;
}
