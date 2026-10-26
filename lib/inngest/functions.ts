import { and, eq, lte } from "drizzle-orm";
import { AgentConfig, db, RoutineExecutions, Routines, Tools } from "@/db";
import { executeRoutineAgent } from "@/lib/openai/openai-agent";
import { RoutineSchedule, calculateNextRunAt } from "@/lib/routines/next-run";
import { getActiveConnectedAccounts, getOrCreateAgentSession } from "@/lib/composio/service";
import { AgentConfigType } from "@/type/Agent";
import { inngest } from "./client";

type RoutineExecutionData = { executionId: string; routineId: string; scheduledFor: string };

/** Hourly poller: atomically claims each eligible routine before durable enqueueing. */
export const routineScheduler = inngest.createFunction(
  { id: "routine-scheduler", name: "Routine scheduler" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    const windowEnd = new Date(Date.now() + 60 * 60 * 1000);
    const claims = await step.run("claim-routines-in-next-hour", async () => {
      const candidates = await db.select().from(Routines)
        .where(and(eq(Routines.isActive, true), lte(Routines.nextRunAt, windowEnd)));
      const claimed: RoutineExecutionData[] = [];
      for (const routine of candidates) {
        if (!routine.nextRunAt) continue;
        const scheduledFor = routine.nextRunAt;
        const executionId = crypto.randomUUID();
        const [execution] = await db.insert(RoutineExecutions).values({
          id: executionId, routineId: routine.id, scheduledFor, status: "queued",
        }).onConflictDoNothing().returning();

        // Always heal a stale next_run_at after a prior claim, even if a worker
        // crashed between claiming it and advancing the recurrence. Only the
        // creator below sends an event, so this cannot create a duplicate run.
        const nextRunAt = calculateNextRunAt(routine.schedule as RoutineSchedule, new Date(scheduledFor.getTime() + 1));
        await db.update(Routines).set({ nextRunAt })
          .where(and(eq(Routines.id, routine.id), eq(Routines.nextRunAt, scheduledFor)));
        if (!execution) continue;
        claimed.push({ executionId, routineId: routine.id, scheduledFor: scheduledFor.toISOString() });
      }
      return claimed;
    });
    if (claims.length) {
      await step.sendEvent("enqueue-routine-executions", claims.map((data) => ({ name: "routine/execution.queued" as const, data })));
    }
    return { queued: claims.length, checkedUntil: windowEnd.toISOString() };
  },
);

/** One durable execution: wait to the exact instant, run tools, then persist result/status. */
export const executeRoutine = inngest.createFunction(
  { id: "execute-routine", name: "Execute routine", retries: 3 },
  { event: "routine/execution.queued" },
  async ({ event, step }) => {
    const { executionId, routineId, scheduledFor } = event.data as RoutineExecutionData;
    const execution = await step.run("load-queued-execution", async () => {
      const [record] = await db.select().from(RoutineExecutions).where(eq(RoutineExecutions.id, executionId));
      return record ?? null;
    });
    if (!execution || execution.routineId !== routineId || execution.status === "completed") return { skipped: true };

    await step.sleepUntil("wait-for-scheduled-time", new Date(scheduledFor));
    const result = await step.run("execute-agent-workflow", async () => {
      const [routine] = await db.select().from(Routines).where(eq(Routines.id, routineId));
      const [agent] = routine ? await db.select().from(AgentConfig).where(eq(AgentConfig.agentId, routine.agentId)) : [];
      if (!routine || !agent || !routine.isActive) throw new Error("Routine or agent is no longer available");

      await db.update(RoutineExecutions).set({ status: "running", startedAt: new Date(), error: null })
        .where(eq(RoutineExecutions.id, executionId));
      try {
        const configuredSlugs = Array.isArray(agent.tools) ? agent.tools.filter((slug): slug is string => typeof slug === "string") : [];
        const accounts = await getActiveConnectedAccounts(agent.userEmail, configuredSlugs);
        const connectedSlugs = configuredSlugs.filter((slug) => accounts[slug.toLowerCase()]?.length);
        const session = connectedSlugs.length ? await getOrCreateAgentSession(agent as AgentConfigType, agent.userEmail) : null;
        const composioTools = session ? await session.tools() : [];
        const catalog = connectedSlugs.length ? await db.select().from(Tools).where(eq(Tools.isActive, true)) : [];
        const output = await executeRoutineAgent(agent.name, agent.description ?? "", routine.name, routine.goal, routine.instructions, composioTools, (routine.schedule as RoutineSchedule).timezone);
        return { output, connectedTools: catalog.filter((tool) => connectedSlugs.includes(tool.slug)).map((tool) => tool.slug) };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown execution error";
        await db.update(RoutineExecutions).set({ status: "failed", error: message, completedAt: new Date() })
          .where(eq(RoutineExecutions.id, executionId));
        throw error;
      }
    });
    await step.run("mark-execution-completed", async () => {
      await db.update(RoutineExecutions).set({ status: "completed", result, error: null, completedAt: new Date() })
        .where(eq(RoutineExecutions.id, executionId));
    });
    return { executionId, status: "completed" };
  },
);
