import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "../../auth/[...nextauth]/route";
import { AgentConfig, db, Tools } from "@/db";
import { composio } from "@/lib/composio/composio";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, toolSlug } = await req.json();
  if (typeof agentId !== "string" || typeof toolSlug !== "string") {
    return NextResponse.json({ error: "agentId and toolSlug are required" }, { status: 400 });
  }

  const [[agentConfig], [tool]] = await Promise.all([
    db.select().from(AgentConfig).where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, session.user.email))),
    db.select().from(Tools).where(and(eq(Tools.slug, toolSlug), eq(Tools.isActive, true))),
  ]);
  if (!agentConfig || !tool) {
    return NextResponse.json({ error: "Agent or tool not found" }, { status: 404 });
  }

  const accounts = await composio.connectedAccounts.list({
    userIds: [session.user.email],
    toolkitSlugs: [toolSlug],
    statuses: ["ACTIVE"],
  });
  await Promise.all(accounts.items.map((account) => composio.connectedAccounts.disable(account.id)));

  return NextResponse.json({ toolSlug, connected: false });
}
