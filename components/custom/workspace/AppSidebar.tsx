"use client"

import Image from "next/image"
import { Compass, Plus, Sparkles } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import axios from "axios"
import { AgentConfigType } from "@/type/Agent"
import { usePathname } from "next/navigation"

function AppSidebar() {

  const [agents,setAgents] = useState<AgentConfigType[]>([]);
  const {data} = useSession();
  const path = usePathname();

  useEffect(() => {
    GetUserAgents();
  },[path]);

  const GetUserAgents = async() => {
    const result = await axios.get('/api/agent');
    console.log(result.data);
    setAgents(result.data.agentConfigs);
  }

  return (
    <aside className="flex h-dvh w-72 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4 text-sidebar-foreground">
      <div className="flex items-center gap-3 px-2 pb-6 pt-1">
        <div className="flex size-9 items-center justify-center overflow-hidden rounded-full">
          <Image
            src="/OptimusLogo.png"
            alt="Optimus logo"
            width={40}
            height={40}
            className="size-full rounded-full object-cover"
            priority
          />
        </div>
        <span className="text-lg font-semibold tracking-tight">Optimus</span>
      </div>
    
      <Link href="/workspace/create-agent"> 
        <Button className="h-10 w-full justify-start gap-2 rounded-xl px-3 shadow-sm" size="lg">
            <Plus className="size-4" />
            Create New Agent
        </Button>
      </Link>

      <div className="mt-8 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Your Agents
          </span>
          <span className="text-xs text-muted-foreground">{agents.length}</span>
        </div>

        <nav aria-label="Your agents" className="space-y-1 overflow-y-auto">
          {agents?.map((agent, index) => (
            <button
              key={agent.name}
              type="button"
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm font-medium transition-colors ${
                index === 0
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Avatar className="size-8" size="sm">
                <AvatarImage src={agent?.agentImage} />
                <AvatarFallback>{agent?.agentImage}</AvatarFallback>
              </Avatar>
              <span className="truncate">{agent.name}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-3 border-t border-sidebar-border pt-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Compass className="size-4" />
          Marketplace
        </button>

        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-sidebar-accent"
        >
          <Avatar className="size-9">
            <AvatarImage
            src={data?.user?.image || "/OptimusLogo.png"}
            />
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              OS
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{data?.user?.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{data?.user?.email}</span>
          </span>
          <Sparkles className="size-4 text-muted-foreground" />
        </button>
      </div>
    </aside>
  )
}

export default AppSidebar
