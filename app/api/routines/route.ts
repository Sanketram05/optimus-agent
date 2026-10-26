import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, desc, eq, inArray } from "drizzle-orm";
import { authOptions } from "../auth/[...nextauth]/route";
import { AgentConfig, db, RoutineExecutions, Routines } from "@/db";
import { calculateNextRunAt, RoutineSchedule } from "@/lib/routines/next-run";

type RoutineInput = { name?: string; goal?: string; instructions?: string; schedule?: unknown; tools?: unknown };

async function getOwner(agentId: string, email: string) {
  const [agent] = await db.select({ agentId: AgentConfig.agentId }).from(AgentConfig)
    .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, email)));
  return agent;
}
function validRoutine(input: RoutineInput) {
  return Boolean(input.name?.trim() && input.goal?.trim() && input.instructions?.trim() && input.schedule);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  if (!await getOwner(agentId, session.user.email)) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const routines = await db.select().from(Routines).where(and(eq(Routines.agentId, agentId), eq(Routines.userEmail, session.user.email))).orderBy(desc(Routines.createdAt));
  const activeExecutions = await db.select().from(RoutineExecutions)
    .where(inArray(RoutineExecutions.status, ["queued", "running"]));
  const byRoutine = new Map(activeExecutions.map((execution) => [execution.routineId, { id: execution.id, status: execution.status }]));
  return NextResponse.json({ routines: routines.map((routine) => ({ ...routine, execution: byRoutine.get(routine.id) ?? null })) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { agentId, ...routine } = (await req.json()) as RoutineInput & { agentId?: string };
  if (!agentId || !validRoutine(routine)) return NextResponse.json({ error: "Complete routine details are required" }, { status: 400 });
  if (!await getOwner(agentId, session.user.email)) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const nextRunAt = calculateNextRunAt(routine.schedule as RoutineSchedule);
  const [created] = await db.insert(Routines).values({ id: crypto.randomUUID(), agentId, userEmail: session.user.email, name: routine.name!.trim(), goal: routine.goal!.trim(), instructions: routine.instructions!.trim(), schedule: routine.schedule!, tools: Array.isArray(routine.tools) ? routine.tools : [], nextRunAt }).returning();
  return NextResponse.json({ routine: created }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, ...routine } = (await req.json()) as RoutineInput & { id?: string };
  if (!id || !validRoutine(routine)) return NextResponse.json({ error: "Complete routine details are required" }, { status: 400 });
  const nextRunAt = calculateNextRunAt(routine.schedule as RoutineSchedule);
  const [updated] = await db.update(Routines).set({ name: routine.name!.trim(), goal: routine.goal!.trim(), instructions: routine.instructions!.trim(), schedule: routine.schedule!, tools: Array.isArray(routine.tools) ? routine.tools : [], nextRunAt }).where(and(eq(Routines.id, id), eq(Routines.userEmail, session.user.email))).returning();
  if (!updated) return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  return NextResponse.json({ routine: updated });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, isActive } = await req.json();
  if (typeof id !== "string" || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "id and isActive are required" }, { status: 400 });
  }
  const [existing] = await db.select().from(Routines)
    .where(and(eq(Routines.id, id), eq(Routines.userEmail, session.user.email)));
  if (!existing) return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  const [updated] = await db.update(Routines)
    .set({ isActive, nextRunAt: isActive ? calculateNextRunAt(existing.schedule as RoutineSchedule) : null })
    .where(and(eq(Routines.id, id), eq(Routines.userEmail, session.user.email)))
    .returning();
  return NextResponse.json({ routine: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const id = new URL(req.url).searchParams.get("id");
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const [deleted] = await db.delete(Routines).where(and(eq(Routines.id, id), eq(Routines.userEmail, session.user.email))).returning();
  if (!deleted) return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  return NextResponse.json({ routine: deleted });
}
