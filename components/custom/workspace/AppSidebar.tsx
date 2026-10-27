"use client"

import Image from "next/image"
import { useState } from "react"
import { Check, Compass, Loader2, LogOut, Plus, Sparkles, Wrench, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { useEffect } from "react"
import axios from "axios"
import { AgentConfigType } from "@/type/Agent"
import { usePathname } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"

type MarketplaceTool = {
  name: string
  slug: string
  description: string
  icon: string
  category: string | null
  connected: boolean
}

function AppSidebar() {

  const [agents,setAgents] = useState<AgentConfigType[]>([]);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [marketplaceTools, setMarketplaceTools] = useState<MarketplaceTool[]>([])
  const [marketplaceLoading, setMarketplaceLoading] = useState(false)
  const [pendingTool, setPendingTool] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const {data} = useSession();
  const path = usePathname();

  useEffect(() => {
    GetUserAgents();
  },[path]);

  const GetUserAgents = async() => {
    try {
      const result = await axios.get('/api/agent');
      setAgents(result.data.agentConfigs);
    } catch (error) {
      console.error("Unable to load agents:", error);
      toast.add({ type: "error", title: "Unable to load agents" });
    }
  }

  const openMarketplace = async () => {
    setMarketplaceOpen(true)
    setMarketplaceLoading(true)
    try {
      const { data: result } = await axios.get("/api/marketplace")
      setMarketplaceTools(result.tools)
    } catch (error) {
      console.error("Unable to load marketplace tools:", error)
      toast.add({ type: "error", title: "Unable to load marketplace tools" })
    } finally {
      setMarketplaceLoading(false)
    }
  }

  const changeConnection = async (tool: MarketplaceTool) => {
    setPendingTool(tool.slug)
    try {
      const agentId = agents.find((agent) => path === `/workspace/${agent.agentId}`)?.agentId
      const { data: result } = await axios.post("/api/marketplace", {
        action: tool.connected ? "disconnect" : "connect",
        toolSlug: tool.slug,
        ...(agentId ? { agentId } : {}),
      })
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl)
        return
      }
      setMarketplaceTools((tools) => tools.map((item) =>
        item.slug === tool.slug ? { ...item, connected: result.connected } : item
      ))
      toast.add({
        type: "success",
        title: tool.connected ? "Tool disconnected" : "Tool connected",
        description: `${tool.name} is ${tool.connected ? "disconnected" : "connected"}.`,
      })
    } catch (error) {
      console.error("Unable to update marketplace connection:", error)
      toast.add({ type: "error", title: tool.connected ? "Unable to disconnect tool" : "Unable to connect tool" })
    } finally {
      setPendingTool(null)
    }
  }

  const connectedTools = marketplaceTools.filter((tool) => tool.connected)
  const availableTools = marketplaceTools.filter((tool) => !tool.connected)

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
          {agents?.map((agent) => (
            <Link
              key={agent.agentId}
              href={`/workspace/${agent.agentId}`}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm font-medium transition-colors ${
                path === `/workspace/${agent.agentId}`
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Avatar className="size-8" size="sm">
                <AvatarImage src={agent?.agentImage} />
                <AvatarFallback>{agent?.agentImage}</AvatarFallback>
              </Avatar>
              <span className="truncate">{agent.name}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="space-y-3 border-t border-sidebar-border pt-3">
        <button
          type="button"
          onClick={() => void openMarketplace()}
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
        </button>
        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true)
            try {
              await signOut({ callbackUrl: "/" })
            } catch (error) {
              console.error("Unable to sign out:", error)
              toast.add({ type: "error", title: "Unable to log out" })
              setSigningOut(false)
            }
          }}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50"
        >
          {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          Log out
        </button>
      </div>
      <Dialog open={marketplaceOpen} onOpenChange={setMarketplaceOpen}>
        <DialogContent className="max-h-[85dvh] w-full overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tool marketplace</DialogTitle>
            <DialogDescription>Manage the apps and services available to your agents.</DialogDescription>
          </DialogHeader>
          {marketplaceLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : marketplaceTools.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No tools are available yet.</div>
          ) : (
            <div className="space-y-7 overflow-y-auto pb-2">
              <ToolGrid
                title="Connected tools"
                tools={connectedTools}
                empty="No tools connected yet."
                pendingTool={pendingTool}
                onConnectionChange={changeConnection}
              />
              <ToolGrid
                title="Available tools"
                tools={availableTools}
                empty="You have connected every available tool."
                pendingTool={pendingTool}
                onConnectionChange={changeConnection}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </aside>
  )
}

function ToolGrid({
  title,
  tools,
  empty,
  pendingTool,
  onConnectionChange,
}: {
  title: string
  tools: MarketplaceTool[]
  empty: string
  pendingTool: string | null
  onConnectionChange: (tool: MarketplaceTool) => void
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold">{title}<span className="ml-2 text-xs font-normal text-muted-foreground">{tools.length}</span></h3>
      {tools.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{empty}</p> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {tools.map((tool) => {
            const pending = pendingTool === tool.slug
            return (
              <article key={tool.slug} className="flex min-h-36 items-start gap-3 rounded-xl border border-border bg-card p-4">
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {tool.icon ? <img src={tool.icon} alt="" className="size-7 object-contain" /> : <Wrench className="size-5 text-muted-foreground" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold">{tool.name}</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">{tool.category || "General"}</p>
                    </div>
                    {tool.connected && <Check className="size-4 shrink-0 text-emerald-600" aria-label="Connected" />}
                  </div>
                  <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-5 text-muted-foreground">{tool.description}</p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant={tool.connected ? "outline" : "default"}
                    disabled={pending || pendingTool !== null}
                    onClick={() => onConnectionChange(tool)}
                  >
                    {pending ? <Loader2 className="animate-spin" /> : tool.connected ? <X /> : <Plus />}
                    {pending ? "Working…" : tool.connected ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default AppSidebar
