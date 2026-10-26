import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "../../auth/[...nextauth]/route";
import { AgentConfig, db, Tools } from "@/db";
import { getActiveConnectedAccounts } from "@/lib/composio/service";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });

  const [agent] = await db.select().from(AgentConfig)
    .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, session.user.email)));
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const tools = await db.select().from(Tools).where(eq(Tools.isActive, true));
  const accounts = await getActiveConnectedAccounts(session.user.email, tools.map((tool) => tool.slug));
  const configured = Array.isArray(agent.tools) ? agent.tools : [];
  return NextResponse.json({
    tools: tools.map((tool) => ({
      ...tool,
      connected: Boolean(accounts[tool.slug.toLowerCase()]?.length),
      enabled: configured.includes(tool.slug),
    })),
  });
}
