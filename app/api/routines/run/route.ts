import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { queueRoutineNow } from "@/lib/routines/queue";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { routineId } = await req.json();
  if (typeof routineId !== "string") return NextResponse.json({ error: "routineId is required" }, { status: 400 });
  try {
    const result = await queueRoutineNow(routineId, session.user.email);
    return NextResponse.json(result, { status: result.alreadyQueued ? 200 : 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to queue routine" }, { status: 400 });
  }
}
