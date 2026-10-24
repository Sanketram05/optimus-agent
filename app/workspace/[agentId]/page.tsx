"use client"
import { AgentChat } from "@/components/custom/agent-space/AgentChat"
import { AgentConfigurationSidebar } from "@/components/custom/agent-space/AgentConfigurationSidebar"
import { toast } from "@/components/ui/toast";
import { AgentConfigContext } from "@/context/AgentConfigContext";
import { AgentConfigType } from "@/type/Agent";
import axios from "axios";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function AgentSpace() {

  const {agentId} = useParams();
  const [agentConfig, setAgentConfig] = useState<AgentConfigType | null>();

  useEffect(() => {
    agentId && GetAgentConfig();
  }, [agentId]);

  const GetAgentConfig = async() => {
    try {
      const res = await axios.get('/api/agent?agentId=' + agentId)
      setAgentConfig(res.data);
    } catch (error) {
      console.error("Error loading agent configuration:", error);
      toast.add({
        title: "Unable to load agent configuration",
        description: "Please try again. If the problem persists, contact support.",
        type: "error",
      });
    }
  }


  return (
    <AgentConfigContext.Provider value={{agentConfig, setAgentConfig}}>
      <div className="flex h-dvh min-w-0 overflow-hidden bg-background">
        <AgentChat />
        <AgentConfigurationSidebar />
      </div>
  </AgentConfigContext.Provider>)
}

export default AgentSpace
