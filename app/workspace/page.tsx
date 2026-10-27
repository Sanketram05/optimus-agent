"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import axios from "axios"
import { ArrowRight, Bot, CheckCircle2, Clock3, Loader2, Plus, Sparkles } from "lucide-react"

import { AgentConfigType } from "@/type/Agent"

function AgentCard({ agent }: { agent: AgentConfigType }) {
  return (
    <Link href={`/workspace/${agent.agentId}`} className="group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-11 shrink-0 overflow-hidden rounded-xl bg-muted"><Image src={agent.agentImage || "/OptimusLogo.png"} alt="" width={44} height={44} unoptimized className="size-full object-cover" /></div>
          <div className="min-w-0"><h2 className="truncate font-semibold">{agent.name}</h2><p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${agent.isActive === false ? "bg-muted-foreground" : "bg-emerald-500"}`} />{agent.isActive === false ? "Paused" : "Active"}</p></div>
        </div>
        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <p className="mt-5 line-clamp-2 min-h-10 break-words text-sm leading-5 text-muted-foreground">{agent.description || "Ready to be configured for your next task."}</p>
      <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><Clock3 className="size-3.5" />Open agent workspace</div>
    </Link>
  )
}

export default function WorkspacePage() {
  const [agents, setAgents] = useState<AgentConfigType[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const loadAgents = async () => {
      try { const { data } = await axios.get("/api/agent"); setAgents(data.agentConfigs ?? []) }
      finally { setLoading(false) }
    }
    void loadAgents()
  }, [])

  return (
    <div className="min-h-full bg-background px-5 py-6 sm:px-8 lg:px-12 lg:py-9">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div><div className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="size-4" />Optimus workspace</div><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Your agents</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Create focused collaborators, give them the right tools, and return here to pick up where you left off.</p></div>
          <Link href="/workspace/create-agent" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"><Plus className="size-4" />Create agent</Link>
        </header>
        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Loading your agents…</div>
        ) : agents.length === 0 ? (
          <section className="mx-auto flex min-h-[430px] max-w-xl flex-col items-center justify-center py-12 text-center"><div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bot className="size-8" /></div><h2 className="mt-6 text-xl font-semibold">Create your first agent</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Start with a clear role and a useful goal. You can connect tools and adjust its behavior once it&apos;s created.</p><Link href="/workspace/create-agent" className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"><Plus className="size-4" />Create your first agent</Link><div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-600" />Your agents stay private to your workspace.</div></section>
        ) : (
          <section className="py-7"><div className="mb-4 flex items-center justify-between"><p className="text-sm font-medium">{agents.length} {agents.length === 1 ? "agent" : "agents"}</p><p className="text-xs text-muted-foreground">Select an agent to start working</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{agents.map((agent) => <AgentCard key={agent.agentId} agent={agent} />)}</div></section>
        )}
      </div>
    </div>
  )
}
