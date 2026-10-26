import { AgentResponse } from "@/lib/openai/agent-response-schema"

export type MessageType = {
    id: string,
    role: "user"|"assistant"|"agent",
    content: string,
    time: string,
    response?:AgentResponse,
    routineId?: string,
    editingRoutine?: {
        id: string,
        name: string,
        goal: string,
        instructions: string,
        schedule: {
            startDate: string,
            time: string,
            timezone: string,
            frequency: string,
            weekDays: string[],
        }
    },
    toolsCards?: ToolConnectionCardData[]
}

export type ToolConnectionCardData = {
    slug: string,
    name: string,
    description: string,
    icon?: string;
    isConnected?: boolean,
    isEnabled?: boolean,
    redirectUrl?: string | null;
}
