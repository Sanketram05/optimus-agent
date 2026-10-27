import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { AgentConfig, db, Tools } from "@/db";
import { composio } from "@/lib/composio/composio";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userEmail = session.user.email;

  const tools = await db.select().from(Tools).where(eq(Tools.isActive, true));
  const accounts = tools.length ? await composio.connectedAccounts.list({
    userIds: [userEmail],
    toolkitSlugs: tools.map((tool) => tool.slug),
    statuses: ["ACTIVE"],
  }) : { items: [] };
  const connectedSlugs = new Set(accounts.items
    .map((account) => account.toolkit?.slug?.toLowerCase())
    .filter((slug): slug is string => Boolean(slug)));
  return NextResponse.json({
    tools: tools.map((tool) => ({
      ...tool,
      connected: connectedSlugs.has(tool.slug.toLowerCase()),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userEmail = session.user.email;

  const body: unknown = await req.json();
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "A valid action and toolSlug are required" }, { status: 400 });
  }
  const { action, toolSlug, agentId } = body as { action?: unknown; toolSlug?: unknown; agentId?: unknown };
  if ((action !== "connect" && action !== "disconnect") || typeof toolSlug !== "string" ||
      (agentId !== undefined && typeof agentId !== "string")) {
    return NextResponse.json({ error: "A valid action and toolSlug are required" }, { status: 400 });
  }

  const [tool] = await db.select().from(Tools)
    .where(and(eq(Tools.slug, toolSlug), eq(Tools.isActive, true)));
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  if (agentId) {
    const [agent] = await db.select().from(AgentConfig)
      .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, session.user.email)));
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const enableForAgent = async () => {
    if (!agentId) return;
    const [agent] = await db.select().from(AgentConfig)
      .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, userEmail)));
    if (!agent) return;
    const configuredTools = Array.isArray(agent.tools) ? agent.tools : [];
    if (!configuredTools.includes(tool.slug)) {
      await db.update(AgentConfig).set({ tools: [...configuredTools, tool.slug] })
        .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, userEmail)));
    }
  };

  if (action === "disconnect") {
    const accounts = await composio.connectedAccounts.list({
      userIds: [userEmail],
      toolkitSlugs: [tool.slug],
      statuses: ["ACTIVE"],
    });
    await Promise.all(accounts.items.map((account) => composio.connectedAccounts.disable(account.id)));
    return NextResponse.json({ toolSlug: tool.slug, connected: false });
  }

  const activeAccounts = await composio.connectedAccounts.list({
    userIds: [userEmail],
    toolkitSlugs: [tool.slug],
    statuses: ["ACTIVE"],
  });
  if (activeAccounts.items.some((account) => account.toolkit?.slug?.toLowerCase() === tool.slug.toLowerCase())) {
    await enableForAgent();
    return NextResponse.json({ connected: true });
  }

  const authConfigs = await composio.authConfigs.list({ toolkit: tool.slug });
  const authConfig = authConfigs.items[0] ?? await composio.authConfigs.create(tool.slug, {
    type: "use_composio_managed_auth",
  });
  const callbackPath = typeof agentId === "string" ? `/workspace/${encodeURIComponent(agentId)}` : "/workspace";
  const callbackUrl = new URL(callbackPath, req.url).toString();
  const connection = await composio.connectedAccounts.link(
    userEmail,
    authConfig.id,
    { callbackUrl }
  );

  await enableForAgent();
  return NextResponse.json({ redirectUrl: connection.redirectUrl });
}
