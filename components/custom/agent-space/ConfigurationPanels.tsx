import {
  CalendarClock,
  CheckCircle2,
  Copy,
  MoreHorizontal,
  Pencil,
  Play,
  Power,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Loader2,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useContext, useEffect, useState } from "react"
import { AgentConfigContext } from "@/context/AgentConfigContext"
import axios from "axios"
import { toast } from "@/components/ui/toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

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
  const { agentConfig } = useContext(AgentConfigContext)
  const [tools, setTools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)

  useEffect(() => {
    if (!agentConfig?.agentId) return
    const loadTools = async () => {
      try {
        const { data } = await axios.get(`/api/agent/tools?agentId=${encodeURIComponent(agentConfig.agentId)}`)
        setTools(data.tools)
      } catch {
        toast.add({ type: "error", title: "Unable to load tools" })
      } finally { setLoading(false) }
    }
    void loadTools()
  }, [agentConfig?.agentId])

  const setToolConnection = (slug: string, connected: boolean) => {
    setTools((current) => current.map((tool) => tool.slug === slug ? { ...tool, connected, enabled: connected } : tool))
  }

  const disconnectTool = async (toolSlug: string) => {
    if (!agentConfig?.agentId) return
    setPendingSlug(toolSlug)
    try {
      await axios.post("/api/agent/disconnect", { agentId: agentConfig.agentId, toolSlug })
      setToolConnection(toolSlug, false)
    } catch {
      toast.add({ type: "error", title: "Unable to disconnect tool" })
    } finally { setPendingSlug(null) }
  }

  return (
    <div>
      <div>
        <h3 className="text-sm font-semibold">Tools</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Connected apps available to this agent.
        </p>
      </div>
      <div className="mt-5 divide-y divide-border rounded-xl border border-border">
        {loading ? <p className="p-4 text-sm text-muted-foreground">Loading tools…</p> : tools.filter((tool) => tool.connected).length === 0 ? <p className="p-4 text-sm text-muted-foreground">No tools are connected.</p> : tools.filter((tool) => tool.connected).map((tool) => {
          const pending = pendingSlug === tool.slug
          return <div key={tool.slug} className="flex items-center gap-3 px-3 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">{tool.icon ? <img src={tool.icon} alt="" className="size-5 object-contain" /> : <Wrench className="size-4" />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{tool.name}</span><span className="block truncate text-xs text-muted-foreground">{tool.description}</span></span>
            <div className="flex items-center gap-2"><span className="hidden items-center gap-1 text-xs text-green-600 sm:flex"><CheckCircle2 className="size-3.5" />Connected</span><Button size="sm" variant="outline" onClick={() => disconnectTool(tool.slug)} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null}Disconnect</Button></div>
          </div>
        })}
      </div>
    </div>
  )
}

export function SchedulePanel() {
  const { agentConfig } = useContext(AgentConfigContext)
  const [routines, setRoutines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [routineToDeactivate, setRoutineToDeactivate] = useState<any | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  useEffect(() => {
    if (!agentConfig?.agentId) return
    const load = async () => {
      try {
        const response = await axios.get(`/api/routines?agentId=${encodeURIComponent(agentConfig.agentId)}`)
        setRoutines(response.data.routines)
      } catch {
        toast.add({ type: "error", title: "Unable to load routines" })
      } finally { setLoading(false) }
    }
    void load()
    const changed = (event: Event) => {
      const routine = (event as CustomEvent).detail
      setRoutines((current) => {
        const index = current.findIndex((item) => item.id === routine.id)
        return index === -1 ? [routine, ...current] : current.map((item) => item.id === routine.id ? routine : item)
      })
    }
    window.addEventListener("routine:changed", changed)
    return () => window.removeEventListener("routine:changed", changed)
  }, [agentConfig?.agentId])

  const deleteRoutine = async (id: string) => {
    try {
      await axios.delete(`/api/routines?id=${encodeURIComponent(id)}`)
      setRoutines((current) => current.filter((routine) => routine.id !== id))
      toast.add({ type: "success", title: "Routine deleted" })
    } catch { toast.add({ type: "error", title: "Unable to delete routine" }) }
  }

  const deactivateRoutine = async () => {
    if (!routineToDeactivate) return
    setDeactivating(true)
    try {
      const { data } = await axios.patch("/api/routines", { id: routineToDeactivate.id, isActive: false })
      setRoutines((current) => current.map((routine) => routine.id === data.routine.id ? data.routine : routine))
      setRoutineToDeactivate(null)
      toast.add({ type: "success", title: "Routine deactivated" })
    } catch {
      toast.add({ type: "error", title: "Unable to deactivate routine" })
    } finally { setDeactivating(false) }
  }

  const activateRoutine = async (id: string) => {
    try {
      const { data } = await axios.patch("/api/routines", { id, isActive: true })
      setRoutines((current) => current.map((routine) => routine.id === data.routine.id ? data.routine : routine))
      toast.add({ type: "success", title: "Routine activated" })
    } catch {
      toast.add({ type: "error", title: "Unable to activate routine" })
    }
  }

  const describeSchedule = (schedule: any) => {
    if (!schedule) return "Schedule unavailable"
    const frequency = schedule.frequency === "once" ? "Once" : `Every ${schedule.frequency}`
    const days = schedule.weekDays?.length ? ` · ${schedule.weekDays.join(", ")}` : ""
    return `${frequency}${days} at ${schedule.time} (${schedule.timezone})`
  }

  const formatNextRun = (nextRunAt: string | null, timezone?: string) => {
    if (!nextRunAt) return "No upcoming run"
    return `Next run: ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(nextRunAt))}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Schedule</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Routines created with your agent appear here. Scheduling execution is not enabled yet.
        </p>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading routines…</p> : routines.length === 0 ? (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No routines yet. Ask your agent to create one, then use the Create routine button in its routine card.</div>
      ) : <div className="space-y-3">
        {routines.map((routine) => <div key={routine.id} className="rounded-xl border border-border p-3">
          <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{routine.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{describeSchedule(routine.schedule)}</p><p className="mt-1 text-xs text-muted-foreground">{routine.isActive === false ? "Inactive" : formatNextRun(routine.nextRunAt, routine.schedule?.timezone)}</p></div>
            <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Manage ${routine.name}`} />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent("routine:edit", { detail: routine }))}><Pencil />Edit</DropdownMenuItem>{routine.isActive === false ? <DropdownMenuItem onClick={() => activateRoutine(routine.id)}><Play />Activate</DropdownMenuItem> : <DropdownMenuItem onClick={() => setRoutineToDeactivate(routine)}><Power />Deactivate</DropdownMenuItem>}<DropdownMenuItem variant="destructive" onClick={() => deleteRoutine(routine.id)}><Trash2 />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          </div>
        </div>)}
      </div>}
      <AlertDialog open={Boolean(routineToDeactivate)} onOpenChange={(open) => !open && setRoutineToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate routine?</AlertDialogTitle>
            <AlertDialogDescription>{routineToDeactivate ? `“${routineToDeactivate.name}” will be inactive and will not have a future scheduled run.` : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deactivateRoutine} disabled={deactivating}>{deactivating ? "Deactivating…" : "Deactivate"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
