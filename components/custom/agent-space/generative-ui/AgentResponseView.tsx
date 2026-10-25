import { MessageType } from "@/type/Message"
import { RoutineCard } from "./RoutineCard"
import { ToolSuggestionCard } from "./ToolSuggestionCard"

export function AgentResponseView({ message, agentId }: { message: MessageType; agentId: string }) {
  const response = message.response
  if (!response) return <p className="whitespace-pre-wrap">{message.content}</p>

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap">{response.message}</p>
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
      {response.type === "routine" && response.routine && (
        <RoutineCard routine={response.routine} toolCards={message.toolsCards ?? []} agentId={agentId} />
      )}
    </div>
  )
}
