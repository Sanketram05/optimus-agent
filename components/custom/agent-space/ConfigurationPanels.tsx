import {
  CalendarClock,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Play,
  Power,
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
import { formatRoutineTime } from "@/lib/routines/format"
import { Switch } from "@/components/ui/switch"
import { useRouter } from "next/navigation"

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
          value={agentConfig?.description ?? ""}
          className="min-h-32 resize-y leading-6"
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
  const [routineToRun, setRoutineToRun] = useState<any | null>(null)
  const [executions, setExecutions] = useState<Record<string, { id: string; status: string }>>({})

  useEffect(() => {
    if (!agentConfig?.agentId) return
    const load = async () => {
      try {
        const response = await axios.get(`/api/routines?agentId=${encodeURIComponent(agentConfig.agentId)}`)
        setRoutines(response.data.routines)
        setExecutions(Object.fromEntries(response.data.routines.filter((routine: any) => routine.execution).map((routine: any) => [routine.id, routine.execution])))
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

  useEffect(() => {
    const active = Object.entries(executions).filter(([, execution]) => ["queued", "running"].includes(execution.status))
    if (!active.length) return
    const poll = window.setInterval(() => {
      active.forEach(async ([routineId, execution]) => {
        try {
          const { data } = await axios.get(`/api/routines/execution?id=${encodeURIComponent(execution.id)}`)
          setExecutions((current) => ({ ...current, [routineId]: { id: execution.id, status: data.execution.status } }))
        } catch { /* refreshed later */ }
      })
    }, 2_500)
    return () => window.clearInterval(poll)
  }, [executions])

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

  const runRoutine = async () => {
    if (!routineToRun) return
    try {
      const { data } = await axios.post("/api/routines/run", { routineId: routineToRun.id })
      const execution = data.execution
      setExecutions((current) => ({ ...current, [routineToRun.id]: { id: execution.id, status: execution.status } }))
      setRoutineToRun(null)
      const poll = window.setInterval(async () => {
        try {
          const { data: latest } = await axios.get(`/api/routines/execution?id=${encodeURIComponent(execution.id)}`)
          setExecutions((current) => ({ ...current, [routineToRun.id]: { id: execution.id, status: latest.execution.status } }))
          if (["completed", "failed", "needs_user_login"].includes(latest.execution.status)) {
            window.clearInterval(poll)
            const needsLogin = latest.execution.status === "needs_user_login"
            toast.add({
              type: needsLogin ? "info" : latest.execution.status === "completed" ? "success" : "error",
              title: needsLogin ? "Routine needs your login" : latest.execution.status === "completed" ? "Routine completed" : "Routine failed",
              description: needsLogin ? "Open this agent's Preview tab, click Open/Resume VM Desktop, sign in, then ask the agent to continue." : latest.execution.error ?? undefined,
            })
          }
        } catch { window.clearInterval(poll) }
      }, 2_500)
    } catch (error) {
      toast.add({ type: "error", title: "Unable to run routine", description: axios.isAxiosError(error) ? error.response?.data?.error : undefined })
    }
  }

  const describeSchedule = (schedule: any) => {
    if (!schedule) return "Schedule unavailable"
    const frequency = schedule.frequency === "once" ? "Once" : `Every ${schedule.frequency}`
    const days = schedule.weekDays?.length ? ` · ${schedule.weekDays.join(", ")}` : ""
    return `${frequency}${days} at ${formatRoutineTime(schedule.time)} (${schedule.timezone})`
  }

  const formatNextRun = (nextRunAt: string | null, timezone?: string) => {
    if (!nextRunAt) return "No upcoming run"
    return `Next run: ${new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone }).format(new Date(nextRunAt))}`
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
          <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{routine.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{describeSchedule(routine.schedule)}</p><p className="mt-1 text-xs text-muted-foreground">{executions[routine.id] ? executions[routine.id].status === "running" ? "Running…" : executions[routine.id].status === "queued" ? "Executing…" : executions[routine.id].status === "completed" ? "Completed" : "Failed" : routine.isActive === false ? "Inactive" : formatNextRun(routine.nextRunAt, routine.schedule?.timezone)}</p></div>
            <Button size="icon" variant="ghost" aria-label={`Run ${routine.name}`} title="Run now" onClick={() => setRoutineToRun(routine)} disabled={routine.isActive === false || ["queued", "running"].includes(executions[routine.id]?.status ?? "")}><Play className="size-4" /></Button>
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
      <AlertDialog open={Boolean(routineToRun)} onOpenChange={(open) => !open && setRoutineToRun(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Run routine now?</AlertDialogTitle><AlertDialogDescription>{routineToRun ? `“${routineToRun.name}” will run immediately.` : ""}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={runRoutine}>Run now</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function ExecutionHistoryPanel() {
  const { agentConfig } = useContext(AgentConfigContext)
  const [executions, setExecutions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!agentConfig?.agentId) return
    axios.get(`/api/routines/execution?agentId=${encodeURIComponent(agentConfig.agentId)}`)
      .then(({ data }) => setExecutions(data.executions))
      .catch(() => toast.add({ type: "error", title: "Unable to load execution history" }))
      .finally(() => setLoading(false))
  }, [agentConfig?.agentId])
  return <div className="space-y-5"><div><h3 className="text-sm font-semibold">Routine Execution History</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Recent routine outcomes and execution logs.</p></div>
    {loading ? <p className="text-sm text-muted-foreground">Loading history…</p> : executions.length === 0 ? <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No routine executions yet.</div> : <div className="space-y-3">{executions.map(({ execution, routineName }) => {
      const completed = execution.completedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(execution.completedAt)) : "In progress"
      const output = execution.result?.output ?? execution.error ?? "No output recorded."
      const vmTask = execution.result?.vmTask
      return <div key={execution.id} className="rounded-xl border border-border p-3"><div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-sm font-medium">{routineName}</p><span className={`shrink-0 text-xs font-medium ${execution.status === "completed" ? "text-green-600" : execution.status === "failed" ? "text-destructive" : execution.status === "needs_user_login" ? "text-amber-600" : "text-muted-foreground"}`}>{execution.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-muted-foreground">{completed}</p><p className="mt-2 break-words text-sm leading-5">{typeof output === "string" ? output : JSON.stringify(output)}</p>{vmTask && <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm"><p className="font-medium">VM desktop · {vmTask.status.replaceAll("_", " ")}</p><p className="mt-1">{vmTask.summary}</p>{vmTask.details?.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4">{vmTask.details.map((detail: string, index: number) => <li key={`${index}-${detail}`}>{detail}</li>)}</ul>}{vmTask.userAction && <p className="mt-2 font-medium">{vmTask.userAction}</p>}</div>}</div>
    })}</div>}
  </div>
}

export function AgentSettingsPanel() {
  const { agentConfig, setAgentConfig } = useContext(AgentConfigContext)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const isActive = agentConfig?.isActive !== false

  const changeAgentStatus = async (active: boolean) => {
    if (!agentConfig?.agentId) return
    setSavingStatus(true)
    try {
      const { data } = await axios.put("/api/agent", { agentId: agentConfig.agentId, isActive: active })
      setAgentConfig(data.agentConfig)
      toast.add({
        type: "success",
        title: active ? "Agent resumed" : "Agent paused",
        description: active ? "This agent can run again." : "This agent will no longer respond or run routines.",
      })
    } catch (error) {
      console.error("Unable to update agent status:", error)
      toast.add({ type: "error", title: "Unable to update agent status" })
    } finally {
      setSavingStatus(false)
    }
  }

  const deleteAgent = async () => {
    if (!agentConfig?.agentId) return
    setDeleting(true)
    try {
      await axios.delete("/api/agent", { params: { agentId: agentConfig.agentId } })
      toast.add({ type: "success", title: "Agent deleted" })
      router.replace("/workspace")
    } catch (error) {
      console.error("Unable to delete agent:", error)
      toast.add({ type: "error", title: "Unable to delete agent" })
      setDeleting(false)
    }
  }

  return (
    <div>
      <div>
        <h3 className="text-sm font-semibold">Agent settings</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Pause the agent or permanently remove it and its saved routines and chat history.
        </p>
      </div>
      <div className="mt-5 flex items-center gap-4 rounded-xl border border-border p-4">
        <Power className={`size-4 ${isActive ? "text-emerald-600" : "text-muted-foreground"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{isActive ? "Agent active" : "Agent paused"}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {isActive ? "The agent can respond and run scheduled routines." : "The agent will not respond or run scheduled routines."}
          </p>
        </div>
        <Switch
          checked={isActive}
          disabled={savingStatus || !agentConfig?.agentId}
          onCheckedChange={(checked) => void changeAgentStatus(checked)}
          aria-label={isActive ? "Pause agent" : "Resume agent"}
        />
      </div>
      <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex gap-2">
          <ShieldAlert className="mt-0.5 size-4 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Danger zone</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Deleting this agent is permanent and cannot be undone.
            </p>
            <Button variant="destructive" size="sm" className="mt-3" onClick={() => setDeleteOpen(true)} disabled={!agentConfig?.agentId}>
              <Trash2 className="size-3.5" />
              Delete agent
            </Button>
          </div>
        </div>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {agentConfig?.name || "this agent"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the agent, its routines, execution history, and chat history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={() => void deleteAgent()}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
