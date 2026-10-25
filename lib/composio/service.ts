import { AgentConfigType } from "@/type/Agent";
import { composio } from "./composio";
import { AgentConfig, db } from "@/db";
import { eq } from "drizzle-orm";

export async function getOrCreateAgentSession(agentConfig:AgentConfigType, userEmail: string){
    const toolSlugs = Array.isArray(agentConfig.tools)
        ? agentConfig.tools.filter((tool): tool is string => typeof tool === "string")
        : [];
    const connectedAccounts = await getActiveConnectedAccounts(userEmail, toolSlugs);

    if(agentConfig?.composioSessionId){
        try {
            const session = await composio.sessions.use(agentConfig.composioSessionId);

            // Keep the same saved session, but refresh its tools and this user's active accounts.
            try {
                await session.update({
                    toolkits: toolSlugs,
                    connectedAccounts,
                });
            } catch (error) {
                console.error("Failed to refresh existing Composio session:", error);
            }

            return session;
        } catch (e) {
            console.warn("Saved Composio session is unavailable; creating a replacement session.");
        }
    }

    const session = await composio.sessions.create(userEmail,{
        toolkits: toolSlugs.length > 0 ? toolSlugs : undefined,
        connectedAccounts: Object.keys(connectedAccounts).length > 0 ? connectedAccounts : undefined,
    });

    await db.update(AgentConfig).set({
        composioSessionId: session.sessionId,
    }).where(eq(AgentConfig.agentId, agentConfig.agentId));

    console.log("Saved Composio session for agent:", {
        agentId: agentConfig.agentId,
        sessionId: session.sessionId,
    });

    return session;
}  

export const getActiveConnectedAccounts = async (
  userEmail: string,
  toolSlugs: string[]
) => {
  if (!toolSlugs || toolSlugs.length === 0) return {};

  try {
    const accounts = await composio.connectedAccounts.list({
      userIds: [userEmail],
      toolkitSlugs: toolSlugs,
      statuses: ["ACTIVE"],
    });

    return accounts.items.reduce(
      (acc: Record<string, string[]>, account: any) => {
        const slug = account?.toolkit?.slug?.toLowerCase();

        if (slug) {
          if (!acc[slug]) acc[slug] = [];
          acc[slug].push(account.id);
        }

        return acc;
      },
      {}
    );
  } catch (err) {
    console.error("Error fetching accounts:", err);
    return {};
  }
};
