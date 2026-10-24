import {
  Bot,
  CalendarClock,
  Clock3,
  Copy,
  Github,
  Mail,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
  Slack,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useContext } from "react"
import { AgentConfigContext } from "@/context/AgentConfigContext"

const connectedTools = [
  { name: "Gmail", icon: Mail, tint: "text-red-500" },
  { name: "Slack", icon: Slack, tint: "text-violet-600" },
  { name: "Google Calendar", icon: CalendarClock, tint: "text-blue-500" },
  { name: "Notion", icon: Bot, tint: "text-foreground" },
  { name: "GitHub", icon: Github, tint: "text-foreground" },
]

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-sm font-medium text-foreground">
      {children}
    </label>
  )
}

export function SettingsPanel() {
  
  const {agentConfig, setAgentConfig} = useContext(AgentConfigContext);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Settings</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Define your agent&apos;s role and how it should help.
        </p>
      </div>
      <div>
        <FieldLabel>Agent description &amp; instructions</FieldLabel>
        <Textarea
          defaultValue={agentConfig?.description}
          className="min-h-52 resize-y leading-6"
          onChange={(e) => setAgentConfig({ ...agentConfig, description: e.target.value })}
        />
      </div>
    </div>
  )
}

export function ToolsPanel() {
  return (
    <div>
      <div>
        <h3 className="text-sm font-semibold">Tools</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Connect the apps your agent needs to do its work.
        </p>
      </div>
      <div className="mt-5 divide-y divide-border rounded-xl border border-border">
        {connectedTools.map(({ name, icon: Icon, tint }) => (
          <div key={name} className="flex items-center gap-3 px-3 py-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <Icon className={`size-4 ${tint}`} />
            </span>
            <span className="flex-1 text-sm font-medium">{name}</span>
            <Button size="sm" variant="outline">
              Connect
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SchedulePanel() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Schedule</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Choose when this agent should run.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="rounded-xl border-2 border-primary bg-primary/5 px-3 py-3 text-left"
        >
          <Clock3 className="mb-2 size-4" />
          <span className="block text-sm font-medium">Manual</span>
          <span className="text-xs text-muted-foreground">Run on demand</span>
        </button>
        <button
          type="button"
          className="rounded-xl border border-border px-3 py-3 text-left hover:bg-muted"
        >
          <CalendarClock className="mb-2 size-4 text-muted-foreground" />
          <span className="block text-sm font-medium">Recurring</span>
          <span className="text-xs text-muted-foreground">
            Run on a schedule
          </span>
        </button>
      </div>
      <div className="rounded-xl border border-border p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recurring schedule
        </p>
        <p className="mt-2 text-sm font-medium">Every day at 8:00 AM</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Frequency</FieldLabel>
            <Input defaultValue="Every day" />
          </div>
          <div>
            <FieldLabel>Time</FieldLabel>
            <Input defaultValue="8:00 AM" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function AgentSettingsPanel() {
  const options = [
    {
      label: "Duplicate agent",
      copy: "Create a copy with the same configuration.",
      icon: Copy,
    },
    {
      label: "Pause agent",
      copy: "Temporarily stop this agent from running.",
      icon: MoreHorizontal,
    },
    {
      label: "Reset agent",
      copy: "Restore the default configuration.",
      icon: RefreshCw,
    },
  ]

  return (
    <div>
      <div>
        <h3 className="text-sm font-semibold">Agent settings</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Manage this agent&apos;s general options.
        </p>
      </div>
      <div className="mt-5 space-y-1">
        {options.map(({ label, copy, icon: Icon }) => (
          <button
            type="button"
            key={label}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-muted"
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="flex-1">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block pt-0.5 text-xs text-muted-foreground">
                {copy}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex gap-2">
          <ShieldAlert className="mt-0.5 size-4 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Danger zone</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Deleting this agent is permanent and cannot be undone.
            </p>
            <Button variant="destructive" size="sm" className="mt-3">
              <Trash2 className="size-3.5" />
              Delete agent
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
