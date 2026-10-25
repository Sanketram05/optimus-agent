import { CalendarClock, Target } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RoutineDraft } from "@/lib/openai/agent-response-schema"
import { ToolConnectionCardData } from "@/type/Message"
import { ToolSuggestionCard } from "./ToolSuggestionCard"

export function RoutineCard({
  routine,
  toolCards,
  agentId,
}: {
  routine: RoutineDraft
  toolCards: ToolConnectionCardData[]
  agentId: string
}) {
  const { schedule } = routine
  const frequency = schedule.frequency === "once" ? "Once" : `Every ${schedule.frequency.replace("ly", "")}`
  const weekDays = schedule.weekDays.length ? ` · ${schedule.weekDays.join(", ")}` : ""

  return (
    <Card className="gap-4 border-primary/20 bg-card shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          <CardTitle>{routine.name}</CardTitle>
        </div>
        <CardDescription>{frequency}{weekDays} at {schedule.time} ({schedule.timezone})</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-muted/60 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Target className="size-3.5" /> Goal
          </div>
          <p className="text-sm leading-5">{routine.goal}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Instructions</p>
          <p className="whitespace-pre-wrap text-sm leading-5">{routine.instructions}</p>
        </div>
        <ToolSuggestionCard title="Tools for this routine" suggestions={routine.tools} tools={toolCards} agentId={agentId} />
      </CardContent>
    </Card>
  )
}
