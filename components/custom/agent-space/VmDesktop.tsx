"use client"

import { Monitor, X } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import axios from "axios";
import { AgentConfigContext } from "@/context/AgentConfigContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type VmStatus = "not-created" | "paused" | "running";

export function VmDesktop({
  active,
  onStatusChange,
}: {
  active: boolean;
  onStatusChange: (status: VmStatus) => void;
}) {
  const { agentConfig } = useContext(AgentConfigContext);
  const [status, setStatus] = useState<VmStatus>("not-created");
  const [streamUrl, setStreamUrl] = useState<string>();
  const [opening, setOpening] = useState(false);
  const streamUrlRef = useRef(streamUrl);
  const lastNotifiedStatus = useRef<VmStatus | undefined>(undefined);
  const agentId = agentConfig?.agentId as string | undefined;

  useEffect(() => {
    streamUrlRef.current = streamUrl;
  }, [streamUrl]);

  useEffect(() => {
    if (!agentId) return;
    const loadStatus = () => axios.get("/api/agent/vm", { params: { agentId } })
      .then(({ data }) => {
        setStatus(data.status);
        if (lastNotifiedStatus.current !== data.status) {
          lastNotifiedStatus.current = data.status;
          onStatusChange(data.status);
        }
      })
      .catch((error) => {
        console.error("Unable to load VM Desktop status", error);
        toast.add({ type: "error", title: "Unable to load VM Desktop status" });
      });
    void loadStatus();
    const statusPoll = window.setInterval(() => void loadStatus(), 15_000);
    return () => window.clearInterval(statusPoll);
  }, [agentId, onStatusChange]);

  useEffect(() => {
    if (active || !streamUrl || !agentId) return;
    streamUrlRef.current = undefined;
    setStreamUrl(undefined);
    void axios.post("/api/agent/vm", { agentId, action: "touch" })
      .catch((error) => {
        console.error("Unable to refresh VM Desktop activity after leaving Preview", error);
      });
  }, [active, streamUrl, agentId]);

  useEffect(() => () => {
    if (!agentId || !streamUrlRef.current) return;
    void axios.post("/api/agent/vm", { agentId, action: "touch" }).catch((error) => {
      console.error("Unable to refresh VM Desktop activity after leaving Preview", error);
    });
  }, [agentId]);

  const openDesktop = async () => {
    if (!agentId || opening) return;
    setOpening(true);
    try {
      const { data } = await axios.post("/api/agent/vm", { agentId, action: "activate" });
      streamUrlRef.current = data.streamUrl;
      setStreamUrl(data.streamUrl);
      setStatus("running");
    } catch (error) {
      toast.add({ type: "error", title: "Unable to open VM Desktop", description: axios.isAxiosError(error) ? error.response?.data?.error : undefined });
    } finally {
      setOpening(false);
    }
  };

  const closeDesktop = () => {
    streamUrlRef.current = undefined;
    setStreamUrl(undefined);
    if (!agentId) return;
    void axios.post("/api/agent/vm", { agentId, action: "touch" })
      .catch((error) => {
        console.error("Unable to refresh VM Desktop activity", error);
      });
  };

  useEffect(() => {
    if (!streamUrl || !agentId) return;
    const heartbeat = window.setInterval(() => {
      void axios.post("/api/agent/vm", { agentId, action: "touch" }).catch((error) => {
        console.error("Unable to refresh VM Desktop activity", error);
      });
    }, 60_000);
    return () => window.clearInterval(heartbeat);
  }, [streamUrl, agentId]);

  const label = opening ? "Starting desktop…" : status === "running" ? "Open VM Desktop" : status === "paused" ? "Resume VM Desktop" : "Create VM Desktop";

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{agentConfig?.name ?? "Agent"}&apos;s Preview</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {status === "running" ? "Your desktop pauses after two minutes without activity. Browser state is preserved." : status === "paused" ? "Your desktop is paused. Resume to continue where you left off." : "A private desktop for this agent."}
          </p>
        </div>
        {streamUrl ? (
          <Button variant="outline" size="sm" onClick={closeDesktop}><X className="size-4" />Close</Button>
        ) : (
          <Button size="sm" onClick={openDesktop} disabled={opening}>
            <Monitor className="size-4" />{label}
          </Button>
        )}
      </header>
      {streamUrl ? (
        <iframe title="VM Desktop Preview" src={streamUrl} className="h-[calc(100dvh-14rem)] min-h-[28rem] w-full rounded-lg border border-border bg-background" allow="clipboard-read; clipboard-write; fullscreen" />
      ) : (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <Monitor className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">Desktop preview is {status}</p>
          <p className="text-xs text-muted-foreground">Your browser session is kept when the desktop is paused.</p>
        </div>
      )}
    </section>
  );
}
