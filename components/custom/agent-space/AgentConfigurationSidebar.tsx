"use client"

import { useContext, useState } from "react"
import {
  CalendarClock,
  ClipboardList,
  Check,
  Puzzle,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AgentSettingsPanel, ExecutionHistoryPanel, SchedulePanel, SettingsPanel, ToolsPanel } from "./ConfigurationPanels"
import { AgentConfigContext } from "@/context/AgentConfigContext"
import axios from "axios"
import { toast } from "@/components/ui/toast"

type ConfigTab = "settings" | "tools" | "schedule" | "history" | "agent-settings"
const configTabs: { id: ConfigTab; label: string; icon: typeof Settings2 }[] = [
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "tools", label: "Tools", icon: Puzzle },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "history", label: "Routine Execution History", icon: ClipboardList },
  { id: "agent-settings", label: "Agent settings", icon: SlidersHorizontal },
]

export function AgentConfigurationSidebar() {
  const [activeTab, setActiveTab] = useState<ConfigTab>("settings")

  const {agentConfig, setAgentConfig} = useContext(AgentConfigContext);

  const UpdateAgentConfig = async() => {
    if (!agentConfig) return;

    toast.add({
      title: "Updating Agent config",
      description: "Your agent configuration is being updated.",
      type: "info",
    });

    try {
      const res = await axios.put('/api/agent', agentConfig)
      setAgentConfig(res.data.agentConfig);

      toast.add({
        title: "Agent saved",
        description: "Your changes have been saved.",
        type: "success",
      });
    } catch (error) {
      console.error("Error saving agent configuration:", error);
      toast.add({
        title: "Unable to save agent",
        description: "Please try again. If the problem persists, contact support.",
        type: "error",
      });
    }
  }

  return (
    <aside className="hidden h-dvh w-105 shrink-0 flex-col border-l border-border bg-card xl:flex">
      <div className="flex h-18 shrink-0 items-center justify-between border-b border-border px-5">
        <h2 className="text-sm font-semibold">Agent Configuration</h2>
        <Button size="sm" onClick={UpdateAgentConfig}>
          <Check className="size-3.5" />
          Save
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AgentIdentity />
        <ConfigurationTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <div className="px-5 py-5">
          {activeTab === "settings" && <SettingsPanel />}
          {activeTab === "tools" && <ToolsPanel />}
          {activeTab === "schedule" && <SchedulePanel />}
          {activeTab === "history" && <ExecutionHistoryPanel />}
          {activeTab === "agent-settings" && <AgentSettingsPanel />}
        </div>
      </div>
    </aside>
  )
}

function AgentIdentity() {
  const { agentConfig, setAgentConfig } = useContext(AgentConfigContext)

  const shuffleAvatar = () => {
    const randomSeed = crypto.randomUUID();
    const newAvatarUrl = `https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=${randomSeed}`;

    setAgentConfig({ ...agentConfig, agentImage: newAvatarUrl });
  }

  return (
    <div className="border-b border-border px-5 py-5">
      <div className="flex items-center gap-4">
        <img src={agentConfig?.agentImage} alt="Agent avatar" className="size-16 rounded-full" />
        <div>
          <Button variant="outline" size="sm" onClick={shuffleAvatar}>
            <RefreshCw className="size-3.5" />
            Shuffle avatar
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Choose a new look for your agent.
          </p>
        </div>
      </div>
      <div className="mt-5">
        <label className="mb-2 block text-sm font-medium text-foreground">
          Agent name
        </label>
        <Input value={agentConfig?.name ?? ""} onChange={(e) => setAgentConfig({ ...agentConfig, name: e.target.value })} /> 
      </div>
    </div>
  )
}

function ConfigurationTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ConfigTab
  onTabChange: (tab: ConfigTab) => void
}) {
  return (
    <TooltipProvider>
      <div
        className="flex items-center gap-1 border-b border-border px-5 py-3"
        aria-label="Agent configuration sections"
      >
        {configTabs.map(({ id, label, icon: Icon }) => (
          <Tooltip key={id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={label}
                  onClick={() => onTabChange(id)}
                  className={`flex size-9 items-center justify-center rounded-lg transition-colors ${
                    activeTab === id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                />
              }
            >
              <Icon className="size-4" />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
