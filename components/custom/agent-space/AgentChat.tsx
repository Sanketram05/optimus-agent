"use client"

import { useState } from "react"
import { Bot, Send } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

const agentImage = "/OptimusLogo.png"

export function AgentChat() {
  const [isActive, setIsActive] = useState(true)

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <AgentChatHeader isActive={isActive} onActiveChange={setIsActive} />
      <ChatConversation />
      <ChatComposer />
    </section>
  )
}

function AgentChatHeader({
  isActive,
  onActiveChange,
}: {
  isActive: boolean
  onActiveChange: (active: boolean) => void
}) {
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border px-6">
      <div className="flex items-center gap-3">
        <Avatar className="size-10" size="lg">
          <AvatarImage src={agentImage} alt="Research Assistant" />
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="size-5" />
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-sm font-semibold">Research Assistant</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your AI research partner
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-sm text-muted-foreground">
          {isActive ? "Active" : "Inactive"}
        </span>
        <Switch
          checked={isActive}
          onCheckedChange={onActiveChange}
          aria-label="Toggle agent status"
        />
      </div>
    </header>
  )
}

function ChatConversation() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
        <AgentMessage time="10:32 AM">
          Hi! I&apos;m ready to help you research, organize ideas, and get things
          done. What would you like to work on?
        </AgentMessage>
        <UserMessage time="10:33 AM">
          Can you help me plan my priorities for this week?
        </UserMessage>
        <AgentMessage time="10:33 AM">
          Absolutely. Tell me what&apos;s on your plate, and I&apos;ll help you
          turn it into a focused plan with clear next steps.
        </AgentMessage>
      </div>
    </div>
  )
}

function AgentMessage({
  time,
  children,
}: {
  time: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar className="mt-0.5 size-8" size="sm">
        <AvatarImage src={agentImage} alt="Research Assistant" />
        <AvatarFallback>RA</AvatarFallback>
      </Avatar>
      <div className="max-w-[80%]">
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className="font-medium">Research Assistant</span>
          <span className="text-muted-foreground">{time}</span>
        </div>
        <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm leading-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  )
}

function UserMessage({
  time,
  children,
}: {
  time: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-end gap-3">
      <div className="max-w-[80%] text-right">
        <div className="mb-1 text-xs text-muted-foreground">You · {time}</div>
        <div className="rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-left text-sm leading-6 text-primary-foreground">
          {children}
        </div>
      </div>
      <Avatar className="mt-0.5 size-8" size="sm">
        <AvatarFallback className="bg-secondary font-medium text-secondary-foreground">
          SR
        </AvatarFallback>
      </Avatar>
    </div>
  )
}

function ChatComposer() {
  return (
    <div className="shrink-0 border-t border-border bg-background px-6 py-4 sm:px-10">
      <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
        <Textarea
          aria-label="Message agent"
          placeholder="Ask your agent anything..."
          className="min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
          rows={1}
        />
        <Button size="icon" aria-label="Send message">
          <Send className="size-4" />
        </Button>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
        Agent responses may contain mistakes. Check important information.
      </p>
    </div>
  )
}
