"use client"

import { useContext, useState } from "react"
import { Bot, Loader, Send } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { MessageType } from "@/type/Message"
import { useParams } from "next/navigation"
import axios from "axios"
import { toast } from "@/components/ui/toast"
import { AgentConfigContext } from "@/context/AgentConfigContext"
import { AgentResponseView } from "./generative-ui/AgentResponseView"

const agentImage = "/OptimusLogo.png"

export function AgentChat() {
  const [isActive, setIsActive] = useState(true)
  const [userInput, setUserInput] = useState("");
  const [loading,setLoading] = useState(false);
  const {agentConfig,setAgentConfig} = useContext(AgentConfigContext)
  const {agentId} = useParams();
  const [messages, setMessages] = useState<MessageType[]>([
    {
      id: "welcome",
      role: "agent",
      content: "Hi! I'm ready to help you research, organize ideas, and get things done. What would you like to work on?",
      time: new Date().toString(),
    }
  ])

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
        suggestedTools: agentResponse?.suggestedTools ?? [],
        routine: agentResponse?.routine ?? null,
      });

      if (agentResponse?.suggestedTools?.length) {
        console.log("[AgentChat] Agent suggested tools:", agentResponse.suggestedTools);
      }

      const agentMsg: MessageType = {
        id: crypto.randomUUID(),
        role: 'agent',
        content: agentResponse?.message,
        response: agentResponse,
        toolsCards: result.data?.ToolsConnection,
        time: new Date().toLocaleDateString()
      }

      setMessages((prev) => [...prev,agentMsg]);

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
          <span className="text-sm text-muted-foreground">
            {isActive ? "Active" : "Inactive"}
          </span>
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            aria-label="Toggle agent status"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
          {messages.map((msg, index) => (
            <div key={index}>
              {msg.role === "agent" ? (
                <div className="flex items-start gap-3">
                  <img src={agentConfig?.agentImage} alt="Agent Image" className="size-12 rounded-full"></img>
                  <div className="max-w-[80%]">
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span className="font-medium">{agentConfig?.name}</span>
                      <span className="text-muted-foreground">{""}</span>
                    </div>
                    <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm leading-6 shadow-sm">
                      <AgentResponseView message={msg} agentId={String(agentId)} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-end gap-3">
                  <div className="max-w-[80%] text-right">
                    <div className="mb-1 text-xs text-muted-foreground">
                      You
                    </div>
                    <div className="rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-left text-sm leading-6 text-primary-foreground">
                      {msg.content}
                    </div>
                  </div>
                  <Avatar className="mt-0.5 size-12" size="sm">
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
              <div className="max-w-[80%]">
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
        <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
          <Textarea
            aria-label="Message agent"
            placeholder="Ask your agent anything..."
            className="min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
            rows={1}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
          />
          <Button size="icon" aria-label="Send message"
          onClick={handleSendMessage} disabled={loading}>
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

