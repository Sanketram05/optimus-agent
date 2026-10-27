"use client"

import { useEffect, useRef, useState } from "react"
import axios from "axios"
import { CheckCircle2, Loader2, PlugZap, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ToolConnectionCardData } from "@/type/Message"
import { toast } from "@/components/ui/toast"

type SuggestedTool = { slug: string; reason: string }

type ToolSuggestionCardProps = {
  suggestions: SuggestedTool[]
  tools: ToolConnectionCardData[]
  agentId: string
  title?: string
}

export function ToolSuggestionCard({
  suggestions,
  tools,
  agentId,
  title = "Tools needed",
}: ToolSuggestionCardProps) {
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null)
  const [disconnectingSlug, setDisconnectingSlug] = useState<string | null>(null)
  const [connectedSlugs, setConnectedSlugs] = useState<Set<string>>(
    () => new Set(tools.filter((tool) => tool.isConnected || tool.isEnabled).map((tool) => tool.slug))
  )
  const statusPolls = useRef<Record<string, number>>({})

  useEffect(() => () => {
    Object.values(statusPolls.current).forEach((poll) => window.clearInterval(poll))
  }, [])

  if (!suggestions.length) return null

  const stopStatusPoll = (toolSlug: string) => {
    const poll = statusPolls.current[toolSlug]
    if (poll) window.clearInterval(poll)
    delete statusPolls.current[toolSlug]
  }

  const pollConnectionStatus = (toolSlug: string) => {
    stopStatusPoll(toolSlug)
    let attempts = 0
    statusPolls.current[toolSlug] = window.setInterval(async () => {
      attempts += 1
      try {
        const { data } = await axios.get("/api/agent/status", { params: { agentId, toolSlug } })
        if (data.connected) {
          setConnectedSlugs((current) => new Set(current).add(toolSlug))
          stopStatusPoll(toolSlug)
        } else if (attempts >= 120) {
          stopStatusPoll(toolSlug)
        }
      } catch (error) {
        console.error("[ToolSuggestionCard] Failed to check tool connection status:", error)
        stopStatusPoll(toolSlug)
      }
    }, 2_000)
  }

  const connectTool = async (toolSlug: string) => {
    const connectionWindow = window.open("about:blank", "_blank")
    setConnectingSlug(toolSlug)

    try {
      const { data } = await axios.post("/api/agent/connect", { agentId, toolSlug })
      if (data.connected) {
        connectionWindow?.close()
        setConnectedSlugs((current) => new Set(current).add(toolSlug))
        setConnectingSlug(null)
        return
      }

      if (!data.redirectUrl) throw new Error("The connection URL was not returned")
      if (connectionWindow) {
        connectionWindow.location.assign(data.redirectUrl)
      } else {
        window.open(data.redirectUrl, "_blank")
      }
      pollConnectionStatus(toolSlug)
    } catch (error) {
      connectionWindow?.close()
      console.error("[ToolSuggestionCard] Failed to create a tool connection:", error)
      const message = axios.isAxiosError(error) ? error.response?.data?.error : undefined
      toast.add({
        type: "error",
        title: "Unable to connect this tool",
        description: message ?? "This integration is unavailable. Please try again.",
      })
      setConnectingSlug(null)
    }
  }

  const disconnectTool = async (toolSlug: string) => {
    setDisconnectingSlug(toolSlug)
    try {
      await axios.post("/api/agent/disconnect", { agentId, toolSlug })
      stopStatusPoll(toolSlug)
      setConnectedSlugs((current) => {
        const next = new Set(current)
        next.delete(toolSlug)
        return next
      })
    } catch (error) {
      console.error("[ToolSuggestionCard] Failed to disconnect tool:", error)
    } finally {
      setDisconnectingSlug(null)
    }
  }

  return (
    <Card size="sm" className="gap-3 border-border bg-muted/30 shadow-none">
      <CardHeader className="gap-1">
        <div className="flex items-center gap-2">
          <PlugZap className="size-4 text-primary" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>These integrations help complete this request.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((suggestion) => {
          const tool = tools.find((item) => item.slug === suggestion.slug)
          const name = tool?.name ?? suggestion.slug
          const connected = connectedSlugs.has(suggestion.slug)
          const toolIcon = tool?.icon

          return (
            <div key={suggestion.slug} className="flex min-w-0 gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                {toolIcon ? (
                  <img
                    src={toolIcon}
                    alt={`${name} icon`}
                    className="size-5 object-contain"
                  />
                ) : (
                  <Wrench className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{name}</p>
                  {connected ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary"><CheckCircle2 /> Connected</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => disconnectTool(suggestion.slug)}
                        disabled={disconnectingSlug === suggestion.slug}
                      >
                        {disconnectingSlug === suggestion.slug ? <Loader2 className="animate-spin" /> : null}
                        {disconnectingSlug === suggestion.slug ? "Disconnecting" : "Disconnect"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => connectTool(suggestion.slug)}
                      disabled={connectingSlug === suggestion.slug}
                    >
                      {connectingSlug === suggestion.slug ? <Loader2 className="animate-spin" /> : <PlugZap />}
                      {connectingSlug === suggestion.slug ? "Connecting" : "Connect"}
                    </Button>
                  )}
                </div>
                <p className="mt-0.5 break-words text-xs leading-5 text-muted-foreground">
                  {suggestion.reason || tool?.description}
                </p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
