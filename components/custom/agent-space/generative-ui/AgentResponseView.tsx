import { MessageType } from "@/type/Message"
import { RoutineCard } from "./RoutineCard"
import { ToolSuggestionCard } from "./ToolSuggestionCard"
import { CalendarClock, Pencil } from "lucide-react"

export function AgentResponseView({ message, agentId }: { message: MessageType; agentId: string }) {
  if (message.editingRoutine) {
    const { name, goal, schedule } = message.editingRoutine
    const frequency = schedule.frequency === "once" ? "One time" : `Every ${schedule.frequency}`
    const days = schedule.weekDays.length ? ` · ${schedule.weekDays.join(", ")}` : ""
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Pencil className="size-4" /></span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">Editing routine</p>
            <p className="break-words text-sm font-semibold leading-5">{name}</p>
            <p className="break-words text-xs leading-5 text-muted-foreground">{goal}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="size-3.5 shrink-0" />{frequency}{days} at {schedule.time}</p>
          </div>
        </div>
        <p className="text-sm">What would you like to change?</p>
      </div>
    )
  }
  const response = message.response
  if (!response) return <p className="whitespace-pre-wrap break-words">{message.content}</p>

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap break-words">{response.message}</p>
      {response.type === "clarification" && response.questions.map((item) => (
        <p key={item.id} className="rounded-lg bg-muted px-3 py-2 text-sm">{item.question}</p>
      ))}
      {response.type === "tool_connection" && (
        <ToolSuggestionCard
          suggestions={response.suggestedTools}
          tools={message.toolsCards ?? []}
          agentId={agentId}
        />
      )}
      {response.connectedTools.length > 0 && (
        <ToolSuggestionCard
          title="Connected tools"
          suggestions={response.connectedTools}
          tools={message.toolsCards ?? []}
          agentId={agentId}
        />
      )}
      {response.type === "routine" && response.routine && (
        <RoutineCard routine={response.routine} toolCards={message.toolsCards ?? []} agentId={agentId} routineId={message.routineId} />
      )}
    </div>
  )
}
