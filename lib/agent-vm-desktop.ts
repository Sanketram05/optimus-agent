import { AgentConfig, AgentVmSessions, db } from "@/db";
import { getDesktopSandbox } from "@/lib/e2b-desktop";
import { SandboxNotFoundError } from "@e2b/desktop";
import { and, eq, sql } from "drizzle-orm";
import type { Sandbox as DesktopSandboxInstance } from "@e2b/desktop";

export const VM_DESKTOP_IDLE_TIMEOUT_MS = 2 * 60 * 1000;

export async function getOrCreateAgentDesktop(agentId: string, userEmail: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`agent-vm:${agentId}`}))`);

    const [agent] = await tx.select({ agentId: AgentConfig.agentId })
      .from(AgentConfig)
      .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, userEmail)));
    if (!agent) throw new Error("Agent not found");

    const DesktopSandbox = getDesktopSandbox();
    const [savedSession] = await tx.select().from(AgentVmSessions)
      .where(and(eq(AgentVmSessions.agentId, agentId), eq(AgentVmSessions.userEmail, userEmail)));

    if (savedSession) {
      try {
        const desktop = await DesktopSandbox.connect(savedSession.sandboxId, {
          onResume: "restore",
          timeoutMs: VM_DESKTOP_IDLE_TIMEOUT_MS,
        });
        await DesktopSandbox.setTimeout(savedSession.sandboxId, VM_DESKTOP_IDLE_TIMEOUT_MS);
        const now = new Date();
        await tx.update(AgentVmSessions)
          .set({ status: "running", lastActivityAt: now, updatedAt: now })
          .where(eq(AgentVmSessions.agentId, agentId));
        return { desktop, sandboxId: savedSession.sandboxId };
      } catch (error) {
        if (!(error instanceof SandboxNotFoundError)) throw error;
        await tx.delete(AgentVmSessions).where(eq(AgentVmSessions.agentId, agentId));
      }
    }

    const desktop = await DesktopSandbox.create({
      timeoutMs: VM_DESKTOP_IDLE_TIMEOUT_MS,
      metadata: { agentId, userEmail },
      lifecycle: { onTimeout: { action: "pause", mode: "full" } },
    });
    const now = new Date();
    await tx.insert(AgentVmSessions).values({
      agentId,
      userEmail,
      sandboxId: desktop.sandboxId,
      status: "running",
      lastActivityAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: AgentVmSessions.agentId,
      set: { sandboxId: desktop.sandboxId, status: "running", lastActivityAt: now, updatedAt: now },
    });
    return { desktop, sandboxId: desktop.sandboxId };
  });
}

export async function touchAgentDesktop(agentId: string, userEmail: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`agent-vm:${agentId}`}))`);
    const [session] = await tx.select().from(AgentVmSessions)
      .where(and(eq(AgentVmSessions.agentId, agentId), eq(AgentVmSessions.userEmail, userEmail)));
    if (!session || session.status !== "running") return;

    await getDesktopSandbox().setTimeout(session.sandboxId, VM_DESKTOP_IDLE_TIMEOUT_MS);
    const now = new Date();
    await tx.update(AgentVmSessions)
      .set({ lastActivityAt: now, updatedAt: now })
      .where(eq(AgentVmSessions.agentId, agentId));
  });
}

export async function pauseAgentDesktop(
  agentId: string,
  sandboxId: string,
  userEmail: string,
  inactiveBefore?: Date,
): Promise<"paused" | "running" | "not-created"> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`agent-vm:${agentId}`}))`);
    const [session] = await tx.select().from(AgentVmSessions)
      .where(and(eq(AgentVmSessions.agentId, agentId), eq(AgentVmSessions.userEmail, userEmail)));
    if (!session || session.sandboxId !== sandboxId) return "not-created";
    if (inactiveBefore && session.lastActivityAt > inactiveBefore) return "running";

    const DesktopSandbox = getDesktopSandbox();
    try {
      const info = await DesktopSandbox.getInfo(sandboxId);
      if (info.state === "running") {
        await DesktopSandbox.pause(sandboxId, { mode: "full" });
      }
    } catch (error) {
      if (!(error instanceof SandboxNotFoundError)) throw error;
      await tx.delete(AgentVmSessions)
        .where(and(eq(AgentVmSessions.agentId, agentId), eq(AgentVmSessions.userEmail, userEmail)));
      return "not-created";
    }

    await tx.update(AgentVmSessions)
      .set({ status: "paused", updatedAt: new Date() })
      .where(and(eq(AgentVmSessions.agentId, agentId), eq(AgentVmSessions.userEmail, userEmail)));
    return "paused";
  });
}

export async function startAgentDesktopStream(desktop: DesktopSandboxInstance) {
  try {
    await desktop.stream.start({ requireAuth: true });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "Stream is already running") throw error;
    await desktop.stream.stop();
    await desktop.stream.start({ requireAuth: true });
  }

  return desktop.stream.getUrl({
    autoConnect: true,
    resize: "scale",
    authKey: desktop.stream.getAuthKey(),
  });
}
