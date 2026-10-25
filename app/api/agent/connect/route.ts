import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "../../auth/[...nextauth]/route";
import { AgentConfig, db, Tools } from "@/db";
import { composio } from "@/lib/composio/composio";
import { getActiveConnectedAccounts } from "@/lib/composio/service";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, toolSlug } = await req.json();
  if (typeof agentId !== "string" || typeof toolSlug !== "string") {
    return NextResponse.json({ error: "agentId and toolSlug are required" }, { status: 400 });
  }

  const [agentConfig] = await db
    .select()
    .from(AgentConfig)
    .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, session.user.email)));
  const [tool] = await db
    .select()
    .from(Tools)
    .where(and(eq(Tools.slug, toolSlug), eq(Tools.isActive, true)));

  if (!agentConfig || !tool) {
    return NextResponse.json({ error: "Agent or tool not found" }, { status: 404 });
  }

  const activeAccounts = await getActiveConnectedAccounts(session.user.email, [toolSlug]);
  if (activeAccounts[toolSlug.toLowerCase()]?.length) {
    return NextResponse.json({ connected: true });
  }

  const authConfigs = await composio.authConfigs.list({ toolkit: toolSlug });
  const authConfig = authConfigs.items[0] ?? await composio.authConfigs.create(toolSlug, {
    type: "use_composio_managed_auth",
  });

  const configuredTools = Array.isArray(agentConfig.tools) ? agentConfig.tools : [];
  await db
    .update(AgentConfig)
    .set({
      tools: configuredTools.includes(toolSlug) ? configuredTools : [...configuredTools, toolSlug],
    })
    .where(eq(AgentConfig.agentId, agentConfig.agentId));

  const callbackUrl = new URL(`/workspace/${agentId}`, req.url).toString();
  const connection = await composio.connectedAccounts.link(
    session.user.email,
    authConfig.id,
    { callbackUrl }
  );

  return NextResponse.json({ redirectUrl: connection.redirectUrl });
}
