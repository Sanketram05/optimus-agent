"use client"

import { CalendarClock, Loader2, Target } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RoutineDraft } from "@/lib/openai/agent-response-schema"
import { ToolConnectionCardData } from "@/type/Message"
import { ToolSuggestionCard } from "./ToolSuggestionCard"
import axios from "axios"
import { useState } from "react"
import { toast } from "@/components/ui/toast"

export function RoutineCard({
  routine,
  toolCards,
  agentId,
  routineId,
}: {
  routine: RoutineDraft
  toolCards: ToolConnectionCardData[]
  agentId: string
  routineId?: string
}) {
  const [saving, setSaving] = useState(false)
  const [nextRunAt, setNextRunAt] = useState<string | null>(null)
  const { schedule } = routine
  const frequency = schedule.frequency === "once" ? "Once" : `Every ${schedule.frequency.replace("ly", "")}`
  const weekDays = schedule.weekDays.length ? ` · ${schedule.weekDays.join(", ")}` : ""

  const saveRoutine = async () => {
    setSaving(true)
    try {
      const result = routineId
        ? await axios.put("/api/routines", { id: routineId, ...routine })
        : await axios.post("/api/routines", { agentId, ...routine })
      setNextRunAt(result.data.routine.nextRunAt)
      window.dispatchEvent(new CustomEvent("routine:changed", { detail: result.data.routine }))
      toast.add({ type: "success", title: routineId ? "Routine updated" : "Routine created" })
    } catch {
      toast.add({ type: "error", title: "Unable to save routine", description: "Please try again." })
    } finally {
      setSaving(false)
    }
  }

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
        {nextRunAt && <p className="text-xs text-muted-foreground">Next run: {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: schedule.timezone }).format(new Date(nextRunAt))}</p>}
        <Button className="w-full" onClick={saveRoutine} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {routineId ? "Update routine" : "Create routine"}
        </Button>
      </CardContent>
    </Card>
  )
}
