import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { AgentConfig, db, Tools } from "@/db";
import { and, eq } from "drizzle-orm";
import { executeAgentChat } from "@/lib/openai/openai-agent";
import { getActiveConnectedAccounts, getOrCreateAgentSession } from "@/lib/composio/service";
import { AgentConfigType } from "@/type/Agent";

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

    if(agentConfig?.tools){
        //@ts-ignore
        const composioSession = await getOrCreateAgentSession(agentConfig, session.user?.email);
        agentComposioTools = await composioSession.tools();
    }
    
    const tools = await db.select().from(Tools).where(eq(Tools.isActive,true));
     
    const toolsCatalog=tools.map((tool) => ({
        slug: tool.slug,
        name: tool.name,
        description: tool.description
    }))

    const response = await executeAgentChat(agentConfig.name, agentConfig?.description??"", messages, agentComposioTools, toolsCatalog, timezone);

    console.log("[Agent Chat API] Structured agent response:", {
        type: response?.type,
        response,
        suggestedTools: response?.suggestedTools ?? [],
        routine: response?.routine ?? null,
    });

    let ToolsConnection: Array<(typeof tools)[number] & { isConnected: boolean }> = [];
    
    if(response?.routine || response?.suggestedTools?.length){
        const suggestedSlugs = response.routine?.tools.map((tool) => tool.slug)
            ?? response.suggestedTools.map((tool) => tool.slug);
        const activeAccounts = await getActiveConnectedAccounts(
            session.user.email,
            suggestedSlugs
        );
        ToolsConnection = tools
            .filter((tool) => suggestedSlugs.includes(tool.slug))
            .map((tool) => ({
                ...tool,
                isConnected: Boolean(activeAccounts[tool.slug.toLowerCase()]?.length),
            }));
    }

    return NextResponse.json({response, ToolsConnection});
}
