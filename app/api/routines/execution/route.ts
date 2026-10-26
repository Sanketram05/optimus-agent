import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, desc, eq } from "drizzle-orm";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db, RoutineExecutions, Routines } from "@/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const id = req.nextUrl.searchParams.get("id");
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (agentId) {
    const executions = await db.select({ execution: RoutineExecutions, routineName: Routines.name }).from(RoutineExecutions)
      .innerJoin(Routines, eq(RoutineExecutions.routineId, Routines.id))
      .where(and(eq(Routines.agentId, agentId), eq(Routines.userEmail, session.user.email)))
      .orderBy(desc(RoutineExecutions.createdAt));
    return NextResponse.json({ executions });
  }
  if (!id) return NextResponse.json({ error: "id or agentId is required" }, { status: 400 });
  const [execution] = await db.select({ execution: RoutineExecutions }).from(RoutineExecutions)
    .innerJoin(Routines, eq(RoutineExecutions.routineId, Routines.id))
    .where(and(eq(RoutineExecutions.id, id), eq(Routines.userEmail, session.user.email)));
  if (!execution) return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  return NextResponse.json({ execution: execution.execution });
}
