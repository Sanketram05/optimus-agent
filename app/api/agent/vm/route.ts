import { AgentConfig, AgentVmSessions, db } from "@/db";
import { getOrCreateAgentDesktop, pauseAgentDesktop, startAgentDesktopStream, touchAgentDesktop, VM_DESKTOP_IDLE_TIMEOUT_MS } from "@/lib/agent-vm-desktop";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

async function getOwnedSession(agentId: string, userEmail: string) {
  const [agent] = await db.select({ agentId: AgentConfig.agentId, isActive: AgentConfig.isActive })
    .from(AgentConfig)
    .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, userEmail)));
  if (!agent) return null;

  const [vmSession] = await db.select().from(AgentVmSessions)
    .where(and(eq(AgentVmSessions.agentId, agentId), eq(AgentVmSessions.userEmail, userEmail)));
  return vmSession ?? null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });

  try {
    const vmSession = await getOwnedSession(agentId, session.user.email);
    if (vmSession?.status === "running" && Date.now() - vmSession.lastActivityAt.getTime() >= VM_DESKTOP_IDLE_TIMEOUT_MS) {
      const state = await pauseAgentDesktop(
        agentId,
        vmSession.sandboxId,
        session.user.email,
        new Date(Date.now() - VM_DESKTOP_IDLE_TIMEOUT_MS),
      );
      return NextResponse.json({ configured: state !== "not-created", status: state });
    }
    return NextResponse.json({ configured: Boolean(vmSession), status: vmSession?.status ?? "not-created" });
  } catch (error) {
    console.error("Unable to get VM status", error);
    return NextResponse.json({ error: "Unable to get VM status" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { agentId, action } = await req.json();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (typeof agentId !== "string" || !["activate", "touch", "pause"].includes(action)) {
    return NextResponse.json({ error: "agentId and a valid action are required" }, { status: 400 });
  }

  try {
    const existing = await getOwnedSession(agentId, session.user.email);
    // getOwnedSession returns null for both a missing agent and a missing VM. Verify the agent before creating.
    const [agent] = await db.select({ agentId: AgentConfig.agentId, isActive: AgentConfig.isActive }).from(AgentConfig)
      .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, session.user.email)));
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    if (!agent.isActive && action === "activate") {
      return NextResponse.json({ error: "This agent is paused. Resume it from Agent settings first." }, { status: 409 });
    }
    if (!existing && action !== "activate") return NextResponse.json({ status: "not-created" });

    if (action === "pause" && existing) {
      const status = await pauseAgentDesktop(agentId, existing.sandboxId, session.user.email);
      return NextResponse.json({ status });
    }

    if (action === "touch" && existing) {
      await touchAgentDesktop(agentId, session.user.email);
      return NextResponse.json({ status: existing.status });
    }

    const { desktop } = await getOrCreateAgentDesktop(agentId, session.user.email);
    const streamUrl = await startAgentDesktopStream(desktop);

    return NextResponse.json({ status: "running", streamUrl });
  } catch (error) {
    console.error("Unable to manage VM session", error);
    const message = error instanceof Error && error.message.includes("E2B_API_KEY")
      ? "E2B is not configured. Add E2B_API_KEY to .env and restart the app."
      : "Unable to start the VM desktop. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
