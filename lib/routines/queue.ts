import { and, eq, inArray } from "drizzle-orm";
import { db, RoutineExecutions, Routines } from "@/db";
import { inngest } from "@/lib/inngest/client";

export async function queueRoutineNow(routineId: string, userEmail: string) {
  const [routine] = await db.select().from(Routines)
    .where(and(eq(Routines.id, routineId), eq(Routines.userEmail, userEmail)));
  if (!routine) throw new Error("Routine not found");
  if (!routine.isActive) throw new Error("This routine is inactive");
  const [active] = await db.select().from(RoutineExecutions)
    .where(and(eq(RoutineExecutions.routineId, routineId), inArray(RoutineExecutions.status, ["queued", "running"])));
  if (active) return { execution: active, alreadyQueued: true };

  const execution = { id: crypto.randomUUID(), routineId, scheduledFor: new Date(), status: "queued" as const };
  const [created] = await db.insert(RoutineExecutions).values(execution).returning();
  await inngest.send({ name: "routine/execution.queued", data: { executionId: created.id, routineId, scheduledFor: created.scheduledFor.toISOString() } });
  return { execution: created, alreadyQueued: false };
}
