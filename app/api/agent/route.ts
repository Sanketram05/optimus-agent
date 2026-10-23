import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { AgentConfig, db } from "@/db";
import { desc, eq } from "drizzle-orm";

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

    if(!session?.user?.email){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const agentConfigs = await db.select().from(AgentConfig).where(eq(AgentConfig.userEmail,session.user.email)).orderBy(desc(AgentConfig.createdAt));

    return NextResponse.json({ agentConfigs });
}