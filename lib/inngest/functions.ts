import { and, eq, lt, lte } from "drizzle-orm";
import { AgentChatHistory, AgentConfig, AgentVmSessions, db, RoutineExecutions, Routines, Tools } from "@/db";
import { executeRoutineAgent } from "@/lib/openai/openai-agent";
import { pauseAgentDesktop, VM_DESKTOP_IDLE_TIMEOUT_MS } from "@/lib/agent-vm-desktop";
import { RoutineSchedule, calculateNextRunAt } from "@/lib/routines/next-run";
import { getActiveConnectedAccounts, getOrCreateAgentSession } from "@/lib/composio/service";
import { AgentConfigType } from "@/type/Agent";
import type { VmTaskOutcome } from "@/lib/openai/vm-desktop-agent";
import { inngest } from "./client";

type RoutineExecutionData = { executionId: string; routineId: string; scheduledFor: string };

async function appendRoutineResultToChat(
  agentId: string,
  userEmail: string,
  executionId: string,
  routineName: string,
  result: { output: unknown; vmTask: VmTaskOutcome | null },
) {
  const [history] = await db.select().from(AgentChatHistory)
    .where(and(eq(AgentChatHistory.agentId, agentId), eq(AgentChatHistory.userEmail, userEmail)));
  const existing = Array.isArray(history?.messages) ? history.messages as Array<Record<string, unknown>> : [];
  const messageId = `routine-execution-${executionId}`;
  const status = result.vmTask?.status === "needs_user_login" ? "waiting for your login"
    : result.vmTask?.status === "failed" ? "completed with a VM error" : "completed";
  const output = typeof result.output === "string" ? result.output : JSON.stringify(result.output);
  const vmDetails = result.vmTask
    ? `\n\nVM desktop (${result.vmTask.status.replaceAll("_", " ")}): ${result.vmTask.summary}${result.vmTask.details.length ? `\n${result.vmTask.details.map((detail) => `- ${detail}`).join("\n")}` : ""}${result.vmTask.userAction ? `\n\n${result.vmTask.userAction}` : result.vmTask.status === "needs_user_login" ? "\n\nOpen this agent's Preview tab, click Open/Resume VM Desktop, sign in yourself, then ask the agent to continue." : ""}`
    : "";
  const entry = { id: messageId, role: "agent", content: `Routine “${routineName}” ${status}.\n\n${output}${vmDetails}`, time: new Date().toISOString(), savedAt: new Date().toISOString() };
  const messages = [...existing.filter((message) => message.id !== messageId), entry].filter((message) => new Date(String(message.savedAt ?? message.time)).getTime() >= Date.now() - 3 * 24 * 60 * 60 * 1000);
  await db.insert(AgentChatHistory).values({ agentId, userEmail, messages, updatedAt: new Date() })
    .onConflictDoUpdate({ target: AgentChatHistory.agentId, set: { userEmail, messages, updatedAt: new Date() } });
}

/** Hourly poller: atomically claims each eligible routine before durable enqueueing. */
export const routineScheduler = inngest.createFunction(
  { id: "routine-scheduler", name: "Routine scheduler" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    await step.run("purge-expired-chat-history", async () => {
      await db.delete(AgentChatHistory).where(lt(AgentChatHistory.updatedAt, new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)));
    });
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

export const vmDesktopIdleScheduler = inngest.createFunction(
  { id: "vm-desktop-idle-scheduler", name: "Pause inactive VM desktops" },
  { cron: "* * * * *" },
  async ({ step }) => {
    const inactiveBefore = new Date(Date.now() - VM_DESKTOP_IDLE_TIMEOUT_MS);
    const sessions = await step.run("find-inactive-vm-desktops", () => db.select({
      agentId: AgentVmSessions.agentId,
      userEmail: AgentVmSessions.userEmail,
      sandboxId: AgentVmSessions.sandboxId,
    }).from(AgentVmSessions).where(and(
      eq(AgentVmSessions.status, "running"),
      lt(AgentVmSessions.lastActivityAt, inactiveBefore),
    )));
    const results = await step.run("pause-inactive-vm-desktops", async () => {
      let paused = 0;
      for (const session of sessions) {
        const result = await pauseAgentDesktop(
          session.agentId,
          session.sandboxId,
          session.userEmail,
          inactiveBefore,
        );
        if (result === "paused") paused += 1;
      }
      return paused;
    });
    return { paused: results };
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
    if (!execution || execution.routineId !== routineId || ["completed", "failed", "needs_user_login"].includes(execution.status)) {
      return { skipped: true };
    }

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
        const result = await executeRoutineAgent(
          agent.name,
          agent.description ?? "",
          routine.name,
          routine.goal,
          routine.instructions,
          composioTools,
          (routine.schedule as RoutineSchedule).timezone,
          { agentId: agent.agentId, userEmail: agent.userEmail },
        );
        return {
          ...result,
          agentId: agent.agentId,
          userEmail: agent.userEmail,
          routineName: routine.name,
          connectedTools: catalog.filter((tool) => connectedSlugs.includes(tool.slug)).map((tool) => tool.slug),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown execution error";
        await db.update(RoutineExecutions).set({ status: "failed", error: message, completedAt: new Date() })
          .where(eq(RoutineExecutions.id, executionId));
        throw error;
      }
    });
    await step.run("mark-execution-completed", async () => {
      const status = result.vmTask?.status === "needs_user_login" ? "needs_user_login"
        : result.vmTask?.status === "failed" ? "failed" : "completed";
      await db.update(RoutineExecutions).set({ status, result, error: null, completedAt: new Date() })
        .where(eq(RoutineExecutions.id, executionId));
      // Always retain a user-visible result in the agent chat. External tool
      // delivery is additive, not a replacement for the execution summary.
      await appendRoutineResultToChat(result.agentId, result.userEmail, executionId, result.routineName, result);
    });
    return { executionId, status: result.vmTask?.status ?? "completed" };
  },
);
