import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { AgentConfig, db } from "@/db";
import { and, desc, eq } from "drizzle-orm";

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

    const { agentId, name, description, agentImage } = await req.json();

    if (!agentId || !name?.trim()) {
        return NextResponse.json(
            { error: "An agent ID and name are required" },
            { status: 400 }
        );
    }

    const result = await db.update(AgentConfig)
    .set({
        name: name.trim(),
        description: description ?? null,
        agentImage: agentImage ?? null,
    })
    .where(and(eq(AgentConfig.userEmail, session.user.email), eq(AgentConfig.agentId, agentId))).returning();

    if (!result[0]) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Agent config updated successfully", agentConfig: result[0] });
}
