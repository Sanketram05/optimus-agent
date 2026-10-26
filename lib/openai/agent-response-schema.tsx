import { z } from "zod";

export const toolSuggestionSchema = z.object({
  slug: z.string(),
  reason: z.string(),
});

export const vmTaskSchema = z.object({
  status: z.enum(["completed", "needs_user_login", "blocked", "failed"]),
  summary: z.string(),
  details: z.array(z.string()),
  userAction: z.string().nullable(),
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
  type: z.enum(["message", "clarification", "routine", "routine_run", "tool_connection"]),
  message: z.string(),
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
    })
  ),
  routine: routineSchema.nullable(),
  routineAction: z.object({ action: z.literal("run"), routineId: z.string().nullable() }).nullable(),
  suggestedTools: z.array(toolSuggestionSchema).default([]),
  connectedTools: z.array(toolSuggestionSchema).default([]),
  vmTask: vmTaskSchema.nullable().default(null),
});

export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type RoutineDraft = z.infer<typeof routineSchema>;
export type ToolSuggestion = z.infer<typeof toolSuggestionSchema>;
export type VmTaskSummary = z.infer<typeof vmTaskSchema>;
