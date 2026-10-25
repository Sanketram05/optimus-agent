"use client"

import { useState } from "react"
import axios from "axios"
import { CheckCircle2, Loader2, PlugZap, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ToolConnectionCardData } from "@/type/Message"

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

  if (!suggestions.length) return null

  const connectTool = async (toolSlug: string) => {
    setConnectingSlug(toolSlug)

    try {
      const { data } = await axios.post("/api/agent/connect", { agentId, toolSlug })
      window.location.assign(data.redirectUrl)
    } catch (error) {
      console.error("[ToolSuggestionCard] Failed to create a tool connection:", error)
      setConnectingSlug(null)
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
          const connected = tool?.isConnected || tool?.isEnabled
          const toolIcon = tool?.icon

          return (
            <div key={suggestion.slug} className="flex gap-3 rounded-lg border border-border bg-card p-3">
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
                    <Badge variant="secondary"><CheckCircle2 /> Connected</Badge>
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
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
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
