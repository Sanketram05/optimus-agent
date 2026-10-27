"use client"

import { useContext, useEffect, useRef, useState } from "react"
import { Loader, Send } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageType } from "@/type/Message"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import axios from "axios"
import { toast } from "@/components/ui/toast"
import { AgentConfigContext } from "@/context/AgentConfigContext"
import { AgentResponseView } from "./generative-ui/AgentResponseView"

export function AgentChat() {
  const [userInput, setUserInput] = useState("");
  const [loading,setLoading] = useState(false);
  const {agentConfig} = useContext(AgentConfigContext)
  const {agentId} = useParams();
  const { data: session } = useSession()
  const [messages, setMessages] = useState<MessageType[]>([
    {
      id: "welcome",
      role: "agent",
      content: "Hi! I'm ready to help you research, organize ideas, and get things done. What would you like to work on?",
      time: new Date().toString(),
    }
  ])
  // State updates are asynchronous; this ref guarantees the edit target survives
  // until the AI returns the replacement routine card.
  const editingRoutineIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!agentId) return
    const loadHistory = async () => {
      try {
        const { data } = await axios.get(`/api/agent/chat?agentId=${encodeURIComponent(String(agentId))}`)
        if (data.messages?.length) {
          setMessages(data.messages.map((message: any) => ({
            id: message.id, role: message.role, content: message.content,
            response: message.response ?? undefined, toolsCards: message.toolsCards ?? undefined,
            time: new Date(message.createdAt).toLocaleString(),
          })))
        }
      } catch { /* A new chat can still start without saved history. */ }
    }
    void loadHistory()
  }, [agentId])

  useEffect(() => {
    const beginEdit = (event: Event) => {
      const routine = (event as CustomEvent).detail
      editingRoutineIdRef.current = routine.id
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "agent",
        content: `EDITING ROUTINE (id: ${routine.id})\nName: ${routine.name}\nGoal: ${routine.goal}\nInstructions: ${routine.instructions}\nSchedule: ${JSON.stringify(routine.schedule)}\n\nWhat would you like to change?`,
        editingRoutine: {
          id: routine.id,
          name: routine.name,
          goal: routine.goal,
          instructions: routine.instructions,
          schedule: routine.schedule,
        },
        time: new Date().toLocaleDateString(),
      }])
    }
    window.addEventListener("routine:edit", beginEdit)
    return () => window.removeEventListener("routine:edit", beginEdit)
  }, [])

  const handleSendMessage = async() => {
    if(!userInput.trim() || !agentId){
      return;
    }
    setLoading(true)
    const userMsg:MessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput,
      time: new Date().toLocaleDateString()
    }

    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setUserInput('');

    try{
      const result = await axios.post('/api/agent/chat',{
        agentId: agentId,
        messages: updatedMsgs,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
      
      const agentResponse = result.data.response;
      console.log("[AgentChat] Structured agent response:", {
        type: agentResponse?.type,
        response: agentResponse,
        routineId: agentResponse?.type === "routine" ? editingRoutineIdRef.current ?? undefined : undefined,
        suggestedTools: agentResponse?.suggestedTools ?? [],
        routine: agentResponse?.routine ?? null,
      });

      if (agentResponse?.suggestedTools?.length) {
        console.log("[AgentChat] Agent suggested tools:", agentResponse.suggestedTools);
      }

      const agentMsg: MessageType = {
        id: result.data.agentMessageId ?? crypto.randomUUID(),
        role: 'agent',
        content: agentResponse?.message,
        response: agentResponse,
        routineId: agentResponse?.type === "routine" ? editingRoutineIdRef.current ?? undefined : undefined,
        toolsCards: result.data?.ToolsConnection,
        time: new Date().toLocaleDateString()
      }

      setMessages((prev) => [...prev,agentMsg]);
      if (agentResponse?.type === "routine" && editingRoutineIdRef.current) {
        editingRoutineIdRef.current = null
      }

    } catch(e){
      toast.add({
        type: 'error',
        title: 'Internal server error'
      })
    } finally {
      setLoading(false)
    }

  }  

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3">
          <img src={agentConfig?.agentImage} alt="agentImage" className="size-16 rounded-full"/>
          <div>
            <h1 className="text-sm font-semibold">{agentConfig?.name}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {agentConfig?.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className={`size-2 rounded-full ${agentConfig?.isActive === false ? "bg-muted-foreground" : "bg-emerald-500"}`} />
          <span className="text-sm text-muted-foreground">{agentConfig?.isActive === false ? "Paused" : "Active"}</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
          {agentConfig?.isActive === false && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
              This agent is paused. Resume it in the Agent settings tab to continue.
            </p>
          )}
          {messages.map((msg, index) => (
            <div key={index}>
              {msg.role === "agent" ? (
                <div className="flex items-start gap-3">
                  <img src={agentConfig?.agentImage} alt="Agent Image" className="size-12 rounded-full"></img>
                  <div className="min-w-0 max-w-[80%]">
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span className="font-medium">{agentConfig?.name}</span>
                      <span className="text-muted-foreground">{""}</span>
                    </div>
                    <div className="min-w-0 max-w-full rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm leading-6 shadow-sm [overflow-wrap:anywhere]">
                      <AgentResponseView message={msg} agentId={String(agentId)} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-end gap-3">
                  <div className="min-w-0 max-w-[80%] text-right">
                    <div className="mb-1 text-xs text-muted-foreground">
                      You
                    </div>
                    <div className="min-w-0 max-w-full rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-left text-sm leading-6 text-primary-foreground [overflow-wrap:anywhere]">
                      {msg.content}
                    </div>
                  </div>
                  <Avatar className="mt-0.5 size-12" size="sm">
                    <AvatarImage
                      src={session?.user?.image ?? undefined}
                      alt={session?.user?.name ?? "User"}
                    />
                    <AvatarFallback className="bg-secondary font-medium text-secondary-foreground">
                      U
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-3">
              <img src={agentConfig?.agentImage} alt="Agent Image" className="size-12 rounded-full" />
              <div className="min-w-0 max-w-[80%]">
                <div className="mb-1 text-xs">
                  <span className="font-medium">{agentConfig?.name}</span>
                </div>
                <div className="flex w-fit items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  <Loader className="size-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background px-6 py-4 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
          <Textarea
            aria-label="Message agent"
            placeholder={agentConfig?.isActive === false ? "Resume this agent to send a message" : "Ask your agent anything..."}
            className="min-h-10 flex-1 self-stretch resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
            rows={1}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={agentConfig?.isActive === false}
          />
          <Button size="icon" aria-label="Send message" className="size-10 shrink-0 self-end rounded-xl"
          onClick={handleSendMessage} disabled={loading || agentConfig?.isActive === false}>
            {loading ?<Loader className="animate-spin"/> :<Send className="size-4" />}
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
          Agent responses may contain mistakes. Check important information.
        </p>
      </div>
    </section>
  )
}
