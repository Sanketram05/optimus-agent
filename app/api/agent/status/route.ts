import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "../../auth/[...nextauth]/route";
import { AgentConfig, db, Tools } from "@/db";
import { getActiveConnectedAccounts } from "@/lib/composio/service";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = req.nextUrl.searchParams.get("agentId");
  const toolSlug = req.nextUrl.searchParams.get("toolSlug");
  if (!agentId || !toolSlug) {
    return NextResponse.json({ error: "agentId and toolSlug are required" }, { status: 400 });
  }

  const [[agentConfig], [tool]] = await Promise.all([
    db.select().from(AgentConfig).where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, session.user.email))),
    db.select().from(Tools).where(and(eq(Tools.slug, toolSlug), eq(Tools.isActive, true))),
  ]);
  if (!agentConfig || !tool) {
    return NextResponse.json({ error: "Agent or tool not found" }, { status: 404 });
  }

  const activeAccounts = await getActiveConnectedAccounts(session.user.email, [toolSlug]);
  const connected = Boolean(activeAccounts[toolSlug.toLowerCase()]?.length);

  if (connected) {
    const configuredTools = Array.isArray(agentConfig.tools) ? agentConfig.tools : [];
    if (!configuredTools.includes(toolSlug)) {
      await db
        .update(AgentConfig)
        .set({ tools: [...configuredTools, toolSlug] })
        .where(eq(AgentConfig.agentId, agentConfig.agentId));
    }
  }

  return NextResponse.json({
    toolSlug,
    connected,
  });
}
