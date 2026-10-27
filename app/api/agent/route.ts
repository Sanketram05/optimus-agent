import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { AgentChatHistory, AgentConfig, AgentVmSessions, db, RoutineExecutions, Routines } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import { pauseAgentDesktop } from "@/lib/agent-vm-desktop";

export async function POST(req: NextRequest){

    const {id, agentId, name, description, agentImage} = await req.json();
    const session = await getServerSession(authOptions);

    if(!session?.user?.email){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});

    }

    const newAgentConfig = await db.insert(AgentConfig).values({
        id:id,
        agentId:agentId,
        name:name,
        description:description,
        agentImage: agentImage,
        userEmail: session.user.email
    }).returning();

    return NextResponse.json({ message: "Agent config created successfully", agentConfig: newAgentConfig });

}

export async function GET(req: NextRequest){
    const session = await getServerSession(authOptions);

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if(!session?.user?.email){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    if(agentId){

        const agentConfig = await db.select().from(AgentConfig).where(and(eq(AgentConfig.userEmail, session.user.email), eq(AgentConfig.agentId, agentId)));

        return NextResponse.json(agentConfig[0]);
    }

    const agentConfigs = await db.select().from(AgentConfig).where(eq(AgentConfig.userEmail,session.user.email)).orderBy(desc(AgentConfig.createdAt));

    return NextResponse.json({ agentConfigs });
}

export async function PUT(req: NextRequest){

    const session = await getServerSession(authOptions);

    if(!session?.user?.email){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const { agentId, name, description, agentImage, isActive } = await req.json();

    if (typeof agentId !== "string" || (name !== undefined && (typeof name !== "string" || !name.trim())) ||
        (isActive !== undefined && typeof isActive !== "boolean")) {
        return NextResponse.json(
            { error: "A valid agent ID, name, and active status are required" },
            { status: 400 }
        );
    }

    const update: {
        name?: string;
        description?: string | null;
        agentImage?: string | null;
        isActive?: boolean;
    } = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description ?? null;
    if (agentImage !== undefined) update.agentImage = agentImage ?? null;
    if (isActive !== undefined) update.isActive = isActive;

    if (isActive === false) {
        const [vmSession] = await db.select().from(AgentVmSessions)
            .where(and(eq(AgentVmSessions.agentId, agentId), eq(AgentVmSessions.userEmail, session.user.email)));
        if (vmSession) {
            try {
                await pauseAgentDesktop(agentId, vmSession.sandboxId, session.user.email);
            } catch (error) {
                console.error("Unable to pause agent desktop:", error);
                return NextResponse.json({ error: "Unable to pause this agent's VM desktop" }, { status: 500 });
            }
        }
    }

    const result = await db.update(AgentConfig)
    .set(update)
    .where(and(eq(AgentConfig.userEmail, session.user.email), eq(AgentConfig.agentId, agentId))).returning();

    if (!result[0]) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Agent config updated successfully", agentConfig: result[0] });
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userEmail = session.user.email;

    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });

    const [agent] = await db.select({ agentId: AgentConfig.agentId }).from(AgentConfig)
        .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, userEmail)));
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const [vmSession] = await db.select().from(AgentVmSessions)
        .where(and(eq(AgentVmSessions.agentId, agentId), eq(AgentVmSessions.userEmail, userEmail)));
    if (vmSession) {
        try {
            await pauseAgentDesktop(agentId, vmSession.sandboxId, userEmail);
        } catch (error) {
            console.error("Unable to pause agent desktop before deletion:", error);
            return NextResponse.json({ error: "Unable to stop this agent's VM desktop" }, { status: 500 });
        }
    }

    await db.transaction(async (tx) => {
        const routines = await tx.select({ id: Routines.id }).from(Routines)
            .where(and(eq(Routines.agentId, agentId), eq(Routines.userEmail, userEmail)));
        for (const routine of routines) {
            await tx.delete(RoutineExecutions).where(eq(RoutineExecutions.routineId, routine.id));
        }
        await tx.delete(Routines).where(and(eq(Routines.agentId, agentId), eq(Routines.userEmail, userEmail)));
        await tx.delete(AgentChatHistory).where(and(eq(AgentChatHistory.agentId, agentId), eq(AgentChatHistory.userEmail, userEmail)));
        await tx.delete(AgentVmSessions).where(and(eq(AgentVmSessions.agentId, agentId), eq(AgentVmSessions.userEmail, userEmail)));
        await tx.delete(AgentConfig).where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, userEmail)));
    });

    return NextResponse.json({ message: "Agent deleted successfully" });
}
