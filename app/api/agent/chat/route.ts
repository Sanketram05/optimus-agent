import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { AgentChatHistory, AgentConfig, db, Routines, Tools } from "@/db";
import { and, eq } from "drizzle-orm";
import { executeAgentChat } from "@/lib/openai/openai-agent";
import { getActiveConnectedAccounts, getOrCreateAgentSession } from "@/lib/composio/service";
import { AgentConfigType } from "@/type/Agent";
import { queueRoutineNow } from "@/lib/routines/queue";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const {agentId,messages, timezone} = await req.json();

    if(!session?.user?.email) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    if(!agentId || !messages) {
        return NextResponse.json({error: "Missing agentId or messages"}, {status: 400});
    }

    let agentComposioTools:any[] = [];

    const agentConfigs = await db.select().from(AgentConfig)
    .where(
        and(
            eq(AgentConfig.agentId, agentId),
            eq(AgentConfig.userEmail, session.user.email)
        )
    )    

    const agentConfig = agentConfigs[0];

    if (!agentConfig) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const configuredToolSlugs = Array.isArray(agentConfig.tools)
        ? agentConfig.tools.filter((tool): tool is string => typeof tool === "string")
        : [];
    const activeConnectedAccounts = await getActiveConnectedAccounts(
        session.user.email,
        configuredToolSlugs
    );
    const connectedToolSlugs = configuredToolSlugs.filter(
        (slug) => activeConnectedAccounts[slug.toLowerCase()]?.length
    );

    if (connectedToolSlugs.length) {
        const composioSession = await getOrCreateAgentSession(agentConfig as AgentConfigType, session.user.email);
        agentComposioTools = await composioSession.tools();
    }
    
    const tools = await db.select().from(Tools).where(eq(Tools.isActive,true));
    const routines = await db.select({ id: Routines.id, name: Routines.name, goal: Routines.goal }).from(Routines)
      .where(and(eq(Routines.agentId, agentId), eq(Routines.userEmail, session.user.email), eq(Routines.isActive, true)));
     
    const toolsCatalog=tools.map((tool) => ({
        slug: tool.slug,
        name: tool.name,
        description: tool.description
    }))

    const response = await executeAgentChat(
        agentConfig.name,
        agentConfig.description ?? "",
        messages,
        agentComposioTools,
        toolsCatalog,
        timezone,
        connectedToolSlugs,
        routines,
        { agentId, userEmail: session.user.email },
    );

    // The model can vary a toolkit slug's casing despite being given the catalog.
    // Use the database/catalog spelling for all downstream connection requests.
    if (response) {
        const canonicalSlug = new Map(toolsCatalog.map((tool) => [tool.slug.toLowerCase(), tool.slug]));
        const normalizeSuggestions = (suggestions: typeof response.suggestedTools) => suggestions.map((suggestion) => ({
            ...suggestion,
            slug: canonicalSlug.get(suggestion.slug.toLowerCase()) ?? suggestion.slug,
        }));
        response.suggestedTools = normalizeSuggestions(response.suggestedTools);
        response.connectedTools = normalizeSuggestions(response.connectedTools);
        if (response.routine) {
            response.routine.tools = normalizeSuggestions(response.routine.tools);
        }
    }

    if (response?.type === "routine_run" && response.routineAction?.routineId) {
        try {
            const queued = await queueRoutineNow(response.routineAction.routineId, session.user.email);
            response.message = queued.alreadyQueued
              ? `${response.message}\n\nThat routine is already queued or running.`
              : `${response.message}\n\nThe routine has been queued to run now.`;
        } catch (error) {
            response.type = "message";
            response.routineAction = null;
            response.message = error instanceof Error ? error.message : "Unable to queue the routine.";
        }
    }

    console.log("[Agent Chat API] Structured agent response:", {
        type: response?.type,
        response,
        suggestedTools: response?.suggestedTools ?? [],
        connectedTools: response?.connectedTools ?? [],
        routine: response?.routine ?? null,
        connectedToolSlugs,
    });

    let ToolsConnection: Array<(typeof tools)[number] & { isConnected: boolean }> = [];
    
    if(response?.routine || response?.suggestedTools?.length || response?.connectedTools?.length){
        const suggestedSlugs = [
            ...(response.routine?.tools.map((tool) => tool.slug) ?? []),
            ...response.suggestedTools.map((tool) => tool.slug),
            ...response.connectedTools.map((tool) => tool.slug),
        ];
        const activeAccounts = await getActiveConnectedAccounts(
            session.user.email,
            suggestedSlugs
        );
        ToolsConnection = tools
            .filter((tool) => suggestedSlugs.includes(tool.slug))
            .map((tool) => ({
                ...tool,
                // A user's account may be connected globally, but it is only
                // connected for this agent once the agent enables that toolkit.
                isConnected: connectedToolSlugs.includes(tool.slug),
            }));
    }

    const agentMessageId = crypto.randomUUID();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const now = new Date().toISOString();
    const history = [...messages, { id: agentMessageId, role: "agent", content: response?.message ?? "", response: response ?? null, toolsCards: ToolsConnection, time: now, savedAt: now }]
        .map((message) => ({ ...message, savedAt: message.savedAt ?? now }))
        .filter((message) => new Date(message.savedAt).getTime() >= threeDaysAgo.getTime());
    await db.insert(AgentChatHistory).values({ agentId, userEmail: session.user.email, messages: history, updatedAt: new Date() })
        .onConflictDoUpdate({ target: AgentChatHistory.agentId, set: { userEmail: session.user.email, messages: history, updatedAt: new Date() } });
    return NextResponse.json({response, ToolsConnection, agentMessageId});
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    const [history] = await db.select().from(AgentChatHistory).where(and(eq(AgentChatHistory.agentId, agentId), eq(AgentChatHistory.userEmail, session.user.email)));
    return NextResponse.json({ messages: Array.isArray(history?.messages) ? history.messages : [] });
}
