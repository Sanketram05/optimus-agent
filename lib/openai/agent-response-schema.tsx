import { z } from "zod";

export const toolSuggestionSchema = z.object({
  slug: z.string(),
  reason: z.string(),
});

export const routineSchema = z.object({
  name: z.string(),
  goal: z.string(),

  instructions: z.string(),

  schedule: z.object({
    startDate: z.string(), 
    time: z.string(), 
    timezone: z.string(),
    frequency: z.enum(["once", "daily", "weekly", "monthly"]),
    weekDays: z.array(
      z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"])
    ),
  }),

  tools: z.array(toolSuggestionSchema),
});

export const agentResponseSchema = z.object({
  type: z.enum(["message", "clarification", "routine", "tool_connection"]),
  message: z.string(),
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
    })
  ),
  routine: routineSchema.nullable(),
  suggestedTools: z.array(toolSuggestionSchema).default([]),
  connectedTools: z.array(toolSuggestionSchema).default([]),
});

export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type RoutineDraft = z.infer<typeof routineSchema>;
export type ToolSuggestion = z.infer<typeof toolSuggestionSchema>;
